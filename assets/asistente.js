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
  var ST = { who: 'candado', scenario: 'normal', linked: [], view: 'sep', mods: { extraSave: 0, paidLate: false, paidLateAmt: 0, ccPaid: 0, efund: 0, autopay: false } };
  try { var saved = JSON.parse(localStorage.getItem(KEY)); if (saved) ST = Object.assign(ST, saved); } catch (e) {}
  // La tarjeta de crédito ahora es de Pichibank (antes "Banco Andino", externo)
  ST.linked = (ST.linked || []).filter(function (b) { return b !== 'andino'; });
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
    if (!b3dP) b3dP = import(ASSET + 'bosque3d.js').then(function (m) { b3d = m.supported() ? m : null; return b3d; }).catch(function () { return null; });
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
    var assets = accts.filter(function (a) { return a.type !== 'credito'; }).reduce(function (s, a) { return s + a.bal; }, 0);
    var card = accts.filter(function (a) { return a.type === 'credito'; })[0];
    var debt = card ? card.owed : 0, util = card ? debt / card.limit : 0;
    var avgSpend = (by[0]._spend + by[1]._spend) / 2;
    var cushion = goals[0].have + (connected('sierra') ? acctOf('sie1').bal : 0);
    var months = cushion / avgSpend;

    var sep = by[1], overCats = Object.keys(CATS).filter(function (k) { return sep[k] > CATS[k].budget; });
    var lateTx = tx.filter(function (t) { return t.late; }), lateN = lateTx.length;
    var rate = sep._save / sep._in;
    var f = {
      ahorro: { v: Math.min(1, rate / .15), label: 'Ahorro', icon: 'savings', ok: rate >= .08, val: T('{pct} de tus ingresos', { pct: pct(rate) }),
        tip: rate >= .08 ? T('Estás ahorrando más del 8% de lo que te entra. ¡Sigue así!') : T('Intenta ahorrar por lo menos el 8% de lo que te entra cada mes.'),
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
        tip: months >= 3 ? 'Si un mes no te entra plata, puedes cubrir más de 3 meses de gastos. Ese es el mínimo recomendado.' : T('Lo recomendable es tener ahorrados por lo menos 3 meses de gastos. Ahora te alcanza para {n}.', { n: months.toFixed(1).replace('.', ',') }),
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
  function leaf(x, y, s, i, tone) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><g class="l-grow" style="animation-delay:' + (i * 90) + 'ms"><g class="l-sway" style="animation-delay:-' + i + 's">' +
      '<path d="M0 0 C-16 -10 -18 -44 0 -70 C18 -44 16 -10 0 0Z" fill="' + (tone || 'var(--as-accent)') + '"/>' +
      '<path d="M0 -4 V-60 M0 -22 L-7 -31 M0 -38 L7 -47" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></g></g>';
  }
  function tree(x, y, s, i) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><g class="l-grow" style="animation-delay:' + (i * 90) + 'ms"><g class="l-sway">' +
      '<path d="M0 0 V-40" stroke="var(--as-line)" stroke-width="1.3"/><ellipse cx="0" cy="-58" rx="20" ry="26" fill="var(--as-g1)"/>' +
      '<path d="M0 -40 V-70 M0 -52 L-8 -60" stroke="var(--as-paper)" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></g></g>';
  }
  function cloud(x, y, cls) {
    return '<g class="l-cloud ' + (cls || '') + '"><path transform="translate(' + x + ' ' + y + ')" d="M0 10 H64 C66 4 60 0 54 2 C52 -8 38 -10 32 -2 C26 -6 16 -2 18 4 C10 2 4 6 0 10Z" fill="none" stroke="var(--as-g2)" stroke-width="1.2"/></g>';
  }
  function landSVG(score) {
    var out = ['<svg class="as-land" viewBox="0 0 360 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true" fill="none" stroke-linecap="round">'];
    out.push('<rect width="360" height="240" fill="var(--as-paper)"/>');
    out.push(cloud(40, 40), cloud(230, 64, 'b'));
    out.push('<path d="M0 150 C30 140 58 146 80 170 C92 184 110 196 130 214 H0Z" fill="var(--as-g1)"/>');
    if (score >= 55) out.push('<circle cx="300" cy="52" r="14" stroke="var(--as-accent)" stroke-width="1.6"/>');
    if (score < 30) {
      out.push('<path d="M280 214 V186 M280 198 L270 188 M280 192 L289 182" stroke="var(--as-g2)" stroke-width="1.6"/>');
      out.push('<path d="M300 214 V200 M300 206 L306 200" stroke="var(--as-g2)" stroke-width="1.4"/>');
    }
    var ITEMS = [
      { t: 30, f: function (i) { return leaf(296, 214, .75, i); } },
      { t: 40, f: function (i) { return leaf(322, 214, 1, i); } },
      { t: 55, f: function (i) { return leaf(44, 214, .6, i, 'var(--as-g2)'); } },
      { t: 65, f: function (i) { return tree(262, 214, .9, i); } },
      { t: 75, f: function (i) { return leaf(346, 214, .55, i); } },
      { t: 85, f: function (i) { return tree(70, 214, .75, i); } }
    ];
    ITEMS.forEach(function (it, i) { if (score >= it.t) out.push(it.f(i)); });
    if (score >= 55) [[232, 214], [244, 214], [16, 214]].forEach(function (p, i) {
      out.push('<g class="l-grow" style="animation-delay:' + (400 + i * 80) + 'ms"><path d="M' + p[0] + ' ' + p[1] + ' v-12" stroke="var(--as-line)" stroke-width="1"/><circle cx="' + p[0] + '" cy="' + (p[1] - 14) + '" r="3" stroke="var(--as-accent)" stroke-width="1.4"/></g>');
    });
    if (score >= 75) out.push('<g class="l-bird" stroke="var(--as-line)" stroke-width="1.2"><path d="M0 80 q5 -5 10 0 q5 -5 10 0"/></g>');
    if (score >= 90) out.push('<g class="l-bfly" transform="translate(240 150)"><path d="M0 0 c-5 -7 -10 -2 -5 3z M0 0 c5 -7 10 -2 5 3z" fill="var(--as-accent)"/></g>');
    out.push('<path d="M0 214 H360" stroke="var(--as-line)" stroke-width="1.2"/>');
    out.push('</svg>');
    return out.join('');
  }

  /* ---------- Motor de respuestas (intenciones sobre los datos) ---------- */
  function sumCat(mi, k) { return D.by[mi][k]; }
  function avgCat(k) { return (D.by[0][k] + D.by[1][k]) / 2; }
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
      return { t: T('En septiembre ahorraste <b>{ahorro}</b>, el {pct} de lo que te entró, y te sobraron {libre} sin un destino fijo.', { ahorro: money(sep._save), pct: pct(sep._save / sep._in), libre: money(free) }) + ' ' +
        (cut > 5 ? T('Si delivery, cafés y compras vuelven a lo que tenías presupuestado, son {monto} más cada mes.', { monto: money(cut) }) : T('Podrías mandar {monto} más a tus metas cada mes sin quedarte corto.', { monto: money(Math.max(20, Math.round(free * .3))) })),
        h: '<div class="as-stats">' + stat(T('Te entró'), money(sep._in)) + stat(T('Gastaste'), money(sep._spend)) + stat(T('Ahorraste'), money(sep._save)) + stat(T('Te sobró'), money(free)) + '</div>',
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
      { kind: 'good', icon: 'savings', title: 'Ahorraste $ 84', sub: 'Es el 7% de lo que te entró.' }] },
    jul: { name: 'julio', spend: 1012.6, save: 108, rate: .09, score: 61, ins: [
      { kind: 'warn', icon: 'trending_up', title: 'Gastaste 41% más de lo normal en compras', sub: 'Fueron las compras de vacaciones: $ 212, cuando normalmente gastas $ 150.' },
      { kind: 'good', icon: 'event_available', title: 'Pagaste todo a tiempo', sub: 'Sin recargos en servicios ni tarjetas.' }] }
  };
  var VIEWS = [
    { key: 'jun', short: 'jun', report: true }, { key: 'jul', short: 'jul', report: true },
    { key: 'ago', short: 'ago', mi: 0 }, { key: 'sep', short: 'sep', mi: 1 }, { key: 'oct', short: 'oct', mi: 2, current: true }
  ];
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
    var ck = mi + '|' + ST.scenario + '|' + ST.linked.join() + '|' + JSON.stringify(ST.mods);
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
    if (rate >= .08) good.push({ kind: 'good', icon: 'savings', title: T('Ahorraste {monto}', { monto: money(b._save) }), sub: T('Es el {pct} de lo que te entró. ¡Bien!', { pct: pct(rate) }), ask: '¿Cuánto más puedo ahorrar?' });
    else good.push({ kind: 'info', icon: 'savings', title: rate ? T('Ahorraste {monto}, el {pct}', { monto: money(b._save), pct: pct(rate) }) : T('Este mes no ahorraste nada'), sub: T('Lo ideal es ahorrar por lo menos el 8% de lo que te entra.') + (rate ? '' : ' ' + T('Programar un ahorro automático el día de pago ayuda mucho.')), ask: '¿Cuánto más puedo ahorrar?' });
    if (!late) good.push({ kind: 'good', icon: 'event_available', title: T('Pagaste todo a tiempo'), sub: T('No te cobraron ningún recargo este mes.') });
    var out = warn.slice(0, 3).concat(good).slice(0, 4);
    insCache[ck] = out;
    return out;
  }
  function lastClosedMi() { return 1; }

  /* ---------- Entradas: Inicio y Modo finanzas ----------
     Tarjeta aireada: ilustración centrada sobre un círculo neutro,
     un solo mensaje y un link. */
  function entryHTML(where) {
    return '<button class="as-entry" data-as-open="' + where + '" aria-label="Abrir Mis finanzas">' +
      '<span class="as-entry__art"><span class="as-entry__blob"></span><span class="as-entry__pet"></span></span>' +
      '<span class="as-entry__eyebrow"></span>' +
      '<span class="as-entry__title"></span>' +
      '<span class="as-entry__cta"></span></button>';
  }
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
        '<button class="as-send" type="submit" aria-label="Enviar"><span class="material-symbols-rounded">arrow_upward</span></button></form></div>';
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
      html += '<h3>Ajustes</h3>' +
        '<p class="as-sheet__label">Probar otro escenario (solo demo)</p><div class="as-rows">' +
        Object.keys(SCEN).map(function (k) {
          return '<button class="as-row as-row--btn" data-sc="' + k + '" aria-pressed="' + (ST.scenario === k) + '"><span class="as-row__main"><b>' + SCEN[k].label + '</b></span><span class="as-radio"></span></button>';
        }).join('') + '</div>';
    }
    sheet.innerHTML = html;
    back.classList.add('open'); sheet.classList.add('open'); fx('open');
  }
  function closeSheet() { back.classList.remove('open'); sheet.classList.remove('open'); }
  function onSheetClick(e) {
    var sb = e.target.closest('[data-sheet]');
    if (sb) return onSheetPF(sb);
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
      sec.querySelector('.as-ctx__list').innerHTML = cx.insights.map(function (x) {
        return '<button class="as-ctx__row" data-hist="' + esc(x.q) + '"><span class="as-row__icon material-symbols-rounded">' + x.icon + '</span>' +
          '<span class="as-row__main"><b>' + esc(x.t) + '</b><small>' + esc(x.s) + '</small></span><span class="material-symbols-rounded">chevron_right</span></button>';
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
    if (!document.querySelector('#finance-page.open, .pf-page.open')) document.body.style.overflow = '';
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
    var cat = inc ? 'Ingreso' : sav ? 'Ahorro' : CATS[t.cat].name;
    return '<div class="pf-tx">' + bankAv(a.bank) + '<span class="pf-tx__main"><b>' + esc(t.who) + '</b><small>' + cat + ' · ' + t.day + ' ' + MONTHS[t.mi].short.toLowerCase() + ' · ' + BANKS[a.bank].name + '</small></span>' +
      '<span class="pf-tx__amt' + (inc ? ' is-in' : '') + '">' + (inc ? '+' : sav ? '' : '-') + money(t.amt) + '</span></div>';
  }
  function sortedTx(filter) {
    return D.tx.filter(filter || function () { return true; }).sort(function (a, b) { return (b.mi * 40 + b.day) - (a.mi * 40 + a.day); });
  }

  function mountPF() {
    pf = document.createElement('div');
    pf.className = 'pf-page';
    pf.setAttribute('role', 'dialog');
    pf.setAttribute('aria-modal', 'true');
    pf.setAttribute('aria-label', 'Mis finanzas');
    pf.innerHTML =
      '<div class="pf-top"><button class="pf-round" data-pf="close" aria-label="Volver"><span class="material-symbols-rounded">arrow_back</span></button>' +
        '<button class="pf-round" data-pf="settings" aria-label="Ajustes"><span class="material-symbols-rounded">tune</span></button></div>' +
      '<div class="pf-scroll"></div>';
    document.body.appendChild(pf);
    pf.addEventListener('click', onPF);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !pf.classList.contains('open') || (page && page.classList.contains('open'))) return;
      e.stopImmediatePropagation();
      if (sheet && sheet.classList.contains('open')) closeSheet(); else closePF();
    }, true);
  }

  var curIns = [], onDemand = null;
  function totalHTML(label, value, sub) {
    return '<div class="pf-total"><p class="pf-total__label">' + label + '</p><p class="pf-total__value">' + value + '</p><p class="pf-total__sub">' + sub + '</p></div>';
  }
  function heroHTML(score, label) {
    return '<section class="pf-hero"><div class="b3d" data-score="' + score + '"><div class="b3d__fallback">' + C().svg() + '</div></div>' +
      '<button class="pf-hero__badge" data-pf="health"><i></i>' + label + '<span class="material-symbols-rounded">chevron_right</span></button></section>';
  }
  function insHTML(list, withDetail) {
    curIns = list;
    return '<section class="pf-sec"><h2>Lo más importante</h2><div class="pf-ins-list">' + list.map(function (x, i) {
      return '<article class="pf-ins pf-ins--' + x.kind + '"><span class="pf-ins__ic material-symbols-rounded">' + x.icon + '</span>' +
        '<div class="pf-ins__body"><h3>' + x.title + '</h3><p>' + x.sub + '</p>' +
        ((withDetail && x.det) || x.ask ? '<div class="pf-ins__acts">' +
          (withDetail && x.det ? '<button class="pf-link" data-pf="det:' + i + '">Ver detalle</button>' : '') +
          (x.ask ? '<button class="pf-link" data-pf="why:' + i + '">' + T('Pregúntale a {nombre}', { nombre: C().name }) + '</button>' : '') + '</div>' : '') +
        '</div></article>';
    }).join('') + '</div></section>';
  }
  function footHTML() {
    return '<section class="pf-sec pf-foot">' +
      '<button class="pf-navrow" data-pf="accounts"><span class="material-symbols-rounded">account_balance</span><span><b>Cuentas conectadas</b><small>' + T('{n} cuentas', { n: D.accts.length }) + ' · ' + Object.keys(BANKS).filter(connected).map(function (k) { return BANKS[k].name; }).join(', ') + '</small></span><span class="material-symbols-rounded">chevron_right</span></button>' +
      '<button class="pf-navrow" data-pf="health"><span class="material-symbols-rounded">favorite</span><span><b>Salud financiera</b><small>Cómo se calcula y cómo subirla</small></span><span class="material-symbols-rounded">chevron_right</span></button>' +
      '<button class="pf-navrow" data-pf="ask"><span class="pf-navrow__av">' + C().face() + '</span><span><b>' + T('Pregúntale a {nombre}', { nombre: C().name }) + '</b><small>Lo que quieras saber de tus últimos 3 meses</small></span><span class="material-symbols-rounded">chevron_right</span></button>' +
      '<p class="pf-note">Tu resumen se arma al cierre de cada mes. El del mes en curso lo calculamos solo cuando lo pides, así la app carga más rápido.</p></section>';
  }
  function paintPF() {
    if (!pf) return;
    var v = viewOf(ST.view), html = '';
    html += '<header class="pf-head"><h1>Mis finanzas</h1><div class="pf-months" role="tablist">' + VIEWS.map(function (x) {
      return '<button role="tab" data-pf="view:' + x.key + '" aria-selected="' + (x.key === v.key) + '">' + x.short + '</button>';
    }).join('') + '</div></header>';

    if (v.report) {
      var r = REPORTS[v.key];
      html += heroHTML(r.score, T('Salud financiera {n} · {nivel}', { n: r.score, nivel: T(level(r.score).n) }));
      html += totalHTML(T('Gastaste en {mes}', { mes: T(r.name) }), money(r.spend), T('Ahorraste {monto}', { monto: money(r.save) }));
      html += insHTML(r.ins, false);
      html += '<section class="pf-sec"><p class="pf-note pf-note--box">' + T('De {mes} solo tenemos este resumen. El detalle de cada movimiento lo tienes desde agosto.', { mes: T(r.name) }) + '</p></section>';
    } else if (v.current) {
      html += heroHTML(D.score, T('Salud financiera hoy {n} · {nivel}', { n: D.score, nivel: T(level(D.score).n) }));
      if (!onDemand) {
        html += '<div class="pf-empty"><p>Tu resumen de octubre va a estar listo a inicios de noviembre.</p>' +
          '<button class="pf-pill" data-pf="ondemand">Ver cómo va octubre</button></div>';
      } else if (onDemand === 'loading') {
        html += '<div class="pf-empty"><span class="pf-spinner"></span><p>Revisando tus movimientos de octubre…</p></div>';
      } else html += currentHTML();
    } else {
      var mi = v.mi, b = D.by[mi], sc = monthScore(mi);
      html += heroHTML(sc, T('Salud financiera {n} · {nivel}', { n: sc, nivel: T(level(sc).n) }));
      html += totalHTML(T('Gastaste en {mes}', { mes: T(MONTHS[mi].name) }), money(b._spend), T('Ahorraste {monto} · Salud financiera {n}', { monto: money(b._save), n: sc }));
      html += insHTML(monthInsights(mi), true);
      var tc = catTotals(mi).slice(0, 3);
      html += '<section class="pf-sec"><h2>En qué gastaste</h2><div class="pf-top3">' + tc.map(function (c) {
        return '<button class="pf-top3__row" data-pf="cat:' + c.k + ':' + mi + '"><span>' + CATS[c.k].name + '</span><b>' + money(c.v) + '</b><u><i style="width:' + Math.round(c.v / tc[0].v * 100) + '%"></i></u></button>';
      }).join('') + '</div><button class="pf-link pf-link--block" data-pf="breakdown:' + mi + '">Ver todas las categorías</button></section>';
    }
    html += footHTML();
    // La escena 3D sobrevive al cambio de mes: se reutiliza el mismo nodo y
    // sólo se actualiza el puntaje (el bosque crece o se encoge, sin parpadeo).
    var scroll = pf.querySelector('.pf-scroll'), oldHero = scroll.querySelector('.pf-hero');
    var live = oldHero && oldHero.querySelector('.b3d.is-3d');
    if (oldHero) oldHero.remove();
    scroll.innerHTML = html;
    var vv = viewOf(ST.view), saved = !vv.report && !vv.current && D.by[vv.mi]._save / D.by[vv.mi]._in >= .08;
    var g = saved ? { name: 'hold', opts: { hold: 'coin' } } : 'wave';
    var fresh = scroll.querySelector('.pf-hero');
    if (live && fresh) {
      var sc = +fresh.querySelector('.b3d').dataset.score;
      oldHero.querySelector('.pf-hero__badge').innerHTML = fresh.querySelector('.pf-hero__badge').innerHTML;
      fresh.replaceWith(oldHero);
      live.dataset.score = sc;
      if (!live.querySelector('canvas')) mount3D(live, sc, g); // el lienzo estaba en el hub de Uku
      else if (b3d) { b3d.setScore(sc); if (live.dataset.g !== JSON.stringify(g)) b3d.play(g.name || g, g.opts); }
      live.dataset.g = JSON.stringify(g);
    } else if (fresh) {
      var hero = fresh.querySelector('.b3d');
      hero.dataset.g = JSON.stringify(g);
      mount3D(hero, +hero.dataset.score, g);
    }
    // Dos columnas en escritorio: a la izquierda el mes (escena y total), a la
    // derecha el detalle. En el celular los contenedores no cambian nada.
    var L = document.createElement('div'), Rr = document.createElement('div');
    L.className = 'pf-col pf-col--main'; Rr.className = 'pf-col pf-col--side';
    Array.prototype.slice.call(scroll.children).forEach(function (n) {
      (n.matches('.pf-head, .pf-hero, .pf-total, .pf-empty') ? L : Rr).appendChild(n);
    });
    scroll.appendChild(L); scroll.appendChild(Rr);
    var sel = pf.querySelector('.pf-months [aria-selected="true"]');
    if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  /* Mes en curso: liviano y sólo a pedido */
  function currentHTML() {
    var o = D.by[2], day = MONTHS[2].days, proj = o._spend / day * 31, prev = D.by[1]._spend;
    var hot = Object.keys(CATS).filter(function (k) { return !CATS[k].fixed && o[k] / CATS[k].budget > day / 31 + .15; })
      .sort(function (a, b) { return o[b] / CATS[b].budget - o[a] / CATS[a].budget; })[0];
    var next = [];
    ['servicios', 'subs'].forEach(function (k) { CATS[k].fixed.forEach(function (p, i) { var d = 3 + i * 4; if (d > day && d <= day + 7) next.push({ who: p[0], amt: p[1], d: d }); }); });
    return totalHTML(T('Llevas gastado en octubre'), money(o._spend), T('En los primeros {n} días', { n: day })) +
      '<section class="pf-sec"><div class="pf-ins-list">' +
        '<article class="pf-ins pf-ins--info"><span class="pf-ins__ic material-symbols-rounded">speed</span><div class="pf-ins__body"><h3>' + T('Si sigues así, cerrarías el mes en {monto}', { monto: money(proj) }) + '</h3><p>' + (proj > prev ? T('Eso es {monto} más que en septiembre.', { monto: money(proj - prev) }) : T('Eso es {monto} menos que en septiembre.', { monto: money(prev - proj) })) + '</p></div></article>' +
        (hot ? '<article class="pf-ins pf-ins--warn"><span class="pf-ins__ic material-symbols-rounded">pie_chart</span><div class="pf-ins__body"><h3>' + T('Ya usaste el {pct} de tu presupuesto de {cat}', { pct: pct(o[hot] / CATS[hot].budget), cat: catLow(hot) }) + '</h3><p>' + T('Y apenas vamos por el {pct} del mes.', { pct: pct(day / 31) }) + '</p></div></article>' : '') +
        (next.length ? '<article class="pf-ins pf-ins--info"><span class="pf-ins__ic material-symbols-rounded">event</span><div class="pf-ins__body"><h3>' + T('Esta semana te cobran {monto}', { monto: money(next.reduce(function (s, n) { return s + n.amt; }, 0)) }) + '</h3><p>' + next.map(function (n) { return T(n.who) + ' (' + n.d + ' ' + T('oct') + ')'; }).join(', ') + '.</p></div></article>' : '') +
      '</div></section>';
  }

  function onPF(e) {
    var b = e.target.closest('[data-pf]');
    if (!b) return;
    var k = b.dataset.pf;
    if (k === 'close') return closePF();
    if (k === 'settings') return openSheet('settings');
    if (k === 'ask') return open();
    if (k === 'health') return healthSheet();
    if (k === 'accounts') return accountsSheet();
    if (k === 'ondemand') {
      onDemand = 'loading'; paintPF(); fx('select');
      setTimeout(function () { onDemand = 'ready'; paintPF(); fx('reveal'); }, 900);
      return;
    }
    if (k.indexOf('view:') === 0) { ST.view = k.slice(5); persist(); fx('select'); paintPF(); pf.querySelector('.pf-scroll').scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (k.indexOf('breakdown:') === 0) return breakdownSheet(+k.slice(10));
    if (k.indexOf('cat:') === 0) { var p = k.split(':'); return catSheet(p[1], +p[2]); }
    if (k.indexOf('det:') === 0) return detailSheet(curIns[+k.slice(4)].det);
    if (k.indexOf('why:') === 0) { var q = curIns[+k.slice(4)].ask; open(); setTimeout(function () { ask(q); }, 350); }
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
  function accountsSheet() {
    showSheet('<h3>' + T('Cuentas conectadas') + '</h3><p>' + (D.debt ? T('En total tienes {total} y debes {deuda}.', { total: money(D.assets), deuda: money(D.debt) }) : T('En total tienes {total}.', { total: money(D.assets) })) + '</p><div class="pf-card pf-card--flat">' +
      D.accts.map(function (a) {
        return '<div class="pf-row">' + bankAv(a.bank) + '<span class="pf-row__main"><b>' + a.name + '</b><small>' + BANKS[a.bank].name + (a.mask ? ' ·••' + a.mask : '') + '</small></span>' +
          '<span class="pf-row__val">' + (a.type === 'credito' ? '<b>-' + money(a.owed) + '</b><small>' + T('Cupo {monto}', { monto: money(a.limit) }) + '</small>' : '<b>' + money(a.bal) + '</b>') + '</span></div>';
      }).join('') + '</div><button class="pf-cta" data-sheet="connect">Conectar otra cuenta</button>' +
      '<button class="pf-link pf-link--block" data-sheet="tx:all">Ver movimientos de todas las cuentas</button>');
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
    if (k === 'connect') return connectSheet();
    if (k.indexOf('act:') === 0) { closeSheet(); return doAction(k.slice(4)); }
    if (k.indexOf('cat:') === 0) { var p = k.split(':'); return catSheet(p[1], +p[2]); }
    if (k.indexOf('link:') === 0) return consentSheet(k.slice(5));
    if (k.indexOf('auth:') === 0) return finishLink(k.slice(5));
    if (k.indexOf('unlink:') === 0) {
      var bank = k.slice(7);
      ST.linked = ST.linked.filter(function (x) { return x !== bank; }); persist(); build(); paintPF(); paintEntries(); fx('toggle');
      return connectSheet();
    }
  }

  function openPF() {
    if (!pf) mountPF();
    onDemand = null;
    paintPF();
    pf.querySelector('.pf-scroll').scrollTop = 0;
    pf.classList.add('open');
    document.body.style.overflow = 'hidden';
    fx('open');
  }
  function closePF() {
    pf.classList.remove('open');
    if (!document.querySelector('#finance-page.open')) document.body.style.overflow = '';
    fx('close');
  }

  /* Arrastrar el uñero hacia abajo cierra cualquier hoja .as-sheet (las del
     asistente, Mis finanzas y Destacados). Cierra "tocando" su fondo, así
     cada módulo usa su propio cierre. */
  function sheetDrag() {
    var sh = null, y0 = 0, dy = 0, t0 = 0;
    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.as-sheet__handle')) return;
      sh = e.target.closest('.as-sheet.open'); if (!sh) return;
      y0 = e.clientY; dy = 0; t0 = Date.now(); sh.style.transition = 'none';
      try { e.target.setPointerCapture(e.pointerId); } catch (x) {}
      e.preventDefault();
    });
    document.addEventListener('pointermove', function (e) {
      if (!sh) return;
      var was = dy > 90;
      dy = Math.max(0, e.clientY - y0);
      if (was !== dy > 90) fx('detent');
      sh.style.transform = 'translate(-50%, ' + dy + 'px)';
    });
    function end() {
      if (!sh) return;
      var el = sh, fast = dy > 30 && dy / Math.max(1, Date.now() - t0) > .6;
      sh = null; el.style.transition = '';
      if (dy > 90 || fast) {
        var bk = el.previousElementSibling;
        if (bk && bk.classList.contains('as-sheet-back')) bk.click(); else el.classList.remove('open');
        fx('close');
      }
      requestAnimationFrame(function () { el.style.transform = ''; });
    }
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  }
  function init() {
    build(); mountEntries(); paintEntries(); sheetDrag();
    // Al cambiar de idioma: lo que se arma con T() se vuelve a pintar
    document.addEventListener('i18n:change', function () {
      insCache = {}; paintEntries();
      if (page && page.classList.contains('open')) paintAll();
      if (pf && pf.classList.contains('open')) paintPF();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.Asistente = { petSVG: function () { return C().svg(); }, faceIMG: function () { return C().face(); }, name: function () { return C().name; }, open: open, openPF: function () { openPF(); }, ask: function (q) { open(); ask(q); }, data: function () { return D; },
    insights: function () { return monthInsights(lastClosedMi()); } };
})();
