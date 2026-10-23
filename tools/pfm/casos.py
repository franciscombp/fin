"""Agrega a assets/pfm/datos.json tres casos nuevos de registro, con movimientos crudos (sin etiquetas):
el front (assets/pfm-analisis.js) deduce solo qué es cada movimiento.

    python3 tools/pfm/casos.py

- Paula: su sueldo de $2.000 pasa entero a su ahorro flexible (4,75 % al año, pagado cada día sobre el saldo
  del día) y, cuando se le acaba el dinero de la cuenta principal, saca de la flexible a la transaccional
  (0,01 % al año).
- Esteban: cada mes manda lo que le sobra a una póliza a plazo fijo; al vencer le vuelve el capital con sus intereses
  y a veces la renueva.
- Segundo: cobra su sueldo y lo saca casi todo en efectivo el mismo día.

Se puede correr varias veces: primero quita lo que haya agregado antes."""
import json, os, random, datetime as dt

RUTA = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'pfm', 'datos.json')
NUEVOS = ['paula', 'esteban', 'segundo']
HASTA = dt.date(2026, 10, 15)
DESDE = dt.date(2025, 10, 1)
TASA_FLEX, TASA_TRANS = .0475, .0001


def dias():
    d = DESDE
    while d <= HASTA:
        yield d
        d += dt.timedelta(days=1)


class Libro:
    """Movimientos de una persona con el saldo de cada cuenta después de cada uno."""
    def __init__(self, saldos):
        self.saldo = dict(saldos); self.rows = []

    def mov(self, d, h, src, prod, desc, cp, m):
        m = round(m, 2)
        if src in self.saldo: self.saldo[src] = round(self.saldo[src] + m, 2)
        self.rows.append([d.isoformat(), h, src, prod, desc, cp, m, self.saldo.get(src)])


def hora(r, a=7, b=21):
    return '%02d:%02d' % (r.randint(a, b), r.randint(0, 59))


def fin_de_mes(d):
    n = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    return n - dt.timedelta(days=1)


