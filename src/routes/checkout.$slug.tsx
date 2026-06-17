import { createFileRoute, redirect } from "@tanstack/react-router";

// /checkout/:slug — friendly URL for sharing. Forwards to /checkout?loja=:slug
// so the existing public Checkout component handles the rendering.
export const Route = createFileRoute("/checkout/$slug")({
  ssr: false,
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/checkout", search: { loja: params.slug } });
  },
  component: () => null,
});
