import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { EntregasPwaShell } from "@/components/EntregasPwaShell";
import { ENTREGAS_APPLE_ICON_URL, ENTREGAS_MANIFEST_URL } from "@/lib/entregas-pwa";

const PRODUCTION_ORIGIN = "https://app.zappfy.shop";

export const Route = createFileRoute("/entregas-zappfy/$storeSlug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entregas Zappfy — Central de Entregas" },
      { name: "theme-color", content: "#22c55e" },
      { name: "apple-mobile-web-app-title", content: "Entregas Zappfy" },
    ],
    links: [
      { rel: "manifest", href: ENTREGAS_MANIFEST_URL },
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
      <Outlet />
    </>
  );
}
