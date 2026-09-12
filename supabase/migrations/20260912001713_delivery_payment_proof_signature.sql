ALTER TABLE public.delivery_tracking
  ADD COLUMN IF NOT EXISTS signature_url text;

CREATE OR REPLACE FUNCTION public.finalize_courier_delivery(
  _token text,
  _proof_url text DEFAULT NULL,
  _signature_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.delivery_tracking;
  proof text := NULLIF(btrim(COALESCE(_proof_url, '')), '');
  signature text := NULLIF(btrim(COALESCE(_signature_url, '')), '');
BEGIN
  SELECT * INTO t
  FROM public.delivery_tracking
  WHERE courier_token = _token
  LIMIT 1
  FOR UPDATE;

  IF t.id IS NULL THEN RAISE EXCEPTION 'Rastreamento não encontrado'; END IF;

  IF proof IS NOT NULL THEN
    IF proof !~ '^data:image/(png|jpeg|jpg|webp);base64,' THEN
      RAISE EXCEPTION 'Comprovante deve ser uma imagem PNG, JPG ou WEBP';
    END IF;
    IF length(proof) > 4500000 THEN RAISE EXCEPTION 'Comprovante muito grande'; END IF;
  END IF;

  IF signature IS NOT NULL THEN
    IF signature !~ '^data:image/png;base64,' THEN RAISE EXCEPTION 'Assinatura inválida'; END IF;
    IF length(signature) > 1000000 THEN RAISE EXCEPTION 'Assinatura muito grande'; END IF;
  END IF;

  IF t.status IN ('cancelado','devolvido') THEN RAISE EXCEPTION 'Entrega já finalizada'; END IF;

  IF t.status = 'entregue' THEN
    UPDATE public.delivery_tracking
      SET proof_url = COALESCE(proof, proof_url),
          signature_url = COALESCE(signature, signature_url),
          updated_at = now()
    WHERE id = t.id;
    RETURN jsonb_build_object('changed', false, 'status', 'entregue');
  END IF;

  UPDATE public.delivery_tracking
    SET status = 'entregue',
        completed_at = COALESCE(completed_at, now()),
        proof_url = COALESCE(proof, proof_url),
        signature_url = COALESCE(signature, signature_url),
        updated_at = now()
  WHERE id = t.id;

  UPDATE public.orders SET status = 'entregue' WHERE id = t.order_id;

  INSERT INTO public.delivery_events(
    delivery_tracking_id, order_id, courier_id, store_id,
    event_type, old_status, new_status, metadata
  )
  VALUES(
    t.id, t.order_id, t.courier_id, t.store_id,
    'delivered', t.status::text, 'entregue',
    jsonb_strip_nulls(jsonb_build_object(
      'payment_proof', CASE WHEN proof IS NOT NULL THEN true ELSE NULL END,
      'signature', CASE WHEN signature IS NOT NULL THEN true ELSE NULL END
    ))
  );

  RETURN jsonb_build_object('changed', true, 'status', 'entregue');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.finalize_courier_delivery(text,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_courier_view(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.delivery_tracking; s public.delivery_tracking_settings;
  st public.settings; o public.orders; inherit boolean;
BEGIN
  SELECT * INTO t FROM public.delivery_tracking WHERE courier_token=_token LIMIT 1;
  IF t.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.delivery_tracking_settings WHERE store_id=t.store_id LIMIT 1;
  SELECT * INTO st FROM public.settings WHERE store_id=t.store_id LIMIT 1;
  SELECT * INTO o FROM public.orders WHERE id=t.order_id LIMIT 1;
  inherit := COALESCE(s.courier_inherit_client,true);
  RETURN jsonb_build_object(
    'id',t.id,'tracking_code',t.tracking_code,'status',t.status,
    'courier_name',t.courier_name,'courier_phone',t.courier_phone,'notes',t.notes,
    'started_at',t.started_at,'completed_at',t.completed_at,
    'proof_url',t.proof_url,'signature_url',t.signature_url,
    'order',jsonb_build_object('id',o.id,'customer',o.customer,'phone',o.phone,'address',o.address,
      'district',o.district,'city',o.city,'total',o.total,'notes',o.notes,'date',o.date,
      'payment',o.payment,'items',o.items),
    'store',jsonb_build_object('name',COALESCE(st.store_name,'Loja'),'whatsapp',COALESCE(st.whatsapp,''),
      'logo_url',CASE WHEN inherit THEN COALESCE(s.logo_url,st.checkout_logo_url)
        ELSE COALESCE(s.courier_logo_url,s.logo_url,st.checkout_logo_url) END),
    'settings',jsonb_build_object(
      'inherit_client',inherit,
      'primary_color',CASE WHEN inherit THEN COALESCE(s.primary_color,'#10b981') ELSE COALESCE(s.courier_primary_color,s.primary_color,'#10b981') END,
      'secondary_color',CASE WHEN inherit THEN COALESCE(s.secondary_color,'#0b1220') ELSE COALESCE(s.courier_secondary_color,s.secondary_color,'#0b1220') END,
      'header_style',CASE WHEN inherit THEN COALESCE(s.header_style,'solid') ELSE COALESCE(s.courier_header_style,s.header_style,'solid') END,
      'header_color',CASE WHEN inherit THEN COALESCE(s.header_color,s.primary_color,'#10b981') ELSE COALESCE(s.courier_header_color,s.header_color,s.primary_color,'#10b981') END,
      'header_height',CASE WHEN inherit THEN COALESCE(s.header_height,110) ELSE COALESCE(s.courier_header_height,s.header_height,110) END,
      'header_logo_size',CASE WHEN inherit THEN COALESCE(s.header_logo_size,56) ELSE COALESCE(s.courier_header_logo_size,s.header_logo_size,56) END,
      'header_logo_align',CASE WHEN inherit THEN COALESCE(s.header_logo_align,'center') ELSE COALESCE(s.courier_header_logo_align,s.header_logo_align,'center') END,
      'background_color',CASE WHEN inherit THEN COALESCE(s.background_color,'#0b1220') ELSE COALESCE(s.courier_background_color,s.background_color,'#0b1220') END,
      'card_color',CASE WHEN inherit THEN COALESCE(s.card_color,'#0f172a') ELSE COALESCE(s.courier_card_color,s.card_color,'#0f172a') END,
      'card_border_color',CASE WHEN inherit THEN COALESCE(s.card_border_color,'#1e293b') ELSE COALESCE(s.courier_card_border_color,s.card_border_color,'#1e293b') END,
      'card_shadow_color',CASE WHEN inherit THEN COALESCE(s.card_shadow_color,'#000000') ELSE COALESCE(s.courier_card_shadow_color,s.card_shadow_color,'#000000') END,
      'text_color',CASE WHEN inherit THEN COALESCE(s.text_color,'#ffffff') ELSE COALESCE(s.courier_text_color,s.text_color,'#ffffff') END,
      'title_color',CASE WHEN inherit THEN COALESCE(s.title_color,s.text_color,'#ffffff') ELSE COALESCE(s.courier_title_color,s.title_color,'#ffffff') END,
      'button_color',CASE WHEN inherit THEN COALESCE(s.button_color,'#10b981') ELSE COALESCE(s.courier_button_color,s.button_color,'#10b981') END,
      'icon_color',CASE WHEN inherit THEN COALESCE(s.primary_color,'#10b981') ELSE COALESCE(s.courier_icon_color,s.primary_color,'#10b981') END,
      'footer_text',COALESCE(s.courier_footer_text,'Powered by Zappfy')
    )
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
