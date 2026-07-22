import { createFileRoute } from "@tanstack/react-router";
import { AppShell, StatCard } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { goalsStore, type Goal } from "@/lib/local-data";
import { useStore, monthRange } from "@/lib/store";
import { brl } from "@/lib/format";
import { Target, Save, Wallet, ShoppingCart, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({ meta: [{ title: "Metas — ZappFy" }] }),
  component: Page,
});

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Page() {
  const { state } = useStore();
  const [ym, setYm] = useState(currentYM());
  const [goal, setGoal] = useState<Goal>({ month: ym, revenue: 0, orders: 0, profit: 0 });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const g = goalsStore.getForMonth(ym);
    setGoal(g ?? { month: ym, revenue: 0, orders: 0, profit: 0 });
    setEditing(!g);
  }, [ym]);

  const { revenue, orders, profit } = useMemo(() => {
    const [y, m] = ym.split("-").map(Number);
    const { start, end } = monthRange(new Date(y, m - 1, 1));
    const list = state.orders.filter(
      (o) => o.status !== "cancelado" && new Date(o.date) >= start && new Date(o.date) < end,
    );
    const rev = list.reduce((a, o) => a + o.total, 0);
    const cogs = list.reduce((a, o) => a + o.items.reduce((b, it) => b + it.cost * it.qty, 0), 0);
    const exps = state.expenses
      .filter((e) => e.category !== "mercadorias" && new Date(e.date) >= start && new Date(e.date) < end)
      .reduce((a, e) => a + e.amount, 0);
    return { revenue: rev, orders: list.length, profit: rev - cogs - exps };
  }, [ym, state.orders, state.expenses]);

  const hasGoal = goal.revenue > 0 || goal.orders > 0 || goal.profit > 0;

  function save() {
    goalsStore.upsert({ ...goal, month: ym });
    setEditing(false);
    toast.success("Meta salva");
  }

  function pct(actual: number, target: number) {
    if (target <= 0) return 0;
    return Math.min(100, (actual / target) * 100);
  }

  return (
    <AppShell
      title="Metas"
      subtitle="Acompanhe seu desempenho mensal"
      actions={
        <input
          type="month"
          value={ym}
          onChange={(e) => setYm(e.target.value)}
          className="input"
        />
      }
    >
      {!hasGoal && !editing ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary mb-4">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <div className="text-muted-foreground mb-4">Nenhuma meta definida para este mês</div>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Target className="h-4 w-4" /> Definir meta
          </button>
        </div>
      ) : editing ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Definir meta — {ym}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Faturamento (R$)">
              <input type="number" min={0} step="0.01" value={goal.revenue} onChange={(e) => setGoal({ ...goal, revenue: Number(e.target.value) })} className="input" />
            </Field>
            <Field label="Pedidos">
              <input type="number" min={0} value={goal.orders} onChange={(e) => setGoal({ ...goal, orders: Number(e.target.value) })} className="input" />
            </Field>
            <Field label="Lucro (R$)">
              <input type="number" min={0} step="0.01" value={goal.profit} onChange={(e) => setGoal({ ...goal, profit: Number(e.target.value) })} className="input" />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            {hasGoal && (
              <button onClick={() => setEditing(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
            )}
            <button onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              <Save className="h-4 w-4" /> Salvar meta
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <GoalCard icon={Wallet} label="Faturamento" actual={brl(revenue)} target={brl(goal.revenue)} pct={pct(revenue, goal.revenue)} />
            <GoalCard icon={ShoppingCart} label="Pedidos" actual={String(orders)} target={String(goal.orders)} pct={pct(orders, goal.orders)} />
            <GoalCard icon={TrendingUp} label="Lucro" actual={brl(profit)} target={brl(goal.profit)} pct={pct(profit, goal.profit)} />
          </div>
          <button onClick={() => setEditing(true)} className="rounded-lg border border-border px-4 py-2 text-sm">Editar meta</button>
        </>
      )}
    </AppShell>
  );
}

function GoalCard({ icon: Icon, label, actual, target, pct }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="text-2xl font-bold text-primary">{actual}</div>
      <div className="text-xs text-muted-foreground mt-1">Meta: {target}</div>
      <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{pct.toFixed(0)}% concluído</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
