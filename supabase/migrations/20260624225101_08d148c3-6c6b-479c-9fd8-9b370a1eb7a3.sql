-- Secure courier login: server-side password verification, no hash exposure.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- New all-in-one login RPC: verifies bcrypt hash on the server and issues a session.
CREATE OR REPLACE FUNCTION public.courier_login(_slug text, _phone text, _password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store uuid;
  c public.couriers;
  _token text;
BEGIN
  IF COALESCE(trim(_slug), '') = '' OR COALESCE(trim(_phone), '') = '' OR COALESCE(_password, '') = '' THEN
    RAISE EXCEPTION 'Credenciais inválidas';
  END IF;

  SELECT user_id INTO _store FROM public.settings
    WHERE lower(slug) = lower(trim(_slug)) LIMIT 1;
  IF _store IS NULL THEN
    -- Generic message to avoid revealing whether the store exists
    RAISE EXCEPTION 'WhatsApp ou senha inválidos';
  END IF;

  SELECT * INTO c FROM public.couriers
    WHERE store_id = _store AND phone = trim(_phone) LIMIT 1;

  -- Constant-ish failure: same error whether courier missing or password wrong
  IF c.id IS NULL OR COALESCE(c.password_hash, '') = ''
     OR crypt(_password, c.password_hash) <> c.password_hash THEN
    RAISE EXCEPTION 'WhatsApp ou senha inválidos';
  END IF;

  IF NOT c.active THEN
    RAISE EXCEPTION 'Acesso desativado. Fale com a loja.';
  END IF;

  _token := encode(gen_random_bytes(32), 'hex') || '-' || extract(epoch from now())::bigint::text;

  INSERT INTO public.courier_sessions (token, courier_id) VALUES (_token, c.id);
  UPDATE public.couriers SET last_login_at = now() WHERE id = c.id;

  RETURN jsonb_build_object(
    'session_token', _token,
    'courier_id', c.id,
    'name', c.name,
    'phone', c.phone,
    'store_id', c.store_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.courier_login(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.courier_login(text, text, text) TO anon, authenticated;

-- Remove the legacy hash-leaking lookup function entirely.
DROP FUNCTION IF EXISTS public.courier_lookup_for_login(text, text);

-- Tighten the arbitrary-id session creator: keep it for backward compat but
-- restrict EXECUTE so only the service role (server admin) can call it. The
-- public login flow now goes through courier_login() instead.
REVOKE EXECUTE ON FUNCTION public.courier_create_session(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.courier_create_session(uuid, text) TO service_role;