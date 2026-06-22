import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/entregas-zappfy/$storeSlug")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entregas Zappfy — Central de Entregas" }] }),
  component: () => <Outlet />,
});
