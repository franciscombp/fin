/* =====================================================================
   Hubs de productos (Inicio: Cuentas, Tarjetas, Préstamos, Inversiones,
   Seguros; y Modo finanzas). Se dibujan desde la base de datos de la
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
  var money = function (v) { return '$ ' + Number(Math.abs(v || 0)).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var ultimos = function (t) { var m = /(\d{4})\b/.exec(t || ''); return m ? '******' + m[1] : ''; };
  var suma = function (xs) { return xs.reduce(function (t, x) { return t + Number(x.saldo || 0); }, 0); };

  // Fila de producto: avatar con ícono, nombre, detalle, número enmascarado y monto
  function fila(p) {
    return '<button class="product-row" data-action="' + esc(p.nombre) + '">' +
      '<span class="avatar-lg"><span class="material-symbols-rounded">' + esc(p.ic || 'account_balance') + '</span></span>' +
      '<span class="product-row__info"><span class="product-row__name">' + esc(p.nombre) + '</span>' +
      (p.sub ? '<span class="product-row__sub">' + esc(p.sub) + '</span>' : '') +
      (p.masked ? '<span class="product-row__masked">' + esc(p.masked) + '</span>' : '') + '</span>' +
      '<span class="product-row__right">' + (p.label ? '<span class="product-row__label">' + esc(p.label) + '</span>' : '') +
      '<span class="product-row__amount">' + esc(p.monto) + '</span></span></button>';
  }
  // Placeholder de un grupo sin productos: dice qué falta y ofrece hablar con Uku
  function placeholder(g) {
    return '<div class="prod-ph"><p><b>' + esc(g.ph.t) + '</b>' + esc(g.ph.s) + '</p>' +
      '<button class="btn btn--tertiary prod-go" type="button">Hablar con Uku</button></div>';
  }
  // Hero de un hub vacío: ícono, título, texto y la acción principal
  function hero(h) {
    return '<div class="prod-hero"><span class="prod-hero__ic material-symbols-rounded" aria-hidden="true">' + esc(h.ic) + '</span>' +
      '<b class="prod-hero__t">' + esc(h.t) + '</b><p class="prod-hero__s">' + esc(h.s) + '</p>' +
      '<button class="btn btn--primary prod-go" type="button">Hablar con Uku</button></div>';
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
  function pintarHub(el, data) {
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
          return { nombre: c.nombre, sub: 'Pichibank', masked: ultimos(c.fuente) || ('******' + c.numero), monto: money(c.saldo), ic: 'account_balance' };
        });
        var metas = cs.filter(function (c) { return c.tipo === 'meta'; }).map(function (c) {
          return { nombre: c.nombre, sub: 'Meta: ' + money(c.meta), monto: money(c.saldo), label: 'Llevas', ic: 'savings' };
        });
        return { grupos: [
            { titulo: 'Cuentas', filas: cuentas, ph: { t: 'Aún no tienes cuentas. ', s: 'Abre una cuenta de ahorro para empezar.' } },
            { titulo: 'Metas', filas: metas, ph: { t: 'Aún no tienes metas. ', s: 'Ponle nombre a lo que quieres lograr y Uku te acompaña.' } }],
          total: { l: 'Saldo disponible total', v: suma(cs.filter(function (c) { return c.tipo === 'transaccional' || c.tipo === 'ahorro'; })), tras: 0 },
          hero: { ic: 'account_balance', t: 'Tu dinero empieza aquí', s: 'Todavía no tienes cuentas en Pichibank. Uku te ayuda a abrir la primera.' } };
      });
    },
    Metas: function (id) {
      return Persona.cuentas(id).then(function (cs) {
        var metas = cs.filter(function (c) { return c.tipo === 'meta'; }).map(function (c) {
          return { nombre: c.nombre, sub: 'Meta: ' + money(c.meta), monto: money(c.saldo), label: 'Llevas', ic: 'savings' };
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
        var fila3 = function (d) { return { nombre: d.producto, sub: d.institucion, masked: ultimos(d.producto), monto: money(d.saldo), label: 'Saldo a pagar', ic: 'credit_card' }; };
        // Débito: la cuenta transaccional, con su titular y los últimos dígitos
        var trans = cs.filter(function (c) { return c.tipo === 'transaccional'; })[0];
        var debito = trans ? [{ nombre: 'Débito Pichibank', sub: 'Titular: ' + (persona ? persona.nombre : ''), masked: '******' + trans.numero, monto: money(trans.saldo), label: 'Disponible', ic: 'account_balance_wallet' }] : [];
        var creditos = tj.filter(mvp);
        return { grupos: [
            { titulo: 'Débito', filas: debito },
            { titulo: 'Pichibank', filas: creditos.map(fila3) },
            { titulo: 'Otros bancos y tiendas', filas: tj.filter(function (d) { return !mvp(d); }).map(fila3) }],
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
            { titulo: 'Préstamos', filas: pre.map(fila2) },
            { titulo: 'Por cobrar', filas: cob.map(function (d) { return { nombre: d.producto, sub: d.institucion, monto: money(d.saldo), label: 'Te deben', ic: ICO.cobrar }; }) }],
          total: { l: 'Saldo pendiente', v: suma(hip.concat(pre)), tras: 1 },
          hero: { ic: 'payments', t: 'Sin préstamos', s: 'Si necesitas dinero, Uku te muestra opciones según tu perfil.' } };
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
    // Patrimonio neto de Modo finanzas: lo que tienes menos lo que debes (incluye lo que te deben)
    var nw = document.querySelector('.finance-networth strong');
    if (nw) Promise.all([Persona.cuentas(id), Persona.deudas(id)]).then(function (r) {
      var activos = suma(r[0]);
      var cobrar = r[1].filter(function (d) { return d.clase === 'cobrar'; }).reduce(function (t, d) { return t + Math.abs(d.saldo); }, 0);
      var deuda = suma(r[1].filter(function (d) { return d.clase !== 'cobrar'; }));
      var v = activos + cobrar - deuda;
      if (Persona.get() === id) nw.textContent = (v < 0 ? '-' : '') + money(v);
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
