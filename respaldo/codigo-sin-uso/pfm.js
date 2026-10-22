/* Revisión del 21 de octubre: funciones de assets/pfm.js que ya nadie llama */
  // Tus gastos por grupo: los tres que más pesan este mes, con su barra proporcional
  function hubGruposHTML(s, m) {
    var G = Object.keys(s.grupos || {}).filter(function (k) { return GRUPOS[k] && !GRUPOS[k].gris && s.grupos[k] > 0; })
      .sort(function (x, y) { return s.grupos[y] - s.grupos[x]; }).slice(0, 3);
    if (!G.length) return '';
    var max = s.grupos[G[0]];
    return hubSec(T('Gastos por grupo'), T('Lo que más pesa en {mes}', { mes: mesName(m).toLowerCase() }), 'gastos', T('Ver todo'), G.map(function (k) {
      return hubRow('gastos', GRUPOS[k].ic, esc(T(k)), null, '<em>' + money0(s.grupos[k]) + '</em>', '<i class="pfm-hub__gbar" aria-hidden="true"><u style="width:' + (s.grupos[k] / max * 100).toFixed(0) + '%"></u></i>');
    }));
  }

  // Pagos que vienen en los próximos quince días
  function hubPagosHTML() {
    var fs = facturas().filter(function (x) { return diasA(x.f) >= 0 && diasA(x.f) <= 15; }).sort(function (x, y) { return x.f.localeCompare(y.f); }).slice(0, 3);
    if (!fs.length) return '';
    return hubSec(T('Pagos que vienen'), T('En los próximos 15 días'), 'bills', T('Ver todos'), fs.map(function (x) {
      return hubRow('bills', x.ic, esc(x.n), cuandoTxt(x.f) + (x.aprox ? ' · ' + T('aproximado') : ''), '<em>' + money0(x.monto) + '</em>');
    }));
  }

  // Los últimos tres movimientos, con acceso al detalle
  function hubUltimosHTML() {
    var R = rows().slice().sort(function (x, y) { return y.f.localeCompare(x.f) || y.i - x.i; }).slice(0, 3);
    if (!R.length) return '';
    return hubSec(T('Últimos movimientos'), null, 'alltx', T('Ver todos'), R.map(function (r) {
      var c = cls(r), icon = (c.cat && CAT[c.cat]) || (r.m > 0 ? 'south_west' : 'receipt_long');
      return hubRow('tx:' + r.i, icon, esc(desc(r)), dshort(r.f) + (c.cat ? ' · ' + esc(T(c.cat)) : ''), '<em' + (r.m > 0 ? ' class="is-in"' : '') + '>' + (r.m > 0 ? '+' : '−') + money0(Math.abs(r.m)) + '</em>');
    }));
  }

  function hubSec(t, sub, k, l, rows) { return '<div class="pfm-hub__label"><div><h3>' + t + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (k ? '<button class="pfm-hub__link" data-pfm="' + k + '">' + l + '</button>' : '') + '</div><div class="pfm-hub__card">' + rows.join('') + '</div>'; }

  function hubRow(k, icon, t, sm, right, extra) { return '<button class="pfm-hub__row" data-pfm="' + k + '"><span class="pfm-hub__ic"><span class="material-symbols-rounded" aria-hidden="true">' + icon + '</span></span><span class="pfm-hub__pl"><b>' + t + '</b>' + (sm ? '<small>' + sm + '</small>' : '') + (extra || '') + '</span>' + right + '</button>'; }

  // En el asistente, lo que puedes hacer desde Mis finanzas, a un toque
  function navHTML() {
    var a = animo(), pr = pres();
    var row = function (k, t, s) { return '<button class="pfm-nav__row" data-pfm="' + k + '"><span><b>' + t + '</b>' + (s ? '<small>' + s + '</small>' : '') + '</span><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>'; };
    var tile = function (k, ic, t, s) { return '<button class="pfm-tile" data-pfm="' + k + '"><span class="material-symbols-rounded" aria-hidden="true">' + ic + '</span><b>' + t + '</b><small>' + s + '</small></button>'; };
    return '<section class="pf-sec pfm-nav">' +
      '<div class="pfm-tiles">' + tile('gastos', 'bar_chart', T('Gastos'), T('Por semana, mes o año')) + tile('pres', 'speed', T('Presupuesto'), pr.general ? T('{m} al mes', { m: money0(pr.general) }) : T('Todavía no tienes uno')) + '</div>' +
      row('alltx', T('Movimientos'), T('Todo lo que entró y salió')) +
      (a.n ? row('game', T('Ordenar mis gastos'), T(a.n === 1 ? '1 consumo sin clasificar' : '{n} consumos sin clasificar', { n: a.n })) : '') +
      row('who', T('El mundo de Uku'), T('Qué significa cada cosa')) +
      '</section>';
  }

  function ukuMsg(a) {
    if (a.k === 'feliz') return T('¡Todo clasificado! Así da gusto ayudarte.');
    if (a.k === 'tranquilo') return T(a.n === 1 ? 'Tengo 1 consumo nuevo para ti. ¿Lo vemos?' : 'Tengo {n} consumos nuevos para ti. ¿Los vemos?', { n: a.n });
    return T(a.n === 1 ? 'Tienes 1 consumo sin clasificar, de hace {d} días. ¿Lo ordenamos?' : 'Tienes {n} consumos sin clasificar, algunos de hace {d} días. ¿Los ordenamos?', { n: a.n, d: a.dias });
  }

/* Revisión del 22 de octubre: de assets/pfm.js (ya nadie las llama) */
  function footHTML() {
    return '<section class="pf-sec pfm-foot"><p class="pf-note pfm-scope"><span class="material-symbols-rounded">visibility</span><span>' +
      (tobe() ? T('Uku ve Pichibank, Deuna y las tarjetas de otros bancos que conectaste. El efectivo no lo ve.') : T('Solo vemos lo que pasa por Pichibank y Deuna. El efectivo y las tarjetas de otros bancos no aparecen.')) +
      '</span></p><p class="pf-note">' + T('Datos ficticios de la Base de datos PFM, hasta el {f}.', { f: dshort(HOY) + ' ' + HOY.slice(0, 4) }) + '</p></section>';
  }

  function resumenGastosHTML() {
    var s = month(curMes()), pr = pres(), g = s.gast, p = pr.general;
    var t = !p ? '' : g > p ? T('Excediste tu presupuesto por {m}', { m: money0(g - p) }) : T('Te quedan {m} de {p}', { m: money0(p - g), p: money0(p) });
    return '<section class="pf-sec pfm-resumen"><button class="pfm-resumen__card" data-pfm="gastos">' +
      '<span class="pfm-resumen__t">' + T('Gastaste este mes') + '</span>' +
      '<b class="pfm-resumen__m">' + money0(g) + '</b>' +
      (t ? '<span class="pfm-resumen__s">' + t + '</span>' : '') +
      '<span class="pfm-resumen__go">' + T('Ver en qué gastaste') + '<span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></span></button></section>';
  }
