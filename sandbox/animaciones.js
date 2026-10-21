/* Laboratorio: animaciones y microinteracciones de la app.
   Háptica y sonido (haptics.js), y las animaciones CSS reales (buscador.css, uku-app.css, asistente.css…)
   reproducidas con su propio marcado, con control de velocidad para verlas en cámara lenta. */
(function () {
  'use strict';
  var S = window.Sandbox, out = document.getElementById('out'), q = document.getElementById('q'), esc = S.esc, sx = document.querySelector('.sx');
  var velocidad = 1, filtro = '';
  var FX = [['tap', 'Toque', 'Cada botón'], ['select', 'Elegir', 'Chips y filas'], ['success', 'Éxito', 'Transferencia hecha, atajo guardado'], ['open', 'Abrir', 'Hojas y buscador'], ['close', 'Cerrar', 'Hojas'], ['toggle', 'Interruptor', 'Ajustes'], ['detent', 'Tope', 'Deslizar para abrir el buscador'], ['swipe', 'Deslizar', 'Stories'], ['reveal', 'Revelar', 'Saldo'], ['tick', 'Tic', 'Clasificar un consumo'], ['flip', 'Voltear', 'Tarjeta'], ['welcome', 'Bienvenida', 'Al ingresar']];
  // Cada animación con el marcado real de la app; se vuelve a insertar para repetirla
  var ANIM = [
    { id: 'sxin', t: 'Entrada de resultados', s: 'sxIn · buscador.css · cada tarjeta del buscador entra con un leve desplazamiento', html: function () { return '<section class="sx-card"><h3>Resultados</h3>' + S.row('', 'send_money', 'Transferir', 'Acción') + S.row('', 'help', '¿Cuándo llega mi transferencia?', 'Pregunta frecuente') + '</section>'; } },
    { id: 'pulse', t: 'Micrófono escuchando', s: 'sxPulse · buscador.css · el botón late mientras dicta', on: 'is-listening', html: function () { return '<form class="sx-field" onsubmit="return false"><input type="search" placeholder="Te escucho…" disabled><button type="button" class="sx-mic"><span class="material-symbols-rounded">mic</span></button></form>'; } },
    { id: 'pop', t: 'Frase entendida', s: 'sxPop · buscador.css · el micrófono se vuelve un visto', on: 'is-heard', html: function () { return '<form class="sx-field" onsubmit="return false"><input type="search" value="transferir 20 a kevin" disabled><button type="button" class="sx-mic"><span class="material-symbols-rounded">check</span></button></form>'; } },
    { id: 'dots', t: 'Uku escribiendo', s: 'ukDot · uku-app.css · tres puntos que suben por turnos', html: function () { return '<div class="uk"><p class="uk-msg__b uk-dots" aria-label="Uku está escribiendo"><i></i><i></i><i></i></p></div>'; } },
    { id: 'me', t: 'Mensaje mío', s: 'ukMe · uku-app.css · entra desde la derecha', html: function () { return '<div class="uk"><div class="uk-me"><p>¿Cuánto debo de la tarjeta?</p></div></div>'; } },
    { id: 'card', t: 'Tarjeta de Uku', s: 'ukCard · uku-app.css · la respuesta sube y se asienta', html: function () { return '<div class="uk is-cards"><section class="uk-card" style="--n:0"><header class="uk-card__top"><span class="uk-card__q">¿Cuánto debo de la tarjeta?</span></header><div class="uk-card__body"><p class="uk-card__t">Tu Mastercard corta el 25 y debes $ 118,60. Si pagas el total, no hay intereses.</p></div></section></div>'; } },
    { id: 'spin', t: 'Enviando… y listo', s: 'pfSpin · asistente.css · el spinner gira y aparece el visto', html: function () { return '<div class="pf-linking"><span class="pf-spinner"></span><h3>Enviando tu solicitud…</h3></div>'; }, luego: function () { return '<div class="pf-linking"><span class="pf-done material-symbols-rounded">check</span><h3>Listo</h3><p>Comprobante N.º R-20481</p></div>'; } },
    { id: 'meter', t: 'Medidor', s: 'uk-meter · uku-app.css · la barra llena con una curva suave', html: function () { return '<div class="uk"><div class="uk-meter"><i style="width:2%"></i></div><p class="uk-meter__l">$ 640 de $ 2.000 de tu meta</p></div>'; }, luego: function (st) { var i = st.querySelector('.uk-meter i'); if (i) i.style.width = '32%'; return null; } },
    { id: 'toast', t: 'Aviso', s: 'pf-toast · asistente.css · sube desde abajo y se va solo', html: function () { S.aviso('Atajo guardado'); return '<p class="sx-kb__p">El aviso aparece abajo de la pantalla.</p>'; } },
    { id: 'typing', t: 'Asesor escribiendo', s: 'spDot · soporte.css · los puntos del chat de soporte', html: function () { return '<div class="sp"><div class="sp-msg sp-msg--uku"><div class="sp-msg__body"><p class="sp-typing"><i></i><i></i><i></i></p></div></div></div>'; } }
  ];
  function pintar() {
    var h = '';
    var fxs = FX.filter(function (x) { return !filtro || (x[1] + ' ' + x[2]).toLowerCase().indexOf(filtro) >= 0; });
    var H = window.Haptics;
    if (fxs.length) h += S.sec('Háptica y sonido · haptics.js', '<div class="sx-chips">' + S.chip('data-haptica', 'Vibración', H && H.isEnabled && H.isEnabled()) + S.chip('data-sonido', 'Sonido', H && H.isSoundEnabled ? H.isSoundEnabled() : (function () { try { return localStorage.getItem('bp_sound') === 'on'; } catch (e) { return false; } })()) + '</div>' +
      fxs.map(function (x) { return S.row('data-fx="' + x[0] + '"', 'vibration', esc(x[1]), esc(x[2] + ' · Haptics.fx(\'' + x[0] + '\')'), 'Probar'); }).join(''));
    h += S.chips([1, .5, .25, .1].map(function (v) { return S.chip('data-vel="' + v + '"', v === 1 ? 'Normal' : v + '×', velocidad === v); }), 'Velocidad');
    ANIM.filter(function (a) { return !filtro || (a.t + ' ' + a.s).toLowerCase().indexOf(filtro) >= 0; }).forEach(function (a) {
      h += '<section class="sx-card sx-kb"><h3>' + esc(a.t) + '</h3><div class="sx-kb__body"><p class="sx-kb__p">' + esc(a.s) + '</p><div class="sx-kb__pasos" data-stage="' + a.id + '"></div><div class="sx-chips">' + S.chip('data-play="' + a.id + '"', 'Repetir') + '</div></div></section>';
    });
    h += S.nota('La vibración solo existe en Android (navigator.vibrate); en iOS no hay API y solo suena. El sonido se sintetiza con WebAudio y se desbloquea con un gesto. Con «Reducir movimiento» activado, la app quita las animaciones.');
    h += S.versionRow();
    out.innerHTML = h;
    ANIM.forEach(function (a) { reproducir(a.id); });
  }
  function reproducir(id) {
    var a = ANIM.filter(function (x) { return x.id === id; })[0], st = out.querySelector('[data-stage="' + id + '"]'); if (!a || !st) return;
    if (a.on) sx.classList.remove(a.on);
    st.innerHTML = ''; void st.offsetWidth; st.innerHTML = a.html();
    if (a.on) requestAnimationFrame(function () { sx.classList.add(a.on); });
    frenar(st);
    if (a.luego) setTimeout(function () { var h2 = a.luego(st); if (h2) { st.innerHTML = h2; frenar(st); } }, 1400 / velocidad);
  }
  // Cámara lenta: todas las animaciones y transiciones del escenario corren a la velocidad elegida
  function frenar(st) { requestAnimationFrame(function () { try { st.getAnimations({ subtree: true }).forEach(function (an) { an.playbackRate = velocidad; }); } catch (e) {} }); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fx],[data-vel],[data-play],[data-haptica],[data-sonido]'); if (!b) return;
    var d = b.dataset, H = window.Haptics;
    if (d.fx) { if (!H) return S.aviso('haptics.js no cargó'); if (d.fx === 'welcome') H.welcome(); else H.fx(d.fx); S.aviso('Haptics.fx(\'' + d.fx + '\')'); return; }
    if (d.haptica != null) { if (H && H.setEnabled) H.setEnabled(!(H.isEnabled && H.isEnabled())); pintar(); return; }
    if (d.sonido != null) { var on = (function () { try { return localStorage.getItem('bp_sound') === 'on'; } catch (e) { return false; } })(); if (H && H.setSoundEnabled) H.setSoundEnabled(!on); pintar(); S.aviso(!on ? 'Sonido activado: prueba un efecto' : 'Sonido apagado'); return; }
    if (d.vel) { velocidad = +d.vel; pintar(); return; }
    if (d.play) return reproducir(d.play);
  });
  q.addEventListener('input', function () { filtro = q.value.trim().toLowerCase(); pintar(); });
  document.getElementById('form').addEventListener('submit', function (e) { e.preventDefault(); });
  pintar();
})();
