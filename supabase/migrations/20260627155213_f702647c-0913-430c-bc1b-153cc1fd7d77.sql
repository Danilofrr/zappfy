
-- 1) Remove overly broad "Public can view products" policy. Slug-scoped anon policy remains.
DROP POLICY IF EXISTS "Public can view products" ON public.products;

-- 2) Restrict anon access to settings to a safe view (no fb_access_token, pix_key, templates, goals).
ALTER VIEW public.settings_public SET (security_invoker = off);
GRANT SELECT ON public.settings_public TO anon, authenticated;
DROP POLICY IF EXISTS "anon read public store settings" ON public.settings;

-- 3) Couriers: hide password_hash from API readers; owners no longer need to read it.
REVOKE SELECT (password_hash) ON public.couriers FROM PUBLIC;
REVOKE SELECT (password_hash) ON public.couriers FROM anon;
REVOKE SELECT (password_hash) ON public.couriers FROM authenticated;

-- 4) Document fail-closed tables (defense-in-depth notes for scanners/maintainers).
COMMENT ON TABLE public.courier_sessions IS 'Bearer tokens. Fail-closed RLS (no policies); accessed only by SECURITY DEFINER auth RPCs via service role.';
COMMENT ON TABLE public.trial_invites IS 'Invite codes. Fail-closed RLS for non-admins; public redemption only through SECURITY DEFINER RPC.';
COMMENT ON TABLE public.delivery_tracking IS 'Tracking rows. Direct SELECT restricted to store owners; customer view served by SECURITY DEFINER RPC keyed on tracking_code.';
