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
  // Leer el texto de una foto: el detector nativo si existe; si no, Tesseract (se carga solo cuando hace falta)
  var TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  function tesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseract.p) return tesseract.p;
    tesseract.p = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = TESS; s.onload = function () { ok(window.Tesseract); }; s.onerror = function () { tesseract.p = null; no(new Error('ocr')); }; document.head.appendChild(s); });
    return tesseract.p;
  }
  function leer(file) {
    var nativo = ('TextDetector' in window && window.createImageBitmap)
      ? createImageBitmap(file).then(function (bm) { return new TextDetector().detect(bm); }).then(function (bloques) { return bloques.map(function (b) { return b.rawValue; }).join('\n'); }).catch(function () { return ''; })
      : Promise.resolve('');
    return nativo.then(function (t) {
      if (t) return t;
      return pixeles(file, 1400).then(function (c) { return tesseract().then(function (T) { return T.recognize(c, 'spa+eng'); }); })
        .then(function (r) { return (r && r.data && r.data.text) || ''; }).catch(function () { return ''; });
    });
  }
  /* Qué hay en el texto: empresas conocidas, números de cuenta, tarjetas y celulares, para buscar o
     empezar una acción con eso (transferir a esa cuenta, pagar ese servicio, recargar ese número). */
  var EMPRESAS = [
    [/empresa el[eé]ctrica|\beeq\b|\bcnel\b|energ[ií]a el[eé]ctrica|planilla de luz/i, 'Empresa Eléctrica Quito', 'Pagar servicios', 'la luz', 'bolt'],
    [/epmaps|agua potable|interagua|planilla de agua/i, 'EPMAPS', 'Pagar servicios', 'el agua', 'water_drop'],
    [/\bcnt\b|corporaci[oó]n nacional de telecom/i, 'CNT', 'Pagar servicios', 'el internet', 'wifi'],
    [/\bclaro\b|conecel/i, 'Claro', 'Recargar celular', 'Claro', 'smartphone'],
    [/movistar|otecel/i, 'Movistar', 'Recargar celular', 'Movistar', 'smartphone'],
    [/tuenti/i, 'Tuenti', 'Recargar celular', 'Tuenti', 'smartphone'],
    [/netflix|spotify|disney|hbo|amazon prime|youtube premium/i, 'la suscripción', 'Pagar servicios', 'la suscripción', 'subscriptions'],
    [/\bsri\b|servicio de rentas|impuesto a la renta|matr[ií]cula vehicular/i, 'SRI', 'Pagar servicios', 'el impuesto', 'account_balance'],
    [/municipio|predial|patente municipal/i, 'Municipio', 'Pagar servicios', 'el predial', 'account_balance'],
    [/\biess\b|aporte patronal|planilla iess/i, 'IESS', 'Pagar servicios', 'el aporte del IESS', 'account_balance'],
    [/diners|\bvisa\b|mastercard|american express|estado de cuenta/i, 'la tarjeta', 'Pagar tarjeta', 'la tarjeta', 'credit_card']
  ];
  var BANCOS = /banco (pichincha|guayaquil|del pac[ií]fico|bolivariano|internacional|del austro)|produbanco|cooperativa [a-záéíóú ]+/i;
  function entidades(texto) {
    var s = String(texto || ''), out = { empresas: [], cuentas: [], tarjetas: [], celulares: [], banco: null, ruc: null, montos: [] };
    EMPRESAS.forEach(function (e) { if (e[0].test(s) && !out.empresas.some(function (x) { return x.nombre === e[1]; })) out.empresas.push({ nombre: e[1], accion: e[2], que: e[3], icon: e[4] }); });
    var b = BANCOS.exec(s); if (b) out.banco = b[0].replace(/\s+/g, ' ').trim();
    // Números: se juntan los dígitos separados por espacio, punto o guion (como los imprimen los documentos)
    var limpio = s.replace(/(\d)[ .\-](?=\d)/g, '$1'), re = /\d{8,19}/g, m;
    while ((m = re.exec(limpio))) {
      var n = m[0], antes = limpio.slice(Math.max(0, m.index - 16), m.index).toLowerCase();
      if (/c\.?i\.?|c[eé]dula|identificaci[oó]n/.test(antes)) continue; // una cédula no es una cuenta
      if (n.length === 16 && !out.tarjetas.some(function (x) { return x === n; })) out.tarjetas.push(n);
      else if (n.length === 13 && /001$/.test(n)) out.ruc = out.ruc || n;
      else if (n.length === 10 && /^09/.test(n) && out.celulares.indexOf(n) < 0) out.celulares.push(n);
      else if ((n.length === 10 || n.length === 11) && out.cuentas.indexOf(n) < 0 && !/^0/.test(n)) out.cuentas.push(n);
    }
    var mr = /\$\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/g, mm; while ((mm = mr.exec(s))) out.montos.push(numero(mm[1]));
    out.algo = !!(out.empresas.length || out.cuentas.length || out.tarjetas.length || out.celulares.length);
    return out;
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

  window.UkuPagos = { leerQR: leerQR, interpretarQR: interpretarQR, leer: leer, interpretar: interpretar, entidades: entidades, propuesta: propuesta, pagar: pagar, pagos: pagos };
})();
