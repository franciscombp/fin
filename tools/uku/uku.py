"""Genera assets/oso/uku.glb: Uku, el oso de anteojos, modelado por código.

    python3 tools/uku/uku.py

- El cuerpo es una sola malla suave (unión suave de partes: cabeza, orejas, hocico, cuello, torso,
  brazos y patas) con los colores pintados en los vértices: pelaje gris, el antifaz crema del oso de
  anteojos, cachetes rosados, orejas por dentro y plantas de las patas.
- El suéter y la bufanda son capas aparte; el suéter usa los mismos pesos que el cuerpo que cubre,
  así se dobla con él y no se deforma raro. La bufanda va firme al cuello y su punta tiene su propio
  hueso (se mece).
- Ojos, ojos contentos, nariz, boca (cerrada y abierta) y lentes son piezas rígidas hijas del hueso
  de la cabeza: la app los escala para pestañear, sonreír o hablar.
- Esqueleto con nombres de Mixamo (mixamorig:Hips, ...:RightHand, ...:Head) en pose de reposo con los
  brazos abajo; sin animaciones: uku-rig.js las hace por código.
Unidad = 1 m; Uku mide 1 (la app lo escala)."""
import json, struct, os
import numpy as np
from sdf import sphere, ellipsoid, capsule, torus, union, smin
from malla import mesh, keep_largest

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'oso', 'uku.glb')
CELL = .0095

# ---------- Esqueleto (posiciones en reposo) ----------
B = []  # (nombre, padre, posición)


def bone(n, p, pos):
    B.append(('mixamorig:' + n, None if p is None else 'mixamorig:' + p, np.array(pos, float)))


bone('Hips', None, (0, .27, 0))
bone('Spine', 'Hips', (0, .35, 0))
bone('Spine1', 'Spine', (0, .43, 0))
bone('Spine2', 'Spine1', (0, .5, 0))
bone('Neck', 'Spine2', (0, .57, 0))
bone('Head', 'Neck', (0, .64, 0))
bone('HeadTop_End', 'Head', (0, .99, 0))
for s, S in ((1, 'Left'), (-1, 'Right')):
    bone(S + 'Shoulder', 'Spine2', (s * .06, .525, 0))
    bone(S + 'Arm', S + 'Shoulder', (s * .155, .51, 0))
    bone(S + 'ForeArm', S + 'Arm', (s * .265, .405, .015))
    bone(S + 'Hand', S + 'ForeArm', (s * .325, .305, .04))
    bone(S + 'HandIndex1', S + 'Hand', (s * .345, .25, .055))
    bone(S + 'UpLeg', 'Hips', (s * .085, .235, 0))
    bone(S + 'Leg', S + 'UpLeg', (s * .095, .135, .01))
    bone(S + 'Foot', S + 'Leg', (s * .1, .06, .01))
    bone(S + 'ToeBase', S + 'Foot', (s * .1, .02, .11))
bone('ScarfTail', 'Spine2', (-.07, .56, .125))
bone('ScarfEnd', 'ScarfTail', (-.088, .405, .168))
BI = {b[0]: i for i, b in enumerate(B)}
POS = {b[0]: b[2] for b in B}
P_ = lambda n: POS['mixamorig:' + n]

# ---------- Cuerpo: cada parte con su hueso ----------
PARTS = [
    ('Head', ellipsoid((0, .775, 0), (.215, .195, .19))),
    ('Head', ellipsoid((.09, .72, .065), (.1, .08, .095))),
    ('Head', ellipsoid((-.09, .72, .065), (.1, .08, .095))),
    ('Head', ellipsoid((0, .712, .155), (.096, .07, .078))),          # hocico
    ('Head', ellipsoid((.158, .93, -.03), (.07, .068, .042))),        # orejas
    ('Head', ellipsoid((-.158, .93, -.03), (.07, .068, .042))),
    ('Neck', capsule((0, .55, 0), (0, .68, 0), .12)),
    ('Spine2', ellipsoid((0, .475, -.005), (.158, .11, .132))),
    ('Spine1', ellipsoid((0, .41, .005), (.178, .1, .15))),
    ('Spine', ellipsoid((0, .345, .012), (.19, .11, .163))),
    ('Hips', ellipsoid((0, .265, .0), (.172, .095, .145))),
]
for s, S in ((1, 'Left'), (-1, 'Right')):
    PARTS += [
        (S + 'Arm', capsule((s * .14, .5, 0), P_(S + 'ForeArm'), .058, .051)),
        (S + 'ForeArm', capsule(P_(S + 'ForeArm'), P_(S + 'Hand'), .05, .047)),
        (S + 'Hand', ellipsoid((s * .334, .268, .048), (.054, .06, .052))),
        (S + 'UpLeg', capsule(P_(S + 'UpLeg'), P_(S + 'Leg'), .082, .073)),
        (S + 'Leg', capsule(P_(S + 'Leg'), P_(S + 'Foot'), .073, .068)),
        (S + 'Foot', ellipsoid((s * .1, .038, .045), (.073, .052, .102))),
    ]
