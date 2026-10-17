/* =====================================================================
   Persona activa (datos de demostración): una sola fuente para toda la app.
   Lo elige la persona en Perfil; Mis finanzas, el saldo de Inicio y el
   saludo del asistente la leen de aquí. Los datos están en
   assets/pfm/datos.json (cuatro usuarios ficticios).
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'pb_persona', DEF = 'andres', lista = null;

  function get() { try { return localStorage.getItem(KEY) || DEF; } catch (e) { return DEF; } }
  function set(id) {
    try { localStorage.setItem(KEY, id); } catch (e) {}
    document.dispatchEvent(new CustomEvent('persona:change', { detail: id }));
  }
  var datosP = null;
  function datos() {
    if (!datosP) datosP = fetch('./assets/pfm/datos.json').then(function (r) { return r.json(); });
    return datosP;
  }
  function usuarios() { return datos().then(function (d) { return d.usuarios; }); }
  function persona(id) { return datos().then(function (d) { return d.usuarios.filter(function (u) { return u.usuario === id; })[0]; }); }
  function cuentasDe(id) { return datos().then(function (d) { return (d.cuentas && d.cuentas[id]) || []; }); }
  function deudasDe(id) { return datos().then(function (d) { return d.deudas.filter(function (x) { return x.usuario === id; }); }); }
  function email(u) { return u.usuario + '@ejemplo.ec'; }
  function iniciales(n) { return n.split(' ').slice(0, 2).map(function (w) { return w.charAt(0); }).join(''); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(v) { return '$ ' + Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  // Perfil: nombre, datos, cuentas, deudas y la lista de personas de demostración
  function pintarPerfil() {
    var view = document.querySelector('.view[data-view="4"]');
    if (!view) return;
    var id = get();
    persona(id).then(function (u) {
      if (!u) return;
      var av = view.querySelector('.profile-head__avatar'); if (av) av.textContent = iniciales(u.nombre);
      var nm = view.querySelector('.profile-head__name'); if (nm) nm.textContent = u.nombre;
      var ml = view.querySelector('.profile-head__mail'); if (ml) ml.textContent = email(u);
      return Promise.all([cuentasDe(id), deudasDe(id), usuarios()]).then(function (r) { pintarSecciones(view, r[0], r[1], r[2], id); });
    });
  }
  function pintarSecciones(view, cuentas, deudas, us, id) {
    ['persona-cuentas', 'persona-deudas', 'persona-sel'].forEach(function (x) { var o = document.getElementById(x); if (o) o.remove(); });
    var money2 = function (v) { return '$ ' + Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    var tipo = { transaccional: 'Transaccional', ahorro: 'Ahorro', meta: 'Meta', inversion: 'Inversión' };
    var cu = document.createElement('section'); cu.id = 'persona-cuentas'; cu.className = 'section';
    cu.innerHTML = '<div class="section__title"><h2>Mis cuentas</h2></div><div class="card">' + cuentas.map(function (c) {
      var sub = c.tipo === 'meta' ? 'Meta ' + money2(c.meta) : (c.numero ? '•••• ' + c.numero : '') + ' · ' + tipo[c.tipo];
      var barra = c.tipo === 'meta' ? '<span class="pf-meter__bar"><i style="width:' + Math.min(100, c.saldo / c.meta * 100).toFixed(0) + '%"></i></span>' : '';
      return '<div class="pf-meter"><span class="pf-meter__top"><span class="pf-meter__name">' + esc(c.nombre) + '</span><span class="pf-meter__right">' + money2(c.saldo) + '</span></span>' + barra + '<span class="pf-meter__sub">' + esc(sub) + '</span></div>';
    }).join('') + '</div>';
    var de = document.createElement('section'); de.id = 'persona-deudas'; de.className = 'section';
    de.innerHTML = '<div class="section__title"><h2>Mis deudas</h2></div><div class="card">' + (deudas.length ? deudas.map(function (d) {
      return '<div class="pf-meter"><span class="pf-meter__top"><span class="pf-meter__name">' + esc(d.producto) + '</span><span class="pf-meter__right">' + money2(d.saldo) + '</span></span><span class="pf-meter__sub">' + esc(d.institucion) + (d.cuota_mensual ? ' · cuota ' + money2(d.cuota_mensual) : '') + '</span></div>';
    }).join('') : '<p style="margin:0;padding:16px;color:var(--bp-theme-color-text-helper);">No tienes deudas registradas.</p>') + '</div>';
    var sel = document.createElement('section'); sel.id = 'persona-sel'; sel.className = 'section';
    sel.innerHTML = '<div class="section__title"><h2>Datos de demostración</h2></div><div class="card">' + us.map(function (u) {
      var on = u.usuario === id;
      return '<button class="sub-item" data-persona="' + u.usuario + '" aria-pressed="' + on + '">' +
        '<span class="sub-item__logo">' + esc(u.nombre.charAt(0)) + '</span>' +
        '<span class="sub-item__info"><span class="sub-item__name">' + esc(u.nombre) + ', ' + u.edad + '</span><span class="sub-item__meta">' + esc(u.tipo) + '</span></span>' +
        (on ? '<span class="material-symbols-rounded" aria-hidden="true">check_circle</span>' : '') + '</button>';
    }).join('') + '</div>';
    view.appendChild(cu); view.appendChild(de); view.appendChild(sel);
  }

  // Inicio: la tarjeta de la cuenta muestra la transaccional de la persona activa
  function pintarCuenta() {
    var id = get();
    cuentasDe(id).then(function (cs) {
      var t = cs.filter(function (c) { return c.tipo === 'transaccional'; })[0];
      if (!t) return;
      var tit = document.getElementById('account-title'); if (tit) tit.textContent = t.nombre;
      var num = document.getElementById('account-number'); if (num) num.textContent = 'Nro. ******' + t.numero;
      var el = document.getElementById('balance');
      if (el) el.textContent = '$ ' + Number(t.saldo).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-persona]');
    if (!b) return;
    set(b.dataset.persona);
    if (window.showToast) showToast('Ahora estás viendo a ' + b.querySelector('.sub-item__name').textContent.split(',')[0]);
  });
  // Después de que Mis finanzas tome la nueva persona (su propio listener)
  document.addEventListener('persona:change', function () { pintarPerfil(); pintarCuenta(); });

  window.Persona = { get: get, set: set, usuarios: usuarios, persona: persona, cuentas: cuentasDe, deudas: deudasDe };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { pintarPerfil(); pintarCuenta(); });
  else { pintarPerfil(); pintarCuenta(); }
})();
