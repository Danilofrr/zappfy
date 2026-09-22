-- Evita detoast/leitura de imagens Base64 durante o bootstrap da Central
-- e cria um tema leve específico para o painel do motoboy.

CREATE OR REPLACE FUNCTION public.courier_me(_session text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
  store_name_value text;
  store_slug_value text;
BEGIN
  c := public._resolve_courier_session(_session);

  SELECT COALESCE(store_name, 'Loja'), slug
  INTO store_name_value, store_slug_value
  FROM public.settings
  WHERE store_id = c.store_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'courier_id', c.id,
    'name', c.name,
    'phone', c.phone,
    'vehicle_type', c.vehicle_type,
    'plate', c.plate,
    'is_online', COALESCE(c.is_online, false),
    'online_updated_at', c.online_updated_at,
    'store_id', c.store_id,
    'store_name', COALESCE(store_name_value, 'Loja'),
    'store_logo_url',
      CASE
        WHEN COALESCE(store_slug_value, '') <> ''
          THEN '/api/public/store-asset/' || store_slug_value || '/logo'
        ELSE NULL
      END,
    'slug', store_slug_value
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
            WHEN p.image_url IS NOT NULL AND p.image_url <> ''
              THEN '/api/public/product-image/' || p.id::text
            ELSE NULL
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

CREATE OR REPLACE FUNCTION public.get_zappfy_central_theme_light()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'id', z.id,
      'logo_url', NULL,
      'logo_size', z.logo_size,
      'header_color', z.header_color,
      'header_text_color', z.header_text_color,
      'background_color', z.background_color,
      'card_color', z.card_color,
      'card_border_color', z.card_border_color,
      'card_shadow_color', z.card_shadow_color,
      'card_radius', z.card_radius,
      'text_color', z.text_color,
      'title_color', z.title_color,
      'button_color', z.button_color,
      'button_text_color', z.button_text_color,
      'icon_color', z.icon_color,
      'footer_text', z.footer_text,
      'brand_name', z.brand_name
    )
    FROM public.zappfy_central_settings z
    ORDER BY z.created_at ASC
    LIMIT 1
  ), '{}'::jsonb);
$function$;

GRANT EXECUTE ON FUNCTION public.courier_me(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_inventory_snapshot(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_zappfy_central_theme_light() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
