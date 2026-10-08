"""Auto-rig del oso andino (Meshy, pose T, Y arriba, mira a +Z).
Crea un esqueleto humanoide simple, pesos de piel por distancia a cada
hueso limitados por zonas del cuerpo, y reempaqueta un GLB liviano
(textura base 1024 px; sin mapas de metal/rugosidad ni normales)."""
import struct, json, io, numpy as np
from PIL import Image

src = open('oso.glb', 'rb').read()
jl = struct.unpack('<I', src[12:16])[0]; J = json.loads(src[20:20 + jl]); B0 = 20 + jl + 8
def acc(i, n, dt):
    a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]
    return np.frombuffer(src, dtype=dt, count=a['count'] * n, offset=B0 + bv['byteOffset']).reshape(-1, n)
P = acc(0, 3, np.float32); UV = acc(1, 2, np.float32); N = acc(2, 3, np.float32)
IDX = acc(3, 1, np.uint32).ravel()

# ---- Malla: subdivisión de Loop en los brazos + normales suaves ----
# El modelo viene muy decimado (~3k vértices) y se usaba con un mapa de
# normales que aquí no llevamos: los brazos se veían facetados y con
# "costuras" de luz donde la UV corta la malla. Se suelda por posición,
# se subdivide una vez (Loop) suavizando sólo brazos (la cara, anteojos y
# bufanda quedan igual) y se recalculan normales compartidas en las costuras.
def subdivide(P, UV, IDX, mask_fn, iters=1):
    for _ in range(iters):
        key = np.round(P / 1e-5).astype(np.int64)
        _, pid, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        inv = inv.ravel(); WP = P[pid].astype(float); nW = len(WP)
        F = IDX.reshape(-1, 3); T = inv[F]
        # aristas soldadas → vértices opuestos
        e_opp = {}
        for t in T:
            for k in range(3):
                a, b, c = t[k], t[(k + 1) % 3], t[(k + 2) % 3]
                e_opp.setdefault((min(a, b), max(a, b)), []).append(c)
        nb = [set() for _ in range(nW)]; bnb = [[] for _ in range(nW)]
        for (a, b), o in e_opp.items():
            nb[a].add(b); nb[b].add(a)
            if len(o) != 2: bnb[a].append(b); bnb[b].append(a)
        loopV = np.empty_like(WP)
        for v in range(nW):
            if bnb[v]:
                q = bnb[v][:2]; loopV[v] = WP[v] * .75 + WP[q].sum(0) * (.25 / len(q))
            else:
                n = len(nb[v]); beta = 3 / 16 if n == 3 else 3 / (8 * n)
                loopV[v] = WP[v] * (1 - n * beta) + beta * WP[list(nb[v])].sum(0)
        m = mask_fn(WP)
        evenP = WP + (loopV - WP) * m[:, None]
        def edge_pt(a, b):
            o = e_opp[(min(a, b), max(a, b))]
            mid = (WP[a] + WP[b]) / 2
            if len(o) != 2: return mid
            lp = (WP[a] + WP[b]) * .375 + (WP[o[0]] + WP[o[1]]) * .125
            mm = (m[a] + m[b]) / 2
            return mid + (lp - mid) * mm
        newP = [evenP[inv[i]] for i in range(len(P))]; newUV = [UV[i] for i in range(len(P))]
        emap = {}; NF = []
        def mid_v(i, j):
            k = (min(i, j), max(i, j))
            if k not in emap:
                emap[k] = len(newP); newP.append(edge_pt(inv[i], inv[j])); newUV.append((UV[i] + UV[j]) / 2)
            return emap[k]
        for f in F:
            a, b, c = f; ab, bc, ca = mid_v(a, b), mid_v(b, c), mid_v(c, a)
            NF += [(a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)]
        P = np.array(newP, np.float32); UV = np.array(newUV, np.float32); IDX = np.array(NF, np.uint32).ravel()
    return P, UV, IDX
