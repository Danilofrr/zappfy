
-- Pós-venda operacional: troca/devolução vinculada ao pedido original,
-- mas com uma nova missão de motoboy independente da entrega original.

ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS resolution_type text NOT NULL DEFAULT 'return',
  ADD COLUMN IF NOT EXISTS courier_status text NOT NULL DEFAULT 'not_assigned',
  ADD COLUMN IF NOT EXISTS courier_completed_at timestamptz;

UPDATE public.returns
SET resolution_type =
  CASE
    WHEN type <> 'cliente' THEN 'return'
    WHEN COALESCE(new_product_id::text, '') <> '' OR btrim(COALESCE(new_product_name, '')) <> '' THEN
      CASE
        WHEN new_product_id IS NOT NULL AND product_id IS NOT NULL AND new_product_id = product_id
          THEN 'exchange_same'
        WHEN lower(btrim(COALESCE(new_product_name,''))) <> ''
         AND lower(btrim(COALESCE(new_product_name,''))) = lower(btrim(COALESCE(product_name,'')))
          THEN 'exchange_same'
        ELSE 'exchange_other'
      END
    ELSE 'return'
  END
WHERE resolution_type = 'return';

ALTER TABLE public.returns
  DROP CONSTRAINT IF EXISTS returns_resolution_type_check;
ALTER TABLE public.returns
  ADD CONSTRAINT returns_resolution_type_check
  CHECK (resolution_type IN ('return','exchange_same','exchange_other'));

ALTER TABLE public.delivery_tracking
  ADD COLUMN IF NOT EXISTS operation_type text NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS return_id uuid REFERENCES public.returns(id) ON DELETE SET NULL;

ALTER TABLE public.delivery_tracking
  DROP CONSTRAINT IF EXISTS delivery_tracking_operation_type_check;
ALTER TABLE public.delivery_tracking
  ADD CONSTRAINT delivery_tracking_operation_type_check
  CHECK (operation_type IN ('delivery','exchange','return'));

CREATE UNIQUE INDEX IF NOT EXISTS delivery_tracking_return_id_unique
  ON public.delivery_tracking(return_id)
  WHERE return_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS returns_store_return_date_idx
  ON public.returns(store_id, return_date DESC);

CREATE INDEX IF NOT EXISTS returns_store_resolution_date_idx
  ON public.returns(store_id, resolution_type, return_date DESC);

