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

  /* QR en la foto: con BarcodeDetector si el navegador lo tiene; si no, con jsQR (assets/vendor/jsqr),
     que se carga solo la primera vez. Devuelve el texto del QR o null. */
  var ASSET = (document.currentScript && document.currentScript.src || location.href).replace(/[^/]*$/, '');
  function conJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    return new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = ASSET + 'vendor/jsqr/jsQR.js'; sc.onload = function () { ok(window.jsQR); }; sc.onerror = no; document.head.appendChild(sc); });
  }
  function pixeles(file, max) {
    return createImageBitmap(file).then(function (bm) {
      var k = Math.min(1, max / Math.max(bm.width, bm.height)), c = document.createElement('canvas');
      c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
      var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bm, 0, 0, c.width, c.height);
      return g.getImageData(0, 0, c.width, c.height);
    });
  }
  function leerQR(file) {
    if (!window.createImageBitmap) return Promise.resolve(null);
    var nativo = 'BarcodeDetector' in window ? createImageBitmap(file).then(function (bm) { return new BarcodeDetector({ formats: ['qr_code'] }).detect(bm); })
      .then(function (r) { return r.length ? r[0].rawValue : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return nativo.then(function (v) {
      if (v) return v;
      return Promise.all([conJsQR(), pixeles(file, 1000)]).then(function (r) { var q = r[0](r[1].data, r[1].width, r[1].height, { inversionAttempts: 'attemptBoth' }); return q && q.data ? q.data : null; }).catch(function () { return null; });
    });
  }
  /* Qué dice un QR de pago (demo): texto libre o JSON con comercio, monto y referencia.
     Acepta «PICHIBANK|Comercio|12.50|REF», «{"comercio":..,"monto":..}» o cualquier texto con un monto. */
  function interpretarQR(data) {
    var d = String(data || ''), o = null;
    try { o = JSON.parse(d); } catch (e) {}
    if (o && typeof o === 'object') return { qr: true, comercio: o.comercio || o.nombre || o.merchant || 'el comercio', monto: o.monto != null ? Number(o.monto) : (o.amount != null ? Number(o.amount) : null), ref: o.ref || o.referencia || null, leido: true };
    var partes = d.split('|').map(function (x) { return x.trim(); });
    if (partes.length >= 3 && /^[\d.,]+$/.test(partes[2])) return { qr: true, comercio: partes[1], monto: numero(partes[2].replace(/\.(?=\d{2}$)/, ',')), ref: partes[3] || null, leido: true };
    var m = /\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/.exec(d);
    return { qr: true, comercio: (d.split(/[\n|;]/)[0] || 'el comercio').replace(/[\d$.,]+/g, '').trim() || 'el comercio', monto: m ? numero(m[1].replace(/\.(?=\d{2}$)/, ',')) : null, ref: null, leido: !!d };
  }
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
      // Un QR de pago: se paga al comercio por el monto del código
      if (doc.qr) {
        var dq = cuentas.filter(function (c) { return c.tipo === 'transaccional'; })[0];
        if (!doc.monto) return null;
        return { id: 'qr|' + doc.comercio + '|' + doc.monto, titulo: 'el pago con QR', para: doc.comercio, institucion: '', monto: doc.monto, vence: null, ref: doc.ref, desde: dq ? dq.nombre + ' ···' + dq.numero : 'tu cuenta', leido: true, qr: true };
      }
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

  window.UkuPagos = { leerQR: leerQR, interpretarQR: interpretarQR, leer: leer, interpretar: interpretar, propuesta: propuesta, pagar: pagar, pagos: pagos };
})();
