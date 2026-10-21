/*
 * Servidor sencillo del contador de festejos (sin dependencias).
 *
 *   node server.js            → escucha en http://localhost:8787
 *   PORT=3000 node server.js  → puerto personalizado
 *
 * API:
 *   GET  /api/celebrations  → { count }
 *   POST /api/celebrations  → incrementa y devuelve { count }
 *   POST /api/orquestador   → el orquestador de Uku (orquestador/LEEME.md): { usuario, texto | accion, estado }
 *                             → { manejado, mensajes, estado, efectos, sugerencias }. La app lo usa si se
 *                             configura su URL (localStorage 'orq-url'); si no, corre el mismo código en un worker.
 *
 * El total se persiste en celebrations.json junto al script.
 * CORS abierto para que la PWA (GitHub Pages / localhost) pueda consultarlo.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const DATA_FILE = path.join(__dirname, 'celebrations.json');

function readCount() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).count || 0;
  } catch (e) {
    return 0;
  }
}

function writeCount(count) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ count, updatedAt: new Date().toISOString() }));
}

let count = readCount();

// El orquestador de Uku: el mismo núcleo, herramientas y habilidades que corren en el worker del navegador
const orquestador = require('./orquestador/nucleo.js')({
  habilidades: [require('./orquestador/habilidades/viaje.js')],
  herramientas: { finanzas: require('./orquestador/herramientas/finanzas.js')(JSON.parse(fs.readFileSync(path.join(__dirname, 'assets/pfm/datos.json'), 'utf8'))) },
  config: { viaje: JSON.parse(fs.readFileSync(path.join(__dirname, 'orquestador/config/viajes.json'), 'utf8')) }
});

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = req.url.split('?')[0];
  if (url === '/api/celebrations') {
    if (req.method === 'POST') {
      count += 1;
      writeCount(count);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ count }));
  }

  if (url === '/api/orquestador' && req.method === 'POST') {
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; if (cuerpo.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const r = orquestador.atender(JSON.parse(cuerpo || '{}'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e.message || e) }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`Contador de festejos en http://localhost:${PORT}/api/celebrations (total actual: ${count})`);
  console.log(`Orquestador de Uku en http://localhost:${PORT}/api/orquestador`);
});
