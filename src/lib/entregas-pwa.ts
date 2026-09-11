export const ENTREGAS_ICON_VERSION = "v=5";
export const ENTREGAS_MANIFEST_URL = `/manifest-entregas.json?${ENTREGAS_ICON_VERSION}`;
export const ENTREGAS_ICON_192_URL = `/entregas-icon-192.png?${ENTREGAS_ICON_VERSION}`;
export const ENTREGAS_ICON_512_URL = `/entregas-icon-512.png?${ENTREGAS_ICON_VERSION}`;
export const ENTREGAS_APPLE_ICON_URL = `/entregas-apple-touch-icon.png?${ENTREGAS_ICON_VERSION}`;
export const ENTREGAS_FAVICON_URL = `/entregas-favicon.ico?${ENTREGAS_ICON_VERSION}`;
export const ENTREGAS_LAST_SLUG_KEY = "zappfy:entregas:last-slug";
export const ENTREGAS_PWA_MARKER_KEY = "zappfy:entregas:pwa";

export function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function rememberEntregasPwa(storeSlug?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ENTREGAS_PWA_MARKER_KEY, "1");
    if (storeSlug) localStorage.setItem(ENTREGAS_LAST_SLUG_KEY, storeSlug.toLowerCase());
  } catch {}
}

export function getRememberedEntregasSlug() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ENTREGAS_LAST_SLUG_KEY);
  } catch {
    return null;
  }
}

export function getEntregasStandaloneRedirectSlug() {
  if (!isStandaloneMode()) return null;
  if (typeof window === "undefined") return null;
  try {
    const marker = localStorage.getItem(ENTREGAS_PWA_MARKER_KEY) === "1";
    const slug = localStorage.getItem(ENTREGAS_LAST_SLUG_KEY);
    if (!marker && !slug) return null;
    return slug;
  } catch {
    return null;
  }
}
