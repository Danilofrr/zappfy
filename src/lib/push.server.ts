// Server-only push helpers. Never import from client code.
import webpush from "web-push";

const VAPID_PUBLIC_KEY =
  "BEMaUchwsmaAILommuH7nAnp6zu8PO0un7R7xRAuKvvjLiXCGQ77YW99WoC8npUAbJ3sOZe1x6nuMj8J_Ne8F8o";
const VAPID_PRIVATE_KEY = "MiamKcFmqrxF5ds8tpYEsc3Vr5c_o1hp1WG5W98r8e4";
const VAPID_SUBJECT = "mailto:contato@zappfy.app";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

export type PushPayload = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

/**
 * Send a web-push notification to every active subscription of a user.
 * Removes subscriptions that respond with 404/410 (Gone).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; removed: number }> {
  ensureConfigured();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: subs, error } = await supabaseAdmin
    .from("notification_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    console.error("[push] failed to load subscriptions", error);
    return { sent: 0, removed: 0 };
  }
  if (!subs || subs.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          { TTL: 60 },
        );
        sent++;
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) stale.push(s.id);
        else console.error("[push] send failed", { status, body: err?.body });
      }
    }),
  );

  if (stale.length) {
    await supabaseAdmin.from("notification_subscriptions").delete().in("id", stale);
  }

  return { sent, removed: stale.length };
}
