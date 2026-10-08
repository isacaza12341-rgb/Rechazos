/* Service worker de "Revisión de rechazos".
   Guarda la app en el teléfono para que abra sin internet.
   Al publicar cambios, sube también el número de VERSION (y APP_VERSION en index.html). */
const VERSION = 'rr-1.6.0';
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
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'rr-inbox').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Responde desde el teléfono al instante y actualiza en segundo plano cuando hay internet.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Archivo compartido desde otra app (Android): se guarda y se abre la app para importarlo.
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const file = fd.get('file');
        if (file) {
          const cache = await caches.open('rr-inbox');
          await cache.put('inbox-file', new Response(file, {
            headers: { 'x-name': encodeURIComponent(file.name || 'compartido.xlsx'), 'content-type': 'application/octet-stream' }
          }));
        }
      } catch (err) { /* si falla, la app abre igual */ }
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }
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
