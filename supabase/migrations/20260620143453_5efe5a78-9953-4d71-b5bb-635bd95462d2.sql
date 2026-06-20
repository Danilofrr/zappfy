DROP POLICY IF EXISTS "public read products of public stores" ON public.products;
DROP POLICY IF EXISTS "public read store by slug" ON public.settings;

REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.settings FROM anon;
REVOKE ALL ON public.products FROM authenticated;
REVOKE ALL ON public.settings FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.settings TO service_role;

DROP VIEW IF EXISTS public.products_public;
DROP VIEW IF EXISTS public.settings_public;

CREATE VIEW public.settings_public
WITH (security_invoker = off) AS
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

CREATE VIEW public.products_public
WITH (security_invoker = off) AS
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

GRANT SELECT ON public.settings_public TO anon, authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;
GRANT ALL ON public.settings_public TO service_role;
GRANT ALL ON public.products_public TO service_role;