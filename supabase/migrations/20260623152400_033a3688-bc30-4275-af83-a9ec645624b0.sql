
-- Auto-create delivery_tracking on order insert
CREATE OR REPLACE FUNCTION public.auto_create_delivery_tracking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _initial_status public.delivery_status;
BEGIN
  -- Map order status → delivery_status (default: preparando)
  _initial_status := CASE
    WHEN lower(COALESCE(NEW.status, '')) IN ('entregue') THEN 'entregue'::public.delivery_status
    WHEN lower(COALESCE(NEW.status, '')) IN ('cancelado','cancelada') THEN 'cancelado'::public.delivery_status
    WHEN lower(COALESCE(NEW.status, '')) IN ('saiu','saiu_para_entrega','em_entrega') THEN 'aguardando_motoboy'::public.delivery_status
    ELSE 'preparando'::public.delivery_status
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
$$;

DROP TRIGGER IF EXISTS trg_auto_create_delivery_tracking ON public.orders;
CREATE TRIGGER trg_auto_create_delivery_tracking
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_delivery_tracking();

-- Backfill: every existing order without tracking gets one
INSERT INTO public.delivery_tracking (order_id, store_id, tracking_code, courier_token, status)
SELECT
  o.id,
  o.user_id,
  't' || replace(gen_random_uuid()::text, '-', ''),
  'c' || replace(gen_random_uuid()::text, '-', ''),
  CASE
    WHEN lower(COALESCE(o.status, '')) IN ('entregue') THEN 'entregue'::public.delivery_status
    WHEN lower(COALESCE(o.status, '')) IN ('cancelado','cancelada') THEN 'cancelado'::public.delivery_status
    WHEN lower(COALESCE(o.status, '')) IN ('saiu','saiu_para_entrega','em_entrega') THEN 'aguardando_motoboy'::public.delivery_status
    ELSE 'preparando'::public.delivery_status
  END
FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.delivery_tracking t WHERE t.order_id = o.id
);
