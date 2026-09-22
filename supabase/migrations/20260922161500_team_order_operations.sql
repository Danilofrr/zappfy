-- Operações de pedidos para funcionários, sem expor custo/lucro.
CREATE OR REPLACE FUNCTION public.team_order_json(_store_id uuid, _order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $team_order_json$
  SELECT jsonb_build_object(
    'id', o.id,
    'customer', o.customer,
    'phone', o.phone,
    'address', o.address,
    'district', o.district,
    'city', o.city,
    'items', COALESCE((
      SELECT jsonb_agg((item - 'cost') || jsonb_build_object('cost', 0))
      FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) item
    ), '[]'::jsonb),
    'total', o.total,
    'payment', o.payment,
    'status', o.status,
    'notes', o.notes,
    'date', o.date
  )
  FROM public.orders o
  WHERE o.id = _order_id
    AND o.store_id = _store_id;
$team_order_json$;

CREATE OR REPLACE FUNCTION public.team_create_order(_store_id uuid, _order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $team_create_order$
DECLARE
  owner_id_value uuid;
  new_id uuid;
  raw_items jsonb := COALESCE(_order->'items', '[]'::jsonb);
  enriched_items jsonb := '[]'::jsonb;
  item jsonb;
  product_row public.products;
  qty integer;
  status_value text := COALESCE(NULLIF(_order->>'status',''), 'aguardando');
BEGIN
  IF NOT public.team_has_permission(_store_id, 'orders') THEN
    RAISE EXCEPTION 'Sem permissão para criar pedidos';
  END IF;

  SELECT owner_id INTO owner_id_value FROM public.stores WHERE id = _store_id;
  IF owner_id_value IS NULL THEN RAISE EXCEPTION 'Loja não encontrada'; END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(raw_items)
  LOOP
    SELECT * INTO product_row
    FROM public.products
    WHERE id = NULLIF(item->>'productId','')::uuid
      AND store_id = _store_id
    LIMIT 1;

    IF product_row.id IS NULL THEN
      RAISE EXCEPTION 'Produto inválido no pedido';
    END IF;

    qty := GREATEST(COALESCE((item->>'qty')::integer, 1), 1);
    enriched_items := enriched_items || jsonb_build_array(
      (item - 'cost') || jsonb_build_object('cost', COALESCE(product_row.cost, 0))
    );

    IF status_value <> 'cancelado' THEN
      UPDATE public.products
      SET stock = GREATEST(COALESCE(stock,0) - qty, 0)
      WHERE id = product_row.id;
    END IF;
  END LOOP;

  INSERT INTO public.orders(
    user_id, store_id, customer, phone, address, district, city,
    items, total, payment, status, notes, date
  )
  VALUES (
    owner_id_value,
    _store_id,
    COALESCE(_order->>'customer',''),
    COALESCE(_order->>'phone',''),
    COALESCE(_order->>'address',''),
    COALESCE(_order->>'district',''),
    COALESCE(_order->>'city',''),
    enriched_items,
    COALESCE((_order->>'total')::numeric,0),
    COALESCE(_order->>'payment','pix'),
    status_value,
    NULLIF(_order->>'notes',''),
    COALESCE((_order->>'date')::timestamptz, now())
  )
  RETURNING id INTO new_id;

  RETURN public.team_order_json(_store_id, new_id);
END;
$team_create_order$;

CREATE OR REPLACE FUNCTION public.team_update_order(_store_id uuid, _order_id uuid, _patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $team_update_order$
DECLARE
  current_order public.orders;
  enriched_items jsonb;
  item jsonb;
  product_row public.products;
BEGIN
  IF NOT public.team_has_permission(_store_id, 'orders') THEN
    RAISE EXCEPTION 'Sem permissão para editar pedidos';
  END IF;

  SELECT * INTO current_order
  FROM public.orders
  WHERE id = _order_id AND store_id = _store_id
  FOR UPDATE;

  IF current_order.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  enriched_items := current_order.items;
  IF _patch ? 'items' THEN
    enriched_items := '[]'::jsonb;
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(_patch->'items','[]'::jsonb))
    LOOP
      SELECT * INTO product_row
      FROM public.products
      WHERE id = NULLIF(item->>'productId','')::uuid
        AND store_id = _store_id
      LIMIT 1;
      IF product_row.id IS NULL THEN RAISE EXCEPTION 'Produto inválido no pedido'; END IF;
      enriched_items := enriched_items || jsonb_build_array(
        (item - 'cost') || jsonb_build_object('cost', COALESCE(product_row.cost, 0))
      );
    END LOOP;
  END IF;

  UPDATE public.orders
  SET
    customer = CASE WHEN _patch ? 'customer' THEN _patch->>'customer' ELSE customer END,
    phone = CASE WHEN _patch ? 'phone' THEN _patch->>'phone' ELSE phone END,
    address = CASE WHEN _patch ? 'address' THEN _patch->>'address' ELSE address END,
    district = CASE WHEN _patch ? 'district' THEN _patch->>'district' ELSE district END,
    city = CASE WHEN _patch ? 'city' THEN _patch->>'city' ELSE city END,
    notes = CASE WHEN _patch ? 'notes' THEN NULLIF(_patch->>'notes','') ELSE notes END,
    payment = CASE WHEN _patch ? 'payment' THEN _patch->>'payment' ELSE payment END,
    items = enriched_items,
    total = CASE WHEN _patch ? 'total' THEN (_patch->>'total')::numeric ELSE total END,
    date = CASE WHEN _patch ? 'date' THEN (_patch->>'date')::timestamptz ELSE date END,
    updated_at = now()
  WHERE id = _order_id AND store_id = _store_id;

  RETURN public.team_order_json(_store_id, _order_id);
END;
$team_update_order$;

CREATE OR REPLACE FUNCTION public.team_update_order_status(_store_id uuid, _order_id uuid, _status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $team_update_order_status$
DECLARE
  current_order public.orders;
  item jsonb;
  qty integer;
  product_id_value uuid;
BEGIN
  IF NOT public.team_has_permission(_store_id, 'orders') THEN
    RAISE EXCEPTION 'Sem permissão para atualizar pedidos';
  END IF;

  SELECT * INTO current_order
  FROM public.orders
  WHERE id = _order_id AND store_id = _store_id
  FOR UPDATE;

  IF current_order.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  IF current_order.status <> 'cancelado' AND _status = 'cancelado' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(current_order.items,'[]'::jsonb))
    LOOP
      product_id_value := NULLIF(item->>'productId','')::uuid;
      qty := GREATEST(COALESCE((item->>'qty')::integer,1),1);
      UPDATE public.products SET stock = COALESCE(stock,0) + qty
      WHERE id = product_id_value AND store_id = _store_id;
    END LOOP;
  ELSIF current_order.status = 'cancelado' AND _status <> 'cancelado' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(current_order.items,'[]'::jsonb))
    LOOP
      product_id_value := NULLIF(item->>'productId','')::uuid;
      qty := GREATEST(COALESCE((item->>'qty')::integer,1),1);
      UPDATE public.products SET stock = GREATEST(COALESCE(stock,0) - qty,0)
      WHERE id = product_id_value AND store_id = _store_id;
    END LOOP;
  END IF;

  UPDATE public.orders
  SET status = _status, updated_at = now()
  WHERE id = _order_id AND store_id = _store_id;

  RETURN public.team_order_json(_store_id, _order_id);
