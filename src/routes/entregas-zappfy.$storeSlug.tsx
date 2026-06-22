import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bike, MapPin, Phone, Loader2, RefreshCw, Package, ArrowRight, Store } from "lucide-react";
import { toast } from "sonner";
import { formatRelative, orderShortNumber } from "@/lib/tracking";

export const Route = createFileRoute("/entregas-zappfy/$storeSlug")({
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

type StoreInfo = { store_id: string; store_name: string; slug: string };

type Delivery = {
  tracking_code: string;
  status: string;
  created_at: string;
  notes: string | null;
  order: {
    id: string;
    customer: string;
    phone: string;
    address: string;
    district: string;
    city: string;
    total: number;
    date: string;
    notes: string | null;
  };
};

type AcceptedRecord = { tracking_code: string; courier_token: string; accepted_at: number };

const DEFAULT_THEME: CentralTheme = {
  id: "",
  logo_url: null,
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

function storageKey(slug: string) {
  return `zappfy:central:accepted:${slug.toLowerCase()}`;
}
function readAccepted(slug: string): AcceptedRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeAccepted(slug: string, list: AcceptedRecord[]) {
  try { localStorage.setItem(storageKey(slug), JSON.stringify(list)); } catch {}
}

function CentralPage() {
  const { storeSlug } = Route.useParams();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<CentralTheme>(DEFAULT_THEME);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [list, setList] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [chosen, setChosen] = useState<Delivery | null>(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState<AcceptedRecord[]>([]);

  // Load theme + store + initial deliveries
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: themeRes }, { data: storeRes }] = await Promise.all([
        supabase.rpc("get_zappfy_central_settings"),
        supabase.rpc("get_store_by_slug", { _slug: storeSlug }),
      ]);
      if (!alive) return;
      if (themeRes) setTheme({ ...DEFAULT_THEME, ...(themeRes as CentralTheme) });
      if (storeRes) setStore(storeRes as StoreInfo);
      setAccepted(readAccepted(storeSlug));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [storeSlug]);

  // Saved courier identity
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`zappfy:courier:${storeSlug.toLowerCase()}`);
      if (saved) {
        const v = JSON.parse(saved);
        setForm({ name: v.name || "", phone: v.phone || "" });
      }
    } catch {}
  }, [storeSlug]);

  async function loadDeliveries() {
    const { data, error } = await supabase.rpc("list_available_deliveries", { _slug: storeSlug });
    if (!error && Array.isArray(data)) setList(data as Delivery[]);
  }

  useEffect(() => {
    if (!store) return;
    loadDeliveries();
    const interval = setInterval(loadDeliveries, 15000);
    const channel = supabase
      .channel(`central_${store.store_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_tracking", filter: `store_id=eq.${store.store_id}` },
        () => loadDeliveries(),
      )
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.store_id]);

  function openAccept(d: Delivery) {
    setChosen(d);
    setAcceptOpen(true);
  }

  async function confirmAccept() {
    if (!chosen) return;
    if (!form.name.trim()) { toast.error("Informe seu nome"); return; }
    setAccepting(true);
    const { data, error } = await supabase.rpc("accept_delivery", {
      _slug: storeSlug,
      _code: chosen.tracking_code,
      _name: form.name.trim(),
      _phone: form.phone.trim() || undefined,
    });
    setAccepting(false);
    if (error) { toast.error(error.message); return; }
    const result = data as { courier_token: string; tracking_code: string };
    try {
      localStorage.setItem(
        `zappfy:courier:${storeSlug.toLowerCase()}`,
        JSON.stringify({ name: form.name.trim(), phone: form.phone.trim() }),
      );
    } catch {}
    const next = [
      { tracking_code: result.tracking_code, courier_token: result.courier_token, accepted_at: Date.now() },
      ...accepted.filter((a) => a.tracking_code !== result.tracking_code),
    ];
    writeAccepted(storeSlug, next);
    setAccepted(next);
    setAcceptOpen(false);
    toast.success("Entrega aceita! Boa rota 🛵");
    navigate({ to: "/entrega/$courierToken", params: { courierToken: result.courier_token } });
  }

  const cardStyle: React.CSSProperties = {
    background: theme.card_color,
    border: `1px solid ${theme.card_border_color}`,
    boxShadow: `0 10px 26px -12px ${theme.card_shadow_color}88`,
    borderRadius: theme.card_radius,
    color: theme.text_color,
  };

  const recentAccepted = useMemo(
    () => accepted.slice(0, 6).filter((a) => Date.now() - a.accepted_at < 1000 * 60 * 60 * 24 * 2),
    [accepted],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.background_color, color: theme.text_color }}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6" style={{ background: theme.background_color, color: theme.text_color }}>
        <div>
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-xl font-semibold" style={{ color: theme.title_color }}>Loja não encontrada</h1>
          <p className="text-sm opacity-70 mt-2">Verifique o link informado pela loja.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: theme.background_color, color: theme.text_color }}>
      <header
        className="w-full px-5 py-5 flex items-center gap-3"
        style={{ background: theme.header_color, color: theme.header_text_color }}
      >
        {theme.logo_url ? (
          <img src={theme.logo_url} alt={theme.brand_name} className="h-10 w-auto object-contain" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: theme.button_color, color: theme.button_text_color }}>
            <Bike className="h-5 w-5" />
          </div>
        )}
        <div className="leading-tight">
          <div className="text-lg font-extrabold">{theme.brand_name}</div>
          <div className="text-xs opacity-80">Central de Entregas</div>
        </div>
        <button
          onClick={loadDeliveries}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border"
          style={{ borderColor: `${theme.header_text_color}33`, color: theme.header_text_color }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-5 space-y-5">
        <section className="flex items-center gap-2 text-sm">
          <Store className="h-4 w-4" style={{ color: theme.icon_color }} />
          <span className="opacity-70">Loja:</span>
          <strong style={{ color: theme.title_color }}>{store.store_name}</strong>
        </section>

        {recentAccepted.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-2 opacity-80">Minhas entregas em andamento</h2>
            <div className="space-y-2">
              {recentAccepted.map((a) => (
                <button
                  key={a.tracking_code}
                  onClick={() => navigate({ to: "/entrega/$courierToken", params: { courierToken: a.courier_token } })}
                  className="w-full flex items-center justify-between p-3 text-left transition hover:opacity-90"
                  style={cardStyle}
                >
                  <div className="text-xs">
                    <div className="opacity-70">Aceita {formatRelative(new Date(a.accepted_at).toISOString())}</div>
                    <div className="font-semibold" style={{ color: theme.title_color }}>Continuar entrega</div>
                  </div>
                  <ArrowRight className="h-4 w-4" style={{ color: theme.icon_color }} />
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold mb-2 opacity-80">
            Entregas disponíveis {list.length > 0 && <span className="opacity-60">({list.length})</span>}
          </h2>

          {list.length === 0 ? (
            <div className="p-6 text-center" style={cardStyle}>
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" style={{ color: theme.icon_color }} />
              <div className="text-sm font-medium" style={{ color: theme.title_color }}>Nenhuma entrega disponível</div>
              <div className="text-xs opacity-70 mt-1">Assim que a loja liberar uma entrega, ela aparece aqui automaticamente.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((d) => {
                const addr = [d.order.address, d.order.district, d.order.city].filter(Boolean).join(", ");
                return (
                  <div key={d.tracking_code} className="p-4 space-y-3" style={cardStyle}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs opacity-70">Pedido #{orderShortNumber(d.order.id)}</div>
                        <div className="font-semibold" style={{ color: theme.title_color }}>{d.order.customer}</div>
                      </div>
                      <div className="text-[11px] opacity-70 text-right">{formatRelative(d.created_at)}</div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: theme.icon_color }} />
                      <div className="flex-1">{addr || "Endereço não informado"}</div>
                    </div>
                    {d.order.phone && (
                      <div className="flex items-center gap-2 text-xs opacity-80">
                        <Phone className="h-3.5 w-3.5" style={{ color: theme.icon_color }} />
                        {d.order.phone}
                      </div>
                    )}
                    {d.notes && (
                      <div className="text-xs italic opacity-80 pt-1 border-t" style={{ borderColor: theme.card_border_color }}>
                        Obs: {d.notes}
                      </div>
                    )}
                    <Button
                      onClick={() => openAccept(d)}
                      className="w-full h-11 font-semibold"
                      style={{ background: theme.button_color, color: theme.button_text_color }}
                    >
                      <Bike className="h-4 w-4 mr-2" /> Aceitar Entrega
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="text-center text-[11px] opacity-50 mt-10">{theme.footer_text}</footer>

      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aceitar entrega</DialogTitle>
            <DialogDescription>
              {chosen && (
                <>
                  Pedido #{orderShortNumber(chosen.order.id)} — {chosen.order.customer}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Seu nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="João Motoboy" />
            </div>
            <div>
              <Label>Seu WhatsApp</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5581999990000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptOpen(false)}>Cancelar</Button>
            <Button onClick={confirmAccept} disabled={accepting}>
              {accepting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Bike className="h-4 w-4 mr-1" />}
              Aceitar e iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
