/* =====================================================================
   Asistente financiero — Candado (perro) y PIA (pollito amarillo)

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

  var KEY = 'pb_asistente_v1';
  var ST = { who: 'candado', scenario: 'normal' };
  try { var saved = JSON.parse(localStorage.getItem(KEY)); if (saved) ST = Object.assign(ST, saved); } catch (e) {}
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) {} }
  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }

  var CHARS = {
    candado: { name: 'Candado', role: 'Tu guardián financiero', hi: '¡Guau! Soy Candado.', ok: '¡Listo!', svg: candadoSVG },
    pia:     { name: 'PIA', role: 'Tu asistente de finanzas', hi: '¡Pío! Soy PIA.', ok: '¡Pío, aquí va!', svg: piaSVG }
  };
  function C() { return CHARS[ST.who] || CHARS.candado; }

  /* ---------- Formato ---------- */
  function money(v) {
    var s = Math.abs(v).toFixed(2).split('.');
    return (v < 0 ? '-' : '') + '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Datos de ejemplo: últimos 3 meses ---------- */
  var TODAY = new Date(2026, 9, 8); // 8 oct 2026 (concept)
  var MONTHS = [
    { y: 2026, m: 7, name: 'agosto', short: 'Ago', days: 31 },
    { y: 2026, m: 8, name: 'septiembre', short: 'Sep', days: 30 },
    { y: 2026, m: 9, name: 'octubre', short: 'Oct', days: 8, partial: true }
  ];
  var CATS = {
    super:     { name: 'Supermercado', c: '#31a451', budget: 320, m: ['Supermaxi', 'Mi Comisariato', 'Tía'], n: 6, a: [25, 70] },
    delivery:  { name: 'Restaurantes y delivery', c: '#f08c2e', budget: 100, m: ['PedidosYa', 'Rappi', 'Uber Eats', 'KFC'], n: 6, a: [8, 22] },
    transporte:{ name: 'Transporte', c: '#2f7abf', budget: 75, m: ['Uber', 'Cabify', 'Primax'], n: 9, a: [2.5, 9] },
    servicios: { name: 'Servicios básicos', c: '#7c5cd6', budget: 100, fixed: [['Luz', 24.8], ['Agua', 18.35], ['Internet', 32.5], ['Celular', 20]] },
    subs:      { name: 'Suscripciones', c: '#e0409a', budget: 60, fixed: [['Netflix', 10.99], ['Spotify', 5.99], ['iCloud', 2.99], ['Gimnasio', 35]] },
    compras:   { name: 'Compras', c: '#c98945', budget: 100, m: ['Amazon', 'De Prati', 'Kywi'], n: 2, a: [18, 75] },
    cafe:      { name: 'Cafés y antojos', c: '#8a5a36', budget: 35, m: ['Sweet & Coffee', 'Juan Valdez', 'Tienda del barrio'], n: 13, a: [1.8, 4.6], hormiga: true },
    salud:     { name: 'Salud', c: '#1aa3a3', budget: 40, m: ['Fybeca', 'Pharmacys'], n: 1, a: [12, 38] },
    ocio:      { name: 'Ocio', c: '#ffb300', budget: 40, m: ['Cinemark', 'Bar La Ronda', 'Steam'], n: 2, a: [9, 28] }
  };
  var SCEN = {
    dificil:   { label: 'Mes difícil', mul: { delivery: 1.8, cafe: 2.1, compras: 2.6, ocio: 1.6 }, save: 0, late: 1, income: 1200 },
    normal:    { label: 'Normal', mul: {}, save: 110, late: 0, income: 1200 },
    excelente: { label: 'Excelente', mul: { delivery: .5, cafe: .35, compras: .5, ocio: .7 }, save: 240, late: 0, income: 1200 }
  };
  var GOALS = [
    { name: 'Fondo de emergencia', target: 1500, base: 820, due: 'jun 2027', share: .6, left: 8 },
    { name: 'Viaje a Galápagos', target: 1200, base: 310, due: 'dic 2027', share: .4, left: 14 }
  ];

  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  var D; // datos derivados del escenario
  function build() {
    var sc = SCEN[ST.scenario] || SCEN.normal, r = rng(97 + ST.scenario.length * 13), tx = [];
    MONTHS.forEach(function (mo, mi) {
      var f = mo.partial ? mo.days / 30 : 1;
      tx.push({ mi: mi, day: 1, cat: 'ingreso', who: 'Sueldo', amt: sc.income });
      if (sc.save && !mo.partial) tx.push({ mi: mi, day: 2, cat: 'ahorro', who: 'Ahorro a metas', amt: sc.save });
      if (sc.save && mo.partial) tx.push({ mi: mi, day: 2, cat: 'ahorro', who: 'Ahorro a metas', amt: Math.round(sc.save * .5) });
      Object.keys(CATS).forEach(function (k) {
        var c = CATS[k];
        if (c.fixed) {
          c.fixed.forEach(function (p, i) { var d = 3 + i * 4; if (d <= mo.days) tx.push({ mi: mi, day: d, cat: k, who: p[0], amt: p[1], late: k === 'servicios' && sc.late && i === 1 && mi === 1 }); });
          return;
        }
        var n = Math.max(0, Math.round(c.n * (sc.mul[k] || 1) * f + (r() - .5)));
        for (var i = 0; i < n; i++) {
          tx.push({ mi: mi, day: 1 + Math.floor(r() * mo.days), cat: k, who: c.m[Math.floor(r() * c.m.length)], amt: +(c.a[0] + r() * (c.a[1] - c.a[0])).toFixed(2) });
        }
      });
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
      var have = g.base + totalSaved * g.share, monthly = sc.save * g.share;
      var monthsLeft = g.left;
      return { name: g.name, target: g.target, have: have, due: g.due, need: (g.target - have) / monthsLeft, monthly: monthly, onTrack: monthly >= (g.target - have) / monthsLeft };
    });
    var sep = by[1], overCats = Object.keys(CATS).filter(function (k) { return sep[k] > CATS[k].budget; });
    var lateN = tx.filter(function (t) { return t.late; }).length;
    var rate = sep._save / sep._in;
    var f = {
      ahorro:      { v: Math.min(1, rate / .15), label: 'Ahorro', icon: 'savings', c: '#f08c2e', val: pct(rate) + ' del sueldo', ok: rate >= .08, note: rate >= .08 ? 'Riega el paisaje' : 'Ahorra 10% para que llueva' },
      metas:       { v: goals.filter(function (g) { return g.onTrack; }).length / goals.length, label: 'Metas', icon: 'flag', c: '#31a451', val: goals.filter(function (g) { return g.onTrack; }).length + ' de ' + goals.length + ' en ritmo', ok: goals.every(function (g) { return g.onTrack; }), note: goals.every(function (g) { return g.onTrack; }) ? 'Crecen árboles' : 'Faltan aportes' },
      pagos:       { v: lateN ? 0 : 1, label: 'Pagos a tiempo', icon: 'event_available', c: '#2f7abf', val: lateN ? lateN + ' atrasado' : 'Todos a tiempo', ok: !lateN, note: lateN ? 'El río baja' : 'El río fluye' },
      presupuesto: { v: 1 - Math.min(1, overCats.length / 3), label: 'Presupuesto', icon: 'pie_chart', c: '#7c5cd6', val: overCats.length ? overCats.length + ' categoría' + (overCats.length > 1 ? 's' : '') + ' excedida' + (overCats.length > 1 ? 's' : '') : 'Dentro del plan', ok: !overCats.length, note: overCats.length ? 'Se secan flores' : 'Florece el prado' }
    };
    var score = Math.round(30 * f.ahorro.v + 25 * f.metas.v + 25 * f.pagos.v + 20 * f.presupuesto.v);
    D = { tx: tx, by: by, goals: goals, f: f, score: score, overCats: overCats, lateN: lateN, sc: sc };
  }
  function level(s) {
    if (s >= 80) return { n: 'Bosque frondoso', c: '#2e9d4a', k: 4 };
    if (s >= 55) return { n: 'Pradera en flor', c: '#6cbf3c', k: 3 };
    if (s >= 30) return { n: 'Brotes nuevos', c: '#c7a22a', k: 2 };
    return { n: 'Tierra seca', c: '#c0742c', k: 1 };
  }

  /* ---------- Personajes ---------- */
  var uidN = 0;
  /* Estilo de la marca: línea navy fina, rellenos gris claro, amarillo
     como único acento y mucho aire. Sin degradados ni sombras. */
  function candadoSVG() {
    return '<svg class="as-char" viewBox="0 0 200 220" aria-hidden="true">' +
    '<g class="c-body" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path class="c-tail" d="M148 200 C172 198 186 178 178 156 C190 166 196 190 182 206 C172 214 156 212 148 208Z" fill="var(--as-g1)"/>' +
      '<path d="M66 212 C60 182 64 150 82 132 L98 122 C114 126 126 138 132 156 C146 168 154 190 150 212 Z" fill="var(--as-g1)"/>' +
      '<path d="M104 212 C100 192 108 172 128 168 C146 172 152 194 148 212Z" fill="var(--as-g2)"/>' +
      '<path d="M78 150 C74 172 74 196 80 212" stroke="var(--as-line)" stroke-width="1.4"/>' +
      '<path d="M66 212 H156" stroke="var(--as-line)" stroke-width="1.4"/>' +
      '<g class="c-head">' +
        '<path d="M86 84 L88 46 L106 76Z" fill="var(--as-g1)"/><path d="M92 74 L92 56 L101 72" stroke="var(--as-line)" stroke-width="1.2"/>' +
        '<path d="M104 80 L118 48 L122 86Z" fill="var(--as-g2)"/>' +
        '<path d="M120 100 C120 80 106 72 92 74 C78 76 70 86 68 96 C56 98 44 104 42 112 C42 120 54 124 70 122 C80 128 96 130 108 124 C116 118 120 110 120 100Z" fill="var(--as-g1)"/>' +
        '<g class="c-eyes"><circle cx="80" cy="96" r="3.2" fill="var(--as-line)"/></g>' +
        '<ellipse cx="43" cy="110" rx="4" ry="3.2" fill="var(--as-line)"/>' +
        '<path class="c-mouth-closed" d="M48 118 Q58 123 68 119" stroke="var(--as-line)" stroke-width="1.4"/>' +
        '<path class="c-mouth-open" d="M48 117 Q58 128 68 118" stroke="var(--as-line)" stroke-width="1.4" fill="var(--as-paper)"/>' +
        '<path d="M80 124 Q98 136 116 120" stroke="var(--as-line)" stroke-width="4"/>' +
        '<g transform="translate(96 138)"><path d="M-3.5 -2 v-3 a3.5 3.5 0 0 1 7 0 v3" stroke="var(--as-line)" stroke-width="1.2"/><rect x="-5.5" y="-2" width="11" height="9" rx="2" fill="var(--as-accent)"/></g>' +
      '</g>' +
    '</g></svg>';
  }
  function piaSVG() {
    return '<svg class="as-char" viewBox="0 0 200 220" aria-hidden="true">' +
    '<g class="c-body" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M88 190 v20 M80 212 l8 -3 8 3 M112 190 v20 M104 212 l8 -3 8 3" stroke="var(--as-line)" stroke-width="1.6"/>' +
      '<path d="M60 212 H140" stroke="var(--as-line)" stroke-width="1.4"/>' +
      '<g class="c-head">' +
        '<path d="M100 82 C96 70 98 62 104 58 M102 82 C106 72 114 68 120 70" stroke="var(--as-line)" stroke-width="1.4"/>' +
        '<circle cx="100" cy="138" r="56" fill="var(--as-accent)"/>' +
        '<path d="M62 120 C60 140 66 160 82 172" stroke="#fff" stroke-width="1.4" opacity=".9"/>' +
        '<g class="c-eyes"><circle cx="86" cy="120" r="3.6" fill="var(--as-line)"/><circle cx="116" cy="120" r="3.6" fill="var(--as-line)"/></g>' +
        '<path class="c-mouth-closed" d="M94 132 L101 128 L108 132 L101 137Z" fill="#fff" stroke="var(--as-line)" stroke-width="1.3"/>' +
        '<path class="c-mouth-open" d="M93 130 L101 126 L109 130 M94 134 L101 141 L108 134" fill="#fff" stroke="var(--as-line)" stroke-width="1.3"/>' +
        '<path d="M92 176 L100 188 L108 176Z" fill="var(--as-line)"/>' +
      '</g>' +
      '<path class="c-wing-r" d="M150 134 C166 140 168 160 156 170 C150 160 146 150 146 140Z" fill="var(--as-g1)"/>' +
    '</g></svg>';
  }

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
  var OLD = /(hace|el año|año pasado|enero|febrero|marzo|abril|mayo|junio|julio|2025|seis meses|6 meses|semestre|histori|antes)/;

  function answer(q) {
    var s = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    var sep = D.by[1], oct = D.by[2], ago = D.by[0];
    if (OLD.test(s)) return reports(s);
    if (/hormiga|cafe|antojo|cafecito/.test(s)) {
      var n = sep._hormigaN, v = sep.cafe, year = v * 12;
      return { t: 'En septiembre tuviste <b>' + n + ' gastos hormiga</b> (cafés y antojos) por ' + money(v) + '. Al año serían ' + money(year) + '. ' +
        (v > CATS.cafe.budget ? 'Si los bajas a la mitad, ahorras ' + money(year / 2) + ' al año: casi ' + Math.round(year / 2 / 9) + ' semanas de supermercado.' : '¡Están bajo control! Sigue así.'),
        h: '<div class="as-stats">' + stat('Septiembre', money(v)) + stat('Octubre (8 días)', money(oct.cafe)) + '</div>' };
    }
    if (/suscrip|netflix|spotify|recurrent|fijo/.test(s) && !/servicio/.test(s)) {
      return { t: 'Tienes 4 suscripciones activas por <b>' + money(sep.subs) + '</b> al mes. El gimnasio es el 59%: ¿lo usas al menos 8 veces al mes?',
        h: bars(CATS.subs.fixed.map(function (p) { return { label: p[0], v: p[1], c: CATS.subs.c }; })) };
    }
    if (/meta|objetivo|galapagos|emergencia|viaje/.test(s)) {
      return { t: D.goals.map(function (g) {
          return '<b>' + g.name + '</b>: ' + pct(g.have / g.target) + ' (' + money(g.have) + ' de ' + money(g.target) + '). ' +
            (g.onTrack ? 'Vas en ritmo para ' + g.due + '.' : 'Para llegar en ' + g.due + ' necesitas ' + money(g.need) + ' al mes; hoy aportas ' + money(g.monthly) + '.');
        }).join('<br>'),
        h: bars(D.goals.map(function (g) { return { label: g.name, v: g.have, c: g.onTrack ? '#31a451' : '#f08c2e' }; }), 1500) };
    }
    if (/ahorr|puedo|alcanza|sobra/.test(s)) {
      var free = sep._in - sep._spend - sep._save;
      var cut = Math.max(0, sep.delivery - CATS.delivery.budget) + Math.max(0, sep.cafe - CATS.cafe.budget) + Math.max(0, sep.compras - CATS.compras.budget);
      return { t: 'En septiembre ahorraste <b>' + money(sep._save) + '</b> (' + pct(sep._save / sep._in) + ' de tu sueldo) y te quedaron ' + money(free) + ' libres. ' +
        (cut > 5 ? 'Si vuelves al presupuesto en delivery, cafés y compras liberas ' + money(cut) + ' más al mes.' : 'Podrías programar ' + money(Math.max(20, Math.round(free * .3))) + ' más al mes a tus metas sin apretarte.'),
        h: '<div class="as-stats">' + stat('Ingresos', money(sep._in)) + stat('Gastos', money(sep._spend)) + stat('Ahorro', money(sep._save), 'down') + stat('Libre', money(free)) + '</div>' };
    }
    if (/compar|mes pasado|vs|anterior|subi|baje|aument/.test(s)) {
      var rows = Object.keys(CATS).map(function (k) { return { k: k, d: sep[k] - ago[k] }; }).sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); }).slice(0, 3);
      var d = sep._spend - ago._spend;
      return { t: 'Septiembre vs agosto: gastaste <b>' + money(Math.abs(d)) + (d > 0 ? ' más' : ' menos') + '</b>. Lo que más cambió: ' +
        rows.map(function (r) { return CATS[r.k].name.toLowerCase() + ' (' + (r.d > 0 ? '+' : '') + money(r.d) + ')'; }).join(', ') + '.',
        h: '<div class="as-stats">' + stat('Agosto', money(ago._spend)) + stat('Septiembre', money(sep._spend), d > 0 ? 'up' : 'down') + '</div>' };
    }
    if (/presupuesto|pase|exced|limite/.test(s)) {
      return { t: D.overCats.length ? 'En septiembre te pasaste en <b>' + D.overCats.map(function (k) { return CATS[k].name.toLowerCase(); }).join(', ') + '</b>. El resto va dentro del plan.' : 'En septiembre todo quedó dentro del presupuesto. ¡El prado lo agradece! 🌼',
        h: bars(Object.keys(CATS).filter(function (k) { return !CATS[k].fixed; }).map(function (k) { return { k: k, v: sep[k], c: sep[k] > CATS[k].budget ? '#c20505' : CATS[k].c, label: CATS[k].name + ' · tope ' + money(CATS[k].budget) }; })) };
    }
    for (var k in CAT_WORDS) {
      if (CAT_WORDS[k].test(s)) {
        var mv = D.tx.filter(function (t) { return t.cat === k && t.mi === 1; }), by = {};
        mv.forEach(function (t) { by[t.who] = (by[t.who] || 0) + t.amt; });
        var rowsM = Object.keys(by).map(function (w) { return { label: w, v: by[w], c: CATS[k].c }; }).sort(function (a, b) { return b.v - a.v; });
        var a3 = (ago[k] + sep[k]) / 2;
        return { t: 'En septiembre gastaste <b>' + money(sep[k]) + '</b> en ' + CATS[k].name.toLowerCase() + ' (' + mv.length + ' movimientos). Tu promedio es ' + money(a3) + ' y en octubre llevas ' + money(oct[k]) + '.',
          h: rowsM.length ? bars(rowsM) : '' };
      }
    }
    if (/en que|mas gasto|gasto mas|gastos|donde se va|analiza|categor/.test(s)) {
      var tc = topCats(1, 5);
      return { t: 'En septiembre gastaste <b>' + money(sep._spend) + '</b>. Tus 3 categorías principales son ' + tc.slice(0, 3).map(function (c) { return CATS[c.k].name.toLowerCase(); }).join(', ') + '.',
        h: bars(tc) };
    }
    if (/resumen|como voy|como estoy|paisaje|bosque|salud|estado/.test(s) || s.length < 3) return summary();
    return { t: 'Aún estoy aprendiendo 🐾. Puedo ayudarte con tus gastos, presupuesto, metas, ahorro y gastos hormiga de los últimos 3 meses. Prueba con una de estas:', chips: true };
  }
  function summary() {
    var lv = level(D.score), f = D.f;
    var good = Object.keys(f).filter(function (k) { return f[k].ok; }).map(function (k) { return f[k].label.toLowerCase(); });
    var bad = Object.keys(f).filter(function (k) { return !f[k].ok; }).map(function (k) { return f[k].label.toLowerCase(); });
    return { t: 'Tu paisaje está en <b>' + lv.n.toLowerCase() + '</b>. ' + (good.length ? 'Lo hacen crecer: ' + good.join(', ') + '. ' : '') +
      (bad.length ? 'Para que reverdezca más, enfócate en ' + bad.join(' y ') + '.' : '¡Todo suma! Este es el mejor paisaje posible 🌳') };
  }
  function reports() {
    var base = { dificil: [-1, 0], normal: [0, 0], excelente: [1, 1] }[ST.scenario];
    var rows = [
      ['Jul', 'Ahorro 9%', 'Metas en ritmo', 62 + base[0] * 6],
      ['Jun', 'Ahorro 7%', '1 pago atrasado', 48 + base[0] * 4],
      ['May', 'Ahorro 11%', 'Meta cumplida: laptop', 81 + base[1] * 4],
      ['Abr', 'Ahorro 5%', 'Presupuesto excedido', 39 + base[0] * 3]
    ];
    return { t: 'Solo puedo ver el detalle de tus movimientos de los <b>últimos 3 meses</b> (agosto a octubre). De antes guardo tus <b>informes mensuales</b>: cómo te fue con metas, ahorro y pagos.',
      h: '<div class="as-report">' + rows.map(function (r) {
          var lv = level(r[3]);
          return '<div class="as-report__row" style="--c:' + lv.c + '"><b>' + r[0] + '</b><span>' + r[1] + ' · ' + r[2] + '</span><em>' + lv.n.split(' ')[0] + '</em></div>';
        }).join('') + '</div><p class="as-note">Los informes no incluyen movimientos individuales.</p>' };
  }
  var SUGGEST = ['¿En qué gasto más?', '¿Cómo voy con mis metas?', 'Gastos hormiga', '¿Puedo ahorrar más?', 'Compara con el mes pasado', '¿Me pasé del presupuesto?', 'Suscripciones', '¿Cómo me fue en mayo?', '¿Cómo está mi paisaje?'];

  function insight() {
    if (D.lateN) return 'Tienes un pago atrasado. Págalo para que el río vuelva a fluir.';
    if (D.overCats.length) return 'Te pasaste en ' + CATS[D.overCats[0]].name.toLowerCase() + '. ¿Lo revisamos juntos?';
    var g = D.goals.filter(function (x) { return !x.onTrack; })[0];
    if (g) return 'Tu meta ' + g.name + ' necesita ' + money(g.need) + ' al mes para llegar a tiempo.';
    return 'Vas en ritmo con tus metas. Tu paisaje está en su mejor momento.';
  }

  /* ---------- Entradas: Inicio y Modo finanzas ----------
     Tarjeta aireada: ilustración centrada sobre un círculo neutro,
     un solo mensaje y un link. */
  function entryHTML(where) {
    return '<button class="as-entry" data-as-open="' + where + '" aria-label="Abrir asistente de finanzas">' +
      '<span class="as-entry__art"><span class="as-entry__blob"></span><span class="as-entry__pet"></span></span>' +
      '<span class="as-entry__eyebrow"></span>' +
      '<span class="as-entry__title"></span>' +
      '<span class="as-entry__cta">Preguntarle</span></button>';
  }
  function mountEntries() {
    var home = document.querySelector('.tab-panel[data-panel="Destacado"]');
    if (home && !home.querySelector('[data-as-open]')) {
      var anchor = Array.prototype.find.call(home.querySelectorAll('.section'), function (s) {
        var h = s.querySelector('.section__title h2'); return h && /Novedades/.test(h.textContent);
      });
      var sec = document.createElement('section');
      sec.className = 'section';
      sec.innerHTML = entryHTML('home');
      if (anchor) home.insertBefore(sec, anchor); else home.appendChild(sec);
    }
    var fin = document.querySelector('#finance-page .finance-subtitle');
    if (fin && !document.querySelector('.finance-page-assistant')) {
      var w = document.createElement('div');
      w.className = 'finance-page-assistant';
      w.innerHTML = entryHTML('pfm');
      fin.parentNode.insertBefore(w, fin.nextSibling);
    }
    document.querySelectorAll('[data-as-open]').forEach(function (b) {
      if (b._as) return; b._as = 1;
      b.addEventListener('click', function () { open(); });
    });
  }
  function paintEntries() {
    document.querySelectorAll('[data-as-open]').forEach(function (b) {
      b.querySelector('.as-entry__pet').innerHTML = C().svg();
      b.querySelector('.as-entry__eyebrow').textContent = C().name + ' · tu asistente de finanzas';
      b.querySelector('.as-entry__title').textContent = insight();
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
        '<button class="as-icon-btn" data-as="back" aria-label="Volver"><span class="material-symbols-rounded">close</span></button>' +
        '<button class="as-level" data-as="land" aria-label="Ver qué hace crecer tu paisaje"><i></i><span></span><span class="material-symbols-rounded">expand_more</span></button>' +
        '<button class="as-icon-btn" data-as="settings" aria-label="Ajustes del asistente"><span class="material-symbols-rounded">tune</span></button>' +
      '</div>' +
      '<div class="as-intro">' +
        '<p class="as-intro__eyebrow"></p>' +
        '<h1 class="as-intro__title"></h1>' +
        '<p class="as-intro__text">Analizo tus movimientos de los últimos 3 meses. Pregúntame lo que quieras.</p>' +
      '</div>' +
      '<div class="as-chat" aria-live="polite"></div>' +
      '<div class="as-pet" role="button" tabindex="0" aria-label="Saludar"></div>' +
      '<div class="as-composer"><div class="as-chips"></div>' +
        '<form class="as-input"><input type="text" enterkeyhint="send" autocomplete="off" aria-label="Escribe tu pregunta">' +
        '<button class="as-send" type="submit" aria-label="Enviar"><span class="material-symbols-rounded">arrow_upward</span></button></form></div>';
    document.body.appendChild(page);
    back = document.createElement('div'); back.className = 'as-sheet-back';
    sheet = document.createElement('div'); sheet.className = 'as-sheet'; sheet.setAttribute('role', 'dialog');
    document.body.appendChild(back); document.body.appendChild(sheet);
    back.addEventListener('click', closeSheet);
    sheet.addEventListener('click', onSheetClick);

    chat = page.querySelector('.as-chat');
    input = page.querySelector('input');
    page.querySelector('.as-chips').innerHTML = SUGGEST.slice(0, 5).map(function (q) { return '<button class="as-chip" type="button">' + q + '</button>'; }).join('');
    page.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-as="back"]'))) { if (page.classList.contains('is-chat')) leaveChat(); else close(); return; }
      if ((b = e.target.closest('[data-as="land"]'))) return openSheet('land');
      if ((b = e.target.closest('[data-as="settings"]'))) return openSheet('settings');
      if ((b = e.target.closest('.as-chip'))) return ask(b.textContent);
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
    var svg = page && page.querySelector('.as-pet .as-char');
    if (!svg) return;
    svg.classList.remove('is-listening', 'is-happy', 'is-talking');
    if (cls) svg.classList.add(cls);
  }
  function paintAll() {
    paintEntries();
    if (!page) return;
    var lv = level(D.score);
    page.querySelector('.as-land-wrap').innerHTML = landSVG(D.score).replace('xMidYMax slice', 'xMidYMax meet');
    page.querySelector('.as-pet').innerHTML = C().svg();
    page.querySelector('.as-level span').textContent = lv.n;
    page.querySelector('.as-level').style.setProperty('--lvl', 'var(--as-accent)');
    page.querySelector('.as-intro__eyebrow').textContent = 'Hola, soy ' + C().name;
    page.querySelector('.as-intro__title').textContent = insight();
    input.placeholder = 'Pregúntale a ' + C().name + '…';
  }

  /* Hojas inferiores */
  function openSheet(kind) {
    var lv = level(D.score), html = '<div class="as-sheet__handle"></div>';
    if (kind === 'land') {
      html += '<h3>' + lv.n + '</h3><p>' + C().name + ' siempre está contigo. Lo que cambia con tus hábitos es su paisaje.</p>' +
        '<div class="as-rows">' + Object.keys(D.f).map(function (k) {
          var f = D.f[k];
          return '<div class="as-row"><span class="as-row__icon material-symbols-rounded">' + f.icon + '</span>' +
            '<span class="as-row__main"><b>' + f.label + '</b><small>' + f.note + '</small></span>' +
            '<span class="as-row__val' + (f.ok ? '' : ' is-warn') + '">' + f.val + '</span></div>';
        }).join('') + '</div>';
    } else {
      html += '<h3>Ajustes</h3><p class="as-sheet__label">Tu asistente</p><div class="as-rows">' +
        Object.keys(CHARS).map(function (k) {
          return '<button class="as-row as-row--btn" data-who="' + k + '" aria-pressed="' + (ST.who === k) + '"><span class="as-row__av">' + CHARS[k].svg() + '</span>' +
            '<span class="as-row__main"><b>' + CHARS[k].name + '</b><small>' + CHARS[k].role + '</small></span><span class="as-radio"></span></button>';
        }).join('') + '</div>' +
        '<p class="as-sheet__label">Simular escenario (demo)</p><div class="as-rows">' +
        Object.keys(SCEN).map(function (k) {
          return '<button class="as-row as-row--btn" data-sc="' + k + '" aria-pressed="' + (ST.scenario === k) + '"><span class="as-row__main"><b>' + SCEN[k].label + '</b></span><span class="as-radio"></span></button>';
        }).join('') + '</div>';
    }
    sheet.innerHTML = html;
    back.classList.add('open'); sheet.classList.add('open'); fx('open');
  }
  function closeSheet() { back.classList.remove('open'); sheet.classList.remove('open'); }
  function onSheetClick(e) {
    var b = e.target.closest('[data-who],[data-sc]');
    if (!b) return;
    if (b.dataset.who && ST.who !== b.dataset.who) { ST.who = b.dataset.who; fx('toggle'); }
    if (b.dataset.sc && ST.scenario !== b.dataset.sc) { ST.scenario = b.dataset.sc; build(); fx(D.score >= 55 ? 'success' : 'select'); }
    persist(); paintAll();
    sheet.querySelectorAll('[data-who]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.who === ST.who)); });
    sheet.querySelectorAll('[data-sc]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.sc === ST.scenario)); });
  }

  /* Chat */
  function enterChat() { if (!page.classList.contains('is-chat')) { page.classList.add('is-chat'); page.querySelector('[data-as="back"] span').textContent = 'arrow_back'; } }
  function leaveChat() { page.classList.remove('is-chat'); page.querySelector('[data-as="back"] span').textContent = 'close'; fx('close'); }
  function me(text) {
    var m = document.createElement('div');
    m.className = 'as-msg as-msg--me';
    m.innerHTML = '<div class="as-msg__bubble"><p>' + esc(text) + '</p></div>';
    chat.appendChild(m); scrollEnd();
  }
  function bot(a) {
    var m = document.createElement('div');
    m.className = 'as-msg';
    m.innerHTML = '<div class="as-msg__bubble"><span class="as-typing" aria-label="Escribiendo"><i></i><i></i><i></i></span></div>';
    chat.appendChild(m); scrollEnd();
    setPet('is-talking');
    setTimeout(function () {
      m.querySelector('.as-msg__bubble').innerHTML = '<p>' + a.t + '</p>' + (a.h || '');
      scrollEnd(); fx('reveal');
      setTimeout(function () { setPet(''); }, 900);
    }, 650 + Math.random() * 300);
  }
  function ask(q) { enterChat(); me(q); fx('tap'); bot(answer(q)); }
  function scrollEnd() { requestAnimationFrame(function () { chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' }); }); }

  function open() {
    if (!page) mount();
    paintAll();
    page.classList.add('open');
    document.body.style.overflow = 'hidden';
    fx('open');
  }
  function close() {
    page.classList.remove('open');
    if (!document.querySelector('#finance-page.open')) document.body.style.overflow = '';
    fx('close');
    paintEntries();
  }

  function init() { build(); mountEntries(); paintEntries(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.Asistente = { open: open, ask: function (q) { open(); ask(q); }, data: function () { return D; } };
})();
