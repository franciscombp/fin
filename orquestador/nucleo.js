/* Núcleo del orquestador de Uku.
   Recibe lo que la persona escribe o toca y decide qué habilidad responde. Las habilidades usan herramientas
   (finanzas, y las que vengan) y devuelven mensajes con un contrato fijo; el front solo los dibuja.

   Petición:  { usuario, texto?, accion?, consulta?: 'sugerencias', estado? }
   Respuesta: { manejado, habilidad, mensajes: [Mensaje], estado, efectos: [Efecto], sugerencias: [Sugerencia] }
     Mensaje    { texto, titulo?, cifra?: { v, l }, barras?: [{ l, v }], filas?: [[k, v]],
                  medidor?: { v, max, l, tono? }, medidores?: [{ l, v, max, d?, tono? }], pasos?: { actual, total, l },
                  acciones?: [{ id, texto, icono?, estilo?: 'principal' | 'pregunta' }] }
     Efecto     { tipo: 'animo', valor: 'happy' | 'talk' | 'worried' } | { tipo: 'aviso', texto }
     Sugerencia { id, etiqueta, texto, accion, accionTexto, icono, detalle }
   El estado es opaco para el front: lo guarda y lo devuelve en la siguiente petición (como una sesión).
   Corre igual en un Web Worker (la demo en Pages) y en Node (server.js → POST /api/orquestador). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.OrqNucleo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function copia(o) { return JSON.parse(JSON.stringify(o || {})); }

  return function crearOrquestador(opts) {
    var habilidades = opts.habilidades || [], herr = opts.herramientas || {}, config = opts.config || {};
    function porId(id) { return habilidades.filter(function (h) { return h.id === id; })[0] || null; }
    function ctxDe(p, estado, h) {
      var sub = estado.h[h.id] || (estado.h[h.id] = {});
      return { usuario: p.usuario, estado: sub, herramientas: herr, config: config[h.id] || {}, norm: norm,
        hoy: herr.finanzas ? herr.finanzas.hoy() : new Date().toISOString().slice(0, 10) };
    }
    function sugerencias(p, estado) {
      var out = [];
      habilidades.forEach(function (h) { if (h.sugerencias) out = out.concat(h.sugerencias(ctxDe(p, estado, h)) || []); });
      return out;
    }
    function respuesta(p, estado, h, r) {
      return { manejado: !!r, habilidad: h ? h.id : null, mensajes: r ? r.mensajes || [] : [], efectos: r ? r.efectos || [] : [],
        estado: estado, sugerencias: sugerencias(p, estado) };
    }
    return {
      atender: function (p) {
        p = p || {};
        // El estado es por persona: si cambió la persona activa, empieza de cero
        var estado = p.estado && p.estado.usuario === p.usuario ? copia(p.estado) : { usuario: p.usuario, h: {} };
        if (p.consulta === 'sugerencias') return respuesta(p, estado, null, null);
        // 1. Un botón: su id dice qué habilidad lo atiende («viaje.guardar» → viaje)
        if (p.accion) {
          var hA = porId(String(p.accion).split('.')[0]);
          return respuesta(p, estado, hA, hA ? hA.accion(String(p.accion).slice(hA.id.length + 1), ctxDe(p, estado, hA)) : null);
        }
        var t = norm(p.texto);
        if (!t) return respuesta(p, estado, null, null);
        // 2. Una conversación que espera una respuesta escrita (p. ej. «5 días, 2 personas»)
        var activa = estado.activa && porId(estado.activa);
        if (activa && activa.responder) {
          var r1 = activa.responder(t, ctxDe(p, estado, activa));
          if (r1) return respuesta(p, estado, activa, r1);
        }
        // 3. La habilidad que mejor entiende el mensaje
        var mejor = null, sc = 0;
        habilidades.forEach(function (h) { var s = h.entiende ? h.entiende(t) : 0; if (s > sc) { sc = s; mejor = h; } });
        if (mejor) { estado.activa = mejor.id; return respuesta(p, estado, mejor, mejor.atender(t, ctxDe(p, estado, mejor))); }
        // 4. Nadie: el front sigue con su respuesta de siempre (y se puede migrar aquí cuando haga falta)
        return respuesta(p, estado, null, null);
      }
    };
  };
});
