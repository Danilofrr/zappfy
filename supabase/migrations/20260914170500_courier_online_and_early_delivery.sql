-- Permite que uma entrega agendada para uma data futura seja aceita e adiantada.
-- Também separa "acesso ativo" do cadastro do motoboy do status operacional
-- (online/offline) usado pela loja para saber quem está trabalhando agora.

ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS online_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS couriers_store_online_idx
  ON public.couriers(store_id, is_online);

CREATE OR REPLACE FUNCTION public.courier_set_online(
  _session text,
  _online boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
BEGIN
  c := public._resolve_courier_session(_session);

  UPDATE public.couriers
  SET is_online = COALESCE(_online, false),
      online_updated_at = now(),
      updated_at = now()
  WHERE id = c.id;

  RETURN jsonb_build_object(
    'changed', true,
    'courier_id', c.id,
    'is_online', COALESCE(_online, false),
    'online_updated_at', now()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.courier_me(_session text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE c public.couriers; st public.settings;
BEGIN
  c := public._resolve_courier_session(_session);
  SELECT * INTO st FROM public.settings WHERE store_id = c.store_id LIMIT 1;
  RETURN jsonb_build_object(
    'courier_id', c.id,
    'name', c.name,
    'phone', c.phone,
    'vehicle_type', c.vehicle_type,
    'plate', c.plate,
    'is_online', COALESCE(c.is_online, false),
    'online_updated_at', c.online_updated_at,
    'store_id', c.store_id,
    'store_name', COALESCE(st.store_name,'Loja'),
    'slug', st.slug
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.courier_logout(_session text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  courier_uuid uuid;
BEGIN
  SELECT courier_id INTO courier_uuid
  FROM public.courier_sessions
  WHERE token = _session
  LIMIT 1;

  IF courier_uuid IS NOT NULL THEN
    UPDATE public.couriers
    SET is_online = false,
        online_updated_at = now(),
        updated_at = now()
    WHERE id = courier_uuid;
  END IF;

  DELETE FROM public.courier_sessions WHERE token = _session;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_couriers_for_store(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id,
      'store_id', c.store_id,
      'name', c.name,
      'phone', c.phone,
      'vehicle_type', c.vehicle_type,
      'plate', c.plate,
      'active', c.active,
      'is_online', COALESCE(c.is_online, false),
      'online_updated_at', c.online_updated_at,
      'last_login_at', c.last_login_at,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    ) ORDER BY c.created_at DESC)
    FROM public.couriers c
    WHERE c.store_id = _store_id
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_courier_loads(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'courier_id', c.id,
      'name', c.name,
      'active', c.active,
      'is_online', COALESCE(c.is_online, false),
      'online_updated_at', c.online_updated_at,
      'in_route', COALESCE(a.in_route, false),
      'orders_in_possession', COALESCE(a.possession_orders, 0),
      'products_in_possession', COALESCE(a.possession_products, 0),
      'value_in_possession', COALESCE(a.possession_value, 0),
      'delivered_today', COALESCE(a.delivered_orders, 0),
      'products_delivered_today', COALESCE(a.delivered_products, 0),
      'failed', COALESCE(a.failed, 0),
      'returned', COALESCE(a.returned, 0)
    ))
    FROM public.couriers c
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE t.status NOT IN ('entregue','devolvido','cancelado')) AS possession_orders,
        COALESCE(sum(qty) FILTER (WHERE t.status NOT IN ('entregue','devolvido','cancelado')), 0) AS possession_products,
        COALESCE(sum(o.total) FILTER (WHERE t.status NOT IN ('entregue','devolvido','cancelado')), 0) AS possession_value,
        count(*) FILTER (WHERE t.status='entregue' AND (t.completed_at AT TIME ZONE 'America/Sao_Paulo')::date=(now() AT TIME ZONE 'America/Sao_Paulo')::date) AS delivered_orders,
        COALESCE(sum(qty) FILTER (WHERE t.status='entregue' AND (t.completed_at AT TIME ZONE 'America/Sao_Paulo')::date=(now() AT TIME ZONE 'America/Sao_Paulo')::date), 0) AS delivered_products,
        count(*) FILTER (WHERE t.status='nao_entregue') AS failed,
        count(*) FILTER (WHERE t.status='devolvido' AND (t.returned_at AT TIME ZONE 'America/Sao_Paulo')::date=(now() AT TIME ZONE 'America/Sao_Paulo')::date) AS returned,
        bool_or(t.status IN ('saiu_para_entrega','chegando')) AS in_route
      FROM public.delivery_tracking t
      JOIN public.orders o ON o.id=t.order_id
      CROSS JOIN LATERAL (
        SELECT COALESCE(sum(COALESCE((i->>'qty')::numeric,0)),0) qty
        FROM jsonb_array_elements(o.items::jsonb) i
      ) items
      WHERE t.courier_id=c.id
    ) a ON true
    WHERE c.store_id=_store_id
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.courier_delivery_action(
  _session text,
  _tracking_id uuid,
  _action text,
  _reason text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _recipient text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
  t public.delivery_tracking;
  o public.orders;
  ns text;
  event text;
  order_status text;
BEGIN
  c := public._resolve_courier_session(_session);

  SELECT * INTO t
  FROM public.delivery_tracking
  WHERE id = _tracking_id
    AND courier_id = c.id
    AND store_id = c.store_id
  FOR UPDATE;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Entrega não encontrada ou acesso negado';
  END IF;

  SELECT * INTO o
  FROM public.orders
  WHERE id = t.order_id
    AND store_id = c.store_id
  LIMIT 1;

  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF _action = 'reject' THEN
    IF t.accepted_at IS NOT NULL OR t.status NOT IN ('aguardando_motoboy','preparando') THEN
      RAISE EXCEPTION 'Esta entrega não pode mais ser recusada';
    END IF;

    PERFORM public.restore_courier_inventory_for_unassignment(c.store_id, c.id, t.order_id, t.id);

    INSERT INTO public.delivery_events(
      delivery_tracking_id, order_id, courier_id, store_id,
      event_type, old_status, new_status, metadata
    )
    VALUES(
      t.id, t.order_id, c.id, c.store_id,
      'delivery_failed', t.status::text, t.status::text,
      jsonb_strip_nulls(jsonb_build_object(
        'kind', 'assignment_rejected',
        'reason', COALESCE(NULLIF(btrim(_reason), ''), 'Recusada pelo motoboy'),
        'can_reassign', true,
        'courier_name', c.name,
        'courier_phone', c.phone,
        'customer', o.customer,
        'phone', o.phone,
        'address', o.address,
        'district', o.district,
        'city', o.city,
        'order_total', o.total,
        'payment', o.payment,
        'items', to_jsonb(o.items),
        'scheduled_for', t.scheduled_for
      ))
    );

    UPDATE public.delivery_tracking
    SET courier_id = NULL,
        courier_name = NULL,
        courier_phone = NULL,
        assigned_at = NULL,
        accepted_at = NULL,
        assigned_by = NULL,
        courier_token = replace(gen_random_uuid()::text, '-', ''),
        updated_at = now()
    WHERE id = t.id;

    RETURN jsonb_build_object(
      'changed', true,
      'rejected', true,
      'status', t.status,
      'can_reassign', true
    );
  END IF;

  ns := CASE _action
    WHEN 'accept' THEN 'aguardando_motoboy'
    WHEN 'start' THEN 'saiu_para_entrega'
    WHEN 'deliver' THEN 'entregue'
    WHEN 'fail' THEN 'nao_entregue'
    WHEN 'return' THEN 'retornando'
    WHEN 'returned' THEN 'devolvido'
    ELSE NULL
  END;

  IF ns IS NULL THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  IF (_action = 'accept' AND t.accepted_at IS NOT NULL) OR t.status = ns THEN
    RETURN jsonb_build_object('changed', false, 'status', t.status);
  END IF;

  IF t.status IN ('entregue','devolvido','cancelado') THEN
    RAISE EXCEPTION 'Entrega já finalizada';
  END IF;

  IF _action IN ('accept','start') THEN
    UPDATE public.couriers
    SET is_online = true,
        online_updated_at = now(),
        updated_at = now()
    WHERE id = c.id;
  END IF;

  event := CASE _action
    WHEN 'accept' THEN 'accepted'
    WHEN 'start' THEN 'started'
    WHEN 'deliver' THEN 'delivered'
    WHEN 'fail' THEN 'delivery_failed'
    WHEN 'return' THEN 'return_started'
    ELSE 'returned'
  END;

  UPDATE public.delivery_tracking
  SET status = ns,
      accepted_at = CASE WHEN _action = 'accept' THEN COALESCE(accepted_at, now()) ELSE accepted_at END,
      started_at = CASE WHEN _action = 'start' THEN COALESCE(started_at, now()) ELSE started_at END,
      completed_at = CASE WHEN _action = 'deliver' THEN COALESCE(completed_at, now()) ELSE completed_at END,
      returned_at = CASE WHEN _action = 'returned' THEN COALESCE(returned_at, now()) ELSE returned_at END,
      failure_reason = CASE WHEN _action = 'fail' THEN _reason ELSE failure_reason END,
      completion_notes = COALESCE(_notes, completion_notes),
      recipient_name = COALESCE(_recipient, recipient_name),
      completion_latitude = CASE WHEN _action = 'deliver' THEN _lat ELSE completion_latitude END,
      completion_longitude = CASE WHEN _action = 'deliver' THEN _lng ELSE completion_longitude END
  WHERE id = t.id;

  order_status := CASE _action
    WHEN 'start' THEN 'entrega'
    WHEN 'deliver' THEN 'entregue'
    WHEN 'returned' THEN 'cancelado'
    ELSE NULL
  END;

  IF order_status IS NOT NULL THEN
    UPDATE public.orders
    SET status = order_status
    WHERE id = t.order_id
      AND store_id = c.store_id;
  END IF;

  INSERT INTO public.delivery_events(
    delivery_tracking_id, order_id, courier_id, store_id,
    event_type, old_status, new_status, metadata
  )
  VALUES(
    t.id, t.order_id, c.id, c.store_id,
    event, t.status::text, ns::text,
    jsonb_strip_nulls(jsonb_build_object(
      'reason', _reason,
      'notes', _notes,
      'recipient', _recipient,
      'kind', CASE WHEN _action = 'fail' THEN 'delivery_failed' ELSE NULL END,
      'customer', CASE WHEN _action = 'fail' THEN o.customer ELSE NULL END,
      'phone', CASE WHEN _action = 'fail' THEN o.phone ELSE NULL END,
      'address', CASE WHEN _action = 'fail' THEN o.address ELSE NULL END,
      'district', CASE WHEN _action = 'fail' THEN o.district ELSE NULL END,
      'city', CASE WHEN _action = 'fail' THEN o.city ELSE NULL END,
      'order_total', CASE WHEN _action = 'fail' THEN o.total ELSE NULL END,
      'payment', CASE WHEN _action = 'fail' THEN o.payment ELSE NULL END,
      'items', CASE WHEN _action = 'fail' THEN to_jsonb(o.items) ELSE NULL END,
      'scheduled_for', t.scheduled_for
    ))
  );

  RETURN jsonb_build_object('changed', true, 'status', ns);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.courier_set_online(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_me(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_logout(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_delivery_action(text,uuid,text,text,text,text,double precision,double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_couriers_for_store(uuid), public.get_courier_loads(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
