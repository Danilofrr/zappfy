-- Registra a forma real como o motoboy recebeu o pagamento na entrega.
-- Permite dividir o total entre PIX, dinheiro e cartão.

ALTER TABLE public.delivery_tracking
  ADD COLUMN IF NOT EXISTS received_payments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS received_payment_total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_payment_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_tracking_received_payments_array_check'
  ) THEN
    ALTER TABLE public.delivery_tracking
      ADD CONSTRAINT delivery_tracking_received_payments_array_check
      CHECK (jsonb_typeof(received_payments) = 'array');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.save_courier_received_payments(
  _token text,
  _payments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.delivery_tracking;
  o public.orders;
  item jsonb;
  method text;
  amount numeric(12,2);
  total_received numeric(12,2) := 0;
  normalized jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO t
  FROM public.delivery_tracking
  WHERE courier_token = _token
  LIMIT 1
  FOR UPDATE;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Entrega não encontrada';
  END IF;

  SELECT * INTO o
  FROM public.orders
  WHERE id = t.order_id
  LIMIT 1;

  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF COALESCE(jsonb_typeof(_payments), 'null') <> 'array' THEN
    RAISE EXCEPTION 'Pagamento recebido inválido';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(_payments)
  LOOP
    method := lower(btrim(COALESCE(item->>'method', '')));
    IF method = 'debito' THEN method := 'cartao'; END IF;

    IF method NOT IN ('pix', 'dinheiro', 'cartao') THEN
      RAISE EXCEPTION 'Forma de pagamento inválida: %', method;
    END IF;

    IF COALESCE(item->>'amount', '') !~ '^\d+(\.\d{1,2})?$' THEN
      RAISE EXCEPTION 'Valor inválido para %', method;
    END IF;

    amount := round((item->>'amount')::numeric, 2);
    IF amount <= 0 THEN
      RAISE EXCEPTION 'O valor de % deve ser maior que zero', method;
    END IF;

    total_received := total_received + amount;
    normalized := normalized || jsonb_build_array(
      jsonb_build_object('method', method, 'amount', amount)
    );
  END LOOP;

  total_received := round(total_received, 2);

  IF abs(total_received - COALESCE(o.total, 0)) > 0.01 THEN
    RAISE EXCEPTION 'A soma recebida (R$ %) deve ser igual ao total do pedido (R$ %)',
      to_char(total_received, 'FM999999990.00'),
      to_char(COALESCE(o.total, 0), 'FM999999990.00');
  END IF;

  UPDATE public.delivery_tracking
  SET received_payments = normalized,
      received_payment_total = total_received,
      received_payment_updated_at = now(),
      updated_at = now()
  WHERE id = t.id;

  RETURN jsonb_build_object(
    'saved', true,
    'payments', normalized,
    'total', total_received
  );
END;
$function$;

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
    'received_payments',t.received_payments,
    'received_payment_total',t.received_payment_total,
    'received_payment_updated_at',t.received_payment_updated_at,
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
