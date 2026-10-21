/* Flujos de pago de punta a punta, en una sola pantalla (como Cash App):
   datos -> [consulta] -> revisar -> procesando -> éxito o error.
   Cada flujo es una definición (campos, monto, cómo se ejecuta) y el motor
   se encarga de validar, de no pagar sin conexión ni sin saldo y de mostrar
   el resultado. Lo usan transferir, pagar servicios, recargar, pagar tarjeta,
   retirar sin tarjeta y pagar con QR. */
(function () {
  'use strict';

  var RECARGA_MONTOS = [3, 5, 10, 15];
  var RETIRO_MONTOS = [20, 40, 60, 100];
  var MS_CONSULTA = 1100;
  var MS_PROCESO = 1600;
  var TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'];

  var raiz = null;
  var st = null;
  var secuencia = 0;

  function dinero(n) { return '$ ' + Number(n).toFixed(2).replace('.', ','); }
  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function referencia() { return String(Math.floor(100000000 + Math.random() * 900000000)); }
  function codigoRetiro() { return String(Math.floor(100000 + Math.random() * 900000)); }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function enLinea() {
    var red = window.Ingreso ? window.Ingreso.enLinea() : true;
    return red && navigator.onLine !== false;
  }
  function valor(x, d) { return typeof x === 'function' ? x(d) : x; }
  function ultimos(n) { return String(n).replace(/\D/g, '').slice(-4); }
  function avisar(msg) { if (window.showToast) window.showToast(msg); }

  /* ---------- Motor ---------- */

  function cuentaDe(d) { return st.cfg.cuentas[d.origen]; }

  // Fondos: la cuenta de origen debe cubrir el monto
  function avisoSaldo() {
    var d = st.datos;
    if (!st.cfg.origen || !(d.monto > cuentaDe(d).balance)) return '';
    return 'Fondos insuficientes en esta cuenta';
  }

  // Paso de datos: qué falta para continuar y qué mensaje mostrar
  function validar() {
    var cfg = st.cfg, d = st.datos, aviso = '', listo = true;
    (cfg.campos || []).forEach(function (c) {
      var v = String(d.campos[c.id] || '').trim();
      if (v.length < (c.minimo || 1)) { listo = false; return; }
      var error = c.validar ? c.validar(v) : '';
      if (error) { aviso = aviso || error; listo = false; }
    });
    if (cfg.monto && !(d.monto > 0)) listo = false;
    if (avisoSaldo()) { aviso = aviso || avisoSaldo(); listo = false; }
    return { listo: listo, aviso: aviso };
  }

  function fila(par) {
    return '<div class="fl__fila"><span>' + escapar(par[0]) + '</span><b>' + escapar(par[1]) + '</b></div>';
  }

  function cabecera(titulo, atras) {
    return '<header class="fl__head">' +
      '<button class="fl__icono" data-fl="' + (atras ? 'atras' : 'cerrar') + '" aria-label="' + (atras ? 'Volver' : 'Cerrar') + '">' +
      '<span class="material-symbols-rounded">' + (atras ? 'arrow_back' : 'close') + '</span></button>' +
      '<h1 class="fl__titulo">' + escapar(titulo) + '</h1></header>';
  }

  function campoHTML(c, d) {
    var id = 'fl-' + c.id;
    var control;
    if (c.opciones) {
      control = '<div class="fl__select"><select class="fl__control" id="' + id + '" data-fl-campo="' + c.id + '">' +
        c.opciones.map(function (o) {
          var sel = String(o.value) === String(d.campos[c.id]) ? ' selected' : '';
          return '<option value="' + escapar(o.value) + '"' + sel + '>' + escapar(o.label) + '</option>';
        }).join('') +
        '</select><span class="material-symbols-rounded">expand_more</span></div>';
    } else {
      control = '<input class="fl__control" id="' + id + '" data-fl-campo="' + c.id + '" type="' + (c.tipo || 'text') +
        '" inputmode="' + (c.inputmode || 'text') + '" autocomplete="off" placeholder="' + escapar(valor(c.placeholder, d) || '') +
        '" value="' + escapar(d.campos[c.id] || '') + '">';
    }
    var ayuda = valor(c.ayuda, d);
    return '<div class="fl__campo"><label class="fl__label" for="' + id + '">' + escapar(valor(c.etiqueta, d)) + '</label>' +
      control + (ayuda ? '<p class="fl__ayuda">' + escapar(ayuda) + '</p>' : '') + '</div>';
  }

  function origenHTML() {
    var d = st.datos;
    return '<div class="fl__campo"><label class="fl__label" for="fl-origen">Cuenta de origen</label>' +
      '<div class="fl__select"><select class="fl__control" id="fl-origen" data-fl-origen>' +
      st.cfg.cuentas.map(function (a, i) {
        return '<option value="' + i + '"' + (i === d.origen ? ' selected' : '') + '>' + escapar(a.name) + ' ****' + escapar(a.acct) +
          ' · ' + escapar(dinero(a.balance)) + '</option>';
      }).join('') +
      '</select><span class="material-symbols-rounded">expand_more</span></div></div>';
  }

  function tecladoHTML() {
    return '<div class="fl__teclas">' + TECLAS.map(function (k) {
      if (k === 'back') return '<button class="fl__tecla" data-fl="tecla" data-valor="back" aria-label="Borrar"><span class="material-symbols-rounded">backspace</span></button>';
      return '<button class="fl__tecla" data-fl="tecla" data-valor="' + k + '">' + k + '</button>';
    }).join('') + '</div>';
  }

  function montoHTML(cfg, d) {
    if (cfg.montoChips) {
      return '<div class="fl__chips">' + cfg.montoChips.map(function (m) {
        return '<button class="fl__chip' + (d.monto === m ? ' is-on' : '') + '" data-fl="chip" data-valor="' + m + '">' + escapar(dinero(m)) + '</button>';
      }).join('') + '</div>';
    }
    return '<div class="fl__monto" aria-live="polite">' + escapar(dinero(d.monto)) + '</div>' + tecladoHTML();
  }

  function htmlDatos() {
    var cfg = st.cfg, d = st.datos;
    var cuerpo = (cfg.campos || []).map(function (c) { return campoHTML(c, d); }).join('');
    if (cfg.origen) cuerpo += origenHTML();
    if (cfg.monto && !cfg.consulta) cuerpo += montoHTML(cfg, d);
    return cabecera(cfg.titulo, false) + '<div class="fl__body">' + cuerpo +
      '<p class="fl__aviso" id="fl-aviso" role="alert"></p>' +
      '<div class="fl__pie"><button class="login-button login-button--primary" id="fl-continuar" data-fl="continuar">' +
      escapar(cfg.continuar || 'Continuar') + '</button></div></div>';
  }

  function htmlRevisar() {
    var cfg = st.cfg, d = st.datos;
    var filas = cfg.resumen ? cfg.resumen(d).slice() : [];
    if (cfg.origen) filas.push(['Desde', cuentaDe(d).name + ' ****' + cuentaDe(d).acct]);
    if (cfg.comision !== false) filas.push(['Comisión', dinero(0)]);
    if (d.consulta && d.consulta.filas) filas = filas.concat(d.consulta.filas);
    var aviso = avisoSaldo();
    return cabecera(cfg.titulo, true) + '<div class="fl__body">' +
      '<div class="fl__monto">' + escapar(dinero(d.monto)) + '</div>' +
      '<div class="card fl__resumen">' + filas.map(fila).join('') + '</div>' +
      '<p class="fl__aviso" role="alert">' + escapar(aviso) + '</p>' +
      '<div class="fl__pie"><button class="login-button login-button--primary" data-fl="confirmar"' + (aviso ? ' disabled' : '') + '>' +
      escapar(cfg.confirmar || 'Confirmar') + '</button></div></div>';
  }

  function htmlEspera(texto) {
    return '<div class="fl__centro"><div class="fl__spin" role="status" aria-label="' + escapar(texto) + '"></div>' +
      '<p class="fl__texto">' + escapar(texto) + '</p></div>';
  }

  function htmlResultado() {
    var r = st.resultado, cfg = st.cfg, d = st.datos;
    if (!r.ok) {
      return '<div class="fl__centro fl__res"><span class="material-symbols-rounded fl__res-icono is-error">error</span>' +
        '<h1 class="fl__res-titulo">' + escapar(r.titulo) + '</h1><p class="fl__texto">' + escapar(r.mensaje) + '</p>' +
        '<div class="fl__pie fl__pie--dos"><button class="login-button login-button--primary" data-fl="reintentar">Intentar de nuevo</button>' +
        '<button class="login-button login-button--secondary" data-fl="cerrar">Cerrar</button></div></div>';
    }
    var ex = cfg.exito;
    var lineas = (valor(ex.lineas, d) || []).map(function (l) { return '<p class="fl__texto">' + escapar(l) + '</p>'; }).join('');
    var filas = ex.filas ? ex.filas(d, r.res) : (r.res.ref ? [['Comprobante', r.res.ref]] : []);
    var codigo = r.res.codigo ? '<div class="fl__codigo" aria-label="Código de retiro">' + escapar(r.res.codigo) + '</div>' : '';
    return '<div class="fl__centro fl__res"><span class="material-symbols-rounded fl__res-icono is-ok">check_circle</span>' +
      '<h1 class="fl__res-titulo">' + escapar(ex.titulo) + '</h1>' +
      '<div class="fl__res-monto">' + escapar(dinero(d.monto)) + '</div>' + lineas + codigo +
      (filas.length ? '<div class="card fl__resumen">' + filas.map(fila).join('') + '</div>' : '') +
      '<div class="fl__pie fl__pie--dos"><button class="login-button login-button--secondary" data-fl="compartir">Compartir comprobante</button>' +
      '<button class="login-button login-button--primary" data-fl="listo">Listo</button></div></div>';
  }

  function render() {
    if (!st) return;
    var html;
    if (st.paso === 'datos') html = htmlDatos();
    else if (st.paso === 'revisar') html = htmlRevisar();
    else if (st.paso === 'consultando') html = htmlEspera('Consultando tu factura…');
    else if (st.paso === 'procesando') html = htmlEspera('Procesando tu operación…');
    else html = htmlResultado();
    raiz.innerHTML = html;
    if (st.paso === 'datos') actualizarDatos();
  }

  // Actualiza el botón y el aviso sin volver a pintar (para no perder el foco al escribir)
  function actualizarDatos() {
    var v = validar();
    var btn = document.getElementById('fl-continuar');
    var aviso = document.getElementById('fl-aviso');
    if (btn) btn.disabled = !v.listo;
    if (aviso) aviso.textContent = v.aviso;
  }

  function teclear(k) {
    var t = st.tecla;
    if (k === 'back') t = t.slice(0, -1);
    else if (k === ',') { if (t.indexOf(',') < 0) t = (t || '0') + ','; }
    else {
      var partes = t.split(',');
      if (partes.length > 1 && partes[1].length >= 2) return;
      if (partes.length === 1 && partes[0].length >= 6) return;
      t = t === '0' ? k : t + k;
    }
    st.tecla = t;
    st.datos.monto = parseFloat(t.replace(',', '.')) || 0;
    var monto = raiz.querySelector('.fl__monto');
    if (monto) monto.textContent = dinero(st.datos.monto);
    actualizarDatos();
  }

  function fallar(err, volver, titulo) {
    st.resultado = { ok: false, titulo: titulo || st.cfg.errorTitulo || 'No pudimos completar tu operación', mensaje: err.message || 'Intenta de nuevo en unos minutos.' };
    st.errorEn = volver;
    st.paso = 'resultado';
    render();
  }

  function consultar() {
    var id = st.id;
    st.paso = 'consultando';
    render();
    Promise.all([
      Promise.resolve().then(function () { return st.cfg.consulta(st.datos); }),
      esperar(MS_CONSULTA)
    ]).then(function (r) {
      if (!st || st.id !== id) return;
      st.datos.consulta = r[0];
      st.datos.monto = r[0].monto;
      st.paso = 'revisar';
      render();
    }).catch(function (err) {
      if (!st || st.id !== id) return;
      fallar(err, 'datos');
    });
  }

  function continuar() {
    if (!validar().listo) return actualizarDatos();
    if (st.cfg.consulta) return consultar();
    st.paso = 'revisar';
    render();
  }

  function confirmar() {
    if (avisoSaldo()) return render();
    var id = st.id;
    if (!enLinea()) {
      st.resultado = { ok: false, titulo: 'Sin conexión', mensaje: 'Necesitas internet para completar esta operación. No se debitó nada.' };
      st.errorEn = 'revisar';
      st.paso = 'resultado';
      return render();
    }
    st.paso = 'procesando';
    render();
    Promise.all([
      Promise.resolve().then(function () { return st.cfg.ejecutar(st.datos); }),
      esperar(MS_PROCESO)
    ]).then(function (r) {
      if (!st || st.id !== id) return;
      st.resultado = { ok: true, res: r[0] };
      st.paso = 'resultado';
      render();
    }).catch(function (err) {
      if (!st || st.id !== id) return;
      fallar(err, 'revisar');
    });
  }

  function compartir() {
    var res = st.resultado.res;
    var texto = st.cfg.exito.titulo + ' · ' + dinero(st.datos.monto) + ' · Comprobante ' + (res.ref || res.codigo || '');
    if (navigator.share) navigator.share({ title: 'Pichibank', text: texto }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(texto).then(function () { avisar('Comprobante copiado'); }, function () {});
    else avisar('Comprobante listo');
  }

  // Prellena el monto del flujo abierto (atajos del buscador: "transferir 20 a María")
  function precargar(monto) {
    if (!st) return;
    st.tecla = Number(monto).toFixed(2).replace('.', ',');
    st.datos.monto = Number(monto);
    render();
  }

  function cerrar() {
    st = null;
    if (raiz) { raiz.classList.remove('open'); raiz.innerHTML = ''; }
  }

  function listo() {
    var ok = st.resultado && st.resultado.ok;
    var alListo = st.cfg.alListo;
    cerrar();
    if (ok && alListo) alListo();
  }

  function alClic(e) {
    var t = e.target.closest('[data-fl]');
    if (!t || !st) return;
    var a = t.dataset.fl;
    if (a === 'cerrar') return cerrar();
    if (a === 'atras') { st.paso = 'datos'; return render(); }
    if (a === 'tecla') return teclear(t.dataset.valor);
    if (a === 'chip') { st.datos.monto = Number(t.dataset.valor); return render(); }
    if (a === 'continuar') return continuar();
    if (a === 'confirmar') return confirmar();
    if (a === 'reintentar') { st.paso = st.errorEn; return render(); }
    if (a === 'listo') return listo();
    if (a === 'compartir') return compartir();
  }

  function alEntrar(e) {
    var c = e.target;
    if (!st || c.tagName !== 'INPUT' || !c.dataset.flCampo) return;
    st.datos.campos[c.dataset.flCampo] = c.value;
    actualizarDatos();
  }

  function alCambiar(e) {
    var s = e.target;
    if (!st || s.tagName !== 'SELECT') return;
    if (s.hasAttribute('data-fl-origen')) { st.datos.origen = Number(s.value); return actualizarDatos(); }
    if (s.dataset.flCampo) { st.datos.campos[s.dataset.flCampo] = s.value; render(); }
  }

  function abrir(cfg) {
    if (!raiz) {
      raiz = document.createElement('div');
      raiz.className = 'fl';
      raiz.setAttribute('role', 'dialog');
      raiz.setAttribute('aria-modal', 'true');
      document.body.appendChild(raiz);
      raiz.addEventListener('click', alClic);
      raiz.addEventListener('input', alEntrar);
      raiz.addEventListener('change', alCambiar);
    }
    var datos = { campos: {}, origen: 0, monto: 0, consulta: null };
    (cfg.campos || []).forEach(function (c) { datos.campos[c.id] = c.valor || ''; });
    if (cfg.sugerido) datos.monto = cfg.sugerido;
    secuencia += 1;
    st = {
      id: secuencia,
      cfg: cfg,
      paso: 'datos',
      datos: datos,
      tecla: cfg.sugerido ? cfg.sugerido.toFixed(2).replace('.', ',') : '',
      resultado: null,
      errorEn: 'datos'
    };
    raiz.classList.add('open');
    raiz.scrollTop = 0;
    render();
  }

  /* ---------- Definiciones de flujo ---------- */

  // Factura determinista a partir del valor ingresado (misma cuenta siempre da la misma factura)
  function generarFactura(valorId) {
    var seed = 7;
    for (var i = 0; i < valorId.length; i++) seed = (seed * 31 + valorId.charCodeAt(i)) >>> 0;
    var rand = function () { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 0xffffff; };
    var TITULARES = ['Juan Carlos Pazmiño', 'María Fernanda López', 'Andrés Santacruz', 'Ana Belén Vélez', 'Diego Ramírez'];
    return {
      holder: TITULARES[Math.floor(rand() * TITULARES.length)],
      period: 'Consumo de mayo 2026',
      amount: 8 + rand() * 55, // tope bajo: siempre cubierto por las cuentas de origen
      dueDate: String(5 + Math.floor(rand() * 20)).padStart(2, '0') + ' jun 2026'
    };
  }

  // Transferir: a un beneficiario guardado, a una cuenta nueva o por número de celular
  function transferencia(o) {
    var b = o.beneficiario;
    var celular = !!o.porCelular;
    var nuevo = !b && !celular;
    var campoDestino = celular
      ? { id: 'celular', etiqueta: 'Número de celular', tipo: 'tel', inputmode: 'numeric', placeholder: 'Ej. 099 123 4567', ayuda: 'La persona debe tener Pichibank', minimo: 9,
          validar: function (v) { return /^[\d\s]+$/.test(v) ? '' : 'Usa solo números'; } }
      : { id: 'cuenta', etiqueta: 'Número de cuenta', tipo: 'tel', inputmode: 'numeric', placeholder: 'Ej. 2201234567', ayuda: 'Cuenta de ahorros o corriente de cualquier banco', minimo: 6 };
    var destinoDe = function (d) { return celular ? d.campos.celular : d.campos.cuenta; };
    return {
      titulo: celular ? 'Transferir por celular' : 'Transferir',
      cuentas: o.cuentas,
      alListo: o.alListo,
      campos: b ? [] : (celular || nuevo) ? [
        { id: 'titular', etiqueta: 'Nombre del titular', placeholder: 'Ej. María José Pérez', minimo: 3 },
        campoDestino
      ] : [],
      origen: true,
      monto: true,
      resumen: function (d) {
        if (b) return [['Para', b.name], ['Cuenta', '******' + ultimos(b.acct)]];
        return [['Para', d.campos.titular], [celular ? 'Celular' : 'Cuenta', '******' + ultimos(destinoDe(d))]];
      },
      ejecutar: function (d) {
        if ((b ? ultimos(b.acct) : ultimos(destinoDe(d))) === '0000') {
          throw new Error(celular
            ? 'Ese celular no tiene una cuenta Pichibank. Pide que se registre e intenta de nuevo.'
            : 'La cuenta de destino no existe o está inactiva. Revisa el número e intenta de nuevo.');
        }
        return { ref: referencia() };
      },
      errorTitulo: 'No se pudo transferir',
      exito: { titulo: '¡Transferencia exitosa!', lineas: function (d) { return ['Enviado a ' + (b ? b.name : d.campos.titular)]; } }
    };
  }

  function servicio(o) {
    var biller = o.biller;
    var tipo = function (d) { return biller.idTypes[Number(d.campos.tipo) || 0]; };
    return {
      titulo: biller.name,
      cuentas: o.cuentas,
      alListo: o.alListo,
      campos: [
        { id: 'tipo', etiqueta: 'Tipo de identificación', valor: '0', opciones: biller.idTypes.map(function (t, i) { return { value: String(i), label: t.label }; }) },
        { id: 'valor', etiqueta: function (d) { return tipo(d).label; }, placeholder: function (d) { return tipo(d).placeholder; }, ayuda: function (d) { return tipo(d).hint; }, minimo: 4 }
      ],
      origen: true,
      continuar: 'Consultar',
      consulta: function (d) {
        var id = d.campos.valor.trim();
        if (/^0+$/.test(id)) throw new Error('No encontramos una factura con ' + tipo(d).label.toLowerCase() + ' ' + id + '. Revisa el dato e intenta de nuevo.');
        var f = generarFactura(id);
        return { monto: f.amount, filas: [['Titular', f.holder], ['Concepto', f.period], ['Fecha límite', f.dueDate]] };
      },
      resumen: function (d) { return [['Servicio', biller.name], [tipo(d).label, d.campos.valor]]; },
      ejecutar: function () { return { ref: referencia() }; },
      errorTitulo: 'No encontramos tu factura',
      exito: { titulo: '¡Pago realizado!', lineas: ['Pagado a ' + biller.name] }
    };
  }

  function recarga(o) {
    return {
      titulo: 'Recarga ' + o.operador,
      cuentas: o.cuentas,
      alListo: o.alListo,
      campos: [{
        id: 'celular', etiqueta: 'Número de celular', tipo: 'tel', inputmode: 'numeric', placeholder: 'Ej. 099 123 4567',
        ayuda: 'Tu número, o el de alguien más', minimo: 9,
        validar: function (v) { return /^[\d\s]+$/.test(v) ? '' : 'Usa solo números'; }
      }],
      origen: true,
      monto: true,
      sugerido: 5,
      montoChips: RECARGA_MONTOS,
      resumen: function (d) { return [['Operador', o.operador], ['Celular', d.campos.celular]]; },
      ejecutar: function (d) {
        if (ultimos(d.campos.celular) === '0000') throw new Error('Esta línea no acepta recargas. Revisa el número e intenta de nuevo.');
        return { ref: referencia() };
      },
      errorTitulo: 'No se pudo recargar',
      exito: { titulo: '¡Recarga exitosa!', lineas: function (d) { return ['Recargaste ' + o.operador + ' a ' + d.campos.celular]; } }
    };
  }

  function tarjeta(o) {
    var t = o.tarjeta;
    return {
      titulo: 'Pagar tarjeta',
      cuentas: o.cuentas,
      alListo: o.alListo,
      origen: true,
      monto: true,
      sugerido: t.saldo,
      resumen: function () { return [['Tarjeta', t.nombre], ['Institución', t.institucion]]; },
      ejecutar: function () { return { ref: referencia() }; },
      errorTitulo: 'No se pudo pagar la tarjeta',
      exito: { titulo: '¡Pago de tarjeta exitoso!', lineas: ['Pagaste tu ' + t.nombre] }
    };
  }

  function retiro(o) {
    return {
      titulo: 'Retiro sin tarjeta',
      cuentas: o.cuentas,
      alListo: o.alListo,
      origen: true,
      monto: true,
      montoChips: RETIRO_MONTOS,
      continuar: 'Continuar',
      resumen: function () { return [['Punto de retiro', o.punto]]; },
      ejecutar: function () { return { ref: referencia(), codigo: codigoRetiro() }; },
      errorTitulo: 'No se pudo generar tu código',
      exito: { titulo: '¡Listo para retirar!', lineas: ['Muestra este código en ' + o.punto + '.', 'Válido por 15 minutos.'] }
    };
  }

  // Pagar con QR: o.codigo llega sólo desde el código único; "000000" simula uno vencido
  function qr(o) {
    return {
      titulo: 'Pagar con QR',
      cuentas: o.cuentas,
      alListo: o.alListo,
      origen: true,
      monto: true,
      resumen: function () { return [['Comercio', o.comercio]]; },
      ejecutar: function () {
        if (o.codigo === '000000') throw new Error('Este código ya no es válido o expiró. Pide uno nuevo al comercio.');
        return { ref: referencia() };
      },
      errorTitulo: 'No se pudo pagar',
      exito: { titulo: '¡Pago realizado!', lineas: ['Pagado a ' + o.comercio] }
    };
  }

  window.Flujos = {
    abrir: abrir,
    precargar: precargar,
    cerrar: cerrar,
    dinero: dinero,
    transferencia: transferencia,
    servicio: servicio,
    recarga: recarga,
    tarjeta: tarjeta,
    retiro: retiro,
    qr: qr,
    RECARGA_MONTOS: RECARGA_MONTOS,
    RETIRO_MONTOS: RETIRO_MONTOS
  };
})();
