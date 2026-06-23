-- Ensure realtime publication includes orders and delivery_tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='delivery_tracking'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_tracking';
  END IF;
END $$;

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.delivery_tracking REPLICA IDENTITY FULL;

-- Mirror order.status changes into delivery_tracking.status automatically
CREATE OR REPLACE FUNCTION public.sync_order_status_to_tracking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_status public.delivery_status;
  s text;
BEGIN
  IF NEW.status IS NULL OR NEW.status = OLD.status THEN RETURN NEW; END IF;
  s := lower(COALESCE(NEW.status, ''));
  new_status := CASE
    WHEN s = 'entregue' THEN 'entregue'::public.delivery_status
    WHEN s IN ('cancelado','cancelada') THEN 'cancelado'::public.delivery_status
    WHEN s IN ('entrega','saiu','saiu_para_entrega','em_entrega') THEN 'saiu_para_entrega'::public.delivery_status
    WHEN s IN ('separando','separacao','separação','preparando','em_preparo','producao') THEN 'preparando'::public.delivery_status
    WHEN s IN ('aguardando','aguardando_pagamento','pago','novo','pendente','recebido') THEN 'aguardando_motoboy'::public.delivery_status
    ELSE NULL
  END;
  IF new_status IS NULL THEN RETURN NEW; END IF;

  UPDATE public.delivery_tracking
    SET status = new_status,
        started_at = CASE WHEN new_status='saiu_para_entrega' AND started_at IS NULL THEN now() ELSE started_at END,
        completed_at = CASE WHEN new_status='entregue' AND completed_at IS NULL THEN now() ELSE completed_at END
    WHERE order_id = NEW.id
      AND status NOT IN ('entregue','cancelado')
      AND (status IS DISTINCT FROM new_status);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_status_to_tracking ON public.orders;
CREATE TRIGGER trg_sync_order_status_to_tracking
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_status_to_tracking();

-- Finalize delivery RPC: marks tracking + order as entregue
CREATE OR REPLACE FUNCTION public.finalize_delivery_tracking(_tracking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t public.delivery_tracking;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO t FROM public.delivery_tracking WHERE id = _tracking_id LIMIT 1;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Rastreamento não encontrado'; END IF;
  IF t.store_id <> auth.uid() THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  UPDATE public.delivery_tracking
    SET status = 'entregue'::public.delivery_status,
        completed_at = COALESCE(completed_at, now())
    WHERE id = _tracking_id;
  UPDATE public.orders SET status = 'entregue'
    WHERE id = t.order_id AND status NOT IN ('entregue','cancelado');
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.finalize_delivery_tracking(uuid) TO authenticated;