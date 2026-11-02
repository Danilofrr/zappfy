import { describe, expect, test } from "bun:test";
import type { Product } from "../src/lib/store";
import {
  addCalendarDays,
  buildInventoryForecast,
  calendarDaysBetween,
  cycleFrom15th,
  localDayKey,
  DEFAULT_INVENTORY_PLANNING,
} from "../src/lib/inventory-forecast";

const product: Product = {
  id: "product-1", name: "Game Stick X3 Pro", category: "Games",
  price: 269.9, cost: 95, stock: 30, minStock: 5,
};

function dailySales(today: Date, quantity: number, days: number) {
  return Array.from({ length: days }, (_, index) => ({
    product_id: product.id,
    sale_day: localDayKey(addCalendarDays(today, -index)),
    quantity,
  }));
}

describe("fechamento comercial de 15 a 15", () => {
  test("antes do dia 15 pertence ao ciclo anterior", () => {
    const cycle = cycleFrom15th(new Date(2026, 9, 14, 12));
    expect(localDayKey(cycle.cycleStart)).toBe("2026-09-15");
    expect(localDayKey(cycle.cycleEnd)).toBe("2026-10-15");
    expect(cycle.daysToClose).toBe(1);
  });

  test("no dia 15 inicia ciclo novo (intervalo aberto no fim)", () => {
    const cycle = cycleFrom15th(new Date(2026, 9, 15, 12));
    expect(localDayKey(cycle.cycleStart)).toBe("2026-10-15");
    expect(localDayKey(cycle.cycleEnd)).toBe("2026-11-15");
    expect(cycle.daysToClose).toBe(31);
  });

  test("diferenças em dias civis não dependem do horário de verão", () => {
    expect(calendarDaysBetween(new Date(2026, 1, 15), new Date(2026, 2, 15))).toBe(28);
  });
});

