create or replace function public.save_courier_delivery_evidence(
  _token text,
  _proof_url text default null,
  _signature_url text default null,
  _clear_proof boolean default false,
  _clear_signature boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t public.delivery_tracking;
  proof text := nullif(btrim(coalesce(_proof_url, '')), '');
  signature text := nullif(btrim(coalesce(_signature_url, '')), '');
begin
  select * into t
  from public.delivery_tracking
  where courier_token = _token
  limit 1
  for update;

  if t.id is null then
    raise exception 'Rastreamento não encontrado';
  end if;

  if t.status in ('cancelado','devolvido') then
    raise exception 'Entrega já encerrada';
  end if;

  if proof is not null then
    if proof !~ '^data:image/(png|jpeg|jpg|webp);base64,' then
      raise exception 'Comprovante deve ser uma imagem PNG, JPG ou WEBP';
    end if;
    if length(proof) > 4500000 then
      raise exception 'Comprovante muito grande';
    end if;
  end if;

  if signature is not null then
    if signature !~ '^data:image/png;base64,' then
      raise exception 'Assinatura inválida';
    end if;
    if length(signature) > 1000000 then
      raise exception 'Assinatura muito grande';
    end if;
  end if;

  update public.delivery_tracking
  set proof_url = case
        when _clear_proof then null
        when proof is not null then proof
        else proof_url
      end,
      signature_url = case
        when _clear_signature then null
        when signature is not null then signature
        else signature_url
      end,
      updated_at = now()
  where id = t.id;

  return jsonb_build_object(
    'saved', true,
    'proof_saved', case when _clear_proof then false when proof is not null then true else t.proof_url is not null end,
    'signature_saved', case when _clear_signature then false when signature is not null then true else t.signature_url is not null end
  );
end;
$function$;

grant execute on function public.save_courier_delivery_evidence(text,text,text,boolean,boolean) to anon, authenticated;
