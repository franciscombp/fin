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
none = W.sum(1) == 0
W[none] = 1.0 / (D[none] + .012) ** 4  # respaldo: cualquier hueso cercano
top = np.argsort(-W, 1)[:, :4]
TW = np.take_along_axis(W, top, 1); TW[TW < TW[:, :1] * .02] = 0
TW = TW / TW.sum(1, keepdims=True)
JOINTS = top.astype(np.uint16); WEIGHTS = TW.astype(np.float32)
print('vértices sin zona:', int(none.sum()))

# ---- Textura base a 1024 px ----
img = J['images'][0]; bv = J['bufferViews'][img['bufferView']]
im = Image.open(io.BytesIO(src[B0 + bv['byteOffset']: B0 + bv['byteOffset'] + bv['byteLength']])).convert('RGB')
im = im.resize((1024, 1024), Image.LANCZOS); jb = io.BytesIO(); im.save(jb, 'JPEG', quality=82, optimize=True); JPG = jb.getvalue()

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
iI = add_acc(IDX.reshape(-1, 1).astype(np.uint32), 5125, 'SCALAR', 34963)
accs[iI]['count'] = int(IDX.size)
iP = add_acc(P, 5126, 'VEC3', 34962, True)
iN = add_acc(N, 5126, 'VEC3', 34962)
iU = add_acc(UV, 5126, 'VEC2', 34962)
iJ = add_acc(JOINTS, 5123, 'VEC4', 34962)
iW = add_acc(WEIGHTS, 5126, 'VEC4', 34962)
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
