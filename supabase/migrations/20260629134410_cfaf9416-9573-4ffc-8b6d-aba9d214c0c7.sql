DROP POLICY IF EXISTS "store owner manages own couriers" ON public.couriers;
CREATE POLICY "Owners manage couriers of their stores" ON public.couriers
  FOR ALL TO authenticated
  USING (public.user_owns_store(store_id) OR auth.uid() = store_id)
  WITH CHECK (public.user_owns_store(store_id) OR auth.uid() = store_id);