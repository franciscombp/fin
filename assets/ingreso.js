/* =====================================================================
   Ingreso cuando el celular no tiene biometría y clave digital.
   - pin(): PIN del dispositivo (simulado). La primera vez se crea; tres
     intentos fallidos llevan a usuario y contraseña.
   - clave(): usuario y contraseña (demo: contraseña CLAVE_DEMO).
   - token(): clave digital, sóftoken TOTP (RFC 6238, 6 dígitos, cada 30 s).
   - etiqueta(): texto del botón principal según la biometría del equipo.
   Todo es local (prototipo): el PIN y el secreto viven en localStorage.
   Entrar lo hace window.BPLogin.entrar(usuario) (app.js).
   ===================================================================== */
(function () {
  'use strict';

  var PIN_KEY = 'pb_pin', TOTP_KEY = 'pb_totp';
  var CLAVE_DEMO = 'pichibank', MAX_INTENTOS = 3, PASO = 30;
  var USUARIO_DEMO = 'andres';
  var BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  var overlay = null, limpiar = null;

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function h(tag, attrs, hijos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (hijos || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  /* ---------- Pantalla de ingreso (superpuesta al inicio de sesión) ---------- */
  function montar() {
    if (overlay) return overlay;
    overlay = h('section', { class: 'ing', id: 'ing', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ing-titulo' }, [
      h('header', { class: 'ing__head' }, [
        h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Volver', 'data-ing-volver': '' }, [
          h('span', { class: 'material-symbols-rounded', text: 'arrow_back' })
        ]),
        h('h2', { class: 'ing__titulo', id: 'ing-titulo' })
      ]),
      h('div', { class: 'ing__body' })
    ]);
    // Volver cancela el ingreso: no queda pendiente ningún acceso protegido
    overlay.querySelector('[data-ing-volver]').addEventListener('click', function () {
      window.__pendingAction = null;
      cerrar();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function abrir(titulo, pintar) {
    var root = montar();
    if (limpiar) { limpiar(); limpiar = null; }
    root.querySelector('#ing-titulo').textContent = titulo;
    var cuerpo = root.querySelector('.ing__body');
    cuerpo.textContent = '';
    pintar(cuerpo);
    root.classList.add('open');
  }

  function cerrar() {
    if (limpiar) { limpiar(); limpiar = null; }
    if (overlay) overlay.classList.remove('open');
  }

  function sacudir(nodo) {
    nodo.classList.remove('sacudir');
    void nodo.offsetWidth; // reinicia la animación si ya estaba
    nodo.classList.add('sacudir');
  }

  function activa() { return window.Persona ? Persona.get() : USUARIO_DEMO; }

  function entrarCon(usuario) {
    cerrar();
    if (window.BPLogin) window.BPLogin.entrar(usuario);
  }

  // Huella del PIN: no se guarda el PIN en claro
  async function resumen(texto) {
    var bytes = new TextEncoder().encode('pichibank-pin:' + texto);
    var d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(d, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /* ---------- PIN del dispositivo ---------- */
  function pin() {
    var creando = !leer(PIN_KEY);
    var primero = null, digitos = '', fallos = 0, ocupado = false;
    var ui = {};

    function pintarPuntos() {
      ui.puntos.querySelectorAll('span').forEach(function (s, i) { s.classList.toggle('on', i < digitos.length); });
    }

    function titulo(t) { document.getElementById('ing-titulo').textContent = t; }

    async function completo() {
      var d = digitos;
      digitos = '';
      pintarPuntos();
      ocupado = true;
      try {
        var r = await resumen(d);
        if (creando) {
          if (primero === null) {
            primero = r;
            titulo('Repite tu PIN');
            ui.texto.textContent = 'Escríbelo otra vez para confirmarlo.';
            ui.error.textContent = '';
            return;
          }
          if (r !== primero) {
            primero = null;
            titulo('Crea tu PIN');
            ui.texto.textContent = 'Elige 4 números. Los usarás para entrar en este celular.';
            ui.error.textContent = 'No coincide. Empieza de nuevo.';
            sacudir(ui.puntos);
            return;
          }
          guardar(PIN_KEY, r);
          return entrarCon(activa());
        }
        if (r === leer(PIN_KEY)) return entrarCon(activa());
        fallos++;
        sacudir(ui.puntos);
        if (fallos >= MAX_INTENTOS) return clave('Tu PIN no coincide. Ingresa con tu usuario y contraseña.');
        var quedan = MAX_INTENTOS - fallos;
        ui.error.textContent = 'PIN incorrecto. ' + (quedan === 1 ? 'Te queda 1 intento.' : 'Te quedan ' + quedan + ' intentos.');
      } finally {
        ocupado = false;
      }
    }

    abrir(creando ? 'Crea tu PIN' : 'Ingresa tu PIN', function (cuerpo) {
      ui.texto = h('p', { class: 'ing__texto', text: creando ? 'Elige 4 números. Los usarás para entrar en este celular.' : 'Escribe tu PIN de 4 números.' });
      ui.puntos = h('div', { class: 'ing__puntos' }, [0, 1, 2, 3].map(function () { return h('span'); }));
      ui.error = h('p', { class: 'ing__error', role: 'alert' });
      ui.teclas = h('div', { class: 'ing__teclas' });
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'].forEach(function (k) {
        if (k === '') { ui.teclas.appendChild(h('span')); return; }
        var tecla = k === '<'
          ? h('button', { class: 'ing__tecla', type: 'button', 'aria-label': 'Borrar' }, [
              h('span', { class: 'material-symbols-rounded', text: 'backspace' })
            ])
          : h('button', { class: 'ing__tecla', type: 'button', text: k });
        tecla.addEventListener('click', function () {
          if (ocupado) return;
          if (k === '<') digitos = digitos.slice(0, -1);
          else if (digitos.length < 4) digitos += k;
          pintarPuntos();
          if (digitos.length === 4) completo();
        });
        ui.teclas.appendChild(tecla);
      });
      cuerpo.append(ui.texto, ui.puntos, ui.error, ui.teclas);
    });
  }

  /* ---------- Usuario y contraseña ---------- */
  function clave(aviso) {
    abrir('Usuario y contraseña', function (cuerpo) {
      var usuario = h('input', { class: 'ing__campo', type: 'text', name: 'usuario', placeholder: 'Usuario', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Usuario' });
      var contrasena = h('input', { class: 'ing__campo', type: 'password', name: 'clave', placeholder: 'Contraseña', autocomplete: 'current-password', 'aria-label': 'Contraseña' });
      var error = h('p', { class: 'ing__error', role: 'alert', text: aviso || '' });
      var form = h('form', { class: 'ing__form', novalidate: '' }, [
        usuario,
        contrasena,
        error,
        h('button', { class: 'login-button login-button--primary', type: 'submit', text: 'Ingresar' })
      ]);
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var id = usuario.value.trim().toLowerCase();
        var existe = window.Persona && id ? await Persona.persona(id) : null;
        if (existe && contrasena.value === CLAVE_DEMO) return entrarCon(id);
        error.textContent = 'Usuario o contraseña incorrectos.';
        sacudir(form);
      });
      cuerpo.append(
        h('p', { class: 'ing__texto', text: 'Demo: contraseña ' + CLAVE_DEMO + '. Usuarios: andres, rosa, daniela, jorge o luis.' }),
        form
      );
    });
  }

  /* ---------- Clave digital (sóftoken TOTP) ---------- */
  function token() {
    var secreto = leer(TOTP_KEY);
    if (!secreto) {
      secreto = aBase32(crypto.getRandomValues(new Uint8Array(20)));
      guardar(TOTP_KEY, secreto);
    }
    abrir('Clave digital', function (cuerpo) {
      var codigo = h('p', { class: 'ing__codigo', text: '··· ···' });
      var barra = h('div', { class: 'ing__barra' }, [h('i')]);
      var cuenta = h('p', { class: 'ing__texto' });
      var copiar = h('button', { class: 'login-button login-button--tertiary', type: 'button', text: 'Copiar código' });
      var valor = '';
      var ultimo = -1;

      function actualizar() {
        var ms = Date.now();
        var resta = PASO - (ms / 1000) % PASO;
        barra.firstChild.style.width = (resta / PASO * 100) + '%';
        cuenta.textContent = 'Cambia en ' + Math.ceil(resta) + ' s';
        var paso = Math.floor(ms / 1000 / PASO);
        if (paso === ultimo) return;
        ultimo = paso;
        totp(aBytes(secreto), ms).then(function (c) {
          valor = c;
          codigo.textContent = c.slice(0, 3) + ' ' + c.slice(3);
        }).catch(function () {
          codigo.textContent = '------';
        });
      }

      var iv = setInterval(actualizar, 250);
      actualizar();
      limpiar = function () { clearInterval(iv); };

      copiar.addEventListener('click', async function () {
        try { await navigator.clipboard.writeText(valor); copiar.textContent = 'Copiado'; }
        catch (e) { copiar.textContent = 'No se pudo copiar'; }
        setTimeout(function () { copiar.textContent = 'Copiar código'; }, 1500);
      });

      cuerpo.append(
        h('p', { class: 'ing__texto', text: 'Úsala para confirmar tus operaciones. Cambia cada 30 segundos.' }),
        codigo,
        barra,
        cuenta,
        copiar,
        h('details', { class: 'ing__detalle' }, [
          h('summary', { text: 'Configurar en otra app' }),
          h('p', { class: 'ing__texto', text: 'Agrega esta clave en tu app de autenticación:' }),
          h('code', { class: 'ing__secreto', text: secreto.replace(/(.{4})/g, '$1 ').trim() })
        ])
      );
    });
  }

  /* TOTP (RFC 6238 con HMAC-SHA1). ms: instante; digitos: 6 por defecto. */
  async function totp(claveBytes, ms, digitos) {
    digitos = digitos || 6;
    var contador = Math.floor(ms / 1000 / PASO);
    var msg = new Uint8Array(8);
    for (var i = 7; i >= 0; i--) { msg[i] = contador % 256; contador = Math.floor(contador / 256); }
    var key = await crypto.subtle.importKey('raw', claveBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    var firma = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
    var off = firma[firma.length - 1] & 0x0f;
    var bin = ((firma[off] & 0x7f) << 24) | (firma[off + 1] << 16) | (firma[off + 2] << 8) | firma[off + 3];
    return String(bin % Math.pow(10, digitos)).padStart(digitos, '0');
  }

  /* Base32 (RFC 4648) para el secreto del sóftoken */
  function aBytes(b32) {
    var bits = 0, valor = 0, out = [];
    for (var i = 0; i < b32.length; i++) {
      var idx = BASE32.indexOf(b32.charAt(i).toUpperCase());
      if (idx < 0) continue;
      valor = ((valor << 5) | idx) & 0x1fff;
      bits += 5;
      if (bits >= 8) { out.push((valor >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return new Uint8Array(out);
  }

  function aBase32(bytes) {
    var bits = 0, valor = 0, out = '';
    bytes.forEach(function (b) {
      valor = ((valor << 8) | b) & 0x1fff;
      bits += 8;
      while (bits >= 5) { out += BASE32.charAt((valor >>> (bits - 5)) & 31); bits -= 5; }
    });
    if (bits > 0) out += BASE32.charAt((valor << (5 - bits)) & 31);
    return out;
  }

  /* ---------- Texto del botón principal ---------- */
  function nombreBiometria() {
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios ? 'Face ID' : 'huella';
  }

  function etiqueta(biometria) {
    return biometria ? 'Ingresar con ' + nombreBiometria() : 'Ingresar con PIN';
  }

  window.Ingreso = { etiqueta: etiqueta, pin: pin, clave: clave, token: token, totp: totp, aBytes: aBytes, aBase32: aBase32 };
})();
