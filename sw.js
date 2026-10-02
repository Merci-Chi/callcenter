/* Steady Hands Call Center service worker
   Freshness-first: same-origin app files always come from the network when available. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
    ])
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request, { cache: 'no-store' }).catch(() => fetch(request))
  );
});