K = .032
_body = union([f for _, f in PARTS], K)
body_sdf = lambda P: np.maximum(_body(P), -P[:, 1])  # plantas planas: se para en el suelo


def weights(V, parts, sigma=.011):
    # Pesos por parte: cada vértice pesa más en el hueso de la parte sobre (o cerca de) la que está
    W = np.zeros((len(V), len(B)))
    for n, f in parts:
        d = np.maximum(f(V), 0)
        W[:, BI['mixamorig:' + n]] = np.maximum(W[:, BI['mixamorig:' + n]], np.exp(-d / sigma))
    return top4(W)


def top4(W):
    J = np.argsort(-W, axis=1)[:, :4]
    w = np.take_along_axis(W, J, 1)
    w[w < .02] = 0
    w /= np.maximum(w.sum(1, keepdims=True), 1e-9)
    return J.astype(np.uint8), w.astype(np.float32)


def srgb(h):
    c = np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    return a * (1 - t[:, None]) + b * t[:, None]


# ---------- Superficie de la cara: dónde van ojos, nariz y boca ----------
def on_face(x, y, z0=.4):
    # Punto de la superficie del cuerpo de frente (+z) en (x, y), y su normal
    lo, hi = 0., z0
    a = np.array([[x, y, lo]]); b = np.array([[x, y, hi]])
    for _ in range(50):
        m = (a + b) / 2
        if body_sdf(m)[0] < 0: a = m
        else: b = m
    p = (a + b)[0] / 2
    e = 1e-3
    g = np.array([(body_sdf(p[None] + d) - body_sdf(p[None] - d))[0] for d in np.eye(3) * e])
    return p, g / np.linalg.norm(g)


EYE = [on_face(s * .074, .795) for s in (1, -1)]
NOSE = on_face(0, .738)
MOUTH = on_face(0, .668)


def paint_body(V, N):
    fur, dark, cream, blush, inner, sole = (srgb(h) for h in ('#8b93a1', '#77808f', '#dcdce4', '#f2a6ae', '#cfd3dc', '#5d6474'))
    y = V[:, 1]
    C = mix(np.tile(srgb('#7f8796'), (len(V), 1)), np.tile(fur, (len(V), 1)), ss(.05, .55, y))
    C = mix(C, np.tile(srgb('#99a1ae'), (len(V), 1)), ss(.8, 1.0, y) * .8)      # la coronilla, un poco más clara
    front = ss(.15, .45, N[:, 2])
    # Antifaz del oso de anteojos: anillos alrededor de los ojos que bajan al hocico
    mask = np.zeros(len(V))
    for (p, _) in EYE:
        d = np.hypot(V[:, 0] - p[0], (V[:, 1] - p[1]) * 1.05)
        mask = np.maximum(mask, 1 - ss(.052, .062, d))
    mask = np.maximum(mask, 1 - ss(.0, .012, ellipsoid((0, .71, .158), (.104, .078, .082))(V)))
    # franja que une los anillos con el hocico
    band = (1 - ss(.028, .038, np.abs(np.abs(V[:, 0]) - .062))) * ss(.69, .72, y) * (1 - ss(.77, .8, y))
    mask = np.maximum(mask, band)
    mask *= front * (y > .62)
    C = mix(C, np.tile(cream, (len(V), 1)), mask)
    # Cachetes rosados
    for s in (1, -1):
        d = np.hypot(V[:, 0] - s * .128, V[:, 1] - .712)
        C = mix(C, np.tile(blush, (len(V), 1)), (1 - ss(.018, .036, d)) * front * .85)
    # Orejas por dentro
    for s in (1, -1):
        e = ellipsoid((s * .158, .93, -.005), (.045, .045, .03))(V)
        C = mix(C, np.tile(inner, (len(V), 1)), (1 - ss(-.004, .008, e)) * ss(.0, .3, N[:, 2]))
    # Plantas de las patas
    C = mix(C, np.tile(sole, (len(V), 1)), 1 - ss(.006, .016, y))
    return C.astype(np.float32)


