/* =====================================================================
   Destacados — widgets del Home (propuesta de experiencia, rediseño BM)
   - Un widget responde UNA pregunta sobre un producto, se lee de un
     vistazo y un toque abre el detalle. Una cifra, máx. 2 datos de apoyo,
     máx. 1 acción. No repite el saldo de Mi cuenta ni la grilla de acciones.
   - Una familia = un widget, con dos estados: informativo (tiene el
     producto) o captación (no lo tiene pero es elegible: pre-oferta).
   - Tamaños fijos S (½ fila), M (fila) y L (2 filas); cada familia define
     los suyos. El contenido nunca cambia el alto.
   - Al lanzar: 2 widgets (D1). Modo sugerido: el banco elige (captación
     primero, luego informativo; D25). Al editar pasa a personalizado y el
     banco ya no cambia nada; "Restablecer sugeridos" vuelve al modo sugerido.
   - Sin alertas (van a Notificaciones), sin "vence hoy" (D2), sin clima ni
     "Lo importante hoy" (D22). Montos ocultos con el ojo de saldo.
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'pb_widgets_v4';
  // Espacio de Destacados: 2 horizontales = 4 cuadrados. Por defecto van
  // horizontales; los cuadrados se eligen y el hueco que dejan se llena con
  // otro cuadrado.
  var U = { s: 1, m: 2, l: 4 };
  var CAP = 4;
  function units(ws) { return ws.reduce(function (n, w) { return n + U[w.size]; }, 0); }
  function defSize(id) { var z = CATALOG[id].sizes; return z.indexOf('m') >= 0 ? 'm' : z[0]; }
  var RELEASE = 2;  // salida del RDA v1 que muestra el prototipo (la edición llega en la 2)

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

  var PAYS = [['Luz de la casa', 24.8, '16 oct', 'Pagar Luz de la casa'], ['Casa de la abue', 18.35, '20 oct', 'Pagar Casa de la abue'], ['Internet', 32.5, '22 oct', ''], ['Celular', 20, '25 oct', '']];

  /* ---------- Catálogo: una familia, un widget ----------
     sizes: tamaños permitidos (M horizontal por defecto; S cuadrado se
     elige; L queda fuera por ahora, D27).
     salida: etapa del RDA v1 en la que entra (null = después). */
  var CATALOG = {
    cuentas:   { name: 'Cuentas', short: 'Cuentas', icon: 'account_balance', sizes: ['m', 's'], salida: 1, desc: '¿Cuánto ganan tus cuentas?' },
    inversion: { name: 'Inversión', short: 'Inversión', icon: 'trending_up', sizes: ['m', 's'], salida: 1, desc: '¿Cuánto rinde y cuándo vence?' },
    metas:     { name: 'Metas de ahorro', short: 'Metas', icon: 'flag', sizes: ['m', 's'], salida: 1, desc: '¿Cuánto te falta para tu meta?' },
    tarjeta:   { name: 'Tarjeta de crédito', short: 'Tarjeta', icon: 'credit_card', sizes: ['m', 's'], salida: 1, desc: '¿Cuánto pagas y hasta cuándo?' },
    creditos:  { name: 'Créditos', short: 'Créditos', icon: 'request_quote', sizes: ['m', 's'], salida: 1, desc: '¿Cuándo es tu próxima cuota?' },
    pagos:     { name: 'Pagos', short: 'Pagos', icon: 'event', sizes: ['m'], salida: 2, desc: '¿Qué pago viene?' },
    pfm:       { name: 'Mis finanzas', short: 'Gastos', icon: 'insights', sizes: ['m', 's'], salida: 4, desc: '¿En qué estás gastando?' },
    seguros:   { name: 'Seguros', short: 'Seguros', icon: 'health_and_safety', sizes: ['m', 's'], salida: null, desc: '¿Qué cubre tu póliza?' },
    // Pre-ofertas de productos que el cliente no tiene aunque tenga la familia
    // (next product to buy). Solo viven como sugerencia (slot fantasma) y en
    // "Sugeridos para ti"; si el cliente no tiene la familia, la sugerencia es
    // la captación de la familia.
    preaprobado: { name: 'Crédito preaprobado', short: 'Crédito', icon: 'request_quote', sizes: ['m', 's'], salida: 1, fam: 'creditos', desc: 'Tienes un crédito preaprobado' },
    deuna:     { name: 'Cuenta deuna', short: 'deuna', icon: 'account_balance_wallet', sizes: ['m', 's'], salida: 1, fam: 'cuentas', desc: 'Recibe pagos con tu cuenta deuna' }
  };
  // Orden en que el banco sugiere (D4: ahorro e inversión no van por defecto)
  var SUGGESTED = ['tarjeta', 'creditos', 'pagos'];
  var SIZE = { s: 'Cuadrado', m: 'Horizontal', l: 'Grande' };

  /* ---------- Acciones ---------- */
  function click(sel) { var e = document.querySelector(sel); if (e) e.click(); }
  function act(a) { click('#home-page [data-action="' + a + '"]'); }
  function card(n) { click('#home-page [data-panel="Tarjetas"] .product-row[data-action="' + n + '"]'); }
  function tab(t) { click('.tabs .tab[data-panel="' + t + '"]'); }
  function homeRow(panel) {
    var r = document.querySelector('#home-page [data-panel="' + panel + '"] .product-row[data-action]');
    if (!r) return null;
    var g = function (c) { var e = r.querySelector(c); return e ? e.textContent.trim() : ''; };
    return { action: r.dataset.action, name: g('.product-row__name'), sub: g('.product-row__sub'), amt: g('.product-row__amount') };
  }
  function pay(p) { if (p[3]) click('.list-item[data-sheet="payment"][data-title="' + p[3] + '"]'); else act('Pagar servicios'); }

  /* ---------- Tenencia y elegibilidad (en producción: BFF y motor de ofertas) ---------- */
  // Demo: ?sin=tarjeta,creditos simula un cliente sin esos productos (se guarda; ?sin= lo limpia)
  var SIN = (function () {
    try {
      var q = new URLSearchParams(location.search);
      if (q.has('sin')) localStorage.setItem('pb_widgets_sin', q.get('sin'));
      return (localStorage.getItem('pb_widgets_sin') || '').split(',').filter(Boolean);
    } catch (e) { return []; }
  })();
  function owned(id) {
    if (SIN.indexOf(id) >= 0) return false;
    var d = data();
    if (id === 'cuentas') return !!(d && d.accts && d.accts.length);
    if (id === 'tarjeta') return !!(d && d.card);
    if (id === 'metas') return !!(d && d.goals && d.goals.length);
    if (id === 'inversion') return !!homeRow('Inversiones');
    if (id === 'creditos') return !!homeRow('Prestamos');
    if (id === 'pagos') return PAYS.length > 0;
    if (id === 'deuna') return !!document.querySelector('#home-page .product-row[data-action*="deuna" i]');
    return false; // preaprobado: la oferta sigue vigente mientras no la tome
  }
  var ELIGIBLE = { cuentas: true, inversion: true, metas: true, tarjeta: true, creditos: true, pagos: true, preaprobado: true, deuna: true };
  function available(id) { var c = CATALOG[id]; return !!(c && c.salida && c.salida <= RELEASE); }
  function capt(id) { return !owned(id) && !!ELIGIBLE[id]; } // captación (widget fantasma)
  function shown(id) {
    var f = CATALOG[id] && CATALOG[id].fam;
    if (f) return available(id) && capt(id) && owned(f); // sin la familia, ya la sugiere su captación
    return available(id) && (owned(id) || capt(id));
  }

  /* ---------- Configuración ---------- */
  function defaults() {
    var ids = SUGGESTED.filter(shown);
    var order = ids.filter(capt).slice(0, 1).concat(ids.filter(function (id) { return !capt(id); })); // una captación, primero (D10, D25)
    return fit(order.map(function (id) { return { id: id, size: defSize(id) }; }));
  }
  function load() {
    try { var p = JSON.parse(localStorage.getItem(KEY)); if (p && p.custom && Array.isArray(p.items)) return p; } catch (e) {}
    return { custom: false, items: [] };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (e) {} }
  var pref = load();
  function items() {
    if (!pref.custom) return defaults();
    return fit(pref.items.filter(function (w) { return shown(w.id) && CATALOG[w.id].sizes.indexOf(w.size) >= 0; }));
  }
  // Toma widgets en orden mientras quepan en el espacio
  function fit(ws) { var n = 0; return ws.filter(function (w) { if (n + U[w.size] > CAP) return false; n += U[w.size]; return true; }); }
  // El espacio de Destacados nunca desaparece: si el cliente quita widgets,
  // los huecos se llenan con widgets fantasma, solo de productos
  // que NO tiene (next product to buy). Si ya tiene todo, queda el hueco
  // para agregar un widget.
  function fillers(ws) {
    var used = ws.map(function (w) { return w.id; }), out = [];
    var pool = SUGGESTED.concat(Object.keys(CATALOG)).filter(function (id, i, a) { return a.indexOf(id) === i && shown(id) && capt(id) && used.indexOf(id) < 0; });
    var off = dismissed(); pool = pool.filter(function (id) { return off.indexOf(id) < 0; }); // descartadas con la ×
    var quit = pref.removed || []; // lo que el cliente quitó se sugiere al final
    pool = pool.filter(function (id) { return quit.indexOf(id) < 0; }).concat(pool.filter(function (id) { return quit.indexOf(id) >= 0; }));
    // Si el cliente eligió cuadrados, los huecos son cuadrados (hasta 4);
    // si no, horizontales (por defecto, 2)
    var free = CAP - units(ws), need = [];
    var sq = ws.some(function (w) { return w.size === 's'; });
    if (sq || free % 2) for (var k = 0; k < free; k++) need.push('s');
    else for (var j = 0; j < free / 2; j++) need.push('m');
    // Orden: 1) una sola sugerencia de producto a la vez (D10); 2) un widget
    // útil que el cliente no colocó y para el que hay dato; 3) "Agregar
    // widget" genérico solo si no queda nada por sugerir
    var one = !ws.some(function (w) { return capt(w.id); });
    var wpool = USEFUL.filter(function (id) { return available(id) && owned(id) && used.indexOf(id) < 0 && off.indexOf('w:' + id) < 0; });
    need.forEach(function (z) {
      var fits = function (x) { return CATALOG[x].sizes.indexOf(z) >= 0; };
      var id = one && pool.filter(fits)[0];
      if (id) { one = false; return out.push({ id: id, size: z, sug: true }); }
      var wid = wpool.filter(fits)[0];
      if (wid) { wpool.splice(wpool.indexOf(wid), 1); return out.push({ id: wid, size: z, wsug: true }); }
      out.push({ slot: true, size: z });
    });
    return out;
  }
  // Sugerencias descartadas con la ×: no vuelven durante el enfriamiento
  var DKEY = 'pb_widgets_off', COOL = 30 * 864e5;
  function dismissed() {
    try { var o = JSON.parse(localStorage.getItem(DKEY)) || {}; return Object.keys(o).filter(function (k) { return Date.now() - o[k] < COOL; }); } catch (e) { return []; }
  }
  function dismiss(id) {
    try { var o = JSON.parse(localStorage.getItem(DKEY)) || {}; o[id] = Date.now(); localStorage.setItem(DKEY, JSON.stringify(o)); } catch (e) {}
  }
  // Antes de editar, la configuración sugerida se vuelve la del cliente
  function materialize() { if (!pref.custom) pref.items = defaults(); }

  /* ---------- Contenido por familia, estado y tamaño ----------
     Informativo: una cifra + máx. 2 datos de apoyo + máx. 1 acción.
     Captación: la pre-oferta con un dato propio (genérica hasta D12). */
  function promo(text, cta, sub) { return '<p class="dw-promo dw-2l">' + text + '</p>' + (sub ? '<p class="dw-sub dw-1">' + sub + '</p>' : '') + (cta ? '<span class="dw-cta bp-action-button" data-size="sm">' + cta + '</span>' : ''); }
  var R = {
    cuentas: function (s, c) {
      if (c) return { body: promo('Abre tu cuenta deuna para recibir pagos', s === 'm' ? 'Abrir cuenta' : ''), go: function () { act('Solicitar cuenta'); } };
      var b = '<p class="dw-label dw-1">Intereses del mes</p><p class="dw-value">' + sens(money(3.12)) + '</p>';
      return { body: b + '<p class="dw-sub dw-1">En tus ahorros</p>' + (s === 'm' ? '<p class="dw-sub dw-1">Rendimiento anual 1,50%</p>' : ''), go: function () { act('Cuenta PRINCIPAL'); } };
    },
    inversion: function (s, c) {
      if (c) return { body: promo('Haz crecer tu dinero', s === 'm' ? 'Invertir' : '', 'Gana 7,25% al año'), go: function () { act('Crear inversión'); } };
      var r = homeRow('Inversiones') || { name: 'Depósito a plazo', amt: '$ 3.000,00', action: 'Depósito a plazo' };
      var b = '<p class="dw-label dw-1">' + esc(r.name) + '</p><p class="dw-value">' + sens(esc(r.amt)) + '</p><p class="dw-sub dw-1">Vence el 12 nov</p>';
      return { body: b + (s === 'm' ? '<p class="dw-sub dw-1">Rinde 7,25% · ganaste <span class="is-in">' + sens('+' + money(54.38)) + '</span></p>' : ''), go: function () { act(r.action); } };
    },
    metas: function (s, c) {
      if (c) return { body: promo('Crea tu primera meta de ahorro', s === 'm' ? 'Crear meta' : ''), go: function () { act('Crear meta de ahorro'); } };
      var g = data().goals[0], p = Math.min(1, g.have / g.target);
      var go = function () { act('Meta ' + g.name); };
      if (s === 's') return { body: ring(p, pct(p)) + '<p class="dw-sub dw-1 dw-sub--ink">' + esc(g.name) + '</p><p class="dw-sub dw-1">' + sens(money(g.have)) + '</p>', go: go };
      return { body: '<p class="dw-label dw-1">' + esc(g.name) + '</p><p class="dw-value">' + sens(money(g.have)) + '</p>' + bar(p) + '<p class="dw-sub dw-1">' + pct(p) + ' de ' + sens(money(g.target)) + '</p>', go: go };
    },
    tarjeta: function (s, c) {
      if (c) return { body: promo('Solicita tu tarjeta de crédito', s === 'm' ? 'Solicitar' : ''), go: function () { tab('Tarjetas'); } };
      var d = data(), owed = d.card.owed, lim = d.card.limit;
      var b = '<p class="dw-label dw-1">Por pagar</p><p class="dw-value">' + sens(money(owed)) + '</p><p class="dw-sub dw-1">Hasta el 10 nov</p>';
      if (s === 's') return { body: b, go: function () { card('Mastercard Black'); } };
      return { body: '<div class="dw-split"><div>' + b + '</div><div class="dw-split__r"><p class="dw-label dw-1">Cupo disponible</p><p class="dw-value dw-value--sm">' + sens(money(lim - owed)) + '</p>' +
        '<button class="dw-btn bp-action-button" data-size="sm" data-dw-act="Pagar tarjeta">Pagar</button></div></div>', go: function () { card('Mastercard Black'); } };
    },
    creditos: function (s, c) {
      // Monto personalizado ("Tienes hasta $ X") solo con consentimiento (D12): genérica mientras tanto
      if (c) return { body: promo('Tienes un crédito preaprobado', 'Simular', s === 'm' ? 'Sujeto a aprobación' : ''), go: function () { act('Simular crédito preaprobado'); } };
      var r = homeRow('Prestamos') || { name: 'Préstamo de consumo', sub: 'Cuota 6 de 36', amt: '$ 245,90', action: 'Préstamo de consumo' };
      var b = '<p class="dw-label dw-1">Próxima cuota</p><p class="dw-value">' + sens(esc(r.amt)) + '</p><p class="dw-sub dw-1">' + (s === 's' ? 'Vence el 20 oct' : '20 oct · ' + esc(r.sub)) + '</p>';
      if (s === 's') return { body: b, go: function () { act(r.action); } };
      return { body: '<div class="dw-split"><div>' + b + '</div><div class="dw-split__r"><p class="dw-sub dw-1">' + esc(r.name) + '</p>' +
        '<button class="dw-btn bp-action-button" data-size="sm" data-dw-act="' + esc(r.action) + '">Pagar cuota</button></div></div>', go: function () { act(r.action); } };
    },
    preaprobado: function (s) { return { body: promo('Tienes un crédito preaprobado', 'Simular', s === 'm' ? 'Sujeto a aprobación' : ''), go: function () { act('Simular crédito preaprobado'); } }; },
    deuna: function (s) { return { body: promo('Abre tu cuenta deuna para recibir pagos', s === 'm' ? 'Abrir cuenta' : ''), go: function () { act('Solicitar cuenta'); } }; },
    pagos: function (s, c) {
      if (c) return { body: promo('Programa tus pagos de servicios', 'Programar'), go: function () { act('Pagar servicios'); } };
      // Solo informativo: fecha y monto, sin "vence hoy" (D2)
      return { body: '<div class="dw-list-in">' + PAYS.slice(0, s === 'l' ? 4 : 2).map(function (p, i) {
        return '<button class="dw-item" data-dw-pay="' + i + '"><span>' + p[0] + '<small>' + p[2] + '</small></span><b>' + sens(money(p[1])) + '</b></button>';
      }).join('') + '</div>', go: function () { act('Pagar servicios'); } };
    }
  };

  /* Slot fantasma: mismo patrón que la venta de productos de los hubs
     (fondo transparente, borde punteado, ícono, texto y enlace) */
  var GHOST = {
    cuentas: ['Abre tu cuenta deuna para recibir pagos', 'Abrir cuenta'],
    deuna: ['Abre tu cuenta deuna para recibir pagos', 'Abrir cuenta'],
    inversion: ['Haz crecer tu dinero: gana 7,25% al año', 'Invertir'],
    metas: ['Crea tu primera meta de ahorro', 'Crear meta'],
    tarjeta: ['Solicita tu tarjeta de crédito', 'Solicitar tarjeta'],
    creditos: ['Tienes un crédito preaprobado', 'Simular mi crédito'],
    preaprobado: ['Tienes un crédito preaprobado', 'Simular mi crédito'],
    pagos: ['Programa tus pagos de servicios', 'Programar pagos']
  };
  // Captación (colocada o en un slot fantasma), mismo componente del hub
  function hubHTML(w, preview) {
    var cat = CATALOG[w.id], g = GHOST[w.id] || [cat.desc, 'Ver más'], r = null;
    try { r = R[w.id](w.size, true); } catch (e) {}
    if (!preview) gos[w.id] = r && r.go;
    return '<article class="dw dw--' + w.size + ' dw--hub' + (w.sug ? ' dw--sug' : '') + '" data-dw-id="' + w.id + '"' + (preview ? '' : ' role="button" tabindex="0"') + ' aria-label="' + esc(g[0]) + '">' +
      '<span class="dw-ghost__ic material-symbols-rounded" aria-hidden="true">' + cat.icon + '</span>' +
      '<span class="dw-ghost__t"><span class="dw-2l">' + g[0] + '</span><span class="dw-ghost__link">' + g[1] + '</span></span>' +
      (preview ? '' : w.sug ? dismissBtn(w.id) : editBtns(w, cat)) +
      '</article>';
  }
  // Sugerencia de widget: un ejemplo de lo que verá, sin sus datos (no suma
  // consultas al abrir el Home)
  var EXAMPLE = {
    pagos: 'Tus próximos pagos con fecha y monto', pfm: 'En qué gastas este mes',
    metas: 'El avance de tu meta de ahorro', inversion: 'Cuánto rinde y cuándo vence',
    cuentas: 'Los intereses que ganan tus cuentas', tarjeta: 'Cuánto pagas y hasta cuándo',
    creditos: 'Tu próxima cuota y su fecha'
  };
  var USEFUL = ['pagos', 'pfm', 'metas', 'inversion', 'cuentas', 'tarjeta', 'creditos'];
  function wsugHTML(w) {
    var cat = CATALOG[w.id];
    return '<article class="dw dw--' + w.size + ' dw--hub dw--wsug" data-dw-id="' + w.id + '" aria-label="Sugerencia: widget ' + esc(cat.name) + '">' +
      '<span class="dw-ghost__ic material-symbols-rounded" aria-hidden="true">' + cat.icon + '</span>' +
      '<span class="dw-ghost__t"><span class="dw-1 dw-ghost__name">' + (w.size === 's' ? cat.short : cat.name) + '</span><span class="dw-2l">' + (EXAMPLE[w.id] || cat.desc) + '</span>' +
        '<span class="dw-ghost__acts"><button class="dw-ghost__link" data-dw-place="' + w.id + ':' + w.size + '">+ Agregar</button>' +
        (w.size === 'm' ? '<button class="dw-ghost__link dw-ghost__link--2" data-dw="add">Otros widgets</button>' : '') + '</span></span>' +
      dismissBtn('w:' + w.id) +
      '</article>';
  }
  function dismissBtn(id) { return '<button class="dw-dismiss" data-dw-dismiss="' + id + '" aria-label="Descartar sugerencia"><span class="material-symbols-rounded">close</span></button>'; }
  function editBtns(w, cat) {
    return '<button class="dw-x" data-dw-del="' + w.id + '" aria-label="Quitar ' + esc(cat.name) + '"><span class="material-symbols-rounded">remove</span></button>' +
      (cat.sizes.length > 1 ? '<button class="dw-size" data-dw-size="' + w.id + '" aria-label="Cambiar tamaño">' + SIZE[w.size] + '<span class="material-symbols-rounded">unfold_more</span></button>' : '');
  }

  function widgetHTML(w, preview) {
    if (w.wsug) return wsugHTML(w);
    if (capt(w.id) && !(loading && !preview && !w.sug)) return hubHTML(w, preview);
    var cat = CATALOG[w.id], c = capt(w.id), r;
    try { r = R[w.id](w.size, c); } catch (e) { r = null; }
    // Cargando: esqueleto del mismo tamaño para que la pantalla no salte
    if (loading && !preview) r = { body: '<span class="dw-skel"></span><span class="dw-skel dw-skel--lg"></span><span class="dw-skel dw-skel--sm"></span>' };
    // Sin dato: mensaje corto, nunca ceros (el widget mantiene su tamaño)
    if (!r) r = { body: '<p class="dw-sub">No pudimos actualizar</p>' };
    if (!preview) gos[w.id] = r.go;
    return '<article class="dw dw--' + w.size + (c ? ' dw--offer' : '') + (w.sug ? ' dw--sug' : '') + '" data-dw-id="' + w.id + '"' + (r.go && !preview ? ' role="button" tabindex="0"' : '') + ' aria-label="' + esc(cat.name) + '">' +
      '<p class="dw-h"><span class="material-symbols-rounded" aria-hidden="true">' + cat.icon + '</span><span class="dw-1">' + (w.size === 's' ? cat.short : cat.name) + '</span></p>' +
      '<div class="dw-body">' + r.body + '</div>' +
      (preview ? '' : editBtns(w, cat)) +
      '</article>';
  }

  /* ---------- Montaje y pintado ---------- */
  var host, list, gos = {}, editing = false, loading = true;
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
      '<p class="dw-limit" hidden>Quita uno para agregar otro</p>' +
      '<button class="pf-link" data-dw="reset">Restablecer sugeridos</button></div>';
    if (old) { old.parentNode.insertBefore(host, old); old.hidden = true; } else panel.appendChild(host);
    list = host.querySelector('.dw-grid');
    host.addEventListener('click', onClick);
    host.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.dw[role="button"]')) { e.preventDefault(); e.target.click(); } });
    dragInit();
    list.addEventListener('contextmenu', function (e) { if (e.target.closest('.dw')) e.preventDefault(); }); // Android: mantener presionado
    var eye = document.getElementById('balance-toggle');
    var sync = function () { document.documentElement.classList.toggle('pb-masked', eye && eye.getAttribute('aria-pressed') === 'true'); };
    if (eye) new MutationObserver(sync).observe(eye, { attributes: true, attributeFilter: ['aria-pressed'] });
    sync();
  }
  function paint() {
    if (!host) return;
    gos = {};
    var ws = items();
    list.innerHTML = ws.concat(fillers(ws)).map(function (w) {
      return w.slot ? '<button class="dw dw--' + w.size + ' dw-slot" data-dw="add"><span class="material-symbols-rounded">add</span>Agregar widget</button>' : widgetHTML(w);
    }).join('');
    var lim = host.querySelector('.dw-limit'); if (lim) lim.hidden = units(ws) < CAP;
    host.classList.toggle('is-editing', editing);
    host.querySelector('[data-dw="edit"]').textContent = editing ? 'Listo' : 'Editar';
    host.querySelector('.dw-add').disabled = units(ws) >= CAP;
  }
  function setEditing(on) { if (on) materialize(); editing = on; fx(on ? 'select' : 'success'); paint(); }
  function commit() { pref.custom = true; save(); paint(); }

  function onClick(e) {
    var b;
    if (drag && drag.moved) return;
    if ((b = e.target.closest('[data-dw="edit"]'))) { e.stopPropagation(); return setEditing(!editing); }
    if ((b = e.target.closest('[data-dw="add"]'))) { e.stopPropagation(); return openGallery(); }
    if ((b = e.target.closest('[data-dw="reset"]'))) { try { localStorage.removeItem(KEY); } catch (x) {} pref = load(); if (editing) materialize(); fx('select'); return paint(); }
    if ((b = e.target.closest('[data-dw-place]'))) {
      e.stopPropagation(); materialize();
      var pl = b.dataset.dwPlace.split(':');
      if (units(pref.items) + U[pl[1]] <= CAP) pref.items.push({ id: pl[0], size: pl[1] });
      fx('success'); return commit();
    }
    if ((b = e.target.closest('[data-dw-dismiss]'))) { e.stopPropagation(); dismiss(b.dataset.dwDismiss); fx('toggle'); return paint(); }
    if ((b = e.target.closest('[data-dw-del]'))) {
      e.stopPropagation();
      if (capt(b.dataset.dwDel)) dismiss(b.dataset.dwDel); // quitar una sugerencia es descartarla
      pref.items = pref.items.filter(function (w) { return w.id !== b.dataset.dwDel; });
      pref.removed = (pref.removed || []).filter(function (id) { return id !== b.dataset.dwDel; }).concat(b.dataset.dwDel);
      fx('toggle'); return commit();
    }
    if ((b = e.target.closest('[data-dw-size]'))) {
      e.stopPropagation();
      var w = pref.items.filter(function (x) { return x.id === b.dataset.dwSize; })[0], sz = CATALOG[w.id].sizes;
      var rest = units(pref.items) - U[w.size];
      for (var i = 1; i <= sz.length; i++) { var nx = sz[(sz.indexOf(w.size) + i) % sz.length]; if (rest + U[nx] <= CAP) { w.size = nx; break; } } // solo tamaños que caben
      fx('select'); return commit();
    }
    if (editing) return; // en edición, tocar un widget no lo abre
    if ((b = e.target.closest('[data-dw-pay]'))) { e.stopPropagation(); return pay(PAYS[+b.dataset.dwPay]); }
    if ((b = e.target.closest('[data-dw-act]'))) { e.stopPropagation(); return act(b.dataset.dwAct); }
    if ((b = e.target.closest('[data-dw-id]')) && gos[b.dataset.dwId]) { fx('tap'); gos[b.dataset.dwId](); }
  }

  /* ---------- Arrastrar para ordenar ----------
     En edición se arrastra directo; fuera de edición, mantener presionado
     un widget 450 ms entra en edición (como en iOS). */
  var drag = null, pressT = 0;
  function dragInit() {
    list.addEventListener('pointerdown', function (e) {
      var el = e.target.closest('.dw');
      if (!el || e.target.closest('.dw-x, .dw-size, .dw-dismiss, [data-dw-place], [data-dw="add"]') || e.button > 0) return;
      if (!editing) {
        clearTimeout(pressT);
        var x0 = e.clientX, y0 = e.clientY;
        var cancel = function (ev) { if (!ev || Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) { clearTimeout(pressT); off(); } };
        var off = function () { list.removeEventListener('pointermove', cancel); list.removeEventListener('pointerup', up1); list.removeEventListener('pointercancel', up1); };
        var up1 = function () { clearTimeout(pressT); off(); }; // soltar o empezar a hacer scroll cancela
        list.addEventListener('pointermove', cancel); list.addEventListener('pointerup', up1); list.addEventListener('pointercancel', up1);
        pressT = setTimeout(function () { off(); drag = { moved: true }; setEditing(true); setTimeout(function () { drag = null; }, 400); }, 450);
        return;
      }
      if (el.classList.contains('dw--sug') || el.classList.contains('dw--wsug') || el.classList.contains('dw-slot')) return; // los huecos no se mueven
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
        // Tras mover, la grilla se reacomoda bajo el dedo: se espera un instante
        // antes de volver a mover (si no, el widget "rebota" entre dos lugares)
        if (ref !== drag.el && ref !== drag.el.nextSibling && performance.now() > (drag.lock || 0)) { list.insertBefore(drag.el, ref); drag.lock = performance.now() + 160; fx('detent'); }
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

  /* ---------- Galería: "Sugeridos para ti" (captaciones) y "Tus productos" ---------- */
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
  var WHY = { cuentas: 'Recibe pagos con tu cuenta deuna', inversion: 'Tu dinero puede rendir 7,25% al año', metas: 'Ahorra para algo que quieras', tarjeta: 'Pide tu tarjeta de crédito', creditos: 'Tienes un crédito preaprobado', preaprobado: 'Simula tu cuota, sujeto a aprobación', deuna: 'Recibe pagos de cualquier banco', pagos: 'Programa tus pagos de servicios' };
  function galItem(id, have, free, why) {
    var c = CATALOG[id], sz = pick[id] || defSize(id), on = have.indexOf(id) >= 0, fits = U[sz] <= free;
    return '<div class="dw-gal">' +
      '<div class="dw-gal__head"><span class="dw-gal__ic material-symbols-rounded">' + c.icon + '</span><span class="dw-gal__t"><b>' + c.name + '</b><small>' + (why || c.desc) + '</small></span>' +
        '<button class="dw-gal__add bp-action-button" data-size="sm" data-gal-add="' + id + '"' + (on || !fits ? ' disabled' : '') + '>' + (on ? 'Agregado' : fits ? 'Agregar' : 'No cabe') + '</button></div>' +
      (c.sizes.length > 1 ? '<div class="dw-gal__sizes" role="tablist">' + ['s', 'm', 'l'].filter(function (x) { return c.sizes.indexOf(x) >= 0; }).map(function (x) {
        return '<button class="sx-chip" role="tab" data-gal-size="' + id + ':' + x + '" aria-pressed="' + (x === sz) + '">' + SIZE[x] + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="dw-gal__prev"><div class="dw-grid dw-grid--prev">' + widgetHTML({ id: id, size: sz }, true) + '</div></div></div>';
  }
  function paintGallery() {
    var ws = items(), have = ws.map(function (w) { return w.id; }), free = CAP - units(ws);
    var ids = Object.keys(CATALOG).filter(shown);
    var sug = ids.filter(capt), mine = ids.filter(function (id) { return !capt(id); });
    sheet.innerHTML = '<div class="as-sheet__handle"></div><h3>Agregar widget</h3><p>' +
      (!free ? 'No queda espacio. Quita uno para agregar otro.' : 'Elige un widget y su tamaño. Caben 2 horizontales o 4 cuadrados.') + '</p>' +
      (sug.length ? '<p class="as-sheet__label">Sugeridos para ti</p>' + sug.map(function (id) { return galItem(id, have, free, WHY[id]); }).join('') : '') +
      (mine.length ? '<p class="as-sheet__label">Tus productos</p>' + mine.map(function (id) { return galItem(id, have, free); }).join('') : '');
  }
  function onGallery(e) {
    var b;
    if ((b = e.target.closest('[data-gal-size]'))) { var p = b.dataset.galSize.split(':'); pick[p[0]] = p[1]; fx('select'); var st = sheet.scrollTop; paintGallery(); sheet.scrollTop = st; return; }
    if ((b = e.target.closest('[data-gal-add]')) && !b.disabled) {
      var id = b.dataset.galAdd;
      materialize();
      var nz = pick[id] || defSize(id);
      if (units(pref.items) + U[nz] > CAP) return;
      pref.items.push({ id: id, size: nz });
      fx('success'); commit(); closeGallery();
      setTimeout(function () { var w = list.querySelector('[data-dw-id="' + id + '"]'); if (w) { w.scrollIntoView({ block: 'center', behavior: 'smooth' }); w.classList.add('is-new'); setTimeout(function () { w.classList.remove('is-new'); }, 1200); } }, 350);
    }
  }

  // Cada vez que se entra al inicio, los widgets cargan (esqueleto) y luego
  // muestran su dato
  function warm() { loading = true; paint(); clearTimeout(warm.t); warm.t = setTimeout(function () { loading = false; paint(); }, 700); }
  function init() {
    mount(); paint();
    var home = document.getElementById('home-page'), was = false;
    var check = function () { var on = !!(home && home.offsetParent !== null && home.getBoundingClientRect().height); if (on && !was) warm(); was = on; };
    if (home) new MutationObserver(check).observe(home, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    check(); if (!was) { loading = false; paint(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('i18n:change', function () { paint(); });
  // Salir de edición al tocar fuera de Destacados
  document.addEventListener('click', function (e) { if (editing && host && !host.contains(e.target) && !(sheet && sheet.contains(e.target))) setEditing(false); });
  window.Destacados = { repaint: paint };
})();

