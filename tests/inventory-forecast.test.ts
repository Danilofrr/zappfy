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

  test("uma compra pendente maior que a necessidade não gera pedido duplicado", () => {
    const row = buildInventoryForecast(
      [product], dailySales(today, 1, 30),
      [{ product_id: product.id, product_name: product.name, quantity: 100, order_date: "2026-10-31" }],
      DEFAULT_INVENTORY_PLANNING, today,
    ).rows[0];
    expect(row.buyQuantity).toBe(0);
  });
});
