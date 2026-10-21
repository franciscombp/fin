// Barrido de la app: recorre todas las pantallas con cada persona, revisa los errores que ya vimos
// y guarda una captura por paso para comparar contra main.
// Uso: sirve la app (python3 -m http.server 8765) y corre
//   node tools/barrido.js <carpeta> [personas separadas por coma]
// Variables: BASE=http://localhost:8765/ (otra copia, p. ej. main en 8766), PW=ruta de playwright,
//            CHROME=ruta del navegador (por defecto /opt/pw-browsers/chromium si existe).
// Qué revisa en cada paso: errores de JS y de consola, archivos que no cargan (HTTP ≥ 400), que la página
// siga respondiendo (el congelamiento al entrar a Mis finanzas), scroll horizontal, el botón principal de
// las hojas sin fondo, la barra de abajo (oculta en Mis finanzas y visible en el inicio del asistente) y
// que el aviso con «Deshacer» se pueda tocar. También que nada con hidden se vea y que el login no diga
// «Sin internet» con conexión.
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:8765/';
const OUT = path.resolve(process.argv[2] || 'barrido'); fs.mkdirSync(OUT, { recursive: true });
const PERS = (process.argv[3] || 'andres,rosa,daniela,jorge,luis,camila').split(',');
const CHROME = process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
// Lo que falla por estar sin internet en la prueba (fuentes, clima, ubicación) no cuenta
const IGN = /ERR_CONNECTION_REFUSED|ERR_FAILED|ERR_NAME_NOT_RESOLVED|ERR_TUNNEL|ERR_INTERNET|fonts\.g|open-meteo|bigdatacloud/;
(async () => {
  const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const reporte = {}; let total = 0;
  for (const persona of PERS) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const p = await ctx.newPage(); const errs = []; let paso = 'carga';
    p.on('pageerror', e => errs.push(paso + ' · error de JS: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !IGN.test(m.text())) errs.push(paso + ' · consola: ' + m.text().slice(0, 200)); });
    p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) errs.push(paso + ' · no carga (' + r.status() + '): ' + r.url().slice(BASE.length)); });
    const check = async (cond, msg) => { try { if (!(await p.evaluate(cond))) errs.push(paso + ' · ' + msg); } catch (e) { errs.push(paso + ' · ' + msg + ' (' + e.message.slice(0, 80) + ')'); } };
    const step = async (n, fn, espera = 1200, extra) => {
      paso = n;
      try {
        await fn(); await p.waitForTimeout(espera);
        const vivo = await Promise.race([p.evaluate(() => 1), new Promise(r => setTimeout(() => r(0), 3000))]);
        if (!vivo) { errs.push(n + ' · la página no responde'); return; }
        await check(() => document.documentElement.scrollWidth <= innerWidth + 1, 'hay scroll horizontal');
        // Nada con el atributo hidden debe verse (así se colaba «Sin internet» en el login con red)
        const ocultos = await p.evaluate(() => Array.from(document.querySelectorAll('[hidden]')).filter(e => getComputedStyle(e).display !== 'none').map(e => (e.id ? '#' + e.id : e.className)).slice(0, 3));
        if (ocultos.length) errs.push(paso + ' · se ve algo que debería estar oculto: ' + ocultos.join(', '));
        if (extra) await extra();
        await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, persona + '_' + n + '.png') });
      } catch (e) { errs.push(n + ' · no se pudo: ' + e.message.split('\n')[0].slice(0, 160)); }
    };
    const navVisible = () => p.evaluate(() => { const n = document.querySelector('.nav-bar'); return !!n && getComputedStyle(n).display !== 'none'; });
    await p.goto(BASE + 'index.html'); await p.waitForTimeout(500);
    await p.evaluate((id) => { localStorage.clear(); localStorage.setItem('uk-onboard', '1'); localStorage.setItem('pb_persona', id); }, persona);
    await p.reload(); await p.waitForTimeout(1500);
    await step('00login', async () => {}, 1200, () => check(() => !navigator.onLine || getComputedStyle(document.getElementById('login-offline')).display === 'none', 'el login dice «Sin internet» aunque hay conexión'));
    await step('01inicio', async () => { await p.evaluate(() => { document.getElementById('login-screen').classList.remove('active'); document.getElementById('home-page').classList.remove('hidden'); }); });
    await step('02beneficios', () => p.click('.nav-item[data-view="2"]'));
    await step('03perfil', () => p.click('.nav-item[data-view="4"]'));
    await step('04asistente', () => p.click('.nav-item[data-view="1"]'), 2500, async () => { if (!(await navVisible())) errs.push(paso + ' · la barra de abajo no se ve en el inicio del asistente'); });
    await step('05finanzas', () => p.click('.uk-pill[data-k="fin"]'), 2500, async () => { if (await navVisible()) errs.push(paso + ' · la barra de abajo debería ocultarse en Mis finanzas'); });
    await step('06gastos', () => p.click('.pfm-hub__hero'));
    await step('07finanzas2', () => p.click('.uk-chathead__x'));
    await step('08presupuesto', () => p.evaluate(() => PFM.key('pres')), 1200, () => check(() => { const c = document.querySelector('.as-sheet.open .pf-cta'); return !c || getComputedStyle(c).backgroundColor !== 'rgba(0, 0, 0, 0)'; }, 'el botón principal de la hoja no tiene fondo'));
    await step('09dinero', async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(500); await p.click('.pfm-hub__dinero'); });
    await step('10asistente2', async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(500); await p.click('.uk-chathead__x'); }, 1500);
    await step('11ocultar', async () => { const x = await p.$('.uk-globo__ib[data-k^="ocultar:"]'); if (!x) return; await x.click(); await p.waitForTimeout(700); await p.click('.pf-toast.show .pfm-undo', { timeout: 3000 }); }, 1000);
    await step('12buscador', async () => { await p.click('.uk-bar__f'); await p.waitForTimeout(600); await p.keyboard.type('transferir'); }, 1500);
    await step('13soporte', async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(600); const x = await p.$('.sx.open .sx-cancel'); if (x) await x.click(); await p.waitForTimeout(500); await p.click('.uk-pill[data-k="soporte"]'); }, 1500);
    await step('14ayuda', () => p.click('[data-k="ayudatoda"]'), 1500);
    // La barra «Busca o pregunta» abre el buscador universal; una pregunta con Enter la responde Uku en el chat
    await step('15pregunta', async () => { await p.click('[data-k="ayudacerrar"]'); await p.waitForTimeout(600); await p.click('.uk-chathead__x'); await p.waitForTimeout(800); await p.click('.uk-bar__f'); await p.waitForTimeout(600); await p.keyboard.type('¿En qué gasto más?'); await p.keyboard.press('Enter'); }, 2500);
    const cerrarBuscador = async () => { const x = await p.$('.sx.open .sx-cancel'); if (x) { await x.click(); await p.waitForTimeout(500); } };
    await step('16inicio-asistente', async () => { await cerrarBuscador(); const x = await p.$('.uk.is-chat .uk-chathead__x'); if (x) await x.click(); }, 1500, async () => { if (!(await navVisible())) errs.push(paso + ' · la barra de abajo no volvió al salir'); });
    await step('17buscar-app', async () => { await p.click('.nav-item[data-view="0"]'); await p.waitForTimeout(800); await p.click('[data-action="Buscar"]'); await p.waitForTimeout(600); await p.keyboard.type('tarjeta'); }, 1500);
    reporte[persona] = errs; total += errs.length; console.log(persona, errs.length ? errs : 'sin errores');
    await ctx.close();
  }
  // Páginas sueltas que también se publican
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  for (const u of ['index.html?app=clasica', 'duo.html', 'guia.html', 'principios.html', 'sandbox/index.html', 'sandbox/mundo.html', 'sandbox/animaciones.html', 'sandbox/conocimiento.html', 'buscador/index.html']) {
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('error de JS: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !IGN.test(m.text())) errs.push('consola: ' + m.text().slice(0, 160)); });
    p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) errs.push('no carga (' + r.status() + '): ' + r.url().slice(BASE.length)); });
    try { await p.goto(BASE + u); await p.waitForTimeout(2500); await p.screenshot({ path: path.join(OUT, 'pagina_' + u.replace(/[\/?=.]/g, '_') + '.png') }); } catch (e) { errs.push('no se pudo abrir: ' + e.message.slice(0, 100)); }
    reporte[u] = errs; total += errs.length; console.log(u, errs.length ? errs : 'sin errores'); await p.close();
  }
  fs.writeFileSync(path.join(OUT, 'reporte.json'), JSON.stringify(reporte, null, 1));
  console.log(total ? total + ' problemas (ver reporte.json)' : 'Todo bien');
  await b.close(); process.exit(total ? 1 : 0);
})();
