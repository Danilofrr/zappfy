import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { CheckoutView } from "@/components/CheckoutView";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar Pedido" },
      { name: "description", content: "Complete seu pedido em poucos segundos." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { state, addOrder } = useStore();
  return (
    <CheckoutView
      products={state.products}
      settings={state.settings}
      onSubmit={(o) => addOrder(o)}
      showBackToPanel
    />
  );
}
