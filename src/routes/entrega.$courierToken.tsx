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
  Bike,
  CheckCircle2,
  FileImage,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Power,
  Signature,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { normalizePaymentBreakdown, paymentMethodLabel } from "@/lib/order-payments";

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

async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Envie uma imagem do comprovante.");
  if (file.size > 3 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 3 MB.");
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error("Imagem inválida."));
    next.src = raw;
  });
  const max = 1400;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
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
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const latestPosRef = useRef<GeolocationPosition | null>(null);
  const wakeLockRef = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const signatureHasInkRef = useRef(false);

  async function load() {
    const { data: res, error } = await supabase.rpc("get_courier_view", { _token: courierToken });
    if (!error && res) {
      const view = res as CourierView;
      setData(view);
      setProofUrl(view.proof_url || null);
      setSignatureUrl(view.signature_url || null);
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
    const { error } = await supabase.rpc("update_courier_status", { _token: courierToken, _status: newStatus });
    if (error) return toast.error(error.message);
    await load();
    toast.success(newStatus === "saiu_para_entrega" ? "Entrega iniciada" : "Cliente notificado: você está chegando");
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
    try {
      const { error } = await (supabase as any).rpc("save_courier_delivery_evidence", {
        _token: courierToken,
        _proof_url: options.proofUrl ?? null,
        _signature_url: options.signatureUrl ?? null,
        _clear_proof: options.clearProof ?? false,
        _clear_signature: options.clearSignature ?? false,
      });
      if (error) throw error;
      return true;
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
      setProofUrl(url);
      toast.success("Comprovante salvo na entrega.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível anexar o comprovante.");
    }
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

  async function finalizeDelivery() {
    if (!confirm("Confirmar que o pedido foi entregue ao cliente?")) return;
    setFinalizing(true);
    const { error } = await (supabase as any).rpc("finalize_courier_delivery", {
      _token: courierToken,
      _proof_url: proofUrl,
      _signature_url: signatureUrl,
    });
    setFinalizing(false);
    if (error) return toast.error(error.message);
    stopWatch();
    await load();
    toast.success("Entrega finalizada e pedido marcado como entregue! 🎉");
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0b1220] text-white"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0b1220] text-white text-center px-6">Link de entrega inválido ou expirado.</div>;
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
  const soft = `${t.primary_color}22`;
  const paymentParts = normalizePaymentBreakdown(data.order);

  return (
    <div className="min-h-screen pb-10" style={{ background: t.background_color, color: t.text_color }}>
      <header className="w-full flex items-center justify-center px-5" style={{ background: t.header_color, height: 92 }}>
        {data.store.logo_url ? <img src={data.store.logo_url} alt={data.store.name} className="max-h-16 object-contain" /> : <strong className="text-white text-xl">{data.store.name}</strong>}
      </header>

      <main className="max-w-md mx-auto px-4 space-y-4 mt-5">
        <section className="text-center space-y-2">
          <div className="text-xl font-extrabold" style={{ color: t.title_color }}>{data.store.name}</div>
          <div className="text-xs opacity-70">Pedido #{orderShortNumber(data.order.id)}</div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium" style={{ background: soft, color: t.primary_color }}>
            <Bike className="h-3.5 w-3.5" /> {info.label}
          </div>
        </section>

        <section className="rounded-2xl p-4" style={cardStyle}>
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 mt-0.5" style={{ color: t.icon_color }} />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider opacity-60">Entregar em</div>
              <div className="font-semibold" style={{ color: t.title_color }}>{fullAddress}</div>
            </div>
          </div>
          <a href={googleMapsRouteUrl(fullAddress)} target="_blank" rel="noreferrer" className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: t.button_color, color: "#fff" }}>
            <Navigation className="h-4 w-4" /> Abrir rota no Google Maps
          </a>
        </section>

        <section className="rounded-2xl p-4 space-y-2" style={cardStyle}>
          <div className="text-xs uppercase tracking-wider opacity-60">Cliente</div>
          <div className="font-semibold" style={{ color: t.title_color }}>{data.order.customer}</div>
          {data.order.phone && <a href={`tel:${data.order.phone}`} className="inline-flex items-center gap-1.5 text-sm" style={{ color: t.icon_color }}><Phone className="h-3.5 w-3.5" /> {data.order.phone}</a>}
          {data.order.items?.length ? <div className="text-xs opacity-80 pt-2">{data.order.items.map(i => `${i.qty}x ${i.name}`).join(" · ")}</div> : null}
        </section>

        <section className="rounded-2xl p-4 space-y-2" style={cardStyle}>
          <div className="text-xs uppercase tracking-wider opacity-60">Forma de pagamento</div>
          {paymentParts.map((part, index) => (
            <div key={`${part.method}-${index}`} className="flex items-center justify-between gap-3 text-sm">
              <span>{paymentMethodLabel(part.method)}</span>
              <strong style={{ color: t.title_color }}>{brl(part.amount)}</strong>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t pt-2 text-sm font-semibold" style={{ borderColor: t.card_border_color }}>
            <span>Total</span><span style={{ color: t.primary_color }}>{brl(data.order.total)}</span>
          </div>
        </section>

        {!isFinished && (
          <>
            {(data.status === "aguardando_motoboy" || data.status === "preparando") ? (
              <section className="rounded-2xl p-4" style={cardStyle}>
                <Button onClick={handleStart} className="w-full h-12 text-base" style={{ background: t.primary_color, color: "#fff" }}><Bike className="h-5 w-5 mr-2" /> Iniciar Entrega</Button>
                {permError && <div className="mt-3 text-xs text-red-400 flex gap-2"><AlertTriangle className="h-4 w-4" /> {permError}</div>}
              </section>
            ) : (
              <>
                <section className="rounded-2xl p-4 space-y-3" style={cardStyle}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold" style={{ color: t.title_color }}>Comprovante de pagamento</div>
                      <div className="text-xs opacity-65">Anexe uma foto do PIX, cartão ou recibo do cliente. O arquivo é salvo imediatamente.</div>
                    </div>
                    <FileImage className="h-5 w-5" style={{ color: t.icon_color }} />
                  </div>
                  {proofUrl ? (
                    <div className="space-y-2">
                      <img src={proofUrl} alt="Comprovante" className="w-full max-h-64 object-contain rounded-xl bg-black/20" />
                      <Button variant="outline" className="w-full" disabled={evidenceSaving} onClick={() => removeEvidence("proof")}><Trash2 className="h-4 w-4 mr-2" /> Remover comprovante</Button>
                    </div>
                  ) : (
                    <label className={`flex h-12 items-center justify-center rounded-xl border border-dashed text-sm font-medium ${evidenceSaving ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-80"}`}>
                      {evidenceSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} {evidenceSaving ? "Salvando comprovante…" : "Anexar comprovante"}
                      <input type="file" accept="image/*" capture="environment" className="hidden" disabled={evidenceSaving} onChange={e => handleProof(e.target.files?.[0])} />
                    </label>
                  )}
                </section>

                <section className="rounded-2xl p-4 space-y-3" style={cardStyle}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold" style={{ color: t.title_color }}>Assinatura do cliente <span className="text-xs font-normal opacity-60">(opcional)</span></div>
                      <div className="text-xs opacity-65">O cliente pode assinar com o dedo na tela. Ao salvar, a assinatura é enviada imediatamente.</div>
                    </div>
                    <Signature className="h-5 w-5" style={{ color: t.icon_color }} />
                  </div>
                  {signatureUrl ? (
                    <div className="space-y-2">
                      <img src={signatureUrl} alt="Assinatura do cliente" className="w-full h-36 object-contain rounded-xl bg-white" />
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" disabled={evidenceSaving} onClick={prepareSignatureCanvas}>Refazer</Button>
                        <Button variant="outline" disabled={evidenceSaving} onClick={() => removeEvidence("signature")}><Trash2 className="h-4 w-4 mr-2" /> Remover</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full" disabled={evidenceSaving} onClick={prepareSignatureCanvas}><Signature className="h-4 w-4 mr-2" /> Coletar assinatura</Button>
                  )}
                </section>

                <section className="rounded-2xl p-4 space-y-3" style={cardStyle}>
                  {watching ? (
                    <div className="rounded-lg text-xs p-3" style={{ background: soft, color: t.primary_color }}>
                      <div className="flex justify-between"><span>GPS ativo</span><span className="flex items-center gap-1">{online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{online ? "Online" : "Sem internet"}</span></div>
                      <div className="opacity-70 mt-1">{sending ? "Sincronizando…" : `Último envio: ${formatRelative(lastSent ? new Date(lastSent) : null)}`}</div>
                    </div>
                  ) : <Button variant="outline" className="w-full" onClick={startWatch}><MapPin className="h-4 w-4 mr-2" /> Retomar rastreamento</Button>}
                  {data.status !== "chegando" && <Button className="w-full" onClick={() => changeStatus("chegando")} style={{ background: t.secondary_color, color: "#fff" }}>Estou chegando</Button>}
                  <Button disabled={finalizing || evidenceSaving} onClick={finalizeDelivery} className="w-full h-12 text-base" style={{ background: t.button_color, color: "#fff" }}>
                    {finalizing || evidenceSaving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CheckCircle2 className="h-5 w-5 mr-2" />} {evidenceSaving ? "Salvando comprovação…" : "Finalizar Entrega"}
                  </Button>
                  {watching && <button onClick={stopWatch} className="w-full text-xs opacity-60 inline-flex items-center justify-center gap-1"><Power className="h-3 w-3" /> Pausar localização</button>}
                </section>
              </>
            )}
          </>
        )}

        {isFinished && (
          <section className="rounded-2xl p-6 text-center space-y-3" style={{ ...cardStyle, background: soft, borderColor: `${t.primary_color}55` }}>
            <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: t.primary_color }} />
            <div className="text-lg font-semibold" style={{ color: t.title_color }}>{data.status === "entregue" ? "Entrega finalizada" : "Entrega cancelada"}</div>
            {proofUrl && <div className="text-xs opacity-75">✓ Comprovante de pagamento anexado</div>}
            {signatureUrl && <div className="text-xs opacity-75">✓ Assinatura do cliente registrada</div>}
          </section>
        )}
      </main>

      {signatureOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 text-gray-900 space-y-3">
            <div>
              <div className="text-lg font-bold">Assinatura do cliente</div>
              <div className="text-xs text-gray-500">Peça ao cliente para assinar com o dedo no espaço abaixo.</div>
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
              <Button variant="outline" disabled={evidenceSaving} onClick={clearSignature}>Limpar</Button>
              <Button variant="outline" disabled={evidenceSaving} onClick={() => setSignatureOpen(false)}>Cancelar</Button>
              <Button disabled={evidenceSaving} onClick={saveSignature}>{evidenceSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-[11px] opacity-50 mt-8">{t.footer_text}</footer>
    </div>
  );
}
