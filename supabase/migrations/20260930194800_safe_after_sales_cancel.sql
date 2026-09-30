
CREATE OR REPLACE FUNCTION public.cancel_courier_delivery(_token text, _reason text)
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
  is_after_sales boolean := false;
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
    RAISE EXCEPTION 'Informe o motivo do atendimento não realizado';
  END IF;

  is_after_sales := COALESCE(t.operation_type,'delivery') <> 'delivery';

  IF t.status = 'nao_entregue' THEN
    RETURN jsonb_build_object(
      'changed', false,
      'status', 'nao_entregue',
      'reason', COALESCE(t.failure_reason, reason_text),
      'operation_type', COALESCE(t.operation_type,'delivery')
    );
  END IF;

  IF t.status IN ('entregue','cancelado','devolvido') THEN
    RAISE EXCEPTION 'Atendimento já finalizado';
  END IF;

  IF t.status NOT IN ('saiu_para_entrega','chegando') THEN
    RAISE EXCEPTION 'Inicie o atendimento antes de cancelar a tentativa';
  END IF;

  SELECT * INTO o
  FROM public.orders
  WHERE id=t.order_id AND store_id=t.store_id
  LIMIT 1;

  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Pedido original não encontrado';
  END IF;

  customer_cancelled := lower(reason_text)=lower('Cliente cancelou o pedido');
  can_reassign := NOT customer_cancelled;
  next_order_status := CASE WHEN customer_cancelled THEN 'cancelado' ELSE 'aguardando' END;

  UPDATE public.delivery_tracking
  SET status='nao_entregue',
      failure_reason=reason_text,
      completion_notes=reason_text,
      updated_at=now()
  WHERE id=t.id;

  IF is_after_sales THEN
    IF t.return_id IS NOT NULL THEN
      UPDATE public.returns
      SET courier_status='failed',
          updated_at=now()
      WHERE id=t.return_id;
    END IF;
  ELSE
    UPDATE public.orders
    SET status=next_order_status
    WHERE id=t.order_id AND store_id=t.store_id;
  END IF;

  INSERT INTO public.delivery_events(
    delivery_tracking_id,order_id,courier_id,store_id,
    event_type,old_status,new_status,metadata
  )
  VALUES(
    t.id,t.order_id,t.courier_id,t.store_id,
    'delivery_failed',t.status,'nao_entregue',
    jsonb_strip_nulls(jsonb_build_object(
      'kind', CASE WHEN is_after_sales THEN 'after_sales_failed' ELSE 'cancelled_after_start' END,
      'reason',reason_text,
      'can_reassign',can_reassign,
      'operation_type',COALESCE(t.operation_type,'delivery'),
      'return_id',t.return_id,
      'courier_name',t.courier_name,
      'courier_phone',t.courier_phone,
      'customer',o.customer,
      'phone',o.phone,
      'address',o.address,
      'district',o.district,
      'city',o.city,
      'order_total',CASE WHEN is_after_sales THEN NULL ELSE o.total END,
      'payment',CASE WHEN is_after_sales THEN NULL ELSE o.payment END,
      'items',CASE WHEN is_after_sales THEN NULL ELSE to_jsonb(o.items) END
    ))
  );

  RETURN jsonb_build_object(
    'changed',true,
    'status','nao_entregue',
    'reason',reason_text,
    'can_reassign',can_reassign,
    'operation_type',COALESCE(t.operation_type,'delivery'),
    'order_status',CASE WHEN is_after_sales THEN o.status ELSE next_order_status END
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancel_courier_delivery(text,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
