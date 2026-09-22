-- Permissões operacionais complementares da equipe.

DROP POLICY IF EXISTS "Team tracking can view tracking" ON public.delivery_tracking;
CREATE POLICY "Team tracking can view tracking"
ON public.delivery_tracking
FOR SELECT TO authenticated
USING (
  public.team_has_permission(store_id, 'tracking')
  OR public.team_has_permission(store_id, 'couriers')
);

CREATE OR REPLACE FUNCTION public.team_update_checkout_settings(_store_id uuid, _patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  s public.settings;
  next_settings public.settings;
  allowed jsonb;
BEGIN
  IF NOT (
    public.team_has_permission(_store_id, 'checkout')
    OR public.team_has_permission(_store_id, 'settings')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o checkout';
  END IF;

  SELECT * INTO s FROM public.settings WHERE store_id = _store_id FOR UPDATE;
  IF s.store_id IS NULL THEN RAISE EXCEPTION 'Configuração da loja não encontrada'; END IF;

  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
  INTO allowed
  FROM jsonb_each(COALESCE(_patch, '{}'::jsonb))
  WHERE key = ANY(ARRAY[
    'store_name','whatsapp','pix_key','address','delivery_fee',
    'checkout_logo_url','checkout_bg_color','checkout_theme','checkout_text_color',
    'checkout_card_color','checkout_neon_color','delivery_label','checkout_button_label',
    'checkout_button_color','checkout_header_bg_color','checkout_secure_label',
    'checkout_step1_button_label','checkout_step2_button_label','checkout_step3_button_label',
    'checkout_step_button_color','checkout_step_button_text_color','shipping_options',
    'checkout_footer_enabled','checkout_footer_brand','checkout_footer_copyright',
    'checkout_footer_email','checkout_footer_payments','checkout_secure_color',
    'checkout_logo_size','checkout_footer_bg_color','checkout_logo_align',
    'checkout_step1_title','checkout_step2_title','checkout_step3_title',
    'checkout_footer_cards_image_url','checkout_footer_show_cards_image',
    'checkout_footer_cards_image_height','checkout_footer_whatsapp','checkout_footer_cnpj',
    'checkout_footer_show_cnpj','checkout_footer_show_email','checkout_footer_show_whatsapp',
    'slug'
  ]::text[]);

  SELECT * INTO next_settings
  FROM jsonb_populate_record(s, allowed);

  UPDATE public.settings
  SET
    store_name = next_settings.store_name,
    whatsapp = next_settings.whatsapp,
    pix_key = next_settings.pix_key,
    address = next_settings.address,
    delivery_fee = next_settings.delivery_fee,
    checkout_logo_url = next_settings.checkout_logo_url,
    checkout_bg_color = next_settings.checkout_bg_color,
    checkout_theme = next_settings.checkout_theme,
    checkout_text_color = next_settings.checkout_text_color,
    checkout_card_color = next_settings.checkout_card_color,
    checkout_neon_color = next_settings.checkout_neon_color,
    delivery_label = next_settings.delivery_label,
    checkout_button_label = next_settings.checkout_button_label,
    checkout_button_color = next_settings.checkout_button_color,
    checkout_header_bg_color = next_settings.checkout_header_bg_color,
    checkout_secure_label = next_settings.checkout_secure_label,
    checkout_step1_button_label = next_settings.checkout_step1_button_label,
    checkout_step2_button_label = next_settings.checkout_step2_button_label,
    checkout_step3_button_label = next_settings.checkout_step3_button_label,
    checkout_step_button_color = next_settings.checkout_step_button_color,
    checkout_step_button_text_color = next_settings.checkout_step_button_text_color,
    shipping_options = next_settings.shipping_options,
    checkout_footer_enabled = next_settings.checkout_footer_enabled,
    checkout_footer_brand = next_settings.checkout_footer_brand,
    checkout_footer_copyright = next_settings.checkout_footer_copyright,
    checkout_footer_email = next_settings.checkout_footer_email,
    checkout_footer_payments = next_settings.checkout_footer_payments,
    checkout_secure_color = next_settings.checkout_secure_color,
    checkout_logo_size = next_settings.checkout_logo_size,
    checkout_footer_bg_color = next_settings.checkout_footer_bg_color,
    checkout_logo_align = next_settings.checkout_logo_align,
    checkout_step1_title = next_settings.checkout_step1_title,
    checkout_step2_title = next_settings.checkout_step2_title,
    checkout_step3_title = next_settings.checkout_step3_title,
    checkout_footer_cards_image_url = next_settings.checkout_footer_cards_image_url,
    checkout_footer_show_cards_image = next_settings.checkout_footer_show_cards_image,
    checkout_footer_cards_image_height = next_settings.checkout_footer_cards_image_height,
    checkout_footer_whatsapp = next_settings.checkout_footer_whatsapp,
    checkout_footer_cnpj = next_settings.checkout_footer_cnpj,
    checkout_footer_show_cnpj = next_settings.checkout_footer_show_cnpj,
    checkout_footer_show_email = next_settings.checkout_footer_show_email,
    checkout_footer_show_whatsapp = next_settings.checkout_footer_show_whatsapp,
    slug = next_settings.slug,
    updated_at = now()
  WHERE store_id = _store_id;

  RETURN public.team_store_snapshot(_store_id)->'settings';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.team_update_checkout_settings(uuid,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
