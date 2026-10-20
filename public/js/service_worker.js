// Retires the service worker of the previous (Dart/Jaspr) Budgetie build.
//
// That worker served index.html from a cache-first store, so returning visitors would keep getting
// the old app. Browsers re-check this script URL on navigation; this version clears every cache,
// unregisters itself and reloads open tabs so they load the current app. Data in localStorage is
// not touched. Safe to delete once old visitors have come back (or after a few months).
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    })(),
  );
});
