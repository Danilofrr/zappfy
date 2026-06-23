import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bike, Copy, MessageCircle, MapPin, RefreshCw, X, Send, Loader2, AlertTriangle, ExternalLink, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  buildCourierMessage,
  buildCustomerTrackingMessage,
  deriveDisplayStatus,
  formatRelative,
  generateToken,
  orderShortNumber,
  STATUS_INFO,
  trackingUrls,
  whatsappLink,
  type DeliveryStatus,
} from "@/lib/tracking";
import { TrackingMap } from "./TrackingMap";
import { DestinationPicker } from "./DestinationPicker";
import { useStore } from "@/lib/store";

type Tracking = {
  id: string;
  order_id: string;
  tracking_code: string;
  courier_token: string;
  courier_name: string | null;
  courier_phone: string | null;
  notes: string | null;
  status: DeliveryStatus;
  latitude: number | null;
  longitude: number | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_geocoded_address: string | null;
  delivery_geocoding_status: string | null;
  heading: number | null;
  last_updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  accepted_at: string | null;
};

type Props = {
  orderId: string;
  customerPhone?: string;
  orderAddress?: string;
};

export function DeliveryTrackingPanel({ orderId, customerPhone, orderAddress }: Props) {
  const { state } = useStore();
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [sendingCentral, setSendingCentral] = useState(false);

  async function ensureTracking(): Promise<Tracking | null> {
    // Prefer the most recent ACTIVE (non-cancelled) tracking row, so the
    // public link we copy/share always matches a row the public RPC accepts.
    const { data: active } = await supabase
      .from("delivery_tracking")
      .select("*")
      .eq("order_id", orderId)
      .neq("status", "cancelado")
      .order("created_at", { ascending: false })
      .limit(1);
    if (active?.[0]) return active[0] as Tracking;

    // No active row: create a fresh one so the customer always has a valid link.
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return null;
    const { data: created, error } = await supabase
      .from("delivery_tracking")
      .insert({
        order_id: orderId,
        store_id: uid,
        tracking_code: generateToken("t"),
        courier_token: generateToken("c"),
        status: "preparando" as DeliveryStatus,
      })
      .select()
      .single();
    if (error) {
      console.error("auto-create tracking failed", error);
      return null;
    }
    return created as Tracking;
  }


  async function load() {
    setLoading(true);
    const t = await ensureTracking();
    setTracking(t);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Realtime sync for the tracking row
  useEffect(() => {
    if (!tracking?.id) return;
    const channel = supabase
      .channel(`tracking_${tracking.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_tracking", filter: `id=eq.${tracking.id}` },
        (payload) => setTracking((prev) => (prev ? { ...prev, ...(payload.new as Tracking) } : prev)),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tracking?.id]);

  // Realtime sync for the linked order (status changes from the dashboard)
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order_${orderId}_panel`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleCreateCourier() {
    if (!tracking) return;
    if (!form.name.trim()) { toast.error("Informe o nome do motoboy"); return; }
    setCreating(true);
    const { error } = await supabase
      .from("delivery_tracking")
      .update({
        courier_name: form.name.trim(),
        courier_phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        status: "aguardando_motoboy" as DeliveryStatus,
      })
      .eq("id", tracking.id);
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setCreateOpen(false);
    setForm({ name: "", phone: "", notes: "" });
    toast.success("Motoboy vinculado ao pedido!");
    load();
  }

  async function handleSendToCentral() {
    if (!tracking) return;
    setSendingCentral(true);
    const { error } = await supabase
      .from("delivery_tracking")
      .update({ status: "aguardando_motoboy" as DeliveryStatus })
      .eq("id", tracking.id);
    setSendingCentral(false);
    if (error) { toast.error(error.message); return; }
    setTracking({ ...tracking, status: "aguardando_motoboy" });
    toast.success("Entrega enviada para a Central de Entregas!");
  }

  async function handleCancel() {
    if (!tracking) return;
    if (!confirm("Cancelar este rastreamento?")) return;
    const { error } = await supabase
      .from("delivery_tracking")
      .update({ status: "cancelado" })
      .eq("id", tracking.id);
    if (error) { toast.error(error.message); return; }
    setTracking({ ...tracking, status: "cancelado" });
    toast.success("Rastreamento cancelado");
  }

  async function handleFinalize() {
    if (!tracking) return;
    if (!confirm("Finalizar acompanhamento deste pedido?")) return;
    const { error } = await supabase.rpc("finalize_delivery_tracking", { _tracking_id: tracking.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Acompanhamento finalizado");
    load();
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urls = tracking ? trackingUrls(origin, tracking.tracking_code, tracking.courier_token) : null;
  const orderNumber = orderShortNumber(orderId);

  async function copy(text: string, label: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success(`${label} copiado!`);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  }

  // Always resolve the freshest ACTIVE customer URL from the DB before sharing,
  // so Copiar, Visualizar e WhatsApp usam exatamente o mesmo link válido.
  async function resolveCustomerUrl(): Promise<string | null> {
    const fresh = await ensureTracking();
    if (!fresh) { toast.error("Não foi possível gerar o link"); return null; }
    if (fresh.tracking_code !== tracking?.tracking_code) setTracking(fresh);
    return `${origin}/rastreio/${fresh.tracking_code}`;
  }

  async function copyCustomerLink() {
    const url = await resolveCustomerUrl();
    if (url) await copy(url, "Link do cliente");
  }

  async function viewCustomerLink() {
    const url = await resolveCustomerUrl();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }


  function sendCourier() {
    if (!tracking || !urls) return;
    const phone = tracking.courier_phone;
    if (!phone) { toast.error("Cadastre o telefone do motoboy"); return; }
    const msg = buildCourierMessage(orderNumber, urls.courier);
    window.open(whatsappLink(phone, msg), "_blank");
  }

  function sendCustomer() {
    if (!urls) return;
    const phone = customerPhone || "";
    if (!phone) { toast.error("Pedido sem telefone do cliente"); return; }
    const order = state.orders.find((o) => o.id === orderId);
    const firstItem = order?.items?.[0];
    const productName = firstItem
      ? (order!.items.length > 1 ? `${firstItem.name} +${order!.items.length - 1}` : firstItem.name)
      : "";
    const msg = buildCustomerTrackingMessage(state.settings.customerTrackingMessageTemplate, {
      customer_name: order?.customer ?? "",
      order_number: orderNumber,
      tracking_link: urls.customer,
      store_name: state.settings.storeName ?? "",
      product_name: productName,
      order_status: order?.status ?? tracking?.status ?? "",
    });
    window.open(whatsappLink(phone, msg), "_blank");
  }

  if (loading || !tracking) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando rastreamento…
      </div>
    );
  }

  const order = state.orders.find((o) => o.id === orderId);
  const displayStatus: DeliveryStatus = deriveDisplayStatus(tracking.status, order?.status);
  const info = STATUS_INFO[displayStatus];
  const courierPos = tracking.latitude != null && tracking.longitude != null
    ? { lat: tracking.latitude, lng: tracking.longitude }
    : null;
  const destination = tracking.delivery_latitude != null && tracking.delivery_longitude != null
    ? { lat: tracking.delivery_latitude, lng: tracking.delivery_longitude }
    : null;
  const hasMapAnything = courierPos || destination;
  const isCancelled = displayStatus === "cancelado";
  const isDelivered = displayStatus === "entregue";
  const isFinished = isCancelled || isDelivered;
  const preDelivery = !isFinished && (displayStatus === "preparando" || (displayStatus === "aguardando_motoboy" && !tracking.courier_name));

  async function handleSaveDestination(coords: { lat: number; lng: number }) {
    const { error } = await supabase.rpc("set_tracking_destination", {
      _code: tracking!.tracking_code,
      _lat: coords.lat,
      _lng: coords.lng,
      _address: orderAddress ?? null,
      _status: "manual",
    });
    if (error) { toast.error(error.message); return; }
    setTracking((t) => t ? { ...t, delivery_latitude: coords.lat, delivery_longitude: coords.lng, delivery_geocoding_status: "manual" } : t);
    toast.success("Localização do destino salva!");
    load();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Bike className="h-4 w-4 text-primary" /> Acompanhamento do Pedido</div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.bg} ${info.color}`}>{info.label}</span>
      </div>

      {/* Finished state: show completion badge only, hide everything else */}
      {isFinished ? (
        <div
          className={`rounded-xl border p-4 text-center ${
            isDelivered
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-destructive/40 bg-destructive/10"
          }`}
        >
          {isDelivered ? (
            <>
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-1" />
              <div className="font-semibold text-emerald-600 dark:text-emerald-400">Entrega concluída</div>
              <div className="text-xs text-muted-foreground mt-1">
                ✅ Pedido entregue com sucesso
                {tracking.completed_at && <> · {formatRelative(tracking.completed_at)}</>}
              </div>
            </>
          ) : (
            <>
              <X className="h-8 w-8 mx-auto text-destructive mb-1" />
              <div className="font-semibold text-destructive">Pedido cancelado</div>
              <div className="text-xs text-muted-foreground mt-1">❌ Acompanhamento encerrado.</div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Always-visible client link block */}
          {urls && (
            <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="text-xs font-semibold mb-1.5">Link público do cliente</div>
              <div className="flex items-center gap-2 mb-2">
                <code className="flex-1 truncate rounded-md bg-background border border-border px-2 py-1 text-[11px]">{urls.customer}</code>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(urls.customer, "Link do cliente")}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={sendCustomer}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={urls.customer} target="_blank" rel="noreferrer">
                    <Eye className="h-3.5 w-3.5 mr-1" /> Visualizar
                  </a>
                </Button>
              </div>
            </div>
          )}

          {preDelivery && (
            <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <div className="font-semibold text-amber-700 dark:text-amber-400">Pedido ainda em preparação</div>
              <div className="text-muted-foreground mt-0.5">O cliente já pode acompanhar pelo link acima. Quando estiver pronto, envie para a Central de Entregas ou vincule um motoboy específico.</div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button size="sm" onClick={handleSendToCentral} disabled={sendingCentral}>
                  {sendingCentral ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Bike className="h-4 w-4 mr-1.5" />}
                  {displayStatus === "preparando" ? "Enviar para Central de Entregas" : "Já na Central"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                  Vincular motoboy específico
                </Button>
                {state.settings.slug && (
                  <Button size="sm" variant="outline" onClick={() => copy(`${origin}/entregas-zappfy/${state.settings.slug}`, "Link da Central")}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Link da Central
                  </Button>
                )}
              </div>
            </div>
          )}

          {!preDelivery && !destination && (
            <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-amber-600 dark:text-amber-400">Defina a localização do destino para exibir o pino no mapa.</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                <MapPin className="h-3.5 w-3.5 mr-1" /> Definir
              </Button>
            </div>
          )}

          {!preDelivery && (
            <>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <div className="text-xs space-y-1">
                  <div><span className="text-muted-foreground">Motoboy:</span> <strong>{tracking.courier_name || "Aguardando aceite"}</strong></div>
                  {tracking.courier_phone && (
                    <div>
                      <span className="text-muted-foreground">WhatsApp:</span>{" "}
                      <a className="underline" href={whatsappLink(tracking.courier_phone, "")} target="_blank" rel="noreferrer">
                        {tracking.courier_phone}
                      </a>
                    </div>
                  )}
                  {tracking.accepted_at && (
                    <div><span className="text-muted-foreground">Aceita em:</span> {formatRelative(tracking.accepted_at)}</div>
                  )}
                  <div><span className="text-muted-foreground">Última atualização GPS:</span> {formatRelative(tracking.last_updated_at)}</div>
                  {tracking.notes && <div className="text-muted-foreground italic">Obs: {tracking.notes}</div>}
                  <div className="pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setPickerOpen(true)}>
                      <MapPin className="h-3 w-3 mr-1" /> {destination ? "Ajustar destino no mapa" : "Definir localização no mapa"}
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden">
                  {hasMapAnything ? (
                    <TrackingMap
                      courier={courierPos}
                      destination={destination}
                      heading={tracking.heading}
                      height={160}
                      primaryColor={state.settings.checkoutNeonColor || "#10b981"}
                      follow
                    />
                  ) : (
                    <div className="h-[160px] rounded-xl border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground text-center px-3">
                      <MapPin className="h-3.5 w-3.5 mr-1 shrink-0" /> Aguardando posição do motoboy e localização do destino…
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Button size="sm" variant="outline" onClick={() => urls && copy(urls.courier, "Link do motoboy")}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Link motoboy
                </Button>
                <Button size="sm" variant="outline" onClick={load}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={sendCourier}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Enviar motoboy
                </Button>
                <Button size="sm" variant="destructive" onClick={handleCancel}>
                  <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                </Button>
              </div>
            </>
          )}

          {/* Finalizar acompanhamento — disponível em qualquer estado ativo */}
          <div className="mt-3 pt-3 border-t border-border flex justify-end">
            <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700" onClick={handleFinalize}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Finalizar acompanhamento
            </Button>
          </div>
        </>
      )}

      <CreateDialog open={createOpen} onOpenChange={setCreateOpen} form={form} setForm={setForm} onSubmit={handleCreateCourier} loading={creating} />

      <DestinationPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initial={destination}
        fallbackAddress={orderAddress ?? tracking.delivery_geocoded_address ?? ""}
        onSave={handleSaveDestination}
      />
    </div>
  );
}

function CreateDialog({
  open, onOpenChange, form, setForm, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: { name: string; phone: string; notes: string };
  setForm: (f: { name: string; phone: string; notes: string }) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular motoboy</DialogTitle>
          <DialogDescription>Cadastre o motoboy que fará esta entrega.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome do motoboy *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="João" />
          </div>
          <div>
            <Label>Telefone (com DDD)</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5581999990000" />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Troco, observações da entrega…" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Bike className="h-4 w-4 mr-1" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
