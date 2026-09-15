import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/entregas-manifest/$storeSlug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const storeSlug = String(params.storeSlug || "").trim().toLowerCase();

        if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(storeSlug)) {
          return new Response(JSON.stringify({ error: "Loja inválida" }), {
            status: 400,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          });
        }

        const encodedSlug = encodeURIComponent(storeSlug);
        const icon192 = "/entregas-icon-192.png?v=10";
        const icon512 = "/entregas-icon-512.png?v=10";
        const manifest = {
          name: "Zappfy Entregas",
          short_name: "Zappfy Entregas",
          description: "Central de Entregas Zappfy",
          id: `/entregas-zappfy/${encodedSlug}/`,
          start_url: `/entregas-zappfy/${encodedSlug}/login?source=pwa`,
          scope: "/entregas-zappfy/",
          display: "standalone",
          display_override: ["window-controls-overlay", "standalone"],
          orientation: "portrait-primary",
          background_color: "#08110d",
          theme_color: "#08110d",
          lang: "pt-BR",
          categories: ["business", "productivity"],
          icons: [
            { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" },
            { src: icon512, sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        };

        return new Response(JSON.stringify(manifest), {
          status: 200,
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      },
    },
  },
});
