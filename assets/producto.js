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

  /* ---- Cuenta (transaccional / ahorros / corriente) ----
     Composición del concepto "Principal": bp-widget de saldo, bp-widget
     del mes (gastos/ingresos + barras diarias), bp-quick-actions-menu y
     bp-widget de últimos movimientos con bp-transaction-item. */
  var ACC_TX = [
    { n: 'Gabriela Maldonado', d: 'Transferencia directa recibida', ic: 'person', em: 'in', a: '+$ 2,00', date: 'Miércoles, 8 oct · 17:45', bal: '$ 1.906,04' },
    { n: 'Supermaxi', d: 'Pago con tarjeta de débito', ic: 'shopping_cart', a: '-$ 48,30', date: 'Martes, 7 oct · 19:30', bal: '$ 1.904,04' },
    { n: 'Empresa Eléctrica Quito', d: 'Pago de servicios', ic: 'bolt', a: '-$ 40,00', det: [['Comisión', '-$ 0,39'], ['IVA', '-$ 0,04']], date: 'Lunes, 6 oct · 10:15', bal: '$ 1.952,34' },
    { n: 'Amazon', d: 'Pago con tarjeta de débito', ic: 'shopping_bag', a: '-$ 350,00', det: [['Consumos exterior', '-$ 10,00'], ['IVA', '-$ 1,50']], date: 'Domingo, 5 oct · 14:20', bal: '$ 1.992,77' },
    { n: 'Cuenta de ahorro', d: 'Transferencia entre cuentas propias', ic: 'savings', em: 'swap', a: '-$ 160,00', date: 'Sábado, 4 oct · 09:10', bal: '$ 2.354,27' }
  ];
  var A = {
    'Cuenta PRINCIPAL': { title: 'Principal', balance: '$ 1.906,04', book: '$ 1.912,30', type: 'Cuenta transaccional', nro: '2203457890',
      out: '$ 1.093,12', inc: '$ 1.320,00', pct: 17, bars: [32, 58, 14, 46, 0, 0, 0, 100, 44, 0], tx: ACC_TX },
    'Cuenta Ahorro transaccional': { title: 'Ahorro transaccional', balance: '$ 100,00', book: '$ 100,00', type: 'Cuenta de ahorros', nro: '2203457980',
      out: '$ 20,00', inc: '$ 120,42', pct: 83, bars: [0, 20, 0, 0, 0, 0, 0, 0, 0, 0],
      tx: [{ n: 'Cuenta Principal', d: 'Transferencia entre cuentas propias', ic: 'account_balance_wallet', em: 'in', a: '+$ 120,00', date: 'Viernes, 3 oct · 08:00', bal: '$ 100,00' },
           { n: 'Interés ganado', d: 'Abono mensual', ic: 'percent', em: 'in', a: '+$ 0,42', date: 'Martes, 30 sep · 23:59', bal: '$ 99,58' }] },
    'Cuenta Corriente': { title: 'Corriente', balance: '$ 1.440,35', book: '$ 1.452,10', type: 'Cuenta corriente', nro: '2203451234',
      out: '$ 812,40', inc: '$ 1.200,00', pct: 32, bars: [70, 0, 22, 0, 100, 18, 0, 34, 0, 12],
      tx: [{ n: 'Sueldo', d: 'Transferencia directa recibida', ic: 'work', em: 'in', a: '+$ 1.200,00', date: 'Miércoles, 1 oct · 07:00', bal: '$ 1.440,35' },
           { n: 'Diners Club', d: 'Pago de tarjeta', ic: 'credit_card', a: '-$ 150,00', date: 'Domingo, 28 sep · 12:30', bal: '$ 240,35' },
           { n: 'Empresa Eléctrica Quito', d: 'Pago de servicios', ic: 'bolt', a: '-$ 24,80', det: [['Comisión', '-$ 0,39']], date: 'Sábado, 27 sep · 09:15', bal: '$ 390,35' }] }
  };
  var ACC_ACTS = [['attach_money', 'Pagar', 'Pagar servicios'], ['sync_alt', 'Mover', 'Transferir dinero'], ['receipt_long', 'Débitos', ''], ['more_horiz', 'Más', 'Más acciones']];
  function ms(n) { return '<span class="material-symbols-rounded" aria-hidden="true">' + n + '</span>'; }
  function money(v) { return sens(v); }
  function accountHtml(p) {
    var max = Math.max.apply(null, p.bars) || 1;
    var bars = p.bars.map(function (b, i) {
      return '<li><i style="height:' + Math.max(b ? 6 : 0, Math.round(b / max * 100)) + '%"></i><span>' + (i === p.bars.length - 1 ? 'hoy' : i + 1) + '</span></li>';
    }).join('');
    var tx = p.tx.map(function (t) {
      var pos = t.a[0] === '+';
      return '<li class="pv-tx">' +
        '<span class="pv-tx__av">' + ms(t.ic) + (t.em ? '<span class="pv-tx__em pv-tx__em--' + t.em + '">' + ms(t.em === 'in' ? 'arrow_upward' : 'sync_alt') + '</span>' : '') + '</span>' +
        '<span class="pv-tx__body">' +
          '<span class="pv-tx__row"><b class="pv-tx__name">' + t.n + '</b><b class="pv-tx__amt' + (pos ? ' is-in' : '') + '">' + money(t.a) + '</b></span>' +
          '<span class="pv-tx__desc">' + t.d + '</span>' +
          (t.det ? '<span class="pv-tx__det">' + t.det.map(function (d) { return '<span><span>' + d[0] + '</span><span>' + money(d[1]) + '</span></span>'; }).join('') + '</span>' : '') +
          '<span class="pv-tx__foot"><span>' + t.date + '</span><span>' + money(t.bal) + '</span></span>' +
        '</span></li>';
    }).join('');
    return '<div class="pv pv--account">' +
      '<h1 class="pv-title">' + p.title + '</h1>' +
      '<section class="pv-card pv-balance">' +
        '<p class="pv-balance__value">' + money(p.balance) + '</p>' +
        '<p class="pv-balance__book">Saldo contable: ' + money(p.book) + '</p>' +
        '<div class="pv-balance__acc"><span><b>' + p.type + '</b><small>Nro. ' + p.nro + '</small></span>' +
          '<button class="bp-action-button bp-action-button--icon-left" data-size="sm" data-pv="" data-pv-label="Compartir número">' + ms('share') + 'Compartir número</button></div>' +
      '</section>' +
      '<section class="pv-card pv-month" aria-label="Resumen del mes">' +
        '<div class="pv-month__head">' +
          '<span class="pv-month__stat"><small>Gastos del mes</small><b><span class="pv-dot pv-dot--out">' + ms('arrow_downward') + '</span>' + money(p.out) + '</b></span>' +
          '<span class="pv-month__stat"><small>Ingresos del mes</small><b><span class="pv-dot pv-dot--in">' + ms('arrow_upward') + '</span>' + money(p.inc) + '</b></span>' +
          '<button class="pv-month__ring" data-pv="Modo finanzas" data-pv-label="Mis finanzas" aria-label="Ahorraste el ' + p.pct + '% de tus ingresos. Ver Mis finanzas" style="--p:' + p.pct + '"><span class="pv-ring" aria-hidden="true">' + p.pct + '%</span>' + ms('chevron_right') + '</button>' +
        '</div>' +
        '<ol class="pv-bars" aria-label="Gastos por día">' + bars + '</ol>' +
      '</section>' +
      '<section class="pv-card pv-acts-card"><div class="pv-acts">' + ACC_ACTS.map(function (a) {
        return '<button data-pv="' + a[2] + '" data-pv-label="' + a[1] + '"><span class="material-symbols-rounded">' + a[0] + '</span>' + a[1] + '</button>';
      }).join('') + '</div></section>' +
      '<section class="pv-card pv-movs">' +
        '<div class="pv-movs__head"><h2>Últimos movimientos</h2><button class="bp-navigation-button" data-pv="" data-pv-label="Buscar movimientos" aria-label="Buscar movimientos">' + ms('search') + '</button></div>' +
        '<ul class="pv-tx-list">' + tx + '</ul>' +
        '<button class="pv-more" data-pv="" data-pv-label="Todos los movimientos">Ver todos los movimientos' + ms('chevron_right') + '</button>' +
      '</section>' +
    '</div>';
  }

  function html(title) {
    var p = V[title];
    if (!p) return A[title] ? accountHtml(A[title]) : '';
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

  window.ProductView = { has: function (t) { return !!V[t] || !!A[t]; }, isAccount: function (t) { return !!A[t]; }, title: function (t) { return A[t] ? A[t].title : t; }, html: html };
})();
