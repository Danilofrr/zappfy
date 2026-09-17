ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_queue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_carrier text,
  ADD COLUMN IF NOT EXISTS shipping_status text,
  ADD COLUMN IF NOT EXISTS shipping_due_date date,
  ADD COLUMN IF NOT EXISTS shipping_added_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_label_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_tracking_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_shipping_status_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_shipping_status_check
      CHECK (
        shipping_status IS NULL OR
        shipping_status IN ('pendente_etiqueta','etiqueta_gerada','pronto_postagem','postado')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_shipping_queue_idx
  ON public.orders(store_id, shipping_queue, shipping_due_date, shipping_status)
  WHERE shipping_queue = true;
