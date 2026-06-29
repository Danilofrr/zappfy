// Browser helpers to register the service worker and manage push subscriptions.
import { VAPID_PUBLIC_KEY } from "./push-config";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iPad = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect via touch points.
  const iPadOS = ua.includes("Macintosh") && (navigator as any).maxTouchPoints > 1;
  return iPad || iPadOS;
}

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as any).standalone === true;
  return !!(mq || iosStandalone);
}

export function getDeviceType(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (isIOS()) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export type PushUnsupportedReason =
  | "ok"
  | "ssr"
  | "ios-needs-pwa"
  | "no-serviceworker"
  | "no-pushmanager"
  | "no-notification";

export function getPushSupportStatus(): PushUnsupportedReason {
  if (typeof window === "undefined") return "ssr";
  // iOS only allows Web Push when the site is installed to the Home Screen.
  if (isIOS() && !isStandalonePWA()) return "ios-needs-pwa";
  if (!("serviceWorker" in navigator)) return "no-serviceworker";
  if (!("PushManager" in window)) return "no-pushmanager";
  if (!("Notification" in window)) return "no-notification";
  return "ok";
}

export function isPushSupported(): boolean {
  return getPushSupportStatus() === "ok";
}

export function isLovablePreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com") ||
    window.self !== window.top
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    setupSoundBridge();
    return reg;
  } catch (e) {
    console.error("[push] SW registration failed", e);
    return null;
  }
}

let soundBridgeReady = false;
export function setupSoundBridge() {
  if (soundBridgeReady || typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  soundBridgeReady = true;
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "PLAY_SOUND") return;
    try {
      const audio = new Audio(data.url || "/cash-register.mp3");
      audio.volume = 1;
      audio.play().catch((err) => console.warn("[push] audio play blocked", err));
    } catch (e) {
      console.warn("[push] audio error", e);
    }
  });
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

function subscriptionToJSON(sub: PushSubscription) {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  return {
    endpoint: json.endpoint!,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}

export async function subscribeToPush(): Promise<{
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}> {
  const status = getPushSupportStatus();
  if (status === "ios-needs-pwa") {
    throw new Error(
      "Para ativar notificações no iPhone, adicione o Zappfy à Tela de Início. Abra pelo Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.",
    );
  }
  if (status !== "ok") {
    throw new Error("Notificações não são suportadas neste navegador.");
  }

  if (typeof Notification !== "undefined" && Notification.permission === "denied") {
    throw new Error(
      "Você bloqueou as notificações deste dispositivo. Vá em Ajustes > Notificações > Zappfy e ative Permitir Notificações. Se não aparecer, remova o app da tela inicial e adicione novamente.",
    );
  }

  const reg = (await navigator.serviceWorker.getRegistration("/")) || (await registerServiceWorker());
  if (!reg) throw new Error("Não foi possível registrar o Service Worker.");

  // Wait for it to become active
  if (!reg.active) {
    await new Promise<void>((resolve) => {
      const sw = reg.installing || reg.waiting;
      if (!sw) return resolve();
      sw.addEventListener("statechange", () => {
        if (sw.state === "activated") resolve();
      });
      // safety timeout
      setTimeout(() => resolve(), 4000);
    });
  }

  const permission = await Notification.requestPermission();
  if (permission === "denied") {
    throw new Error(
      "Você bloqueou as notificações deste dispositivo. Vá em Ajustes > Notificações > Zappfy e ative Permitir Notificações. Se não aparecer, remova o app da tela inicial e adicione novamente.",
    );
  }
  if (permission !== "granted") throw new Error("Permissão de notificação negada.");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }

  return { ...subscriptionToJSON(sub), userAgent: navigator.userAgent };
}

export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  try { await sub.unsubscribe(); } catch (_) {}
  return endpoint;
}
