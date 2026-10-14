/* =====================================================================
   Analizar con Uku (IA)
   Uku tiene dos capas: la guía (soporte, buscador, avisos y el bloque de
   cada mes) son reglas y respuestas predefinidas, sin costo por uso. El
   análisis de tu comportamiento es IA generativa: se marca siempre como IA
   y tiene acceso por plan.
   - Premium (alto valor): incluido.
   - Masivo: prueba gratis (3 análisis) y luego plan de pago.
   Un análisis por mes queda guardado: volver a abrirlo no gasta otro.
   En el prototipo la "IA" redacta con los datos que ya calcula el PFM.
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'pb_uku_ai', TRIAL = 3;
  var PLANS = { premium: 'Premium · cuenta Black (incluido)', trial: 'Masivo · prueba gratis', ended: 'Masivo · prueba usada' };
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  var st = load() || { plan: 'trial', left: TRIAL, done: {} };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function T(s, v) { return window.I18n ? I18n.t(s, v) : s.replace(/\{(\w+)\}/g, function (m, k) { return v && k in v ? v[k] : m; }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function A() { return window.Asistente; }
  function money(v) { return A().money(v); }
  function pct(v) { return Math.round(v * 100) + '%'; }

  function access() {
    if (st.plan === 'premium') return T('Incluido en tu cuenta Black');
    if (st.plan === 'trial' && st.left > 0) return T(st.left === 1 ? 'Prueba gratis · te queda 1 análisis' : 'Prueba gratis · te quedan {n} análisis', { n: st.left });
    return T('Tu prueba gratis terminó');
  }
  function setPlan(k) {
    st.plan = k; st.done = {};
    st.left = k === 'trial' ? TRIAL : 0;
    save();
  }

  /* ---------- Lo que "redacta" la IA a partir de los datos del mes ---------- */
  function build(p) {
    var n = p.n, rate = n.inc ? n.save / n.inc : 0, diff = p.avg ? (n.spend - p.avg) / p.avg : 0;
    var sum = p.current
      ? T('En lo que va de {mes} llevas {gasto}. Si sigues a este ritmo, el mes se parece a tus meses normales.', { mes: p.mes, gasto: money(n.spend) })
      : T('En {mes} gastaste {gasto}, {comp} tu promedio de {prom}.', { mes: p.mes, gasto: money(n.spend), prom: money(p.avg),
          comp: Math.abs(diff) < .03 ? T('casi igual que') : T(diff > 0 ? '{pct} más que' : '{pct} menos que', { pct: pct(Math.abs(diff)) }) }) +
        ' ' + (n.save ? T('Ahorraste {monto}, el {pct} de lo que te entró.', { monto: money(n.save), pct: pct(rate) }) : T('Este mes no ahorraste.')) +
        (p.over.length ? ' ' + T('Lo que más pesó fue {cat}, donde te pasaste {monto}.', { cat: p.over[0].name.toLowerCase(), monto: money(p.over[0].over) }) : '');
    var finds = p.ins.slice(0, 3).map(function (x) { return { icon: x.icon, t: x.title, s: x.sub }; });
    var plan = [];
    if (p.card && p.card.interest > 0) plan.push({ t: T('Paga el total de tu Mastercard Black'), s: T('Así dejas de pagar unos {monto} de intereses al mes.', { monto: money(p.card.interest) }), k: 'go:Pagar tarjeta', b: T('Pagar tarjeta') });
    if (p.over.length) plan.push({ t: T('Ponle un tope a {cat}', { cat: p.over[0].name.toLowerCase() }), s: T('Con {monto} al mes te alcanza sin pasarte.', { monto: money(p.over[0].budget) }), k: 'budgets', b: T('Ajustar presupuesto') });
    var late = (p.goals || []).filter(function (g) { return !g.onTrack; })[0];
    if (late) plan.push({ t: T('Pasa {monto} más al mes a {meta}', { monto: money(late.need - late.monthly), meta: late.name }), s: T('Con eso llegas a tiempo a tu meta.') });
    if (rate >= .08) plan.push({ t: T('Mantén tu ahorro de {monto}', { monto: money(n.save) }), s: T('Vas bien: es más de lo que ahorra la mayoría.') });
    var qs = p.ins.map(function (x) { return x.ask; }).filter(Boolean);
    ['¿En qué se me va la plata?', '¿Cuánto más puedo ahorrar?', '¿Cómo voy con mis metas?'].forEach(function (q) { if (qs.indexOf(q) < 0) qs.push(q); });
    return { sum: sum, finds: finds, plan: plan.slice(0, 3), qs: qs.slice(0, 4) };
  }

  /* ---------- Pantalla ---------- */
  var page, body, input, cur = null;
  function mount() {
    page = document.createElement('div');
    page.className = 'ai-page';
    page.setAttribute('role', 'dialog'); page.setAttribute('aria-modal', 'true'); page.setAttribute('aria-label', T('Análisis de Uku'));
    page.innerHTML =
      '<header class="ai-top"><button class="ai-round" data-ai="close" aria-label="Volver"><span class="material-symbols-rounded">arrow_back</span></button>' +
        '<p class="ai-top__t">' + T('Análisis de {nombre}', { nombre: A().name() }) + '</p><span class="ai-badge">IA</span></header>' +
      '<div class="ai-body"></div>' +
      '<form class="ai-composer"><span class="ai-composer__spark material-symbols-rounded" aria-hidden="true">auto_awesome</span>' +
        '<input type="text" enterkeyhint="send" autocomplete="off" aria-label="' + T('Pregúntale a Uku sobre tus finanzas') + '" placeholder="' + T('Pregúntale a Uku sobre tus finanzas') + '">' +
        '<button class="ai-send" type="submit" aria-label="Enviar"><span class="material-symbols-rounded">arrow_upward</span></button></form>';
    document.body.appendChild(page);
    body = page.querySelector('.ai-body'); input = page.querySelector('input');
    page.addEventListener('click', onClick);
    page.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); var v = input.value.trim(); if (v) { input.value = ''; askQ(v); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && page.classList.contains('open')) { e.stopImmediatePropagation(); close(); } }, true);
  }
  function head(p) {
    return '<section class="ai-head"><span class="ai-head__face">' + A().faceIMG() + '</span>' +
      '<div><p class="ai-head__t">' + T(p.current ? 'Cómo vas en {mes}' : 'Tu {mes}, analizado', { mes: p.mes }) + '</p>' +
      '<p class="ai-head__s">' + T('{nombre} está {animo}', { nombre: A().name(), animo: p.moodLabel }) + ' · ' + esc(access()) + '</p></div></section>';
  }
  var STEPS = ['Leyendo tus {n} movimientos…', 'Comparando con tus meses anteriores…', 'Armando tu plan…'];
  function thinking(p) {
    var i = 0;
    body.innerHTML = head(p) + '<section class="ai-think" aria-live="polite"><p class="ai-think__t"><span class="ai-spark-anim material-symbols-rounded">auto_awesome</span><span>' +
      T(STEPS[0], { n: p.txCount || 60 }) + '</span></p><i></i><i></i><i></i><i></i></section>';
    var tt = body.querySelector('.ai-think__t span:last-child');
    clearInterval(thinking.t);
    thinking.t = setInterval(function () { i = Math.min(STEPS.length - 1, i + 1); tt.textContent = T(STEPS[i], { n: p.txCount || 60 }); }, 520);
  }
  function result(p, ask) {
    clearInterval(thinking.t);
    var r = build(p);
    body.innerHTML = head(p) +
      '<section class="ai-card ai-sum"><p class="ai-label"><span class="material-symbols-rounded">auto_awesome</span>' + T('En resumen') + '</p>' +
        '<p class="ai-lead">' + esc(p.hint) + '</p><p class="ai-text">' + r.sum + '</p></section>' +
      '<section class="ai-sec"><h2>' + T('Lo que encontré') + '</h2><div class="ai-card ai-list">' + r.finds.map(function (f) {
        return '<div class="ai-row"><span class="ai-row__ic material-symbols-rounded" aria-hidden="true">' + f.icon + '</span><div><b>' + f.t + '</b><p>' + f.s + '</p></div></div>';
      }).join('') + '</div></section>' +
      (r.plan.length ? '<section class="ai-sec"><h2>' + T('Tu plan') + '</h2><div class="ai-card ai-list">' + r.plan.map(function (s, i) {
        return '<div class="ai-row ai-step"><span class="ai-step__n">' + (i + 1) + '</span><div><b>' + esc(s.t) + '</b><p>' + esc(s.s) + '</p>' +
          (s.k ? '<button class="ai-step__btn" data-ai-do="' + esc(s.k) + '">' + esc(s.b) + '</button>' : '') + '</div></div>';
      }).join('') + '</div></section>' : '') +
      '<section class="ai-sec"><h2>' + T('Sigue preguntando') + '</h2><div class="ai-chips">' + r.qs.map(function (q) {
        return '<button class="ai-chip" data-ai-q="' + esc(q) + '">' + esc(q) + '</button>';
      }).join('') + '</div></section>' +
      '<div class="ai-thread" aria-live="polite"></div>' +
      '<p class="ai-legal">' + T('Análisis hecho con IA a partir de tus movimientos. Uku te orienta, no es asesoría financiera, y puede equivocarse.') + '</p>';
    page.classList.remove('is-locked');
    if (ask) askQ(ask);
  }
  function locked(p) {
    clearInterval(thinking.t);
    page.classList.add('is-locked');
    body.innerHTML = head(p) +
      '<div class="ai-blur" aria-hidden="true"><div class="ai-card"><i></i><i></i><i></i></div><div class="ai-card"><i></i><i></i><i></i><i></i></div><div class="ai-card"><i></i><i></i></div></div>' +
      '<section class="ai-wall"><span class="ai-wall__spark material-symbols-rounded" aria-hidden="true">auto_awesome</span>' +
        '<h2>' + T('Tu prueba gratis terminó') + '</h2>' +
        '<p>' + T('Con Uku Plus, Uku analiza tus finanzas con IA cada mes, te arma un plan y le preguntas lo que quieras.') + '</p>' +
        '<ul><li>' + T('Un análisis completo de cada mes') + '</li><li>' + T('Preguntas sin límite') + '</li><li>' + T('Incluido si tienes cuenta Black') + '</li></ul>' +
        '<button class="ai-wall__cta bp-button" data-ai="plans">' + T('Conocer Uku Plus') + '</button>' +
        '<button class="ai-wall__later" data-ai="close">' + T('Ahora no') + '</button></section>';
  }
  function askQ(q) {
    if (!page.classList.contains('open') || page.classList.contains('is-locked')) return;
    var th = body.querySelector('.ai-thread'); if (!th) return;
    var a = A().answer(q) || { t: T('No tengo ese dato todavía.') };
    var el = document.createElement('div'); el.className = 'ai-qa';
    el.innerHTML = '<p class="ai-q">' + esc(q) + '</p><div class="ai-card ai-a is-typing"><p class="ai-label"><span class="material-symbols-rounded">auto_awesome</span>' + A().name() + '</p>' +
      '<p class="ai-dots"><i></i><i></i><i></i></p></div>';
    th.appendChild(el); fx('tap');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () {
      var box = el.querySelector('.ai-a'); box.classList.remove('is-typing');
      box.innerHTML = '<p class="ai-label"><span class="material-symbols-rounded">auto_awesome</span>' + A().name() + '</p><div class="ai-text">' + a.t.split(/<br><br>/).map(function (x) { return '<p>' + x + '</p>'; }).join('') + '</div>' +
        (a.h ? '<div class="ai-a__viz">' + a.h + '</div>' : '') +
        (a.s && a.s.length ? '<div class="ai-chips">' + a.s.slice(0, 3).map(function (x) { return '<button class="ai-chip" data-ai-q="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' : '');
      fx('reveal');
    }, 700);
  }
  function onClick(e) {
    var b = e.target.closest('[data-ai],[data-ai-q],[data-ai-do]');
    if (!b) return;
    if (b.dataset.aiQ) return askQ(b.dataset.aiQ);
    if (b.dataset.aiDo) { var k = b.dataset.aiDo; close(); setTimeout(function () { A().pf(k); }, 260); return; }
    var k2 = b.dataset.ai;
    if (k2 === 'close') return close();
    if (k2 === 'plans') { fx('select'); toast(T('Los planes y precios los define el área de negocio. Esto es un prototipo.')); }
  }
  var toastT;
  function toast(t) {
    var el = document.querySelector('.pf-toast');
    if (!el) { el = document.createElement('div'); el.className = 'pf-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  function open(o) {
    if (!A()) return;
    if (!page) mount();
    o = o || {};
    var p = A().pack(o.view || 'sep');
    cur = p.key;
    page.classList.add('open'); document.documentElement.classList.add('has-ai');
    if (window.Overlay) Overlay.push('ai', close);
    fx('open');
    body.scrollTop = 0; page.scrollTop = 0;
    var ok = st.plan === 'premium' || st.done[p.key];
    if (!ok && st.plan === 'trial' && st.left > 0) { st.left--; st.done[p.key] = true; save(); ok = true; }
    if (!ok) return locked(p);
    thinking(p);
    setTimeout(function () { if (cur === p.key) result(A().pack(p.key), o.ask); }, 1600);
  }
  function close() {
    if (!page || !page.classList.contains('open')) return;
    clearInterval(thinking.t);
    page.classList.remove('open'); document.documentElement.classList.remove('has-ai');
    if (window.Overlay) Overlay.done('ai');
    fx('close');
    if (window.Asistente && Asistente.pf) try { Asistente.pf('repaint'); } catch (e) {}
  }

  window.UkuAnalisis = { open: open, close: close, access: access, plan: function () { return st.plan; }, setPlan: setPlan, plans: function () { return PLANS; } };
})();
