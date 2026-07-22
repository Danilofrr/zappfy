import { useCallback, useEffect, useState } from "react";

export type DashboardBlockId =
  | "financeiro"
  | "chart"
  | "champion"
  | "horarios"
  | "insights"
  | "recentes";

export type DashboardBlockConfig = { id: DashboardBlockId; visible: boolean };

export const DASHBOARD_BLOCK_META: Record<
  DashboardBlockId,
  { label: string; description: string }
> = {
  financeiro: { label: "Lucro Real + Meta Ads", description: "Resumo financeiro e ads" },
  chart: { label: "Faturamento x Lucro", description: "Gráfico dos últimos 6 meses" },
  champion: { label: "Produto Campeão", description: "Mais vendido do mês" },
  horarios: { label: "Vendas por Horário", description: "Gráfico por hora + melhores dias" },
  insights: { label: "Ticket Médio + Pagamentos", description: "Ticket e forma mais usada" },
  recentes: { label: "Últimos Pedidos", description: "Lista rápida" },
};

export const DEFAULT_DASHBOARD_LAYOUT: DashboardBlockConfig[] = [
  { id: "financeiro", visible: true },
  { id: "chart", visible: true },
  { id: "champion", visible: true },
  { id: "horarios", visible: true },
  { id: "insights", visible: true },
  { id: "recentes", visible: true },
];

const LAYOUT_KEY = "zappfy:dashboard-layout:v1";
const EDIT_KEY = "zappfy:dashboard-edit";
const EDIT_EVENT = "zappfy:dashboard-edit-toggle";

function mergeWithDefaults(saved: DashboardBlockConfig[]): DashboardBlockConfig[] {
  const known = new Set<DashboardBlockId>(
    Object.keys(DASHBOARD_BLOCK_META) as DashboardBlockId[],
  );
  const seen = new Set<DashboardBlockId>();
  const out: DashboardBlockConfig[] = [];
  for (const b of saved) {
    if (known.has(b.id) && !seen.has(b.id)) {
      out.push({ id: b.id, visible: b.visible !== false });
      seen.add(b.id);
    }
  }
  for (const def of DEFAULT_DASHBOARD_LAYOUT) {
    if (!seen.has(def.id)) out.push(def);
  }
  return out;
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardBlockConfig[]>(DEFAULT_DASHBOARD_LAYOUT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) setLayout(mergeWithDefaults(JSON.parse(raw)));
    } catch {}
  }, []);

  const persist = useCallback((next: DashboardBlockConfig[]) => {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const move = useCallback(
    (id: DashboardBlockId, dir: -1 | 1) => {
      const idx = layout.findIndex((b) => b.id === id);
      if (idx < 0) return;
      const target = idx + dir;
      if (target < 0 || target >= layout.length) return;
      const next = layout.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      persist(next);
    },
    [layout, persist],
  );

  const setVisible = useCallback(
    (id: DashboardBlockId, visible: boolean) => {
      persist(layout.map((b) => (b.id === id ? { ...b, visible } : b)));
    },
    [layout, persist],
  );

  const reset = useCallback(() => persist(DEFAULT_DASHBOARD_LAYOUT), [persist]);

  return { layout, move, setVisible, reset };
}

export function useDashboardEdit() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try {
      setOn(sessionStorage.getItem(EDIT_KEY) === "1");
    } catch {}
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setOn(!!detail);
    };
    window.addEventListener(EDIT_EVENT, handler as EventListener);
    return () => window.removeEventListener(EDIT_EVENT, handler as EventListener);
  }, []);

  const toggle = useCallback(() => {
    const next = !on;
    try {
      sessionStorage.setItem(EDIT_KEY, next ? "1" : "0");
    } catch {}
    window.dispatchEvent(new CustomEvent(EDIT_EVENT, { detail: next }));
    setOn(next);
  }, [on]);

  return { on, toggle };
}
