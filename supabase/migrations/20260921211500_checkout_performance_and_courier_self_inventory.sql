-- Performance do checkout público + carga extra autogerida pelo motoboy.
-- 1) Checkout em uma única chamada e cálculo de estoque em lote.
-- 2) Motoboy pode informar a própria carga avulsa usando a sessão da Central.
-- 3) Bootstrap da Central traz identidade, entregas e carga em um único round-trip.

CREATE OR REPLACE FUNCTION public.get_public_checkout_payload(_slug text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.settings;
  settings_json jsonb;
  products_json jsonb;
  clean_slug text := lower(trim(COALESCE(_slug, '')));
BEGIN
  IF clean_slug <> '' THEN
    SELECT * INTO s
    FROM public.settings
    WHERE slug IS NOT NULL
      AND lower(slug) = clean_slug
    LIMIT 1;
  ELSE
    SELECT * INTO s
    FROM public.settings
    WHERE slug IS NOT NULL
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF s.store_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(sp)
  INTO settings_json
  FROM public.settings_public sp
  WHERE lower(sp.slug) = lower(s.slug)
  LIMIT 1;

  WITH mobile AS (
    SELECT ci.product_id, COALESCE(sum(ci.quantity), 0)::integer AS qty
    FROM public.courier_inventory ci
    JOIN public.couriers c
      ON c.id = ci.courier_id
     AND c.store_id = ci.store_id
     AND c.active = true
    WHERE ci.store_id = s.store_id
      AND ci.quantity > 0
    GROUP BY ci.product_id
  ),
  reservations AS (
    SELECT
      (item->>'productId')::uuid AS product_id,
      o.id AS order_id,
      sum(
        CASE
          WHEN COALESCE(item->>'inventoryReservationVersion', '') = '2'
           AND COALESCE(item->>'mobileReservedQty', '') ~ '^\\d+$'
          THEN (item->>'mobileReservedQty')::integer
          ELSE 0
        END
      )::integer AS reserved_qty
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items::jsonb, '[]'::jsonb)) item
    WHERE o.store_id = s.store_id
      AND COALESCE(o.status, '') NOT IN ('entregue', 'cancelado', 'cancelada')
      AND COALESCE(item->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    GROUP BY (item->>'productId')::uuid, o.id
  ),
  movement_balance AS (
    SELECT
      m.product_id,
      m.order_id,
      greatest(-COALESCE(sum(m.quantity_delta), 0), 0)::integer AS consumed_qty
    FROM public.courier_inventory_movements m
    WHERE m.store_id = s.store_id
      AND m.product_id IS NOT NULL
      AND m.order_id IS NOT NULL
      AND m.movement_type IN ('assigned', 'unassigned')
    GROUP BY m.product_id, m.order_id
  ),
  pending AS (
    SELECT
      r.product_id,
      COALESCE(sum(greatest(r.reserved_qty - COALESCE(m.consumed_qty, 0), 0)), 0)::integer AS qty
    FROM reservations r
    LEFT JOIN movement_balance m
      ON m.order_id = r.order_id
     AND m.product_id = r.product_id
    GROUP BY r.product_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'user_id', p.user_id,
        'name', p.name,
        'price', p.price,
        'stock', greatest(COALESCE(p.stock, 0) + COALESCE(m.qty, 0) - COALESCE(pd.qty, 0), 0),
        'image_url', p.image_url,
        'created_at', p.created_at
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO products_json
  FROM public.products p
  LEFT JOIN mobile m ON m.product_id = p.id
  LEFT JOIN pending pd ON pd.product_id = p.id
  WHERE p.store_id = s.store_id;

  RETURN jsonb_build_object(
    'settings', settings_json,
    'products', products_json
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_checkout_payload(text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.courier_inventory_snapshot(_session text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
  items_json jsonb;
  products_json jsonb;
BEGIN
  c := public._resolve_courier_session(_session);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ci.id,
        'product_id', ci.product_id,
        'product_name', p.name,
        'variant_label', ci.variant_label,
        'quantity', ci.quantity,
        'notes', ci.notes,
        'unit_price', COALESCE(p.price, 0),
        'image_url', p.image_url,
        'updated_at', ci.updated_at
      )
      ORDER BY p.name, ci.variant_label
    ),
    '[]'::jsonb
  )
  INTO items_json
  FROM public.courier_inventory ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.store_id = c.store_id
    AND ci.courier_id = c.id
    AND ci.quantity > 0;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'category', COALESCE(p.category, ''),
        'price', COALESCE(p.price, 0),
        'stock', greatest(COALESCE(p.stock, 0), 0),
        'image_url', p.image_url
      )
      ORDER BY p.name
    ),
    '[]'::jsonb
  )
  INTO products_json
  FROM public.products p
  WHERE p.store_id = c.store_id;

  RETURN jsonb_build_object(
    'items', items_json,
    'products', products_json,
    'total_quantity', COALESCE((
      SELECT sum(ci.quantity)
      FROM public.courier_inventory ci
      WHERE ci.store_id = c.store_id
        AND ci.courier_id = c.id
        AND ci.quantity > 0
    ), 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.courier_inventory_snapshot(text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.courier_adjust_own_inventory(
  _session text,
  _product_id uuid,
  _variant_label text,
  _delta integer,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
  p public.products;
  current_row public.courier_inventory;
  clean_variant text := trim(COALESCE(_variant_label, ''));
  old_qty integer := 0;
  new_qty integer := 0;
  movement text;
  clean_notes text;
BEGIN
  c := public._resolve_courier_session(_session);

  IF _delta IS NULL OR _delta = 0 THEN
    RAISE EXCEPTION 'Informe uma quantidade maior que zero';
  END IF;

  SELECT * INTO p
  FROM public.products
  WHERE id = _product_id
    AND store_id = c.store_id
  LIMIT 1;

  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado nesta loja';
  END IF;

  SELECT * INTO current_row
  FROM public.courier_inventory
  WHERE store_id = c.store_id
    AND courier_id = c.id
    AND product_id = _product_id
    AND variant_label = clean_variant
  FOR UPDATE;

  IF current_row.id IS NOT NULL THEN
    old_qty := current_row.quantity;
  END IF;

  new_qty := old_qty + _delta;
  IF new_qty < 0 THEN
    RAISE EXCEPTION 'Você possui apenas % unidade(s) deste produto na carga extra', old_qty;
  END IF;

  movement := CASE WHEN _delta > 0 THEN 'load' ELSE 'return' END;
  clean_notes := COALESCE(
    NULLIF(trim(COALESCE(_notes, '')), ''),
    CASE
      WHEN _delta > 0 THEN 'Carga extra informada pelo motoboy na Central de Entregas'
      ELSE 'Retirada da carga extra informada pelo motoboy na Central de Entregas'
    END
  );

  IF new_qty = 0 THEN
    DELETE FROM public.courier_inventory
    WHERE id = current_row.id;
  ELSIF current_row.id IS NULL THEN
    INSERT INTO public.courier_inventory(
      store_id, courier_id, product_id, variant_label, quantity, notes, updated_by
    ) VALUES (
      c.store_id, c.id, _product_id, clean_variant, new_qty, clean_notes, NULL
    );
  ELSE
    UPDATE public.courier_inventory
    SET quantity = new_qty,
        notes = clean_notes,
        updated_by = NULL
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
    c.store_id,
    c.id,
    _product_id,
    clean_variant,
    movement,
    old_qty,
    new_qty,
    _delta,
    clean_notes,
    NULL
  );

  RETURN jsonb_build_object(
    'changed', true,
    'product_id', _product_id,
    'product_name', p.name,
    'old_quantity', old_qty,
    'new_quantity', new_qty,
    'delta', _delta
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.courier_adjust_own_inventory(text,uuid,text,integer,text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.courier_central_bootstrap(_session text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN jsonb_build_object(
    'me', public.courier_me(_session),
    'deliveries', public.list_my_delivery_load(_session),
    'inventory', public.courier_inventory_snapshot(_session)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.courier_central_bootstrap(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
