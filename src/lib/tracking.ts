// Helpers for the delivery tracking module
import type { LucideIcon } from "lucide-react";
import { Package, Bike, MapPin, CheckCircle2, XCircle } from "lucide-react";

export type DeliveryStatus =
  | "preparando"
  | "aguardando_motoboy"
  | "saiu_para_entrega"
  | "chegando"
  | "entregue"
  | "cancelado";

export type StatusBadgeStyle = { bg: string; border: string; text: string; icon: string };

export const STATUS_BADGE_DEFAULTS: Record<DeliveryStatus, StatusBadgeStyle> = {
  aguardando_motoboy: { bg: "#fef9c3", border: "#facc15", text: "#713f12", icon: "#ca8a04" },
  preparando:         { bg: "#ffedd5", border: "#fb923c", text: "#7c2d12", icon: "#ea580c" },
  saiu_para_entrega:  { bg: "#d1fae5", border: "#10b981", text: "#064e3b", icon: "#059669" },
  chegando:           { bg: "#ede9fe", border: "#a78bfa", text: "#4c1d95", icon: "#7c3aed" },
  entregue:           { bg: "#dcfce7", border: "#22c55e", text: "#14532d", icon: "#16a34a" },
  cancelado:          { bg: "#fee2e2", border: "#ef4444", text: "#7f1d1d", icon: "#dc2626" },
};

export const STATUS_INFO: Record<DeliveryStatus, { label: string; message: string; emoji: string; Icon: LucideIcon; bg: string; color: string }> = {
  aguardando_motoboy: { label: "Pedido Recebido",    message: "Recebemos seu pedido e já estamos preparando tudo.", emoji: "🟡", Icon: CheckCircle2,    bg: "bg-yellow-500/15",  color: "text-yellow-500" },
  preparando:         { label: "Separando Pedido",   message: "Seu pedido está sendo separado e preparado para envio.", emoji: "🟠", Icon: Package,        bg: "bg-orange-500/15",  color: "text-orange-400" },
  saiu_para_entrega:  { label: "Saiu para Entrega",  message: "Seu pedido já saiu para entrega e está a caminho.",   emoji: "🔵", Icon: Bike,           bg: "bg-blue-500/15",    color: "text-blue-400" },
  chegando:           { label: "Chegando",           message: "Seu entregador está próximo do destino.",             emoji: "🟣", Icon: MapPin,         bg: "bg-purple-500/15",  color: "text-purple-400" },
  entregue:           { label: "Entregue",           message: "Pedido entregue com sucesso. Obrigado pela preferência.", emoji: "🟢", Icon: CheckCircle2,   bg: "bg-emerald-500/20", color: "text-emerald-500" },
  cancelado:          { label: "Cancelado",          message: "Este pedido foi cancelado.",                          emoji: "🔴", Icon: XCircle,        bg: "bg-destructive/15", color: "text-destructive" },
};

export function getBadgeStyle(status: DeliveryStatus, overrides?: Partial<Record<DeliveryStatus, Partial<StatusBadgeStyle>>>): StatusBadgeStyle {
  const d = STATUS_BADGE_DEFAULTS[status];
  const o = overrides?.[status] || {};
  return { bg: o.bg || d.bg, border: o.border || d.border, text: o.text || d.text, icon: o.icon || d.icon };
}

export const TIMELINE_STEPS: { key: DeliveryStatus; label: string }[] = [
  { key: "aguardando_motoboy", label: "Pedido Recebido" },
  { key: "preparando", label: "Separando Pedido" },
  { key: "saiu_para_entrega", label: "Saiu para Entrega" },
  { key: "chegando", label: "Chegando" },
  { key: "entregue", label: "Entregue" },
];

export function deriveDisplayStatus(trackingStatus: DeliveryStatus, orderStatus?: string | null): DeliveryStatus {
  if (["saiu_para_entrega", "chegando", "entregue", "cancelado"].includes(trackingStatus)) return trackingStatus;
  const s = (orderStatus || "").toLowerCase();
  if (s === "entregue") return "entregue";
  if (s === "cancelado" || s === "cancelada") return "cancelado";
  if (s === "saiu" || s === "saiu_para_entrega" || s === "em_entrega") return "saiu_para_entrega";
  if (s === "separando" || s === "separacao" || s === "separação" || s === "preparando" || s === "em_preparo" || s === "producao") return "preparando";
  if (s === "aguardando" || s === "aguardando_pagamento" || s === "pago" || s === "novo" || s === "pendente" || s === "recebido") return "aguardando_motoboy";
  return trackingStatus;
}