# ---------- Suéter ----------
def sweater_sdf():
    torso = union([f for n, f in PARTS if n in ('Spine2', 'Spine1', 'Spine', 'Hips', 'Neck')] +
                  [f for n, f in PARTS if n.endswith('Arm') and 'Fore' not in n] +
                  [f for n, f in PARTS if n.endswith('ForeArm')], .014)  # unión justa: las mangas no se pegan al torso
    cuffs = []
    for s, S in ((1, 'Left'), (-1, 'Right')):
        a, b = P_(S + 'ForeArm'), P_(S + 'Hand')
        d = (b - a) / np.linalg.norm(b - a)
        cuffs.append((a + (b - a) * .5, d))

    def f(P):
        d = torso(P) - .014
        d = np.maximum(d, .205 - P[:, 1])                 # el ruedo
        d = np.maximum(d, P[:, 1] - .592 + .06 * np.maximum(P[:, 2], 0))   # el cuello, un poco más bajo adelante
        for c, n in cuffs:
            d = np.maximum(d, (P - c) @ n)               # los puños
        return d
    return f, cuffs


def paint_sweater(V, cuffs):
    yel, rib, zig = srgb('#fdd02c'), srgb('#eab914'), srgb('#bdbcb4')
    y = V[:, 1]
    th = np.arctan2(V[:, 0], V[:, 2])
    C = np.tile(yel, (len(V), 1))
    ribs = .5 + .5 * np.cos(th * 46)
    hem = 1 - ss(.232, .24, y)
    neck = ss(.555, .565, y - .06 * np.maximum(V[:, 2], 0))
    cuff = np.zeros(len(V))
    for c, n in cuffs:
        cuff = np.maximum(cuff, ss(-.028, -.022, (V - c) @ n))
    band = np.maximum(np.maximum(hem, neck), cuff)
    C = mix(C, mix(np.tile(rib, (len(V), 1)), np.tile(yel, (len(V), 1)), ribs * .5), band)
    # Dos zigzags grises en el pecho y la barriga, como el suéter de siempre
    tri = np.abs(((th * 9 / np.pi) % 2) - 1)
    torso = (np.abs(V[:, 0]) < .2) * (1 - band)
    for y0 in (.445, .34):
        line = 1 - ss(.006, .011, np.abs(y - (y0 + (tri - .5) * .045)))
        C = mix(C, np.tile(zig, (len(V), 1)), line * torso)
    return C.astype(np.float32)


# ---------- Bufanda ----------
SC_RING = torus((0, .588, .006), .124, .043, axis=(0, 1, .14))
SC_TAIL = capsule((-.07, .57, .122), P_('ScarfEnd'), .037, .033)


def scarf_parts():
    return [('Neck', SC_RING), ('ScarfTail', SC_TAIL)]


def scarf_weights(V):
    W = np.zeros((len(V), len(B)))
    ring = SC_RING(V) < SC_TAIL(V) + .004
    W[ring, BI['mixamorig:Neck']] = .55
    W[ring, BI['mixamorig:Spine2']] = .45
    a, b = np.array([-.07, .57, .122]), P_('ScarfEnd')
    t = np.clip(((V - a) @ (b - a)) / ((b - a) @ (b - a)), 0, 1)
    k = ss(.0, .5, t)
    W[~ring, BI['mixamorig:Spine2']] = (1 - k)[~ring]
    W[~ring, BI['mixamorig:ScarfTail']] = k[~ring]
    return top4(W)


