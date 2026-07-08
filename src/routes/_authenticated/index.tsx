import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, StatCard } from "@/components/AppShell";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { useFinance, useStore, monthRange } from "@/lib/store";
import { brl, dateOnlyToLocalDate, pct } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  RefreshCw,
  Clock,
  CreditCard,
} from "lucide-react";

import { useServerFn } from "@tanstack/react-start";
import { syncFacebookAds } from "@/lib/integrations.functions";
import { toast } from "sonner";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrivacy, mask } from "@/hooks/use-privacy";
import { useFbShowSpend } from "@/hooks/use-fb-show-spend";


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

  const [showFbSpend] = useFbShowSpend();

  // Sync manual do Meta Ads

  const syncAds = useServerFn(syncFacebookAds);
  const [syncingAds, setSyncingAds] = useState(false);
  async function handleSyncAds() {
    if (syncingAds) return;
    setSyncingAds(true);
    try {
      const r = await syncAds({ data: { days: 30 } });
      toast.success(`Sincronizado (${r?.imported ?? 0} dias)`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao sincronizar");
    } finally {
      setSyncingAds(false);
    }
  }


  // Champion product of the current month
  const champion = useMemo(() => {
    const { start, end } = monthRange();
    const monthOrders = state.orders.filter(
      (o) => new Date(o.date) >= start && new Date(o.date) < end && o.status !== "cancelado",
    );
    const agg = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
    let totalRevenue = 0;
    for (const o of monthOrders) {
      for (const it of o.items) {
        const cur = agg.get(it.productId) ?? { name: it.name, qty: 0, revenue: 0, profit: 0 };
        cur.qty += it.qty;
        cur.revenue += it.price * it.qty;
        cur.profit += (it.price - it.cost) * it.qty;
        agg.set(it.productId, cur);
        totalRevenue += it.price * it.qty;
      }
    }
    let bestId: string | null = null;
    let best: { name: string; qty: number; revenue: number; profit: number } | null = null;
    for (const [id, v] of agg) {
      if (!best || v.qty > best.qty || (v.qty === best.qty && v.revenue > best.revenue)) {
        best = v;
        bestId = id;
      }
    }
    if (!best || !bestId) return null;
    const product = state.products.find((p) => p.id === bestId);
    const share = totalRevenue > 0 ? (best.revenue / totalRevenue) * 100 : 0;
    return { ...best, imageUrl: product?.imageUrl, share };
  }, [state.orders, state.products]);


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

  // Ads metrics dentro do período selecionado. Se existir dado na aba Meta Ads,
  // ela é a fonte oficial do card para bater com o Gerenciador de Anúncios.
  const adsInRange = state.ads.filter((a) => {
    const d = dateOnlyToLocalDate(a.date);
    return d >= range.start && d < range.end;
  });
  const adsEntryInvested = adsInRange.reduce((a, x) => a + x.invested, 0);
  const hasAdsEntriesInRange = adsInRange.length > 0;
  const adsInvested = hasAdsEntriesInRange ? adsEntryInvested : fin.adsSpend;
  // Compras e faturamento do card devem bater exatamente com a Dashboard.
  // O Meta Ads fornece apenas o investimento; vendas entram pelos pedidos reais do período.
  const adsPurchases = fin.ordersCount;
  const adsRevenue = fin.revenue;
  const adsRoas = adsInvested > 0 ? adsRevenue / adsInvested : 0;
  const adsCpa = adsPurchases > 0 ? adsInvested / adsPurchases : 0;
  const adsTaxPct = Number(state.settings.adsTaxPct ?? 0);
  const adsTaxValue = adsInvested * (adsTaxPct / 100);
  const adsTotalCost = adsInvested + adsTaxValue;

  // Perdas em trocas/devoluções (status = "perdido") dentro do período
  const [returnsLost, setReturnsLost] = useState<Array<{ value_at_risk: number; return_date: string }>>([]);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await (supabase.from("returns" as any) as any)
        .select("value_at_risk, return_date, status")
        .in("status", ["perdido", "devolvido_estoque"]);
      if (!cancel && data) setReturnsLost(data as any);
    })();
    return () => { cancel = true; };
  }, []);
  const returnsLossInRange = useMemo(() => {
    return returnsLost.reduce((sum, r) => {
      const d = new Date(r.return_date);
      if (d >= range.start && d < range.end) return sum + Number(r.value_at_risk || 0);
      return sum;
    }, 0);
  }, [returnsLost, range.start, range.end]);

  // Descontos da taxa da maquininha (cartão) — apenas quando a loja ABSORVE a taxa.
  // Se a taxa é repassada ao cliente, ela não é custo da loja e não deve abater o lucro.
  const cardFeeCost = useMemo(() => {
    const re = /Taxa\s+[\d.,]+%\s*\(R\$\s*([\d.,]+)\)\s*[—-]\s*absorvida/i;
    return state.orders.reduce((sum, o) => {
      if (o.status === "cancelado") return sum;
      if (o.payment !== "cartao") return sum;
      const d = new Date(o.date);
      if (d < range.start || d >= range.end) return sum;
      const mm = re.exec(o.notes || "");
      if (!mm) return sum;
      const raw = mm[1].replace(/\./g, "").replace(",", ".");
      const v = Number(raw);
      return sum + (isFinite(v) ? v : 0);
    }, 0);
  }, [state.orders, range.start, range.end]);

  // Pedidos válidos no período (para insights extras)
  const ordersInRange = useMemo(() => {
    return state.orders.filter((o) => {
      if (o.status === "cancelado") return false;
      const d = new Date(o.date);
      return d >= range.start && d < range.end;
    });
  }, [state.orders, range.start, range.end]);

  // Filtro independente do card "Vendas por Horário"
  const [hourPeriod, setHourPeriod] = useState<Period>("month");
  const [hourCustomStart, setHourCustomStart] = useState("");
  const [hourCustomEnd, setHourCustomEnd] = useState("");
  const hourRange = useMemo(
    () => rangeFor(hourPeriod, hourCustomStart, hourCustomEnd),
    [hourPeriod, hourCustomStart, hourCustomEnd],
  );
  const hourOrders = useMemo(() => {
    return state.orders.filter((o) => {
      if (o.status === "cancelado") return false;
      const d = new Date(o.date);
      return d >= hourRange.start && d < hourRange.end;
    });
  }, [state.orders, hourRange.start, hourRange.end]);

  // Vendas por hora do dia (todas as 24h, com destaque para as melhores)
  const bestHours = useMemo(() => {
    const buckets = new Array(24).fill(0).map(() => ({ count: 0, revenue: 0 }));
    for (const o of hourOrders) {
      const h = new Date(o.date).getHours();
      buckets[h].count += 1;
      buckets[h].revenue += o.total;
    }
    const all = buckets.map((b, h) => ({ hour: h, ...b }));
    const maxCount = all.reduce((a, b) => Math.max(a, b.count), 0);
    const sortedWithSales = all
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue);
    const topHours = new Set(sortedWithSales.slice(0, 3).map((b) => b.hour));
    const totalSales = all.reduce((a, b) => a + b.count, 0);
    return { all, maxCount, topHours, totalSales, best: sortedWithSales[0] ?? null };
  }, [hourOrders]);

  // Melhores dias no período do card
  const bestDays = useMemo(() => {
    const map = new Map<string, { key: string; date: Date; count: number; revenue: number }>();
    for (const o of hourOrders) {
      const d = new Date(o.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const cur = map.get(key) ?? {
        key,
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        count: 0,
        revenue: 0,
      };
      cur.count += 1;
      cur.revenue += o.total;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 5);
  }, [hourOrders]);



  // Ticket médio do período
  const ticketMedio = useMemo(() => {
    if (ordersInRange.length === 0) return 0;
    const total = ordersInRange.reduce((a, o) => a + o.total, 0);
    return total / ordersInRange.length;
  }, [ordersInRange]);

  // Forma de pagamento mais usada
  const paymentStats = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const o of ordersInRange) {
      const key = (o.payment || "outros") as string;
      const cur = map.get(key) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += o.total;
      map.set(key, cur);
    }
    const ranked = Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count);
    const total = ordersInRange.length;
    return { ranked, total };
  }, [ordersInRange]);


  const totalExpenses = fin.cogs + adsTotalCost + fin.opEx + fin.motoboyCost + returnsLossInRange + cardFeeCost;
  // Lucro = Faturamento - COGS - (Meta Ads + Imposto Meta Ads) - OpEx - Motoboy - Perdas devoluções - Taxa maquininha
  const adjustedProfit = fin.revenue - fin.cogs - adsTotalCost - fin.opEx - fin.motoboyCost - returnsLossInRange - cardFeeCost;


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
        <StatCard label="Lucro Líquido" value={m(brl(adjustedProfit))} hint={range.label} icon={TrendingUp} tone="success" />
        <StatCard label="Total Gastos" value={m(brl(totalExpenses))} hint={range.label} icon={TrendingDown} tone="danger" />

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
          <div className="text-4xl lg:text-5xl font-bold text-primary tracking-tight">{m(brl(adjustedProfit))}</div>

          <div className="mt-6 flex flex-col gap-2.5 text-sm">
            <Row label="Faturamento Total" value={m(brl(fin.revenue))} positive />
            <Row label="(-) Custos dos Produtos" value={`- ${m(brl(fin.cogs))}`} />
            <Row
              label="(-) Meta Ads"
              value={`- ${m(brl(adsTotalCost))}`}
            />
            <Row label="(-) Despesas Operacionais" value={`- ${m(brl(fin.opEx))}`} />
            <Row label={`(-) Taxa Motoboy (${fin.ordersCount} ped.)`} value={`- ${m(brl(fin.motoboyCost))}`} />
            {returnsLossInRange > 0 && (
              <Row label="(-) Perdas em Devoluções" value={`- ${m(brl(returnsLossInRange))}`} />
            )}
            {cardFeeCost > 0 && (
              <Row label="(-) Taxa Maquininha (Cartão)" value={`- ${m(brl(cardFeeCost))}`} />
            )}
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="font-semibold">(=) Lucro Líquido</span>
              <span className="text-primary font-bold text-lg">{m(brl(adjustedProfit))}</span>
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
              Meta Ads
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncAds}
                disabled={syncingAds}
                title="Sincronizar agora"
                className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20 text-primary hover:bg-primary/20 transition disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingAds ? "animate-spin" : ""}`} />
              </button>
              <Link to="/ads" className="text-xs text-primary hover:underline">Ver detalhes</Link>
            </div>

          </div>
          <div className="text-2xl font-bold">{m(brl(adsInvested))}</div>
          <div className="text-xs text-muted-foreground">Investido — {range.label}</div>

          {adsTaxPct > 0 && (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Imposto ({adsTaxPct.toFixed(2)}%)</span>
                <span className="font-semibold text-destructive">+ {m(brl(adsTaxValue))}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-destructive/20 pt-1.5">
                <span className="text-muted-foreground">Custo total c/ imposto</span>
                <span className="font-bold">{m(brl(adsTotalCost))}</span>
              </div>
            </div>
          )}

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

      {/* Champion product of the month */}
      <div className="mt-6 rounded-2xl border border-border bg-gradient-card p-5 lg:p-6 shadow-elegant">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <Trophy className="h-4 w-4 text-primary" />
            </span>
            <div>
              <div className="text-sm font-semibold flex items-center gap-2">
                🏆 Produto Campeão do Mês
              </div>
              <div className="text-xs text-muted-foreground">Mais vendido no mês atual</div>
            </div>
          </div>
          {champion && (
            <span className="rounded-full bg-primary/15 text-primary text-[11px] font-semibold px-2.5 py-1">
              Mais vendido do mês
            </span>
          )}
        </div>
        {champion ? (
          <div className="flex items-start gap-4">
            {champion.imageUrl ? (
              <img
                src={champion.imageUrl}
                alt={champion.name}
                className="h-20 w-20 lg:h-24 lg:w-24 rounded-xl object-cover border border-border shrink-0"
              />
            ) : (
              <div className="h-20 w-20 lg:h-24 lg:w-24 rounded-xl bg-secondary/40 border border-border grid place-items-center shrink-0">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-lg lg:text-xl font-bold truncate">{champion.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {champion.qty} {champion.qty === 1 ? "unidade vendida" : "unidades vendidas"} · {pct(champion.share)} das vendas
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Mini label="Faturamento" value={m(brl(champion.revenue))} />
                <Mini label="Lucro estimado" value={m(brl(champion.profit))} />
                <Mini label="Participação" value={pct(champion.share)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nenhum produto vendido este mês ainda.
          </div>
        )}
      </div>

      {/* Vendas por horário — gráfico com todas as 24h, destacando as melhores */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-elegant">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <Clock className="h-4 w-4 text-primary" />
            </span>
            <div>
              <div className="text-sm font-semibold">Vendas por Horário</div>
              <div className="text-xs text-muted-foreground">
                Todas as 24h — {hourRange.label}
                {bestHours.best && (
                  <> · pico às {String(bestHours.best.hour).padStart(2, "0")}h</>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Melhores horários
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary/30" /> Demais horários
            </span>
          </div>
        </div>

        {/* Filtro do card */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {([
            { k: "today", l: "Hoje" },
            { k: "yesterday", l: "Ontem" },
            { k: "7d", l: "7 dias" },
            { k: "30d", l: "30 dias" },
            { k: "month", l: "Este mês" },
            { k: "custom", l: "Personalizado" },
          ] as { k: Period; l: string }[]).map((opt) => (
            <button
              key={opt.k}
              type="button"
              onClick={() => setHourPeriod(opt.k)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                hourPeriod === opt.k
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {opt.l}
            </button>
          ))}
          {hourPeriod === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={hourCustomStart}
                onChange={(e) => setHourCustomStart(e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={hourCustomEnd}
                onChange={(e) => setHourCustomEnd(e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
          )}
        </div>
        {bestHours.totalSales === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">Sem vendas no período.</div>
        ) : (
          <div className="h-64 lg:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={bestHours.all.map((b) => ({
                  hora: `${String(b.hour).padStart(2, "0")}h`,
                  hour: b.hour,
                  vendas: b.count,
                  receita: b.revenue,
                }))}
                margin={{ left: 4, right: 8, top: 8, bottom: 4 }}
              >
                <CartesianGrid stroke="oklch(0.26 0 0)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="hora"
                  stroke="oklch(0.65 0.01 247)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  stroke="oklch(0.65 0.01 247)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "oklch(0.985 0.003 247 / 0.05)" }}
                  contentStyle={{
                    backgroundColor: "oklch(0.18 0 0)",
                    border: "1px solid oklch(0.26 0 0)",
                    borderRadius: 12,
                  }}
                  labelStyle={{ color: "oklch(0.985 0.003 247)" }}
                  formatter={(value: any, name: string) => {
                    if (name === "vendas") return [`${value} ${value === 1 ? "venda" : "vendas"}`, "Vendas"];
                    return [value, name];
                  }}
                  labelFormatter={(label, payload) => {
                    const p: any = payload?.[0]?.payload;
                    if (!p) return label;
                    const next = (p.hour + 1) % 24;
                    const rev = p.receita > 0 ? ` · ${brl(p.receita)}` : "";
                    return `${String(p.hour).padStart(2, "0")}:00 – ${String(next).padStart(2, "0")}:00${rev}`;
                  }}
                />
                <Bar dataKey="vendas" radius={[6, 6, 0, 0]}>
                  {bestHours.all.map((b) => (
                    <Cell
                      key={b.hour}
                      fill={
                        bestHours.topHours.has(b.hour)
                          ? "oklch(0.72 0.19 148)"
                          : "oklch(0.72 0.19 148 / 0.3)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Ticket médio + Forma de pagamento */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Ticket médio */}


        {/* Ticket médio */}
        <div className="rounded-2xl border border-border bg-gradient-card p-5 lg:p-6 shadow-elegant">
          <div className="flex items-center gap-3 mb-4">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <Receipt className="h-4 w-4 text-primary" />
            </span>
            <div>
              <div className="text-sm font-semibold">Ticket médio</div>
              <div className="text-xs text-muted-foreground">Valor médio por pedido — {range.label}</div>
            </div>
          </div>
          <div className="text-3xl lg:text-4xl font-bold text-primary tracking-tight">
            {m(brl(ticketMedio))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Mini label="Pedidos" value={String(ordersInRange.length)} />
            <Mini label="Faturamento" value={m(brl(ordersInRange.reduce((a, o) => a + o.total, 0)))} />
          </div>
        </div>

        {/* Forma de pagamento mais usada */}
        <div className="rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-elegant">
          <div className="flex items-center gap-3 mb-4">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <CreditCard className="h-4 w-4 text-primary" />
            </span>
            <div>
              <div className="text-sm font-semibold">Forma de pagamento mais usada</div>
              <div className="text-xs text-muted-foreground">Distribuição — {range.label}</div>
            </div>
          </div>
          {paymentStats.ranked.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Sem vendas no período.</div>
          ) : (
            <div className="space-y-3">
              {paymentStats.ranked.slice(0, 4).map((p, i) => {
                const share = paymentStats.total > 0 ? (p.count / paymentStats.total) * 100 : 0;
                const label = paymentLabel(p.key);
                return (
                  <div key={p.key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium capitalize flex items-center gap-2">
                        {i === 0 && <span className="rounded-full bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.5">TOP</span>}
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.count} · {pct(share)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

function paymentLabel(key: string): string {
  const k = (key || "").toLowerCase();
  const map: Record<string, string> = {
    cartao: "Cartão",
    "cartão": "Cartão",
    credito: "Cartão de crédito",
    "crédito": "Cartão de crédito",
    debito: "Cartão de débito",
    "débito": "Cartão de débito",
    pix: "PIX",
    dinheiro: "Dinheiro",
    boleto: "Boleto",
    transferencia: "Transferência",
    "transferência": "Transferência",
    outros: "Outros",
  };
  return map[k] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Outros");
}
