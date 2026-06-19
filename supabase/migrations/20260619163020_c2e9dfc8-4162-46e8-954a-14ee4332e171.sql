
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Allow any authenticated user to read admin_settings (read-only). Writes still admin-only.
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.admin_settings;
CREATE POLICY "Authenticated can read settings"
ON public.admin_settings
FOR SELECT
TO authenticated
USING (true);
