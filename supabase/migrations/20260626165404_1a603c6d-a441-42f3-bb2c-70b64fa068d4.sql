
-- Fase 3: settings per store
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS store_id uuid;
UPDATE public.settings SET store_id = user_id WHERE store_id IS NULL;
-- Ensure every store referenced exists (defaults created by handle_new_user)
INSERT INTO public.stores (id, owner_id, name, is_default)
SELECT s.user_id, s.user_id, COALESCE(NULLIF(s.store_name,''),'Minha Loja'), true
FROM public.settings s
LEFT JOIN public.stores st ON st.id = s.user_id
WHERE st.id IS NULL
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.settings ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE public.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (store_id);
ALTER TABLE public.settings
  ADD CONSTRAINT settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS settings_user_id_idx ON public.settings(user_id);

-- RLS
DROP POLICY IF EXISTS "own settings all" ON public.settings;
CREATE POLICY "own settings all" ON public.settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.user_owns_store(store_id))
  WITH CHECK (auth.uid() = user_id AND public.user_owns_store(store_id));

-- Auto-create settings + tracking defaults whenever a new store is created
CREATE OR REPLACE FUNCTION public.create_default_settings_for_store()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.settings (store_id, user_id, store_name)
  VALUES (NEW.id, NEW.owner_id, COALESCE(NEW.name, 'Minha Loja'))
  ON CONFLICT (store_id) DO NOTHING;
  PERFORM public.apply_tracking_default_for_user(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_settings_for_new_store ON public.stores;
CREATE TRIGGER trg_settings_for_new_store
  AFTER INSERT ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.create_default_settings_for_store();

-- handle_new_user: stores first, settings created by trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cliente') ON CONFLICT DO NOTHING;
  INSERT INTO public.stores (id, owner_id, name, is_default)
  VALUES (NEW.id, NEW.id, COALESCE(NEW.raw_user_meta_data->>'store_name','Minha Loja'), true)
  ON CONFLICT (id) DO NOTHING;
  -- settings + tracking defaults are inserted by trg_settings_for_new_store
  RETURN NEW;
END;
$$;

-- Update functions to look up settings by store_id
CREATE OR REPLACE FUNCTION public.get_store_by_slug(_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.settings;
BEGIN
  SELECT * INTO s FROM public.settings WHERE lower(slug)=lower(trim(_slug)) LIMIT 1;
  IF s.store_id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('store_id', s.store_id, 'store_name', COALESCE(s.store_name,'Loja'), 'slug', s.slug);
END;$$;

CREATE OR REPLACE FUNCTION public.courier_me(_session text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.couriers; st public.settings;
BEGIN
  c := public._resolve_courier_session(_session);
  SELECT * INTO st FROM public.settings WHERE store_id = c.store_id LIMIT 1;
  RETURN jsonb_build_object('courier_id',c.id,'name',c.name,'phone',c.phone,
    'vehicle_type',c.vehicle_type,'plate',c.plate,
    'store_id',c.store_id,'store_name',COALESCE(st.store_name,'Loja'),'slug',st.slug);
END;$$;

CREATE OR REPLACE FUNCTION public.list_available_deliveries(_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _store uuid;
BEGIN
  SELECT store_id INTO _store FROM public.settings WHERE lower(slug)=lower(trim(_slug)) LIMIT 1;
  IF _store IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'tracking_code',t.tracking_code,'status',t.status,'created_at',t.created_at,'notes',t.notes,
      'order', jsonb_build_object('id',o.id,'customer',o.customer,'phone',o.phone,'address',o.address,
        'district',o.district,'city',o.city,'total',o.total,'date',o.date,'notes',o.notes)
    ) ORDER BY t.created_at ASC)
    FROM public.delivery_tracking t JOIN public.orders o ON o.id=t.order_id
    WHERE t.store_id=_store AND t.status='aguardando_motoboy' AND t.courier_name IS NULL
  ), '[]'::jsonb);
END;$$;

