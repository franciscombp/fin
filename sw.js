/* Service worker de Pichibank app.
   - BUILD lo reemplaza el workflow de Pages con el commit desplegado, así
     cada despliegue crea una caché nueva y borra las anteriores.
   - Red primero para la app (HTML, JS, CSS, JSON): siempre llega la última
     versión; la caché sólo se usa sin conexión.
   - Caché primero para lo que no cambia (fuentes e imágenes).
   - Las APIs de clima y ubicación van siempre a la red (nunca a caché). */
const BUILD = '__BUILD__';
const CACHE_NAME = 'pichibank-' + (BUILD.indexOf('__') === 0 ? 'dev' : BUILD);
const CORE = [
  './', './index.html', './manifest.json', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/icon-maskable-512.png', './assets/icons/apple-touch-icon.png', './assets/icons/favicon-32.png', './assets/pichibank-avatar.svg', './assets/pichibank-logo.svg', './assets/pichibank-logo--splash.svg', './assets/pichibank-logo--white.svg', './app.js', './webauthn.js', './assets/ingreso.js', './fiesta.js', './haptics.js',
  './assets/tokens.css', './assets/solar.css', './assets/asistente.css', './assets/asistente.js', './assets/buscador.css', './assets/buscador.js', './assets/destacados.css', './assets/destacados.js', './assets/producto.css', './assets/producto.js', './assets/sistema.css', './assets/finanzas.css', './assets/pfm.css', './assets/pfm.js', './assets/uku-app.css', './assets/ingreso.css', './assets/uku-util.js', './assets/componentes.css', './assets/persona.js', './assets/productos.js', './assets/uku-pagos.js', './assets/vendor/jsqr/jsQR.js', './assets/uku-app.js', './asistente.html', './clasica.html', './assets/pfm/datos.json', './assets/analisis.css', './assets/analisis.js', './assets/bosque3d.js', './assets/i18n.js', './assets/contexto.js', './assets/sheets.js', './assets/clima.js', './assets/soporte.js', './assets/navegacion.js', './assets/soporte.css', './locales/languages.json', './locales/qu-EC.po', './assets/oso/oso.webp', './assets/oso/oso-cara.webp', './assets/banners/bp-banner-1.png', './assets/banners/bp-banner-2.png', './assets/banners/bp-banner-3.png', './assets/banners/promo-1.png', './assets/banners/promo-2.png', './assets/banners/promo-3.png', './assets/banners/promo-4.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Uno por uno: si falta un archivo (p. ej. una foto de banner), el resto igual queda guardado
      .then((cache) => Promise.all(CORE.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
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
  if (/(^|\.)(open-meteo\.com|bigdatacloud\.net)$/.test(url.hostname)) return; // datos en vivo

  if (isAppFile(req, url)) {
    event.respondWith(
      // Una navegación no admite RequestInit propio: se pide por URL.
      (req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' }))
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
