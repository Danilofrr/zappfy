-- Expõe a taxa configurada do motoboy na sessão da Central de Entregas.
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
  motoboy_fee_value numeric := 0;
BEGIN
  c := public._resolve_courier_session(_session);

  SELECT COALESCE(store_name, 'Loja'), slug, COALESCE(motoboy_fee, 0)
  INTO store_name_value, store_slug_value, motoboy_fee_value
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
    'slug', store_slug_value,
    'motoboy_fee', COALESCE(motoboy_fee_value, 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.courier_me(text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
