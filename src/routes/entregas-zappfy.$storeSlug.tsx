import { createFileRoute, Outlet } from "@tanstack/react-router";
import { EntregasPwaShell } from "@/components/EntregasPwaShell";

export const Route = createFileRoute("/entregas-zappfy/$storeSlug")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entregas Zappfy — Central de Entregas" }] }),
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
