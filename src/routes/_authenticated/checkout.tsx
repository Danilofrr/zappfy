import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { CheckoutView } from "@/components/CheckoutView";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [
      { title: "Pré-visualização do Checkout" },
      { name: "description", content: "Pré-visualização do checkout da sua loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPreview,
});

function CheckoutPreview() {
  const { state, addOrder } = useStore();
  return (
    <CheckoutView
      products={state.products}
      settings={state.settings}
      onSubmit={async (order) => {
        await addOrder(order);
      }}
    />
  );
}
