/*
 * Fiesta patria: pirotecnia con los colores de Ecuador + contador compartido.
 *
 * El botón flotante lanza fuegos artificiales (canvas) y suma un festejo al
 * contador global servido por server.js (GET/POST /api/celebrations). Si el
 * servidor no está disponible (p. ej. GitHub Pages sin backend), cae a un
 * contador local en localStorage para no romper la experiencia.
 */
(function () {
  'use strict';

  // Colores de la bandera de Ecuador (+ blanco para chispas)
  var COLORS = ['#FFDD00', '#034EA2', '#ED1C24', '#ffffff'];

  var API = window.FIESTA_API || 'http://localhost:8787/api/celebrations';
  var LOCAL_KEY = 'bp_fiesta_count';
  var POLL_MS = 3000;

  var btn = document.getElementById('fiesta-btn');
  var counterEl = document.getElementById('fiesta-count');
  if (!btn || !counterEl) return;

  // ---------- Contador (server con fallback local) ----------
  var serverOk = false;

  function setCount(n) {
    counterEl.textContent = new Intl.NumberFormat('es-EC').format(n);
  }

  function localCount(delta) {
    var n = (parseInt(localStorage.getItem(LOCAL_KEY), 10) || 0) + (delta || 0);
    if (delta) localStorage.setItem(LOCAL_KEY, String(n));
    return n;
  }

  function refresh() {
    fetch(API, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { serverOk = true; setCount(d.count); })
      .catch(function () { serverOk = false; setCount(localCount(0)); });
  }

  function celebrate() {
    // Optimista: pinta ya el +1 mientras confirma el server
    setCount((parseInt(counterEl.textContent.replace(/\D/g, ''), 10) || 0) + 1);
    fetch(API, { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) { serverOk = true; setCount(d.count); })
      .catch(function () { serverOk = false; setCount(localCount(1)); });
  }

  refresh();
  setInterval(refresh, POLL_MS); // "tiempo real" sencillo: sondeo cada 3 s

  // ---------- Pirotecnia (canvas) ----------
  var canvas = document.getElementById('fiesta-canvas');
  var ctx = canvas.getContext('2d');
  var particles = [];
  var rockets = [];
  var flagParts = []; // partículas del firework especial que forma la bandera
  var running = false;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var FLAG_EVERY = 5; // cada N festejos, un firework forma la bandera
  var rocketBaseY = innerHeight * 0.45; // altura de lanzamiento (desde la zona gris)

  function resize() {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    // Recalcular la altura de lanzamiento si la ventana cambia
    var loginTop = document.querySelector('.login-screen__top');
    if (loginTop) {
      var rect = loginTop.getBoundingClientRect();
      rocketBaseY = rect.bottom;
    }
  }
  resize();
  addEventListener('resize', resize);

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function launchRocket(isFlag) {
    rockets.push({
      x: (isFlag ? innerWidth * 0.5 : rand(innerWidth * 0.2, innerWidth * 0.8)) * dpr,
      y: rocketBaseY * dpr,
      vx: isFlag ? 0 : rand(-0.6, 0.6) * dpr,
      vy: (isFlag ? -12.5 : rand(-13, -10)) * dpr,
      color: isFlag ? '#FFDD00' : pick(COLORS),
      flag: !!isFlag,
      fuse: isFlag ? 38 : rand(28, 42) // frames hasta explotar
    });
  }

  /*
   * Explosión especial: las chispas vuelan desde el punto de estallido hasta
   * formar la bandera de Ecuador (amarillo 50%, azul 25%, rojo 25%),
   * la sostienen un instante y luego caen desvaneciéndose.
   */
  function explodeFlag(cx, cy) {
    var COLS = 26, ROWS = 16;
    var cw = Math.min(innerWidth * 0.62, 280) * dpr; // ancho de la bandera
    var ch = cw * 0.62;                              // proporción aprox. 2:3
    for (var row = 0; row < ROWS; row++) {
      var color = row < ROWS / 2 ? '#FFDD00' : row < ROWS * 0.75 ? '#034EA2' : '#ED1C24';
      for (var col = 0; col < COLS; col++) {
        flagParts.push({
          sx: cx, sy: cy,
          tx: cx + (col / (COLS - 1) - 0.5) * cw + rand(-1.5, 1.5) * dpr,
          ty: cy + (row / (ROWS - 1) - 0.5) * ch + rand(-1.5, 1.5) * dpr,
          x: cx, y: cy,
          age: 0,
          fly: 34,   // frames volando hacia su lugar
          hold: 55,  // frames sosteniendo la bandera
          fade: 34,  // frames cayendo/desvaneciéndose
          color: color,
          size: rand(1.8, 2.6) * dpr
        });
      }
    }
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function explode(x, y, color) {
    var n = 70;
    for (var i = 0; i < n; i++) {
      var a = (Math.PI * 2 * i) / n + rand(-0.05, 0.05);
      var sp = rand(1.6, 5.2) * dpr;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(45, 80),
        age: 0,
        color: Math.random() < 0.75 ? color : pick(COLORS),
        size: rand(1.2, 2.6) * dpr
      });
    }
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = rockets.length - 1; i >= 0; i--) {
      var r = rockets[i];
      r.x += r.vx; r.y += r.vy; r.vy += 0.12 * dpr; r.fuse--;
      ctx.globalAlpha = 1;
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.2 * dpr, 0, Math.PI * 2);
      ctx.fill();
      if (r.fuse <= 0 || r.vy > -2 * dpr) {
        if (r.flag) explodeFlag(r.x, Math.min(r.y, innerHeight * 0.38 * dpr));
        else explode(r.x, r.y, r.color);
        rockets.splice(i, 1);
      }
    }

    // Partículas de la bandera: vuelan a su lugar, sostienen y caen
    for (var k = flagParts.length - 1; k >= 0; k--) {
      var fp = flagParts[k];
      fp.age++;
      var alpha = 1;
      if (fp.age <= fp.fly) {
        var t = easeOutCubic(fp.age / fp.fly);
        fp.x = fp.sx + (fp.tx - fp.sx) * t;
        fp.y = fp.sy + (fp.ty - fp.sy) * t;
      } else if (fp.age <= fp.fly + fp.hold) {
        fp.x = fp.tx; fp.y = fp.ty;
        alpha = 0.85 + 0.15 * Math.sin(fp.age * 0.4); // titileo sutil
      } else {
        var ft = (fp.age - fp.fly - fp.hold) / fp.fade;
        if (ft >= 1) { flagParts.splice(k, 1); continue; }
        fp.ty += 0.9 * dpr; fp.y = fp.ty; // cae suavemente
        alpha = 1 - ft;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fp.color;
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, fp.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.045 * dpr;     // gravedad
      p.vx *= 0.985; p.vy *= 0.985;
      p.age++;
      var t = 1 - p.age / p.life;
      if (t <= 0) { particles.splice(j, 1); continue; }
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (rockets.length || particles.length || flagParts.length) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      canvas.classList.remove('show');
    }
  }

  var clicks = 0;

  function fireworksShow(withFlag) {
    canvas.classList.add('show');
    // Tanda de cohetes escalonados
    for (var i = 0; i < 5; i++) setTimeout(function () { launchRocket(false); }, i * 180);
    // Gran final: un cohete central que forma la bandera
    if (withFlag) setTimeout(function () { launchRocket(true); }, 5 * 180 + 150);
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  btn.addEventListener('click', function () {
    clicks++;
    fireworksShow(clicks % FLAG_EVERY === 0);
    celebrate();
    btn.classList.remove('pulse');
    void btn.offsetWidth;
    btn.classList.add('pulse');
  });
})();