def paint_scarf(V):
    navy, light = srgb('#1b2a4e'), srgb('#2c4f9e')
    a, b = np.array([-.07, .57, .122]), P_('ScarfEnd')
    t = np.clip(((V - a) @ (b - a)) / ((b - a) @ (b - a)), 0, 1)
    tail = SC_TAIL(V) < SC_RING(V)
    stripe = np.zeros(len(V))
    for t0 in (.72, .84):
        stripe = np.maximum(stripe, 1 - ss(.025, .04, np.abs(t - t0)))
    C = mix(np.tile(navy, (len(V), 1)), np.tile(light, (len(V), 1)), stripe * tail)
    return C.astype(np.float32)


# ---------- Piezas rígidas (paramétricas) ----------
def frame(n, up=(0, 1, 0)):
    z = n / np.linalg.norm(n)
    x = np.cross(up, z); x /= np.linalg.norm(x)
    return np.stack([x, np.cross(z, x), z], 1)  # columnas: x, y, z


def ellipsoid_mesh(c, r, R=np.eye(3), seg=18, rings=12):
    u, v = np.meshgrid(np.linspace(0, 2 * np.pi, seg + 1), np.linspace(0, np.pi, rings + 1))
    p = np.stack([np.sin(v) * np.cos(u), np.cos(v), np.sin(v) * np.sin(u)], -1).reshape(-1, 3)
    n = p / np.asarray(r); n /= np.linalg.norm(n, axis=1, keepdims=True)
    V = (p * r) @ R.T + c
    N = n @ R.T
    T = []
    for i in range(rings):
        for j in range(seg):
            a = i * (seg + 1) + j; b = a + seg + 1
            T += [[a, a + 1, b], [a + 1, b + 1, b]]
    return V, N, np.array(T)


def torus_mesh(c, R0, r, R=np.eye(3), arc=(0, 2 * np.pi), seg=40, sides=10):
    u, v = np.meshgrid(np.linspace(arc[0], arc[1], seg + 1), np.linspace(0, 2 * np.pi, sides + 1), indexing='ij')
    cen = np.stack([np.cos(u) * R0, np.sin(u) * R0, 0 * u], -1)
    nrm = np.stack([np.cos(u) * np.cos(v), np.sin(u) * np.cos(v), np.sin(v)], -1)
    V = (cen + nrm * r).reshape(-1, 3) @ R.T + c
    N = nrm.reshape(-1, 3) @ R.T
    T = []
    for i in range(seg):
        for j in range(sides):
            a = i * (sides + 1) + j; b = a + sides + 1
            T += [[a, b, a + 1], [a + 1, b, b + 1]]
    return V, N, np.array(T)


def capsule_mesh(a, b, r, seg=10):
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = b - a; L = np.linalg.norm(d)
    R = frame(d / L, up=(0, 0, 1) if abs(d[1]) > .9 * L else (0, 1, 0))
    V, N, T = ellipsoid_mesh(np.zeros(3), (r, r, L / 2 + r), seg=seg, rings=8)
    return V @ R.T + (a + b) / 2, N @ R.T, T


def merge(parts):
    Vs, Ns, Ts, o = [], [], [], 0
    for V, N, T in parts:
        Vs.append(V); Ns.append(N); Ts.append(T + o); o += len(V)
    return np.concatenate(Vs).astype(np.float32), np.concatenate(Ns).astype(np.float32), np.concatenate(Ts).astype(np.uint32)


