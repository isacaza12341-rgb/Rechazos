/* Service worker de "Revisión de rechazos".
   Guarda la app en el teléfono para que abra sin internet.
   Al publicar cambios, sube también el número de VERSION (y APP_VERSION en index.html). */
const VERSION = 'rr-1.1.0';
const INDEX = new URL('index.html', self.location.href).href;
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'xlsx.full.min.js',
  'zxing.min.js',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Responde desde el teléfono al instante y actualiza en segundo plano cuando hay internet.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      const res = await net;
      if (res) return res;
      if (req.mode === 'navigate') return cache.match(INDEX);
      return new Response('', { status: 504, statusText: 'Sin conexión' });
    })
  );
});
