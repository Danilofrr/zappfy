import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";

export type Product = {
  id: string;
  name: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  description?: string;
  imageUrl?: string;
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
  date: string;
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
  date: string;
  invested: number;
  purchases: number;
  revenue: number;
};

export type ShippingOption = { id: string; label: string; price: number; icon?: string };

export type Settings = {
  storeName: string;
  whatsapp: string;
  pixKey: string;
  address: string;
  deliveryFee: number;
  deliveryLabel: string;
  monthlyRevenueGoal: number;
  monthlyProfitGoal: number;
  checkoutLogoUrl: string;
  checkoutBgColor: string;
  checkoutTheme: "dark" | "light";
  checkoutTextColor: string;
  checkoutCardColor: string;
  checkoutNeonColor: string;
  checkoutButtonLabel: string;
  checkoutButtonColor: string;
  checkoutHeaderBgColor: string;
  checkoutSecureLabel: string;
  checkoutStep1ButtonLabel: string;
  checkoutStep2ButtonLabel: string;
  checkoutStep3ButtonLabel: string;
  checkoutStepButtonColor: string;
  checkoutStepButtonTextColor: string;
  shippingOptions: ShippingOption[];
  checkoutFooterEnabled: boolean;
  checkoutFooterBrand: string;
  checkoutFooterCopyright: string;
  checkoutFooterEmail: string;
  checkoutFooterPayments: string;
  checkoutSecureColor: string;
  checkoutLogoSize: number;
  checkoutFooterBgColor: string;
  checkoutLogoAlign: "left" | "center";
  checkoutStep1Title: string;
  checkoutStep2Title: string;
  checkoutStep3Title: string;
  checkoutFooterCardsImageUrl: string;
  checkoutFooterShowCardsImage: boolean;
  checkoutFooterCardsImageHeight: number;
  checkoutFooterWhatsapp: string;
};

type State = {
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  ads: AdEntry[];
  settings: Settings;
};

const emptySettings: Settings = {
  storeName: "Minha Loja",
  whatsapp: "",
  pixKey: "",
  address: "",
  deliveryFee: 19.90,
  deliveryLabel: "Entrega",
  monthlyRevenueGoal: 0,
  monthlyProfitGoal: 0,
  checkoutLogoUrl: "",
  checkoutBgColor: "#0a0a0a",
  checkoutTheme: "dark",
  checkoutTextColor: "#f8fafc",
  checkoutCardColor: "#111111",
  checkoutNeonColor: "#a855f7",
  checkoutButtonLabel: "Enviar pedido pelo WhatsApp",
  checkoutButtonColor: "#a855f7",
  checkoutHeaderBgColor: "#0a0a0a",
  checkoutSecureLabel: "Checkout seguro",
  checkoutStep1ButtonLabel: "Continuar",
  checkoutStep2ButtonLabel: "Calcular frete",
  checkoutStep3ButtonLabel: "Ir para pagamento",
  checkoutStepButtonColor: "#a855f7",
  checkoutStepButtonTextColor: "#ffffff",
  shippingOptions: [
    { id: "motoboy", label: "Motoboy", price: 19.9, icon: "motorcycle" },
    { id: "pac", label: "Correios PAC", price: 24.9, icon: "truck" },
    { id: "sedex", label: "Correios SEDEX", price: 34.9, icon: "rocket" },
  ],
  checkoutFooterEnabled: true,
  checkoutFooterBrand: "Esparta Imports",
  checkoutFooterCopyright: "© 2026 VILIES NEGOCIOS DIGITAIS CNPJ: 50.888.578/0001-02",
  checkoutFooterEmail: "suporte@espartaimports.com.br",
  checkoutFooterPayments: "pix,visa,mastercard,elo,amex,hipercard",
  checkoutSecureColor: "#a855f7",
  checkoutLogoSize: 40,
  checkoutFooterBgColor: "#0a0a0a",
  checkoutLogoAlign: "left",
  checkoutStep1Title: "Dados pessoais",
  checkoutStep2Title: "Entrega",
  checkoutStep3Title: "Pagamento",
  checkoutFooterCardsImageUrl: "",
  checkoutFooterShowCardsImage: true,
  checkoutFooterCardsImageHeight: 40,
  checkoutFooterWhatsapp: "",
};

