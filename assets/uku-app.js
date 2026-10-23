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

  /* ---------- Uku escribe como un chat de IA ----------
     Las palabras aparecen una tras otra (con un leve desenfoque que se aclara), no todo el bloque de golpe. */
  function nPal(t) { return Math.max(1, String(t || '').trim().split(/\s+/).length); }
  function msPal(t) { return Math.max(16, Math.min(40, 2400 / nPal(t))); } // las frases largas no se eternizan: 2,4 s como máximo
  function duracionTipeo(t) { return RM ? 0 : Math.round(nPal(t) * msPal(t) + 280); }
  function tipear(el) {
    if (!el) return;
    el.classList.remove('uk-t0');
    if (RM) return;
    var ms = msPal(el.textContent), i = 0, w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodos = [], n;
    while ((n = w.nextNode())) nodos.push(n);
    nodos.forEach(function (tn) {
      var frag = document.createDocumentFragment();
      tn.nodeValue.split(/(\s+)/).forEach(function (x) {
        if (!x) return;
        if (/^\s+$/.test(x)) { frag.appendChild(document.createTextNode(x)); return; }
        var sp = document.createElement('span'); sp.className = 'uk-w'; sp.textContent = x; sp.style.animationDelay = Math.round(i++ * ms) + 'ms'; frag.appendChild(sp);
      });
      tn.parentNode.replaceChild(frag, tn);
    });
  }
  // Se escribe un instante después de pintarlo: así la traducción de la app (i18n) alcanza a leer la frase completa
  function tipearLuego(el) { if (!el || RM) return; el.classList.add('uk-t0'); setTimeout(function () { if (el.isConnected) tipear(el); }, 0); }

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
      solicitudes: function () { seccion('ayuda'); setTimeout(function () { var s = ayudaSlot.querySelector('#uk-solsec'); if (s) s.scrollIntoView({ block: 'start' }); }, 250); },
      persona: function () { seccion('uku'); persona(); pintarChat(); },
      // Una pregunta frecuente, un tutorial o lo que escribas en Ayuda: siempre una tarjeta de Uku, no otro chat
      faq: function (i) { seccion('uku'); me(Soporte.faq(i).t); ayudaEn({ kind: 'faq', i: i }); },
      tut: function (i) { seccion('uku'); me(Soporte.tut(i).t); ayudaEn({ kind: 'tut', i: i }); },
      preguntar: function (q) { seccion('uku'); preguntar(q); },
      escribir: function () { seccion('uku'); setTimeout(function () { input.focus(); }, 350); },
      abrir: abrirAsistente, libre: mundoLibre,
      // Un movimiento encontrado en el buscador se abre en Mis finanzas
      cabeza: function () { return b3d && b3d.head ? b3d.head() : null; }, mundo: function () { return b3d; },
      ayuda: function () { if (!view.classList.contains('active') && window.__goView) __goView(1); seccion('ayuda'); pintar(); },
      soporte: function () { if (!view.classList.contains('active') && window.__goView) __goView(1); seccion('soporte'); pintar(); },
      finanzas: function (act) { if (!view.classList.contains('active') && window.__goView) __goView(1); seccion('fin'); if (act) setTimeout(function () { window.PFM && PFM.key(act); }, 250); },
      movimiento: function (i) { if (!view.classList.contains('active') && window.__goView) __goView(1); seccion('fin'); setTimeout(function () { window.PFM && PFM.key('tx:' + i); }, 250); } };
    // Ayuda, dentro de esta pantalla: al volver desde su flecha, regresa a Uku
    document.addEventListener('soporte:cerrar', function () { seccion('uku'); });
    host.innerHTML =
      '<div class="uk-scene"><div class="b3d"></div><div class="uk-skel" aria-hidden="true"><i class="uk-skel__ear"></i><i class="uk-skel__ear"></i><i class="uk-skel__head"></i><i class="uk-skel__body"></i></div></div>' +
      // Al conversar, su mundo se desvanece detrás de un fondo limpio y arriba queda la cabecera del chat
      '<div class="uk-chatbg" aria-hidden="true"></div>' +
      '<header class="uk-chathead"><button class="icon-button uk-chathead__x" data-k="cerrar" aria-label="Volver a su mundo">' + ic('expand_more') + '</button><b class="uk-chathead__t"></b><button class="icon-button uk-chathead__i" data-k="mundoinfo" aria-label="Qué significa cada cosa en el mundo de Uku">' + ic('info') + '</button></header>' +
      // Sin menú: a Mis finanzas y Ayuda se llega por los accesos y las tarjetas; en las secciones hay flecha y título
      '<div class="uk-head"><button type="button" class="icon-button uk-back-btn" data-k="atras" aria-label="Volver">' + ic('arrow_back') + '</button>' +
        '<p class="uk-head__t" role="heading" aria-level="1">Tu asistente</p><button type="button" class="icon-button uk-head__x" data-k="ayudacerrar" aria-label="Volver a Soporte">' + ic('close') + '</button></div>' +
      '<div class="uk-globo" aria-live="polite"></div>' +
      '<div class="uk-home" hidden></div>' +
      '<div class="uk-chips" hidden></div>' +
      '<div class="uk-leyenda" hidden aria-hidden="true"></div>' +
      '<div class="uk-props" hidden></div>' +
      '<div class="uk-chat" aria-live="polite"></div>' +
      '<div class="uk-pills"></div>' +
      '<div class="uk-results"></div>' +
      '<form class="uk-bar" role="search">' +
        '<label class="uk-bar__f">' + ic('search') + '<input type="text" enterkeyhint="send" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Pregunta o pide algo" aria-label="Pregunta o pide algo"></label>' +
        // Foto (un QR, una factura o un estado de cuenta) y voz, siempre a la vista
        '<button type="button" class="uk-bar__mic uk-bar__add" data-k="escanear" aria-label="Tomar una foto de un QR o una factura">' + ic('photo_camera') + '</button>' +
        '<button type="button" class="uk-bar__mic" data-k="voz" aria-label="Hablar">' + ic('mic') + '</button>' +
        '<button type="button" class="uk-bar__mic uk-bar__cerrar" data-k="buscar:cerrar" aria-label="Cerrar la búsqueda">' + ic('close') + '</button>' +
        '<button type="submit" class="uk-bar__send" aria-label="Enviar">' + ic('arrow_upward') + '</button>' +
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
    new MutationObserver(function () { if (view.classList.contains('uk-fin')) { tituloDe('fin'); var ahora = Date.now(); if (ahora - (reencuadrar.u || 0) > 250) { reencuadrar.u = ahora; reencuadrar(); } } }).observe(panel, { childList: true, subtree: true, characterData: true });
    // El contenedor de Mis finanzas se mueve dentro de Asistente (PFM sigue pintando en el mismo nodo)
    var pfHost = document.querySelector('.view[data-view="1"] .pf-host');
    if (pfHost) panel.insertBefore(pfHost, ayudaSlot);
    fileIn.addEventListener('change', function () { if (fileIn.files[0]) escanear(fileIn.files[0]); fileIn.value = ''; });
    input.addEventListener('input', function () { modo(); pintarResultados(); });
    // En su mundo, el campo de abajo es el buscador (como deslizar desde arriba): responde o lleva a la acción.
    // En la conversación sigue siendo el campo para hablar con Uku.
    // Tocar la barra en la pantalla inicial abre el buscador universal de la app (el mismo en todas partes)
    // En el inicio y en Soporte la barra es la entrada al buscador universal (en Soporte, con su ayuda primero)
    input.addEventListener('focus', function () { var home = host.classList.contains('is-home'), sop = host.classList.contains('is-ayuda'); if ((home || sop) && window.Buscador) { input.blur(); Buscador.open(sop ? 'ayuda' : 'uku'); } });
    // Dictado: el mismo del buscador, con la frase como búsqueda o pregunta
    view.addEventListener('click', onClick);
    gestos();
    host.classList.add('is-fresh'); setTimeout(function () { host.classList.remove('is-fresh'); }, 1500); // los accesos solo entran animados la primera vez
    // Lo que el orquestador tiene en marcha aparece en el globo y en Mis finanzas
    document.addEventListener('orq:sugerencias', function () { if (!msgs.length) { pintarGlobo(); pintarChips(); } });
    if (window.Orquestador) Orquestador.refrescar();
    document.addEventListener('pfm:change', function () { if (pend) pend.cambio = true; if (!msgs.length) pintar(); }); // el índice se queda: al saltar una propuesta, el globo sigue con la siguiente
    pintar();
  }
  function modo() {
    // Conversación o sección: en ambos Uku sale de su mundo y lo que ves es una tarjeta sobre él
    var enSec = view.classList.contains('uk-fin') || view.classList.contains('uk-ayuda') || host.classList.contains('uk-in-sec');
    var era = host.classList.contains('is-chat'), es = msgs.length > 0 || enSec || ayudaPage;
    var sop = ayudaPage && !msgs.length; // Soporte: como Mis finanzas, Uku en su mundo y una sección fija abajo
    host.classList.toggle('is-ayuda', sop);
    if (!agente) input.placeholder = es && !(ayudaPage && !msgs.length) ? 'Escríbele a Uku' : 'Busca o pregunta';
    host.classList.toggle('is-typing', !!input.value.trim());
    host.classList.toggle('is-chat', es);
    var fin = view.classList.contains('uk-fin'); host.classList.toggle('is-fin', fin);
    if (fin || sop) pintarGlobo(); else if (es) { globoEl.hidden = true; }
    if (homeEl && es) { homeEl.hidden = true; host.classList.remove('is-home'); if (chipsEl) chipsEl.hidden = true; }
    // Arriba: flecha para bajar el asistente en la pantalla inicial y su mundo; X en el chat y las secciones
    cabecera(es);
    if (es) host.classList.remove('is-buscar');
    // Sin barra superior ni inferior: la tarjeta ocupa la pantalla y se baja con la flecha de arriba
    document.documentElement.classList.toggle('uk-chatting', view.classList.contains('active')); navVisible();
    document.documentElement.classList.toggle('uk-fin', view.classList.contains('active') && view.classList.contains('uk-fin'));
    // Al conversar, Uku sale de su mundo (que queda como foto borrosa detrás), se acerca y baja a la
    // esquina junto a la barra (como Tolan): deja el espacio a las tarjetas sin irse
    // (en Mis finanzas y Soporte no: ahí Uku sigue en su mundo, en plano general)
    var foco = es && !fin && !sop;
    if (b3d && host._foco !== foco) {
      var bg = host.querySelector('.uk-chatbg');
      if (foco) { var foto = b3d.snapshot(); bg.style.backgroundImage = foto ? 'url(' + foto + ')' : ''; }
      b3d.setFocus(foco); b3d.setShift(foco ? -.3 : 0, foco ? -.47 : 0);
      if (!foco) setTimeout(function () { if (!host._foco) bg.style.backgroundImage = ''; }, 500);
      host._foco = foco;
    }
    if (era !== es) {
      if (!es && b3d) setTimeout(function () { b3d.play('wave'); setTimeout(function () { if (!msgs.length) b3d.play('walk'); }, 2200); }, 350); // vuelve a su mundo, saluda y camina
      if (es && b3d) b3d.play(null); // en la conversación se queda quieto
    }
  }
  // La barra de navegación se mide una vez visible (oculta mide 0) y deja el sitio al asistente
  function medirNav() { var nb = document.querySelector('.nav-bar'); if (!nb) return; var h = nb.getBoundingClientRect().height; if (h > 0) root.style.setProperty('--uk-navh', h + 'px'); }
  // Se ve siempre, salvo en las páginas a pantalla completa (Mis gastos, la ayuda completa) y con el teclado abierto
  function navVisible() {
    // Mis finanzas y Soporte también la ocultan: son secciones a pantalla completa (se vuelve con la flecha de arriba)
    var sin = view.classList.contains('active') && (view.classList.contains('uk-fin') || host.classList.contains('is-ayuda') || host.classList.contains('is-page') || view.classList.contains('uk-ayuda') || host.classList.contains('is-kb'));
    root.classList.toggle('uk-nonav', !!sin);
    if (!sin) medirNav();
  }
  function pintar() { modo(); pintarMundo(); pintarPropuestas(); pintarHome(); pintarGlobo(); pintarChips(); pintarAccesos(); pintarChat(); pintarResultados(); }
  // Lo que Uku te propone (antes en Mis finanzas): un carrusel arriba, con puntos y una acción por tarjeta
  function pintarPropuestas() {
      // Las propuestas viven en el globo: el carrusel ya no se usa
    props.hidden = true; props.innerHTML = ''; globoEl.style.display = '';
  }
  // El ánimo y las flores de su campo siguen a tus finanzas (las señales van en los insights)
  function pintarMundo() {
    var s = resumen(); if (b3d && s) { b3d.setBloom(s.bloom); b3d.setMood(s.mood); if (b3d.setFinanzas && PFM.finanzas) b3d.setFinanzas(PFM.finanzas()); }
  }

  /* El saludo depende del momento: la hora, si ya pasaste hoy, el día de la semana y lo que
     tienes pendiente. Una frase y, si hay algo que hacer, su acción. */
  var VISTO = 'uk-visto', SAL = null, primeraHoy = false;
  function saludo() {
    if (SAL) return SAL;
    var s = resumen(), A = consejos(), nombre = s && s.nombre ? s.nombre.split(' ')[0] : '';
    if (!s) return { t: 'Hola, soy Uku. ¿Vemos cómo vas hoy?', k: 'dinero', l: 'Ver cómo va mi dinero' }; // todavía sin tus datos: no se guarda
    var ahora = new Date(), h = ahora.getHours(), d = ahora.getDay(), antes = 0;
    // La última visita es de cada persona: a una persona recién elegida no se le dice «Hola otra vez»
    var kv = VISTO + (window.Persona ? ':' + Persona.get() : '');
    try { antes = +localStorage.getItem(kv) || 0; localStorage.setItem(kv, String(ahora.getTime())); } catch (e) {}
    primeraHoy = !antes || new Date(antes).toDateString() !== ahora.toDateString();
    var hoy = antes && new Date(antes).toDateString() === ahora.toDateString(), hace = (ahora.getTime() - antes) / 36e5;
    var n = nombre ? ', ' + nombre : '';
    var hola = hoy && hace > 1 ? 'Qué bueno verte otra vez' + n + '.' : hoy ? 'Hola otra vez' + n + '.'
      : h < 7 ? 'Hola' + n + '. ¿Madrugando?' : h < 12 ? 'Buenos días' + n + '.' : h < 19 ? 'Buenas tardes' + n + '.' : 'Buenas noches' + n + '.';
    var pagos = A.filter(function (c) { return c.id.indexOf('pago:') === 0; });
    SAL = sal(); SAL.hola = hola; return SAL;
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
  // Ocultar una sugerencia del orquestador (p. ej. el viaje en marcha) desde el globo del inicio
  function orqOculto(id) { try { return (JSON.parse(localStorage.getItem('uk-orq-oculto') || '{}'))[Persona.get() + ':' + id]; } catch (e) { return false; } }
  function orqOcultar(id) { try { var o = JSON.parse(localStorage.getItem('uk-orq-oculto') || '{}'); o[Persona.get() + ':' + id] = 1; localStorage.setItem('uk-orq-oculto', JSON.stringify(o)); } catch (e) {} }
  function propuestas() {
    if (quiet()) return [];
    // Solo los consejos que proponen algo que hacer; los hallazgos sueltos y las señales del mundo se cuentan en Mis finanzas
    var O = window.Orquestador ? Orquestador.sugerencias().filter(function (x) { return !orqOculto(x.id); }).map(function (x) { return { id: 'orq:' + x.id, tag: x.etiqueta, t: x.texto, act: true, k: 'orq:' + x.accion, l: x.accionTexto, kind: 'info' }; }) : [];
    return O.concat(consejos().filter(function (x) { return x.act; }).map(function (x) { return { id: x.id, tag: x.tag, t: x.di || x.t, act: true, k: /^app:/.test(x.act || '') ? 'act:' + x.act.slice(4) : x.act ? 'pfm:' + x.act : 'prop:' + x.id, l: x.actl || 'Cuéntame', luego: 'pfm:luego:' + x.id, kind: x.kind }; }));
  }
  function pintarGlobo() {
    var fin = view.classList.contains('uk-fin'), home = host.classList.contains('is-home');
    if (!fin && !home && !mundoOn && !host.classList.contains('is-ayuda')) { globoEl.hidden = true; return; }
    if (home && !nota) return globoHome();
    if (host.classList.contains('is-ayuda') && !nota) return globoSoporte();
    // En Mis finanzas, Uku recomienda: una cosa a la vez (pagos, orden, presupuesto, ahorro), con su acción
    var P = fin ? recomendaciones() : propuestas(), n = P.length, hola = !fin && !saludado && !nota, sal = hola ? saludo() : null, x = !hola && !nota && n ? P[gi % n] : null;
    if (fin && !x && !nota) return globoFin();
    // (el inicio sin nota lo pinta globoHome: la sugerencia o el saludo)
    var t = nota || (hola ? sal.t : x ? x.t : 'Todo está en orden por ahora. ¿Quieres hacer algo hoy?');
    var go = hola ? (home ? null : sal) : x ? { k: x.k, l: x.l } : null;
    // Sin nada que decir (o en silencio), el globo se va y Uku se queda tranquilo
    if (!hola && !nota && !x) { if (b3d) b3d.play('happy'); return ocultarGlobo(); }
    globoOff = false; globoEl.hidden = false; globoEl.classList.remove('is-off');
    if (b3d && b3d.setFront) b3d.setFront(true); // con algo que decir, Uku te mira
    var tag = x ? '<p class="uk-globo__tag">' + esc(x.tag) + '</p>' : '', txt = '<p class="uk-globo__t">' + esc(t) + '</p>';
    var goBtn = go && !nota ? '<button class="bp-action-button bp-action-button--tertiary uk-globo__go" data-k="' + esc(go.k) + '" data-l="' + esc(go.l) + '">' + esc(go.l) + '</button>' : '';
    var html;
    if (home) {
      // Inicio con una nota de Uku («Listo, ya quedó…»): solo la frase
      html = tag + txt + (goBtn ? '<div class="uk-globo__acts">' + goBtn + '</div>' : '');
    } else if (fin) {
      // Mis finanzas (Figma): el globo solo dice; la acción es una tarjeta en la hoja. Tocar a Uku o deslizar pasa a la siguiente.
      html = txt;
      recActual = nota && zonaGo ? Object.assign({ id: 'zona', tag: 'Para tu paisaje' }, zonaGo) : x || null; llenarSlot();
    } else {
      html = '<button class="uk-globo__x" data-k="globo:cerrar" aria-label="Cerrar">' + ic('close') + '</button>' + tag + txt +
        '<div class="uk-globo__acts">' + goBtn +
        (x && x.luego ? '<button class="uk-globo__skip" data-k="' + esc(x.luego) + '" data-l="Ahora no">Ahora no</button>' : '') +
        (hola && n ? '<button class="uk-globo__skip" data-k="siguiente" data-l="Qué me propones">Qué me propones</button>' : '') + '</div>' +
        (!hola && n > 1 ? '<div class="uk-globo__foot"><div class="uk-globo__dots">' + P.map(function (_, i) { return '<i' + (i === gi % n ? ' class="is-on"' : '') + '></i>'; }).join('') + '</div>' +
          '<button class="uk-globo__next" data-k="siguiente" data-l="Siguiente">Siguiente' + ic('chevron_right') + '</button></div>' : '');
    }
    // Lo que Uku ya recomienda no se repite como fila en la hoja (p. ej. «Ordenar mis gastos»)
    host.setAttribute('data-rec', fin && x && /^pfm:/.test(x.k) ? x.k.slice(4) : '');
    // Si nada cambió, no se vuelve a escribir ni a animar (esta función se llama seguido)
    if (!ponerGlobo(html)) return;
    reencuadrar();
    // Uku hace lo que dice: saluda, habla, se preocupa o celebra según el mensaje
    if (b3d) b3d.play(hola ? 'wave' : nota ? 'happy' : !x ? 'happy' : x.kind === 'warn' ? 'worried' : 'talk');
  }
  /* Inicio: el globo es una sugerencia de Uku a la vez (su etiqueta, «1 de n», pasar a la siguiente
     y ocultarla) y los chips de abajo son sobre esa sugerencia. Sin sugerencias, solo el saludo. */
  /* El globo del inicio, en un solo formato: etiqueta (y «1 de n»), la flecha para pasar, la X y el texto;
     sus chips van debajo. Primero el onboarding (la primera vez), después el saludo y luego las sugerencias. */
  function globoActual() {
    var P = propuestas(), n = P.length;
    if (onb >= 0) {
      var o = PASOS[onb](nombreCorto()), ult = onb === PASOS.length - 1;
      return { tag: 'Conóceme', cuenta: (onb + 1) + ' de ' + PASOS.length, t: o.t, chips: o.chips, next: ult ? 'onb:fin' : 'onb:' + (onb + 1), cerrar: 'onb:fin', anim: onb ? 'talk' : 'wave' };
    }
    if (!saludado) {
      var sal = saludo();
      return { tag: 'Uku', t: (sal.hola || 'Hola, soy Uku.') + ' ' + (n === 1 ? 'Tengo una sugerencia para ti.' : n ? 'Tengo ' + n + ' sugerencias para ti.' : '¿En qué te ayudo hoy?'),
        chips: n ? [{ k: 'siguiente', t: n === 1 ? 'Ver la sugerencia' : 'Ver sugerencias' }] : [], next: n ? 'siguiente' : null, cerrar: n ? 'globo:cerrar' : null, anim: 'wave' };
    }
    var x = n ? P[gi % n] : null;
    if (!x) { var s2 = saludo(); return { tag: 'Uku', t: (s2.hola || 'Hola, soy Uku.') + ' ¿En qué te ayudo hoy?', chips: [], anim: 'wave' }; }
    return { tag: x.tag, cuenta: n > 1 ? (gi % n + 1) + ' de ' + n : '', t: x.t, chips: chipsDe(x, P), next: n > 1 ? 'siguiente' : null, cerrar: 'ocultar:' + x.id, anim: x.kind === 'warn' ? 'worried' : 'talk' };
  }
  function globoHome() {
    var g = globoActual(), html;
    globoOff = false; globoEl.hidden = false; globoEl.classList.remove('is-off');
    if (b3d && b3d.setFront) b3d.setFront(true);
    html = '<div class="uk-globo__top"><p class="uk-globo__tag">' + esc(g.tag) + (g.cuenta ? '<span> · ' + g.cuenta + '</span>' : '') + '</p>' +
      (g.next ? '<button class="uk-globo__ib" data-k="' + esc(g.next) + '" data-l="Siguiente" aria-label="Siguiente">' + ic('chevron_right') + '</button>' : '') +
      (g.cerrar ? '<button class="uk-globo__ib" data-k="' + esc(g.cerrar) + '" data-l="Cerrar" aria-label="' + (onb >= 0 ? 'Saltar' : 'Ocultar') + '">' + ic('close') + '</button>' : '') + '</div>' +
      '<p class="uk-globo__t">' + esc(g.t) + '</p>';
    host.setAttribute('data-rec', '');
    if (!ponerGlobo(html)) return;
    reencuadrar();
    if (b3d) b3d.play(g.anim);
  }
  // Soporte: Uku cuenta cómo va tu solicitud o te invita a contarle qué pasó
  function globoSoporte() {
    var c = casos[0], t = c ? (c.como === 'agent' ? 'Tu caso ' + c.id + ' está en revisión. Te aviso apenas tenga la respuesta.' : c.como === 'call' ? 'Tu caso ' + c.id + ' sigue abierto. Si necesitas algo más, cuéntame.' : 'Te vamos a llamar por tu caso ' + c.id + '. Mientras, aquí estoy.')
      : 'Cuéntame qué pasó o busca un tema. Lo resolvemos juntos.';
    globoOff = false; globoEl.hidden = false; globoEl.classList.remove('is-off');
    if (b3d && b3d.setFront) b3d.setFront(true);
    if (!ponerGlobo('<p class="uk-globo__t">' + esc(t) + '</p>')) return;
    reencuadrar();
    if (b3d) b3d.play(c ? 'talk' : 'wave');
  }
  // Los chips de una sugerencia: su acción (o «Cuéntame más») y algo relacionado con ella
  function chipsDe(x, P) {
    var s = resumen(), gasta = s && s.gast > 0, id = x.id, L = [x.act ? { k: x.k, t: x.l } : { k: 'prop:' + id, t: 'Cuéntame más' }], rel = null;
    if (/^orq:/.test(id)) rel = null; // lo del orquestador trae su propia acción
    else if (/^pago:/.test(id)) rel = { k: 'pfm:bills', t: 'Ver todos mis pagos' };
    else if (id === 'tarjeta') rel = { k: 'pfm:debt', t: 'Ver mis deudas' };
    else if (id === 'pres') rel = gasta ? { k: 'ask:¿En qué gasto más?', t: '¿En qué gasto más?' } : null;
    else if (/^nuevo:/.test(id)) { var o = P.filter(function (y) { return /^nuevo:/.test(y.id) && y.id !== id; })[0]; rel = o ? { k: o.k, t: o.l } : null; }
    else if (gasta) rel = { k: 'gastos', t: 'Ver mis gastos' };
    if (rel && !L.some(function (c) { return c.k === rel.k || c.t === rel.t; })) L.push(rel);
    return L;
  }
  // Escribe el globo solo si cambió, y lo escribe palabra a palabra; devuelve si hubo cambio
  function ponerGlobo(html) {
    if (globoEl.dataset.html === html) return false;
    globoEl.dataset.html = html; globoEl.innerHTML = html;
    tipearLuego(globoEl.querySelector('.uk-globo__t'));
    globoEl.classList.remove('is-new'); void globoEl.offsetWidth; globoEl.classList.add('is-new');
    return true;
  }
  /* La pantalla inicial del asistente (wireframe): «Hola, Fran. ¿En qué te ayudo?», tres sugerencias
     atadas a algo concreto y Uku de pie a la derecha; abajo la barra y los entry points. */
  var mundoOn = false, homeEl = null;
  function pintarHome() {
    if (!homeEl) homeEl = host.querySelector('.uk-home');
    var enSec = view.classList.contains('uk-fin') || view.classList.contains('uk-ayuda') || host.classList.contains('uk-in-sec') || ayudaPage;
    var on = !msgs.length && !mundoOn && !enSec;
    host.classList.toggle('is-home', on); host.classList.toggle('is-mundo', !on && !msgs.length && !enSec && mundoOn);
    if (!on) { homeEl.hidden = true; return; }
    input.placeholder = 'Busca o pregunta';
    saludo(); // fija si es la primera visita del día
    // El saludo va en el globo de Uku (wireframe): arriba solo queda la flecha
    homeEl.hidden = true; homeEl.innerHTML = '';
    pintarChips();
  }
  // Lo que Uku recomienda en Mis finanzas: sus consejos del PFM (pagos cercanos, por ordenar, presupuesto,
  // mesadas, ahorro) y, si no hay nada pendiente, lo que cuenta su mundo. Siempre en segunda persona.
  function recomendaciones() {
    // Lo que dice Uku es el diálogo (conversado, en positivo); la fila de la hoja lleva el nombre de la acción y una línea de por qué
    var A = consejos().map(function (x) { return { id: x.id, tag: x.tag, sub: x.sub, t: x.di || x.t, k: /^app:/.test(x.act || '') ? 'act:' + x.act.slice(4) : x.act ? 'pfm:' + x.act : 'prop:' + x.id, l: x.actl || 'Cuéntame', luego: 'pfm:luego:' + x.id, kind: x.kind, icon: x.icon }; });
    // Lo que el orquestador tiene en marcha (p. ej. tu viaje) va primero
    var O = window.Orquestador ? Orquestador.sugerencias().map(function (x) { return { id: 'orq:' + x.id, tag: x.etiqueta, sub: x.detalle, t: x.texto, k: 'orq:' + x.accion, l: x.accionTexto, icon: x.icono }; }) : [];
    A = O.concat(A);
    var W = window.PFM && PFM.world && resumen() ? PFM.world() : [];
    var S = W.filter(function (x) { return /warn|over|pensativo/.test(x.cls || ''); }).map(function (x) { return { id: 'mundo', tag: x.l, t: x.d, k: 'mundo', l: 'Ver mi mundo', icon: 'park' }; });
    return A.concat(S);
  }
  // Debajo de Uku, de 0 a 2 chips de pocas palabras con lo demás que propone (lo que ya dice el globo no se repite)
  var chipsEl = null;
  function pintarChips() {
    if (!chipsEl) chipsEl = host.querySelector('.uk-chips');
    if (!host.classList.contains('is-home')) { chipsEl.hidden = true; return; }
    var L = globoActual().chips || [];
    chipsEl.hidden = !L.length;
    chipsEl.innerHTML = L.map(function (c, i) { return '<button class="uk-chip-s" style="--d:' + (i * 60) + 'ms" data-k="' + esc(c.k) + '" data-l="' + esc(c.t) + '">' + esc(c.t) + '</button>'; }).join('');
  }
  // En Mis finanzas sin nada pendiente, Uku te dice que vas bien (wireframe: «¡Vas muy bien!»)
  function globoFin() {
    var s = resumen(), pf = window.PFM && PFM.perfil ? PFM.perfil() : null;
    var t = !s ? 'Estoy mirando tus movimientos…' : pf === 'nuevo' ? 'Bienvenido. Cuando tengas tus primeros movimientos, aquí verás tu información.'
      : 'Todo está en orden por ahora.';
    globoEl.hidden = false; globoEl.classList.remove('is-off');
    recActual = null; llenarSlot();
    if (!ponerGlobo('<p class="uk-globo__t">' + esc(t) + '</p>')) return;
    reencuadrar();
    // El mundo sigue vivo aunque no haya tarea: planta un brote (si hay flores) y se va a pasear
    if (b3d) { if (!s) b3d.play('talk'); else if (s.bloom > 0 && !RM) { b3d.play('plant'); setTimeout(function () { b3d.setAmbient('walk'); }, 3400); } else b3d.play('happy'); }
  }
  function buscar(on) {
    host.classList.toggle('is-buscar', !!on);
    if (!on) { input.value = ''; input.blur(); }
    modo(); pintarResultados(); reencuadrar();
  }
  // Soporte y Solicitudes: «Pregúntale a Uku» abre el chat con Uku listo para escuchar
  function charla() {
    seccion('uku'); msgs = []; pend = null; agente = null;
    uku('Cuéntame qué necesitas con tus palabras y te ayudo. Si es un inconveniente, dime qué pasó.');
    pintar(); setTimeout(function () { input.focus(); }, 400);
  }
  /* ---------- La hoja de Soporte: bloques con cabecera (título + línea corta + enlace), filas con icono
     solo donde identifican una acción, mosaicos para lo que puedes pedir y chips para los temas ---------- */
  function ayudaHTML() {
    var S = window.Soporte || {}, fl = S.flows ? S.flows() : [], fq = S.faqs ? S.faqs() : [], ct = S.cats ? S.cats() : [], tu = S.tuts ? S.tuts() : [];
    // Patrón de la app (como Perfil): etiqueta de sección en gris y debajo una tarjeta blanca con filas de 64 px
    var sec = function (id, t, sub, rows) { return '<section class="uk-ay__sec"' + (id ? ' id="' + id + '"' : '') + '><div class="uk-ay__label"><div><h2>' + esc(t) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div></div><div class="uk-ay__card">' + rows.join('') + '</div></section>'; };
    var fila = function (attr, icon, t, sm, cls) { return '<button class="uk-ay__row' + (cls ? ' ' + cls : '') + '" ' + attr + ' data-l="' + esc(t) + '">' + (icon ? '<span class="uk-ay__ic"><span class="material-symbols-rounded" aria-hidden="true">' + icon + '</span></span>' : '') + '<span class="uk-ay__main"><b>' + esc(t) + '</b>' + (sm ? '<small>' + esc(sm) + '</small>' : '') + '</span>' + ic('chevron_right') + '</button>'; };
    var cs = casos.slice(0, 3).map(function (x) { return fila('data-k="caso:' + x.id + '"', 'pending_actions', 'Caso ' + x.id + ' · ' + x.t, x.como === 'agent' ? 'En revisión · respuesta en máximo 48 horas' : x.como === 'call' ? 'Abierto · llamaste al call center' : 'Te llamamos con el resumen', 'uk-solrow'); });
    var pedir = [['rev', 'receipt_long', 'Revisar un consumo', 'Pedimos la revisión por ti'], ['act:Préstamos', 'request_quote', 'Préstamos', 'Pedir o revisar'], ['act:Mis tarjetas', 'credit_card', 'Mis tarjetas', 'Pedir o revisar'], ['act:Seguridad', 'lock', 'Seguridad', 'Pedir o revisar']]
      .filter(function (x) { return x[0] === 'rev' || accion(x[2]); }).map(function (x) { return fila('data-k="' + x[0] + '"', x[1], x[2], x[3]); });
    var h = sec('uk-solsec', 'Solicitudes', cs.length ? 'Tus casos abiertos y lo que puedes pedir' : 'No tienes casos abiertos. Lo que pidas desde aquí lo sigues en esta lista', cs.concat(pedir));
    h += sec(null, 'Resolver un inconveniente', 'Uku te pregunta lo justo y te lleva a donde se arregla', fl.map(function (f) { return fila('data-sp="flow:' + f.i + '"', f.icon, f.t); }));
    h += sec(null, 'Preguntas frecuentes', null, [0, 5, 6, 7, 13].filter(function (i) { return fq[i]; }).map(function (i) { return fila('data-sp="faq:' + i + '"', null, fq[i].t); }));
    if (tu.length) h += sec(null, 'Tutoriales', 'Paso a paso, en menos de dos minutos', tu.map(function (u) { return fila('data-sp="tut:' + u.i + '"', u.icon, u.t, u.pasos + ' pasos · ' + u.min + ' min'); }));
    if (ct.length) h += sec(null, 'Temas', null, ct.map(function (c) { return fila('data-sp="cat:' + c.id + '"', c.icon, c.t, c.n === 1 ? '1 tema' : c.n + ' temas'); }));
    return h;
  }
  // Mis finanzas: la acción que Uku recomienda, como tarjeta en la hoja (icono, qué hacer y por qué)
  var recActual = null;
  function llenarSlot() {
    var slot = panel && panel.querySelector('.pfm-hub__slot'); if (!slot) return;
    var fila = function (x) { return '<button class="pfm-hub__act" data-k="' + esc(x.k) + '" data-l="' + esc(x.l) + '"><span class="material-symbols-rounded pfm-hub__act-ic" aria-hidden="true">' + esc(x.icon || 'category') + '</span><span class="pfm-hub__act-t"><b>' + esc(x.l) + '</b><small>' + esc(x.sub || x.tag) + '</small></span>' + ic('chevron_right') + '</button>'; };
    var h = recActual ? fila(recActual) : ''; // una sola sugerencia a la vez: Uku no pierde espacio
    // Se compara contra lo último que se pintó, no contra innerHTML: el navegador lo reescribe distinto y
    // cada diferencia reabría el observador del panel, que volvía a llamar aquí (bucle que congelaba la página)
    if (slot.dataset.h !== h) { slot.dataset.h = h; slot.innerHTML = h; }
  }
  // Soporte como página (Figma): tu solicitud en curso, preguntas frecuentes, todas las categorías; Uku abajo y la barra para preguntarle
  function ayudaPageHTML() {
    var S = window.Soporte || {}, fq = S.faqs ? S.faqs() : [];
    var fila = function (k, icon, t) { return '<button class="uk-ay2__row" data-k="' + esc(k) + '" data-l="' + esc(t) + '">' + (icon ? '<span class="material-symbols-rounded uk-ay2__ic" aria-hidden="true">' + esc(icon) + '</span>' : '') + '<b>' + esc(t) + '</b>' + ic('chevron_right') + '</button>'; };
    // Como en Mis finanzas, pocas tarjetas y compactas para que Uku tenga su espacio arriba.
    // Solicitudes: ícono, título y cuántas hay; con una en curso, su asunto, estado, pasos y cuándo hay respuesta
    var c = casos[0], n = casos.length;
    var h = '<section class="uk-ay2__card uk-ay2__sol">' +
      '<div class="uk-ay2__solhead"><span class="uk-ay2__solic" aria-hidden="true">' + ic('assignment') + '</span><span class="uk-ay2__soltt"><b>Solicitudes</b><small>' +
        (n ? (n === 1 ? '1 en curso' : n + ' en curso') : 'No tienes solicitudes abiertas') + '</small></span>' +
        (n ? '<button class="section__link" data-k="sol" data-l="Ver todas">Ver todas</button>' : '') + '</div>';
    if (c) {
      var paso = c.como === 'call' ? 1 : 2, est = c.como === 'agent' ? 'En revisión' : c.como === 'call' ? 'Abierta' : 'Te llamamos';
      var cuando = c.como === 'agent' ? 'respuesta en máximo 48 horas' : c.como === 'call' ? 'la abriste con el call center' : 'te llamamos con el resumen';
      h += '<button class="uk-ay2__caso" data-k="caso:' + esc(c.id) + '" data-l="Caso ' + esc(c.id) + '">' +
        '<span class="uk-ay2__casotop"><b>' + esc(c.t) + '</b><span class="bp-tag bp-tag--info">' + est + '</span></span>' +
        '<span class="uk-ay2__pasos" aria-label="Paso ' + paso + ' de 3: ' + est + '">' + [0, 1, 2].map(function (i) { return '<i' + (i < paso ? ' class="is-on"' : '') + '></i>'; }).join('') + '</span>' +
        '<small>Caso ' + esc(c.id) + ' · ' + cuando + '</small></button>';
    }
    h += '</section>';
    // Preguntas frecuentes: su título con «Ver todas» (todas las categorías) y las dos más consultadas
    h += '<section class="uk-ay2__card uk-ay2__list"><div class="uk-ay2__hrow"><h3 class="uk-ay2__h">Preguntas frecuentes</h3><button class="section__link" data-k="ayudatoda" data-l="Ver todas las categorías">Ver todas</button></div>' +
      [6, 5].filter(function (i) { return fq[i]; }).map(function (i) { return fila('faq:' + i, fq[i].icon, fq[i].t); }).join('') + '</section>';
    return h;
  }
  function ocultarGlobo() { globoOff = true; globoEl.classList.add('is-off'); if (b3d && b3d.setFront) b3d.setFront(false); setTimeout(function () { if (globoOff) globoEl.hidden = true; reencuadrar(); }, 260); }
  // Al tocarlo: una pose y algo que decir (la siguiente propuesta o una frase corta que se va sola)
  var POSES = ['wave', 'happy', 'nod'];
  function frase() {
    var s = resumen(), L = ['Aquí estoy. Pregúntame lo que quieras.', 'Si quieres, te explico cómo va tu dinero.', 'Puedo ayudarte con una duda o con un inconveniente de tu cuenta.'];
    if (s) L.push('Llevas ' + money0(s.gast) + ' de gastos en ' + s.mes + '. ¿Vemos el detalle?');
    if (s && s.n) L.push('Tienes ' + s.n + ' consumos por ordenar. ¿Los vemos juntos?');
    return L[Math.floor(Math.random() * L.length)];
  }
  var pulso = 1;
  function acercar(z, ms) { if (RM) return; pulso = z; reencuadrar(); clearTimeout(acercar.t); acercar.t = setTimeout(function () { pulso = 1; reencuadrar(); }, ms || 700); }
  function tocado() {
    fx('select'); if (b3d) b3d.play(POSES[Math.floor(Math.random() * POSES.length)]);
    if (msgs.length) return;
    var fin = view.classList.contains('uk-fin'), home = host.classList.contains('is-home');
    if (fin) { nota = null; leyenda(); return; } // en su mundo-dashboard, tocar enseña qué significa cada cosa
    if (home) {
      // Inicio: cada toque trae lo siguiente que tiene para decir (el paso del onboarding, el saludo o la próxima sugerencia)
      if (onb >= 0) { acercar(1.1, 700); return onb < PASOS.length - 1 ? onboarding(onb + 1) : onboardingFin(); }
      if (!saludado) saludado = true; else gi++;
      nota = null; pintarGlobo(); pintarChips(); acercar(1.1, 700); return;
    }
    var P = propuestas();
    if (!saludado) { saludado = true; nota = null; return pintarGlobo(); }
    if (P.length && (globoEl.hidden || Math.random() < .5)) { nota = null; gi++; return pintarGlobo(); }
    nota = frase(); pintarGlobo();
    clearTimeout(tocado.t); tocado.t = setTimeout(function () { if (nota) { nota = null; pintarGlobo(); } }, 6000);
  }
  /* ---------- El paisaje se explica (Mis finanzas) ----------
     Cada zona del claro es una parte de tus finanzas, con su estado y la acción del banco que la mejora:
     los canteros (tu ahorro), los guayacanes (tus inversiones), el bosque (tu presupuesto), lo que tienes por
     tus créditos (la casa, la tiendita…) y Uku (tus gastos por ordenar). Tocar a Uku muestra sus etiquetas
     sobre cada zona; tocar una zona o su etiqueta hace que Uku la explique y te proponga qué hacer. */
  var PROP_L = { casa: 'Tu casa', carro: 'Tu carro', tienda: 'Tus compras', carretilla: 'Tu crédito', nevera: 'Tu nevera', tele: 'Tu televisor', caja: 'Tu compra a cuotas', libros: 'Tus estudios' };
  function zona(id) {
    var W = window.PFM && PFM.world && resumen() ? PFM.world() : [], F = window.PFM && PFM.finanzas ? PFM.finanzas() : null, s = resumen();
    var warn = function (c) { return /warn|over|pensativo/.test(c || ''); };
    var cx = function (cid) { return consejos().filter(function (x) { return x.id === cid; })[0]; };
    if (id === 'ahorro' && W[1]) {
      var tiene = F && (F.ahorro > 0);
      return { t: tiene ? 'Tu ahorro · ' + W[1].v.replace(/^Te alcanza /, '').toLowerCase() : 'Tu ahorro', cls: !tiene ? 'is-calm' : warn(W[1].cls) ? 'is-warn' : 'is-ok', play: 'plant',
        d: tiene ? 'Este apartado muestra tu ahorro. ' + W[1].d : 'Aquí verás tu ahorro. Con tu primer ahorro empieza a mostrarse, y con 3 meses de gastos guardados llegas a la meta recomendada.',
        go: cx('ahorro') ? { k: 'pfm:ahorro', l: 'Programar mi ahorro', icon: 'savings', sub: 'Y mejora tu ahorro' } : { k: 'ask:¿Cuánto más puedo ahorrar?', l: '¿Cuánto puedo ahorrar?', icon: 'savings', sub: 'Uku te lo calcula' } };
    }
    if (id === 'inversion') {
      var inv = F && F.inversion > 0;
      return { t: inv ? 'Tus inversiones · ' + money0(F.inversion) : 'Aquí crece tu inversión', cls: inv ? 'is-ok' : 'is-calm', play: 'happy',
        d: inv ? 'Tus inversiones: ' + money0(F.inversion) + ' que te generan intereses. Cada depósito nuevo suma a tus inversiones.' : 'Aquí verás tus inversiones. Con un depósito a plazo tu dinero gana intereses.',
        go: { k: 'act:Inversiones', l: inv ? 'Ver mis inversiones' : 'Conocer las inversiones', icon: 'trending_up', sub: 'Depósitos a plazo y pólizas' } };
    }
    if (id === 'bosque' && W[2]) {
      var sinPres = s && !s.pres;
      return { t: 'Tu presupuesto · ' + (sinPres ? 'sin presupuesto' : W[2].v.toLowerCase()), cls: warn(W[2].cls) ? 'is-warn' : sinPres ? 'is-calm' : 'is-ok', play: 'nod',
        d: sinPres ? 'Tu presupuesto muestra cuánto puedes gastar cada mes. Cuando cierras el mes con saldo a favor, va bien. Arma tu presupuesto y lo revisamos juntos.' : W[2].d,
        go: sinPres ? { k: 'pfm:pres', l: 'Armar mi presupuesto', icon: 'speed', sub: 'En 3 pasos' } : { k: 'gastos:sem', l: 'Ver mis gastos', icon: 'account_balance_wallet', sub: 'De esta semana' } };
    }
    if (/^credito:/.test(id)) {
      var k = id.split(':')[1], tarjeta = k === 'tienda';
      return { t: (PROP_L[k] || 'Lo que tienes') + (k === 'casa' ? ' · hipoteca' : tarjeta ? ' · tarjetas' : ' · a crédito'), cls: 'is-calm', play: 'happy',
        d: k === 'casa' ? 'Tu casa es tu hipoteca: cada cuota que pagas la hace más tuya.' : tarjeta ? 'La tiendita son tus tarjetas: lo que compras con ellas. Si pagas el total, no pagas intereses.' : 'Esto es lo que tienes gracias a tu crédito. Al día con tus cuotas, todo sigue en su lugar.',
        go: tarjeta ? { k: 'act:Pagar tarjeta', l: 'Pagar mi tarjeta', icon: 'credit_card', sub: 'El total, sin intereses' } : { k: 'pfm:debt', l: 'Ver mis deudas', icon: 'account_balance', sub: 'Saldos y cuotas' } };
    }
    if (id === 'uku' && W[0]) {
      return { t: 'Uku · ' + (s && s.n ? s.n + ' por ordenar' : 'todo en orden'), cls: warn(W[0].cls) ? 'is-warn' : 'is-ok', play: s && s.n ? 'worried' : 'happy', d: W[0].d,
        go: s && s.n ? { k: 'pfm:game', l: 'Clasificar conmigo', icon: 'category', sub: s.n + ' consumos' } : null };
    }
    return null;
  }
  var leyendaEl = null, zonaGo = null;
  function leyenda() {
    if (!leyendaEl) leyendaEl = host.querySelector('.uk-leyenda');
    if (!b3d || !b3d.head || !resumen()) return;
    var R = host.getBoundingClientRect(), H = b3d.head(), L = b3d.lugares ? b3d.lugares() : [];
    // Las etiquetas viven en el paisaje que se ve: nunca debajo del globo, la bienvenida o la hoja
    var top = 8, bot = R.height - 40;
    [globoEl].forEach(function (el) { if (el && !el.hidden && el.offsetParent) top = Math.max(top, el.getBoundingClientRect().bottom - R.top + 6); });
    var hoja = panel && panel.offsetParent ? panel.getBoundingClientRect().top - R.top - 36 : null; if (hoja != null && hoja > top) bot = Math.min(bot, hoja);
    var items = L.map(function (p) { return { id: p.id, x: p.x - 60, y: p.y - 36, z: zona(p.id) }; });
    if (H) items.push({ id: 'uku', x: H.x - 70, y: H.y - H.r - 44, z: zona('uku') });
    items = items.filter(function (it) { return it.z; });
    // Que no se pisen: de arriba a abajo, cada etiqueta baja si choca con la anterior
    items.sort(function (a, b) { return a.y - b.y; }).forEach(function (it, j, A) { for (var q = 0; q < j; q++) if (Math.abs(A[q].x - it.x) < 140 && Math.abs(A[q].y - it.y) < 32) it.y = A[q].y + 34; });
    leyendaEl.hidden = false; leyendaEl.classList.remove('is-off');
    leyendaEl.innerHTML = items.map(function (it, j) { var x = Math.max(8, Math.min(R.width - 168, it.x)), y = Math.max(top, Math.min(bot, it.y)); return '<button class="uk-leyenda__chip ' + it.z.cls + '" style="--d:' + (j * 70) + 'ms; left:' + x.toFixed(0) + 'px; top:' + y.toFixed(0) + 'px" data-k="leyenda:' + esc(it.id) + '" data-l="' + esc(it.z.t) + '"><i></i>' + esc(it.z.t) + '</button>'; }).join('');
    if (b3d) b3d.play('nod');
    clearTimeout(leyenda.t); leyenda.t = setTimeout(function () { leyendaEl.classList.add('is-off'); setTimeout(function () { leyendaEl.hidden = true; }, 220); }, 4200);
  }
  // Uku explica una zona y deja en la hoja la acción del banco que la mejora
  function explicar(id) {
    var z = zona(id); if (!z) return;
    if (leyendaEl) { leyendaEl.classList.add('is-off'); setTimeout(function () { leyendaEl.hidden = true; }, 220); }
    nota = z.d; zonaGo = z.go; pintarGlobo();
    if (b3d) b3d.play(z.play);
    acercar(1.15, 1200);
    clearTimeout(explicar.t); explicar.t = setTimeout(function () { nota = null; zonaGo = null; pintarGlobo(); }, 9000);
  }
  /* ---------- Encuadre: que nunca le tapen la cara ----------
     Se mide lo que hay en pantalla (globo, propuestas, onboarding arriba; accesos y barra abajo) y se
     corre la cámara para que la cara de Uku quede en la franja libre. Si la franja es más chica que
     su cabeza, la cámara se aleja. Conversando no aplica: ahí Uku se asoma abajo a propósito. */
  function encuadrar(instante) {
    // Mis finanzas y Soporte: plano general, Uku en su mundo entero; en el resto, la cámara cerca
    var sop = host.classList.contains('is-ayuda'), fin = host.classList.contains('is-fin') || sop, sec = sop ? chat : panel;
    if (b3d && b3d.setPlano) b3d.setPlano(fin && !host.classList.contains('is-page'));
    if (!b3d || !b3d.head || (host.classList.contains('is-chat') && !fin)) return;
    var H = b3d.head(); if (!H) return;
    var R = host.getBoundingClientRect(), hh = R.height; if (!hh) return;
    var top = 0, bot = hh;
    // Se mide la posición de diseño (sin transformaciones ni fundidos): así el encuadre apunta desde el
    // primer momento a donde van a quedar el globo, los chips o la hoja, y la cámara hace un solo movimiento
    var topDe = function (el) { var y = 0, e = el; while (e && e !== host) { y += e.offsetTop; e = e.offsetParent; } return y; };
    var abajo = function (el) { if (el && !el.hidden && el.offsetHeight) top = Math.max(top, topDe(el) + el.offsetHeight); };
    var arriba = function (el) { if (el && !el.hidden && el.offsetHeight) bot = Math.min(bot, topDe(el)); };
    var home = host.classList.contains('is-home');
    if (fin) { abajo(host.querySelector('.uk-chathead')); if (!host.classList.contains('is-up')) abajo(globoEl); arriba(sec); }
    else if (home) { abajo(homeEl); abajo(globoEl); arriba(host.querySelector('.uk-bar')); arriba(pills); }
    else { abajo(globoEl); abajo(props); abajo(host.querySelector('.uk-head')); arriba(pills); arriba(host.querySelector('.uk-bar')); }
    // Mis finanzas: plano general. Uku queda de pie sobre el borde de la sección fija, con su mundo alrededor
    // (el bosque, la casa, las flores); el globo va arriba, sobre el cielo
    if (fin) {
      if (host.classList.contains('is-page')) return;
      var rF = H.r, pt = sec ? topDe(sec) : bot, yF = H.y + hh * H.shiftY;
      var tF = Math.max(top + rF + 10, pt - 3.6 * rF - 64), svF = (yF - tF) / hh; // los pies, un poco sobre la sección: se ve el suelo y las flores
      b3d.setShift(0, Math.max(-.6, Math.min(.5, svF)), instante);
      var zF = 1.2 / pulso; if (Math.abs(zF - H.zoomTo) > .02) b3d.setZoom(zF, instante);
      return;
    }
    // Cada lugar tiene su encuadre: en el inicio Uku está cerca y a la derecha; en su mundo, al centro
    var base = (home ? 1.12 : 1) / pulso, sx = home ? .24 : 0;
    var M = 12, band = bot - top - 2 * M, r = H.r, need = 2 * r + 24, zoom = H.zoom;
    if (band < need) zoom = Math.min(1.8, H.zoom * need / Math.max(40, band));
    else if (band > need * 1.35) zoom = Math.max(base, Math.min(H.zoom, H.zoom * need * 1.15 / band));
    if (zoom < base - .02 && band >= need) zoom = base;
    // La cara, en el tercio alto de la franja: el cuerpo sigue hacia abajo
    var target = home ? top + M + r + 6 : top + M + Math.max(r + 8, band * .38); // en el inicio, la cabeza queda justo bajo el globo (atado a él)
    var y0 = H.y + hh * H.shiftY, sv = (y0 - target) / hh;
    b3d.setShift(sx, Math.max(-.6, Math.min(.5, sv)), instante);
    if (Math.abs(zoom - H.zoomTo) > .02) b3d.setZoom(zoom, instante);
  }
  // Mientras la pantalla se acomoda (globo que entra, hoja que sube, chips, teclado) el encuadre se recalcula
  // seguido durante un segundo: la cámara sigue el movimiento con suavidad en vez de dar dos saltos
  function reencuadrar() {
    clearInterval(reencuadrar.i); clearTimeout(reencuadrar.fin);
    if (!RM) requestAnimationFrame(function () { encuadrar(); }); else encuadrar();
    reencuadrar.i = setInterval(function () { encuadrar(); }, 80);
    reencuadrar.fin = setTimeout(function () { clearInterval(reencuadrar.i); encuadrar(); }, 1100);
  }
  // Los accesos: Mis finanzas, ordenar, consejos y ayuda, a un toque desde Uku
  function pintarAccesos() {
    var W = window.PFM && PFM.world && resumen() ? PFM.world() : [], pe = W[2] ? W[2].cls : null;
    var p = function (k, icon, t, sub, dot) { return '<button class="uk-pill" data-k="' + k + '" data-l="' + esc(t) + '">' + ic(icon) + '<b>' + esc(t) + '</b><small>' + esc(sub) + '</small>' + (dot ? '<i class="uk-pill__dot ' + dot + '" aria-hidden="true"></i>' : '') + '</button>'; };
    // Dos accesos = dos cosas que hace este lugar: ver tus datos y ayudarte con la app (las solicitudes viven dentro de Ayuda y soporte). Solo nombres.
    pills.innerHTML = p('fin', 'monitoring', 'Mis finanzas', 'Organicemos tus gastos', pe ? (/warn|over/.test(pe) ? 'is-warn' : 'is-ok') : '') +
      p('soporte', 'headset_mic', 'Soporte', 'Resolvamos tus dudas');
  }

  /* ---------- Escribiendo: resultados flotando sobre su mundo ---------- */
  // Una sugerencia: texto y, si hace falta, de qué tipo es; sin ícono (la lista ya dice qué es)
  function fila(k, icon, t, s, r) {
    return '<button class="uk-row" data-k="' + esc(k) + '" data-l="' + esc(t) + '">' + (icon ? '<span class="uk-row__ic">' + ic(icon) + '</span>' : '') + '<span class="uk-row__t"><b>' + esc(t) + '</b>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</span>' + (r ? '<span class="uk-row__r">' + esc(r) + '</span>' : ic('chevron_right')) + '</button>';
  }
  function texto(t) { return String(t || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ''); }
  /* ---------- Búsqueda universal mientras escribes ----------
     Un solo lugar para encontrar lo que sea: la frase hecha acción («transferir 20 a maría»), tus
     movimientos (por nombre o por monto), las personas con las que te mueves dinero, tu dinero, la
     ayuda, las acciones y las pantallas de la app. Uku encabeza: siempre puedes preguntarle. */
  var RES = { it: null, tx: [], per: [], app: [] };
  function pintarResultados() {
    var q = input.value.trim();
    if (!q) {
      if (!host.classList.contains('is-buscar')) { results.innerHTML = ''; return; }
      var sal = saludo(), P = propuestas(), sug = [{ k: sal.k, t: sal.l }];
      P.forEach(function (x) { if (sug.length < 4 && !sug.some(function (r) { return r.k === x.k || r.t === x.l; })) sug.push({ k: x.k, t: x.l }); });
      results.innerHTML = '<p class="uk-results__l">Sugerencias</p>' + sug.map(function (r) { return fila(r.k, null, r.t, ''); }).join('') +
        '<p class="uk-results__l">También puedes</p>' + fila('fin', 'monitoring', 'Mis finanzas', 'Gastos, presupuesto y movimientos') + fila('ayudatoda', 'help', 'Soporte', 'Preguntas, inconvenientes y solicitudes') + fila('escanear', 'photo_camera', 'Leer un QR o una factura', 'Con la cámara');
      return;
    }
    var n = norm(q), ws = n.split(/\s+/).filter(Boolean), dinero = (DINERO.test(n) || (PLATA.test(n) && !HACER.test(n))) && resumen();
    var esMonto = /^\$?\s*\d+([.,]\d{1,2})?$/.test(n);
    RES.it = window.Buscador && Buscador.intent ? Buscador.intent(q) : null;
    // «transferir 20 a kevin»: la persona sale de con quién te mueves dinero, no de una lista fija
    if (RES.it && RES.it.action === 'Transferir dinero' && !RES.it.who && window.PFM && PFM.contactos) {
      var quien = null; ws.filter(function (x) { return x.length > 2 && !/^(transfer|envi|mand|pasa|deposit|dinero|plata)/.test(x); }).some(function (x) { var c = PFM.contactos(x)[0]; if (c) { quien = c.n; return true; } return false; });
      if (quien) { RES.it.who = quien; RES.it.name += ' a ' + quien; }
    }
    RES.tx = window.PFM && PFM.buscar ? PFM.buscar(q, esMonto ? 4 : 3) : [];
    RES.per = !esMonto && ws[0] && ws[0].length > 2 && window.PFM && PFM.contactos ? PFM.contactos(ws[0]).slice(0, 2) : [];
    RES.app = window.Buscador && Buscador.app ? Buscador.app(q).slice(0, 2) : [];
    var acts = acciones(q).slice(0, 2), H = ayuda(q, 4).filter(function (h) { return h.kind !== 'flow' && (ws.length > 1 || norm(h.t).indexOf(ws[0]) >= 0); }).slice(0, 2);
    // Uku, primero: con lo que encontró, dice qué puede hacer con eso
    var dice = RES.tx.length && esMonto ? 'Encontré ' + RES.tx.length + ' movimiento' + (RES.tx.length > 1 ? 's' : '') + ' por ese monto' : RES.tx.length ? 'Esto es lo que encuentro sobre «' + q + '»' : RES.per.length ? 'Te explico cómo vas con ' + RES.per[0].n.split(' ')[0] : '“' + q + '”';
    var html = fila('ask:' + q, null, 'Preguntarle a Uku', dice);
    if (RES.it) html += '<p class="uk-results__l">Hacer ahora</p>' + fila('res:it', RES.it.icon, RES.it.name, 'Con los datos ya puestos');
    if (dinero) html += '<p class="uk-results__l">Tu dinero</p>' + fila('dinero', null, 'Cómo va mi dinero', 'Disponible, gastos y presupuesto');
    if (RES.per.length) html += '<p class="uk-results__l">Personas</p>' + RES.per.map(function (x, i) { return fila('res:per:' + i, 'send_money', 'Transferir a ' + x.n, (x.veces === 1 ? '1 vez' : x.veces + ' veces') + ' · la última el ' + x.ultL); }).join('');
    if (RES.tx.length) html += '<p class="uk-results__l">Movimientos</p>' + RES.tx.map(function (t, i) { return fila('res:tx:' + i, null, t.t, t.f + ' · ' + t.src, (t.m > 0 ? '+' : '−') + money(Math.abs(t.m))); }).join('');
    // La base de conocimiento suma lo que Soporte no tiene: productos (con su dato principal) y más preguntas, con sinónimos y errores de tipeo
    var KBR = window.Conocimiento && Conocimiento.cargada() ? Conocimiento.buscar(q, { n: 6 }) : [], vistosH = {};
    H.forEach(function (h) { vistosH[norm(h.t)] = 1; });
    var KBF = KBR.filter(function (x) { return x.tipo === 'faq' && !vistosH[norm(x.t)]; }).slice(0, Math.max(0, 2 - H.length)), KBP = KBR.filter(function (x) { return x.tipo === 'producto'; }).slice(0, 2);
    if (H.length || KBF.length) html += '<p class="uk-results__l">Ayuda</p>' + H.map(function (h) { return fila(h.kind + ':' + h.i, null, h.t, h.kind === 'tut' ? 'Tutorial' : ''); }).join('') + KBF.map(function (x) { return fila('kb:' + x.id, null, x.t, ''); }).join('');
    if (KBP.length) html += '<p class="uk-results__l">Productos</p>' + KBP.map(function (x) { return fila('kb:' + x.id, null, x.t, x.e.datos && x.e.datos[0] ? x.e.datos[0][0] + ': ' + Conocimiento.texto(x.e.datos[0][1]) : ''); }).join('');
    if (acts.length) html += '<p class="uk-results__l">Hacer</p>' + acts.map(function (a) { return fila('act:' + a.label, iconoDe({ k: 'act:' + a.label, ic: a.icon }), a.label, ''); }).join('');
    if (RES.app.length) html += '<p class="uk-results__l">En la app</p>' + RES.app.map(function (a, i) { return fila('res:app:' + i, null, a.label, a.sub || ''); }).join('');
    results.innerHTML = html;
  }
  // Lo que se tocó en los resultados: abrir el movimiento, transferir a la persona, la pantalla o la acción con datos
  function resultado(v) {
    var p = v.split(':');
    if (p[0] === 'it' && RES.it) { salir(RES.it.name, true); return Buscador.atajo(RES.it); }
    if (p[0] === 'tx') { var t = RES.tx[+p[1]]; if (!t) return; salir(t.t, true); seccion('fin'); return setTimeout(function () { PFM.key('tx:' + t.i); }, 200); }
    if (p[0] === 'per') { var x = RES.per[+p[1]]; if (!x) return; salir('Transferir a ' + x.n, true); return Buscador.atajo({ action: 'Transferir dinero', icon: 'send_money', who: x.n, name: 'Transferir a ' + x.n }); }
    if (p[0] === 'app') { var a = RES.app[+p[1]]; if (!a) return; salir(a.label, true); return Buscador.abrir(a.label); }
  }

  /* ---------- La conversación ----------
     Cada mensaje de Uku trae sus botones; solo los del último se pueden
     tocar, así la conversación avanza y no quedan preguntas viejas abiertas. */
  function me(t) { msgs.push({ me: t }); }
  function uku(t, btns, extra, o) { o = o || {}; msgs.push({ uku: t, btns: btns || [], extra: extra || '', nuevo: true, title: o.title, rows: o.rows, flow: o.flow, num: o.num, meter: o.meter, stats: o.stats, bars: o.bars, pregunta: o.pregunta, voto: o.voto, links: o.links, ia: o.ia }); ultimo = Date.now(); if (b3d) b3d.play('talk'); }
  function b(k, t, icon, cls) { return { k: k, t: t, ic: icon, cls: cls }; }
  function mostrar() { input.value = ''; modo(); pintarChat(); pintarResultados(); }
  // Lo que escribes: tu dinero, la ayuda o una acción de la app
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
    // Todo lo que escribes pasa primero por el orquestador (orquestador/LEEME.md); si ninguna de sus habilidades
    // lo atiende, responde lo de siempre
    if (window.Orquestador) {
      mostrar(); // tu mensaje se ve de una
      return Orquestador.enviar({ texto: q }).then(function (r) { if (r && r.manejado) orqPintar(r); else responderLocal(q, n); }, function () { responderLocal(q, n); });
    }
    responderLocal(q, n);
  }
  // Lo que todavía responde el front (se puede ir pasando al orquestador como habilidades)
  function responderLocal(q, n) {
    // Pedir una persona es pedir una persona: sin rodeos
    if (/persona|humano|asesor|agente|ejecutiv/.test(n)) { persona(); return mostrar(); }
    // Su mundo: Uku te cuenta cómo está, en primera persona (sus flores, su bosque y su ánimo son tus finanzas)
    if (/mundo|bosque|flores|como estas|tu animo|como te sientes|quien eres/.test(n) && window.PFM && PFM.world) { mundo(); return mostrar(); }
    // 1. Cómo va mi dinero
    if (DINERO.test(n) && !HACER.test(n) && resumen()) { dinero(); return mostrar(); }
    var fin = finanzas(q), acts = acciones(q).slice(0, 2), H = ayuda(q, 3), ws = n.replace(/[¿?¡!.,]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2; });
    // Un «por qué» o «qué es» que coincide fuerte con un tema (ISD, intereses, comisiones) va antes que un inconveniente
    var tm = Soporte.tema ? Soporte.tema(q, 1) : [], fl = H.filter(function (h) { return h.kind === 'flow'; })[0], esFlujo = fl && !fin && !/^(que es|que significa|cuanto tarda|donde veo|por que)/.test(n);
    // La base de conocimiento (preguntas, productos y acciones): si una entrada coincide claro, responde con ella;
    // un inconveniente guiado va primero porque pregunta lo justo en vez de explicar
    var kb = window.Conocimiento && Conocimiento.cargada() ? Conocimiento.responder(q) : null;
    if (kb && kb.conf === 'alta' && kb.tipo !== 'accion' && !fin && !esFlujo) return kbCard(kb, q);
    if (tm.length && tm[0].sc >= 6 && !fin) return temaCard(tm[0].i, q);
    // 3. Un inconveniente: si lo que escribes se parece a uno, Uku lo guía paso a paso
    if (esFlujo) return flujo(fl.i, 'ini');
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
    // Lo que Soporte no cubre, lo responde la base de conocimiento (pregunta, producto o la acción que pide)
    else if (kb && kb.tipo !== 'accion') return kbCard(kb, q);
    else if (kb && kb.tipo === 'accion') uku('Te llevo a ' + esc(kb.t.toLowerCase()) + '. ¿Lo hacemos?', [b(kbKey(kb.go), kb.t, kb.icon || 'arrow_forward')].concat(kb.otras.slice(0, 1).map(function (x) { return b('kb:' + x.id, x.t, null, 'is-ask'); })), '', { title: q });
    else return iaCard(q); // lo que no está en reglas ni en la ayuda: Uku busca y, si no, lo mira con IA
    mostrar();
  }
  /* Lo que responde el orquestador, dibujado con los bloques de siempre: texto, título, cifra, barras, filas,
     medidor y una lista de medidores; sus botones vuelven al orquestador (orq:<id>). El front no decide nada. */
  function orqPintar(r) {
    (r.mensajes || []).forEach(function (m) {
      var btns = (m.acciones || []).map(function (a) { return b('orq:' + a.id, a.texto, a.icono, a.estilo === 'pregunta' ? 'is-ask' : ''); });
      var med = m.medidores ? '<div class="uk-medidores">' + m.medidores.map(function (x) {
        return '<div class="uk-medidor' + (x.tono ? ' is-' + esc(x.tono) : '') + '"><span>' + esc(x.l) + '</span><b>' + esc(x.d || '') + '</b><i><u style="width:' + Math.max(x.v ? 3 : 0, Math.min(100, x.v / (x.max || 1) * 100)).toFixed(1) + '%"></u></i></div>'; }).join('') + '</div>' : '';
      uku(esc(m.texto), btns, med, { title: m.titulo, num: m.cifra, bars: m.barras, rows: m.filas, meter: m.medidor ? { v: m.medidor.v, max: m.medidor.max, l: m.medidor.l, cls: m.medidor.tono } : null });
    });
    (r.efectos || []).forEach(function (e) {
      if (e.tipo === 'animo' && b3d) setTimeout(function () { if (b3d) b3d.play(e.valor); }, RM ? 0 : 700);
      if (e.tipo === 'aviso' && window.PFM && PFM.toast) PFM.toast(e.texto);
    });
    mostrar();
  }
  function orqAccion(id, l, enChat) {
    // Desde Mis finanzas (la sugerencia del orquestador), la conversación sigue en el chat
    if (!enChat) { seccion('uku'); me(l); mostrar(); }
    return Orquestador.enviar({ accion: id }).then(orqPintar, function () { uku('No pude seguir con eso ahora. Probemos de nuevo en un momento.'); mostrar(); });
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
  // Una entrada de la base de conocimiento (assets/conocimiento/base.json): respuesta, datos del producto, pasos y acciones
  function kbKey(k) {
    if (k === 'handoff') return 'persona';
    if (k === 'sol') return 'sol';
    if (k === 'search') return 'buscar';
    if (k.indexOf('ask:') === 0) return k;
    return 'sp:' + k;
  }
  function kbCard(v, q) {
    var btns = (v.go ? [b(kbKey(v.go), v.tipo === 'accion' ? v.t : 'Abrir', v.icon || 'arrow_forward')] : []).concat(v.acts.map(function (a) { return b(kbKey(a[1]), a[0], a[1] === 'handoff' ? 'support_agent' : 'arrow_forward'); }));
    if (v.otras) btns = btns.concat(v.otras.filter(function (x) { return x.tipo !== 'accion'; }).slice(0, 2).map(function (x) { return b('kb:' + x.id, x.t, null, 'is-ask'); }));
    uku(esc(v.r), btns, v.pasos.length ? '<ol class="uk-steps">' + v.pasos.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '',
      { title: v.t, rows: v.datos.length ? v.datos : null, links: v.links.length ? v.links : null, voto: true });
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
  // El análisis del mes (lo que antes era la pantalla «Análisis de Uku»): resumen, hallazgos y plan
  function analisisCard(o) {
    var p = window.Asistente && Asistente.pack ? Asistente.pack(o.view) : null;
    if (!p || !window.UkuAnalisis || !UkuAnalisis.build) return iaResponde(o.ask || '¿Cómo voy este mes?');
    var r = UkuAnalisis.build(p);
    var finds = r.finds.length ? '<div class="uk-finds"><p class="uk-finds__l">Lo que encontré</p>' + r.finds.map(function (f) { return '<p class="uk-find"><b>' + esc(f.t) + '</b><small>' + esc(f.s) + '</small></p>'; }).join('') + '</div>' : '';
    var btns = r.plan.filter(function (x) { return x.k; }).map(function (x) {
      var k = x.k.indexOf('go:') === 0 ? 'act:' + x.k.slice(3) : x.k === 'budgets' ? 'pfm:pres' : 'pfm:' + x.k;
      return b(k, x.b || x.t, x.k.indexOf('go:') === 0 ? 'credit_card' : 'speed');
    }).concat(r.qs.filter(function (q) { return norm(q) !== norm(o.ask || ''); }).slice(0, 3).map(function (q) { return b('ask:' + q, q, null, 'is-ask'); })); // no repite la pregunta que se acaba de hacer
    seccion('uku'); me(o.ask || '¿Cómo voy este mes?');
    uku(esc(r.sum), btns, finds, { title: p.current ? 'Cómo vas en ' + p.mes : 'Tu ' + p.mes + ', analizado', ia: true, voto: true });
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
  /* Onboarding: la primera vez, Uku se presenta en su globo, con el mismo formato de sus sugerencias
     («Conóceme · 1 de 3», la flecha para pasar, la X para saltarlo y tus respuestas como chips debajo).
     Después siguen el saludo y sus sugerencias de siempre. Te llama por el nombre de la persona de Perfil. */
  var ONB = 'uk-onboard', onb = -1;
  function nombreCorto() { var s = resumen(); return s && s.nombre ? s.nombre.split(' ')[0] : ''; }
  var PASOS = [
    function (n) { return { t: (n ? 'Hola, ' + n + '. ' : 'Hola. ') + 'Soy Uku, tu asistente en Pichibank. Te explico cómo va tu dinero, respondo tus dudas y te ayudo con lo que necesites, sin salir de aquí.',
      chips: [{ k: 'onb:1', t: '¿Qué puedes hacer?' }, { k: 'onb:fin', t: 'Ya te conozco' }] }; },
    function () { return { t: 'En Mis finanzas ves tu ahorro, tu presupuesto y tus gastos ordenados. Mi mundo cambia con tus finanzas: cuando te va bien, florece.',
      chips: [{ k: 'onb:2', t: '¿Y cómo te hablo?' }] }; },
    function (n) { return { t: 'Escríbeme o díctame aquí abajo' + (n ? ', ' + n : '') + ', o tómale una foto a un QR o a una factura. Si algo no lo sé, lo busco por ti.',
      chips: [{ k: 'onb:fin', t: 'Empecemos' }] }; }];
  function onboarding(i) {
    onb = Math.max(0, Math.min(PASOS.length - 1, i || 0));
    globoEl.dataset.html = ''; pintarGlobo(); pintarChips(); fx('select');
    if (b3d) b3d.play(onb ? 'talk' : 'wave');
  }
  // Al terminar (o al saltarlo), el globo pasa a las sugerencias de siempre
  function onboardingFin() {
    try { localStorage.setItem(ONB, '1'); } catch (e) {}
    onb = -1; saludado = true; gi = 0; nota = null; fx('success'); if (b3d) b3d.play('happy');
    globoEl.dataset.html = ''; pintarGlobo(); pintarChips();
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
  // Lo que trae un mensaje de Uku además del texto: cifra, medidor, estadísticas, barras, datos, enlaces, filas y chips
  function artefactos(m, on) {
    var nav = m.btns.filter(function (x) { return !/is-ask/.test(x.cls || ''); }), ask = m.btns.filter(function (x) { return /is-ask/.test(x.cls || ''); });
    var dentro = (m.num ? '<p class="uk-num"><b>' + esc(m.num.v) + '</b><small>' + esc(m.num.l) + '</small></p>' : '') +
      (m.meter ? '<div class="uk-meter' + (m.meter.cls ? ' is-' + m.meter.cls : '') + '"><i style="width:' + Math.max(2, Math.min(100, m.meter.v / (m.meter.max || 1) * 100)).toFixed(1) + '%"></i></div><p class="uk-meter__l">' + esc(m.meter.l) + '</p>' : '') +
      (m.stats ? '<div class="uk-stats">' + m.stats.map(function (x) { return '<div class="uk-stat' + (x.cls ? ' is-' + x.cls : '') + '"' + (x.saldo ? ' data-saldo' : '') + '>' + ic(x.ic || 'info') + '<b>' + esc(x.v) + '</b><small>' + esc(x.l) + '</small></div>'; }).join('') + '</div>' : '') +
      (m.bars ? '<div class="uk-barras">' + (function () { var mx = Math.max.apply(null, m.bars.map(function (b) { return b.v; }).concat([1])); return m.bars.map(function (b) { return '<div class="uk-barra"><span>' + esc(b.l) + '</span><b>' + money0(b.v) + '</b><i style="width:' + Math.max(3, b.v / mx * 100).toFixed(1) + '%"></i></div>'; }).join(''); })() + '</div>' : '') +
      (m.rows ? '<dl class="uk-card__data">' + m.rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' : '') + (m.extra || '') +
      (m.links && m.links.length ? '<div class="uk-links"><small>Para leer más</small>' + m.links.map(function (l) { return '<a class="uk-link" href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + ic('open_in_new') + esc(l[0]) + '</a>'; }).join('') + '</div>' : '');
    var fuera = !on ? '' : (nav.length ? '<div class="uk-card__nav">' + nav.map(function (x, j) { var ico = iconoDe(x); return '<button class="uk-card__row' + (ico ? ' has-ic' : '') + '" style="--d:' + j * 40 + 'ms" data-k="' + esc(x.k) + '" data-l="' + esc(x.t) + '">' + (ico ? ic(ico) : '') + '<span>' + esc(x.t) + '</span>' + ic('chevron_right') + '</button>'; }).join('') + '</div>' : '') +
      (ask.length ? (m.pregunta ? '<p class="uk-msg__q">' + esc(m.pregunta) + '</p>' : '') + '<div class="uk-msg__acts">' + ask.map(function (x, j) { return '<button class="uk-chip is-ask" style="--d:' + (nav.length + j) * 40 + 'ms" data-k="' + esc(x.k) + '" data-l="' + esc(x.t) + '">' + (x.ic ? ic(x.ic) : '') + esc(x.t) + '</button>'; }).join('') + '</div>' : '') +
      (m.voto ? '<div class="uk-voto' + (m.votado ? ' is-' + m.votado : '') + '"><span>' + (m.votado === 'up' ? 'Gracias por contarme.' : m.votado === 'down' ? 'Busquemos otra forma.' : '¿Te sirvió?') + '</span>' + (m.votado ? '' : '<button data-k="voto:down" aria-label="No me sirvió">' + ic('thumb_down') + '</button><button data-k="voto:up" aria-label="Sí me sirvió">' + ic('thumb_up') + '</button>') + '</div>' : '');
    return { dentro: dentro, fuera: fuera };
  }
  function pintarChat() {
    host.classList.remove('is-cards');
    if (ayudaPage && !msgs.length) { chat.innerHTML = ayudaPageHTML(); chat.hidden = false; return; }
    if (ayudaPage && msgs.length) { ayudaPage = false; host.classList.remove('is-ayuda'); tituloDe('uku'); }
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
        '<div class="uk-msg__body">' + (cara && m.ag ? '<small class="uk-msg__who">' + esc(agente ? agente.n : 'Asesora') + ' · Pichibank</small>' : '') + (function () { var A = artefactos(m, on && nuevo < 0); return '<div class="uk-msg__b">' + (m.title && !m.ag ? '<b class="uk-msg__t">' + esc(m.title) + '</b>' : '') + '<p>' + m.uku + '</p>' + A.dentro + '</div>' + A.fuera; })() +
        '</div></div>'; // las filas y chips ya vienen en artefactos()
    }).join('') +
      (nuevo >= 0 ? '<div class="uk-msg is-typing' + (msgs[nuevo].ag ? ' is-agent' : '') + '"><span class="uk-msg__face" aria-hidden="true">' + cara_(msgs[nuevo]) + '</span><div class="uk-msg__body"><p class="uk-msg__b uk-dots" aria-label="' + (msgs[nuevo].ag ? 'Está escribiendo' : 'Uku está escribiendo') + '"><i></i><i></i><i></i></p></div></div>' : '');
    // Lo nuevo de Uku se escribe palabra a palabra, como en un chat de IA; las filas y los botones entran cuando termina
    Array.prototype.forEach.call(chat.querySelectorAll('.uk-msg:not(.is-seen):not(.is-typing):not(.is-agent) .uk-msg__b > p'), function (pe) {
      var el = pe.closest('.uk-msg'); if (el) el.style.setProperty('--wait', Math.min(duracionTipeo(pe.textContent), 2600) + 'ms');
      tipearLuego(pe);
    });
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
  /* El asistente se abre desde arriba y Uku entra directo en modo asistente: cerca, mirándote, con
     una tarjeta de bienvenida (su saludo, lo que propone y los accesos). Su mundo es un lugar al
     que puedes ir («Ver mi mundo»), no la pantalla de llegada. */
  var abriendo = false;
  function mostrarEscena() { var sc = host.querySelector('.uk-scene'); if (sc && b3d && b3d.isReady && b3d.isReady()) sc.classList.add('is-framed'); }
  // Desde otros lugares (p. ej. el buscador): ir a la pestaña del asistente
  function abrirAsistente() { if (window.__goView) __goView(1); }
  // Tocar la pestaña Asistente de la barra de abajo: el saludo y su mundo; si ya estabas dentro, vuelve a su inicio
  function entrarAsistente(denuevo) {
    fx('select');
    mundoOn = false; globoOff = false; saludado = false; nota = null;
    if (denuevo) {
      msgs = []; pend = null; agente = null; ayudaPage = false; host.classList.remove('is-ayuda');
      if (solSec && !solSec.hidden) { solSec.hidden = true; host.classList.remove('uk-in-sec'); }
      seccion('uku'); pintar(); reencuadrar();
      if (b3d && !RM) setTimeout(function () { b3d.play('wave'); }, 250);
      return;
    }
    abriendo = true;
    host.classList.add('is-in'); clearTimeout(entrarAsistente.t); entrarAsistente.t = setTimeout(function () { host.classList.remove('is-in'); }, 1400);
    // Primero se pinta la pantalla y recién entonces se encuadra a Uku (de una, sin movimiento) y se muestra
    pintar(); abriendo = false; encuadrar(true); mostrarEscena(); reencuadrar();
    if (!RM) setTimeout(function () { if (b3d) b3d.play('wave'); }, 450);
  }
  function bienvenida() {
    if (msgs.length) return;
    var sal = saludo(), P = propuestas(), s = resumen();
    var btns = [b(sal.k, sal.l, null)];
    P.slice(0, 2).forEach(function (x) { if (x.k !== sal.k) btns.push(b(x.k, x.l, null, 'is-ask')); });
    btns.push(b('gastos', 'Mis gastos', 'account_balance_wallet'), b('ayuda', 'Ayuda', 'support_agent'), b('sol', 'Solicitudes', 'assignment'), b('libre', 'Ver mi resumen', 'park'));
    saludado = true;
    uku(esc(sal.t), btns, '', { title: 'Tu asistente' });
    mostrar();
    if (b3d) b3d.play('wave');
  }
  // Sin conversación ni sección, Uku vuelve a su mundo (globo, propuestas, cámara libre)
  function mundoLibre() { if (!view.classList.contains('active') && window.__goView) { __goView(1); } mundoOn = true; msgs = []; pend = null; agente = null; if (solSec && !solSec.hidden) { solSec.hidden = true; host.classList.remove('uk-in-sec'); } seccion('uku'); pintar(); saludado = true; globoOff = false; pintarGlobo(); }
  // La X cierra solo la hoja abierta (chat o sección) y vuelves a la pantalla inicial del asistente;
  // la flecha de la pantalla inicial es la que baja el asistente
  function cerrar() {
    if (cerrando) return;
    cerrando = true; fx('tap');
    host.classList.add('is-out');
    setTimeout(function () {
      host.classList.remove('is-out'); cerrando = false;
      msgs = []; pend = null; agente = null; mundoOn = false; ayudaPage = false; host.classList.remove('is-ayuda');
      if (solSec && !solSec.hidden) { solSec.hidden = true; host.classList.remove('uk-in-sec'); }
      seccion('uku'); pintar();
      if (b3d && !RM) setTimeout(function () { b3d.play('happy'); }, 320);
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
  // Alto del área segura superior (muesca), medido una vez
  function safeTop() {
    if (safeTop.v == null) { var t = document.createElement('div'); t.style.cssText = 'position:fixed;top:env(safe-area-inset-top,0px);left:0;width:1px;height:1px;visibility:hidden;pointer-events:none'; document.body.appendChild(t); safeTop.v = t.getBoundingClientRect().top || 0; t.remove(); }
    return safeTop.v;
  }
  function gestos() {
    var g = null;
    // La sección de Mis finanzas es fija (no sube ni baja con el dedo); sí se arrastra Mis gastos, que es una página
    function tarjeta(t) { var c = t.closest('.uk-card, .uk-panel, .uk-sec'); return c && c.classList.contains('uk-panel') && host.classList.contains('is-fin') && !host.classList.contains('is-page') ? null : c; }
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
      var fin = host.classList.contains('is-fin'), arriba = host.classList.contains('is-up');
      if (g.dir === 'y' && dy < 0 && !(fin && !arriba)) return;
      if (g.dir === 'y' && dy < 0) { g.on = true; g.el.classList.add('is-drag'); g.el.style.transform = 'translateY(' + Math.max(dy, -(g.el.getBoundingClientRect().top - host.getBoundingClientRect().top - 8 - safeTop())) + 'px)'; reencuadrar(); e.preventDefault(); return; }
      if (g.dir === 'x' && dx < 0) return;
      g.on = true; g.el.classList.add('is-drag'); g.el.style.transform = g.dir === 'y' ? 'translateY(' + dy + 'px)' : 'translateX(' + dx * .6 + 'px)';
      g.el.style.opacity = g.dir === 'x' ? String(Math.max(.4, 1 - dx / 300)) : '';
      e.preventDefault();
    }, { passive: false });
    function fin(e) {
      if (!g) return;
      var dx = e.clientX - g.x, dy = e.clientY - g.y, s = g; g = null;
      if (s.globo) {
        if (host.classList.contains('is-fin') || host.classList.contains('is-home')) { if (dx < -40 && Math.abs(dy) < 60) { fx('tap'); if (onb >= 0) return onb < PASOS.length - 1 ? onboarding(onb + 1) : onboardingFin(); if (!saludado) saludado = true; else gi++; nota = null; pintarGlobo(); pintarChips(); } else if (dx > 40 && Math.abs(dy) < 60 && gi > 0) { fx('tap'); gi--; nota = null; pintarGlobo(); pintarChips(); } return; }
        if (dy < -40 && Math.abs(dx) < 60) { fx('select'); dinero(); mostrar(); } return;
      }
      s.el.classList.remove('is-drag'); s.el.style.transform = ''; s.el.style.opacity = '';
      if (!s.on) return;
      if (host.classList.contains('is-fin') && s.dir === 'y') {
        var up = host.classList.contains('is-up');
        if (dy < -60 && !up) { fx('select'); host.classList.add('is-up'); reencuadrar(); return; }
        if (dy > 60 && up) { fx('tap'); host.classList.remove('is-up'); reencuadrar(); return; }
        if (up) return;
      }
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
      if (s) { m3.setBloom(s.bloom); m3.setMood(s.mood); if (m3.setFinanzas && PFM.finanzas) m3.setFinanzas(PFM.finanzas()); } // brotes, flores, guayacanes y lo que tienes por tus créditos
      m3.attach(el, { score: s ? s.score : 60, onPick: function (id) { fx('select'); explicar(id); }, onReady: function () { var k = host.querySelector('.uk-skel'); if (k) { k.classList.add('is-off'); setTimeout(function () { k.remove(); }, 400); } if (!abriendo) { encuadrar(true); mostrarEscena(); reencuadrar(); } }, onTap: tocado });
      el.classList.add('is-3d');
      // Si la escena llega con una conversación ya abierta, Uku entra directo en foco; en Mis finanzas y Soporte
      // no (ahí está en su mundo, en plano general). La misma regla que modo(), y queda anotada para no pisarse.
      var foco = host.classList.contains('is-chat') && !host.classList.contains('is-fin') && !host.classList.contains('is-ayuda');
      m3.setFocus(foco); host._foco = foco;
      if (foco) { m3.setShift(-.3, -.47); if (b3d.setFront) b3d.setFront(true); }
      // Al llegar: si tiene algo que decir, te mira desde el inicio; si no, pasea. (Antes arrancaba a caminar y se frenaba en seco.)
      if (!escena.hola) { escena.hola = 1; if (!msgs.length) pintarGlobo(); if (globoEl.hidden) m3.setAmbient('walk'); }
    }).catch(function () {});
  }

  /* ---------- Toques ---------- */
  // Un solo título por sección: el del encabezado. En Mis finanzas, el de su página (Mis finanzas o Tus gastos)
  // Barra de arriba: flecha que vuelve (al inicio del asistente o, desde el inicio, a la app); en una página
  // dentro de Mis finanzas (Mis gastos), una X que vuelve a Mis finanzas. El título centrado va en las secciones.
  function cabecera(es) {
    var xb = host.querySelector('.uk-chathead__x'); if (!xb) return;
    if (es == null) es = host.classList.contains('is-chat');
    var pagina = host.classList.contains('is-page'), icono = pagina ? 'close' : 'arrow_back';
    if (xb.dataset.ic !== icono) { xb.dataset.ic = icono; xb.innerHTML = ic(icono); }
    xb.setAttribute('aria-label', pagina ? 'Volver a Mis finanzas' : es ? 'Volver al inicio' : 'Volver');
    xb.dataset.k = pagina ? 'atras' : es ? 'cerrar' : 'salir';
  }
  function tituloDe(n) {
    var h = panel && panel.querySelector('.pf-head h1');
    var pagina = n === 'fin' && !!(panel && panel.querySelector('.pf-back'));
    if (host.classList.contains('is-page') !== pagina) { host.classList.toggle('is-page', pagina); host.classList.remove('is-up'); navVisible(); reencuadrar(); }
    cabecera();
    var t = n === 'ayuda' ? 'Ayuda y soporte' : n === 'fin' ? (h ? h.textContent : 'Mis finanzas') : n === 'soporte' ? 'Soporte' : 'Tu asistente';
    if (headT.textContent !== t) headT.textContent = t; // la cabecera vive dentro del panel observado: escribir igual lo volvería a disparar
    // Figma: en Mis finanzas y Soporte el título va centrado en la barra de arriba, junto a la flecha
    var ct = host && host.querySelector('.uk-chathead__t'), tt = n === 'fin' || n === 'soporte' ? t : '';
    if (ct && ct.textContent !== tt) ct.textContent = tt;
    if (n === 'fin') llenarSlot();
  }
  // En todas las secciones de Asistente, el título va en su encabezado (no en la barra de arriba)
  function libre() { root.classList.toggle('uk-idle', view.classList.contains('active')); }
  function finOn(on) {
    view.classList.toggle('uk-fin', !!on); libre();
    host.classList.remove('is-up');
    if (window.AppScroll) AppScroll.to({ top: 0 }); else window.scrollTo(0, 0);
    if (on) {
      if (b3d) b3d.play('nod');
      host.classList.add('is-fin-in'); clearTimeout(finOn.t); finOn.t = setTimeout(function () { host.classList.remove('is-fin-in'); reencuadrar(); }, 900);
      if (window.PFM) PFM.paint();
      setTimeout(contarCifra, RM ? 0 : 380);
    } else setTimeout(escena, 60);
    modo();
  }
  // La cifra cuenta de 0 a su valor en 500 ms y Uku la mira (asiente)
  function contarCifra() {
    var el = panel && panel.querySelector('.pfm-hub__m'); if (!el) return;
    var v = parseFloat(el.dataset.v || '0'), t0 = null, fin = el.textContent;
    if (RM || !(v > 0)) return;
    function paso(ts) { if (!t0) t0 = ts; var k = Math.min(1, (ts - t0) / 500), e = 1 - Math.pow(1 - k, 3); el.textContent = money(v * e); if (k < 1) requestAnimationFrame(paso); else { el.textContent = fin; if (b3d) b3d.play('nod'); } }
    requestAnimationFrame(paso);
  }
  /* ---------- Lo que haces con tu dinero se ve en su mundo ----------
     Guardar presupuesto: planta y el bosque crece. Ordenar un consumo: una flor más. Separar ahorro: planta y florece. */
  var floresExtra = 0;
  document.addEventListener('uku:pres', function () {
    if (!b3d) return; var s = resumen();
    b3d.play('plant'); setTimeout(function () { if (s) b3d.setScore(s.score); }, 1200);
    nota = 'Listo. Tu presupuesto está guardado.'; pintarGlobo(); setTimeout(function () { nota = null; pintarGlobo(); if (b3d) b3d.play('happy'); }, 5000);
  });
  document.addEventListener('uku:clasificado', function (e) {
    if (!b3d) return; var s = resumen(), restan = e.detail && e.detail.restan;
    floresExtra++; if (s) b3d.setBloom(Math.min(100, (s.bloom || 0) + floresExtra * 2));
    // El globo cuenta contigo: «Clasificar 6» pasa a «Clasificar 5» con un pequeño latido
    var go = globoEl.querySelector('.uk-globo__go[data-k="pfm:game"]'), tt = globoEl.querySelector('.uk-globo__t');
    if (go && restan > 0) {
      go.textContent = 'Clasificar ' + Math.min(10, restan); go.classList.remove('is-tick'); void go.offsetWidth; go.classList.add('is-tick');
      if (tt) tt.textContent = restan === 1 ? 'Tienes 1 consumo sin clasificar' : 'Tienes ' + restan + ' consumos sin clasificar';
    }
    if (restan === 0) { b3d.setMood('feliz'); b3d.play('happy'); nota = 'Ordenaste todo. Ya estoy contento otra vez.'; pintarGlobo(); setTimeout(function () { nota = null; pintarGlobo(); }, 5000); }
  });
  document.addEventListener('uku:ahorro', function () {
    if (!b3d) return; var s = resumen();
    b3d.play('plant'); setTimeout(function () { if (s) b3d.setBloom(Math.min(100, (s.bloom || 0) + 5)); }, 2000);
    nota = 'Guardado. Cada mes sumarás a tu ahorro.'; pintarGlobo(); acercar(1.15, 2400); setTimeout(function () { nota = null; pintarGlobo(); }, 5000);
  });
  // Las tres secciones de Asistente: Uku (su mundo y conversación), Mis finanzas y Ayuda
  var ayudaPage = false;
  function seccion(n) {
    var ayuda = n === 'ayuda';
    view.classList.toggle('uk-ayuda', ayuda);
    ayudaPage = n === 'soporte';
    if (ayudaPage) { if (view.classList.contains('uk-fin')) finOn(false); msgs = []; pend = null; agente = null; }
    if (ayuda) {
      if (view.classList.contains('uk-fin')) finOn(false);
      if (window.Soporte) Soporte.into(ayudaSlot);
      // La hoja de Soporte se arma aquí (bloques con cabecera, filas con ancla visual, mosaicos para pedir)
      var hub = ayudaSlot.querySelector('.sp-hub');
      if (hub) { Array.prototype.forEach.call(hub.querySelectorAll('.sp-sec, .uk-ay__sec'), function (x) { x.remove(); }); hub.insertAdjacentHTML('beforeend', ayudaHTML()); }
      var dentro = ayudaSlot.querySelector('.sp-body .uk-cta'); if (dentro) dentro.remove();
      // El botón «Pregúntale a Uku» es el pie fijo de la hoja: no tapa la última fila
      if (!panel.querySelector(':scope > .uk-cta')) panel.insertAdjacentHTML('beforeend', '<div class="uk-cta"><button class="pf-cta" data-k="escribir">Pregúntale a Uku</button></div>');
    } else if (n === 'fin') { if (window.PFM) PFM.open(); else finOn(true); }
    else finOn(false);
    tituloDe(n);
    libre(); modo();
  }
  /* ---------- Solicitudes dentro del mundo de Uku ----------
     Lo que se puede pedir o revisar, a un toque; la búsqueda es la universal (contexto: solicitudes). */
  var solSec = null;
  // Las filas no llevan ícono: el texto ya dice qué es (el ícono queda para lo que identifica, como las categorías)
  function row(s, icon, t, sub) { return '<button class="uk-sec__row" data-s="' + esc(s) + '"><span><b>' + esc(t) + '</b><small>' + esc(sub) + '</small></span>' + ic('chevron_right') + '</button>'; }
  /* ---------- Factura o estado de cuenta: Uku lo lee y propone el pago ---------- */
  /* Una foto: primero busca un QR (se paga al comercio), después texto de factura o estado de cuenta
     (donde el navegador sabe leerlo) y, si no pudo leer nada, pregunta el monto. */
  var fotoPend = null; // la foto que no se pudo leer: espera el monto escrito
  // Lo que Uku reconoce en una foto (empresas, cuentas, tarjetas, celulares) como acciones a un toque
  function chipsLeidos(E) {
    var out = [];
    E.empresas.forEach(function (e) { out.push(b('act:' + e.accion, (e.accion === 'Recargar celular' ? 'Recargar ' : 'Pagar ') + e.que, e.icon)); });
    E.cuentas.slice(0, 2).forEach(function (c) { out.push(b('act:Transferir dinero', 'Transferir a la cuenta ' + c.replace(/^(\d{4})(?=\d)/, '$1 '), 'send_money')); });
    E.celulares.slice(0, 2).forEach(function (c) { out.push(b('act:Recargar celular', 'Recargar el ' + c.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3'), 'smartphone')); });
    E.tarjetas.slice(0, 1).forEach(function (t) { out.push(b('act:Pagar tarjeta', 'Pagar la tarjeta •••• ' + t.slice(-4), 'credit_card')); });
    E.empresas.slice(0, 1).forEach(function (e) { if (e.nombre !== 'la tarjeta' && e.nombre !== 'la suscripción') out.push(b('ask:' + e.nombre, 'Buscar ' + e.nombre, null, 'is-ask')); });
    return out;
  }
  function leido(E) {
    var L = [];
    if (E.empresas.length) L.push(E.empresas.map(function (e) { return e.nombre; }).join(', '));
    if (E.cuentas.length) L.push(E.cuentas.length === 1 ? 'una cuenta' + (E.banco ? ' de ' + E.banco : '') : E.cuentas.length + ' cuentas');
    if (E.celulares.length) L.push(E.celulares.length === 1 ? 'un celular' : E.celulares.length + ' celulares');
    if (E.tarjetas.length) L.push('una tarjeta');
    return L.join(', ');
  }
  function escanear(file) {
    uku('Miro tu foto…'); pintarChat();
    var E = null;
    UkuPagos.leerQR(file).then(function (qr) {
      if (qr) return UkuPagos.propuesta(Persona.get(), UkuPagos.interpretarQR(qr));
      // Sin QR, el texto: un total a pagar arma el pago; empresas, cuentas o celulares, acciones a un toque
      return UkuPagos.leer(file).then(function (texto) {
        if (!texto) return null;
        E = UkuPagos.entidades(texto);
        var d = UkuPagos.interpretar(texto);
        if (d.tipo === 'recibo') return { recibo: d };
        return d.monto ? UkuPagos.propuesta(Persona.get(), d) : null;
      });
    }).then(function (p) {
      if (p && p.recibo) return recibo(p.recibo);
      if (!p && E && E.algo) {
        uku('En tu foto reconocí ' + leido(E) + '. ¿Qué hacemos con eso?', chipsLeidos(E).concat([b('escanear', 'Tomar otra foto', 'photo_camera', 'is-ask')]), '', { title: 'Lo que leí' });
        pintarChat(); return;
      }
      if (!p) {
        fotoPend = file;
        uku('No pude leer un QR ni el texto de esta foto. Dime el monto y te preparo el pago.', [b('ask:Es una factura de luz', 'Es una factura', null, 'is-ask'), b('escanear', 'Tomar otra foto', 'photo_camera', 'is-ask')], '', { title: 'Tu foto' });
        pintarChat(); setTimeout(function () { input.focus(); }, 400); return;
      }
      propuestaPago(p, E);
    });
  }
  // Un recibo ya pagado no se paga: es un consumo. Uku lo ubica en tus movimientos y lo relaciona con tus gastos
  function recibo(d) {
    var c = d.comercio || 'ese comercio', q = d.monto ? ' por ' + money(d.monto) : '';
    uku('Es un recibo de ' + c + q + (d.fecha ? ' del ' + d.fecha : '') + (d.pago ? ', pagado con ' + d.pago : '') + '. No hay nada que pagar: ya está hecho. ¿Lo buscamos en tus movimientos?',
      [b('gastos', 'Ver mis movimientos', 'account_balance_wallet'), b('ask:¿Cuánto gasto en ' + c + '?', 'Cuánto gasto en ' + c, null, 'is-ask'), b('escanear', 'Tomar otra foto', 'photo_camera', 'is-ask')], '',
      { title: 'Tu recibo', num: d.monto ? { v: money(d.monto), l: 'en ' + c } : null });
    pintarChat();
  }
  function propuestaPago(p, E) {
    var leido = p.qr ? 'Leí el QR. ' : p.manual ? 'Con el monto que me diste: ' : p.leido ? 'Lo leí en tu documento. ' : 'No puedo leer el texto de la imagen en este navegador, así que lo comparé con tus productos. ';
    // Si además había una cuenta o un celular en la foto, también se ofrecen
    var extra = E && E.algo ? chipsLeidos({ empresas: [], cuentas: E.cuentas, celulares: E.celulares, tarjetas: [] }) : [];
    // Con la empresa reconocida, el pago se nombra por lo que es («la factura de la luz»)
    if (E && E.empresas.length && !p.qr && /que le[ií]|tu factura/.test(p.para || '')) { p.titulo = E.empresas[0].accion === 'Pagar tarjeta' ? 'el estado de cuenta' : 'la factura'; p.para = E.empresas[0].que; }
    uku(leido + 'Es ' + p.titulo + ' de ' + p.para + (p.vence ? ', vence el ' + p.vence : '') + (p.ref ? ' (ref. ' + p.ref + ')' : '') + '. ¿Lo pago desde ' + p.desde + '?',
      [b('pago:si:' + encodeURIComponent(JSON.stringify(p)), 'Pagar ' + money(p.monto), 'payments')].concat(extra).concat([b('pago:no', 'Ahora no', null, 'is-ask')]), '',
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
      case 'orq': fx('tap'); return window.Orquestador && orqAccion(v, l, enChat);
      case 'faq': case 'tut': if (!enChat) me(l); return ayudaEn({ kind: kind, i: +v });
      case 'act': { var a = accion(v); if (!a) return; salir(a.label, true); return window.Buscador && Buscador.run(a); }
      case 'sp': salir(l, !/^(review|agent)$/.test(v)); if (window.Soporte) Soporte.run(v); return pintarChat();
      case 'pfm': salir(l); if (window.PFM) PFM.key(v); return;
      // Mis finanzas se responde en la conversación; abrir la pantalla es una opción más
      case 'fin': fx('select'); return seccion('fin');
      case 'escribir': fx('tap'); return charla();
      case 'buscar': fx('tap'); return buscar(false);
      case 'salir': fx('tap'); if (window.__goView) __goView(0); return;
      case 'rev': fx('tap'); return window.Soporte && Soporte.review();
      case 'caso': { var cx = casos.filter(function (y) { return y.id === v; })[0]; seccion('uku'); if (cx) { me('¿Cómo va mi caso ' + cx.id + '?'); uku('Tu caso ' + esc(cx.id) + ' sobre «' + esc(cx.t) + '» está en revisión. Te llega un correo con la respuesta en máximo 48 horas.', [{ k: 'hum:agent', t: 'Escribirle a un asesor', ic: 'support_agent', cls: 'is-ask' }, { k: 'ok', t: 'Gracias', ic: 'thumb_up', cls: 'is-ask' }]); } return pintar(); }
      case 'gastos': fx('select'); seccion('fin'); if (window.PFM) { PFM.key('gastos'); if (v) PFM.key('per:' + v); } return;
      case 'voz': fx('tap'); if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) { uku('En este navegador no puedo escucharte. Escríbeme abajo y te respondo igual.', [b('ask:¿Cómo va mi dinero?', '¿Cómo va mi dinero?', null, 'is-ask')]); return pintarChat(); } if (window.Buscador) Buscador.voice(); return;
      // Volver: en el detalle de gastos, a la lista de Mis finanzas; si no, a Tu asistente
      case 'atras': { var pb = view.querySelector('.pf-back'); return pb ? pb.click() : seccion('uku'); }
      case 'escanear': fx('tap'); return fileIn.click();
      case 'pago': return pago(v);
      // Ayuda es su sección: se abre el centro de ayuda; el chat empieza cuando hay algo que resolver
      case 'ayuda': fx('tap'); return ayudaCard();
      case 'sol': fx('select'); seccion('ayuda'); setTimeout(function () { var s = ayudaSlot.querySelector('#uk-solsec'); if (s) s.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 250); return;
      case 'persona': persona(); return pintarChat();
      case 'atras-card': { var li = -1; msgs.forEach(function (m, j) { if (m.uku != null) li = j; }); if (li < 0) return; msgs.splice(li, 1); if (msgs.length && msgs[msgs.length - 1].me) msgs.pop(); fx('tap'); return pintarChat(); }
      case 'fl': { var fp = v.split(':'); return flujo(+fp[0], fp[1]); }
      case 'flow': return flujo(+v, 'ini', !enChat);
      case 'kb': { var kv = window.Conocimiento ? Conocimiento.entrada(v) : null; if (!kv) return; if (!enChat) me(kv.t); return kbCard(kv, kv.t); }
      case 'dinero': dinero(); return mostrar();
      case 'res': return resultado(v);
      case 'voto': return votar(v);
      case 'ia': if (!enChat) me('Que Uku IA lo revise'); uku('Lo reviso…'); pintarChat(); return setTimeout(function () { msgs.pop(); iaResponde(v); }, 1400);
      case 'onb': if (v === 'fin') return onboardingFin(); return onboarding(+v);
      case 'siguiente': fx('tap'); nota = null; if (saludado) gi++; saludado = true; pintarGlobo(); return pintarChips();
      // Ocultar una sugerencia: no vuelve a aparecer (con «Deshacer» en el aviso); el globo pasa a la siguiente o al saludo
      case 'ocultar': nota = null;
        if (/^orq:/.test(v)) { orqOcultar(v.slice(4)); fx('tap'); if (window.PFM && PFM.toast) PFM.toast('Listo, ya no te la muestro aquí. La sigues en Mis finanzas.'); pintarGlobo(); return pintarChips(); }
        if (window.PFM) PFM.key('ocultar:' + v); return;
      case 'globo': fx('tap'); saludado = true; nota = null; return ocultarGlobo();
      case 'leyenda': fx('select'); return explicar(v);
      case 'prop': return propuesta(v);
      case 'mundo': mundo(); return mostrar();
      // Mis finanzas: qué significa cada cosa del mundo de Uku (el bosque, las flores, las mariposas…)
      case 'mundoinfo': fx('open'); return window.PFM && PFM.key('world');
      case 'libre': return mundoLibre();
      case 'ayudatoda': fx('select'); return seccion('ayuda');
      case 'soporte': fx('select'); seccion('soporte'); pintar(); return;
      case 'hum': return humano(v);
      case 'tel': location.href = 'tel:' + v; return;
      case 'cb': uku('Listo. Te llaman ' + esc(v) + ' al 099 *** 4521, con el resumen de tu caso. Lo ves en Solicitudes.', [b('ok', 'Gracias', 'thumb_up', 'is-ask')]); fx('success'); return pintarChat();
      case 'chau': return chau();
      case 'ok': return resuelto();
      case 'no': uku('Cuéntame qué necesitas con tus palabras o, si prefieres, te comunico con una persona.', [b('persona', 'Hablar con una persona', 'support_agent')]); pintarChat(); return setTimeout(function () { input.focus(); }, 300);
      case 'consejo': { var A = consejos(); if (!A.length) return resuelto('Por ahora no tengo nada más. Vas bien.'); var x = A[0]; uku(esc(x.di || x.t), x.act ? [b('pfm:' + x.act, x.actl, 'arrow_forward')] : []); return pintarChat(); }
      case 'cerrar': return cerrar();
      // La X de la ayuda completa vuelve a Soporte, su punto de entrada
      case 'ayudacerrar': fx('tap'); return seccion('soporte');
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
    // La lupa de la barra superior es el buscador universal (buscador.js); aquí solo la ayuda lleva al asistente
    var t = e.target.closest('[data-action="Soporte"], [data-action="Ayuda"]');
    if (!t || (host && host.contains(t)) || t.closest('.sp, .sp-page, .as-sheet')) return;
    // Sin sesión, Asistente está detrás del inicio de sesión: Ayuda se abre en su propia pantalla
    if (document.getElementById('login-screen')?.classList.contains('active')) return;
    e.stopImmediatePropagation(); e.preventDefault(); fx('open');
    irAUku(false, true);
  }, true);

  function init() {
    mount(); if (!host) return;
    // La pestaña del medio de la barra de abajo es el asistente (antes era Mis finanzas, que ahora vive dentro de Uku)
    var nav = document.querySelector('.nav-item[data-view="1"]');
    if (nav) {
      nav.querySelector('.nav-item__label').textContent = 'Asistente';
      nav.querySelector('.nav-item__wrap').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="nav-item__linea" d="M14 22C13.0667 22 12.1875 21.85 11.3625 21.55C10.5375 21.25 9.78333 20.8333 9.1 20.3L7.7 21.7C7.5 21.9 7.26667 22 7 22C6.73333 22 6.5 21.9 6.3 21.7C6.1 21.5 6 21.2667 6 21C6 20.7333 6.1 20.5 6.3 20.3L7.7 18.9C7.16667 18.2167 6.75 17.4625 6.45 16.6375C6.15 15.8125 6 14.9333 6 14C6 11.7 6.79583 9.79167 8.3875 8.275C9.97917 6.75833 11.85 6 14 6H20C20.55 6 21.0208 6.19583 21.4125 6.5875C21.8042 6.97917 22 7.45 22 8V14C22 15.0333 21.8042 16.0333 21.4125 17C21.0208 17.9667 20.4333 18.85 19.65 19.65C18.85 20.4333 17.9667 21.0208 17 21.4125C16.0333 21.8042 15.0333 22 14 22ZM5.5 10C5.5 8.75 5.9375 7.6875 6.8125 6.8125C7.6875 5.9375 8.75 5.5 10 5.5C8.75 5.5 7.6875 5.0625 6.8125 4.1875C5.9375 3.3125 5.5 2.25 5.5 1C5.5 2.25 5.0625 3.3125 4.1875 4.1875C3.3125 5.0625 2.25 5.5 1 5.5C2.25 5.5 3.3125 5.9375 4.1875 6.8125C5.0625 7.6875 5.5 8.75 5.5 10ZM14 20C14.8 20 15.5667 19.8542 16.3 19.5625C17.0333 19.2708 17.6833 18.8333 18.25 18.25C18.8333 17.6833 19.2708 17.0333 19.5625 16.3C19.8542 15.5667 20 14.8 20 14V8H14C13.2167 8 12.4625 8.15 11.7375 8.45C11.0125 8.75 10.3667 9.175 9.8 9.725C9.21667 10.2917 8.77083 10.9417 8.4625 11.675C8.15417 12.4083 8 13.1833 8 14C8 14.65 8.1 15.2667 8.3 15.85C8.5 16.4333 8.775 16.975 9.125 17.475L14.3 12.3C14.5 12.1 14.7333 12 15 12C15.2667 12 15.5 12.1 15.7 12.3C15.9 12.5 16 12.7333 16 13C16 13.2667 15.9 13.5 15.7 13.7L10.525 18.9C11.0083 19.25 11.5458 19.5208 12.1375 19.7125C12.7292 19.9042 13.35 20 14 20Z" fill="currentColor"/><path class="nav-item__relleno" d="M14 22C13.0667 22 12.1875 21.85 11.3625 21.55C10.5375 21.25 9.78333 20.8333 9.1 20.3L7.7 21.7C7.5 21.9 7.26667 22 7 22C6.73333 22 6.5 21.9 6.3 21.7C6.1 21.5 6 21.2667 6 21C6 20.7333 6.1 20.5 6.3 20.3L7.7 18.9C7.16667 18.2167 6.75 17.4625 6.45 16.6375C6.15 15.8125 6 14.9333 6 14C6 11.7 6.79583 9.79167 8.3875 8.275C9.97917 6.75833 11.85 6 14 6H20C20.55 6 21.0208 6.19583 21.4125 6.5875C21.8042 6.97917 22 7.45 22 8V14C22 15.0333 21.8042 16.0333 21.4125 17C21.0208 17.9667 20.4333 18.85 19.65 19.65C18.85 20.4333 17.9667 21.0208 17 21.4125C16.0333 21.8042 15.0333 22 14 22ZM5.5 10C5.5 8.75 5.9375 7.6875 6.8125 6.8125C7.6875 5.9375 8.75 5.5 10 5.5C8.75 5.5 7.6875 5.0625 6.8125 4.1875C5.9375 3.3125 5.5 2.25 5.5 1C5.5 2.25 5.0625 3.3125 4.1875 4.1875C3.3125 5.0625 2.25 5.5 1 5.5C2.25 5.5 3.3125 5.9375 4.1875 6.8125C5.0625 7.6875 5.5 8.75 5.5 10ZM14.3 12.3L9.825 16.775C9.625 16.975 9.52917 17.2083 9.5375 17.475C9.54583 17.7417 9.64167 17.975 9.825 18.175C10.025 18.375 10.2583 18.4792 10.525 18.4875C10.7917 18.4958 11.025 18.4 11.225 18.2L15.7 13.7C15.9 13.5 16 13.2667 16 13C16 12.7333 15.9 12.5 15.7 12.3C15.5 12.1 15.2667 12 15 12C14.7333 12 14.5 12.1 14.3 12.3Z" fill="currentColor"/></svg>';
      nav.hidden = false;
      // Tocarla entra al asistente (su saludo y su mundo); tocarla otra vez estando dentro vuelve a su inicio
      var estabaDentro = false;
      nav.addEventListener('click', function () { estabaDentro = view.classList.contains('active'); }, true); // antes de que index.html cambie de pestaña
      nav.addEventListener('click', function () { entrarAsistente(estabaDentro); });
    }
    // Lo que abre Mis finanzas desde otros lugares lleva al PFM completo, dentro de Uku
    if (window.PFM) { var o = PFM.open; PFM.open = function () { finOn(true); o(); }; }
    // La pantalla de Uku cabe entre la barra de arriba y la de abajo: sin scroll
    medirNav(); window.addEventListener('resize', medirNav); window.addEventListener('resize', reencuadrar);
    // Teclado (iOS/Android): el alto que tapa se mide con visualViewport y la barra se apoya justo encima
    var vv = window.visualViewport;
    function teclado() {
      if (!vv) return;
      var kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty('--uk-kb', kb + 'px'); host.classList.toggle('is-kb', kb > 80); navVisible();
      if (kb > 80) window.scrollTo(0, 0);
      reencuadrar();
    }
    if (vv) { vv.addEventListener('resize', teclado); vv.addEventListener('scroll', teclado); }
    input.addEventListener('blur', function () { setTimeout(teclado, 80); });
    var tt = document.querySelector('.top-bar__title');
    function titulo() { if (!tt) return; var t = view.classList.contains('active') ? (view.classList.contains('uk-ayuda') ? 'Ayuda' : view.classList.contains('uk-fin') ? 'Mis finanzas' : 'Uku') : null; if (t && tt.textContent !== t) tt.textContent = t; }
    new MutationObserver(function () {
      root.classList.toggle('uk-here', view.classList.contains('active')); libre(); titulo(); modo(); reencuadrar();
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
      try { localStorage.removeItem(ONB); Object.keys(localStorage).forEach(function (k) { if (k.indexOf(VISTO) === 0) localStorage.removeItem(k); }); localStorage.removeItem('uk-casos'); } catch (e) {}
      SAL = null;
      casos = []; saludado = false; gi = 0; nota = null;
      if (window.PFM) PFM.key('reset');
      if (msgs.length) cerrar();
      setTimeout(function () { nav ? nav.click() : onboarding(0); }, msgs.length ? 420 : 80);
    });
    // Al elegir otra persona en Perfil, Uku la saluda a ella: se olvida el saludo guardado y la conversación anterior
    // (después de que Mis finanzas tome la nueva persona, por eso en el siguiente ciclo)
    document.addEventListener('persona:change', function () {
      setTimeout(function () { SAL = null; msgs = []; pend = null; agente = null; saludado = false; gi = 0; nota = null; globoEl.dataset.html = ''; pintar(); }, 0);
    });
    // Las preguntas con IA desde Mis finanzas se responden aquí, con el mismo estilo
    window.UkuAsistente.ia = function (q) { seccion('uku'); me(q); iaResponde(q); };
    // El análisis del mes también: una tarjeta de Uku, no otra pantalla
    if (window.UkuAnalisis) UkuAnalisis.open = function (o) { analisisCard(o || {}); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
