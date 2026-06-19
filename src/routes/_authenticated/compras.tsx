import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { brl, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Truck, Users, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({ meta: [{ title: "Compras & Fornecedores — ZappFy" }] }),
  component: ComprasPage,
});

type Supplier = { id: string; name: string; phone: string; email: string; notes: string };
type PurchaseOrder = {
  id: string; supplier_id: string | null; supplier_name: string;
  product_id: string | null; product_name: string;
  quantity: number; unit_cost: number; total: number;
  status: "pendente" | "recebido" | "cancelado";
  order_date: string; received_date: string | null; notes: string;
};

const statusList = [
  { value: "pendente", label: "Pendente", color: "bg-warning/15 text-warning" },
  { value: "recebido", label: "Recebido", color: "bg-primary/15 text-primary" },
  { value: "cancelado", label: "Cancelado", color: "bg-destructive/15 text-destructive" },
] as const;

function ComprasPage() {
  const { state, user } = useStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [tab, setTab] = useState<"pedidos" | "fornecedores">("pedidos");
  const [openOrder, setOpenOrder] = useState(false);
  const [openSup, setOpenSup] = useState(false);

  async function load() {
    if (!user) return;
    const [s, o] = await Promise.all([
      (supabase.from("suppliers" as any) as any).select("*").order("name"),
      (supabase.from("purchase_orders" as any) as any).select("*").order("order_date", { ascending: false }),
    ]);
    if (s.data) setSuppliers(s.data as Supplier[]);
    if (o.data) setOrders(o.data as PurchaseOrder[]);
  }
  useEffect(() => { load(); }, [user]);

  const totals = useMemo(() => {
    const pend = orders.filter((o) => o.status === "pendente").reduce((s, o) => s + Number(o.total), 0);
    const rec = orders.filter((o) => o.status === "recebido").reduce((s, o) => s + Number(o.total), 0);
    return { pend, rec };
  }, [orders]);

  async function deleteOrder(id: string) {
    if (!confirm("Excluir este pedido de reposição?")) return;
    const { error } = await (supabase.from("purchase_orders" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setOrders((p) => p.filter((x) => x.id !== id));
    toast.success("Pedido excluído");
  }
  async function updateStatus(id: string, status: PurchaseOrder["status"]) {
    const patch: any = { status };
    if (status === "recebido") patch.received_date = new Date().toISOString();
    const { data, error } = await (supabase.from("purchase_orders" as any) as any).update(patch).eq("id", id).select().single();
    if (error) return toast.error(error.message);
    setOrders((p) => p.map((x) => x.id === id ? (data as PurchaseOrder) : x));
  }
  async function deleteSupplier(id: string) {
    if (!confirm("Excluir este fornecedor?")) return;
    const { error } = await (supabase.from("suppliers" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSuppliers((p) => p.filter((x) => x.id !== id));
    toast.success("Fornecedor excluído");
  }

  return (
    <AppShell
      title="Compras & Fornecedores"
      subtitle="Gerencie pedidos de reposição e seus fornecedores"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenSup(true)}><Users className="h-4 w-4 mr-1" />Fornecedor</Button>
          <Button onClick={() => setOpenOrder(true)}><Plus className="h-4 w-4 mr-1" />Novo Pedido</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <KPI label="Pedidos Pendentes" value={brl(totals.pend)} hint={`${orders.filter((o) => o.status === "pendente").length} pedido(s)`} tone="warning" />
        <KPI label="Recebido (total)" value={brl(totals.rec)} hint={`${orders.filter((o) => o.status === "recebido").length} pedido(s)`} tone="success" />
        <KPI label="Fornecedores" value={String(suppliers.length)} hint="cadastrados" />
      </div>

      <div className="flex gap-2 mb-4">
        <Button variant={tab === "pedidos" ? "default" : "outline"} size="sm" onClick={() => setTab("pedidos")}>
          <Truck className="h-4 w-4 mr-1" />Pedidos de Reposição
        </Button>
        <Button variant={tab === "fornecedores" ? "default" : "outline"} size="sm" onClick={() => setTab("fornecedores")}>
          <Users className="h-4 w-4 mr-1" />Fornecedores
        </Button>
      </div>

      {tab === "pedidos" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-elegant">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Fornecedor</th>
                  <th className="text-left px-4 py-3">Produto</th>
                  <th className="text-right px-4 py-3">Qtd</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum pedido de reposição.</td></tr>
                )}
                {orders.map((o) => {
                  const st = statusList.find((s) => s.value === o.status)!;
                  return (
                    <tr key={o.id} className="border-t border-border hover:bg-secondary/30">
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.order_date)}</td>
                      <td className="px-4 py-3">{o.supplier_name || "—"}</td>
                      <td className="px-4 py-3">{o.product_name}</td>
                      <td className="px-4 py-3 text-right">{o.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold">{brl(Number(o.total))}</td>
                      <td className="px-4 py-3">
                        <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v as any)}>
                          <SelectTrigger className={`h-8 w-[130px] border-0 ${st.color}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{statusList.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteOrder(o.id)} className="text-muted-foreground hover:text-destructive p-1">
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
      )}

      {tab === "fornecedores" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-elegant">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Telefone</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Observações</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhum fornecedor cadastrado.</td></tr>
                )}
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[280px]">{s.notes || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteSupplier(s.id)} className="text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewSupplierDialog open={openSup} setOpen={setOpenSup} onSaved={(s) => setSuppliers((p) => [s, ...p])} />
      <NewOrderDialog
        open={openOrder} setOpen={setOpenOrder}
        suppliers={suppliers} products={state.products}
        onSaved={(o) => setOrders((p) => [o, ...p])}
      />
    </AppShell>
  );
}

function KPI({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "warning" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-elegant">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone === "success" ? "text-primary" : tone === "warning" ? "text-warning" : ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function NewSupplierDialog({ open, setOpen, onSaved }: { open: boolean; setOpen: (v: boolean) => void; onSaved: (s: Supplier) => void }) {
  const { user } = useStore();
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  async function save() {
    if (!user || !form.name) return toast.error("Informe o nome");
    const { data, error } = await (supabase.from("suppliers" as any) as any).insert({ user_id: user.id, ...form }).select().single();
    if (error) return toast.error(error.message);
    onSaved(data as Supplier);
    toast.success("Fornecedor adicionado");
    setForm({ name: "", phone: "", email: "", notes: "" });
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo fornecedor</DialogTitle>
          <DialogDescription>Cadastre um fornecedor para usar nos pedidos de reposição.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <Field label="Observações"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewOrderDialog({
  open, setOpen, suppliers, products, onSaved,
}: {
  open: boolean; setOpen: (v: boolean) => void;
  suppliers: Supplier[]; products: any[];
  onSaved: (o: PurchaseOrder) => void;
}) {
  const { user } = useStore();
  const [form, setForm] = useState({
    supplier_id: "", product_id: "", product_name: "",
    quantity: 1, unit_cost: 0, notes: "", status: "pendente" as const,
  });
  const total = form.quantity * form.unit_cost;
  async function save() {
    if (!user) return;
    if (!form.product_name) return toast.error("Informe o produto");
    const sup = suppliers.find((s) => s.id === form.supplier_id);
    const payload: any = {
      user_id: user.id,
      supplier_id: form.supplier_id || null,
      supplier_name: sup?.name || "",
      product_id: form.product_id || null,
      product_name: form.product_name,
      quantity: form.quantity,
      unit_cost: form.unit_cost,
      total,
      status: form.status,
    };
    if (form.notes) payload.notes = form.notes;
    const { data, error } = await (supabase.from("purchase_orders" as any) as any).insert(payload).select().single();
    if (error) return toast.error(error.message);
    onSaved(data as PurchaseOrder);
    toast.success("Pedido criado");
    setForm({ supplier_id: "", product_id: "", product_name: "", quantity: 1, unit_cost: 0, notes: "", status: "pendente" });
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo pedido de reposição</DialogTitle>
          <DialogDescription>Registre uma compra junto ao fornecedor.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Fornecedor">
            <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Produto">
            <Select
              value={form.product_id}
              onValueChange={(v) => {
                const p = products.find((x) => x.id === v);
                setForm({ ...form, product_id: v, product_name: p?.name ?? form.product_name, unit_cost: p?.cost ?? form.unit_cost });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione um produto cadastrado" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Ou digite o nome do produto"><Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade"><Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Math.max(1, Number(e.target.value)) })} /></Field>
            <Field label="Custo unitário"><Input type="number" min={0} step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Observações"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="text-right text-sm">Total: <span className="font-bold text-primary">{brl(total)}</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar pedido</Button>
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
