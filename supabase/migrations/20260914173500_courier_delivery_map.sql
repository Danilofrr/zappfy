-- Map support for the courier delivery center.
-- Keeps geocoding cached on the delivery row so the same address is not
-- looked up every time the courier opens the map.

CREATE OR REPLACE FUNCTION public.list_my_delivery_load(_session text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
BEGIN
  c := public._resolve_courier_session(_session);

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'tracking_code', t.tracking_code,
        'courier_token', t.courier_token,
        'status', t.status,
        'scheduled_for', t.scheduled_for,
        'created_at', t.created_at,
        'assigned_at', t.assigned_at,
        'accepted_at', t.accepted_at,
        'started_at', t.started_at,
        'completed_at', t.completed_at,
        'failure_reason', t.failure_reason,
        'notes', t.completion_notes,
        'delivery_latitude', t.delivery_latitude,
        'delivery_longitude', t.delivery_longitude,
        'delivery_geocoded_address', t.delivery_geocoded_address,
        'delivery_geocoding_status', t.delivery_geocoding_status,
        'order', jsonb_build_object(
          'id', o.id,
          'customer', o.customer,
          'phone', o.phone,
          'address', o.address,
          'district', o.district,
          'city', o.city,
          'total', o.total,
          'payment', o.payment,
          'items', o.items,
          'notes', o.notes
        )
      )
      ORDER BY t.scheduled_for ASC, COALESCE(t.assigned_at, t.created_at) DESC
    )
    FROM public.delivery_tracking t
    JOIN public.orders o ON o.id = t.order_id
    WHERE t.courier_id = c.id
      AND t.store_id = c.store_id
      AND t.status <> 'cancelado'
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.courier_cache_delivery_geocode(
  _session text,
  _tracking_id uuid,
  _lat double precision,
  _lng double precision,
  _formatted_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
  t public.delivery_tracking;
BEGIN
  c := public._resolve_courier_session(_session);

  IF _lat IS NULL OR _lat < -90 OR _lat > 90 OR _lng IS NULL OR _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'Coordenadas inválidas';
  END IF;

  SELECT * INTO t
  FROM public.delivery_tracking
  WHERE id = _tracking_id
    AND courier_id = c.id
    AND store_id = c.store_id
  LIMIT 1;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Entrega não encontrada ou acesso negado';
  END IF;

  UPDATE public.delivery_tracking
  SET delivery_latitude = _lat,
      delivery_longitude = _lng,
      delivery_geocoded_address = NULLIF(btrim(COALESCE(_formatted_address, '')), ''),
      delivery_geocoding_status = 'ok',
      updated_at = now()
  WHERE id = t.id;

  RETURN jsonb_build_object(
    'ok', true,
    'tracking_id', t.id,
    'latitude', _lat,
    'longitude', _lng
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_my_delivery_load(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_cache_delivery_geocode(text, uuid, double precision, double precision, text) TO anon, authenticated;
