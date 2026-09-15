import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { EntregasPwaShell } from "@/components/EntregasPwaShell";
import {
  ENTREGAS_APPLE_ICON_URL,
  ENTREGAS_FAVICON_URL,
  getEntregasManifestUrl,
} from "@/lib/entregas-pwa";

const PRODUCTION_ORIGIN = "https://app.zappfy.shop";

export const Route = createFileRoute("/entregas-zappfy/$storeSlug")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: "Zappfy Entregas — Central de Entregas" },
      { name: "theme-color", content: "#08110d" },
      { name: "apple-mobile-web-app-title", content: "Zappfy Entregas" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
    ],
    links: [
      { rel: "manifest", href: getEntregasManifestUrl(params.storeSlug) },
      { rel: "icon", type: "image/png", sizes: "192x192", href: ENTREGAS_FAVICON_URL },
      { rel: "apple-touch-icon", sizes: "180x180", href: ENTREGAS_APPLE_ICON_URL },
    ],
  }),
  component: EntregasLayout,
});

function EntregasLayout() {
  const { storeSlug } = Route.useParams();

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const isLovablePreview =
      hostname.endsWith(".lovable.app") ||
      hostname.endsWith(".lov") ||
      hostname.includes("id-preview--") ||
      hostname.includes("preview");

    if (!isLovablePreview) return;

    const canonicalUrl = `${PRODUCTION_ORIGIN}/entregas-zappfy/${encodeURIComponent(storeSlug)}${window.location.search}${window.location.hash}`;
    window.location.replace(canonicalUrl);
  }, [storeSlug]);

  return (
    <>
      <EntregasPwaShell storeSlug={storeSlug} />
      <style>{`
        [data-entregas-central] {
          min-height: 100dvh;
          background: #08110d;
        }

        @supports (padding-top: env(safe-area-inset-top)) {
          [data-entregas-central] header {
            padding-top: env(safe-area-inset-top);
          }
        }

        @media (max-width: 1023px) {
          [data-entregas-central] header > div {
            height: 68px !important;
            min-height: 68px;
          }

          [data-entregas-central] header button {
            touch-action: manipulation;
          }
        }
      `}</style>
      <div data-entregas-central>
        <Outlet />
      </div>
    </>
  );
}
