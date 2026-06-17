import { Bike, Truck, Package, PackageCheck, Rocket, Plane, Ship, Car, MapPin, Zap } from "lucide-react";
import type { LucideProps } from "lucide-react";
import { forwardRef } from "react";

type IconComp = React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;

// Custom motorcycle icon (lucide doesn't ship one)
const Motorcycle = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, color = "currentColor", strokeWidth = 2, ...rest }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth as number}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      <path d="M15 6h3l2 5" />
      <path d="M5.5 17h4l3.5-7h-3l-1-2H6" />
      <path d="M13 10l2.5 7" />
    </svg>
  ),
) as unknown as IconComp;
Motorcycle.displayName = "Motorcycle";

export const SHIPPING_ICONS: { key: string; label: string; Icon: IconComp }[] = [
  { key: "motorcycle", label: "Moto (motoboy)", Icon: Motorcycle },
  { key: "bike", label: "Bicicleta", Icon: Bike as IconComp },
  { key: "truck", label: "Caminhão (Correios)", Icon: Truck as IconComp },
  { key: "package", label: "Pacote", Icon: Package as IconComp },
  { key: "package-check", label: "Pacote entregue", Icon: PackageCheck as IconComp },
  { key: "rocket", label: "Foguete (expresso)", Icon: Rocket as IconComp },
  { key: "zap", label: "Raio (rápido)", Icon: Zap as IconComp },
  { key: "plane", label: "Avião", Icon: Plane as IconComp },
  { key: "ship", label: "Navio", Icon: Ship as IconComp },
  { key: "car", label: "Carro", Icon: Car as IconComp },
  { key: "map-pin", label: "Pin de mapa", Icon: MapPin as IconComp },
];

const MAP: Record<string, IconComp> = Object.fromEntries(SHIPPING_ICONS.map((i) => [i.key, i.Icon]));

export function getShippingIcon(key?: string): IconComp {
  if (key && MAP[key]) return MAP[key];
  return Truck as IconComp;
}
