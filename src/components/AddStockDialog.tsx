import { useEffect, useMemo, useState } from "react";
import { useStore, type Product } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Supplier = { id: string; name: string };

const paymentOptions = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão de crédito" },
  { value: "debito", label: "Cartão de débito" },
  { value: "boleto", label: "Boleto" },
  { value: "outros", label: "Outros" },
];

function toDateInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function AddStockDialog({
  open, onOpenChange, product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
}) {
  const { addStockPurchase } = useStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [payment, setPayment] = useState("pix");
  const [date, setDate] = useState(toDateInput(new Date()));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQty("");
    setUnitCost(product ? String(product.cost ?? "") : "");
    setSupplierId("");
    setPayment("pix");
    setDate(toDateInput(new Date()));
    setNotes("");
    supabase.from("suppliers").select("id,name").order("name").then(({ data }) => {
      if (data) setSuppliers(data as Supplier[]);
    });
  }, [open, product]);

  const q = Math.max(0, Math.trunc(Number(qty.replace(",", ".")) || 0));
  const cost = Math.max(0, Number(unitCost.replace(",", ".")) || 0);
  const total = useMemo(() => Math.round(q * cost * 100) / 100, [q, cost]);
  const current = product?.stock ?? 0;

  async function confirm() {
    if (!product) return;
    if (!q) return toast.error("Informe a quantidade que está entrando");
    setSaving(true);
    try {
      const occurredAt = new Date(`${date}T12:00:00`).toISOString();
      const mv = await addStockPurchase({
        productId: product.id,
        productName: product.name,
        quantity: q,
        unitCost: cost,
        supplierId: supplierId || null,
        supplierName: suppliers.find((s) => s.id === supplierId)?.name || "",
        paymentMethod: payment,
        notes,
        occurredAt,
      });
      if (mv) {
        toast.success(`Entrada confirmada: ${current} + ${q} = ${current + q} un`);
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar estoque</DialogTitle>
          <DialogDescription>
            A quantidade é somada ao estoque atual e o valor da compra sai do Saldo em Caixa.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <div className="text-sm font-semibold">{product?.name ?? "—"}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Estoque atual: <span className="text-foreground font-semibold">{current} un</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Quantidade entrando</Label>
              <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Custo unitário</Label>
              <Input inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fornecedor</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Data da compra</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>

          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Estoque atual</span><span>{current} un</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Entrada</span><span className="text-primary font-semibold">+{q} un</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Novo estoque</span><span className="font-bold">{current + q} un</span></div>
            <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="text-muted-foreground">Valor da compra</span><span className="font-semibold">{brl(total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Será descontado do Saldo em Caixa</span><span className="font-bold text-destructive">- {brl(total)}</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={saving || !q}>{saving ? "Salvando..." : "Confirmar entrada"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
