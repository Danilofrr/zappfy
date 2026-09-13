-- Permite atribuir pedidos a um motoboy para uma data futura sem confundir
-- a data em que a atribuicao foi criada (assigned_at) com o dia planejado da entrega.

ALTER TABLE public.delivery_tracking
  ADD COLUMN IF NOT EXISTS scheduled_for date;

UPDATE public.delivery_tracking
SET scheduled_for = COALESCE(
  (assigned_at AT TIME ZONE 'America/Sao_Paulo')::date,
  (created_at AT TIME ZONE 'America/Sao_Paulo')::date,
  (now() AT TIME ZONE 'America/Sao_Paulo')::date
)
WHERE scheduled_for IS NULL;

ALTER TABLE public.delivery_tracking
  ALTER COLUMN scheduled_for SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  ALTER COLUMN scheduled_for SET NOT NULL;

CREATE INDEX IF NOT EXISTS delivery_tracking_schedule_idx
  ON public.delivery_tracking(store_id, courier_id, scheduled_for, status);

CREATE OR REPLACE FUNCTION public.assign_orders_to_courier_scheduled(
  _store_id uuid,
  _order_ids uuid[],
  _courier_id uuid,
  _scheduled_for date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  o public.orders;
  c public.couriers;
  t public.delivery_tracking;
  previous uuid;
  delivery_date date := COALESCE(_scheduled_for, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  brazil_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  assigned int := 0;
  transferred int := 0;
  rescheduled int := 0;
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF delivery_date < brazil_today THEN
    RAISE EXCEPTION 'A data da entrega não pode ser anterior a hoje';
  END IF;

  SELECT * INTO c
  FROM public.couriers
  WHERE id = _courier_id
    AND store_id = _store_id
    AND active;

  IF c.id IS NULL THEN
    RAISE EXCEPTION 'Motoboy ativo não encontrado';
  END IF;

  FOR o IN
    SELECT * FROM public.orders
    WHERE id = ANY(_order_ids)
      AND store_id = _store_id
  LOOP
    SELECT * INTO t
    FROM public.delivery_tracking
    WHERE order_id = o.id
      AND store_id = _store_id
    ORDER BY created_at DESC
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
        scheduled_for
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
        delivery_date
      )
      RETURNING * INTO t;

      INSERT INTO public.delivery_events(
        delivery_tracking_id,
        order_id,
        courier_id,
        store_id,
        event_type,
        new_status,
        metadata,
        created_by
      )
      VALUES(
        t.id,
        o.id,
        c.id,
        _store_id,
        'assigned',
        'aguardando_motoboy',
        jsonb_build_object('scheduled_for', delivery_date),
        auth.uid()
      );

      PERFORM public.reserve_courier_inventory_for_order(_store_id, c.id, o.id, t.id);
      assigned := assigned + 1;

    ELSIF t.courier_id IS DISTINCT FROM c.id THEN
      previous := t.courier_id;

      IF previous IS NOT NULL THEN
        PERFORM public.restore_courier_inventory_for_unassignment(_store_id, previous, o.id, t.id);
      END IF;

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
          scheduled_for = delivery_date
      WHERE id = t.id;

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
        'transferred',
        t.status::text,
        'aguardando_motoboy',
        jsonb_build_object(
          'from_courier_id', previous,
          'to_courier_id', c.id,
          'scheduled_for', delivery_date
        ),
        auth.uid()
      );

      PERFORM public.reserve_courier_inventory_for_order(_store_id, c.id, o.id, t.id);
      transferred := transferred + 1;

    ELSIF t.scheduled_for IS DISTINCT FROM delivery_date THEN
      IF t.accepted_at IS NOT NULL
         OR t.started_at IS NOT NULL
         OR t.status IN ('saiu_para_entrega', 'chegando', 'entregue', 'devolvido', 'cancelado') THEN
        RAISE EXCEPTION 'A entrega do pedido % já foi iniciada e não pode ser reagendada', o.id;
      END IF;

      UPDATE public.delivery_tracking
      SET scheduled_for = delivery_date,
          assigned_at = now(),
          assigned_by = auth.uid()
      WHERE id = t.id;

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
        'assigned',
        t.status::text,
        t.status::text,
        jsonb_build_object(
          'rescheduled', true,
          'previous_scheduled_for', t.scheduled_for,
          'scheduled_for', delivery_date
        ),
        auth.uid()
      );

      rescheduled := rescheduled + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'assigned', assigned,
    'transferred', transferred,
    'rescheduled', rescheduled,
    'scheduled_for', delivery_date
  );
END;
$function$;

-- Mantem compatibilidade com qualquer tela antiga que ainda chame a RPC de 3 argumentos.
CREATE OR REPLACE FUNCTION public.assign_orders_to_courier(
  _store_id uuid,
  _order_ids uuid[],
  _courier_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.assign_orders_to_courier_scheduled(
    _store_id,
    _order_ids,
    _courier_id,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
$function$;

CREATE OR REPLACE FUNCTION public.list_order_assignments(_store_id uuid)
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
    SELECT jsonb_agg(x)
    FROM (
      SELECT DISTINCT ON (t.order_id)
        t.id,
        t.order_id,
        t.courier_id,
        c.name AS courier_name,
        t.status::text AS status,
        t.assigned_at,
        t.scheduled_for,
        t.accepted_at,
        t.started_at,
        t.completed_at,
        t.returned_at
      FROM public.delivery_tracking t
      LEFT JOIN public.couriers c ON c.id = t.courier_id
      WHERE t.store_id = _store_id
      ORDER BY t.order_id, t.created_at DESC
    ) x
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

-- Protecao no banco: mesmo que uma versao antiga do app tente iniciar antes da data,
-- aceitar/iniciar a entrega fica bloqueado ate o dia agendado. Recusar continua permitido.
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
  brazil_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
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

  IF _action IN ('accept', 'start') AND t.scheduled_for > brazil_today THEN
    RAISE EXCEPTION 'Entrega agendada para %. Aguarde a data programada para iniciar.', to_char(t.scheduled_for, 'DD/MM/YYYY');
  END IF;

  IF _action = 'reject' THEN
    IF t.accepted_at IS NOT NULL OR t.status NOT IN ('aguardando_motoboy','preparando') THEN
      RAISE EXCEPTION 'Esta entrega não pode mais ser recusada';
    END IF;

    PERFORM public.restore_courier_inventory_for_unassignment(c.store_id, c.id, t.order_id, t.id);

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
      t.id,
      t.order_id,
      c.id,
      c.store_id,
      'delivery_failed',
      t.status::text,
      t.status::text,
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
    t.id,
    t.order_id,
    c.id,
    c.store_id,
    event,
    t.status::text,
    ns::text,
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

GRANT EXECUTE ON FUNCTION public.assign_orders_to_courier_scheduled(uuid, uuid[], uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_orders_to_courier(uuid, uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_order_assignments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_delivery_load(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_delivery_action(text, uuid, text, text, text, text, double precision, double precision) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
