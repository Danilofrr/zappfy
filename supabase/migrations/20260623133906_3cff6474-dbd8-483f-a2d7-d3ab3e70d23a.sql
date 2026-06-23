
-- Trial invites
CREATE TABLE public.trial_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  label text DEFAULT '',
  trial_days int NOT NULL DEFAULT 7,
  status text NOT NULL DEFAULT 'active',
  signups_count int NOT NULL DEFAULT 0,
  conversions_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_invites TO authenticated;
GRANT ALL ON public.trial_invites TO service_role;

ALTER TABLE public.trial_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage trial invites" ON public.trial_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trial_invites_updated_at BEFORE UPDATE ON public.trial_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Track invite origin on subscription
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS invite_code text;

-- Public info about an invite (no auth required)
CREATE OR REPLACE FUNCTION public.get_trial_invite_info(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE i public.trial_invites;
BEGIN
  SELECT * INTO i FROM public.trial_invites WHERE code = upper(trim(_code)) LIMIT 1;
  IF i.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  IF i.status <> 'active' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'revoked');
  END IF;
  IF i.expires_at IS NOT NULL AND i.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;
  RETURN jsonb_build_object('valid', true, 'code', i.code, 'label', i.label, 'trial_days', i.trial_days);
END $$;

GRANT EXECUTE ON FUNCTION public.get_trial_invite_info(text) TO anon, authenticated;

-- Redeem invite for current authenticated user
CREATE OR REPLACE FUNCTION public.redeem_trial_invite(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i public.trial_invites;
  uid uuid := auth.uid();
  trial_end timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO i FROM public.trial_invites WHERE code = upper(trim(_code)) LIMIT 1;
  IF i.id IS NULL THEN RAISE EXCEPTION 'Convite inválido'; END IF;
  IF i.status <> 'active' THEN RAISE EXCEPTION 'Convite revogado'; END IF;
  IF i.expires_at IS NOT NULL AND i.expires_at < now() THEN RAISE EXCEPTION 'Convite expirado'; END IF;

  trial_end := now() + (i.trial_days || ' days')::interval;

  INSERT INTO public.subscriptions (user_id, status, started_at, trial_ends_at, expires_at, invite_code)
  VALUES (uid, 'teste', now(), trial_end, trial_end, i.code)
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'teste',
    trial_ends_at = EXCLUDED.trial_ends_at,
    expires_at = EXCLUDED.expires_at,
    invite_code = EXCLUDED.invite_code,
    updated_at = now();

  UPDATE public.trial_invites SET signups_count = signups_count + 1 WHERE id = i.id;
  RETURN jsonb_build_object('ok', true, 'trial_ends_at', trial_end);
END $$;

GRANT EXECUTE ON FUNCTION public.redeem_trial_invite(text) TO authenticated;

-- Conversion tracking: when a subscription with an invite_code becomes 'ativo'
CREATE OR REPLACE FUNCTION public.track_invite_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invite_code IS NOT NULL
     AND NEW.status::text = 'ativo'
     AND (OLD.status::text IS DISTINCT FROM 'ativo') THEN
    UPDATE public.trial_invites
      SET conversions_count = conversions_count + 1
      WHERE code = NEW.invite_code;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS subscriptions_track_invite_conversion ON public.subscriptions;
CREATE TRIGGER subscriptions_track_invite_conversion
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.track_invite_conversion();

-- Admin trial stats aggregates
CREATE OR REPLACE FUNCTION public.admin_trial_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_signups int := 0;
  total_conversions int := 0;
  active_trials int := 0;
  expired_trials int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE(SUM(signups_count), 0), COALESCE(SUM(conversions_count), 0)
    INTO total_signups, total_conversions
    FROM public.trial_invites;

  SELECT COUNT(*) INTO active_trials FROM public.subscriptions
    WHERE invite_code IS NOT NULL AND status::text = 'teste'
      AND (trial_ends_at IS NULL OR trial_ends_at > now());

  SELECT COUNT(*) INTO expired_trials FROM public.subscriptions
    WHERE invite_code IS NOT NULL AND status::text = 'teste'
      AND trial_ends_at IS NOT NULL AND trial_ends_at <= now();

  RETURN jsonb_build_object(
    'active_trials', active_trials,
    'expired_trials', expired_trials,
    'conversions', total_conversions,
    'signups', total_signups,
    'conversion_rate', CASE WHEN total_signups > 0 THEN round((total_conversions::numeric / total_signups) * 100, 1) ELSE 0 END
  );
END $$;

GRANT EXECUTE ON FUNCTION public.admin_trial_stats() TO authenticated;
