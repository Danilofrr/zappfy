// Helper centralizado para o cálculo financeiro dos pedidos
// (taxa de maquininha absorvida x repassada, valor líquido e lucro real).
//
// Como a tabela `orders` do Supabase não possui colunas dedicadas para
// card_fee_mode / card_fee_amount / net_received / profit, os metadados da
// taxa são persistidos como um marcador opcional dentro do primeiro item
// (o campo `items` é `jsonb`, portanto aceita propriedades extras que
// sobrevivem ao round-trip). A UI lê/escreve esses metadados através das
// funções abaixo.

export type CardFeeMode = "absorb" | "passthrough" | null;

export type OrderFeeMeta = {
  cardFeeMode: CardFeeMode;
  cardFeePercentage: number;
  cardFeeAmount: number;
  baseTotal: number;
  netReceived: number;
  cardBrand?: string;
  cardInstallments?: number;
};

const CARD_PAYMENTS = new Set(["cartao", "cartão", "card", "credit_card", "cartão de crédito"]);

export function isCardPayment(payment: unknown): boolean {
  return CARD_PAYMENTS.has(String(payment || "").toLowerCase().trim());
}

export function getOrderFeeMeta(order: { items?: unknown }): OrderFeeMeta | null {
  const items = (order?.items ?? []) as any[];
  if (!Array.isArray(items) || items.length === 0) return null;
  const meta = items[0]?._orderMeta as OrderFeeMeta | undefined;
  if (!meta || typeof meta !== "object") return null;
  return {
    cardFeeMode: meta.cardFeeMode ?? null,
    cardFeePercentage: Number(meta.cardFeePercentage) || 0,
    cardFeeAmount: Number(meta.cardFeeAmount) || 0,
    baseTotal: Number(meta.baseTotal) || 0,
    netReceived: Number(meta.netReceived) || 0,
    cardBrand: meta.cardBrand,
    cardInstallments: meta.cardInstallments,
  };
}

/** Retorna o valor líquido que a loja efetivamente recebe (já sem a taxa absorvida). */
export function getOrderNetReceived(order: { items?: unknown; total?: number; payment?: unknown }): number {
  const meta = getOrderFeeMeta(order);
  const total = Number(order?.total) || 0;
  if (!meta) return total;
  if (meta.cardFeeMode === "absorb") {
    // total salvo == valor pago pelo cliente == baseTotal
    const base = meta.baseTotal || total;
    return Math.max(0, base - meta.cardFeeAmount);
  }
  if (meta.cardFeeMode === "passthrough") {
    // total salvo inclui a taxa repassada; o líquido é o valor base
    return meta.baseTotal || Math.max(0, total - meta.cardFeeAmount);
  }
  return total;
}

/** Valor de venda considerado como faturamento da loja (sem taxa repassada). */
export function getOrderStoreRevenue(order: { items?: unknown; total?: number }): number {
  const meta = getOrderFeeMeta(order);
  const total = Number(order?.total) || 0;
  if (meta?.cardFeeMode === "passthrough") return meta.baseTotal || Math.max(0, total - meta.cardFeeAmount);
  if (meta?.cardFeeMode === "absorb") return meta.baseTotal || total;
  return total;
}

/** Lucro real do pedido, aplicando a taxa absorvida quando existir. */
export function getOrderProfit(order: { items?: any[]; total?: number; payment?: unknown }): number {
  const items = (order?.items ?? []) as any[];
  const productsCost = items.reduce((sum, it) => sum + (Number(it?.cost) || 0) * (Number(it?.qty) || 0), 0);
  const net = getOrderNetReceived(order);
  return net - productsCost;
}

/** Constrói o objeto de metadados a ser gravado em `items[0]._orderMeta`. */
export function buildOrderFeeMeta(params: {
  payment: string;
  baseTotal: number;
  cardFeePercentage: number;
  cardFeeMode: "absorb" | "passthrough";
  cardBrand?: string;
  cardInstallments?: number;
}): OrderFeeMeta | null {
  if (!isCardPayment(params.payment)) return null;
  const baseTotal = Math.max(0, Number(params.baseTotal) || 0);
  const pct = Math.max(0, Number(params.cardFeePercentage) || 0);
  const cardFeeAmount = Math.round(baseTotal * (pct / 100) * 100) / 100;
  const netReceived = params.cardFeeMode === "absorb"
    ? Math.max(0, baseTotal - cardFeeAmount)
    : baseTotal;
  return {
    cardFeeMode: params.cardFeeMode,
    cardFeePercentage: pct,
    cardFeeAmount,
    baseTotal,
    netReceived,
    cardBrand: params.cardBrand,
    cardInstallments: params.cardInstallments,
  };
}

/** Anexa metadados no primeiro item (mutando de forma imutável). */
export function attachFeeMetaToItems<T extends { _orderMeta?: OrderFeeMeta | null }>(
  items: T[],
  meta: OrderFeeMeta | null,
): T[] {
  if (!Array.isArray(items) || items.length === 0) return items;
  // remove meta anterior de todos e coloca só no primeiro (quando existir)
  const cleaned = items.map(({ _orderMeta: _drop, ...rest }: any) => rest) as T[];
  if (!meta) return cleaned;
  return cleaned.map((it, i) => (i === 0 ? ({ ...it, _orderMeta: meta } as T) : it));
}
