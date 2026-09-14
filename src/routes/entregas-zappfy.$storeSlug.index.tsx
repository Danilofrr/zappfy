import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bike,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ListChecks,
  Loader2,
  LogOut,
  MapPin,
  MapPinned,
  MessageCircle,
  Navigation,
  Package,
  Phone,
  Power,
  Printer,
  RefreshCw,
  Route as RouteIcon,
  Store,
  Undo2,
  UserRound,
  WalletCards,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatRelative, orderShortNumber } from "@/lib/tracking";
import { brl } from "@/lib/format";
import { normalizePaymentBreakdown, paymentMethodLabel } from "@/lib/order-payments";
import { clearCourierSession, getCourierSession } from "@/lib/courier-session";
import { rememberEntregasPwa } from "@/lib/entregas-pwa";
import { CourierDeliveryMap } from "@/components/CourierDeliveryMap";
import { openShippingLabels } from "@/lib/shipping-labels";

export const Route = createFileRoute("/entregas-zappfy/$storeSlug/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entregas Zappfy — Central de Entregas" }] }),
  component: CentralPage,
});

type CentralTheme = {
  id: string;
  logo_url: string | null;
  logo_size: number;
  header_color: string;
  header_text_color: string;
  background_color: string;
  card_color: string;
  card_border_color: string;
  card_shadow_color: string;
  card_radius: number;
  text_color: string;
  title_color: string;
  button_color: string;
  button_text_color: string;
  icon_color: string;
  footer_text: string;
  brand_name: string;
};

type Delivery = {
  id: string;
  tracking_code: string;
  courier_token: string;
  status: string;
  scheduled_for: string | null;
  accepted_at: string | null;
  created_at: string;
  notes: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_geocoded_address?: string | null;
  delivery_geocoding_status?: string | null;
  order: {
    id: string;
    customer: string;
    phone: string;
    address: string;
    district: string;
    city: string;
    total: number;
    notes: string | null;
    payment: string;
    items: { name: string; qty: number }[];
  };
};

type Me = {
  courier_id: string;
  name: string;
  phone: string;
  is_online: boolean;
  online_updated_at?: string | null;
  store_id: string;
  store_name: string;
  store_logo_url: string | null;
  slug: string;
};

const DEFAULT_THEME: CentralTheme = {
  id: "",
  logo_url: null,
  logo_size: 48,
  header_color: "#07120d",
  header_text_color: "#ffffff",
  background_color: "#08110d",
  card_color: "#0d1812",
  card_border_color: "#1c2d23",
  card_shadow_color: "#000000",
  card_radius: 20,
  text_color: "#d9e6de",
  title_color: "#ffffff",
  button_color: "#18c56e",
  button_text_color: "#04140b",
  icon_color: "#23d57a",
  footer_text: "Powered by Zappfy",
  brand_name: "Zappfy Entregas",
};

function brazilDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatCentralScheduledDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function normalizeDeliveryStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isMapPendingDelivery(value: string | null | undefined) {
  return !["entregue", "devolvido", "cancelado"].includes(normalizeDeliveryStatus(value));
}

function statusMeta(status: string) {
  const normalized = normalizeDeliveryStatus(status);
  if (normalized === "entregue") return { label: "Entregue", fg: "#22c55e", bg: "#22c55e18" };
  if (["saiu_para_entrega", "chegando"].includes(normalized))
    return { label: normalized === "chegando" ? "Chegando" : "Em rota", fg: "#60a5fa", bg: "#3b82f618" };
  if (normalized === "nao_entregue") return { label: "Não entregue", fg: "#fb923c", bg: "#f9731618" };
  if (normalized === "retornando") return { label: "Retornando", fg: "#c084fc", bg: "#a855f718" };
  if (normalized === "devolvido") return { label: "Devolvido", fg: "#94a3b8", bg: "#64748b18" };
  if (normalized === "cancelado") return { label: "Cancelado", fg: "#f87171", bg: "#ef444418" };
  if (normalized === "preparando") return { label: "Preparando", fg: "#fbbf24", bg: "#f59e0b18" };
  return { label: "Aguardando", fg: "#facc15", bg: "#eab30818" };
}