def smooth_normals(P, IDX):
    key = np.round(P / 1e-5).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel()
    F = IDX.reshape(-1, 3); a, b, c = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]
    fn = np.cross(b - a, c - a)  # ponderado por área
    acc = np.zeros((inv.max() + 1, 3))
    for k in range(3): np.add.at(acc, inv[F[:, k]], fn)
    acc /= np.linalg.norm(acc, axis=1, keepdims=True) + 1e-12
    return acc[inv].astype(np.float32)
def arm_mask(p):
    ax = np.abs(p[:, 0]); y = p[:, 1]
    t = np.clip((ax - .13) / .07, 0, 1); t = t * t * (3 - 2 * t)
    return t * ((y > -.04) & (y < .19))
n0 = len(P)
P, UV, IDX = subdivide(P, UV, IDX, arm_mask)
N0 = N; N = smooth_normals(P, IDX)
# conserva la orientación original (la malla es de doble cara)
print('vértices', n0, '→', len(P))

# ---- Huesos: nombre, padre, cabeza (pos. mundial), cola ----
A = 0.095
bones = [
  ('root', None, (0, -0.45, 0), (0, -0.30, 0)),
  ('hips', 'root', (0, -0.18, 0), (0, -0.02, 0)),
  ('spine', 'hips', (0, -0.02, 0), (0, 0.09, 0)),
  ('chest', 'spine', (0, 0.09, 0), (0, 0.17, 0)),
  ('neck', 'chest', (0, 0.17, 0), (0, 0.22, 0)),
  ('head', 'neck', (0, 0.22, 0), (0, 0.45, 0)),
]
for s, L in ((1, 'L'), (-1, 'R')):
    bones += [
      ('shoulder_' + L, 'chest', (s * .08, .10, 0), (s * .19, A, 0)),
      ('upperarm_' + L, 'shoulder_' + L, (s * .19, A, 0), (s * .31, A, 0)),
      ('forearm_' + L, 'upperarm_' + L, (s * .31, A, 0), (s * .41, A, 0)),
      ('hand_' + L, 'forearm_' + L, (s * .41, A, 0), (s * .475, A, 0)),
      ('thigh_' + L, 'hips', (s * .09, -.20, 0), (s * .09, -.33, 0)),
      ('shin_' + L, 'thigh_' + L, (s * .09, -.33, 0), (s * .09, -.43, 0)),
      ('foot_' + L, 'shin_' + L, (s * .09, -.43, 0), (s * .09, -.45, .06)),
    ]
names = [b[0] for b in bones]; idx = {n: i for i, n in enumerate(names)}
H = np.array([b[2] for b in bones], float); T = np.array([b[3] for b in bones], float)

# ---- Pesos: distancia al segmento, sólo huesos permitidos por zona ----
x, y, z = P[:, 0], P[:, 1], P[:, 2]
def seg_dist(p, a, b):
    ab = b - a; t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)
D = np.stack([seg_dist(P.astype(float), H[i], T[i]) for i in range(len(bones))], 1)
allow = np.zeros_like(D, bool)
ax = np.abs(x)
allow[:, idx['head']] = (y > .17) & (ax < .2)
allow[:, idx['neck']] = (y > .10) & (y < .26) & (ax < .2)
allow[:, idx['chest']] = (y > -.06) & (y < .24) & (ax < .26)
allow[:, idx['spine']] = (y > -.20) & (y < .14) & (ax < .24)
allow[:, idx['hips']] = (y < .02) & (ax < .24)
for s, L in ((1, 'L'), (-1, 'R')):
    side = (x * s) > -.005
    allow[:, idx['shoulder_' + L]] = side & (y > -.02) & (y < .19) & (ax < .27)
    for b in ('upperarm', 'forearm', 'hand'):
        allow[:, idx[b + '_' + L]] = side & (ax > .17) & (y > -.02) & (y < .165)
    allow[:, idx['thigh_' + L]] = side & (y < -.12)
    allow[:, idx['shin_' + L]] = side & (y < -.27)
    allow[:, idx['foot_' + L]] = side & (y < -.38)
