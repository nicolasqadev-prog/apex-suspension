// Increment this when shipping a new release to force cache refresh.
const CACHE_NAME = "apex-suspension-pwa-v24";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-maskable.svg",
  "/icon-maskable-512.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/og-image.png",
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
        const cached = await caches.match(event.request);
        if (cached) return cached;

        const response = await fetch(event.request);
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
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