const emptyState: State = { products: [], orders: [], expenses: [], ads: [], settings: emptySettings };

// ---------- Seed data (for new accounts / reset) ----------
const today = new Date();
const isoDaysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const isoMonthsAgo = (n: number) => new Date(today.getFullYear(), today.getMonth() - n, 1).toISOString();

const seedProductsData: Omit<Product, "id">[] = [
  { name: "Smartwatch Ultra Série 11", category: "Wearables", cost: 85, price: 199, stock: 24, minStock: 5, description: "Tela AMOLED, GPS, várias pulseiras." },
  { name: "Game Stick X3 Pro", category: "Games", cost: 60, price: 159, stock: 18, minStock: 4, description: "Mais de 10mil jogos retrô, 2 controles." },
  { name: "Projetor HY300", category: "Áudio & Vídeo", cost: 290, price: 599, stock: 9, minStock: 3, description: 'Wi-Fi, Android, projeção até 200".' },
  { name: "Fone Bluetooth Pro", category: "Áudio", cost: 35, price: 99, stock: 42, minStock: 10, description: "ANC, bateria 30h, case carregador." },
  { name: "Carregador Turbo 30W", category: "Acessórios", cost: 18, price: 59, stock: 60, minStock: 15, description: "USB-C PD + USB-A QC3.0." },
  { name: "Capinha Premium iPhone", category: "Acessórios", cost: 9, price: 39, stock: 120, minStock: 30, description: "Silicone líquido, várias cores." },
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
const seedStatuses: OrderStatus[] = ["aguardando", "pago", "separando", "entrega", "entregue", "entregue", "entregue", "cancelado"];
const seedPayments: PaymentMethod[] = ["pix", "pix", "cartao", "dinheiro"];

const seedExpensesData: Omit<Expense, "id">[] = [
  { description: "Facebook Ads — Campanha Smartwatch", category: "ads", amount: 850, date: isoDaysAgo(3) },
  { description: "Motoboy semana 1", category: "motoboy", amount: 420, date: isoDaysAgo(7) },
  { description: "Embalagens e sacolas", category: "embalagens", amount: 180, date: isoDaysAgo(10) },
  { description: "Internet fibra", category: "internet", amount: 120, date: isoDaysAgo(12) },
  { description: "Energia elétrica", category: "energia", amount: 230, date: isoDaysAgo(15) },
  { description: "Aluguel galpão", category: "aluguel", amount: 1800, date: isoDaysAgo(20) },
  { description: "Salário ajudante", category: "funcionarios", amount: 1500, date: isoDaysAgo(22) },
  { description: "Retirada pessoal", category: "retirada", amount: 1200, date: isoDaysAgo(25) },
  { description: "Reposição estoque fones", category: "mercadorias", amount: 980, date: isoDaysAgo(28) },
];

// ---------- Mappers ----------
const toProduct = (r: any): Product => ({
  id: r.id, name: r.name, category: r.category ?? "", cost: Number(r.cost), price: Number(r.price),
  stock: r.stock, minStock: r.min_stock, description: r.description ?? undefined,
  imageUrl: r.image_url ?? undefined,
});
const fromProduct = (p: Omit<Product, "id">) => ({
  name: p.name, category: p.category, cost: p.cost, price: p.price,
  stock: p.stock, min_stock: p.minStock, description: p.description ?? null,
  image_url: p.imageUrl ?? null,
});
const toOrder = (r: any): Order => ({
  id: r.id, customer: r.customer, phone: r.phone ?? "", address: r.address ?? "",
  district: r.district ?? "", city: r.city ?? "", items: (r.items ?? []) as OrderItem[],
  total: Number(r.total), payment: r.payment as PaymentMethod, status: r.status as OrderStatus,
  notes: r.notes ?? undefined, date: r.date,
});
const fromOrder = (o: Omit<Order, "id">) => ({
  customer: o.customer, phone: o.phone, address: o.address, district: o.district, city: o.city,
  items: o.items as any, total: o.total, payment: o.payment, status: o.status,
  notes: o.notes ?? null, date: o.date,
});
const toExpense = (r: any): Expense => ({
  id: r.id, description: r.description, category: r.category as ExpenseCategory,
  amount: Number(r.amount), date: r.date,
});
const fromExpense = (e: Omit<Expense, "id">) => ({
  description: e.description, category: e.category, amount: e.amount, date: e.date,
});
const toAd = (r: any): AdEntry => ({
  id: r.id, date: r.date, invested: Number(r.invested), purchases: r.purchases, revenue: Number(r.revenue),
});
const toSettings = (r: any): Settings => ({
  storeName: r.store_name, whatsapp: r.whatsapp ?? "", pixKey: r.pix_key ?? "",
  address: r.address ?? "", deliveryFee: Number(r.delivery_fee),
  deliveryLabel: r.delivery_label ?? "Entrega",
  monthlyRevenueGoal: Number(r.monthly_revenue_goal), monthlyProfitGoal: Number(r.monthly_profit_goal),
  checkoutLogoUrl: r.checkout_logo_url ?? "",
  checkoutBgColor: r.checkout_bg_color ?? "#0a0a0a",
  checkoutTheme: (r.checkout_theme as "dark" | "light") ?? "dark",
  checkoutTextColor: r.checkout_text_color ?? "#f8fafc",
  checkoutCardColor: r.checkout_card_color ?? "#111111",
  checkoutNeonColor: r.checkout_neon_color ?? "#a855f7",
  checkoutButtonLabel: r.checkout_button_label ?? "Enviar pedido pelo WhatsApp",
  checkoutButtonColor: r.checkout_button_color ?? "#a855f7",
  checkoutHeaderBgColor: r.checkout_header_bg_color ?? "#0a0a0a",
  checkoutSecureLabel: r.checkout_secure_label ?? "Checkout seguro",
  checkoutStep1ButtonLabel: r.checkout_step1_button_label ?? "Continuar",
  checkoutStep2ButtonLabel: r.checkout_step2_button_label ?? "Calcular frete",
  checkoutStep3ButtonLabel: r.checkout_step3_button_label ?? "Ir para pagamento",
  checkoutStepButtonColor: r.checkout_step_button_color ?? "#a855f7",
  checkoutStepButtonTextColor: r.checkout_step_button_text_color ?? "#ffffff",
  shippingOptions: Array.isArray(r.shipping_options) ? r.shipping_options as ShippingOption[] : [],
  checkoutFooterEnabled: r.checkout_footer_enabled ?? true,
  checkoutFooterBrand: r.checkout_footer_brand ?? "",
  checkoutFooterCopyright: r.checkout_footer_copyright ?? "",
  checkoutFooterEmail: r.checkout_footer_email ?? "",
  checkoutFooterPayments: r.checkout_footer_payments ?? "",
  checkoutSecureColor: r.checkout_secure_color ?? r.checkout_neon_color ?? "#a855f7",
  checkoutLogoSize: Number(r.checkout_logo_size ?? 40),
  checkoutFooterBgColor: r.checkout_footer_bg_color ?? r.checkout_header_bg_color ?? "#0a0a0a",
  checkoutLogoAlign: (r.checkout_logo_align as "left" | "center") ?? "left",
  checkoutStep1Title: r.checkout_step1_title ?? "Dados pessoais",
  checkoutStep2Title: r.checkout_step2_title ?? "Entrega",
  checkoutStep3Title: r.checkout_step3_title ?? "Pagamento",
  checkoutFooterCardsImageUrl: r.checkout_footer_cards_image_url ?? "",
  checkoutFooterShowCardsImage: r.checkout_footer_show_cards_image ?? true,
  checkoutFooterCardsImageHeight: Number(r.checkout_footer_cards_image_height ?? 40),
});

type Ctx = {
  state: State;
  loading: boolean;
  user: User | null;
  addProduct: (p: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addOrder: (o: Omit<Order, "id">) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  addExpense: (e: Omit<Expense, "id">) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addAd: (a: Omit<AdEntry, "id">) => Promise<void>;
  deleteAd: (id: string) => Promise<void>;
  updateSettings: (s: Partial<Settings>) => Promise<void>;
  resetSeed: () => Promise<void>;
  signOut: () => Promise<void>;
};

const StoreContext = createContext<Ctx | null>(null);

async function seedForUser(userId: string) {
  const productsPayload = seedProductsData.map((p) => ({ user_id: userId, ...fromProduct(p) }));
  const { data: insertedProducts, error: pErr } = await supabase.from("products").insert(productsPayload).select();
  if (pErr) throw pErr;

  const ordersPayload = Array.from({ length: 22 }).map((_, i) => {
    const p = insertedProducts![i % insertedProducts!.length];
    const qty = 1 + (i % 3);
    const c = customers[i % customers.length];
    return {
      user_id: userId,
      customer: c[0], phone: c[1], address: c[2], district: c[3], city: c[4],
      items: [{ productId: p.id, name: p.name, qty, price: Number(p.price), cost: Number(p.cost) }] as any,
      total: qty * Number(p.price),
      payment: seedPayments[i % seedPayments.length],
      status: seedStatuses[i % seedStatuses.length],
      date: isoDaysAgo(Math.round(i * 1.3)),
    };
  });
  await supabase.from("orders").insert(ordersPayload);

  await supabase.from("expenses").insert(seedExpensesData.map((e) => ({ user_id: userId, ...fromExpense(e) })));

  const adsPayload = Array.from({ length: 6 }).map((_, i) => {
    const invested = 700 + Math.round(Math.random() * 600);
    const purchases = 18 + Math.round(Math.random() * 22);
    return {
      user_id: userId, date: isoMonthsAgo(5 - i),
      invested, purchases, revenue: purchases * (150 + Math.round(Math.random() * 80)),
    };
  });
  await supabase.from("ads").insert(adsPayload);

  await supabase.from("settings").update({
    whatsapp: "5581999990000", pix_key: "techshop@recife.com",
    address: "Av. Conselheiro Aguiar, 1000 — Boa Viagem, Recife/PE",
    delivery_fee: 12, monthly_revenue_goal: 25000, monthly_profit_goal: 8000,
  }).eq("user_id", userId);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const loadedFor = useRef<string | null>(null);

  const loadAll = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const [products, orders, expenses, ads, settings] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("orders").select("*").order("date", { ascending: false }),
        supabase.from("expenses").select("*").order("date", { ascending: false }),
        supabase.from("ads").select("*").order("date", { ascending: true }),
        supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
      ]);

      setState({
        products: (products.data ?? []).map(toProduct),
        orders: (orders.data ?? []).map(toOrder),
        expenses: (expenses.data ?? []).map(toExpense),
        ads: (ads.data ?? []).map(toAd),
        settings: settings.data ? toSettings(settings.data) : emptySettings,
      });
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      if (data.user && loadedFor.current !== data.user.id) {
        loadedFor.current = data.user.id;
        loadAll(data.user.id);
      } else if (!data.user) {
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (event === "SIGNED_IN" && u && loadedFor.current !== u.id) {
        loadedFor.current = u.id;
        loadAll(u.id);
      }
      if (event === "SIGNED_OUT") {
        loadedFor.current = null;
        setState(emptyState);
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadAll]);

  const value: Ctx = useMemo(() => ({
    state, loading, user,
    async addProduct(p) {
      if (!user) return;
      const { data, error } = await supabase.from("products").insert({ user_id: user.id, ...fromProduct(p) }).select().single();
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, products: [toProduct(data), ...s.products] }));
    },
    async updateProduct(id, p) {
      const patch: any = {};
      if (p.name !== undefined) patch.name = p.name;
      if (p.category !== undefined) patch.category = p.category;
      if (p.cost !== undefined) patch.cost = p.cost;
      if (p.price !== undefined) patch.price = p.price;
      if (p.stock !== undefined) patch.stock = p.stock;
      if (p.minStock !== undefined) patch.min_stock = p.minStock;
      if (p.description !== undefined) patch.description = p.description;
      if (p.imageUrl !== undefined) patch.image_url = p.imageUrl;
      const { data, error } = await supabase.from("products").update(patch).eq("id", id).select().single();
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, products: s.products.map((x) => x.id === id ? toProduct(data) : x) }));
    },
    async deleteProduct(id) {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, products: s.products.filter((x) => x.id !== id) }));
    },
    async addOrder(o) {
      if (!user) return;
      const { data, error } = await supabase.from("orders").insert({ user_id: user.id, ...fromOrder(o) }).select().single();
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, orders: [toOrder(data), ...s.orders] }));
    },
    async updateOrderStatus(id, status) {
      const { data, error } = await supabase.from("orders").update({ status }).eq("id", id).select().single();
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, orders: s.orders.map((x) => x.id === id ? toOrder(data) : x) }));
    },
    async deleteOrder(id) {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, orders: s.orders.filter((x) => x.id !== id) }));
    },
    async addExpense(e) {
      if (!user) return;
      const { data, error } = await supabase.from("expenses").insert({ user_id: user.id, ...fromExpense(e) }).select().single();
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, expenses: [toExpense(data), ...s.expenses] }));
    },
    async deleteExpense(id) {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== id) }));
    },
    async addAd(a) {
      if (!user) return;
      const { data, error } = await supabase.from("ads").insert({
        user_id: user.id, date: a.date, invested: a.invested, purchases: a.purchases, revenue: a.revenue,
      }).select().single();
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, ads: [...s.ads, toAd(data)].sort((x, y) => x.date.localeCompare(y.date)) }));
    },
    async deleteAd(id) {
      const { error } = await supabase.from("ads").delete().eq("id", id);
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, ads: s.ads.filter((x) => x.id !== id) }));
    },
    async updateSettings(p) {
      if (!user) return;
      const patch: any = {};
      if (p.storeName !== undefined) patch.store_name = p.storeName;
      if (p.whatsapp !== undefined) patch.whatsapp = p.whatsapp;
      if (p.pixKey !== undefined) patch.pix_key = p.pixKey;
      if (p.address !== undefined) patch.address = p.address;
      if (p.deliveryFee !== undefined) patch.delivery_fee = p.deliveryFee;
      if (p.monthlyRevenueGoal !== undefined) patch.monthly_revenue_goal = p.monthlyRevenueGoal;
      if (p.monthlyProfitGoal !== undefined) patch.monthly_profit_goal = p.monthlyProfitGoal;
      if (p.checkoutLogoUrl !== undefined) patch.checkout_logo_url = p.checkoutLogoUrl;
      if (p.checkoutBgColor !== undefined) patch.checkout_bg_color = p.checkoutBgColor;
      if (p.checkoutTheme !== undefined) patch.checkout_theme = p.checkoutTheme;
      if (p.checkoutTextColor !== undefined) patch.checkout_text_color = p.checkoutTextColor;
      if (p.checkoutCardColor !== undefined) patch.checkout_card_color = p.checkoutCardColor;
      if (p.checkoutNeonColor !== undefined) patch.checkout_neon_color = p.checkoutNeonColor;
      if (p.deliveryLabel !== undefined) patch.delivery_label = p.deliveryLabel;
      if (p.checkoutButtonLabel !== undefined) patch.checkout_button_label = p.checkoutButtonLabel;
      if (p.checkoutButtonColor !== undefined) patch.checkout_button_color = p.checkoutButtonColor;
      if (p.checkoutHeaderBgColor !== undefined) patch.checkout_header_bg_color = p.checkoutHeaderBgColor;
      if (p.checkoutSecureLabel !== undefined) patch.checkout_secure_label = p.checkoutSecureLabel;
      if (p.checkoutStep1ButtonLabel !== undefined) patch.checkout_step1_button_label = p.checkoutStep1ButtonLabel;
      if (p.checkoutStep2ButtonLabel !== undefined) patch.checkout_step2_button_label = p.checkoutStep2ButtonLabel;
      if (p.checkoutStep3ButtonLabel !== undefined) patch.checkout_step3_button_label = p.checkoutStep3ButtonLabel;
      if (p.checkoutStepButtonColor !== undefined) patch.checkout_step_button_color = p.checkoutStepButtonColor;
      if (p.checkoutStepButtonTextColor !== undefined) patch.checkout_step_button_text_color = p.checkoutStepButtonTextColor;
      if (p.shippingOptions !== undefined) patch.shipping_options = p.shippingOptions as any;
      if (p.checkoutFooterEnabled !== undefined) patch.checkout_footer_enabled = p.checkoutFooterEnabled;
      if (p.checkoutFooterBrand !== undefined) patch.checkout_footer_brand = p.checkoutFooterBrand;
      if (p.checkoutFooterCopyright !== undefined) patch.checkout_footer_copyright = p.checkoutFooterCopyright;
      if (p.checkoutFooterEmail !== undefined) patch.checkout_footer_email = p.checkoutFooterEmail;
      if (p.checkoutFooterPayments !== undefined) patch.checkout_footer_payments = p.checkoutFooterPayments;
      if (p.checkoutSecureColor !== undefined) patch.checkout_secure_color = p.checkoutSecureColor;
      if (p.checkoutLogoSize !== undefined) patch.checkout_logo_size = p.checkoutLogoSize;
      if (p.checkoutFooterBgColor !== undefined) patch.checkout_footer_bg_color = p.checkoutFooterBgColor;
      if (p.checkoutLogoAlign !== undefined) patch.checkout_logo_align = p.checkoutLogoAlign;
      if (p.checkoutStep1Title !== undefined) patch.checkout_step1_title = p.checkoutStep1Title;
      if (p.checkoutStep2Title !== undefined) patch.checkout_step2_title = p.checkoutStep2Title;
      if (p.checkoutStep3Title !== undefined) patch.checkout_step3_title = p.checkoutStep3Title;
      if (p.checkoutFooterCardsImageUrl !== undefined) patch.checkout_footer_cards_image_url = p.checkoutFooterCardsImageUrl;
      if (p.checkoutFooterShowCardsImage !== undefined) patch.checkout_footer_show_cards_image = p.checkoutFooterShowCardsImage;
      if (p.checkoutFooterCardsImageHeight !== undefined) patch.checkout_footer_cards_image_height = p.checkoutFooterCardsImageHeight;
      const { data, error } = await supabase.from("settings").update(patch).eq("user_id", user.id).select().single();
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, settings: toSettings(data) }));
    },
    async resetSeed() {
      if (!user) return;
      setLoading(true);
      await Promise.all([
        supabase.from("orders").delete().eq("user_id", user.id),
        supabase.from("products").delete().eq("user_id", user.id),
        supabase.from("expenses").delete().eq("user_id", user.id),
        supabase.from("ads").delete().eq("user_id", user.id),
      ]);
      await seedForUser(user.id);
      await loadAll(user.id);
    },
    async signOut() {
      await supabase.auth.signOut();
      setState(emptyState);
      loadedFor.current = null;
      if (typeof window !== "undefined") window.location.href = "/auth";
    },
  }), [state, loading, user, loadAll]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export function useFinance(range?: { start: Date; end: Date }) {
  const { state } = useStore();
  const { start, end } = range ?? monthRange();

  const monthOrders = state.orders.filter(
    (o) => new Date(o.date) >= start && new Date(o.date) < end && o.status !== "cancelado",
  );
  const revenue = monthOrders.reduce((a, o) => a + o.total, 0);
  const cogs = monthOrders.reduce((a, o) => a + o.items.reduce((b, i) => b + i.cost * i.qty, 0), 0);

  const monthExpenses = state.expenses.filter((e) => new Date(e.date) >= start && new Date(e.date) < end);
  const adsSpend = monthExpenses.filter((e) => e.category === "ads").reduce((a, e) => a + e.amount, 0);
  const opEx = monthExpenses.filter((e) => e.category !== "ads").reduce((a, e) => a + e.amount, 0);

  const profit = revenue - cogs - adsSpend - opEx;

  const allRevenue = state.orders
    .filter((o) => o.status !== "cancelado" && o.status !== "aguardando")
    .reduce((a, o) => a + o.total, 0);
  const allExpenses = state.expenses.reduce((a, e) => a + e.amount, 0);
  const allCogs = state.orders
    .filter((o) => o.status !== "cancelado" && o.status !== "aguardando")
    .reduce((a, o) => a + o.items.reduce((b, i) => b + i.cost * i.qty, 0), 0);
  const cash = allRevenue - allExpenses - allCogs;

  return { revenue, cogs, adsSpend, opEx, profit, cash, ordersCount: monthOrders.length };
}
