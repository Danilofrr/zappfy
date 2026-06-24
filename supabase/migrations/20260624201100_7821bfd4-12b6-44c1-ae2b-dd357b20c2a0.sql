
-- Add Kiwify integration fields to plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS kiwify_product_id_monthly TEXT,
  ADD COLUMN IF NOT EXISTS kiwify_product_id_quarterly TEXT,
  ADD COLUMN IF NOT EXISTS kiwify_product_id_yearly TEXT,
  ADD COLUMN IF NOT EXISTS duration_days_monthly INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS duration_days_quarterly INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS duration_days_yearly INTEGER NOT NULL DEFAULT 365;

-- Add Kiwify tracking fields to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS kiwify_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS kiwify_order_id TEXT,
  ADD COLUMN IF NOT EXISTS kiwify_customer_email TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_kiwify_sub ON public.subscriptions(kiwify_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_kiwify_order ON public.subscriptions(kiwify_order_id);

-- Webhook logs table for debugging
CREATE TABLE IF NOT EXISTS public.kiwify_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT,
  order_id TEXT,
  subscription_id TEXT,
  customer_email TEXT,
  product_id TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kiwify_webhook_logs TO authenticated;
GRANT ALL ON public.kiwify_webhook_logs TO service_role;

ALTER TABLE public.kiwify_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view kiwify webhook logs"
  ON public.kiwify_webhook_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kiwify_logs_created ON public.kiwify_webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kiwify_logs_email ON public.kiwify_webhook_logs(customer_email);
