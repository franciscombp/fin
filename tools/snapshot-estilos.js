// Uso: sirve la app (python3 -m http.server 8765), luego: node tools/snapshot-estilos.js > antes.json; después de cambiar estilos: node tools/snapshot-estilos.js > despues.json; y node tools/diff-estilos.js <carpeta con antes.json y despues.json>
// Captura los estilos calculados de los componentes en Inicio y Mis finanzas
const { chromium, devices } = require('playwright');
const SEL = ['.section__title h2', '.section', '.card', '.sub-item', '.pf-meter', '.pf-sec h2', '.pf-sec', '.account-card', '.amount-row', '.home-banner__title', '.push-chip'];
const PROPS = ['font-family','font-size','font-weight','line-height','color','background-color','padding-top','padding-bottom','padding-left','padding-right','margin-top','margin-bottom','border-radius','letter-spacing'];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ ...devices['iPhone 13'] });
  await p.goto('http://localhost:8765/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.evaluate(() => { var l = document.getElementById('login-screen'); if (l) { l.classList.remove('active'); l.style.display = 'none'; } });
  const out = {};
  out.inicio = await p.evaluate(({ SEL, PROPS }) => {
    const r = {}; SEL.forEach(s => { document.querySelectorAll(s).forEach((el, i) => { if (i > 6) return; const cs = getComputedStyle(el); r[s + '#' + i] = PROPS.map(p => cs.getPropertyValue(p)).join('|'); }); });
    return r;
  }, { SEL, PROPS });
  await p.evaluate(() => PFM.open()); await p.waitForTimeout(1200);
  out.finanzas = await p.evaluate(({ SEL, PROPS }) => {
    const r = {}; SEL.forEach(s => { document.querySelectorAll(s).forEach((el, i) => { if (i > 6) return; const cs = getComputedStyle(el); r[s + '#' + i] = PROPS.map(p => cs.getPropertyValue(p)).join('|'); }); });
    return r;
  }, { SEL, PROPS });
  console.log(JSON.stringify(out));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
