
CREATE OR REPLACE FUNCTION public.bulk_update_products(
  _store_id uuid,
  _product_ids uuid[],
  _action text,
  _value numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p public.products;
  owner_id_value uuid;
  qty integer;
  old_stock integer;
  new_stock integer;
  delta integer;
  updated_count integer := 0;
BEGIN
  IF NOT public.team_has_permission(_store_id, 'inventory') THEN
    RAISE EXCEPTION 'Sem permissão para alterar o estoque';
  END IF;

  IF _product_ids IS NULL OR cardinality(_product_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um produto';
  END IF;

  IF cardinality(_product_ids) > 200 THEN
    RAISE EXCEPTION 'Selecione no máximo 200 produtos por vez';
  END IF;

  IF _action NOT IN ('stock_add','stock_remove','price','cost') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  IF COALESCE(_value, -1) < 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  IF _action = 'cost' AND NOT public.team_has_permission(_store_id, 'finance') THEN
    RAISE EXCEPTION 'Sem permissão para alterar preço de custo';
  END IF;

  SELECT owner_id INTO owner_id_value
  FROM public.stores
  WHERE id = _store_id;

  IF owner_id_value IS NULL THEN
    RAISE EXCEPTION 'Loja não encontrada';
  END IF;

  qty := GREATEST(trunc(COALESCE(_value,0))::integer, 0);

  FOR p IN
    SELECT *
    FROM public.products
    WHERE store_id = _store_id
      AND id = ANY(_product_ids)
    ORDER BY id
    FOR UPDATE
  LOOP
    IF _action = 'stock_add' THEN
      IF qty <= 0 THEN
        RAISE EXCEPTION 'Informe uma quantidade maior que zero';
      END IF;

      old_stock := COALESCE(p.stock,0);
      new_stock := old_stock + qty;
      delta := qty;

      UPDATE public.products
      SET stock = new_stock,
          updated_at = now()
      WHERE id = p.id;

      INSERT INTO public.stock_movements(
        user_id, store_id, product_id, product_name,
        type, quantity, unit_cost, total,
        notes, occurred_at
      )
      VALUES(
        auth.uid(), _store_id, p.id, p.name,
        'ajuste', delta, COALESCE(p.cost,0), 0,
        'Ajuste em massa: aumento de estoque (' || old_stock || ' → ' || new_stock || ')',
        now()
      );

    ELSIF _action = 'stock_remove' THEN
      IF qty <= 0 THEN
        RAISE EXCEPTION 'Informe uma quantidade maior que zero';
      END IF;

      old_stock := COALESCE(p.stock,0);
      new_stock := GREATEST(old_stock - qty, 0);
      delta := new_stock - old_stock;

      UPDATE public.products
      SET stock = new_stock,
          updated_at = now()
      WHERE id = p.id;

      IF delta <> 0 THEN
        INSERT INTO public.stock_movements(
          user_id, store_id, product_id, product_name,
          type, quantity, unit_cost, total,
          notes, occurred_at
        )
        VALUES(
          auth.uid(), _store_id, p.id, p.name,
          'ajuste', delta, COALESCE(p.cost,0), 0,
          'Ajuste em massa: redução de estoque (' || old_stock || ' → ' || new_stock || ')',
          now()
        );
      END IF;

    ELSIF _action = 'price' THEN
      UPDATE public.products
      SET price = round(_value::numeric, 2),
          updated_at = now()
      WHERE id = p.id;

    ELSIF _action = 'cost' THEN
      UPDATE public.products
      SET cost = round(_value::numeric, 2),
          updated_at = now()
      WHERE id = p.id;
    END IF;

    updated_count := updated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'updated_count', updated_count,
    'action', _action,
    'value', _value
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bulk_update_products(uuid,uuid[],text,numeric) TO authenticated;
NOTIFY pgrst,'reload schema';