describe("reposição baseada em vendas reais", () => {
  const today = new Date(2026, 9, 31, 14);

  test("desconta estoque e compras pendentes da sugestão", () => {
    const sales = dailySales(today, 5, 30);
    const withPending = buildInventoryForecast(
      [product], sales,
      [{ product_id: product.id, product_name: product.name, quantity: 20, order_date: "2026-10-28" }],
      DEFAULT_INVENTORY_PLANNING, today,
    ).rows[0];
    const withoutPending = buildInventoryForecast([product], sales, [], DEFAULT_INVENTORY_PLANNING, today).rows[0];
    expect(withPending.units30).toBe(150);
    expect(withPending.units7).toBe(35);
    expect(withPending.buyQuantity).toBe(Math.max(0, withPending.targetStock - 30 - 20));
    expect(withoutPending.buyQuantity - withPending.buyQuantity).toBe(20);
    expect(withPending.estimatedArrival.getDate()).toBe(7);
  });

  test("um pedido mensal cobre todos os dias de 15 a 15 mais entrega e reserva", () => {
    const monthly = buildInventoryForecast(
      [product], dailySales(today, 5, 30),
      [], DEFAULT_INVENTORY_PLANNING, today,
    );
    const row = monthly.rows[0];
    expect(monthly.cycleDays).toBe(31); // 15/out a 15/nov
    expect(monthly.coverageDaysPlanned).toBe(41); // 31 + 7 dias entrega + 3 reserva
    expect(row.targetStock).toBe(Math.ceil(row.dailySales * (7 + 31)) + row.bufferStock);
    expect(row.buyQuantity).toBe(Math.max(0, row.targetStock - product.stock));
    expect(row.buyForFullCycle).toBe(
      Math.max(0, Math.ceil(row.dailySales * 31) + row.bufferStock - product.stock),
    );
  });

  test("dias do mes comercial variam de 28 a 31 dias sem comprar quinzenalmente", () => {
    const feb = buildInventoryForecast([product], [], [], DEFAULT_INVENTORY_PLANNING, new Date(2027, 1, 16));
    const apr = buildInventoryForecast([product], [], [], DEFAULT_INVENTORY_PLANNING, new Date(2027, 3, 16));
    const jan = buildInventoryForecast([product], [], [], DEFAULT_INVENTORY_PLANNING, new Date(2027, 0, 16));
    expect(feb.cycleDays).toBe(28);
    expect(apr.cycleDays).toBe(30);
    expect(jan.cycleDays).toBe(31);
    expect(feb.coverageDaysPlanned).toBe(38);
    expect(apr.coverageDaysPlanned).toBe(40);
    expect(jan.coverageDaysPlanned).toBe(41);
  });

  test("configuracao antiga de compras quinzenais nao reduz a cobertura mensal", () => {
    const history = dailySales(today, 4, 30);
    const previousConfig = buildInventoryForecast(
      [product], history, [], { ...DEFAULT_INVENTORY_PLANNING, reviewDays: 15 }, today,
    );
    const newConfig = buildInventoryForecast([product], history, [], DEFAULT_INVENTORY_PLANNING, today);
    expect(previousConfig.rows[0].buyQuantity).toBe(newConfig.rows[0].buyQuantity);
    expect(previousConfig.rows[0].targetStock).toBe(newConfig.rows[0].targetStock);
  });

  test("poucas peças disparam risco de acabar antes do prazo de entrega", () => {
    const stockTwo = { ...product, stock: 2 };
    const advice = buildInventoryForecast([stockTwo], dailySales(today, 4, 30), [], DEFAULT_INVENTORY_PLANNING, today);
    expect(advice.urgentCount).toBe(1);
    expect(advice.rows[0].priority).toBe("urgente");
    expect(advice.rows[0].coverageDays).toBeLessThan(7);
  });

  test("pedido que chega cedo evita alerta falso de ruptura", () => {
    const stockTwo = { ...product, stock: 2 };
    const row = buildInventoryForecast(
      [stockTwo], dailySales(today, 4, 30),
      [{ product_id: product.id, product_name: product.name, quantity: 80, order_date: "2026-10-25T12:00:00-03:00" }],
      DEFAULT_INVENTORY_PLANNING, today,
    ).rows[0];
    expect(row.riskDuringLead).toBe(false);
    expect(row.priority).not.toBe("urgente");
    expect(row.overdueIncoming).toBe(0);
  });

  test("pedido atrasado não é tratado como estoque já recebido", () => {
    const stockTwo = { ...product, stock: 2 };
    const row = buildInventoryForecast(
      [stockTwo], dailySales(today, 4, 30),
      [{ product_id: product.id, product_name: product.name, quantity: 80, order_date: "2026-10-01T12:00:00-03:00" }],
      DEFAULT_INVENTORY_PLANNING, today,
    ).rows[0];
    expect(row.overdueIncoming).toBe(80);
    expect(row.riskDuringLead).toBe(true);
    expect(row.priority).toBe("urgente");
  });

  test("sem vendas não inventa giro, mas respeita o mínimo manual", () => {
    const noSales = buildInventoryForecast([{ ...product, stock: 2 }], [], [], DEFAULT_INVENTORY_PLANNING, today).rows[0];
    expect(noSales.dailySales).toBe(0);
    expect(noSales.confidence).toBe("sem_dados");
    expect(noSales.priority).toBe("comprar");
    expect(noSales.buyQuantity).toBe(3);
  });

  test("produto novo não recebe penalidade por não ter ciclo anterior", () => {
    const row = buildInventoryForecast([product], dailySales(today, 6, 7), [], DEFAULT_INVENTORY_PLANNING, today).rows[0];
    expect(row.dailySales).toBeGreaterThan(2);
    expect(row.units30).toBe(42);
    expect(row.unitsPreviousCycle).toBe(0);
  });

  test("produto com nome repetido não recebe um pedido pendente sem ID", () => {
    const a = { ...product, id: "a" };
    const b = { ...product, id: "b" };
    const analysis = buildInventoryForecast(
      [a,b],[],[{ product_id: null, product_name: product.name, quantity: 50, order_date: "2026-10-31" }],
      DEFAULT_INVENTORY_PLANNING, today,
    );
    expect(analysis.pendingUnits).toBe(0);
  });

  test("lucro bruto projetado usa o preço e o custo das unidades sugeridas", () => {
    const cheaper = {
      ...product, id: "produto-b", name: "Game Stick GD10",
      cost: 50, price: 100, stock: 0, minStock: 10,
    };
    const forecast = buildInventoryForecast(
      [product, cheaper],
      [...dailySales(today, 4, 30), ...Array.from({ length: 30 }, (_, i) => ({
        product_id: cheaper.id, sale_day: localDayKey(addCalendarDays(today, -i)), quantity: 2,
      }))],
      [], DEFAULT_INVENTORY_PLANNING, today,
    );
    const expectedCost = forecast.rows.reduce((sum, row) => sum + row.buyQuantity * row.product.cost, 0);
    const expectedRevenue = forecast.rows.reduce((sum, row) => sum + row.buyQuantity * row.product.price, 0);
    expect(forecast.recommendedCost).toBeCloseTo(expectedCost, 2);
    expect(forecast.recommendedRevenue).toBeCloseTo(expectedRevenue, 2);
    expect(forecast.recommendedGrossProfit).toBeCloseTo(expectedRevenue - expectedCost, 2);
    expect(forecast.productsWithoutPricing).toBe(0);
  });

  test("lucro bruto pode ser negativo e avisa sobre preços de custo zerados", () => {
    const lossProduct = { ...product, price: 50, cost: 90, stock: 0 };
    const advice = buildInventoryForecast(
      [lossProduct],
      dailySales(today, 2, 30),
      [], DEFAULT_INVENTORY_PLANNING, today,
    );
    expect(advice.recommendedGrossProfit).toBeLessThan(0);
    expect(advice.productsWithoutPricing).toBe(0);
    const missingCost = buildInventoryForecast(
      [{ ...lossProduct, price: 100, cost: 0 }],
      dailySales(today, 2, 30),
      [], DEFAULT_INVENTORY_PLANNING, today,
    );
    expect(missingCost.productsWithoutPricing).toBe(1);
  });

  test("uma compra pendente maior que a necessidade não gera pedido duplicado", () => {
    const row = buildInventoryForecast(
      [product], dailySales(today, 1, 30),
      [{ product_id: product.id, product_name: product.name, quantity: 100, order_date: "2026-10-31" }],
      DEFAULT_INVENTORY_PLANNING, today,
    ).rows[0];
    expect(row.buyQuantity).toBe(0);
  });
});
