/* =====================================================================
   Versión asistente (paralela): Uku es la pantalla. Un solo punto de
   entrada para buscar, pedir ayuda y entender tus finanzas.
   - Es la versión principal: se activa siempre. La versión anterior
     (Mis finanzas, buscador y ayuda por separado) queda de respaldo en
     clasica.html o index.html?app=clasica, y ahí este archivo no hace nada.
   - Todo cabe en una pantalla, sin scroll: Uku en su mundo 3D, su globo
     con lo más importante, los accesos y la barra para hablarle.
   - Una sola conversación: Uku responde tus finanzas, la ayuda (preguntas
     frecuentes y tutoriales, con "¿Te sirvió?" y el paso a una persona)
     y te lleva a hacer las cosas. Cuando sales a hacer algo, al volver te
     pregunta si lo lograste; si algo cambió, te lo confirma.
   Reusa: Buscador (acciones), Soporte (ayuda), PFM (finanzas y consejos)
   y bosque3d (el mundo de Uku).
   ===================================================================== */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('app') === 'clasica') return;
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

  var view, host, globoEl, pills, results, chat, input, b3d = null;
  var msgs = [], gi = 0, nota = null, ultimo = 0;
  var pend = null; // lo que saliste a hacer: al volver, Uku pregunta cómo te fue

  var PRUEBA = ['¿En qué se me va la plata?', '¿Cuánto debo?', 'Bloquear mi tarjeta', 'Transferir'];
  function acciones(q) { return window.Buscador && Buscador.rank ? Buscador.rank(q) : []; }
  function accion(label) { return window.Buscador && Buscador.actions ? Buscador.actions().filter(function (a) { return a.label === label; })[0] : null; }
  function ayuda(q, n) { return window.Soporte && Soporte.find ? Soporte.find(q, n || 3) : []; }
  // Las cifras solo cuando preguntas por tu plata; "perdí mi tarjeta" es ayuda, no deuda
  var HACER = /perd|bloque|rob|clave|contrase|pin\b|transfer|recarg|pagar con|cobrar|retirar|enviar|mandar|activar|cancel|cambiar|reclam|reconozco|como (uso|pago|hago|activo|cambio)/;
  var PLATA = /cuant|gast|deb|deuda|plata|dinero|ingres|sueldo|pension|remesa|presupuesto|ahorr|cierr|ritmo|revis|pregunt|queda/;
  function finanzas(q) { var n = norm(q); if (HACER.test(n) || !PLATA.test(n)) return null; try { return window.PFM && PFM.ready() ? PFM.answer(q) : null; } catch (e) { return null; } }
  var PREG = /^(como|cuanto|cuando|que|por que|donde|puedo|se puede)|\?|no (puedo|reconozco|me |funciona)|perd|rob|olvid/;
  function resumen() { return window.PFM && PFM.summary ? PFM.summary() : null; }
  function consejos() { return (window.PFM && PFM.advice ? PFM.advice() : []).filter(function (x) { return !x.done; }); }

  /* ---------- La pantalla: Uku y su mundo ---------- */
  function mount() {
    view = document.querySelector('.view[data-view="1"]');
    if (!view || host) return;
    host = document.createElement('div'); host.className = 'uk';
    view.insertBefore(host, view.firstChild);
    var back = document.createElement('button'); back.className = 'uk-back'; back.setAttribute('data-k', 'home'); back.setAttribute('aria-label', 'Volver a Uku');
    back.innerHTML = ic('keyboard_arrow_down');
    view.insertBefore(back, host.nextSibling);
    host.innerHTML =
      '<div class="uk-scene"><div class="b3d" data-shift=".22"><div class="b3d__fallback">' + (window.Asistente ? Asistente.petSVG() : '') + '</div></div></div>' +
      // Al conversar, su mundo se desvanece detrás de un fondo limpio y arriba queda la cabecera del chat
      '<div class="uk-chatbg" aria-hidden="true"></div>' +
      '<header class="uk-chathead"><span class="uk-chathead__face" aria-hidden="true">' + face() + '</span><span class="uk-chathead__t"><b>Uku</b><small>Tu asesor · en línea</small></span>' +
        '<button class="uk-chathead__x" data-k="cerrar" aria-label="Terminar conversación">' + ic('close') + '</button></header>' +
      '<div class="uk-head"><p class="uk-head__t" role="heading" aria-level="1">Uku</p><div class="uk-head__acts"><button class="uk-head__mood" data-k="pfm:world"></button>' +
        '<button class="uk-head__set" data-k="ajustes" aria-label="Ajustes" aria-expanded="false">' + ic('settings') + '</button>' +
        '<div class="uk-menu" hidden><button data-k="demo">Ver como</button><button data-k="salir">Versión anterior</button></div></div></div>' +
      '<div class="uk-globo" aria-live="polite"></div>' +
      '<div class="uk-chat" aria-live="polite"></div>' +
      '<div class="uk-pills"></div>' +
      '<div class="uk-results"></div>' +
      '<form class="uk-bar" role="search"><button type="button" class="uk-bar__x" data-k="cerrar" aria-label="Terminar conversación">' + ic('close') + '</button>' +
        '<label class="uk-bar__f">' + ic('search') + '<input type="text" enterkeyhint="send" autocomplete="off" placeholder="Pregunta o pide algo" aria-label="Pregunta o pide algo"></label>' +
        '</form>' +
      '';
    globoEl = host.querySelector('.uk-globo'); pills = host.querySelector('.uk-pills'); results = host.querySelector('.uk-results'); chat = host.querySelector('.uk-chat'); input = host.querySelector('input');
    host.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); preguntar(input.value); });
    input.addEventListener('input', function () { modo(); pintarResultados(); });
    // En su mundo, el campo de abajo es el buscador (como deslizar desde arriba): responde o lleva a la acción.
    // En la conversación sigue siendo el campo para hablar con Uku.
    input.addEventListener('focus', function () { if (!msgs.length && window.Buscador) { input.blur(); Buscador.open(); } });
    view.addEventListener('click', onClick);
    document.addEventListener('pfm:change', function () { gi = 0; if (pend) pend.cambio = true; if (!msgs.length) pintar(); });
    pintar();
  }
  function modo() {
    var era = host.classList.contains('is-chat'), es = msgs.length > 0;
    host.classList.toggle('is-typing', !!input.value.trim());
    host.classList.toggle('is-chat', es);
    // En la conversación no hay barra superior ni inferior: el chat ocupa la pantalla
    document.documentElement.classList.toggle('uk-chatting', es && view.classList.contains('active'));
    if (era !== es) {
      input.placeholder = es ? 'Escríbele a Uku' : 'Habla con Uku o busca algo';
      if (!es && b3d) setTimeout(function () { b3d.play('wave'); setTimeout(function () { if (!msgs.length) b3d.play('walk'); }, 2200); }, 350); // vuelve a su mundo, saluda y camina
      if (es && b3d) b3d.play(null); // en la conversación se queda quieto
    }
  }
  function pintar() { modo(); pintarCabeza(); pintarGlobo(); pintarAccesos(); pintarChat(); pintarResultados(); }
  // Cabecera de la sección: el título grande y el ánimo de Uku (abre qué significa su mundo)
  function pintarCabeza() {
    var s = resumen(), m = host.querySelector('.uk-head__mood');
    m.hidden = !s; if (s) m.innerHTML = ic(s.moodIc) + 'Está ' + esc(s.moodL);
  }

  // Lo que dice Uku: una nota del momento o su consejo más importante (tocarlo a él pasa al siguiente)
  function pintarGlobo() {
    var A = consejos(), x = A.length ? A[gi % A.length] : null, s = resumen();
    var t = nota || (x ? x.di || x.t : s && !s.n ? '¡Todo en orden, ' + s.nombre + '! ¿En qué te ayudo hoy?' : 'Hola, soy Uku. ¿En qué te ayudo?');
    globoEl.innerHTML = '<p class="uk-globo__who">' + (s ? 'Hola, ' + esc(s.nombre) : 'Uku') + (!nota && A.length > 1 ? '<span>' + (gi % A.length + 1) + ' de ' + A.length + '</span>' : '') + '</p>' +
      '<p class="uk-globo__t">' + esc(t) + '</p>' +
      (!nota && x && x.act ? '<button class="pf-cta uk-globo__go" data-k="pfm:' + esc(x.act) + '" data-l="' + esc(x.actl) + '">' + esc(x.actl) + '</button>' : '');
    globoEl.classList.remove('is-new'); void globoEl.offsetWidth; globoEl.classList.add('is-new');
  }
  // Los accesos: Mis finanzas, ordenar, consejos y ayuda, a un toque desde Uku
  function pintarAccesos() {
    var s = resumen(), A = consejos(), p = function (k, icon, t, sub) { return '<button class="uk-pill" data-k="' + k + '" data-l="' + esc(t) + '">' + ic(icon) + '<span><b>' + esc(t) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>'; };
    pills.innerHTML = p('fin', 'monitoring', 'Mis finanzas', s ? 'Saldo ' + money0(s.saldo) : '') +
      p('sol', 'assignment', 'Solicitudes', 'Revisar o pedir algo') +
      (s && s.n ? p('pfm:game', 'category', 'Clasificar ' + Math.min(10, s.n), 'Uku está ' + s.moodL) : '') +
      (A.length > 1 ? p('pfm:insights', 'lightbulb', 'Tus consejos', A.length + ' para ti') : '') +
      p('ayuda', 'support_agent', 'Ayuda', 'Preguntas y contacto');
  }

  /* ---------- Escribiendo: resultados flotando sobre su mundo ---------- */
  function fila(k, icon, t, s) {
    return '<button class="uk-row" data-k="' + esc(k) + '" data-l="' + esc(t) + '"><span class="uk-row__ic">' + ic(icon) + '</span><span class="uk-row__t"><b>' + esc(t) + '</b>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</span>' + ic('chevron_right') + '</button>';
  }
  function texto(t) { return String(t || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ''); }
  function pintarResultados() {
    var q = input.value.trim();
    if (!q) { results.innerHTML = ''; return; }
    var acts = acciones(q).slice(0, 3), fin = finanzas(q), H = ayuda(q, 3), html = fila('ask:' + q, 'auto_awesome', 'Preguntarle a Uku', '“' + q + '”');
    if (fin) html += '<p class="uk-results__l">Tus finanzas</p><button class="uk-ans" data-k="ask:' + esc(q) + '">' + esc(texto(fin.t)) + '</button>';
    if (H.length) html += '<p class="uk-results__l">Ayuda</p>' + H.map(function (h) { return fila(h.kind + ':' + h.i, h.icon || 'help', h.t, h.kind === 'tut' ? 'Tutorial' : 'Uku te lo explica'); }).join('');
    if (acts.length) html += '<p class="uk-results__l">Hacer</p>' + acts.map(function (a) { return fila('act:' + a.label, a.icon, a.label, ''); }).join('');
    results.innerHTML = html;
  }

  /* ---------- La conversación ----------
     Cada mensaje de Uku trae sus botones; solo los del último se pueden
     tocar, así la conversación avanza y no quedan preguntas viejas abiertas. */
  function me(t) { msgs.push({ me: t }); }
  function uku(t, btns, extra) { msgs.push({ uku: t, btns: btns || [], extra: extra || '', nuevo: true }); ultimo = Date.now(); }
  function b(k, t, icon, cls) { return { k: k, t: t, ic: icon, cls: cls }; }
  function mostrar() { input.value = ''; modo(); pintarChat(); pintarResultados(); }
  // Lo que escribes: tu plata, la ayuda o una acción de la app
  function preguntar(q) {
    q = String(q || '').trim(); if (!q) return;
    me(q); input.blur(); fx('select'); if (b3d) b3d.play('nod');
    var fin = finanzas(q), acts = acciones(q).slice(0, 2), H = ayuda(q, 3);
    if (fin) uku(fin.t, (fin.s || []).slice(0, 2).map(function (c) { return b('ask:' + c, c, null, 'is-ask'); }));
    // Si preguntas cómo, cuánto o qué, primero la ayuda; si pides hacer algo, primero la acción
    else if (H.length && (!acts.length || PREG.test(norm(q)))) return ayudaEn(H[0], H.slice(1), acts);
    else if (acts.length) uku(acts.length === 1 ? 'Te llevo a ' + acts[0].label.toLowerCase() + '. ¿Lo hacemos?' : 'Puedo llevarte a hacerlo:', acts.map(function (a) { return b('act:' + a.label, a.label, a.icon); }).concat(H.slice(0, 1).map(function (h) { return b(h.kind + ':' + h.i, h.t, 'help', 'is-ask'); })));
    else uku('Todavía no sé eso. Puedo contarte de tu plata, llevarte a hacer algo o pasarte con una persona del banco.', PRUEBA.slice(0, 2).map(function (c) { return b('ask:' + c, c, null, 'is-ask'); }).concat([b('persona', 'Hablar con una persona', 'support_agent')]));
    mostrar();
  }
  // Una pregunta frecuente o un tutorial, respondido por Uku aquí mismo
  function ayudaEn(h, otras, acts) {
    if (h.kind === 'tut') {
      var u = Soporte.tut(h.i);
      uku('Así se hace, en ' + (u.min || 1) + ' minuto' + ((u.min || 1) > 1 ? 's' : '') + ':', (u.act ? [b('sp:' + u.act[1], u.act[0], 'arrow_forward')] : []).concat([b('ok', 'Listo, gracias', 'thumb_up', 'is-ask'), b('no', 'No me sirvió', null, 'is-ask')]),
        '<ol class="uk-steps">' + u.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>');
    } else {
      var f = Soporte.faq(h.i);
      // La respuesta, lo que puedes hacer con ella y "¿Te sirvió?", en un solo mensaje
      uku(esc(f.a) + '<span class="uk-msg__q">¿Te sirvió?</span>', f.acts.map(function (a) { return b('sp:' + a[1], a[0], 'arrow_forward'); })
        .concat([b('ok', 'Sí, gracias', 'thumb_up', 'is-ask'), b('no', 'No, es otra cosa', null, 'is-ask'), b('persona', 'Hablar con una persona', 'support_agent', 'is-ask')]));
    }
    mostrar();
  }
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, escribe = null;
  function pintarChat() {
    // Lo nuevo de Uku aparece después de un "escribiendo…" corto, como en una conversación de verdad
    var nuevo = -1; msgs.forEach(function (m, i) { if (m.uku != null && m.nuevo && nuevo < 0) nuevo = i; });
    if (nuevo >= 0 && !RM) {
      if (!escribe) escribe = setTimeout(function () { escribe = null; msgs.forEach(function (m) { m.nuevo = false; }); pintarChat(); if (b3d) b3d.play('nod'); }, 650);
    } else { msgs.forEach(function (m) { m.nuevo = false; }); nuevo = -1; }
    var vis = nuevo >= 0 ? msgs.slice(0, nuevo) : msgs, last = -1;
    vis.forEach(function (m, i) { if (m.uku != null) last = i; });
    chat.innerHTML = vis.map(function (m, i) {
      if (m.me) return '<div class="uk-me' + (m.visto ? ' is-seen' : '') + '"><p>' + esc(m.me) + '</p></div>';
      var on = i === last, cara = i === 0 || vis[i - 1].uku == null;
      return '<div class="uk-msg' + (on ? '' : ' is-old') + (m.visto ? ' is-seen' : '') + '">' + (cara ? '<span class="uk-msg__face" aria-hidden="true">' + face() + '</span>' : '<span class="uk-msg__face is-gap"></span>') +
        '<div class="uk-msg__body"><p class="uk-msg__b">' + m.uku + '</p>' + m.extra +
        (on && m.btns.length && nuevo < 0 ? '<div class="uk-msg__acts">' + m.btns.map(function (x, j) { return '<button class="uk-chip ' + (x.cls || '') + '" style="--d:' + j * 50 + 'ms" data-k="' + esc(x.k) + '" data-l="' + esc(x.t) + '">' + (x.ic ? ic(x.ic) : '') + esc(x.t) + '</button>'; }).join('') + '</div>' : '') + '</div></div>';
    }).join('') +
      (nuevo >= 0 ? '<div class="uk-msg is-typing"><span class="uk-msg__face" aria-hidden="true">' + face() + '</span><div class="uk-msg__body"><p class="uk-msg__b uk-dots" aria-label="Uku está escribiendo"><i></i><i></i><i></i></p></div></div>' : '');
    msgs.forEach(function (m, i) { if (i < vis.length) m.visto = true; }); // lo ya visto no vuelve a animarse
    modo();
    requestAnimationFrame(function () { chat.scrollTo({ top: chat.scrollHeight, behavior: RM ? 'auto' : 'smooth' }); });
  }
  // Se resolvió: Uku lo celebra, cierra la conversación y vuelve a su mundo
  function resuelto(t) {
    uku(t || '¡Qué bueno! Aquí estoy si necesitas algo más.'); pintarChat(); fx('success'); if (b3d) b3d.play('happy');
    setTimeout(function () { msgs = []; nota = '¡Listo! ¿Te ayudo con algo más?'; pintar(); setTimeout(function () { nota = null; if (!msgs.length) pintarGlobo(); }, 6000); }, RM ? 1600 : 2300);
  }
  // Pasar con una persona, sin salir de Uku
  function persona() {
    var c = Soporte.contact();
    uku('Te paso con una persona del banco. Le cuento lo que ya hablamos para que no tengas que repetirlo. ¿Cómo prefieres?', c.opts.map(function (o) { return b(o.k, o.t, o.icon); }));
  }

  /* ---------- Salir a hacer algo y volver ----------
     Antes de ir a una acción, Uku recuerda qué fuiste a hacer. Cuando
     vuelves a su pantalla (cerraste la hoja, el juego o regresaste desde
     otra sección), te confirma lo que cambió o te pregunta si lo lograste. */
  var CAPAS = '.sp.open, .pfm-game.open, .as-sheet.open, .push-page.open, .as-page.open, .card-detail.open, .sx.open, .ai-page.open';
  function salir(label, decir) {
    pend = { l: label, fuera: false, cambio: false, t: Date.now() };
    if (decir && msgs.length) { uku('Te llevo a ' + esc(label.toLowerCase()) + '. Cuando vuelvas, me cuentas cómo te fue.'); pintarChat(); }
  }
  function enUku() { return view.classList.contains('active') && !view.classList.contains('uk-fin') && !document.querySelector(CAPAS); }
  setInterval(function () {
    if (!pend || !host) return;
    if (!enUku()) { pend.fuera = true; return; }
    if (!pend.fuera) { if (Date.now() - pend.t > 2500) pend = null; return; } // no se abrió nada
    var p = pend; pend = null;
    if (p.cambio) { uku('¡Listo, ya quedó! ¿Te ayudo con algo más?', [b('ok', 'No, eso es todo', 'thumb_up', 'is-ask'), b('consejo', 'Qué más me propones', 'lightbulb', 'is-ask')]); if (b3d) b3d.play('happy'); }
    else uku('¿Pudiste ' + esc(p.l.toLowerCase()) + '?', [b('ok', 'Sí, listo', 'thumb_up', 'is-ask'), b('no', 'No, ayúdame', null, 'is-ask')]);
    pintar(); fx('tap');
  }, 500);

  /* ---------- Su mundo en 3D ---------- */
  function escena() {
    var el = host && host.querySelector('.uk-scene .b3d'), s = resumen();
    if (!el || !view.classList.contains('active') || view.classList.contains('uk-fin')) return;
    import(ASSET + 'bosque3d.js').then(function (m3) {
      if (!m3.supported()) return;
      b3d = m3; var c = window.Clima && Clima.last(); if (c) m3.setLook(c.look);
      if (s) { m3.setBloom(s.bloom); m3.setMood(s.mood); }
      m3.attach(el, { score: s ? s.score : 60, onTap: function () { fx('select'); m3.play('happy'); if (!msgs.length) { nota = null; gi++; pintarGlobo(); } } });
      el.classList.add('is-3d');
      if (!escena.hola) { escena.hola = 1; m3.play('wave'); setTimeout(function () { if (!msgs.length) m3.play('walk'); }, 2200); }
    }).catch(function () {});
  }

  /* ---------- Toques ---------- */
  function libre() { root.classList.toggle('uk-idle', view.classList.contains('active') && !view.classList.contains('uk-fin')); }
  function finOn(on) {
    view.classList.toggle('uk-fin', !!on); libre();
    if (window.AppScroll) AppScroll.to({ top: 0 }); else window.scrollTo(0, 0);
    if (on) { if (window.PFM) PFM.paint(); } else setTimeout(escena, 60);
  }
  /* ---------- Solicitudes dentro del mundo de Uku ----------
     Lo que se puede pedir o revisar, a un toque; la búsqueda es la universal (contexto: solicitudes). */
  var solSec = null;
  function solRows() {
    var rows = [row('rev', 'receipt_long', 'Revisar un consumo que no reconoces', 'Pedimos la revisión por ti')];
    ['Préstamos', 'Mis tarjetas', 'Seguridad'].forEach(function (l) { var a = accion(l); if (a) rows.push(row('act:' + l, a.icon, l, 'Pedir o revisar')); });
    rows.push(row('persona', 'support_agent', 'Hablar con una persona', 'Le cuento a Uku lo que pasó'));
    return rows.join('');
  }
  function row(s, icon, t, sub) { return '<button class="uk-sec__row" data-s="' + esc(s) + '">' + ic(icon) + '<span><b>' + esc(t) + '</b><small>' + esc(sub) + '</small></span></button>'; }
  function abrirSol() {
    if (!solSec) {
      solSec = document.createElement('section'); solSec.className = 'uk-sec'; solSec.hidden = true; solSec.setAttribute('aria-label', 'Solicitudes');
      solSec.innerHTML = '<div class="uk-sec__top"><button class="uk-sec__back" data-s="back" aria-label="Volver">' + ic('arrow_back') + '</button><p class="uk-sec__t">Solicitudes</p>' +
        '<button class="uk-sec__back uk-sec__find" data-s="buscar" aria-label="Buscar">' + ic('search') + '</button></div>' +
        '<div class="uk-sec__body">' + '<p class="uk-sec__l">Lo que puedes pedir</p>' + solRows() + '</div>';
      host.appendChild(solSec);
      solSec.addEventListener('click', function (e) {
        var b = e.target.closest('[data-s]'); if (!b) return;
        var v = b.dataset.s, i = v.indexOf(':'), k = i < 0 ? v : v.slice(0, i), x = i < 0 ? '' : v.slice(i + 1);
        fx('tap');
        if (k === 'back') { solSec.hidden = true; host.classList.remove('uk-in-sec'); return; }
        if (k === 'buscar') return window.Buscador && Buscador.open('solicitudes');
        if (k === 'rev') return window.Soporte && Soporte.review();
        if (k === 'persona') { solSec.hidden = true; host.classList.remove('uk-in-sec'); persona(); return pintarChat(); }
        if (k === 'act') { var a = accion(x); if (a && window.Buscador) { solSec.hidden = true; host.classList.remove('uk-in-sec'); Buscador.run(a); } }
      });
    }
    solSec.hidden = false; host.classList.add('uk-in-sec'); fx('open');
  }
  function onClick(e) {
    var el = e.target.closest('[data-k]');
    if (!el || !view.contains(el)) return;
    var k = el.dataset.k, l = el.dataset.l || el.textContent.trim(), i = k.indexOf(':'), kind = i < 0 ? k : k.slice(0, i), v = i < 0 ? '' : k.slice(i + 1);
    // Lo que se toca en la conversación queda como tu respuesta
    var enChat = chat.contains(el) && !/^(ask)$/.test(kind);
    if (enChat) me(l);
    switch (kind) {
      case 'ask': return preguntar(v);
      case 'faq': case 'tut': if (!enChat) me(l); return ayudaEn({ kind: kind, i: +v });
      case 'act': { var a = accion(v); if (!a) return; salir(a.label, true); return window.Buscador && Buscador.run(a); }
      case 'sp': salir(l, !/^(review|agent)$/.test(v)); if (window.Soporte) Soporte.run(v); return pintarChat();
      case 'pfm': salir(l); if (window.PFM) PFM.key(v); return;
      // Mis finanzas se responde en la conversación; abrir la pantalla es una opción más
      case 'fin': fx('select'); return finOn(true);
      case 'home': fx('tap'); finOn(false); return;
      // Ayuda es su sección: se abre el centro de ayuda; el chat empieza cuando hay algo que resolver
      case 'ayuda': fx('tap'); salir('Ayuda'); if (window.Soporte) Soporte.open(); return;
      case 'sol': return abrirSol();
      case 'centro': salir('encontrar lo que buscabas en la ayuda'); return Soporte.open();
      case 'persona': persona(); return pintarChat();
      case 'agent': salir('resolverlo con el asesor'); return Soporte.run('agent');
      case 'call': { var c = Soporte.contact(); uku('Llama al <b>' + esc(c.phone) + '</b>, las 24 horas. Dale este código al asesor y ya sabrá de qué se trata: <b>' + esc(c.caso) + '</b>.', [b('tel', 'Llamar ahora', 'call'), b('ok', 'Listo, gracias', 'thumb_up', 'is-ask')]); return pintarChat(); }
      case 'tel': location.href = 'tel:' + Soporte.contact().phone.replace(/\s/g, ''); return;
      case 'callback': uku('¿Cuándo te llamamos?', [b('cb:en unos minutos', 'Ahora'), b('cb:en 30 minutos', 'En 30 minutos'), b('cb:mañana entre 9:00 y 11:00', 'Mañana en la mañana')]); return pintarChat();
      case 'cb': return resuelto('Listo. Un asesor te llama ' + esc(v) + ' y ya tiene el resumen de tu caso ' + esc(Soporte.contact().caso) + '. No tendrás que repetir nada.');
      case 'ok': return resuelto();
      case 'no': uku('Cuéntame con tus palabras qué necesitas, o te paso con una persona.', [b('persona', 'Hablar con una persona', 'support_agent')]); pintarChat(); return setTimeout(function () { input.focus(); }, 300);
      case 'consejo': { var A = consejos(); if (!A.length) return resuelto('Por ahora no tengo nada más. ¡Vas muy bien!'); var x = A[0]; uku(esc(x.di || x.t), x.act ? [b('pfm:' + x.act, x.actl, 'arrow_forward')] : []); return pintarChat(); }
      case 'cerrar': msgs = []; pend = null; fx('tap'); return pintar();
      case 'ajustes': { var mn = host.querySelector('.uk-menu'), on = mn.hidden; mn.hidden = !on; el.setAttribute('aria-expanded', String(on)); fx('tap'); return; }
      case 'demo': return window.PFM && PFM.settings();
      case 'salir': location.href = 'clasica.html'; return;
    }
  }
  // Un solo punto de entrada: la lupa y la ayuda llevan a Uku (antes que el buscador y el soporte)
  function irAUku(focus, ayudar) {
    if (window.Buscador) Buscador.close(true);
    if (window.__goView) window.__goView(1);
    finOn(false);
    if (ayudar && !msgs.length) { var x = pills.querySelector('[data-k="ayuda"]'); if (x) x.click(); }
    else pintar();
    if (focus) setTimeout(function () { input.focus(); }, 380);
  }
  window.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action="Buscar"], [data-action="Soporte"], [data-action="Ayuda"]');
    if (!t || (host && host.contains(t)) || t.closest('.sp, .sp-page, .as-sheet')) return;
    // En Mis finanzas, la lupa abre el buscador con su contexto, sin salir de la sección
    if (t.dataset.action === 'Buscar' && view.classList.contains('uk-fin')) { e.stopImmediatePropagation(); e.preventDefault(); fx('open'); if (window.Buscador) Buscador.open('finanzas'); return; }
    e.stopImmediatePropagation(); e.preventDefault(); fx('open');
    irAUku(t.dataset.action === 'Buscar', t.dataset.action !== 'Buscar');
  }, true);

  function init() {
    mount(); if (!host) return;
    // La pestaña Mis finanzas pasa a ser Uku
    var nav = document.querySelector('.nav-item[data-view="1"]');
    if (nav) {
      nav.querySelector('.nav-item__label').textContent = 'Asistente';
      nav.querySelector('.nav-item__wrap').innerHTML = '<span class="uk-navface">' + face() + '</span>';
      nav.addEventListener('click', function () { finOn(false); });
    }
    // Arriba, un solo acceso: Uku en lugar de la lupa y los audífonos
    var noti = document.querySelector('.top-bar__actions [data-action="Notificaciones"]');
    if (noti) noti.dataset.in = '0 1 2 4';
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
      if (view.classList.contains('active') && !view.classList.contains('uk-fin')) {
        window.scrollTo(0, 0); setTimeout(escena, 120); // después del PFM, que también usa la escena
        // Una conversación vieja sin nada pendiente no se queda colgada
        if (msgs.length && !pend && Date.now() - ultimo > 3 * 60 * 1000) { msgs = []; pintar(); }
      }
    }).observe(view, { attributes: true, attributeFilter: ['class'] });
    if (tt) new MutationObserver(titulo).observe(tt, { childList: true, characterData: true, subtree: true });
    (function esperar(n) { if (window.PFM && PFM.ready()) return pintar(); if (n < 60) setTimeout(function () { esperar(n + 1); }, 150); })(0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
