
-- 1. Switch public views to security_invoker (fixes Security Definer View)
ALTER VIEW public.settings_public SET (security_invoker = on);
ALTER VIEW public.products_public SET (security_invoker = on);

-- Ensure anon can read the curated views
GRANT SELECT ON public.settings_public TO anon, authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;

-- 2. Remove anon direct access to base tables (force use of views / RPC)
DROP POLICY IF EXISTS "anon read public settings rows" ON public.settings;
DROP POLICY IF EXISTS "anon read public products rows" ON public.products;
DROP POLICY IF EXISTS "anon public checkout insert orders" ON public.orders;

-- 3. Restrict has_role execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
