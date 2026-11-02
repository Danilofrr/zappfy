import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, PackageCheck, ShoppingCart, Truck } from "lucide-react";
import { useInventoryAdvisor } from "@/hooks/use-inventory-advisor";
import { useStore } from "@/lib/store";

export function InventoryStockAlert() {
  const { access } = useStore();
  const { forecast, loading, error } = useInventoryAdvisor();
  if (!access?.isOwner || loading || error || !forecast) return null;

  const priorities = forecast.rows.filter(
    (row) => row.priority === "urgente" || row.priority === "comprar",
  );
  if (!priorities.length) return null;

  const urgent = forecast.urgentCount > 0;

  return (
    <section
      aria-label="Alertas de reposição do estoque"
      className={"mb-5 overflow-hidden rounded-2xl border p-4 shadow-elegant sm:p-5 "
        + (urgent ? "border-red-500/30 bg-red-500/[0.055]" : "border-amber-500/30 bg-amber-500/[0.055]")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={"grid h-11 w-11 shrink-0 place-items-center rounded-xl "
            + (urgent ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400")}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold">
              {urgent
                ? "Atenção: " + forecast.urgentCount + " produto(s) podem acabar antes da reposição"
                : forecast.buyNowCount + " produto(s) precisam de reposição"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Alerta calculado com base nas vendas, no estoque atual e no prazo de entrega do fornecedor.
              Consulte o assistente de compras para ver as unidades sugeridas.
            </p>
          </div>
        </div>
        <Link
          to="/produtos"
          hash="assistente"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <ShoppingCart className="h-4 w-4" /> Planejar compras <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {priorities.slice(0, 3).map((row) => (
          <div key={row.product.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/90 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{row.product.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><PackageCheck className="h-3 w-3" />{row.stock} un em estoque</span>
                {row.incoming > 0 && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />{row.incoming} un a caminho</span>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-lg font-extrabold text-primary">{row.buyQuantity} un</div>
              <div className="text-[10px] text-muted-foreground">compra sugerida</div>
            </div>
          </div>
        ))}
      </div>
      {priorities.length > 3 && (
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          E mais {priorities.length - 3} produto(s) com alerta de reposição.
        </p>
      )}
    </section>
  );
}
