-- Estoque movel / carga avulsa dos motoboys.
--
-- Este controle representa a posse fisica de produtos que o motoboy leva antes
-- de existir um pedido (ex.: 3 Game Stick, 1 relogio prata, 1 relogio preto).
-- Ele NAO altera products.stock: o estoque geral continua sendo baixado pela
-- rotina de pedidos existente. Assim evitamos baixa dupla quando um produto da
-- carga avulsa for usado posteriormente em um pedido.

CREATE TABLE IF NOT EXISTS public.courier_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_label text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, courier_id, product_id, variant_label)
);

CREATE TABLE IF NOT EXISTS public.courier_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_label text NOT NULL DEFAULT '',
  movement_type text NOT NULL CHECK (
    movement_type IN ('load','return','delivered','sold','adjustment','loss')
  ),
  old_quantity integer NOT NULL DEFAULT 0,
  new_quantity integer NOT NULL DEFAULT 0,
  quantity_delta integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courier_inventory_store_courier_idx
  ON public.courier_inventory(store_id, courier_id);
CREATE INDEX IF NOT EXISTS courier_inventory_product_idx
  ON public.courier_inventory(store_id, product_id);
CREATE INDEX IF NOT EXISTS courier_inventory_movements_timeline_idx
  ON public.courier_inventory_movements(store_id, courier_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_courier_inventory_updated ON public.courier_inventory;
CREATE TRIGGER trg_courier_inventory_updated
  BEFORE UPDATE ON public.courier_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.courier_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_inventory_movements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.courier_inventory TO authenticated;
GRANT SELECT ON public.courier_inventory_movements TO authenticated;

DROP POLICY IF EXISTS "store members read courier inventory" ON public.courier_inventory;
CREATE POLICY "store members read courier inventory"
  ON public.courier_inventory
  FOR SELECT TO authenticated
  USING (public._can_manage_store(store_id));

DROP POLICY IF EXISTS "store members read courier inventory movements" ON public.courier_inventory_movements;
CREATE POLICY "store members read courier inventory movements"
  ON public.courier_inventory_movements
  FOR SELECT TO authenticated
  USING (public._can_manage_store(store_id));

CREATE OR REPLACE FUNCTION public.list_courier_inventory(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ci.id,
        'store_id', ci.store_id,
        'courier_id', ci.courier_id,
        'product_id', ci.product_id,
        'product_name', p.name,
        'category', COALESCE(p.category, ''),
        'variant_label', ci.variant_label,
        'quantity', ci.quantity,
        'unit_price', COALESCE(p.price, 0),
        'unit_cost', COALESCE(p.cost, 0),
        'sale_value', ci.quantity * COALESCE(p.price, 0),
        'cost_value', ci.quantity * COALESCE(p.cost, 0),
        'notes', ci.notes,
        'updated_at', ci.updated_at
      )
      ORDER BY c.name, p.name, ci.variant_label
    )
    FROM public.courier_inventory ci
    JOIN public.couriers c ON c.id = ci.courier_id
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.store_id = _store_id
      AND ci.quantity > 0
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_courier_inventory_quantity(
  _store_id uuid,
  _courier_id uuid,
  _product_id uuid,
  _variant_label text,
  _quantity integer,
  _movement_type text DEFAULT 'adjustment',
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.courier_inventory;
  old_qty integer := 0;
  clean_variant text := trim(COALESCE(_variant_label, ''));
  clean_type text := COALESCE(NULLIF(trim(_movement_type), ''), 'adjustment');
  product_row public.products;
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF _quantity IS NULL OR _quantity < 0 THEN
    RAISE EXCEPTION 'Quantidade invalida';
  END IF;

  IF clean_type NOT IN ('load','return','delivered','sold','adjustment','loss') THEN
    RAISE EXCEPTION 'Tipo de movimentacao invalido';
  END IF;

  PERFORM 1
  FROM public.couriers
  WHERE id = _courier_id
    AND store_id = _store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Motoboy nao encontrado nesta loja';
  END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = _product_id
    AND store_id = _store_id;
  IF product_row.id IS NULL THEN
    RAISE EXCEPTION 'Produto nao encontrado nesta loja';
  END IF;

  SELECT * INTO current_row
  FROM public.courier_inventory
  WHERE store_id = _store_id
    AND courier_id = _courier_id
    AND product_id = _product_id
    AND variant_label = clean_variant
  FOR UPDATE;

  IF current_row.id IS NOT NULL THEN
    old_qty := current_row.quantity;
  END IF;

  IF old_qty = _quantity THEN
    RETURN jsonb_build_object(
      'changed', false,
      'old_quantity', old_qty,
      'new_quantity', _quantity
    );
  END IF;

  IF _quantity = 0 THEN
    DELETE FROM public.courier_inventory
    WHERE id = current_row.id;
  ELSIF current_row.id IS NULL THEN
    INSERT INTO public.courier_inventory(
      store_id,
      courier_id,
      product_id,
      variant_label,
      quantity,
      notes,
      updated_by
    ) VALUES (
      _store_id,
      _courier_id,
      _product_id,
      clean_variant,
      _quantity,
      NULLIF(trim(COALESCE(_notes, '')), ''),
      auth.uid()
    );
  ELSE
    UPDATE public.courier_inventory
    SET quantity = _quantity,
        notes = COALESCE(NULLIF(trim(COALESCE(_notes, '')), ''), notes),
        updated_by = auth.uid()
    WHERE id = current_row.id;
  END IF;

  INSERT INTO public.courier_inventory_movements(
    store_id,
    courier_id,
    product_id,
    variant_label,
    movement_type,
    old_quantity,
    new_quantity,
    quantity_delta,
    notes,
    created_by
  ) VALUES (
    _store_id,
    _courier_id,
    _product_id,
    clean_variant,
    clean_type,
    old_qty,
    _quantity,
    _quantity - old_qty,
    NULLIF(trim(COALESCE(_notes, '')), ''),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'changed', true,
    'old_quantity', old_qty,
    'new_quantity', _quantity,
    'delta', _quantity - old_qty
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_courier_inventory_movements(
  _store_id uuid,
  _courier_id uuid,
  _limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT
        m.id,
        m.product_id,
        COALESCE(p.name, 'Produto removido') AS product_name,
        COALESCE(p.category, '') AS category,
        m.variant_label,
        m.movement_type,
        m.old_quantity,
        m.new_quantity,
        m.quantity_delta,
        m.notes,
        m.created_at
      FROM public.courier_inventory_movements m
      LEFT JOIN public.products p ON p.id = m.product_id
      WHERE m.store_id = _store_id
        AND m.courier_id = _courier_id
      ORDER BY m.created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 200)
    ) x
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_courier_inventory(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_courier_inventory_quantity(uuid,uuid,uuid,text,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_courier_inventory_movements(uuid,uuid,integer) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_inventory;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
