/* =====================================================================
   Soporte con Uku
   Uku es la puerta de entrada: entiende el problema, resuelve lo que se
   pueda con ayudas paso a paso y, si no alcanza, pasa el caso a una
   persona (chat con un asesor, call center o "que te llamemos") con un
   resumen, para que no tengas que repetir nada. Cuando entra el asesor,
   Uku deja de responder. Todo es simulado (sin backend).
   ===================================================================== */
(function () {
  'use strict';

  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function face() { return window.Asistente ? Asistente.faceIMG() : ''; }
  function uku() { return (window.Asistente && Asistente.name && Asistente.name()) || 'Uku'; }
  function firstName() { var n = document.querySelector('.profile-head__name'); return n ? n.textContent.trim().split(' ')[0] : ''; }

  var CASE = '#48213', PHONE = '1700 742 424', AGENT = { name: 'Andrea Ruiz', ini: 'AR' };
  /* Ayudas frecuentes: respuesta corta + pasos + acciones en la app */
  var FAQ = [
    { icon: 'credit_card_off', t: 'Perdí mi tarjeta o me la robaron', k: 'perdi perdida robaron robo bloquear tarjeta extravie extravio',
      a: 'Lo primero es bloquearla para que nadie la use. Es inmediato y, si la encuentras, la desbloqueas desde el mismo lugar.',
      steps: ['Entra a Tarjetas y elige la tarjeta', 'Toca «Bloquear»', 'Si fue robo, pide una nueva desde ahí mismo'], acts: [['Ir a mis tarjetas', 'tab:Tarjetas']] },
    { icon: 'report', t: 'No reconozco un cobro', k: 'no reconozco cobro cargo raro fraude debito desconocido consumo',
      a: 'A veces el comercio aparece con otro nombre (por ejemplo, PAYPAL *SPOTIFY). Revisa tus movimientos; si de verdad no lo hiciste, bloquea la tarjeta y abrimos un reclamo con un asesor.',
      acts: [['Ver mis movimientos', 'tab:Cuentas'], ['Abrir un reclamo', 'handoff']] },
    { icon: 'sync_alt', t: 'Mi transferencia no llegó', k: 'transferencia no llego llega demora interbancaria pendiente deposito',
      a: 'Entre cuentas Pichibank llega al instante. A otros bancos puede tardar hasta 24 horas hábiles si la hiciste después de las 15:00 o en fin de semana.',
      acts: [['Ver mis movimientos', 'tab:Cuentas']] },
    { icon: 'password', t: 'Olvidé mi clave', k: 'olvide clave contrasena password usuario bloqueado acceso entrar pin',
      a: 'Puedes crear una nueva con tu cédula y un código que te llega por SMS. Toma menos de 2 minutos.',
      acts: [['Ir a Seguridad', 'do:Seguridad']] },
    { icon: 'atm', t: '¿Cómo retiro sin tarjeta?', k: 'retirar retiro sin tarjeta cajero codigo efectivo',
      a: 'Genera un código en «Retirar sin tarjeta», elige el monto y úsalo en cualquier cajero Pichibank en las próximas 2 horas.',
      acts: [['Retirar sin tarjeta', 'do:Retirar sin tarjeta']] },
    { icon: 'description', t: 'Necesito un certificado bancario', k: 'certificado bancario referencia carta documento',
      a: 'Lo descargas al instante en PDF, firmado electrónicamente y sin costo.',
      acts: [['Pedir certificado', 'do:Certificado bancario']] }
  ];
  var CONTACT = [
    ['chat', 'Chat con un asesor', 'Te responde una persona · espera aprox. 2 min', 'agent'],
    ['call', 'Llamar al call center', PHONE + ' · las 24 horas', 'call'],
    ['phone_callback', 'Que te llamemos', 'Elige cuándo y te llama un asesor', 'callback']
  ];

  var el, log, input, topic = null, withAgent = false, agentN = 0;

  function mount() {
    el = document.createElement('div');
    el.className = 'sp';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Ayuda');
    el.innerHTML =
      '<header class="sp-top"><button class="pf-round" data-sp="back" aria-label="Volver"><span class="material-symbols-rounded">arrow_back</span></button>' +
        '<span class="sp-top__title"><b>Ayuda</b><small></small></span><span></span></header>' +
      '<div class="sp-body">' +
        '<div class="sp-hub">' +
          '<div class="sp-hello"></div>' +
          '<section class="sp-sec"><h2>Temas frecuentes</h2><div class="sp-list">' + FAQ.map(function (f, i) {
            return '<button class="sp-row" data-sp="faq:' + i + '"><span class="sp-row__ic material-symbols-rounded">' + f.icon + '</span><span class="sp-row__main"><b>' + f.t + '</b></span><span class="material-symbols-rounded">chevron_right</span></button>';
          }).join('') + '</div></section>' +
          '<section class="sp-sec"><h2>Hablar con una persona</h2><div class="sp-list">' + CONTACT.map(function (c) {
            return '<button class="sp-row" data-sp="' + c[3] + '"><span class="sp-row__ic material-symbols-rounded">' + c[0] + '</span><span class="sp-row__main"><b>' + c[1] + '</b><small>' + c[2] + '</small></span><span class="material-symbols-rounded">chevron_right</span></button>';
          }).join('') + '</div></section>' +
        '</div>' +
        '<div class="sp-log" aria-live="polite"></div>' +
      '</div>' +
      '<form class="sp-composer"><input type="text" enterkeyhint="send" autocomplete="off" placeholder="Cuéntame qué pasó" aria-label="Escribe tu problema">' +
        '<button class="sp-send" aria-label="Enviar"><span class="material-symbols-rounded">arrow_upward</span></button></form>';
    document.body.appendChild(el);
    log = el.querySelector('.sp-log');
    input = el.querySelector('input');
    el.addEventListener('click', onClick);
    el.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim(); if (!v) return;
      input.value = ''; send(v);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el.classList.contains('open')) { e.stopImmediatePropagation(); back(); }
    }, true);
  }

  /* ---------- Mensajes ---------- */
  function scrollEnd() { var b = el.querySelector('.sp-body'); requestAnimationFrame(function () { b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' }); }); }
  function add(html) { var d = document.createElement('div'); d.innerHTML = html; var n = d.firstChild; log.appendChild(n); scrollEnd(); return n; }
  function btns(list) {
    return list && list.length ? '<div class="sp-acts">' + list.map(function (b) {
      return b[1].indexOf('tel:') === 0 ? '<a class="sp-act" href="' + b[1] + '">' + b[0] + '</a>' : '<button class="sp-act" data-sp="' + b[1] + '">' + b[0] + '</button>';
    }).join('') + '</div>' : '';
  }
  function me(t) { add('<div class="sp-msg sp-msg--me"><p>' + esc(t) + '</p></div>'); }
  function sys(t) { add('<p class="sp-sys">' + t + '</p>'); }
  // Uku "escribe" un momento antes de responder
  function say(html, acts, delay) {
    var typing = add('<div class="sp-msg sp-msg--uku"><span class="sp-av">' + face() + '</span><div class="sp-msg__body"><p class="sp-typing"><i></i><i></i><i></i></p></div></div>');
    setTimeout(function () {
      typing.querySelector('.sp-msg__body').innerHTML = '<p>' + html + '</p>' + btns(acts);
      scrollEnd();
    }, delay == null ? 650 : delay);
  }
  function agentSay(t, delay) {
    var typing = add('<div class="sp-msg sp-msg--agent"><span class="sp-av sp-av--agent">' + AGENT.ini + '</span><div class="sp-msg__body"><small>' + AGENT.name + '</small><p class="sp-typing"><i></i><i></i><i></i></p></div></div>');
    setTimeout(function () { typing.querySelector('.sp-typing').outerHTML = '<p>' + esc(t) + '</p>'; scrollEnd(); fx('select'); }, delay || 1200);
  }

  /* ---------- Conversación ---------- */
  function chat() { el.classList.add('is-chat'); }
  function answer(i) {
    var f = FAQ[i]; topic = f.t; chat();
    me(f.t);
    say(esc(f.a) + (f.steps ? '<ol>' + f.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : ''), f.acts);
    setTimeout(function () { say('¿Esto resolvió tu problema?', [['Sí, gracias', 'ok'], ['No, hablar con una persona', 'handoff']], 500); }, 1100);
  }
  function handoff() {
    say('Te paso con una persona del banco. Le cuento lo que ya hablamos para que no tengas que repetirlo. ¿Cómo prefieres?',
      CONTACT.map(function (c) { return [c[1], c[3]]; }));
  }
  function summary() {
    return '<span class="sp-case"><b>Resumen para el asesor · caso ' + CASE + '</b>' +
      '<span>Tema: ' + esc(topic || 'Consulta general') + '</span>' +
      '<span>Cliente verificado en la app' + (firstName() ? ' (' + esc(firstName()) + ')' : '') + '</span>' +
      '<span>Ya revisó: ' + (FAQ.some(function (f) { return f.t === topic; }) ? 'la ayuda de este tema' : 'las ayudas frecuentes') + '</span></span>';
  }
  function toAgent() {
    if (withAgent) return;
    chat();
    say('Listo, te conecto. Esto es lo que le paso:' + summary(), null, 500);
    setTimeout(function () { sys('Buscando un asesor disponible…'); }, 1300);
    setTimeout(function () {
      withAgent = true; el.classList.add('is-agent');
      el.querySelector('.sp-top__title b').textContent = AGENT.name;
      el.querySelector('.sp-top__title small').textContent = 'Asesora de Pichibank';
      input.placeholder = 'Escríbele a ' + AGENT.name.split(' ')[0];
      sys(AGENT.name + ' se unió al chat. Desde aquí te responde una persona, no ' + uku() + '.');
      fx('success');
      agentSay('Hola' + (firstName() ? ', ' + firstName() : '') + '. Soy Andrea. Ya vi tu caso sobre «' + (topic || 'tu consulta') + '». ¿Me cuentas la fecha y el monto aproximado para revisarlo?', 1400);
    }, 3000);
  }
  var AGENT_REPLIES = ['Gracias, ya lo estoy revisando. Dame un momento, por favor.', 'Listo, lo registré en tu caso ' + CASE + '. Te llega un correo con el detalle y la respuesta en máximo 48 horas.', '¿Hay algo más en lo que te pueda ayudar?'];
  function send(t) {
    chat(); me(t);
    if (withAgent) { agentSay(AGENT_REPLIES[Math.min(agentN++, AGENT_REPLIES.length - 1)], 1600); return; }
    var q = norm(t);
    if (/(persona|asesor|humano|agente|llamar|llamen|call)/.test(q)) { topic = topic || t; return handoff(); }
    if (/(gast|ahorr|presupuest|metas?\b|cuanto tengo)/.test(q)) {
      return say('Eso lo vemos mejor en Mis finanzas: ahí tienes tus gastos, presupuestos y metas, y te acompaño con lo que noto.', [['Ir a Mis finanzas', 'pfm']]);
    }
    var best = -1, bs = 0;
    FAQ.forEach(function (f, i) {
      var s = 0, k = ' ' + norm(f.t + ' ' + f.k) + ' ';
      q.split(/\s+/).forEach(function (w) { if (w.length > 2 && k.indexOf(w) >= 0) s++; });
      if (s > bs) { bs = s; best = i; }
    });
    topic = best >= 0 ? FAQ[best].t : t;
    if (best >= 0) {
      var f = FAQ[best];
      say('Creo que es esto: <b>' + esc(f.t) + '</b>. ' + esc(f.a), f.acts);
      setTimeout(function () { say('¿Te sirvió?', [['Sí, gracias', 'ok'], ['No, hablar con una persona', 'handoff']], 500); }, 1100);
    } else {
      say('No estoy seguro de poder resolver esto por aquí. Mejor te paso con una persona; le cuento lo que me dijiste.', CONTACT.map(function (c) { return [c[1], c[3]]; }));
    }
  }

  function onClick(e) {
    var b = e.target.closest('[data-sp]');
    if (!b) return;
    var k = b.dataset.sp;
    fx('select');
    // Elegir una opción de contacto deja la elección como respuesta y quita las demás
    var grp = /^(agent|call|callback)$/.test(k) && b.closest('.sp-acts');
    if (grp) { grp.remove(); me(b.textContent); }
    if (k === 'back') return back();
    if (k.indexOf('faq:') === 0) return answer(+k.slice(4));
    if (k === 'ok') { b.closest('.sp-acts').remove(); me('Sí, gracias'); return say('¡Qué bueno! Aquí estoy si necesitas algo más.'); }
    if (k === 'handoff') { chat(); var a = b.closest('.sp-acts'); if (a) { a.remove(); me(b.textContent); } return handoff(); }
    if (k === 'agent') return toAgent();
    if (k === 'call') {
      chat();
      return say('Llama al <b>' + PHONE + '</b> (las 24 horas). Dale este código al asesor y ya sabrá de qué se trata: <b>' + CASE + '</b>.', [['Llamar ahora', 'tel:' + PHONE.replace(/\s/g, '')]]);
    }
    if (k === 'callback') {
      chat();
      return say('¿Cuándo te llamamos al 099 *** 4521?', [['Ahora', 'cb:en unos minutos'], ['En 30 minutos', 'cb:en 30 minutos'], ['Mañana en la mañana', 'cb:mañana entre 9:00 y 11:00']]);
    }
    if (k.indexOf('cb:') === 0) {
      b.closest('.sp-acts').remove(); me(b.textContent); fx('success');
      return say('Listo. Un asesor te llama ' + esc(k.slice(3)) + '. Ya tiene el resumen de tu caso ' + CASE + ', así que no tendrás que repetir nada.');
    }
    if (k === 'pfm') { close(); setTimeout(function () { window.Asistente && Asistente.openPF(); }, 300); return; }
    if (k.indexOf('tab:') === 0) {
      var tab = k.slice(4); close();
      setTimeout(function () {
        if (window.__goView) window.__goView(0);
        var t = document.querySelector('.tabs .tab[data-panel="' + tab + '"]'); if (t) t.click();
      }, 300);
      return;
    }
    if (k.indexOf('do:') === 0) {
      var act = k.slice(3); close();
      setTimeout(function () {
        var x = document.querySelector('#home-page [data-action="' + act + '"]') || document.querySelector('[data-action="' + act + '"]');
        if (x) x.click();
      }, 300);
    }
  }

  function reset() {
    log.innerHTML = ''; topic = null; withAgent = false; agentN = 0;
    el.classList.remove('is-chat', 'is-agent');
    el.querySelector('.sp-top__title b').textContent = 'Ayuda';
    el.querySelector('.sp-top__title small').textContent = '';
    input.placeholder = 'Cuéntame qué pasó';
  }
  function open() {
    if (!el) mount();
    if (!withAgent) reset(); // con un asesor conectado, la conversación sigue
    el.querySelector('.sp-hello').innerHTML = '<span class="sp-av">' + face() + '</span><p>Hola' + (firstName() ? ', ' + esc(firstName()) : '') + '. Soy ' + uku() +
      '. Cuéntame qué pasó: te guío con la solución o, si hace falta, te paso con una persona del banco.</p>';
    if (!withAgent) el.querySelector('.sp-body').scrollTop = 0;
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
    fx('open');
  }
  // Volver: del chat al inicio de Ayuda; desde ahí, cerrar
  function back() {
    if (el.classList.contains('is-chat') && !withAgent) { reset(); el.querySelector('.sp-body').scrollTop = 0; return; }
    close();
  }
  function close() {
    el.classList.remove('open');
    if (!document.querySelector('.as-page.open, .push-page.open, .card-detail.open')) document.body.style.overflow = '';
    fx('close');
  }

  // El ícono de soporte (audífonos) y "Ayuda" del Perfil abren esta pantalla
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action="Soporte"], [data-action="Ayuda"]');
    if (!b || (el && el.contains(b))) return;
    e.stopImmediatePropagation(); e.preventDefault();
    open();
  }, true);

  window.Soporte = { open: open };
})();
