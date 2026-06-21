import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  STATUS_INFO,
  formatRelative,
  googleMapsRouteUrl,
  orderShortNumber,
  type DeliveryStatus,
} from "@/lib/tracking";
import { Bike, MapPin, Navigation, CheckCircle2, AlertTriangle, Loader2, Phone, Power } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/entrega/$courierToken")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrega — ZappFy" }] }),
  component: CourierPage,
});

type CourierTheme = {
  inherit_client: boolean;
  primary_color: string;
  secondary_color: string;
  header_style: "solid" | "gradient";
  header_color: string;
  background_color: string;
  card_color: string;
  card_border_color: string;
  card_shadow_color: string;
  text_color: string;
  title_color: string;
  button_color: string;
  icon_color: string;
  footer_text: string;
};

type CourierView = {
  id: string;
  tracking_code: string;
  status: DeliveryStatus;
  courier_name: string | null;
  courier_phone: string | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  order: {
    id: string;
    customer: string;
    phone: string;
    address: string;
    district: string;
    city: string;
    total: number;
    notes: string | null;
    date: string;
  };
  store: { name: string; whatsapp: string; logo_url: string | null };
  settings?: CourierTheme;
};

const DEFAULT_THEME: CourierTheme = {
  inherit_client: true,
  primary_color: "#10b981",
  secondary_color: "#0b1220",
  header_style: "solid",
  header_color: "#0f172a",
  background_color: "#0b1220",
  card_color: "#0f172a",
  card_border_color: "#1e293b",
  card_shadow_color: "#000000",
  text_color: "#e5e7eb",
  title_color: "#ffffff",
  button_color: "#10b981",
  icon_color: "#10b981",
  footer_text: "Powered by Zappfy",
};

