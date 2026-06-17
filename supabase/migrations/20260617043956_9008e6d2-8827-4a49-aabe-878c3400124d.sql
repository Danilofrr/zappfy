
-- Switch views to security_invoker so they don't trigger the SECURITY DEFINER linter.
ALTER VIEW public.settings_public SET (security_invoker = true);
ALTER VIEW public.products_public SET (security_invoker = true);

-- Re-enable anon read access via column-level grants on the base tables.
GRANT SELECT (
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
) ON public.settings TO anon;

GRANT SELECT (
  id, user_id, name, category, price, stock, description, image_url, created_at
) ON public.products TO anon;

-- Anon RLS policies (column grants alone are not enough when RLS is on).
CREATE POLICY "anon read public settings rows"
  ON public.settings FOR SELECT TO anon
  USING (slug IS NOT NULL);

CREATE POLICY "anon read public products rows"
  ON public.products FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.settings s
    WHERE s.user_id = products.user_id AND s.slug IS NOT NULL
  ));
