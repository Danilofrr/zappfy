import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { brl, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeliveryTrackingPanel } from "@/components/DeliveryTrackingPanel";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Palette, Search, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { STATUS_INFO, type DeliveryStatus } from "@/lib/tracking";
import { useActiveStore } from "@/lib/active-store";

export const Route = createFileRoute("/_authenticated/rastreamento")({
  head: () => ({ meta: [{ title: "Rastreamento — ZappFy" }] }),
  component: RastreamentoPage,
});

type TrackingRow = {
  order_id: string;
  status: DeliveryStatus;
  courier_name: string | null;
  last_updated_at: string | null;
};

type Filter = "ativos" | "sem" | "concluidos" | "todos";

function RastreamentoPage() {
  const { state } = useStore();
  const { activeStoreId } = useActiveStore();
  const [trackings, setTrackings] = useState<Record<string, TrackingRow>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ativos");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    if (!activeStoreId) { setLoading(false); return; }
    const { data } = await supabase
      .from("delivery_tracking")
      .select("order_id,status,courier_name,last_updated_at,created_at")
      .eq("store_id", activeStoreId)
      .order("created_at", { ascending: false });
    const map: Record<string, TrackingRow> = {};
    (data ?? []).forEach((r: any) => { if (!map[r.order_id]) map[r.order_id] = r; });
    setTrackings(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("rastreamento_list")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_tracking" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeStoreId]);

  const orders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...state.orders]
      .filter((o) => o.status !== "cancelado")
      .filter((o) => {
        const t = trackings[o.id];
        if (filter === "sem") return !t;
        if (filter === "ativos") return t && t.status !== "entregue" && t.status !== "cancelado";
        if (filter === "concluidos") return t && (t.status === "entregue" || t.status === "cancelado");
        return true;
      })
      .filter((o) => !term ||
        o.customer.toLowerCase().includes(term) ||
        o.phone.includes(term) ||
        o.id.toLowerCase().includes(term))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [state.orders, trackings, filter, search]);

  const counts = useMemo(() => {
    let ativos = 0, sem = 0, concluidos = 0;
    state.orders.forEach((o) => {
      if (o.status === "cancelado") return;
      const t = trackings[o.id];
      if (!t) sem++;
      else if (t.status === "entregue" || t.status === "cancelado") concluidos++;
      else ativos++;
    });
    return { ativos, sem, concluidos };
  }, [state.orders, trackings]);

  return (
    <AppShell
      title="Rastreamento"
      subtitle="Acompanhe e gerencie todas as entregas em tempo real"
      actions={
        <Link to="/personalizar-rastreamento">
          <Button variant="outline" size="sm"><Palette className="h-4 w-4 mr-1.5" /> Personalizar</Button>
        </Link>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FilterChip label="Em andamento" value={counts.ativos} active={filter === "ativos"} onClick={() => setFilter("ativos")} tone="primary" />
          <FilterChip label="Sem rastreamento" value={counts.sem} active={filter === "sem"} onClick={() => setFilter("sem")} tone="warning" />
          <FilterChip label="Concluídos" value={counts.concluidos} active={filter === "concluidos"} onClick={() => setFilter("concluidos")} tone="muted" />
          <FilterChip label="Todos" value={counts.ativos + counts.sem + counts.concluidos} active={filter === "todos"} onClick={() => setFilter("todos")} tone="muted" />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, telefone ou pedido" className="pl-9" />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Bike className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <div className="font-semibold">Nada por aqui</div>
            <p className="text-sm text-muted-foreground mt-1">Nenhum pedido se encaixa neste filtro.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => {
              const t = trackings[o.id];
              const info = t ? STATUS_INFO[t.status] : null;
              const isOpen = openId === o.id;
              return (
                <div key={o.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setOpenId(isOpen ? null : o.id)}
                    className="w-full flex items-center justify-between gap-3 p-4 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 grid place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                        <Bike className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate">{o.customer}</span>
                          {info ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${info.bg} ${info.color}`}>{info.label}</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">Sem rastreamento</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" /> {o.address || "—"} · {brl(o.total)} · {fmtDate(o.date)}
                        </div>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-secondary/10 p-4">
                      <DeliveryTrackingPanel
                        orderId={o.id}
                        customerPhone={o.phone}
                        orderAddress={[o.address, o.district, o.city].filter(Boolean).join(", ")}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FilterChip({ label, value, active, onClick, tone }: { label: string; value: number; active: boolean; onClick: () => void; tone: "primary" | "warning" | "muted" }) {
  const toneCls = tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-3 text-left transition-all ${active ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border bg-card hover:border-primary/40"}`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-0.5 ${toneCls}`}>{value}</div>
    </button>
  );
}
