import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrackingMap } from "@/components/TrackingMap";
import {
  STATUS_INFO,
  TIMELINE_STEPS,
  deriveDisplayStatus,
  distanceMeters,
  etaMinutes,
  formatDistance,
  formatRelative,
  orderShortNumber,
  whatsappLink,
  type DeliveryStatus,
} from "@/lib/tracking";
import { Check, Clock, MapPin, MessageCircle, Bike, Loader2 } from "lucide-react";

export const Route = createFileRoute("/rastreio/$trackingCode")({
  ssr: false,
  head: () => ({ meta: [{ title: "Acompanhe sua entrega" }] }),
  component: RastreioPage,
});

type Payload = {
  id: string;
  order_id: string;
  tracking_code: string;
  status: DeliveryStatus;
  order_status: string | null;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speed: number | null;
  last_updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  order: { id: string; customer: string; address: string; district: string; city: string; total: number; status: string; date: string };
  store: { name: string; whatsapp: string; logo_url: string | null };
  settings: {
    primary_color: string;
    secondary_color: string;
    background_color: string;
    button_color: string;
    text_color: string;
    card_color: string;
    timeline_color: string;
    tracking_page_title: string;
    tracking_page_subtitle: string;
    welcome_message: string;
    delivered_message: string;
    support_whatsapp: string;
    show_store_logo: boolean;
    show_courier_name: boolean;
    show_courier_phone: boolean;
    show_estimated_time: boolean;
    show_distance: boolean;
    vehicle_type: "moto" | "carro";
    vehicle_color: string;
    vehicle_custom_url: string | null;
    pin_color: string;
    pin_custom_url: string | null;
    msg_aguardando: string;
    msg_preparando: string;
    msg_saiu: string;
    msg_chegando: string;
    msg_entregue: string;
    msg_cancelado: string;
  };
  courier: { name: string | null; phone: string | null };
};

