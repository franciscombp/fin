/* Herramienta «finanzas» del orquestador: lo que la habilidad necesita saber de la persona, leído de la
   fuente de datos (hoy assets/pfm/datos.json; en producción, las APIs del banco). No decide nada: solo
   cuenta. Corre igual en el worker del navegador y en Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.OrqFinanzas = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function r2(v) { return Math.round(v * 100) / 100; }
  function mesesAntes(hoy, n) { // los n meses completos antes del de hoy, como 'aaaa-mm'
    var a = +hoy.slice(0, 4), m = +hoy.slice(5, 7), out = [];
    for (var i = 1; i <= n; i++) { var mm = m - i, aa = a; while (mm < 1) { mm += 12; aa--; } out.push(aa + '-' + (mm < 10 ? '0' : '') + mm); }
    return out;
  }
  return function crear(datos) {
    var D = datos.dic, C = datos.campos, I = {}; C.forEach(function (c, i) { I[c] = i; });
    var GASTO = ['Gasto', 'Por revisar', 'Detalle Deuna'];
    function usuario(id) { return (datos.usuarios || []).filter(function (u) { return u.usuario === id; })[0] || null; }
    function cuentas(id) { return (datos.cuentas && datos.cuentas[id]) || []; }
    function porMes(id) {
      var by = {};
      ((datos.movimientos && datos.movimientos[id]) || []).forEach(function (r) {
        var mes = r[I.fecha].slice(0, 7), t = D.tratamiento[r[I.tratamiento]], m = r[I.monto], o = by[mes] || (by[mes] = { ing: 0, gast: 0 });
        if (t === 'Ingreso' && m > 0) o.ing += m;
        if (GASTO.indexOf(t) >= 0 && m < 0) o.gast -= m;
      });
      return by;
    }
    return {
      hoy: function () { return datos.hoy; },
      // Lo que tienes y cómo te mueves al mes (promedio de los últimos tres meses completos)
      resumen: function (id) {
        var u = usuario(id), cs = cuentas(id), by = porMes(id), ms = mesesAntes(datos.hoy, 3).filter(function (m) { return by[m]; });
        var prom = function (k) { return ms.length ? r2(ms.reduce(function (s, m) { return s + by[m][k]; }, 0) / ms.length) : 0; };
        var suma = function (t) { return r2(cs.filter(function (c) { return c.tipo === t; }).reduce(function (s, c) { return s + (+c.saldo || 0); }, 0)); };
        var ing = prom('ing'), gast = prom('gast');
        return {
          usuario: id, nombre: u ? u.nombre.split(' ')[0] : '',
          cuenta: suma('transaccional'), ahorro: suma('ahorro'), inversion: suma('inversion'),
          metas: cs.filter(function (c) { return c.tipo === 'meta'; }).map(function (c) { return { nombre: c.nombre, saldo: +c.saldo || 0, meta: +c.meta || 0 }; }),
          ingresoMes: ing, gastoMes: gast, capacidadMes: r2(Math.max(0, ing - gast)), meses: ms.length
        };
      }
    };
  };
});
