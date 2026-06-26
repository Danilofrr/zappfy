DROP FUNCTION IF EXISTS public.submit_public_order(text, text, text, text, text, text, text, text, uuid, integer, numeric, numeric, numeric, text, text);

CREATE OR REPLACE FUNCTION public.submit_public_order(
  _slug text,
  _customer text,
  _phone text,
  _cep text,
  _address text,
  _reference text,
  _district text,
  _city text,
  _product_id uuid,
  _quantity integer,
  _unit_price numeric,
  _shipping_value numeric,
  _total numeric,
  _payment text,
  _notes text DEFAULT ''::text,
  _cpf text DEFAULT ''::text,
  _email text DEFAULT ''::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner_id uuid;
  _product record;
  _items jsonb;
  _order_id uuid;
  _safe_quantity integer;
  _safe_unit_price numeric;
  _safe_shipping_value numeric;
  _safe_total numeric;
  _safe_cost numeric;
  _combined_notes text;
  _clean_notes text;
  _clean_cpf text;
  _clean_email text;
BEGIN
  _safe_quantity := COALESCE(_quantity, 0);
  _safe_unit_price := COALESCE(_unit_price, 0);
  _safe_shipping_value := COALESCE(_shipping_value, 0);
  _safe_total := COALESCE(_total, 0);
  _clean_notes := COALESCE(_notes, '');
  _clean_cpf := trim(COALESCE(_cpf, ''));
  _clean_email := trim(COALESCE(_email, ''));

  IF COALESCE(trim(_slug), '') = '' THEN RAISE EXCEPTION 'Loja não informada'; END IF;
  IF COALESCE(trim(_customer), '') = '' THEN RAISE EXCEPTION 'Nome do cliente não preenchido'; END IF;
  IF COALESCE(trim(_phone), '') = '' THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF COALESCE(trim(_address), '') = '' THEN RAISE EXCEPTION 'Endereço não preenchido'; END IF;
  IF _safe_quantity < 1 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF _safe_unit_price < 0 THEN RAISE EXCEPTION 'Valor unitário inválido'; END IF;
  IF _safe_shipping_value < 0 THEN RAISE EXCEPTION 'Valor de entrega inválido'; END IF;
  IF _safe_total <= 0 THEN RAISE EXCEPTION 'Valor total inválido'; END IF;
  IF _payment NOT IN ('pix', 'cartao', 'dinheiro') THEN RAISE EXCEPTION 'Forma de pagamento não selecionada'; END IF;

  SELECT s.user_id INTO _owner_id
  FROM public.settings s
  WHERE lower(s.slug) = lower(trim(_slug))
  LIMIT 1;

  IF _owner_id IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;

  SELECT p.id, p.name, p.price, p.cost, p.stock
  INTO _product
  FROM public.products p
  WHERE p.id = _product_id AND p.user_id = _owner_id
  FOR UPDATE
  LIMIT 1;

  IF _product.id IS NULL THEN RAISE EXCEPTION 'Produto inválido'; END IF;
  IF COALESCE(_product.stock, 0) < _safe_quantity THEN RAISE EXCEPTION 'Estoque insuficiente'; END IF;

  _safe_unit_price := COALESCE(_product.price, _safe_unit_price, 0);
  _safe_cost := COALESCE(_product.cost, _safe_unit_price, 0);
  _safe_total := round(((_safe_unit_price * _safe_quantity) + _safe_shipping_value)::numeric, 2);

  _items := jsonb_build_array(jsonb_build_object(
    'productId', _product.id,
    'name', _product.name,
    'qty', _safe_quantity,
    'price', _safe_unit_price,
    'cost', _safe_cost,
    'cep', COALESCE(_cep, ''),
    'reference', COALESCE(_reference, ''),
    'shipping', _safe_shipping_value,
    'cpf', _clean_cpf,
    'email', _clean_email
  ));

  _combined_notes := NULLIF(concat_ws(E'\n',
    CASE WHEN _clean_cpf <> '' AND _clean_notes !~* '^\s*\*?\s*(CPF|CPF/CNPJ)(\s+do\s+cliente)?\s*\*?\s*:' THEN 'CPF: ' || _clean_cpf ELSE NULL END,
    CASE WHEN _clean_email <> '' AND _clean_notes !~* '^\s*\*?\s*E-?mail(\s+do\s+cliente)?\s*\*?\s*:' THEN 'E-mail: ' || _clean_email ELSE NULL END,
    NULLIF(_clean_notes, ''),
    NULLIF('CEP: ' || COALESCE(_cep, ''), 'CEP: '),
    NULLIF('Ponto de referência: ' || COALESCE(_reference, ''), 'Ponto de referência: ')
  ), '');

  INSERT INTO public.orders (
    user_id, customer, phone, address, district, city, items, total, payment, status, notes, date
  ) VALUES (
    _owner_id, trim(_customer), trim(_phone), COALESCE(trim(_address), ''), COALESCE(trim(_district), ''), COALESCE(trim(_city), ''),
    _items, _safe_total, _payment, 'aguardando', _combined_notes, now()
  )
  RETURNING id INTO _order_id;

  UPDATE public.products
  SET stock = GREATEST(COALESCE(stock, 0) - _safe_quantity, 0)
  WHERE id = _product.id AND user_id = _owner_id;

  RETURN _order_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_public_order(text, text, text, text, text, text, text, text, uuid, integer, numeric, numeric, numeric, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_order(text, text, text, text, text, text, text, text, uuid, integer, numeric, numeric, numeric, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_order(text, text, text, text, text, text, text, text, uuid, integer, numeric, numeric, numeric, text, text, text, text) TO service_role;