
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'mensal';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 30;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS kiwify_product_id text;
CREATE INDEX IF NOT EXISTS plans_kiwify_product_id_idx ON public.plans(kiwify_product_id);
