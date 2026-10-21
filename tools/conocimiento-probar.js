#!/usr/bin/env node
/* Mide la calidad del buscador de la base de conocimiento con preguntas
   reales (como las escribe la gente: con errores, sin tildes, a medias).
   Cada caso dice qué entrada debería salir primera. Reporta cuántas salen
   en el primer lugar y entre las tres primeras, y lista las que fallan.
   Uso: node tools/conocimiento-probar.js [-v]      (-v muestra cada caso)
        node tools/conocimiento-probar.js "texto"    (busca ese texto) */
'use strict';
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const K = require(path.join(raiz, 'assets/conocimiento.js'));
K.cargar(JSON.parse(fs.readFileSync(path.join(raiz, 'assets/conocimiento/base.json'), 'utf8')));

const CASOS = [
  // Acceso
  ['olvide mi clave', 'faq.acceso.olvide-clave'], ['no me acuerdo de la contraseña', 'faq.acceso.olvide-clave'], ['recuperar password', 'faq.acceso.olvide-clave'],
  ['olvide mi usuario', 'faq.acceso.olvide-usuario'], ['me bloquee', 'faq.acceso.bloqueo-intentos'], ['usuario bloqueado', 'faq.acceso.bloqueo-intentos'], ['puse mal la clave 3 veces', 'faq.acceso.bloqueo-intentos'],
  ['entrar con huella', 'faq.acceso.biometria'], ['activar face id', 'faq.acceso.biometria'], ['cambie de celular', 'faq.acceso.celular-nuevo'], ['usar la app en otro telefono', 'faq.acceso.celular-nuevo'],
  ['me llamaron pidiendo mi clave', 'faq.acceso.sospechoso'], ['mensaje sospechoso', 'faq.acceso.sospechoso'], ['phishing', 'faq.acceso.sospechoso'],
  ['que es la clave digital', 'prod.canales.clave-digital'], ['como uso el token', 'faq.acceso.clave-digital'], ['token', 'faq.acceso.clave-digital'],
  // Tarjetas
  ['cuando pago mi tarjeta', 'faq.tarjetas.corte-pago'], ['fecha de corte', 'faq.tarjetas.corte-pago'], ['cuanto debo de la tarjeta', 'faq.tarjetas.corte-pago'], ['pago minimo', 'faq.tarjetas.corte-pago'],
  ['por que me cobraron intereses', 'faq.tarjetas.intereses'], ['me atrase con la tarjeta', 'faq.tarjetas.mora'],
  ['subir el cupo', 'faq.tarjetas.cupo'], ['aumentar limite tarjeta', 'faq.tarjetas.cupo'], ['bajar cupo', 'faq.tarjetas.bajar-cupo'],
  ['me robaron la tarjeta', 'faq.tarjetas.perdida'], ['perdi mi tarjeta', 'faq.tarjetas.perdida'], ['congelar tarjeta', 'faq.tarjetas.congelar'],
  ['bloqueo temporal debito', 'faq.tarjetas.bloqueo-debito'], ['bloqueo definitivo', 'faq.tarjetas.bloqueo-definitivo'], ['reponer tarjeta', 'faq.tarjetas.bloqueo-definitivo'],
  ['cambiar pin de la tarjeta', 'faq.tarjetas.clave-tarjeta'], ['clave del cajero', 'faq.tarjetas.clave-tarjeta'], ['tarjeta vencida', 'faq.tarjetas.caducada'],
  ['apple pay', 'faq.tarjetas.wallet'], ['pagar con el celular', 'faq.tarjetas.wallet'], ['diferir una compra', 'faq.tarjetas.diferir'], ['pasar a cuotas', 'faq.tarjetas.diferir'],
  ['voy a viajar', 'faq.tarjetas.exterior'], ['compras en el exterior', 'faq.tarjetas.exterior'], ['me rechazan la tarjeta en internet', 'faq.tarjetas.compras-online'],
  ['estado de cuenta de la tarjeta', 'faq.tarjetas.estado-cuenta'], ['avance de efectivo', 'accion.avance'], ['como saco un avance', 'faq.tarjetas.avance'], ['cuantas millas tengo', 'faq.tarjetas.millas'],
  ['clonaron mi tarjeta', 'faq.tarjetas.digital-fraude'], ['como uso el debito digital', 'faq.tarjetas.debito-digital'],
  // Cuentas
  ['mi transferencia no llega', 'faq.cuentas.transferencia-llega'], ['cuanto demora una transferencia a otro banco', 'faq.cuentas.transferencia-llega'],
  ['cuanto puedo transferir al dia', 'faq.cuentas.limite-transferir'], ['limite de transferencias', 'faq.cuentas.limite-transferir'],
  ['cual es mi numero de cuenta', 'faq.cuentas.numero'], ['como abro una cuenta', 'faq.cuentas.abrir'], ['requisitos para abrir cuenta', 'prod.cuentas.ahorros'], ['puedo abrir una cuenta desde el celular', 'faq.cuentas.abrir'],
  ['certificado bancario', 'accion.certificado'], ['necesito un certificado', 'accion.certificado'], ['referencia bancaria', 'faq.cuentas.certificado'], ['descargar estado de cuenta', 'faq.cuentas.estado-cuenta'],
  ['actualizar mis datos', 'accion.datos'], ['como actualizo mis datos', 'faq.cuentas.datos'], ['cambiar mi correo', 'accion.datos'], ['transferir a un celular', 'accion.transferir'], ['como transfiero a un celular', 'faq.cuentas.celular'], ['vincular mi numero', 'faq.cuentas.vincular-celular'],
  ['por que me descontaron', 'faq.cuentas.comisiones'], ['comisiones', 'faq.cuentas.comisiones'], ['que es el isd', 'faq.cuentas.isd'], ['impuesto salida de divisas', 'faq.cuentas.isd'],
  ['enviar plata a españa', 'accion.transferir'], ['como envio plata a españa', 'faq.cuentas.exterior'], ['swift', 'faq.cuentas.exterior'], ['sobregiro', 'faq.cuentas.sobregiro'], ['cuenta inactiva', 'faq.cuentas.reactivar'],
  ['cancelar un producto', 'faq.cuentas.cancelar'], ['cerrar mi cuenta', 'faq.cuentas.cancelar'], ['cosede', 'faq.cuentas.cosede'], ['retencion', 'faq.cuentas.retencion'], ['depositar un cheque', 'faq.cuentas.cheque'],
  // Pagos
  ['como pago la luz', 'faq.pagos.servicios'], ['pago automatico', 'faq.pagos.automatico'], ['pague la luz y no se refleja', 'faq.pagos.no-refleja'],
  ['como pago con qr', 'faq.pagos.qr'], ['como cobro con qr', 'faq.pagos.cobrar-qr'], ['como recargo mi celular', 'faq.pagos.recarga'], ['recargue y no llego', 'faq.pagos.recarga-no-llego'],
  ['como pago mi tarjeta', 'faq.pagos.tarjeta'], ['retirar sin tarjeta', 'accion.retirar'], ['como retiro sin tarjeta', 'faq.pagos.retiro-sin-tarjeta'], ['el cajero no me dio la plata', 'faq.pagos.retiro-no-entrego'], ['comprobante', 'faq.pagos.comprobante'],
  // Reclamos
  ['no reconozco un consumo', 'faq.reclamos.no-reconozco'], ['me cobraron dos veces', 'faq.reclamos.no-reconozco'], ['cargo raro en mi tarjeta', 'faq.reclamos.no-reconozco'],
  ['que es un consumo no reconocido', 'faq.reclamos.que-es'], ['cuanto tarda un reclamo', 'faq.reclamos.cuanto-tarda'], ['no encuentro mi reclamo', 'faq.reclamos.no-encuentro'],
  ['debito y no pago', 'faq.reclamos.debito-no-pago'], ['transferi a una cuenta equivocada', 'faq.reclamos.transferencia-equivocada'], ['me equivoque al transferir', 'faq.reclamos.transferencia-equivocada'],
  ['quiero poner una queja', 'faq.reclamos.sugerencia'],
  // Préstamos e inversiones
  ['cuando pago mi cuota', 'faq.prestamos.cuota'], ['adelantar cuotas', 'faq.prestamos.adelantar'], ['precancelar prestamo', 'faq.prestamos.adelantar'], ['tengo un credito preaprobado', 'faq.prestamos.preaprobado'],
  ['tasa de interes del prestamo', 'faq.prestamos.tasa'], ['como pido un prestamo', 'faq.prestamos.solicitar'], ['no puedo pagar la cuota', 'faq.prestamos.alivio'], ['refinanciar', 'faq.prestamos.alivio'], ['buro de credito', 'faq.prestamos.buro'],
  ['cuando vence mi deposito', 'faq.inversiones.vence'], ['renovar deposito', 'faq.inversiones.renovar'], ['retirar mi inversion antes', 'faq.inversiones.retirar-antes'], ['cuanto ganaria si invierto 1000', 'faq.inversiones.cuanto-gano'],
  // Seguros, app, canales
  ['que cubre mi seguro de vida', 'faq.seguros.vida'], ['reclamo del seguro', 'faq.seguros.reclamo'], ['seguro de compras', 'faq.seguros.compras'],
  ['que es mis finanzas', 'faq.app.mis-finanzas'], ['como creo un atajo', 'faq.app.atajo'], ['no me llegan las notificaciones', 'faq.app.notificaciones'], ['sin internet', 'faq.app.sin-internet'],
  ['app en kichwa', 'faq.app.idioma'], ['quien es uku', 'faq.app.uku'], ['la app no abre', 'faq.app.actualizar'],
  ['telefono del banco', 'faq.canales.atencion'], ['horario de atencion', 'faq.canales.atencion'], ['que tramites necesitan agencia', 'faq.canales.agencia'],
  ['mi vecino', 'faq.canales.corresponsal'], ['cuanto puedo retirar en el cajero', 'faq.canales.cajero'], ['que es deuna', 'faq.canales.deuna'],
  // Productos
  ['cuenta de ahorros', 'prod.cuentas.ahorros'], ['que es la cuenta transaccional', 'prod.cuentas.transaccional'], ['cuenta corriente', 'prod.cuentas.corriente'],
  ['cuenta joven', 'prod.cuentas.joven'], ['cuenta conjunta', 'prod.cuentas.conjunta'], ['cuenta para migrantes', 'prod.cuentas.compatriota'],
  ['que es el ahorro flexible', 'prod.cuentas.ahorro-flexible'], ['que es un deposito a plazo', 'prod.inversiones.deposito'], ['tarjeta de debito', 'prod.tarjetas.debito'],
  ['requisitos tarjeta de credito', 'prod.tarjetas.credito'], ['beneficios mastercard black', 'prod.tarjetas.black'], ['salas vip', 'prod.tarjetas.black'],
  ['credito hipotecario', 'prod.prestamos.hipotecario'], ['prestamo para comprar carro', 'prod.prestamos.vehicular'], ['credito para mi negocio', 'prod.prestamos.microcredito'],
  ['seguro de vida', 'prod.seguros.vida'], ['seguro de salud', 'prod.seguros.salud'], ['banca web', 'prod.canales.banca-web'],
  // Acciones (imperativas)
  ['transferir', 'accion.transferir'], ['enviar plata', 'accion.transferir'], ['mandar dinero a maria', 'accion.transferir'],
  ['pagar con qr', 'accion.pagar-qr'], ['escanear', 'accion.pagar-qr'], ['cobrar', 'accion.cobrar-qr'], ['mostrar mi qr', 'accion.cobrar-qr'],
  ['pagar la luz', 'accion.pagar-servicios'], ['pagar servicios', 'accion.pagar-servicios'], ['recargar', 'accion.recargar'], ['recarga claro', 'accion.recargar'],
  ['pagar tarjeta', 'accion.pagar-tarjeta'], ['retirar', 'accion.retirar'], ['sacar plata', 'accion.retirar'], ['recibir dinero', 'accion.recibir'],
  ['mis tarjetas', 'accion.tarjetas'], ['ver saldo', 'accion.cuentas'], ['mis cuentas', 'accion.cuentas'], ['prestamos', 'accion.prestamos'], ['inversiones', 'accion.inversiones'],
  ['seguridad', 'accion.seguridad'], ['mis finanzas', 'accion.mis-finanzas'], ['en que gasto', 'faq.app.mis-finanzas'],
  ['solicitar tarjeta de credito', 'accion.solicitar-tarjeta'], ['abrir cuenta', 'accion.solicitar-cuenta'], ['activar debito digital', 'accion.debito-digital'],
  ['simular credito', 'accion.simular-credito'], ['crear meta', 'accion.meta'], ['contratar seguro', 'accion.contratar-seguro'], ['hablar con una persona', 'accion.persona'], ['quiero un asesor', 'accion.persona'],
  ['cajero cercano', 'accion.punto-retiro'], ['revisar un consumo', 'accion.revisar-consumo'], ['mis solicitudes', 'accion.solicitudes'],
  // Errores de tipeo y escritura a medias
  ['trasferencia', 'faq.cuentas.transferencia-llega'], ['tarjta bloqueada', 'faq.tarjetas.bloqueo-debito'], ['certficado', 'faq.cuentas.certificado'], ['olvdie mi clave', 'faq.acceso.olvide-clave'],
  ['sobregir', 'faq.cuentas.sobregiro'], ['recar', 'accion.recargar'], ['transf', 'accion.transferir']
];

