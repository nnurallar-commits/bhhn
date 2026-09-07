const CACHE = 'bhhn-v5';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./assets/logo.png','./assets/logo-192.png','./assets/logo-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/firebase-config.js')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
    if (url.origin === self.location.origin) {
      const clone = resp.clone(); caches.open(CACHE).then(c => c.put(event.request, clone));
    }
    return resp;
  }).catch(()=>cached)));
});
