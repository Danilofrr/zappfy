CREATE OR REPLACE FUNCTION public.submit_public_order_multi(
  _slug text, _customer text, _phone text, _cep text, _address text, _reference text,
  _district text, _city text, _items jsonb, _shipping_value numeric, _total numeric,
  _payment text, _notes text DEFAULT ''::text, _cpf text DEFAULT ''::text, _email text DEFAULT ''::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _store_id uuid; _owner_id uuid; _order_id uuid;
  _el jsonb; _product record; _qty integer;
  _built jsonb := '[]'::jsonb;
  _subtotal numeric := 0;
  _safe_shipping numeric; _safe_total numeric;
  _combined_notes text; _clean_notes text; _clean_cpf text; _clean_email text;
BEGIN
  _safe_shipping := COALESCE(_shipping_value,0);
  _clean_notes := COALESCE(_notes,'');
  _clean_cpf := trim(COALESCE(_cpf,''));
  _clean_email := trim(COALESCE(_email,''));

  IF COALESCE(trim(_slug),'')='' THEN RAISE EXCEPTION 'Loja não informada'; END IF;
  IF COALESCE(trim(_customer),'')='' THEN RAISE EXCEPTION 'Nome do cliente não preenchido'; END IF;
  IF COALESCE(trim(_phone),'')='' THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF COALESCE(trim(_address),'')='' THEN RAISE EXCEPTION 'Endereço não preenchido'; END IF;
  IF _safe_shipping<0 THEN RAISE EXCEPTION 'Valor de entrega inválido'; END IF;
  IF _payment NOT IN ('pix','cartao','debito','dinheiro') THEN RAISE EXCEPTION 'Forma de pagamento não selecionada'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Produto inválido';
  END IF;

  SELECT s.store_id, s.user_id INTO _store_id, _owner_id
  FROM public.settings s WHERE lower(s.slug)=lower(trim(_slug)) LIMIT 1;
  IF _store_id IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;

  FOR _el IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := COALESCE((_el->>'qty')::integer, 0);
    IF _qty < 1 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

    SELECT p.id,p.name,p.price,p.cost,p.stock INTO _product
    FROM public.products p
    WHERE p.id = (_el->>'productId')::uuid AND p.store_id = _store_id
    FOR UPDATE LIMIT 1;
    IF _product.id IS NULL THEN RAISE EXCEPTION 'Produto inválido'; END IF;
    IF COALESCE(_product.stock,0) < _qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para %', _product.name;
    END IF;

    _subtotal := _subtotal + (COALESCE(_product.price,0) * _qty);

    _built := _built || jsonb_build_object(
      'productId',_product.id,'name',_product.name,'qty',_qty,
      'price',COALESCE(_product.price,0),'cost',COALESCE(_product.cost,0),
      'cep',COALESCE(_cep,''),'reference',COALESCE(_reference,''),
      'shipping',_safe_shipping,'cpf',_clean_cpf,'email',_clean_email
    );

    UPDATE public.products SET stock = GREATEST(COALESCE(stock,0) - _qty, 0)
    WHERE id = _product.id AND store_id = _store_id;
  END LOOP;

  _safe_total := round((_subtotal + _safe_shipping)::numeric, 2);
  IF _safe_total <= 0 THEN RAISE EXCEPTION 'Valor total inválido'; END IF;

  _combined_notes := NULLIF(concat_ws(E'\n',
    CASE WHEN _clean_cpf<>'' AND _clean_notes !~* '^\s*\*?\s*(CPF|CPF/CNPJ)(\s+do\s+cliente)?\s*\*?\s*:' THEN 'CPF: '||_clean_cpf ELSE NULL END,
    CASE WHEN _clean_email<>'' AND _clean_notes !~* '^\s*\*?\s*E-?mail(\s+do\s+cliente)?\s*\*?\s*:' THEN 'E-mail: '||_clean_email ELSE NULL END,
    NULLIF(_clean_notes,''),
    NULLIF('CEP: '||COALESCE(_cep,''),'CEP: '),
    NULLIF('Ponto de referência: '||COALESCE(_reference,''),'Ponto de referência: ')
  ),'');

  INSERT INTO public.orders (user_id, store_id, customer, phone, address, district, city, items, total, payment, status, notes, date)
  VALUES (_owner_id, _store_id, trim(_customer), trim(_phone), COALESCE(trim(_address),''),
    COALESCE(trim(_district),''), COALESCE(trim(_city),''),
    _built, _safe_total, _payment, 'aguardando', _combined_notes, now())
  RETURNING id INTO _order_id;

  RETURN _order_id;
END;$function$;

REVOKE ALL ON FUNCTION public.submit_public_order_multi(text,text,text,text,text,text,text,text,jsonb,numeric,numeric,text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_public_order_multi(text,text,text,text,text,text,text,text,jsonb,numeric,numeric,text,text,text,text) TO anon, authenticated, service_role;