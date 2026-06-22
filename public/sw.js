// ZappFy Service Worker — push notifications + offline cache for Central Entregas.

const ENTREGAS_CACHE = "entregas-zappfy-v2";
const ENTREGAS_PRECACHE = [
  "/entregas-zappfy/",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ENTREGAS_CACHE).then((c) => c.addAll(ENTREGAS_PRECACHE).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("entregas-zappfy-") && k !== ENTREGAS_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// NetworkFirst for /entregas-zappfy navigations, CacheFirst for its hashed assets.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  const isEntregasNav =
    req.mode === "navigate" && url.pathname.startsWith("/entregas-zappfy");
  const isCachableAsset =
    /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ico)$/.test(url.pathname);

  if (isEntregasNav) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(ENTREGAS_CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cache = await caches.open(ENTREGAS_CACHE);
        return (await cache.match(req)) || (await cache.match("/entregas-zappfy")) || Response.error();
      }
    })());
    return;
  }

  if (isCachableAsset) {
    event.respondWith((async () => {
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
    })());
  }
});


self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try {
      payload = { title: "ZappFy", body: event.data && event.data.text() };
    } catch (__) {
      payload = {};
    }
  }

  const title = payload.title || "Venda aprovada!";
  const soundUrl = (payload.data && payload.data.sound) || payload.sound || "/cash-register.mp3";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
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

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    try {
      const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clientsArr) {
        try { c.postMessage({ type: "PLAY_SOUND", url: soundUrl }); } catch (_) {}
      }
    } catch (_) {}
  })());
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
              try { await client.navigate(targetUrl); } catch (_) {}
            }
            return;
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
