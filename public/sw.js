// ZappFy Service Worker — push notifications + offline cache for Central Entregas.

const ENTREGAS_CACHE = "entregas-zappfy-v9";
const ENTREGAS_ICON = "/entregas-icon-512.png?v=9";
const ENTREGAS_ICON_192 = "/entregas-icon-192.png?v=9";
const ENTREGAS_PRECACHE = [
  "/entregas-zappfy/",
  ENTREGAS_ICON,
  ENTREGAS_ICON_192,
  "/manifest-entregas.json?v=9",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ENTREGAS_CACHE).then((cache) => cache.addAll(ENTREGAS_PRECACHE).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("entregas-zappfy-") && key !== ENTREGAS_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// NetworkFirst for navigations and per-store manifests; CacheFirst for static assets.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const isEntregasNav = req.mode === "navigate" && url.pathname.startsWith("/entregas-zappfy");
  const isDynamicManifest = url.pathname.startsWith("/api/public/entregas-manifest/");
  const isEntregasAsset =
    url.pathname.startsWith("/entregas-zappfy") ||
    url.pathname.startsWith("/entregas-") ||
    url.pathname === "/zappfy-entregas-icon.svg" ||
    url.pathname === "/manifest-entregas.json" ||
    url.pathname === "/entregas-manifest.webmanifest";

  const isCachableAsset =
    isEntregasAsset && /\.(?:png|jpg|jpeg|svg|webp|woff2?|ico|json|webmanifest)$/.test(url.pathname);

  if (isEntregasNav || isDynamicManifest) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(ENTREGAS_CACHE);
          if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(ENTREGAS_CACHE);
          if (isDynamicManifest) return (await cache.match(req)) || Response.error();
          return (await cache.match(req)) || (await cache.match("/entregas-zappfy/")) || Response.error();
        }
      })(),
    );
    return;
  }

  if (isCachableAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ENTREGAS_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try {
      payload = { title: "Zappfy", body: event.data && event.data.text() };
    } catch (__) {
      payload = {};
    }
  }

  const title = payload.title || "Venda aprovada!";
  const soundUrl = (payload.data && payload.data.sound) || payload.sound || "/cash-register.mp3";
  const options = {
    body: payload.body || "",
    icon: payload.icon || ENTREGAS_ICON,
    badge: payload.badge || ENTREGAS_ICON_192,
    image: payload.image,
    tag: payload.tag || "zappfy-sale",
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: false,
    silent: false,
    data: {
      url: (payload.data && payload.data.url) || "/pedidos",
      sound: soundUrl,
      ...(payload.data || {}),
    },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      try {
        const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clientsArr) {
          try {
            client.postMessage({ type: "PLAY_SOUND", url: soundUrl });
          } catch (_) {}
        }
      } catch (_) {}
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/pedidos";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            if ("navigate" in client) {
              try {
                await client.navigate(targetUrl);
              } catch (_) {}
            }
            return;
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
    })(),
  );
});
