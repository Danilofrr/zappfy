-- O estoque móvel representa somente a carga avulsa ainda livre.
-- Quando um pedido é atribuído ao motoboy, os itens disponíveis saem da carga avulsa
-- e passam a ser representados pela carga de pedidos. Não há nova baixa ao entregar.

alter table public.courier_inventory_movements
  drop constraint if exists courier_inventory_movements_movement_type_check;

alter table public.courier_inventory_movements
  add constraint courier_inventory_movements_movement_type_check
  check (movement_type = any (array[
    'load'::text,
    'return'::text,
    'delivered'::text,
    'sold'::text,
    'adjustment'::text,
    'loss'::text,
    'assigned'::text,
    'unassigned'::text
  ]));

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
  select max(created_at) into last_release_at
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

  select * into order_row
  from public.orders
  where id = _order_id
    and store_id = _store_id;

  if order_row.id is null then
    return jsonb_build_object('changed', false, 'reason', 'order_not_found');
  end if;

  for item in
    select value from jsonb_array_elements(coalesce(order_row.items::jsonb, '[]'::jsonb))
  loop
    item_product_id := null;
    item_name := trim(coalesce(item->>'name', ''));
    requested_qty := greatest(coalesce((item->>'qty')::integer, 0), 0);

    if requested_qty <= 0 then
      continue;
    end if;

    if coalesce(item->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      item_product_id := (item->>'productId')::uuid;
    else
      select p.id into item_product_id
      from public.products p
      where p.store_id = _store_id
        and lower(trim(p.name)) = lower(item_name)
      order by p.created_at nulls last
      limit 1;
    end if;

    if item_product_id is null then
      continue;
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

    if candidate_count = 0 then
      continue;
    end if;

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
        delete from public.courier_inventory where id = inventory_row.id;
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
      ) values (
        _store_id, _courier_id, item_product_id, inventory_row.variant_label, 'assigned',
        inventory_row.quantity, inventory_row.quantity - take_qty, -take_qty,
        'Reserva automática ao atribuir pedido ao motoboy', auth.uid(),
        _order_id, _tracking_id
      );

      remaining_qty := remaining_qty - take_qty;
      total_reserved := total_reserved + take_qty;
    end loop;
  end loop;

  return jsonb_build_object(
    'changed', total_reserved > 0,
    'reserved_quantity', total_reserved,
    'order_id', _order_id,
    'courier_id', _courier_id
  );
end;
$function$;

