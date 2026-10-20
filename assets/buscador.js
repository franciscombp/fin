/* =====================================================================
   Buscador de la app
   Se abre deslizando hacia abajo desde el tope de Inicio (o con la lupa
   de la barra superior). Es para hacer cosas en la app: acciones, tus
   atajos grabados, lo que sueles hacer a esta hora y, al escribir,
   frases como "transferir 20 a María" que abren el flujo ya lleno,
   productos, ajustes y movimientos. Uku queda como último recurso.
   ===================================================================== */
(function () {
  'use strict';

  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(v) {
    var s = Math.abs(v).toFixed(2).split('.');
    return '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  }

  /* Acciones: reutilizan los mismos botones de la app (data-action), así
     el buscador abre exactamente el mismo flujo. */
  var ACTIONS = [
    { label: 'Transferir', icon: 'send_money', action: 'Transferir dinero', k: 'transferir transferencia enviar mandar pasar plata dinero platita depositar deposito pagarle mandarle prestarle a ana interbancaria otro banco' },
    { label: 'Pagar con QR', icon: 'qr_code_scanner', action: 'Pagar con QR', k: 'pagar qr escanear codigo pichipay tienda local comercio camara' },
    { label: 'Pagar servicios', icon: 'bolt', action: 'Pagar servicios', k: 'pagar servicios luz agua internet telefono cnt planilla factura cuentas por pagar empresa electrica basicos gas tv cable' },
    { label: 'Recargar celular', icon: 'smartphone', action: 'Recargar celular', k: 'recargar recarga celular saldo telefono claro movistar tuenti cnt megas datos plan prepago' },
    { label: 'Mis finanzas', icon: 'insights', run: function () { window.Asistente && Asistente.openPF(); }, k: 'mis finanzas pfm gastos gaste gasto presupuesto ahorro ahorrar metas salud financiera resumen mes cuanto gaste en que gasto' },
    { label: 'Retirar sin tarjeta', icon: 'atm', action: 'Retirar sin tarjeta', k: 'retirar retiro sacar plata efectivo cajero sin tarjeta codigo' },
    { label: 'Pagar tarjeta', icon: 'credit_card', action: 'Pagar tarjeta', k: 'pagar tarjeta credito deuda pago minimo total estado de cuenta corte' },
    { label: 'Cobrar con QR', icon: 'qr_code_2', action: 'Cobrar con QR', k: 'cobrar qr recibir vender negocio' },
    { label: 'Recibir dinero', icon: 'call_received', action: 'Recibir dinero', k: 'recibir dinero numero de cuenta mis datos compartir datos que me paguen' },
    { label: 'Pagar transporte', icon: 'directions_bus', action: 'Pagar transporte', k: 'pagar transporte bus metro movilidad pasaje' },
    { label: 'Mis tarjetas', icon: 'wallet', tab: 'Tarjetas', k: 'tarjetas tarjeta debito credito visa mastercard congelar bloquear perdi robaron' },
    { label: 'Mis cuentas', icon: 'account_balance', tab: 'Cuentas', k: 'cuentas cuenta saldo cuanto tengo ahorro corriente movimientos estado de cuenta' },
    { label: 'Préstamos', icon: 'request_quote', tab: 'Prestamos', k: 'prestamo prestamos credito simular cuota pedir prestado' },
    { label: 'Inversiones', icon: 'trending_up', tab: 'Inversiones', k: 'inversiones invertir poliza deposito a plazo rendimiento interes ganar' },
    { label: 'Seguros', icon: 'shield', tab: 'Seguros', k: 'seguros seguro vida salud auto proteccion' },
    { label: 'Seguridad', icon: 'lock', action: 'Seguridad', k: 'seguridad clave contrasena pin cambiar clave bloquear fraude robo' }
  ];
  var FEATURED = ['Transferir', 'Pagar con QR', 'Pagar servicios', 'Mis finanzas', 'Recargar celular', 'Retirar sin tarjeta', 'Pagar tarjeta', 'Mis tarjetas'];
  /* Preguntas típicas: las responde Uku con reglas (sin IA). */
  var ASKS = [
    { q: '¿En qué gasto más?', k: 'gasto gastos gaste plata dinero se me va en que' },
    { q: '¿Cuánto tengo en total?', k: 'cuanto tengo saldo total plata dinero cuentas' },
    { q: '¿Cuánto debo en mi tarjeta?', k: 'debo deuda tarjeta credito cupo' },
    { q: '¿Cuánto más puedo ahorrar?', k: 'ahorrar ahorro guardar sobra alcanza' },
    { q: '¿Cómo voy con mis metas?', k: 'metas meta viaje galapagos fondo emergencia objetivo' },
    { q: '¿En qué me pasé?', k: 'presupuesto pase exceso limite tope' },
    { q: 'Mis gastos hormiga', k: 'hormiga cafe cafecito antojos snacks' },
    { q: 'Mis suscripciones', k: 'suscripciones netflix spotify gimnasio gym' },
    { q: '¿Cuánto pago de intereses?', k: 'intereses interes tarjeta minimo' },
    { q: '¿Cuánto gasté en supermercado?', k: 'supermercado super mercado comida viveres supermaxi tia' },
    { q: '¿Cuánto gasté en restaurantes y delivery?', k: 'restaurantes delivery comer fuera pedidos rappi' },
    { q: '¿Cómo voy en general?', k: 'como voy resumen salud financiera estado general' }
  ];
  var STOP = { de: 1, la: 1, el: 1, en: 1, mi: 1, mis: 1, a: 1, un: 1, una: 1, para: 1, por: 1, con: 1, que: 1, quiero: 1, como: 1, hacer: 1, me: 1, y: 1, lo: 1, los: 1, las: 1, al: 1, del: 1, se: 1 };
  function words(q) { return norm(q).replace(/[¿?¡!.,]/g, ' ').split(/\s+/).filter(function (w) { return w && !STOP[w]; }); }
  // Puntaje: cada palabra de la búsqueda que aparece (también a medias, para
  // cuando todavía se está escribiendo) en la etiqueta o las palabras clave.
  function score(text, ws) {
    var t = ' ' + norm(text) + ' ', n = 0;
    ws.forEach(function (w) { if (t.indexOf(' ' + w) >= 0) n += 2; else if (w.length > 3 && t.indexOf(w) >= 0) n += 1; });
    return n;
  }
  function rank(list, ws, f) {
    return list.map(function (x) { return { x: x, s: score(f(x), ws) }; }).filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; }).map(function (r) { return r.x; });
  }

  function runAction(a) {
    addRecent({ t: a.label, icon: a.icon, go: { a: a.label } });
    close(true);
    setTimeout(function () {
      if (a.run) return a.run();
      if (a.tab) {
        var t = document.querySelector('.tabs .tab[data-panel="' + a.tab + '"]');
        if (t) { t.click(); AppScroll.to({ top: 0, behavior: 'smooth' }); }
        return;
      }
      var el = document.querySelector('#home-page [data-action="' + a.action + '"]') || document.querySelector('[data-action="' + a.action + '"]');
      if (el) el.click();
    }, 280);
  }

  /* ---------- Atajos: acciones grabadas con sus datos ---------- */
  var SC_KEY = 'pb_atajos_v1';
  var BENS = ['María José', 'Carlos A.', 'Luis P.', 'Sofía G.', 'Diego R.'];
  var BILLERS = [['luz|electric', 'Empresa Eléctrica Quito', 'Pagar la luz'], ['agua', 'EPMAPS', 'Pagar el agua'], ['internet|cnt', 'CNT Internet', 'Pagar el internet'], ['claro|plan', 'Claro', 'Pagar el plan Claro']];
  var SC_ACTS = [['Transferir dinero', 'send_money', 'Transferir'], ['Pagar servicios', 'bolt', 'Pagar servicio'], ['Recargar celular', 'smartphone', 'Recargar'], ['Pagar tarjeta', 'credit_card', 'Pagar tarjeta']];
  var shortcuts = [
    { name: 'Mensualidad de María José', action: 'Transferir dinero', icon: 'send_money', who: 'María José', amount: 50 },
    { name: 'Luz de la casa', action: 'Pagar servicios', icon: 'bolt', biller: 'Empresa Eléctrica Quito' },
    { name: 'Recarga a mamá', action: 'Recargar celular', icon: 'smartphone', amount: 5 }
  ];
  try { var sv = JSON.parse(localStorage.getItem(SC_KEY)); if (Array.isArray(sv)) shortcuts = sv; } catch (e) {}
  function saveShortcuts() { try { localStorage.setItem(SC_KEY, JSON.stringify(shortcuts)); } catch (e) {} }
  /* ---------- Búsquedas recientes: las últimas 5 que llevaron a algo ---------- */
  var RC_KEY = 'pb_busq_recientes_v1';
  var recent = [];
  try { var rv = JSON.parse(localStorage.getItem(RC_KEY)); if (Array.isArray(rv)) recent = rv.map(function (x) { return typeof x === 'string' ? { t: x, icon: 'history', go: { q: x } } : x; }).filter(function (x) { return x && x.t && x.go; }).slice(0, 5); } catch (e) {}
  function saveRecent() { try { localStorage.setItem(RC_KEY, JSON.stringify(recent)); } catch (e) {} }
  // Recientes: lo que de verdad abriste (una acción, un atajo, una pregunta), no lo que escribiste.
  // Cada uno guarda a dónde va (go) para volver a abrirlo con un toque.
  function addRecent(r) {
    if (!r || !r.t) return;
    var t = String(r.t).trim().slice(0, 60); if (t.length < 2) return;
    recent = [{ t: t, icon: r.icon || 'history', go: r.go || { q: t } }].concat(recent.filter(function (x) { return norm(x.t) !== norm(t); })).slice(0, 5);
    saveRecent();
  }
  // A dónde va una sugerencia o un reciente
  function irA(go) {
    if (!go) return;
    if (go.a) { var a = ACTIONS.filter(function (x) { return x.label === go.a; })[0]; return a ? runAction(a) : null; }
    if (go.sc) return runShortcut(go.sc);
    if (go.tx != null) { close(true); return setTimeout(function () { window.UkuAsistente && UkuAsistente.movimiento && UkuAsistente.movimiento(go.tx); }, 280); }
    if (go.app) { var ap = appItems().filter(function (x) { return x.label === go.app; })[0]; return ap ? runApp(ap) : null; }
    if (go.help) { close(true); return setTimeout(function () { if (window.UkuAsistente && UkuAsistente.ayuda) return UkuAsistente.ayuda(); window.Soporte && Soporte.open(); }, 280); }
    if (go.faq != null) { close(true); return setTimeout(function () { window.Soporte && (go.kind === 'tut' ? Soporte.openTut(go.faq) : Soporte.openFaq(go.faq)); }, 280); }
    if (go.ask) { close(true); return setTimeout(function () { if (window.UkuAsistente && UkuAsistente.preguntar) return UkuAsistente.preguntar(go.ask); window.Asistente && Asistente.open({ ctx: ctxId, ask: go.ask }); }, 280); }
    if (go.q) { input.value = go.q; fx('tap'); return render(); }
  }
  function scSub(sc) {
    var a = SC_ACTS.filter(function (x) { return x[0] === sc.action; })[0];
    return [a ? a[2] : sc.action, sc.who || sc.biller || '', sc.amount ? money(sc.amount) : ''].filter(Boolean).join(' · ');
  }
  function runShortcut(sc) {
    addRecent({ t: sc.name, icon: sc.icon || 'bolt', go: { sc: sc } });
    close(true);
    setTimeout(function () { if (window.__runShortcut) window.__runShortcut(sc); }, 280);
  }

  /* Frases: "transferir 20 a maría", "pagar la luz", "recargar 5" */
  function intent(raw) {
    var q = norm(raw), m = q.match(/(\d+(?:[.,]\d{1,2})?)/), amt = m ? parseFloat(m[1].replace(',', '.')) : 0;
    if (/(transfer|envi|mand|pasa|deposit)/.test(q)) {
      var who = BENS.filter(function (b) { return q.indexOf(norm(b).split(' ')[0]) >= 0; })[0];
      if (who || amt) return { action: 'Transferir dinero', icon: 'send_money', who: who, amount: amt,
        name: 'Transferir' + (amt ? ' ' + money(amt) : '') + (who ? ' a ' + who : '') };
    }
    if (/pag/.test(q)) {
      var bl = BILLERS.filter(function (b) { return new RegExp(b[0]).test(q); })[0];
      if (bl) return { action: 'Pagar servicios', icon: 'bolt', biller: bl[1], name: bl[2] };
    }
    if (/recarg/.test(q) && amt) return { action: 'Recargar celular', icon: 'smartphone', amount: amt, name: 'Recargar ' + money(amt) };
    return null;
  }

  /* Lo demás de la app: productos (Inicio) y ajustes (Perfil) */
  function appItems() {
    var out = [], seen = {};
    document.querySelectorAll('#home-page .product-row[data-action]').forEach(function (b) {
      var l = b.dataset.action; if (seen[l]) return; seen[l] = 1;
      out.push({ label: l, icon: 'account_balance_wallet', sub: 'Producto', el: b, k: 'producto cuenta tarjeta saldo ' + l });
    });
    document.querySelectorAll('.view[data-view="4"] [data-action]').forEach(function (b) {
      var l = b.dataset.action; if (seen[l]) return; seen[l] = 1;
      var ic = b.querySelector('.material-symbols-rounded');
      out.push({ label: l, icon: ic ? ic.textContent.trim() : 'settings', sub: 'Perfil', view: 4, el: b, k: 'perfil ajustes configuracion ' + l });
    });
    return out;
  }
  var APP = [], HELP = [];
  function runApp(a) {
    addRecent({ t: a.label, icon: a.icon, go: { app: a.label } });
    close(true);
    setTimeout(function () {
      if (a.view != null && window.__goView) window.__goView(a.view);
      setTimeout(function () { a.el.click(); }, a.view != null ? 120 : 0);
    }, 280);
  }

  /* Sugerencia según la hora: lo que la persona suele hacer a esta hora. */
  function moment() {
    var h = new Date().getHours();
    if (h < 12) return { title: 'Suele hacerse por la mañana', icon: 'bolt', main: 'Pagar Luz de la casa', sub: 'La pagas cada mes · ' + money(24.8), sc: { action: 'Pagar servicios', biller: 'Empresa Eléctrica Quito' } };
    if (h < 19) return { title: 'Suele hacerse a esta hora', icon: 'send_money', main: 'Transferir a María José', sub: 'Lo haces casi todos los viernes', sc: { action: 'Transferir dinero', who: 'María José' } };
    return { title: 'Suele hacerse por la noche', icon: 'insights', main: 'Revisar tus gastos de hoy', sub: 'En Mis finanzas', a: ACTIONS[4] };
  }

  var el, input, results, hint, open_ = false, ctxId = null, curIt = null, rec_ = null, TX = [], PER = [];
  function mount() {
    el = document.createElement('div');
    el.className = 'sx';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Buscar');
    el.innerHTML =
      '<div class="sx-back" data-sx="close"></div>' +
      '<div class="sx-panel">' +
        '<div class="sx-head"><form class="sx-field" role="search">' +
          '<span class="material-symbols-rounded" aria-hidden="true">search</span>' +
          '<input type="search" enterkeyhint="search" autocomplete="off" placeholder="¿Qué necesitas?" aria-label="Buscar o preguntar">' +
          '<button type="button" class="sx-mic" data-sx="mic" aria-label="Dictar"><span class="material-symbols-rounded">mic</span></button>' +
          '<button type="button" class="sx-mic" data-sx="cam" aria-label="Escanear un QR con la cámara"><span class="material-symbols-rounded">photo_camera</span></button>' +
        '</form><button class="sx-cancel" data-sx="close">Cancelar</button></div>' +
        '<div class="sx-results"></div>' +
      '</div>';
    document.body.appendChild(el);
    input = el.querySelector('input');
    results = el.querySelector('.sx-results');
    input.addEventListener('input', render);
    el.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      addRecent(input.value);
      var first = results.querySelector('[data-sx-i]');
      if (first) first.click();
    });
    el.addEventListener('click', function (e) {
      // Tocar el espacio vacío (debajo de los resultados) también cierra
      if (e.target === results || e.target.classList.contains('sx-back')) return close();
      var b = e.target.closest('[data-sx],[data-sx-i]');
      if (!b) return;
      if (b.dataset.sx === 'close') return close();
      if (b.dataset.sx === 'mic') return dictate();
      if (b.dataset.sx === 'cam') return runAction(ACTIONS.filter(function (a) { return a.label === 'Pagar con QR'; })[0]);
      var i = b.dataset.sxI;
      if (i === 'rc-clear') { recent = []; saveRecent(); fx('toggle'); return render(); }
      if (i.indexOf('sug:') === 0) { var sg = SUGS[+i.slice(4)]; fx('tap'); if (!sg.go.a && !sg.go.app) addRecent(sg); return irA(sg.go); } // las acciones ya se anotan al abrirse
      if (i.indexOf('rc:') === 0) { var rc = recent[+i.slice(3)]; fx('tap'); return rc && irA(rc.go); }
      if (i === 'ask') { var q = input.value.trim(); addRecent({ t: q, icon: 'forum', go: { ask: q } }); close(true); setTimeout(function () { if (window.UkuAsistente && UkuAsistente.preguntar) return UkuAsistente.preguntar(q); window.Asistente && Asistente.open({ ctx: ctxId, ask: q }); }, 280); return; }
      if (i === 'pfm') return runAction(ACTIONS[4]);
      if (i.indexOf('tx:') === 0) { var tr = TX[+i.slice(3)]; if (!tr) return; addRecent({ t: tr.t, icon: 'receipt_long', go: tr.i != null ? { tx: tr.i } : { a: 'Mis finanzas' } }); close(true); return setTimeout(function () { if (tr.i != null && window.UkuAsistente && UkuAsistente.movimiento) return UkuAsistente.movimiento(tr.i); runAction(ACTIONS[4]); }, 280); }
      if (i.indexOf('per:') === 0) { var pr = PER[+i.slice(4)]; if (!pr) return; return runShortcut({ action: 'Transferir dinero', icon: 'send_money', who: pr.n, name: 'Transferir a ' + pr.n }); }
      if (i === 'help') { close(true); setTimeout(function () { window.Soporte && Soporte.open(); }, 280); return; }
      if (i.indexOf('hp:') === 0) { var hp = HELP[+i.slice(3)]; addRecent({ t: hp.t, icon: 'help', go: { faq: hp.i, kind: hp.kind } }); close(true); setTimeout(function () { if (!window.Soporte) return; if (hp.kind === 'tut') Soporte.openTut(hp.i); else Soporte.openFaq(hp.i); }, 280); return; }
      if (i === 'mo') { var mo = moment(); return mo.sc ? runShortcut(mo.sc) : runAction(mo.a); }
      if (i === 'it') return runShortcut(curIt);
      if (i === 'it-save') { shortcuts.push(Object.assign({}, curIt)); saveShortcuts(); fx('success'); input.value = ''; render(); return; }
      if (i.indexOf('sc:') === 0) return runShortcut(shortcuts[+i.slice(3)]);
      if (i.indexOf('del:') === 0) { shortcuts.splice(+i.slice(4), 1); saveShortcuts(); fx('toggle'); render(); return; }
      if (i.indexOf('app:') === 0) return runApp(APP[+i.slice(4)]);
      if (i === 'rec') { rec_ = { action: SC_ACTS[0][0], who: BENS[0] }; fx('select'); render(); return; }
      if (i === 'rec-cancel') { rec_ = null; render(); return; }
      if (i.indexOf('rec-act:') === 0) { readRec(); rec_.action = i.slice(8); render(); return; }
      if (i.indexOf('rec-who:') === 0) { readRec(); rec_[rec_.action === 'Pagar servicios' ? 'biller' : 'who'] = i.slice(8); render(); return; }
      if (i === 'rec-save') {
        readRec();
        var a = SC_ACTS.filter(function (x) { return x[0] === rec_.action; })[0];
        var sc = { action: rec_.action, icon: a[1], amount: rec_.amount || 0 };
        if (rec_.action === 'Transferir dinero') sc.who = rec_.who;
        if (rec_.action === 'Pagar servicios') sc.biller = rec_.biller || BILLERS[0][1];
        sc.name = rec_.name || scSub(sc);
        shortcuts.push(sc); saveShortcuts(); rec_ = null; fx('success'); render();
        return;
      }
      if (i.indexOf('q:') === 0) { var aq = ASKS[+i.slice(2)].q; addRecent({ t: aq, icon: 'forum', go: { ask: aq } }); close(true); setTimeout(function () { window.Asistente && Asistente.ask(aq); }, 280); return; }
      if (i.indexOf('a:') === 0) return runAction(ACTIONS[+i.slice(2)]);
    });
    // Al deslizar los resultados se esconde el teclado (como en iOS) y
    // quedan a la vista todas las acciones.
    var sy = null;
    results.addEventListener('touchstart', function (e) { sy = e.touches[0].clientY; }, { passive: true });
    results.addEventListener('touchmove', function (e) {
      if (sy !== null && Math.abs(e.touches[0].clientY - sy) > 8 && document.activeElement === input) input.blur();
    }, { passive: true });
    results.addEventListener('scroll', function () { if (document.activeElement === input) input.blur(); }, { passive: true });
    // Deslizar hacia arriba para cerrar (como Spotlight): desde el campo de
    // búsqueda, o desde los resultados cuando ya no hay más para ver.
    var panel = el.querySelector('.sx-panel'), back = el.querySelector('.sx-back'), sw = null;
    panel.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { sw = null; return; }
      var t = e.touches[0];
      sw = { x0: t.clientX, y0: t.clientY, dy: 0, on: false, head: !!e.target.closest('.sx-head'),
        end: results.scrollTop + results.clientHeight >= results.scrollHeight - 2, s: [[t.clientY, performance.now()]] };
    }, { passive: true });
    panel.addEventListener('touchmove', function (e) {
      if (!sw) return;
      var t = e.touches[0], dy = t.clientY - sw.y0, dx = t.clientX - sw.x0;
      if (!sw.on) {
        // Hacia arriba (Spotlight) desde el campo o el final de la lista; hacia abajo desde el campo (como una hoja)
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) && ((dy < 0 && (sw.head || sw.end)) || (dy > 0 && sw.head))) {
          sw.on = true; sw.down = dy > 0; sw.y0 = t.clientY; dy = 0; input.blur();
          panel.style.transition = 'none'; back.style.transition = 'none';
        } else if (Math.abs(dy) > 10 || Math.abs(dx) > 10) { sw = null; return; }
        else return;
      }
      e.preventDefault();
      sw.dy = sw.down ? Math.max(0, dy) : Math.min(0, dy);
      panel.style.transform = 'translateY(' + (sw.dy * .8) + 'px)';
      panel.style.opacity = String(Math.max(.2, 1 - Math.abs(sw.dy) / 360));
      back.style.opacity = String(Math.max(0, 1 - Math.abs(sw.dy) / 300));
      sw.s.push([t.clientY, performance.now()]); if (sw.s.length > 5) sw.s.shift();
    }, { passive: false });
    var swEnd = function () {
      if (!sw) return;
      var g = sw; sw = null;
      if (!g.on) return;
      var a = g.s[0], b = g.s[g.s.length - 1], v = (b[0] - a[0]) / Math.max(1, b[1] - a[1]);
      panel.style.transition = ''; back.style.transition = '';
      if (Math.abs(g.dy) > 90 || (Math.abs(v) > .5 && Math.abs(g.dy) > 24)) close();
      panel.style.transform = ''; panel.style.opacity = ''; back.style.opacity = '';
    };
    panel.addEventListener('touchend', swEnd);
    panel.addEventListener('touchcancel', swEnd);
    // El panel ocupa sólo el alto visible: con teclado abierto termina
    // justo encima de él y los resultados hacen scroll.
    if (window.visualViewport) {
      var fit = function () {
        if (!open_) return;
        var vv = window.visualViewport;
        el.style.setProperty('--sx-h', vv.height + 'px');
        el.style.setProperty('--sx-top', vv.offsetTop + 'px');
      };
      visualViewport.addEventListener('resize', fit);
      visualViewport.addEventListener('scroll', fit);
      el._fit = fit;
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open_) { e.stopImmediatePropagation(); close(); } }, true);
  }

  function tile(a) {
    return '<button class="sx-app" data-sx-i="a:' + ACTIONS.indexOf(a) + '"><span class="sx-app__ic material-symbols-rounded">' + a.icon + '</span><span>' + a.label + '</span></button>';
  }
  function row(id, icon, main, sub, right) {
    var ic = icon === 'uku' && window.Asistente ? '<span class="sx-row__ic sx-row__ic--uku">' + Asistente.faceIMG() + '</span>'
      : icon === 'ai' ? '<span class="sx-row__ic sx-row__ic--ai material-symbols-rounded">auto_awesome</span>'
      : '<span class="sx-row__ic material-symbols-rounded">' + icon + '</span>';
    return '<button class="sx-row" data-sx-i="' + id + '">' + ic + '<span class="sx-row__main"><b>' + main + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + (right ? '<span class="sx-row__r">' + right + '</span>' : '') + '</button>';
  }
  function T(x, v) { return window.I18n ? I18n.t(x, v) : x; }
  function ukuName() { return 'Uku'; }
  function readRec() {
    var n = results.querySelector('[data-rec="name"]'), m = results.querySelector('[data-rec="amt"]');
    if (n) rec_.name = n.value.trim();
    if (m) rec_.amount = parseFloat(String(m.value).replace(',', '.')) || 0;
  }
  // Sugerencias antes de escribir: cada una abre algo concreto (no rellena el campo).
  // Las acciones por sección (pagar, mi dinero, ayuda, seguridad) ya están a la vista en la app y aparecen al escribir.
  var SUGS = [
    { t: 'Mejorar mis finanzas', icon: 'insights', go: { a: 'Mis finanzas' } },
    { t: 'Mis últimos movimientos', icon: 'swap_horiz', go: { a: 'Mis cuentas' } },
    { t: 'Solicitar una tarjeta de crédito', icon: 'credit_card', go: { ask: 'Cómo solicito una tarjeta de crédito' } },
    { t: 'Mis seguros', icon: 'shield', go: { a: 'Seguros' } },
    { t: 'Necesito ayuda', icon: 'help', go: { help: true } }
  ];
  function sugerencias() {
    return '<section class="sx-card"><div class="sx-chips">' + SUGS.map(function (s, i) {
      return '<button class="sx-chip" data-sx-i="sug:' + i + '">' + esc(s.t) + '</button>';
    }).join('') + '</div></section>';
  }

  function chip(id, label, on) { return '<button class="sx-chip" data-sx-i="' + id + '" aria-pressed="' + !!on + '">' + esc(label) + '</button>'; }
  function recHTML() {
    var r = rec_, isT = r.action === 'Transferir dinero', isS = r.action === 'Pagar servicios';
    return '<section class="sx-card sx-rec"><h3>Grabar un atajo</h3>' +
      '<p class="sx-rec__hint">Guarda una acción con sus datos y repítela con un toque.</p>' +
      '<p class="sx-rec__label">Qué quieres hacer</p><div class="sx-chips">' + SC_ACTS.map(function (x) { return chip('rec-act:' + x[0], x[2], x[0] === r.action); }).join('') + '</div>' +
      (isT ? '<p class="sx-rec__label">Para</p><div class="sx-chips">' + BENS.map(function (b) { return chip('rec-who:' + b, b, b === r.who); }).join('') + '</div>' : '') +
      (isS ? '<p class="sx-rec__label">Servicio</p><div class="sx-chips">' + BILLERS.map(function (b) { return chip('rec-who:' + b[1], b[1], b[1] === (r.biller || BILLERS[0][1])); }).join('') + '</div>' : '') +
      (!isS ? '<label class="sx-rec__field"><span>Monto (opcional)</span><input type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00" data-rec="amt" value="' + (r.amount || '') + '"></label>' : '') +
      '<label class="sx-rec__field"><span>Nombre del atajo</span><input type="text" maxlength="40" placeholder="Ej. Mensualidad" data-rec="name" value="' + esc(r.name || '') + '"></label>' +
      '<div class="sx-rec__acts"><button class="sx-btn sx-btn--ghost" data-sx-i="rec-cancel">Cancelar</button><button class="sx-btn" data-sx-i="rec-save">Guardar atajo</button></div></section>';
  }
  function render() {
    var q = norm(input.value.trim()), html = '', ayudaCtx = ctxId === 'ayuda';
    if (rec_) { results.innerHTML = recHTML(); return; }
    APP = appItems();
    if (!q && ayudaCtx) {
      HELP = window.Soporte ? Soporte.faqs(6) : [];
      results.innerHTML = '<section class="sx-card"><h3>Temas de ayuda</h3>' + HELP.map(function (h, i) { return row('hp:' + i, h.icon, esc(h.t), 'Pregunta frecuente'); }).join('') + '</section>';
      return;
    }
    if (!q) {
      // Antes de escribir: lo reciente, tus atajos y la ayuda. Las acciones aparecen al buscar
      var cx = window.Contexto ? Contexto.info(ctxId) : null;
      html += sugerencias();
      if (recent.length) html += '<section class="sx-card"><h3>Recientes <button class="sx-link" data-sx-i="rc-clear">Borrar</button></h3>' +
        recent.map(function (r, i) { return row('rc:' + i, r.icon || 'history', esc(r.t), r.go.a ? 'Abrir' : r.go.sc ? 'Atajo' : r.go.ask ? 'Preguntarle a Uku' : r.go.faq != null ? 'Ayuda' : ''); }).join('') + '</section>';
      // Tus atajos grabados
      html += '<section class="sx-card"><h3>Tus atajos</h3>' +
        shortcuts.map(function (sc, i) { return row('sc:' + i, sc.icon || 'bolt', esc(sc.name), esc(scSub(sc)), '<span class="sx-del" data-sx-i="del:' + i + '" role="button" aria-label="Borrar atajo"><span class="material-symbols-rounded">close</span></span>'); }).join('') +
        row('rec', 'add', 'Grabar un atajo', 'Guarda una acción con sus datos') + '</section>';
      if (!cx || cx.id === 'inicio') {
        var m = moment();
        html += '<section class="sx-card"><h3>' + m.title + '</h3>' + row('mo', m.icon, m.main, m.sub) + '</section>';
      }
    } else {
      var ws = words(input.value);
      // Frase completa → el flujo ya lleno, listo para confirmar
      curIt = intent(input.value);
      if (curIt) html += '<section class="sx-card"><h3>Hacer ahora</h3>' + row('it', curIt.icon, esc(curIt.name), 'Abre el flujo con los datos puestos') +
        '<button class="sx-link" data-sx-i="it-save"><span class="material-symbols-rounded">bookmark_add</span>Grabar como atajo</button></section>';
      var scs = rank(shortcuts, ws, function (sc) { return sc.name + ' ' + scSub(sc); });
      if (scs.length) html += '<section class="sx-card"><h3>Tus atajos</h3>' + scs.slice(0, 3).map(function (sc) { return row('sc:' + shortcuts.indexOf(sc), sc.icon || 'bolt', esc(sc.name), esc(scSub(sc))); }).join('') + '</section>';
      var acts = rank(ACTIONS, ws, function (a) { return a.label + ' ' + a.k + ' ' + T(a.label); }); // también en el idioma elegido
      var cxa = window.Contexto ? Contexto.info(ctxId).acciones : [];
      acts.sort(function (a, b) { return (cxa.indexOf(b.label) >= 0) - (cxa.indexOf(a.label) >= 0); }); // primero lo de esta sección
      if (acts.length) html += '<section class="sx-card"><h3>Acciones</h3>' + acts.slice(0, 4).map(function (a) { return row('a:' + ACTIONS.indexOf(a), a.icon, a.label); }).join('') + '</section>';
      var apps = rank(APP, ws, function (a) { return a.label + ' ' + a.k; });
      if (apps.length) html += '<section class="sx-card"><h3>En la app</h3>' + apps.slice(0, 4).map(function (a) { return row('app:' + APP.indexOf(a), a.icon, esc(a.label), a.sub); }).join('') + '</section>';
      // Personas con las que te mueves dinero y movimientos (por nombre o por monto): salen del PFM, que ve toda la app
      PER = window.PFM && PFM.contactos && q.length > 2 ? PFM.contactos(ws[0] || q).slice(0, 3) : [];
      if (PER.length) html += '<section class="sx-card"><h3>Personas</h3>' + PER.map(function (x, i) { return row('per:' + i, 'send_money', esc(x.n), (x.veces === 1 ? '1 vez' : x.veces + ' veces') + ' · la última el ' + x.ultL, 'Transferir'); }).join('') + '</section>';
      TX = window.PFM && PFM.buscar && q.length > 1 ? PFM.buscar(input.value, 4) : [];
      if (!TX.length) {
        var d = window.Asistente && Asistente.data && Asistente.data();
        if (d && q.length > 1) {
          var MON = ['ago', 'sep', 'oct'];
          TX = d.tx.filter(function (t) { return t.cat !== 'ahorro' && norm(t.who).indexOf(q) >= 0; })
            .sort(function (a, b) { return (b.mi * 40 + b.day) - (a.mi * 40 + a.day); }).slice(0, 4)
            .map(function (t) { return { t: t.who, f: t.day + ' ' + MON[t.mi], m: t.cat === 'ingreso' ? t.amt : -t.amt, src: '' }; });
        }
      }
      if (TX.length) html += '<section class="sx-card"><h3>Movimientos</h3>' + TX.map(function (t, i) {
        return row('tx:' + i, t.m > 0 ? 'south_west' : 'north_east', esc(t.t), t.f + (t.src ? ' · ' + t.src : ''), (t.m > 0 ? '+' : '−') + money(Math.abs(t.m)));
      }).join('') + '</section>';
      // Ayuda: preguntas frecuentes y tutoriales del centro de ayuda
      HELP = window.Soporte && Soporte.find ? Soporte.find(input.value, ayudaCtx ? 6 : 3) : [];
      if (HELP.length && !ayudaCtx) html += '<section class="sx-card"><h3>Ayuda</h3>' + HELP.map(function (h, i) { return row('hp:' + i, h.icon, esc(h.t), h.kind === 'tut' ? 'Tutorial' : 'Pregunta frecuente'); }).join('') + '</section>';
      // Al final, el análisis con IA de Uku (se marca como IA)
      var asks = rank(ASKS, ws, function (a) { return a.q + ' ' + a.k + ' ' + T(a.q); }).slice(0, 2);
      if (asks.length) html += '<section class="sx-card"><h3>Analizar con ' + ukuName() + ' <span class="ai-badge">IA</span></h3>' + asks.map(function (a) { return row('q:' + ASKS.indexOf(a), 'ai', a.q); }).join('') + '</section>';
      // En Ayuda, los temas de ayuda van primero
      if (ayudaCtx && HELP.length) html = '<section class="sx-card"><h3>Ayuda</h3>' + HELP.map(function (h, i) { return row('hp:' + i, h.icon, esc(h.t), h.kind === 'tut' ? 'Tutorial' : 'Pregunta frecuente'); }).join('') + '</section>' + html;
      // Lo que no se resuelve aquí (o es una pregunta) va al Asistente, con la misma frase
      var hadResults = !!html, esPregunta = /[?¿]|^(cu[aá]nto|c[oó]mo|qu[eé]|por qu[eé]|d[oó]nde|cu[aá]ndo|cu[aá]l|en qu[eé]|me |debo|puedo)/i.test(input.value.trim());
      if (!hadResults) html += '<section class="sx-card sx-empty"><p>No encontramos «' + esc(input.value.trim()) + '» en la app.</p>' +
        row('help', 'help', 'Buscar en la ayuda', 'Preguntas frecuentes y tutoriales') + '</section>';
      var askRow = '<section class="sx-card sx-ask">' + row('ask', 'ai', esc(input.value.trim()), 'Pregúntale a ' + ukuName() + ' · IA') + '</section>';
      html = (esPregunta || !hadResults) ? askRow + html : html + askRow;
    }
    results.innerHTML = html;
  }

  /* Dictado: se cierra solo apenas llega una frase (o tras 1,2 s de silencio,
     o a los 8 s como máximo) y muestra lo que entendió antes de buscar. */
  var rec = null;
  function dictate() {
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { input.focus(); return; }
    if (rec) { rec.stop(); return; } // tocar de nuevo = parar
    var r = rec = new R(), quiet, cap, got = '';
    r.lang = 'es-EC'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    input.blur(); input.value = ''; input.placeholder = 'Te escucho…';
    el.classList.add('is-listening'); el.classList.remove('is-heard'); fx('select');
    function stop() { clearTimeout(quiet); clearTimeout(cap); try { r.stop(); } catch (e) {} }
    cap = setTimeout(stop, 8000);
    r.onresult = function (e) {
      var fin = false;
      got = Array.prototype.map.call(e.results, function (x) { if (x.isFinal) fin = true; return x[0].transcript; }).join('');
      input.value = got; render();
      clearTimeout(quiet);
      if (fin) stop(); else quiet = setTimeout(stop, 1200);
    };
    r.onerror = stop;
    r.onend = function () {
      clearTimeout(quiet); clearTimeout(cap); rec = null;
      el.classList.remove('is-listening'); input.placeholder = '¿Qué necesitas hoy?';
      if (got.trim()) {
        var ic = el.querySelector('.sx-mic span');
        el.classList.add('is-heard'); ic.textContent = 'check'; fx('success');
        setTimeout(function () { el.classList.remove('is-heard'); ic.textContent = 'mic'; }, 1400);
      }
    };
    try { r.start(); } catch (e) { rec = null; el.classList.remove('is-listening'); input.placeholder = '¿Qué necesitas hoy?'; }
  }

  function open(c) {
    if (!el) mount();
    if (open_) return;
    open_ = true;
    rec_ = null;
    ctxId = c || (window.Contexto ? Contexto.get() : null); // la sección desde donde se abre (o 'ayuda')
    input.value = '';
    render();
    el.classList.add('open');
    if (el._fit) el._fit();
    document.documentElement.classList.add('sx-open');
    input.focus({ preventScroll: true }); // dentro del gesto: iOS sí muestra el teclado
    if (window.Overlay) Overlay.push('sx', function () { close(); }); // el "atrás" del teléfono lo cierra
    fx('open');
  }
  function close(silent) {
    if (!open_) return;
    open_ = false;
    if (rec) try { rec.abort(); } catch (e) {}
    input.blur();
    el.classList.remove('open');
    document.documentElement.classList.remove('sx-open');
    if (window.Overlay) Overlay.done('sx');
    if (!silent) fx('close');
  }

  /* ---------- Gesto: deslizar hacia abajo desde el tope de Inicio ---------- */
  function homeVisible() {
    var h = document.getElementById('home-page');
    // Dentro de una tarjeta o sección de Uku el tirón hacia abajo cierra la tarjeta, no abre el buscador (que ya está abajo)
    return h && !h.classList.contains('hidden') && document.body.style.overflow !== 'hidden' && !document.documentElement.classList.contains('has-sheet') && !document.documentElement.classList.contains('uk-chatting') &&
      !document.querySelector('.push-page.open, .as-page.open, .pf-page.open:not(.pf-page--inline), .sheet.open, .card-detail.open, #login-screen.active');
  }
  var pull = null, PULL = 72;
  function mountHint() {
    hint = document.createElement('div');
    hint.className = 'sx-hint';
    hint.innerHTML = '<span class="material-symbols-rounded">search</span><span>Busca o pregunta</span>';
    document.body.appendChild(hint);
  }
  document.addEventListener('touchstart', function (e) {
    if (open_ || AppScroll.top() > 0 || !homeVisible() || e.touches.length > 1) { pull = null; return; }
    if (e.target.closest('.debit-card, .tabs, .home-banner__track, .promos, input, textarea')) { pull = null; return; }
    pull = { y: e.touches[0].clientY, x: e.touches[0].clientX, dy: 0, axis: null, armed: false };
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!pull) return;
    var dy = e.touches[0].clientY - pull.y, dx = e.touches[0].clientX - pull.x;
    if (!pull.axis && Math.hypot(dx, dy) > 10) pull.axis = Math.abs(dy) > Math.abs(dx) && dy > 0 ? 'down' : 'other';
    if (pull.axis !== 'down' || AppScroll.top() > 0) return;
    e.preventDefault();
    if (!hint) mountHint();
    var d = Math.min(140, dy * .55);
    pull.dy = dy;
    hint.style.transition = 'none';
    hint.style.opacity = Math.min(1, d / 50).toFixed(2);
    hint.style.transform = 'translate(-50%, ' + (d - 60).toFixed(0) + 'px) scale(' + (0.9 + Math.min(.1, d / 600)).toFixed(3) + ')';
    var armed = dy * .55 >= PULL;
    if (armed !== pull.armed) { pull.armed = armed; hint.classList.toggle('is-armed', armed); if (armed) fx('detent'); }
  }, { passive: false });
  document.addEventListener('touchend', function () {
    if (!pull) return;
    var armed = pull.armed;
    pull = null;
    if (hint) {
      hint.style.transition = '';
      hint.style.opacity = '0';
      hint.style.transform = 'translate(-50%, -60px) scale(.9)';
      hint.classList.remove('is-armed');
    }
    if (armed) open();
  });
  // En escritorio: rueda hacia arriba estando en el tope
  var wheelAcc = 0, wheelT;
  window.addEventListener('wheel', function (e) {
    if (open_ || AppScroll.top() > 0 || e.deltaY >= 0 || !homeVisible()) { wheelAcc = 0; return; }
    wheelAcc += -e.deltaY;
    clearTimeout(wheelT); wheelT = setTimeout(function () { wheelAcc = 0; }, 250);
    if (wheelAcc > 220) { wheelAcc = 0; open(); }
  }, { passive: true });

  // La lupa de la barra superior también lo abre (en captura, antes que el toast genérico)
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action="Buscar"]');
    if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    open();
  }, true);

  window.Buscador = { open: open, close: close, voice: function () { open(); setTimeout(dictate, 260); }, shortcuts: function () { return shortcuts.slice(); },
    // Para la versión asistente: las acciones, su orden por palabras y cómo abrirlas
    actions: function () { return ACTIONS.slice(); }, rank: function (q) { return rank(ACTIONS, words(q), function (a) { return a.label + ' ' + a.k; }); }, run: runAction,
    // Para el buscador universal del asistente: la frase hecha acción, las pantallas de la app y los atajos
    intent: intent, atajo: function (sc) { if (window.__runShortcut) window.__runShortcut(sc); },
    app: function (q) { return rank(appItems(), words(q), function (a) { return a.label + ' ' + a.k; }).slice(0, 4).map(function (a) { return { label: a.label, icon: a.icon, sub: a.sub }; }); },
    abrir: function (label) { var a = appItems().filter(function (x) { return x.label === label; })[0]; if (!a) return; if (a.view != null && window.__goView) window.__goView(a.view); setTimeout(function () { a.el.click(); }, a.view != null ? 120 : 0); } };
})();
