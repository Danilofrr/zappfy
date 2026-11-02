-- Reposicao agora e mensal: fechamento comercial entre os dias 15.
-- A duracao real do ciclo (28 a 31 dias) e calculada no frontend.
-- A coluna legada review_days e preservada para compatibilidade.
ALTER TABLE public.inventory_planning_settings
ALTER COLUMN review_days SET DEFAULT 30;

UPDATE public.inventory_planning_settings
SET review_days = 30, updated_at = now()
WHERE review_days = 15;