#!/usr/bin/env python3
"""Arma assets/pfm/datos.json (datos del PFM para el prototipo) desde los
JSON de la Base de datos PFM: movimientos, usuarios, deudas, escenarios e
hipoteca. Uso: python3 tools/pfm-datos.py <carpeta con los 5 JSON>

- La marca se escribe Deuna (la base trae "De Una" y "DeUna").
- En el prototipo el banco es Pichibank (la base dice Banco Pichincha / BP).
- Los movimientos van como filas cortas con diccionarios, para que pese poco.
"""
import json, re, sys, os

src = sys.argv[1]
def load(name):
    for f in os.listdir(src):
        d = json.load(open(os.path.join(src, f)))
        rows = d if isinstance(d, list) else d.get('rows') or d.get('data')
        if rows and name(rows[0]):
            return rows
    raise SystemExit('falta un archivo')

def fix(s):
    if not isinstance(s, str): return s
    s = re.sub(r'De ?Una|DEUNA|Deuna', 'Deuna', s, flags=re.I)
    s = s.replace('Banco Pichincha', 'Pichibank')
    s = re.sub(r'\bBP\b', 'Pichibank', s)
    return s
def fixrow(r): return {k: fix(v) for k, v in r.items()}

mov = load(lambda r: 'tratamiento' in r)
usr = [fixrow(r) for r in load(lambda r: 'lo_que_necesita' in r)]
deu = [fixrow(r) for r in load(lambda r: 'cuota_mensual' in r)]
esc = [fixrow(r) for r in load(lambda r: 'pfm_deberia' in r)]
hip = load(lambda r: 'saldo_capital' in r)

# Hipoteca: solo el resumen que usa el PFM
pag = [h for h in hip if h['estado'] == 'Pagada']
pend = [h for h in hip if h['estado'] != 'Pagada']
hipoteca = {'usuario': hip[0]['usuario'], 'cuotas': len(hip), 'pagadas': len(pag),
            'cuota': pend[0]['total'] if pend else 0, 'proxima': pend[0]['fecha'] if pend else None,
            'saldo_capital': pag[-1]['saldo_capital'] if pag else hip[0]['saldo_capital'],
            'interes_pagado': round(sum(h['interes'] for h in pag), 2)}

dicts = {k: [] for k in ('fuente', 'producto', 'descripcion', 'contraparte', 'tratamiento', 'categoria', 'escenario', 'nota')}
def ix(k, v):
    v = fix(v or '')
    L = dicts[k]
    if v not in L: L.append(v)
    return L.index(v)

out = {}
for r in sorted(mov, key=lambda r: (r['fecha'], r['hora'], r['id'])):
    out.setdefault(r['usuario'], []).append([
        r['fecha'], r['hora'], ix('fuente', r['fuente']), ix('producto', r['producto']),
        ix('descripcion', r['descripcion']), ix('contraparte', r['contraparte']), r['monto'],
        ix('tratamiento', r['tratamiento']), ix('categoria', r['categoria']), ix('escenario', r['escenario']),
        ix('nota', r['nota'])])

data = {'fuente': 'Base de datos PFM (datos ficticios)', 'hoy': max(r['fecha'] for r in mov),
        'campos': ['fecha', 'hora', 'fuente', 'producto', 'descripcion', 'contraparte', 'monto', 'tratamiento', 'categoria', 'escenario', 'nota'],
        'dic': dicts, 'usuarios': usr, 'deudas': deu, 'escenarios': esc, 'hipoteca': hipoteca, 'movimientos': out}
dst = os.path.join(os.path.dirname(__file__), '..', 'assets', 'pfm', 'datos.json')
json.dump(data, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
print(dst, os.path.getsize(dst), {u: len(v) for u, v in out.items()})
