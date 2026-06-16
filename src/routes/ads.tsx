import { createFileRoute } from "@tanstack/react-router";
import { AppShell, StatCard } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { brl } from "@/lib/format";
import { Megaphone, Target, ShoppingBag, DollarSign } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/ads")({
  head: () => ({ meta: [{ title: "Facebook Ads — LucroTrack" }] }),
  component: Page,
});

function Page() {
  const { state } = useStore();
  const ads = state.ads;
  const totals = ads.reduce(
    (a, x) => ({ inv: a.inv + x.invested, rev: a.rev + x.revenue, p: a.p + x.purchases }),
    { inv: 0, rev: 0, p: 0 },
  );
  const roas = totals.rev / Math.max(1, totals.inv);
  const cpa = totals.inv / Math.max(1, totals.p);

  const data = ads.map((a) => ({
    mes: new Date(a.date).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    Investido: a.invested,
    Faturamento: a.revenue,
  }));

  return (
    <AppShell title="Facebook Ads" subtitle="Performance dos seus anúncios">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="Investido" value={brl(totals.inv)} icon={Megaphone}/>
        <StatCard label="ROAS Médio" value={`${roas.toFixed(2)}x`} tone="success" icon={Target}/>
        <StatCard label="CPA Médio" value={brl(cpa)} icon={DollarSign}/>
        <StatCard label="Compras" value={String(totals.p)} icon={ShoppingBag} tone="success"/>
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
              </tr>
            </thead>
            <tbody>
              {ads.map((a) => {
                const r = a.revenue / Math.max(1, a.invested);
                const c = a.invested / Math.max(1, a.purchases);
                return (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-3 capitalize">{new Date(a.date).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</td>
                    <td className="px-4 py-3 text-right">{brl(a.invested)}</td>
                    <td className="px-4 py-3 text-right">{a.purchases}</td>
                    <td className="px-4 py-3 text-right text-primary font-medium">{brl(a.revenue)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{r.toFixed(2)}x</td>
                    <td className="px-4 py-3 text-right">{brl(c)}</td>
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
