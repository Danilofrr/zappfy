ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE public.returns ADD CONSTRAINT returns_status_check
CHECK (status IN ('parado_loja','com_fornecedor','devolvido_estoque','perdido','resolvido'));