function CourierPage() {
  const { courierToken } = Route.useParams();
  const [data, setData] = useState<CourierView | null>(null);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const wakeLockRef = useRef<any>(null);

  async function load() {
    const { data: res, error } = await supabase.rpc("get_courier_view", { _token: courierToken });
    if (!error && res) setData(res as CourierView);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [courierToken]);

  useEffect(() => () => stopWatch(), []);

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        // @ts-ignore
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {}
  }

  function stopWatch() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (wakeLockRef.current) {
      try { wakeLockRef.current.release(); } catch {}
      wakeLockRef.current = null;
    }
    setWatching(false);
  }

  async function sendLocation(pos: GeolocationPosition) {
    setSending(true);
    const { latitude, longitude, speed, heading, accuracy } = pos.coords;
    const { error } = await supabase.rpc("update_courier_location", {
      _token: courierToken,
      _lat: latitude,
      _lng: longitude,
      _speed: speed ?? undefined,
      _heading: heading ?? undefined,
      _accuracy: accuracy ?? undefined,
    });
    setSending(false);
    if (error) {
      console.error(error);
    } else {
      setLastSent(Date.now());
    }
  }

  function startWatch(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        const msg = "Seu navegador não suporta geolocalização.";
        setPermError(msg);
        reject(new Error(msg));
        return;
      }
      setPermError(null);
      let resolved = false;
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const now = Date.now();
          const last = lastPosRef.current;
          const movedEnough =
            !last ||
            now - last.t > 8000 ||
            Math.hypot(latitude - last.lat, longitude - last.lng) * 111_000 > 15;
          if (movedEnough) {
            lastPosRef.current = { lat: latitude, lng: longitude, t: now };
            sendLocation(pos);
          }
          if (!resolved) {
            resolved = true;
            setWatching(true);
            requestWakeLock();
            resolve(pos);
          }
        },
        (err) => {
          setPermError(
            err.code === 1
              ? "Permissão de localização negada. Permita a localização no navegador e tente novamente."
              : err.message,
          );
          stopWatch();
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      );
      watchIdRef.current = id;
    });
  }

  async function changeStatus(newStatus: "saiu_para_entrega" | "chegando" | "entregue") {
    const { error } = await supabase.rpc("update_courier_status", { _token: courierToken, _status: newStatus });
    if (error) { toast.error(error.message); return; }
    await load();
    if (newStatus === "entregue") {
      stopWatch();
      toast.success("Entrega finalizada! 🎉");
    } else if (newStatus === "saiu_para_entrega") {
      toast.success("Entrega iniciada");
    } else {
      toast.success("Cliente notificado: você está chegando");
    }
  }

  async function handleStart() {
    try {
      if (!watching) await startWatch();
    } catch {
      return; // permission denied or error; keep button available
    }
    if (data?.status === "aguardando_motoboy" || data?.status === "preparando") {
      await changeStatus("saiu_para_entrega");
    }
  }

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
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-xl font-semibold">Link inválido</h1>
          <p className="text-sm opacity-70 mt-2">Peça à loja para gerar um novo link.</p>
        </div>
      </div>
    );
  }

  const info = STATUS_INFO[data.status];
  const isFinished = data.status === "entregue" || data.status === "cancelado";
  const fullAddress = [data.order.address, data.order.district, data.order.city].filter(Boolean).join(", ");
  const t: CourierTheme = { ...DEFAULT_THEME, ...(data.settings ?? {}) };
  const headerBg = t.header_style === "gradient"
    ? `linear-gradient(135deg, ${t.header_color} 0%, ${t.secondary_color} 100%)`
    : t.header_color;
  const cardStyle: React.CSSProperties = {
    background: t.card_color,
    border: `1px solid ${t.card_border_color}`,
    boxShadow: `0 10px 26px -12px ${t.card_shadow_color}88`,
  };
  const primarySoftBg = `${t.primary_color}22`;

  return (
    <div className="min-h-screen pb-10" style={{ background: t.background_color, color: t.text_color }}>
      <header className="px-5 pt-6 pb-5 text-center" style={{ background: headerBg, borderBottom: `1px solid ${t.card_border_color}` }}>
        {data.store.logo_url && (
          <img src={data.store.logo_url} alt={data.store.name} className="h-12 w-auto mx-auto mb-2 object-contain" />
        )}
        <div className="text-lg font-bold" style={{ color: "#fff" }}>{data.store.name}</div>
        <div className="text-xs opacity-80" style={{ color: "#fff" }}>Pedido #{orderShortNumber(data.order.id)}</div>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium" style={{ background: primarySoftBg, color: t.primary_color }}>
          <Bike className="h-3.5 w-3.5" /> {info.label}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 space-y-4 mt-4">
        {/* Address */}
        <section className="rounded-2xl p-4" style={cardStyle}>
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 mt-0.5" style={{ color: t.icon_color }} />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider opacity-60">Entregar em</div>
              <div className="font-semibold leading-snug" style={{ color: t.title_color }}>{fullAddress}</div>
              {data.order.notes && (
                <div className="text-xs opacity-80 mt-2 whitespace-pre-wrap">{data.order.notes}</div>
              )}
            </div>
          </div>
          <a
            href={googleMapsRouteUrl(fullAddress)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:opacity-90"
            style={{ background: t.button_color, color: "#fff" }}
          >
            <Navigation className="h-4 w-4" /> Abrir rota no Google Maps
          </a>
        </section>

        {/* Customer */}
        <section className="rounded-2xl p-4 space-y-2" style={cardStyle}>
          <div className="text-xs uppercase tracking-wider opacity-60">Cliente</div>
          <div className="font-semibold" style={{ color: t.title_color }}>{data.order.customer}</div>
          {data.order.phone && (
            <a
              href={`tel:${data.order.phone}`}
              className="inline-flex items-center gap-1.5 text-sm hover:opacity-80"
              style={{ color: t.icon_color }}
            >
              <Phone className="h-3.5 w-3.5" /> {data.order.phone}
            </a>
          )}
          {data.notes && (
            <div className="text-xs italic opacity-80 pt-1 border-t" style={{ borderColor: t.card_border_color }}>Obs: {data.notes}</div>
          )}
        </section>

        {/* Status / actions */}
        {!isFinished && (
          <section className="rounded-2xl p-4 space-y-3" style={cardStyle}>
            {permError && (
              <div className="rounded-lg bg-red-500/15 text-red-300 text-xs p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {permError}
              </div>
            )}
            {watching && (
              <div className="rounded-lg text-xs p-3" style={{ background: primarySoftBg, color: t.primary_color }}>
                <div className="flex items-center gap-2 font-medium">
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: t.primary_color }} />
                  Enviando sua localização em tempo real
                </div>
                <div className="opacity-80 mt-1">
                  {sending ? "Sincronizando…" : `Último envio: ${formatRelative(lastSent ? new Date(lastSent) : null)}`}
                </div>
                <div className="opacity-70 mt-2 text-[11px]">⚠️ Mantenha esta tela aberta durante a entrega.</div>
              </div>
            )}

            {data.status === "aguardando_motoboy" || data.status === "preparando" ? (
              <Button onClick={handleStart} className="w-full h-12 text-base hover:opacity-90" style={{ background: t.primary_color, color: "#fff" }}>
                <Bike className="h-5 w-5 mr-2" /> Iniciar Entrega
              </Button>
            ) : (
              <>
                {!watching && (
                  <Button onClick={startWatch} className="w-full h-11 hover:opacity-90" style={{ background: t.primary_color, color: "#fff" }}>
                    <MapPin className="h-4 w-4 mr-2" /> Retomar rastreamento
                  </Button>
                )}
                {data.status !== "chegando" && (
                  <Button onClick={() => changeStatus("chegando")} className="w-full h-11 hover:opacity-90" style={{ background: t.secondary_color, color: "#fff" }}>
                    Estou chegando
                  </Button>
                )}
                <Button onClick={() => changeStatus("entregue")} className="w-full h-12 text-base hover:opacity-90" style={{ background: t.button_color, color: "#fff" }}>
                  <CheckCircle2 className="h-5 w-5 mr-2" /> Finalizar Entrega
                </Button>
                {watching && (
                  <button onClick={stopWatch} className="w-full text-xs opacity-60 hover:opacity-100 inline-flex items-center justify-center gap-1 pt-1">
                    <Power className="h-3 w-3" /> Pausar envio de localização
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {isFinished && (
          <section className="rounded-2xl p-6 text-center" style={{ ...cardStyle, background: primarySoftBg, borderColor: `${t.primary_color}55` }}>
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2" style={{ color: t.primary_color }} />
            <div className="text-lg font-semibold" style={{ color: t.title_color }}>{data.status === "entregue" ? "Entrega finalizada" : "Entrega cancelada"}</div>
            {data.completed_at && (
              <div className="text-xs opacity-70 mt-1">{formatRelative(data.completed_at)}</div>
            )}
          </section>
        )}
      </main>

      <footer className="text-center text-[11px] opacity-50 mt-8">{t.footer_text}</footer>
    </div>
  );
}
