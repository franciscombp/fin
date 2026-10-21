/* =====================================================================
   Demo del buscador sobre la base de conocimiento (buscador/)
   Se ve como el buscador de la app: la misma hoja (.sx), las mismas filas,
   tarjetas, chips y formularios (assets/buscador.css, sistema.css…).
   La demo no trae estilos propios.

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
  var K = window.Conocimiento, P = window.DemoPersona, L = window.Lector, BUILD = '__BUILD__'; // lo reemplaza el workflow de Pages: cada despliegue cambia el ?v= y el navegador no reutiliza nada viejo
  var $ = function (s) { return document.querySelector(s); };
  var q = $('#q'), out = $('#out'), toast = $('#toast'), sx = $('.sx'), cancelBtn = $('#cancel'), cancelIc = cancelBtn.querySelector('span');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(v) { var s = Math.abs(+v || 0).toFixed(2).split('.'); return '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1]; }
  function norm(s) { return K.norm(s); }
  function aviso(t) { toast.textContent = t; toast.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { toast.classList.remove('show'); }, 2400); }

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

  function regexEmpresa(nombre) {
    var n = norm(nombre), extra = /electric|energia|eeq|centrosur|cnel/.test(n) ? '|luz' : /agua|epmaps|etapa/.test(n) ? '|agua' : /netlife|internet|cnt/.test(n) ? '|internet' : /claro|movistar/.test(n) ? '|plan|celular' : /educativa|colegio|universidad/.test(n) ? '|colegio|pension|escuela' : '';
    var ws = n.split(' ').filter(function (w) { return w.length > 3 && !/^(hogar|plan|internet|telefonia|energia|potable|agua)$/.test(w); });
    return new RegExp('\\b(' + (ws.length ? ws.map(function (w) { return w.replace(/[^a-z0-9]/g, ''); }).join('|') : n.replace(/[^a-z0-9]/g, '')) + extra.replace(/^\|/, '|') + ')');
  }
  // Desde dónde se abrió el buscador (en la app sería la sección activa): ajustes o ?desde=tarjetas
  var SEC_KEY = 'kbdemo_seccion';
  function seccion() { var m = location.search.match(/[?&]desde=([a-z]+)/); if (m) return m[1]; try { return localStorage.getItem(SEC_KEY) || 'inicio'; } catch (e) { return 'inicio'; } }
  function setSeccion(id) { try { localStorage.setItem(SEC_KEY, id); } catch (e) {} if (location.search) history.replaceState(null, '', location.pathname); }
  function nombreSeccion(id) { var x = P.secciones().filter(function (s) { return s[0] === id; })[0]; return x ? x[1] : 'Inicio'; }
  function atajosKey() { return 'kbdemo_atajos_' + (persona ? persona.id : 'x'); }
  function aplicarPersona() {
    persona = P.datos(); if (!persona) return;
    CUENTAS = persona.cuentas.map(function (c) { return c.etiqueta; }); if (!CUENTAS.length) CUENTAS = ['Cuenta transaccional ···0000 · $ 0,00'];
    TARJETAS = persona.tarjetas.map(function (t) { return t.etiqueta; });
    CONTACTOS = persona.contactos.concat(persona.exterior.map(function (e) { return { n: e.n, alias: e.alias, banco: e.banco + ' · ' + e.pais, cuenta: e.swift, tel: '', veces: e.veces, ult: e.ult, montoTipico: e.montoTipico, favorito: false, deuna: false, exterior: true, pais: e.pais, swift: e.swift, cuentaExt: e.cuenta }; }));
    var propios = persona.servicios.map(function (s) { return [regexEmpresa(s.empresa), s.empresa, s.monto, s.contrato, s.auto, s.dia]; });
    SERVICIOS = propios.concat(CATALOGO.filter(function (c) { return !propios.some(function (p) { return p[1] === c[1] || c[0].test(norm(p[1])); }); }));
    try { atajos = JSON.parse(localStorage.getItem(atajosKey())) || []; } catch (e) { atajos = []; }
    K.datos(function (k) { return persona.valores[k] != null ? persona.valores[k] : null; });
    construirFlujos();
    // Frases para probar: solo las que tienen sentido para esta persona (sus contactos, sus servicios, su tarjeta)
    var c1 = CONTACTOS.filter(function (c) { return !c.exterior; })[0], c2 = CONTACTOS.filter(function (c) { return c.tel; })[0], ext = CONTACTOS.filter(function (c) { return c.exterior; })[0];
    var luz = persona.servicios.filter(function (x) { return x.contrato && /electric|energia|centrosur|cnel/.test(norm(x.empresa)); })[0], otroServ = persona.servicios.filter(function (x) { return x.contrato; })[0];
    EJ = [];
    if (c1) EJ.push('transferir 20 a ' + c1.alias.toLowerCase());
    if (TARJETAS.length) EJ.push('pagar tarjeta');
    if (c2) EJ.push('recargar 5 a ' + c2.alias.toLowerCase()); else EJ.push('recargar 5 a mi celular');
    if (luz) EJ.push('pagar la luz'); else if (otroServ) EJ.push('pagar ' + otroServ.empresa.toLowerCase());
    if (ext) EJ.push('enviar 100 a ' + ext.alias.toLowerCase());
    if (!persona.movimientos) EJ.push('recibir dinero', 'pagar con qr', 'abrir una cuenta de ahorros');
    EJ.push('pagar una factura con foto'); if (TARJETAS.length) EJ.push('bloquear tarjeta'); EJ.push('que es la cuenta joven');
    EJ = EJ.slice(0, 7);
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
    if (accionId === 'accion.recargar' && !quien && !tel && /mi (celular|numero|telefono)/.test(nq) && persona && persona.recargas[0]) { datos.numero = persona.recargas[0].numero; datos.operadora = datos.operadora || persona.recargas[0].operadora; }
    if (tel) datos.numero = tel;
    if (operadora) datos.operadora = operadora;
    if (monto) datos.monto = monto;
    if (servicio && FLUJO_DE[accionId] === 'servicios') { datos.empresa = servicio[1]; if (servicio[3]) { datos.contrato = servicio[3]; datos.monto = datos.monto || servicio[2]; } }
    var nombre = e.t;
    if (accionId === 'accion.transferir') nombre = 'Transferir' + (monto ? ' ' + money(monto) : '') + (quien ? ' a ' + quien.n : '');
    else if (accionId === 'accion.transferir-exterior') nombre = 'Enviar' + (monto ? ' ' + money(monto) : '') + (quien ? ' a ' + quien.alias + ' en ' + quien.pais : ' al exterior');
    else if (accionId === 'accion.recargar') nombre = 'Recargar' + (monto ? ' ' + money(monto) : '') + (quien ? ' a ' + quien.alias : tel ? ' al ' + tel : '');
    else if (accionId === 'accion.pagar-servicios' && servicio) nombre = 'Pagar ' + servicio[1] + (servicio[3] && servicio[2] ? ' · ' + money(servicio[2]) : '') + (servicio[4] ? ' (se paga solo el ' + servicio[5] + ')' : '');
    else if (accionId === 'accion.pagar-tarjeta' && monto) nombre = 'Pagar ' + money(monto) + ' a la tarjeta';
    var lleno = !!(datos.contacto || datos.monto || datos.empresa || datos.numero);
    return { accion: e, datos: datos, nombre: nombre, lleno: lleno };
  }

  /* ---------- Piezas de la app: filas, tarjetas, chips, notas ---------- */
  var TIPO = { faq: 'Pregunta frecuente', producto: 'Producto', accion: 'Acción' };
  function ic(n) { return '<span class="sx-row__ic material-symbols-rounded">' + esc(n) + '</span>'; }
  function row(attr, icon, main, sub, right) { return '<button class="sx-row" ' + attr + '>' + ic(icon) + '<span class="sx-row__main"><b>' + main + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + (right ? '<span class="sx-row__r">' + right + '</span>' : '') + '</button>'; }
  function sec(titulo, rows, extra) { return '<section class="sx-card">' + (titulo ? '<h3>' + titulo + '</h3>' : '') + rows + '</section>' + (extra || ''); }
  function chips(list) { return '<section class="sx-card"><div class="sx-chips">' + list.join('') + '</div></section>'; }
  function chip(attr, t, on) { return '<button class="sx-chip" ' + attr + (on != null ? ' aria-pressed="' + !!on + '"' : '') + '>' + esc(t) + '</button>'; }
  function nota(t, rows) { return '<section class="sx-card sx-empty"><p>' + t + '</p>' + (rows || '') + '</section>'; }
  function volver() { return '<section class="sx-card"><button class="sx-link" data-volver><span class="material-symbols-rounded">arrow_back</span>Volver al buscador</button></section>'; }
  var abierta = null;
  // Una respuesta sobre un producto que la persona no tiene (tarjeta, préstamo, depósito) no se inventa con datos ajenos
  function sinProducto(v) {
    var raw = (v.e && v.e.r) || (K.base() ? (K.base().entradas.filter(function (e) { return e.id === v.id; })[0] || {}).r : '') || '';
    if (/\{tarjeta\./.test(raw) && !TARJETAS.length) return { t: 'Todavía no tienes tarjeta de crédito', r: 'Cuando tengas una, aquí verás tu fecha de corte, cuánto debes y tu cupo. La pides desde la app y la respuesta llega en minutos.', id: 'prod.tarjetas.credito', b: 'Solicitar tarjeta' };
    if (/\{prestamo\./.test(raw) && !(persona && (persona.hipoteca || persona.prestamos.length))) return { t: 'No tienes préstamos', r: 'Cuando tengas uno, aquí verás tu cuota, la fecha de pago y cuánto te falta. Puedes simular un crédito sin compromiso.', id: 'prod.prestamos.consumo', b: 'Ver préstamos' };
    if (/\{deposito\./.test(raw) && !(persona && persona.inversiones.length)) return { t: 'No tienes depósitos a plazo', r: 'Cuando tengas uno, aquí verás cuándo vence y cuánto gana. Un depósito a plazo se abre desde $ 500.', id: 'prod.inversiones.deposito', b: 'Ver depósitos a plazo' };
    return null;
  }
  function kbCard(v, titulo) {
    var sp = sinProducto(v);
    if (sp) return '<section class="sx-card sx-kb"><h3>Respuesta</h3><div class="sx-kb__body"><b class="sx-kb__t">' + esc(sp.t) + '</b><p class="sx-kb__p">' + esc(sp.r) + '</p><div class="sx-chips">' + chip('data-id="' + sp.id + '"', sp.b) + '</div></div></section>';
    return '<section class="sx-card sx-kb"><h3>' + esc(titulo || (v.tipo === 'producto' ? 'Producto' : 'Respuesta')) + '</h3><div class="sx-kb__body"><b class="sx-kb__t">' + esc(v.t) + '</b><p class="sx-kb__p">' + esc(v.r) + '</p>' +
      (v.datos.length ? '<dl class="sx-kb__datos">' + v.datos.map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      (v.pasos.length ? '<ol class="sx-kb__pasos">' + v.pasos.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '') +
      (v.acts.length ? '<div class="sx-chips">' + v.acts.map(function (a) { return chip('data-go="' + esc(a[1]) + '"', a[0]); }).join('') + '</div>' : '') +
      (v.links.length ? '<p class="sx-kb__links">' + v.links.map(function (l) { return '<a href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + esc(l[0]) + '</a>'; }).join(' · ') + '</p>' : '') +
      (v.fuente ? '<p class="sx-kb__links">Fuente: ' + esc(v.fuente) + '</p>' : '') + '</div></section>';
  }
  function filaAtajo(a) { return row('data-atajo="' + a.id + '"', 'bolt', esc(a.nombre), esc(a.s || subAtajo(a)) + (a.sugerido ? ' · Sugerido' : ' · Atajo')); }
  function filaContacto(c) {
    var sub = c.exterior ? c.banco + ' · ' + c.swift + (c.veces ? ' · te envía ' + money(c.montoTipico) + ', la última ' + c.ult : '') : c.banco + ' ' + c.cuenta + (c.deuna ? ' · Deuna ' + c.tel : '') + (c.veces ? ' · ' + c.veces + (c.veces === 1 ? ' vez' : ' veces') + ', la última ' + c.ult : ' · sin movimientos') + (c.montoTipico && !c.exterior ? ' · suele ser ' + money(c.montoTipico) : '');
    return row('data-transferir="' + esc(c.n) + '"', c.exterior ? 'public' : c.favorito ? 'star' : 'person', esc(c.n), esc(sub), c.exterior ? 'Enviar' : 'Transferir') + (c.tel ? '<button class="sx-link" data-recargar="' + esc(c.n) + '"><span class="material-symbols-rounded">smartphone</span>Recargar su celular</button>' : '');
  }
  // Ajustes de la demo (bajo el botón de la cabecera): la persona, sus datos y los atajos guardados
  function ajustes() {
    if (!persona) return volver();
    var h = volver() + '<section class="sx-card"><h3>Persona de la demo</h3><div class="sx-chips">' + P.lista().map(function (u) { return chip('data-persona="' + u.id + '" title="' + esc(u.tipo) + '"', u.nombre.split(' ')[0], u.id === persona.id); }).join('') + '</div></section>' +
      nota('<b>' + esc(persona.nombre) + '</b> · ' + esc(persona.tipo) + ' · ' + esc(persona.ciudad) + '<br>' + (persona.movimientos ? persona.movimientos + ' movimientos' : 'Sin movimientos todavía') + (persona.deuna && persona.deuna.mi_numero ? ' · Deuna ' + esc(persona.deuna.mi_numero) : '') + (persona.necesita ? '<br>Lo que necesita: ' + esc(persona.necesita.toLowerCase()) : '') + '.');
    h += sec('Sus datos', row('data-ver="contactos"', 'group', 'Contactos', CONTACTOS.length ? CONTACTOS.length + ' personas · ' + CONTACTOS.filter(function (c) { return c.favorito; }).length + ' favoritos · ' + CONTACTOS.filter(function (c) { return c.exterior; }).length + ' en el exterior' : 'Ninguno todavía') +
      row('data-ver="servicios"', 'receipt_long', 'Servicios', persona.servicios.filter(function (x) { return x.contrato; }).length ? persona.domiciliados.length + ' domiciliados · ' + persona.recurrentes.length + ' recurrentes' : 'Ninguno todavía') +
      row('data-ver="productos"', 'account_balance', 'Productos', persona.cuentas.length + (persona.cuentas.length === 1 ? ' cuenta' : ' cuentas') + ' · ' + persona.tarjetas.length + (persona.tarjetas.length === 1 ? ' tarjeta' : ' tarjetas') + ' · ' + (persona.prestamos.length + (persona.hipoteca ? 1 : 0)) + ' préstamos · ' + persona.inversiones.length + ' inversiones') +
      row('data-catalogo', 'apps', 'Todas las acciones', K.lista('accion').length + ' acciones de la banca móvil, por tema'));
    h += sec('Abierto desde', '<div class="sx-chips">' + P.secciones().map(function (x) { return chip('data-seccion="' + x[0] + '"', x[1], x[0] === seccion()); }).join('') + '</div>') +
      sec('Frases para probar', '<div class="sx-chips">' + EJ.map(function (e) { return chip('data-q="' + esc(e) + '"', e); }).join('') + '</div>');
    h += nota('Versión ' + esc(BUILD.indexOf('__') === 0 ? 'de desarrollo' : BUILD) + ' · cada despliegue renueva scripts, estilos y datos; si ves algo viejo, recarga.');
    h += sec('Atajos', (atajos.length ? row('data-borrar-atajos', 'delete', 'Borrar mis atajos', atajos.length + ' guardados en este navegador') : row('data-nuevo-atajo', 'add', 'Grabar un atajo', 'Todavía no has guardado ninguno')));
    return h;
  }
  function verLista(cual) {
    if (cual === 'contactos') return volver() + sec('Contactos', CONTACTOS.length ? CONTACTOS.map(filaContacto).join('') : '') + (CONTACTOS.length ? '' : nota('Sin contactos todavía.'));
    if (cual === 'servicios') { var S = persona.servicios.filter(function (x) { return x.contrato; }); return volver() + (S.length ? sec('Tus servicios', S.map(filaServicio).join('')) : nota('Sin servicios todavía.')) + (persona.recargas.length ? sec('Recargas', persona.recargas.map(function (r) { return row('data-recarga-num="' + esc(r.numero) + '" data-op="' + esc(r.operadora) + '" data-monto="' + r.monto_tipico + '"', 'smartphone', esc(r.nombre), esc(r.numero + ' · ' + r.operadora + ' · suele ser ' + money(r.monto_tipico))); }).join('')) : ''); }
    var h = volver();
    h += sec('Cuentas', persona.cuentas.map(function (c) { return row('data-q="mis cuentas"', 'account_balance', esc(c.nombre + ' ···' + c.numero), 'Saldo ' + money(c.saldo)); }).join('') || '');
    if (persona.tarjetas.length) h += sec('Tarjetas', persona.tarjetas.map(function (t) { return row('data-accion="accion.pagar-tarjeta"', 'credit_card', esc(t.nombre), esc(t.banco + ' · debes ' + money(t.saldo) + (t.mvp ? ' · cupo ' + money(t.limite) : ''))); }).join(''));
    var pr = (persona.hipoteca ? [{ nombre: 'Hipoteca', saldo: persona.hipoteca.saldo_capital, cuota: persona.hipoteca.cuota, banco: 'Pichibank' }] : []).concat(persona.prestamos);
    if (pr.length) h += sec('Préstamos', pr.map(function (x) { return row('data-accion="accion.pagar-prestamo"', 'payments', esc(x.nombre), esc(x.banco + ' · cuota ' + money(x.cuota) + ' · debes ' + money(x.saldo))); }).join(''));
    if (persona.inversiones.length || persona.metas.length) h += sec('Ahorro e inversiones', persona.inversiones.map(function (x) { return row('data-q="inversiones"', 'trending_up', esc(x.nombre), money(x.saldo)); }).join('') + persona.metas.map(function (x) { return row('data-q="meta de ahorro"', 'flag', esc(x.nombre), money(x.saldo) + ' de ' + money(x.meta)); }).join(''));
    return h;
  }
  function filaServicio(s) { return row('data-servicio="' + esc(s.empresa) + '"', s.auto ? 'autorenew' : 'receipt_long', esc(s.empresa), esc((s.auto ? 'Domiciliado: se paga solo el ' + s.dia : 'Cada mes') + ' · ' + money(s.monto))); }
  // Un producto sugerido como duda se muestra como pregunta («¿Cómo solicito una tarjeta de crédito?»), no como nombre
  function textoPregunta(e) {
    if (/\?$/.test(e.t) || /^¿/.test(e.t) || e.tipo === 'faq') return e.t;
    var raw = K.base() ? K.base().entradas.filter(function (x) { return x.id === e.id; })[0] : null, pq = raw && (raw.preguntas || []).filter(function (x) { return /\?/.test(x); })[0];
    return pq || '¿Qué es ' + e.t.toLowerCase() + '?';
  }
  // El inicio, como la hoja del buscador de la app: sugerencias, lo tuyo y poco más
  function inicio() {
    // Primero, las dudas de siempre de esta persona: por la sección desde la que abrió y por lo que hizo hace poco
    var pq = persona ? P.preguntas(seccion(), 4).map(function (id) { return K.entrada(id); }).filter(Boolean) : [];
    var h = pq.length ? chips(pq.map(function (e) { return chip('data-pregunta="' + e.id + '"', textoPregunta(e)); })) : '', A = listaAtajos();
    if (persona && persona.paraTi.length) h += sec('Para ti', persona.paraTi.slice(0, 3).map(function (x, i) { return row('data-parati="' + i + '"', x.accion ? (K.entrada(x.accion) || {}).icon || 'bolt' : 'lightbulb', esc(x.t), esc(x.s)); }).join(''));
    h += sec(atajos.length ? 'Tus atajos' : 'Atajos sugeridos', A.slice(0, 3).map(filaAtajo).join('') + row('data-nuevo-atajo', 'add', 'Grabar un atajo', 'Guarda una acción con sus datos y repítela con un toque'));
    h += sec('Con una foto', row('data-accion="accion.pagar-factura"', 'document_scanner', 'Pagar una factura', 'Foto, imagen o PDF: la app lee la empresa, el contrato y el valor'));
    return h;
  }
  function catalogo() {
    var cats = K.categorias(), Li = K.lista('accion');
    return volver() + cats.map(function (c) {
      var xs = Li.filter(function (x) { return x.cat === c.id; }); if (!xs.length) return '';
      return sec(esc(c.t), xs.map(function (x) { return row('data-accion="' + x.id + '"', x.icon || 'bolt', esc(x.t), esc(x.e ? x.e.r : '')); }).join(''));
    }).join('');
  }
  function render() {
    var t = q.value.trim();
    fl = null; lec = null;
    sx.classList.toggle('has-q', !!t); cancelIc.textContent = t ? 'close' : 'tune'; cancelBtn.setAttribute('aria-label', t ? 'Limpiar' : 'Ajustes de la demo');
    if (!K.cargada()) { out.innerHTML = nota('Cargando la base…'); return; }
    if (!t) { out.innerHTML = inicio(); abierta = null; return; }
    var html = '', ws = norm(t).split(' ').filter(function (w) { return w.length > 2; });
    var it = intencion(t);
    if (it && it.lleno) html += sec('Hacer ahora', row('data-hacer', it.accion.icon || 'bolt', esc(it.nombre), 'Abre el flujo con los datos puestos') + '<button class="sx-link" data-guardar><span class="material-symbols-rounded">bookmark_add</span>Guardar como atajo</button>');
    var at = listaAtajos().filter(function (a) { var s = norm(a.nombre + ' ' + subAtajo(a)); return ws.some(function (w) { return s.indexOf(w) >= 0; }); });
    if (at.length) html += sec('Tus atajos', at.slice(0, 2).map(filaAtajo).join(''));
    var cs = contactos(t, 2);
    if (cs.length) html += sec('Contactos', cs.map(filaContacto).join(''));
    var sv = persona ? persona.servicios.filter(function (s) { return s.contrato && ws.some(function (w) { return norm(s.empresa).indexOf(w) >= 0 || (servicioDe(s.empresa) && servicioDe(s.empresa)[0].test(w)); }); }).slice(0, 1) : [];
    if (sv.length && !(it && it.lleno)) html += sec('Tus servicios', sv.map(filaServicio).join(''));
    var r = K.buscar(t, { n: 10 }), max = r.length ? r[0].s : 0;
    r = r.filter(function (x) { return x.s >= max * .3; });
    var acc = r.filter(function (x) { return x.tipo === 'accion' && !(it && it.lleno && x.id === it.accion.id); }).slice(0, 3);
    if (acc.length) html += sec('Acciones', acc.map(function (x) { return row('data-accion="' + x.id + '"', x.icon || 'bolt', esc(x.t), esc(x.e.r || '')); }).join(''));
    var top = K.responder(t), v = abierta ? K.entrada(abierta) : (top && top.conf === 'alta' && top.tipo !== 'accion' && !(it && it.lleno) ? top : null);
    if (v) html += kbCard(v);
    var resto = r.filter(function (x) { return x.tipo !== 'accion' && (!v || x.id !== v.id); }).slice(0, 3);
    if (resto.length) html += sec(v ? 'También' : 'Preguntas y productos', resto.map(function (x) { return row('data-id="' + esc(x.id) + '"', x.tipo === 'producto' ? 'inventory_2' : 'help', esc(x.t), TIPO[x.tipo]); }).join(''));
    if (!html) html = nota('No encontramos «' + esc(t) + '» en la app.', row('data-q=""', 'help', 'Volver al inicio', 'Prueba con otras palabras, un contacto o una acción'));
    out.innerHTML = html;
    out.scrollTop = 0;
  }

  /* ---------- Flujos simulados (con las cuentas, tarjetas y agenda de la persona) ---------- */
  var FLUJOS = {};
  function construirFlujos() {
    var nombresC = CONTACTOS.filter(function (c) { return !c.exterior; }).map(function (c) { return c.n; }), ext = CONTACTOS.filter(function (c) { return c.exterior; });
    FLUJOS = {
      transferir: { t: 'Transferir', campos: [['contacto', 'A quién', 'text', 'Nombre, celular o número de cuenta', nombresC], ['monto', 'Monto', 'number', '0,00'], ['cuenta', 'Desde', 'chips', CUENTAS], ['motivo', 'Motivo (opcional)', 'text', 'Ej. Mensualidad']],
        ok: function (d) { var c = CONTACTOS.filter(function (x) { return x.n === d.contacto; })[0]; return 'Transferiste ' + money(d.monto) + ' a ' + d.contacto + (c && /otro banco|guayaquil|produbanco|pacifico|bolivariano|jep/i.test(c.banco) ? ' (' + c.banco + '). A otro banco: hasta 24 horas hábiles.' : c && c.deuna ? ' por celular (Deuna ' + c.tel + '). Llega al instante.' : '. Llega al instante.'); } },
      exterior: { t: 'Transferir al exterior', campos: [['contacto', 'Beneficiario', 'text', 'Nombre completo', ext.map(function (c) { return c.n; })], ['pais', 'País', 'text', 'Ej. España'], ['swift', 'Código SWIFT del banco', 'text', 'Ej. BSCHESMM'], ['cuentaExt', 'Cuenta o IBAN', 'text', 'Ej. ES…'], ['monto', 'Monto en dólares', 'number', '0,00'], ['cuenta', 'Desde', 'chips', CUENTAS]],
        ok: function (d) { return 'Enviaste ' + money(d.monto) + ' a ' + d.contacto + (d.pais ? ' en ' + d.pais : '') + '. Llega en 1 a 3 días hábiles; el ISD (5 %, ' + money(d.monto * .05) + ') y el costo salen en el comprobante.'; } },
      tarjeta: { t: 'Pagar tarjeta', requiere: 'tarjeta', campos: [['tarjeta', 'Tarjeta', 'chips', TARJETAS], ['monto', 'Monto', 'montos', montosTarjeta()], ['cuenta', 'Desde', 'chips', CUENTAS]],
        ok: function (d) { return 'Pagaste ' + money(d.monto) + ' a tu ' + d.tarjeta + '. Se acredita al instante.'; } },
      recargar: { t: 'Recargar celular', campos: [['operadora', 'Operadora', 'chips', OPERADORAS], ['numero', 'Número', 'tel', '09…', persona ? persona.recargas.map(function (r) { return r.numero; }) : []], ['monto', 'Monto', 'montos', [['$ 3', 3], ['$ 5', 5], ['$ 10', 10], ['Otro', '']]], ['cuenta', 'Desde', 'chips', CUENTAS]],
        ok: function (d) { return 'Recargaste ' + money(d.monto) + ' al ' + d.numero + ' (' + d.operadora + '). Se acredita al instante.'; } },
      servicios: { t: 'Pagar servicios', campos: [['empresa', 'Empresa', 'chips', SERVICIOS.map(function (s) { return s[1]; })], ['contrato', 'Número de contrato, cédula o placa', 'text', 'Ej. 1234567'], ['monto', 'Valor', 'number', '0,00'], ['cuenta', 'Desde', 'chips', CUENTAS]],
        ok: function (d) { var s = servicioDe(d.empresa); return 'Pagaste ' + money(d.monto) + ' a ' + d.empresa + '. La empresa lo registra en hasta 24 horas.' + (s && s[4] ? ' Ojo: este servicio ya está domiciliado; el débito automático del ' + s[5] + ' no se hará si el saldo ya está en cero.' : ''); } },
      prestamo: { t: 'Pagar cuota del préstamo', requiere: 'prestamo', campos: [['monto', 'Qué pagas', 'montos', montosPrestamo()], ['cuenta', 'Desde', 'chips', CUENTAS]],
        ok: function (d) { return 'Pagaste ' + money(d.monto) + ' a tu ' + (persona && persona.hipoteca ? 'hipoteca' : 'préstamo') + '.'; } },
      retirar: { t: 'Retirar sin tarjeta', campos: [['monto', 'Monto', 'montos', [['$ 20', 20], ['$ 50', 50], ['$ 100', 100], ['Otro', '']]], ['cuenta', 'Desde', 'chips', CUENTAS]],
        ok: function (d) { return 'Tu código es ' + (100000 + Math.floor(Math.random() * 900000)) + ' por ' + money(d.monto) + '. Vale 30 minutos en cualquier cajero.'; } },
      qr: { t: 'Pagar con QR', campos: [['monto', 'Monto', 'number', '0,00'], ['cuenta', 'Desde', 'chips', CUENTAS]],
        ok: function (d) { return 'Pagaste ' + money(d.monto) + '. En la app, antes de esto, la cámara lee el QR del comercio.'; } },
      bloquear: { t: 'Bloquear tarjeta', requiere: 'tarjeta', campos: [['tarjeta', 'Tarjeta', 'chips', TARJETAS], ['tipo', 'Tipo de bloqueo', 'montos', [['Temporal', 'temporal'], ['Definitivo', 'definitivo']]]],
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
    fl = { accion: e, def: def, datos: Object.assign({}, datos || {}), modo: modo || 'hacer', paso: 'form' }; lec = null;
    if (def && def.requiere === 'tarjeta' && !TARJETAS.length) fl.falta = { t: 'No tienes tarjeta de crédito', s: 'Pídela desde la app: la respuesta llega en minutos.', id: 'prod.tarjetas.credito', b: 'Solicitar tarjeta' };
    if (def && def.requiere === 'prestamo' && !(persona && (persona.hipoteca || persona.prestamos.length))) fl.falta = { t: 'No tienes préstamos', s: 'Si necesitas dinero, simula un crédito sin compromiso.', id: 'prod.prestamos.consumo', b: 'Ver préstamos' };
    if (def) def.campos.forEach(function (c) { if (fl.datos[c[0]] == null && c[2] === 'chips') fl.datos[c[0]] = c[3][0]; });
    if (def && FLUJO_DE[accionId] === 'servicios') { var s = servicioDe(fl.datos.empresa); if (!fl.datos.contrato && s && s[3]) fl.datos.contrato = s[3]; if (!fl.datos.monto && s && s[3] && s[2]) fl.datos.monto = Math.round(s[2] * 100) / 100; }
    if (def && FLUJO_DE[accionId] === 'exterior' && fl.datos.contacto && !fl.datos.swift) { var cx = CONTACTOS.filter(function (c) { return c.exterior && c.n === fl.datos.contacto; })[0]; if (cx) Object.assign(fl.datos, datosContacto(cx)); }
    pintarFlujo();
  }
  // Un campo del formulario, con las piezas del «Grabar un atajo» de la app: etiqueta, chips o entrada
  function campo(c) {
    var k = c[0], v = fl.datos[k];
    if (c[2] === 'chips') return '<p class="sx-rec__label">' + esc(c[1]) + '</p><div class="sx-chips">' + c[3].map(function (o) { return chip('data-chip="' + k + '" data-v="' + esc(o) + '"', o, o === v); }).join('') + '</div>';
    if (c[2] === 'montos') return '<p class="sx-rec__label">' + esc(c[1]) + '</p><div class="sx-chips">' + c[3].map(function (o) { var on = String(o[1]) !== '' && String(o[1]) === String(v); return chip('data-chip="' + k + '" data-v="' + esc(o[1]) + '"', o[0], on); }).join('') + '</div>' +
      (k === 'monto' && !c[3].some(function (o) { return String(o[1]) !== '' && String(o[1]) === String(v); }) ? '<label class="sx-rec__field"><span>Otro monto</span><input type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00" data-f="monto" value="' + esc(v || '') + '"></label>' : '');
    return '<label class="sx-rec__field"><span>' + esc(c[1]) + '</span><input type="' + c[2] + '"' + (c[2] === 'number' ? ' inputmode="decimal" step="0.01" min="0"' : '') + ' placeholder="' + esc(c[3] || '') + '" data-f="' + k + '" value="' + esc(v == null ? '' : v) + '"' + (c[4] && c[4].length ? ' list="dl-' + k + '"' : '') + '>' +
      (c[4] && c[4].length ? '<datalist id="dl-' + k + '">' + c[4].map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>' : '') + '</label>';
  }
  function pintarFlujo() {
    var e = fl.accion, def = fl.def, h = volver();
    if (fl.falta) h += '<section class="sx-card sx-kb"><h3>' + esc(def.t) + '</h3><div class="sx-kb__body"><b class="sx-kb__t">' + esc(fl.falta.t) + '</b><p class="sx-kb__p">' + esc(fl.falta.s) + '</p><div class="sx-chips">' + chip('data-id="' + fl.falta.id + '"', fl.falta.b) + chip('data-volver', 'Volver') + '</div></div></section>';
    else if (!def) {
      h += '<section class="sx-card sx-kb"><h3>Acción</h3><div class="sx-kb__body"><b class="sx-kb__t">' + esc(e.t) + '</b><p class="sx-kb__p">' + esc(e.r) + '</p>' + (e.pasos.length ? '<ol class="sx-kb__pasos">' + e.pasos.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol>' : '') +
        '<p class="sx-kb__links">En la app esto abre «' + esc(e.go) + '». Aquí es solo una demo.</p><div class="sx-chips">' + chip('data-volver', 'Entendido') + '</div></div></section>';
    } else if (fl.paso === 'form') {
      h += '<section class="sx-card sx-rec"><h3>' + esc(fl.modo === 'atajo' ? 'Grabar atajo: ' + def.t : def.t) + '</h3>' +
        (fl.modo === 'atajo' ? '<p class="sx-rec__hint">Guarda la acción con sus datos y repítela con un toque.</p>' : '') + def.campos.map(campo).join('') +
        (fl.modo === 'atajo' ? '<label class="sx-rec__field"><span>Nombre del atajo</span><input type="text" maxlength="40" placeholder="Ej. Mensualidad" data-f="nombre" value="' + esc(fl.datos.nombre || '') + '"></label>' : '') +
        '<div class="sx-rec__acts"><button class="sx-btn sx-btn--ghost" data-volver>Cancelar</button><button class="sx-btn" data-confirmar>' + (fl.modo === 'atajo' ? 'Guardar atajo' : 'Confirmar') + '</button></div>' +
        (fl.modo === 'hacer' ? '<button class="sx-link" data-guardar-flujo><span class="material-symbols-rounded">bookmark_add</span>Guardar como atajo</button>' : '') + '</section>';
    } else {
      h += '<section class="sx-card"><div class="sx-kb__body"><div class="pf-linking"><span class="pf-done material-symbols-rounded">check</span><h3>' + (fl.modo === 'atajo' ? 'Atajo guardado' : 'Listo') + '</h3><p>' + esc(fl.msg) + (fl.modo === 'hacer' ? '<br>Comprobante N.º ' + fl.num + ' · ' + new Date().toLocaleString('es-EC') : '') + '</p></div>' +
        '<button class="pf-cta" data-volver>Listo</button>' + (fl.modo === 'hacer' ? '<button class="sx-link" data-guardar-flujo><span class="material-symbols-rounded">bookmark_add</span>Guardar como atajo</button>' : '') + '</div></section>';
    }
    out.innerHTML = h; out.scrollTop = 0;
  }
  function leerFlujo() { out.querySelectorAll('[data-f]').forEach(function (i) { fl.datos[i.dataset.f] = i.type === 'number' ? (parseFloat(i.value) || '') : i.value; }); }
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
  function cerrar() { fl = null; lec = null; q.value = ''; render(); }

  /* ---------- Lector de facturas y documentos ---------- */
  var EJEMPLO = 'EMPRESA ELÉCTRICA QUITO S.A.  RUC 1790053881001\nPLANILLA DE CONSUMO ELÉCTRICO\nCliente: {nombre}\nCuenta contrato: {contrato}\nPeriodo: Septiembre 2026\nConsumo 184 kWh\nSubtotal $ 21,40\nAlumbrado público 2,10\nRecolección de basura 1,30\nTOTAL A PAGAR $ 24,80\nFecha de vencimiento: 28/10/2026\nFecha de emisión 05/10/2026';
  var lec = null; // { modo, paso, progreso, estado, texto, r }
  function abrirLector(modo) { lec = { modo: modo, paso: 'subir' }; fl = null; pintarLector(); }
  function conf(k) { var c = lec.r && lec.r.conf[k]; return c === 'alta' ? 'seguro' : c === 'media' ? 'revisar' : c === 'baja' ? 'dudoso' : 'no leído'; }
  function pintarLector() {
    var pagar = lec.modo === 'pagar', h = volver();
    if (lec.paso === 'subir') {
      h += '<section class="sx-card"><h3>' + (pagar ? 'Pagar una factura' : 'Analizar un documento') + '</h3>' +
        '<label class="sx-row"><input type="file" accept="image/*,application/pdf" capture="environment" data-archivo hidden>' + ic('photo_camera') + '<span class="sx-row__main"><b>Tomar una foto</b><small>Con la cámara del celular</small></span></label>' +
        '<label class="sx-row"><input type="file" accept="image/*,application/pdf" data-archivo hidden>' + ic('upload_file') + '<span class="sx-row__main"><b>Elegir una imagen o un PDF</b><small>JPG, PNG, HEIC o PDF · hasta 5 páginas · se procesa en tu teléfono</small></span></label>' +
        row('data-ejemplo', 'receipt_long', 'Probar con una planilla de ejemplo', 'Una planilla de luz a tu nombre') + (pagar ? '' : row('data-ejemplo="comprobante"', 'receipt', 'Probar con un comprobante', 'Una transferencia tuya')) + '</section>' +
        nota(pagar ? 'La app lee la empresa, el número de contrato, el valor y la fecha de vencimiento, y te deja el pago listo. El OCR corre en el navegador (Tesseract, español); los PDF con texto se leen sin OCR.' : 'Te digo de qué es el documento, qué montos y fechas tiene y qué puedes hacer con él. Nada sale de tu teléfono.');
    } else if (lec.paso === 'leyendo') {
      h += '<section class="sx-card sx-kb"><h3>Leyendo…</h3><div class="sx-kb__body"><b class="sx-kb__t">' + esc(lec.estado || 'Preparando…') + '</b><p class="sx-kb__p">La primera vez descarga el motor de OCR (unos segundos).</p><div class="uk-meter"><i style="width:' + (lec.progreso || 2) + '%"></i></div></div></section>';
    } else if (lec.paso === 'error') {
      h += '<section class="sx-card sx-kb"><h3>No pude leerlo</h3><div class="sx-kb__body"><p class="sx-kb__p">' + esc(lec.error) + '</p><div class="sx-chips">' + chip('data-reintentar', 'Intentar con otro archivo') + '</div></div></section>';
    } else {
      var r = lec.r, m = pagar || r.tipo === 'factura', mio = r.empresa && persona ? persona.servicios.filter(function (s) { return norm(s.empresa).indexOf(norm(r.empresa).split(' ')[0]) >= 0 || norm(r.empresa).indexOf(norm(s.empresa).split(' ')[0]) >= 0; })[0] : null;
      var intro = (lec.fuente === 'pdf-texto' ? 'PDF con texto: lectura exacta.' : lec.fuente === 'ejemplo' ? 'Texto de ejemplo.' : 'Leído con OCR · confianza ' + lec.confianza + ' %.') + (r.empresa ? ' Es de ' + r.empresa + '.' : '') + (r.cliente ? ' A nombre de ' + r.cliente + '.' : '') + (mio ? ' ' + (mio.auto ? 'Este servicio ya está domiciliado: se paga solo el ' + mio.dia + '.' : 'Lo pagas cada mes; el contrato ' + mio.contrato + ' está en tus servicios.') : '');
      h += '<section class="sx-card sx-kb"><h3>' + esc(r.tipo === 'factura' ? 'Factura leída' : r.tipo === 'comprobante' ? 'Comprobante' : r.tipo === 'estado-cuenta' ? 'Estado de cuenta' : 'Documento') + '</h3><div class="sx-kb__body"><p class="sx-kb__p">' + esc(intro) + '</p>';
      if (m) {
        var emp = SERVICIOS.map(function (s) { return s[1]; }); if (r.empresa && emp.indexOf(r.empresa) < 0) emp.unshift(r.empresa);
        h += '</div></section><section class="sx-card sx-rec"><h3>Revisa y paga</h3><p class="sx-rec__label">Empresa · ' + conf('empresa') + '</p><div class="sx-chips">' + emp.slice(0, 8).map(function (o) { return chip('data-lchip="empresa" data-v="' + esc(o) + '"', o, o === r.empresa); }).join('') + '</div>' +
          '<label class="sx-rec__field"><span>Contrato, cédula o placa · ' + conf('contrato') + '</span><input type="text" data-l="contrato" value="' + esc(r.contrato || '') + '"></label>' +
          '<label class="sx-rec__field"><span>Valor a pagar · ' + conf('valor') + '</span><input type="number" inputmode="decimal" step="0.01" data-l="valor" value="' + esc(r.valor || '') + '"></label>' +
          '<label class="sx-rec__field"><span>Vence · ' + conf('vence') + '</span><input type="date" data-l="vence" value="' + esc(r.vence || '') + '"></label>' +
          (r.periodo ? '<p class="sx-kb__links">Periodo: ' + esc(r.periodo) + '</p>' : '') +
          '<div class="sx-rec__acts"><button class="sx-btn sx-btn--ghost" data-atajo-leido>Guardar como atajo</button><button class="sx-btn" data-pagar-leido>Pagar ' + (r.valor ? money(r.valor) : '') + '</button></div>' +
          '<button class="sx-link" data-texto><span class="material-symbols-rounded">subject</span>' + (lec.verTexto ? 'Ocultar el texto leído' : 'Ver el texto leído') + '</button>' +
          (lec.verTexto ? '<ol class="sx-kb__pasos">' + r.texto.split(/\n+/).filter(Boolean).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ol>' : '') + '</section>';
      } else {
        h += '<dl class="sx-kb__datos">' + [['Tipo', r.tipo === 'comprobante' ? 'Comprobante de pago o transferencia' : r.tipo === 'estado-cuenta' ? 'Estado de cuenta' : 'Documento sin clasificar'], ['Empresa o entidad', r.empresa || '—'], ['Montos', r.montos.length ? r.montos.slice(0, 6).map(money).join(' · ') : '—'], ['Monto principal', r.valor ? money(r.valor) : '—'], ['Fechas', r.fechas.length ? r.fechas.slice(0, 4).join(' · ') : '—'], ['Referencia o contrato', r.contrato || '—'], ['Cédula / RUC', [r.cedula, r.ruc].filter(Boolean).join(' / ') || '—'], ['Placa', r.placa || '—']].map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl>' +
          '<div class="sx-chips">' + (r.tipo === 'factura' || (r.empresaTipo && r.empresaTipo !== 'banco') ? chip('data-pagar-leido', 'Pagar ' + (r.valor ? money(r.valor) : '')) : '') + chip('data-texto', lec.verTexto ? 'Ocultar el texto leído' : 'Ver el texto leído') + '</div>' +
          (lec.verTexto ? '<ol class="sx-kb__pasos">' + r.texto.split(/\n+/).filter(Boolean).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ol>' : '') + '</div></section>';
      }
      if (!m) { var rel = K.buscar([r.empresaTipo, r.tipo === 'comprobante' ? 'comprobante transferencia' : r.tipo === 'estado-cuenta' ? 'estado de cuenta corte pago minimo intereses' : r.empresa || ''].join(' '), { n: 3, tipo: ['faq', 'producto'] }); if (rel.length) h += sec('Relacionado en la ayuda', rel.map(function (x) { return row('data-id="' + x.id + '"', 'help', esc(x.t), TIPO[x.tipo]); }).join('')); }
    }
    out.innerHTML = h; out.scrollTop = 0;
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
  function leerCampos() { out.querySelectorAll('[data-l]').forEach(function (i) { lec.r[i.dataset.l] = i.type === 'number' ? (parseFloat(i.value) || null) : i.value; }); }

  /* ---------- Eventos ---------- */
  q.addEventListener('input', function () { abierta = null; render(); });
  $('#form').addEventListener('submit', function (e) { e.preventDefault(); var first = out.querySelector('[data-hacer], [data-accion], [data-id]'); if (first) first.click(); else q.blur(); });
  cancelBtn.addEventListener('click', function () { if (q.value.trim() || fl || lec) { cerrar(); q.focus(); return; } fl = null; lec = null; out.innerHTML = ajustes(); out.scrollTop = 0; });
  $('#cam').addEventListener('click', function () { abrirLector('pagar'); });
  document.addEventListener('change', function (e) { var i = e.target.closest('[data-archivo]'); if (i && i.files && i.files[0]) leerArchivo(i.files[0]); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var d = b.dataset;
    if (d.persona) { P.set(d.persona); aplicarPersona(); out.innerHTML = ajustes(); aviso('Ahora eres ' + persona.primerNombre); return; }
    if (d.ver) { out.innerHTML = verLista(d.ver); out.scrollTop = 0; return; }
    if (d.seccion) { setSeccion(d.seccion); out.innerHTML = ajustes(); aviso('Buscador abierto desde ' + nombreSeccion(d.seccion)); return; }
    if (d.pregunta) { var pe = K.entrada(d.pregunta); if (!pe) return; fl = null; lec = null; abierta = pe.id; q.value = pe.t; render(); return; }
    if (d.borrarAtajos != null) { atajos = []; guardarAtajos(); out.innerHTML = ajustes(); aviso('Atajos borrados'); return; }
    if (d.q != null) { q.value = d.q; abierta = null; render(); if (d.q) q.focus(); return; }
    if (d.id) { fl = null; lec = null; abierta = d.id; var v0 = K.entrada(d.id); if (v0 && !q.value.trim()) q.value = v0.t; render(); return; }
    if (d.hacer != null) { var it = intencion(q.value); if (it) abrirFlujo(it.accion.id, it.datos); return; }
    if (d.guardar != null) { var it2 = intencion(q.value); if (it2) abrirFlujo(it2.accion.id, Object.assign({ nombre: it2.nombre }, it2.datos), 'atajo'); return; }
    if (d.parati != null) { var x = persona.paraTi[+d.parati]; if (!x) return; if (x.accion) return abrirFlujo(x.accion, x.datos || {}); abierta = x.id; q.value = (K.entrada(x.id) || {}).t || ''; render(); return; }
    if (d.servicio) { var sv = servicioDe(d.servicio); return abrirFlujo('accion.pagar-servicios', { empresa: d.servicio, contrato: sv && sv[3] || '', monto: sv && sv[2] ? Math.round(sv[2] * 100) / 100 : '' }); }
    if (d.recargaNum) return abrirFlujo('accion.recargar', { numero: d.recargaNum, operadora: d.op, monto: +d.monto || 5 });
    if (d.accion) return abrirFlujo(d.accion, {});
    if (d.atajo) { var a = listaAtajos().filter(function (x) { return String(x.id) === d.atajo; })[0]; if (a) abrirFlujo(a.accion, a.datos); return; }
    if (d.nuevoAtajo != null) { out.innerHTML = volver() + sec('¿Qué quieres grabar?', ['accion.transferir', 'accion.pagar-servicios', 'accion.recargar', 'accion.pagar-tarjeta', 'accion.pagar-prestamo', 'accion.transferir-exterior'].map(function (id) { var x = K.entrada(id); return row('data-grabar="' + id + '"', x.icon || 'bolt', esc(x.t), 'Atajo'); }).join('')); return; }
    if (d.grabar) return abrirFlujo(d.grabar, {}, 'atajo');
    if (d.catalogo != null) { out.innerHTML = catalogo(); out.scrollTop = 0; return; }
    if (d.transferir) { var ct = CONTACTOS.filter(function (x) { return x.n === d.transferir; })[0]; return abrirFlujo(ct && ct.exterior ? 'accion.transferir-exterior' : 'accion.transferir', ct ? datosContacto(ct) : { contacto: d.transferir }); }
    if (d.recargar) { var c = CONTACTOS.filter(function (x) { return x.n === d.recargar; })[0]; return abrirFlujo('accion.recargar', { numero: c ? c.tel : '', contacto: c ? c.n : '' }); }
    if (d.chip) { leerFlujo(); fl.datos[d.chip] = d.v === '' ? '' : (isNaN(+d.v) ? d.v : +d.v); return pintarFlujo(); }
    if (d.lchip) { leerCampos(); lec.r[d.lchip] = d.v; return pintarLector(); }
    if (d.confirmar != null) return confirmar();
    if (d.guardarFlujo != null) { leerFlujo(); var dd = Object.assign({}, fl.datos); return abrirFlujo(fl.accion.id, dd, 'atajo'); }
    if (d.ejemplo != null) return leerEjemplo(d.ejemplo);
    if (d.reintentar != null) { lec.paso = 'subir'; return pintarLector(); }
    if (d.texto != null) { leerCampos(); lec.verTexto = !lec.verTexto; return pintarLector(); }
    if (d.pagarLeido != null) { leerCampos(); var r = lec.r; return abrirFlujo('accion.pagar-servicios', { empresa: r.empresa || SERVICIOS[0][1], contrato: r.contrato || '', monto: r.valor || '' }); }
    if (d.atajoLeido != null) { leerCampos(); var r2 = lec.r; return abrirFlujo('accion.pagar-servicios', { empresa: r2.empresa || SERVICIOS[0][1], contrato: r2.contrato || '', monto: r2.valor || '', nombre: 'Pagar ' + (r2.empresa || 'factura') }, 'atajo'); }
    if (d.volver != null) return cerrar();
    if (d.go) {
      var k = d.go, acc = K.lista('accion').filter(function (x) { return x.go === k; }).map(function (x) { return x.id; }).filter(function (id) { return FLUJO_DE[id]; })[0];
      if (acc) return abrirFlujo(acc, {});
      aviso('En la app abriría: ' + k);
    }
  });
  out.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && fl) { e.preventDefault(); confirmar(); } });

  /* ---------- Búsqueda por voz (como en la app: se cierra sola al terminar la frase) ---------- */
  var mic = $('#mic'), rec = null;
  function dictar() {
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return aviso('Este navegador no puede escucharte. Prueba en Chrome o Safari.');
    if (rec) { try { rec.stop(); } catch (e) {} return; }
    var r = rec = new R(), quiet, cap, got = '';
    r.lang = 'es-EC'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    q.value = ''; q.placeholder = 'Te escucho…'; sx.classList.add('is-listening'); sx.classList.remove('is-heard');
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
      clearTimeout(quiet); clearTimeout(cap); rec = null; sx.classList.remove('is-listening'); q.placeholder = '¿Qué necesitas?';
      if (!got.trim()) return aviso('No escuché nada. Toca el micrófono y habla.');
      var icono = mic.querySelector('span'); sx.classList.add('is-heard'); icono.textContent = 'check'; setTimeout(function () { sx.classList.remove('is-heard'); icono.textContent = 'mic'; }, 1400);
      var it = intencion(got); if (it && it.datos.monto && (it.datos.contacto || it.datos.numero || it.datos.empresa)) abrirFlujo(it.accion.id, it.datos);
    };
    try { r.start(); } catch (e) { rec = null; sx.classList.remove('is-listening'); q.placeholder = '¿Qué necesitas?'; }
  }
  mic.addEventListener('click', dictar);

  /* ---------- Arranque: la base y la persona ---------- */
  construirFlujos();
  Promise.all([K.listo(), P.cargar('../assets/pfm/datos.json?v=' + BUILD).catch(function () { return null; })]).then(function () { aplicarPersona(); if (location.hash.length > 1) q.value = decodeURIComponent(location.hash.slice(1)); render(); });
  render();
})();
