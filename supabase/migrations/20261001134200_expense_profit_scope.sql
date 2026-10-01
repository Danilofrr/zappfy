
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS profit_scope text NOT NULL DEFAULT 'day';

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_profit_scope_check;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_profit_scope_check
  CHECK (profit_scope IN ('day','month'));

COMMENT ON COLUMN public.expenses.profit_scope IS
  'day: impacta o lucro diário e acumulados; month: não impacta visão diária, apenas períodos acumulados/mensais';

CREATE INDEX IF NOT EXISTS expenses_store_profit_scope_date_idx
  ON public.expenses(store_id, profit_scope, date DESC);

NOTIFY pgrst, 'reload schema';