function CentralBrand({ color, accent }: { color: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border"
        style={{
          background: `linear-gradient(145deg, ${accent}, color-mix(in oklab, ${accent} 68%, #052e16))`,
          borderColor: `${accent}66`,
          boxShadow: `0 10px 28px -12px ${accent}`,
          color: "#04140b",
        }}
      >
        <MapPinned className="h-6 w-6" strokeWidth={2.3} />
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-[#07120d] bg-white text-[#07120d]">
          <Navigation className="h-3 w-3" fill="currentColor" />
        </span>
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[17px] font-black tracking-[-0.03em]" style={{ color }}>
          Zappfy
        </div>
        <div className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] opacity-65">
          Central de Entregas
        </div>
      </div>
    </div>
  );
}

function CentralPage() {
  const { storeSlug } = Route.useParams();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<CentralTheme>(DEFAULT_THEME);
  const [me, setMe] = useState<Me | null>(null);
  const [available, setAvailable] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTrackingCode, setBusyTrackingCode] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [activeView, setActiveView] = useState<"deliveries" | "map">("deliveries");

  useEffect(() => {
    let alive = true;
    rememberEntregasPwa(storeSlug);

    (async () => {
      setLoading(true);
      const session = getCourierSession(storeSlug);
      if (!session) {
        navigate({ to: "/entregas-zappfy/$storeSlug/login", params: { storeSlug }, replace: true });
        return;
      }

      const [{ data: themeRes }, { data: meRes, error: meErr }] = await Promise.all([
        (supabase as any).rpc("get_zappfy_central_settings"),
        (supabase as any).rpc("courier_me", { _session: session }),
      ]);

      if (!alive) return;
      if (themeRes) setTheme({ ...DEFAULT_THEME, ...(themeRes as CentralTheme) });

      if (meErr || !meRes) {
        clearCourierSession(storeSlug);
        navigate({ to: "/entregas-zappfy/$storeSlug/login", params: { storeSlug }, replace: true });
        return;
      }

      setMe(meRes as Me);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [navigate, storeSlug]);

  async function toggleOnlineStatus() {
    const session = getCourierSession(storeSlug);
    if (!session || !me) return;
    const nextOnline = !me.is_online;
    setStatusBusy(true);
    const { error } = await (supabase as any).rpc("courier_set_online", {
      _session: session,
      _online: nextOnline,
    });
    setStatusBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMe((current) =>
      current ? { ...current, is_online: nextOnline, online_updated_at: new Date().toISOString() } : current,
    );
    toast.success(nextOnline ? "Você está ativo para entregas" : "Você está offline");
  }

  async function loadDeliveries() {
    const session = getCourierSession(storeSlug);
    if (!session) return;
    const { data: deliveries, error } = await (supabase as any).rpc("list_my_delivery_load", {
      _session: session,
    });
    if (error) {
      console.error(error);
      return;
    }
    if (Array.isArray(deliveries)) setAvailable(deliveries as Delivery[]);
  }

  useEffect(() => {
    if (!me) return;
    loadDeliveries();
    const interval = setInterval(loadDeliveries, 15000);
    const channel = supabase
      .channel(`central_${me.store_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_tracking", filter: `store_id=eq.${me.store_id}` },
        () => loadDeliveries(),
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.store_id]);

  useEffect(() => {
    if (!me || activeView !== "map") return;
    void loadDeliveries();
    const refreshVisibleMap = () => void loadDeliveries();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadDeliveries();
    };
    window.addEventListener("focus", refreshVisibleMap);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshVisibleMap);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, me?.store_id]);

  async function action(d: Delivery, actionName: string) {
    const session = getCourierSession(storeSlug);
    if (!session) return;
    let reason: string | null = null;
    if (actionName === "reject") {
      const confirmed = confirm(
        "Recusar esta entrega? O pedido deixará sua Central e voltará para o administrador atribuir a outro motoboy.",
      );
      if (!confirmed) return;
      reason = "Recusada pelo motoboy";
    }
    if (actionName === "fail") {
      reason = prompt("Motivo: cliente ausente, recusou, endereço não encontrado, não respondeu, pagamento ou outro")?.trim() || null;
    }
    if (actionName === "deliver" && !confirm("Confirmar que este pedido foi entregue?")) return;

    setBusyTrackingCode(d.tracking_code);
    const { error } = await (supabase as any).rpc("courier_delivery_action", {
      _session: session,
      _tracking_id: d.id,
      _action: actionName,
      _reason: reason,
    });
    setBusyTrackingCode(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (actionName === "reject") {
      toast.success("Entrega recusada. O pedido voltou para o administrador.");
      await loadDeliveries();
      return;
    }
    toast.success("Entrega atualizada");
    if (actionName === "accept" || actionName === "start") {
      setMe((current) => (current ? { ...current, is_online: true } : current));
      navigate({ to: "/entrega/$courierToken", params: { courierToken: d.courier_token } });
      return;
    }
    await loadDeliveries();
  }

  function logout() {
    const session = getCourierSession(storeSlug);
    if (session) (supabase as any).rpc("courier_logout", { _session: session });
    clearCourierSession(storeSlug);
    navigate({ to: "/entregas-zappfy/$storeSlug/login", params: { storeSlug }, replace: true });
  }

  function printMyDeliveryLabels() {
    if (!me) return;
    const pending = available.filter((delivery) => isMapPendingDelivery(delivery.status));
    if (!pending.length) {
      toast.error("Você não possui pedidos pendentes para imprimir");
      return;
    }
    const opened = openShippingLabels({
      storeName: me.store_name || "Loja",
      logoUrl: me.store_logo_url || null,
      orders: pending.map((delivery) => {
        const parts = normalizePaymentBreakdown(delivery.order);
        const paymentLabel = parts.length
          ? parts.map((part) => `${paymentMethodLabel(part.method)} ${brl(part.amount)}`).join(" + ")
          : paymentMethodLabel(delivery.order.payment);
        return {
          id: delivery.order.id,
          customer: delivery.order.customer,
          phone: delivery.order.phone,
          address: delivery.order.address,
          district: delivery.order.district,
          city: delivery.order.city,
          total: Number(delivery.order.total || 0),
          notes: delivery.order.notes || delivery.notes,
          paymentLabel,
          items: (delivery.order.items || []).map((item) => ({ name: item.name, qty: Number(item.qty || 0) })),
          courierName: me.name,
          scheduledFor: delivery.scheduled_for,
        };
      }),
    });
    if (!opened) toast.error("Permita pop-ups para gerar as etiquetas 10x15");
  }

  const todayKey = brazilDateKey();
  const mapCount = available.filter((d) => isMapPendingDelivery(d.status)).length;
  const metrics = useMemo(() => {
    const ready = available.filter(
      (d) => ["aguardando_motoboy", "preparando"].includes(d.status) && (!d.scheduled_for || d.scheduled_for <= todayKey),
    ).length;
    const scheduled = available.filter(
      (d) => ["aguardando_motoboy", "preparando"].includes(d.status) && Boolean(d.scheduled_for && d.scheduled_for > todayKey),
    ).length;
    const onRoute = available.filter((d) => ["saiu_para_entrega", "chegando"].includes(d.status)).length;
    const delivered = available.filter((d) => d.status === "entregue").length;
    const possession = available
      .filter((d) => isMapPendingDelivery(d.status))
      .reduce((n, d) => n + (d.order.items || []).reduce((s, i) => s + Number(i.qty), 0), 0);
    return { ready, scheduled, onRoute, delivered, possession };
  }, [available, todayKey]);

  const cardStyle: React.CSSProperties = {
    background: `linear-gradient(145deg, color-mix(in oklab, ${theme.card_color} 97%, white), ${theme.card_color})`,
    border: `1px solid ${theme.card_border_color}`,
    boxShadow: `0 18px 45px -28px ${theme.card_shadow_color}cc`,
    borderRadius: Math.max(theme.card_radius, 18),
    color: theme.text_color,
  };

  if (loading || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.background_color, color: theme.text_color }}>
        <div className="flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border" style={{ borderColor: theme.card_border_color, background: theme.card_color }}>
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.button_color }} />
          </div>
          <span className="text-xs opacity-60">Carregando sua central…</span>
        </div>
      </div>
    );
  }

  const summaryCards = [
    { label: "Para entregar", value: metrics.ready, icon: Package, tone: "#fbbf24" },
    { label: "Agendadas", value: metrics.scheduled, icon: CalendarDays, tone: "#a78bfa" },
    { label: "Em rota", value: metrics.onRoute, icon: RouteIcon, tone: "#60a5fa" },
    { label: "Entregues", value: metrics.delivered, icon: CheckCircle2, tone: "#22c55e" },
    { label: "Produtos em posse", value: metrics.possession, icon: Boxes, tone: theme.button_color },
  ];

  return (
    <div
      className="min-h-screen pb-8"
      style={{
        background: `radial-gradient(900px 420px at 15% -80px, ${theme.button_color}18, transparent 68%), ${theme.background_color}`,
        color: theme.text_color,
      }}
    >
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-xl"
        style={{
          background: `color-mix(in oklab, ${theme.header_color} 88%, transparent)`,
          color: theme.header_text_color,
          borderColor: theme.card_border_color,
        }}
      >
        <div className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <CentralBrand color={theme.header_text_color} accent={theme.button_color} />

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <div className="mr-2 flex items-center gap-2 rounded-full border px-3 py-2 text-xs" style={{ borderColor: theme.card_border_color, background: `${theme.card_color}aa` }}>
              <Store className="h-3.5 w-3.5" style={{ color: theme.icon_color }} />
              <span className="opacity-65">Loja</span>
              <strong className="max-w-44 truncate" style={{ color: theme.title_color }}>{me.store_name}</strong>
            </div>
            <button
              onClick={loadDeliveries}
              className="grid h-10 w-10 place-items-center rounded-xl border transition hover:-translate-y-0.5"
              style={{ borderColor: theme.card_border_color, background: theme.card_color, color: theme.header_text_color }}
              aria-label="Atualizar entregas"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={logout}
              className="grid h-10 w-10 place-items-center rounded-xl border transition hover:-translate-y-0.5"
              style={{ borderColor: theme.card_border_color, background: theme.card_color, color: theme.header_text_color }}
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <button
              onClick={loadDeliveries}
              className="grid h-9 w-9 place-items-center rounded-xl border"
              style={{ borderColor: `${theme.header_text_color}22`, color: theme.header_text_color }}
              aria-label="Atualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={logout}
              className="grid h-9 w-9 place-items-center rounded-xl border"
              style={{ borderColor: `${theme.header_text_color}22`, color: theme.header_text_color }}
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative overflow-hidden p-5 sm:p-6" style={cardStyle}>
            <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full blur-3xl" style={{ background: `${theme.button_color}1f` }} />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ borderColor: `${theme.button_color}44`, background: `${theme.button_color}10`, color: theme.button_color }}>
                    <Bike className="h-3.5 w-3.5" /> Painel do motoboy
                  </span>
                  <span className="text-xs opacity-55">Atualização automática</span>
                </div>
                <h1 className="text-2xl font-black tracking-[-0.035em] sm:text-3xl" style={{ color: theme.title_color }}>
                  Olá, {me.name.split(" ")[0]} 👋
                </h1>
                <p className="mt-1 max-w-xl text-sm opacity-65">
                  Acompanhe seus pedidos, rotas e produtos em posse em um único lugar.
                </p>
              </div>

              <div className="flex min-w-[240px] items-center justify-between gap-3 rounded-2xl border p-3" style={{ borderColor: theme.card_border_color, background: `${theme.background_color}88` }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: me.is_online ? `${theme.button_color}18` : `${theme.card_border_color}77`, color: me.is_online ? theme.button_color : theme.text_color }}>
                    {me.is_online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.11em] opacity-50">Status</div>
                    <div className="truncate text-sm font-bold" style={{ color: me.is_online ? theme.button_color : theme.title_color }}>
                      {me.is_online ? "Ativo para entregas" : "Offline"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={toggleOnlineStatus}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition active:scale-95"
                  style={{ borderColor: me.is_online ? `${theme.button_color}55` : theme.card_border_color, color: me.is_online ? theme.button_color : theme.title_color }}
                  aria-label={me.is_online ? "Ficar offline" : "Ficar ativo"}
                >
                  {statusBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 sm:p-5" style={cardStyle}>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${theme.icon_color}15`, color: theme.icon_color }}>
              {me.store_logo_url ? (
                <img src={me.store_logo_url} alt={me.store_name} className="h-10 w-10 rounded-xl object-contain" />
              ) : (
                <Store className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-45">Loja vinculada</div>
              <div className="truncate text-base font-bold" style={{ color: theme.title_color }}>{me.store_name}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] opacity-55">
                <Clock3 className="h-3.5 w-3.5" /> Central sincronizada em tempo real
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {summaryCards.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="group p-4 transition duration-200 hover:-translate-y-0.5" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-black tracking-[-0.04em] sm:text-3xl" style={{ color: theme.title_color }}>{value}</div>
                  <div className="mt-1 text-[11px] font-semibold leading-tight opacity-60 sm:text-xs">{label}</div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${tone}18`, color: tone }}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border p-1.5" style={{ borderColor: theme.card_border_color, background: theme.card_color }}>
            <button
              type="button"
              onClick={() => setActiveView("deliveries")}
              className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition"
              style={activeView === "deliveries" ? { background: theme.button_color, color: theme.button_text_color, boxShadow: `0 8px 24px -14px ${theme.button_color}` } : { color: theme.text_color }}
            >
              <ListChecks className="h-4 w-4" /> Pedidos <span className="opacity-70">{available.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView("map")}
              className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition"
              style={activeView === "map" ? { background: theme.button_color, color: theme.button_text_color, boxShadow: `0 8px 24px -14px ${theme.button_color}` } : { color: theme.text_color }}
            >
              <MapPinned className="h-4 w-4" /> Mapa <span className="opacity-70">{mapCount}</span>
            </button>
          </div>

          <Button
            type="button"
            disabled={mapCount === 0}
            onClick={printMyDeliveryLabels}
            className="h-12 rounded-2xl px-5 font-bold"
            style={{ background: theme.button_color, color: theme.button_text_color }}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir etiquetas ({mapCount})
          </Button>
        </section>

        {activeView === "map" ? (
          <div className="overflow-hidden rounded-3xl border p-2 sm:p-3" style={{ borderColor: theme.card_border_color, background: theme.card_color }}>
            <CourierDeliveryMap
              deliveries={available}
              storeSlug={storeSlug}
              onOpenDeliveries={() => setActiveView("deliveries")}
              theme={{
                cardColor: theme.card_color,
                cardBorderColor: theme.card_border_color,
                titleColor: theme.title_color,
                textColor: theme.text_color,
                buttonColor: theme.button_color,
                buttonTextColor: theme.button_text_color,
                iconColor: theme.icon_color,
                radius: Math.max(theme.card_radius, 18),
              }}
            />
          </div>
        ) : (
          <section>
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-45">Operação</div>
                <h2 className="text-lg font-black tracking-tight" style={{ color: theme.title_color }}>Minhas entregas</h2>
              </div>
              <div className="text-xs opacity-50">{available.length} {available.length === 1 ? "pedido" : "pedidos"}</div>
            </div>

            {available.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center" style={cardStyle}>
                <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl" style={{ background: `${theme.button_color}12`, color: theme.button_color }}>
                  <Package className="h-7 w-7" />
                </div>
                <div className="text-base font-bold" style={{ color: theme.title_color }}>Nenhuma entrega atribuída</div>
                <div className="mt-1 max-w-sm text-sm opacity-60">Quando a loja atribuir um pedido a você, ele aparecerá aqui automaticamente.</div>
                <Button className="mt-5 rounded-xl" variant="outline" onClick={loadDeliveries} style={{ borderColor: theme.card_border_color, color: theme.title_color }}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Atualizar agora
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {available.map((d) => {
                  const addr = [d.order.address, d.order.district, d.order.city].filter(Boolean).join(", ");
                  const busy = busyTrackingCode === d.tracking_code;
                  const paymentParts = normalizePaymentBreakdown(d.order);
                  const isScheduledForFuture = Boolean(d.scheduled_for && d.scheduled_for > todayKey);
                  const awaitingDecision = !d.accepted_at && ["aguardando_motoboy", "preparando"].includes(d.status);
                  const status = statusMeta(d.status);
                  const itemCount = (d.order.items || []).reduce((n, i) => n + Number(i.qty), 0);

                  return (
                    <article key={d.tracking_code} className="overflow-hidden" style={cardStyle}>
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-45">Pedido #{orderShortNumber(d.order.id)}</span>
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em]" style={{ background: status.bg, color: status.fg }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.fg }} /> {status.label}
                              </span>
                            </div>
                            <h3 className="truncate text-lg font-black tracking-tight" style={{ color: theme.title_color }}>{d.order.customer}</h3>
                          </div>
                          <div className="shrink-0 text-right text-[11px] opacity-45">{formatRelative(d.created_at)}</div>
                        </div>

                        {d.scheduled_for && (
                          <div className="mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: isScheduledForFuture ? `${theme.button_color}55` : theme.card_border_color, background: isScheduledForFuture ? `${theme.button_color}0f` : `${theme.background_color}55` }}>
                            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" style={{ color: isScheduledForFuture ? theme.button_color : theme.icon_color }} />
                            <div>
                              <div className="font-bold" style={{ color: theme.title_color }}>
                                {isScheduledForFuture ? `Agendada para ${formatCentralScheduledDate(d.scheduled_for)}` : "Entrega programada para hoje"}
                              </div>
                              {isScheduledForFuture && <div className="mt-0.5 opacity-55">Você pode aceitar agora e adiantar a entrega.</div>}
                            </div>
                          </div>
                        )}

                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                          <div className="space-y-2.5">
                            <div className="flex items-start gap-2.5 text-sm">
                              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${theme.icon_color}12`, color: theme.icon_color }}><MapPin className="h-3.5 w-3.5" /></div>
                              <div className="min-w-0 leading-snug">
                                <div className="font-semibold" style={{ color: theme.title_color }}>{addr || "Endereço não informado"}</div>
                                <div className="mt-0.5 text-[11px] opacity-45">Destino da entrega</div>
                              </div>
                            </div>

                            {d.order.phone && (
                              <div className="flex items-center gap-2.5 text-sm">
                                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${theme.icon_color}12`, color: theme.icon_color }}><Phone className="h-3.5 w-3.5" /></div>
                                <span className="font-medium opacity-80">{d.order.phone}</span>
                              </div>
                            )}
                          </div>

                          <div className="rounded-2xl border px-3 py-2.5 sm:min-w-[135px]" style={{ borderColor: theme.card_border_color, background: `${theme.background_color}66` }}>
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] opacity-45"><WalletCards className="h-3.5 w-3.5" /> Total</div>
                            <div className="mt-1 text-lg font-black" style={{ color: theme.title_color }}>{brl(d.order.total)}</div>
                            <div className="text-[11px] opacity-50">{itemCount} {itemCount === 1 ? "produto" : "produtos"}</div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: theme.card_border_color, background: `${theme.background_color}44` }}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] opacity-45"><Boxes className="h-3.5 w-3.5" /> Produtos</div>
                            <span className="text-[11px] opacity-45">{itemCount} un.</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(d.order.items || []).map((i, index) => (
                              <span key={`${i.name}-${index}`} className="rounded-lg border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: theme.card_border_color, color: theme.title_color }}>
                                {i.qty}x {i.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: `${theme.button_color}35`, background: `${theme.button_color}09` }}>
                          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] opacity-50">Pagamento do cliente</div>
                          <div className="space-y-1.5 text-xs">
                            {paymentParts.map((part, index) => (
                              <div key={`${part.method}-${index}`} className="flex items-center justify-between gap-3">
                                <span className="opacity-70">{paymentMethodLabel(part.method)}</span>
                                <strong style={{ color: theme.title_color }}>{brl(part.amount)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>

                        {(d.notes || d.order.notes) && (
                          <div className="mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "#f59e0b33", background: "#f59e0b0d", color: "#fcd34d" }}>
                            <strong>Observação:</strong> {d.notes || d.order.notes}
                          </div>
                        )}
                      </div>

                      <div className="border-t p-3 sm:p-4" style={{ borderColor: theme.card_border_color, background: `${theme.background_color}42` }}>
                        <div className="grid grid-cols-3 gap-2">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition hover:-translate-y-0.5"
                            style={{ borderColor: theme.card_border_color, color: theme.title_color }}
                          >
                            <Navigation className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Rota</span><span className="sm:hidden">Mapa</span>
                          </a>
                          <a
                            href={`https://wa.me/${String(d.order.phone || "").replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition hover:-translate-y-0.5"
                            style={{ borderColor: theme.card_border_color, color: theme.title_color }}
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                          <a
                            href={`tel:${d.order.phone}`}
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition hover:-translate-y-0.5"
                            style={{ borderColor: theme.card_border_color, color: theme.title_color }}
                          >
                            <Phone className="h-3.5 w-3.5" /> Ligar
                          </a>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {awaitingDecision && (
                            <>
                              <Button disabled={busy} variant="destructive" onClick={() => action(d, "reject")} className="h-11 rounded-xl font-bold">
                                <XCircle className="mr-1.5 h-4 w-4" /> Recusar
                              </Button>
                              <Button disabled={busy} onClick={() => action(d, "accept")} className="h-11 rounded-xl font-bold" style={{ background: theme.button_color, color: theme.button_text_color }}>
                                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Bike className="mr-1.5 h-4 w-4" />} Aceitar
                              </Button>
                            </>
                          )}

                          {d.accepted_at && ["aguardando_motoboy", "preparando"].includes(d.status) && (
                            <Button disabled={busy} onClick={() => action(d, "start")} className="col-span-2 h-11 rounded-xl font-bold" style={{ background: theme.button_color, color: theme.button_text_color }}>
                              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Bike className="mr-1.5 h-4 w-4" />} Iniciar entrega <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          )}

                          {["saiu_para_entrega", "chegando", "nao_entregue"].includes(d.status) && (
                            <Button disabled={busy} onClick={() => action(d, "deliver")} className="h-11 rounded-xl font-bold" style={{ background: theme.button_color, color: theme.button_text_color }}>
                              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Entregue
                            </Button>
                          )}

                          {["saiu_para_entrega", "chegando"].includes(d.status) && (
                            <Button disabled={busy} variant="destructive" onClick={() => action(d, "fail")} className="h-11 rounded-xl font-bold">
                              <AlertTriangle className="mr-1.5 h-4 w-4" /> Não entregue
                            </Button>
                          )}

                          {d.status === "nao_entregue" && (
                            <Button disabled={busy} onClick={() => action(d, "return")} className="h-11 rounded-xl font-bold">
                              <Undo2 className="mr-1.5 h-4 w-4" /> Retornando
                            </Button>
                          )}

                          {d.status === "retornando" && (
                            <Button disabled={busy} variant="outline" onClick={() => action(d, "returned")} className="h-11 rounded-xl font-bold" style={{ borderColor: theme.card_border_color, color: theme.title_color }}>
                              <Package className="mr-1.5 h-4 w-4" /> Devolvido à loja
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="mx-auto mt-5 flex max-w-[1440px] items-center justify-center gap-2 px-4 text-center text-[10px] uppercase tracking-[0.12em] opacity-35">
        <UserRound className="h-3 w-3" /> {theme.footer_text}
      </footer>
    </div>
  );
}
