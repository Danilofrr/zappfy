import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, StatCard } from "@/components/AppShell";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { useFinance, useStore, monthRange } from "@/lib/store";
import { brl, dateOnlyToLocalDate, pct } from "@/lib/format";
import { useMemo, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingCart,
  Target,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  Receipt,
  CheckCircle2,
  Circle,
  LineChart as LineChartIcon,
  Megaphone,
  BarChart3,
  Trophy,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrivacy, mask } from "@/hooks/use-privacy";


import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: ({ context }) => {
    if ((context as any).isAdmin) throw redirect({ to: "/admin" });
  },
  head: () => ({
    meta: [
      { title: "Dashboard — ZappFy" },
      { name: "description", content: "Veja o lucro real do seu negócio em segundos." },
    ],
  }),
  component: Dashboard,
});

type Period = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

function rangeFor(period: Period, customStart?: string, customEnd?: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  if (period === "today") {
    const s = startOfDay(now); const e = new Date(s); e.setDate(e.getDate()+1);
    return { start: s, end: e, label: "hoje" };
  }
  if (period === "yesterday") {
    const e = startOfDay(now); const s = new Date(e); s.setDate(s.getDate()-1);
    return { start: s, end: e, label: "ontem" };
  }
  if (period === "7d") {
    const e = startOfDay(now); e.setDate(e.getDate()+1);
    const s = new Date(e); s.setDate(s.getDate()-7);
    return { start: s, end: e, label: "últimos 7 dias" };
  }
  if (period === "30d") {
    const e = startOfDay(now); e.setDate(e.getDate()+1);
    const s = new Date(e); s.setDate(s.getDate()-30);
    return { start: s, end: e, label: "últimos 30 dias" };
  }
  if (period === "custom" && customStart && customEnd) {
    const s = startOfDay(dateOnlyToLocalDate(customStart));
    const e = startOfDay(dateOnlyToLocalDate(customEnd)); e.setDate(e.getDate()+1);
    return { start: s, end: e, label: "período personalizado" };
  }
  const m = monthRange(); return { start: m.start, end: m.end, label: "este mês" };
}

