/* Service worker de Pichibank app.
   - BUILD lo reemplaza el workflow de Pages con el commit desplegado, así
     cada despliegue crea una caché nueva y borra las anteriores.
   - Red primero para la app (HTML, JS, CSS, JSON): siempre llega la última
     versión; la caché sólo se usa sin conexión.
   - Caché primero para lo que no cambia (fuentes e imágenes). */
const BUILD = '__BUILD__';
const CACHE_NAME = 'pichibank-' + (BUILD.indexOf('__') === 0 ? 'dev' : BUILD);
const CORE = [
  './', './index.html', './manifest.json', './app.js', './webauthn.js', './fiesta.js', './haptics.js',
  './assets/tokens.css', './assets/solar.css', './assets/asistente.css', './assets/asistente.js', './assets/buscador.css', './assets/buscador.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

function isAppFile(req, url) {
  return req.mode === 'navigate' || (url.origin === self.location.origin && /\.(html|js|css|json)$|\/$/.test(url.pathname));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (isAppFile(req, url)) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