# ---------- Paula: el sueldo va a la flexible y vuelve cuando se acaba ----------
def paula():
    r = random.Random(41)
    T, F = 'Cuenta transaccional Pichibank ···4120', 'Ahorro flexible Pichibank ···7310'
    L = Libro({T: 64.2, F: 3180.0})
    gastos = [  # (día, descripción, contraparte, monto aprox., variación)
        (2, 'Transf. Directa a Andrea Montalvo Ruiz', 'Andrea Montalvo Ruiz', 560, 0),
        (5, 'Pago por servicio de Empresa Eléctrica Quito', 'EEQ', 31, 6), (6, 'Débito automático NETLIFE internet', 'Netlife', 34.99, 0),
        (8, 'Pago por servicio de EPMAPS agua potable', 'EPMAPS', 14, 4), (12, 'Pago por servicio de CLARO plan pospago', 'Claro', 22.4, 0),
    ]
    compras = [('CONSUMO TARJETA DÉBITO SUPERMAXI EL JARDÍN', 'Supermaxi El Jardín', 58, 20), ('CONSUMO TARJETA DÉBITO MEGAMAXI 6 DE DICIEMBRE', 'Megamaxi 6 De Diciembre', 74, 25),
               ('CONSUMO TARJETA DÉBITO UBER RIDES', 'Uber Rides', 7.5, 3), ('CONSUMO TARJETA DÉBITO SUSHI CORP LA CAROLINA', 'Sushi Corp', 26, 8),
               ('CONSUMO TARJETA DÉBITO FYBECA LA Y', 'Fybeca La Y', 18, 9), ('CONSUMO TARJETA DÉBITO CINEMARK QUICENTRO', 'Cinemark Quicentro', 12, 4),
               ('CONSUMO TARJETA DÉBITO KFC QUICENTRO', 'Kfc Quicentro', 11, 3), ('CONSUMO TARJETA DÉBITO PRIMAX AV. AMÉRICA', 'Primax Av. América', 25, 6)]
    for d in dias():
        # cuando se le acaba la plata de la transaccional, saca de la flexible (en montos redondos)
        def pagar(desc, cp, m):
            if L.saldo[T] < m + 25:
                q = max(300, int((m + 120 - L.saldo[T]) / 100 + 1) * 100)
                h = hora(r, 7, 9)
                L.mov(d, h, F, 'Cuenta', 'Transferencia a tu cuenta transaccional ···4120', 'tú', -q)
                L.mov(d, h, T, 'Cuenta', 'Transferencia desde tu Ahorro flexible ···7310', 'tú', q)
            L.mov(d, hora(r, 9, 21), T, 'Cuenta', desc, cp, -m)
        for dia, desc, cp, m, v in gastos:
            if d.day == dia: pagar(desc, cp, round(m + r.uniform(-v, v), 2))
        for desc, cp, m, v in compras:
            if r.random() < (.18 if 'MAXI' in desc else .1): pagar(desc, cp, round(max(2, m + r.uniform(-v, v)), 2))
        # el sueldo llega el último día hábil y pasa entero a la flexible
        if d == fin_de_mes(d) - dt.timedelta(days=max(0, fin_de_mes(d).weekday() - 4)) and d < HASTA:
            L.mov(d, '06:15', T, 'Cuenta', 'Pago con transferencia NÓMINA TECNOLOGÍA ANDINA S.A.', 'Tecnología Andina S.A.', 2000)
            todo = L.saldo[T]; h = hora(r, 8, 10)
            L.mov(d, h, T, 'Cuenta', 'Transferencia a tu Ahorro flexible ···7310', 'tú', -todo)
            L.mov(d, h, F, 'Cuenta', 'Transferencia desde tu cuenta transaccional ···4120', 'tú', todo)
        # intereses: la flexible paga cada día sobre el saldo del día; la transaccional, casi nada, a fin de mes
        L.mov(d, '23:55', F, 'Cuenta', 'Interés diario Ahorro flexible 4,75 %', 'Pichibank', L.saldo[F] * TASA_FLEX / 365)
        if d == fin_de_mes(d): L.mov(d, '23:58', T, 'Cuenta', 'Interés acreditado en su cuenta', 'Pichibank', max(.01, L.saldo[T] * TASA_TRANS / 12))
    L.rows = [x for x in L.rows if abs(x[6]) >= .005]
    cuentas = [{'tipo': 'transaccional', 'nombre': 'Cuenta transaccional', 'numero': '4120', 'saldo': L.saldo[T], 'fuente': T, 'tasa': .01},
               {'tipo': 'ahorro', 'nombre': 'Ahorro flexible', 'numero': '7310', 'saldo': L.saldo[F], 'fuente': F, 'tasa': 4.75,
                'solo_propias': True}]
    return L.rows, cuentas


