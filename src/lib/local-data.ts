// Simple localStorage-backed persistence for traffic indicators and monthly goals.

export type TrafficEntry = {
  id: string;
  date: string; // yyyy-mm-dd
  budget: number;
  leads: number;
  orders: number;
  products: number;
  revenue: number;
};

export type Goal = {
  month: string; // yyyy-mm
  revenue: number;
  orders: number;
  profit: number;
};

const TRAFFIC_KEY = "zappfy:traffic:v1";
const GOALS_KEY = "zappfy:goals:v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, val: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export const trafficStore = {
  list: () => read<TrafficEntry[]>(TRAFFIC_KEY, []),
  save: (list: TrafficEntry[]) => write(TRAFFIC_KEY, list),
  add: (e: TrafficEntry) => {
    const list = trafficStore.list();
    list.unshift(e);
    trafficStore.save(list);
  },
  remove: (id: string) => {
    trafficStore.save(trafficStore.list().filter((x) => x.id !== id));
  },
};

export const goalsStore = {
  list: () => read<Goal[]>(GOALS_KEY, []),
  save: (list: Goal[]) => write(GOALS_KEY, list),
  getForMonth: (ym: string) => goalsStore.list().find((g) => g.month === ym),
  upsert: (g: Goal) => {
    const list = goalsStore.list().filter((x) => x.month !== g.month);
    list.push(g);
    goalsStore.save(list);
  },
};
