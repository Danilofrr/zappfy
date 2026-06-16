export const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export const pct = (n: number) => `${(n || 0).toFixed(1)}%`;

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const fmtMonth = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