create or replace function public.restore_courier_inventory_for_unassignment(
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
  last_release_at timestamptz;
  m record;
  old_qty integer;
  restored integer := 0;
begin
  select max(created_at) into last_release_at
  from public.courier_inventory_movements
  where delivery_tracking_id = _tracking_id
    and courier_id = _courier_id
    and movement_type = 'unassigned';

  for m in
    select product_id,
           coalesce(variant_label, '') as variant_label,
           sum(-quantity_delta)::integer as qty
    from public.courier_inventory_movements
    where delivery_tracking_id = _tracking_id
      and courier_id = _courier_id
      and movement_type = 'assigned'
      and created_at > coalesce(last_release_at, '-infinity'::timestamptz)
      and quantity_delta < 0
    group by product_id, coalesce(variant_label, '')
  loop
    if m.qty <= 0 or m.product_id is null then
      continue;
    end if;

    select quantity into old_qty
    from public.courier_inventory
    where store_id = _store_id
      and courier_id = _courier_id
      and product_id = m.product_id
      and variant_label = m.variant_label
    for update;

    old_qty := coalesce(old_qty, 0);

    insert into public.courier_inventory(
      store_id, courier_id, product_id, variant_label, quantity, updated_by
    ) values (
      _store_id, _courier_id, m.product_id, m.variant_label, m.qty, auth.uid()
    )
    on conflict (store_id, courier_id, product_id, variant_label)
    do update set
      quantity = public.courier_inventory.quantity + excluded.quantity,
      updated_by = auth.uid();

    insert into public.courier_inventory_movements(
      store_id, courier_id, product_id, variant_label, movement_type,
      old_quantity, new_quantity, quantity_delta, notes, created_by,
      order_id, delivery_tracking_id
    ) values (
      _store_id, _courier_id, m.product_id, m.variant_label, 'unassigned',
      old_qty, old_qty + m.qty, m.qty,
      'Reposição automática da carga avulsa após retirada/recusa da atribuição', auth.uid(),
      _order_id, _tracking_id
    );

    restored := restored + m.qty;
  end loop;

  return jsonb_build_object('changed', restored > 0, 'restored_quantity', restored);
end;
$function$;

drop trigger if exists trg_sync_courier_inventory_on_delivery_status on public.delivery_tracking;

create or replace function public.assign_orders_to_courier(_store_id uuid, _order_ids uuid[], _courier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o orders;
  c couriers;
  t delivery_tracking;
  previous uuid;
  assigned int := 0;
  transferred int := 0;
begin
  if not public._can_manage_store(_store_id) then raise exception 'Acesso negado'; end if;
  select * into c from couriers where id=_courier_id and store_id=_store_id and active;
  if c.id is null then raise exception 'Motoboy ativo não encontrado'; end if;

  for o in select * from orders where id=any(_order_ids) and store_id=_store_id loop
    select * into t from delivery_tracking
    where order_id=o.id and store_id=_store_id
    order by created_at desc limit 1 for update;

    if t.id is null then
      insert into delivery_tracking(order_id,store_id,tracking_code,courier_token,courier_id,courier_name,courier_phone,status,assigned_at,assigned_by)
      values(o.id,_store_id,upper(substr(encode(gen_random_bytes(8),'hex'),1,12)),encode(gen_random_bytes(32),'hex'),c.id,c.name,c.phone,'aguardando_motoboy',now(),auth.uid())
      returning * into t;

      insert into delivery_events(delivery_tracking_id,order_id,courier_id,store_id,event_type,new_status,created_by)
      values(t.id,o.id,c.id,_store_id,'assigned','aguardando_motoboy',auth.uid());

      perform public.reserve_courier_inventory_for_order(_store_id, c.id, o.id, t.id);
      assigned:=assigned+1;

    elsif t.courier_id is distinct from c.id then
      previous:=t.courier_id;

      if previous is not null then
        perform public.restore_courier_inventory_for_unassignment(_store_id, previous, o.id, t.id);
      end if;

      update delivery_tracking
      set courier_id=c.id,courier_name=c.name,courier_phone=c.phone,status='aguardando_motoboy',
          assigned_at=now(),accepted_at=null,started_at=null,completed_at=null,returned_at=null,
          failure_reason=null,assigned_by=auth.uid()
      where id=t.id;

      insert into delivery_events(delivery_tracking_id,order_id,courier_id,store_id,event_type,old_status,new_status,metadata,created_by)
      values(t.id,o.id,c.id,_store_id,'transferred',t.status::text,'aguardando_motoboy',
             jsonb_build_object('from_courier_id',previous,'to_courier_id',c.id),auth.uid());

      perform public.reserve_courier_inventory_for_order(_store_id, c.id, o.id, t.id);
      transferred:=transferred+1;
    end if;
  end loop;

  return jsonb_build_object('assigned',assigned,'transferred',transferred);
end;
$function$;

create or replace function public.courier_delivery_action(
  _session text,
  _tracking_id uuid,
  _action text,
  _reason text default null,
  _notes text default null,
  _recipient text default null,
  _lat double precision default null,
  _lng double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c couriers;
  t delivery_tracking;
  ns text;
  event text;
  order_status text;
begin
  c := public._resolve_courier_session(_session);

  select * into t
  from delivery_tracking
  where id = _tracking_id
    and courier_id = c.id
    and store_id = c.store_id
  for update;

  if t.id is null then
    raise exception 'Entrega não encontrada ou acesso negado';
  end if;

  if _action = 'reject' then
    if t.accepted_at is not null or t.status not in ('aguardando_motoboy','preparando') then
      raise exception 'Esta entrega não pode mais ser recusada';
    end if;

    perform public.restore_courier_inventory_for_unassignment(c.store_id, c.id, t.order_id, t.id);

    delete from delivery_events
    where delivery_tracking_id = t.id
      and courier_id = c.id
      and event_type in ('assigned','transferred');

    update delivery_tracking
    set courier_id = null,
        courier_name = null,
        courier_phone = null,
        assigned_at = null,
        accepted_at = null,
        assigned_by = null,
        courier_token = replace(gen_random_uuid()::text, '-', ''),
        updated_at = now()
    where id = t.id;

    return jsonb_build_object('changed', true, 'rejected', true, 'status', t.status);
  end if;

  ns := case _action
    when 'accept' then 'aguardando_motoboy'
    when 'start' then 'saiu_para_entrega'
    when 'deliver' then 'entregue'
    when 'fail' then 'nao_entregue'
    when 'return' then 'retornando'
    when 'returned' then 'devolvido'
    else null
  end;

  if ns is null then raise exception 'Ação inválida'; end if;

  if (_action = 'accept' and t.accepted_at is not null) or t.status = ns then
    return jsonb_build_object('changed', false, 'status', t.status);
  end if;

  if t.status in ('entregue','devolvido','cancelado') then
    raise exception 'Entrega já finalizada';
  end if;

  event := case _action
    when 'accept' then 'accepted'
    when 'start' then 'started'
    when 'deliver' then 'delivered'
    when 'fail' then 'delivery_failed'
    when 'return' then 'return_started'
    else 'returned'
  end;

  update delivery_tracking
  set status = ns,
      accepted_at = case when _action = 'accept' then coalesce(accepted_at, now()) else accepted_at end,
      started_at = case when _action = 'start' then coalesce(started_at, now()) else started_at end,
      completed_at = case when _action = 'deliver' then coalesce(completed_at, now()) else completed_at end,
      returned_at = case when _action = 'returned' then coalesce(returned_at, now()) else returned_at end,
      failure_reason = case when _action = 'fail' then _reason else failure_reason end,
      completion_notes = coalesce(_notes, completion_notes),
      recipient_name = coalesce(_recipient, recipient_name),
      completion_latitude = case when _action = 'deliver' then _lat else completion_latitude end,
      completion_longitude = case when _action = 'deliver' then _lng else completion_longitude end
  where id = t.id;

  order_status := case _action
    when 'start' then 'entrega'
    when 'deliver' then 'entregue'
    when 'returned' then 'cancelado'
    else null
  end;

  if order_status is not null then
    update orders set status = order_status
    where id = t.order_id and store_id = c.store_id;
  end if;

  insert into delivery_events(delivery_tracking_id,order_id,courier_id,store_id,event_type,old_status,new_status,metadata)
  values(t.id,t.order_id,c.id,c.store_id,event,t.status::text,ns::text,
         jsonb_strip_nulls(jsonb_build_object('reason',_reason,'notes',_notes,'recipient',_recipient)));

  return jsonb_build_object('changed', true, 'status', ns);
end;
$function$;

do $backfill$
declare
  r record;
begin
  for r in
    select id, store_id, courier_id, order_id
    from public.delivery_tracking
    where courier_id is not null
      and status not in ('entregue','devolvido','cancelado')
  loop
    perform public.reserve_courier_inventory_for_order(r.store_id, r.courier_id, r.order_id, r.id);
  end loop;
end;
$backfill$;
