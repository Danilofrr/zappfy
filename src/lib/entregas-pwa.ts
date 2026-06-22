export const ENTREGAS_DEFAULT_STORE_SLUG = "esparta";
export const ENTREGAS_MANIFEST_URL = "/manifest-entregas.json";
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
  if (typeof window === "undefined") return ENTREGAS_DEFAULT_STORE_SLUG;
  try {
    return localStorage.getItem(ENTREGAS_LAST_SLUG_KEY) || ENTREGAS_DEFAULT_STORE_SLUG;
  } catch {
    return ENTREGAS_DEFAULT_STORE_SLUG;
  }
}

export function getEntregasStandaloneRedirectSlug() {
  if (!isStandaloneMode()) return null;
  if (typeof window === "undefined") return null;
  try {
    const marker = localStorage.getItem(ENTREGAS_PWA_MARKER_KEY) === "1";
    const slug = localStorage.getItem(ENTREGAS_LAST_SLUG_KEY);
    if (!marker && !slug) return null;
    return slug || ENTREGAS_DEFAULT_STORE_SLUG;
  } catch {
    return null;
  }
}