def face_parts():
    out = {}
    for (p, n), side in zip(EYE, ('L', 'R')):
        R = frame(n)
        V, N, T = merge([ellipsoid_mesh(p - n * .004, (.02, .027, .011), R),
                         ellipsoid_mesh(p + R @ np.array([.006, .009, .007]), (.0055, .0065, .003), R, seg=10, rings=6)])
        C = np.tile(srgb('#0f1c38'), (len(V), 1)); C[-11 * 7:] = srgb('#ffffff')
        out['ojo_' + side] = (V, N, T, C, p)
        # Ojos contentos: un arco ^ sobre el ojo
        V, N, T = torus_mesh(np.zeros(3), .02, .0045, arc=(.35, np.pi - .35), seg=16, sides=8)
        V = V @ R.T + p + n * .002 - R[:, 1] * .006; N = N @ R.T
        out['ojo_feliz_' + side] = (V, N, T, np.tile(srgb('#0f1c38'), (len(V), 1)), p)
    p, n = NOSE
    V, N, T = ellipsoid_mesh(p + n * .006, (.036, .025, .022), frame(n))
    C = np.tile(srgb('#1f2a43'), (len(V), 1)); C[V[:, 1] > p[1] + .012] = srgb('#3a4761')
    out['nariz'] = (V, N, T, C, p)
    p, n = MOUTH
    R = frame(n)
    V, N, T = torus_mesh(np.zeros(3), .028, .0048, arc=(np.pi + .55, 2 * np.pi - .55), seg=18, sides=8)
    out['boca'] = (V @ R.T + p + n * .003 + R[:, 1] * .02, N @ R.T, T, np.tile(srgb('#1f2a43'), (len(V), 1)), p)
    V, N, T = ellipsoid_mesh(np.zeros(3), (.02, .015, .006), seg=14, rings=8)
    C = np.tile(srgb('#3b1f2b'), (len(V), 1)); C[V[:, 1] < -.007] = srgb('#e4808f')   # la lengüita
    out['boca_abierta'] = (V @ R.T + p + n * .002, N @ R.T, T, C, p)
    # Lentes amarillos: dos aros, el puente y las patas hasta las orejas
    rings = []
    for (p, n) in EYE:
        R = frame(n)
        rings.append(torus_mesh(p + n * .013, .046, .0065, R))
    (pl, nl), (pr, nr) = EYE
    rings.append(capsule_mesh(pl + nl * .013 + np.array([-.046, .004, 0]), pr + nr * .013 + np.array([.046, .004, 0]), .0055))
    for (p, n), s in zip(EYE, (1, -1)):
        a = p + n * .013 + np.array([s * .046, .006, 0])
        rings.append(capsule_mesh(a, np.array([s * .19, .815, -.02]), .005))
    V, N, T = merge(rings)
    out['lentes'] = (V, N, T, np.tile(srgb('#f5c51c'), (len(V), 1)), POS['mixamorig:Head'])
    return out


# ---------- GLB ----------
# Colores en bytes: COLOR_0 en bytes normalizados es lineal, así que se guarda el valor lineal (sin pérdida visible
# en estos tonos); los pesos en bytes que suman exactamente 255
def lin2srgb_u8(C): return np.clip(C, 0, 1)
def u8(a): return np.round(np.clip(a, 0, 1) * 255).astype(np.uint8)
def u8w(W):
    q = np.floor(W * 255).astype(int)
    q[np.arange(len(q)), W.argmax(1)] += 255 - q.sum(1)
    return q.astype(np.uint8)

class GLB:
    def __init__(self):
        self.j = {'asset': {'version': '2.0', 'generator': 'tools/uku/uku.py'}, 'scene': 0, 'scenes': [{'nodes': []}],
                  'nodes': [], 'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': [], 'buffers': [{}], 'skins': []}
        self.bin = bytearray()

    def acc(self, a, kind, comp, target=None, minmax=False, normalized=False):
        a = np.ascontiguousarray(a)
        while len(self.bin) % 4: self.bin += b'\0'
        bv = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': a.nbytes}
        if target: bv['target'] = target
        self.bin += a.tobytes()
        self.j['bufferViews'].append(bv)
        ac = {'bufferView': len(self.j['bufferViews']) - 1, 'componentType': comp, 'count': len(a), 'type': kind}
        if minmax: ac['min'] = a.min(0).tolist(); ac['max'] = a.max(0).tolist()
        if normalized: ac['normalized'] = True
        self.j['accessors'].append(ac)
        return len(self.j['accessors']) - 1

    def mesh(self, name, V, N, T, C, J=None, W=None):
        attr = {'POSITION': self.acc(V.astype(np.float32), 'VEC3', 5126, 34962, True),
                'NORMAL': self.acc(N.astype(np.float32), 'VEC3', 5126, 34962),
                'COLOR_0': self.acc(u8(np.c_[lin2srgb_u8(C), np.ones(len(C))]), 'VEC4', 5121, 34962, normalized=True)}
        if J is not None:
            attr['JOINTS_0'] = self.acc(J.astype(np.uint8), 'VEC4', 5121, 34962)
            attr['WEIGHTS_0'] = self.acc(u8w(W), 'VEC4', 5121, 34962, normalized=True)
        self.j['materials'].append({'name': name, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 1}})
        I = T.ravel()
        idx = self.acc(I.astype(np.uint16), 'SCALAR', 5123, 34963) if len(V) < 65536 else self.acc(I.astype(np.uint32), 'SCALAR', 5125, 34963)
        self.j['meshes'].append({'name': name, 'primitives': [{'attributes': attr, 'indices': idx, 'material': len(self.j['materials']) - 1}]})
        return len(self.j['meshes']) - 1

    def save(self, path):
        while len(self.bin) % 4: self.bin += b'\0'
        self.j['buffers'][0]['byteLength'] = len(self.bin)
        js = json.dumps(self.j, separators=(',', ':')).encode()
        while len(js) % 4: js += b' '
        out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(self.bin))
        out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin)
        open(path, 'wb').write(out)


