CREATE OR REPLACE FUNCTION public.courier_login(_slug text, _phone text, _password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _store uuid;
  c public.couriers;
  other_c public.couriers;
  _token text;
  _stored_hash text;
  _password_matches boolean := false;
  _legacy_plaintext boolean := false;
  _phone_normalized text;
  _debug jsonb;
BEGIN
  _phone_normalized := public.normalize_courier_phone(_phone);

  SELECT store_id INTO _store FROM public.settings
    WHERE lower(slug) = lower(trim(COALESCE(_slug,''))) LIMIT 1;

  IF _store IS NULL THEN
    _debug := jsonb_build_object('input_phone_normalized', _phone_normalized,'matched_phone', null,'store_id', null,'courier_found', false,'password_match', false,'active', null,'belongs_to_store', false);
    INSERT INTO public.access_logs (event, metadata) VALUES ('courier_login_failed', _debug || jsonb_build_object('slug', _slug, 'reason', 'store_not_found'));
    RETURN jsonb_build_object('ok', false, 'error', 'Loja não encontrada', 'debug', _debug);
  END IF;

  SELECT * INTO c FROM public.couriers
    WHERE store_id = _store AND public.courier_phone_matches(phone, _phone_normalized)
    ORDER BY created_at DESC LIMIT 1;

  IF c.id IS NULL THEN
    SELECT * INTO other_c FROM public.couriers
      WHERE public.courier_phone_matches(phone, _phone_normalized)
      ORDER BY created_at DESC LIMIT 1;
    _debug := jsonb_build_object('input_phone_normalized', _phone_normalized,'matched_phone', other_c.phone,'store_id', _store,'courier_found', other_c.id IS NOT NULL,'password_match', false,'active', other_c.active,'belongs_to_store', false);
    INSERT INTO public.access_logs (event, user_id, metadata)
    VALUES ('courier_login_failed', _store, _debug || jsonb_build_object('slug', _slug, 'reason', CASE WHEN other_c.id IS NULL THEN 'unknown_phone' ELSE 'wrong_store' END));
    RETURN jsonb_build_object('ok', false,'error', CASE WHEN other_c.id IS NULL THEN 'Motoboy não encontrado' ELSE 'Motoboy não pertence a esta loja' END,'debug', _debug);
  END IF;

  IF COALESCE(c.password_hash, '') <> '' THEN
    IF c.password_hash LIKE '$2%' THEN
      _stored_hash := replace(c.password_hash, '$2b$', '$2a$');
      _password_matches := extensions.crypt(_password, _stored_hash) = _stored_hash;
    ELSE
      _legacy_plaintext := c.password_hash = COALESCE(_password, '');
      _password_matches := _legacy_plaintext;
    END IF;
  END IF;

  _debug := jsonb_build_object('input_phone_normalized', _phone_normalized,'matched_phone', c.phone,'store_id', _store,'courier_found', true,'password_match', _password_matches,'active', c.active,'belongs_to_store', true);

  IF NOT c.active THEN
    INSERT INTO public.access_logs (event, user_id, metadata)
    VALUES ('courier_login_disabled', _store, _debug || jsonb_build_object('slug', _slug, 'courier_id', c.id));
    RETURN jsonb_build_object('ok', false, 'error', 'Motoboy desativado', 'debug', _debug);
  END IF;

  IF NOT _password_matches THEN
    INSERT INTO public.access_logs (event, user_id, metadata)
    VALUES ('courier_login_failed', _store, _debug || jsonb_build_object('slug', _slug, 'courier_id', c.id, 'reason', 'wrong_password'));
    RETURN jsonb_build_object('ok', false, 'error', 'Senha incorreta', 'debug', _debug);
  END IF;

  IF _legacy_plaintext THEN
    UPDATE public.couriers
    SET password_hash = extensions.crypt(_password, extensions.gen_salt('bf', 10)), updated_at = now()
    WHERE id = c.id;
  END IF;

  -- FIX: use extensions.gen_random_bytes (pgcrypto lives in the extensions schema)
  _token := encode(extensions.gen_random_bytes(32), 'hex') || '-' || extract(epoch from now())::bigint::text;
  INSERT INTO public.courier_sessions (token, courier_id) VALUES (_token, c.id);
  UPDATE public.couriers SET last_login_at = now() WHERE id = c.id;
  INSERT INTO public.access_logs (event, user_id, metadata)
  VALUES ('courier_login', _store, _debug || jsonb_build_object('slug', _slug, 'courier_id', c.id, 'courier_name', c.name));

  RETURN jsonb_build_object('ok', true,'session_token', _token,'courier_id', c.id,'name', c.name,'phone', c.phone,'store_id', c.store_id,'debug', _debug);
END;
$function$;