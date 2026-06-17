DROP VIEW IF EXISTS public.settings_public;
CREATE VIEW public.settings_public AS
SELECT user_id, slug, store_name, whatsapp, delivery_fee, delivery_label, shipping_options,
  checkout_logo_url, checkout_logo_size, checkout_logo_align, checkout_bg_color, checkout_theme,
  checkout_text_color, checkout_card_color, checkout_neon_color, checkout_button_label, checkout_button_color,
  checkout_header_bg_color, checkout_secure_label, checkout_secure_color,
  checkout_step1_button_label, checkout_step2_button_label, checkout_step3_button_label,
  checkout_step_button_color, checkout_step_button_text_color,
  checkout_step1_title, checkout_step2_title, checkout_step3_title,
  checkout_footer_enabled, checkout_footer_brand, checkout_footer_copyright, checkout_footer_email,
  checkout_footer_payments, checkout_footer_bg_color, checkout_footer_cards_image_url,
  checkout_footer_show_cards_image, checkout_footer_cards_image_height, checkout_footer_whatsapp,
  checkout_footer_cnpj, checkout_footer_show_cnpj, checkout_footer_show_email, checkout_footer_show_whatsapp
FROM public.settings WHERE slug IS NOT NULL;
GRANT SELECT ON public.settings_public TO anon, authenticated;