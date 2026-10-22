/* Laboratorio: el mundo 3D de Uku y las recomendaciones financieras.
   El claro de Uku (assets/bosque3d.js) sigue lo que tiene la persona: brotes si es nueva, flores con su
   ahorro, guayacanes en flor con sus inversiones y, por cada crédito, lo que tiene gracias a él (casa,
   carro, tiendita…). El bosque de atrás crece con la salud financiera y el ánimo de Uku depende de los
   consumos por ordenar. Todo sale de PFM (assets/pfm.js) con los datos de la persona (assets/pfm/datos.json).
   Aquí se puede ver con los datos reales o forzar cada señal para probar. */
(function () {
  'use strict';
  var S = window.Sandbox, out = document.getElementById('out'), esc = S.esc;
  var m3 = null, escena = null, manual = { score: null, bloom: null, mood: null, esc: null }, poseActual = null, filtro = '';
  var POSES = [['wave', 'Saluda'], ['happy', 'Contento'], ['nod', 'Asiente'], ['talk', 'Habla'], ['worried', 'Preocupado'], ['plant', 'Planta un brote'], ['walk', 'Pasea'], ['still', 'Quieto']];
  // Escenarios para forzar lo que tiene la persona (lo mismo que devuelve PFM.finanzas())
  var ESC = [
    ['nuevo', 'Nuevo en el banco', { nuevo: true }],
    ['ahorro', 'Primeros ahorros', { ahorro: 300 }],
    ['inversion', 'Con inversiones', { ahorro: 2500, inversion: 6000 }],
    ['creditos', 'Con créditos', { ahorro: 800, deudas: [{ clase: 'hipoteca', producto: 'Hipoteca', saldo: 52000 }, { clase: 'prestamo', producto: 'Crédito automotriz', saldo: 9000 }, { clase: 'tarjeta', producto: 'Visa', saldo: 420 }, { clase: 'prestamo', producto: 'Crédito de consumo', saldo: 1500 }] }]
  ];
  // Al tocar una zona del claro, qué significa
  var ZONA_L = { ahorro: 'Los canteros: tu ahorro', inversion: 'Los guayacanes: tus inversiones', bosque: 'El bosque: tu presupuesto', credito: 'Lo que tienes por tus créditos' };
  var PROPS = { casa: 'Casa (hipoteca)', carro: 'Carro (crédito automotriz)', tienda: 'Tiendita (tarjetas)', carretilla: 'Carretilla (consumo)', nevera: 'Nevera (a crédito)', tele: 'Televisor (a crédito)', caja: 'Caja (artefacto a crédito)', libros: 'Libros (estudios)' };
  var MOODS = [['feliz', 'Contento'], ['tranquilo', 'Tranquilo'], ['pensativo', 'Pensativo']];
  function resumen() { return window.PFM && PFM.ready() ? PFM.summary() : null; }
  function efectivo() { var s = resumen() || { score: 60, bloom: 0, mood: 'tranquilo' }; return { score: manual.score != null ? manual.score : s.score, bloom: manual.bloom != null ? manual.bloom : s.bloom, mood: manual.mood || (s.mood === 'feliz' || s.mood === 'tranquilo' || s.mood === 'pensativo' ? s.mood : 'tranquilo') }; }
  function finanzas() { var f = manual.esc && ESC.filter(function (x) { return x[0] === manual.esc; })[0]; return f ? f[2] : window.PFM && PFM.finanzas ? PFM.finanzas() : null; }
  function aplicar() { if (!m3) return; var e = efectivo(), f = finanzas(); m3.setScore(e.score); m3.setBloom(e.bloom); m3.setMood(e.mood); if (f) m3.setFinanzas(f); }

  function pintar() {
    var p = window.DemoPersona && DemoPersona.datos(), s = resumen(), e = efectivo(), h = '';
    h += p ? S.chipsPersona(DemoPersona.lista(), p.id) : '';
    h += S.nota('El claro de Uku sigue lo que tienes: brotes si eres nuevo, flores con tu ahorro, guayacanes en flor con tus inversiones y lo que tienes gracias a tus créditos. El bosque de atrás crece con la salud financiera y su ánimo depende de los consumos por ordenar. Fuerza cada señal para ver cómo cambia.');
    // La escena: un contenedor con alto fijo (el único estilo propio de la página)
    var f = finanzas(), c = m3 && m3.contenido ? m3.contenido() : null;
    if (s) h += S.card('Lo que ve Uku en ' + s.mes, S.datos([['Salud financiera (el bosque)', s.score + ' / 100'], ['Flores (el ahorro)', s.bloom + ' %'], ['Ánimo (consumos por ordenar)', s.moodL + (s.n ? ' · ' + s.n + ' sin clasificar' : '')], ['Gastó', S.money(s.gast) + (s.pres ? ' de ' + S.money(s.pres) + ' de presupuesto' : ' · sin presupuesto')], ['Disponible', S.money(s.saldo)]]), 'Datos de la persona');
    if (f) h += S.card('Lo que tiene' + (manual.esc ? ' · forzado' : ''), S.datos([['Nuevo en el banco (brotes)', f.nuevo ? 'Sí' : 'No'], ['Ahorro y metas (flores)', S.money(f.ahorro || 0)], ['Inversiones (guayacanes en flor)', f.inversion ? S.money(f.inversion) + (c ? ' · ' + c.guayacanes + ' guayacanes' : '') : 'No tiene'], ['Créditos (lo que tiene gracias a ellos)', (f.deudas || []).length ? (c && c.props.length ? c.props.map(function (k) { return PROPS[k]; }).join(', ') : (f.deudas || []).length + '') : 'Ninguno']].concat(c ? [['En su claro', c.flores + ' flores · ' + c.brotes + ' brotes · ' + c.mariposas + ' mariposas' + (c.plantados ? ' · ' + c.plantados + ' plantados por Uku' : '')]] : [])), 'PFM.finanzas()');
    h += S.chips(ESC.map(function (x) { return S.chip('data-esc="' + x[0] + '"', x[1], manual.esc === x[0]); }).concat([S.chip('data-esc=""', 'Dato real', !manual.esc)]), 'Escenario: lo que tiene');
    h += S.chips([0, 25, 50, 75, 100].map(function (v) { return S.chip('data-score="' + v + '"', v + '', e.score === v && manual.score != null); }).concat([S.chip('data-score=""', 'Dato real', manual.score == null)]), 'Bosque: salud financiera');
    h += S.chips([0, 25, 50, 75, 100].map(function (v) { return S.chip('data-bloom="' + v + '"', v + ' %', e.bloom === v && manual.bloom != null); }).concat([S.chip('data-bloom=""', 'Dato real', manual.bloom == null)]), 'Flores: ahorro');
    h += S.chips(MOODS.map(function (x) { return S.chip('data-mood="' + x[0] + '"', x[1], manual.mood === x[0]); }).concat([S.chip('data-mood=""', 'Dato real', !manual.mood)]), 'Ánimo');
    h += S.chips(POSES.map(function (x) { return S.chip('data-pose="' + x[0] + '"', x[1], poseActual === x[0]); }), 'Gestos');
    // El oso de respaldo (hecho por código) se prueba aquí; la app sigue con el de siempre
    var oso = (function () { try { return localStorage.getItem('uku_oso') === 'nuevo' ? 'nuevo' : 'clasico'; } catch (e) { return 'clasico'; } })();
    h += S.chips([S.chip('data-oso="clasico"', 'El de siempre', oso === 'clasico'), S.chip('data-oso="nuevo"', 'Respaldo (prueba)', oso === 'nuevo')], 'Oso');
    // Qué significa cada cosa (las señales del mundo) y lo que Uku recomienda con esos datos
    if (window.PFM && PFM.ready()) {
      var W = PFM.world(), A = PFM.advice().filter(function (c) { return !filtro || (c.t + ' ' + (c.s || '') + ' ' + (c.tag || '')).toLowerCase().indexOf(filtro) >= 0; });
      h += S.sec('Qué significa cada cosa', W.map(function (x) { return S.row('data-senal', x.ic, esc(x.l) + ' · ' + esc(x.v), esc(x.d)); }).join(''));
      h += S.sec('Recomendaciones de Uku' + (filtro ? ' · «' + esc(filtro) + '»' : ''), A.length ? A.map(function (c) { return S.row('data-consejo="' + esc(c.id) + '"', c.icon || 'lightbulb', esc(c.t), esc((c.tag ? c.tag + ' · ' : '') + (c.s || c.di || '')) + (c.actl ? ' · <b>' + esc(c.actl) + '</b>' : ''), c.kind === 'warn' ? '!' : ''); }).join('') : '<p class="sx-kb__p">Nada que recomendar con estos datos.</p>');
      h += S.nota('Las recomendaciones salen de <b>assets/pfm.js › consejos()</b>: pagos cercanos, consumos por ordenar, el mínimo de la tarjeta, el presupuesto, el colchón de ahorro, mesadas repetidas y hallazgos del mes. El bosque usa <b>salud()</b>, las flores <b>flores()</b>, el ánimo <b>animo()</b> y lo que tiene <b>finanzas()</b> (brotes, guayacanes y lo de sus créditos).');
    } else h += S.nota('Cargando los movimientos de la persona…');
    h += S.versionRow();
    out.innerHTML = h;
    document.querySelector('#hoja h3').textContent = 'El mundo de Uku' + (manual.score != null || manual.bloom != null || manual.mood || manual.esc ? ' · forzado' : s ? ' · con los datos de ' + s.nombre : '');
    montar();
  }
  var cargando = false;
  function montar() {
    var el = document.getElementById('b3d'), nota = { set textContent(t) { S.aviso(t); }, remove: function () {} }; if (!el || cargando) return;
    if (!escena) {
      cargando = true;
      import('../assets/bosque3d.js?v=' + S.BUILD).then(function (mod) {
        m3 = mod; cargando = false;
        if (!mod.supported()) { nota.textContent = 'Este navegador no tiene WebGL: el bosque no se puede dibujar.'; return; }
        var e = efectivo(), f = finanzas(); mod.setBloom(e.bloom); mod.setMood(e.mood); if (f) mod.setFinanzas(f);
        mod.attach(el, { score: e.score, onPick: function (z) { S.aviso(ZONA_L[z.split(':')[0]] + (z.indexOf(':') > 0 ? ' · ' + (PROPS[z.split(':')[1]] || '') : '')); }, onReady: function () { el.classList.add('is-3d'); if (nota) nota.remove(); mod.play('wave'); setTimeout(function () { mod.setAmbient('walk'); }, 2800); pintar(); } });
        escena = el;
      }).catch(function (err) { cargando = false; nota.textContent = 'No se pudo cargar el mundo 3D: ' + (err && err.message); });
    }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-persona],[data-score],[data-bloom],[data-mood],[data-pose],[data-esc],[data-oso]'); if (!b) return;
    var d = b.dataset;
    if (d.oso) { try { if (d.oso === 'nuevo') localStorage.setItem('uku_oso', 'nuevo'); else localStorage.removeItem('uku_oso'); } catch (x) {} location.reload(); return; }
    if (d.persona) {
      DemoPersona.set(d.persona); S.setPersona(d.persona); if (window.PFM && PFM.setPersona) PFM.setPersona(d.persona);
      manual = { score: null, bloom: null, mood: null, esc: null }; aplicar(); pintar(); S.cerrarHoja();
      if (m3) { m3.play('wave'); setTimeout(function () { m3.setAmbient('walk'); }, 2800); }
      var r = resumen(); S.aviso('Ahora eres ' + DemoPersona.datos().primerNombre + (r ? ' · bosque ' + r.score + ' · flores ' + r.bloom + ' % · ' + r.moodL.toLowerCase() : ''));
      return;
    }
    if (d.score != null) manual.score = d.score === '' ? null : +d.score;
    if (d.bloom != null) manual.bloom = d.bloom === '' ? null : +d.bloom;
    if (d.mood != null) manual.mood = d.mood || null;
    if (d.esc != null) manual.esc = d.esc || null;
    if (d.pose) { poseActual = d.pose; if (m3) { if (d.pose === 'walk') m3.setAmbient('walk'); else if (d.pose === 'still') { m3.setAmbient(null); m3.play(null); } else m3.play(d.pose); } S.cerrarHoja(); }
    if (d.score != null || d.bloom != null || d.mood != null || d.esc != null) S.cerrarHoja();
    aplicar(); pintar();
  });
  pintar();
  Promise.all([DemoPersona.cargar('../assets/pfm/datos.json?v=' + S.BUILD), window.PFM ? PFM.load() : Promise.resolve()]).then(function () {
    var g = S.persona(); DemoPersona.set(g); if (window.PFM && PFM.setPersona) PFM.setPersona(g);
    aplicar(); pintar();
  }).catch(function (err) { S.aviso('No cargaron los datos: ' + (err && err.message)); });
})();
