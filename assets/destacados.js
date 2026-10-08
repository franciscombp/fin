/* =====================================================================
   Destacados — widgets del Home (según RDA "Widgets de Destacados")
   - Catálogo de familias; una familia = un widget; máx. slotsMax (2).
   - Modo por defecto: captaciones elegibles primero, luego informativos,
     según el orden base. Modo personalizado: lo elige el cliente, sin
     autocompletar. Restablecer vuelve al modo por defecto.
   - Solo los widgets activos "consultan" datos (aquí: se resuelven).
   - Sin alertas: avisos importantes van a Notificaciones.
   - Montos marcados sensitive se enmascaran con el ojo de saldo (front).
   - La publicidad (Promociones) es independiente y queda debajo.
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'pb_widgets_v1';
  var CONFIG = { slotsMax: 2, baseOrder: ['inversiones', 'creditos', 'seguros', 'pfm', 'pagos', 'tarjetas', 'cuentas', 'acciones'] };
  function fx(n) { try { window.Haptics && Haptics.fx && Haptics.fx(n); } catch (e) {} }
  function money(v) { var s = Math.abs(v).toFixed(2).split('.'); return '$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1]; }
  function sens(v) { return '<span class="dw-s"><span class="dw-s__v">' + v + '</span><span class="dw-s__m" aria-hidden="true">••••</span></span>'; }

  /* Catálogo (configuración). eligible = elegibilidad de captación;
     owned = tenencia del producto (informativo). */
  var CATALOG = {
    cuentas:    { name: 'Cuentas', icon: 'account_balance', owned: true },
    inversiones:{ name: 'Inversiones', icon: 'trending_up', owned: false, eligible: true },
    creditos:   { name: 'Créditos', icon: 'request_quote', owned: false, eligible: false },
    tarjetas:   { name: 'Tarjetas', icon: 'credit_card', owned: true },
    seguros:    { name: 'Seguros', icon: 'health_and_safety', owned: false, eligible: false },
    pagos:      { name: 'Pagos', icon: 'event', owned: true, functional: true },
    pfm:        { name: 'Mis finanzas', icon: 'insights', owned: true, functional: true },
    acciones:   { name: 'Acciones rápidas', icon: 'bolt', owned: true, functional: true }
  };

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { mode: 'default', active: [] }; } catch (e) { return { mode: 'default', active: [] }; } }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  var pref = load();

  function resolveActive() {
    if (pref.mode === 'custom') return pref.active.filter(function (id) { return CATALOG[id]; }).slice(0, CONFIG.slotsMax);
    var acq = CONFIG.baseOrder.filter(function (id) { return !CATALOG[id].owned && CATALOG[id].eligible; });
    var inf = CONFIG.baseOrder.filter(function (id) { return CATALOG[id].owned && id !== 'acciones'; });
    return acq.concat(inf).slice(0, CONFIG.slotsMax); // si hay menos, el slot se omite
  }

  /* Datos por widget (en producción: BFF /v1/widgets/destacados) */
  function click(sel) { var e = document.querySelector(sel); if (e) e.click(); }
  function act(a) { click('#home-page [data-action="' + a + '"]'); }
  var RENDER = {
    cuentas: function () {
      return { body: '<p class="dw-label">Intereses generados este mes</p><p class="dw-value">' + sens(money(3.12)) + '</p><p class="dw-sub">Cuenta PRINCIPAL ··7890</p>', go: function () { act('Cuenta Ahorro transaccional'); } };
    },
    tarjetas: function () {
      return { body: '<p class="dw-label">Cupo disponible</p><p class="dw-value">' + sens(money(4985)) + '</p><p class="dw-sub">Mastercard Black · pagas el 5 nov</p>', go: function () { act('Mastercard Black'); } };
    },
    pagos: function () {
      return { body: '<p class="dw-label">Próximos pagos</p>' +
        '<button class="dw-item" data-dw-pay="Pagar Luz de la casa"><span>Luz de la casa</span><span>' + sens(money(24.8)) + '</span><small>Hoy</small></button>' +
        '<button class="dw-item" data-dw-pay="Pagar Casa de la abue"><span>Casa de la abue</span><span>' + sens(money(18.35)) + '</span><small>12 oct</small></button>',
        go: function () { act('Pagar servicios'); } };
    },
    pfm: function () {
      var d = window.Asistente && Asistente.data && Asistente.data();
      var sep = d ? d.by[1] : null, top = '';
      if (sep) {
        var cats = { super: 'Supermercado', delivery: 'Restaurantes y delivery', compras: 'Compras', servicios: 'Servicios básicos', transporte: 'Transporte', ocio: 'Ocio', subs: 'Suscripciones', cafe: 'Cafés y antojos', salud: 'Salud' };
        top = Object.keys(cats).sort(function (a, b) { return sep[b] - sep[a]; })[0];
        top = cats[top];
      }
      return { body: '<div class="dw-pfm"><div><p class="dw-label">Tus gastos de septiembre</p><p class="dw-value">' + sens(money(sep ? sep._spend : 0)) + '</p><p class="dw-sub">En lo que más gastaste: ' + top.toLowerCase() + '</p></div>' +
        '<span class="dw-pet">' + (window.Asistente && Asistente.petSVG ? Asistente.petSVG() : '') + '</span></div>',
        go: function () { window.Asistente && Asistente.openPF(); } };
    },
    acciones: function () {
      var s = [['send_money', 'Transferir', 'Transferir dinero'], ['qr_code_scanner', 'Pagar QR', 'Pagar con QR'], ['smartphone', 'Recargar', 'Recargar celular'], ['bolt', 'Servicios', 'Pagar servicios']];
      return { body: '<p class="dw-label">Lo que más usas</p><div class="dw-short">' + s.map(function (x) { return '<button data-dw-act="' + x[2] + '"><span class="material-symbols-rounded">' + x[0] + '</span>' + x[1] + '</button>'; }).join('') + '</div>' };
    },
    inversiones: function () {
      return { body: '<p class="dw-label">Inversiones</p><p class="dw-promo">Tu dinero puede crecer <b>7,25% al año</b> mientras sigue disponible.</p><span class="dw-cta">Invertir desde $ 100</span>', go: function () { act('Crear inversión'); } };
    },
    creditos: function () {
      return { body: '<p class="dw-label">Créditos</p><p class="dw-promo">Tienes un crédito <b>preaprobado</b> listo para usar.</p><span class="dw-cta">Simular</span>', go: function () { act('Simular crédito preaprobado'); } };
    },
    seguros: function () {
      return { body: '<p class="dw-label">Seguros</p><p class="dw-promo">Protege lo que importa desde <b>$ 4 al mes</b>.</p><span class="dw-cta">Ver seguros</span>', go: function () { act('Seguro de vida'); } };
    }
  };

  var host, gos = {};
  function mount() {
    var panel = document.querySelector('.tab-panel[data-panel="Destacado"]');
    if (!panel || document.getElementById('dw-host')) return;
    var old = Array.prototype.find.call(panel.querySelectorAll('.section'), function (s) {
      var h = s.querySelector('.section__title h2'); return h && /Novedades/.test(h.textContent);
    });
    host = document.createElement('section');
    host.className = 'section dw-section';
    host.id = 'dw-host';
    host.innerHTML = '<div class="section__title"><h2>Destacados</h2><button class="section__link" data-dw="edit">Personalizar</button></div><div class="dw-list"></div>';
    if (old) { old.parentNode.insertBefore(host, old); old.hidden = true; } else panel.appendChild(host);
    host.addEventListener('click', onClick);
    // Ojo de saldo global (solo front)
    var eye = document.getElementById('balance-toggle');
    var sync = function () { document.documentElement.classList.toggle('pb-masked', eye && eye.getAttribute('aria-pressed') === 'true'); };
    if (eye) new MutationObserver(sync).observe(eye, { attributes: true, attributeFilter: ['aria-pressed'] });
    sync();
  }
  function paint() {
    if (!host) return;
    var ids = resolveActive(), list = host.querySelector('.dw-list');
    gos = {};
    list.innerHTML = ids.map(function (id) {
      var r = RENDER[id](), c = CATALOG[id], state = c.owned ? 'informational' : 'acquisition';
      gos[id] = r.go;
      return '<article class="dw dw--' + state + '" data-dw-id="' + id + '"' + (r.go ? ' role="button" tabindex="0"' : '') + '>' + r.body + '</article>';
    }).join('') || '<p class="dw-empty">No elegiste widgets. <button class="pf-link" data-dw="reset">Restablecer sugeridos</button></p>';
  }
  function onClick(e) {
    var b;
    if ((b = e.target.closest('[data-dw="edit"]'))) { e.stopPropagation(); return openEditor(); }
    if ((b = e.target.closest('[data-dw="reset"]'))) { pref = { mode: 'default', active: [] }; save(pref); paint(); return; }
    if ((b = e.target.closest('[data-dw-pay]'))) { e.stopPropagation(); return click('.list-item[data-sheet="payment"][data-title="' + b.dataset.dwPay + '"]'); }
    if ((b = e.target.closest('[data-dw-act]'))) { e.stopPropagation(); return act(b.dataset.dwAct); }
    if ((b = e.target.closest('[data-dw-id]')) && gos[b.dataset.dwId]) { fx('tap'); gos[b.dataset.dwId](); }
  }

  /* Personalización: agregar, quitar, reordenar, restablecer */
  var sheet, back;
  function openEditor() {
    if (!sheet) {
      back = document.createElement('div'); back.className = 'as-sheet-back';
      sheet = document.createElement('div'); sheet.className = 'as-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Personalizar Destacados');
      document.body.appendChild(back); document.body.appendChild(sheet);
      back.addEventListener('click', closeEditor);
      sheet.addEventListener('click', onEditor);
    }
    paintEditor();
    back.classList.add('open'); sheet.classList.add('open'); fx('open');
  }
  function closeEditor() { back.classList.remove('open'); sheet.classList.remove('open'); }
  function paintEditor() {
    var active = resolveActive();
    var rest = CONFIG.baseOrder.filter(function (id) { return active.indexOf(id) < 0; });
    sheet.innerHTML = '<div class="as-sheet__handle"></div><h3>Destacados</h3>' +
      '<p>Elige hasta ' + CONFIG.slotsMax + ' para ver en Inicio. ' + (pref.mode === 'custom' ? 'Elegidos por ti.' : 'Ahora ves los sugeridos.') + '</p>' +
      '<p class="as-sheet__label">En Inicio</p><div class="dw-ed">' +
      (active.length ? active.map(function (id, i) {
        return '<div class="dw-ed__row"><span class="dw-ed__n">' + (i + 1) + '</span><span class="dw-ed__name">' + CATALOG[id].name + '</span>' +
          '<button data-ed="up:' + id + '" aria-label="Subir"' + (i ? '' : ' disabled') + '><span class="material-symbols-rounded">arrow_upward</span></button>' +
          '<button data-ed="del:' + id + '" aria-label="Quitar"><span class="material-symbols-rounded">remove</span></button></div>';
      }).join('') : '<p class="as-note">Ninguno.</p>') + '</div>' +
      '<p class="as-sheet__label">Disponibles</p><div class="dw-ed">' + rest.map(function (id) {
        var full = active.length >= CONFIG.slotsMax;
        return '<div class="dw-ed__row"><span class="dw-ed__n material-symbols-rounded">' + CATALOG[id].icon + '</span><span class="dw-ed__name">' + CATALOG[id].name + '</span>' +
          '<button data-ed="add:' + id + '" aria-label="Agregar"' + (full ? ' disabled' : '') + '><span class="material-symbols-rounded">add</span></button></div>';
      }).join('') + '</div>' +
      (pref.mode === 'custom' ? '<button class="pf-link pf-link--block" data-ed="reset">Restablecer sugeridos</button>' : '');
  }
  function onEditor(e) {
    var b = e.target.closest('[data-ed]');
    if (!b || b.disabled) return;
    var p = b.dataset.ed.split(':'), active = resolveActive().slice();
    if (p[0] === 'reset') { pref = { mode: 'default', active: [] }; }
    else {
      var id = p[1], i = active.indexOf(id);
      if (p[0] === 'add' && active.length < CONFIG.slotsMax && i < 0) active.push(id);
      if (p[0] === 'del' && i >= 0) active.splice(i, 1);
      if (p[0] === 'up' && i > 0) { active.splice(i, 1); active.splice(i - 1, 0, id); }
      pref = { mode: 'custom', active: active }; // cualquier edición pasa a personalizado
    }
    save(pref); fx('select'); paint(); paintEditor();
  }

  function init() { mount(); paint(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.Destacados = { repaint: paint };
})();
