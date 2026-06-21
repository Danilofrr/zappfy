
-- Enum for delivery status
DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM (
    'preparando','aguardando_motoboy','saiu_para_entrega','chegando','entregue','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tracking table
CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  tracking_code text NOT NULL UNIQUE,
  courier_token text NOT NULL UNIQUE,
  courier_name text,
  courier_phone text,
  notes text,
  status public.delivery_status NOT NULL DEFAULT 'aguardando_motoboy',
  latitude double precision,
  longitude double precision,
  speed double precision,
  heading double precision,
  accuracy double precision,
  last_updated_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  estimated_arrival timestamptz,
  customer_view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_store ON public.delivery_tracking(store_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order ON public.delivery_tracking(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_tracking TO authenticated;
GRANT ALL ON public.delivery_tracking TO service_role;

ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage own tracking" ON public.delivery_tracking
  FOR ALL TO authenticated
  USING (store_id = auth.uid())
  WITH CHECK (store_id = auth.uid());

CREATE TRIGGER trg_delivery_tracking_updated_at
  BEFORE UPDATE ON public.delivery_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Settings table
CREATE TABLE IF NOT EXISTS public.delivery_tracking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE,
  logo_url text,
  primary_color text DEFAULT '#10b981',
  secondary_color text DEFAULT '#0b1220',
  background_color text DEFAULT '#0b1220',
  button_color text DEFAULT '#10b981',
  text_color text DEFAULT '#ffffff',
  tracking_page_title text DEFAULT 'Acompanhe sua entrega',
  tracking_page_subtitle text DEFAULT 'Veja em tempo real onde está seu pedido',
  welcome_message text DEFAULT 'Seu pedido está a caminho!',
  delivered_message text DEFAULT 'Pedido entregue com sucesso. Obrigado pela preferência!',
  support_whatsapp text,
  show_store_logo boolean NOT NULL DEFAULT true,
  show_courier_name boolean NOT NULL DEFAULT true,
  show_courier_phone boolean NOT NULL DEFAULT false,
  show_estimated_time boolean NOT NULL DEFAULT true,
  show_distance boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_tracking_settings TO authenticated;
GRANT ALL ON public.delivery_tracking_settings TO service_role;

ALTER TABLE public.delivery_tracking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage own tracking settings" ON public.delivery_tracking_settings
  FOR ALL TO authenticated
  USING (store_id = auth.uid())
  WITH CHECK (store_id = auth.uid());

CREATE TRIGGER trg_delivery_tracking_settings_updated_at
  BEFORE UPDATE ON public.delivery_tracking_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_tracking;

-- Public read function (for customer page)
CREATE OR REPLACE FUNCTION public.get_tracking_public(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.delivery_tracking;
  s public.delivery_tracking_settings;
  st public.settings;
  o public.orders;
  result jsonb;
BEGIN
  SELECT * INTO t FROM public.delivery_tracking WHERE tracking_code = _code LIMIT 1;
  IF t.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.delivery_tracking_settings WHERE store_id = t.store_id LIMIT 1;
  SELECT * INTO st FROM public.settings WHERE user_id = t.store_id LIMIT 1;
  SELECT * INTO o FROM public.orders WHERE id = t.order_id LIMIT 1;

  result := jsonb_build_object(
    'id', t.id,
    'tracking_code', t.tracking_code,
    'status', t.status,
    'latitude', t.latitude,
    'longitude', t.longitude,
    'speed', t.speed,
    'heading', t.heading,
    'accuracy', t.accuracy,
    'last_updated_at', t.last_updated_at,
    'started_at', t.started_at,
    'completed_at', t.completed_at,
    'estimated_arrival', t.estimated_arrival,
    'order', jsonb_build_object(
      'id', o.id,
      'customer', o.customer,
      'address', o.address,
      'district', o.district,
      'city', o.city,
      'total', o.total,
      'date', o.date
    ),
    'store', jsonb_build_object(
      'name', COALESCE(st.store_name, 'Loja'),
      'whatsapp', COALESCE(st.whatsapp, ''),
      'logo_url', COALESCE(s.logo_url, st.checkout_logo_url)
    ),
    'settings', jsonb_build_object(
      'primary_color', COALESCE(s.primary_color, '#10b981'),
      'secondary_color', COALESCE(s.secondary_color, '#0b1220'),
      'background_color', COALESCE(s.background_color, '#0b1220'),
      'button_color', COALESCE(s.button_color, '#10b981'),
      'text_color', COALESCE(s.text_color, '#ffffff'),
      'tracking_page_title', COALESCE(s.tracking_page_title, 'Acompanhe sua entrega'),
      'tracking_page_subtitle', COALESCE(s.tracking_page_subtitle, 'Veja em tempo real onde está seu pedido'),
      'welcome_message', COALESCE(s.welcome_message, 'Seu pedido está a caminho!'),
      'delivered_message', COALESCE(s.delivered_message, 'Pedido entregue com sucesso!'),
      'support_whatsapp', COALESCE(s.support_whatsapp, st.whatsapp, ''),
      'show_store_logo', COALESCE(s.show_store_logo, true),
      'show_courier_name', COALESCE(s.show_courier_name, true),
      'show_courier_phone', COALESCE(s.show_courier_phone, false),
      'show_estimated_time', COALESCE(s.show_estimated_time, true),
      'show_distance', COALESCE(s.show_distance, true)
    ),
    'courier', jsonb_build_object(
      'name', CASE WHEN COALESCE(s.show_courier_name, true) THEN t.courier_name ELSE NULL END,
      'phone', CASE WHEN COALESCE(s.show_courier_phone, false) THEN t.courier_phone ELSE NULL END
    )
  );
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tracking_public(text) TO anon, authenticated;

-- Public courier read (by token)
CREATE OR REPLACE FUNCTION public.get_courier_view(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.delivery_tracking;
  st public.settings;
  o public.orders;
BEGIN
  SELECT * INTO t FROM public.delivery_tracking WHERE courier_token = _token LIMIT 1;
  IF t.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO st FROM public.settings WHERE user_id = t.store_id LIMIT 1;
  SELECT * INTO o FROM public.orders WHERE id = t.order_id LIMIT 1;
  RETURN jsonb_build_object(
    'id', t.id,
    'tracking_code', t.tracking_code,
    'status', t.status,
    'courier_name', t.courier_name,
    'courier_phone', t.courier_phone,
    'notes', t.notes,
    'started_at', t.started_at,
    'completed_at', t.completed_at,
    'order', jsonb_build_object(
      'id', o.id,
      'customer', o.customer,
      'phone', o.phone,
      'address', o.address,
      'district', o.district,
      'city', o.city,
      'total', o.total,
      'notes', o.notes,
      'date', o.date
    ),
    'store', jsonb_build_object(
      'name', COALESCE(st.store_name, 'Loja'),
      'whatsapp', COALESCE(st.whatsapp, ''),
      'logo_url', st.checkout_logo_url
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_courier_view(text) TO anon, authenticated;

-- Public courier location update
CREATE OR REPLACE FUNCTION public.update_courier_location(
  _token text, _lat double precision, _lng double precision,
  _speed double precision DEFAULT NULL, _heading double precision DEFAULT NULL,
  _accuracy double precision DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.delivery_tracking;
BEGIN
  SELECT * INTO t FROM public.delivery_tracking WHERE courier_token = _token LIMIT 1;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Rastreamento não encontrado'; END IF;
  IF t.status IN ('entregue','cancelado') THEN RETURN false; END IF;
  UPDATE public.delivery_tracking
    SET latitude = _lat, longitude = _lng, speed = _speed, heading = _heading,
        accuracy = _accuracy, last_updated_at = now()
    WHERE id = t.id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_courier_location(text, double precision, double precision, double precision, double precision, double precision) TO anon, authenticated;

-- Public courier status update
CREATE OR REPLACE FUNCTION public.update_courier_status(_token text, _status text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.delivery_tracking;
  new_status public.delivery_status;
BEGIN
  SELECT * INTO t FROM public.delivery_tracking WHERE courier_token = _token LIMIT 1;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Rastreamento não encontrado'; END IF;
  IF t.status IN ('entregue','cancelado') THEN RETURN false; END IF;
  IF _status NOT IN ('saiu_para_entrega','chegando','entregue') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  new_status := _status::public.delivery_status;
  UPDATE public.delivery_tracking
    SET status = new_status,
        started_at = COALESCE(started_at, CASE WHEN new_status='saiu_para_entrega' THEN now() ELSE NULL END),
        completed_at = CASE WHEN new_status='entregue' THEN now() ELSE completed_at END
    WHERE id = t.id;
  -- mirror status to orders
  IF new_status = 'entregue' THEN
    UPDATE public.orders SET status = 'entregue' WHERE id = t.order_id;
  ELSIF new_status = 'saiu_para_entrega' THEN
    UPDATE public.orders SET status = 'entregue' WHERE id = t.order_id AND status NOT IN ('entregue','cancelado');
  END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_courier_status(text, text) TO anon, authenticated;

-- View counter
CREATE OR REPLACE FUNCTION public.increment_tracking_view(_code text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.delivery_tracking SET customer_view_count = customer_view_count + 1
    WHERE tracking_code = _code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_tracking_view(text) TO anon, authenticated;
