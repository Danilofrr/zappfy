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
import {
  AlertTriangle,
  Banknote,
  Bike,
  Camera,
  CheckCircle2,
  CreditCard,
  FileImage,
  Images,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Power,
  QrCode,
  Save,
  Signature,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import {
  normalizePaymentBreakdown,
  paymentMethodLabel,
  type PaymentBreakdownItem,
} from "@/lib/order-payments";

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
  proof_url?: string | null;
  signature_url?: string | null;
  received_payments?: PaymentBreakdownItem[] | null;
  received_payment_total?: number | null;
  received_payment_updated_at?: string | null;
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
    payment?: string;
    items?: { name: string; qty: number }[];
  };
  store: { name: string; whatsapp: string; logo_url: string | null };
  settings?: CourierTheme;
};

type ReceivedPaymentMethod = "pix" | "dinheiro" | "cartao";
type ReceivedPaymentForm = Record<ReceivedPaymentMethod, string>;

const PAYMENT_OPTIONS: Array<{
  method: ReceivedPaymentMethod;
  label: string;
  icon: typeof QrCode;
}> = [
  { method: "pix", label: "PIX", icon: QrCode },
  { method: "dinheiro", label: "Dinheiro", icon: Banknote },
  { method: "cartao", label: "Cartão", icon: CreditCard },
];

const EMPTY_RECEIVED_PAYMENT: ReceivedPaymentForm = {
  pix: "",
  dinheiro: "",
  cartao: "",
};

const DELIVERY_FAILURE_REASONS = [
  "Cliente não estava no local",
  "Cliente cancelou o pedido",
  "Cliente recusou receber",
  "Endereço não encontrado",
  "Cliente não respondeu",
] as const;

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

const roundMoney = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;

function parseMoneyInput(value: string) {
  let normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/[^0-9.,]/g, "");

  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    const dots = normalized.match(/\./g)?.length || 0;
    if (dots > 1) {
      const lastDot = normalized.lastIndexOf(".");
      normalized = `${normalized.slice(0, lastDot).replace(/\./g, "")}${normalized.slice(lastDot)}`;
    }
  }

  return roundMoney(normalized);
}

function moneyInput(value: number) {
  return value > 0 ? value.toFixed(2).replace(".", ",") : "";
}

function normalizeReceivedParts(parts: PaymentBreakdownItem[] | null | undefined) {
  const totals: Record<ReceivedPaymentMethod, number> = {
    pix: 0,
    dinheiro: 0,
    cartao: 0,
  };

  (parts || []).forEach((part) => {
    const method = part.method === "debito" ? "cartao" : part.method;
    if (method === "pix" || method === "dinheiro" || method === "cartao") {
      totals[method] = roundMoney(totals[method] + Number(part.amount || 0));
    }
  });

  return {
    pix: moneyInput(totals.pix),
    dinheiro: moneyInput(totals.dinheiro),
    cartao: moneyInput(totals.cartao),
  } satisfies ReceivedPaymentForm;
}

