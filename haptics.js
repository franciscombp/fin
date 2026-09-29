// Feedback háptico + microinteracciones táctiles.
//
// - Android/Chrome: navigator.vibrate con patrones cortos.
// - iOS 17.4+ (Safari/PWA): no existe vibrate(); el truco es hacer click en un
//   <input type="checkbox" switch> oculto, que dispara el motor háptico nativo.
// - Sin soporte (escritorio) todo es no-op silencioso.
// Respeta prefers-reduced-motion y un interruptor persistido en localStorage
// (window.Haptics.setEnabled(false)).
(function () {
  var KEY = 'bp_haptics';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) {}

  var canVibrate = typeof navigator.vibrate === 'function';
  var iosEl = null;
  function iosTick() {
    if (!iosEl) {
      var label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      label.appendChild(input);
      document.body.appendChild(label);
      iosEl = label;
    }
    iosEl.click();
  }

  // Patrones en ms: [vibra, pausa, vibra...]. En iOS se emula con N ticks.
  var PATTERNS = {
    tap:     { android: 8,                 ios: 1 },
    select:  { android: 12,                ios: 1 },
    toggle:  { android: [10, 30, 10],      ios: 2 },
    success: { android: [12, 60, 22],      ios: 2 },
    warning: { android: [20, 50, 20],      ios: 2 },
    error:   { android: [30, 40, 30, 40, 50], ios: 3 }
  };

  var lastAt = 0;
  function fire(name) {
    if (!enabled || (reduced && reduced.matches)) return;
    var p = PATTERNS[name] || PATTERNS.tap;
    var now = Date.now();
    if (now - lastAt < 30) return; // evita ráfagas por eventos duplicados
    lastAt = now;
    try {
      if (canVibrate) { navigator.vibrate(p.android); return; }
      for (var i = 0; i < p.ios; i++) setTimeout(iosTick, i * 90);
    } catch (e) {}
  }

  window.Haptics = {
    tap: function () { fire('tap'); },
    select: function () { fire('select'); },
    toggle: function () { fire('toggle'); },
    success: function () { fire('success'); },
    warning: function () { fire('warning'); },
    error: function () { fire('error'); },
    isEnabled: function () { return enabled; },
    setEnabled: function (on) {
      enabled = !!on;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) {}
      if (enabled) fire('toggle');
    }
  };

  // ---- Cableado delegado: sin tocar cada botón del HTML ----
  var SELECT = '.tab, .push-chip, .nav-item, [data-transfer-chip], .story-header__name';
  var TAP = 'button, a[href], [role="button"], .product-row, .sub-item, .quick-action, ' +
            '.account-card, .promo, .icon-button, .icon-switch, [data-sheet], [data-biller], [data-beneficiary]';

  function isDisabled(el) { return el.disabled || el.getAttribute('aria-disabled') === 'true'; }

  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return; // háptica sólo tiene sentido en táctil
    var el = e.target.closest && e.target.closest(SELECT + ',' + TAP);
    if (!el || isDisabled(el)) return;
    if (el.matches(SELECT)) fire('select'); else fire('tap');
    ripple(el, e);
  }, { passive: true });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'radio')) fire('toggle');
  }, true);

  // ---- Ripple ligero (CSS en index.html: .fx-ripple) ----
  function ripple(el, e) {
    if (reduced && reduced.matches) return;
    if (el.classList.contains('no-ripple')) return;
    var r = el.getBoundingClientRect();
    if (r.width > 340 || r.height > 200) return; // no en tarjetas/paneles grandes
    var size = Math.max(r.width, r.height) * 2;
    var dot = document.createElement('span');
    dot.className = 'fx-ripple';
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = (e.clientX - r.left - size / 2) + 'px';
    dot.style.top = (e.clientY - r.top - size / 2) + 'px';
    var cs = getComputedStyle(el);
    var added = false;
    if (cs.position === 'static') { el.style.position = 'relative'; added = true; }
    if (cs.overflow === 'visible') el.classList.add('fx-clip');
    el.appendChild(dot);
    setTimeout(function () {
      dot.remove();
      if (added) el.style.position = '';
      el.classList.remove('fx-clip');
    }, 550);
  }

  // ---- Feedback por contenido dinámico (flujos de pago/transferencia) ----
  function watch() {
    var extra = document.getElementById('push-extra');
    if (extra) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n.nodeType !== 1) continue;
            if (n.matches('.push-transfer-success') || n.querySelector('.push-transfer-success')) fire('success');
          }
        }
      }).observe(extra, { childList: true });
      // Fondos insuficientes u otros errores de campo
      new MutationObserver(function () {
        var err = extra.querySelector('.push-field__hint--error:not([data-fx])');
        if (err && err.textContent) {
          err.setAttribute('data-fx', '1');
          err.classList.add('fx-shake');
          fire('error');
        }
      }).observe(extra, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    }
    var toast = document.getElementById('toast');
    if (toast) {
      new MutationObserver(function () {
        if (!toast.classList.contains('show')) return;
        var t = toast.textContent || '';
        if (/denegado|no se pudo|cancelad/i.test(t)) fire('warning');
        else if (/✓|registrad|verificad/i.test(t)) fire('success');
        else fire('toggle');
      }).observe(toast, { attributes: true, attributeFilter: ['class'] });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
})();
