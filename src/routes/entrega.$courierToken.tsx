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
import { Bike, MapPin, Navigation, CheckCircle2, AlertTriangle, Loader2, Phone, Power, Wifi, WifiOff } from "lucide-react";
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
  header_height: number;
  header_logo_size: number;
  header_logo_align: "left" | "center" | "right";
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
  header_height: 110,
  header_logo_size: 56,
  header_logo_align: "center",
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
  const latestPosRef = useRef<GeolocationPosition | null>(null);
  const wakeLockRef = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  async function load() {
    const { data: res, error } = await supabase.rpc("get_courier_view", { _token: courierToken });
    if (!error && res) setData(res as CourierView);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [courierToken]);

  useEffect(() => () => stopWatch(), []);

  // online/offline indicator
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Re-acquire wake lock if it was released (e.g., tab hidden then visible)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && watching && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [watching]);

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
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (wakeLockRef.current) {
      try { wakeLockRef.current.release(); } catch {}
      wakeLockRef.current = null;
    }
    setWatching(false);
  }

  async function sendLocation(pos: GeolocationPosition) {
    latestPosRef.current = pos;
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

  function startHeartbeat() {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      // Re-send the most recent known position every 10s so the client sees
      // last_updated_at advancing even when the courier is stopped.
      const pos = latestPosRef.current;
      if (pos) {
        sendLocation(pos);
      } else if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (p) => sendLocation(p),
          () => {},
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
        );
      }
    }, 10_000);
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
          latestPosRef.current = pos;
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
            startHeartbeat();
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
  const cardStyle: React.CSSProperties = {
    background: t.card_color,
    border: `1px solid ${t.card_border_color}`,
    boxShadow: `0 10px 26px -12px ${t.card_shadow_color}88`,
  };
  const primarySoftBg = `${t.primary_color}22`;
  const headerJustify = t.header_logo_align === "left" ? "flex-start" : t.header_logo_align === "right" ? "flex-end" : "center";
  // Responsive: mobile uses ~85% of the configured desktop height.
  const headerMobileH = Math.max(72, Math.round(t.header_height * 0.85));
  const headerLogoMobile = Math.max(28, Math.round(t.header_logo_size * 0.85));

  return (
    <div className="min-h-screen pb-10" style={{ background: t.background_color, color: t.text_color }}>
      <style>{`@media (min-width: 768px){ header[data-courier-hdr]{ height: var(--hdr-h) !important; } header[data-courier-hdr] img{ height: var(--hdr-logo) !important; max-height: 80% !important; } }`}</style>
      <header
        data-courier-hdr
        className="w-full flex items-center"
        style={{
          background: t.header_color,
          justifyContent: headerJustify,
          paddingLeft: t.header_logo_align === "center" ? 20 : 24,
          paddingRight: t.header_logo_align === "center" ? 20 : 24,
          ['--hdr-h' as any]: `${t.header_height}px`,
          ['--hdr-logo' as any]: `${t.header_logo_size}px`,
          height: `${headerMobileH}px`,
        }}
      >
        {data.store.logo_url ? (
          <img
            src={data.store.logo_url}
            alt={data.store.name}
            style={{ height: headerLogoMobile, maxHeight: "78%", width: "auto" }}
            className="object-contain"
          />
        ) : (
          <div style={{ color: "#fff", fontWeight: 800, letterSpacing: 0.5, fontSize: 18 }}>{data.store.name}</div>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 space-y-4 mt-5">
        {/* Store + order header (body) */}
        <section className="text-center space-y-2">
          <div className="text-xl font-extrabold" style={{ color: t.title_color }}>{data.store.name}</div>
          <div className="text-xs opacity-70">Pedido #{orderShortNumber(data.order.id)}</div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium" style={{ background: primarySoftBg, color: t.primary_color }}>
            <Bike className="h-3.5 w-3.5" /> {info.label}
          </div>
        </section>

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
              <div className="rounded-lg text-xs p-3 space-y-1.5" style={{ background: primarySoftBg, color: t.primary_color }}>
                <div className="flex items-center justify-between gap-2 font-medium">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: t.primary_color }} />
                    GPS ativo · enviando em tempo real
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: online ? t.primary_color : "#f87171" }}>
                    {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {online ? "Online" : "Sem internet"}
                  </span>
                </div>
                <div className="opacity-80">
                  {sending ? "Sincronizando…" : `Último envio: ${formatRelative(lastSent ? new Date(lastSent) : null)}`}
                </div>
                <div className="opacity-70 text-[11px]">⚠️ Para manter o rastreamento ativo, não feche esta tela durante a entrega.</div>
              </div>
            )}
            {!watching && data.status !== "aguardando_motoboy" && data.status !== "preparando" && (
              <div className="rounded-lg text-xs p-3" style={{ background: "#f59e0b22", color: "#f59e0b" }}>
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" /> GPS pausado
                </div>
                <div className="opacity-80 mt-1">Toque em "Retomar rastreamento" para voltar a enviar sua localização.</div>
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
