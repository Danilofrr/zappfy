import { createFileRoute, Outlet } from "@tanstack/react-router";
import { EntregasPwaShell } from "@/components/EntregasPwaShell";

export const Route = createFileRoute("/entregas-zappfy/$storeSlug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entregas Zappfy — Central de Entregas" },
      { name: "theme-color", content: "#22c55e" },
      { name: "apple-mobile-web-app-title", content: "Entregas Zappfy" },
    ],
    links: [
      { rel: "manifest", href: "/manifest-entregas.json" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
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
