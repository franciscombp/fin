/* =====================================================================
   Versión asistente (paralela): Uku es la pantalla. Un solo punto de
   entrada para buscar, pedir ayuda y entender tus finanzas.
   - Se activa con asistente.html o index.html?app=uku. La app actual
     queda igual: este archivo no hace nada sin ese parámetro.
   - "Mis finanzas" en la barra inferior pasa a ser Uku; la lupa y la
     ayuda de arriba también llevan a Uku.
   - Todo cabe en una pantalla, sin scroll: Uku en su mundo 3D, su globo
     con lo más importante (y su botón), los accesos (Mis finanzas,
     clasificar, consejos, ayuda) y abajo la barra para hablarle o buscar.
     Los resultados y la conversación flotan sobre su mundo.
   Reusa: Buscador (acciones), Soporte (ayuda), PFM (finanzas y consejos)
   y bosque3d (el mundo de Uku).
   ===================================================================== */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('app') !== 'uku') return;
  var root = document.documentElement;
  root.classList.add('app-uku');
  var ASSET = (document.currentScript && document.currentScript.src || location.href).replace(/[^/]*$/, '');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function money(v) { return '$ ' + Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function money0(v) { return money(v).replace(/,00$/, ''); }
  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function face() { return window.Asistente ? Asistente.faceIMG() : ''; }
  function ic(n) { return '<span class="material-symbols-rounded" aria-hidden="true">' + n + '</span>'; }

  var view, host, stage, globoEl, pills, results, chat, input, msgs = [], gi = 0, b3d = null;

  var PRUEBA = ['¿En qué se me va la plata?', 'Transferir', '¿Cuánto debo?', 'Bloquear mi tarjeta'];
  function acciones(q) { return window.Buscador && Buscador.rank ? Buscador.rank(q) : []; }
  function accion(label) { return window.Buscador && Buscador.actions ? Buscador.actions().filter(function (a) { return a.label === label; })[0] : null; }
  function ayuda(q, n) { return window.Soporte && Soporte.find ? Soporte.find(q, n || 3) : []; }
  // Las cifras solo cuando preguntas por tu plata; "perdí mi tarjeta" es ayuda, no deuda
  var HACER = /perd|bloque|rob|clave|contrase|pin\b|transfer|recarg|pagar con|cobrar|retirar|enviar|mandar|activar|cancel|cambiar|reclam|como (uso|pago|hago|activo|cambio)/;
  var PLATA = /cuant|gast|deb|deuda|plata|dinero|ingres|sueldo|pension|remesa|presupuesto|ahorr|cierr|ritmo|revis|pregunt|queda/;
  function finanzas(q) { var n = norm(q); if (HACER.test(n) || !PLATA.test(n)) return null; try { return window.PFM && PFM.ready() ? PFM.answer(q) : null; } catch (e) { return null; } }
  function resumen() { return window.PFM && PFM.summary ? PFM.summary() : null; }
  function consejos() { return (window.PFM && PFM.advice ? PFM.advice() : []).filter(function (x) { return !x.done; }); }

  /* ---------- La pantalla: Uku y su mundo ---------- */
  function mount() {
    view = document.querySelector('.view[data-view="1"]');
    if (!view || host) return;
    host = document.createElement('div'); host.className = 'uk';
    view.insertBefore(host, view.firstChild);
    var back = document.createElement('button'); back.className = 'uk-back'; back.setAttribute('data-uk', 'home'); back.setAttribute('aria-label', 'Volver a Uku');
    back.innerHTML = ic('keyboard_arrow_down');
    view.insertBefore(back, host.nextSibling);
    host.innerHTML =
      '<div class="uk-scene"><div class="b3d" data-shift=".22"><div class="b3d__fallback">' + (window.Asistente ? Asistente.petSVG() : '') + '</div></div></div>' +
      '<div class="uk-globo" aria-live="polite"></div>' +
      '<div class="uk-chat" aria-live="polite"></div>' +
      '<div class="uk-pills"></div>' +
      '<div class="uk-results"></div>' +
      '<form class="uk-bar" role="search"><button type="button" class="uk-bar__x" data-uk="nueva" aria-label="Terminar conversación">' + ic('close') + '</button>' +
        '<label class="uk-bar__f">' + ic('search') + '<input type="text" enterkeyhint="send" autocomplete="off" placeholder="Habla con Uku o busca algo" aria-label="Habla con Uku o busca algo"></label>' +
        '<button class="uk-bar__send" type="submit" aria-label="Enviar">' + ic('arrow_upward') + '</button></form>' +
      '<button class="uk-exit" data-uk="salir">Volver a la versión actual</button>';
    globoEl = host.querySelector('.uk-globo'); pills = host.querySelector('.uk-pills'); results = host.querySelector('.uk-results'); chat = host.querySelector('.uk-chat'); input = host.querySelector('input');
    host.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); enviar(input.value); });
    input.addEventListener('input', function () { modo(); pintarResultados(); });
    view.addEventListener('click', onClick);
    document.addEventListener('pfm:change', function () { gi = 0; pintar(); });
    pintar();
  }
  function modo() {
    host.classList.toggle('is-typing', !!input.value.trim());
    host.classList.toggle('is-chat', msgs.length > 0);
  }
  function pintar() { modo(); pintarGlobo(); pintarAccesos(); pintarChat(); pintarResultados(); }

  // Lo que dice Uku: su consejo más importante (tocarlo a él pasa al siguiente)
  function pintarGlobo() {
    var A = consejos(), x = A.length ? A[gi % A.length] : null, s = resumen();
    var t = x ? x.di || x.t : s && !s.n ? '¡Todo en orden, ' + s.nombre + '! ¿En qué te ayudo hoy?' : 'Hola, soy Uku. ¿En qué te ayudo?';
    globoEl.innerHTML = '<p class="uk-globo__who">' + (s ? 'Hola, ' + esc(s.nombre) : 'Uku') + (A.length > 1 ? '<span>' + (gi % A.length + 1) + ' de ' + A.length + '</span>' : '') + '</p>' +
      '<p class="uk-globo__t">' + esc(t) + '</p>' +
      (x && x.act ? '<button class="pf-cta uk-globo__go" data-uk-pfm="' + esc(x.act) + '">' + esc(x.actl) + '</button>' : '');
  }
  // Los accesos: todo lo que antes eran pantallas, a un toque desde Uku
  function pintarAccesos() {
    var s = resumen(), A = consejos(), p = function (attr, icon, t, sub) { return '<button class="uk-pill" ' + attr + '>' + ic(icon) + '<span><b>' + esc(t) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>'; };
    pills.innerHTML = p('data-uk="fin"', 'monitoring', 'Mis finanzas', s ? 'Saldo ' + money0(s.saldo) : '') +
      (s && s.n ? p('data-uk-pfm="game"', 'category', 'Clasificar ' + Math.min(10, s.n), 'Uku está ' + s.moodL) : '') +
      (A.length > 1 ? p('data-uk-pfm="insights"', 'lightbulb', 'Tus consejos', A.length + ' para ti') : '') +
      p('data-uk="help"', 'support_agent', 'Ayuda', 'Preguntas y contacto');
  }

  /* ---------- Escribiendo: resultados flotando sobre su mundo ---------- */
  function fila(attr, icon, t, s) {
    return '<button class="uk-row" ' + attr + '><span class="uk-row__ic">' + ic(icon) + '</span><span class="uk-row__t"><b>' + esc(t) + '</b>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</span>' + ic('chevron_right') + '</button>';
  }
  function texto(t) { return String(t || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ''); }
  function pintarResultados() {
    var q = input.value.trim();
    if (!q) { results.innerHTML = ''; return; }
    var acts = acciones(q).slice(0, 3), fin = finanzas(q), H = ayuda(q, 3), html = fila('data-uk-ask="' + esc(q) + '"', 'auto_awesome', 'Preguntarle a Uku', '“' + q + '”');
    if (fin) html += '<p class="uk-results__l">Tus finanzas</p><button class="uk-ans" data-uk-ask="' + esc(q) + '">' + esc(texto(fin.t)) + '</button>';
    if (acts.length) html += '<p class="uk-results__l">Hacer</p>' + acts.map(function (a) { return fila('data-uk-act="' + esc(a.label) + '"', a.icon, a.label, ''); }).join('');
    if (H.length) html += '<p class="uk-results__l">Ayuda</p>' + H.map(function (h) { return fila('data-uk-' + h.kind + '="' + h.i + '"', h.icon || 'help', h.t, h.kind === 'tut' ? 'Tutorial' : ''); }).join('');
    results.innerHTML = html;
  }

  /* ---------- Conversación, sobre su mundo ---------- */
  function responder(q) {
    var fin = finanzas(q), acts = acciones(q).slice(0, 2), H = ayuda(q, 2), r = { t: '', acts: acts, help: [], chips: [] };
    if (fin) { r.t = fin.t; r.chips = (fin.s || []).slice(0, 2); r.acts = []; }
    else if (acts.length) r.t = acts.length === 1 ? 'Te llevo a ' + acts[0].label.toLowerCase() + '. ¿Lo hacemos?' : 'Esto es lo que encontré para hacerlo:';
    else if (H.length) r.t = 'Esto te puede ayudar:';
    else { r.t = 'Todavía no sé eso. Puedo contarte de tu plata, llevarte a hacer algo en la app o buscar en la ayuda.'; r.chips = PRUEBA.slice(0, 3); }
    if (!fin) r.help = H;
    return r;
  }
  function enviar(q) {
    q = String(q || '').trim(); if (!q) return;
    msgs.push({ me: q }, { uku: responder(q) });
    input.value = ''; input.blur(); fx('select');
    if (b3d) b3d.play('nod');
    pintar();
  }
  function pintarChat() {
    chat.innerHTML = msgs.map(function (m) {
      if (m.me) return '<div class="uk-me"><p>' + esc(m.me) + '</p></div>';
      var r = m.uku;
      return '<div class="uk-msg"><p class="uk-msg__b">' + r.t + '</p>' +
        (r.acts.length || r.help.length || r.chips.length ? '<div class="uk-msg__acts">' +
          r.acts.map(function (a) { return '<button class="uk-chip" data-uk-act="' + esc(a.label) + '">' + ic(a.icon) + esc(a.label) + '</button>'; }).join('') +
          r.help.map(function (h) { return '<button class="uk-chip" data-uk-' + h.kind + '="' + h.i + '">' + ic('help') + esc(h.t) + '</button>'; }).join('') +
          r.chips.map(function (c) { return '<button class="uk-chip is-ask" data-uk-ask="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '') + '</div>';
    }).join('');
    chat.scrollTop = chat.scrollHeight;
  }

  /* ---------- Su mundo en 3D ---------- */
  function escena() {
    var el = host && host.querySelector('.uk-scene .b3d'), s = resumen();
    if (!el || !view.classList.contains('active') || view.classList.contains('uk-fin')) return;
    import(ASSET + 'bosque3d.js').then(function (m3) {
      if (!m3.supported()) return;
      b3d = m3; var c = window.Clima && Clima.last(); if (c) m3.setLook(c.look);
      if (s) { m3.setBloom(s.bloom); m3.setMood(s.mood); }
      m3.attach(el, { score: s ? s.score : 60, onTap: function () { fx('select'); m3.play('happy'); gi++; pintarGlobo(); } });
      el.classList.add('is-3d');
      if (!escena.hola) { escena.hola = 1; m3.play('wave'); }
    }).catch(function () {});
  }

  /* ---------- Acciones ---------- */
  function libre() { root.classList.toggle('uk-idle', view.classList.contains('active') && !view.classList.contains('uk-fin')); }
  function finOn(on) {
    view.classList.toggle('uk-fin', !!on); libre();
    if (window.AppScroll) AppScroll.to({ top: 0 }); else window.scrollTo(0, 0);
    if (on) { if (window.PFM) PFM.paint(); } else setTimeout(escena, 60);
  }
  function onClick(e) {
    var b = e.target.closest('[data-uk], [data-uk-ask], [data-uk-act], [data-uk-pfm], [data-uk-faq], [data-uk-tut]');
    if (!b || !view.contains(b)) return;
    var d = b.dataset;
    if (d.ukAsk != null) return enviar(d.ukAsk);
    if (d.ukAct != null) { var a = accion(d.ukAct); if (a && window.Buscador) Buscador.run(a); return; }
    if (d.ukPfm != null) { if (window.PFM) PFM.key(d.ukPfm); return; }
    if (d.ukFaq != null) return window.Soporte && Soporte.openFaq(+d.ukFaq);
    if (d.ukTut != null) return window.Soporte && Soporte.openTut(+d.ukTut);
    switch (d.uk) {
      case 'fin': fx('select'); return finOn(true);
      case 'home': fx('tap'); finOn(false); return pintar();
      case 'help': return window.Soporte && Soporte.open();
      case 'nueva': msgs = []; input.value = ''; fx('tap'); return pintar();
      case 'salir': location.href = location.pathname.replace(/asistente\.html$/, 'index.html'); return;
    }
  }
  // Un solo punto de entrada: la lupa y la ayuda llevan a Uku (antes que el buscador y el soporte)
  function irAUku(focus) {
    if (window.Buscador) Buscador.close(true);
    if (window.__goView) window.__goView(1);
    finOn(false); pintar();
    if (focus) setTimeout(function () { input.focus(); }, 380);
  }
  window.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action="Buscar"], [data-action="Soporte"], [data-action="Ayuda"]');
    if (!b || (host && host.contains(b)) || b.closest('.sp, .sp-page, .as-sheet')) return;
    e.stopImmediatePropagation(); e.preventDefault(); fx('open');
    irAUku(b.dataset.action === 'Buscar');
  }, true);

  function init() {
    mount(); if (!host) return;
    // La pestaña Mis finanzas pasa a ser Uku
    var nav = document.querySelector('.nav-item[data-view="1"]');
    if (nav) {
      nav.querySelector('.nav-item__label').textContent = 'Uku';
      nav.querySelector('.nav-item__wrap').innerHTML = '<span class="uk-navface">' + face() + '</span>';
      nav.addEventListener('click', function () { finOn(false); setTimeout(pintar, 50); });
    }
    // Arriba, un solo acceso: Uku en lugar de la lupa y los audífonos
    var lupa = document.querySelector('.top-bar__actions [data-action="Buscar"]');
    if (lupa) { lupa.setAttribute('aria-label', 'Uku'); lupa.innerHTML = '<span class="uk-topface">' + face() + '</span>'; }
    // Lo que abre Mis finanzas desde otros lugares lleva al PFM completo, dentro de Uku
    if (window.PFM) { var o = PFM.open; PFM.open = function () { finOn(true); o(); }; }
    // La pantalla de Uku cabe entre la barra de arriba y la de abajo: sin scroll
    var navBar = document.querySelector('.nav-bar');
    function medir() { if (navBar) root.style.setProperty('--uk-nav', navBar.getBoundingClientRect().height + 'px'); }
    medir(); window.addEventListener('resize', medir);
    var tt = document.querySelector('.top-bar__title');
    function titulo() { if (!tt) return; var t = view.classList.contains('active') ? (view.classList.contains('uk-fin') ? 'Mis finanzas' : 'Uku') : null; if (t && tt.textContent !== t) tt.textContent = t; }
    new MutationObserver(function () {
      root.classList.toggle('uk-here', view.classList.contains('active')); libre(); titulo();
      if (view.classList.contains('active') && !view.classList.contains('uk-fin')) { window.scrollTo(0, 0); setTimeout(escena, 120); } // después del PFM, que también usa la escena
    }).observe(view, { attributes: true, attributeFilter: ['class'] });
    if (tt) new MutationObserver(titulo).observe(tt, { childList: true, characterData: true, subtree: true });
    (function esperar(n) { if (window.PFM && PFM.ready()) return pintar(); if (n < 60) setTimeout(function () { esperar(n + 1); }, 150); })(0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
