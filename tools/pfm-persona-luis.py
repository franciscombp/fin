#!/usr/bin/env python3
"""Agrega a assets/pfm/datos.json una quinta persona de demo: Luis Cedeño.

Representa a muchos clientes reales: gana el sueldo básico en dos quincenas,
el día de pago retira casi todo en efectivo, paga la tarjeta apenas cobra y
la cuenta se queda con unos $20 en promedio, sin ahorro. Le pasa una mesada
a su mamá y hace pagos chicos con Deuna (recargas, tienda, bus).

Se puede correr varias veces: borra a Luis y lo vuelve a generar con la
misma semilla. Uso: python3 tools/pfm-persona-luis.py
"""
import json, os, random, datetime as dt

DST = os.path.join(os.path.dirname(__file__), '..', 'assets', 'pfm', 'datos.json')
data = json.load(open(DST))
U = 'luis'
data['usuarios'] = [u for u in data['usuarios'] if u['usuario'] != U]
data['deudas'] = [d for d in data['deudas'] if d['usuario'] != U]
data['movimientos'].pop(U, None)
D = data['dic']

def ix(k, v):
    L = D[k]
    if v not in L: L.append(v)
    return L.index(v)

rnd = random.Random(470)
CTA, VISA, DEUNA = 'Cuenta de ahorro Pichibank ···5108', 'Visa Pichibank ···6230', 'Deuna ···2094'
SUELDO, MAMA = 235.0, 'Carmen Cedeño Mora'
ini, fin = dt.date(2025, 10, 1), dt.date(2026, 10, 15)

ev = []  # (fecha, hora, orden, tipo, datos)
def add(f, h, tipo, **k):
    if ini <= f <= fin: ev.append((f, h, tipo, k))

def habil(f):  # el sueldo cae el viernes si la fecha es fin de semana
    while f.weekday() > 4: f -= dt.timedelta(days=1)
    return f

d = ini
while d <= fin:
    y, m = d.year, d.month
    ult = (dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1))
    for q, dia in ((1, 15), (2, ult.day)):
        f = habil(dt.date(y, m, dia))
        add(f, '06:10', 'sueldo', monto=SUELDO)
        if q == 2: add(f, '07:40', 'tarjeta')          # paga la tarjeta apenas cobra
        add(f, '08:15' if q == 1 else '08:30', 'retiro')  # y retira casi todo
    # Décimo tercero (diciembre) y décimo cuarto (marzo, en la Costa)
    if m == 12: add(dt.date(y, 12, 19), '06:12', 'decimo', monto=470.0, n='Décimo tercer sueldo')
    if m == 3: add(dt.date(y, 3, 13), '06:12', 'decimo', monto=470.0, n='Décimo cuarto sueldo')
    # Mesada a su mamá: el 1 o 2 de cada mes, siempre parecida
    add(dt.date(y, m, rnd.choice((1, 2))), '19:%02d' % rnd.randint(0, 50), 'mesada', monto=rnd.choice((40.0, 40.0, 40.0, 35.0, 45.0)))
    # Compras con la Visa: supermercado, farmacia, comida y alguna cosa del hogar
    for _ in range(rnd.randint(5, 8)):
        c = rnd.choice([('TIA GUASMO SUR', 'Alimentación', 8, 28), ('MI COMISARIATO SUR', 'Alimentación', 10, 32), ('FARMACIAS SANA SANA', 'Salud', 3, 14),
                        ('KFC MALL DEL SUR', 'Restaurantes', 6, 12), ('PYCCA', 'Hogar', 5, 18), ('CLARO RECARGA ONLINE', 'Servicios básicos', 3, 6)])
        add(dt.date(y, m, rnd.randint(1, ult.day)), '%02d:%02d' % (rnd.randint(9, 21), rnd.randint(0, 59)), 'visa', d=c[0], c=c[1], monto=round(rnd.uniform(c[2], c[3]), 2))
    # Deuna: recarga del celular, la tienda del barrio, el bus y un pana
    for _ in range(rnd.randint(4, 7)):
        c = rnd.choice([('Pago a comercio Claro recargas', 'Claro recargas', 'Servicios básicos', 2, 5), ('Pago a comercio Tienda Doña Mary', 'Tienda Doña Mary', 'Alimentación', 1, 6),
                        ('Pago a comercio Metrovía', 'Metrovía', 'Transporte', .3, .6), ('Pago a persona Jefferson Quiñónez Bone', 'Jefferson Quiñónez Bone', 'Transferencia a persona', 2, 5)])
        dd = dt.date(y, m, rnd.randint(1, ult.day))
        add(dd, '%02d:%02d' % (rnd.randint(7, 20), rnd.randint(0, 59)), 'deuna', d=c[0], cp=c[1], c=c[2], monto=round(rnd.uniform(c[3], c[4]), 2))
    # Un retiro chico a mitad de quincena, en el corresponsal del barrio
    add(dt.date(y, m, rnd.choice((8, 9, 22, 23))), '18:%02d' % rnd.randint(0, 59), 'cnb')
    d = ult + dt.timedelta(days=1)

