import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Falha ao verificar permissões");
  if (!data) throw new Error("Acesso negado");
}

// Public: validate invite code (no auth)
export const getTrialInviteInfo = createServerFn({ method: "GET" })
  .inputValidator((d: { code: string }) => z.object({ code: z.string().min(1).max(32) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabasePublic = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: info, error } = await supabasePublic.rpc("get_trial_invite_info", { _code: data.code });
    if (error) throw new Error(error.message);
    return info as { valid: boolean; reason?: string; code?: string; label?: string; trial_days?: number };
  });

// Authenticated: redeem invite for current user
export const redeemTrialInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => z.object({ code: z.string().min(1).max(32) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: res, error } = await supabase.rpc("redeem_trial_invite", { _code: data.code });
    if (error) throw new Error(error.message);
    return res;
  });

// Admin: stats
export const getTrialStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { data, error } = await supabase.rpc("admin_trial_stats");
    if (error) throw new Error(error.message);
    return data as {
      active_trials: number;
      expired_trials: number;
      conversions: number;
      signups: number;
      conversion_rate: number;
    };
  });

// Admin: list invites
export const listTrialInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("trial_invites")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Admin: create invite
export const createTrialInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { label?: string; trialDays?: number; expiresInDays?: number }) =>
    z
      .object({
        label: z.string().max(80).default(""),
        trialDays: z.number().int().min(1).max(90).default(7),
        expiresInDays: z.number().int().min(0).max(365).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let code = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = randomCode(6);
      const { data: exists } = await supabaseAdmin
        .from("trial_invites")
        .select("id")
        .eq("code", candidate)
        .maybeSingle();
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Não foi possível gerar um código único");

    const expires_at =
      data.expiresInDays > 0
        ? new Date(Date.now() + data.expiresInDays * 86400000).toISOString()
        : null;

    const { data: created, error } = await supabaseAdmin
      .from("trial_invites")
      .insert({
        code,
        created_by: userId,
        label: data.label,
        trial_days: data.trialDays,
        status: "active",
        expires_at,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

// Admin: revoke invite
export const revokeTrialInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trial_invites")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: reactivate invite
export const reactivateTrialInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trial_invites")
      .update({ status: "active", revoked_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: update invite (label, trial_days, expires_at)
export const updateTrialInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id: string; label?: string; trialDays?: number; expiresInDays?: number | null }) =>
      z
        .object({
          id: z.string().uuid(),
          label: z.string().max(80).optional(),
          trialDays: z.number().int().min(1).max(90).optional(),
          expiresInDays: z.number().int().min(0).max(365).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, any> = {};
    if (data.label !== undefined) patch.label = data.label;
    if (data.trialDays !== undefined) patch.trial_days = data.trialDays;
    if (data.expiresInDays !== undefined) {
      patch.expires_at =
        data.expiresInDays && data.expiresInDays > 0
          ? new Date(Date.now() + data.expiresInDays * 86400000).toISOString()
          : null;
    }
    const { data: updated, error } = await supabaseAdmin
      .from("trial_invites")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

// Admin: delete invite permanently
export const deleteTrialInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trial_invites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
