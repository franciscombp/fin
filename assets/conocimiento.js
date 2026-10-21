/* =====================================================================
   Conocimiento — la base de conocimiento de la app y su buscador
   ---------------------------------------------------------------------
   Los datos viven en assets/conocimiento/base.json (preguntas frecuentes,
   productos y acciones del flujo, con sinónimos y valores de la demo).
   Este módulo los indexa y responde a lo que la persona escribe:

   · buscar(q, opciones)  → lista ordenada de entradas que coinciden
   · responder(q)         → la mejor respuesta, con su confianza y lista
                            para mostrar (textos con los datos puestos)
   · entrada(id), categorias(), porCategoria(id), sugerir(prefijo)

   Cómo busca (sin servidor, en el teléfono):
   1. Normaliza (minúsculas, sin tildes) y quita palabras vacías.
   2. Reduce cada palabra a su raíz («transferencias» y «transferir» →
      «transfer») y expande sinónimos («plata» → «dinero»).
   3. Puntúa con BM25 por campos (título > preguntas y frases > claves >
      respuesta), con coincidencia por prefijo mientras se escribe y
      tolerancia a errores de tipeo (distancia de edición 1 o 2).
   4. Ajusta por intención: una frase imperativa sube las acciones, una
      pregunta sube las ayudas, «qué es / requisitos» sube los productos.

   Funciona también en Node (tools/conocimiento-*.js) sin tocar el DOM.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.Conocimiento = factory(root);
})(typeof window !== 'undefined' ? window : this, function (win) {
  'use strict';

  /* ---------- Texto ---------- */
  var STOP = { de: 1, la: 1, el: 1, en: 1, mi: 1, mis: 1, a: 1, un: 1, una: 1, unos: 1, unas: 1, para: 1, por: 1, con: 1, que: 1, quiero: 1, como: 1, hacer: 1, hago: 1, me: 1, y: 1, o: 1, lo: 1, los: 1, las: 1, al: 1, del: 1, se: 1, es: 1, su: 1, sus: 1, tu: 1, tus: 1, le: 1, les: 1, ya: 1, si: 1, hay: 1, puedo: 1, puede: 1, tengo: 1, necesito: 1, quisiera: 1, quiere: 1, ser: 1, esta: 1, este: 1, esto: 1, esa: 1, ese: 1, eso: 1, muy: 1, mas: 1, pero: 1, donde: 1, cuando: 1, cual: 1, quien: 1, sobre: 1, desde: 1, hasta: 1, entre: 1, porque: 1, favor: 1, hola: 1, dime: 1, dame: 1, saber: 1, ayuda: 1, ayudame: 1 };
  // «no» se queda: «no puedo entrar» y «no reconozco» significan otra cosa que «entrar» y «reconozco»
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n').replace(/[^a-z0-9$%\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  var SUF = ['aciones', 'iciones', 'amientos', 'imientos', 'amiento', 'imiento', 'ciones', 'acion', 'icion', 'encias', 'encia', 'ancias', 'ancia', 'mente', 'ables', 'ibles', 'able', 'ible', 'iendo', 'ando', 'ados', 'adas', 'idos', 'idas', 'ado', 'ada', 'ido', 'ida', 'ar', 'er', 'ir', 'es', 'os', 'as', 's', 'a', 'o', 'e'];
  var NOSTEM = { no: 1, qr: 1, isd: 1, sri: 1, pin: 1, cvv: 1, ia: 1, app: 1, web: 1, face: 1, id: 1, pay: 1 };
  // Raíz ligera del español: quita plural y terminaciones frecuentes; nunca deja menos de 3 letras
  function stem(w) {
    if (NOSTEM[w] || w.length <= 3 || /^\d/.test(w)) return w;
    for (var i = 0; i < SUF.length; i++) {
      var s = SUF[i];
      if (w.length - s.length >= 3 && w.slice(-s.length) === s) return w.slice(0, -s.length);
    }
    return w;
  }
  function words(s) { return norm(s).split(' ').filter(function (w) { return w && !STOP[w] && (w.length > 1 || /\d/.test(w)); }); }
  // ¿Dos raíces hablan de lo mismo? Iguales, o una es prefijo larga de la otra («celul» y «celular»)
  function parecidas(a, b) {
    if (a === b) return 1;
    var corta = a.length < b.length ? a : b, larga = corta === a ? b : a;
    if (corta.length >= 5 && larga.indexOf(corta) === 0 && larga.length - corta.length <= 2) return .9;
    return 0;
  }
  // Distancia de edición (Damerau-Levenshtein) acotada: para errores de tipeo
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur = [], pp = null, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var fila = i;
      for (j = 1; j <= b.length; j++) {
        var c = a[i - 1] === b[j - 1] ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2] + 1);
        cur[j] = v; if (v < fila) fila = v;
      }
      if (fila > max) return max + 1;
      pp = prev; prev = cur;
    }
    return prev[b.length];
  }

  /* ---------- Índice ---------- */
  var PESO = { t: 3, p: 2.2, k: 1.6, r: .6 }, K1 = 1.2, B = .5;
  var base = null, docs = [], df = {}, idf = {}, vocab = [], N = 0, avgdl = 1, syn = {}, synFrases = [], provider = null, listoP = null, listoOk = null;
  function campos(e) {
    var r = [e.r || ''];
    (e.datos || []).forEach(function (d) { r.push(d[0] + ' ' + d[1]); });
    (e.pasos || []).forEach(function (p) { r.push(p); });
    return { t: [e.t], p: (e.preguntas || []).concat(e.frases || []), k: e.k || [], r: r };
  }
  function cargar(obj) {
    base = obj; docs = []; df = {}; idf = {}; vocab = []; syn = {}; synFrases = [];
    Object.keys(obj.sinonimos || {}).forEach(function (k) {
      var nk = norm(k), v = (obj.sinonimos[k] || []).map(function (x) { return words(x).map(stem); });
      var raices = []; v.forEach(function (ws) { ws.forEach(function (s) { if (raices.indexOf(s) < 0) raices.push(s); }); });
      if (nk.indexOf(' ') >= 0) synFrases.push({ f: nk, s: raices }); else syn[stem(nk)] = raices;
    });
    var total = 0;
    (obj.entradas || []).forEach(function (e, i) {
      var f = campos(e), tf = {}, len = 0, vistos = {};
      Object.keys(f).forEach(function (c) {
        f[c].forEach(function (txt) {
          words(txt).forEach(function (w) { var s = stem(w); tf[s] = (tf[s] || 0) + PESO[c]; len += PESO[c]; vistos[s] = 1; });
        });
      });
      Object.keys(vistos).forEach(function (s) { df[s] = (df[s] || 0) + 1; });
      var frases = [norm(e.t)].concat((e.preguntas || []).concat(e.frases || []).map(norm));
      docs.push({ i: i, e: e, tf: tf, len: len, frases: frases, titulo: norm(e.t) });
      total += len;
    });
    N = docs.length; avgdl = N ? total / N : 1;
    Object.keys(df).forEach(function (s) { idf[s] = Math.log(1 + (N - df[s] + .5) / (df[s] + .5)); vocab.push(s); });
    if (listoOk) listoOk(api);
    return api;
  }
  function cargarDesde(url) {
    if (!listoP) listo();
    return fetch(url).then(function (r) { return r.json(); }).then(cargar);
  }
  function listo() {
    if (!listoP) listoP = new Promise(function (ok) { listoOk = ok; if (base) ok(api); });
    return listoP;
  }

  /* ---------- Consulta ---------- */
  // Las raíces de la búsqueda: las de sus palabras y las de sus sinónimos (con menos peso)
  function terminos(q) {
    var n = norm(q), ws = words(n), out = [], vistos = {};
    function add(s, w, orig, raw) { if (!s || vistos[s]) return; vistos[s] = 1; out.push({ s: s, w: w, orig: orig, raw: raw || s }); }
    ws.forEach(function (w) {
      var s = stem(w); add(s, 1, true, w);
      (syn[s] || syn[w] || []).forEach(function (x) { add(x, .8, false); });
    });
    synFrases.forEach(function (sf) { if (n.indexOf(sf.f) >= 0) sf.s.forEach(function (x) { add(x, .9, false); }); });
    return out;
  }
  // Con qué raíces del índice coincide cada término: exacta, por parecido, por prefijo (escribiendo) o por error de tipeo
  function coincidencias(t, ultimo) {
    var out = [], s = t.s, tope = idf[s] != null ? idf[s] : Infinity;
    // Una raíz parecida o un prefijo no puede valer más que la palabra exacta («cuent» no vale lo que «cuentan»)
    function add(v, w) { out.push({ s: v, w: w, idf: Math.min(idf[v], tope) }); }
    if (idf[s] != null) add(s, 1);
    // Escribiendo, la última palabra es un prefijo: «recar» → «recargar» (con la palabra tal cual, no su raíz, que puede quedar muy corta)
    var pre = ultimo && t.raw.length >= 3 ? t.raw : null;
    vocab.forEach(function (v) {
      if (v === s) return;
      var p = parecidas(s, v);
      if (p) return add(v, p);
      if (pre && v.indexOf(pre) === 0) return add(v, .7);
      if (ultimo && s.length >= 4 && v.indexOf(s) === 0) return add(v, .6);
    });
    if (!out.length && s.length >= 5 && !/^\d/.test(s)) {
      var max = s.length >= 8 ? 2 : 1;
      vocab.forEach(function (v) { if (v.length >= 4 && dist(s, v, max) <= max) add(v, .5); });
    }
    return out;
  }
  function intencion(q) {
    var n = norm(q), first = n.split(' ')[0] || '';
    var pregunta = /^(que|cual|cuales|cuanto|cuanta|cuantos|cuantas|como|cuando|donde|en que|por que|porque|puedo|se puede|es |hay |tengo que|necesito saber|debo|sirve|funciona)\b/.test(n) || /\?/.test(String(q)) || /\b(que es|que son|que significa|que pasa|que hago|por que|como (hago|puedo|se|funciona|uso|activo|cambio|pago|saco|pido|abro))\b/.test(n);
    // Imperativo o infinitivo al inicio («pagar la luz», «bloquea mi tarjeta»); «pago mínimo» no es una orden
    var verbo = /^(transferir|transfiere|transfiero|pagar|paga|pago|recargar|recarga|retirar|retira|bloquear|bloquea|activar|activa|cambiar|cambia|solicitar|solicita|crear|crea|simular|simula|contratar|contrata|cobrar|cobra|ver|abrir|abre|pedir|pide|enviar|envia|mandar|manda|sacar|saca|invertir|ahorrar|configurar|desactivar|congelar|congela|mostrar|muestra|descargar|descarga|generar|genera|reportar|reporta|reclamar|revisar|revisa|renovar|renueva|ir|llevame|quiero|necesito|deseo|dame|hacer|hago|hazme|abreme|muestrame|ponme)$/;
    var accion = !pregunta && (verbo.test(first) && !(first === 'pago' && n.split(' ').length < 3) || /^(ir a|llevame a|abreme|muestrame)\b/.test(n));
    var producto = /\b(que es|que son|requisitos|cuesta|costo|costos|tasa|beneficios|cobertura|cubre|diferencia|conviene|incluye)\b/.test(n) ||
      /\b(cuenta (de )?(ahorro|ahorros|corriente|joven|conjunta|transaccional|basica)|tarjeta de (credito|debito)|deposito a plazo|seguro de (vida|salud|compras)|credito (hipotecario|vehicular|de consumo)|microcredito|ahorro flexible|debito digital|banca web|clave digital|billetera)\b/.test(n);
    return { pregunta: pregunta, accion: accion, producto: producto };
  }
  function boost(e, it) {
    if (e.tipo === 'accion') return it.accion ? 1.35 : it.pregunta ? .8 : .9;
    if (e.tipo === 'producto') return it.producto ? 1.3 : it.pregunta ? 1 : .95;
    return it.pregunta ? 1.15 : it.accion ? .9 : 1;
  }
  /* buscar(q, { n, tipo, cat, ctx, escribiendo }) → [{ id, tipo, cat, t, icon, s, cobertura, e }] */
  function buscar(q, o) {
    o = o || {};
    if (!base) return [];
    var T = terminos(q); if (!T.length) return [];
    var nq = norm(q), it = intencion(q), escribiendo = o.escribiendo !== false;
    var tipos = o.tipo ? [].concat(o.tipo) : null, orig = T.filter(function (t) { return t.orig; }).length || 1;
    var M = T.map(function (t, i) { return coincidencias(t, escribiendo && i === T.length - 1 && t.orig); });
    var res = [];
    docs.forEach(function (d) {
      var e = d.e;
      if (tipos && tipos.indexOf(e.tipo) < 0) return;
      if (o.cat && e.cat !== o.cat) return;
      var sc = 0, cub = 0, por = o.explicar ? [] : null;
      T.forEach(function (t, i) {
        var mejor = 0, con = null;
        M[i].forEach(function (m) {
          var tf = d.tf[m.s]; if (!tf) return;
          var sat = tf * (K1 + 1) / (tf + K1 * (1 - B + B * d.len / avgdl));
          var v = t.w * m.w * m.idf * sat;
          if (v > mejor) { mejor = v; con = m.s; }
        });
        if (mejor) { sc += mejor; if (t.orig) cub++; if (por) por.push(t.s + (con !== t.s ? '→' + con : '') + '=' + mejor.toFixed(2)); }
      });
      if (!sc) return;
      var cobertura = cub / orig;
      if (orig > 1 && cobertura < .34) return;
      // La frase entera en un título o una pregunta vale más; y la sección donde está la persona, un poco
      var frase = 1;
      if (nq === d.titulo) frase = 1.8; // escribió el nombre exacto
      else if (escribiendo && nq.length >= 4 && d.titulo.indexOf(nq) === 0) frase = 2; // lo está escribiendo: como un autocompletar
      if (nq.length >= 6) d.frases.forEach(function (f) { if (f.indexOf(nq) >= 0) frase = Math.max(frase, 1.4); else if (nq.length >= 8 && f.length >= 8 && nq.indexOf(f) >= 0) frase = Math.max(frase, 1.25); });
      sc = sc * (.5 + .5 * cobertura) * boost(e, it) * frase * (o.ctx && e.cat === o.ctx ? 1.1 : 1);
      res.push({ id: e.id, tipo: e.tipo, cat: e.cat, t: e.t, icon: e.icon || null, s: Math.round(sc * 100) / 100, cobertura: cobertura, e: e, por: por ? por.join(' ') + ' ×frase ' + frase : undefined });
    });
    res.sort(function (a, b) { return b.s - a.s; });
    return res.slice(0, o.n || 8);
  }
  /* responder(q) → la mejor entrada ya renderizada, con su confianza ('alta' | 'media'), o null */
  function responder(q, o) {
    var r = buscar(q, Object.assign({ n: 3, escribiendo: false }, o || {}));
    if (!r.length) return null;
    var top = r[0], seg = r[1], rel = seg ? top.s / (top.s + seg.s) : 1;
    var min = 1.2;
    if (top.s < min) return null;
    var conf = (rel >= .55 && top.cobertura >= .5 && top.s >= 2.5) ? 'alta' : 'media';
    var v = vista(top.e); v.conf = conf; v.s = top.s; v.otras = r.slice(1).map(function (x) { return { id: x.id, tipo: x.tipo, t: x.t }; });
    return v;
  }

  /* ---------- Para mostrar ---------- */
  function valor(k) {
    var v;
    if (provider) try { v = provider(k); } catch (e) { v = null; }
    if (v == null && base && base.valores) v = base.valores[k];
    return v == null ? '{' + k + '}' : String(v);
  }
  function texto(s) { return String(s == null ? '' : s).replace(/\{([a-z0-9_.]+)\}/gi, function (m, k) { return valor(k); }); }
  function vista(e) {
    if (!e) return null;
    return { id: e.id, tipo: e.tipo, cat: e.cat, t: e.t, icon: e.icon || null, r: texto(e.r), datos: (e.datos || []).map(function (d) { return [d[0], texto(d[1])]; }),
      acts: (e.acts || []).slice(), links: (e.links || []).slice(), go: e.go || null, pasos: (e.pasos || []).slice(), fuente: e.fuente || '' };
  }
  function entrada(id) { for (var i = 0; i < docs.length; i++) if (docs[i].e.id === id) return vista(docs[i].e); return null; }
  function categorias() { return base ? (base.categorias || []).map(function (c) { return { id: c.id, t: c.t, icon: c.icon, n: docs.filter(function (d) { return d.e.cat === c.id && d.e.tipo !== 'accion'; }).length }; }) : []; }
  function porCategoria(id, tipo) { return docs.filter(function (d) { return d.e.cat === id && (!tipo || d.e.tipo === tipo); }).map(function (d) { return { id: d.e.id, tipo: d.e.tipo, t: d.e.t, icon: d.e.icon || null }; }); }
  // Títulos que empiezan por (o contienen) lo escrito: para autocompletar
  function sugerir(p, n) {
    var np = norm(p); if (!np) return [];
    var a = [], b = [];
    docs.forEach(function (d) { if (d.titulo.indexOf(np) === 0) a.push(d); else if (d.titulo.indexOf(' ' + np) >= 0) b.push(d); });
    return a.concat(b).slice(0, n || 5).map(function (d) { return { id: d.e.id, tipo: d.e.tipo, t: d.e.t }; });
  }
  function lista(tipo) { return docs.filter(function (d) { return !tipo || d.e.tipo === tipo; }).map(function (d) { return { id: d.e.id, tipo: d.e.tipo, cat: d.e.cat, t: d.e.t, icon: d.e.icon || null }; }); }

  var api = { cargar: cargar, cargarDesde: cargarDesde, listo: listo, buscar: buscar, responder: responder, entrada: entrada, categorias: categorias, porCategoria: porCategoria, sugerir: sugerir, lista: lista,
    intencion: intencion, texto: texto, vista: vista, norm: norm, stem: stem, words: words, datos: function (fn) { provider = fn; }, cargada: function () { return !!base; }, base: function () { return base; } };

  /* En la app: se carga sola y toma los datos de la persona (deuda, cupo, pago mínimo) de lo que ya ve la pantalla */
  if (win && typeof win.fetch === 'function' && typeof win.document !== 'undefined') {
    provider = function (k) {
      var d = win.Asistente && win.Asistente.data ? win.Asistente.data() : null, c = d && d.card;
      if (!c) return null;
      var money = function (v) { var s = Math.abs(v).toFixed(2).split('.'); return '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1]; };
      if (k === 'tarjeta.deuda') return money(c.owed);
      if (k === 'tarjeta.minimo') return money(Math.max(25, c.owed * .05));
      if (k === 'tarjeta.cupo') return money(c.limit - c.owed);
      if (k === 'tarjeta.limite') return money(c.limit);
      if (k === 'tarjeta.nombre') return c.name || null;
      return null;
    };
    // La base está junto a este archivo (assets/conocimiento/base.json), se cargue desde la página que sea
    var me = win.document.currentScript && win.document.currentScript.src;
    cargarDesde(me ? me.replace(/conocimiento\.js(\?.*)?$/, 'conocimiento/base.json') : './assets/conocimiento/base.json').catch(function () {});
  }
  return api;
});
