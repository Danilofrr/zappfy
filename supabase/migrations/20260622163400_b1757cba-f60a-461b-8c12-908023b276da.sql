CREATE OR REPLACE FUNCTION public.courier_create_session(_courier_id uuid, _token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.couriers;
BEGIN
  SELECT * INTO c FROM public.couriers WHERE id = _courier_id LIMIT 1;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Motoboy não encontrado'; END IF;
  IF NOT c.active THEN RAISE EXCEPTION 'Acesso desativado. Fale com a loja.'; END IF;
  IF COALESCE(trim(_token),'') = '' THEN RAISE EXCEPTION 'Token inválido'; END IF;
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
$function$;

DROP FUNCTION IF EXISTS public.courier_create_session(uuid);