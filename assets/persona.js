/* =====================================================================
   Persona activa (datos de demostración): una sola fuente para toda la app.
   Lo elige la persona en Perfil; Mis finanzas, el saldo de Inicio y el
   saludo del asistente la leen de aquí. Los datos están en
   assets/pfm/datos.json (usuarios ficticios; una persona nueva sin movimientos).
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

  // Perfil: nombre, datos y la lista de personas de demostración (cuentas y deudas van en Inicio y Mis finanzas)
  // Nombre y iniciales de la persona activa: saludo de bienvenida, avatar de la barra y Perfil
  function pintarPerfil() {
    var id = get();
    persona(id).then(function (u) {
      if (!u) return;
      var wn = document.getElementById('welcome-name'); if (wn) wn.textContent = ', ' + u.nombre.split(' ')[0];
      var ps = document.querySelector('.profile-story'); if (ps) ps.setAttribute('aria-label', 'Perfil de ' + u.nombre);
      var view = document.querySelector('.view[data-view="4"]');
      if (!view) return;
      var av = view.querySelector('.profile-head__avatar'); if (av) av.textContent = iniciales(u.nombre);
      var nm = view.querySelector('.profile-head__name'); if (nm) nm.textContent = u.nombre;
      var ml = view.querySelector('.profile-head__mail'); if (ml) ml.textContent = email(u);
      return usuarios().then(function (us) { pintarSecciones(view, us, id); });
    });
  }
  function pintarSecciones(view, us, id) {
    var viejo = document.getElementById('persona-sel'); if (viejo) viejo.remove();
    var sel = document.createElement('section'); sel.id = 'persona-sel'; sel.className = 'section';
    sel.innerHTML = '<div class="section__title"><h2>Datos de demostración</h2></div><div class="card">' + us.map(function (u) {
      var on = u.usuario === id;
      return '<button class="sub-item" data-persona="' + u.usuario + '" aria-pressed="' + on + '">' +
        '<span class="sub-item__logo">' + esc(u.nombre.charAt(0)) + '</span>' +
        '<span class="sub-item__info"><span class="sub-item__name">' + esc(u.nombre) + ', ' + u.edad + '</span><span class="sub-item__meta">' + esc(u.tipo) + '</span></span>' +
        (on ? '<span class="material-symbols-rounded" aria-hidden="true">check_circle</span>' : '') + '</button>';
    }).join('') + '</div>';
    view.appendChild(sel);
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
    var nombre = b.querySelector('.sub-item__name').textContent.split(',')[0];
    set(b.dataset.persona);
    if (window.__goView) window.__goView(0);
    if (window.showToast) showToast('Ahora estás viendo a ' + nombre);
  });
  // Después de que Mis finanzas tome la nueva persona (su propio listener)
  document.addEventListener('persona:change', function () { pintarPerfil(); pintarCuenta(); });

  window.Persona = { get: get, set: set, usuarios: usuarios, persona: persona, cuentas: cuentasDe, deudas: deudasDe };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { pintarPerfil(); pintarCuenta(); });
  else { pintarPerfil(); pintarCuenta(); }
})();
