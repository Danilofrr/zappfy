import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckoutView } from "@/components/CheckoutView";
import type { Product, Settings, ShippingOption } from "@/lib/store";
import { submitPublicOrder } from "@/lib/api/public-checkout.functions";

export const Route = createFileRoute("/loja/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Checkout" },
      { name: "description", content: "Finalize seu pedido em poucos segundos." },
    ],
  }),
  component: PublicCheckout,
});

const emptySettings: Settings = {
  storeName: "",
  whatsapp: "",
  pixKey: "",
  address: "",
  deliveryFee: 0,
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
  shippingOptions: [],
  checkoutFooterEnabled: true,
  checkoutFooterBrand: "",
  checkoutFooterCopyright: "",
  checkoutFooterEmail: "",
  checkoutFooterPayments: "",
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
  motoboyMessageTemplate: "",
  deliveryMessageTemplate: "",
  slug: "",
};

function toProduct(r: any): Product {
  return {
    id: r.id,
    name: r.name,
    category: r.category ?? "",
    cost: Number(r.cost),
    price: Number(r.price),
    stock: r.stock,
    minStock: r.min_stock,
    description: r.description ?? undefined,
    imageUrl: r.image_url ?? undefined,
  };
}

function toSettings(r: any): Settings {
  return {
    ...emptySettings,
    storeName: r.store_name ?? "Loja",
    whatsapp: r.whatsapp ?? "",
    pixKey: r.pix_key ?? "",
    address: r.address ?? "",
    deliveryFee: Number(r.delivery_fee ?? 0),
    deliveryLabel: r.delivery_label ?? "Entrega",
    monthlyRevenueGoal: Number(r.monthly_revenue_goal ?? 0),
    monthlyProfitGoal: Number(r.monthly_profit_goal ?? 0),
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
    shippingOptions: Array.isArray(r.shipping_options) ? (r.shipping_options as ShippingOption[]) : [],
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
    slug: r.slug ?? "",
  };
}

function PublicCheckout() {
  const { slug } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const normalized = slug.toLowerCase();
      const { data: settingsRow, error: sErr } = await (supabase as any)
        .from("settings_public")
        .select("*")
        .ilike("slug", normalized)
        .maybeSingle();
      if (cancelled) return;
      if (sErr || !settingsRow) {
        setError("Loja não encontrada");
        setLoading(false);
        return;
      }
      const { data: productRows, error: pErr } = await (supabase as any)
        .from("products_public")
        .select("*")
        .eq("user_id", settingsRow.user_id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (pErr) {
        setError("Não foi possível carregar os produtos.");
        setLoading(false);
        return;
      }
      setSettings(toSettings(settingsRow));
      setProducts((productRows ?? []).map(toProduct));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        <div className="text-sm opacity-70">Carregando loja...</div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground px-4">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="text-xl font-bold">Loja não encontrada</h1>
          <p className="text-sm opacity-70">{error ?? "Verifique o link e tente novamente."}</p>
        </div>
      </div>
    );
  }

  return (
    <CheckoutView
      products={products}
      settings={settings}
      onSubmit={async (order) => {
        await submitPublicOrder({ data: { slug: slug.toLowerCase(), order } });
      }}
    />
  );
}
