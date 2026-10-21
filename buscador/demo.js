/* =====================================================================
   Demo del buscador sobre la base de conocimiento (buscador/)
   Todo cambia según la persona elegida (assets/pfm/datos.json, vía
   buscador/persona.js): sus cuentas y tarjetas en los flujos, su agenda
   (contactos con favoritos y Deuna, beneficiarios en el exterior, números
   para recargar, servicios domiciliados y pagos recurrentes), los atajos
   que le convienen, lo que le conviene ver primero («Para ti») y los
   datos que la base pone en sus respuestas ({tarjeta.deuda}…).
   Lo que entiende, en orden:
   1. Una frase con intención: «transferir 20 a juan», «pagar la luz»,
      «recargar 5 a mamá», «pagar tarjeta» → el flujo con los datos puestos.
   2. Tus atajos: acciones guardadas con sus datos, a un toque.
   3. Contactos: por nombre o alias, con Transferir (al exterior si es de
      afuera) y Recargar si tiene celular.
   4. Acciones de la base: van directo al flujo, sin pasar por las preguntas.
   5. Preguntas frecuentes y productos (la respuesta arriba si está clara).
   Además: el lector de facturas y documentos (buscador/lector.js): foto,
   imagen o PDF → empresa, contrato, valor y vencimiento → pago listo.
   Los flujos son simulados: un formulario, Confirmar y un comprobante.
   ===================================================================== */
