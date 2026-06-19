import { createFileRoute } from "@tanstack/react-router";
import { AppShell, StatCard } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { brl } from "@/lib/format";
import { Wallet, Boxes, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/por-produto")({
  head: () => ({ meta: [{ title: "Relatório por Produto — ZappFy" }] }),
  component: Page,
});

type Row = { name: string; qty: number; revenue: number; cost: number; profit: number; margin: number };

function Page() {
  const { state } = useStore();

  const map = new Map<string, Row>();
  state.orders
    .filter((o) => o.status !== "cancelado")
    .forEach((o) =>
      o.items.forEach((it) => {
        const cur = map.get(it.name) ?? { name: it.name, qty: 0, revenue: 0, cost: 0, profit: 0, margin: 0 };
        cur.qty += it.qty;
        cur.revenue += it.price * it.qty;
        cur.cost += it.cost * it.qty;
        cur.profit = cur.revenue - cur.cost;
        cur.margin = cur.revenue > 0 ? (cur.profit / cur.revenue) * 100 : 0;
        map.set(it.name, cur);
      }),
    );

  const rows = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  const totalRev = rows.reduce((a, r) => a + r.revenue, 0);
  const totalSales = state.orders.filter((o) => o.status !== "cancelado").length;

  return (
    <AppShell title="Relatório por Produto" subtitle="Ranking de vendas e lucratividade">
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <StatCard label="Total Faturado" value={brl(totalRev)} hint={`${totalSales} vendas`} icon={Wallet} neon="245 158 11" />
        <StatCard label="Produtos Diferentes" value={String(rows.length)} hint="SKUs vendidos" icon={Boxes} neon="245 158 11" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Ranking de Produtos</h2>
        </div>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">📈</div>
            <div className="font-medium">Nenhuma venda registrada</div>
            <div className="text-sm">Registre sua primeira venda e comece a acompanhar o desempenho.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Produto</th>
                  <th className="text-right py-2 px-2">Qtd</th>
                  <th className="text-right py-2 px-2">Faturamento</th>
                  <th className="text-right py-2 px-2">Custo</th>
                  <th className="text-right py-2 px-2">Lucro</th>
                  <th className="text-right py-2 px-2">Margem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.name} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-2 font-medium">{r.name}</td>
                    <td className="py-2 px-2 text-right">{r.qty}</td>
                    <td className="py-2 px-2 text-right">{brl(r.revenue)}</td>
                    <td className="py-2 px-2 text-right text-muted-foreground">{brl(r.cost)}</td>
                    <td className="py-2 px-2 text-right text-primary font-semibold">{brl(r.profit)}</td>
                    <td className="py-2 px-2 text-right">{r.margin.toFixed(1)}%</td>
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
