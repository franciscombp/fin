/* =====================================================================
   Hubs de productos (Inicio: Cuentas, Tarjetas, Préstamos, Inversiones,
   Seguros). Se dibujan desde la base de datos de la
   persona activa y se vuelven a dibujar al cambiarla.
   - Cada grupo (Cuentas, Metas, Pichibank…) es su propio contenedor.
   - Si un grupo está vacío y lo marca como "ph", muestra un placeholder.
   - Si el hub entero está vacío, muestra un hero con su llamada a la acción.
   Cada fila conserva data-action con el nombre del producto: buscador,
   destacados y asistente ya leen esas filas.
   ===================================================================== */
(function () {
  'use strict';

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (v) { return '$\u00a0' + Number(Math.abs(v || 0)).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var ultimos = function (t) { var m = /(\d{4})\b/.exec(t || ''); return m ? '******' + m[1] : ''; };
  var suma = function (xs) { return xs.reduce(function (t, x) { return t + Number(x.saldo || 0); }, 0); };

  // Fila de producto: avatar con ícono, nombre, detalle, número enmascarado y monto
  function fila(p) {
    // Tarjetas Pichibank: su arte real y los datos que abren el detalle de tarjeta (assets/tarjetas.js)
    var tj = p.tarjeta && window.Tarjetas;
    return '<button class="product-row" data-action="' + esc(p.nombre) + '"' +
      (tj ? ' data-tarjeta="' + p.tarjeta + '" data-saldo="' + (p.saldoNum || 0) + '" data-ultimos="' + esc(p.ultimos || '') + '"' : '') + '>' +
      (tj ? Tarjetas.mini(p.tarjeta) : p.thumb
        ? '<span class="card-thumb card-thumb--' + esc(p.thumb) + '" aria-hidden="true"><span class="card-thumb__brand" translate="no">' + (p.marca ? esc(p.marca) : 'PICHI<br>BANK') + '</span></span>'
        : '<span class="avatar-lg"><span class="material-symbols-rounded">' + esc(p.ic || 'account_balance') + '</span></span>') +
      '<span class="product-row__info"><span class="product-row__name">' + esc(p.nombre) + '</span>' +
      (p.sub ? '<span class="product-row__sub">' + esc(p.sub) + '</span>' : '') +
      (p.masked ? '<span class="product-row__masked">' + esc(p.masked) + '</span>' : '') + '</span>' +
      '<span class="product-row__right">' + (p.label ? '<span class="product-row__label">' + esc(p.label) + '</span>' : '') +
      '<span class="product-row__amount">' + esc(p.monto) + '</span></span></button>';
  }
  // Un grupo sin productos: la misma tarjeta con acción que las promos del hub (ícono, qué hacer, por qué
  // y chevron); lleva a Uku
  function placeholder(g) {
    return '<button class="cta-dashed prod-go" type="button"><span class="avatar-lg"><span class="material-symbols-rounded">' + esc(g.ph.ic || 'add') + '</span></span>' +
      '<span class="cta-dashed__text">' + esc(g.ph.s) + '<span class="cta-dashed__link">' + esc(g.ph.t) + '</span></span></button>';
  }
  // Un hub vacío: tarjeta con ícono, título, texto y su acción. Si el hub tiene acción propia (h.accion), es la
  // acción principal del banco (amarilla); si no, «Hablar con Uku» lleva al asistente.
  function hero(h) {
    var boton = h.accion
      ? '<button class="btn btn--primary" type="button" data-action="' + esc(h.accion) + '">' + esc(h.cta) + '</button>'
      : '<button class="bp-button bp-button--secondary prod-go" type="button">' + esc(h.cta || 'Hablar con Uku') + '</button>';
    return '<div class="prod-hero prod-hero--vacio">' +
      '<div class="prod-hero__top"><span class="prod-hero__ilustra" aria-hidden="true"><span class="material-symbols-rounded">' + esc(h.ic) + '</span></span>' +
      '<span><b class="prod-hero__t">' + esc(h.t) + '</b><p class="prod-hero__s">' + esc(h.s) + '</p></span></div>' + boton + '</div>';
  }
  // Un bloque por grupo. El primer grupo no lleva título si el hub ya lo tiene (data-sin-titulo)
  // El total va justo después del grupo que suma (total.tras)
  function bloques(grupos, sinTitulo, total) {
    var out = '';
    grupos.forEach(function (g, i) {
      if (g.filas.length || g.ph) {
        var titulo = g.titulo && !(i === 0 && sinTitulo) ? '<div class="section__title"><h2>' + esc(g.titulo) + '</h2></div>' : '';
        out += '<div class="prod-group">' + titulo +
          (g.filas.length ? '<div class="card">' + g.filas.map(fila).join('') + '</div>' : placeholder(g)) + '</div>';
      }
      if (total && total.tras === i) out += '<div class="card prod-total"><span>' + esc(total.l) + '</span><b>' + esc(money(total.v)) + '</b></div>';
    });
    return out;
  }
  // Cada producto de la persona tiene su página: se registra con los datos de su fila
  function registrarDetalle(data) {
    if (!window.ProductView || !ProductView.registrar) return;
    data.grupos.forEach(function (g) {
      g.filas.forEach(function (f) {
        // sub es la institución, salvo en filas que muestran titular o meta
        var dato = /^(Titular|Meta): (.+)$/.exec(f.sub || '');
        var rows = dato ? [['Institución', 'Pichibank'], [dato[1], dato[2]]] : [['Institución', f.sub || 'Pichibank']];
        if (f.masked) rows.push(['Número', f.masked]);
        var fila = { kind: f.nombre, label: f.label || 'Saldo', value: f.monto || '', sub: f.sub || '', acts: [], rows: rows, list: [], listTitle: '' };
        // Cuentas y metas se dibujan con su propio diseño (assets/producto.js)
        if (f.tipo) { fila.cuenta = true; fila.tipo = f.tipo; fila.saldoNum = f.saldoNum; fila.meta = f.metaNum; fila.numero = f.numero || ''; }
        ProductView.registrar(f.nombre, fila);
      });
    });
  }

  function pintarHub(el, data) {
    registrarDetalle(data);
    // Sin ningún producto en el hub: hero. Con productos, los grupos vacíos muestran su placeholder
    var con = data.grupos.some(function (g) { return g.filas.length; });
    el.innerHTML = con ? bloques(data.grupos, el.hasAttribute('data-sin-titulo'), data.total) : hero(data.hero);
    // Placeholders de la pantalla de Tarjetas (débito y crédito) según lo que tiene la persona
    if (el.dataset.hub === 'Tarjetas') {
      var ph = function (k, oculto) { var n = document.querySelector('[data-ph="' + k + '"]'); if (n) n.hidden = oculto; };
      ph('debito', !!data.sinDebito === false);
      ph('credito', !!data.sinCredito === false);
    }
  }

  // Cada hub: sus grupos, su total y su hero para la persona activa
  var HUBS = {
    Cuentas: function (id) {
      return Persona.cuentas(id).then(function (cs) {
        var cuentas = cs.filter(function (c) { return c.tipo === 'transaccional' || c.tipo === 'ahorro'; }).map(function (c) {
          return { nombre: c.nombre, sub: 'Pichibank', masked: ultimos(c.fuente) || ('******' + c.numero), monto: money(c.saldo), ic: 'account_balance',
            tipo: c.tipo, saldoNum: c.saldo, numero: c.numero };
        });
        var metas = cs.filter(function (c) { return c.tipo === 'meta'; }).map(function (c) {
          return { nombre: c.nombre, sub: 'Meta: ' + money(c.meta), monto: money(c.saldo), label: 'Llevas', ic: 'savings',
            tipo: 'meta', saldoNum: c.saldo, metaNum: c.meta };
        });
        return { grupos: [
            { titulo: 'Cuentas', filas: cuentas, ph: { ic: 'account_balance', t: 'Abre tu primera cuenta', s: 'Una cuenta de ahorro para empezar. Uku te guía.' } },
            { titulo: 'Metas', filas: metas, ph: { ic: 'flag', t: 'Crea tu primera meta', s: 'Ponle nombre a lo que quieres lograr y Uku te acompaña.' } }],
          total: { l: 'Saldo disponible total', v: suma(cs.filter(function (c) { return c.tipo === 'transaccional' || c.tipo === 'ahorro'; })), tras: 0 },
          hero: { ic: 'account_balance', t: 'Tu dinero empieza aquí', s: 'Todavía no tienes cuentas en Pichibank. Uku te ayuda a abrir la primera.' } };
      });
    },
    Metas: function (id) {
      return Persona.cuentas(id).then(function (cs) {
        var metas = cs.filter(function (c) { return c.tipo === 'meta'; }).map(function (c) {
          return { nombre: c.nombre, sub: 'Meta: ' + money(c.meta), monto: money(c.saldo), label: 'Llevas', ic: 'savings',
            tipo: 'meta', saldoNum: c.saldo, metaNum: c.meta };
        });
        return { grupos: [{ titulo: 'Metas', filas: metas }],
          hero: { ic: 'savings', t: 'Sin metas todavía', s: 'Una meta de ahorro te muestra cuánto te falta. Uku te ayuda a ponerla.' } };
      });
    },
    Tarjetas: function (id) {
      return Promise.all([Persona.deudas(id), Persona.cuentas(id), Persona.persona(id)]).then(function (r) {
        var ds = r[0], cs = r[1], persona = r[2];
        var tj = ds.filter(function (d) { return d.clase === 'tarjeta'; });
        var mvp = function (d) { return String(d.en_mvp).indexOf('Sí') === 0; };
        // El nombre ya trae los últimos dígitos («Mastercard ···5520»): no se repiten debajo
        var fila3 = function (d) { return { nombre: d.producto, sub: d.institucion, masked: /···/.test(d.producto) ? '' : ultimos(d.producto), monto: money(d.saldo), label: 'Saldo a pagar', ic: 'credit_card', thumb: 'black' }; };
        // Crédito Pichibank: Mastercard es la Black; Visa, la Visa Crédito
        var credito = function (d) { var f = fila3(d); f.tarjeta = window.Tarjetas ? Tarjetas.tipo(d.producto) : ''; f.saldoNum = d.saldo; f.ultimos = (/(\d{4})\b/.exec(d.producto) || [])[1] || ''; return f; };
        // En la tarjeta de otro banco va su marca, no la de Pichibank
        var marca = function (inst) { return String(inst || '').replace(/^Banco\s+/i, '').split(/\s+/).slice(0, 2).join(' ').toUpperCase(); };
        // Débito: la cuenta transaccional, con su titular y los últimos dígitos
        var trans = cs.filter(function (c) { return c.tipo === 'transaccional'; })[0];
        var debito = trans ? [{ nombre: 'Débito Digital', sub: 'Titular: ' + (persona ? persona.nombre : ''), masked: '******' + trans.numero, monto: money(trans.saldo), label: 'Disponible', ic: 'account_balance_wallet', thumb: 'visa', tarjeta: 'debito', ultimos: String(trans.numero).slice(-4) }] : [];
        var creditos = tj.filter(mvp);
        return { grupos: [
            { titulo: 'Débito', filas: debito },
            { titulo: 'Pichibank', filas: creditos.map(credito) },
            { titulo: 'Otros bancos y tiendas', filas: tj.filter(function (d) { return !mvp(d); }).map(function (d) { var f = fila3(d); f.thumb = 'diners'; f.marca = marca(d.institucion); return f; }) }],
          // Los placeholders de débito y crédito de la pantalla solo aparecen si no hay ese producto
          sinDebito: !debito.length, sinCredito: !creditos.length,
          hero: { ic: 'credit_card', t: 'Aún no tienes tarjetas', s: 'Pide una tarjeta Pichibank o registra una de otro banco con Uku.' } };
      });
    },
    Prestamos: function (id) {
      return Persona.deudas(id).then(function (ds) {
        var ICO = { hipoteca: 'home', prestamo: 'payments', cobrar: 'handshake' };
        var fila2 = function (d) { return { nombre: d.producto, sub: d.institucion, monto: money(d.saldo), label: 'Saldo', ic: ICO[d.clase] }; };
        var hip = ds.filter(function (d) { return d.clase === 'hipoteca'; });
        var pre = ds.filter(function (d) { return d.clase === 'prestamo'; });
        var cob = ds.filter(function (d) { return d.clase === 'cobrar'; });
        return { grupos: [
            { titulo: 'Hipotecas', filas: hip.map(fila2) },
            { titulo: 'Personales', filas: pre.map(fila2) },
            { titulo: 'Por cobrar', filas: cob.map(function (d) { return { nombre: d.producto, sub: d.institucion, monto: money(d.saldo), label: 'Te deben', ic: ICO.cobrar }; }) }],
          total: { l: 'Saldo pendiente', v: suma(hip.concat(pre)), tras: 1 },
          hero: { ic: 'payments', t: 'El impulso que tus sueños necesitan', s: 'Si necesitas dinero, Uku te muestra opciones según tu perfil.', cta: 'Solicitar préstamo', accion: 'Solicitar préstamo' } };
      });
    },
    Inversiones: function (id) {
      return Persona.cuentas(id).then(function (cs) {
        var inv = cs.filter(function (c) { return c.tipo === 'inversion'; });
        return { grupos: [{ titulo: 'Depósitos', filas: inv.map(function (c) {
            return { nombre: c.nombre, sub: 'Pichibank', masked: ultimos(c.fuente) || ('******' + c.numero), monto: money(c.saldo), ic: 'trending_up' };
          }) }],
          total: { l: 'Total invertido', v: suma(inv), tras: 0 },
          hero: { ic: 'trending_up', t: 'Haz crecer tu dinero', s: 'Un depósito a plazo te deja ahorrar con interés. Uku te explica cómo.' } };
      });
    },
    // Pichibank no tiene seguros en la base de datos de demostración
    Seguros: function () {
      return Promise.resolve({ grupos: [], hero: { ic: 'shield', t: 'Protege lo tuyo', s: 'Aún no tienes seguros con Pichibank. Uku te explica las opciones.' } });
    }
  };

  // Un hub por vez: si cambia la persona antes de que llegue, no se pinta
  function pintar() {
    var id = Persona.get();
    document.querySelectorAll('.prod-hub').forEach(function (el) {
      var f = HUBS[el.dataset.hub]; if (!f) return;
      f(id).then(function (data) { if (Persona.get() === id) pintarHub(el, data); });
    });
    document.dispatchEvent(new CustomEvent('productos:change', { detail: id }));
  }

  // Los placeholders llevan a Uku (la pantalla de Asistente)
  document.addEventListener('click', function (e) {
    if (e.target.closest('.prod-go') && window.__goView) window.__goView(1);
  });

  document.addEventListener('persona:change', pintar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintar); else pintar();
  window.Productos = { pintar: pintar };
})();
