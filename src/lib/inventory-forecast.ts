import type { Product } from "@/lib/store";

export type SalesDay = {
  product_id: string;
  sale_day: string;
  quantity: number;
};

export type PendingPurchase = {
  product_id: string | null;
  product_name: string;
  quantity: number;
  order_date: string;
};

export type InventoryPlanningSettings = {
  leadDays: number;
  reviewDays: number;
  safetyDays: number;
};

export const DEFAULT_INVENTORY_PLANNING: InventoryPlanningSettings = {
  leadDays: 7,
  reviewDays: 15,
  safetyDays: 3,
};

export type InventoryPriority = "urgente" | "comprar" | "programar" | "estavel" | "sem_historico";

export type ProductForecast = {
  product: Product;
  units7: number;
  units30: number;
  unitsCycle: number;
  unitsPreviousCycle: number;
  dailySales: number;
  expected30: number;
  stock: number;
  incoming: number;
  bufferStock: number;
  reorderPoint: number;
  targetStock: number;
  buyQuantity: number;
  buyUntilClosing: number;
  coverageDays: number | null;
  daysUntilOrder: number | null;
  orderBy: Date | null;
  estimatedArrival: Date;
  earliestArrival: Date;
  projectedStockAtArrival: number;
  priority: InventoryPriority;
  confidence: "alta" | "media" | "baixa" | "sem_dados";
  trend: "subindo" | "caindo" | "estavel" | "sem_dados";
};

export type InventoryForecast = {
  rows: ProductForecast[];
  cycleStart: Date;
  cycleEnd: Date;
  previousCycleStart: Date;
  daysToClose: number;
  recommendedUnits: number;
  recommendedCost: number;
  urgentCount: number;
  buyNowCount: number;
  plannedCount: number;
  pendingUnits: number;
};

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addCalendarDays(date: Date, days: number): Date {
  const result = startOfLocalDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return [y, m, d].join("-");
}

function ordinal(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

export function calendarDaysBetween(start: Date, end: Date): number {
  return ordinal(end) - ordinal(start);
}

export function cycleFrom15th(at: Date) {
  const today = startOfLocalDay(at);
  const thisMonthClose = new Date(today.getFullYear(), today.getMonth(), 15);
  const cycleStart = today >= thisMonthClose
    ? thisMonthClose
    : new Date(today.getFullYear(), today.getMonth() - 1, 15);
  const cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, 15);
  const previousCycleStart = new Date(cycleStart.getFullYear(), cycleStart.getMonth() - 1, 15);
  return {
    cycleStart,
    cycleEnd,
    previousCycleStart,
    daysToClose: calendarDaysBetween(today, cycleEnd),
    previousCycleDays: calendarDaysBetween(previousCycleStart, cycleStart),
  };
}

export function clampPlanningNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? Math.round(parsed)
    : fallback;
}

