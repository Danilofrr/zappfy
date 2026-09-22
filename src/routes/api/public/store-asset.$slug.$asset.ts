import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function parseDataUrl(value: string) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
  if (!match) return null;

  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const body = match[3] || "";

  try {
    return {
      contentType,
      bytes: isBase64
        ? Buffer.from(body, "base64")
        : Buffer.from(decodeURIComponent(body), "utf8"),
    };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/store-asset/$slug/$asset")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Arquivo indisponível", { status: 500 });
        }

        const field =
          params.asset === "logo"
            ? "checkout_logo_url"
            : params.asset === "cards"
              ? "checkout_footer_cards_image_url"
              : null;

        if (!field) return new Response("Arquivo inválido", { status: 404 });

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data, error } = await (supabase as any)
          .from("settings_public")
          .select(`${field},slug`)
          .ilike("slug", params.slug.toLowerCase())
          .maybeSingle();

        const assetUrl = data?.[field];
        if (error || !assetUrl) {
          return new Response("Arquivo não encontrado", { status: 404 });
        }

        const value = String(assetUrl);
        if (!value.startsWith("data:")) {
          return Response.redirect(value, 302);
        }

        const parsed = parseDataUrl(value);
        if (!parsed) return new Response("Arquivo inválido", { status: 422 });

        return new Response(parsed.bytes, {
          status: 200,
          headers: {
            "content-type": parsed.contentType,
            "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
