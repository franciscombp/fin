/* Mis finanzas como página completa (antes de ser sección de la barra
   inferior). Funciones quitadas de assets/asistente.js. */

// mountPF (rama de página completa)
    pf.className = 'pf-page';
    pf.setAttribute('role', 'dialog');
    pf.setAttribute('aria-modal', 'true');
    pf.setAttribute('aria-label', 'Mis finanzas');
    pf.innerHTML =
      '<div class="pf-top"><button class="pf-round" data-pf="close" aria-label="Volver"><span class="material-symbols-rounded">arrow_back</span></button>' +
        '<button class="pf-round" data-pf="settings" aria-label="Ajustes"><span class="material-symbols-rounded">tune</span></button></div>' +
      '<div class="pf-scroll"></div>';
    document.body.appendChild(pf);
    pf.addEventListener('click', onPF);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !pf.classList.contains('open') || (page && page.classList.contains('open'))) return;
      e.stopImmediatePropagation();
      if (sheet && sheet.classList.contains('open')) closeSheet(); else closePF();
    }, true);
  }


  function paintPF() {
    if (!pf) return;
    if (isInline()) return paintDash();
    var v = viewOf(ST.view), html = '';
    html += '<header class="pf-head"><h1>Mis finanzas</h1><div class="pf-months" role="tablist">' + VIEWS.map(function (x) {
      return '<button role="tab" data-pf="view:' + x.key + '" aria-selected="' + (x.key === v.key) + '">' + x.short + '</button>';
    }).join('') + '</div></header>';

    if (v.report) {
      var r = REPORTS[v.key];
      html += heroHTML(r.score, T('Salud financiera {n} · {nivel}', { n: r.score, nivel: T(level(r.score).n) }));
      html += totalHTML(T('Gastaste en {mes}', { mes: T(r.name) }), money(r.spend), T('Ahorraste {monto}', { monto: money(r.save) }));
      html += insHTML(r.ins, false);
      html += '<section class="pf-sec"><p class="pf-note pf-note--box">' + T('De {mes} solo tenemos este resumen. El detalle de cada movimiento lo tienes desde agosto.', { mes: T(r.name) }) + '</p></section>';
    } else if (v.current) {
      html += heroHTML(D.score, T('Salud financiera hoy {n} · {nivel}', { n: D.score, nivel: T(level(D.score).n) }));
      if (!onDemand) {
        html += '<div class="pf-empty"><p>Tu resumen de octubre va a estar listo a inicios de noviembre.</p>' +
          '<button class="pf-pill" data-pf="ondemand">Ver cómo va octubre</button></div>';
      } else if (onDemand === 'loading') {
        html += '<div class="pf-empty"><span class="pf-spinner"></span><p>Revisando tus movimientos de octubre…</p></div>';
      } else html += currentHTML();
    } else {
      var mi = v.mi, b = D.by[mi], sc = monthScore(mi);
      html += heroHTML(sc, T('Salud financiera {n} · {nivel}', { n: sc, nivel: T(level(sc).n) }));
      html += totalHTML(T('Gastaste en {mes}', { mes: T(MONTHS[mi].name) }), money(b._spend), T('Ahorraste {monto} · Salud financiera {n}', { monto: money(b._save), n: sc }));
      html += insHTML(monthInsights(mi), true);
      var tc = catTotals(mi).slice(0, 3);
      html += '<section class="pf-sec"><h2>En qué gastaste</h2><div class="pf-top3">' + tc.map(function (c) {
        return '<button class="pf-top3__row" data-pf="cat:' + c.k + ':' + mi + '"><span>' + CATS[c.k].name + '</span><b>' + money(c.v) + '</b><u><i style="width:' + Math.round(c.v / tc[0].v * 100) + '%"></i></u></button>';
      }).join('') + '</div><button class="pf-link pf-link--block" data-pf="breakdown:' + mi + '">Ver todas las categorías</button></section>';
    }
    html += footHTML();
    // La escena 3D sobrevive al cambio de mes: se reutiliza el mismo nodo y
    // sólo se actualiza el puntaje (el bosque crece o se encoge, sin parpadeo).
    var scroll = pf.querySelector('.pf-scroll'), oldHero = scroll.querySelector('.pf-hero');
    var live = oldHero && oldHero.querySelector('.b3d.is-3d');
    if (oldHero) oldHero.remove();
    scroll.innerHTML = html;
    var vv = viewOf(ST.view), saved = !vv.report && !vv.current && D.by[vv.mi]._save / D.by[vv.mi]._in >= .08;
    var g = saved ? { name: 'hold', opts: { hold: 'coin' } } : 'wave';
    var fresh = scroll.querySelector('.pf-hero');
    if (fresh && v.today) fresh.querySelector('.b3d').dataset.g = JSON.stringify(MOOD[moodFor(v)].gesture);
    if (live && fresh) {
      var sc = +fresh.querySelector('.b3d').dataset.score;
      oldHero.querySelector('.pf-hero__badge').innerHTML = fresh.querySelector('.pf-hero__badge').innerHTML;
      fresh.replaceWith(oldHero);
      live.dataset.score = sc;
      if (!live.querySelector('canvas')) mount3D(live, sc, g); // el lienzo estaba en el hub de Uku
      else if (b3d) { b3d.setScore(sc); if (live.dataset.g !== JSON.stringify(g)) b3d.play(g.name || g, g.opts); }
      live.dataset.g = JSON.stringify(g);
    } else if (fresh) {
      var hero = fresh.querySelector('.b3d');
      hero.dataset.g = JSON.stringify(g);
      mount3D(hero, +hero.dataset.score, g);
    }
    // Dos columnas en escritorio: a la izquierda el mes (escena y total), a la
    // derecha el detalle. En el celular los contenedores no cambian nada.
    var L = document.createElement('div'), Rr = document.createElement('div');
    L.className = 'pf-col pf-col--main'; Rr.className = 'pf-col pf-col--side';
    Array.prototype.slice.call(scroll.children).forEach(function (n) {
      (n.matches('.pf-head, .pf-hero, .pf-total, .pf-empty') ? L : Rr).appendChild(n);
    });
    scroll.appendChild(L); scroll.appendChild(Rr);
    var sel = pf.querySelector('.pf-months [aria-selected="true"]');
    if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest' });
  }


  function avgCat(k) { return (D.by[0][k] + D.by[1][k]) / 2; }

  function currentHTML() {
    var o = D.by[2], day = MONTHS[2].days, proj = o._spend / day * 31, prev = D.by[1]._spend;
    var hot = Object.keys(CATS).filter(function (k) { return !CATS[k].fixed && o[k] / CATS[k].budget > day / 31 + .15; })
      .sort(function (a, b) { return o[b] / CATS[b].budget - o[a] / CATS[a].budget; })[0];
    var next = [];
    ['servicios', 'subs'].forEach(function (k) { CATS[k].fixed.forEach(function (p, i) { var d = 3 + i * 4; if (d > day && d <= day + 7) next.push({ who: p[0], amt: p[1], d: d }); }); });
    return totalHTML(T('Llevas gastado en octubre'), money(o._spend), T('En los primeros {n} días', { n: day })) +
      '<section class="pf-sec"><div class="pf-ins-list">' +
        '<article class="pf-ins pf-ins--info"><span class="pf-ins__ic material-symbols-rounded">speed</span><div class="pf-ins__body"><h3>' + T('Si sigues así, cerrarías el mes en {monto}', { monto: money(proj) }) + '</h3><p>' + (proj > prev ? T('Eso es {monto} más que en septiembre.', { monto: money(proj - prev) }) : T('Eso es {monto} menos que en septiembre.', { monto: money(prev - proj) })) + '</p></div></article>' +
        (hot ? '<article class="pf-ins pf-ins--warn"><span class="pf-ins__ic material-symbols-rounded">pie_chart</span><div class="pf-ins__body"><h3>' + T('Ya usaste el {pct} de tu presupuesto de {cat}', { pct: pct(o[hot] / CATS[hot].budget), cat: catLow(hot) }) + '</h3><p>' + T('Y apenas vamos por el {pct} del mes.', { pct: pct(day / 31) }) + '</p></div></article>' : '') +
        (next.length ? '<article class="pf-ins pf-ins--info"><span class="pf-ins__ic material-symbols-rounded">event</span><div class="pf-ins__body"><h3>' + T('Esta semana te cobran {monto}', { monto: money(next.reduce(function (s, n) { return s + n.amt; }, 0)) }) + '</h3><p>' + next.map(function (n) { return T(n.who) + ' (' + n.d + ' ' + T('oct') + ')'; }).join(', ') + '.</p></div></article>' : '') +
      '</div></section>';
  }

  function entryHTML(where) {
    return '<button class="as-entry" data-as-open="' + where + '" aria-label="Abrir Mis finanzas">' +
      '<span class="as-entry__art"><span class="as-entry__blob"></span><span class="as-entry__pet"></span></span>' +
      '<span class="as-entry__eyebrow"></span>' +
      '<span class="as-entry__title"></span>' +
      '<span class="as-entry__cta"></span></button>';
  }

  function insCards(title, list) {
    curIns = list || [];
    if (!curIns.length) return '';
    return '<section class="pf-sec"><h2>' + title + '</h2><div class="pf-ins-list">' + curIns.map(function (x, i) {
      return '<article class="pf-ins pf-ins--' + x.kind + '"><span class="pf-ins__ic material-symbols-rounded">' + x.icon + '</span>' +
        '<div class="pf-ins__body"><h3>' + x.title + '</h3><p>' + x.sub + '</p>' +
        (x.det || x.ask ? '<div class="pf-ins__acts">' + (x.det ? '<button class="pf-link" data-pf="det:' + i + '">Ver detalle</button>' : '') +
          (x.ask ? '<button class="pf-link" data-pf="why:' + i + '">' + T('Pregúntale a {nombre}', { nombre: C().name }) + '</button>' : '') + '</div>' : '') +
        '</div></article>';
    }).join('') + '</div></section>';
  }

  function insHTML(list, withDetail) {
    curIns = list;
    return '<section class="pf-sec"><h2>Lo más importante</h2><div class="pf-ins-list">' + list.map(function (x, i) {
      return '<article class="pf-ins pf-ins--' + x.kind + '"><span class="pf-ins__ic material-symbols-rounded">' + x.icon + '</span>' +
        '<div class="pf-ins__body"><h3>' + x.title + '</h3><p>' + x.sub + '</p>' +
        ((withDetail && x.det) || x.ask ? '<div class="pf-ins__acts">' +
          (withDetail && x.det ? '<button class="pf-link" data-pf="det:' + i + '">Ver detalle</button>' : '') +
          (x.ask ? '<button class="pf-link" data-pf="why:' + i + '">' + T('Pregúntale a {nombre}', { nombre: C().name }) + '</button>' : '') + '</div>' : '') +
        '</div></article>';
    }).join('') + '</div></section>';
  }

  function landSVG(score) {
    var out = ['<svg class="as-land" viewBox="0 0 360 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true" fill="none" stroke-linecap="round">'];
    out.push('<rect width="360" height="240" fill="var(--as-paper)"/>');
    out.push(cloud(40, 40), cloud(230, 64, 'b'));
    out.push('<path d="M0 150 C30 140 58 146 80 170 C92 184 110 196 130 214 H0Z" fill="var(--as-g1)"/>');
    if (score >= 55) out.push('<circle cx="300" cy="52" r="14" stroke="var(--as-accent)" stroke-width="1.6"/>');
    if (score < 30) {
      out.push('<path d="M280 214 V186 M280 198 L270 188 M280 192 L289 182" stroke="var(--as-g2)" stroke-width="1.6"/>');
      out.push('<path d="M300 214 V200 M300 206 L306 200" stroke="var(--as-g2)" stroke-width="1.4"/>');
    }
    var ITEMS = [
      { t: 30, f: function (i) { return leaf(296, 214, .75, i); } },
      { t: 40, f: function (i) { return leaf(322, 214, 1, i); } },
      { t: 55, f: function (i) { return leaf(44, 214, .6, i, 'var(--as-g2)'); } },
      { t: 65, f: function (i) { return tree(262, 214, .9, i); } },
      { t: 75, f: function (i) { return leaf(346, 214, .55, i); } },
      { t: 85, f: function (i) { return tree(70, 214, .75, i); } }
    ];
    ITEMS.forEach(function (it, i) { if (score >= it.t) out.push(it.f(i)); });
    if (score >= 55) [[232, 214], [244, 214], [16, 214]].forEach(function (p, i) {
      out.push('<g class="l-grow" style="animation-delay:' + (400 + i * 80) + 'ms"><path d="M' + p[0] + ' ' + p[1] + ' v-12" stroke="var(--as-line)" stroke-width="1"/><circle cx="' + p[0] + '" cy="' + (p[1] - 14) + '" r="3" stroke="var(--as-accent)" stroke-width="1.4"/></g>');
    });
    if (score >= 75) out.push('<g class="l-bird" stroke="var(--as-line)" stroke-width="1.2"><path d="M0 80 q5 -5 10 0 q5 -5 10 0"/></g>');
    if (score >= 90) out.push('<g class="l-bfly" transform="translate(240 150)"><path d="M0 0 c-5 -7 -10 -2 -5 3z M0 0 c5 -7 10 -2 5 3z" fill="var(--as-accent)"/></g>');
    out.push('<path d="M0 214 H360" stroke="var(--as-line)" stroke-width="1.2"/>');
    out.push('</svg>');
    return out.join('');
  }

  function sumCat(mi, k) { return D.by[mi][k]; }

  function sumHTML(label, value, stats) {
    return '<section class="pf-sum"><p class="pf-sum__label">' + label + '</p><p class="pf-sum__value">' + value + '</p>' +
      '<div class="pf-sum__stats">' + stats.map(function (x) { return '<div><small>' + x[0] + '</small><b' + (x[2] ? ' class="' + x[2] + '"' : '') + '>' + x[1] + '</b></div>'; }).join('') + '</div></section>';
  }

  function ukuHTML(list, body) {
    curIns = list || [];
    return '<section class="pf-sec pf-uku"><h2>' + T('{nombre} te acompaña', { nombre: C().name }) + '</h2><div class="pf-uku__list">' +
      (body || curIns.slice(0, 2).map(function (x, i) {
        return sayHTML(i, sentence(x.title, x.sub),
          (x.det ? '<button class="uku-say__reply" data-pf="det:' + i + '">Ver detalle</button>' : '') +
          (x.ask ? '<button class="uku-say__reply" data-pf="why:' + i + '">' + esc(x.ask) + '</button>' : ''));
      }).join('')) + '</div></section>';
  }

  function leaf(x, y, s, i, tone) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><g class="l-grow" style="animation-delay:' + (i * 90) + 'ms"><g class="l-sway" style="animation-delay:-' + i + 's">' +
      '<path d="M0 0 C-16 -10 -18 -44 0 -70 C18 -44 16 -10 0 0Z" fill="' + (tone || 'var(--as-accent)') + '"/>' +
      '<path d="M0 -4 V-60 M0 -22 L-7 -31 M0 -38 L7 -47" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></g></g>';
  }

  function sayHTML(i, text, replies) {
    return '<div class="uku-say">' + (i === 0 ? '<span class="uku-say__face">' + C().face() + '</span>' : '<span class="uku-say__face" aria-hidden="true"></span>') +
      '<div class="uku-say__body"><p class="uku-say__bubble">' + text + '</p>' +
      (replies ? '<div class="uku-say__replies">' + replies + '</div>' : '') + '</div></div>';
  }

  function totalHTML(label, value, sub) {
    return '<div class="pf-total"><p class="pf-total__label">' + label + '</p><p class="pf-total__value">' + value + '</p><p class="pf-total__sub">' + sub + '</p></div>';
  }

  function tree(x, y, s, i) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><g class="l-grow" style="animation-delay:' + (i * 90) + 'ms"><g class="l-sway">' +
      '<path d="M0 0 V-40" stroke="var(--as-line)" stroke-width="1.3"/><ellipse cx="0" cy="-58" rx="20" ry="26" fill="var(--as-g1)"/>' +
      '<path d="M0 -40 V-70 M0 -52 L-8 -60" stroke="var(--as-paper)" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></g></g>';
  }


