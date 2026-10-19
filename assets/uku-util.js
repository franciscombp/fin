/* =====================================================================
   Utilidades del Asistente (sin estado propio): formato, íconos, lectura de
   Buscador, Soporte y Mis finanzas, y reglas para entender una frase.
   Se cargan antes de assets/uku-app.js, que las usa como UkuUtil.
   ===================================================================== */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function money(v) { return '$ ' + Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function money0(v) { return money(v).replace(/,00$/, ''); }
  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function face() { return window.Asistente ? Asistente.faceIMG() : ''; }
  // leaf_spark no existe en Material Symbols: hoja con estrellita, del mismo trazo que los demás íconos
  var SVG = {
    leaf_spark: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 19.5C4.5 12 8.5 8 15.5 7.5 15 14.5 11 19.5 4.5 19.5Z"/><path d="M4.5 19.5l6-6"/><path d="M19 2.5Q19.6 4.4 21.5 5Q19.6 5.6 19 7.5Q18.4 5.6 16.5 5Q18.4 4.4 19 2.5Z" fill="currentColor" stroke-width="1"/></svg>'
  };
  function ic(n) { return SVG[n] || '<span class="material-symbols-rounded" aria-hidden="true">' + n + '</span>'; }
  function acciones(q) { return window.Buscador && Buscador.rank ? Buscador.rank(q) : []; }
  function accion(label) { return window.Buscador && Buscador.actions ? Buscador.actions().filter(function (a) { return a.label === label; })[0] : null; }
  function ayuda(q, n) { return window.Soporte && Soporte.find ? Soporte.find(q, n || 3) : []; }
  // Las cifras solo cuando preguntas por tu plata; "perdí mi tarjeta" es ayuda, no deuda
  var HACER = /perd|bloque|rob|clave|contrase|pin\b|transfer|recarg|pagar con|cobrar|retirar|enviar|mandar|activar|cancel|cambiar|reclam|reconozco|como (uso|pago|hago|activo|cambio)/;
  var PLATA = /cuant|gast|deb|deuda|plata|dinero|saldo|disponible|ingres|sueldo|pension|remesa|presupuesto|ahorr|cierr|ritmo|revis|pregunt|queda|pagos|vence|compar|mes pasado|diferencia|sobr/;
  function finanzas(q) { var n = norm(q); if (HACER.test(n) || !PLATA.test(n)) return null; try { return window.PFM && PFM.ready() ? PFM.answer(q) : null; } catch (e) { return null; } }
  var PREG = /^(como|cuanto|cuando|que|por que|donde|puedo|se puede)|\?|no (puedo|reconozco|me |funciona)|perd|rob|olvid/;
  function resumen() { return window.PFM && PFM.summary ? PFM.summary() : null; }
  function consejos() { return (window.PFM && PFM.advice ? PFM.advice() : []).filter(function (x) { return !x.done; }); }
  window.UkuUtil = { esc, norm, money, money0, fx, face, ic, acciones, accion, ayuda, finanzas, resumen, consejos, HACER: HACER, PLATA: PLATA, PREG: PREG };
})();
