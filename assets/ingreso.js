/* =====================================================================
   Ingreso cuando el celular no tiene biometría y clave digital.
   - pin(): PIN de 4 dígitos del dispositivo (simulado). La primera vez se
     crea; tres intentos fallidos llevan a usuario y contraseña.
   - otro(): "Otro método de ingreso": PIN de 6 dígitos. Tiene "Olvidé mi
     PIN", que lleva a usuario y contraseña y borra el PIN de 6 para crear
     uno nuevo al siguiente ingreso.
   - clave(): usuario y contraseña (demo: contraseña CLAVE_DEMO, o la que
     la persona haya cambiado). Desde ahí se recupera el usuario o se
     cambia la contraseña con el correo registrado.
   - token(): clave digital, sóftoken TOTP (RFC 6238, 6 dígitos, cada 30 s).
   - etiqueta(): texto del botón principal según la biometría del equipo.
   Todo es local (prototipo): PIN, contraseñas y secreto viven en localStorage.
   Entrar lo hace window.BPLogin.entrar(usuario) (app.js).
   ===================================================================== */
(function () {
  'use strict';

  var PIN_KEY = 'pb_pin', PIN6_KEY = 'pb_pin6', TOTP_KEY = 'pb_totp';
  var CLAVE_DEMO = 'pichibank', CLAVE_MIN = 8, MAX_INTENTOS = 3, PASO = 30;
  var USUARIO_DEMO = 'andres', DOMINIO = '@ejemplo.ec';
  var BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  var overlay = null, limpiar = null;

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function borrar(k) { try { localStorage.removeItem(k); } catch (e) {} }

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
    cuerpo.className = 'ing__body';
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

  // Huella de un dato sensible (PIN o contraseña): nunca se guarda en claro
  async function resumen(sal, texto) {
    var bytes = new TextEncoder().encode(sal + ':' + texto);
    var d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(d, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /* ---------- PIN del dispositivo (4 dígitos) y PIN de otro método (6) ---------- */
  function pin(longitud, llave) {
    longitud = longitud || 4;
    llave = llave || PIN_KEY;
    var seisDigitos = llave === PIN6_KEY;
    var sufijo = longitud === 4 ? '' : ' de ' + longitud + ' dígitos';
    var creando = !leer(llave);
    var primero = null, digitos = '', fallos = 0, ocupado = false;
    var ui = {};

    function pintarPuntos() {
      ui.puntos.querySelectorAll('span').forEach(function (s, i) { s.classList.toggle('on', i < digitos.length); });
    }
    function titulo(t) { document.getElementById('ing-titulo').textContent = t; }
    function textoCrear() { return 'Elige ' + longitud + ' números. Los usarás para entrar en este celular.'; }

    async function completo() {
      var d = digitos;
      digitos = '';
      pintarPuntos();
      ocupado = true;
      try {
        var r = await resumen('pin', d);
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
            titulo('Crea tu PIN' + sufijo);
            ui.texto.textContent = textoCrear();
            ui.error.textContent = 'No coincide. Empieza de nuevo.';
            sacudir(ui.puntos);
            return;
          }
          guardar(llave, r);
          return entrarCon(activa());
        }
        if (r === leer(llave)) return entrarCon(activa());
        fallos++;
        sacudir(ui.puntos);
        if (fallos >= MAX_INTENTOS) return clave('Tu PIN no coincide. Ingresa con tu usuario y contraseña.', seisDigitos ? borrarPin6 : null);
        var quedan = MAX_INTENTOS - fallos;
        ui.error.textContent = 'PIN incorrecto. ' + (quedan === 1 ? 'Te queda 1 intento.' : 'Te quedan ' + quedan + ' intentos.');
      } finally {
        ocupado = false;
      }
    }

    abrir(creando ? 'Crea tu PIN' + sufijo : 'Ingresa tu PIN' + sufijo, function (cuerpo) {
      ui.texto = h('p', { class: 'ing__texto', text: creando ? textoCrear() : 'Escribe tu PIN de ' + longitud + ' números.' });
      ui.puntos = h('div', { class: 'ing__puntos' }, Array.from({ length: longitud }, function () { return h('span'); }));
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
          else if (digitos.length < longitud) digitos += k;
          pintarPuntos();
          if (digitos.length === longitud) completo();
        });
        ui.teclas.appendChild(tecla);
      });
      var nodos = [ui.texto, ui.puntos, ui.error];
      if (seisDigitos && !creando) {
        var olvide = h('button', { class: 'login-button login-button--tertiary', type: 'button', text: 'Olvidé mi PIN' });
        olvide.addEventListener('click', function () { clave('', borrarPin6); });
        nodos.push(olvide);
      }
      nodos.push(ui.teclas);
      cuerpo.classList.add('ing__body--pin');
      cuerpo.append.apply(cuerpo, nodos);
    });
  }

  function borrarPin6() { borrar(PIN6_KEY); }

  function otro() { pin(6, PIN6_KEY); }

  /* ---------- Usuario y contraseña ---------- */
  // Con contraseña cambiada guardada, se valida contra esa; si no, contra la demo
  async function validarClave(id, p) {
    var guardada = leer('pb_clave_' + id);
    if (!guardada) return p === CLAVE_DEMO;
    return (await resumen('clave|' + id, p)) === guardada;
  }

  function clave(aviso, alEntrar) {
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
      var recuperarBtn = h('button', { class: 'login-button login-button--tertiary', type: 'button', text: 'Recuperar usuario y contraseña' });
      recuperarBtn.addEventListener('click', function () { recuperar(alEntrar); });
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var id = usuario.value.trim().toLowerCase();
        var existe = window.Persona && id ? await Persona.persona(id) : null;
        if (existe && await validarClave(id, contrasena.value)) {
          if (alEntrar) alEntrar();
          return entrarCon(id);
        }
        error.textContent = 'Usuario o contraseña incorrectos.';
        sacudir(form);
      });
      cuerpo.append(
        h('p', { class: 'ing__texto', text: 'Demo: contraseña ' + CLAVE_DEMO + '. Usuarios: andres, rosa, daniela, jorge o luis.' }),
        form,
        recuperarBtn
      );
    });
  }

  /* ---------- Recuperar usuario y contraseña (con el correo registrado) ---------- */
  async function buscarPorCorreo(correo) {
    var c = correo.trim().toLowerCase();
    if (!window.Persona || !c) return null;
    var lista = await Persona.usuarios();
    return lista.filter(function (u) { return u.usuario + DOMINIO === c; })[0] || null;
  }

  function recuperar(alEntrar) {
    abrir('Recuperar acceso', function (cuerpo) {
      var cuenta = null;
      var correo = h('input', { class: 'ing__campo', type: 'email', name: 'correo', placeholder: 'Correo registrado', autocomplete: 'email', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Correo registrado' });
      var error = h('p', { class: 'ing__error', role: 'alert' });
      var resultado = h('p', { class: 'ing__texto', role: 'status' });
      var nueva = h('input', { class: 'ing__campo', type: 'password', placeholder: 'Nueva contraseña', autocomplete: 'new-password', 'aria-label': 'Nueva contraseña' });
      var repite = h('input', { class: 'ing__campo', type: 'password', placeholder: 'Repite la nueva contraseña', autocomplete: 'new-password', 'aria-label': 'Repite la nueva contraseña' });
      var cambio = h('form', { class: 'ing__form', novalidate: '', hidden: '' }, [
        nueva,
        repite,
        h('button', { class: 'login-button login-button--primary', type: 'submit', text: 'Guardar contraseña' })
      ]);
      var buscar = h('form', { class: 'ing__form', novalidate: '' }, [
        correo,
        error,
        h('button', { class: 'login-button login-button--primary', type: 'submit', text: 'Buscar mi cuenta' })
      ]);
      var soloUsuario = h('button', { class: 'login-button login-button--tertiary', type: 'button', text: 'Solo recuperar mi usuario' });

      async function encontrar() {
        cuenta = await buscarPorCorreo(correo.value);
        if (!cuenta) { error.textContent = 'No encontramos una cuenta con ese correo.'; sacudir(buscar); return null; }
        error.textContent = '';
        resultado.textContent = 'Tu usuario es ' + cuenta.usuario + '.';
        return cuenta;
      }

      buscar.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (await encontrar()) cambio.hidden = false;
      });
      soloUsuario.addEventListener('click', async function () {
        if (await encontrar()) cambio.hidden = true;
      });

      cambio.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!cuenta) return;
        if (nueva.value.length < CLAVE_MIN) { error.textContent = 'La contraseña debe tener al menos ' + CLAVE_MIN + ' caracteres.'; sacudir(cambio); return; }
        if (nueva.value !== repite.value) { error.textContent = 'Las contraseñas no coinciden.'; sacudir(cambio); return; }
        guardar('pb_clave_' + cuenta.usuario, await resumen('clave|' + cuenta.usuario, nueva.value));
        cambio.remove();
        soloUsuario.remove();
        buscar.remove();
        error.textContent = '';
        resultado.textContent = 'Listo. Tu nueva contraseña ya funciona para ' + cuenta.usuario + '.';
        cuerpo.append(h('button', { class: 'login-button login-button--primary', type: 'button', text: 'Ir a ingresar', 'data-ing-ir': '' }));
        cuerpo.querySelector('[data-ing-ir]').addEventListener('click', function () { clave('', alEntrar); });
      });

      cuerpo.append(
        h('p', { class: 'ing__texto', text: 'Ingresa el correo con el que te registraste. Demo: usuario@ejemplo.ec, por ejemplo rosa@ejemplo.ec.' }),
        buscar,
        soloUsuario,
        resultado,
        cambio
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
    hoja('Clave digital', function (cuerpo) {
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

  /* ---------- Conexión real: una petición que sale a la red, no navigator.onLine ----------
     El service worker responde desde caché a los archivos de la app si no hay red, así que la
     sonda es un archivo que no está en caché: si no hay red falla; si hay, responde (aunque sea 404). */
  var SONDA = './assets/sonda.txt';
  var en = navigator.onLine !== false;
  function enLinea() { return en; }
  function pintarRed(conectado) {
    var cambio = conectado !== en;
    en = conectado;
    document.body.classList.toggle('sin-red', !en);
    // Los accesos que necesitan internet quedan visibles pero deshabilitados
    document.querySelectorAll('[data-online-only]').forEach(function (el) { el.disabled = !en; });
    var aviso = document.getElementById('login-offline');
    if (aviso) aviso.hidden = en;
    if (cambio) document.dispatchEvent(new CustomEvent('red:cambio', { detail: en }));
  }
  function sonda() {
    if (!navigator.onLine) return pintarRed(false);
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, 4000);
    fetch(SONDA + '?t=' + Date.now(), { cache: 'no-store', signal: ctl.signal })
      .then(function () { clearTimeout(t); pintarRed(true); }, function () { clearTimeout(t); pintarRed(false); });
  }
  window.addEventListener('online', sonda);
  window.addEventListener('offline', function () { pintarRed(false); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') sonda(); });
  document.addEventListener('DOMContentLoaded', function () { pintarRed(en); sonda(); });

  // Sin internet, las acciones que mueven dinero no se abren; lo informativo sigue igual.
  // Va en captura sobre el documento: también frena los clics que hace el buscador.
  // Tickets de transporte no está aquí: los tickets comprados se muestran sin internet
  var TRANSACCIONALES = ['Transferir dinero', 'Transferir', 'Pagar servicios', 'Recargar celular', 'Pagar tarjeta',
    'Retirar sin tarjeta', 'Pagar con QR', 'Pagar a un QR'];
  document.addEventListener('click', function (e) {
    if (en) return;
    var el = e.target.closest && e.target.closest('[data-action]');
    if (!el || TRANSACCIONALES.indexOf(el.dataset.action) < 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (typeof showToast === 'function') showToast('Sin internet: esta función necesita conexión');
  }, true);
  setInterval(sonda, 30000);

  /* ---------- Bottom sheets del login (no piden ingreso) ---------- */
  var hojaEl = null, hojaBk = null;
  function hoja(titulo, pintar) {
    if (!hojaEl) {
      hojaBk = h('div', { class: 'as-sheet-back' });
      hojaEl = h('div', { class: 'as-sheet ing-hoja', role: 'dialog', 'aria-labelledby': 'ing-hoja-titulo' }, [
        h('div', { class: 'as-sheet__handle' }),
        h('h3', { class: 'ing-hoja__titulo', id: 'ing-hoja-titulo' }),
        h('div', { class: 'ing-hoja__body' })
      ]);
      hojaBk.addEventListener('click', cerrarHoja);
      document.body.appendChild(hojaBk);
      document.body.appendChild(hojaEl);
    }
    if (limpiar) { limpiar(); limpiar = null; }
    hojaEl.querySelector('#ing-hoja-titulo').textContent = titulo;
    var cuerpo = hojaEl.querySelector('.ing-hoja__body');
    cuerpo.textContent = '';
    pintar(cuerpo);
    hojaBk.classList.add('open');
    hojaEl.classList.add('open');
  }
  function cerrarHoja() {
    if (limpiar) { limpiar(); limpiar = null; }
    if (hojaEl) { hojaEl.classList.remove('open'); hojaBk.classList.remove('open'); }
  }

  // El QR de demostración lo arma index.html (FAKE_QR_SVG); si no está, no se muestra nada
  function mostrarQR(cuerpo) {
    cuerpo.append(
      h('div', { class: 'ing-qr' }),
      h('p', { class: 'ing__texto', text: 'Muéstralo para que te paguen desde cualquier banco.' })
    );
    cuerpo.querySelector('.ing-qr').innerHTML = typeof FAKE_QR_SVG === 'string' ? FAKE_QR_SVG : '';
  }

  // Tickets de transporte ya comprados: se muestran sin internet (demo local)
  var TICKETS_DEMO = [
    { nombre: 'Metro de Quito', detalle: 'Pase de 5 viajes · 3 disponibles' },
    { nombre: 'Bus urbano', detalle: 'Viaje sencillo · usado' }
  ];
  function mostrarTickets(cuerpo) {
    var tickets = JSON.parse(leer('pb_tickets') || 'null') || TICKETS_DEMO;
    if (!tickets.length) { cuerpo.append(h('p', { class: 'ing__texto', text: 'Aún no tienes tickets comprados.' })); return; }
    tickets.forEach(function (t) {
      cuerpo.append(h('div', { class: 'ing-ticket' }, [
        h('span', { class: 'material-symbols-rounded', text: 'directions_transit', 'aria-hidden': 'true' }),
        h('div', { class: 'ing-ticket__texto' }, [
          h('p', { class: 'ing-ticket__nombre', text: t.nombre }),
          h('p', { class: 'ing__texto', text: t.detalle })
        ])
      ]));
    });
  }

  // Ayuda: lo que se hace sin ingresar, y los temas frecuentes; al tocar un tema se abre su respuesta
  function fila(icono, texto, alTocar) {
    var b = h('button', { class: 'ing-ayuda__fila', type: 'button' }, [
      h('span', { class: 'material-symbols-rounded', text: icono, 'aria-hidden': 'true' }),
      h('span', { text: texto })
    ]);
    b.addEventListener('click', alTocar);
    return b;
  }
  function mostrarAyuda(cuerpo) {
    cuerpo.append(h('p', { class: 'ing-hoja__seccion', text: 'Sin ingresar puedes' }));
    cuerpo.append(fila('lock_reset', 'No puedo ingresar', function () { hoja('No puedo ingresar', mostrarNoPuedo); }));
    cuerpo.append(fila('block', 'Bloquear mis tarjetas', function () { flujoBloqueo(FLUJOS.propio); }));
    cuerpo.append(fila('emergency', 'Me robaron el celular', function () { flujoBloqueo(FLUJOS.robo); }));
    cuerpo.append(fila('group', 'Ayudar a un amigo', function () { flujoBloqueo(FLUJOS.amigo); }));
    cuerpo.append(h('p', { class: 'ing-hoja__seccion', text: 'Preguntas frecuentes' }));
    var temas = window.Soporte && Soporte.faqs ? Soporte.faqs(5) : [];
    temas.forEach(function (t) {
      cuerpo.append(fila(t.icon || 'help', t.t, function () { cerrarHoja(); if (window.Soporte) Soporte.openFaq(t.i); }));
    });
    var centro = h('button', { class: 'login-button login-button--tertiary', type: 'button', text: 'Centro de ayuda' });
    centro.addEventListener('click', function () { cerrarHoja(); if (window.Soporte) Soporte.open(); });
    cuerpo.append(centro);
  }

  // No puedo ingresar: las salidas del ingreso (recuperar, clave) y el caso del celular
  function mostrarNoPuedo(cuerpo) {
    cuerpo.append(
      fila('person_search', 'Recuperar usuario y contraseña', function () { cerrarHoja(); recuperar(); }),
      fila('password', 'Ingresar con usuario y contraseña', function () { cerrarHoja(); clave(''); }),
      fila('block', 'Bloquear mis tarjetas', function () { flujoBloqueo(FLUJOS.propio); }),
      h('button', { class: 'login-button login-button--tertiary', type: 'button', text: 'Volver a ayuda', 'data-ing-volver-ayuda': '' })
    );
    cuerpo.querySelector('[data-ing-volver-ayuda]').addEventListener('click', function () { hoja('Ayuda', mostrarAyuda); });
  }

  // Bloqueo con cédula y verificación facial (demostración: el rostro no se compara con un registro real)
  var FLUJOS = {
    propio: { titulo: 'Bloquear mis tarjetas', tipo: 'propio',
      intro: 'Necesitamos tu cédula y confirmar con tu rostro. Luego bloqueamos tus tarjetas.',
      rostro: 'Confirma que eres tú mirando la cámara.', confirma: 'Vas a bloquear tus tarjetas.', final: 'Listo. Tus tarjetas están bloqueadas.' },
    robo: { titulo: 'Me robaron el celular', tipo: 'robo',
      intro: 'Bloqueamos tus tarjetas y el acceso a la app. Necesitamos tu cédula y confirmar con tu rostro.',
      rostro: 'Confirma que eres tú mirando la cámara.', confirma: 'Vas a bloquear tus tarjetas y el acceso a la app.', final: 'Listo. Bloqueamos tus tarjetas y tu acceso. Cuando recuperes tu celular, ingresa con tu usuario y contraseña.' },
    amigo: { titulo: 'Ayudar a un amigo', tipo: 'amigo', paraAmigo: true,
      intro: 'Si a tu amigo le robaron el celular, bloqueamos sus tarjetas. Pide su cédula y que confirme con su rostro.',
      rostro: 'Tu amigo debe mirar la cámara para confirmar que es él.', confirma: 'Vas a bloquear las tarjetas de tu amigo.', final: 'Listo. Bloqueamos las tarjetas de tu amigo.' }
  };

  // Cédula ecuatoriana: 10 dígitos, provincia 01-24, tercer dígito menor que 6 y verificador (módulo 10)
  function cedulaValida(c) {
    if (!/^\d{10}$/.test(c)) return false;
    var prov = +c.slice(0, 2);
    if (prov < 1 || prov > 24 || +c[2] >= 6) return false;
    var s = 0;
    for (var i = 0; i < 9; i++) { var d = +c[i] * (i % 2 === 0 ? 2 : 1); s += d > 9 ? d - 9 : d; }
    return (10 - s % 10) % 10 === +c[9];
  }

  function flujoBloqueo(f) {
    var cedula = '';
    function paso1(c) {
      var campo = h('input', { class: 'ing__campo', type: 'text', inputmode: 'numeric', maxlength: '10', placeholder: f.paraAmigo ? 'Cédula de tu amigo' : 'Tu cédula', 'aria-label': 'Cédula' });
      var error = h('p', { class: 'ing__error', role: 'alert' });
      var seguir = h('button', { class: 'login-button login-button--primary', type: 'button', text: 'Continuar' });
      seguir.addEventListener('click', function () {
        var v = campo.value.trim();
        if (!cedulaValida(v)) { error.textContent = 'Revisa la cédula: tiene 10 números válidos.'; sacudir(campo); return; }
        cedula = v; paso2(c);
      });
      c.append(h('p', { class: 'ing__texto', text: f.intro }), campo, error, seguir,
        h('p', { class: 'ing__texto', text: 'Demo: cédula 1712345675' }),
        h('button', { class: 'login-button login-button--tertiary', type: 'button', text: 'Volver a ayuda', 'data-ing-volver-ayuda': '' }));
      c.querySelector('[data-ing-volver-ayuda]').addEventListener('click', function () { hoja('Ayuda', mostrarAyuda); });
    }
    function paso2(c) {
      c.textContent = '';
      var video = h('video', { class: 'ing-video', playsinline: '', muted: '' });
      var stream = null;
      var estado = h('p', { class: 'ing__texto', text: f.rostro });
      var confirmar = h('button', { class: 'login-button login-button--primary', type: 'button', text: 'Confirmar mi rostro' });
      function parar() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
      limpiar = parar;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(function (s) {
          stream = s; video.srcObject = s; video.play().catch(function () {});
        }).catch(function () { estado.textContent = 'No pudimos abrir la cámara. Permite el acceso para continuar.'; });
      } else {
        estado.textContent = 'Este navegador no tiene cámara disponible para confirmar tu rostro.';
      }
      confirmar.addEventListener('click', function () { parar(); limpiar = null; paso3(c); });
      c.append(h('p', { class: 'ing__texto', text: 'Verificación facial (demostración)' }), video, estado, confirmar,
        h('button', { class: 'login-button login-button--tertiary', type: 'button', text: 'Volver a ayuda', 'data-ing-volver-ayuda': '' }));
      c.querySelector('[data-ing-volver-ayuda]').addEventListener('click', function () { hoja('Ayuda', mostrarAyuda); });
    }
    function paso3(c) {
      c.textContent = '';
      c.append(
        h('p', { class: 'ing__texto', text: f.confirma + ' Cédula ' + cedula.slice(0, 2) + '••••••' + cedula.slice(8) + '.' }),
        h('button', { class: 'login-button login-button--primary', type: 'button', text: 'Bloquear', 'data-ing-bloquear': '' }),
        h('button', { class: 'login-button login-button--tertiary', type: 'button', text: 'Cancelar', 'data-ing-volver-ayuda': '' })
      );
      c.querySelector('[data-ing-volver-ayuda]').addEventListener('click', function () { hoja('Ayuda', mostrarAyuda); });
      c.querySelector('[data-ing-bloquear]').addEventListener('click', function () {
        var reg = JSON.parse(leer('pb_bloqueos') || '[]');
        reg.push({ tipo: f.tipo, fecha: new Date().toISOString(), cedula: cedula.slice(0, 2) + '••••••' + cedula.slice(8) });
        guardar('pb_bloqueos', JSON.stringify(reg));
        c.textContent = '';
        c.append(h('p', { class: 'ing__texto', text: f.final }),
          h('button', { class: 'login-button login-button--primary', type: 'button', text: 'Listo', 'data-ing-listo': '' }));
        c.querySelector('[data-ing-listo]').addEventListener('click', cerrarHoja);
      });
    }
    hoja(f.titulo, paso1);
  }

  // Accesos del login que se abren como bottom sheet (no piden ingreso)
  var HOJAS_LOGIN = {
    'Cobrar con QR': function () { hoja('Mostrar mi QR', mostrarQR); },
    'Clave digital': function () { token(); },
    'Soporte': function () { hoja('Ayuda', mostrarAyuda); },
    'Pagar transporte': function () { hoja('Tickets transporte', mostrarTickets); }
  };
  document.addEventListener('click', function (e) {
    var enLogin = document.getElementById('login-screen');
    if (!enLogin || !enLogin.classList.contains('active')) return;
    var el = e.target.closest && e.target.closest('[data-action]');
    if (!el || !HOJAS_LOGIN[el.dataset.action]) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    HOJAS_LOGIN[el.dataset.action]();
  }, true);

  /* ---------- Texto del botón principal ---------- */
  function nombreBiometria() {
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios ? 'Face ID' : 'huella';
  }

  function etiqueta(biometria) {
    return biometria ? 'Ingresar con ' + nombreBiometria() : 'Ingresar con PIN';
  }

  window.Ingreso = {
    enLinea: enLinea, etiqueta: etiqueta, pin: pin, otro: otro, clave: clave, recuperar: recuperar,
    token: token, totp: totp, aBytes: aBytes, aBase32: aBase32
  };
})();
