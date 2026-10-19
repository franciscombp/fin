/* =====================================================================
   Asistente: Uku es la pantalla principal. Un solo punto de entrada para
   buscar, pedir ayuda y entender tus finanzas.
   - Inicio: Uku en su mundo, sus propuestas (carrusel), los accesos
     (Mis finanzas, Solicitudes, Ayuda) y el campo para escribir o buscar.
   - Ayuda, Solicitudes y Mis finanzas se abren dentro de su mundo; la
     búsqueda es la universal, con el contexto de la sección.
   - El chat aparece solo cuando hay algo que resolver, y se cierra al salir.
   Reusa: Buscador (búsqueda y acciones), Soporte (ayuda), PFM (finanzas y
   propuestas) y bosque3d (el mundo de Uku).
   ===================================================================== */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('app') === 'clasica') return;
  var root = document.documentElement;
  root.classList.add('app-uku');
  var ASSET = (document.currentScript && document.currentScript.src || location.href).replace(/[^/]*$/, '');

  // Utilidades compartidas (assets/uku-util.js)
  var U = window.UkuUtil;
  var esc = U.esc, norm = U.norm, money = U.money, money0 = U.money0, fx = U.fx, face = U.face, ic = U.ic, acciones = U.acciones, accion = U.accion, ayuda = U.ayuda, finanzas = U.finanzas, resumen = U.resumen, consejos = U.consejos;
  var HACER = U.HACER, PLATA = U.PLATA, PREG = U.PREG;

  var view, host, panel, ayudaSlot, headT, fileIn, sheet, globoEl, props, pills, results, chat, input, b3d = null;
  var msgs = [], gi = 0, nota = null, ultimo = 0, saludado = false;
  var pend = null; // lo que saliste a hacer: al volver, Uku pregunta cómo te fue

  var PRUEBA = ['¿En qué se me va la plata?', '¿Cuánto debo?', 'Bloquear mi tarjeta', 'Transferir'];

  /* ---------- La pantalla: Uku y su mundo ---------- */
  function mount() {
    view = document.querySelector('.view[data-view="1"]');
    if (!view || host) return;
    host = document.createElement('div'); host.className = 'uk';
    view.insertBefore(host, view.firstChild);
    // Mis finanzas y Ayuda se abren desde el menú de la cabecera, dentro de esta pantalla
    // Para el resto de la app: Ayuda se abre aquí, dentro de Asistente
    window.UkuAsistente = { ayuda: function () { if (window.__goView) window.__goView(1); seccion('ayuda'); } };
    // Ayuda, dentro de esta pantalla: al volver desde su flecha, regresa a Uku
    document.addEventListener('soporte:cerrar', function () { seccion('uku'); });
    host.innerHTML =
      '<div class="uk-scene"><div class="b3d"></div></div>' +
      // Al conversar, su mundo se desvanece detrás de un fondo limpio y arriba queda la cabecera del chat
      '<div class="uk-chatbg" aria-hidden="true"></div>' +
      '<header class="uk-chathead"><button class="icon-button uk-chathead__x" data-k="cerrar" aria-label="Volver a su mundo">' + ic('expand_more') + '</button></header>' +
      '<div class="uk-head"><button type="button" class="icon-button uk-menu-btn" data-k="secciones" aria-label="Secciones de Asistente">' + ic('menu') + '</button>' +
        '<button type="button" class="icon-button uk-back-btn" data-k="atras" aria-label="Volver">' + ic('arrow_back') + '</button>' +
        '<p class="uk-head__t" role="heading" aria-level="1">Tu asistente</p></div>' +
      '<div class="uk-globo" aria-live="polite"></div>' +
      '<div class="uk-props" hidden></div>' +
      '<div class="uk-chat" aria-live="polite"></div>' +
      '<div class="uk-pills"></div>' +
      '<div class="uk-results"></div>' +
      '<form class="uk-bar" role="search">' +
        '<label class="uk-bar__f">' + ic('search') + '<input type="text" enterkeyhint="send" autocomplete="off" placeholder="Pregunta o pide algo" aria-label="Pregunta o pide algo"></label>' +
        '<button type="button" class="uk-bar__mic uk-bar__add" data-k="escanear" aria-label="Adjuntar una factura o estado de cuenta">' + ic('add') + '</button>' +
        '<button type="button" class="uk-bar__mic" data-k="voz" aria-label="Hablar" hidden>' + ic('mic') + '</button>' +
        '</form>' +
      '<input type="file" accept="image/*" capture="environment" hidden>' +
      // Contenedor de las subsecciones: Mis finanzas (.pf-host) y Ayuda (.uk-ayuda-slot) viven aquí, dentro de Asistente
      '<div class="uk-panel"><div class="uk-ayuda-slot"></div></div>' +
      '';
    props = host.querySelector('.uk-props'); globoEl = host.querySelector('.uk-globo'); pills = host.querySelector('.uk-pills'); results = host.querySelector('.uk-results'); chat = host.querySelector('.uk-chat'); input = host.querySelector('input');
    host.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); preguntar(input.value); });
    fileIn = host.querySelector('input[type=file]');
    headT = host.querySelector('.uk-head__t');
    panel = host.querySelector('.uk-panel'); ayudaSlot = panel.querySelector('.uk-ayuda-slot');
    new MutationObserver(function () { if (view.classList.contains('uk-fin')) tituloDe('fin'); }).observe(panel, { childList: true, subtree: true, characterData: true });
    // El contenedor de Mis finanzas se mueve dentro de Asistente (PFM sigue pintando en el mismo nodo)
    var pfHost = document.querySelector('.view[data-view="1"] .pf-host');
    if (pfHost) panel.insertBefore(pfHost, ayudaSlot);
    fileIn.addEventListener('change', function () { if (fileIn.files[0]) escanear(fileIn.files[0]); fileIn.value = ''; });
    input.addEventListener('input', function () { modo(); pintarResultados(); });
    // En su mundo, el campo de abajo es el buscador (como deslizar desde arriba): responde o lleva a la acción.
    // En la conversación sigue siendo el campo para hablar con Uku.
    input.addEventListener('focus', function () { if (!msgs.length && window.Buscador) { input.blur(); Buscador.open(); } });
    // Dictado: el mismo del buscador, con la frase como búsqueda o pregunta
    if (window.SpeechRecognition || window.webkitSpeechRecognition) host.querySelector('.uk-bar__mic').hidden = false;
    view.addEventListener('click', onClick);
    document.addEventListener('pfm:change', function () { gi = 0; if (pend) pend.cambio = true; if (!msgs.length) pintar(); });
    pintar();
  }
  function modo() {
    var era = host.classList.contains('is-chat'), es = msgs.length > 0;
    host.classList.toggle('is-typing', !!input.value.trim());
    host.classList.toggle('is-chat', es);
    if (b3d && era !== es) b3d.setShift(es ? -.24 : 0); // en la conversación, Uku queda a la izquierda, como en Tolan
    // En la conversación no hay barra superior ni inferior: el chat ocupa la pantalla
    document.documentElement.classList.toggle('uk-chatting', es && view.classList.contains('active'));
    if (era !== es) {
      input.placeholder = es ? 'Escríbele a Uku' : 'Habla con Uku o busca algo';
      if (!es && b3d) setTimeout(function () { b3d.play('wave'); setTimeout(function () { if (!msgs.length) b3d.play('walk'); }, 2200); }, 350); // vuelve a su mundo, saluda y camina
      if (es && b3d) b3d.play(null); // en la conversación se queda quieto
    }
  }
  function pintar() { modo(); pintarMundo(); pintarPropuestas(); pintarGlobo(); pintarAccesos(); pintarChat(); pintarResultados(); }
  // Lo que Uku te propone (antes en Mis finanzas): un carrusel arriba, con puntos y una acción por tarjeta
  function pintarPropuestas() {
    var S = window.PFM && PFM.world && resumen() ? PFM.world().map(function (x) { return { icon: x.ic, tag: x.l, t: x.v, s: x.d }; }) : [];
    var A = S.concat(consejos().slice(0, 6));
    props.hidden = !A.length; globoEl.style.display = A.length ? 'none' : '';
    if (!A.length) return;
    props.innerHTML = '<div class="uk-props__track">' + A.map(function (x) {
      return '<article class="uk-prop"><p class="uk-prop__tag">' + ic(x.icon || 'lightbulb') + esc(x.tag || 'Te propongo') + '</p><p class="uk-prop__t">' + esc(x.t) + '</p>' +
        (x.s ? '<p class="uk-prop__s">' + esc(x.s) + '</p>' : '') +
        (x.act ? '<button class="btn btn--tertiary uk-prop__go" data-k="pfm:' + esc(x.act) + '" data-l="' + esc(x.actl || x.t) + '">' + esc(x.actl || 'Ver') + '</button>' : '') + '</article>';
    }).join('') + '</div><div class="uk-props__dots">' + A.map(function (_, i) { return '<i' + (i ? '' : ' class="is-on"') + '></i>'; }).join('') + '</div>';
    var tr = props.querySelector('.uk-props__track'), dots = props.querySelectorAll('.uk-props__dots i');
    tr.addEventListener('scroll', function () {
      var w = tr.firstElementChild.offsetWidth + 10, n = Math.round(tr.scrollLeft / w);
      dots.forEach(function (d, i) { d.classList.toggle('is-on', i === n); });
    }, { passive: true });
  }
  // El ánimo y las flores de su campo siguen a tus finanzas (las señales van en los insights)
  function pintarMundo() {
    var s = resumen(); if (b3d && s) { b3d.setBloom(s.bloom); b3d.setMood(s.mood); }
  }

  // Lo que dice Uku: una nota del momento o su consejo más importante (tocarlo a él pasa al siguiente)
  function pintarGlobo() {
    var A = consejos(), x = A.length ? A[gi % A.length] : null, s = resumen(), hola = !saludado && !nota;
    var nombre = s && s.nombre ? s.nombre.split(' ')[0] : '';
    var t = nota || (hola ? (nombre ? '¡Hola, ' + nombre + '! Qué gusto verte. ¿Vemos cómo vas hoy?' : '¡Hola! Soy Uku. ¿Vemos cómo vas hoy?')
      : x ? x.di || x.t : '¡Todo va bien por ahora! ¿Hacemos algo hoy?');
    // Como si Uku te lo contara: sin encabezado; la acción es un enlace, no un botón principal
    globoEl.innerHTML = '<p class="uk-globo__t">' + esc(t) + '</p>' +
      (!hola && !nota && x && x.act ? '<button class="btn btn--tertiary uk-globo__go" data-k="pfm:' + esc(x.act) + '" data-l="' + esc(x.actl) + '">' + esc(x.actl) + '</button>' : '');
    globoEl.classList.remove('is-new'); void globoEl.offsetWidth; globoEl.classList.add('is-new');
    // Uku hace lo que dice: saluda, habla, se preocupa o celebra según el mensaje
    if (b3d) b3d.play(hola ? 'wave' : nota ? 'happy' : !x ? 'happy' : x.kind === 'warn' ? 'worried' : 'talk');
  }
  // Los accesos: Mis finanzas, ordenar, consejos y ayuda, a un toque desde Uku
  function pintarAccesos() {
    var s = resumen(), A = consejos(), p = function (k, icon, t, sub) { return '<button class="uk-pill" data-k="' + k + '" data-l="' + esc(t) + '">' + ic(icon) + '<span><b>' + esc(t) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>'; };
    // Los accesos de Asistente: presupuesto, ayuda y solicitudes
    pills.innerHTML = p('gastos', 'account_balance_wallet', 'Mis gastos', s ? money0(s.gast) : 'Presupuesto') +
      p('ayuda', 'support_agent', 'Ayuda', 'Soporte') +
      p('sol', 'assignment', 'Solicitudes', 'Pedir o revisar');
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
  function uku(t, btns, extra) { msgs.push({ uku: t, btns: btns || [], extra: extra || '', nuevo: true }); ultimo = Date.now(); if (b3d) b3d.play('talk'); }
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
  function salir() {}
  function enUku() { return view.classList.contains('active') && !view.classList.contains('uk-fin') && !document.querySelector(CAPAS); }


  /* ---------- Su mundo en 3D ---------- */
  function escena() {
    var el = host && host.querySelector('.uk-scene .b3d'), s = resumen();
    if (!el || !view.classList.contains('active') || view.classList.contains('uk-fin') || view.classList.contains('uk-ayuda')) return;
    import(ASSET + 'bosque3d.js').then(function (m3) {
      if (!m3.supported()) return;
      b3d = m3; var c = window.Clima && Clima.last(); if (c) m3.setLook(c.look);
      if (s) { m3.setBloom(s.bloom); m3.setMood(s.mood); }
      m3.attach(el, { score: s ? s.score : 60, onTap: function () { fx('select'); m3.play('wave'); if (!msgs.length) { nota = null; if (saludado) gi++; saludado = true; pintarGlobo(); } } });
      el.classList.add('is-3d');
      if (!escena.hola) { escena.hola = 1; m3.setAmbient('walk'); pintarGlobo(); }
    }).catch(function () {});
  }

  /* ---------- Toques ---------- */
  // Un solo título por sección: el del encabezado. En Mis finanzas, el de su página (Mis finanzas o Tus gastos)
  function tituloDe(n) {
    var h = panel && panel.querySelector('.pf-head h1');
    headT.textContent = n === 'ayuda' ? 'Ayuda y soporte' : n === 'fin' ? (h ? h.textContent : 'Mis finanzas') : 'Tu asistente';
  }
  // En todas las secciones de Asistente, el título va en su encabezado (no en la barra de arriba)
  function libre() { root.classList.toggle('uk-idle', view.classList.contains('active')); }
  function finOn(on) {
    view.classList.toggle('uk-fin', !!on); libre();
    if (window.AppScroll) AppScroll.to({ top: 0 }); else window.scrollTo(0, 0);
    if (on) { if (window.PFM) PFM.paint(); } else setTimeout(escena, 60);
  }
  // Las tres secciones de Asistente: Uku (su mundo y conversación), Mis finanzas y Ayuda
  function seccion(n) {
    var ayuda = n === 'ayuda';
    view.classList.toggle('uk-ayuda', ayuda);
    if (ayuda) {
      if (view.classList.contains('uk-fin')) finOn(false);
      if (window.Soporte) Soporte.into(ayudaSlot);
    } else if (n === 'fin') { if (window.PFM) PFM.open(); else finOn(true); }
    else finOn(false);
    tituloDe(n);
    libre();
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
  /* ---------- Secciones: menú de la cabecera ---------- */
  var SECCIONES = [['uku', 'Tu asistente', 'Su mundo, sus consejos y lo que te pasa', 'support_agent'], ['fin', 'Mis finanzas', 'Tus gastos y tu presupuesto', 'monitoring'], ['ayuda', 'Ayuda y soporte', 'Preguntas y contacto', 'help']];
  // Hoja de la app (as-sheet), como las de Mis finanzas: fuera de la vista para cubrir la pantalla
  function abrirSecciones() {
    if (!sheet) {
      sheet = { back: document.createElement('div'), el: document.createElement('div') };
      sheet.back.className = 'as-sheet-back';
      sheet.el.className = 'as-sheet'; sheet.el.setAttribute('role', 'dialog'); sheet.el.setAttribute('aria-label', 'Secciones');
      sheet.el.innerHTML = '<div class="as-sheet__handle"></div>' +
        SECCIONES.map(function (x) { return '<button class="as-row as-row--btn" data-k="seccion:' + x[0] + '"><span class="uk-sec__ic">' + ic(x[3]) + '</span><span class="uk-sec__txt"><b>' + esc(x[1]) + '</b><small>' + esc(x[2]) + '</small></span></button>'; }).join('');
      document.body.appendChild(sheet.back); document.body.appendChild(sheet.el);
      sheet.back.addEventListener('click', cerrarSecciones);
      // La hoja está fuera de la vista: sus opciones se atienden aquí
      sheet.el.addEventListener('click', function (e) { var t = e.target.closest('[data-k^="seccion:"]'); if (t) { cerrarSecciones(); seccion(t.dataset.k.slice(8)); } });
    }
    sheet.back.classList.add('open'); sheet.el.classList.add('open');
    fx('open');
  }
  function cerrarSecciones() { if (sheet) { sheet.back.classList.remove('open'); sheet.el.classList.remove('open'); } }

  /* ---------- Factura o estado de cuenta: Uku lo lee y propone el pago ---------- */
  function escanear(file) {
    uku('Leo tu documento…'); pintarChat();
    UkuPagos.leer(file).then(function (texto) {
      return UkuPagos.propuesta(Persona.get(), UkuPagos.interpretar(texto));
    }).then(function (p) {
      if (!p) { uku('No encontré en tu documento un monto que pueda pagar. ¿Me cuentas qué es?', [b('persona', 'Hablar con una persona', 'support_agent')]); return pintarChat(); }
      var leido = p.leido ? 'Lo leí en tu documento. ' : 'No puedo leer el texto de la imagen en este navegador, así que lo comparé con tus productos. ';
      uku(leido + 'Es ' + p.titulo + ' de ' + p.para + ' por ' + money(p.monto) + (p.vence ? ', vence el ' + p.vence : '') + '. ¿Lo pago desde ' + p.desde + '?',
        [b('pago:si:' + encodeURIComponent(JSON.stringify(p)), 'Pagar ' + money(p.monto), 'payments'), b('pago:no', 'Ahora no', 'schedule')]);
      pintarChat();
    });
  }
  // El pago pide confirmación antes de registrarse
  function pago(v) {
    var k = v.split(':'), p = null;
    if (k[0] === 'no') { uku('Listo, lo dejo para después.'); return pintarChat(); }
    if (k[0] === 'si') {
      p = JSON.parse(decodeURIComponent(v.slice(3)));
      uku('¿Confirmas el pago de ' + money(p.monto) + ' a ' + p.para + ' desde ' + p.desde + '?', [b('pago:ok:' + encodeURIComponent(JSON.stringify(p)), 'Confirmar pago', 'check'), b('pago:no', 'Cancelar', 'close')]);
      return pintarChat();
    }
    if (k[0] === 'ok') {
      p = JSON.parse(decodeURIComponent(v.slice(3)));
      UkuPagos.pagar(Persona.get(), p);
      uku('Pago registrado. Esta es una demostración: no se movió dinero real.');
      if (window.showToast) showToast('Pago de ' + money(p.monto) + ' registrado');
      fx('success'); pintarChat();
    }
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
      case 'fin': fx('select'); return seccion('fin');
      case 'gastos': fx('select'); seccion('fin'); if (window.PFM) PFM.key('gastos'); return;
      case 'voz': fx('tap'); if (window.Buscador) Buscador.voice(); return;
      case 'secciones': fx('tap'); return abrirSecciones();
      case 'seccion': cerrarSecciones(); return seccion(v);
      // Volver: en el detalle de gastos, a la lista de Mis finanzas; si no, a Tu asistente
      case 'atras': { var pb = view.querySelector('.pf-back'); return pb ? pb.click() : seccion('uku'); }
      case 'escanear': fx('tap'); cerrarSecciones(); return fileIn.click();
      case 'pago': return pago(v);
      // Ayuda es su sección: se abre el centro de ayuda; el chat empieza cuando hay algo que resolver
      case 'ayuda': fx('tap'); salir('Ayuda'); return seccion('ayuda');
      case 'sol': return abrirSol();
      case 'persona': persona(); return pintarChat();
      case 'ok': return resuelto();
      case 'no': uku('Cuéntame con tus palabras qué necesitas, o te paso con una persona.', [b('persona', 'Hablar con una persona', 'support_agent')]); pintarChat(); return setTimeout(function () { input.focus(); }, 300);
      case 'consejo': { var A = consejos(); if (!A.length) return resuelto('Por ahora no tengo nada más. ¡Vas muy bien!'); var x = A[0]; uku(esc(x.di || x.t), x.act ? [b('pfm:' + x.act, x.actl, 'arrow_forward')] : []); return pintarChat(); }
      case 'cerrar': msgs = []; pend = null; fx('tap'); return pintar();
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
      nav.querySelector('.nav-item__wrap').innerHTML = ic('support_agent');
      nav.addEventListener('click', function () { seccion('uku'); });
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
    function titulo() { if (!tt) return; var t = view.classList.contains('active') ? (view.classList.contains('uk-ayuda') ? 'Ayuda' : view.classList.contains('uk-fin') ? 'Mis finanzas' : 'Uku') : null; if (t && tt.textContent !== t) tt.textContent = t; }
    new MutationObserver(function () {
      root.classList.toggle('uk-here', view.classList.contains('active')); libre(); titulo();
      if (view.classList.contains('active') && !view.classList.contains('uk-fin') && !view.classList.contains('uk-ayuda')) {
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
