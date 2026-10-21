/* El orquestador corriendo en el navegador (Web Worker), para la demo en GitHub Pages sin servidor.
   Es el mismo código que sirve server.js en POST /api/orquestador. Mensajes: { id, peticion } → { id, respuesta }. */
importScripts('nucleo.js', 'herramientas/finanzas.js', 'habilidades/viaje.js');
var listo = Promise.all([
  fetch('config/viajes.json').then(function (r) { return r.json(); }),
  fetch('../assets/pfm/datos.json').then(function (r) { return r.json(); })
]).then(function (x) {
  return OrqNucleo({ habilidades: [OrqViaje], herramientas: { finanzas: OrqFinanzas(x[1]) }, config: { viaje: x[0] } });
});
self.onmessage = function (e) {
  var id = e.data && e.data.id;
  listo.then(function (o) { self.postMessage({ id: id, respuesta: o.atender(e.data.peticion) }); })
    .catch(function (err) { self.postMessage({ id: id, error: String(err && err.message || err) }); });
};
