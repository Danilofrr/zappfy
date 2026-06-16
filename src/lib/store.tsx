import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Product = {
  id: string;
  name: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  description?: string;
};

export type OrderStatus =
  | "aguardando"
  | "pago"
  | "separando"
  | "entrega"
  | "entregue"
  | "cancelado";

export type PaymentMethod = "pix" | "cartao" | "dinheiro";

export type OrderItem = { productId: string; name: string; qty: number; price: number; cost: number };

export type Order = {
  id: string;
  customer: string;
  phone: string;
  address: string;
  district: string;
  city: string;
  items: OrderItem[];
  total: number;
  payment: PaymentMethod;
  status: OrderStatus;
  notes?: string;
  date: string; // ISO
};

export type ExpenseCategory =
  | "ads"
  | "mercadorias"
  | "motoboy"
  | "embalagens"
  | "internet"
  | "energia"
  | "aluguel"
  | "funcionarios"
  | "retirada"
  | "outros";

export type Expense = {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
};

export type AdEntry = {
  id: string;
  date: string; // ISO month start
  invested: number;
  purchases: number;
  revenue: number;
};

export type Settings = {
  storeName: string;
  whatsapp: string;
  pixKey: string;
  address: string;
  deliveryFee: number;
  monthlyRevenueGoal: number;
  monthlyProfitGoal: number;
};

type State = {
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  ads: AdEntry[];
  settings: Settings;
};

const KEY = "lucrotrack:v1";

const today = new Date();
const isoDaysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const isoMonthsAgo = (n: number) => {
  const d = new Date(today.getFullYear(), today.getMonth() - n, 1);
  return d.toISOString();
};

const seedProducts: Product[] = [
  { id: "p1", name: "Smartwatch Ultra Série 11", category: "Wearables", cost: 85, price: 199, stock: 24, minStock: 5, description: "Tela AMOLED, GPS, várias pulseiras." },
  { id: "p2", name: "Game Stick X3 Pro", category: "Games", cost: 60, price: 159, stock: 18, minStock: 4, description: "Mais de 10mil jogos retrô, 2 controles." },
  { id: "p3", name: "Projetor HY300", category: "Áudio & Vídeo", cost: 290, price: 599, stock: 9, minStock: 3, description: "Wi-Fi, Android, projeção até 200\"." },
  { id: "p4", name: "Fone Bluetooth Pro", category: "Áudio", cost: 35, price: 99, stock: 42, minStock: 10, description: "ANC, bateria 30h, case carregador." },
  { id: "p5", name: "Carregador Turbo 30W", category: "Acessórios", cost: 18, price: 59, stock: 60, minStock: 15, description: "USB-C PD + USB-A QC3.0." },
  { id: "p6", name: "Capinha Premium iPhone", category: "Acessórios", cost: 9, price: 39, stock: 120, minStock: 30, description: "Silicone líquido, várias cores." },
];

const customers = [
  ["João Silva", "(81) 99999-1111", "Rua das Flores, 123", "Boa Viagem", "Recife"],
  ["Maria Souza", "(81) 99988-2222", "Av. Caxangá, 4500", "Várzea", "Recife"],
  ["Pedro Lima", "(81) 99977-3333", "Rua do Sol, 78", "Casa Forte", "Recife"],
  ["Ana Costa", "(81) 99966-4444", "Rua Real, 220", "Madalena", "Recife"],
  ["Carlos Dias", "(81) 99955-5555", "Av. Boa Viagem, 1010", "Boa Viagem", "Recife"],
  ["Juliana Reis", "(81) 99944-6666", "Rua da Aurora, 305", "Santo Amaro", "Recife"],
  ["Rafael Mota", "(81) 99933-7777", "Rua Padre Carapuceiro, 88", "Boa Viagem", "Recife"],
  ["Patrícia Alves", "(81) 99922-8888", "Av. Conde da Boa Vista, 12", "Boa Vista", "Recife"],
];

const statuses: OrderStatus[] = ["aguardando", "pago", "separando", "entrega", "entregue", "entregue", "entregue", "cancelado"];
const payments: PaymentMethod[] = ["pix", "pix", "cartao", "dinheiro"];

const seedOrders: Order[] = Array.from({ length: 22 }).map((_, i) => {
  const p = seedProducts[i % seedProducts.length];
  const qty = 1 + (i % 3);
  const c = customers[i % customers.length];
  return {
    id: `o${1000 + i}`,
    customer: c[0],
    phone: c[1],
    address: c[2],
    district: c[3],
    city: c[4],
    items: [{ productId: p.id, name: p.name, qty, price: p.price, cost: p.cost }],
    total: qty * p.price,
    payment: payments[i % payments.length],
    status: statuses[i % statuses.length],
    date: isoDaysAgo(i * 1.3),
  };
});

