# Genera la sección "agenda" de assets/pfm/datos.json: por persona, sus contactos
# (con favoritos y celular Deuna), beneficiarios en el exterior, números para
# recargar, servicios domiciliados (débito automático), pagos recurrentes y
# acciones favoritas. Sale de sus movimientos; los datos fijos (cuentas, celulares,
# SWIFT) son ficticios y deterministas (hash del nombre) para que no cambien.
import json, re, collections, hashlib, statistics
RUTA = 'assets/pfm/datos.json'
d = json.load(open(RUTA, encoding='utf-8'))
D = d['dic']

def h(s, n=8):
    return int(hashlib.md5(s.encode()).hexdigest(), 16) % (10 ** n)
def cel(s): return '09' + str(10000000 + h(s + 'c') % 90000000)
def cta(s): return str(2200000000 + h(s + 'a', 9))
EMPRESA = re.compile(r'c[ií]a|s\.a|s\.a\.s|ltda|cooperativa|universidad|unidad educativa|distribuidora|hnos|banco|municipio|cuota|matr[ií]cula|pensi[oó]n|cr[eé]dito|intermex|western', re.I)
ENVIO = [(re.compile(r'^Transf\. Directa a (.+)$'), 'Pichibank'), (re.compile(r'^Transf\. Interbancaria a (.+)$'), 'Otro banco'), (re.compile(r'^Pago a persona (.+)$'), 'Deuna')]
RECIBO = [(re.compile(r'^Transf\. Directa de (.+)$'), 'Pichibank'), (re.compile(r'^Transferencia recibida de (.+)$'), 'Pichibank'), (re.compile(r'^Transf\. Interbancaria de (.+)$'), 'Otro banco'),
          (re.compile(r'^Transf\. Deuna de .+? \((.+)\)$'), 'Deuna'), (re.compile(r'^Transferencia internacional recibida .*?[-–] (.+)$'), 'Exterior'), (re.compile(r'^Transferencia internacional recibida desde (.+?) - (.+)$'), 'Exterior')]
SERV = [re.compile(r'^Pago por servicio de (.+)$'), re.compile(r'^D[eé]bito autom[aá]tico (?!hacia)(.+)$'), re.compile(r'^((?:CLARO|MOVISTAR|CNT) PLAN .+)$')]
# Contactos fijos para quienes casi no transfieren (así la agenda tiene con quién probar)
EXTRA = {'rosa': ['Mercedes Quizhpi Loja', 'Carmen Guamán Pintado', 'Luis Pintado Sari'], 'jorge': ['Santiago Salazar Andrade', 'Marlene Andrade Coello', 'Mateo Salazar Andrade'], 'luis': ['Carmen Cedeño Mora', 'Jefferson Quiñónez Bone'], 'daniela': ['Sofía Aragundi Vera']}
OTROS_BANCOS = ['Banco Guayaquil', 'Produbanco', 'Banco del Pacífico', 'Banco Bolivariano', 'Cooperativa JEP']
PAIS = {'EE. UU.': ('Estados Unidos', 'USD', 'Bank of America', 'BOFAUS3N'), 'España': ('España', 'EUR', 'Banco Santander', 'BSCHESMM')}

