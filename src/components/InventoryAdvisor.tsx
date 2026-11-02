import { useEffect, useMemo, useState } from "react";
import { brl, fmtBusinessDate } from "@/lib/format";
import { useInventoryAdvisor } from "@/hooks/use-inventory-advisor";
import {
  type InventoryPlanningSettings,
  type ProductForecast,
  type InventoryPriority,
} from "@/lib/inventory-forecast";
import {
  AlertTriangle, CalendarClock, Check, ChevronDown,
  ChevronUp, ClipboardCopy, Clock3, Info, Loader2, Package, Search, Settings2,
  ShieldCheck, ShoppingCart, Sparkles, TrendingUp, Truck, Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export type PurchaseSuggestion = { productId: string; quantity: number };

type Filter = "todos" | "urgentes" | "comprar" | "programar" | "sem_historico";

const PRIORITY_META: Record<InventoryPriority, { label: string; tone: string }> = {
  urgente: { label: "Risco de faltar", tone: "bg-red-500/10 text-red-400 border-red-500/30" },
  comprar: { label: "Comprar agora", tone: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  programar: { label: "Programar compra", tone: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  estavel: { label: "Estoque suficiente", tone: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  sem_historico: { label: "Sem dados suficientes", tone: "bg-secondary text-muted-foreground border-border" },
};

function businessDate(d: Date): string {
  return fmtBusinessDate(d);
}

function roundedRate(number: number): string {
  return number.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

function priorityLabel(row: ProductForecast) {
  const result = PRIORITY_META[row.priority];
  return <span className={"inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold " + result.tone}>{result.label}</span>;
}

export function InventoryAdvisor({ onCreatePurchase }: {
  onCreatePurchase: (items: PurchaseSuggestion[]) => void;
}) {
  const { forecast, settings, loading, refreshing, error, saveSettings, refresh } = useInventoryAdvisor();
  const [filter, setFilter] = useState<Filter>("todos");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState<InventoryPlanningSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings.leadDays, settings.reviewDays, settings.safetyDays]);

  const rows = useMemo(() => {
    if (!forecast) return [];
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return forecast.rows.filter((row) => {
      const matchesSearch = !term
        || row.product.name.toLocaleLowerCase("pt-BR").includes(term)
        || row.product.category.toLocaleLowerCase("pt-BR").includes(term);
      if (!matchesSearch) return false;
      if (filter === "urgentes") return row.priority === "urgente";
      if (filter === "comprar") return row.priority === "urgente" || row.priority === "comprar";
      if (filter === "programar") return row.priority === "programar";
      if (filter === "sem_historico") return row.priority === "sem_historico";
      return true;
    });
  }, [forecast, filter, search]);

  const buyNow = forecast?.rows.filter(
    (row) => row.buyQuantity > 0 && (row.priority === "urgente" || row.priority === "comprar"),
  ) ?? [];

  async function copyPurchaseList() {
    if (!buyNow.length) {
      toast.message("Nenhuma compra urgente indicada no momento.");
      return;
    }
    const lines = [
      "LISTA DE REPOSIÇÃO — ZAPPFY",
      "Data: " + businessDate(new Date()),
      "Prazo de entrega considerado: até " + settings.leadDays + " dias",
      "",
      ...buyNow.map((row) =>
        "• " + row.product.name + ": " + row.buyQuantity + " un (estoque " + row.stock + ", a caminho " + row.incoming + ")",
      ),
      "",
      "Previsão por histórico de vendas; confirme valores e disponibilidade com o fornecedor.",
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Lista copiada! Você pode enviar ao fornecedor pelo WhatsApp.");
    } catch {
      toast.error("Não foi possível copiar. Verifique a permissão da área de transferência.");
    }
  }

  async function persistSettings() {
    if (saving) return;
    if (!Number.isInteger(localSettings.leadDays) || localSettings.leadDays < 1 || localSettings.leadDays > 30
      || !Number.isInteger(localSettings.reviewDays) || localSettings.reviewDays < 1 || localSettings.reviewDays > 60
      || !Number.isInteger(localSettings.safetyDays) || localSettings.safetyDays < 0 || localSettings.safetyDays > 30) {
      toast.error("Revise os prazos: entrega de 1–30, compras de 1–60 e segurança de 0–30 dias.");
      return;
    }
    setSaving(true);
    try {
      await saveSettings(localSettings);
      toast.success("Parâmetros de compra atualizados.");
      setShowSettings(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-primary" />
        <h3 className="font-semibold">Analisando vendas e estoque</h3>
        <p className="mt-1 text-sm text-muted-foreground">Consultando todas as vendas registradas dos últimos meses.</p>
      </div>
    );
  }

  if (error || !forecast) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-card p-6">
        <h3 className="font-semibold">Não foi possível atualizar as recomendações.</h3>
        <p className="mt-2 text-sm text-muted-foreground">O estoque não foi alterado. Tente atualizar a análise.</p>
        <Button className="mt-4" variant="outline" onClick={() => void refresh()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] via-card to-card p-5 shadow-elegant sm:p-6">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Assistente inteligente de compras
            </div>
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Saiba quanto comprar e quando pedir</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Análise das vendas registradas de cada produto, estoque disponível, pedidos já feitos e prazo de chegada do fornecedor.
              O cálculo é uma projeção estatística, não uma garantia de vendas futuras.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
              Atualizar análise
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowSettings((v) => !v)}>
              <Settings2 className="mr-2 h-4 w-4" /> Ajustar prazos
            </Button>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-primary" /> Ciclo: <strong className="text-foreground">{businessDate(forecast.cycleStart)} a {businessDate(forecast.cycleEnd)}</strong></span>
          <span>Fechamento em <strong className="text-foreground">{forecast.daysToClose} dias</strong> (todo dia 15)</span>
          <span>Transporte: <strong className="text-foreground">até {settings.leadDays} dias</strong></span>
          <span>Compras: <strong className="text-foreground">a cada {settings.reviewDays} dias</strong></span>
          <span>Segurança: <strong className="text-foreground">{settings.safetyDays} dias</strong></span>
        </div>
      </div>

      {showSettings && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-1 flex items-center gap-2 font-semibold"><Settings2 className="h-4 w-4 text-primary" /> Configurações por loja</h3>
          <p className="mb-4 text-xs text-muted-foreground">Use o prazo mais demorado que seu fornecedor costuma levar. Assim, o alerta considera o pior cenário.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {([
              ["leadDays", "Prazo máximo de chegada", "dias (padrão: 7)", 1, 30],
              ["reviewDays", "Intervalo entre compras", "dias (padrão: 15)", 1, 60],
              ["safetyDays", "Reserva de segurança", "dias (padrão: 3)", 0, 30],
            ] as const).map(([key, label, hint, min, max]) => (
              <label className="block" key={key}>
                <span className="text-xs font-semibold">{label}</span>
                <Input
                  type="number"
                  min={min}
                  max={max}
                  step={1}
                  className="mt-1"
                  value={localSettings[key]}
                  onChange={(event) => setLocalSettings((old) => ({ ...old, [key]: Number(event.target.value) }))}
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void persistSettings()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Salvar prazos
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Risco de faltar" value={String(forecast.urgentCount)} hint="Antes de chegar reposição" tone="text-red-400" />
        <SummaryCard icon={<ShoppingCart className="h-4 w-4" />} label="Comprar agora" value={String(forecast.buyNowCount)} hint="Produtos prioritários" tone="text-orange-400" />
        <SummaryCard icon={<Truck className="h-4 w-4" />} label="Já encomendadas" value={String(forecast.pendingUnits) + " un"} hint="Descontadas da sugestão" tone="text-sky-400" />
        <SummaryCard icon={<Boxes className="h-4 w-4" />} label="Compra planejada" value={brl(forecast.recommendedCost)} hint={forecast.recommendedUnits + " unidades sugeridas no total"} tone="text-emerald-400" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-primary" /> Planejamento para não faltar mercadoria</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Comprando hoje, a previsão de chegada é entre <strong className="text-foreground">{businessDate(forecast.rows[0]?.earliestArrival ?? new Date())}</strong> e <strong className="text-foreground">{businessDate(forecast.rows[0]?.estimatedArrival ?? new Date())}</strong>.
              O cálculo protege {settings.leadDays} dias de entrega + {settings.reviewDays} dias até a próxima compra + reserva.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void copyPurchaseList()} disabled={buyNow.length === 0}>
              <ClipboardCopy className="mr-2 h-4 w-4" /> Copiar lista ao fornecedor
            </Button>
            <Button
              size="sm"
              onClick={() => onCreatePurchase(buyNow.map((row) => ({ productId: row.product.id, quantity: row.buyQuantity })))}
              disabled={buyNow.length === 0}
            >
              <ShoppingCart className="mr-2 h-4 w-4" /> Gerar pedido prioritário
            </Button>
          </div>
        </div>
        {forecast.urgentCount > 0 && (
          <div className="mt-4 flex gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-3 text-xs text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {forecast.urgentCount} produto(s) podem acabar antes do prazo máximo de chegada de {settings.leadDays} dias.
              Se já houver pedido em trânsito, confirme a data com o fornecedor; comprar mais agora não recupera vendas perdidas durante a espera.
            </span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-elegant">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div>
            <h3 className="font-bold">Recomendação produto por produto</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Últimos 7 e 30 dias + ciclo comercial de 15 a 15. Clique no produto para ver a conta.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto" className="h-9 w-[180px] pl-9" />
            </div>
            <select
              aria-label="Filtrar recomendações"
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground"
            >
              <option value="todos">Todos</option>
              <option value="urgentes">Risco de faltar</option>
              <option value="comprar">Comprar agora</option>
              <option value="programar">Programar compra</option>
              <option value="sem_historico">Sem histórico</option>
            </select>
          </div>
        </div>

        {rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum produto encontrado nesse filtro.</div>
        )}

        <div className="divide-y divide-border">
          {rows.map((row) => {
            const opened = expanded === row.product.id;
            const shouldBuy = row.buyQuantity > 0 && row.priority !== "sem_historico";
            return (
              <div key={row.product.id} className="transition-colors hover:bg-secondary/15">
                <button
                  type="button"
                  aria-expanded={opened}
                  onClick={() => setExpanded(opened ? null : row.product.id)}
                  className="flex w-full flex-col gap-3 p-4 text-left sm:p-5"
                >
                  <div className="flex w-full flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {row.product.imageUrl
                        ? <img src={row.product.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover" loading="lazy" />
                        : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-secondary/70"><Package className="h-5 w-5 text-muted-foreground" /></div>}
                      <div className="min-w-0">
                        <h4 className="font-bold">{row.product.name}</h4>
                        <p className="text-xs text-muted-foreground">{row.product.category || "Sem categoria"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {priorityLabel(row)}
                      {opened ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                    <Value label="Vendeu em 30 dias" value={String(row.units30) + " un"} />
                    <Value label="Vendeu no ciclo atual" value={String(row.unitsCycle) + " un"} />
                    <Value label="Em estoque" value={String(row.stock) + " un"} />
                    <Value label="Já encomendado" value={String(row.incoming) + " un"} />
                    <Value label="Duração estimada" value={row.coverageDays === null ? "Sem base" : roundedRate(row.coverageDays) + " dias"} />
                    <Value label="Comprar para reposição" value={String(row.buyQuantity) + " un"} strong />
                  </div>
                </button>

                {opened && (
                  <div className="space-y-4 border-t border-border bg-secondary/15 px-4 py-4 sm:px-5">
                    <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <Detail label="Últimos 7 dias" value={row.units7 + " unidades"} />
                      <Detail label="Último ciclo fechado (15 a 15)" value={row.unitsPreviousCycle + " unidades"} />
                      <Detail label="Média estimada por dia" value={roundedRate(row.dailySales) + " un/dia"} />
                      <Detail label="Demanda projetada em 30 dias" value={row.expected30 + " unidades"} />
                      <Detail label="Comprar para atender até o próximo dia 15" value={row.buyUntilClosing + " unidades"} />
                      <Detail label="Estoque de proteção" value={row.bufferStock + " unidades"} />
                      <Detail label="Ponto de pedir novamente" value={row.reorderPoint + " unidades"} />
                      <Detail label="Estoque necessário para reposição" value={row.targetStock + " unidades"} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-primary" />
                          Data indicada para pedir: <strong className="text-foreground">{row.orderBy ? businessDate(row.orderBy) : "Sem dados de giro"}</strong>
                        </p>
                        <p className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-sky-400" />
                          Se pedir hoje, chegada estimada: <strong className="text-foreground">{businessDate(row.earliestArrival)} a {businessDate(row.estimatedArrival)}</strong>
                        </p>
                        <p>
                          Risco ao aguardar {settings.leadDays} dias: <strong className={row.projectedStockAtArrival < 0 ? "text-red-400" : "text-foreground"}>
                            {row.projectedStockAtArrival < 0 ? "Pode faltar antes da chegada" : String(row.projectedStockAtArrival) + " un restantes"}
                          </strong>
                          {" · "}Confiabilidade do histórico: <strong className="text-foreground">{row.confidence === "sem_dados" ? "Sem dados" : row.confidence}</strong>
                          {" · "}Tendência: <strong className="text-foreground">{row.trend === "subindo" ? "em alta" : row.trend === "caindo" ? "em queda" : "estável/indefinida"}</strong>
                        </p>
                      </div>
                      <Button size="sm" disabled={!shouldBuy} onClick={() => onCreatePurchase([{ productId: row.product.id, quantity: row.buyQuantity }])}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {shouldBuy ? "Criar pedido de " + row.buyQuantity + " un" : "Sem compra sugerida"}
                      </Button>
                    </div>

                    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Fórmula: consumo médio diário × (prazo de entrega + intervalo até a próxima reposição) + reserva − estoque físico − unidades em pedidos pendentes.
                      A sugestão pode variar em períodos promocionais, rupturas anteriores ou vendas ainda não registradas. Revise antes de enviar ao fornecedor.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        <Info className="mr-1.5 inline h-3.5 w-3.5" />
        Sem histórico de vendas, o assistente não inventa demanda. Cadastre seu estoque mínimo ou ajuste manualmente o pedido.
        As compras pendentes são consideradas no cálculo e devem ser marcadas como recebidas na aba Compras & Fornecedores quando chegarem.
      </p>
    </div>
  );
}

function SummaryCard({ icon, label, value, hint, tone }: {
  icon: React.ReactNode; label: string; value: string; hint: string; tone: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-elegant">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className={tone}>{icon}</span>{label}
      </div>
      <p className={"mt-3 break-words text-2xl font-extrabold " + tone}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function Value({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"mt-1 break-words text-sm font-bold " + (strong ? "text-primary" : "text-foreground")}>{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}
