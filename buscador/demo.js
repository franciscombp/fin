/* =====================================================================
   Demo del buscador sobre la base de conocimiento (buscador/)
   Lo que entiende, en orden:
   1. Una frase con intención: «transferir 20 a juan», «pagar la luz»,
      «recargar 5 a mamá», «pagar tarjeta» → el flujo con los datos puestos.
   2. Tus atajos: acciones guardadas con sus datos, a un toque.
   3. Contactos: por nombre o alias, con Transferir (y Recargar si hay celular).
   4. Acciones de la base: van directo al flujo, sin pasar por las preguntas.
   5. Preguntas frecuentes y productos (la respuesta arriba si está clara).
   Los flujos son simulados: un formulario, Confirmar y un comprobante.
   ===================================================================== */
(function () {
  'use strict';
  var K = window.Conocimiento;
  var $ = function (s) { return document.querySelector(s); };
  var q = $('#q'), out = $('#out'), flujoEl = $('#flujo'), toast = $('#toast');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(v) { var s = Math.abs(+v || 0).toFixed(2).split('.'); return '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1]; }
  function norm(s) { return K.norm(s); }
  function aviso(t) { toast.textContent = t; toast.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { toast.classList.remove('on'); }, 2200); }

  /* ---------- Datos de la demo ---------- */
  var CUENTAS = ['Cuenta de ahorro ···4471 · $ 1.440,35', 'Ahorro flexible ···8801 · $ 1.400,00'];
  var TARJETAS = ['Mastercard Black ···7643'];
  var CONTACTOS = [
    { n: 'Juan Pérez', alias: 'Juan', banco: 'Pichibank', cuenta: '···2210', tel: '0991234567', veces: 12, ult: 'hace 3 días' },
    { n: 'María José Andrade', alias: 'Majo', banco: 'Pichibank', cuenta: '···8834', tel: '0987654321', veces: 9, ult: 'el viernes' },
    { n: 'Rosa Maldonado', alias: 'Mamá', banco: 'Pichibank', cuenta: '···1290', tel: '0998877665', veces: 20, ult: 'ayer' },
    { n: 'Carlos Andrade', alias: 'Carlos', banco: 'Banco Guayaquil', cuenta: '···5521', tel: '', veces: 3, ult: 'hace 2 semanas' },
    { n: 'Sofía Guerrero', alias: 'Sofi', banco: 'Produbanco', cuenta: '···7702', tel: '0993456789', veces: 5, ult: 'hace 1 semana' },
    { n: 'Diego Ramírez', alias: 'Diego', banco: 'Pichibank', cuenta: '···4409', tel: '0996543210', veces: 2, ult: 'hace 1 mes' },
    { n: 'Luis Paredes', alias: 'Lucho', banco: 'Banco del Pacífico', cuenta: '···3015', tel: '', veces: 1, ult: 'hace 3 meses' },
    { n: 'Ana Torres', alias: 'Anita', banco: 'Pichibank', cuenta: '···6603', tel: '0981112233', veces: 7, ult: 'hace 5 días' },
    { n: 'Valeria Loor', alias: 'Vale', banco: 'Pichibank', cuenta: '···9032', tel: '0984445566', veces: 4, ult: 'hace 10 días' },
    { n: 'Jorge Cevallos', alias: 'Jorge', banco: 'Banco Bolivariano', cuenta: '···1187', tel: '', veces: 2, ult: 'hace 2 meses' }
  ];
  var SERVICIOS = [
    [/\b(luz|electric|eeq|energia)/, 'Empresa Eléctrica Quito', 24.8], [/\b(agua|epmaps)/, 'EPMAPS Agua de Quito', 12.35], [/\b(internet|netlife|wifi)/, 'Netlife', 29.9],
    [/\bcnt\b/, 'CNT', 18], [/\b(tv|cable|directv)/, 'DirecTV', 35.5], [/\bgas\b/, 'Gas a domicilio', 3.5], [/\b(sri|impuesto|renta|iva)/, 'SRI', 86.4],
    [/\b(ant|matricula|multa|transito)/, 'ANT · Matriculación y multas', 142.1], [/\b(iess|aporte)/, 'IESS', 47.3], [/\b(colegio|universidad|escuela|pension)/, 'Colegio · pensión', 120],
    [/\bnetflix/, 'Netflix', 10.99], [/\bspotify/, 'Spotify', 5.99], [/\b(fundacion|donar|donacion)/, 'Fundación · donación', 0]
  ];
  var OPERADORAS = ['Claro', 'Movistar', 'CNT', 'Tuenti'];
  // Qué flujo abre cada acción de la base (las que no tienen flujo propio muestran sus pasos)
  var FLUJO_DE = { 'accion.pagar-sri': 'servicios', 'accion.pagar-matricula': 'servicios', 'accion.pagar-iess': 'servicios', 'accion.pagar-educacion': 'servicios', 'accion.donar': 'servicios', 'accion.pagar-servicios': 'servicios',
    'accion.transferir': 'transferir', 'accion.programar': 'transferir', 'accion.transferir-exterior': 'exterior', 'accion.pagar-tarjeta': 'tarjeta', 'accion.recargar': 'recargar',
    'accion.retirar': 'retirar', 'accion.retiro-tercero': 'retirar', 'accion.pagar-qr': 'qr', 'accion.cobrar-qr': 'qr', 'accion.bloquear-tarjeta': 'bloquear', 'accion.pagar-prestamo': 'prestamo' };
  var EJ = ['transferir 20 a juan', 'pagar tarjeta', 'recargar 5 a mamá', 'pagar la luz', 'bloquear tarjeta', 'me robaron la tarjeta', 'que es la cuenta joven'];

  /* ---------- Atajos (localStorage) ---------- */
  var AT_KEY = 'kbdemo_atajos_v1', atajos = [];
  try { atajos = JSON.parse(localStorage.getItem(AT_KEY)) || []; } catch (e) { atajos = []; }
  if (!atajos.length) atajos = [
    { id: 1, nombre: 'Mensualidad de Majo', accion: 'accion.transferir', datos: { contacto: 'María José Andrade', monto: 50 } },
    { id: 2, nombre: 'Luz de la casa', accion: 'accion.pagar-servicios', datos: { empresa: 'Empresa Eléctrica Quito', contrato: '1234567' } },
    { id: 3, nombre: 'Recarga a mamá', accion: 'accion.recargar', datos: { numero: '0998877665', operadora: 'Claro', monto: 5 } }];
  function guardarAtajos() { try { localStorage.setItem(AT_KEY, JSON.stringify(atajos)); } catch (e) {} }
  function subAtajo(a) { var d = a.datos || {}; return [K.entrada(a.accion).t, d.contacto || d.empresa || d.numero || '', d.monto ? money(d.monto) : ''].filter(Boolean).join(' · '); }

  /* ---------- Contactos ---------- */
  function dist1(a, b) { if (Math.abs(a.length - b.length) > 1) return false; var i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } d++; if (d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return d + (a.length - i) + (b.length - j) <= 1; }
  function contactos(texto, n) {
    var ws = norm(texto).split(' ').filter(function (w) { return w.length >= 3 && !/^\d/.test(w); });
    if (!ws.length) return [];
    return CONTACTOS.map(function (c) {
      var toks = norm(c.n + ' ' + c.alias).split(' '), sc = 0;
      ws.forEach(function (w) { toks.forEach(function (t) { if (t === w) sc += 3; else if (t.indexOf(w) === 0) sc += 2; else if (w.length >= 4 && dist1(w, t)) sc += 1; }); });
      return { c: c, sc: sc };
    }).filter(function (x) { return x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc || b.c.veces - a.c.veces; }).slice(0, n || 3).map(function (x) { return x.c; });
  }

  /* ---------- La frase hecha acción ---------- */
  var VERBOS = [[/^(transfer|envi|mand|pasa|deposit|gir|prest|pagale|pagarle)/, 'accion.transferir'], [/^recarg/, 'accion.recargar'], [/^(retir|sac)/, 'accion.retirar'], [/^cobr/, 'accion.cobrar-qr'], [/^(bloque|congel)/, 'accion.bloquear-tarjeta']];
  function intencion(texto) {
    var nq = norm(texto), ws = nq.split(' ').filter(Boolean), it = K.intencion(texto);
    var tel = (nq.match(/\b09\d{8}\b/) || [])[0] || null;
    var m = nq.replace(/\b09\d{8}\b/, '').match(/(?:^|\s)\$?\s*(\d+(?:[.,]\d{1,2})?)(?=\s|$)/), monto = m ? parseFloat(m[1].replace(',', '.')) : 0;
    var servicio = null; SERVICIOS.some(function (s) { if (s[0].test(nq)) { servicio = s; return true; } return false; });
    var operadora = OPERADORAS.filter(function (o) { return nq.indexOf(norm(o)) >= 0; })[0] || null;
    var primero = ws[0] || '', accionId = null;
    VERBOS.some(function (v) { if (v[0].test(primero) || (ws[1] && /^(quiero|necesito|hazme|dame)$/.test(primero) && v[0].test(ws[1]))) { accionId = v[1]; return true; } return false; });
    if (/^pag/.test(primero) || (ws[1] && /^pag/.test(ws[1]))) accionId = /tarjeta|mastercard|visa/.test(nq) ? 'accion.pagar-tarjeta' : servicio ? 'accion.pagar-servicios' : /prestamo|cuota/.test(nq) ? 'accion.pagar-prestamo' : /qr/.test(nq) ? 'accion.pagar-qr' : accionId;
    if (!accionId) {
      var kbA = K.buscar(texto, { tipo: 'accion', n: 1 })[0];
      if (kbA && (it.accion || nq === norm(kbA.t) || kbA.cobertura >= .99)) accionId = kbA.id;
    }
    // La persona: de los contactos, con las palabras que no son el verbo ni el monto
    var resto = ws.filter(function (w) { return !/^\d/.test(w) && !VERBOS.some(function (v) { return v[0].test(w); }) && !/^(pag|quiero|necesito|hazme|dame|plata|dinero|celular|tarjeta|saldo|para|por)/.test(w); }).join(' ');
    var quien = resto ? contactos(resto, 1)[0] || null : null;
    if (!accionId && quien && (monto || /\ba\b/.test(nq))) accionId = 'accion.transferir';
    if (accionId === 'accion.recargar' && quien && !quien.tel) quien = null;
    if (!accionId) return null;
    var e = K.entrada(accionId), datos = {};
    if (quien && accionId === 'accion.transferir') datos.contacto = quien.n;
    if (quien && accionId === 'accion.recargar') { datos.numero = quien.tel; datos.contacto = quien.n; }
    if (tel) datos.numero = tel;
    if (operadora) datos.operadora = operadora;
    if (monto) datos.monto = monto;
    if (servicio && FLUJO_DE[accionId] === 'servicios') datos.empresa = servicio[1];
    var nombre = e.t;
    if (accionId === 'accion.transferir') nombre = 'Transferir' + (monto ? ' ' + money(monto) : '') + (quien ? ' a ' + quien.n : '');
    else if (accionId === 'accion.recargar') nombre = 'Recargar' + (monto ? ' ' + money(monto) : '') + (quien ? ' a ' + quien.alias : tel ? ' al ' + tel : '');
    else if (accionId === 'accion.pagar-servicios' && servicio) nombre = 'Pagar ' + servicio[1];
    else if (accionId === 'accion.pagar-tarjeta' && monto) nombre = 'Pagar ' + money(monto) + ' a la tarjeta';
    var lleno = !!(datos.contacto || datos.monto || datos.empresa || datos.numero);
    return { accion: e, datos: datos, nombre: nombre, lleno: lleno, directo: !!accionId };
  }

  /* ---------- Vistas ---------- */
  var TIPO = { faq: 'Pregunta', producto: 'Producto', accion: 'Acción' };
  var abierta = null;
  function card(v) {
    return '<p class="label">' + (v.tipo === 'producto' ? 'Producto' : 'Respuesta') + '</p><section class="card answer"><h2>' + esc(v.t) + '</h2><p>' + esc(v.r) + '</p>' +
      (v.datos.length ? '<dl>' + v.datos.map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      '<div class="chips">' + v.acts.map(function (a) { return '<button class="chip" data-go="' + esc(a[1]) + '">' + esc(a[0]) + '</button>'; }).join('') + '</div>' +
      (v.fuente ? '<p class="src">Fuente: ' + esc(v.fuente) + '</p>' : '') + '</section>';
  }
  function fila(attr, icon, t, s, r) { return '<button class="row" ' + attr + '><span class="ic">' + esc(icon) + '</span><span class="main"><b>' + t + '</b>' + (s ? '<small>' + s + '</small>' : '') + '</span>' + (r ? '<span class="tag">' + esc(r) + '</span>' : '') + '</button>'; }
  function inicio() {
    var frec = CONTACTOS.slice().sort(function (a, b) { return b.veces - a.veces; }).slice(0, 4);
    return '<p class="label">Tus atajos</p><section class="card">' + atajos.map(function (a) { return fila('data-atajo="' + a.id + '"', 'bolt', esc(a.nombre), esc(subAtajo(a)), 'Atajo'); }).join('') +
      fila('data-nuevo-atajo', 'add', 'Grabar un atajo', 'Guarda una acción con sus datos y repítela con un toque') + '</section>' +
      '<p class="label">Contactos frecuentes</p><div class="chips">' + frec.map(function (c) { return '<button class="chip" data-q="transferir a ' + esc(c.alias.toLowerCase()) + '">' + esc(c.alias) + '</button>'; }).join('') + '</div>' +
      '<p class="label">Todo lo que puedes hacer</p><section class="card">' + fila('data-catalogo', 'apps', 'Todas las acciones', K.lista('accion').length + ' acciones de la banca móvil, por tema') + '</section>';
  }
  function catalogo() {
    var cats = K.categorias(), L = K.lista('accion');
    return '<p class="label">Todas las acciones</p>' + cats.map(function (c) {
      var xs = L.filter(function (x) { return x.cat === c.id; }); if (!xs.length) return '';
      return '<p class="label">' + esc(c.t) + '</p><section class="card">' + xs.map(function (x) { return fila('data-accion="' + x.id + '"', x.icon || 'bolt', esc(x.t), '', 'Acción'); }).join('') + '</section>';
    }).join('');
  }
  function render() {
    var t = q.value.trim();
    flujoEl.hidden = true; out.hidden = false;
    if (!K.cargada()) { out.innerHTML = '<p class="empty">Cargando la base…</p>'; return; }
    if (!t) { out.innerHTML = inicio(); abierta = null; return; }
    var html = '', ws = norm(t).split(' ').filter(function (w) { return w.length > 2; });
    // 1. La frase hecha acción
    var it = intencion(t);
    if (it && it.lleno) html += '<p class="label">Hacer ahora</p><section class="card">' + fila('data-hacer', it.accion.icon || 'bolt', esc(it.nombre), 'Abre el flujo con los datos puestos', 'Acción') + '</section>' +
      '<div class="chips"><button class="chip" data-guardar>Guardar como atajo</button></div>';
    // 2. Atajos
    var at = atajos.filter(function (a) { var s = norm(a.nombre + ' ' + subAtajo(a)); return ws.some(function (w) { return s.indexOf(w) >= 0; }); });
    if (at.length) html += '<p class="label">Tus atajos</p><section class="card">' + at.map(function (a) { return fila('data-atajo="' + a.id + '"', 'bolt', esc(a.nombre), esc(subAtajo(a)), 'Atajo'); }).join('') + '</section>';
    // 3. Contactos
    var cs = contactos(t, 3);
    if (cs.length) html += '<p class="label">Contactos</p><section class="card">' + cs.map(function (c) {
      return '<div class="row static"><span class="ic">person</span><span class="main"><b>' + esc(c.n) + '</b><small>' + esc(c.banco + ' ' + c.cuenta + ' · ' + c.veces + ' veces, la última ' + c.ult) + '</small></span>' +
        '<span class="acts"><button class="chip chip--go" data-transferir="' + esc(c.n) + '">Transferir</button>' + (c.tel ? '<button class="chip" data-recargar="' + esc(c.n) + '">Recargar</button>' : '') + '</span></div>';
    }).join('') + '</section>';
    // 4. Acciones de la base, directo al flujo
    var r = K.buscar(t, { n: 10 }), max = r.length ? r[0].s : 0;
    r = r.filter(function (x) { return x.s >= max * .3; });
    var acc = r.filter(function (x) { return x.tipo === 'accion' && !(it && it.lleno && x.id === it.accion.id); }).slice(0, 4);
    if (acc.length) html += '<p class="label">Acciones</p><section class="card">' + acc.map(function (x) { return fila('data-accion="' + x.id + '"', x.icon || 'bolt', esc(x.t), esc(x.e.r || ''), FLUJO_DE[x.id] ? 'Flujo' : 'Acción'); }).join('') + '</section>';
    // 5. Preguntas y productos: la respuesta clara arriba, el resto como filas
    var top = K.responder(t), v = abierta ? K.entrada(abierta) : (top && top.conf === 'alta' && top.tipo !== 'accion' && !(it && it.lleno) ? top : null);
    if (v) html += card(v);
    var resto = r.filter(function (x) { return x.tipo !== 'accion' && (!v || x.id !== v.id); }).slice(0, 5);
    if (resto.length) html += '<p class="label">' + (v ? 'También' : 'Preguntas y productos') + '</p><section class="card">' + resto.map(function (x) {
      return fila('data-id="' + esc(x.id) + '"', x.tipo === 'producto' ? 'inventory_2' : 'help', esc(x.t), esc(K.texto(x.e.r)).slice(0, 90) + '…', TIPO[x.tipo]);
    }).join('') + '</section>';
    if (!html) html = '<section class="card"><p class="empty">No encontré «' + esc(t) + '». Prueba con otras palabras, un contacto o una acción.</p></section>';
    out.innerHTML = html;
  }

  /* ---------- Flujos simulados ---------- */
  var FLUJOS = {
    transferir: { t: 'Transferir', campos: [['contacto', 'A quién', 'text', 'Nombre o número de cuenta', CONTACTOS.map(function (c) { return c.n; })], ['monto', 'Monto', 'number', '0,00'], ['cuenta', 'Desde', 'select', CUENTAS], ['motivo', 'Motivo (opcional)', 'text', 'Ej. Mensualidad']],
      ok: function (d) { return 'Transferiste ' + money(d.monto) + ' a ' + d.contacto + '. Llega al instante.'; } },
    exterior: { t: 'Transferir al exterior', campos: [['contacto', 'Beneficiario', 'text', 'Nombre completo'], ['pais', 'País', 'text', 'Ej. España'], ['swift', 'Código SWIFT del banco', 'text', 'Ej. BSCHESMM'], ['monto', 'Monto en dólares', 'number', '0,00'], ['cuenta', 'Desde', 'select', CUENTAS]],
      ok: function (d) { return 'Enviaste ' + money(d.monto) + ' a ' + d.contacto + '. Llega en 1 a 3 días hábiles; el ISD y el costo salen en el comprobante.'; } },
    tarjeta: { t: 'Pagar tarjeta', campos: [['tarjeta', 'Tarjeta', 'select', TARJETAS], ['monto', 'Monto', 'chips', [['Total · $ 420,00', 420], ['Mínimo · $ 25,00', 25], ['Otro', '']]], ['cuenta', 'Desde', 'select', CUENTAS]],
      ok: function (d) { return 'Pagaste ' + money(d.monto) + ' a tu ' + d.tarjeta + '. Se acredita al instante.'; } },
    recargar: { t: 'Recargar celular', campos: [['operadora', 'Operadora', 'select', OPERADORAS], ['numero', 'Número', 'tel', '09…'], ['monto', 'Monto', 'chips', [['$ 3', 3], ['$ 5', 5], ['$ 10', 10], ['Otro', '']]], ['cuenta', 'Desde', 'select', CUENTAS]],
      ok: function (d) { return 'Recargaste ' + money(d.monto) + ' al ' + d.numero + ' (' + d.operadora + '). Se acredita al instante.'; } },
    servicios: { t: 'Pagar servicios', campos: [['empresa', 'Empresa', 'select', SERVICIOS.map(function (s) { return s[1]; })], ['contrato', 'Número de contrato, cédula o placa', 'text', 'Ej. 1234567'], ['cuenta', 'Desde', 'select', CUENTAS]],
      ok: function (d) { var s = SERVICIOS.filter(function (x) { return x[1] === d.empresa; })[0]; return 'Pagaste ' + money(s ? s[2] : 0) + ' a ' + d.empresa + '. La empresa lo registra en hasta 24 horas.'; } },
    prestamo: { t: 'Pagar cuota del préstamo', campos: [['monto', 'Qué pagas', 'chips', [['Cuota · $ 245,90', 245.9], ['Abono a capital', '']]], ['cuenta', 'Desde', 'select', CUENTAS]],
      ok: function (d) { return 'Pagaste ' + money(d.monto) + ' a tu préstamo. Vas en la cuota 7 de 36.'; } },
    retirar: { t: 'Retirar sin tarjeta', campos: [['monto', 'Monto', 'chips', [['$ 20', 20], ['$ 50', 50], ['$ 100', 100], ['Otro', '']]], ['cuenta', 'Desde', 'select', CUENTAS]],
      ok: function (d) { return 'Tu código es ' + (100000 + Math.floor(Math.random() * 900000)) + ' por ' + money(d.monto) + '. Vale 30 minutos en cualquier cajero.'; } },
    qr: { t: 'Pagar con QR', campos: [['monto', 'Monto', 'number', '0,00'], ['cuenta', 'Desde', 'select', CUENTAS]],
      ok: function (d) { return 'Pagaste ' + money(d.monto) + '. En la app, antes de esto, la cámara lee el QR del comercio.'; } },
    bloquear: { t: 'Bloquear tarjeta', campos: [['tarjeta', 'Tarjeta', 'select', TARJETAS], ['tipo', 'Tipo de bloqueo', 'chips', [['Temporal', 'temporal'], ['Definitivo', 'definitivo']]]],
      ok: function (d) { return 'Tu ' + d.tarjeta + ' quedó con bloqueo ' + d.tipo + (d.tipo === 'definitivo' ? '. Te enviamos una nueva en 3 a 5 días hábiles.' : '. La desbloqueas cuando quieras.'); } }
  };
  var fl = null; // el flujo abierto: { accion, def, datos, modo: 'hacer' | 'atajo', paso }
  function abrirFlujo(accionId, datos, modo) {
    var e = K.entrada(accionId); if (!e) return;
    var def = FLUJOS[FLUJO_DE[accionId]];
    fl = { accion: e, def: def, datos: Object.assign({}, datos || {}), modo: modo || 'hacer', paso: 'form' };
    if (def) def.campos.forEach(function (c) { if (fl.datos[c[0]] == null && c[2] === 'select') fl.datos[c[0]] = c[3][0]; });
    if (def && FLUJO_DE[accionId] === 'servicios' && !fl.datos.contrato) fl.datos.contrato = '1234567';
    pintarFlujo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function campo(c) {
    var k = c[0], v = fl.datos[k];
    if (c[2] === 'select') return '<label class="fld"><span>' + esc(c[1]) + '</span><select data-f="' + k + '">' + c[3].map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>';
    if (c[2] === 'chips') return '<div class="fld"><span>' + esc(c[1]) + '</span><div class="chips">' + c[3].map(function (o) { var on = String(o[1]) !== '' && String(o[1]) === String(v); return '<button type="button" class="chip' + (on ? ' chip--on' : '') + '" data-chip="' + k + '" data-v="' + esc(o[1]) + '">' + esc(o[0]) + '</button>'; }).join('') + '</div>' +
      (k === 'monto' && !c[3].some(function (o) { return String(o[1]) !== '' && String(o[1]) === String(v); }) ? '<input type="number" inputmode="decimal" step="0.01" min="0" placeholder="Otro monto" data-f="monto" value="' + esc(v || '') + '">' : '') + '</div>';
    return '<label class="fld"><span>' + esc(c[1]) + '</span><input type="' + c[2] + '"' + (c[2] === 'number' ? ' inputmode="decimal" step="0.01" min="0"' : '') + ' placeholder="' + esc(c[3] || '') + '" data-f="' + k + '" value="' + esc(v == null ? '' : v) + '"' + (c[4] ? ' list="dl-' + k + '"' : '') + '>' +
      (c[4] ? '<datalist id="dl-' + k + '">' + c[4].map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>' : '') + '</label>';
  }
  function pintarFlujo() {
    out.hidden = true; flujoEl.hidden = false;
    var e = fl.accion, def = fl.def, h = '<button class="back" data-volver>← Volver</button>';
    if (!def) {
      h += '<section class="card answer"><h2>' + esc(e.t) + '</h2><p>' + esc(e.r) + '</p>' + (e.pasos.length ? '<ol>' + e.pasos.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol>' : '') +
        '<p class="src">En la app esto abre «' + esc(e.go) + '». Aquí es solo una demo.</p><div class="chips"><button class="chip chip--go" data-volver>Entendido</button></div></section>';
    } else if (fl.paso === 'form') {
      h += '<section class="card answer"><h2>' + esc(fl.modo === 'atajo' ? 'Grabar atajo: ' + def.t : def.t) + '</h2>' + def.campos.map(campo).join('') +
        (fl.modo === 'atajo' ? '<label class="fld"><span>Nombre del atajo</span><input type="text" maxlength="40" data-f="nombre" placeholder="Ej. Mensualidad" value="' + esc(fl.datos.nombre || '') + '"></label>' : '') +
        '<div class="chips"><button class="chip chip--go" data-confirmar>' + (fl.modo === 'atajo' ? 'Guardar atajo' : 'Confirmar') + '</button>' + (fl.modo === 'hacer' ? '<button class="chip" data-guardar-flujo>Guardar como atajo</button>' : '') + '</div></section>';
    } else {
      h += '<section class="card answer ok"><span class="check">✓</span><h2>' + (fl.modo === 'atajo' ? 'Atajo guardado' : 'Listo') + '</h2><p>' + esc(fl.msg) + '</p>' +
        (fl.modo === 'hacer' ? '<p class="src">Comprobante N.º ' + fl.num + ' · ' + new Date().toLocaleString('es-EC') + '</p>' : '') +
        '<div class="chips"><button class="chip chip--go" data-volver>Listo</button>' + (fl.modo === 'hacer' ? '<button class="chip" data-guardar-flujo>Guardar como atajo</button>' : '') + '</div></section>';
    }
    flujoEl.innerHTML = h;
  }
  function leerFlujo() { flujoEl.querySelectorAll('[data-f]').forEach(function (i) { fl.datos[i.dataset.f] = i.type === 'number' ? (parseFloat(i.value) || '') : i.value; }); }
  function confirmar() {
    leerFlujo();
    var falta = fl.def.campos.filter(function (c) { return c[0] !== 'motivo' && (fl.datos[c[0]] === '' || fl.datos[c[0]] == null); })[0];
    if (falta) return aviso('Falta: ' + falta[1].toLowerCase());
    if (fl.modo === 'atajo') {
      var nombre = (fl.datos.nombre || '').trim() || (fl.def.t + (fl.datos.contacto ? ' a ' + fl.datos.contacto.split(' ')[0] : fl.datos.empresa ? ' ' + fl.datos.empresa : ''));
      var d = Object.assign({}, fl.datos); delete d.nombre; delete d.cuenta;
      atajos.push({ id: Date.now(), nombre: nombre, accion: fl.accion.id, datos: d }); guardarAtajos();
      fl.paso = 'ok'; fl.msg = '«' + nombre + '» queda en Tus atajos. Lo repites con un toque desde el buscador.';
      return pintarFlujo();
    }
    fl.paso = 'ok'; fl.msg = fl.def.ok(fl.datos); fl.num = 'R-' + (20400 + Math.floor(Math.random() * 9000));
    pintarFlujo();
  }
  function cerrarFlujo() { fl = null; q.value = ''; render(); q.focus(); }

  /* ---------- Eventos ---------- */
  document.getElementById('ejemplos').innerHTML = EJ.map(function (e) { return '<button class="chip" data-q="' + esc(e) + '">' + esc(e) + '</button>'; }).join('');
  q.addEventListener('input', function () { abierta = null; render(); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button, [data-volver]'); if (!b) return;
    var d = b.dataset;
    if (d.q != null) { q.value = d.q; abierta = null; render(); q.focus(); return; }
    if (d.id) { abierta = d.id; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (d.hacer != null) { var it = intencion(q.value); if (it) abrirFlujo(it.accion.id, it.datos); return; }
    if (d.guardar != null) { var it2 = intencion(q.value); if (it2) abrirFlujo(it2.accion.id, Object.assign({ nombre: it2.nombre }, it2.datos), 'atajo'); return; }
    if (d.accion) return abrirFlujo(d.accion, {});
    if (d.atajo) { var a = atajos.filter(function (x) { return String(x.id) === d.atajo; })[0]; if (a) abrirFlujo(a.accion, a.datos); return; }
    if (d.nuevoAtajo != null) { out.innerHTML = '<p class="label">¿Qué quieres grabar?</p><section class="card">' + ['accion.transferir', 'accion.pagar-servicios', 'accion.recargar', 'accion.pagar-tarjeta', 'accion.pagar-prestamo'].map(function (id) { var x = K.entrada(id); return fila('data-grabar="' + id + '"', x.icon || 'bolt', esc(x.t), '', 'Atajo'); }).join('') + '</section>'; return; }
    if (d.grabar) return abrirFlujo(d.grabar, {}, 'atajo');
    if (d.catalogo != null) { out.innerHTML = catalogo(); return; }
    if (d.transferir) return abrirFlujo('accion.transferir', { contacto: d.transferir });
    if (d.recargar) { var c = CONTACTOS.filter(function (x) { return x.n === d.recargar; })[0]; return abrirFlujo('accion.recargar', { numero: c ? c.tel : '', contacto: c ? c.n : '' }); }
    if (d.chip) { leerFlujo(); fl.datos[d.chip] = d.v === '' ? '' : (isNaN(+d.v) ? d.v : +d.v); return pintarFlujo(); }
    if (d.confirmar != null) return confirmar();
    if (d.guardarFlujo != null) { leerFlujo(); var dd = Object.assign({}, fl.datos); return abrirFlujo(fl.accion.id, dd, 'atajo'); }
    if (d.volver != null) return cerrarFlujo();
    if (d.go) {
      // Un botón de una respuesta: si lleva a una acción con flujo, lo abre; si no, dice qué abriría
      var k = d.go, acc = K.lista('accion').filter(function (x) { return x.go === k; }).map(function (x) { return x.id; }).filter(function (id) { return FLUJO_DE[id]; })[0];
      if (acc) return abrirFlujo(acc, {});
      aviso('En la app abriría: ' + k);
    }
  });
  flujoEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); confirmar(); } });
  /* ---------- Búsqueda por voz: dicta la frase y se busca sola al terminar (1,2 s de silencio o 8 s máximo) ---------- */
  var mic = $('#mic'), rec = null;
  function dictar() {
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return aviso('Este navegador no puede escucharte. Prueba en Chrome o Safari.');
    if (rec) { try { rec.stop(); } catch (e) {} return; }
    var r = rec = new R(), quiet, cap, got = '';
    r.lang = 'es-EC'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    q.value = ''; q.placeholder = 'Te escucho…'; mic.classList.add('on');
    function stop() { clearTimeout(quiet); clearTimeout(cap); try { r.stop(); } catch (e) {} }
    cap = setTimeout(stop, 8000);
    r.onresult = function (e) {
      var fin = false;
      got = Array.prototype.map.call(e.results, function (x) { if (x.isFinal) fin = true; return x[0].transcript; }).join('');
      q.value = got; abierta = null; render();
      clearTimeout(quiet); if (fin) stop(); else quiet = setTimeout(stop, 1200);
    };
    r.onerror = function (e) { stop(); if (e.error === 'not-allowed') aviso('Necesito permiso para usar el micrófono.'); };
    r.onend = function () {
      clearTimeout(quiet); clearTimeout(cap); rec = null; mic.classList.remove('on'); q.placeholder = '¿Qué necesitas?';
      if (!got.trim()) return aviso('No escuché nada. Toca el micrófono y habla.');
      // Una frase con todos los datos (contacto y monto) abre el flujo directo
      var it = intencion(got); if (it && it.datos.monto && (it.datos.contacto || it.datos.numero || it.datos.empresa)) abrirFlujo(it.accion.id, it.datos);
    };
    try { r.start(); } catch (e) { rec = null; mic.classList.remove('on'); q.placeholder = '¿Qué necesitas?'; }
  }
  mic.addEventListener('click', dictar);
  K.listo().then(render);
  if (location.hash.length > 1) { q.value = decodeURIComponent(location.hash.slice(1)); }
  render();
})();
