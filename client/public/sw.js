// Minimal service worker for MuxTerm PWA installability.
// MuxTerm requires a live websocket connection, so we don't try to
// support full offline mode — just satisfy the PWA install criteria
// (HTTPS + manifest + registered service worker) and pass through.

self.addEventListener('install', (event) => {
  // Activate immediately on first install — no skipWaiting drama.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all clients immediately.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle every request normally.
  // Defining the listener (even empty) is what makes Chrome treat the
  // app as installable.
  return;
});
