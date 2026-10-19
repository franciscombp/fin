/* =====================================================================
   Hubs de productos (Inicio: Cuentas, Tarjetas, Préstamos, Inversiones,
   Seguros). Se dibujan desde la base de datos de la persona activa
   (Persona.cuentas / Persona.deudas) y se vuelven a dibujar al cambiarla.
   Cada fila conserva data-action con el nombre del producto: buscador,
   destacados y asistente ya leen esas filas.
   ===================================================================== */
(function () {
  'use strict';

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (v) { return '$ ' + Number(Math.abs(v || 0)).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var ultimos = function (t) { var m = /(\d{4})\b/.exec(t || ''); return m ? '******' + m[1] : ''; };

  // Mismo diseño de fila que antes: avatar con ícono, nombre, detalle, número enmascarado y monto
  function fila(p) {
    return '<button class="product-row" data-action="' + esc(p.nombre) + '">' +
      '<span class="avatar-lg"><span class="material-symbols-rounded">' + esc(p.ic || 'account_balance') + '</span></span>' +
      '<span class="product-row__info"><span class="product-row__name">' + esc(p.nombre) + '</span>' +
      (p.sub ? '<span class="product-row__sub">' + esc(p.sub) + '</span>' : '') +
      (p.masked ? '<span class="product-row__masked">' + esc(p.masked) + '</span>' : '') + '</span>' +
      '<span class="product-row__right">' + (p.label ? '<span class="product-row__label">' + esc(p.label) + '</span>' : '') +
      '<span class="product-row__amount">' + esc(p.monto) + '</span></span></button>';
  }
  // Dentro de la tarjeta del hub: los grupos van uno debajo del otro; el título sólo a partir del segundo
  function grupos(lista) {
    var con = lista.filter(function (g) { return g.filas.length; });
    return con.map(function (g, i) {
      return (i && g.titulo ? '<p class="prod-hub__t">' + esc(g.titulo) + '</p>' : '') + g.filas.map(fila).join('');
    }).join('');
  }
  function vacio(texto) { return '<div class="card prod-empty"><p>' + esc(texto) + '</p></div>'; }

  // Cada hub: qué filas muestra para la persona activa
  var HUBS = {
    Cuentas: function (id) {
      return Persona.cuentas(id).then(function (cs) {
        var vistas = cs.filter(function (c) { return c.tipo !== 'inversion'; });
        var cuentas = vistas.filter(function (c) { return c.tipo === 'transaccional' || c.tipo === 'ahorro'; }).map(function (c) {
          return { nombre: c.nombre, sub: 'Pichibank', masked: ultimos(c.fuente) || ('******' + c.numero), monto: money(c.saldo), ic: 'account_balance' };
        });
        var metas = vistas.filter(function (c) { return c.tipo === 'meta'; }).map(function (c) {
          return { nombre: c.nombre, sub: 'Meta: ' + money(c.meta), monto: money(c.saldo), label: 'Llevas', ic: 'savings' };
        });
        return grupos([{ titulo: 'Cuentas', filas: cuentas }, { titulo: 'Metas', filas: metas }]) || vacio('Todavía no tienes cuentas en Pichibank.');
      });
    },
    Tarjetas: function (id) {
      return Persona.deudas(id).then(function (ds) {
        var tj = ds.filter(function (d) { return d.clase === 'tarjeta'; });
        var mvp = function (d) { return String(d.en_mvp).indexOf('Sí') === 0; };
        var pich = tj.filter(mvp).map(function (d) { return { nombre: d.producto, sub: d.institucion, masked: ultimos(d.producto), monto: money(d.saldo), label: 'Saldo a pagar', ic: 'credit_card' }; });
        var otras = tj.filter(function (d) { return !mvp(d); }).map(function (d) { return { nombre: d.producto, sub: d.institucion, masked: ultimos(d.producto), monto: money(d.saldo), label: 'Saldo a pagar', ic: 'credit_card' }; });
        return grupos([{ titulo: 'Pichibank', filas: pich }, { titulo: 'Otros bancos y tiendas', filas: otras }]) || vacio('No tienes tarjetas registradas.');
      });
    },
    Prestamos: function (id) {
      return Persona.deudas(id).then(function (ds) {
        var ICO = { hipoteca: 'home', prestamo: 'payments', cobrar: 'handshake' };
        var fila2 = function (d) { return { nombre: d.producto, sub: d.institucion, monto: money(d.saldo), label: 'Saldo', ic: ICO[d.clase] }; };
        var hip = ds.filter(function (d) { return d.clase === 'hipoteca'; }).map(fila2);
        var pre = ds.filter(function (d) { return d.clase === 'prestamo'; }).map(fila2);
        var cob = ds.filter(function (d) { return d.clase === 'cobrar'; }).map(function (d) { return { nombre: d.producto, sub: d.institucion, monto: money(d.saldo), label: 'Te deben', ic: ICO.cobrar }; });
        return grupos([{ titulo: 'Hipotecas', filas: hip }, { titulo: 'Préstamos', filas: pre }, { titulo: 'Por cobrar', filas: cob }]) || vacio('No tienes préstamos registrados.');
      });
    },
    Metas: function (id) {
      return Persona.cuentas(id).then(function (cs) {
        var metas = cs.filter(function (c) { return c.tipo === 'meta'; }).map(function (c) {
          return { nombre: c.nombre, sub: 'Meta: ' + money(c.meta), monto: money(c.saldo), label: 'Llevas', ic: 'savings' };
        });
        return grupos([{ titulo: 'Metas de ahorro', filas: metas }]) || vacio('Todavía no tienes metas de ahorro.');
      });
    },
    Inversiones: function (id) {
      return Persona.cuentas(id).then(function (cs) {
        var inv = cs.filter(function (c) { return c.tipo === 'inversion'; }).map(function (c) {
          return { nombre: c.nombre, sub: 'Pichibank', masked: ultimos(c.fuente) || ('******' + c.numero), monto: money(c.saldo), ic: 'trending_up' };
        });
        return grupos([{ titulo: 'Depósitos', filas: inv }]) || vacio('No tienes inversiones registradas.');
      });
    },
    // Pichibank no tiene seguros en la base de datos de demostración: el hub lo dice en vez de mostrar otros
    Seguros: function () { return Promise.resolve(vacio('No tienes seguros con Pichibank. Si tienes uno con otra aseguradora, lo puedes registrar con Uku.')); }
  };

  function pintar() {
    var id = Persona.get();
    document.querySelectorAll('.prod-hub').forEach(function (el) {
      var f = HUBS[el.dataset.hub]; if (!f) return;
      f(id).then(function (html) { if (Persona.get() === id) el.innerHTML = html; });
    });
    // Los totales de cada hub (pie de tarjeta) suman las mismas filas que se ven
    var cuentasP = Persona.cuentas(id), deudasP = Persona.deudas(id);
    Promise.all([cuentasP, deudasP]).then(function (r) {
      var suma = function (xs) { return xs.reduce(function (t, x) { return t + Number(x.saldo || 0); }, 0); };
      var total = {
        Cuentas: suma(r[0].filter(function (c) { return c.tipo === 'transaccional' || c.tipo === 'ahorro'; })),
        Prestamos: suma(r[1].filter(function (d) { return d.clase === 'hipoteca' || d.clase === 'prestamo'; })),
        Inversiones: suma(r[0].filter(function (c) { return c.tipo === 'inversion'; }))
      };
      document.querySelectorAll('.tab-panel[data-panel]').forEach(function (p) {
        var v = p.querySelector('.card__footer-value'); if (!v || total[p.dataset.panel] == null) return;
        if (Persona.get() === id) v.textContent = money(total[p.dataset.panel]);
      });
    });
    // Patrimonio neto de Modo finanzas: lo que tienes menos lo que debes (incluye lo que te deben)
    var nw = document.querySelector('.finance-networth strong');
    if (nw) Promise.all([Persona.cuentas(id), Persona.deudas(id)]).then(function (r) {
      var activos = r[0].reduce(function (t, c) { return t + Number(c.saldo || 0); }, 0);
      var cobrar = r[1].filter(function (d) { return d.clase === 'cobrar'; }).reduce(function (t, d) { return t + Math.abs(d.saldo); }, 0);
      var deuda = r[1].filter(function (d) { return d.clase !== 'cobrar'; }).reduce(function (t, d) { return t + Number(d.saldo || 0); }, 0);
      var v = activos + cobrar - deuda;
      if (Persona.get() === id) nw.textContent = (v < 0 ? '-' : '') + money(v);
    });
    document.dispatchEvent(new CustomEvent('productos:change', { detail: id }));
  }

  document.addEventListener('persona:change', pintar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintar); else pintar();
  window.Productos = { pintar: pintar };
})();
