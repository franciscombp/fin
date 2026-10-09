/* =====================================================================
   Contexto — qué está mirando la persona y qué le puede decir Uku
   ---------------------------------------------------------------------
   · get(): la sección actual (pestaña de Inicio, Mis finanzas, detalle de
     tarjeta…).
   · info(id): título, saludo, insights (con su pregunta para Uku),
     acciones del buscador y preguntas sugeridas de esa sección.
   · answer(texto): respuestas por reglas para las preguntas de cada
     sección (tarjetas, préstamos, inversiones, seguros, cuentas).
   · Uku acompaña: un botón con su cara (abajo a la derecha) que, al
     cambiar de sección, dice en una burbuja lo más útil de esa sección.
     Tocarlo abre el asistente ya en ese contexto.
   Los datos son los mismos que muestra la pantalla (y los de Mis finanzas).
   ===================================================================== */
(function () {
  'use strict';

  function T(s, v) { return window.I18n ? I18n.t(s, v) : s.replace(/\{(\w+)\}/g, function (m, k) { return v && k in v ? v[k] : m; }); }
  function money(v) {
    var s = Math.abs(v).toFixed(2).split('.');
    return (v < 0 ? '-' : '') + '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function D() { return window.Asistente && Asistente.data ? Asistente.data() : null; }

  /* ---------- Datos de los productos (los mismos de la pantalla) ---------- */
  var SUBS = [['Uber Eats', 4.99], ['Spotify', 5.99], ['Disney+ Premium', 13.99], ['Netflix', 10.99], ['YouTube Premium', 11.99], ['iCloud+', 2.99], ['Gympass', 39.99]];
  var LOAN = { saldo: 7380.5, cuota: 245.9, n: 6, de: 36, tasa: .156, pre: 5000 };
  var DEP = { monto: 3000, tasa: .0725, interes: 217.5 };
  var SEG = { vida: 12.9, prot: 3.5 };
  var MOV = { saldo: 8.5, pasaje: .45 };
  var CORRIENTE = 1440.35;
  function subsTotal() { return SUBS.reduce(function (s, x) { return s + x[1]; }, 0); }
  function subsTop() { return SUBS.slice().sort(function (a, b) { return b[1] - a[1]; }); }
  function cuotaDe(P, n, tasa) { var r = tasa / 12; return P * r / (1 - Math.pow(1 + r, -n)); }
  function libre() { var d = D(); if (!d) return 0; var s = d.by[1]; return s._in - s._spend - s._save; }

  /* ---------- Secciones ---------- */
  var ACCIONES = {
    inicio: ['Transferir', 'Pagar servicios', 'Pagar con QR', 'Mis finanzas'],
    cuentas: ['Transferir', 'Recibir dinero', 'Retirar sin tarjeta', 'Mis cuentas'],
    tarjetas: ['Pagar tarjeta', 'Mis tarjetas', 'Pagar transporte', 'Seguridad'],
    prestamos: ['Préstamos', 'Transferir', 'Mis finanzas'],
    inversiones: ['Inversiones', 'Transferir', 'Mis finanzas'],
    seguros: ['Seguros', 'Mis tarjetas', 'Seguridad'],
    finanzas: ['Mis finanzas', 'Pagar servicios', 'Transferir']
  };
  var PREGUNTAS = {
    inicio: ['¿En qué se me va la plata?', '¿Cómo voy con mis metas?', '¿Cuánto más puedo ahorrar?'],
    cuentas: ['¿Cuánto tengo en total?', '¿Me conviene un Ahorro Flexible?', '¿En qué se me va la plata?'],
    tarjetas: ['¿Cuándo pago mi Mastercard?', 'Mis suscripciones', '¿Para cuántos viajes me alcanza la Movilidad?'],
    prestamos: ['¿Cuánto me falta del préstamo?', '¿Y si abono $ 500 extra?', '¿Me conviene el crédito preaprobado?'],
    inversiones: ['¿Qué hago cuando venza mi depósito?', '¿Cuánto ganaría si invierto $ 1.000?'],
    seguros: ['¿Qué cubren mis seguros?', '¿Cuánto pago en seguros?'],
    finanzas: ['¿En qué me pasé?', '¿Cuánto más puedo ahorrar?', 'Septiembre vs. agosto']
  };
  var TITULOS = {
    inicio: ['Para ti', '¿En qué te ayudo hoy?'],
    cuentas: ['Tus cuentas', '¿Qué quieres saber de tus cuentas?'],
    tarjetas: ['Tus tarjetas', '¿Qué quieres saber de tus tarjetas?'],
    prestamos: ['Tu préstamo', '¿Qué quieres saber de tu préstamo?'],
    inversiones: ['Tus inversiones', '¿Qué quieres saber de tus inversiones?'],
    seguros: ['Tus seguros', '¿Qué quieres saber de tus seguros?'],
    finanzas: ['Tu mes', '¿Qué quieres revisar de tu mes?']
  };

  function insights(id) {
    var d = D(), top = subsTop(), r = [];
    if (id === 'tarjetas') {
      if (d && d.card) r.push({ icon: 'credit_card', t: T('Tu Mastercard Black tiene {deuda} por pagar', { deuda: money(d.debt) }), s: T('Págala completa antes del 5 de noviembre y no pagas intereses.'), q: '¿Cuándo pago mi Mastercard?' });
      r.push({ icon: 'autorenew', t: T('Pagas {total} al mes en suscripciones', { total: money(subsTotal()) }), s: T('{lugar} y {lugar2} son las más caras.', { lugar: top[0][0], lugar2: top[1][0] }), q: 'Mis suscripciones' });
      r.push({ icon: 'directions_bus', t: T('Tu Movilidad alcanza para unos {n} viajes', { n: Math.floor(MOV.saldo / MOV.pasaje) }), s: T('Tiene {saldo}. Recárgala antes de quedarte sin saldo.', { saldo: money(MOV.saldo) }), q: '¿Para cuántos viajes me alcanza la Movilidad?' });
    } else if (id === 'cuentas') {
      if (d) r.push({ icon: 'account_balance', t: T('Tienes {total} entre tus cuentas', { total: money(d.assets) }), s: T('El {pct} está en la corriente, que no gana intereses.', { pct: Math.round(CORRIENTE / d.assets * 100) + '%' }), q: '¿Me conviene un Ahorro Flexible?' });
      if (d) { var s = d.by[1], tc = Object.keys(s).filter(function (k) { return k[0] !== '_'; }).sort(function (a, b) { return s[b] - s[a]; })[0];
        r.push({ icon: 'insights', t: T('En septiembre gastaste {monto}', { monto: money(s._spend) }), s: T('Lo que más se lleva es {cat}.', { cat: T(catName(tc)).toLowerCase() }), q: '¿En qué se me va la plata?' }); }
    } else if (id === 'prestamos') {
      r.push({ icon: 'event', t: T('Tu próxima cuota es de {cuota}', { cuota: money(LOAN.cuota) }), s: T('Vence el 15 de octubre. Llevas {n} de {de} cuotas.', { n: LOAN.n, de: LOAN.de }), q: '¿Cuánto me falta del préstamo?' });
      r.push({ icon: 'request_quote', t: T('Tienes {monto} preaprobados', { monto: money(LOAN.pre) }), s: T('La cuota sería de unos {cuota} al mes. Mira si te alcanza antes de usarlo.', { cuota: money(cuotaDe(LOAN.pre, 36, LOAN.tasa)) }), q: '¿Me conviene el crédito preaprobado?' });
      r.push({ icon: 'savings', t: T('Un abono de {monto} te ahorra {n} cuotas', { monto: money(500), n: Math.floor(500 / LOAN.cuota) }), s: T('Si te sobra algo este mes, abónalo a capital.'), q: '¿Y si abono $ 500 extra?' });
    } else if (id === 'inversiones') {
      r.push({ icon: 'event', t: T('Tu depósito vence el 12 de noviembre'), s: T('Te deja {interes}. Decide antes si lo renuevas.', { interes: money(DEP.interes) }), q: '¿Qué hago cuando venza mi depósito?' });
      r.push({ icon: 'trending_up', t: T('Tienes {monto} sin ganar intereses', { monto: money(CORRIENTE) }), s: T('En un depósito al 7,25% ganarían unos {gana} al año.', { gana: money(CORRIENTE * DEP.tasa) }), q: '¿Cuánto ganaría si invierto $ 1.000?' });
    } else if (id === 'seguros') {
      r.push({ icon: 'shield', t: T('Pagas {total} al mes en seguros', { total: money(SEG.vida + SEG.prot) }), s: T('Vida y protección de tarjetas.'), q: '¿Cuánto pago en seguros?' });
      r.push({ icon: 'verified_user', t: T('Tus tarjetas están protegidas contra fraude'), s: T('Si ves un cobro raro, repórtalo desde la tarjeta.'), q: '¿Qué cubren mis seguros?' });
    } else if (window.Asistente && Asistente.insights) {
      Asistente.insights().slice(0, 3).forEach(function (x) { r.push({ icon: x.icon, t: x.title, s: x.sub, q: x.ask || '¿Cómo voy en general?' }); });
    }
    return r;
  }
  function catName(k) {
    return { super: 'Supermercado', delivery: 'Restaurantes y delivery', transporte: 'Transporte', servicios: 'Servicios básicos', subs: 'Suscripciones', compras: 'Compras', cafe: 'Cafés y antojos', salud: 'Salud', ocio: 'Ocio' }[k] || k;
  }

  /* ---------- ¿Dónde está la persona? ---------- */
  function get() {
    if (document.querySelector('.pf-page.open')) return 'finanzas';
    if (document.querySelector('.card-detail.open')) return 'tarjetas';
    var t = document.querySelector('.tabs .tab.active');
    var id = t ? t.dataset.panel.toLowerCase() : 'destacado';
    return ACCIONES[id] ? id : 'inicio';
  }
  function info(id) {
    id = id || get();
    var tt = TITULOS[id] || TITULOS.inicio;
    return { id: id, titulo: tt[0], saludo: tt[1], insights: insights(id), acciones: ACCIONES[id] || ACCIONES.inicio, preguntas: PREGUNTAS[id] || PREGUNTAS.inicio };
  }

  /* ---------- Respuestas por sección (reglas, sin IA) ---------- */
  function answer(s) {
    var d = D(), top = subsTop();
    if (/mastercard|cuando pago|fecha (de|limite)|corte/.test(s)) {
      return { t: T('Tu Mastercard Black tiene <b>{deuda}</b> por pagar. La fecha límite es el 5 de noviembre: si pagas el total, no te cobran intereses.', { deuda: money(d ? d.debt : 0) }),
        s: ['¿Cuánto pago de intereses?', '¿Cuánto debo en mi tarjeta?'] };
    }
    if (/movilidad|viajes|pasaje|metro/.test(s)) {
      var n = Math.floor(MOV.saldo / MOV.pasaje);
      return { t: T('Tu tarjeta Movilidad tiene <b>{saldo}</b>: te alcanza para unos {n} viajes en Metro ({pasaje} cada uno). Si la usas para ir y volver cada día, te dura unos {dias} días.', { saldo: money(MOV.saldo), n: n, pasaje: money(MOV.pasaje), dias: Math.floor(n / 2) }),
        s: ['¿Cuánto gasté en transporte?', '¿Cuándo pago mi Mastercard?'] };
    }
    if (/bloque|perdi|robaron|robo/.test(s)) {
      return { t: T('Si la perdiste o te la robaron, bloquéala ahora: en Tarjetas, toca la tarjeta y luego Bloquear. Puedes desbloquearla después si la encuentras.'), s: ['¿Qué cubren mis seguros?'] };
    }
    if (/preaprobado|credito nuevo|me conviene el credito/.test(s)) {
      var c = cuotaDe(LOAN.pre, 36, LOAN.tasa), l = libre();
      return { t: T('Tienes <b>{monto}</b> preaprobados. A 36 meses, la cuota sería de unos {cuota}.', { monto: money(LOAN.pre), cuota: money(c) }) + ' ' +
          (l <= 0 ? T('Hoy no te sobra plata al final del mes, así que esa cuota te dejaría corto. Úsalo solo para algo necesario o para pagar una deuda más cara.')
            : c > l ? T('Hoy te sobran unos {libre} al mes, así que esa cuota te dejaría corto. Úsalo solo para algo necesario o para pagar una deuda más cara.', { libre: money(l) })
            : T('Te alcanzaría, pero piensa si de verdad lo necesitas: son {total} en intereses.', { total: money(c * 36 - LOAN.pre) })),
        s: ['¿Cuánto me falta del préstamo?', '¿Cuánto más puedo ahorrar?'] };
    }
    if (/abono|abonar|adelantar|extra/.test(s) && !/ahorr/.test(s)) {
      var k = Math.floor(500 / LOAN.cuota);
      return { t: T('Un abono extra de <b>{monto}</b> a capital te ahorra unas {n} cuotas y los intereses de esos meses. Pide que se aplique a capital y no a la próxima cuota.', { monto: money(500), n: k }),
        s: ['¿Cuánto me falta del préstamo?', '¿Me conviene el crédito preaprobado?'] };
    }
    if (/prestamo|me falta|cuota/.test(s)) {
      var left = LOAN.de - LOAN.n;
      return { t: T('Te quedan <b>{saldo}</b> de tu préstamo de consumo. Vas en la cuota {n} de {de}: la próxima es de {cuota} y vence el 15 de octubre. Si pagas a tiempo, terminas en {meses} meses.', { saldo: money(LOAN.saldo), n: LOAN.n, de: LOAN.de, cuota: money(LOAN.cuota), meses: left }),
        s: ['¿Y si abono $ 500 extra?', '¿Me conviene el crédito preaprobado?'] };
    }
    if (/deposito|venza|vence|renov/.test(s)) {
      return { t: T('Tu depósito a plazo de <b>{monto}</b> vence el 12 de noviembre y te deja {interes}. Si no necesitas la plata, renovarlo mantiene la tasa del 7,25%. Si la necesitas, pásala a tu fondo de emergencia.', { monto: money(DEP.monto), interes: money(DEP.interes) }),
        s: ['¿Cuánto ganaría si invierto $ 1.000?', '¿Cómo voy con mis metas?'] };
    }
    if (/invert|invierto|ganaria|rendimiento|tasa/.test(s)) {
      return { t: T('Si inviertes {base} al 7,25% anual, ganarías unos <b>{gana}</b> en un año. Hoy tienes {corriente} en tu cuenta corriente sin ganar intereses.', { base: money(1000), gana: money(1000 * DEP.tasa), corriente: money(CORRIENTE) }),
        s: ['¿Qué hago cuando venza mi depósito?', '¿Me conviene un Ahorro Flexible?'] };
    }
    if (/seguro|cubre|cobertura|prima/.test(s)) {
      return { t: T('Pagas <b>{total} al mes</b> en 2 seguros: vida ({vida}) y protección de tarjetas ({prot}). La protección cubre fraude y clonación de tus tarjetas. El de vida se renueva el 1 de enero.', { total: money(SEG.vida + SEG.prot), vida: money(SEG.vida), prot: money(SEG.prot) }),
        s: ['¿Cuánto pago en suscripciones?', '¿Cuánto tengo en total?'] };
    }
    if (/ahorro flexible|no gana|corriente/.test(s)) {
      return { t: T('Tienes {corriente} en tu cuenta corriente, que no gana intereses. Si pasas {monto} a un Ahorro Flexible, ganarías unos {gana} al año y sigues teniendo la plata disponible.', { corriente: money(CORRIENTE), monto: money(1000), gana: money(1000 * .0125) }),
        s: ['¿Cuánto ganaría si invierto $ 1.000?', '¿Cuánto tengo en total?'] };
    }
    return null;
  }

  /* ---------- Uku acompaña: botón y burbuja ---------- */
  var dock, tip, tipT, said = {};
  function homeVisible() {
    var h = document.getElementById('home-page');
    return h && !h.classList.contains('hidden') && !document.querySelector('.push-page.open, .as-page.open, .pf-page.open, .sheet.open, .as-sheet.open, .card-detail.open, #login-screen.active, .sx.open, .story-viewer.open');
  }
  function mountDock() {
    if (dock || !window.Asistente) return;
    dock = document.createElement('button');
    dock.className = 'uku-dock';
    dock.setAttribute('aria-label', T('Pregúntale a {nombre}', { nombre: Asistente.name() }));
    dock.innerHTML = '<span class="uku-dock__av">' + Asistente.faceIMG() + '</span>';
    tip = document.createElement('button');
    tip.className = 'uku-tip';
    document.body.appendChild(tip); document.body.appendChild(dock);
    dock.addEventListener('click', function () { hideTip(); fx('select'); Asistente.open({ ctx: get() }); });
    tip.addEventListener('click', function () { var q = tip.dataset.q; hideTip(); fx('select'); Asistente.open({ ctx: get(), ask: q }); });
    setInterval(function () { var v = homeVisible(); dock.classList.toggle('is-on', v); if (!v) hideTip(); }, 400);
  }
  function showTip(id) {
    if (said[id] || !dock) return;
    var ins = insights(id)[0];
    if (!ins) return;
    said[id] = 1;
    tip.dataset.q = ins.q;
    tip.innerHTML = '<b>' + esc(ins.t) + '</b><span>' + esc(ins.s) + '</span>';
    tip.classList.add('is-on');
    clearTimeout(tipT); tipT = setTimeout(hideTip, 6500);
  }
  function hideTip() { if (tip) tip.classList.remove('is-on'); clearTimeout(tipT); }

  function init() {
    mountDock();
    // Al cambiar de pestaña, Uku dice lo más útil de esa sección (una vez por sesión)
    document.addEventListener('click', function (e) {
      var t = e.target.closest('.tabs .tab');
      if (t) { hideTip(); setTimeout(function () { if (homeVisible()) showTip(get()); }, 900); }
    });
    document.addEventListener('i18n:change', function () { said = {}; if (dock) dock.setAttribute('aria-label', T('Pregúntale a {nombre}', { nombre: Asistente.name() })); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.Contexto = { get: get, info: info, answer: answer, subs: function () { return SUBS.slice(); } };
})();
