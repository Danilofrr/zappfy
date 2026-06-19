
-- 1) Unique slug (case-insensitive), allow nulls
CREATE UNIQUE INDEX IF NOT EXISTS settings_slug_unique_ci
  ON public.settings (lower(slug))
  WHERE slug IS NOT NULL;

-- 2) Public settings view: only safe columns for the public checkout
DROP VIEW IF EXISTS public.settings_public CASCADE;
CREATE VIEW public.settings_public
WITH (security_invoker = on) AS
SELECT
  user_id,
  store_name,
  slug,
  whatsapp,
  address,
  delivery_fee,
  delivery_label,
  shipping_options,
  motoboy_fee,
  checkout_logo_url,
  checkout_logo_size,
  checkout_logo_align,
  checkout_bg_color,
  checkout_theme,
  checkout_text_color,
  checkout_card_color,
  checkout_neon_color,
  checkout_button_label,
  checkout_button_color,
  checkout_header_bg_color,
  checkout_secure_label,
  checkout_secure_color,
  checkout_step1_title,
  checkout_step2_title,
  checkout_step3_title,
  checkout_step1_button_label,
  checkout_step2_button_label,
  checkout_step3_button_label,
  checkout_step_button_color,
  checkout_step_button_text_color,
  checkout_footer_enabled,
  checkout_footer_brand,
  checkout_footer_copyright,
  checkout_footer_bg_color,
  checkout_footer_email,
  checkout_footer_whatsapp,
  checkout_footer_cnpj,
  checkout_footer_show_email,
  checkout_footer_show_whatsapp,
  checkout_footer_show_cnpj,
  checkout_footer_payments,
  checkout_footer_cards_image_url,
  checkout_footer_show_cards_image,
  checkout_footer_cards_image_height
FROM public.settings
WHERE slug IS NOT NULL;

GRANT SELECT ON public.settings_public TO anon, authenticated;

-- 3) Public products view: only stores with a slug, only safe columns (no cost)
DROP VIEW IF EXISTS public.products_public CASCADE;
CREATE VIEW public.products_public
WITH (security_invoker = on) AS
SELECT
  p.id,
  p.user_id,
  p.name,
  p.price,
  p.stock,
  p.image_url,
  p.created_at
FROM public.products p
JOIN public.settings s ON s.user_id = p.user_id
WHERE s.slug IS NOT NULL;

GRANT SELECT ON public.products_public TO anon, authenticated;

-- 4) Allow anon SELECT on base tables ONLY for rows exposed via the views.
--    security_invoker views check the base-table RLS of the calling role,
--    so we need an anon SELECT policy scoped to public stores.
CREATE POLICY "public read store by slug"
  ON public.settings
  FOR SELECT
  TO anon, authenticated
  USING (slug IS NOT NULL);

CREATE POLICY "public read products of public stores"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.settings s
    WHERE s.user_id = products.user_id AND s.slug IS NOT NULL
  ));

GRANT SELECT ON public.settings TO anon;
GRANT SELECT ON public.products TO anon;
