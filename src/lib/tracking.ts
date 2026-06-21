// Helpers for the delivery tracking module

export type DeliveryStatus =
  | "preparando"
  | "aguardando_motoboy"
  | "saiu_para_entrega"
  | "chegando"
  | "entregue"
  | "cancelado";

export const STATUS_INFO: Record<DeliveryStatus, { label: string; message: string; color: string; bg: string; emoji: string }> = {
  aguardando_motoboy: {
    label: "Pedido Recebido",
    message: "Recebemos seu pedido e já estamos preparando tudo.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/15",
    emoji: "🟡",
  },
  preparando: {
    label: "Preparando Pedido",
    message: "Seu pedido está sendo preparado com carinho.",
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    emoji: "🟠",
  },
  saiu_para_entrega: {
    label: "Saiu para Entrega",
    message: "Seu pedido já saiu para entrega e está a caminho.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    emoji: "🛵",
  },
  chegando: {
    label: "Chegando",
    message: "Seu entregador está próximo do destino.",
    color: "text-purple-400",
    bg: "bg-purple-500/15",
    emoji: "📍",
  },
  entregue: {
    label: "Entregue",
    message: "Pedido entregue com sucesso. Obrigado pela preferência.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/20",
    emoji: "✅",
  },
  cancelado: {
    label: "Cancelado",
    message: "Este pedido foi cancelado.",
    color: "text-destructive",
    bg: "bg-destructive/15",
    emoji: "❌",
  },
};

export const TIMELINE_STEPS: { key: DeliveryStatus; label: string }[] = [
  { key: "aguardando_motoboy", label: "Pedido Recebido" },
  { key: "preparando", label: "Preparando Pedido" },
  { key: "saiu_para_entrega", label: "Saiu para Entrega" },
  { key: "chegando", label: "Chegando" },
  { key: "entregue", label: "Entregue" },
];

// Map common Portuguese order.status strings to a DeliveryStatus for the public page
export function deriveDisplayStatus(
  trackingStatus: DeliveryStatus,
  orderStatus?: string | null,
): DeliveryStatus {
  // Once tracking is moving, tracking wins
  if (["saiu_para_entrega", "chegando", "entregue", "cancelado"].includes(trackingStatus)) {
    return trackingStatus;
  }
  const s = (orderStatus || "").toLowerCase();
  if (s === "entregue") return "entregue";
  if (s === "cancelado" || s === "cancelada") return "cancelado";
  if (s === "saiu" || s === "saiu_para_entrega" || s === "em_entrega") return "saiu_para_entrega";
  if (s === "preparando" || s === "em_preparo" || s === "producao") return "preparando";
  if (s === "aguardando" || s === "novo" || s === "pendente" || s === "recebido") return "aguardando_motoboy";
  return trackingStatus;
}

// ---------- Map icon catalog ----------
export const VEHICLE_COLORS: Record<string, string> = {
  verde: "#10b981",
  vermelho: "#ef4444",
  azul: "#3b82f6",
  preto: "#111827",
  laranja: "#f97316",
};

export const PIN_COLORS: Record<string, string> = {
  verde: "#10b981",
  vermelho: "#ef4444",
  azul: "#3b82f6",
  preto: "#111827",
  laranja: "#f97316",
};

export const VEHICLE_OPTIONS = [
  { type: "moto", color: "verde", label: "Moto Verde" },
  { type: "moto", color: "vermelho", label: "Moto Vermelha" },
  { type: "moto", color: "azul", label: "Moto Azul" },
  { type: "moto", color: "preto", label: "Moto Preta" },
  { type: "moto", color: "laranja", label: "Moto Laranja" },
  { type: "carro", color: "verde", label: "Carro Verde" },
  { type: "carro", color: "vermelho", label: "Carro Vermelho" },
  { type: "carro", color: "azul", label: "Carro Azul" },
  { type: "carro", color: "preto", label: "Carro Preto" },
] as const;

export const PIN_OPTIONS = [
  { color: "verde", label: "Pino Verde" },
  { color: "vermelho", label: "Pino Vermelho" },
  { color: "azul", label: "Pino Azul" },
  { color: "preto", label: "Pino Preto" },
  { color: "laranja", label: "Pino Laranja" },
] as const;

export function vehicleSvgPath(type: "moto" | "carro"): string {
  if (type === "carro") {
    return `<path d="M5 16a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm14 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm-1.5-9h-11l-2 5h15l-2-5Zm3.5 5-2-5.5A2 2 0 0 0 17.1 5H6.9a2 2 0 0 0-1.9 1.5L3 12v5a1 1 0 0 0 1 1h2v-1h12v1h2a1 1 0 0 0 1-1v-5Z" fill="white"/>`;
  }
  // moto
  return `<path d="M5 18a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm14 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM14.12 4l1.42 2H19l-1 2h-3.34l1 2H17l2 4h-2a4.99 4.99 0 0 0-3.46 1.4l-2.04-4.08L13.6 9l-2.6-2.6L8 9H5V7h2.59L11 3.59 14.12 4Z" fill="white"/>`;
}

export function generateToken(prefix = ""): string {
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
  const effective = speedMps && speedMps > 1 ? speedMps : 6;
  return Math.max(1, Math.round(distanceM / effective / 60));
}
