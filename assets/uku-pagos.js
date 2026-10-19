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

  // «1.234,56», «1,234.56», «7.15» y «7,15» valen lo mismo: el último separador con dos cifras es el decimal
  function numero(t) { t = String(t).trim(); var m = /^(.*?)[.,](\d{2})$/.exec(t); return m ? parseFloat(m[1].replace(/[.,]/g, '') + '.' + m[2]) : parseFloat(t.replace(/[.,]/g, '')); }

  /* QR en la foto: con BarcodeDetector si el navegador lo tiene; si no, con jsQR (assets/vendor/jsqr),
     que se carga solo la primera vez. Devuelve el texto del QR o null. */
  var ASSET = (document.currentScript && document.currentScript.src || location.href).replace(/[^/]*$/, '');
  function conJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    return new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = ASSET + 'vendor/jsqr/jsQR.js'; sc.onload = function () { ok(window.jsQR); }; sc.onerror = no; document.head.appendChild(sc); });
  }
  /* La foto se decodifica con <img> (Safari respeta la orientación EXIF al dibujarla) y, si eso falla,
     con createImageBitmap. Se decodifica una sola vez por archivo. */
  var IMG = typeof WeakMap === 'function' ? new WeakMap() : null;
  function imagen(file) {
    var c = IMG && IMG.get(file); if (c) return c;
    var p = new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); ok(im); };
      im.onerror = function () { URL.revokeObjectURL(url); no(new Error('img')); };
      im.src = url;
    }).catch(function () { return createImageBitmap(file); });
    if (IMG) IMG.set(file, p);
    return p;
  }
  function lienzo(file, max) {
    return imagen(file).then(function (im) {
      var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      c.getContext('2d', { willReadFrequently: true }).drawImage(im, 0, 0, c.width, c.height);
      return c;
    });
  }
  function pixeles(file, max) { return lienzo(file, max).then(function (c) { return c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); }); }
  /* QR: el detector nativo si existe (Chrome/Android); si no (Safari/iOS), jsQR probando varios
     tamaños, porque en una foto grande el QR puede ser chico o, reducido, perder los módulos. */
  function leerQR(file) {
    var nativo = 'BarcodeDetector' in window && window.createImageBitmap
      ? createImageBitmap(file).then(function (bm) { return new BarcodeDetector({ formats: ['qr_code'] }).detect(bm); }).then(function (r) { return r.length ? r[0].rawValue : null; }).catch(function () { return null; })
      : Promise.resolve(null);
    return nativo.then(function (v) {
      if (v) return v;
      return conJsQR().then(function (jsQR) {
        var tam = [900, 1400, 2000], i = 0;
        function intenta() {
          if (i >= tam.length) return null;
          return pixeles(file, tam[i++]).then(function (d) { var q = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' }); return q && q.data ? q.data : intenta(); });
        }
        return intenta();
      }).catch(function () { return null; });
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
      return lienzo(file, 1600).then(function (c) { return tesseract().then(function (T) { return T.recognize(c, 'spa', { langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast' }); }); })
        .then(function (r) { return (r && r.data && r.data.text) || ''; }).catch(function () { return ''; });
    });
  }
  /* Qué hay en el texto: empresas conocidas, números de cuenta, tarjetas y celulares, para buscar o
     empezar una acción con eso (transferir a esa cuenta, pagar ese servicio, recargar ese número). */
  var EMPRESAS = [
    [/empresa el[eé]ctrica|\beeq\b|\bcnel\b|energ[ií]a el[eé]ctrica|planilla de luz/i, 'Empresa Eléctrica Quito', 'Pagar servicios', 'la luz', 'bolt'],
    [/epmaps|agua potable|interagua|planilla de agua/i, 'EPMAPS', 'Pagar servicios', 'el agua', 'water_drop'],
    [/\bcnt\s*(ep\b|internet|tel[eé]f|fija|m[oó]vil|planilla)|corporaci[oó]n nacional de telecom/i, 'CNT', 'Pagar servicios', 'el internet', 'wifi'],
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
    var limpio = s.replace(/(\d)[ .\-](?=\d)/g, '$1'), re = /\d{8,}/g, m;
    while ((m = re.exec(limpio))) {
      var n = m[0], antes = limpio.slice(Math.max(0, m.index - 24), m.index).toLowerCase();
      if (n.length > 19) continue; // claves de acceso y autorizaciones largas no son cuentas
      if (/c\.?i\.?|c[eé]dula|\bced\b|ced\/|pas\b|pasaporte|identificaci[oó]n|clave|acceso|autorizaci|factura|lote|ref\b|referencia/.test(antes)) continue; // una cédula, una clave o una referencia no es una cuenta
      if (n.length === 16 && !out.tarjetas.some(function (x) { return x === n; })) out.tarjetas.push(n);
      else if (n.length === 13 && /001$/.test(n)) out.ruc = out.ruc || n;
      else if (n.length === 10 && /^09/.test(n) && out.celulares.indexOf(n) < 0) out.celulares.push(n);
      else if ((n.length === 10 || n.length === 11) && out.cuentas.indexOf(n) < 0 && !/^0/.test(n)) out.cuentas.push(n);
    }
    var mr = /\$\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/g, mm; while ((mm = mr.exec(s))) out.montos.push(numero(mm[1]));
    out.algo = !!(out.empresas.length || out.cuentas.length || out.tarjetas.length || out.celulares.length);
    return out;
  }

  /* Qué documento es y cuánto dice. El total: «total a pagar» o «valor a pagar» primero; si no, el último
     «total» que no sea subtotal ni base. Un recibo ya pagado (forma de pago, débito, efectivo) no es una
     factura por pagar: es un consumo, con su comercio y su fecha. */
  var MONTO = '(\\d{1,3}(?:[.,]\\d{3})*[.,]\\d{2})';
  function interpretar(texto) {
    var t = texto || '', f = FECHA.exec(t), monto = null;
    var pref = new RegExp('(valor a pagar|total a pagar|pago total)[^0-9$]{0,24}\\$?\\s*' + MONTO, 'i').exec(t);
    if (pref) monto = numero(pref[2]);
    else { var re = new RegExp('(sub\\s*|base\\s*)?total[^0-9$a-z]{0,24}\\$?\\s*' + MONTO, 'gi'), m; while ((m = re.exec(t))) if (!m[1]) monto = numero(m[2]); }
    var recibo = /forma de pago|cajapos|\bt\/d\b|\bt\/c\b|d[eé]bito|efectivo|cambio:|autorizaci[oó]n|gracias por su compra|cajero:/i.test(t);
    var tipo = recibo ? 'recibo' : /estado de cuenta|tarjeta|visa|mastercard|diners/i.test(t) ? 'estado' : /factura|ruc|sri|planilla/i.test(t) ? 'factura' : null;
    var fe = /fecha[^0-9]{0,12}(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/i.exec(t);
    // El comercio: la primera línea con letras que no sea un rótulo (RUC, factura, dirección…)
    var comercio = null; t.split(/\n/).some(function (l) { l = l.trim(); if (l.length >= 3 && /[a-záéíóú]/i.test(l) && !/ruc|factura|clave|direcci|av\.|tlf|tel|local|cliente|fecha|ambiente|documento|hora/i.test(l)) { comercio = l.replace(/\s+/g, ' ').slice(0, 40); return true; } return false; });
    var pago = /t\/d|d[eé]bito/i.test(t) ? 'débito' : /t\/c|cr[eé]dito/i.test(t) ? 'crédito' : /efectivo/i.test(t) ? 'efectivo' : null;
    return { monto: monto, vence: f ? f[2] + '/' + f[3] + '/' + f[4] : null, fecha: fe ? fe[1] + '/' + fe[2] + '/' + fe[3] : null, tipo: tipo, comercio: comercio, pago: pago, leido: !!t };
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