END;
$team_update_order_status$;

CREATE OR REPLACE FUNCTION public.team_delete_order(_store_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $team_delete_order$
DECLARE
  current_order public.orders;
  item jsonb;
  qty integer;
  product_id_value uuid;
BEGIN
  IF NOT public.team_has_permission(_store_id, 'orders') THEN
    RAISE EXCEPTION 'Sem permissão para excluir pedidos';
  END IF;

  SELECT * INTO current_order
  FROM public.orders
  WHERE id = _order_id AND store_id = _store_id
  FOR UPDATE;

  IF current_order.id IS NULL THEN RETURN false; END IF;

  IF current_order.status <> 'cancelado' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(current_order.items,'[]'::jsonb))
    LOOP
      product_id_value := NULLIF(item->>'productId','')::uuid;
      qty := GREATEST(COALESCE((item->>'qty')::integer,1),1);
      UPDATE public.products SET stock = COALESCE(stock,0) + qty
      WHERE id = product_id_value AND store_id = _store_id;
    END LOOP;
  END IF;

  DELETE FROM public.orders WHERE id = _order_id AND store_id = _store_id;
  RETURN true;
END;
$team_delete_order$;

GRANT EXECUTE ON FUNCTION public.team_order_json(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_create_order(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_update_order(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_update_order_status(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_delete_order(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