const seedExpenses: Expense[] = [
  { id: "e1", description: "Facebook Ads — Campanha Smartwatch", category: "ads", amount: 850, date: isoDaysAgo(3) },
  { id: "e2", description: "Motoboy semana 1", category: "motoboy", amount: 420, date: isoDaysAgo(7) },
  { id: "e3", description: "Embalagens e sacolas", category: "embalagens", amount: 180, date: isoDaysAgo(10) },
  { id: "e4", description: "Internet fibra", category: "internet", amount: 120, date: isoDaysAgo(12) },
  { id: "e5", description: "Energia elétrica", category: "energia", amount: 230, date: isoDaysAgo(15) },
  { id: "e6", description: "Aluguel galpão", category: "aluguel", amount: 1800, date: isoDaysAgo(20) },
  { id: "e7", description: "Salário ajudante", category: "funcionarios", amount: 1500, date: isoDaysAgo(22) },
  { id: "e8", description: "Retirada pessoal", category: "retirada", amount: 1200, date: isoDaysAgo(25) },
  { id: "e9", description: "Reposição estoque fones", category: "mercadorias", amount: 980, date: isoDaysAgo(28) },
];

const seedAds: AdEntry[] = Array.from({ length: 6 }).map((_, i) => {
  const invested = 700 + Math.round(Math.random() * 600);
  const purchases = 18 + Math.round(Math.random() * 22);
  return {
    id: `ad${i}`,
    date: isoMonthsAgo(5 - i),
    invested,
    purchases,
    revenue: purchases * (150 + Math.round(Math.random() * 80)),
  };
});

const seedSettings: Settings = {
  storeName: "TechShop Recife",
  whatsapp: "5581999990000",
  pixKey: "techshop@recife.com",
  address: "Av. Conselheiro Aguiar, 1000 — Boa Viagem, Recife/PE",
  deliveryFee: 12,
  monthlyRevenueGoal: 25000,
  monthlyProfitGoal: 8000,
};

const initial: State = {
  products: seedProducts,
  orders: seedOrders,
  expenses: seedExpenses,
  ads: seedAds,
  settings: seedSettings,
};

type Ctx = {
  state: State;
  setState: (updater: (s: State) => State) => void;
  addProduct: (p: Omit<Product, "id">) => void;
  updateProduct: (id: string, p: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addOrder: (o: Omit<Order, "id">) => Order;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  deleteOrder: (id: string) => void;
  addExpense: (e: Omit<Expense, "id">) => void;
  deleteExpense: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  resetSeed: () => void;
};

const StoreContext = createContext<Ctx | null>(null);

function load(): State {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    return { ...initial, ...JSON.parse(raw) };
  } catch {
    return initial;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStateRaw(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  const value: Ctx = useMemo(() => {
    const setState = (u: (s: State) => State) => setStateRaw((s) => u(s));
    const uid = () => Math.random().toString(36).slice(2, 10);
    return {
      state,
      setState,
      addProduct: (p) => setState((s) => ({ ...s, products: [{ id: uid(), ...p }, ...s.products] })),
      updateProduct: (id, p) =>
        setState((s) => ({ ...s, products: s.products.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      deleteProduct: (id) => setState((s) => ({ ...s, products: s.products.filter((x) => x.id !== id) })),
      addOrder: (o) => {
        const order = { id: uid(), ...o };
        setState((s) => ({ ...s, orders: [order, ...s.orders] }));
        return order;
      },
      updateOrderStatus: (id, status) =>
        setState((s) => ({ ...s, orders: s.orders.map((x) => (x.id === id ? { ...x, status } : x)) })),
      deleteOrder: (id) => setState((s) => ({ ...s, orders: s.orders.filter((x) => x.id !== id) })),
      addExpense: (e) => setState((s) => ({ ...s, expenses: [{ id: uid(), ...e }, ...s.expenses] })),
      deleteExpense: (id) => setState((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== id) })),
      updateSettings: (p) => setState((s) => ({ ...s, settings: { ...s.settings, ...p } })),
      resetSeed: () => setStateRaw(initial),
    };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// Derived selectors
export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export function useFinance() {
  const { state } = useStore();
  const { start, end } = monthRange();

  const monthOrders = state.orders.filter(
    (o) => new Date(o.date) >= start && new Date(o.date) < end && o.status !== "cancelado",
  );
  const revenue = monthOrders.reduce((a, o) => a + o.total, 0);
  const cogs = monthOrders.reduce((a, o) => a + o.items.reduce((b, i) => b + i.cost * i.qty, 0), 0);

  const monthExpenses = state.expenses.filter((e) => new Date(e.date) >= start && new Date(e.date) < end);
  const adsSpend = monthExpenses.filter((e) => e.category === "ads").reduce((a, e) => a + e.amount, 0);
  const opEx = monthExpenses.filter((e) => e.category !== "ads").reduce((a, e) => a + e.amount, 0);

  const profit = revenue - cogs - adsSpend - opEx;

  // Cash balance (all-time): all paid+delivered revenue - all expenses
  const allRevenue = state.orders
    .filter((o) => o.status !== "cancelado" && o.status !== "aguardando")
    .reduce((a, o) => a + o.total, 0);
  const allExpenses = state.expenses.reduce((a, e) => a + e.amount, 0);
  const allCogs = state.orders
    .filter((o) => o.status !== "cancelado" && o.status !== "aguardando")
    .reduce((a, o) => a + o.items.reduce((b, i) => b + i.cost * i.qty, 0), 0);
  const cash = allRevenue - allExpenses - allCogs;

  return {
    revenue,
    cogs,
    adsSpend,
    opEx,
    profit,
    cash,
    ordersCount: monthOrders.length,
  };
}
