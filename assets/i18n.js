/* =====================================================================
   Idiomas (i18n) — catálogos gettext (.po) en /locales
   ---------------------------------------------------------------------
   · El español (es-EC) es el idioma fuente: el texto en español ES la
     clave (msgid), como en gettext. No hace falta un archivo para él.
   · Cada idioma extra es un archivo locales/<código>.po que se edita con
     cualquier editor de texto o con Poedit / Weblate / Crowdin.
   · locales/languages.json lista los idiomas disponibles.
   · locales/messages.pot es la plantilla con todos los textos (para
     empezar un idioma nuevo). Ver locales/README.md.

   Cómo se traduce:
   1. Texto de la página (HTML y lo que pinta el JS): un observador
      reemplaza cada texto que coincide exacto con un msgid del catálogo.
      También aria-label, placeholder, title y alt. Si no hay traducción,
      queda el español (respaldo estándar). translate="no" lo evita.
   2. Textos con datos (montos, nombres): en el código se usa
      I18n.t('Gastaste {monto} en {mes}', { monto, mes }); el msgid lleva
      los marcadores {nombre} y la traducción puede moverlos de lugar.
   3. Al cambiar de idioma se vuelve a traducir la página y se emite el
      evento "i18n:change" para que cada módulo repinte lo que arma con t().
   ===================================================================== */
