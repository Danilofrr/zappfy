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
import { Bike, Copy, MessageCircle, MapPin, RefreshCw, X, Send, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  buildCourierMessage,
  buildCustomerMessage,
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

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("delivery_tracking")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!error) setTracking((data?.[0] as Tracking | undefined) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Realtime sync
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

  async function handleCreate() {
    if (!form.name.trim()) { toast.error("Informe o nome do motoboy"); return; }
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { toast.error("Sessão expirada"); setCreating(false); return; }
    const payload = {
      order_id: orderId,
      store_id: uid,
      tracking_code: generateToken("t"),
      courier_token: generateToken("c"),
      courier_name: form.name.trim(),
      courier_phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
      status: "aguardando_motoboy" as DeliveryStatus,
    };
    const { data, error } = await supabase
      .from("delivery_tracking")
      .insert(payload)
      .select()
      .single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setTracking(data as Tracking);
    setCreateOpen(false);
    setForm({ name: "", phone: "", notes: "" });
    toast.success("Rastreamento criado!");
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

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urls = tracking ? trackingUrls(origin, tracking.tracking_code, tracking.courier_token) : null;
  const orderNumber = orderShortNumber(orderId);

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copiado!`);
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
    const msg = buildCustomerMessage(urls.customer);
    window.open(whatsappLink(phone, msg), "_blank");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando rastreamento…
      </div>
    );
  }

  if (!tracking || tracking.status === "cancelado") {
    const isCancelled = tracking?.status === "cancelado";
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-1 text-sm font-semibold">
          <Bike className="h-4 w-4 text-primary" /> Rastreamento da Entrega
        </div>
        {isCancelled ? (
          <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs flex items-start gap-2">
            <X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-destructive">Rastreamento cancelado</div>
              <div className="text-muted-foreground mt-0.5">Os links anteriores foram desativados. Gere um novo rastreamento para continuar.</div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mb-3">Gere um link para o motoboy compartilhar a localização em tempo real com o cliente.</p>
        )}
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Bike className="h-4 w-4 mr-1.5" />{isCancelled ? "Gerar novo rastreamento" : "Gerar Rastreamento"}
        </Button>
        <CreateDialog open={createOpen} onOpenChange={setCreateOpen} form={form} setForm={setForm} onSubmit={handleCreate} loading={creating} />
      </div>
    );
  }




  const info = STATUS_INFO[tracking.status];
  const courierPos = tracking.latitude != null && tracking.longitude != null
    ? { lat: tracking.latitude, lng: tracking.longitude }
    : null;
  const destination = tracking.delivery_latitude != null && tracking.delivery_longitude != null
    ? { lat: tracking.delivery_latitude, lng: tracking.delivery_longitude }
    : null;
  const hasMapAnything = courierPos || destination;

  async function handleSaveDestination(coords: { lat: number; lng: number }) {
    const { error } = await supabase.rpc("set_tracking_destination", {
      _code: tracking!.tracking_code,
      _lat: coords.lat,
      _lng: coords.lng,
      _address: orderAddress ?? null,
      _status: "manual",
    });
    if (error) { toast.error(error.message); return; }
    // optimistic update + refresh
    setTracking((t) => t ? { ...t, delivery_latitude: coords.lat, delivery_longitude: coords.lng, delivery_geocoding_status: "manual" } : t);
    toast.success("Localização do destino salva!");
    load();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Bike className="h-4 w-4 text-primary" /> Rastreamento da Entrega</div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.bg} ${info.color}`}>{info.label}</span>
      </div>

      {!destination && tracking.status !== "entregue" && (
        <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-amber-600 dark:text-amber-400">Defina a localização do destino para exibir o pino no mapa.</div>
            <div className="text-muted-foreground mt-0.5">O endereço do pedido não foi localizado automaticamente. Ajuste o ponto manualmente abaixo.</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            <MapPin className="h-3.5 w-3.5 mr-1" /> Definir
          </Button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <div className="text-xs space-y-1">
          <div><span className="text-muted-foreground">Motoboy:</span> <strong>{tracking.courier_name || "—"}</strong></div>
          {tracking.courier_phone && <div><span className="text-muted-foreground">Telefone:</span> {tracking.courier_phone}</div>}
          <div><span className="text-muted-foreground">Última atualização:</span> {formatRelative(tracking.last_updated_at)}</div>
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
        <Button size="sm" variant="outline" onClick={() => urls && copy(urls.customer, "Link do cliente")}>
          <Copy className="h-3.5 w-3.5 mr-1" /> Link cliente
        </Button>
        <Button size="sm" variant="outline" onClick={() => urls && copy(urls.courier, "Link do motoboy")}>
          <Copy className="h-3.5 w-3.5 mr-1" /> Link motoboy
        </Button>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>
        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={sendCustomer}>
          <MessageCircle className="h-3.5 w-3.5 mr-1" /> Avisar cliente
        </Button>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={sendCourier}>
          <Send className="h-3.5 w-3.5 mr-1" /> Enviar motoboy
        </Button>
        {tracking.status !== "cancelado" && tracking.status !== "entregue" && (
          <Button size="sm" variant="destructive" onClick={handleCancel}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancelar
          </Button>
        )}
      </div>

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
          <DialogTitle>Gerar rastreamento</DialogTitle>
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
            Gerar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
