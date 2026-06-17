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

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
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
  if (!isPushSupported()) throw new Error("Notificações não são suportadas neste navegador.");

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
