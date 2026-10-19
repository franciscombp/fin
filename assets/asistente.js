/* =====================================================================
   Datos y motor de respuestas de Uku, el oso andino (API: window.Asistente)
   Mis finanzas vive en assets/pfm.js; el análisis con IA en assets/analisis.js.
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

  var CHARS = {
    // Uku (de ukuku/ukumari, oso andino en quechua). Un solo personaje:
    // el oso no cambia; cambia el bosque donde vive.
    uku: { name: 'Uku', role: 'Tu oso de las finanzas',
      face: function () { return '<img class="as-oso as-oso--cara" src="' + ASSET + 'oso/oso-cara.webp" alt="" draggable="false">'; } }
  };
  function C() { return CHARS.uku; }

  /* Ruta de los recursos (imágenes del oso) */
  var ASSET = (document.currentScript && document.currentScript.src || location.href).replace(/[^/]*$/, '');

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
      presupuesto: { v: 1 - Math.min(1, overCats.length / 3), label: 'Presupuesto', icon: 'pie_chart', ok: !overCats.length, val: overCats.length ? T('Excediste en {n}', { n: overCats.length }) : T('Todo en orden'),
        tip: overCats.length ? T('Excediste el presupuesto en {cats}. Si vuelves a lo presupuestado, tu salud sube.', { cats: list(overCats.map(catLow)) }) : T('En septiembre no excediste el presupuesto en nada.'),
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
    if (/^(hola|buenas|buenos|hey|que tal)\b/.test(s)) return { t: T('Hola, ¿qué tal? Cuéntame qué quieres revisar. Te puedo decir en qué se te está yendo la plata, cómo vas con tus metas o en qué excediste tu presupuesto.'),
      s: ['¿En qué gasto más?', '¿Cómo voy con mis metas?', '¿En qué me pasé?'] };
    if (OLD.test(s)) return reports(s);
    if (/tarde|atras|recargo|vencid/.test(s)) {
      return { t: D.lateN ? T('En septiembre pagaste el agua 5 días tarde y te cobraron {monto} de recargo. Si activas el pago automático, se paga solito el día que vence y no te vuelve a pasar.', { monto: money(1.5) })
        : T('Tranquilo, en los últimos 3 meses pagaste todo a tiempo. Si algún día se te olvida una fecha, te pueden cobrar un recargo y eso queda en tu historial.'),
        s: ['¿Cuánto pago en servicios?', '¿Cómo voy en general?'] };
    }
    if (/interes/.test(s)) {
      var i1 = cardInterest(0), i2 = cardInterest(1);
      return { t: (i1 + i2) ? T('Entre agosto y septiembre pagaste {monto} de intereses en tu Mastercard Black, porque solo pagaste el mínimo. Si pagas el total antes de la fecha de corte, no te cobran intereses.', { monto: money(i1 + i2) })
        : T('Nada. Estos meses no pagaste intereses en tus tarjetas. ¡Muy bien!'),
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
        s: ['¿En qué gasto más?', 'Mis suscripciones'] };
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
        s: ['¿En qué gasto más?', '¿En qué me pasé?'] };
    }
    if (/presupuesto|pase|exced|limite|tope/.test(s)) {
      return { t: D.overCats.length ? T('Excediste el presupuesto en <b>{cats}</b>. En lo demás vas bien.', { cats: list(D.overCats.map(catLow)) }) : T('En septiembre no excediste el presupuesto en nada. ¡Todo dentro del presupuesto!'),
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
      s: ['¿En qué gasto más?', '¿Cómo voy con mis metas?', '¿Cuánto más puedo ahorrar?'] };
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
      ['Abr', 'Ahorraste el 5%', 'excediste el presupuesto', 39 + base[0] * 3]
    ];
    return { t: T('El detalle de cada movimiento lo tengo solo desde agosto. De los meses anteriores te puedo mostrar un resumen:'),
      h: '<div class="as-report">' + rows.map(function (r) {
          return '<div class="as-report__row"><b>' + T(r[0]) + '</b><span>' + T(r[1]) + ', ' + T(r[2]) + '</span><em>' + r[3] + '</em></div>';
        }).join('') + '</div><p class="as-note">' + T('El número es tu salud financiera de ese mes.') + '</p>',
      s: ['¿Cómo voy en general?', 'Septiembre vs. agosto'] };
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
  }

  /* Datos de apoyo para el análisis del mes (monthPack): cuentas,
  categorías, cifras, ánimo y frase de Uku. Mis finanzas vive en assets/pfm.js. */
  function acctOf(id) { return ACCTS.filter(function (a) { return a.id === id; })[0]; }
  function catTotals(mi) {
    var b = D.by[mi];
    return Object.keys(CATS).map(function (k) { return { k: k, v: b[k] }; }).filter(function (c) { return c.v > 0; }).sort(function (a, b) { return b.v - a.v; });
  }
  var onDemand = null;
  function currentIns() {
    var o = D.by[2], day = MONTHS[2].days, proj = o._spend / day * 31, prev = D.by[1]._spend, out = [];
    out.push({ kind: 'info', icon: 'speed', title: T('Si sigues así, cerrarías octubre en {monto}', { monto: money(proj) }),
      sub: proj > prev ? T('Eso es {monto} más que en septiembre.', { monto: money(proj - prev) }) : T('Eso es {monto} menos que en septiembre.', { monto: money(prev - proj) }), ask: '¿En qué gasto más?' });
    var hot = Object.keys(CATS).filter(function (k) { return !CATS[k].fixed && o[k] / CATS[k].budget > day / 31 + .15; })
      .sort(function (a, b) { return o[b] / CATS[b].budget - o[a] / CATS[a].budget; })[0];
    if (hot) out.push({ kind: 'warn', icon: 'pie_chart', title: T('Ya usaste el {pct} de tu presupuesto de {cat}', { pct: pct(o[hot] / CATS[hot].budget), cat: catLow(hot) }),
      sub: T('Y apenas vamos por el {pct} del mes.', { pct: pct(day / 31) }), det: 'cat:' + hot + ':2' });
    var next = [];
    ['servicios', 'subs'].forEach(function (k) { CATS[k].fixed.forEach(function (p, i) { var d = 3 + i * 4; if (d > day && d <= day + 7) next.push({ who: p[0], amt: p[1], d: d }); }); });
    if (next.length) out.push({ kind: 'info', icon: 'event', title: T('Esta semana vencen pagos por {monto}', { monto: money(next.reduce(function (s, n) { return s + n.amt; }, 0)) }),
      sub: next.map(function (n) { return T(n.who) + ' (' + n.d + ' ' + T('oct') + ')'; }).join(', ') + '.' });
    return out;
  }

  var MONTH_NAME = { jun: 'Junio', jul: 'Julio', ago: 'Agosto', sep: 'Septiembre', oct: 'Octubre', hoy: 'Hoy' };
  // Cada mes, en cifras simples: lo que entró, lo que gastaste y lo que ahorraste
  function monthNums(v) {
    if (v.report) { var r = REPORTS[v.key]; return { spend: r.spend, save: r.save, inc: Math.round(r.save / r.rate) }; }
    var b = D.by[v.mi]; return { spend: b._spend, save: b._save, inc: b._in, partial: !!v.current };
  }
  var say = { first: null };
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
    if (over.length) { say.first = 'warn'; return T('Ojo: excediste el presupuesto en {cat}', { cat: catLow(over[0]) }); }
    return T('¿Revisamos cómo te fue en {mes}?', { mes: mes });
  }
  function isIncl(id) { return ST.off.indexOf(id) < 0; }

  // Mis finanzas es una sección (assets/pfm.js): "abrirla" es ir a su pestaña
  function openPF() { if (window.PFM) PFM.open(); }

  function init() {
    build(); mountEntries(); paintEntries();
    // Al cambiar de idioma: lo que se arma con T() se vuelve a pintar
    document.addEventListener('i18n:change', function () { insCache = {}; paintEntries(); });
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
    // Con el PFM, Uku responde y analiza con sus datos (si no sabe, o aún no cargan, usa el motor de aquí)
    answer: function (q) { return (window.PFM && PFM.answer(q)) || answer(q); }, pack: function (k) { return window.PFM && PFM.ready() ? PFM.pack(k) : monthPack(k); },
    pf: function (k) { if (!window.PFM) return; if (k === 'repaint') return PFM.paint(); return PFM.key(k); }, money: money, faceIMG: function () { return C().face(); }, name: function () { return C().name; }, open: function (o) { analyze(o && o.ask); }, openPF: function () { openPF(); }, ask: function (q) { analyze(q); }, data: function () { return D; },
    insights: function () { return monthInsights(lastClosedMi()); }, included: isIncl, settings: function () { if (window.PFM) PFM.settings(); } };
})();
