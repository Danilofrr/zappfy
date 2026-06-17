
-- Lock down anon access on sensitive tables and expose only safe columns via SECURITY DEFINER views.

-- Revoke anonymous role from base tables
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.settings FROM anon;
REVOKE ALL ON public.orders   FROM anon;

-- Drop the old anon SELECT policies (no longer needed; anon reads happen via views)
DROP POLICY IF EXISTS "anon read public products columns" ON public.products;
DROP POLICY IF EXISTS "anon read public settings columns" ON public.settings;

-- Recreate public views as SECURITY DEFINER (default) so they run with owner privileges,
-- exposing only safe columns to anon. Filter rows to only stores that have a public slug.
DROP VIEW IF EXISTS public.products_public;
DROP VIEW IF EXISTS public.settings_public;

CREATE VIEW public.settings_public AS
SELECT
  user_id, slug, store_name,
  delivery_fee, delivery_label, shipping_options,
  checkout_logo_url, checkout_logo_size, checkout_logo_align,
  checkout_bg_color, checkout_theme, checkout_text_color,
  checkout_card_color, checkout_neon_color,
  checkout_button_label, checkout_button_color,
  checkout_header_bg_color,
  checkout_secure_label, checkout_secure_color,
  checkout_step1_button_label, checkout_step2_button_label, checkout_step3_button_label,
  checkout_step_button_color, checkout_step_button_text_color,
  checkout_step1_title, checkout_step2_title, checkout_step3_title,
  checkout_footer_enabled, checkout_footer_brand, checkout_footer_copyright,
  checkout_footer_email, checkout_footer_payments, checkout_footer_bg_color,
  checkout_footer_cards_image_url, checkout_footer_show_cards_image,
  checkout_footer_cards_image_height,
  checkout_footer_whatsapp, checkout_footer_cnpj,
  checkout_footer_show_cnpj, checkout_footer_show_email, checkout_footer_show_whatsapp
FROM public.settings
WHERE slug IS NOT NULL;

CREATE VIEW public.products_public AS
SELECT id, user_id, name, category, price, stock, description, image_url, created_at
FROM public.products
WHERE EXISTS (
  SELECT 1 FROM public.settings s
  WHERE s.user_id = products.user_id AND s.slug IS NOT NULL
);

-- Grant view access
GRANT SELECT ON public.settings_public TO anon, authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;

-- Keep authenticated/service_role full access on base tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders   TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.settings TO service_role;
GRANT ALL ON public.orders   TO service_role;
