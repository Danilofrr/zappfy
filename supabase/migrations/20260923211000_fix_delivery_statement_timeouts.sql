-- Otimizações de performance para Motoboys/Central de Entregas.
-- Evita histórico completo com comprovantes Base64 em atualizações automáticas,
-- reduz scans repetidos e limita concorrência das atualizações de GPS.

CREATE INDEX IF NOT EXISTS delivery_tracking_store_courier_completed_idx
  ON public.delivery_tracking (store_id, courier_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS delivery_tracking_store_courier_created_idx
  ON public.delivery_tracking (store_id, courier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS courier_sessions_courier_expires_idx
  ON public.courier_sessions (courier_id, expires_at DESC);

CREATE OR REPLACE FUNCTION public.get_courier_loads(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  day_start timestamptz :=
    (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo');
  day_end timestamptz :=
    ((date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day') AT TIME ZONE 'America/Sao_Paulo');
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN COALESCE((
    WITH tracking_base AS (
      SELECT
        t.courier_id,
        t.status,
        t.completed_at,
        t.returned_at,
        o.total,
        COALESCE((
          SELECT sum(COALESCE((item->>'qty')::numeric, 0))
          FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) item
        ), 0) AS qty
      FROM public.delivery_tracking t
      JOIN public.orders o ON o.id = t.order_id
      WHERE t.store_id = _store_id
        AND t.courier_id IS NOT NULL
    ),
    agg AS (
      SELECT
        courier_id,
        count(*) FILTER (
          WHERE status NOT IN ('entregue','devolvido','cancelado')
        ) AS possession_orders,
        COALESCE(sum(qty) FILTER (
          WHERE status NOT IN ('entregue','devolvido','cancelado')
        ), 0) AS possession_products,
        COALESCE(sum(total) FILTER (
          WHERE status NOT IN ('entregue','devolvido','cancelado')
        ), 0) AS possession_value,
        count(*) FILTER (
          WHERE status = 'entregue'
            AND completed_at >= day_start
            AND completed_at < day_end
        ) AS delivered_orders,
        COALESCE(sum(qty) FILTER (
          WHERE status = 'entregue'
            AND completed_at >= day_start
            AND completed_at < day_end
        ), 0) AS delivered_products,
        count(*) FILTER (WHERE status = 'nao_entregue') AS failed,
        count(*) FILTER (
          WHERE status = 'devolvido'
            AND returned_at >= day_start
            AND returned_at < day_end
        ) AS returned,
        bool_or(status IN ('saiu_para_entrega','chegando')) AS in_route
      FROM tracking_base
      GROUP BY courier_id
    )
    SELECT jsonb_agg(
      jsonb_build_object(
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
      )
      ORDER BY c.name
    )
    FROM public.couriers c
    LEFT JOIN agg a ON a.courier_id = c.id
    WHERE c.store_id = _store_id
  ), '[]'::jsonb);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_courier_history_period(
  _store_id uuid,
  _start timestamptz,
  _end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  can_finance boolean := public.team_has_permission(_store_id, 'finance');
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF _start IS NULL OR _end IS NULL OR _end <= _start THEN
    RAISE EXCEPTION 'Período inválido';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'courier_id', c.id,
        'orders', COALESCE(delivered.orders, '[]'::jsonb),
        'events', COALESCE(events.events, '[]'::jsonb)
      )
      ORDER BY c.name
    )
    FROM public.couriers c
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(row_data ORDER BY completed_at DESC) AS orders
      FROM (
        SELECT
          t.completed_at,
          jsonb_build_object(
            'id', t.id,
            'order_id', t.order_id,
            'status', t.status,
            'assigned_at', t.assigned_at,
            'accepted_at', t.accepted_at,
            'started_at', t.started_at,
            'completed_at', t.completed_at,
            'failure_reason', t.failure_reason,
            'notes', t.completion_notes,
            'received_payments', t.received_payments,
            'received_payment_total', t.received_payment_total,
            'order', jsonb_build_object(
              'id', o.id,
              'customer', o.customer,
              'phone', o.phone,
              'address', o.address,
              'district', o.district,
              'city', o.city,
              'total', o.total,
              'payment', o.payment,
              'notes', o.notes,
              'date', o.date,
              'items', COALESCE((
                SELECT jsonb_agg(
                  (item - 'cost') || jsonb_build_object(
                    'cost',
                    CASE
                      WHEN can_finance
                        AND COALESCE(item->>'cost','') ~ '^-?[0-9]+([.][0-9]+)?$'
                        THEN (item->>'cost')::numeric
                      ELSE 0
                    END
                  )
                )
                FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) item
              ), '[]'::jsonb)
            )
          ) AS row_data
        FROM public.delivery_tracking t
        JOIN public.orders o ON o.id = t.order_id
        WHERE t.store_id = _store_id
          AND t.courier_id = c.id
          AND t.status = 'entregue'
          AND t.completed_at >= _start
          AND t.completed_at < _end
        ORDER BY t.completed_at DESC
        LIMIT 300
      ) delivered_rows
    ) delivered ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(event_data ORDER BY created_at DESC) AS events
      FROM (
        SELECT
          ev.created_at,
          jsonb_build_object(
            'id', ev.id,
            'delivery_tracking_id', ev.delivery_tracking_id,
            'order_id', ev.order_id,
            'courier_id', ev.courier_id,
            'store_id', ev.store_id,
            'event_type', ev.event_type,
            'old_status', ev.old_status,
            'new_status', ev.new_status,
            'metadata', ev.metadata,
            'created_at', ev.created_at
          ) AS event_data
        FROM public.delivery_events ev
        LEFT JOIN public.delivery_tracking current_tracking
          ON current_tracking.id = ev.delivery_tracking_id
        WHERE ev.store_id = _store_id
          AND ev.courier_id = c.id
          AND ev.created_at >= _start
          AND ev.created_at < _end
          AND (
            ev.event_type <> 'delivery_failed'
            OR current_tracking.courier_id IS NULL
            OR current_tracking.courier_id = c.id
          )
        ORDER BY ev.created_at DESC
        LIMIT 300
      ) event_rows
    ) events ON true
    WHERE c.store_id = _store_id
  ), '[]'::jsonb);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_courier_load_detail(_store_id uuid, _courier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  can_finance boolean := public.team_has_permission(_store_id, 'finance');
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN jsonb_build_object(
    'orders', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'order_id', t.order_id,
          'status', t.status,
          'assigned_at', t.assigned_at,
          'accepted_at', t.accepted_at,
          'started_at', t.started_at,
          'completed_at', t.completed_at,
          'failure_reason', t.failure_reason,
          'notes', t.completion_notes,
          'order', jsonb_build_object(
            'id', o.id,
            'customer', o.customer,
            'phone', o.phone,
            'address', o.address,
            'district', o.district,
            'city', o.city,
            'total', o.total,
            'payment', o.payment,
            'notes', o.notes,
            'date', o.date,
            'items', COALESCE((
              SELECT jsonb_agg(
                (item - 'cost') || jsonb_build_object(
                  'cost',
                  CASE
                    WHEN can_finance
                      AND COALESCE(item->>'cost','') ~ '^-?[0-9]+([.][0-9]+)?$'
                      THEN (item->>'cost')::numeric
                    ELSE 0
                  END
                )
              )
              FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) item
            ), '[]'::jsonb)
          )
        )
        ORDER BY COALESCE(t.assigned_at, t.created_at) DESC
      )
      FROM public.delivery_tracking t
      JOIN public.orders o ON o.id = t.order_id
      WHERE t.store_id = _store_id
        AND t.courier_id = _courier_id
        AND t.status NOT IN ('entregue','devolvido','cancelado')
    ), '[]'::jsonb),

    'products', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('name', p.name, 'quantity', p.qty)
        ORDER BY p.name
      )
      FROM (
        SELECT
          item->>'name' AS name,
          sum(COALESCE((item->>'qty')::numeric, 0)) AS qty
        FROM public.delivery_tracking t
        JOIN public.orders o ON o.id = t.order_id
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) item
        WHERE t.store_id = _store_id
          AND t.courier_id = _courier_id
          AND t.status NOT IN ('entregue','devolvido','cancelado')
        GROUP BY item->>'name'
      ) p
    ), '[]'::jsonb),

    'events', '[]'::jsonb
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_courier_location(
  _token text,
  _lat double precision,
  _lng double precision,
  _speed double precision DEFAULT NULL,
  _heading double precision DEFAULT NULL,
  _accuracy double precision DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  delivery_status text;
  last_seen timestamptz;
  delivery_id uuid;
BEGIN
  SELECT id, status, last_updated_at
  INTO delivery_id, delivery_status, last_seen
  FROM public.delivery_tracking
  WHERE courier_token = _token
  LIMIT 1;

  IF delivery_id IS NULL THEN
    RAISE EXCEPTION 'Rastreamento não encontrado';
  END IF;

  IF delivery_status IN ('entregue','cancelado','devolvido','nao_entregue') THEN
    RETURN false;
  END IF;

  -- watchPosition pode disparar várias vezes por segundo.
  -- Uma gravação a cada 5 segundos é suficiente para o mapa em tempo real.
  IF last_seen IS NOT NULL AND last_seen > now() - interval '5 seconds' THEN
    RETURN true;
  END IF;

  UPDATE public.delivery_tracking
  SET
    latitude = _lat,
    longitude = _lng,
    speed = _speed,
    heading = _heading,
    accuracy = _accuracy,
    last_updated_at = now()
  WHERE id = delivery_id;

  RETURN true;
END;
$function$;


CREATE OR REPLACE FUNCTION public.save_courier_delivery_evidence(
  _token text,
  _proof_url text DEFAULT NULL,
  _signature_url text DEFAULT NULL,
  _clear_proof boolean DEFAULT false,
  _clear_signature boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  delivery_id uuid;
  delivery_status text;
  had_proof boolean := false;
  had_signature boolean := false;
  proof text := NULLIF(btrim(COALESCE(_proof_url, '')), '');
  signature text := NULLIF(btrim(COALESCE(_signature_url, '')), '');
BEGIN
  SELECT
    id,
    status,
    proof_url IS NOT NULL,
    signature_url IS NOT NULL
  INTO
    delivery_id,
    delivery_status,
    had_proof,
    had_signature
  FROM public.delivery_tracking
  WHERE courier_token = _token
  LIMIT 1
  FOR UPDATE;

  IF delivery_id IS NULL THEN
    RAISE EXCEPTION 'Rastreamento não encontrado';
  END IF;

  IF delivery_status IN ('cancelado','devolvido') THEN
    RAISE EXCEPTION 'Entrega já encerrada';
  END IF;

  IF proof IS NOT NULL THEN
    IF proof !~ '^data:image/(png|jpeg|jpg|webp);base64,' THEN
      RAISE EXCEPTION 'Comprovante deve ser uma imagem PNG, JPG ou WEBP';
    END IF;
    IF length(proof) > 4500000 THEN
      RAISE EXCEPTION 'Comprovante muito grande';
    END IF;
  END IF;

  IF signature IS NOT NULL THEN
    IF signature !~ '^data:image/png;base64,' THEN
      RAISE EXCEPTION 'Assinatura inválida';
    END IF;
    IF length(signature) > 1000000 THEN
      RAISE EXCEPTION 'Assinatura muito grande';
    END IF;
  END IF;

  UPDATE public.delivery_tracking
  SET
    proof_url = CASE
      WHEN _clear_proof THEN NULL
      WHEN proof IS NOT NULL THEN proof
      ELSE proof_url
    END,
    signature_url = CASE
      WHEN _clear_signature THEN NULL
      WHEN signature IS NOT NULL THEN signature
      ELSE signature_url
    END,
    updated_at = now()
  WHERE id = delivery_id;

  RETURN jsonb_build_object(
    'saved', true,
    'proof_saved', CASE
      WHEN _clear_proof THEN false
      WHEN proof IS NOT NULL THEN true
      ELSE had_proof
    END,
    'signature_saved', CASE
      WHEN _clear_signature THEN false
      WHEN signature IS NOT NULL THEN true
      ELSE had_signature
    END
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.finalize_courier_delivery(
  _token text,
  _proof_url text DEFAULT NULL,
  _signature_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  delivery_id uuid;
  order_id_value uuid;
  courier_id_value uuid;
  store_id_value uuid;
  old_status text;
  proof text := NULLIF(btrim(COALESCE(_proof_url, '')), '');
  signature text := NULLIF(btrim(COALESCE(_signature_url, '')), '');
BEGIN
  SELECT id, order_id, courier_id, store_id, status
  INTO delivery_id, order_id_value, courier_id_value, store_id_value, old_status
  FROM public.delivery_tracking
  WHERE courier_token = _token
  LIMIT 1
  FOR UPDATE;

  IF delivery_id IS NULL THEN
    RAISE EXCEPTION 'Rastreamento não encontrado';
  END IF;

  IF proof IS NOT NULL THEN
    IF proof !~ '^data:image/(png|jpeg|jpg|webp);base64,' THEN
      RAISE EXCEPTION 'Comprovante deve ser uma imagem PNG, JPG ou WEBP';
    END IF;
    IF length(proof) > 4500000 THEN
      RAISE EXCEPTION 'Comprovante muito grande';
    END IF;
  END IF;

  IF signature IS NOT NULL THEN
    IF signature !~ '^data:image/png;base64,' THEN
      RAISE EXCEPTION 'Assinatura inválida';
    END IF;
    IF length(signature) > 1000000 THEN
      RAISE EXCEPTION 'Assinatura muito grande';
    END IF;
  END IF;

  IF old_status IN ('cancelado','devolvido') THEN
    RAISE EXCEPTION 'Entrega já finalizada';
  END IF;

  IF old_status = 'entregue' THEN
    IF proof IS NOT NULL OR signature IS NOT NULL THEN
      UPDATE public.delivery_tracking
      SET
        proof_url = COALESCE(proof, proof_url),
        signature_url = COALESCE(signature, signature_url),
        updated_at = now()
      WHERE id = delivery_id;
    END IF;
    RETURN jsonb_build_object('changed', false, 'status', 'entregue');
  END IF;

  UPDATE public.delivery_tracking
  SET
    status = 'entregue',
    completed_at = COALESCE(completed_at, now()),
    proof_url = COALESCE(proof, proof_url),
    signature_url = COALESCE(signature, signature_url),
    updated_at = now()
  WHERE id = delivery_id;

  UPDATE public.orders
  SET status = 'entregue'
  WHERE id = order_id_value;

  INSERT INTO public.delivery_events(
    delivery_tracking_id,
    order_id,
    courier_id,
    store_id,
    event_type,
    old_status,
    new_status,
    metadata
  )
  VALUES(
    delivery_id,
    order_id_value,
    courier_id_value,
    store_id_value,
    'delivered',
    old_status,
    'entregue',
    jsonb_strip_nulls(jsonb_build_object(
      'payment_proof', CASE WHEN proof IS NOT NULL THEN true ELSE NULL END,
      'signature', CASE WHEN signature IS NOT NULL THEN true ELSE NULL END
    ))
  );

  RETURN jsonb_build_object('changed', true, 'status', 'entregue');
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_courier_view(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t record;
  s public.delivery_tracking_settings;
  st public.settings;
  o public.orders;
  inherit boolean;
BEGIN
  SELECT
    id,
    order_id,
    store_id,
    tracking_code,
    status,
    courier_name,
    courier_phone,
    notes,
    started_at,
    completed_at,
    received_payments,
    received_payment_total,
    received_payment_updated_at,
    proof_url IS NOT NULL AS has_proof,
    signature_url IS NOT NULL AS has_signature
  INTO t
  FROM public.delivery_tracking
  WHERE courier_token = _token
  LIMIT 1;

  IF t.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO s
  FROM public.delivery_tracking_settings
  WHERE store_id = t.store_id
  LIMIT 1;

  SELECT * INTO st
  FROM public.settings
  WHERE store_id = t.store_id
  LIMIT 1;

  SELECT * INTO o
  FROM public.orders
  WHERE id = t.order_id
  LIMIT 1;

  inherit := COALESCE(s.courier_inherit_client, true);

  RETURN jsonb_build_object(
    'id', t.id,
    'tracking_code', t.tracking_code,
    'status', t.status,
    'courier_name', t.courier_name,
    'courier_phone', t.courier_phone,
    'notes', t.notes,
    'started_at', t.started_at,
    'completed_at', t.completed_at,
    'proof_url', CASE
      WHEN t.has_proof THEN '/api/public/delivery-evidence/' || _token || '/proof'
      ELSE NULL
    END,
    'signature_url', CASE
      WHEN t.has_signature THEN '/api/public/delivery-evidence/' || _token || '/signature'
      ELSE NULL
    END,
    'received_payments', t.received_payments,
    'received_payment_total', t.received_payment_total,
    'received_payment_updated_at', t.received_payment_updated_at,
    'order', jsonb_build_object(
      'id', o.id,
      'customer', o.customer,
      'phone', o.phone,
      'address', o.address,
      'district', o.district,
      'city', o.city,
      'total', o.total,
      'notes', o.notes,
      'date', o.date,
      'payment', o.payment,
      'items', o.items
    ),
    'store', jsonb_build_object(
      'name', COALESCE(st.store_name,'Loja'),
      'whatsapp', COALESCE(st.whatsapp,''),
      'logo_url', CASE
        WHEN inherit AND COALESCE(st.slug, '') <> ''
          THEN '/api/public/store-asset/' || st.slug || '/logo'
        WHEN inherit
          THEN COALESCE(s.logo_url, st.checkout_logo_url)
        ELSE COALESCE(s.courier_logo_url, s.logo_url, st.checkout_logo_url)
      END
    ),
    'settings', jsonb_build_object(
      'inherit_client', inherit,
      'primary_color', CASE WHEN inherit THEN COALESCE(s.primary_color,'#10b981') ELSE COALESCE(s.courier_primary_color,s.primary_color,'#10b981') END,
      'secondary_color', CASE WHEN inherit THEN COALESCE(s.secondary_color,'#0b1220') ELSE COALESCE(s.courier_secondary_color,s.secondary_color,'#0b1220') END,
      'header_style', CASE WHEN inherit THEN COALESCE(s.header_style,'solid') ELSE COALESCE(s.courier_header_style,s.header_style,'solid') END,
      'header_color', CASE WHEN inherit THEN COALESCE(s.header_color,s.primary_color,'#10b981') ELSE COALESCE(s.courier_header_color,s.header_color,s.primary_color,'#10b981') END,
      'header_height', CASE WHEN inherit THEN COALESCE(s.header_height,110) ELSE COALESCE(s.courier_header_height,s.header_height,110) END,
      'header_logo_size', CASE WHEN inherit THEN COALESCE(s.header_logo_size,56) ELSE COALESCE(s.courier_header_logo_size,s.header_logo_size,56) END,
      'header_logo_align', CASE WHEN inherit THEN COALESCE(s.header_logo_align,'center') ELSE COALESCE(s.courier_header_logo_align,s.header_logo_align,'center') END,
      'background_color', CASE WHEN inherit THEN COALESCE(s.background_color,'#0b1220') ELSE COALESCE(s.courier_background_color,s.background_color,'#0b1220') END,
      'card_color', CASE WHEN inherit THEN COALESCE(s.card_color,'#0f172a') ELSE COALESCE(s.courier_card_color,s.card_color,'#0f172a') END,
      'card_border_color', CASE WHEN inherit THEN COALESCE(s.card_border_color,'#1e293b') ELSE COALESCE(s.courier_card_border_color,s.card_border_color,'#1e293b') END,
      'card_shadow_color', CASE WHEN inherit THEN COALESCE(s.card_shadow_color,'#000000') ELSE COALESCE(s.courier_card_shadow_color,s.card_shadow_color,'#000000') END,
      'text_color', CASE WHEN inherit THEN COALESCE(s.text_color,'#ffffff') ELSE COALESCE(s.courier_text_color,s.text_color,'#ffffff') END,
      'title_color', CASE WHEN inherit THEN COALESCE(s.title_color,s.text_color,'#ffffff') ELSE COALESCE(s.courier_title_color,s.title_color,'#ffffff') END,
      'button_color', CASE WHEN inherit THEN COALESCE(s.button_color,'#10b981') ELSE COALESCE(s.courier_button_color,s.button_color,'#10b981') END,
      'icon_color', CASE WHEN inherit THEN COALESCE(s.primary_color,'#10b981') ELSE COALESCE(s.courier_icon_color,s.primary_color,'#10b981') END,
      'footer_text', COALESCE(s.courier_footer_text,'Powered by Zappfy')
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_courier_history_period(uuid,timestamptz,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_courier_loads(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_courier_load_detail(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_courier_location(text,double precision,double precision,double precision,double precision,double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_courier_delivery_evidence(text,text,text,boolean,boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_courier_delivery(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_courier_view(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
