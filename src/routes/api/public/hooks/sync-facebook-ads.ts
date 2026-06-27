import { createFileRoute } from "@tanstack/react-router";

const GRAPH_VERSION = "v21.0";
const PURCHASE_TYPES = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_web_purchase",
  "onsite_web_app_purchase",
  "web_in_store_purchase",
];

const sumByTypes = (arr: any[] | undefined) =>
  (arr ?? [])
    .filter((a: any) => PURCHASE_TYPES.includes(a.action_type))
    .reduce((acc: number, a: any) => acc + (Number(a.value) || 0), 0);

async function syncStore(
  supabaseAdmin: any,
  store: { store_id: string; fb_access_token: string; fb_ad_account_id: string; fb_last_sync_at: string | null },
) {
  // Primeiro acesso (sem histórico): puxa o mês inteiro (35 dias).
  // Depois: apenas o dia de hoje, todos os dias.
  const isFirstSync = !store.fb_last_sync_at;
  const days = isFirstSync ? 35 : 1;
  const tzNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const since = new Date(tzNow.getTime() - (days - 1) * 86400000);
  // IMPORTANTE: a Meta rejeita `until` no futuro. Usar HOJE (fuso da conta).
  const until = tzNow;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = fmt(tzNow);
  const fields = "spend,actions,action_values,date_start";
  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${store.fb_ad_account_id}/insights?fields=${fields}&level=account&access_token=${encodeURIComponent(store.fb_access_token)}`;

  let rows: Array<{ date_start: string; spend?: string; actions?: any[]; action_values?: any[] }> = [];

  if (isFirstSync) {
    const timeRange = encodeURIComponent(JSON.stringify({ since: fmt(since), until: fmt(until) }));
    const res = await fetch(`${base}&time_increment=1&time_range=${timeRange}`);
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) {
      const msg = json?.error?.message || `Falha na Marketing API (${res.status})`;
      await supabaseAdmin
        .from("settings")
        .update({ fb_last_sync_status: "error", fb_last_sync_error: msg, fb_last_sync_at: new Date().toISOString() })
        .eq("store_id", store.store_id);
      return { store_id: store.store_id, ok: false, error: msg };
    }
    rows = json?.data ?? [];
  }

  // Sempre busca o dia atual com date_preset=today (fuso da conta), garante linha de hoje.
  try {
    const todayRes = await fetch(`${base}&date_preset=today`);
    const todayJson: any = await todayRes.json().catch(() => ({}));
    const todayRow = (todayJson?.data ?? [])[0];
    if (todayRow) {
      const normalized = { ...todayRow, date_start: todayRow.date_start || todayStr };
      const idx = rows.findIndex((r) => r.date_start === normalized.date_start);
      if (idx >= 0) rows[idx] = normalized;
      else rows.push(normalized);
    } else if (!rows.find((r) => r.date_start === todayStr)) {
      rows.push({ date_start: todayStr, spend: "0" });
    }
  } catch {
    if (!rows.find((r) => r.date_start === todayStr)) {
      rows.push({ date_start: todayStr, spend: "0" });
    }
  }

  let imported = 0;
  for (const r of rows) {
    const date = r.date_start;
    const invested = Number(r.spend ?? 0) || 0;
    let purchases = sumByTypes(r.actions);
    let revenue = sumByTypes(r.action_values);

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
