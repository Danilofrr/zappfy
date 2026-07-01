ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS store_id uuid,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS new_product_id uuid,
  ADD COLUMN IF NOT EXISTS product_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_date timestamptz;

UPDATE public.returns SET store_id = user_id WHERE store_id IS NULL;

CREATE INDEX IF NOT EXISTS returns_store_id_idx ON public.returns(store_id);
CREATE INDEX IF NOT EXISTS returns_order_id_idx ON public.returns(order_id);