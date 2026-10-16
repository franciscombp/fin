/* =====================================================================
   Versión asistente (paralela): un solo punto de entrada para buscar,
   pedir ayuda y entender tus finanzas, con Uku.
   - Se activa con asistente.html o index.html?app=uku. La app actual
     queda igual: este archivo no hace nada sin ese parámetro.
   - "Mis finanzas" en la barra inferior pasa a ser Uku. La lupa y la
     ayuda de arriba llevan a Uku; el PFM completo se abre desde aquí.
   - Un campo: lo que escribes busca acciones de la app, respuestas de
     tus finanzas y la ayuda; al enviarlo, Uku te responde en la misma
     pantalla y te lleva a hacerlo.
   Reusa: Buscador (acciones), Soporte (ayuda), PFM (finanzas y consejos).
   ===================================================================== */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('app') !== 'uku') return;
  var root = document.documentElement;
  root.classList.add('app-uku');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function money(v) { return '$ ' + Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function money0(v) { return money(v).replace(/,00$/, ''); }
  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function face() { return window.Asistente ? Asistente.faceIMG() : ''; }
  function ic(n) { return '<span class="material-symbols-rounded" aria-hidden="true">' + n + '</span>'; }

  var view, host, zone, thread, input, msgs = [];

  // Lo que se le puede pedir a Uku sin escribir
  var PRUEBA = ['¿En qué se me va la plata?', 'Transferir', '¿Cuánto debo?', 'Pagar servicios', 'Bloquear mi tarjeta', '¿Cómo pago con Deuna?'];
  var RAPIDO = ['Transferir', 'Pagar con QR', 'Pagar servicios', 'Recargar celular'];

  function acciones(q) { return window.Buscador && Buscador.rank ? Buscador.rank(q) : []; }
  function accion(label) { return window.Buscador && Buscador.actions ? Buscador.actions().filter(function (a) { return a.label === label; })[0] : null; }
  function ayuda(q, n) { return window.Soporte && Soporte.find ? Soporte.find(q, n || 3) : []; }
  // Las cifras solo cuando preguntas por tu plata; "perdí mi tarjeta" es ayuda, no deuda
  var HACER = /perd|bloque|rob|clave|contrase|pin\b|transfer|recarg|pagar con|cobrar|retirar|enviar|mandar|activar|cancel|cambiar|reclam|como (uso|pago|hago|activo|cambio)/;
  var PLATA = /cuant|gast|deb|deuda|plata|dinero|ingres|sueldo|pension|remesa|presupuesto|ahorr|cierr|ritmo|revis|pregunt|queda/;
  function finanzas(q) { var n = norm(q); if (HACER.test(n) || !PLATA.test(n)) return null; try { return window.PFM && PFM.ready() ? PFM.answer(q) : null; } catch (e) { return null; } }

  /* ---------- La pantalla ---------- */
  function mount() {
    view = document.querySelector('.view[data-view="1"]');
    if (!view || host) return;
    host = document.createElement('div'); host.className = 'uk';
    view.insertBefore(host, view.firstChild);
    var back = document.createElement('button'); back.className = 'uk-back'; back.setAttribute('data-uk', 'home');
    back.innerHTML = ic('arrow_back') + 'Uku';
    view.insertBefore(back, host.nextSibling);
    host.innerHTML = '<div class="uk-hello"><span class="uk-hello__face" aria-hidden="true">' + face() + '</span><div><p class="uk-hello__t"></p><p class="uk-hello__s">Busca, pregunta o pide lo que necesites: tu plata, la app o ayuda.</p></div></div>' +
      '<form class="uk-field" role="search"><span class="material-symbols-rounded" aria-hidden="true">search</span>' +
        '<input type="text" enterkeyhint="send" autocomplete="off" placeholder="Busca, pregunta o pide algo" aria-label="Busca, pregunta o pide algo">' +
        '<button class="uk-send" type="submit" aria-label="Enviar">' + ic('arrow_upward') + '</button></form>' +
      '<div class="uk-thread" aria-live="polite"></div><div class="uk-zone"></div>' +
      '<p class="uk-foot">Versión asistente · <button data-uk="salir">Volver a la versión actual</button></p>';
    zone = host.querySelector('.uk-zone'); thread = host.querySelector('.uk-thread'); input = host.querySelector('input');
    host.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); enviar(input.value); });
    input.addEventListener('input', function () { host.classList.toggle('is-typing', !!input.value.trim()); pintarZona(); });
    view.addEventListener('click', onClick);
    document.addEventListener('pfm:change', function () { if (!input.value.trim()) pintarZona(); });
    pintar();
  }
  function pintar() {
    var s = window.PFM && PFM.summary && PFM.summary();
    host.querySelector('.uk-hello__t').textContent = s ? 'Hola, ' + s.nombre : 'Hola';
    pintarHilo(); pintarZona();
  }

  /* Sin escribir: lo que Uku te propone, tus finanzas en corto, accesos y ayuda */
  function inicio() {
    var s = window.PFM && PFM.summary && PFM.summary(), A = (window.PFM && PFM.advice ? PFM.advice() : []).filter(function (x) { return !x.done; });
    var top = A[0], html = '';
    if (top) html += '<div class="uk-say"><span class="uk-say__face" aria-hidden="true">' + face() + '</span><div class="uk-say__body"><p class="uk-say__bubble">' + esc(top.di || top.t) + '</p>' +
      (top.act ? '<button class="pf-cta uk-say__go" data-uk-pfm="' + esc(top.act) + '">' + esc(top.actl) + '</button>' : '') + '</div></div>';
    html += '<div class="uk-chips">' + PRUEBA.map(function (q) { return '<button class="pf-catchip" data-uk-ask="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>';
    if (A.length > 1) html += '<section class="uk-sec"><div class="pf-sec__head"><h2>Te propongo</h2></div>' + A.slice(1, 4).map(consejo).join('') + '</section>';
    if (s) {
      var u = s.pres ? s.gast / s.pres : 0;
      html += '<section class="uk-sec"><div class="pf-sec__head"><h2>Tus finanzas</h2><button class="section__link" data-uk="fin">Ver todo</button></div>' +
        '<button class="uk-money" data-uk="fin"><span class="uk-money__l">Saldo disponible</span><b>' + money(s.saldo) + '</b>' +
        '<span class="uk-money__bar"><i style="width:' + Math.min(100, u * 100).toFixed(1) + '%"' + (u > 1 ? ' class="is-over"' : '') + '></i></span>' +
        '<span class="uk-money__s">En ' + esc(s.mes) + ' llevas ' + money0(s.gast) + ' de ' + money0(s.pres) + ' de presupuesto</span>' +
        '<span class="uk-money__mood">' + ic(s.moodIc) + 'Uku está ' + esc(s.moodL) + (s.n ? ' · ' + s.n + ' consumos por ordenar' : '') + '</span></button></section>';
    }
    html += '<section class="uk-sec"><div class="pf-sec__head"><h2>Hacer ahora</h2></div><div class="uk-quick">' + RAPIDO.map(function (l) {
      var a = accion(l); return a ? '<button class="uk-quick__b" data-uk-act="' + esc(l) + '"><span class="uk-quick__ic">' + ic(a.icon) + '</span><span>' + esc(l) + '</span></button>' : ''; }).join('') + '</div></section>';
    var F = window.Soporte && Soporte.faqs ? Soporte.faqs(3) : [];
    html += '<section class="uk-sec"><div class="pf-sec__head"><h2>Ayuda</h2><button class="section__link" data-uk="help">Centro de ayuda</button></div><div class="pf-mcard uk-list">' +
      F.map(function (f) { return fila('data-uk-faq="' + f.i + '"', f.icon || 'help', f.t, ''); }).join('') +
      fila('data-uk="help"', 'support_agent', 'Hablar con una persona', 'Chat, llamada o agencia') + '</div></section>';
    return html;
  }
  function consejo(x) {
    return '<article class="pfm-tip is-' + (x.kind || 'info') + '"><p class="pfm-tip__tag">' + ic(x.icon) + esc(x.tag) + '</p><p class="pfm-tip__t">' + esc(x.t) + '</p>' +
      (x.s ? '<p class="pfm-tip__s">' + esc(x.s) + '</p>' : '') + '<div class="pfm-tip__acts">' +
      (x.act ? '<button class="pf-link" data-uk-pfm="' + esc(x.act) + '">' + esc(x.actl) + '</button>' : '') +
      '<button class="section__link" data-uk-pfm="luego:' + esc(x.id) + '">Ahora no</button></div></article>';
  }
  function fila(attr, icon, t, s) {
    return '<button class="uk-row" ' + attr + '><span class="uk-row__ic">' + ic(icon) + '</span><span class="uk-row__t"><b>' + esc(t) + '</b>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</span>' + ic('chevron_right') + '</button>';
  }

  /* Escribiendo: todo lo que coincide, en un solo lugar */
  function resultados(q) {
    var acts = acciones(q).slice(0, 4), fin = finanzas(q), H = ayuda(q, 3), html = '';
    html += '<div class="pf-mcard uk-list">' + fila('data-uk-ask="' + esc(q) + '"', 'auto_awesome', 'Preguntarle a Uku', '“' + q + '”') + '</div>';
    if (fin) html += '<section class="uk-sec is-tight"><p class="uk-sec__l">Tus finanzas</p><button class="uk-ans" data-uk-ask="' + esc(q) + '"><span class="uk-ans__face">' + face() + '</span><span>' + texto(fin.t) + '</span></button></section>';
    if (acts.length) html += '<section class="uk-sec is-tight"><p class="uk-sec__l">Hacer</p><div class="pf-mcard uk-list">' + acts.map(function (a) { return fila('data-uk-act="' + esc(a.label) + '"', a.icon, a.label, ''); }).join('') + '</div></section>';
    if (H.length) html += '<section class="uk-sec is-tight"><p class="uk-sec__l">Ayuda</p><div class="pf-mcard uk-list">' + H.map(function (h) { return fila('data-uk-' + h.kind + '="' + h.i + '"', h.icon || 'help', h.t, h.kind === 'tut' ? 'Tutorial' : ''); }).join('') + '</div></section>';
    if (!fin && !acts.length && !H.length) html += '<p class="pf-note">No encontré nada con eso en la app ni en la ayuda. Pregúntale a Uku y te ayuda a encontrarlo.</p>';
    return html;
  }
  function texto(t) { return String(t || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ''); }
  function pintarZona() {
    var q = input.value.trim();
    zone.innerHTML = q ? resultados(q) : msgs.length ? '<button class="pf-link pf-link--block" data-uk="nueva">' + ic('refresh') + 'Nueva conversación</button>' : inicio();
  }

  /* ---------- Conversación ---------- */
  // Uku responde con lo que sabe: tus finanzas, una acción de la app o la ayuda
  function responder(q) {
    var fin = finanzas(q), acts = acciones(q).slice(0, 2), H = ayuda(q, 3), r = { t: '', acts: acts, help: [], chips: [] };
    if (fin) { r.t = fin.t; r.chips = (fin.s || []).slice(0, 3); r.acts = []; }
    else if (acts.length) r.t = acts.length === 1 ? 'Te llevo a ' + acts[0].label.toLowerCase() + '. ¿Lo hacemos?' : 'Esto es lo que encontré para hacerlo:';
    else if (H.length) r.t = 'Esto te puede ayudar:';
    else { r.t = 'Todavía no sé eso. Puedo contarte de tu plata, llevarte a hacer algo en la app o buscar en la ayuda.'; r.chips = PRUEBA.slice(0, 3); }
    if (!fin) r.help = H;
    return r;
  }
  function enviar(q) {
    q = String(q || '').trim(); if (!q) return;
    msgs.push({ me: q }, { uku: responder(q) });
    input.value = ''; host.classList.remove('is-typing'); fx('select');
    pintarHilo(); pintarZona();
    var last = thread.lastElementChild; if (last) last.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function pintarHilo() {
    thread.innerHTML = msgs.map(function (m) {
      if (m.me) return '<div class="uk-me"><p>' + esc(m.me) + '</p></div>';
      var r = m.uku;
      return '<div class="uk-say is-reply"><span class="uk-say__face" aria-hidden="true">' + face() + '</span><div class="uk-say__body"><p class="uk-say__bubble">' + r.t + '</p>' +
        (r.acts.length ? '<div class="uk-say__acts">' + r.acts.map(function (a) { return '<button class="pf-link" data-uk-act="' + esc(a.label) + '">' + ic(a.icon) + esc(a.label) + '</button>'; }).join('') + '</div>' : '') +
        (r.help.length ? '<div class="pf-mcard uk-list">' + r.help.map(function (h) { return fila('data-uk-' + h.kind + '="' + h.i + '"', h.icon || 'help', h.t, h.kind === 'tut' ? 'Tutorial' : 'Pregunta frecuente'); }).join('') + '</div>' : '') +
        (r.chips.length ? '<div class="uk-chips">' + r.chips.map(function (c) { return '<button class="pf-catchip" data-uk-ask="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '') + '</div></div>';
    }).join('');
  }

  /* ---------- Acciones ---------- */
  function finOn(on) { view.classList.toggle('uk-fin', !!on); if (window.AppScroll) AppScroll.to({ top: 0 }); else window.scrollTo(0, 0); }
  function onClick(e) {
    var b = e.target.closest('[data-uk], [data-uk-ask], [data-uk-act], [data-uk-pfm], [data-uk-faq], [data-uk-tut]');
    if (!b || !view.contains(b)) return;
    var d = b.dataset;
    if (d.ukAsk != null) return enviar(d.ukAsk);
    if (d.ukAct != null) { var a = accion(d.ukAct); if (a && window.Buscador) Buscador.run(a); return; }
    if (d.ukPfm != null) { if (window.PFM) PFM.key(d.ukPfm); setTimeout(pintarZona, 350); return; }
    if (d.ukFaq != null) return window.Soporte && Soporte.openFaq(+d.ukFaq);
    if (d.ukTut != null) return window.Soporte && Soporte.openTut(+d.ukTut);
    switch (d.uk) {
      case 'fin': fx('select'); return finOn(true);
      case 'home': fx('tap'); finOn(false); return pintar();
      case 'help': return window.Soporte && Soporte.open();
      case 'nueva': msgs = []; fx('tap'); return pintar();
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
      var w = nav.querySelector('.nav-item__wrap'); w.innerHTML = '<span class="uk-navface">' + face() + '</span>';
      nav.addEventListener('click', function () { finOn(false); setTimeout(pintar, 50); });
    }
    // Arriba, un solo acceso: Uku en lugar de la lupa y los audífonos
    var lupa = document.querySelector('.top-bar__actions [data-action="Buscar"]');
    if (lupa) { lupa.setAttribute('aria-label', 'Uku'); lupa.innerHTML = '<span class="uk-topface">' + face() + '</span>'; }
    // Lo que abre Mis finanzas desde otros lugares lleva al PFM completo, dentro de Uku
    if (window.PFM) { var o = PFM.open; PFM.open = function () { finOn(true); o(); }; }
    new MutationObserver(function () { root.classList.toggle('uk-here', view.classList.contains('active')); titulo(); }).observe(view, { attributes: true, attributeFilter: ['class'] });
    var tt = document.querySelector('.top-bar__title');
    function titulo() { if (!tt) return; var t = view.classList.contains('active') ? (view.classList.contains('uk-fin') ? 'Mis finanzas' : 'Uku') : null; if (t && tt.textContent !== t) tt.textContent = t; }
    if (tt) new MutationObserver(titulo).observe(tt, { childList: true, characterData: true, subtree: true });
    // Cuando cargan los datos del PFM, se ve el saludo y lo que propone Uku
    (function esperar(n) { if (window.PFM && PFM.ready()) return pintar(); if (n < 60) setTimeout(function () { esperar(n + 1); }, 150); })(0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
