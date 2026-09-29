// Feedback háptico + sonoro + microinteracciones táctiles.
//
// Los sonidos se sintetizan con WebAudio (sin archivos): cero assets, cero red.
// El AudioContext se desbloquea en el primer toque (requisito de iOS/Chrome).
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

  // ---- Sonido: notas [frecuencia Hz, inicio s, duración s, volumen, onda] ----
  var SKEY = 'bp_sound';
  var soundOn = true;
  try { soundOn = localStorage.getItem(SKEY) !== 'off'; } catch (e) {}
  var actx = null;
  function ctx() {
    if (actx) return actx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { actx = new AC(); } catch (e) { actx = null; }
    return actx;
  }
  var SOUNDS = {
    tap:     [[1200, 0, 0.03, 0.025, 'sine']],
    select:  [[900, 0, 0.04, 0.04, 'sine']],
    toggle:  [[700, 0, 0.05, 0.05, 'sine'], [1000, 0.06, 0.06, 0.05, 'sine']],
    success: [[523.25, 0, 0.16, 0.09, 'sine'], [659.25, 0.09, 0.16, 0.09, 'sine'], [783.99, 0.18, 0.34, 0.1, 'sine']],
    warning: [[330, 0, 0.12, 0.07, 'triangle'], [330, 0.16, 0.12, 0.07, 'triangle']],
    error:   [[180, 0, 0.16, 0.08, 'sawtooth'], [140, 0.2, 0.26, 0.08, 'sawtooth']],
    welcome: [[392, 0, 0.18, 0.07, 'sine'], [523.25, 0.12, 0.18, 0.07, 'sine'], [659.25, 0.24, 0.18, 0.07, 'sine'], [783.99, 0.36, 0.5, 0.08, 'sine']]
  };
  function play(name) {
    if (!soundOn) return;
    var notes = SOUNDS[name], a = ctx();
    if (!notes || !a) return;
    if (a.state === 'suspended') a.resume();
    var t0 = a.currentTime + 0.005;
    notes.forEach(function (n) {
      var o = a.createOscillator(), g = a.createGain();
      o.type = n[4]; o.frequency.value = n[0];
      var st = t0 + n[1];
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(n[3], st + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, st + n[2]);
      o.connect(g); g.connect(a.destination);
      o.start(st); o.stop(st + n[2] + 0.03);
    });
  }
  // Desbloqueo en el primer gesto
  function unlock() {
    var a = ctx();
    if (a && a.state === 'suspended') a.resume();
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);

  var lastAt = 0;
  function fire(name) {
    var now = Date.now();
    if (now - lastAt < 30) return; // evita ráfagas por eventos duplicados
    lastAt = now;
    play(name);
    if (!enabled || (reduced && reduced.matches)) return;
    var p = PATTERNS[name] || PATTERNS.tap;
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
    welcome: function () { fire('success'); play('welcome'); },
    isEnabled: function () { return enabled; },
    isSoundEnabled: function () { return soundOn; },
    setSoundEnabled: function (on) {
      soundOn = !!on;
      try { localStorage.setItem(SKEY, soundOn ? 'on' : 'off'); } catch (e) {}
      if (soundOn) play('toggle');
    },
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
    var splash = document.getElementById('welcome-splash');
    if (splash) {
      new MutationObserver(function () {
        if (splash.classList.contains('show')) { play('welcome'); if (enabled) fire('success'); }
      }).observe(splash, { attributes: true, attributeFilter: ['class'] });
    }
    // Interruptores de Preferencias (Vibración / Sonidos)
    function bind(id, get, set) {
      var row = document.getElementById(id);
      if (!row) return;
      row.setAttribute('aria-pressed', String(get()));
      row.addEventListener('click', function () {
        var on = row.getAttribute('aria-pressed') !== 'true';
        row.setAttribute('aria-pressed', String(on));
        set(on);
      });
    }
    bind('pref-haptics', function () { return enabled; }, window.Haptics.setEnabled);
    bind('pref-sound', function () { return soundOn; }, window.Haptics.setSoundEnabled);
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
