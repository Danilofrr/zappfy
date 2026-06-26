CREATE OR REPLACE FUNCTION public.delete_my_store(_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.stores;
  total int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO s FROM public.stores WHERE id = _store_id LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;
  IF s.owner_id <> auth.uid() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF s.is_default THEN RAISE EXCEPTION 'Não é possível excluir a loja principal'; END IF;
  SELECT COUNT(*) INTO total FROM public.stores WHERE owner_id = auth.uid();
  IF total <= 1 THEN RAISE EXCEPTION 'Você precisa ter ao menos uma loja'; END IF;

  -- Tabelas sem FK direta para stores: limpar manualmente
  DELETE FROM public.delivery_tracking WHERE store_id = _store_id;
  DELETE FROM public.couriers WHERE store_id = _store_id;
  DELETE FROM public.delivery_tracking_settings WHERE store_id = _store_id;

  -- Demais (orders/products/expenses/settings) caem por ON DELETE CASCADE
  DELETE FROM public.stores WHERE id = _store_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_store(uuid) TO authenticated;