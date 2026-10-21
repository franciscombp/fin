# Genera la sección "cuentas" de assets/pfm/datos.json: productos por persona,
# coherentes con sus movimientos. La cuenta transaccional toma el último saldo
# real de sus movimientos; ahorro flexible, metas e inversiones son fijas y van
# acordes con el perfil de cada persona (poco en transaccional => más en ahorro).
import json, sys, collections
RUTA = 'assets/pfm/datos.json'
d = json.load(open(RUTA, encoding='utf-8'))
movs = d['movimientos']
D = d['dic']

# Perfil financiero: lo que tiene fuera de la transaccional (ficticio, coherente con su historia)
PERFIL = {
    'andres': {'metas': [('Viaje a Galápagos', 640.00, 2000.00)],
               'inversiones': [('Depósito a plazo 12 meses', 3000.00, '7764')]},
    'rosa': {'ahorro_extra': ('Ahorro flexible', 1400.00, '8801'), 'metas': [('Arreglo de la tienda', 180.00, 500.00)],
             'inversiones': []},
    'daniela': {'metas': [('Laptop para la universidad', 380.00, 900.00)],
                'inversiones': []},
    'jorge': {'metas': [('Fondo de salud', 900.00, 1500.00)],
              'inversiones': [('Depósito a plazo 24 meses', 6000.00, '4409')]},
    'luis': {'ahorro_extra': ('Ahorro flexible', 310.00, '8802'), 'metas': [('Pagar el celular', 120.00, 240.00)],
             'inversiones': []},
    # Cliente nueva: solo su cuenta transaccional, sin movimientos (la cuenta se agrega abajo, no sale de movimientos)
    'camila': {'metas': [], 'inversiones': [], 'cuenta_nueva': ('Cuenta transaccional', '3350')},
}

def mask(n): return '••' + n[-4:]

cuentas = {}
for u in d['usuarios']:
    k = u['usuario']
    # Cuentas de la base (fuente con producto "Cuenta"), con su último saldo real
    # Las filas guardan índices: fuente=r[2], producto=r[3], saldo=r[11]
    por_fuente = collections.Counter(D['fuente'][r[2]] for r in movs[k] if D['producto'][r[3]] == 'Cuenta')
    ultimo = {}
    for r in movs[k]:
        if D['producto'][r[3]] == 'Cuenta' and r[11] is not None:
            ultimo[D['fuente'][r[2]]] = r[11]
    base = list(por_fuente)
    base.sort(key=lambda f: -por_fuente[f])
    lista = []
    # Todas las cuentas que aparecen en sus movimientos, con su último saldo real
    for i, f in enumerate(base):
        num = f.split('···')[-1] if '···' in f else '0000'
        nombre_c = f.split(' Pichibank')[0].split(' ···')[0]
        if i == 0:
            lista.append({'tipo': 'transaccional', 'nombre': nombre_c, 'numero': num, 'saldo': round(ultimo.get(f, 0.0), 2), 'fuente': f})
        else:
            lista.append({'tipo': 'ahorro', 'nombre': nombre_c, 'numero': num, 'saldo': round(ultimo.get(f, 0.0), 2), 'fuente': f})
    p = PERFIL[k]
    if not lista and p.get('cuenta_nueva'):
        nombre_n, num_n = p['cuenta_nueva']
        lista.append({'tipo': 'transaccional', 'nombre': nombre_n, 'numero': num_n, 'saldo': 0.0, 'fuente': nombre_n + ' Pichibank ···' + num_n})
    # Ahorro flexible adicional: quien tiene poco en la transaccional guarda en otra cuenta
    if p.get('ahorro_extra'):
        nombre_e, saldo_e, num_e = p['ahorro_extra']
        lista.append({'tipo': 'ahorro', 'nombre': nombre_e, 'numero': num_e, 'saldo': saldo_e})
    for nombre_m, actual, meta in p['metas']:
        lista.append({'tipo': 'meta', 'nombre': nombre_m, 'numero': '', 'saldo': actual, 'meta': meta})
    for nombre_i, monto, num_i in p['inversiones']:
        lista.append({'tipo': 'inversion', 'nombre': nombre_i, 'numero': num_i, 'saldo': monto})
    cuentas[k] = lista

d['cuentas'] = cuentas
json.dump(d, open(RUTA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in cuentas.items():
    print(k, [(x['tipo'], x['nombre'], x['saldo']) for x in v])
