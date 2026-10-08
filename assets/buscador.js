/* =====================================================================
   Buscador tipo Siri
   Se abre deslizando hacia abajo desde el tope de Inicio (o con la lupa
   de la barra superior). Muestra acciones sugeridas, una recomendación
   según la hora y, al escribir, acciones, movimientos y la opción de
   preguntarle al asistente.
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
    { label: 'Transferir', icon: 'send_money', action: 'Transferir dinero', k: 'transferir enviar pasar plata dinero' },
    { label: 'Pagar con QR', icon: 'qr_code_scanner', action: 'Pagar con QR', k: 'pagar qr escanear codigo' },
    { label: 'Pagar servicios', icon: 'bolt', action: 'Pagar servicios', k: 'pagar servicios luz agua internet planilla' },
    { label: 'Recargar celular', icon: 'smartphone', action: 'Recargar celular', k: 'recargar celular saldo telefono' },
    { label: 'Mis finanzas', icon: 'insights', run: function () { window.Asistente && Asistente.openPF(); }, k: 'mis finanzas pfm gastos presupuesto salud financiera cuentas' },
    { label: 'Retirar sin tarjeta', icon: 'atm', action: 'Retirar sin tarjeta', k: 'retirar efectivo cajero sin tarjeta' },
    { label: 'Pagar tarjeta', icon: 'credit_card', action: 'Pagar tarjeta', k: 'pagar tarjeta credito deuda' },
    { label: 'Cobrar con QR', icon: 'qr_code_2', action: 'Cobrar con QR', k: 'cobrar qr recibir' },
    { label: 'Recibir dinero', icon: 'call_received', action: 'Recibir dinero', k: 'recibir dinero cuenta datos' },
    { label: 'Pagar transporte', icon: 'directions_bus', action: 'Pagar transporte', k: 'pagar transporte bus metro movilidad' },
    { label: 'Mis tarjetas', icon: 'wallet', tab: 'Tarjetas', k: 'tarjetas debito credito visa mastercard' },
    { label: 'Mis cuentas', icon: 'account_balance', tab: 'Cuentas', k: 'cuentas saldo ahorro corriente' },
    { label: 'Préstamos', icon: 'request_quote', tab: 'Prestamos', k: 'prestamo credito simular' },
    { label: 'Seguridad', icon: 'lock', action: 'Seguridad', k: 'seguridad clave bloquear' }
  ];
  var FEATURED = ['Transferir', 'Pagar con QR', 'Pagar servicios', 'Mis finanzas', 'Recargar celular', 'Retirar sin tarjeta', 'Pagar tarjeta', 'Mis tarjetas'];

  function runAction(a) {
    close(true);
    setTimeout(function () {
      if (a.run) return a.run();
      if (a.tab) {
        var t = document.querySelector('.tabs .tab[data-panel="' + a.tab + '"]');
        if (t) { t.click(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        return;
      }
      var el = document.querySelector('#home-page [data-action="' + a.action + '"]') || document.querySelector('[data-action="' + a.action + '"]');
      if (el) el.click();
    }, 280);
  }

  /* Sugerencia según la hora: lo que la persona suele hacer a esta hora. */
  function moment() {
    var h = new Date().getHours();
    if (h < 12) return { title: 'Suele hacerse por la mañana', icon: 'bolt', main: 'Pagar Luz de la casa', sub: 'Vence hoy · ' + money(24.8), a: ACTIONS[2] };
    if (h < 19) return { title: 'Suele hacerse a esta hora', icon: 'send_money', main: 'Transferir a Ana Torres', sub: 'Lo haces casi todos los viernes', a: ACTIONS[0] };
    return { title: 'Suele hacerse por la noche', icon: 'insights', main: 'Revisar tus gastos de hoy', sub: 'En Mis finanzas', a: ACTIONS[4] };
  }

  var el, input, results, hint, open_ = false;
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
          '<input type="search" enterkeyhint="search" autocomplete="off" placeholder="Busca o pregunta" aria-label="Busca o pregunta">' +
          '<button type="button" class="sx-mic" data-sx="mic" aria-label="Dictar"><span class="material-symbols-rounded">mic</span></button>' +
        '</form><button class="sx-cancel" data-sx="close">Cancelar</button></div>' +
        '<div class="sx-results"></div>' +
      '</div>';
    document.body.appendChild(el);
    input = el.querySelector('input');
    results = el.querySelector('.sx-results');
    input.addEventListener('input', render);
    el.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var first = results.querySelector('[data-sx-i]');
      if (first) first.click();
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sx],[data-sx-i]');
      if (!b) return;
      if (b.dataset.sx === 'close') return close();
      if (b.dataset.sx === 'mic') return dictate();
      var i = b.dataset.sxI;
      if (i === 'ask') { var q = input.value.trim(); close(true); setTimeout(function () { window.Asistente && Asistente.ask(q); }, 280); return; }
      if (i === 'pfm') return runAction(ACTIONS[4]);
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
    var ic = icon === 'uku' && window.Asistente ? '<span class="sx-row__ic sx-row__ic--uku">' + Asistente.faceIMG() + '</span>' : '<span class="sx-row__ic material-symbols-rounded">' + icon + '</span>';
    return '<button class="sx-row" data-sx-i="' + id + '">' + ic + '<span class="sx-row__main"><b>' + main + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + (right ? '<span class="sx-row__r">' + right + '</span>' : '') + '</button>';
  }
  function render() {
    var q = norm(input.value.trim()), html = '';
    if (!q) {
      var m = moment();
      var data = window.Asistente && Asistente.data && Asistente.data();
      html += '<section class="sx-card"><h3>Sugerencias</h3><div class="sx-grid">' +
        FEATURED.map(function (l) { return tile(ACTIONS.filter(function (a) { return a.label === l; })[0]); }).join('') + '</div></section>';
      html += '<section class="sx-card"><h3>' + m.title + '</h3>' + row('a:' + ACTIONS.indexOf(m.a), m.icon, m.main, m.sub) +
        (data ? row('pfm', 'uku', 'Mis finanzas', 'Tu resumen de septiembre ya está listo · Salud financiera ' + data.score) : '') + '</section>';
    } else {
      var acts = ACTIONS.filter(function (a) { return norm(a.label + ' ' + a.k).indexOf(q) >= 0 || q.split(' ').every(function (w) { return norm(a.k + ' ' + a.label).indexOf(w) >= 0; }); });
      if (acts.length) html += '<section class="sx-card"><h3>Acciones</h3>' + acts.slice(0, 5).map(function (a) { return row('a:' + ACTIONS.indexOf(a), a.icon, a.label); }).join('') + '</section>';
      var d = window.Asistente && Asistente.data && Asistente.data();
      if (d && q.length > 1) {
        var MON = ['ago', 'sep', 'oct'];
        var tx = d.tx.filter(function (t) { return t.cat !== 'ahorro' && norm(t.who).indexOf(q) >= 0; })
          .sort(function (a, b) { return (b.mi * 40 + b.day) - (a.mi * 40 + a.day); }).slice(0, 4);
        if (tx.length) html += '<section class="sx-card"><h3>Movimientos</h3>' + tx.map(function (t) {
          var inc = t.cat === 'ingreso';
          return row('pfm', inc ? 'south_west' : 'north_east', esc(t.who), t.day + ' ' + MON[t.mi], (inc ? '+' : '-') + money(t.amt));
        }).join('') + '</section>';
      }
      html += '<section class="sx-card">' + row('ask', 'uku', 'Pregúntale a ' + ((window.Asistente && Asistente.name && Asistente.name()) || 'Uku'), '«' + esc(input.value.trim()) + '»') + '</section>';
    }
    results.innerHTML = html;
  }

  function dictate() {
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { input.focus(); return; }
    var r = new R(); r.lang = 'es-EC'; r.interimResults = true;
    el.classList.add('is-listening'); fx('select');
    r.onresult = function (e) { input.value = Array.prototype.map.call(e.results, function (x) { return x[0].transcript; }).join(''); render(); };
    r.onend = function () { el.classList.remove('is-listening'); };
    try { r.start(); } catch (e) { el.classList.remove('is-listening'); }
  }

  function open() {
    if (!el) mount();
    if (open_) return;
    open_ = true;
    input.value = '';
    render();
    el.classList.add('open');
    if (el._fit) el._fit();
    document.documentElement.classList.add('sx-open');
    input.focus({ preventScroll: true }); // dentro del gesto: iOS sí muestra el teclado
    fx('open');
  }
  function close(silent) {
    if (!open_) return;
    open_ = false;
    input.blur();
    el.classList.remove('open');
    document.documentElement.classList.remove('sx-open');
    if (!silent) fx('close');
  }

  /* ---------- Gesto: deslizar hacia abajo desde el tope de Inicio ---------- */
  function homeVisible() {
    var h = document.getElementById('home-page');
    return h && !h.classList.contains('hidden') && document.body.style.overflow !== 'hidden' &&
      !document.querySelector('.push-page.open, .as-page.open, .pf-page.open, .sheet.open, .card-detail.open, #login-screen.active');
  }
  var pull = null, PULL = 72;
  function mountHint() {
    hint = document.createElement('div');
    hint.className = 'sx-hint';
    hint.innerHTML = '<span class="material-symbols-rounded">search</span><span>Busca o pregunta</span>';
    document.body.appendChild(hint);
  }
  document.addEventListener('touchstart', function (e) {
    if (open_ || window.scrollY > 0 || !homeVisible() || e.touches.length > 1) { pull = null; return; }
    if (e.target.closest('.debit-card, .tabs, .home-banner__track, .promos, input, textarea')) { pull = null; return; }
    pull = { y: e.touches[0].clientY, x: e.touches[0].clientX, dy: 0, axis: null, armed: false };
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!pull) return;
    var dy = e.touches[0].clientY - pull.y, dx = e.touches[0].clientX - pull.x;
    if (!pull.axis && Math.hypot(dx, dy) > 10) pull.axis = Math.abs(dy) > Math.abs(dx) && dy > 0 ? 'down' : 'other';
    if (pull.axis !== 'down' || window.scrollY > 0) return;
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
    if (open_ || window.scrollY > 0 || e.deltaY >= 0 || !homeVisible()) { wheelAcc = 0; return; }
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

  window.Buscador = { open: open, close: close };
})();
