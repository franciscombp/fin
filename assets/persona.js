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
  function usuarios() {
    if (!lista) lista = fetch('./assets/pfm/datos.json').then(function (r) { return r.json(); }).then(function (d) { return d.usuarios; });
    return lista;
  }
  function money(v) { return '$ ' + Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  // Perfil: la lista de personas de demostración, con la activa marcada
  function pintarPerfil() {
    var view = document.querySelector('.view[data-view="4"]');
    if (!view) return;
    var old = document.getElementById('persona-sel'); if (old) old.remove();
    usuarios().then(function (us) {
      var sec = document.createElement('section');
      sec.id = 'persona-sel'; sec.className = 'section';
      sec.innerHTML = '<div class="section__title"><h2>Datos de demostración</h2></div><div class="card">' + us.map(function (u) {
        var on = u.usuario === get();
        return '<button class="sub-item" data-persona="' + u.usuario + '" aria-pressed="' + on + '">' +
          '<span class="sub-item__logo">' + u.nombre.charAt(0) + '</span>' +
          '<span class="sub-item__info"><span class="sub-item__name">' + u.nombre + ', ' + u.edad + '</span><span class="sub-item__meta">' + u.tipo + '</span></span>' +
          (on ? '<span class="material-symbols-rounded" aria-hidden="true">check_circle</span>' : '') + '</button>';
      }).join('') + '</div>';
      view.appendChild(sec);
    });
  }

  // El saldo de Inicio sigue a la persona activa
  function pintarSaldo() {
    var el = document.getElementById('balance');
    if (!el || !window.PFM || !PFM.summary) return false;
    var s = PFM.summary();
    if (!s) return false;
    el.textContent = money(s.saldo);
    return true;
  }
  function esperarSaldo(n) { if (!pintarSaldo() && n < 60) setTimeout(function () { esperarSaldo(n + 1); }, 200); }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-persona]');
    if (!b) return;
    set(b.dataset.persona);
    if (window.showToast) showToast('Ahora estás viendo a ' + b.querySelector('.sub-item__name').textContent.split(',')[0]);
  });
  // Después de que Mis finanzas tome la nueva persona (su propio listener)
  document.addEventListener('persona:change', function () { pintarPerfil(); setTimeout(function () { esperarSaldo(0); }, 0); });

  window.Persona = { get: get, set: set, usuarios: usuarios };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { pintarPerfil(); esperarSaldo(0); });
  else { pintarPerfil(); esperarSaldo(0); }
})();
