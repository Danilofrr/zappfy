import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { dateOnlyToLocalDate } from "@/lib/format";

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

export type PaymentMethod = "pix" | "cartao" | "debito" | "dinheiro";

export type OrderItem = { productId: string; name: string; qty: number; price: number; cost: number; cpf?: string; email?: string };

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
  checkoutFooterCnpj: string;
  checkoutFooterShowCnpj: boolean;
  checkoutFooterShowEmail: boolean;
  checkoutFooterShowWhatsapp: boolean;
  motoboyMessageTemplate: string;
  deliveryMessageTemplate: string;
  customerTrackingMessageTemplate: string;
  motoboyFee: number;
  taxPct: number;
  cardFeePct: number;
  platformFeePct: number;
  adsTaxPct: number;
  otherFeesPct: number;
  cardMachineFees: Record<string, Record<number, number>>;
  cardFeeMode: "absorb" | "passthrough";
  slug: string;
};


type State = {
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  ads: AdEntry[];
  settings: Settings;
};
export const DEFAULT_MOTOBOY_TEMPLATE = `🛵 *NOVA ENTREGA*\n\n👤 *Cliente:* {cliente}\n📦 *Produto:* {produto}\n📍 *Endereço:* {endereco}\n🗺️ *Localização:* {mapa}\n📱 *Telefone:* {telefone}\n\n💰 *Pagamento:* {pagamento}\n💵 *Total:* {total}`;
export const DEFAULT_DELIVERY_TEMPLATE = `Oba! 🎉 Seu pedido{produto} acabou de sair para entrega!\n\nOlá *{cliente}*, tudo bem? Em instantes você o receberá no endereço:\n{endereco}\n\nQualquer dúvida é só chamar por aqui. 🛵\n— {loja}`;

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
  checkoutFooterBrand: "Zappfy",
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
  checkoutFooterCnpj: "",
  checkoutFooterShowCnpj: true,
  checkoutFooterShowEmail: true,
  checkoutFooterShowWhatsapp: true,
  motoboyMessageTemplate: DEFAULT_MOTOBOY_TEMPLATE,
  deliveryMessageTemplate: DEFAULT_DELIVERY_TEMPLATE,
  customerTrackingMessageTemplate: "",
  motoboyFee: 0,
  taxPct: 0,
  cardFeePct: 0,
  platformFeePct: 0,
  adsTaxPct: 0,
  otherFeesPct: 0,
  cardMachineFees: {},
  cardFeeMode: "passthrough",
  slug: "",
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
  items: o.items as any, total: Math.round((Number(o.total) || 0) * 100) / 100, payment: o.payment, status: o.status,
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
  checkoutFooterWhatsapp: r.checkout_footer_whatsapp ?? "",
  checkoutFooterCnpj: r.checkout_footer_cnpj ?? "",
  checkoutFooterShowCnpj: r.checkout_footer_show_cnpj ?? true,
  checkoutFooterShowEmail: r.checkout_footer_show_email ?? true,
  checkoutFooterShowWhatsapp: r.checkout_footer_show_whatsapp ?? true,
  motoboyMessageTemplate: r.motoboy_message_template ?? emptySettings.motoboyMessageTemplate,
  deliveryMessageTemplate: r.delivery_message_template ?? emptySettings.deliveryMessageTemplate,
  customerTrackingMessageTemplate: r.customer_tracking_message_template ?? "",
  motoboyFee: Number(r.motoboy_fee ?? 0),
  taxPct: Number(r.tax_pct ?? 0),
  cardFeePct: Number(r.card_fee_pct ?? 0),
  platformFeePct: Number(r.platform_fee_pct ?? 0),
  adsTaxPct: Number(r.ads_tax_pct ?? 0),
  otherFeesPct: Number(r.other_fees_pct ?? 0),
  cardMachineFees: (r.card_machine_fees && typeof r.card_machine_fees === "object") ? r.card_machine_fees as Record<string, Record<number, number>> : {},
  cardFeeMode: (r.card_fee_mode === "absorb" ? "absorb" : "passthrough"),
  slug: r.slug ?? "",
});


