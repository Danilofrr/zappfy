export const DEFAULT_OFFICIAL_PUBLIC_URL = "https://app.zappfy.shop";

function isPreviewHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.startsWith("id-preview--") ||
    host.includes("preview--") ||
    host.endsWith("-dev.lovable.app") ||
    host === "zappfy.lovable.app"
  );
}

export function normalizePublicBaseUrl(value?: string | null): string | null {
  const raw = String(value ?? "").trim().replace(/\/+$/, "");
  if (!raw) return null;

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    if (isPreviewHost(url.hostname)) return DEFAULT_OFFICIAL_PUBLIC_URL;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function getOfficialPublicBaseUrl(configuredUrl?: string | null): string {
  const configured = normalizePublicBaseUrl(configuredUrl);
  if (configured) return configured;

  if (typeof window !== "undefined") {
    const current = normalizePublicBaseUrl(window.location.origin);
    if (current && current !== DEFAULT_OFFICIAL_PUBLIC_URL) return current;
  }

  return DEFAULT_OFFICIAL_PUBLIC_URL;
}

export function buildPublicUrl(path: string, configuredUrl?: string | null): string {
  const base = getOfficialPublicBaseUrl(configuredUrl);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
