
CREATE TABLE IF NOT EXISTS public.zappfy_central_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text,
  header_color text NOT NULL DEFAULT '#0f172a',
  header_text_color text NOT NULL DEFAULT '#ffffff',
  background_color text NOT NULL DEFAULT '#0b1220',
  card_color text NOT NULL DEFAULT '#0f172a',
  card_border_color text NOT NULL DEFAULT '#1e293b',
  card_shadow_color text NOT NULL DEFAULT '#000000',
  card_radius integer NOT NULL DEFAULT 16,
  text_color text NOT NULL DEFAULT '#e5e7eb',
  title_color text NOT NULL DEFAULT '#ffffff',
  button_color text NOT NULL DEFAULT '#10b981',
  button_text_color text NOT NULL DEFAULT '#ffffff',
  icon_color text NOT NULL DEFAULT '#10b981',
  footer_text text NOT NULL DEFAULT 'Powered by Zappfy',
  brand_name text NOT NULL DEFAULT 'Entregas Zappfy',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.zappfy_central_settings TO anon, authenticated;
GRANT ALL ON public.zappfy_central_settings TO service_role;

ALTER TABLE public.zappfy_central_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "central_settings_select" ON public.zappfy_central_settings;
CREATE POLICY "central_settings_select" ON public.zappfy_central_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "central_settings_admin_write" ON public.zappfy_central_settings;
CREATE POLICY "central_settings_admin_write" ON public.zappfy_central_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS set_zappfy_central_settings_updated_at ON public.zappfy_central_settings;
CREATE TRIGGER set_zappfy_central_settings_updated_at
  BEFORE UPDATE ON public.zappfy_central_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.zappfy_central_settings (header_color)
SELECT '#0f172a'
WHERE NOT EXISTS (SELECT 1 FROM public.zappfy_central_settings);

CREATE OR REPLACE FUNCTION public.get_zappfy_central_settings()
RETURNS public.zappfy_central_settings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.zappfy_central_settings ORDER BY created_at ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_store_by_slug(_slug text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.settings;
BEGIN
  SELECT * INTO s FROM public.settings WHERE lower(slug) = lower(trim(_slug)) LIMIT 1;
  IF s.user_id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'store_id', s.user_id,
    'store_name', COALESCE(s.store_name, 'Loja'),
    'slug', s.slug
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_available_deliveries(_slug text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _store uuid;
BEGIN
  SELECT user_id INTO _store FROM public.settings WHERE lower(slug) = lower(trim(_slug)) LIMIT 1;
  IF _store IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'tracking_code', t.tracking_code,
      'status', t.status,
      'created_at', t.created_at,
      'notes', t.notes,
      'order', jsonb_build_object(
        'id', o.id,
        'customer', o.customer,
        'phone', o.phone,
        'address', o.address,
        'district', o.district,
        'city', o.city,
        'total', o.total,
        'date', o.date,
        'notes', o.notes
      )
    ) ORDER BY t.created_at ASC)
    FROM public.delivery_tracking t
    JOIN public.orders o ON o.id = t.order_id
    WHERE t.store_id = _store
      AND t.status = 'aguardando_motoboy'
      AND t.courier_name IS NULL
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_delivery(_slug text, _code text, _name text, _phone text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _store uuid;
  t public.delivery_tracking;
BEGIN
  IF COALESCE(trim(_name), '') = '' THEN RAISE EXCEPTION 'Informe seu nome'; END IF;
  SELECT user_id INTO _store FROM public.settings WHERE lower(slug) = lower(trim(_slug)) LIMIT 1;
  IF _store IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;
  SELECT * INTO t FROM public.delivery_tracking WHERE tracking_code = _code AND store_id = _store LIMIT 1;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Entrega não encontrada'; END IF;
  IF t.courier_name IS NOT NULL THEN RAISE EXCEPTION 'Esta entrega já foi aceita'; END IF;
  IF t.status NOT IN ('aguardando_motoboy', 'preparando') THEN
    RAISE EXCEPTION 'Esta entrega não está disponível';
  END IF;
  UPDATE public.delivery_tracking
    SET courier_name = trim(_name),
        courier_phone = NULLIF(trim(COALESCE(_phone, '')), '')
    WHERE id = t.id;
  RETURN jsonb_build_object('courier_token', t.courier_token, 'tracking_code', t.tracking_code);
END;
$$;
