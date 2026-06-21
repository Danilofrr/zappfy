// Helpers for the delivery tracking module

export type DeliveryStatus =
  | "preparando"
  | "aguardando_motoboy"
  | "saiu_para_entrega"
  | "chegando"
  | "entregue"
  | "cancelado";

export const STATUS_INFO: Record<DeliveryStatus, { label: string; message: string; color: string; bg: string }> = {
  preparando: {
    label: "Preparando",
    message: "Seu pedido está sendo preparado com carinho.",
    color: "text-amber-400",
    bg: "bg-amber-500/15",
  },
  aguardando_motoboy: {
    label: "Aguardando entregador",
    message: "Estamos aguardando o entregador chegar para retirar seu pedido.",
    color: "text-blue-400",
    bg: "bg-blue-500/15",
  },
  saiu_para_entrega: {
    label: "Saiu para entrega",
    message: "Seu pedido saiu para entrega! Acompanhe em tempo real.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
  },
  chegando: {
    label: "Chegando!",
    message: "O entregador está chegando até você. Fique atento!",
    color: "text-purple-400",
    bg: "bg-purple-500/15",
  },
  entregue: {
    label: "Entregue",
    message: "Pedido entregue com sucesso. Obrigado pela preferência!",
    color: "text-emerald-500",
    bg: "bg-emerald-500/20",
  },
  cancelado: {
    label: "Cancelado",
    message: "Este rastreamento foi cancelado.",
    color: "text-destructive",
    bg: "bg-destructive/15",
  },
};

export const TIMELINE_STEPS: { key: DeliveryStatus; label: string }[] = [
  { key: "aguardando_motoboy", label: "Pedido confirmado" },
  { key: "preparando", label: "Preparando" },
  { key: "saiu_para_entrega", label: "Saiu para entrega" },
  { key: "chegando", label: "Chegando" },
  { key: "entregue", label: "Entregue" },
];

export function generateToken(prefix = ""): string {
  // 12-char base36 (uniqueness enforced by DB UNIQUE)
  const a = Math.random().toString(36).slice(2, 10);
  const b = Date.now().toString(36).slice(-4);
  return `${prefix}${a}${b}`;
}

export function trackingUrls(origin: string, trackingCode: string, courierToken: string) {
  return {
    customer: `${origin}/rastreio/${trackingCode}`,
    courier: `${origin}/entrega/${courierToken}`,
  };
}

export function orderShortNumber(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

// Haversine distance in meters between two points
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 5) return "agora";
  if (diffSec < 60) return `há ${diffSec}s`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  return `há ${days}d`;
}

export function buildCourierMessage(orderNumber: string, courierLink: string): string {
  return `Olá, você recebeu uma nova entrega 🛵\n\nPedido: #${orderNumber}\n\nClique no link abaixo, permita a localização e toque em *Iniciar Entrega*:\n\n${courierLink}`;
}

export function buildCustomerMessage(trackingLink: string): string {
  return `Olá! Seu pedido saiu para entrega 🛵\n\nAcompanhe em tempo real pelo link:\n\n${trackingLink}`;
}

export function whatsappLink(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function googleMapsRouteUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function etaMinutes(distanceM: number, speedMps: number | null | undefined): number | null {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return null;
  const effective = speedMps && speedMps > 1 ? speedMps : 6; // ~22 km/h default
  return Math.max(1, Math.round(distanceM / effective / 60));
}
