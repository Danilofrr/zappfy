import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckoutView } from "@/components/CheckoutView";
import { getStorefront, placeOrder } from "@/lib/storefront.functions";

export const Route = createFileRoute("/loja/$ownerId")({
  head: () => ({
    meta: [
      { title: "Finalizar Pedido" },
      { name: "description", content: "Complete seu pedido em poucos segundos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: PublicCheckout,
});

function PublicCheckout() {
  const { ownerId } = Route.useParams();
  const fetchStore = useServerFn(getStorefront);
  const submitOrder = useServerFn(placeOrder);

  const { data, isLoading, error } = useQuery({
    queryKey: ["storefront", ownerId],
    queryFn: () => fetchStore({ data: { ownerId } }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        <div className="text-sm opacity-70">Carregando loja...</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold">Loja não encontrada</h1>
          <p className="mt-2 text-sm opacity-70">Verifique o link com a loja.</p>
        </div>
      </div>
    );
  }

  return (
    <CheckoutView
      products={data.products}
      settings={data.settings}
      onSubmit={async (order) => {
        await submitOrder({
          data: {
            ownerId,
            customer: order.customer,
            phone: order.phone,
            address: order.address,
            district: order.district,
            city: order.city,
            items: order.items,
            total: order.total,
            payment: order.payment,
            status: order.status,
            notes: order.notes,
            date: order.date,
          },
        });
      }}
    />
  );
}
