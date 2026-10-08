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
  function candadoSVG() {
    var u = 'cd' + (++uidN);
    return '<svg class="as-char" viewBox="0 0 200 220" aria-hidden="true">' +
    '<defs>' +
      '<radialGradient id="' + u + 'f" cx=".45" cy=".35" r=".75"><stop offset="0" stop-color="var(--as-fur-2)"/><stop offset="1" stop-color="var(--as-fur)"/></radialGradient>' +
      '<radialGradient id="' + u + 'c" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="var(--as-cream)"/></radialGradient>' +
    '</defs>' +
    '<ellipse cx="100" cy="212" rx="58" ry="7" fill="rgba(15,38,92,.16)"/>' +
    '<g class="c-body">' +
      '<path class="c-tail" d="M142 186 C168 184 182 160 174 132 C186 140 192 170 178 188 C168 198 152 198 142 194Z" fill="url(#' + u + 'f)"/>' +
      '<path d="M176 140 C184 150 184 166 178 176 C178 162 178 150 176 140Z" fill="var(--as-cream)"/>' +
      /* cuerpo sentado */
      '<path d="M58 206 C52 176 62 146 100 142 C138 146 148 176 142 206 Z" fill="url(#' + u + 'f)"/>' +
      '<path d="M74 150 C84 142 116 142 126 150 C124 170 118 190 100 194 C82 190 76 170 74 150Z" fill="url(#' + u + 'c)"/>' +
      '<path d="M86 172 q4 6 8 0 q4 6 8 0 q4 6 8 0" fill="none" stroke="#f1d6b0" stroke-width="2" stroke-linecap="round"/>' +
      '<ellipse cx="60" cy="200" rx="18" ry="11" fill="var(--as-fur)"/><ellipse cx="140" cy="200" rx="18" ry="11" fill="var(--as-fur)"/>' +
      '<rect x="78" y="186" width="18" height="24" rx="9" fill="url(#' + u + 'c)"/><rect x="104" y="186" width="18" height="24" rx="9" fill="url(#' + u + 'c)"/>' +
      '<path d="M84 206 v-5 M90 206 v-5 M110 206 v-5 M116 206 v-5" stroke="#e8c79c" stroke-width="1.6" stroke-linecap="round"/>' +
      /* collar + candado */
      '<path d="M66 142 Q100 160 134 142 L134 151 Q100 170 66 151Z" fill="var(--as-ink)"/>' +
      '<g transform="translate(100 162)"><path d="M-6 -2 v-5 a6 6 0 0 1 12 0 v5" fill="none" stroke="#c9a400" stroke-width="3"/>' +
        '<rect x="-10" y="-3" width="20" height="17" rx="4" fill="#ffdd00"/><rect x="-10" y="9" width="20" height="5" rx="2.5" fill="#f2c400"/>' +
        '<circle cx="0" cy="3.5" r="2.4" fill="var(--as-ink)"/><rect x="-1" y="4" width="2" height="5" rx="1" fill="var(--as-ink)"/></g>' +
      '<g class="c-head">' +
        /* orejas */
        '<path d="M50 84 C44 56 48 30 58 18 C64 12 70 14 74 20 C84 36 92 52 96 66 Z" fill="var(--as-saddle)"/>' +
        '<path d="M60 70 C56 50 58 34 63 26 C70 38 78 52 84 64Z" fill="var(--as-ear)"/>' +
        '<path d="M150 84 C156 56 152 30 142 18 C136 12 130 14 126 20 C116 36 108 52 104 66 Z" fill="var(--as-saddle)"/>' +
        '<path d="M140 70 C144 50 142 34 137 26 C130 38 122 52 116 64Z" fill="var(--as-ear)"/>' +
        /* cabeza con cachetes esponjosos */
        '<path d="M100 48 C138 48 160 72 160 100 C160 112 166 118 162 126 C158 132 152 130 148 134 C138 148 120 152 100 152 C80 152 62 148 52 134 C48 130 42 132 38 126 C34 118 40 112 40 100 C40 72 62 48 100 48Z" fill="url(#' + u + 'f)"/>' +
        '<path d="M64 62 C78 50 122 50 136 62 C128 72 116 76 100 76 C84 76 72 72 64 62Z" fill="var(--as-saddle)" opacity=".85"/>' +
        '<path d="M70 120 C70 100 84 96 100 96 C116 96 130 100 130 120 C130 138 116 148 100 148 C84 148 70 138 70 120Z" fill="url(#' + u + 'c)"/>' +
        '<ellipse cx="78" cy="80" rx="5" ry="3.5" fill="var(--as-cream)"/><ellipse cx="122" cy="80" rx="5" ry="3.5" fill="var(--as-cream)"/>' +
        '<g class="c-eyes">' +
          '<ellipse cx="78" cy="98" rx="10" ry="11.5" fill="var(--as-ink)"/><ellipse cx="122" cy="98" rx="10" ry="11.5" fill="var(--as-ink)"/>' +
          '<circle cx="82" cy="93" r="4" fill="#fff"/><circle cx="126" cy="93" r="4" fill="#fff"/>' +
          '<circle cx="74.5" cy="103" r="1.8" fill="#fff" opacity=".8"/><circle cx="118.5" cy="103" r="1.8" fill="#fff" opacity=".8"/>' +
        '</g>' +
        '<ellipse cx="64" cy="116" rx="9" ry="5" fill="var(--as-blush)" opacity=".45"/><ellipse cx="136" cy="116" rx="9" ry="5" fill="var(--as-blush)" opacity=".45"/>' +
        '<path d="M90 110 C90 104 110 104 110 110 C110 116 104 120 100 120 C96 120 90 116 90 110Z" fill="var(--as-ink)"/>' +
        '<ellipse cx="96" cy="108" rx="3" ry="1.8" fill="#fff" opacity=".55"/>' +
        '<path class="c-mouth-closed" d="M100 120 v4 M91 125 Q95.5 130 100 124 Q104.5 130 109 125" fill="none" stroke="var(--as-ink)" stroke-width="2.6" stroke-linecap="round"/>' +
        '<g class="c-mouth-open"><path d="M100 120 v3" stroke="var(--as-ink)" stroke-width="2.6" stroke-linecap="round"/><path d="M90 124 Q100 122 110 124 Q108 140 100 140 Q92 140 90 124Z" fill="var(--as-ink)"/><path d="M94 133 Q100 128 106 133 Q104 139 100 139 Q96 139 94 133Z" fill="#ff7d8b"/></g>' +
      '</g>' +
    '</g></svg>';
  }
  function piaSVG() {
    var u = 'pa' + (++uidN);
    return '<svg class="as-char" viewBox="0 0 200 220" aria-hidden="true">' +
    '<defs>' +
      '<radialGradient id="' + u + 'b" cx=".4" cy=".32" r=".8"><stop offset="0" stop-color="var(--as-chick-2)"/><stop offset=".55" stop-color="var(--as-chick)"/><stop offset="1" stop-color="var(--as-chick-3)"/></radialGradient>' +
      '<linearGradient id="' + u + 'k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="var(--as-beak)"/></linearGradient>' +
    '</defs>' +
    '<ellipse cx="100" cy="212" rx="52" ry="7" fill="rgba(15,38,92,.16)"/>' +
    '<g class="c-body">' +
      /* patitas */
      '<path d="M80 196 v12 M73 210 l7 -4 7 4 M120 196 v12 M113 210 l7 -4 7 4" fill="none" stroke="var(--as-beak-2)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      /* ala izquierda detrás */
      '<path d="M44 128 C26 132 22 156 34 168 C42 160 50 148 54 136Z" fill="var(--as-chick-3)"/>' +
      '<g class="c-head">' +
        /* plumitas */
        '<path d="M98 52 C90 34 94 20 104 14 C102 28 106 40 106 52Z" fill="var(--as-chick-3)"/>' +
        '<path d="M100 52 C104 36 114 28 126 28 C116 36 110 46 108 54Z" fill="var(--as-chick)"/>' +
        '<path d="M96 54 C88 42 76 38 68 42 C78 44 86 50 90 56Z" fill="var(--as-chick)"/>' +
        /* cuerpo-bolita */
        '<path d="M100 50 C146 50 164 92 164 132 C164 176 136 202 100 202 C64 202 36 176 36 132 C36 92 54 50 100 50Z" fill="url(#' + u + 'b)"/>' +
        '<ellipse cx="78" cy="78" rx="16" ry="10" fill="#fff" opacity=".35" transform="rotate(-25 78 78)"/>' +
        '<path d="M70 168 C84 182 116 182 130 168 C124 186 112 194 100 194 C88 194 76 186 70 168Z" fill="var(--as-chick-3)" opacity=".35"/>' +
        /* pañuelo navy */
        '<path d="M64 150 Q100 166 136 150 L134 158 Q100 176 66 158Z" fill="var(--as-ink)"/>' +
        '<path d="M92 164 L100 182 L108 164Z" fill="var(--as-ink)"/><circle cx="100" cy="170" r="2.4" fill="#ffdd00"/>' +
        '<g class="c-eyes">' +
          '<ellipse cx="80" cy="108" rx="9.5" ry="11" fill="var(--as-ink)"/><ellipse cx="120" cy="108" rx="9.5" ry="11" fill="var(--as-ink)"/>' +
          '<circle cx="84" cy="103" r="3.8" fill="#fff"/><circle cx="124" cy="103" r="3.8" fill="#fff"/>' +
          '<circle cx="76.5" cy="113" r="1.7" fill="#fff" opacity=".8"/><circle cx="116.5" cy="113" r="1.7" fill="#fff" opacity=".8"/>' +
        '</g>' +
        '<ellipse cx="64" cy="128" rx="10" ry="5.5" fill="var(--as-blush)" opacity=".5"/><ellipse cx="136" cy="128" rx="10" ry="5.5" fill="var(--as-blush)" opacity=".5"/>' +
        '<g class="c-mouth-closed"><path d="M88 122 Q100 114 112 122 Q100 134 88 122Z" fill="url(#' + u + 'k)"/><path d="M90 123 Q100 126 110 123" fill="none" stroke="var(--as-beak-2)" stroke-width="1.6" stroke-linecap="round"/></g>' +
        '<g class="c-mouth-open"><path d="M87 120 Q100 110 113 120 Q100 124 87 120Z" fill="url(#' + u + 'k)"/><path d="M90 126 Q100 124 110 126 Q100 140 90 126Z" fill="var(--as-beak-2)"/><path d="M93 124 Q100 122 107 124 Q100 130 93 124Z" fill="#c2410c"/></g>' +
      '</g>' +
      /* ala derecha (saluda) */
      '<path class="c-wing-r" d="M156 128 C174 132 178 156 166 168 C158 160 150 148 146 136Z" fill="var(--as-chick-3)"/>' +
    '</g></svg>';
  }

  /* ---------- Paisaje (entorno que reacciona a los hábitos) ---------- */
  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t),
        g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t),
        bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  var TREES = [
    { x: 46, y: 168, s: 1.15, t: 22 }, { x: 318, y: 164, s: 1.2, t: 30 }, { x: 96, y: 150, s: .72, t: 45 },
    { x: 268, y: 148, s: .8, t: 55 }, { x: 18, y: 186, s: 1.4, t: 66 }, { x: 350, y: 186, s: 1.3, t: 74 },
    { x: 226, y: 140, s: .55, t: 84 }, { x: 140, y: 142, s: .5, t: 90 }
  ];
  function tree(t, s, lush, fruit, i) {
    var g = mix('#9bb04a', '#2f9a48', lush), g2 = mix('#b8c063', '#49b45a', lush), g3 = mix('#c8cc7a', '#6fcf6a', lush);
    var w = 'transform="translate(' + t.x + ' ' + t.y + ') scale(' + t.s + ')"';
    var fr = fruit ? '<circle cx="-12" cy="-58" r="3.5" fill="#ffdd00"/><circle cx="10" cy="-66" r="3.5" fill="#ffdd00"/><circle cx="4" cy="-44" r="3.5" fill="#ff8a3d"/>' : '';
    return '<g ' + w + '><g class="l-grow" style="animation-delay:' + (i * 80) + 'ms"><g class="l-sway" style="animation-delay:-' + i + 's">' +
      '<rect x="-4" y="-34" width="8" height="34" rx="3" fill="#8a5a36"/>' +
      '<circle cx="0" cy="-52" r="24" fill="' + g + '"/><circle cx="-14" cy="-40" r="16" fill="' + g + '"/><circle cx="14" cy="-40" r="16" fill="' + g + '"/>' +
      '<circle cx="-6" cy="-60" r="13" fill="' + g2 + '"/><circle cx="-10" cy="-64" r="6" fill="' + g3 + '"/>' + fr +
    '</g></g></g>';
  }
  function landSVG(score) {
    var t = Math.max(0, Math.min(1, score / 100)), r = rng(7), out = [];
    var sky1 = mix('#f6dfb4', '#9fd8ff', t), sky2 = mix('#fbefd6', '#e4f6ff', t);
    var far = mix('#d6b88a', '#7cc27a', t), mid = mix('#e0c597', '#5fb35c', t), near = mix('#e9d2a6', '#78c768', t);
    out.push('<svg class="as-land" viewBox="0 0 360 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">');
    out.push('<defs><linearGradient id="lsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky1 + '"/><stop offset="1" stop-color="' + sky2 + '"/></linearGradient></defs>');
    out.push('<rect width="360" height="240" fill="url(#lsky)"/>');
    out.push('<circle cx="292" cy="48" r="20" fill="#ffe36b"/><circle cx="292" cy="48" r="30" fill="#ffe36b" opacity=".25"/>');
    out.push('<g class="l-cloud" opacity=".95"><ellipse cx="60" cy="40" rx="26" ry="10" fill="#fff"/><ellipse cx="76" cy="34" rx="16" ry="10" fill="#fff"/></g>');
    out.push('<g class="l-cloud b" opacity=".8"><ellipse cx="10" cy="70" rx="20" ry="8" fill="#fff"/><ellipse cx="22" cy="65" rx="12" ry="8" fill="#fff"/></g>');
    if (score >= 70) out.push('<g class="l-bird" fill="none" stroke="#0f265c" stroke-width="1.6" stroke-linecap="round"><path d="M0 60 q5 -5 10 0 q5 -5 10 0"/><path d="M26 50 q4 -4 8 0 q4 -4 8 0"/></g>');
    out.push('<path d="M0 132 C60 108 120 120 180 112 C240 104 300 116 360 106 L360 240 L0 240Z" fill="' + far + '"/>');
    out.push('<path d="M0 160 C70 140 130 152 200 144 C260 138 310 150 360 140 L360 240 L0 240Z" fill="' + mid + '"/>');
    if (score >= 40) out.push('<path class="l-water" d="M232 146 C210 170 252 184 214 204 C190 218 214 232 196 240 L236 240 C256 228 228 214 252 202 C284 184 246 170 262 146Z" fill="' + mix('#9ccbe0', '#4fb0e8', t) + '"/>');
    else if (score >= 15) out.push('<path d="M240 150 C232 170 248 182 232 200 C222 214 232 228 226 240 L236 240 C242 228 232 214 244 200 C258 184 244 170 248 150Z" fill="#b9cfd6" opacity=".7"/>');
    out.push('<path d="M0 190 C80 176 150 186 220 180 C280 176 320 186 360 182 L360 240 L0 240Z" fill="' + near + '"/>');
    if (score < 30) [[60, 214], [300, 210], [150, 226]].forEach(function (p) { out.push('<path d="M' + p[0] + ' ' + p[1] + ' l-6 -4 M' + p[0] + ' ' + p[1] + ' l6 -5 M' + p[0] + ' ' + p[1] + ' v-8" stroke="#a5875a" stroke-width="2" stroke-linecap="round"/>'); });
    if (score < 22) out.push('<g transform="translate(56 176)"><path d="M0 0 v-30 M0 -18 l-10 -10 M0 -24 l9 -8" stroke="#8a5a36" stroke-width="4" stroke-linecap="round" fill="none"/></g>');
    TREES.forEach(function (tr, i) {
      if (score >= tr.t) out.push(tree(tr, tr.s, t, score >= 80, i));
      else if (score >= tr.t - 14) out.push('<g transform="translate(' + tr.x + ' ' + tr.y + ')"><g class="l-grow"><rect x="-1.5" y="-14" width="3" height="14" fill="#6b8f3a"/><ellipse cx="-5" cy="-14" rx="6" ry="3.5" fill="#7fc25a"/><ellipse cx="5" cy="-16" rx="6" ry="3.5" fill="#8fd16a"/></g></g>');
    });
    if (score >= 35) [[110, 198], [262, 204], [330, 214], [24, 222]].forEach(function (p, i) {
      out.push('<g class="l-grow" style="animation-delay:' + (300 + i * 90) + 'ms"><ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="16" ry="10" fill="' + mix('#a9b860', '#3fa64f', t) + '"/><ellipse cx="' + (p[0] - 6) + '" cy="' + (p[1] - 4) + '" rx="8" ry="5" fill="' + mix('#c3c977', '#62c264', t) + '"/></g>');
    });
    if (score >= 55) {
      var cols = ['#ff7eb6', '#ffdd00', '#ffffff', '#ff9a3d', '#b38cff'];
      for (var i = 0; i < Math.round((score - 50) / 2.5); i++) {
        var x = 8 + r() * 344, y = 196 + r() * 40;
        if (x > 120 && x < 240 && y < 226) continue; // espacio del personaje
        out.push('<g class="l-grow" style="animation-delay:' + (500 + i * 30) + 'ms"><path d="M' + x.toFixed(0) + ' ' + y.toFixed(0) + ' v6" stroke="#3a8f3f" stroke-width="1.2"/><circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="3" fill="' + cols[i % cols.length] + '"/><circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="1.1" fill="#ffdd00"/></g>');
      }
    }
    if (score >= 85) out.push('<g class="l-bfly" transform="translate(84 150)"><path d="M0 0 c-6 -8 -12 -2 -6 4z M0 0 c6 -8 12 -2 6 4z" fill="#ff7eb6"/></g><g class="l-bfly" style="animation-delay:-3s" transform="translate(286 176)"><path d="M0 0 c-6 -8 -12 -2 -6 4z M0 0 c6 -8 12 -2 6 4z" fill="#ffdd00"/></g>');
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
    return '<div class="as-bars">' + rows.map(function (r) {
      return '<div class="as-bar" style="--c:' + (r.c || CATS[r.k].c) + '"><span>' + esc(r.label || CATS[r.k].name) + '</span><span>' + money(r.v) + '</span><u><i style="width:' + Math.max(3, r.v / max * 100).toFixed(0) + '%"></i></u></div>';
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
    return 'Vas en ritmo con tus metas y tu paisaje está ' + level(D.score).n.toLowerCase() + ' 🌳';
  }

  /* ---------- Entradas: Inicio y Modo finanzas ---------- */
  function entryHTML(where) {
    return '<button class="as-entry" data-as-open="' + where + '" aria-label="Abrir asistente de finanzas">' +
      '<span class="as-entry__scene"></span><span class="as-entry__pet"></span>' +
      '<span class="as-entry__body"><span class="as-entry__eyebrow">Asistente de finanzas</span>' +
      '<span class="as-entry__title"></span><span class="as-entry__insight"></span>' +
      '<span class="as-entry__ask"><span class="material-symbols-rounded">chat_bubble</span>Pregúntame</span></span></button>';
  }
  function mountEntries() {
    var home = document.querySelector('.tab-panel[data-panel="Destacado"]');
    if (home && !home.querySelector('[data-as-open]')) {
      var anchor = Array.prototype.find.call(home.querySelectorAll('.section'), function (s) {
        var h = s.querySelector('.section__title h2'); return h && /Novedades/.test(h.textContent);
      });
      var sec = document.createElement('section');
      sec.className = 'section';
      sec.innerHTML = '<div class="section__title"><h2>Tu asistente</h2></div>' + entryHTML('home');
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
      b.querySelector('.as-entry__scene').innerHTML = landSVG(D.score);
      b.querySelector('.as-entry__pet').innerHTML = C().svg();
      b.querySelector('.as-entry__title').textContent = 'Pregúntale a ' + C().name;
      b.querySelector('.as-entry__insight').textContent = insight();
    });
  }

  /* ---------- Pantalla del asistente ---------- */
  var page, chat, input, heroPet;
  function mount() {
    page = document.createElement('div');
    page.className = 'as-page';
    page.setAttribute('role', 'dialog');
    page.setAttribute('aria-modal', 'true');
    page.innerHTML =
      '<div class="as-top">' +
        '<button class="as-icon-btn" data-as="close" aria-label="Volver"><span class="material-symbols-rounded">arrow_back</span></button>' +
        '<div class="as-top__title"><b class="as-name"></b><span class="as-role"></span></div>' +
        '<div class="as-switch" role="group" aria-label="Elegir asistente">' +
          '<button data-who="candado">Candado</button><button data-who="pia">PIA</button></div>' +
      '</div>' +
      '<div class="as-scroll">' +
        '<div class="as-hero"><div class="as-land-wrap"></div>' +
          '<div class="as-hero__badge"><i></i><span></span></div>' +
          '<div class="as-hero__demo"><div class="as-demo" role="group" aria-label="Simular escenario (demo)">' +
            '<button data-sc="dificil">Difícil</button><button data-sc="normal">Normal</button><button data-sc="excelente">Excelente</button></div></div>' +
          '<div class="as-hero__pet" role="button" tabindex="0" aria-label="Saludar"></div>' +
        '</div>' +
        '<div class="as-section"><h2>Qué hace crecer tu paisaje</h2><p>Tu asistente siempre está contigo; tus hábitos cambian su entorno.</p><div class="as-growth"></div></div>' +
        '<div class="as-chat" aria-live="polite"></div>' +
      '</div>' +
      '<div class="as-composer"><div class="as-chips"></div>' +
        '<form class="as-input"><input type="text" enterkeyhint="send" autocomplete="off" placeholder="Pregunta sobre tus finanzas…" aria-label="Escribe tu pregunta">' +
        '<button class="as-send" type="submit" aria-label="Enviar"><span class="material-symbols-rounded">arrow_upward</span></button></form></div>';
    document.body.appendChild(page);
    chat = page.querySelector('.as-chat');
    input = page.querySelector('input');
    page.querySelector('.as-chips').innerHTML = SUGGEST.map(function (q) { return '<button class="as-chip" type="button">' + q + '</button>'; }).join('');
    page.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-as="close"]'))) return close();
      if ((b = e.target.closest('[data-who]'))) { if (ST.who !== b.dataset.who) { ST.who = b.dataset.who; persist(); fx('toggle'); paintAll(); greet(true); } return; }
      if ((b = e.target.closest('[data-sc]'))) { if (ST.scenario !== b.dataset.sc) { ST.scenario = b.dataset.sc; persist(); build(); fx(D.score >= 55 ? 'success' : 'select'); paintAll(); bot(summary()); } return; }
      if ((b = e.target.closest('.as-chip'))) return ask(b.textContent);
    });
    page.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); var v = input.value.trim(); if (v) { input.value = ''; ask(v); } });
    input.addEventListener('focus', function () { setPet('is-listening'); });
    input.addEventListener('blur', function () { setPet(''); });
    var hp = page.querySelector('.as-hero__pet');
    hp.addEventListener('click', function () { fx('select'); setPet('is-happy'); setTimeout(function () { setPet(''); }, 650); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && page.classList.contains('open')) { e.stopImmediatePropagation(); close(); } }, true);
  }
  function setPet(cls) {
    var svg = page && page.querySelector('.as-hero__pet .as-char');
    if (!svg) return;
    svg.classList.remove('is-listening', 'is-happy', 'is-talking');
    if (cls) svg.classList.add(cls);
  }
  function paintAll() {
    paintEntries();
    if (!page) return;
    var lv = level(D.score);
    page.querySelector('.as-name').textContent = C().name;
    page.querySelector('.as-role').textContent = 'Analiza tus últimos 3 meses';
    page.querySelectorAll('[data-who]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.who === ST.who)); });
    page.querySelectorAll('[data-sc]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.sc === ST.scenario)); });
    page.querySelector('.as-land-wrap').innerHTML = landSVG(D.score);
    page.querySelector('.as-hero__pet').innerHTML = C().svg();
    var badge = page.querySelector('.as-hero__badge');
    badge.style.setProperty('--lvl', lv.c);
    badge.querySelector('span').textContent = lv.n;
    page.querySelector('.as-growth').innerHTML = Object.keys(D.f).map(function (k) {
      var f = D.f[k];
      return '<div class="as-factor ' + (f.ok ? 'is-good' : 'is-warn') + '" style="--c:' + f.c + '"><span class="as-factor__top"><span class="material-symbols-rounded">' + f.icon + '</span>' + f.label + '</span><b>' + f.val + '</b><small>' + f.note + '</small></div>';
    }).join('');
  }
  function avatar() { return '<div class="as-msg__av">' + C().svg() + '</div>'; }
  function me(text) {
    var m = document.createElement('div');
    m.className = 'as-msg as-msg--me';
    m.innerHTML = '<div class="as-msg__bubble"><p>' + esc(text) + '</p></div>';
    chat.appendChild(m); scrollEnd();
  }
  function bot(a, delay, quiet) {
    var m = document.createElement('div');
    m.className = 'as-msg';
    m.innerHTML = avatar() + '<div class="as-msg__bubble"><span class="as-typing" aria-label="Escribiendo"><i></i><i></i><i></i></span></div>';
    chat.appendChild(m); if (!quiet) scrollEnd();
    setPet('is-talking');
    setTimeout(function () {
      m.querySelector('.as-msg__bubble').innerHTML = '<p>' + a.t + '</p>' + (a.h || '');
      if (!quiet) scrollEnd(); fx('reveal');
      setTimeout(function () { setPet(''); }, 900);
    }, delay == null ? 650 + Math.random() * 300 : delay);
  }
  function ask(q) { me(q); fx('tap'); bot(answer(q)); }
  function scrollEnd() { var sc = page.querySelector('.as-scroll'); requestAnimationFrame(function () { sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' }); }); }
  function greet(switched) {
    bot({ t: (switched ? C().hi + ' Desde ahora te acompaño yo. ' : C().hi + ' ') + 'Analizo tus movimientos de los últimos 3 meses. ' + insight() }, switched ? 400 : 500, !switched);
  }

  function open() {
    if (!page) { mount(); }
    paintAll();
    if (!chat.children.length) greet(false);
    page.classList.add('open');
    document.body.style.overflow = 'hidden';
    fx('open');
  }
  function close() {
    page.classList.remove('open');
    // Si se abrió desde Modo finanzas, éste sigue abierto debajo y
    // necesita el scroll del body bloqueado.
    if (!document.querySelector('#finance-page.open')) document.body.style.overflow = '';
    fx('close');
    paintEntries();
  }

  function init() { build(); mountEntries(); paintEntries(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.Asistente = { open: open, ask: function (q) { open(); ask(q); }, data: function () { return D; } };
})();
