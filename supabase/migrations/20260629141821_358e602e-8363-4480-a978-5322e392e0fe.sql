CREATE OR REPLACE FUNCTION public.courier_login(_slug text, _phone text, _password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _store uuid;
  c public.couriers;
  _token text;
  _phone_trim text;
  _phone_digits text;
  _stored_hash text;
BEGIN
  IF COALESCE(trim(_slug),'')='' OR COALESCE(trim(_phone),'')='' OR COALESCE(_password,'')='' THEN
    RAISE EXCEPTION 'Credenciais inválidas';
  END IF;

  _phone_trim := trim(_phone);
  _phone_digits := regexp_replace(_phone_trim, '\D', '', 'g');

  SELECT store_id INTO _store
  FROM public.settings
  WHERE lower(slug)=lower(trim(_slug))
  LIMIT 1;

  IF _store IS NULL THEN
    INSERT INTO public.access_logs (event, metadata)
      VALUES ('courier_login_failed', jsonb_build_object('slug',_slug,'reason','store_not_found'));
    RAISE EXCEPTION 'WhatsApp ou senha inválidos';
  END IF;

  SELECT * INTO c
  FROM public.couriers
  WHERE store_id = _store
    AND (
      trim(phone) = _phone_trim
      OR regexp_replace(COALESCE(phone,''), '\D', '', 'g') = _phone_digits
    )
  ORDER BY created_at DESC
  LIMIT 1;

  _stored_hash := replace(COALESCE(c.password_hash,''), '$2b$', '$2a$');

  IF c.id IS NULL OR _stored_hash = '' OR extensions.crypt(_password, _stored_hash) <> _stored_hash THEN
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
END;
$function$;