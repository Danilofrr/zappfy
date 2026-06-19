import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { brl, dateOnlyToLocalDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dre")({
  head: () => ({ meta: [{ title: "DRE — ZappFy" }] }),
  component: DREPage,
});

function monthLabel(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function DREPage() {
  const { state } = useStore();
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);

  const ref = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);

  const dre = useMemo(() => computeDRE(state, start, end), [state, start.getTime(), end.getTime()]);

  // Evolução: últimos 6 meses
  const evolution = useMemo(() => {
    const arr: { mes: string; receita: number; lucro: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const r = new Date(now.getFullYear(), now.getMonth() + monthOffset - i, 1);
      const s = new Date(r.getFullYear(), r.getMonth(), 1);
      const e = new Date(r.getFullYear(), r.getMonth() + 1, 1);
      const d = computeDRE(state, s, e);
      arr.push({ mes: monthLabel(r), receita: d.receita, lucro: d.resultadoFinal });
    }
    return arr;
  }, [state, monthOffset]);

  function exportPDF() {
    window.print();
  }

  const pct = (v: number, base: number) => (base > 0 ? `${((v / base) * 100).toFixed(1)}%` : "—");

  return (
    <AppShell
      title={`DRE — ${ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
      subtitle="Demonstrativo de Resultado do Exercício"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonthOffset((v) => v - 1)}>‹ Anterior</Button>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(0)} disabled={monthOffset === 0}>Hoje</Button>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset((v) => v + 1)} disabled={monthOffset >= 0}>Próximo ›</Button>
          <Button size="sm" onClick={exportPDF}><Download className="h-4 w-4 mr-1" />PDF</Button>
        </div>
      }
    >
      {/* Cards de topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="Resultado Final" value={brl(dre.resultadoFinal)} hint="Após gastos pessoais" tone={dre.resultadoFinal >= 0 ? "good" : "bad"} neon="56 189 248" />
        <KPI label="Margem Líquida" value={pct(dre.lucroOperacional, dre.receita)} hint="EBITDA / receita" neon="167 139 250" />
        <KPI label="Margem Bruta" value={pct(dre.lucroBruto, dre.receita)} hint="Lucro bruto / receita" neon="251 191 36" />
        <KPI label="Receita Bruta" value={brl(dre.receita)} hint="Faturamento" neon="236 72 153" />
      </div>

      {/* Demonstrativo */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-elegant mb-5">
        <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">Demonstrativo Completo</h3>
        <div className="space-y-1">
          <Row label="Faturamento Bruto" value={dre.receita} bold />
          <Row label="(−) Custo das Mercadorias (CMV)" value={-dre.cmv} sub />
          <Row label="= LUCRO BRUTO" value={dre.lucroBruto} bold highlight />
          <Row label={`(−) Impostos (${(dre.taxRate * 100).toFixed(0)}%)`} value={-dre.impostos} sub />
          <Row label="(−) Tráfego Pago" value={-dre.trafego} sub />
          <Row label="(−) Operacional (entregas + despesas fixas)" value={-dre.operacional} sub />
          <Row label="= LUCRO OPERACIONAL (EBITDA)" value={dre.lucroOperacional} bold highlight />
          <Row label="(−) Gastos Pessoais / Pró-labore" value={-dre.proLabore} sub />
          <Row label="= RESULTADO FINAL" value={dre.resultadoFinal} bold highlight />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Composição dos gastos */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-elegant">
          <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">Composição dos Gastos</h3>
          <CompRow label="CMV (Compras/Forn.)" value={dre.cmv} total={dre.totalGastos} color="bg-amber-500" />
          <CompRow label="Tráfego Pago" value={dre.trafego} total={dre.totalGastos} color="bg-rose-500" />
          <CompRow label="Operacional" value={dre.operacional} total={dre.totalGastos} color="bg-sky-500" />
          <CompRow label="Impostos" value={dre.impostos} total={dre.totalGastos} color="bg-violet-500" />
          <CompRow label="Pró-labore" value={dre.proLabore} total={dre.totalGastos} color="bg-emerald-500" />
        </div>

        {/* Evolução mensal */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-elegant">
          <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">Evolução Mensal</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolution}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--chart-2, 142 76% 45%))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function computeDRE(state: any, start: Date, end: Date) {
  const inRange = (iso: string) => {
    const d = new Date(iso);
    return d >= start && d < end;
  };
  const inRangeDateOnly = (s: string) => {
    const d = dateOnlyToLocalDate(s);
    return d >= start && d < end;
  };

  const orders = state.orders.filter((o: any) => inRange(o.date) && o.status !== "cancelado");
  const receita = orders.reduce((s: number, o: any) => s + (o.total ?? 0), 0);
  const cmv = orders.reduce(
    (s: number, o: any) => s + o.items.reduce((ss: number, it: any) => ss + (it.cost ?? 0) * it.qty, 0),
    0,
  );

  const expenses = state.expenses.filter((e: any) => inRangeDateOnly(e.date));
  const trafego = expenses.filter((e: any) => e.category === "ads").reduce((s: number, e: any) => s + e.amount, 0);
  const proLabore = expenses.filter((e: any) => e.category === "prolabore" || e.category === "pro-labore").reduce((s: number, e: any) => s + e.amount, 0);
  const motoboy = expenses.filter((e: any) => e.category === "motoboy" || e.category === "entrega").reduce((s: number, e: any) => s + e.amount, 0);
  const outros = expenses
    .filter((e: any) => !["ads", "prolabore", "pro-labore", "motoboy", "entrega"].includes(e.category))
    .reduce((s: number, e: any) => s + e.amount, 0);
  const operacional = motoboy + outros;

  const taxRate = state.settings?.taxRate ?? 0;
  const impostos = receita * taxRate;

  const lucroBruto = receita - cmv;
  const lucroOperacional = lucroBruto - impostos - trafego - operacional;
  const resultadoFinal = lucroOperacional - proLabore;
  const totalGastos = cmv + trafego + operacional + impostos + proLabore;

  return { receita, cmv, lucroBruto, impostos, trafego, operacional, lucroOperacional, proLabore, resultadoFinal, totalGastos, taxRate };
}

function KPI({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-elegant">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone === "good" ? "text-primary" : tone === "bad" ? "text-destructive" : ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Row({ label, value, bold, sub, highlight }: { label: string; value: number; bold?: boolean; sub?: boolean; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${highlight ? "bg-secondary/40 px-3 rounded-lg my-1" : sub ? "pl-4" : ""} ${
        bold ? "font-semibold" : "text-sm"
      }`}
    >
      <span className={sub ? "text-muted-foreground text-sm" : ""}>{label}</span>
      <span className={value < 0 ? "text-destructive" : value > 0 && bold ? "text-primary" : ""}>{brl(value)}</span>
    </div>
  );
}

function CompRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const p = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{brl(value)} <span className="text-muted-foreground">({p.toFixed(0)}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