type Ctx = {
  state: State;
  loading: boolean;
  user: User | null;
  addProduct: (p: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addOrder: (o: Omit<Order, "id">) => Promise<void>;
  updateOrder: (id: string, patch: Partial<Omit<Order, "id">>) => Promise<void>;
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
  const productsPayload = seedProductsData.map((p) => ({ user_id: userId, store_id: userId, ...fromProduct(p) }));
  const { data: insertedProducts, error: pErr } = await supabase.from("products").insert(productsPayload).select();
  if (pErr) throw pErr;

  const ordersPayload = Array.from({ length: 22 }).map((_, i) => {
    const p = insertedProducts![i % insertedProducts!.length];
    const qty = 1 + (i % 3);
    const c = customers[i % customers.length];
    return {
      user_id: userId,
      store_id: userId,
      customer: c[0], phone: c[1], address: c[2], district: c[3], city: c[4],
      items: [{ productId: p.id, name: p.name, qty, price: Number(p.price), cost: Number(p.cost) }] as any,
      total: qty * Number(p.price),
      payment: seedPayments[i % seedPayments.length],
      status: seedStatuses[i % seedStatuses.length],
      date: isoDaysAgo(Math.round(i * 1.3)),
    };
  });
  await supabase.from("orders").insert(ordersPayload);

  await supabase.from("expenses").insert(seedExpensesData.map((e) => ({ user_id: userId, store_id: userId, ...fromExpense(e) })));

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
  }).eq("store_id", userId);
}