# ---------- Esteban: una póliza cada mes ----------
def esteban():
    r = random.Random(57)
    T = 'Cuenta transaccional Pichibank ···2290'
    L = Libro({T: 640.0})
    polizas, n, activas = [], 8801, []
    gastos = [(1, 'Pago por servicio de Unidad Educativa Borja pensión', 'U.E. Borja', 210, 0), (4, 'Pago por servicio de CENTROSUR luz', 'CentroSur', 38, 7),
              (5, 'Pago por servicio de ETAPA agua y teléfono', 'ETAPA', 27, 5), (7, 'Débito automático NETLIFE internet', 'Netlife', 29.99, 0)]
    compras = [('CONSUMO TARJETA DÉBITO SUPERMAXI LAS AMÉRICAS', 'Supermaxi Las Américas', 82, 25), ('CONSUMO TARJETA DÉBITO PETROECUADOR ORDÓÑEZ LASSO', 'Petroecuador Ordóñez Lasso', 35, 8),
               ('CONSUMO TARJETA DÉBITO FARMACIAS CRUZ AZUL', 'Farmacias Cruz Azul', 16, 7), ('CONSUMO TARJETA DÉBITO RESTAURANTE EL MERCADO', 'Restaurante El Mercado', 34, 10),
               ('CONSUMO TARJETA DÉBITO KYWI CUENCA', 'Kywi Cuenca', 28, 12)]
    for d in dias():
        for dia, desc, cp, m, v in gastos:
            if d.day == dia: L.mov(d, hora(r), T, 'Cuenta', desc, cp, -round(m + r.uniform(-v, v), 2))
        for desc, cp, m, v in compras:
            if r.random() < (.16 if 'SUPER' in desc else .08): L.mov(d, hora(r), T, 'Cuenta', desc, cp, -round(max(3, m + r.uniform(-v, v)), 2))
        if d.day in (15, 30) or (d.month == 2 and d.day == 28):
            L.mov(d, '06:30', T, 'Cuenta', 'Pago con transferencia NÓMINA AUSTRO EXPORT CÍA. LTDA.', 'Austro Export Cía. Ltda.', 1350)
        # vencen: vuelve el capital y los intereses; la mitad las renueva ese mismo día con todo
        for p in [p for p in activas if p['vence'] == d]:
            activas.remove(p)
            interes = round(p['capital'] * .065 * 180 / 365, 2)
            L.mov(d, '07:05', T, 'Cuenta', 'Vencimiento de póliza a plazo fijo ···%d: capital' % p['n'], 'Pichibank Inversiones', p['capital'])
            L.mov(d, '07:05', T, 'Cuenta', 'Intereses de póliza a plazo fijo ···%d' % p['n'], 'Pichibank Inversiones', interes)
            if p['n'] % 2:
                n += 1; c = round(p['capital'] + interes, 2)
                L.mov(d, '07:40', T, 'Cuenta', 'Renovación de póliza a plazo fijo 180 días ···%d' % n, 'Pichibank Inversiones', -c)
                q = {'n': n, 'capital': c, 'desde': d, 'vence': d + dt.timedelta(days=180)}; activas.append(q); polizas.append(q)
        # cada 16 manda a una póliza nueva lo que le sobra (deja $500 para el mes)
        c = int((L.saldo[T] - 500) / 100) * 100
        if d.day == 16 and c >= 500:
            n += 1
            L.mov(d, hora(r, 9, 12), T, 'Cuenta', 'Constitución de póliza a plazo fijo 180 días ···%d' % n, 'Pichibank Inversiones', -c)
            q = {'n': n, 'capital': c, 'desde': d, 'vence': d + dt.timedelta(days=180)}; activas.append(q); polizas.append(q)
        if d == fin_de_mes(d): L.mov(d, '23:58', T, 'Cuenta', 'Interés acreditado en su cuenta', 'Pichibank', max(.01, L.saldo[T] * TASA_TRANS / 12))
    cuentas = [{'tipo': 'transaccional', 'nombre': 'Cuenta transaccional', 'numero': '2290', 'saldo': L.saldo[T], 'fuente': T, 'tasa': .01}]
    cuentas += [{'tipo': 'inversion', 'nombre': 'Póliza a plazo fijo 180 días', 'numero': str(p['n']), 'saldo': p['capital'], 'tasa': 6.5,
                 'desde': p['desde'].isoformat(), 'vence': p['vence'].isoformat()} for p in sorted(activas, key=lambda x: x['vence'])]
    return L.rows, cuentas