W = np.where(allow, 1.0 / (D + .012) ** 4, 0.0)

# ---- Brazos y piernas: pesos por posición a lo largo del miembro ----
# La manga es casi tan gruesa como el hueso es largo, así que la distancia
# al segmento mezcla mal codo y muñeca. A lo largo del eje, cada articulación
# reparte el peso con una curva suave (como un codo real: la piel se pliega
# en una zona, no en una línea).
def ss(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
for s_, L in ((1, 'L'), (-1, 'R')):
    side = (x * s_) > .02
    arm = side & (ax > .15) & (y > -.02) & (y < .165)
    u = ax
    sh = 1 - ss(.15, .22, u)                      # hombro → brazo
    el = ss(.27, .35, u)                          # codo (zona amplia)
    wr = ss(.39, .44, u)                          # muñeca
    w_sh, w_up = sh, (1 - sh) * (1 - el)
    w_fo, w_ha = (1 - sh) * el * (1 - wr), (1 - sh) * el * wr
    W[arm] = 0
    W[arm, idx['shoulder_' + L]] = w_sh[arm]
    W[arm, idx['upperarm_' + L]] = w_up[arm]
    W[arm, idx['forearm_' + L]] = w_fo[arm]
    W[arm, idx['hand_' + L]] = w_ha[arm]
    leg = side & (y < -.24) & (ax > .02)
    v = -y
    kn = ss(.30, .37, v); ft = ss(.41, .445, v)
    W[leg] = 0
    W[leg, idx['thigh_' + L]] = (1 - kn)[leg]
    W[leg, idx['shin_' + L]] = (kn * (1 - ft))[leg]
    W[leg, idx['foot_' + L]] = (kn * ft)[leg]
    # cadera ↔ muslo: transición suave en la ingle
    hipz = side & (y >= -.24) & (y < -.14)
    hb = ss(-.14, -.24, y)
    W[hipz] = W[hipz] * (1 - hb[hipz, None])
    W[hipz, idx['thigh_' + L]] += hb[hipz]
none = W.sum(1) == 0
W[none] = 1.0 / (D[none] + .012) ** 4  # respaldo: cualquier hueso cercano
top = np.argsort(-W, 1)[:, :4]
TW = np.take_along_axis(W, top, 1); TW[TW < TW[:, :1] * .02] = 0
TW = TW / TW.sum(1, keepdims=True)
JOINTS = top.astype(np.uint8)
# pesos en bytes normalizados (núcleo de glTF): la suma exacta debe ser 255
WB = np.floor(TW * 255 + .5).astype(int); WB[np.arange(len(WB)), 0] += 255 - WB.sum(1); WEIGHTS = WB.astype(np.uint8)
print('vértices sin zona:', int(none.sum()))

# ---- Textura base a 1024 px ----
img = J['images'][0]; bv = J['bufferViews'][img['bufferView']]
im = Image.open(io.BytesIO(src[B0 + bv['byteOffset']: B0 + bv['byteOffset'] + bv['byteLength']])).convert('RGB')
im = im.resize((1024, 1024), Image.LANCZOS)
# Mangas y patas con color más limpio: la textura trae sombras horneadas y
# manchas que, al doblar el brazo, se leen como costuras. En las islas UV de
# los brazos se aplana la luz (se conserva el tono y, suave, el tejido del puño).
from PIL import ImageDraw, ImageFilter
S = 1024; mimg = Image.new('L', (S, S), 0); dr = ImageDraw.Draw(mimg)
am = arm_mask(P.astype(float)); F3 = IDX.reshape(-1, 3)
for f in F3:
    if am[f].min() > .5:
        dr.polygon([(UV[i, 0] * S, UV[i, 1] * S) for i in f], fill=255)
mimg = mimg.filter(ImageFilter.MaxFilter(9))
A = np.asarray(im).astype(float); M = np.asarray(mimg) > 0
lum = A @ [.299, .587, .114]
yel = M & (A[..., 0] > 140) & (A[..., 2] < 110) & (A[..., 0] - A[..., 2] > 80)
gry = M & (np.abs(A[..., 0] - A[..., 2]) < 45) & (lum > 70) & (lum < 200)
for sel, k in ((yel, .3), (gry, .25)):
    base = np.median(A[sel], 0); bl = base @ [.299, .587, .114]
    ratio = np.clip(lum[sel] / bl, .5, 1.4) ** k
    A[sel] = np.clip(base[None, :] * ratio[:, None], 0, 255)
im = Image.fromarray(A.astype(np.uint8)); im.save('tex-arms.png')
jb = io.BytesIO(); im.save(jb, 'JPEG', quality=82, optimize=True); JPG = jb.getvalue()

# ---- Armado del GLB ----
blob = bytearray(); views = []; accs = []
def add_view(data, target=None):
    while len(blob) % 4: blob.append(0)
    off = len(blob); blob.extend(data)
    v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
    if target: v['target'] = target
    views.append(v); return len(views) - 1
def add_acc(arr, ctype, typ, target=None, minmax=False):
    v = add_view(np.ascontiguousarray(arr).tobytes(), target)
    a = {'bufferView': v, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
    if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1
iI = add_acc(IDX.reshape(-1, 1).astype(np.uint16), 5123, 'SCALAR', 34963)
accs[iI]['count'] = int(IDX.size)
iP = add_acc(P, 5126, 'VEC3', 34962, True)
iN = add_acc(N, 5126, 'VEC3', 34962)
iU = add_acc(UV, 5126, 'VEC2', 34962)
iJ = add_acc(JOINTS, 5121, 'VEC4', 34962)
iW = add_acc(WEIGHTS, 5121, 'VEC4', 34962); accs[iW]['normalized'] = True
IBM = np.zeros((len(bones), 16), np.float32)
for i in range(len(bones)):
    m = np.eye(4); m[:3, 3] = -H[i]; IBM[i] = m.T.ravel()  # column-major
iB = add_acc(IBM, 5126, 'MAT4')
vImg = add_view(JPG)

nodes = [{'name': 'Oso', 'mesh': 0, 'skin': 0}]
jn = []
for i, (n, par, h, t) in enumerate(bones):
    ph = H[idx[par]] if par else np.zeros(3)
    nodes.append({'name': n, 'translation': (H[i] - ph).tolist()}); jn.append(len(nodes) - 1)
for i, (n, par, h, t) in enumerate(bones):
    kids = [jn[k] for k, b in enumerate(bones) if b[1] == n]
    if kids: nodes[jn[i]]['children'] = kids
gl = {
  'asset': {'version': '2.0', 'generator': 'Pichibank auto-rig'},
  'scene': 0, 'scenes': [{'nodes': [0, jn[0]]}], 'nodes': nodes,
  'meshes': [{'name': 'Oso', 'primitives': [{'attributes': {'POSITION': iP, 'NORMAL': iN, 'TEXCOORD_0': iU, 'JOINTS_0': iJ, 'WEIGHTS_0': iW}, 'indices': iI, 'material': 0}]}],
  'skins': [{'name': 'Esqueleto', 'joints': jn, 'skeleton': jn[0], 'inverseBindMatrices': iB}],
  'materials': [{'name': 'Pelaje', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': .85}, 'doubleSided': True}],
  'textures': [{'sampler': 0, 'source': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987}],
  'images': [{'bufferView': vImg, 'mimeType': 'image/jpeg'}],
  'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(blob)}],
}
js = json.dumps(gl, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
while len(blob) % 4: blob.append(0)
out = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(blob), b'BIN\x00') + bytes(blob)
open('oso-rig.glb', 'wb').write(out)
print('huesos', len(bones), 'GLB', len(out) // 1024, 'KB')