const ACTIVE_STORE_KEY = "zappfy.active_store_id";
function readActiveStoreId(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(ACTIVE_STORE_KEY); } catch { return null; }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(() => readActiveStoreId());
  const activeStoreIdRef = useRef<string | null>(activeStoreId);
  const loadedFor = useRef<string | null>(null);
  const loadSeq = useRef(0);

  useEffect(() => {
    activeStoreIdRef.current = activeStoreId;
  }, [activeStoreId]);

  const resolveStoreId = useCallback(async (userId: string, preferredStoreId: string | null) => {
    const { data, error } = await supabase
      .from("stores")
      .select("id,is_default")
      .eq("owner_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error || !data?.length) return preferredStoreId ?? userId;

    const validPreferred = preferredStoreId ? data.find((store) => store.id === preferredStoreId) : null;
    const resolved = validPreferred?.id ?? data.find((store) => store.is_default)?.id ?? data[0]?.id ?? userId;

    if (typeof window !== "undefined" && resolved !== preferredStoreId) {
      try {
        localStorage.setItem(ACTIVE_STORE_KEY, resolved);
      } catch {}
    }

    return resolved;
  }, []);

  const loadAll = useCallback(async (userId: string, storeId: string | null) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const sid = storeId ?? userId;
      const [products, orders, expenses, ads, settings] = await Promise.all([
        supabase.from("products").select("*").eq("store_id", sid).order("created_at", { ascending: false }),
        supabase.from("orders").select("*").eq("store_id", sid).order("date", { ascending: false }),
        supabase.from("expenses").select("*").eq("store_id", sid).order("date", { ascending: false }),
        supabase.from("ads").select("*").eq("user_id", userId).order("date", { ascending: true }),
        supabase.from("settings").select("*").eq("store_id", sid).maybeSingle(),
      ]);

      if (seq !== loadSeq.current) return;

      setState({
        products: (products.data ?? []).map(toProduct),
        orders: (orders.data ?? []).map(toOrder),
        expenses: (expenses.data ?? []).map(toExpense),
        ads: (ads.data ?? []).map(toAd),
        settings: settings.data ? toSettings(settings.data) : emptySettings,
      });
    } catch (e: any) {
      if (seq === loadSeq.current) {
        console.error(e);
        toast.error("Erro ao carregar dados");
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  const loadForUser = useCallback(async (userId: string, preferredStoreId: string | null) => {
    const resolvedStoreId = await resolveStoreId(userId, preferredStoreId);
    if (activeStoreIdRef.current !== resolvedStoreId) {
      activeStoreIdRef.current = resolvedStoreId;
      setActiveStoreId(resolvedStoreId);
    }

    const key = `${userId}:${resolvedStoreId ?? userId}`;
    if (loadedFor.current !== key) {
      loadedFor.current = key;
      await loadAll(userId, resolvedStoreId);
    }
  }, [loadAll, resolveStoreId]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      if (data.user) {
        await loadForUser(data.user.id, activeStoreIdRef.current ?? readActiveStoreId());
      } else if (!data.user) {
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser((prev) => {
        if (prev && u && prev.id !== u.id) {
          loadedFor.current = null;
          setState(emptyState);
        }
        return u;
      });
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && u) {
        loadForUser(u.id, activeStoreIdRef.current ?? readActiveStoreId());
      }
      if (event === "SIGNED_OUT") {
        loadSeq.current += 1;
        loadedFor.current = null;
        setState(emptyState);
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY") {
        const evMap = {
          SIGNED_IN: "signed_in",
          SIGNED_OUT: "signed_out",
          USER_UPDATED: "user_updated",
          PASSWORD_RECOVERY: "password_recovery",
        } as const;
        import("@/lib/access-log.functions").then(({ logAuthEvent }) => {
          logAuthEvent({
            data: {
              event: evMap[event as keyof typeof evMap],
              email: u?.email ?? undefined,
              user_id: u?.id ?? undefined,
            },
          }).catch(() => {});
        }).catch(() => {});
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadForUser]);

  // Reage a troca de loja ativa (StoreSwitcher dispara CustomEvent)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = (e: Event) => {
      const id = (e as CustomEvent).detail?.id ?? readActiveStoreId();
      activeStoreIdRef.current = id;
      setActiveStoreId(id);
      if (user) {
        loadedFor.current = `${user.id}:${id ?? user.id}`;
        loadAll(user.id, id);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_STORE_KEY) onChange(new CustomEvent("zappfy:active-store-change", { detail: { id: e.newValue } }));
    };
    window.addEventListener("zappfy:active-store-change", onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("zappfy:active-store-change", onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [user, loadAll]);

  // Realtime: novos pedidos do checkout público entram direto na dashboard
  useEffect(() => {
    if (!user) return;
    const sid = activeStoreId ?? user.id;
    const channel = supabase
      .channel(`orders-${sid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${sid}` },
        (payload) => {
          const next = toOrder(payload.new);
          setState((s) =>
            s.orders.some((o) => o.id === next.id) ? s : { ...s, orders: [next, ...s.orders] },
          );
          // Pedido veio do checkout público: o RPC já abateu o estoque no banco.
          // Refaz a leitura dos produtos afetados para refletir o novo estoque na UI.
          (async () => {
            const ids = Array.from(new Set(next.items.map((i) => i.productId).filter(Boolean)));
            if (!ids.length) return;
            const { data } = await supabase.from("products").select("*").in("id", ids);
            if (!data) return;
            const updated = data.map(toProduct);
            setState((s) => ({
              ...s,
              products: s.products.map((p) => updated.find((u) => u.id === p.id) ?? p),
            }));
          })();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `store_id=eq.${sid}` },
        (payload) => {
          const next = toOrder(payload.new);
          setState((s) => ({ ...s, orders: s.orders.map((o) => (o.id === next.id ? next : o)) }));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders", filter: `store_id=eq.${sid}` },
        (payload) => {
          const id = (payload.old as any)?.id;
          if (!id) return;
          setState((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== id) }));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products", filter: `store_id=eq.${sid}` },
        (payload) => {
          const next = toProduct(payload.new);
          setState((s) => ({
            ...s,
            products: s.products.map((p) => (p.id === next.id ? next : p)),
          }));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, activeStoreId]);


  const value: Ctx = useMemo(() => ({
    state, loading, user,
    async addProduct(p) {
      if (!user) return;
      const sid = activeStoreId ?? user.id;
      const { data, error } = await supabase.from("products").insert({ user_id: user.id, store_id: sid, ...fromProduct(p) }).select().single();
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
      const sid = activeStoreId ?? user.id;
      const { data, error } = await supabase.from("orders").insert({ user_id: user.id, store_id: sid, ...fromOrder(o) }).select().single();
      if (error) {
        toast.error(error.message || "Erro ao criar pedido");
        throw error;
      }
      // Baixa de estoque para cada item do pedido (ignora cancelado)
      if (o.status !== "cancelado") {
        const updatedProducts: Product[] = [];
        for (const it of o.items) {
          const prod = state.products.find((p) => p.id === it.productId);
          if (!prod) continue;
          const newStock = Math.max(0, prod.stock - it.qty);
          const { data: pd } = await supabase.from("products").update({ stock: newStock }).eq("id", it.productId).select().single();
          if (pd) updatedProducts.push(toProduct(pd));
        }
        setState((s) => ({
          ...s,
          orders: s.orders.some((o) => o.id === data.id)
            ? s.orders.map((o) => (o.id === data.id ? toOrder(data) : o))
            : [toOrder(data), ...s.orders],
          products: s.products.map((p) => updatedProducts.find((u) => u.id === p.id) ?? p),
        }));
      } else {
        setState((s) => ({
          ...s,
          orders: s.orders.some((o) => o.id === data.id)
            ? s.orders.map((o) => (o.id === data.id ? toOrder(data) : o))
            : [toOrder(data), ...s.orders],
        }));
      }
    },
    async updateOrder(id, patch) {
      const body: any = {};
      if (patch.customer !== undefined) body.customer = patch.customer;
      if (patch.phone !== undefined) body.phone = patch.phone;
      if (patch.address !== undefined) body.address = patch.address;
      if (patch.district !== undefined) body.district = patch.district;
      if (patch.city !== undefined) body.city = patch.city;
      if (patch.notes !== undefined) body.notes = patch.notes;
      if (patch.payment !== undefined) body.payment = patch.payment;
      if (patch.status !== undefined) body.status = patch.status;
      if (patch.items !== undefined) body.items = patch.items;
      if (patch.total !== undefined) body.total = patch.total;
      if ((patch as any).date !== undefined) body.date = (patch as any).date;
      const { data, error } = await supabase.from("orders").update(body).eq("id", id).select().single();
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, orders: s.orders.map((x) => x.id === id ? toOrder(data) : x) }));
    },
    async updateOrderStatus(id, status) {
      const prev = state.orders.find((o) => o.id === id);
      const { data, error } = await supabase.from("orders").update({ status }).eq("id", id).select().single();
      if (error) { toast.error(error.message); return; }
      // Ajusta o estoque quando o pedido é cancelado ou reativado
      const updatedProducts: Product[] = [];
      if (prev && prev.status !== "cancelado" && status === "cancelado") {
        // devolve o estoque
        for (const it of prev.items) {
          const prod = state.products.find((p) => p.id === it.productId);
          if (!prod) continue;
          const newStock = prod.stock + it.qty;
          const { data: pd } = await supabase.from("products").update({ stock: newStock }).eq("id", it.productId).select().single();
          if (pd) updatedProducts.push(toProduct(pd));
        }
      } else if (prev && prev.status === "cancelado" && status !== "cancelado") {
        // reabate do estoque
        for (const it of prev.items) {
          const prod = state.products.find((p) => p.id === it.productId);
          if (!prod) continue;
          const newStock = Math.max(0, prod.stock - it.qty);
          const { data: pd } = await supabase.from("products").update({ stock: newStock }).eq("id", it.productId).select().single();
          if (pd) updatedProducts.push(toProduct(pd));
        }
      }
      setState((s) => ({
        ...s,
        orders: s.orders.map((x) => x.id === id ? toOrder(data) : x),
        products: updatedProducts.length
          ? s.products.map((p) => updatedProducts.find((u) => u.id === p.id) ?? p)
          : s.products,
      }));
    },

    async deleteOrder(id) {
      const order = state.orders.find((o) => o.id === id);
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) { toast.error(error.message); return; }
      // Devolve o estoque se o pedido não estava cancelado
      const updatedProducts: Product[] = [];
      if (order && order.status !== "cancelado") {
        for (const it of order.items) {
          const prod = state.products.find((p) => p.id === it.productId);
          if (!prod) continue;
          const newStock = prod.stock + it.qty;
          const { data: pd } = await supabase.from("products").update({ stock: newStock }).eq("id", it.productId).select().single();
          if (pd) updatedProducts.push(toProduct(pd));
        }
      }
      setState((s) => ({
        ...s,
        orders: s.orders.filter((x) => x.id !== id),
        products: s.products.map((p) => updatedProducts.find((u) => u.id === p.id) ?? p),
      }));
    },
    async addExpense(e) {
      if (!user) return;
      const sid = activeStoreId ?? user.id;
      const { data, error } = await supabase.from("expenses").insert({ user_id: user.id, store_id: sid, ...fromExpense(e) }).select().single();
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
      if (p.checkoutFooterWhatsapp !== undefined) patch.checkout_footer_whatsapp = p.checkoutFooterWhatsapp;
      if (p.checkoutFooterCnpj !== undefined) patch.checkout_footer_cnpj = p.checkoutFooterCnpj;
      if (p.checkoutFooterShowCnpj !== undefined) patch.checkout_footer_show_cnpj = p.checkoutFooterShowCnpj;
      if (p.checkoutFooterShowEmail !== undefined) patch.checkout_footer_show_email = p.checkoutFooterShowEmail;
      if (p.checkoutFooterShowWhatsapp !== undefined) patch.checkout_footer_show_whatsapp = p.checkoutFooterShowWhatsapp;
      if (p.motoboyMessageTemplate !== undefined) patch.motoboy_message_template = p.motoboyMessageTemplate;
      if (p.deliveryMessageTemplate !== undefined) patch.delivery_message_template = p.deliveryMessageTemplate;
      if (p.customerTrackingMessageTemplate !== undefined) patch.customer_tracking_message_template = p.customerTrackingMessageTemplate;
      if (p.motoboyFee !== undefined) patch.motoboy_fee = p.motoboyFee;
      if (p.taxPct !== undefined) patch.tax_pct = p.taxPct;
      if (p.cardFeePct !== undefined) patch.card_fee_pct = p.cardFeePct;
      if (p.platformFeePct !== undefined) patch.platform_fee_pct = p.platformFeePct;
      if (p.adsTaxPct !== undefined) patch.ads_tax_pct = p.adsTaxPct;
      if (p.otherFeesPct !== undefined) patch.other_fees_pct = p.otherFeesPct;
      if (p.cardMachineFees !== undefined) patch.card_machine_fees = p.cardMachineFees as any;
      if (p.cardFeeMode !== undefined) patch.card_fee_mode = p.cardFeeMode;
      if (p.slug !== undefined) patch.slug = p.slug ? p.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || null : null;
      const { data, error } = await supabase.from("settings").update(patch).eq("store_id", activeStoreId ?? user.id).select().single();
      if (error) { toast.error(error.message); return; }
      setState((s) => ({ ...s, settings: toSettings(data) }));
    },
    async resetSeed() {
      if (!user) return;
      const sid = activeStoreId ?? user.id;
      setLoading(true);
      await Promise.all([
        supabase.from("orders").delete().eq("store_id", sid),
        supabase.from("products").delete().eq("store_id", sid),
        supabase.from("expenses").delete().eq("store_id", sid),
        supabase.from("ads").delete().eq("user_id", user.id),
      ]);
      await seedForUser(user.id);
      await loadAll(user.id, activeStoreId);
    },
    async signOut() {
      await supabase.auth.signOut();
      setState(emptyState);
      loadedFor.current = null;
      if (typeof window !== "undefined") window.location.href = "/auth";
    },
  }), [state, loading, user, activeStoreId, loadAll]);

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
  const motoboyFee = Number(state.settings.motoboyFee ?? 0);

  const monthOrders = state.orders.filter(
    (o) => new Date(o.date) >= start && new Date(o.date) < end && o.status !== "cancelado",
  );
  const revenue = monthOrders.reduce((a, o) => a + o.total, 0);
  const cogs = monthOrders.reduce((a, o) => a + o.items.reduce((b, i) => b + i.cost * i.qty, 0), 0);
  const motoboyCost = motoboyFee * monthOrders.length;

  const monthExpenses = state.expenses.filter((e) => dateOnlyToLocalDate(e.date) >= start && dateOnlyToLocalDate(e.date) < end);
  const adsExpenseSpend = monthExpenses.filter((e) => e.category === "ads").reduce((a, e) => a + e.amount, 0);
  const monthAdsEntries = state.ads.filter((a) => {
    const d = dateOnlyToLocalDate(a.date);
    return d >= start && d < end;
  });
  const adsEntrySpend = monthAdsEntries.reduce((a, x) => a + (Number(x.invested) || 0), 0);
  // Quando há dados na aba Facebook Ads para o período, ela vira a fonte oficial
  // do investimento. Isso evita somar despesas antigas de categoria "ads" e
  // mantém Dashboard/Lucro iguais ao Gerenciador de Anúncios por dia.
  const adsSpend = monthAdsEntries.length > 0 ? adsEntrySpend : adsExpenseSpend;
  // "mercadorias" é compra de estoque; o custo já é abatido via COGS quando o produto é vendido.
  // "ads" é somado à parte no card de Meta Ads. Ambos ficam fora do OpEx pra não duplicar.
  const opEx = monthExpenses.filter((e) => e.category !== "ads" && e.category !== "mercadorias").reduce((a, e) => a + e.amount, 0);

  const profit = revenue - cogs - adsSpend - opEx - motoboyCost;

  const paidOrders = state.orders.filter((o) => o.status !== "cancelado" && o.status !== "aguardando");
  const allRevenue = paidOrders.reduce((a, o) => a + o.total, 0);
  const allExpenses = state.expenses.filter((e) => e.category !== "mercadorias").reduce((a, e) => a + e.amount, 0);
  const allAdsManual = state.ads.reduce((a, x) => a + (Number(x.invested) || 0), 0);
  const allCogs = paidOrders.reduce((a, o) => a + o.items.reduce((b, i) => b + i.cost * i.qty, 0), 0);
  const allMotoboy = motoboyFee * paidOrders.length;
  const cash = allRevenue - allExpenses - allAdsManual - allCogs - allMotoboy;


  return { revenue, cogs, adsSpend, opEx, motoboyCost, profit, cash, ordersCount: monthOrders.length };
}
