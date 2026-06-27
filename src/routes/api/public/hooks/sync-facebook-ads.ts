import { createFileRoute } from "@tanstack/react-router";

const GRAPH_VERSION = "v21.0";
const META_INSIGHTS_FIELDS = "spend,impressions,clicks,date_start,date_stop";

function normalizeAdAccountId(value: string) {
  const raw = String(value ?? "").trim().replace(/^['"]|['"]$/g, "");
  const withoutPrefix = raw.replace(/^act_/i, "");
  const digits = withoutPrefix.replace(/\D/g, "");
  return digits ? `act_${digits}` : "";
}

function sanitizeAccessToken(value: string | null | undefined) {
  let token = String(value ?? "").trim();
  token = token.replace(/^['"]|['"]$/g, "").trim();
  token = token.replace(/^Bearer\s+/i, "").trim();
  token = token.replace(/[\r\n\t ]+/g, "");
  token = token.replace(/^['"]|['"]$/g, "").trim();
  return token;
}

function safeMetaLog(label: string, params: { url: string; adAccountId?: string; token: string; status?: number }) {
  try {
    const parsed = new URL(params.url);
    const token = sanitizeAccessToken(params.token);
    console.log(label, {
      endpoint: parsed.pathname,
      fields: parsed.searchParams.get("fields") ?? null,
      datePreset: parsed.searchParams.get("date_preset") ?? null,
      adAccountId: params.adAccountId ?? null,
      tokenExists: token.length > 0,
      tokenLength: token.length,
      tokenLast4: token ? token.slice(-4) : null,
      metaStatus: params.status ?? null,
    });
  } catch {
    console.log(label, { endpoint: "unknown", adAccountId: params.adAccountId ?? null, metaStatus: params.status ?? null });
  }
}

async function fbFetch(url: string, token: string) {
  const cleanToken = sanitizeAccessToken(token);
  const body = new URLSearchParams();
  body.set("access_token", cleanToken);
  body.set("method", "GET");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const json: any = await res.json().catch(() => ({}));
  const adAccountId = new URL(url).pathname.split("/").find((part) => part.startsWith("act_"));
  safeMetaLog("meta_ads_cron_graph_get", { url, adAccountId, token: cleanToken, status: res.status });
  return { res, json };
}

function fbErrorMessage(json: any, status: number) {
  const e = json?.error;
  if (!e) return `Falha na Marketing API (${status})`;
  const rawMessage = String(e.message ?? "");
  if (Number(e.code) === 100 && rawMessage.toLowerCase().includes("account_name")) {
    return "Erro interno na integração: o campo account_name é inválido. A integração foi ajustada para usar o campo name.";
  }
  if (Number(e.code) === 190) {
    return "Token inválido, expirado ou copiado incorretamente. Gere um novo token de usuário do sistema com permissão ads_read.";
  }
  if (String(e.message ?? "").toLowerCase().includes("api access blocked")) {
    return "Acesso à API da Meta bloqueado para este token/app. Gere um novo token de Usuário do Sistema com ads_read, confirme que a conta de anúncios foi atribuída a esse usuário e que o app tem acesso à Marketing API.";
  }
  const parts: string[] = [];
  if (e.message) parts.push(String(e.message));
  if (e.code) parts.push(`code ${e.code}`);
  if (e.error_subcode) parts.push(`subcode ${e.error_subcode}`);
  if (e.error_user_msg) parts.push(String(e.error_user_msg));
  return parts.join(" — ");
}

async function syncStore(
  supabaseAdmin: any,
  store: { store_id: string; fb_access_token: string; fb_ad_account_id: string; fb_last_sync_at: string | null },
) {
  // Primeiro acesso (sem histórico): puxa o mês atual.
  // Depois: apenas o dia de hoje, todos os dias.
  const isFirstSync = !store.fb_last_sync_at;
  const tzNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = fmt(tzNow);
  const fields = META_INSIGHTS_FIELDS;
  const adAccountId = normalizeAdAccountId(store.fb_ad_account_id);
  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${adAccountId}/insights?fields=${fields}`;

  let rows: Array<{ date_start?: string; date_stop?: string; spend?: string; impressions?: string; clicks?: string }> = [];

  if (isFirstSync) {
    const { res, json } = await fbFetch(`${base}&date_preset=this_month`, store.fb_access_token);
    if (!res.ok || json?.error) {
      const msg = fbErrorMessage(json, res.status);
      await supabaseAdmin
        .from("settings")
        .update({ fb_last_sync_status: "error", fb_last_sync_error: msg, fb_last_sync_at: new Date().toISOString() })
        .eq("store_id", store.store_id);
      return { store_id: store.store_id, ok: false, error: msg };
    }
    rows = json?.data ?? [];
  }

  // Sempre busca o dia atual com date_preset=today (fuso da conta), garante linha de hoje.
  const { res: todayRes, json: todayJson } = await fbFetch(`${base}&date_preset=today`, store.fb_access_token);
  if (!todayRes.ok || todayJson?.error) {
    const msg = fbErrorMessage(todayJson, todayRes.status);
    await supabaseAdmin
      .from("settings")
      .update({ fb_last_sync_status: "error", fb_last_sync_error: msg, fb_last_sync_at: new Date().toISOString() })
      .eq("store_id", store.store_id);
    return { store_id: store.store_id, ok: false, error: msg };
  }
  const todayRow = (todayJson?.data ?? [])[0];
  if (todayRow) {
    const normalized = { ...todayRow, date_start: todayRow.date_start || todayStr };
    const idx = rows.findIndex((r) => r.date_start === normalized.date_start);
    if (idx >= 0) rows[idx] = normalized;
    else rows.push(normalized);
  } else if (!rows.find((r) => r.date_start === todayStr)) {
    rows.push({ date_start: todayStr, spend: "0" });
  }

  let imported = 0;
  for (const r of rows) {
    const date = r.date_start || r.date_stop || todayStr;
    const invested = Number(r.spend ?? 0) || 0;
    let purchases = 0;
    let revenue = 0;

    if (revenue <= 0 || purchases <= 0) {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59.999`;
      const { data: dayOrders } = await supabaseAdmin
        .from("orders")
        .select("total,status,date,created_at")
        .eq("user_id", store.store_id)
        .or(`and(date.gte.${dayStart},date.lte.${dayEnd}),and(date.is.null,created_at.gte.${dayStart},created_at.lte.${dayEnd})`);
      const valid = (dayOrders ?? []).filter(
        (o: any) => !["cancelado", "cancelada"].includes(String(o.status ?? "").toLowerCase()),
      );
      if (revenue <= 0) revenue = valid.reduce((acc: number, o: any) => acc + (Number(o.total) || 0), 0);
      if (purchases <= 0) purchases = valid.length;
    }

    const { data: existing } = await supabaseAdmin
      .from("ads")
      .select("id")
      .eq("user_id", store.store_id)
      .eq("date", date)
      .maybeSingle();
    if (existing?.id) {
      await supabaseAdmin.from("ads").update({ invested, purchases, revenue }).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("ads").insert({ user_id: store.store_id, date, invested, purchases, revenue });
    }
    imported += 1;
  }
  await supabaseAdmin
    .from("settings")
    .update({
      fb_last_sync_at: new Date().toISOString(),
      fb_last_sync_status: "ok",
      fb_last_sync_error: null,
    })
    .eq("store_id", store.store_id);
  return { store_id: store.store_id, ok: true, imported, mode: isFirstSync ? "backfill" : "today" };
}


export const Route = createFileRoute("/api/public/hooks/sync-facebook-ads")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: stores, error } = await supabaseAdmin
          .from("settings")
          .select("store_id, fb_access_token, fb_ad_account_id, fb_last_sync_at")
          .not("fb_access_token", "is", null)
          .not("fb_ad_account_id", "is", null);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }
        const results: any[] = [];
        for (const s of stores ?? []) {
          try {
            results.push(await syncStore(supabaseAdmin, s as any));
          } catch (e: any) {
            results.push({ store_id: (s as any).store_id, ok: false, error: e?.message });
          }
        }
        return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => new Response("ok"),
    },
  },
});
