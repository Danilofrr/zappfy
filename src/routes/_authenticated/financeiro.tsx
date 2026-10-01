import { createFileRoute } from "@tanstack/react-router";
import { AppShell, StatCard } from "@/components/AppShell";
import { useStore, useFinance, type ExpenseCategory, type ExpenseProfitScope } from "@/lib/store";
import { brl, dateInputToLocalISO, fmtBusinessDate, fmtDate, todayDateInput } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarDays, CalendarRange, DollarSign, Plus, ReceiptText, Tags, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — ZappFy" }] }),
  component: Page,
});

const catList: { value: ExpenseCategory; label: string }[] = [
  { value: "ads", label: "Meta Ads" },
  { value: "mercadorias", label: "Mercadorias" },
  { value: "motoboy", label: "Motoboy" },
  { value: "embalagens", label: "Embalagens" },
  { value: "internet", label: "Internet" },
  { value: "energia", label: "Energia" },
  { value: "aluguel", label: "Aluguel" },
  { value: "funcionarios", label: "Funcionários" },
  { value: "retirada", label: "Retirada Pessoal" },
  { value: "outros", label: "Outros Gastos" },
];

type ExpensePeriod = "today" | "yesterday" | "7d" | "30d" | "month" | "previousMonth" | "custom";

const expensePeriods: { key: ExpensePeriod; label: string }[] = [
  { key: "month", label: "Este mês" },
  { key: "previousMonth", label: "Mês anterior" },
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "custom", label: "Personalizado" },
];

const startOfLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const expensePeriodRange = (period: ExpensePeriod, customFrom: string, customTo: string) => {
  const now = new Date();
  let start = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), 1));
  let end = endOfLocalDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  if (period === "today") {
    start = startOfLocalDay(now);
    end = endOfLocalDay(now);
  } else if (period === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    start = startOfLocalDay(yesterday);
    end = endOfLocalDay(yesterday);
  } else if (period === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    start = startOfLocalDay(from);
    end = endOfLocalDay(now);
  } else if (period === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    start = startOfLocalDay(from);
    end = endOfLocalDay(now);
  } else if (period === "previousMonth") {
    start = startOfLocalDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    end = endOfLocalDay(new Date(now.getFullYear(), now.getMonth(), 0));
  } else if (period === "custom") {
    const fallbackStart = start;
    const fallbackEnd = end;
    const from = customFrom ? startOfLocalDay(new Date(`${customFrom}T00:00:00`)) : fallbackStart;
    const to = customTo ? endOfLocalDay(new Date(`${customTo}T00:00:00`)) : fallbackEnd;
    start = from <= to ? from : startOfLocalDay(to);
    end = from <= to ? to : endOfLocalDay(from);
  }

  return { start, end };
};

