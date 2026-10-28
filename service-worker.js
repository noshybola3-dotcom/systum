const CACHE_NAME = "sellsmart-shell-v1";
const APP_FILES = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith("sellsmart-shell-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") return;

  // Never cache Firebase auth/database responses.
  if (url.hostname.includes("firebaseio.com") ||
      url.hostname.includes("googleapis.com") ||
      url.hostname.includes("identitytoolkit")) return;

  // Cache Firebase SDK scripts after successful online fetch.
  if (url.hostname === "www.gstatic.com" && url.pathname.includes("/firebasejs/")) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok || response.type === "opaque") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          return (await caches.match("/index.html")) || (await caches.match("/"));
        }
        return new Response("غير متصل بالإنترنت", {
          status: 503,
          headers: {"Content-Type": "text/plain; charset=utf-8"}
        });
      })
    );
  }
});