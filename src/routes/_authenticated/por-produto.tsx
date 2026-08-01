import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, StatCard } from "@/components/AppShell";
import { useStore, monthRange } from "@/lib/store";
import { brl } from "@/lib/format";
import { Wallet, Boxes, BarChart3, CalendarDays, PackageSearch } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/por-produto")({
  head: () => ({
    meta: [
      { title: "Relatório por Produto — ZappFy" },
      { name: "description", content: "Veja quantas unidades cada produto vendeu por mês ou em período personalizado, com faturamento, custo, lucro e margem." },
      { property: "og:title", content: "Relatório por Produto — ZappFy" },
      { property: "og:description", content: "Unidades vendidas, faturamento e lucro por produto no período que você escolher." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Row = { name: string; qty: number; revenue: number; cost: number; profit: number; margin: number };
type PeriodKey = "mes" | "mes_passado" | "7d" | "30d" | "ano" | "tudo" | "custom";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "ano", label: "Este ano" },
  { key: "tudo", label: "Tudo" },
  { key: "custom", label: "Personalizado" },
];

function toDate(v: string, endOfDay = false) {
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Page() {
  const { state } = useStore();
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const [from, setFrom] = useState(() => ymd(monthRange().start));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [selected, setSelected] = useState<string | null>(null);

  const range = useMemo(() => {
    const now = new Date();
    if (period === "mes") return monthRange(now);
    if (period === "mes_passado") {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return monthRange(d);
    }
    if (period === "7d" || period === "30d") {
      const days = period === "7d" ? 7 : 30;
      const start = new Date(now);
      start.setDate(start.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);
      return { start, end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999) };
    }
    if (period === "ano") return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) };
    if (period === "custom") {
      const s = toDate(from) ?? new Date(2000, 0, 1);
      const e = toDate(to, true) ?? new Date();
      return { start: s, end: e };
    }
    return { start: new Date(2000, 0, 1), end: new Date(2999, 0, 1) };
  }, [period, from, to]);

  const orders = useMemo(
    () =>
      state.orders.filter((o) => {
        if (o.status === "cancelado") return false;
        const d = new Date(o.date);
        return d >= range.start && d <= range.end;
      }),
    [state.orders, range],
  );

  const rows = useMemo(() => {
    const map = new Map<string, Row>();
    orders.forEach((o) =>
      o.items.forEach((it) => {
        if ((it as any)?._orderMeta) return;
        const cur = map.get(it.name) ?? { name: it.name, qty: 0, revenue: 0, cost: 0, profit: 0, margin: 0 };
        cur.qty += Number(it.qty) || 0;
        cur.revenue += (Number(it.price) || 0) * (Number(it.qty) || 0);
        cur.cost += (Number(it.cost) || 0) * (Number(it.qty) || 0);
        cur.profit = cur.revenue - cur.cost;
        cur.margin = cur.revenue > 0 ? (cur.profit / cur.revenue) * 100 : 0;
        map.set(it.name, cur);
      }),
    );
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const totalRev = rows.reduce((a, r) => a + r.revenue, 0);
  const totalQty = rows.reduce((a, r) => a + r.qty, 0);
  const totalProfit = rows.reduce((a, r) => a + r.profit, 0);

  // Evolução mensal (12 meses) do produto selecionado — sempre sobre todos os pedidos
  const monthly = useMemo(() => {
    if (!selected) return [];
    const buckets: { mes: string; key: string; unidades: number; faturamento: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        unidades: 0,
        faturamento: 0,
      });
    }
    const index = new Map(buckets.map((b) => [b.key, b]));
    state.orders
      .filter((o) => o.status !== "cancelado")
      .forEach((o) => {
        const d = new Date(o.date);
        const b = index.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        if (!b) return;
        o.items.forEach((it) => {
          if (it.name !== selected) return;
          b.unidades += Number(it.qty) || 0;
          b.faturamento += (Number(it.price) || 0) * (Number(it.qty) || 0);
        });
      });
    return buckets;
  }, [selected, state.orders]);

  return (
    <AppShell title="Relatório por Produto" subtitle="Unidades vendidas, faturamento e lucro por período">
      {/* Filtro de período */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-5">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" /> Período
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                period === p.key ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background/40 hover:bg-secondary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">De</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Até</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
            </label>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Unidades Vendidas" value={String(totalQty)} hint={`${orders.length} pedidos`} icon={Boxes} neon="245 158 11" />
        <StatCard label="Total Faturado" value={brl(totalRev)} hint="no período" icon={Wallet} neon="245 158 11" />
        <StatCard label="Lucro Bruto" value={brl(totalProfit)} hint="faturamento - custo" icon={BarChart3} neon="34 197 94" />
        <StatCard label="Produtos Diferentes" value={String(rows.length)} hint="SKUs vendidos" icon={PackageSearch} neon="245 158 11" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Ranking de Produtos</h2>
          <span className="text-xs text-muted-foreground ml-auto hidden sm:block">Clique em um produto para ver a evolução mensal</span>
        </div>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">📈</div>
            <div className="font-medium">Nenhuma venda no período</div>
            <div className="text-sm">Ajuste o filtro acima ou registre uma venda.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Produto</th>
                  <th className="text-right py-2 px-2">Unidades</th>
                  <th className="text-right py-2 px-2">Faturamento</th>
                  <th className="text-right py-2 px-2">Custo</th>
                  <th className="text-right py-2 px-2">Lucro</th>
                  <th className="text-right py-2 px-2">Margem</th>
                  <th className="text-right py-2 px-2">Estoque</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const prod = state.products.find((p) => p.name === r.name);
                  return (
                    <tr
                      key={r.name}
                      onClick={() => setSelected(selected === r.name ? null : r.name)}
                      className={`border-b border-border/50 cursor-pointer hover:bg-secondary/40 ${selected === r.name ? "bg-secondary/50" : ""}`}
                    >
                      <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-2 font-medium">{r.name}</td>
                      <td className="py-2 px-2 text-right font-semibold">{r.qty}</td>
                      <td className="py-2 px-2 text-right">{brl(r.revenue)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{brl(r.cost)}</td>
                      <td className="py-2 px-2 text-right text-primary font-semibold">{brl(r.profit)}</td>
                      <td className="py-2 px-2 text-right">{r.margin.toFixed(1)}%</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{prod ? prod.stock : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="rounded-2xl border border-border bg-card p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Evolução mensal — {selected}</h2>
            <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground underline">
              Fechar
            </button>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid stroke="oklch(0.26 0 0)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" stroke="oklch(0.65 0.01 247)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.65 0.01 247)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "oklch(0.18 0 0)", border: "1px solid oklch(0.26 0 0)", borderRadius: 12 }}
                formatter={(v: number, n: string) => (n === "faturamento" ? brl(v) : `${v} un`)}
              />
              <Bar dataKey="unidades" fill="oklch(0.72 0.19 148)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {monthly.map((m) => (
              <div key={m.key} className="rounded-lg border border-border bg-background/40 p-2">
                <div className="uppercase text-muted-foreground">{m.mes}</div>
                <div className="font-semibold">{m.unidades} un</div>
                <div className="text-muted-foreground">{brl(m.faturamento)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
