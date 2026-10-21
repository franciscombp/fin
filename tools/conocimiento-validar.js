#!/usr/bin/env node
/* Valida assets/conocimiento/base.json antes de publicar:
   - esquema mínimo de cada entrada (id, tipo, cat, t, k, r o go),
   - ids y títulos únicos, categorías existentes,
   - que cada acción (do:, tab:, card:) exista en index.html,
   - que cada {marcador} de los textos tenga valor en "valores",
   - y avisa si una pregunta que también vive en assets/soporte.js (misma
     pregunta) tiene una respuesta distinta, para que no se desalineen.
   Uso: node tools/conocimiento-validar.js   (sale con 1 si hay errores) */
'use strict';
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const base = JSON.parse(fs.readFileSync(path.join(raiz, 'assets/conocimiento/base.json'), 'utf8'));
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const soporte = fs.readFileSync(path.join(raiz, 'assets/soporte.js'), 'utf8');

const errores = [], avisos = [];
const TIPOS = ['faq', 'producto', 'accion'];
const cats = new Set(base.categorias.map(c => c.id));
const acciones = new Set([...html.matchAll(/data-action="([^"$]+)"/g)].map(m => m[1]));
const paneles = new Set([...html.matchAll(/data-panel="([^"]+)"/g)].map(m => m[1]));
// Productos de la demo que se abren por nombre (filas de producto y tarjetas)
const productos = new Set(['Cuenta PRINCIPAL', 'Mastercard Black', 'Seguro de vida']);
const especiales = new Set(['pfm', 'review', 'handoff', 'sol', 'search']);
const marcadores = new Set(Object.keys(base.valores || {}));

function revisarClave(k, donde) {
  if (especiales.has(k) || k.startsWith('ask:')) return;
  const [kind, ...rest] = k.split(':'); const v = rest.join(':');
  if (kind === 'do' && !(acciones.has(v) || productos.has(v))) errores.push(`${donde}: la acción "do:${v}" no existe en index.html`);
  else if (kind === 'tab' && !paneles.has(v)) errores.push(`${donde}: la pestaña "tab:${v}" no existe`);
  else if (kind === 'card' && !productos.has(v)) errores.push(`${donde}: la tarjeta "card:${v}" no existe`);
  else if (!['do', 'tab', 'card'].includes(kind)) errores.push(`${donde}: clave de acción desconocida "${k}"`);
}
function revisarTexto(s, donde) {
  for (const m of String(s || '').matchAll(/\{([a-z0-9_.]+)\}/gi)) if (!marcadores.has(m[1])) errores.push(`${donde}: el marcador {${m[1]}} no tiene valor en "valores"`);
}

const ids = new Set(), titulos = new Map();
for (const e of base.entradas) {
  const d = e.id || '(sin id)';
  if (!e.id) errores.push('Una entrada no tiene id');
  if (ids.has(e.id)) errores.push(`${d}: id repetido`); ids.add(e.id);
  if (!TIPOS.includes(e.tipo)) errores.push(`${d}: tipo "${e.tipo}" no es faq, producto ni accion`);
  if (!cats.has(e.cat)) errores.push(`${d}: categoría "${e.cat}" no existe`);
  if (!e.t) errores.push(`${d}: sin título`);
  const nt = String(e.t).toLowerCase();
  if (titulos.has(nt)) avisos.push(`${d}: mismo título que ${titulos.get(nt)}`); titulos.set(nt, d);
  if (!Array.isArray(e.k) || e.k.length < 3) errores.push(`${d}: necesita al menos 3 palabras clave en "k"`);
  if (e.tipo === 'accion' && !e.go) errores.push(`${d}: una acción necesita "go"`);
  if (e.tipo !== 'accion' && !e.r) errores.push(`${d}: necesita respuesta "r"`);
  if (e.tipo === 'producto' && !(e.datos && e.datos.length)) avisos.push(`${d}: un producto sin "datos"`);
  if (e.go) revisarClave(e.go, d);
  (e.acts || []).forEach(a => { if (!Array.isArray(a) || a.length !== 2) errores.push(`${d}: cada acción es [etiqueta, clave]`); else revisarClave(a[1], d); });
  revisarTexto(e.r, d); (e.datos || []).forEach(x => revisarTexto(x[1], d));
  if (e.r && String(e.r).length > 520) avisos.push(`${d}: respuesta larga (${e.r.length} caracteres); mejor en dos entradas`);
}
// Deriva frente a soporte.js: misma pregunta, otra respuesta
const faqSoporte = new Map();
for (const m of soporte.matchAll(/t: '((?:[^'\\]|\\.)*)',[^\n]*\n\s*a: '((?:[^'\\]|\\.)*)'/g)) faqSoporte.set(m[1].replace(/\\'/g, "'"), m[2].replace(/\\'/g, "'"));
for (const e of base.entradas) {
  if (e.tipo !== 'faq' || !faqSoporte.has(e.t)) continue;
  const a = faqSoporte.get(e.t), b = String(e.r);
  if (a !== b && !b.startsWith(a.slice(0, 40))) avisos.push(`${e.id}: la respuesta difiere de la de soporte.js para «${e.t}»`);
}

const porTipo = base.entradas.reduce((o, e) => (o[e.tipo] = (o[e.tipo] || 0) + 1, o), {});
console.log(`Base de conocimiento: ${base.entradas.length} entradas (${Object.entries(porTipo).map(([k, v]) => `${v} ${k}`).join(', ')}), ${base.categorias.length} categorías, ${Object.keys(base.sinonimos || {}).length} sinónimos.`);
avisos.forEach(a => console.log('aviso: ' + a));
errores.forEach(e => console.log('ERROR: ' + e));
console.log(errores.length ? `${errores.length} error(es).` : 'Sin errores.');
process.exit(errores.length ? 1 : 0);
