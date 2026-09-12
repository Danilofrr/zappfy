-- Faz o checkout considerar o estoque fisico da loja + a carga avulsa dos motoboys.
-- Para pedidos novos, a parte atendida pelo estoque movel fica apenas reservada no checkout
-- e so e abatida da carga do motoboy quando o pedido for atribuido a ele.
-- Pedidos antigos nao sao reconciliados nem descontam carga retroativamente.

create or replace function public.get_public_product_available_stock(_product_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  _store_id uuid;
  _warehouse integer := 0;
  _mobile integer := 0;
  _pending_mobile integer := 0;
begin
  select p.store_id, greatest(coalesce(p.stock, 0), 0)
  into _store_id, _warehouse
  from public.products p
  where p.id = _product_id
  limit 1;

  if _store_id is null then
    return 0;
  end if;

  select coalesce(sum(ci.quantity), 0)::integer
  into _mobile
  from public.courier_inventory ci
  join public.couriers c
    on c.id = ci.courier_id
   and c.store_id = ci.store_id
   and c.active = true
  where ci.store_id = _store_id
    and ci.product_id = _product_id
    and ci.quantity > 0;

  with reservations as (
    select
      o.id as order_id,
      sum(
        case
          when coalesce(item->>'inventoryReservationVersion', '') = '2'
           and coalesce(item->>'mobileReservedQty', '') ~ '^\d+$'
          then (item->>'mobileReservedQty')::integer
          else 0
        end
      )::integer as reserved_qty
    from public.orders o
    cross join lateral jsonb_array_elements(coalesce(o.items::jsonb, '[]'::jsonb)) item
    where o.store_id = _store_id
      and coalesce(o.status, '') not in ('entregue', 'cancelado')
      and item->>'productId' = _product_id::text
    group by o.id
  ), movement_balance as (
    select
      m.order_id,
      greatest(-coalesce(sum(m.quantity_delta), 0), 0)::integer as consumed_qty
    from public.courier_inventory_movements m
    where m.store_id = _store_id
      and m.product_id = _product_id
      and m.order_id is not null
      and m.movement_type in ('assigned', 'unassigned')
    group by m.order_id
  )
  select coalesce(
    sum(greatest(r.reserved_qty - coalesce(m.consumed_qty, 0), 0)),
    0
  )::integer
  into _pending_mobile
  from reservations r
  left join movement_balance m on m.order_id = r.order_id;

  return greatest(_warehouse + _mobile - _pending_mobile, 0);
end;
$function$;

revoke all on function public.get_public_product_available_stock(uuid) from public;
grant execute on function public.get_public_product_available_stock(uuid) to anon, authenticated, service_role;

create or replace view public.products_public
with (security_invoker = on)
as
select
  p.id,
  p.user_id,
  p.name,
  p.price,
  public.get_public_product_available_stock(p.id) as stock,
  p.image_url,
  p.created_at
from public.products p
join public.settings s on s.user_id = p.user_id
where s.slug is not null;

grant select on public.products_public to anon, authenticated;

create or replace function public.submit_public_order_multi(
  _slug text,
  _customer text,
  _phone text,
  _cep text,
  _address text,
  _reference text,
  _district text,
  _city text,
  _items jsonb,
  _shipping_value numeric,
  _total numeric,
  _payment text,
  _notes text default ''::text,
  _cpf text default ''::text,
  _email text default ''::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _store_id uuid;
  _owner_id uuid;
  _order_id uuid;
  _el jsonb;
  _product record;
  _qty integer;
  _built jsonb := '[]'::jsonb;
  _subtotal numeric := 0;
  _safe_shipping numeric;
  _safe_total numeric;
  _combined_notes text;
  _clean_notes text;
  _clean_cpf text;
  _clean_email text;
  _available integer;
  _warehouse_reserved integer;
  _mobile_reserved integer;
  _local_mobile_reserved integer;
begin
  _safe_shipping := coalesce(_shipping_value, 0);
  _clean_notes := coalesce(_notes, '');
  _clean_cpf := trim(coalesce(_cpf, ''));
  _clean_email := trim(coalesce(_email, ''));

  if coalesce(trim(_slug), '') = '' then raise exception 'Loja não informada'; end if;
  if coalesce(trim(_customer), '') = '' then raise exception 'Nome do cliente não preenchido'; end if;
  if coalesce(trim(_phone), '') = '' then raise exception 'WhatsApp inválido'; end if;
  if coalesce(trim(_address), '') = '' then raise exception 'Endereço não preenchido'; end if;
  if _safe_shipping < 0 then raise exception 'Valor de entrega inválido'; end if;
  if _payment not in ('pix', 'cartao', 'debito', 'dinheiro') then raise exception 'Forma de pagamento não selecionada'; end if;
  if _items is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'Produto inválido';
  end if;

  select s.store_id, s.user_id
  into _store_id, _owner_id
  from public.settings s
  where lower(s.slug) = lower(trim(_slug))
  limit 1;

  if _store_id is null then raise exception 'Loja não encontrada'; end if;

  for _el in select * from jsonb_array_elements(_items)
  loop
    _qty := coalesce((_el->>'qty')::integer, 0);
    if _qty < 1 then raise exception 'Quantidade inválida'; end if;

    perform pg_advisory_xact_lock(
      hashtextextended(_store_id::text || ':' || coalesce(_el->>'productId', ''), 0)
    );

    select p.id, p.name, p.price, p.cost, p.stock
    into _product
    from public.products p
    where p.id = (_el->>'productId')::uuid
      and p.store_id = _store_id
    for update
    limit 1;

    if _product.id is null then raise exception 'Produto inválido'; end if;

    select coalesce(sum(
      case
        when b->>'productId' = _product.id::text
         and coalesce(b->>'mobileReservedQty', '') ~ '^\d+$'
        then (b->>'mobileReservedQty')::integer
        else 0
      end
    ), 0)::integer
    into _local_mobile_reserved
    from jsonb_array_elements(_built) b;

    _available := public.get_public_product_available_stock(_product.id) - _local_mobile_reserved;

    if _available < _qty then
      raise exception 'Estoque insuficiente para %', _product.name;
    end if;

    _warehouse_reserved := least(greatest(coalesce(_product.stock, 0), 0), _qty);
    _mobile_reserved := _qty - _warehouse_reserved;

    _subtotal := _subtotal + (coalesce(_product.price, 0) * _qty);

    _built := _built || jsonb_build_object(
      'productId', _product.id,
      'name', _product.name,
      'qty', _qty,
      'price', coalesce(_product.price, 0),
      'cost', coalesce(_product.cost, 0),
      'cep', coalesce(_cep, ''),
      'reference', coalesce(_reference, ''),
      'shipping', _safe_shipping,
      'cpf', _clean_cpf,
      'email', _clean_email,
      'inventoryReservationVersion', 2,
      'warehouseReservedQty', _warehouse_reserved,
      'mobileReservedQty', _mobile_reserved
    );

    if _warehouse_reserved > 0 then
      update public.products
      set stock = greatest(coalesce(stock, 0) - _warehouse_reserved, 0)
      where id = _product.id
        and store_id = _store_id;
    end if;
  end loop;

  _safe_total := round((_subtotal + _safe_shipping)::numeric, 2);
  if _safe_total <= 0 then raise exception 'Valor total inválido'; end if;

  _combined_notes := nullif(concat_ws(E'\n',
    case when _clean_cpf <> '' and _clean_notes !~* '^\s*\*?\s*(CPF|CPF/CNPJ)(\s+do\s+cliente)?\s*\*?\s*:' then 'CPF: ' || _clean_cpf else null end,
    case when _clean_email <> '' and _clean_notes !~* '^\s*\*?\s*E-?mail(\s+do\s+cliente)?\s*\*?\s*:' then 'E-mail: ' || _clean_email else null end,
    nullif(_clean_notes, ''),
    nullif('CEP: ' || coalesce(_cep, ''), 'CEP: '),
    nullif('Ponto de referência: ' || coalesce(_reference, ''), 'Ponto de referência: ')
  ), '');

  insert into public.orders (
    user_id, store_id, customer, phone, address, district, city,
    items, total, payment, status, notes, date
  )
  values (
    _owner_id, _store_id, trim(_customer), trim(_phone), coalesce(trim(_address), ''),
    coalesce(trim(_district), ''), coalesce(trim(_city), ''),
    _built, _safe_total, _payment, 'aguardando', _combined_notes, now()
  )
  returning id into _order_id;

  return _order_id;
end;
$function$;

create or replace function public.submit_public_order(
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
  _notes text default ''::text,
  _cpf text default ''::text,
  _email text default ''::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _store_id uuid;
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
  _available integer;
  _warehouse_reserved integer;
  _mobile_reserved integer;
begin
  _safe_quantity := coalesce(_quantity, 0);
  _safe_unit_price := coalesce(_unit_price, 0);
  _safe_shipping_value := coalesce(_shipping_value, 0);
  _safe_total := coalesce(_total, 0);
  _clean_notes := coalesce(_notes, '');
  _clean_cpf := trim(coalesce(_cpf, ''));
  _clean_email := trim(coalesce(_email, ''));

  if coalesce(trim(_slug), '') = '' then raise exception 'Loja não informada'; end if;
  if coalesce(trim(_customer), '') = '' then raise exception 'Nome do cliente não preenchido'; end if;
  if coalesce(trim(_phone), '') = '' then raise exception 'WhatsApp inválido'; end if;
  if coalesce(trim(_address), '') = '' then raise exception 'Endereço não preenchido'; end if;
  if _safe_quantity < 1 then raise exception 'Quantidade inválida'; end if;
  if _safe_unit_price < 0 then raise exception 'Valor unitário inválido'; end if;
  if _safe_shipping_value < 0 then raise exception 'Valor de entrega inválido'; end if;
  if _safe_total <= 0 then raise exception 'Valor total inválido'; end if;
  if _payment not in ('pix', 'cartao', 'debito', 'dinheiro') then raise exception 'Forma de pagamento não selecionada'; end if;

  select s.store_id, s.user_id
  into _store_id, _owner_id
  from public.settings s
  where lower(s.slug) = lower(trim(_slug))
  limit 1;

  if _store_id is null then raise exception 'Loja não encontrada'; end if;

  perform pg_advisory_xact_lock(hashtextextended(_store_id::text || ':' || _product_id::text, 0));

  select p.id, p.name, p.price, p.cost, p.stock
  into _product
  from public.products p
  where p.id = _product_id
    and p.store_id = _store_id
  for update
  limit 1;

  if _product.id is null then raise exception 'Produto inválido'; end if;

  _available := public.get_public_product_available_stock(_product.id);
  if _available < _safe_quantity then raise exception 'Estoque insuficiente'; end if;

  _warehouse_reserved := least(greatest(coalesce(_product.stock, 0), 0), _safe_quantity);
  _mobile_reserved := _safe_quantity - _warehouse_reserved;

  _safe_unit_price := coalesce(_product.price, _safe_unit_price, 0);
  _safe_cost := coalesce(_product.cost, _safe_unit_price, 0);
  _safe_total := round(((_safe_unit_price * _safe_quantity) + _safe_shipping_value)::numeric, 2);

  _items := jsonb_build_array(jsonb_build_object(
    'productId', _product.id,
    'name', _product.name,
    'qty', _safe_quantity,
    'price', _safe_unit_price,
    'cost', _safe_cost,
    'cep', coalesce(_cep, ''),
    'reference', coalesce(_reference, ''),
    'shipping', _safe_shipping_value,
    'cpf', _clean_cpf,
    'email', _clean_email,
    'inventoryReservationVersion', 2,
    'warehouseReservedQty', _warehouse_reserved,
    'mobileReservedQty', _mobile_reserved
  ));

  _combined_notes := nullif(concat_ws(E'\n',
    case when _clean_cpf <> '' and _clean_notes !~* '^\s*\*?\s*(CPF|CPF/CNPJ)(\s+do\s+cliente)?\s*\*?\s*:' then 'CPF: ' || _clean_cpf else null end,
    case when _clean_email <> '' and _clean_notes !~* '^\s*\*?\s*E-?mail(\s+do\s+cliente)?\s*\*?\s*:' then 'E-mail: ' || _clean_email else null end,
    nullif(_clean_notes, ''),
    nullif('CEP: ' || coalesce(_cep, ''), 'CEP: '),
    nullif('Ponto de referência: ' || coalesce(_reference, ''), 'Ponto de referência: ')
  ), '');

  insert into public.orders (
    user_id, store_id, customer, phone, address, district, city,
    items, total, payment, status, notes, date
  )
  values (
    _owner_id, _store_id, trim(_customer), trim(_phone), coalesce(trim(_address), ''),
    coalesce(trim(_district), ''), coalesce(trim(_city), ''),
    _items, _safe_total, _payment, 'aguardando', _combined_notes, now()
  )
  returning id into _order_id;

  if _warehouse_reserved > 0 then
    update public.products
    set stock = greatest(coalesce(stock, 0) - _warehouse_reserved, 0)
    where id = _product.id
      and store_id = _store_id;
  end if;

  return _order_id;
end;
$function$;

create or replace function public.reserve_courier_inventory_for_order(
  _store_id uuid,
  _courier_id uuid,
  _order_id uuid,
  _tracking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  order_row public.orders;
  item jsonb;
  item_product_id uuid;
  item_name text;
  requested_qty integer;
  remaining_qty integer;
  total_reserved integer := 0;
  inventory_row public.courier_inventory;
  take_qty integer;
  candidate_count integer;
  matching_variant_count integer;
  last_release_at timestamptz;
begin
  select max(created_at)
  into last_release_at
  from public.courier_inventory_movements
  where delivery_tracking_id = _tracking_id
    and courier_id = _courier_id
    and movement_type = 'unassigned';

  if exists (
    select 1
    from public.courier_inventory_movements
    where delivery_tracking_id = _tracking_id
      and courier_id = _courier_id
      and movement_type = 'assigned'
      and created_at > coalesce(last_release_at, '-infinity'::timestamptz)
  ) then
    return jsonb_build_object('changed', false, 'reason', 'already_reserved');
  end if;

  select *
  into order_row
  from public.orders
  where id = _order_id
    and store_id = _store_id;

  if order_row.id is null then
    return jsonb_build_object('changed', false, 'reason', 'order_not_found');
  end if;

  for item in
    select value
    from jsonb_array_elements(coalesce(order_row.items::jsonb, '[]'::jsonb))
  loop
    if coalesce(item->>'inventoryReservationVersion', '') <> '2' then
      continue;
    end if;

    item_product_id := null;
    item_name := trim(coalesce(item->>'name', ''));

    requested_qty := case
      when coalesce(item->>'mobileReservedQty', '') ~ '^\d+$'
      then (item->>'mobileReservedQty')::integer
      else 0
    end;

    requested_qty := greatest(requested_qty, 0);
    if requested_qty <= 0 then
      continue;
    end if;

    if coalesce(item->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      item_product_id := (item->>'productId')::uuid;
    else
      select p.id
      into item_product_id
      from public.products p
      where p.store_id = _store_id
        and lower(trim(p.name)) = lower(item_name)
      order by p.created_at nulls last
      limit 1;
    end if;

    if item_product_id is null then
      raise exception 'Produto do pedido não encontrado para reservar a carga do motoboy';
    end if;

    select
      count(*),
      count(*) filter (
        where trim(coalesce(ci.variant_label, '')) = ''
           or position(lower(trim(ci.variant_label)) in lower(item_name)) > 0
      )
    into candidate_count, matching_variant_count
    from public.courier_inventory ci
    where ci.store_id = _store_id
      and ci.courier_id = _courier_id
      and ci.product_id = item_product_id
      and ci.quantity > 0;

    remaining_qty := requested_qty;

    for inventory_row in
      select ci.*
      from public.courier_inventory ci
      where ci.store_id = _store_id
        and ci.courier_id = _courier_id
        and ci.product_id = item_product_id
        and ci.quantity > 0
        and (
          (matching_variant_count > 0 and (
            trim(coalesce(ci.variant_label, '')) = ''
            or position(lower(trim(ci.variant_label)) in lower(item_name)) > 0
          ))
          or (matching_variant_count = 0 and candidate_count = 1)
        )
      order by
        case
          when trim(coalesce(ci.variant_label, '')) <> ''
           and position(lower(trim(ci.variant_label)) in lower(item_name)) > 0 then 0
          when trim(coalesce(ci.variant_label, '')) = '' then 1
          else 2
        end,
        ci.updated_at asc
      for update
    loop
      exit when remaining_qty <= 0;

      take_qty := least(remaining_qty, inventory_row.quantity);
      if take_qty <= 0 then
        continue;
      end if;

      if inventory_row.quantity - take_qty = 0 then
        delete from public.courier_inventory
        where id = inventory_row.id;
      else
        update public.courier_inventory
        set quantity = inventory_row.quantity - take_qty,
            updated_by = auth.uid()
        where id = inventory_row.id;
      end if;

      insert into public.courier_inventory_movements(
        store_id, courier_id, product_id, variant_label, movement_type,
        old_quantity, new_quantity, quantity_delta, notes, created_by,
        order_id, delivery_tracking_id
      )
      values (
        _store_id, _courier_id, item_product_id, inventory_row.variant_label, 'assigned',
        inventory_row.quantity, inventory_row.quantity - take_qty, -take_qty,
        'Reserva automática do estoque móvel usada pelo checkout', auth.uid(),
        _order_id, _tracking_id
      );

      remaining_qty := remaining_qty - take_qty;
      total_reserved := total_reserved + take_qty;
    end loop;

    if remaining_qty > 0 then
      raise exception 'O motoboy não possui quantidade suficiente de % na carga avulsa. Necessário: %, disponível para esta reserva: %',
        item_name, requested_qty, requested_qty - remaining_qty;
    end if;
  end loop;

  return jsonb_build_object(
    'changed', total_reserved > 0,
    'reserved_quantity', total_reserved,
    'order_id', _order_id,
    'courier_id', _courier_id
  );
end;
$function$;

comment on function public.get_public_product_available_stock(uuid) is
'Estoque vendável público = estoque da loja + carga avulsa ativa dos motoboys - reservas móveis ainda não atribuídas.';
