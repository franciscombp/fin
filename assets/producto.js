/* =====================================================================
   Páginas de producto — una por tipo, sin plantilla repetida.
   Cada tipo de cuenta tiene su propio diseño (conceptos de Figma):
   · ahorro    → Ahorro flexible: interés del mes + gráfico de línea
   · meta      → Meta de ahorro: progreso contra el objetivo
   · corriente → Cuenta corriente: saldo, estados de cuenta y chequera
   Tarjeta de crédito: Próximo estado de cuenta y Cupos (anillo de deuda).
   ===================================================================== */
(function () {
  'use strict';

  function sens(v) { return '<span class="dw-s"><span class="dw-s__v">' + v + '</span><span class="dw-s__m" aria-hidden="true">••••</span></span>'; }
  function money(v) { return sens(v); }
  function ms(n) { return '<span class="material-symbols-rounded" aria-hidden="true">' + n + '</span>'; }
  function din(n) { return '$ ' + Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function entero(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  var ACC_MOVS = [['Supermaxi', 'Hoy · 10:24', '-$ 48,30'], ['Sweet & Coffee', 'Hoy · 08:12', '-$ 4,75'], ['Transferencia recibida', 'Ayer · 15:03', '+$ 320,00'], ['Recarga transporte', 'Ayer · 19:40', '-$ 5,00']];
  var CARD_MOVS = [['Amazon', '6 oct', '-$ 42,90'], ['PedidosYa', '5 oct', '-$ 18,40'], ['Cinemark', '3 oct', '-$ 14,00']];

  /* ---- Productos de tarjeta (detalle sencillo) ---- */
  var V = {
    'Visa Débito': { kind: 'Visa Débito ··1234', label: 'Consumos del mes', value: '$ 312,45', sub: 'Se debitan de tu cuenta Sueldo',
      acts: [['lock', 'Bloquear', 'Tarjeta bloqueada'], ['tune', 'Ajustes', 'Ajustes de tarjeta'], ['speed', 'Límites', 'Límites']],
      rows: [['Compras por internet', 'Activas'], ['Retiros diarios', 'Hasta $ 500,00']], listTitle: 'Consumos', list: CARD_MOVS },
    'Mastercard Black': { kind: 'Mastercard Black ··7643', label: 'Saldo a pagar', value: '$ 15,00', sub: 'Pagas hasta el 5 de noviembre',
      acts: [['payments', 'Pagar', 'Pagar tarjeta'], ['tune', 'Ajustes', 'Ajustes de tarjeta'], ['flight', 'Salas VIP', 'Salas VIP']],
      rows: [['Cupo disponible', '$ 4.985,00 de $ 5.000,00'], ['Fecha de corte', '28 de cada mes'], ['Millas', '12.430']], listTitle: 'Consumos', list: CARD_MOVS,
      // Enlaces a las pantallas de estado de cuenta y cupo de la tarjeta de crédito
      enlaces: [['Próximo estado de cuenta', 'Ver próximo estado de cuenta'], ['Cupos de tu Black Miles', 'Ver detalle de tu cupo']] },
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

  /* ---- Cuentas de la demo: tipo de diseño + datos del concepto ---- */
  var ACC_TX = [
    { n: 'Gabriela Maldonado', d: 'Transferencia directa recibida', ic: 'person', em: 'in', a: '+$ 2,00', date: 'Miércoles, 8 oct · 17:45', bal: '$ 1.906,04' },
    { n: 'Supermaxi', d: 'Pago con tarjeta de débito', ic: 'shopping_cart', a: '-$ 48,30', date: 'Martes, 7 oct · 19:30', bal: '$ 1.904,04' },
    { n: 'Empresa Eléctrica Quito', d: 'Pago de servicios', ic: 'bolt', a: '-$ 40,00', det: [['Comisión', '-$ 0,39'], ['IVA', '-$ 0,04']], date: 'Lunes, 6 oct · 10:15', bal: '$ 1.952,34' }
  ];
  var A = {
    'Cuenta PRINCIPAL': { diseno: 'corriente', title: 'Principal', balance: '$ 1.906,04', book: '$ 1.912,30', type: 'Cuenta transaccional', nro: '2203457890', tx: ACC_TX },
    'Cuenta Ahorro transaccional': { diseno: 'ahorro', title: 'Ahorro transaccional', balance: '$ 100,00', book: '$ 100,00', type: 'Cuenta de ahorros', nro: '2203457980', saldo: 100, tasa: 1.5,
      tx: movsAhorro(100) },
    'Cuenta Corriente': { diseno: 'corriente', title: 'Corriente', balance: '$ 1.440,35', book: '$ 1.452,10', type: 'Cuenta corriente', nro: '2203451234',
      tx: [{ n: 'Sueldo', d: 'Transferencia directa recibida', ic: 'work', em: 'in', a: '+$ 1.200,00', date: 'Miércoles, 1 oct · 07:00', bal: '$ 1.440,35' },
           { n: 'Diners Club', d: 'Pago de tarjeta', ic: 'credit_card', a: '-$ 150,00', date: 'Domingo, 28 sep · 12:30', bal: '$ 240,35' },
           { n: 'Empresa Eléctrica Quito', d: 'Pago de servicios', ic: 'bolt', a: '-$ 24,80', det: [['Comisión', '-$ 0,39']], date: 'Sábado, 27 sep · 09:15', bal: '$ 390,35' }] }
  };

  /* ---- Tarjeta de crédito: Próximo estado de cuenta y Cupos (conceptos) ---- */
  var TC = {
    estimado: '$ 1.987,90', periodo: { inicio: '5 mar. 2026', corte: '4 abr. 2026' },
    actual: [120, 124, 131, 136, 142, 150, 168, 171, 185, 214, 302, 360, 390],
    anterior: [60, 66, 75, 82, 86, 92, 130, 182, 198, 220, 300, 340, 360],
    saldoAnterior: '$ 200,00', consumos: '$ 983,00', corrientes: '$ 203,00', diferidos: '$ 780,00', diferidoFacturar: '$ 20.677,00',
    deuda: 7783.90, saldoCorte: 1906.00, totalDiferidos: 4890.00, consumosHoy: 987.90, disponible: '$ 12.216,91', aprobado: '$ 40.000,00'
  };

  /* ---- Generadores para cuentas de la persona activa (sin datos de concepto) ---- */
  function cuentaDesdeFila(r) {
    var diseno = r.tipo === 'meta' ? 'meta' : r.tipo === 'ahorro' ? 'ahorro' : 'corriente';
    return { title: r.kind, balance: r.value, book: r.value, nro: r.numero || '', type: r.tipo === 'ahorro' ? 'Cuenta de ahorros' : 'Cuenta transaccional',
      saldo: Number(r.saldoNum) || 0, meta: Number(r.meta) || 0, tasa: 1.5, diseno: diseno, tx: [] };
  }
  function movsAhorro(saldo) {
    var grupos = ['Hoy, 12 de abril', 'Jueves, 9 de abril', 'Miércoles, 8 de abril', 'Martes, 7 de abril', 'Lunes, 6 de abril'];
    return grupos.map(function (g, i) {
      return { grupo: g, n: 'Interés a su favor', d: '', ic: 'trending_up', em: 'in', a: '+$ 0,08', bal: din(saldo - 0.08 * i) };
    });
  }
  function movsMeta(ahorrado) {
    return [
      { n: 'Interés a su favor', d: '', ic: 'trending_up', em: 'in', a: '+$ 1,87', date: 'Viernes, 12 abr · 17:45', bal: din(ahorrado) },
      { n: 'Cuenta transaccional', d: 'Aporte automático', ic: 'handshake', em: 'in', a: '+$ 30,00', date: 'Sábado, 4 abr · 09:10', bal: din(ahorrado - 1.87) }
    ];
  }

  /* ---- Gráficos (SVG con viewBox: se escalan sin deformarse) ---- */
  function trazo(vals, w, h, min, max) {
    var n = vals.length;
    var pts = vals.map(function (v, i) { return [(i / (n - 1)) * w, h - ((v - min) / ((max - min) || 1)) * h]; });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    return { d: d, area: d + ' L' + w + ' ' + h + ' L0 ' + h + ' Z', pts: pts, last: pts[n - 1] };
  }

  // Ahorro: interés con líneas de referencia y punto final
  function graficoAhorro(saldo) {
    var vals = [saldo - 9.2, saldo - 8.1, saldo - 7.2, saldo - 6.4, saldo - 5.6, saldo - 4.9, saldo - 4.1, saldo - 3.2, saldo - 2.2, saldo - 1.1, saldo];
    var min = saldo - 14, max = saldo + 4, w = 320, h = 120;
    var t = trazo(vals, w, h, min, max);
    var lineas = [max, (max + min) / 2, min].map(function (v) {
      var y = h - ((v - min) / (max - min)) * h;
      return '<line x1="0" x2="' + w + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" class="pv-chart__grid"/>' +
        '<text x="-6" y="' + (y + 4).toFixed(1) + '" text-anchor="end" class="pv-chart__eje">' + entero(v) + '</text>';
    }).join('');
    return '<svg class="pv-chart" viewBox="-44 -6 364 ' + (h + 26) + '" role="img" aria-label="Interés acumulado este mes">' +
      '<defs><linearGradient id="pvAhorroG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--bp-theme-color-data-positive)" stop-opacity=".28"/><stop offset="1" stop-color="var(--bp-theme-color-data-positive)" stop-opacity="0"/></linearGradient></defs>' +
      lineas +
      '<path d="' + t.area + '" fill="url(#pvAhorroG)"/>' +
      '<path d="' + t.d + '" class="pv-chart__linea pv-chart__linea--pos"/>' +
      '<circle cx="' + t.last[0].toFixed(1) + '" cy="' + t.last[1].toFixed(1) + '" r="5" class="pv-chart__punto"/>' +
      '</svg>' +
      '<div class="pv-chart__ejex">' + ['4 mar', '11 mar', '18 mar', '25 mar', '1 abr', 'Hoy'].map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div>';
  }

  // Meta: lo ahorrado (sólido) contra la ruta ideal hasta el objetivo (punteada)
  function graficoMeta(ahorrado, objetivo) {
    var vals = [0, .05, .09, .14, .2, .27, .35, .45, .55, .66, .78, 1].map(function (f) { return ahorrado * f; });
    var w = 320, h = 150, min = 0, max = Math.max(objetivo, ahorrado) * 1.05;
    var t = trazo(vals, w, h, min, max);
    var ideal = trazo([0, objetivo], w, h, min, max);
    var fin = ideal.last;
    return '<svg class="pv-chart pv-chart--meta" viewBox="-6 -20 332 ' + (h + 40) + '" role="img" aria-label="Avance hacia tu meta">' +
      '<defs><linearGradient id="pvMetaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--bp-theme-color-brand-main, #ffdd00)" stop-opacity=".45"/><stop offset="1" stop-color="var(--bp-theme-color-brand-main, #ffdd00)" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + ideal.d + '" class="pv-chart__ideal"/>' +
      '<path d="' + t.area + '" fill="url(#pvMetaG)"/>' +
      '<path d="' + t.d + '" class="pv-chart__linea pv-chart__linea--meta"/>' +
      '<circle cx="' + t.last[0].toFixed(1) + '" cy="' + t.last[1].toFixed(1) + '" r="6" class="pv-chart__punto pv-chart__punto--meta"/>' +
      '<g transform="translate(' + fin[0].toFixed(1) + ' ' + (fin[1] - 14).toFixed(1) + ')"><circle r="12" class="pv-chart__bandera"/><text y="5" text-anchor="middle" class="pv-chart__icono">⚑</text></g>' +
      '</svg>';
  }

  // Estado de cuenta: periodo actual (sólido) contra el anterior (punteado), con marca de hoy
  function graficoEstado() {
    var w = 320, h = 110, min = 0, max = 400;
    var a = trazo(TC.actual, w, h, min, max), b = trazo(TC.anterior, w, h, min, max);
    var hoy = a.pts[9];
    return '<svg class="pv-chart pv-chart--estado" viewBox="-4 -6 328 ' + (h + 12) + '" role="img" aria-label="Consumos del periodo">' +
      '<defs><linearGradient id="pvEstadoG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d6cdf" stop-opacity=".28"/><stop offset="1" stop-color="#2d6cdf" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + b.d + '" class="pv-chart__ideal"/>' +
      '<path d="' + a.area + '" fill="url(#pvEstadoG)"/>' +
      '<path d="' + a.d + '" class="pv-chart__linea pv-chart__linea--azul"/>' +
      '<circle cx="' + hoy[0].toFixed(1) + '" cy="' + hoy[1].toFixed(1) + '" r="5" class="pv-chart__punto pv-chart__punto--azul"/>' +
      '</svg>';
  }

  // Cupo: anillo de deuda con tres tramos (saldo a pagar, diferidos, consumos)
  function anillo() {
    var r = 80, c = 2 * Math.PI * r, total = TC.deuda, usado = 0;
    var tramos = [[TC.saldoCorte, 'rojo'], [TC.totalDiferidos, 'naranja'], [TC.consumosHoy, 'azul']];
    var arcos = tramos.map(function (t) {
      var largo = (t[0] / total) * c - 6, off = -(usado / total) * c;
      usado += t[0];
      return '<circle r="' + r + '" cx="100" cy="100" class="pv-anillo__tramo pv-anillo__tramo--' + t[1] + '" stroke-dasharray="' + Math.max(largo, 0).toFixed(1) + ' ' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>';
    }).join('');
    return '<div class="pv-anillo"><svg viewBox="0 0 200 200" aria-hidden="true">' +
      '<circle r="' + r + '" cx="100" cy="100" class="pv-anillo__base"/>' + arcos + '</svg>' +
      '<div class="pv-anillo__centro"><small>Valor total de la deuda</small>' + money(din(total)) + '</div></div>';
  }

  /* ---- Piezas comunes ---- */
  function acciones(lista, clase) {
    return '<div class="pv-acts ' + (clase || '') + '">' + lista.map(function (a) {
      return '<button data-pv="' + a[2] + '" data-pv-label="' + a[1] + '"><span class="material-symbols-rounded">' + a[0] + '</span>' + a[1] + '</button>';
    }).join('') + '</div>';
  }
  function movimientos(titulo, lista) {
    if (!lista.length) return '<section class="pv-card pv-movs"><div class="pv-movs__head"><h2>' + titulo + '</h2></div><p class="pv-vacio">Aún no tienes movimientos.</p></section>';
    var grupos = [], actual = null;
    lista.forEach(function (t) {
      if (t.grupo && (!actual || actual.titulo !== t.grupo)) { actual = { titulo: t.grupo, items: [] }; grupos.push(actual); }
      if (!actual) { actual = { titulo: '', items: [] }; grupos.push(actual); }
      actual.items.push(t);
    });
    var html = grupos.map(function (g) {
      return (g.titulo ? '<p class="pv-grupo">' + g.titulo + '</p>' : '') + '<ul class="pv-tx-list">' + g.items.map(txHtml).join('') + '</ul>';
    }).join('');
    return '<section class="pv-card pv-movs">' +
      '<div class="pv-movs__head"><h2>' + titulo + '</h2><button class="bp-navigation-button" data-pv="" data-pv-label="Buscar movimientos" aria-label="Buscar movimientos">' + ms('search') + '</button></div>' +
      '<div class="pv-movs__lista">' + html + '</div>' +
      '<button class="pv-more" data-pv="" data-pv-label="Todos los movimientos">Ver todos los movimientos' + ms('chevron_right') + '</button>' +
      '</section>';
  }
  function txHtml(t) {
    var pos = t.a[0] === '+';
    return '<li class="pv-tx">' +
      '<span class="pv-tx__av">' + ms(t.ic) + (t.em ? '<span class="pv-tx__em pv-tx__em--' + t.em + '">' + ms(t.em === 'in' ? 'arrow_upward' : 'sync_alt') + '</span>' : '') + '</span>' +
      '<span class="pv-tx__body">' +
        '<span class="pv-tx__row"><b class="pv-tx__name">' + t.n + '</b><b class="pv-tx__amt' + (pos ? ' is-in' : '') + '">' + money(t.a) + '</b></span>' +
        (t.d ? '<span class="pv-tx__desc">' + t.d + '</span>' : '') +
        (t.det ? '<span class="pv-tx__det">' + t.det.map(function (d) { return '<span><span>' + d[0] + '</span><span>' + money(d[1]) + '</span></span>'; }).join('') + '</span>' : '') +
        '<span class="pv-tx__foot">' + (t.date ? '<span>' + t.date + '</span>' : '<span></span>') + '<span>' + money(t.bal) + '</span></span>' +
      '</span></li>';
  }
  function encabezado(nombre) { return '<h1 class="pv-title">' + nombre + '</h1>'; }

  /* ---- Diseño: Ahorro flexible ---- */
  function ahorroHtml(p) {
    var saldo = p.saldo || 0, tasa = p.tasa || 1.5;
    var mes = Math.round(saldo * tasa / 100 / 12 * 100) / 100;
    var movs = p.tx.length ? p.tx : movsAhorro(saldo);
    return '<div class="pv pv--account pv--ahorro">' +
      encabezado(p.title) +
      '<section class="pv-card pv-balance">' +
        '<p class="pv-balance__value">' + money(p.balance) + '</p>' +
        '<p class="pv-balance__book">Saldo contable: ' + money(p.book) + '</p>' +
        '<div class="pv-balance__acc"><span><b>' + p.type + '</b><small>Nro. ' + p.nro + '</small></span>' +
          '<button class="bp-action-button bp-action-button--icon-left" data-size="sm" data-pv="" data-pv-label="Compartir número">' + ms('share') + 'Compartir número</button></div>' +
      '</section>' +
      '<section class="pv-card pv-interes">' +
        '<div class="pv-interes__stats">' +
          '<div><small>Interés mes anterior:</small><b>' + money(din(mes * 0.9)) + ' <span class="pv-sube">' + ms('arrow_upward') + '</span></b></div>' +
          '<div><small>Interés este mes:</small><b>' + money(din(mes)) + '</b></div>' +
          '<span class="pv-interes__planta" aria-hidden="true">' + ms('potted_plant') + '</span>' +
        '</div>' +
        graficoAhorro(saldo) +
      '</section>' +
      '<section class="pv-card pv-acts-card">' + acciones([['arrow_upward', 'Aportar', 'Aportar a ahorro'], ['arrow_downward', 'Retirar', 'Retirar sin tarjeta'], ['settings', 'Configurar', 'Configurar cuenta']]) + '</section>' +
      movimientos('Últimos movimientos', movs) +
    '</div>';
  }

  /* ---- Diseño: Meta de ahorro ---- */
  function metaHtml(p) {
    var ahorrado = p.saldo || 0, objetivo = p.meta || 1, pct = Math.min(100, Math.round(ahorrado / objetivo * 100));
    var rango = '1 ene 2026', fin = '31 dic 2026';
    return '<div class="pv pv--account pv--meta">' +
      '<div class="pv-meta__head"><h1 class="pv-title">' + p.title + '</h1><span class="pv-meta__chip">Meta ' + money(din(objetivo)) + '</span></div>' +
      '<section class="pv-card pv-meta">' +
        '<p class="pv-meta__label">Tu ahorro actual</p>' +
        '<p class="pv-meta__valor">' + money(p.balance) + '</p>' +
        '<p class="pv-meta__pct">' + pct + '% de tu meta</p>' +
        graficoMeta(ahorrado, objetivo) +
        '<div class="pv-meta__ejex"><span><small>Inicio</small>' + rango + '</span><span><small>Fin</small>' + fin + '</span></div>' +
      '</section>' +
      '<section class="pv-card pv-meta__stats">' +
        '<div><small>Capital</small><b>' + money(din(ahorrado)) + '</b></div>' +
        '<div><small>Interés ganado</small><b>' + money(din(ahorrado * 0.0014)) + '</b></div>' +
        '<div><small>Tasa efectiva</small><b>7%</b></div>' +
      '</section>' +
      '<section class="pv-card pv-acts-card">' + acciones([['arrow_upward', 'Aportar', 'Aportar a ahorro'], ['autorenew', 'Automatizaciones', 'Automatizaciones'], ['settings', 'Configurar', 'Configurar meta']]) + '</section>' +
      movimientos('Últimos movimientos', movsMeta(ahorrado)) +
    '</div>';
  }

  /* ---- Diseño: Cuenta corriente (incluye el aviso de inactividad) ---- */
  function corrienteHtml(p) {
    var aviso = p.inactiva ? '<section class="pv-card pv-aviso">' +
        '<div class="pv-aviso__linea" aria-hidden="true"><span>4 mar</span><span>1 abr</span><span>Hoy</span><i></i></div>' +
        '<h2>¿Aún usas esta cuenta?</h2>' +
        '<p>Tu cuenta lleva ' + p.inactiva.dias + ' días sin movimientos. ¿La sigues necesitando? Si es así, haz un movimiento antes del ' + p.inactiva.fecha + ' para mantenerla activa.</p>' +
        '<div class="pv-aviso__acts"><button class="pv-aviso__sec" data-pv="" data-pv-label="Cerrar cuenta">Cerrar cuenta</button><button class="pv-aviso__pri" data-pv="" data-pv-label="Mantener cuenta">Mantener cuenta</button></div>' +
      '</section>' : '';
    return '<div class="pv pv--account pv--corriente">' +
      encabezado(p.title) +
      '<section class="pv-card pv-balance">' +
        '<p class="pv-balance__value">' + money(p.balance) + '</p>' +
        '<p class="pv-balance__book">Saldo contable: ' + money(p.book) + '</p>' +
        '<div class="pv-balance__acc"><span><b>' + p.type + '</b><small>Nro. ' + p.nro + '</small></span>' +
          '<button class="bp-action-button bp-action-button--icon-left" data-size="sm" data-pv="" data-pv-label="Compartir número">' + ms('share') + 'Compartir número</button></div>' +
      '</section>' +
      aviso +
      '<section class="pv-card pv-acts-card">' + acciones([['description', 'Estados de cuenta', 'Estados de cuenta'], ['receipt', 'Chequera', 'Chequera'], ['settings', 'Configurar cuenta', 'Configurar cuenta']]) + '</section>' +
      movimientos('Últimos movimientos', p.tx) +
    '</div>';
  }

  /* ---- Tarjeta de crédito: próximo estado de cuenta ---- */
  function estadoHtml() {
    return '<div class="pv pv--tc pv--estado">' +
      '<h1 class="pv-title">Próximo estado de cuenta</h1>' +
      '<section class="pv-card pv-estado">' +
        '<div class="pv-estado__head"><div><small>Estimado a pagar</small><b>' + money(TC.estimado) + '</b></div>' +
          '<ul class="pv-leyenda"><li><i class="is-azul"></i>Periodo actual</li><li><i class="is-hueco"></i>Periodo anterior</li></ul></div>' +
        '<div class="pv-estado__grafico"><span class="pv-tip" style="left:' + (100 * 9 / 12).toFixed(1) + '%">Hoy, 13 mar.</span>' + graficoEstado() + '</div>' +
        '<div class="pv-estado__fechas"><span><small>Inicio del periodo</small>' + TC.periodo.inicio + '</span><span class="is-der"><small>Fecha de corte</small>' + TC.periodo.corte + '</span></div>' +
      '</section>' +
      '<section class="pv-card pv-acts-card">' + acciones([['schedule', 'Diferir consumos', 'Diferir consumos'], ['history', 'Refinanciar deuda', 'Refinanciar deuda'], ['credit_card', 'Prepagar diferidos', 'Prepagar diferidos']]) + '</section>' +
      '<h2 class="pv-tc-h">Detalles del próximo corte</h2>' +
      '<section class="pv-corte"><div class="pv-corte__fila"><b>Saldo periodo anterior</b><span>' + money(TC.saldoAnterior) + '</span></div>' +
        '<p>Este saldo está pendiente de pago, si no lo pagas antes del 15 de marzo, se añadirá a tu próximo estado de cuenta y generará intereses.</p></section>' +
      '<section class="pv-corte"><div class="pv-corte__fila"><b>Consumos hasta la fecha</b><span>' + money(TC.consumos) + '</span></div>' +
        '<p>Es lo que has gastado en el periodo actual 5 mar. 2026 - 5 abr. 2026, antes de la fecha de corte</p>' +
        '<div class="pv-row"><span>Consumos corrientes</span><b>' + money(TC.corrientes) + '</b></div>' +
        '<div class="pv-row"><span>Cuotas de diferidos</span><b>' + money(TC.diferidos) + '</b></div>' +
        '<button class="pv-enlace" data-pv="" data-pv-label="Detalle de movimientos">Ver detalle de movimientos' + ms('chevron_right') + '</button></section>' +
      '<h2 class="pv-tc-h">Consumos diferidos</h2>' +
      '<section class="pv-corte"><div class="pv-corte__fila"><b>Saldo diferido a facturar</b><span>' + money(TC.diferidoFacturar) + '</span></div>' +
        '<p>Son compras que pagarás divididas en cuotas (con o sin interés). No incluye compras con meses de gracia que aún no reflejen en tu estado de cuenta.</p>' +
        '<button class="pv-enlace" data-pv="" data-pv-label="Detalle de diferidos">Ver detalle de diferidos' + ms('chevron_right') + '</button></section>' +
    '</div>';
  }

  /* ---- Tarjeta de crédito: detalle de cupo ---- */
  function cupoHtml() {
    var fila = function (color, nombre, monto, desc, enlace, destino) {
      return '<section class="pv-corte">' +
        '<div class="pv-corte__fila"><span class="pv-punto" style="background:' + color + '"></span><b>' + nombre + '</b><span>' + money(monto) + '</span></div>' +
        '<p>' + desc + '</p>' +
        (enlace ? '<button class="pv-enlace" data-pv-go="' + destino + '" data-pv-label="' + enlace + '">' + enlace + ms('chevron_right') + '</button>' : '') +
        '</section>';
    };
    return '<div class="pv pv--tc pv--cupo">' +
      '<h1 class="pv-title">Cupos de tu Black Miles</h1>' +
      anillo() +
      '<h2 class="pv-tc-h">Detalle de tu cupo</h2>' +
      fila('var(--pv-rojo)', 'Saldo a pagar del corte', '$ 1.906,00', 'Es el valor que debes pagar en tu tarjeta este mes para no generar intereses adicionales y no caer en mora.', 'Ver estado de cuenta', 'Próximo estado de cuenta') +
      fila('var(--pv-naranja)', 'Total de diferidos', '$ 4.890,00', 'Compras que pagarás divididas en cuotas. No incluye compras con meses de gracia que aún no han comenzado a facturarse.', 'Ver consumos diferidos', 'Próximo estado de cuenta') +
      fila('var(--pv-azul)', 'Consumos hasta la fecha', '$ 987,90', 'Es lo que has gastado en el periodo actual (este mes), antes de la fecha de corte.', 'Ver próximo estado de cuenta', 'Próximo estado de cuenta') +
      '<section class="pv-corte"><div class="pv-corte__fila"><span class="pv-punto pv-punto--gris"></span><b>Cupo disponible</b><span>' + money(TC.disponible) + '</span></div>' +
        '<p>Es el dinero del cupo aprobado que no has utilizado con tu tarjeta. Se disminuye con cada compra y se libera con cada pago.</p></section>' +
      '<section class="pv-card pv-corte__aprobado"><b>Cupo aprobado:</b><span>' + money(TC.aprobado) + '</span></section>' +
      '<section class="pv-card pv-acts-card">' + acciones([['block', 'Pre-cancelar diferidos', 'Prepagar diferidos'], ['history', 'Refinanciar deuda', 'Refinanciar deuda'], ['schedule', 'Diferir consumos', 'Diferir consumos'], ['description', 'Estados de cuenta', 'Estados de cuenta']]) + '</section>' +
      '<section class="pv-oferta"><div><span>Ofertas exclusivas con tus tarjetas</span><button class="pv-enlace" data-pv="" data-pv-label="Ver ofertas">Ver ofertas' + ms('chevron_right') + '</button></div>' + ms('redeem') + '</section>' +
    '</div>';
  }

  var PAGINAS = {
    'Próximo estado de cuenta': estadoHtml,
    'Cupos de tu Black Miles': cupoHtml
  };

  // Productos de cada persona (hubs): la página se arma con la fila que pintó el hub
  var R = {};
  function datosCuenta(title) {
    if (A[title]) return A[title];
    var r = R[title];
    return r && r.cuenta ? cuentaDesdeFila(r) : null;
  }
  function html(title) {
    if (PAGINAS[title]) return PAGINAS[title]();
    var cuenta = datosCuenta(title);
    if (cuenta) {
      if (cuenta.diseno === 'meta') return metaHtml(cuenta);
      if (cuenta.diseno === 'ahorro') return ahorroHtml(cuenta);
      return corrienteHtml(cuenta);
    }
    var p = V[title] || R[title];
    if (!p) return '';
    // Mismo lenguaje que la cuenta: título, tarjeta de saldo, acciones, detalle y lista en tarjetas
    var filas = function (rs) { return rs.map(function (r) { return '<div class="pv-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join(''); };
    return '<div class="pv pv--account pv--generico">' +
      encabezado(p.kind) +
      '<section class="pv-card pv-balance">' +
        '<p class="pv-balance__book">' + p.label + '</p>' +
        '<p class="pv-balance__value">' + (p.text ? p.value : sens(p.value)) + '</p>' +
        (p.sub ? '<p class="pv-balance__book">' + p.sub + '</p>' : '') +
        (p.progress ? '<div class="pv-bar" role="progressbar" aria-valuenow="' + Math.round(p.progress * 100) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + Math.round(p.progress * 100) + '%"></i></div>' : '') +
      '</section>' +
      (p.acts.length ? '<section class="pv-card pv-acts-card">' + acciones(p.acts) + '</section>' : '') +
      (p.rows.length ? '<section class="pv-card pv-movs"><div class="pv-movs__head"><h2>Detalle</h2></div><div class="pv-filas">' + filas(p.rows) + '</div></section>' : '') +
      (p.enlaces ? '<section class="pv-card pv-movs">' + p.enlaces.map(function (e) {
        return '<button class="pv-enlace" data-pv-go="' + e[0] + '" data-pv-label="' + e[1] + '">' + e[1] + ms('chevron_right') + '</button>';
      }).join('') + '</section>' : '') +
      (p.list.length ? '<section class="pv-card pv-movs"><div class="pv-movs__head"><h2>' + p.listTitle + '</h2></div><div class="pv-filas">' + p.list.map(function (m) {
        return '<div class="pv-row pv-row--mov"><span><b>' + m[0] + '</b><small>' + m[1] + '</small></span><b class="' + (m[2][0] === '+' ? 'is-in' : '') + '">' + sens(m[2]) + '</b></div>';
      }).join('') + '</div></section>' : '') +
    '</div>';
  }

  // Un hub de cuentas o metas trae sus filas: se guardan con su tipo para elegir el diseño
  function registrar(titulo, p) { R[titulo] = p; }

  document.addEventListener('click', function (e) {
    var ir = e.target.closest('[data-pv-go]');
    if (ir) { if (window.openPushPage) window.openPushPage(ir.dataset.pvGo); return; }
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

  var ES_CUENTA = function (t) { return !!A[t] || !!(R[t] && R[t].cuenta); };
  window.ProductView = {
    registrar: registrar,
    has: function (t) { return !!V[t] || ES_CUENTA(t) || !!R[t] || !!PAGINAS[t]; },
    isAccount: ES_CUENTA,
    title: function (t) { return A[t] ? A[t].title : t; },
    html: html
  };
})();
