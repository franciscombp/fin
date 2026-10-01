/* =====================================================================
   Firu — mascota financiera (concept tipo tamagotchi)

   Idea: la mascota no se cuida tocándola, sino con hábitos financieros
   reales. Cada necesidad está atada a UN hábito:
     Pancita  ← ahorro / aportes a metas
     Energía  ← gastar dentro del presupuesto
     Alegría  ← pagar a tiempo (tarjetas, servicios, préstamos)
     Pelaje   ← pocos gastos hormiga
   Reglas éticas del sistema: nunca muere ni se enferma "por tu culpa"
   (a lo sumo duerme una siesta larga), nunca premia gastar ni
   endeudarse, acariciarla no sube stats (no hay granja de clics) y todo
   se puede ocultar. En el concept los eventos vienen del simulador; en
   producción vendrían de los movimientos categorizados.
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'pb_firu_v1';
  var NEEDS = [
    { k: 'food',   name: 'Pancita', icon: 'restaurant', c: '#f08c2e', habit: 'Se llena cuando ahorras o aportas a tus metas' },
    { k: 'energy', name: 'Energía', icon: 'bolt',       c: '#2f7abf', habit: 'Se mantiene si gastas dentro de tu presupuesto' },
    { k: 'joy',    name: 'Alegría', icon: 'favorite',   c: '#e0409a', habit: 'Sube cuando pagas a tiempo tarjetas y servicios' },
    { k: 'clean',  name: 'Pelaje',  icon: 'shower',     c: '#31a451', habit: 'Se ensucia con los gastos hormiga' }
  ];
  var STAGES = [
    { n: 'Cachorro', xp: 0 },
    { n: 'Explorador', xp: 120 },
    { n: 'Detective', xp: 300 },
    { n: 'Leyenda', xp: 700 }
  ];
  var ITEMS = [
    { k: 'scarf', name: 'Bufanda', icon: 'checkroom', at: 0, hint: 'De bienvenida' },
    { k: 'hat',   name: 'Sombrero', icon: 'school', at: 120, hint: 'Nivel Explorador' },
    { k: 'coat',  name: 'Gabardina', icon: 'search', at: 300, hint: 'Nivel Detective' }
  ];
  var BILLS = [
    { name: 'Luz de la casa', amount: '$ 24,80' },
    { name: 'Tarjeta Visa', amount: '$ 15,00' },
    { name: 'Internet', amount: '$ 32,50' }
  ];

  function fresh() {
    return {
      needs: { food: 62, energy: 78, joy: 70, clean: 48 },
      xp: 60, day: 1, streak: 2, saved: 35,
      today: { hormiga: 0, over: false, budgetSeen: false, hormigaSeen: false },
      bills: 0, log: [{ d: 1, t: 'Firu llegó a tu app', cls: '' }]
    };
  }
  var S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { S = fresh(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }
  function avg() { var n = S.needs; return (n.food + n.energy + n.joy + n.clean) / 4; }
  function mood() {
    var a = avg();
    if (a >= 75) return 'happy';
    if (a >= 55) return 'ok';
    if (a >= 35) return 'meh';
    if (a >= 15) return 'sad';
    return 'sleep';
  }
  var MOOD_TXT = { happy: 'Feliz y con la cola a mil', ok: 'Contento', meh: 'Un poco decaído', sad: 'Triste', sleep: 'Tomando una siesta larga' };
  function stage() { var s = STAGES[0]; STAGES.forEach(function (x) { if (S.xp >= x.xp) s = x; }); return s; }
  function stageIdx() { return STAGES.indexOf(stage()); }
  function hasItem(k) { return ITEMS.some(function (i) { return i.k === k && S.xp >= i.at; }); }

  /* ---------- Personaje: SVG plano + volumen suave ---------- */
  function petSVG() {
    return '' +
'<svg class="firu-svg" viewBox="0 0 200 200" aria-hidden="true">' +
'<ellipse cx="100" cy="193" rx="54" ry="7" fill="rgba(15,38,92,.14)"/>' +
'<g class="f-body-g">' +
  '<g class="f-tail"><path d="M134 168 C160 164 174 140 166 116 C180 128 184 162 152 180 Z" fill="var(--firu-fur)"/>' +
    '<path d="M166 116 C178 126 180 142 172 152 C172 138 170 126 166 116Z" fill="var(--firu-cream)"/></g>' +
  '<ellipse cx="100" cy="160" rx="41" ry="32" fill="var(--firu-fur)"/>' +
  '<ellipse cx="100" cy="166" rx="24" ry="22" fill="var(--firu-cream)"/>' +
  '<g class="f-acc f-coat">' +
    '<path d="M60 150 Q58 128 80 126 L120 126 Q142 128 140 150 L142 184 Q100 194 58 184 Z" fill="var(--firu-coat)"/>' +
    '<path d="M86 126 L100 152 L114 126" fill="var(--firu-cream)"/>' +
    '<path d="M80 126 L100 156 L92 128Z M120 126 L100 156 L108 128Z" fill="var(--firu-coat-shade)"/>' +
    '<rect x="59" y="160" width="82" height="8" rx="4" fill="var(--firu-coat-shade)"/>' +
    '<rect x="94" y="158" width="12" height="12" rx="2" fill="none" stroke="var(--firu-ink)" stroke-width="2"/>' +
    '<circle cx="90" cy="176" r="2.4" fill="var(--firu-coat-shade)"/><circle cx="110" cy="176" r="2.4" fill="var(--firu-coat-shade)"/>' +
  '</g>' +
  '<ellipse cx="62" cy="158" rx="11" ry="15" transform="rotate(18 62 158)" fill="var(--firu-fur-shade)"/>' +
  '<ellipse cx="138" cy="158" rx="11" ry="15" transform="rotate(-18 138 158)" fill="var(--firu-fur-shade)"/>' +
  '<ellipse cx="80" cy="188" rx="15" ry="8" fill="var(--firu-cream)"/>' +
  '<ellipse cx="120" cy="188" rx="15" ry="8" fill="var(--firu-cream)"/>' +
  '<g class="f-acc f-scarf"><path d="M64 122 Q100 140 136 122 L137 133 Q100 152 63 133Z" fill="var(--firu-scarf)"/>' +
    '<path d="M118 134 L126 158 L136 154 L130 130Z" fill="var(--firu-scarf-shade)"/></g>' +
  '<g class="f-ear-l"><path d="M56 74 L60 26 Q62 18 70 22 L98 54 Z" fill="var(--firu-fur)"/><path d="M63 62 L66 34 L88 54Z" fill="var(--firu-ear-in)"/></g>' +
  '<g class="f-ear-r"><path d="M144 74 L140 26 Q138 18 130 22 L102 54 Z" fill="var(--firu-fur)"/><path d="M137 62 L134 34 L112 54Z" fill="var(--firu-ear-in)"/></g>' +
  '<ellipse cx="100" cy="90" rx="52" ry="45" fill="var(--firu-fur)"/>' +
  '<path d="M70 58 Q100 42 130 58 Q116 54 100 54 Q84 54 70 58Z" fill="var(--firu-fur-shade)" opacity=".35"/>' +
  '<ellipse cx="100" cy="110" rx="28" ry="19" fill="var(--firu-cream)"/>' +
  '<ellipse cx="70" cy="106" rx="8" ry="4.5" fill="var(--firu-blush)" opacity=".55"/>' +
  '<ellipse cx="130" cy="106" rx="8" ry="4.5" fill="var(--firu-blush)" opacity=".55"/>' +
  /* ojos */
  '<g class="f-eyes-open" data-m="ok meh sad">' +
    '<circle cx="79" cy="90" r="9" fill="var(--firu-ink)"/><circle cx="121" cy="90" r="9" fill="var(--firu-ink)"/>' +
    '<circle cx="82" cy="86.5" r="3.2" fill="#fff"/><circle cx="124" cy="86.5" r="3.2" fill="#fff"/>' +
    '<circle cx="76.5" cy="93" r="1.4" fill="#fff" opacity=".8"/><circle cx="118.5" cy="93" r="1.4" fill="#fff" opacity=".8"/>' +
  '</g>' +
  '<g data-m="happy" fill="none" stroke="var(--firu-ink)" stroke-width="4.5" stroke-linecap="round">' +
    '<path d="M70 92 Q79 80 88 92"/><path d="M112 92 Q121 80 130 92"/></g>' +
  '<g data-m="sleep" fill="none" stroke="var(--firu-ink)" stroke-width="4" stroke-linecap="round">' +
    '<path d="M70 90 Q79 97 88 90"/><path d="M112 90 Q121 97 130 90"/></g>' +
  '<g data-m="sad" fill="none" stroke="var(--firu-ink)" stroke-width="3" stroke-linecap="round">' +
    '<path d="M70 76 L86 72"/><path d="M130 76 L114 72"/></g>' +
  '<path data-m="sad" d="M71 100 Q68 108 72 110 Q76 108 73 100Z" fill="#7cc4ff"/>' +
  '<g data-m="meh" fill="none" stroke="var(--firu-ink)" stroke-width="3" stroke-linecap="round">' +
    '<path d="M70 74 L87 76"/><path d="M130 74 L113 76"/></g>' +
  /* nariz y boca */
  '<ellipse cx="100" cy="102" rx="8.5" ry="6" fill="var(--firu-ink)"/>' +
  '<ellipse cx="97" cy="100" rx="2.6" ry="1.6" fill="#fff" opacity=".6"/>' +
  '<path data-m="ok" d="M91 111 Q100 118 109 111" fill="none" stroke="var(--firu-ink)" stroke-width="3" stroke-linecap="round"/>' +
  '<g data-m="happy"><path d="M89 109 Q100 128 111 109 Z" fill="var(--firu-ink)"/><path d="M94 116 Q100 124 106 116 Q100 113 94 116Z" fill="#ff7a8a"/></g>' +
  '<path data-m="meh" d="M93 113 L107 113" fill="none" stroke="var(--firu-ink)" stroke-width="3" stroke-linecap="round"/>' +
  '<path data-m="sad" d="M91 117 Q100 109 109 117" fill="none" stroke="var(--firu-ink)" stroke-width="3" stroke-linecap="round"/>' +
  '<ellipse data-m="sleep" cx="100" cy="114" rx="3.5" ry="3" fill="var(--firu-ink)"/>' +
  /* sombrero de detective (guiño al personaje de los 90) */
  '<g class="f-acc f-hat">' +
    '<ellipse cx="100" cy="54" rx="56" ry="11" fill="var(--firu-coat-shade)"/>' +
    '<path d="M64 54 Q63 22 100 19 Q137 22 136 54 Z" fill="var(--firu-coat)"/>' +
    '<path d="M65 46 Q100 52 135 46 L135.5 53 Q100 59 64.5 53Z" fill="var(--firu-ink)"/>' +
    '<ellipse cx="100" cy="18" rx="7" ry="4" fill="var(--firu-coat-shade)"/>' +
  '</g>' +
  /* suciedad por gastos hormiga */
  '<g class="f-dirt" fill="#8a6a4a" opacity=".55">' +
    '<circle cx="66" cy="72" r="4"/><circle cx="74" cy="66" r="2.5"/><circle cx="132" cy="120" r="3.5"/>' +
    '<circle cx="84" cy="168" r="4.5"/><circle cx="118" cy="150" r="3"/><circle cx="126" cy="182" r="3.5"/>' +
  '</g>' +
'</g></svg>';
  }

  function paintPet(svg) {
    if (!svg) return;
    var m = mood();
    svg.setAttribute('class', 'firu-svg m-' + m +
      (S.needs.clean < 40 ? ' is-dirty' : '') +
      (hasItem('scarf') && !hasItem('coat') ? ' has-scarf' : '') +
      (hasItem('hat') ? ' has-hat' : '') + (hasItem('coat') ? ' has-coat' : ''));
  }

  function lowest() {
    var min = NEEDS[0];
    NEEDS.forEach(function (n) { if (S.needs[n.k] < S.needs[min.k]) min = n; });
    return min;
  }
  function message() {
    if (mood() === 'sleep') return 'Zzz… Firu tomó una siesta larga. Un pequeño ahorro lo despierta.';
    var l = lowest(), v = S.needs[l.k];
    if (v >= 70) return S.streak > 1 ? '¡Vamos muy bien! ' + S.streak + ' días seguidos de buenos hábitos 🐾' : '¡Hoy me siento genial! 🐾';
    var pend = BILLS[S.bills];
    return {
      food: 'Tengo hambre… ¿ahorramos $5 hoy para nuestra meta?',
      energy: 'Estoy cansado: este mes ya usamos el 92% del presupuesto de comida.',
      joy: pend ? 'Me pongo triste si se atrasan los pagos. ' + pend.name + ' vence hoy.' : 'Extraño jugar contigo… ¿revisamos tus pagos del mes?',
      clean: 'Tantos cafecitos y deliverys me ensucian el pelaje ☕'
    }[l.k];
  }

  /* ---------- Widget en Inicio ---------- */
  function mountWidget() {
    var panel = document.querySelector('.tab-panel[data-panel="Destacado"]');
    if (!panel || document.getElementById('firu-widget')) return;
    var anchor = Array.prototype.find.call(panel.querySelectorAll('.section'), function (s) {
      var h = s.querySelector('.section__title h2'); return h && /Novedades/.test(h.textContent);
    });
    var sec = document.createElement('section');
    sec.className = 'section';
    sec.innerHTML =
      '<div class="section__title"><h2>Tu mascota</h2></div>' +
      '<button class="firu-widget" id="firu-widget" aria-label="Abrir a Firu, tu mascota financiera">' +
        '<span class="firu-widget__pet"></span>' +
        '<span class="firu-widget__body">' +
          '<span class="firu-widget__name">Firu <span class="firu-lvl"></span></span>' +
          '<span class="firu-widget__mood"></span>' +
          '<span class="firu-widget__bars"></span>' +
        '</span>' +
        '<span class="material-symbols-rounded">chevron_right</span>' +
      '</button>';
    if (anchor) panel.insertBefore(sec, anchor); else panel.appendChild(sec);
    sec.querySelector('.firu-widget__pet').innerHTML = petSVG();
    sec.querySelector('#firu-widget').addEventListener('click', function (e) { open(e.currentTarget); });
  }
  function paintWidget() {
    var w = document.getElementById('firu-widget');
    if (!w) return;
    paintPet(w.querySelector('.firu-svg'));
    w.querySelector('.firu-lvl').textContent = stage().n;
    w.querySelector('.firu-widget__mood').textContent = message();
    w.querySelector('.firu-widget__bars').innerHTML = NEEDS.map(function (n) {
      return '<span class="firu-mini" title="' + n.name + '"><i style="--c:' + n.c + ';width:' + S.needs[n.k] + '%"></i></span>';
    }).join('');
  }

  /* ---------- Pantalla completa ---------- */
  var page, sheet, back;
  function mountPage() {
    page = document.createElement('div');
    page.className = 'firu-page';
    page.setAttribute('role', 'dialog');
    page.setAttribute('aria-label', 'Firu, tu mascota financiera');
    page.innerHTML =
      '<div class="firu-top">' +
        '<button class="firu-icon-btn" data-firu="close" aria-label="Volver"><span class="material-symbols-rounded">arrow_back</span></button>' +
        '<h1>Firu</h1>' +
        '<button class="firu-icon-btn" data-firu="info" aria-label="Cómo funciona"><span class="material-symbols-rounded">help</span></button>' +
      '</div>' +
      '<div class="firu-scene">' +
        '<div class="firu-window"></div><div class="firu-shelf"></div>' +
        '<svg class="firu-plant" viewBox="0 0 34 46"><path d="M8 30 h18 l-3 16 h-12z" fill="#0f265c"/><path d="M17 30 C4 26 2 12 8 6 C14 12 16 20 17 30 C18 18 22 8 30 4 C32 14 28 26 17 30Z" fill="#31a451"/></svg>' +
        '<div class="firu-rug"></div><div class="firu-bowl"></div><div class="firu-zz">z</div>' +
        '<div class="firu-bubble" aria-live="polite"></div>' +
        '<div class="firu-stage" role="button" tabindex="0" aria-label="Acariciar a Firu">' + petSVG() + '</div>' +
      '</div>' +
      '<div class="firu-section"><div class="firu-actions">' +
        act('save', 'savings', '#f08c2e', 'Darle de comer', 'Ahorrar') +
        act('pay', 'sports_tennis', '#e0409a', 'Jugar', 'Pagar a tiempo') +
        act('budget', 'bedtime', '#2f7abf', 'Descansar', 'Presupuesto') +
        act('hormiga', 'shower', '#31a451', 'Bañar', 'Gastos hormiga') +
      '</div></div>' +
      '<div class="firu-section"><h2>Cómo está</h2><p class="firu-mood-line"></p><div class="firu-card firu-needs"></div></div>' +
      '<div class="firu-section"><h2>Crecimiento</h2><div class="firu-card firu-growth">' +
        '<div class="firu-stages"></div><div class="firu-xp"><i></i></div>' +
        '<div class="firu-meta"><span class="firu-xp-txt"></span><span class="firu-streak"></span></div>' +
        '<div class="firu-items"></div></div></div>' +
      '<div class="firu-section"><h2>Simular mis hábitos</h2>' +
        '<p>Solo para el concept: en la app real estos eventos llegan de tus movimientos.</p>' +
        '<div class="firu-card firu-sim">' +
          sim('sim-save', 'good', 'savings', 'Ahorré $10') +
          sim('sim-pay', 'good', 'task_alt', 'Pagué a tiempo') +
          sim('sim-hormiga', 'bad', 'local_cafe', 'Gasto hormiga') +
          sim('sim-over', 'bad', 'trending_up', 'Me pasé del presupuesto') +
          sim('sim-late', 'bad', 'event_busy', 'Pago atrasado') +
          sim('sim-day', 'good', 'wb_sunny', 'Pasar al día siguiente') +
          '<button class="wide" data-firu="reset"><span class="material-symbols-rounded">restart_alt</span>Reiniciar a Firu</button>' +
        '</div></div>' +
      '<div class="firu-section"><h2>Diario de Firu</h2><div class="firu-card"><ul class="firu-log"></ul></div>' +
        '<p style="margin-top:12px">Firu nunca muere ni te cobra nada. No premia gastar ni endeudarse, y acariciarlo es solo cariño: lo que lo cuida son tus hábitos.</p></div>';
    document.body.appendChild(page);

    back = document.createElement('div'); back.className = 'firu-sheet-back';
    sheet = document.createElement('div'); sheet.className = 'firu-sheet'; sheet.setAttribute('role', 'dialog');
    document.body.appendChild(back); document.body.appendChild(sheet);
    back.addEventListener('click', closeSheet);

    page.addEventListener('click', onClick);
    var st = page.querySelector('.firu-stage');
    st.addEventListener('click', pet);
    st.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pet(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && page.classList.contains('open')) { if (sheet.classList.contains('open')) closeSheet(); else close(); } });
  }
  function act(k, icon, c, title, sub) {
    return '<button class="firu-action" data-firu="' + k + '" style="--c:' + c + '"><span class="material-symbols-rounded">' + icon + '</span>' + title + '<small>' + sub + '</small></button>';
  }
  function sim(k, cls, icon, label) {
    return '<button class="' + cls + '" data-firu="' + k + '"><span class="material-symbols-rounded">' + icon + '</span>' + label + '</button>';
  }

  function paintPage() {
    if (!page) return;
    var m = mood();
    paintPet(page.querySelector('.firu-stage .firu-svg'));
    page.querySelector('.firu-scene').classList.toggle('is-night', m === 'sleep');
    page.querySelector('.firu-bowl').style.setProperty('--fill', (S.needs.food / 100).toFixed(2));
    page.querySelector('.firu-mood-line').textContent = MOOD_TXT[m] + ' · día ' + S.day;
    page.querySelector('.firu-needs').innerHTML = NEEDS.map(function (n) {
      var v = S.needs[n.k];
      return '<div class="firu-need' + (v < 35 ? ' is-low' : '') + '" style="--c:' + n.c + '">' +
        '<span class="firu-need__icon"><span class="material-symbols-rounded">' + n.icon + '</span></span>' +
        '<span class="firu-need__name">' + n.name + '</span><span class="firu-need__val">' + v + '%</span>' +
        '<span class="firu-need__bar" role="progressbar" aria-label="' + n.name + '" aria-valuenow="' + v + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + v + '%"></i></span>' +
        '<span class="firu-need__habit">' + n.habit + '</span></div>';
    }).join('');
    var si = stageIdx(), next = STAGES[si + 1];
    page.querySelector('.firu-stages').innerHTML = STAGES.map(function (s, i) {
      return '<span class="firu-stage-pill' + (i <= si ? ' is-done' : '') + '">' + s.n + '</span>';
    }).join('');
    var pct = next ? (S.xp - STAGES[si].xp) / (next.xp - STAGES[si].xp) * 100 : 100;
    page.querySelector('.firu-xp > i').style.width = pct.toFixed(0) + '%';
    page.querySelector('.firu-xp-txt').textContent = next ? S.xp + ' / ' + next.xp + ' pts para ' + next.n : S.xp + ' pts · nivel máximo';
    page.querySelector('.firu-streak').textContent = '🔥 ' + S.streak + (S.streak === 1 ? ' día' : ' días');
    page.querySelector('.firu-items').innerHTML = ITEMS.map(function (it) {
      var on = S.xp >= it.at;
      return '<span class="firu-item' + (on ? ' is-on' : '') + '"><span class="material-symbols-rounded">' + (on ? it.icon : 'lock') + '</span>' + it.name + (on ? '' : ' · ' + it.hint) + '</span>';
    }).join('');
    page.querySelector('.firu-log').innerHTML = S.log.slice(-8).reverse().map(function (l) {
      return '<li><b>Día ' + l.d + '</b><span class="' + (l.cls || '') + '">' + l.t + '</span></li>';
    }).join('');
  }

  var bubbleTimer;
  function say(txt, ms) {
    if (!page) return;
    var b = page.querySelector('.firu-bubble');
    b.textContent = txt || message();
    b.classList.remove('is-hidden');
    clearTimeout(bubbleTimer);
    if (ms) bubbleTimer = setTimeout(function () { b.textContent = message(); }, ms);
  }
  function anim(cls) {
    var st = page && page.querySelector('.firu-stage');
    if (!st) return;
    st.classList.remove('jump', 'shake'); void st.offsetWidth; st.classList.add(cls);
  }
  function burst(chars, n) {
    var st = page.querySelector('.firu-stage');
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      s.className = 'firu-fx';
      s.textContent = chars[i % chars.length];
      s.style.left = (70 + Math.random() * 60) + 'px';
      s.style.top = (40 + Math.random() * 30) + 'px';
      s.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(0) + 'px');
      s.style.animationDelay = (i * 70) + 'ms';
      st.appendChild(s);
      setTimeout(s.remove.bind(s), 1400 + i * 70);
    }
  }
  function coins(n) {
    var bowl = page.querySelector('.firu-bowl');
    for (var i = 0; i < n; i++) {
      var c = document.createElement('span');
      c.className = 'firu-coin';
      c.style.left = (bowl.offsetLeft + 10 + Math.random() * 24) + 'px';
      c.style.top = (bowl.offsetTop - 8) + 'px';
      c.style.animationDelay = (i * 90) + 'ms';
      page.querySelector('.firu-scene').appendChild(c);
      setTimeout(c.remove.bind(c), 900 + i * 90);
    }
  }

  /* ---------- Eventos (hábitos) ---------- */
  function log(t, cls) { S.log.push({ d: S.day, t: t, cls: cls }); if (S.log.length > 40) S.log.shift(); }
  function bump(k, d) { S.needs[k] = clamp(S.needs[k] + d); }
  function gainXP(n) {
    var before = stageIdx();
    S.xp += n;
    if (stageIdx() > before) {
      var st = stage();
      log('¡Subió a ' + st.n + '!', 'up');
      setTimeout(function () {
        fx('reveal'); anim('jump'); burst(['✨', '⭐', '🎉'], 9);
        var item = ITEMS.filter(function (i) { return i.at === st.xp; })[0];
        say('¡Ahora soy ' + st.n + '!' + (item ? ' Desbloqueé ' + item.name.toLowerCase() + '.' : ''), 3500);
      }, 700);
    }
  }
  var EV = {
    save: function (amt) {
      bump('food', Math.min(45, amt * 1.5 + 5)); gainXP(Math.round(amt / 2) + 5); S.saved += amt;
      log('Ahorraste $' + amt + ' → Pancita sube', 'up');
      fx('success'); anim('jump'); coins(Math.min(8, 2 + Math.round(amt / 10))); burst(['😋', '🦴'], 3);
      say('¡Ñam! $' + amt + ' más para nuestra meta. Llevamos $' + S.saved + '.', 3000);
    },
    pay: function () {
      var b = BILLS[S.bills];
      if (!b) { say('No hay pagos pendientes este mes. ¡Bien ahí!', 2500); fx('select'); return; }
      S.bills++;
      bump('joy', 28); gainXP(15);
      log('Pagaste ' + b.name + ' a tiempo → Alegría sube', 'up');
      fx('success'); anim('jump'); burst(['🎾', '💛'], 5);
      say('¡A jugar! Pagaste ' + b.name + ' (' + b.amount + ') a tiempo.', 3000);
    },
    budget: function () {
      if (S.today.budgetSeen) { say('Ya revisamos el presupuesto hoy. Mañana más 😴', 2500); fx('select'); return; }
      S.today.budgetSeen = true; bump('energy', 6); gainXP(3);
      log('Revisaste tu presupuesto → Energía sube', 'up');
      fx('select'); anim('jump');
      say('Comida 92% · Transporte 40% · Ocio 65%. Si cuidamos comida, descanso tranquilo.', 4000);
    },
    hormiga: function () {
      if (S.today.hormigaSeen) { say('Ya me bañaste hoy 🛁', 2000); fx('select'); return; }
      S.today.hormigaSeen = true; bump('clean', 8); gainXP(3);
      log('Revisaste tus gastos hormiga → Pelaje sube', 'up');
      fx('select'); anim('jump'); burst(['🫧', '🫧', '✨'], 6);
      say('Este mes: 14 cafés y 6 deliverys = $86. Con la mitad, me quedo limpiecito.', 4000);
    },
    hormigaSpend: function () {
      bump('clean', -14); bump('energy', -4); S.today.hormiga++;
      log('Gasto hormiga (café $3,50) → Pelaje baja', 'down');
      fx('warning'); anim('shake'); say('Otro cafecito… se me ensucia el pelaje ☕', 2500);
    },
    over: function () {
      bump('energy', -22); S.today.over = true;
      log('Te pasaste del presupuesto de comida → Energía baja', 'down');
      fx('warning'); anim('shake'); say('Uf, me quedé sin energía. ¿Ajustamos el presupuesto?', 2800);
    },
    late: function () {
      bump('joy', -25);
      log('Un pago se atrasó → Alegría baja', 'down');
      fx('error'); anim('shake'); say('Se atrasó un pago y me puse triste 😢. Si lo pagas hoy, se me pasa.', 3000);
    },
    day: function () {
      var t = S.today, good = !t.over && !t.hormiga;
      bump('food', -10); bump('joy', -4);
      bump('energy', t.over ? -2 : 8);
      bump('clean', t.hormiga ? 0 : 10);
      S.streak = good ? S.streak + 1 : 0;
      if (good) gainXP(5 + Math.min(10, S.streak));
      S.day++;
      S.today = { hormiga: 0, over: false, budgetSeen: false, hormigaSeen: false };
      if (S.day % 7 === 1) S.bills = 0; // nuevo ciclo de pagos en el demo
      log(good ? 'Día sin gastos hormiga ni excesos → racha ' + S.streak : 'Nuevo día', good ? 'up' : '');
      fx('swipe'); say(null);
    }
  };

  var petCount = 0, lastPet = 0;
  function pet() {
    var now = Date.now();
    petCount = now - lastPet < 4000 ? petCount + 1 : 1; lastPet = now;
    fx('select'); anim('jump'); burst(['💛'], 2);
    // Acariciar es cariño, no "puntos": nunca sube necesidades.
    if (petCount === 4) say('¡Me encanta! Pero lo que de verdad me cuida es tu ahorro 🐾', 3000);
    else if (mood() === 'sleep') say('Zzz… (para despertarme, ahorra un poquito)', 2500);
  }

  /* ---------- Hoja "Darle de comer" = ahorrar ---------- */
  var pick = 10;
  function openSheet() {
    sheet.innerHTML =
      '<div class="firu-sheet__handle"></div>' +
      '<h3>Darle de comer a Firu</h3>' +
      '<p>Mueve dinero de tu cuenta PRINCIPAL a tu meta <b>Fondo de emergencia</b>. Sigue siendo tuyo y lo puedes retirar cuando quieras.</p>' +
      '<div class="firu-chips">' + [5, 10, 20, 50].map(function (v) {
        return '<button class="push-chip' + (v === pick ? ' is-selected' : '') + '" data-amt="' + v + '">$ ' + v + '</button>';
      }).join('') + '</div>' +
      '<button class="firu-cta" data-firu="confirm-save">Ahorrar $ ' + pick + '</button>';
    sheet.querySelectorAll('[data-amt]').forEach(function (b) {
      b.addEventListener('click', function () {
        pick = +b.dataset.amt;
        sheet.querySelectorAll('[data-amt]').forEach(function (x) { x.classList.toggle('is-selected', x === b); });
        sheet.querySelector('.firu-cta').textContent = 'Ahorrar $ ' + pick;
      });
    });
    sheet.querySelector('.firu-cta').addEventListener('click', function () {
      closeSheet(); setTimeout(function () { EV.save(pick); commit(); }, 250);
    });
    back.classList.add('open'); sheet.classList.add('open'); fx('open');
  }
  function closeSheet() { back.classList.remove('open'); sheet.classList.remove('open'); }

  function onClick(e) {
    var b = e.target.closest('[data-firu]');
    if (!b) return;
    var k = b.dataset.firu;
    switch (k) {
      case 'close': close(); return;
      case 'info':
        say('Me cuidas con hábitos: ahorrar me alimenta, pagar a tiempo me alegra, el presupuesto me da energía y evitar gastos hormiga me deja limpio.', 6000);
        return;
      case 'save': openSheet(); return;
      case 'pay': EV.pay(); break;
      case 'budget': EV.budget(); break;
      case 'hormiga': EV.hormiga(); break;
      case 'sim-save': EV.save(10); break;
      case 'sim-pay': EV.pay(); break;
      case 'sim-hormiga': EV.hormigaSpend(); break;
      case 'sim-over': EV.over(); break;
      case 'sim-late': EV.late(); break;
      case 'sim-day': EV.day(); break;
      case 'reset': S = fresh(); fx('toggle'); say('¡Hola de nuevo! Soy Firu 🐾', 2500); break;
    }
    commit();
  }
  function commit() { save(); paintPage(); paintWidget(); }

  function open(origin) {
    if (!page) mountPage();
    paintPage(); say(null);
    page.scrollTop = 0;
    page.classList.add('open');
    document.body.style.overflow = 'hidden';
    fx('open');
    setTimeout(function () { anim('jump'); }, 380);
  }
  function close() {
    page.classList.remove('open');
    document.body.style.overflow = '';
    fx('close');
    paintWidget();
  }

  function init() { mountWidget(); paintWidget(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.Firu = { open: open, state: function () { return S; } };
})();