CREATE INDEX IF NOT EXISTS delivery_tracking_store_operation_completed_idx
  ON public.delivery_tracking(store_id, operation_type, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- Funcionários com permissão de Trocas também podem trabalhar a aba.
DROP POLICY IF EXISTS "Team returns can manage returns" ON public.returns;
CREATE POLICY "Team returns can manage returns"
ON public.returns
FOR ALL
TO authenticated
USING (
  store_id IS NOT NULL
  AND public.team_has_permission(store_id, 'returns')
)
WITH CHECK (
  store_id IS NOT NULL
  AND public.team_has_permission(store_id, 'returns')
);


CREATE OR REPLACE FUNCTION public.assign_return_to_courier(
  _store_id uuid,
  _return_id uuid,
  _courier_id uuid,
  _scheduled_for date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.returns;
  o public.orders;
  c public.couriers;
  t public.delivery_tracking;
  delivery_date date := COALESCE(_scheduled_for, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  brazil_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  op_type text;
  was_transfer boolean := false;
BEGIN
  IF NOT public._can_manage_store(_store_id)
     AND NOT public.team_has_permission(_store_id, 'returns') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF delivery_date < brazil_today THEN
    RAISE EXCEPTION 'A data não pode ser anterior a hoje';
  END IF;

  SELECT * INTO r
  FROM public.returns
  WHERE id = _return_id
    AND store_id = _store_id
    AND type = 'cliente'
  FOR UPDATE;

  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Troca/devolução não encontrada';
  END IF;

  IF r.order_id IS NULL THEN
    RAISE EXCEPTION 'Vincule esta troca/devolução a um pedido antes de enviar ao motoboy';
  END IF;

  SELECT * INTO o
  FROM public.orders
  WHERE id = r.order_id
    AND store_id = _store_id
  LIMIT 1;

  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Pedido original não encontrado';
  END IF;

  SELECT * INTO c
  FROM public.couriers
  WHERE id = _courier_id
    AND store_id = _store_id
    AND active
  LIMIT 1;

  IF c.id IS NULL THEN
    RAISE EXCEPTION 'Motoboy ativo não encontrado';
  END IF;

  op_type := CASE
    WHEN r.resolution_type IN ('exchange_same','exchange_other') THEN 'exchange'
    ELSE 'return'
  END;

  SELECT * INTO t
  FROM public.delivery_tracking
  WHERE return_id = r.id
  LIMIT 1
  FOR UPDATE;

  IF t.id IS NULL THEN
    INSERT INTO public.delivery_tracking(
      order_id,
      store_id,
      tracking_code,
      courier_token,
      courier_id,
      courier_name,
      courier_phone,
      status,
      assigned_at,
      assigned_by,
      scheduled_for,
      operation_type,
      return_id,
      notes
    )
    VALUES(
      o.id,
      _store_id,
      upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12)),
      encode(gen_random_bytes(32), 'hex'),
      c.id,
      c.name,
      c.phone,
      'aguardando_motoboy',
      now(),
      auth.uid(),
      delivery_date,
      op_type,
      r.id,
      r.reason
    )
    RETURNING * INTO t;
  ELSE
    IF t.status IN ('entregue','devolvido','cancelado') THEN
      RAISE EXCEPTION 'Este atendimento de pós-venda já foi finalizado';
    END IF;

    was_transfer := t.courier_id IS DISTINCT FROM c.id;

    UPDATE public.delivery_tracking
    SET courier_id = c.id,
        courier_name = c.name,
        courier_phone = c.phone,
        status = 'aguardando_motoboy',
        assigned_at = now(),
        accepted_at = NULL,
        started_at = NULL,
        completed_at = NULL,
        returned_at = NULL,
        failure_reason = NULL,
        assigned_by = auth.uid(),
        scheduled_for = delivery_date,
        operation_type = op_type,
        notes = r.reason,
        courier_token = CASE
          WHEN t.courier_id IS DISTINCT FROM c.id
            THEN encode(gen_random_bytes(32), 'hex')
          ELSE courier_token
        END,
        updated_at = now()
    WHERE id = t.id
    RETURNING * INTO t;
  END IF;

  UPDATE public.returns
  SET courier_status = 'assigned',
      courier_completed_at = NULL,
      updated_at = now()
  WHERE id = r.id;

  INSERT INTO public.delivery_events(
    delivery_tracking_id,
    order_id,
    courier_id,
    store_id,
    event_type,
    old_status,
    new_status,
    metadata,
    created_by
  )
  VALUES(
    t.id,
    o.id,
    c.id,
    _store_id,
    CASE WHEN was_transfer THEN 'transferred' ELSE 'assigned' END,
    NULL,
    'aguardando_motoboy',
    jsonb_build_object(
      'operation_type', op_type,
      'return_id', r.id,
      'resolution_type', r.resolution_type,
      'product_name', r.product_name,
      'new_product_name', r.new_product_name,
      'scheduled_for', delivery_date
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'tracking_id', t.id,
    'courier_id', c.id,
    'courier_name', c.name,
    'operation_type', op_type,
    'scheduled_for', delivery_date
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.list_return_delivery_assignments(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._can_manage_store(_store_id)
     AND NOT public.team_has_permission(_store_id, 'returns') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'return_id', t.return_id,
        'tracking_id', t.id,
        'courier_id', t.courier_id,
        'courier_name', t.courier_name,
        'status', t.status,
        'scheduled_for', t.scheduled_for,
        'operation_type', t.operation_type,
        'completed_at', t.completed_at
      )
      ORDER BY COALESCE(t.assigned_at,t.created_at) DESC
    )
    FROM public.delivery_tracking t
    WHERE t.store_id = _store_id
      AND t.return_id IS NOT NULL
  ), '[]'::jsonb);
