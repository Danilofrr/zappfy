export const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export const pct = (n: number) => `${(n || 0).toFixed(1)}%`;

export const todayDateInput = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const dateInputToLocalISO = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0).toISOString();
};

export const dateOnlyToLocalDate = (d: string | Date) => {
  if (d instanceof Date) return d;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!match) return new Date(d);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
};

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const fmtBusinessDate = (d: string | Date) =>
  dateOnlyToLocalDate(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const fmtMonth = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
