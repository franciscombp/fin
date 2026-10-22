/* =====================================================================
   Tarjetas Pichibank: arte, datos y contenido del detalle de tarjeta
   (#card-detail en index.html).
   - Débito Digital: arte Visa amarillo, acciones y suscripciones.
   - Crédito Black Miles: tarjeta en capas (fondo con líneas finas, la
     tinta UV sobre esas líneas y logos) y la página en modo oscuro (tokens
     oscuros del DS solo en esta pantalla, con data-theme="dark").
   - Crédito Siembra (la Visa Pichibank blanca): tarjeta en capas (fondo,
     formas UV y logos). La tinta UV es solo luz: su brillo recorre las
     formas y sube con la inclinación del teléfono.
   Todas las tarjetas reflejan una luz que sigue al giroscopio (sin
   sensores, al dedo o al mouse). El reverso toma el color de cada tarjeta.
   Las filas del hub Tarjetas (productos.js) llevan data-tarjeta con el
   tipo, y abren este detalle.
   ===================================================================== */
(function () {
  'use strict';

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (v) { return '$ ' + Number(Math.abs(v || 0)).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var ms = function (i) { return '<span class="material-symbols-rounded" aria-hidden="true">' + i + '</span>'; };
  var A = './assets/tarjetas/';

  var TIPOS = {
    debito: {
      titulo: 'Débito Digital', img: A + 'debito-visa.webp', alt: 'Tarjeta de débito Visa',
      numero: '4532 1234 5678 ', ultimos: '1234', vence: '08/29', cvv: '123', ajustes: true,
      acciones: [['visibility', 'Ver datos', 'ver'], ['lock', 'Bloquear', 'Tarjeta bloqueada'], ['speed', 'Límites', 'Límites'], ['more_horiz', 'Más', 'Más opciones']]
    },
    black: {
      titulo: 'Crédito Black Miles', capas: 'black', formas: false, mini: A + 'credito-black.webp', alt: 'Tarjeta de crédito Mastercard Black', oscuro: true, credito: true,
      numero: '5221 4471 8823 ', ultimos: '5432', vence: '11/28', cvv: '456', cupo: 40000, ir: 'Cupos de tu Black Miles',
      acciones: [['redeem', 'Millas', 'Millas'], ['request_quote', 'Avances', 'Avances'], ['call_split', 'Diferir', 'Diferir consumos'], ['more_horiz', 'Más', 'Más opciones']]
    },
    siembra: {
      titulo: 'Crédito Siembra', capas: 'siembra', mini: A + 'visa-credito/tarjeta.svg', alt: 'Tarjeta de crédito Visa Siembra', credito: true,
      numero: '4915 0627 3310 ', ultimos: '4409', vence: '03/30', cvv: '812', cupo: 8000, ir: 'Próximo estado de cuenta',
      acciones: [['stars', 'Puntos', 'Puntos'], ['request_quote', 'Avances', 'Avances'], ['call_split', 'Diferir', 'Diferir consumos'], ['more_horiz', 'Más', 'Más opciones']]
    }
  };

  // Suscripciones de la débito (logos con el color de cada marca)
  var SUSCRIPCIONES = [
    ['uber', 'Uber<br>Eats', 'Uber Eats', 'Se renueva el 11 de abril', 4.99],
    ['spotify', ms('graphic_eq'), 'Spotify', 'Se renueva el 16 de mayo', 5.99],
    ['disney', 'D+', 'Disney+ Premium', 'Se renueva el 1 de octubre', 13.99],
    ['netflix', 'N', 'Netflix', 'Se renueva el 5 de octubre', 10.99]
  ];
  // Consumos de ejemplo de una tarjeta de crédito con saldo
  var CONSUMOS = [['shopping_cart', 'Supermaxi', 'Hoy · 10:24', 48.2], ['restaurant', 'La Petite', '10 oct · 21:48', 62.4], ['local_gas_station', 'Primax', '9 oct · 18:22', 30]];

  // Qué tarjeta Pichibank es, por su nombre (filas del hub, accesos de Uku y del buscador)
  function tipo(nombre) {
    var n = String(nombre || '').toLowerCase();
    if (/d[eé]bito/.test(n)) return 'debito';
    if (/black|mastercard/.test(n)) return 'black';
    if (/siembra|visa/.test(n)) return 'siembra';
    return null;
  }

  // Nombre en el hub: la Visa Pichibank es la Siembra
  function nombre(k, ultimos, original) {
    return k === 'siembra' ? 'Visa Siembra ···' + ultimos : original;
  }

  // Arte de la tarjeta: imagen con su reflejo, o las capas de la Siembra con tinta UV
  function arte(k, d) {
    var t = TIPOS[k] || TIPOS.debito;
    d = d || {};
    var ult = d.ultimos || t.ultimos;
    var estado = t.credito && !Number(d.saldo) ? '<span class="tj-arte__estado">' + ms('check_circle') + 'Estás al día</span>' : '';
    var num = t.credito ? '<span class="tj-arte__num">***' + esc(ult) + '</span>' : '';
    // En capas (Siembra, Black): fondo, brillo, formas UV (si el fondo no las trae), tinta, luz y logos
    var base = t.capas
      ? '<div class="tuv tuv--' + t.capas + '" role="img" aria-label="' + esc(t.alt) + '"><span class="tuv__fondo"></span><span class="tuv__brillo"></span>' +
        (t.formas === false ? '' : '<span class="tuv__formas"></span>') + '<span class="tuv__tinta"></span><span class="tuv__luz"></span><span class="tuv__logos"></span></div>'
      : '<img class="tj-arte__img" src="' + t.img + '" alt="' + esc(t.alt) + '" draggable="false"><span class="tj-luz"></span>';
    return '<div class="tj-arte tj-arte--' + k + '">' + base + estado + num + '</div>';
  }

  // Miniatura para la fila del hub
  function mini(k) {
    var t = TIPOS[k] || TIPOS.debito, src = t.mini || t.img;
    return '<span class="card-thumb card-thumb--img" aria-hidden="true"><img src="' + src + '" alt=""></span>';
  }

  // Contenido debajo de la tarjeta
  function cuerpo(k, d) {
    var t = TIPOS[k] || TIPOS.debito;
    d = d || {};
    var html = '';
    if (t.credito) {
      var usado = Math.max(0, Number(d.saldo) || 0), cupo = Math.max(t.cupo, usado), p = Math.round(usado / cupo * 100);
      html += '<button class="tj-cupo" type="button" data-tj-ir="' + esc(t.ir) + '">' +
        '<span class="tj-cupo__col"><small>Cupo disponible:</small><b data-saldo>' + money(cupo - usado) + '</b></span>' +
        '<span class="tj-cupo__col"><small>Cupo utilizado:</small><b data-saldo>' + money(usado) + '</b></span>' +
        '<span class="tj-anillo" style="--p:' + p + '"><span>' + p + '%</span></span>' + ms('chevron_right') + '</button>';
    }
    html += '<div class="cd-actions">' + t.acciones.map(function (a) {
      var attr = a[2] === 'ver' ? 'id="cd-ver-datos" type="button"' : 'data-action="' + esc(a[2]) + '"';
      return '<button class="quick-action" ' + attr + '><span class="quick-action__icon">' + ms(a[0]) + '</span><span class="quick-action__label">' + a[1] + '</span></button>';
    }).join('') + '</div>';
    if (!t.credito) {
      html += '<h2 class="cd-subtitle">Tus suscripciones y pagos recurrentes</h2><div class="cd-subs">' + SUSCRIPCIONES.map(function (s) {
        return '<button class="sub-item" data-action="' + s[2] + '"><span class="sub-item__logo tj-marca tj-marca--' + s[0] + '">' + s[1] + '</span>' +
          '<span class="sub-item__info"><span class="sub-item__name">' + s[2] + '</span><span class="sub-item__meta">' + s[3] + '</span></span>' +
          '<span class="sub-item__price">' + money(s[4]) + '</span></button>';
      }).join('') + '</div>';
    } else if (!Number(d.saldo)) {
      html += '<div class="tj-vacio"><span class="tj-vacio__ilustra" aria-hidden="true"><i></i><i></i></span><p>Aún no tienes transacciones</p></div>';
    } else {
      html += '<h2 class="cd-subtitle">Últimos consumos</h2><div class="cd-subs">' + CONSUMOS.map(function (c) {
        return '<button class="sub-item" data-action="' + c[1] + '"><span class="sub-item__logo">' + ms(c[0]) + '</span>' +
          '<span class="sub-item__info"><span class="sub-item__name">' + c[1] + '</span><span class="sub-item__meta">' + c[2] + '</span></span>' +
          '<span class="sub-item__price">-' + money(c[3]) + '</span></button>';
      }).join('') + '</div>';
    }
    // Consumo no reconocido: solicitud de revisión (assets/soporte.js)
    html += '<button class="cd-review" data-action="Revisar consumo">' + ms('report') +
      '<span class="cd-review__main"><b>¿No reconoces un consumo?</b><small>Pide una revisión · tarda de 2 a 6 semanas</small></span>' + ms('chevron_right') + '</button>';
    return html;
  }

  /* ---------- Luz con giroscopio (o el dedo/mouse sin sensores) ----------
     --uv-x/--uv-y (-1..1) mueven el reflejo y la tinta UV; --uv-luz (0..1) es
     cuánto se inclina la tarjeta: a más ángulo, más luz. Van en cada .tj-arte. */
  // gx/gy: inclinación (giroscopio, dedo o mouse). sy: lo que suma el scroll de la pantalla
  var gx = 0, gy = 0, sy = 0, tx = 0, ty = 0, cx = 0, cy = 0, base = null, vivo = false, corre = false;
  function cuadro() {
    cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
    var luz = Math.min(1, Math.hypot(cx, cy) * 1.2);
    document.querySelectorAll('.tj-arte').forEach(function (el) {
      el.style.setProperty('--uv-x', cx.toFixed(3));
      el.style.setProperty('--uv-y', cy.toFixed(3));
      el.style.setProperty('--uv-luz', luz.toFixed(3));
    });
    if (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002) requestAnimationFrame(cuadro); else corre = false;
  }
  var tope = function (v) { return Math.max(-1, Math.min(1, v)); };
  function aplicar() {
    tx = tope(gx); ty = tope(gy + sy);
    if (!corre && document.querySelector('.tj-arte')) { corre = true; requestAnimationFrame(cuadro); }
  }
  function mover(x, y) { gx = tope(x); gy = tope(y); aplicar(); }
  // Scroll: al deslizar la pantalla de la tarjeta, la luz la recorre (como si la tarjeta pasara
  // bajo una lámpara). 160 px de scroll llevan la luz de un borde al otro; el rebote de iOS
  // (scroll negativo) la mueve al revés.
  document.addEventListener('scroll', function (e) {
    var el = e.target;
    if (!el || !el.querySelector || !el.querySelector('.tj-arte')) return;
    sy = tope(-el.scrollTop / 160);
    aplicar();
  }, true);
  // gamma: izquierda/derecha. beta: adelante/atrás respecto de la postura en que se sostiene el
  // teléfono (la primera lectura, que sigue muy despacio a la postura para no "apagar" la luz)
  function orientacion(e) {
    if (e.gamma == null && e.beta == null) return;
    vivo = true;
    if (base === null) base = e.beta || 0;
    base += ((e.beta || 0) - base) * 0.002;
    // Lo más común es inclinar hacia adelante o atrás: ese eje es el más sensible (15° llegan al tope)
    mover((e.gamma || 0) / 25, ((e.beta || 0) - base) / 15);
  }
  window.addEventListener('deviceorientation', orientacion);
  document.addEventListener('pointermove', function (e) {
    if (vivo) return;
    var el = e.target.closest && e.target.closest('.tj-arte');
    if (!el) return;
    var r = el.getBoundingClientRect();
    mover((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1);
  });
  document.addEventListener('pointerout', function (e) {
    if (!vivo && e.target.closest && e.target.closest('.tj-arte') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.tj-arte'))) mover(0, 0);
  });

  // Abrir una tarjeta por su nombre (accesos de Uku, Soporte y Destacados): su fila del hub si
  // existe; si no, la primera del mismo tipo, la primera de crédito, o el detalle directo
  function abrir(nombre) {
    var filas = [].slice.call(document.querySelectorAll('#home-page [data-panel="Tarjetas"] .product-row[data-tarjeta]'));
    var k = tipo(nombre);
    var r = filas.filter(function (f) { return f.dataset.action === nombre; })[0] ||
      filas.filter(function (f) { return f.dataset.tarjeta === k; })[0] ||
      filas.filter(function (f) { return f.dataset.tarjeta !== 'debito'; })[0];
    if (r) r.click(); else if (window.openCardDetail) window.openCardDetail(k || 'debito');
  }

  window.Tarjetas = { tipos: TIPOS, tipo: tipo, nombre: nombre, arte: arte, mini: mini, cuerpo: cuerpo, abrir: abrir, inclinar: mover,
    // true cuando ya llegan lecturas del giroscopio (en iPhone, después de dar el permiso)
    giroActivo: function () { return vivo; } };
})();
