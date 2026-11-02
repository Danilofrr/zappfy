-- Planejamento de compras por loja: dias de transporte, intervalo de reposicao e reserva.
CREATE TABLE IF NOT EXISTS public.inventory_planning_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_days integer NOT NULL DEFAULT 7 CHECK (lead_days BETWEEN 1 AND 30),
  review_days integer NOT NULL DEFAULT 15 CHECK (review_days BETWEEN 1 AND 60),
  safety_days integer NOT NULL DEFAULT 3 CHECK (safety_days BETWEEN 0 AND 30),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_planning_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners manage inventory planning" ON public.inventory_planning_settings;
CREATE POLICY "Store owners manage inventory planning"
ON public.inventory_planning_settings FOR ALL TO authenticated
USING (
  owner_id = (select auth.uid())
  AND EXISTS (SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = (select auth.uid()))
)
WITH CHECK (
  owner_id = (select auth.uid())
  AND EXISTS (SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = (select auth.uid()))
);

REVOKE ALL ON public.inventory_planning_settings FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.inventory_planning_settings TO authenticated;

-- Agrega TODAS as vendas do periodo sem o limite de 1.000 linhas da API REST.
-- O resultado contem apenas data, produto e quantidade, sem informacoes de clientes.
CREATE OR REPLACE FUNCTION public.inventory_sales_daily(
  _store_id uuid,
  _since date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  response jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _store_id AND s.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao planejamento de estoque';
  END IF;

  IF _since IS NULL OR _since < (current_date - 180) OR _since > current_date THEN
    RAISE EXCEPTION 'Periodo invalido para analise de vendas';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', sales.product_id,
    'sale_day', sales.sale_day,
    'quantity', sales.quantity
  ) ORDER BY sales.sale_day DESC, sales.product_id), '[]'::jsonb)
  INTO response
  FROM (
    SELECT p.id AS product_id,
      (o.date AT TIME ZONE 'America/Recife')::date AS sale_day,
      SUM(
        CASE WHEN (item.value->>'qty') ~ '^[0-9]{1,8}$'
          THEN (item.value->>'qty')::bigint ELSE 0 END
      )::bigint AS quantity
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END
    ) AS item(value)
    JOIN public.products p
      ON p.store_id = _store_id
     AND (
       item.value->>'productId' = p.id::text
       OR (
         COALESCE(item.value->>'productId', '') = ''
         AND lower(btrim(item.value->>'name')) = lower(btrim(p.name))
         AND NOT EXISTS (
           SELECT 1 FROM public.products p2
           WHERE p2.store_id = _store_id AND p2.id <> p.id
             AND lower(btrim(p2.name)) = lower(btrim(p.name))
         )
       )
     )
    WHERE o.store_id = _store_id
      AND o.status <> 'cancelado'
      AND o.date >= (_since::timestamp AT TIME ZONE 'America/Recife')
      AND o.date < (now() + interval '1 day')
    GROUP BY p.id, (o.date AT TIME ZONE 'America/Recife')::date
    HAVING SUM(
      CASE WHEN (item.value->>'qty') ~ '^[0-9]{1,8}$'
        THEN (item.value->>'qty')::bigint ELSE 0 END
    ) > 0
  ) sales;

  RETURN response;
END;
$function$;

REVOKE ALL ON FUNCTION public.inventory_sales_daily(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_sales_daily(uuid, date) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_orders_inventory_planning_store_date
ON public.orders (store_id, date DESC) WHERE status <> 'cancelado';

NOTIFY pgrst, 'reload schema';
