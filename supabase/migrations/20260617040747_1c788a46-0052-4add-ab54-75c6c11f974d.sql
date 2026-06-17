
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS settings_slug_key ON public.settings (lower(slug)) WHERE slug IS NOT NULL;

GRANT SELECT ON public.settings TO anon;
GRANT SELECT ON public.products TO anon;

CREATE POLICY "public read settings by slug"
  ON public.settings FOR SELECT
  TO anon
  USING (slug IS NOT NULL);

CREATE POLICY "public read products of public stores"
  ON public.products FOR SELECT
  TO anon
  USING (EXISTS (SELECT 1 FROM public.settings s WHERE s.user_id = products.user_id AND s.slug IS NOT NULL));
