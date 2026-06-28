import { createFileRoute } from "@tanstack/react-router";
import { AppShell, StatCard } from "@/components/AppShell";
import { useStore, useFinance, type ExpenseCategory } from "@/lib/store";
import { brl, dateInputToLocalISO, fmtBusinessDate, fmtDate, todayDateInput } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, TrendingDown, TrendingUp, Wallet, DollarSign } from "lucide-react";
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

function Page() {
  const { state, addExpense, deleteExpense } = useStore();
  const fin = useFinance();
  const [open, setOpen] = useState(false);

  const cashflow = useMemo(() => {
    const items: { date: string; label: string; in: number; out: number; type: "order" | "expense" }[] = [];
    state.orders
      .filter((o) => o.status !== "cancelado" && o.status !== "aguardando")
      .forEach((o) => items.push({ date: o.date, label: `Venda — ${o.customer}`, in: o.total, out: 0, type: "order" }));
    state.expenses.forEach((e) => items.push({ date: e.date, label: e.description, in: 0, out: e.amount, type: "expense" }));
    return items.sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 25);
  }, [state]);

  return (
    <AppShell
      title="Financeiro"
      subtitle="Entradas, saídas e fluxo de caixa"
      actions={<NewExpense open={open} setOpen={setOpen} onAdd={(e) => { addExpense(e); toast.success("Despesa lançada"); setOpen(false); }} />}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="Receita Total" value={brl(fin.revenue)} icon={DollarSign} tone="success" hint="mês" neon="56 189 248"/>
        <StatCard label="Despesas Totais" value={brl(fin.cogs + fin.adsSpend + fin.opEx)} icon={TrendingDown} tone="danger" hint="mês" neon="244 63 94"/>
        <StatCard label="Lucro Líquido" value={brl(fin.profit)} icon={TrendingUp} tone="success" hint="mês" neon="167 139 250"/>
        <StatCard label="Saldo em Caixa" value={brl(fin.cash)} icon={Wallet} hint="acumulado" neon="251 191 36"/>
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-elegant">
          <div className="text-sm font-semibold mb-4">Despesas recentes</div>
          <div className="space-y-2">
            {state.expenses.slice(0, 12).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.description}</div>
                  <div className="text-xs text-muted-foreground capitalize">{catList.find((c) => c.value === e.category)?.label} · {fmtBusinessDate(e.date)}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-destructive">- {brl(e.amount)}</span>
                  <button onClick={() => deleteExpense(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4"/></button>
                </div>
              </div>
            ))}
            {state.expenses.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma despesa lançada.</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-elegant">
          <div className="text-sm font-semibold mb-4">Fluxo de caixa</div>
          <div className="space-y-2">
            {cashflow.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.type === "expense" ? fmtBusinessDate(c.date) : fmtDate(c.date)}</div>
                </div>
                <div className={`font-semibold shrink-0 ${c.in ? "text-primary" : "text-destructive"}`}>
                  {c.in ? `+ ${brl(c.in)}` : `- ${brl(c.out)}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function NewExpense({ open, setOpen, onAdd }: { open: boolean; setOpen: (v: boolean) => void; onAdd: (e: any) => void }) {
  const [f, setF] = useState({ description: "", category: "outros" as ExpenseCategory, amount: 0, date: todayDateInput() });
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setF({ description: "", category: "outros", amount: 0, date: todayDateInput() }); }}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4"/>Nova despesa</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Descrição"><Input value={f.description} onChange={(e) => setF({...f, description: e.target.value})}/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select value={f.category} onValueChange={(v: any) => setF({...f, category: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{catList.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Valor (R$)"><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({...f, amount: Number(e.target.value)})}/></Field>
          </div>
          <Field label="Data"><Input type="date" value={f.date} onChange={(e) => setF({...f, date: e.target.value})}/></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => { if (!f.description || !f.amount) { toast.error("Preencha os campos"); return; } onAdd({ ...f, date: dateInputToLocalISO(f.date) }); }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
