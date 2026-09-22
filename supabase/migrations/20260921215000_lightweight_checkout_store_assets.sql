-- Evita enviar imagens Base64 gigantes dentro do JSON inicial do checkout.
-- Imagens armazenadas como data URL passam a ser servidas por um endpoint cacheável.

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

  SELECT
    to_jsonb(sp)
    || jsonb_build_object(
      'checkout_logo_url',
        CASE
          WHEN sp.checkout_logo_url LIKE 'data:%'
            THEN '/api/public/store-asset/' || s.slug || '/logo'
          ELSE sp.checkout_logo_url
        END,
      'checkout_footer_cards_image_url',
        CASE
          WHEN sp.checkout_footer_cards_image_url LIKE 'data:%'
            THEN '/api/public/store-asset/' || s.slug || '/cards'
          ELSE sp.checkout_footer_cards_image_url
        END
    )
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
           AND COALESCE(item->>'mobileReservedQty', '') ~ '^\d+$'
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
        'image_url',
          CASE
            WHEN p.image_url LIKE 'data:%'
              THEN '/api/public/product-image/' || p.id::text
            ELSE p.image_url
          END,
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

NOTIFY pgrst, 'reload schema';
