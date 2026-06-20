DROP VIEW IF EXISTS public.products_public;
DROP VIEW IF EXISTS public.settings_public;

CREATE VIEW public.settings_public
WITH (security_invoker = on) AS
SELECT
  user_id, store_name, slug, whatsapp, address,
  delivery_fee, delivery_label, shipping_options, motoboy_fee,
  checkout_logo_url, checkout_logo_size, checkout_logo_align,
  checkout_bg_color, checkout_theme, checkout_text_color, checkout_card_color, checkout_neon_color,
  checkout_button_label, checkout_button_color, checkout_header_bg_color,
  checkout_secure_label, checkout_secure_color,
  checkout_step1_title, checkout_step2_title, checkout_step3_title,
  checkout_step1_button_label, checkout_step2_button_label, checkout_step3_button_label,
  checkout_step_button_color, checkout_step_button_text_color,
  checkout_footer_enabled, checkout_footer_brand, checkout_footer_copyright, checkout_footer_bg_color,
  checkout_footer_email, checkout_footer_whatsapp, checkout_footer_cnpj,
  checkout_footer_show_email, checkout_footer_show_whatsapp, checkout_footer_show_cnpj,
  checkout_footer_payments, checkout_footer_cards_image_url,
  checkout_footer_show_cards_image, checkout_footer_cards_image_height
FROM public.settings
WHERE slug IS NOT NULL;

CREATE VIEW public.products_public
WITH (security_invoker = on) AS
SELECT
  p.id, p.user_id, p.name, p.price, p.stock, p.image_url, p.created_at
FROM public.products p
JOIN public.settings s ON s.user_id = p.user_id
WHERE s.slug IS NOT NULL;

-- Política de leitura pública APENAS para campos não-sensíveis através das views
-- (precisamos liberar leitura na tabela base, mas com grants de coluna restritos a anon)
CREATE POLICY "anon read public store settings"
ON public.settings FOR SELECT
TO anon
USING (slug IS NOT NULL);

CREATE POLICY "anon read public store products"
ON public.products FOR SELECT
TO anon
USING (EXISTS (SELECT 1 FROM public.settings s WHERE s.user_id = products.user_id AND s.slug IS NOT NULL));

-- Restringe colunas que anon pode ler para não vazar dados financeiros internos
REVOKE SELECT ON public.settings FROM anon;
REVOKE SELECT ON public.products FROM anon;

GRANT SELECT (
  user_id, store_name, slug, whatsapp, address,
  delivery_fee, delivery_label, shipping_options, motoboy_fee,
  checkout_logo_url, checkout_logo_size, checkout_logo_align,
  checkout_bg_color, checkout_theme, checkout_text_color, checkout_card_color, checkout_neon_color,
  checkout_button_label, checkout_button_color, checkout_header_bg_color,
  checkout_secure_label, checkout_secure_color,
  checkout_step1_title, checkout_step2_title, checkout_step3_title,
  checkout_step1_button_label, checkout_step2_button_label, checkout_step3_button_label,
  checkout_step_button_color, checkout_step_button_text_color,
  checkout_footer_enabled, checkout_footer_brand, checkout_footer_copyright, checkout_footer_bg_color,
  checkout_footer_email, checkout_footer_whatsapp, checkout_footer_cnpj,
  checkout_footer_show_email, checkout_footer_show_whatsapp, checkout_footer_show_cnpj,
  checkout_footer_payments, checkout_footer_cards_image_url,
  checkout_footer_show_cards_image, checkout_footer_cards_image_height
) ON public.settings TO anon;

GRANT SELECT (id, user_id, name, price, stock, image_url, created_at)
ON public.products TO anon;

GRANT SELECT ON public.settings_public TO anon, authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;
GRANT ALL ON public.settings_public TO service_role;
GRANT ALL ON public.products_public TO service_role;