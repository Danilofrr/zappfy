// Server-only admin client (service role) for endpoints without a user session,
// e.g. the public submit-order webhook that sends a push notification to the store owner.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

let _client: SupabaseClient<Database> | undefined;

export function getAdminClient(): SupabaseClient<Database> | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SB_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[admin] missing env", { hasUrl: !!url, hasKey: !!key });
    return null;
  }
  if (!_client) {
    _client = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}