async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Envie uma imagem do comprovante.");
  // Fotos atuais de celular facilmente passam de 3 MB. O limite deve ser aplicado
  // depois da compressão, não antes dela.
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("A foto é muito grande. Escolha uma imagem de até 15 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error("Não foi possível abrir esta imagem. Tente outra foto."));
      next.src = objectUrl;
    });

    const render = (maxDimension: number, quality: number) => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível preparar a imagem para envio.");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", quality);
    };

    // Primeiro tenta manter boa nitidez. Se a foto ainda ficar pesada, reduz mais
    // antes de mandar pela rede móvel.
    let compressed = render(1280, 0.74);
    if (compressed.length > 900_000) compressed = render(1080, 0.64);
    if (compressed.length > 1_300_000) compressed = render(900, 0.56);

    if (compressed.length > 2_000_000) {
      throw new Error("Não foi possível reduzir a foto o suficiente. Tente fotografar novamente.");
    }

    return compressed;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function CourierPage() {
  const { courierToken } = Route.useParams();
  const [data, setData] = useState<CourierView | null>(null);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentDirty, setPaymentDirty] = useState(false);
  const [receivedPayment, setReceivedPayment] = useState<ReceivedPaymentForm>(EMPTY_RECEIVED_PAYMENT);

  const watchIdRef = useRef<number | null>(null);
  const latestPosRef = useRef<GeolocationPosition | null>(null);
  const wakeLockRef = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const signatureHasInkRef = useRef(false);

  function hydrateReceivedPayment(view: CourierView) {
    const saved = Array.isArray(view.received_payments) && view.received_payments.length > 0;
    const source = saved ? view.received_payments! : normalizePaymentBreakdown(view.order);
    setReceivedPayment(normalizeReceivedParts(source));
    setPaymentDirty(false);
  }

  async function load() {
    const { data: res, error } = await supabase.rpc("get_courier_view", { _token: courierToken });
    if (!error && res) {
      const view = res as CourierView;
      setData(view);
      setProofUrl(view.proof_url || null);
      setSignatureUrl(view.signature_url || null);
      hydrateReceivedPayment(view);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [courierToken]);

  useEffect(() => () => stopWatch(), []);

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

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        // @ts-ignore
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {}
  }

  function stopWatch() {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {}
    }
    wakeLockRef.current = null;
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
    if (!error) setLastSent(Date.now());
  }

  function startWatch(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) return reject(new Error("Geolocalização indisponível."));
      setPermError(null);
      let done = false;

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          latestPosRef.current = pos;
          sendLocation(pos);
          if (!done) {
            done = true;
            setWatching(true);
            requestWakeLock();
            heartbeatRef.current = setInterval(() => {
              if (latestPosRef.current) sendLocation(latestPosRef.current);
            }, 10000);
            resolve(pos);
          }
        },
        (err) => {
          setPermError(err.code === 1 ? "Permita a localização no navegador para iniciar a entrega." : err.message);
          if (!done) reject(err);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      );
    });
  }

  async function changeStatus(newStatus: "saiu_para_entrega" | "chegando") {
    const { error } = await supabase.rpc("update_courier_status", {
      _token: courierToken,
      _status: newStatus,
    });
    if (error) return toast.error(error.message);
    await load();
    toast.success(
      newStatus === "saiu_para_entrega"
        ? "Entrega iniciada"
        : "Cliente notificado: você está chegando",
    );
  }

  async function handleStart() {
    try {
      if (!watching) await startWatch();
    } catch {
      return;
    }
    if (data?.status === "aguardando_motoboy" || data?.status === "preparando") {
      await changeStatus("saiu_para_entrega");
    }
  }

  async function persistEvidence(options: {
    proofUrl?: string | null;
    signatureUrl?: string | null;
    clearProof?: boolean;
    clearSignature?: boolean;
  }) {
    setEvidenceSaving(true);
    let lastError: any = null;

    try {
      // Em 4G/5G pode acontecer uma queda curta justamente durante o upload.
      // A operação é idempotente, então uma segunda tentativa é segura.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { data: result, error } = await (supabase as any).rpc("save_courier_delivery_evidence", {
          _token: courierToken,
          _proof_url: options.proofUrl ?? null,
          _signature_url: options.signatureUrl ?? null,
          _clear_proof: options.clearProof ?? false,
          _clear_signature: options.clearSignature ?? false,
        });

        if (!error && result?.saved !== false) return true;
        lastError = error || new Error("O servidor não confirmou o salvamento.");
        if (attempt === 0) await wait(700);
      }

      throw lastError;
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar a comprovação da entrega.");
      return false;
    } finally {
      setEvidenceSaving(false);
    }
  }

  async function handleProof(file?: File) {
    if (!file) return;
    try {
      const url = await imageFileToDataUrl(file);
      const saved = await persistEvidence({ proofUrl: url });
      if (!saved) return;

      // Só mostramos sucesso depois de a RPC confirmar o UPDATE no banco.
      setProofUrl(url);
      setData((current) => current ? { ...current, proof_url: url } : current);
      toast.success("Comprovante salvo e vinculado ao pedido.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível anexar o comprovante.");
    }
  }

  function handleProofSelection(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    void handleProof(file).finally(() => {
      input.value = "";
    });
  }

  async function removeEvidence(kind: "proof" | "signature") {
    const saved = await persistEvidence(
      kind === "proof" ? { clearProof: true } : { clearSignature: true },
    );
    if (!saved) return;
    if (kind === "proof") setProofUrl(null);
    else setSignatureUrl(null);
    toast.success(kind === "proof" ? "Comprovante removido." : "Assinatura removida.");
  }

  function setReceivedAmount(method: ReceivedPaymentMethod, value: string) {
    setReceivedPayment((current) => ({ ...current, [method]: value }));
    setPaymentDirty(true);
  }

  function useSinglePayment(method: ReceivedPaymentMethod) {
    if (!data) return;
    setReceivedPayment({
      pix: method === "pix" ? moneyInput(Number(data.order.total)) : "",
      dinheiro: method === "dinheiro" ? moneyInput(Number(data.order.total)) : "",
      cartao: method === "cartao" ? moneyInput(Number(data.order.total)) : "",
    });
    setPaymentDirty(true);
  }

  function buildReceivedPaymentParts(): PaymentBreakdownItem[] {
    return PAYMENT_OPTIONS.flatMap(({ method }) => {
      const amount = parseMoneyInput(receivedPayment[method]);
      return amount > 0 ? [{ method, amount } as PaymentBreakdownItem] : [];
    });
  }

  async function saveReceivedPayment(silent = false) {
    if (!data) return false;
    const parts = buildReceivedPaymentParts();
    const total = roundMoney(parts.reduce((sum, part) => sum + Number(part.amount || 0), 0));
    const orderTotal = roundMoney(data.order.total);

    if (Math.abs(total - orderTotal) > 0.01) {
      toast.error(
        total < orderTotal
          ? `Falta informar ${brl(orderTotal - total)} do pagamento recebido.`
          : `Os valores informados excedem o pedido em ${brl(total - orderTotal)}.`,
      );
      return false;
    }

    setPaymentSaving(true);
    try {
      const { error } = await (supabase as any).rpc("save_courier_received_payments", {
        _token: courierToken,
        _payments: parts,
      });
      if (error) throw error;

      setData((current) =>
        current
          ? {
              ...current,
              received_payments: parts,
              received_payment_total: total,
              received_payment_updated_at: new Date().toISOString(),
            }
          : current,
      );
      setPaymentDirty(false);
      if (!silent) toast.success("Pagamento recebido salvo com sucesso.");
      return true;
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar o pagamento recebido.");
      return false;
    } finally {
      setPaymentSaving(false);
    }
  }

  function prepareSignatureCanvas() {
    setSignatureOpen(true);
    signatureHasInkRef.current = false;
    requestAnimationFrame(() => {
      const canvas = signatureCanvasRef.current;
      if (!canvas) return;
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(280, canvas.clientWidth);
      const height = 180;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    });
  }

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function signaturePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    signatureHasInkRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = signatureCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pointFromEvent(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function signaturePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = signatureCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pointFromEvent(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    drawingRef.current = false;
    signatureHasInkRef.current = false;
  }

  async function saveSignature() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    if (!signatureHasInkRef.current) {
      toast.error("Peça ao cliente para assinar antes de salvar.");
      return;
    }
    const url = canvas.toDataURL("image/png");
    const saved = await persistEvidence({ signatureUrl: url });
    if (!saved) return;
    setSignatureUrl(url);
    setSignatureOpen(false);
    toast.success("Assinatura salva na entrega.");
  }

  function requestFinalizeDelivery() {
    if (!data || finalizing) return;
    if (!paymentMatches) {
      toast.error("Confira os valores recebidos antes de finalizar a entrega.");
      return;
    }
    setFinishConfirmOpen(true);
  }

  async function finalizeDelivery() {
    if (!data || finalizing) return;
    setFinishConfirmOpen(false);
    setFinalizing(true);

    try {
      if (paymentDirty || !data.received_payment_updated_at) {
        const paymentSaved = await saveReceivedPayment(true);
        if (!paymentSaved) return;
      }

      const { error } = await (supabase as any).rpc("finalize_courier_delivery", {
        _token: courierToken,
        _proof_url: proofUrl,
        _signature_url: signatureUrl,
      });
      if (error) throw error;

      stopWatch();
      await load();
      toast.success("Entrega finalizada e pedido marcado como entregue! 🎉");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível finalizar a entrega. Tente novamente.");
    } finally {
      setFinalizing(false);
    }
  }

  async function cancelDelivery() {
    if (!data || cancelling) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error("Informe o motivo da entrega não realizada.");
      return;
    }

    setCancelling(true);
    try {
      const { data: result, error } = await (supabase as any).rpc("cancel_courier_delivery", {
        _token: courierToken,
        _reason: reason,
      });
      if (error) throw error;

      stopWatch();
      setCancelOpen(false);
      setCancelReason("");
      await load();
      toast.success(
        result?.order_status === "cancelado"
          ? "Entrega não realizada e pedido cancelado."
          : "Entrega marcada como não entregue e disponível para nova atribuição.",
      );
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível cancelar a entrega.");
    } finally {
      setCancelling(false);
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
        Link de entrega inválido ou expirado.
      </div>
    );
  }

  const info = STATUS_INFO[data.status];
  const isFailed = data.status === "nao_entregue";
  const isFinished = ["entregue", "cancelado", "devolvido", "nao_entregue"].includes(data.status);
  const fullAddress = [data.order.address, data.order.district, data.order.city]
    .filter(Boolean)
    .join(", ");
  const t: CourierTheme = { ...DEFAULT_THEME, ...(data.settings ?? {}) };
  const cardStyle: React.CSSProperties = {
    background: t.card_color,
    border: `1px solid ${t.card_border_color}`,
    boxShadow: `0 10px 26px -12px ${t.card_shadow_color}88`,
  };
  const soft = `${t.primary_color}22`;
  const paymentParts = normalizePaymentBreakdown(data.order);
  const actualPaymentParts =
    Array.isArray(data.received_payments) && data.received_payments.length > 0
      ? data.received_payments
      : buildReceivedPaymentParts();
  const receivedTotal = roundMoney(
    buildReceivedPaymentParts().reduce((sum, part) => sum + Number(part.amount || 0), 0),
  );
  const orderTotal = roundMoney(data.order.total);
  const paymentDifference = roundMoney(orderTotal - receivedTotal);
  const paymentMatches = Math.abs(paymentDifference) <= 0.01;
  const signatureButtonStyle: React.CSSProperties = {
    background: t.primary_color,
    color: "#ffffff",
    borderColor: t.primary_color,
  };

  return (
    <div className="min-h-screen pb-10" style={{ background: t.background_color, color: t.text_color }}>
      <header
        className="w-full flex items-center justify-center px-5"
        style={{ background: t.header_color, height: 92 }}
      >
        {data.store.logo_url ? (
          <img src={data.store.logo_url} alt={data.store.name} className="max-h-16 object-contain" />
        ) : (
          <strong className="text-white text-xl">{data.store.name}</strong>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 space-y-4 mt-5">
        <section className="text-center space-y-2">
          <div className="text-xl font-extrabold" style={{ color: t.title_color }}>
            {data.store.name}
          </div>
          <div className="text-xs opacity-70">Pedido #{orderShortNumber(data.order.id)}</div>
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
            style={{ background: soft, color: t.primary_color }}
          >
            <Bike className="h-3.5 w-3.5" /> {info.label}
          </div>
        </section>

        <section className="rounded-2xl p-4" style={cardStyle}>
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 mt-0.5" style={{ color: t.icon_color }} />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider opacity-60">Entregar em</div>
              <div className="font-semibold" style={{ color: t.title_color }}>
                {fullAddress}
              </div>
            </div>
          </div>
          <a
            href={googleMapsRouteUrl(fullAddress)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
            style={{ background: t.button_color, color: "#fff" }}
          >
            <Navigation className="h-4 w-4" /> Abrir rota no Google Maps
          </a>
        </section>

        <section className="rounded-2xl p-4 space-y-2" style={cardStyle}>
          <div className="text-xs uppercase tracking-wider opacity-60">Cliente</div>
          <div className="font-semibold" style={{ color: t.title_color }}>
            {data.order.customer}
          </div>
          {data.order.phone && (
            <a
              href={`tel:${data.order.phone}`}
              className="inline-flex items-center gap-1.5 text-sm"
              style={{ color: t.icon_color }}
            >
              <Phone className="h-3.5 w-3.5" /> {data.order.phone}
            </a>
          )}
          {data.order.items?.length ? (
            <div className="text-xs opacity-80 pt-2">
              {data.order.items.map((i) => `${i.qty}x ${i.name}`).join(" · ")}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl p-4 space-y-2" style={cardStyle}>
          <div className="text-xs uppercase tracking-wider opacity-60">Pagamento informado no pedido</div>
          {paymentParts.map((part, index) => (
            <div key={`${part.method}-${index}`} className="flex items-center justify-between gap-3 text-sm">
              <span>{paymentMethodLabel(part.method)}</span>
              <strong style={{ color: t.title_color }}>{brl(part.amount)}</strong>
            </div>
          ))}
          <div
            className="flex items-center justify-between gap-3 border-t pt-2 text-sm font-semibold"
            style={{ borderColor: t.card_border_color }}
          >
            <span>Total do pedido</span>
            <span style={{ color: t.primary_color }}>{brl(data.order.total)}</span>
          </div>
        </section>

        {!isFinished && (
          <>
            {data.status === "aguardando_motoboy" || data.status === "preparando" ? (
              <section className="rounded-2xl p-4" style={cardStyle}>
                <Button
                  onClick={handleStart}
                  className="w-full h-12 text-base"
                  style={{ background: t.primary_color, color: "#fff" }}
                >
                  <Bike className="h-5 w-5 mr-2" /> Iniciar Entrega
                </Button>
                {permError && (
                  <div className="mt-3 text-xs text-red-400 flex gap-2">
                    <AlertTriangle className="h-4 w-4" /> {permError}
                  </div>
                )}
              </section>
            ) : (
              <>
        {!isFinished && (
          <section className="rounded-2xl p-4 space-y-4" style={cardStyle}>
            <div>
              <div className="font-semibold" style={{ color: t.title_color }}>
                Como o pagamento foi recebido?
              </div>
              <div className="text-xs opacity-65 mt-1">
                Informe o valor recebido em cada forma. Pode dividir entre PIX, dinheiro e cartão.
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_OPTIONS.map(({ method, label, icon: Icon }) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => useSinglePayment(method)}
                  className="rounded-xl border p-2.5 text-center text-xs font-semibold transition hover:opacity-80"
                  style={{
                    borderColor: `${t.primary_color}55`,
                    background: parseMoneyInput(receivedPayment[method]) > 0 ? soft : "transparent",
                    color: parseMoneyInput(receivedPayment[method]) > 0 ? t.primary_color : t.text_color,
                  }}
                >
                  <Icon className="h-4 w-4 mx-auto mb-1" />
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {PAYMENT_OPTIONS.map(({ method, label, icon: Icon }) => (
                <div
                  key={method}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: t.card_border_color, background: `${t.primary_color}08` }}
                >
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                    style={{ background: soft, color: t.primary_color }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium opacity-75">{label}</div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold">R$</span>
                      <input
                        inputMode="decimal"
                        value={receivedPayment[method]}
                        onChange={(event) => setReceivedAmount(method, event.target.value)}
                        placeholder="0,00"
                        className="w-full bg-transparent text-base font-bold outline-none"
                        style={{ color: t.title_color }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="rounded-xl p-3 text-sm"
              style={{ background: paymentMatches ? `${t.primary_color}15` : "rgba(239,68,68,.10)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <span>Total informado</span>
                <strong style={{ color: paymentMatches ? t.primary_color : "#ef4444" }}>
                  {brl(receivedTotal)}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-3 mt-1 text-xs opacity-80">
                <span>Total do pedido</span>
                <span>{brl(orderTotal)}</span>
              </div>
              <div className="mt-2 text-xs font-medium" style={{ color: paymentMatches ? t.primary_color : "#ef4444" }}>
                {paymentMatches
                  ? "✓ Valores conferidos"
                  : paymentDifference > 0
                    ? `Falta informar ${brl(paymentDifference)}`
                    : `Excedeu ${brl(Math.abs(paymentDifference))}`}
              </div>
            </div>

            <Button
              type="button"
              disabled={paymentSaving || !paymentMatches}
              onClick={() => saveReceivedPayment(false)}
              className="w-full h-11"
              style={{ background: t.primary_color, color: "#fff" }}
            >
              {paymentSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {paymentDirty || !data.received_payment_updated_at
                ? "Salvar pagamento recebido"
                : "Pagamento recebido salvo"}
            </Button>
          </section>
        )}

                <section className="rounded-2xl p-4 space-y-3" style={cardStyle}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold" style={{ color: t.title_color }}>
                        Comprovante de pagamento
                      </div>
                      <div className="text-xs opacity-65">
                        Tire uma foto agora ou escolha uma imagem já salva no celular. O arquivo é salvo imediatamente.
                      </div>
                    </div>
                    <FileImage className="h-5 w-5" style={{ color: t.icon_color }} />
                  </div>

                  {proofUrl ? (
                    <div className="space-y-2">
                      <img
                        src={proofUrl}
                        alt="Comprovante"
                        className="w-full max-h-64 object-contain rounded-xl bg-black/20"
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={evidenceSaving}
                        onClick={() => removeEvidence("proof")}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Remover comprovante
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <label
                        className={`flex min-h-12 items-center justify-center rounded-xl border border-dashed px-2 text-center text-sm font-semibold ${
                          evidenceSaving ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-80"
                        }`}
                        style={{ borderColor: `${t.primary_color}88`, color: t.primary_color }}
                      >
                        {evidenceSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4 mr-2" />
                        )}
                        Tirar foto
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={evidenceSaving}
                          onChange={(event) => handleProofSelection(event.currentTarget)}
                        />
                      </label>

                      <label
                        className={`flex min-h-12 items-center justify-center rounded-xl border border-dashed px-2 text-center text-sm font-semibold ${
                          evidenceSaving ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-80"
                        }`}
                        style={{ borderColor: `${t.primary_color}88`, color: t.primary_color }}
                      >
                        {evidenceSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Images className="h-4 w-4 mr-2" />
                        )}
                        Escolher foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={evidenceSaving}
                          onChange={(event) => handleProofSelection(event.currentTarget)}
                        />
                      </label>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl p-4 space-y-3" style={cardStyle}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold" style={{ color: t.title_color }}>
                        Assinatura do cliente{" "}
                        <span className="text-xs font-normal opacity-60">(opcional)</span>
                      </div>
                      <div className="text-xs opacity-65">
                        O cliente pode assinar com o dedo na tela. Ao salvar, a assinatura é enviada imediatamente.
                      </div>
                    </div>
                    <Signature className="h-5 w-5" style={{ color: t.icon_color }} />
                  </div>

                  {signatureUrl ? (
                    <div className="space-y-2">
                      <img
                        src={signatureUrl}
                        alt="Assinatura do cliente"
                        className="w-full h-36 object-contain rounded-xl bg-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          disabled={evidenceSaving}
                          onClick={prepareSignatureCanvas}
                          style={signatureButtonStyle}
                        >
                          <Signature className="h-4 w-4 mr-2" /> Refazer
                        </Button>
                        <Button
                          variant="outline"
                          disabled={evidenceSaving}
                          onClick={() => removeEvidence("signature")}
                          style={{ background: "#fff", color: "#111827", borderColor: "#d1d5db" }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="w-full h-12 text-base font-semibold"
                      disabled={evidenceSaving}
                      onClick={prepareSignatureCanvas}
                      style={signatureButtonStyle}
                    >
                      <Signature className="h-5 w-5 mr-2" /> Coletar assinatura
                    </Button>
                  )}
                </section>

                <section className="rounded-2xl p-4 space-y-3" style={cardStyle}>
                  {watching ? (
                    <div
                      className="rounded-lg text-xs p-3"
                      style={{ background: soft, color: t.primary_color }}
                    >
                      <div className="flex justify-between">
                        <span>GPS ativo</span>
                        <span className="flex items-center gap-1">
                          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                          {online ? "Online" : "Sem internet"}
                        </span>
                      </div>
                      <div className="opacity-70 mt-1">
                        {sending
                          ? "Sincronizando…"
                          : `Último envio: ${formatRelative(lastSent ? new Date(lastSent) : null)}`}
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={startWatch}>
                      <MapPin className="h-4 w-4 mr-2" /> Retomar rastreamento
                    </Button>
                  )}

                  {data.status !== "chegando" && (
                    <Button
                      className="w-full"
                      onClick={() => changeStatus("chegando")}
                      style={{ background: t.secondary_color, color: "#fff" }}
                    >
                      Estou chegando
                    </Button>
                  )}

                  <Button
                    type="button"
                    disabled={finalizing || evidenceSaving || paymentSaving || !paymentMatches}
                    onClick={requestFinalizeDelivery}
                    className="w-full h-12 text-base"
                    style={{ background: t.button_color, color: "#fff" }}
                  >
                    {finalizing || evidenceSaving || paymentSaving ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                    )}
                    Finalizar Entrega
                  </Button>

                  <Button
                    type="button"
                    disabled={cancelling || finalizing}
                    onClick={() => {
                      setCancelReason("");
                      setCancelOpen(true);
                    }}
                    className="w-full h-12 text-base"
                    style={{ background: "#dc2626", color: "#fff" }}
                  >
                    {cancelling ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-5 w-5 mr-2" />
                    )}
                    Cancelar Entrega
                  </Button>

                  {!paymentMatches && (
                    <div className="text-center text-xs font-medium text-red-500">
                      Confira os valores recebidos acima antes de finalizar.
                    </div>
                  )}

                  {watching && (
                    <button
                      onClick={stopWatch}
                      className="w-full text-xs opacity-60 inline-flex items-center justify-center gap-1"
                    >
                      <Power className="h-3 w-3" /> Pausar localização
                    </button>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {isFinished && (
          <section
            className="rounded-2xl p-6 text-center space-y-4"
            style={{ ...cardStyle, background: soft, borderColor: `${t.primary_color}55` }}
          >
            {isFailed ? (
              <AlertTriangle className="h-10 w-10 mx-auto" style={{ color: "#dc2626" }} />
            ) : (
              <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: t.primary_color }} />
            )}
            <div className="text-lg font-semibold" style={{ color: t.title_color }}>
              {data.status === "entregue" ? "Entrega finalizada" : isFailed ? "Entrega não realizada" : "Entrega cancelada"}
            </div>

            {data.status === "entregue" && actualPaymentParts.length > 0 && (
              <div className="rounded-xl border p-3 text-left text-sm" style={{ borderColor: `${t.primary_color}55` }}>
                <div className="text-xs uppercase tracking-wider opacity-60 mb-2">Pagamento recebido</div>
                {actualPaymentParts.map((part, index) => (
                  <div key={`${part.method}-${index}`} className="flex items-center justify-between gap-3 py-1">
                    <span>{paymentMethodLabel(part.method)}</span>
                    <strong>{brl(part.amount)}</strong>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t pt-2 mt-1 font-semibold" style={{ borderColor: t.card_border_color }}>
                  <span>Total</span>
                  <span style={{ color: t.primary_color }}>{brl(data.received_payment_total || data.order.total)}</span>
                </div>
              </div>
            )}

            {proofUrl && <div className="text-xs opacity-75">✓ Comprovante de pagamento anexado</div>}
            {signatureUrl && <div className="text-xs opacity-75">✓ Assinatura do cliente registrada</div>}
          </section>
        )}
      </main>

      {cancelOpen && (
        <div className="fixed inset-0 z-[65] bg-black/75 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-gray-900 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-bold">Cancelar entrega?</div>
                <div className="mt-1 text-sm text-gray-600">
                  Use esta opção quando a entrega já foi iniciada, mas não foi possível entregar ao cliente. Ela será registrada como não entregue no seu histórico.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold">Motivo</div>
              <div className="grid gap-2">
                {DELIVERY_FAILURE_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelReason(reason)}
                    className="rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition"
                    style={{
                      borderColor: cancelReason === reason ? "#dc2626" : "#d1d5db",
                      background: cancelReason === reason ? "#fef2f2" : "#ffffff",
                      color: cancelReason === reason ? "#b91c1c" : "#111827",
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">Outro motivo</label>
                <input
                  value={DELIVERY_FAILURE_REASONS.includes(cancelReason as any) ? "" : cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Digite outro motivo..."
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
              Se o cliente cancelou o pedido, ele será marcado como cancelado. Nos demais motivos, o pedido voltará para aguardando e poderá ser atribuído novamente.
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={cancelling}
                onClick={() => {
                  setCancelOpen(false);
                  setCancelReason("");
                }}
                style={{ background: "#fff", color: "#111827", borderColor: "#d1d5db" }}
              >
                Voltar
              </Button>
              <Button
                type="button"
                disabled={cancelling || !cancelReason.trim()}
                onClick={cancelDelivery}
                style={{ background: "#dc2626", color: "#fff" }}
              >
                {cancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {finishConfirmOpen && (
        <div className="fixed inset-0 z-[60] bg-black/75 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-gray-900 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-bold">Finalizar entrega?</div>
                <div className="mt-1 text-sm text-gray-600">
                  Confirme somente depois de entregar o pedido ao cliente. O pedido será marcado como entregue e o rastreamento será encerrado.
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Pedido</span>
                <strong>#{orderShortNumber(data.order.id)}</strong>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-gray-500">Valor recebido</span>
                <strong>{brl(receivedTotal)}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={finalizing}
                onClick={() => setFinishConfirmOpen(false)}
                style={{ background: "#fff", color: "#111827", borderColor: "#d1d5db" }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={finalizing}
                onClick={finalizeDelivery}
                style={{ background: "#16a34a", color: "#fff" }}
              >
                {finalizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar entrega
              </Button>
            </div>
          </div>
        </div>
      )}

      {signatureOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 text-gray-900 space-y-3">
            <div>
              <div className="text-lg font-bold">Assinatura do cliente</div>
              <div className="text-xs text-gray-500">
                Peça ao cliente para assinar com o dedo no espaço abaixo.
              </div>
            </div>

            <canvas
              ref={signatureCanvasRef}
              className="w-full h-[180px] rounded-xl border border-gray-300 touch-none bg-white"
              onPointerDown={signaturePointerDown}
              onPointerMove={signaturePointerMove}
              onPointerUp={() => (drawingRef.current = false)}
              onPointerCancel={() => (drawingRef.current = false)}
            />

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                disabled={evidenceSaving}
                onClick={clearSignature}
                style={{ background: "#fff", color: "#111827", borderColor: "#d1d5db" }}
              >
                Limpar
              </Button>
              <Button
                variant="outline"
                disabled={evidenceSaving}
                onClick={() => setSignatureOpen(false)}
                style={{ background: "#fff", color: "#111827", borderColor: "#d1d5db" }}
              >
                Cancelar
              </Button>
              <Button
                disabled={evidenceSaving}
                onClick={saveSignature}
                style={{ background: "#16a34a", color: "#fff" }}
              >
                {evidenceSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-[11px] opacity-50 mt-8">{t.footer_text}</footer>
    </div>
  );
}