END;
$function$;


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
        'operation_type', COALESCE(t.operation_type,'delivery'),
        'return_id', t.return_id,
        'return_info', CASE
          WHEN r.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', r.id,
            'resolution_type', r.resolution_type,
            'product_id', r.product_id,
            'product_name', r.product_name,
            'new_product_id', r.new_product_id,
            'new_product_name', r.new_product_name,
            'quantity', r.quantity,
            'reason', r.reason,
            'notes', r.notes
          )
        END,
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
      ORDER BY
        CASE WHEN t.status IN ('saiu_para_entrega','chegando') THEN 0 ELSE 1 END,
        t.scheduled_for ASC,
        COALESCE(t.assigned_at, t.created_at) DESC
    )
    FROM public.delivery_tracking t
    JOIN public.orders o ON o.id = t.order_id
    LEFT JOIN public.returns r ON r.id = t.return_id
    WHERE t.courier_id = c.id
      AND t.store_id = c.store_id
      AND t.status <> 'cancelado'
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
        COALESCE(t.operation_type,'delivery') AS operation_type,
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
            AND operation_type = 'delivery'
        ), 0) AS possession_value,
        count(*) FILTER (
          WHERE status = 'entregue'
            AND operation_type = 'delivery'
            AND completed_at >= day_start
            AND completed_at < day_end
        ) AS delivered_orders,
        count(*) FILTER (
          WHERE status = 'entregue'
            AND operation_type = 'exchange'
            AND completed_at >= day_start
            AND completed_at < day_end
        ) AS exchanges_today,
        count(*) FILTER (
          WHERE status = 'entregue'
            AND operation_type = 'return'
            AND completed_at >= day_start
            AND completed_at < day_end
        ) AS returns_today,
        count(*) FILTER (
          WHERE status = 'entregue'
            AND completed_at >= day_start
            AND completed_at < day_end
        ) AS services_completed_today,
        COALESCE(sum(qty) FILTER (
          WHERE status = 'entregue'
            AND operation_type = 'delivery'
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
        'exchanges_today', COALESCE(a.exchanges_today, 0),
        'returns_today', COALESCE(a.returns_today, 0),
        'services_completed_today', COALESCE(a.services_completed_today, 0),
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
  r public.returns;
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
    signature_url IS NOT NULL AS has_signature,
    COALESCE(operation_type,'delivery') AS operation_type,
    return_id
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

  IF t.return_id IS NOT NULL THEN
    SELECT * INTO r FROM public.returns WHERE id = t.return_id LIMIT 1;
  END IF;

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
    'operation_type', t.operation_type,
    'return_id', t.return_id,
    'return_info', CASE
      WHEN r.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', r.id,
        'resolution_type', r.resolution_type,
        'product_name', r.product_name,
        'new_product_name', r.new_product_name,
        'quantity', r.quantity,
        'reason', r.reason,
        'notes', r.notes
      )
    END,
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
      'slug', COALESCE(st.slug,''),
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


CREATE OR REPLACE FUNCTION public.finalize_courier_delivery_v2(
  _token text,
  _payments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.delivery_tracking;
  o public.orders;
  r public.returns;
  item jsonb;
  method text;
  amount numeric(12,2);
  total_received numeric(12,2) := 0;
  normalized jsonb := '[]'::jsonb;
  is_after_sales boolean := false;
BEGIN
  SELECT * INTO t
  FROM public.delivery_tracking
  WHERE courier_token = _token
  LIMIT 1
  FOR UPDATE;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Entrega não encontrada';
  END IF;

  SELECT * INTO o
  FROM public.orders
  WHERE id = t.order_id
  LIMIT 1
  FOR UPDATE;

  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  is_after_sales := COALESCE(t.operation_type,'delivery') <> 'delivery';

  IF t.return_id IS NOT NULL THEN
    SELECT * INTO r FROM public.returns WHERE id=t.return_id LIMIT 1 FOR UPDATE;
  END IF;

  IF t.status IN ('cancelado','devolvido') THEN
    RAISE EXCEPTION 'Esta entrega já foi encerrada e não pode ser concluída';
  END IF;

  IF NOT is_after_sales THEN
    IF COALESCE(jsonb_typeof(_payments), 'null') <> 'array' THEN
      RAISE EXCEPTION 'Pagamento recebido inválido';
    END IF;

    FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(_payments, '[]'::jsonb))
    LOOP
      method := lower(btrim(COALESCE(item->>'method', '')));
      IF method = 'debito' THEN method := 'cartao'; END IF;

      IF method NOT IN ('pix', 'dinheiro', 'cartao') THEN
        RAISE EXCEPTION 'Forma de pagamento inválida: %', method;
      END IF;

      IF COALESCE(item->>'amount', '') !~ '^\d+(\.\d{1,2})?$' THEN
        RAISE EXCEPTION 'Valor inválido para %', method;
      END IF;

      amount := round((item->>'amount')::numeric, 2);
      IF amount <= 0 THEN
        RAISE EXCEPTION 'O valor de % deve ser maior que zero', method;
      END IF;

      total_received := total_received + amount;
      normalized := normalized || jsonb_build_array(
        jsonb_build_object('method', method, 'amount', amount)
      );
    END LOOP;

    total_received := round(total_received, 2);

    IF COALESCE(o.total, 0) = 0 AND total_received = 0 THEN
      normalized := '[]'::jsonb;
    ELSIF abs(total_received - COALESCE(o.total, 0)) > 0.01 THEN
      RAISE EXCEPTION 'A soma recebida (R$ %) deve ser igual ao total do pedido (R$ %)',
        to_char(total_received, 'FM999999990.00'),
        to_char(COALESCE(o.total, 0), 'FM999999990.00');
    END IF;
  ELSE
    normalized := '[]'::jsonb;
    total_received := 0;
  END IF;

  IF t.status = 'entregue' THEN
    IF NOT is_after_sales THEN
      UPDATE public.orders SET status='entregue' WHERE id=o.id AND status<>'entregue';
    ELSIF r.id IS NOT NULL THEN
      UPDATE public.returns
      SET courier_status='completed',
          courier_completed_at=COALESCE(courier_completed_at,t.completed_at,now()),
          updated_at=now()
      WHERE id=r.id;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'changed', false,
      'status', 'entregue',
      'tracking_id', t.id,
      'order_id', o.id,
      'operation_type', COALESCE(t.operation_type,'delivery'),
      'completed_at', t.completed_at
    );
  END IF;

  UPDATE public.delivery_tracking
  SET status='entregue',
      completed_at=COALESCE(completed_at,now()),
      received_payments=normalized,
      received_payment_total=total_received,
      received_payment_updated_at=CASE WHEN is_after_sales THEN received_payment_updated_at ELSE now() END,
      updated_at=now()
  WHERE id=t.id;

  IF NOT is_after_sales THEN
    UPDATE public.orders
    SET status='entregue'
    WHERE id=o.id;
  ELSIF r.id IS NOT NULL THEN
    UPDATE public.returns
    SET courier_status='completed',
        courier_completed_at=now(),
        updated_at=now()
    WHERE id=r.id;
  END IF;

  INSERT INTO public.delivery_events(
    delivery_tracking_id, order_id, courier_id, store_id,
    event_type, old_status, new_status, metadata
  )
  VALUES(
    t.id, o.id, t.courier_id, t.store_id,
    'delivered', t.status, 'entregue',
    jsonb_build_object(
      'received_payment_total', total_received,
      'atomic_finalize', true,
      'operation_type', COALESCE(t.operation_type,'delivery'),
      'return_id', t.return_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'changed', true,
    'status', 'entregue',
    'tracking_id', t.id,
    'order_id', o.id,
    'operation_type', COALESCE(t.operation_type,'delivery'),
    'completed_at', now()
  );
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
  is_after_sales boolean;
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

  is_after_sales := COALESCE(t.operation_type,'delivery') <> 'delivery';

  IF _action = 'reject' THEN
    IF t.accepted_at IS NOT NULL OR t.status NOT IN ('aguardando_motoboy','preparando') THEN
      RAISE EXCEPTION 'Esta entrega não pode mais ser recusada';
    END IF;

    IF NOT is_after_sales THEN
      PERFORM public.restore_courier_inventory_for_unassignment(c.store_id, c.id, t.order_id, t.id);
    END IF;

    INSERT INTO public.delivery_events(
      delivery_tracking_id, order_id, courier_id, store_id,
      event_type, old_status, new_status, metadata
    )
    VALUES(
      t.id, t.order_id, c.id, c.store_id,
      'delivery_failed', t.status, t.status,
      jsonb_strip_nulls(jsonb_build_object(
        'kind', 'assignment_rejected',
        'reason', COALESCE(NULLIF(btrim(_reason), ''), 'Recusada pelo motoboy'),
        'can_reassign', true,
        'operation_type', COALESCE(t.operation_type,'delivery'),
        'return_id', t.return_id,
        'courier_name', c.name,
        'customer', o.customer,
        'scheduled_for', t.scheduled_for
      ))
    );

    UPDATE public.delivery_tracking
    SET courier_id=NULL,
        courier_name=NULL,
        courier_phone=NULL,
        assigned_at=NULL,
        accepted_at=NULL,
        assigned_by=NULL,
        courier_token=replace(gen_random_uuid()::text,'-',''),
        updated_at=now()
    WHERE id=t.id;

    IF t.return_id IS NOT NULL THEN
      UPDATE public.returns
      SET courier_status='unassigned', updated_at=now()
      WHERE id=t.return_id;
    END IF;

    RETURN jsonb_build_object('changed',true,'rejected',true,'status',t.status,'can_reassign',true);
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

  IF ns IS NULL THEN RAISE EXCEPTION 'Ação inválida'; END IF;

  IF (_action='accept' AND t.accepted_at IS NOT NULL) OR t.status=ns THEN
    RETURN jsonb_build_object('changed',false,'status',t.status);
  END IF;

  IF t.status IN ('entregue','devolvido','cancelado') THEN
    RAISE EXCEPTION 'Entrega já finalizada';
  END IF;

  IF _action IN ('accept','start') THEN
    UPDATE public.couriers
    SET is_online=true, online_updated_at=now(), updated_at=now()
    WHERE id=c.id;
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
  SET status=ns,
      accepted_at=CASE WHEN _action='accept' THEN COALESCE(accepted_at,now()) ELSE accepted_at END,
      started_at=CASE WHEN _action='start' THEN COALESCE(started_at,now()) ELSE started_at END,
      completed_at=CASE WHEN _action='deliver' THEN COALESCE(completed_at,now()) ELSE completed_at END,
      returned_at=CASE WHEN _action='returned' THEN COALESCE(returned_at,now()) ELSE returned_at END,
      failure_reason=CASE WHEN _action='fail' THEN _reason ELSE failure_reason END,
      completion_notes=COALESCE(_notes,completion_notes),
      recipient_name=COALESCE(_recipient,recipient_name),
      completion_latitude=CASE WHEN _action='deliver' THEN _lat ELSE completion_latitude END,
      completion_longitude=CASE WHEN _action='deliver' THEN _lng ELSE completion_longitude END,
      updated_at=now()
  WHERE id=t.id;

  IF is_after_sales AND t.return_id IS NOT NULL THEN
    UPDATE public.returns
    SET courier_status=CASE
      WHEN _action='accept' THEN 'accepted'
      WHEN _action='start' THEN 'in_progress'
      WHEN _action='fail' THEN 'failed'
      WHEN _action='returned' THEN 'returned'
      WHEN _action='deliver' THEN 'completed'
      ELSE courier_status
    END,
    courier_completed_at=CASE WHEN _action='deliver' THEN COALESCE(courier_completed_at,now()) ELSE courier_completed_at END,
    updated_at=now()
    WHERE id=t.return_id;
  END IF;

  order_status := CASE
    WHEN is_after_sales THEN NULL
    WHEN _action='start' THEN 'entrega'
    WHEN _action='deliver' THEN 'entregue'
    WHEN _action='returned' THEN 'cancelado'
    ELSE NULL
  END;

  IF order_status IS NOT NULL THEN
    UPDATE public.orders
    SET status=order_status
    WHERE id=t.order_id AND store_id=c.store_id;
  END IF;

  INSERT INTO public.delivery_events(
    delivery_tracking_id, order_id, courier_id, store_id,
    event_type, old_status, new_status, metadata
  )
  VALUES(
    t.id,t.order_id,c.id,c.store_id,
    event,t.status,ns,
    jsonb_strip_nulls(jsonb_build_object(
      'reason',_reason,
      'notes',_notes,
      'recipient',_recipient,
      'operation_type',COALESCE(t.operation_type,'delivery'),
      'return_id',t.return_id,
      'scheduled_for',t.scheduled_for
    ))
  );

  RETURN jsonb_build_object('changed',true,'status',ns);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assign_return_to_courier(uuid,uuid,uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_return_delivery_assignments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_delivery_load(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_courier_loads(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_courier_view(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_courier_delivery_v2(text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_delivery_action(text,uuid,text,text,text,text,double precision,double precision) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
