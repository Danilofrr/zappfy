-- Baixa automática do estoque móvel do motoboy quando a mercadoria
-- deixa fisicamente a posse dele por ENTREGA ou DEVOLUÇÃO À LOJA.
--
-- Regras:
-- - aguardando / aceito / em rota / não entregue / retornando: NÃO alteram estoque móvel;
-- - entregue: baixa os itens do pedido do estoque móvel do motoboy responsável;
-- - devolvido à loja: também baixa do estoque móvel, pois a mercadoria deixou a posse do motoboy;
-- - nunca deixa quantidade negativa;
-- - ações repetidas não geram baixa dupla.

ALTER TABLE public.courier_inventory_movements
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_tracking_id uuid REFERENCES public.delivery_tracking(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS courier_inventory_movements_order_idx
  ON public.courier_inventory_movements(store_id, courier_id, order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS courier_inventory_movements_tracking_idx
  ON public.courier_inventory_movements(delivery_tracking_id, movement_type)
  WHERE delivery_tracking_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consume_courier_inventory_for_order(
  _store_id uuid,
  _courier_id uuid,
  _order_id uuid,
  _tracking_id uuid,
  _movement_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.orders;
  item jsonb;
  item_product_id uuid;
  item_name text;
  requested_qty integer;
  remaining_qty integer;
  total_consumed integer := 0;
  consumed_from_item integer;
  inventory_row public.courier_inventory;
  take_qty integer;
  candidate_count integer;
  matching_variant_count integer;
  clean_type text := lower(trim(COALESCE(_movement_type, '')));
BEGIN
  IF clean_type NOT IN ('delivered', 'return') THEN
    RAISE EXCEPTION 'Tipo de baixa automática inválido';
  END IF;

  -- Idempotência: um mesmo fechamento de entrega só pode consumir uma vez.
  IF EXISTS (
    SELECT 1
    FROM public.courier_inventory_movements
    WHERE delivery_tracking_id = _tracking_id
      AND movement_type = clean_type
  ) THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'already_processed');
  END IF;

  SELECT * INTO order_row
  FROM public.orders
  WHERE id = _order_id
    AND store_id = _store_id;

  IF order_row.id IS NULL THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'order_not_found');
  END IF;

  FOR item IN
    SELECT value FROM jsonb_array_elements(COALESCE(order_row.items::jsonb, '[]'::jsonb))
  LOOP
    item_product_id := NULL;
    item_name := trim(COALESCE(item->>'name', ''));
    requested_qty := GREATEST(COALESCE((item->>'qty')::integer, 0), 0);

    IF requested_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF COALESCE(item->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      item_product_id := (item->>'productId')::uuid;
    ELSE
      SELECT p.id INTO item_product_id
      FROM public.products p
      WHERE p.store_id = _store_id
        AND lower(trim(p.name)) = lower(item_name)
      ORDER BY p.created_at NULLS LAST
      LIMIT 1;
    END IF;

    IF item_product_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT
      count(*),
      count(*) FILTER (
        WHERE trim(COALESCE(ci.variant_label, '')) = ''
           OR position(lower(trim(ci.variant_label)) in lower(item_name)) > 0
      )
    INTO candidate_count, matching_variant_count
    FROM public.courier_inventory ci
    WHERE ci.store_id = _store_id
      AND ci.courier_id = _courier_id
      AND ci.product_id = item_product_id
      AND ci.quantity > 0;

    IF candidate_count = 0 THEN
      CONTINUE;
    END IF;

    remaining_qty := requested_qty;
    consumed_from_item := 0;

    FOR inventory_row IN
      SELECT ci.*
      FROM public.courier_inventory ci
      WHERE ci.store_id = _store_id
        AND ci.courier_id = _courier_id
        AND ci.product_id = item_product_id
        AND ci.quantity > 0
        AND (
          -- Se houver variante que case com o nome do item, usa apenas as compatíveis
          -- (e itens sem variante). Se existir apenas uma linha desse produto, ela pode
          -- ser usada como fallback mesmo que a variação não esteja no nome do pedido.
          (matching_variant_count > 0 AND (
            trim(COALESCE(ci.variant_label, '')) = ''
            OR position(lower(trim(ci.variant_label)) in lower(item_name)) > 0
          ))
          OR (matching_variant_count = 0 AND candidate_count = 1)
        )
      ORDER BY
        CASE
          WHEN trim(COALESCE(ci.variant_label, '')) <> ''
           AND position(lower(trim(ci.variant_label)) in lower(item_name)) > 0 THEN 0
          WHEN trim(COALESCE(ci.variant_label, '')) = '' THEN 1
          ELSE 2
        END,
        ci.updated_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN remaining_qty <= 0;

      take_qty := LEAST(remaining_qty, inventory_row.quantity);
      IF take_qty <= 0 THEN
        CONTINUE;
      END IF;

      IF inventory_row.quantity - take_qty = 0 THEN
        DELETE FROM public.courier_inventory
        WHERE id = inventory_row.id;
      ELSE
        UPDATE public.courier_inventory
        SET quantity = inventory_row.quantity - take_qty,
            updated_by = auth.uid()
        WHERE id = inventory_row.id;
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
        created_by,
        order_id,
        delivery_tracking_id
      ) VALUES (
        _store_id,
        _courier_id,
        item_product_id,
        inventory_row.variant_label,
        clean_type,
        inventory_row.quantity,
        inventory_row.quantity - take_qty,
        -take_qty,
        CASE
          WHEN clean_type = 'delivered' THEN 'Baixa automática após pedido entregue'
          ELSE 'Baixa automática após devolução à loja'
        END,
        auth.uid(),
        _order_id,
        _tracking_id
      );

      remaining_qty := remaining_qty - take_qty;
      consumed_from_item := consumed_from_item + take_qty;
      total_consumed := total_consumed + take_qty;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'changed', total_consumed > 0,
    'consumed_quantity', total_consumed,
    'order_id', _order_id,
    'courier_id', _courier_id,
    'movement_type', clean_type
  );
END;
$$;

-- Função interna: a baixa é disparada pelo próprio status da entrega.
REVOKE ALL ON FUNCTION public.consume_courier_inventory_for_order(uuid,uuid,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_courier_inventory_on_delivery_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.courier_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'entregue' THEN
    PERFORM public.consume_courier_inventory_for_order(
      NEW.store_id,
      NEW.courier_id,
      NEW.order_id,
      NEW.id,
      'delivered'
    );
  ELSIF NEW.status = 'devolvido' THEN
    PERFORM public.consume_courier_inventory_for_order(
      NEW.store_id,
      NEW.courier_id,
      NEW.order_id,
      NEW.id,
      'return'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_courier_inventory_on_delivery_status ON public.delivery_tracking;
CREATE TRIGGER trg_sync_courier_inventory_on_delivery_status
  AFTER UPDATE OF status ON public.delivery_tracking
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_courier_inventory_on_delivery_status();

-- Inclui o vínculo do pedido no histórico mostrado ao administrador.
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
        m.order_id,
        m.delivery_tracking_id,
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

GRANT EXECUTE ON FUNCTION public.list_courier_inventory_movements(uuid,uuid,integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
