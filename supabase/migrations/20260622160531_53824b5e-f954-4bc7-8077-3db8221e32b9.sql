
DROP FUNCTION IF EXISTS public.create_courier(text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.reset_courier_password(uuid, text);
DROP FUNCTION IF EXISTS public.courier_login(text, text, text);

CREATE FUNCTION public.create_courier(
  _name text, _phone text, _password_hash text,
  _vehicle text DEFAULT 'moto', _plate text DEFAULT NULL, _active boolean DEFAULT true
) RETURNS public.couriers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.couriers;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF COALESCE(trim(_name),'')='' THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF COALESCE(trim(_phone),'')='' THEN RAISE EXCEPTION 'WhatsApp obrigatório'; END IF;
  IF COALESCE(_password_hash,'') = '' THEN RAISE EXCEPTION 'Senha obrigatória'; END IF;
  INSERT INTO public.couriers (store_id, name, phone, password_hash, vehicle_type, plate, active)
    VALUES (auth.uid(), trim(_name), trim(_phone), _password_hash,
            COALESCE(_vehicle,'moto'),
            NULLIF(trim(COALESCE(_plate,'')),''),
            COALESCE(_active,true))
    RETURNING * INTO c;
  RETURN c;
END;$$;

CREATE FUNCTION public.reset_courier_password(_id uuid, _password_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF COALESCE(_password_hash,'') = '' THEN RAISE EXCEPTION 'Senha obrigatória'; END IF;
  UPDATE public.couriers SET password_hash = _password_hash
    WHERE id = _id AND store_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Motoboy não encontrado'; END IF;
  DELETE FROM public.courier_sessions WHERE courier_id = _id;
  RETURN true;
END;$$;

CREATE OR REPLACE FUNCTION public.courier_lookup_for_login(_slug text, _phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _store uuid;
  c public.couriers;
BEGIN
  SELECT user_id INTO _store FROM public.settings WHERE lower(slug)=lower(trim(_slug)) LIMIT 1;
  IF _store IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO c FROM public.couriers
    WHERE store_id = _store AND phone = trim(_phone) LIMIT 1;
  IF c.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'courier_id', c.id, 'name', c.name, 'phone', c.phone,
    'password_hash', c.password_hash, 'active', c.active, 'store_id', _store
  );
END;$$;

CREATE OR REPLACE FUNCTION public.courier_create_session(_courier_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.couriers;
  _token text;
BEGIN
  SELECT * INTO c FROM public.couriers WHERE id = _courier_id LIMIT 1;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Motoboy não encontrado'; END IF;
  IF NOT c.active THEN RAISE EXCEPTION 'Acesso desativado. Fale com a loja.'; END IF;
  _token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.courier_sessions (token, courier_id) VALUES (_token, c.id);
  UPDATE public.couriers SET last_login_at = now() WHERE id = c.id;
  RETURN jsonb_build_object(
    'session_token', _token,
    'courier_id', c.id,
    'name', c.name,
    'phone', c.phone,
    'store_id', c.store_id
  );
END;$$;

GRANT EXECUTE ON FUNCTION public.courier_lookup_for_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_create_session(uuid) TO anon, authenticated;
