
-- Remove broad anon read on base tables
DROP POLICY IF EXISTS "public read products of public stores" ON public.products;
DROP POLICY IF EXISTS "public read settings by slug" ON public.settings;

-- Public-safe view: products (only fields the checkout form needs)
CREATE OR REPLACE VIEW public.products_public
WITH (security_invoker = on) AS
SELECT
  p.id,
  p.user_id,
  p.name,
  p.category,
  p.price,
  p.stock,
  p.description,
  p.image_url,
  p.created_at
FROM public.products p
WHERE EXISTS (
  SELECT 1 FROM public.settings s
  WHERE s.user_id = p.user_id AND s.slug IS NOT NULL
);

-- Public-safe view: settings (only fields the checkout UI needs; no whatsapp/pix/goals/templates)
CREATE OR REPLACE VIEW public.settings_public
WITH (security_invoker = on) AS
SELECT
  s.user_id,
  s.slug,
  s.store_name,
  s.delivery_fee,
  s.delivery_label,
  s.shipping_options,
  s.checkout_logo_url,
  s.checkout_logo_size,
  s.checkout_logo_align,
  s.checkout_bg_color,
  s.checkout_theme,
  s.checkout_text_color,
  s.checkout_card_color,
  s.checkout_neon_color,
  s.checkout_button_label,
  s.checkout_button_color,
  s.checkout_header_bg_color,
  s.checkout_secure_label,
  s.checkout_secure_color,
  s.checkout_step1_button_label,
  s.checkout_step2_button_label,
  s.checkout_step3_button_label,
  s.checkout_step_button_color,
  s.checkout_step_button_text_color,
  s.checkout_step1_title,
  s.checkout_step2_title,
  s.checkout_step3_title,
  s.checkout_footer_enabled,
  s.checkout_footer_brand,
  s.checkout_footer_copyright,
  s.checkout_footer_email,
  s.checkout_footer_payments,
  s.checkout_footer_bg_color,
  s.checkout_footer_cards_image_url,
  s.checkout_footer_show_cards_image,
  s.checkout_footer_cards_image_height,
  s.checkout_footer_whatsapp,
  s.checkout_footer_cnpj,
  s.checkout_footer_show_cnpj,
  s.checkout_footer_show_email,
  s.checkout_footer_show_whatsapp
FROM public.settings s
WHERE s.slug IS NOT NULL;

-- Allow anon (and authenticated) to read these public views
GRANT SELECT ON public.products_public TO anon, authenticated;
GRANT SELECT ON public.settings_public TO anon, authenticated;

-- Owners (authenticated, security_invoker=on) still need base SELECT on their own rows via existing "own ... all" policies.
-- Re-grant SELECT through the view for anon by allowing minimal column-level SELECT on base tables:
-- security_invoker=on means the view runs as the querying role, so anon needs underlying SELECT on the referenced columns.
GRANT SELECT (id, user_id, name, category, price, stock, description, image_url, created_at) ON public.products TO anon;
GRANT SELECT (
  user_id, slug, store_name, delivery_fee, delivery_label, shipping_options,
  checkout_logo_url, checkout_logo_size, checkout_logo_align,
  checkout_bg_color, checkout_theme, checkout_text_color, checkout_card_color,
  checkout_neon_color, checkout_button_label, checkout_button_color,
  checkout_header_bg_color, checkout_secure_label, checkout_secure_color,
  checkout_step1_button_label, checkout_step2_button_label, checkout_step3_button_label,
  checkout_step_button_color, checkout_step_button_text_color,
  checkout_step1_title, checkout_step2_title, checkout_step3_title,
  checkout_footer_enabled, checkout_footer_brand, checkout_footer_copyright,
  checkout_footer_email, checkout_footer_payments, checkout_footer_bg_color,
  checkout_footer_cards_image_url, checkout_footer_show_cards_image,
  checkout_footer_cards_image_height, checkout_footer_whatsapp,
  checkout_footer_cnpj, checkout_footer_show_cnpj, checkout_footer_show_email,
  checkout_footer_show_whatsapp
) ON public.settings TO anon;

-- Narrow anon SELECT policies on base tables so RLS allows the column-scoped reads through the view
CREATE POLICY "anon read public products columns"
  ON public.products FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.settings s WHERE s.user_id = products.user_id AND s.slug IS NOT NULL));

CREATE POLICY "anon read public settings columns"
  ON public.settings FOR SELECT TO anon
  USING (slug IS NOT NULL);
