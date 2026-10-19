/* =====================================================================
   Pagos desde un documento (Uku): lee una factura o un estado de cuenta
   y propone a qué deuda o cuenta corresponde, con su monto y fecha.
   - Si el navegador puede leer texto de una imagen (TextDetector), lo usa.
   - Si no, Uku compara con tus productos (tarjetas, préstamos, hipoteca).
   Es una demostración: el pago queda registrado en este navegador y no se
   mueve dinero real.
   ===================================================================== */
(function () {
  'use strict';

  var TOTAL = /(valor a pagar|total a pagar|pago total|total)[^0-9$]{0,24}\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i;
  var FECHA = /(vence|fecha l[ií]mite|pagar hasta)[^0-9]{0,24}(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/i;
  var KEY = 'pb_pagos';

  function numero(t) { return parseFloat(t.replace(/\./g, '').replace(',', '.')); }

  // Texto de la imagen, si el navegador sabe leerlo; si no, cadena vacía
  function leer(file) {
    if (!('TextDetector' in window) || !window.createImageBitmap) return Promise.resolve('');
    return createImageBitmap(file)
      .then(function (bm) { return new TextDetector().detect(bm); })
      .then(function (bloques) { return bloques.map(function (b) { return b.rawValue; }).join('\n'); })
      .catch(function () { return ''; });
  }

  function interpretar(texto) {
    var t = texto || '', m = TOTAL.exec(t), f = FECHA.exec(t);
    var tipo = /estado de cuenta|tarjeta|visa|mastercard|diners/i.test(t) ? 'estado' : /factura|ruc|sri/i.test(t) ? 'factura' : null;
    return { monto: m ? numero(m[2]) : null, vence: f ? f[2] + '/' + f[3] + '/' + f[4] : null, tipo: tipo, leido: !!t };
  }

  // Qué se paga: la deuda que coincide con el monto leído; si no hay, la tarjeta con más saldo
  function propuesta(id, doc) {
    return Promise.all([Persona.cuentas(id), Persona.deudas(id)]).then(function (r) {
      var cuentas = r[0], deudas = r[1];
      var pagables = deudas.filter(function (d) { return d.clase !== 'cobrar' && Number(d.saldo) > 0; });
      var desde = cuentas.filter(function (c) { return c.tipo === 'transaccional'; })[0];
      var elegida = null;
      if (doc.monto) elegida = pagables.filter(function (d) { return Math.abs(d.saldo - doc.monto) < 1; })[0];
      if (!elegida && doc.tipo === 'estado') elegida = pagables.filter(function (d) { return d.clase === 'tarjeta'; }).sort(function (a, b) { return b.saldo - a.saldo; })[0];
      if (!elegida && !doc.leido && doc.tipo !== 'factura') elegida = pagables.filter(function (d) { return d.clase === 'tarjeta'; }).sort(function (a, b) { return b.saldo - a.saldo; })[0];
      if (!elegida && !doc.monto) return null;
      var monto = elegida ? Number(elegida.saldo) : doc.monto;
      return {
        id: (elegida ? elegida.producto : 'factura') + '|' + monto,
        titulo: elegida ? (elegida.clase === 'tarjeta' ? 'el estado de cuenta' : 'la cuota') : 'la factura',
        para: elegida ? elegida.producto : 'la factura que leí',
        institucion: elegida ? elegida.institucion : '',
        monto: monto,
        vence: doc.vence,
        desde: desde ? desde.nombre + ' ···' + desde.numero : 'tu cuenta',
        leido: doc.leido
      };
    });
  }

  function pagos(id) { try { return JSON.parse(localStorage.getItem(KEY) || '{}')[id] || []; } catch (e) { return []; } }
  function pagar(id, p) {
    var todos = {}; try { todos = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
    todos[id] = (todos[id] || []).concat([{ para: p.para, monto: p.monto, fecha: new Date().toISOString() }]);
    try { localStorage.setItem(KEY, JSON.stringify(todos)); } catch (e) {}
    return todos[id];
  }

  window.UkuPagos = { leer: leer, interpretar: interpretar, propuesta: propuesta, pagar: pagar, pagos: pagos };
})();
