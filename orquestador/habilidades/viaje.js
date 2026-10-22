/* Habilidad «viaje» del orquestador: planear un viaje con Uku.
   1. A dónde, cuántos días, con quién y cuándo (con botones o escrito).
   2. Un presupuesto del viaje con tarifas de referencia (config/viajes.json), que se guarda como presupuesto
      específico de ese viaje.
   3. Si no te alcanza sin tocar tus ahorros ni tu colchón, te invita a crear una meta (o a completar la que ya
      tienes); si te alcanza, a apartar el dinero.
   4. Cuando la meta se cumple (en la demo, «Simular: pasan los meses»), te acompaña durante el viaje: cuánto
      puedes gastar cada día y cómo va cada parte, con avisos si algo se acerca a su límite. Al volver, un resumen.
   Toda la lógica y los textos viven aquí; el front solo dibuja los mensajes. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.OrqViaje = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15 };
  function money(v) { var n = Math.round(Math.abs(v) * 100) / 100, s = n.toFixed(2).split('.'); return (v < 0 ? '−' : '') + '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (s[1] === '00' ? '' : ',' + s[1]); }
  function arriba(v, r) { return Math.ceil(v / r) * r; }
  function num(s) { return /^\d+$/.test(s) ? +s : NUM[s] || 0; }
  function mesDe(hoy, mas) { var a = +hoy.slice(0, 4), m = +hoy.slice(5, 7) - 1 + mas; a += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return { a: a, m: m, t: MESES[m] + ' de ' + a }; }
  function gente(n) { return n === 1 ? 'solo tú' : n === 2 ? '2 personas' : n + ' personas'; }
  function P(id, texto, icono) { return { id: 'viaje.' + id, texto: texto, icono: icono, estilo: 'principal' }; }
  function Q(id, texto) { return { id: 'viaje.' + id, texto: texto, estilo: 'pregunta' }; }

  function destinoEn(t, cfg) {
    var d = null; (cfg.destinos || []).forEach(function (x) { if (!d && x.claves.some(function (k) { return t.indexOf(k) >= 0; })) d = x; });
    return d;
  }
  function destino(ctx) { return (ctx.config.destinos || []).filter(function (x) { return x.id === ctx.estado.destino; })[0]; }
  // Lo que se entiende de un mensaje escrito: días, personas, plazo
  function leer(t, E, cfg, hoy) {
    var m;
    if ((m = t.match(/(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince) (dias|dia|noches|semana|semanas)/))) E.dias = /semana/.test(m[2]) ? 7 * num(m[1]) : num(m[1]) + (/noche/.test(m[2]) ? 1 : 0);
    if ((m = t.match(/(\d+|dos|tres|cuatro|cinco|seis|siete|ocho) (personas|adultos|amigos|amigas)/))) E.personas = num(m[1]);
    else if (/\bsol[oa]\b|\byo sol/.test(t)) E.personas = 1;
    else if (/pareja|novi[oa]|espos[oa]|\bdos\b/.test(t) && !E.personas) E.personas = 2;
    else if (/familia/.test(t) && !E.personas) E.personas = 4;
    if ((m = t.match(/en (\d+|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) mes/))) E.plazo = num(m[1]);
    else MESES.forEach(function (mes, i) { if (new RegExp('\\b' + mes + '\\b').test(t)) { var h = +hoy.slice(5, 7) - 1, d = (i - h + 12) % 12 || 12; E.plazo = d; } });
    var d = destinoEn(t, cfg); if (d) E.destino = d.id;
  }
  // El presupuesto del viaje, por partes, redondeado
  function presupuesto(ctx) {
    var E = ctx.estado, d = destino(ctx), c = ctx.config, r = c.redondeo || 10, noches = Math.max(1, E.dias - 1), habs = Math.ceil(E.personas / 2);
    var cats = [
      { id: 'transporte', l: d.transporte, v: arriba(d.vuelo * E.personas, r), pre: true },
      { id: 'hospedaje', l: 'Hospedaje', v: arriba(d.hotel * noches * habs, r), pre: true },
      { id: 'comida', l: 'Comida', v: arriba(d.comida * E.dias * E.personas, r) },
      { id: 'paseos', l: d.ingreso ? 'Paseos y entradas' : 'Paseos', v: arriba((d.paseos + (d.ingreso || 0)) * E.personas, r) },
      { id: 'movilidad', l: 'Movilidad allá', v: arriba(d.transporteLocal * E.dias * E.personas, r) }
    ];
    var sub = cats.reduce(function (s, x) { return s + x.v; }, 0);
    cats.push({ id: 'imprevistos', l: 'Imprevistos', v: arriba(sub * (c.imprevistos || .1), r) });
    return { cats: cats, total: cats.reduce(function (s, x) { return s + x.v; }, 0) };
  }
  // Cuánto hay para el viaje sin tocar ahorros, inversiones ni el colchón del mes (más la meta, si ya existe)
  function cuentas(ctx) {
    var E = ctx.estado, f = ctx.herramientas.finanzas.resumen(ctx.usuario), d = destino(ctx);
    var meta = f.metas.filter(function (m) { var n = ctx.norm(m.nombre); return d.claves.some(function (k) { return n.indexOf(k) >= 0; }) || n.indexOf(ctx.norm(d.nombre)) >= 0; })[0] || null;
    var libre = Math.max(0, Math.round(f.cuenta - f.gastoMes * (ctx.config.colchonMeses || 1)));
    return { f: f, meta: meta, disponible: libre + (meta ? meta.saldo : 0), libre: libre };
  }

  // ---------- Las tarjetas de cada fase ----------
  function preguntar(ctx) {
    var E = ctx.estado, d = destino(ctx), c = ctx.config;
    if (!d) { E.fase = 'destino'; return { mensajes: [{ texto: '¡Qué buen plan! ¿A dónde te gustaría ir? Elige uno o escríbeme el lugar.', acciones: c.destinos.slice(0, 6).map(function (x) { return Q('destino:' + x.id, x.nombre); }) }] }; }
    if (!E.dias || !E.personas) { E.fase = 'detalles'; return { mensajes: [{ texto: d.nombre + ', qué lindo. ¿Cuántos días y con quién vas? También me lo puedes escribir, por ejemplo «6 días, 3 personas».', acciones: c.duraciones.map(function (x) { return Q('detalles:' + x.id, x.texto); }) }] }; }
    if (!E.plazo) { E.fase = 'fecha'; return { mensajes: [{ texto: '¿Para cuándo lo piensas?', acciones: c.plazos.map(function (n) { return Q('plazo:' + n, 'En ' + n + ' meses (' + mesDe(ctx.hoy, n).t.split(' de ')[0] + ')'); }) }] }; }
    return propuesta(ctx);
  }
  function propuesta(ctx) {
    var E = ctx.estado, d = destino(ctx), p = presupuesto(ctx), cuando = mesDe(ctx.hoy, E.plazo).t;
    E.fase = 'propuesta'; E.presupuesto = p;
    return { mensajes: [{
      texto: 'Armé el presupuesto con precios de referencia para ' + d.nombre + '. Lo puedes ajustar antes de guardarlo.',
      titulo: 'Viaje a ' + d.nombre, cifra: { v: money(p.total), l: E.dias + ' días · ' + gente(E.personas) + ' · ' + cuando },
      barras: p.cats.map(function (x) { return { l: x.l, v: x.v }; }),
      filas: [['Por persona', money(Math.round(p.total / E.personas))]].concat(d.ingreso ? [[d.ingresoTexto, money(d.ingreso * E.personas)]] : []),
      acciones: [P('guardar', 'Guardar como presupuesto del viaje', 'savings'), Q('ajustar:mas', 'Un día más'), Q('ajustar:menos', 'Un día menos'), Q('otro', 'Otro destino')]
    }], efectos: [{ tipo: 'animo', valor: 'talk' }] };
  }
  function guardado(ctx) {
    var E = ctx.estado, d = destino(ctx), p = E.presupuesto, k = cuentas(ctx), cuando = mesDe(ctx.hoy, E.plazo).t;
    E.guardado = true;
    var aviso = d.internacional ? ' Como sales del país, antes del viaje avisa a tu tarjeta que vas a usarla afuera.' : '';
    if (k.disponible >= p.total) {
      E.fase = 'cubierto';
      return { mensajes: [{
        texto: 'Listo, es tu presupuesto del viaje. Buenas noticias: sin tocar tus ahorros ni tu colchón de un mes, ya tienes el dinero. ¿Lo apartamos para que no se mezcle con el día a día?' + aviso,
        titulo: 'Tu viaje está cubierto', cifra: { v: money(p.total), l: 'presupuesto del viaje a ' + d.nombre },
        filas: [['Disponible para el viaje', money(k.disponible)], ['Cuándo', cuando]],
        acciones: [P('apartar', 'Apartar ' + money(p.total) + ' para el viaje', 'savings'), Q('ver', 'Ver el presupuesto')]
      }], efectos: [{ tipo: 'animo', valor: 'happy' }, { tipo: 'aviso', texto: 'Guardaste el presupuesto del viaje a ' + d.nombre + '.' }] };
    }
    var falta = p.total - k.disponible, mensual = arriba(falta / E.plazo, 5), cap = k.f.capacidadMes;
    E.fase = 'sin-meta'; E.cuentas = { disponible: k.disponible, falta: falta, mensual: mensual, meta: k.meta };
    var t = 'Listo, es tu presupuesto del viaje. Sin tocar tus ahorros ni tu colchón de un mes, hoy tienes ' + money(k.disponible) + ' para esto' +
      (k.meta ? ' (incluye lo que llevas en tu meta «' + k.meta.nombre + '»)' : '') + ' y te faltan ' + money(falta) + '. ' +
      (k.meta ? '¿Actualizamos tu meta?' : '¿Creamos una meta?') + ' Con ' + money(mensual) + ' al mes llegas para ' + cuando + '.' +
      (cap < mensual ? ' Hoy se te va casi todo lo que entra; para separar esa parte te ayudo a bajar un poco gustos y comida fuera.' : '');
    var largo = (ctx.config.plazos || []).filter(function (n) { return n > E.plazo; })[0];
    return { mensajes: [{
      texto: t, titulo: 'Te faltan ' + money(falta), medidor: { v: k.disponible, max: p.total, l: money(k.disponible) + ' de ' + money(p.total) },
      filas: [['Ahorro al mes', money(mensual)], ['Listo para', cuando]],
      acciones: [P('meta:crear', k.meta ? 'Actualizar mi meta «' + k.meta.nombre + '»' : 'Crear la meta «Viaje a ' + d.nombre + '»', 'flag')]
        .concat(largo ? [Q('meta:plazo:' + largo, 'Con más tiempo: ' + money(arriba(falta / largo, 5)) + ' al mes')] : []).concat([Q('ver', 'Ver el presupuesto')])
    }], efectos: [{ tipo: 'aviso', texto: 'Guardaste el presupuesto del viaje a ' + d.nombre + '.' }] };
  }
  function tarjetaMeta(ctx, texto, extra) {
    var E = ctx.estado, M = E.meta;
    return { texto: texto, titulo: 'Meta: ' + M.nombre, medidor: { v: M.ahorrado, max: M.objetivo, l: money(M.ahorrado) + ' de ' + money(M.objetivo), tono: M.ahorrado >= M.objetivo ? 'ok' : null },
      filas: [['Ahorro al mes', money(M.mensual)], ['Listo para', mesDe(ctx.hoy, E.plazo).t]], acciones: extra };
  }
  // Durante el viaje: lo ya pagado (pasajes, hospedaje) y lo que se gasta allá, parte por parte
  function control(ctx, texto, efectos) {
    var E = ctx.estado, d = destino(ctx), V = E.viaje, p = E.presupuesto;
    var gastado = function (id) { return V.gastos.filter(function (g) { return g.cat === id; }).reduce(function (s, g) { return s + g.monto; }, 0); };
    // Lo del día sale de comida, paseos y movilidad; imprevistos es la reserva que cubre lo que se pase
    var vars = p.cats.filter(function (x) { return !x.pre && x.id !== 'imprevistos'; }), imp = p.cats.filter(function (x) { return x.id === 'imprevistos'; })[0];
    var resta = vars.reduce(function (s, x) { return s + Math.max(0, x.v - gastado(x.id)); }, 0), exceso = vars.reduce(function (s, x) { return s + Math.max(0, gastado(x.id) - x.v); }, 0);
    var dias = Math.max(1, E.dias - V.dia + 1), hoy = Math.max(0, Math.round(resta / dias));
    return { mensajes: [{
      texto: texto, titulo: 'Día ' + V.dia + ' de ' + E.dias + ' · ' + d.nombre, cifra: { v: money(hoy), l: 'puedes gastar hoy' },
      medidores: vars.map(function (x) { var g = gastado(x.id), u = g / x.v; return { l: x.l, v: g, max: x.v, d: money(g) + ' de ' + money(x.v), tono: u > 1 ? 'over' : u >= .8 ? 'warn' : 'ok' }; })
        .concat(imp ? [{ l: 'Imprevistos (reserva)', v: exceso, max: imp.v, d: exceso ? 'usaste ' + money(exceso) + ' de ' + money(imp.v) : 'intacta · ' + money(imp.v), tono: exceso > imp.v ? 'over' : exceso ? 'warn' : 'ok' }] : []),
      filas: p.cats.filter(function (x) { return x.pre; }).map(function (x) { return [x.l, 'Pagado · ' + money(x.v)]; }),
      acciones: [Q('gasto', 'Simular un gasto'), Q('dia', V.dia < E.dias ? 'Pasar al día siguiente' : 'Último día'), Q('terminar', 'Terminar el viaje')]
    }], efectos: efectos || [] };
  }
  function cierre(ctx) {
    var E = ctx.estado, d = destino(ctx), V = E.viaje, p = E.presupuesto;
    var vars = p.cats.filter(function (x) { return !x.pre; }), pres = vars.reduce(function (s, x) { return s + x.v; }, 0), gas = V.gastos.reduce(function (s, g) { return s + g.monto; }, 0), sobra = Math.round(pres - gas);
    E.fase = 'fin'; E.sobra = sobra;
    return { mensajes: [{
      texto: sobra >= 0 ? '¡Qué bueno tenerte de vuelta! Disfrutaste ' + d.nombre + ' y volviste con ' + money(sobra) + ' de sobra. ¿Los paso a tu ahorro?' : 'Qué bueno tenerte de vuelta. Te pasaste por ' + money(-sobra) + '; para el próximo viaje subimos esa parte del presupuesto.',
      titulo: 'Tu viaje a ' + d.nombre, cifra: { v: money(gas), l: 'gastaste allá, de ' + money(pres) },
      barras: vars.map(function (x) { return { l: x.l, v: V.gastos.filter(function (g) { return g.cat === x.id; }).reduce(function (s, g) { return s + g.monto; }, 0) }; }),
      acciones: (sobra > 0 ? [P('ahorrar', 'Pasar ' + money(sobra) + ' a mi ahorro', 'savings')] : []).concat([Q('nuevo', 'Planear otro viaje')])
    }], efectos: [{ tipo: 'animo', valor: 'happy' }] };
  }

  return {
    id: 'viaje',
    entiende: function (t) {
      if (/\b(viajar|viaje|vacaciones|irme de paseo|ir de paseo|conocer)\b/.test(t)) return 3;
      return 0;
    },
    atender: function (t, ctx) {
      var E = ctx.estado; Object.keys(E).forEach(function (k) { delete E[k]; }); // un viaje nuevo
      leer(t, E, ctx.config, ctx.hoy);
      return preguntar(ctx);
    },
    // Respuestas escritas mientras la conversación espera algo (destino, días, fecha o un ajuste)
    responder: function (t, ctx) {
      var E = ctx.estado; if (!/^(destino|detalles|fecha|propuesta)$/.test(E.fase || '')) return null;
      var antes = JSON.stringify(E); leer(t, E, ctx.config, ctx.hoy);
      if (JSON.stringify(E) === antes) return null; // no era para mí: que responda otra
      return preguntar(ctx);
    },
    accion: function (a, ctx) {
      var E = ctx.estado, p = a.split(':'), d;
      switch (p[0]) {
        case 'destino': E.destino = p[1]; return preguntar(ctx);
        case 'detalles': d = (ctx.config.duraciones || []).filter(function (x) { return x.id === p[1]; })[0]; if (d) { E.dias = d.dias; E.personas = d.personas; } return preguntar(ctx);
        case 'plazo': E.plazo = +p[1]; return preguntar(ctx);
        case 'ajustar': E.dias = Math.max(2, (E.dias || 3) + (p[1] === 'mas' ? 1 : -1)); return propuesta(ctx);
        case 'otro': case 'nuevo': Object.keys(E).forEach(function (k) { delete E[k]; }); return preguntar(ctx);
        case 'guardar': return guardado(ctx);
        case 'ver': return E.presupuesto ? { mensajes: [{ texto: 'Este es el presupuesto de tu viaje.', titulo: 'Viaje a ' + destino(ctx).nombre, cifra: { v: money(E.presupuesto.total), l: E.dias + ' días · ' + gente(E.personas) },
          barras: E.presupuesto.cats.map(function (x) { return { l: x.l, v: x.v }; }), acciones: E.fase === 'meta' ? [Q('simular:meses', 'Simular: pasan los meses')] : E.fase === 'viajando' ? [Q('gasto', 'Simular un gasto')] : [] }] } : preguntar(ctx);
        case 'meta': {
          if (p[1] === 'plazo') { E.plazo = +p[2]; E.presupuesto = presupuesto(ctx); return guardado(ctx); }
          var K = E.cuentas, nombre = K.meta ? K.meta.nombre : 'Viaje a ' + destino(ctx).nombre;
          E.fase = 'meta'; E.meta = { nombre: nombre, objetivo: E.presupuesto.total, ahorrado: K.disponible, mensual: K.mensual, existente: !!K.meta };
          return { mensajes: [tarjetaMeta(ctx, (K.meta ? 'Actualicé tu meta: ahora es de ' + money(E.presupuesto.total) + '.' : '¡Meta creada!') + ' Cada mes separo ' + money(K.mensual) + ' el día que te pagan y te cuento cómo vas. Tu bosque florece con cada aporte.',
            [Q('simular:meses', 'Simular: pasan los meses'), Q('ver', 'Ver el presupuesto del viaje')])], efectos: [{ tipo: 'animo', valor: 'happy' }, { tipo: 'aviso', texto: (K.meta ? 'Actualizaste la meta ' : 'Creaste la meta ') + nombre + '.' }] };
        }
        case 'simular': E.meta.ahorrado = E.meta.objetivo; E.fase = 'listo';
          return { mensajes: [tarjetaMeta(ctx, '¡Lo lograste! Ya tienes ' + money(E.meta.objetivo) + ' para ' + destino(ctx).nombre + '. Cuando empiece el viaje te acompaño con los gastos, para que disfrutes sin pasarte.', [P('empezar', 'Empezar mi viaje', 'flight_takeoff')])],
            efectos: [{ tipo: 'animo', valor: 'happy' }, { tipo: 'aviso', texto: 'Cumpliste tu meta ' + E.meta.nombre + '.' }] };
        case 'apartar': E.fase = 'listo'; E.meta = { nombre: 'Viaje a ' + destino(ctx).nombre, objetivo: E.presupuesto.total, ahorrado: E.presupuesto.total, mensual: 0 };
          return { mensajes: [{ texto: 'Apartado. Ese dinero queda para el viaje y no se mezcla con el día a día. Cuando empiece, te digo cuánto puedes gastar cada día.', titulo: 'Viaje a ' + destino(ctx).nombre, cifra: { v: money(E.presupuesto.total), l: 'apartado para el viaje' },
            acciones: [P('empezar', 'Empezar mi viaje', 'flight_takeoff')] }], efectos: [{ tipo: 'animo', valor: 'happy' }, { tipo: 'aviso', texto: 'Apartaste el dinero del viaje.' }] };
        case 'empezar': E.fase = 'viajando'; E.viaje = { dia: 1, gastos: [], i: 0 };
          return control(ctx, '¡Buen viaje! Los pasajes y el hospedaje ya están pagados. Esto es lo que puedes gastar hoy allá; te aviso si algo se acerca a su límite.', [{ tipo: 'animo', valor: 'happy' }]);
        case 'gasto': {
          var V = E.viaje, G = ctx.config.gastosDemo, g = G[V.i % G.length], escala = Math.max(1, E.personas / 2); V.i++;
          var cat = g.cat === 'transporte' ? 'movilidad' : g.cat, monto = Math.round(g.monto * escala); V.gastos.push({ cat: cat, texto: g.texto, monto: monto });
          var x = E.presupuesto.cats.filter(function (c) { return c.id === cat; })[0], usado = V.gastos.filter(function (y) { return y.cat === cat; }).reduce(function (s, y) { return s + y.monto; }, 0);
          var resta = x.v - usado, dias = Math.max(1, E.dias - V.dia + 1), u = usado / x.v;
          var t = 'Anoté «' + g.texto + '»: ' + money(monto) + ' en ' + x.l.toLowerCase() + '. ' + (u > 1 ? 'Te pasaste por ' + money(-resta) + ' en ' + x.l.toLowerCase() + '; lo cubro con imprevistos, pero cuidemos lo que queda.'
            : u >= .8 ? 'Ojo: ya usaste el ' + Math.round(u * 100) + '% de ' + x.l.toLowerCase() + '. Te quedan ' + money(resta) + ' para ' + dias + (dias === 1 ? ' día' : ' días') + ': unos ' + money(Math.round(resta / dias)) + ' al día.'
            : 'Vas bien: te quedan ' + money(resta) + ' en ' + x.l.toLowerCase() + '.');
          return control(ctx, t, [{ tipo: 'animo', valor: u >= .8 ? 'worried' : 'talk' }]);
        }
        case 'dia': {
          // En la demo, pasar el día anota lo que se gasta en un día típico (la comida, un poco por encima)
          var V2 = E.viaje, R = ctx.config.ritmoDemo || {}, ayer = 0;
          E.presupuesto.cats.filter(function (c) { return !c.pre && R[c.id]; }).forEach(function (c) {
            var m = Math.round(c.v / E.dias * R[c.id]); ayer += m; V2.gastos.push({ cat: c.id, texto: 'Gastos del día ' + V2.dia, monto: m });
          });
          if (V2.dia >= E.dias) return cierre(ctx);
          V2.dia++;
          // El aviso: la parte que más se acerca a su límite
          var peor = null; E.presupuesto.cats.filter(function (c) { return !c.pre && c.id !== 'imprevistos'; }).forEach(function (c) {
            var u = V2.gastos.filter(function (y) { return y.cat === c.id; }).reduce(function (s2, y) { return s2 + y.monto; }, 0) / c.v; if (!peor || u > peor.u) peor = { c: c, u: u };
          });
          var dr = E.dias - V2.dia + 1, usado2 = Math.round(peor.u * peor.c.v), resta2 = peor.c.v - usado2;
          var t2 = 'Buenos días. Ayer gastaste ' + money(ayer) + '. Hoy es el día ' + V2.dia + ' de ' + E.dias + ' y repartí lo que queda entre los días que faltan.' +
            (peor.u >= .8 && peor.u <= 1 ? ' Ojo con ' + peor.c.l.toLowerCase() + ': ya usaste el ' + Math.round(peor.u * 100) + '%; te quedan ' + money(resta2) + ', unos ' + money(Math.round(resta2 / dr)) + ' al día.'
              : peor.u > 1 ? ' Te pasaste en ' + peor.c.l.toLowerCase() + ' por ' + money(-resta2) + '; lo cubro con imprevistos, pero cuidemos lo que queda.' : '');
          return control(ctx, t2, [{ tipo: 'animo', valor: peor.u >= .8 ? 'worried' : 'talk' }]);
        }
        case 'terminar': return cierre(ctx);
        case 'ahorrar': { var s = E.sobra; Object.keys(E).forEach(function (k) { delete E[k]; });
          return { mensajes: [{ texto: 'Listo, pasé ' + money(s) + ' a tu ahorro. ¡Buen viaje el que hiciste! Cuando quieras planeamos el siguiente.', acciones: [Q('nuevo', 'Planear otro viaje')] }], efectos: [{ tipo: 'animo', valor: 'happy' }, { tipo: 'aviso', texto: 'Pasaste ' + money(s) + ' a tu ahorro.' }] }; }
      }
      return null;
    },
    // Lo que Uku muestra en Mis finanzas mientras hay un viaje en marcha
    sugerencias: function (ctx) {
      var E = ctx.estado, d = destino(ctx); if (!d || !E.guardado) return [];
      if (E.fase === 'meta') return [{ id: 'viaje', etiqueta: 'Tu viaje', icono: 'flight', accion: 'viaje.ver', accionTexto: 'Meta: ' + E.meta.nombre,
        detalle: 'Llevas ' + money(E.meta.ahorrado) + ' de ' + money(E.meta.objetivo), texto: 'Vas por buen camino con tu viaje a ' + d.nombre + ': llevas ' + money(E.meta.ahorrado) + ' de ' + money(E.meta.objetivo) + '. Con ' + money(E.meta.mensual) + ' al mes llegas para ' + mesDe(ctx.hoy, E.plazo).t + '.' }];
      if (E.fase === 'viajando') return [{ id: 'viaje', etiqueta: 'De viaje', icono: 'flight', accion: 'viaje.ver', accionTexto: 'Tu viaje a ' + d.nombre,
        detalle: 'Día ' + E.viaje.dia + ' de ' + E.dias, texto: '¡Disfruta ' + d.nombre + '! Hoy es el día ' + E.viaje.dia + ' de ' + E.dias + '; te aviso si algo se acerca a su límite.' }];
      if (E.fase === 'listo' || E.fase === 'cubierto') return [{ id: 'viaje', etiqueta: 'Tu viaje', icono: 'flight', accion: E.fase === 'listo' ? 'viaje.empezar' : 'viaje.apartar', accionTexto: E.fase === 'listo' ? 'Empezar mi viaje' : 'Apartar el dinero del viaje',
        detalle: 'Viaje a ' + d.nombre, texto: 'Tu viaje a ' + d.nombre + ' está cubierto. ' + (E.fase === 'listo' ? 'Cuando empiece, te acompaño con los gastos.' : 'Apartemos el dinero para que no se mezcle.') }];
      if (E.fase === 'sin-meta') return [{ id: 'viaje', etiqueta: 'Tu viaje', icono: 'flag', accion: 'viaje.meta:crear', accionTexto: 'Crear la meta del viaje',
        detalle: 'Te faltan ' + money(E.cuentas.falta), texto: 'Para tu viaje a ' + d.nombre + ' te faltan ' + money(E.cuentas.falta) + '. Con ' + money(E.cuentas.mensual) + ' al mes llegas a tiempo.' }];
      return [];
    }
  };
});
