-- delivery_tracking.status is TEXT in the current schema. Keep legacy RPCs/triggers text-safe.

CREATE OR REPLACE FUNCTION public.sync_order_status_to_tracking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_status text;
  s text;
BEGIN
  IF NEW.status IS NULL OR NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  s := lower(COALESCE(NEW.status, ''));
  new_status := CASE
    WHEN s = 'entregue' THEN 'entregue'
    WHEN s IN ('cancelado','cancelada') THEN 'cancelado'
    WHEN s IN ('entrega','saiu','saiu_para_entrega','em_entrega') THEN 'saiu_para_entrega'
    WHEN s IN ('separando','separacao','separação','preparando','em_preparo','producao') THEN 'preparando'
    WHEN s IN ('aguardando','aguardando_pagamento','pago','novo','pendente','recebido') THEN 'aguardando_motoboy'
    ELSE NULL
  END;

  IF new_status IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.delivery_tracking
  SET status = new_status,
      started_at = CASE
        WHEN new_status = 'saiu_para_entrega' AND started_at IS NULL THEN now()
        ELSE started_at
      END,
      completed_at = CASE
        WHEN new_status = 'entregue' AND completed_at IS NULL THEN now()
        ELSE completed_at
      END
  WHERE order_id = NEW.id
    AND status NOT IN ('entregue','cancelado')
    AND status IS DISTINCT FROM new_status;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_courier_status(_token text, _status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.delivery_tracking;
  new_status text;
BEGIN
  SELECT * INTO t
  FROM public.delivery_tracking
  WHERE courier_token = _token
  LIMIT 1;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Rastreamento não encontrado';
  END IF;

  IF t.status IN ('entregue','cancelado','devolvido') THEN
    RETURN false;
  END IF;

  IF _status NOT IN ('saiu_para_entrega','chegando','entregue') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  new_status := _status;

  UPDATE public.delivery_tracking
  SET status = new_status,
      started_at = COALESCE(started_at, CASE WHEN new_status='saiu_para_entrega' THEN now() ELSE NULL END),
      completed_at = CASE WHEN new_status='entregue' THEN now() ELSE completed_at END
  WHERE id = t.id;

  IF new_status = 'entregue' THEN
    UPDATE public.orders
    SET status = 'entregue'
    WHERE id = t.order_id;
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_delivery_tracking(_tracking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.delivery_tracking;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO t
  FROM public.delivery_tracking
  WHERE id = _tracking_id
  LIMIT 1;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Rastreamento não encontrado';
  END IF;

  IF t.store_id <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.delivery_tracking
  SET status = 'entregue',
      completed_at = COALESCE(completed_at, now())
  WHERE id = _tracking_id;

  UPDATE public.orders
  SET status = 'entregue'
  WHERE id = t.order_id
    AND status NOT IN ('entregue','cancelado');

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_create_delivery_tracking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _initial_status text;
BEGIN
  _initial_status := CASE
    WHEN lower(COALESCE(NEW.status, '')) = 'entregue' THEN 'entregue'
    WHEN lower(COALESCE(NEW.status, '')) IN ('cancelado','cancelada') THEN 'cancelado'
    WHEN lower(COALESCE(NEW.status, '')) IN ('saiu','saiu_para_entrega','em_entrega') THEN 'aguardando_motoboy'
    ELSE 'preparando'
  END;

  INSERT INTO public.delivery_tracking (
    order_id, store_id, tracking_code, courier_token, status
  ) VALUES (
    NEW.id,
    NEW.user_id,
    't' || replace(gen_random_uuid()::text, '-', ''),
    'c' || replace(gen_random_uuid()::text, '-', ''),
    _initial_status
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';
