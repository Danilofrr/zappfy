import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Falha ao verificar permissões");
  if (!data) throw new Error("Acesso negado");
}

// ===== Acesso do usuário (role + status) =====
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context as any;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, expires_at, plan_id, plans(name)")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      userId,
      email: (claims?.email as string) ?? null,
      isAdmin,
      subscription: sub
        ? {
            status: sub.status as string,
            expiresAt: sub.expires_at as string | null,
            planName: (sub as any).plans?.name ?? null,
          }
        : null,
    };
  });

// ===== Dashboard admin =====
export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("status, expires_at, plan_id, started_at, plans(price_monthly)");
    const list = subs ?? [];
    const total = list.length;
    const ativos = list.filter((s: any) => s.status === "ativo").length;
    const teste = list.filter((s: any) => s.status === "teste").length;
    const vencidos = list.filter((s: any) => s.status === "vencido").length;
    const bloqueados = list.filter((s: any) => s.status === "bloqueado").length;
    const pendentes = list.filter((s: any) => s.status === "pendente").length;
    const mrr = list
      .filter((s: any) => s.status === "ativo")
      .reduce((acc: number, s: any) => acc + Number(s.plans?.price_monthly ?? 0), 0);
    const arr = mrr * 12;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const novosMes = list.filter((s: any) => new Date(s.started_at) >= startOfMonth).length;
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const proximosVencer = list.filter(
      (s: any) => s.expires_at && new Date(s.expires_at) <= in7 && new Date(s.expires_at) >= new Date(),
    ).length;
    return { total, ativos, teste, vencidos, bloqueados, pendentes, mrr, arr, novosMes, proximosVencer };
  });

// ===== Clientes =====
export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { data, error } = await supabase.rpc("admin_list_clients");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name ?? "",
      storeName: r.store_name ?? "",
      whatsapp: r.whatsapp ?? "",
      createdAt: r.created_at,
      lastSignInAt: r.last_sign_in_at,
      roles: r.roles ?? [],
      subscription: r.sub_status
        ? {
            status: r.sub_status,
            expiresAt: r.sub_expires_at,
            startedAt: r.sub_started_at,
            planId: r.plan_id,
            planName: r.plan_name ?? null,
            priceMonthly: Number(r.price_monthly ?? 0),
          }
        : null,
    }));
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; fullName: string; storeName: string; whatsapp: string; planId?: string; trialDays?: number }) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().min(1),
        storeName: z.string().min(1),
        whatsapp: z.string().default(""),
        planId: z.string().uuid().optional(),
        trialDays: z.number().int().min(0).max(365).default(7),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, store_name: data.storeName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
    const newUserId = created.user.id;
    await supabaseAdmin.from("settings").upsert({ user_id: newUserId, store_name: data.storeName, whatsapp: data.whatsapp });
    await supabaseAdmin.from("user_roles").upsert({ user_id: newUserId, role: "cliente" });
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + (data.trialDays ?? 7));
    await supabaseAdmin.from("subscriptions").upsert({
      user_id: newUserId,
      plan_id: data.planId ?? null,
      status: "teste",
      trial_ends_at: trialEnd.toISOString(),
      expires_at: trialEnd.toISOString(),
    });
    // Gerar token de ativação
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenExpire = new Date();
    tokenExpire.setDate(tokenExpire.getDate() + 7);
    await supabaseAdmin.from("activation_tokens").insert({
      user_id: newUserId,
      token,
      expires_at: tokenExpire.toISOString(),
    });
    return { id: newUserId, activationToken: token };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; fullName?: string; storeName?: string; whatsapp?: string }) =>
    z.object({ userId: z.string().uuid(), fullName: z.string().optional(), storeName: z.string().optional(), whatsapp: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.fullName !== undefined) await supabaseAdmin.from("profiles").update({ full_name: data.fullName }).eq("id", data.userId);
    if (data.storeName !== undefined || data.whatsapp !== undefined) {
      const patch: any = {};
      if (data.storeName !== undefined) patch.store_name = data.storeName;
      if (data.whatsapp !== undefined) patch.whatsapp = data.whatsapp;
      await supabaseAdmin.from("settings").update(patch).eq("user_id", data.userId);
    }
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    if (data.userId === userId) throw new Error("Você não pode excluir a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: string }) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["ativo", "teste", "pendente", "vencido", "bloqueado"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscriptions").update({ status: data.status }).eq("user_id", data.userId);
    return { ok: true };
  });

export const renewSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; days: number }) =>
    z.object({ userId: z.string().uuid(), days: z.number().int().min(1).max(3650) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("subscriptions").select("expires_at").eq("user_id", data.userId).maybeSingle();
    const base = cur?.expires_at && new Date(cur.expires_at) > new Date() ? new Date(cur.expires_at) : new Date();
    base.setDate(base.getDate() + data.days);
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "ativo", expires_at: base.toISOString(), last_payment_at: new Date().toISOString() })
      .eq("user_id", data.userId);
    return { ok: true };
  });

