-- =========== SUPPLIERS ===========
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own suppliers" ON public.suppliers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_suppliers_user ON public.suppliers(user_id);

-- =========== PURCHASE ORDERS ===========
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL DEFAULT '',
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','recebido','cancelado')),
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_date TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase orders" ON public.purchase_orders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_purchase_orders_user ON public.purchase_orders(user_id);
CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);

-- =========== RETURNS (Trocas & Devoluções) ===========
CREATE TABLE public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'cliente' CHECK (type IN ('cliente','fornecedor')),
  party_name TEXT NOT NULL DEFAULT '',
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  new_product_name TEXT DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'parado_loja' CHECK (status IN ('parado_loja','com_fornecedor','perdido','resolvido')),
  value_at_risk NUMERIC(12,2) NOT NULL DEFAULT 0,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  return_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own returns" ON public.returns
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_returns_updated_at BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_returns_user ON public.returns(user_id);