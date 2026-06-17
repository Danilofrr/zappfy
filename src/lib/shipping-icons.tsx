import { Bike, Truck, Package, PackageCheck, Rocket, Plane, Ship, Car, MapPin, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const SHIPPING_ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "bike", label: "Moto (motoboy)", Icon: Bike },
  { key: "truck", label: "Caminhão (Correios)", Icon: Truck },
  { key: "package", label: "Pacote", Icon: Package },
  { key: "package-check", label: "Pacote entregue", Icon: PackageCheck },
  { key: "rocket", label: "Foguete (expresso)", Icon: Rocket },
  { key: "zap", label: "Raio (rápido)", Icon: Zap },
  { key: "plane", label: "Avião", Icon: Plane },
  { key: "ship", label: "Navio", Icon: Ship },
  { key: "car", label: "Carro", Icon: Car },
  { key: "map-pin", label: "Pin de mapa", Icon: MapPin },
];

const MAP: Record<string, LucideIcon> = Object.fromEntries(SHIPPING_ICONS.map((i) => [i.key, i.Icon]));

export function getShippingIcon(key?: string): LucideIcon {
  if (key && MAP[key]) return MAP[key];
  return Truck;
}