(function () {
  'use strict';
  var K = window.Conocimiento, P = window.DemoPersona, L = window.Lector;
  var $ = function (s) { return document.querySelector(s); };
  var q = $('#q'), out = $('#out'), flujoEl = $('#flujo'), toast = $('#toast'), personasEl = $('#personas'), saludoEl = $('#saludo');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(v) { var s = Math.abs(+v || 0).toFixed(2).split('.'); return '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1]; }
  function norm(s) { return K.norm(s); }
  function aviso(t) { toast.textContent = t; toast.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { toast.classList.remove('on'); }, 2400); }

  /* ---------- Datos: los de la persona elegida (con un respaldo si no cargan) ---------- */
  var persona = null, CUENTAS = ['Cuenta de ahorro ···4471 · $ 1.440,35'], TARJETAS = ['Mastercard Black ···7643'], CONTACTOS = [], atajos = [];
  var CATALOGO = [
    [/\b(luz|electric|eeq|energia|centrosur|cnel)/, 'Empresa Eléctrica Quito', 24.8], [/\b(agua|epmaps|etapa|interagua)/, 'EPMAPS Agua de Quito', 12.35], [/\b(internet|netlife|wifi)/, 'Netlife', 29.9],
    [/\bcnt\b/, 'CNT', 18], [/\b(tv|cable|directv)/, 'DirecTV', 35.5], [/\bgas\b/, 'Gas a domicilio', 3.5], [/\b(sri|impuesto|renta|iva)/, 'SRI', 86.4],
    [/\b(ant|matricula|multa|transito)/, 'ANT · Matriculación y multas', 142.1], [/\b(iess|aporte)/, 'IESS', 47.3], [/\b(colegio|universidad|escuela|pension)/, 'Colegio · pensión', 120],
    [/\bnetflix/, 'Netflix', 10.99], [/\bspotify/, 'Spotify', 5.99], [/\b(fundacion|donar|donacion)/, 'Fundación · donación', 0]
  ];
  var SERVICIOS = CATALOGO.slice(), OPERADORAS = ['Claro', 'Movistar', 'CNT', 'Tuenti'];
  var FLUJO_DE = { 'accion.pagar-sri': 'servicios', 'accion.pagar-matricula': 'servicios', 'accion.pagar-iess': 'servicios', 'accion.pagar-educacion': 'servicios', 'accion.donar': 'servicios', 'accion.pagar-servicios': 'servicios',
    'accion.transferir': 'transferir', 'accion.programar': 'transferir', 'accion.transferir-exterior': 'exterior', 'accion.pagar-tarjeta': 'tarjeta', 'accion.recargar': 'recargar',
    'accion.retirar': 'retirar', 'accion.retiro-tercero': 'retirar', 'accion.pagar-qr': 'qr', 'accion.cobrar-qr': 'qr', 'accion.bloquear-tarjeta': 'bloquear', 'accion.pagar-prestamo': 'prestamo',
    'accion.pagar-factura': 'factura', 'accion.leer-documento': 'documento' };
  var EJ = ['transferir 20 a juan', 'pagar tarjeta', 'recargar 5 a mamá', 'pagar la luz', 'pagar una factura con foto', 'bloquear tarjeta', 'que es la cuenta joven'];

  // Palabras de una empresa para reconocerla cuando la escriben («luz», «netlife», «claro»)
  function regexEmpresa(nombre) {
    var n = norm(nombre), extra = /electric|energia|eeq|centrosur|cnel/.test(n) ? '|luz' : /agua|epmaps|etapa/.test(n) ? '|agua' : /netlife|internet|cnt/.test(n) ? '|internet' : /claro|movistar/.test(n) ? '|plan|celular' : /educativa|colegio|universidad/.test(n) ? '|colegio|pension|escuela' : '';
    var ws = n.split(' ').filter(function (w) { return w.length > 3 && !/^(hogar|plan|internet|telefonia|energia|potable|agua)$/.test(w); });
    return new RegExp('\\b(' + (ws.length ? ws.map(function (w) { return w.replace(/[^a-z0-9]/g, ''); }).join('|') : n.replace(/[^a-z0-9]/g, '')) + extra.replace(/^\|/, '|') + ')');
  }
  function atajosKey() { return 'kbdemo_atajos_' + (persona ? persona.id : 'x'); }
  function aplicarPersona() {
    persona = P.datos(); if (!persona) return;
    CUENTAS = persona.cuentas.map(function (c) { return c.etiqueta; }); if (!CUENTAS.length) CUENTAS = ['Cuenta transaccional ···0000 · $ 0,00'];
    TARJETAS = persona.tarjetas.map(function (t) { return t.etiqueta; });
    // Contactos del país y beneficiarios en el exterior, en una sola lista; favoritos primero
    CONTACTOS = persona.contactos.concat(persona.exterior.map(function (e) { return { n: e.n, alias: e.alias, banco: e.banco + ' · ' + e.pais, cuenta: e.swift, tel: '', veces: e.veces, ult: e.ult, montoTipico: e.montoTipico, favorito: false, deuna: false, exterior: true, pais: e.pais, swift: e.swift, cuentaExt: e.cuenta }; }));
    var propios = persona.servicios.map(function (s) { return [regexEmpresa(s.empresa), s.empresa, s.monto, s.contrato, s.auto, s.dia]; });
    SERVICIOS = propios.concat(CATALOGO.filter(function (c) { return !propios.some(function (p) { return p[1] === c[1] || c[0].test(norm(p[1])); }); }));
    try { atajos = JSON.parse(localStorage.getItem(atajosKey())) || []; } catch (e) { atajos = []; }
    K.datos(function (k) { return persona.valores[k] != null ? persona.valores[k] : null; });
    construirFlujos();
    var c1 = CONTACTOS.filter(function (c) { return !c.exterior; })[0], c2 = CONTACTOS.filter(function (c) { return c.tel; })[0];
    EJ[0] = 'transferir 20 a ' + (c1 ? c1.alias.toLowerCase() : 'juan'); EJ[2] = 'recargar 5 a ' + (c2 ? c2.alias.toLowerCase() : 'mamá');
    if (CONTACTOS.some(function (c) { return c.exterior; })) EJ[5] = 'enviar 100 a ' + CONTACTOS.filter(function (c) { return c.exterior; })[0].alias.toLowerCase();
    $('#ejemplos').innerHTML = EJ.map(function (e) { return '<button class="chip" data-q="' + esc(e) + '">' + esc(e) + '</button>'; }).join('');
    personasEl.innerHTML = P.lista().map(function (u) { return '<button class="chip' + (u.id === persona.id ? ' chip--on' : '') + '" data-persona="' + u.id + '" title="' + esc(u.tipo) + '">' + esc(u.nombre.split(' ')[0]) + '</button>'; }).join('');
    saludoEl.innerHTML = '<b>Hola, ' + esc(persona.primerNombre) + '.</b> ' + esc(persona.tipo) + ' · ' + esc(persona.ciudad) + ' · ' + (persona.movimientos ? persona.movimientos + ' movimientos' : 'sin movimientos todavía') + (persona.deuna && persona.deuna.mi_numero ? ' · Deuna ' + esc(persona.deuna.mi_numero) : '') + '.';
  }
  function guardarAtajos() { try { localStorage.setItem(atajosKey(), JSON.stringify(atajos)); } catch (e) {} }
  function subAtajo(a) { var d = a.datos || {}, e = K.entrada(a.accion); return [e ? e.t : a.accion, d.contacto || d.empresa || d.numero || '', d.monto ? money(d.monto) : ''].filter(Boolean).join(' · '); }
  function listaAtajos() { return atajos.length ? atajos : (persona ? persona.atajosSugeridos.map(function (a, i) { return Object.assign({ id: 's' + i, sugerido: true }, a); }) : []); }
  function servicioDe(nombre) { return SERVICIOS.filter(function (s) { return s[1] === nombre; })[0]; }

  /* ---------- Contactos ---------- */
  function dist1(a, b) { if (Math.abs(a.length - b.length) > 1) return false; var i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } d++; if (d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return d + (a.length - i) + (b.length - j) <= 1; }
  function contactos(texto, n) {
    var ws = norm(texto).split(' ').filter(function (w) { return w.length >= 3 && !/^\d/.test(w); });
    if (!ws.length) return [];
    return CONTACTOS.map(function (c) {
      var toks = norm(c.n + ' ' + c.alias).split(' '), sc = 0;
      ws.forEach(function (w) { toks.forEach(function (t) { if (t === w) sc += 3; else if (t.indexOf(w) === 0) sc += 2; else if (w.length >= 4 && dist1(w, t)) sc += 1; }); });
      return { c: c, sc: sc };
    }).filter(function (x) { return x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc || (b.c.favorito - a.c.favorito) || b.c.veces - a.c.veces; }).slice(0, n || 3).map(function (x) { return x.c; });
  }
  function datosContacto(c) { return c.exterior ? { contacto: c.n, pais: c.pais, swift: c.swift, cuentaExt: c.cuentaExt } : { contacto: c.n }; }

  /* ---------- La frase hecha acción ---------- */
  var VERBOS = [[/^(transfer|envi|mand|pasa|deposit|gir|prest|pagale|pagarle)/, 'accion.transferir'], [/^recarg/, 'accion.recargar'], [/^(retir|sac)/, 'accion.retirar'], [/^cobr/, 'accion.cobrar-qr'], [/^(bloque|congel)/, 'accion.bloquear-tarjeta'], [/^(escane|fotograf|lee|subir|sube|cargar)/, 'accion.pagar-factura']];
  function intencion(texto) {
    var nq = norm(texto), ws = nq.split(' ').filter(Boolean), it = K.intencion(texto);
    var tel = (nq.match(/\b09\d{8}\b/) || [])[0] || null;
    var m = nq.replace(/\b09\d{8}\b/, '').match(/(?:^|\s)\$?\s*(\d+(?:[.,]\d{1,2})?)(?=\s|$)/), monto = m ? parseFloat(m[1].replace(',', '.')) : 0;
    var servicio = null; SERVICIOS.some(function (s) { if (s[0].test(nq)) { servicio = s; return true; } return false; });
    var operadora = OPERADORAS.filter(function (o) { return nq.indexOf(norm(o)) >= 0; })[0] || null;
    var primero = ws[0] || '', accionId = null;
    VERBOS.some(function (v) { if (v[0].test(primero) || (ws[1] && /^(quiero|necesito|hazme|dame)$/.test(primero) && v[0].test(ws[1]))) { accionId = v[1]; return true; } return false; });
    if (/factura|planilla|pdf|foto|escanea/.test(nq) && /pag|le|sub|escan|foto/.test(nq)) accionId = 'accion.pagar-factura';
    else if (/^pag/.test(primero) || (ws[1] && /^pag/.test(ws[1]))) accionId = /tarjeta|mastercard|visa/.test(nq) ? 'accion.pagar-tarjeta' : servicio ? 'accion.pagar-servicios' : /prestamo|cuota|hipoteca/.test(nq) ? 'accion.pagar-prestamo' : /qr/.test(nq) ? 'accion.pagar-qr' : accionId;
    if (!accionId) {
      var kbA = K.buscar(texto, { tipo: 'accion', n: 1 })[0];
      if (kbA && (it.accion || nq === norm(kbA.t) || kbA.cobertura >= .99)) accionId = kbA.id;
    }
    var resto = ws.filter(function (w) { return !/^\d/.test(w) && !VERBOS.some(function (v) { return v[0].test(w); }) && !/^(pag|quiero|necesito|hazme|dame|plata|dinero|celular|tarjeta|saldo|para|por|factura|foto|exterior|afuera)/.test(w); }).join(' ');
    var quien = resto ? contactos(resto, 1)[0] || null : null;
    if (!accionId && quien && (monto || /\ba\b/.test(nq))) accionId = 'accion.transferir';
    if (accionId === 'accion.transferir' && quien && quien.exterior) accionId = 'accion.transferir-exterior';
    if (accionId === 'accion.transferir' && /exterior|afuera|espana|estados unidos|otro pais/.test(nq)) accionId = 'accion.transferir-exterior';
    if (accionId === 'accion.recargar' && quien && !quien.tel) quien = null;
    if (!accionId) return null;
    var e = K.entrada(accionId), datos = {};
    if (quien && (accionId === 'accion.transferir' || accionId === 'accion.transferir-exterior')) Object.assign(datos, datosContacto(quien));
    if (quien && accionId === 'accion.recargar') { datos.numero = quien.tel; datos.contacto = quien.n; }
    if (tel) datos.numero = tel;
    if (operadora) datos.operadora = operadora;
    if (monto) datos.monto = monto;
    if (servicio && FLUJO_DE[accionId] === 'servicios') { datos.empresa = servicio[1]; datos.monto = datos.monto || servicio[2]; if (servicio[3]) datos.contrato = servicio[3]; }
    var nombre = e.t;
    if (accionId === 'accion.transferir') nombre = 'Transferir' + (monto ? ' ' + money(monto) : '') + (quien ? ' a ' + quien.n : '');
    else if (accionId === 'accion.transferir-exterior') nombre = 'Enviar' + (monto ? ' ' + money(monto) : '') + (quien ? ' a ' + quien.alias + ' en ' + quien.pais : ' al exterior');
    else if (accionId === 'accion.recargar') nombre = 'Recargar' + (monto ? ' ' + money(monto) : '') + (quien ? ' a ' + quien.alias : tel ? ' al ' + tel : '');
    else if (accionId === 'accion.pagar-servicios' && servicio) nombre = 'Pagar ' + servicio[1] + (servicio[2] ? ' · ' + money(servicio[2]) : '') + (servicio[4] ? ' (se paga solo el ' + servicio[5] + ')' : '');
    else if (accionId === 'accion.pagar-tarjeta' && monto) nombre = 'Pagar ' + money(monto) + ' a la tarjeta';
    var lleno = !!(datos.contacto || datos.monto || datos.empresa || datos.numero);
    return { accion: e, datos: datos, nombre: nombre, lleno: lleno };
  }

  /* ---------- Vistas ---------- */
  var TIPO = { faq: 'Pregunta', producto: 'Producto', accion: 'Acción' };
  var abierta = null;
  // Una respuesta sobre un producto que la persona no tiene (tarjeta, préstamo, depósito) no se inventa con datos ajenos
  function sinProducto(v) {
    var raw = (v.e && v.e.r) || (K.base() ? (K.base().entradas.filter(function (e) { return e.id === v.id; })[0] || {}).r : '') || '';
    if (/\{tarjeta\./.test(raw) && !TARJETAS.length) return { t: 'Todavía no tienes tarjeta de crédito', r: 'Cuando tengas una, aquí verás tu fecha de corte, cuánto debes y tu cupo. La pides desde la app y la respuesta llega en minutos.', id: 'prod.tarjetas.credito', b: 'Solicitar tarjeta' };
    if (/\{prestamo\./.test(raw) && !(persona && (persona.hipoteca || persona.prestamos.length))) return { t: 'No tienes préstamos', r: 'Cuando tengas uno, aquí verás tu cuota, la fecha de pago y cuánto te falta. Puedes simular un crédito sin compromiso.', id: 'prod.prestamos.consumo', b: 'Ver préstamos' };
    if (/\{deposito\./.test(raw) && !(persona && persona.inversiones.length)) return { t: 'No tienes depósitos a plazo', r: 'Cuando tengas uno, aquí verás cuándo vence y cuánto gana. Un depósito a plazo se abre desde $ 500.', id: 'prod.inversiones.deposito', b: 'Ver depósitos a plazo' };
    return null;
  }
  function card(v) {
    var sp = sinProducto(v);
    if (sp) return '<p class="label">Respuesta</p><section class="card answer"><h2>' + esc(sp.t) + '</h2><p>' + esc(sp.r) + '</p><div class="chips"><button class="chip chip--go" data-id="' + sp.id + '">' + esc(sp.b) + '</button></div></section>';
    return '<p class="label">' + (v.tipo === 'producto' ? 'Producto' : 'Respuesta') + '</p><section class="card answer"><h2>' + esc(v.t) + '</h2><p>' + esc(v.r) + '</p>' +
      (v.datos.length ? '<dl>' + v.datos.map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      '<div class="chips">' + v.acts.map(function (a) { return '<button class="chip" data-go="' + esc(a[1]) + '">' + esc(a[0]) + '</button>'; }).join('') + '</div>' +
      (v.fuente ? '<p class="src">Fuente: ' + esc(v.fuente) + '</p>' : '') + '</section>';
  }
  function fila(attr, icon, t, s, r) { return '<button class="row" ' + attr + '><span class="ic">' + esc(icon) + '</span><span class="main"><b>' + t + '</b>' + (s ? '<small>' + s + '</small>' : '') + '</span>' + (r ? '<span class="tag">' + esc(r) + '</span>' : '') + '</button>'; }
  function filaAtajo(a) { return fila('data-atajo="' + a.id + '"', 'bolt', esc(a.nombre), esc(a.s || subAtajo(a)), a.sugerido ? 'Sugerido' : 'Atajo'); }
  function filaContacto(c) {
    var sub = c.exterior ? c.banco + ' · ' + c.swift + (c.veces ? ' · te envía ' + money(c.montoTipico) + ', la última ' + c.ult : '') : c.banco + ' ' + c.cuenta + (c.deuna ? ' · Deuna ' + c.tel : '') + (c.veces ? ' · ' + c.veces + (c.veces === 1 ? ' vez' : ' veces') + ', la última ' + c.ult : ' · todavía sin movimientos') + (c.montoTipico && !c.exterior ? ' · suele ser ' + money(c.montoTipico) : '');
    return '<div class="row static"><span class="ic">' + (c.exterior ? 'public' : 'person') + '</span><span class="main"><b>' + (c.favorito ? '<span class="star">★</span> ' : '') + esc(c.n) + '</b><small>' + esc(sub) + '</small></span>' +
      '<span class="acts"><button class="chip chip--go" data-transferir="' + esc(c.n) + '">' + (c.exterior ? 'Enviar al exterior' : 'Transferir') + '</button>' + (c.tel ? '<button class="chip" data-recargar="' + esc(c.n) + '">Recargar</button>' : '') + '</span></div>';
  }
  function inicio() {
    var h = '', A = listaAtajos();
    if (persona && persona.paraTi.length) h += '<p class="label">Para ti</p><section class="card">' + persona.paraTi.map(function (x, i) { return fila('data-parati="' + i + '"', x.accion ? (K.entrada(x.accion) || {}).icon || 'bolt' : 'lightbulb', esc(x.t), esc(x.s), x.accion ? 'Acción' : 'Respuesta'); }).join('') + '</section>';
    if (persona && persona.favoritos.length) h += '<p class="label">Tus accesos favoritos</p><div class="chips">' + persona.favoritos.map(function (f) { var a = K.lista('accion').filter(function (x) { return x.t === f || x.go === 'do:' + f; })[0]; return a ? '<button class="chip" data-accion="' + a.id + '">' + esc(a.t) + '</button>' : ''; }).join('') + '</div>';
    h += '<p class="label">' + (atajos.length ? 'Tus atajos' : 'Atajos sugeridos para ti') + '</p><section class="card">' + A.map(filaAtajo).join('') +
      fila('data-nuevo-atajo', 'add', 'Grabar un atajo', 'Guarda una acción con sus datos y repítela con un toque') + '</section>';
    var S = persona ? persona.servicios.filter(function (s) { return s.contrato; }) : [];
    if (S.length) h += '<p class="label">Tus servicios</p><section class="card">' + S.map(function (s) { return fila('data-servicio="' + esc(s.empresa) + '"', s.auto ? 'autorenew' : 'receipt_long', esc(s.empresa), esc('Contrato ' + s.contrato + ' · ' + (s.auto ? 'se paga solo el ' + s.dia + ' · tope ' + money(s.tope) : 'cada mes' + (s.dia ? ', el ' + s.dia : '')) + ' · ' + money(s.monto)), s.auto ? 'Domiciliado' : 'Recurrente'); }).join('') + '</section>';
    h += '<p class="label">Con una foto o un archivo</p><section class="card">' + fila('data-accion="accion.pagar-factura"', 'document_scanner', 'Pagar una factura', 'Foto, imagen o PDF: la app lee la empresa, el contrato y el valor') + fila('data-accion="accion.leer-documento"', 'description', 'Analizar un documento', 'Comprobantes, estados de cuenta, recibos') + '</section>';
    if (CONTACTOS.length) h += '<p class="label">Con quién te mueves dinero</p><section class="card">' + CONTACTOS.slice(0, 5).map(filaContacto).join('') + (CONTACTOS.length > 5 ? fila('data-q="contactos"', 'group', 'Ver todos', CONTACTOS.length + ' contactos') : '') + '</section>';
    else h += '<p class="label">Contactos</p><section class="card"><p class="empty">Todavía no te has movido dinero con nadie. Cuando transfieras o recibas, aquí aparecen esas personas.</p></section>';
    if (persona && persona.recargas.length) h += '<p class="label">Recargas</p><div class="chips">' + persona.recargas.map(function (r) { return '<button class="chip" data-recarga-num="' + esc(r.numero) + '" data-op="' + esc(r.operadora) + '" data-monto="' + r.monto_tipico + '">' + esc(r.nombre) + ' · ' + esc(r.numero) + '</button>'; }).join('') + '</div>';
    h += '<p class="label">Todo lo que puedes hacer</p><section class="card">' + fila('data-catalogo', 'apps', 'Todas las acciones', K.lista('accion').length + ' acciones de la banca móvil, por tema') + '</section>';
    return h;
  }
  function catalogo() {
    var cats = K.categorias(), Li = K.lista('accion');
    return '<p class="label">Todas las acciones</p>' + cats.map(function (c) {
      var xs = Li.filter(function (x) { return x.cat === c.id; }); if (!xs.length) return '';
      return '<p class="label">' + esc(c.t) + '</p><section class="card">' + xs.map(function (x) { return fila('data-accion="' + x.id + '"', x.icon || 'bolt', esc(x.t), '', 'Acción'); }).join('') + '</section>';
    }).join('');
  }
  function render() {
    var t = q.value.trim();
    flujoEl.hidden = true; out.hidden = false;
    if (!K.cargada()) { out.innerHTML = '<p class="empty">Cargando la base…</p>'; return; }
    if (!t) { out.innerHTML = inicio(); abierta = null; return; }
    if (norm(t) === 'contactos') { out.innerHTML = '<p class="label">Contactos</p><section class="card">' + (CONTACTOS.length ? CONTACTOS.map(filaContacto).join('') : '<p class="empty">Sin contactos todavía.</p>') + '</section>'; return; }
    var html = '', ws = norm(t).split(' ').filter(function (w) { return w.length > 2; });
    var it = intencion(t);
    if (it && it.lleno) html += '<p class="label">Hacer ahora</p><section class="card">' + fila('data-hacer', it.accion.icon || 'bolt', esc(it.nombre), 'Abre el flujo con los datos puestos', 'Acción') + '</section>' +
      '<div class="chips"><button class="chip" data-guardar>Guardar como atajo</button></div>';
    var at = listaAtajos().filter(function (a) { var s = norm(a.nombre + ' ' + subAtajo(a)); return ws.some(function (w) { return s.indexOf(w) >= 0; }); });
    if (at.length) html += '<p class="label">Tus atajos</p><section class="card">' + at.map(filaAtajo).join('') + '</section>';
    var cs = contactos(t, 3);
    if (cs.length) html += '<p class="label">Contactos</p><section class="card">' + cs.map(filaContacto).join('') + '</section>';
    var sv = persona ? persona.servicios.filter(function (s) { return s.contrato && ws.some(function (w) { return norm(s.empresa).indexOf(w) >= 0 || (servicioDe(s.empresa) && servicioDe(s.empresa)[0].test(w)); }); }).slice(0, 2) : [];
    if (sv.length && !(it && it.lleno)) html += '<p class="label">Tus servicios</p><section class="card">' + sv.map(function (s) { return fila('data-servicio="' + esc(s.empresa) + '"', s.auto ? 'autorenew' : 'receipt_long', esc(s.empresa), esc((s.auto ? 'Se paga solo el ' + s.dia : 'Cada mes') + ' · ' + money(s.monto)), s.auto ? 'Domiciliado' : 'Recurrente'); }).join('') + '</section>';
    var r = K.buscar(t, { n: 10 }), max = r.length ? r[0].s : 0;
    r = r.filter(function (x) { return x.s >= max * .3; });
    var acc = r.filter(function (x) { return x.tipo === 'accion' && !(it && it.lleno && x.id === it.accion.id); }).slice(0, 4);
    if (acc.length) html += '<p class="label">Acciones</p><section class="card">' + acc.map(function (x) { return fila('data-accion="' + x.id + '"', x.icon || 'bolt', esc(x.t), esc(x.e.r || ''), FLUJO_DE[x.id] ? 'Flujo' : 'Acción'); }).join('') + '</section>';
    var top = K.responder(t), v = abierta ? K.entrada(abierta) : (top && top.conf === 'alta' && top.tipo !== 'accion' && !(it && it.lleno) ? top : null);
    if (v) html += card(v);
    var resto = r.filter(function (x) { return x.tipo !== 'accion' && (!v || x.id !== v.id); }).slice(0, 5);
    if (resto.length) html += '<p class="label">' + (v ? 'También' : 'Preguntas y productos') + '</p><section class="card">' + resto.map(function (x) {
      return fila('data-id="' + esc(x.id) + '"', x.tipo === 'producto' ? 'inventory_2' : 'help', esc(x.t), esc(K.texto(x.e.r)).slice(0, 90) + '…', TIPO[x.tipo]);
    }).join('') + '</section>';
    if (!html) html = '<section class="card"><p class="empty">No encontré «' + esc(t) + '». Prueba con otras palabras, un contacto o una acción.</p></section>';
    out.innerHTML = html;
  }

  /* ---------- Flujos simulados (con las cuentas, tarjetas y agenda de la persona) ---------- */
  var FLUJOS = {};
  function construirFlujos() {
    var nombresC = CONTACTOS.filter(function (c) { return !c.exterior; }).map(function (c) { return c.n; }), ext = CONTACTOS.filter(function (c) { return c.exterior; });
    FLUJOS = {
      transferir: { t: 'Transferir', campos: [['contacto', 'A quién', 'text', 'Nombre, celular o número de cuenta', nombresC], ['monto', 'Monto', 'number', '0,00'], ['cuenta', 'Desde', 'select', CUENTAS], ['motivo', 'Motivo (opcional)', 'text', 'Ej. Mensualidad']],
        ok: function (d) { var c = CONTACTOS.filter(function (x) { return x.n === d.contacto; })[0]; return 'Transferiste ' + money(d.monto) + ' a ' + d.contacto + (c && /otro banco|guayaquil|produbanco|pacifico|bolivariano|jep/i.test(c.banco) ? ' (' + c.banco + '). A otro banco: hasta 24 horas hábiles.' : c && c.deuna ? ' por celular (Deuna ' + c.tel + '). Llega al instante.' : '. Llega al instante.'); } },
      exterior: { t: 'Transferir al exterior', campos: [['contacto', 'Beneficiario', 'text', 'Nombre completo', ext.map(function (c) { return c.n; })], ['pais', 'País', 'text', 'Ej. España'], ['swift', 'Código SWIFT del banco', 'text', 'Ej. BSCHESMM'], ['cuentaExt', 'Cuenta o IBAN', 'text', 'Ej. ES…'], ['monto', 'Monto en dólares', 'number', '0,00'], ['cuenta', 'Desde', 'select', CUENTAS]],
        ok: function (d) { return 'Enviaste ' + money(d.monto) + ' a ' + d.contacto + (d.pais ? ' en ' + d.pais : '') + '. Llega en 1 a 3 días hábiles; el ISD (5 %, ' + money(d.monto * .05) + ') y el costo salen en el comprobante.'; } },
      tarjeta: { t: 'Pagar tarjeta', requiere: 'tarjeta', campos: [['tarjeta', 'Tarjeta', 'select', TARJETAS], ['monto', 'Monto', 'chips', montosTarjeta()], ['cuenta', 'Desde', 'select', CUENTAS]],
        ok: function (d) { return 'Pagaste ' + money(d.monto) + ' a tu ' + d.tarjeta + '. Se acredita al instante.'; } },
      recargar: { t: 'Recargar celular', campos: [['operadora', 'Operadora', 'select', OPERADORAS], ['numero', 'Número', 'tel', '09…', persona ? persona.recargas.map(function (r) { return r.numero; }) : []], ['monto', 'Monto', 'chips', [['$ 3', 3], ['$ 5', 5], ['$ 10', 10], ['Otro', '']]], ['cuenta', 'Desde', 'select', CUENTAS]],
        ok: function (d) { return 'Recargaste ' + money(d.monto) + ' al ' + d.numero + ' (' + d.operadora + '). Se acredita al instante.'; } },
      servicios: { t: 'Pagar servicios', campos: [['empresa', 'Empresa', 'select', SERVICIOS.map(function (s) { return s[1]; })], ['contrato', 'Número de contrato, cédula o placa', 'text', 'Ej. 1234567'], ['monto', 'Valor', 'number', '0,00'], ['cuenta', 'Desde', 'select', CUENTAS]],
        ok: function (d) { var s = servicioDe(d.empresa); return 'Pagaste ' + money(d.monto) + ' a ' + d.empresa + '. La empresa lo registra en hasta 24 horas.' + (s && s[4] ? ' Ojo: este servicio ya está domiciliado; el débito automático del ' + s[5] + ' no se hará si el saldo ya está en cero.' : ''); } },
      prestamo: { t: 'Pagar cuota del préstamo', requiere: 'prestamo', campos: [['monto', 'Qué pagas', 'chips', montosPrestamo()], ['cuenta', 'Desde', 'select', CUENTAS]],
        ok: function (d) { return 'Pagaste ' + money(d.monto) + ' a tu ' + (persona && persona.hipoteca ? 'hipoteca' : 'préstamo') + '.'; } },
      retirar: { t: 'Retirar sin tarjeta', campos: [['monto', 'Monto', 'chips', [['$ 20', 20], ['$ 50', 50], ['$ 100', 100], ['Otro', '']]], ['cuenta', 'Desde', 'select', CUENTAS]],
        ok: function (d) { return 'Tu código es ' + (100000 + Math.floor(Math.random() * 900000)) + ' por ' + money(d.monto) + '. Vale 30 minutos en cualquier cajero.'; } },
      qr: { t: 'Pagar con QR', campos: [['monto', 'Monto', 'number', '0,00'], ['cuenta', 'Desde', 'select', CUENTAS]],
        ok: function (d) { return 'Pagaste ' + money(d.monto) + '. En la app, antes de esto, la cámara lee el QR del comercio.'; } },
      bloquear: { t: 'Bloquear tarjeta', requiere: 'tarjeta', campos: [['tarjeta', 'Tarjeta', 'select', TARJETAS], ['tipo', 'Tipo de bloqueo', 'chips', [['Temporal', 'temporal'], ['Definitivo', 'definitivo']]]],
        ok: function (d) { return 'Tu ' + d.tarjeta + ' quedó con bloqueo ' + d.tipo + (d.tipo === 'definitivo' ? '. Te enviamos una nueva en 3 a 5 días hábiles.' : '. La desbloqueas cuando quieras.'); } },
      factura: { lector: 'pagar' }, documento: { lector: 'analizar' }
    };
  }
  function montosTarjeta() { var t = persona && persona.tarjetas.filter(function (x) { return x.mvp; })[0] || (persona && persona.tarjetas[0]); return t && t.saldo > 0 ? [['Total · ' + money(t.saldo), Math.round(t.saldo * 100) / 100], ['Mínimo · ' + money(t.minimo), Math.round(t.minimo * 100) / 100], ['Otro', '']] : [['Otro', '']]; }
  function montosPrestamo() { var h = persona && persona.hipoteca, p = persona && persona.prestamos[0]; var c = h ? h.cuota : p ? p.cuota : 0; return c ? [['Cuota · ' + money(c), Math.round(c * 100) / 100], ['Abono a capital', '']] : [['Abono a capital', '']]; }
  var fl = null; // el flujo abierto: { accion, def, datos, modo: 'hacer' | 'atajo', paso }
  function abrirFlujo(accionId, datos, modo) {
    var e = K.entrada(accionId); if (!e) return;
    var def = FLUJOS[FLUJO_DE[accionId]];
    if (def && def.lector) return abrirLector(def.lector);
    fl = { accion: e, def: def, datos: Object.assign({}, datos || {}), modo: modo || 'hacer', paso: 'form' };
    if (def && def.requiere === 'tarjeta' && !TARJETAS.length) fl.falta = { t: 'No tienes tarjeta de crédito', s: 'Pídela desde la app: la respuesta llega en minutos.', id: 'prod.tarjetas.credito', b: 'Solicitar tarjeta' };
    if (def && def.requiere === 'prestamo' && !(persona && (persona.hipoteca || persona.prestamos.length))) fl.falta = { t: 'No tienes préstamos', s: 'Si necesitas dinero, simula un crédito sin compromiso.', id: 'prod.prestamos.consumo', b: 'Ver préstamos' };
    if (def) def.campos.forEach(function (c) { if (fl.datos[c[0]] == null && c[2] === 'select') fl.datos[c[0]] = c[3][0]; });
    if (def && FLUJO_DE[accionId] === 'servicios') { var s = servicioDe(fl.datos.empresa); if (!fl.datos.contrato) fl.datos.contrato = (s && s[3]) || '1234567'; if (!fl.datos.monto && s && s[2]) fl.datos.monto = Math.round(s[2] * 100) / 100; }
    if (def && FLUJO_DE[accionId] === 'exterior' && fl.datos.contacto && !fl.datos.swift) { var cx = CONTACTOS.filter(function (c) { return c.exterior && c.n === fl.datos.contacto; })[0]; if (cx) Object.assign(fl.datos, datosContacto(cx)); }
    pintarFlujo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function campo(c) {
    var k = c[0], v = fl.datos[k];
    if (c[2] === 'select') return '<label class="fld"><span>' + esc(c[1]) + '</span><select data-f="' + k + '">' + c[3].map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>';
    if (c[2] === 'chips') return '<div class="fld"><span>' + esc(c[1]) + '</span><div class="chips">' + c[3].map(function (o) { var on = String(o[1]) !== '' && String(o[1]) === String(v); return '<button type="button" class="chip' + (on ? ' chip--on' : '') + '" data-chip="' + k + '" data-v="' + esc(o[1]) + '">' + esc(o[0]) + '</button>'; }).join('') + '</div>' +
      (k === 'monto' && !c[3].some(function (o) { return String(o[1]) !== '' && String(o[1]) === String(v); }) ? '<input type="number" inputmode="decimal" step="0.01" min="0" placeholder="Otro monto" data-f="monto" value="' + esc(v || '') + '">' : '') + '</div>';
    return '<label class="fld"><span>' + esc(c[1]) + '</span><input type="' + c[2] + '"' + (c[2] === 'number' ? ' inputmode="decimal" step="0.01" min="0"' : '') + ' placeholder="' + esc(c[3] || '') + '" data-f="' + k + '" value="' + esc(v == null ? '' : v) + '"' + (c[4] && c[4].length ? ' list="dl-' + k + '"' : '') + '>' +
      (c[4] && c[4].length ? '<datalist id="dl-' + k + '">' + c[4].map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>' : '') + '</label>';
  }
  function pintarFlujo() {
    out.hidden = true; flujoEl.hidden = false;
    var e = fl.accion, def = fl.def, h = '<button class="back" data-volver>← Volver</button>';
    if (fl.falta) h += '<section class="card answer"><h2>' + esc(fl.falta.t) + '</h2><p>' + esc(fl.falta.s) + '</p><div class="chips"><button class="chip chip--go" data-id="' + fl.falta.id + '" data-volver-y-abrir>' + esc(fl.falta.b) + '</button><button class="chip" data-volver>Volver</button></div></section>';
    else if (!def) {
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
    var falta = fl.def.campos.filter(function (c) { return c[0] !== 'motivo' && c[0] !== 'cuentaExt' && (fl.datos[c[0]] === '' || fl.datos[c[0]] == null); })[0];
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

  /* ---------- Lector de facturas y documentos ---------- */
  var EJEMPLO = 'EMPRESA ELÉCTRICA QUITO S.A.  RUC 1790053881001\nPLANILLA DE CONSUMO ELÉCTRICO\nCliente: {nombre}\nCuenta contrato: {contrato}\nPeriodo: Septiembre 2026\nConsumo 184 kWh\nSubtotal $ 21,40\nAlumbrado público 2,10\nRecolección de basura 1,30\nTOTAL A PAGAR $ 24,80\nFecha de vencimiento: 28/10/2026\nFecha de emisión 05/10/2026';
  var lec = null; // { modo, paso, progreso, estado, texto, r }
  function abrirLector(modo) {
    lec = { modo: modo, paso: 'subir' }; fl = null;
    pintarLector(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function conf(k) { var c = lec.r && lec.r.conf[k]; return c ? '<span class="tag tag--' + c + '">' + (c === 'alta' ? 'seguro' : c === 'media' ? 'revisar' : 'dudoso') + '</span>' : '<span class="tag tag--baja">no leído</span>'; }
  function pintarLector() {
    out.hidden = true; flujoEl.hidden = false;
    var pagar = lec.modo === 'pagar', h = '<button class="back" data-volver>← Volver</button>';
    if (lec.paso === 'subir') {
      h += '<section class="card answer"><h2>' + (pagar ? 'Pagar una factura' : 'Analizar un documento') + '</h2><p>' + (pagar ? 'Toma una foto de la planilla o sube la imagen o el PDF. La app lee la empresa, el número de contrato, el valor y la fecha de vencimiento.' : 'Sube una imagen o un PDF: un comprobante, un estado de cuenta, un recibo. Te digo de qué es y qué tiene.') + '</p>' +
        '<label class="drop" data-drop><input type="file" accept="image/*,application/pdf" capture="environment" data-archivo hidden><span class="ic">upload_file</span><b>Toca para elegir o tomar la foto</b><small>Imagen (JPG, PNG, HEIC) o PDF · hasta 5 páginas · se procesa en tu teléfono</small></label>' +
        '<div class="chips"><button class="chip" data-ejemplo>Probar con una planilla de ejemplo</button>' + (pagar ? '' : '<button class="chip" data-ejemplo="comprobante">Probar con un comprobante</button>') + '</div>' +
        '<p class="src">El OCR corre en el navegador con Tesseract (español); los PDF con texto se leen sin OCR. Nada sale de tu teléfono.</p></section>';
    } else if (lec.paso === 'leyendo') {
      h += '<section class="card answer"><h2>Leyendo…</h2><p>' + esc(lec.estado || 'Preparando…') + '</p><div class="meter"><i style="width:' + (lec.progreso || 2) + '%"></i></div><p class="src">La primera vez descarga el motor de OCR (unos segundos).</p></section>';
    } else if (lec.paso === 'error') {
      h += '<section class="card answer"><h2>No pude leerlo</h2><p>' + esc(lec.error) + '</p><div class="chips"><button class="chip chip--go" data-reintentar>Intentar con otro archivo</button></div></section>';
    } else {
      var r = lec.r, m = pagar || r.tipo === 'factura', mio = r.empresa && persona ? persona.servicios.filter(function (s) { return norm(s.empresa).indexOf(norm(r.empresa).split(' ')[0]) >= 0 || norm(r.empresa).indexOf(norm(s.empresa).split(' ')[0]) >= 0; })[0] : null;
      h += '<section class="card answer"><h2>' + esc(r.tipo === 'factura' ? 'Factura leída' : r.tipo === 'comprobante' ? 'Comprobante' : r.tipo === 'estado-cuenta' ? 'Estado de cuenta' : 'Documento') + '</h2>' +
        '<p>' + esc(lec.fuente === 'pdf-texto' ? 'PDF con texto: lectura exacta.' : lec.fuente === 'ejemplo' ? 'Texto de ejemplo.' : 'Leído con OCR · confianza ' + lec.confianza + ' %.') + (r.empresa ? ' Es de <b>' + esc(r.empresa) + '</b>.' : '') + (r.cliente ? ' A nombre de ' + esc(r.cliente) + '.' : '') +
        (mio ? ' ' + (mio.auto ? 'Este servicio ya está domiciliado: se paga solo el ' + mio.dia + '.' : 'Lo pagas cada mes; el contrato ' + mio.contrato + ' está en tus servicios.') : '') + '</p>';
      if (m) {
        var emp = SERVICIOS.map(function (s) { return s[1]; }); if (r.empresa && emp.indexOf(r.empresa) < 0) emp.unshift(r.empresa);
        h += '<label class="fld"><span>Empresa ' + conf('empresa') + '</span><select data-l="empresa">' + emp.map(function (o) { return '<option' + (o === r.empresa ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>' +
          '<label class="fld"><span>Contrato, cédula o placa ' + conf('contrato') + '</span><input type="text" data-l="contrato" value="' + esc(r.contrato || '') + '"></label>' +
          '<label class="fld"><span>Valor a pagar ' + conf('valor') + '</span><input type="number" inputmode="decimal" step="0.01" data-l="valor" value="' + esc(r.valor || '') + '"></label>' +
          '<label class="fld"><span>Vence ' + conf('vence') + '</span><input type="date" data-l="vence" value="' + esc(r.vence || '') + '"></label>' +
          (r.periodo ? '<p class="src">Periodo: ' + esc(r.periodo) + '</p>' : '') +
          '<div class="chips"><button class="chip chip--go" data-pagar-leido>Pagar ' + (r.valor ? money(r.valor) : '') + '</button><button class="chip" data-atajo-leido>Guardar como atajo</button><button class="chip" data-texto>Ver el texto leído</button></div>';
      } else {
        h += '<dl>' + [['Tipo', r.tipo === 'comprobante' ? 'Comprobante de pago o transferencia' : r.tipo === 'estado-cuenta' ? 'Estado de cuenta' : 'Documento sin clasificar'], ['Empresa o entidad', r.empresa || '—'], ['Montos', r.montos.length ? r.montos.slice(0, 6).map(money).join(' · ') : '—'], ['Monto principal', r.valor ? money(r.valor) : '—'], ['Fechas', r.fechas.length ? r.fechas.slice(0, 4).join(' · ') : '—'], ['Referencia o contrato', r.contrato || '—'], ['Cédula / RUC', [r.cedula, r.ruc].filter(Boolean).join(' / ') || '—'], ['Placa', r.placa || '—']].map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl>';
        var rel = K.buscar([r.empresaTipo, r.tipo === 'comprobante' ? 'comprobante transferencia' : r.tipo === 'estado-cuenta' ? 'estado de cuenta corte pago minimo intereses' : r.empresa || ''].join(' '), { n: 3, tipo: ['faq', 'producto'] });
        h += '<div class="chips">' + (r.tipo === 'factura' || (r.empresaTipo && r.empresaTipo !== 'banco') ? '<button class="chip chip--go" data-pagar-leido>Pagar ' + (r.valor ? money(r.valor) : '') + '</button>' : '') + '<button class="chip" data-texto>Ver el texto leído</button></div>' +
          (rel.length ? '<p class="label">Relacionado en la ayuda</p>' + rel.map(function (x) { return '<button class="row" data-id="' + x.id + '" data-volver-y-abrir><span class="ic">help</span><span class="main"><b>' + esc(x.t) + '</b></span></button>'; }).join('') : '');
      }
      h += (lec.verTexto ? '<pre class="texto">' + esc(r.texto) + '</pre>' : '') + '</section>';
    }
    flujoEl.innerHTML = h;
  }
  function leerArchivo(file) {
    lec.paso = 'leyendo'; lec.progreso = 2; lec.estado = 'Abriendo ' + file.name + '…'; pintarLector();
    L.leer(file, function (p, estado) { if (p != null) lec.progreso = p; if (estado) lec.estado = estado; if (lec && lec.paso === 'leyendo') pintarLector(); })
      .then(function (o) { if (!lec) return; lec.fuente = o.fuente; lec.confianza = o.conf; lec.r = L.analizar(o.texto); lec.paso = 'listo'; pintarLector(); })
      .catch(function (e) { if (!lec) return; lec.paso = 'error'; lec.error = (e && e.message) || 'Algo falló al leer el archivo.'; pintarLector(); });
  }
  function leerEjemplo(cual) {
    var luz = persona ? persona.servicios.filter(function (s) { return /electric|energia|centrosur/i.test(s.empresa); })[0] : null;
    var t = cual === 'comprobante' ? 'Comprobante de transferencia\nPichibank\nNúmero de referencia 884512\nFecha: 2026-10-20\nDe: ' + CUENTAS[0].split(' · ')[0] + '\nPara: ' + (CONTACTOS[0] ? CONTACTOS[0].n : 'Juan Pérez') + '\nMonto $ 20,00\nTransacción exitosa'
      : EJEMPLO.replace('{nombre}', persona ? persona.nombre.toUpperCase() : 'CLIENTE').replace('{contrato}', luz && luz.contrato ? luz.contrato : '10234567');
    lec.fuente = 'ejemplo'; lec.confianza = 100; lec.r = L.analizar(t); lec.paso = 'listo'; pintarLector();
  }
  function leerCampos() { flujoEl.querySelectorAll('[data-l]').forEach(function (i) { lec.r[i.dataset.l] = i.type === 'number' ? (parseFloat(i.value) || null) : i.value; }); }

  /* ---------- Eventos ---------- */
  q.addEventListener('input', function () { abierta = null; render(); });
  document.addEventListener('change', function (e) { var i = e.target.closest('[data-archivo]'); if (i && i.files && i.files[0]) leerArchivo(i.files[0]); });
  document.addEventListener('dragover', function (e) { var d = e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  document.addEventListener('dragleave', function (e) { var d = e.target.closest('[data-drop]'); if (d) d.classList.remove('over'); });
  document.addEventListener('drop', function (e) { var d = e.target.closest('[data-drop]'); if (!d) return; e.preventDefault(); d.classList.remove('over'); var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) leerArchivo(f); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button, [data-volver]'); if (!b) return;
    var d = b.dataset;
    if (d.persona) { P.set(d.persona); aplicarPersona(); fl = null; lec = null; q.value = ''; render(); return; }
    if (d.q != null) { q.value = d.q; abierta = null; render(); q.focus(); return; }
    if (d.volverYAbrir != null && d.id) { fl = null; lec = null; abierta = d.id; var v0 = K.entrada(d.id); q.value = v0 ? v0.t : ''; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (d.id) { abierta = d.id; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (d.hacer != null) { var it = intencion(q.value); if (it) abrirFlujo(it.accion.id, it.datos); return; }
    if (d.guardar != null) { var it2 = intencion(q.value); if (it2) abrirFlujo(it2.accion.id, Object.assign({ nombre: it2.nombre }, it2.datos), 'atajo'); return; }
    if (d.parati != null) { var x = persona.paraTi[+d.parati]; if (!x) return; if (x.accion) return abrirFlujo(x.accion, x.datos || {}); abierta = x.id; q.value = (K.entrada(x.id) || {}).t || ''; render(); return; }
    if (d.servicio) { var sv = servicioDe(d.servicio); return abrirFlujo('accion.pagar-servicios', { empresa: d.servicio, contrato: sv && sv[3] || '', monto: sv && sv[2] ? Math.round(sv[2] * 100) / 100 : '' }); }
    if (d.recargaNum) return abrirFlujo('accion.recargar', { numero: d.recargaNum, operadora: d.op, monto: +d.monto || 5 });
    if (d.accion) return abrirFlujo(d.accion, {});
    if (d.atajo) { var a = listaAtajos().filter(function (x) { return String(x.id) === d.atajo; })[0]; if (a) abrirFlujo(a.accion, a.datos); return; }
    if (d.nuevoAtajo != null) { out.innerHTML = '<p class="label">¿Qué quieres grabar?</p><section class="card">' + ['accion.transferir', 'accion.pagar-servicios', 'accion.recargar', 'accion.pagar-tarjeta', 'accion.pagar-prestamo', 'accion.transferir-exterior'].map(function (id) { var x = K.entrada(id); return fila('data-grabar="' + id + '"', x.icon || 'bolt', esc(x.t), '', 'Atajo'); }).join('') + '</section>'; return; }
    if (d.grabar) return abrirFlujo(d.grabar, {}, 'atajo');
    if (d.catalogo != null) { out.innerHTML = catalogo(); return; }
    if (d.transferir) { var ct = CONTACTOS.filter(function (x) { return x.n === d.transferir; })[0]; return abrirFlujo(ct && ct.exterior ? 'accion.transferir-exterior' : 'accion.transferir', ct ? datosContacto(ct) : { contacto: d.transferir }); }
    if (d.recargar) { var c = CONTACTOS.filter(function (x) { return x.n === d.recargar; })[0]; return abrirFlujo('accion.recargar', { numero: c ? c.tel : '', contacto: c ? c.n : '' }); }
    if (d.chip) { leerFlujo(); fl.datos[d.chip] = d.v === '' ? '' : (isNaN(+d.v) ? d.v : +d.v); return pintarFlujo(); }
    if (d.confirmar != null) return confirmar();
    if (d.guardarFlujo != null) { leerFlujo(); var dd = Object.assign({}, fl.datos); return abrirFlujo(fl.accion.id, dd, 'atajo'); }
    if (d.ejemplo != null) return leerEjemplo(d.ejemplo);
    if (d.reintentar != null) { lec.paso = 'subir'; return pintarLector(); }
    if (d.texto != null) { lec.verTexto = !lec.verTexto; return pintarLector(); }
    if (d.pagarLeido != null) { leerCampos(); var r = lec.r; return abrirFlujo('accion.pagar-servicios', { empresa: r.empresa || SERVICIOS[0][1], contrato: r.contrato || '', monto: r.valor || '' }); }
    if (d.atajoLeido != null) { leerCampos(); var r2 = lec.r; return abrirFlujo('accion.pagar-servicios', { empresa: r2.empresa || SERVICIOS[0][1], contrato: r2.contrato || '', monto: r2.valor || '', nombre: 'Pagar ' + (r2.empresa || 'factura') }, 'atajo'); }
    if (d.volver != null) { lec = null; return cerrarFlujo(); }
    if (d.go) {
      var k = d.go, acc = K.lista('accion').filter(function (x) { return x.go === k; }).map(function (x) { return x.id; }).filter(function (id) { return FLUJO_DE[id]; })[0];
      if (acc) return abrirFlujo(acc, {});
      aviso('En la app abriría: ' + k);
    }
  });
  flujoEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && fl) { e.preventDefault(); confirmar(); } });

  /* ---------- Búsqueda por voz ---------- */
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
      var it = intencion(got); if (it && it.datos.monto && (it.datos.contacto || it.datos.numero || it.datos.empresa)) abrirFlujo(it.accion.id, it.datos);
    };
    try { r.start(); } catch (e) { rec = null; mic.classList.remove('on'); q.placeholder = '¿Qué necesitas?'; }
  }
  mic.addEventListener('click', dictar);

  /* ---------- Arranque: la base y la persona ---------- */
  construirFlujos();
  $('#ejemplos').innerHTML = EJ.map(function (e) { return '<button class="chip" data-q="' + esc(e) + '">' + esc(e) + '</button>'; }).join('');
  Promise.all([K.listo(), P.cargar('../assets/pfm/datos.json').catch(function () { return null; })]).then(function () { aplicarPersona(); if (location.hash.length > 1) q.value = decodeURIComponent(location.hash.slice(1)); render(); });
  render();
})();
