import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrackingMap } from "@/components/TrackingMap";
import {
  STATUS_BADGE_DEFAULTS,
  STATUS_INFO,
  TIMELINE_STEPS,
  deriveDisplayStatus,
  distanceMeters,
  etaMinutes,
  orderShortNumber,
  whatsappLink,
  type DeliveryStatus,
  type StatusBadgeStyle,
} from "@/lib/tracking";
import { Check, Clock, MapPin, MessageCircle, Bike, Loader2, Package } from "lucide-react";

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
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_geocoding_status: string | null;
  heading: number | null;
  speed: number | null;
  last_updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  order: {
    id: string; customer: string; address: string; district: string; city: string; total: number; status: string; date: string;
    items?: Array<{ productId?: string; name?: string; qty?: number; price?: number; variation?: string; color?: string; size?: string; image_url?: string | null }>;
  };
  store: { name: string; whatsapp: string; logo_url: string | null };
  settings: {
    primary_color: string;
    secondary_color: string;
    background_color: string;
    button_color: string;
    text_color: string;
    title_color: string;
    card_color: string;
    card_border_color: string;
    card_opacity: number;
    card_glass: boolean;
    card_shadow: string;
    card_shadow_color: string;
    card_radius: number;
    border_intensity: number;
    status_color: string;
    status_styles: Partial<Record<DeliveryStatus, Partial<StatusBadgeStyle>>>;
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
    show_products: boolean;
    show_product_price: boolean;
    vehicle_type: "moto" | "carro";
    vehicle_color: string;
    vehicle_custom_url: string | null;
    pin_color: string;
    pin_custom_url: string | null;
    header_style: "solid" | "gradient";
    header_color: string;
    header_height: number;
    header_logo_size: number;
    header_logo_align: "left" | "center" | "right";
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
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  // Refetch latest tracking row when the browser regains internet
  useEffect(() => {
    const onOnline = () => { load(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // realtime updates for tracking row, with auto-reconnect + safety polling
  useEffect(() => {
    if (!data?.id) return;
    let cancelled = false;
    let channel = supabase
      .channel(`public_tracking_${data.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_tracking", filter: `id=eq.${data.id}` },
        () => load(),
      )
      .subscribe();

    // Safety net: every 15s, refetch so the courier marker keeps moving even
    // if the realtime socket silently dropped a message.
    const poll = setInterval(() => { if (!cancelled) load(); }, 15_000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
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

  // Prefer persisted destination coords from the database; geocode + persist as a fallback
  useEffect(() => {
    if (!data) return;
    if (data.delivery_latitude != null && data.delivery_longitude != null) {
      setDestination({ lat: data.delivery_latitude, lng: data.delivery_longitude });
      return;
    }
    if (destination) return;
    // Do not retry geocoding if the merchant or a previous attempt already failed —
    // they need to set the destination manually from the dashboard.
    if (data.delivery_geocoding_status === "failed") return;
    const fullAddress = [data.order?.address, data.order?.district, data.order?.city].filter(Boolean).join(", ");
    if (!fullAddress) return;
    const ctrl = new AbortController();
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(fullAddress)}`, {
      signal: ctrl.signal,
      headers: { "Accept-Language": "pt-BR" },
    })
      .then((r) => r.json())
      .then((arr) => {
        if (Array.isArray(arr) && arr[0]) {
          const lat = parseFloat(arr[0].lat);
          const lng = parseFloat(arr[0].lon);
          setDestination({ lat, lng });
          supabase.rpc("set_tracking_destination", { _code: trackingCode, _lat: lat, _lng: lng, _address: fullAddress, _status: "success" }).then(() => {});
        } else {
          // record the failure so the merchant sees the alert
          supabase.rpc("set_tracking_destination", { _code: trackingCode, _lat: null as unknown as number, _lng: null as unknown as number, _address: fullAddress, _status: "failed" }).then(() => {});
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [data, destination, trackingCode]);

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
    (displayStatus === "saiu_para_entrega" || displayStatus === "chegando") &&
    data.last_updated_at &&
    Date.now() - new Date(data.last_updated_at).getTime() > 60_000;

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
  
  const titleColor = s.title_color || s.text_color;
  const isGradientBg = typeof s.background_color === "string" && s.background_color.includes("gradient");
  const cs = cardStyle({
    card_color: cardBg,
    card_border_color: s.card_border_color || "#1e293b",
    card_opacity: s.card_opacity ?? 1,
    card_glass: !!s.card_glass,
    card_shadow: s.card_shadow || "md",
    card_shadow_color: s.card_shadow_color || "#000000",
    card_radius: s.card_radius ?? 16,
    border_intensity: s.border_intensity ?? 1,
  });
  const badgeDef = STATUS_BADGE_DEFAULTS[displayStatus];
  const badgeOverride = s.status_styles?.[displayStatus] ?? {};
  const badge: StatusBadgeStyle = {
    bg: badgeOverride.bg || badgeDef.bg,
    border: badgeOverride.border || badgeDef.border,
    text: badgeOverride.text || badgeDef.text,
    icon: badgeOverride.icon || badgeDef.icon,
  };
  const BadgeIcon = info.Icon;

  return (
    <div
      className="min-h-screen pb-12"
      style={{
        background: isGradientBg ? undefined : s.background_color,
        backgroundImage: isGradientBg ? s.background_color : undefined,
        color: s.text_color,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <HeaderBar
        style={s.header_style}
        color={s.header_color}
        secondary={s.secondary_color}
        height={s.header_height}
        logoSize={s.header_logo_size}
        align={s.header_logo_align}
        showLogo={s.show_store_logo}
        logoUrl={data.store.logo_url}
        storeName={data.store.name}
      />

      <main className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: titleColor }}>{data.store.name}</h1>
          <p className="text-base font-semibold mt-1.5" style={{ color: titleColor, opacity: 0.95 }}>{s.tracking_page_title}</p>
          <p className="text-sm opacity-75 mt-0.5">{s.tracking_page_subtitle}</p>
          <div
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-lg"
            style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`, boxShadow: `0 8px 24px -8px ${hexWithAlpha(badge.icon, 0.5)}` }}
            key={displayStatus}
          >
            <BadgeIcon className="h-4 w-4" style={{ color: badge.icon }} />
            <span>{info.label}</span>
            {!isFinished && (
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: badge.icon }} />
            )}
          </div>
        </div>
        {/* 2. Order card */}
        <section className="rounded-2xl p-5 animate-fade-in" style={cs}>
          <div className="text-xs uppercase opacity-60 tracking-wider">Pedido</div>
          <div className="text-lg font-bold" style={{ color: titleColor }}>#{orderShortNumber(data.order.id)}</div>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: s.text_color }}>{message}</p>
          {stale && (
            <div className="mt-3 text-xs rounded-lg px-3 py-2" style={{ background: "#f59e0b22", color: "#f59e0b" }}>
              <Clock className="inline h-3.5 w-3.5 mr-1" /> Aguardando nova atualização do entregador…
            </div>
          )}
        </section>

        {/* 3. Products card */}
        {s.show_products && Array.isArray(data.order.items) && data.order.items.length > 0 && (
          <section className="rounded-2xl p-5" style={cs}>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: titleColor }}>
              <Package className="h-4 w-4" style={{ color: s.primary_color }} />
              Produtos do pedido
            </h3>
            <ul className="space-y-3">
              {data.order.items.map((it, idx) => {
                const variation = [it.variation, it.color, it.size].filter(Boolean).join(" · ");
                const qty = it.qty ?? 1;
                const price = typeof it.price === "number" ? it.price : null;
                const subtotal = price != null ? price * qty : null;
                return (
                  <li key={idx} className="flex gap-3 items-start">
                    <div
                      className="flex-shrink-0 h-14 w-14 rounded-lg overflow-hidden flex items-center justify-center"
                      style={{ background: hexWithAlpha(s.primary_color, 0.12), border: `1px solid ${hexWithAlpha(s.card_border_color || "#1e293b", 0.6)}` }}
                    >
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.name ?? "Produto"} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 opacity-60" style={{ color: s.primary_color }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: titleColor }}>{it.name ?? "Produto"}</div>
                      <div className="text-xs opacity-75 mt-0.5">Quantidade: {qty}</div>
                      {variation && <div className="text-xs opacity-75">{variation}</div>}
                      {s.show_product_price && price != null && (
                        <div className="text-xs opacity-80 mt-1">
                          {qty > 1 && <span>{qty} × R$ {price.toFixed(2).replace(".", ",")} · </span>}
                          <span className="font-semibold" style={{ color: s.primary_color }}>
                            R$ {(subtotal ?? price).toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}



        {/* 3. Timeline card */}
        <section className="rounded-2xl p-5" style={cs}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: titleColor }}>Acompanhamento</h3>
          <Timeline status={displayStatus} primary={timelineColor} textColor={s.text_color} />
        </section>

        {/* 4. Map card */}
        {displayStatus !== "cancelado" && (
          <section className="rounded-2xl overflow-hidden relative" style={cs}>
            <div className="relative">
              <TrackingMap
                courier={courierPos}
                destination={destination}
                heading={data.heading}
                primaryColor={s.primary_color}
                vehicle={{ type: s.vehicle_type, color: s.vehicle_color, customUrl: s.vehicle_custom_url }}
                pin={{ color: s.pin_color, customUrl: s.pin_custom_url }}
                height={380}
              />
              {!courierPos && !isFinished && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur" style={{ background: hexWithAlpha(s.card_color || "#0f172a", 0.92), color: s.text_color, border: `1px solid ${hexWithAlpha(s.primary_color, 0.4)}` }}>
                  <Loader2 className="inline h-3 w-3 mr-1.5 animate-spin" />
                  Aguardando localização do entregador...
                </div>
              )}
              {!destination && !isFinished && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur text-center max-w-[90%]" style={{ background: hexWithAlpha(s.card_color || "#0f172a", 0.92), color: s.text_color, border: `1px solid ${hexWithAlpha("#f59e0b", 0.6)}` }}>
                  📍 Destino ainda não localizado. A loja pode ajustar o ponto de entrega.
                </div>
              )}
              {isFinished && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg" style={{ background: "#10b981", color: "#fff" }}>
                  ✓ Pedido entregue
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-5 px-4 py-3 text-xs" style={{ color: s.text_color }}>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>🛵</span>
                <span className="font-medium">Entregador</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>📍</span>
                <span className="font-medium">Destino</span>
              </span>
            </div>
          </section>
        )}

        {/* 5. Small info cards under the map */}
        {displayStatus !== "cancelado" && (s.show_estimated_time || (s.show_courier_name && data.courier.name)) && (
          <section className="grid grid-cols-2 gap-3">
            {s.show_estimated_time && (
              <InfoCard color={s.primary_color} style={cs} label="Chegada estimada" value={eta != null ? `${eta} min` : "—"} />
            )}
            {s.show_courier_name && data.courier.name && (
              <InfoCard color={s.primary_color} style={cs} label="Entregador" value={data.courier.name} />
            )}
          </section>
        )}

        {/* 6. Delivery address */}
        <section className="rounded-2xl p-4 text-sm" style={cs}>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5" style={{ color: s.primary_color }} />
            <div>
              <div className="font-medium" style={{ color: titleColor }}>Endereço de entrega</div>
              <div className="opacity-80">{data.order.address}{data.order.district ? `, ${data.order.district}` : ""}{data.order.city ? ` — ${data.order.city}` : ""}</div>
            </div>
          </div>
        </section>

        {/* 7. WhatsApp button */}
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
        Rastreamento fornecido por <strong>{data.store.name || "Sua Loja"}</strong>
      </footer>
    </div>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith("#") || hex.length !== 7) return hex;
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return hex + a.toString(16).padStart(2, "0");
}
function shadowFor(level: string, color: string): string {
  const c = color || "#000000";
  switch (level) {
    case "none": return "none";
    case "sm": return `0 2px 8px ${hexWithAlpha(c, 0.18)}`;
    case "lg": return `0 18px 40px -10px ${hexWithAlpha(c, 0.55)}`;
    case "xl": return `0 30px 60px -16px ${hexWithAlpha(c, 0.7)}`;
    default: return `0 10px 24px -8px ${hexWithAlpha(c, 0.4)}`;
  }
}
function cardStyle(f: {
  card_color: string; card_border_color: string; card_opacity: number;
  card_glass: boolean; card_shadow: string; border_intensity: number;
  card_shadow_color?: string; card_radius?: number;
}): React.CSSProperties {
  const bg = f.card_glass ? hexWithAlpha(f.card_color, Math.min(f.card_opacity, 0.6)) : hexWithAlpha(f.card_color, f.card_opacity);
  const borderAlpha = Math.max(0, Math.min(1, f.border_intensity));
  const style: React.CSSProperties = {
    background: bg,
    border: `1px solid ${hexWithAlpha(f.card_border_color, borderAlpha)}`,
    boxShadow: shadowFor(f.card_shadow, f.card_shadow_color || "#000000"),
    borderRadius: (f.card_radius ?? 16) + "px",
  };
  if (f.card_glass) {
    (style as any).backdropFilter = "blur(20px) saturate(140%)";
  }
  return style;
}

function InfoCard({ label, value, color, style }: { label: string; value: string; color: string; style: React.CSSProperties }) {
  return (
    <div className="rounded-xl p-3" style={style}>
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="text-base font-semibold mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}

function Timeline({ status, primary, textColor }: { status: DeliveryStatus; primary: string; textColor?: string }) {
  const order: DeliveryStatus[] = ["aguardando_motoboy", "preparando", "saiu_para_entrega", "chegando", "entregue"];
  const currentIdx = status === "cancelado" ? -1 : order.indexOf(status);
  return (
    <ol className="relative space-y-4 pl-7">
      <span className="absolute left-3 top-2 bottom-2 w-px" style={{ background: hexWithAlpha(primary, 0.2) }} />
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
                border: `2px solid ${filled ? primary : hexWithAlpha(primary, 0.35)}`,
                boxShadow: isCurrent ? `0 0 0 6px ${hexWithAlpha(primary, 0.2)}` : "none",
              }}
            >
              {done && <Check className="h-3 w-3 text-white" />}
              {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
            </span>
            <div className={`text-sm ${filled ? "font-semibold" : "opacity-60"}`} style={{ color: filled ? primary : textColor }}>
              {step.label}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function HeaderBar({ style, color, secondary, height, logoSize, align, showLogo, logoUrl, storeName }: {
  style: "solid" | "gradient"; color: string; secondary: string; height: number; logoSize: number;
  align: "left" | "center" | "right"; showLogo: boolean; logoUrl: string | null; storeName: string;
}) {
  const bg = style === "gradient" ? `linear-gradient(135deg, ${color} 0%, ${secondary} 100%)` : color;
  const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  return (
    <div
      className="w-full flex items-center px-5 shadow-sm"
      style={{ background: bg, height: `clamp(${Math.round(height * 0.75)}px, 12vw, ${height}px)`, justifyContent: justify }}
    >
      {showLogo && logoUrl
        ? <img src={logoUrl} alt={storeName} style={{ height: logoSize, maxHeight: "80%", width: "auto" }} className="object-contain drop-shadow" />
        : <div style={{ color: "#fff", fontWeight: 800, letterSpacing: 0.5 }}>{storeName}</div>}
    </div>
  );
}
