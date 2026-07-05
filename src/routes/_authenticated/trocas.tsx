import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, type Order, type OrderItem, type Product } from "@/lib/store";
import { useActiveStore } from "@/lib/active-store";
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
import { Plus, Trash2, AlertTriangle, Pencil, Search, User, Package, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trocas")({
  head: () => ({ meta: [{ title: "Trocas e Devoluções — ZappFy" }] }),
  component: TrocasPage,
});

type ReturnStatus = "parado_loja" | "com_fornecedor" | "perdido" | "resolvido" | "devolvido_estoque";

type ReturnRow = {
  id: string; type: "cliente" | "fornecedor"; party_name: string;
  customer_phone: string | null;
  product_id: string | null; product_name: string;
  new_product_id: string | null; new_product_name: string;
  quantity: number; reason: string;
  status: ReturnStatus;
  value_at_risk: number; product_price: number;
  return_date: string; order_date: string | null;
  order_id: string | null;
  notes: string; restocked: boolean;
};

const statusList = [
  { value: "parado_loja", label: "Parado na loja", color: "bg-warning/15 text-warning" },
  { value: "com_fornecedor", label: "Com fornecedor", color: "bg-blue-500/15 text-blue-400" },
  { value: "devolvido_estoque", label: "Devolvido ao estoque", color: "bg-emerald-500/15 text-emerald-400" },
  { value: "perdido", label: "Perdido", color: "bg-destructive/15 text-destructive" },
  { value: "resolvido", label: "Resolvido", color: "bg-primary/15 text-primary" },
] as const;

function TrocasPage() {
  const { state, user, updateProduct, updateOrderStatus } = useStore();
  const { activeStoreId } = useActiveStore();
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [tab, setTab] = useState<"cliente" | "fornecedor">("cliente");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReturnRow | null>(null);

  async function load() {
    if (!user) return;
    const storeId = activeStoreId ?? user.id;
    const { data } = await (supabase.from("returns" as any) as any)
      .select("*")
      .or(`store_id.eq.${storeId},and(store_id.is.null,user_id.eq.${user.id})`)
      .order("return_date", { ascending: false });
    if (data) setRows(data as ReturnRow[]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, activeStoreId]);

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

  async function restockIfNeeded(row: ReturnRow) {
    if (row.status !== "devolvido_estoque") return row;
    if (row.restocked) return row;
    if (!row.product_id) {
      toast.warning("Não foi possível devolver ao estoque porque o produto não está vinculado a esta troca.");
      return row;
    }
    const prod = state.products.find((p) => p.id === row.product_id);
    if (prod) {
      const qty = Number(row.quantity) || 0;
      await updateProduct(prod.id, { stock: Number(prod.stock || 0) + qty });
    }
    const { data } = await (supabase.from("returns" as any) as any)
      .update({ restocked: true }).eq("id", row.id).select().single();
    toast.success("Produto devolvido ao estoque");
    return (data as ReturnRow) ?? { ...row, restocked: true };
  }

  async function cancelLinkedOrderIfNeeded(row: ReturnRow) {
    if (row.status !== "devolvido_estoque") return;
    if (!row.order_id) return;
    const order = state.orders.find((o) => o.id === row.order_id);
    if (!order || order.status === "cancelado") return;
    try {
      await updateOrderStatus(row.order_id, "cancelado" as any);
      toast.success("Pedido marcado como cancelado");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível cancelar o pedido vinculado");
    }
  }

  async function updateStatus(id: string, status: ReturnRow["status"]) {
    const { data, error } = await (supabase.from("returns" as any) as any).update({ status }).eq("id", id).select().single();
    if (error) return toast.error(error.message);
    let updated = data as ReturnRow;
    updated = await restockIfNeeded(updated);
    await cancelLinkedOrderIfNeeded(updated);
    setRows((p) => p.map((x) => x.id === id ? updated : x));
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
      title="Trocas e Devoluções"
      subtitle="Gestão de produtos devolvidos e trocas"
      actions={
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova Troca</Button>
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
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => { setEditing(r); setOpen(true); }} className="text-muted-foreground hover:text-primary p-1" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-destructive p-1" title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ReturnDialog
        open={open}
        setOpen={(v) => { setOpen(v); if (!v) setEditing(null); }}
        products={state.products}
        orders={state.orders}
        editing={editing}
        onSaved={async (r, mode) => {
          const updated = await restockIfNeeded(r);
          await cancelLinkedOrderIfNeeded(updated);
          if (mode === "edit") setRows((p) => p.map((x) => x.id === updated.id ? updated : x));
          else setRows((p) => [updated, ...p]);
        }}
        initialType={tab}
      />
    </AppShell>
  );
}

