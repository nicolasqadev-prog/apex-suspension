// Increment this when shipping a new release to force cache refresh.
const CACHE_NAME = "apex-suspension-pwa-v43";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon-maskable.svg",
  "/icon-maskable-512.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/og-image.png",
  "/pwa-welcome.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let title = "Apex Suspensión";
  let body = "Tienes una novedad en tu pedido o catálogo.";
  let url = "/";

  try {
    const data = event.data?.json();
    if (data && typeof data === "object") {
      if (typeof data.title === "string") title = data.title;
      if (typeof data.body === "string") body = data.body;
      if (typeof data.url === "string") url = data.url;
    }
  } catch {
    const text = event.data?.text();
    if (text) body = text;
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
      tag: "apex-push",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/";
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Panel interno y archivos para buscadores: siempre red (sin cache del SW).
  if (
    url.pathname.startsWith("/admin") ||
    url.pathname === "/sitemap.xml" ||
    url.pathname === "/robots.txt"
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Never cache Vite dev server internals or source modules.
  if (
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/node_modules/") ||
    url.pathname.includes("__vite") ||
    url.pathname.includes("react_refresh")
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      // For navigations (page loads), prefer network, fallback to app shell.
      if (event.request.mode === "navigate") {
        try {
          const fresh = await fetch(event.request);
          return fresh;
        } catch {
          return (await caches.match("/")) || Response.error();
        }
      }

      // For built assets, use cache-first.
      const isAsset =
        url.pathname.startsWith("/assets/") ||
        /\.(?:css|js|mjs|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i.test(url.pathname);

      if (isAsset) {
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        } catch {
          return (await caches.match(event.request)) || Response.error();
        }
      }

      // Default: network-first, fallback to cache if available.
      try {
        const response = await fetch(event.request);
        return response;
      } catch {
        return (await caches.match(event.request)) || Response.error();
      }
    })(),
  );
});
