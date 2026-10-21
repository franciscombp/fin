"""Primitivas de distancia con signo (SDF) para modelar a Uku por partes.

Cada primitiva devuelve, para una lista de puntos (N x 3), la distancia con signo a su superficie
(negativa adentro). El cuerpo es la unión suave de todas; cada primitiva pertenece a un hueso, y esa
pertenencia es la que da los pesos del esqueleto (ver pesos.py)."""
import numpy as np


def sphere(c, r):
    c = np.asarray(c, float)
    return lambda P: np.linalg.norm(P - c, axis=1) - r


def ellipsoid(c, r):
    # Aproximación de Inigo Quilez: buena cerca de la superficie, que es lo que importa
    c, r = np.asarray(c, float), np.asarray(r, float)

    def f(P):
        q = (P - c) / r
        k0 = np.linalg.norm(q, axis=1)
        k1 = np.linalg.norm(q / r, axis=1)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-9)
    return f


def capsule(a, b, ra, rb=None):
    # Cápsula de radio variable (de ra en a a rb en b)
    a, b = np.asarray(a, float), np.asarray(b, float)
    rb = ra if rb is None else rb
    ab = b - a
    L2 = ab @ ab

    def f(P):
        t = np.clip(((P - a) @ ab) / L2, 0, 1)
        d = np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
        return d - (ra + (rb - ra) * t)
    return f


def torus(c, R, r, axis=(0, 1, 0)):
    c, n = np.asarray(c, float), np.asarray(axis, float)
    n = n / np.linalg.norm(n)

    def f(P):
        q = P - c
        h = q @ n
        radial = np.linalg.norm(q - h[:, None] * n, axis=1)
        return np.sqrt((radial - R) ** 2 + h ** 2) - r
    return f


def smin(a, b, k):
    # Unión suave (polinómica): k es el ancho de la unión en metros
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def union(fs, k):
    def f(P):
        d = fs[0](P)
        for g in fs[1:]:
            d = smin(d, g(P), k)
        return d
    return f
