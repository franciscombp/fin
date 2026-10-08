/* Recorre la app en un navegador y anota cada texto visible (también los
   que arma el JS: hojas, toasts, chat, Mis finanzas) para el catálogo.
   Uso:  node tools/i18n-recorrer.js http://localhost:8765/index.html > /tmp/textos.json
   Requiere Playwright. Luego: python3 tools/i18n-extraer.py --textos /tmp/textos.json */
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/index.html';
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
  await p.addInitScript(() => {
    const seen = window.__textos = {};
    const ATTR = ['aria-label', 'placeholder', 'title', 'alt'];
    const skip = el => { for (let n = el; n && n.nodeType === 1; n = n.parentNode) { if (/^(SCRIPT|STYLE|svg|NOSCRIPT)$/.test(n.tagName) || n.getAttribute('translate') === 'no' || n.classList.contains('material-symbols-rounded')) return true; } return false; };
    const add = s => { s = (s || '').replace(/\s+/g, ' ').trim(); if (s && /[A-Za-zÁÉÍÓÚáéíóúñ]{2}/.test(s)) seen[s] = (seen[s] || 0) + 1; };
    const walk = r => {
      if (r.nodeType === 3) { if (r.parentNode && !skip(r.parentNode)) add(r.nodeValue); return; }
      if (r.nodeType !== 1 || skip(r)) return;
      ATTR.forEach(a => add(r.getAttribute(a)));
      r.querySelectorAll('*').forEach(e => { if (!skip(e)) { ATTR.forEach(a => add(e.getAttribute(a))); e.childNodes.forEach(c => { if (c.nodeType === 3) add(c.nodeValue); }); } });
    };
    new MutationObserver(l => l.forEach(m => { if (m.type === 'characterData') walk(m.target); else if (m.type === 'attributes') walk(m.target); else m.addedNodes.forEach(walk); }))
      .observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
    document.addEventListener('DOMContentLoaded', () => walk(document.body));
  });
  const w = ms => p.waitForTimeout(ms);
  const ev = (f, a) => p.evaluate(f, a).catch(() => {});
  await p.goto(url); await w(800);
  await ev(() => localStorage.clear()); await p.reload(); await w(1500);
  await ev(() => { document.getElementById('login-screen').classList.remove('active'); document.getElementById('home-page').classList.remove('hidden'); });
  await w(800);
  // Pestañas de Inicio
  for (const tab of ['Cuentas', 'Tarjetas', 'Prestamos', 'Inversiones', 'Seguros', 'Destacado']) { await ev(t => { const b = document.querySelector('.tabs .tab[data-panel="' + t + '"]'); b && b.click(); }, tab); await w(400); }
  // Hojas y acciones (cada botón con data-action/data-sheet; se cierran al toque)
  const acts = await p.evaluate(() => [...new Set([...document.querySelectorAll('#home-page [data-action]')].map(e => e.dataset.action))]);
  for (const a of acts.slice(0, 40)) {
    await ev(a => { const e = document.querySelector('#home-page [data-action="' + a + '"]'); e && e.click(); }, a); await w(450);
    await ev(() => { document.querySelectorAll('.push-page.open .push-back, .push-page.open [data-push-close], .sheet-backdrop.open, .as-sheet-back.open').forEach(x => x.click()); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); }); await w(300);
  }
  // Mis finanzas: todos los meses, hojas de detalle
  await ev(() => Asistente.openPF()); await w(1200);
  for (const m of ['jun', 'jul', 'ago', 'sep', 'oct']) { await ev(m => document.querySelector('[data-pf="view:' + m + '"]').click(), m); await w(500); }
  await ev(() => { const b = document.querySelector('[data-pf="ondemand"]'); b && b.click(); }); await w(1300);
  await ev(() => document.querySelector('[data-pf="view:sep"]').click()); await w(500);
  for (const sel of ['[data-pf="health"]', '[data-pf="accounts"]', '[data-pf^="det:"]', '[data-pf^="breakdown:"]', '[data-pf="settings"]']) {
    await ev(s => { const b = document.querySelector(s); b && b.click(); }, sel); await w(500);
    await ev(() => { const c = document.querySelector('.as-sheet.open [data-sheet="connect"]'); c && c.click(); }); await w(400);
    await ev(() => document.querySelector('.as-sheet-back.open') && document.querySelector('.as-sheet-back.open').click()); await w(300);
  }
  // Escenarios (cambian textos de insights)
  for (const sc of ['dificil', 'excelente', 'normal']) {
    await ev(() => document.querySelector('[data-pf="settings"]').click()); await w(300);
    await ev(s => document.querySelector('[data-sc="' + s + '"]').click(), sc); await w(400);
    await ev(() => document.querySelector('.as-sheet-back.open').click()); await w(300);
    for (const m of ['ago', 'sep', 'oct']) { await ev(m => document.querySelector('[data-pf="view:' + m + '"]').click(), m); await w(300); }
  }
  await ev(() => document.querySelector('[data-pf="close"]').click()); await w(400);
  // Asistente: hub, cada tema y cada sugerencia
  await ev(() => Asistente.open()); await w(1200);
  const qs = ['hola', '¿En qué se me va la plata?', '¿Cómo voy con mis metas?', 'Mis gastos hormiga', '¿Cuánto más puedo ahorrar?', 'Septiembre vs. agosto', '¿En qué me pasé?', 'Mis suscripciones', '¿Cómo me fue en mayo?', '¿Cómo voy en general?',
    '¿Cuánto debo en mi tarjeta?', '¿Cuánto pago de intereses?', '¿Cuánto tengo en total?', '¿Para cuántos meses me alcanza?', '¿Qué pasa si pago tarde un servicio?', '¿Cuánto pago en servicios?', '¿Cuánto gasté en compras?', 'algo raro'];
  for (const q of qs) { await ev(q => Asistente.ask(q), q); await w(2600); }
  await ev(() => document.querySelector('[data-as="land"]').click()); await w(400);
  // Buscador
  await ev(() => Buscador.open()); await w(300);
  for (const q of ['transferir', 'plata', 'gaste', 'tarjeta', 'meta', 'luz']) { await p.fill('.sx-field input', q).catch(() => {}); await w(250); }
  console.log(JSON.stringify(await p.evaluate(() => window.__textos), null, 1));
  await b.close();
})();
