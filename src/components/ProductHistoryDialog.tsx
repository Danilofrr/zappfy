import { useMemo } from "react";
import { useStore, type Product } from "@/lib/store";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowDownLeft, ArrowUpRight, RotateCcw } from "lucide-react";

type Entry = {
  key: string;
  date: string;
  kind: "compra" | "estorno" | "venda";
  qty: number;
  unitCost?: number;
  total?: number;
  label: string;
  movementId?: string;
  reversed?: boolean;
};

function fmt(d: string) {
  const dt = new Date(d);
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ProductHistoryDialog({
  open, onOpenChange, product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
}) {
  const { state, reverseStockPurchase } = useStore();

  const entries = useMemo<Entry[]>(() => {
    if (!product) return [];
    const movs = state.stockMovements.filter((m) => m.productId === product.id);
    const reversedPOs = new Set(movs.filter((m) => m.type === "estorno").map((m) => m.purchaseOrderId));

    const list: Entry[] = movs.map((m) => ({
      key: m.id,
      date: m.occurredAt,
      kind: m.type === "estorno" ? "estorno" : "compra",
      qty: m.quantity,
      unitCost: m.unitCost,
      total: m.total,
      label: m.type === "estorno"
        ? "Estorno de compra"
        : `Compra${m.supplierName ? ` — ${m.supplierName}` : ""}`,
      movementId: m.id,
      reversed: m.type === "compra" && !!m.purchaseOrderId && reversedPOs.has(m.purchaseOrderId),
    }));

    state.orders.forEach((o) => {
      if (o.status === "cancelado") return;
      const qty = o.items.filter((i) => i.productId === product.id).reduce((a, i) => a + i.qty, 0);
      if (!qty) return;
      list.push({
        key: `order-${o.id}`,
        date: o.date,
        kind: "venda",
        qty: -qty,
        label: `Venda — ${o.customer}`,
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [product, state.stockMovements, state.orders]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de movimentações</DialogTitle>
          <DialogDescription>
            {product?.name} — estoque atual: <span className="text-foreground font-semibold">{product?.stock ?? 0} un</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {entries.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">Nenhuma movimentação registrada.</div>
          )}
          {entries.map((e) => (
            <div key={e.key} className="rounded-lg border border-border bg-secondary/20 p-3 flex items-start gap-3">
              <div className={`h-8 w-8 shrink-0 rounded-lg grid place-items-center ${
                e.kind === "venda" ? "bg-sky-500/15 text-sky-400"
                  : e.kind === "estorno" ? "bg-orange-500/15 text-orange-400"
                  : "bg-primary/15 text-primary"
              }`}>
                {e.kind === "venda" ? <ArrowUpRight className="h-4 w-4" />
                  : e.kind === "estorno" ? <RotateCcw className="h-4 w-4" />
                  : <ArrowDownLeft className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{e.label}</div>
                <div className="text-xs text-muted-foreground">{fmt(e.date)}</div>
                {e.kind !== "venda" && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {brl(e.unitCost ?? 0)}/un · Total: <span className="text-foreground font-semibold">{brl(Math.abs(e.total ?? 0))}</span>
                    {e.kind === "compra" ? " (saiu do caixa)" : " (voltou ao caixa)"}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className={`text-sm font-bold ${e.qty >= 0 ? "text-primary" : "text-destructive"}`}>
                  {e.qty >= 0 ? "+" : ""}{e.qty} un
                </div>
                {e.kind === "compra" && !e.reversed && e.movementId && (
                  <button
                    className="text-[11px] text-muted-foreground hover:text-destructive underline mt-1"
                    onClick={() => {
                      if (confirm("Estornar esta compra? O estoque será reduzido e o valor volta ao caixa.")) {
                        reverseStockPurchase(e.movementId!);
                      }
                    }}
                  >
                    estornar
                  </button>
                )}
                {e.reversed && <div className="text-[11px] text-orange-400 mt-1">estornada</div>}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
