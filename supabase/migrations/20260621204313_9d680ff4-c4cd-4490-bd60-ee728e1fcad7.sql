
ALTER TABLE public.delivery_tracking_settings
  ADD COLUMN IF NOT EXISTS courier_inherit_client boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS courier_logo_url text,
  ADD COLUMN IF NOT EXISTS courier_primary_color text,
  ADD COLUMN IF NOT EXISTS courier_secondary_color text,
  ADD COLUMN IF NOT EXISTS courier_header_style text,
  ADD COLUMN IF NOT EXISTS courier_header_color text,
  ADD COLUMN IF NOT EXISTS courier_background_color text,
  ADD COLUMN IF NOT EXISTS courier_card_color text,
  ADD COLUMN IF NOT EXISTS courier_card_border_color text,
  ADD COLUMN IF NOT EXISTS courier_card_shadow_color text,
  ADD COLUMN IF NOT EXISTS courier_text_color text,
  ADD COLUMN IF NOT EXISTS courier_title_color text,
  ADD COLUMN IF NOT EXISTS courier_button_color text,
  ADD COLUMN IF NOT EXISTS courier_icon_color text,
  ADD COLUMN IF NOT EXISTS courier_footer_text text;

CREATE OR REPLACE FUNCTION public.get_courier_view(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.delivery_tracking;
  s public.delivery_tracking_settings;
  st public.settings;
  o public.orders;
  inherit boolean;
BEGIN
  SELECT * INTO t FROM public.delivery_tracking WHERE courier_token = _token LIMIT 1;
  IF t.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.delivery_tracking_settings WHERE store_id = t.store_id LIMIT 1;
  SELECT * INTO st FROM public.settings WHERE user_id = t.store_id LIMIT 1;
  SELECT * INTO o FROM public.orders WHERE id = t.order_id LIMIT 1;
  inherit := COALESCE(s.courier_inherit_client, true);

  RETURN jsonb_build_object(
    'id', t.id,
    'tracking_code', t.tracking_code,
    'status', t.status,
    'courier_name', t.courier_name,
    'courier_phone', t.courier_phone,
    'notes', t.notes,
    'started_at', t.started_at,
    'completed_at', t.completed_at,
    'order', jsonb_build_object(
      'id', o.id, 'customer', o.customer, 'phone', o.phone, 'address', o.address,
      'district', o.district, 'city', o.city, 'total', o.total,
      'notes', o.notes, 'date', o.date
    ),
    'store', jsonb_build_object(
      'name', COALESCE(st.store_name, 'Loja'),
      'whatsapp', COALESCE(st.whatsapp, ''),
      'logo_url', CASE WHEN inherit THEN COALESCE(s.logo_url, st.checkout_logo_url)
                       ELSE COALESCE(s.courier_logo_url, s.logo_url, st.checkout_logo_url) END
    ),
    'settings', jsonb_build_object(
      'inherit_client', inherit,
      'primary_color',     CASE WHEN inherit THEN COALESCE(s.primary_color, '#10b981')      ELSE COALESCE(s.courier_primary_color, s.primary_color, '#10b981') END,
      'secondary_color',   CASE WHEN inherit THEN COALESCE(s.secondary_color, '#0b1220')    ELSE COALESCE(s.courier_secondary_color, s.secondary_color, '#0b1220') END,
      'header_style',      CASE WHEN inherit THEN COALESCE(s.header_style, 'solid')         ELSE COALESCE(s.courier_header_style, s.header_style, 'solid') END,
      'header_color',      CASE WHEN inherit THEN COALESCE(s.header_color, s.primary_color, '#10b981') ELSE COALESCE(s.courier_header_color, s.header_color, s.primary_color, '#10b981') END,
      'background_color',  CASE WHEN inherit THEN COALESCE(s.background_color, '#0b1220')   ELSE COALESCE(s.courier_background_color, s.background_color, '#0b1220') END,
      'card_color',        CASE WHEN inherit THEN COALESCE(s.card_color, '#0f172a')         ELSE COALESCE(s.courier_card_color, s.card_color, '#0f172a') END,
      'card_border_color', CASE WHEN inherit THEN COALESCE(s.card_border_color, '#1e293b')  ELSE COALESCE(s.courier_card_border_color, s.card_border_color, '#1e293b') END,
      'card_shadow_color', CASE WHEN inherit THEN COALESCE(s.card_shadow_color, '#000000')  ELSE COALESCE(s.courier_card_shadow_color, s.card_shadow_color, '#000000') END,
      'text_color',        CASE WHEN inherit THEN COALESCE(s.text_color, '#ffffff')         ELSE COALESCE(s.courier_text_color, s.text_color, '#ffffff') END,
      'title_color',       CASE WHEN inherit THEN COALESCE(s.title_color, s.text_color, '#ffffff') ELSE COALESCE(s.courier_title_color, s.title_color, '#ffffff') END,
      'button_color',      CASE WHEN inherit THEN COALESCE(s.button_color, '#10b981')       ELSE COALESCE(s.courier_button_color, s.button_color, '#10b981') END,
      'icon_color',        CASE WHEN inherit THEN COALESCE(s.primary_color, '#10b981')      ELSE COALESCE(s.courier_icon_color, s.primary_color, '#10b981') END,
      'footer_text',       COALESCE(s.courier_footer_text, 'Powered by Zappfy')
    )
  );
END;
$function$;