// ---------- Map icon catalog ----------
export const VEHICLE_COLORS: Record<string, string> = {
  verde: "#10b981",
  vermelho: "#ef4444",
  azul: "#3b82f6",
  preto: "#111827",
  laranja: "#f97316",
  roxa: "#a855f7",
};

export const PIN_COLORS: Record<string, string> = {
  verde: "#10b981",
  vermelho: "#ef4444",
  azul: "#3b82f6",
  preto: "#111827",
  laranja: "#f97316",
  roxa: "#a855f7",
};

// Premium 3D-style icon library. Add new entries here — no other code changes required.
import moto3dVermelho from "@/assets/vehicles/moto-3d-vermelho.png";
import moto3dVerde from "@/assets/vehicles/moto-3d-verde.png";
import moto3dAzul from "@/assets/vehicles/moto-3d-azul.png";
import moto3dPreto from "@/assets/vehicles/moto-3d-preto.png";
import motoCartoonVermelho from "@/assets/vehicles/moto-cartoon-vermelho.png";
import motoCartoonVerde from "@/assets/vehicles/moto-cartoon-verde.png";
import motoCartoonAzul from "@/assets/vehicles/moto-cartoon-azul.png";
import scooterDelivery from "@/assets/vehicles/scooter-delivery.png";
import motoEsportiva from "@/assets/vehicles/moto-esportiva.png";
import carro3dVermelho from "@/assets/vehicles/carro-3d-vermelho.png";
import carro3dVerde from "@/assets/vehicles/carro-3d-verde.png";
import carro3dAzul from "@/assets/vehicles/carro-3d-azul.png";
import vanDelivery from "@/assets/vehicles/van-delivery.png";
import furgaoDelivery from "@/assets/vehicles/furgao-delivery.png";

export type VehicleLibraryEntry = {
  id: string;
  category: "moto" | "carro";
  label: string;
  src: string;
};

export const VEHICLE_LIBRARY: VehicleLibraryEntry[] = [
  { id: "moto-3d-vermelho",      category: "moto",  label: "Motoboy 3D Vermelho",  src: moto3dVermelho },
  { id: "moto-3d-verde",         category: "moto",  label: "Motoboy 3D Verde",     src: moto3dVerde },
  { id: "moto-3d-azul",          category: "moto",  label: "Motoboy 3D Azul",      src: moto3dAzul },
  { id: "moto-3d-preto",         category: "moto",  label: "Motoboy 3D Preto",     src: moto3dPreto },
  { id: "moto-cartoon-vermelho", category: "moto",  label: "Cartoon Vermelho",     src: motoCartoonVermelho },
  { id: "moto-cartoon-verde",    category: "moto",  label: "Cartoon Verde",        src: motoCartoonVerde },
  { id: "moto-cartoon-azul",     category: "moto",  label: "Cartoon Azul",         src: motoCartoonAzul },
  { id: "scooter-delivery",      category: "moto",  label: "Scooter Premium",      src: scooterDelivery },
  { id: "moto-esportiva",        category: "moto",  label: "Moto Esportiva",       src: motoEsportiva },
  { id: "carro-3d-vermelho",     category: "carro", label: "Carro 3D Vermelho",    src: carro3dVermelho },
  { id: "carro-3d-verde",        category: "carro", label: "Carro 3D Verde",       src: carro3dVerde },
  { id: "carro-3d-azul",         category: "carro", label: "Carro 3D Azul",        src: carro3dAzul },
  { id: "van-delivery",          category: "carro", label: "Van Delivery",         src: vanDelivery },
  { id: "furgao-delivery",       category: "carro", label: "Furgão de Entrega",    src: furgaoDelivery },
];

export function findVehicleBySrc(src: string | null | undefined): VehicleLibraryEntry | undefined {
  if (!src) return undefined;
  return VEHICLE_LIBRARY.find((v) => v.src === src);
}

// Legacy color swatches kept for backwards compatibility with old saved settings.
export const VEHICLE_OPTIONS = [
  { type: "moto", color: "vermelho", label: "Moto Delivery Vermelha" },
  { type: "moto", color: "verde",    label: "Moto Delivery Verde" },
  { type: "moto", color: "azul",     label: "Moto Delivery Azul" },
  { type: "moto", color: "preto",    label: "Moto Delivery Preta" },
] as const;

export const PIN_OPTIONS = [
  { color: "verde", label: "Pino Verde" },
  { color: "vermelho", label: "Pino Vermelho" },
  { color: "azul", label: "Pino Azul" },
  { color: "preto", label: "Pino Preto" },
  { color: "laranja", label: "Pino Laranja" },
  { color: "roxa", label: "Pino Roxa" },
] as const;