const formatPeriodLabel = (period: ExpensePeriod, start: Date, end: Date) => {
  if (period === "month") {
    return start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  if (period === "previousMonth") {
    return start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  if (period === "today") return "Hoje";
  if (period === "yesterday") return "Ontem";

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return start.toLocaleDateString("pt-BR");

  return `${start.toLocaleDateString("pt-BR")} até ${end.toLocaleDateString("pt-BR")}`;
};

function Page() {
  const { state, addExpense, deleteExpense } = useStore();
  const fin = useFinance();
  const [open, setOpen] = useState(false);
  const [expensePeriod, setExpensePeriod] = useState<ExpensePeriod>("month");
  const [customFrom, setCustomFrom] = useState(() =>
    toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [customTo, setCustomTo] = useState(() => toDateInputValue(new Date()));

  const expenseRange = useMemo(
    () => expensePeriodRange(expensePeriod, customFrom, customTo),
    [expensePeriod, customFrom, customTo],
  );

  const filteredExpenses = useMemo(
    () =>
      state.expenses
        .filter((expense) => {
          const time = new Date(expense.date).getTime();
          return time >= expenseRange.start.getTime() && time <= expenseRange.end.getTime();
        })
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [state.expenses, expenseRange],
  );

  const expenseReport = useMemo(() => {
    const total = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const average = filteredExpenses.length > 0 ? total / filteredExpenses.length : 0;
    const largest = filteredExpenses.reduce<(typeof filteredExpenses)[number] | null>(
      (current, expense) => (!current || expense.amount > current.amount ? expense : current),
      null,
    );

    const categoryMap = new Map<ExpenseCategory, number>();
    filteredExpenses.forEach((expense) => {
      categoryMap.set(
        expense.category,
        (categoryMap.get(expense.category) || 0) + Number(expense.amount || 0),
      );
    });

    const categories = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        label: catList.find((item) => item.value === category)?.label || category,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { total, average, largest, categories };
  }, [filteredExpenses]);

  const cashflow = useMemo(() => {
    const items: { date: string; label: string; in: number; out: number; type: "order" | "expense" }[] = [];
    state.orders
      .filter((o) => o.status !== "cancelado" && o.status !== "aguardando")
      .forEach((o) =>
        items.push({
          date: o.date,
          label: `Venda — ${o.customer}`,
          in: o.total,
          out: 0,
          type: "order",
        }),
      );
    state.expenses.forEach((e) =>
      items.push({ date: e.date, label: e.description, in: 0, out: e.amount, type: "expense" }),
    );
    return items.sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 25);
  }, [state]);

  const periodLabel = formatPeriodLabel(expensePeriod, expenseRange.start, expenseRange.end);

  return (
    <AppShell
      title="Financeiro"
      subtitle="Entradas, saídas e fluxo de caixa"
      actions={
        <NewExpense
          open={open}
          setOpen={setOpen}
          onAdd={(expense) => {
            addExpense(expense);
            toast.success("Despesa lançada");
            setOpen(false);
          }}
        />
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Receita Total" value={brl(fin.revenue)} icon={DollarSign} tone="success" hint="mês" neon="56 189 248"/>
        <StatCard label="Despesas Totais" value={brl(fin.cogs + fin.adsSpend + fin.opEx)} icon={TrendingDown} tone="danger" hint="mês" neon="244 63 94"/>
        <StatCard label="Lucro Líquido" value={brl(fin.profit)} icon={TrendingUp} tone="success" hint="mês" neon="167 139 250"/>
        <StatCard label="Saldo em Caixa" value={brl(fin.cash)} icon={Wallet} hint="acumulado" neon="251 191 36"/>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-elegant sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <ReceiptText className="h-[18px] w-[18px]" />
              </span>
              Relatório de despesas
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe somente as despesas lançadas no período selecionado.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <CalendarDays className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
            Período: <b className="capitalize text-foreground">{periodLabel}</b>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {expensePeriods.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={expensePeriod === item.key ? "default" : "outline"}
              onClick={() => setExpensePeriod(item.key)}
              className="rounded-xl"
            >
              {item.key === "custom" && <CalendarDays className="mr-1.5 h-3.5 w-3.5" />}
              {item.label}
            </Button>
          ))}
        </div>

        {expensePeriod === "custom" && (
          <div className="mt-4 grid gap-3 rounded-xl border border-border bg-background/30 p-4 sm:grid-cols-2 lg:max-w-xl">
            <Field label="Data inicial">
              <Input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
            </Field>
            <Field label="Data final">
              <Input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Total no período
            </div>
            <div className="mt-1 text-xl font-black text-destructive">
              {brl(expenseReport.total)}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/35 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Lançamentos
            </div>
            <div className="mt-1 text-xl font-black">{filteredExpenses.length}</div>
          </div>

          <div className="rounded-xl border border-border bg-background/35 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Média por despesa
            </div>
            <div className="mt-1 text-xl font-black">{brl(expenseReport.average)}</div>
          </div>

          <div className="rounded-xl border border-border bg-background/35 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Maior despesa
            </div>
            <div className="mt-1 truncate text-xl font-black">
              {expenseReport.largest ? brl(expenseReport.largest.amount) : brl(0)}
            </div>
            {expenseReport.largest && (
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {expenseReport.largest.description}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="rounded-xl border border-border bg-background/25 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Tags className="h-4 w-4 text-primary" />
              Gastos por categoria
            </div>

            {expenseReport.categories.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                Nenhuma despesa neste período.
              </div>
            ) : (
              <div className="space-y-3">
                {expenseReport.categories.map((category) => (
                  <div key={category.category}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-medium">{category.label}</span>
                      <span className="shrink-0 font-bold">
                        {brl(category.amount)}
                        <span className="ml-1 font-normal text-muted-foreground">
                          · {category.percentage.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max(2, category.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-background/25">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-bold">Despesas do período</div>
                <div className="text-[11px] text-muted-foreground">
                  {filteredExpenses.length} lançamento{filteredExpenses.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="text-sm font-black text-destructive">{brl(expenseReport.total)}</div>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="p-8 text-center">
                <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <div className="mt-2 text-sm font-medium">Nenhuma despesa encontrada</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Troque o período ou lance uma nova despesa.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary/25"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{expense.description}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>
                          {catList.find((category) => category.value === expense.category)?.label || expense.category}
                          {" · "}
                          {fmtBusinessDate(expense.date)}
                        </span>
                        <span
                          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                            expense.profitScope === "month"
                              ? "border-violet-500/25 bg-violet-500/10 text-violet-400"
                              : "border-primary/25 bg-primary/10 text-primary"
                          }`}
                        >
                          {expense.profitScope === "month" ? "LUCRO DO MÊS" : "LUCRO DO DIA"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-bold text-destructive">
                        - {brl(expense.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteExpense(expense.id)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        title="Excluir despesa"
                        aria-label="Excluir despesa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-elegant lg:p-6">
        <div className="mb-4">
          <div className="text-sm font-semibold">Fluxo de caixa recente</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Últimos movimentos de entradas e saídas.
          </div>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {cashflow.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">
                  {item.type === "expense" ? fmtBusinessDate(item.date) : fmtDate(item.date)}
                </div>
              </div>
              <div className={`shrink-0 font-semibold ${item.in ? "text-primary" : "text-destructive"}`}>
                {item.in ? `+ ${brl(item.in)}` : `- ${brl(item.out)}`}
              </div>
            </div>
          ))}
          {cashflow.length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhum movimento registrado.</div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function NewExpense({ open, setOpen, onAdd }: { open: boolean; setOpen: (v: boolean) => void; onAdd: (e: any) => void }) {
  const emptyForm = () => ({
    description: "",
    category: "outros" as ExpenseCategory,
    amount: 0,
    date: todayDateInput(),
    profitScope: "day" as ExpenseProfitScope,
  });
  const [f, setF] = useState(emptyForm);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setF(emptyForm());
      }}
    >
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4"/>Nova despesa</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova despesa</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Descrição">
            <Input
              value={f.description}
              onChange={(e) => setF({...f, description: e.target.value})}
              placeholder="Ex.: aluguel, embalagem, manutenção..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select value={f.category} onValueChange={(v: ExpenseCategory) => setF({...f, category: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {catList.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Valor (R$)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={f.amount}
                onChange={(e) => setF({...f, amount: Number(e.target.value)})}
              />
            </Field>
          </div>

          <Field label="Data">
            <Input
              type="date"
              value={f.date}
              onChange={(e) => setF({...f, date: e.target.value})}
            />
          </Field>

          <div>
            <Label className="text-xs">Onde descontar esta despesa?</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setF({...f, profitScope: "day"})}
                className={`rounded-xl border p-3 text-left transition ${
                  f.profitScope === "day"
                    ? "border-primary/50 bg-primary/10 ring-1 ring-primary/20"
                    : "border-border bg-secondary/20 hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${
                    f.profitScope === "day" ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground"
                  }`}>
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-bold">Lucro do dia</div>
                    <div className="text-[10px] text-muted-foreground">Desconta na data escolhida</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setF({...f, profitScope: "month"})}
                className={`rounded-xl border p-3 text-left transition ${
                  f.profitScope === "month"
                    ? "border-violet-500/50 bg-violet-500/10 ring-1 ring-violet-500/20"
                    : "border-border bg-secondary/20 hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${
                    f.profitScope === "month" ? "bg-violet-500/15 text-violet-400" : "bg-background text-muted-foreground"
                  }`}>
                    <CalendarRange className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-bold">Lucro do mês</div>
                    <div className="text-[10px] text-muted-foreground">Não reduz o resultado diário</div>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              {f.profitScope === "day"
                ? "Essa despesa aparece no lucro do dia escolhido e também entra normalmente nos acumulados de 7/30 dias, mês e personalizado."
                : "Essa despesa não será descontada em Hoje/Ontem. Ela entra nos resultados acumulados, principalmente no relatório mensal."}
            </div>
          </div>

          {f.category === "mercadorias" && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
              <strong>Atenção:</strong> compra de estoque para revenda deve ser lançada em <strong>Compras &amp; Fornecedores</strong>. O custo é abatido do lucro automaticamente conforme os produtos são vendidos (COGS). Se lançar aqui também, o valor será descontado duas vezes — por isso essa categoria não entra no cálculo de lucro do Dashboard.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!f.description.trim() || !f.amount) {
                toast.error("Preencha os campos");
                return;
              }
              onAdd({
                ...f,
                description: f.description.trim(),
                date: dateInputToLocalISO(f.date),
              });
            }}
          >
            Salvar despesa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
