/**
 * public/sw.js
 * Service Worker (PWA) - precache de shell + caché de runtime
 * Copiado automáticamente a dist/ por Vite desde public/
 */

const CACHE_NAME = "misfinanzas-v4";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/marca/logo-morelia.svg",
  "/assets/marca/logo-morelia-auth.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// Instalación - precache del shell de la app
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => {
        console.error("Precache falló (modo offline parcial):", error);
      })
  );
  self.skipWaiting();
});

// Activación - limpiar caches antiguos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch - estrategias según tipo de petición
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Solo GET
  if (request.method !== "GET") return;

  // No interceptar APIs externas (Supabase, Google Fonts, etc.)
  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    request.url.includes("supabase") ||
    request.url.includes("cdn.") ||
    request.url.includes("unpkg.") ||
    request.url.includes("fonts.googleapis") ||
    request.url.includes("fonts.gstatic")
  ) {
    return;
  }

  // Navegaciones (HTML): Network First con fallback al shell offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cacheResponse) => cacheResponse || caches.match("/index.html"))
        )
    );
    return;
  }

  // Assets estáticos (JS/CSS/imágenes con hash): Cache First + revalidación
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const update = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || update;
      })
    );
    return;
  }

  // Otros: Network First con fallback a caché
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Notificaciones push
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: "Mis Finanzas", body: event.data ? event.data.text() : "" };
  }

  const options = {
    body: payload.body || "Tienes una nueva notificación",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(payload.title || "Mis Finanzas", options));
});

// Click en notificación: abrir la app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const url = event.notification.data?.url || "/";
      for (const client of windowClients) {
        if ("focus" in client) {
          client.postMessage({ type: "NAVIGATE", url });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Escuchar mensajes del cliente
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
