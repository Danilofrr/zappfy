ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'nao_entregue';
ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'retornando';
ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'devolvido';