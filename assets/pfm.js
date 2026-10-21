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
  var ST = { u: 'andres', modo: 'mvp', per: 'mes', resp: {}, cats: {}, pres: {} };
  try { var sv = JSON.parse(localStorage.getItem(KEY)); if (sv) ST = Object.assign(ST, sv); } catch (e) {}
  if (window.Persona) ST.u = Persona.get(); // la persona se elige en Perfil, para toda la app
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
  function norm(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function r2(v) { return Math.round(v * 100) / 100; }
  var ASSET = (document.currentScript && document.currentScript.src || location.href).replace(/[^/]*$/, '');
  function tobe() { return ST.modo === 'tobe'; }

  /* ---------- Fechas ---------- */
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIA = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
  var DIA1 = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
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
      DB = { mov: U, usuarios: d.usuarios, deudas: d.deudas, escenarios: d.escenarios, hipoteca: d.hipoteca, cuentas: d.cuentas || {} };
      if (!DB.mov[ST.u]) ST.u = 'andres';
      Object.keys(U).forEach(sembrar);
      cache = {}; fijoCache = {};
      return DB;
    });
    return loading;
  }
  /* Historial de la demo: cada persona clasificó hasta cierta fecha, así se ven
     los ánimos de Uku. Jorge está al día (contento), Rosa tiene solo lo de
     esta semana (tranquilo), Andrés dejó pasar 10 días y Daniela no clasifica
     hace un mes (pensativo). Se aplica una vez por persona. */
  var AL_DIA = { jorge: '2026-10-16', rosa: '2026-10-12', andres: '2026-10-05', daniela: '2026-09-01', luis: '2026-09-28' };
  function sembrar(u) {
    var seed = ST.seed || (ST.seed = {}); if (seed[u] || !AL_DIA[u]) return;
    var prev = ST.u; ST.u = u;
    rows().forEach(function (r) {
      if (r.f >= AL_DIA[u]) return;
      if (r.t === 'Por revisar') { if (!resp()[gkey(r)]) resp()[gkey(r)] = tplOf(r).o[0]; return; }
      var c = cls(r, true); if (c.k === 'gasto' && (SIN[c.cat] || c.cat === 'Efectivo retirado')) (ST.cats[u] || (ST.cats[u] = {}))[r.i] = r.c === 'Transferencia a persona' ? 'Familia y dependientes' : mapc(r.c);
    });
    ST.u = prev; seed[u] = 1; persist();
  }
  function user() { return DB.usuarios.filter(function (x) { return x.usuario === ST.u; })[0]; }
  function nombre() { return user().nombre.split(' ')[0]; }
  function rows() { return DB.mov[ST.u]; }
  function meses() { // del más reciente al más antiguo
    var s = {}; rows().forEach(function (r) { s[r.mes] = 1; });
    return Object.keys(s).sort().reverse();
  }
  function curMes() { return meses()[0] || HOY.slice(0, 7); } // el mes en curso (ya no hay pestañas de meses); sin movimientos, el mes de hoy

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
    'Aporte de pareja+':           { q: '¿Qué es el dinero que te envía {n} cada mes?', o: ['hogar', 'prestRec', 'reemb'] },
    'Préstamo a amigo+':           { q: '¿{n} te está devolviendo un préstamo?', o: ['cobro', 'ingreso', 'reemb'] },
    'Préstamo a familiar+':        { q: '¿{n} te está devolviendo un préstamo?', o: ['cobro', 'ingreso', 'reemb'] },
    'Préstamo a amigo-':           { q: '¿Qué fue lo que le enviaste a {n}?', o: ['preste', 'familia', 'gasto'] },
    'Préstamo a familiar-':        { q: '¿Qué fue lo que le enviaste a {n}?', o: ['preste', 'familia', 'gasto'] },
    'Préstamo a vecina-':          { q: '¿Qué fue lo que le enviaste a {n}?', o: ['preste', 'familia', 'gasto'] },
    'Préstamo de familiar+':       { q: '¿{n} te prestó dinero?', o: ['prestRec', 'ingreso', 'reemb'] },
    'Préstamo de familiar-':       { q: '¿Qué le pagas a {n}?', o: ['pagoDeuda', 'familia', 'gasto'] },
    'Apoyo a padres-':             { q: '¿Qué le enviaste a {n}?', o: ['familia', 'preste', 'gasto'] },
    'Cuenta dividida+':            { q: '¿{n} te devolvió parte de una cuenta?', o: ['reemb', 'ingreso', 'prestRec'] },
    'Ingresos freelance+':         { q: '¿Qué te pagó {n}?', o: ['trabajo', 'reemb', 'prestRec'] },
    'Negocio y personal mezclados-': { q: '¿Lo que le pagas a {n} es para tu negocio o para la casa?', o: ['tienda', 'casa', 'gasto'] },
    '+': { q: '¿Qué es el dinero que recibiste de {n}?', o: ['ingreso', 'reemb', 'prestRec'] },
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
  // Reglas que el cliente aceptó: "todo lo de esta tienda es Comida"
  function ruleOf(r) { var R = ST.rules && ST.rules[ST.u]; return R && r.m < 0 && r.cp && !/^tú|^Pichibank$/.test(r.cp) ? R[r.cp] : null; }
  // Un pago con Deuna se muestra con a quién fue (el comercio o la persona)
  function desc(r) { return r.t === 'Detalle Deuna' && r.m < 0 && r.cp ? r.cp : r.desc; }
  function isRecarga(r) { return r.t === 'Gasto' && /^tú \(Deuna\)/.test(r.cp); }
  function cls(r, raw) {
    var a = raw ? null : answerOf(r), ov = raw ? null : catOv(r) || ruleOf(r);
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
          cmp: [{ l: cur ? T('Este mes') : Mes(m), v: s.gast, on: 1 }, { l: Mes(prev) + (cur ? ' ' + T('al día {d}', { d: dd }) : ''), v: p.gast }],
          t: T(d > 0 ? 'Gastaste {pct} más que en {mes}' : 'Gastaste {pct} menos que en {mes}', { pct: pct(Math.abs(d) / p.gast), mes: mesName(prev) }) + (cur ? ' ' + T('a esta altura') : ''),
          s: ch && Math.abs(ch.d) >= 10 ? T(ch.d > 0 ? 'Lo que más subió fue {cat}: {monto} más.' : 'Lo que más bajó fue {cat}: {monto} menos.', { cat: ch.k.toLowerCase(), monto: money(Math.abs(ch.d)) }) : T('Comparo hasta el mismo día del mes.'), ask: '¿En qué gasto más?' });
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
      if (up && !cur) out.push({ icon: GRUPOS[up.k].ic, kind: 'warn', g: up.k, cmp: [{ l: Mes(m), v: s.grupos[up.k], on: 1 }, { l: T('Tu promedio'), v: av.grupos[up.k] }], t: T('Tus gastos de {cat} aumentaron {pct}', { cat: up.k.toLowerCase(), pct: pct(up.r) }),
        s: T('Fueron {monto}; tu promedio de los últimos tres meses es {prom}.', { monto: money(s.grupos[up.k]), prom: money(av.grupos[up.k]) }), ask: '¿En qué gasto más?' });
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
  // Predicción de cierre del mes en curso (como Revolut): lo gastado + los cobros fijos que faltan
  // + el gasto variable al ritmo de lo que va del mes.
  function proyeccion(m) {
    var s = month(m), d = +HOY.slice(8, 10), n = diasMes(m), rec = recurrentes(m);
    var fijo = rec.filter(function (x) { return x.dia > d; }).reduce(function (a, x) { return a + x.monto; }, 0);
    var varHoy = s.gast - rec.filter(function (x) { return x.dia <= d; }).reduce(function (a, x) { return a + Math.min(x.monto, s.cats[x.cat] || 0); }, 0);
    return r2(s.gast + fijo + Math.max(0, varHoy) / d * (n - d));
  }
  function anticipa(m) {
    var out = [], s = month(m), p = pres();
    if (isCur(m)) {
      var d = +HOY.slice(8, 10), n = diasMes(m), rec = recurrentes(m), falta = rec.filter(function (x) { return x.dia > d; });
      var proj = proyeccion(m);
      out.push({ icon: 'speed', kind: proj > p.general ? 'warn' : 'good', t: T('A este ritmo cierras {mes} en {monto}', { mes: mesName(m), monto: money0(proj) }),
        s: proj > p.general ? T('Podrías excederte en {monto} de tu presupuesto. Cuenta los cobros fijos que todavía no llegan.', { monto: money0(proj - p.general) }) : T('Te sobrarían {monto} de tu presupuesto, contando los cobros fijos que faltan.', { monto: money0(p.general - proj) }), ask: '¿Cómo cierro el mes?' });
      var sem = falta.filter(function (x) { return x.dia <= d + 10; });
      if (sem.length) out.push({ icon: 'event_upcoming', kind: 'info', t: T('En los próximos días vencen pagos por {monto}', { monto: money(sem.reduce(function (a, x) { return a + x.monto; }, 0)) }),
        s: sem.slice(0, 3).map(function (x) { return (x.cp.length > 22 ? corto(x.cp) : x.cp) + ' (' + x.dia + ' ' + MES[+m.slice(5, 7) - 1].slice(0, 3) + ')'; }).join(', ') + '.' });
    }
    var ps = sugerido(m);
    if (ps && p.auto !== true && Math.abs(ps.general - p.general) / p.general > .1) out.push({ icon: 'tune', kind: 'info', t: T('Te sugiero un presupuesto de {monto}', { monto: money0(ps.general) }), s: T('Es tu promedio de los últimos tres meses, con un margen de 5%.'), act: 'budgets' });
    var deb = DB.deudas.filter(function (x) { return x.usuario === ST.u && /mínimo/.test(x.nota); })[0];
    if (deb) out.push({ icon: 'credit_card', kind: 'warn', t: T('Tu {t} sigue creciendo', { t: deb.producto.replace(/ ···\d+/, '') + (deb.producto.indexOf(deb.institucion) < 0 ? ' ' + deb.institucion : '') }), s: T('Debes {monto} y solo pagas el mínimo. Si destinas lo que te sobra cada quincena, la cierras antes.', { monto: money(deb.saldo) }) });
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
    if (c.k === 'rin' || c.k === 'rout') return T('No sé qué fue: es de una persona o empresa. Lo cuento marcado hasta que me digas.');
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

  /* ---------- Lo que tienes, para el claro de Uku (bosque3d.setFinanzas) ----------
     nuevo: sin movimientos ni productos además de la cuenta (su claro se llena de brotes); ahorro: cuentas de
     ahorro y metas (flores); inversion: depósitos a plazo (guayacanes en flor); deudas: los créditos con saldo
     (cada uno pone en el claro lo que tienes gracias a él: casa, tiendita, carretilla…). */
  function finanzas() {
    var C = DB.cuentas[ST.u] || [], suma = function (tipos) { return r2(C.filter(function (c) { return tipos.indexOf(c.tipo) >= 0; }).reduce(function (a, c) { return a + (+c.saldo || 0); }, 0)); };
    var ahorro = suma(['ahorro', 'meta']), inversion = suma(['inversion']);
    var deu = DB.deudas.filter(function (x) { return x.usuario === ST.u && x.saldo > 0; }).map(function (x) { return { clase: x.clase, producto: x.producto, institucion: x.institucion, saldo: x.saldo }; });
    return { nuevo: !(DB.mov[ST.u] || []).length && !ahorro && !inversion && !deu.length, ahorro: ahorro, inversion: inversion, deudas: deu };
  }

  /* ---------- El mundo de Uku (como Duo) ----------
     Tres señales, cada una con un solo significado:
     · Su ánimo = tus consumos clasificados. Al día: contento. Algo nuevo:
       tranquilo. Pendiente hace más de una semana: pensativo. Uku es un
       personaje del banco: no se enoja ni se pone triste, te espera. Una
       semana sin gastos no cuenta en contra: no hay nada que clasificar.
     · Las flores amarillas de sus canteros = tu ahorro (cuántos meses te alcanza).
     · El bosque = tu presupuesto del mes. */
  var MOOD = { feliz: 'contento', tranquilo: 'tranquilo', pensativo: 'pensativo' };
  var MOOD_IC = { feliz: 'sentiment_very_satisfied', tranquilo: 'sentiment_satisfied', pensativo: 'sentiment_neutral' };
  function animo() {
    var it = items(); if (!it.length) return { k: 'feliz', n: 0, dias: 0 };
    var old = it.reduce(function (a, x) { return x.f < a ? x.f : a; }, HOY);
    var dias = Math.round((new Date(HOY + 'T12:00:00') - new Date(old + 'T12:00:00')) / 864e5);
    return { k: dias > 7 ? 'pensativo' : 'tranquilo', n: it.length, dias: dias };
  }
  function mood() { return animo().k; }
  // Ahorro: cuántos meses de gasto cubre lo que tienes en tus cuentas
  // Tu historia, mes a mes (el más reciente primero): ok = cerraste el mes con saldo a favor. Es lo que el bosque de Uku dibuja.
  function historia() {
    return meses().slice(0, 12).map(function (m) { var x = month(m); return { m: m, ok: x.ing > 0 ? x.gast <= x.ing * .98 : true }; });
  }
  function colchon() { var p = prom(curMes(), 3), s = sumv(saldos(), function (x) { return x.v; }); return p && p.gast ? s / p.gast : 0; }
  // Menos de 1 mes: sin flores; de 1 a 3 meses, el campo se va llenando
  function flores() { var c = colchon(), f = c < 1 ? 0 : Math.round(Math.min(1, .3 + (c - 1) / 2 * .7) * 100); return hecho('ahorro') ? Math.max(f, 22) : f; } // con ahorro programado, salen las primeras flores
  // Presupuesto: cómo vas contra tu ritmo del mes
  function presEstado(m) {
    m = m || curMes(); var s = month(m), p = pres().general, f = isCur(m) ? +HOY.slice(8, 10) / diasMes(m) : 1, u = s.gast / (p * f);
    return u <= 1 ? { k: 'ok', l: T('Vas bien'), v: 85 } : u <= 1.15 ? { k: 'warn', l: T('Con cuidado'), v: 55 } : { k: 'over', l: T('Por encima del plan'), v: 25 };
  }
  function salud(m) { return presEstado(m).v; }

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
    jorge: { v: 836, n: 'Excelente', s: 'Pagas el total de tus tarjetas cada mes y tu hipoteca del BIESS va al día.' },
    luis: { v: 612, n: 'Regular', s: 'Pagas tu Visa cada quincena, pero varias veces solo el mínimo. Pagar el total, aunque sea de a poco, lo sube.' }
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
  // Patrimonio en Pichibank: lo que tienes menos todo lo que debes al banco
  function patrimonio() { var t = sumv(saldos(), function (x) { return x.v; }), d = deudas().totalBP; return { tienes: t, debes: d, v: r2(t - d) }; }
  // Cada cifra en su tarjeta, y cada tarjeta lleva a su detalle
  function tile(k, l, v, s, neg) {
    return '<button class="pfm-tile" data-pfm="' + k + '"><span class="pfm-tile__l">' + l + '</span>' +
      '<b' + (neg ? ' class="is-neg"' : '') + '>' + v + '</b><small>' + s + '</small></button>';
  }
  function dineroHTML() {
    var pt = patrimonio(), d = deudas(), fs = facturas(), sc = SCORE[ST.u], np = productos().length;
    return '<section class="pf-sec pfm-money" aria-label="' + T('Tu dinero en Pichibank') + '">' +
      '<div class="pfm-saldo"><span class="pfm-tile__l">' + T('Saldo disponible') + '</span>' +
        '<b>' + money(pt.tienes) + '</b><small>' + T('En tus cuentas Pichibank y Deuna') + '</small>' +
        // El patrimonio va como dato pequeño: en negativo (por una hipoteca, por ejemplo) no debe asustar
        // Sin deudas en Pichibank el patrimonio es igual al saldo: no se repite
        (pt.debes ? '<button class="pfm-net" data-pfm="net">' + T('Patrimonio en Pichibank') + ' <b>' + money0(pt.v) + '</b><span class="material-symbols-rounded" aria-hidden="true">info</span></button>' : '') + '</div>' +
      '<div class="pfm-tiles">' +
        tile('products', T('Tus productos'), String(np), T('Cuentas, tarjetas y créditos')) +
        tile('bills', T('Por pagar'), money0(sumv(fs, function (x) { return x.monto; })), fs.length === 1 ? T('1 pago en 30 días') : T('{n} pagos en 30 días', { n: fs.length })) +
        tile('debt', T('Deudas'), money0(tobe() ? d.total : d.totalBP), tobe() ? T('En todos tus bancos') : T('Préstamos y tarjetas')) +
        (sc ? tile('score', T('Tu score'), String(sc.v), T(sc.n)) : '') +
      '</div></section>';
  }
  function netSheet() {
    var pt = patrimonio(), d = deudas();
    var row = function (l, v, s) { return '<div class="pfm-debt"><span class="pfm-debt__main"><b>' + l + '</b><small>' + s + '</small></span><span class="pfm-debt__val"><b>' + v + '</b></span></div>'; };
    showSheet('<h3>' + T('Tu patrimonio en Pichibank') + '</h3><div class="pfm-tx__amt">' + money(pt.v) + '</div>' +
      '<p>' + T('Es lo que tienes menos todo lo que debes al banco, también lo que aún no toca pagar. No es lo mismo que lo que tienes por pagar este mes.') + '</p>' +
      '<div class="pf-mcard">' + row(T('Lo que tienes'), money(pt.tienes), T('Cuentas y Deuna')) +
        row(T('Lo que debes'), '−' + money(pt.debes), d.bp.length ? d.bp.map(function (x) { return x.producto; }).join(', ') : T('Sin deudas en Pichibank')) + '</div>' +
      '<p class="pf-note">' + T('Por pagar son solo las facturas y cuotas de los próximos 30 días.') + '</p>');
  }

  /* ---------- 2. Uku: lo que notó y ordenar gastos ---------- */
  // La única lista de lo que Uku nota o propone: la usan el globo, las tarjetas,
  // la hoja "Lo que notó Uku" y el análisis con IA. Los consumos por ordenar son
  // un hallazgo más, con su acción, y van primero porque son lo que sigue.
  function feed(m) {
    var a = animo(), out = [];
    if (isCur(m) && a.n) out.push(porOrdenar(a));
    return out.concat(tobe() ? anticipa(m).map(accion) : [], agrupar(), hallazgos(m).map(accion));
  }
  function porOrdenar(a) {
    return { icon: 'category', kind: 'consumo', tag: T('Por ordenar'), go: 'game', gol: T('Clasificar {n}', { n: Math.min(TANDA, a.n) }),
      t: T(a.n === 1 ? 'Tienes 1 consumo sin clasificar' : 'Tienes {n} consumos sin clasificar', { n: a.n }),
      s: T('Uku ya ordenó casi todo; solo pregunta lo que no puede saber.') };
  }
  function insights() { return feed(curMes()); }
  // Agrupaciones que Uku propone: mesadas para programar y pagos repetidos para ordenar de una
  function agrupar() {
    var out = mesadas().filter(function (x) { var st = mesOf(x.cp); return !st || (st.v === 'mesada' && !st.prog); }).map(function (x) {
      var st = mesOf(x.cp);
      return { icon: 'event_repeat', kind: 'info', tag: T('Mesada'), go: 'mesada:' + x.cp, gol: st ? T('Programarla') : T('Revisar'),
        t: st ? T('Tu mesada a {n}: ¿la programamos?', { n: corto(x.cp) }) : T('Cada mes le envías unos {m} a {n}', { m: money0(x.monto), n: corto(x.cp) }),
        s: st ? T('Se enviaría sola cada día {d} y Uku te avisa un día antes si no te alcanza.', { d: x.dia }) : T('¿Es una mesada? Si lo es, la clasifico toda de una vez y te ayudo a programarla.'),
        cmp: x.porMes.slice(-3).map(function (c, i) { return { l: c.l, v: c.v, on: i === 2 }; }) };
    });
    repetidos().slice(0, 1).forEach(function (x) {
      out.push({ icon: 'category', kind: 'info', tag: T('Para ordenar'), go: 'regla:' + x.cp, gol: T('Ordenarlos de una'),
        t: T('Tienes {n} pagos a {c} sin clasificar', { n: x.list.length, c: x.cp }), s: T('Suman {m}. Con un toque los ordeno todos y recuerdo la regla para los próximos.', { m: money(x.total) }) });
    });
    return out;
  }
  // Los hallazgos llevan a hacer algo; los que solo informan no llevan botón
  function accion(x) {
    var A = { credit_card: ['debt', 'Ver tus deudas'], flight_land: ['ing', 'Ver tus ingresos'], speed: ['budgets', 'Ver tu presupuesto'],
      event_upcoming: ['bills', 'Ver por pagar'], tune: ['bud:sug', 'Usar el sugerido'], local_atm: ['grupo:Sin clasificar', 'Ver tus retiros'] }[x.icon];
    if (x.g) A = ['grupo:' + x.g, T('Ver {g}', { g: T(x.g).toLowerCase() })];
    if (A) { x.go = A[0]; x.gol = T(A[1]); }
    return x;
  }
  function ukuMsg(a) {
    if (a.k === 'feliz') return T('¡Todo clasificado! Así da gusto ayudarte.');
    if (a.k === 'tranquilo') return T(a.n === 1 ? 'Tengo 1 consumo nuevo para ti. ¿Lo vemos?' : 'Tengo {n} consumos nuevos para ti. ¿Los vemos?', { n: a.n });
    return T(a.n === 1 ? 'Tienes 1 consumo sin clasificar, de hace {d} días. ¿Lo ordenamos?' : 'Tienes {n} consumos sin clasificar, algunos de hace {d} días. ¿Los ordenamos?', { n: a.n, d: a.dias });
  }
  /* ---------- Uku, tu asesor ----------
     Una sola lista de lo que Uku descubre y te propone, ordenada por lo que
     más importa ahora. Cada consejo dice qué notó, por qué importa y trae su
     acción: programar un pago, ponerte un presupuesto, separar ahorro, pagar
     el total de la tarjeta, ordenar consumos, una mesada... Lo primero lo
     dice Uku en su globo; lo demás va en tarjetas, en la misma sección.
     Lo que ya hiciste queda como "Listo" (con deshacer) y lo que dejas para
     después se esconde hasta que lo pidas. */
  function hecho(id) { var H = ST.hecho && ST.hecho[ST.u]; return H && H[id]; }
  function setHecho(id, v) { var H = ST.hecho || (ST.hecho = {}); H[ST.u] = H[ST.u] || {}; if (v) H[ST.u][id] = v; else delete H[ST.u][id]; persist(); }
  function oculto(id) { var O = ST.oculto && ST.oculto[ST.u]; return O && O[id]; }
  function diasA(f) { return Math.round((new Date(f + 'T12:00:00') - new Date(HOY + 'T12:00:00')) / 864e5); }
  function cuandoTxt(f) { var d = diasA(f); return d <= 0 ? T('Hoy') : d === 1 ? T('Mañana') : d < 7 ? T('El {d}', { d: DIA1[wday(f)] }) : T('El {f}', { f: dshort(f) }); }
  function ingresoMes() { var ms = antes(curMes(), 3); return ms.length ? sumv(ms, function (m) { return month(m).ing; }) / ms.length : month(curMes()).ing; }
  // Lo que conviene separar cada mes: 5% de lo que entra, redondeado a $5
  function ahorroSug() { return Math.max(5, Math.round(ingresoMes() * .05 / 5) * 5); }
  function minimoTarjeta() { return rows().filter(function (r) { return /mínimo/i.test(r.n) && r.c === 'Pago de tarjeta' && r.prod === 'Cuenta' && r.f >= addDays(HOY, -62); }).pop(); }
  /* ---------- Quién eres para Uku ----------
     El tono de sus mensajes depende de tu perfil: no le dice lo mismo a quien recién abre su cuenta, a quien
     vive al día, a una familia con créditos o a quien tiene un negocio. Siempre en positivo y proponiendo algo. */
  var PERFILES = { andres: 'hogar', rosa: 'negocio', daniela: 'joven', jorge: 'jubilado', luis: 'aldia', camila: 'nuevo' };
  function perfil() { return finanzas().nuevo ? 'nuevo' : PERFILES[ST.u] || 'general'; }
  function por(map, def, v) { var k = perfil(); return T(map[k] != null ? map[k] : def, v); }
  function hayPres() { return !!(ST.presG && ST.presG[ST.u]); }
  function cons1(n) { return n === 1 ? T('1 consumo') : T('{n} consumos', { n: n }); }
  function consejos() {
    var a = animo(), out = [], saldo = sumv(saldos(), function (x) { return x.v; }), pr = pres(), pe = presEstado(), pf = perfil(), F = finanzas(), col = colchon(), q = ahorroSug();
    var tieneHistoria = meses().length > 0;
    // 0. Recién empiezas: lo primero es que entre y salga dinero por tu cuenta
    if (pf === 'nuevo') {
      out.push({ id: 'nuevo:recibir', p: 95, icon: 'call_received', tag: T('Para empezar'), kind: 'info', t: T('Recibe tu primer dinero'),
        sub: T('Comparte tu número de cuenta'), s: T('Comparte tu número de cuenta y recibe tu primer pago; así empieza a crecer tu mundo.'),
        di: T('¡Qué bueno tenerte aquí! Empecemos por lo primero: recibir tu primer dinero. Te muestro cómo compartir tu cuenta.'), act: 'app:Recibir dinero', actl: T('Recibir dinero') });
      out.push({ id: 'nuevo:qr', p: 90, icon: 'qr_code_scanner', tag: T('Para empezar'), kind: 'info', t: T('Paga con QR'),
        sub: T('Rápido y sin efectivo'), s: T('Con el QR pagas desde el celular y cada pago queda ordenado en tu mundo.'),
        di: T('Cuando quieras pagar, hazlo con QR desde tu celular: es rápido y cada pago queda ordenado aquí.'), act: 'app:Pagar con QR', actl: T('Pagar con QR') });
    }
    // 1. Pagos de la próxima semana: programarlos
    facturas().filter(function (x) { return diasA(x.f) <= 7; }).slice(0, 2).forEach(function (x) {
      var falta = saldo < x.monto, d = diasA(x.f), cuando = cuandoTxt(x.f);
      out.push({ id: 'pago:' + x.n, p: d <= 3 ? 100 : 80, icon: 'event', tag: T('Pago cercano'), kind: falta ? 'warn' : 'info', sub: x.n + ' · ' + cuando.toLowerCase(),
        t: T('{c} vence el pago de {n}: {m}', { c: cuando, m: money0(x.monto), n: x.n }),
        s: falta ? T('Hoy tienes {s}: te faltan {f}. Si lo programas, te aviso un día antes para que llegues.', { s: money0(saldo), f: money0(x.monto - saldo) }) : T('Te alcanza con lo que tienes. Si lo programas, no tienes que estar pendiente de la fecha.'),
        di: T('{c} vence el pago de {n}: {m}.', { c: cuando, m: money0(x.monto), n: x.n }) + ' ' + (falta ? T('Te faltan {f}; si lo programamos, te aviso un día antes para que llegues con calma.', { f: money0(x.monto - saldo) }) : T('Te alcanza. ¿Lo programamos para que no tengas que acordarte?')),
        act: 'pagar:' + x.n, actl: T('Programar el pago'), ok: T('Programado: se paga solo el {f}.', { f: dshort(x.f) }), conf: { para: x.n, monto: x.monto, cuando: dshort(x.f) } });
    });
    // 2. Consumos por clasificar: pedirlo con calma; con eso todo lo demás se ve mejor
    if (a.n) out.push({ id: 'ordenar', p: a.k === 'pensativo' ? 92 : 90, icon: 'category', tag: T('Por ordenar'), kind: 'info', sub: por({ negocio: 'Separa la tienda de la casa', joven: 'Así ves tu gasto real' }, 'Así tus gastos quedan claros'),
      t: T(a.n === 1 ? 'Tienes 1 consumo sin clasificar' : 'Tienes {n} consumos sin clasificar', { n: a.n }),
      s: T('Así tu presupuesto y mis consejos reflejan mejor tus gastos. Toma menos de un minuto.'),
      di: a.k === 'pensativo' ? T('Hay {c} esperando desde hace {d} días. Ordenémoslos juntos: toma un minuto y todo se ve más claro.', { c: cons1(a.n), d: a.dias })
        : por({ negocio: 'Tengo {c} por clasificar. Con un minuto separamos lo de la tienda de lo de la casa.', joven: 'Tengo {c} por clasificar. Ordenémoslos y veo tu gasto real, sin lo que te devuelven tus amigas.' }, 'Tengo {c} sin clasificar. Si los ordenamos ahora, tus gastos quedan claros en un minuto.', { c: cons1(a.n) }),
      act: 'game', actl: a.n > TANDA ? T('Clasificar {n} de {t}', { n: TANDA, t: a.n }) : T(a.n === 1 ? 'Clasificar 1 consumo' : 'Clasificar {n} consumos', { n: a.n }) });
    // 3. Tarjeta: pagaste solo el mínimo
    var min = minimoTarjeta();
    if (min) out.push({ id: 'tarjeta', p: 75, icon: 'credit_card', tag: T('Tarjeta'), kind: 'warn', t: T('Pagaste solo el mínimo de tu tarjeta'), sub: T('Evita pagar intereses'),
      s: T('Así la deuda crece con intereses. Si programas el pago total cada mes, dejas de pagarlos.'),
      di: T('Pagaste solo el mínimo de tu tarjeta. Si programamos el pago total cada mes, dejas de pagar intereses y tu dinero rinde más.'),
      act: 'tarjeta', actl: T('Programar el pago total'), ok: T('Listo: tu tarjeta se paga completa cada mes, el día que cobras.'), conf: { para: T('Tu tarjeta Pichibank'), monto: null, cuando: T('Cada mes, el día que cobras') } });
    // 4. Presupuesto: sin uno, recomendarlo (con lo que Uku ve de ti); con uno, revisarlo si te pasas
    if ((!hayPres() && tieneHistoria) || hecho('pres')) out.push({ id: 'pres', p: 85, icon: 'speed', tag: T('Presupuesto'), kind: 'info', t: T('Todavía no tienes un presupuesto'), sub: T('Ve en qué se va tu dinero'),
      s: T('Recibes unos {i} al mes. Te propongo cuánto gastar y cómo repartirlo; tú decides.', { i: money0(Math.round(ingresoMes())) }),
      di: col < 1 ? por({ aldia: 'Tu cuenta llega casi a cero cada mes. Te ayudo a armar un presupuesto para ver en qué se va tu dinero y empezar a ahorrar, aunque sea poquito.',
          joven: 'Tu cuenta llega casi a cero cada mes, y es un buen punto de partida. Armemos un presupuesto para ver en qué se va tu dinero y apartar algo para ti.',
          jubilado: 'Tu dinero rinde justo cada mes. Armemos un presupuesto para ver en qué se va y cuánto puedes apartar para imprevistos.',
          negocio: 'Entra y sale mucho dinero por tu cuenta. Armemos un presupuesto que separe la tienda de la casa y veas cuánto te queda cada mes.' },
          'Tu cuenta llega casi a cero cada mes. Armemos un presupuesto para ver en qué se va tu dinero y empezar a ahorrar.')
        : por({ hogar: 'Armemos un presupuesto para ver cuánto te queda cada mes después de la hipoteca y las tarjetas. Lo hacemos juntos en tres pasos.',
          negocio: 'Armemos un presupuesto que separe la tienda de la casa: así sabes cuánto te queda cada mes sin depender de la remesa.',
          jubilado: 'Armemos un presupuesto con tus dos pensiones para ver en qué se va el dinero de la casa y cuánto puedes apartar.',
          joven: 'Armemos un presupuesto para ver tu gasto real y apartar algo para ti. Lo hacemos juntos en tres pasos.' },
          'Todavía no tienes presupuesto. Armémoslo juntos: con lo que recibes y lo que gastas, son solo tres pasos.'),
      act: 'pres', actl: T('Armar mi presupuesto'), ok: T('Listo: tu presupuesto es {m} al mes.', { m: money0(pr.general) }) });
    else if (hayPres() && pe.k === 'over') out.push({ id: 'pres:over', p: 72, icon: 'speed', tag: T('Presupuesto'), kind: 'warn', t: T('Vas por encima de tu presupuesto'), sub: T('Revisemos en qué grupo se fue'),
      s: T('Llevas {g} de {p} este mes. Revisa en qué grupo se fue o ajusta el plan.', { g: money0(month(curMes()).gast), p: money0(pr.general) }),
      di: T('Este mes vas un poco por encima de tu presupuesto. Revisemos juntos en qué grupo se fue y lo ajustamos.'), act: 'budgets', actl: T('Revisar presupuesto') });
    // 5. Ahorro (con presupuesto): tu cuenta llega casi en cero; separar algo apenas cobras
    if ((hayPres() && col < 1) || hecho('ahorro')) out.push({ id: 'ahorro', p: 60, icon: 'savings', tag: T('Ahorro'), kind: 'info', t: T('Tu cuenta llega casi a cero cada mes'), sub: T('Para tu primer colchón'),
      s: T('Si separas {q} cada mes, apenas cobras, en 6 meses tienes {t} para un imprevisto. Y sus canteros empiezan a florecer.', { q: money0(q), t: money0(q * 6) }),
      di: por({ jubilado: 'Si separas {q} cada mes apenas cobras tu pensión, en 6 meses tendrás {t} para un imprevisto. ¡Y mis canteros empezarán a florecer!' }, 'Tu cuenta llega casi a cero cada mes. Si separas {q} apenas cobras, en 6 meses tendrás {t} para un imprevisto. ¡Y mis canteros empezarán a florecer!', { q: money0(q), t: money0(q * 6) }),
      act: 'ahorro', actl: T('Separar {q} al mes', { q: money0(q) }), ok: T('Listo: cada mes se separan {q} a tu ahorro, apenas cobras.', { q: money0(q) }),
      conf: { para: T('Tu cuenta de ahorro'), monto: q, cuando: T('Cada mes, apenas cobras') } });
    // 6. Mesadas y pagos repetidos
    agrupar().forEach(function (x) { out.push({ id: 'g:' + x.go, p: 50, icon: x.icon, tag: x.tag, kind: 'info', sub: x.s, t: x.t, s: x.s, cmp: x.cmp, di: x.t + '. ' + T('¿Lo hacemos juntos?'), act: x.go, actl: x.gol }); });
    // 7. Lo que descubrió: anticipa (to-be) y hallazgos; siempre en positivo y con una pregunta, nunca una alarma
    (tobe() ? anticipa(curMes()).map(accion) : []).concat(hallazgos(curMes()).map(accion)).forEach(function (x) {
      if (x.icon === 'tune' || x.icon === 'credit_card' && min) return; // ya están como consejo con acción
      if (!hayPres() && (x.icon === 'speed' || x.icon === 'tune')) return; // sin presupuesto no hay con qué comparar
      var t1 = x.t.charAt(0).toLowerCase() + x.t.slice(1);
      out.push({ id: 'h:' + x.t, p: x.kind === 'warn' ? 45 : x.kind === 'good' ? 30 : 20, icon: x.g ? GRUPOS[x.g].ic : x.icon, tag: x.g ? T(x.g) : T('Descubrí'), kind: x.kind, sub: x.s,
        t: x.t, s: x.s, cmp: x.cmp, ask: x.ask, act: x.go, actl: x.gol,
        di: x.kind === 'good' ? T('¡Buena noticia! {t}.', { t: t1 }) : x.kind === 'warn' ? T('{t}. ¿Lo revisamos juntos?', { t: x.t }) : x.t + '.' });
    });
    return out.filter(function (x) { return !oculto(x.id); }).map(function (x) { x.done = hecho(x.id) ? x.ok || T('Listo') : null; return x; })
      .sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0) || b.p - a.p; });
  }
  function consejoHTML(x) {
    var mx = x.cmp ? Math.max.apply(null, x.cmp.map(function (c) { return c.v; }).concat([1])) : 1;
    return '<article class="pfm-tip is-' + (x.kind || 'info') + (x.done ? ' is-done' : '') + '">' +
      '<p class="pfm-tip__tag"><span class="material-symbols-rounded" aria-hidden="true">' + x.icon + '</span>' + esc(x.tag) + '</p>' +
      '<p class="pfm-tip__t">' + (x.done ? '<span class="material-symbols-rounded" aria-hidden="true">check_circle</span>' + esc(x.done) : esc(x.t)) + '</p>' + (x.s && !x.done ? '<p class="pfm-tip__s">' + esc(x.s) + '</p>' : '') +
      (x.cmp && !x.done ? '<span class="pfm-dcard__cmp">' + x.cmp.map(function (c) {
        return '<span class="pfm-dcard__row' + (c.on ? ' is-on' : '') + '"><small>' + esc(c.l) + '</small><b>' + money0(c.v) + '</b><i style="width:' + Math.max(3, c.v / mx * 100).toFixed(1) + '%"></i></span>'; }).join('') + '</span>' : '') +
      '<div class="pfm-tip__acts">' + (x.done ? '<button class="section__link" data-pfm="deshacer:' + esc(x.id) + '">' + T('Deshacer') + '</button>'
        : (x.act ? '<button class="pf-link" data-pfm="' + esc(x.act) + '">' + esc(x.actl) + '</button>' : '') +
          (tobe() && x.ask ? '<button class="pf-link" data-pfm="ai:' + esc(x.ask) + '"><span class="material-symbols-rounded" aria-hidden="true">auto_awesome</span>' + T('Pregúntale') + '</button>' : '') +
          '<button class="section__link" data-pfm="luego:' + esc(x.id) + '">' + T('Ahora no') + '</button>') + '</div></article>';
  }
  // Confirmar antes de programar algo: qué, a quién, cuánto y cuándo
  function confirmar(x) {
    var c = x.conf;
    showSheet('<h3>' + esc(x.actl) + '</h3><p>' + esc(x.s) + '</p><div class="pfm-confirm">' +
      (c.monto != null ? '<div><small>' + T('Monto') + '</small><b>' + money(c.monto) + '</b></div>' : '<div><small>' + T('Monto') + '</small><b>' + T('El total de tu estado de cuenta') + '</b></div>') +
      '<div><small>' + T('Para') + '</small><b>' + esc(c.para) + '</b></div><div><small>' + T('Cuándo') + '</small><b>' + esc(c.cuando) + '</b></div>' +
      '<div><small>' + T('Desde') + '</small><b>' + esc((saldos()[0] || { n: 'tu cuenta' }).n.replace(/ Pichibank/, '')) + '</b></div></div>' +
      '<p class="pf-note">' + T('Uku te avisa un día antes si no te alcanza. Lo puedes cancelar cuando quieras.') + '</p>' +
      '<button class="pf-cta" data-pfm="hecho:' + esc(x.id) + '">' + T('Confirmar') + '</button><button class="pf-link pf-link--block" data-pfm="cerrar">' + T('Ahora no') + '</button>');
  }
  function consejo(id) { return consejos().filter(function (x) { return x.id === id; })[0]; }
  // Qué significa cada cosa del mundo de Uku
  // Las tres señales del mundo de Uku (consumos, ahorro, presupuesto): Uku las muestra en su pantalla
  function worldSignals() {
    var a = animo(), c = colchon(), F = finanzas(), H = historia(), ok = H.filter(function (x) { return x.ok; }).length, nSug = consejos().filter(function (x) { return !x.done; }).length;
    return [
      { ic: MOOD_IC[a.k], l: T('Tus gastos por ordenar'), v: a.n ? T('{n} sin clasificar', { n: a.n }) : T('Todo en orden'), cls: a.k,
        d: a.n ? T(a.n === 1 ? 'Tienes 1 consumo sin clasificar. Cuando lo ordenes, vuelvo a estar contento.' : 'Tienes {n} consumos sin clasificar. Cuando los ordenes, vuelvo a estar contento.', { n: a.n }) : T('Tus gastos están clasificados. Por eso me ves contento.') },
      { ic: 'local_florist', l: T('Tu ahorro'), v: c >= 1 ? T(Math.floor(c) === 1 ? 'Te alcanza 1 mes' : 'Te alcanza {n} meses', { n: Math.floor(c) }) : T('Menos de 1 mes'), cls: c >= 3 ? 'ok' : c >= 1 ? 'warn' : 'over',
        d: c >= 3 ? T('Lo que tienes cubre {n} meses de gastos. Por eso tus canteros están llenos de flores.', { n: Math.floor(c) }) : c >= 1 ? T(Math.floor(c) === 1 ? 'Lo que tienes cubre 1 mes de gastos. Las flores crecen cuando llega a 3 meses.' : 'Lo que tienes cubre {n} meses de gastos. Las flores crecen cuando llega a 3 meses.', { n: Math.floor(c) }) : T('Con ahorro, el campo se llena de flores. Con un primer colchón empiezan a salir.') },
      // Tu historia: un árbol por cada mes con movimientos; los frondosos, meses en que te sobró dinero
      F.nuevo ? { ic: 'potted_plant', l: T('Tu historia'), v: T('Recién empieza'), cls: 'ok', d: T('Todavía no hay árboles: tu historia recién empieza. Por ahora solo ves brotes; con tus primeros movimientos crece el bosque.') }
        : { ic: 'park', l: T('Tu historia'), v: T(H.length === 1 ? '1 mes' : '{n} meses', { n: H.length }), cls: H[0] && !H[0].ok ? 'warn' : 'ok',
          d: T('Cada árbol es un mes de tu historia. Los más frondosos son meses en que te sobró dinero ({n}); los más chicos, meses en que quedaste justo.', { n: ok }) },
      { ic: 'emoji_nature', l: T('Mis sugerencias'), v: T(nSug === 1 ? '1 sugerencia' : '{n} sugerencias', { n: nSug }), cls: 'ok', d: T('Las mariposas son mis sugerencias para ti: siempre hay alguna volando, y cuando haces una, su lugar lo toma la siguiente.') }
    ].concat(
      // Lo que tienes también se ve (y nunca es triste): brotes si recién empiezas, guayacanes por tus inversiones, y lo que lograste con tus créditos
      F.nuevo ? [{ ic: 'potted_plant', l: T('Recién empiezas'), v: T('Lleno de brotes'), cls: 'ok', d: T('Tu claro está lleno de brotes amarillos. Con tus primeros ahorros salen las flores.') }] : [],
      F.inversion > 0 ? [{ ic: 'forest', l: T('Tus inversiones'), v: T('Guayacanes en flor'), cls: 'ok', d: T('Tienes {m} invertidos: por eso en tu claro florecen guayacanes.', { m: money0(F.inversion) }) }] : [],
      F.deudas.length ? [{ ic: 'cottage', l: T('Tus créditos'), v: T(F.deudas.length === 1 ? '1 crédito' : '{n} créditos', { n: F.deudas.length }), cls: 'ok', d: T('Cada crédito pone en tu claro lo que tienes gracias a él: tu casa, tu carro, la tiendita de tus tarjetas o lo que compraste a cuotas.') }] : []);
  }
  function worldSheet() {
    var row = function (x) { return '<div class="pfm-world__row is-' + x.cls + '"><span class="material-symbols-rounded" aria-hidden="true">' + x.ic + '</span><span><b>' + x.l + ' · ' + x.v + '</b><small>' + x.d + '</small></span></div>'; }, a = animo();
    showSheet('<h3>' + T('El mundo de tu Asistente') + '</h3><p>' + T('Uku y su mundo cuentan tu historia financiera. Cada cosa tiene un solo significado.') + '</p>' + worldSignals().map(row).join('') +
      (a.n ? '<button class="pf-cta pfm-block" data-pfm="game">' + T('Clasificar {n}', { n: Math.min(TANDA, a.n) }) + '</button>' : ''));
  }

  /* Lo que el banco no sabe clasificar solo. MVP: no sabe dónde pagaste con
     Deuna ni qué son las transferencias de personas, así que hay más. To-be:
     Uku clasificó casi todo y solo pregunta lo que no puede saber. */
  var SIN = { 'Pagos con Deuna': 1, 'Transferencias a personas': 1, 'Pagos a empresas': 1, 'Otros': 1 };
  /* Qué falta clasificar: lo de las últimas 4 semanas, más las preguntas
     viejas que siguen abiertas. Cada consumo guarda su fecha: de ahí sale
     cuánto tiempo lleva esperando (y el ánimo de Uku). */
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
      var c = cls(r, true); if (c.k !== 'gasto' || !(SIN[c.cat] || c.cat === 'Efectivo retirado')) return;
      out.push({ t: 'r', r: r, f: r.f, cash: c.cat === 'Efectivo retirado', done: !!(catOv(r) || ruleOf(r)) });
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
    var L = tareas().list.filter(function (it) { return !it.done; }).map(function (it) { it.sug = it.t === 'q' ? it.q.tpl.o[0] : sugerir(it.r); return it; })
      .sort(function (a, b) { return b.sem.localeCompare(a.sem) || (a.t === 'q' ? 0 : 1) - (b.t === 'q' ? 0 : 1) || b.f.localeCompare(a.f); });
    // Las mesadas por confirmar van como tercera tarjeta: una sorpresa en medio del juego
    mesadas().filter(function (x) { return !mesOf(x.cp); }).forEach(function (x) { L.splice(Math.min(2, L.length), 0, { t: 'm', m: x, f: HOY, sem: lunes(HOY) }); });
    return L;
  }
  /* Mesadas: plata que va cada mes a la misma persona, por un monto
     parecido. Uku pregunta si es una mesada; si lo es, la clasifica toda
     de una vez y ofrece programarla para que se envíe sola. */
  function mesadas() {
    var by = {}, desde = mesesAtras(6)[0];
    rows().forEach(function (r) {
      if (r.m >= 0 || r.mes < desde || r.prod !== 'Cuenta' || /^tú/.test(r.cp) || !(r.c === 'Transferencia a persona' || r.c === 'Familia y dependientes')) return;
      var x = by[r.cp] || (by[r.cp] = { cp: r.cp, ms: {}, rows: [] }); x.rows.push(r); x.ms[r.mes] = 1;
    });
    return Object.keys(by).map(function (k) { return by[k]; }).filter(function (x) {
      var n = Object.keys(x.ms).length, v = x.rows.map(function (r) { return -r.m; });
      return n >= 3 && x.rows.length <= n + 1 && Math.min.apply(null, v) >= 15 && Math.max.apply(null, v) <= Math.min.apply(null, v) * 1.4;
    }).map(function (x) {
      var v = x.rows.map(function (r) { return -r.m; }).sort(function (a, b) { return a - b; }), d = x.rows.map(function (r) { return r.dia; }).sort(function (a, b) { return a - b; });
      x.monto = v[Math.floor(v.length / 2)]; x.dia = d[Math.floor(d.length / 2)]; x.n = Object.keys(x.ms).length; x.src = x.rows[x.rows.length - 1].src.replace(/ Pichibank/, '');
      x.porMes = mesesAtras(6).map(function (m) { return { l: Mes(m), v: sumv(x.rows.filter(function (r) { return r.mes === m; }), function (r) { return -r.m; }) }; });
      return x;
    });
  }
  function mesOf(cp) { var M = ST.mesadas && ST.mesadas[ST.u]; return M && M[cp]; }
  function setMesada(x, st) {
    (ST.mesadas || (ST.mesadas = {}))[ST.u] = ST.mesadas[ST.u] || {}; ST.mesadas[ST.u][x.cp] = st;
    if (st.v === 'mesada' || st.v === 'pagoDeuda') rows().forEach(function (r) {
      if (r.cp !== x.cp || r.m >= 0 || r.prod !== 'Cuenta') return;
      if (r.t === 'Por revisar') resp()[gkey(r)] = st.v === 'mesada' ? 'familia' : 'pagoDeuda';
      else (ST.cats[ST.u] || (ST.cats[ST.u] = {}))[r.i] = st.v === 'mesada' ? 'Familia y dependientes' : 'Servicios financieros y deudas';
    });
    persist(); cache = {}; fijoCache = {};
  }
  // Pagos repetidos a un mismo comercio o persona, sin clasificar: se ordenan de una
  function repetidos() {
    var by = {};
    items().forEach(function (it) { if (it.t !== 'r' || it.cash || /^tú|^Pichibank$/.test(it.r.cp)) return; (by[it.r.cp] = by[it.r.cp] || []).push(it); });
    return Object.keys(by).filter(function (k) { return by[k].length >= 3; }).map(function (k) { return { cp: k, list: by[k], total: sumv(by[k], function (it) { return -it.r.m; }), sug: by[k][0].sug }; })
      .sort(function (a, b) { return b.list.length - a.list.length; });
  }
  // Lo que Uku cree que fue un consumo (reglas en el MVP; el comercio en el to-be)
  function sugerir(r) {
    var h = +r.h.slice(0, 2), v = -r.m, ap = user().nombre.split(' ')[1];
    if (r.c === 'Efectivo retirado') return v >= 60 ? { cat: 'Efectivo retirado', why: T('Es un retiro grande: suele ir a varias cosas.') } : { cat: 'Alimentación', why: T('Los retiros chicos suelen ir a la tienda o al bus.') };
    if (ap && r.cp.indexOf(ap) >= 0) return { cat: 'Familia y dependientes', why: T('Comparte tu apellido.') };
    if (tobe() && r.c !== 'Transferencia a persona') return { cat: mapc(r.c), why: T('Por el comercio: {c}.', { c: r.cp }) };
    if (h >= 11 && h <= 15 && v <= 20) return { cat: 'Alimentación', why: T('Montos así suelen ser comida rápida o un menú.') };
    if (v <= 3) return { cat: 'Transporte', why: T('Es un monto chico, como un bus o un taxi.') };
    if ((h >= 19 || wday(r.f) % 6 === 0) && v <= 40) return { cat: 'Entretenimiento', why: T('Montos así suelen ser salidas y planes.') };
    return null;
  }
  var TANDA = 10; // se clasifica de a 10, sin prisa

  /* El juego de ordenar: un consumo por pantalla, con lo que ayuda a
     recordar (a quién, cuánto, cuándo y por dónde) y un toque. Tiene que
     dar gusto: la tarjeta entra, sale volando al elegir, Uku avanza por la
     barra y te anima, y al guardar hay fiesta. Entre los consumos aparecen:
     · el efectivo: Uku no ve en qué se usó; un toque lo cuenta,
     · reglas: "¿clasifico también los otros pagos a esta tienda?",
     · mesadas: lo que va cada mes a la misma persona, para programarlo.
     Las respuestas se guardan al final, después de revisar el resumen. */
  var OPCATS = [['Alimentación', 'Comida'], ['Transporte', 'Movilidad'], ['Vivienda', 'Hogar'], ['Salud y bienestar', 'Salud y educación'], ['Entretenimiento', 'Gustos'], ['Familia y dependientes', 'Familia'], ['Servicios financieros y deudas', 'Compromisos'], ['Otros', 'Otro']];
  var MESOPT = [['mesada', 'Sí, es una mesada', 'volunteer_activism'], ['pagoDeuda', 'Le estoy pagando un préstamo', 'handshake'], ['otra', 'Es otra cosa', 'more_horiz']];
  var ANIMO = ['¡Bien!', '¡Eso!', '¡Uno menos!', '¡Vas volando!', '¡Genial!', '¡Así se hace!', '¡Qué orden!'];
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = null, gel = null;
  function gameOpen() {
    var all = items();
    G = { list: all.slice(0, TANDA), total: all.length, i: 0, ans: [], view: 'card', rules: {}, extra: [], pw: 0, antes: animo().k, hits: 0, tries: 0 };
    if (!G.list.length) return toast(T('No tienes nada por clasificar.'));
    if (!gel) {
      gel = document.createElement('div'); gel.className = 'pfm-game'; gel.setAttribute('role', 'dialog'); gel.setAttribute('aria-modal', 'true'); gel.setAttribute('aria-label', T('Clasifica tus consumos'));
      document.body.appendChild(gel);
      gel.addEventListener('click', function (e) { var b = e.target.closest('[data-g]'); if (b && !G.busy) gameKey(b.dataset.g, b); });
      document.addEventListener('keydown', function (e) {
        if (!gel.classList.contains('open')) return;
        if (e.key === 'Escape') { e.stopImmediatePropagation(); return gameClose(); }
        if (G.busy || e.altKey || e.ctrlKey || e.metaKey || /input|textarea/i.test(e.target.tagName)) return;
        // Atajos: 1-9 eligen la opción, → acepta lo que cree Uku, ← lo deja para después
        var it = G.list[G.i], ops = gel.querySelectorAll('.pfm-choice, .pfm-allcat'), n = +e.key;
        if (n >= 1 && n <= ops.length) { e.preventDefault(); ops[n - 1].click(); }
        else if (G.view === 'card' && it && e.key === 'ArrowRight' && sugDe(it)) { e.preventDefault(); gameKey(sugDe(it), gel.querySelector('[data-g="' + sugDe(it) + '"]')); }
        else if (G.view === 'card' && it && e.key === 'ArrowLeft') { e.preventDefault(); gameKey('later'); }
      }, true);
    }
    gameRender(); gel.classList.add('open'); document.documentElement.classList.add('has-ai'); fx('open');
  }
  function gameClose() { if (!gel) return; gel.classList.remove('open'); document.documentElement.classList.remove('has-ai'); fx('close'); refresh(); }
  function iniciales(n) { return String(n).replace(/^tú.*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || '·'; }
  function titulo(s) { return String(s).toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
  // A quién fue: el comercio o la persona; lo que dice el banco va debajo
  function quien(r) { return !r.cp || /^tú|^Pichibank$/.test(r.cp) ? desc(r) : r.cp; }
  function cuandoDe(f, h) { return DIA1[wday(f)] + ' ' + dshort(f) + (h ? ' · ' + h : ''); }
  function cardHTML(it) {
    var who, sub = '', amt, cuando, por, av, pos = false, extra = '';
    if (it.t === 'm') {
      var x = it.m, mx = Math.max.apply(null, x.porMes.map(function (c) { return c.v; }).concat([1]));
      who = corto(x.cp); sub = T('Le envías plata cada mes'); amt = x.monto; av = '<span class="pfm-card__av is-mes"><span class="material-symbols-rounded">event_repeat</span></span>';
      cuando = T('{n} meses seguidos · casi siempre el día {d}', { n: x.n, d: x.dia }); por = x.src;
      extra = '<span class="pfm-card__months">' + x.porMes.map(function (c, i) { return '<span style="--h:' + Math.max(4, c.v / mx * 100).toFixed(0) + '%;--d:' + i * 60 + 'ms"><i></i><small>' + c.l.charAt(0) + '</small></span>'; }).join('') + '</span>';
    } else if (it.t === 'q') {
      var q = it.q; pos = q.sign === '+';
      who = corto(q.cp); sub = pos ? T('Te envió plata') : T('Le enviaste plata'); amt = q.total; av = '<span class="pfm-card__av">' + iniciales(q.cp) + '</span>';
      cuando = q.rows.length > 1 ? T('{n} veces · la última el {f}', { n: q.rows.length, f: dshort(q.last.f) }) : cuandoDe(q.last.f, q.last.h);
      por = q.last.src.replace(/ Pichibank/, '');
    } else {
      var r = it.r, deuna = /Deuna/.test(r.src);
      if (it.cash) { who = T('Retiro de efectivo'); sub = titulo(r.desc.replace(/^RETIRO\s+(CNB\s+)?/i, '')); av = '<span class="pfm-card__av is-cash"><span class="material-symbols-rounded">local_atm</span></span>'; }
      else { who = quien(r); sub = deuna ? T('Pago con Deuna') : desc(r) !== who ? desc(r) : ''; av = '<span class="pfm-card__av">' + iniciales(who) + (deuna ? '<em class="material-symbols-rounded">qr_code_2</em>' : '') + '</span>'; }
      amt = -r.m; cuando = cuandoDe(r.f, r.h); por = r.src.replace(/ Pichibank/, '');
    }
    // Jerarquía: el monto manda, luego a quién; cuándo y por dónde van chicos
    return '<div class="pfm-card">' + av +
      '<p class="pfm-card__amt' + (pos ? ' is-pos' : '') + '" data-v="' + amt + '" data-s="' + (pos ? '+' : '−') + '">' + (pos ? '+' : '−') + money(amt) + '</p>' +
      '<p class="pfm-card__who">' + esc(who) + (it.t === 'm' ? ' · ' + T('al mes') : '') + '</p>' +
      '<p class="pfm-card__meta">' + esc([sub, cuando, por].filter(Boolean).join(' · ')) + '</p>' + extra + '</div>';
  }
  function choice(g, ic, l, sug, i) {
    return '<button class="pfm-choice' + (sug ? ' is-sug' : '') + '" style="--d:' + (i * 35) + 'ms" data-g="' + esc(g) + '">' + (ic ? '<span class="material-symbols-rounded" aria-hidden="true">' + ic + '</span>' : '') + '<span>' + esc(l) + '</span>' +
      (sug ? '<em class="material-symbols-rounded" title="' + T('Tu Asistente cree') + '" aria-label="' + T('Tu Asistente cree') + '">auto_awesome</em>' : '') + '</button>';
  }
  // Las opciones: un toque. La de Uku va primero y marcada
  function choicesHTML(it) {
    if (it.t === 'm') return '<p class="pfm-game__ask">' + T('¿Es una mesada para {n}?', { n: corto(it.m.cp).split(' ')[0] }) + '<small>' + T('Si lo es, la clasifico toda de una vez y te ayudo a programarla.') + '</small></p>' +
      '<div class="pfm-choices is-list">' + MESOPT.map(function (o, i) { return choice('mes:' + o[0], o[2], T(o[1]), i === 0, i); }).join('') + '</div>';
    if (it.t === 'q') return '<p class="pfm-game__ask">' + T(it.q.sign === '+' ? '¿Qué es este dinero?' : '¿Qué le enviaste?') + '</p><div class="pfm-choices is-list">' +
      it.q.tpl.o.map(function (id, i) { return choice('opt:' + id, '', OPT[id].l, i === 0, i); }).join('') + '</div>';
    // Siete grupos a un toque; "Ver todas" abre el listado completo de categorías
    var sg = it.sug && it.sug.cat, ops = OPCATS.filter(function (c) { return c[0] !== 'Otros'; });
    if (it.cash) ops.push(['Efectivo retirado', 'Un poco de todo']);
    if (sg && !ops.some(function (c) { return c[0] === sg; })) ops.unshift([sg, sg]);
    ops.sort(function (a, b) { return (b[0] === sg) - (a[0] === sg); });
    ops.push(['all', 'Ver todas']);
    return '<p class="pfm-game__ask">' + (it.cash ? T('¿En qué usaste este efectivo?') : T('¿En qué fue?')) + '<small>' + esc(it.sug ? it.sug.why : it.cash ? T('Uku no ve el efectivo. Con un toque, tu presupuesto se vuelve real.') : '') + '</small></p><div class="pfm-choices">' +
      ops.map(function (c, i) { return c[0] === 'all' ? choice('all', 'more_horiz', T(c[1]), false, i).replace('pfm-choice', 'pfm-choice is-more') : choice('cat:' + c[0], icono(c[0]), etiqueta(c[0]), c[0] === sg, i); }).join('') + '</div>';
  }
  // El listado completo: las categorías del catálogo, con su grupo
  function allRender() {
    var it = G.list[G.i];
    gel.innerHTML = topHTML(T('{a} de {b}', { a: Math.min(hechos() + 1, G.list.length), b: G.list.length }), T('Resultado')) + barHTML() +
      '<div class="pfm-game__all"><p class="pfm-game__ask">' + T('¿En qué categoría va?') + '<small>' + esc(it.cash ? T('Retiro de efectivo') : quien(it.r)) + ' · ' + money(-it.r.m) + '</small></p>' +
      '<div class="pfm-allcats">' + PFM13.map(function (c, i) {
        return '<button class="pfm-allcat" style="--d:' + i * 25 + 'ms" data-g="cat:' + esc(c) + '"><span class="material-symbols-rounded" aria-hidden="true">' + CAT[c] + '</span><span><b>' + esc(c) + '</b><small>' + esc(T(grupo(c))) + '</small></span></button>';
      }).join('') + '</div><div class="pfm-game__acts"><button class="pf-link" data-g="cards">' + T('Volver') + '</button></div></div>';
    moverBarra();
  }
  function topHTML(mid, right) {
    return '<div class="pfm-game__top"><button class="pf-round" data-g="' + (right ? 'stop' : 'close') + '" aria-label="' + T('Cerrar') + '"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>' +
      '<span class="pfm-game__count">' + (mid || '') + '</span>' + (right ? '<button class="section__link" data-g="result">' + right + '</button>' : '<span></span>') + '</div>';
  }
  function etiqueta(v) {
    var E = { mesada: 'Mesada', otra: 'Otra cosa', 'Efectivo retirado': 'Un poco de todo' };
    if (E[v]) return T(E[v]); if (OPT[v]) return OPT[v].l; var c = OPCATS.filter(function (x) { return x[0] === v; })[0]; return c ? T(c[1]) : v;
  }
  function icono(v) { var c = OPCATS.filter(function (x) { return x[0] === v; })[0]; return v === 'mesada' ? 'event_repeat' : v === 'Efectivo retirado' ? 'payments' : c ? (GRUPOS[c[1]] ? GRUPOS[c[1]].ic : 'category') : CAT[v] || 'person'; }
  function hechos() { return G.ans.filter(Boolean).length; }
  // Uku va en la barra: avanza con cada respuesta
  function barHTML() {
    return '<div class="pfm-play"><div class="pfm-play__bar"><i></i></div><span class="pfm-play__uku" aria-hidden="true">' + face() + '</span>' +
      (G.cheer ? '<span class="pfm-play__cheer" aria-live="polite">' + esc(G.cheer) + '</span>' : '') + '</div>';
  }
  function moverBarra() {
    var w = hechos() / G.list.length * 100, bar = gel.querySelector('.pfm-play__bar i'), uk = gel.querySelector('.pfm-play__uku');
    if (!bar) return;
    bar.style.width = G.pw + '%'; uk.style.left = G.pw + '%';
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = w + '%'; uk.style.left = w + '%'; if (w > G.pw) uk.classList.add('is-hop'); G.pw = w; }); });
  }
  // La cifra sube de 0 al monto, rápido
  function contar() {
    var el = gel.querySelector('.pfm-card__amt'); if (!el || RM) return;
    var v = +el.dataset.v, s = el.dataset.s, t0 = performance.now();
    (function f(t) { var k = Math.min(1, (t - t0) / 420), e = 1 - Math.pow(1 - k, 3); el.textContent = s + money(v * e); if (k < 1) requestAnimationFrame(f); })(t0);
  }
  // La opción que cree Uku (la que acepta el deslizar a la derecha)
  function sugDe(it) { return it.t === 'q' ? 'opt:' + it.q.tpl.o[0] : it.t === 'm' ? 'mes:mesada' : it.sug && it.sug.cat ? 'cat:' + it.sug.cat : null; }
  /* Deslizar, como en las apps de citas: a la derecha aceptas lo que cree
     Uku, a la izquierda lo dejas para después. La tarjeta se inclina y
     muestra un sello mientras la arrastras. */
  function deslizar(it) {
    var card = gel.querySelector('.pfm-card'), sug = sugDe(it), x0 = null, dx = 0;
    if (!card || RM || !window.PointerEvent) return;
    card.classList.add('is-drag');
    card.insertAdjacentHTML('beforeend', (sug ? '<span class="pfm-stamp is-si" aria-hidden="true"><span class="material-symbols-rounded">check</span>' + esc(etiqueta(sug.split(':').slice(1).join(':'))) + '</span>' : '') +
      '<span class="pfm-stamp is-no" aria-hidden="true"><span class="material-symbols-rounded">schedule</span>' + T('Más tarde') + '</span>');
    var mover = function (v) { card.style.transform = 'translateX(' + v + 'px) rotate(' + (v / 16).toFixed(1) + 'deg)'; card.style.setProperty('--si', Math.max(0, Math.min(1, v / 90))); card.style.setProperty('--no', Math.max(0, Math.min(1, -v / 90))); };
    card.addEventListener('pointerdown', function (e) { if (G.busy || e.button) return; x0 = e.clientX; dx = 0; card.style.animation = 'none'; card.style.transition = 'none'; card.setPointerCapture(e.pointerId); });
    card.addEventListener('pointermove', function (e) { if (x0 == null) return; dx = e.clientX - x0; if (dx > 0 && !sug) dx *= .25; mover(dx); });
    var soltar = function () {
      if (x0 == null) return; x0 = null; card.style.transition = 'transform .3s cubic-bezier(.3, 1.3, .5, 1)';
      if (dx > 90 && sug) { fx('select'); card.style.transition = 'transform .3s ease-in, opacity .3s'; mover(window.innerWidth); card.style.opacity = 0; G.busy = true; setTimeout(function () { G.busy = false; gameKey(sug, gel.querySelector('[data-g="' + sug + '"]')); }, 160); }
      else if (dx < -90) { fx('tap'); card.style.transition = 'transform .3s ease-in, opacity .3s'; mover(-window.innerWidth); card.style.opacity = 0; G.busy = true; setTimeout(function () { gameKey('later'); }, 260); }
      else mover(0);
    };
    card.addEventListener('pointerup', soltar); card.addEventListener('pointercancel', soltar);
  }
  function gameRender() {
    G.busy = false;
    while (G.view === 'card' && G.list[G.i] && G.ans[G.i]) G.i++; // los que ya ordenó una regla
    var L = G.list, it = L[G.i];
    if (G.view === 'rule') return ruleRender();
    if (G.view === 'prog') return progRender();
    if (G.view === 'progconf') return progConfRender();
    if (G.view === 'all') return allRender();
    if (G.view === 'done') return doneRender();
    if (G.view === 'result' || !it) return resultRender();
    gel.innerHTML = topHTML(T('{a} de {b}', { a: Math.min(hechos() + 1, L.length), b: L.length }), T('Resultado')) + barHTML() +
      '<div class="pfm-game__stage">' + cardHTML(it) + choicesHTML(it) + '</div>' +
      '<div class="pfm-game__acts">' + (G.i ? '<button class="pf-link" data-g="back">' + T('Atrás') + '</button>' : '') +
      '<button class="pf-link" data-g="later">' + T('Más tarde') + '</button></div>' +
      (G.i < 2 && !RM ? '<p class="pfm-game__swipe">' + (sugDe(it) ? T('Desliza a la derecha si Uku acertó, a la izquierda para después') : T('Desliza a la izquierda para dejarlo para después')) + '</p>' : '');
    G.cheer = null; moverBarra(); contar(); deslizar(it);
  }
  // Elegir: el botón late, la tarjeta sale volando y Uku te anima
  function elegir(btn, then) {
    G.busy = true; fx('select');
    var n = hechos(); G.cheer = n && (n % 2 === 0 || n === G.list.length - 1) ? T(ANIMO[(n / 2 | 0) % ANIMO.length]) : null;
    if (RM) return then();
    if (btn) { btn.classList.add('is-picked'); var p = document.createElement('span'); p.className = 'pfm-plus'; p.textContent = '+1'; btn.appendChild(p); }
    gel.querySelectorAll('.pfm-choice').forEach(function (b) { if (b !== btn) b.classList.add('is-out'); });
    setTimeout(function () { var c = gel.querySelector('.pfm-card'); if (c) c.classList.add('is-gone'); }, 140);
    setTimeout(then, 420);
  }
  // ¿Lo mismo para los otros pagos a esta tienda o persona?
  function ruleRender() {
    var R = G.rule, n = R.list.length;
    gel.innerHTML = topHTML(T('{a} de {b}', { a: Math.min(hechos() + 1, G.list.length), b: G.list.length }), T('Resultado')) + barHTML() +
      '<div class="pfm-game__panel"><span class="pfm-game__big material-symbols-rounded" aria-hidden="true">' + icono(R.v) + '</span>' +
      '<h2>' + T(n === 1 ? '¿Y el otro pago a {c}?' : '¿Y los otros {n} pagos a {c}?', { n: n, c: R.cp }) + '</h2>' +
      '<p>' + T('Los pongo también en {g} y lo recuerdo para los próximos. Suman {m}.', { g: etiqueta(R.v), m: money(sumv(R.list, function (it) { return -it.r.m; })) }) + '</p>' +
      '<div class="pfm-game__stack">' + R.list.slice(0, 3).map(function (it, i) { return '<span style="--i:' + i + '">' + esc(cuandoDe(it.r.f)) + '<b>' + money(-it.r.m) + '</b></span>'; }).join('') + '</div>' +
      '<div class="pfm-game__foot"><button class="pf-cta" data-g="rule:si">' + T(n === 1 ? 'Sí, ese también' : 'Sí, los {n}', { n: n }) + '</button><button class="section__link" data-g="rule:no">' + T('Solo este') + '</button></div></div>';
    moverBarra();
  }
  // Después de "es una mesada": ¿la programamos?
  function progRender() {
    var x = G.list[G.i].m;
    gel.innerHTML = topHTML(T('{a} de {b}', { a: Math.min(hechos(), G.list.length), b: G.list.length }), T('Resultado')) + barHTML() +
      '<div class="pfm-game__panel"><span class="pfm-game__big is-ok material-symbols-rounded" aria-hidden="true">event_available</span>' +
      '<h2>' + T('¿La programamos?') + '</h2><p>' + T('Pichibank le envía {m} a {n} cada día {d}, sin que tengas que acordarte. Uku te avisa un día antes si no te alcanza.', { m: money0(x.monto), n: corto(x.cp).split(' ')[0], d: x.dia }) + '</p>' +
      '<div class="pfm-game__foot"><button class="pf-cta" data-g="prog:si">' + T('Programar cada día {d}', { d: x.dia }) + '</button><button class="section__link" data-g="prog:no">' + T('Ahora no') + '</button></div></div>';
    moverBarra();
  }
  // Confirmación antes de activar: el monto, a quién, cuándo y de dónde, y un paso explícito
  function progConfRender() {
    var x = G.list[G.i].m;
    gel.innerHTML = topHTML(T('{a} de {b}', { a: Math.min(hechos(), G.list.length), b: G.list.length }), T('Resultado')) + barHTML() +
      '<div class="pfm-game__panel"><span class="pfm-game__big material-symbols-rounded" aria-hidden="true">fact_check</span>' +
      '<h2>' + T('Confirma la programación') + '</h2><p>' + T('Revisa antes de activarla. Podrás dejarla desde el detalle de la mesada.') + '</p>' +
      progDetails(x) +
      '<div class="pfm-game__foot"><button class="pf-cta" data-g="prog:ok">' + T('Sí, programar {m} cada día {d}', { m: money0(x.monto), d: x.dia }) + '</button><button class="section__link" data-g="prog:back">' + T('Volver') + '</button></div></div>';
    moverBarra();
  }
  // Revisar antes de guardar: cuántos van a cada grupo
  function resultRender() {
    var by = {}, n = hechos() + G.extra.length, later = G.list.length - hechos();
    G.ans.forEach(function (a) { if (!a) return; var k = a.it.t === 'm' ? T('Mesada a {n}', { n: corto(a.it.m.cp).split(' ')[0] }) : etiqueta(a.v); (by[k] = by[k] || { n: 0, ic: icono(a.v), prog: a.prog }); by[k].n++; });
    G.extra.forEach(function (e) { var k = etiqueta(e.v); (by[k] = by[k] || { n: 0, ic: icono(e.v) }); by[k].n++; });
    var rules = Object.keys(G.rules);
    gel.innerHTML = topHTML() +
      '<div class="pfm-game__result"><span class="pfm-game__check material-symbols-rounded" aria-hidden="true">done_all</span>' +
      '<h2>' + (n === 1 ? T('1 consumo ordenado') : T('{n} consumos ordenados', { n: n })) + '</h2><p>' + T('Revísalo una última vez antes de guardar.') + '</p>' +
      // Uku aprende: cuánto acertó y cuánto le enseñaste
      (G.tries ? '<p class="pfm-game__iq"><span class="pfm-game__iqface" aria-hidden="true">' + face() + '</span><span>' + T(G.hits === G.tries ? (G.tries === 1 ? '¡Uku acertó!' : '¡Uku acertó las {t}!') : 'Uku acertó {h} de {t}.', { h: G.hits, t: G.tries }) +
        ' ' + (G.hits < G.tries ? T('Con lo que le enseñaste, la próxima vez adivina mejor.') : T('Ya te conoce bien.')) + '</span></p>' : '') +
      '<div class="pfm-sum">' + Object.keys(by).map(function (k, i) {
        return '<div class="pfm-sum__row" style="--d:' + i * 60 + 'ms"><span class="pfm-sum__ic material-symbols-rounded" aria-hidden="true">' + by[k].ic + '</span><span>' + esc(k) + (by[k].prog ? '<small>' + T('Programada') + '</small>' : '') + '</span><b>' + (by[k].n === 1 ? T('1 consumo') : T('{n} consumos', { n: by[k].n })) + '</b></div>';
      }).join('') + (later ? '<div class="pfm-sum__row"><span class="pfm-sum__ic material-symbols-rounded" aria-hidden="true">schedule</span><span>' + T('Más tarde') + '</span><b>' + (later === 1 ? T('1 consumo') : T('{n} consumos', { n: later })) + '</b></div>' : '') + '</div>' +
      (rules.length ? '<p class="pf-note">' + T('Uku recordará: {r}.', { r: rules.map(function (c) { return c + ' → ' + etiqueta(G.rules[c]); }).join(', ') }) + '</p>' : '<p class="pf-note">' + T('Puedes cambiar cada uno después en el detalle del movimiento.') + '</p>') +
      '<div class="pfm-game__foot">' + (n ? '<button class="pf-cta" data-g="save">' + T('Guardar') + '</button>' : '<button class="pf-cta" data-g="close">' + T('Volver') + '</button>') +
      (G.i < G.list.length ? '<button class="section__link" data-g="resume">' + T('Seguir clasificando') + '</button>' : '') + '</div></div>';
  }
  function confeti() {
    if (RM) return '';
    var C = ['#ffdd00', '#0f265c', '#8fb9a0', '#f2c94c', '#9fb3d9'], h = '';
    for (var i = 0; i < 36; i++) h += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + C[i % C.length] + ';--x:' + ((Math.random() - .5) * 120).toFixed(0) + 'px;--r:' + (Math.random() * 720 - 360).toFixed(0) + 'deg;animation-delay:' + (Math.random() * .25).toFixed(2) + 's;animation-duration:' + (1.1 + Math.random() * .8).toFixed(2) + 's"></i>';
    return '<div class="pfm-confeti" aria-hidden="true">' + h + '</div>';
  }
  // Después de guardar: fiesta, y cómo quedó Uku
  function doneRender() {
    var a = animo(), quedan = a.n, prog = G.ans.filter(function (x) { return x && x.prog; })[0];
    gel.innerHTML = confeti() + topHTML() +
      '<div class="pfm-game__end"><span class="pfm-game__burst" aria-hidden="true">' + face() + '</span><h2>' + T('¡Gracias!') + '</h2>' +
      '<p class="pfm-game__mood is-' + a.k + '"><span class="material-symbols-rounded" aria-hidden="true">' + MOOD_IC[a.k] + '</span>' +
        (G.antes !== a.k ? T('Uku pasó de {a} a {b}', { a: T(MOOD[G.antes]), b: T(MOOD[a.k]) }) : T('Uku está {animo}', { animo: T(MOOD[a.k]) })) + '</p>' +
      (prog ? '<p>' + T('Programaste la mesada a {n}: {m} cada día {d}.', { n: corto(prog.it.m.cp).split(' ')[0], m: money0(prog.it.m.monto), d: prog.it.m.dia }) + '</p>' : '') +
      '<p>' + (quedan ? T(quedan === 1 ? 'Queda 1 consumo por clasificar.' : 'Quedan {n} consumos por clasificar.', { n: quedan }) : T('Todo está clasificado.')) + '</p>' +
      '<div class="pfm-game__foot">' + (quedan ? '<button class="pf-cta" data-g="more">' + T('Clasificar {n} más', { n: Math.min(TANDA, quedan) }) + '</button>' +
        '<button class="section__link" data-g="close">' + T('Volver a Mis finanzas') + '</button>' : '<button class="pf-cta" data-g="close">' + T('Volver a Mis finanzas') + '</button>') + '</div></div>';
    fx('success');
  }
  function gameKey(k, btn) {
    var p = k.split(':'), it = G && G.list[G.i];
    switch (p[0]) {
      case 'close': return gameClose();
      case 'stop': case 'result': G.view = 'result'; fx('select'); return gameRender();
      case 'resume': case 'cards': G.view = 'card'; return gameRender();
      case 'all': G.view = 'all'; fx('tap'); return gameRender();
      case 'back': { var j = G.i - 1; while (j > 0 && G.ans[j] && G.ans[j].auto) j--; if (j >= 0) { G.i = j; G.ans[j] = null; fx('tap'); gameRender(); } return; }
      case 'later': G.ans[G.i] = null; G.i++; fx('tap'); return gameRender();
      case 'opt': case 'cat': {
        if (!it) return;
        var v = p.slice(1).join(':');
        G.ans[G.i] = { it: it, v: v, monto: it.t === 'q' ? it.q.total : -it.r.m };
        document.dispatchEvent(new CustomEvent('uku:clasificado', { detail: { restan: G.list.length - G.ans.filter(Boolean).length } }));
        if (sugDe(it)) { G.tries++; if (sugDe(it) === k) G.hits++; }
        // ¿Hay más pagos sin ordenar a la misma tienda o persona?
        var otros = it.t === 'r' && !it.cash && !/^tú|^Pichibank$/.test(it.r.cp) ? items().filter(function (x) {
          return x.t === 'r' && x.r.cp === it.r.cp && x.r.i !== it.r.i && !G.ans.some(function (a) { return a && a.it.t === 'r' && a.it.r.i === x.r.i; });
        }) : [];
        G.view = 'card';
        return elegir(btn, function () { G.i++; if (otros.length) { G.view = 'rule'; G.rule = { cp: it.r.cp, v: v, list: otros }; } gameRender(); });
      }
      case 'mes': {
        if (!it) return;
        G.ans[G.i] = { it: it, v: p[1], monto: it.m.monto };
        document.dispatchEvent(new CustomEvent('uku:clasificado', { detail: { restan: G.list.length - G.ans.filter(Boolean).length } }));
        return elegir(btn, function () { if (p[1] === 'mesada') G.view = 'prog'; else G.i++; gameRender(); });
      }
      // "Programar" pasa primero por la confirmación; sólo "Sí, programar" la activa
      case 'prog':
        if (p[1] === 'si') { G.view = 'progconf'; fx('tap'); return gameRender(); }
        if (p[1] === 'back') { G.view = 'prog'; fx('tap'); return gameRender(); }
        G.ans[G.i].prog = p[1] === 'ok'; G.i++; G.view = 'card'; fx(p[1] === 'ok' ? 'success' : 'tap'); if (p[1] === 'ok') G.cheer = T('¡Programada!'); return gameRender();
      case 'rule': {
        var R = G.rule; G.view = 'card';
        if (p[1] === 'si') {
          G.rules[R.cp] = R.v;
          R.list.forEach(function (x) {
            var j = G.list.indexOf(G.list.filter(function (y) { return y.t === 'r' && y.r.i === x.r.i; })[0]);
            if (j >= 0) G.ans[j] = { it: G.list[j], v: R.v, monto: -x.r.m, auto: 1 }; else G.extra.push({ r: x.r, v: R.v });
          });
          G.cheer = T(R.list.length === 1 ? '¡+1 de un toque!' : '¡+{n} de un toque!', { n: R.list.length }); fx('success');
        } else fx('tap');
        return gameRender();
      }
      case 'save': {
        var C = ST.cats[ST.u] || (ST.cats[ST.u] = {});
        G.ans.forEach(function (a) {
          if (!a) return;
          if (a.it.t === 'q') resp()[a.it.q.k] = a.v;
          else if (a.it.t === 'm') setMesada(a.it.m, { v: a.v, prog: a.prog ? { dia: a.it.m.dia, monto: a.it.m.monto } : null });
          else C[a.it.r.i] = a.v;
        });
        G.extra.forEach(function (e) { C[e.r.i] = e.v; });
        Object.keys(G.rules).forEach(function (cp) { ((ST.rules || (ST.rules = {}))[ST.u] = ST.rules[ST.u] || {})[cp] = G.rules[cp]; });
        persist(); cache = {}; fijoCache = {}; G.view = 'done'; return gameRender();
      }
      case 'more': return gameOpen();
    }
  }

  /* ---------- 3. En qué se va tu plata ---------- */
  /* Como Salud de Apple: eliges el periodo, ves una cifra grande y la
     gráfica; tocas una barra y la cifra cambia a ese día o mes. Debajo, lo
     destacado (frases cortas con su comparación) y en qué grupos se fue. */
  var PER = [['sem', 'Semana'], ['mes', 'Mes'], ['6m', '6 meses'], ['ano', 'Año']];
  function mesesAtras(n) { var a = HOY.slice(0, 7), out = [a]; for (var i = 1; i < n; i++) { a = prevMes(a); out.unshift(a); } return out; }
  function per() {
    var m = HOY.slice(0, 7), pm = prevMes(m), d = +HOY.slice(8, 10);
    switch (ST.per) {
      case 'sem': return { o: range(addDays(HOY, -6), HOY), l: T('en los últimos 7 días') };
      case '6m': return { o: range(mesesAtras(6)[0] + '-01', HOY), meses: 6, l: T('en los últimos 6 meses') };
      case 'ano': return { o: range(mesesAtras(12)[0] + '-01', HOY), meses: 12, l: T('en los últimos 12 meses') };
      default: ST.per = 'mes'; return { o: month(m), m: m, cur: true, prev: month(pm, d), l: T('este mes'), lp: T('{mes} a esta altura', { mes: mesName(pm) }) };
    }
  }
  var INI = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  function anio(f) { return f.slice(0, 4) === HOY.slice(0, 4) ? '' : ' ' + f.slice(0, 4); }
  // Las barras del periodo: un gasto por día (semana, mes) o por mes (6 meses, año)
  function serie() {
    var b = [], m = HOY.slice(0, 7);
    if (ST.per === 'sem') for (var i = 6; i >= 0; i--) { var f = addDays(HOY, -i); b.push({ f: f, v: range(f, f).gast, x: '<b>' + (i ? DIA[wday(f)].slice(0, 3) : T('Hoy')) + '</b><small>' + +f.slice(8, 10) + '</small>', t: (i ? DIA1[wday(f)] : T('Hoy')) + ' ' + dshort(f) }); }
    else if (ST.per === 'mes') for (var dd = 1; dd <= diasMes(m); dd++) { var g = m + '-' + pad(dd); b.push({ f: g, v: g > HOY ? null : range(g, g).gast, x: dd === 1 || dd % 7 === 1 ? String(dd) : '', t: DIA1[wday(g)] + ' ' + dshort(g) }); }
    else mesesAtras(ST.per === '6m' ? 6 : 12).forEach(function (k) { b.push({ v: month(k).gast, x: Mes(k).charAt(0), t: Mes(k) + anio(k + '-01') + (isCur(k) ? ' · ' + T('hasta hoy') : ''), cur: isCur(k) }); });
    return b;
  }
  function tope(v) { var p = Math.pow(10, Math.floor(Math.log10(v || 1))); return [1, 2, 2.5, 5, 10].map(function (f) { return f * p; }).filter(function (x) { return x >= v; })[0]; }
  var BAR = null;
  function chartHTML(P) {
    var b = serie(), meses = ST.per === '6m' || ST.per === 'ano', plan = meses && hayPres() ? pres().general : 0;
    var top = tope(Math.max.apply(null, b.map(function (x) { return x.v || 0; }).concat([plan, 50])));
    var sel = BAR != null && b[BAR] && b[BAR].v != null ? b[BAR] : null, head;
    if (sel) head = [meses ? T('Gasto del mes') : T('Gasto del día'), money(sel.v), sel.t];
    else if (meses) {
      var llenos = b.filter(function (x) { return !x.cur; }), avg = llenos.length ? sumv(llenos, function (x) { return x.v; }) / llenos.length : 0;
      head = [T('Promedio mensual'), money(avg), mesesAtras(b.length).map(function (k, i, a) { return i === 0 || i === a.length - 1 ? mesName(k).slice(0, 3) + anio(k + '-01') : null; }).filter(Boolean).join(' – ') + ' ' + HOY.slice(0, 4)];
    } else head = [T('Total'), money(P.o.gast), (ST.per === 'sem' ? dshort(addDays(HOY, -6)) : '1 ' + mesName(HOY.slice(0, 7)).slice(0, 3)) + ' – ' + dshort(HOY) + ' ' + HOY.slice(0, 4)];
    var y = function (v) { return (v / top * 100).toFixed(1) + '%'; };
    return '<div class="pfm-chart__head"><p class="pfm-chart__l">' + head[0] + '</p><p class="pfm-chart__v">' + head[1] + '</p><p class="pfm-chart__r">' + esc(head[2]) + '</p></div>' +
      '<div class="pfm-chart' + (sel ? ' has-sel' : '') + '" role="group" aria-label="' + T('Gráfica de gastos') + '"><div class="pfm-chart__plot">' +
        [0, .5, 1].map(function (f) { return '<span class="pfm-chart__g" style="bottom:' + f * 100 + '%"><em>' + money0(top * f).replace(/,\d+$/, '') + '</em></span>'; }).join('') +
        (plan ? '<span class="pfm-chart__plan" style="bottom:' + y(plan) + '"><em>' + T('Presupuesto') + '</em></span>' : '') +
        '<div class="pfm-chart__bars' + (b.length > 12 ? ' is-thin' : '') + '">' + b.map(function (x, i) {
          // En la semana, cada barra lleva su cifra: así se leen los días chicos aunque uno concentre el gasto
          return x.v == null ? '<span class="pfm-chart__bar is-empty"></span>' : '<button class="pfm-chart__bar' + (sel === x ? ' is-on' : '') + '" data-pfm="bar:' + i + '" aria-label="' + esc(x.t + ': ' + money(x.v)) + '">' + (ST.per === 'sem' ? '<em style="bottom:' + y(x.v) + '">' + (x.v ? money0(x.v).replace(/,\d+$/, '').replace('$ ', '') : '0') + '</em>' : '') + '<i style="height:' + y(x.v) + '"></i></button>';
        }).join('') + '</div></div>' +
      '<div class="pfm-chart__x' + (ST.per === 'sem' ? ' is-days' : '') + '">' + b.map(function (x) { return '<span' + (sel === x ? ' class="is-on"' : '') + '>' + x.x + '</span>'; }).join('') + '</div></div>' +
      (meses ? '' : sel && sel.f ? diaHTML(sel) : '<p class="pfm-chart__hint">' + T('Toca un día para ver en qué gastaste.') + '</p>');
  }
  // Los gastos del día elegido, debajo de la gráfica
  function diaHTML(d) {
    var L = rows().filter(function (r) { var c = cls(r); return r.f === d.f && (c.k === 'gasto' || c.k === 'reembolso'); }).reverse(); // los reembolsos restan del total
    return '<div class="pf-mcard pfm-dia"><p class="pfm-dia__t">' + esc(d.t.charAt(0).toUpperCase() + d.t.slice(1)) + '<span>' + (L.length === 1 ? T('1 movimiento') : T('{n} movimientos', { n: L.length })) + '</span></p>' +
      (L.length ? L.slice(0, 6).map(txHTML).join('') : '<p class="pf-note">' + T('Este día no gastaste nada.') + '</p>') + '</div>';
  }
  function gastosHTML() {
    var P = per(), s = P.o, pr = pres(), mb = P.m && hayPres() ? pr : null, app = document.documentElement.classList.contains('app-uku');
    // En el asistente, arriba va el hallazgo de Uku sobre el periodo (wireframe «Mis gastos»): una frase con lo que cambió
    var H = app ? hallazgos(P.m || curMes()).filter(function (x) { return x.t && x.icon !== 'hourglass_top'; })[0] : null;
    var insight = H ? '<div class="pfm-insight"><span class="pfm-insight__ic"><span class="material-symbols-rounded" aria-hidden="true">lightbulb</span></span><p><b>' + H.t + '.</b>' + (H.s ? ' ' + H.s : '') + '</p></div>' : '';
    // El periodo queda fijo arriba: todo lo de abajo (gráfica, destacado, grupos) cambia con él
    var html = insight + '<div class="pfm-per"><section class="pf-sec pfm-flow"><div class="pf-sec__head"><h2>' + T('Cuánto gastaste') + '</h2><button class="section__link" data-pfm="alltx">' + T('Movimientos') + '</button></div></section>' +
      '<div class="pfm-tabs" role="tablist" aria-label="' + T('Periodo') + '">' + PER.map(function (x) {
        return '<button class="tab' + (ST.per === x[0] ? ' active' : '') + '" role="tab" aria-selected="' + (ST.per === x[0]) + '" data-pfm="per:' + x[0] + '">' + T(x[1]) + '</button>'; }).join('') + '</div>' +
      '<section class="pf-sec pfm-flow__body">' + chartHTML(P);
    if (mb) {
      var u = s.gast / mb.general, f = +HOY.slice(8, 10) / diasMes(P.m), left = mb.general - s.gast, pj = proyeccion(P.m), pu = pj / mb.general;
      html += '<div class="pfm-budget"><div class="pfm-bar"><i class="is-gast' + (u > 1 ? ' is-over' : '') + '" style="width:' + Math.min(100, u * 100).toFixed(1) + '%"></i>' +
        (pj > s.gast ? '<i class="is-proj' + (pu > 1 ? ' is-over' : '') + '" style="width:' + (Math.min(100, pu * 100) - Math.min(100, u * 100)).toFixed(1) + '%"></i>' : '') +
        '<em style="left:' + (f * 100).toFixed(1) + '%"></em></div>' +
        '<p class="pfm-budget__t"><span>' + (left >= 0 ? T('Te quedan <b>{m}</b> de {p}', { m: money0(left), p: money0(mb.general) }) : T('Llevas <b>{m}</b> más de {p}', { m: money0(-left), p: money0(mb.general) })) + '</span>' +
        '<button class="section__link" data-pfm="budgets">' + T('Presupuesto') + '</button></p>' +
        '<p class="pfm-budget__proj' + (pu > 1 ? ' is-over' : '') + '">' + T('A este ritmo cierras el mes en <b>{m}</b>', { m: money0(pj) }) + ' · ' +
          (pu > 1 ? T('{m} más de tu presupuesto', { m: money0(pj - mb.general) }) : T('te sobrarían {m}', { m: money0(mb.general - pj) })) + '</p></div>';
    } else if (P.m && !hayPres() && rows().length) {
      // Sin presupuesto solo se ve lo gastado, sin comparar; Uku propone armarlo
      html += '<p class="pfm-budget__t pfm-budget__t--sin"><span>' + T('Todavía no tienes presupuesto') + '</span><button class="section__link" data-pfm="pres">' + T('Armar mi presupuesto') + '</button></p>';
    }
    html += '</section>';
    // En qué grupos se fue, en el mismo periodo
    var ks = Object.keys(s.grupos).sort(function (a, b) { return (GRUPOS[a].gris ? 1 : 0) - (GRUPOS[b].gris ? 1 : 0) || s.grupos[b] - s.grupos[a]; });
    var max = Math.max.apply(null, ks.map(function (k) { return s.grupos[k]; }).concat([1])), nIt = items().length;
    html += '<section class="pf-sec pfm-groups"><div class="pf-sec__head"><h2>' + T('Categorías') + '</h2><button class="section__link" data-pfm="alltx">' + T('Movimientos') + '</button></div><p class="pf-sec__sub">' + T('Por grupo, {cuando}.', { cuando: P.l }) + '</p>' +
      '<div class="pf-mcard pfm-list">' + ks.map(function (g) {
        var b = mb && mb.cats[g], v = s.grupos[g], gris = GRUPOS[g].gris;
        var sub = gris ? (nIt ? T('No sabemos en qué fue · Clasifícalo') : T('Efectivo y lo que no tiene categoría')) : b ? (v > b ? T('{m} más de {p}', { m: money0(v - b), p: money0(b) }) : T('Te quedan {m} de {p}', { m: money0(b - v), p: money0(b) }))
          : P.meses ? T('unos {m} al mes', { m: money0(v / P.meses) }) : T('{pct} de tu gasto', { pct: pct(v / (s.gast || 1)) });
        return meter(gris && nIt ? 'game' : 'grupo:' + g, GRUPOS[g].ic, T(g), money(v), b ? v / b : v / max, gris ? 'gris' : b ? (v > b ? 'over' : v / b > +HOY.slice(8, 10) / diasMes(P.m) + .1 ? 'warn' : 'ok') : 'cat', sub);
      }).join('') + (!ks.length ? '<p class="pf-note">' + T('No hay gastos {cuando}.', { cuando: P.l }) + '</p>' : '') + '</div></section></div>';
    return html;
  }
  // Ingresos: ya no es un filtro de la pantalla, se ven en su hoja
  function ingSheet() {
    var m = curMes(), s = month(m), ks = Object.keys(s.inc).sort(function (a, b) { return s.inc[b] - s.inc[a]; }), mx = Math.max.apply(null, ks.map(function (k) { return s.inc[k]; }).concat([1]));
    showSheet('<h3>' + T('Tus ingresos') + '</h3><div class="pfm-tx__amt">' + money(s.ing) + '</div><p>' + T('Recibiste dinero en {mes}.', { mes: mesName(m) }) + '</p>' +
      '<div class="pf-mcard pfm-list">' + ks.map(function (k) { return meter('', ING_IC[k] || 'south_west', k, money(s.inc[k]), s.inc[k] / mx, 'in', T('{pct} de lo que entró', { pct: pct(s.inc[k] / (s.ing || 1)) })); }).join('') +
      (s.rin ? meter('game', 'help', T('Por revisar'), money(s.rin), s.rin / mx, 'gris', T('Dinero de personas: ¿qué fue? Ordénalo')) : '') +
      (!ks.length && !s.rin ? '<p class="pf-note">' + T('No recibiste dinero este mes.') + '</p>' : '') + '</div>');
  }
  // Fila de grupo: ícono como los productos de Inicio, nombre y monto, barra y una línea de contexto
  function meter(k, ic, name, val, p, tone, sub) {
    var tag = k ? 'button' : 'div';
    return '<' + tag + (k ? ' data-pfm="' + esc(k) + '"' : '') + ' class="pfm-row pf-meter--' + tone + '"><span class="pfm-row__ic material-symbols-rounded" aria-hidden="true">' + ic + '</span>' +
      '<span class="pfm-row__main"><span class="pfm-row__top"><b>' + esc(name) + '</b><span>' + val + '</span></span>' +
      '<span class="pfm-row__bar"><i style="width:' + Math.max(2, Math.min(100, p * 100)).toFixed(1) + '%"></i></span><small>' + sub + '</small></span></' + tag + '>';
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
    return '<section class="pf-sec pfm-foot"><p class="pf-note pfm-scope"><span class="material-symbols-rounded">visibility</span><span>' +
      (tobe() ? T('Uku ve Pichibank, Deuna y las tarjetas de otros bancos que conectaste. El efectivo no lo ve.') : T('Solo vemos lo que pasa por Pichibank y Deuna. El efectivo y las tarjetas de otros bancos no aparecen.')) +
      '</span></p><p class="pf-note">' + T('Datos ficticios de la Base de datos PFM, hasta el {f}.', { f: dshort(HOY) + ' ' + HOY.slice(0, 4) }) + '</p></section>';
  }

  function paint() {
    if (!pf) return;
    if (!DB) { scroll.innerHTML = '<header class="pf-head"><h1>Mis finanzas</h1></header><p class="pf-note" style="padding:0 24px">' + T('Cargando tus movimientos…') + '</p>'; load().then(paint); return; }
    var keep = window.scrollY;
    // Primero la salud financiera (Uku) y un resumen de gastos; al tocarlo, el detalle
    var body = vistaGastos === 'gastos'
      ? '<button class="pf-back" data-pfm="inicio"><span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>' + T('Mis finanzas') + '</button>' + gastosHTML() + dineroHTML()
      : (document.documentElement.classList.contains('app-uku') ? hubHTML() : resumenGastosHTML() + footHTML());
    scroll.innerHTML = '<header class="pf-head"><h1>' + (vistaGastos === 'gastos' ? T('Mis gastos') : 'Mis finanzas') + '</h1></header>' + body;
    window.scrollTo({ top: vistaGastos ? 0 : keep });
  }
  /* ---------- Hojas ---------- */
  var sheet, back;
  function showSheet(html, kind) {
    if (!sheet) {
      back = document.createElement('div'); back.className = 'as-sheet-back';
      sheet = document.createElement('div'); sheet.className = 'as-sheet pfm-sheet'; sheet.setAttribute('role', 'dialog');
      document.body.appendChild(back); document.body.appendChild(sheet);
      back.addEventListener('click', closeSheet);
      sheet.addEventListener('click', onClick);
    }
    sheet.classList.toggle('pfm-sheet--wiz', kind === 'wiz');
    sheet.innerHTML = '<div class="as-sheet__handle"></div>' + html; sheet.scrollTop = 0;
    if (!sheet.classList.contains('open')) fx('open');
    back.classList.add('open'); sheet.classList.add('open');
  }
  function closeSheet() { if (sheet) { back.classList.remove('open'); sheet.classList.remove('open'); } }
  function sheetOpen() { return sheet && sheet.classList.contains('open'); }

  function whoSheet() {
    showSheet('<h3>' + T('Versión') + '</h3><p>' + T('Cómo se comporta Uku con tus datos.') + '</p>' +
      '<p class="as-sheet__label">' + T('Versión') + '</p><div class="as-rows">' +
        '<button class="as-row as-row--btn" data-pfm="modo:mvp" aria-pressed="' + !tobe() + '"><span class="as-row__main"><b>MVP</b><small>' + T('Fase 1: solo Pichibank y Deuna, con reglas y sin IA. Hay más gastos por ordenar.') + '</small></span><span class="as-radio"></span></button>' +
        '<button class="as-row as-row--btn" data-pfm="modo:tobe" aria-pressed="' + tobe() + '"><span class="as-row__main"><b>To-be</b><small>' + T('La visión: Uku ordena casi todo, anticipa, ve tus otros bancos y analiza con IA.') + '</small></span><span class="as-radio"></span></button></div>' +
      '<button class="pf-link pf-link--block" data-pfm="reset">' + T('Borrar mis respuestas y presupuestos') + '</button>');
  }
  function insightsSheet() {
    var L = consejos();
    showSheet('<h3>' + T('Lo que te propone Uku') + '</h3><p>' + T('Lo que descubrió en tus movimientos de {mes}, con lo que puedes hacer.', { mes: mesName(curMes()) }) + '</p>' +
      '<div class="pfm-tips is-sheet">' + L.map(consejoHTML).join('') + '</div>' +
      (ST.oculto && ST.oculto[ST.u] && Object.keys(ST.oculto[ST.u]).length ? '<button class="pf-link pf-link--block" data-pfm="verluego">' + T('Ver lo que dejé para después') + '</button>' : ''));
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
        return '<div class="pfm-debt"><span class="material-symbols-rounded pfm-ic">' + x.ic + '</span><span class="pfm-debt__main"><b>' + esc(x.n) + '</b><small>' + dshort(x.f) + ' · ' + (dd <= 1 ? T('mañana') : T('en {n} días', { n: dd })) + (hecho('pago:' + x.n) ? ' · ' + T('Programado') : '') + '</small></span>' +
          '<span class="pfm-debt__val"><b>' + (x.aprox ? '≈ ' : '') + money(x.monto) + '</b></span></div>';
      }).join('') : '<p class="pf-note">' + T('Nada en los próximos 30 días.') + '</p>') + '</div>' +
      '<p class="pf-note">' + T('Los montos con ≈ cambian cada mes: tomamos el último pago.') + '</p>');
  }
  function scoreSheet() {
    var sc = SCORE[ST.u], p; if (!sc) return;
    p = (sc.v - 1) / 998;
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
        return '<button class="pf-catchip"' + (i === 0 ? ' aria-pressed="true"' : '') + ' data-pfm="ans:' + esc(x.k) + ':' + id + '">' + esc(OPT[id].l) + '</button>';
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
  // Lo que se programa, en una sola lista para que se vea antes de confirmar
  function progDetails(x) {
    return '<div class="pfm-confirm">' +
      '<div><small>' + T('Monto') + '</small><b>' + money0(x.monto) + '</b></div>' +
      '<div><small>' + T('Para') + '</small><b>' + esc(corto(x.cp)) + '</b></div>' +
      '<div><small>' + T('Cuándo') + '</small><b>' + T('Cada día {d} del mes', { d: x.dia }) + '</b></div>' +
      '<div><small>' + T('Desde') + '</small><b>' + esc(x.src) + '</b></div></div>';
  }
  // Confirmar antes de programar desde la hoja de la mesada
  function progSheet(cp) {
    var x = mesadas().filter(function (m) { return m.cp === cp; })[0]; if (!x) return closeSheet();
    showSheet('<h3>' + T('Confirma la programación') + '</h3><p>' + T('Revisa antes de activarla. Podrás dejarla desde el detalle de la mesada.') + '</p>' + progDetails(x) +
      '<button class="pf-cta" data-pfm="mesa:prog:' + esc(cp) + '">' + T('Sí, programar {m} cada día {d}', { m: money0(x.monto), d: x.dia }) + '</button>' +
      '<button class="pf-link pf-link--block" data-pfm="mesada:' + esc(cp) + '">' + T('Volver') + '</button>');
  }
  // Mesada: confirmar, clasificar todo de una y programarla
  function mesadaSheet(cp) {
    var x = mesadas().filter(function (m) { return m.cp === cp; })[0]; if (!x) return closeSheet();
    var st = mesOf(cp) || {}, mx = Math.max.apply(null, x.porMes.map(function (c) { return c.v; }).concat([1])), n = corto(cp).split(' ')[0], a = 'data-pfm="mesa:';
    showSheet('<h3>' + (st.v === 'mesada' ? T('Mesada a {n}', { n: corto(cp) }) : T('¿Es una mesada para {n}?', { n: n })) + '</h3>' +
      '<p>' + T('Le enviaste unos {m} cada mes durante {k} meses, casi siempre el día {d}, desde tu {src}.', { m: money0(x.monto), k: x.n, d: x.dia, src: x.src }) + '</p>' +
      '<span class="pfm-dcard__cmp pfm-mes__cmp">' + x.porMes.map(function (c, i) { return '<span class="pfm-dcard__row' + (i === x.porMes.length - 1 ? ' is-on' : '') + '"><small>' + esc(c.l) + '</small><b>' + (c.v ? money0(c.v) : '—') + '</b><i style="width:' + Math.max(2, c.v / mx * 100).toFixed(1) + '%"></i></span>'; }).join('') + '</span>' +
      (st.v !== 'mesada' ? '<p class="pf-note">' + T('Si es una mesada, la pongo en Familia, con todos los envíos de antes.') + '</p><button class="pf-cta" ' + a + 'ok:' + esc(cp) + '">' + T('Sí, es una mesada') + '</button><button class="pf-link pf-link--block" ' + a + 'no:' + esc(cp) + '">' + T('Es otra cosa') + '</button>'
        : st.prog ? '<p class="pfm-prog"><span class="material-symbols-rounded" aria-hidden="true">event_available</span>' + T('Programada: {m} cada día {d} desde tu {src}.', { m: money0(st.prog.monto), d: st.prog.dia, src: x.src }) + '</p><button class="pf-link pf-link--block" ' + a + 'unprog:' + esc(cp) + '">' + T('Dejar de programarla') + '</button>'
        : '<p class="as-sheet__label">' + T('Programarla') + '</p><p>' + T('Pichibank le envía {m} a {n} cada día {d}, sin que tengas que acordarte. Uku te avisa un día antes si no te alcanza.', { m: money0(x.monto), n: n, d: x.dia }) + '</p>' +
          '<button class="pf-cta" ' + a + 'ask:' + esc(cp) + '">' + T('Programar cada día {d}', { d: x.dia }) + '</button>'));
  }
  // Pagos repetidos a la misma tienda o persona: un toque los ordena todos y queda la regla
  function reglaSheet(cp) {
    var x = repetidos().filter(function (r) { return r.cp === cp; })[0]; if (!x) return closeSheet();
    var sg = x.sug && x.sug.cat, ops = OPCATS.slice().sort(function (a, b) { return (b[0] === sg) - (a[0] === sg); });
    showSheet('<h3>' + T('{n} pagos a {c}', { n: x.list.length, c: cp }) + '</h3><p>' + T('Suman {m}. ¿En qué grupo van? Los ordeno todos y recuerdo la regla para los próximos pagos.', { m: money(x.total) }) + '</p>' +
      '<div class="pf-sheet-list">' + x.list.slice(0, 4).map(function (it) { return txHTML(it.r); }).join('') + '</div>' +
      '<p class="as-sheet__label">' + T('Todos van a') + '</p><div class="pf-catchips">' + ops.map(function (c) {
        return '<button class="pf-catchip"' + (c[0] === sg ? ' aria-pressed="true"' : '') + ' data-pfm="regla:set:' + esc(c[0]) + ':' + esc(cp) + '">' + T(c[1]) + '</button>'; }).join('') + '</div>' +
      (x.sug ? '<p class="pf-note">' + T('Uku cree que es {g}: {why}', { g: etiqueta(sg), why: x.sug.why }) + '</p>' : ''));
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

  /* Arma tu presupuesto: si no lo tienes, Uku lo propone con tus datos y tú decides.
     1. Cuánto gastar al mes: como gastas hoy o ahorrando 10% o 20% de lo que recibes.
     2. Cómo repartirlo: lo fijo queda como está y lo flexible se ajusta al total.
     3. Lo que eso significa hoy: cuánto te queda al día hasta fin de mes. */
  var FIJO = ['Hogar', 'Compromisos', 'Salud y educación', 'Familia'], wiz = null;
  function planes() {
    var ing = ingresoMes(), p = prom(curMes(), 3), hoy = p ? round(p.gast * 1.05, 10) : round(month(curMes()).gast * 1.05, 10);
    var L = [{ id: 'hoy', t: T('Como gastas hoy'), v: hoy }, { id: 'a10', t: T('Ahorrar el 10%'), v: round(ing * .9, 10) }, { id: 'a20', t: T('Ahorrar el 20%'), v: round(ing * .8, 10) }];
    // Recomienda lo más cercano a tus hábitos que igual te deje ahorrar algo
    var rec = hoy <= ing * .9 ? 'hoy' : 'a10';
    L.forEach(function (x) { x.rec = x.id === rec; x.libre = r2(ing - x.v); });
    return { ing: ing, prom: p ? p.gast : month(curMes()).gast, grupos: p ? p.grupos : month(curMes()).grupos, L: L };
  }
  function repartir(total, grupos) {
    // Lo sin clasificar (efectivo, Deuna, transferencias) suele ser gasto que se puede mover: se ajusta con lo flexible
    var cats = {}, fijo = 0, flex = 0;
    Object.keys(grupos).forEach(function (k) { var v = grupos[k] || 0; if (FIJO.indexOf(k) >= 0) fijo += v; else flex += v; });
    var f = flex ? Math.max(.5, Math.min(1.05, (total - fijo) / flex)) : 1;
    PRES_G.forEach(function (k) { var v = grupos[k] || 0; if (v >= 20) cats[k] = round(v * (FIJO.indexOf(k) >= 0 ? 1 : f), 10); });
    return cats;
  }
  // Hoja del asistente: cabecera con el avance, cuerpo y pie fijo con las acciones
  function wizShell(paso, t, lead, body, back, next) {
    var enter = !wiz.shown || wiz.shown !== paso; wiz.shown = paso;
    var steps = [1, 2, 3].map(function (n) { return '<i' + (n <= paso ? ' class="is-on"' : '') + '></i>'; }).join('');
    return showSheet('<div class="pfm-wiz' + (enter ? ' is-enter' : '') + (paso ? '' : ' is-vacio') + '" data-paso="' + paso + '">' +
      '<header class="pfm-wiz__head">' + (paso ? '<div class="pfm-wiz__steps" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="' + paso + '" aria-label="' + T('Paso {n} de 3', { n: paso }) + '">' + steps + '</div>' +
        '<p class="pfm-wiz__kicker">' + T('Paso {n} de 3', { n: paso }) + '</p>' : '') + '<h3>' + t + '</h3>' + (lead ? '<p class="pfm-wiz__lead">' + lead + '</p>' : '') + '</header>' +
      '<div class="pfm-wiz__body">' + body + '</div>' +
      '<footer class="pfm-wiz__foot">' + back + next + '</footer></div>', 'wiz');
  }
  function wizBtn(k, l, sec) { return '<button class="' + (sec ? 'bp-button bp-button--secondary pfm-wiz__back' : 'pf-cta') + '" data-pfm="' + k + '">' + l + '</button>'; }
  // Barra de un plan: lo que gastarías, lo que ahorras y, si te pasas, lo que falta
  function planBar(v, ing) {
    var mx = Math.max(v, ing, 1), g = Math.min(v, ing) / mx * 100, a = Math.max(0, ing - v) / mx * 100, o = Math.max(0, v - ing) / mx * 100;
    return '<span class="pfm-plan__bar" aria-hidden="true"><i style="width:' + g.toFixed(1) + '%"></i>' + (a ? '<i class="is-save" style="width:' + a.toFixed(1) + '%"></i>' : '') + (o ? '<i class="is-over" style="width:' + o.toFixed(1) + '%"></i>' : '') + '</span>';
  }
  function presWizard(paso) {
    var P = planes();
    if (!wiz) { var r = P.L.filter(function (x) { return x.rec; })[0]; wiz = { plan: r.id }; }
    wiz.paso = paso || wiz.paso || 1;
    var plan = P.L.filter(function (x) { return x.id === wiz.plan; })[0];
    // Sin ingresos ni gastos todavía no hay con qué proponer
    if (P.ing < 1 && P.prom < 1) {
      wiz.shown = -1;
      return wizShell(0, T('Arma tu presupuesto'), T('Cuando recibas tu primer dinero y empieces a usar tu cuenta, te propongo un presupuesto con tus datos.'),
        '<div class="pfm-wiz__empty"><span class="material-symbols-rounded" aria-hidden="true">potted_plant</span><p>' + T('Tu bosque recién empieza. Volvemos a esto en unas semanas.') + '</p></div>', '', wizBtn('cerrar', T('Entendido')));
    }
    if (wiz.paso === 1) {
      draft = null;
      return wizShell(1, T('¿Cuánto quieres gastar al mes?'), T('Uku lo calcula con tus últimos tres meses. Lo puedes cambiar cuando quieras.'),
        '<div class="pfm-wiz__mes"><div><small>' + T('Recibes al mes') + '</small><b>' + money0(Math.round(P.ing)) + '</b></div><div><small>' + T('Gastas en promedio') + '</small><b>' + money0(Math.round(P.prom)) + '</b></div></div>' +
        '<div class="pfm-planes" role="radiogroup" aria-label="' + T('Cuánto gastar') + '">' + P.L.map(function (x) {
          var on = x.id === wiz.plan;
          return '<button class="pfm-plan" role="radio" aria-checked="' + on + '" aria-pressed="' + on + '" data-pfm="presw:plan:' + x.id + '">' +
            '<span class="pfm-plan__top"><b class="pfm-plan__t">' + esc(x.t) + '</b>' + (x.rec ? '<span class="bp-tag bp-tag--success">' + T('Recomendado') + '</span>' : '') + '<span class="as-radio"></span></span>' +
            '<span class="pfm-plan__m">' + money0(x.v) + '<small>' + T('al mes') + '</small></span>' + planBar(x.v, P.ing) +
            '<small class="pfm-plan__s' + (x.libre < 0 ? ' is-over' : '') + '">' + (x.libre >= 0 ? T('Ahorras {m} al mes · {a} al año', { m: money0(Math.round(x.libre)), a: money0(Math.round(x.libre * 12)) }) : T('Gastarías {m} más de lo que recibes', { m: money0(Math.round(-x.libre)) })) + '</small></button>'; }).join('') + '</div>',
        wizBtn('cerrar', T('Ahora no'), 1), wizBtn('presw:2', T('Siguiente')));
    }
    if (!draft) draft = { general: plan.v, cats: repartir(plan.v, P.grupos) };
    if (wiz.paso === 2) {
      var vis = PRES_G.filter(function (k) { return draft.cats[k] || P.grupos[k] >= 20; });
      var suma = sumv(Object.keys(draft.cats), function (k) { return draft.cats[k]; }), libre = draft.general - suma;
      var fijo = sumv(vis.filter(function (k) { return FIJO.indexOf(k) >= 0; }), function (k) { return draft.cats[k] || 0; }), mover = suma - fijo, tot = Math.max(draft.general, suma, 1);
      var fila = function (k) {
        var v = draft.cats[k] || 0, avg = Math.round(P.grupos[k] || 0), d = v - avg;
        return '<div class="pfm-reparto__row"><span class="pfm-reparto__ic material-symbols-rounded" aria-hidden="true">' + GRUPOS[k].ic + '</span>' +
          '<span class="pfm-reparto__main"><b>' + esc(T(k)) + '</b><small>' + T('Promedio {m}', { m: money0(avg) }) + (Math.abs(d) >= 10 ? ' · <em class="' + (d < 0 ? 'is-down' : 'is-up') + '">' + (d < 0 ? '−' : '+') + money0(Math.abs(d)) + '</em>' : '') + '</small></span>' +
          '<span class="pfm-stepper"><button data-pfm="bud:' + esc(k) + ':-10" aria-label="' + T('Bajar {g}', { g: T(k) }) + '"' + (v ? '' : ' disabled') + '><span class="material-symbols-rounded" aria-hidden="true">remove</span></button>' +
          '<b>' + (v ? money0(v) : '—') + '</b><button data-pfm="bud:' + esc(k) + ':10" aria-label="' + T('Subir {g}', { g: T(k) }) + '"><span class="material-symbols-rounded" aria-hidden="true">add</span></button></span></div>';
      };
      var grupo2 = function (t, s, ks) { return ks.length ? '<section class="pfm-reparto"><h4>' + t + '<small>' + s + '</small></h4>' + ks.map(fila).join('') + '</section>' : ''; };
      var seg = function (v, c) { return v > 0 ? '<i class="' + c + '" style="width:' + (v / tot * 100).toFixed(1) + '%"></i>' : ''; };
      return wizShell(2, T('Así lo repartiría'), T('Lo fijo queda como está. Lo que puedes mover se ajusta a tu total.'),
        '<div class="pfm-wiz__sum"><div class="pfm-wiz__sumtop"><small>' + T('Tu presupuesto') + '</small><b>' + money0(draft.general) + '<small>' + T('al mes') + '</small></b></div>' +
          '<span class="pfm-wiz__stack" aria-hidden="true">' + seg(fijo, 'is-fijo') + seg(mover, 'is-mover') + seg(Math.max(0, libre), 'is-libre') + '</span>' +
          '<span class="pfm-wiz__legend"><span><i class="is-fijo"></i>' + T('Fijo') + ' ' + money0(fijo) + '</span><span><i class="is-mover"></i>' + T('Para mover') + ' ' + money0(mover) + '</span>' + (libre > 0 ? '<span><i class="is-libre"></i>' + T('Libre') + ' ' + money0(libre) + '</span>' : '') + '</span></div>' +
        grupo2(T('Lo fijo'), T('Tu casa, tus deudas y lo que no cambia'), vis.filter(function (k) { return FIJO.indexOf(k) >= 0; })) +
        grupo2(T('Lo que puedes mover'), T('Aquí está tu margen para ahorrar'), vis.filter(function (k) { return FIJO.indexOf(k) < 0; })) +
        '<p class="pfm-wiz__callout' + (libre < 0 ? ' is-over' : '') + '"><span class="material-symbols-rounded" aria-hidden="true">' + (libre < 0 ? 'error' : 'info') + '</span><span>' +
          (libre < 0 ? T('Los grupos suman {d} más que tu total. Baja alguno para que cuadre.', { d: money0(-libre) }) : libre > 0 ? T('Quedan {r} para lo que aún no está clasificado.', { r: money0(libre) }) : T('Todo tu presupuesto está repartido.')) + '</span></p>' +
        (animo().n ? '<button class="pf-link pfm-wiz__more" data-pfm="game"><span class="material-symbols-rounded" aria-hidden="true">category</span>' + T('Clasificar mis gastos para repartir mejor') + '</button>' : ''),
        wizBtn('presw:1', T('Atrás'), 1), wizBtn('presw:3', T('Siguiente')));
    }
    var m = curMes(), g = month(m).gast, hoy = +HOY.slice(8, 10), dias = diasMes(m) - hoy + 1, queda = draft.general - g, aho = Math.round(P.ing - draft.general);
    var u = Math.min(100, g / Math.max(1, draft.general) * 100), f = hoy / diasMes(m) * 100;
    var acomp = [['notifications_active', T('Te aviso cuando llegues al 80% de un grupo')], ['calendar_month', T('Cada lunes te cuento cómo vas')], ['tune', T('Lo puedes cambiar cuando quieras')]];
    return wizShell(3, T('Tu presupuesto está listo'), '',
      '<div class="pfm-wiz__hero"><small>' + T('Gastarás hasta') + '</small><b>' + money0(draft.general) + '<small>' + T('al mes') + '</small></b>' +
        '<span class="pfm-wiz__prog' + (queda <= 0 ? ' is-over' : '') + '" aria-hidden="true"><i style="width:' + u.toFixed(1) + '%"></i><em style="left:' + f.toFixed(1) + '%"></em></span>' +
        '<span class="pfm-wiz__progl"><span>' + T('En {mes} llevas {m}', { mes: mesName(m), m: '<b>' + money0(Math.round(g)) + '</b>' }) + '</span><span>' + (queda > 0 ? T('Te quedan {m}', { m: '<b>' + money0(Math.round(queda)) + '</b>' }) : T('Te pasaste por {m}', { m: '<b>' + money0(Math.round(-queda)) + '</b>' })) + '</span></span></div>' +
      '<div class="pfm-wiz__tiles">' +
        (queda > 0 ? '<div><small>' + T('Para gastar al día') + '</small><b>' + money0(queda / dias) + '</b><span>' + T('durante {d} días', { d: dias }) + '</span></div>' : '') +
        (aho > 0 ? '<div class="is-save"><small>' + T('Ahorrarías') + '</small><b>' + money0(aho) + '</b><span>' + T('al mes · {a} al año', { a: money0(aho * 12) }) + '</span></div>' : '') + '</div>' +
      '<section class="pfm-wiz__acomp"><h4>' + T('Uku te acompaña') + '</h4>' + acomp.map(function (x) { return '<p><span class="material-symbols-rounded" aria-hidden="true">' + x[0] + '</span>' + x[1] + '</p>'; }).join('') + '</section>',
      wizBtn('presw:2', T('Atrás'), 1), wizBtn('presw:save', T('Guardar presupuesto')));
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
  // Resumen de gastos del mes en el inicio: un toque lleva a gastos y sus gráficas
  var vistaGastos = null;
  // En el asistente, lo que puedes hacer desde Mis finanzas, a un toque
  function navHTML() {
    var a = animo(), pr = pres();
    var row = function (k, t, s) { return '<button class="pfm-nav__row" data-pfm="' + k + '"><span><b>' + t + '</b>' + (s ? '<small>' + s + '</small>' : '') + '</span><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>'; };
    var tile = function (k, ic, t, s) { return '<button class="pfm-tile" data-pfm="' + k + '"><span class="material-symbols-rounded" aria-hidden="true">' + ic + '</span><b>' + t + '</b><small>' + s + '</small></button>'; };
    return '<section class="pf-sec pfm-nav">' +
      '<div class="pfm-tiles">' + tile('gastos', 'bar_chart', T('Gastos'), T('Por semana, mes o año')) + tile('pres', 'speed', T('Presupuesto'), pr.general ? T('{m} al mes', { m: money0(pr.general) }) : T('Todavía no tienes uno')) + '</div>' +
      row('alltx', T('Movimientos'), T('Todo lo que entró y salió')) +
      (a.n ? row('game', T('Ordenar mis gastos'), T(a.n === 1 ? '1 consumo sin clasificar' : '{n} consumos sin clasificar', { n: a.n })) : '') +
      row('who', T('El mundo de Uku'), T('Qué significa cada cosa')) +
      '</section>';
  }
  /* La hoja de Mis finanzas en el asistente (el mundo de Uku va arriba): una cifra, una línea de estado,
     dos acciones y dos filas. Nada más en el primer pantallazo; los gráficos viven en Gastos. */
  function hubHTML() {
    var m = curMes(), s = month(m), g = s.gast, hay = hayPres(), p = hay ? pres().general : 0, pat = patrimonio(), vacio = !(DB.mov[ST.u] || []).length;
    var pe = hay ? presEstado(m) : null, u = hay && p ? Math.min(1, g / p) : 0, cls = !hay ? '' : pe.k === 'ok' ? 'is-ok' : 'is-warn';
    // Con presupuesto: la barra y lo que te queda. Sin presupuesto: solo lo gastado, sin comparar, y Uku propone armarlo.
    var pie = hay ? '<div class="pfm-hub__bar" aria-hidden="true"><i class="' + cls + '" style="width:' + (u * 100).toFixed(1) + '%"></i></div><p class="pfm-hub__s">' + (g > p ? T('Vas {m} por encima de tu presupuesto', { m: money(g - p) }) : T('Te queda de tu presupuesto: {m}', { m: money(p - g) })) + '</p>'
      : vacio ? '<p class="pfm-hub__s">' + T('Cuando uses tu cuenta, aquí verás en qué se va tu dinero.') + '</p>'
      : '<p class="pfm-hub__s pfm-hub__s--pres"><span>' + T('Todavía no tienes presupuesto') + '</span><button class="section__link" data-pfm="pres">' + T('Armar mi presupuesto') + '</button></p>';
    // Una sección fija (sin scroll ni asa): el gasto del mes (abre Mis gastos), lo que Uku recomienda y tu dinero en el banco
    return '<section class="pf-sec pfm-hub">' +
      '<div class="pfm-hub__card pfm-hub__hero" role="button" tabindex="0" data-pfm="gastos"><h3 class="pfm-hub__h">' + T('Gastaste en {mes}', { mes: mesName(m).toLowerCase() }) + '</h3>' +
      '<b class="pfm-hub__m" data-v="' + g + '">' + money(g) + '</b>' + pie + '</div>' +
      '<div class="pfm-hub__list"><div class="pfm-hub__slot"></div>' +
      '<button class="pfm-hub__dinero" data-pfm="dinero"><span class="material-symbols-rounded pfm-hub__act-ic" aria-hidden="true">account_balance_wallet</span><span class="pfm-hub__act-t"><b>' + T('Mi dinero en Pichibank') + '</b>' +
      '<small>' + T('Tienes {a} · Debes {d}', { a: money(pat.tienes), d: money(pat.debes) }) + '</small></span><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button></div>' +
      '</section>';
  }
  function hubSec(t, sub, k, l, rows) { return '<div class="pfm-hub__label"><div><h3>' + t + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (k ? '<button class="pfm-hub__link" data-pfm="' + k + '">' + l + '</button>' : '') + '</div><div class="pfm-hub__card">' + rows.join('') + '</div>'; }
  function hubRow(k, icon, t, sm, right, extra) { return '<button class="pfm-hub__row" data-pfm="' + k + '"><span class="pfm-hub__ic"><span class="material-symbols-rounded" aria-hidden="true">' + icon + '</span></span><span class="pfm-hub__pl"><b>' + t + '</b>' + (sm ? '<small>' + sm + '</small>' : '') + (extra || '') + '</span>' + right + '</button>'; }
  // Tus gastos por grupo: los tres que más pesan este mes, con su barra proporcional
  function hubGruposHTML(s, m) {
    var G = Object.keys(s.grupos || {}).filter(function (k) { return GRUPOS[k] && !GRUPOS[k].gris && s.grupos[k] > 0; })
      .sort(function (x, y) { return s.grupos[y] - s.grupos[x]; }).slice(0, 3);
    if (!G.length) return '';
    var max = s.grupos[G[0]];
    return hubSec(T('Gastos por grupo'), T('Lo que más pesa en {mes}', { mes: mesName(m).toLowerCase() }), 'gastos', T('Ver todo'), G.map(function (k) {
      return hubRow('gastos', GRUPOS[k].ic, esc(T(k)), null, '<em>' + money0(s.grupos[k]) + '</em>', '<i class="pfm-hub__gbar" aria-hidden="true"><u style="width:' + (s.grupos[k] / max * 100).toFixed(0) + '%"></u></i>');
    }));
  }
  // Pagos que vienen en los próximos quince días
  function hubPagosHTML() {
    var fs = facturas().filter(function (x) { return diasA(x.f) >= 0 && diasA(x.f) <= 15; }).sort(function (x, y) { return x.f.localeCompare(y.f); }).slice(0, 3);
    if (!fs.length) return '';
    return hubSec(T('Pagos que vienen'), T('En los próximos 15 días'), 'bills', T('Ver todos'), fs.map(function (x) {
      return hubRow('bills', x.ic, esc(x.n), cuandoTxt(x.f) + (x.aprox ? ' · ' + T('aproximado') : ''), '<em>' + money0(x.monto) + '</em>');
    }));
  }
  // Los últimos tres movimientos, con acceso al detalle
  function hubUltimosHTML() {
    var R = rows().slice().sort(function (x, y) { return y.f.localeCompare(x.f) || y.i - x.i; }).slice(0, 3);
    if (!R.length) return '';
    return hubSec(T('Últimos movimientos'), null, 'alltx', T('Ver todos'), R.map(function (r) {
      var c = cls(r), icon = (c.cat && CAT[c.cat]) || (r.m > 0 ? 'south_west' : 'receipt_long');
      return hubRow('tx:' + r.i, icon, esc(desc(r)), dshort(r.f) + (c.cat ? ' · ' + esc(T(c.cat)) : ''), '<em' + (r.m > 0 ? ' class="is-in"' : '') + '>' + (r.m > 0 ? '+' : '−') + money0(Math.abs(r.m)) + '</em>');
    }));
  }
  function resumenGastosHTML() {
    var s = month(curMes()), pr = pres(), g = s.gast, p = pr.general;
    var t = !p ? '' : g > p ? T('Excediste tu presupuesto por {m}', { m: money0(g - p) }) : T('Te quedan {m} de {p}', { m: money0(p - g), p: money0(p) });
    return '<section class="pf-sec pfm-resumen"><button class="pfm-resumen__card" data-pfm="gastos">' +
      '<span class="pfm-resumen__t">' + T('Gastaste este mes') + '</span>' +
      '<b class="pfm-resumen__m">' + money0(g) + '</b>' +
      (t ? '<span class="pfm-resumen__s">' + t + '</span>' : '') +
      '<span class="pfm-resumen__go">' + T('Ver en qué gastaste') + '<span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></span></button></section>';
  }
  function refresh() { cache = {}; fijoCache = {}; paint(); document.dispatchEvent(new Event('pfm:change')); }
  function key(k) {
    var p = k.split(':');
    switch (p[0]) {
      case 'who': return whoSheet();
      case 'dinero': return showSheet('<h3>' + T('Mi dinero en Pichibank') + '</h3>' + dineroHTML());
      case 'modo': if (ST.modo !== p[1]) { ST.modo = p[1]; persist(); fx('toggle'); refresh(); if (sheetOpen()) whoSheet(); } return;
      case 'u': if (ST.u !== p[1]) { ST.u = p[1]; persist(); fx('toggle'); refresh(); } closeSheet(); return;
      case 'reset': ST.resp[ST.u] = {}; ST.cats[ST.u] = {}; if (ST.hecho) delete ST.hecho[ST.u]; if (ST.oculto) delete ST.oculto[ST.u]; if (ST.rules) delete ST.rules[ST.u]; if (ST.mesadas) delete ST.mesadas[ST.u]; if (ST.presG) delete ST.presG[ST.u]; if (ST.seed) delete ST.seed[ST.u]; sembrar(ST.u); persist(); refresh(); closeSheet(); toast(T('Listo, volviste al inicio.')); return;
      case 'per': ST.per = p[1]; BAR = null; persist(); fx('select'); paint(); return;
      case 'gastos': vistaGastos = 'gastos'; BAR = null; fx('tap'); paint(); return;
      case 'inicio': vistaGastos = null; fx('tap'); paint(); return;
      case 'bar': BAR = BAR === +p[1] ? null : +p[1]; fx('tap'); paint(); return;
      case 'ing': return ingSheet();
      case 'debt': return deudasSheet();
      case 'net': return netSheet();
      case 'bills': return billsSheet();
      case 'score': return scoreSheet();
      case 'products': return productsSheet();
      case 'insights': return insightsSheet(-1);
      case 'world': return worldSheet();
      case 'ins': return insightsSheet();
      case 'cerrar': return closeSheet();
      // Consejos del asesor: programar (con confirmación), aplicar, deshacer o dejar para después
      case 'pagar': case 'tarjeta': case 'ahorro': { var cx = consejo(k === 'tarjeta' || k === 'ahorro' ? k : 'pago:' + p.slice(1).join(':')); if (cx) confirmar(cx); return; }
      case 'pres': wiz = null; draft = null; fx('open'); return presWizard(1);
      case 'presw': {
        if (p[1] === 'plan') { wiz.plan = p[2]; draft = null; fx('select'); return presWizard(1); }
        if (p[1] === 'save') { setPres(draft); setHecho('pres', HOY); var gen = draft.general; draft = null; wiz = null; closeSheet(); fx('success'); refresh(); document.dispatchEvent(new CustomEvent('uku:pres')); return toast(T('Listo: tu presupuesto es {m} al mes.', { m: money0(gen) }), 'deshacer:pres'); }
        fx('tap'); return presWizard(+p[1]);
      }
      case 'hecho': { if (/^ahorro/.test(p.slice(1).join(':'))) document.dispatchEvent(new CustomEvent('uku:ahorro')); var hid = p.slice(1).join(':'), hx = consejo(hid); setHecho(hid, HOY); closeSheet(); fx('success'); refresh(); return toast(hx && hx.ok ? hx.ok : T('Listo.'), 'deshacer:' + hid); }
      case 'deshacer': { var did = p.slice(1).join(':'); setHecho(did, null); if (did === 'pres' && ST.presG) { delete ST.presG[ST.u]; persist(); } fx('tap'); refresh(); if (sheetOpen()) insightsSheet(); return; }
      case 'luego': { var lid = p.slice(1).join(':'); ((ST.oculto || (ST.oculto = {}))[ST.u] = ST.oculto[ST.u] || {})[lid] = HOY; persist(); fx('tap'); refresh(); if (sheetOpen()) insightsSheet(); return toast(T('Lo dejo para después.'), 'verluego'); }
      case 'verluego': { if (ST.oculto) delete ST.oculto[ST.u]; persist(); refresh(); return insightsSheet(); }
      case 'mesada': return mesadaSheet(p.slice(1).join(':'));
      case 'mesa': {
        var mc = p.slice(2).join(':'), mx = mesadas().filter(function (m) { return m.cp === mc; })[0], st = mesOf(mc) || {};
        if (!mx) return;
        if (p[1] === 'ask') return progSheet(mc);
        if (p[1] === 'ok') { setMesada(mx, { v: 'mesada' }); fx('success'); toast(T('Listo: la mesada a {n} está en Familia.', { n: corto(mc).split(' ')[0] })); }
        if (p[1] === 'no') { setMesada(mx, { v: 'otra' }); closeSheet(); refresh(); return toast(T('Entendido, no es una mesada.')); }
        if (p[1] === 'prog') { setMesada(mx, { v: 'mesada', prog: { dia: mx.dia, monto: mx.monto } }); fx('success'); toast(T('Programada: {m} cada día {d}.', { m: money0(mx.monto), d: mx.dia })); }
        if (p[1] === 'unprog') { setMesada(mx, { v: 'mesada' }); toast(T('Ya no se enviará sola.')); }
        refresh(); return mesadaSheet(mc);
      }
      case 'regla': {
        if (p[1] !== 'set') return reglaSheet(p.slice(1).join(':'));
        var rv = p[2], rc = p.slice(3).join(':'), rx = repetidos().filter(function (r) { return r.cp === rc; })[0], C = ST.cats[ST.u] || (ST.cats[ST.u] = {});
        if (rx) rx.list.forEach(function (it) { C[it.r.i] = rv; });
        ((ST.rules || (ST.rules = {}))[ST.u] = ST.rules[ST.u] || {})[rc] = rv;
        persist(); fx('success'); closeSheet(); refresh();
        return toast(T('{n} pagos a {c} van a {g}. Lo recordaré.', { n: rx ? rx.list.length : 0, c: rc, g: etiqueta(rv) }));
      }
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
      case 'budgets': draft = null; wiz = null; return pres().auto ? presWizard(1) : budgetSheet();
      case 'bud': {
        if (p[1] === 'save') { setPres(draft); draft = null; closeSheet(); refresh(); fx('success'); return toast(T('Guardaste tu presupuesto.')); }
        if (p[1] === 'sug') { var sg = sugerido(curMes()); draft = { general: sg.general, cats: sg.cats }; fx('select'); return budgetSheet(); }
        var d = +p[2], id2 = p[1];
        if (id2 === 'general') draft.general = Math.max(50, draft.general + d);
        else { var v = Math.max(0, (draft.cats[id2] || 0) + d); if (v) draft.cats[id2] = v; else delete draft.cats[id2]; }
        fx('tick'); var st = sheet.scrollTop; if (wiz) presWizard(); else budgetSheet(); sheet.scrollTop = st; return;
      }
      case 'analyze': return analyze();
      case 'ai': return analyze(p.slice(1).join(':') || undefined);
      case 'go': { var gb = document.querySelector('#home-page [data-action="' + p.slice(1).join(':') + '"]'); if (gb) gb.click(); return; }
    }
  }
  function analyze(q) {
    // Con una pregunta concreta, Uku la responde en su tarjeta; sin pregunta, el análisis del mes (en el asistente, también como tarjeta)
    if (q && window.UkuAsistente && UkuAsistente.ia) { closeSheet(); return UkuAsistente.ia(q); }
    if (!window.UkuAnalisis) return;
    closeSheet();
    UkuAnalisis.open({ view: curMes(), ask: q });
  }

  /* ---------- Para Uku (análisis con IA y chat) ---------- */
  function pack(m) {
    m = m && /^\d{4}-\d{2}$/.test(m) ? m : curMes();
    var s = month(m), p = pres(), av = prom(m, 3), cur = isCur(m), md = mood(m);
    var over = Object.keys(p.cats).filter(function (k) { return (s.grupos[k] || 0) > p.cats[k]; }).map(function (k) { return { name: k, over: s.grupos[k] - p.cats[k], budget: p.cats[k] }; });
    var ins = feed(m).map(function (x) { return { icon: x.icon, kind: x.kind, title: x.t, sub: x.s, ask: x.ask }; });
    var hint = over.length ? T('Ojo con {cat}', { cat: over[0].name.toLowerCase() }) : s.gast > p.general ? T('Excediste tu presupuesto') : T('Vas dentro de tu presupuesto');
    return { key: m, mes: mesName(m), Mes: Mes(m), current: cur, report: false, n: { spend: s.gast, inc: s.ing, save: Math.max(0, r2(s.ing - s.gast)) }, ins: ins, over: over,
      top: Object.keys(s.grupos).sort(function (a, b) { return s.grupos[b] - s.grupos[a]; }).slice(0, 3).map(function (k) { return { name: k, v: s.grupos[k], p: s.grupos[k] / s.gast }; }),
      avg: av ? av.gast : s.gast, mood: md, moodLabel: MOOD[md], hint: hint, score: salud(m), card: null, goals: [], txCount: s.n };
  }
  /* Preguntas por grupo o categoría, con las palabras de la gente: «comida», «super», «uber», «luz»… */
  var SINON = [['Comida', /comida|aliment|restauran|supermerc|super\b|mercado|almuerz|cena|desayun|cafe|delivery|rappi|pedidos/], ['Hogar', /hogar|casa|arriendo|alquiler|vivienda|luz|agua|internet|servicios basicos|electric/],
    ['Movilidad', /movilidad|transporte|uber|taxi|bus|gasolina|combustible|carro|auto|parqueo|peaje/], ['Salud y educación', /salud|medic|farmacia|doctor|hospital|educaci|colegio|universidad|curso|escuela/],
    ['Gustos', /gustos|entreten|cine|netflix|spotify|suscripcion|compras|ropa|zapatos|tienda|juegos|salidas|bar|fiesta/], ['Familia', /familia|mesada|mama|papa|hijos|hija|hijo|abuel/], ['Compromisos', /compromisos|deudas|cuota|prestamo|tarjeta de otro|impuesto|sri|matricula/]];
  function grupoDe(s0) { for (var i = 0; i < SINON.length; i++) if (SINON[i][1].test(s0)) return SINON[i][0]; return null; }
  function mesDe(s0) { var m = curMes(); if (/mes pasado|anterior/.test(s0)) return prevMes(m); var i = MESES_N.findIndex(function (x) { return s0.indexOf(x) >= 0; }); return i >= 0 ? (m.slice(0, 4) + '-' + pad(i + 1) > m ? String(+m.slice(0, 4) - 1) : m.slice(0, 4)) + '-' + pad(i + 1) : m; }
  var MESES_N = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function topComercios(m, g, n) {
    var acc = {};
    rows().forEach(function (r) { if (r.mes !== m) return; var c = cls(r); if (c.k !== 'gasto' || grupo(c.cat) !== g) return; var k = corto(r.cp || r.desc || r.n); acc[k] = (acc[k] || 0) - r.m; });
    return Object.keys(acc).sort(function (a, b) { return acc[b] - acc[a]; }).slice(0, n).map(function (k) { return { l: k, v: r2(acc[k]) }; });
  }
  function answer(q) {
    if (!DB) return null;
    var s0 = norm(q), m = mesDe(s0), s = month(m), g = grupoDe(s0);
    // Cuánto gasté en comida / en el super / en uber…
    if (g && /gast|cuant|en que|fue|pague|pago/.test(s0) && !/presupuesto/.test(s0)) {
      var v = s.grupos[g] || 0, pv = month(prevMes(m)).grupos[g] || 0, d = pv ? (v - pv) / pv : 0, pg = pres().cats[g];
      return { title: T('{g} en {mes}', { g: g, mes: mesName(m) }), num: { v: money0(v), l: T('gastaste en {g}', { g: g.toLowerCase() }) },
        meter: pg ? { v: v, max: pg, l: T('{g} de {p} de presupuesto', { g: money0(v), p: money0(pg) }), cls: v > pg ? 'over' : isCur(m) && v > pg * .85 ? 'warn' : 'ok' } : null, // meses cerrados: solo dentro o te pasaste
        t: !v ? T('Este mes no tienes gastos en {g}.', { g: g.toLowerCase() }) : pv ? T(d > .05 ? 'Es {pct} más que en {mes}.' : d < -.05 ? 'Es {pct} menos que en {mes}.' : 'Casi igual que en {mes}.', { pct: pct(Math.abs(d)), mes: mesName(prevMes(m)) }) : T('Aquí va lo que más pesó.'),
        bars: topComercios(m, g, 4), s: ['¿En qué gasto más?', T('¿Cuánto me queda este mes?')], acts: [[T('Ver mis gastos'), 'gastos']] };
    }
    // Cuánto me queda / cuánto puedo gastar
    if (/me queda|puedo gastar|alcanza|hasta fin de mes/.test(s0)) {
      var saldo = sumv(saldos(), function (x) { return x.v; }), fac = facturas().filter(function (x) { return diasA(x.f) <= 30; }), comp = sumv(fac, function (x) { return x.monto; }), dias = diasMes(m) - +HOY.slice(8, 10) + 1, libre = saldo - comp;
      return { title: T('Lo que te queda'), num: { v: money0(Math.max(0, libre)), l: T('libres después de tus pagos') }, t: (fac.length ? T('Tienes {s} disponibles y {n} pagos por {c} en los próximos días.', { s: money0(saldo), n: fac.length, c: money0(comp) }) : T('Tienes {s} disponibles y ningún pago pendiente.', { s: money0(saldo) })) + ' ' + T('Son unos {d} al día hasta fin de mes.', { d: money0(Math.max(0, libre) / dias) }),
        bars: fac.slice(0, 3).map(function (x) { return { l: x.n, v: x.monto }; }), s: ['¿En qué gasto más?'], acts: [[T('Ver mis gastos'), 'gastos']] };
    }
    // Qué pagos tengo / qué vence
    if (/que pagos|pagos pendientes|que vence|proximos pagos|por pagar|que debo pagar/.test(s0)) {
      var fs = facturas().slice(0, 5);
      return { title: T('Tus próximos pagos'), t: fs.length ? T('Tienes {n} pagos en camino por {m}. Te aviso un día antes de cada uno.', { n: fs.length, m: money0(sumv(fs, function (x) { return x.monto; })) }) : T('No tienes pagos pendientes por ahora.'),
        rows: fs.map(function (x) { return [x.n + ' · ' + cuandoTxt(x.f), money0(x.monto)]; }), s: [T('¿Cuánto me queda este mes?')], acts: [[T('Ver mis pagos'), 'bills']] };
    }
    // Cuánto ahorré / me sobró
    if (/ahorr|me sobro|sobra/.test(s0) && !/meta/.test(s0)) {
      var sob = r2(s.ing - s.gast), c = colchon();
      return { title: T('Tu ahorro en {mes}', { mes: mesName(m) }), num: { v: money0(Math.max(0, sob)), l: sob >= 0 ? T('te sobró de lo que recibiste') : T('gastaste más de lo que recibiste') }, t: T('Lo que tienes en tus cuentas te alcanza para {n} meses de gasto.', { n: (Math.round(c * 10) / 10).toString().replace('.', ',') }) + ' ' + (c < 3 ? T('Con 3 meses tienes un buen respaldo.') : T('Es un buen respaldo.')),
        bars: [{ l: T('Recibiste'), v: s.ing }, { l: T('Gastaste'), v: s.gast }], s: ['¿En qué gasto más?'], acts: [[T('Separar un ahorro'), 'ahorro']] };
    }
    // Comparar con el mes pasado
    if (/mes pasado|comparad|que el mes|vs|versus|diferencia/.test(s0)) {
      m = curMes(); s = month(m); // comparar es siempre este mes contra el anterior
      var pm = prevMes(m), ps = month(pm, isCur(m) ? +HOY.slice(8, 10) : null), dd = s.gast - ps.gast;
      return { title: T('{a} contra {b}', { a: Mes(m), b: Mes(pm) }), num: { v: money0(Math.abs(dd)), l: T(dd > 0 ? 'más que en {mes} a esta altura' : 'menos que en {mes} a esta altura', { mes: mesName(pm) }) }, t: T('En {mes} llevas {a}; en {pm} a esta altura ibas en {b}.', { mes: mesName(m), a: money0(s.gast), pm: mesName(pm), b: money0(ps.gast) }),
        bars: [{ l: Mes(m), v: s.gast }, { l: Mes(pm), v: ps.gast }], s: ['¿En qué gasto más?'], acts: [[T('Ver mis gastos'), 'gastos']] };
    }
    s0 = q.toLowerCase();
    if (/revis|pregunt|no sabes/.test(s0)) {
      var qs = preguntas(m);
      return { t: qs.length ? T('Tengo {n} preguntas: {l}.', { n: qs.length, l: qs.slice(0, 3).map(function (x) { return corto(x.cp); }).join(', ') }) : T('No tengo nada por revisar.'), s: ['¿En qué gasto más?'] };
    }
    if (/deb|deuda|tarjeta|hipoteca/.test(s0)) {
      var d = deudas();
      return { t: tobe() ? T('Debes {monto} en total. En Pichibank son {bp}.', { monto: money(d.total), bp: money(d.totalBP) }) : T('En Pichibank debes {monto}. Las deudas de otros bancos no las veo.', { monto: money(d.totalBP) }), s: ['¿Cómo cierro el mes?'] };
    }
    if (/cierr|ritmo|termino|termina/.test(s0)) {
      var a = anticipa(m)[0];
      return { t: a && isCur(m) ? a.t + '. ' + a.s : T('En {mes} gastaste {monto}.', { mes: mesName(m), monto: money(s.gast) }), s: ['¿En qué gasto más?'] };
    }
    if (/ingres|gan|sueldo|pensi|remesa/.test(s0)) {
      return { t: T('En {mes} recibiste {monto} confirmados', { mes: mesName(m), monto: money(s.ing) }) + (s.rin ? T(', y {monto} de otras personas o cuentas.', { monto: money(s.rin) }) : '.'), s: ['¿Qué tengo por revisar?'] };
    }
    if (/presupuesto|limite|límite|tope/.test(s0) && isCur(m)) {
      var pz = pres(), dz = diasMes(m) - +HOY.slice(8, 10) + 1, qz = pz.general - s.gast;
      if (pz.auto) return { title: T('Tu presupuesto'), t: T('Todavía no tienes presupuesto. Te propongo cuánto gastar y cómo repartirlo, y tú decides.'), bars: [{ l: T('Recibes al mes'), v: Math.round(ingresoMes()) }, { l: T('Gastas en promedio'), v: Math.round((prom(m, 3) || s).gast) }], s: [], acts: [[T('Armar mi presupuesto'), 'pres']] };
      return { title: T('Tu presupuesto'), num: { v: money0(pz.general), l: T('al mes') }, meter: { v: s.gast, max: pz.general, l: T('llevas {g}', { g: money0(s.gast) }), cls: qz < 0 ? 'over' : qz < pz.general * .15 ? 'warn' : 'ok' },
        t: qz > 0 ? T('Te quedan {q}: unos {d} al día hasta fin de mes.', { q: money0(qz), d: money0(qz / dz) }) : T('Superaste tu presupuesto por {q}. ¿Lo revisamos?', { q: money0(-qz) }), s: ['¿En qué gasto más?'], acts: [[T('Ajustar mi presupuesto'), 'budgets']] };
    }
    if (/gast|plata|en qu|cuánto|cuanto|queda|presupuesto/.test(s0)) {
      var ks = Object.keys(s.grupos).sort(function (a, b) { return s.grupos[b] - s.grupos[a]; }).slice(0, 3);
      var pa = pres();
      return { title: T('En qué gastas más'), num: { v: money0(s.gast), l: T('gastaste en {mes}', { mes: mesName(m) }) },
        meter: pa.auto ? null : { v: s.gast, max: pa.general, l: T('{g} de {p} de presupuesto', { g: money0(s.gast), p: money0(pa.general) }), cls: s.gast > pa.general ? 'over' : isCur(m) && s.gast > pa.general * .85 ? 'warn' : 'ok' },
        t: ks.length ? T('Lo que más pesó fue {k}.', { k: ks[0].toLowerCase() }) + (pa.auto ? ' ' + T('Todavía no tienes presupuesto.') : '') : T('Este mes casi no has gastado.'),
        bars: ks.map(function (k) { return { l: k, v: s.grupos[k] }; }), s: ['¿Cómo cierro el mes?', '¿Qué tengo por revisar?'], acts: [[T('Ver mis gastos'), 'gastos']].concat(pa.auto ? [[T('Armar mi presupuesto'), 'pres']] : []) };
    }
    return null;
  }

  /* ---------- Arranque ---------- */
  function open() { mount(); paint(); if (window.__goView) window.__goView(1); }
  function init() {
    mount(); if (!pf) return;
    document.addEventListener('persona:change', function (e) { ST.u = e.detail; persist(); cache = {}; fijoCache = {}; paint(); });
    paint();
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetOpen()) { e.stopImmediatePropagation(); closeSheet(); } }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  /* Para el buscador universal del asistente: movimientos por texto o por monto, y las personas con
     las que te mueves dinero (transferencias), con cuántas veces y cuándo fue la última. */
  function buscar(q, n) {
    if (!DB) return [];
    var k = norm(String(q || '').trim()); if (k.length < 2) return [];
    var amt = /^\$?\s*\d+([.,]\d{1,2})?$/.test(k) ? parseFloat(k.replace(/[^\d.,]/g, '').replace(',', '.')) : null;
    return rows().filter(function (r) { return amt != null ? Math.abs(Math.abs(r.m) - amt) < .005 : (norm(desc(r)).indexOf(k) >= 0 || (r.cp && norm(r.cp).indexOf(k) >= 0)); })
      .sort(function (a, b) { return b.f.localeCompare(a.f); }).slice(0, n || 4)
      .map(function (r) { var c = cls(r); return { i: r.i, t: desc(r), f: dshort(r.f), m: r.m, src: r.src.replace(/ Pichibank/, ''), cat: c.cat || null, k: c.k }; });
  }
  function contactos(q) {
    if (!DB) return [];
    var k = norm(String(q || '').trim()), by = {};
    rows().forEach(function (r) {
      if (!/persona/i.test(r.c || '') || !r.cp || /^tú/i.test(r.cp) || /\b(s\.?a\.?|c[ií]a\.?|cci|ltda|corp|s\.a\.s)\b/i.test(r.cp)) return; // transferencias e ingresos de personas (no empresas)
      var x = by[r.cp] || (by[r.cp] = { n: r.cp, veces: 0, ult: r.f, enviado: 0 });
      x.veces++; if (r.f > x.ult) x.ult = r.f; if (r.m < 0) x.enviado += -r.m;
    });
    return Object.keys(by).map(function (n) { var x = by[n]; x.ultL = dshort(x.ult); return x; })
      .filter(function (x) { return !k || norm(x.n).indexOf(k) >= 0; }).sort(function (a, b) { return b.veces - a.veces; }).slice(0, 4);
  }
  window.PFM = { open: open, paint: paint, world: worldSignals, toast: toast, buscar: buscar, contactos: contactos,
    // Para la versión asistente: los consejos de Uku y un resumen de tu dinero
    advice: function () { return DB ? consejos() : []; },
    finanzas: function () { if (!DB) return null; var f = finanzas(); f.historia = historia(); f.sugerencias = consejos().filter(function (x) { return !x.done; }).length; return f; },
    perfil: function () { return DB ? perfil() : null; }, hayPres: function () { return DB ? hayPres() : false; },
    summary: function () { if (!DB) return null; var s = month(curMes()), a = animo(); return { nombre: nombre(), saldo: sumv(saldos(), function (x) { return x.v; }), gast: s.gast, pres: pres().general, mes: mesName(curMes()), n: a.n, mood: a.k, moodL: T(MOOD[a.k]), moodIc: MOOD_IC[a.k], score: salud(curMes()), bloom: flores() }; }, settings: function () { if (DB) whoSheet(); }, pack: pack, answer: answer, key: key, ready: function () { return !!DB; },
    modo: function () { return ST.modo; },
    // Para el sandbox (sin la pantalla de Mis finanzas): cargar los datos y cambiar de persona
    load: load, setPersona: function (id) { ST.u = id; persist(); cache = {}; fijoCache = {}; if (DB && !DB.mov[ST.u]) ST.u = 'andres'; } };
})();