function nonNegative(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function resolveUniqueName(
  productName: string,
  productIdsByName: Map<string, string | null>,
): string | null {
  return productIdsByName.get(productName.trim().toLocaleLowerCase("pt-BR")) ?? null;
}

const PRIORITY_RANK: Record<InventoryPriority, number> = {
  urgente: 0,
  comprar: 1,
  programar: 2,
  sem_historico: 3,
  estavel: 4,
};

/**
 * Previsao operacional, nao uma promessa de vendas futuras.
 * - Vendas reais de pedidos nao cancelados chegam agregadas do banco.
 * - Media ponderada: 55% ultimos 30 dias, 30% ultimos 7 e 15% ultimo ciclo fechado.
 * - Cobertura desejada: prazo de entrega + intervalo entre compras + estoque de seguranca.
 * - Pedidos pendentes sao descontados para nao recomendar compra em duplicidade.
 * - Fechamento comercial: dia 15 (inclusivo) ate o dia 15 seguinte (exclusivo).
 */
export function buildInventoryForecast(
  products: Product[],
  dailySales: SalesDay[],
  pendingPurchases: PendingPurchase[],
  config: InventoryPlanningSettings,
  at: Date = new Date(),
): InventoryForecast {
  const today = startOfLocalDay(at);
  const leadDays = clampPlanningNumber(config.leadDays, 7, 1, 30);
  const reviewDays = clampPlanningNumber(config.reviewDays, 15, 1, 60);
  const safetyDays = clampPlanningNumber(config.safetyDays, 3, 0, 30);
  const cycle = cycleFrom15th(today);
  const sevenStart = localDayKey(addCalendarDays(today, -6));
  const thirtyStart = localDayKey(addCalendarDays(today, -29));
  const nowKey = localDayKey(today);
  const cycleKey = localDayKey(cycle.cycleStart);
  const previousKey = localDayKey(cycle.previousCycleStart);

  const productIds = new Set(products.map((product) => product.id));
  const productIdsByName = new Map<string, string | null>();
  for (const product of products) {
    const key = product.name.trim().toLocaleLowerCase("pt-BR");
    if (productIdsByName.has(key)) productIdsByName.set(key, null);
    else productIdsByName.set(key, product.id);
  }

  const salesByProduct = new Map<string, { seven: number; thirty: number; cycle: number; previous: number }>();
  for (const sale of dailySales) {
    if (!productIds.has(sale.product_id) || sale.sale_day > nowKey) continue;
    const qty = nonNegative(sale.quantity);
    const row = salesByProduct.get(sale.product_id) ?? { seven: 0, thirty: 0, cycle: 0, previous: 0 };
    if (sale.sale_day >= sevenStart) row.seven += qty;
    if (sale.sale_day >= thirtyStart) row.thirty += qty;
    if (sale.sale_day >= cycleKey) row.cycle += qty;
    else if (sale.sale_day >= previousKey) row.previous += qty;
    salesByProduct.set(sale.product_id, row);
  }

  const incomingByProduct = new Map<string, number>();
  for (const purchase of pendingPurchases) {
    const id = purchase.product_id && productIds.has(purchase.product_id)
      ? purchase.product_id
      : resolveUniqueName(purchase.product_name || "", productIdsByName);
    if (!id) continue;
    incomingByProduct.set(id, (incomingByProduct.get(id) || 0) + nonNegative(purchase.quantity));
  }

  const rows: ProductForecast[] = products.map((product) => {
    const sold = salesByProduct.get(product.id) ?? { seven: 0, thirty: 0, cycle: 0, previous: 0 };
    const rate7 = sold.seven / 7;
    const rate30 = sold.thirty / 30;
    const ratePrevious = sold.previous / cycle.previousCycleDays;
    const dailySales = Math.max(0, rate30 * 0.55 + rate7 * 0.30 + ratePrevious * 0.15);
    const stock = Math.max(0, Math.floor(nonNegative(product.stock)));
    const incoming = Math.floor(incomingByProduct.get(product.id) || 0);
    const bufferStock = Math.max(Math.max(0, Math.floor(nonNegative(product.minStock))), Math.ceil(dailySales * safetyDays));
    const reorderPoint = Math.ceil(dailySales * leadDays) + bufferStock;
    const targetStock = Math.ceil(dailySales * (leadDays + reviewDays)) + bufferStock;
    const buyQuantity = Math.max(0, targetStock - stock - incoming);
    const buyUntilClosing = Math.max(
      0,
      Math.ceil(dailySales * cycle.daysToClose) + bufferStock - stock - incoming,
    );
    const coverageDays = dailySales > 0 ? stock / dailySales : null;
    const projectedStockAtArrival = Math.floor(stock - dailySales * leadDays);
    const daysUntilOrder = dailySales > 0
      ? Math.max(0, Math.floor((stock + incoming - reorderPoint) / dailySales))
      : null;
    const hasHistory = sold.seven > 0 || sold.thirty > 0 || sold.previous > 0;
    const confidence: ProductForecast["confidence"] =
      !hasHistory ? "sem_dados"
        : sold.thirty >= 30 && sold.previous > 0 ? "alta"
          : sold.thirty >= 8 ? "media" : "baixa";

    const trend: ProductForecast["trend"] = !hasHistory || rate30 <= 0
      ? "sem_dados"
      : rate7 >= rate30 * 1.2 ? "subindo"
        : rate7 < rate30 * 0.8 ? "caindo" : "estavel";

    let priority: InventoryPriority;
    if (!hasHistory) priority = "sem_historico";
    else if (stock === 0 || coverageDays !== null && coverageDays < leadDays) priority = "urgente";
    else if (buyQuantity > 0 && stock + incoming <= reorderPoint) priority = "comprar";
    else if (buyQuantity > 0) priority = "programar";
    else priority = "estavel";

    return {
      product,
      units7: sold.seven,
      units30: sold.thirty,
      unitsCycle: sold.cycle,
      unitsPreviousCycle: sold.previous,
      dailySales,
      expected30: Math.ceil(dailySales * 30),
      stock,
      incoming,
      bufferStock,
      reorderPoint,
      targetStock,
      buyQuantity,
      buyUntilClosing,
      coverageDays,
      daysUntilOrder,
      orderBy: daysUntilOrder !== null ? addCalendarDays(today, daysUntilOrder) : null,
      estimatedArrival: addCalendarDays(today, leadDays),
      earliestArrival: addCalendarDays(today, Math.max(1, leadDays - 3)),
      projectedStockAtArrival,
      priority,
      confidence,
      trend,
    };
  });

  rows.sort((a, b) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    || b.units30 - a.units30
    || a.product.name.localeCompare(b.product.name, "pt-BR"),
  );

  return {
    rows,
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    previousCycleStart: cycle.previousCycleStart,
    daysToClose: cycle.daysToClose,
    recommendedUnits: rows.reduce((sum, row) => sum + row.buyQuantity, 0),
    recommendedCost: rows.reduce((sum, row) => sum + row.buyQuantity * nonNegative(row.product.cost), 0),
    urgentCount: rows.filter((row) => row.priority === "urgente").length,
    buyNowCount: rows.filter((row) => row.priority === "urgente" || row.priority === "comprar").length,
    plannedCount: rows.filter((row) => row.priority === "programar").length,
    pendingUnits: rows.reduce((sum, row) => sum + row.incoming, 0),
  };
}
