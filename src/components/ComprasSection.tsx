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
import { Plus, Trash2, Truck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

export function ComprasSection() {
  const { state, user, updateProduct } = useStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [sub, setSub] = useState<"pedidos" | "fornecedores">("pedidos");
  const [openOrder, setOpenOrder] = useState(false);
  const [openSup, setOpenSup] = useState(false);

  const productStockById = useMemo(() => {
    const m = new Map<string, number>();
    state.products.forEach((p) => m.set(p.id, p.stock));
    return m;
  }, [state.products]);

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

  async function adjustStock(productId: string | null, delta: number) {
    if (!productId || !delta) return;
    const prod = state.products.find((p) => p.id === productId);
    if (!prod) return;
    const newStock = Math.max(0, (prod.stock || 0) + delta);
    try { await updateProduct(productId, { stock: newStock }); } catch (e: any) { toast.error(e?.message || "Erro ao atualizar estoque"); }
  }

  async function deleteOrder(id: string) {
    if (!confirm("Excluir este pedido de reposição?")) return;
    const target = orders.find((x) => x.id === id);
    const { error } = await (supabase.from("purchase_orders" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (target && target.status === "recebido" && target.product_id) {
      await adjustStock(target.product_id, -Number(target.quantity || 0));
    }
    setOrders((p) => p.filter((x) => x.id !== id));
    toast.success("Pedido excluído");
  }
  async function updateStatus(id: string, status: PurchaseOrder["status"]) {
    const current = orders.find((x) => x.id === id);
    const patch: any = { status };
    if (status === "recebido") patch.received_date = new Date().toISOString();
    const { data, error } = await (supabase.from("purchase_orders" as any) as any).update(patch).eq("id", id).select().single();
    if (error) return toast.error(error.message);
    const updated = data as PurchaseOrder;
    if (current && current.status !== "recebido" && status === "recebido" && updated.product_id) {
      await adjustStock(updated.product_id, Number(updated.quantity || 0));
      toast.success(`Estoque atualizado (+${updated.quantity})`);
    } else if (current && current.status === "recebido" && status !== "recebido" && updated.product_id) {
      await adjustStock(updated.product_id, -Number(updated.quantity || 0));
      toast.success(`Estoque revertido (-${updated.quantity})`);
    }
    setOrders((p) => p.map((x) => x.id === id ? updated : x));
  }
  async function deleteSupplier(id: string) {
    if (!confirm("Excluir este fornecedor?")) return;
    const { error } = await (supabase.from("suppliers" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSuppliers((p) => p.filter((x) => x.id !== id));
    toast.success("Fornecedor excluído");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex gap-2">
          <Button variant={sub === "pedidos" ? "default" : "outline"} size="sm" onClick={() => setSub("pedidos")}>
            <Truck className="h-4 w-4 mr-1" />Pedidos de Reposição
          </Button>
          <Button variant={sub === "fornecedores" ? "default" : "outline"} size="sm" onClick={() => setSub("fornecedores")}>
            <Users className="h-4 w-4 mr-1" />Fornecedores
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpenSup(true)}><Users className="h-4 w-4 mr-1" />Fornecedor</Button>
          <Button size="sm" onClick={() => setOpenOrder(true)}><Plus className="h-4 w-4 mr-1" />Novo Pedido</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <KPI label="Pedidos Pendentes" value={brl(totals.pend)} hint={`${orders.filter((o) => o.status === "pendente").length} pedido(s)`} neon="251 191 36" />
        <KPI label="Recebido (total)" value={brl(totals.rec)} hint={`${orders.filter((o) => o.status === "recebido").length} pedido(s)`} neon="56 189 248" />
        <KPI label="Fornecedores" value={String(suppliers.length)} hint="cadastrados" neon="167 139 250" />
      </div>

      {sub === "pedidos" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-elegant">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Fornecedor</th>
                  <th className="text-left px-4 py-3">Produto</th>
                  <th className="text-right px-4 py-3">Qtd</th>
                  <th className="text-right px-4 py-3">Estoque atual</th>
                  <th className="text-right px-4 py-3">Estoque após receber</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Nenhum pedido de reposição.</td></tr>
                )}
                {orders.map((o) => {
                  const st = statusList.find((s) => s.value === o.status)!;
                  const stock = o.product_id ? productStockById.get(o.product_id) : undefined;
                  return (
                    <tr key={o.id} className="border-t border-border hover:bg-secondary/30">
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.order_date)}</td>
                      <td className="px-4 py-3">{o.supplier_name || "—"}</td>
                      <td className="px-4 py-3">{o.product_name}</td>
                      <td className="px-4 py-3 text-right">{o.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        {stock === undefined
                          ? <span className="text-muted-foreground text-xs">—</span>
                          : <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${stock === 0 ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>{stock} un</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {stock === undefined ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : o.status === "recebido" ? (
                          <span className="text-muted-foreground text-xs">já somado</span>
                        ) : o.status === "cancelado" ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-success/15 text-success">
                            {stock + Number(o.quantity || 0)} un
                          </span>
                        )}
                      </td>
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

      {sub === "fornecedores" && (
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
        onSaved={(o) => {
          setOrders((p) => [o, ...p]);
          if (o.status === "recebido" && o.product_id) {
            adjustStock(o.product_id, Number(o.quantity || 0));
          }
        }}
      />
    </div>
  );
}

function KPI({ label, value, hint, neon }: { label: string; value: string; hint?: string; neon?: string }) {
  const style = neon ? ({ ["--neon-rgb" as any]: neon.replace(/\s+/g, ", ") } as React.CSSProperties) : undefined;
  const valueStyle = neon
    ? { color: `rgb(${neon.replace(/\s+/g, ", ")})`, textShadow: `0 0 12px rgba(${neon.replace(/\s+/g, ", ")}, 0.6)` }
    : undefined;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 card-neon card-neon-hover" style={style}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1" style={valueStyle}>{value}</div>
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

type OrderItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
};

function NewOrderDialog({
  open, setOpen, suppliers, products, onSaved,
}: {
  open: boolean; setOpen: (v: boolean) => void;
  suppliers: Supplier[]; products: any[];
  onSaved: (o: PurchaseOrder) => void;
}) {
  const { user } = useStore();
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"pendente" | "recebido" | "cancelado">("pendente");
  const emptyItem = (): OrderItem => ({ product_id: "", product_name: "", quantity: 1, unit_cost: 0 });
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);

  const grandTotal = items.reduce((s, it) => s + it.quantity * it.unit_cost, 0);

  function updateItem(idx: number, patch: Partial<OrderItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() { setItems((p) => [...p, emptyItem()]); }
  function removeItem(idx: number) {
    setItems((p) => (p.length === 1 ? p : p.filter((_, i) => i !== idx)));
  }

  function reset() {
    setSupplierId(""); setNotes(""); setStatus("pendente"); setItems([emptyItem()]);
  }

  async function save() {
    if (!user) return;
    const valid = items.filter((it) => it.product_name.trim());
    if (valid.length === 0) return toast.error("Adicione ao menos um produto");
    const sup = suppliers.find((s) => s.id === supplierId);
    const rows = valid.map((it) => {
      const payload: any = {
        user_id: user.id,
        supplier_id: supplierId || null,
        supplier_name: sup?.name || "",
        product_id: it.product_id || null,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_cost: it.unit_cost,
        total: it.quantity * it.unit_cost,
        status,
      };
      if (notes) payload.notes = notes;
      return payload;
    });
    const { data, error } = await (supabase.from("purchase_orders" as any) as any).insert(rows).select();
    if (error) return toast.error(error.message);
    (data as PurchaseOrder[]).forEach((o) => onSaved(o));
    toast.success(rows.length > 1 ? `${rows.length} produtos adicionados` : "Pedido criado");
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo pedido de reposição</DialogTitle>
          <DialogDescription>Adicione um ou vários produtos do mesmo fornecedor.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Fornecedor">
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Produtos</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />Adicionar produto
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2 bg-secondary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Produto #{idx + 1}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Field label="Selecionar produto cadastrado">
                    <Select
                      value={it.product_id}
                      onValueChange={(v) => {
                        const p = products.find((x) => x.id === v);
                        updateItem(idx, {
                          product_id: v,
                          product_name: p?.name ?? it.product_name,
                          unit_cost: p?.cost ?? it.unit_cost,
                        });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                      <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Ou digite o nome do produto">
                    <Input value={it.product_name} onChange={(e) => updateItem(idx, { product_name: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Quantidade">
                      <Input type="number" min={1} value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value)) })} />
                    </Field>
                    <Field label="Custo unitário">
                      <Input type="number" min={0} step="0.01" value={it.unit_cost}
                        onChange={(e) => updateItem(idx, { unit_cost: Number(e.target.value) })} />
                    </Field>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    Subtotal: <span className="font-semibold text-foreground">{brl(it.quantity * it.unit_cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="Observações"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">{items.filter(i => i.product_name.trim()).length} produto(s)</span>
            <div className="text-right text-sm">Total geral: <span className="font-bold text-primary text-base">{brl(grandTotal)}</span></div>
          </div>
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
