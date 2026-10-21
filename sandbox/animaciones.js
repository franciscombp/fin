/* Laboratorio: animaciones y microinteracciones de la app.
   A pantalla completa se ve una animación a la vez, con su marcado real (buscador.css, uku-app.css,
   asistente.css, soporte.css…). La píldora flotante abre la hoja de cambios: cuál ver, la velocidad
   (cámara lenta) y los efectos de háptica y sonido (haptics.js). */
(function () {
  'use strict';
  var S = window.Sandbox, out = document.getElementById('out'), stage = document.getElementById('stage'), esc = S.esc, sx = document.querySelector('.sx');
  var velocidad = 1, actual = 'sxin', timer = null;
  var FX = [['tap', 'Toque', 'Cada botón'], ['select', 'Elegir', 'Chips y filas'], ['success', 'Éxito', 'Transferencia hecha, atajo guardado'], ['open', 'Abrir', 'Hojas y buscador'], ['close', 'Cerrar', 'Hojas'], ['toggle', 'Interruptor', 'Ajustes'], ['detent', 'Tope', 'Deslizar para abrir el buscador'], ['swipe', 'Deslizar', 'Stories'], ['reveal', 'Revelar', 'Saldo'], ['tick', 'Tic', 'Clasificar un consumo'], ['flip', 'Voltear', 'Tarjeta'], ['welcome', 'Bienvenida', 'Al ingresar']];
  // Cada animación con el marcado real de la app; se vuelve a insertar para repetirla
  var ANIM = [
    { id: 'sxin', t: 'Entrada de resultados', s: 'sxIn · buscador.css · cada tarjeta del buscador entra con un leve desplazamiento', html: function () { return '<section class="sx-card"><h3>Resultados</h3>' + S.row('', 'send_money', 'Transferir', 'Acción') + S.row('', 'help', '¿Cuándo llega mi transferencia?', 'Pregunta frecuente') + S.row('', 'inventory_2', 'Cuenta de ahorros', 'Producto') + '</section>'; } },
    { id: 'pulse', t: 'Micrófono escuchando', s: 'sxPulse · buscador.css · el botón late mientras dicta', on: 'is-listening', html: function () { return '<section class="sx-card"><form class="sx-field" onsubmit="return false"><input type="search" placeholder="Te escucho…" disabled><button type="button" class="sx-mic"><span class="material-symbols-rounded">mic</span></button></form></section>'; } },
    { id: 'pop', t: 'Frase entendida', s: 'sxPop · buscador.css · el micrófono se vuelve un visto', on: 'is-heard', html: function () { return '<section class="sx-card"><form class="sx-field" onsubmit="return false"><input type="search" value="transferir 20 a kevin" disabled><button type="button" class="sx-mic"><span class="material-symbols-rounded">check</span></button></form></section>'; } },
    { id: 'dots', t: 'Uku escribiendo', s: 'ukDot · uku-app.css · tres puntos que suben por turnos', html: function () { return '<section class="sx-card"><div class="uk"><p class="uk-msg__b uk-dots" aria-label="Uku está escribiendo"><i></i><i></i><i></i></p></div></section>'; } },
    { id: 'me', t: 'Mensaje mío', s: 'ukMe · uku-app.css · entra desde la derecha', html: function () { return '<section class="sx-card"><div class="uk"><div class="uk-me"><p>¿Cuánto debo de la tarjeta?</p></div></div></section>'; } },
    { id: 'card', t: 'Tarjeta de Uku', s: 'ukCard · uku-app.css · la respuesta sube y se asienta', html: function () { return '<section class="sx-card"><div class="uk is-cards"><section class="uk-card" style="--n:0"><header class="uk-card__top"><span class="uk-card__q">¿Cuánto debo de la tarjeta?</span></header><div class="uk-card__body"><p class="uk-card__t">Tu Mastercard corta el 25 y debes $ 118,60. Si pagas el total, no hay intereses.</p></div></section></div></section>'; } },
    { id: 'spin', t: 'Enviando… y listo', s: 'pfSpin · asistente.css · el spinner gira y aparece el visto', html: function () { return '<section class="sx-card sx-kb"><div class="sx-kb__body"><div class="pf-linking"><span class="pf-spinner"></span><h3>Enviando tu solicitud…</h3></div></div></section>'; }, luego: function () { return '<section class="sx-card sx-kb"><div class="sx-kb__body"><div class="pf-linking"><span class="pf-done material-symbols-rounded">check</span><h3>Listo</h3><p>Comprobante N.º R-20481</p></div></div></section>'; } },
    { id: 'meter', t: 'Medidor', s: 'uk-meter · uku-app.css · la barra llena con una curva suave', html: function () { return '<section class="sx-card sx-kb"><div class="sx-kb__body"><div class="uk"><div class="uk-meter"><i style="width:2%"></i></div><p class="uk-meter__l">$ 640 de $ 2.000 de tu meta</p></div></div></section>'; }, luego: function (st) { var i = st.querySelector('.uk-meter i'); if (i) i.style.width = '32%'; return null; } },
    { id: 'toast', t: 'Aviso', s: 'pf-toast · asistente.css · sube desde abajo y se va solo', html: function () { S.aviso('Atajo guardado'); return S.nota('El aviso aparece abajo de la pantalla.'); } },
    { id: 'typing', t: 'Asesor escribiendo', s: 'spDot · soporte.css · los puntos del chat de soporte', html: function () { return '<section class="sx-card"><div class="sp"><div class="sp-msg sp-msg--uku"><div class="sp-msg__body"><p class="sp-typing"><i></i><i></i><i></i></p></div></div></div></section>'; } },
    { id: 'chips', t: 'Chips y filas al tocar', s: 'sistema.css · estados hover, active y seleccionado del design system', html: function () { return S.chips([S.chip('data-demo-chip', 'Toca un chip', true), S.chip('data-demo-chip', 'Otro', false), S.chip('data-demo-chip', 'Y otro', false)]) + '<section class="sx-card">' + S.row('data-demo-row', 'touch_app', 'Mantén presionada esta fila', 'El fondo cambia mientras la tocas') + '</section>'; } }
  ];
  function anim(id) { return ANIM.filter(function (x) { return x.id === id; })[0]; }
  // El escenario: la animación elegida, su explicación y «Repetir»
  function escenario() {
    var a = anim(actual);
    stage.innerHTML = S.card(a.t, '<p class="sx-kb__p">' + esc(a.s) + '</p>', 'Animación ' + (ANIM.indexOf(a) + 1) + ' de ' + ANIM.length + (velocidad !== 1 ? ' · ' + velocidad + '×' : '')) + '<div id="escena"></div>' + S.chips([S.chip('data-play', 'Repetir'), S.chip('data-sig', 'Siguiente')]);
    reproducir();
  }
  function reproducir() {
    var a = anim(actual), st = document.getElementById('escena'); if (!a || !st) return;
    clearTimeout(timer);
    if (a.on) sx.classList.remove(a.on);
    st.innerHTML = ''; void st.offsetWidth; st.innerHTML = a.html();
    if (a.on) requestAnimationFrame(function () { sx.classList.add(a.on); });
    frenar(st);
    if (a.luego) timer = setTimeout(function () { var h2 = a.luego(st); if (h2) { st.innerHTML = h2; frenar(st); } }, 1400 / velocidad);
  }
  // Cámara lenta: todas las animaciones y transiciones del escenario corren a la velocidad elegida
  function frenar(st) { requestAnimationFrame(function () { try { st.getAnimations({ subtree: true }).forEach(function (an) { an.playbackRate = velocidad; }); } catch (e) {} }); }
  // La hoja de cambios: qué ver, a qué velocidad, y la háptica
  function hoja() {
    var H = window.Haptics, sonido = (function () { try { return localStorage.getItem('bp_sound') === 'on'; } catch (e) { return false; } })();
    out.innerHTML = S.chips([1, .5, .25, .1].map(function (v) { return S.chip('data-vel="' + v + '"', v === 1 ? 'Normal' : v + '×', velocidad === v); }), 'Velocidad') +
      S.sec('Animaciones', ANIM.map(function (a) { return S.row('data-ver="' + a.id + '"', a.id === actual ? 'play_circle' : 'play_arrow', esc(a.t), esc(a.s.split(' · ')[1] || ''), a.id === actual ? 'Viendo' : ''); }).join('')) +
      S.sec('Háptica y sonido · haptics.js', '<div class="sx-chips">' + S.chip('data-haptica', 'Vibración', H && H.isEnabled && H.isEnabled()) + S.chip('data-sonido', 'Sonido', sonido) + '</div>' +
        FX.map(function (x) { return S.row('data-fx="' + x[0] + '"', 'vibration', esc(x[1]), esc(x[2] + ' · Haptics.fx(\'' + x[0] + '\')'), 'Probar'); }).join('')) +
      S.nota('La vibración solo existe en Android (navigator.vibrate); en iOS no hay API y solo suena. El sonido se sintetiza con WebAudio y se desbloquea con un gesto. Con «Reducir movimiento» activado, la app quita las animaciones.') +
      S.versionRow();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fx],[data-vel],[data-play],[data-sig],[data-ver],[data-haptica],[data-sonido],[data-demo-chip]'); if (!b) return;
    var d = b.dataset, H = window.Haptics;
    if (d.fx) { if (!H) return S.aviso('haptics.js no cargó'); if (d.fx === 'welcome') H.welcome(); else H.fx(d.fx); S.aviso('Haptics.fx(\'' + d.fx + '\')'); return; }
    if (d.haptica != null) { if (H && H.setEnabled) H.setEnabled(!(H.isEnabled && H.isEnabled())); hoja(); return; }
    if (d.sonido != null) { var on = (function () { try { return localStorage.getItem('bp_sound') === 'on'; } catch (e) { return false; } })(); if (H && H.setSoundEnabled) H.setSoundEnabled(!on); hoja(); S.aviso(!on ? 'Sonido activado: prueba un efecto' : 'Sonido apagado'); return; }
    if (d.vel) { velocidad = +d.vel; hoja(); escenario(); return; }
    if (d.ver) { actual = d.ver; hoja(); escenario(); S.cerrarHoja(); return; }
    if (d.play != null) return reproducir();
    if (d.sig != null) { actual = ANIM[(ANIM.indexOf(anim(actual)) + 1) % ANIM.length].id; hoja(); return escenario(); }
    if (d.demoChip != null) { b.parentElement.querySelectorAll('.sx-chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); if (H) H.fx('select'); return; }
  });
  hoja(); escenario();
})();
