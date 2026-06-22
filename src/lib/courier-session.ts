export function courierKey(slug: string) {
  return `zappfy:courier-session:${slug.toLowerCase()}`;
}

export function getCourierSession(slug: string): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(courierKey(slug)); } catch { return null; }
}

export function setCourierSession(slug: string, token: string) {
  try { localStorage.setItem(courierKey(slug), token); } catch {}
}

export function clearCourierSession(slug: string) {
  try { localStorage.removeItem(courierKey(slug)); } catch {}
}