def build():
    g = GLB()
    # Huesos
    for name, parent, pos in B:
        t = pos - (POS[parent] if parent else 0)
        g.j['nodes'].append({'name': name, 'translation': [float(v) for v in t]})
    for i, (name, parent, _) in enumerate(B):
        if parent: g.j['nodes'][BI[parent]].setdefault('children', []).append(i)
    root = BI['mixamorig:Hips']
    ibm = np.stack([np.array([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [-p[0], -p[1], -p[2], 1]], np.float32) for _, _, p in B])
    g.j['skins'].append({'name': 'Armature', 'joints': list(range(len(B))), 'skeleton': root, 'inverseBindMatrices': g.acc(ibm.reshape(-1, 16), 'MAT4', 5126)})
    arm = len(g.j['nodes']); g.j['nodes'].append({'name': 'Armature', 'children': [root]})
    top = [arm]
    # Cuerpo
    V, N, T = keep_largest(*mesh(body_sdf, (-.43, -.01, -.26), (.43, 1.04, .3), CELL))
    J, W = weights(V, PARTS)
    print('cuerpo', len(V), 'vértices', len(T), 'triángulos')
    m = g.mesh('uku', V, N, T, paint_body(V, N), J, W)
    top.append(len(g.j['nodes'])); g.j['nodes'].append({'name': 'uku', 'mesh': m, 'skin': 0})
    # Suéter: los pesos del cuerpo que cubre
    sf, cuffs = sweater_sdf()
    V, N, T = keep_largest(*mesh(sf, (-.43, .17, -.22), (.43, .62, .24), CELL))
    J, W = weights(V, [(n, f) for n, f in PARTS if n not in ('Head',)])
    print('suéter', len(V), 'vértices')
    m = g.mesh('ropa', V, N, T, paint_sweater(V, cuffs), J, W)
    top.append(len(g.j['nodes'])); g.j['nodes'].append({'name': 'ropa', 'mesh': m, 'skin': 0})
    # Bufanda
    sc = union([SC_RING, SC_TAIL], .012)
    V, N, T = keep_largest(*mesh(sc, (-.19, .36, -.15), (.19, .66, .23), CELL * .8))
    J, W = scarf_weights(V)
    print('bufanda', len(V), 'vértices')
    m = g.mesh('bufanda', V, N, T, paint_scarf(V), J, W)
    top.append(len(g.j['nodes'])); g.j['nodes'].append({'name': 'bufanda', 'mesh': m, 'skin': 0})
    # Cara: piezas hijas de la cabeza, con su origen en su centro (para escalarlas en su lugar)
    head = BI['mixamorig:Head']
    for name, (V, N, T, C, c) in face_parts().items():
        c = np.asarray(c, float)
        m = g.mesh(name, V - c, N, T, C)
        node = {'name': name, 'mesh': m, 'translation': [float(v) for v in c - POS['mixamorig:Head']]}
        if name.startswith('ojo_feliz') or name == 'boca_abierta': node['scale'] = [1e-3] * 3
        g.j['nodes'][head].setdefault('children', []).append(len(g.j['nodes'])); g.j['nodes'].append(node)
    g.j['scenes'][0]['nodes'] = top
    g.save(OUT)
    print('listo:', os.path.normpath(OUT), os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    build()
