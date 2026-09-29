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
  var ticking = false;
  // ¿El evento viene del switch oculto que usamos para la háptica de iOS?
  function isInternal(t) { return ticking || (iosEl && t && iosEl.contains(t)); }
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
      // El click sintético cambia el checkbox y dispara 'click'/'change' en el
      // documento. Sin esta marca, el listener de 'change' lo tomaba por un
      // toggle del usuario → fire('toggle') → otro iosTick → bucle infinito
      // de sonido y vibración (sólo en iOS, que no tiene navigator.vibrate).
      ticking = true;
      try { iosEl.click(); } finally { ticking = false; }
    } catch (e) {}
  }

  // Patrones en ms: [vibra, pausa, vibra...]. Por debajo de ~15ms muchos
  // motores Android ni se sienten. En iOS se emula con N ticks.
  var PATTERNS = {
    tap:       { android: 15,                   ios: 1 },
    select:    { android: 20,                   ios: 1 },
    detent:    { android: 12,                   ios: 1 },
    toggle:    { android: [20, 40, 20],         ios: 2 },
    swipe:     { android: [10, 30, 18],         ios: 1 },
    open:      { android: 18,                   ios: 1 },
    close:     { android: 12,                   ios: 1 },
    flip:      { android: [15, 70, 25],         ios: 2 },
    reveal:    { android: [10, 40, 10, 40, 30], ios: 3 },
    success:   { android: [25, 60, 45],         ios: 2 },
    warning:   { android: [35, 60, 35],         ios: 2 },
    error:     { android: [50, 50, 50, 50, 90], ios: 3 },
    welcome:   { android: [15, 90, 15, 90, 20, 140, 60], ios: 3 }
  };

  // ---------- Sonido: síntesis por capas ----------
  // En lugar de "beeps" de una sola onda, cada efecto mezcla primitivas:
  // campanas FM (timbre de vidrio/metal), pads desafinados con filtro que
  // se abre, barridos de ruido (whoosh), golpes graves y una reverb de sala
  // generada por código. Todo pasa por un compresor para que suene lleno
  // sin saturar.
  var actx = null, master = null, dry = null, wet = null;
  // iOS: la sesión de audio se fija UNA vez y ANTES de crear el contexto.
  // Cambiarla con un AudioContext vivo (o que Face ID/WebAuthn la
  // interrumpa) deja a WebKit emitiendo ruido/zumbido sin fin.
  var sessionSet = false;
  function setSession() {
    if (sessionSet) return;
    sessionSet = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  }
  // Tira el contexto por completo: corta cualquier sonido colgado y el
  // próximo efecto crea uno limpio.
  function killCtx() {
    clearTimeout(idleTimer);
    if (!actx) return;
    var old = actx;
    actx = master = dry = wet = null;
    noiseBuf = null;
    try { old.close(); } catch (e) {}
  }
  // En reposo el contexto se suspende: nada puede seguir sonando de fondo.
  var idleTimer = null;
  function scheduleIdle(ms) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (actx && actx.state === 'running') { try { actx.suspend(); } catch (e) {} }
    }, ms);
  }
  function ctx() {
    if (actx) return actx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    setSession();
    try {
      actx = new AC();
      actx.onstatechange = function () {
        // 'interrupted' (iOS): llamada, Face ID, Siri… el contexto queda
        // corrupto al volver; mejor descartarlo.
        if (actx && actx.state === 'interrupted') killCtx();
      };
      var comp = actx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.2;
      master = actx.createGain(); master.gain.value = 0.9;
      master.connect(comp); comp.connect(actx.destination);
      dry = actx.createGain(); dry.connect(master);
      var rev = actx.createConvolver(); rev.buffer = impulse(actx, 2.4, 2.6);
      wet = actx.createGain(); wet.gain.value = 0.55;
      wet.connect(rev); rev.connect(master);
    } catch (e) { actx = null; }
    return actx;
  }
  function impulse(a, secs, decay) {
    var len = Math.floor(a.sampleRate * secs), buf = a.createBuffer(2, len, a.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  var noiseBuf = null;
  function noise(a) {
    if (noiseBuf) return noiseBuf;
    var len = a.sampleRate * 2; noiseBuf = a.createBuffer(1, len, a.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  // Salida con paneo estéreo y envío a reverb
  function out(a, node, pan, send) {
    var last = node;
    if (a.createStereoPanner && pan) { var p = a.createStereoPanner(); p.pan.value = pan; node.connect(p); last = p; }
    last.connect(dry);
    if (send) { var s = a.createGain(); s.gain.value = send; last.connect(s); s.connect(wet); }
  }
  function env(g, t, peak, att, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  // Campana FM: portadora + moduladora inarmónica cuyo índice decae
  function bell(a, t, f, dur, vol, o) {
    o = o || {};
    var car = a.createOscillator(), mod = a.createOscillator(), mg = a.createGain(), g = a.createGain();
    car.frequency.value = f; mod.frequency.value = f * (o.ratio || 3.5);
    mg.gain.setValueAtTime(f * (o.index || 2.2), t);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    car.connect(g); env(g, t, vol, 0.004, dur);
    out(a, g, o.pan || 0, o.send == null ? 0.5 : o.send);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }
  // Pad: osciladores diente de sierra desafinados con filtro que se abre
  function pad(a, t, freqs, dur, vol, o) {
    o = o || {};
    var f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(o.from || 300, t);
    f.frequency.exponentialRampToValueAtTime(o.to || 4200, t + dur * 0.35);
    f.frequency.exponentialRampToValueAtTime(900, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.att || 0.25));
    g.gain.setValueAtTime(vol, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g); out(a, g, 0, o.send == null ? 0.7 : o.send);
    freqs.forEach(function (fr) {
      [-9, 9].forEach(function (det) {
        var osc = a.createOscillator();
        osc.type = 'sawtooth'; osc.frequency.value = fr; osc.detune.value = det;
        osc.connect(f); osc.start(t); osc.stop(t + dur + 0.05);
      });
    });
  }
  // Whoosh: ruido por un pasabanda que barre de 'from' a 'to'
  function whoosh(a, t, dur, from, to, vol, o) {
    o = o || {};
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noise(a);
    f.type = 'bandpass'; f.Q.value = o.q || 1.4;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * (o.peak || 0.7));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); out(a, g, o.pan || 0, o.send == null ? 0.3 : o.send);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  // Golpe grave con caída de tono (sensación de "peso")
  function thump(a, t, vol, from, to) {
    var o = a.createOscillator(), g = a.createGain();
    o.frequency.setValueAtTime(from || 140, t);
    o.frequency.exponentialRampToValueAtTime(to || 42, t + 0.22);
    env(g, t, vol, 0.004, 0.32);
    o.connect(g); out(a, g, 0, 0.15);
    o.start(t); o.stop(t + 0.4);
  }
  // Click corto de ruido filtrado (tacto, no tono)
  function click(a, t, freq, vol, send) {
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noise(a);
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 4;
    env(g, t, vol, 0.001, 0.035);
    src.connect(f); f.connect(g); out(a, g, 0, send || 0);
    src.start(t, Math.random()); src.stop(t + 0.06);
  }

  var N = { C3: 130.81, G3: 196, A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, B4: 493.88,
            C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.66,
            E6: 1318.5, G6: 1568, A6: 1760, B6: 1975.5, D7: 2349.3 };

  var SOUNDS = {
    tap:     function (a, t) { click(a, t, 3200, 0.22); },
    select:  function (a, t) { click(a, t, 2400, 0.18); bell(a, t, N.E6, 0.18, 0.05, { index: 1.2, send: 0.2 }); },
    detent:  function (a, t) { click(a, t, 1800, 0.25); },
    toggle:  function (a, t) { bell(a, t, N.A5, 0.25, 0.10, { index: 1.5, send: 0.25 }); bell(a, t + 0.07, N.E6, 0.3, 0.10, { index: 1.5, send: 0.3 }); },
    swipe:   function (a, t) { whoosh(a, t, 0.28, 600, 3200, 0.22, { send: 0.2 }); click(a, t + 0.24, 2000, 0.12); },
    open:    function (a, t) { whoosh(a, t, 0.32, 400, 2400, 0.18, { peak: 0.6 }); bell(a, t + 0.18, N.D6, 0.4, 0.05, { send: 0.5 }); },
    close:   function (a, t) { whoosh(a, t, 0.26, 2400, 380, 0.16, { peak: 0.3 }); },
    flip:    function (a, t) {
      whoosh(a, t, 0.34, 500, 4200, 0.2, { pan: -0.4 });
      whoosh(a, t + 0.05, 0.34, 700, 3600, 0.15, { pan: 0.4 });
      click(a, t + 0.3, 1600, 0.2, 0.2);
    },
    reveal:  function (a, t) {
      [N.B5, N.D6, N.G6, N.B6, N.D7].forEach(function (f, i) {
        bell(a, t + i * 0.045, f, 1.1, 0.07, { index: 1.8, ratio: 4.1, pan: (i % 2 ? 0.5 : -0.5), send: 0.7 });
      });
    },
    success: function (a, t) {
      thump(a, t, 0.35, 120, 50);
      bell(a, t + 0.02, N.G5, 1.4, 0.16, { index: 2.4, pan: -0.25 });
      bell(a, t + 0.12, N.D6, 1.6, 0.15, { index: 2.4, pan: 0.25 });
      bell(a, t + 0.22, N.B6, 1.8, 0.08, { index: 1.4, ratio: 4.1, send: 0.8 });
      whoosh(a, t + 0.1, 0.9, 5000, 9000, 0.05, { q: 0.8, send: 0.8 });
    },
    warning: function (a, t) {
      bell(a, t, N.E5, 0.5, 0.14, { index: 3, ratio: 2.7, send: 0.3 });
      bell(a, t + 0.16, N.C5, 0.6, 0.14, { index: 3, ratio: 2.7, send: 0.3 });
    },
    error:   function (a, t) {
      thump(a, t, 0.4, 180, 60);
      thump(a, t + 0.17, 0.45, 150, 40);
      bell(a, t, N.A3, 0.5, 0.10, { index: 5, ratio: 1.41, send: 0.2 });
    },
    // Ingreso: barrido que sube, golpe grave, acorde abierto (Cmaj9) que
    // florece y una lluvia de campanas brillantes paneadas en estéreo.
    welcome: function (a, t) {
      whoosh(a, t, 0.7, 180, 6000, 0.26, { peak: 0.95, q: 1.1, send: 0.4 });
      whoosh(a, t + 0.05, 0.7, 260, 7000, 0.14, { peak: 0.95, q: 2, pan: 0.6 });
      thump(a, t + 0.66, 0.55, 110, 38);
      pad(a, t + 0.62, [N.C3, N.G3, N.D4, N.E4, N.B4], 2.8, 0.05, { from: 250, to: 5200, att: 0.12 });
      bell(a, t + 0.66, N.C5, 2.4, 0.12, { index: 1.6, send: 0.8 });
      var arp = [N.E6, N.G6, N.B6, N.D7, N.B6, N.G6, N.D7];
      arp.forEach(function (f, i) {
        bell(a, t + 0.78 + i * 0.075 + Math.random() * 0.02, f, 1.4, 0.055 - i * 0.004,
             { index: 1.3, ratio: 4.1, pan: Math.sin(i * 1.9) * 0.8, send: 0.9 });
      });
      whoosh(a, t + 0.7, 1.8, 6000, 11000, 0.035, { q: 0.6, peak: 0.2, send: 1 });
    }
  };

  function play(name) {
    if (!soundOn) return;
    var fn = SOUNDS[name], a = ctx();
    if (!fn || !a) return;
    if (a.state !== 'running') { try { a.resume(); } catch (e) {} }
    try { fn(a, a.currentTime + 0.01); } catch (e) { if (window.__fxDebug) console.error(e); }
    // duración del efecto + cola de reverb (2.4s) + margen
    scheduleIdle(name === 'welcome' ? 6500 : 4000);
  }

  // Desbloqueo: se reintenta en cada gesto hasta que el contexto queda
  // 'running' (en iOS puede volver a 'interrupted' y hay que reanudarlo).
  function unlock(e) {
    if (e && isInternal(e.target)) return;
    var a = ctx();
    if (!a) return;
    try {
      if (a.state !== 'running') a.resume();
      var b = a.createBuffer(1, 1, 22050), s = a.createBufferSource();
      s.buffer = b; s.connect(a.destination); s.start(0);
    } catch (e) {}
  }
  ['touchend', 'click', 'pointerup', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, unlock, { capture: true, passive: true });
  });
  // Al salir de la app, bloquear pantalla o abrirse el diálogo biométrico
  // (la página pierde visibilidad/foco), se descarta el audio.
  document.addEventListener('visibilitychange', function () { if (document.hidden) killCtx(); });
  window.addEventListener('pagehide', killCtx);
  window.Haptics_killAudio = killCtx;

  // ---------- Disparo ----------
  var lastAt = 0, lastStrongAt = 0;
  function fire(name) {
    // Tap/select se agrupan (evita doble disparo pointerdown+click); el resto
    // (toggle, éxito, error…) siempre suena, aunque siga a un tap.
    var soft = name === 'tap' || name === 'select' || name === 'detent';
    var now = Date.now();
    if (soft && now - lastAt < 60) return;
    if (soft) lastAt = now;

    if (!soft) lastStrongAt = now;
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
    welcome: function () { fire('welcome'); },
    fx: function (name) { fire(name); },
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
    if (!el || isDisabled(el) || el.hasAttribute('data-fx-test')) return; // las pruebas suenan solas
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
    if (isInternal(e.target)) return;
    // Android ya respondió en pointerdown: el click que sigue a ese toque no
    // debe repetir vibración ni sonido. Sólo actúa en iOS y con mouse.
    if (canVibrate && Date.now() - lastTouchDown < 1500) return;
    feedbackFor(e.target);
  }, true);

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (isInternal(t)) return;
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
    // El sonido de ingreso lo dispara app.js al autenticar (no al mostrar el
    // splash, que aparece ANTES de Face ID).
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
        // Si la acción que originó el toast ya sonó (flip, reveal…), no lo tapes
        if (Date.now() - lastStrongAt < 600) return;
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
