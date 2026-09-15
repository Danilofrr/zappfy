export const ENTREGAS_ICON_VERSION = "v=10";

export const ENTREGAS_MANIFEST_URL = `/manifest-entregas.json?${ENTREGAS_ICON_VERSION}`;
export const ENTREGAS_VECTOR_ICON_URL = `/zappfy-entregas-icon.svg?${ENTREGAS_ICON_VERSION}`;
export const ENTREGAS_ICON_192_URL = `/entregas-icon-192.png?${ENTREGAS_ICON_VERSION}`;
export const ENTREGAS_ICON_512_URL = `/entregas-icon-512.png?${ENTREGAS_ICON_VERSION}`;
export const ENTREGAS_APPLE_ICON_URL = `/entregas-apple-touch-icon.png?${ENTREGAS_ICON_VERSION}`;
export const ENTREGAS_FAVICON_URL = `/entregas-icon-192.png?${ENTREGAS_ICON_VERSION}`;

export const ENTREGAS_LAST_SLUG_KEY = "zappfy:entregas:last-slug";
export const ENTREGAS_PWA_MARKER_KEY = "zappfy:entregas:pwa";
export const ENTREGAS_COLOR_MODE_KEY = "zappfy-entregas-color-mode";
const ENTREGAS_LIGHT_DEFAULT_MIGRATION_KEY = "zappfy:entregas:light-default-v1";

const COURIER_SESSION_PREFIX = "zappfy:courier-session:";

// A Central de Entregas passa a abrir em modo claro por padrão no desktop e no mobile.
// Esta migração roda uma única vez também para aparelhos que receberam o antigo padrão escuro.
// Depois dela, qualquer escolha manual de claro/escuro continua salva normalmente.
if (typeof window !== "undefined") {
  try {
    const migrated = window.localStorage.getItem(ENTREGAS_LIGHT_DEFAULT_MIGRATION_KEY) === "1";
    if (!migrated) {
      window.localStorage.setItem(ENTREGAS_COLOR_MODE_KEY, "light");
      window.localStorage.setItem(ENTREGAS_LIGHT_DEFAULT_MIGRATION_KEY, "1");
    } else {
      const savedColorMode = window.localStorage.getItem(ENTREGAS_COLOR_MODE_KEY);
      if (savedColorMode !== "light" && savedColorMode !== "dark") {
        window.localStorage.setItem(ENTREGAS_COLOR_MODE_KEY, "light");
      }
    }
  } catch {
    // LocalStorage pode estar indisponível em modo privado/restrito.
  }
}

export function getEntregasManifestUrl(storeSlug?: string | null) {
  const clean = String(storeSlug || "").trim().toLowerCase();
  if (!clean) return ENTREGAS_MANIFEST_URL;
  return `/api/public/entregas-manifest/${encodeURIComponent(clean)}?${ENTREGAS_ICON_VERSION}`;
}

export function rememberEntregasPwa(storeSlug?: string | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ENTREGAS_PWA_MARKER_KEY, "1");
    const clean = String(storeSlug || "").trim().toLowerCase();
    if (clean) localStorage.setItem(ENTREGAS_LAST_SLUG_KEY, clean);
  } catch {}
}

export function getRememberedEntregasSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const remembered = localStorage.getItem(ENTREGAS_LAST_SLUG_KEY)?.trim().toLowerCase();
    if (remembered) return remembered;

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(COURIER_SESSION_PREFIX)) continue;
      const slug = key.slice(COURIER_SESSION_PREFIX.length).trim().toLowerCase();
      if (slug) {
        localStorage.setItem(ENTREGAS_LAST_SLUG_KEY, slug);
        return slug;
      }
    }
  } catch {}
  return null;
}

export function isEntregasStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // @ts-ignore iOS Safari
    window.navigator.standalone === true
  );
}

export function getEntregasStandaloneRedirectSlug(): string | null {
  if (!isEntregasStandalone()) return null;
  return getRememberedEntregasSlug();
}
