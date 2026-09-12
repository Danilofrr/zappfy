import { brl } from "@/lib/format";

export type PaymentBreakdownMethod = "pix" | "dinheiro" | "cartao" | "debito";

export type PaymentBreakdownItem = {
  method: PaymentBreakdownMethod;
  amount: number;
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  debito: "Cartão de Débito",
};

const roundMoney = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;

export function paymentMethodLabel(method: unknown): string {
  const key = String(method || "").toLowerCase().trim();
  return PAYMENT_LABELS[key] || String(method || "Pagamento");
}

export function normalizePaymentBreakdown(
  order: { items?: unknown; payment?: unknown; total?: unknown } | null | undefined,
): PaymentBreakdownItem[] {
  if (!order) return [];
  const items = Array.isArray(order.items) ? (order.items as any[]) : [];
  const stored = items[0]?._paymentBreakdown;

  if (Array.isArray(stored)) {
    const normalized = stored
      .map((entry: any) => ({
        method: String(entry?.method || "").toLowerCase().trim() as PaymentBreakdownMethod,
        amount: roundMoney(entry?.amount),
      }))
      .filter(
        (entry: PaymentBreakdownItem) =>
          ["pix", "dinheiro", "cartao", "debito"].includes(entry.method) && entry.amount > 0,
      );
    if (normalized.length > 0) return normalized;
  }

  const total = roundMoney(order.total);
  const method = String(order.payment || "pix").toLowerCase().trim() as PaymentBreakdownMethod;
  return total > 0 ? [{ method, amount: total }] : [];
}

export function attachPaymentBreakdownToItems<T extends Record<string, any>>(
  items: T[],
  parts: PaymentBreakdownItem[],
): T[] {
  if (!Array.isArray(items) || items.length === 0) return items;
  const normalized = parts
    .map((part) => ({ method: part.method, amount: roundMoney(part.amount) }))
    .filter((part) => part.amount > 0);

  return items.map((item, index) => {
    const { _paymentBreakdown: _drop, ...rest } = item as any;
    return (index === 0 && normalized.length > 0
      ? { ...rest, _paymentBreakdown: normalized }
      : rest) as T;
  });
}

export function buildPaymentBreakdown(
  primaryMethod: PaymentBreakdownMethod,
  total: number,
  secondMethod?: string | null,
  secondAmount?: number,
): PaymentBreakdownItem[] {
  const safeTotal = roundMoney(total);
  const safeSecond = Math.min(safeTotal, Math.max(0, roundMoney(secondAmount)));
  const second = String(secondMethod || "").toLowerCase().trim() as PaymentBreakdownMethod;

  if (
    safeSecond > 0 &&
    ["pix", "dinheiro", "cartao", "debito"].includes(second) &&
    second !== primaryMethod
  ) {
    const primaryAmount = roundMoney(safeTotal - safeSecond);
    return [
      ...(primaryAmount > 0 ? [{ method: primaryMethod, amount: primaryAmount }] : []),
      { method: second, amount: safeSecond },
    ];
  }

  return safeTotal > 0 ? [{ method: primaryMethod, amount: safeTotal }] : [];
}

export function formatPaymentBreakdown(
  order: { items?: unknown; payment?: unknown; total?: unknown } | null | undefined,
): string {
  const parts = normalizePaymentBreakdown(order);
  return parts.length > 0
    ? parts.map((part) => `${paymentMethodLabel(part.method)} ${brl(part.amount)}`).join(" + ")
    : "Pagamento não informado";
}

export function sumPaymentBreakdowns(
  orders: Array<{ items?: unknown; payment?: unknown; total?: unknown }>,
) {
  return orders.reduce(
    (totals, order) => {
      normalizePaymentBreakdown(order).forEach((part) => {
        if (part.method === "pix") totals.pix += part.amount;
        else if (part.method === "dinheiro") totals.dinheiro += part.amount;
        else if (part.method === "cartao" || part.method === "debito") totals.cartao += part.amount;
      });
      totals.pix = roundMoney(totals.pix);
      totals.dinheiro = roundMoney(totals.dinheiro);
      totals.cartao = roundMoney(totals.cartao);
      return totals;
    },
    { pix: 0, dinheiro: 0, cartao: 0 },
  );
}
