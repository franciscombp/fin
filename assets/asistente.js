/* =====================================================================
   Mis finanzas (PFM) + asistente — Uku, el oso andino (3D, ver assets/bosque3d.js)
   La versión anterior (Candado y PIA en SVG) está en respaldo/asistente-candado-pia/.

   - Vive en Modo finanzas (PFM) y tiene una entrada en Inicio.
   - Responde preguntas sobre tus finanzas usando SOLO los movimientos de
     los últimos 3 meses (lo único que el banco puede mostrar). De antes
     sólo existen informes mensuales agregados (metas, ahorro, pagos),
     nunca el detalle de movimientos.
   - El personaje nunca se castiga: siempre está bien. Lo que cambia con
     tus hábitos es su entorno — un paisaje que pasa de árido a frondoso.
   - Concept: el "motor" es local y por reglas (intenciones + datos de
     ejemplo). En producción iría un LLM con las mismas herramientas
     (consultar movimientos, metas, presupuesto) y las mismas reglas.
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'pb_asistente_v3';
  var ST = { who: 'candado', scenario: 'normal', linked: [], off: [], view: 'sep', mods: { extraSave: 0, paidLate: false, paidLateAmt: 0, ccPaid: 0, efund: 0, autopay: false } };
  try { var saved = JSON.parse(localStorage.getItem(KEY)); if (saved) ST = Object.assign(ST, saved); } catch (e) {}
  // La tarjeta de crédito ahora es de Pichibank (antes "Banco Andino", externo)
  ST.linked = (ST.linked || []).filter(function (b) { return b !== 'andino'; });
  ST.off = ST.off || []; // cuentas e inversiones que NO se analizan (se pueden volver a incluir)
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) {} }
  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }

  var CHARS = {
    // Uku (de ukuku/ukumari, oso andino en quechua). Un solo personaje:
    // el oso no cambia; cambia el bosque donde vive.
    uku: { name: 'Uku', role: 'Tu oso de las finanzas',
      svg: function () { return '<img class="as-oso" src="' + ASSET + 'oso/oso.webp" alt="" draggable="false">'; },
      face: function () { return '<img class="as-oso as-oso--cara" src="' + ASSET + 'oso/oso-cara.webp" alt="" draggable="false">'; } }
  };
  function C() { return CHARS.uku; }

  /* ---------- Escena 3D (carga diferida) ---------- */
  var ASSET = (document.currentScript && document.currentScript.src || location.href).replace(/[^/]*$/, '');
  var b3d = null, b3dP = null;
  function load3D() {
    if (!b3dP) b3dP = import(ASSET + 'bosque3d.js').then(function (m) {
      b3d = m.supported() ? m : null;
      var c = window.Clima && Clima.last(); if (b3d && c) b3d.setLook(c.look); // Uku vestido según el clima
      return b3d;
    }).catch(function () { return null; });
    return b3dP;
  }
  function mount3D(el, score, gesture) {
    if (!el) return;
    el.classList.add('is-loading');
    load3D().then(function (m) {
      if (!m || !el.isConnected) return;
      m.attach(el, { score: score, onTap: function () { fx('select'); } });
      el.classList.remove('is-loading'); el.classList.add('is-3d');
      if (gesture) m.play(gesture.name || gesture, gesture.opts);
    });
  }
  function gest(name, opts) { if (b3d) b3d.play(name, opts); }

  /* ---------- Formato ---------- */
  function money(v) {
    var s = Math.abs(v).toFixed(2).split('.');
    return (v < 0 ? '-' : '') + '$\u00a0' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  }
  function pct(v) { return Math.round(v * 100) + '%'; }
  // Traducción (catálogos en /locales): T('Texto con {dato}', { dato: x })
  function T(s, v) { return window.I18n ? I18n.t(s, v) : s.replace(/\{(\w+)\}/g, function (m, k) { return v && k in v ? v[k] : m; }); }
  function catLow(k) { return T(CATS[k].name).toLowerCase(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Datos de ejemplo: últimos 3 meses ---------- */
  var TODAY = new Date(2026, 9, 8); // 8 oct 2026 (concept)
  var MONTHS = [
    { y: 2026, m: 7, name: 'agosto', short: 'Ago', days: 31 },
    { y: 2026, m: 8, name: 'septiembre', short: 'Sep', days: 30 },
    { y: 2026, m: 9, name: 'octubre', short: 'Oct', days: 8, partial: true }
  ];
  var CATS = {
    super:     { name: 'Supermercado', budget: 360, m: ['Supermaxi', 'Mi Comisariato', 'Tía'], n: 6, a: [25, 70] },
    delivery:  { name: 'Restaurantes y delivery', budget: 160, m: ['PedidosYa', 'Rappi', 'Uber Eats', 'KFC'], n: 6, a: [8, 22] },
    transporte:{ name: 'Transporte', budget: 90, m: ['Uber', 'Cabify', 'Primax'], n: 9, a: [2.5, 9] },
    servicios: { name: 'Servicios básicos', budget: 100, fixed: [['Luz', 24.8], ['Agua', 18.35], ['Internet', 32.5], ['Celular', 20]] },
    // las mismas suscripciones que muestra el detalle de la Visa Débito
    subs:      { name: 'Suscripciones', budget: 95, fixed: [['Uber Eats', 4.99], ['Spotify', 5.99], ['Disney+ Premium', 13.99], ['Netflix', 10.99], ['YouTube Premium', 11.99], ['iCloud+', 2.99], ['Gympass', 39.99]] },
    compras:   { name: 'Compras', budget: 260, m: ['Amazon', 'De Prati', 'Kywi'], n: 2, a: [18, 75] },
    cafe:      { name: 'Cafés y antojos', budget: 45, m: ['Sweet & Coffee', 'Juan Valdez', 'Tienda del barrio'], n: 13, a: [1.8, 4.6], hormiga: true },
    salud:     { name: 'Salud', budget: 40, m: ['Fybeca', 'Pharmacys'], n: 1, a: [12, 38] },
    ocio:      { name: 'Ocio', budget: 90, m: ['Cinemark', 'Bar La Ronda', 'Steam'], n: 2, a: [9, 28] }
  };
  var SCEN = {
    dificil:   { label: 'Mes difícil', mul: { delivery: 1.8, cafe: 2.1, compras: 2.6, ocio: 1.6 }, save: 0, late: 1, income: 1200, debt: 1.7 },
    normal:    { label: 'Normal', mul: {}, save: 110, late: 0, income: 1200, debt: 1 },
    excelente: { label: 'Excelente', mul: { delivery: .5, cafe: .35, compras: .5, ocio: .7 }, save: 240, late: 0, income: 1200, debt: .5 }
  };
  var GOALS = [
    { id: 'efund', name: 'Fondo de emergencia', target: 1500, base: 820, due: 'junio de 2027', share: .6, left: 8 },
    { id: 'trip', name: 'Viaje a Galápagos', target: 1200, base: 310, due: 'diciembre de 2027', share: .4, left: 14 }
  ];

  /* Cuentas: las de Pichibank vienen solas; las de otros bancos se
     conectan con consentimiento (solo lectura, últimos 3 meses). */
  var BANKS = {
    pb:       { name: 'Pichibank', ini: 'PB', own: true },
    sierra:   { name: 'Cooperativa Sierra', ini: 'CS', what: 'Ahorro programado' },
    costa:    { name: 'Banco Costa', ini: 'BC', what: 'Cuenta de ahorros' },
    efectivo: { name: 'Efectivo', ini: '$', what: 'Lo registras tú', manual: true }
  };
  var ACCTS = [
    { id: 'pb1', bank: 'pb', name: 'Cuenta PRINCIPAL', mask: '7890', type: 'ahorro', bal: 1906.04 },
    { id: 'pb2', bank: 'pb', name: 'Corriente', mask: '1234', type: 'corriente', bal: 1440.35 },
    { id: 'pb3', bank: 'pb', name: 'Ahorro transaccional', mask: '7980', type: 'ahorro', bal: 100 },
    { id: 'and1', bank: 'pb', name: 'Mastercard Black', mask: '7643', type: 'credito', limit: 5000, base: 420 },
    { id: 'sie1', bank: 'sierra', name: 'Ahorro programado', mask: '2210', type: 'ahorro', bal: 1350 },
    { id: 'cos1', bank: 'costa', name: 'Cuenta de ahorros', mask: '0921', type: 'ahorro', bal: 640 },
    { id: 'efe1', bank: 'efectivo', name: 'Billetera', mask: '', type: 'efectivo', bal: 60 }
  ];
  var EXT = {
    and1: [['compras', 2, [30, 120], ['Mercado Libre', 'Etafashion', 'De Prati']], ['delivery', 3, [10, 25], ['PedidosYa', 'Rappi']], ['ocio', 2, [15, 40], ['Cinemark', 'Ticketshow']]],
    cos1: [['super', 2, [20, 50], ['Tía', 'Gran Aki']], ['transporte', 3, [3, 8], ['Uber', 'Primax']]],
    efe1: [['cafe', 6, [1, 3], ['Tienda del barrio']], ['transporte', 6, [.35, .45], ['Bus']]]
  };
  function connected(bank) { return BANKS[bank].own || ST.linked.indexOf(bank) >= 0; }

  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  var D; // datos derivados del escenario + cuentas conectadas + acciones tomadas
  function build() {
    var sc = SCEN[ST.scenario] || SCEN.normal, r = rng(97 + ST.scenario.length * 13), tx = [], mods = ST.mods;
    Object.keys(ST.budgets || {}).forEach(function (k) { if (CATS[k]) CATS[k].budget = ST.budgets[k]; });
    var save = sc.save + mods.extraSave;
    MONTHS.forEach(function (mo, mi) {
      var f = mo.partial ? mo.days / 30 : 1;
      tx.push({ mi: mi, day: 1, cat: 'ingreso', who: 'Sueldo', amt: sc.income, acct: 'pb1' });
      if (save) tx.push({ mi: mi, day: 2, cat: 'ahorro', who: 'Ahorro a metas', amt: mo.partial ? Math.round(save * .5) : save, acct: 'pb1' });
      Object.keys(CATS).forEach(function (k) {
        var c = CATS[k];
        if (c.fixed) {
          c.fixed.forEach(function (p, i) { var d = 3 + i * 4; if (d <= mo.days) tx.push({ mi: mi, day: d, cat: k, who: p[0], amt: p[1], acct: 'pb1', late: k === 'servicios' && sc.late && !mods.paidLate && i === 1 && mi === 1 }); });
          return;
        }
        var n = Math.max(0, Math.round(c.n * (sc.mul[k] || 1) * f + (r() - .5)));
        for (var i = 0; i < n; i++) tx.push({ mi: mi, day: 1 + Math.floor(r() * mo.days), cat: k, who: c.m[Math.floor(r() * c.m.length)], amt: +(c.a[0] + r() * (c.a[1] - c.a[0])).toFixed(2), acct: r() < .7 ? 'pb1' : 'pb2' });
      });
      // Cuentas de otros bancos conectadas
      Object.keys(EXT).forEach(function (id) {
        var ac = ACCTS.filter(function (a) { return a.id === id; })[0];
        if (!connected(ac.bank)) return;
        EXT[id].forEach(function (t) {
          var n = Math.max(0, Math.round(t[1] * (id === 'and1' ? sc.debt : 1) * f + (r() - .5)));
          for (var i = 0; i < n; i++) tx.push({ mi: mi, day: 1 + Math.floor(r() * mo.days), cat: t[0], who: t[3][Math.floor(r() * t[3].length)], amt: +(t[2][0] + r() * (t[2][1] - t[2][0])).toFixed(2), acct: id });
        });
      });
      if (connected('costa') && !mo.partial) tx.push({ mi: mi, day: 15, cat: 'ingreso', who: 'Pago freelance', amt: 250, acct: 'cos1' });
      if (connected('sierra')) tx.push({ mi: mi, day: 1, cat: 'ingreso', who: 'Intereses', amt: 6.4, acct: 'sie1' });
    });
    // Registros manuales (gastos en efectivo que anota el usuario)
    (ST.manual || []).forEach(function (t) { tx.push(Object.assign({ manual: true }, t)); });
    tx = tx.filter(function (t) { return ST.off.indexOf(t.acct) < 0; });
    var by = MONTHS.map(function () { var o = {}; Object.keys(CATS).forEach(function (k) { o[k] = 0; }); o._spend = 0; o._save = 0; o._in = 0; o._hormigaN = 0; return o; });
    tx.forEach(function (t) {
      var b = by[t.mi];
      if (t.cat === 'ingreso') b._in += t.amt;
      else if (t.cat === 'ahorro') b._save += t.amt;
      else { b[t.cat] += t.amt; b._spend += t.amt; if (CATS[t.cat].hormiga) b._hormigaN++; }
    });
    var totalSaved = by.reduce(function (s, b) { return s + b._save; }, 0);
    var goals = GOALS.map(function (g) {
      var have = g.base + totalSaved * g.share + (g.id === 'efund' ? mods.efund : 0), monthly = save * g.share;
      return { id: g.id, name: g.name, target: g.target, have: have, due: g.due, need: (g.target - have) / g.left, monthly: monthly, onTrack: monthly >= (g.target - have) / g.left };
    });
    // Saldos y deuda
    var cardSpend = tx.filter(function (t) { return t.acct === 'and1' && t.mi >= 1; }).reduce(function (s, t) { return s + t.amt; }, 0);
    var accts = ACCTS.filter(function (a) { return connected(a.bank); }).map(function (a) {
      var o = Object.assign({}, a);
      if (a.type === 'credito') { o.owed = Math.max(0, a.base * sc.debt + cardSpend - mods.ccPaid); o.bal = -o.owed; }
      if (a.id === 'pb1') o.bal = a.bal - mods.efund - mods.ccPaid - mods.paidLateAmt;
      return o;
    });
    var inc = function (a) { return ST.off.indexOf(a.id) < 0; };
    var assets = accts.filter(function (a) { return a.type !== 'credito' && inc(a); }).reduce(function (s, a) { return s + a.bal; }, 0);
    var card = accts.filter(function (a) { return a.type === 'credito' && inc(a); })[0];
    var debt = card ? card.owed : 0, util = card ? debt / card.limit : 0;
    var avgSpend = (by[0]._spend + by[1]._spend) / 2;
    var cushion = goals[0].have + (connected('sierra') ? acctOf('sie1').bal : 0);
    var months = cushion / avgSpend;

    var sep = by[1], overCats = Object.keys(CATS).filter(function (k) { return sep[k] > CATS[k].budget; });
    var lateTx = tx.filter(function (t) { return t.late; }), lateN = lateTx.length;
    var rate = sep._save / sep._in;
    var f = {
      ahorro: { v: Math.min(1, rate / .15), label: 'Ahorro', icon: 'savings', ok: rate >= .08, val: T('{pct} de tus ingresos', { pct: pct(rate) }),
        tip: rate >= .08 ? T('Estás ahorrando más del 8% de tus ingresos. ¡Sigue así!') : T('Intenta ahorrar por lo menos el 8% de tus ingresos cada mes.'),
        act: rate >= .15 ? null : { id: 'save50', label: 'Ahorrar $ 50 más al mes' } },
      pagos: { v: lateN ? 0 : 1, label: 'Pagos a tiempo', icon: 'event_available', ok: !lateN, val: lateN ? T('{n} pago atrasado', { n: lateN }) : T('Todo al día'),
        tip: lateN ? 'Todavía tienes pendiente el agua de septiembre. Si la pagas hoy, evitas otro recargo.' : 'No tienes nada atrasado en los últimos 3 meses.',
        act: lateN ? { id: 'payLate', label: T('Pagar agua ({monto})', { monto: money(18.35) }) } : null },
      presupuesto: { v: 1 - Math.min(1, overCats.length / 3), label: 'Presupuesto', icon: 'pie_chart', ok: !overCats.length, val: overCats.length ? T('Te pasaste en {n}', { n: overCats.length }) : T('Todo en orden'),
        tip: overCats.length ? T('Te pasaste en {cats}. Si vuelves a lo presupuestado, tu salud sube.', { cats: list(overCats.map(catLow)) }) : T('En septiembre no te pasaste en nada.'),
        act: overCats.length ? { id: 'cat:' + overCats[0], label: T('Ver {cat}', { cat: catLow(overCats[0]) }) } : null },
      deuda: { v: card ? 1 - Math.min(1, util / .6) : 1, label: 'Uso de tarjetas', icon: 'credit_card', ok: util < .3, val: card ? T('{pct} del cupo', { pct: pct(util) }) : T('Sin tarjetas conectadas'),
        tip: !card ? 'Conecta tus tarjetas de otros bancos para verlas aquí.' : util < .3 ? 'Usas menos del 30% de tu cupo, que es lo ideal para tu historial.' : 'Estás usando más del 30% de tu cupo y eso pesa en tu historial. Bajarlo es lo que más te ayuda este mes.',
        act: card && util >= .3 ? { id: 'payCard', label: 'Abonar $ 200 a Mastercard Black' } : null },
      colchon: { v: Math.min(1, months / 6), label: 'Ahorro para emergencias', icon: 'shield', ok: months >= 3, val: T('Te alcanza para {n} meses', { n: months.toFixed(1).replace('.', ',') }),
        tip: months >= 3 ? 'Si un mes no tienes ingresos, puedes cubrir más de 3 meses de gastos. Ese es el mínimo recomendado.' : T('Lo recomendable es tener ahorrados por lo menos 3 meses de gastos. Ahora te alcanza para {n}.', { n: months.toFixed(1).replace('.', ',') }),
        act: months >= 6 ? null : { id: 'efund100', label: 'Pasar $ 100 al fondo' } }
    };
    var score = Math.round(25 * f.ahorro.v + 20 * f.pagos.v + 20 * f.presupuesto.v + 15 * f.deuda.v + 20 * f.colchon.v);
    D = { tx: tx, by: by, goals: goals, f: f, score: score, overCats: overCats, lateN: lateN, sc: sc, accts: accts, assets: assets, debt: debt, util: util, card: card, months: months };
  }
  function level(s) {
    if (s >= 80) return { n: 'Excelente', c: '#2e9d4a', k: 4 };
    if (s >= 55) return { n: 'Muy bien', c: '#6cbf3c', k: 3 };
    if (s >= 30) return { n: 'Regular', c: '#c7a22a', k: 2 };
    return { n: 'Por mejorar', c: '#c0742c', k: 1 };
  }

  /* ---------- Personajes ---------- */
  var uidN = 0;
  /* Estilo de la marca: línea navy fina, rellenos gris claro, amarillo
     como único acento y mucho aire. Sin degradados ni sombras. */
  /* ---------- Paisaje: misma línea gráfica, el amarillo crece con los hábitos ---------- */
  function cloud(x, y, cls) {
    return '<g class="l-cloud ' + (cls || '') + '"><path transform="translate(' + x + ' ' + y + ')" d="M0 10 H64 C66 4 60 0 54 2 C52 -8 38 -10 32 -2 C26 -6 16 -2 18 4 C10 2 4 6 0 10Z" fill="none" stroke="var(--as-g2)" stroke-width="1.2"/></g>';
  }

  /* ---------- Motor de respuestas (intenciones sobre los datos) ---------- */
  function topCats(mi, n) {
    return Object.keys(CATS).map(function (k) { return { k: k, v: D.by[mi][k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, n);
  }
  function bars(rows, max) {
    max = max || Math.max.apply(null, rows.map(function (r) { return r.v; }));
    return '<div class="as-bars">' + rows.map(function (r, i) {
      // Neutro: la barra principal en tinta, el resto en gris; rojo sólo si se excede.
      var c = r.c === '#c20505' ? 'var(--bp-theme-color-status-error-text, #c20505)' : (i === 0 ? 'var(--as-line)' : 'var(--as-g2)');
      return '<div class="as-bar" style="--c:' + c + '"><span>' + esc(r.label || CATS[r.k].name) + '</span><span>' + money(r.v) + '</span><u><i style="width:' + Math.max(3, r.v / max * 100).toFixed(0) + '%"></i></u></div>';
    }).join('') + '</div>';
  }
  function stat(label, value, cls) { return '<div class="as-stat"><small>' + label + '</small><b class="' + (cls || '') + '">' + value + '</b></div>'; }
  var CAT_WORDS = {
    super: /super|mercado|comida de la casa|víveres|viveres/, delivery: /restaurant|delivery|comer fuera|pedidos|rappi|comida/,
    transporte: /transporte|uber|taxi|gasolina|movilidad/, servicios: /servicio|luz|agua|internet|celular/,
    subs: /suscrip|netflix|spotify|gimnasio|gym/, compras: /compra|ropa|amazon/, salud: /salud|farmacia|medic/, ocio: /ocio|cine|salir|diversi|bar/
  };
  var OLD = /(hace \d|hace un|el año|año pasado|enero|febrero|marzo|abril|mayo|junio|julio|2025|seis meses|6 meses|semestre|histori|antes)/;

  /* Cada respuesta trae "s": respuestas sugeridas que siguen la conversación.
     Así casi todo se resuelve tocando, con el motor de reglas y sin costo.
     La IA (en producción) entraría sólo cuando el texto libre no calza con
     ninguna intención: el último "return" de answer(). */
  function answer(q) {
    // En otro idioma: si es una sugerencia traducida, se usa su texto fuente;
    // y algunas palabras clave (kichwa) se mapean a las intenciones.
    var src = window.I18n && I18n.reverse ? I18n.reverse(q) : null;
    var s = (src || q).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    Object.keys(KW).forEach(function (k) { if (s.indexOf(k) >= 0) s += ' ' + KW[k]; });
    var sep = D.by[1], oct = D.by[2], ago = D.by[0];
    // Preguntas de cada sección (tarjetas, préstamos, inversiones, seguros…)
    var cx = window.Contexto && Contexto.answer(s);
    if (cx) return cx;
    if (/^(hola|buenas|buenos|hey|que tal)\b/.test(s)) return { t: T('Hola, ¿qué tal? Cuéntame qué quieres revisar. Te puedo decir en qué se te está yendo la plata, cómo vas con tus metas o en qué te pasaste del presupuesto.'),
      s: ['¿En qué se me va la plata?', '¿Cómo voy con mis metas?', '¿En qué me pasé?'] };
    if (OLD.test(s)) return reports(s);
    if (/tarde|atras|recargo|vencid/.test(s)) {
      return { t: D.lateN ? T('En septiembre pagaste el agua 5 días tarde y te cobraron {monto} de recargo. Si activas el pago automático, se paga solito el día que vence y no te vuelve a pasar.', { monto: money(1.5) })
        : T('Tranquilo, en los últimos 3 meses pagaste todo a tiempo. Si algún día se te pasa una fecha, te pueden cobrar un recargo y eso queda en tu historial.'),
        s: ['¿Cuánto pago en servicios?', '¿Cómo voy en general?'] };
    }
    if (/interes/.test(s)) {
      var i1 = cardInterest(0), i2 = cardInterest(1);
      return { t: (i1 + i2) ? T('Entre agosto y septiembre pagaste {monto} de intereses en tu Mastercard Black, porque solo pagaste el mínimo. Si pagas el total antes de la fecha de corte, no te cobran intereses.', { monto: money(i1 + i2) })
        : T('Nada. Estos meses no pagaste intereses en tus tarjetas. ¡Bien ahí!'),
        s: ['¿Cuánto debo en mi tarjeta?', '¿Cuánto más puedo ahorrar?'] };
    }
    if (/cuenta|banco|saldo|tengo|patrimonio|total/.test(s)) {
      return { t: (D.debt ? T('Sumando tus {n} cuentas tienes <b>{total}</b>, y en tarjetas debes {deuda}.', { n: D.accts.length, total: money(D.assets), deuda: money(D.debt) })
          : T('Sumando tus {n} cuentas tienes <b>{total}</b>.', { n: D.accts.length, total: money(D.assets) })) +
        (ST.linked.length < 2 ? ' ' + T('Si conectas tus otros bancos, te muestro el panorama completo.') : ''),
        h: bars(D.accts.filter(function (a) { return a.type !== 'credito'; }).map(function (a) { return { label: BANKS[a.bank].name + ' · ' + T(a.name), v: a.bal }; }).sort(function (a, b) { return b.v - a.v; })),
        s: ['¿Cuánto debo en mi tarjeta?', '¿Para cuántos meses me alcanza?'] };
    }
    if (/deuda|debo|tarjeta|credito|cupo/.test(s)) {
      return D.card ? { t: T('Debes <b>{deuda}</b> en tu Mastercard Black, o sea el {pct} de tu cupo.', { deuda: money(D.debt), pct: pct(D.util) }) + ' ' +
          (D.util >= .3 ? T('Lo ideal es usar menos del 30%. Con un abono de {monto} llegas.', { monto: money(Math.max(0, D.debt - D.card.limit * .3)) }) : T('Estás por debajo del 30%, que es lo ideal.')),
          s: ['¿Cuánto pago de intereses?', '¿Cuánto más puedo ahorrar?'] }
        : { t: T('No veo ninguna tarjeta de crédito. Si tienes una en otro banco, conéctala desde Mis finanzas y la reviso contigo.'), s: ['¿Cuánto tengo en total?'] };
    }
    if (/colchon|imprevisto|emergencia sin|cuantos meses/.test(s)) {
      return { t: T('Con lo que tienes ahorrado te alcanza para <b>{n} meses</b> de gastos. Lo recomendable es tener por lo menos 3.', { n: D.months.toFixed(1).replace('.', ',') }),
        s: ['¿Cómo voy con mis metas?', '¿Cuánto más puedo ahorrar?'] };
    }
    if (/hormiga|cafe|antojo|cafecito/.test(s)) {
      var n = sep._hormigaN, v = sep.cafe, year = v * 12;
      return { t: T('En septiembre fueron <b>{n} cafés y antojitos</b>, {monto} en total. Así, de a poquito, no se siente, pero en un año son {anual}.', { n: n, monto: money(v), anual: money(year) }) + ' ' +
        (v > CATS.cafe.budget ? T('Si los bajas a la mitad, te ahorras {monto} al año. Es como {n} meses de supermercado.', { monto: money(year / 2), n: Math.max(1, Math.round(year / 2 / sep.super)) }) : T('Igual vas bien: estás dentro de lo que te propusiste.')),
        h: '<div class="as-stats">' + stat(T('Septiembre'), money(v)) + stat(T('Octubre, hasta hoy'), money(oct.cafe)) + '</div>',
        s: ['¿En qué se me va la plata?', 'Mis suscripciones'] };
    }
    if (/suscrip|netflix|spotify|recurrent|fijo/.test(s) && !/servicio/.test(s)) {
      return { t: T('Pagas <b>{monto} al mes</b> en {n} suscripciones con tu Visa Débito. La más cara es Gympass: si fuiste menos de 8 veces en septiembre, cada ida te salió en más de {ida}.', { monto: money(sep.subs), n: CATS.subs.fixed.length, ida: money(39.99 / 8) }),
        h: bars(CATS.subs.fixed.map(function (p) { return { label: T(p[0]), v: p[1] }; }).sort(function (a, b) { return b.v - a.v; })),
        s: ['Mis gastos hormiga', '¿Cuánto más puedo ahorrar?'] };
    }
    if (/meta|objetivo|galapagos|emergencia|viaje/.test(s)) {
      return { t: D.goals.map(function (g) {
          var v = { meta: T(g.name), tienes: money(g.have), total: money(g.target), mes: money(g.monthly), falta: money(g.need), fecha: T(g.due) };
          return T('<b>{meta}</b>: llevas {tienes} de {total}.', v) + ' ' +
            (g.onTrack ? T('Si sigues poniendo {mes} al mes, llegas en {fecha}.', v) : T('Para llegar en {fecha} necesitas poner {falta} al mes, y ahora estás poniendo {mes}.', v));
        }).join('<br><br>'),
        h: bars(D.goals.map(function (g) { return { label: T(g.name) + ' · ' + pct(g.have / g.target), v: g.have }; }), 1500),
        s: ['¿Cuánto más puedo ahorrar?', '¿Para cuántos meses me alcanza?'] };
    }
    if (/ahorr|puedo|alcanza|sobra/.test(s)) {
      var free = sep._in - sep._spend - sep._save;
      var cut = Math.max(0, sep.delivery - CATS.delivery.budget) + Math.max(0, sep.cafe - CATS.cafe.budget) + Math.max(0, sep.compras - CATS.compras.budget);
      return { t: T('En septiembre ahorraste <b>{ahorro}</b>, el {pct} de tus ingresos, y te sobraron {libre} sin un destino fijo.', { ahorro: money(sep._save), pct: pct(sep._save / sep._in), libre: money(free) }) + ' ' +
        (cut > 5 ? T('Si delivery, cafés y compras vuelven a lo que tenías presupuestado, son {monto} más cada mes.', { monto: money(cut) }) : T('Podrías mandar {monto} más a tus metas cada mes sin quedarte corto.', { monto: money(Math.max(20, Math.round(free * .3))) })),
        h: '<div class="as-stats">' + stat(T('Ingresos'), money(sep._in)) + stat(T('Gastaste'), money(sep._spend)) + stat(T('Ahorraste'), money(sep._save)) + stat(T('Te sobró'), money(free)) + '</div>',
        s: ['¿Cómo voy con mis metas?', '¿En qué me pasé?'] };
    }
    if (/compar|mes pasado|vs|anterior|subi|baje|aument/.test(s)) {
      var rows = Object.keys(CATS).map(function (k) { return { k: k, d: sep[k] - ago[k] }; }).sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); }).slice(0, 3);
      var d = sep._spend - ago._spend;
      var lst = rows.map(function (r) { return catLow(r.k) + ' (' + (r.d > 0 ? '+' : '') + money(r.d) + ')'; }).join(', ');
      return { t: (d > 0 ? T('En septiembre gastaste <b>{monto} más</b> que en agosto.', { monto: money(d) }) : T('En septiembre gastaste <b>{monto} menos</b> que en agosto.', { monto: money(-d) })) + ' ' + T('Lo que más cambió: {lista}.', { lista: lst }),
        h: '<div class="as-stats">' + stat(T('Agosto'), money(ago._spend)) + stat(T('Septiembre'), money(sep._spend), d > 0 ? 'up' : 'down') + '</div>',
        s: ['¿En qué se me va la plata?', '¿En qué me pasé?'] };
    }
    if (/presupuesto|pase|exced|limite|tope/.test(s)) {
      return { t: D.overCats.length ? T('Te pasaste del presupuesto en <b>{cats}</b>. En lo demás vas bien.', { cats: list(D.overCats.map(catLow)) }) : T('En septiembre no te pasaste en nada. ¡Todo dentro del presupuesto!'),
        h: bars(Object.keys(CATS).filter(function (k) { return !CATS[k].fixed; }).map(function (k) { return { k: k, v: sep[k], c: sep[k] > CATS[k].budget ? '#c20505' : '', label: T('{cat} · de {monto}', { cat: T(CATS[k].name), monto: money(CATS[k].budget) }) }; }).sort(function (a, b) { return b.v - a.v; })),
        s: D.overCats.length ? ['¿Cuánto gasté en ' + CATS[D.overCats[0]].name.toLowerCase() + '?', '¿Cuánto más puedo ahorrar?'] : ['¿Cuánto más puedo ahorrar?', '¿Cómo voy con mis metas?'] };
    }
    for (var k in CAT_WORDS) {
      if (CAT_WORDS[k].test(s)) {
        var mv = D.tx.filter(function (t) { return t.cat === k && t.mi === 1; }), by = {};
        mv.forEach(function (t) { by[t.who] = (by[t.who] || 0) + t.amt; });
        var rowsM = Object.keys(by).map(function (w) { return { label: w, v: by[w] }; }).sort(function (a, b) { return b.v - a.v; });
        var a3 = (ago[k] + sep[k]) / 2;
        return { t: T(mv.length === 1 ? 'En septiembre gastaste <b>{monto}</b> en {cat}, en 1 pago.' : 'En septiembre gastaste <b>{monto}</b> en {cat}, en {n} pagos.', { monto: money(sep[k]), cat: catLow(k), n: mv.length }) + ' ' +
          T('Normalmente gastas unos {prom} y en lo que va de octubre llevas {oct}.', { prom: money(a3), oct: money(oct[k]) }),
          h: rowsM.length ? bars(rowsM) : '', s: ['¿En qué me pasé?', 'Septiembre vs. agosto'] };
      }
    }
    if (/en que|mas gasto|gasto mas|gastos|donde se va|se me va|analiza|categor/.test(s)) {
      var tc = topCats(1, 5);
      return { t: T('En septiembre gastaste <b>{monto}</b>.', { monto: money(sep._spend) }) + ' ' +
        T('Lo que más se lleva es {c1} ({pct}), y después {c2} y {c3}.', { c1: catLow(tc[0].k), pct: pct(tc[0].v / sep._spend), c2: catLow(tc[1].k), c3: catLow(tc[2].k) }),
        h: bars(tc), s: ['¿En qué me pasé?', 'Mis gastos hormiga', 'Septiembre vs. agosto'] };
    }
    if (/resumen|como voy|como estoy|general|paisaje|bosque|crecer|estado|mejorar/.test(s) || s.length < 3) return summary();
    // Aquí entraría la IA: sólo para preguntas libres que las reglas no entienden.
    return { t: T('Mmm, eso todavía no lo sé responder. Te puedo ayudar con tus gastos, tu presupuesto, tus metas, el ahorro o tus suscripciones de los últimos 3 meses. ¿Es sobre algo de esto?'),
      s: ['¿En qué se me va la plata?', '¿Cómo voy con mis metas?', '¿Cuánto más puedo ahorrar?'] };
  }
  // Palabras en kichwa que apuntan a una intención (se suman al texto)
  var KW = { imanalla: 'hola', kullki: 'plata', llukshik: 'gastos', tukuchi: 'gastos', pakta: 'meta', waakaychi: 'ahorr', manu: 'debo', mañachi: 'credito', tantalla: 'total', hormiga: 'hormiga', kamachi: 'presupuesto' };
  function list(a) { return a.length > 1 ? a.slice(0, -1).join(', ') + ' ' + T('y') + ' ' + a[a.length - 1] : a[0]; }
  var FIX = { ahorro: '¿Cuánto más puedo ahorrar?', pagos: '¿Qué pasa si pago tarde un servicio?', presupuesto: '¿En qué me pasé?', deuda: '¿Cuánto debo en mi tarjeta?', colchon: '¿Para cuántos meses me alcanza?' };
  function summary() {
    var f = D.f;
    var good = Object.keys(f).filter(function (k) { return f[k].ok; }).map(function (k) { return T(f[k].label).toLowerCase(); });
    var badK = Object.keys(f).filter(function (k) { return !f[k].ok; }), bad = badK.map(function (k) { return T(f[k].label).toLowerCase(); });
    return { t: T('Tu salud financiera está en <b>{n} de 100</b>.', { n: D.score }) + ' ' + (good.length ? T('Vas bien en {lista}.', { lista: list(good) }) + ' ' : '') +
      (bad.length ? T('Donde más puedes mejorar: {lista}.', { lista: list(bad) }) : T('Este mes no hay nada que corregir. ¡Sigue así!')),
      s: badK.length ? badK.slice(0, 2).map(function (k) { return FIX[k]; }) : ['¿Cómo voy con mis metas?', '¿Cuánto más puedo ahorrar?'] };
  }
  function reports() {
    var base = { dificil: [-1, 0], normal: [0, 0], excelente: [1, 1] }[ST.scenario];
    var rows = [
      ['Jul', 'Ahorraste el 9%', 'pagaste todo a tiempo', 62 + base[0] * 6],
      ['Jun', 'Ahorraste el 7%', 'un pago atrasado', 48 + base[0] * 4],
      ['May', 'Ahorraste el 11%', 'completaste la meta de la laptop', 81 + base[1] * 4],
      ['Abr', 'Ahorraste el 5%', 'te pasaste del presupuesto', 39 + base[0] * 3]
    ];
    return { t: T('El detalle de cada movimiento lo tengo solo desde agosto. De los meses anteriores te puedo mostrar un resumen:'),
      h: '<div class="as-report">' + rows.map(function (r) {
          return '<div class="as-report__row"><b>' + T(r[0]) + '</b><span>' + T(r[1]) + ', ' + T(r[2]) + '</span><em>' + r[3] + '</em></div>';
        }).join('') + '</div><p class="as-note">' + T('El número es tu salud financiera de ese mes.') + '</p>',
      s: ['¿Cómo voy en general?', 'Septiembre vs. agosto'] };
  }
  var SUGGEST = ['¿En qué se me va la plata?', '¿Cómo voy con mis metas?', 'Mis gastos hormiga', '¿Cuánto más puedo ahorrar?', 'Septiembre vs. agosto', '¿En qué me pasé?', 'Mis suscripciones', '¿Cómo me fue en mayo?', '¿Cómo voy en general?'];

  // El mensaje principal es siempre el primer insight del último mes
  // cerrado: lo mismo en Inicio, en Mis finanzas y en el asistente.
  function insight() {
    var x = monthInsights(lastClosedMi())[0];
    return x.title + '. ' + x.sub;
  }

  /* ---------- Insights por mes ----------
     Una sola fuente para el PFM, la tarjeta de Inicio y el asistente.
     Los meses cerrados se resumen una vez (al cierre) y se guardan; el mes
     en curso sólo se calcula cuando la persona lo pide. */
  var HAB = { super: 300, delivery: 110, transporte: 55, servicios: 96, subs: 91, compras: 150, cafe: 32, salud: 25, ocio: 55 };
  var REPORTS = {
    jun: { name: 'junio', spend: 984.2, save: 84, rate: .07, score: 46, ins: [
      { kind: 'warn', icon: 'event_busy', title: 'Pagaste tarde el internet', sub: 'Lo pagaste 4 días después de la fecha y te cobraron $ 1,50 de recargo.' },
      { kind: 'good', icon: 'savings', title: 'Ahorraste $ 84', sub: 'Es el 7% de tus ingresos.' }] },
    jul: { name: 'julio', spend: 1012.6, save: 108, rate: .09, score: 61, ins: [
      { kind: 'warn', icon: 'trending_up', title: 'Gastaste 41% más de lo normal en compras', sub: 'Fueron las compras de vacaciones: $ 212, cuando normalmente gastas $ 150.' },
      { kind: 'good', icon: 'event_available', title: 'Pagaste todo a tiempo', sub: 'Sin recargos en servicios ni tarjetas.' }] }
  };
  var VIEWS = [
    // Hoy, el mes en curso y luego los más antiguos
    { key: 'hoy', short: 'Hoy', today: true },
    { key: 'oct', short: 'oct', mi: 2, current: true }, { key: 'sep', short: 'sep', mi: 1 }, { key: 'ago', short: 'ago', mi: 0 },
    { key: 'jul', short: 'jul', report: true }, { key: 'jun', short: 'jun', report: true }
  ];
  // Mis finanzas siempre abre en "Hoy" (tu dinero ahora); los meses quedan
  // para mirar atrás. Al volver a la sección desde otra, regresa a Hoy.
  ST.view = 'hoy';
  document.addEventListener('pb:view', function (e) {
    if (e.detail !== 1 || !pf || ST.view === 'hoy') return;
    ST.view = 'hoy'; persist(); paintPF();
  });
  function viewOf(key) { return VIEWS.filter(function (v) { return v.key === key; })[0] || VIEWS[3]; }

  function cardInterest(mi) {
    if (D.sc.debt < 1 || ST.mods.ccPaid >= 200) return 0;
    return +(acctOf('and1').base * D.sc.debt * .0135 * (mi === 0 ? .9 : 1)).toFixed(2);
  }
  function monthScore(mi) {
    var b = D.by[mi], rate = b._save / b._in;
    var late = D.tx.some(function (t) { return t.late && t.mi === mi; });
    var over = Object.keys(CATS).filter(function (k) { return b[k] > CATS[k].budget; }).length;
    return Math.round(25 * Math.min(1, rate / .15) + 20 * (late ? 0 : 1) + 20 * (1 - Math.min(1, over / 3)) + 15 * D.f.deuda.v + 20 * D.f.colchon.v);
  }
  var insCache = {};
  function monthInsights(mi) {
    var ck = mi + '|' + ST.scenario + '|' + ST.linked.join() + '|' + ST.off.join() + '|' + JSON.stringify(ST.mods);
    if (insCache[ck]) return insCache[ck];
    var b = D.by[mi], name = MONTHS[mi].name, warn = [], good = [];
    var late = D.tx.filter(function (t) { return t.late && t.mi === mi; })[0];
    if (late) warn.push({ kind: 'warn', icon: 'event_busy', title: T('Pagaste tarde el {servicio}', { servicio: T(late.who).toLowerCase() }), sub: T('Vencía el 7 de {mes} y lo pagaste el 12, así que te cobraron {monto} de recargo.', { mes: T(name), monto: money(1.5) }), det: 'late:' + mi, ask: '¿Qué pasa si pago tarde un servicio?' });
    var int = cardInterest(mi);
    if (int) warn.push({ kind: 'warn', icon: 'credit_card', title: T('Pagaste solo el mínimo de tu Mastercard Black'), sub: T('Por eso te cobraron {monto} de intereses en {mes}. Si pagas el total, no pagas intereses.', { monto: money(int), mes: T(name) }), det: 'card:' + mi, ask: '¿Cuánto pago de intereses en mi tarjeta?' });
    var spikes = Object.keys(HAB).filter(function (k) { return !CATS[k].fixed && b[k] > HAB[k] * 1.25 && b[k] - HAB[k] > 15; })
      .sort(function (x, y) { return (b[y] - HAB[y]) - (b[x] - HAB[x]); });
    if (spikes.length) {
      var k = spikes[0], by = {};
      D.tx.forEach(function (t) { if (t.cat === k && t.mi === mi) by[t.who] = (by[t.who] || 0) + t.amt; });
      var top = Object.keys(by).sort(function (x, y) { return by[y] - by[x]; })[0];
      warn.push({ kind: 'warn', icon: 'trending_up', title: T('Gastaste {pct} más de lo normal en {cat}', { pct: pct(b[k] / HAB[k] - 1), cat: catLow(k) }), sub: T('Fueron {monto}, cuando normalmente gastas {habitual}.', { monto: money(b[k]), habitual: money(HAB[k]) }) + (top ? ' ' + T('Donde más gastaste: {lugar}.', { lugar: top }) : ''), det: 'cat:' + k + ':' + mi, ask: '¿Cuánto gasté en ' + CATS[k].name.toLowerCase() + '?' });
    }
    var rate = b._save / b._in;
    if (rate >= .08) good.push({ kind: 'good', icon: 'savings', title: T('Ahorraste {monto}', { monto: money(b._save) }), sub: T('Es el {pct} de tus ingresos. ¡Bien!', { pct: pct(rate) }), ask: '¿Cuánto más puedo ahorrar?' });
    else good.push({ kind: 'info', icon: 'savings', title: rate ? T('Ahorraste {monto}, el {pct}', { monto: money(b._save), pct: pct(rate) }) : T('Este mes no ahorraste nada'), sub: T('Lo ideal es ahorrar por lo menos el 8% de tus ingresos.') + (rate ? '' : ' ' + T('Programar un ahorro automático el día de pago ayuda mucho.')), ask: '¿Cuánto más puedo ahorrar?' });
    if (!late) good.push({ kind: 'good', icon: 'event_available', title: T('Pagaste todo a tiempo'), sub: T('No te cobraron ningún recargo este mes.') });
    var out = warn.slice(0, 3).concat(good).slice(0, 4);
    insCache[ck] = out;
    return out;
  }
  function lastClosedMi() { return 1; }

  /* ---------- Entradas: Inicio y Modo finanzas ----------
     Tarjeta aireada: ilustración centrada sobre un círculo neutro,
     un solo mensaje y un link. */
  function mountEntries() {
    // Mis finanzas reemplaza al antiguo "Modo finanzas" (activos/pasivos/
    // cuentas duplicaban esta vista): el acceso abre directamente el PFM.
    // En Inicio, Mis finanzas vive como un widget de Destacados.
    if (mountEntries._done) return; mountEntries._done = true;
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-action="Modo finanzas"]');
      if (!b) return;
      e.stopImmediatePropagation(); e.preventDefault();
      openPF();
    }, true);
  }
  // Inicio muestra la misma deuda de la Mastercard Black que usa Uku
  function syncHome() {
    if (!D.card) return;
    document.querySelectorAll('.product-row[data-action="Mastercard Black"]').forEach(function (r) {
      var a = r.querySelector('.product-row__amount'); if (a) a.textContent = money(D.debt);
      var f = r.closest('.card') && r.closest('.card').querySelector('.card__footer-value'); if (f) f.textContent = money(D.debt);
    });
  }
  function paintEntries() {
    syncHome();
    if (window.Destacados) Destacados.repaint();
    document.querySelectorAll('[data-as-open]').forEach(function (b) {
      b.querySelector('.as-entry__pet').innerHTML = C().svg();
      b.querySelector('.as-entry__eyebrow').textContent = T('Tu resumen de {mes} ya está listo', { mes: T(MONTHS[lastClosedMi()].name) });
      b.querySelector('.as-entry__cta').textContent = 'Ver resumen';
      b.querySelector('.as-entry__title').textContent = monthInsights(lastClosedMi())[0].title;
    });
  }

  /* ---------- Pantalla del asistente ----------
     Dos estados: "escena" (personaje grande, un mensaje, mucho aire) y
     "chat" (el personaje se hace chico abajo y las burbujas flotan sobre
     el paisaje). Factores y ajustes viven en hojas inferiores. */
  var page, chat, input, sheet, back;
  function mount() {
    page = document.createElement('div');
    page.className = 'as-page';
    page.setAttribute('role', 'dialog');
    page.setAttribute('aria-modal', 'true');
    page.innerHTML =
      '<div class="as-land-wrap"></div>' +
      '<div class="as-top">' +
        '<button class="as-icon-btn pf-round" data-as="back" aria-label="Volver"><span class="material-symbols-rounded">close</span></button>' +
        '<button class="as-level" data-as="land" aria-label="Ver tu salud financiera"><i></i><span></span><span class="material-symbols-rounded">expand_more</span></button>' +
        '<button class="as-icon-btn pf-round" data-as="settings" aria-label="Ajustes del asistente"><span class="material-symbols-rounded">tune</span></button>' +
      '</div>' +
      // Hub (estado inicial): saludo, bento, temas e historial
      '<div class="as-hub">' +
        '<h1 class="as-hub__hi">' + T('Hola') + '<span class="as-hub__name"></span></h1>' +
        '<p class="as-hub__sub">¿En qué te ayudo hoy?</p>' +
        '<div class="as-bento">' +
          '<button class="as-tile as-tile--portal" data-hub="voice"><div class="b3d"></div>' +
            '<span class="as-tile__ic material-symbols-rounded">graphic_eq</span><span class="as-tile__go material-symbols-rounded">north_east</span>' +
            '<span class="as-tile__t" data-tpl="Habla con {nombre}"></span></button>' +
          '<button class="as-tile as-tile--accent" data-hub="write"><span class="as-tile__ic material-symbols-rounded">chat_bubble</span><span class="as-tile__go material-symbols-rounded">north_east</span>' +
            '<span class="as-tile__t" data-tpl="Escríbele a {nombre}"></span></button>' +
          '<button class="as-tile" data-hub="month"><span class="as-tile__ic material-symbols-rounded">insights</span><span class="as-tile__go material-symbols-rounded">north_east</span>' +
            '<span class="as-tile__t" data-tpl="Tu resumen de {mes}"></span></button>' +
        '</div>' +
        // Lo que Uku ve en la sección desde donde lo abriste (tarjetas, préstamos…)
        '<section class="as-hub__sec as-ctx" hidden><div class="as-hub__head"><h2></h2></div><div class="as-ctx__list"></div></section>' +
        '<section class="as-hub__sec"><div class="as-hub__head"><h2>Temas</h2></div><div class="as-topics"></div></section>' +
        '<section class="as-hub__sec"><div class="as-hub__head"><h2>Historial</h2><button class="as-hub__all" data-hub="clear">Borrar</button></div><div class="as-hist"></div></section>' +
      '</div>' +
      '<div class="as-chat" aria-live="polite"></div>' +
      '<div class="as-pet" role="button" tabindex="0" aria-label="Saludar"></div>' +
      '<div class="as-composer"><div class="as-chips"></div>' +
        '<form class="as-input"><input type="text" enterkeyhint="send" autocomplete="off" aria-label="Escribe tu pregunta">' +
        '<button class="as-send" type="submit" aria-label="Enviar"><span class="material-symbols-rounded">arrow_upward</span></button></form><p class="uku-disc">' + T('Uku es una IA y puede cometer errores. Sus sugerencias no son recomendaciones financieras.') + '</p></div>';
    document.body.appendChild(page);
    ensureSheet();

    chat = page.querySelector('.as-chat');
    input = page.querySelector('input');
    page.querySelector('.as-chips').innerHTML = SUGGEST.slice(0, 5).map(function (q) { return '<button class="as-chip" type="button">' + q + '</button>'; }).join('');
    page.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-as="back"]'))) { if (page.classList.contains('is-chat')) leaveChat(); else close(); return; }
      if ((b = e.target.closest('[data-as="land"]'))) return openSheet('land');
      if ((b = e.target.closest('[data-as="settings"]'))) return openSheet('settings');
      if ((b = e.target.closest('.as-chip'))) return ask(b.textContent);
      if ((b = e.target.closest('[data-reply]'))) return ask(b.dataset.reply);
      if ((b = e.target.closest('[data-topic]'))) return ask(b.dataset.topic);
      if ((b = e.target.closest('[data-hist]'))) return ask(b.dataset.hist);
      if ((b = e.target.closest('[data-hub]'))) {
        var h = b.dataset.hub;
        if (h === 'write') { input.focus(); return; }
        if (h === 'month') { close(); openPF(); return; }
        if (h === 'voice') return listen();
        if (h === 'clear') { ST.history = []; persist(); paintHub(); return; }
      }
    });
    page.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); var v = input.value.trim(); if (v) { input.value = ''; ask(v); } });
    input.addEventListener('focus', function () { setPet('is-listening'); });
    input.addEventListener('blur', function () { setPet(''); });
    page.querySelector('.as-pet').addEventListener('click', function () { fx('select'); setPet('is-happy'); setTimeout(function () { setPet(''); }, 650); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !page.classList.contains('open')) return;
      e.stopImmediatePropagation();
      if (sheet.classList.contains('open')) closeSheet(); else if (page.classList.contains('is-chat')) leaveChat(); else close();
    }, true);
  }
  function setPet(cls) {
    // Gestos del oso 3D: escuchar → pensar, hablar, alegrarse.
    if (cls === 'is-listening') gest('think');
    else if (cls === 'is-talking') gest('talk');
    else if (cls === 'is-happy') gest('happy');
  }

  function paintAll() {
    paintEntries();
    if (!page) return;
    var lv = level(D.score);
    var lw = page.querySelector('.as-land-wrap');
    lw.innerHTML = '<div class="b3d"></div>';
    page.querySelector('.as-tile--portal .b3d').innerHTML = '<div class="b3d__fallback">' + C().svg() + '</div>';
    place3D('wave');
    page.querySelector('.as-pet').innerHTML = '';
    page.querySelector('.as-level span').textContent = T('Salud financiera {n} · {nivel}', { n: D.score, nivel: T(lv.n) });
    page.querySelector('.as-level').style.setProperty('--lvl', 'var(--as-accent)');
    paintHub();
    input.placeholder = T('Pregúntale a {nombre}', { nombre: C().name });
  }

  /* Hojas inferiores (compartidas por el PFM y el asistente) */
  function ensureSheet() {
    if (sheet) return;
    back = document.createElement('div'); back.className = 'as-sheet-back';
    sheet = document.createElement('div'); sheet.className = 'as-sheet'; sheet.setAttribute('role', 'dialog');
    document.body.appendChild(back); document.body.appendChild(sheet);
    back.addEventListener('click', closeSheet);
    sheet.addEventListener('click', onSheetClick);
  }
  function showSheet(html) {
    ensureSheet();
    sheet.innerHTML = '<div class="as-sheet__handle"></div>' + html;
    sheet.scrollTop = 0;
    if (!sheet.classList.contains('open')) fx('open');
    back.classList.add('open'); sheet.classList.add('open');
  }
  function openSheet(kind) {
    ensureSheet();
    var lv = level(D.score), html = '<div class="as-sheet__handle"></div>';
    if (kind === 'land') {
      html += '<h3>' + T('Salud financiera {n}', { n: D.score }) + '</h3><p>' + T('Se calcula con estos cinco hábitos. Mientras mejor te va, más crece el bosque de {nombre}.', { nombre: C().name }) + '</p>' +
        '<div class="as-rows">' + Object.keys(D.f).map(function (k) {
          var f = D.f[k];
          return '<div class="as-row"><span class="as-row__icon material-symbols-rounded">' + f.icon + '</span>' +
            '<span class="as-row__main"><b>' + f.label + '</b><small>' + f.tip + '</small></span>' +
            '<span class="as-row__val' + (f.ok ? '' : ' is-warn') + '">' + f.val + '</span></div>';
        }).join('') + '</div>';
    } else {
      var PL = window.UkuAnalisis ? UkuAnalisis.plans() : {};
      html += '<h3>Ajustes</h3>' +
        (window.UkuAnalisis ? '<p class="as-sheet__label">' + T('Tipo de cliente para Analizar con Uku (demo)') + '</p><div class="as-rows">' + Object.keys(PL).map(function (k) {
          return '<button class="as-row as-row--btn" data-plan="' + k + '" aria-pressed="' + (UkuAnalisis.plan() === k) + '"><span class="as-row__main"><b>' + PL[k] + '</b></span><span class="as-radio"></span></button>';
        }).join('') + '</div>' : '') +
        '<p class="as-sheet__label">Probar otro escenario (solo demo)</p><div class="as-rows">' +
        Object.keys(SCEN).map(function (k) {
          return '<button class="as-row as-row--btn" data-sc="' + k + '" aria-pressed="' + (ST.scenario === k) + '"><span class="as-row__main"><b>' + SCEN[k].label + '</b></span><span class="as-radio"></span></button>';
        }).join('') + '</div>' +
        (window.Clima ? '<p class="as-sheet__label">' + T('Clima de {nombre} (demo)', { nombre: C().name }) + '</p><div class="as-rows">' + Object.keys(Clima.labels).map(function (k) {
          return '<button class="as-row as-row--btn" data-clima="' + k + '" aria-pressed="' + (Clima.mode() === k) + '"><span class="as-row__main"><b>' + Clima.labels[k] + '</b></span><span class="as-radio"></span></button>';
        }).join('') + '</div>' : '');
    }
    sheet.innerHTML = html;
    back.classList.add('open'); sheet.classList.add('open'); fx('open');
  }
  function closeSheet() { back.classList.remove('open'); sheet.classList.remove('open'); }
  function onSheetClick(e) {
    var sb = e.target.closest('[data-sheet]');
    if (sb) return onSheetPF(sb);
    var pb = e.target.closest('[data-plan]');
    if (pb) {
      fx('toggle'); UkuAnalisis.setPlan(pb.dataset.plan);
      sheet.querySelectorAll('[data-plan]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === pb)); });
      paintPF(); return;
    }
    var cb = e.target.closest('[data-clima]');
    if (cb) {
      fx('toggle');
      sheet.querySelectorAll('[data-clima]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === cb)); });
      Clima.set(cb.dataset.clima);
      return;
    }
    var b = e.target.closest('[data-who],[data-sc]');
    if (!b) return;
    if (b.dataset.who && ST.who !== b.dataset.who) { ST.who = b.dataset.who; fx('toggle'); }
    if (b.dataset.sc && ST.scenario !== b.dataset.sc) { ST.scenario = b.dataset.sc; build(); fx(D.score >= 55 ? 'success' : 'select'); }
    persist(); paintAll(); paintPF();
    sheet.querySelectorAll('[data-who]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.who === ST.who)); });
    sheet.querySelectorAll('[data-sc]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.sc === ST.scenario)); });
  }

  /* Chat */
  function enterChat() { if (!page.classList.contains('is-chat')) { page.classList.add('is-chat'); page.querySelector('[data-as="back"] span').textContent = 'arrow_back'; place3D(); } }
  function leaveChat() { page.classList.remove('is-chat'); page.querySelector('[data-as="back"] span').textContent = 'close'; fx('close'); place3D('wave'); }

  /* El portal 3D vive en la tarjeta del hub; en el chat pasa al fondo. */
  function place3D(g) {
    // En el chat el oso no queda detrás del texto: se pausa la escena y
    // Uku aparece en la cabecera de cada mensaje.
    if (page.classList.contains('is-chat')) { if (b3d) b3d.detach(page.querySelector('.as-tile--portal .b3d')); return; }
    mount3D(page.querySelector('.as-tile--portal .b3d'), D.score, g);
  }
  var TOPICS = [['pie_chart', 'Gastos', '¿En qué se me va la plata?'], ['flag', 'Metas', '¿Cómo voy con mis metas?'], ['credit_card', 'Tarjetas', '¿Cuánto debo en mi tarjeta?'],
    ['savings', 'Ahorro', '¿Cuánto más puedo ahorrar?'], ['autorenew', 'Suscripciones', 'Mis suscripciones']];
  function paintHub() {
    var n = document.querySelector('.profile-head__name');
    page.querySelector('.as-hub__name').textContent = n ? ', ' + n.textContent.trim().split(' ')[0] : '';
    // Frases completas (no partidas en spans): así cada idioma ordena las palabras a su modo
    page.querySelectorAll('[data-tpl]').forEach(function (e) { e.textContent = e.dataset.tpl.replace('{nombre}', C().name).replace('{mes}', MONTHS[lastClosedMi()].name); });
    var cx = curCtx && window.Contexto ? Contexto.info(curCtx) : null, sec = page.querySelector('.as-ctx');
    page.querySelector('.as-hub__sub').textContent = cx ? cx.saludo : '¿En qué te ayudo hoy?';
    sec.hidden = !(cx && cx.insights.length);
    if (cx) {
      sec.querySelector('h2').textContent = cx.titulo;
      sec.querySelector('.as-ctx__list').innerHTML = cx.insights.map(function (x, i) {
        return '<div class="uku-say">' + (i === 0 ? '<span class="uku-say__face">' + C().face() + '</span>' : '<span class="uku-say__face" aria-hidden="true"></span>') +
          '<div class="uku-say__body"><p class="uku-say__bubble">' + esc(x.c || (x.t + '. ' + x.s)) + '</p>' +
          '<button class="uku-say__reply" data-hist="' + esc(x.q) + '">' + esc(x.q) + '</button></div></div>';
      }).join('');
    }
    page.querySelector('.as-topics').innerHTML = TOPICS.map(function (t) {
      return '<button class="as-topic" data-topic="' + t[2] + '"><span class="material-symbols-rounded">' + t[0] + '</span>' + t[1] + '</button>';
    }).join('');
    var hist = (ST.history && ST.history.length ? ST.history : ['¿Cómo me fue en mayo?', 'Mis gastos hormiga']).slice(0, 4);
    page.querySelector('.as-hist').innerHTML = hist.map(function (q) {
      return '<button class="as-hist__row" data-hist="' + esc(q) + '"><span class="material-symbols-rounded">history</span><span>' + esc(q) + '</span><span class="material-symbols-rounded">chevron_right</span></button>';
    }).join('');
    page.querySelector('[data-hub="clear"]').hidden = !(ST.history && ST.history.length);
  }
  /* Hablar con Uku: dictado del navegador; si no hay, se escribe */
  var rec = null;
  function listen() {
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { input.focus(); return; }
    if (rec) { rec.stop(); return; }
    var r = rec = new R(), cap, done = false;
    r.lang = 'es-EC'; r.interimResults = false; r.continuous = false;
    page.classList.add('is-listening'); gest('think'); fx('select');
    var hint = input.placeholder; input.placeholder = 'Te escucho…';
    cap = setTimeout(function () { try { r.stop(); } catch (e) {} }, 8000); // nunca queda abierto
    r.onresult = function (e) {
      var q = e.results[0][0].transcript;
      if (q && !done) { done = true; try { r.stop(); } catch (x) {} fx('success'); ask(q); }
    };
    r.onerror = function () { try { r.stop(); } catch (e) {} };
    r.onend = function () { clearTimeout(cap); rec = null; input.placeholder = hint; page.classList.remove('is-listening'); };
    try { r.start(); } catch (e) { clearTimeout(cap); rec = null; input.placeholder = hint; page.classList.remove('is-listening'); input.focus(); }
  }
  function me(text) {
    var m = document.createElement('div');
    m.className = 'as-msg as-msg--me';
    m.innerHTML = '<div class="as-msg__bubble"><p>' + esc(text) + '</p></div>';
    chat.appendChild(m); scrollEnd();
  }
  /* Respuestas "masticadas": una idea por burbuja. El texto se parte en
     oraciones (máx. 3 burbujas) y el gráfico va después de la primera, que
     siempre trae el dato principal. */
  function chunks(t) {
    var parts = [];
    t.split(/<br><br>/).forEach(function (p) {
      p.replace(/([.!?])\s+(?=[A-ZÁÉÍÓÚ¿¡<])/g, '$1\u0001').split('\u0001').forEach(function (x) { if (x.trim()) parts.push(x.trim()); });
    });
    if (parts.length > 3) parts = [parts[0], parts[1], parts.slice(2).join(' ')];
    return parts;
  }
  function bot(a) {
    var m = document.createElement('div');
    m.className = 'as-msg as-msg--uku';
    m.innerHTML = '<div class="as-msg__who"><span class="as-msg__av">' + C().face() + '</span><b>' + C().name + '</b></div>';
    var typing = document.createElement('div');
    typing.className = 'as-msg__bubble';
    typing.innerHTML = '<span class="as-typing" aria-label="' + T('{nombre} está escribiendo', { nombre: C().name }) + '"><i></i><i></i><i></i></span>';
    m.appendChild(typing); chat.appendChild(m); scrollEnd();
    setPet('is-talking');
    var parts = chunks(a.t), seq = [];
    parts.forEach(function (p, i) {
      seq.push('<p>' + p + '</p>');
      if (i === 0 && a.h) seq.push({ card: a.h });
    });
    var i = 0;
    (function next() {
      setTimeout(function () {
        var it = seq[i++], el = document.createElement('div');
        el.className = 'as-msg__bubble' + (it.card ? ' as-msg__card' : '');
        el.innerHTML = it.card || it;
        m.insertBefore(el, typing);
        if (i < seq.length) { scrollEnd(); return next(); }
        typing.remove();
        // Respuestas sugeridas: del lado de quien pregunta, listas para tocar
        if (a.s && a.s.length) {
          var r = document.createElement('div');
          r.className = 'as-replies';
          r.innerHTML = a.s.map(function (q) { return '<button class="as-reply" type="button" data-reply="' + esc(q) + '">' + esc(q) + '</button>'; }).join('');
          chat.appendChild(r);
        }
        scrollEnd(); fx('reveal');
        setTimeout(function () { setPet(''); }, 900);
      }, i === 0 ? 600 + Math.random() * 250 : (seq[i] && seq[i].card ? 250 : 700));
    })();
  }
  function ask(q) {
    ST.history = [q].concat((ST.history || []).filter(function (x) { return x !== q; })).slice(0, 6); persist();
    if (chat) chat.querySelectorAll('.as-replies').forEach(function (r) { r.remove(); });
    enterChat(); me(q); fx('tap'); bot(answer(q));
  }
  function scrollEnd() { requestAnimationFrame(function () { chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' }); }); }

  var curCtx = null;
  // open({ ctx: 'tarjetas', ask: '¿…?' }): abre ya en el contexto de la sección
  function open(o) {
    if (!page) mount();
    curCtx = o && o.ctx ? o.ctx : (window.Contexto ? Contexto.get() : null);
    if (page.classList.contains('is-chat')) leaveChat();
    paintAll();
    if (o && o.ask) setTimeout(function () { ask(o.ask); }, 320);
    page.classList.add('open');
    document.body.style.overflow = 'hidden';
    fx('open');
  }
  function close() {
    page.classList.remove('open');
    if (!document.querySelector('#finance-page.open, .pf-page.open:not(.pf-page--inline)')) document.body.style.overflow = '';
    fx('close');
    paintEntries(); paintPF();
  }

  /* =====================================================================
     PFM — Mis finanzas
     Todas tus cuentas (Pichibank + otros bancos conectados), a dónde se
     va tu dinero, presupuesto, salud financiera con acciones concretas,
     pagos recurrentes, metas y movimientos. El asistente es una capa más.
     ===================================================================== */
  var pf;
  var NEUTRAL = ['var(--as-line)', '#5b6478', '#8b93a5', '#b7bcc8', '#d9dce3'];
  function bankAv(bank) { return '<span class="pf-av' + (BANKS[bank].own ? ' is-own' : '') + '">' + BANKS[bank].ini + '</span>'; }
  function acctOf(id) { return ACCTS.filter(function (a) { return a.id === id; })[0]; }
  function catTotals(mi) {
    var b = D.by[mi];
    return Object.keys(CATS).map(function (k) { return { k: k, v: b[k] }; }).filter(function (c) { return c.v > 0; }).sort(function (a, b) { return b.v - a.v; });
  }
  function donut(rows, total) {
    var R = 54, C = 2 * Math.PI * R, off = 0, segs = [];
    var top = rows.slice(0, 4), rest = rows.slice(4).reduce(function (s, r) { return s + r.v; }, 0);
    if (rest) top = top.concat([{ k: '_o', v: rest }]);
    top.forEach(function (r, i) {
      var len = r.v / total * C;
      segs.push('<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="' + NEUTRAL[i] + '" stroke-width="18" stroke-dasharray="' + Math.max(0, len - 2).toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" transform="rotate(-90 70 70)"/>');
      off += len;
    });
    return '<svg class="pf-donut" viewBox="0 0 140 140" aria-hidden="true">' + segs.join('') + '</svg>';
  }
  function txRow(t) {
    var a = acctOf(t.acct), inc = t.cat === 'ingreso', sav = t.cat === 'ahorro';
    var cat = inc ? T('Ingreso') : sav ? T('Ahorro') : T(CATS[t.cat].name);
    var ic = inc ? 'south_west' : sav ? 'savings' : (CAT_IC[t.cat] || 'receipt_long');
    var bank = BANKS[a.bank].own ? '' : ' · ' + BANKS[a.bank].name;
    return '<div class="pf-tx"><span class="pf-tx__ic material-symbols-rounded" aria-hidden="true">' + ic + '</span>' +
      '<span class="pf-tx__main"><b>' + esc(t.who) + '</b><small>' + cat + ' · ' + t.day + ' ' + MONTHS[t.mi].short.toLowerCase() + bank + '</small></span>' +
      '<span class="pf-tx__amt' + (inc ? ' is-in' : '') + '">' + (inc ? '+' : sav ? '' : '−') + money(t.amt) + '</span></div>';
  }
  function sortedTx(filter) {
    return D.tx.filter(filter || function () { return true; }).sort(function (a, b) { return (b.mi * 40 + b.day) - (a.mi * 40 + a.day); });
  }

  function mountPF() {
    pf = document.createElement('div');
    // Mis finanzas es una sección de la barra inferior (como Inicio y
    // Perfil): se monta dentro de su vista y scrollea con la página.
    var host = document.querySelector('.view[data-view="1"] .pf-host');
    pf.className = 'pf-page pf-page--inline open';
    pf.setAttribute('aria-label', 'Mis finanzas');
    pf.innerHTML = '<div class="pf-scroll"></div>';
    host.appendChild(pf);
    pf.addEventListener('click', onPF);
  }

  var curIns = [], onDemand = null;
  function heroHTML(score, label) {
    return '<section class="pf-hero"><div class="b3d" data-score="' + score + '" data-shift=".17"><div class="b3d__fallback">' + C().svg() + '</div></div>' +
      '<button class="pf-hero__badge" data-pf="health" hidden><i></i>' + label + '<span class="material-symbols-rounded">chevron_right</span></button></section>';
  }
  // Salud financiera como medidor (en vez del badge): cifra, barra y qué significa
  function healthHTML(score, when) {
    var lv = level(score);
    return '<section class="pf-health"><button class="pf-health__card" data-pf="health">' +
      '<span class="pf-meter__top"><span class="pf-meter__name">' + T(when ? 'Salud financiera' : 'Tu salud financiera') + '</span>' +
        '<span class="pf-meter__right"><b>' + score + '</b> ' + T('de 100') + '</span></span>' +
      '<span class="pf-meter__bar"><i style="width:' + score + '%"></i></span>' +
      '<span class="pf-meter__sub">' + T(lv.n) + (when ? ' ' + T('en {mes}', { mes: when }) : '') + ' · ' + T('Cómo se calcula') + '<span class="material-symbols-rounded">chevron_right</span></span>' +
      '</button></section>';
  }
  // Botón de IA: se ve distinto a todo lo demás para que quede claro que es IA
  function aiCTA(compact) {
    var acc = window.UkuAnalisis ? UkuAnalisis.access() : '';
    return '<button class="ai-cta' + (compact ? ' ai-cta--sm' : '') + '" data-pf="analyze"><span class="ai-cta__spark material-symbols-rounded" aria-hidden="true">auto_awesome</span>' +
      '<span class="ai-cta__t"><b>' + T('Analizar con {nombre}', { nombre: C().name }) + '</b>' + (acc && !compact ? '<small>' + acc + '</small>' : '') + '</span>' +
      '<span class="ai-badge">IA</span></button>';
  }
  // Uku en los meses: un bloque de información (sin el oso grande)
  function ukuBlock(v) {
    var mesL = T(MONTH_NAME[v.key]).toLowerCase(), list = [], body = '';
    if (v.current && onDemand !== 'ready') {
      body = onDemand === 'loading' ? '<p class="pf-uku2__wait"><span class="pf-spinner"></span>' + T('Revisando tus movimientos de octubre…') + '</p>'
        : '<p class="pf-uku2__sub">' + T('Tu resumen de octubre va a estar listo a inicios de noviembre.') + '</p>' +
          '<div class="pf-uku2__acts"><button class="pf-uku2__btn" data-pf="ondemand">' + T('Sí, cuéntame cómo voy') + '</button></div>';
    } else {
      list = v.current ? currentIns() : v.report ? REPORTS[v.key].ins : monthInsights(v.mi);
      var first = say.first;
      if (first) list = list.slice().sort(function (a, b) { var m = function (x) { return first === 'savings' ? x.icon === 'savings' : x.kind === 'warn'; }; return m(b) - m(a); });
      curIns = list;
      body = '<div class="pf-uku2__list">' + list.slice(0, 3).map(function (x) {
        var i = list.indexOf(x);
        return '<div class="pf-uku2__row"><span class="pf-uku2__ic material-symbols-rounded" aria-hidden="true">' + x.icon + '</span>' +
          '<div class="pf-uku2__txt"><b>' + x.title + '</b><p>' + x.sub + '</p>' +
          (x.det || x.ask ? '<div class="pf-uku2__links">' + (x.det ? '<button data-pf="det:' + i + '">' + T('Ver detalle') + '</button>' : '') +
            (x.ask ? '<button class="is-ai" data-pf="why:' + i + '"><span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span>' + esc(x.ask) + '</button>' : '') + '</div>' : '') + '</div></div>';
      }).join('') + '</div>';
    }
    var md = moodFor(v);
    return '<section class="pf-sec pf-uku2"><div class="pf-uku2__card pf-mood--' + md + '">' +
      '<div class="pf-uku2__head"><span class="pf-uku2__face">' + C().face() + '</span><span><b>' + C().name + ' <em>· ' + T('está {animo}', { animo: T(MOOD[md].label) }) + '</em></b><small>' +
        T(v.current ? 'Cómo vas en {mes}' : 'Lo que pasó en {mes}', { mes: mesL }) + '</small></span></div>' +
      '<p class="pf-uku2__lead">' + hintFor(v) + '</p>' + body +
      aiCTA() +
      '</div></section>';
  }
  function footHTML() {
    return '<section class="pf-sec pf-foot">' +
      '<button class="pf-navrow" data-pf="accounts"><span class="material-symbols-rounded">account_balance</span><span><b>Cuentas conectadas</b><small>' + T('{n} cuentas', { n: D.accts.length }) + ' · ' + Object.keys(BANKS).filter(connected).map(function (k) { return BANKS[k].name; }).join(', ') + '</small></span><span class="material-symbols-rounded">chevron_right</span></button>' +
      '<button class="pf-navrow" data-pf="health"><span class="material-symbols-rounded">favorite</span><span><b>Salud financiera</b><small>Cómo se calcula y cómo subirla</small></span><span class="material-symbols-rounded">chevron_right</span></button>' +
      '<button class="pf-navrow" data-pf="analyze"><span class="pf-navrow__av">' + C().face() + '</span><span><b>' + T('Analizar con {nombre}', { nombre: C().name }) + ' <span class="ai-badge">IA</span></b><small>' + T('Un análisis de tus finanzas hecho con IA') + '</small></span><span class="material-symbols-rounded">chevron_right</span></button>' +
      '<p class="pf-note">' + T('Tu resumen de cada mes estará listo al final del mes.') + '</p></section>';
  }
  // Mis finanzas vive siempre como sección (dashboard); la versión de página
  // completa quedó en respaldo/mis-finanzas-pagina.
  function paintPF() { if (pf) paintDash(); }

  /* ---------- Mis finanzas como sección: dashboard ----------
     Resumen del mes, Uku acompañando con lo que notó, presupuestos,
     en qué gastaste, metas y registros. El detalle vive en hojas. */
  function sentence(t, sub) { return t + (/[.!?]$/.test(t) ? ' ' : '. ') + sub; }
  function goalsHTML() {
    var late = D.goals.filter(function (g) { return !g.onTrack; });
    return '<section class="pf-sec pf-msec"><p class="pf-msec__label">Metas</p><div class="pf-mcard">' +
      '<p class="pf-mcard__lead">' + (late.length ? T('A {meta} le falta un empujón: {monto} más al mes y llegas a tiempo.', { meta: T(late[0].name), monto: money(late[0].need - late[0].monthly) }) : T('Vas a tiempo con todas tus metas.')) + '</p>' +
      D.goals.map(function (g) {
        var p = Math.min(1, g.have / g.target);
        return meterRow({ name: T(g.name), right: T('{pct} ahorrado', { pct: pct(p) }), p: p, tone: 'ok',
          sub: money(g.have) + ' ' + T('de {monto}', { monto: money(g.target) }) + ' · ' + (g.onTrack ? T('Vas a tiempo') : T('Te faltan {monto} al mes', { monto: money(g.need - g.monthly) })) });
      }).join('') + '</div></section>';
  }
  // Fila de medidor (como el uso de una app): nombre, cifra a la derecha,
  // barra fina sobre su mismo color claro y una línea que explica
  function meterRow(o) {
    var w = Math.max(o.p > 0 ? 2 : 0, Math.min(100, o.p * 100));
    return '<' + (o.pf ? 'button data-pf="' + o.pf + '"' : 'div') + ' class="pf-meter pf-meter--' + o.tone + '">' +
      '<span class="pf-meter__top"><span class="pf-meter__name">' + o.name + '</span><span class="pf-meter__right">' + o.right + '</span></span>' +
      '<span class="pf-meter__bar"><i style="width:' + w.toFixed(1) + '%"></i>' + (o.mark != null ? '<em style="left:' + (o.mark * 100).toFixed(1) + '%"></em>' : '') + '</span>' +
      '<span class="pf-meter__sub">' + o.sub + '</span></' + (o.pf ? 'button' : 'div') + '>';
  }
  function recordsHTML(mi) {
    var list = sortedTx(function (t) { return t.mi === mi && t.cat !== 'ahorro'; }).slice(0, 5);
    return '<section class="pf-sec"><div class="pf-sec__head"><h2>Registros</h2><button class="pf-link" data-pf="alltx">Ver todos</button></div>' +
      '<div class="pf-recs">' + list.map(txRow).join('') + '</div>' +
      '<button class="pf-add" data-pf="record"><span class="material-symbols-rounded">add</span>Registrar un gasto en efectivo</button></section>';
  }
  function currentIns() {
    var o = D.by[2], day = MONTHS[2].days, proj = o._spend / day * 31, prev = D.by[1]._spend, out = [];
    out.push({ kind: 'info', icon: 'speed', title: T('Si sigues así, cerrarías octubre en {monto}', { monto: money(proj) }),
      sub: proj > prev ? T('Eso es {monto} más que en septiembre.', { monto: money(proj - prev) }) : T('Eso es {monto} menos que en septiembre.', { monto: money(prev - proj) }), ask: '¿En qué se me va la plata?' });
    var hot = Object.keys(CATS).filter(function (k) { return !CATS[k].fixed && o[k] / CATS[k].budget > day / 31 + .15; })
      .sort(function (a, b) { return o[b] / CATS[b].budget - o[a] / CATS[a].budget; })[0];
    if (hot) out.push({ kind: 'warn', icon: 'pie_chart', title: T('Ya usaste el {pct} de tu presupuesto de {cat}', { pct: pct(o[hot] / CATS[hot].budget), cat: catLow(hot) }),
      sub: T('Y apenas vamos por el {pct} del mes.', { pct: pct(day / 31) }), det: 'cat:' + hot + ':2' });
    var next = [];
    ['servicios', 'subs'].forEach(function (k) { CATS[k].fixed.forEach(function (p, i) { var d = 3 + i * 4; if (d > day && d <= day + 7) next.push({ who: p[0], amt: p[1], d: d }); }); });
    if (next.length) out.push({ kind: 'info', icon: 'event', title: T('Esta semana te cobran {monto}', { monto: money(next.reduce(function (s, n) { return s + n.amt; }, 0)) }),
      sub: next.map(function (n) { return T(n.who) + ' (' + n.d + ' ' + T('oct') + ')'; }).join(', ') + '.' });
    return out;
  }

  /* Hoy: tu dinero ahora (lo que antes era el resumen financiero) */
  var PB_ACTION = { pb1: 'Cuenta PRINCIPAL', pb2: 'Cuenta Corriente', pb3: 'Cuenta Ahorro transaccional' };
  function prodRow(av, name, sub, val, valSub, pf, cls) {
    return '<button class="pf-prod" data-pf="' + pf + '">' + av + '<span class="pf-prod__main"><b>' + name + '</b><small>' + sub + '</small></span>' +
      '<span class="pf-prod__val"><b' + (cls ? ' class="' + cls + '"' : '') + '>' + val + '</b>' + (valSub ? '<small>' + valSub + '</small>' : '') + '</span></button>';
  }
  function icAv(ic) { return '<span class="pf-av pf-av--ic"><span class="material-symbols-rounded">' + ic + '</span></span>'; }
  function homeRows(panel) {
    return Array.prototype.map.call(document.querySelectorAll('#home-page [data-panel="' + panel + '"] .product-row[data-action]'), function (r) {
      var n = r.querySelector('.product-row__name'), a = r.querySelector('.product-row__amount'), sb = r.querySelector('.product-row__sub');
      return { action: r.dataset.action, name: n ? n.textContent.trim() : r.dataset.action, sub: sb ? sb.textContent.trim() : '', amt: a ? a.textContent.trim() : '' };
    }).filter(function (x, i, arr) { return arr.findIndex(function (y) { return y.action === x.action; }) === i; });
  }
  function todayHTML() {
    var cash = D.accts.filter(function (a) { return a.type === 'ahorro' && a.id !== 'sie1' || a.type === 'corriente' || a.type === 'efectivo'; });
    var avail = cash.reduce(function (s, a) { return s + a.bal; }, 0);
    var html = '<section class="pf-sum2"><p class="pf-sum2__label">' + T('Tienes disponible hoy') + '</p><p class="pf-sum2__value">' + money(avail) + '</p>' +
      '<dl class="pf-sum2__list"><div><dt>' + T('Todo lo que tienes') + '</dt><dd>' + money(D.assets) + '</dd></div>' +
      '<div><dt>' + T('Lo que debes') + '</dt><dd>' + money(D.debt) + '</dd></div>' +
      '<div class="is-total"><dt>' + T('Te queda neto') + '</dt><dd>' + money(D.assets - D.debt) + '</dd></div></dl></section>';
    // Lo que Uku tiene para contar vive en su globo (a demanda)
    html += '<section class="pf-sec"><div class="pf-sec__head"><h2>Cuentas</h2><button class="pf-link" data-pf="connect">Conectar</button></div><div class="pf-prods">' +
      cash.map(function (a) {
        return prodRow(bankAv(a.bank), T(a.name), BANKS[a.bank].name + (a.mask ? ' · ••' + a.mask : ''), money(a.bal), '', PB_ACTION[a.id] ? 'go:' + PB_ACTION[a.id] : 'accounts');
      }).join('') + '</div></section>';
    var sie = D.accts.filter(function (a) { return a.id === 'sie1'; })[0];
    html += '<section class="pf-sec pf-msec"><p class="pf-msec__label">' + T('Ahorros y metas') + '</p><div class="pf-mcard">' + D.goals.map(function (g) {
      var p = Math.min(1, g.have / g.target);
      return meterRow({ name: T(g.name), right: money(g.have), p: p, tone: 'ok', sub: T('{pct} de {monto}', { pct: pct(p), monto: money(g.target) }) + ' · ' + T('para {fecha}', { fecha: T(g.due) }) });
    }).join('') + (sie ? meterRow({ name: T(sie.name), right: money(sie.bal), p: 0, tone: 'ok', sub: BANKS.sierra.name + ' · ••' + sie.mask }).replace('<span class="pf-meter__bar"><i style="width:0.0%"></i></span>', '') : '') + '</div></section>';
    var cards = D.accts.filter(function (a) { return a.type === 'credito'; });
    if (cards.length) html += '<section class="pf-sec"><h2>Tarjetas de crédito</h2><div class="pf-prods">' + cards.map(function (c) {
      return prodRow('<span class="pf-cardthumb"></span>', T(c.name), T('Pagas hasta el 10 nov'), money(c.owed), T('Por pagar'), 'card:' + c.name);
    }).join('') + '</div></section>';
    var inv = homeRows('Inversiones'), loans = homeRows('Prestamos');
    if (inv.length) html += '<section class="pf-sec"><h2>Inversiones</h2><div class="pf-prods">' + inv.map(function (x) { return prodRow(icAv('trending_up'), esc(x.name), esc(x.sub || 'Pichibank'), esc(x.amt), '', 'go:' + x.action); }).join('') + '</div></section>';
    if (loans.length) html += '<section class="pf-sec"><h2>Préstamos</h2><div class="pf-prods">' + loans.map(function (x) { return prodRow(icAv('request_quote'), esc(x.name), esc(x.sub || 'Pichibank'), esc(x.amt), '', 'go:' + x.action); }).join('') + '</div></section>';
    return html;
  }
  /* El osito y su entorno: el bosque crece con tu salud financiera. Hay un
     solo lienzo 3D: se reutiliza entre meses y vuelve aquí al cerrar Uku. */
  var climaPainted = null;
  function syncHero() {
    if (!pf) return;
    var hero = pf.querySelector('.pf-hero .b3d');
    if (!hero || !pf.closest('.view.active')) return;
    // El clima se pide recién aquí (al abrir Mis finanzas), no al cargar la app
    if (window.Clima) Clima.get().then(function (c) {
      if (!c || c === climaPainted) return;
      climaPainted = c;
      if (b3d) b3d.setLook(c.look);
      if (viewOf(ST.view).today) paintPF();
    });
    var sc = +hero.dataset.score, g = hero.dataset.g ? JSON.parse(hero.dataset.g) : 'wave';
    if (!hero.querySelector('canvas')) mount3D(hero, sc, g);
    else if (b3d) b3d.setScore(sc);
  }
  /* ---------- Historial, globo de Uku y gráficas claras ---------- */
  var MONTH_NAME = { jun: 'Junio', jul: 'Julio', ago: 'Agosto', sep: 'Septiembre', oct: 'Octubre', hoy: 'Hoy' };
  var CAT_IC = { super: 'shopping_cart', delivery: 'restaurant', transporte: 'directions_bus', servicios: 'bolt', subs: 'autorenew', compras: 'shopping_bag', cafe: 'local_cafe', salud: 'medical_services', ocio: 'theater_comedy' };
  // Cada mes, en cifras simples: lo que entró, lo que gastaste y lo que ahorraste
  function monthNums(v) {
    if (v.report) { var r = REPORTS[v.key]; return { spend: r.spend, save: r.save, inc: Math.round(r.save / r.rate) }; }
    var b = D.by[v.mi]; return { spend: b._spend, save: b._save, inc: b._in, partial: !!v.current };
  }
  function histHTML(v) {
    var ms = VIEWS.filter(function (x) { return !x.today; }).reverse(); // la gráfica va de lo antiguo a lo reciente
    var vals = ms.map(function (x) { return monthNums(x).spend; });
    var closed = ms.filter(function (x) { return !x.current; }).map(function (x) { return monthNums(x).spend; });
    var avg = closed.reduce(function (a, b) { return a + b; }, 0) / closed.length;
    var max = Math.max.apply(null, vals.concat([avg])) * 1.12;
    var cur = monthNums(v), diff = (cur.spend - avg) / avg;
    var note = v.current ? T('Octubre va en curso: llevas {monto} en {n} días.', { monto: money(cur.spend), n: MONTHS[2].days })
      : Math.abs(diff) < .03 ? T('En {mes} gastaste parecido a tu promedio.', { mes: T(MONTH_NAME[v.key]).toLowerCase() })
      : T(diff > 0 ? 'En {mes} gastaste {pct} más que tu promedio.' : 'En {mes} gastaste {pct} menos que tu promedio.', { mes: T(MONTH_NAME[v.key]).toLowerCase(), pct: pct(Math.abs(diff)) });
    return '<section class="pf-sec pf-hist"><div class="pf-sec__head"><h2>' + T('Mes a mes') + '</h2></div>' +
      '<p class="pf-sec__sub">' + note + '</p>' +
      '<div class="pf-hist__chart" style="--avg:' + (avg / max).toFixed(3) + '">' +
        '<span class="pf-hist__avg"><em>' + T('Promedio {monto}', { monto: money(avg) }) + '</em></span>' +
        ms.map(function (x, i) {
          var h = vals[i] / max * 100, on = x.key === v.key;
          return '<button class="pf-hist__col' + (on ? ' is-on' : '') + (x.current ? ' is-cur' : '') + '" data-pf="view:' + x.key + '" aria-label="' + T(MONTH_NAME[x.key]) + ': ' + money(vals[i]) + '"' + (on ? ' aria-current="true"' : '') + '>' +
            '<span class="pf-hist__val">' + money(vals[i]).replace(/,\d\d$/, '') + '</span>' +
            '<span class="pf-hist__bar" style="--h:' + (h / 100).toFixed(3) + '"></span>' +
            '<span class="pf-hist__m">' + T(MONTH_NAME[x.key]).slice(0, 3) + '</span></button>';
        }).join('') +
      '</div><div class="pf-hist__legend"><span><i></i>' + T('Promedio {monto}', { monto: money(avg) }) + '</span><span><i class="is-cur"></i>' + T('Mes en curso') + '</span></div>' +
      '<p class="pf-note">' + T('Toca un mes para verlo.') + '</p>' + compareHTML(v) + '</section>';
  }
  // Comparación simple con el mes anterior: el total y las 3 categorías que
  // más cambiaron, en palabras (sin colores: subió / bajó)
  function compareHTML(v) {
    if (v.report || v.current || !v.mi) return '';
    var a = D.by[v.mi], b = D.by[v.mi - 1], prev = T(MONTHS[v.mi - 1].name);
    var d = a._spend - b._spend;
    var rows = Object.keys(CATS).map(function (k) { return { k: k, d: a[k] - b[k] }; })
      .filter(function (r) { return Math.abs(r.d) >= 5; }).sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); }).slice(0, 3);
    return '<div class="pf-cmp"><p class="pf-cmp__t">' + T('Frente a {mes}', { mes: prev }) + '</p>' +
      '<p class="pf-cmp__lead">' + T(d >= 0 ? 'Gastaste {monto} más' : 'Gastaste {monto} menos', { monto: money(Math.abs(d)) }) + '</p>' +
      rows.map(function (r) {
        return '<div class="pf-cmp__row"><span class="pf-cmp__ic material-symbols-rounded" aria-hidden="true">' + (r.d > 0 ? 'arrow_upward' : 'arrow_downward') + '</span>' +
          '<span>' + T(CATS[r.k].name) + '</span><b>' + (r.d > 0 ? T('+{monto}', { monto: money(r.d) }) : T('−{monto}', { monto: money(-r.d) })) + '</b></div>';
      }).join('') + '</div>';
  }
  // "De cada $10 de tus ingresos…": la forma más simple de leer un mes
  function flowHTML(v) {
    var n = monthNums(v), sp = Math.min(1, n.spend / n.inc), sv = Math.max(0, Math.min(1 - sp, n.save / n.inc));
    var g10 = Math.round(sp * 10), s10 = Math.round(sv * 10);
    var mes = T(MONTH_NAME[v.key]).toLowerCase();
    return '<section class="pf-flow">' +
      '<p class="pf-flow__label">' + T(v.current ? 'Llevas gastado en {mes}' : 'Gastaste en {mes}', { mes: mes }) + '</p>' +
      '<p class="pf-flow__value">' + money(n.spend) + '</p>' +
      (n.partial ? '<p class="pf-flow__sub">' + T('En los primeros {n} días del mes', { n: MONTHS[2].days }) + '</p>' :
      '<div class="pf-flow__bar" role="img" aria-label="' + T('Tus ingresos fueron {a}; gastaste {b} y ahorraste {c}', { a: money(n.inc), b: money(n.spend), c: money(n.save) }) + '">' +
        '<i class="is-spend" style="width:' + (sp * 100).toFixed(1) + '%"></i><i class="is-save" style="width:' + (sv * 100).toFixed(1) + '%"></i></div>' +
      '<div class="pf-flow__keys"><span><i class="is-in"></i>' + T('Ingresos') + '<b>' + money(n.inc) + '</b></span>' +
        '<span><i class="is-spend"></i>' + T('Gastaste') + '<b>' + money(n.spend) + '</b></span>' +
        '<span><i class="is-save"></i>' + T('Ahorraste') + '<b>' + money(n.save) + '</b></span></div>' +
      '<p class="pf-flow__plain">' + T('De cada $ 10 de tus ingresos, gastaste $ {g} y ahorraste $ {s}.', { g: g10, s: s10 }) + '</p>') +
      '</section>';
  }
  // Presupuestos: una frase que resume y un medidor por categoría
  function budgetsHTML(mi) {
    var b = D.by[mi], mo = MONTHS[mi], frac = mo.partial ? mo.days / 31 : 1;
    var ks = Object.keys(CATS).filter(function (k) { return !CATS[k].fixed; })
      .sort(function (x, y) { return b[y] / CATS[y].budget - b[x] / CATS[x].budget; });
    var over = ks.filter(function (k) { return b[k] > CATS[k].budget; });
    var risk = mo.partial ? ks.filter(function (k) { return b[k] / frac > CATS[k].budget; }) : [];
    var next = MONTHS[mi + 1] ? T(MONTHS[mi + 1].name) : T('noviembre');
    var lead = mo.partial
      ? (over.length ? T('Ya te pasaste en {cat}. En lo demás, todavía tienes margen.', { cat: catLow(over[0]) })
        : risk.length ? T('Vas bien, pero a este ritmo te pasarías en {cat}.', { cat: catLow(risk[0]) })
        : T('Vas bien. Deberías terminar el mes dentro de tus presupuestos.'))
      : (over.length ? T('Te pasaste en {n} de {t} presupuestos.', { n: over.length, t: ks.length }) : T('Bien hecho: cerraste el mes dentro de todos tus presupuestos.'));
    return '<section class="pf-sec pf-msec"><div class="pf-msec__head"><p class="pf-msec__label">Presupuestos</p><button class="pf-link" data-pf="budgets">Ajustar</button></div>' +
      '<div class="pf-mcard"><p class="pf-mcard__lead">' + lead +
        (mo.partial ? '<small>' + T('Se renuevan el 1 de {mes}', { mes: next }) + '</small>' : '') + '</p>' +
      ks.map(function (k) {
        var v = b[k], B = CATS[k].budget, p = v / B, o = v > B;
        var tone = o ? 'over' : (mo.partial ? p / frac > 1 : p >= .85) ? 'warn' : 'ok'; // ámbar: a este ritmo te pasarías
        return meterRow({ name: T(CATS[k].name), right: T('{pct} usado', { pct: pct(p) }), p: p, tone: tone, pf: 'cat:' + k + ':' + mi,
          mark: mo.partial ? frac : null,
          sub: (o ? T('Te pasaste {monto}', { monto: money(v - B) }) : T('Te quedan {monto} de {total}', { monto: money(B - v), total: money(B) })) });
      }).join('') + '</div>' +
      (mo.partial ? '<p class="pf-note">' + T('La raya marca hasta dónde deberías ir hoy.') + '</p>' : '') + '</section>';
  }
  // En qué gastaste: parte de tu gasto, en el mismo medidor
  function spendHTML(mi) {
    var all = catTotals(mi), total = D.by[mi]._spend, tc = all.slice(0, 4);
    if (!tc.length) return '';
    return '<section class="pf-sec pf-msec"><p class="pf-msec__label">En qué gastaste</p><div class="pf-mcard">' +
      '<p class="pf-mcard__lead">' + T('{cat} se llevó {pct} de lo que gastaste.', { cat: T(CATS[tc[0].k].name), pct: pct(tc[0].v / total) }) + '</p>' +
      tc.map(function (c) {
        return meterRow({ name: T(CATS[c.k].name), right: money(c.v), p: c.v / total, tone: 'cat', pf: 'cat:' + c.k + ':' + mi,
          sub: T('{pct} de tu gasto', { pct: pct(c.v / total) }) });
      }).join('') +
      (all.length > tc.length ? '<button class="pf-mcard__more" data-pf="breakdown:' + mi + '">' + T('Ver las {n} categorías', { n: all.length }) + '<span class="material-symbols-rounded">chevron_right</span></button>' : '') +
      '</div></section>';
  }

  /* Globo de Uku: a demanda. Un aviso pequeño junto al oso; al tocarlo (o al
     oso) se abre un globo de texto sobre él, de a un mensaje. */
  var say = { list: [], i: 0, open: false };
  function sayFor(v) {
    var out = [];
    if (v.today) {
      var cl = window.Clima && Clima.last();
      var cash = D.accts.filter(function (a) { return a.type === 'ahorro' && a.id !== 'sie1' || a.type === 'corriente' || a.type === 'efectivo'; }).reduce(function (s, a) { return s + a.bal; }, 0);
      out.push({ t: T('Hoy tienes {monto} disponibles entre tus cuentas.', { monto: money(cash) }) + (D.card ? ' ' + T('Tu Mastercard Black tiene {deuda} por pagar; la fecha máxima es el 10 de noviembre.', { deuda: money(D.debt) }) : ''),
        r: (D.card && D.debt ? '<button class="uku-say__reply" data-pf="go:Pagar tarjeta">Pagar tarjeta</button>' : '') + '<button class="uku-say__reply" data-pf="ask:¿Cuánto tengo en total?">¿Cuánto tengo en total?</button>' });
    } else if (v.current && onDemand !== 'ready') {
      out.push(onDemand === 'loading' ? { t: '<span class="pf-spinner"></span> ' + T('Revisando tus movimientos de octubre…') }
        : { t: T('Tu resumen de octubre va a estar listo a inicios de noviembre. ¿Quieres que te cuente cómo vas hasta ahora?'), r: '<button class="uku-say__reply" data-pf="ondemand">Sí, cuéntame</button>' });
    } else {
      var list = v.current ? currentIns() : v.report ? REPORTS[v.key].ins : monthInsights(v.mi);
      list.slice(0, 3).forEach(function (x) {
        out.push({ kind: x.kind, icon: x.icon, t: sentence(x.title, x.sub), r: x.ask ? '<button class="uku-say__reply" data-pf="ask:' + esc(x.ask) + '">' + esc(x.ask) + '</button>' : '' });
      });
    }
    return out;
  }
  /* Estados de ánimo de Uku (como Duo): cambian su gesto y el tono.
     feliz: ahorró y no se pasó · atento: algo para mirar · preocupado: se
     pasó en varias cosas o pagó tarde · tranquilo: nada especial. */
  var MOOD = {
    feliz: { label: 'contento', gesture: 'happy' }, atento: { label: 'atento', gesture: 'think' },
    preocupado: { label: 'preocupado', gesture: 'worried' }, tranquilo: { label: 'tranquilo', gesture: 'wave' }
  };
  function moodFor(v) {
    if (v.today) return D.score >= 70 ? 'feliz' : D.score >= 45 ? 'tranquilo' : 'preocupado';
    if (v.current) return onDemand === 'ready' && currentIns().some(function (x) { return x.kind === 'warn'; }) ? 'atento' : 'tranquilo';
    var n = monthNums(v), rate = n.inc ? n.save / n.inc : 0;
    var over = v.report ? [] : Object.keys(CATS).filter(function (k) { return !CATS[k].fixed && D.by[v.mi][k] > CATS[k].budget; });
    var late = v.report ? REPORTS[v.key].ins.some(function (x) { return x.kind === 'warn' && /tarde/i.test(x.title); }) : D.tx.some(function (t) { return t.late && t.mi === v.mi; });
    if (late || (over.length >= 2 && rate < .08)) return 'preocupado';
    if (over.length || rate < .05) return rate >= .08 || over.length ? 'atento' : 'tranquilo';
    return rate >= .08 ? 'feliz' : 'tranquilo';
  }
  // Lo que Uku dice al lado del oso: un insight corto, no un misterio
  function hintFor(v) {
    var mes = v.today ? '' : T(MONTH_NAME[v.key]).toLowerCase();
    if (v.today) {
      if (D.card && D.debt) return T('No olvides pagar tu tarjeta hasta el 10 de noviembre.');
      return T('Hoy todo en orden');
    }
    if (v.current && onDemand !== 'ready') return T('¿Vemos cómo vas en {mes}?', { mes: mes });
    var n = monthNums(v), rate = n.inc ? n.save / n.inc : 0;
    if (v.current) {
      var proj = n.spend / MONTHS[2].days * 31;
      return proj < D.by[1]._spend ? T('Vas gastando menos que en septiembre') : T('Vas gastando más que en septiembre');
    }
    var over = v.report ? [] : Object.keys(CATS).filter(function (k) { return !CATS[k].fixed && D.by[v.mi][k] > CATS[k].budget; });
    if (moodFor(v) === 'preocupado') {
      var w = (v.report ? REPORTS[v.key].ins : monthInsights(v.mi)).filter(function (x) { return x.kind === 'warn'; })[0];
      if (w) { say.first = 'warn'; return T('Ojo: {texto}', { texto: w.title.charAt(0).toLowerCase() + w.title.slice(1) }); }
    }
    if (rate >= .08 && over.length) { say.first = 'savings'; return T('Ahorraste {monto}, pero ojo con {cat}', { monto: money(n.save).replace(/,00$/, ''), cat: catLow(over[0]) }); }
    if (rate >= .08) { say.first = 'savings'; return T('¡Muy bien! Ahorraste {monto}', { monto: money(n.save).replace(/,00$/, '') }); }
    if (over.length) { say.first = 'warn'; return T('Ojo: te pasaste en {cat}', { cat: catLow(over[0]) }); }
    return T('¿Revisamos cómo te fue en {mes}?', { mes: mes });
  }
  function sayHTML2() {
    var n = say.list.length, m = say.list[say.i] || { t: '' };
    return '<div class="pf-say' + (say.open ? ' is-open' : '') + '">' +
      '<button class="pf-say__hint" data-pf="say:open" aria-label="' + T('Ver lo que te cuenta {nombre}', { nombre: C().name }) + '">' +
        say.hint + '</button>' +
      '<div class="pf-say__bubble" role="dialog" aria-label="' + T('{nombre} te cuenta', { nombre: C().name }) + '" aria-live="polite">' +
        '<button class="pf-say__x" data-pf="say:close" aria-label="Cerrar"><span class="material-symbols-rounded">close</span></button>' +
        '<p class="pf-say__name">' + C().name + (n > 1 ? ' · ' + (say.i + 1) + ' de ' + n : '') + '</p>' +
        '<p class="pf-say__t">' + m.t + '</p>' +
        '<div class="uku-say__replies">' + (m.r || '') +
          (n > 1 && say.i < n - 1 ? '<button class="uku-say__reply uku-say__reply--next" data-pf="say:next">Siguiente</button>' : '') +
          '<button class="uku-say__reply uku-say__reply--ai" data-pf="analyze"><span class="material-symbols-rounded">auto_awesome</span>' + T('Analizar con {nombre}', { nombre: C().name }) + '</button></div>' +
      '</div></div>';
  }
  // Clima en el fondo del héroe: "Quito · 8º" con su icono, sin texto en el globo
  function paintWx() {
    var hero = pf && pf.querySelector('.pf-hero'), cl = window.Clima && Clima.last();
    if (!hero) return;
    var old = hero.querySelector('.pf-wx'); if (old) old.remove();
    if (!cl) return;
    hero.insertAdjacentHTML('beforeend', '<p class="pf-wx" aria-label="' + esc((cl.city || '') + ' ' + cl.temp + ' grados') + '"><span class="material-symbols-rounded" aria-hidden="true">' + cl.icon + '</span>' +
      (cl.city ? esc(cl.city) + ' · ' : '') + cl.temp + '°</p>');
  }
  function paintSay() {
    var hero = pf && pf.querySelector('.pf-hero');
    if (!hero) return;
    var old = hero.querySelector('.pf-say'); if (old) old.remove();
    hero.insertAdjacentHTML('afterbegin', sayHTML2());
  }
  function onSay(k) {
    if (k === 'say:open') { say.open = true; fx('open'); gest(MOOD[moodFor(viewOf(ST.view))].gesture); }
    if (k === 'say:close') { say.open = false; fx('close'); }
    if (k === 'say:next') { say.i = Math.min(say.list.length - 1, say.i + 1); fx('select'); gest('talk'); }
    paintSay();
  }

  function paintDash() {
    var v = viewOf(ST.view), html = '';
    // Título grande; sus acciones (Ajustes) viven en la barra superior
    html += '<header class="pf-head"><h1>Mis finanzas</h1></header>';

    var hs = v.today || v.current ? D.score : v.report ? REPORTS[v.key].score : monthScore(v.mi);
    var mesL = v.today ? '' : T(MONTH_NAME[v.key]).toLowerCase();
    say.first = null; hintFor(v); // decide qué tema va primero
    if (v.today) {
      // Hoy: el oso y su entorno, con su globo a demanda
      html += heroHTML(hs, '') + healthHTML(hs) + todayHTML();
    } else {
      // Los meses: Uku como bloque de información, sin el oso grande
      html += ukuBlock(v) + flowHTML(v) + healthHTML(hs, v.current ? T('octubre, hasta hoy') : mesL) + histHTML(v);
      if (v.report) {
        html += '<section class="pf-sec"><p class="pf-note pf-note--box">' + T('De {mes} solo tenemos este resumen. El detalle de cada movimiento lo tienes desde agosto.', { mes: mesL }) + '</p></section>';
      } else if (v.current) {
        html += budgetsHTML(2) + recordsHTML(2);
      } else {
        html += budgetsHTML(v.mi) + spendHTML(v.mi) + goalsHTML() + recordsHTML(v.mi);
      }
    }
    html += footHTML();
    // Conserva el nodo del héroe con el lienzo vivo (sin parpadeo al cambiar de mes)
    var scroll = pf.querySelector('.pf-scroll'), old = scroll.querySelector('.pf-hero'), live = old && old.querySelector('canvas');
    // Las pestañas de meses son el mismo componente de Inicio (.tabs > .tabs__scroll > .tab):
    // un nodo persistente que solo cambia la pestaña activa
    var row = pf.querySelector('.pf-tabs');
    if (!row) { row = document.createElement('nav'); row.className = 'tabs pf-tabs'; row.setAttribute('aria-label', T('Meses'));
      row.innerHTML = '<div class="tabs__scroll">' + VIEWS.map(function (x) {
        return '<button class="tab" data-pf="view:' + x.key + '">' + T(MONTH_NAME[x.key] || x.short) + '</button>'; }).join('') + '</div>'; }
    row.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.pf === 'view:' + v.key); });
    var changed = paintDash.lastKey && paintDash.lastKey !== v.key;
    paintDash.lastKey = v.key;
    scroll.innerHTML = html;
    var head = scroll.querySelector('.pf-head'); if (head) head.after(row); else scroll.prepend(row);
    if (changed) {
      // Igual que Inicio: el contenido sube suavemente; título y pestañas no se mueven
      scroll.classList.remove('is-switch'); void scroll.offsetWidth; scroll.classList.add('is-switch');
      // Si ya estaba abajo, se queda con las pestañas fijas arriba (como en Inicio)
      // (el punto natural de las pestañas es justo debajo del título)
      var stick = (head ? head.getBoundingClientRect().bottom : row.getBoundingClientRect().top) + window.scrollY - (parseFloat(getComputedStyle(row).top) || 0);
      if (window.scrollY > stick) window.scrollTo({ top: stick });
    }
    var fresh = scroll.querySelector('.pf-hero');
    if (fresh) fresh.querySelector('.b3d').dataset.g = JSON.stringify('wave');
    if (live && fresh) {
      var ob = old.querySelector('.b3d'), nb = fresh.querySelector('.b3d');
      ob.dataset.score = nb.dataset.score; ob.dataset.g = nb.dataset.g;
      old.querySelector('.pf-hero__badge').innerHTML = fresh.querySelector('.pf-hero__badge').innerHTML;
      fresh.replaceWith(old);
    }
    // El globo se rehace con lo de este mes; si cambió de mes, se cierra
    if (say.view !== v.key) { say.open = false; say.i = 0; say.view = v.key; }
    say.first = null; say.list = v.today ? sayFor(v) : []; say.hint = hintFor(v);
    // El globo abre con el mismo tema del aviso
    if (say.first) say.list.sort(function (a, b) { var m = function (x) { return say.first === 'savings' ? x.icon === 'savings' : x.kind === 'warn'; }; return m(b) - m(a); }); say.i = Math.min(say.i, Math.max(0, say.list.length - 1));
    if (v.today) { paintSay(); paintWx(); syncHero(); }
    // Igual que Inicio: la pestaña elegida se centra con un desplazamiento suave
    var sel = row.querySelector('.tab.active');
    if (sel) sel.scrollIntoView({ behavior: changed ? 'smooth' : 'auto', inline: 'center', block: 'nearest' });
  }
  var regCat = 'super';
  function budgetSheet() {
    var ks = Object.keys(CATS).filter(function (k) { return !CATS[k].fixed; });
    showSheet('<h3>Ajustar presupuestos</h3><p>' + T('Cuánto quieres gastar al mes en cada categoría. {nombre} te avisa cuando te estés acercando al límite.', { nombre: C().name }) + '</p>' +
      '<div class="pf-steps">' + ks.map(function (k) {
        return '<div class="pf-step"><span>' + T(CATS[k].name) + '</span>' +
          '<button class="pf-step__btn" data-sheet="bud:' + k + ':-10" aria-label="Bajar $ 10"><span class="material-symbols-rounded">remove</span></button>' +
          '<b>' + money(CATS[k].budget) + '</b>' +
          '<button class="pf-step__btn" data-sheet="bud:' + k + ':10" aria-label="Subir $ 10"><span class="material-symbols-rounded">add</span></button></div>';
      }).join('') + '</div><button class="pf-cta" data-sheet="close">Listo</button>');
  }
  function recordSheet() {
    var ks = Object.keys(CATS).filter(function (k) { return !CATS[k].fixed; });
    showSheet('<h3>Registrar un gasto</h3><p>Anota lo que pagas en efectivo para que tu resumen y tus presupuestos estén completos.</p>' +
      '<label class="pf-field"><span>Monto</span><input type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00" data-reg="amt"></label>' +
      '<label class="pf-field"><span>Descripción</span><input type="text" maxlength="40" placeholder="Ej. Almuerzo" data-reg="who"></label>' +
      '<p class="as-sheet__label">Categoría</p><div class="pf-catchips">' + ks.map(function (k) {
        return '<button class="pf-catchip" data-sheet="regcat:' + k + '" aria-pressed="' + (k === regCat) + '">' + T(CATS[k].name) + '</button>';
      }).join('') + '</div><button class="pf-cta" data-sheet="reg:save">Guardar</button>');
  }

  /* Mes en curso: liviano y sólo a pedido */

  function onPF(e) {
    var b = e.target.closest('[data-pf]');
    // Tocar al oso abre (o cierra) su globo de texto
    // Tocar a Uku: si el globo está cerrado lo abre; si está abierto, hace un gesto (no lo cierra)
    if (!b && e.target.closest('.pf-hero .b3d')) {
      if (!say.open) return onSay('say:open');
      var pose = ['happy', 'wave', 'nod'][Math.floor(Math.random() * 3)];
      fx('select'); gest(pose); return;
    }
    if (!b) return;
    return pfKey(b.dataset.pf);
  }
  // Acciones de Mis finanzas por clave (también las usa el análisis de Uku)
  function pfKey(k) {
    if (k === 'repaint') return paintPF();
    if (k.indexOf('say:') === 0) return onSay(k);
    if (k === 'settings') return openSheet('settings');
    if (k === 'ask' || k === 'analyze') return analyze();
    if (k === 'health') return healthSheet();
    if (k === 'accounts') return accountsSheet();
    if (k === 'budgets') return budgetSheet();
    if (k === 'connect') return connectSheet();
    if (k.indexOf('ask:') === 0) return analyze(k.slice(4));
    if (k.indexOf('go:') === 0) {
      var ga = k.slice(3), gb = document.querySelector('#home-page [data-action="' + ga + '"]') || document.querySelector('[data-action="' + ga + '"]');
      if (gb) gb.click();
      return;
    }
    if (k.indexOf('card:') === 0) {
      var cr = document.querySelector('#home-page [data-panel="Tarjetas"] .product-row[data-action="' + k.slice(5) + '"]');
      if (cr) cr.click();
      return;
    }
    if (k === 'record') return recordSheet();
    if (k === 'alltx') return allTxSheet('all');
    if (k === 'ondemand') {
      onDemand = 'loading'; paintPF(); fx('select');
      setTimeout(function () { onDemand = 'ready'; paintPF(); fx('reveal'); }, 900);
      return;
    }
    if (k.indexOf('view:') === 0) { ST.view = k.slice(5); persist(); fx('select'); paintPF(); return; }
    if (k.indexOf('breakdown:') === 0) return breakdownSheet(+k.slice(10));
    if (k.indexOf('cat:') === 0) { var p = k.split(':'); return catSheet(p[1], +p[2]); }
    if (k.indexOf('det:') === 0) return detailSheet(curIns[+k.slice(4)].det);
    if (k.indexOf('why:') === 0) return analyze(curIns[+k.slice(4)].ask);
  }
  function doAction(id) {
    var before = D.score, m = ST.mods, msg;
    if (id === 'save50') { m.extraSave += 50; msg = T('Listo. Desde el próximo mes se van a pasar {monto} más a tus metas cada día 2.', { monto: money(50) }); }
    if (id === 'payLate') { m.paidLate = true; m.paidLateAmt += 18.35; msg = T('Listo, pagaste el agua. Ya no tienes nada atrasado.'); }
    if (id === 'payCard') { m.ccPaid += 200; msg = T('Listo, abonaste {monto} a tu Mastercard Black desde tu cuenta PRINCIPAL.', { monto: money(200) }); }
    if (id === 'efund100') { m.efund += 100; msg = T('Listo, pasaste {monto} a tu fondo de emergencia.', { monto: money(100) }); }
    if (id === 'autopay') { m.autopay = true; msg = T('Listo, activaste el pago automático. Tus servicios se pagan solos el día que vencen.'); }
    persist(); build();
    fx(D.score > before ? 'success' : 'select');
    paintPF(); paintEntries();
    if (D.score > before) setTimeout(function () { gest('happy'); }, 500);
    toast(msg + (D.score > before ? ' ' + T('Tu salud financiera subió a {n}.', { n: D.score }) : ''));
  }
  var toastT;
  function toast(t) {
    var el = document.querySelector('.pf-toast');
    if (!el) { el = document.createElement('div'); el.className = 'pf-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  /* Tercera capa: el detalle vive en hojas, sólo cuando se pide */
  function catSheet(k, mi) {
    var list = sortedTx(function (t) { return t.cat === k && t.mi === mi; }), by = {};
    list.forEach(function (t) { by[t.who] = (by[t.who] || 0) + t.amt; });
    showSheet('<h3>' + T(CATS[k].name) + '</h3><p>' + T('{monto} en {mes}. Normalmente gastas unos {habitual} al mes.', { monto: money(D.by[mi][k]), mes: T(MONTHS[mi].name), habitual: money(HAB[k] || 0) }) + '</p>' +
      bars(Object.keys(by).map(function (w) { return { label: w, v: by[w] }; }).sort(function (a, b) { return b.v - a.v; })) +
      '<p class="as-sheet__label">Movimientos</p><div class="pf-sheet-list">' + list.map(txRow).join('') + '</div>');
  }
  function breakdownSheet(mi) {
    var rows = catTotals(mi), total = D.by[mi]._spend;
    showSheet('<h3>' + T('En qué gastaste en {mes}', { mes: T(MONTHS[mi].name) }) + '</h3><p>Toca una categoría para ver sus movimientos.</p>' +
      '<div class="pf-donut-wrap">' + donut(rows, total) + '<span><small>Gastaste</small><b>' + money(total) + '</b></span></div>' +
      '<div class="pf-legend">' + rows.map(function (r, i) {
        return '<button class="pf-legend__row" data-sheet="cat:' + r.k + ':' + mi + '"><i style="background:' + NEUTRAL[Math.min(i, 4)] + '"></i><span>' + CATS[r.k].name + '</span><b>' + money(r.v) + '</b><small>' + pct(r.v / total) + '</small></button>';
      }).join('') + '</div>');
  }
  function detailSheet(det) {
    var p = det.split(':');
    if (p[0] === 'cat') return catSheet(p[1], +p[2]);
    if (p[0] === 'late') {
      return showSheet('<h3>' + T('Agua') + ' · ' + T(MONTHS[+p[1]].name) + '</h3><p>Cuando pagas un servicio tarde, te cobran un recargo y puede quedar en tu historial.</p>' +
        '<div class="as-stats">' + stat('Vencía', '7 sep') + stat('Lo pagaste', '12 sep') + stat('Monto', money(18.35)) + stat('Recargo', money(1.5)) + '</div>' +
        (ST.mods.autopay ? '<p class="as-note" style="margin-top:16px">Ya tienes el pago automático activo.</p>' : '<button class="pf-cta" data-sheet="act:autopay">Activar pago automático</button>'));
    }
    if (p[0] === 'card') {
      var mi = +p[1], int = cardInterest(mi), owed = acctOf('and1').base * D.sc.debt;
      return showSheet('<h3>Mastercard Black · ' + T(MONTHS[mi].name) + '</h3><p>Si pagas solo el mínimo, lo que queda te genera intereses el mes siguiente.</p>' +
        '<div class="as-stats">' + stat('Saldo al corte', money(owed)) + stat('Pago mínimo', money(Math.max(25, owed * .05))) + stat('Pagaste', money(Math.max(25, owed * .05))) + stat('Intereses', money(int)) + '</div>' +
        '<button class="pf-cta" data-sheet="act:payCard">Abonar $ 200 ahora</button>');
    }
  }
  function healthSheet() {
    var lv = level(D.score);
    showSheet('<h3>' + T('Salud financiera {n}/100', { n: D.score }) + '</h3><p>' + T(lv.n) + '. ' + T('Se calcula con estos cinco hábitos; mientras mejor te va, más crece el bosque de {nombre}.', { nombre: C().name }) + '</p><div class="pf-health">' +
      Object.keys(D.f).map(function (k) {
        var f = D.f[k];
        return '<div class="pf-pillar"><div class="pf-pillar__top"><span class="as-row__icon material-symbols-rounded">' + f.icon + '</span><span class="pf-row__main"><b>' + f.label + '</b><small' + (f.ok ? '' : ' class="is-warn"') + '>' + f.val + '</small></span>' +
          '<span class="pf-meter"><i style="width:' + Math.round(f.v * 100) + '%"></i></span></div><p>' + f.tip + '</p>' +
          (f.act && f.act.id.indexOf('cat:') !== 0 ? '<button class="pf-btn" data-sheet="act:' + f.act.id + '">' + f.act.label + '</button>' : '') + '</div>';
      }).join('') + '</div>');
  }
  // Lo que cuenta en el análisis: cuentas y, aparte, depósitos, préstamos y seguros.
  // Por ahora las cuentas son de Pichibank; las de otros bancos vendrán después.
  var EXTRAS = [
    { id: 'dep1', name: 'Depósito a plazo', sub: 'Vence el 12 de nov', amt: 3000, icon: 'trending_up' },
    { id: 'prest1', name: 'Préstamo de consumo', sub: 'Cuota 6 de 36', amt: -7380.5, icon: 'real_estate_agent' },
    { id: 'seg1', name: 'Seguros', sub: 'Vida y protección de tarjetas', amt: -16.4, icon: 'shield' }
  ];
  function isIncl(id) { return ST.off.indexOf(id) < 0; }
  function toggleIncl(id) {
    var i = ST.off.indexOf(id);
    if (i >= 0) ST.off.splice(i, 1); else ST.off.push(id);
    persist(); build(); paintPF(); paintEntries(); fx('toggle');
  }
  function inclRow(id, icon, name, sub, val) {
    var on = isIncl(id);
    return '<button class="pf-row pf-row--incl' + (on ? '' : ' is-off') + '" data-sheet="incl:' + id + '" aria-pressed="' + on + '">' +
      '<span class="pf-av" aria-hidden="true"><span class="material-symbols-rounded">' + icon + '</span></span>' +
      '<span class="pf-row__main"><b>' + name + '</b><small>' + sub + '</small></span>' +
      '<span class="pf-row__val">' + val + '<span class="pf-switch" aria-hidden="true"></span></span></button>';
  }
  function accountsSheet() {
    var all = ACCTS.filter(function (a) { return connected(a.bank); });
    var rows = all.map(function (a) {
      var live = D.accts.filter(function (x) { return x.id === a.id; })[0] || a; // saldos ya calculados
      var v = a.type === 'credito' ? '<b>-' + money(Math.abs(live.owed || 0)) + '</b>' : '<b>' + money(live.bal) + '</b>';
      return inclRow(a.id, a.type === 'credito' ? 'credit_card' : 'account_balance_wallet', a.name, BANKS[a.bank].name + (a.mask ? ' ··' + a.mask : ''), v);
    }).join('') + EXTRAS.map(function (x) {
      return inclRow(x.id, x.icon, x.name, x.sub, '<b>' + money(x.amt) + '</b>');
    }).join('');
    showSheet('<h3>' + T('Cuentas conectadas') + '</h3>' +
      '<p>' + T('Elige qué cuentas y productos quieres que Uku analice. Lo que apagues no cuenta en tus saldos, en tus gastos ni en tus recomendaciones.') + '</p>' +
      '<div class="pf-card pf-card--flat">' + rows + '</div>' +
      '<button class="pf-cta" data-sheet="connect">' + T('Conectar otra cuenta') + '</button>' +
      '<button class="pf-link pf-link--block" data-sheet="tx:all">' + T('Ver movimientos de todas las cuentas') + '</button>');
  }
  function allTxSheet(acct) {
    var ids = D.accts.map(function (a) { return a.id; });
    var list = sortedTx(function (t) { return acct === 'all' || t.acct === acct; });
    showSheet('<h3>Movimientos</h3><p>Últimos 3 meses en todas tus cuentas.</p>' +
      '<div class="as-chips pf-chips"><button class="as-chip" data-sheet="tx:all" aria-pressed="' + (acct === 'all') + '">Todas</button>' +
      ids.map(function (id) { var a = acctOf(id); return '<button class="as-chip" data-sheet="tx:' + id + '" aria-pressed="' + (acct === id) + '">' + BANKS[a.bank].name + (a.mask ? ' ··' + a.mask : '') + '</button>'; }).join('') + '</div>' +
      '<div class="pf-sheet-list">' + list.slice(0, 60).map(txRow).join('') + '</div>');
  }
  function connectSheet() {
    var avail = Object.keys(BANKS).filter(function (k) { return !BANKS[k].own; });
    showSheet('<h3>Conectar una cuenta</h3><p>Suma tus otros bancos y mira toda tu plata en un solo lugar. Solo vemos saldos y movimientos; no podemos mover tu dinero.</p><div class="as-rows">' +
      avail.map(function (k) {
        var on = ST.linked.indexOf(k) >= 0;
        return '<button class="as-row as-row--btn" data-sheet="' + (on ? 'unlink:' : 'link:') + k + '">' + bankAv(k) + '<span class="as-row__main"><b>' + BANKS[k].name + '</b><small>' + BANKS[k].what + '</small></span>' +
          '<span class="pf-tag' + (on ? ' is-on' : '') + '">' + (on ? 'Conectada' : BANKS[k].manual ? 'Agregar' : 'Conectar') + '</span></button>';
      }).join('') + '</div>');
  }
  function consentSheet(k) {
    if (BANKS[k].manual) return finishLink(k);
    showSheet('<div class="pf-consent">' + bankAv('pb') + '<span class="pf-consent__link"></span>' + bankAv(k) + '</div>' +
      '<h3>' + T('Pichibank quiere ver tu {producto} de {banco}', { producto: T(BANKS[k].what).toLowerCase(), banco: BANKS[k].name }) + '</h3>' +
      '<div class="as-rows">' +
        '<div class="as-row"><span class="as-row__icon material-symbols-rounded">visibility</span><span class="as-row__main"><b>Saldos y movimientos</b><small>De los últimos 3 meses, actualizados una vez al día</small></span></div>' +
        '<div class="as-row"><span class="as-row__icon material-symbols-rounded">block</span><span class="as-row__main"><b>No puede mover tu dinero</b><small>Ni pagar, ni transferir, ni ver tus claves</small></span></div>' +
        '<div class="as-row"><span class="as-row__icon material-symbols-rounded">link_off</span><span class="as-row__main"><b>Lo desconectas cuando quieras</b><small>Desde esta misma pantalla</small></span></div>' +
      '</div><button class="pf-cta" data-sheet="auth:' + k + '">' + T('Continuar en {banco}', { banco: BANKS[k].name }) + '</button>');
  }
  function finishLink(k) {
    showSheet('<div class="pf-linking"><span class="pf-spinner"></span><h3>' + T('Conectando con {banco}…', { banco: BANKS[k].name }) + '</h3><p>Estamos trayendo tus movimientos de los últimos 3 meses.</p></div>');
    setTimeout(function () {
      ST.linked.push(k); persist(); build(); paintPF(); paintEntries();
      var n = D.tx.filter(function (t) { var a = acctOf(t.acct); return a.bank === k; }).length;
      fx('success');
      showSheet('<div class="pf-linking"><span class="pf-done material-symbols-rounded">check</span><h3>' + T('{banco} conectado', { banco: BANKS[k].name }) + '</h3><p>' +
        (BANKS[k].manual ? T('Anota tus gastos en efectivo y los sumamos al resto.') : T('Listo, sumamos {n} movimientos. Tu salud financiera ahora es {score}.', { n: n, score: D.score })) + '</p>' +
        '<button class="pf-cta" data-sheet="close">Listo</button></div>');
    }, 1400);
  }
  function onSheetPF(b) {
    var k = b.dataset.sheet;
    if (k === 'close') return closeSheet();
    if (k.indexOf('tx:') === 0) return allTxSheet(k.slice(3));
    if (k.indexOf('bud:') === 0) {
      var bp = k.split(':'), st = sheet.scrollTop;
      ST.budgets = ST.budgets || {};
      ST.budgets[bp[1]] = Math.max(10, CATS[bp[1]].budget + +bp[2]);
      persist(); build(); paintPF(); paintEntries(); fx('select');
      budgetSheet(); sheet.scrollTop = st;
      return;
    }
    if (k.indexOf('regcat:') === 0) {
      regCat = k.slice(7); fx('select');
      sheet.querySelectorAll('[data-sheet^="regcat:"]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      return;
    }
    if (k === 'reg:save') {
      var ai = sheet.querySelector('[data-reg="amt"]'), amt = parseFloat(String(ai.value).replace(',', '.'));
      if (!(amt > 0)) { ai.focus(); ai.classList.add('is-error'); return; }
      var who = sheet.querySelector('[data-reg="who"]').value.trim() || T('Gasto en efectivo');
      ST.manual = (ST.manual || []).concat([{ mi: 2, day: MONTHS[2].days, cat: regCat, who: who, amt: +amt.toFixed(2), acct: 'efe1' }]);
      ST.view = 'oct'; if (!onDemand) onDemand = 'ready';
      persist(); build(); closeSheet(); paintPF(); paintEntries(); fx('success');
      toast(T('Listo, registraste {monto} en {cat}.', { monto: money(amt), cat: catLow(regCat) }));
      return;
    }
    if (k === 'connect') return connectSheet();
    if (k.indexOf('act:') === 0) { closeSheet(); return doAction(k.slice(4)); }
    if (k.indexOf('incl:') === 0) { toggleIncl(k.slice(5)); return accountsSheet(); }
    if (k.indexOf('cat:') === 0) { var p = k.split(':'); return catSheet(p[1], +p[2]); }
    if (k.indexOf('link:') === 0) return consentSheet(k.slice(5));
    if (k.indexOf('auth:') === 0) return finishLink(k.slice(5));
    if (k.indexOf('unlink:') === 0) {
      var bank = k.slice(7);
      ST.linked = ST.linked.filter(function (x) { return x !== bank; }); persist(); build(); paintPF(); paintEntries(); fx('toggle');
      return connectSheet();
    }
  }

  // Mis finanzas es una sección: "abrirla" es ir a su pestaña
  function openPF() {
    if (!pf) mountPF();
    paintPF(); if (window.__goView) window.__goView(1);
  }

  /* El arrastre para cerrar las hojas vive en assets/sheets.js (común a toda la app). */
  function init() {
    build(); mountEntries(); paintEntries();
    if (window.Clima) Clima.onChange(function (c) {
      if (c && b3d) b3d.setLook(c.look);
      climaPainted = c; if (pf && viewOf(ST.view).today) paintPF();
    });
    var fv = document.querySelector('.view[data-view="1"]');
    if (fv && fv.querySelector('.pf-host')) {
      mountPF(); paintPF();
      new MutationObserver(function () { if (fv.classList.contains('active')) syncHero(); }).observe(fv, { attributes: true, attributeFilter: ['class'] });
    }
    // Al cambiar de idioma: lo que se arma con T() se vuelve a pintar
    document.addEventListener('i18n:change', function () {
      insCache = {}; paintEntries();
      if (page && page.classList.contains('open')) paintAll();
      if (pf && pf.classList.contains('open')) paintPF();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  // "Analizar con Uku" (IA): el análisis del mes que estás mirando
  function analyze(q) {
    var v = viewOf(ST.view);
    if (v.today) v = viewOf('sep'); // desde Hoy se analiza el último mes cerrado
    if (window.UkuAnalisis) UkuAnalisis.open({ view: v.key, ask: q });
  }
  // Datos del mes para el análisis (todo calculado aquí; la IA lo redacta)
  function monthPack(key) {
    var v = viewOf(key), n = monthNums(v), mes = T(MONTH_NAME[v.key]).toLowerCase();
    if (v.current && onDemand !== 'ready') onDemand = 'ready';
    var ins = v.current ? currentIns() : v.report ? REPORTS[v.key].ins : monthInsights(v.mi);
    var over = v.report ? [] : Object.keys(CATS).filter(function (k) { return !CATS[k].fixed && D.by[v.mi][k] > CATS[k].budget; })
      .map(function (k) { return { k: k, name: T(CATS[k].name), over: D.by[v.mi][k] - CATS[k].budget, budget: CATS[k].budget }; });
    var top = v.report ? [] : catTotals(v.mi).slice(0, 3).map(function (c) { return { name: T(CATS[c.k].name), v: c.v, p: c.v / n.spend }; });
    var closed = VIEWS.filter(function (x) { return !x.today && !x.current; }).map(function (x) { return monthNums(x).spend; });
    var avg = closed.reduce(function (a, b) { return a + b; }, 0) / closed.length;
    return { key: v.key, mes: mes, Mes: T(MONTH_NAME[v.key]), current: !!v.current, report: !!v.report, n: n, ins: ins, over: over, top: top, avg: avg,
      mood: moodFor(v), moodLabel: T(MOOD[moodFor(v)].label), hint: (say.first = null, hintFor(v)), score: v.today || v.current ? D.score : v.report ? REPORTS[v.key].score : monthScore(v.mi),
      card: D.card ? { debt: D.debt, interest: v.mi != null ? cardInterest(v.mi) : 0 } : null, goals: D.goals, txCount: v.report ? 0 : D.tx.filter(function (t) { return t.mi === v.mi; }).length };
  }
  window.Asistente = {
    answer: function (q) { return answer(q); }, pack: monthPack, pf: function (k) { return pfKey(k); }, money: money, analyze: analyze, petSVG: function () { return C().svg(); }, faceIMG: function () { return C().face(); }, name: function () { return C().name; }, open: function (o) { analyze(o && o.ask); }, openPF: function () { openPF(); }, ask: function (q) { analyze(q); }, data: function () { return D; },
    insights: function () { return monthInsights(lastClosedMi()); }, included: isIncl, settings: function () { openSheet('settings'); } };
})();
