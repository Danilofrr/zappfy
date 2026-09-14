create or replace function public.courier_me(_session text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c public.couriers;
  st public.settings;
begin
  c := public._resolve_courier_session(_session);
  select * into st from public.settings where store_id = c.store_id limit 1;

  return jsonb_build_object(
    'courier_id', c.id,
    'name', c.name,
    'phone', c.phone,
    'vehicle_type', c.vehicle_type,
    'plate', c.plate,
    'is_online', coalesce(c.is_online, false),
    'online_updated_at', c.online_updated_at,
    'store_id', c.store_id,
    'store_name', coalesce(st.store_name, 'Loja'),
    'store_logo_url', st.checkout_logo_url,
    'slug', st.slug
  );
end;
$function$;
