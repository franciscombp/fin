// Feedback háptico + sonoro.
//
// Los sonidos se sintetizan con WebAudio (sin archivos): cero assets, cero red.
//
// - Android/Chrome: navigator.vibrate con patrones cortos (en pointerdown).
// - iOS 17.4+ (Safari/PWA): no existe vibrate(); el truco es hacer click en un
//   <input type="checkbox" switch> oculto, que dispara el motor háptico nativo.
//   iOS sólo lo permite dentro de un gesto del usuario, así que allí la háptica
//   se dispara en "click" y no en pointerdown, y los efectos asíncronos (éxito
//   tras el procesamiento) pueden no vibrar.
// - Audio: iOS/Chrome exigen desbloquear el AudioContext dentro de un gesto
//   (touchend/click; pointerdown no cuenta en iOS). Además en iOS el switch de
//   silencio mutea WebAudio salvo que audioSession.type = 'playback'.
// - Sin soporte (escritorio) todo es no-op silencioso.
// Interruptores persistidos en localStorage (Haptics.setEnabled / setSoundEnabled).
(function () {
  var KEY = 'bp_haptics';
  var SKEY = 'bp_sound';
  var enabled = true;
  var soundOn = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) {}
  try { soundOn = localStorage.getItem(SKEY) !== 'off'; } catch (e) {}

  var canVibrate = typeof navigator.vibrate === 'function';

  // ---------- Háptica ----------
  var iosEl = null;
  function iosTick() {
    try {
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
    } catch (e) {}
  }

  // Patrones en ms: [vibra, pausa, vibra...]. Por debajo de ~15ms muchos
  // motores Android ni se sienten, por eso los pulsos son más largos.
  // En iOS se emula con N ticks.
  var PATTERNS = {
    tap:     { android: 15,                     ios: 1 },
    select:  { android: 20,                     ios: 1 },
    toggle:  { android: [20, 40, 20],           ios: 2 },
    success: { android: [25, 60, 45],           ios: 2 },
    warning: { android: [35, 60, 35],           ios: 2 },
    error:   { android: [50, 50, 50, 50, 90],   ios: 3 }
  };

  // ---------- Sonido ----------
  var actx = null;
  var master = null;
  function ctx() {
    if (actx) return actx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.9;
      master.connect(actx.destination);
    } catch (e) { actx = null; }
    return actx;
  }

  // Notas: [frecuencia Hz, inicio s, duración s, volumen, onda]
  var SOUNDS = {
    tap:     [[1400, 0, 0.05, 0.10, 'sine']],
    select:  [[1000, 0, 0.07, 0.16, 'sine']],
    toggle:  [[760, 0, 0.08, 0.20, 'sine'], [1080, 0.07, 0.10, 0.20, 'sine']],
    success: [[523.25, 0, 0.20, 0.35, 'sine'], [659.25, 0.10, 0.20, 0.35, 'sine'], [783.99, 0.20, 0.45, 0.38, 'sine']],
    warning: [[392, 0, 0.16, 0.30, 'triangle'], [392, 0.20, 0.16, 0.30, 'triangle']],
    error:   [[190, 0, 0.20, 0.28, 'sawtooth'], [140, 0.24, 0.32, 0.28, 'sawtooth']],
    welcome: [[392, 0, 0.22, 0.30, 'sine'], [523.25, 0.14, 0.22, 0.30, 'sine'], [659.25, 0.28, 0.22, 0.30, 'sine'], [783.99, 0.42, 0.60, 0.34, 'sine']]
  };

  function play(name) {
    if (!soundOn) return;
    var notes = SOUNDS[name], a = ctx();
    if (!notes || !a) return;
    if (a.state !== 'running') { try { a.resume(); } catch (e) {} }
    var t0 = a.currentTime + 0.01;
    notes.forEach(function (n) {
      var o = a.createOscillator(), g = a.createGain();
      o.type = n[4]; o.frequency.value = n[0];
      var st = t0 + n[1];
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(n[3], st + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, st + n[2]);
      o.connect(g); g.connect(master);
      o.start(st); o.stop(st + n[2] + 0.05);
    });
  }

  // Desbloqueo: se reintenta en cada gesto hasta que el contexto queda
  // 'running' (en iOS puede volver a 'interrupted' y hay que reanudarlo).
  function unlock() {
    // iOS: que el audio suene aunque el switch de silencio esté activo
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    var a = ctx();
    if (!a) return;
    try {
      if (a.state !== 'running') a.resume();
      // buffer mudo dentro del gesto: lo que iOS exige para "desbloquear"
      var b = a.createBuffer(1, 1, 22050), s = a.createBufferSource();
      s.buffer = b; s.connect(a.destination); s.start(0);
    } catch (e) {}
  }
  ['touchend', 'click', 'pointerup', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, unlock, { capture: true, passive: true });
  });

  // ---------- Disparo ----------
  var lastAt = 0;
  function fire(name) {
    // Tap/select se agrupan (evita doble disparo pointerdown+click); el resto
    // (toggle, éxito, error…) siempre suena, aunque siga a un tap.
    var soft = name === 'tap' || name === 'select';
    var now = Date.now();
    if (soft && now - lastAt < 60) return;
    if (soft) lastAt = now;

    play(name);
    if (!enabled) return;
    var p = PATTERNS[name] || PATTERNS.tap;
    try {
      if (canVibrate) { navigator.vibrate(p.android); return; }
      for (var i = 0; i < p.ios; i++) {
        if (i === 0) iosTick(); else setTimeout(iosTick, i * 90);
      }
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
    setEnabled: function (on) {
      enabled = !!on;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) {}
      if (enabled) fire('toggle');
    },
    setSoundEnabled: function (on) {
      soundOn = !!on;
      try { localStorage.setItem(SKEY, soundOn ? 'on' : 'off'); } catch (e) {}
      if (soundOn) { unlock(); play('toggle'); }
    }
  };

  // ---- Cableado delegado: sin tocar cada botón del HTML ----
  var SELECT = '.tab, .push-chip, .nav-item, [data-transfer-chip], .story-header__name';
  var TAP = 'button, a[href], [role="button"], .product-row, .sub-item, .quick-action, ' +
            '.account-card, .promo, .icon-button, .icon-switch, [data-sheet], [data-biller], [data-beneficiary]';
  var TARGETS = SELECT + ',' + TAP;

  function isDisabled(el) { return el.disabled || el.getAttribute('aria-disabled') === 'true'; }
  function feedbackFor(target) {
    var el = target.closest && target.closest(TARGETS);
    if (!el || isDisabled(el)) return;
    fire(el.matches(SELECT) ? 'select' : 'tap');
  }

  // Android: al tocar (baja latencia). iOS: en click, único gesto válido.
  var lastTouchDown = 0;
  if (canVibrate) {
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      lastTouchDown = Date.now();
      feedbackFor(e.target);
    }, { passive: true, capture: true });
  }
  document.addEventListener('click', function (e) {
    // Android ya respondió en pointerdown: el click que sigue a ese toque no
    // debe repetir vibración ni sonido. Sólo actúa en iOS y con mouse.
    if (canVibrate && Date.now() - lastTouchDown < 1500) return;
    feedbackFor(e.target);
  }, true);

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'radio')) fire('toggle');
  }, true);

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
        if (splash.classList.contains('show')) { fire('success'); play('welcome'); }
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

    // Menú "Probar efectos" del perfil
    var status = document.getElementById('fx-test-status');
    if (status) {
      var hap = canVibrate ? 'vibración nativa (Android)' : (/iP(hone|ad)/.test(navigator.userAgent) ? 'háptica iOS 17.4+ (emulada)' : 'sin vibración en este dispositivo');
      status.textContent = 'Soporte: ' + hap + ' · audio ' + ((window.AudioContext || window.webkitAudioContext) ? 'sí' : 'no');
    }
    document.querySelectorAll('[data-fx-test]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.dataset.fxTest;
        lastAt = 0; // que el anti-rebote no se coma la prueba
        unlock();
        if (k === 'welcome') window.Haptics.welcome(); else fire(k);
        btn.classList.remove('fx-test--play'); void btn.offsetWidth; btn.classList.add('fx-test--play');
        if (k === 'error') { btn.classList.remove('fx-shake'); void btn.offsetWidth; btn.classList.add('fx-shake'); }
      });
    });

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

  // ---- Sin zoom: doble tap y pinch ----
  // touch-action: manipulation (CSS) cubre el doble tap; en iOS el pinch
  // llega como gesture* y se cancela acá.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); });
  });
})();