ORD = {'sueldo': 0, 'decimo': 0, 'tarjeta': 1, 'retiro': 2}
ev.sort(key=lambda e: (e[0], ORD.get(e[2], 3), e[1]))

rows, saldo, visa = [], 18.40, 64.20
def row(f, h, src, prod, desc, cp, monto, trat, cat, esc='', nota='', s=None):
    rows.append([f.isoformat(), h, ix('fuente', src), ix('producto', prod), ix('descripcion', desc), ix('contraparte', cp), round(monto, 2),
                 ix('tratamiento', trat), ix('categoria', cat), ix('escenario', esc), ix('nota', nota), None if s is None else round(s, 2)])

for f, h, t, k in ev:
    if t in ('sueldo', 'decimo'):
        saldo += k['monto']
        row(f, h, CTA, 'Cuenta', 'Pago con transferencia NÓMINA DISTRIBUIDORA EL CÓNDOR' if t == 'sueldo' else 'NÓMINA DISTRIBUIDORA EL CÓNDOR ' + k['n'].upper(),
            'Distribuidora El Cóndor', k['monto'], 'Ingreso', 'Sueldo', 'Sueldo quincenal' if t == 'sueldo' else 'Décimos', '' if t == 'sueldo' else k['n'], saldo)
        if t == 'decimo':  # con el décimo paga toda la tarjeta
            p = round(min(visa, saldo - 30), 2)
            if p > 0:
                saldo -= p; visa -= p
                row(f, '06:40', CTA, 'Cuenta', 'Pago Tarjeta de Crédito Visa Pichibank', 'tú', -p, 'Excluido', 'Pago de tarjeta', 'Tarjeta Pichibank', 'Con el décimo paga el total', saldo)
                row(f, '06:40', VISA, 'Tarjeta de crédito', 'SU PAGO MUCHAS GRACIAS', 'tú', p, 'Excluido', 'Pago de tarjeta', 'Tarjeta Pichibank')
    elif t == 'tarjeta':
        if visa <= 0: continue
        minimo = rnd.random() < .35
        p = round(min(visa, max(25.0, visa * .1)) if minimo else min(visa, rnd.uniform(.7, 1) * visa, saldo - 60), 2)
        if p <= 0: continue
        saldo -= p; visa -= p
        row(f, h, CTA, 'Cuenta', 'Pago Tarjeta de Crédito Visa Pichibank', 'tú', -p, 'Excluido', 'Pago de tarjeta', 'Tarjeta Pichibank', 'Pagó el mínimo' if minimo else '', saldo)
        row(f, h, VISA, 'Tarjeta de crédito', 'SU PAGO MUCHAS GRACIAS', 'tú', p, 'Excluido', 'Pago de tarjeta', 'Tarjeta Pichibank', 'Pagó el mínimo' if minimo else '')
        if minimo:
            i = round(visa * .016, 2); visa += i
            row(f + dt.timedelta(days=6), '03:00', VISA, 'Tarjeta de crédito', 'INTERÉS DE FINANCIAMIENTO', 'Pichibank', -i, 'Gasto', 'Servicios financieros y deudas', 'Tarjeta Pichibank', 'Interés por pagar solo el mínimo')
    elif t == 'retiro':
        queda = rnd.uniform(4, 14) + (40 if f.day > 16 else 0)  # a fin de mes deja la mesada de su mamá
        a = int((saldo - queda) // 10 * 10)
        if a < 20: continue
        saldo -= a
        lugar = rnd.choice(('CAJERO PICHIBANK GUASMO', 'CAJERO PICHIBANK MALL DEL SUR', 'RETIRO CNB MI VECINO TIENDA EL PANA'))
        row(f, h, CTA, 'Cuenta', 'RETIRO ' + lugar if not lugar.startswith('RETIRO') else lugar, 'Pichibank', -a, 'Gasto', 'Efectivo retirado', 'Vida en efectivo',
            'Arriendo, comida, bus y la cuota de Artefacta se pagan en efectivo', saldo)
    elif t == 'cnb':
        a = 20 if saldo >= 26 else 10 if saldo >= 14 else 0
        if not a: continue
        saldo -= a
        row(f, h, CTA, 'Cuenta', 'RETIRO CNB MI VECINO TIENDA EL PANA', 'Pichibank', -a, 'Gasto', 'Efectivo retirado', 'Vida en efectivo', 'Retiro chico a mitad de quincena', saldo)
    elif t == 'mesada':
        if saldo < k['monto'] + 2: continue
        saldo -= k['monto']
        row(f, h, CTA, 'Cuenta', 'Transf. Directa a ' + MAMA, MAMA, -k['monto'], 'Por revisar', 'Transferencia a persona', 'Apoyo a padres',
            'Mesada a su mamá: cada mes, monto parecido', saldo)
    elif t == 'visa':
        visa += k['monto']
        row(f, h, VISA, 'Tarjeta de crédito', k['d'], k['d'].title(), -k['monto'], 'Gasto', k['c'], 'Tarjeta Pichibank')
    elif t == 'deuna':
        v = k['monto']
        if saldo < v + 1: continue
        saldo -= v
        row(f, h, DEUNA, 'Deuna', 'Recarga de saldo', 'tú (cuenta Pichibank)', v, 'Excluido', 'Recarga Deuna', 'Deuna con recarga', 'Viene de la cuenta Pichibank', v)
        row(f, h, CTA, 'Cuenta', 'Transf. Deuna a Luis Cedeño', 'tú (Deuna)', -v, 'Gasto', 'Pagos con Deuna', 'Deuna con recarga', 'Recarga del mismo monto que el pago; el detalle está en Deuna', saldo)
        row(f, h, DEUNA, 'Deuna', k['d'], k['cp'], -v, 'Detalle Deuna', k['c'], 'Deuna con recarga', 'No suma: la recarga ya contó', 0.0)

rows.sort(key=lambda r: (r[0], r[1]))
data['movimientos'][U] = rows
data['usuarios'].append({
    'usuario': U, 'nombre': 'Luis Cedeño', 'edad': 28, 'ciudad': 'Guayaquil', 'tipo': 'Vive al día con el sueldo básico',
    'grupo_investigacion': 'Clientes con digitalización media o básica',
    'ingreso_mensual': '$470 de sueldo básico en dos quincenas, más los décimos',
    'hogar': 'Vive con su pareja y su hija de 3 años; le pasa una mesada a su mamá',
    'digitalizacion': 'Media: el día de pago retira casi todo en efectivo; usa Deuna para recargas y la tienda',
    'productos_bp': 'Cuenta de ahorro, Visa Pichibank (cupo $400), Deuna',
    'fuera_de_bp': 'Celular a crédito en Artefacta, que paga en efectivo',
    'casos': 'Saldo promedio de unos $20, sueldo retirado en efectivo, tarjeta pagada apenas cobra (a veces solo el mínimo), sin ahorro, mesada a su mamá, pagos chicos con Deuna',
    'lo_que_necesita': 'Saber en qué se le va el efectivo, dejar de pagar el mínimo y juntar un pequeño colchón'})
data['deudas'] += [
    {'usuario': U, 'producto': 'Visa Pichibank ···6230', 'institucion': 'Pichibank', 'en_mvp': 'Sí', 'saldo': round(visa, 2), 'cuota_mensual': round(max(25, visa * .1), 2), 'nota': 'Cupo $400; a veces paga solo el mínimo'},
    {'usuario': U, 'producto': 'Celular a crédito', 'institucion': 'Artefacta', 'en_mvp': 'No: casa comercial, la paga en efectivo', 'saldo': 214.0, 'cuota_mensual': 38.0, 'nota': 'El banco no la ve'}]
json.dump(data, open(DST, 'w'), ensure_ascii=False, separators=(',', ':'))
# Saldo promedio de fin de día (lo que de verdad se queda en la cuenta)
fd, last, tot, n = {}, 18.40, 0, 0
for r in rows:
    if r[11] is not None and D['fuente'][r[2]] == CTA: fd[r[0]] = r[11]
x = ini
while x <= fin: last = fd.get(x.isoformat(), last); tot += last; n += 1; x += dt.timedelta(days=1)
print(len(rows), 'movimientos; saldo final', round(saldo, 2), '; saldo promedio diario', round(tot / n, 2), '; Visa', round(visa, 2))
