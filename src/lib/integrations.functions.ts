import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GRAPH_VERSION = "v21.0";

const SaveSchema = z.object({
  access_token: z.string().trim().min(20, "Access Token muito curto"),
  ad_account_id: z
    .string()
    .trim()
    .min(3)
    .transform((v) => (v.startsWith("act_") ? v : `act_${v.replace(/\D/g, "")}`)),
});

export const saveFacebookIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // sanity check: token reaches /me
    const test = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/me?access_token=${encodeURIComponent(data.access_token)}`,
    );
    if (!test.ok) {
      const j = await test.json().catch(() => ({}));
      throw new Error(j?.error?.message || "Token inválido ou sem permissão");
    }
    const { error } = await supabase
      .from("settings")
      .update({
        fb_access_token: data.access_token,
        fb_ad_account_id: data.ad_account_id,
        fb_last_sync_error: null,
      })
      .eq("store_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectFacebookIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("settings")
      .update({
        fb_access_token: null,
        fb_ad_account_id: null,
        fb_last_sync_at: null,
        fb_last_sync_status: null,
        fb_last_sync_error: null,
      })
      .eq("store_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFacebookIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("settings")
      .select("fb_ad_account_id, fb_last_sync_at, fb_last_sync_status, fb_last_sync_error, fb_access_token")
      .eq("store_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      connected: !!data?.fb_access_token && !!data?.fb_ad_account_id,
      ad_account_id: data?.fb_ad_account_id ?? null,
      last_sync_at: data?.fb_last_sync_at ?? null,
      last_sync_status: data?.fb_last_sync_status ?? null,
      last_sync_error: data?.fb_last_sync_error ?? null,
    };
  });

const SyncSchema = z.object({ days: z.number().int().min(1).max(90).default(30) });

export const syncFacebookAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SyncSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: settings, error: setErr } = await supabase
      .from("settings")
      .select("fb_access_token, fb_ad_account_id")
      .eq("store_id", userId)
      .maybeSingle();
    if (setErr) throw new Error(setErr.message);
    if (!settings?.fb_access_token || !settings?.fb_ad_account_id) {
      throw new Error("Conecte sua conta do Facebook Ads antes de sincronizar.");
    }

    const fields = "spend,actions,action_values,date_start";
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${settings.fb_ad_account_id}/insights?fields=${fields}&time_increment=1&date_preset=last_${data.days}d&level=account&access_token=${encodeURIComponent(settings.fb_access_token)}`;

    const res = await fetch(url);
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) {
      const msg = json?.error?.message || `Falha na Marketing API (${res.status})`;
      await supabase
        .from("settings")
        .update({ fb_last_sync_status: "error", fb_last_sync_error: msg, fb_last_sync_at: new Date().toISOString() })
        .eq("store_id", userId);
      throw new Error(msg);
    }

    const rows: Array<{ date_start: string; spend?: string; actions?: any[]; action_values?: any[] }> =
      json?.data ?? [];

    let imported = 0;
    for (const r of rows) {
      const date = r.date_start;
      const invested = Number(r.spend ?? 0) || 0;
      const purchases =
        Number(
          (r.actions ?? []).find((a: any) => ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type))?.value ?? 0,
        ) || 0;
      const revenue =
        Number(
          (r.action_values ?? []).find((a: any) => ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type))?.value ?? 0,
        ) || 0;

      // upsert manual: existe um row do user na mesma data?
      const { data: existing } = await supabase
        .from("ads")
        .select("id")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("ads").update({ invested, purchases, revenue }).eq("id", existing.id);
      } else {
        await supabase.from("ads").insert({ user_id: userId, date, invested, purchases, revenue });
      }
      imported += 1;
    }

    await supabase
      .from("settings")
      .update({
        fb_last_sync_at: new Date().toISOString(),
        fb_last_sync_status: "ok",
        fb_last_sync_error: null,
      })
      .eq("store_id", userId);

    return { ok: true, imported };
  });
