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

export const Route = createFileRoute("/api/public/product-image/$productId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Imagem indisponível", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data, error } = await (supabase as any)
          .from("products_public")
          .select("image_url")
          .eq("id", params.productId)
          .maybeSingle();

        if (error || !data?.image_url) {
          return new Response("Imagem não encontrada", { status: 404 });
        }

        const imageUrl = String(data.image_url);

        if (!imageUrl.startsWith("data:")) {
          return Response.redirect(imageUrl, 302);
        }

        const parsed = parseDataUrl(imageUrl);
        if (!parsed) {
          return new Response("Imagem inválida", { status: 422 });
        }

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
