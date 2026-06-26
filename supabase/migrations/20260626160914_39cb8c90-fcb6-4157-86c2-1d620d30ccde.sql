-- Phase 2: Add store_id to orders, products, expenses with per-store RLS

-- 1) ORDERS
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
UPDATE public.orders SET store_id = user_id WHERE store_id IS NULL;
ALTER TABLE public.orders ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);

DROP POLICY IF EXISTS "Users manage their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.orders;
DROP POLICY IF EXISTS "Owners manage orders of their stores" ON public.orders;

CREATE POLICY "Owners manage orders of their stores" ON public.orders
  FOR ALL TO authenticated
  USING (public.user_owns_store(store_id) OR auth.uid() = user_id)
  WITH CHECK (public.user_owns_store(store_id) OR auth.uid() = user_id);

-- 2) PRODUCTS
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
UPDATE public.products SET store_id = user_id WHERE store_id IS NULL;
ALTER TABLE public.products ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);

DROP POLICY IF EXISTS "Users manage their own products" ON public.products;
DROP POLICY IF EXISTS "Public can view products by slug" ON public.products;
DROP POLICY IF EXISTS "Owners manage products of their stores" ON public.products;
DROP POLICY IF EXISTS "Public can view products" ON public.products;

CREATE POLICY "Owners manage products of their stores" ON public.products
  FOR ALL TO authenticated
  USING (public.user_owns_store(store_id) OR auth.uid() = user_id)
  WITH CHECK (public.user_owns_store(store_id) OR auth.uid() = user_id);

CREATE POLICY "Public can view products" ON public.products
  FOR SELECT TO anon, authenticated USING (true);

-- 3) EXPENSES
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
UPDATE public.expenses SET store_id = user_id WHERE store_id IS NULL;
ALTER TABLE public.expenses ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_store_id ON public.expenses(store_id);

DROP POLICY IF EXISTS "Users manage their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Owners manage expenses of their stores" ON public.expenses;

CREATE POLICY "Owners manage expenses of their stores" ON public.expenses
  FOR ALL TO authenticated
  USING (public.user_owns_store(store_id) OR auth.uid() = user_id)
  WITH CHECK (public.user_owns_store(store_id) OR auth.uid() = user_id);

-- 4) Default store_id from auth.uid() on insert (backwards compatible for current code)
CREATE OR REPLACE FUNCTION public.default_store_id_from_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id IS NULL THEN
    NEW.store_id := COALESCE(NEW.user_id, auth.uid());
  END IF;
  IF NEW.user_id IS NULL THEN
    NEW.user_id := COALESCE(auth.uid(), NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_default_store ON public.orders;
CREATE TRIGGER trg_orders_default_store BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.default_store_id_from_user();

DROP TRIGGER IF EXISTS trg_products_default_store ON public.products;
CREATE TRIGGER trg_products_default_store BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.default_store_id_from_user();

DROP TRIGGER IF EXISTS trg_expenses_default_store ON public.expenses;
CREATE TRIGGER trg_expenses_default_store BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.default_store_id_from_user();
