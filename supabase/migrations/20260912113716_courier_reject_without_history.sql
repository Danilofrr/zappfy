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
set search_path = 'public'
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

    -- Uma recusa antes da aceitação não deve aparecer no histórico operacional
    -- do motoboy. Removemos somente eventos de atribuição deste motoboy para
    -- esta entrega; eventos de outros motoboys permanecem preservados.
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

    return jsonb_build_object(
      'changed', true,
      'rejected', true,
      'status', t.status
    );
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

  if ns is null then
    raise exception 'Ação inválida';
  end if;

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
    update orders
    set status = order_status
    where id = t.order_id
      and store_id = c.store_id;
  end if;

  insert into delivery_events(
    delivery_tracking_id,
    order_id,
    courier_id,
    store_id,
    event_type,
    old_status,
    new_status,
    metadata
  ) values (
    t.id,
    t.order_id,
    c.id,
    c.store_id,
    event,
    t.status::text,
    ns::text,
    jsonb_strip_nulls(jsonb_build_object(
      'reason', _reason,
      'notes', _notes,
      'recipient', _recipient
    ))
  );

  return jsonb_build_object('changed', true, 'status', ns);
end
$function$;

select pg_notify('pgrst', 'reload schema');