/**
 * Returns the inner SVG markup for a delivery-style vehicle icon (24x24 viewBox).
 * - moto: scooter side-view with a top delivery box (baú)
 * - carro: classic car silhouette
 * All shapes use `currentColor` strokes/fills filled in white so the colored badge background reads as the vehicle color.
 */
export function vehicleSvgPath(type: "moto" | "carro"): string {
  if (type === "carro") {
    return `
      <g fill="white">
        <path d="M3.5 13.5 5 9.2A2 2 0 0 1 6.9 8h10.2a2 2 0 0 1 1.9 1.2l1.5 4.3v3.3a.8.8 0 0 1-.8.8h-1.4a2.4 2.4 0 0 1-4.8 0H9.5a2.4 2.4 0 0 1-4.8 0H3.3a.8.8 0 0 1-.8-.8v-3.3Z"/>
        <circle cx="7.1" cy="17.4" r="1.1" fill="#111"/>
        <circle cx="16.9" cy="17.4" r="1.1" fill="#111"/>
        <rect x="6" y="10" width="5" height="2.6" rx=".4" fill="rgba(0,0,0,.18)"/>
        <rect x="12.5" y="10" width="5" height="2.6" rx=".4" fill="rgba(0,0,0,.18)"/>
      </g>`;
  }
  // Delivery scooter with top box
  return `
    <g fill="white" stroke="white" stroke-linejoin="round" stroke-width="0.6">
      <!-- top delivery box (baú) -->
      <rect x="3.2" y="5" width="6.2" height="5" rx="0.8" fill="white" stroke="white"/>
      <rect x="5.4" y="6.7" width="1.8" height="1.6" rx="0.2" fill="rgba(0,0,0,.25)" stroke="none"/>
      <!-- rear rack -->
      <path d="M4.5 10h5l-.5 2.2H5z" fill="white"/>
      <!-- body / seat -->
      <path d="M6 12.2h6.5l1.6-2.6h2.6a1 1 0 0 1 .9.55l1.3 2.55H21l-.6 2.4h-1.6a2.6 2.6 0 1 1-5.2 0H9a2.6 2.6 0 1 1-5.2 0H2.5l.8-2.4H6Z"/>
      <!-- handlebar -->
      <path d="M17 8h2.2v1.4h-2.2z" fill="white"/>
      <!-- wheels -->
      <circle cx="6.4" cy="17" r="2.4" fill="#111" stroke="white" stroke-width="0.7"/>
      <circle cx="6.4" cy="17" r="0.9" fill="white" stroke="none"/>
      <circle cx="16.6" cy="17" r="2.4" fill="#111" stroke="white" stroke-width="0.7"/>
      <circle cx="16.6" cy="17" r="0.9" fill="white" stroke="none"/>
    </g>`;
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

export const DEFAULT_CUSTOMER_TRACKING_TEMPLATE = `Oba! 🎉 Seu pedido foi realizado com sucesso, {customer_name}!\n\nAcompanhe seu pedido em tempo real pelo link:\n\n{tracking_link}\n\nQualquer dúvida, é só chamar por aqui.\n\n— {store_name}`;

export type CustomerTrackingVars = {
  customer_name?: string;
  order_number?: string;
  tracking_link: string;
  store_name?: string;
  product_name?: string;
  order_status?: string;
};

export function buildCustomerTrackingMessage(template: string, vars: CustomerTrackingVars): string {
  const tpl = (template && template.trim()) ? template : DEFAULT_CUSTOMER_TRACKING_TEMPLATE;
  const map: Record<string, string> = {
    customer_name: vars.customer_name ?? "",
    order_number: vars.order_number ?? "",
    tracking_link: vars.tracking_link ?? "",
    store_name: vars.store_name ?? "",
    product_name: vars.product_name ?? "",
    order_status: vars.order_status ?? "",
  };
  return Object.entries(map).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v), tpl);
}

/** @deprecated Use buildCustomerTrackingMessage */
export function buildCustomerMessage(trackingLink: string): string {
  return buildCustomerTrackingMessage(DEFAULT_CUSTOMER_TRACKING_TEMPLATE, { tracking_link: trackingLink });
}

export function whatsappLink(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, "");
  const mensagemCodificada = encodeURIComponent(String(message ?? ""));
  return `https://api.whatsapp.com/send?phone=${clean}&text=${mensagemCodificada}`;
}

export function googleMapsRouteUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function etaMinutes(distanceM: number, speedMps: number | null | undefined): number | null {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return null;
  const effective = speedMps && speedMps > 1 ? speedMps : 6;
  return Math.max(1, Math.round(distanceM / effective / 60));
}
