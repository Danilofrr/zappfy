
CREATE OR REPLACE FUNCTION public.reserve_courier_inventory_for_order(
  _store_id uuid,
  _courier_id uuid,
  _order_id uuid,
  _tracking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_row public.orders;
  item jsonb;
  item_product_id uuid;
  item_name text;
  requested_qty integer;
  remaining_qty integer;
  total_reserved integer := 0;
  inventory_row public.courier_inventory;
  take_qty integer;
  candidate_count integer;
  matching_variant_count integer;
  last_release_at timestamptz;
BEGIN
  -- Idempotência: enquanto a atribuição atual não tiver sido liberada,
  -- o mesmo pedido não pode baixar a carga móvel duas vezes.
  SELECT max(created_at)
  INTO last_release_at
  FROM public.courier_inventory_movements
  WHERE delivery_tracking_id = _tracking_id
    AND courier_id = _courier_id
    AND movement_type = 'unassigned';

  IF EXISTS (
    SELECT 1
    FROM public.courier_inventory_movements
    WHERE delivery_tracking_id = _tracking_id
      AND courier_id = _courier_id
      AND movement_type = 'assigned'
      AND created_at > COALESCE(last_release_at, '-infinity'::timestamptz)
  ) THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'already_reserved');
  END IF;

  SELECT *
  INTO order_row
  FROM public.orders
  WHERE id = _order_id
    AND store_id = _store_id;

  IF order_row.id IS NULL THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'order_not_found');
  END IF;

  FOR item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(order_row.items::jsonb, '[]'::jsonb))
  LOOP
    item_product_id := NULL;
    item_name := trim(COALESCE(item->>'name', ''));

    requested_qty := CASE
      WHEN COALESCE(item->>'qty', '') ~ '^\d+$'
      THEN (item->>'qty')::integer
      ELSE 0
    END;

    requested_qty := GREATEST(requested_qty, 0);
    IF requested_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF COALESCE(item->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      item_product_id := (item->>'productId')::uuid;
    ELSE
      SELECT p.id
      INTO item_product_id
      FROM public.products p
      WHERE p.store_id = _store_id
        AND lower(trim(p.name)) = lower(item_name)
      ORDER BY p.created_at NULLS LAST
      LIMIT 1;
    END IF;

    -- Pedido continua normalmente mesmo se não for possível relacionar
    -- o item a um produto cadastrado.
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

    FOR inventory_row IN
      SELECT ci.*
      FROM public.courier_inventory ci
      WHERE ci.store_id = _store_id
        AND ci.courier_id = _courier_id
        AND ci.product_id = item_product_id
        AND ci.quantity > 0
        AND (
          (
            matching_variant_count > 0
            AND (
              trim(COALESCE(ci.variant_label, '')) = ''
              OR position(lower(trim(ci.variant_label)) in lower(item_name)) > 0
            )
          )
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
      )
      VALUES (
        _store_id,
        _courier_id,
        item_product_id,
        inventory_row.variant_label,
        'assigned',
        inventory_row.quantity,
        inventory_row.quantity - take_qty,
        -take_qty,
        'Baixa automática do estoque móvel ao atribuir o pedido ao motoboy',
        auth.uid(),
        _order_id,
        _tracking_id
      );

      remaining_qty := remaining_qty - take_qty;
      total_reserved := total_reserved + take_qty;
    END LOOP;

    -- Se o estoque móvel tiver menos unidades do que o pedido precisa,
    -- usa apenas o que existe e NÃO bloqueia a atribuição.
  END LOOP;

  RETURN jsonb_build_object(
    'changed', total_reserved > 0,
    'reserved_quantity', total_reserved,
    'order_id', _order_id,
    'courier_id', _courier_id
  );
END;
$function$;


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
SET search_path TO 'public'
AS $function$
DECLARE
  clean_type text := lower(trim(COALESCE(_movement_type, '')));
BEGIN
  IF clean_type NOT IN ('delivered', 'return') THEN
    RAISE EXCEPTION 'Tipo de baixa automática inválido';
  END IF;

  -- Se a mercadoria já foi retirada do estoque móvel no momento da atribuição,
  -- não pode ser baixada novamente ao concluir/devolver a entrega.
  IF EXISTS (
    SELECT 1
    FROM public.courier_inventory_movements
    WHERE delivery_tracking_id = _tracking_id
      AND courier_id = _courier_id
      AND movement_type = 'assigned'
  ) THEN
    RETURN jsonb_build_object(
      'changed', false,
      'reason', 'already_consumed_on_assignment',
      'order_id', _order_id,
      'courier_id', _courier_id
    );
  END IF;

  RETURN jsonb_build_object(
    'changed', false,
    'reason', 'no_mobile_inventory_reserved',
    'order_id', _order_id,
    'courier_id', _courier_id
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.accept_delivery_v2(_session text, _code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
  t public.delivery_tracking;
  previous_courier uuid;
BEGIN
  c := public._resolve_courier_session(_session);

  SELECT * INTO t
  FROM public.delivery_tracking
  WHERE tracking_code = _code
    AND store_id = c.store_id
  LIMIT 1
  FOR UPDATE;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Entrega não encontrada';
  END IF;

  IF t.courier_id IS NOT NULL AND t.courier_id <> c.id THEN
    RAISE EXCEPTION 'Esta entrega já foi aceita por outro motoboy';
  END IF;

  IF t.status NOT IN ('aguardando_motoboy','preparando') AND t.courier_id IS NULL THEN
    RAISE EXCEPTION 'Esta entrega não está disponível';
  END IF;

  previous_courier := t.courier_id;

  UPDATE public.delivery_tracking
  SET courier_id = c.id,
      courier_name = c.name,
      courier_phone = c.phone,
      accepted_at = COALESCE(accepted_at, now())
  WHERE id = t.id;

  -- Também funciona quando um motoboy aceita diretamente uma entrega
  -- que ainda não tinha motoboy fixado pelo painel.
  IF previous_courier IS NULL THEN
    PERFORM public.reserve_courier_inventory_for_order(
      c.store_id,
      c.id,
      t.order_id,
      t.id
    );
  END IF;

  RETURN jsonb_build_object(
    'courier_token', t.courier_token,
    'tracking_code', t.tracking_code
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