function RastreioPage() {
  const { trackingCode } = Route.useParams();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const incrementedRef = useRef(false);
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    const { data: res, error } = await supabase.rpc("get_tracking_public", { _code: trackingCode });
    if (!error && res) setData(res as Payload);
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (!incrementedRef.current) {
      incrementedRef.current = true;
      supabase.rpc("increment_tracking_view", { _code: trackingCode }).then(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingCode]);

  // realtime updates for tracking row
  useEffect(() => {
    if (!data?.id) return;
    const channel = supabase
      .channel(`public_tracking_${data.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_tracking", filter: `id=eq.${data.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  // realtime updates for the linked order (status changes by the merchant)
  useEffect(() => {
    if (!data?.order_id) return;
    const channel = supabase
      .channel(`public_order_${data.order_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${data.order_id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.order_id]);

  // geocode destination
  useEffect(() => {
    if (!data?.order?.address || destination) return;
    const fullAddress = [data.order.address, data.order.district, data.order.city].filter(Boolean).join(", ");
    if (!fullAddress) return;
    const ctrl = new AbortController();
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(fullAddress)}`, {
      signal: ctrl.signal,
      headers: { "Accept-Language": "pt-BR" },
    })
      .then((r) => r.json())
      .then((arr) => {
        if (Array.isArray(arr) && arr[0]) {
          setDestination({ lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) });
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [data?.order?.address, data?.order?.district, data?.order?.city, destination]);

  const courierPos = useMemo(
    () => (data?.latitude != null && data?.longitude != null ? { lat: data.latitude, lng: data.longitude } : null),
    [data?.latitude, data?.longitude],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1220] text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1220] text-white text-center px-6">
        <div>
          <div className="text-4xl mb-3">🔍</div>
          <h1 className="text-xl font-semibold">Rastreamento não encontrado</h1>
          <p className="text-sm text-white/60 mt-2">Verifique o link recebido.</p>
        </div>
      </div>
    );
  }

  const s = data.settings;
  // Compute display status: order status + tracking status combined
  const displayStatus: DeliveryStatus = deriveDisplayStatus(data.status, data.order_status ?? data.order.status);
  const info = STATUS_INFO[displayStatus];
  const isFinished = displayStatus === "entregue" || displayStatus === "cancelado";
  const distance = courierPos && destination ? distanceMeters(courierPos, destination) : null;
  const eta = distance != null ? etaMinutes(distance, data.speed) : null;
  const stale =
    !isFinished &&
    displayStatus === "saiu_para_entrega" &&
    data.last_updated_at &&
    Date.now() - new Date(data.last_updated_at).getTime() > 120_000;

  const messages: Record<DeliveryStatus, string> = {
    aguardando_motoboy: s.msg_aguardando,
    preparando: s.msg_preparando,
    saiu_para_entrega: s.msg_saiu,
    chegando: s.msg_chegando,
    entregue: s.msg_entregue,
    cancelado: s.msg_cancelado,
  };
  const message = messages[displayStatus];
  const cardBg = s.card_color || s.secondary_color;
  const timelineColor = s.timeline_color || s.primary_color;

  return (
    <div
      className="min-h-screen pb-12"
      style={{ background: s.background_color, color: s.text_color, fontFamily: "system-ui, sans-serif" }}
    >
      <header className="px-5 pt-8 pb-6 text-center" style={{ background: `linear-gradient(180deg, ${s.secondary_color}, transparent)` }}>
        {s.show_store_logo && data.store.logo_url && (
          <img src={data.store.logo_url} alt={data.store.name} className="mx-auto h-16 w-auto object-contain mb-3" />
        )}
        <h1 className="text-xl font-bold">{data.store.name}</h1>
        <p className="text-sm opacity-80 mt-1">{s.tracking_page_subtitle}</p>
        <div
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
          style={{ background: `${s.primary_color}22`, color: s.primary_color, border: `1px solid ${s.primary_color}55` }}
          key={displayStatus}
        >
          <span aria-hidden>{info.emoji}</span>
          <span>{info.label}</span>
          {!isFinished && (
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: s.primary_color }} />
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 space-y-4">
        <section className="rounded-2xl p-5 shadow-xl animate-fade-in" style={{ background: cardBg, border: `1px solid ${s.primary_color}33` }}>
          <div className="text-xs uppercase opacity-60 tracking-wider">Pedido</div>
          <div className="text-lg font-bold">#{orderShortNumber(data.order.id)}</div>
          <p className="mt-3 text-sm leading-relaxed opacity-90">{message}</p>
          {stale && (
            <div className="mt-3 text-xs rounded-lg px-3 py-2" style={{ background: "#f59e0b22", color: "#f59e0b" }}>
              <Clock className="inline h-3.5 w-3.5 mr-1" /> Aguardando nova atualização do entregador…
            </div>
          )}
        </section>

        {!isFinished && (displayStatus === "saiu_para_entrega" || displayStatus === "chegando") && (
          <section className="rounded-2xl overflow-hidden shadow-xl" style={{ border: `1px solid ${s.primary_color}33` }}>
            {courierPos ? (
              <TrackingMap
                courier={courierPos}
                destination={destination}
                heading={data.heading}
                primaryColor={s.primary_color}
                vehicle={{ type: s.vehicle_type, color: s.vehicle_color, customUrl: s.vehicle_custom_url }}
                pin={{ color: s.pin_color, customUrl: s.pin_custom_url }}
                height={320}
              />
            ) : (
              <div className="h-[260px] flex items-center justify-center text-sm opacity-70" style={{ background: cardBg }}>
                <Bike className="h-5 w-5 mr-2" /> Aguardando o entregador iniciar a entrega…
              </div>
            )}
          </section>
        )}

        {!isFinished && (displayStatus === "saiu_para_entrega" || displayStatus === "chegando") && (
          <section className="grid grid-cols-2 gap-3">
            {s.show_distance && (
              <InfoCard color={s.primary_color} bg={cardBg} label="Distância" value={distance != null ? formatDistance(distance) : "—"} />
            )}
            {s.show_estimated_time && (
              <InfoCard color={s.primary_color} bg={cardBg} label="Chegada estimada" value={eta != null ? `${eta} min` : "—"} />
            )}
            <InfoCard color={s.primary_color} bg={cardBg} label="Última atualização" value={formatRelative(data.last_updated_at)} />
            {s.show_courier_name && data.courier.name && (
              <InfoCard color={s.primary_color} bg={cardBg} label="Entregador" value={data.courier.name} />
            )}
          </section>
        )}

        <section className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${s.primary_color}22` }}>
          <h3 className="text-sm font-semibold mb-4">Acompanhamento</h3>
          <Timeline status={displayStatus} primary={timelineColor} />
        </section>

        <section className="rounded-2xl p-4 text-sm" style={{ background: cardBg, border: `1px solid ${s.primary_color}22` }}>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5" style={{ color: s.primary_color }} />
            <div>
              <div className="font-medium">Endereço de entrega</div>
              <div className="opacity-80">{data.order.address}{data.order.district ? `, ${data.order.district}` : ""}{data.order.city ? ` — ${data.order.city}` : ""}</div>
            </div>
          </div>
        </section>

        {s.support_whatsapp && (
          <a
            href={whatsappLink(s.support_whatsapp, `Olá! Sobre o meu pedido #${orderShortNumber(data.order.id)}`)}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl p-4 text-center font-semibold shadow-lg"
            style={{ background: s.button_color, color: "#fff" }}
          >
            <MessageCircle className="inline h-4 w-4 mr-2" /> Falar com a loja
          </a>
        )}
      </main>

      <footer className="text-center text-[11px] opacity-50 mt-8">
        Rastreamento fornecido por <strong>Zappfy</strong>
      </footer>
    </div>
  );
}

function InfoCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${color}22` }}>
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="text-base font-semibold mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}

function Timeline({ status, primary }: { status: DeliveryStatus; primary: string }) {
  const order: DeliveryStatus[] = ["aguardando_motoboy", "preparando", "saiu_para_entrega", "chegando", "entregue"];
  const currentIdx = status === "cancelado" ? -1 : order.indexOf(status);
  return (
    <ol className="relative space-y-4 pl-7">
      <span className="absolute left-3 top-2 bottom-2 w-px" style={{ background: `${primary}33` }} />
      {TIMELINE_STEPS.map((step, i) => {
        const done = i < currentIdx;
        const isCurrent = i === currentIdx;
        const filled = done || isCurrent;
        return (
          <li key={step.key} className="relative">
            <span
              className="absolute -left-[26px] top-1 h-5 w-5 rounded-full flex items-center justify-center transition-all"
              style={{
                background: filled ? primary : "transparent",
                border: `2px solid ${filled ? primary : `${primary}55`}`,
                boxShadow: isCurrent ? `0 0 0 6px ${primary}33` : "none",
              }}
            >
              {done && <Check className="h-3 w-3 text-white" />}
              {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
            </span>
            <div className={`text-sm ${filled ? "font-semibold" : "opacity-60"}`} style={filled ? { color: primary } : {}}>
              {step.label}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
