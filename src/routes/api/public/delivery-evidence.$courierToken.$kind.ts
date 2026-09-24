import { Buffer } from "node:buffer";
import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient } from "@/lib/admin-client.server";

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

export const Route = createFileRoute("/api/public/delivery-evidence/$courierToken/$kind")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const admin = getAdminClient();
        if (!admin) return new Response("Arquivo indisponível", { status: 500 });

        const kind = params.kind === "proof" ? "proof_url" : params.kind === "signature" ? "signature_url" : null;
        if (!kind) return new Response("Arquivo inválido", { status: 404 });

        const { data, error } = await (admin as any)
          .from("delivery_tracking")
          .select("proof_url,signature_url")
          .eq("courier_token", params.courierToken)
          .maybeSingle();

        const value = data?.[kind];
        if (error || !value) return new Response("Arquivo não encontrado", { status: 404 });

        const fileValue = String(value);
        if (!fileValue.startsWith("data:")) {
          return Response.redirect(fileValue, 302);
        }

        const parsed = parseDataUrl(fileValue);
        if (!parsed) return new Response("Arquivo inválido", { status: 422 });

        return new Response(parsed.bytes, {
          status: 200,
          headers: {
            "content-type": parsed.contentType,
            "cache-control": "private, max-age=60, stale-while-revalidate=300",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