function Dashboard() {
  const { state } = useStore();
  const { on: privacy } = usePrivacy();
  const m = (v: string) => mask(v, privacy);
  const [period, setPeriod] = useState<Period>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const range = useMemo(() => rangeFor(period, customStart, customEnd), [period, customStart, customEnd]);
  const fin = useFinance({ start: range.start, end: range.end });
  const goalRev = state.settings.monthlyRevenueGoal;
  const goalPct = goalRev ? Math.min(100, (fin.revenue / goalRev) * 100) : 0;

  // Build 6-month series
  const series = Array.from({ length: 6 }).map((_, idx) => {
    const i = 5 - idx;
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const { start, end } = monthRange(d);
    const orders = state.orders.filter(
      (o) => new Date(o.date) >= start && new Date(o.date) < end && o.status !== "cancelado",
    );
    const rev = orders.reduce((a, o) => a + o.total, 0);
    const cogs = orders.reduce((a, o) => a + o.items.reduce((b, it) => b + it.cost * it.qty, 0), 0);
    const exps = state.expenses
      .filter((e) => dateOnlyToLocalDate(e.date) >= start && dateOnlyToLocalDate(e.date) < end)
      .reduce((a, e) => a + e.amount, 0);
    return {
      mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      faturamento: rev,
      lucro: rev - cogs - exps,
    };
  });

  // Ads metrics dentro do período selecionado (combina entradas em /ads + despesas categoria "ads")
  const adsInRange = state.ads.filter((a) => {
    const d = dateOnlyToLocalDate(a.date);
    return d >= range.start && d < range.end;
  });
  const adsEntryInvested = adsInRange.reduce((a, x) => a + x.invested, 0);
  const adsEntryPurchases = adsInRange.reduce((a, x) => a + x.purchases, 0);
  const adsEntryRevenue = adsInRange.reduce((a, x) => a + x.revenue, 0);
  // adsSpend (do useFinance) já vem das despesas categoria "ads" no período
  const adsInvested = adsEntryInvested + fin.adsSpend;
  const adsPurchases = adsEntryPurchases > 0 ? adsEntryPurchases : fin.ordersCount;
  const adsRevenue = adsEntryRevenue > 0 ? adsEntryRevenue : fin.revenue;
  const adsRoas = adsInvested > 0 ? adsRevenue / adsInvested : 0;
  const adsCpa = adsPurchases > 0 ? adsInvested / adsPurchases : 0;

  const periodBtns: { id: Period; label: string }[] = [
    { id: "today", label: "Hoje" },
    { id: "yesterday", label: "Ontem" },
    { id: "7d", label: "7 dias" },
    { id: "30d", label: "30 dias" },
    { id: "month", label: "Mês" },
    { id: "custom", label: "Personalizado" },
  ];

  return (
    <AppShell title="Dashboard" subtitle={`Saúde financeira — ${range.label}`}>
      <DashboardTopBar subtitle="Principal" />
      {/* Period filter */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-3 lg:p-4 shadow-elegant">
        <div className="flex flex-wrap items-center gap-2">
          {periodBtns.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={period === p.id ? "default" : "outline"}
              onClick={() => setPeriod(p.id)}
            >{p.label}</Button>
          ))}
          {period === "custom" && (
            <div className="flex items-center gap-2 ml-auto">
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-9 w-auto" />
              <span className="text-xs text-muted-foreground">até</span>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-9 w-auto" />
            </div>
          )}
        </div>
      </div>

      {/* Onboarding checklist — visível até o usuário concluir todos os passos */}
      {(() => {
        const steps = [
          { key: "product", label: "Cadastrar produto", desc: "Adicione seus produtos no estoque", to: "/produtos", icon: Package, done: state.products.length > 0 },
          { key: "order", label: "Primeira venda", desc: "Lance sua primeira venda no sistema", to: "/pedidos", icon: ShoppingCart, done: state.orders.length > 0 },
          { key: "expense", label: "Primeiro gasto", desc: "Categorize seus gastos fixos e variáveis", to: "/financeiro", icon: Receipt, done: state.expenses.length > 0 },
          { key: "goal", label: "Definir metas", desc: "Configure suas metas de faturamento", to: "/configuracoes", icon: Target, done: (state.settings.monthlyRevenueGoal ?? 0) > 0 },
        ];
        const completed = steps.filter((s) => s.done).length;
        if (completed === steps.length) return null;
        const progress = Math.round((completed / steps.length) * 100);
        return (
          <div className="mb-5 rounded-2xl border border-border bg-card p-4 lg:p-5 shadow-elegant">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Configure seu sistema
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{completed} de {steps.length} passos concluídos</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block w-32 h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-sm font-semibold text-primary">{progress}%</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {steps.map((s) => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.key}
                    to={s.to}
                    className={`group rounded-xl border p-3 transition ${s.done ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/60"}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className={`h-9 w-9 rounded-lg grid place-items-center ${s.done ? "bg-primary/20 text-primary" : "bg-background text-muted-foreground"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {s.done ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className={`text-sm font-medium ${s.done ? "line-through text-muted-foreground" : ""}`}>{s.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.desc}</div>
                    {!s.done && (
                      <div className="mt-2 text-xs font-medium text-primary group-hover:underline">Ir agora →</div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">

        <StatCard label="Faturamento" value={m(brl(fin.revenue))} hint={range.label} icon={DollarSign} />
        <StatCard label="Lucro Líquido" value={m(brl(fin.profit))} hint={range.label} icon={TrendingUp} tone="success" />
        <StatCard label="Total Gastos" value={m(brl(fin.cogs + fin.adsSpend + fin.opEx + fin.motoboyCost))} hint={range.label} icon={TrendingDown} tone="danger" />
        <StatCard label="Saldo em Caixa" value={m(brl(fin.cash))} hint="acumulado" icon={Wallet} />
        <StatCard label="Pedidos" value={String(fin.ordersCount)} hint={range.label} icon={ShoppingCart} />
        <StatCard label="Meta" value={pct(goalPct)} hint={m(brl(goalRev))} icon={Target} tone="warning" />
      </div>


      {/* Lucro real card */}
      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
              </span>
              Lucro Real do Mês
            </span>
            <span className="rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2.5 py-1">Indicador principal</span>
          </div>
          <div className="text-4xl lg:text-5xl font-bold text-primary tracking-tight">{m(brl(fin.profit))}</div>

          <div className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Row label="Faturamento Total" value={m(brl(fin.revenue))} positive />
            <Row label="(-) Custos dos Produtos" value={`- ${m(brl(fin.cogs))}`} />
            <Row label="(-) Facebook Ads" value={`- ${m(brl(fin.adsSpend))}`} />
            <Row label="(-) Despesas Operacionais" value={`- ${m(brl(fin.opEx))}`} />
            <Row label={`(-) Taxa Motoboy (${fin.ordersCount} ped.)`} value={`- ${m(brl(fin.motoboyCost))}`} />
            <div className="sm:col-span-2 border-t border-border pt-3 flex items-center justify-between">
              <span className="font-semibold">(=) Lucro Líquido</span>
              <span className="text-primary font-bold text-lg">{m(brl(fin.profit))}</span>
            </div>
          </div>
        </div>

        {/* Ads card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <Megaphone className="h-3.5 w-3.5 text-primary" />
              </span>
              Facebook Ads
            </span>
            <Link to="/ads" className="text-xs text-primary hover:underline">Ver detalhes</Link>
          </div>
          <div className="text-2xl font-bold">{m(brl(adsInvested))}</div>
          <div className="text-xs text-muted-foreground">Investido — {range.label}</div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Mini label="ROAS" value={`${adsRoas.toFixed(2)}x`} />
            <Mini label="CPA" value={m(brl(adsCpa))} />
            <Mini label="Compras" value={String(adsPurchases)} />
            <Mini label="Faturamento" value={m(brl(adsRevenue))} />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-elegant">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <LineChartIcon className="h-4 w-4 text-primary" />
            </span>
            <div>
              <div className="text-sm font-semibold">Faturamento x Lucro</div>
              <div className="text-xs text-muted-foreground">Últimos 6 meses</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-2"><span className="h-2 w-3 rounded-sm bg-foreground"/>Faturamento</span>
            <span className="flex items-center gap-2"><span className="h-2 w-3 rounded-sm bg-primary"/>Lucro</span>
          </div>
        </div>
        <div className="h-64 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="oklch(0.26 0 0)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" stroke="oklch(0.65 0.01 247)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.65 0.01 247)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v/1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "oklch(0.18 0 0)", border: "1px solid oklch(0.26 0 0)", borderRadius: 12 }}
                labelStyle={{ color: "oklch(0.985 0.003 247)" }}
                formatter={(v: number) => brl(v)}
              />
              <Line type="monotone" dataKey="faturamento" stroke="oklch(0.985 0.003 247)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="lucro" stroke="oklch(0.72 0.19 148)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent orders */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-elegant">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">Últimos pedidos</div>
          <Link to="/pedidos" className="text-xs text-primary hover:underline">Ver todos</Link>
        </div>
        <div className="space-y-2">
          {state.orders.slice(0, 6).map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5">
              <div className="min-w-0">
                <div className="font-medium truncate">{o.customer}</div>
                <div className="text-xs text-muted-foreground truncate">{o.items[0]?.name} · {o.district}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold">{m(brl(o.total))}</div>
                <div className="text-[11px] text-muted-foreground capitalize">{o.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {positive ? <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 border border-border p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}
