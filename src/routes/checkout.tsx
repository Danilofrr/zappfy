import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { CheckoutView } from "@/components/CheckoutView";
import type { Product, Settings } from "@/lib/store";

const searchSchema = z.object({
  loja: z.string().optional(),
});

export const Route = createFileRoute("/checkout")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Finalizar Pedido" },
      { name: "description", content: "Complete seu pedido em poucos segundos." },
    ],
  }),
  component: Checkout,
});

// Reuse the same mappers as /loja/$slug by inlining (keep checkout self-contained).
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
    storeName: r.store_name ?? "Loja",
    whatsapp: r.whatsapp ?? "",
    pixKey: r.pix_key ?? "",
    address: r.address ?? "",
    deliveryFee: Number(r.delivery_fee ?? 0),
    motoboyFee: Number(r.motoboy_fee ?? 0),
    taxPct: Number(r.tax_pct ?? 0),
    cardFeePct: Number(r.card_fee_pct ?? 0),
    platformFeePct: Number(r.platform_fee_pct ?? 0),
    adsTaxPct: Number(r.ads_tax_pct ?? 0),
    otherFeesPct: Number(r.other_fees_pct ?? 0),
    deliveryLabel: r.delivery_label ?? "Entrega",
    monthlyRevenueGoal: Number(r.monthly_revenue_goal ?? 0),
    monthlyProfitGoal: Number(r.monthly_profit_goal ?? 0),
    checkoutLogoUrl: r.checkout_logo_url ?? "",
    checkoutBgColor: r.checkout_bg_color ?? "#0a0a0a",
    checkoutTheme: (r.checkout_theme as "dark" | "light") ?? "dark",
    checkoutTextColor: r.checkout_text_color ?? "#f8fafc",
    checkoutCardColor: r.checkout_card_color ?? "#111111",
    checkoutNeonColor: r.checkout_neon_color ?? "#a855f7",
    checkoutButtonLabel: r.checkout_button_label ?? "Finalizar Pedido",
    checkoutButtonColor: r.checkout_button_color ?? "#a855f7",
    checkoutHeaderBgColor: r.checkout_header_bg_color ?? "#0a0a0a",
    checkoutSecureLabel: r.checkout_secure_label ?? "Checkout seguro",
    checkoutStep1ButtonLabel: r.checkout_step1_button_label ?? "Continuar",
    checkoutStep2ButtonLabel: r.checkout_step2_button_label ?? "Calcular frete",
    checkoutStep3ButtonLabel: r.checkout_step3_button_label ?? "Ir para pagamento",
    checkoutStepButtonColor: r.checkout_step_button_color ?? "#a855f7",
    checkoutStepButtonTextColor: r.checkout_step_button_text_color ?? "#ffffff",
    shippingOptions: Array.isArray(r.shipping_options) ? (r.shipping_options as Settings["shippingOptions"]) : [],
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
    motoboyMessageTemplate: r.motoboy_message_template ?? "",
    deliveryMessageTemplate: r.delivery_message_template ?? "",
    customerTrackingMessageTemplate: r.customer_tracking_message_template ?? "",
    slug: r.slug ?? "",
  };
}

function Checkout() {
  const { loja } = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      let settingsRow: any = null;
      if (loja) {
        const { data, error: sErr } = await (supabase as any)
          .from("settings_public")
          .select("*")
          .ilike("slug", loja.toLowerCase())
          .maybeSingle();
        if (sErr) {
          if (!cancelled) { setError("Não foi possível carregar a loja."); setLoading(false); }
          return;
        }
        settingsRow = data;
      } else {
        // No slug provided: load the first store with a public slug (single-tenant convenience).
        const { data, error: sErr } = await (supabase as any)
          .from("settings_public")
          .select("*")
          .limit(1)
          .maybeSingle();
        if (sErr) {
          if (!cancelled) { setError("Não foi possível carregar a loja."); setLoading(false); }
          return;
        }
        settingsRow = data;
      }

      if (cancelled) return;
      if (!settingsRow) {
        setError("Nenhuma loja pública configurada ainda.");
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
  }, [loja]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        <div className="text-sm opacity-70">Carregando checkout...</div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground px-4">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-bold">Checkout indisponível</h1>
          <p className="text-sm opacity-70">{error ?? "Verifique o link e tente novamente."}</p>
          <Link to="/auth" className="text-sm underline opacity-80">Acessar painel</Link>
        </div>
      </div>
    );
  }

  return (
    <CheckoutView
      products={products}
      settings={settings}
      onSubmit={async (order) => {
        const res = await fetch("/api/public/submit-order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug: settings.slug || (loja ?? ""), order }),
        });
        if (!res.ok) {
          let detail: any = null;
          try { detail = await res.json(); } catch { detail = await res.text().catch(() => null); }
          console.error("[checkout] submit failed", res.status, detail);
          throw new Error(detail?.error || `Erro ${res.status} ao enviar pedido`);
        }
      }}
    />
  );
}

