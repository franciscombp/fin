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
  function ic(n) { return '<span class="material-symbols-rounded" aria-hidden="true">' + n + '</span>'; }
  function acciones(q) { return window.Buscador && Buscador.rank ? Buscador.rank(q) : []; }
  function accion(label) { return window.Buscador && Buscador.actions ? Buscador.actions().filter(function (a) { return a.label === label; })[0] : null; }
  function ayuda(q, n) { return window.Soporte && Soporte.find ? Soporte.find(q, n || 3) : []; }
  // Las cifras solo cuando preguntas por tu plata; "perdí mi tarjeta" es ayuda, no deuda
  var HACER = /perd|bloque|rob|clave|contrase|pin\b|transfer|recarg|pagar con|cobrar|retirar|enviar|mandar|activar|cancel|cambiar|reclam|reconozco|como (uso|pago|hago|activo|cambio)/;
  var PLATA = /cuant|gast|deb|deuda|plata|dinero|ingres|sueldo|pension|remesa|presupuesto|ahorr|cierr|ritmo|revis|pregunt|queda/;
  function finanzas(q) { var n = norm(q); if (HACER.test(n) || !PLATA.test(n)) return null; try { return window.PFM && PFM.ready() ? PFM.answer(q) : null; } catch (e) { return null; } }
  var PREG = /^(como|cuanto|cuando|que|por que|donde|puedo|se puede)|\?|no (puedo|reconozco|me |funciona)|perd|rob|olvid/;
  function resumen() { return window.PFM && PFM.summary ? PFM.summary() : null; }
  function consejos() { return (window.PFM && PFM.advice ? PFM.advice() : []).filter(function (x) { return !x.done; }); }
  window.UkuUtil = { esc, norm, money, money0, fx, face, ic, acciones, accion, ayuda, finanzas, resumen, consejos, HACER: HACER, PLATA: PLATA, PREG: PREG };
})();