(function () {
  'use strict';
  var SRC = 'es-EC', KEY = 'pb_lang';
  var script = document.currentScript;
  var BASE = new URL('../locales/', script ? script.src : location.href).href;

  function getSync(url) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', url, false); // síncrono a propósito: t() debe funcionar desde el primer script
      x.send(null);
      return x.status >= 200 && x.status < 300 || (x.status === 0 && x.responseText) ? x.responseText : null;
    } catch (e) { return null; }
  }

  /* ---------- Lector de .po (gettext) ---------- */
  function unq(s) {
    return s.replace(/\\(n|t|"|\\)/g, function (m, c) { return c === 'n' ? '\n' : c === 't' ? '\t' : c; });
  }
  function parsePO(txt) {
    var out = {}, e = null, field = null;
    function flush() {
      if (e && e.msgid && e.msgstr && !e.fuzzy) out[(e.msgctxt ? e.msgctxt + '\u0004' : '') + e.msgid] = e.msgstr;
      e = null; field = null;
    }
    txt.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return flush();
      if (line.charAt(0) === '#') {
        if (e && e.msgstr !== undefined) flush();
        if (/^#,.*\bfuzzy\b/.test(line)) { e = e || {}; e.fuzzy = true; }
        return;
      }
      var m = line.match(/^(msgctxt|msgid|msgstr)\s+"(.*)"$/);
      if (m) {
        if ((m[1] === 'msgid' || m[1] === 'msgctxt') && e && e.msgstr !== undefined) flush();
        e = e || {}; field = m[1]; e[field] = unq(m[2]); return;
      }
      m = line.match(/^"(.*)"$/);
      if (m && e && field) e[field] += unq(m[1]);
    });
    flush();
    return out;
  }

  /* ---------- Idiomas y catálogo ---------- */
  var LANGS = [{ code: SRC, name: 'Español' }];
  try { var lj = JSON.parse(getSync(BASE + 'languages.json')); if (lj && lj.length) LANGS = lj; } catch (e) {}
  function known(c) { return LANGS.some(function (l) { return l.code === c; }); }
  var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
  var lang = known(saved) ? saved : SRC;
  var cat = {}, pats = [];
  function load(code) {
    cat = {}; pats = [];
    var l = LANGS.filter(function (x) { return x.code === code; })[0];
    if (!l || code === SRC || !l.file) return;
    var txt = getSync(BASE + l.file);
    if (txt) cat = parsePO(txt);
    // msgid con {marcadores}: también se reconocen en la página
    Object.keys(cat).forEach(function (id) {
      if (id.indexOf('{') < 0 || id.indexOf('\u0004') >= 0) return;
      var names = [];
      var re = id.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\w+)\\?\}|\{(\w+)\}/g, function (m, a, b) { names.push(a || b); return '([\\s\\S]+?)'; });
      pats.push({ re: new RegExp('^' + re + '$'), names: names, id: id, lit: id.replace(/\{\w+\}/g, '').length });
    });
    pats.sort(function (a, b) { return b.lit - a.lit; }); // lo más específico primero
  }
  load(lang);
  document.documentElement.setAttribute('lang', lang);

  function fill(s, vars) {
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; }) : s;
  }
  /* t(msgid, vars, ctx): traducción con marcadores {nombre}. */
  // Si la traducción empieza con un dato ("{mes} killapi…"), la oración
  // igual empieza con mayúscula.
  function cap(out, tpl) { return tpl.charAt(0) === '{' && out ? out.charAt(0).toUpperCase() + out.slice(1) : out; }
  function t(id, vars, ctx) {
    var s = lang === SRC ? null : cat[(ctx ? ctx + '\u0004' : '') + id];
    return s ? cap(fill(s, vars), s) : fill(id, vars);
  }
  var FREE = /^(nombre|banco|lugar|servicio|producto|lista|cats)$/;
  function lookup(core) {
    if (lang === SRC || !core) return null;
    if (cat[core]) return cat[core];
    for (var i = 0; i < pats.length; i++) {
      var m = core.match(pats[i].re);
      // los valores capturados también se traducen si son términos del catálogo
      // (meses, categorías, niveles): "Gastaste en {mes}" → "{mes} killapi…"
      if (!m) continue;
      // Un marcador sólo acepta: datos (con números: montos, %, fechas),
      // términos del catálogo (meses, categorías, niveles) o nombres propios
      // ({nombre}, {banco}, {lugar}). Así "Ver {cat}" no se come "Ver ofertas".
      var v = {}, ok = true;
      pats[i].names.forEach(function (n, j) {
        var x = m[j + 1];
        if (cat[x]) v[n] = cat[x];
        else if (/\d/.test(x) || FREE.test(n)) v[n] = x;
        else ok = false;
      });
      if (ok) return cap(fill(cat[pats[i].id], v), cat[pats[i].id]);
    }
    return null;
  }
  function tr(s) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), x = lookup(m[2].replace(/\s+/g, ' '));
    return x == null ? s : m[1] + x + m[3];
  }

  /* ---------- Traducción de la página ---------- */
  var ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
  var textRec = new WeakMap(), attrRec = new WeakMap();
  function skip(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      var tg = n.tagName;
      if (tg === 'SCRIPT' || tg === 'STYLE' || tg === 'NOSCRIPT' || tg === 'svg' || tg === 'TEXTAREA') return true;
      if (n.getAttribute('translate') === 'no' || (n.classList && n.classList.contains('material-symbols-rounded'))) return true;
    }
    return false;
  }
  function doText(node) {
    var v = node.nodeValue;
    if (!v || !/[A-Za-zÁÉÍÓÚáéíóúÑñ¿¡]/.test(v)) return;
    var r = textRec.get(node);
    if (!r || v !== r.out) { if (node.parentNode && skip(node.parentNode)) return; r = { src: v }; textRec.set(node, r); }
    var out = tr(r.src); r.out = out;
    if (out !== v) node.nodeValue = out;
  }
  function doAttrs(el) {
    var rec = attrRec.get(el);
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (!v) continue;
      rec = rec || {}; var r = rec[a];
      if (!r || v !== r.out) r = rec[a] = { src: v };
      var out = tr(r.src); r.out = out;
      if (out !== v) el.setAttribute(a, out);
    }
    if (rec) attrRec.set(el, rec);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 || skip(root)) return;
    doAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) { return n.nodeType === 1 && skip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    for (var n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') { if (!skip(m.target)) doAttrs(m.target); }
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
  });
  // Desde el <head>: los nodos se traducen a medida que el navegador los crea.
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  if (document.body) walk(document.body);
  document.addEventListener('DOMContentLoaded', function () { walk(document.body); });

  function set(code) {
    if (!known(code) || code === lang) return;
    lang = code;
    try { localStorage.setItem(KEY, code); } catch (e) {}
    load(code);
    document.documentElement.setAttribute('lang', code);
    walk(document.body);
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: code } }));
  }

  /* ---------- Selector de idioma (hoja inferior) ---------- */
  var sh, bk;
  function picker() {
    if (!sh) {
      bk = document.createElement('div'); bk.className = 'as-sheet-back';
      sh = document.createElement('div'); sh.className = 'as-sheet i18n-sheet'; sh.setAttribute('role', 'dialog');
      document.body.appendChild(bk); document.body.appendChild(sh);
      bk.addEventListener('click', closePicker);
      sh.addEventListener('click', function (e) {
        var b = e.target.closest('[data-lang]'); if (!b) return;
        set(b.dataset.lang); paintPicker();
        try { window.Haptics && Haptics.fx && Haptics.fx('toggle'); } catch (x) {}
        setTimeout(closePicker, 220);
      });
    }
    paintPicker();
    bk.classList.add('open'); sh.classList.add('open');
  }
  function paintPicker() {
    sh.innerHTML = '<div class="as-sheet__handle"></div><h3>' + t('Idioma') + '</h3><p>' + t('Elige en qué idioma quieres ver la app.') + '</p><div class="as-rows">' +
      LANGS.map(function (l) {
        return '<button class="as-row as-row--btn" data-lang="' + l.code + '" aria-pressed="' + (l.code === lang) + '"><span class="as-row__main"><b translate="no">' + l.name + '</b>' +
          (l.note ? '<small>' + t(l.note) + '</small>' : '') + '</span><span class="as-radio"></span></button>';
      }).join('') + '</div>';
  }
  function closePicker() { bk.classList.remove('open'); sh.classList.remove('open'); }
  function nameOf(c) { var l = LANGS.filter(function (x) { return x.code === c; })[0]; return l ? l.name : c; }

  // Botones con data-i18n-picker abren el selector; [data-i18n-current] muestra el idioma actual.
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-i18n-picker]')) { e.preventDefault(); e.stopImmediatePropagation(); picker(); }
  }, true);
  function paintCurrent() { document.querySelectorAll('[data-i18n-current]').forEach(function (el) { el.textContent = nameOf(lang); }); }
  document.addEventListener('DOMContentLoaded', paintCurrent);
  document.addEventListener('i18n:change', paintCurrent);

  /* Texto traducido → msgid (para entender lo que se escribe o dicta en otro idioma) */
  function reverse(txt) {
    var k = String(txt).trim().toLowerCase();
    for (var id in cat) if (cat[id].toLowerCase() === k) return id.split('\u0004').pop();
    return null;
  }

  window.I18n = {
    t: t, set: set, picker: picker, source: SRC, reverse: reverse,
    get lang() { return lang; },
    languages: function () { return LANGS.slice(); },
    translate: function (el) { walk(el || document.body); }
  };
})();
