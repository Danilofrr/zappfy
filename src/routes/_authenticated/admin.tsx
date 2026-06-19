import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    const ctx = context as any;
    if (!ctx.isAdmin) throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
