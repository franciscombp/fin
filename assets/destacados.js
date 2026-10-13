/* =====================================================================
   Destacados — widgets del Home
   - Tamaños fijos, como los widgets de iOS: pequeño (½ ancho, cuadrado),
     mediano (ancho completo, 1 fila) y grande (ancho completo, 2 filas).
     La grilla es de 2 columnas y filas de alto fijo, así nada rompe el
     layout: cada widget dibuja solo lo que cabe en su tamaño.
   - Catálogo según los productos del cliente (cuentas, tarjeta, pagos,
     inversión, préstamo, millas), herramientas (Mis finanzas, metas,
     atajos) y ofertas para las que es elegible (captación).
   - Editar (o mantener presionado un widget): quitar, cambiar tamaño y
     arrastrar para ordenar. "Agregar widget" abre una galería con vista
     previa de cada tamaño. Restablecer vuelve a los sugeridos.
   - Montos sensibles se enmascaran con el ojo de saldo.
   - Sin alertas: los avisos importantes van a Notificaciones.
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'pb_widgets_v2', MAX = 8;
  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function money(v) { var s = Math.abs(v).toFixed(2).split('.'); return (v < 0 ? '-' : '') + '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sens(v) { return '<span class="dw-s"><span class="dw-s__v">' + v + '</span><span class="dw-s__m" aria-hidden="true">••••</span></span>'; }
  function data() { return window.Asistente && Asistente.data && Asistente.data(); }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function bar(p, cls) { return '<u class="dw-bar' + (cls ? ' ' + cls : '') + '"><i style="width:' + Math.round(Math.max(0, Math.min(1, p)) * 100) + '%"></i></u>'; }
  function ring(p, label) {
    var C = 2 * Math.PI * 22, v = Math.max(0, Math.min(1, p));
    return '<span class="dw-ring"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="22"/><circle cx="26" cy="26" r="22" class="dw-ring__v" stroke-dasharray="' + (C * v).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg><b>' + label + '</b></span>';
  }
  var CAT_NAMES = { super: 'Supermercado', delivery: 'Restaurantes y delivery', compras: 'Compras', servicios: 'Servicios básicos', transporte: 'Transporte', ocio: 'Ocio', subs: 'Suscripciones', cafe: 'Cafés y antojos', salud: 'Salud' };
  var BUDGET = { super: 360, delivery: 160, transporte: 90, compras: 260, cafe: 45, salud: 40, ocio: 90 };
  var PAYS = [['Luz de la casa', 24.8, 'Hoy', 'Pagar Luz de la casa'], ['Casa de la abue', 18.35, '12 oct', 'Pagar Casa de la abue'], ['Internet', 32.5, '11 oct', ''], ['Celular', 20, '15 oct', '']];

  /* ---------- Catálogo ----------
     group: productos (lo que tiene), herramientas, ofertas (captación).
     sizes: tamaños permitidos; el primero es el sugerido. */
  var CATALOG = {
    saldo:      { name: 'Saldo disponible', icon: 'account_balance_wallet', group: 'productos', sizes: ['m', 's'], desc: 'Lo que tienes hoy en tus cuentas' },
    tarjeta:    { name: 'Tarjeta de crédito', icon: 'credit_card', group: 'productos', sizes: ['s', 'm'], desc: 'Por pagar, fecha de pago y cupo' },
    pagos:      { name: 'Próximos pagos', icon: 'event', group: 'productos', sizes: ['m', 's', 'l'], desc: 'Servicios que vencen pronto' },
    movimientos:{ name: 'Últimos movimientos', icon: 'receipt_long', group: 'productos', sizes: ['m', 'l'], desc: 'Lo último que entró y salió' },
    inversion:  { name: 'Inversión', icon: 'trending_up', group: 'productos', sizes: ['s', 'm'], desc: 'Tu depósito a plazo y lo que ganas' },
    prestamo:   { name: 'Préstamo', icon: 'request_quote', group: 'productos', sizes: ['s', 'm'], desc: 'Tu próxima cuota' },
    millas:     { name: 'Millas', icon: 'flight', group: 'productos', sizes: ['s'], desc: 'Tus millas para canjear' },
    gastos:     { name: 'Gastos del mes', icon: 'pie_chart', group: 'herramientas', sizes: ['m', 's', 'l'], desc: 'Cuánto gastaste y en qué' },
    presupuesto:{ name: 'Presupuesto', icon: 'donut_large', group: 'herramientas', sizes: ['s', 'm'], desc: 'Cómo vas con tus límites' },
    metas:      { name: 'Metas de ahorro', icon: 'flag', group: 'herramientas', sizes: ['s', 'm'], desc: 'Cuánto te falta para cada meta' },
    salud:      { name: 'Salud financiera', icon: 'favorite', group: 'herramientas', sizes: ['s', 'm'], desc: 'Tu puntaje y un consejo de Uku' },
    atajos:     { name: 'Tus atajos', icon: 'bolt', group: 'herramientas', sizes: ['m', 's'], desc: 'Las acciones que grabaste en el buscador' },
    preaprobado:{ name: 'Crédito preaprobado', icon: 'verified', group: 'ofertas', sizes: ['s', 'm'], desc: 'Un crédito listo para ti' },
    invertir:   { name: 'Haz crecer tu dinero', icon: 'savings', group: 'ofertas', sizes: ['m', 's'], desc: 'Inversiones desde $ 100' },
    seguro:     { name: 'Seguro de vida', icon: 'health_and_safety', group: 'ofertas', sizes: ['s'], desc: 'Protección desde $ 4 al mes' }
  };
  var GROUPS = [['productos', 'Tus productos'], ['herramientas', 'Herramientas'], ['ofertas', 'Para ti']];
  // Sugeridos: saldo y tarjeta arriba, luego pagos y gastos, y una oferta elegible
  var DEFAULT = [['saldo', 'm'], ['tarjeta', 's'], ['salud', 's'], ['pagos', 'm'], ['gastos', 'm'], ['metas', 's'], ['preaprobado', 's']];

  function load() {
    try { var p = JSON.parse(localStorage.getItem(KEY)); if (p && Array.isArray(p.items)) return p; } catch (e) {}
    return { custom: false, items: DEFAULT.map(function (x) { return { id: x[0], size: x[1] }; }) };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (e) {} }
  var pref = load();
  function items() { return pref.items.filter(function (w) { return CATALOG[w.id] && CATALOG[w.id].sizes.indexOf(w.size) >= 0; }).slice(0, MAX); }

  /* ---------- Acciones ---------- */
  function click(sel) { var e = document.querySelector(sel); if (e) e.click(); }
  function act(a) { click('#home-page [data-action="' + a + '"]'); }
  function card(n) { click('#home-page [data-panel="Tarjetas"] .product-row[data-action="' + n + '"]'); }
  function pfm() { window.Asistente && Asistente.openPF(); }
  function homeRow(panel) {
    var r = document.querySelector('#home-page [data-panel="' + panel + '"] .product-row[data-action]');
    if (!r) return null;
    var g = function (c) { var e = r.querySelector(c); return e ? e.textContent.trim() : ''; };
    return { action: r.dataset.action, name: g('.product-row__name'), sub: g('.product-row__sub'), amt: g('.product-row__amount') };
  }
  function shortcuts() {
    return window.Buscador && Buscador.shortcuts ? Buscador.shortcuts() : [];
  }

  /* ---------- Contenido por widget y tamaño ----------
     Cada render devuelve solo lo que cabe en ese tamaño. */
  var SHORT = { saldo: 'Saldo', tarjeta: 'Tarjeta', pagos: 'Pagos', inversion: 'Inversión', prestamo: 'Préstamo', gastos: 'Gastos', presupuesto: 'Presupuesto', metas: 'Metas', salud: 'Salud', atajos: 'Atajo', preaprobado: 'Preaprobado', invertir: 'Invertir', seguro: 'Seguro' };
  function head(id, size) { var c = CATALOG[id]; return '<p class="dw-h"><span class="material-symbols-rounded" aria-hidden="true">' + c.icon + '</span>' + (size === 's' && SHORT[id] ? SHORT[id] : c.name) + '</p>'; }
  var R = {
    saldo: function (s) {
      var d = data(), cash = d ? d.accts.filter(function (a) { return (a.type === 'ahorro' && a.id !== 'sie1') || a.type === 'corriente' || a.type === 'efectivo'; }) : [];
      var tot = cash.reduce(function (t, a) { return t + a.bal; }, 0);
      var b = '<p class="dw-value">' + sens(money(tot)) + '</p>';
      if (s === 's') return { body: b + '<p class="dw-sub">En ' + cash.length + ' cuentas</p>', go: function () { act('Cuenta PRINCIPAL'); } };
      return { body: '<div class="dw-split"><div>' + b + '<p class="dw-sub">En ' + cash.length + ' cuentas</p></div><div class="dw-split__r dw-rows">' + cash.slice(0, 3).map(function (a) { return '<span><span>' + esc(a.name) + '</span><b>' + sens(money(a.bal)) + '</b></span>'; }).join('') + '</div></div>', go: function () { act('Cuenta PRINCIPAL'); } };
    },
    tarjeta: function (s) {
      var d = data(), c = d && d.card, owed = c ? c.owed : 0, lim = c ? c.limit : 5000;
      var b = '<p class="dw-label">Por pagar</p><p class="dw-value">' + sens(money(owed)) + '</p>' + bar(owed / lim) + '<p class="dw-sub dw-1">Hasta el 10 nov</p>';
      if (s === 's') return { body: b, go: function () { card('Mastercard Black'); } };
      return { body: '<div class="dw-split"><div>' + b + '</div><div class="dw-split__r"><p class="dw-label">Cupo disponible</p><p class="dw-value dw-value--sm">' + sens(money(lim - owed)) + '</p>' +
        '<button class="dw-btn" data-dw-act="Pagar tarjeta">Pagar</button></div></div>', go: function () { card('Mastercard Black'); } };
    },
    pagos: function (s) {
      var n = s === 's' ? 1 : s === 'm' ? 2 : 4;
      if (s === 's') { var p = PAYS[0]; return { body: '<p class="dw-label">' + p[2] + '</p><p class="dw-value dw-value--sm">' + sens(money(p[1])) + '</p><p class="dw-sub">' + p[0] + '</p>', go: function () { pay(p); } }; }
      return { body: '<div class="dw-list-in">' + PAYS.slice(0, n).map(function (p, i) {
        return '<button class="dw-item" data-dw-pay="' + i + '"><span>' + p[0] + '<small>' + p[2] + '</small></span><b>' + sens(money(p[1])) + '</b></button>';
      }).join('') + '</div>', go: function () { act('Pagar servicios'); } };
    },
    movimientos: function (s) {
      var d = data(), MON = ['ago', 'sep', 'oct'];
      var tx = d ? d.tx.filter(function (t) { return t.cat !== 'ahorro'; }).sort(function (a, b) { return (b.mi * 40 + b.day) - (a.mi * 40 + a.day); }).slice(0, s === 'l' ? 5 : 2) : [];
      return { body: '<div class="dw-list-in">' + tx.map(function (t) {
        var inc = t.cat === 'ingreso';
        return '<span class="dw-tx"><span>' + esc(t.who) + '<small>' + t.day + ' ' + MON[t.mi] + '</small></span><b' + (inc ? ' class="is-in"' : '') + '>' + sens((inc ? '+' : '-') + money(t.amt)) + '</b></span>';
      }).join('') + '</div>', go: function () { act('Cuenta PRINCIPAL'); } };
    },
    inversion: function (s) {
      var r = homeRow('Inversiones') || { name: 'Depósito a plazo', sub: 'Vence: 12 nov 2026 · 7,25%', amt: '$ 3.000,00', action: 'Depósito a plazo' };
      var b = '<p class="dw-value dw-value--sm">' + sens(esc(r.amt)) + '</p><p class="dw-sub">' + esc(r.name) + '</p>';
      if (s === 's') return { body: b + '<p class="dw-sub">Vence el 12 nov</p>', go: function () { act(r.action); } };
      return { body: '<div class="dw-split"><div>' + b + '<p class="dw-sub">' + esc(r.sub) + '</p></div><div class="dw-split__r"><p class="dw-label">Has ganado</p><p class="dw-value dw-value--sm is-in">' + sens('+' + money(54.38)) + '</p><button class="dw-btn" data-dw-act="Renovar inversión">Renovar</button></div></div>', go: function () { act(r.action); } };
    },
    prestamo: function (s) {
      var r = homeRow('Prestamos') || { name: 'Préstamo de consumo', sub: 'Cuota 6 de 36', amt: '$ 245,90', action: 'Préstamo de consumo' };
      var b = '<p class="dw-label">Próxima cuota · 20 oct</p><p class="dw-value dw-value--sm">' + sens(esc(r.amt)) + '</p>';
      if (s === 's') return { body: b + bar(6 / 36) + '<p class="dw-sub">' + esc(r.sub) + '</p>', go: function () { act(r.action); } };
      return { body: '<div class="dw-split"><div>' + b + bar(6 / 36) + '<p class="dw-sub">' + esc(r.name) + ' · ' + esc(r.sub) + '</p></div><div class="dw-split__r"><button class="dw-btn" data-dw-act="Pagar servicios">Pagar cuota</button></div></div>', go: function () { act(r.action); } };
    },
    millas: function () {
      return { body: '<p class="dw-value dw-value--sm">' + sens('12.480') + '</p><p class="dw-sub">millas para canjear</p><p class="dw-sub">Un vuelo a Galápagos desde 8.900</p>', go: function () { act('Ver catálogo de millas'); } };
    },
    gastos: function (s) {
      var d = data(), sep = d ? d.by[1] : null, ago = d ? d.by[0] : null;
      var tot = sep ? sep._spend : 0, delta = ago && ago._spend ? tot / ago._spend - 1 : 0;
      var cats = sep ? Object.keys(CAT_NAMES).map(function (k) { return { k: k, v: sep[k] }; }).sort(function (a, b) { return b.v - a.v; }) : [];
      var b = '<p class="dw-label">Septiembre</p><p class="dw-value">' + sens(money(tot)) + '</p><p class="dw-sub">' + (delta >= 0 ? '+' : '') + pct(delta) + ' que agosto</p>';
      if (s === 's') return { body: b, go: pfm };
      var n = s === 'l' ? 5 : 3, max = cats[0] ? cats[0].v : 1;
      var rows = cats.slice(0, n).map(function (c) { return '<span class="dw-cat"><span>' + CAT_NAMES[c.k] + '</span><b>' + sens(money(c.v)) + '</b>' + bar(c.v / max, 'dw-bar--ink') + '</span>'; }).join('');
      if (s === 'm') return { body: '<div class="dw-split"><div>' + b + '</div><div class="dw-split__r dw-cats">' + rows + '</div></div>', go: pfm };
      return { body: b + '<div class="dw-cats dw-cats--l">' + rows + '</div><span class="dw-more">Ver Mis finanzas</span>', go: pfm };
    },
    presupuesto: function (s) {
      var d = data(), o = d ? d.by[2] : null, day = 8 / 31;
      var ks = Object.keys(BUDGET).map(function (k) { return { k: k, p: o ? o[k] / BUDGET[k] : 0 }; }).sort(function (a, b) { return b.p - a.p; });
      var w = ks[0];
      if (s === 's') return { body: ring(w.p, pct(w.p)) + '<p class="dw-sub">' + CAT_NAMES[w.k] + '</p><p class="dw-sub">' + (w.p > day + .15 ? 'Vas rápido este mes' : 'Vas bien') + '</p>', go: pfm };
      return { body: '<p class="dw-label">Octubre · vas por el ' + pct(day) + ' del mes</p><div class="dw-cats dw-cats--fill">' + ks.slice(0, 3).map(function (c) {
        return '<span class="dw-cat"><span>' + CAT_NAMES[c.k] + '</span><b>' + pct(c.p) + '</b>' + bar(c.p, c.p > day + .15 ? 'dw-bar--warn' : '') + '</span>';
      }).join('') + '</div>', go: pfm };
    },
    metas: function (s) {
      var d = data(), g = d ? d.goals : [];
      if (!g.length) return { body: '<p class="dw-sub">Crea tu primera meta</p>', go: function () { act('Crear meta de ahorro'); } };
      if (s === 's') return { body: ring(g[0].have / g[0].target, pct(g[0].have / g[0].target)) + '<p class="dw-sub dw-1 dw-sub--ink">' + esc(g[0].name) + '</p><p class="dw-sub dw-1">' + sens(money(g[0].have)) + '</p>', go: pfm };
      return { body: '<div class="dw-cats">' + g.slice(0, 2).map(function (x) {
        return '<span class="dw-cat"><span>' + esc(x.name) + '</span><b>' + sens(money(x.have)) + '</b>' + bar(x.have / x.target) + '<small>' + pct(x.have / x.target) + ' de ' + money(x.target) + '</small></span>';
      }).join('') + '</div>', go: pfm };
    },
    salud: function (s) {
      var d = data(), sc = d ? d.score : 0, lv = sc >= 80 ? 'Excelente' : sc >= 55 ? 'Muy bien' : sc >= 30 ? 'Regular' : 'Por mejorar';
      var face = '<span class="dw-face">' + (window.Asistente ? Asistente.faceIMG() : '') + '</span>';
      var b = '<div class="dw-score"><p class="dw-value">' + sc + '<small>/100</small></p>' + face + '</div><p class="dw-sub">' + lv + '</p>';
      if (s === 's') return { body: b, go: pfm };
      var tip = window.Asistente && Asistente.insights ? Asistente.insights()[0] : null;
      return { body: '<div class="dw-split"><div>' + b + '</div><div class="dw-split__r dw-tip"><p>' + (tip ? tip.title : 'Sigue así: vas muy bien.') + '</p></div></div>', go: pfm };
    },
    atajos: function (s) {
      var list = shortcuts();
      if (!list.length) return { body: '<p class="dw-sub">Graba un atajo desde el buscador</p>', go: function () { window.Buscador && Buscador.open(); } };
      if (s === 's') { var a = list[0]; return { body: '<span class="dw-ic material-symbols-rounded">' + (a.icon || 'bolt') + '</span><p class="dw-sub dw-sub--ink">' + esc(a.name) + '</p>', go: function () { window.__runShortcut && __runShortcut(a); } }; }
      return { body: '<div class="dw-short">' + list.slice(0, 4).map(function (a, i) {
        return '<button data-dw-sc="' + i + '"><span class="material-symbols-rounded">' + (a.icon || 'bolt') + '</span><span>' + esc(a.name) + '</span></button>';
      }).join('') + '</div>' };
    },
    preaprobado: function (s) {
      var b = '<p class="dw-promo">Tienes hasta <b>' + sens(money(8000)) + '</b> preaprobados</p>';
      return { body: b + (s === 'm' ? '<p class="dw-sub">Lo recibes al instante en tu cuenta.</p>' : '') + '<span class="dw-cta">Simular</span>', go: function () { act('Simular crédito preaprobado'); } };
    },
    invertir: function (s) {
      return { body: '<p class="dw-promo">Gana <b>7,25% al año</b>' + (s === 'm' ? ' mientras tu dinero sigue seguro' : '') + '</p><span class="dw-cta">' + (s === 'm' ? 'Invertir desde $ 100' : 'Invertir') + '</span>', go: function () { act('Crear inversión'); } };
    },
    seguro: function () {
      return { body: '<p class="dw-promo">Protege a los tuyos desde <b>$ 4 al mes</b></p><span class="dw-cta">Ver seguro</span>', go: function () { act('Seguro de vida'); } };
    }
  };
  function pay(p) { if (p[3]) click('.list-item[data-sheet="payment"][data-title="' + p[3] + '"]'); else act('Pagar servicios'); }

  function widgetHTML(w, preview) {
    var c = CATALOG[w.id], r = R[w.id](w.size), offer = c.group === 'ofertas';
    if (!preview) gos[w.id] = r.go;
    return '<article class="dw dw--' + w.size + (offer ? ' dw--offer' : '') + '" data-dw-id="' + w.id + '"' + (r.go && !preview ? ' role="button" tabindex="0"' : '') + ' aria-label="' + esc(c.name) + '">' +
      head(w.id, w.size) + '<div class="dw-body">' + r.body + '</div>' +
      (preview ? '' : '<button class="dw-x" data-dw-del="' + w.id + '" aria-label="Quitar ' + esc(c.name) + '"><span class="material-symbols-rounded">remove</span></button>' +
        (c.sizes.length > 1 ? '<button class="dw-size" data-dw-size="' + w.id + '" aria-label="Cambiar tamaño">' + SIZE[w.size] + '<span class="material-symbols-rounded">unfold_more</span></button>' : '')) +
      '</article>';
  }
  var SIZE = { s: 'Pequeño', m: 'Mediano', l: 'Grande' };

  /* ---------- Montaje y pintado ---------- */
  var host, list, gos = {}, editing = false;
  function mount() {
    var panel = document.querySelector('.tab-panel[data-panel="Destacado"]');
    if (!panel || document.getElementById('dw-host')) return;
    var old = Array.prototype.find.call(panel.querySelectorAll('.section'), function (s) {
      var h = s.querySelector('.section__title h2'); return h && /Novedades/.test(h.textContent);
    });
    host = document.createElement('section');
    host.className = 'section dw-section';
    host.id = 'dw-host';
    host.innerHTML = '<div class="section__title"><h2>Destacados</h2><button class="section__link" data-dw="edit">Editar</button></div>' +
      '<div class="dw-grid"></div>' +
      '<div class="dw-edit-bar"><button class="dw-add" data-dw="add"><span class="material-symbols-rounded">add</span>Agregar widget</button>' +
      '<button class="pf-link" data-dw="reset">Restablecer sugeridos</button></div>';
    if (old) { old.parentNode.insertBefore(host, old); old.hidden = true; } else panel.appendChild(host);
    list = host.querySelector('.dw-grid');
    host.addEventListener('click', onClick);
    host.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.dw[role="button"]')) { e.preventDefault(); e.target.click(); } });
    dragInit();
    var eye = document.getElementById('balance-toggle');
    var sync = function () { document.documentElement.classList.toggle('pb-masked', eye && eye.getAttribute('aria-pressed') === 'true'); };
    if (eye) new MutationObserver(sync).observe(eye, { attributes: true, attributeFilter: ['aria-pressed'] });
    sync();
  }
  function paint() {
    if (!host) return;
    gos = {};
    var ws = items();
    list.innerHTML = ws.map(function (w) { return widgetHTML(w); }).join('') ||
      '<p class="dw-empty">Sin widgets. <button class="pf-link" data-dw="add">Agregar widget</button></p>';
    host.classList.toggle('is-editing', editing);
    host.querySelector('[data-dw="edit"]').textContent = editing ? 'Listo' : 'Editar';
    host.querySelector('[data-dw="add"]').disabled = ws.length >= MAX;
  }
  function setEditing(on) { editing = on; fx(on ? 'select' : 'success'); paint(); }
  function commit() { pref.custom = true; save(); paint(); }

  function onClick(e) {
    var b;
    if (drag && drag.moved) return;
    if ((b = e.target.closest('[data-dw="edit"]'))) { e.stopPropagation(); return setEditing(!editing); }
    if ((b = e.target.closest('[data-dw="add"]'))) { e.stopPropagation(); return openGallery(); }
    if ((b = e.target.closest('[data-dw="reset"]'))) { try { localStorage.removeItem(KEY); } catch (x) {} pref = load(); fx('select'); return paint(); }
    if ((b = e.target.closest('[data-dw-del]'))) {
      e.stopPropagation();
      pref.items = pref.items.filter(function (w) { return w.id !== b.dataset.dwDel; }); fx('toggle'); return commit();
    }
    if ((b = e.target.closest('[data-dw-size]'))) {
      e.stopPropagation();
      var w = pref.items.filter(function (x) { return x.id === b.dataset.dwSize; })[0], sz = CATALOG[w.id].sizes;
      w.size = sz[(sz.indexOf(w.size) + 1) % sz.length]; fx('select'); return commit();
    }
    if (editing) return; // en edición, tocar un widget no lo abre
    if ((b = e.target.closest('[data-dw-pay]'))) { e.stopPropagation(); return pay(PAYS[+b.dataset.dwPay]); }
    if ((b = e.target.closest('[data-dw-act]'))) { e.stopPropagation(); return act(b.dataset.dwAct); }
    if ((b = e.target.closest('[data-dw-sc]'))) { e.stopPropagation(); var sc = shortcuts()[+b.dataset.dwSc]; return window.__runShortcut && __runShortcut(sc); }
    if ((b = e.target.closest('[data-dw-id]')) && gos[b.dataset.dwId]) { fx('tap'); gos[b.dataset.dwId](); }
  }

  /* ---------- Arrastrar para ordenar ----------
     En edición se arrastra directo; fuera de edición, mantener presionado
     un widget 450 ms entra en edición (como en iOS). */
  var drag = null, pressT = 0;
  function dragInit() {
    list.addEventListener('pointerdown', function (e) {
      var el = e.target.closest('.dw');
      if (!el || e.target.closest('.dw-x, .dw-size') || e.button > 0) return;
      if (!editing) {
        clearTimeout(pressT);
        var x0 = e.clientX, y0 = e.clientY;
        var cancel = function (ev) { if (!ev || Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) { clearTimeout(pressT); off(); } };
        var off = function () { list.removeEventListener('pointermove', cancel); list.removeEventListener('pointerup', up1); };
        var up1 = function () { clearTimeout(pressT); off(); };
        list.addEventListener('pointermove', cancel); list.addEventListener('pointerup', up1);
        pressT = setTimeout(function () { off(); drag = { moved: true }; setEditing(true); setTimeout(function () { drag = null; }, 400); }, 450);
        return;
      }
      var r = el.getBoundingClientRect();
      drag = { el: el, id: el.dataset.dwId, ox: e.clientX - r.left, oy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false, pid: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
    });
    // Mover y soltar se escuchan en la ventana: al reubicar el widget en el DOM
    // el navegador suelta la captura del puntero.
    window.addEventListener('pointermove', function (e) {
      if (!drag || !drag.el || e.pointerId !== drag.pid) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      if (!drag.moved) { drag.moved = true; drag.el.classList.add('is-drag'); fx('detent'); }
      e.preventDefault();
      // ¿Sobre qué widget está el dedo? Se reubica antes o después de él
      drag.el.style.visibility = 'hidden';
      var under = document.elementFromPoint(e.clientX, e.clientY);
      drag.el.style.visibility = '';
      var t = under && under.closest('.dw-grid .dw');
      if (t && t !== drag.el) {
        // Mitad de abajo (o mitad derecha de un pequeño) = después de ese widget
        var tr = t.getBoundingClientRect(), small = tr.width < list.clientWidth * .6;
        var after = small ? e.clientX > tr.left + tr.width / 2 : e.clientY > tr.top + tr.height / 2;
        var ref = after ? t.nextSibling : t;
        if (ref !== drag.el && ref !== drag.el.nextSibling) { list.insertBefore(drag.el, ref); fx('detent'); }
      }
      drag.el.style.transform = '';
      var r = drag.el.getBoundingClientRect();
      drag.el.style.transform = 'translate(' + (e.clientX - drag.ox - r.left) + 'px,' + (e.clientY - drag.oy - r.top) + 'px) scale(1.03)';
    });
    var end = function () {
      if (!drag || !drag.el) return;
      var moved = drag.moved;
      drag.el.classList.remove('is-drag'); drag.el.style.transform = '';
      if (moved) {
        var order = Array.prototype.map.call(list.querySelectorAll('.dw'), function (x) { return x.dataset.dwId; });
        pref.items.sort(function (a, b) { return order.indexOf(a.id) - order.indexOf(b.id); });
        pref.custom = true; save();
        setTimeout(function () { drag = null; paint(); }, 0);
      } else drag = null;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  /* ---------- Galería: agregar widgets con vista previa ---------- */
  var sheet, back, pick = {};
  function ensureSheet() {
    if (sheet) return;
    back = document.createElement('div'); back.className = 'as-sheet-back';
    sheet = document.createElement('div'); sheet.className = 'as-sheet dw-gallery'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Agregar widget');
    document.body.appendChild(back); document.body.appendChild(sheet);
    back.addEventListener('click', closeGallery);
    sheet.addEventListener('click', onGallery);
  }
  function openGallery() { ensureSheet(); paintGallery(); sheet.scrollTop = 0; back.classList.add('open'); sheet.classList.add('open'); fx('open'); }
  function closeGallery() { back.classList.remove('open'); sheet.classList.remove('open'); }
  function paintGallery() {
    var have = items().map(function (w) { return w.id; }), full = have.length >= MAX;
    sheet.innerHTML = '<div class="as-sheet__handle"></div><h3>Agregar widget</h3><p>' + (full ? 'Ya tienes ' + MAX + ' widgets. Quita uno para agregar otro.' : 'Elige un widget y su tamaño. Puedes tener hasta ' + MAX + '.') + '</p>' +
      GROUPS.map(function (g) {
        var ids = Object.keys(CATALOG).filter(function (id) { return CATALOG[id].group === g[0]; });
        return '<p class="as-sheet__label">' + g[1] + '</p>' + ids.map(function (id) {
          var c = CATALOG[id], sz = pick[id] || c.sizes[0], on = have.indexOf(id) >= 0;
          return '<div class="dw-gal">' +
            '<div class="dw-gal__head"><span class="dw-gal__ic material-symbols-rounded">' + c.icon + '</span><span class="dw-gal__t"><b>' + c.name + '</b><small>' + c.desc + '</small></span>' +
              '<button class="dw-gal__add" data-gal-add="' + id + '"' + (on || full ? ' disabled' : '') + '>' + (on ? 'Agregado' : 'Agregar') + '</button></div>' +
            (c.sizes.length > 1 ? '<div class="dw-gal__sizes" role="tablist">' + ['s', 'm', 'l'].filter(function (x) { return c.sizes.indexOf(x) >= 0; }).map(function (x) {
              return '<button class="sx-chip" role="tab" data-gal-size="' + id + ':' + x + '" aria-pressed="' + (x === sz) + '">' + SIZE[x] + '</button>';
            }).join('') + '</div>' : '') +
            '<div class="dw-gal__prev"><div class="dw-grid dw-grid--prev">' + widgetHTML({ id: id, size: sz }, true) + '</div></div></div>';
        }).join('');
      }).join('');
  }
  function onGallery(e) {
    var b;
    if ((b = e.target.closest('[data-gal-size]'))) { var p = b.dataset.galSize.split(':'); pick[p[0]] = p[1]; fx('select'); var st = sheet.scrollTop; paintGallery(); sheet.scrollTop = st; return; }
    if ((b = e.target.closest('[data-gal-add]')) && !b.disabled) {
      var id = b.dataset.galAdd;
      pref.items.push({ id: id, size: pick[id] || CATALOG[id].sizes[0] });
      fx('success'); commit(); closeGallery();
      setTimeout(function () { var w = list.querySelector('[data-dw-id="' + id + '"]'); if (w) { w.scrollIntoView({ block: 'center', behavior: 'smooth' }); w.classList.add('is-new'); setTimeout(function () { w.classList.remove('is-new'); }, 1200); } }, 350);
    }
  }

  function init() { mount(); paint(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('i18n:change', function () { paint(); });
  // Salir de edición al tocar fuera de Destacados
  document.addEventListener('click', function (e) { if (editing && host && !host.contains(e.target) && !(sheet && sheet.contains(e.target))) setEditing(false); });
  window.Destacados = { repaint: paint };
})();
