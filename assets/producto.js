/* =====================================================================
   Páginas de producto — una por tipo, sin plantilla repetida.
   Estructura (Cash App): tipo de producto → cifra principal → acciones
   → detalle → la lista que tiene sentido para ESE producto.
   ===================================================================== */
(function () {
  'use strict';

  function sens(v) { return '<span class="dw-s"><span class="dw-s__v">' + v + '</span><span class="dw-s__m" aria-hidden="true">••••</span></span>'; }
  var ACC_MOVS = [['Supermaxi', 'Hoy · 10:24', '-$ 48,30'], ['Sweet & Coffee', 'Hoy · 08:12', '-$ 4,75'], ['Transferencia recibida', 'Ayer · 15:03', '+$ 320,00'], ['Recarga transporte', 'Ayer · 19:40', '-$ 5,00']];
  var CARD_MOVS = [['Amazon', '6 oct', '-$ 42,90'], ['PedidosYa', '5 oct', '-$ 18,40'], ['Cinemark', '3 oct', '-$ 14,00']];

  var V = {
    'Cuenta Ahorro transaccional': { kind: 'Cuenta de ahorros ··7980', label: 'Saldo disponible', value: '$ 100,00', sub: 'Ganaste $ 0,42 de interés este mes',
      acts: [['send_money', 'Transferir', 'Transferir dinero'], ['call_received', 'Recibir', 'Recibir dinero'], ['receipt_long', 'Estado de cuenta', '']],
      rows: [['Tasa de interés', '1,25% anual'], ['Tipo', 'Ahorros · Sueldo']], listTitle: 'Movimientos', list: ACC_MOVS },
    'Cuenta Corriente': { kind: 'Cuenta corriente ··1234', label: 'Saldo disponible', value: '$ 1.440,35', sub: 'Gastaste $ 812,40 este mes',
      acts: [['send_money', 'Transferir', 'Transferir dinero'], ['bolt', 'Pagar servicios', 'Pagar servicios'], ['receipt_long', 'Estado de cuenta', '']],
      rows: [['Sobregiro disponible', '$ 500,00'], ['Chequera', 'Activa']], listTitle: 'Movimientos',
      list: [['Sueldo', '1 oct', '+$ 1.200,00'], ['Pago Diners Club', '28 sep', '-$ 150,00'], ['Empresa Eléctrica', '27 sep', '-$ 24,80']] },
    'Visa Débito': { kind: 'Visa Débito ··1234', label: 'Consumos del mes', value: '$ 312,45', sub: 'Se debitan de tu cuenta Sueldo',
      acts: [['lock', 'Bloquear', 'Tarjeta bloqueada'], ['tune', 'Ajustes', 'Ajustes de tarjeta'], ['speed', 'Límites', 'Límites']],
      rows: [['Compras por internet', 'Activas'], ['Retiros diarios', 'Hasta $ 500,00']], listTitle: 'Consumos', list: CARD_MOVS },
    'Mastercard Black': { kind: 'Mastercard Black ··7643', label: 'Saldo a pagar', value: '$ 15,00', sub: 'Pagas hasta el 5 de noviembre',
      acts: [['payments', 'Pagar', 'Pagar tarjeta'], ['tune', 'Ajustes', 'Ajustes de tarjeta'], ['flight', 'Salas VIP', 'Salas VIP']],
      rows: [['Cupo disponible', '$ 4.985,00 de $ 5.000,00'], ['Fecha de corte', '28 de cada mes'], ['Millas', '12.430']], listTitle: 'Consumos', list: CARD_MOVS },
    'Diners Club': { kind: 'Diners Club ··4863', label: 'Saldo a pagar', value: '$ 0,00', sub: 'No tienes pagos pendientes',
      acts: [['payments', 'Pagar', 'Pagar tarjeta'], ['tune', 'Ajustes', 'Ajustes de tarjeta']],
      rows: [['Cupo disponible', '$ 2.000,00'], ['Fecha de corte', '28 de cada mes']], listTitle: '', list: [] },
    'Tarjeta Movilidad': { kind: 'Tarjeta Movilidad', label: 'Saldo', value: '$ 8,50', sub: 'Te alcanza para unos 18 viajes',
      acts: [['add_card', 'Recargar', 'Recargar Movilidad'], ['directions_bus', 'Pagar pasaje', 'Pagar transporte']],
      rows: [['Uso', 'Metro, buses y peajes']], listTitle: 'Viajes',
      list: [['Metro · Quitumbe', 'Hoy · 07:42', '-$ 0,45'], ['Bus · Ecovía', 'Ayer · 18:10', '-$ 0,35'], ['Recarga', '2 oct', '+$ 10,00']] },
    'Préstamo de consumo': { kind: 'Préstamo de consumo', label: 'Te falta pagar', value: '$ 7.380,50', sub: 'De $ 9.000,00 · vas en la cuota 6 de 36', progress: .18,
      acts: [['payments', 'Pagar cuota', 'Pagar servicios'], ['savings', 'Abono extra', '']],
      rows: [['Próxima cuota', '$ 245,90 · 5 nov'], ['Tasa', '15,6% anual'], ['Plazo', '36 meses']], listTitle: 'Cuotas pagadas',
      list: [['Cuota 5', '5 oct', '$ 245,90'], ['Cuota 4', '5 sep', '$ 245,90'], ['Cuota 3', '5 ago', '$ 245,90']] },
    'Depósito a plazo': { kind: 'Depósito a plazo', label: 'Capital invertido', value: '$ 3.000,00', sub: 'Ganas $ 217,50 al 12 de noviembre',
      acts: [['autorenew', 'Renovar', ''], ['add', 'Nueva inversión', 'Crear inversión']],
      rows: [['Tasa', '7,25% anual'], ['Plazo', '360 días'], ['Vence', '12 nov 2026']], listTitle: '', list: [] },
    'Seguro de vida': { kind: 'Seguro de vida', label: 'Cobertura', value: '$ 20.000,00', sub: 'Pagas $ 12,90 al mes, débito automático',
      acts: [['description', 'Ver póliza', ''], ['support_agent', 'Reportar', 'Soporte']],
      rows: [['Beneficiarios', '2'], ['Renovación', '1 ene 2027']], listTitle: 'Pagos de prima',
      list: [['Prima octubre', '1 oct', '$ 12,90'], ['Prima septiembre', '1 sep', '$ 12,90'], ['Prima agosto', '1 ago', '$ 12,90']] },
    'Seguro de tarjetas': { kind: 'Seguro de tarjetas', label: 'Cobertura', value: 'Activa', text: true, sub: 'Fraude y clonación · $ 3,50 al mes',
      acts: [['description', 'Ver póliza', ''], ['support_agent', 'Reportar', 'Soporte']],
      rows: [['Tarjetas protegidas', 'Visa Débito, Mastercard Black'], ['Renovación', '15 mar 2027']], listTitle: '', list: [] }
  };

  function html(title) {
    var p = V[title];
    if (!p) return '';
    return '<div class="pv">' +
      '<p class="pv-kind">' + p.kind + '</p>' +
      '<p class="pv-label">' + p.label + '</p>' +
      '<p class="pv-value">' + (p.text ? p.value : sens(p.value)) + '</p>' +
      '<p class="pv-sub">' + p.sub + '</p>' +
      (p.progress ? '<div class="pv-bar" role="progressbar" aria-valuenow="' + Math.round(p.progress * 100) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + Math.round(p.progress * 100) + '%"></i></div>' : '') +
      '<div class="pv-acts">' + p.acts.map(function (a) {
        return '<button data-pv="' + a[2] + '" data-pv-label="' + a[1] + '"><span class="material-symbols-rounded">' + a[0] + '</span>' + a[1] + '</button>';
      }).join('') + '</div>' +
      '<section class="pv-sec"><h2>Detalle</h2>' + p.rows.map(function (r) { return '<div class="pv-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</section>' +
      (p.list.length ? '<section class="pv-sec"><h2>' + p.listTitle + '</h2>' + p.list.map(function (m) {
        return '<div class="pv-row pv-row--mov"><span><b>' + m[0] + '</b><small>' + m[1] + '</small></span><b class="' + (m[2][0] === '+' ? 'is-in' : '') + '">' + sens(m[2]) + '</b></div>';
      }).join('') + '</section>' : '') +
    '</div>';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pv]');
    if (!b) return;
    var a = b.dataset.pv;
    var el = a && (document.querySelector('#home-page [data-action="' + a + '"]') || document.querySelector('[data-action="' + a + '"]:not(.pv *)'));
    if (el) { document.getElementById('push-back') && document.getElementById('push-back').click(); setTimeout(function () { el.click(); }, 350); return; }
    var t = document.querySelector('.pf-toast');
    if (!t) { t = document.createElement('div'); t.className = 'pf-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = b.dataset.pvLabel + ': disponible pronto en este concept.';
    t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2400);
  });

  window.ProductView = { has: function (t) { return !!V[t]; }, html: html };
})();
