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
  var running = false;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  }
  resize();
  addEventListener('resize', resize);

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function launchRocket() {
    rockets.push({
      x: rand(innerWidth * 0.2, innerWidth * 0.8) * dpr,
      y: innerHeight * dpr,
      vx: rand(-0.6, 0.6) * dpr,
      vy: rand(-13, -10) * dpr,
      color: pick(COLORS),
      fuse: rand(28, 42) // frames hasta explotar
    });
  }

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
        explode(r.x, r.y, r.color);
        rockets.splice(i, 1);
      }
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

    if (rockets.length || particles.length) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      canvas.classList.remove('show');
    }
  }

  function fireworksShow() {
    canvas.classList.add('show');
    // Tanda de cohetes escalonados
    for (var i = 0; i < 5; i++) setTimeout(launchRocket, i * 180);
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  btn.addEventListener('click', function () {
    fireworksShow();
    celebrate();
    btn.classList.remove('pulse');
    void btn.offsetWidth;
    btn.classList.add('pulse');
  });
})();
