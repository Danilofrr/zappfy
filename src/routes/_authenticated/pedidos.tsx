import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, DEFAULT_DELIVERY_TEMPLATE, DEFAULT_MOTOBOY_TEMPLATE, type Order, type OrderStatus } from "@/lib/store";
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
  head: () => ({ meta: [{ title: "Pedidos — ZappFy" }] }),
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
    const savedM = state.settings.motoboyMessageTemplate || "";
    const tpl = savedM && /\p{Extended_Pictographic}/u.test(savedM) ? savedM : DEFAULT_MOTOBOY_TEMPLATE;
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
    const saved = state.settings.deliveryMessageTemplate || "";
    // If the saved template has lost its emojis (e.g. stored as "?" or pure ASCII),
    // fall back to the default so the WhatsApp message keeps emojis intact.
    const hasEmoji = /\p{Extended_Pictographic}/u.test(saved);
    const looksBroken = /\?\s+Seu pedido|\?\s+Ol[aá]|chamar por aqui\.\s*\?/.test(saved);
    const tpl = !saved || looksBroken || !hasEmoji ? DEFAULT_DELIVERY_TEMPLATE : saved;
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
                    <div className="truncate max-w-[260px]">
                      {o.items.map((it) => `${it.qty}x ${it.name}`).join(", ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.items.reduce((n, it) => n + it.qty, 0)} item(s) · {o.payment.toUpperCase()}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">{o.district}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{fmtDate(o.date)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-semibold">{brl(o.total)}</div>
                    {(() => {
                      const cost = o.items.reduce((s, it) => s + (it.cost ?? 0) * it.qty, 0);
                      const profit = o.total - cost;
                      const cls = profit >= 0 ? "text-primary" : "text-destructive";
                      return (
                        <div className={`text-[11px] font-medium ${cls}`} title="Lucro líquido (venda - custo)">
                          Lucro: {brl(profit)}
                        </div>
                      );
                    })()}
                  </td>
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
                        onClick={() => setMotoboyFor(o)}
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

      <MotoboyDialog
        order={motoboyFor}
        onClose={() => setMotoboyFor(null)}
        buildText={buildMotoboyText}
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

const PRODUCT_COLORS = [
  "bg-rose-500/15 text-rose-400 border-rose-500/30",
  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "bg-sky-500/15 text-sky-400 border-sky-500/30",
  "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "bg-lime-500/15 text-lime-400 border-lime-500/30",
  "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
];
function colorForProduct(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PRODUCT_COLORS[h % PRODUCT_COLORS.length];
}

type CartLine = { productId: string; qty: number };

function NewOrderDialog({ open, setOpen, onCreate }: { open: boolean; setOpen: (v: boolean) => void; onCreate: (o: Omit<Order, "id">) => void }) {
  const { state } = useStore();
  const [form, setForm] = useState({
    customer: "", phone: "", address: "", district: "", city: "",
    payment: "pix" as const, status: "aguardando" as OrderStatus, notes: "",
  });
  const [lines, setLines] = useState<CartLine[]>([]);
  const [picker, setPicker] = useState<string>("");

  const selectedIds = new Set(lines.map((l) => l.productId));
  const available = state.products.filter((p) => !selectedIds.has(p.id));
  const total = lines.reduce((sum, l) => {
    const prod = state.products.find((p) => p.id === l.productId);
    return sum + (prod?.price ?? 0) * l.qty;
  }, 0);

  function addLine(productId: string) {
    if (!productId || selectedIds.has(productId)) return;
    setLines((prev) => [...prev, { productId, qty: 1 }]);
    setPicker("");
  }
  function updateQty(productId: string, qty: number) {
    setLines((prev) => prev.map((l) => l.productId === productId ? { ...l, qty: Math.max(1, qty) } : l));
  }
  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  function reset() {
    setForm({ customer: "", phone: "", address: "", district: "", city: "", payment: "pix", status: "aguardando", notes: "" });
    setLines([]);
    setPicker("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Novo Pedido</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>Registre manualmente um pedido recebido. Adicione um ou mais produtos.</DialogDescription>
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

          {/* Produtos do pedido */}
          <div className="space-y-2">
            <Label className="text-xs">Produtos do pedido</Label>
            <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
              {lines.length === 0 && (
                <div className="text-xs text-muted-foreground py-2 text-center">Nenhum produto adicionado ainda.</div>
              )}
              {lines.map((l) => {
                const prod = state.products.find((p) => p.id === l.productId);
                if (!prod) return null;
                const color = colorForProduct(prod.id);
                const sub = prod.price * l.qty;
                return (
                  <div key={l.productId} className={`flex items-center gap-2 rounded-lg border p-2 ${color}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate text-foreground">{prod.name}</div>
                      <div className="text-xs text-muted-foreground">{brl(prod.price)} · subtotal {brl(sub)}</div>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => updateQty(l.productId, Number(e.target.value))}
                      className="h-8 w-16 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(l.productId)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}

              {available.length > 0 ? (
                <div className="flex gap-2 pt-1">
                  <Select value={picker} onValueChange={addLine}>
                    <SelectTrigger className="h-9 flex-1">
                      <SelectValue placeholder="+ Adicionar produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((p) => {
                        const color = colorForProduct(p.id);
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full ${color.split(" ")[0]}`} />
                              <span>{p.name}</span>
                              <span className="text-xs text-muted-foreground ml-1">{brl(p.price)}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ) : state.products.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center pt-1">Cadastre produtos primeiro.</div>
              ) : (
                <div className="text-xs text-muted-foreground text-center pt-1">Todos os produtos já foram adicionados.</div>
              )}
            </div>
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
            if (!form.customer) { toast.error("Preencha o nome do cliente"); return; }
            if (lines.length === 0) { toast.error("Adicione ao menos um produto"); return; }
            const items = lines.map((l) => {
              const prod = state.products.find((p) => p.id === l.productId)!;
              return { productId: prod.id, name: prod.name, qty: l.qty, price: prod.price, cost: prod.cost };
            });
            onCreate({
              customer: form.customer, phone: form.phone, address: form.address,
              district: form.district, city: form.city,
              items,
              total, payment: form.payment, status: form.status, notes: form.notes,
              date: new Date().toISOString(),
            });
            reset();
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

function MotoboyDialog({
  order, onClose, buildText,
}: {
  order: Order | null;
  onClose: () => void;
  buildText: (o: Order) => string;
}) {
  const [contacts, setContacts] = useState<MotoboyContact[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [text, setText] = useState("");

  useMemo(() => {
    if (order) {
      setContacts(loadContacts());
      setText(buildText(order));
    }
  }, [order]);

  function addContact() {
    const phone = newPhone.replace(/\D/g, "");
    if (!newLabel.trim()) { toast.error("Dê um nome ao contato"); return; }
    if (phone.length < 10) { toast.error("Número inválido"); return; }
    const list = [...contacts, { label: newLabel.trim(), phone }];
    setContacts(list); saveContacts(list);
    setNewLabel(""); setNewPhone("");
  }

  function removeContact(i: number) {
    const list = contacts.filter((_, idx) => idx !== i);
    setContacts(list); saveContacts(list);
  }

  function send(phone: string) {
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_blank");
    onClose();
  }

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar para o motoboy</DialogTitle>
          <DialogDescription>Escolha um contato salvo ou cadastre um novo (grupo ou número).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Mensagem (você pode ajustar antes de enviar)">
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>

          <div>
            <Label className="text-xs">Enviar para</Label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {contacts.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum contato salvo ainda.</p>
              )}
              {contacts.map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.phone}</div>
                  </div>
                  <Button size="sm" onClick={() => send(c.phone)}>Enviar</Button>
                  <button onClick={() => removeContact(i)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border p-3">
            <Label className="text-xs">Adicionar novo contato</Label>
            <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input placeholder="Nome (ex: Motoboy João, Grupo Entregas)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              <Input placeholder="DDD + número" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} inputMode="numeric" />
              <Button variant="outline" onClick={addContact}><Plus className="h-4 w-4" /></Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Para enviar a um grupo do WhatsApp, use o número de um administrador ou crie um contato com o link do grupo (o WhatsApp só aceita envio direto a números — para grupos, abra o grupo e cole a mensagem manualmente).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
