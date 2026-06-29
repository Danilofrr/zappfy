CREATE OR REPLACE FUNCTION public.normalize_courier_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN length(regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')) IN (10, 11)
      THEN '55' || regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
    ELSE regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
  END;
$function$;

CREATE OR REPLACE FUNCTION public.courier_phone_without_ddi(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN left(public.normalize_courier_phone(_phone), 2) = '55' AND length(public.normalize_courier_phone(_phone)) > 11
      THEN substr(public.normalize_courier_phone(_phone), 3)
    ELSE public.normalize_courier_phone(_phone)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.courier_phone_matches(_stored_phone text, _input_phone text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT public.normalize_courier_phone(_stored_phone) = public.normalize_courier_phone(_input_phone)
      OR public.courier_phone_without_ddi(_stored_phone) = public.courier_phone_without_ddi(_input_phone);
$function$;

CREATE OR REPLACE FUNCTION public._can_manage_store(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (auth.uid() = _store_id OR public.user_owns_store(_store_id));
$function$;

DROP POLICY IF EXISTS "Owners manage couriers of their stores" ON public.couriers;
CREATE POLICY "Owners can view couriers without password hashes"
ON public.couriers
FOR SELECT
TO authenticated
USING (public._can_manage_store(store_id));

CREATE POLICY "Owners can create couriers of their stores"
ON public.couriers
FOR INSERT
TO authenticated
WITH CHECK (public._can_manage_store(store_id));

CREATE POLICY "Owners can update couriers of their stores"
ON public.couriers
FOR UPDATE
TO authenticated
USING (public._can_manage_store(store_id))
WITH CHECK (public._can_manage_store(store_id));

CREATE POLICY "Owners can delete couriers of their stores"
ON public.couriers
FOR DELETE
TO authenticated
USING (public._can_manage_store(store_id));

REVOKE ALL ON public.couriers FROM anon;
REVOKE ALL ON public.couriers FROM authenticated;
GRANT SELECT (id, store_id, name, phone, vehicle_type, plate, active, last_login_at, created_at, updated_at) ON public.couriers TO authenticated;
GRANT INSERT (store_id, name, phone, password_hash, vehicle_type, plate, active) ON public.couriers TO authenticated;
GRANT UPDATE (name, phone, password_hash, vehicle_type, plate, active, updated_at) ON public.couriers TO authenticated;
GRANT DELETE ON public.couriers TO authenticated;
GRANT ALL ON public.couriers TO service_role;

CREATE OR REPLACE FUNCTION public.list_couriers_for_store(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id,
      'store_id', c.store_id,
      'name', c.name,
      'phone', c.phone,
      'vehicle_type', c.vehicle_type,
      'plate', c.plate,
      'active', c.active,
      'last_login_at', c.last_login_at,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    ) ORDER BY c.created_at DESC)
    FROM public.couriers c
    WHERE c.store_id = _store_id
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_courier_for_store(
  _store_id uuid,
  _name text,
  _phone text,
  _password text,
  _vehicle text DEFAULT 'moto'::text,
  _plate text DEFAULT NULL::text,
  _active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
  _normalized_phone text;
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF COALESCE(trim(_name),'') = '' THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  _normalized_phone := public.normalize_courier_phone(_phone);
  IF length(_normalized_phone) < 10 THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF COALESCE(_password,'') = '' OR length(_password) < 6 THEN RAISE EXCEPTION 'Senha do motoboy deve ter ao menos 6 caracteres'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.couriers existing
    WHERE existing.store_id = _store_id
      AND public.courier_phone_matches(existing.phone, _normalized_phone)
  ) THEN
    RAISE EXCEPTION 'Já existe um motoboy com este WhatsApp nesta loja';
  END IF;

  INSERT INTO public.couriers (store_id, name, phone, password_hash, vehicle_type, plate, active)
  VALUES (
    _store_id,
    trim(_name),
    _normalized_phone,
    extensions.crypt(_password, extensions.gen_salt('bf', 10)),
    COALESCE(NULLIF(trim(COALESCE(_vehicle,'')),''), 'moto'),
    NULLIF(trim(COALESCE(_plate,'')),''),
    COALESCE(_active, true)
  )
  RETURNING * INTO c;

  RETURN jsonb_build_object(
    'id', c.id, 'store_id', c.store_id, 'name', c.name, 'phone', c.phone,
    'vehicle_type', c.vehicle_type, 'plate', c.plate, 'active', c.active,
    'last_login_at', c.last_login_at, 'created_at', c.created_at, 'updated_at', c.updated_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_courier_for_store(
  _id uuid,
  _store_id uuid,
  _name text,
  _phone text,
  _vehicle text,
  _plate text,
  _active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
  _normalized_phone text;
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF COALESCE(trim(_name),'') = '' THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  _normalized_phone := public.normalize_courier_phone(_phone);
  IF length(_normalized_phone) < 10 THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.couriers existing
    WHERE existing.store_id = _store_id
      AND existing.id <> _id
      AND public.courier_phone_matches(existing.phone, _normalized_phone)
  ) THEN
    RAISE EXCEPTION 'Já existe um motoboy com este WhatsApp nesta loja';
  END IF;

  UPDATE public.couriers
  SET name = trim(_name),
      phone = _normalized_phone,
      vehicle_type = COALESCE(NULLIF(trim(COALESCE(_vehicle,'')),''), 'moto'),
      plate = NULLIF(trim(COALESCE(_plate,'')),''),
      active = COALESCE(_active, true),
      updated_at = now()
  WHERE id = _id AND store_id = _store_id
  RETURNING * INTO c;

  IF c.id IS NULL THEN RAISE EXCEPTION 'Motoboy não encontrado'; END IF;

  RETURN jsonb_build_object(
    'id', c.id, 'store_id', c.store_id, 'name', c.name, 'phone', c.phone,
    'vehicle_type', c.vehicle_type, 'plate', c.plate, 'active', c.active,
    'last_login_at', c.last_login_at, 'created_at', c.created_at, 'updated_at', c.updated_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_courier_password_for_store(_id uuid, _store_id uuid, _password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF COALESCE(_password,'') = '' OR length(_password) < 6 THEN RAISE EXCEPTION 'Senha do motoboy deve ter ao menos 6 caracteres'; END IF;

  UPDATE public.couriers
  SET password_hash = extensions.crypt(_password, extensions.gen_salt('bf', 10)), updated_at = now()
  WHERE id = _id AND store_id = _store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motoboy não encontrado'; END IF;

  DELETE FROM public.courier_sessions WHERE courier_id = _id;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_courier_for_store(_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  DELETE FROM public.courier_sessions WHERE courier_id = _id;
  DELETE FROM public.couriers WHERE id = _id AND store_id = _store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motoboy não encontrado'; END IF;
  RETURN true;
END;
$function$;

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
  _phone_normalized text;
  _stored_hash text;
  _password_matches boolean := false;
  _legacy_plaintext boolean := false;
  _debug jsonb;
BEGIN
  _phone_normalized := public.normalize_courier_phone(_phone);

  SELECT store_id INTO _store
  FROM public.settings
  WHERE lower(slug) = lower(trim(COALESCE(_slug,'')))
  LIMIT 1;

  IF _store IS NULL THEN
    _debug := jsonb_build_object(
      'input_phone_normalized', _phone_normalized,
      'matched_phone', null,
      'store_id', null,
      'courier_found', false,
      'password_match', false,
      'active', null,
      'belongs_to_store', false
    );
    INSERT INTO public.access_logs (event, metadata) VALUES ('courier_login_failed', _debug || jsonb_build_object('slug', _slug, 'reason', 'store_not_found'));
    RETURN jsonb_build_object('ok', false, 'error', 'Loja não encontrada', 'debug', _debug);
  END IF;

  SELECT * INTO c
  FROM public.couriers
  WHERE store_id = _store
    AND public.courier_phone_matches(phone, _phone_normalized)
  ORDER BY created_at DESC
  LIMIT 1;

  IF c.id IS NULL THEN
    SELECT * INTO other_c
    FROM public.couriers
    WHERE public.courier_phone_matches(phone, _phone_normalized)
    ORDER BY created_at DESC
    LIMIT 1;

    _debug := jsonb_build_object(
      'input_phone_normalized', _phone_normalized,
      'matched_phone', other_c.phone,
      'store_id', _store,
      'courier_found', other_c.id IS NOT NULL,
      'password_match', false,
      'active', other_c.active,
      'belongs_to_store', false
    );
    INSERT INTO public.access_logs (event, user_id, metadata)
    VALUES ('courier_login_failed', _store, _debug || jsonb_build_object('slug', _slug, 'reason', CASE WHEN other_c.id IS NULL THEN 'unknown_phone' ELSE 'wrong_store' END));

    RETURN jsonb_build_object(
      'ok', false,
      'error', CASE WHEN other_c.id IS NULL THEN 'Motoboy não encontrado' ELSE 'Motoboy não pertence a esta loja' END,
      'debug', _debug
    );
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

  _debug := jsonb_build_object(
    'input_phone_normalized', _phone_normalized,
    'matched_phone', c.phone,
    'store_id', _store,
    'courier_found', true,
    'password_match', _password_matches,
    'active', c.active,
    'belongs_to_store', true
  );

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

  _token := encode(gen_random_bytes(32), 'hex') || '-' || extract(epoch from now())::bigint::text;
  INSERT INTO public.courier_sessions (token, courier_id) VALUES (_token, c.id);
  UPDATE public.couriers SET last_login_at = now() WHERE id = c.id;
  INSERT INTO public.access_logs (event, user_id, metadata)
  VALUES ('courier_login', _store, _debug || jsonb_build_object('slug', _slug, 'courier_id', c.id, 'courier_name', c.name));

  RETURN jsonb_build_object(
    'ok', true,
    'session_token', _token,
    'courier_id', c.id,
    'name', c.name,
    'phone', c.phone,
    'store_id', c.store_id,
    'debug', _debug
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_courier_phone(text) FROM public;
REVOKE ALL ON FUNCTION public.courier_phone_without_ddi(text) FROM public;
REVOKE ALL ON FUNCTION public.courier_phone_matches(text, text) FROM public;
REVOKE ALL ON FUNCTION public._can_manage_store(uuid) FROM public;
REVOKE ALL ON FUNCTION public.list_couriers_for_store(uuid) FROM public;
REVOKE ALL ON FUNCTION public.create_courier_for_store(uuid, text, text, text, text, text, boolean) FROM public;
REVOKE ALL ON FUNCTION public.update_courier_for_store(uuid, uuid, text, text, text, text, boolean) FROM public;
REVOKE ALL ON FUNCTION public.reset_courier_password_for_store(uuid, uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.delete_courier_for_store(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.courier_login(text, text, text) FROM public;

GRANT EXECUTE ON FUNCTION public.normalize_courier_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_phone_without_ddi(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_phone_matches(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._can_manage_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_couriers_for_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_courier_for_store(uuid, text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_courier_for_store(uuid, uuid, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_courier_password_for_store(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_courier_for_store(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.courier_login(text, text, text) TO anon, authenticated;