import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, type Order, type OrderStatus } from "@/lib/store";
import { brl, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Copy, ExternalLink, MessageCircle, Pencil, Bike } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — LucroTrack" }] }),
  component: PedidosPage,
});

const statusList: { value: OrderStatus; label: string; color: string }[] = [
  { value: "aguardando", label: "Aguardando Pagamento", color: "bg-warning/15 text-warning" },
  { value: "pago", label: "Pago", color: "bg-primary/15 text-primary" },
  { value: "separando", label: "Separando", color: "bg-blue-500/15 text-blue-400" },
  { value: "entrega", label: "Saiu para Entrega", color: "bg-purple-500/15 text-purple-400" },
  { value: "entregue", label: "Entregue", color: "bg-primary/20 text-primary-glow" },
  { value: "cancelado", label: "Cancelado", color: "bg-destructive/15 text-destructive" },
];

const statusMap = Object.fromEntries(statusList.map((s) => [s.value, s]));

type MotoboyContact = { label: string; phone: string };

function loadContacts(): MotoboyContact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("motoboyContacts");
    if (raw) return JSON.parse(raw);
    // migração do formato antigo (um único número)
    const old = localStorage.getItem("motoboyPhone");
    if (old) return [{ label: "Motoboy", phone: old }];
    return [];
  } catch { return []; }
}

function saveContacts(list: MotoboyContact[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem("motoboyContacts", JSON.stringify(list));
  }
}

function applyTemplate(tpl: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, v),
    tpl,
  );
}