function KPI({ label, value, hint, tone, neon }: { label: React.ReactNode; value: string; hint?: string; tone?: "warning" | "info" | "bad"; neon?: string }) {
  const fallback = tone === "warning" ? "text-warning" : tone === "info" ? "text-blue-400" : tone === "bad" ? "text-destructive" : "";
  const style = neon ? ({ ["--neon-rgb" as any]: neon.replace(/\s+/g, ", ") } as React.CSSProperties) : undefined;
  const valueStyle = neon
    ? { color: `rgb(${neon.replace(/\s+/g, ", ")})`, textShadow: `0 0 12px rgba(${neon.replace(/\s+/g, ", ")}, 0.6)` }
    : undefined;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 card-neon card-neon-hover" style={style}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${neon ? "" : fallback}`} style={valueStyle}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

type FormState = {
  type: "cliente" | "fornecedor";
  party_name: string;
  customer_phone: string;
  product_id: string;
  product_name: string;
  new_product_id: string;
  new_product_name: string;
  quantity: number;
  reason: string;
  status: ReturnStatus;
  value_at_risk: number;
  product_price: number;
  order_id: string | null;
  order_date: string | null;
  return_date: string;
  notes: string;
};

const toDateInput = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const emptyForm = (type: "cliente" | "fornecedor"): FormState => ({
  type, party_name: "", customer_phone: "", product_id: "", product_name: "",
  new_product_id: "", new_product_name: "",
  quantity: 1, reason: "", status: "parado_loja", value_at_risk: 0, product_price: 0,
  order_id: null, order_date: null, return_date: toDateInput(), notes: "",
});

function ReturnDialog({
  open, setOpen, products, orders, onSaved, initialType, editing,
}: {
  open: boolean; setOpen: (v: boolean) => void;
  products: Product[]; orders: Order[];
  onSaved: (r: ReturnRow, mode: "create" | "edit") => void;
  initialType: "cliente" | "fornecedor";
  editing: ReturnRow | null;
}) {
  const { user } = useStore();
  const { activeStoreId } = useActiveStore();
  const [mode, setMode] = useState<"search" | "manual">("manual");
  const [form, setForm] = useState<FormState>(emptyForm(initialType));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setMode(editing.order_id ? "search" : "manual");
      setForm({
        type: editing.type,
        party_name: editing.party_name ?? "",
        customer_phone: editing.customer_phone ?? "",
        product_id: editing.product_id ?? "",
        product_name: editing.product_name ?? "",
        new_product_id: editing.new_product_id ?? "",
        new_product_name: editing.new_product_name ?? "",
        quantity: Number(editing.quantity) || 1,
        reason: editing.reason ?? "",
        status: editing.status,
        value_at_risk: Number(editing.value_at_risk) || 0,
        product_price: Number(editing.product_price) || 0,
        order_id: editing.order_id ?? null,
        order_date: editing.order_date ?? null,
        return_date: toDateInput(editing.return_date),
        notes: editing.notes ?? "",
      });
    } else {
      setMode(initialType === "cliente" ? "search" : "manual");
      setForm(emptyForm(initialType));
    }
  }, [editing, initialType, open]);

  async function save() {
    if (!user) return;
    if (form.type === "cliente" && mode === "search" && !form.order_id) {
      return toast.error("Selecione um pedido antes de salvar a troca/devolução.");
    }
    if (!form.party_name.trim()) return toast.error("Informe o cliente/fornecedor");
    if (!form.product_name.trim()) return toast.error("Informe o produto devolvido");
    if (!form.reason.trim()) return toast.error("Informe o motivo");
    if (!form.status) return toast.error("Selecione o status");

    setSaving(true);
    try {
      const payload: any = {
        type: form.type,
        party_name: form.party_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        product_id: form.product_id || null,
        product_name: form.product_name.trim(),
        new_product_id: form.new_product_id || null,
        new_product_name: form.new_product_name.trim() || null,
        quantity: form.quantity,
        reason: form.reason.trim(),
        status: form.status,
        value_at_risk: form.value_at_risk,
        product_price: form.product_price,
        order_id: form.order_id,
        order_date: form.order_date,
        notes: form.notes.trim() || null,
        store_id: activeStoreId ?? user.id,
      };
      if (editing) {
        const { data, error } = await (supabase.from("returns" as any) as any).update(payload).eq("id", editing.id).select().single();
        if (error) throw error;
        onSaved(data as ReturnRow, "edit");
        toast.success("Registro atualizado");
      } else {
        const { data, error } = await (supabase.from("returns" as any) as any)
          .insert({ ...payload, user_id: user.id }).select().single();
        if (error) throw error;
        onSaved(data as ReturnRow, "create");
        toast.success("Troca registrada");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar troca/devolução" : "Nova troca/devolução"}</DialogTitle>
          <DialogDescription>Registre um produto devolvido pelo cliente ou ao fornecedor.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mb-1">
          <Field label="Tipo">
            <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente devolveu</SelectItem>
                <SelectItem value="fornecedor">Devolução ao fornecedor</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.type === "cliente" && (
            <Field label="Método">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/30 p-1">
                <button type="button" onClick={() => setMode("search")}
                  className={`text-xs py-1.5 rounded-md transition ${mode === "search" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                  <Search className="h-3 w-3 inline mr-1" />Buscar Pedido
                </button>
                <button type="button" onClick={() => setMode("manual")}
                  className={`text-xs py-1.5 rounded-md transition ${mode === "manual" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                  <User className="h-3 w-3 inline mr-1" />Manual
                </button>
              </div>
            </Field>
          )}
        </div>

        {form.type === "cliente" && mode === "search" ? (
          <OrderSearchSection
            orders={orders}
            products={products}
            form={form}
            setForm={setForm}
          />
        ) : (
          <ManualSection form={form} setForm={setForm} products={products} />
        )}

        <div className="grid gap-3 pt-2 border-t border-border mt-3">
          <Field label="Status">
            <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statusList.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Motivo">
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex: defeito, arrependimento, tamanho errado..." />
          </Field>
          <Field label="Observações (opcional)">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {editing ? "Salvar alterações" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderSearchSection({
  orders, products, form, setForm,
}: {
  orders: Order[]; products: Product[];
  form: FormState; setForm: (f: FormState) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 200);
    return () => clearTimeout(t);
  }, [query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as Order[];
    return orders.filter((o) => {
      if (o.customer?.toLowerCase().includes(q)) return true;
      if (o.phone?.toLowerCase().includes(q)) return true;
      if (o.id.toLowerCase().includes(q)) return true;
      if ((o.items || []).some((it) => it.name?.toLowerCase().includes(q))) return true;
      return false;
    }).slice(0, 8);
  }, [query, orders]);

  const selectedOrder = form.order_id ? orders.find((o) => o.id === form.order_id) : null;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function pickOrder(o: Order, item: OrderItem) {
    const prod = products.find((p) => p.id === item.productId);
    setForm({
      ...form,
      order_id: o.id,
      order_date: o.date,
      party_name: o.customer,
      customer_phone: o.phone,
      product_id: item.productId || "",
      product_name: item.name || prod?.name || "",
      quantity: item.qty,
      product_price: item.price,
      value_at_risk: item.price * item.qty,
      notes: form.notes || (o.address ? `Endereço: ${o.address}${o.district ? `, ${o.district}` : ""}${o.city ? ` - ${o.city}` : ""}\nPagamento: ${o.payment}` : ""),
    });
  }

  function handleCardClick(o: Order) {
    const items = o.items || [];
    if (items.length === 1) {
      pickOrder(o, items[0]);
    } else {
      setExpandedId((cur) => (cur === o.id ? null : o.id));
    }
  }

  function clearOrder() {
    setForm({
      ...form,
      order_id: null,
      order_date: null,
      product_id: "",
      product_name: "",
      product_price: 0,
      value_at_risk: 0,
    });
    setExpandedId(null);
  }

  return (
    <div className="grid gap-3">
      {!selectedOrder && (
        <>
          <Field label="Buscar pedido">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome, telefone, ID do pedido ou produto..."
              />
              {loading && <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
          </Field>

          {query && results.length === 0 && !loading && (
            <div className="text-center py-6 text-sm text-muted-foreground rounded-lg border border-dashed border-border">
              Nenhum pedido encontrado para esse cliente ou produto.
            </div>
          )}

          {results.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {results.map((o) => {
                const items = o.items || [];
                const isExpanded = expandedId === o.id;
                return (
                  <div
                    key={o.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleCardClick(o)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(o); } }}
                    className="p-3 cursor-pointer hover:bg-secondary/40 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{o.customer}</div>
                        <div className="text-xs text-muted-foreground">{o.phone} · {fmtDate(o.date)} · {brl(o.total)}</div>
                      </div>
                      <div className="text-[10px] uppercase text-muted-foreground">#{o.id.slice(0, 6)}</div>
                    </div>
                    {items.length > 1 && !isExpanded && (
                      <div className="mt-1 text-[11px] text-muted-foreground">{items.length} itens · clique para escolher</div>
                    )}
                    {(items.length === 1 || isExpanded) && (
                      <div className="mt-2 grid gap-1" onClick={(e) => e.stopPropagation()}>
                        {items.map((it, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => pickOrder(o, it)}
                            className="text-left text-xs bg-secondary/50 hover:bg-primary/20 rounded-md px-2 py-1.5 flex items-center justify-between"
                          >
                            <span className="flex items-center gap-1.5"><Package className="h-3 w-3 text-primary" /> {it.qty}x {it.name}</span>
                            <span className="text-muted-foreground">{brl(it.price)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {selectedOrder && (
        <div className="rounded-lg border-2 border-emerald-500/60 bg-emerald-500/10 p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase text-emerald-400 font-semibold">Pedido selecionado</div>
              <div className="font-semibold text-sm mt-0.5">{selectedOrder.customer}</div>
              <div className="text-xs text-muted-foreground">{selectedOrder.phone} · {fmtDate(selectedOrder.date)} · {brl(selectedOrder.total)}</div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearOrder}>Trocar</Button>
          </div>
          <div className="mt-2 text-xs bg-background/60 rounded px-2 py-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Package className="h-3 w-3 text-emerald-400" /> {form.quantity}x {form.product_name}</span>
            <span className="font-medium">{brl(form.product_price)}</span>
          </div>
        </div>
      )}

      {selectedOrder && form.type === "cliente" && (
        <Field label="Produto novo (em troca — opcional)">
          <Select
            value={form.new_product_id || "__none__"}
            onValueChange={(v) => {
              if (v === "__none__") { setForm({ ...form, new_product_id: "", new_product_name: "" }); return; }
              const p = products.find((x) => x.id === v);
              setForm({ ...form, new_product_id: v, new_product_name: p?.name ?? "" });
            }}
          >
            <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}


function ManualSection({
  form, setForm, products,
}: {
  form: FormState; setForm: (f: FormState) => void; products: Product[];
}) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={form.type === "cliente" ? "Cliente" : "Fornecedor"}>
          <Input value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} />
        </Field>
        <Field label="Telefone (opcional)">
          <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
        </Field>
      </div>
      <Field label="Produto devolvido">
        <Select
          value={form.product_id || "__none__"}
          onValueChange={(v) => {
            if (v === "__none__") { setForm({ ...form, product_id: "" }); return; }
            const p = products.find((x) => x.id === v);
            setForm({
              ...form,
              product_id: v,
              product_name: p?.name ?? form.product_name,
              product_price: p?.price ?? form.product_price,
              value_at_risk: p ? p.price * form.quantity : form.value_at_risk,
            });
          }}
        >
          <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Digitar manualmente —</SelectItem>
            {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Nome do produto">
        <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
      </Field>
      {form.type === "cliente" && (
        <Field label="Novo produto (em troca)">
          <Input value={form.new_product_name} onChange={(e) => setForm({ ...form, new_product_name: e.target.value })} placeholder="Opcional" />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantidade">
          <Input type="number" min={1} value={form.quantity}
            onChange={(e) => {
              const q = Math.max(1, Number(e.target.value));
              setForm({ ...form, quantity: q, value_at_risk: form.product_price ? form.product_price * q : form.value_at_risk });
            }} />
        </Field>
        <Field label="Valor em risco (R$)">
          <Input type="number" min={0} step="0.01" value={form.value_at_risk}
            onChange={(e) => setForm({ ...form, value_at_risk: Number(e.target.value) })} />
        </Field>
      </div>
    </div>
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
