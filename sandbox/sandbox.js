/* Sandbox de pruebas: piezas comunes de todas las páginas (buscador/, mundo, animaciones, conocimiento).
   Usa solo clases de la app: la hoja del buscador (.sx) como esqueleto, filas .sx-row, tarjetas .sx-kb, chips .sx-chip. */
(function () {
  'use strict';
  var BUILD = '__BUILD__';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ic(n) { return '<span class="sx-row__ic material-symbols-rounded">' + esc(n) + '</span>'; }
  function row(attr, icon, main, sub, right) { return '<button class="sx-row" ' + (attr || '') + '>' + ic(icon) + '<span class="sx-row__main"><b>' + main + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + (right ? '<span class="sx-row__r">' + right + '</span>' : '') + '</button>'; }
  // Un enlace con la fila de la app (botón, para que se vea igual que las demás filas)
  function link(href, icon, main, sub) { return '<button class="sx-row" data-href="' + esc(href) + '">' + ic(icon) + '<span class="sx-row__main"><b>' + main + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span><span class="sx-row__r"><span class="material-symbols-rounded">chevron_right</span></span></button>'; }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-href]'); if (b) location.href = b.dataset.href; });
  function sec(titulo, inner) { return '<section class="sx-card">' + (titulo ? '<h3>' + titulo + '</h3>' : '') + inner + '</section>'; }
  function chips(list, titulo) { return '<section class="sx-card">' + (titulo ? '<h3>' + titulo + '</h3>' : '') + '<div class="sx-chips">' + list.join('') + '</div></section>'; }
  function chip(attr, t, on) { return '<button class="sx-chip" ' + (attr || '') + (on != null ? ' aria-pressed="' + !!on + '"' : '') + '>' + esc(t) + '</button>'; }
  function nota(html) { return '<section class="sx-card sx-empty"><p>' + html + '</p></section>'; }
  function card(titulo, inner, label) { return '<section class="sx-card sx-kb">' + (label ? '<h3>' + esc(label) + '</h3>' : '') + '<div class="sx-kb__body">' + (titulo ? '<b class="sx-kb__t">' + esc(titulo) + '</b>' : '') + inner + '</div></section>'; }
  function datos(pairs) { return '<dl class="sx-kb__datos">' + pairs.map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl>'; }
  function money(v) { var s = Math.abs(+v || 0).toFixed(2).split('.'); return '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1]; }
  var toast = document.getElementById('toast');
  function aviso(t) { if (!toast) return; toast.textContent = t; toast.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { toast.classList.remove('show'); }, 2200); }
  // La persona de la demo, compartida con buscador/ (misma clave de localStorage)
  var KEY = 'kbdemo_usuario';
  function persona() { try { return localStorage.getItem(KEY) || 'andres'; } catch (e) { return 'andres'; } }
  function setPersona(id) { try { localStorage.setItem(KEY, id); } catch (e) {} }
  function chipsPersona(lista, actual) { return chips(lista.map(function (u) { return chip('data-persona="' + u.id + '" title="' + esc(u.tipo || '') + '"', u.nombre.split(' ')[0], u.id === actual); }), 'Persona de la demo'); }
  function versionRow() { return nota('Sandbox · versión ' + esc(BUILD.indexOf('__') === 0 ? 'de desarrollo' : BUILD) + ' · cada despliegue renueva scripts, estilos y datos.'); }
  // La hoja de cambios de los laboratorios a pantalla completa
  var hoja = document.getElementById('hoja'), hojaBack = document.getElementById('hoja-back'), abrir = document.getElementById('abrir');
  function abrirHoja() { if (!hoja) return; hoja.classList.add('open'); hojaBack.classList.add('open'); hoja.scrollTop = 0; }
  function cerrarHoja() { if (!hoja) return; hoja.classList.remove('open'); hojaBack.classList.remove('open'); }
  if (abrir) abrir.addEventListener('click', abrirHoja);
  if (hojaBack) hojaBack.addEventListener('click', cerrarHoja);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarHoja(); });
  window.Sandbox = { abrirHoja: abrirHoja, cerrarHoja: cerrarHoja, BUILD: BUILD, esc: esc, ic: ic, row: row, link: link, sec: sec, chips: chips, chip: chip, nota: nota, card: card, datos: datos, money: money, aviso: aviso, persona: persona, setPersona: setPersona, chipsPersona: chipsPersona, versionRow: versionRow };
})();
