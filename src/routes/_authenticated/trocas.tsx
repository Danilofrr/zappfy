import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { brl, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trocas")({
  head: () => ({ meta: [{ title: "Trocas & Devoluções — ZappFy" }] }),
  component: TrocasPage,
});

type ReturnRow = {
  id: string; type: "cliente" | "fornecedor"; party_name: string;
  product_id: string | null; product_name: string; new_product_name: string;
  quantity: number; reason: string;
  status: "parado_loja" | "com_fornecedor" | "perdido" | "resolvido";
  value_at_risk: number; return_date: string; notes: string;
};

const statusList = [
  { value: "parado_loja", label: "Parado na loja", color: "bg-warning/15 text-warning" },
  { value: "com_fornecedor", label: "Com fornecedor", color: "bg-blue-500/15 text-blue-400" },
  { value: "perdido", label: "Perdido", color: "bg-destructive/15 text-destructive" },
  { value: "resolvido", label: "Resolvido", color: "bg-primary/15 text-primary" },
] as const;

function TrocasPage() {
  const { state, user } = useStore();
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [tab, setTab] = useState<"cliente" | "fornecedor">("cliente");
  const [open, setOpen] = useState(false);

  async function load() {
    if (!user) return;
    const { data } = await (supabase.from("returns" as any) as any).select("*").order("return_date", { ascending: false });
    if (data) setRows(data as ReturnRow[]);
  }
  useEffect(() => { load(); }, [user]);

  const byStatus = useMemo(() => ({
    parado: rows.filter((r) => r.status === "parado_loja"),
    fornec: rows.filter((r) => r.status === "com_fornecedor"),
    perdido: rows.filter((r) => r.status === "perdido"),
  }), [rows]);

  const margemRisco = useMemo(
    () => rows.filter((r) => r.status !== "resolvido").reduce((s, r) => s + Number(r.value_at_risk), 0),
    [rows],
  );

  const filtered = rows.filter((r) => r.type === tab);

  async function updateStatus(id: string, status: ReturnRow["status"]) {
    const { data, error } = await (supabase.from("returns" as any) as any).update({ status }).eq("id", id).select().single();
    if (error) return toast.error(error.message);
    setRows((p) => p.map((x) => x.id === id ? (data as ReturnRow) : x));
  }
  async function del(id: string) {
    if (!confirm("Excluir este registro?")) return;
    const { error } = await (supabase.from("returns" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((p) => p.filter((x) => x.id !== id));
    toast.success("Registro excluído");
  }

  return (
    <AppShell
      title="Trocas & Devoluções"
      subtitle="Gestão de produtos devolvidos e trocas"
      actions={
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova Troca</Button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="Parado na Loja" value={brl(byStatus.parado.reduce((s, r) => s + Number(r.value_at_risk), 0))} hint={`${byStatus.parado.length} item(s) aguardando envio`} tone="warning" neon="251 191 36" />
        <KPI label="Com Fornecedor" value={brl(byStatus.fornec.reduce((s, r) => s + Number(r.value_at_risk), 0))} hint={`${byStatus.fornec.length} item(s) em trânsito/análise`} tone="info" neon="56 189 248" />
        <KPI label="Prejuízo (Perdido)" value={brl(byStatus.perdido.reduce((s, r) => s + Number(r.value_at_risk), 0))} hint={`${byStatus.perdido.length} produto(s) fora da prateleira`} tone="bad" neon="244 63 94" />
        <KPI
          label={<span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-warning" />Margem em Risco</span>}
          value={brl(margemRisco)}
          hint="Lucro que pode deixar de ser realizado"
          tone="warning"
          neon="167 139 250"
        />
      </div>

      <div className="flex gap-2 mb-4">
        <Button variant={tab === "cliente" ? "default" : "outline"} size="sm" onClick={() => setTab("cliente")}>
          Trocas de Clientes ({rows.filter((r) => r.type === "cliente").length})
        </Button>
        <Button variant={tab === "fornecedor" ? "default" : "outline"} size="sm" onClick={() => setTab("fornecedor")}>
          Devoluções ao Fornecedor ({rows.filter((r) => r.type === "fornecedor").length})
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-elegant">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">{tab === "cliente" ? "Cliente" : "Fornecedor"}</th>
                <th className="text-left px-4 py-3">Devolvido</th>
                {tab === "cliente" && <th className="text-left px-4 py-3">Novo</th>}
                <th className="text-left px-4 py-3">Motivo</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={tab === "cliente" ? 8 : 7} className="px-4 py-10 text-center text-muted-foreground">Nenhum registro ainda.</td></tr>
              )}
              {filtered.map((r) => {
                const st = statusList.find((s) => s.value === r.status)!;
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.return_date)}</td>
                    <td className="px-4 py-3">{r.party_name || "—"}</td>
                    <td className="px-4 py-3">{r.quantity}x {r.product_name}</td>
                    {tab === "cliente" && <td className="px-4 py-3 text-muted-foreground">{r.new_product_name || "—"}</td>}
                    <td className="px-4 py-3 truncate max-w-[220px]">{r.reason || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{brl(Number(r.value_at_risk))}</td>
                    <td className="px-4 py-3">
                      <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as any)}>
                        <SelectTrigger className={`h-8 w-[150px] border-0 ${st.color}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{statusList.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <NewReturnDialog open={open} setOpen={setOpen} products={state.products} onSaved={(r) => setRows((p) => [r, ...p])} initialType={tab} />
    </AppShell>
  );
}

function KPI({ label, value, hint, tone }: { label: React.ReactNode; value: string; hint?: string; tone?: "warning" | "info" | "bad" }) {
  const cls = tone === "warning" ? "text-warning" : tone === "info" ? "text-blue-400" : tone === "bad" ? "text-destructive" : "";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-elegant">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function NewReturnDialog({
  open, setOpen, products, onSaved, initialType,
}: {
  open: boolean; setOpen: (v: boolean) => void;
  products: any[]; onSaved: (r: ReturnRow) => void; initialType: "cliente" | "fornecedor";
}) {
  const { user } = useStore();
  const [form, setForm] = useState({
    type: initialType, party_name: "", product_id: "", product_name: "",
    new_product_name: "", quantity: 1, reason: "", status: "parado_loja" as const, value_at_risk: 0, notes: "",
  });
  useEffect(() => { setForm((f) => ({ ...f, type: initialType })); }, [initialType]);

  async function save() {
    if (!user) return;
    if (!form.product_name) return toast.error("Informe o produto devolvido");
    const payload: any = { user_id: user.id, ...form, product_id: form.product_id || null };
    const { data, error } = await (supabase.from("returns" as any) as any).insert(payload).select().single();
    if (error) return toast.error(error.message);
    onSaved(data as ReturnRow);
    toast.success("Troca registrada");
    setForm({ type: initialType, party_name: "", product_id: "", product_name: "", new_product_name: "", quantity: 1, reason: "", status: "parado_loja", value_at_risk: 0, notes: "" });
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova troca/devolução</DialogTitle>
          <DialogDescription>Registre um produto devolvido pelo cliente ou ao fornecedor.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente devolveu</SelectItem>
                  <SelectItem value="fornecedor">Devolução ao fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={form.type === "cliente" ? "Cliente" : "Fornecedor"}>
              <Input value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} />
            </Field>
          </div>
          <Field label="Produto devolvido">
            <Select
              value={form.product_id}
              onValueChange={(v) => {
                const p = products.find((x) => x.id === v);
                setForm({ ...form, product_id: v, product_name: p?.name ?? form.product_name, value_at_risk: p?.price ?? form.value_at_risk });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Ou digite o nome"><Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></Field>
          {form.type === "cliente" && (
            <Field label="Novo produto (em troca)"><Input value={form.new_product_name} onChange={(e) => setForm({ ...form, new_product_name: e.target.value })} placeholder="Opcional" /></Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade"><Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Math.max(1, Number(e.target.value)) })} /></Field>
            <Field label="Valor em risco (R$)"><Input type="number" min={0} step="0.01" value={form.value_at_risk} onChange={(e) => setForm({ ...form, value_at_risk: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statusList.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Motivo"><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex: defeito, arrependimento, tamanho errado..." /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
