-- Oculta custos na Central de Motoboys quando o funcionário não tem acesso financeiro.

CREATE OR REPLACE FUNCTION public.get_courier_load_detail(_store_id uuid, _courier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  can_finance boolean := public.team_has_permission(_store_id, 'finance');
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN jsonb_build_object(
    'orders', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'status', t.status,
          'assigned_at', t.assigned_at,
          'accepted_at', t.accepted_at,
          'started_at', t.started_at,
          'completed_at', t.completed_at,
          'failure_reason', t.failure_reason,
          'proof_url', t.proof_url,
          'notes', t.completion_notes,
          'order',
            (to_jsonb(o) - 'user_id' - 'store_id' - 'items')
            || jsonb_build_object(
              'items',
              COALESCE((
                SELECT jsonb_agg(
                  (item - 'cost') || jsonb_build_object(
                    'cost',
                    CASE WHEN can_finance THEN COALESCE((item->>'cost')::numeric, 0) ELSE 0 END
                  )
                )
                FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) item
              ), '[]'::jsonb)
            )
        )
        ORDER BY COALESCE(t.assigned_at, t.created_at) DESC
      )
      FROM public.delivery_tracking t
      JOIN public.orders o ON o.id = t.order_id
      WHERE t.store_id = _store_id
        AND t.courier_id = _courier_id
    ), '[]'::jsonb),

    'products', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('name', p.name, 'quantity', p.qty)
        ORDER BY p.name
      )
      FROM (
        SELECT i->>'name' AS name,
               sum(COALESCE((i->>'qty')::numeric, 0)) AS qty
        FROM public.delivery_tracking t
        JOIN public.orders o ON o.id = t.order_id
        CROSS JOIN LATERAL jsonb_array_elements(o.items::jsonb) i
        WHERE t.store_id = _store_id
          AND t.courier_id = _courier_id
          AND t.status NOT IN ('entregue', 'devolvido', 'cancelado')
        GROUP BY i->>'name'
      ) p
    ), '[]'::jsonb),

    'events', COALESCE((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC)
      FROM (
        SELECT ev.*
        FROM public.delivery_events ev
        LEFT JOIN public.delivery_tracking current_tracking
          ON current_tracking.id = ev.delivery_tracking_id
        WHERE ev.store_id = _store_id
          AND ev.courier_id = _courier_id
          AND (
            ev.event_type <> 'delivery_failed'
            OR current_tracking.courier_id IS NULL
            OR current_tracking.courier_id = _courier_id
          )
        ORDER BY ev.created_at DESC
        LIMIT 100
      ) e
    ), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_courier_inventory(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  can_finance boolean := public.team_has_permission(_store_id, 'finance');
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ci.id,
        'store_id', ci.store_id,
        'courier_id', ci.courier_id,
        'product_id', ci.product_id,
        'product_name', p.name,
        'category', COALESCE(p.category, ''),
        'variant_label', ci.variant_label,
        'quantity', ci.quantity,
        'unit_price', COALESCE(p.price, 0),
        'unit_cost', CASE WHEN can_finance THEN COALESCE(p.cost, 0) ELSE 0 END,
        'sale_value', ci.quantity * COALESCE(p.price, 0),
        'cost_value', CASE WHEN can_finance THEN ci.quantity * COALESCE(p.cost, 0) ELSE 0 END,
        'notes', ci.notes,
        'updated_at', ci.updated_at
      )
      ORDER BY c.name, p.name, ci.variant_label
    )
    FROM public.courier_inventory ci
    JOIN public.couriers c ON c.id = ci.courier_id
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.store_id = _store_id
      AND ci.quantity > 0
  ), '[]'::jsonb);
END;
$function$;

NOTIFY pgrst, 'reload schema';
