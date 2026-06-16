import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, monthRange } from "@/lib/store";
import { brl } from "@/lib/format";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — LucroTrack" }] }),
  component: Page,
});

const COLORS = ["oklch(0.72 0.19 148)", "oklch(0.985 0.003 247)", "oklch(0.82 0.17 85)", "oklch(0.65 0.24 27)", "oklch(0.62 0.18 148)", "oklch(0.82 0.18 148)"];

function Page() {
  const { state } = useStore();

  // 6 month revenue/profit
  const months = Array.from({ length: 6 }).map((_, idx) => {
    const i = 5 - idx;
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const { start, end } = monthRange(d);
    const orders = state.orders.filter((o) => new Date(o.date) >= start && new Date(o.date) < end && o.status !== "cancelado");
    const rev = orders.reduce((a, o) => a + o.total, 0);
    const cogs = orders.reduce((a, o) => a + o.items.reduce((b, it) => b + it.cost * it.qty, 0), 0);
    const exps = state.expenses.filter((e) => new Date(e.date) >= start && new Date(e.date) < end).reduce((a, e) => a + e.amount, 0);
    return { mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), Faturamento: rev, Lucro: rev - cogs - exps };
  });

  // Top products
  const productMap = new Map<string, number>();
  state.orders.filter((o) => o.status !== "cancelado").forEach((o) => o.items.forEach((it) => productMap.set(it.name, (productMap.get(it.name) ?? 0) + it.qty)));
  const topProducts = [...productMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, qty]) => ({ name, qty }));

  // Expenses by category
  const catMap = new Map<string, number>();
  state.expenses.forEach((e) => catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount));
  const expCats = [...catMap.entries()].map(([name, value]) => ({ name, value }));

  // Orders by status
  const statusMap = new Map<string, number>();
  state.orders.forEach((o) => statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1));
  const statusArr = [...statusMap.entries()].map(([name, value]) => ({ name, value }));

  // Cash evolution
  const evo: { mes: string; saldo: number }[] = [];
  let running = 0;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const { start, end } = monthRange(d);
    const rev = state.orders.filter((o) => o.status !== "cancelado" && o.status !== "aguardando" && new Date(o.date) >= start && new Date(o.date) < end).reduce((a, o) => a + o.total, 0);
    const cogs = state.orders.filter((o) => o.status !== "cancelado" && o.status !== "aguardando" && new Date(o.date) >= start && new Date(o.date) < end).reduce((a, o) => a + o.items.reduce((b, it) => b + it.cost * it.qty, 0), 0);
    const exps = state.expenses.filter((e) => new Date(e.date) >= start && new Date(e.date) < end).reduce((a, e) => a + e.amount, 0);
    running += rev - cogs - exps;
    evo.push({ mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), saldo: running });
  }

  const goalRev = state.settings.monthlyRevenueGoal;
  const currentRev = months[months.length - 1].Faturamento;

  return (
    <AppShell title="Relatórios" subtitle="Visão geral do desempenho">
      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Faturamento x Lucro (6 meses)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={months}>
              <CartesianGrid stroke="oklch(0.26 0 0)" strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="mes" stroke="oklch(0.65 0.01 247)" fontSize={12} tickLine={false} axisLine={false}/>
              <YAxis stroke="oklch(0.65 0.01 247)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v/1000}k`}/>
              <Tooltip contentStyle={{ backgroundColor: "oklch(0.18 0 0)", border: "1px solid oklch(0.26 0 0)", borderRadius: 12 }} formatter={(v: number) => brl(v)}/>
              <Bar dataKey="Faturamento" fill="oklch(0.985 0.003 247)" radius={[6,6,0,0]}/>
              <Bar dataKey="Lucro" fill="oklch(0.72 0.19 148)" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Produtos mais vendidos">
          <div className="space-y-2">
            {topProducts.map((p, i) => {
              const max = topProducts[0].qty;
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate pr-2">{p.name}</span>
                    <span className="text-muted-foreground">{p.qty} un</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${(p.qty / max) * 100}%` }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Despesas por categoria">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={expCats} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                {expCats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "oklch(0.18 0 0)", border: "1px solid oklch(0.26 0 0)", borderRadius: 12 }} formatter={(v: number) => brl(v)}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            {expCats.map((c, i) => (
              <span key={c.name} className="inline-flex items-center gap-1.5 capitalize">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }}/>{c.name}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Pedidos por status">
          <div className="grid grid-cols-2 gap-3">
            {statusArr.map((s, i) => (
              <div key={s.name} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">{s.name}</div>
                <div className="text-2xl font-bold mt-0.5" style={{ color: COLORS[i % COLORS.length] }}>{s.value}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Evolução do caixa">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evo}>
              <CartesianGrid stroke="oklch(0.26 0 0)" strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="mes" stroke="oklch(0.65 0.01 247)" fontSize={12} tickLine={false} axisLine={false}/>
              <YAxis stroke="oklch(0.65 0.01 247)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v/1000}k`}/>
              <Tooltip contentStyle={{ backgroundColor: "oklch(0.18 0 0)", border: "1px solid oklch(0.26 0 0)", borderRadius: 12 }} formatter={(v: number) => brl(v)}/>
              <Line type="monotone" dataKey="saldo" stroke="oklch(0.72 0.19 148)" strokeWidth={2.5} dot={{ r: 3 }}/>
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Meta x Resultado (mês atual)">
          <div className="text-sm text-muted-foreground">Meta de faturamento</div>
          <div className="text-2xl font-bold">{brl(goalRev)}</div>
          <div className="mt-3 h-3 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, (currentRev / goalRev) * 100)}%` }}/>
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-muted-foreground">Atingido</span>
            <span className="text-primary font-semibold">{brl(currentRev)} ({((currentRev/goalRev)*100).toFixed(0)}%)</span>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-elegant">
      <div className="text-sm font-semibold mb-4">{title}</div>
      {children}
    </div>
  );
}
