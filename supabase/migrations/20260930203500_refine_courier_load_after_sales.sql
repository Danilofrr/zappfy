
CREATE OR REPLACE FUNCTION public.get_courier_loads(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  day_start timestamptz :=
    (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo');
  day_end timestamptz :=
    ((date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day') AT TIME ZONE 'America/Sao_Paulo');
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN COALESCE((
    WITH tracking_base AS (
      SELECT
        t.courier_id,
        t.status,
        COALESCE(t.operation_type,'delivery') AS operation_type,
        t.completed_at,
        t.returned_at,
        o.total,
        CASE
          WHEN COALESCE(t.operation_type,'delivery')='exchange'
            THEN COALESCE(r.quantity,1)::numeric
          WHEN COALESCE(t.operation_type,'delivery')='return'
            THEN 0::numeric
          ELSE COALESCE((
            SELECT sum(COALESCE((item->>'qty')::numeric,0))
            FROM jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) item
          ),0)
        END AS qty
      FROM public.delivery_tracking t
      JOIN public.orders o ON o.id=t.order_id
      LEFT JOIN public.returns r ON r.id=t.return_id
      WHERE t.store_id=_store_id
        AND t.courier_id IS NOT NULL
    ),
    agg AS (
      SELECT
        courier_id,
        count(*) FILTER (
          WHERE status NOT IN ('entregue','devolvido','cancelado')
        ) AS possession_orders,
        COALESCE(sum(qty) FILTER (
          WHERE status NOT IN ('entregue','devolvido','cancelado')
        ),0) AS possession_products,
        COALESCE(sum(total) FILTER (
          WHERE status NOT IN ('entregue','devolvido','cancelado')
            AND operation_type='delivery'
        ),0) AS possession_value,
        count(*) FILTER (
          WHERE status='entregue'
            AND operation_type='delivery'
            AND completed_at>=day_start
            AND completed_at<day_end
        ) AS delivered_orders,
        count(*) FILTER (
          WHERE status='entregue'
            AND operation_type='exchange'
            AND completed_at>=day_start
            AND completed_at<day_end
        ) AS exchanges_today,
        count(*) FILTER (
          WHERE status='entregue'
            AND operation_type='return'
            AND completed_at>=day_start
            AND completed_at<day_end
        ) AS returns_today,
        count(*) FILTER (
          WHERE status='entregue'
            AND completed_at>=day_start
            AND completed_at<day_end
        ) AS services_completed_today,
        COALESCE(sum(qty) FILTER (
          WHERE status='entregue'
            AND operation_type='delivery'
            AND completed_at>=day_start
            AND completed_at<day_end
        ),0) AS delivered_products,
        count(*) FILTER (WHERE status='nao_entregue') AS failed,
        count(*) FILTER (
          WHERE status='devolvido'
            AND returned_at>=day_start
            AND returned_at<day_end
        ) AS returned,
        bool_or(status IN ('saiu_para_entrega','chegando')) AS in_route
      FROM tracking_base
      GROUP BY courier_id
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'courier_id',c.id,
        'name',c.name,
        'active',c.active,
        'is_online',COALESCE(c.is_online,false),
        'online_updated_at',c.online_updated_at,
        'in_route',COALESCE(a.in_route,false),
        'orders_in_possession',COALESCE(a.possession_orders,0),
        'products_in_possession',COALESCE(a.possession_products,0),
        'value_in_possession',COALESCE(a.possession_value,0),
        'delivered_today',COALESCE(a.delivered_orders,0),
        'exchanges_today',COALESCE(a.exchanges_today,0),
        'returns_today',COALESCE(a.returns_today,0),
        'services_completed_today',COALESCE(a.services_completed_today,0),
        'products_delivered_today',COALESCE(a.delivered_products,0),
        'failed',COALESCE(a.failed,0),
        'returned',COALESCE(a.returned,0)
      )
      ORDER BY c.name
    )
    FROM public.couriers c
    LEFT JOIN agg a ON a.courier_id=c.id
    WHERE c.store_id=_store_id
  ),'[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_courier_loads(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
