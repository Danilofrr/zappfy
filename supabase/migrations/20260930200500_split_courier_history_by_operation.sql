
CREATE OR REPLACE FUNCTION public.get_courier_history_period(
  _store_id uuid,
  _start timestamptz,
  _end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  can_finance boolean := public.team_has_permission(_store_id, 'finance');
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF _start IS NULL OR _end IS NULL OR _end <= _start THEN
    RAISE EXCEPTION 'Período inválido';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'courier_id', c.id,
        'orders', COALESCE(delivered.orders, '[]'::jsonb),
        'events', COALESCE(events.events, '[]'::jsonb)
      )
      ORDER BY c.name
    )
    FROM public.couriers c
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(row_data ORDER BY completed_at DESC) AS orders
      FROM (
        SELECT
          t.completed_at,
          jsonb_build_object(
            'id', t.id,
            'order_id', t.order_id,
            'status', t.status,
            'operation_type', COALESCE(t.operation_type,'delivery'),
            'return_id', t.return_id,
            'return_info', CASE
              WHEN r.id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'resolution_type', r.resolution_type,
                'product_name', r.product_name,
                'new_product_name', r.new_product_name,
                'quantity', r.quantity
              )
            END,
            'assigned_at', t.assigned_at,
            'accepted_at', t.accepted_at,
            'started_at', t.started_at,
            'completed_at', t.completed_at,
            'failure_reason', t.failure_reason,
            'notes', t.completion_notes,
            'received_payments', CASE
              WHEN COALESCE(t.operation_type,'delivery')='delivery'
                THEN t.received_payments
              ELSE '[]'::jsonb
            END,
            'received_payment_total', CASE
              WHEN COALESCE(t.operation_type,'delivery')='delivery'
                THEN t.received_payment_total
              ELSE 0
            END,
            'order', jsonb_build_object(
              'id', o.id,
              'customer', o.customer,
              'phone', o.phone,
              'address', o.address,
              'district', o.district,
              'city', o.city,
              'total', CASE
                WHEN COALESCE(t.operation_type,'delivery')='delivery' THEN o.total
                ELSE 0
              END,
              'payment', CASE
                WHEN COALESCE(t.operation_type,'delivery')='delivery' THEN o.payment
                ELSE ''
              END,
              'notes', o.notes,
              'date', o.date,
              'items', CASE
                WHEN COALESCE(t.operation_type,'delivery')='delivery' THEN
                  COALESCE((
                    SELECT jsonb_agg(
                      (item - 'cost') || jsonb_build_object(
                        'cost',
                        CASE
                          WHEN can_finance
                            AND COALESCE(item->>'cost','') ~ '^-?[0-9]+([.][0-9]+)?$'
                            THEN (item->>'cost')::numeric
                          ELSE 0
                        END
                      )
                    )
                    FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) item
                  ), '[]'::jsonb)
                ELSE
                  jsonb_build_array(
                    jsonb_build_object(
                      'name', COALESCE(r.product_name,'Pós-venda'),
                      'qty', COALESCE(r.quantity,1),
                      'cost', 0,
                      'price', 0
                    )
                  )
              END
            )
          ) AS row_data
        FROM public.delivery_tracking t
        JOIN public.orders o ON o.id=t.order_id
        LEFT JOIN public.returns r ON r.id=t.return_id
        WHERE t.store_id=_store_id
          AND t.courier_id=c.id
          AND t.status='entregue'
          AND t.completed_at>=_start
          AND t.completed_at<_end
        ORDER BY t.completed_at DESC
        LIMIT 300
      ) delivered_rows
    ) delivered ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(event_data ORDER BY created_at DESC) AS events
      FROM (
        SELECT
          ev.created_at,
          jsonb_build_object(
            'id',ev.id,
            'delivery_tracking_id',ev.delivery_tracking_id,
            'order_id',ev.order_id,
            'courier_id',ev.courier_id,
            'store_id',ev.store_id,
            'event_type',ev.event_type,
            'old_status',ev.old_status,
            'new_status',ev.new_status,
            'metadata',ev.metadata,
            'created_at',ev.created_at
          ) AS event_data
        FROM public.delivery_events ev
        LEFT JOIN public.delivery_tracking current_tracking
          ON current_tracking.id=ev.delivery_tracking_id
        WHERE ev.store_id=_store_id
          AND ev.courier_id=c.id
          AND ev.created_at>=_start
          AND ev.created_at<_end
          AND (
            ev.event_type<>'delivery_failed'
            OR current_tracking.courier_id IS NULL
            OR current_tracking.courier_id=c.id
          )
        ORDER BY ev.created_at DESC
        LIMIT 300
      ) event_rows
    ) events ON true
    WHERE c.store_id=_store_id
  ),'[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_courier_history_period(uuid,timestamptz,timestamptz) TO authenticated;
NOTIFY pgrst,'reload schema';
