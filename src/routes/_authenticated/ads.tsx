import { createFileRoute } from "@tanstack/react-router";
import { AppShell, StatCard } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { brl, dateInputToLocalISO, dateOnlyToLocalDate, fmtBusinessDate, todayDateInput } from "@/lib/format";
import { Megaphone, Target, ShoppingBag, DollarSign, Plus, Trash2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ads")({
  head: () => ({ meta: [{ title: "Facebook Ads — ZappFy" }] }),
  component: Page,
});

function Page() {
  const { state, addAd, deleteAd } = useStore();
  const rawAds = state.ads;

  // Calcula pedidos válidos (não cancelados) agrupados por dia (YYYY-MM-DD)
  // para refletir, em tempo real, o que aparece na Dashboard.
  const ordersByDay = (() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const o of state.orders) {
      const status = String(o.status ?? "").toLowerCase();
      if (status === "cancelado" || status === "cancelada") continue;
      const d = o.date ? new Date(o.date) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const cur = map.get(key) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(o.total) || 0;
      map.set(key, cur);
    }
    return map;
  })();

  function dayKey(dateStr: string) {
    const d = dateOnlyToLocalDate(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Sobrescreve purchases/revenue de cada gasto com os pedidos reais do dia,
  // garantindo bater com a Dashboard e atualizar quando um novo pedido entra.
  const ads = rawAds.map((a) => {
    const day = ordersByDay.get(dayKey(a.date));
    return {
      ...a,
      purchases: day?.count ?? 0,
      revenue: day?.revenue ?? 0,
    };
  });

  const totals = ads.reduce(
    (a, x) => ({ inv: a.inv + x.invested, rev: a.rev + x.revenue, p: a.p + x.purchases }),
    { inv: 0, rev: 0, p: 0 },
  );
  const roas = totals.rev / Math.max(1, totals.inv);
  const cpa = totals.inv / Math.max(1, totals.p);

  const data = ads.map((a) => ({
    mes: dateOnlyToLocalDate(a.date).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    Investido: a.invested,
    Faturamento: a.revenue,
  }));

  const [form, setForm] = useState({
    date: todayDateInput(),
    invested: "",
    purchases: "",
    revenue: "",
  });

  async function save() {
    const invested = Number(form.invested);
    if (!form.date || !invested) { toast.error("Informe a data e o valor investido"); return; }
    await addAd({
      date: dateInputToLocalISO(form.date),
      invested,
      purchases: Number(form.purchases) || 0,
      revenue: Number(form.revenue) || 0,
    });
    toast.success("Gasto de Ads adicionado");
    setForm({ date: todayDateInput(), invested: "", purchases: "", revenue: "" });
  }

  return (
    <AppShell title="Facebook Ads" subtitle="Performance dos seus anúncios">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="Investido" value={brl(totals.inv)} icon={Megaphone} neon="167 139 250"/>
        <StatCard label="ROAS Médio" value={`${roas.toFixed(2)}x`} tone="success" icon={Target} neon="56 189 248"/>
        <StatCard label="CPA Médio" value={brl(cpa)} icon={DollarSign} neon="251 191 36"/>
        <StatCard label="Compras" value={String(totals.p)} icon={ShoppingBag} tone="success" neon="236 72 153"/>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-elegant">
        <div className="text-sm font-semibold mb-3">Adicionar gasto de Ads manualmente</div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="grid gap-1.5">
            <Label className="text-xs">Data</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Investido (R$)</Label>
            <Input type="number" step="0.01" value={form.invested} onChange={(e) => setForm({ ...form, invested: e.target.value })} placeholder="0,00" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Compras</Label>
            <Input type="number" value={form.purchases} onChange={(e) => setForm({ ...form, purchases: e.target.value })} placeholder="0" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Faturamento gerado (R$)</Label>
            <Input type="number" step="0.01" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} placeholder="0,00" />
          </div>
          <Button onClick={save}><Plus className="mr-2 h-4 w-4"/>Adicionar</Button>
        </div>
      </div>


      <div className="mt-6 rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-elegant">
        <div className="text-sm font-semibold mb-4">Investimento x Faturamento gerado</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="oklch(0.26 0 0)" strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="mes" stroke="oklch(0.65 0.01 247)" fontSize={12} tickLine={false} axisLine={false}/>
              <YAxis stroke="oklch(0.65 0.01 247)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v/1000}k`}/>
              <Tooltip
                contentStyle={{ backgroundColor: "oklch(0.18 0 0)", border: "1px solid oklch(0.26 0 0)", borderRadius: 12 }}
                formatter={(v: number) => brl(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Bar dataKey="Investido" fill="oklch(0.65 0.24 27)" radius={[6,6,0,0]}/>
              <Bar dataKey="Faturamento" fill="oklch(0.72 0.19 148)" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-elegant">
        <div className="text-sm font-semibold mb-4">Histórico por mês</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left px-4 py-3">Mês</th>
                <th className="text-right px-4 py-3">Investido</th>
                <th className="text-right px-4 py-3">Compras</th>
                <th className="text-right px-4 py-3">Faturamento</th>
                <th className="text-right px-4 py-3">ROAS</th>
                <th className="text-right px-4 py-3">CPA</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {ads.map((a) => {
                const r = a.revenue / Math.max(1, a.invested);
                const c = a.invested / Math.max(1, a.purchases);
                return (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-3 capitalize">{fmtBusinessDate(a.date)}</td>
                    <td className="px-4 py-3 text-right">{brl(a.invested)}</td>
                    <td className="px-4 py-3 text-right">{a.purchases}</td>
                    <td className="px-4 py-3 text-right text-primary font-medium">{brl(a.revenue)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{r.toFixed(2)}x</td>
                    <td className="px-4 py-3 text-right">{brl(c)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteAd(a.id)}><Trash2 className="h-4 w-4"/></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
