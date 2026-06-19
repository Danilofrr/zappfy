import { createFileRoute } from "@tanstack/react-router";
import { AppShell, StatCard } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { brl } from "@/lib/format";
import { trafficStore, type TrafficEntry } from "@/lib/local-data";
import { Plus, Save, Trash2, Wallet, Users, ShoppingCart, Percent, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/indicadores")({
  head: () => ({ meta: [{ title: "Indicadores de Tráfego — ZappFy" }] }),
  component: Page,
});

function todayISO() {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function Page() {
  const { state } = useStore();
  const [list, setList] = useState<TrafficEntry[]>([]);
  const [form, setForm] = useState({
    date: todayISO(),
    budget: 0,
    leads: 0,
    orders: 0,
    products: 0,
    revenue: 0,
    autoOrders: true,
    autoRevenue: true,
  });

  useEffect(() => setList(trafficStore.list()), []);

  // Auto-fill from app orders on the selected date
  useEffect(() => {
    if (!form.autoOrders && !form.autoRevenue) return;
    const d = form.date;
    const dayOrders = state.orders.filter(
      (o) => o.status !== "cancelado" && (o.date ?? "").slice(0, 10) === d,
    );
    setForm((f) => ({
      ...f,
      orders: f.autoOrders ? dayOrders.length : f.orders,
      revenue: f.autoRevenue ? dayOrders.reduce((a, o) => a + o.total, 0) : f.revenue,
    }));
  }, [form.date, form.autoOrders, form.autoRevenue, state.orders]);

  const totals = list.reduce(
    (a, e) => ({
      budget: a.budget + e.budget,
      leads: a.leads + e.leads,
      orders: a.orders + e.orders,
      revenue: a.revenue + e.revenue,
    }),
    { budget: 0, leads: 0, orders: 0, revenue: 0 },
  );
  const cpv = totals.orders > 0 ? totals.budget / totals.orders : 0;
  const cpl = totals.leads > 0 ? totals.budget / totals.leads : 0;
  const taxa = totals.leads > 0 ? (totals.orders / totals.leads) * 100 : 0;
  const roas = totals.budget > 0 ? totals.revenue / totals.budget : 0;

  function save() {
    const entry: TrafficEntry = {
      id: crypto.randomUUID(),
      date: form.date,
      budget: Number(form.budget) || 0,
      leads: Number(form.leads) || 0,
      orders: Number(form.orders) || 0,
      products: Number(form.products) || 0,
      revenue: Number(form.revenue) || 0,
    };
    trafficStore.add(entry);
    setList(trafficStore.list());
    toast.success("Registro salvo");
    setForm((f) => ({ ...f, budget: 0, leads: 0, products: 0 }));
  }
  function remove(id: string) {
    trafficStore.remove(id);
    setList(trafficStore.list());
  }

  return (
    <AppShell title="Indicadores de Tráfego" subtitle="Métricas de performance e conversão">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 mb-6">
        <StatCard label="Orçamento" value={brl(totals.budget)} icon={Wallet} neon="245 158 11" />
        <StatCard label="Leads" value={String(totals.leads)} icon={Users} neon="59 130 246" />
        <StatCard label="Pedidos" value={String(totals.orders)} icon={ShoppingCart} neon="245 158 11" />
        <StatCard label="CPV" value={cpv > 0 ? brl(cpv) : "—"} hint="Custo por venda" icon={Target} neon="245 158 11" />
        <StatCard label="Custo/Lead" value={cpl > 0 ? brl(cpl) : "—"} icon={Target} neon="59 130 246" />
        <StatCard label="Taxa Conv." value={taxa > 0 ? `${taxa.toFixed(1)}%` : "—"} hint={`ROAS ${roas.toFixed(2)}x`} icon={Percent} neon="245 158 11" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Novo Registro</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Data">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
          </Field>
          <Field label="Orçamento (R$)" hint="Meta">
            <input type="number" min={0} step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} className="input" />
          </Field>
          <Field label="Leads">
            <input type="number" min={0} value={form.leads} onChange={(e) => setForm({ ...form, leads: Number(e.target.value) })} className="input" />
          </Field>
          <Field label="Produtos">
            <input type="number" min={0} value={form.products} onChange={(e) => setForm({ ...form, products: Number(e.target.value) })} className="input" />
          </Field>
          <Field label="Pedidos" hint={form.autoOrders ? "AUTO" : "manual"}>
            <input
              type="number"
              min={0}
              value={form.orders}
              onChange={(e) => setForm({ ...form, orders: Number(e.target.value), autoOrders: false })}
              className="input"
            />
          </Field>
          <Field label="Faturamento (R$)" hint={form.autoRevenue ? "AUTO" : "manual"}>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.revenue}
              onChange={(e) => setForm({ ...form, revenue: Number(e.target.value), autoRevenue: false })}
              className="input"
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            <Save className="h-4 w-4" /> Salvar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Histórico</h2>
        </div>
        {list.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Nenhum registro ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">Data</th>
                  <th className="text-right py-2 px-2">Orçamento</th>
                  <th className="text-right py-2 px-2">Leads</th>
                  <th className="text-right py-2 px-2">Pedidos</th>
                  <th className="text-right py-2 px-2">Faturamento</th>
                  <th className="text-right py-2 px-2">ROAS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="py-2 px-2">{new Date(e.date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                    <td className="py-2 px-2 text-right">{brl(e.budget)}</td>
                    <td className="py-2 px-2 text-right">{e.leads}</td>
                    <td className="py-2 px-2 text-right">{e.orders}</td>
                    <td className="py-2 px-2 text-right">{brl(e.revenue)}</td>
                    <td className="py-2 px-2 text-right">{e.budget > 0 ? (e.revenue / e.budget).toFixed(2) + "x" : "—"}</td>
                    <td className="py-2 px-2 text-right">
                      <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {hint && <span className="text-[10px] uppercase text-primary font-semibold">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
