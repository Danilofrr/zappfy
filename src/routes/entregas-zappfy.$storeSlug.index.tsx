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
  Moon,
  Navigation,
  Package,
  Phone,
  Power,
  Printer,
  RefreshCw,
  Route as RouteIcon,
  Store,
  Sun,
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

type ColorMode = "light" | "dark";

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
  completed_at: string | null;
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
    items: { name: string; qty: number; price?: number; shipping?: number | string | null }[];
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
  motoboy_fee?: number;
};

type CourierInventoryItem = {
  id: string;
  product_id: string;
  product_name: string;
  variant_label: string;
  quantity: number;
  notes?: string | null;
  unit_price?: number;
  image_url?: string | null;
  updated_at?: string | null;
};

type CourierInventoryProduct = {
  id: string;
  name: string;
  category?: string;
  price?: number;
  stock?: number;
  image_url?: string | null;
};

type CourierInventorySnapshot = {
  items?: CourierInventoryItem[];
  products?: CourierInventoryProduct[];
  total_quantity?: number;
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

function deliveryFeeFromOrder(order: Delivery["order"]) {
  const itemFees = (order.items || [])
    .map((item) => Number(item.shipping ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  // O checkout pode repetir o mesmo frete em mais de um item do pedido.
  // A taxa é uma por pedido, então usamos o maior valor em vez de somar os itens.
  if (itemFees.length) return Math.max(...itemFees);

  const notes = String(order.notes || "");
  const match = notes.match(/Entrega(?:\s*\([^)]+\))?\s*:?\s*R?\$?\s*([\d.,]+)/i);
  if (!match) return 0;

  const raw = match[1];
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeBrazilWhatsAppPhone(value: string | null | undefined) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  // Remove prefixo internacional 00, quando existir.
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Já está no formato brasileiro internacional: 55 + DDD + telefone.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Alguns cadastros podem vir com um zero nacional antes do DDD.
  if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }

  // Telefone brasileiro salvo somente como DDD + número.
  // Ex.: 81 98641-3993 -> 5581986413993.
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Mantém números internacionais já completos que não sejam brasileiros.
  return digits;
}

function isMapPendingDelivery(value: string | null | undefined) {
  return !["entregue", "devolvido", "cancelado"].includes(normalizeDeliveryStatus(value));
}

function statusMeta(status: string) {
  const normalized = normalizeDeliveryStatus(status);
  if (normalized === "entregue") return { label: "Entregue", fg: "#22c55e", bg: "#22c55e18" };
  if (["saiu_para_entrega", "chegando"].includes(normalized))
    return { label: normalized === "chegando" ? "Chegando" : "Em rota", fg: "#3b82f6", bg: "#3b82f618" };
  if (normalized === "nao_entregue") return { label: "Não entregue", fg: "#ea580c", bg: "#f9731618" };
  if (normalized === "retornando") return { label: "Retornando", fg: "#a855f7", bg: "#a855f718" };
  if (normalized === "devolvido") return { label: "Devolvido", fg: "#64748b", bg: "#64748b18" };
  if (normalized === "cancelado") return { label: "Cancelado", fg: "#dc2626", bg: "#ef444418" };
  if (normalized === "preparando") return { label: "Preparando", fg: "#d97706", bg: "#f59e0b18" };
  return { label: "Aguardando", fg: "#ca8a04", bg: "#eab30818" };
}

function CentralBrand({ color, accent, surface }: { color: string; accent: string; surface: string }) {
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
        <span
          className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 bg-white text-[#07120d]"
          style={{ borderColor: surface }}
        >
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
  const [configuredTheme, setConfiguredTheme] = useState<CentralTheme>(DEFAULT_THEME);
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("zappfy-entregas-color-mode");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const [me, setMe] = useState<Me | null>(null);
  const [available, setAvailable] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTrackingCode, setBusyTrackingCode] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [activeView, setActiveView] = useState<"deliveries" | "map">("deliveries");
  const [extraLoadOpen, setExtraLoadOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<CourierInventoryItem[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<CourierInventoryProduct[]>([]);
  const [inventoryProductId, setInventoryProductId] = useState("");
  const [inventoryVariant, setInventoryVariant] = useState("");
  const [inventoryQuantity, setInventoryQuantity] = useState("1");
  const [inventoryNotes, setInventoryNotes] = useState("");
  const [inventoryBusy, setInventoryBusy] = useState(false);

  const theme = useMemo<CentralTheme>(() => {
    const accent = configuredTheme.button_color || DEFAULT_THEME.button_color;
    const radius = configuredTheme.card_radius || DEFAULT_THEME.card_radius;

    if (colorMode === "light") {
      return {
        ...configuredTheme,
        header_color: "#ffffff",
        header_text_color: "#14251b",
        background_color: "#f3f7f4",
        card_color: "#ffffff",
        card_border_color: "#dce7df",
        card_shadow_color: "#8ba697",
        card_radius: radius,
        text_color: "#41544a",
        title_color: "#13241b",
        button_color: accent,
        button_text_color: "#052013",
        icon_color: accent,
      };
    }

    return {
      ...configuredTheme,
      header_color: "#0a120e",
      header_text_color: "#f8faf9",
      background_color: "#08110d",
      card_color: "#0f1913",
      card_border_color: "#243229",
      card_shadow_color: "#000000",
      card_radius: radius,
      text_color: "#d5e2da",
      title_color: "#ffffff",
      button_color: accent,
      button_text_color: "#04140b",
      icon_color: configuredTheme.icon_color || accent,
    };
  }, [configuredTheme, colorMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem("zappfy-entregas-color-mode", colorMode);
    } catch {
      // LocalStorage pode estar indisponível em modo privado/restrito.
    }
  }, [colorMode]);

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

      // Abertura rápida: primeiro valida apenas a sessão e os dados mínimos do motoboy.
      // Pedidos, carga extra e tema são carregados logo depois sem bloquear a interface.
      const { data: meRes, error: meErr } = await (supabase as any).rpc("courier_me", {
        _session: session,
      });

      if (!alive) return;

      if (meErr || !meRes) {
        clearCourierSession(storeSlug);
        navigate({ to: "/entregas-zappfy/$storeSlug/login", params: { storeSlug }, replace: true });
        return;
      }

      setMe(meRes as Me);
      setLoading(false);

      void Promise.allSettled([
        (supabase as any).rpc("get_zappfy_central_theme_light").then(({ data: themeRes }: any) => {
          if (alive && themeRes) setConfiguredTheme({ ...DEFAULT_THEME, ...(themeRes as CentralTheme) });
        }),
        loadDeliveries(),
        loadInventory(),
      ]);
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

  async function loadInventory() {
    const session = getCourierSession(storeSlug);
    if (!session) return;
    const { data, error } = await (supabase as any).rpc("courier_inventory_snapshot", {
      _session: session,
    });
    if (error) {
      console.error(error);
      return;
    }
    const snapshot = (data ?? {}) as CourierInventorySnapshot;
    setInventoryItems(Array.isArray(snapshot.items) ? snapshot.items : []);
    setInventoryProducts(Array.isArray(snapshot.products) ? snapshot.products : []);
  }

  async function adjustOwnInventory(
    productId: string,
    variantLabel: string,
    delta: number,
    notes?: string,
  ) {
    const session = getCourierSession(storeSlug);
    if (!session || !productId || !Number.isFinite(delta) || delta === 0) return;
    setInventoryBusy(true);
    try {
      const { error } = await (supabase as any).rpc("courier_adjust_own_inventory", {
        _session: session,
        _product_id: productId,
        _variant_label: variantLabel || "",
        _delta: Math.trunc(delta),
        _notes: notes?.trim() || null,
      });
      if (error) throw error;
      await loadInventory();
      toast.success(delta > 0 ? "Mercadoria adicionada à sua carga" : "Carga extra atualizada");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível atualizar sua carga extra");
    } finally {
      setInventoryBusy(false);
    }
  }

  async function addExtraInventory() {
    const qty = Math.max(1, Math.trunc(Number(inventoryQuantity) || 1));
    if (!inventoryProductId) {
      toast.error("Selecione o produto que está levando");
      return;
    }
    await adjustOwnInventory(inventoryProductId, inventoryVariant, qty, inventoryNotes);
    setInventoryQuantity("1");
    setInventoryVariant("");
    setInventoryNotes("");
  }

  useEffect(() => {
    if (!me) return;

    let deliveryTimer: ReturnType<typeof setTimeout> | null = null;
    let inventoryTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleDeliveryRefresh = () => {
      if (deliveryTimer) clearTimeout(deliveryTimer);
      deliveryTimer = setTimeout(() => void loadDeliveries(), 250);
    };
    const scheduleInventoryRefresh = () => {
      if (inventoryTimer) clearTimeout(inventoryTimer);
      inventoryTimer = setTimeout(() => void loadInventory(), 250);
    };

    // Realtime é a fonte principal. O intervalo é apenas fallback para redes móveis
    // que suspendem o websocket em segundo plano.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void loadDeliveries();
    }, 60000);

    const channel = supabase
      .channel(`central_${me.store_id}_${me.courier_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_tracking", filter: `store_id=eq.${me.store_id}` },
        scheduleDeliveryRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "courier_inventory", filter: `courier_id=eq.${me.courier_id}` },
        scheduleInventoryRefresh,
      )
      .subscribe();

    return () => {
      if (deliveryTimer) clearTimeout(deliveryTimer);
      if (inventoryTimer) clearTimeout(inventoryTimer);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.store_id, me?.courier_id]);

  useEffect(() => {
    if (!me) return;
    const refreshVisibleCentral = () => {
      void loadDeliveries();
      void loadInventory();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshVisibleCentral();
    };
    window.addEventListener("focus", refreshVisibleCentral);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshVisibleCentral);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.store_id]);

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
  const extraLoadQuantity = useMemo(
    () => inventoryItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [inventoryItems],
  );

  const metrics = useMemo(() => {
    const ready = available.filter(
      (d) => ["aguardando_motoboy", "preparando"].includes(d.status) && (!d.scheduled_for || d.scheduled_for <= todayKey),
    ).length;
    const scheduled = available.filter(
      (d) => ["aguardando_motoboy", "preparando"].includes(d.status) && Boolean(d.scheduled_for && d.scheduled_for > todayKey),
    ).length;
    const onRoute = available.filter((d) => ["saiu_para_entrega", "chegando"].includes(d.status)).length;
    const delivered = available.filter((d) => d.status === "entregue").length;
    const orderItemsInPossession = available
      .filter((d) => isMapPendingDelivery(d.status))
      .reduce((n, d) => n + (d.order.items || []).reduce((s, i) => s + Number(i.qty), 0), 0);
    const possession = orderItemsInPossession + extraLoadQuantity;
    return { ready, scheduled, onRoute, delivered, possession, orderItemsInPossession };
  }, [available, extraLoadQuantity, todayKey]);

  const todayPerformance = useMemo(() => {
    const completedToday = available.filter((delivery) => {
      if (normalizeDeliveryStatus(delivery.status) !== "entregue" || !delivery.completed_at) return false;
      return brazilDateKey(new Date(delivery.completed_at)) === todayKey;
    });

    const customerShippingTotal = completedToday.reduce(
      (sum, delivery) => sum + deliveryFeeFromOrder(delivery.order),
      0,
    );

    const configuredMotoboyFee = Math.max(0, Number(me?.motoboy_fee || 0));
    const deliveryRevenue = completedToday.reduce((sum, delivery) => {
      // Se a loja configurou uma taxa do motoboy, esse é o valor total devido
      // por entrega (cliente + complemento da loja). Sem configuração, mantém
      // compatibilidade usando o frete cobrado do cliente.
      return sum + (configuredMotoboyFee > 0 ? configuredMotoboyFee : deliveryFeeFromOrder(delivery.order));
    }, 0);

    const storeComplement = Math.max(0, deliveryRevenue - customerShippingTotal);
    const average = completedToday.length > 0 ? deliveryRevenue / completedToday.length : 0;

    return {
      deliveries: completedToday.length,
      deliveryRevenue,
      customerShippingTotal,
      storeComplement,
      average,
      configuredMotoboyFee,
    };
  }, [available, me?.motoboy_fee, todayKey]);

  const cardStyle: React.CSSProperties = {
    background: `linear-gradient(145deg, color-mix(in oklab, ${theme.card_color} 97%, white), ${theme.card_color})`,
    border: `1px solid ${theme.card_border_color}`,
    boxShadow: `0 18px 45px -28px ${theme.card_shadow_color}cc`,
    borderRadius: Math.max(theme.card_radius, 18),
    color: theme.text_color,
  };

  if (loading || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center transition-colors duration-300" style={{ background: theme.background_color, color: theme.text_color, colorScheme: colorMode }}>
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
    { label: "Para entregar", value: metrics.ready, icon: Package, tone: "#d99b00" },
    { label: "Agendadas", value: metrics.scheduled, icon: CalendarDays, tone: "#8b5cf6" },
    { label: "Em rota", value: metrics.onRoute, icon: RouteIcon, tone: "#3b82f6" },
    { label: "Entregues", value: metrics.delivered, icon: CheckCircle2, tone: "#16a34a" },
    { label: "Produtos em posse", value: metrics.possession, icon: Boxes, tone: theme.button_color },
  ];

  const headerButtonStyle: React.CSSProperties = {
    borderColor: theme.card_border_color,
    background: colorMode === "light" ? "#f5f8f6" : "#142019",
    color: theme.header_text_color,
    boxShadow: colorMode === "light" ? "0 4px 14px -10px #1b4332" : "0 8px 24px -18px #000000",
  };

  return (
    <div
      className="min-h-screen pb-8 transition-colors duration-300"
      style={{
        background: `radial-gradient(900px 420px at 15% -80px, ${theme.button_color}${colorMode === "light" ? "12" : "18"}, transparent 68%), ${theme.background_color}`,
        color: theme.text_color,
        colorScheme: colorMode,
      }}
    >
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-xl transition-colors duration-300"
        style={{
          background: `color-mix(in oklab, ${theme.header_color} 94%, transparent)`,
          color: theme.header_text_color,
          borderColor: theme.card_border_color,
          boxShadow: colorMode === "light" ? "0 6px 30px -24px #315b45" : "0 8px 34px -26px #000000",
        }}
      >
        <div className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <CentralBrand color={theme.header_text_color} accent={theme.button_color} surface={theme.header_color} />

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <div
              className="mr-1 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"
              style={{ borderColor: theme.card_border_color, background: colorMode === "light" ? "#f7faf8" : "#121d16", color: theme.text_color }}
            >
              <Store className="h-3.5 w-3.5" style={{ color: theme.icon_color }} />
              <span className="opacity-65">Loja</span>
              <strong className="max-w-44 truncate" style={{ color: theme.title_color }}>{me.store_name}</strong>
            </div>

            <div
              className="flex items-center gap-1 rounded-xl border p-1"
              style={{ borderColor: theme.card_border_color, background: colorMode === "light" ? "#f3f7f4" : "#101b14" }}
              aria-label="Escolher aparência"
            >
              <button
                type="button"
                onClick={() => setColorMode("light")}
                aria-pressed={colorMode === "light"}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition"
                style={
                  colorMode === "light"
                    ? { background: "#ffffff", color: "#173622", boxShadow: "0 2px 10px -6px #173622" }
                    : { color: theme.text_color }
                }
              >
                <Sun className="h-3.5 w-3.5" /> Claro
              </button>
              <button
                type="button"
                onClick={() => setColorMode("dark")}
                aria-pressed={colorMode === "dark"}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition"
                style={
                  colorMode === "dark"
                    ? { background: "#223128", color: "#ffffff", boxShadow: "0 2px 10px -6px #000000" }
                    : { color: theme.text_color }
                }
              >
                <Moon className="h-3.5 w-3.5" /> Escuro
              </button>
            </div>

            <button
              onClick={loadDeliveries}
              className="inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition hover:-translate-y-0.5 active:scale-[0.98]"
              style={headerButtonStyle}
              aria-label="Atualizar entregas"
              title="Atualizar entregas"
            >
              <RefreshCw className="h-4 w-4" style={{ color: theme.icon_color }} />
              Atualizar
            </button>
            <button
              onClick={logout}
              className="inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition hover:-translate-y-0.5 active:scale-[0.98]"
              style={{
                borderColor: colorMode === "light" ? "#fecaca" : "#4d2929",
                background: colorMode === "light" ? "#fff7f7" : "#211515",
                color: colorMode === "light" ? "#b42318" : "#fecaca",
              }}
              aria-label="Sair da Central"
              title="Sair da Central"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setColorMode((current) => (current === "dark" ? "light" : "dark"))}
              className="grid h-9 w-9 place-items-center rounded-xl border transition active:scale-95"
              style={headerButtonStyle}
              aria-label={colorMode === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              title={colorMode === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {colorMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={loadDeliveries}
              className="grid h-9 w-9 place-items-center rounded-xl border transition active:scale-95"
              style={headerButtonStyle}
              aria-label="Atualizar"
              title="Atualizar"
            >
              <RefreshCw className="h-4 w-4" style={{ color: theme.icon_color }} />
            </button>
            <button
              onClick={logout}
              className="grid h-9 w-9 place-items-center rounded-xl border transition active:scale-95"
              style={{
                borderColor: colorMode === "light" ? "#fecaca" : "#4d2929",
                background: colorMode === "light" ? "#fff7f7" : "#211515",
                color: colorMode === "light" ? "#b42318" : "#fecaca",
              }}
              aria-label="Sair"
              title="Sair"
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
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ borderColor: `${theme.button_color}44`, background: `${theme.button_color}10`, color: colorMode === "light" ? "#087a3c" : theme.button_color }}>
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

              <div className="flex min-w-[240px] items-center justify-between gap-3 rounded-2xl border p-3" style={{ borderColor: theme.card_border_color, background: colorMode === "light" ? "#f7faf8" : `${theme.background_color}88` }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: me.is_online ? `${theme.button_color}18` : `${theme.card_border_color}77`, color: me.is_online ? (colorMode === "light" ? "#087a3c" : theme.button_color) : theme.text_color }}>
                    {me.is_online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.11em] opacity-50">Status</div>
                    <div className="truncate text-sm font-bold" style={{ color: me.is_online ? (colorMode === "light" ? "#087a3c" : theme.button_color) : theme.title_color }}>
                      {me.is_online ? "Ativo para entregas" : "Offline"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={toggleOnlineStatus}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition active:scale-95"
                  style={{
                    borderColor: me.is_online ? `${theme.button_color}55` : theme.card_border_color,
                    background: colorMode === "light" ? "#ffffff" : "#121d16",
                    color: me.is_online ? (colorMode === "light" ? "#087a3c" : theme.button_color) : theme.title_color,
                  }}
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

        <section className="mb-5 overflow-hidden rounded-2xl border" style={{ borderColor: theme.card_border_color, background: theme.card_color }}>
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
            <div className="min-w-0 lg:w-[260px]">
              <div className="flex items-center gap-2">
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: `${theme.button_color}16`, color: theme.button_color }}
                >
                  <WalletCards className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-black" style={{ color: theme.title_color }}>Meu resultado de hoje</div>
                  <div className="mt-0.5 text-[11px] opacity-55">Atualiza conforme você conclui as entregas</div>
                </div>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
              <div
                className="rounded-xl border p-3 sm:p-4"
                style={{ borderColor: theme.card_border_color, background: colorMode === "light" ? "#f8fbf9" : theme.background_color }}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-50">Entregas concluídas</div>
                <div className="mt-1 text-2xl font-black tracking-[-0.04em]" style={{ color: theme.title_color }}>
                  {todayPerformance.deliveries}
                </div>
                <div className="mt-0.5 text-[10px] opacity-55">feitas hoje</div>
              </div>

              <div
                className="rounded-xl border p-3 sm:p-4"
                style={{ borderColor: `${theme.button_color}45`, background: `${theme.button_color}${colorMode === "light" ? "0c" : "12"}` }}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-60">Valor apurado</div>
                <div className="mt-1 text-xl font-black tracking-[-0.04em] sm:text-2xl" style={{ color: colorMode === "light" ? "#087a3c" : theme.button_color }}>
                  {brl(todayPerformance.deliveryRevenue)}
                </div>
                <div className="mt-0.5 text-[10px] opacity-55">total apurado hoje</div>
              </div>

              <div
                className="col-span-2 rounded-xl border p-3 sm:col-span-1 sm:p-4"
                style={{ borderColor: theme.card_border_color, background: colorMode === "light" ? "#f8fbf9" : theme.background_color }}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-50">Média por entrega</div>
                <div className="mt-1 text-xl font-black tracking-[-0.04em] sm:text-2xl" style={{ color: theme.title_color }}>
                  {brl(todayPerformance.average)}
                </div>
                <div className="mt-0.5 text-[10px] opacity-55">média das concluídas</div>
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

        <section className="mb-5 overflow-hidden rounded-2xl border" style={{ borderColor: theme.card_border_color, background: theme.card_color }}>
          <button
            type="button"
            onClick={() => setExtraLoadOpen((open) => !open)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${theme.button_color}16`, color: theme.button_color }}>
              <Boxes className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black" style={{ color: theme.title_color }}>Minha carga extra</span>
              <span className="mt-0.5 block text-[11px] opacity-60">
                Informe as mercadorias que você está levando além dos pedidos já atribuídos.
              </span>
            </span>
            <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ background: `${theme.button_color}14`, color: theme.button_color }}>
              {extraLoadQuantity} un.
            </span>
            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${extraLoadOpen ? "rotate-90" : ""}`} />
          </button>

          {extraLoadOpen && (
            <div className="border-t px-4 py-4 sm:px-5" style={{ borderColor: theme.card_border_color }}>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.12em] opacity-55">Produtos que estou levando</div>
                      <div className="mt-1 text-[11px] opacity-55">
                        Esses itens aparecem automaticamente em Motoboys → Carga e histórico.
                      </div>
                    </div>
                    <span className="text-xs font-bold" style={{ color: theme.button_color }}>{extraLoadQuantity} unidade(s)</span>
                  </div>

                  {inventoryItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed px-4 py-6 text-center text-xs opacity-55" style={{ borderColor: theme.card_border_color }}>
                      Nenhuma mercadoria extra informada.
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {inventoryItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: theme.card_border_color, background: theme.background_color }}>
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: `${theme.button_color}12`, color: theme.button_color }}>
                              <Package className="h-4 w-4" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-bold" style={{ color: theme.title_color }}>{item.product_name}</div>
                            {item.variant_label && <div className="truncate text-[10px] opacity-55">{item.variant_label}</div>}
                            <div className="mt-0.5 text-[10px] opacity-55">{item.quantity} unidade(s) na carga extra</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={inventoryBusy}
                              onClick={() => void adjustOwnInventory(item.product_id, item.variant_label || "", -1)}
                              className="grid h-8 w-8 place-items-center rounded-lg border text-base font-black disabled:opacity-40"
                              style={{ borderColor: theme.card_border_color }}
                              aria-label="Retirar uma unidade"
                            >
                              −
                            </button>
                            <span className="min-w-7 text-center text-sm font-black" style={{ color: theme.title_color }}>{item.quantity}</span>
                            <button
                              type="button"
                              disabled={inventoryBusy}
                              onClick={() => void adjustOwnInventory(item.product_id, item.variant_label || "", 1)}
                              className="grid h-8 w-8 place-items-center rounded-lg border text-base font-black disabled:opacity-40"
                              style={{ borderColor: theme.button_color, color: theme.button_color }}
                              aria-label="Adicionar uma unidade"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: theme.card_border_color, background: theme.background_color }}>
                  <div className="text-xs font-black" style={{ color: theme.title_color }}>Adicionar mercadoria extra</div>
                  <div className="mt-3 space-y-2.5">
                    <select
                      value={inventoryProductId}
                      onChange={(event) => setInventoryProductId(event.target.value)}
                      className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
                      style={{ borderColor: theme.card_border_color, color: theme.title_color, backgroundColor: theme.card_color }}
                    >
                      <option value="">Selecione o produto</option>
                      {inventoryProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}{Number.isFinite(Number(product.stock)) ? ` · estoque loja: ${product.stock}` : ""}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        inputMode="numeric"
                        value={inventoryQuantity}
                        onChange={(event) => setInventoryQuantity(event.target.value)}
                        className="h-11 rounded-xl border bg-transparent px-3 text-sm outline-none"
                        style={{ borderColor: theme.card_border_color, color: theme.title_color }}
                        placeholder="Qtd."
                      />
                      <input
                        value={inventoryVariant}
                        onChange={(event) => setInventoryVariant(event.target.value)}
                        className="h-11 rounded-xl border bg-transparent px-3 text-sm outline-none"
                        style={{ borderColor: theme.card_border_color, color: theme.title_color }}
                        placeholder="Cor/variação (opcional)"
                      />
                    </div>

                    <input
                      value={inventoryNotes}
                      onChange={(event) => setInventoryNotes(event.target.value)}
                      className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
                      style={{ borderColor: theme.card_border_color, color: theme.title_color }}
                      placeholder="Observação (opcional)"
                    />

                    <Button
                      type="button"
                      disabled={inventoryBusy || !inventoryProductId}
                      onClick={() => void addExtraInventory()}
                      className="h-11 w-full rounded-xl font-black"
                      style={{ background: theme.button_color, color: theme.button_text_color }}
                    >
                      {inventoryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Boxes className="mr-2 h-4 w-4" />}
                      Adicionar à minha carga
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
                <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl" style={{ background: `${theme.button_color}12`, color: colorMode === "light" ? "#087a3c" : theme.button_color }}>
                  <Package className="h-7 w-7" />
                </div>
                <div className="text-base font-bold" style={{ color: theme.title_color }}>Nenhuma entrega atribuída</div>
                <div className="mt-1 max-w-sm text-sm opacity-60">Quando a loja atribuir um pedido a você, ele aparecerá aqui automaticamente.</div>
                <Button
                  className="mt-5 rounded-xl"
                  variant="outline"
                  onClick={loadDeliveries}
                  style={{ borderColor: theme.card_border_color, background: theme.card_color, color: theme.title_color }}
                >
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
                          <div className="mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: isScheduledForFuture ? `${theme.button_color}55` : theme.card_border_color, background: isScheduledForFuture ? `${theme.button_color}0f` : (colorMode === "light" ? "#f7faf8" : `${theme.background_color}55`) }}>
                            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" style={{ color: isScheduledForFuture ? (colorMode === "light" ? "#087a3c" : theme.button_color) : theme.icon_color }} />
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
                              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${theme.icon_color}12`, color: colorMode === "light" ? "#087a3c" : theme.icon_color }}><MapPin className="h-3.5 w-3.5" /></div>
                              <div className="min-w-0 leading-snug">
                                <div className="font-semibold" style={{ color: theme.title_color }}>{addr || "Endereço não informado"}</div>
                                <div className="mt-0.5 text-[11px] opacity-45">Destino da entrega</div>
                              </div>
                            </div>

                            {d.order.phone && (
                              <div className="flex items-center gap-2.5 text-sm">
                                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${theme.icon_color}12`, color: colorMode === "light" ? "#087a3c" : theme.icon_color }}><Phone className="h-3.5 w-3.5" /></div>
                                <span className="font-medium opacity-80">{d.order.phone}</span>
                              </div>
                            )}
                          </div>

                          <div className="rounded-2xl border px-3 py-2.5 sm:min-w-[135px]" style={{ borderColor: theme.card_border_color, background: colorMode === "light" ? "#f7faf8" : `${theme.background_color}66` }}>
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] opacity-45"><WalletCards className="h-3.5 w-3.5" /> Total</div>
                            <div className="mt-1 text-lg font-black" style={{ color: theme.title_color }}>{brl(d.order.total)}</div>
                            <div className="text-[11px] opacity-50">{itemCount} {itemCount === 1 ? "produto" : "produtos"}</div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: theme.card_border_color, background: colorMode === "light" ? "#f8faf9" : `${theme.background_color}44` }}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] opacity-45"><Boxes className="h-3.5 w-3.5" /> Produtos</div>
                            <span className="text-[11px] opacity-45">{itemCount} un.</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(d.order.items || []).map((i, index) => (
                              <span key={`${i.name}-${index}`} className="rounded-lg border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: theme.card_border_color, background: theme.card_color, color: theme.title_color }}>
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
                          <div
                            className="mt-3 rounded-xl border px-3 py-2 text-xs"
                            style={{
                              borderColor: colorMode === "light" ? "#f1c36d" : "#f59e0b33",
                              background: colorMode === "light" ? "#fff8e8" : "#f59e0b0d",
                              color: colorMode === "light" ? "#7a4b00" : "#fcd34d",
                            }}
                          >
                            <strong>Observação:</strong> {d.notes || d.order.notes}
                          </div>
                        )}
                      </div>

                      <div className="border-t p-3 sm:p-4" style={{ borderColor: theme.card_border_color, background: colorMode === "light" ? "#f8faf9" : `${theme.background_color}42` }}>
                        <div className="grid grid-cols-3 gap-2">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition hover:-translate-y-0.5"
                            style={{ borderColor: theme.card_border_color, background: theme.card_color, color: theme.title_color }}
                          >
                            <Navigation className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Rota</span><span className="sm:hidden">Mapa</span>
                          </a>
                          <a
                            href={`https://wa.me/${normalizeBrazilWhatsAppPhone(d.order.phone)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition hover:-translate-y-0.5"
                            style={{ borderColor: theme.card_border_color, background: theme.card_color, color: theme.title_color }}
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                          <a
                            href={`tel:+${normalizeBrazilWhatsAppPhone(d.order.phone)}`}
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition hover:-translate-y-0.5"
                            style={{ borderColor: theme.card_border_color, background: theme.card_color, color: theme.title_color }}
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
                            <Button
                              disabled={busy}
                              variant="outline"
                              onClick={() => action(d, "returned")}
                              className="h-11 rounded-xl font-bold"
                              style={{ borderColor: theme.card_border_color, background: theme.card_color, color: theme.title_color }}
                            >
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