CREATE OR REPLACE FUNCTION public.accept_delivery(_slug text, _code text, _name text, _phone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _store uuid; t public.delivery_tracking;
BEGIN
  IF COALESCE(trim(_name),'')='' THEN RAISE EXCEPTION 'Informe seu nome'; END IF;
  SELECT store_id INTO _store FROM public.settings WHERE lower(slug)=lower(trim(_slug)) LIMIT 1;
  IF _store IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;
  SELECT * INTO t FROM public.delivery_tracking WHERE tracking_code=_code AND store_id=_store LIMIT 1;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Entrega não encontrada'; END IF;
  IF t.courier_name IS NOT NULL THEN RAISE EXCEPTION 'Esta entrega já foi aceita'; END IF;
  IF t.status NOT IN ('aguardando_motoboy','preparando') THEN RAISE EXCEPTION 'Esta entrega não está disponível'; END IF;
  UPDATE public.delivery_tracking SET courier_name=trim(_name), courier_phone=NULLIF(trim(COALESCE(_phone,'')),'') WHERE id=t.id;
  RETURN jsonb_build_object('courier_token',t.courier_token,'tracking_code',t.tracking_code);
END;$$;

CREATE OR REPLACE FUNCTION public.courier_login(_slug text, _phone text, _password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _store uuid; c public.couriers; _token text; _phone_trim text;
BEGIN
  IF COALESCE(trim(_slug),'')='' OR COALESCE(trim(_phone),'')='' OR COALESCE(_password,'')='' THEN
    RAISE EXCEPTION 'Credenciais inválidas';
  END IF;
  _phone_trim := trim(_phone);
  SELECT store_id INTO _store FROM public.settings WHERE lower(slug)=lower(trim(_slug)) LIMIT 1;
  IF _store IS NULL THEN
    INSERT INTO public.access_logs (event, metadata)
      VALUES ('courier_login_failed', jsonb_build_object('slug',_slug,'reason','store_not_found'));
    RAISE EXCEPTION 'WhatsApp ou senha inválidos';
  END IF;
  SELECT * INTO c FROM public.couriers WHERE store_id=_store AND phone=_phone_trim LIMIT 1;
  IF c.id IS NULL OR COALESCE(c.password_hash,'')='' OR crypt(_password,c.password_hash)<>c.password_hash THEN
    INSERT INTO public.access_logs (event,user_id,metadata)
      VALUES ('courier_login_failed',_store,jsonb_build_object('slug',_slug,'phone',_phone_trim,
        'reason',CASE WHEN c.id IS NULL THEN 'unknown_phone' ELSE 'wrong_password' END));
    RAISE EXCEPTION 'WhatsApp ou senha inválidos';
  END IF;
  IF NOT c.active THEN
    INSERT INTO public.access_logs (event,user_id,metadata)
      VALUES ('courier_login_disabled',_store,jsonb_build_object('slug',_slug,'courier_id',c.id));
    RAISE EXCEPTION 'Acesso desativado. Fale com a loja.';
  END IF;
  _token := encode(gen_random_bytes(32),'hex')||'-'||extract(epoch from now())::bigint::text;
  INSERT INTO public.courier_sessions (token,courier_id) VALUES (_token,c.id);
  UPDATE public.couriers SET last_login_at=now() WHERE id=c.id;
  INSERT INTO public.access_logs (event,user_id,metadata)
    VALUES ('courier_login',_store,jsonb_build_object('slug',_slug,'courier_id',c.id,'courier_name',c.name));
  RETURN jsonb_build_object('session_token',_token,'courier_id',c.id,'name',c.name,'phone',c.phone,'store_id',c.store_id);
END;$$;

CREATE OR REPLACE FUNCTION public.get_tracking_public(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.delivery_tracking; s public.delivery_tracking_settings;
  st public.settings; o public.orders; enriched_items jsonb; result jsonb;
BEGIN
  SELECT * INTO t FROM public.delivery_tracking WHERE tracking_code=_code LIMIT 1;
  IF t.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.delivery_tracking_settings WHERE store_id=t.store_id LIMIT 1;
  SELECT * INTO st FROM public.settings WHERE store_id=t.store_id LIMIT 1;
  SELECT * INTO o FROM public.orders WHERE id=t.order_id LIMIT 1;

  SELECT COALESCE(jsonb_agg(
    CASE WHEN p.image_url IS NOT NULL THEN item || jsonb_build_object('image_url',p.image_url) ELSE item END
  ), '[]'::jsonb)
  INTO enriched_items
  FROM jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) AS item
  LEFT JOIN public.products p
    ON p.store_id = t.store_id
   AND (item->>'productId')::uuid IS NOT DISTINCT FROM p.id;

  result := jsonb_build_object(
    'id',t.id,'order_id',t.order_id,'tracking_code',t.tracking_code,'status',t.status,
    'order_status',o.status,'latitude',t.latitude,'longitude',t.longitude,
    'delivery_latitude',t.delivery_latitude,'delivery_longitude',t.delivery_longitude,
    'delivery_geocoded_address',t.delivery_geocoded_address,'delivery_geocoding_status',t.delivery_geocoding_status,
    'speed',t.speed,'heading',t.heading,'accuracy',t.accuracy,'last_updated_at',t.last_updated_at,
    'started_at',t.started_at,'completed_at',t.completed_at,'estimated_arrival',t.estimated_arrival,
    'order', jsonb_build_object('id',o.id,'customer',o.customer,'address',o.address,'district',o.district,
      'city',o.city,'total',o.total,'status',o.status,'date',o.date,'notes',o.notes,
      'items',COALESCE(enriched_items,o.items,'[]'::jsonb)),
    'store', jsonb_build_object('name',COALESCE(st.store_name,'Loja'),'whatsapp',COALESCE(st.whatsapp,''),
      'logo_url',COALESCE(s.logo_url,st.checkout_logo_url)),
    'settings', jsonb_build_object(
      'primary_color',COALESCE(s.primary_color,'#10b981'),'secondary_color',COALESCE(s.secondary_color,'#0b1220'),
      'background_color',COALESCE(s.background_color,'#0b1220'),'button_color',COALESCE(s.button_color,'#10b981'),
      'text_color',COALESCE(s.text_color,'#ffffff'),'title_color',COALESCE(s.title_color,s.text_color,'#ffffff'),
      'card_color',COALESCE(s.card_color,s.secondary_color,'#0b1220'),'card_border_color',COALESCE(s.card_border_color,'#1e293b'),
      'card_opacity',COALESCE(s.card_opacity,1),'card_glass',COALESCE(s.card_glass,false),
      'card_shadow',COALESCE(s.card_shadow,'md'),'card_shadow_color',COALESCE(s.card_shadow_color,'#000000'),
      'card_radius',COALESCE(s.card_radius,16),'border_intensity',COALESCE(s.border_intensity,1),
      'status_color',COALESCE(s.status_color,s.primary_color,'#10b981'),'status_styles',COALESCE(s.status_styles,'{}'::jsonb),
      'timeline_color',COALESCE(s.timeline_color,s.primary_color,'#10b981'),'header_style',COALESCE(s.header_style,'solid'),
      'header_color',COALESCE(s.header_color,s.primary_color,'#dc2626'),'header_height',COALESCE(s.header_height,100),
      'header_logo_size',COALESCE(s.header_logo_size,56),'header_logo_align',COALESCE(s.header_logo_align,'center'),
      'tracking_page_title',COALESCE(s.tracking_page_title,'Acompanhe sua entrega'),
      'tracking_page_subtitle',COALESCE(s.tracking_page_subtitle,'Veja em tempo real onde está seu pedido'),
      'welcome_message',COALESCE(s.welcome_message,'Seu pedido está a caminho!'),
      'delivered_message',COALESCE(s.delivered_message,'Pedido entregue com sucesso!'),
      'support_whatsapp',COALESCE(s.support_whatsapp,st.whatsapp,''),
      'show_store_logo',COALESCE(s.show_store_logo,true),'show_courier_name',COALESCE(s.show_courier_name,true),
      'show_courier_phone',COALESCE(s.show_courier_phone,false),'show_estimated_time',COALESCE(s.show_estimated_time,true),
      'show_distance',COALESCE(s.show_distance,true),'show_products',COALESCE(s.show_products,true),
      'show_product_price',COALESCE(s.show_product_price,true),
      'vehicle_type',COALESCE(s.vehicle_type,'moto'),'vehicle_color',COALESCE(s.vehicle_color,'verde'),
      'vehicle_custom_url',s.vehicle_custom_url,'pin_color',COALESCE(s.pin_color,'verde'),
      'pin_custom_url',s.pin_custom_url,
      'msg_aguardando',COALESCE(s.msg_aguardando,'Recebemos seu pedido e já estamos preparando tudo.'),
      'msg_preparando',COALESCE(s.msg_preparando,'Seu pedido está sendo preparado com carinho.'),
      'msg_saiu',COALESCE(s.msg_saiu,'Seu pedido já saiu para entrega e está a caminho.'),
      'msg_chegando',COALESCE(s.msg_chegando,'Seu entregador está próximo do destino.'),
      'msg_entregue',COALESCE(s.msg_entregue,'Pedido entregue com sucesso. Obrigado pela preferência.'),
      'msg_cancelado',COALESCE(s.msg_cancelado,'Este pedido foi cancelado.')
    ),
    'courier', jsonb_build_object(
      'name',CASE WHEN COALESCE(s.show_courier_name,true) THEN t.courier_name ELSE NULL END,
      'phone',CASE WHEN COALESCE(s.show_courier_phone,false) THEN t.courier_phone ELSE NULL END
    )
  );
  RETURN result;
END;$$;

CREATE OR REPLACE FUNCTION public.get_courier_view(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.delivery_tracking; s public.delivery_tracking_settings;
  st public.settings; o public.orders; inherit boolean;
BEGIN
  SELECT * INTO t FROM public.delivery_tracking WHERE courier_token=_token LIMIT 1;
  IF t.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.delivery_tracking_settings WHERE store_id=t.store_id LIMIT 1;
  SELECT * INTO st FROM public.settings WHERE store_id=t.store_id LIMIT 1;
  SELECT * INTO o FROM public.orders WHERE id=t.order_id LIMIT 1;
  inherit := COALESCE(s.courier_inherit_client,true);
  RETURN jsonb_build_object(
    'id',t.id,'tracking_code',t.tracking_code,'status',t.status,
    'courier_name',t.courier_name,'courier_phone',t.courier_phone,'notes',t.notes,
    'started_at',t.started_at,'completed_at',t.completed_at,
    'order',jsonb_build_object('id',o.id,'customer',o.customer,'phone',o.phone,'address',o.address,
      'district',o.district,'city',o.city,'total',o.total,'notes',o.notes,'date',o.date),
    'store',jsonb_build_object('name',COALESCE(st.store_name,'Loja'),'whatsapp',COALESCE(st.whatsapp,''),
      'logo_url',CASE WHEN inherit THEN COALESCE(s.logo_url,st.checkout_logo_url)
        ELSE COALESCE(s.courier_logo_url,s.logo_url,st.checkout_logo_url) END),
    'settings',jsonb_build_object(
      'inherit_client',inherit,
      'primary_color',CASE WHEN inherit THEN COALESCE(s.primary_color,'#10b981') ELSE COALESCE(s.courier_primary_color,s.primary_color,'#10b981') END,
      'secondary_color',CASE WHEN inherit THEN COALESCE(s.secondary_color,'#0b1220') ELSE COALESCE(s.courier_secondary_color,s.secondary_color,'#0b1220') END,
      'header_style',CASE WHEN inherit THEN COALESCE(s.header_style,'solid') ELSE COALESCE(s.courier_header_style,s.header_style,'solid') END,
      'header_color',CASE WHEN inherit THEN COALESCE(s.header_color,s.primary_color,'#10b981') ELSE COALESCE(s.courier_header_color,s.header_color,s.primary_color,'#10b981') END,
      'header_height',CASE WHEN inherit THEN COALESCE(s.header_height,110) ELSE COALESCE(s.courier_header_height,s.header_height,110) END,
      'header_logo_size',CASE WHEN inherit THEN COALESCE(s.header_logo_size,56) ELSE COALESCE(s.courier_header_logo_size,s.header_logo_size,56) END,
      'header_logo_align',CASE WHEN inherit THEN COALESCE(s.header_logo_align,'center') ELSE COALESCE(s.courier_header_logo_align,s.header_logo_align,'center') END,
      'background_color',CASE WHEN inherit THEN COALESCE(s.background_color,'#0b1220') ELSE COALESCE(s.courier_background_color,s.background_color,'#0b1220') END,
      'card_color',CASE WHEN inherit THEN COALESCE(s.card_color,'#0f172a') ELSE COALESCE(s.courier_card_color,s.card_color,'#0f172a') END,
      'card_border_color',CASE WHEN inherit THEN COALESCE(s.card_border_color,'#1e293b') ELSE COALESCE(s.courier_card_border_color,s.card_border_color,'#1e293b') END,
      'card_shadow_color',CASE WHEN inherit THEN COALESCE(s.card_shadow_color,'#000000') ELSE COALESCE(s.courier_card_shadow_color,s.card_shadow_color,'#000000') END,
      'text_color',CASE WHEN inherit THEN COALESCE(s.text_color,'#ffffff') ELSE COALESCE(s.courier_text_color,s.text_color,'#ffffff') END,
      'title_color',CASE WHEN inherit THEN COALESCE(s.title_color,s.text_color,'#ffffff') ELSE COALESCE(s.courier_title_color,s.title_color,'#ffffff') END,
      'button_color',CASE WHEN inherit THEN COALESCE(s.button_color,'#10b981') ELSE COALESCE(s.courier_button_color,s.button_color,'#10b981') END,
      'icon_color',CASE WHEN inherit THEN COALESCE(s.primary_color,'#10b981') ELSE COALESCE(s.courier_icon_color,s.primary_color,'#10b981') END,
      'footer_text',COALESCE(s.courier_footer_text,'Powered by Zappfy')
    )
  );
END;$$;

CREATE OR REPLACE FUNCTION public.submit_public_order(
  _slug text,_customer text,_phone text,_cep text,_address text,_reference text,
  _district text,_city text,_product_id uuid,_quantity integer,_unit_price numeric,
  _shipping_value numeric,_total numeric,_payment text,_notes text DEFAULT '',
  _cpf text DEFAULT '',_email text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _store_id uuid; _owner_id uuid;
  _product record; _items jsonb; _order_id uuid;
  _safe_quantity integer; _safe_unit_price numeric; _safe_shipping_value numeric;
  _safe_total numeric; _safe_cost numeric;
  _combined_notes text; _clean_notes text; _clean_cpf text; _clean_email text;
BEGIN
  _safe_quantity := COALESCE(_quantity,0);
  _safe_unit_price := COALESCE(_unit_price,0);
  _safe_shipping_value := COALESCE(_shipping_value,0);
  _safe_total := COALESCE(_total,0);
  _clean_notes := COALESCE(_notes,'');
  _clean_cpf := trim(COALESCE(_cpf,''));
  _clean_email := trim(COALESCE(_email,''));

  IF COALESCE(trim(_slug),'')='' THEN RAISE EXCEPTION 'Loja não informada'; END IF;
  IF COALESCE(trim(_customer),'')='' THEN RAISE EXCEPTION 'Nome do cliente não preenchido'; END IF;
  IF COALESCE(trim(_phone),'')='' THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF COALESCE(trim(_address),'')='' THEN RAISE EXCEPTION 'Endereço não preenchido'; END IF;
  IF _safe_quantity<1 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF _safe_unit_price<0 THEN RAISE EXCEPTION 'Valor unitário inválido'; END IF;
  IF _safe_shipping_value<0 THEN RAISE EXCEPTION 'Valor de entrega inválido'; END IF;
  IF _safe_total<=0 THEN RAISE EXCEPTION 'Valor total inválido'; END IF;
  IF _payment NOT IN ('pix','cartao','dinheiro') THEN RAISE EXCEPTION 'Forma de pagamento não selecionada'; END IF;

  SELECT s.store_id, s.user_id INTO _store_id, _owner_id
  FROM public.settings s WHERE lower(s.slug)=lower(trim(_slug)) LIMIT 1;
  IF _store_id IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;

  SELECT p.id,p.name,p.price,p.cost,p.stock INTO _product
  FROM public.products p WHERE p.id=_product_id AND p.store_id=_store_id FOR UPDATE LIMIT 1;
  IF _product.id IS NULL THEN RAISE EXCEPTION 'Produto inválido'; END IF;
  IF COALESCE(_product.stock,0)<_safe_quantity THEN RAISE EXCEPTION 'Estoque insuficiente'; END IF;

  _safe_unit_price := COALESCE(_product.price,_safe_unit_price,0);
  _safe_cost := COALESCE(_product.cost,_safe_unit_price,0);
  _safe_total := round(((_safe_unit_price*_safe_quantity)+_safe_shipping_value)::numeric,2);

  _items := jsonb_build_array(jsonb_build_object(
    'productId',_product.id,'name',_product.name,'qty',_safe_quantity,'price',_safe_unit_price,'cost',_safe_cost,
    'cep',COALESCE(_cep,''),'reference',COALESCE(_reference,''),'shipping',_safe_shipping_value,
    'cpf',_clean_cpf,'email',_clean_email
  ));

  _combined_notes := NULLIF(concat_ws(E'\n',
    CASE WHEN _clean_cpf<>'' AND _clean_notes !~* '^\s*\*?\s*(CPF|CPF/CNPJ)(\s+do\s+cliente)?\s*\*?\s*:' THEN 'CPF: '||_clean_cpf ELSE NULL END,
    CASE WHEN _clean_email<>'' AND _clean_notes !~* '^\s*\*?\s*E-?mail(\s+do\s+cliente)?\s*\*?\s*:' THEN 'E-mail: '||_clean_email ELSE NULL END,
    NULLIF(_clean_notes,''),
    NULLIF('CEP: '||COALESCE(_cep,''),'CEP: '),
    NULLIF('Ponto de referência: '||COALESCE(_reference,''),'Ponto de referência: ')
  ),'');

  INSERT INTO public.orders (user_id, store_id, customer, phone, address, district, city, items, total, payment, status, notes, date)
  VALUES (_owner_id, _store_id, trim(_customer), trim(_phone), COALESCE(trim(_address),''),
    COALESCE(trim(_district),''), COALESCE(trim(_city),''),
    _items, _safe_total, _payment, 'aguardando', _combined_notes, now())
  RETURNING id INTO _order_id;

  UPDATE public.products SET stock=GREATEST(COALESCE(stock,0)-_safe_quantity,0)
  WHERE id=_product.id AND store_id=_store_id;

  RETURN _order_id;
END;$$;

CREATE OR REPLACE FUNCTION public.admin_list_clients()
RETURNS TABLE(id uuid, email text, full_name text, store_name text, whatsapp text,
  created_at timestamp with time zone, last_sign_in_at timestamp with time zone,
  roles text[], sub_status text, sub_expires_at timestamp with time zone,
  sub_started_at timestamp with time zone, plan_id uuid, plan_name text, price_monthly numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email::text, COALESCE(p.full_name,'')::text,
    COALESCE(s.store_name,'')::text, COALESCE(s.whatsapp,'')::text,
    u.created_at, u.last_sign_in_at,
    COALESCE((SELECT array_agg(r.role::text) FROM public.user_roles r WHERE r.user_id=u.id), ARRAY[]::text[]),
    sub.status::text, sub.expires_at, sub.started_at, sub.plan_id, pl.name::text, pl.price_monthly
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id=u.id
  LEFT JOIN public.settings s ON s.store_id=u.id
  LEFT JOIN public.subscriptions sub ON sub.user_id=u.id
  LEFT JOIN public.plans pl ON pl.id=sub.plan_id
  WHERE public.has_role(auth.uid(),'admin')
  ORDER BY u.created_at DESC;
$$;
