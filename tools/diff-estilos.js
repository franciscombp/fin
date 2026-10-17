const fs = require('fs');
const S = process.argv[2];
const a = JSON.parse(fs.readFileSync(S + '/baseline.json', 'utf8')), b = JSON.parse(fs.readFileSync(S + '/after.json', 'utf8'));
const diffs = [];
for (const pg of ['inicio', 'finanzas']) for (const k of Object.keys(a[pg])) if (a[pg][k] !== b[pg][k]) diffs.push(pg + ' ' + k + '\n  antes: ' + a[pg][k].slice(0, 160) + '\n  ahora: ' + String(b[pg][k] || '').slice(0, 160));
console.log('keys', Object.keys(a.inicio).length + Object.keys(a.finanzas).length, 'diffs', diffs.length);
console.log(diffs.slice(0, 8).join('\n'));
