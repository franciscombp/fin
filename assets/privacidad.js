/* =====================================================================
   Privacidad de saldos: un solo interruptor para toda la app.
   - El ojo (cualquier [data-eye]) muestra u oculta todos los montos.
   - Un monto oculto se ve siempre igual: "$ **,**" (bp-amount Blind), sin importar su valor.
   - Se enmascaran solo los saldos (lo que tienes o debes): el saldo del
     inicio, las filas de productos, Tu dinero en Mis finanzas y los datos
     marcados con data-saldo. Los montos a pagar o elegir no se tocan.
   - La elección se recuerda en este navegador.
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'pb_saldos_ocultos', MASK = '$ **,**'; // bp-amount · Display=hidden (variante Blind)
  var BUSCA = /\$\s?\d[\d.]*(?:,\d{2})?/;
  var CAMBIA = /\$\s?\d[\d.]*(?:,\d{2})?/g;
  var NO_TOCAR = /^(SCRIPT|STYLE|TEXTAREA|INPUT|NOSCRIPT)$/;
  // Solo se ocultan los saldos (lo que tienes o debes en una cuenta o tarjeta). Lo que vas a pagar,
  // elegir o confirmar (montos de recarga, cuotas, precios, totales de una compra) se ve siempre.
  var SALDO = '#balance, .amount-row, .product-row__amount, .product-row__masked, .skeleton--balance, .pfm-saldo, .pfm-net, .pfm-tile, .finance-total, [data-saldo]';
  var oculto = false, timer = null, original = new WeakMap();
  try { oculto = localStorage.getItem(KEY) === '1'; } catch (e) {}

  // Recorre los textos visibles: oculta los montos o restaura el original
  function aplicar() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      var p = n.parentNode;
      if (!p || NO_TOCAR.test(p.nodeName)) continue;
      var st = original.get(n);
      if (st && n.nodeValue === st.mask) { if (!oculto) { n.nodeValue = st.real; original.delete(n); } continue; }
      if (st) original.delete(n); // la app volvió a escribir este texto
      if (oculto && BUSCA.test(n.nodeValue) && p.closest && p.closest(SALDO)) {
        var real = n.nodeValue, mask = real.replace(CAMBIA, MASK);
        original.set(n, { real: real, mask: mask });
        n.nodeValue = mask;
      }
    }
  }

  // Los ojos reflejan el estado global
  function iconos() {
    document.querySelectorAll('[data-eye]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(oculto));
      b.setAttribute('aria-label', oculto ? 'Mostrar saldos' : 'Ocultar saldos');
      var i = b.querySelector('.material-symbols-rounded');
      if (i) i.textContent = oculto ? 'visibility_off' : 'visibility';
    });
  }

  function agendar() { clearTimeout(timer); timer = setTimeout(function () { aplicar(); iconos(); }, 60); }

  function fijar(v) {
    oculto = v;
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
    aplicar(); iconos();
    document.dispatchEvent(new CustomEvent('privacidad:change', { detail: v }));
  }

  // Un solo punto de entrada para todos los ojos (también los de cada sección)
  document.addEventListener('click', function (e) {
    var ojo = e.target.closest('[data-eye]');
    if (!ojo) return;
    e.stopPropagation(); e.preventDefault(); // no dispares el swipe ni acciones de fila
    fijar(!oculto);
  }, true);

  function arrancar() {
    aplicar(); iconos();
    new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();

  window.Privacidad = { oculto: function () { return oculto; }, fijar: fijar };
})();