agenda = {}
for u in d['usuarios']:
    k = u['usuario']; mov = d['movimientos'].get(k, []); yo = u['nombre'].split(' ')[0].lower()
    C = {}; S = {}; recargas = collections.Counter(); exterior = {}
    for r in mov:
        desc = D['descripcion'][r[4]]; monto = abs(r[6]); fecha = r[0]
        m = None; modo = None; banco = None
        for rx, b in ENVIO:
            x = rx.match(desc)
            if x: m, modo, banco = x.group(x.lastindex), 'envio', b; break
        if not m:
            for rx, b in RECIBO:
                x = rx.match(desc)
                if x: m, modo, banco = x.group(x.lastindex), 'recibo', b; break
        if m and not EMPRESA.search(m) and not m.lower().startswith(yo):
            n = re.sub(r'\s*\(.*\)$', '', m).strip()
            if banco == 'Exterior':
                pais = re.search(r'\((.+?)\)', m)
                pais = pais.group(1) if pais else ('España' if 'España' in desc else 'EE. UU.')
                e = exterior.setdefault(n, {'nombre': n, 'pais': pais, 'veces': 0, 'montos': [], 'ultimo': ''})
                e['veces'] += 1; e['montos'].append(monto); e['ultimo'] = max(e['ultimo'], fecha)
                continue
            c = C.setdefault(n, {'nombre': n, 'veces': 0, 'enviados': 0, 'montos': [], 'ultimo': '', 'bancos': set(), 'deuna': False})
            c['veces'] += 1; c['ultimo'] = max(c['ultimo'], fecha); c['bancos'].add(banco)
            if modo == 'envio': c['enviados'] += 1; c['montos'].append(monto)
            if banco == 'Deuna': c['deuna'] = True
        for rx in SERV:
            x = rx.match(desc)
            if x:
                e = re.sub(r'\s+(pensi[oó]n|matr[ií]cula|tarjeta.*|cr[eé]dito.*|impuesto predial|recarga prepago)$', '', x.group(1), flags=re.I).strip()
                s = S.setdefault(e, {'empresa': e, 'veces': 0, 'montos': [], 'dias': [], 'auto': False, 'ultimo': ''})
                s['veces'] += 1; s['montos'].append(monto); s['dias'].append(int(fecha[8:10])); s['ultimo'] = max(s['ultimo'], fecha)
                if desc.lower().startswith('débito automático') or desc.lower().startswith('debito automático'): s['auto'] = True
                break
        if re.search(r'recarga', desc, re.I) and 'Recarga de saldo' not in desc: recargas[monto] += 1
    for n in EXTRA.get(k, []):
        if n not in C: C[n] = {'nombre': n, 'veces': 0, 'enviados': 0, 'montos': [], 'ultimo': '', 'bancos': {'Pichibank'}, 'deuna': True}
    contactos = []
    for n, c in sorted(C.items(), key=lambda x: -x[1]['veces']):
        banco = 'Pichibank' if 'Pichibank' in c['bancos'] or 'Deuna' in c['bancos'] else OTROS_BANCOS[h(n) % len(OTROS_BANCOS)]
        contactos.append({'nombre': n, 'alias': n.split(' ')[0], 'banco': banco, 'cuenta': cta(n), 'tipo_cuenta': 'Ahorros' if h(n) % 3 else 'Corriente', 'cedula': str(1700000000 + h(n + 'i', 9)),
                          'celular': cel(n) if (c['deuna'] or banco == 'Pichibank') else '', 'deuna': c['deuna'] or banco == 'Pichibank',
                          'favorito': c['enviados'] >= 3, 'veces': c['veces'], 'ultimo': c['ultimo'], 'monto_tipico': round(statistics.median(c['montos']), 2) if c['montos'] else 0})
    ext = []
    for n, e in sorted(exterior.items(), key=lambda x: -x[1]['veces']):
        p, mon, bco, swift = PAIS.get(e['pais'], (e['pais'], 'USD', 'Banco local', 'XXXXXXXX'))
        ext.append({'nombre': n, 'pais': p, 'moneda': mon, 'banco': bco, 'swift': swift, 'cuenta': ('ES' if p == 'España' else 'US') + str(10 ** 15 + h(n + 'x', 16)), 'relacion': 'familiar', 'recibe_de': True, 'veces': e['veces'], 'ultimo': e['ultimo'], 'monto_tipico': round(statistics.median(e['montos']), 2)})
    domiciliados = []; recurrentes = []
    for e, s in sorted(S.items(), key=lambda x: -x[1]['veces']):
        if s['veces'] < 3: continue
        item = {'empresa': e, 'contrato': str(100000 + h(e + k, 6)), 'monto_tipico': round(statistics.median(s['montos']), 2), 'dia': int(statistics.median(s['dias'])), 'veces': s['veces'], 'ultimo': s['ultimo']}
        if s['auto']: domiciliados.append(dict(item, cuenta='transaccional', tope=round(max(s['montos']) * 1.5, 2), aviso_previo=True))
        else: recurrentes.append(dict(item, frecuencia='mensual', recordatorio=True))
    # Quien paga lo mismo cada mes y no tiene nada domiciliado: el más frecuente queda con débito automático
    if mov and not domiciliados and recurrentes:
        r0 = recurrentes.pop(0); domiciliados.append(dict(r0, cuenta='transaccional', tope=round(r0['monto_tipico'] * 1.5, 2), aviso_previo=True))
    deuna = {'mi_numero': cel(u['nombre']), 'contactos': [{'nombre': c['nombre'], 'celular': c['celular']} for c in contactos if c['deuna']][:8]}
    rec = [{'nombre': 'Mi celular', 'numero': cel(u['nombre']), 'operadora': 'Claro', 'monto_tipico': recargas.most_common(1)[0][0] if recargas else 5}]
    for c in contactos:
        if c['celular'] and c['favorito'] and len(rec) < 3: rec.append({'nombre': c['alias'], 'numero': c['celular'], 'operadora': ['Claro', 'Movistar', 'CNT'][h(c['nombre']) % 3], 'monto_tipico': 5})
    favs = ['Transferir dinero', 'Pagar servicios']
    if any(x['usuario'] == k and x['clase'] == 'tarjeta' and str(x['en_mvp']).startswith('S') for x in d['deudas']): favs.append('Pagar tarjeta')
    if recargas: favs.append('Recargar celular')
    if k == 'rosa': favs.append('Cobrar con QR')
    if not mov: favs = ['Recibir dinero', 'Pagar con QR', 'Transferir dinero']
    agenda[k] = {'contactos': contactos, 'favoritos': favs, 'exterior': ext, 'deuna': deuna, 'recargas': rec if mov else [rec[0]], 'domiciliados': domiciliados, 'recurrentes': recurrentes}

d['agenda'] = agenda
json.dump(d, open(RUTA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, a in agenda.items():
    print(k, 'contactos', len(a['contactos']), 'fav', sum(c['favorito'] for c in a['contactos']), 'exterior', [(e['nombre'], e['pais']) for e in a['exterior']], 'deuna', len(a['deuna']['contactos']), 'domiciliados', [x['empresa'] for x in a['domiciliados']], 'recurrentes', [x['empresa'] for x in a['recurrentes']], 'favoritos', a['favoritos'])
