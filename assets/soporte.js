/* =====================================================================
   Soporte con Uku
   Lo primero es autogestión: Uku responde las dudas de siempre (fecha de
   corte, cómo cancelo un producto, un consumo que no reconozco...) con
   TUS datos y te lleva al lugar de la app donde lo resuelves. Un asesor
   queda solo para trámites que no se pueden hacer en la app; si hace
   falta, Uku le pasa el caso con un resumen. Todo es simulado.
   ===================================================================== */
(function () {
  'use strict';

  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function face() { return window.Asistente ? Asistente.faceIMG() : ''; }
  function uku() { return (window.Asistente && Asistente.name && Asistente.name()) || 'Uku'; }
  function firstName() { var n = document.querySelector('.profile-head__name'); return n ? n.textContent.trim().split(' ')[0] : ''; }

  var CASE = '#48213', PHONE = '1700 742 424', AGENT = { name: 'Andrea Ruiz', ini: 'AR' };
  /* Datos de la persona para responder con lo suyo (no textos genéricos) */
  function money(v) { var x = Math.abs(v).toFixed(2).split('.'); return '$ ' + x[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + x[1]; }
  function card() {
    var d = window.Asistente && Asistente.data && Asistente.data(), c = d && d.card;
    return c ? { owed: c.owed, min: Math.max(25, c.owed * .05), avail: c.limit - c.owed } : { owed: 0, min: 0, avail: 5000 };
  }
  /* Ayudas frecuentes: respuesta con tus datos + botones al lugar donde
     lo haces tú mismo. */
  var FAQ = [
    { icon: 'event', cat: 'tarjetas', t: '¿Cuándo es mi fecha de corte y de pago?', k: 'fecha corte pago tarjeta cuando pago vence vencimiento minimo estado de cuenta',
      a: function () { var c = card(); return 'Tu Mastercard Black corta el 25 de cada mes y la fecha máxima de pago es el 10 del mes siguiente. Hoy debes ' + money(c.owed) + ' y el pago mínimo es ' + money(c.min) + '. Si pagas el total, no te cobran intereses.'; },
      acts: [['Pagar tarjeta', 'do:Pagar tarjeta'], ['Ver mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'report', cat: 'tarjetas', t: 'No reconozco un consumo', k: 'no reconozco consumo cobro cargo raro fraude desconocido debito doble dos veces',
      a: 'Pide una revisión desde aquí: eliges el consumo y nos cuentas qué pasó. La revisión toma entre 2 y 6 semanas y, mientras tanto, ese monto no te genera intereses.',
      acts: [['Solicitar revisión', 'review'], ['Bloquear mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'cancel', cat: 'app', t: '¿Cómo cancelo un producto?', k: 'cancelar cerrar cuenta tarjeta seguro producto dar de baja anular',
      a: 'Cuentas, tarjetas y seguros se cancelan desde la app: entra al producto › Más › Cancelar producto. Antes revisa que no tenga saldo ni deudas pendientes. ¿Cuál quieres cancelar?',
      acts: [['Cuenta Corriente', 'do:Cuenta Corriente'], ['Mastercard Black', 'card:Mastercard Black'], ['Seguro de vida', 'do:Seguro de vida']] },
    { icon: 'credit_card_off', cat: 'tarjetas', t: 'Perdí mi tarjeta o me la robaron', k: 'perdi perdida robaron robo bloquear tarjeta extravie extravio',
      a: 'Bloquéala ahora para que nadie la use: es inmediato y, si la encuentras, la desbloqueas. Si fue robo, desde el mismo lugar pides una nueva.',
      acts: [['Bloquear mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'trending_up', cat: 'tarjetas', t: 'Quiero subir el cupo de mi tarjeta', k: 'subir aumentar cupo limite tarjeta credito',
      a: function () { return 'Tienes ' + money(card().avail) + ' de cupo disponible. Puedes pedir un aumento en tu tarjeta › Límites; la respuesta llega en minutos.'; },
      acts: [['Ver mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'password', cat: 'seguridad', t: 'Olvidé mi clave', k: 'olvide clave contrasena password usuario bloqueado acceso entrar pin',
      a: 'Crea una nueva con tu cédula y un código que te llega por SMS. Toma menos de 2 minutos.',
      acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'sync_alt', cat: 'cuentas', t: '¿Cuándo llega mi transferencia?', k: 'transferencia no llego llega demora interbancaria pendiente deposito cuando',
      a: 'Entre cuentas Pichibank llega al instante. A otros bancos, hasta 24 horas hábiles si la hiciste después de las 15:00 o en fin de semana.',
      acts: [['Ver mis movimientos', 'do:Cuenta PRINCIPAL']] },
    { icon: 'description', cat: 'cuentas', t: 'Necesito un certificado bancario', k: 'certificado bancario referencia carta documento',
      a: 'Lo descargas al instante en PDF, firmado electrónicamente y sin costo.',
      acts: [['Pedir certificado', 'do:Certificado bancario']] },
    { icon: 'ac_unit', cat: 'tarjetas', t: '¿Cómo congelo mi tarjeta?', k: 'congelar pausar tarjeta temporal bloquear temporalmente',
      a: 'En tu tarjeta › Congelar. Es inmediato: nadie puede usarla hasta que la descongeles, y no tienes que pedir una nueva.', acts: [['Ver mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'flight', cat: 'tarjetas', t: 'Voy a viajar: ¿mi tarjeta funciona afuera?', k: 'viaje viajar exterior extranjero internacional compras fuera pais activar',
      a: 'Sí. En tu tarjeta › Límites activas las compras en el exterior y eliges las fechas del viaje.', acts: [['Ver mi tarjeta', 'card:Mastercard Black']] },
    { icon: 'percent', cat: 'tarjetas', t: '¿Por qué me cobraron intereses?', k: 'intereses interes cobraron minimo pago parcial',
      a: 'Te cobran intereses cuando pagas menos que el total de tu estado de cuenta. Si pagas el total antes del 10, no pagas intereses.', acts: [['Pagar tarjeta', 'do:Pagar tarjeta']] },
    { icon: 'tag', cat: 'cuentas', t: '¿Cuál es mi número de cuenta?', k: 'numero de cuenta mis datos compartir recibir dinero',
      a: 'Tu cuenta PRINCIPAL termina en 7890. En Recibir dinero ves el número completo y lo compartes con un toque.', acts: [['Ver mis datos', 'do:Recibir dinero']] },
    { icon: 'speed', cat: 'cuentas', t: '¿Cuánto puedo transferir al día?', k: 'limite transferir maximo diario monto tope',
      a: 'Hasta $ 3.000 al día a otros bancos y hasta $ 10.000 entre cuentas Pichibank. Puedes cambiar tus límites en Seguridad.', acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'add_card', cat: 'cuentas', t: '¿Cómo abro una cuenta nueva?', k: 'abrir cuenta nueva ahorro corriente deuna',
      a: 'Desde la app en 5 minutos, solo con tu cédula. La cuenta queda lista para usar al instante.', acts: [['Abrir cuenta', 'do:Solicitar cuenta']] },
    { icon: 'bolt', cat: 'pagos', t: '¿Cómo pago la luz, el agua o el internet?', k: 'pagar luz agua internet servicios basicos planilla',
      a: 'En Pagar servicios eliges la empresa y escribes tu número de contrato. La próxima vez ya aparece guardada.', acts: [['Pagar servicios', 'do:Pagar servicios']] },
    { icon: 'autorenew', cat: 'pagos', t: '¿Cómo activo el pago automático?', k: 'pago automatico debito automatico domiciliar programar',
      a: 'En Pagar servicios › tu servicio › Pago automático. Se paga solo el día que vence y te avisamos antes.', acts: [['Pagar servicios', 'do:Pagar servicios']] },
    { icon: 'hourglass_top', cat: 'pagos', t: 'Pagué un servicio y no se refleja', k: 'pague servicio no se refleja no aparece comprobante pendiente',
      a: 'La empresa lo registra en hasta 24 horas. Tu comprobante está en tus movimientos por si te lo piden.', acts: [['Ver mis movimientos', 'do:Cuenta PRINCIPAL']] },
    { icon: 'qr_code_scanner', cat: 'pagos', t: '¿Cómo pago con QR?', k: 'pagar qr codigo escanear tienda',
      a: 'Toca Pagar con QR, apunta la cámara al código del comercio y confirma el monto. No necesitas efectivo ni tarjeta.', acts: [['Pagar con QR', 'do:Pagar con QR']] },
    { icon: 'event', cat: 'prestamos', t: '¿Cuándo pago mi cuota del préstamo?', k: 'cuota prestamo cuando pago fecha vence credito',
      a: 'Tu préstamo de consumo vence el 20 de cada mes. La cuota es de $ 245,90 y vas en la 6 de 36.', acts: [['Ver mi préstamo', 'tab:Prestamos']] },
    { icon: 'fast_forward', cat: 'prestamos', t: '¿Puedo adelantar cuotas o pagar todo?', k: 'adelantar cuotas precancelar pagar todo abonar capital',
      a: 'Sí, sin penalidad. En tu préstamo › Abonar eliges si bajas la cuota o el plazo.', acts: [['Ver mi préstamo', 'tab:Prestamos']] },
    { icon: 'request_quote', cat: 'prestamos', t: '¿Tengo un crédito preaprobado?', k: 'preaprobado credito oferta prestamo nuevo pedir',
      a: 'Sí, tienes una oferta vigente. Simula la cuota sin compromiso; la aprobación final depende de una revisión.', acts: [['Simular mi crédito', 'do:Simular crédito preaprobado']] },
    { icon: 'savings', cat: 'inversiones', t: '¿Cuándo vence mi depósito a plazo?', k: 'deposito plazo vence vencimiento poliza inversion',
      a: 'Tu depósito a plazo de $ 3.000,00 vence el 12 de noviembre y rinde 7,25% al año.', acts: [['Ver mi inversión', 'tab:Inversiones']] },
    { icon: 'published_with_changes', cat: 'inversiones', t: '¿Qué pasa cuando vence mi depósito?', k: 'renovar deposito vence que pasa dinero vuelve',
      a: 'Puedes renovarlo antes del vencimiento. Si no lo renuevas, el dinero y lo que ganaste pasan a tu cuenta PRINCIPAL ese mismo día.', acts: [['Ver mi inversión', 'tab:Inversiones']] },
    { icon: 'health_and_safety', cat: 'seguros', t: '¿Qué cubre mi seguro de vida?', k: 'seguro vida cubre cobertura beneficiarios',
      a: 'Cubre fallecimiento e invalidez permanente. En el seguro ves el monto asegurado y puedes cambiar a tus beneficiarios.', acts: [['Ver mi seguro', 'do:Seguro de vida']] },
    { icon: 'assignment', cat: 'seguros', t: '¿Cómo hago un reclamo de mi seguro?', k: 'reclamo seguro siniestro usar seguro cobrar',
      a: 'Desde el seguro › Reclamar subes los documentos y sigues el estado. Si es por un fallecimiento, te atiende un asesor.', acts: [['Ver mi seguro', 'do:Seguro de vida']] },
    { icon: 'phishing', cat: 'seguridad', t: 'Recibí un mensaje o llamada sospechosa', k: 'sospechoso estafa fraude mensaje llamada correo phishing codigo clave',
      a: 'Pichibank nunca te pide claves ni códigos por llamada, SMS o correo. No respondas, no abras enlaces y repórtalo desde Seguridad.', acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'phonelink_lock', cat: 'seguridad', t: '¿Cómo uso la app en un celular nuevo?', k: 'celular nuevo cambiar dispositivo telefono nuevo vincular',
      a: 'Inicia sesión en el celular nuevo y confirma con el código que te llega por SMS. El anterior se desvincula solo.', acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'insights', cat: 'app', t: '¿Qué es Mis finanzas?', k: 'mis finanzas pfm gastos presupuesto metas resumen',
      a: 'Es donde ves tu dinero de hoy, en qué gastas cada mes, tus presupuestos y metas. Uku te cuenta lo importante de cada mes.', acts: [['Ir a Mis finanzas', 'pfm']] },
    { icon: 'bolt', cat: 'app', t: '¿Cómo creo un atajo?', k: 'atajo grabar repetir rapido buscador',
      a: 'En el buscador toca Grabar un atajo, elige la acción y sus datos. Después la repites con un toque.', acts: [['Abrir el buscador', 'search']] }
  ];
  /* Categorías del centro de ayuda */
  var CATS = [
    ['tarjetas', 'credit_card', 'Tarjetas'], ['cuentas', 'account_balance', 'Cuentas y transferencias'], ['pagos', 'payments', 'Pagos y recargas'],
    ['prestamos', 'request_quote', 'Préstamos'], ['inversiones', 'trending_up', 'Inversiones'], ['seguros', 'shield', 'Seguros'],
    ['seguridad', 'lock', 'Seguridad y acceso'], ['app', 'smartphone', 'Tu app']
  ];
  /* Tutoriales: paso a paso, con un botón para hacerlo ahora */
  var TUT = [
    { icon: 'send_money', cat: 'cuentas', t: 'Transferir a otro banco', min: 1, k: 'transferir otro banco interbancaria',
      steps: ['Toca Transferir en Inicio.', 'Elige Otro banco y escribe el número de cuenta, o elige a alguien que ya tienes guardado.', 'Pon el monto y revisa los datos.', 'Confirma con tu huella o tu clave.'], act: ['Transferir ahora', 'do:Transferir dinero'] },
    { icon: 'qr_code_scanner', cat: 'pagos', t: 'Pagar con QR en una tienda', min: 1, k: 'pagar qr tienda codigo',
      steps: ['Toca Pagar con QR.', 'Apunta la cámara al código del comercio.', 'Revisa el monto y elige la cuenta.', 'Confirma: el comercio ve el pago al instante.'], act: ['Pagar con QR', 'do:Pagar con QR'] },
    { icon: 'ac_unit', cat: 'tarjetas', t: 'Congelar y descongelar tu tarjeta', min: 1, k: 'congelar tarjeta bloquear',
      steps: ['Entra a Tarjetas y elige tu tarjeta.', 'Toca Congelar.', 'Para volver a usarla, toca Descongelar.'], act: ['Ver mi tarjeta', 'card:Mastercard Black'] },
    { icon: 'autorenew', cat: 'pagos', t: 'Activar el pago automático de servicios', min: 2, k: 'pago automatico servicios luz agua',
      steps: ['Toca Pagar servicios y elige el servicio.', 'Toca Pago automático.', 'Elige la cuenta y un monto máximo.', 'Listo: te avisamos antes de cada pago.'], act: ['Pagar servicios', 'do:Pagar servicios'] },
    { icon: 'flag', cat: 'app', t: 'Crear una meta de ahorro', min: 2, k: 'meta ahorro crear objetivo',
      steps: ['Toca Crear meta de ahorro.', 'Ponle un nombre y cuánto quieres juntar.', 'Elige hasta cuándo y cuánto ahorrar cada mes.', 'Activa el ahorro automático para que se pase solo.'], act: ['Crear una meta', 'do:Crear meta de ahorro'] },
    { icon: 'atm', cat: 'cuentas', t: 'Retirar sin tarjeta', min: 1, k: 'retirar sin tarjeta cajero codigo efectivo',
      steps: ['Toca Retirar sin tarjeta y pon el monto.', 'Recibes un código válido por 30 minutos.', 'En el cajero elige Retiro sin tarjeta y escribe el código.'], act: ['Retirar sin tarjeta', 'do:Retirar sin tarjeta'] },
    { icon: 'bolt', cat: 'app', t: 'Grabar un atajo en el buscador', min: 1, k: 'atajo grabar buscador',
      steps: ['Abre el buscador deslizando hacia abajo en Inicio.', 'Toca Grabar un atajo.', 'Elige la acción, para quién y el monto.', 'Ponle un nombre y guárdalo.'], act: ['Abrir el buscador', 'search'] }
  ];
  /* Búsqueda en la ayuda (también la usa el buscador de la app) */
  function find(q, n) {
    var STOP = { como: 1, cuanto: 1, cuando: 1, que: 1, por: 1, para: 1, mis: 1, una: 1, los: 1, las: 1, del: 1, con: 1, puedo: 1, quiero: 1, tengo: 1, hago: 1 };
    var ws = norm(q).replace(/[¿?¡!.,]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && !STOP[w]; });
    if (!ws.length) return [];
    var all = FAQ.map(function (f, i) { return { kind: 'faq', i: i, icon: f.icon, t: f.t, txt: f.t + ' ' + f.k }; })
      .concat(TUT.map(function (u, i) { return { kind: 'tut', i: i, icon: u.icon, t: u.t, txt: u.t + ' ' + u.k }; }));
    return all.map(function (x) { var k = ' ' + norm(x.txt) + ' ', sc = 0; ws.forEach(function (w) { if (k.indexOf(' ' + w) >= 0) sc += 2; else if (k.indexOf(w) >= 0) sc += 1; }); x.sc = sc; return x; })
      .filter(function (x) { return x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, n || 5);
  }
  // Lo que sí necesita a una persona: no se puede hacer en la app
  var COMPLEX = /(hipotec|reestructur|refinanc|herenci|fallec|poder notarial|poderes|embargo|juicio|legal|demanda|reclamo en curso|mi reclamo|seguimiento)/;
  var CONTACT = [
    ['chat', 'Chat con un asesor', 'Te responde una persona · espera aprox. 2 min', 'agent'],
    ['call', 'Llamar al call center', PHONE + ' · las 24 horas', 'call'],
    ['phone_callback', 'Que te llamemos', 'Elige cuándo y te llama un asesor', 'callback']
  ];

  var el, log, input, topic = null, withAgent = false, agentN = 0, misses = 0, pageEl = null;
  function faqRow(i) {
    var f = FAQ[i];
    return '<button class="sp-row" data-sp="faq:' + i + '"><span class="sp-row__ic material-symbols-rounded">' + f.icon + '</span><span class="sp-row__main"><b>' + f.t + '</b></span><span class="material-symbols-rounded">chevron_right</span></button>';
  }
  function tutRow(i) {
    var u = TUT[i];
    return '<button class="sp-row" data-sp="tut:' + i + '"><span class="sp-row__ic material-symbols-rounded">' + u.icon + '</span><span class="sp-row__main"><b>' + u.t + '</b><small>Tutorial · ' + u.steps.length + ' pasos</small></span><span class="material-symbols-rounded">chevron_right</span></button>';
  }
  // Páginas dentro de Ayuda: una categoría o un tutorial
  function showPage(html, title) {
    pageEl.innerHTML = html; pageEl.hidden = false;
    el.classList.add('is-page');
    el.querySelector('.sp-top__title b').textContent = title;
    el.querySelector('.sp-body').scrollTop = 0;
  }
  function catPage(id) {
    var c = CATS.filter(function (x) { return x[0] === id; })[0];
    var fs = FAQ.map(function (f, i) { return f.cat === id ? i : -1; }).filter(function (i) { return i >= 0; });
    var ts = TUT.map(function (u, i) { return u.cat === id ? i : -1; }).filter(function (i) { return i >= 0; });
    showPage('<section class="sp-sec"><h2>Preguntas frecuentes</h2><div class="sp-list">' + fs.map(faqRow).join('') + '</div></section>' +
      (ts.length ? '<section class="sp-sec"><h2>Tutoriales</h2><div class="sp-list">' + ts.map(tutRow).join('') + '</div></section>' : ''), c[2]);
  }
  function tutPage(i) {
    var u = TUT[i];
    showPage('<section class="sp-tutpage"><span class="sp-tutpage__ic material-symbols-rounded">' + u.icon + '</span><h2>' + u.t + '</h2><p>' + u.steps.length + ' pasos · ' + u.min + ' min</p>' +
      '<ol class="sp-steps">' + u.steps.map(function (st) { return '<li><span>' + esc(st) + '</span></li>'; }).join('') + '</ol>' +
      '<button class="pf-cta" data-sp="' + u.act[1] + '">' + u.act[0] + '</button>' +
      '<p class="sp-tutpage__more">¿Algo no salió? <button data-sp="ask">Pregúntale a ' + uku() + '</button></p></section>', 'Tutorial');
  }
  function hidePage() { if (!pageEl) return; pageEl.hidden = true; pageEl.innerHTML = ''; el.classList.remove('is-page'); el.querySelector('.sp-top__title b').textContent = 'Ayuda'; }
  function paintFound(q) {
    var box = el.querySelector('.sp-found'), r = find(q, 6);
    box.hidden = !q.trim();
    box.innerHTML = r.length ? '<div class="sp-list">' + r.map(function (x) { return x.kind === 'faq' ? faqRow(x.i) : tutRow(x.i); }).join('') + '</div>'
      : '<p class="sp-found__none">No encontré eso en la ayuda. <button data-sp="askq">Pregúntale a ' + uku() + '</button></p>';
  }

  function mount() {
    el = document.createElement('div');
    el.className = 'sp';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Ayuda');
    el.innerHTML =
      '<header class="sp-top"><button class="pf-round" data-sp="back" aria-label="Volver"><span class="material-symbols-rounded">arrow_back</span></button>' +
        '<span class="sp-top__title"><b>Ayuda</b><small></small></span><span></span></header>' +
      '<div class="sp-body">' +
        '<div class="sp-hub">' +
          '<div class="sp-hello"></div>' +
          '<label class="sp-find"><span class="material-symbols-rounded" aria-hidden="true">search</span><input type="search" placeholder="Busca en la ayuda" aria-label="Busca en la ayuda" data-sp-find></label>' +
          '<div class="sp-found" hidden></div>' +
          '<section class="sp-sec"><h2>Lo más consultado</h2><div class="sp-list">' + [0, 1, 3, 6, 5].map(function (i) { return faqRow(i); }).join('') + '</div></section>' +
          '<section class="sp-sec"><h2>Categorías</h2><div class="sp-cats">' + CATS.map(function (c) {
            var n = FAQ.filter(function (f) { return f.cat === c[0]; }).length + TUT.filter(function (u) { return u.cat === c[0]; }).length;
            return '<button class="sp-cat" data-sp="cat:' + c[0] + '"><span class="sp-row__ic material-symbols-rounded">' + c[1] + '</span><b>' + c[2] + '</b><small>' + n + ' temas</small></button>';
          }).join('') + '</div></section>' +
          '<section class="sp-sec"><h2>Tutoriales</h2><div class="sp-tuts">' + TUT.map(function (u, i) {
            return '<button class="sp-tut" data-sp="tut:' + i + '"><span class="sp-row__ic material-symbols-rounded">' + u.icon + '</span><b>' + u.t + '</b><small>' + u.steps.length + ' pasos · ' + u.min + ' min</small></button>';
          }).join('') + '</div></section>' +
          '<section class="sp-sec sp-sec--people"><h2>Trámites con un asesor</h2><p class="sp-sec__sub">Solo para lo que no se puede hacer en la app: créditos hipotecarios, reestructurar una deuda, herencias y poderes, o un reclamo que ya está en curso.</p><div class="sp-list">' + CONTACT.map(function (c) {
            return '<button class="sp-row" data-sp="' + c[3] + '"><span class="sp-row__ic material-symbols-rounded">' + c[0] + '</span><span class="sp-row__main"><b>' + c[1] + '</b><small>' + c[2] + '</small></span><span class="material-symbols-rounded">chevron_right</span></button>';
          }).join('') + '</div></section>' +
        '</div>' +
        '<div class="sp-page" hidden></div>' +
        '<div class="sp-log" aria-live="polite"></div>' +
      '</div>' +
      '<form class="sp-composer"><input type="text" enterkeyhint="send" autocomplete="off" placeholder="Pregúntame lo que necesites" aria-label="Escribe tu problema">' +
        '<button class="sp-send" aria-label="Enviar"><span class="material-symbols-rounded">arrow_upward</span></button></form>';
    document.body.appendChild(el);
    log = el.querySelector('.sp-log');
    pageEl = el.querySelector('.sp-page');
    var fi = el.querySelector('[data-sp-find]');
    fi.addEventListener('input', function () { paintFound(fi.value); });
    input = el.querySelector('.sp-composer input');
    el.addEventListener('click', onClick);
    el.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim(); if (!v) return;
      input.value = ''; send(v);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el.classList.contains('open')) { e.stopImmediatePropagation(); back(); }
    }, true);
  }

  /* ---------- Mensajes ---------- */
  function scrollEnd() { var b = el.querySelector('.sp-body'); requestAnimationFrame(function () { b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' }); }); }
  function add(html) { var d = document.createElement('div'); d.innerHTML = html; var n = d.firstChild; log.appendChild(n); scrollEnd(); return n; }
  function btns(list) {
    return list && list.length ? '<div class="sp-acts">' + list.map(function (b) {
      return b[1].indexOf('tel:') === 0 ? '<a class="sp-act" href="' + b[1] + '">' + b[0] + '</a>' : '<button class="sp-act" data-sp="' + b[1] + '">' + b[0] + '</button>';
    }).join('') + '</div>' : '';
  }
  function me(t) { add('<div class="sp-msg sp-msg--me"><p>' + esc(t) + '</p></div>'); }
  function sys(t) { add('<p class="sp-sys">' + t + '</p>'); }
  // Uku "escribe" un momento antes de responder
  function say(html, acts, delay) {
    var typing = add('<div class="sp-msg sp-msg--uku"><span class="sp-av">' + face() + '</span><div class="sp-msg__body"><p class="sp-typing"><i></i><i></i><i></i></p></div></div>');
    setTimeout(function () {
      typing.querySelector('.sp-msg__body').innerHTML = '<p>' + html + '</p>' + btns(acts);
      scrollEnd();
    }, delay == null ? 650 : delay);
  }
  function agentSay(t, delay) {
    var typing = add('<div class="sp-msg sp-msg--agent"><span class="sp-av sp-av--agent">' + AGENT.ini + '</span><div class="sp-msg__body"><small>' + AGENT.name + '</small><p class="sp-typing"><i></i><i></i><i></i></p></div></div>');
    setTimeout(function () { typing.querySelector('.sp-typing').outerHTML = '<p>' + esc(t) + '</p>'; scrollEnd(); fx('select'); }, delay || 1200);
  }

  /* ---------- Conversación ---------- */
  function chat() { el.classList.add('is-chat'); }
  function answer(i) {
    var f = FAQ[i]; topic = f.t; chat();
    me(f.t);
    reply(f);
  }
  function reply(f, lead) {
    misses = 0;
    say((lead || '') + esc(typeof f.a === 'function' ? f.a() : f.a), f.acts);
    setTimeout(function () { say('¿Te sirvió?', [['Sí, gracias', 'ok'], ['No, es otra cosa', 'other']], 500); }, 1100);
  }
  function topicChips(n) { return FAQ.slice(0, n).map(function (f) { return [f.t, 'faq:' + FAQ.indexOf(f)]; }); }
  function handoff() {
    say('Te paso con una persona del banco. Le cuento lo que ya hablamos para que no tengas que repetirlo. ¿Cómo prefieres?',
      CONTACT.map(function (c) { return [c[1], c[3]]; }));
  }
  function summary() {
    return '<span class="sp-case"><b>Resumen para el asesor · caso ' + CASE + '</b>' +
      '<span>Tema: ' + esc(topic || 'Consulta general') + '</span>' +
      '<span>Cliente verificado en la app' + (firstName() ? ' (' + esc(firstName()) + ')' : '') + '</span>' +
      '<span>Ya revisó: ' + (FAQ.some(function (f) { return f.t === topic; }) ? 'la ayuda de este tema' : 'las ayudas frecuentes') + '</span></span>';
  }
  function toAgent() {
    if (withAgent) return;
    chat();
    say('Listo, te conecto. Esto es lo que le paso:' + summary(), null, 500);
    setTimeout(function () { sys('Buscando un asesor disponible…'); }, 1300);
    setTimeout(function () {
      withAgent = true; el.classList.add('is-agent');
      el.querySelector('.sp-top__title b').textContent = AGENT.name;
      el.querySelector('.sp-top__title small').textContent = 'Asesora de Pichibank';
      input.placeholder = 'Escríbele a ' + AGENT.name.split(' ')[0];
      sys(AGENT.name + ' se unió al chat. Desde aquí te responde una persona, no ' + uku() + '.');
      fx('success');
      agentSay('Hola' + (firstName() ? ', ' + firstName() : '') + '. Soy Andrea. Ya vi tu caso sobre «' + (topic || 'tu consulta') + '». ¿Me cuentas la fecha y el monto aproximado para revisarlo?', 1400);
    }, 3000);
  }
  var AGENT_REPLIES = ['Gracias, ya lo estoy revisando. Dame un momento, por favor.', 'Listo, lo registré en tu caso ' + CASE + '. Te llega un correo con el detalle y la respuesta en máximo 48 horas.', '¿Hay algo más en lo que te pueda ayudar?'];
  function send(t) {
    chat(); me(t);
    if (withAgent) { agentSay(AGENT_REPLIES[Math.min(agentN++, AGENT_REPLIES.length - 1)], 1600); return; }
    var q = norm(t);
    if (COMPLEX.test(q)) {
      topic = t;
      return say('Eso no se puede hacer en la app, así que lo ve un asesor. Le paso tu caso con un resumen para que no repitas nada. ¿Cómo prefieres?', CONTACT.map(function (c) { return [c[1], c[3]]; }));
    }
    if (/(persona|asesor|humano|agente|llamar|llamen|call)/.test(q)) {
      return say('Casi todo lo puedes resolver aquí mismo, y es más rápido. ¿De qué se trata?', topicChips(3).concat([['Es un trámite que no está en la app', 'handoff']]));
    }
    if (/(gast|ahorr|presupuest|metas?\b|cuanto tengo)/.test(q)) {
      return say('Eso lo vemos mejor en Mis finanzas: ahí tienes tu dinero de hoy, tus gastos, presupuestos y metas.', [['Ir a Mis finanzas', 'pfm']]);
    }
    var best = -1, bs = 0;
    FAQ.forEach(function (f, i) {
      var sc = 0, k = ' ' + norm(f.t + ' ' + f.k) + ' ';
      q.split(/\s+/).forEach(function (w) { if (w.length > 2 && k.indexOf(w) >= 0) sc++; });
      if (sc > bs) { bs = sc; best = i; }
    });
    if (best >= 0) { topic = FAQ[best].t; return reply(FAQ[best]); }
    topic = t;
    if (++misses < 2) return say('No encontré eso. ¿Me lo dices de otra forma? O elige uno de estos temas:', topicChips(4));
    say('Sigo sin encontrarlo. Si es un trámite que no está en la app, te paso con un asesor con lo que ya me contaste.', [['Hablar con un asesor', 'handoff'], ['Ver todos los temas', 'back']]);
  }

  function onClick(e) {
    var b = e.target.closest('[data-sp]');
    if (!b) return;
    var k = b.dataset.sp;
    fx('select');
    // Elegir una opción de contacto deja la elección como respuesta y quita las demás
    var grp = /^(agent|call|callback)$/.test(k) && b.closest('.sp-acts');
    if (grp) { grp.remove(); me(b.textContent); }
    if (k === 'back') { if (b.closest('.sp-acts')) { reset(); el.querySelector('.sp-body').scrollTop = 0; return; } return back(); }
    if (k.indexOf('faq:') === 0) { var fa = b.closest('.sp-acts'); if (fa) fa.remove(); hidePage(); return answer(+k.slice(4)); }
    if (k.indexOf('cat:') === 0) return catPage(k.slice(4));
    if (k.indexOf('tut:') === 0) return tutPage(+k.slice(4));
    if (k === 'ask') { hidePage(); chat(); say('Cuéntame qué pasó y te ayudo.'); setTimeout(function () { input.focus(); }, 600); return; }
    if (k === 'askq') { var fq = el.querySelector('[data-sp-find]'), qq = fq.value.trim(); fq.value = ''; paintFound(''); if (qq) send(qq); return; }
    if (k === 'search') { close(); setTimeout(function () { window.Buscador && Buscador.open(); }, 300); return; }
    if (k === 'other') { b.closest('.sp-acts').remove(); me('No, es otra cosa'); say('Cuéntame con tus palabras qué necesitas.'); setTimeout(function () { input.focus(); }, 700); return; }
    if (k === 'review') {
      var ra = b.closest('.sp-acts'); if (ra) { ra.remove(); me(b.textContent); }
      log.querySelectorAll('[data-sp="ok"]').forEach(function (x) { x.closest('.sp-acts').remove(); });
      return review(true);
    }
    if (k.indexOf('card:') === 0) {
      var cn = k.slice(5); close();
      setTimeout(function () {
        if (window.__goView) window.__goView(0);
        var r = document.querySelector('#home-page [data-panel="Tarjetas"] .product-row[data-action="' + cn + '"]'); if (r) r.click();
      }, 300);
      return;
    }
    if (k === 'ok') { b.closest('.sp-acts').remove(); me('Sí, gracias'); return say('¡Qué bueno! Aquí estoy si necesitas algo más.'); }
    if (k === 'handoff') { chat(); var a = b.closest('.sp-acts'); if (a) { a.remove(); me(b.textContent); } return handoff(); }
    if (k === 'agent') return toAgent();
    if (k === 'call') {
      chat();
      return say('Llama al <b>' + PHONE + '</b> (las 24 horas). Dale este código al asesor y ya sabrá de qué se trata: <b>' + CASE + '</b>.', [['Llamar ahora', 'tel:' + PHONE.replace(/\s/g, '')]]);
    }
    if (k === 'callback') {
      chat();
      return say('¿Cuándo te llamamos al 099 *** 4521?', [['Ahora', 'cb:en unos minutos'], ['En 30 minutos', 'cb:en 30 minutos'], ['Mañana en la mañana', 'cb:mañana entre 9:00 y 11:00']]);
    }
    if (k.indexOf('cb:') === 0) {
      b.closest('.sp-acts').remove(); me(b.textContent); fx('success');
      return say('Listo. Un asesor te llama ' + esc(k.slice(3)) + '. Ya tiene el resumen de tu caso ' + CASE + ', así que no tendrás que repetir nada.');
    }
    if (k === 'pfm') { close(); setTimeout(function () { window.Asistente && Asistente.openPF(); }, 300); return; }
    if (k.indexOf('tab:') === 0) {
      var tab = k.slice(4); close();
      setTimeout(function () {
        if (window.__goView) window.__goView(0);
        var t = document.querySelector('.tabs .tab[data-panel="' + tab + '"]'); if (t) t.click();
      }, 300);
      return;
    }
    if (k.indexOf('do:') === 0) {
      var act = k.slice(3); close();
      setTimeout(function () {
        var x = document.querySelector('#home-page [data-action="' + act + '"]') || document.querySelector('[data-action="' + act + '"]');
        if (x) x.click();
      }, 300);
    }
  }


  /* ---------- Solicitud de revisión de un consumo (tarjeta de crédito) ----------
     Eliges el consumo, cuentas qué pasó y se envía. Toma de 2 a 6 semanas. */
  var sh, shBack, rv = null;
  function ensureSheet() {
    if (sh) return;
    shBack = document.createElement('div'); shBack.className = 'as-sheet-back';
    sh = document.createElement('div'); sh.className = 'as-sheet sp-review'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Solicitar revisión');
    document.body.appendChild(shBack); document.body.appendChild(sh);
    shBack.addEventListener('click', closeSheet);
    sh.addEventListener('click', onSheet);
  }
  function closeSheet() { shBack.classList.remove('open'); sh.classList.remove('open'); }
  function sheetHTML(html) { sh.innerHTML = '<div class="as-sheet__handle"></div>' + html; sh.scrollTop = 0; }
  function cardTx() {
    var d = window.Asistente && Asistente.data && Asistente.data(), MON = ['ago', 'sep', 'oct'];
    var list = d ? d.tx.filter(function (t) { return t.acct === 'and1'; }).sort(function (a, b) { return (b.mi * 40 + b.day) - (a.mi * 40 + a.day); }).slice(0, 6) : [];
    if (!list.length) list = [{ who: 'Mercado Libre', amt: 74.9, day: 5, mi: 2 }, { who: 'Cinemark', amt: 18.5, day: 2, mi: 2 }];
    return list.map(function (t) { return { who: t.who, amt: t.amt, date: t.day + ' ' + MON[t.mi] }; });
  }
  var REASONS = ['No lo hice yo', 'Me cobraron dos veces', 'El monto no coincide', 'No recibí lo que compré'];
  function rvStep1() {
    rv.list = cardTx();
    sheetHTML('<h3>¿Qué consumo no reconoces?</h3><p>Mastercard Black · últimos consumos</p><div class="sp-rv-list">' + rv.list.map(function (t, i) {
      return '<button class="sp-rv-tx" data-rv="tx:' + i + '"><span><b>' + esc(t.who) + '</b><small>' + t.date + '</small></span><b>-' + money(t.amt) + '</b></button>';
    }).join('') + '</div>');
  }
  function rvStep2() {
    var t = rv.list[rv.tx];
    sheetHTML('<h3>¿Qué pasó?</h3><p>' + esc(t.who) + ' · ' + t.date + ' · ' + money(t.amt) + '</p>' +
      '<div class="sp-rv-chips">' + REASONS.map(function (r, i) { return '<button class="sx-chip" data-rv="why:' + i + '" aria-pressed="' + (rv.why === i) + '">' + r + '</button>'; }).join('') + '</div>' +
      '<p class="as-sheet__label">¿Tienes tu tarjeta contigo?</p><div class="sp-rv-chips">' +
        '<button class="sx-chip" data-rv="has:1" aria-pressed="' + (rv.has === 1) + '">Sí, la tengo</button><button class="sx-chip" data-rv="has:0" aria-pressed="' + (rv.has === 0) + '">No la tengo</button></div>' +
      '<button class="pf-cta" data-rv="next"' + (rv.why == null || rv.has == null ? ' disabled' : '') + '>Continuar</button>');
  }
  function rvStep3() {
    var t = rv.list[rv.tx];
    sheetHTML('<h3>Revisa tu solicitud</h3><div class="sp-case sp-rv-sum">' +
      '<span><small>Consumo</small><b>' + esc(t.who) + ' · ' + money(t.amt) + '</b></span><span><small>Fecha</small><b>' + t.date + '</b></span><span><small>Motivo</small><b>' + REASONS[rv.why] + '</b></span></div>' +
      '<ul class="sp-rv-info"><li>Revisamos el consumo con el comercio y la marca de tu tarjeta. Toma entre 2 y 6 semanas.</li>' +
      '<li>Mientras tanto, ese monto no te genera intereses.</li>' +
      (rv.has === 0 ? '<li>Como no tienes la tarjeta, la bloqueamos al enviar y te mandamos una nueva.</li>' : '') + '</ul>' +
      '<button class="pf-cta" data-rv="send">Enviar solicitud</button>');
  }
  function rvDone() {
    var t = rv.list[rv.tx], n = 'R-' + (20400 + Math.floor(Math.random() * 90));
    sheetHTML('<div class="pf-linking"><span class="pf-done material-symbols-rounded">check</span><h3>Solicitud enviada</h3><p>N.º ' + n + ' · ' + esc(t.who) + ' · ' + money(t.amt) + '<br>Te avisamos por notificación y correo cuando haya novedades.</p>' +
      '<button class="pf-cta" data-rv="close">Listo</button></div>');
    fx('success');
    if (rv.fromChat) say('Listo, tu solicitud ' + n + ' está en revisión. Toma entre 2 y 6 semanas; te aviso apenas haya novedades.' + (rv.has === 0 ? ' También bloqueamos tu tarjeta y te enviamos una nueva.' : ''), null, 900);
  }
  function onSheet(e) {
    var b = e.target.closest('[data-rv]'); if (!b || b.disabled) return;
    var k = b.dataset.rv; fx('select');
    if (k.indexOf('tx:') === 0) { rv.tx = +k.slice(3); return rvStep2(); }
    if (k.indexOf('why:') === 0) { rv.why = +k.slice(4); return rvStep2(); }
    if (k.indexOf('has:') === 0) { rv.has = +k.slice(4); return rvStep2(); }
    if (k === 'next') return rvStep3();
    if (k === 'send') { sheetHTML('<div class="pf-linking"><span class="pf-spinner"></span><h3>Enviando tu solicitud…</h3></div>'); setTimeout(rvDone, 1100); return; }
    if (k === 'close') closeSheet();
  }
  function review(fromChat) {
    ensureSheet();
    rv = { fromChat: !!fromChat, why: null, has: null };
    rvStep1();
    shBack.classList.add('open'); sh.classList.add('open'); fx('open');
  }

  function reset() {
    hidePage();
    var fi = el.querySelector('[data-sp-find]'); if (fi) { fi.value = ''; paintFound(''); }
    log.innerHTML = ''; topic = null; withAgent = false; agentN = 0; misses = 0;
    el.classList.remove('is-chat', 'is-agent');
    el.querySelector('.sp-top__title b').textContent = 'Ayuda';
    el.querySelector('.sp-top__title small').textContent = '';
    input.placeholder = 'Pregúntame lo que necesites';
  }
  function open() {
    if (!el) mount();
    if (!withAgent) reset(); // con un asesor conectado, la conversación sigue
    el.querySelector('.sp-hello').innerHTML = '<span class="sp-av">' + face() + '</span><p>Hola' + (firstName() ? ', ' + esc(firstName()) : '') + '. Soy ' + uku() +
      '. Pregúntame lo que necesites: te doy la respuesta con tus datos y te llevo a donde lo resuelves tú mismo.</p>';
    if (!withAgent) el.querySelector('.sp-body').scrollTop = 0;
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
    fx('open');
  }
  // Volver: del chat al inicio de Ayuda; desde ahí, cerrar
  function back() {
    if (el.classList.contains('is-page')) { hidePage(); el.querySelector('.sp-body').scrollTop = 0; return; }
    if (el.classList.contains('is-chat') && !withAgent) { reset(); el.querySelector('.sp-body').scrollTop = 0; return; }
    close();
  }
  function close() {
    el.classList.remove('open');
    if (!document.querySelector('.as-page.open, .push-page.open, .card-detail.open')) document.body.style.overflow = '';
    fx('close');
  }

  // El ícono de soporte (audífonos) y "Ayuda" del Perfil abren esta pantalla
  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-action="Revisar consumo"]');
    if (r) { e.stopImmediatePropagation(); e.preventDefault(); review(false); return; }
    var b = e.target.closest('[data-action="Soporte"], [data-action="Ayuda"]');
    if (!b || (el && el.contains(b))) return;
    e.stopImmediatePropagation(); e.preventDefault();
    open();
  }, true);

  window.Soporte = { open: open, review: function () { review(false); }, find: find,
    faqs: function (n) { return FAQ.slice(0, n || FAQ.length).map(function (f, i) { return { kind: 'faq', i: i, icon: f.icon, t: f.t }; }); },
    // Para que Uku responda la ayuda dentro de su conversación (versión asistente)
    tuts: function () { return TUT.map(function (u, i) { return { kind: 'tut', i: i, icon: u.icon, t: u.t }; }); },
    faq: function (i) { var f = FAQ[i]; return f && { t: f.t, icon: f.icon, a: typeof f.a === 'function' ? f.a() : f.a, acts: f.acts || [] }; },
    tut: function (i) { var u = TUT[i]; return u && { t: u.t, icon: u.icon, min: u.min, steps: u.steps, act: u.act }; },
    contact: function () { return { phone: PHONE, caso: CASE, opts: CONTACT.map(function (c) { return { icon: c[0], t: c[1], s: c[2], k: c[3] }; }) }; },
    // Ejecuta una acción de la ayuda (ir a un flujo, a una tarjeta, pedir revisión o pasar con un asesor)
    run: function (k) {
      if (k === 'review') return review(true);
      if (k === 'agent') { open(); topic = topic || 'Consulta desde Uku'; return toAgent(); }
      var go = function (fn) { setTimeout(fn, 60); };
      if (k.indexOf('do:') === 0) return go(function () { var x = document.querySelector('#home-page [data-action="' + k.slice(3) + '"]') || document.querySelector('[data-action="' + k.slice(3) + '"]'); if (x) x.click(); });
      if (k.indexOf('card:') === 0) return go(function () { if (window.__goView) window.__goView(0); var r = document.querySelector('#home-page [data-panel="Tarjetas"] .product-row[data-action="' + k.slice(5) + '"]'); if (r) r.click(); });
      if (k.indexOf('tab:') === 0) return go(function () { if (window.__goView) window.__goView(0); var t = document.querySelector('.tabs .tab[data-panel="' + k.slice(4) + '"]'); if (t) t.click(); });
      if (k === 'pfm') return window.Asistente && Asistente.openPF();
    },
    openFaq: function (i) { open(); answer(i); }, openTut: function (i) { open(); tutPage(i); } };
})();
