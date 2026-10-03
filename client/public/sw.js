// Service worker for MuxTerm.
//
// Two jobs: satisfy the PWA install criteria (HTTPS + manifest + a registered
// worker with a fetch listener), and receive Web Push for the activity log,
// so a Claude session that needs you reaches the phone with the tab closed.
// MuxTerm needs a live websocket, so there is no offline mode: every request
// goes straight to the network.

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', () => { /* pass through */ });

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'MuxTerm', body: event.data && event.data.text() }; }
  event.waitUntil((async () => {
    // A page that is open and focused already shows its own notice; a push
    // on top of it would be the same thing twice.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.some(c => c.focused && c.visibilityState === 'visible')) return;
    await self.registration.showNotification(data.title || 'MuxTerm', {
      body: data.body || '',
      tag: data.tag || 'muxterm',
      renotify: true,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { terminalId: data.terminalId || null, url: data.url || '/workspace' }
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { terminalId, url } = event.notification.data || {};
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const page = clients.find(c => c.url.includes('/workspace')) || clients[0];
    if (page) {
      await page.focus();
      page.postMessage({ type: 'muxterm-goto', terminalId });
      return;
    }
    const opened = await self.clients.openWindow(url || '/workspace');
    // The fresh page has no listener yet; it reads the hint on load.
    if (opened && terminalId) setTimeout(() => opened.postMessage({ type: 'muxterm-goto', terminalId }), 4000);
  })());
});
