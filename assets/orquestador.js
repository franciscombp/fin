/* Cliente del orquestador de Uku (orquestador/LEEME.md). El front no sabe de viajes ni de metas: manda lo que
   la persona escribe o toca y recibe mensajes con un contrato fijo, que el chat dibuja.
   - Con un servidor configurado (localStorage 'orq-url' o window.ORQUESTADOR_URL) usa POST a esa URL.
   - Si no, corre el mismo orquestador en un Web Worker (la demo en Pages no tiene servidor).
   - Guarda el estado opaco de cada persona y lo devuelve en la siguiente petición, como una sesión. */
(function () {
  'use strict';
  var w = null, n = 0, espera = {}, ultimas = [];
  function usuario() { return window.Persona ? Persona.get() : 'andres'; }
  function leer(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function url() { try { return localStorage.getItem('orq-url') || window.ORQUESTADOR_URL || ''; } catch (e) { return window.ORQUESTADOR_URL || ''; } }
  function worker() {
    if (w) return w;
    w = new Worker('./orquestador/worker.js');
    w.onmessage = function (e) { var p = espera[e.data.id]; if (!p) return; delete espera[e.data.id]; if (e.data.error) p.no(new Error(e.data.error)); else p.si(e.data.respuesta); };
    w.onerror = function () { Object.keys(espera).forEach(function (k) { espera[k].no(new Error('orquestador')); delete espera[k]; }); w = null; };
    return w;
  }
  function enviar(peticion) {
    var u = usuario(), p = { usuario: u, estado: leer('orq-estado:' + u) };
    Object.keys(peticion || {}).forEach(function (k) { p[k] = peticion[k]; });
    var destino = url(), pr;
    if (destino) pr = fetch(destino, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).then(function (r) { return r.json(); });
    else pr = new Promise(function (si, no) {
      var id = ++n; espera[id] = { si: si, no: no };
      try { worker().postMessage({ id: id, peticion: p }); } catch (e) { delete espera[id]; no(e); }
      setTimeout(function () { if (espera[id]) { delete espera[id]; no(new Error('sin respuesta')); } }, 8000);
    });
    return pr.then(function (r) {
      if (r && r.estado) guardar('orq-estado:' + r.estado.usuario, r.estado);
      ultimas = (r && r.sugerencias) || [];
      document.dispatchEvent(new CustomEvent('orq:sugerencias'));
      return r;
    });
  }
  function refrescar() { return enviar({ consulta: 'sugerencias' }).catch(function () {}); }
  document.addEventListener('persona:change', function () { ultimas = []; refrescar(); });
  window.Orquestador = { enviar: enviar, sugerencias: function () { return ultimas; }, refrescar: refrescar };
})();
