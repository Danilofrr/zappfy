import { createFileRoute } from "@tanstack/react-router";
import { Route as CheckoutRoute } from "./checkout";

// Alias so /checkout/:slug works in addition to /checkout?loja=slug.
// Delegates rendering to the same Checkout component, which reads ?loja
// from search params. We just redirect-by-mount: read $slug and rewrite.

export const Route = createFileRoute("/checkout/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Finalizar Pedido" },
      { name: "description", content: "Complete seu pedido em poucos segundos." },
    ],
  }),
  beforeLoad: ({ params }) => {
    // Forward to /checkout?loja=<slug> so we keep a single implementation.
    throw (CheckoutRoute as any).options.component
      ? // use router redirect
        (() => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { redirect } = require("@tanstack/react-router");
          return redirect({ to: "/checkout", search: { loja: params.slug } });
        })()
      : new Error("Checkout route unavailable");
  },
  component: () => null,
});
