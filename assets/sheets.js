/* =====================================================================
   Hojas inferiores: un solo comportamiento para todas
   (.sheet de Inicio y .as-sheet de Uku, Mis finanzas, Destacados y
   Soporte).
   - Arrastrar hacia abajo desde el uñero, o desde cualquier parte cuando
     el contenido está arriba del todo. Si el contenido tiene scroll, primero
     se recorre el contenido (como en iOS).
   - Se cierra si se arrastra más de un 30% del alto o con un gesto rápido;
     si no, vuelve a su lugar. El fondo se aclara mientras se arrastra.
   - Mientras hay una hoja abierta la página de atrás no se mueve.
   - Escape y el gesto/botón "atrás" del teléfono cierran la hoja de arriba
     (en vez de salir de la app).
   Cada módulo sigue cerrando su hoja a su modo: aquí se "toca" su fondo.
   También expone window.Overlay para que otras capas (el buscador) usen el
   mismo "atrás".
   ===================================================================== */
(function () {
  'use strict';

  var SEL = '.sheet.open, .as-sheet.open';
  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }

  /* ---------- "Atrás" del teléfono ---------- */
  var stack = [], skip = 0;
  var Overlay = {
    push: function (id, close) {
      if (stack.some(function (s) { return s.id === id; })) return;
      stack.push({ id: id, close: close });
      try { history.pushState({ overlay: id }, ''); } catch (e) {}
    },
    // La capa se cerró por la UI: se saca su entrada del historial
    done: function (id) {
      var i = -1; stack.forEach(function (s, k) { if (s.id === id) i = k; });
      if (i < 0) return;
      stack.splice(i, 1);
      skip++; try { history.back(); } catch (e) { skip--; }
    }
  };
  window.addEventListener('popstate', function () {
    if (skip) { skip--; return; }
    var s = stack.pop();
    if (s) s.close();
  });
  window.Overlay = Overlay;

  function openSheets() { return Array.prototype.slice.call(document.querySelectorAll(SEL)); }
  function top() { var l = openSheets(); return l[l.length - 1] || null; }
  function backdrop(sh) {
    var b = sh.previousElementSibling;
    return b && (b.classList.contains('sheet-backdrop') || b.classList.contains('as-sheet-back')) ? b : null;
  }
  function dismiss(sh) { var b = backdrop(sh); if (b) b.click(); else sh.classList.remove('open'); }

  /* Estado global: bloquear la página y registrar el "atrás" */
  var wasOpen = false;
  function sync() {
    var open = !!document.querySelector(SEL);
    if (open === wasOpen) return;
    wasOpen = open;
    document.documentElement.classList.toggle('has-sheet', open);
    if (open) Overlay.push('sheet', function () { var t = top(); if (t) dismiss(t); });
    else Overlay.done('sheet');
  }
  new MutationObserver(sync).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var t = top(); if (!t) return;
    e.stopImmediatePropagation(); e.preventDefault();
    dismiss(t);
  }, true);

  /* ---------- Arrastrar para cerrar ---------- */
  var g = null, justDragged = 0;
  function start(x, y, target) {
    var sh = target.closest && target.closest(SEL);
    if (!sh || target.closest('input, textarea, select, [contenteditable], input[type="range"]')) return null;
    return { sh: sh, x0: x, y0: y, active: false, off: 0, h: sh.offsetHeight, handle: !!target.closest('.sheet__handle, .as-sheet__handle'),
      samples: [[y, performance.now()]], back: backdrop(sh) };
  }
  // Devuelve true si el gesto es de la hoja (hay que evitar el scroll nativo)
  function move(x, y) {
    if (!g) return false;
    var dy = y - g.y0, dx = x - g.x0;
    if (!g.active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { g = null; return false; } // chips con scroll horizontal
      if (dy > 6 && (g.handle || g.sh.scrollTop <= 0)) {
        g.active = true; g.y0 = y; dy = 0;
        g.sh.style.transition = 'none';
        if (g.back) g.back.style.transition = 'none';
      } else if (Math.abs(dy) > 6) { g = null; return false; } // es scroll del contenido
      else return false;
    }
    var was = g.off > g.h * .3;
    g.off = dy > 0 ? dy : dy / 5; // hacia arriba resiste
    if (was !== g.off > g.h * .3) fx('detent');
    g.sh.style.transform = 'translate(-50%, ' + g.off + 'px)';
    if (g.back) g.back.style.opacity = String(Math.max(0, 1 - Math.max(0, g.off) / g.h));
    g.samples.push([y, performance.now()]); if (g.samples.length > 5) g.samples.shift();
    return true;
  }
  function end() {
    if (!g) return;
    var s = g, a = s.samples[0], b = s.samples[s.samples.length - 1];
    g = null;
    if (!s.active) return;
    justDragged = performance.now();
    var v = (b[0] - a[0]) / Math.max(1, b[1] - a[1]); // px/ms hacia abajo
    s.sh.style.transition = ''; if (s.back) { s.back.style.transition = ''; s.back.style.opacity = ''; }
    if (s.off > s.h * .3 || (v > .55 && s.off > 24)) {
      // Cierra desde donde quedó el dedo: la transición sigue hacia abajo
      requestAnimationFrame(function () { s.sh.style.transform = ''; dismiss(s.sh); fx('close'); });
    } else {
      s.sh.style.transform = '';
    }
  }
  // Tacto: con touchmove no pasivo se puede frenar el scroll nativo
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { g = null; return; }
    g = start(e.touches[0].clientX, e.touches[0].clientY, e.target);
  }, { passive: true, capture: true });
  document.addEventListener('touchmove', function (e) {
    if (!g) {
      // Hoja sin scroll propio o fondo: que no se mueva la página de atrás
      if (document.documentElement.classList.contains('has-sheet')) {
        var sh = e.target.closest && e.target.closest(SEL);
        if (!sh ? e.target.closest('.sheet-backdrop, .as-sheet-back') : sh.scrollHeight <= sh.clientHeight + 1) e.preventDefault();
      }
      return;
    }
    if (move(e.touches[0].clientX, e.touches[0].clientY)) e.preventDefault();
  }, { passive: false, capture: true });
  document.addEventListener('touchend', end, { capture: true });
  document.addEventListener('touchcancel', end, { capture: true });
  // Mouse (escritorio)
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button) return;
    g = start(e.clientX, e.clientY, e.target);
  }, true);
  document.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' && g && move(e.clientX, e.clientY)) e.preventDefault(); }, true);
  document.addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse') end(); }, true);
  // Soltar después de arrastrar no cuenta como toque
  document.addEventListener('click', function (e) {
    if (performance.now() - justDragged < 350 && e.target.closest && e.target.closest('.sheet, .as-sheet')) { e.stopPropagation(); e.preventDefault(); }
  }, true);
})();
