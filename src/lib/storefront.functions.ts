import { createServerFn } from "@tanstack/react-start";
import type { Product, Settings, OrderItem, PaymentMethod, OrderStatus, ShippingOption } from "@/lib/store";

// ---------- Mappers (mirror src/lib/store.tsx) ----------
function toProduct(r: any): Product {
  return {
    id: r.id, name: r.name, category: r.category ?? "", cost: Number(r.cost), price: Number(r.price),
    stock: r.stock, minStock: r.min_stock, description: r.description ?? undefined,
    imageUrl: r.image_url ?? undefined,
  };
}
function toSettings(r: any): Settings {
  return {
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
    motoboyMessageTemplate: r.motoboy_message_template ?? "",
    deliveryMessageTemplate: r.delivery_message_template ?? "",
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getStorefront = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const d = data as { ownerId?: string };
    if (!d?.ownerId || !UUID_RE.test(d.ownerId)) throw new Error("Loja inválida");
    return { ownerId: d.ownerId };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: products, error: pErr }, { data: settings, error: sErr }] = await Promise.all([
      supabaseAdmin.from("products").select("*").eq("user_id", data.ownerId).order("created_at", { ascending: false }),
      supabaseAdmin.from("settings").select("*").eq("user_id", data.ownerId).maybeSingle(),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (sErr) throw new Error(sErr.message);
    if (!settings) throw new Error("Loja não encontrada");
    return {
      products: (products ?? []).map(toProduct),
      settings: toSettings(settings),
    };
  });

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as {
      ownerId?: string;
      customer?: string;
      phone?: string;
      address?: string;
      district?: string;
      city?: string;
      items?: OrderItem[];
      total?: number;
      payment?: PaymentMethod;
      status?: OrderStatus;
      notes?: string;
      date?: string;
    };
    if (!d?.ownerId || !UUID_RE.test(d.ownerId)) throw new Error("Loja inválida");
    if (!d.customer || d.customer.length > 200) throw new Error("Nome do cliente inválido");
    if (!d.phone || d.phone.length > 40) throw new Error("Telefone inválido");
    if (!Array.isArray(d.items) || d.items.length === 0 || d.items.length > 50) throw new Error("Itens inválidos");
    for (const it of d.items) {
      if (!it.productId || typeof it.qty !== "number" || it.qty < 1 || it.qty > 999) throw new Error("Item inválido");
    }
    if (typeof d.total !== "number" || d.total < 0 || d.total > 1_000_000) throw new Error("Total inválido");
    return {
      ownerId: d.ownerId,
      customer: d.customer.trim(),
      phone: d.phone.trim(),
      address: (d.address ?? "").slice(0, 500),
      district: (d.district ?? "").slice(0, 200),
      city: (d.city ?? "").slice(0, 200),
      items: d.items,
      total: d.total,
      payment: (d.payment ?? "pix") as PaymentMethod,
      status: (d.status ?? "pago") as OrderStatus,
      notes: (d.notes ?? "").slice(0, 1000),
      date: d.date ?? new Date().toISOString(),
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validate that all items belong to this owner and have stock
    const productIds = data.items.map((i) => i.productId);
    const { data: prods, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id,user_id,stock,price,cost,name")
      .in("id", productIds);
    if (pErr) throw new Error(pErr.message);
    const byId = new Map((prods ?? []).map((p: any) => [p.id, p]));
    for (const it of data.items) {
      const p = byId.get(it.productId);
      if (!p || (p as any).user_id !== data.ownerId) throw new Error("Produto inválido");
      if ((p as any).stock < it.qty) throw new Error("Estoque insuficiente");
    }

    const { error: oErr } = await supabaseAdmin.from("orders").insert({
      user_id: data.ownerId,
      customer: data.customer,
      phone: data.phone,
      address: data.address,
      district: data.district,
      city: data.city,
      items: data.items as any,
      total: data.total,
      payment: data.payment,
      status: data.status,
      notes: data.notes || null,
      date: data.date,
    });
    if (oErr) throw new Error(oErr.message);

    // Decrement stock
    if (data.status !== "cancelado") {
      for (const it of data.items) {
        const p = byId.get(it.productId) as any;
        const newStock = Math.max(0, (p.stock as number) - it.qty);
        await supabaseAdmin.from("products").update({ stock: newStock }).eq("id", it.productId);
      }
    }
    return { ok: true };
  });
