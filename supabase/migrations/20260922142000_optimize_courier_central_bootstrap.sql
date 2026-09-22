-- Reduz drasticamente o payload inicial da Central de Entregas.
-- Imagens Base64 passam a ser carregadas por endpoints cacheáveis, fora do bootstrap.

CREATE OR REPLACE FUNCTION public.courier_me(_session text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
  st public.settings;
  logo_url text;
BEGIN
  c := public._resolve_courier_session(_session);
  SELECT * INTO st
  FROM public.settings
  WHERE store_id = c.store_id
  LIMIT 1;

  logo_url := CASE
    WHEN COALESCE(st.checkout_logo_url, '') LIKE 'data:%'
      AND COALESCE(st.slug, '') <> ''
      THEN '/api/public/store-asset/' || st.slug || '/logo'
    ELSE st.checkout_logo_url
  END;

  RETURN jsonb_build_object(
    'courier_id', c.id,
    'name', c.name,
    'phone', c.phone,
    'vehicle_type', c.vehicle_type,
    'plate', c.plate,
    'is_online', COALESCE(c.is_online, false),
    'online_updated_at', c.online_updated_at,
    'store_id', c.store_id,
    'store_name', COALESCE(st.store_name, 'Loja'),
    'store_logo_url', logo_url,
    'slug', st.slug
  );
END;
$function$;

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
        'image_url',
          CASE
            WHEN COALESCE(p.image_url, '') LIKE 'data:%'
              THEN '/api/public/product-image/' || p.id::text
            ELSE p.image_url
          END,
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

  -- A lista de seleção não precisa transportar as imagens dos produtos.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'category', COALESCE(p.category, ''),
        'price', COALESCE(p.price, 0),
        'stock', GREATEST(COALESCE(p.stock, 0), 0)
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

GRANT EXECUTE ON FUNCTION public.courier_me(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_inventory_snapshot(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
