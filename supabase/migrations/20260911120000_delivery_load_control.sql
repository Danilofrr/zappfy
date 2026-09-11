-- Controle de carga integrado ao rastreamento existente.
-- delivery_tracking continua sendo a fonte de verdade da atribuicao; contadores sao calculados de orders.items.
-- O enum legado nao comporta o fluxo fisico de retorno; texto evita criar sinonimos
-- e permite a evolucao mantendo os valores existentes intactos.
ALTER TABLE public.delivery_tracking ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.delivery_tracking ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.delivery_tracking ALTER COLUMN status SET DEFAULT 'aguardando_motoboy';

ALTER TABLE public.delivery_tracking
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS completion_latitude double precision,
  ADD COLUMN IF NOT EXISTS completion_longitude double precision,
  ADD COLUMN IF NOT EXISTS assigned_by uuid;

CREATE TABLE IF NOT EXISTS public.delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_tracking_id uuid NOT NULL REFERENCES public.delivery_tracking(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_id uuid REFERENCES public.couriers(id) ON DELETE SET NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('assigned','transferred','accepted','started','delivered','delivery_failed','return_started','returned')),
  old_status text,
  new_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_tracking_courier_status_idx ON public.delivery_tracking(store_id, courier_id, status);
CREATE INDEX IF NOT EXISTS delivery_tracking_assigned_idx ON public.delivery_tracking(store_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS delivery_events_timeline_idx ON public.delivery_events(store_id, courier_id, created_at DESC);
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.delivery_events TO authenticated;

DROP POLICY IF EXISTS "store members read delivery events" ON public.delivery_events;
CREATE POLICY "store members read delivery events" ON public.delivery_events FOR SELECT TO authenticated
USING (public._can_manage_store(store_id));

CREATE OR REPLACE FUNCTION public.list_order_assignments(_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(x) FROM (
    SELECT DISTINCT ON (t.order_id) t.id, t.order_id, t.courier_id, c.name courier_name,
      t.status::text status, t.assigned_at, t.accepted_at, t.started_at, t.completed_at, t.returned_at
    FROM delivery_tracking t LEFT JOIN couriers c ON c.id=t.courier_id
    WHERE t.store_id=_store_id ORDER BY t.order_id, t.created_at DESC
  ) x), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.assign_orders_to_courier(_store_id uuid, _order_ids uuid[], _courier_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o orders; c couriers; t delivery_tracking; previous uuid; assigned int := 0; transferred int := 0;
BEGIN
  IF NOT public._can_manage_store(_store_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT * INTO c FROM couriers WHERE id=_courier_id AND store_id=_store_id AND active;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Motoboy ativo não encontrado'; END IF;
  FOR o IN SELECT * FROM orders WHERE id=ANY(_order_ids) AND store_id=_store_id LOOP
    SELECT * INTO t FROM delivery_tracking WHERE order_id=o.id AND store_id=_store_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    IF t.id IS NULL THEN
      INSERT INTO delivery_tracking(order_id,store_id,tracking_code,courier_token,courier_id,courier_name,courier_phone,status,assigned_at,assigned_by)
      VALUES(o.id,_store_id,upper(substr(encode(gen_random_bytes(8),'hex'),1,12)),encode(gen_random_bytes(32),'hex'),c.id,c.name,c.phone,'aguardando_motoboy',now(),auth.uid()) RETURNING * INTO t;
      INSERT INTO delivery_events(delivery_tracking_id,order_id,courier_id,store_id,event_type,new_status,created_by)
      VALUES(t.id,o.id,c.id,_store_id,'assigned','aguardando_motoboy',auth.uid()); assigned:=assigned+1;
    ELSIF t.courier_id IS DISTINCT FROM c.id THEN
      previous:=t.courier_id;
      UPDATE delivery_tracking SET courier_id=c.id,courier_name=c.name,courier_phone=c.phone,status='aguardando_motoboy',
        assigned_at=now(),accepted_at=NULL,started_at=NULL,completed_at=NULL,returned_at=NULL,failure_reason=NULL,assigned_by=auth.uid() WHERE id=t.id;
      INSERT INTO delivery_events(delivery_tracking_id,order_id,courier_id,store_id,event_type,old_status,new_status,metadata,created_by)
      VALUES(t.id,o.id,c.id,_store_id,'transferred',t.status::text,'aguardando_motoboy',jsonb_build_object('from_courier_id',previous,'to_courier_id',c.id),auth.uid()); transferred:=transferred+1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('assigned',assigned,'transferred',transferred);
END $$;

CREATE OR REPLACE FUNCTION public.get_courier_loads(_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public._can_manage_store(_store_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'courier_id',c.id,'name',c.name,'active',c.active,
  'orders_in_possession',COALESCE(a.possession_orders,0),'products_in_possession',COALESCE(a.possession_products,0),
  'value_in_possession',COALESCE(a.possession_value,0),'delivered_today',COALESCE(a.delivered_orders,0),
  'products_delivered_today',COALESCE(a.delivered_products,0),'failed',COALESCE(a.failed,0),'returned',COALESCE(a.returned,0)
 )) FROM couriers c LEFT JOIN LATERAL (
   SELECT count(*) FILTER (WHERE t.status NOT IN ('entregue','devolvido','cancelado')) possession_orders,
    COALESCE(sum(qty) FILTER (WHERE t.status NOT IN ('entregue','devolvido','cancelado')),0) possession_products,
    COALESCE(sum(o.total) FILTER (WHERE t.status NOT IN ('entregue','devolvido','cancelado')),0) possession_value,
    count(*) FILTER (WHERE t.status='entregue' AND t.completed_at::date=current_date) delivered_orders,
    COALESCE(sum(qty) FILTER (WHERE t.status='entregue' AND t.completed_at::date=current_date),0) delivered_products,
    count(*) FILTER (WHERE t.status='nao_entregue') failed,
    count(*) FILTER (WHERE t.status='devolvido' AND t.returned_at::date=current_date) returned
   FROM delivery_tracking t JOIN orders o ON o.id=t.order_id
   CROSS JOIN LATERAL (SELECT COALESCE(sum(COALESCE((i->>'qty')::numeric,0)),0) qty FROM jsonb_array_elements(o.items::jsonb) i) items
   WHERE t.courier_id=c.id
 ) a ON true WHERE c.store_id=_store_id), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.list_my_delivery_load(_session text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c couriers;
BEGIN
 c:=public._resolve_courier_session(_session);
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'id',t.id,'tracking_code',t.tracking_code,'courier_token',t.courier_token,'status',t.status,
  'assigned_at',t.assigned_at,'accepted_at',t.accepted_at,'started_at',t.started_at,'completed_at',t.completed_at,
  'failure_reason',t.failure_reason,'notes',t.completion_notes,
  'order',jsonb_build_object('id',o.id,'customer',o.customer,'phone',o.phone,'address',o.address,'district',o.district,'city',o.city,'total',o.total,'payment',o.payment,'items',o.items,'notes',o.notes)
 ) ORDER BY COALESCE(t.assigned_at,t.created_at) DESC) FROM delivery_tracking t JOIN orders o ON o.id=t.order_id
 WHERE t.courier_id=c.id AND t.store_id=c.store_id AND t.status <> 'cancelado'), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.courier_delivery_action(_session text,_tracking_id uuid,_action text,_reason text DEFAULT NULL,_notes text DEFAULT NULL,_recipient text DEFAULT NULL,_lat double precision DEFAULT NULL,_lng double precision DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c couriers; t delivery_tracking; ns text; event text; order_status text;
BEGIN
 c:=public._resolve_courier_session(_session);
 SELECT * INTO t FROM delivery_tracking WHERE id=_tracking_id AND courier_id=c.id AND store_id=c.store_id FOR UPDATE;
 IF t.id IS NULL THEN RAISE EXCEPTION 'Entrega não encontrada ou acesso negado'; END IF;
 ns:=CASE _action WHEN 'accept' THEN 'aguardando_motoboy' WHEN 'start' THEN 'saiu_para_entrega' WHEN 'deliver' THEN 'entregue' WHEN 'fail' THEN 'nao_entregue' WHEN 'return' THEN 'retornando' WHEN 'returned' THEN 'devolvido' ELSE NULL END;
 IF ns IS NULL THEN RAISE EXCEPTION 'Ação inválida'; END IF;
 IF (_action='accept' AND t.accepted_at IS NOT NULL) OR t.status=ns THEN RETURN jsonb_build_object('changed',false,'status',t.status); END IF;
 IF t.status IN ('entregue','devolvido','cancelado') THEN RAISE EXCEPTION 'Entrega já finalizada'; END IF;
 event:=CASE _action WHEN 'accept' THEN 'accepted' WHEN 'start' THEN 'started' WHEN 'deliver' THEN 'delivered' WHEN 'fail' THEN 'delivery_failed' WHEN 'return' THEN 'return_started' ELSE 'returned' END;
 UPDATE delivery_tracking SET status=ns,accepted_at=CASE WHEN _action='accept' THEN COALESCE(accepted_at,now()) ELSE accepted_at END,
  started_at=CASE WHEN _action='start' THEN COALESCE(started_at,now()) ELSE started_at END,
  completed_at=CASE WHEN _action='deliver' THEN COALESCE(completed_at,now()) ELSE completed_at END,
  returned_at=CASE WHEN _action='returned' THEN COALESCE(returned_at,now()) ELSE returned_at END,
  failure_reason=CASE WHEN _action='fail' THEN _reason ELSE failure_reason END, completion_notes=COALESCE(_notes,completion_notes),recipient_name=COALESCE(_recipient,recipient_name),
  completion_latitude=CASE WHEN _action='deliver' THEN _lat ELSE completion_latitude END, completion_longitude=CASE WHEN _action='deliver' THEN _lng ELSE completion_longitude END WHERE id=t.id;
 order_status:=CASE _action WHEN 'start' THEN 'entrega' WHEN 'deliver' THEN 'entregue' WHEN 'returned' THEN 'cancelado' ELSE NULL END;
 IF order_status IS NOT NULL THEN UPDATE orders SET status=order_status WHERE id=t.order_id AND store_id=c.store_id; END IF;
 INSERT INTO delivery_events(delivery_tracking_id,order_id,courier_id,store_id,event_type,old_status,new_status,metadata)
 VALUES(t.id,t.order_id,c.id,c.store_id,event,t.status::text,ns::text,jsonb_strip_nulls(jsonb_build_object('reason',_reason,'notes',_notes,'recipient',_recipient)));
 RETURN jsonb_build_object('changed',true,'status',ns);
END $$;

CREATE OR REPLACE FUNCTION public.get_courier_load_detail(_store_id uuid,_courier_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public._can_manage_store(_store_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 RETURN jsonb_build_object(
  'orders',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'status',t.status,'assigned_at',t.assigned_at,'accepted_at',t.accepted_at,'started_at',t.started_at,'completed_at',t.completed_at,'failure_reason',t.failure_reason,'proof_url',t.proof_url,'notes',t.completion_notes,'order',to_jsonb(o)-'user_id'-'store_id') ORDER BY COALESCE(t.assigned_at,t.created_at) DESC) FROM delivery_tracking t JOIN orders o ON o.id=t.order_id WHERE t.store_id=_store_id AND t.courier_id=_courier_id),'[]'::jsonb),
  'products',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',p.name,'quantity',p.qty) ORDER BY p.name) FROM (SELECT i->>'name' name,sum(COALESCE((i->>'qty')::numeric,0)) qty FROM delivery_tracking t JOIN orders o ON o.id=t.order_id CROSS JOIN LATERAL jsonb_array_elements(o.items::jsonb) i WHERE t.store_id=_store_id AND t.courier_id=_courier_id AND t.status NOT IN ('entregue','devolvido','cancelado') GROUP BY i->>'name') p),'[]'::jsonb),
  'events',COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC) FROM (SELECT * FROM delivery_events WHERE store_id=_store_id AND courier_id=_courier_id ORDER BY created_at DESC LIMIT 100) e),'[]'::jsonb)
 );
END $$;

GRANT EXECUTE ON FUNCTION public.list_order_assignments(uuid), public.assign_orders_to_courier(uuid,uuid[],uuid), public.get_courier_loads(uuid), public.get_courier_load_detail(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_delivery_load(text), public.courier_delivery_action(text,uuid,text,text,text,text,double precision,double precision) TO anon,authenticated;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_events; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
