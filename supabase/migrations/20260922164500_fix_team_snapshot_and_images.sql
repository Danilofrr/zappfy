-- Corrige e deixa leve o snapshot seguro usado por funcionários.

CREATE OR REPLACE FUNCTION public.team_store_snapshot(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  access jsonb;
  owner_id_value uuid;
  can_orders boolean;
  can_inventory boolean;
  can_finance boolean;
  can_ads boolean;
  can_checkout boolean;
  can_settings boolean;
  can_couriers boolean;
  can_tracking boolean;
  products_json jsonb := '[]'::jsonb;
  orders_json jsonb := '[]'::jsonb;
  expenses_json jsonb := '[]'::jsonb;
  ads_json jsonb := '[]'::jsonb;
  movements_json jsonb := '[]'::jsonb;
  settings_json jsonb := NULL;
  s public.settings;
BEGIN
  access := public.get_my_store_access(_store_id);
  IF access IS NULL THEN
    RAISE EXCEPTION 'Acesso negado à loja';
  END IF;

  owner_id_value := (access->>'owner_id')::uuid;
  can_orders := public.team_has_permission(_store_id, 'orders');
  can_inventory := public.team_has_permission(_store_id, 'inventory');
  can_finance := public.team_has_permission(_store_id, 'finance');
  can_ads := public.team_has_permission(_store_id, 'ads');
  can_checkout := public.team_has_permission(_store_id, 'checkout');
  can_settings := public.team_has_permission(_store_id, 'settings');
  can_couriers := public.team_has_permission(_store_id, 'couriers');
  can_tracking := public.team_has_permission(_store_id, 'tracking');

  IF can_orders OR can_inventory OR can_checkout THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'category', COALESCE(p.category, ''),
      'cost', CASE WHEN can_finance THEN COALESCE(p.cost, 0) ELSE 0 END,
      'price', COALESCE(p.price, 0),
      'stock', COALESCE(p.stock, 0),
      'min_stock', COALESCE(p.min_stock, 0),
      'description', p.description,
      'image_url',
        CASE
          WHEN p.image_url IS NOT NULL AND p.image_url <> ''
            THEN '/api/public/product-image/' || p.id::text
          ELSE NULL
        END
    ) ORDER BY p.created_at DESC), '[]'::jsonb)
    INTO products_json
    FROM public.products p
    WHERE p.store_id = _store_id;
  END IF;

  IF can_orders THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'customer', o.customer,
      'phone', o.phone,
      'address', o.address,
      'district', o.district,
      'city', o.city,
      'items', COALESCE((
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
      ), '[]'::jsonb),
      'total', o.total,
      'payment', o.payment,
      'status', o.status,
      'notes', o.notes,
      'date', o.date
    ) ORDER BY o.date DESC), '[]'::jsonb)
    INTO orders_json
    FROM public.orders o
    WHERE o.store_id = _store_id;
  END IF;

  IF can_finance THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', e.id,
      'description', e.description,
      'category', e.category,
      'amount', e.amount,
      'date', e.date
    ) ORDER BY e.date DESC), '[]'::jsonb)
    INTO expenses_json
    FROM public.expenses e
    WHERE e.store_id = _store_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', sm.id,
      'product_id', sm.product_id,
      'product_name', sm.product_name,
      'purchase_order_id', sm.purchase_order_id,
      'type', sm.type,
      'quantity', sm.quantity,
      'unit_cost', sm.unit_cost,
      'total', sm.total,
      'supplier_name', sm.supplier_name,
      'payment_method', sm.payment_method,
      'notes', sm.notes,
      'occurred_at', sm.occurred_at,
      'created_at', sm.created_at
    ) ORDER BY sm.occurred_at DESC), '[]'::jsonb)
    INTO movements_json
    FROM public.stock_movements sm
    WHERE sm.store_id = _store_id;
  ELSIF can_inventory THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', sm.id,
      'product_id', sm.product_id,
      'product_name', sm.product_name,
      'purchase_order_id', sm.purchase_order_id,
      'type', sm.type,
      'quantity', sm.quantity,
      'unit_cost', 0,
      'total', 0,
      'supplier_name', sm.supplier_name,
      'payment_method', sm.payment_method,
      'notes', sm.notes,
      'occurred_at', sm.occurred_at,
      'created_at', sm.created_at
    ) ORDER BY sm.occurred_at DESC), '[]'::jsonb)
    INTO movements_json
    FROM public.stock_movements sm
    WHERE sm.store_id = _store_id;
  END IF;

  IF can_ads THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', a.id,
      'date', a.date,
      'invested', a.invested,
      'purchases', a.purchases,
      'revenue', a.revenue
    ) ORDER BY a.date ASC), '[]'::jsonb)
    INTO ads_json
    FROM public.ads a
    WHERE a.user_id = owner_id_value;
  END IF;

  IF can_checkout OR can_settings OR can_orders OR can_couriers OR can_tracking THEN
    SELECT * INTO s
    FROM public.settings
    WHERE store_id = _store_id
    LIMIT 1;

    IF s.store_id IS NOT NULL THEN
      settings_json :=
        (
          to_jsonb(s)
          - ARRAY[
            'fb_access_token','fb_ad_account_id','fb_last_sync_at','fb_last_sync_status',
            'fb_last_sync_error','fb_account_id','fb_ad_account_name','fb_currency',
            'fb_timezone_name','fb_connection_status',
            'monthly_revenue_goal','monthly_profit_goal','motoboy_fee','tax_pct',
            'card_fee_pct','platform_fee_pct','ads_tax_pct','other_fees_pct',
            'card_machine_fees','card_fee_mode',
            'motoboy_message_template','delivery_message_template',
            'customer_tracking_message_template',
            'checkout_logo_url','checkout_footer_cards_image_url'
          ]::text[]
        )
        || jsonb_build_object(
          'monthly_revenue_goal', CASE WHEN can_finance THEN COALESCE(s.monthly_revenue_goal,0) ELSE 0 END,
          'monthly_profit_goal', CASE WHEN can_finance THEN COALESCE(s.monthly_profit_goal,0) ELSE 0 END,
          'motoboy_fee', CASE WHEN can_finance THEN COALESCE(s.motoboy_fee,0) ELSE 0 END,
          'tax_pct', CASE WHEN can_finance THEN COALESCE(s.tax_pct,0) ELSE 0 END,
          'card_fee_pct', CASE WHEN can_finance THEN COALESCE(s.card_fee_pct,0) ELSE 0 END,
          'platform_fee_pct', CASE WHEN can_finance THEN COALESCE(s.platform_fee_pct,0) ELSE 0 END,
          'ads_tax_pct', CASE WHEN can_finance OR can_ads THEN COALESCE(s.ads_tax_pct,0) ELSE 0 END,
          'other_fees_pct', CASE WHEN can_finance THEN COALESCE(s.other_fees_pct,0) ELSE 0 END,
          'card_machine_fees', CASE WHEN can_finance THEN COALESCE(s.card_machine_fees,'{}'::jsonb) ELSE '{}'::jsonb END,
          'card_fee_mode', CASE WHEN can_finance THEN COALESCE(s.card_fee_mode,'passthrough') ELSE 'passthrough' END
        )
        || jsonb_build_object(
          'motoboy_message_template', CASE WHEN can_couriers THEN COALESCE(s.motoboy_message_template,'') ELSE '' END,
          'delivery_message_template', CASE WHEN can_couriers THEN COALESCE(s.delivery_message_template,'') ELSE '' END,
          'customer_tracking_message_template', CASE WHEN can_tracking THEN COALESCE(s.customer_tracking_message_template,'') ELSE '' END,
          'checkout_logo_url',
            CASE
              WHEN COALESCE(s.checkout_logo_url,'') <> '' AND COALESCE(s.slug,'') <> ''
                THEN '/api/public/store-asset/' || s.slug || '/logo'
              ELSE NULL
            END,
          'checkout_footer_cards_image_url',
            CASE
              WHEN COALESCE(s.checkout_footer_cards_image_url,'') <> '' AND COALESCE(s.slug,'') <> ''
                THEN '/api/public/store-asset/' || s.slug || '/cards'
              ELSE NULL
            END
        );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'access', access,
    'products', products_json,
    'orders', orders_json,
    'expenses', expenses_json,
    'ads', ads_json,
    'stock_movements', movements_json,
    'settings', settings_json
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.team_store_snapshot(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
