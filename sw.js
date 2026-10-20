// Keeps Галочки working without internet: the app files are stored on the device
// on first visit, then served from there. Bump VERSION after changing any file.
const VERSION = 'galochki-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function remember(request, response) {
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    caches.open(VERSION).then(cache => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    // stored copy first (works offline), refreshed in the background for next launch
    event.respondWith(
      caches.match(request, {ignoreSearch: true}).then(hit => {
        const fresh = fetch(request).then(res => remember(request, res)).catch(() => null);
        if (hit) return hit;
        return fresh.then(res => res || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
      })
    );
    return;
  }

  // fonts: keep a copy after the first online launch
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(res => remember(request, res)).catch(() => Response.error()))
    );
  }
});