export const changeClientPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; planId: string }) =>
    z.object({ userId: z.string().uuid(), planId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscriptions").update({ plan_id: data.planId }).eq("user_id", data.userId);
    return { ok: true };
  });

export const addTrialDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; days: number }) =>
    z.object({ userId: z.string().uuid(), days: z.number().int().min(1).max(365) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("subscriptions").select("expires_at, trial_ends_at").eq("user_id", data.userId).maybeSingle();
    const base = cur?.expires_at && new Date(cur.expires_at) > new Date() ? new Date(cur.expires_at) : new Date();
    base.setDate(base.getDate() + data.days);
    await supabaseAdmin
      .from("subscriptions")
      .update({ expires_at: base.toISOString(), trial_ends_at: base.toISOString(), status: "teste" })
      .eq("user_id", data.userId);
    return { ok: true };
  });

export const generateActivationToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const exp = new Date();
    exp.setDate(exp.getDate() + 7);
    await supabaseAdmin.from("activation_tokens").insert({ user_id: data.userId, token, expires_at: exp.toISOString() });
    return { token };
  });

// ===== Senha do cliente =====
export const setClientPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; password: string }) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(6).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendClientPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; redirectTo?: string }) =>
    z.object({ userId: z.string().uuid(), redirectTo: z.string().url().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: ue } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (ue || !u?.user?.email) throw new Error(ue?.message ?? "Cliente sem e-mail");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: u.user.email,
      options: { redirectTo: data.redirectTo },
    });
    if (error) throw new Error(error.message);
    return { email: u.user.email, link: link?.properties?.action_link ?? null };
  });

// ===== Planos =====
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data } = await supabase.from("plans").select("*").order("sort_order");
    return data ?? [];
  });

export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        description: z.string().default(""),
        price_monthly: z.number().min(0),
        price_yearly: z.number().min(0),
        features: z.array(z.string()).default([]),
        is_active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      await supabaseAdmin.from("plans").update(data).eq("id", data.id);
    } else {
      await supabaseAdmin.from("plans").insert(data);
    }
    return { ok: true };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("plans").delete().eq("id", data.id);
    return { ok: true };
  });

// ===== Pagamentos =====
export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("subscription_payments")
      .select("*, subscriptions(plan_id, plans(name))")
      .order("created_at", { ascending: false })
      .limit(500);
    const userIds = Array.from(new Set((data ?? []).map((p: any) => p.user_id)));
    const { data: users } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds);
    const m = new Map((users ?? []).map((u: any) => [u.id, u.full_name]));
    return (data ?? []).map((p: any) => ({ ...p, fullName: m.get(p.user_id) ?? "" }));
  });

export const registerPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z
      .object({
        userId: z.string().uuid(),
        amount: z.number().min(0),
        method: z.string().default("manual"),
        status: z.enum(["pago", "pendente", "vencido", "cancelado"]).default("pago"),
        notes: z.string().default(""),
        renewDays: z.number().int().min(0).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin.from("subscriptions").select("id, expires_at").eq("user_id", data.userId).maybeSingle();
    if (!sub) throw new Error("Cliente sem assinatura");
    await supabaseAdmin.from("subscription_payments").insert({
      subscription_id: sub.id,
      user_id: data.userId,
      amount: data.amount,
      method: data.method,
      status: data.status,
      paid_at: data.status === "pago" ? new Date().toISOString() : null,
      notes: data.notes,
    });
    if (data.status === "pago" && data.renewDays > 0) {
      const base = sub.expires_at && new Date(sub.expires_at) > new Date() ? new Date(sub.expires_at) : new Date();
      base.setDate(base.getDate() + data.renewDays);
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "ativo", expires_at: base.toISOString(), last_payment_at: new Date().toISOString() })
        .eq("id", sub.id);
    }
    return { ok: true };
  });

// ===== Cupons =====
export const listCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const saveCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().min(1),
        discount_type: z.enum(["percent", "fixed"]).default("percent"),
        discount_value: z.number().min(0),
        max_uses: z.number().int().min(0).optional().nullable(),
        valid_until: z.string().optional().nullable(),
        is_active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) await supabaseAdmin.from("coupons").update(data).eq("id", data.id);
    else await supabaseAdmin.from("coupons").insert(data);
    return { ok: true };
  });

export const deleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("coupons").delete().eq("id", data.id);
    return { ok: true };
  });

// ===== Logs =====
export const listAccessLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { data } = await supabase.from("access_logs").select("*").order("created_at", { ascending: false }).limit(200);
    return data ?? [];
  });

// ===== Minha assinatura (cliente) =====
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*, plans(name, description, price_monthly)")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: payments } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { subscription: sub, payments: payments ?? [] };
  });