const args = process.argv.slice(2), verboso = args.includes('-v'), libre = args.filter(a => a !== '-v').join(' ');
if (libre) {
  const r = K.buscar(libre, { n: 6, escribiendo: false, explicar: true }), it = K.intencion(libre);
  console.log(`«${libre}» → intención ${JSON.stringify(it)}`);
  r.forEach((x, i) => console.log(`  ${i + 1}. ${x.s.toFixed(2)}  ${x.id}  (${x.tipo}) ${x.t}\n       ${x.por}`));
  const a = K.responder(libre); console.log(a ? `respuesta (${a.conf}): ${a.t}\n  ${a.r}` : 'sin respuesta directa');
  process.exit(0);
}
let top1 = 0, top3 = 0; const fallos = [];
for (const [q, esperado] of CASOS) {
  const r = K.buscar(q, { n: 3 }), ids = r.map(x => x.id);
  const i = ids.indexOf(esperado);
  if (i === 0) top1++; if (i >= 0) top3++;
  if (i !== 0) fallos.push(`  «${q}» → esperaba ${esperado}; salió ${ids.length ? ids.map((x, j) => `${j + 1}:${x}`).join(' ') : 'nada'}`);
  if (verboso) console.log(`${i === 0 ? 'ok ' : i > 0 ? 'top3' : 'XX '} «${q}» → ${ids[0] || '-'}`);
}
const n = CASOS.length;
console.log(`${n} consultas · primer lugar: ${top1} (${(top1 / n * 100).toFixed(0)} %) · entre las tres primeras: ${top3} (${(top3 / n * 100).toFixed(0)} %)`);
if (fallos.length) { console.log('No salieron primeras:'); fallos.forEach(f => console.log(f)); }
process.exit(top1 / n >= .9 ? 0 : 1);
