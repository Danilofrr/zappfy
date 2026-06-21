ALTER TABLE public.delivery_tracking_settings
  ADD COLUMN IF NOT EXISTS header_style text NOT NULL DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS header_color text NOT NULL DEFAULT '#dc2626',
  ADD COLUMN IF NOT EXISTS header_height integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS header_logo_size integer NOT NULL DEFAULT 56,
  ADD COLUMN IF NOT EXISTS header_logo_align text NOT NULL DEFAULT 'center';

CREATE OR REPLACE FUNCTION public.get_tracking_public(_code text)
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
  result jsonb;
BEGIN
  SELECT * INTO t FROM public.delivery_tracking WHERE tracking_code = _code LIMIT 1;
  IF t.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.delivery_tracking_settings WHERE store_id = t.store_id LIMIT 1;
  SELECT * INTO st FROM public.settings WHERE user_id = t.store_id LIMIT 1;
  SELECT * INTO o FROM public.orders WHERE id = t.order_id LIMIT 1;

  result := jsonb_build_object(
    'id', t.id,
    'order_id', t.order_id,
    'tracking_code', t.tracking_code,
    'status', t.status,
    'order_status', o.status,
    'latitude', t.latitude,
    'longitude', t.longitude,
    'speed', t.speed,
    'heading', t.heading,
    'accuracy', t.accuracy,
    'last_updated_at', t.last_updated_at,
    'started_at', t.started_at,
    'completed_at', t.completed_at,
    'estimated_arrival', t.estimated_arrival,
    'order', jsonb_build_object(
      'id', o.id, 'customer', o.customer, 'address', o.address,
      'district', o.district, 'city', o.city, 'total', o.total,
      'status', o.status, 'date', o.date
    ),
    'store', jsonb_build_object(
      'name', COALESCE(st.store_name, 'Loja'),
      'whatsapp', COALESCE(st.whatsapp, ''),
      'logo_url', COALESCE(s.logo_url, st.checkout_logo_url)
    ),
    'settings', jsonb_build_object(
      'primary_color', COALESCE(s.primary_color, '#10b981'),
      'secondary_color', COALESCE(s.secondary_color, '#0b1220'),
      'background_color', COALESCE(s.background_color, '#0b1220'),
      'button_color', COALESCE(s.button_color, '#10b981'),
      'text_color', COALESCE(s.text_color, '#ffffff'),
      'title_color', COALESCE(s.title_color, s.text_color, '#ffffff'),
      'card_color', COALESCE(s.card_color, s.secondary_color, '#0b1220'),
      'card_border_color', COALESCE(s.card_border_color, '#1e293b'),
      'card_opacity', COALESCE(s.card_opacity, 1),
      'card_glass', COALESCE(s.card_glass, false),
      'card_shadow', COALESCE(s.card_shadow, 'md'),
      'card_shadow_color', COALESCE(s.card_shadow_color, '#000000'),
      'card_radius', COALESCE(s.card_radius, 16),
      'border_intensity', COALESCE(s.border_intensity, 1),
      'status_color', COALESCE(s.status_color, s.primary_color, '#10b981'),
      'status_styles', COALESCE(s.status_styles, '{}'::jsonb),
      'timeline_color', COALESCE(s.timeline_color, s.primary_color, '#10b981'),
      'header_style', COALESCE(s.header_style, 'solid'),
      'header_color', COALESCE(s.header_color, s.primary_color, '#dc2626'),
      'header_height', COALESCE(s.header_height, 100),
      'header_logo_size', COALESCE(s.header_logo_size, 56),
      'header_logo_align', COALESCE(s.header_logo_align, 'center'),
      'tracking_page_title', COALESCE(s.tracking_page_title, 'Acompanhe sua entrega'),
      'tracking_page_subtitle', COALESCE(s.tracking_page_subtitle, 'Veja em tempo real onde está seu pedido'),
      'welcome_message', COALESCE(s.welcome_message, 'Seu pedido está a caminho!'),
      'delivered_message', COALESCE(s.delivered_message, 'Pedido entregue com sucesso!'),
      'support_whatsapp', COALESCE(s.support_whatsapp, st.whatsapp, ''),
      'show_store_logo', COALESCE(s.show_store_logo, true),
      'show_courier_name', COALESCE(s.show_courier_name, true),
      'show_courier_phone', COALESCE(s.show_courier_phone, false),
      'show_estimated_time', COALESCE(s.show_estimated_time, true),
      'show_distance', COALESCE(s.show_distance, true),
      'vehicle_type', COALESCE(s.vehicle_type, 'moto'),
      'vehicle_color', COALESCE(s.vehicle_color, 'verde'),
      'vehicle_custom_url', s.vehicle_custom_url,
      'pin_color', COALESCE(s.pin_color, 'verde'),
      'pin_custom_url', s.pin_custom_url,
      'msg_aguardando', COALESCE(s.msg_aguardando, 'Recebemos seu pedido e já estamos preparando tudo.'),
      'msg_preparando', COALESCE(s.msg_preparando, 'Seu pedido está sendo preparado com carinho.'),
      'msg_saiu', COALESCE(s.msg_saiu, 'Seu pedido já saiu para entrega e está a caminho.'),
      'msg_chegando', COALESCE(s.msg_chegando, 'Seu entregador está próximo do destino.'),
      'msg_entregue', COALESCE(s.msg_entregue, 'Pedido entregue com sucesso. Obrigado pela preferência.'),
      'msg_cancelado', COALESCE(s.msg_cancelado, 'Este pedido foi cancelado.')
    ),
    'courier', jsonb_build_object(
      'name', CASE WHEN COALESCE(s.show_courier_name, true) THEN t.courier_name ELSE NULL END,
      'phone', CASE WHEN COALESCE(s.show_courier_phone, false) THEN t.courier_phone ELSE NULL END
    )
  );
  RETURN result;
END;
$function$;