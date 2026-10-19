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
  // La versión clásica: la pestaña vuelve a ser Mis finanzas
  if (new URLSearchParams(location.search).get('app') === 'clasica') {
    document.addEventListener('DOMContentLoaded', function () {
      var n = document.querySelector('.nav-item[data-view="1"]'); if (!n) return;
      n.querySelector('.nav-item__label').textContent = 'Mis finanzas'; n.querySelector('.nav-item__wrap').innerHTML = '<span class="material-symbols-rounded">monitoring</span>';
    });
    return;
  }
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
  var agente = null; // con una persona del banco: lo que escribes le llega a ella
  var casos = []; try { casos = JSON.parse(localStorage.getItem('uk-casos') || '[]'); } catch (e) {}

  // Lo que más se pide, en el orden de los trabajos: mi dinero, una duda simple, un inconveniente
  var PRUEBA = ['¿Cómo va mi dinero?', '¿En qué gasto más?', 'No reconozco un consumo', 'No puedo entrar a la app'];

  /* ---------- La pantalla: Uku y su mundo ---------- */
  function mount() {
    view = document.querySelector('.view[data-view="1"]');
    if (!view || host) return;
    host = document.createElement('div'); host.className = 'uk';
    view.insertBefore(host, view.firstChild);
    // Mis finanzas y Ayuda se abren desde el menú de la cabecera, dentro de esta pantalla
    // Para el resto de la app: Ayuda se abre aquí, dentro de Asistente
    window.UkuAsistente = { ayuda: function () { if (window.__goView) window.__goView(1); seccion('ayuda'); },
      // Desde Ayuda y Soporte: un inconveniente guiado, Solicitudes o una persona, siempre en la conversación de Uku
      flow: function (i) { seccion('uku'); flujo(i, 'ini', true); },
      solicitudes: function () { seccion('uku'); abrirSol(); },
      persona: function () { seccion('uku'); persona(); pintarChat(); } };
    // Ayuda, dentro de esta pantalla: al volver desde su flecha, regresa a Uku
    document.addEventListener('soporte:cerrar', function () { seccion('uku'); });
    host.innerHTML =
      '<div class="uk-scene"><div class="b3d"></div><div class="uk-skel" aria-hidden="true"><i class="uk-skel__ear"></i><i class="uk-skel__ear"></i><i class="uk-skel__head"></i><i class="uk-skel__body"></i></div></div>' +
      // Al conversar, su mundo se desvanece detrás de un fondo limpio y arriba queda la cabecera del chat
      '<div class="uk-chatbg" aria-hidden="true"></div>' +
      '<header class="uk-chathead"><button class="icon-button uk-chathead__x" data-k="cerrar" aria-label="Volver a su mundo">' + ic('expand_more') + '</button></header>' +
      // Sin menú: a Mis finanzas y Ayuda se llega por los accesos y las tarjetas; en las secciones hay flecha y título
      '<div class="uk-head"><button type="button" class="icon-button uk-back-btn" data-k="atras" aria-label="Volver">' + ic('arrow_back') + '</button>' +
        '<p class="uk-head__t" role="heading" aria-level="1">Tu asistente</p></div>' +
      '<div class="uk-globo" aria-live="polite"></div>' +
      '<div class="uk-props" hidden></div>' +
      '<div class="uk-chat" aria-live="polite"></div>' +
      '<div class="uk-pills"></div>' +
      '<div class="uk-results"></div>' +
      '<form class="uk-bar" role="search">' +
        '<label class="uk-bar__f">' + ic('search') + '<input type="text" enterkeyhint="send" autocomplete="off" placeholder="Pregunta o pide algo" aria-label="Pregunta o pide algo"></label>' +
        // Foto (un QR, una factura o un estado de cuenta) y voz, siempre a la vista
        '<button type="button" class="uk-bar__mic uk-bar__add" data-k="escanear" aria-label="Tomar una foto de un QR o una factura">' + ic('photo_camera') + '</button>' +
        '<button type="button" class="uk-bar__mic" data-k="voz" aria-label="Hablar">' + ic('mic') + '</button>' +
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
    // Las secciones (Mis finanzas, Ayuda) son una tarjeta sobre su mundo: su cabecera (flecha y título) va dentro
    panel.insertBefore(host.querySelector('.uk-head'), panel.firstChild);
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
    view.addEventListener('click', onClick);
    gestos();
    host.classList.add('is-fresh'); setTimeout(function () { host.classList.remove('is-fresh'); }, 1500); // los accesos solo entran animados la primera vez
    document.addEventListener('pfm:change', function () { if (pend) pend.cambio = true; if (!msgs.length) pintar(); }); // el índice se queda: al saltar una propuesta, el globo sigue con la siguiente
    pintar();
  }
  function modo() {
    // Conversación o sección: en ambos Uku sale de su mundo y lo que ves es una tarjeta sobre él
    var enSec = view.classList.contains('uk-fin') || view.classList.contains('uk-ayuda') || host.classList.contains('uk-in-sec');
    var era = host.classList.contains('is-chat'), es = msgs.length > 0 || enSec;
    host.classList.toggle('is-typing', !!input.value.trim());
    host.classList.toggle('is-chat', es);
    // Sin barra superior ni inferior: la tarjeta ocupa la pantalla y se baja con la flecha de arriba
    document.documentElement.classList.toggle('uk-chatting', es && view.classList.contains('active'));
    // Al conversar, Uku sale de su mundo (que queda como foto borrosa detrás), se acerca y baja a la
    // esquina junto a la barra (como Tolan): deja el espacio a las tarjetas sin irse
    if (b3d && era !== es) {
      var bg = host.querySelector('.uk-chatbg');
      if (es) { var foto = b3d.snapshot(); bg.style.backgroundImage = foto ? 'url(' + foto + ')' : ''; }
      b3d.setFocus(es); b3d.setShift(es ? -.3 : 0, es ? -.47 : 0);
      if (!es) setTimeout(function () { if (!msgs.length) bg.style.backgroundImage = ''; }, 500);
    }
    if (era !== es) {
      input.placeholder = es ? 'Escríbele a Uku' : 'Pregunta o pide algo';
      if (!es && b3d) setTimeout(function () { b3d.play('wave'); setTimeout(function () { if (!msgs.length) b3d.play('walk'); }, 2200); }, 350); // vuelve a su mundo, saluda y camina
      if (es && b3d) b3d.play(null); // en la conversación se queda quieto
    }
  }
  function pintar() { modo(); pintarMundo(); pintarPropuestas(); pintarGlobo(); pintarAccesos(); pintarChat(); pintarResultados(); }
  // Lo que Uku te propone (antes en Mis finanzas): un carrusel arriba, con puntos y una acción por tarjeta
  function pintarPropuestas() {
      // Las propuestas viven en el globo: el carrusel ya no se usa
    props.hidden = true; props.innerHTML = ''; globoEl.style.display = '';
  }
  // El ánimo y las flores de su campo siguen a tus finanzas (las señales van en los insights)
  function pintarMundo() {
    var s = resumen(); if (b3d && s) { b3d.setBloom(s.bloom); b3d.setMood(s.mood); }
  }

  /* El saludo depende del momento: la hora, si ya pasaste hoy, el día de la semana y lo que
     tienes pendiente. Una frase y, si hay algo que hacer, su acción. */
  var VISTO = 'uk-visto', SAL = null;
  function saludo() {
    if (SAL) return SAL;
    var s = resumen(), A = consejos(), nombre = s && s.nombre ? s.nombre.split(' ')[0] : '';
    if (!s) return { t: 'Hola, soy Uku. ¿Vemos cómo vas hoy?', k: 'dinero', l: 'Ver cómo va mi dinero' }; // todavía sin tus datos: no se guarda
    var ahora = new Date(), h = ahora.getHours(), d = ahora.getDay(), antes = 0;
    try { antes = +localStorage.getItem(VISTO) || 0; localStorage.setItem(VISTO, String(ahora.getTime())); } catch (e) {}
    var hoy = antes && new Date(antes).toDateString() === ahora.toDateString(), hace = (ahora.getTime() - antes) / 36e5;
    var n = nombre ? ', ' + nombre : '';
    var hola = hoy && hace > 1 ? 'Qué bueno verte otra vez' + n + '.' : hoy ? 'Hola otra vez' + n + '.'
      : h < 7 ? 'Hola' + n + '. ¿Madrugando?' : h < 12 ? 'Buenos días' + n + '.' : h < 19 ? 'Buenas tardes' + n + '.' : 'Buenas noches' + n + '.';
    var pagos = A.filter(function (c) { return c.id.indexOf('pago:') === 0; });
    return (SAL = sal());
    function sal() {
    if (pagos.length) return { t: hola + ' ' + (pagos.length === 1 ? 'Tienes un pago pendiente, ¿te ayudo con eso?' : 'Tienes ' + pagos.length + ' pagos pendientes, ¿te ayudo con eso?'), k: 'prop:' + pagos[0].id, l: 'Ver el pago' };
    if (d === 1 || d === 0) return { t: hola + ' ¿Quieres ver cómo va tu semana?', k: 'gastos:sem', l: 'Ver mi semana' };
    if (s && s.n >= 5) return { t: hola + ' Tengo ' + s.n + ' consumos sin clasificar. ¿Los ordenamos? Toma un minuto.', k: 'pfm:game', l: 'Ordenar' };
    return { t: hola + ' ¿En qué te ayudo?', k: 'dinero', l: 'Ver cómo va mi dinero' };
    }
  }
  // Lo que dice Uku: el saludo del momento, una nota o su consejo más importante (tocarlo a él pasa al siguiente)
  /* El globo es la voz de Uku: primero el saludo del momento y después, una por una, sus
     propuestas (y las señales de su mundo que piden algo). Cada una trae su acción, «Ahora no»
     para dejarla para después y «Siguiente» para pasar; la lista se renueva cuando haces o saltas algo. */
  var QUIET = 'uk-quiet', globoOff = false;
  function quiet() { try { return localStorage.getItem(QUIET) === '1'; } catch (e) { return false; } }
  function propuestas() {
    if (quiet()) return [];
    var S = window.PFM && PFM.world && resumen() ? PFM.world().filter(function (x) { return /warn|over|pensativo/.test(x.cls || ''); }).map(function (x) { return { id: 'mundo', tag: x.l, t: x.d, k: 'mundo', l: 'Cuéntame' }; }) : [];
    return consejos().map(function (x) { return { id: x.id, tag: x.tag, t: x.di || x.t, k: x.act ? 'pfm:' + x.act : 'prop:' + x.id, l: x.actl || 'Cuéntame', luego: 'pfm:luego:' + x.id, kind: x.kind }; }).concat(S);
  }
  function pintarGlobo() {
    var P = propuestas(), n = P.length, hola = !saludado && !nota, sal = hola ? saludo() : null, x = !hola && !nota && n ? P[gi % n] : null;
    var t = nota || (hola ? sal.t : x ? x.t : 'Todo está en orden por ahora. ¿Quieres hacer algo hoy?');
    var go = hola ? sal : x ? { k: x.k, l: x.l } : null;
    // Sin nada que decir (o en silencio), el globo se va y Uku se queda tranquilo
    if (!hola && !nota && !x) { if (b3d) b3d.play('happy'); return ocultarGlobo(); }
    globoEl.hidden = false; globoEl.classList.remove('is-off');
    globoEl.innerHTML = '<button class="uk-globo__x" data-k="globo:cerrar" aria-label="Cerrar">' + ic('close') + '</button>' +
      (x ? '<p class="uk-globo__tag">' + esc(x.tag) + '</p>' : '') + '<p class="uk-globo__t">' + esc(t) + '</p>' +
      '<div class="uk-globo__acts">' + (go ? '<button class="btn btn--tertiary uk-globo__go" data-k="' + esc(go.k) + '" data-l="' + esc(go.l) + '">' + esc(go.l) + '</button>' : '') +
      (x && x.luego ? '<button class="uk-globo__skip" data-k="' + esc(x.luego) + '" data-l="Ahora no">Ahora no</button>' : '') +
      (hola && n ? '<button class="uk-globo__skip" data-k="siguiente" data-l="Qué me propones">Qué me propones</button>' : '') + '</div>' +
      // Al pie: por dónde vas y la siguiente propuesta, separadas de la acción principal
      (!hola && n > 1 ? '<div class="uk-globo__foot"><div class="uk-globo__dots">' + P.map(function (_, i) { return '<i' + (i === gi % n ? ' class="is-on"' : '') + '></i>'; }).join('') + '</div>' +
        '<button class="uk-globo__next" data-k="siguiente" data-l="Siguiente">Siguiente' + ic('chevron_right') + '</button></div>' : '');
    globoEl.classList.remove('is-new'); void globoEl.offsetWidth; globoEl.classList.add('is-new');
    // Uku hace lo que dice: saluda, habla, se preocupa o celebra según el mensaje
    if (b3d) b3d.play(hola ? 'wave' : nota ? 'happy' : !x ? 'happy' : x.kind === 'warn' ? 'worried' : 'talk');
  }
  function ocultarGlobo() { globoOff = true; globoEl.classList.add('is-off'); setTimeout(function () { if (globoOff) globoEl.hidden = true; }, 260); }
  // Los accesos: Mis finanzas, ordenar, consejos y ayuda, a un toque desde Uku
  function pintarAccesos() {
    var s = resumen(), A = consejos(), p = function (k, icon, t, sub) { return '<button class="uk-pill" data-k="' + k + '" data-l="' + esc(t) + '">' + ic(icon) + '<span><b>' + esc(t) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>'; };
    // Los accesos de Asistente: presupuesto, ayuda y solicitudes
    pills.innerHTML = p('gastos', 'account_balance_wallet', 'Mis gastos', s ? money0(s.gast) : 'Presupuesto') +
      p('ayuda', 'support_agent', 'Ayuda', 'Soporte') +
      p('sol', 'assignment', 'Solicitudes', 'Pedir o revisar');
  }

  /* ---------- Escribiendo: resultados flotando sobre su mundo ---------- */
  // Una sugerencia: texto y, si hace falta, de qué tipo es; sin ícono (la lista ya dice qué es)
  function fila(k, icon, t, s) {
    return '<button class="uk-row" data-k="' + esc(k) + '" data-l="' + esc(t) + '"><span class="uk-row__t"><b>' + esc(t) + '</b>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</span>' + ic('chevron_right') + '</button>';
  }
  function texto(t) { return String(t || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ''); }
  function pintarResultados() {
    var q = input.value.trim();
    if (!q) { results.innerHTML = ''; return; }
    // Pocas sugerencias y buenas: con una sola palabra, la ayuda solo si está en el título de la pregunta
    var n = norm(q), ws = n.split(/\s+/).filter(Boolean), dinero = (DINERO.test(n) || (PLATA.test(n) && !HACER.test(n))) && resumen();
    var acts = acciones(q).slice(0, 2), H = ayuda(q, 4).filter(function (h) { return h.kind !== 'flow' && (ws.length > 1 || norm(h.t).indexOf(ws[0]) >= 0); }).slice(0, 2);
    var html = fila('ask:' + q, null, 'Preguntarle a Uku', '“' + q + '”');
    if (dinero) html += '<p class="uk-results__l">Tu dinero</p>' + fila('dinero', null, 'Cómo va mi dinero', 'Disponible, gastos y presupuesto');
    if (H.length) html += '<p class="uk-results__l">Ayuda</p>' + H.map(function (h) { return fila(h.kind + ':' + h.i, null, h.t, h.kind === 'tut' ? 'Tutorial' : ''); }).join('');
    if (acts.length) html += '<p class="uk-results__l">Hacer</p>' + acts.map(function (a) { return fila('act:' + a.label, null, a.label, ''); }).join('');
    results.innerHTML = html;
  }

  /* ---------- La conversación ----------
     Cada mensaje de Uku trae sus botones; solo los del último se pueden
     tocar, así la conversación avanza y no quedan preguntas viejas abiertas. */
  function me(t) { msgs.push({ me: t }); }
  function uku(t, btns, extra, o) { o = o || {}; msgs.push({ uku: t, btns: btns || [], extra: extra || '', nuevo: true, title: o.title, rows: o.rows, flow: o.flow, num: o.num, meter: o.meter, stats: o.stats, bars: o.bars, pregunta: o.pregunta, voto: o.voto, links: o.links, ia: o.ia }); ultimo = Date.now(); if (b3d) b3d.play('talk'); }
  function b(k, t, icon, cls) { return { k: k, t: t, ic: icon, cls: cls }; }
  function mostrar() { input.value = ''; modo(); pintarChat(); pintarResultados(); }
  // Lo que escribes: tu plata, la ayuda o una acción de la app
  /* Qué quieres, en el orden de los trabajos de la gente:
     1. saber cómo va mi dinero (mi salud, mis gastos, mi presupuesto),
     2. una respuesta simple (la ayuda), 3. un inconveniente con mi cuenta (guiado).
     Lo que se resuelve con reglas se resuelve aquí; lo demás, con una persona. */
  var DINERO = /como (va|voy|esta|estoy|ando)|salud financiera|mi dinero|mi plata|mis finanzas|resumen|como me fue|cuanto tengo|^saldo|mi saldo|disponible/;
  function preguntar(q) {
    q = String(q || '').trim(); if (!q) return;
    me(q); input.blur(); fx('select'); if (b3d) b3d.play('nod');
    var n = norm(q);
    if (agente) return responde();
    if (fotoPend && montoEscrito(q)) return mostrar();
    // Pedir una persona es pedir una persona: sin rodeos
    if (/persona|humano|asesor|agente|ejecutiv/.test(n)) { persona(); return mostrar(); }
    // Su mundo: Uku te cuenta cómo está, en primera persona (sus flores, su bosque y su ánimo son tus finanzas)
    if (/mundo|bosque|flores|como estas|tu animo|como te sientes|quien eres/.test(n) && window.PFM && PFM.world) { mundo(); return mostrar(); }
    // 1. Cómo va mi dinero
    if (DINERO.test(n) && !HACER.test(n) && resumen()) { dinero(); return mostrar(); }
    var fin = finanzas(q), acts = acciones(q).slice(0, 2), H = ayuda(q, 3), ws = n.replace(/[¿?¡!.,]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2; });
    // Un «por qué» o «qué es» que coincide fuerte con un tema (ISD, intereses, comisiones) va antes que un inconveniente
    var tm = Soporte.tema ? Soporte.tema(q, 1) : [];
    if (tm.length && tm[0].sc >= 6 && !fin) return temaCard(tm[0].i, q);
    // 3. Un inconveniente: si lo que escribes se parece a uno, Uku lo guía paso a paso
    var fl = H.filter(function (h) { return h.kind === 'flow'; })[0];
    if (fl && !fin && !/^(que es|que significa|cuanto tarda|donde veo|por que)/.test(n)) return flujo(fl.i, 'ini');
    // La ayuda solo si coincide de verdad: dos palabras, o una sola que esté en el título
    H = H.filter(function (h) { return h.kind !== 'flow' && (h.sc >= 4 || (ws.length === 1 && norm(h.t).indexOf(ws[0]) >= 0)); });
    if (fin) uku(fin.t, (fin.acts || []).map(function (a) { return b('pfm:' + a[1], a[0], 'arrow_forward'); }).concat((fin.s || []).slice(0, 2).map(function (c) { return b('ask:' + c, c, null, 'is-ask'); })), '', { title: fin.title || q, num: fin.num, bars: fin.bars, meter: fin.meter });
    // Si preguntas cómo, cuánto o qué, primero la ayuda; si pides hacer algo, primero la acción
    else if (H.length && (!acts.length || PREG.test(norm(q)))) return ayudaEn(H[0], H.slice(1), acts);
    // Un «por qué» o «qué es» (cargos, impuestos, términos): la explicación corta y dónde leer más
    else if (tm.length) return temaCard(tm[0].i, q);
    else if (acts.length) uku(acts.length === 1 ? 'Te llevo a ' + acts[0].label.toLowerCase() + '. ¿Lo hacemos?' : 'Puedo llevarte a hacerlo:', acts.map(function (a) { return b('act:' + a.label, a.label, a.icon); }).concat(H.slice(0, 1).map(function (h) { return b(h.kind + ':' + h.i, h.t, 'help', 'is-ask'); }))
      // Si es un problema (un cobro, un reclamo), una persona también está a un toque
      );
    else return iaCard(q); // lo que no está en reglas ni en la ayuda: Uku busca y, si no, lo mira con IA
    mostrar();
  }
  function mundo() {
    var W = PFM.world(), s = resumen(), pend = s && s.n;
    // Lo que pide algo va en la frase; el estado de cada cosa, en filas
    var pide = W.filter(function (x) { return /warn|over|pensativo/.test(x.cls || ''); })[0];
    uku(esc(pide ? pide.d : 'Mi mundo está bien porque tus finanzas lo están. Lo que ves aquí lo cuidas tú.'),
      (pend ? [b('pfm:game', 'Clasificar conmigo', 'category')] : []).concat([b('pfm:world', 'Qué significa cada cosa', null, 'is-ask'), b('ok', 'Gracias, Uku', 'thumb_up', 'is-ask')]), '',
      { title: 'Mi mundo', stats: W.map(function (x, i) { var m = String(x.v).match(/\d+/);
        return { ic: x.ic, l: x.l.replace(/^Su /, 'Mi ').replace(/^Sus /, 'Mis '), v: i === 0 ? (s && s.n ? s.n + ' por ordenar' : 'Contento') : i === 1 ? (m ? m[0] + (m[0] === '1' ? ' mes' : ' meses') : 'Menos de 1 mes') : String(x.v), cls: /warn|over|pensativo/.test(x.cls || '') ? 'warn' : 'ok' }; }) });
    if (b3d) b3d.play('happy');
  }
  // Cómo va tu dinero: lo que responde a la primera pregunta de todos, con lo que puedes hacer después
  function dinero() {
    var s = resumen(), A = consejos(), x = A[0], pres = s.pres && !(window.PFM.advice().some(function (c) { return c.id === 'pres' && !c.done; }));
    var nivel = s.score >= 85 ? 'Vas bien' : s.score >= 55 ? 'Con cuidado' : 'Por encima del plan';
    var stats = [{ ic: 'account_balance_wallet', l: 'Disponible', v: money0(s.saldo), saldo: true }, { ic: 'favorite', l: 'Tu salud', v: nivel, cls: s.score >= 85 ? 'ok' : 'warn' }, { ic: 'category', l: 'Por ordenar', v: s.n ? String(s.n) : 'Nada', cls: s.n ? 'warn' : 'ok' }];
    var t = pres ? (s.score >= 85 ? 'Vas bien con tu presupuesto.' : s.score >= 55 ? 'Vas un poco rápido con tu presupuesto: con cuidado llegas.' : 'Vas por encima de tu presupuesto: revisemos en qué.') : 'Todavía no tienes presupuesto. Con lo que recibes y lo que gastas, te ayudo a armarlo.';
    if (x && x.id !== 'pres' && x.kind === 'warn') t += ' ' + (x.di || x.t);
    uku(esc(t), [b('gastos', 'Ver mis gastos', 'account_balance_wallet'), pres ? b('pfm:budgets', 'Ajustar mi presupuesto', 'speed') : b('pfm:pres', 'Armar mi presupuesto', 'speed')]
      .concat(x && x.act && x.id !== 'pres' ? [b('pfm:' + x.act, x.actl, null, 'is-ask')] : [])
      .concat([b('ask:¿En qué gasto más?', '¿En qué gasto más?', null, 'is-ask')]), '',
      { title: 'Así vas en ' + s.mes, num: { v: money0(s.gast), l: 'gastaste en ' + s.mes }, meter: pres ? { v: s.gast, max: s.pres, l: money0(s.gast) + ' de ' + money0(s.pres) + ' de presupuesto', cls: s.score >= 85 ? 'ok' : s.score >= 55 ? 'warn' : 'over' } : null, stats: stats });
    if (b3d) b3d.play(s.score >= 85 ? 'happy' : 'talk');
  }
  // Una propuesta, en su momento: Uku la cuenta, con su acción y la siguiente a un toque
  function propuesta(id) {
    var A = consejos(), x = A.filter(function (c) { return c.id === id; })[0] || A[0]; if (!x) return;
    var i = A.indexOf(x), sig = A[(i + 1) % A.length];
    uku(esc(x.di || (x.t + (x.s ? '. ' + x.s : ''))), (x.act ? [b('pfm:' + x.act, x.actl, x.icon)] : [])
      .concat([b('pfm:luego:' + x.id, 'Ahora no', null, 'is-ask')]).concat(sig && sig !== x ? [b('prop:' + sig.id, 'Siguiente propuesta', null, 'is-ask')] : []), '', { title: x.tag, bars: x.cmp ? x.cmp.map(function (c) { return { l: c.l, v: c.v }; }) : null });
    if (b3d) b3d.play(x.kind === 'warn' ? 'worried' : 'talk');
    mostrar();
  }
  // Un inconveniente guiado (Soporte.flow): Uku pregunta lo justo y cada respuesta lleva al siguiente paso o a la solución
  function flujo(i, paso, pedir) {
    var f = Soporte.flow(i), st = f && f.s[paso]; if (!st) return;
    if (pedir) me(f.t);
    uku(esc(st.q), st.ops.map(function (o) {
      var k = o[1], i2;
      if (k.indexOf('go:') === 0) return b('fl:' + i + ':' + k.slice(3), o[0], null, 'is-ask');
      if (k.indexOf('faq:') === 0) { i2 = Soporte.faqIndex(k.slice(4)); return b('faq:' + i2, o[0], null, 'is-ask'); }
      if (k === 'persona') return b('persona', o[0], 'support_agent', 'is-ask');
      return b('sp:' + k, o[0], 'arrow_forward');
    }), '', { title: f.t, flow: f.id });
    mostrar();
  }
  // Ayuda, sin salir de su mundo: los inconvenientes guiados y lo más consultado; todo el centro de ayuda a un toque
  function ayudaCard() {
    var F = Soporte.flows();
    uku('¿En qué te ayudo? Elige un tema o escríbeme tu pregunta. Te respondo aquí y, si hace falta, te llevo a donde se resuelve.',
      F.slice(0, 4).map(function (f) { return b('flow:' + f.i, f.t, f.icon); })
        .concat([b('ayudatoda', 'Todas las preguntas frecuentes', 'help')]), '', { title: 'Ayuda' });
    mostrar();
  }
  // Un tema de «por qué» o «qué es»: explicación corta, lo que puedes hacer y dónde leer más
  function temaCard(i, q) {
    var x = Soporte.temaDe(i);
    uku(esc(x.a) + (x.mas ? '<br><br>' + esc(x.mas) : ''), x.acts.map(function (a) { return b('sp:' + a[1], a[0], 'arrow_forward'); }), '', { title: x.t, links: x.links, voto: true });
    mostrar();
  }
  /* Lo que no está en reglas ni en la ayuda: Uku lo busca (centro de ayuda y blog) y lo mira con IA, con
     el mismo estilo de tarjeta. Una persona del banco queda como último recurso, cuando nada de esto sirve. */
  function iaCard(q) {
    uku('No tengo una respuesta exacta para eso, así que lo busqué por ti. Esto es lo que encontré:',
      [b('ia:' + q, 'Que Uku IA lo revise', 'leaf_spark')],
      '', { title: 'Lo que encontré', links: [['Buscar «' + q.slice(0, 32) + (q.length > 32 ? '…' : '') + '» en el centro de ayuda', Soporte.buscarURL(q)], ['Artículos del blog', Soporte.blogURL]], voto: true });
    mostrar();
  }
  // Uku IA (simulada): responde con tus datos y lo que sabe, y dice cuando algo no lo puede asegurar
  function iaResponde(q) {
    var s = resumen();
    var t = s ? 'Revisé tus movimientos de ' + s.mes + ': tienes ' + money0(s.saldo) + ' disponibles y llevas ' + money0(s.gast) + ' de gastos. ' : '';
    t += 'Sobre «' + q + '» no encontré una regla del banco que lo explique con certeza. Lo que sí puedo hacer: revisar contigo el movimiento exacto para ver de qué se trata, o dejarte el enlace del tema en el centro de ayuda. Si quieres que una persona lo revise, también se puede.';
    uku(esc(t), [b('gastos', 'Revisar mis movimientos', 'account_balance_wallet'), b('persona', 'Que lo revise una persona', 'support_agent', 'is-ask')], '', { title: 'Uku IA', ia: true, links: [['Centro de ayuda', Soporte.buscarURL(q)]], voto: true });
    mostrar();
  }
  // Pulgar abajo: el siguiente paso de autogestión antes que una persona
  function votar(v) {
    var li = -1; msgs.forEach(function (m, j) { if (m.uku != null) li = j; }); if (li < 0) return;
    var m = msgs[li]; m.votado = v; fx(v === 'up' ? 'success' : 'tap');
    if (v === 'up') { pintarChat(); setTimeout(function () { if (msgs[msgs.length - 1] === m) resuelto('Me alegra. Aquí estoy si necesitas algo más.'); }, 900); return; }
    var q = ultimaPregunta();
    uku('Busquemos otra forma. ¿Qué prefieres?', [b('ask:' + (q || 'Ayuda'), 'Reformular mi pregunta', 'edit', 'is-ask')].concat(m.ia ? [] : [b('ia:' + (q || m.title || ''), 'Que Uku IA lo revise', 'leaf_spark', 'is-ask')]).concat([b('ayudatoda', 'Ver todas las preguntas', 'help', 'is-ask'), b('persona', 'Hablar con una persona', 'support_agent', 'is-ask')]), '', { title: 'Otra forma' });
    mostrar();
  }
  function ultimaPregunta() { for (var i = msgs.length - 1; i >= 0; i--) if (msgs[i].me) return msgs[i].me; return null; }
  /* Onboarding: la primera vez, Uku se presenta en tres pasos. Es una tarjeta arriba, sobre su mundo
     (sin conversación), con un botón principal claro; él, grande, te mira y saluda. */
  var ONB = 'uk-onboard', onbEl = null, PASOS = [
    { ic: 'waving_hand', t: 'Hola, soy Uku', s: 'Tu asistente en Pichibank. Te cuento cómo va tu dinero, respondo tus dudas y te ayudo a resolver inconvenientes sin salir de aquí.' },
    { ic: 'park', t: 'Mi mundo eres tú', s: 'Las flores son tu ahorro, el bosque es tu presupuesto y mi ánimo depende de tus gastos ordenados. Tócame y te cuento cómo estoy.' },
    { ic: 'forum', t: 'Háblame como quieras', s: 'Escribe, dicta o toma una foto de un QR o una factura. Si algo no lo sé, lo busco por ti y, solo si hace falta, te comunico con una persona.' }];
  function onboarding(i) {
    i = i || 0; var p = PASOS[i], fin = i === PASOS.length - 1;
    if (!onbEl) { onbEl = document.createElement('section'); onbEl.className = 'uk-onb'; onbEl.setAttribute('aria-label', 'Conoce a Uku'); host.appendChild(onbEl); host.classList.add('is-onb'); if (b3d) { b3d.play('wave'); b3d.setShift(0, -.3); } } // baja para quedar entero bajo la tarjeta
    onbEl.innerHTML = '<div class="uk-onb__card" style="--k:' + i + '"><p class="uk-onb__dots">' + PASOS.map(function (_, j) { return '<i' + (j === i ? ' class="is-on"' : '') + '></i>'; }).join('') + '</p>' +
      '<p class="uk-onb__ic">' + ic(p.ic) + '</p><h2 class="uk-onb__t">' + esc(p.t) + '</h2><p class="uk-onb__s">' + esc(p.s) + '</p>' +
      '<button class="pf-cta uk-onb__go" data-k="' + (fin ? 'onb:fin' : 'onb:' + (i + 1)) + '">' + (fin ? 'Empezar' : 'Siguiente') + '</button>' +
      (fin ? '' : '<button class="uk-onb__skip" data-k="onb:fin">Saltar</button>') + '</div>';
    fx('select');
  }
  function onboardingFin() {
    try { localStorage.setItem(ONB, '1'); } catch (e) {}
    if (onbEl) { onbEl.classList.add('is-out'); setTimeout(function () { onbEl.remove(); onbEl = null; host.classList.remove('is-onb'); }, 260); }
    if (b3d) b3d.setShift(0, 0);
    fx('success'); if (b3d) b3d.play('happy');
    nota = 'Listo. Pregúntame cómo va tu dinero cuando quieras.'; pintarGlobo(); setTimeout(function () { nota = null; if (!msgs.length) pintarGlobo(); }, 6000);
  }
  // Una pregunta frecuente o un tutorial, respondido por Uku aquí mismo
  function ayudaEn(h, otras, acts) {
    if (h.kind === 'tut') {
      var u = Soporte.tut(h.i);
      uku('Así se hace, en ' + (u.min || 1) + ' minuto' + ((u.min || 1) > 1 ? 's' : '') + ':', (u.act ? [b('sp:' + u.act[1], u.act[0], 'arrow_forward')] : []),
        '<ol class="uk-steps">' + u.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>', { title: u.t, voto: true });
    } else {
      var f = Soporte.faq(h.i);
      // La respuesta, lo que puedes hacer con ella y "¿Te sirvió?", en un solo mensaje
      uku(esc(f.a), f.acts.map(function (a) { return b(a[1] === 'handoff' ? 'persona' : a[1] === 'sol' ? 'sol' : 'sp:' + a[1], a[0], a[1] === 'handoff' ? 'support_agent' : 'arrow_forward'); }), '', { title: f.t, voto: true });
    }
    mostrar();
  }
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, escribe = null;
  /* Las respuestas de Uku son tarjetas sobre su mundo: la última es la que se usa y las
     anteriores quedan apiladas detrás. Cada tarjeta trae lo que puedes hacer con ella y se
     puede volver atrás; con una persona del banco, la conversación es un chat normal. */
  /* El ícono de una fila solo cuando identifica una acción concreta de la app (programar un pago,
     ver la tarjeta, transferir). Las listas de temas (inconvenientes, preguntas) van sin ícono. */
  var ICONO = [[/^(sp:)?review$/, 'report'], [/card:|tab:Tarjetas|Mis tarjetas/, 'credit_card'], [/Pagar tarjeta/, 'credit_card'], [/Pagar servicios/, 'bolt'], [/Pagar con QR/, 'qr_code_scanner'], [/Transferir/, 'send_money'], [/Seguridad/, 'lock'], [/Datos personales/, 'badge'], [/Cuenta|Recibir dinero/, 'account_balance'], [/Prestamos|Simular/, 'request_quote'], [/Inversiones/, 'trending_up'], [/Seguro/, 'shield'], [/Recargar/, 'phone_android'], [/Certificado/, 'description'], [/Solicitar cuenta/, 'add_card'], [/meta/, 'flag'], [/Retirar/, 'atm'], [/^sp:search|^search/, 'search'], [/^sp:pfm|^gastos/, 'account_balance_wallet'], [/^pfm:pres|^pfm:budgets/, 'speed'], [/^pfm:game/, 'category'], [/^pfm:pagar|^pfm:tarjeta/, 'event'], [/^pfm:ahorro/, 'savings'], [/^pfm:/, 'lightbulb'], [/^hum:agent/, 'chat'], [/^hum:call/, 'call'], [/^hum:callback/, 'phone_callback'], [/^dinero/, 'account_balance_wallet']];
  function iconoDe(x) {
    if (/^(flow:|faq:|tut:|fl:|ayudatoda|sol$|caso:|ok$|no$|chau|consejo|siguiente)/.test(x.k)) return null;
    if (x.ic && x.ic !== 'arrow_forward' && x.ic !== 'help') return x.ic;
    for (var i = 0; i < ICONO.length; i++) if (ICONO[i][0].test(x.k)) return ICONO[i][1];
    return null;
  }
  function tarjetaHTML(m, q, n, i, typing) {
    var nav = m.btns.filter(function (x) { return !/is-ask/.test(x.cls || ''); }), ask = m.btns.filter(function (x) { return /is-ask/.test(x.cls || ''); });
    return '<section class="uk-card' + (typing ? ' is-typing' : '') + '" style="--n:' + Math.min(n - 1, 2) + '">' +
      '<header class="uk-card__top">' + (n > 1 ? '<button class="uk-card__back" data-k="atras-card" aria-label="Volver a la tarjeta anterior">' + ic('arrow_back') + '</button>' : '<span class="uk-card__face" aria-hidden="true">' + face() + '</span>') +
        '<span class="uk-card__q">' + esc(m.title || q || 'Uku') + '</span>' + (n > 1 ? '<small class="uk-card__n">' + i + ' de ' + n + '</small>' : '') + '</header>' +
      (typing ? '<p class="uk-msg__b uk-dots" aria-label="Uku está escribiendo"><i></i><i></i><i></i></p>' :
        '<div class="uk-card__body">' + (m.num ? '<p class="uk-num"><b>' + esc(m.num.v) + '</b><small>' + esc(m.num.l) + '</small></p>' : '') +
        (m.meter ? '<div class="uk-meter' + (m.meter.cls ? ' is-' + m.meter.cls : '') + '"><i style="width:' + Math.max(2, Math.min(100, m.meter.v / (m.meter.max || 1) * 100)).toFixed(1) + '%"></i></div><p class="uk-meter__l">' + esc(m.meter.l) + '</p>' : '') +
        '<p class="uk-card__t">' + m.uku + '</p>' +
        (m.stats ? '<div class="uk-stats">' + m.stats.map(function (x) { return '<div class="uk-stat' + (x.cls ? ' is-' + x.cls : '') + '"' + (x.saldo ? ' data-saldo' : '') + '>' + ic(x.ic || 'info') + '<b>' + esc(x.v) + '</b><small>' + esc(x.l) + '</small></div>'; }).join('') + '</div>' : '') +
        (m.bars ? '<div class="uk-barras">' + (function () { var mx = Math.max.apply(null, m.bars.map(function (b) { return b.v; }).concat([1])); return m.bars.map(function (b) { return '<div class="uk-barra"><span>' + esc(b.l) + '</span><b>' + money0(b.v) + '</b><i style="width:' + Math.max(3, b.v / mx * 100).toFixed(1) + '%"></i></div>'; }).join(''); })() + '</div>' : '') +
        (m.rows ? '<dl class="uk-card__data">' + m.rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' : '') + m.extra +
        (m.links && m.links.length ? '<div class="uk-links"><small>Para leer más</small>' + m.links.map(function (l) { return '<a class="uk-link" href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + ic('open_in_new') + esc(l[0]) + '</a>'; }).join('') + '</div>' : '') +
        (nav.length ? '<div class="uk-card__nav">' + nav.map(function (x, j) { var ico = iconoDe(x); return '<button class="uk-card__row' + (ico ? ' has-ic' : '') + '" style="--d:' + j * 40 + 'ms" data-k="' + esc(x.k) + '" data-l="' + esc(x.t) + '">' + (ico ? ic(ico) : '') + '<span>' + esc(x.t) + '</span>' + ic('chevron_right') + '</button>'; }).join('') + '</div>' : '') +
        (ask.length ? (m.pregunta ? '<p class="uk-msg__q">' + esc(m.pregunta) + '</p>' : '') + '<div class="uk-msg__acts">' + ask.map(function (x, j) { return '<button class="uk-chip is-ask" style="--d:' + (nav.length + j) * 40 + 'ms" data-k="' + esc(x.k) + '" data-l="' + esc(x.t) + '">' + (x.ic ? ic(x.ic) : '') + esc(x.t) + '</button>'; }).join('') + '</div>' : '') +
        // ¿Te sirvió? Pulgar arriba cierra; pulgar abajo abre el siguiente paso de autogestión
        (m.voto ? '<div class="uk-voto' + (m.votado ? ' is-' + m.votado : '') + '"><span>' + (m.votado === 'up' ? 'Gracias por contarme.' : m.votado === 'down' ? 'Busquemos otra forma.' : '¿Te sirvió?') + '</span>' + (m.votado ? '' : '<button data-k="voto:up" aria-label="Sí me sirvió">' + ic('thumb_up') + '</button><button data-k="voto:down" aria-label="No me sirvió">' + ic('thumb_down') + '</button>') + '</div>' : '') + '</div>') + '</section>';
  }
  function pintarTarjetas() {
    var nuevo = -1; msgs.forEach(function (m, i) { if (m.uku != null && m.nuevo && nuevo < 0) nuevo = i; });
    if (nuevo >= 0 && !RM) { if (!escribe) escribe = setTimeout(function () { escribe = null; msgs.forEach(function (m) { m.nuevo = false; }); pintarChat(); if (b3d) b3d.play('nod'); }, 650); }
    else { msgs.forEach(function (m) { m.nuevo = false; }); nuevo = -1; }
    var U = [], q = null; msgs.forEach(function (m) { if (m.me) q = m.me; else if (m.uku != null) U.push({ m: m, q: q }); });
    var last = U[U.length - 1];
    chat.innerHTML = last ? tarjetaHTML(last.m, last.q, U.length, U.length, nuevo >= 0) : '';
    host.classList.add('is-cards');
    modo();
  }
  function pintarChat() {
    if (!agente && !msgs.some(function (m) { return m.ag; })) return pintarTarjetas();
    host.classList.remove('is-cards');
    // Lo nuevo de Uku aparece después de un "escribiendo…" corto, como en una conversación de verdad
    var nuevo = -1; msgs.forEach(function (m, i) { if (m.uku != null && m.nuevo && nuevo < 0) nuevo = i; });
    if (nuevo >= 0 && !RM) {
      if (!escribe) escribe = setTimeout(function () { escribe = null; msgs.forEach(function (m) { m.nuevo = false; }); pintarChat(); if (b3d) b3d.play('nod'); }, msgs[nuevo].ag ? 1500 : 650);
    } else { msgs.forEach(function (m) { m.nuevo = false; }); nuevo = -1; }
    var vis = nuevo >= 0 ? msgs.slice(0, nuevo) : msgs, last = -1;
    vis.forEach(function (m, i) { if (m.uku != null) last = i; });
    chat.innerHTML = vis.map(function (m, i) {
      if (m.me) return '<div class="uk-me' + (m.visto ? ' is-seen' : '') + '"><p>' + esc(m.me) + '</p></div>';
      if (m.sys) return '<p class="uk-sys' + (m.visto ? ' is-seen' : '') + '">' + esc(m.sys) + '</p>';
      var on = i === last, cara = i === 0 || vis[i - 1].uku == null || !vis[i - 1].ag !== !m.ag;
      return '<div class="uk-msg' + (m.ag ? ' is-agent' : '') + (on ? '' : ' is-old') + (m.visto ? ' is-seen' : '') + '">' + (cara ? '<span class="uk-msg__face" aria-hidden="true">' + cara_(m) + '</span>' : '<span class="uk-msg__face is-gap"></span>') +
        '<div class="uk-msg__body">' + (cara && m.ag ? '<small class="uk-msg__who">' + esc(agente ? agente.n : 'Asesora') + ' · Pichibank</small>' : '') + '<p class="uk-msg__b">' + m.uku + '</p>' + m.extra +
        (on && m.btns.length && nuevo < 0 ? '<div class="uk-msg__acts">' + m.btns.map(function (x, j) { return '<button class="uk-chip ' + (x.cls || '') + '" style="--d:' + j * 50 + 'ms" data-k="' + esc(x.k) + '" data-l="' + esc(x.t) + '">' + (x.ic ? ic(x.ic) : '') + esc(x.t) + '</button>'; }).join('') + '</div>' : '') + '</div></div>';
    }).join('') +
      (nuevo >= 0 ? '<div class="uk-msg is-typing' + (msgs[nuevo].ag ? ' is-agent' : '') + '"><span class="uk-msg__face" aria-hidden="true">' + cara_(msgs[nuevo]) + '</span><div class="uk-msg__body"><p class="uk-msg__b uk-dots" aria-label="' + (msgs[nuevo].ag ? 'Está escribiendo' : 'Uku está escribiendo') + '"><i></i><i></i><i></i></p></div></div>' : '');
    msgs.forEach(function (m, i) { if (i < vis.length) m.visto = true; }); // lo ya visto no vuelve a animarse
    modo();
    requestAnimationFrame(function () { chat.scrollTo({ top: chat.scrollHeight, behavior: RM ? 'auto' : 'smooth' }); });
  }
  // Se resolvió: Uku lo celebra, cierra la conversación y vuelve a su mundo
  function resuelto(t) {
    uku(t || 'Me alegra. Aquí estoy si necesitas algo más.'); pintarChat(); fx('success'); if (b3d) b3d.play('happy');
    setTimeout(function () { msgs = []; nota = 'Listo. ¿Te ayudo con algo más?'; pintar(); setTimeout(function () { nota = null; if (!msgs.length) pintarGlobo(); }, 6000); }, RM ? 1600 : 2300);
  }
  // Pasar con una persona, sin salir de Uku
  function persona() {
    var c = Soporte.contact();
    uku('Te comunico con una persona del banco. Le paso un resumen de lo que hablamos para que no tengas que repetirlo. ¿Cómo prefieres?', c.opts.map(function (o) { return b('hum:' + o.k, o.t, o.icon); }));
  }
  function cara_(m) { return m.ag ? '<span class="uk-av">' + esc(agente ? agente.ini : 'AR') + '</span>' : face(); }
  // De qué se trata: lo último que preguntaste, para que la persona no te lo vuelva a pedir
  function tema() { for (var i = msgs.length - 1; i >= 0; i--) if (msgs[i].me && !/persona|asesor|llam/i.test(msgs[i].me)) return msgs[i].me; return 'Consulta desde Uku'; }
  function nuevoCaso(t, como) {
    var c = Soporte.contact(), x = { id: c.caso, t: t, como: como, f: new Date().toISOString().slice(0, 10) };
    casos = casos.filter(function (y) { return y.id !== x.id; }); casos.unshift(x);
    try { localStorage.setItem('uk-casos', JSON.stringify(casos)); } catch (e) {}
    return x;
  }
  function resumenCaso(x) {
    var s = resumen();
    return '<span class="uk-case"><b>Lo que le paso · caso ' + esc(x.id) + '</b><span>Tema: ' + esc(x.t) + '</span><span>Cliente verificado en la app' + (s && s.nombre ? ' (' + esc(s.nombre.split(' ')[0]) + ')' : '') + '</span><span>Ya revisó la ayuda de Uku</span></span>';
  }
  // Una persona del banco, en esta misma conversación
  function humano(k) {
    var c = Soporte.contact(), x = nuevoCaso(tema(), k);
    if (k === 'agent') {
      uku('Listo, te conecto con una persona. Esto es lo que le paso:', [], resumenCaso(x)); pintarChat();
      setTimeout(function () { msgs.push({ sys: 'Buscando un asesor disponible…' }); pintarChat(); }, 1400);
      setTimeout(function () {
        agente = { n: c.agente.name, ini: c.agente.ini, i: 0, R: c.respuestas };
        msgs.push({ sys: c.agente.name + ' se unió. Desde aquí te responde una persona, no Uku.' });
        var s = resumen(), nom = s && s.nombre ? ', ' + s.nombre.split(' ')[0] : '';
        msgs.push({ uku: esc('Hola' + nom + '. Soy ' + c.agente.name.split(' ')[0] + '. Ya vi tu caso sobre «' + x.t + '». ¿Me cuentas un poco más para revisarlo?'), btns: [], extra: '', nuevo: true, ag: true });
        input.placeholder = 'Escríbele a ' + c.agente.name.split(' ')[0]; fx('success'); pintarChat();
      }, 3200);
      return;
    }
    if (k === 'call') { uku('Llama al <b>' + esc(c.phone) + '</b>, las 24 horas. Dile este código y sabrán de qué se trata: <b>' + esc(x.id) + '</b>.', [b('tel:' + c.phone.replace(/\s/g, ''), 'Llamar ahora', 'call'), b('ok', 'Listo, gracias', 'thumb_up', 'is-ask')]); return pintarChat(); }
    uku('¿Cuándo te llamamos? Ya tendrán el resumen de tu caso ' + esc(x.id) + '.', [b('cb:en unos minutos', 'Ahora', 'call'), b('cb:en 30 minutos', 'En 30 minutos', 'schedule'), b('cb:mañana entre 9:00 y 11:00', 'Mañana en la mañana', 'wb_sunny')]);
    pintarChat();
  }
  function responde() {
    var a = agente, t = a.R[Math.min(a.i++, a.R.length - 1)], fin = a.i >= a.R.length;
    msgs.push({ uku: esc(t), btns: fin ? [b('chau', 'No, eso es todo', 'thumb_up', 'is-ask')] : [], extra: '', nuevo: true, ag: true });
    mostrar();
  }
  // Termina la conversación con la persona y vuelve Uku
  function chau() {
    var x = casos[0]; msgs.push({ sys: (agente ? agente.n : 'La asesora') + ' cerró el chat' + (x ? ' · caso ' + x.id : '') });
    agente = null; input.placeholder = 'Escríbele a Uku';
    resuelto('Tu caso ' + (x ? x.id + ' ' : '') + 'queda en Solicitudes para que veas cómo va. ¿Algo más?');
  }

  // Bajar la tarjeta: primero se va (animación corta) y después se limpia; así no desaparece de golpe
  var cerrando = false;
  function cerrar() {
    if (cerrando) return; cerrando = true; fx('tap');
    host.classList.add('is-out');
    setTimeout(function () {
      host.classList.remove('is-out'); cerrando = false;
      msgs = []; pend = null; agente = null;
      if (solSec && !solSec.hidden) { solSec.hidden = true; host.classList.remove('uk-in-sec'); }
      seccion('uku'); pintar();
    }, RM ? 0 : 220);
  }
  // Volver un paso: en la conversación, a la tarjeta anterior; en una sección, su flecha
  function atras() {
    var bb = view.querySelector('.uk-panel .uk-back-btn'), sb = solSec && !solSec.hidden && solSec.querySelector('[data-s="back"]');
    if (view.classList.contains('uk-fin') || view.classList.contains('uk-ayuda')) return bb && bb.click();
    if (sb) return sb.click();
    if (msgs.filter(function (m) { return m.uku != null; }).length > 1) return onClick({ target: chat.querySelector('[data-k="atras-card"]') || chat });
    cerrar();
  }
  /* ---------- Gestos ----------
     Arrastrar la tarjeta hacia abajo la cierra; deslizar a la derecha vuelve un paso;
     deslizar el globo hacia arriba abre «Así vas». Mientras arrastras, la tarjeta sigue al dedo. */
  function gestos() {
    var g = null;
    function tarjeta(t) { return t.closest('.uk-card, .uk-panel, .uk-sec'); }
    host.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var card = tarjeta(e.target), globo = e.target.closest('.uk-globo');
      if (!card && !globo) return;
      // Dentro de una lista o un contenido que se desplaza, el dedo es para desplazar; el arrastre vale desde la cabecera
      var cab = e.target.closest('.uk-card__top, .uk-panel .uk-head, .uk-sec__top');
      g = { x: e.clientX, y: e.clientY, el: card || globo, cab: !!cab, globo: !!globo, on: false, dir: null };
    });
    host.addEventListener('pointermove', function (e) {
      if (!g) return;
      var dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.dir) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; g.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; }
      if (g.globo) return;
      if (g.dir === 'y' && !g.cab) return; // el contenido se desplaza solo
      if (g.dir === 'y' && dy < 0) return;
      if (g.dir === 'x' && dx < 0) return;
      g.on = true; g.el.classList.add('is-drag'); g.el.style.transform = g.dir === 'y' ? 'translateY(' + dy + 'px)' : 'translateX(' + dx * .6 + 'px)';
      g.el.style.opacity = g.dir === 'x' ? String(Math.max(.4, 1 - dx / 300)) : '';
      e.preventDefault();
    }, { passive: false });
    function fin(e) {
      if (!g) return;
      var dx = e.clientX - g.x, dy = e.clientY - g.y, s = g; g = null;
      if (s.globo) { if (dy < -40 && Math.abs(dx) < 60) { fx('select'); dinero(); mostrar(); } return; }
      s.el.classList.remove('is-drag'); s.el.style.transform = ''; s.el.style.opacity = '';
      if (!s.on) return;
      if (s.dir === 'y' && dy > 90) return cerrar();
      if (s.dir === 'x' && dx > 80) { fx('tap'); return atras(); }
    }
    host.addEventListener('pointerup', fin); host.addEventListener('pointercancel', fin);
    /* Con el dedo: si el contenido de la tarjeta está arriba del todo y tiras hacia abajo, la tarjeta
       baja contigo y se cierra (como una hoja). Si el contenido puede desplazarse, se desplaza. */
    var tg = null;
    host.addEventListener('touchstart', function (e) {
      if (e.touches.length > 1) { tg = null; return; }
      var card = tarjeta(e.target); if (!card) { tg = null; return; }
      var sc = e.target.closest('.pf-host, .uk-sec__body, .sp-body, .uk-card__body');
      tg = { y: e.touches[0].clientY, x: e.touches[0].clientX, el: card, top: !sc || sc.scrollTop <= 0, on: false, dir: null };
    }, { passive: true });
    host.addEventListener('touchmove', function (e) {
      if (!tg) return;
      var dy = e.touches[0].clientY - tg.y, dx = e.touches[0].clientX - tg.x;
      if (!tg.dir) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; tg.dir = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'; if (tg.dir !== 'y' || !tg.top) { tg = null; return; } }
      if (dy <= 0 && !tg.on) { tg = null; return; }
      tg.on = true; e.preventDefault();
      tg.el.classList.add('is-drag'); tg.el.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
    }, { passive: false });
    function finT(e) {
      if (!tg) return;
      var dy = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : tg.y) - tg.y, s = tg; tg = null;
      if (!s.on) return;
      s.el.classList.remove('is-drag'); s.el.style.transform = '';
      if (dy > 90) cerrar();
    }
    host.addEventListener('touchend', finT); host.addEventListener('touchcancel', finT);
  }
  /* ---------- Salir a hacer algo y volver ----------
     Antes de ir a una acción, Uku recuerda qué fuiste a hacer. Cuando
     vuelves a su pantalla (cerraste la hoja, el juego o regresaste desde
     otra sección), te confirma lo que cambió o te pregunta si lo lograste. */
  var CAPAS = '.sp.open, .pfm-game.open, .as-sheet.open, .push-page.open, .as-page.open, .card-detail.open, .sx.open, .ai-page.open';
  // Solo si ya estaban conversando: desde su mundo, el chat no se abre solo; Uku lo celebra en su globo
  function salir(label, decir) {
    pend = { l: label, fuera: false, cambio: false, t: Date.now(), chat: msgs.length > 0 };
    if (decir && msgs.length) { uku('Te llevo a ' + esc(label.toLowerCase()) + '. Cuando vuelvas, cuéntame cómo te fue.'); pintarChat(); }
  }
  function enUku() { return view.classList.contains('active') && !view.classList.contains('uk-fin') && !view.classList.contains('uk-ayuda') && !document.querySelector(CAPAS); }
  setInterval(function () {
    if (!pend || !host) return;
    if (!enUku()) { pend.fuera = true; return; }
    if (!pend.fuera) { if (Date.now() - pend.t > 2500) pend = null; return; } // no se abrió nada
    var p = pend; pend = null;
    if (!p.chat) { if (p.cambio) { nota = 'Listo, ya quedó. ¿Te ayudo con algo más?'; pintarGlobo(); if (b3d) b3d.play('happy'); setTimeout(function () { nota = null; if (!msgs.length) pintarGlobo(); }, 6000); } return; }
    if (p.cambio) { uku('Listo, ya quedó. ¿Te ayudo con algo más?', [b('ok', 'No, eso es todo', 'thumb_up', 'is-ask'), b('consejo', 'Qué más me propones', 'lightbulb', 'is-ask')]); if (b3d) b3d.play('happy'); }
    else uku('¿Pudiste ' + esc(p.l.toLowerCase()) + '?', [b('ok', 'Sí, listo', 'thumb_up', 'is-ask'), b('no', 'No, ayúdame', null, 'is-ask')]);
    pintarChat(); fx('tap');
  }, 500);


  /* ---------- Su mundo en 3D ---------- */
  function escena() {
    var el = host && host.querySelector('.uk-scene .b3d'), s = resumen();
    if (!el || !view.classList.contains('active')) return;
    import(ASSET + 'bosque3d.js').then(function (m3) {
      if (!m3.supported()) return;
      b3d = m3; var c = window.Clima && Clima.last(); if (c) m3.setLook(c.look);
      if (s) { m3.setBloom(s.bloom); m3.setMood(s.mood); }
      m3.attach(el, { score: s ? s.score : 60, onReady: function () { var k = host.querySelector('.uk-skel'); if (k) { k.classList.add('is-off'); setTimeout(function () { k.remove(); }, 400); } }, onTap: function () { fx('select'); m3.play('wave'); if (!msgs.length) { nota = null; if (saludado) gi++; saludado = true; pintarGlobo(); } } });
      el.classList.add('is-3d');
      if (!escena.hola) { escena.hola = 1; m3.setAmbient('walk'); pintarGlobo(); }
    }).catch(function () {});
  }

  /* ---------- Toques ---------- */
  // Un solo título por sección: el del encabezado. En Mis finanzas, el de su página (Mis finanzas o Tus gastos)
  function tituloDe(n) {
    var h = panel && panel.querySelector('.pf-head h1');
    var t = n === 'ayuda' ? 'Ayuda y soporte' : n === 'fin' ? (h ? h.textContent : 'Mis finanzas') : 'Tu asistente';
    if (headT.textContent !== t) headT.textContent = t; // la cabecera vive dentro del panel observado: escribir igual lo volvería a disparar
  }
  // En todas las secciones de Asistente, el título va en su encabezado (no en la barra de arriba)
  function libre() { root.classList.toggle('uk-idle', view.classList.contains('active')); }
  function finOn(on) {
    view.classList.toggle('uk-fin', !!on); libre();
    if (window.AppScroll) AppScroll.to({ top: 0 }); else window.scrollTo(0, 0);
    if (on) { if (window.PFM) PFM.paint(); } else setTimeout(escena, 60);
    modo();
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
    libre(); modo();
  }
  /* ---------- Solicitudes dentro del mundo de Uku ----------
     Lo que se puede pedir o revisar, a un toque; la búsqueda es la universal (contexto: solicitudes). */
  var solSec = null;
  function solRows() {
    var top = casos.length ? '<p class="uk-sec__l">Tus casos</p>' + casos.slice(0, 3).map(function (x) { return row('caso:' + x.id, 'pending_actions', 'Caso ' + x.id + ' · ' + x.t, x.como === 'agent' ? 'En revisión · respuesta en máximo 48 horas' : x.como === 'call' ? 'Abierto · llamaste al call center' : 'Te llamamos con el resumen'); }).join('') + '<p class="uk-sec__l">Lo que puedes pedir</p>' : '<p class="uk-sec__l">Lo que puedes pedir</p>';
    var rows = [top + row('rev', 'receipt_long', 'Revisar un consumo que no reconoces', 'Pedimos la revisión por ti')];
    ['Préstamos', 'Mis tarjetas', 'Seguridad'].forEach(function (l) { var a = accion(l); if (a) rows.push(row('act:' + l, a.icon, l, 'Pedir o revisar')); });
    return rows.join('');
  }
  // Las filas no llevan ícono: el texto ya dice qué es (el ícono queda para lo que identifica, como las categorías)
  function row(s, icon, t, sub) { return '<button class="uk-sec__row" data-s="' + esc(s) + '"><span><b>' + esc(t) + '</b><small>' + esc(sub) + '</small></span>' + ic('chevron_right') + '</button>'; }
  function abrirSol() {
    if (!solSec) {
      solSec = document.createElement('section'); solSec.className = 'uk-sec'; solSec.hidden = true; solSec.setAttribute('aria-label', 'Solicitudes');
      // Solo el título: la tarjeta se baja con la flecha de arriba o arrastrándola, y el buscador ya está abajo
      solSec.innerHTML = '<div class="uk-sec__top"><p class="uk-sec__t">Solicitudes</p></div>' +
        '<div class="uk-sec__body"></div>';
      host.appendChild(solSec);
      solSec.addEventListener('click', function (e) {
        var b = e.target.closest('[data-s]'); if (!b) return;
        var v = b.dataset.s, i = v.indexOf(':'), k = i < 0 ? v : v.slice(0, i), x = i < 0 ? '' : v.slice(i + 1);
        fx('tap');
        if (k === 'back') { solSec.hidden = true; host.classList.remove('uk-in-sec'); modo(); return; }
        if (k === 'buscar') return window.Buscador && Buscador.open('solicitudes');
        if (k === 'rev') return window.Soporte && Soporte.review();
        if (k === 'caso') { var cx = casos.filter(function (y) { return y.id === x; })[0]; solSec.hidden = true; host.classList.remove('uk-in-sec'); if (cx) { me('¿Cómo va mi caso ' + cx.id + '?'); uku('Tu caso ' + esc(cx.id) + ' sobre «' + esc(cx.t) + '» está en revisión. Te llega un correo con la respuesta en máximo 48 horas.', [{ k: 'hum:agent', t: 'Escribirle a un asesor', ic: 'support_agent', cls: 'is-ask' }, { k: 'ok', t: 'Gracias', ic: 'thumb_up', cls: 'is-ask' }]); } return pintarChat(); }
        if (k === 'persona') { solSec.hidden = true; host.classList.remove('uk-in-sec'); persona(); return pintarChat(); }
        if (k === 'act') { var a = accion(x); if (a && window.Buscador) { solSec.hidden = true; host.classList.remove('uk-in-sec'); Buscador.run(a); } }
      });
    }
    solSec.querySelector('.uk-sec__body').innerHTML = solRows();
    solSec.hidden = false; host.classList.add('uk-in-sec'); fx('open'); modo();
  }
  /* ---------- Factura o estado de cuenta: Uku lo lee y propone el pago ---------- */
  /* Una foto: primero busca un QR (se paga al comercio), después texto de factura o estado de cuenta
     (donde el navegador sabe leerlo) y, si no pudo leer nada, pregunta el monto. */
  var fotoPend = null; // la foto que no se pudo leer: espera el monto escrito
  function escanear(file) {
    uku('Miro tu foto…'); pintarChat();
    UkuPagos.leerQR(file).then(function (qr) {
      if (qr) return UkuPagos.propuesta(Persona.get(), UkuPagos.interpretarQR(qr));
      // Sin texto legible no se adivina: se pregunta el monto
      return UkuPagos.leer(file).then(function (texto) { return texto ? UkuPagos.propuesta(Persona.get(), UkuPagos.interpretar(texto)) : null; });
    }).then(function (p) {
      if (!p) {
        fotoPend = file;
        uku('No pude leer un QR ni el texto de esta foto. Dime el monto y te preparo el pago.', [b('ask:Es una factura de luz', 'Es una factura', null, 'is-ask'), b('escanear', 'Tomar otra foto', 'photo_camera', 'is-ask')], '', { title: 'Tu foto' });
        pintarChat(); setTimeout(function () { input.focus(); }, 400); return;
      }
      propuestaPago(p);
    });
  }
  function propuestaPago(p) {
    var leido = p.qr ? 'Leí el QR. ' : p.manual ? 'Con el monto que me diste: ' : p.leido ? 'Lo leí en tu documento. ' : 'No puedo leer el texto de la imagen en este navegador, así que lo comparé con tus productos. ';
    uku(leido + 'Es ' + p.titulo + ' de ' + p.para + (p.vence ? ', vence el ' + p.vence : '') + (p.ref ? ' (ref. ' + p.ref + ')' : '') + '. ¿Lo pago desde ' + p.desde + '?',
      [b('pago:si:' + encodeURIComponent(JSON.stringify(p)), 'Pagar ' + money(p.monto), 'payments'), b('pago:no', 'Ahora no', null, 'is-ask')], '',
      { title: p.qr ? 'Pago con QR' : 'Pago de ' + p.titulo.replace(/^(el|la) /, ''), num: { v: money(p.monto), l: 'a ' + p.para } });
    pintarChat();
  }
  // El monto escrito después de una foto que no se pudo leer
  function montoEscrito(q) {
    var m = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/.exec(q); if (!m) return false;
    var v = parseFloat(m[1].replace(/\.(?=\d{3})/g, '').replace(',', '.')); if (!(v > 0)) return false;
    var tipo = /tarjeta|estado/i.test(q) ? 'estado' : 'factura', sv = /luz|el[eé]ctric/i.test(q) ? 'la luz' : /agua/i.test(q) ? 'el agua' : /internet|wifi/i.test(q) ? 'el internet' : /tel[eé]fono|celular|plan/i.test(q) ? 'el teléfono' : /gas/i.test(q) ? 'el gas' : null;
    fotoPend = null;
    UkuPagos.propuesta(Persona.get(), { monto: v, tipo: tipo, leido: false, vence: null }).then(function (p) {
      if (!p) { uku('No encontré a quién pagar ' + money(v) + '. ¿Me cuentas qué es?'); return pintarChat(); }
      if (!p.qr && p.para === 'la factura que leí') { p.titulo = 'la factura'; p.para = sv || 'tu factura'; }
      p.manual = true; propuestaPago(p);
    });
    return true;
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
    var enChat = chat.contains(el) && !/^(ask|voto)$/.test(kind);
    if (enChat) me(l);
    switch (kind) {
      case 'ask': return preguntar(v);
      case 'faq': case 'tut': if (!enChat) me(l); return ayudaEn({ kind: kind, i: +v });
      case 'act': { var a = accion(v); if (!a) return; salir(a.label, true); return window.Buscador && Buscador.run(a); }
      case 'sp': salir(l, !/^(review|agent)$/.test(v)); if (window.Soporte) Soporte.run(v); return pintarChat();
      case 'pfm': salir(l); if (window.PFM) PFM.key(v); return;
      // Mis finanzas se responde en la conversación; abrir la pantalla es una opción más
      case 'fin': fx('select'); return seccion('fin');
      case 'gastos': fx('select'); seccion('fin'); if (window.PFM) { PFM.key('gastos'); if (v) PFM.key('per:' + v); } return;
      case 'voz': fx('tap'); if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) { uku('En este navegador no puedo escucharte. Escríbeme abajo y te respondo igual.', [b('ask:¿Cómo va mi dinero?', '¿Cómo va mi dinero?', null, 'is-ask')]); return pintarChat(); } if (window.Buscador) Buscador.voice(); return;
      // Volver: en el detalle de gastos, a la lista de Mis finanzas; si no, a Tu asistente
      case 'atras': { var pb = view.querySelector('.pf-back'); return pb ? pb.click() : seccion('uku'); }
      case 'escanear': fx('tap'); return fileIn.click();
      case 'pago': return pago(v);
      // Ayuda es su sección: se abre el centro de ayuda; el chat empieza cuando hay algo que resolver
      case 'ayuda': fx('tap'); return ayudaCard();
      case 'sol': return abrirSol();
      case 'persona': persona(); return pintarChat();
      case 'atras-card': { var li = -1; msgs.forEach(function (m, j) { if (m.uku != null) li = j; }); if (li < 0) return; msgs.splice(li, 1); if (msgs.length && msgs[msgs.length - 1].me) msgs.pop(); fx('tap'); return pintarChat(); }
      case 'fl': { var fp = v.split(':'); return flujo(+fp[0], fp[1]); }
      case 'flow': return flujo(+v, 'ini', !enChat);
      case 'dinero': dinero(); return mostrar();
      case 'voto': return votar(v);
      case 'ia': if (!enChat) me('Que Uku IA lo revise'); uku('Lo reviso…'); pintarChat(); return setTimeout(function () { msgs.pop(); iaResponde(v); }, 1400);
      case 'onb': if (v === 'fin') return onboardingFin(); return onboarding(+v);
      case 'siguiente': fx('tap'); nota = null; if (saludado) gi++; saludado = true; return pintarGlobo();
      case 'globo': fx('tap'); saludado = true; nota = null; return ocultarGlobo();
      case 'prop': return propuesta(v);
      case 'mundo': mundo(); return mostrar();
      case 'ayudatoda': fx('select'); return seccion('ayuda');
      case 'hum': return humano(v);
      case 'tel': location.href = 'tel:' + v; return;
      case 'cb': uku('Listo. Te llaman ' + esc(v) + ' al 099 *** 4521, con el resumen de tu caso. Lo ves en Solicitudes.', [b('ok', 'Gracias', 'thumb_up', 'is-ask')]); fx('success'); return pintarChat();
      case 'chau': return chau();
      case 'ok': return resuelto();
      case 'no': uku('Cuéntame qué necesitas con tus palabras o, si prefieres, te comunico con una persona.', [b('persona', 'Hablar con una persona', 'support_agent')]); pintarChat(); return setTimeout(function () { input.focus(); }, 300);
      case 'consejo': { var A = consejos(); if (!A.length) return resuelto('Por ahora no tengo nada más. ¡Vas muy bien!'); var x = A[0]; uku(esc(x.di || x.t), x.act ? [b('pfm:' + x.act, x.actl, 'arrow_forward')] : []); return pintarChat(); }
      case 'cerrar': return cerrar();
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
    // Sin sesión, Asistente está detrás del inicio de sesión: Ayuda se abre en su propia pantalla
    if (document.getElementById('login-screen')?.classList.contains('active')) return;
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
      nav.querySelector('.nav-item__wrap').innerHTML = ic('leaf_spark');
      nav.addEventListener('click', function () { seccion('uku'); });
    }
    // Arriba, un solo acceso: Uku en lugar de la lupa y los audífonos
    var noti = document.querySelector('.top-bar__actions [data-action="Notificaciones"]');
    if (noti) {
      noti.dataset.in = '0 1 2 4';
      // El ojo de privacidad va en la barra de arriba, junto a la campana (no en la pantalla de Uku)
      var eye = document.createElement('button'); eye.type = 'button'; eye.className = 'icon-button uk-eye'; eye.setAttribute('data-eye', ''); eye.setAttribute('aria-label', 'Ocultar saldos'); eye.setAttribute('aria-pressed', 'false'); eye.dataset.in = noti.dataset.in; eye.innerHTML = ic('visibility');
      noti.parentNode.insertBefore(eye, noti);
    }
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
        if (msgs.length && !pend && !agente && Date.now() - ultimo > 3 * 60 * 1000) { msgs = []; pintar(); }
      }
    }).observe(view, { attributes: true, attributeFilter: ['class'] });
    if (tt) new MutationObserver(titulo).observe(tt, { childList: true, characterData: true, subtree: true });
    (function esperar(n) { if (window.PFM && PFM.ready()) { pintar(); var visto = false; try { visto = localStorage.getItem(ONB) === '1'; } catch (e) {} if (!visto && view.classList.contains('active')) setTimeout(function () { if (!msgs.length) onboarding(0); }, 900); return; } if (n < 60) setTimeout(function () { esperar(n + 1); }, 150); })(0);
    // La primera vez que entras a Asistente (si cargó antes de que vinieras), Uku se presenta
    nav && nav.addEventListener('click', function () { var visto = false; try { visto = localStorage.getItem(ONB) === '1'; } catch (e) {} if (!visto && !msgs.length) setTimeout(function () { onboarding(0); }, 500); });
    // Desde Perfil: Uku en silencio (solo saluda; no propone nada hasta que lo vuelvas a encender)
    var qr = document.getElementById('uk-quiet-row');
    if (qr) {
      qr.setAttribute('aria-pressed', String(!quiet()));
      qr.addEventListener('click', function () {
        var on = quiet(); // on = estaba en silencio → se encienden las propuestas
        try { if (on) localStorage.removeItem(QUIET); else localStorage.setItem(QUIET, '1'); } catch (e) {}
        qr.setAttribute('aria-pressed', String(on)); fx('toggle');
        if (window.PFM && PFM.toast) PFM.toast(on ? 'Uku vuelve a proponerte cosas.' : 'Uku solo te saluda. Lo demás, cuando le preguntes.');
        globoOff = false; saludado = false; pintarGlobo();
      });
    }
    // Desde Perfil: volver a empezar (el onboarding de Uku y el estado de Mis finanzas)
    var rr = document.getElementById('onb-reset-row');
    rr && rr.addEventListener('click', function () {
      try { localStorage.removeItem(ONB); localStorage.removeItem(VISTO); localStorage.removeItem('uk-casos'); } catch (e) {}
      casos = []; saludado = false; gi = 0; nota = null;
      if (window.PFM) PFM.key('reset');
      if (msgs.length) cerrar();
      setTimeout(function () { nav ? nav.click() : onboarding(0); }, msgs.length ? 420 : 80);
    });
    // Las preguntas con IA desde Mis finanzas se responden aquí, con el mismo estilo
    window.UkuAsistente.ia = function (q) { seccion('uku'); me(q); iaResponde(q); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