# ---------- Segundo: el sueldo sale en efectivo ----------
def segundo():
    r = random.Random(23)
    T = 'Cuenta transaccional Pichibank ···6650'
    L = Libro({T: 12.3})
    for d in dias():
        if d.day == 15:
            L.mov(d, '07:10', T, 'Cuenta', 'Pago con transferencia NÓMINA FLORÍCOLA ROSAS DEL COTOPAXI', 'Florícola Rosas del Cotopaxi', 920)
            # lo saca casi todo: una parte en ventanilla y el resto en el cajero
            v = r.choice([500, 600, 700]); a = int((L.saldo[T] - v - r.uniform(5, 25)) / 10) * 10
            L.mov(d, hora(r, 9, 12), T, 'Cuenta', 'RETIRO VENTANILLA AGENCIA LATACUNGA', 'Pichibank', -v)
            L.mov(d, hora(r, 15, 19), T, 'Cuenta', 'RETIRO ATM Pichibank LATACUNGA CENTRO', 'Pichibank', -a)
        if d.day == 28 and L.saldo[T] > 20 and r.random() < .5:
            L.mov(d, hora(r), T, 'Cuenta', 'RETIRO ATM Pichibank LATACUNGA CENTRO', 'Pichibank', -int((L.saldo[T] - 4) / 10) * 10)
        if d == fin_de_mes(d): L.mov(d, '23:58', T, 'Cuenta', 'Interés acreditado en su cuenta', 'Pichibank', .01)
    cuentas = [{'tipo': 'transaccional', 'nombre': 'Cuenta transaccional', 'numero': '6650', 'saldo': L.saldo[T], 'fuente': T, 'tasa': .01}]
    return L.rows, cuentas


USUARIOS = [
    {'usuario': 'paula', 'nombre': 'Paula Benítez', 'edad': 31, 'ciudad': 'Quito', 'tipo': 'Guarda todo su sueldo en el ahorro flexible',
     'grupo_investigacion': 'Clientes con productos además de la cuenta', 'ingreso_mensual': '$2.000 de sueldo, el último día hábil del mes',
     'hogar': 'Vive sola; arrienda un departamento', 'digitalizacion': 'Alta: lo hace todo desde la app', 'productos_bp': 'Cuenta transaccional, ahorro flexible',
     'fuera_de_bp': 'Ninguno', 'casos': 'Apenas cobra, pasa todo el sueldo a su ahorro flexible (4,75 % al año, pagado cada día); cuando la cuenta principal se queda sin dinero, saca de la flexible a la transaccional (0,01 %)',
     'lo_que_necesita': 'Que su dinero gane lo más posible sin quedarse sin plata para sus pagos'},
    {'usuario': 'esteban', 'nombre': 'Esteban Guerrero', 'edad': 47, 'ciudad': 'Cuenca', 'tipo': 'Invierte cada mes en pólizas',
     'grupo_investigacion': 'Clientes con productos además de la cuenta', 'ingreso_mensual': '$2.700 de sueldo en dos quincenas',
     'hogar': 'Casado, dos hijos en el colegio', 'digitalizacion': 'Media: usa la app para pagos y transferencias', 'productos_bp': 'Cuenta transaccional, pólizas a plazo fijo',
     'fuera_de_bp': 'Ninguno', 'casos': 'Cada mes abre una póliza a 180 días; cuando vence, le vuelven el capital y los intereses y a veces la renueva',
     'lo_que_necesita': 'Saber cuánto tiene invertido, cuánto le pagan y no olvidarse de renovar a tiempo'},
    {'usuario': 'segundo', 'nombre': 'Segundo Chicaiza', 'edad': 58, 'ciudad': 'Latacunga', 'tipo': 'Saca todo su sueldo en efectivo',
     'grupo_investigacion': 'Clientes con digitalización media o básica', 'ingreso_mensual': '$920 de sueldo el 15 de cada mes',
     'hogar': 'Casado, vive con su esposa y una nieta', 'digitalizacion': 'Básica: usa la cuenta solo para cobrar y retirar', 'productos_bp': 'Cuenta transaccional',
     'fuera_de_bp': 'Ninguno', 'casos': 'Cobra su sueldo y el mismo día lo retira casi todo en ventanilla y en el cajero; paga todo en efectivo',
     'lo_que_necesita': 'Ver en qué se va su dinero y andar con menos efectivo encima'}
]
ESCENARIOS = [
    {'escenario': 'Ahorro flexible', 'usuarios': 'Paula', 'banco_ve': 'El sueldo pasa entero a la cuenta flexible y vuelve a la transaccional por partes cuando se acaba',
     'riesgo': 'Si los traspasos cuentan como ingresos o gastos, todo se duplica; el dinero que vuelve a la transaccional deja de ganar intereses',
     'pfm_deberia': 'Contar los traspasos como movimientos entre cuentas propias (desde el flexible solo se envía a tus cuentas), mostrar los intereses que gana cada día y proponer pasar a una póliza lo que nunca toca (gana más y el dinero se queda); si es poco para una póliza, una meta de ahorro (gana lo mismo y no se mezcla con el mes)', 'fase': 'MVP'},
    {'escenario': 'Pólizas', 'usuarios': 'Esteban', 'banco_ve': 'Transferencias para abrir pólizas y, al vencer, el capital y los intereses',
     'riesgo': 'Si la póliza cuenta como gasto, el mes parece malo; si el capital que vuelve cuenta como ingreso, el ingreso se infla',
     'pfm_deberia': 'Contar la póliza como inversión (no gasto), separar los intereses del capital al vencer y avisar antes del vencimiento para renovarla', 'fase': 'MVP'},
    {'escenario': 'Sueldo en efectivo', 'usuarios': 'Segundo', 'banco_ve': 'El sueldo llega y casi todo sale en uno o dos retiros el mismo día',
     'riesgo': 'El PFM no ve en qué se gasta: todo el mes parece un solo retiro, y andar con todo el efectivo es un riesgo',
     'pfm_deberia': 'Mostrar el efectivo como categoría propia sin pedir detalle, proponer pagar con QR o Deuna y registrar los gastos grandes en efectivo', 'fase': 'MVP'},
]


