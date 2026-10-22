/* Navegación de Pichibank app: una sola transición para todas las pantallas,
   como en iOS.
   - Toda pantalla completa entra desde la derecha (CSS en sistema.css).
   - La pantalla de abajo se corre un 30 % a la izquierda y se oscurece un
     poco; al cerrar, vuelve a su lugar con la misma curva.
   - Gesto de regreso: arrastrar desde el borde izquierdo. La pantalla sigue
     al dedo; si pasa del 35 % (o el gesto es rápido) se cierra con su propio
     botón de volver, si no, regresa a su lugar.
   - "Atrás" del teléfono o del navegador: cada pantalla abierta deja una
     entrada en el historial (window.Overlay de sheets.js, igual que las
     hojas), así el atrás cierra la de arriba en vez de salir de la app.
   - En Safari de iPhone (en el navegador, no instalada) el gesto desde el
     borde es el del propio Safari: navega el historial. Ahí no se usa el
     gesto propio, para que no compitan; el atrás del historial cierra la
     pantalla sin repetir la animación.
   Cada módulo sigue abriendo y cerrando sus pantallas como siempre (con la
   clase .open); este módulo solo observa esa clase. */
(function () {
  var PAGES = '.push-page, .card-detail, .as-page, .ai-page, .sp';
  var BACKS = '#push-back, #cd-back, [data-as="back"], [data-ai="close"], [data-sp="back"]';
  var DUR = 400, CURVE = 'cubic-bezier(.32, .72, 0, 1)', SHIFT = '-30%', EDGE = 24;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stack = []; // { page, under: [elementos], anims: [], scrim }
  var IOS_SAFARI = /iP(hone|ad|od)/.test(navigator.userAgent) && !navigator.standalone &&
    !(window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  var uid = 0;

  function homeLayer() { return [document.getElementById('home-page'), document.querySelector('.nav-bar')].filter(Boolean); }
  function zOf(el) { return parseInt(getComputedStyle(el).zIndex, 10) || 0; }
  function top() { return stack[stack.length - 1]; }
  function find(page) { for (var i = 0; i < stack.length; i++) if (stack[i].page === page) return i; return -1; }

  function push(page) {
    if (find(page) >= 0) return;
    var prev = top(), under = prev ? [prev.page] : homeLayer();
    var scrim = document.createElement('div');
    scrim.className = 'ux-scrim'; scrim.setAttribute('aria-hidden', 'true');
    scrim.style.zIndex = String(zOf(page) - 1);
    document.body.appendChild(scrim);
    var opts = { duration: RM ? 1 : DUR, easing: CURVE, fill: 'forwards' };
    // La tarjeta que crece desde su miniatura (.is-morph) no corre la pantalla de abajo: solo el velo
    var anims = page.classList.contains('is-morph') ? [] : under.map(function (el) { return el.animate([{ translate: '0 0' }, { translate: SHIFT + ' 0' }], opts); });
    anims.push(scrim.animate([{ opacity: 0 }, { opacity: 1 }], opts));
    stack.push({ page: page, under: under, anims: anims, scrim: scrim });
    historial(page);
  }

  // Entrada en el historial: el atrás del teléfono/navegador cierra esta pantalla con su botón
  function historial(page) {
    if (!window.Overlay || page.matches('.ai-page')) return; // el análisis ya registra su propia entrada (analisis.js)
    page._uxId = page._uxId || 'pagina-' + (++uid);
    Overlay.push(page._uxId, function () {
      if (!isOpen(page)) return;
      // Safari ya mostró su propia transición: se cierra sin repetirla
      var html = document.documentElement;
      html.classList.add('ux-instant');
      setTimeout(function () { html.classList.remove('ux-instant'); }, DUR + 120);
      var back = page.querySelector(BACKS);
      if (back) back.click();
      // Volver solo cambió de nivel dentro de la pantalla: sigue abierta y necesita su entrada
      setTimeout(function () { if (isOpen(page)) historial(page); }, 30);
    });
  }

  function pop(page) {
    var i = find(page); if (i < 0) return;
    var e = stack.splice(i, 1)[0];
    // Si se cerró una de abajo, la de arriba ahora tapa a la que estaba debajo
    if (stack[i]) stack[i].under = e.under;
    if (window.Overlay && page._uxId) Overlay.done(page._uxId); // cerrada por la UI: fuera del historial
    var instant = document.documentElement.classList.contains('ux-instant');
    e.anims.forEach(function (a) {
      if (instant) { a.cancel(); return; }
      a.onfinish = function () { a.cancel(); };
      a.reverse();
      // Safari no reanuda con reverse() una animación en pausa (la deja el gesto): la de abajo
      // quedaba corrida a medio camino
      if (a.playState !== 'running') a.play();
    });
    // Pase lo que pase con la animación, la pantalla de abajo termina en su lugar
    setTimeout(function () { e.anims.forEach(function (a) { a.cancel(); }); e.scrim.remove(); }, instant ? 0 : DUR + 60);
  }

  function isOpen(el) { return el.classList.contains('open') && !el.classList.contains('closing'); }
  var mo = new MutationObserver(function (list) {
    list.forEach(function (m) {
      var el = m.target;
      if (!el.matches || !el.matches(PAGES)) return;
      var was = el._uxOpen || false, now = isOpen(el);
      if (now === was) return;
      el._uxOpen = now;
      if (now) push(el); else pop(el);
    });
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });

  /* ---------- Gesto de regreso desde el borde ---------- */
  var g = null;
  function setX(el, x, ms) {
    el.style.setProperty('transition', ms ? 'transform ' + ms + 'ms ' + CURVE : 'none', 'important');
    el.style.setProperty('transform', 'translate3d(' + x + 'px, 0, 0)', 'important');
    el.style.setProperty('animation', 'none', 'important');
  }
  function clearX(el) { ['transition', 'transform', 'animation'].forEach(function (p) { el.style.removeProperty(p); }); }
  // La capa de abajo sigue al dedo en proporción: se busca el instante de la
  // curva (.32, .72, 0, 1) en que el avance vale exactamente 1 - p.
  function bez(t, a, b) { var u = 1 - t; return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t; }
  function timeFor(y) {
    var lo = 0, hi = 1;
    for (var i = 0; i < 24; i++) { var m = (lo + hi) / 2; if (bez(m, .72, 1) < y) lo = m; else hi = m; }
    return bez((lo + hi) / 2, .32, 0);
  }
  function seek(e, p) {
    var t = timeFor(1 - p) * DUR;
    e.anims.forEach(function (a) { a.pause(); a.currentTime = t; });
  }

  // Táctil con touch* (preventDefault detiene el scroll del navegador); el
  // mouse sirve para probar en escritorio.
  function start(x, y, t) {
    var e = top();
    if (IOS_SAFARI || !e || x > EDGE) return; // en Safari de iPhone el gesto es el del navegador
    if (document.querySelector('.sheet.open, .as-sheet.open')) return; // con una hoja abierta, el gesto es de la hoja
    g = { e: e, x0: x, y0: y, t: t, x: x, vx: 0, on: false };
  }
  function move(x, y, t, ev) {
    if (!g) return;
    var dx = x - g.x0, dy = y - g.y0;
    if (!g.on) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { g = null; return; }
      if (dx < 10) return;
      g.on = true; g.w = g.e.page.getBoundingClientRect().width || innerWidth;
      document.documentElement.classList.add('ux-dragging');
    }
    var dt = Math.max(1, t - g.t);
    g.vx = (x - g.x) / dt; g.x = x; g.t = t;
    var px = Math.max(0, dx);
    setX(g.e.page, px, 0);
    seek(g.e, Math.min(1, px / g.w));
    if (ev.cancelable) ev.preventDefault();
  }
  function swallowClick() {
    var k = function (c) { c.stopPropagation(); c.preventDefault(); };
    window.addEventListener('click', k, true);
    setTimeout(function () { window.removeEventListener('click', k, true); }, 350);
  }
  function end() {
    var s = g; g = null;
    if (!s || !s.on) return;
    document.documentElement.classList.remove('ux-dragging');
    var page = s.e.page, x = Math.max(0, s.x - s.x0), p = x / s.w;
    var vx = performance.now() - s.t > 120 ? 0 : s.vx; // si el dedo se detuvo, no cuenta como impulso
    var close = p > .35 || vx > .5;
    var ms = Math.max(160, Math.round(DUR * (close ? 1 - p : p)));
    if (close) {
      setX(page, s.w + 8, ms);
      var back = page.querySelector(BACKS);
      if (back) back.click();
      setTimeout(function () {
        if (isOpen(page)) { // volver solo cambió de nivel dentro de la pantalla: se queda abierta
          setX(page, 0, DUR); s.e.anims.forEach(function (a) { a.play(); });
          setTimeout(function () { clearX(page); }, DUR + 20);
        } else {
          setTimeout(function () { clearX(page); }, DUR);
        }
      }, ms + 20);
    } else {
      setX(page, 0, ms);
      s.e.anims.forEach(function (a) { a.play(); });
      setTimeout(function () { clearX(page); }, ms + 20);
    }
    swallowClick(); // el clic que sigue al arrastre no toca nada de la pantalla
  }
  document.addEventListener('touchstart', function (ev) { if (ev.touches.length === 1) start(ev.touches[0].clientX, ev.touches[0].clientY, performance.now()); else g = null; }, { capture: true, passive: true });
  document.addEventListener('touchmove', function (ev) { if (g) move(ev.touches[0].clientX, ev.touches[0].clientY, performance.now(), ev); }, { capture: true, passive: false });
  document.addEventListener('touchend', end, true);
  document.addEventListener('touchcancel', end, true);
  var mouse = false;
  document.addEventListener('mousedown', function (ev) { if (ev.button === 0 && !(ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents)) { mouse = true; start(ev.clientX, ev.clientY, performance.now()); } }, true);
  document.addEventListener('mousemove', function (ev) { if (mouse && g) move(ev.clientX, ev.clientY, performance.now(), ev); }, true);
  document.addEventListener('mouseup', function () { if (mouse) { mouse = false; end(); } }, true);
})();
