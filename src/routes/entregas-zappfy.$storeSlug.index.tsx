import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bike,
  CalendarDays,
  CheckCircle2,
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
  Store,
  Undo2,
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
  header_color: "#0f172a",
  header_text_color: "#ffffff",
  background_color: "#0b1220",
  card_color: "#0f172a",
  card_border_color: "#1e293b",
  card_shadow_color: "#000000",
  card_radius: 16,
  text_color: "#e5e7eb",
  title_color: "#ffffff",
  button_color: "#10b981",
  button_text_color: "#ffffff",
  icon_color: "#10b981",
  footer_text: "Powered by Zappfy",
  brand_name: "Entregas Zappfy",
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
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isMapPendingDelivery(value: string | null | undefined) {
  return !["entregue", "devolvido", "cancelado"].includes(normalizeDeliveryStatus(value));
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
        navigate({
          to: "/entregas-zappfy/$storeSlug/login",
          params: { storeSlug },
          replace: true,
        });
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
        navigate({
          to: "/entregas-zappfy/$storeSlug/login",
          params: { storeSlug },
          replace: true,
        });
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
      current
        ? { ...current, is_online: nextOnline, online_updated_at: new Date().toISOString() }
        : current,
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
        {
          event: "*",
          schema: "public",
          table: "delivery_tracking",
          filter: `store_id=eq.${me.store_id}`,
        },
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
      reason =
        prompt(
          "Motivo: cliente ausente, recusou, endereço não encontrado, não respondeu, pagamento ou outro",
        )?.trim() || null;
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
    navigate({
      to: "/entregas-zappfy/$storeSlug/login",
      params: { storeSlug },
      replace: true,
    });
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

  const cardStyle: React.CSSProperties = {
    background: theme.card_color,
    border: `1px solid ${theme.card_border_color}`,
    boxShadow: `0 10px 26px -12px ${theme.card_shadow_color}88`,
    borderRadius: theme.card_radius,
    color: theme.text_color,
  };

  if (loading || !me) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: theme.background_color, color: theme.text_color }}
      >
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const todayKey = brazilDateKey();
  const mapCount = available.filter((d) => isMapPendingDelivery(d.status)).length;
  const summary = [
    [
      "Para entregar",
      available.filter(
        (d) =>
          ["aguardando_motoboy", "preparando"].includes(d.status) &&
          (!d.scheduled_for || d.scheduled_for <= todayKey),
      ).length,
    ],
    [
      "Agendadas",
      available.filter(
        (d) =>
          ["aguardando_motoboy", "preparando"].includes(d.status) &&
          Boolean(d.scheduled_for && d.scheduled_for > todayKey),
      ).length,
    ],
    [
      "Em rota",
      available.filter((d) => ["saiu_para_entrega", "chegando"].includes(d.status)).length,
    ],
    ["Entregues", available.filter((d) => d.status === "entregue").length],
    ["Não entregues", available.filter((d) => d.status === "nao_entregue").length],
    [
      "Produtos em posse",
      available
        .filter((d) => isMapPendingDelivery(d.status))
        .reduce((n, d) => n + (d.order.items || []).reduce((s, i) => s + Number(i.qty), 0), 0),
    ],
  ] as const;

  return (
    <div
      className="min-h-screen pb-16"
      style={{ background: theme.background_color, color: theme.text_color }}
    >
      <header
        className="entregas-mobile-header w-full px-5 py-5 flex items-center gap-3"
        style={{ background: theme.header_color, color: theme.header_text_color }}
      >
        {theme.logo_url ? (
          <img
            src={theme.logo_url}
            alt={theme.brand_name}
            style={{ height: theme.logo_size, width: "auto" }}
            className="object-contain"
          />
        ) : (
          <div
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{ background: theme.button_color, color: theme.button_text_color }}
          >
            <Bike className="h-5 w-5" />
          </div>
        )}

        <div className="leading-tight min-w-0">
          <div className="text-lg font-extrabold truncate">{theme.brand_name}</div>
          <div className="text-xs opacity-80 truncate">Olá, {me.name}</div>
        </div>

        <button
          onClick={loadDeliveries}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border"
          style={{ borderColor: `${theme.header_text_color}33`, color: theme.header_text_color }}
          aria-label="Atualizar"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border"
          style={{ borderColor: `${theme.header_text_color}33`, color: theme.header_text_color }}
          aria-label="Sair"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-5 space-y-5">
        <section className="flex items-center gap-2 text-sm">
          <Store className="h-4 w-4" style={{ color: theme.icon_color }} />
          <span className="opacity-70">Loja:</span>
          <strong style={{ color: theme.title_color }}>{me.store_name}</strong>
        </section>

        <section className="flex items-center justify-between gap-3 p-3" style={cardStyle}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
              style={{
                background: me.is_online
                  ? `${theme.button_color}22`
                  : `${theme.card_border_color}66`,
                color: me.is_online ? theme.button_color : theme.text_color,
              }}
            >
              <Power className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs opacity-65">Seu status de trabalho</div>
              <div
                className="font-semibold"
                style={{ color: me.is_online ? theme.button_color : theme.title_color }}
              >
                {me.is_online ? "Ativo agora" : "Offline"}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant={me.is_online ? "outline" : "default"}
            disabled={statusBusy}
            onClick={toggleOnlineStatus}
            style={
              me.is_online
                ? { borderColor: `${theme.button_color}88`, color: theme.button_color }
                : { background: theme.button_color, color: theme.button_text_color }
            }
          >
            {statusBusy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Power className="mr-1 h-4 w-4" />
            )}
            {me.is_online ? "Ficar offline" : "Ficar ativo"}
          </Button>
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {summary.map(([label, value]) => (
            <div key={label} className="p-3 text-center" style={cardStyle}>
              <div className="text-xl font-bold" style={{ color: theme.title_color }}>
                {value}
              </div>
              <div className="text-xs opacity-70">{label}</div>
            </div>
          ))}
        </section>

        <section className="space-y-2 p-3" style={cardStyle}>
          <Button
            type="button"
            className="h-12 w-full text-sm font-semibold"
            disabled={mapCount === 0}
            onClick={printMyDeliveryLabels}
            style={{ background: theme.button_color, color: theme.button_text_color }}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir etiquetas 10x15 ({mapCount})
          </Button>
          <div className="text-center text-[11px] opacity-65">
            Gera todas as etiquetas dos pedidos pendentes em um único documento, 1 etiqueta por página.
          </div>
        </section>

        <section
          className="grid grid-cols-2 gap-2 rounded-xl border p-1"
          style={{ borderColor: theme.card_border_color, background: theme.card_color }}
        >
          <button
            type="button"
            onClick={() => setActiveView("deliveries")}
            className="flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition"
            style={
              activeView === "deliveries"
                ? { background: theme.button_color, color: theme.button_text_color }
                : { color: theme.text_color }
            }
          >
            <ListChecks className="h-4 w-4" />
            Pedidos ({available.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveView("map")}
            className="flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition"
            style={
              activeView === "map"
                ? { background: theme.button_color, color: theme.button_text_color }
                : { color: theme.text_color }
            }
          >
            <MapPinned className="h-4 w-4" />
            Mapa / Rotas ({mapCount})
          </button>
        </section>

        {activeView === "map" ? (
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
              radius: theme.card_radius,
            }}
          />
        ) : (
          <section>
            <h2 className="text-sm font-semibold mb-2 opacity-80">
              Minhas entregas{" "}
              {available.length > 0 && <span className="opacity-60">({available.length})</span>}
            </h2>

            {available.length === 0 ? (
              <div className="p-6 text-center" style={cardStyle}>
                <Package
                  className="h-8 w-8 mx-auto mb-2 opacity-50"
                  style={{ color: theme.icon_color }}
                />
                <div className="text-sm font-medium" style={{ color: theme.title_color }}>
                  Nenhuma entrega atribuída
                </div>
                <div className="text-xs opacity-70 mt-1">
                  Quando a loja atribuir um pedido a você, ele aparecerá automaticamente.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {available.map((d) => {
                  const addr = [d.order.address, d.order.district, d.order.city]
                    .filter(Boolean)
                    .join(", ");
                  const busy = busyTrackingCode === d.tracking_code;
                  const paymentParts = normalizePaymentBreakdown(d.order);
                  const isScheduledForFuture = Boolean(
                    d.scheduled_for && d.scheduled_for > todayKey,
                  );
                  const awaitingDecision =
                    !d.accepted_at && ["aguardando_motoboy", "preparando"].includes(d.status);

                  return (
                    <div key={d.tracking_code} className="p-4 space-y-3" style={cardStyle}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs opacity-70">
                            Pedido #{orderShortNumber(d.order.id)}
                          </div>
                          <div className="font-semibold" style={{ color: theme.title_color }}>
                            {d.order.customer}
                          </div>
                        </div>
                        <div className="text-[11px] opacity-70 text-right">
                          {formatRelative(d.created_at)}
                        </div>
                      </div>

                      {d.scheduled_for && (
                        <div
                          className="rounded-lg border px-3 py-2 text-xs"
                          style={{
                            borderColor: isScheduledForFuture
                              ? `${theme.button_color}88`
                              : theme.card_border_color,
                            background: isScheduledForFuture
                              ? `${theme.button_color}14`
                              : `${theme.card_border_color}22`,
                          }}
                        >
                          <div
                            className="flex items-center gap-2 font-semibold"
                            style={{
                              color: isScheduledForFuture ? theme.button_color : theme.title_color,
                            }}
                          >
                            <CalendarDays className="h-4 w-4" />
                            {isScheduledForFuture
                              ? `Agendada para ${formatCentralScheduledDate(d.scheduled_for)}`
                              : "Entrega programada para hoje"}
                          </div>
                          {isScheduledForFuture && (
                            <div className="mt-1 opacity-70">
                              Data planejada. Você pode aceitar agora e adiantar a entrega, se
                              quiser.
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-start gap-2 text-sm">
                        <MapPin
                          className="h-4 w-4 mt-0.5 shrink-0"
                          style={{ color: theme.icon_color }}
                        />
                        <div className="flex-1">{addr || "Endereço não informado"}</div>
                      </div>

                      {d.order.phone && (
                        <div className="flex items-center gap-2 text-xs opacity-80">
                          <Phone className="h-3.5 w-3.5" style={{ color: theme.icon_color }} />
                          {d.order.phone}
                        </div>
                      )}

                      {d.notes && (
                        <div
                          className="text-xs italic opacity-80 pt-1 border-t"
                          style={{ borderColor: theme.card_border_color }}
                        >
                          Obs: {d.notes}
                        </div>
                      )}

                      <div
                        className="rounded-lg p-2 text-xs"
                        style={{ background: `${theme.button_color}18` }}
                      >
                        {(d.order.items || []).map((i) => `${i.qty}x ${i.name}`).join(" · ")}
                        <div className="mt-1 font-semibold">
                          {(d.order.items || []).reduce((n, i) => n + Number(i.qty), 0)} produtos ·
                          R$ {Number(d.order.total).toFixed(2)}
                        </div>
                      </div>

                      <div
                        className="rounded-lg border p-3 text-xs space-y-1.5"
                        style={{
                          borderColor: `${theme.button_color}55`,
                          background: `${theme.button_color}10`,
                        }}
                      >
                        <div className="font-semibold" style={{ color: theme.title_color }}>
                          Pagamento do cliente
                        </div>
                        {paymentParts.map((part, index) => (
                          <div
                            key={`${part.method}-${index}`}
                            className="flex items-center justify-between gap-3"
                          >
                            <span>{paymentMethodLabel(part.method)}</span>
                            <strong style={{ color: theme.title_color }}>{brl(part.amount)}</strong>
                          </div>
                        ))}
                        <div
                          className="flex items-center justify-between gap-3 border-t pt-1.5 font-semibold"
                          style={{ borderColor: theme.card_border_color }}
                        >
                          <span>Total do pedido</span>
                          <span>{brl(d.order.total)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center justify-center rounded-md border text-sm"
                        >
                          <Navigation className="mr-1 h-4 w-4" />
                          Abrir rota
                        </a>

                        <a
                          href={`https://wa.me/${String(d.order.phone || "").replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center justify-center rounded-md border text-sm"
                        >
                          <MessageCircle className="mr-1 h-4 w-4" />
                          WhatsApp
                        </a>

                        <a
                          href={`tel:${d.order.phone}`}
                          className={`inline-flex h-11 items-center justify-center rounded-md border text-sm ${
                            awaitingDecision ? "col-span-2" : ""
                          }`}
                        >
                          <Phone className="mr-1 h-4 w-4" />
                          Ligar
                        </a>

                        {awaitingDecision && (
                          <>
                            <Button
                              disabled={busy}
                              variant="destructive"
                              onClick={() => action(d, "reject")}
                              className="h-11"
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Recusar
                            </Button>
                            <Button
                              disabled={busy}
                              onClick={() => action(d, "accept")}
                              className="h-11"
                              style={{
                                background: theme.button_color,
                                color: theme.button_text_color,
                              }}
                            >
                              <Bike className="mr-1 h-4 w-4" />
                              Aceitar
                            </Button>
                          </>
                        )}

                        {d.accepted_at &&
                          ["aguardando_motoboy", "preparando"].includes(d.status) && (
                            <Button disabled={busy} onClick={() => action(d, "start")}>
                              <Bike className="mr-1 h-4 w-4" />
                              Iniciar entrega
                            </Button>
                          )}

                        {["saiu_para_entrega", "chegando", "nao_entregue"].includes(d.status) && (
                          <Button
                            disabled={busy}
                            onClick={() => action(d, "deliver")}
                            style={{
                              background: theme.button_color,
                              color: theme.button_text_color,
                            }}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Entregue
                          </Button>
                        )}

                        {["saiu_para_entrega", "chegando"].includes(d.status) && (
                          <Button
                            disabled={busy}
                            variant="destructive"
                            onClick={() => action(d, "fail")}
                          >
                            <AlertTriangle className="mr-1 h-4 w-4" />
                            Não entregue
                          </Button>
                        )}

                        {d.status === "nao_entregue" && (
                          <Button disabled={busy} onClick={() => action(d, "return")}>
                            <Undo2 className="mr-1 h-4 w-4" />
                            Retornando
                          </Button>
                        )}

                        {d.status === "retornando" && (
                          <Button
                            disabled={busy}
                            variant="outline"
                            onClick={() => action(d, "returned")}
                          >
                            <Package className="mr-1 h-4 w-4" />
                            Devolvido à loja
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="text-center text-[11px] opacity-50 mt-10">{theme.footer_text}</footer>
    </div>
  );
}
