// ZappFy Push Service Worker
// Handles incoming web push messages and notification clicks.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
