/* =====================================================================
   Seguridad y emergencias (se abre desde el inicio de sesión, sin ingresar)
   - Emergencia: "Bloquear todo" (tarjetas y acceso) y la línea 24/7.
   - Bloqueos: tarjetas, acceso a la app y pausa de transferencias y pagos.
     Cada uno pide cédula y rostro (flujo de assets/ingreso.js).
   - Reportar un movimiento que no reconoces: bloquea, pausa y abre un caso.
   - Estado: qué está bloqueado y desde cuándo. Para quitar los bloqueos se
     confirma con usuario y contraseña.
   - Efectos reales del prototipo:
     · acceso bloqueado: el inicio de sesión solo deja entrar con usuario y
       contraseña (y al entrar se desbloquea);
     · transferencias en pausa: dentro de la app no se abren las acciones
       que sacan dinero;
     · tarjetas bloqueadas: se avisa al entrar.
   - Último ingreso en este celular, con "¿No fuiste tú?".
   Todo es local (localStorage), como el resto del ingreso.
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'pb_seguridad', ULTIMO_KEY = 'pb_ultimo_ingreso';
  var TELEFONO = '1700 742 424';
  // Acciones que sacan dinero: se frenan con las transferencias en pausa
  var SALIDAS = ['Transferir dinero', 'Transferir', 'Pagar servicios', 'Recargar celular', 'Pagar tarjeta',
    'Retirar sin tarjeta', 'Pagar con QR', 'Pagar a un QR'];
  // Qué bloquea cada flujo (el de "amigo" no toca tu cuenta)
  var EFECTOS = {
    propio: ['tarjetas'], robo: ['tarjetas', 'acceso'], acceso: ['acceso'],
    transferencias: ['transferencias'], fraude: ['tarjetas', 'transferencias']
  };
  var NOMBRES = { tarjetas: 'Tarjetas bloqueadas', acceso: 'Acceso a la app bloqueado', transferencias: 'Transferencias y pagos en pausa' };

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function estado() { try { return JSON.parse(leer(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function fijar(e) { guardar(KEY, JSON.stringify(e)); pintarLogin(); }
  function activos() { var e = estado(); return Object.keys(NOMBRES).filter(function (k) { return e[k]; }); }

  function h(tag, attrs, hijos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (hijos || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function icono(nombre) { return h('span', { class: 'material-symbols-rounded', text: nombre, 'aria-hidden': 'true' }); }
  function aviso(t) { if (typeof showToast === 'function') showToast(t); }

  // "hoy, 08:12", "ayer, 19:40" o "12 oct, 08:12"
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function cuando(iso) {
    var d = new Date(iso), hoy = new Date(), ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    var hora = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === hoy.toDateString()) return 'hoy, ' + hora;
    if (d.toDateString() === ayer.toDateString()) return 'ayer, ' + hora;
    return d.getDate() + ' ' + MESES[d.getMonth()] + ', ' + hora;
  }
  function equipo() {
    var ua = navigator.userAgent || '';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/Android/.test(ua)) return 'celular Android';
    return 'computadora';
  }

  /* ---------- Centro de seguridad (bottom sheet) ---------- */
  function abrir() {
    if (!window.Ingreso) return;
    Ingreso.hoja('Seguridad y emergencias', pintar);
  }
  function volver() { abrir(); }

  function fila(ic, titulo, sub, alTocar, activo) {
    var b = h('button', { class: 'seg-fila', type: 'button' }, [
      h('span', { class: 'seg-fila__ic' }, [icono(ic)]),
      h('span', { class: 'seg-fila__txt' }, [h('b', { text: titulo }), sub ? h('small', { text: sub }) : null]),
      activo ? h('span', { class: 'seg-tag', text: 'Activo' }) : icono('chevron_right')
    ]);
    b.addEventListener('click', alTocar);
    return b;
  }

  function pintar(c) {
    var e = estado(), on = activos();

    // Estado: lo que está bloqueado ahora
    if (on.length) {
      var lista = h('ul', { class: 'seg-estado__lista' });
      on.forEach(function (k) { lista.appendChild(h('li', { text: NOMBRES[k] + ' · desde ' + cuando(e[k]) })); });
      var quitar = h('button', { class: 'login-button login-button--tertiary', type: 'button', text: 'Quitar bloqueos' });
      quitar.addEventListener('click', function () {
        Ingreso.cerrarHoja();
        Ingreso.clave('Para quitar los bloqueos, confirma que eres tú con tu usuario y contraseña.', function () {
          fijar({});
          setTimeout(function () { aviso('Quitamos los bloqueos de tu cuenta'); }, 1800);
        });
      });
      c.append(h('div', { class: 'bp-alert bp-alert--error seg-estado', role: 'status' }, [
        h('div', { class: 'bp-alert__content' }, [
          h('span', { class: 'bp-alert__icon material-symbols-rounded', text: 'lock', 'aria-hidden': 'true' }),
          h('div', { class: 'bp-alert__text' }, [h('p', { class: 'bp-alert__title', text: 'Bloqueos activos' }), lista])
        ]),
        quitar
      ]));
    }

    // Emergencia
    var todo = h('button', { class: 'bp-button bp-button--destructive seg-sos', type: 'button' }, [icono('emergency_home'), h('span', { text: 'Bloquear todo ahora' })]);
    todo.addEventListener('click', function () { Ingreso.bloquear('robo', volver); });
    var llamar = h('a', { class: 'seg-fila', href: 'tel:' + TELEFONO.replace(/\s/g, '') }, [
      h('span', { class: 'seg-fila__ic' }, [icono('call')]),
      h('span', { class: 'seg-fila__txt' }, [h('b', { text: 'Llamar a la línea de emergencia' }), h('small', { text: TELEFONO + ' · las 24 horas' })]),
      icono('chevron_right')
    ]);
    c.append(
      h('p', { class: 'ing-hoja__seccion', text: 'Si te robaron o perdiste el celular' }),
      h('p', { class: 'ing__texto', text: 'Bloqueamos tus tarjetas y el acceso a la app en un solo paso.' }),
      todo, llamar
    );

    // Bloqueos uno por uno
    c.append(
      h('p', { class: 'ing-hoja__seccion', text: 'Bloqueos' }),
      fila('credit_card_off', 'Bloquear mis tarjetas', 'Débito y crédito, al instante', function () { Ingreso.bloquear('propio', volver); }, e.tarjetas),
      fila('phonelink_lock', 'Bloquear el acceso a la app', 'Nadie entra a tu cuenta desde ningún celular', function () { Ingreso.bloquear('acceso', volver); }, e.acceso),
      fila('pause_circle', 'Pausar transferencias y pagos', 'Sigues recibiendo dinero', function () { Ingreso.bloquear('transferencias', volver); }, e.transferencias),
      fila('group', 'Ayudar a un amigo', 'Bloquea las tarjetas de otra persona', function () { Ingreso.bloquear('amigo', volver); })
    );

    // Reportar
    c.append(
      h('p', { class: 'ing-hoja__seccion', text: 'Reportar' }),
      fila('report', 'No reconozco un movimiento', 'Bloqueamos, pausamos y te llamamos', function () { Ingreso.bloquear('fraude', volver); }),
      fila('lock_reset', 'Alguien entró a mi cuenta', 'Bloquea el acceso y cambia tu contraseña', function () { Ingreso.bloquear('acceso', volver); })
    );

    // Prevención
    c.append(
      h('p', { class: 'ing-hoja__seccion', text: 'Cuídate de estafas' }),
      h('ul', { class: 'seg-consejos' }, [
        h('li', { text: 'Pichibank nunca te pide tu contraseña, PIN ni clave digital por llamada, chat o correo.' }),
        h('li', { text: 'Si te llaman "del banco" y te piden un código, cuelga y llama tú al ' + TELEFONO + '.' }),
        h('li', { text: 'Antes de transferir por una oferta o un premio, revisa con alguien de confianza.' })
      ])
    );
  }

  /* ---------- Efectos en el inicio de sesión ---------- */
  function pintarLogin() {
    var e = estado();
    var banner = document.getElementById('login-bloqueo');
    var btn = document.getElementById('btn-login-biometric');
    if (banner) {
      banner.hidden = !e.acceso;
      if (e.acceso) banner.querySelector('.bp-alert__body').textContent =
        'Desde ' + cuando(e.acceso) + '. Para volver a entrar, confirma con tu usuario y contraseña.';
    }
    // El texto del botón lo pinta app.js (con el acceso bloqueado dice "Desbloquear y entrar")
    if (window.BPLogin && BPLogin.repintar) BPLogin.repintar();
    else if (btn && e.acceso && !window.__authBusy) { btn.disabled = false; btn.textContent = 'Desbloquear y entrar'; }
    var otro = document.getElementById('btn-login-other');
    if (otro) otro.hidden = !!e.acceso;
    pintarUltimo();
  }
  function pintarUltimo() {
    var p = document.getElementById('login-ultimo');
    if (!p) return;
    var u = null;
    try { u = JSON.parse(leer(ULTIMO_KEY) || 'null'); } catch (x) {}
    p.hidden = !u;
    if (!u) return;
    p.textContent = '';
    var no = h('button', { type: 'button', class: 'login-ultimo__link', text: '¿No fuiste tú?' });
    no.addEventListener('click', function () { Ingreso.bloquear('robo', volver); });
    p.append(icono('history'), h('span', { text: 'Último ingreso: ' + cuando(u.t) + ' en ' + u.equipo + '. ' }), no);
  }

  // Con el acceso bloqueado, todo intento de entrar pasa por usuario y contraseña
  document.addEventListener('click', function (ev) {
    if (!estado().acceso) return;
    var el = ev.target.closest && ev.target.closest('#btn-login-biometric, #btn-login-other');
    if (!el) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    Ingreso.clave('Tu acceso está bloqueado. Confirma que eres tú con tu usuario y contraseña.', function () {
      var e = estado(); delete e.acceso; fijar(e);
      setTimeout(function () { aviso('Desbloqueamos tu acceso a la app'); }, 1800);
    });
  }, true);

  // Dentro de la app: con transferencias en pausa, no sale dinero
  document.addEventListener('click', function (ev) {
    if (!estado().transferencias) return;
    var login = document.getElementById('login-screen');
    if (login && login.classList.contains('active')) return; // en el login ya pide ingresar
    var el = ev.target.closest && ev.target.closest('[data-action]');
    if (!el || SALIDAS.indexOf(el.dataset.action) < 0) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    aviso('Tus transferencias y pagos están en pausa por seguridad');
  }, true);

  // Al aplicar un bloqueo desde el flujo de cédula y rostro
  document.addEventListener('seguridad:bloqueo', function (ev) {
    var tipos = EFECTOS[ev.detail && ev.detail.tipo] || [];
    if (!tipos.length) return;
    var e = estado(), ahora = new Date().toISOString();
    tipos.forEach(function (k) { if (!e[k]) e[k] = ahora; });
    fijar(e);
  });

  // Al entrar: guarda el último ingreso y recuerda lo que sigue bloqueado
  function alEntrar() {
    guardar(ULTIMO_KEY, JSON.stringify({ t: new Date().toISOString(), equipo: equipo() }));
    var e = estado();
    var msj = e.tarjetas && e.transferencias ? 'Tus tarjetas siguen bloqueadas y tus transferencias en pausa'
      : e.tarjetas ? 'Tus tarjetas siguen bloqueadas por seguridad'
      : e.transferencias ? 'Tus transferencias y pagos siguen en pausa' : '';
    if (msj) setTimeout(function () { aviso(msj); }, 1600);
  }
  document.addEventListener('DOMContentLoaded', function () {
    var login = document.getElementById('login-screen');
    if (login) {
      var estaba = login.classList.contains('active');
      new MutationObserver(function () {
        var ahora = login.classList.contains('active');
        if (estaba && !ahora) alEntrar();
        if (!estaba && ahora) pintarLogin();
        estaba = ahora;
      }).observe(login, { attributes: true, attributeFilter: ['class'] });
    }
    var sos = document.getElementById('btn-seguridad');
    if (sos) sos.addEventListener('click', abrir);
    pintarLogin();
  });

  window.Seguridad = { abrir: abrir, estado: estado, activos: activos };
})();
