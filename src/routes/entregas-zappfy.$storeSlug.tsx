import { createFileRoute, Outlet } from "@tanstack/react-router";
import { EntregasPwaShell } from "@/components/EntregasPwaShell";
import { ENTREGAS_ICON_VERSION, ENTREGAS_MANIFEST_URL } from "@/lib/entregas-pwa";

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
      { rel: "apple-touch-icon", sizes: "180x180", href: `/apple-touch-icon.png?${ENTREGAS_ICON_VERSION}` },
    ],
  }),
  component: EntregasLayout,
});

function EntregasLayout() {
  const { storeSlug } = Route.useParams();
  return (
    <>
      <EntregasPwaShell storeSlug={storeSlug} />
      <Outlet />
    </>
  );
}
