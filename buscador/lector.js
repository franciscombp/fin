/* =====================================================================
   Lector — lee facturas y documentos (foto, imagen o PDF) y saca lo que
   hace falta para pagar: empresa, número de contrato o cliente, valor a
   pagar y fecha de vencimiento. También resume un documento cualquiera
   (comprobante, estado de cuenta): montos, fechas, identificadores.

   · leer(file, onProgress) → { texto, paginas, fuente, conf }
       PDF con texto → pdf.js (texto exacto, sin OCR);
       PDF escaneado o imagen → se dibuja en un canvas, se mejora
       (escala, gris, contraste) y lo lee Tesseract en español.
   · analizar(texto) → { tipo, empresa, contrato, valor, vence, periodo,
       cedula, ruc, placa, montos, fechas, lineas, conf }
   La parte de análisis es JavaScript puro y corre también en Node (pruebas).
   Las librerías se cargan desde cdnjs solo cuando se usan.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.Lector = factory(root);
})(typeof window !== 'undefined' ? window : this, function (win) {
  'use strict';
  var TESS = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs', PDFW = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';

  /* ---------- Catálogo de empresas que emiten facturas en Ecuador (alias que aparecen en el papel) ---------- */
  var EMPRESAS = [
    { n: 'Empresa Eléctrica Quito', k: /empresa el[eé]ctrica quito|eeq|e\.e\.q/i, tipo: 'luz', id: /(?:cuenta contrato|c[oó]digo (?:de )?suministro|suministro|n[uú]mero de cuenta|cuenta)\D{0,20}(\d{6,12})/i },
    { n: 'CNEL EP', k: /cnel/i, tipo: 'luz', id: /(?:cuenta contrato|suministro|c[oó]digo)\D{0,20}(\d{6,12})/i },
    { n: 'CENTROSUR', k: /centrosur|centro sur/i, tipo: 'luz' },
    { n: 'EPMAPS Agua de Quito', k: /epmaps|agua de quito|agua potable/i, tipo: 'agua', id: /(?:cuenta|n[uú]mero de cuenta|c[oó]digo)\D{0,20}(\d{5,12})/i },
    { n: 'Interagua', k: /interagua/i, tipo: 'agua' }, { n: 'ETAPA', k: /\betapa\b/i, tipo: 'agua' },
    { n: 'CNT', k: /\bcnt\b|corporaci[oó]n nacional de telecomunicaciones/i, tipo: 'telefonía' },
    { n: 'Netlife', k: /netlife/i, tipo: 'internet' }, { n: 'Claro', k: /\bclaro\b|conecel/i, tipo: 'celular' }, { n: 'Movistar', k: /movistar|otecel/i, tipo: 'celular' }, { n: 'Tuenti', k: /tuenti/i, tipo: 'celular' },
    { n: 'DirecTV', k: /directv/i, tipo: 'tv' }, { n: 'TVCable', k: /tv ?cable|grupo tvcable/i, tipo: 'tv' },
    { n: 'SRI', k: /\bsri\b|servicio de rentas internas|orden de cobro|cep\b/i, tipo: 'impuestos', id: /(?:n[uú]mero de (?:cep|orden|comprobante)|cep)\D{0,20}(\d{8,20})/i },
    { n: 'ANT · Matriculación y multas', k: /\bant\b|agencia nacional de tr[aá]nsito|\bamt\b|matr[ií]cula vehicular|citaci[oó]n/i, tipo: 'tránsito' },
    { n: 'IESS', k: /\biess\b|seguro social|planilla de aportes/i, tipo: 'aportes', id: /(?:planilla|comprobante)\D{0,20}(\d{6,16})/i },
    { n: 'Municipio · impuesto predial', k: /municipio|predial|gad municipal|distrito metropolitano/i, tipo: 'impuestos', id: /(?:clave catastral|predio)\D{0,20}([\d-]{6,20})/i },
    { n: 'Netflix', k: /netflix/i, tipo: 'suscripción' }, { n: 'Spotify', k: /spotify/i, tipo: 'suscripción' },
    { n: 'Colegio · pensión', k: /unidad educativa|colegio|escuela|pensi[oó]n escolar|universidad/i, tipo: 'educación', id: /(?:c[oó]digo (?:de )?estudiante|estudiante|matr[ií]cula)\D{0,20}([\dA-Z-]{4,14})/i },
    { n: 'Pichibank', k: /pichibank|banco pichincha/i, tipo: 'banco' }
  ];
  var MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12, ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
  function num(s) {
    // "1.234,56" → 1234.56 ; "24.80" → 24.8 ; "24,80" → 24.8 ; "1,234.56" → 1234.56
    s = String(s).replace(/\s/g, '');
    if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) return parseFloat(s.replace(/,/g, ''));
    return parseFloat(s.replace(',', '.'));
  }
  function iso(d, m, y) { y = +y; if (y < 100) y += 2000; m = +m; d = +d; if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null; return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  function fechas(t) {
    var out = [], re = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})|(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\s+de\s+([a-záé]+)\s+(?:de\s+|del\s+)?(\d{4})|(\d{1,2})[\/-]([a-z]{3})[\/-](\d{2,4})/gi, m;
    while ((m = re.exec(t))) {
      var f = m[1] ? iso(m[1], m[2], m[3]) : m[4] ? iso(m[6], m[5], m[4]) : m[7] ? (MESES[m[8].toLowerCase()] ? iso(m[7], MESES[m[8].toLowerCase()], m[9]) : null) : (MESES[m[11].toLowerCase()] ? iso(m[10], MESES[m[11].toLowerCase()], m[12]) : null);
      if (f) out.push({ f: f, i: m.index, raw: m[0] });
    }
    return out;
  }
  function cerca(t, i, re, radio) { var a = Math.max(0, i - (radio || 60)); return re.test(t.slice(a, i)); }
  /* analizar(texto) → campos con su confianza */
  function analizar(texto) {
    var t = String(texto || '').replace(/[|¦]/g, ' ').replace(/[ \t]+/g, ' '), low = t.toLowerCase(), lineas = t.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var r = { tipo: 'otro', empresa: null, empresaTipo: null, contrato: null, valor: null, vence: null, periodo: null, cedula: null, ruc: null, placa: null, cliente: null, montos: [], fechas: [], lineas: lineas.length, conf: {}, texto: t };
    // Empresa
    var emp = null, best = 0;
    EMPRESAS.forEach(function (e) { var m = low.match(new RegExp(e.k.source, 'gi')); var n = m ? m.length : 0; if (n > best) { best = n; emp = e; } });
    if (emp) { r.empresa = emp.n; r.empresaTipo = emp.tipo; r.conf.empresa = best >= 2 ? 'alta' : 'media'; }
    // Tipo de documento
    if (/factura|planilla|valor a pagar|total a pagar|fecha de vencimiento|vence el|pagar hasta|orden de cobro|cep\b/i.test(t)) r.tipo = 'factura';
    else if (/comprobante|transferencia|n[uú]mero de referencia|transacci[oó]n exitosa|referencia/i.test(t)) r.tipo = 'comprobante';
    else if (/estado de cuenta|saldo anterior|pago m[ií]nimo|fecha de corte|cupo/i.test(t)) r.tipo = 'estado-cuenta';
    // Identificadores
    var ruc = t.match(/\b(\d{10}001)\b/); if (ruc) r.ruc = ruc[1];
    var ced = t.replace(/\b\d{10}001\b/g, '').match(/(?:c[eé]dula|c\.?i\.?|identificaci[oó]n|ruc\/ci)\D{0,15}(\d{10})\b/i) || t.replace(/\b\d{10}001\b/g, '').match(/\b([01]\d{9}|2[0-4]\d{8})\b/); if (ced) r.cedula = ced[1];
    var pl = t.match(/\b([A-Z]{3})[- ]?(\d{3,4})\b/); if (pl && /placa|veh[ií]culo|matr[ií]cula/i.test(t)) r.placa = pl[1] + '-' + pl[2];
    var cl = t.match(/(?:cliente|titular|nombre|se[ñn]or(?:es|a)?|raz[oó]n social)\s*[:.]?\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){1,3})/); if (cl && /^(cuenta|contrato|n[uú]mero)/i.test(cl[1])) cl = null; if (cl) r.cliente = cl[1];
    var idm = (emp && emp.id && t.match(emp.id)) || t.match(/(?:cuenta contrato|n[uú]mero de contrato|contrato|suministro|c[oó]digo (?:de )?(?:cliente|suministro|servicio|pago|[uú]nico)|n[uú]mero de cliente|cliente n[o°º.]?|cuenta n[o°º.]?|referencia|n[uú]mero de servicio|l[ií]nea|n[uú]mero celular)\s*[:.#-]?\s*([\dA-Z-]{5,20})/i);
    if (idm) { r.contrato = idm[1]; r.conf.contrato = emp && emp.id && t.match(emp.id) ? 'alta' : 'media'; }
    if (!r.contrato && emp && emp.tipo === 'celular') { var cel = t.match(/\b(09\d{8})\b/); if (cel) { r.contrato = cel[1]; r.conf.contrato = 'alta'; } }
    if (!r.contrato && emp && emp.tipo === 'tránsito' && r.placa) { r.contrato = r.placa; r.conf.contrato = 'alta'; }
    if (!r.contrato && emp && (emp.tipo === 'aportes' || emp.tipo === 'impuestos') && r.cedula) { r.contrato = r.cedula; r.conf.contrato = 'media'; }
    // Montos: todos, y el que más parece «a pagar»
    var re = /(?:\$|usd|us\$)?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})\b/gi, m, cand = [];
    while ((m = re.exec(t))) {
      var v = num(m[1]); if (!(v > 0) || v > 1e6) continue;
      var antes = low.slice(Math.max(0, m.index - 70), m.index), sc = 0;
      if (/total a pagar|valor a pagar|a pagar|total a cancelar|valor total|pague hasta|pagar hasta|saldo a pagar|monto a pagar/.test(antes)) sc += 4;
      else if (/\btotal\b/.test(antes)) sc += 2;
      else if (/subtotal|iva|descuento|anterior|abono|saldo anterior|recargo|inter[eé]s/.test(antes)) sc -= 2;
      if (/\$|usd/i.test(m[0])) sc += 1;
      cand.push({ v: v, sc: sc, i: m.index });
      r.montos.push(v);
    }
    if (cand.length) { cand.sort(function (a, b) { return b.sc - a.sc || b.i - a.i; }); r.valor = cand[0].v; r.conf.valor = cand[0].sc >= 4 ? 'alta' : cand[0].sc >= 2 ? 'media' : 'baja'; }
    // Fechas: vencimiento (cerca de «vence», «pagar hasta», «fecha máxima») y periodo
    r.fechas = fechas(t).map(function (x) { return x.f; });
    var fs = fechas(t), venc = fs.filter(function (x) { return cerca(t, x.i, /venc|vence|pagar hasta|pague hasta|fecha m[aá]xima|fecha l[ií]mite|hasta el/i, 70); })[0];
    if (venc) { r.vence = venc.f; r.conf.vence = 'alta'; } else if (fs.length) { var hoy = new Date().toISOString().slice(0, 10), fut = fs.filter(function (x) { return x.f >= hoy; }).sort(function (a, b) { return a.f < b.f ? -1 : 1; })[0]; if (fut) { r.vence = fut.f; r.conf.vence = 'media'; } }
    var per = t.match(/(?:per[ií]odo|periodo|mes de consumo|consumo de|mes)\s*[:.]?\s*([a-záé]+(?:\s+(?:de\s+)?\d{4})?|\d{2}\/\d{4})/i); if (per && !/^de$/i.test(per[1])) r.periodo = per[1];
    return r;
  }

  /* ---------- Lectura en el navegador ---------- */
  var libs = {};
  function script(url) { return libs[url] || (libs[url] = new Promise(function (ok, no) { var s = win.document.createElement('script'); s.src = url; s.onload = ok; s.onerror = function () { no(new Error('No se pudo cargar ' + url)); }; win.document.head.appendChild(s); })); }
  function pdfjs() { return libs.pdf || (libs.pdf = win.pdfjsLib ? Promise.resolve(win.pdfjsLib) : import(/* webpackIgnore: true */ PDFJS).then(function (m) { m.GlobalWorkerOptions.workerSrc = PDFW; return m; })); }
  // Mejora la imagen para el OCR: tamaño mínimo, gris y contraste; devuelve un canvas
  function preparar(src, w, h) {
    var esc = Math.max(1, Math.min(3, 1600 / Math.max(w, h))), c = win.document.createElement('canvas');
    c.width = Math.round(w * esc); c.height = Math.round(h * esc);
    var x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
    var im = x.getImageData(0, 0, c.width, c.height), d = im.data, hist = new Array(256).fill(0), i, g;
    for (i = 0; i < d.length; i += 4) { g = (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) | 0; d[i] = d[i + 1] = d[i + 2] = g; hist[g]++; }
    // Contraste por estiramiento entre los percentiles 2 y 98
    var n = c.width * c.height, lo = 0, hi = 255, acc = 0; for (i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * .02) { lo = i; break; } } acc = 0; for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * .02) { hi = i; break; } }
    var k = 255 / Math.max(1, hi - lo);
    for (i = 0; i < d.length; i += 4) { g = Math.max(0, Math.min(255, (d[i] - lo) * k)); d[i] = d[i + 1] = d[i + 2] = g; }
    x.putImageData(im, 0, 0);
    return c;
  }
  function imagen(file) { return new Promise(function (ok, no) { var im = new win.Image(); im.onload = function () { ok(im); }; im.onerror = function () { no(new Error('No pude abrir la imagen')); }; im.src = URL.createObjectURL(file); }); }
  function ocr(canvas, onP) {
    return (win.Tesseract ? Promise.resolve() : script(TESS)).then(function () {
      return win.Tesseract.recognize(canvas, 'spa', { logger: function (m) { if (onP && m.status === 'recognizing text') onP(Math.round(m.progress * 100), 'Leyendo…'); else if (onP && m.status) onP(null, m.status === 'loading language traineddata' ? 'Cargando el idioma…' : 'Preparando…'); } });
    }).then(function (res) { return { texto: res.data.text, conf: Math.round(res.data.confidence) }; });
  }
  function leer(file, onP) {
    if (!file) return Promise.reject(new Error('Sin archivo'));
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      if (onP) onP(null, 'Abriendo el PDF…');
      return file.arrayBuffer().then(function (buf) { return pdfjs().then(function (lib) { return lib.getDocument({ data: buf }).promise; }); }).then(function (doc) {
        var n = Math.min(doc.numPages, 5), paginas = [], p = Promise.resolve();
        for (var i = 1; i <= n; i++) (function (i) {
          p = p.then(function () { return doc.getPage(i); }).then(function (page) {
            return page.getTextContent().then(function (tc) {
              var txt = tc.items.map(function (it) { return it.str + (it.hasEOL ? '\n' : ' '); }).join('');
              if (txt.replace(/\s/g, '').length >= 40) { paginas.push({ texto: txt, fuente: 'pdf-texto', conf: 99 }); return; }
              // Página escaneada: se dibuja y se lee con OCR
              var vp = page.getViewport({ scale: 2 }), c = win.document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
              return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () { return ocr(preparar(c, c.width, c.height), onP); }).then(function (o) { paginas.push({ texto: o.texto, fuente: 'ocr', conf: o.conf }); });
            });
          });
        })(i);
        return p.then(function () { return { texto: paginas.map(function (x) { return x.texto; }).join('\n\n'), paginas: paginas.length, fuente: paginas.every(function (x) { return x.fuente === 'pdf-texto'; }) ? 'pdf-texto' : 'ocr', conf: Math.round(paginas.reduce(function (t, x) { return t + x.conf; }, 0) / Math.max(1, paginas.length)) }; });
      });
    }
    if (onP) onP(null, 'Preparando la imagen…');
    return imagen(file).then(function (im) { return ocr(preparar(im, im.naturalWidth, im.naturalHeight), onP); }).then(function (o) { return { texto: o.texto, paginas: 1, fuente: 'ocr', conf: o.conf }; });
  }
  return { analizar: analizar, leer: leer, empresas: function () { return EMPRESAS.map(function (e) { return { n: e.n, tipo: e.tipo }; }); }, num: num, fechas: fechas };
});
