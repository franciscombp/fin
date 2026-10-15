/* =====================================================================
   Mis finanzas (PFM) sobre la Base de datos PFM
   Datos: assets/pfm/datos.json (cuatro usuarios ficticios, oct 2025 a
   oct 2026; se arma con tools/pfm-datos.py). Reglas: documento "PFM —
   concepto de rediseño".

   Dos modos para comparar (demo):
   - MVP: lo que entra en la fase 1. Uku pregunta (Por revisar), explica
     por qué algo suma o no y cuenta hallazgos con textos predefinidos.
     Solo Pichibank y Deuna; nada de IA.
   - To-be: la visión con Uku a futuro. Predicción de cierre, próximos
     cobros, presupuesto sugerido, tarjetas de otros bancos conectadas,
     negocio separado del hogar, todas las deudas y "Analizar con Uku" (IA).

   Cada movimiento pasa por uno de siete tratamientos antes de sumar:
   Gasto, Ingreso, Reembolso, Por revisar, Excluido, Detalle Deuna y
   Fuera del MVP. Lo que la persona responde a Uku se aplica a los
   movimientos parecidos (misma persona, mismo sentido) y se puede deshacer.
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'pb_pfm_v1';
  var ST = { u: 'andres', modo: 'mvp', mes: null, per: 'mes', resp: {}, cats: {}, pres: {} };
  try { var sv = JSON.parse(localStorage.getItem(KEY)); if (sv) ST = Object.assign(ST, sv); } catch (e) {}
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) {} }
  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function T(s, v) { return window.I18n ? I18n.t(s, v) : s.replace(/\{(\w+)\}/g, function (m, k) { return v && k in v ? v[k] : m; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(v) {
    var s = Math.abs(v).toFixed(2).split('.');
    return (v < 0 ? '−' : '') + '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  }
  function money0(v) { return money(v).replace(/,00$/, ''); }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function r2(v) { return Math.round(v * 100) / 100; }
  var ASSET = (document.currentScript && document.currentScript.src || location.href).replace(/[^/]*$/, '');
  function tobe() { return ST.modo === 'tobe'; }

  /* ---------- Fechas ---------- */
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIA = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
  function mesName(m) { return MES[+m.slice(5, 7) - 1]; }
  function Mes(m) { var n = mesName(m); return n.charAt(0).toUpperCase() + n.slice(1); }
  function mesLargo(m) { return mesName(m) + (m.slice(0, 4) !== HOY.slice(0, 4) ? ' de ' + m.slice(0, 4) : ''); }
  function dshort(f) { return +f.slice(8, 10) + ' ' + MES[+f.slice(5, 7) - 1].slice(0, 3); }
  function prevMes(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1; if (!mo) { y--; mo = 12; } return y + '-' + (mo < 10 ? '0' : '') + mo; }
  function nextMes(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) + 1; if (mo > 12) { y++; mo = 1; } return y + '-' + (mo < 10 ? '0' : '') + mo; }
  function diasMes(m) { return new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(); }
  function addDays(f, n) { var d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function wday(f) { return new Date(f + 'T12:00:00').getDay(); }

  /* ---------- Catálogo: 13 categorías del PFM + las que no se pueden inferir ---------- */
  var CAT = {
    'Vivienda': 'home', 'Alimentación': 'restaurant', 'Transporte': 'directions_bus', 'Servicios básicos': 'bolt',
    'Salud y bienestar': 'medical_services', 'Educación': 'school', 'Compras personales': 'shopping_bag', 'Entretenimiento': 'theater_comedy',
    'Familia y dependientes': 'family_restroom', 'Servicios financieros y deudas': 'account_balance', 'Ahorro e inversión': 'savings',
    'Gobierno e impuestos': 'gavel', 'Otros': 'category',
    // Lo que el banco no puede categorizar solo (barras grises)
    'Efectivo retirado': 'local_atm', 'Transferencias a personas': 'person', 'Pagos a empresas': 'business',
    'Tarjetas de otros bancos': 'credit_card', 'Negocio': 'storefront'
  };
  var PFM13 = ['Vivienda', 'Alimentación', 'Transporte', 'Servicios básicos', 'Salud y bienestar', 'Educación', 'Compras personales', 'Entretenimiento', 'Familia y dependientes', 'Servicios financieros y deudas', 'Ahorro e inversión', 'Gobierno e impuestos', 'Otros'];
  var GRIS = { 'Efectivo retirado': 1, 'Transferencias a personas': 1, 'Pagos a empresas': 1, 'Tarjetas de otros bancos': 1 };
  var MAPC = { 'Restaurantes': 'Alimentación', 'Hogar': 'Compras personales', 'Salud': 'Salud y bienestar', 'Transferencia a persona': 'Transferencias a personas',
    'Pago a empresa': 'Pagos a empresas', 'Tarjetas de otros bancos (sin detalle)': 'Tarjetas de otros bancos', 'Pagos con Deuna': 'Otros' };
  function mapc(c) { return MAPC[c] || (CAT[c] ? c : 'Otros'); }
  var ING_IC = { 'Sueldo': 'work', 'Pensión': 'elderly', 'Remesa': 'flight_land', 'Ingresos del negocio': 'storefront', 'Intereses': 'percent',
    'Aporte del hogar': 'home', 'Trabajo independiente': 'work', 'Otros ingresos': 'south_west' };

  /* ---------- Datos ---------- */
  var DB = null, HOY = '2026-10-15', loading = null;
  function load() {
    if (!loading) loading = fetch(ASSET + 'pfm/datos.json').then(function (r) { return r.json(); }).then(function (d) {
      HOY = d.hoy; var D = d.dic, U = {};
      Object.keys(d.movimientos).forEach(function (u) {
        U[u] = d.movimientos[u].map(function (r, i) {
          return { i: i, f: r[0], h: r[1], mes: r[0].slice(0, 7), dia: +r[0].slice(8, 10), src: D.fuente[r[2]], prod: D.producto[r[3]], desc: D.descripcion[r[4]],
            cp: D.contraparte[r[5]], m: r[6], t: D.tratamiento[r[7]], c: D.categoria[r[8]], e: D.escenario[r[9]], n: D.nota[r[10]] };
        });
      });
      DB = { mov: U, usuarios: d.usuarios, deudas: d.deudas, escenarios: d.escenarios, hipoteca: d.hipoteca };
      if (!DB.mov[ST.u]) ST.u = 'andres';
      cache = {};
      return DB;
    });
    return loading;
  }
  function user() { return DB.usuarios.filter(function (x) { return x.usuario === ST.u; })[0]; }
  function nombre() { return user().nombre.split(' ')[0]; }
  function rows() { return DB.mov[ST.u]; }
  function meses() { // del más reciente al más antiguo
    var s = {}; rows().forEach(function (r) { s[r.mes] = 1; });
    return Object.keys(s).sort().reverse();
  }
  function curMes() { var ms = meses(); return ST.mes && ms.indexOf(ST.mes) >= 0 ? ST.mes : ms[0]; }

  /* ---------- Preguntas de Uku (Por revisar) ----------
     Una pregunta por persona y sentido. Las opciones dependen de lo que el
     banco alcanza a sospechar (el escenario) y la sugerida va primero. */
  var OPT = {
    // l: el botón; d: la misma idea dicha por Uku ("Creo que…", "Me dijiste que…")
    hogar:     { l: 'Aporte del hogar', d: 'es un aporte para el hogar', k: 'ingreso', cat: 'Aporte del hogar' },
    trabajo:   { l: 'Pago por un trabajo', d: 'es el pago de un trabajo', k: 'ingreso', cat: 'Trabajo independiente' },
    ingreso:   { l: 'Es un ingreso', d: 'es un ingreso', k: 'ingreso', cat: 'Otros ingresos' },
    reemb:     { l: 'Me devolvió parte de un gasto', d: 'te devolvió parte de un gasto', k: 'reembolso', cat: 'Alimentación' },
    prestRec:  { l: 'Me prestó', d: 'es un préstamo que te hicieron', k: 'no', why: 'prestamo_recibido' },
    cobro:     { l: 'Me está pagando un préstamo', d: 'te está pagando un préstamo', k: 'no', why: 'cobro' },
    preste:    { l: 'Le presté', d: 'es un préstamo que hiciste', k: 'no', why: 'prestamo_dado' },
    pagoDeuda: { l: 'Le estoy pagando un préstamo', d: 'estás pagando un préstamo', k: 'gasto', cat: 'Servicios financieros y deudas' },
    familia:   { l: 'Ayuda a mi familia', d: 'es ayuda para tu familia', k: 'gasto', cat: 'Familia y dependientes' },
    tienda:    { l: 'Es para mi negocio', d: 'es para tu negocio', k: 'negocio', cat: 'Negocio' },
    casa:      { l: 'Es para la casa', d: 'es para la casa', k: 'gasto', cat: 'Alimentación' },
    gasto:     { l: 'Es otro gasto', d: 'es otro gasto', k: 'gasto', cat: 'Otros' }
  };
  var TPL = {
    'Aporte de pareja+':           { q: '¿Qué es la plata que te manda {n} cada mes?', o: ['hogar', 'prestRec', 'reemb'] },
    'Préstamo a amigo+':           { q: '¿{n} te está devolviendo un préstamo?', o: ['cobro', 'ingreso', 'reemb'] },
    'Préstamo a familiar+':        { q: '¿{n} te está devolviendo un préstamo?', o: ['cobro', 'ingreso', 'reemb'] },
    'Préstamo a amigo-':           { q: '¿Qué fue lo que le enviaste a {n}?', o: ['preste', 'familia', 'gasto'] },
    'Préstamo a familiar-':        { q: '¿Qué fue lo que le enviaste a {n}?', o: ['preste', 'familia', 'gasto'] },
    'Préstamo a vecina-':          { q: '¿Qué fue lo que le enviaste a {n}?', o: ['preste', 'familia', 'gasto'] },
    'Préstamo de familiar+':       { q: '¿{n} te prestó dinero?', o: ['prestRec', 'ingreso', 'reemb'] },
    'Préstamo de familiar-':       { q: '¿Qué le pagas a {n}?', o: ['pagoDeuda', 'familia', 'gasto'] },
    'Cuenta dividida+':            { q: '¿{n} te devolvió parte de una cuenta?', o: ['reemb', 'ingreso', 'prestRec'] },
    'Ingresos freelance+':         { q: '¿Qué te pagó {n}?', o: ['trabajo', 'reemb', 'prestRec'] },
    'Negocio y personal mezclados-': { q: '¿Lo que le pagas a {n} es para tu negocio o para la casa?', o: ['tienda', 'casa', 'gasto'] },
    '+': { q: '¿Qué es la plata que te llegó de {n}?', o: ['ingreso', 'reemb', 'prestRec'] },
    '-': { q: '¿Qué fue lo que le enviaste a {n}?', o: ['gasto', 'familia', 'preste'] }
  };
  function gkey(r) { return r.cp + '|' + (r.m > 0 ? '+' : '-'); }
  function resp() { return ST.resp[ST.u] || (ST.resp[ST.u] = {}); }
  function answerOf(r) { var a = r.t === 'Por revisar' && resp()[gkey(r)]; return a ? OPT[a] : null; }
  function tplOf(r) { var s = r.m > 0 ? '+' : '-'; return TPL[r.e + s] || TPL[s]; }
  function corto(n) { var p = String(n).split(' '); return p.length > 2 ? p[0] + ' ' + p[1] : n; }

  /* ---------- Tratamiento de cada movimiento ----------
     Devuelve { k, cat, why } — k: gasto | ingreso | reembolso | rin
     (entrada por revisar) | rout (salida por revisar) | no (no suma). */
  function catOv(r) { var o = ST.cats[ST.u]; return o && o[r.i]; }
  function isRecarga(r) { return r.t === 'Gasto' && /^tú \(Deuna\)/.test(r.cp); }
  function cls(r) {
    var a = answerOf(r), ov = catOv(r);
    if (a) {
      if (a.k === 'negocio') return tobe() ? { k: 'no', why: 'negocio', cat: 'Negocio' } : { k: 'gasto', cat: 'Negocio', ans: a };
      return { k: a.k, cat: ov || a.cat, why: a.why, ans: a };
    }
    switch (r.t) {
      case 'Gasto':
        if (isRecarga(r)) return { k: 'no', why: 'recarga' };
        if (r.c === 'Tarjetas de otros bancos (sin detalle)' && tobe()) return { k: 'no', why: 'pago_otro_banco' };
        return { k: 'gasto', cat: ov || mapc(r.c) };
      case 'Detalle Deuna': return r.m < 0 ? { k: 'gasto', cat: ov || mapc(r.c), via: 'deuna' } : { k: 'no', why: 'deuna_in' };
      case 'Por revisar': return r.m > 0 ? { k: 'rin' } : { k: 'rout', cat: mapc(r.c) };
      case 'Fuera del MVP': return tobe() ? { k: 'gasto', cat: ov || mapc(r.c), via: 'otro_banco' } : { k: 'no', why: 'fuera' };
      case 'Ingreso': return { k: 'ingreso', cat: r.c };
      case 'Reembolso': return { k: 'reembolso', cat: ov || mapc(r.c) };
      default: return { k: 'no', why: r.c === 'Ahorro programado' ? 'ahorro' : r.c === 'Pago de tarjeta' ? 'pago_tarjeta' : r.c === 'Recarga Deuna' ? 'recarga_in' : 'propias' };
    }
  }

  /* ---------- Cifras de un periodo ---------- */
  var cache = {};
  function ckey() { return ST.u + '|' + ST.modo + '|' + JSON.stringify(resp()) + '|' + JSON.stringify(ST.cats[ST.u] || {}); }
  function sum(list) {
    var o = { gast: 0, ing: 0, rin: 0, rout: 0, reemb: 0, fuera: 0, cats: {}, inc: {}, n: list.length, rows: list };
    list.forEach(function (r) {
      var c = cls(r), v = Math.abs(r.m);
      if (c.k === 'gasto' || c.k === 'rout') { o.cats[c.cat] = (o.cats[c.cat] || 0) + v; if (c.k === 'rout') o.rout += v; }
      else if (c.k === 'reembolso') { o.cats[c.cat] = (o.cats[c.cat] || 0) - v; o.reemb += v; }
      else if (c.k === 'ingreso') { o.ing += v; o.inc[c.cat] = (o.inc[c.cat] || 0) + v; }
      else if (c.k === 'rin') o.rin += v;
      if (r.t === 'Fuera del MVP') o.fuera += v;
    });
    // Una categoría no queda en negativo: lo devuelto de más no se resta
    Object.keys(o.cats).forEach(function (k) { o.cats[k] = Math.max(0, r2(o.cats[k])); if (!o.cats[k]) delete o.cats[k]; o.gast += o.cats[k] || 0; });
    o.gast = r2(o.gast); o.ing = r2(o.ing); o.rin = r2(o.rin);
    return o;
  }
  function month(m, hasta) {
    var k = ckey() + '|' + m + '|' + (hasta || '');
    if (!cache[k]) cache[k] = sum(rows().filter(function (r) { return r.mes === m && (!hasta || r.dia <= hasta); }));
    return cache[k];
  }
  function range(a, b) { return sum(rows().filter(function (r) { return r.f >= a && r.f <= b; })); }
  function isCur(m) { return m === HOY.slice(0, 7); }
  function finDe(m) { return isCur(m) ? HOY : m + '-' + diasMes(m); }
  function periodo(m) {
    if (ST.per === 'sem') { var f = finDe(m); return { o: range(addDays(f, -6), f), l: T('del {a} al {b}', { a: dshort(addDays(f, -6)), b: dshort(f) }) }; }
    if (ST.per === 'ano') { var a = prevMes(m); for (var i = 0; i < 10; i++) a = prevMes(a); return { o: range(a + '-01', finDe(m)), l: T('de {a} a {b}', { a: mesLargo(a), b: mesLargo(m) }) }; }
    return { o: month(m), l: T('en {mes}', { mes: mesLargo(m) }) };
  }
  // Meses anteriores con datos (para comparar hace falta historia)
  function antes(m, n) { var ms = meses().filter(function (x) { return x < m; }); return ms.slice(0, n); }
  function prom(m, n) {
    var ms = antes(m, n); if (!ms.length) return null;
    var o = { gast: 0, cats: {} };
    ms.forEach(function (x) { var s = month(x); o.gast += s.gast / ms.length; Object.keys(s.cats).forEach(function (k) { o.cats[k] = (o.cats[k] || 0) + s.cats[k] / ms.length; }); });
    o.n = ms.length; return o;
  }

  /* ---------- Presupuesto ----------
     MVP: general en el onboarding y por categoría. Si la persona no lo puso,
     el prototipo arranca con uno parecido a su promedio (en el to-be, Uku lo
     sugiere con 2 o 3 meses de historia). */
  function round(v, s) { return Math.max(s, Math.round(v / s) * s); }
  function sugerido(m) {
    var p = prom(m, 3); if (!p) return null;
    var cats = {};
    Object.keys(p.cats).filter(function (k) { return !GRIS[k] && p.cats[k] >= 25; }).sort(function (a, b) { return p.cats[b] - p.cats[a]; }).slice(0, 5)
      .forEach(function (k) { cats[k] = round(p.cats[k] * 1.05, 10); });
    return { general: round(p.gast * 1.05, 50), cats: cats };
  }
  function pres() {
    var p = ST.pres[ST.u];
    if (p) return p;
    var s = sugerido(meses()[0]) || { general: 1000, cats: {} };
    return { general: s.general, cats: s.cats, auto: true };
  }
  function setPres(p) { ST.pres[ST.u] = { general: p.general, cats: p.cats }; persist(); }

  /* ---------- Uku cuenta: hallazgos con reglas (MVP) ---------- */
  function hallazgos(m) {
    var s = month(m), out = [], cur = isCur(m), prev = prevMes(m), hasPrev = meses().indexOf(prev) >= 0;
    // Comparación con el mes anterior, al mismo día del mes
    if (hasPrev) {
      var dd = cur ? +HOY.slice(8, 10) : 31, p = month(prev, cur ? dd : null), d = s.gast - p.gast;
      if (p.gast > 0 && Math.abs(d) / p.gast >= .05) {
        var ch = Object.keys(Object.assign({}, s.cats, p.cats)).filter(function (k) { return !GRIS[k]; })
          .map(function (k) { return { k: k, d: (s.cats[k] || 0) - (p.cats[k] || 0) }; })
          .sort(function (a, b) { return d > 0 ? b.d - a.d : a.d - b.d; })[0];
        out.push({ icon: d > 0 ? 'trending_up' : 'trending_down', kind: d > 0 ? 'warn' : 'good',
          t: T(d > 0 ? 'Gastaste {pct} más que en {mes}' : 'Gastaste {pct} menos que en {mes}', { pct: pct(Math.abs(d) / p.gast), mes: mesName(prev) }) + (cur ? ' ' + T('a esta altura') : ''),
          s: ch && Math.abs(ch.d) >= 10 ? T(ch.d > 0 ? 'Lo que más subió fue {cat}: {monto} más.' : 'Lo que más bajó fue {cat}: {monto} menos.', { cat: ch.k.toLowerCase(), monto: money(Math.abs(ch.d)) }) : T('Comparo hasta el mismo día del mes.'), ask: '¿En qué se me va la plata?' });
      }
    }
    var ms = antes(m, 3);
    if (ms.length < 3) {
      out.push({ icon: 'hourglass_top', kind: 'info', t: T('Todavía te estoy conociendo'), s: hasPrev ? T('Con tres meses de movimientos te cuento tus tendencias. Por ahora solo comparo con el mes anterior.') : T('Con tres meses de movimientos te cuento tus tendencias y te comparo con tus meses anteriores.') });
    } else {
      // Una categoría que subió frente a tu promedio
      var av = prom(m, 3), up = Object.keys(s.cats).filter(function (k) { return !GRIS[k] && av.cats[k] > 15; })
        .map(function (k) { return { k: k, r: s.cats[k] / av.cats[k] - 1, d: s.cats[k] - av.cats[k] }; })
        .filter(function (x) { return x.r >= .2 && x.d >= 20; }).sort(function (a, b) { return b.d - a.d; })[0];
      if (up && !cur) out.push({ icon: CAT[up.k], kind: 'warn', t: T('Tus gastos de {cat} aumentaron {pct}', { cat: up.k.toLowerCase(), pct: pct(up.r) }),
        s: T('Fueron {monto}; tu promedio de los últimos tres meses es {prom}.', { monto: money(s.cats[up.k]), prom: money(av.cats[up.k]) }), ask: '¿En qué se me va la plata?' });
      // El día de la semana que concentra el gasto
      var by = [0, 0, 0, 0, 0, 0, 0], tot = 0, desde = antes(m, 2).concat([m]);
      rows().forEach(function (r) { if (desde.indexOf(r.mes) < 0) return; var c = cls(r); if (c.k === 'gasto' && !GRIS[c.cat] && Math.abs(r.m) < 300) { by[wday(r.f)] += -r.m; tot -= r.m; } });
      var top = by.indexOf(Math.max.apply(null, by));
      if (tot && by[top] / tot > .2) out.push({ icon: 'calendar_today', kind: 'info', t: T('Los {dia} concentras tus gastos del día a día', { dia: DIA[top] }),
        s: T('Se va el {pct} de lo que gastas en comida, transporte y salidas, sin contar arriendo ni cuotas.', { pct: pct(by[top] / tot) }) });
    }
    // Meses especiales: no son una mala noticia
    var esp = {}; s.rows.forEach(function (r) { if (/Décimos|Matrícula|Gastos anuales/.test(r.e)) esp[r.e] = 1; });
    var el = Object.keys(esp);
    if (el.length) out.push({ icon: 'event', kind: 'info', t: T('{mes} es un mes especial', { mes: Mes(m) }), s: T('Tuvo {que}. Lo marco para que no se compare como un mes normal.', { que: el.join(' y ').toLowerCase() }) });
    // Tarjetas de otros bancos: avisar si baja al mínimo
    var min = s.rows.filter(function (r) { return /mínimo/i.test(r.n) && r.c === 'Tarjetas de otros bancos (sin detalle)'; })[0];
    if (min) out.push({ icon: 'credit_card', kind: 'warn', t: T('Pagaste solo el mínimo de tu {t}', { t: min.cp === 'Banco Guayaquil' ? 'Visa Banco Guayaquil' : min.cp }),
      s: T('Pagaste {monto}. Con el mínimo la deuda sigue creciendo.', { monto: money(-min.m) }), ask: '¿Cuánto debo?' });
    // Remesas: su peso en el ingreso
    if (s.inc.Remesa && s.ing) out.push({ icon: 'flight_land', kind: 'info', t: T('La remesa fue el {pct} de tus ingresos', { pct: pct(s.inc.Remesa / s.ing) }), s: T('Llegaron {monto} de afuera en {mes}.', { monto: money(s.inc.Remesa), mes: mesName(m) }) });
    // Efectivo: categoría propia, sin pedir detalle
    if (s.cats['Efectivo retirado'] >= 100) out.push({ icon: 'local_atm', kind: 'info', t: T('Retiraste {monto} en efectivo', { monto: money(s.cats['Efectivo retirado']) }), s: T('No sé en qué lo usaste, y está bien: lo dejo como Efectivo retirado.') });
    return out;
  }

  /* ---------- Uku anticipa (to-be) ---------- */
  var FIJO = { 'Vivienda': 1, 'Servicios básicos': 1, 'Educación': 1, 'Servicios financieros y deudas': 1, 'Familia y dependientes': 1, 'Entretenimiento': 1, 'Salud y bienestar': 1 };
  function recurrentes(m) {
    // Cobros que llegan cada mes a la misma persona o empresa (3 de los últimos 4 meses)
    var ms = antes(m, 4), by = {};
    rows().forEach(function (r) {
      if (ms.indexOf(r.mes) < 0 || r.m >= 0) return; var c = cls(r);
      if (c.k !== 'gasto' || c.via || !FIJO[c.cat]) return;
      var k = r.cp; (by[k] = by[k] || { cp: r.cp, cat: c.cat, ms: {}, dias: [], m: [] }); by[k].ms[r.mes] = 1; by[k].dias.push(r.dia); by[k].m.push(-r.m);
    });
    return Object.keys(by).map(function (k) { return by[k]; }).filter(function (x) {
      return Object.keys(x.ms).length >= 3 && x.m.length <= 6 && Math.max.apply(null, x.m) <= Math.min.apply(null, x.m) * 1.3; // mismo monto, más o menos
    })
      .map(function (x) { var d = x.dias.slice().sort(function (a, b) { return a - b; })[Math.floor(x.dias.length / 2)]; return { cp: x.cp, cat: x.cat, dia: d, monto: r2(x.m.reduce(function (a, b) { return a + b; }, 0) / x.m.length) }; })
      .sort(function (a, b) { return a.dia - b.dia; });
  }
  function anticipa(m) {
    var out = [], s = month(m), p = pres();
    if (isCur(m)) {
      var d = +HOY.slice(8, 10), n = diasMes(m), rec = recurrentes(m), falta = rec.filter(function (x) { return x.dia > d; });
      var fijo = falta.reduce(function (a, x) { return a + x.monto; }, 0);
      var varHoy = s.gast - rec.filter(function (x) { return x.dia <= d; }).reduce(function (a, x) { return a + Math.min(x.monto, s.cats[x.cat] || 0); }, 0);
      var proj = r2(s.gast + fijo + Math.max(0, varHoy) / d * (n - d));
      out.push({ icon: 'speed', kind: proj > p.general ? 'warn' : 'good', t: T('A este ritmo cierras {mes} en {monto}', { mes: mesName(m), monto: money0(proj) }),
        s: proj > p.general ? T('Te pasarías {monto} de tu presupuesto. Cuenta los cobros fijos que todavía no llegan.', { monto: money0(proj - p.general) }) : T('Te sobrarían {monto} de tu presupuesto, contando los cobros fijos que faltan.', { monto: money0(p.general - proj) }), ask: '¿Cómo cierro el mes?' });
      var sem = falta.filter(function (x) { return x.dia <= d + 10; });
      if (sem.length) out.push({ icon: 'event_upcoming', kind: 'info', t: T('En los próximos días te cobran {monto}', { monto: money(sem.reduce(function (a, x) { return a + x.monto; }, 0)) }),
        s: sem.slice(0, 3).map(function (x) { return (x.cp.length > 22 ? corto(x.cp) : x.cp) + ' (' + x.dia + ' ' + MES[+m.slice(5, 7) - 1].slice(0, 3) + ')'; }).join(', ') + '.' });
    }
    var ps = sugerido(m);
    if (ps && p.auto !== true && Math.abs(ps.general - p.general) / p.general > .1) out.push({ icon: 'tune', kind: 'info', t: T('Te sugiero un presupuesto de {monto}', { monto: money0(ps.general) }), s: T('Es tu promedio de los últimos tres meses, con un margen de 5%.'), act: 'budgets' });
    var deb = DB.deudas.filter(function (x) { return x.usuario === ST.u && /mínimo/.test(x.nota); })[0];
    if (deb) out.push({ icon: 'credit_card', kind: 'warn', t: T('Tu {t} sigue creciendo', { t: deb.producto.replace(/ ···\d+/, '') + ' ' + deb.institucion }), s: T('Debes {monto} y solo pagas el mínimo. Si le pasas lo que sobra cada quincena, la cierras antes.', { monto: money(deb.saldo) }) });
    return out;
  }

  /* ---------- Uku explica: una frase por movimiento ---------- */
  function porque(r) {
    var c = cls(r), mes = mesName(r.mes);
    if (c.ans) return c.why === 'negocio' ? T('Me dijiste que {r}: lo saco de tus gastos de la casa.', { r: c.ans.d })
      : c.k === 'no' ? T('Me dijiste que {r}. No lo cuento como gasto ni como ingreso.', { r: c.ans.d }) : T('Me dijiste que {r}. Lo cuento en {cat}.', { r: c.ans.d, cat: c.cat });
    if (c.k === 'no') return {
      recarga: T('Es una recarga a tu Deuna. No la cuento aquí: cuento cada pago que hiciste con Deuna, una sola vez.'),
      recarga_in: T('Es la recarga que llegó a tu Deuna. Ya la conté en lo que pagaste.'),
      deuna_in: T('Te pagaron por Deuna. Lo veo en Deuna, pero cuento la plata cuando llega a tu cuenta.'),
      propias: T('No lo cuento: es entre tus cuentas.'),
      ahorro: T('No lo cuento como gasto: es tu ahorro programado.'),
      pago_tarjeta: T('No lo cuento: lo que compraste con la tarjeta ya contó.'),
      fuera: T('No lo veo en tu resumen: es de una tarjeta de otro banco. Solo veo cuando le pagas.'),
      pago_otro_banco: T('No lo cuento: ya conté lo que compraste con esa tarjeta, que conectaste.'),
      negocio: T('Es de tu negocio: lo saco de tus gastos de la casa.')
    }[c.why] || T('No lo cuento en tu resumen.');
    if (c.k === 'rin' || c.k === 'rout') return T('Es de una persona o empresa, así que no sé qué fue. Lo cuento marcado hasta que me cuentes.');
    if (c.k === 'ingreso') return T('Cuenta como ingreso de {mes} ({cat}).', { mes: mes, cat: c.cat.toLowerCase() });
    if (c.k === 'reembolso') return T('Te devolvieron parte de un gasto: lo resto de {cat}. No es un ingreso.', { cat: c.cat });
    if (r.c === 'Tarjetas de otros bancos (sin detalle)') return T('Es el pago de una tarjeta de otro banco. Lo cuento como gasto porque no veo en qué la usaste.');
    if (/Impuestos a consumos/.test(r.e)) return T('Es un impuesto de un consumo en el exterior. Lo sumo a la categoría de ese consumo: {cat}.', { cat: c.cat });
    if (c.via === 'deuna') return T('Pagaste con Deuna. Lo cuento en {cat}.', { cat: c.cat });
    if (c.via === 'otro_banco') return T('Lo veo porque conectaste tu {t}. Lo cuento en {cat}.', { t: r.src.replace(/ ···\d+/, ''), cat: c.cat });
    if (GRIS[c.cat]) return T('Cuenta en tu gasto de {mes}, pero no sé en qué fue. Lo dejo en {cat}.', { mes: mes, cat: c.cat });
    return T('Cuenta en tu gasto de {mes}, en {cat}.', { mes: mes, cat: c.cat });
  }

  /* ---------- Preguntas pendientes ---------- */
  function preguntas(m) {
    var g = {};
    rows().forEach(function (r) {
      if (r.t !== 'Por revisar' || resp()[gkey(r)] || (m && r.f > finDe(m))) return; // solo lo que ya había pasado en ese mes
      var k = gkey(r); (g[k] = g[k] || { k: k, cp: r.cp, sign: r.m > 0 ? '+' : '-', rows: [], tpl: tplOf(r) }).rows.push(r);
    });
    return Object.keys(g).map(function (k) { var x = g[k]; x.last = x.rows[x.rows.length - 1]; x.enMes = x.rows.filter(function (r) { return r.mes === m; }); x.total = r2(x.rows.reduce(function (a, r) { return a + Math.abs(r.m); }, 0)); return x; })
      .sort(function (a, b) { return (b.enMes.length ? 1 : 0) - (a.enMes.length ? 1 : 0) || (b.sign === '+') - (a.sign === '+') || b.last.f.localeCompare(a.last.f); });
  }
  // Lo que el banco sabe de esa persona, en una frase
  function contexto(x) {
    var sale = 0, entra = 0, n = 0;
    rows().forEach(function (r) { if (r.cp !== x.cp || r.t === 'Detalle Deuna') return; n++; if (r.m < 0) sale -= r.m; else entra += r.m; });
    var p = [];
    if (x.rows.length > 1) p.push(T('Pasó {n} veces desde {mes}', { n: x.rows.length, mes: mesLargo(x.rows[0].mes) }));
    if (entra && x.sign === '-') p.push(T('{n} te envió {monto}', { n: corto(x.cp).split(' ')[0], monto: money(entra) }));
    if (sale && x.sign === '+') p.push(T('tú le enviaste {monto}', { monto: money(sale) }));
    if (x.tpl === TPL['Cuenta dividida+']) p.push(T('llegó poco después de un pago tuyo en un restaurante'));
    if (x.tpl === TPL['Aporte de pareja+']) p.push(T('llega cada mes por un monto parecido'));
    var s = p.join('; ');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : '';
  }

  /* ---------- Deudas ---------- */
  var CASAS = /casa comercial/i;
  function deudas() {
    var L = DB.deudas.filter(function (x) { return x.usuario === ST.u; });
    var bp = L.filter(function (x) { return x.institucion === 'Pichibank' && x.saldo > 0; });
    var casas = L.filter(function (x) { return CASAS.test(x.en_mvp); });
    var otras = L.filter(function (x) { return x.institucion !== 'Pichibank' && !CASAS.test(x.en_mvp) && x.saldo > 0; });
    var cobrar = L.filter(function (x) { return x.saldo < 0; });
    return { bp: bp, casas: casas, otras: otras, cobrar: cobrar, totalBP: r2(bp.reduce(function (a, x) { return a + x.saldo; }, 0)),
      total: r2(bp.concat(otras, casas).reduce(function (a, x) { return a + Math.max(0, x.saldo); }, 0)) };
  }

  /* ---------- Estado de Uku ---------- */
  var MOOD = { feliz: 'contento', atento: 'atento', preocupado: 'preocupado', tranquilo: 'tranquilo' };
  function salud(m) {
    var s = month(m), p = pres().general, f = isCur(m) ? +HOY.slice(8, 10) / diasMes(m) : 1;
    return Math.max(5, Math.min(100, Math.round(100 - Math.max(0, s.gast / p - f * .9) * 160)));
  }
  function mood(m) {
    var s = month(m), p = pres().general, f = isCur(m) ? +HOY.slice(8, 10) / diasMes(m) : 1;
    if (s.gast > p) return 'preocupado';
    if (s.gast / p > f * .95 || preguntas(m).some(function (x) { return x.enMes.length; })) return 'atento';
    return isCur(m) ? 'tranquilo' : 'feliz';
  }

  /* =====================================================================
     Pantalla
     ===================================================================== */
  var pf, scroll;
  function mount() {
    var host = document.querySelector('.view[data-view="1"] .pf-host');
    if (!host || pf) return;
    pf = document.createElement('div');
    pf.className = 'pf-page pf-page--inline pfm open';
    pf.setAttribute('aria-label', 'Mis finanzas');
    pf.innerHTML = '<div class="pf-scroll"></div>';
    host.appendChild(pf);
    scroll = pf.querySelector('.pf-scroll');
    pf.addEventListener('click', onClick);
  }
  function face() { return window.Asistente ? Asistente.faceIMG() : '<img class="as-oso as-oso--cara" src="' + ASSET + 'oso/oso-cara.webp" alt="">'; }

  function demoHTML() {
    var u = user();
    return '<div class="pfm-demo" role="group" aria-label="Demo">' +
      '<button class="pfm-demo__who" data-pfm="who"><span class="pfm-av">' + esc(u.nombre.charAt(0)) + '</span><span><b>' + esc(u.nombre) + '</b><small>' + esc(u.tipo) + '</small></span><span class="material-symbols-rounded">expand_more</span></button>' +
      '<div class="pfm-seg" role="radiogroup" aria-label="Versión">' +
        '<button role="radio" aria-checked="' + !tobe() + '" data-pfm="modo:mvp">MVP</button>' +
        '<button role="radio" aria-checked="' + tobe() + '" data-pfm="modo:tobe">To-be</button></div></div>';
  }
  function tabsHTML(m) {
    return '<nav class="tabs pf-tabs" aria-label="Meses"><div class="tabs__scroll">' + meses().map(function (x) {
      var l = isCur(x) ? T('Este mes') : x.slice(0, 4) === HOY.slice(0, 4) ? Mes(x) : Mes(x).slice(0, 3) + ' ' + x.slice(0, 4);
      return '<button class="tab' + (x === m ? ' active' : '') + '" data-pfm="mes:' + x + '">' + l + '</button>';
    }).join('') + '</div></nav>';
  }

  // Salud financiera: gastado, lo que te queda, total y avance contra el presupuesto
  function saludHTML(m) {
    var s = month(m), p = pres(), cur = isCur(m), q = preguntas(m).filter(function (x) { return x.sign === '+' && x.enMes.length; });
    var rinMes = q.reduce(function (a, x) { return a + x.enMes.reduce(function (b, r) { return b + r.m; }, 0); }, 0);
    var used = s.gast / p.general, f = cur ? +HOY.slice(8, 10) / diasMes(m) : null, over = s.gast > p.general;
    var queda = rinMes > 0
      ? '<button class="pfm-ask" data-pfm="q:' + esc(q[0].k) + '"><span class="pfm-ask__face">' + face() + '</span><span>' + T('Antes de decirte cuánto te queda: ¿qué fueron los {monto} que te llegaron?', { monto: money(rinMes) }) + '</span><span class="material-symbols-rounded">chevron_right</span></button>'
      : '<p class="pfm-sal__left' + (over ? ' is-over' : '') + '">' + (over ? T('Te pasaste {monto}', { monto: money(s.gast - p.general) }) : T('Te quedan {monto}', { monto: money(p.general - s.gast) })) + '</p>';
    return '<section class="pf-flow pfm-sal">' +
      '<p class="pf-flow__label">' + T(cur ? 'Llevas gastado en {mes}' : 'Gastaste en {mes}', { mes: mesName(m) }) + '</p>' +
      '<p class="pf-flow__value">' + money(s.gast) + '</p>' +
      '<p class="pf-flow__sub">' + T('de tu presupuesto de {monto}', { monto: money0(p.general) }) + '<button class="pf-link pfm-mini" data-pfm="budgets">' + T('Ajustar') + '</button></p>' +
      '<div class="pfm-bar' + (over ? ' is-over' : used > (f || 1) * .95 ? ' is-warn' : '') + '" role="img" aria-label="' + T('Usaste {pct} de tu presupuesto', { pct: pct(used) }) + '"><i style="width:' + Math.min(100, used * 100).toFixed(1) + '%"></i>' +
        (f ? '<em style="left:' + (f * 100).toFixed(1) + '%"></em>' : '') + '</div>' + queda +
      '<div class="pf-flow__keys pfm-keys">' +
        '<span><i class="is-in"></i>' + T('Ingresos') + '<b>' + money(s.ing) + '</b></span>' +
        '<span><i class="is-spend"></i>' + T('Gastos') + '<b>' + money(s.gast) + '</b></span>' +
        '<span><i class="is-save"></i>' + T('Diferencia') + '<b>' + money(s.ing - s.gast) + '</b></span></div>' +
      (s.rin ? '<p class="pfm-sal__rev"><span class="material-symbols-rounded">help</span>' + T('Más {monto} que entraron de personas y todavía no sé qué son.', { monto: money(s.rin) }) + '</p>' : '') +
      (f ? '<p class="pf-note">' + T('La raya marca dónde deberías ir hoy, día {d} de {n}.', { d: +HOY.slice(8, 10), n: diasMes(m) }) + '</p>' : '') +
      '</section>';
  }

  // Uku: pregunta lo que no sabe, cuenta lo que notó y, en el to-be, anticipa
  function ukuHTML(m) {
    var md = mood(m), qs = preguntas(m), first = qs[0], ins = hallazgos(m), ant = tobe() ? anticipa(m) : [];
    var lead = first ? (qs.length === 1 ? T('Tengo una pregunta para ti') : T('Tengo {n} preguntas para ti', { n: qs.length }))
      : ins.length ? T('Esto es lo que noté en {mes}', { mes: mesName(m) }) : T('Todo en orden en {mes}', { mes: mesName(m) });
    var html = '<section class="pf-sec pf-uku2 pfm-uku"><div class="pf-uku2__card pf-mood--' + md + '">' +
      (tobe() ? '<div class="pf-hero pfm-hero"><div class="b3d" data-score="' + salud(m) + '"><div class="b3d__fallback">' + (window.Asistente ? Asistente.petSVG() : '') + '</div></div></div>' : '') +
      '<div class="pf-uku2__head"><span class="pf-uku2__face">' + face() + '</span><span><b>Uku <em>· ' + T('está {animo}', { animo: MOOD[md] }) + '</em></b><small>' + (tobe() ? T('Tu oso de las finanzas') : T('Te ayuda a entender tus movimientos')) + '</small></span></div>' +
      '<p class="pf-uku2__lead">' + lead + '</p>';
    if (first) html += qHTML(first, true) + (qs.length > 1 ? '<button class="pfm-more" data-pfm="revisar">' + T('Ver las {n} preguntas', { n: qs.length }) + '<span class="material-symbols-rounded">chevron_right</span></button>' : '');
    var list = ant.concat(ins).slice(0, tobe() ? 4 : 3);
    if (list.length) html += '<div class="pf-uku2__list">' + list.map(function (x) {
      return '<div class="pf-uku2__row' + (ant.indexOf(x) >= 0 ? ' is-ant' : '') + '"><span class="pf-uku2__ic material-symbols-rounded" aria-hidden="true">' + x.icon + '</span>' +
        '<div class="pf-uku2__txt"><b>' + esc(x.t) + '</b><p>' + esc(x.s) + '</p>' +
        (x.act ? '<div class="pf-uku2__links"><button data-pfm="' + x.act + '">' + T('Usar este presupuesto') + '</button></div>' : '') +
        (tobe() && x.ask ? '<div class="pf-uku2__links"><button class="is-ai" data-pfm="ai:' + esc(x.ask) + '"><span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span>' + esc(x.ask) + '</button></div>' : '') +
        '</div></div>';
    }).join('') + '</div>';
    if (tobe()) {
      var acc = window.UkuAnalisis ? UkuAnalisis.access() : '';
      html += '<button class="ai-cta" data-pfm="analyze"><span class="ai-cta__spark material-symbols-rounded" aria-hidden="true">auto_awesome</span>' +
        '<span class="ai-cta__t"><b>' + T('Analizar con Uku') + '</b>' + (acc ? '<small>' + esc(acc) + '</small>' : '') + '</span><span class="ai-badge">IA</span></button>';
    }
    return html + '</div></section>';
  }
  // Una pregunta de un toque; la sugerida va primero
  function qHTML(x, inline) {
    var n = corto(x.cp), monto = x.rows.length === 1 ? money(x.total) : T('{monto} en {n} movimientos', { n: x.rows.length, monto: money(x.total) });
    var o = x.tpl.o;
    return '<div class="pfm-q' + (inline ? ' is-inline' : '') + '" data-q="' + esc(x.k) + '">' +
      '<p class="pfm-q__t">' + esc(T(x.tpl.q, { n: n })) + '</p>' +
      '<p class="pfm-q__s">' + (x.sign === '+' ? T('Te llegó') : T('Enviaste')) + ' ' + monto + ' · ' + T('último el {f}', { f: dshort(x.last.f) }) + '</p>' +
      (contexto(x) ? '<p class="pfm-q__ctx">' + (tobe() ? '<span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span>' + T('Creo que {r}.', { r: OPT[o[0]].d }) + ' ' : '') + esc(contexto(x)) + '</p>' : '') +
      '<div class="uku-say__replies">' + o.map(function (id, i) {
        return '<button class="uku-say__reply' + (i === 0 ? ' is-sug' : '') + '" data-pfm="ans:' + esc(x.k) + ':' + id + '">' + esc(OPT[id].l) + (i === 0 ? ' <small>' + T('Sugerido') + '</small>' : '') + '</button>';
      }).join('') + '</div>' +
      (x.rows.length > 1 ? '<p class="pfm-q__rule">' + T('Lo que respondas lo aplico a los {n} movimientos con {p}.', { n: x.rows.length, p: n }) + '</p>' : '') + '</div>';
  }

  // Ingresos y gastos por categoría, por semana, mes y año
  function catsHTML(m) {
    var P = periodo(m), s = P.o, ks = Object.keys(s.cats).sort(function (a, b) { return s.cats[b] - s.cats[a]; }), max = s.cats[ks[0]] || 1;
    var iks = Object.keys(s.inc).sort(function (a, b) { return s.inc[b] - s.inc[a]; });
    var seg = '<div class="pfm-seg pfm-seg--sm" role="radiogroup" aria-label="' + T('Periodo') + '">' + [['sem', 'Semana'], ['mes', 'Mes'], ['ano', 'Año']].map(function (x) {
      return '<button role="radio" aria-checked="' + (ST.per === x[0]) + '" data-pfm="per:' + x[0] + '">' + T(x[1]) + '</button>'; }).join('') + '</div>';
    var gris = ks.filter(function (k) { return GRIS[k]; }).reduce(function (a, k) { return a + s.cats[k]; }, 0);
    return '<section class="pf-sec pf-msec"><div class="pf-msec__head"><p class="pf-msec__label">' + T('En qué se fue') + '</p>' + seg + '</div><div class="pf-mcard">' +
      '<p class="pf-mcard__lead">' + (ks.length ? T('Gastaste {monto} {cuando}.', { monto: money(s.gast), cuando: P.l }) : T('Sin gastos {cuando}.', { cuando: P.l })) +
        (gris ? '<small>' + T('{monto} van en gris: el banco no sabe en qué fue.', { monto: money(gris) }) + '</small>' : '') + '</p>' +
      ks.slice(0, 5).map(function (k) { return catRow(k, s, max); }).join('') +
      (ks.length > 5 ? '<button class="pf-mcard__more" data-pfm="allcats">' + T('Ver las {n} categorías', { n: ks.length }) + '<span class="material-symbols-rounded">chevron_right</span></button>' : '') +
      (iks.length ? '<p class="pfm-sub">' + T('Ingresos') + '</p>' + iks.map(function (k) {
        return '<div class="pfm-inc"><span class="material-symbols-rounded">' + (ING_IC[k] || 'south_west') + '</span><span>' + esc(k) + '</span><b>' + money(s.inc[k]) + '</b></div>';
      }).join('') : '') + '</div></section>';
  }
  function catRow(k, s, max) {
    return '<button class="pf-meter pf-meter--' + (GRIS[k] ? 'gris' : 'cat') + '" data-pfm="cat:' + esc(k) + '"><span class="pf-meter__top"><span class="pf-meter__name"><span class="material-symbols-rounded pfm-ic">' + CAT[k] + '</span>' + esc(k) + '</span><span class="pf-meter__right">' + money(s.cats[k]) + '</span></span>' +
      '<span class="pf-meter__bar"><i style="width:' + Math.max(2, s.cats[k] / max * 100).toFixed(1) + '%"></i></span><span class="pf-meter__sub">' + T('{pct} de tu gasto', { pct: pct(s.cats[k] / s.gast) }) + '</span></button>';
  }
  function allCatsSheet() {
    var P = periodo(curMes()), s = P.o, ks = Object.keys(s.cats).sort(function (a, b) { return s.cats[b] - s.cats[a]; });
    showSheet('<h3>' + T('En qué se fue') + '</h3><p>' + T('{monto} {cuando}, en {n} categorías.', { monto: money(s.gast), cuando: P.l, n: ks.length }) + '</p>' +
      '<div class="pfm-cats">' + ks.map(function (k) { return catRow(k, s, s.cats[ks[0]]); }).join('') + '</div>');
  }

  // Presupuesto por categoría
  function presHTML(m) {
    var s = month(m), p = pres(), ks = Object.keys(p.cats), cur = isCur(m), f = cur ? +HOY.slice(8, 10) / diasMes(m) : 1;
    if (!ks.length) return '<section class="pf-sec pf-msec"><p class="pf-msec__label">' + T('Presupuesto por categoría') + '</p><div class="pf-mcard"><p class="pf-mcard__lead">' + T('Escoge una categoría y asígnale un monto.') + '</p><button class="pf-link pf-link--block" data-pfm="budgets">' + T('Crear presupuesto') + '</button></div></section>';
    var over = ks.filter(function (k) { return (s.cats[k] || 0) > p.cats[k]; });
    return '<section class="pf-sec pf-msec"><div class="pf-msec__head"><p class="pf-msec__label">' + T('Presupuesto por categoría') + '</p><button class="pf-link" data-pfm="budgets">' + T('Ajustar') + '</button></div><div class="pf-mcard">' +
      '<p class="pf-mcard__lead">' + (over.length ? T('Te pasaste en {n} de {t}.', { n: over.length, t: ks.length }) : cur ? T('Vas dentro de tus presupuestos.') : T('Cerraste dentro de tus presupuestos.')) + '</p>' +
      ks.sort(function (a, b) { return (s.cats[b] || 0) / p.cats[b] - (s.cats[a] || 0) / p.cats[a]; }).map(function (k) {
        var v = s.cats[k] || 0, B = p.cats[k], u = v / B, tone = v > B ? 'over' : u > f * .95 + .05 ? 'warn' : 'ok';
        return '<button class="pf-meter pf-meter--' + tone + '" data-pfm="cat:' + esc(k) + '"><span class="pf-meter__top"><span class="pf-meter__name">' + esc(k) + '</span><span class="pf-meter__right">' + T('{pct} usado', { pct: pct(u) }) + '</span></span>' +
          '<span class="pf-meter__bar"><i style="width:' + Math.max(u > 0 ? 2 : 0, Math.min(100, u * 100)).toFixed(1) + '%"></i>' + (cur ? '<em style="left:' + (f * 100).toFixed(1) + '%"></em>' : '') + '</span>' +
          '<span class="pf-meter__sub">' + (v > B ? T('Te pasaste {monto}', { monto: money(v - B) }) : T('Te quedan {monto} de {total}', { monto: money(B - v), total: money0(B) })) + '</span></button>';
      }).join('') + '</div></section>';
  }

  // Deudas: MVP = lo de Pichibank + cuotas a casas comerciales; to-be = todo
  function deudaRow(x, extra) {
    return '<div class="pfm-debt"><span class="pfm-debt__main"><b>' + esc(x.producto) + '</b><small>' + esc(x.institucion) + (extra ? ' · ' + extra : '') + '</small></span>' +
      '<span class="pfm-debt__val"><b>' + (x.saldo ? money(Math.abs(x.saldo)) : '—') + '</b>' + (x.cuota_mensual ? '<small>' + T('cuota {monto}', { monto: money(x.cuota_mensual) }) + '</small>' : '') + '</span></div>';
  }
  function deudasHTML() {
    var d = deudas(), h = DB.hipoteca, html = '<section class="pf-sec pf-msec"><p class="pf-msec__label">' + T('Deudas') + '</p><div class="pf-mcard">';
    if (tobe()) {
      html += '<p class="pf-mcard__lead">' + (d.total ? T('Debes {monto} en total', { monto: money(d.total) }) : T('No tienes deudas')) + '<small>' + T('En Pichibank, otros bancos, cooperativas y casas comerciales.') + '</small></p>' +
        d.bp.map(function (x) { return deudaRow(x, h.usuario === ST.u && /Hipoteca/.test(x.producto) ? T('cuota {a} de {b}', { a: h.pagadas, b: h.cuotas }) : ''); }).join('') +
        d.otras.concat(d.casas.filter(function (x) { return x.saldo > 0; })).map(function (x) { return deudaRow(x, /mínimo/.test(x.nota) ? T('solo pagas el mínimo') : ''); }).join('');
      if (d.cobrar.length) html += '<p class="pfm-sub">' + T('Te deben') + '</p>' + d.cobrar.map(function (x) { return deudaRow(x, T('por cobrar')); }).join('');
    } else {
      html += '<p class="pf-mcard__lead">' + (d.totalBP ? T('Debes {monto} en Pichibank', { monto: money(d.totalBP) }) : T('No tienes deudas en Pichibank')) + '</p>' +
        d.bp.map(function (x) { return deudaRow(x, h.usuario === ST.u && /Hipoteca/.test(x.producto) ? T('cuota {a} de {b}', { a: h.pagadas, b: h.cuotas }) : ''); }).join('');
      var casas = d.casas.filter(function (x) { return x.cuota_mensual; });
      if (casas.length) html += '<p class="pfm-sub">' + T('Cuotas fuera del banco') + '</p>' + casas.map(function (x) {
        return '<div class="pfm-debt"><span class="pfm-debt__main"><b>' + esc(x.institucion) + '</b><small>' + T('Veo la cuota, no el saldo') + '</small></span><span class="pfm-debt__val"><b>' + money(x.cuota_mensual) + '</b><small>' + T('al mes') + '</small></span></div>';
      }).join('');
      html += '<p class="pf-note">' + T('Solo veo tus deudas en Pichibank. Tus tarjetas de otros bancos, cooperativas y préstamos entre personas no aparecen aquí.') + '</p>';
    }
    return html + '</div></section>';
  }

  // Movimientos: cada uno con su tratamiento
  var PILL = { gasto: 'Gasto', ingreso: 'Ingreso', reembolso: 'Reembolso', rin: 'Por revisar', rout: 'Por revisar', no: 'No suma' };
  function txHTML(r) {
    var c = cls(r), inc = r.m > 0, ic = c.k === 'ingreso' ? (ING_IC[c.cat] || 'south_west') : c.k === 'rin' || c.k === 'rout' ? 'help' : c.cat ? CAT[c.cat] || 'receipt_long' : 'sync_alt';
    return '<button class="pf-tx pfm-tx' + (c.k === 'no' ? ' is-no' : '') + '" data-pfm="tx:' + r.i + '"><span class="pf-tx__ic material-symbols-rounded" aria-hidden="true">' + ic + '</span>' +
      '<span class="pf-tx__main"><b>' + esc(r.desc) + '</b><small>' + dshort(r.f) + ' · ' + esc(r.src.replace(/ Pichibank/, '')) + '</small>' +
      '<span class="pfm-pill is-' + c.k + '">' + T(PILL[c.k]) + (c.cat && c.k !== 'no' ? ' · ' + esc(c.cat) : '') + '</span></span>' +
      '<span class="pf-tx__amt' + (inc ? ' is-in' : '') + '">' + (inc ? '+' : '−') + money(Math.abs(r.m)) + '</span></button>';
  }
  function movsHTML(m) {
    var list = month(m).rows.slice().reverse(), shown = list.filter(function (r) { return !(r.t === 'Detalle Deuna' && r.m > 0) && cls(r).why !== 'recarga_in'; });
    return '<section class="pf-sec"><div class="pf-sec__head"><h2>' + T('Movimientos') + '</h2><button class="pf-link" data-pfm="alltx">' + T('Ver todos') + '</button></div>' +
      '<div class="pf-recs">' + shown.slice(0, 6).map(txHTML).join('') + '</div>' +
      '<p class="pf-note">' + T('Toca un movimiento para ver por qué cuenta o no.') + '</p></section>';
  }
  function footHTML(m) {
    var s = month(m);
    return '<section class="pf-sec"><p class="pf-note pf-note--box pfm-scope"><span class="material-symbols-rounded">visibility</span><span>' +
      (tobe() ? T('Veo Pichibank, Deuna y las tarjetas de otros bancos que conectaste. El efectivo no lo veo.')
        : T('Solo veo lo que pasa por Pichibank y Deuna. El efectivo y las tarjetas de otros bancos no aparecen.') + (s.fuera ? ' ' + T('Este mes hubo {monto} en tarjetas de otros bancos que no puedo categorizar.', { monto: money(s.fuera) }) : '')) +
      '</span></p><p class="pf-note">' + T('Datos ficticios de la Base de datos PFM, hasta el {f}.', { f: dshort(HOY) + ' ' + HOY.slice(0, 4) }) + '</p></section>';
  }

  function paint() {
    if (!pf) return;
    if (!DB) { scroll.innerHTML = '<header class="pf-head"><h1>Mis finanzas</h1></header><p class="pf-note" style="padding:0 24px">' + T('Cargando tus movimientos…') + '</p>'; load().then(paint); return; }
    var m = curMes(), keep = window.scrollY;
    var html = '<header class="pf-head"><h1>Mis finanzas</h1></header>' + demoHTML() + tabsHTML(m) +
      saludHTML(m) + ukuHTML(m) + catsHTML(m) + presHTML(m) + deudasHTML() + movsHTML(m) + footHTML(m);
    var changed = paint.last && paint.last !== m + ST.u + ST.modo;
    paint.last = m + ST.u + ST.modo;
    scroll.innerHTML = html;
    if (changed) { scroll.classList.remove('is-switch'); void scroll.offsetWidth; scroll.classList.add('is-switch'); }
    window.scrollTo({ top: keep });
    var sel = scroll.querySelector('.pf-tabs .tab.active'); if (sel) sel.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
    hero3D();
  }
  // El oso en 3D solo en el to-be: en el MVP Uku es liviano (sin 3D, carga con mala conexión)
  var b3d = null;
  function hero3D() {
    var el = scroll.querySelector('.pfm-hero .b3d');
    if (!el || !pf.closest('.view.active')) return;
    el.classList.add('is-loading');
    import(ASSET + 'bosque3d.js').then(function (m3) {
      if (!m3.supported() || !el.isConnected) return;
      b3d = m3; var c = window.Clima && Clima.last(); if (c) m3.setLook(c.look);
      m3.attach(el, { score: +el.dataset.score, onTap: function () { fx('select'); m3.play('happy'); } });
      el.classList.remove('is-loading'); el.classList.add('is-3d');
      m3.play({ preocupado: 'worried', atento: 'think', feliz: 'happy', tranquilo: 'wave' }[mood(curMes())]);
    }).catch(function () {});
  }

  /* ---------- Hojas ---------- */
  var sheet, back;
  function showSheet(html) {
    if (!sheet) {
      back = document.createElement('div'); back.className = 'as-sheet-back';
      sheet = document.createElement('div'); sheet.className = 'as-sheet pfm-sheet'; sheet.setAttribute('role', 'dialog');
      document.body.appendChild(back); document.body.appendChild(sheet);
      back.addEventListener('click', closeSheet);
      sheet.addEventListener('click', onClick);
    }
    sheet.innerHTML = '<div class="as-sheet__handle"></div>' + html; sheet.scrollTop = 0;
    if (!sheet.classList.contains('open')) fx('open');
    back.classList.add('open'); sheet.classList.add('open');
  }
  function closeSheet() { if (sheet) { back.classList.remove('open'); sheet.classList.remove('open'); } }
  function sheetOpen() { return sheet && sheet.classList.contains('open'); }

  function whoSheet() {
    showSheet('<h3>' + T('Ver como') + '</h3><p>' + T('Cuatro perfiles ficticios de la investigación, con sus movimientos de octubre 2025 a octubre 2026.') + '</p>' +
      '<div class="as-rows">' + DB.usuarios.map(function (u) {
        return '<button class="as-row as-row--btn" data-pfm="u:' + u.usuario + '" aria-pressed="' + (u.usuario === ST.u) + '"><span class="pfm-av">' + esc(u.nombre.charAt(0)) + '</span>' +
          '<span class="as-row__main"><b>' + esc(u.nombre) + ', ' + u.edad + ' · ' + esc(u.ciudad) + '</b><small>' + esc(u.tipo) + '. ' + esc(u.lo_que_necesita) + '.</small></span><span class="as-radio"></span></button>';
      }).join('') + '</div>' +
      '<p class="as-sheet__label">' + T('Versión') + '</p><div class="as-rows">' +
        '<button class="as-row as-row--btn" data-pfm="modo:mvp" aria-pressed="' + !tobe() + '"><span class="as-row__main"><b>MVP</b><small>' + T('Fase 1: Uku pregunta, explica y cuenta con reglas. Solo Pichibank y Deuna, sin IA.') + '</small></span><span class="as-radio"></span></button>' +
        '<button class="as-row as-row--btn" data-pfm="modo:tobe" aria-pressed="' + tobe() + '"><span class="as-row__main"><b>To-be</b><small>' + T('La visión: Uku anticipa, sugiere presupuesto, ve tus otros bancos y analiza con IA.') + '</small></span><span class="as-radio"></span></button></div>' +
      '<button class="pf-link pf-link--block" data-pfm="reset">' + T('Borrar mis respuestas y presupuestos') + '</button>');
  }
  function revisarSheet() {
    var m = curMes(), qs = preguntas(m), done = Object.keys(resp());
    showSheet('<h3>' + T('Por revisar') + '</h3><p>' + T('Uku no adivina lo que no puede saber. Responde con un toque y lo aplica a los movimientos parecidos.') + '</p>' +
      (qs.length ? qs.map(function (x) { return qHTML(x, false); }).join('') : '<p class="pf-note pf-note--box">' + T('No tienes nada por revisar.') + '</p>') +
      (done.length ? '<p class="as-sheet__label">' + T('Ya respondiste') + '</p><div class="as-rows">' + done.map(function (k) {
        var p = k.split('|');
        return '<div class="as-row"><span class="as-row__main"><b>' + esc(corto(p[0])) + '</b><small>' + esc(OPT[resp()[k]].l) + '</small></span><button class="pf-link" data-pfm="undo:' + esc(k) + '">' + T('Deshacer') + '</button></div>';
      }).join('') + '</div>' : ''));
  }
  function txSheet(i) {
    var r = rows()[i], c = cls(r), q = r.t === 'Por revisar' ? preguntas(r.mes).filter(function (x) { return x.k === gkey(r); })[0] : null;
    var cambia = c.k === 'gasto' || c.k === 'reembolso';
    showSheet('<div class="pfm-tx__amt' + (r.m > 0 ? ' is-in' : '') + '">' + (r.m > 0 ? '+' : '−') + money(Math.abs(r.m)) + '</div><h3>' + esc(r.desc) + '</h3>' +
      '<p>' + dshort(r.f) + ' ' + r.f.slice(0, 4) + ', ' + r.h + ' · ' + esc(r.src) + '</p>' +
      '<div class="uku-say"><span class="uku-say__face">' + face() + '</span><div class="uku-say__body"><p class="uku-say__bubble">' + esc(porque(r)) + '</p></div></div>' +
      (q ? qHTML(q, false) : '') +
      (c.ans ? '<button class="pf-link pf-link--block" data-pfm="undo:' + esc(gkey(r)) + '">' + T('Deshacer mi respuesta') + '</button>' : '') +
      (cambia ? '<p class="as-sheet__label">' + T('Cambiar categoría') + '</p><div class="pf-catchips">' + PFM13.map(function (k) {
        return '<button class="pf-catchip" data-pfm="setcat:' + i + ':' + esc(k) + '" aria-pressed="' + (c.cat === k) + '">' + esc(k) + '</button>';
      }).join('') + '</div><p class="pf-note">' + T('El cambio mueve el monto entre categorías del presupuesto. Se puede deshacer.') + '</p>' +
      (catOv(r) ? '<button class="pf-link pf-link--block" data-pfm="uncat:' + i + '">' + T('Volver a la categoría original') + '</button>' : '') : '') +
      '<p class="as-sheet__label">' + T('Lo que dice la base de datos') + '</p><p class="pf-note pfm-dev">' + T('Tratamiento: {t} · Categoría: {c}', { t: r.t, c: r.c }) + (r.e ? ' · ' + T('Escenario: {e}', { e: r.e }) : '') + (r.n ? '<br>' + esc(r.n) : '') + '</p>');
  }
  var txFilter = 'todos';
  function allSheet() {
    var m = curMes(), list = month(m).rows.slice().reverse();
    var F = { todos: 'Todos', gasto: 'Gastos', ingreso: 'Ingresos', revisar: 'Por revisar', no: 'No suman' };
    var f = list.filter(function (r) { var k = cls(r).k; return txFilter === 'todos' || k === txFilter || (txFilter === 'revisar' && (k === 'rin' || k === 'rout')) || (txFilter === 'gasto' && k === 'reembolso'); });
    showSheet('<h3>' + T('Movimientos de {mes}', { mes: mesLargo(m) }) + '</h3><div class="pf-catchips">' + Object.keys(F).map(function (k) {
      return '<button class="pf-catchip" data-pfm="txf:' + k + '" aria-pressed="' + (txFilter === k) + '">' + T(F[k]) + '</button>'; }).join('') + '</div>' +
      '<div class="pf-sheet-list">' + (f.length ? f.map(txHTML).join('') : '<p class="pf-note">' + T('Nada por aquí.') + '</p>') + '</div>');
  }
  function catSheet(k) {
    var m = curMes(), P = periodo(m), list = P.o.rows.filter(function (r) { var c = cls(r); return c.cat === k && c.k !== 'ingreso' && c.k !== 'no'; }).reverse();
    showSheet('<h3>' + esc(k) + '</h3><p>' + T('{monto} {cuando}.', { monto: money(P.o.cats[k] || 0), cuando: P.l }) + (GRIS[k] ? ' ' + T('El banco no sabe en qué fue: toca un movimiento para ponerle categoría.') : '') +
      (k === 'Alimentación' ? ' ' + T('Incluye supermercados y restaurantes.') : '') + '</p>' +
      '<div class="pf-sheet-list">' + list.map(txHTML).join('') + '</div>');
  }
  var draft = null;
  function budgetSheet() {
    var p = draft || (draft = JSON.parse(JSON.stringify(pres()))), m = curMes(), sg = sugerido(m);
    var ks = PFM13.filter(function (k) { return k !== 'Otros'; });
    var step = function (id, v, label) {
      return '<div class="pf-step"><span>' + label + '</span><button class="pf-step__btn" data-pfm="bud:' + id + ':-' + (id === 'general' ? 50 : 10) + '" aria-label="' + T('Bajar') + '"><span class="material-symbols-rounded">remove</span></button>' +
        '<b>' + (v ? money0(v) : '—') + '</b><button class="pf-step__btn" data-pfm="bud:' + id + ':' + (id === 'general' ? 50 : 10) + '" aria-label="' + T('Subir') + '"><span class="material-symbols-rounded">add</span></button></div>';
    };
    showSheet('<h3>' + T('Tu presupuesto') + '</h3><p>' + T('Cuánto quieres gastar al mes. Uku te avisa cuando te acerques al límite.') + '</p>' +
      (tobe() && sg ? '<button class="pfm-sug" data-pfm="bud:sug"><span class="material-symbols-rounded">auto_awesome</span><span><b>' + T('Usar el sugerido: {monto}', { monto: money0(sg.general) }) + '</b><small>' + T('Tu promedio de los últimos tres meses, por categoría, con 5% de margen.') + '</small></span></button>' : '') +
      '<div class="pf-steps">' + step('general', p.general, '<b>' + T('General') + '</b>') + '</div>' +
      '<p class="as-sheet__label">' + T('Por categoría') + '</p><div class="pf-steps">' + ks.map(function (k) { return step(k, p.cats[k], esc(k)); }).join('') + '</div>' +
      '<button class="pf-cta" data-pfm="bud:save">' + T('Guardar') + '</button>');
  }

  var toastT;
  function toast(t, undo) {
    var el = document.querySelector('.pf-toast');
    if (!el) { el = document.createElement('div'); el.className = 'pf-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = esc(t) + (undo ? ' <button class="pfm-undo" data-pfm-toast="' + esc(undo) + '">' + T('Deshacer') + '</button>' : '');
    el.classList.add('show');
    var b = el.querySelector('[data-pfm-toast]'); if (b) b.onclick = function () { key(b.dataset.pfmToast); el.classList.remove('show'); };
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 4200);
  }

  /* ---------- Acciones ---------- */
  function onClick(e) { var b = e.target.closest('[data-pfm]'); if (b) key(b.dataset.pfm); }
  function refresh() { cache = {}; paint(); }
  function key(k) {
    var p = k.split(':');
    switch (p[0]) {
      case 'who': return whoSheet();
      case 'modo': if (ST.modo !== p[1]) { ST.modo = p[1]; persist(); fx('toggle'); refresh(); if (sheetOpen()) whoSheet(); } return;
      case 'u': if (ST.u !== p[1]) { ST.u = p[1]; ST.mes = null; persist(); fx('toggle'); refresh(); } closeSheet(); return;
      case 'reset': ST.resp[ST.u] = {}; ST.cats[ST.u] = {}; delete ST.pres[ST.u]; persist(); refresh(); closeSheet(); toast(T('Listo, volviste al inicio.')); return;
      case 'mes': ST.mes = p[1]; persist(); fx('select'); paint(); return;
      case 'per': ST.per = p[1]; persist(); fx('select'); paint(); return;
      case 'revisar': return revisarSheet();
      case 'q': return revisarSheet();
      case 'ans': {
        var gk = p.slice(1, -1).join(':'), id = p[p.length - 1], n = rows().filter(function (r) { return r.t === 'Por revisar' && gkey(r) === gk; }).length;
        resp()[gk] = id; persist(); fx('success'); refresh();
        if (sheetOpen()) { if (sheet.querySelector('.pfm-tx__amt')) closeSheet(); else revisarSheet(); }
        toast(n > 1 ? T('Listo. Lo apliqué a los {n} movimientos con {p}.', { n: n, p: corto(gk.split('|')[0]) }) : T('Listo, gracias.'), 'undo:' + gk);
        return;
      }
      case 'undo': { var uk = p.slice(1).join(':'); delete resp()[uk]; persist(); fx('toggle'); refresh(); if (sheetOpen() && !sheet.querySelector('.pfm-tx__amt')) revisarSheet(); else closeSheet(); return; }
      case 'tx': return txSheet(+p[1]);
      case 'setcat': { var o = ST.cats[ST.u] || (ST.cats[ST.u] = {}), r = rows()[+p[1]], old = cls(r).cat; o[p[1]] = p.slice(2).join(':'); persist(); fx('success'); refresh(); closeSheet();
        return toast(T('Listo: de {a} a {b}.', { a: old, b: o[p[1]] }), 'uncat:' + p[1]); }
      case 'uncat': delete (ST.cats[ST.u] || {})[p[1]]; persist(); refresh(); closeSheet(); return;
      case 'alltx': txFilter = 'todos'; return allSheet();
      case 'txf': txFilter = p[1]; return allSheet();
      case 'cat': return catSheet(p.slice(1).join(':'));
      case 'allcats': return allCatsSheet();
      case 'budgets': draft = null; return budgetSheet();
      case 'bud': {
        if (p[1] === 'save') { setPres(draft); draft = null; closeSheet(); refresh(); fx('success'); return toast(T('Guardaste tu presupuesto.')); }
        if (p[1] === 'sug') { var sg = sugerido(curMes()); draft = { general: sg.general, cats: sg.cats }; fx('select'); return budgetSheet(); }
        var d = +p[2], id2 = p[1];
        if (id2 === 'general') draft.general = Math.max(50, draft.general + d);
        else { var v = Math.max(0, (draft.cats[id2] || 0) + d); if (v) draft.cats[id2] = v; else delete draft.cats[id2]; }
        fx('tick'); var st = sheet.scrollTop; budgetSheet(); sheet.scrollTop = st; return;
      }
      case 'analyze': return analyze();
      case 'ai': return analyze(p.slice(1).join(':'));
      case 'go': { var gb = document.querySelector('#home-page [data-action="' + p.slice(1).join(':') + '"]'); if (gb) gb.click(); return; }
    }
  }
  function analyze(q) {
    if (!window.UkuAnalisis) return;
    UkuAnalisis.open({ view: curMes(), ask: q });
  }

  /* ---------- Para Uku (análisis con IA y chat) ---------- */
  function pack(m) {
    m = m && /^\d{4}-\d{2}$/.test(m) ? m : curMes();
    var s = month(m), p = pres(), av = prom(m, 3), cur = isCur(m), md = mood(m);
    var over = Object.keys(p.cats).filter(function (k) { return (s.cats[k] || 0) > p.cats[k]; }).map(function (k) { return { name: k, over: s.cats[k] - p.cats[k], budget: p.cats[k] }; });
    var ins = anticipa(m).concat(hallazgos(m)).map(function (x) { return { icon: x.icon, kind: x.kind, title: x.t, sub: x.s, ask: x.ask }; });
    var hint = over.length ? T('Ojo con {cat}', { cat: over[0].name.toLowerCase() }) : s.gast > p.general ? T('Te pasaste de tu presupuesto') : T('Vas dentro de tu presupuesto');
    return { key: m, mes: mesName(m), Mes: Mes(m), current: cur, report: false, n: { spend: s.gast, inc: s.ing, save: Math.max(0, r2(s.ing - s.gast)) }, ins: ins, over: over,
      top: Object.keys(s.cats).sort(function (a, b) { return s.cats[b] - s.cats[a]; }).slice(0, 3).map(function (k) { return { name: k, v: s.cats[k], p: s.cats[k] / s.gast }; }),
      avg: av ? av.gast : s.gast, mood: md, moodLabel: MOOD[md], hint: hint, score: salud(m), card: null, goals: [], txCount: s.n };
  }
  function answer(q) {
    if (!DB) return null;
    var s0 = q.toLowerCase(), m = curMes(), s = month(m);
    if (/revis|pregunt|no sabes/.test(s0)) {
      var qs = preguntas(m);
      return { t: qs.length ? T('Tengo {n} preguntas: {l}.', { n: qs.length, l: qs.slice(0, 3).map(function (x) { return corto(x.cp); }).join(', ') }) : T('No tengo nada por revisar.'), s: ['¿En qué se me va la plata?'] };
    }
    if (/deb|deuda|tarjeta|hipoteca/.test(s0)) {
      var d = deudas();
      return { t: tobe() ? T('Debes {monto} en total. En Pichibank son {bp}.', { monto: money(d.total), bp: money(d.totalBP) }) : T('En Pichibank debes {monto}. Las deudas de otros bancos no las veo.', { monto: money(d.totalBP) }), s: ['¿Cómo cierro el mes?'] };
    }
    if (/cierr|ritmo|termino|termina/.test(s0)) {
      var a = anticipa(m)[0];
      return { t: a && isCur(m) ? a.t + '. ' + a.s : T('En {mes} gastaste {monto}.', { mes: mesName(m), monto: money(s.gast) }), s: ['¿En qué se me va la plata?'] };
    }
    if (/ingres|gan|sueldo|pensi|remesa/.test(s0)) {
      return { t: T('En {mes} te entraron {monto} confirmados', { mes: mesName(m), monto: money(s.ing) }) + (s.rin ? T(', y {monto} de personas que no sé qué son.', { monto: money(s.rin) }) : '.'), s: ['¿Qué tengo por revisar?'] };
    }
    if (/gast|plata|en qu|cuánto|cuanto|queda|presupuesto/.test(s0)) {
      var ks = Object.keys(s.cats).sort(function (a, b) { return s.cats[b] - s.cats[a]; }).slice(0, 3);
      return { t: T('En {mes} gastaste {monto} de tu presupuesto de {p}.', { mes: mesName(m), monto: money(s.gast), p: money0(pres().general) }) + '<br><br>' +
        T('Lo que más pesó: {l}.', { l: ks.map(function (k) { return k.toLowerCase() + ' (' + money(s.cats[k]) + ')'; }).join(', ') }), s: ['¿Cómo cierro el mes?', '¿Qué tengo por revisar?'] };
    }
    return null;
  }

  /* ---------- Arranque ---------- */
  function open() { mount(); paint(); if (window.__goView) window.__goView(1); }
  function init() {
    mount(); if (!pf) return;
    paint();
    var fv = document.querySelector('.view[data-view="1"]');
    new MutationObserver(function () { if (fv.classList.contains('active')) hero3D(); }).observe(fv, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetOpen()) { e.stopImmediatePropagation(); closeSheet(); } }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.PFM = { open: open, paint: paint, settings: function () { if (DB) whoSheet(); }, pack: pack, answer: answer, key: key, ready: function () { return !!DB; },
    modo: function () { return ST.modo; } };
})();
