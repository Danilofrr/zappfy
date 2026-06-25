CREATE OR REPLACE FUNCTION public.apply_tracking_default_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _theme jsonb;
  _row public.delivery_tracking_settings;
BEGIN
  SELECT value INTO _theme
  FROM public.admin_settings
  WHERE key = 'tracking_default_theme'
  LIMIT 1;

  -- Always create the row using table defaults first. This lets id/created_at/updated_at
  -- and every required field receive valid default values instead of explicit NULLs.
  INSERT INTO public.delivery_tracking_settings (store_id)
  VALUES (_user_id)
  ON CONFLICT (store_id) DO NOTHING;

  IF _theme IS NULL THEN
    RETURN;
  END IF;

  _theme := _theme - 'id' - 'store_id' - 'created_at' - 'updated_at';
  SELECT * INTO _row
  FROM jsonb_populate_record(null::public.delivery_tracking_settings, _theme);

  UPDATE public.delivery_tracking_settings
  SET
    logo_url = CASE WHEN _theme ? 'logo_url' THEN _row.logo_url ELSE logo_url END,
    primary_color = COALESCE(_row.primary_color, primary_color),
    secondary_color = COALESCE(_row.secondary_color, secondary_color),
    background_color = COALESCE(_row.background_color, background_color),
    button_color = COALESCE(_row.button_color, button_color),
    text_color = COALESCE(_row.text_color, text_color),
    tracking_page_title = COALESCE(_row.tracking_page_title, tracking_page_title),
    tracking_page_subtitle = COALESCE(_row.tracking_page_subtitle, tracking_page_subtitle),
    welcome_message = COALESCE(_row.welcome_message, welcome_message),
    delivered_message = COALESCE(_row.delivered_message, delivered_message),
    support_whatsapp = CASE WHEN _theme ? 'support_whatsapp' THEN _row.support_whatsapp ELSE support_whatsapp END,
    show_store_logo = COALESCE(_row.show_store_logo, show_store_logo),
    show_courier_name = COALESCE(_row.show_courier_name, show_courier_name),
    show_courier_phone = COALESCE(_row.show_courier_phone, show_courier_phone),
    show_estimated_time = COALESCE(_row.show_estimated_time, show_estimated_time),
    show_distance = COALESCE(_row.show_distance, show_distance),
    vehicle_type = COALESCE(_row.vehicle_type, vehicle_type),
    vehicle_color = COALESCE(_row.vehicle_color, vehicle_color),
    vehicle_custom_url = CASE WHEN _theme ? 'vehicle_custom_url' THEN _row.vehicle_custom_url ELSE vehicle_custom_url END,
    pin_color = COALESCE(_row.pin_color, pin_color),
    pin_custom_url = CASE WHEN _theme ? 'pin_custom_url' THEN _row.pin_custom_url ELSE pin_custom_url END,
    timeline_color = COALESCE(_row.timeline_color, timeline_color),
    card_color = COALESCE(_row.card_color, card_color),
    msg_aguardando = COALESCE(_row.msg_aguardando, msg_aguardando),
    msg_preparando = COALESCE(_row.msg_preparando, msg_preparando),
    msg_saiu = COALESCE(_row.msg_saiu, msg_saiu),
    msg_chegando = COALESCE(_row.msg_chegando, msg_chegando),
    msg_entregue = COALESCE(_row.msg_entregue, msg_entregue),
    msg_cancelado = COALESCE(_row.msg_cancelado, msg_cancelado),
    card_border_color = COALESCE(_row.card_border_color, card_border_color),
    title_color = COALESCE(_row.title_color, title_color),
    status_color = COALESCE(_row.status_color, status_color),
    card_opacity = COALESCE(_row.card_opacity, card_opacity),
    card_glass = COALESCE(_row.card_glass, card_glass),
    card_shadow = COALESCE(_row.card_shadow, card_shadow),
    border_intensity = COALESCE(_row.border_intensity, border_intensity),
    status_styles = COALESCE(_row.status_styles, status_styles),
    card_radius = COALESCE(_row.card_radius, card_radius),
    card_shadow_color = COALESCE(_row.card_shadow_color, card_shadow_color),
    header_style = COALESCE(_row.header_style, header_style),
    header_color = COALESCE(_row.header_color, header_color),
    header_height = COALESCE(_row.header_height, header_height),
    header_logo_size = COALESCE(_row.header_logo_size, header_logo_size),
    header_logo_align = COALESCE(_row.header_logo_align, header_logo_align),
    courier_inherit_client = COALESCE(_row.courier_inherit_client, courier_inherit_client),
    courier_logo_url = CASE WHEN _theme ? 'courier_logo_url' THEN _row.courier_logo_url ELSE courier_logo_url END,
    courier_primary_color = COALESCE(_row.courier_primary_color, courier_primary_color),
    courier_secondary_color = COALESCE(_row.courier_secondary_color, courier_secondary_color),
    courier_header_style = COALESCE(_row.courier_header_style, courier_header_style),
    courier_header_color = COALESCE(_row.courier_header_color, courier_header_color),
    courier_background_color = COALESCE(_row.courier_background_color, courier_background_color),
    courier_card_color = COALESCE(_row.courier_card_color, courier_card_color),
    courier_card_border_color = COALESCE(_row.courier_card_border_color, courier_card_border_color),
    courier_card_shadow_color = COALESCE(_row.courier_card_shadow_color, courier_card_shadow_color),
    courier_text_color = COALESCE(_row.courier_text_color, courier_text_color),
    courier_title_color = COALESCE(_row.courier_title_color, courier_title_color),
    courier_button_color = COALESCE(_row.courier_button_color, courier_button_color),
    courier_icon_color = COALESCE(_row.courier_icon_color, courier_icon_color),
    courier_footer_text = COALESCE(_row.courier_footer_text, courier_footer_text),
    courier_header_height = COALESCE(_row.courier_header_height, courier_header_height),
    courier_header_logo_size = COALESCE(_row.courier_header_logo_size, courier_header_logo_size),
    courier_header_logo_align = COALESCE(_row.courier_header_logo_align, courier_header_logo_align),
    show_products = COALESCE(_row.show_products, show_products),
    show_product_price = COALESCE(_row.show_product_price, show_product_price),
    updated_at = now()
  WHERE store_id = _user_id;
END;
$function$;