def agenda(numero):
    return {'contactos': [], 'favoritos': ['Transferir dinero', 'Pagar servicios', 'Recargar celular'], 'exterior': [],
            'deuna': {'mi_numero': numero, 'contactos': []}, 'recargas': [{'nombre': 'Mi celular', 'numero': numero, 'operadora': 'Claro', 'monto_tipico': 5}],
            'domiciliados': [], 'recurrentes': []}


def main():
    d = json.load(open(RUTA, encoding='utf-8'))
    D = d['dic']
    # quitar lo que se haya agregado antes
    d['usuarios'] = [u for u in d['usuarios'] if u['usuario'] not in NUEVOS]
    d['escenarios'] = [e for e in d['escenarios'] if e['escenario'] not in [x['escenario'] for x in ESCENARIOS]]
    for k in ('movimientos', 'cuentas', 'agenda'):
        for u in NUEVOS: d[k].pop(u, None)
    idx = lambda tabla, v: D[tabla].index(v) if v in D[tabla] else (D[tabla].append(v) or len(D[tabla]) - 1)
    for u, (rows, cuentas) in zip(NUEVOS, (paula(), esteban(), segundo())):
        rows.sort(key=lambda x: (x[0], x[1]))
        # [fecha, hora, fuente, producto, descripción, contraparte, monto, tratamiento, categoría, escenario, nota, saldo]
        # sin etiquetas: tratamiento, categoría, escenario y nota los deduce el front
        d['movimientos'][u] = [[f, h, idx('fuente', s), idx('producto', p), idx('descripcion', de), idx('contraparte', cp), m, None, None, None, None, sal]
                               for f, h, s, p, de, cp, m, sal in rows]
        d['cuentas'][u] = cuentas
        print(u, len(rows), 'movimientos', [(c['nombre'], c['saldo']) for c in cuentas][:4])
    # Regla del Ahorro flexible: solo envía dinero a tus propias cuentas, nunca a terceros
    for cs in d['cuentas'].values():
        for c in cs:
            if 'flexible' in c.get('nombre', '').lower(): c['solo_propias'] = True
    d['usuarios'] += USUARIOS
    d['escenarios'] += ESCENARIOS
    d['agenda']['paula'] = agenda('0987310412'); d['agenda']['esteban'] = agenda('0994552290'); d['agenda']['segundo'] = agenda('0976650318')
    open(RUTA, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))  # el mismo formato del archivo


if __name__ == '__main__':
    main()
