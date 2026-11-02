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
  reviewDays: 30,
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
  overdueIncoming: number;
  bufferStock: number;
  reorderPoint: number;
  targetStock: number;
  buyQuantity: number;
  buyForFullCycle: number;
  coverageDays: number | null;
  daysUntilOrder: number | null;
  orderBy: Date | null;
  estimatedArrival: Date;
  earliestArrival: Date;
  projectedStockAtArrival: number;
  riskDuringLead: boolean;
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
  cycleDays: number;
  coverageDaysPlanned: number;
  recommendedUnits: number;
  recommendedCost: number;
  recommendedRevenue: number;
  recommendedGrossProfit: number;
  productsWithoutPricing: number;
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
    cycleDays: calendarDaysBetween(cycleStart, cycleEnd),
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
 * - Media ponderada dos ultimos 30, 7 dias e ultimo ciclo fechado (quando houver vendas).
 * - Compra mensal, calculada para um ciclo comercial inteiro de 15 a 15.
 * - Protecao: ciclo de 28 a 31 dias + prazo de entrega + reserva de seguranca.
 * - O fechamento do dia 15 nao representa uma compra quinzenal.
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
  const safetyDays = clampPlanningNumber(config.safetyDays, 3, 0, 30);
  const cycle = cycleFrom15th(today);
  // Um pedido por mes comercial. O tamanho exato de cada ciclo varia (28 a 31 dias).
  // A configuracao antiga "reviewDays" e mantida apenas para compatibilidade;
  // compras a cada 15 dias nao sao mais utilizadas neste planejamento.
  const monthlyCoverageDays = cycle.cycleDays;
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

  const incomingByProduct = new Map<string, Array<{ quantity: number; daysUntilArrival: number }>>();
  for (const purchase of pendingPurchases) {
    const id = purchase.product_id && productIds.has(purchase.product_id)
      ? purchase.product_id
      : resolveUniqueName(purchase.product_name || "", productIdsByName);
    if (!id) continue;
    const date = new Date(purchase.order_date);
    const orderDate = Number.isNaN(date.getTime()) ? today : date;
    const daysUntilArrival = calendarDaysBetween(today, addCalendarDays(orderDate, leadDays));
    const incoming = incomingByProduct.get(id) ?? [];
    incoming.push({ quantity: Math.floor(nonNegative(purchase.quantity)), daysUntilArrival });
    incomingByProduct.set(id, incoming);
  }

  const rows: ProductForecast[] = products.map((product) => {
    const sold = salesByProduct.get(product.id) ?? { seven: 0, thirty: 0, cycle: 0, previous: 0 };
    const rate7 = sold.seven / 7;
    const rate30 = sold.thirty / 30;
    const ratePrevious = sold.previous / cycle.previousCycleDays;
    // Sem movimento no ultimo ciclo fechado, nao penalizar produtos novos com peso zero.
    const dailySales = Math.max(0, sold.previous > 0
      ? rate30 * 0.55 + rate7 * 0.30 + ratePrevious * 0.15
      : rate30 * 0.65 + rate7 * 0.35);
    const stock = Math.max(0, Math.floor(nonNegative(product.stock)));
    const pendingRows = incomingByProduct.get(product.id) ?? [];
    const incoming = pendingRows.reduce((sum, row) => sum + row.quantity, 0);
    const overdueIncoming = pendingRows
      .filter((row) => row.daysUntilArrival < 0)
      .reduce((sum, row) => sum + row.quantity, 0);
    const bufferStock = Math.max(Math.max(0, Math.floor(nonNegative(product.minStock))), Math.ceil(dailySales * safetyDays));
    const reorderPoint = Math.ceil(dailySales * leadDays) + bufferStock;
    // Cobrir um ciclo INTEIRO e a espera por reposicao do fornecedor.
    // A compra deve sustentar a loja ate a entrega mensal seguinte.
    const targetStock = Math.ceil(dailySales * (leadDays + monthlyCoverageDays)) + bufferStock;
    const buyQuantity = Math.max(0, targetStock - stock - incoming);
    const buyForFullCycle = Math.max(
      0,
      Math.ceil(dailySales * monthlyCoverageDays) + bufferStock - stock - incoming,
    );
    const coverageDays = dailySales > 0 ? stock / dailySales : null;
    // Simulacao diaria ate a chegada de uma compra feita hoje.
    // Pedidos em transito que devem chegar antes podem impedir a ruptura.
    // Pedidos atrasados nao sao considerados recebidos sem confirmacao.
    let balance = stock;
    let riskDuringLead = stock === 0 && dailySales > 0;
    for (let day = 1; day <= leadDays; day++) {
      balance -= dailySales;
      for (const pending of pendingRows) {
        if (pending.daysUntilArrival === day) balance += pending.quantity;
      }
      if (balance < 0) riskDuringLead = true;
    }
    const projectedStockAtArrival = Math.floor(balance);
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
    if (!hasHistory) priority = product.minStock > 0 && stock < product.minStock ? "comprar" : "sem_historico";
    else if (riskDuringLead) priority = "urgente";
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
      overdueIncoming,
      bufferStock,
      reorderPoint,
      targetStock,
      buyQuantity,
      buyForFullCycle,
      coverageDays,
      daysUntilOrder,
      orderBy: daysUntilOrder !== null ? addCalendarDays(today, daysUntilOrder) : null,
      estimatedArrival: addCalendarDays(today, leadDays),
      earliestArrival: addCalendarDays(today, Math.max(1, leadDays - 3)),
      projectedStockAtArrival,
      riskDuringLead,
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

  const recommendedCost = rows.reduce((sum, row) => sum + row.buyQuantity * nonNegative(row.product.cost), 0);
  const recommendedRevenue = rows.reduce((sum, row) => sum + row.buyQuantity * nonNegative(row.product.price), 0);
  const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

  return {
    rows,
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    previousCycleStart: cycle.previousCycleStart,
    daysToClose: cycle.daysToClose,
    cycleDays: monthlyCoverageDays,
    coverageDaysPlanned: leadDays + monthlyCoverageDays + safetyDays,
    recommendedUnits: rows.reduce((sum, row) => sum + row.buyQuantity, 0),
    recommendedCost: roundMoney(recommendedCost),
    recommendedRevenue: roundMoney(recommendedRevenue),
    // Lucro bruto potencial se TODAS as unidades recomendadas forem vendidas
    // pelo preco cadastrado. Nao inclui taxas, anuncios, frete ou despesas.
    recommendedGrossProfit: roundMoney(recommendedRevenue - recommendedCost),
    productsWithoutPricing: rows.filter((row) =>
      row.buyQuantity > 0 && (nonNegative(row.product.cost) === 0 || nonNegative(row.product.price) === 0),
    ).length,
    urgentCount: rows.filter((row) => row.priority === "urgente").length,
    buyNowCount: rows.filter((row) => row.priority === "urgente" || row.priority === "comprar").length,
    plannedCount: rows.filter((row) => row.priority === "programar").length,
    pendingUnits: rows.reduce((sum, row) => sum + row.incoming, 0),
  };
}
