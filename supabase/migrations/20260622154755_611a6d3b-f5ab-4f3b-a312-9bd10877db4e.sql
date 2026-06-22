
-- pgcrypto for bcrypt password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Couriers table (per-store)
CREATE TABLE IF NOT EXISTS public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  password_hash text NOT NULL,
  vehicle_type text DEFAULT 'moto',
  plate text,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, phone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.couriers TO authenticated;
GRANT ALL ON public.couriers TO service_role;

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store owner manages own couriers"
  ON public.couriers FOR ALL
  TO authenticated
  USING (auth.uid() = store_id)
  WITH CHECK (auth.uid() = store_id);

CREATE TRIGGER couriers_set_updated_at
  BEFORE UPDATE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Session tokens
CREATE TABLE IF NOT EXISTS public.courier_sessions (
  token text PRIMARY KEY,
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.courier_sessions TO service_role;
ALTER TABLE public.courier_sessions ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: only accessed via SECURITY DEFINER RPCs.

-- Tracking: link courier + accepted_at
ALTER TABLE public.delivery_tracking
  ADD COLUMN IF NOT EXISTS courier_id uuid,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- ============ RPCs ============

-- Lojista: criar motoboy (com hash de senha)
CREATE OR REPLACE FUNCTION public.create_courier(
  _name text, _phone text, _password text,
  _vehicle text DEFAULT 'moto', _plate text DEFAULT NULL, _active boolean DEFAULT true
) RETURNS public.couriers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.couriers;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF COALESCE(trim(_name),'')='' THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF COALESCE(trim(_phone),'')='' THEN RAISE EXCEPTION 'WhatsApp obrigatório'; END IF;
  IF length(COALESCE(_password,'')) < 4 THEN RAISE EXCEPTION 'Senha deve ter no mínimo 4 caracteres'; END IF;
  INSERT INTO public.couriers (store_id, name, phone, password_hash, vehicle_type, plate, active)
    VALUES (auth.uid(), trim(_name), trim(_phone), crypt(_password, gen_salt('bf')), COALESCE(_vehicle,'moto'), NULLIF(trim(COALESCE(_plate,'')),''), COALESCE(_active,true))
    RETURNING * INTO c;
  RETURN c;
END;$$;

CREATE OR REPLACE FUNCTION public.update_courier(
  _id uuid, _name text, _phone text, _vehicle text, _plate text, _active boolean
) RETURNS public.couriers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.couriers;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  UPDATE public.couriers SET
    name = COALESCE(NULLIF(trim(_name),''), name),
    phone = COALESCE(NULLIF(trim(_phone),''), phone),
    vehicle_type = COALESCE(_vehicle, vehicle_type),
    plate = NULLIF(trim(COALESCE(_plate,'')),''),
    active = COALESCE(_active, active)
  WHERE id = _id AND store_id = auth.uid()
  RETURNING * INTO c;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Motoboy não encontrado'; END IF;
  RETURN c;
END;$$;

CREATE OR REPLACE FUNCTION public.reset_courier_password(_id uuid, _password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF length(COALESCE(_password,'')) < 4 THEN RAISE EXCEPTION 'Senha deve ter no mínimo 4 caracteres'; END IF;
  UPDATE public.couriers SET password_hash = crypt(_password, gen_salt('bf'))
    WHERE id = _id AND store_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Motoboy não encontrado'; END IF;
  -- revoga sessões
  DELETE FROM public.courier_sessions WHERE courier_id = _id;
  RETURN true;
END;$$;

CREATE OR REPLACE FUNCTION public.delete_courier(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  DELETE FROM public.couriers WHERE id = _id AND store_id = auth.uid();
  RETURN true;
END;$$;

-- Público: login do motoboy
CREATE OR REPLACE FUNCTION public.courier_login(_slug text, _phone text, _password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _store uuid;
  c public.couriers;
  _token text;
BEGIN
  SELECT user_id INTO _store FROM public.settings WHERE lower(slug)=lower(trim(_slug)) LIMIT 1;
  IF _store IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;
  SELECT * INTO c FROM public.couriers
    WHERE store_id = _store AND phone = trim(_phone) LIMIT 1;
  IF c.id IS NULL OR c.password_hash <> crypt(_password, c.password_hash) THEN
    RAISE EXCEPTION 'WhatsApp ou senha incorretos';
  END IF;
  IF NOT c.active THEN
    RAISE EXCEPTION 'Acesso desativado. Fale com a loja.';
  END IF;
  _token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.courier_sessions (token, courier_id) VALUES (_token, c.id);
  UPDATE public.couriers SET last_login_at = now() WHERE id = c.id;
  RETURN jsonb_build_object(
    'session_token', _token,
    'courier_id', c.id,
    'name', c.name,
    'phone', c.phone,
    'store_id', _store
  );
END;$$;

CREATE OR REPLACE FUNCTION public.courier_logout(_session text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.courier_sessions WHERE token = _session;
  SELECT true;
$$;

-- Resolve sessão → motoboy (helper interno)
CREATE OR REPLACE FUNCTION public._resolve_courier_session(_session text)
RETURNS public.couriers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.couriers;
BEGIN
  SELECT cu.* INTO c FROM public.courier_sessions s
    JOIN public.couriers cu ON cu.id = s.courier_id
    WHERE s.token = _session AND s.expires_at > now() LIMIT 1;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Sessão inválida ou expirada'; END IF;
  IF NOT c.active THEN RAISE EXCEPTION 'Acesso desativado. Fale com a loja.'; END IF;
  RETURN c;
END;$$;

CREATE OR REPLACE FUNCTION public.courier_me(_session text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.couriers;
  st public.settings;
BEGIN
  c := public._resolve_courier_session(_session);
  SELECT * INTO st FROM public.settings WHERE user_id = c.store_id LIMIT 1;
  RETURN jsonb_build_object(
    'courier_id', c.id, 'name', c.name, 'phone', c.phone,
    'vehicle_type', c.vehicle_type, 'plate', c.plate,
    'store_id', c.store_id, 'store_name', COALESCE(st.store_name,'Loja'), 'slug', st.slug
  );
END;$$;

-- Entregas disponíveis para o motoboy logado
CREATE OR REPLACE FUNCTION public.list_available_deliveries_v2(_session text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.couriers;
BEGIN
  c := public._resolve_courier_session(_session);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'tracking_code', t.tracking_code, 'status', t.status,
      'created_at', t.created_at, 'notes', t.notes,
      'order', jsonb_build_object(
        'id', o.id,'customer',o.customer,'phone',o.phone,'address',o.address,
        'district',o.district,'city',o.city,'total',o.total,'date',o.date,'notes',o.notes
      )
    ) ORDER BY t.created_at ASC)
    FROM public.delivery_tracking t JOIN public.orders o ON o.id = t.order_id
    WHERE t.store_id = c.store_id
      AND t.status = 'aguardando_motoboy'
      AND t.courier_id IS NULL
  ), '[]'::jsonb);
END;$$;

-- Entregas em andamento do motoboy logado
CREATE OR REPLACE FUNCTION public.list_my_active_deliveries(_session text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.couriers;
BEGIN
  c := public._resolve_courier_session(_session);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'tracking_code', t.tracking_code, 'courier_token', t.courier_token,
      'status', t.status, 'accepted_at', t.accepted_at,
      'order', jsonb_build_object('id',o.id,'customer',o.customer,'address',o.address)
    ) ORDER BY t.accepted_at DESC NULLS LAST)
    FROM public.delivery_tracking t JOIN public.orders o ON o.id = t.order_id
    WHERE t.courier_id = c.id AND t.status NOT IN ('entregue','cancelado')
  ), '[]'::jsonb);
END;$$;

-- Aceitar entrega usando sessão (sem pedir nome/whatsapp)
CREATE OR REPLACE FUNCTION public.accept_delivery_v2(_session text, _code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.couriers;
  t public.delivery_tracking;
BEGIN
  c := public._resolve_courier_session(_session);
  SELECT * INTO t FROM public.delivery_tracking
    WHERE tracking_code = _code AND store_id = c.store_id LIMIT 1;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Entrega não encontrada'; END IF;
  IF t.courier_id IS NOT NULL AND t.courier_id <> c.id THEN
    RAISE EXCEPTION 'Esta entrega já foi aceita por outro motoboy';
  END IF;
  IF t.status NOT IN ('aguardando_motoboy','preparando') AND t.courier_id IS NULL THEN
    RAISE EXCEPTION 'Esta entrega não está disponível';
  END IF;
  UPDATE public.delivery_tracking
    SET courier_id = c.id, courier_name = c.name, courier_phone = c.phone,
        accepted_at = COALESCE(accepted_at, now())
    WHERE id = t.id;
  RETURN jsonb_build_object('courier_token', t.courier_token, 'tracking_code', t.tracking_code);
END;$$;
