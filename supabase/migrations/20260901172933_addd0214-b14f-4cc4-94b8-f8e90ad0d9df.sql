ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'compra',
  quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  supplier_name text,
  payment_method text,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own stock movements"
  ON public.stock_movements FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_po_type_uniq
  ON public.stock_movements (purchase_order_id, type)
  WHERE purchase_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS stock_movements_user_idx ON public.stock_movements (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON public.stock_movements (product_id, occurred_at DESC);

CREATE TRIGGER stock_movements_set_updated_at
  BEFORE UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();