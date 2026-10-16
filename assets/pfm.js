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
  var ST = { u: 'andres', modo: 'mvp', per: 'mes', flujo: 'out', resp: {}, cats: {}, pres: {} };
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
    'Efectivo retirado': 'local_atm', 'Pagos con Deuna': 'qr_code_2', 'Transferencias a personas': 'person', 'Pagos a empresas': 'business',
    'Tarjetas de otros bancos': 'credit_card', 'Negocio': 'storefront'
  };
  var PFM13 = ['Vivienda', 'Alimentación', 'Transporte', 'Servicios básicos', 'Salud y bienestar', 'Educación', 'Compras personales', 'Entretenimiento', 'Familia y dependientes', 'Servicios financieros y deudas', 'Ahorro e inversión', 'Gobierno e impuestos', 'Otros'];
  var GRIS = { 'Efectivo retirado': 1, 'Pagos con Deuna': 1, 'Transferencias a personas': 1, 'Pagos a empresas': 1, 'Tarjetas de otros bancos': 1 };
  /* Grupos: lo que la persona ve arriba y donde pone su presupuesto. Las
     categorías quedan como detalle (y son lo que se recategoriza). Ver
     "Grupos de categorías" en el documento de concepto. */
  var GRUPOS = {
    'Hogar': { ic: 'home', cats: ['Vivienda', 'Servicios básicos'] },
    'Comida': { ic: 'restaurant', cats: ['Alimentación'] },
    'Movilidad': { ic: 'directions_bus', cats: ['Transporte'] },
    'Salud y educación': { ic: 'favorite', cats: ['Salud y bienestar', 'Educación'] },
    'Gustos': { ic: 'local_activity', cats: ['Entretenimiento', 'Compras personales'] },
    'Familia': { ic: 'family_restroom', cats: ['Familia y dependientes'] },
    'Compromisos': { ic: 'account_balance', cats: ['Servicios financieros y deudas', 'Gobierno e impuestos', 'Tarjetas de otros bancos'] },
    'Negocio': { ic: 'storefront', cats: ['Negocio'] },
    'Sin clasificar': { ic: 'help', cats: ['Otros', 'Pagos con Deuna', 'Efectivo retirado', 'Transferencias a personas', 'Pagos a empresas'], gris: true }
  };
  var GRUPO = {}; Object.keys(GRUPOS).forEach(function (g) { GRUPOS[g].cats.forEach(function (c) { GRUPO[c] = g; }); });
  function grupo(c) { return GRUPO[c] || 'Sin clasificar'; }
  var PRES_G = ['Hogar', 'Comida', 'Movilidad', 'Salud y educación', 'Gustos', 'Familia', 'Compromisos'];
  // Detalle dentro de una categoría: Alimentación se abre en supermercado y restaurantes
  var SUB = { 'Supermercado y tiendas': 'Alimentación', 'Restaurantes y delivery': 'Alimentación' };
  function detalle(r, cat) { return cat === 'Alimentación' ? (r.c === 'Restaurantes' ? 'Restaurantes y delivery' : 'Supermercado y tiendas') : cat; }
  var MAPC = { 'Restaurantes': 'Alimentación', 'Hogar': 'Compras personales', 'Salud': 'Salud y bienestar', 'Transferencia a persona': 'Transferencias a personas',
    'Pago a empresa': 'Pagos a empresas', 'Tarjetas de otros bancos (sin detalle)': 'Tarjetas de otros bancos', 'Pagos con Deuna': 'Pagos con Deuna' };
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
            cp: D.contraparte[r[5]], m: r[6], t: D.tratamiento[r[7]], c: D.categoria[r[8]], e: D.escenario[r[9]], n: D.nota[r[10]], s: r[11] };
        });
      });
      DB = { mov: U, usuarios: d.usuarios, deudas: d.deudas, escenarios: d.escenarios, hipoteca: d.hipoteca };
      if (!DB.mov[ST.u]) ST.u = 'andres';
      cache = {}; fijoCache = {};
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
  function curMes() { return meses()[0]; } // el mes en curso (ya no hay pestañas de meses)

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
  // En el MVP, un pago con Deuna se ve sin el nombre del comercio
  function desc(r) { return !tobe() && r.t === 'Detalle Deuna' && r.m < 0 && !catOv(r) ? T('Pago con Deuna') : r.desc; }
  function isRecarga(r) { return r.t === 'Gasto' && /^tú \(Deuna\)/.test(r.cp); }
  function cls(r, raw) {
    var a = raw ? null : answerOf(r), ov = raw ? null : catOv(r);
    if (a) {
      if (a.k === 'negocio') return tobe() ? { k: 'no', why: 'negocio', cat: 'Negocio' } : { k: 'gasto', cat: 'Negocio', ans: a };
      return { k: a.k, cat: ov || a.cat, why: a.why, ans: a };
    }
    switch (r.t) {
      case 'Gasto':
        if (isRecarga(r)) return { k: 'no', why: 'recarga' };
        if (r.c === 'Tarjetas de otros bancos (sin detalle)' && tobe()) return { k: 'no', why: 'pago_otro_banco' };
        return { k: 'gasto', cat: ov || mapc(r.c) };
      // MVP: el reporte de Deuna no dice dónde pagaste; to-be: sí, y Uku lo categoriza
      case 'Detalle Deuna': return r.m < 0 ? { k: 'gasto', cat: ov || (tobe() ? mapc(r.c) : 'Pagos con Deuna'), via: 'deuna' } : { k: 'no', why: 'deuna_in' };
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
    var o = { gast: 0, ing: 0, rin: 0, rout: 0, reemb: 0, fuera: 0, cats: {}, det: {}, grupos: {}, fijo: 0, inc: {}, n: list.length, rows: list };
    var fijos = list.length ? fijosDe(list[list.length - 1].mes) : {}, fc = {};
    list.forEach(function (r) {
      var c = cls(r), v = Math.abs(r.m), sg = c.k === 'reembolso' ? -v : v;
      if (c.k === 'gasto' || c.k === 'rout' || c.k === 'reembolso') {
        o.cats[c.cat] = (o.cats[c.cat] || 0) + sg;
        var d = detalle(r, c.cat); o.det[d] = (o.det[d] || 0) + sg;
        if (c.k === 'gasto' && fijos[r.cp + '|' + c.cat]) fc[c.cat] = (fc[c.cat] || 0) + v;
        if (c.k === 'rout') o.rout += v; if (c.k === 'reembolso') o.reemb += v;
      }
      else if (c.k === 'ingreso') { o.ing += v; o.inc[c.cat] = (o.inc[c.cat] || 0) + v; }
      else if (c.k === 'rin') o.rin += v;
      if (r.t === 'Fuera del MVP') o.fuera += v;
    });
    // Una categoría no queda en negativo: lo devuelto de más no se resta
    Object.keys(o.cats).forEach(function (k) { o.cats[k] = Math.max(0, r2(o.cats[k])); if (!o.cats[k]) delete o.cats[k]; o.gast += o.cats[k] || 0; });
    Object.keys(o.det).forEach(function (k) { o.det[k] = Math.max(0, r2(o.det[k])); if (!o.det[k]) delete o.det[k]; });
    Object.keys(o.cats).forEach(function (k) { var g = grupo(k); o.grupos[g] = r2((o.grupos[g] || 0) + o.cats[k]); });
    // Lo fijo, neto de lo que te devuelven en esa misma categoría (el arriendo compartido de Daniela)
    o.fijo = r2(Object.keys(fc).reduce(function (a, k) { return a + Math.min(fc[k], o.cats[k] || 0); }, 0));
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
  // Meses anteriores con datos (para comparar hace falta historia)
  function antes(m, n) { var ms = meses().filter(function (x) { return x < m; }); return ms.slice(0, n); }
  function prom(m, n) {
    var ms = antes(m, n); if (!ms.length) return null;
    var o = { gast: 0, cats: {} };
    o.grupos = {};
    ms.forEach(function (x) { var s = month(x); o.gast += s.gast / ms.length; Object.keys(s.cats).forEach(function (k) { o.cats[k] = (o.cats[k] || 0) + s.cats[k] / ms.length; });
      Object.keys(s.grupos).forEach(function (k) { o.grupos[k] = (o.grupos[k] || 0) + s.grupos[k] / ms.length; }); });
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
    PRES_G.filter(function (k) { return p.grupos[k] >= 20; }).forEach(function (k) { cats[k] = round(p.grupos[k] * 1.05, 10); });
    return { general: round(p.gast * 1.05, 50), cats: cats };
  }
  function pres() {
    var p = (ST.presG || (ST.presG = {}))[ST.u]; // presupuesto por grupo (cats = grupos)
    if (p) return p;
    var s = sugerido(meses()[0]) || { general: 1000, cats: {} };
    return { general: s.general, cats: s.cats, auto: true };
  }
  function setPres(p) { (ST.presG || (ST.presG = {}))[ST.u] = { general: p.general, cats: p.cats }; persist(); }

  /* ---------- Uku cuenta: hallazgos con reglas (MVP) ---------- */
  function hallazgos(m) {
    var s = month(m), out = [], cur = isCur(m), prev = prevMes(m), hasPrev = meses().indexOf(prev) >= 0;
    // Comparación con el mes anterior, al mismo día del mes
    if (hasPrev) {
      var dd = cur ? +HOY.slice(8, 10) : 31, p = month(prev, cur ? dd : null), d = s.gast - p.gast;
      if (p.gast > 0 && Math.abs(d) / p.gast >= .05) {
        var ch = Object.keys(Object.assign({}, s.grupos, p.grupos)).filter(function (k) { return !GRUPOS[k].gris; })
          .map(function (k) { return { k: k, d: (s.grupos[k] || 0) - (p.grupos[k] || 0) }; })
          .sort(function (a, b) { return d > 0 ? b.d - a.d : a.d - b.d; })[0];
        out.push({ icon: d > 0 ? 'trending_up' : 'trending_down', kind: d > 0 ? 'warn' : 'good', g: ch && Math.abs(ch.d) >= 10 ? ch.k : null,
          t: T(d > 0 ? 'Gastaste {pct} más que en {mes}' : 'Gastaste {pct} menos que en {mes}', { pct: pct(Math.abs(d) / p.gast), mes: mesName(prev) }) + (cur ? ' ' + T('a esta altura') : ''),
          s: ch && Math.abs(ch.d) >= 10 ? T(ch.d > 0 ? 'Lo que más subió fue {cat}: {monto} más.' : 'Lo que más bajó fue {cat}: {monto} menos.', { cat: ch.k.toLowerCase(), monto: money(Math.abs(ch.d)) }) : T('Comparo hasta el mismo día del mes.'), ask: '¿En qué se me va la plata?' });
      }
    }
    var ms = antes(m, 3);
    if (ms.length < 3) {
      out.push({ icon: 'hourglass_top', kind: 'info', t: T('Todavía te estoy conociendo'), s: hasPrev ? T('Con tres meses de movimientos te cuento tus tendencias. Por ahora solo comparo con el mes anterior.') : T('Con tres meses de movimientos te cuento tus tendencias y te comparo con tus meses anteriores.') });
    } else {
      // Una categoría que subió frente a tu promedio
      var av = prom(m, 3), up = Object.keys(s.grupos).filter(function (k) { return !GRUPOS[k].gris && av.grupos[k] > 15; })
        .map(function (k) { return { k: k, r: s.grupos[k] / av.grupos[k] - 1, d: s.grupos[k] - av.grupos[k] }; })
        .filter(function (x) { return x.r >= .2 && x.d >= 20; }).sort(function (a, b) { return b.d - a.d; })[0];
      if (up && !cur) out.push({ icon: GRUPOS[up.k].ic, kind: 'warn', g: up.k, t: T('Tus gastos de {cat} aumentaron {pct}', { cat: up.k.toLowerCase(), pct: pct(up.r) }),
        s: T('Fueron {monto}; tu promedio de los últimos tres meses es {prom}.', { monto: money(s.grupos[up.k]), prom: money(av.grupos[up.k]) }), ask: '¿En qué se me va la plata?' });
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
      var k = r.cp + '|' + c.cat; (by[k] = by[k] || { cp: r.cp, cat: c.cat, ms: {}, dias: [], m: [] }); by[k].ms[r.mes] = 1; by[k].dias.push(r.dia); by[k].m.push(-r.m);
    });
    return Object.keys(by).map(function (k) { return by[k]; }).filter(function (x) {
      return Object.keys(x.ms).length >= 3 && x.m.length <= 6 && Math.min.apply(null, x.m) >= 5 && Math.max.apply(null, x.m) <= Math.min.apply(null, x.m) * 1.3; // mismo monto, más o menos; sin comisiones
    })
      .map(function (x) { var d = x.dias.slice().sort(function (a, b) { return a - b; })[Math.floor(x.dias.length / 2)]; return { cp: x.cp, cat: x.cat, dia: d, monto: r2(x.m.reduce(function (a, b) { return a + b; }, 0) / x.m.length) }; })
      .sort(function (a, b) { return a.dia - b.dia; });
  }
  // Fijo o variable: un gasto es fijo si va a la misma persona o empresa casi todos los meses
  var fijoCache = {};
  function fijosDe(m) {
    var k = ckey() + '|' + m; if (fijoCache[k]) return fijoCache[k];
    var o = {}; fijoCache[k] = o;
    recurrentes(m).forEach(function (x) { o[x.cp + '|' + x.cat] = 1; });
    return o;
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
    if (c.via === 'deuna') return c.cat === 'Pagos con Deuna' ? T('Pagaste con Deuna, pero el reporte no dice dónde. Ponle una categoría y lo cuento ahí.') : T('Pagaste con Deuna. Lo cuento en {cat}.', { cat: c.cat });
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
    // Si quedaron consumos sin clasificar de semanas anteriores, su bosque se seca
    var W = tareas().W; if (W.slice(0, -1).some(function (w) { return !w.ok; })) return 'preocupado';
    var s = month(m), p = pres().general, f = isCur(m) ? +HOY.slice(8, 10) / diasMes(m) : 1;
    if (s.gast > p) return 'preocupado';
    if (s.gast / p > f * .95 || preguntas(m).some(function (x) { return x.enMes.length; })) return 'atento';
    return isCur(m) ? 'tranquilo' : 'feliz';
  }

  /* =====================================================================
     Pantalla. Tres niveles, de lo que más importa a lo que menos:
     1. Tu dinero en Pichibank: saldo, deudas, por pagar, score y productos.
        Cada cifra es una puerta al detalle.
     2. Uku: lo que notó, en frases cortas, y el juego de ordenar gastos.
        En el to-be, Uku es el protagonista (oso 3D, anticipa, analiza).
     3. En qué se va tu plata: gastos o ingresos, por grupo, en el periodo
        que elijas, con el presupuesto donde aplica.
     Sin pestañas de meses: el periodo se elige dentro de la sección 3.
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
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function sumv(a, f) { return r2(a.reduce(function (s, x) { return s + f(x); }, 0)); }

  /* ---------- 1. Tu dinero en Pichibank ---------- */
  // Score crediticio: dato de ejemplo (la consulta a Equifax está por decidir)
  var SCORE = {
    andres: { v: 712, n: 'Bueno', s: 'Pagas a tiempo en Pichibank. Lo que más lo baja es el saldo de tu Visa Banco Guayaquil, que sigue creciendo.' },
    rosa: { v: 668, n: 'Regular', s: 'Tienes un crédito en la Cooperativa JEP y otro en una casa comercial. Pagarlos a tiempo lo sube.' },
    daniela: { v: 694, n: 'Bueno', s: 'Tu historial todavía es corto y en febrero se atrasó una cuota de Etafashion. Con pagos a tiempo, sube.' },
    jorge: { v: 836, n: 'Excelente', s: 'Pagas el total de tus tarjetas cada mes y tu hipoteca del BIESS va al día.' }
  };
  function saldos() {
    var last = {};
    rows().forEach(function (r) { if (r.s != null && (r.prod === 'Cuenta' || r.prod === 'Deuna')) last[r.src] = r.s; });
    return Object.keys(last).map(function (k) { return { n: k, v: last[k] }; }).sort(function (a, b) { return b.v - a.v; });
  }
  // Facturas y cuotas de los próximos 30 días: lo que se paga cada mes a la misma empresa
  function facturas() {
    var m = HOY.slice(0, 7), d = +HOY.slice(8, 10), ms = antes(m, 4), by = {};
    rows().forEach(function (r) {
      if (r.m >= 0 || (ms.indexOf(r.mes) < 0 && r.mes !== m)) return;
      var tarjeta = r.c === 'Tarjetas de otros bancos (sin detalle)' || (r.t === 'Excluido' && r.c === 'Pago de tarjeta' && r.prod === 'Cuenta');
      if (!(tarjeta || (r.t === 'Gasto' && FIJO[mapc(r.c)] && !isRecarga(r)))) return;
      var k = r.cp + '|' + r.c, x = by[k] || (by[k] = { cp: r.cp, c: r.c, tarjeta: tarjeta, ms: {}, dias: [], m: [] });
      if (r.mes === m) { x.pagado = true; return; }
      x.ms[r.mes] = 1; x.dias.push(r.dia); x.m.push(-r.m);
    });
    return Object.keys(by).map(function (k) { return by[k]; }).filter(function (x) {
      return Object.keys(x.ms).length >= 3 && x.m.length <= 6 && Math.min.apply(null, x.m) >= 5 && (x.tarjeta || Math.max.apply(null, x.m) <= Math.min.apply(null, x.m) * 1.3);
    }).map(function (x) {
      var dia = x.dias.slice().sort(function (a, b) { return a - b; })[Math.floor(x.dias.length / 2)];
      var f = dia > d ? (x.pagado ? null : m + '-' + pad(dia)) : nextMes(m) + '-' + pad(Math.min(dia, diasMes(nextMes(m))));
      var n = x.c === 'Vivienda' && x.cp === 'Pichibank' ? T('Cuota de tu hipoteca') : x.c === 'Pago de tarjeta' ? T('Tu tarjeta Pichibank') : x.tarjeta ? T('Tarjeta {b}', { b: x.cp.replace(/^Banco /, '') }) : x.cp;
      return f && { n: n, f: f, monto: x.m[x.m.length - 1], ic: x.tarjeta ? 'credit_card' : CAT[mapc(x.c)] || 'receipt_long', aprox: x.tarjeta };
    }).filter(Boolean).sort(function (a, b) { return a.f.localeCompare(b.f); });
  }
  function productos() {
    var sl = saldos(), d = deudas();
    return sl.map(function (x) { return { n: x.n, v: x.v, ic: /Deuna/.test(x.n) ? 'qr_code_2' : 'account_balance', tipo: 'saldo' }; })
      .concat(d.bp.map(function (x) { return { n: x.producto, v: x.saldo, ic: /Hipoteca/.test(x.producto) ? 'home' : 'credit_card', tipo: 'deuda' }; }));
  }
  function tile(k, ic, l, v, s, warn) {
    return '<button class="pfm-tile' + (warn ? ' is-warn' : '') + '" data-pfm="' + k + '"><span class="pfm-tile__top"><span class="material-symbols-rounded" aria-hidden="true">' + ic + '</span>' + l + '</span>' +
      '<b>' + v + '</b><small>' + s + '</small></button>';
  }
  function dineroHTML() {
    var total = sumv(saldos(), function (x) { return x.v; }), d = deudas(), fs = facturas(), sc = SCORE[ST.u], deuda = tobe() ? d.total : d.totalBP;
    return '<section class="pfm-money" aria-label="' + T('Tu dinero en Pichibank') + '">' +
      '<p class="pfm-money__label">' + T('Saldo disponible') + '</p>' +
      '<button class="pfm-money__value" data-pfm="products">' + money(total) + '<span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>' +
      '<p class="pfm-money__sub">' + T('En tus cuentas Pichibank y Deuna') + '</p>' +
      '<div class="pfm-tiles">' +
        tile('debt', 'credit_card', T('Deudas'), money0(deuda), tobe() ? T('En todos tus bancos') : T('En Pichibank')) +
        tile('bills', 'event', T('Por pagar'), money0(sumv(fs, function (x) { return x.monto; })), fs.length === 1 ? T('1 pago en 30 días') : T('{n} pagos en 30 días', { n: fs.length })) +
        tile('score', 'speed', T('Tu score'), String(sc.v), T(sc.n)) +
        tile('products', 'account_balance_wallet', T('Tus productos'), String(productos().length), T('Cuentas, tarjetas y créditos')) +
      '</div></section>';
  }

  /* ---------- 2. Uku: lo que notó y ordenar gastos ---------- */
  function insights() {
    var m = curMes();
    return (tobe() ? anticipa(m) : []).concat(hallazgos(m)).map(accion);
  }
  // Los hallazgos llevan a hacer algo; los que solo informan no llevan botón
  function accion(x) {
    var A = { credit_card: ['debt', 'Ver tus deudas'], flight_land: ['ing', 'Ver tus ingresos'], speed: ['budgets', 'Ver tu presupuesto'],
      event_upcoming: ['bills', 'Ver por pagar'], tune: ['bud:sug', 'Usar el sugerido'], local_atm: ['grupo:Sin clasificar', 'Ver tus retiros'] }[x.icon];
    if (x.g) A = ['grupo:' + x.g, T('Ver {g}', { g: T(x.g).toLowerCase() })];
    if (A) { x.go = A[0]; x.gol = T(A[1]); }
    return x;
  }
  function saludo() {
    var a = tobe() ? anticipa(curMes())[0] : null;
    return T('Hola, {n}.', { n: nombre() }) + ' ' + (a ? a.t + '.' : T('Te cuento lo que noté en tus movimientos.'));
  }
  function ukuHTML() {
    // En el to-be la predicción va en el saludo de Uku: no se repite en las tarjetas
    var m = curMes(), all = insights(), off = tobe() && anticipa(m).length ? 1 : 0, ins = all.slice(off);
    var html = '<section class="pf-sec pfm-uku' + (tobe() ? ' is-tobe' : '') + '">';
    if (tobe()) {
      html += '<div class="pfm-ukuhero pf-mood--' + mood(m) + '"><div class="pf-hero pfm-hero"><div class="b3d" data-score="' + bosque() + '"><div class="b3d__fallback">' + (window.Asistente ? Asistente.petSVG() : '') + '</div></div></div>' +
        '<div class="pfm-ukuhero__say"><p class="pfm-ukuhero__name">Uku · ' + T('está {animo}', { animo: MOOD[mood(m)] }) + '</p><p class="pfm-ukuhero__t">' + esc(saludo()) + '</p>' +
        '<div class="pfm-ukuhero__acts"><button class="ai-cta ai-cta--sm" data-pfm="analyze"><span class="ai-cta__spark material-symbols-rounded" aria-hidden="true">auto_awesome</span><span class="ai-cta__t"><b>' + T('Analizar') + '</b></span><span class="ai-badge">IA</span></button>' +
        '<button class="pfm-askuku" data-pfm="ai:"><span class="material-symbols-rounded" aria-hidden="true">chat_bubble</span>' + T('Pregúntale') + '</button></div></div></div>';
    }
    html += '<div class="pfm-sec__head">' + (tobe() ? '' : '<span class="pfm-face">' + face() + '</span>') + '<h2>' + T(tobe() ? 'Lo que Uku ve venir' : 'Uku te cuenta') + '</h2>' +
      (ins.length ? '<button class="pf-link" data-pfm="insights">' + T('Ver todo') + '</button>' : '') + '</div>';
    html += '<div class="pfm-carousel" role="list">' + ins.slice(0, 6).map(function (x, i) {
      return '<button role="listitem" class="pfm-ins is-' + x.kind + '" data-pfm="' + (x.go || 'ins:' + (i + off)) + '"><span class="material-symbols-rounded" aria-hidden="true">' + x.icon + '</span><b>' + esc(x.t) + '</b>' +
        (x.go ? '<span class="pfm-ins__go">' + esc(x.gol) + '<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></span>' : '') + '</button>';
    }).join('') + '</div>';
    return html + tareaHTML() + '</section>';
  }

  /* El juego: tarjetas de a una, como Tinder. Derecha = Uku acertó; izquierda
     = no, y eliges tú. Cada respuesta se guarda y se aplica a los parecidos.
     MVP: el banco no sabe dónde pagaste con Deuna ni qué son las
     transferencias de personas, así que hay más por ordenar. To-be: Uku ya
     ordenó casi todo y solo pregunta lo que no puede saber. */
  var SIN = { 'Pagos con Deuna': 1, 'Transferencias a personas': 1, 'Pagos a empresas': 1, 'Otros': 1 };
  /* Tarea semanal: cada lunes Uku junta lo que no pudo clasificar de la
     semana. Mira las últimas 4 semanas: cada semana al día es un árbol que
     crece en su bosque; lo que se deja pendiente lo va secando. */
  var SEMANAS = 4;
  function lunes(f) { return addDays(f, -((wday(f) + 6) % 7)); }
  function semanas() {
    var ini = addDays(lunes(HOY), -7 * (SEMANAS - 1)), out = [];
    for (var i = 0; i < SEMANAS; i++) { var a = addDays(ini, 7 * i); out.push({ ini: a, fin: addDays(a, 6), total: 0, pend: 0, cur: i === SEMANAS - 1 }); }
    return out;
  }
  // Todo lo que estuvo sin clasificar en la ventana (respondido o no), con su semana
  function tareas() {
    var W = semanas(), ini = W[0].ini, out = [], qs = {};
    rows().forEach(function (r) {
      if (r.f < ini || r.f > HOY) return;
      if (r.t === 'Por revisar') { qs[gkey(r)] = 1; return; }
      var c = cls(r, true); if (c.k !== 'gasto' || !SIN[c.cat]) return;
      out.push({ t: 'r', r: r, f: r.f, done: !!catOv(r) });
    });
    // Las preguntas pendientes de antes de la ventana también cuentan (en su primera semana)
    rows().forEach(function (r) { if (r.f < ini && r.t === 'Por revisar' && !resp()[gkey(r)]) qs[gkey(r)] = 1; });
    Object.keys(qs).forEach(function (k) {
      var rs = rows().filter(function (r) { return r.t === 'Por revisar' && gkey(r) === k; }), last = rs[rs.length - 1];
      var x = { k: k, cp: last.cp, sign: last.m > 0 ? '+' : '-', rows: rs, last: last, tpl: tplOf(last), total: r2(rs.reduce(function (a, r) { return a + Math.abs(r.m); }, 0)) };
      out.push({ t: 'q', q: x, f: last.f < ini ? ini : last.f > HOY ? HOY : last.f, done: !!resp()[k] });
    });
    out.forEach(function (it) { it.sem = lunes(it.f); });
    W.forEach(function (w) { out.forEach(function (it) { if (it.sem === w.ini) { w.total++; if (!it.done) w.pend++; } }); w.ok = !w.pend; });
    return { W: W, list: out };
  }
  // Lo pendiente: primero esta semana, luego las anteriores; dentro, preguntas primero y lo más reciente arriba
  function items() {
    return tareas().list.filter(function (it) { return !it.done; }).map(function (it) { it.sug = it.t === 'q' ? it.q.tpl.o[0] : sugerir(it.r); return it; })
      .sort(function (a, b) { return b.sem.localeCompare(a.sem) || (a.t === 'q' ? 0 : 1) - (b.t === 'q' ? 0 : 1) || b.f.localeCompare(a.f); });
  }
  // Racha: semanas seguidas al día, contando hacia atrás desde la anterior (y esta, si ya está)
  function racha(W) {
    var n = W[W.length - 1].ok ? 1 : 0;
    for (var i = W.length - 2; i >= 0 && W[i].ok; i--) n++;
    return n;
  }
  // El bosque de Uku crece con las semanas al día (de 20 a 100)
  function bosque() { var W = tareas().W; return Math.round(20 + 80 * W.filter(function (w) { return w.ok; }).length / W.length); }
  function forestHTML(W) {
    return '<div class="pfm-forest" role="img" aria-label="' + T('{n} de {t} semanas al día', { n: W.filter(function (w) { return w.ok; }).length, t: W.length }) + '">' + W.map(function (w) {
      var st = w.ok ? 'ok' : w.cur ? 'cur' : 'dry';
      return '<span class="pfm-tree is-' + st + '"><span class="material-symbols-rounded" aria-hidden="true">' + (w.ok ? 'park' : w.cur ? 'potted_plant' : 'grass') + '</span><small>' + (w.cur ? T('Esta semana') : dshort(w.ini)) + '</small></span>';
    }).join('') + '</div>';
  }
  function sugerir(r) {
    var h = +r.h.slice(0, 2), v = -r.m, ap = user().nombre.split(' ')[1];
    if (ap && r.cp.indexOf(ap) >= 0) return { cat: 'Familia y dependientes', why: T('Comparte tu apellido.') };
    if (tobe() && r.c !== 'Transferencia a persona') return { cat: mapc(r.c), why: T('Por el comercio: {c}.', { c: r.cp }) };
    if (h >= 11 && h <= 15 && v <= 20) return { cat: 'Alimentación', why: T('Fue a la hora del almuerzo.') };
    if (v <= 3) return { cat: 'Transporte', why: T('Es un monto chico, como un bus o un taxi.') };
    if ((h >= 19 || wday(r.f) % 6 === 0) && v <= 40) return { cat: 'Entretenimiento', why: T('Fue de noche o en fin de semana.') };
    return null;
  }
  // Uku pide la tarea de la semana; su bosque muestra cómo vas
  var TANDA = 10; // se clasifica de a 10, sin prisa
  function tareaHTML() {
    var T0 = tareas(), W = T0.W, pend = T0.list.filter(function (it) { return !it.done; }).length;
    // Las semanas que ya terminaron y quedaron pendientes secan el bosque
    var secas = W.slice(0, -1).filter(function (w) { return !w.ok; }).length, rc = racha(W), msg;
    if (pend) msg = secas ? T(secas === 1 ? 'Una semana quedó pendiente y mi bosque se está secando. ¿Me ayudas?' : '{n} semanas quedaron pendientes y mi bosque se está secando. ¿Me ayudas?', { n: secas })
      : tobe() ? T('Clasifiqué el resto; estos solo tú los sabes.') : T('¿Me ayudas? Es un minuto.');
    else msg = T('¡Todo clasificado! Mi bosque crece con cada semana al día. Vuelvo el lunes con lo nuevo.');
    return '<div class="pfm-task' + (pend ? '' : ' is-done') + '">' +
      (pend ? '<p class="pfm-task__label">' + T('Consumos sin clasificar') + '</p><p class="pfm-task__n">' + pend + '</p><p class="pfm-task__sub">' + T('Clasifica {n} cada vez, sin prisa.', { n: TANDA }) + '</p>' : '') +
      '<div class="pfm-task__say"><span class="pfm-face">' + face() + '</span><p class="pfm-task__bubble">' + esc(msg) + '</p></div>' +
      forestHTML(W) +
      '<p class="pfm-task__meta"><span class="material-symbols-rounded" aria-hidden="true">local_fire_department</span>' + (rc ? T(rc === 1 ? 'Racha de 1 semana' : 'Racha de {n} semanas', { n: rc }) : T('Sin racha todavía')) + ' · ' + T('Uku te lo pide cada lunes') + '</p>' +
      (pend ? '<button class="pfm-task__go" data-pfm="game">' + T('Clasificar {n}', { n: Math.min(TANDA, pend) }) + '<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>' : '') + '</div>';
  }

  /* El juego, como Clutter: un consumo por pantalla, con lo que ayuda a
     recordar (monto, a quién, cuándo y por dónde) y un toque en el grupo.
     Lo que sugiere Uku va primero y marcado. Las respuestas se guardan al
     final, después de revisar el resumen. */
  var OPCATS = [['Alimentación', 'Comida'], ['Transporte', 'Movilidad'], ['Vivienda', 'Hogar'], ['Salud y bienestar', 'Salud y educación'], ['Entretenimiento', 'Gustos'], ['Familia y dependientes', 'Familia'], ['Servicios financieros y deudas', 'Compromisos'], ['Otros', 'Otro']];
  var G = null, gel = null;
  function gameOpen() {
    var all = items();
    G = { list: all.slice(0, TANDA), total: all.length, i: 0, ans: [], from: tareas().W, view: 'card' };
    if (!G.list.length) return toast(T('No tienes nada por clasificar.'));
    if (!gel) {
      gel = document.createElement('div'); gel.className = 'pfm-game'; gel.setAttribute('role', 'dialog'); gel.setAttribute('aria-modal', 'true'); gel.setAttribute('aria-label', T('Clasifica tus consumos'));
      document.body.appendChild(gel);
      gel.addEventListener('click', function (e) { var b = e.target.closest('[data-g]'); if (b) gameKey(b.dataset.g); });
      document.addEventListener('keydown', function (e) { if (gel.classList.contains('open') && e.key === 'Escape') { e.stopImmediatePropagation(); gameClose(); } }, true);
    }
    gameRender(); gel.classList.add('open'); document.documentElement.classList.add('has-ai'); fx('open');
  }
  function gameClose() { if (!gel) return; gel.classList.remove('open'); document.documentElement.classList.remove('has-ai'); fx('close'); refresh(); }
  function iniciales(n) { return String(n).replace(/^tú.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || '·'; }
  function cardHTML(it) {
    var who, amt, cuando, por, av, pos = false;
    if (it.t === 'q') {
      var x = it.q; pos = x.sign === '+';
      who = corto(x.cp); amt = x.total; av = '<span class="pfm-card__av">' + iniciales(x.cp) + '</span>';
      cuando = x.rows.length > 1 ? T('{n} veces · la última el {f}', { n: x.rows.length, f: dshort(x.last.f) }) : DIA[wday(x.last.f)].replace(/s$/, '') + ' ' + dshort(x.last.f) + ' · ' + x.last.h;
      por = x.last.src.replace(/ Pichibank/, '');
    } else {
      var r = it.r, d = desc(r), deuna = /Deuna/.test(r.src);
      who = d; amt = -r.m; av = '<span class="pfm-card__av' + (deuna ? ' is-qr' : '') + '">' + (deuna && d === T('Pago con Deuna') ? '<span class="material-symbols-rounded">qr_code_2</span>' : iniciales(d)) + '</span>';
      cuando = DIA[wday(r.f)].replace(/s$/, '') + ' ' + dshort(r.f) + ' · ' + r.h; por = r.src.replace(/ Pichibank/, '');
    }
    return '<div class="pfm-card">' + av + '<p class="pfm-card__who">' + esc(who) + '</p>' +
      '<p class="pfm-card__amt' + (pos ? ' is-pos' : '') + '">' + (pos ? '+' : '−') + money(amt) + '</p>' +
      '<p class="pfm-card__row"><span class="material-symbols-rounded" aria-hidden="true">schedule</span>' + esc(cuando) + '</p>' +
      '<p class="pfm-card__row"><span class="material-symbols-rounded" aria-hidden="true">' + (/Deuna/.test(por) ? 'qr_code_2' : 'account_balance') + '</span>' + esc(por) + '</p></div>';
  }
  // Las opciones: un toque. La de Uku va primero y marcada
  function choicesHTML(it) {
    if (it.t === 'q') {
      return '<p class="pfm-game__ask">' + T(it.q.sign === '+' ? '¿Qué es esta plata?' : '¿Qué le enviaste?') + '</p><div class="pfm-choices is-list">' + it.q.tpl.o.map(function (id, i) {
        return '<button class="pfm-choice' + (i === 0 ? ' is-sug' : '') + '" data-g="opt:' + id + '">' + esc(OPT[id].l) + (i === 0 ? '<em class="material-symbols-rounded" title="' + T('Uku cree') + '" aria-label="' + T('Uku cree') + '">auto_awesome</em>' : '') + '</button>'; }).join('') + '</div>';
    }
    var sg = it.sug && it.sug.cat, ops = OPCATS.slice().sort(function (a, b) { return (b[0] === sg) - (a[0] === sg); });
    return '<p class="pfm-game__ask">' + T('¿En qué fue?') + (it.sug ? '<small>' + esc(it.sug.why) + '</small>' : '') + '</p><div class="pfm-choices">' + ops.map(function (c) {
      return '<button class="pfm-choice' + (c[0] === sg ? ' is-sug' : '') + '" data-g="cat:' + c[0] + '"><span class="material-symbols-rounded" aria-hidden="true">' + (GRUPOS[c[1]] ? GRUPOS[c[1]].ic : 'category') + '</span>' + T(c[1]) + (c[0] === sg ? '<em class="material-symbols-rounded" title="' + T('Uku cree') + '" aria-label="' + T('Uku cree') + '">auto_awesome</em>' : '') + '</button>'; }).join('') + '</div>';
  }
  function topHTML(right) {
    return '<div class="pfm-game__top"><button class="pfm-pill-btn" data-g="stop">' + T('Detener') + '</button><b class="pfm-game__count">' + (right || '') + '</b>' +
      '<button class="pfm-pill-btn" data-g="result">' + T('Resultado') + '</button></div>';
  }
  function etiqueta(v) { if (OPT[v]) return OPT[v].l; var c = OPCATS.filter(function (x) { return x[0] === v; })[0]; return c ? T(c[1]) : v; }
  function gameRender() {
    var L = G.list, it = L[G.i];
    if (G.view === 'result' || !it) return resultRender();
    if (G.view === 'done') return doneRender();
    gel.innerHTML = topHTML(T('{a} / {b}', { a: G.i + 1, b: L.length })) +
      '<div class="pfm-play__bar"><i style="width:' + (G.i / L.length * 100).toFixed(0) + '%"></i></div>' +
      '<p class="pfm-game__note">' + T('Puedes cambiar tu respuesta antes de guardar.') + '</p>' +
      cardHTML(it) + choicesHTML(it) +
      '<div class="pfm-game__acts">' + (G.i ? '<button class="pfm-pill-btn" data-g="back"><span class="material-symbols-rounded" aria-hidden="true">undo</span>' + T('Atrás') + '</button>' : '') +
      '<button class="pfm-pill-btn" data-g="later"><span class="material-symbols-rounded" aria-hidden="true">schedule</span>' + T('Más tarde') + '</button></div>';
  }
  // Revisar antes de guardar: cuántos van a cada grupo
  function resultRender() {
    var by = {}, later = G.list.length - G.ans.filter(Boolean).length;
    G.ans.forEach(function (a) { if (!a) return; var k = etiqueta(a.v); (by[k] = by[k] || { n: 0, m: 0, ic: a.ic }); by[k].n++; by[k].m += a.monto; });
    var n = G.ans.filter(Boolean).length;
    gel.innerHTML = '<div class="pfm-game__top"><button class="pfm-pill-btn" data-g="close">' + T('Cerrar') + '</button><span></span><span></span></div>' +
      '<div class="pfm-game__result"><span class="pfm-game__check material-symbols-rounded" aria-hidden="true">check</span>' +
      '<h2>' + (n === 1 ? T('1 consumo clasificado') : T('{n} consumos clasificados', { n: n })) + '</h2><p>' + T('Revísalo una última vez antes de guardar.') + '</p>' +
      '<div class="pfm-sum">' + Object.keys(by).map(function (k) {
        return '<div class="pfm-sum__row"><span class="material-symbols-rounded" aria-hidden="true">' + by[k].ic + '</span><span>' + esc(k) + '</span><b>' + (by[k].n === 1 ? T('1 consumo') : T('{n} consumos', { n: by[k].n })) + '</b></div>';
      }).join('') + (later ? '<div class="pfm-sum__row"><span class="material-symbols-rounded" aria-hidden="true">schedule</span><span>' + T('Más tarde') + '</span><b>' + (later === 1 ? T('1 consumo') : T('{n} consumos', { n: later })) + '</b></div>' : '') + '</div>' +
      (n ? '<button class="pfm-task__go" data-g="save">' + T('Guardar clasificación') + '<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>' : '<button class="pfm-task__go" data-g="close">' + T('Volver') + '</button>') +
      (G.i < G.list.length ? '<button class="pf-link pf-link--block" data-g="resume">' + T('Seguir clasificando') + '</button>' : '') +
      '<p class="pf-note">' + T('Lo que guardes se aplica a los consumos parecidos. Puedes cambiarlo en cada movimiento.') + '</p></div>';
  }
  // Después de guardar: el bosque de Uku
  function doneRender() {
    var W = tareas().W, crec = W.filter(function (w, i) { return w.ok && !G.from[i].ok; }).length, rc = racha(W), quedan = items().length;
    gel.innerHTML = '<div class="pfm-game__top"><button class="pfm-pill-btn" data-g="close">' + T('Cerrar') + '</button><span></span><span></span></div>' +
      '<div class="pfm-game__end"><span class="pfm-game__burst" aria-hidden="true">' + face() + '</span><h2>' + T('¡Gracias!') + '</h2>' +
      '<p>' + (crec ? T(crec === 1 ? 'Creció 1 árbol en mi bosque.' : 'Crecieron {n} árboles en mi bosque.', { n: crec }) : T('Mi bosque crece cuando una semana queda al día.')) + '</p>' +
      forestHTML(W) + (rc ? '<p class="pfm-task__meta"><span class="material-symbols-rounded" aria-hidden="true">local_fire_department</span>' + T(rc === 1 ? 'Racha de 1 semana' : 'Racha de {n} semanas', { n: rc }) + '</p>' : '') +
      (quedan ? '<button class="pfm-task__go" data-g="more">' + T('Clasificar {n} más', { n: Math.min(TANDA, quedan) }) + '<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>' : '') +
      '<button class="pf-link pf-link--block" data-g="close">' + T('Ver mis gastos') + '</button></div>';
    fx('success');
  }
  function gameKey(k) {
    var p = k.split(':'), it = G && G.list[G.i];
    switch (p[0]) {
      case 'close': return gameClose();
      case 'stop': case 'result': G.view = 'result'; fx('select'); return gameRender();
      case 'resume': G.view = 'card'; return gameRender();
      case 'back': if (G.i) { G.i--; G.ans[G.i] = null; fx('tap'); gameRender(); } return;
      case 'later': G.ans[G.i] = null; G.i++; fx('tap'); return gameRender();
      case 'opt': case 'cat': {
        if (!it) return;
        var v = p.slice(1).join(':'), oc = OPCATS.filter(function (c) { return c[0] === v; })[0];
        G.ans[G.i] = { it: it, v: v, monto: it.t === 'q' ? it.q.total : -it.r.m, ic: oc ? (GRUPOS[oc[1]] ? GRUPOS[oc[1]].ic : 'category') : 'person' };
        G.i++; fx('select');
        var card = gel.querySelector('.pfm-card'); if (card) { card.classList.add('is-gone'); setTimeout(gameRender, 160); } else gameRender();
        return;
      }
      case 'save': {
        G.ans.forEach(function (a) { if (!a) return; if (a.it.t === 'q') resp()[a.it.q.k] = a.v; else (ST.cats[ST.u] || (ST.cats[ST.u] = {}))[a.it.r.i] = a.v; });
        persist(); cache = {}; fijoCache = {}; G.view = 'done'; return gameRender();
      }
      case 'more': return gameOpen();
    }
  }

  /* ---------- 3. En qué se va tu plata ---------- */
  var PER = [['sem', 'Esta semana'], ['mes', 'Este mes'], ['mesp', 'Mes pasado'], ['3m', '3 meses'], ['ano', '12 meses']];
  function per() {
    var m = HOY.slice(0, 7), pm = prevMes(m), d = +HOY.slice(8, 10);
    switch (ST.per) {
      case 'sem': return { o: range(addDays(HOY, -6), HOY), prev: range(addDays(HOY, -13), addDays(HOY, -7)), l: T('esta semana'), lp: T('la semana pasada') };
      case 'mesp': return { o: month(pm), m: pm, prev: month(prevMes(pm)), l: T('en {mes}', { mes: mesName(pm) }), lp: mesName(prevMes(pm)) };
      case '3m': { var a3 = prevMes(prevMes(m)); return { o: range(a3 + '-01', HOY), meses: 3, l: T('desde {mes}', { mes: mesName(a3) }) }; }
      case 'ano': { var a = m; for (var i = 0; i < 11; i++) a = prevMes(a); return { o: range(a + '-01', HOY), meses: 12, l: T('en los últimos 12 meses') }; }
      default: ST.per = 'mes'; return { o: month(m), m: m, cur: true, prev: month(pm, d), l: T('este mes'), lp: T('{mes} a esta altura', { mes: mesName(pm) }) };
    }
  }
  function cmpHTML(a, b, lp, ing) {
    if (b == null || !b) return '';
    var d = (a - b) / b; if (Math.abs(d) < .03) return '<span class="pfm-cmp">' + T('Igual que {p}', { p: lp }) + '</span>';
    var bueno = ing ? d > 0 : d < 0;
    return '<span class="pfm-cmp ' + (bueno ? 'is-good' : 'is-bad') + '"><span class="material-symbols-rounded" aria-hidden="true">' + (d > 0 ? 'arrow_upward' : 'arrow_downward') + '</span>' + T('{pct} {dir} que {p}', { pct: pct(Math.abs(d)), dir: d > 0 ? T('más') : T('menos'), p: lp }) + '</span>';
  }
  function gastosHTML() {
    var P = per(), s = P.o, ing = ST.flujo === 'in', pr = pres(), mb = P.m ? pr : null;
    var html = '<section class="pf-sec pfm-flow"><div class="pfm-sec__head"><h2>' + T('En qué se va tu plata') + '</h2></div>' +
      '<div class="pfm-filters"><div class="pfm-seg" role="radiogroup" aria-label="' + T('Tipo') + '">' +
        '<button role="radio" aria-checked="' + !ing + '" data-pfm="flujo:out">' + T('Gastos') + '</button><button role="radio" aria-checked="' + ing + '" data-pfm="flujo:in">' + T('Ingresos') + '</button></div>' +
      '<div class="pfm-chips" role="radiogroup" aria-label="' + T('Periodo') + '">' + PER.map(function (x) {
        return '<button class="pf-catchip" role="radio" aria-pressed="' + (ST.per === x[0]) + '" data-pfm="per:' + x[0] + '">' + T(x[1]) + '</button>'; }).join('') + '</div></div><div class="pf-mcard pfm-flowcard">';
    if (ing) {
      var iks = Object.keys(s.inc).sort(function (a, b) { return s.inc[b] - s.inc[a]; }), imax = Math.max.apply(null, iks.map(function (k) { return s.inc[k]; }).concat([s.rin, 1]));
      html += '<div class="pfm-total"><p class="pfm-total__v">' + money(s.ing) + '</p><p class="pfm-total__l">' + T('Te entraron {cuando}', { cuando: P.l }) + ' ' + (P.prev ? cmpHTML(s.ing, P.prev.ing, P.lp, true) : '') + '</p></div>' +
        iks.map(function (k) { return meter('', ING_IC[k] || 'south_west', k, money(s.inc[k]), s.inc[k] / imax, 'in', P.meses ? T('unos {m} al mes', { m: money0(s.inc[k] / P.meses) }) : T('{pct} de lo que entró', { pct: pct(s.inc[k] / (s.ing || 1)) })); }).join('') +
        (s.rin ? meter('game', 'help', T('Por revisar'), money(s.rin), s.rin / imax, 'gris', T('Plata de personas: ¿qué fue? Ordénala')) : '') +
        (!iks.length && !s.rin ? '<p class="pf-note">' + T('No te entró plata {cuando}.', { cuando: P.l }) + '</p>' : '');
    } else {
      var ks = Object.keys(s.grupos).sort(function (a, b) { return (GRUPOS[a].gris ? 1 : 0) - (GRUPOS[b].gris ? 1 : 0) || s.grupos[b] - s.grupos[a]; });
      var max = Math.max.apply(null, ks.map(function (k) { return s.grupos[k]; }).concat([1])), nIt = items().length;
      html += '<div class="pfm-total"><p class="pfm-total__v">' + money(s.gast) + '</p><p class="pfm-total__l">' + T('Gastaste {cuando}', { cuando: P.l }) + ' ' + (P.prev ? cmpHTML(s.gast, P.prev.gast, P.lp) : P.meses ? '<span class="pfm-cmp">' + T('unos {m} al mes', { m: money0(s.gast / P.meses) }) + '</span>' : '') + '</p></div>';
      if (mb) {
        var u = s.gast / mb.general, f = P.cur ? +HOY.slice(8, 10) / diasMes(P.m) : 1, left = mb.general - s.gast;
        html += '<div class="pfm-budget"><div class="pfm-bar"><i class="is-gast' + (u > 1 ? ' is-over' : '') + '" style="width:' + Math.min(100, u * 100).toFixed(1) + '%"></i>' + (P.cur ? '<em style="left:' + (f * 100).toFixed(1) + '%"></em>' : '') + '</div>' +
          '<p class="pfm-budget__t"><span>' + (left >= 0 ? T(P.cur ? 'Te quedan <b>{m}</b> de {p}' : 'Te sobraron <b>{m}</b> de {p}', { m: money0(left), p: money0(mb.general) }) : T('Te pasaste <b>{m}</b> de {p}', { m: money0(-left), p: money0(mb.general) })) + '</span>' +
          '<button class="pf-link pfm-mini" data-pfm="budgets">' + T('Presupuesto') + '</button></p></div>';
      }
      html += ks.map(function (g) {
        var b = mb && mb.cats[g], v = s.grupos[g], gris = GRUPOS[g].gris;
        var sub = gris ? (nIt ? T('No sabemos en qué fue · Clasifícalo') : T('Efectivo y lo que no tiene categoría')) : b ? (v > b ? T('Te pasaste {m} de {p}', { m: money0(v - b), p: money0(b) }) : T('Te quedan {m} de {p}', { m: money0(b - v), p: money0(b) }))
          : P.meses ? T('unos {m} al mes', { m: money0(v / P.meses) }) : T('{pct} de tu gasto', { pct: pct(v / (s.gast || 1)) });
        return meter(gris && nIt ? 'game' : 'grupo:' + g, GRUPOS[g].ic, T(g), money(v), b ? v / b : v / max, gris ? 'gris' : b ? (v > b ? 'over' : v / b > (P.cur ? +HOY.slice(8, 10) / diasMes(P.m) + .1 : .95) ? 'warn' : 'ok') : 'cat', sub);
      }).join('') + (!ks.length ? '<p class="pf-note">' + T('No hay gastos {cuando}.', { cuando: P.l }) + '</p>' : '');
    }
    return html + '<button class="pf-mcard__more" data-pfm="alltx">' + T('Ver los movimientos') + '<span class="material-symbols-rounded">chevron_right</span></button></div></section>';
  }
  function meter(k, ic, name, val, p, tone, sub) {
    return '<' + (k ? 'button data-pfm="' + esc(k) + '"' : 'div') + ' class="pf-meter pf-meter--' + tone + '"><span class="pf-meter__top"><span class="pf-meter__name"><span class="material-symbols-rounded pfm-ic" aria-hidden="true">' + ic + '</span>' + esc(name) + '</span><span class="pf-meter__right">' + val + '</span></span>' +
      '<span class="pf-meter__bar"><i style="width:' + Math.max(2, Math.min(100, p * 100)).toFixed(1) + '%"></i></span><span class="pf-meter__sub">' + sub + '</span></' + (k ? 'button' : 'div') + '>';
  }
  function detDe(g, s) {
    return Object.keys(s.det).filter(function (d) { return grupo(SUB[d] || d) === g; }).sort(function (a, b) { return s.det[b] - s.det[a]; });
  }
  function grupoSheet(g) {
    var P = per(), s = P.o, ds = detDe(g, s);
    var list = s.rows.filter(function (r) { var c = cls(r); return c.cat && grupo(c.cat) === g && c.k !== 'ingreso' && c.k !== 'no'; }).reverse();
    showSheet('<h3>' + esc(T(g)) + '</h3><p>' + T('{monto} {cuando}.', { monto: money(s.grupos[g] || 0), cuando: P.l }) + '</p>' +
      (ds.length > 1 ? '<div class="pfm-cats">' + ds.map(function (d) {
        return '<div class="pfm-inc pfm-det"><span class="material-symbols-rounded">' + (CAT[d] || CAT['Alimentación']) + '</span><span>' + esc(d) + '</span><b>' + money(s.det[d]) + '</b></div>';
      }).join('') + '</div>' : '') + '<p class="as-sheet__label">' + T('Movimientos') + '</p><div class="pf-sheet-list">' + (list.length ? list.map(txHTML).join('') : '<p class="pf-note">' + T('Nada por aquí.') + '</p>') + '</div>');
  }

  // Movimientos: cada uno con su tratamiento
  var PILL = { gasto: 'Gasto', ingreso: 'Ingreso', reembolso: 'Reembolso', rin: 'Por revisar', rout: 'Por revisar', no: 'No suma' };
  function txHTML(r) {
    var c = cls(r), inc = r.m > 0, ic = c.k === 'ingreso' ? (ING_IC[c.cat] || 'south_west') : c.k === 'rin' || c.k === 'rout' ? 'help' : c.cat ? CAT[c.cat] || 'receipt_long' : 'sync_alt';
    return '<button class="pf-tx pfm-tx' + (c.k === 'no' ? ' is-no' : '') + '" data-pfm="tx:' + r.i + '"><span class="pf-tx__ic material-symbols-rounded" aria-hidden="true">' + ic + '</span>' +
      '<span class="pf-tx__main"><b>' + esc(desc(r)) + '</b><small>' + dshort(r.f) + ' · ' + esc(r.src.replace(/ Pichibank/, '')) + '</small>' +
      '<span class="pfm-pill is-' + c.k + '">' + T(PILL[c.k]) + (c.cat && c.k !== 'no' ? ' · ' + esc(grupo(c.cat) === 'Sin clasificar' ? c.cat : T(grupo(c.cat))) : '') + '</span></span>' +
      '<span class="pf-tx__amt' + (inc ? ' is-in' : '') + '">' + (inc ? '+' : '−') + money(Math.abs(r.m)) + '</span></button>';
  }
  function footHTML() {
    return '<section class="pf-sec"><p class="pf-note pf-note--box pfm-scope"><span class="material-symbols-rounded">visibility</span><span>' +
      (tobe() ? T('Uku ve Pichibank, Deuna y las tarjetas de otros bancos que conectaste. El efectivo no lo ve.') : T('Solo vemos lo que pasa por Pichibank y Deuna. El efectivo y las tarjetas de otros bancos no aparecen.')) +
      '</span></p><p class="pf-note">' + T('Datos ficticios de la Base de datos PFM, hasta el {f}.', { f: dshort(HOY) + ' ' + HOY.slice(0, 4) }) + '</p></section>';
  }

  function paint() {
    if (!pf) return;
    if (!DB) { scroll.innerHTML = '<header class="pf-head"><h1>Mis finanzas</h1></header><p class="pf-note" style="padding:0 24px">' + T('Cargando tus movimientos…') + '</p>'; load().then(paint); return; }
    var keep = window.scrollY;
    scroll.innerHTML = '<header class="pf-head"><h1>Mis finanzas</h1></header>' + dineroHTML() + ukuHTML() + gastosHTML() + footHTML();
    window.scrollTo({ top: keep });
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
        '<button class="as-row as-row--btn" data-pfm="modo:mvp" aria-pressed="' + !tobe() + '"><span class="as-row__main"><b>MVP</b><small>' + T('Fase 1: solo Pichibank y Deuna, con reglas y sin IA. Hay más gastos por ordenar.') + '</small></span><span class="as-radio"></span></button>' +
        '<button class="as-row as-row--btn" data-pfm="modo:tobe" aria-pressed="' + tobe() + '"><span class="as-row__main"><b>To-be</b><small>' + T('La visión: Uku ordena casi todo, anticipa, ve tus otros bancos y analiza con IA.') + '</small></span><span class="as-radio"></span></button></div>' +
      '<button class="pf-link pf-link--block" data-pfm="reset">' + T('Borrar mis respuestas y presupuestos') + '</button>');
  }
  function insightsSheet(i) {
    var ins = insights();
    showSheet('<h3>' + T('Lo que notó Uku') + '</h3><p>' + T('Frases cortas sobre tus movimientos de {mes}.', { mes: mesName(curMes()) }) + '</p>' +
      '<div class="pf-uku2__list">' + ins.map(function (x, j) {
        return '<div class="pf-uku2__row' + (j === i ? ' is-on' : '') + '"><span class="pf-uku2__ic material-symbols-rounded" aria-hidden="true">' + x.icon + '</span><div class="pf-uku2__txt"><b>' + esc(x.t) + '</b><p>' + esc(x.s) + '</p>' +
          (x.go ? '<div class="pf-uku2__links"><button data-pfm="' + x.go + '">' + esc(x.gol) + '</button></div>' : '') +
          (tobe() && x.ask ? '<div class="pf-uku2__links"><button class="is-ai" data-pfm="ai:' + esc(x.ask) + '"><span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span>' + esc(x.ask) + '</button></div>' : '') + '</div></div>';
      }).join('') + '</div>');
  }
  function deudasSheet() {
    var d = deudas(), h = DB.hipoteca, row = function (x, extra) {
      return '<div class="pfm-debt"><span class="pfm-debt__main"><b>' + esc(x.producto) + '</b><small>' + esc(x.institucion) + (extra ? ' · ' + extra : '') + '</small></span>' +
        '<span class="pfm-debt__val"><b>' + (x.saldo ? money(Math.abs(x.saldo)) : '—') + '</b>' + (x.cuota_mensual ? '<small>' + T('cuota {monto}', { monto: money(x.cuota_mensual) }) + '</small>' : '') + '</span></div>';
    }, hip = function (x) { return h.usuario === ST.u && /Hipoteca/.test(x.producto) ? T('cuota {a} de {b}', { a: h.pagadas, b: h.cuotas }) : ''; };
    var html = '<h3>' + T('Tus deudas') + '</h3>';
    if (tobe()) {
      html += '<p>' + T('Debes {monto} en total: en Pichibank, otros bancos, cooperativas y casas comerciales.', { monto: money(d.total) }) + '</p><div class="pf-mcard">' + d.bp.map(function (x) { return row(x, hip(x)); }).join('') +
        d.otras.concat(d.casas.filter(function (x) { return x.saldo > 0; })).map(function (x) { return row(x, /mínimo/.test(x.nota) ? T('solo pagas el mínimo') : ''); }).join('') + '</div>' +
        (d.cobrar.length ? '<p class="as-sheet__label">' + T('Te deben') + '</p><div class="pf-mcard">' + d.cobrar.map(function (x) { return row(x, T('por cobrar')); }).join('') + '</div>' : '');
    } else {
      html += '<p>' + (d.totalBP ? T('Debes {monto} en Pichibank.', { monto: money(d.totalBP) }) : T('No tienes deudas en Pichibank.')) + '</p><div class="pf-mcard">' + d.bp.map(function (x) { return row(x, hip(x)); }).join('') + '</div>';
      var casas = d.casas.filter(function (x) { return x.cuota_mensual; });
      if (casas.length) html += '<p class="as-sheet__label">' + T('Cuotas fuera del banco') + '</p><div class="pf-mcard">' + casas.map(function (x) {
        return '<div class="pfm-debt"><span class="pfm-debt__main"><b>' + esc(x.institucion) + '</b><small>' + T('Vemos la cuota, no el saldo') + '</small></span><span class="pfm-debt__val"><b>' + money(x.cuota_mensual) + '</b><small>' + T('al mes') + '</small></span></div>';
      }).join('') + '</div>';
      html += '<p class="pf-note">' + T('Tus tarjetas de otros bancos, cooperativas y préstamos entre personas no aparecen aquí.') + '</p>';
    }
    showSheet(html);
  }
  function billsSheet() {
    var fs = facturas();
    showSheet('<h3>' + T('Por pagar') + '</h3><p>' + T('Lo que pagas cada mes y viene en los próximos 30 días: {monto} en total.', { monto: money(sumv(fs, function (x) { return x.monto; })) }) + '</p>' +
      '<div class="pf-mcard">' + (fs.length ? fs.map(function (x) {
        var dd = Math.round((new Date(x.f + 'T12:00:00') - new Date(HOY + 'T12:00:00')) / 864e5);
        return '<div class="pfm-debt"><span class="material-symbols-rounded pfm-ic">' + x.ic + '</span><span class="pfm-debt__main"><b>' + esc(x.n) + '</b><small>' + dshort(x.f) + ' · ' + (dd <= 1 ? T('mañana') : T('en {n} días', { n: dd })) + '</small></span>' +
          '<span class="pfm-debt__val"><b>' + (x.aprox ? '≈ ' : '') + money(x.monto) + '</b></span></div>';
      }).join('') : '<p class="pf-note">' + T('Nada en los próximos 30 días.') + '</p>') + '</div>' +
      '<p class="pf-note">' + T('Los montos con ≈ cambian cada mes: tomamos el último pago.') + '</p>');
  }
  function scoreSheet() {
    var sc = SCORE[ST.u], p = (sc.v - 1) / 998;
    showSheet('<h3>' + T('Score crediticio') + '</h3><div class="pfm-score"><b>' + sc.v + '</b><span>' + T('de 999 · {n}', { n: T(sc.n) }) + '</span></div>' +
      '<div class="pfm-score__bar"><i style="left:' + (p * 100).toFixed(1) + '%"></i></div><div class="pfm-score__scale"><span>1</span><span>999</span></div>' +
      '<div class="uku-say"><span class="uku-say__face">' + face() + '</span><div class="uku-say__body"><p class="uku-say__bubble">' + esc(sc.s) + '</p></div></div>' +
      '<p class="pf-note">' + T('Dato de ejemplo. Consultar el buró tiene costo y todavía está por decidir.') + '</p>');
  }
  function productsSheet() {
    var ps = productos();
    showSheet('<h3>' + T('Tus productos') + '</h3><p>' + T('Tu saldo disponible suma tus cuentas y Deuna.') + '</p><div class="pf-mcard">' + ps.map(function (x) {
      return '<div class="pfm-debt"><span class="material-symbols-rounded pfm-ic">' + x.ic + '</span><span class="pfm-debt__main"><b>' + esc(x.n) + '</b><small>' + (x.tipo === 'saldo' ? T('Saldo') : T('Debes')) + '</small></span><span class="pfm-debt__val"><b>' + money(x.v) + '</b></span></div>';
    }).join('') + '</div>');
  }
  function txSheet(i) {
    var r = rows()[i], c = cls(r), q = r.t === 'Por revisar' ? preguntas(r.mes).filter(function (x) { return x.k === gkey(r); })[0] : null;
    var cambia = c.k === 'gasto' || c.k === 'reembolso';
    showSheet('<div class="pfm-tx__amt' + (r.m > 0 ? ' is-pos' : '') + '">' + (r.m > 0 ? '+' : '−') + money(Math.abs(r.m)) + '</div><h3>' + esc(desc(r)) + '</h3>' +
      '<p>' + dshort(r.f) + ' ' + r.f.slice(0, 4) + ', ' + r.h + ' · ' + esc(r.src) + '</p>' +
      '<div class="uku-say"><span class="uku-say__face">' + face() + '</span><div class="uku-say__body"><p class="uku-say__bubble">' + esc(porque(r)) + '</p></div></div>' +
      (q ? qHTML(q) : '') +
      (c.ans ? '<button class="pf-link pf-link--block" data-pfm="undo:' + esc(gkey(r)) + '">' + T('Deshacer mi respuesta') + '</button>' : '') +
      (cambia ? '<p class="as-sheet__label">' + T('Cambiar categoría') + '</p><div class="pf-catchips">' + PFM13.map(function (k) {
        return '<button class="pf-catchip" data-pfm="setcat:' + i + ':' + esc(k) + '" aria-pressed="' + (c.cat === k) + '">' + esc(k) + '</button>';
      }).join('') + '</div><p class="pf-note">' + T('El cambio mueve el monto entre categorías del presupuesto. Se puede deshacer.') + '</p>' +
      (catOv(r) ? '<button class="pf-link pf-link--block" data-pfm="uncat:' + i + '">' + T('Volver a la categoría original') + '</button>' : '') : '') +
      '<p class="as-sheet__label">' + T('Lo que dice la base de datos') + '</p><p class="pf-note pfm-dev">' + T('Tratamiento: {t} · Categoría: {c}', { t: r.t, c: r.c }) + (r.e ? ' · ' + T('Escenario: {e}', { e: r.e }) : '') + '<br>' + esc(r.desc) + (r.n ? '<br>' + esc(r.n) : '') + '</p>');
  }
  // Una pregunta de Uku dentro del detalle de un movimiento
  function qHTML(x) {
    return '<div class="pfm-q"><p class="pfm-q__t">' + esc(T(x.tpl.q, { n: corto(x.cp) })) + '</p>' +
      (contexto(x) ? '<p class="pfm-q__ctx">' + esc(contexto(x)) + '</p>' : '') +
      '<div class="uku-say__replies">' + x.tpl.o.map(function (id, i) {
        return '<button class="uku-say__reply' + (i === 0 ? ' is-sug' : '') + '" data-pfm="ans:' + esc(x.k) + ':' + id + '">' + esc(OPT[id].l) + '</button>';
      }).join('') + '</div></div>';
  }
  var txFilter = 'todos';
  function allSheet() {
    var P = per(), list = P.o.rows.slice().reverse();
    var F = { todos: 'Todos', gasto: 'Gastos', ingreso: 'Ingresos', revisar: 'Por revisar', no: 'No suman' };
    var f = list.filter(function (r) { var k = cls(r).k; return txFilter === 'todos' || k === txFilter || (txFilter === 'revisar' && (k === 'rin' || k === 'rout')) || (txFilter === 'gasto' && k === 'reembolso'); });
    showSheet('<h3>' + T('Movimientos') + '</h3><p>' + T('{n} movimientos {cuando}.', { n: list.length, cuando: P.l }) + '</p><div class="pf-catchips">' + Object.keys(F).map(function (k) {
      return '<button class="pf-catchip" data-pfm="txf:' + k + '" aria-pressed="' + (txFilter === k) + '">' + T(F[k]) + '</button>'; }).join('') + '</div>' +
      '<div class="pf-sheet-list">' + (f.length ? f.slice(0, 200).map(txHTML).join('') : '<p class="pf-note">' + T('Nada por aquí.') + '</p>') + '</div>');
  }
  var draft = null;
  function budgetSheet() {
    var p = draft || (draft = JSON.parse(JSON.stringify(pres()))), sg = sugerido(curMes());
    var step = function (id, v, label) {
      return '<div class="pf-step"><span>' + label + '</span><button class="pf-step__btn" data-pfm="bud:' + id + ':-' + (id === 'general' ? 50 : 10) + '" aria-label="' + T('Bajar') + '"><span class="material-symbols-rounded">remove</span></button>' +
        '<b>' + (v ? money0(v) : '—') + '</b><button class="pf-step__btn" data-pfm="bud:' + id + ':' + (id === 'general' ? 50 : 10) + '" aria-label="' + T('Subir') + '"><span class="material-symbols-rounded">add</span></button></div>';
    };
    showSheet('<h3>' + T('Tu presupuesto') + '</h3><p>' + T('Cuánto quieres gastar al mes. Uku te avisa cuando te acerques al límite.') + '</p>' +
      (tobe() && sg ? '<button class="pfm-sug" data-pfm="bud:sug"><span class="material-symbols-rounded">auto_awesome</span><span><b>' + T('Usar el sugerido: {monto}', { monto: money0(sg.general) }) + '</b><small>' + T('Tu promedio de los últimos tres meses, por grupo, con 5% de margen.') + '</small></span></button>' : '') +
      '<div class="pf-steps">' + step('general', p.general, '<b>' + T('Al mes') + '</b>') + '</div>' +
      '<p class="as-sheet__label">' + T('Por grupo') + '</p><div class="pf-steps">' + PRES_G.map(function (k) { return step(k, p.cats[k], esc(T(k))); }).join('') + '</div>' +
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
  function refresh() { cache = {}; fijoCache = {}; paint(); }
  function key(k) {
    var p = k.split(':');
    switch (p[0]) {
      case 'who': return whoSheet();
      case 'modo': if (ST.modo !== p[1]) { ST.modo = p[1]; persist(); fx('toggle'); refresh(); if (sheetOpen()) whoSheet(); } return;
      case 'u': if (ST.u !== p[1]) { ST.u = p[1]; persist(); fx('toggle'); refresh(); } closeSheet(); return;
      case 'reset': ST.resp[ST.u] = {}; ST.cats[ST.u] = {}; if (ST.presG) delete ST.presG[ST.u]; persist(); refresh(); closeSheet(); toast(T('Listo, volviste al inicio.')); return;
      case 'per': ST.per = p[1]; persist(); fx('select'); paint(); return;
      case 'flujo': ST.flujo = p[1]; persist(); fx('select'); paint(); return;
      case 'ing': { ST.flujo = 'in'; ST.per = 'mes'; persist(); closeSheet(); paint(); var fl = scroll.querySelector('.pfm-flow'); if (fl) fl.scrollIntoView({ behavior: 'smooth' }); return; }
      case 'debt': return deudasSheet();
      case 'bills': return billsSheet();
      case 'score': return scoreSheet();
      case 'products': return productsSheet();
      case 'insights': return insightsSheet(-1);
      case 'ins': return insightsSheet(+p[1]);
      case 'game': closeSheet(); return gameOpen();
      case 'ans': {
        var gk = p.slice(1, -1).join(':'), id = p[p.length - 1], n = rows().filter(function (r) { return r.t === 'Por revisar' && gkey(r) === gk; }).length;
        resp()[gk] = id; persist(); fx('success'); refresh(); closeSheet();
        toast(n > 1 ? T('Listo. Lo apliqué a los {n} movimientos con {p}.', { n: n, p: corto(gk.split('|')[0]) }) : T('Listo, gracias.'), 'undo:' + gk);
        return;
      }
      case 'undo': { delete resp()[p.slice(1).join(':')]; persist(); fx('toggle'); refresh(); closeSheet(); return; }
      case 'tx': return txSheet(+p[1]);
      case 'setcat': { var o = ST.cats[ST.u] || (ST.cats[ST.u] = {}), r = rows()[+p[1]], old = cls(r).cat; o[p[1]] = p.slice(2).join(':'); persist(); fx('success'); refresh(); closeSheet();
        return toast(T('Listo: de {a} a {b}.', { a: old, b: o[p[1]] }), 'uncat:' + p[1]); }
      case 'uncat': delete (ST.cats[ST.u] || {})[p[1]]; persist(); refresh(); closeSheet(); return;
      case 'alltx': txFilter = 'todos'; return allSheet();
      case 'txf': txFilter = p[1]; return allSheet();
      case 'grupo': return grupoSheet(p.slice(1).join(':'));
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
      case 'ai': return analyze(p.slice(1).join(':') || undefined);
      case 'go': { var gb = document.querySelector('#home-page [data-action="' + p.slice(1).join(':') + '"]'); if (gb) gb.click(); return; }
    }
  }
  function analyze(q) {
    if (!window.UkuAnalisis) return;
    closeSheet();
    UkuAnalisis.open({ view: curMes(), ask: q });
  }

  /* ---------- Para Uku (análisis con IA y chat) ---------- */
  function pack(m) {
    m = m && /^\d{4}-\d{2}$/.test(m) ? m : curMes();
    var s = month(m), p = pres(), av = prom(m, 3), cur = isCur(m), md = mood(m);
    var over = Object.keys(p.cats).filter(function (k) { return (s.grupos[k] || 0) > p.cats[k]; }).map(function (k) { return { name: k, over: s.grupos[k] - p.cats[k], budget: p.cats[k] }; });
    var ins = anticipa(m).concat(hallazgos(m)).map(function (x) { return { icon: x.icon, kind: x.kind, title: x.t, sub: x.s, ask: x.ask }; });
    var hint = over.length ? T('Ojo con {cat}', { cat: over[0].name.toLowerCase() }) : s.gast > p.general ? T('Te pasaste de tu presupuesto') : T('Vas dentro de tu presupuesto');
    return { key: m, mes: mesName(m), Mes: Mes(m), current: cur, report: false, n: { spend: s.gast, inc: s.ing, save: Math.max(0, r2(s.ing - s.gast)) }, ins: ins, over: over,
      top: Object.keys(s.grupos).sort(function (a, b) { return s.grupos[b] - s.grupos[a]; }).slice(0, 3).map(function (k) { return { name: k, v: s.grupos[k], p: s.grupos[k] / s.gast }; }),
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
      var ks = Object.keys(s.grupos).sort(function (a, b) { return s.grupos[b] - s.grupos[a]; }).slice(0, 3);
      return { t: T('En {mes} gastaste {monto} de tu presupuesto de {p}.', { mes: mesName(m), monto: money(s.gast), p: money0(pres().general) }) + '<br><br>' +
        T('Lo que más pesó: {l}.', { l: ks.map(function (k) { return k.toLowerCase() + ' (' + money(s.grupos[k]) + ')'; }).join(', ') }), s: ['¿Cómo cierro el mes?', '¿Qué tengo por revisar?'] };
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
