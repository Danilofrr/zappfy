-- Mantem o pedido recusado disponivel para nova atribuicao, mas preserva
-- um historico auditavel no motoboy que recusou a entrega.

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

    -- Se a atribuicao reservou itens do estoque movel, devolve a reserva ao motoboy
    -- antes de liberar o pedido para uma nova atribuicao.
    PERFORM public.restore_courier_inventory_for_unassignment(c.store_id, c.id, t.order_id, t.id);

    -- A recusa passa a contar como "não entregue" no resultado do motoboy.
    -- O tracking, entretanto, NAO e finalizado: ele continua disponivel para
    -- o administrador atribuir a outro motoboy no mesmo dia ou em outro dia.
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
        'items', to_jsonb(o.items)
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
      'can_reassign', CASE WHEN _action = 'fail' THEN true ELSE NULL END,
      'customer', CASE WHEN _action = 'fail' THEN o.customer ELSE NULL END,
      'phone', CASE WHEN _action = 'fail' THEN o.phone ELSE NULL END,
      'address', CASE WHEN _action = 'fail' THEN o.address ELSE NULL END,
      'district', CASE WHEN _action = 'fail' THEN o.district ELSE NULL END,
      'city', CASE WHEN _action = 'fail' THEN o.city ELSE NULL END,
      'order_total', CASE WHEN _action = 'fail' THEN o.total ELSE NULL END,
      'payment', CASE WHEN _action = 'fail' THEN o.payment ELSE NULL END,
      'items', CASE WHEN _action = 'fail' THEN to_jsonb(o.items) ELSE NULL END
    ))
  );

  RETURN jsonb_build_object('changed', true, 'status', ns);
END;
$function$;

NOTIFY pgrst, 'reload schema';
