// Último ingreso en el login (se quitó el 23 oct 2026). Se guardaba en localStorage 'pb_ultimo_ingreso' al entrar.
  function pintarUltimo() {
    var p = document.getElementById('login-ultimo');
    if (!p) return;
    var u = null;
    try { u = JSON.parse(leer(ULTIMO_KEY) || 'null'); } catch (x) {}
    p.hidden = !u;
    if (!u) return;
    p.textContent = '';
    var no = h('button', { type: 'button', class: 'login-ultimo__link', text: '¿No fuiste tú?' });
    no.addEventListener('click', function () { Ingreso.bloquear('robo', volver); });
    p.append(icono('history'), h('span', { text: 'Último ingreso: ' + cuando(u.t) + ' en ' + u.equipo + '. ' }), no);
  }
  function equipo() {
    var ua = navigator.userAgent || '';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/Android/.test(ua)) return 'celular Android';
    return 'computadora';
  }
