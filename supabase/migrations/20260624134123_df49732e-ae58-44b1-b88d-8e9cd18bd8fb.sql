CREATE OR REPLACE FUNCTION public.update_courier_status(_token text, _status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.delivery_tracking;
  new_status public.delivery_status;
BEGIN
  SELECT * INTO t FROM public.delivery_tracking WHERE courier_token = _token LIMIT 1;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Rastreamento não encontrado'; END IF;
  IF t.status IN ('entregue','cancelado') THEN RETURN false; END IF;
  IF _status NOT IN ('saiu_para_entrega','chegando','entregue') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  new_status := _status::public.delivery_status;
  UPDATE public.delivery_tracking
    SET status = new_status,
        started_at = COALESCE(started_at, CASE WHEN new_status='saiu_para_entrega' THEN now() ELSE NULL END),
        completed_at = CASE WHEN new_status='entregue' THEN now() ELSE completed_at END
    WHERE id = t.id;
  -- Mirror to orders only when actually delivered. Starting the route (saiu_para_entrega)
  -- must NOT mark the order as delivered, otherwise the dashboard panel shows
  -- "Entrega concluída" right after the courier taps "Iniciar Entrega".
  IF new_status = 'entregue' THEN
    UPDATE public.orders SET status = 'entregue' WHERE id = t.order_id;
  END IF;
  RETURN true;
END;
$function$;