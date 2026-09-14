import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

export type CourierMapDelivery = {
  id: string;
  tracking_code: string;
  status: string;
  scheduled_for: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_geocoded_address?: string | null;
  delivery_geocoding_status?: string | null;
  order: {
    id: string;
    customer: string;
    address: string;
    district: string;
    city: string;
    total: number;
    items: { name: string; qty: number }[];
  };
};

export type CourierMapTheme = {
  cardColor: string;
  cardBorderColor: string;
  titleColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  iconColor: string;
  radius: number;
};

export type CourierDeliveryMapProps = {
  deliveries: CourierMapDelivery[];
  storeSlug: string;
  theme: CourierMapTheme;
  onOpenDeliveries?: () => void;
};

const CourierDeliveryMapClient = lazy(() =>
  import("@/components/CourierDeliveryMapClient").then((module) => ({
    default: module.CourierDeliveryMapClient,
  })),
);

export function CourierDeliveryMap(props: CourierDeliveryMapProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-48 items-center justify-center rounded-xl border p-6 text-sm opacity-70">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando mapa das entregas…
        </div>
      }
    >
      <CourierDeliveryMapClient {...props} />
    </Suspense>
  );
}
