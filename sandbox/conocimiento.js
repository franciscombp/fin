/* Laboratorio: cómo están construidas la base de conocimiento (assets/conocimiento/base.json + assets/conocimiento.js),
   la base de personas (assets/pfm/datos.json) y el repositorio. Explora entradas, prueba el buscador con la
   explicación de cada puntaje, mira cómo se parte y se reduce una palabra, y recorre el mapa de archivos. */
(function () {
  'use strict';
  var S = window.Sandbox, K = window.Conocimiento, P = window.DemoPersona, out = document.getElementById('out'), q = document.getElementById('q'), esc = S.esc;
  var tab = 'resumen', cat = null, entrada = null, datosJson = null;
  var TABS = [['resumen', 'Resumen'], ['buscar', 'Buscar'], ['palabras', 'Palabras'], ['entradas', 'Entradas'], ['personas', 'Personas'], ['repo', 'Repositorio']];
  var REPO = [
    ['Raíz', [['index.html', 'La app: login, inicio, pestañas de productos, Perfil y las hojas; carga todos los módulos'], ['app.js', 'Ingreso y service worker: registra sw.js y muestra el inicio'], ['sw.js', 'Caché por versión (BUILD): red primero para la app, caché para fuentes e imágenes'], ['haptics.js', 'Vibración (Android) y sonidos sintetizados (WebAudio)'], ['webauthn.js', 'Face ID y huella con WebAuthn'], ['fiesta.js', 'Confeti y festejos'], ['manifest.json', 'PWA: nombre, iconos, colores']]],
    ['assets/', [['conocimiento.js', 'El buscador de la base: raíces, sinónimos, BM25 por campos, prefijo, tipeo e intención'], ['conocimiento/base.json', 'La base de conocimiento: categorías, valores, sinónimos y entradas (faq, producto, accion)'], ['buscador.js', 'El buscador de la app: atajos, frases con intención, acciones, productos, ayuda'], ['soporte.js', 'Ayuda con Uku: preguntas frecuentes, inconvenientes guiados, tutoriales, asesor'], ['uku-app.js', 'La pantalla de Uku: su mundo, las tarjetas de respuesta, la búsqueda universal'], ['uku-util.js', 'Utilidades de Uku: texto, dinero, iconos, intención'], ['bosque3d.js', 'El mundo 3D: bosque, flores, ánimo, gestos del oso (three.js)'], ['uku-rig.js', 'Uku, el oso de anteojos (assets/oso/uku.glb, hecho con tools/uku/uku.py) y sus gestos por código'], ['pfm.js', 'Mis finanzas: movimientos, presupuesto, ahorro, consejos, salud, el juego de clasificar'], ['pfm-analisis.js', 'Lo que el front deduce de cada movimiento crudo (tratamiento, categoría, escenario, nota) y qué escenarios del catálogo aplican a cada persona'], ['pfm/datos.json', 'La base de personas: usuarios, cuentas, deudas, movimientos, hipoteca, escenarios y agenda'], ['persona.js', 'La persona activa de la app (se elige en Perfil)'], ['productos.js', 'Los hubs de productos por persona'], ['contexto.js', 'Qué mira la persona y qué le puede decir Uku'], ['navegacion.js', 'Transiciones y navegación unificada'], ['clima.js', 'Clima y ubicación: viste a Uku'], ['i18n.js + locales/', 'Idiomas con gettext (.po): español fuente, kichwa'], ['tokens.css · componentes-tokens.css', 'Design system Solar: tokens de Figma y medidas de los componentes'], ['sistema.css · componentes.css', 'Estilos de la app sobre el DS'], ['buscador.css · uku-app.css · pfm.css · soporte.css', 'Estilos por pantalla'], ['vendor/three · vendor/jsqr', 'Librerías: three.js y lector de QR']]],
    ['buscador/', [['index.html', 'La demo pública del buscador (solo clases de la app)'], ['demo.js', 'Intención, contactos, atajos, flujos simulados, ajustes, voz'], ['persona.js', 'La persona de la demo: cuentas, tarjetas, agenda, «Para ti», preguntas sugeridas'], ['lector.js', 'Lector de facturas y documentos: OCR (Tesseract), PDF (pdf.js) y el análisis de campos']]],
    ['sandbox/', [['index.html', 'Este sandbox: hub y persona'], ['mundo.js', 'El mundo 3D y las recomendaciones'], ['animaciones.js', 'Háptica, sonido y animaciones en cámara lenta'], ['conocimiento.js', 'Esta página']]],
    ['tools/', [['conocimiento-validar.js', 'Valida la base: esquema, acciones que existen, marcadores, deriva con soporte.js'], ['conocimiento-probar.js', 'Mide el buscador con 199 consultas reales (98 % en primer lugar)'], ['pfm-agenda.py', 'Genera la agenda por persona desde sus movimientos'], ['pfm-cuentas.py · pfm-datos.py · pfm-persona-luis.py', 'Generan cuentas y movimientos de la base de personas'], ['i18n-extraer.py · i18n-recorrer.js', 'Extraen y recorren los textos para traducir']]],
    ['docs/', [['base-de-conocimiento.md', 'Qué hay en la base, cómo busca, dónde se ve y cómo mantenerla'], ['decisiones-y-aprendizajes.md', 'Decisiones de producto y diseño, y lo que costó aprender']]],
    ['.github/workflows/', [['pages-preview.yml', 'Despliegue manual a GitHub Pages: copia la app, buscador/ y sandbox/, y versiona con el commit']]]
  ];
  function fetchDatos() { return datosJson ? Promise.resolve(datosJson) : fetch('../assets/pfm/datos.json?v=' + S.BUILD).then(function (r) { return r.json(); }).then(function (d) { datosJson = d; return d; }); }
  function raw(id) { var b = K.base(); return b ? b.entradas.filter(function (e) { return e.id === id; })[0] : null; }
  function tabs() { return S.chips(TABS.map(function (t) { return S.chip('data-tab="' + t[0] + '"', t[1], tab === t[0]); })); }
  function tipoL(t) { return { faq: 'Pregunta frecuente', producto: 'Producto', accion: 'Acción' }[t] || t; }

  function resumen() {
    var b = K.base(); if (!b) return S.nota('Cargando la base…');
    var porTipo = {}, porCat = {}; b.entradas.forEach(function (e) { porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1; porCat[e.cat] = (porCat[e.cat] || 0) + 1; });
    return S.card('Base de conocimiento', '<p class="sx-kb__p">' + esc(b.fuente) + '</p>' + S.datos([['Entradas', b.entradas.length + ''], ['Preguntas frecuentes', porTipo.faq + ''], ['Productos', porTipo.producto + ''], ['Acciones', porTipo.accion + ''], ['Categorías', b.categorias.length + ''], ['Sinónimos', Object.keys(b.sinonimos).length + ''], ['Marcadores con valor', Object.keys(b.valores).length + '']]), 'assets/conocimiento/base.json') +
      S.sec('Por categoría', b.categorias.map(function (c) { return S.row('data-cat="' + c.id + '"', c.icon, esc(c.t), (porCat[c.id] || 0) + ' entradas'); }).join('')) +
      S.card('Cómo busca', '<ol class="sx-kb__pasos"><li>Normaliza (minúsculas, sin tildes) y quita palabras vacías; «no» se queda.</li><li>Reduce cada palabra a su raíz («transferencias» y «transferir» → «transfer») y suma las raíces de sus sinónimos con menos peso.</li><li>Puntúa con BM25 por campos: título 3 · preguntas y frases 2,2 · palabras clave 1,6 · respuesta, datos y pasos 0,6.</li><li>Mientras se escribe, la última palabra es un prefijo; una palabra sin coincidencia se busca con tolerancia a errores de tipeo.</li><li>Intención: una orden sube las acciones, una pregunta las ayudas, «qué es / requisitos» los productos. El nombre exacto gana.</li><li>responder() devuelve la mejor entrada con confianza alta o media.</li></ol>', 'assets/conocimiento.js') +
      S.card('Una entrada', '<p class="sx-kb__p">Cada entrada tiene id, tipo, cat, t (título), k (palabras clave), fuente y, según el tipo: preguntas y r (respuesta con {marcadores}) y acts (botones) en las preguntas; datos (la ficha) en los productos; go (la clave que la ejecuta), frases y pasos en las acciones. Las claves de acción son las de Soporte.run: do:, tab:, card:, pfm, review, handoff, sol, search, ask:.</p>', 'Esquema');
  }
  function buscar(texto) {
    if (!texto) return S.nota('Escribe arriba lo que buscarías en la app: «cuanto debo de la tarjeta», «trasferencia no llega», «recar». Verás cada resultado con su puntaje y de dónde sale.');
    var it = K.intencion(texto), r = K.buscar(texto, { n: 8, explicar: true }), top = K.responder(texto);
    return S.card('Intención', S.datos([['Pregunta', it.pregunta ? 'sí' : 'no'], ['Orden (acción)', it.accion ? 'sí' : 'no'], ['Producto', it.producto ? 'sí' : 'no'], ['Palabras', K.words(texto).join(' · ') || '—'], ['Raíces', K.words(texto).map(K.stem).join(' · ') || '—']]), 'K.intencion()') +
      (top ? S.card(top.t, '<p class="sx-kb__p">' + esc(top.r) + '</p>' + S.datos([['Confianza', top.conf], ['Puntaje', top.s + ''], ['Tipo', tipoL(top.tipo)]]), 'K.responder() · la respuesta directa') : S.nota('K.responder(): sin respuesta directa (puntaje bajo o empate).')) +
      S.sec('K.buscar() · ' + r.length + ' resultados', r.length ? r.map(function (x) { return S.row('data-entrada="' + x.id + '"', x.tipo === 'accion' ? (x.icon || 'bolt') : x.tipo === 'producto' ? 'inventory_2' : 'help', esc(x.t), esc(tipoL(x.tipo) + ' · cobertura ' + Math.round(x.cobertura * 100) + ' % · ' + (x.por || '')), x.s.toFixed(2)); }).join('') : '<p class="sx-kb__p">Nada.</p>');
  }
  function palabras(texto) {
    var b = K.base(); if (!texto) return S.nota('Escribe arriba una frase y verás cómo se normaliza, qué palabras se descartan, la raíz de cada una y sus sinónimos.');
    var n = K.norm(texto), todas = n.split(' ').filter(Boolean), ws = K.words(texto), sin = b ? b.sinonimos : {};
    return S.card('Normalizado', '<p class="sx-kb__p">' + esc(n) + '</p>' + S.datos([['Palabras vacías fuera', todas.filter(function (w) { return ws.indexOf(w) < 0; }).join(' · ') || '—']]), 'K.norm()') +
      S.sec('Cada palabra', ws.map(function (w) { var s = K.stem(w), syn = sin[w] || sin[K.norm(w)] || []; return S.row('', 'spellcheck', esc(w) + ' → ' + esc(s), esc(syn.length ? 'Sinónimos: ' + syn.join(', ') : 'Sin sinónimos')); }).join('') || '<p class="sx-kb__p">Solo palabras vacías.</p>');
  }
  function entradas(texto) {
    var b = K.base(); if (!b) return '';
    if (entrada) {
      var e = raw(entrada), v = K.entrada(entrada); if (!e) return '';
      return S.sec('', S.row('data-cerrar-entrada', 'arrow_back', 'Volver a la lista')) +
        S.card(e.t, '<p class="sx-kb__p">' + esc(v.r) + '</p>' + S.datos([['id', e.id], ['tipo', tipoL(e.tipo)], ['categoría', e.cat], ['fuente', e.fuente || '—'], ['go', e.go || '—'], ['acts', (e.acts || []).map(function (a) { return a[0] + ' → ' + a[1]; }).join(' · ') || '—']]) +
          (e.preguntas || e.frases ? '<p class="sx-kb__links">Cómo lo dice la gente</p><ol class="sx-kb__pasos">' + (e.preguntas || e.frases).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '') +
          '<p class="sx-kb__links">Palabras clave: ' + esc((e.k || []).join(', ')) + '</p>' + (e.datos ? S.datos(e.datos.map(function (d) { return [d[0], K.texto(d[1])]; })) : '') + (e.pasos ? '<ol class="sx-kb__pasos">' + e.pasos.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '') +
          '<p class="sx-kb__links">Texto crudo de r: ' + esc(e.r || '—') + '</p>', tipoL(e.tipo));
    }
    var lista = b.entradas.filter(function (e) { return (!cat || e.cat === cat) && (!texto || K.norm(e.t + ' ' + e.id).indexOf(K.norm(texto)) >= 0); });
    return S.chips([S.chip('data-cat=""', 'Todas', !cat)].concat(b.categorias.map(function (c) { return S.chip('data-cat="' + c.id + '"', c.t, cat === c.id); })), 'Categoría') +
      S.sec(lista.length + ' entradas', lista.slice(0, 60).map(function (e) { return S.row('data-entrada="' + e.id + '"', e.tipo === 'accion' ? (e.icon || 'bolt') : e.tipo === 'producto' ? 'inventory_2' : 'help', esc(e.t), esc(tipoL(e.tipo) + ' · ' + e.id)); }).join('') + (lista.length > 60 ? '<p class="sx-kb__p">Y ' + (lista.length - 60) + ' más: filtra arriba.</p>' : ''));
  }
  function personas() {
    var d = datosJson; if (!d) { fetchDatos().then(pintar); return S.nota('Cargando la base de personas…'); }
    var rangos = {}; Object.keys(d.movimientos).forEach(function (u) { var m = d.movimientos[u]; rangos[u] = m.length ? m[m.length - 1][0] + ' → ' + m[0][0] : '—'; });
    return S.card('assets/pfm/datos.json', '<p class="sx-kb__p">' + esc(d.fuente) + ' · hoy es ' + esc(d.hoy) + '.</p>' + S.datos([['Usuarios', d.usuarios.length + ''], ['Movimientos', Object.keys(d.movimientos).reduce(function (t, u) { return t + d.movimientos[u].length; }, 0) + ''], ['Deudas', d.deudas.length + ''], ['Escenarios', d.escenarios.length + ''], ['Campos de un movimiento', d.campos.join(', ')], ['Diccionarios', Object.keys(d.dic).map(function (k) { return k + ' (' + d.dic[k].length + ')'; }).join(', ')]]), 'La base de personas') +
      S.card('Cómo se guarda un movimiento', '<p class="sx-kb__p">Cada fila es un arreglo con los campos en orden; los textos repetidos (fuente, producto, descripción, contraparte, tratamiento, categoría, escenario, nota) van como índice a un diccionario, así 3.000 movimientos pesan poco. tools/pfm-datos.py los genera; pfm-cuentas.py saca las cuentas; pfm-agenda.py la agenda (contactos, favoritos, exterior, Deuna, domiciliados, recurrentes).</p>', 'Formato') +
      S.sec('Personas', d.usuarios.map(function (u) { var p = P ? (P.set(u.usuario), P.datos()) : null; var ag = d.agenda && d.agenda[u.usuario];
        return S.row('data-persona-ver="' + u.usuario + '"', 'person', esc(u.nombre) + ' · ' + u.edad, esc(u.tipo + ' · ' + u.ciudad + ' · ' + d.movimientos[u.usuario].length + ' movimientos (' + rangos[u.usuario] + ')' + (p ? ' · ' + p.cuentas.length + ' cuentas · ' + p.tarjetas.length + ' tarjetas · ' + (p.prestamos.length + (p.hipoteca ? 1 : 0)) + ' préstamos' : '') + (ag ? ' · ' + ag.contactos.length + ' contactos · ' + ag.exterior.length + ' exterior · ' + ag.domiciliados.length + ' domiciliados · ' + ag.recurrentes.length + ' recurrentes' : ''))); }).join('')) +
      (P ? (P.set(S.persona()), '') : '');
  }
  function personaVer(id) {
    var d = datosJson, u = d.usuarios.filter(function (x) { return x.usuario === id; })[0]; P.set(id); var p = P.datos(), ag = d.agenda && d.agenda[id];
    return S.sec('', S.row('data-cerrar-persona', 'arrow_back', 'Volver a las personas')) +
      S.card(u.nombre, S.datos([['Tipo', u.tipo], ['Grupo', u.grupo_investigacion], ['Ingreso', u.ingreso_mensual], ['Hogar', u.hogar], ['Digitalización', u.digitalizacion], ['Productos', u.productos_bp], ['Fuera del banco', u.fuera_de_bp], ['Casos', u.casos], ['Lo que necesita', u.lo_que_necesita]]), 'usuarios[]') +
      S.card('Cuentas y deudas', S.datos(p.cuentas.map(function (c) { return [c.nombre + ' ···' + c.numero, S.money(c.saldo)]; }).concat(p.tarjetas.map(function (t) { return [t.nombre + ' · ' + t.banco, 'debe ' + S.money(t.saldo)]; })).concat(p.prestamos.map(function (x) { return [x.nombre + ' · ' + x.banco, 'cuota ' + S.money(x.cuota)]; })).concat(p.inversiones.map(function (x) { return [x.nombre, S.money(x.saldo)]; })).concat(p.metas.map(function (x) { return ['Meta: ' + x.nombre, S.money(x.saldo) + ' de ' + S.money(x.meta)]; }))), 'cuentas[id] + deudas[]') +
      (ag ? S.card('Agenda', S.datos([['Contactos', ag.contactos.map(function (c) { return c.alias + (c.favorito ? ' ★' : '') + (c.deuna ? ' · Deuna' : ''); }).join(', ') || '—'], ['Exterior', ag.exterior.map(function (e) { return e.nombre + ' (' + e.pais + ', ' + e.swift + ')'; }).join(', ') || '—'], ['Deuna', ag.deuna.mi_numero + ' · ' + ag.deuna.contactos.length + ' contactos'], ['Recargas', ag.recargas.map(function (r) { return r.nombre + ' ' + r.numero; }).join(', ')], ['Domiciliados', ag.domiciliados.map(function (x) { return x.empresa + ' (día ' + x.dia + ', ' + S.money(x.monto_tipico) + ')'; }).join(', ') || '—'], ['Recurrentes', ag.recurrentes.map(function (x) { return x.empresa + ' (' + S.money(x.monto_tipico) + ')'; }).join(', ') || '—'], ['Favoritos', ag.favoritos.join(', ')]]), 'agenda[id] · tools/pfm-agenda.py') : '') +
      S.card('Lo que la demo deriva', S.datos([['Para ti', p.paraTi.map(function (x) { return x.t; }).join(' · ') || '—'], ['Atajos sugeridos', p.atajosSugeridos.map(function (x) { return x.nombre; }).join(' · ') || '—'], ['Preguntas sugeridas (inicio)', P.preguntas('inicio', 4).join(' · ')], ['Actividad reciente', Object.keys(p.reciente).filter(function (k) { return p.reciente[k]; }).map(function (k) { return k + ' ' + p.reciente[k]; }).join(' · ') || '—'], ['Valores para la base', Object.keys(p.valores).map(function (k) { return k + ' = ' + p.valores[k]; }).join(' · ')]]), 'buscador/persona.js');
  }
  function repo() {
    return REPO.map(function (g) { return S.sec(esc(g[0]), g[1].map(function (f) { return S.row('', 'description', esc(f[0]), esc(f[1])); }).join('')); }).join('') +
      S.nota('Flujo de trabajo: cada cambio va en su rama (claude/&lt;tema&gt;), se verifica con Playwright en local y se mergea a main con --no-ff; el workflow de Pages se corre a mano desde main. Más en docs/decisiones-y-aprendizajes.md.');
  }
  var personaAbierta = null;
  function pintar() {
    var t = q.value.trim(), h = tabs();
    if (tab === 'resumen') h += resumen();
    else if (tab === 'buscar') h += buscar(t);
    else if (tab === 'palabras') h += palabras(t);
    else if (tab === 'entradas') h += entradas(t);
    else if (tab === 'personas') h += personaAbierta ? personaVer(personaAbierta) : personas();
    else h += repo();
    h += S.versionRow();
    out.innerHTML = h;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab],[data-cat],[data-entrada],[data-cerrar-entrada],[data-persona-ver],[data-cerrar-persona]'); if (!b) return;
    var d = b.dataset;
    if (d.tab) { tab = d.tab; entrada = null; personaAbierta = null; q.placeholder = tab === 'buscar' ? 'Prueba el buscador' : tab === 'palabras' ? 'Escribe una frase' : tab === 'entradas' ? 'Filtra por título o id' : 'Bases y repositorio'; out.scrollTop = 0; return pintar(); }
    if (d.cat != null) { tab = 'entradas'; cat = d.cat || null; entrada = null; return pintar(); }
    if (d.entrada) { tab = 'entradas'; entrada = d.entrada; out.scrollTop = 0; return pintar(); }
    if (d.cerrarEntrada != null) { entrada = null; return pintar(); }
    if (d.personaVer) { personaAbierta = d.personaVer; out.scrollTop = 0; return pintar(); }
    if (d.cerrarPersona != null) { personaAbierta = null; return pintar(); }
  });
  q.addEventListener('input', function () { if (tab === 'resumen' || tab === 'repo' || tab === 'personas') tab = 'buscar'; pintar(); });
  document.getElementById('form').addEventListener('submit', function (e) { e.preventDefault(); });
  var cancel = document.getElementById('cancel'), cancelIc = cancel.querySelector('span');
  function cabecera() { var t = !!q.value.trim(); cancelIc.textContent = t ? 'close' : 'arrow_back'; cancel.setAttribute('aria-label', t ? 'Limpiar' : 'Volver al sandbox'); }
  cancel.addEventListener('click', function () { if (!q.value.trim()) { location.href = './'; return; } q.value = ''; cabecera(); pintar(); });
  q.addEventListener('input', cabecera);
  pintar();
  Promise.all([K.listo(), P.cargar('../assets/pfm/datos.json?v=' + S.BUILD).catch(function () { return null; })]).then(function () { P.set(S.persona()); pintar(); });
})();
