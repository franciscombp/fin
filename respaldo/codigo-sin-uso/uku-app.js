/* Revisión del 21 de octubre: funciones de assets/uku-app.js que ya nadie llama */
  function abrirSol() {
    if (!solSec) {
      solSec = document.createElement('section'); solSec.className = 'uk-sec'; solSec.hidden = true; solSec.setAttribute('aria-label', 'Solicitudes');
      // Solo el título: la tarjeta se baja con la flecha de arriba o arrastrándola, y el buscador ya está abajo
      solSec.innerHTML = '<div class="uk-sec__top"><p class="uk-sec__t">Solicitudes</p></div>' +
        '<div class="uk-sec__body"></div>';
      host.appendChild(solSec);
      solSec.addEventListener('click', function (e) {
        var b = e.target.closest('[data-s]'); if (!b) return;
        var v = b.dataset.s, i = v.indexOf(':'), k = i < 0 ? v : v.slice(0, i), x = i < 0 ? '' : v.slice(i + 1);
        fx('tap');
        if (k === 'back') { solSec.hidden = true; host.classList.remove('uk-in-sec'); modo(); return; }
        if (k === 'escribir') { solSec.hidden = true; host.classList.remove('uk-in-sec'); pintar(); setTimeout(function () { input.focus(); }, 350); return; }
        if (k === 'buscar') return window.Buscador && Buscador.open('solicitudes');
        if (k === 'rev') return window.Soporte && Soporte.review();
        if (k === 'caso') { var cx = casos.filter(function (y) { return y.id === x; })[0]; solSec.hidden = true; host.classList.remove('uk-in-sec'); if (cx) { me('¿Cómo va mi caso ' + cx.id + '?'); uku('Tu caso ' + esc(cx.id) + ' sobre «' + esc(cx.t) + '» está en revisión. Te llega un correo con la respuesta en máximo 48 horas.', [{ k: 'hum:agent', t: 'Escribirle a un asesor', ic: 'support_agent', cls: 'is-ask' }, { k: 'ok', t: 'Gracias', ic: 'thumb_up', cls: 'is-ask' }]); } return pintarChat(); }
        if (k === 'persona') { solSec.hidden = true; host.classList.remove('uk-in-sec'); persona(); return pintarChat(); }
        if (k === 'act') { var a = accion(x); if (a && window.Buscador) { solSec.hidden = true; host.classList.remove('uk-in-sec'); Buscador.run(a); } }
      });
    }
    solSec.querySelector('.uk-sec__body').innerHTML = solRows();
    solSec.hidden = false; host.classList.add('uk-in-sec'); fx('open'); modo();
  }

  function pintarTarjetas() {
    var nuevo = -1; msgs.forEach(function (m, i) { if (m.uku != null && m.nuevo && nuevo < 0) nuevo = i; });
    if (nuevo >= 0 && !RM) { if (!escribe) escribe = setTimeout(function () { escribe = null; msgs.forEach(function (m) { m.nuevo = false; }); pintarChat(); if (b3d) b3d.play('nod'); }, 650); }
    else { msgs.forEach(function (m) { m.nuevo = false; }); nuevo = -1; }
    var U = [], q = null; msgs.forEach(function (m) { if (m.me) q = m.me; else if (m.uku != null) U.push({ m: m, q: q }); });
    var last = U[U.length - 1];
    chat.innerHTML = last ? tarjetaHTML(last.m, last.q, U.length, U.length, nuevo >= 0) : '';
    host.classList.add('is-cards');
    modo();
  }

  function tarjetaHTML(m, q, n, i, typing) {
    var nav = m.btns.filter(function (x) { return !/is-ask/.test(x.cls || ''); }), ask = m.btns.filter(function (x) { return /is-ask/.test(x.cls || ''); });
    return '<section class="uk-card' + (typing ? ' is-typing' : '') + '" style="--n:' + Math.min(n - 1, 2) + '">' +
      '<header class="uk-card__top">' + (n > 1 ? '<button class="uk-card__back" data-k="atras-card" aria-label="Volver a la tarjeta anterior">' + ic('arrow_back') + '</button>' : '<span class="uk-card__face" aria-hidden="true">' + face() + '</span>') +
        '<span class="uk-card__q">' + esc(m.title || q || 'Uku') + '</span>' + (n > 1 ? '<small class="uk-card__n">' + i + ' de ' + n + '</small>' : '') + '</header>' +
      (typing ? '<p class="uk-msg__b uk-dots" aria-label="Uku está escribiendo"><i></i><i></i><i></i></p>' :
        '<div class="uk-card__body">' + (m.num ? '<p class="uk-num"><b>' + esc(m.num.v) + '</b><small>' + esc(m.num.l) + '</small></p>' : '') +
        (m.meter ? '<div class="uk-meter' + (m.meter.cls ? ' is-' + m.meter.cls : '') + '"><i style="width:' + Math.max(2, Math.min(100, m.meter.v / (m.meter.max || 1) * 100)).toFixed(1) + '%"></i></div><p class="uk-meter__l">' + esc(m.meter.l) + '</p>' : '') +
        '<p class="uk-card__t">' + m.uku + '</p>' +
        (m.stats ? '<div class="uk-stats">' + m.stats.map(function (x) { return '<div class="uk-stat' + (x.cls ? ' is-' + x.cls : '') + '"' + (x.saldo ? ' data-saldo' : '') + '>' + ic(x.ic || 'info') + '<b>' + esc(x.v) + '</b><small>' + esc(x.l) + '</small></div>'; }).join('') + '</div>' : '') +
        (m.bars ? '<div class="uk-barras">' + (function () { var mx = Math.max.apply(null, m.bars.map(function (b) { return b.v; }).concat([1])); return m.bars.map(function (b) { return '<div class="uk-barra"><span>' + esc(b.l) + '</span><b>' + money0(b.v) + '</b><i style="width:' + Math.max(3, b.v / mx * 100).toFixed(1) + '%"></i></div>'; }).join(''); })() + '</div>' : '') +
        (m.rows ? '<dl class="uk-card__data">' + m.rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' : '') + m.extra +
        (m.links && m.links.length ? '<div class="uk-links"><small>Para leer más</small>' + m.links.map(function (l) { return '<a class="uk-link" href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + ic('open_in_new') + esc(l[0]) + '</a>'; }).join('') + '</div>' : '') +
        (nav.length ? '<div class="uk-card__nav">' + nav.map(function (x, j) { var ico = iconoDe(x); return '<button class="uk-card__row' + (ico ? ' has-ic' : '') + '" style="--d:' + j * 40 + 'ms" data-k="' + esc(x.k) + '" data-l="' + esc(x.t) + '">' + (ico ? ic(ico) : '') + '<span>' + esc(x.t) + '</span>' + ic('chevron_right') + '</button>'; }).join('') + '</div>' : '') +
        (ask.length ? (m.pregunta ? '<p class="uk-msg__q">' + esc(m.pregunta) + '</p>' : '') + '<div class="uk-msg__acts">' + ask.map(function (x, j) { return '<button class="uk-chip is-ask" style="--d:' + (nav.length + j) * 40 + 'ms" data-k="' + esc(x.k) + '" data-l="' + esc(x.t) + '">' + (x.ic ? ic(x.ic) : '') + esc(x.t) + '</button>'; }).join('') + '</div>' : '') +
        // ¿Te sirvió? Pulgar arriba cierra; pulgar abajo abre el siguiente paso de autogestión
        (m.voto ? '<div class="uk-voto' + (m.votado ? ' is-' + m.votado : '') + '"><span>' + (m.votado === 'up' ? 'Gracias por contarme.' : m.votado === 'down' ? 'Busquemos otra forma.' : '¿Te sirvió?') + '</span>' + (m.votado ? '' : '<button data-k="voto:down" aria-label="No me sirvió">' + ic('thumb_down') + '</button><button data-k="voto:up" aria-label="Sí me sirvió">' + ic('thumb_up') + '</button>') + '</div>' : '') + '</div>') + '</section>';
  }

  function solRows() {
    var top = casos.length ? '<p class="uk-sec__l">Tus casos</p>' + casos.slice(0, 3).map(function (x) { return row('caso:' + x.id, 'pending_actions', 'Caso ' + x.id + ' · ' + x.t, x.como === 'agent' ? 'En revisión · respuesta en máximo 48 horas' : x.como === 'call' ? 'Abierto · llamaste al call center' : 'Te llamamos con el resumen'); }).join('') + '<p class="uk-sec__l">Lo que puedes pedir</p>' : '<p class="uk-sec__l">Lo que puedes pedir</p>';
    var rows = [top + row('rev', 'receipt_long', 'Revisar un consumo que no reconoces', 'Pedimos la revisión por ti')];
    ['Préstamos', 'Mis tarjetas', 'Seguridad'].forEach(function (l) { var a = accion(l); if (a) rows.push(row('act:' + l, a.icon, l, 'Pedir o revisar')); });
    rows.push('<div class="uk-cta"><button class="pf-cta" data-s="escribir">Pregúntale a Uku</button></div>');
    return rows.join('');
  }
