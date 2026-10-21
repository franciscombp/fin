"""De una SDF a una malla de triángulos (surface nets) con normales suaves.

Surface nets pone un vértice por celda que cruza la superficie (el promedio de los cruces de sus
aristas) y une con un cuadrilátero las cuatro celdas alrededor de cada arista que cruza. Después
cada vértice se proyecta sobre la superficie exacta. Da mallas orgánicas, sin escalones."""
import numpy as np

# Las 12 aristas de una celda, como pares de esquinas (i, j, k)
CORNERS = np.array([[i, j, k] for k in (0, 1) for j in (0, 1) for i in (0, 1)])
EDGES = [(a, b) for a in range(8) for b in range(a + 1, 8) if np.abs(CORNERS[a] - CORNERS[b]).sum() == 1]


def grad(f, P, h=1e-3):
    g = np.zeros_like(P)
    for i in range(3):
        e = np.zeros(3); e[i] = h
        g[:, i] = (f(P + e) - f(P - e)) / (2 * h)
    return g


def mesh(f, lo, hi, cell):
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    n = np.ceil((hi - lo) / cell).astype(int) + 1
    xs, ys, zs = [lo[i] + np.arange(n[i]) * cell for i in range(3)]
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
    G = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    F = f(G).reshape(n)
    inside = F < 0
    nc = n - 1
    # Celdas que cruzan la superficie
    cs = np.zeros(nc, bool)
    sumv = np.zeros(tuple(nc) + (3,))
    cnt = np.zeros(nc)
    for a, b in EDGES:
        ca, cb = CORNERS[a], CORNERS[b]
        fa = F[ca[0]:ca[0] + nc[0], ca[1]:ca[1] + nc[1], ca[2]:ca[2] + nc[2]]
        fb = F[cb[0]:cb[0] + nc[0], cb[1]:cb[1] + nc[1], cb[2]:cb[2] + nc[2]]
        m = (fa < 0) != (fb < 0)
        t = np.where(m, fa / np.where(m, fa - fb, 1), 0)
        p = ca[None, None, None, :] + t[..., None] * (cb - ca)[None, None, None, :]
        sumv += np.where(m[..., None], p, 0)
        cnt += m
        cs |= m
    idx = -np.ones(nc, int)
    act = np.argwhere(cs)
    idx[tuple(act.T)] = np.arange(len(act))
    V = lo + (act + sumv[tuple(act.T)] / cnt[tuple(act.T)][:, None]) * cell
    # Un cuadrilátero por arista de la grilla que cruza
    quads = []
    for ax in range(3):
        o = [(ax + 1) % 3, (ax + 2) % 3]
        sl0 = [slice(0, n[i]) for i in range(3)]
        sl0[ax] = slice(0, n[ax] - 1)
        sl1 = list(sl0); sl1[ax] = slice(1, n[ax])
        a, b = inside[tuple(sl0)], inside[tuple(sl1)]
        cross = a != b
        e = np.argwhere(cross)
        # las cuatro celdas alrededor de la arista: la arista debe tener vecinos en los otros dos ejes
        ok = (e[:, o[0]] > 0) & (e[:, o[1]] > 0) & (e[:, o[0]] < nc[o[0]]) & (e[:, o[1]] < nc[o[1]])
        e = e[ok]
        flip = a[tuple(e.T)]
        cells = []
        for d0, d1 in ((0, 0), (1, 0), (1, 1), (0, 1)):
            c = e.copy(); c[:, o[0]] -= d0 ^ 1; c[:, o[1]] -= d1 ^ 1
            cells.append(idx[tuple(c.T)])
        q = np.stack(cells, 1)
        q[flip] = q[flip][:, ::-1]
        quads.append(q)
    Q = np.concatenate(quads)
    Q = Q[(Q >= 0).all(1)]
    T = np.concatenate([Q[:, [0, 1, 2]], Q[:, [0, 2, 3]]])
    # Sobre la superficie exacta (dos pasos de Newton) y normales del gradiente
    for _ in range(2):
        g = grad(f, V)
        V = V - (f(V) / np.maximum((g * g).sum(1), 1e-9))[:, None] * g
    N = grad(f, V)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    # Cada triángulo mira hacia afuera (su normal con la del gradiente)
    tn = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]])
    bad = (tn * N[T].mean(1)).sum(1) < 0
    T[bad] = T[bad][:, ::-1]
    # Sin triángulos degenerados
    area = np.linalg.norm(np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]]), axis=1)
    T = T[area > 1e-10]
    return V.astype(np.float32), N.astype(np.float32), T.astype(np.uint32)


def keep_largest(V, N, T):
    # Quita islas sueltas (restos de la grilla): deja la componente con más triángulos
    parent = np.arange(len(V))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for a, b, c in T:
        ra, rb, rc = find(a), find(b), find(c)
        parent[rb] = ra; parent[rc] = ra
    roots = np.array([find(i) for i in range(len(V))])
    tr = roots[T[:, 0]]
    vals, counts = np.unique(tr, return_counts=True)
    big = vals[counts.argmax()]
    T = T[tr == big]
    used = np.unique(T)
    remap = -np.ones(len(V), int); remap[used] = np.arange(len(used))
    return V[used], N[used], remap[T].astype(np.uint32)