function PedidosPage() {
  const { state, addOrder, updateOrder, updateOrderStatus, deleteOrder } = useStore();
  const [editing, setEditing] = useState<Order | null>(null);
  const [motoboyFor, setMotoboyFor] = useState<Order | null>(null);

  function buildMotoboyText(o: Order) {
    const itemsTxt = o.items.map((i) => `• ${i.qty}x ${i.name}`).join("\n");
    const produto = o.items.map((i) => `${i.qty}x ${i.name}`).join(", ");
    const enderecoCompleto = `${o.address}${o.district ? ", " + o.district : ""}${o.city ? " - " + o.city : ""}`;
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
    const tpl = state.settings.motoboyMessageTemplate || "";
    return applyTemplate(tpl, {
      cliente: o.customer,
      telefone: o.phone,
      produto,
      endereco: enderecoCompleto,
      mapa: mapsLink,
      itens: itemsTxt,
      pagamento: o.payment.toUpperCase(),
      total: brl(o.total),
      observacoes: o.notes || "",
      loja: state.settings.storeName || "",
    });
  }

  function notifyDelivery(o: Order) {
    const phone = (o.phone || "").replace(/\D/g, "");
    if (!phone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    const storeName = state.settings.storeName || "nossa loja";
    const item = o.items[0]?.name ? ` (${o.items[0].name})` : "";
    const endereco = `${o.address}${o.district ? ", " + o.district : ""}${o.city ? " - " + o.city : ""}`;
    const tpl = state.settings.deliveryMessageTemplate || "";
    const text = applyTemplate(tpl, {
      cliente: o.customer,
      telefone: o.phone,
      produto: item,
      endereco,
      loja: storeName,
      total: brl(o.total),
      observacoes: o.notes || "",
    });
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_blank");
  }




  function handleStatusChange(o: Order, status: OrderStatus) {
    updateOrderStatus(o.id, status);
    if (status === "entrega" && o.status !== "entrega") {
      setTimeout(() => notifyDelivery(o), 200);
    }
  }


  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => state.orders.filter((o) => filter === "all" || o.status === filter),
    [state.orders, filter],
  );

  const checkoutLink =
    typeof window !== "undefined" ? `${window.location.origin}/checkout` : "/checkout";

  return (
    <AppShell
      title="Pedidos"
      subtitle="Gerencie todos os pedidos recebidos pelo WhatsApp"
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(checkoutLink);
              toast.success("Link do checkout copiado!");
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Copiar link</span>
          </Button>
          <NewOrderDialog open={open} setOpen={setOpen} onCreate={(o) => { addOrder(o); toast.success("Pedido criado!"); setOpen(false); }} />
        </div>
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>Todos</Chip>
        {statusList.map((s) => (
          <Chip key={s.value} active={filter === s.value} onClick={() => setFilter(s.value)}>{s.label}</Chip>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-elegant">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Produto</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Bairro</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Data</th>
                <th className="text-right px-4 py-3 font-medium">Valor</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum pedido encontrado.</td></tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.customer}</div>
                    <div className="text-xs text-muted-foreground">{o.phone}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="truncate max-w-[260px]">{o.items[0]?.name}</div>
                    <div className="text-xs text-muted-foreground">Qtd: {o.items[0]?.qty} · {o.payment.toUpperCase()}</div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">{o.district}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{fmtDate(o.date)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{brl(o.total)}</td>
                  <td className="px-4 py-3">
                    <Select value={o.status} onValueChange={(v) => handleStatusChange(o, v as OrderStatus)}>
                      <SelectTrigger className={`h-8 w-[170px] border-0 ${statusMap[o.status].color}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusList.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(o)}
                        title="Editar pedido"
                        className="text-muted-foreground hover:text-primary p-1"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => sendToMotoboy(o)}
                        title="Enviar endereço para o motoboy no WhatsApp"
                        className="text-muted-foreground hover:text-blue-500 p-1"
                      >
                        <Bike className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => notifyDelivery(o)}
                        title="Avisar cliente no WhatsApp que o pedido saiu para entrega"
                        className="text-muted-foreground hover:text-green-500 p-1"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Excluir este pedido? O estoque será devolvido.")) deleteOrder(o.id); }}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <a
        href={checkoutLink}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Abrir página de checkout pública
      </a>

      <EditOrderDialog
        order={editing}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return;
          await updateOrder(editing.id, patch);
          toast.success("Pedido atualizado!");
          setEditing(null);
        }}
      />
    </AppShell>
  );
}

function EditOrderDialog({
  order, onClose, onSave,
}: {
  order: Order | null;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Order, "id" | "items">>) => void;
}) {
  const [form, setForm] = useState({
    customer: "", phone: "", address: "", district: "", city: "",
    payment: "pix" as const, status: "aguardando" as OrderStatus, notes: "",
  });

  // Sincroniza ao abrir
  useMemo(() => {
    if (order) {
      setForm({
        customer: order.customer, phone: order.phone, address: order.address,
        district: order.district, city: order.city,
        payment: order.payment as any, status: order.status, notes: order.notes ?? "",
      });
    }
  }, [order]);

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar pedido</DialogTitle>
          <DialogDescription>Altere os dados do cliente, endereço e status.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente"><Input value={form.customer} onChange={(e) => setForm({...form, customer: e.target.value})} /></Field>
            <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></Field>
          </div>
          <Field label="Endereço"><Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bairro"><Input value={form.district} onChange={(e) => setForm({...form, district: e.target.value})} /></Field>
            <Field label="Cidade"><Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pagamento">
              <Select value={form.payment} onValueChange={(v: any) => setForm({...form, payment: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v: any) => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {statusList.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Observações"><Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(form)}>Salvar alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function NewOrderDialog({ open, setOpen, onCreate }: { open: boolean; setOpen: (v: boolean) => void; onCreate: (o: Omit<Order, "id">) => void }) {
  const { state } = useStore();
  const [form, setForm] = useState({
    customer: "", phone: "", address: "", district: "", city: "",
    productId: state.products[0]?.id ?? "", qty: 1, payment: "pix" as const, status: "aguardando" as OrderStatus, notes: "",
  });
  const p = state.products.find((x) => x.id === form.productId);
  const total = (p?.price ?? 0) * form.qty;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Novo Pedido</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>Registre manualmente um pedido recebido.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente"><Input value={form.customer} onChange={(e) => setForm({...form, customer: e.target.value})} /></Field>
            <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></Field>
          </div>
          <Field label="Endereço"><Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bairro"><Input value={form.district} onChange={(e) => setForm({...form, district: e.target.value})} /></Field>
            <Field label="Cidade"><Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Produto">
              <Select value={form.productId} onValueChange={(v) => setForm({...form, productId: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {state.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Quantidade"><Input type="number" min={1} value={form.qty} onChange={(e) => setForm({...form, qty: Math.max(1, Number(e.target.value))})} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pagamento">
              <Select value={form.payment} onValueChange={(v: any) => setForm({...form, payment: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v: any) => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {statusList.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Observações"><Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></Field>
          <div className="text-right text-sm">Total: <span className="font-bold text-primary">{brl(total)}</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => {
            if (!p || !form.customer) { toast.error("Preencha cliente e produto"); return; }
            onCreate({
              customer: form.customer, phone: form.phone, address: form.address,
              district: form.district, city: form.city,
              items: [{ productId: p.id, name: p.name, qty: form.qty, price: p.price, cost: p.cost }],
              total, payment: form.payment, status: form.status, notes: form.notes,
              date: new Date().toISOString(),
            });
          }}>Salvar pedido</Button>
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
