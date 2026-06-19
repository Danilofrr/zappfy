GRANT SELECT ON public.admin_settings TO anon;
DROP POLICY IF EXISTS "Public can read system settings" ON public.admin_settings;
CREATE POLICY "Public can read system settings" ON public.admin_settings FOR SELECT TO anon USING (key = 'system');