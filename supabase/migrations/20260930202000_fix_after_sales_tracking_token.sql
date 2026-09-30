
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
  next_tracking_code text;
  next_courier_token text;
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
  WHERE id=_return_id
    AND store_id=_store_id
    AND type='cliente'
  FOR UPDATE;

  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Troca/devolução não encontrada';
  END IF;

  IF r.order_id IS NULL THEN
    RAISE EXCEPTION 'Vincule esta troca/devolução a um pedido antes de enviar ao motoboy';
  END IF;

  SELECT * INTO o
  FROM public.orders
  WHERE id=r.order_id
    AND store_id=_store_id
  LIMIT 1;

  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Pedido original não encontrado';
  END IF;

  SELECT * INTO c
  FROM public.couriers
  WHERE id=_courier_id
    AND store_id=_store_id
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
  WHERE return_id=r.id
  LIMIT 1
  FOR UPDATE;

  next_tracking_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  next_courier_token := replace(gen_random_uuid()::text,'-','');

  IF t.id IS NULL THEN
    INSERT INTO public.delivery_tracking(
      order_id,store_id,tracking_code,courier_token,
      courier_id,courier_name,courier_phone,status,
      assigned_at,assigned_by,scheduled_for,
      operation_type,return_id,notes
    )
    VALUES(
      o.id,_store_id,next_tracking_code,next_courier_token,
      c.id,c.name,c.phone,'aguardando_motoboy',
      now(),auth.uid(),delivery_date,
      op_type,r.id,r.reason
    )
    RETURNING * INTO t;
  ELSE
    IF t.status IN ('entregue','devolvido','cancelado') THEN
      RAISE EXCEPTION 'Este atendimento de pós-venda já foi finalizado';
    END IF;

    was_transfer := t.courier_id IS DISTINCT FROM c.id;

    UPDATE public.delivery_tracking
    SET courier_id=c.id,
        courier_name=c.name,
        courier_phone=c.phone,
        status='aguardando_motoboy',
        assigned_at=now(),
        accepted_at=NULL,
        started_at=NULL,
        completed_at=NULL,
        returned_at=NULL,
        failure_reason=NULL,
        assigned_by=auth.uid(),
        scheduled_for=delivery_date,
        operation_type=op_type,
        notes=r.reason,
        courier_token=CASE
          WHEN t.courier_id IS DISTINCT FROM c.id THEN next_courier_token
          ELSE courier_token
        END,
        updated_at=now()
    WHERE id=t.id
    RETURNING * INTO t;
  END IF;

  UPDATE public.returns
  SET courier_status='assigned',
      courier_completed_at=NULL,
      updated_at=now()
  WHERE id=r.id;

  INSERT INTO public.delivery_events(
    delivery_tracking_id,order_id,courier_id,store_id,
    event_type,old_status,new_status,metadata,created_by
  )
  VALUES(
    t.id,o.id,c.id,_store_id,
    CASE WHEN was_transfer THEN 'transferred' ELSE 'assigned' END,
    NULL,'aguardando_motoboy',
    jsonb_build_object(
      'operation_type',op_type,
      'return_id',r.id,
      'resolution_type',r.resolution_type,
      'product_name',r.product_name,
      'new_product_name',r.new_product_name,
      'scheduled_for',delivery_date
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'ok',true,
    'tracking_id',t.id,
    'courier_id',c.id,
    'courier_name',c.name,
    'operation_type',op_type,
    'scheduled_for',delivery_date
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assign_return_to_courier(uuid,uuid,uuid,date) TO authenticated;
NOTIFY pgrst,'reload schema';
