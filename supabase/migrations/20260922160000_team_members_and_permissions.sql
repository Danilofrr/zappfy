-- Equipe Zappfy: funcionários por loja com permissões granulares.
-- O dono continua com acesso total. Funcionários recebem apenas módulos explicitamente liberados.

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  member_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'employee',
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, member_user_id)
);

CREATE INDEX IF NOT EXISTS team_members_member_user_id_idx ON public.team_members(member_user_id);
CREATE INDEX IF NOT EXISTS team_members_store_id_idx ON public.team_members(store_id);
CREATE INDEX IF NOT EXISTS team_members_owner_id_idx ON public.team_members(owner_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage team members" ON public.team_members;
CREATE POLICY "Owners manage team members"
ON public.team_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = team_members.store_id
      AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = team_members.store_id
      AND s.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members view own membership" ON public.team_members;
CREATE POLICY "Members view own membership"
ON public.team_members
FOR SELECT
TO authenticated
USING (member_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.team_can_access_store(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = _store_id AND s.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.store_id = _store_id
          AND tm.member_user_id = auth.uid()
          AND tm.active = true
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.team_has_permission(_store_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = _store_id AND s.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.store_id = _store_id
          AND tm.member_user_id = auth.uid()
          AND tm.active = true
          AND _permission = ANY(tm.permissions)
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.list_my_accessible_stores()
RETURNS TABLE (
  id uuid,
  owner_id uuid,
  name text,
  slug text,
  is_default boolean,
  created_at timestamptz,
  updated_at timestamptz,
  is_owner boolean,
  permissions text[],
  member_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.owner_id,
    s.name,
    s.slug,
    s.is_default,
    s.created_at,
    s.updated_at,
    true,
    ARRAY[
      'dashboard','orders','tracking','inventory','returns','couriers',
      'reports','finance','ads','checkout','integrations','settings','team','subscription'
    ]::text[],
    'owner'::text
  FROM public.stores s
  WHERE s.owner_id = auth.uid()

  UNION ALL

  SELECT
    s.id,
    s.owner_id,
    s.name,
    s.slug,
    s.is_default,
    s.created_at,
    s.updated_at,
    false,
    tm.permissions,
    tm.role
  FROM public.team_members tm
  JOIN public.stores s ON s.id = tm.store_id
  WHERE tm.member_user_id = auth.uid()
    AND tm.active = true
    AND s.owner_id <> auth.uid()

  ORDER BY is_owner DESC, is_default DESC, created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_my_store_access(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.stores;
  tm public.team_members;
BEGIN
  SELECT * INTO s FROM public.stores WHERE id = _store_id LIMIT 1;
  IF s.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF s.owner_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'store_id', s.id,
      'owner_id', s.owner_id,
      'is_owner', true,
      'role', 'owner',
      'permissions', ARRAY[
        'dashboard','orders','tracking','inventory','returns','couriers',
        'reports','finance','ads','checkout','integrations','settings','team','subscription'
      ]::text[]
    );
  END IF;

  SELECT * INTO tm
  FROM public.team_members
  WHERE store_id = _store_id
    AND member_user_id = auth.uid()
    AND active = true
  LIMIT 1;

  IF tm.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'store_id', s.id,
    'owner_id', s.owner_id,
    'is_owner', false,
    'role', tm.role,
    'permissions', tm.permissions,
    'member_id', tm.id,
    'name', tm.name,
    'email', tm.email
  );
END;
$$;

-- Snapshot seguro: funcionário nunca recebe custos dos itens/produtos sem ser dono.
CREATE OR REPLACE FUNCTION public.team_store_snapshot(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  access jsonb;
  owner_id_value uuid;
  can_orders boolean;
  can_inventory boolean;
  can_finance boolean;
  can_ads boolean;
  can_checkout boolean;
  can_settings boolean;
  products_json jsonb := '[]'::jsonb;
  orders_json jsonb := '[]'::jsonb;
  expenses_json jsonb := '[]'::jsonb;
  ads_json jsonb := '[]'::jsonb;
  movements_json jsonb := '[]'::jsonb;
  settings_json jsonb := NULL;
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
      'image_url', p.image_url
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
          (item - 'cost') || jsonb_build_object('cost', CASE WHEN can_finance THEN COALESCE((item->>'cost')::numeric, 0) ELSE 0 END)
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
    SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.date DESC), '[]'::jsonb)
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
    SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.date ASC), '[]'::jsonb)
    INTO ads_json
    FROM public.ads a
    WHERE a.user_id = owner_id_value;
  END IF;

  IF can_checkout OR can_settings OR can_orders THEN
    SELECT jsonb_build_object(
      'user_id', s.user_id,
      'store_id', s.store_id,
      'store_name', s.store_name,
      'whatsapp', s.whatsapp,
      'pix_key', s.pix_key,
      'address', s.address,
      'delivery_fee', s.delivery_fee,
      'monthly_revenue_goal', CASE WHEN can_finance THEN s.monthly_revenue_goal ELSE 0 END,
      'monthly_profit_goal', CASE WHEN can_finance THEN s.monthly_profit_goal ELSE 0 END,
      'checkout_logo_url', s.checkout_logo_url,
      'checkout_bg_color', s.checkout_bg_color,
      'checkout_theme', s.checkout_theme,
      'checkout_text_color', s.checkout_text_color,
      'checkout_card_color', s.checkout_card_color,
      'checkout_neon_color', s.checkout_neon_color,
      'delivery_label', s.delivery_label,
      'checkout_button_label', s.checkout_button_label,
      'checkout_button_color', s.checkout_button_color,
      'checkout_header_bg_color', s.checkout_header_bg_color,
      'checkout_secure_label', s.checkout_secure_label,
      'checkout_step1_button_label', s.checkout_step1_button_label,
      'checkout_step2_button_label', s.checkout_step2_button_label,
      'checkout_step3_button_label', s.checkout_step3_button_label,
      'checkout_step_button_color', s.checkout_step_button_color,
      'checkout_step_button_text_color', s.checkout_step_button_text_color,
      'shipping_options', s.shipping_options,
      'checkout_footer_enabled', s.checkout_footer_enabled,
      'checkout_footer_brand', s.checkout_footer_brand,
      'checkout_footer_copyright', s.checkout_footer_copyright,
      'checkout_footer_email', s.checkout_footer_email,
      'checkout_footer_payments', s.checkout_footer_payments,
      'checkout_secure_color', s.checkout_secure_color,
      'checkout_logo_size', s.checkout_logo_size,
      'checkout_footer_bg_color', s.checkout_footer_bg_color,
      'checkout_logo_align', s.checkout_logo_align,
      'checkout_step1_title', s.checkout_step1_title,
      'checkout_step2_title', s.checkout_step2_title,
      'checkout_step3_title', s.checkout_step3_title,
      'checkout_footer_cards_image_url', s.checkout_footer_cards_image_url,
      'checkout_footer_show_cards_image', s.checkout_footer_show_cards_image,
      'checkout_footer_cards_image_height', s.checkout_footer_cards_image_height,
      'checkout_footer_whatsapp', s.checkout_footer_whatsapp,
      'checkout_footer_cnpj', s.checkout_footer_cnpj,
      'checkout_footer_show_cnpj', s.checkout_footer_show_cnpj,
      'checkout_footer_show_email', s.checkout_footer_show_email,
      'checkout_footer_show_whatsapp', s.checkout_footer_show_whatsapp,
      'motoboy_message_template', CASE WHEN public.team_has_permission(_store_id,'couriers') THEN s.motoboy_message_template ELSE '' END,
      'delivery_message_template', CASE WHEN public.team_has_permission(_store_id,'couriers') THEN s.delivery_message_template ELSE '' END,
      'customer_tracking_message_template', CASE WHEN public.team_has_permission(_store_id,'tracking') THEN s.customer_tracking_message_template ELSE '' END,
      'motoboy_fee', CASE WHEN can_finance THEN s.motoboy_fee ELSE 0 END,
      'tax_pct', CASE WHEN can_finance THEN s.tax_pct ELSE 0 END,
      'card_fee_pct', CASE WHEN can_finance THEN s.card_fee_pct ELSE 0 END,
      'platform_fee_pct', CASE WHEN can_finance THEN s.platform_fee_pct ELSE 0 END,
      'ads_tax_pct', CASE WHEN can_finance OR can_ads THEN s.ads_tax_pct ELSE 0 END,
      'other_fees_pct', CASE WHEN can_finance THEN s.other_fees_pct ELSE 0 END,
      'card_machine_fees', CASE WHEN can_finance THEN s.card_machine_fees ELSE '{}'::jsonb END,
      'card_fee_mode', CASE WHEN can_finance THEN s.card_fee_mode ELSE 'passthrough' END,
      'slug', s.slug
    )
    INTO settings_json
    FROM public.settings s
    WHERE s.store_id = _store_id
    LIMIT 1;
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
$$;

-- A infraestrutura de motoboys já usa _can_manage_store.
-- Para funcionário, essa função só é ampliada quando a permissão "couriers" foi concedida.
CREATE OR REPLACE FUNCTION public._can_manage_store(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      auth.uid() = _store_id
      OR public.user_owns_store(_store_id)
      OR public.team_has_permission(_store_id, 'couriers')
    );
$$;

-- Permite leitura/atualização da operação logística para quem recebeu "couriers".
DROP POLICY IF EXISTS "Team couriers can view tracking" ON public.delivery_tracking;
CREATE POLICY "Team couriers can view tracking"
ON public.delivery_tracking
FOR SELECT TO authenticated
USING (public.team_has_permission(store_id, 'couriers'));

DROP POLICY IF EXISTS "Team couriers can update tracking" ON public.delivery_tracking;
CREATE POLICY "Team couriers can update tracking"
ON public.delivery_tracking
FOR UPDATE TO authenticated
USING (public.team_has_permission(store_id, 'couriers'))
WITH CHECK (public.team_has_permission(store_id, 'couriers'));

-- Comprovantes podem ser visualizados por funcionário com Pedidos.
DROP POLICY IF EXISTS "Team orders can view receipts" ON public.order_receipts;
CREATE POLICY "Team orders can view receipts"
ON public.order_receipts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_receipts.order_id
      AND public.team_has_permission(o.store_id, 'orders')
  )
);

GRANT EXECUTE ON FUNCTION public.team_can_access_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_has_permission(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_accessible_stores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_store_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_store_snapshot(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
