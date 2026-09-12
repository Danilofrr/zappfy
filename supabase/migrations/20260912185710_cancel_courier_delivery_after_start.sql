-- Permite ao motoboy encerrar uma tentativa de entrega depois de iniciar a rota.
-- O resultado conta como "não entregue" no histórico do motoboy. Quando o cliente
-- não cancelou definitivamente o pedido, ele volta para aguardando e pode ser
-- atribuído novamente a outro motoboy.

CREATE OR REPLACE FUNCTION public.cancel_courier_delivery(
  _token text,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.delivery_tracking;
  o public.orders;
  reason_text text := NULLIF(btrim(COALESCE(_reason, '')), '');
  customer_cancelled boolean := false;
  can_reassign boolean := true;
  next_order_status text := 'aguardando';
BEGIN
  SELECT * INTO t
  FROM public.delivery_tracking
  WHERE courier_token = _token
  LIMIT 1
  FOR UPDATE;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Rastreamento não encontrado';
  END IF;

  IF reason_text IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da entrega não realizada';
  END IF;

  IF t.status = 'nao_entregue' THEN
    RETURN jsonb_build_object(
      'changed', false,
      'status', 'nao_entregue',
      'reason', COALESCE(t.failure_reason, reason_text)
    );
  END IF;

  IF t.status IN ('entregue', 'cancelado', 'devolvido') THEN
    RAISE EXCEPTION 'Entrega já finalizada';
  END IF;

  IF t.status NOT IN ('saiu_para_entrega', 'chegando') THEN
    RAISE EXCEPTION 'Inicie a entrega antes de cancelar a tentativa';
  END IF;

  SELECT * INTO o
  FROM public.orders
  WHERE id = t.order_id
    AND store_id = t.store_id
  LIMIT 1;

  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  customer_cancelled := lower(reason_text) = lower('Cliente cancelou o pedido');
  can_reassign := NOT customer_cancelled;
  next_order_status := CASE WHEN customer_cancelled THEN 'cancelado' ELSE 'aguardando' END;

  UPDATE public.delivery_tracking
  SET status = 'nao_entregue',
      failure_reason = reason_text,
      completion_notes = reason_text,
      updated_at = now()
  WHERE id = t.id;

  UPDATE public.orders
  SET status = next_order_status
  WHERE id = t.order_id
    AND store_id = t.store_id;

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
    t.courier_id,
    t.store_id,
    'delivery_failed',
    t.status::text,
    'nao_entregue',
    jsonb_strip_nulls(jsonb_build_object(
      'kind', 'cancelled_after_start',
      'reason', reason_text,
      'can_reassign', can_reassign,
      'courier_name', t.courier_name,
      'courier_phone', t.courier_phone,
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

  RETURN jsonb_build_object(
    'changed', true,
    'status', 'nao_entregue',
    'reason', reason_text,
    'can_reassign', can_reassign,
    'order_status', next_order_status
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancel_courier_delivery(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
