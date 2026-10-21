/* =====================================================================
   El mundo 3D de Uku (módulo ES, se carga solo al abrir Mis finanzas o el
   chat).

   - Un único renderer WebGL que se "muda" al contenedor activo.
   - Uku (assets/oso/uku.glb, ver uku-rig.js) con sus gestos hechos por código,
     más lentas y con menos amplitud (calm): saluda sin exagerar, respira,
     pestañea (los ojos están pintados en la textura y se cambian por
     variantes), mira a su alrededor y a las mariposas. Puede sostener
     objetos en la mano derecha y los accesorios van en la cabeza.
   - El planeta es una esfera, pero solo se ve (y se recorre) el claro
     alrededor de Uku: pasea despacio por ahí y vuelve.
   - El claro sigue las finanzas de la persona y nunca se ve triste:
     · nuevo en el banco → lleno de brotes amarillos
     · ahorro → flores amarillas (setBloom y setFinanzas)
     · inversiones → guayacanes en flor que sueltan pétalos
     · créditos → lo que tiene gracias a ellos: casa (hipoteca), carro,
       tiendita (tarjeta), carretilla (consumo), nevera, televisor, una
       caja (artefactos) o libros (estudios)
     · salud financiera → cuántos árboles tiene el bosque de atrás
   - Mariposas amarillas vuelan, se posan en flores y brotes y, si Uku está
     quieto, en su mano. Con ahorro o brotes, a ratos planta un brote.
   - setMood() le da un ánimo que se queda, como Duo: contento, tranquilo
     o pensativo.
   - Pausa el render cuando no se ve y respeta prefers-reduced-motion.
   - setLook() viste a Uku según el clima (assets/clima.js): en la costa
     palmeras y guayabera; sombrero de paja toquilla, gafas de sol, gorro
     de lana o paraguas (con lluvia).
   ===================================================================== */
import * as THREE from './vendor/three/three.module.min.js';
import { mergeGeometries } from './vendor/three/jsm/utils/BufferGeometryUtils.js';
// El oso: el de siempre (uku-rig.js) o el de respaldo hecho por código (uku-rig-nuevo.js, con ?oso=nuevo o
// localStorage uku_oso = nuevo) para probarlo
export const OSO = (() => { try { const q = new URLSearchParams(location.search).get('oso'); return (q || localStorage.getItem('uku_oso')) === 'nuevo' ? 'nuevo' : 'clasico'; } catch (e) { return 'clasico'; } })();

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

let renderer, scene, bearScene, shadow, camera, clock, host = null, raf = 0, visible = true;
let bear = null, readyFns = [], rig = null, bones = {}, forest, garden = null, held = null, ground, stage = null;
let ambient = null, focus = false, ambFocus = null;
let focusAmt = 0, shiftTo = { x: 0, y: 0 }, shiftCur = { x: 0, y: 0 }, zoomTo = 1, zoomCur = 1, front = false, frontAmt = 1, folCur = 1, plano = false, planoAmt = 0;
const camVel = { x: 0, y: 0, z: 0 }; // velocidad del encuadre (resorte amortiguado: arranca y frena suave)
// Resorte críticamente amortiguado: sigue un destino que puede moverse (hoja que sube, globo que entra) sin tirones
function spring(cur, to, velKey, dt) {
  const w = 8, v0 = camVel[velKey], d = cur - to;
  const v = (v0 - w * w * d * dt) / Math.pow(1 + w * dt, 2);
  camVel[velKey] = v; return cur + v * dt;
} // la cámara se acerca y se corre suavemente, nunca de golpe // focus: Uku sale del mundo y se acerca a conversar // ambient: lo que Uku hace cuando no hay gesto (p. ej. pasear)
// Mundo: un planeta esférico de radio PLANET_R; su punto más alto (0, 0, 0) es el centro del claro de Uku.
// Con 12 m el suelo se curva lo justo: desde cualquier cámara se ve el piso hasta ~2,5 m detrás de Uku, así nada
// queda detrás del horizonte con la base escondida (antes, con 3 m, todo lo de atrás parecía flotar).
const PLANET_R = 12, PLANET_C = new THREE.Vector3(0, -PLANET_R, 0), FOG_NEAR = 4;
let score = 50; // salud financiera con la que está dibujado el bosque
let target = null, loadAt = 0, ambLight = null, moodTint = new THREE.Color('#ffffff'); // mientras carga, el bosque crece hasta target; mood tiñe la luz
// bloom: flores amarillas del campo (0–100, ahorro); mood: ánimo que se queda (feliz, tranquilo, pensativo)
let bloom = null, mood = null;
// Lo que la persona tiene (PFM.finanzas()): nuevo en el banco, ahorro, inversiones y créditos
let fin = { nuevo: false, ahorro: 0, inversion: 0, deudas: [], historia: null, sugerencias: null };
let gesture = null, gestureT = 0, onTap = null, onPick = null;
let yaw = 0, yawTo = 0, camDist = 3.6, drag = null, idleAt = 0; // giro con el dedo
const CAM_H = 1.3; // altura de la cámara sobre los pies de Uku

/* ---------- Colores (claro / oscuro) ---------- */
let look = { region: 'sierra', shirt: 'sueter', hat: null, shades: false, rain: false };
function palette() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (look.region === 'costa') return dark ? {
    bg: '#1f1f1f', ground: '#353329', trunk: '#4c5262', pine: ['#3c4659', '#434d61'], palm: ['#41506a', '#4a5872'],
    round: ['#465066', '#4e586e'], rock: '#3b3e46', grass: '#434b5c', flower: '#f2d64b', guaya: ['#f2d64b', '#e6c13d', '#f7e07a'], sprout: ['#f2d64b', '#d8bc3a'], dust: '#ffffff'
  } : {
    bg: '#f6f6f5', ground: '#f6efd6', trunk: '#b9c0cf', pine: ['#d2dae8', '#c5cfe2'], palm: ['#a9bad6', '#9aaed0', '#b6c5de'],
    round: ['#d8dfeb', '#cdd5e4'], rock: '#e3e5ea', grass: '#d0d8e6', flower: '#f2c94c', guaya: ['#f2c94c', '#f7d96b', '#e8b93a'], sprout: ['#f2c94c', '#f7dc7f'], dust: '#ffffff'
  };
  // Ilustración: grises y blancos, tonos lavados para que el oso (que conserva sus colores) sea lo
  // nítido de la escena; el amarillo queda para lo que crece (brotes, flores, guayacanes, mariposas)
  return dark ? {
    bg: '#1f1f1f', ground: '#2b2d33', trunk: '#4a4f5c', pine: ['#3c4659', '#434d61', '#4a5468'],
    round: ['#465066', '#4e586e'], rock: '#3a3c43', grass: '#434b5c', flower: '#f2d64b', guaya: ['#f2d64b', '#e6c13d', '#f7e07a'], sprout: ['#f2d64b', '#d8bc3a'], dust: '#ffffff'
  } : {
    bg: '#f6f6f5', ground: '#eef0f4', trunk: '#aeb6c7', pine: ['#c9d3e6', '#b9c6de', '#d6deec'],
    round: ['#c3cee3', '#d2dbea'], rock: '#d9dce4', grass: '#c4cee1', flower: '#f2c94c', guaya: ['#f2c94c', '#f7d96b', '#e8b93a'], sprout: ['#f2c94c', '#f7dc7f'], dust: '#ffffff'
  };
}
// Colores de la marca que ya usa la ropa (gorro, paraguas, sombrero) para lo que se tiene con un crédito
const CREMA = '#efe9df', AZUL = '#2c4f9e', MARINO = '#1b2a4e', AMARILLO = '#ffd200', CARTON = '#e9dcb2', LLANTA = '#2f2f2f';
/* ---------- Estilo ilustración 2D ----------
   Colores planos, sin sombreado (solo luz ambiente) y sin contornos: los
   elementos se separan por el tono, como en una ilustración vectorial. */

/* ---------- El claro de Uku ----------
   Todo se ubica con coordenadas locales en metros: x a los lados y z hacia la cámara (z < 0 queda
   detrás de él). Posiciones fijas (semilla) para que el claro no "salte" entre visitas. */
function rng(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const _sp = new THREE.Vector3(), _nrm = new THREE.Vector3(0, 1, 0), _yaw = new THREE.Quaternion();
// Normal del planeta bajo (x, z): conserva la distancia medida sobre la superficie
function surf(x, z, out) { const d = Math.hypot(x, z), a = d / PLANET_R, k = d ? Math.sin(a) / d : 0; return out.set(x * k, Math.cos(a), z * k); }
// Pone un objeto sobre la esfera en (x, z) y lo alinea con su normal; rot lo gira alrededor de ella
function placeAt(g, x, z, rot) {
  surf(x, z, _sp); g.position.copy(PLANET_C).addScaledVector(_sp, PLANET_R);
  g.quaternion.setFromUnitVectors(_nrm, _sp);
  if (rot) g.quaternion.multiply(_yaw.setFromAxisAngle(_nrm, rot));
  return g;
}
// Altura del suelo bajo un punto (x, z) de la escena
const groundY = (x, z) => Math.sqrt(Math.max(0, PLANET_R * PLANET_R - x * x - z * z)) - PLANET_R;
// Puntos al azar en un anillo alrededor de Uku; ok(x, z) descarta los que no sirven y gap los separa
function scatter(seed, n, r0, r1, ok, gap) {
  const r = rng(seed), out = [];
  for (let i = 0; out.length < n && i < n * 40; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r0 * r0 + r() * (r1 * r1 - r0 * r0)), x = Math.sin(a) * d, z = Math.cos(a) * d;
    const p = { x, z, s: r(), rot: r() * 6.28, v: Math.floor(r() * 3), t: r() };
    if ((ok && !ok(x, z)) || (gap && out.some(q => Math.hypot(q.x - x, q.z - z) < gap))) continue;
    out.push(p);
  }
  return out;
}
// Lo alto (árboles, casas) va siempre detrás de Uku: nunca queda algo delante de la cámara
const TALL = (x, z) => z < -.4;
// Todo se apoya donde se ve el suelo: la base de cada cosa tiene que verse desde las cámaras de la app (libre, en
// primer plano, el plano general de Mis finanzas y alejada, de frente y girada). Si la normal del suelo en ese
// punto no mira hacia alguna de ellas, el punto está detrás del horizonte y lo que se ponga ahí parecería flotar.
const CAMS = [[0, .96, 3.14], [0, .78, 2.24], [0, 1.35, 4.26], [0, 1.2, 5.5], [1.4, .96, 2.8], [-1.4, .96, 2.8]];
const _vn = new THREE.Vector3(), _vp = new THREE.Vector3(), _vc = new THREE.Vector3();
function VISIBLE(x, z) {
  surf(x, z, _vn); _vp.copy(PLANET_C).addScaledVector(_vn, PLANET_R);
  return CAMS.every(c => _vc.set(c[0], c[1], c[2]).sub(_vp).normalize().dot(_vn) > .01);
}
// Los lugares principales del fondo: primero lo que tienes por tus créditos, luego los guayacanes y el resto, árboles
/* Zonas del claro: cada cosa de tus finanzas tiene su lugar fijo, así el paisaje se lee de un vistazo.
   · a la izquierda, tu hogar y lo que tienes gracias a tus créditos
   · a la derecha, tus inversiones (guayacanes en flor; si no tienes, un arbolito por crecer)
   · delante de Uku, los dos canteros de tu ahorro (flores; vacíos con su letrero si aún no ahorras)
   · al fondo, el bosque de tu presupuesto (un árbol por mes) */
const ZONA = {
  creditos: [[-.5, -1.1], [-1.05, -.95], [-.2, -1.65], [-.95, -1.65]].filter(([x, z]) => VISIBLE(x, z - .25)),
  inversion: [[.5, -1.15], [1.05, -.95], [.25, -1.7], [1, -1.7]].filter(([x, z]) => VISIBLE(x, z - .25)),
  ahorro: [[-.56, .32], [.56, .32]]
};
const BED_R = .24, BIG = ZONA.creditos.concat(ZONA.inversion);
const awayBig = (d) => (x, z) => BIG.every(([bx, bz]) => Math.hypot(x - bx, z - bz) > d);
const outBeds = (d) => (x, z) => ZONA.ahorro.every(([bx, bz]) => Math.hypot(x - bx, z - bz) > BED_R + d);
// El bosque va atrás de todo (o en los costados lejanos): nunca tapa lo que tienes
const TREES = scatter(11, 24, 1.3, 2.4, (x, z) => (z < -1.25 || Math.abs(x) > 1.6) && TALL(x, z) && VISIBLE(x, z - .3) && awayBig(.6)(x, z), .5);
// Flores de tu ahorro: dentro de los canteros, repartidas entre los dos para que crezcan parejo
const FLOWERS = (() => {
  const r = rng(71), out = [[], []];
  ZONA.ahorro.forEach(([cx, cz], b) => {
    for (let i = 0; out[b].length < 24 && i < 900; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * BED_R * .82, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (out[b].some(q => Math.hypot(q.x - x, q.z - z) < .068)) continue;
      out[b].push({ x, z, s: r(), rot: r() * 6.28, v: Math.floor(r() * 3), t: r() });
    }
  });
  return out[0].flatMap((p, i) => [p, out[1][i]].filter(Boolean));
})();
// Brotes (recién empiezas): por todo el claro a la vista, menos donde va lo grande
const SEEN = (x, z) => z < 1.1 && Math.abs(x) < 1.5 + Math.max(0, -z) * .5;
const SPROUTS = scatter(37, 52, .3, 1.9, (x, z) => SEEN(x, z) && VISIBLE(x, z) && awayBig(.35)(x, z), .09);
const DECO = {
  tufts: scatter(5, 70, .35, 2.6, (x, z) => z < .4 && VISIBLE(x, z) && outBeds(.08)(x, z) && awayBig(.4)(x, z), .14), rocks: scatter(17, 6, .9, 2.4, (x, z) => VISIBLE(x, z) && outBeds(.1)(x, z) && awayBig(.5)(x, z), .5),
  bushes: scatter(23, 8, 1.1, 2.4, (x, z) => TALL(x, z) && VISIBLE(x, z - .15) && awayBig(.6)(x, z), .5), daisies: scatter(43, 24, .35, 2.4, (x, z) => VISIBLE(x, z) && outBeds(.06)(x, z) && awayBig(.35)(x, z), .12)
};

/* ---------- Piezas ----------
   Cada objeto es una sola malla con colores por vértice (una llamada de dibujo por objeto, no una por
   pieza); las geometrías se comparten entre objetos iguales y se rehacen al cambiar el tema. */
let LAMB = null, GEO = {};
const _p4 = new THREE.Vector3(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler(), _s4 = new THREE.Vector3(), _c4 = new THREE.Color();
const TRS = (p, r, s) => new THREE.Matrix4().compose(_p4.set(...(p || [0, 0, 0])), _q4.setFromEuler(_e4.set(...(r || [0, 0, 0]))), typeof s === 'number' ? _s4.setScalar(s) : _s4.set(...(s || [1, 1, 1])));
// Una pieza: la geometría ya ubicada (p puede ser una Matrix4) y pintada de un color
function pc(geo, color, p, r, s) {
  const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose();
  g.deleteAttribute('uv'); g.applyMatrix4(p && p.isMatrix4 ? p : TRS(p, r, s));
  _c4.set(color); const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = _c4.r; c[i * 3 + 1] = _c4.g; c[i * 3 + 2] = _c4.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function kit(parts) { const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g; }
function geo(key, make) { return GEO[key] || (GEO[key] = kit(make())); }
function clearGeo() { Object.values(GEO).forEach(g => g.dispose()); GEO = {}; }
const CYL = (rt, rb, h, n) => new THREE.CylinderGeometry(rt, rb, h, n || 6);

const PARTS = {
  pino: (pal, v) => [pc(CYL(.035, .05, .35), pal.trunk, [0, .17, 0]), ...[[.32, .5, .45], [.25, .42, .72], [.17, .32, .95]].map(([r, h, y]) => pc(new THREE.ConeGeometry(r, h, 7), pal.pine[v % pal.pine.length], [0, y, 0], [0, v, 0]))],
  copa: (pal, v) => [pc(CYL(.04, .055, .45), pal.trunk, [0, .22, 0]), pc(new THREE.IcosahedronGeometry(.3, 0), pal.round[v % pal.round.length], [0, .64, 0], [0, v, 0], [1, 1.1, 1]),
    pc(new THREE.IcosahedronGeometry(.17, 0), pal.round[(v + 1) % pal.round.length], [.17, .5, .1], [v, 0, 0])],
  // Palmera: tronco curvo en segmentos y hojas largas que caen
  palma: (pal, v) => {
    const out = [], lean = .05 + v * .03; let x = 0, y = 0;
    for (let i = 0; i < 6; i++) { x += lean * i * .12; y += .15; out.push(pc(CYL(.03 - i * .002, .036 - i * .002, .16), pal.trunk, [x, y - .07, 0], [0, 0, -lean * i * .7])); }
    for (let i = 0; i < 7; i++) out.push(pc(new THREE.ConeGeometry(.06, .5, 3), pal.palm[v % pal.palm.length], TRS([x, y + .02, 0], [0, i / 7 * Math.PI * 2, 0]).multiply(TRS([.2, -.08, 0], [0, 0, Math.PI / 2 + .55], [1, 1, .25]))));
    [[.03, 0], [-.025, .02], [0, -.03]].forEach(([dx, dz]) => out.push(pc(new THREE.SphereGeometry(.025, 6, 5), pal.trunk, [x + dx, y - .03, dz])));
    return out;
  },
  // Guayacán en flor: un tronco que se abre en ramas, la copa amarilla en racimos y pétalos en el suelo
  guaya: (pal, v) => {
    const r = rng(91 + v), out = [pc(CYL(.04, .06, .5), pal.trunk, [0, .25, 0], [0, 0, .05])];
    [[-.5, .3], [.55, -.2], [.1, .6]].forEach(([a, b]) => out.push(pc(CYL(.022, .032, .36), pal.trunk, [Math.sin(a) * .1, .6, Math.sin(b) * .08], [b * .6, 0, -a * .9])));
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + r(), d = .12 + r() * .2; out.push(pc(new THREE.IcosahedronGeometry(.13 + r() * .08, 0), pal.guaya[i % pal.guaya.length], [Math.cos(a) * d, .82 + r() * .22, Math.sin(a) * d], [r(), r(), 0], [1, .8, 1])); }
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = .12 + r() * .45; out.push(pc(new THREE.CircleGeometry(.024, 5), pal.guaya[i % 2], [Math.cos(a) * d, .006, Math.sin(a) * d], [-Math.PI / 2, 0, r() * 6])); }
    return out;
  },
  flor: (pal, v) => {
    // la corola mira hacia adelante y arriba (no de canto): así se ve entera desde la cámara
    const c = v === 1 ? pal.guaya[1] : pal.flower, H = TRS([0, .105, 0], [.95, 0, 0]), out = [pc(CYL(.005, .006, .105, 4), pal.grass, [0, .052, 0]), pc(new THREE.ConeGeometry(.014, .045, 3), pal.grass, [.014, .035, 0], [0, 0, -.9], [1, 1, .35])];
    if (v === 2) out.push(pc(new THREE.SphereGeometry(.024, 7, 5), c, [0, .115, 0], 0, [1, .85, 1]), ...[0, 1, 2].map(i => pc(new THREE.SphereGeometry(.012, 5, 4), c, [Math.cos(i * 2.1) * .018, .133, Math.sin(i * 2.1) * .018])));
    else { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; out.push(pc(new THREE.SphereGeometry(.017, 6, 4), c, H.clone().multiply(TRS([Math.cos(a) * .022, 0, Math.sin(a) * .022], [0, -a, 0], [1.25, .45, .8])))); } out.push(pc(new THREE.SphereGeometry(.011, 6, 4), pal.trunk, H.clone().multiply(TRS([0, .006, 0])))); }
    return out;
  },
  // Brote: un tallito y dos hojas amarillas que se abren
  brote: (pal, v) => {
    const L = pal.sprout, h = .05 + v * .014;
    return [pc(CYL(.005, .006, h, 4), pal.grass, [0, h / 2, 0]),
      pc(new THREE.SphereGeometry(.024, 7, 5), L[0], [-.02, h + .008, 0], [0, 0, -.85], [1, .4, .7]),
      pc(new THREE.SphereGeometry(.024, 7, 5), L[1], [.02, h + .01, 0], [0, 0, .85], [1, .4, .7]),
      pc(new THREE.SphereGeometry(.009, 5, 4), L[0], [0, h + .012, 0])];
  },
  // Cantero de ahorro: tierra con un borde de piedritas (las flores crecen adentro)
  cantero: pal => {
    const o = [pc(CYL(BED_R, BED_R + .01, .022, 28), pal.trunk, [0, .006, 0])], r = rng(5);
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; o.push(pc(new THREE.DodecahedronGeometry(.026, 0), pal.rock, [Math.cos(a) * (BED_R + .012), .014, Math.sin(a) * (BED_R + .012)], [r(), r(), 0], [1, .6, 1])); }
    return o;
  },
  // Letrero clavado en el cantero vacío: aquí florece tu ahorro
  letrero: pal => [pc(CYL(.007, .007, .16, 5), CARTON, [0, .08, 0]), pc(new THREE.BoxGeometry(.11, .07, .012), CREMA, [0, .15, 0]), pc(new THREE.CircleGeometry(.018, 10), pal.flower, [0, .15, .007])],
  // Arbolito por crecer (aún sin inversiones): un guayacán chiquito atado a su tutor, con su letrero
  arbolito: pal => [pc(CYL(.012, .018, .2, 6), pal.trunk, [0, .1, 0]), pc(new THREE.IcosahedronGeometry(.05, 0), pal.sprout[1], [0, .22, 0], [.3, 0, 0], [1, .8, 1]), pc(new THREE.IcosahedronGeometry(.035, 0), pal.sprout[0], [.04, .19, .02]),
    pc(CYL(.006, .006, .26, 5), CARTON, [-.05, .13, -.01]), pc(new THREE.TorusGeometry(.03, .004, 4, 10), CARTON, [-.025, .14, 0], [Math.PI / 2, 0, 0], [1, .6, 1]),
    pc(CYL(.006, .006, .14, 5), CARTON, [.12, .07, .06]), pc(new THREE.BoxGeometry(.1, .065, .012), CREMA, [.12, .14, .06]), pc(new THREE.CircleGeometry(.016, 10), pal.guaya[0], [.12, .14, .067])],
  // Lo que tienes gracias a tus créditos: siempre algo propio, nunca un paisaje triste
  // Casa hobbit: un montículo de pasto con puerta redonda, ventanitas con luz, chimenea de piedra y un caminito
  casa: pal => {
    const A = .4, H = .29, Z = .36, on = (x, y, k) => { // un punto del frente del montículo, mirando hacia afuera
      const z = Z * Math.sqrt(Math.max(0, 1 - (x / A) ** 2 - (y / H) ** 2)), n = new THREE.Vector3(x / (A * A), y / (H * H), z / (Z * Z)).normalize();
      return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z).addScaledVector(n, k), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), new THREE.Vector3(1, 1, 1));
    };
    const door = new THREE.Matrix4().compose(new THREE.Vector3(0, .11, .336), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    const o = [pc(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), pal.pine[1 % pal.pine.length], [0, 0, 0], 0, [A, H, Z]),
      pc(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), pal.trunk, [0, .2, -.02], 0, [.27, .1, .24]), // el lomo, un poco más oscuro
      pc(new THREE.TorusGeometry(.108, .018, 8, 28), CARTON, door), pc(new THREE.CircleGeometry(.1, 28), AZUL, door.clone().multiply(TRS([0, 0, .004]))),
      pc(new THREE.BoxGeometry(.005, .19, .004), MARINO, door.clone().multiply(TRS([0, 0, .007]))), pc(new THREE.SphereGeometry(.012, 8, 6), AMARILLO, door.clone().multiply(TRS([.055, 0, .012])))];
    [-1, 1].forEach(sx => { o.push(pc(new THREE.TorusGeometry(.05, .011, 6, 20), CREMA, on(sx * .215, .135, .004)), pc(new THREE.CircleGeometry(.047, 20), pal.flower, on(sx * .215, .135, .006)), pc(new THREE.BoxGeometry(.094, .006, .004), CREMA, on(sx * .215, .135, .009))); });
    o.push(pc(CYL(.034, .04, .15, 8), pal.rock, [.14, .3, -.05]), pc(CYL(.044, .044, .022, 8), pal.trunk, [.14, .38, -.05]));
    [[0, .44, .07], [.03, .55, .06], [-.01, .66, .055]].forEach(([x, z, r]) => o.push(pc(CYL(r, r, .016, 9), pal.rock, [x, .004, z], [0, x * 20, 0], [1, 1, .75])));
    [[-.18, .24, .1], [.05, .27, -.17], [.25, .17, .02], [-.08, .28, -.05]].forEach(([x, y, z]) => o.push(pc(new THREE.ConeGeometry(.013, .06, 3), pal.trunk, [x, y, z], [z, 0, x])));
    return o;
  },
  carro: pal => [pc(new THREE.BoxGeometry(.52, .12, .26), AZUL, [0, .1, 0]), pc(new THREE.BoxGeometry(.28, .11, .24), AZUL, [-.04, .21, 0]), pc(new THREE.BoxGeometry(.24, .075, .245), CREMA, [-.04, .215, 0]),
    ...[[-.16, .13], [.16, .13], [-.16, -.13], [.16, -.13]].map(([x, z]) => pc(CYL(.055, .055, .04, 12), LLANTA, [x, .055, z], [Math.PI / 2, 0, 0])),
    pc(new THREE.BoxGeometry(.012, .03, .05), AMARILLO, [.262, .11, .08]), pc(new THREE.BoxGeometry(.012, .03, .05), AMARILLO, [.262, .11, -.08])],
  // Tiendita: mostrador, toldo a rayas y una tarjeta de letrero
  tienda: pal => [pc(new THREE.BoxGeometry(.46, .2, .22), CREMA, [0, .1, 0]), pc(new THREE.BoxGeometry(.4, .08, .012), AZUL, [0, .1, .112]),
    ...[[-.21, -.09], [.21, -.09], [-.21, .09], [.21, .09]].map(([x, z]) => pc(CYL(.012, .012, .42, 5), pal.trunk, [x, .21, z])),
    ...[0, 1, 2, 3, 4, 5].map(i => pc(new THREE.BoxGeometry(.084, .012, .3), i % 2 ? CREMA : AMARILLO, [-.21 + i * .084, .44, .02], [.22, 0, 0])),
    pc(new THREE.BoxGeometry(.16, .1, .012), MARINO, [0, .53, -.08]), pc(new THREE.BoxGeometry(.035, .025, .014), AMARILLO, [-.04, .54, -.072]),
    ...[[-.12, AMARILLO], [-.04, AZUL], [.05, AMARILLO], [.13, pal.flower]].map(([x, c]) => pc(new THREE.SphereGeometry(.03, 6, 5), c, [x, .225, .03]))],
  carretilla: pal => [pc(new THREE.BoxGeometry(.3, .09, .2), AZUL, [0, .14, 0], [0, 0, .08]), pc(CYL(.05, .05, .03, 12), LLANTA, [.19, .05, 0], [Math.PI / 2, 0, 0]),
    pc(CYL(.008, .008, .26, 4), pal.trunk, [-.2, .15, .07], [0, 0, 1.3]), pc(CYL(.008, .008, .26, 4), pal.trunk, [-.2, .15, -.07], [0, 0, 1.3]),
    pc(CYL(.008, .008, .12, 4), pal.trunk, [-.08, .06, .07]), pc(CYL(.008, .008, .12, 4), pal.trunk, [-.08, .06, -.07]),
    pc(new THREE.BoxGeometry(.11, .09, .11), CARTON, [-.04, .23, .02], [0, .3, 0]), pc(new THREE.BoxGeometry(.09, .08, .09), CARTON, [.07, .22, -.02], [0, -.2, 0]), pc(new THREE.BoxGeometry(.07, .06, .07), CARTON, [.01, .3, 0], [0, .5, 0])],
  nevera: pal => [pc(new THREE.BoxGeometry(.22, .46, .2), CREMA, [0, .23, 0]), pc(new THREE.BoxGeometry(.222, .01, .202), AZUL, [0, .31, 0]),
    pc(new THREE.BoxGeometry(.014, .07, .014), MARINO, [.08, .37, .105]), pc(new THREE.BoxGeometry(.014, .1, .014), MARINO, [.08, .2, .105]), pc(new THREE.CircleGeometry(.018, 8), AMARILLO, [-.05, .4, .101])],
  tele: pal => [pc(new THREE.BoxGeometry(.24, .12, .14), pal.trunk, [0, .06, 0]), pc(new THREE.BoxGeometry(.04, .04, .03), MARINO, [0, .14, 0]),
    pc(new THREE.BoxGeometry(.36, .23, .03), MARINO, [0, .27, 0]), pc(new THREE.BoxGeometry(.32, .19, .006), AZUL, [0, .27, .017]), pc(new THREE.CircleGeometry(.03, 10), AMARILLO, [.07, .3, .021])],
  caja: () => [pc(new THREE.BoxGeometry(.2, .16, .2), CREMA, [0, .08, 0]), pc(new THREE.BoxGeometry(.205, .165, .035), AMARILLO, [0, .08, 0]), pc(new THREE.BoxGeometry(.035, .165, .205), AMARILLO, [0, .08, 0]),
    pc(new THREE.TorusGeometry(.03, .01, 5, 10), AMARILLO, [-.026, .18, 0], [0, 0, .5]), pc(new THREE.TorusGeometry(.03, .01, 5, 10), AMARILLO, [.026, .18, 0], [0, 0, -.5])],
  libros: () => [pc(new THREE.BoxGeometry(.24, .05, .17), AZUL, [0, .025, 0], [0, .1, 0]), pc(new THREE.BoxGeometry(.22, .045, .16), CREMA, [.01, .073, 0], [0, -.15, 0]),
    pc(new THREE.BoxGeometry(.2, .045, .15), AMARILLO, [0, .118, 0], [0, .25, 0]), pc(new THREE.BoxGeometry(.16, .04, .12), MARINO, [0, .16, 0], [0, -.1, 0])]
};
const PROP_S = { casa: 1.45, carro: 1.3, tienda: 1.4, carretilla: 1.45, nevera: 1.1, tele: 1.0, caja: 1.4, libros: 1.45 };
const PROP_ORDER = ['casa', 'carro', 'tienda', 'carretilla', 'nevera', 'tele', 'caja', 'libros'];
// Qué tienes por cada crédito con saldo (uno de cada tipo, hasta cuatro)
function propsDe(deudas) {
  const k = {};
  (deudas || []).forEach(d => {
    if (!(d.saldo > 0)) return;
    const s = ((d.producto || '') + ' ' + (d.institucion || '')).toLowerCase();
    k[d.clase === 'hipoteca' || /hipoteca|vivienda/.test(s) ? 'casa' : /auto|carro|veh[ií]culo|moto/.test(s) ? 'carro' : /refri|nevera/.test(s) ? 'nevera'
      : /televis/.test(s) ? 'tele' : /estudi|educa|universi/.test(s) ? 'libros' : d.clase === 'tarjeta' ? 'tienda' : /celular|tel[eé]fono|laptop|computador|artefact/.test(s) ? 'caja' : 'carretilla'] = 1;
  });
  return PROP_ORDER.filter(x => k[x]).slice(0, 4);
}
// Lo que se ve según lo que tienes
function finScene() {
  return { props: propsDe(fin.deudas), guayas: fin.inversion > 0 ? Math.min(4, 1 + Math.round(fin.inversion / 2500)) : 0,
    flores: Math.max(bloom || 0, fin.ahorro > 0 ? 25 : 0), brotes: !!fin.nuevo };
}

// Cada objeto del claro: una malla con su geometría compartida, ubicada y con lo que necesita para crecer y mecerse
function item(kind, v, pal, p, base, opts) {
  const m = new THREE.Mesh(geo(kind + v, () => PARTS[kind](pal, v)), LAMB);
  placeAt(m, p.x, p.z, p.rot);
  Object.assign(m.userData, { kind, base, q0: m.quaternion.clone(), sway: 0, ph: p.rot || 0, gs: 1.3 }, opts || {});
  return m;
}
function makeTree(p, pal) {
  const kind = p.t < .6 ? (look.region === 'costa' ? 'palma' : 'pino') : 'copa';
  return item(kind, p.v % 3, pal, p, (p.big ? 1.15 : .85 + p.s * .4) * (p.low ? .7 : 1), { sway: .02, gs: .9 });
}
// Humo de la chimenea: tres bocanadas que suben, crecen y se deshacen
let smokeM = null; const smokeG = new THREE.SphereGeometry(.03, 7, 5);
function smoke(o, t) { o.children.forEach((c, i) => { const f = (t * .22 + i / 3) % 1; c.position.set(.14 + f * .08, .41 + f * .32, -.05); c.scale.setScalar(Math.max(.001, Math.sin(f * Math.PI) * (.6 + f))); }); }
function makeProp(k, pal, x, z) {
  const o = item(k, '', pal, { x, z, rot: Math.atan2(-x, 3.2 - z) * .8 }, PROP_S[k], { gs: 1.1 });
  if (k === 'casa') { for (let i = 0; i < 3; i++) o.add(new THREE.Mesh(smokeG, smokeM)); o.userData.tick = smoke; }
  return o;
}

/* El bosque se actualiza por diferencia: al cambiar el puntaje o las finanzas sólo crece lo que falta
   y se encoge lo que sobra; nada se recrea de golpe. (full = rehacer, p. ej. al cambiar de tema.) */
let planted = [], plantN = 0; // brotes que Uku plantó en esta visita
function buildForest(full) {
  const pal = palette();
  if (!forest) { forest = new THREE.Group(); scene.add(forest); }
  if (full) { forest.children.slice().forEach(o => forest.remove(o)); clearGeo(); buildGarden(pal); }
  const f = finScene(), want = {}, id = (x, z) => x.toFixed(2) + ',' + z.toFixed(2);
  const Z = (o, zona) => { o.userData.zona = zona; return o; };
  f.props.forEach((k, i) => { const sp = ZONA.creditos[i]; if (!sp) return; const [x, z] = sp; want['C' + k + id(x, z)] = () => Z(makeProp(k, pal, x, z), 'credito:' + k); });
  for (let i = 0; i < f.guayas && i < ZONA.inversion.length; i++) { const [x, z] = ZONA.inversion[i]; want['G' + id(x, z)] = () => Z(item('guaya', i % 3, pal, { x, z, rot: i * 1.7 }, 1.1 + (i % 2) * .12, { sway: .015, gs: .7, crown: .95 }), 'inversion'); }
  // Sin inversiones, en su lugar espera un arbolito: el guayacán que puede crecer
  if (!f.guayas && ZONA.inversion[0]) { const [x, z] = ZONA.inversion[0]; want['A' + id(x, z)] = () => Z(item('arbolito', '', pal, { x, z, rot: -.5 }, 1.5, { sway: .03, gs: 1 }), 'inversion'); }
  // Los canteros del ahorro siempre están; vacíos, con un letrero que invita a llenarlos
  ZONA.ahorro.forEach(([x, z], i) => {
    want['K' + i] = () => Z(item('cantero', '', pal, { x, z, rot: i }, 1, { gs: 1.6 }), 'ahorro');
    if (!f.flores && !f.brotes && i === 0) want['L' + i] = () => Z(item('letrero', '', pal, { x: x + .18, z: z - .2, rot: Math.atan2(-x, 3.2 - z) }, 1.3, { sway: .01 }), 'ahorro');
  });
  // Bosque de atrás: lo dice la salud financiera (siempre hay algunos árboles; nunca tocones ni tierra seca)
  // Un árbol por cada mes de tu historia (el más reciente, el más cerca): frondoso si cerraste el mes con saldo a favor,
  // más chico si cerraste justo. Si recién empiezas no hay árboles: solo brotes en el suelo. Sin historia a la mano
  // (otras pantallas), el bosque sigue a la salud financiera como antes.
  const spots = TREES;
  const trees = fin.nuevo ? [] : Array.isArray(fin.historia) ? spots.slice(0, fin.historia.length).map((p, i) => Object.assign({}, p, { low: !fin.historia[i].ok }))
    : spots.slice(0, 3 + Math.round(score / 100 * (spots.length - 3)));
  trees.forEach(p => { want['T' + (p.low ? 'l' : 'h') + id(p.x, p.z)] = () => Z(makeTree(p, pal), 'bosque'); });
  // En la costa, dos palmeras a los lados de Uku para que se lean a primera vista
  if (look.region === 'costa' && !fin.nuevo) [{ x: -1.35, z: -.45, s: 1, t: .1, v: 0, rot: .4 }, { x: 1.4, z: -.5, s: .8, t: .2, v: 1, rot: 2.6 }].forEach(p => { want['P' + id(p.x, p.z)] = () => item('palma', p.v, pal, p, 1.05, { sway: .02, gs: .9 }); });
  FLOWERS.slice(0, Math.round(f.flores / 100 * FLOWERS.length)).forEach((p, i) => { want['F' + i] = () => Z(item('flor', p.v, pal, { x: p.x, z: p.z, rot: Math.atan2(-p.x, 3.2 - p.z) + (p.t - .5) * .8 }, .95 + p.s * .45, { sway: .1, top: .12 }), 'ahorro'); });
  if (f.brotes) SPROUTS.concat(FLOWERS.slice(0, 20)).forEach((p, i) => { want['B' + i] = () => Z(item('brote', p.v, pal, p, .9 + p.s * .5, { sway: .08, top: .06 + p.v * .012 }), 'ahorro'); });
  planted.forEach(p => { want[p.key] = () => item('brote', 1, pal, p, 1.15, { sway: .08, top: .07, gs: .32 }); });
  const have = {};
  forest.children.forEach(o => { have[o.userData.key] = o; });
  Object.keys(have).forEach(k => { const u = have[k].userData; u.dir = want[k] ? 1 : -1; if (u.dir < 0) u.delay = 0; });
  let n = 0;
  Object.keys(want).forEach(k => {
    if (have[k]) return;
    const o = want[k](), u = o.userData; u.key = k; u.dir = 1; u.grow = full ? 1 : 0;
    u.delay = full || RM || k[0] === 'X' ? 0 : (n++ % 14) * .05 + Math.random() * .3; // lo nuevo brota de a poco, no todo a la vez
    o.scale.setScalar(full ? u.base : .001);
    forest.add(o);
  });
  // Las mariposas son las sugerencias de Uku: una por cada una (siempre hay al menos dos revoloteando)
  flyN = fin.sugerencias != null ? Math.max(2, Math.min(6, fin.sugerencias)) : Math.min(5, 2 + (f.flores > 0) + (f.guayas > 0) + f.brotes);
}
// Lo que siempre está, tenga lo que tenga: pasto, piedras, arbustos y florcitas blancas (una sola malla)
const _dum = new THREE.Object3D();
function buildGarden(pal) {
  if (garden) { scene.remove(garden); garden.geometry.dispose(); }
  const parts = [], M = (p, s) => { placeAt(_dum, p.x, p.z, p.rot); return new THREE.Matrix4().compose(_dum.position, _dum.quaternion, _s4.setScalar(s)); };
  DECO.tufts.forEach(p => { const m = M(p, .8 + p.s * .5); [-.35, 0, .35].forEach((a, i) => parts.push(pc(new THREE.ConeGeometry(.009, .055 + (i % 2) * .025, 3), pal.grass, m.clone().multiply(TRS([a * .035, .035 + (i % 2) * .015, 0], [0, 0, a]))))); });
  DECO.rocks.forEach(p => parts.push(pc(new THREE.DodecahedronGeometry(.06, 0), pal.rock, M(p, .7 + p.s).multiply(TRS([0, .015, 0], [p.t, 0, 0], [1, .55, .8])))));
  DECO.bushes.forEach(p => { const m = M(p, 1 + p.s * .5), c = pal.round[p.v % pal.round.length]; [[0, .1, 0, .13], [.1, .07, .04, .09], [-.09, .06, -.03, .08]].forEach(([x, y, z, r]) => parts.push(pc(new THREE.IcosahedronGeometry(r, 0), c, m.clone().multiply(TRS([x, y, z], [p.t, 0, 0]))))); });
  DECO.daisies.forEach(p => { const m = M(p, .8 + p.s * .4); parts.push(pc(CYL(.003, .004, .05, 3), pal.grass, m.clone().multiply(TRS([0, .025, 0]))), pc(new THREE.SphereGeometry(.01, 5, 3), pal.dust, m.clone().multiply(TRS([0, .052, 0], 0, [1, .6, 1])))); });
  garden = new THREE.Mesh(kit(parts), LAMB); garden.visible = !focus; scene.add(garden);
}

/* ---------- Polvo de luz (motas blancas que flotan) ---------- */
let dust = null;
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildDust() {
  const n = 170, pos = new Float32Array(n * 3), speed = new Float32Array(n), r = rng(53);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = .3 + r() * 2.6;
    pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = r() * 2.2; pos[i * 3 + 2] = Math.sin(a) * d * .8 + .2;
    speed[i] = .03 + r() * .07;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTexture(), size: .045, transparent: true, opacity: .9, depthWrite: false, color: palette().dust, fog: false }));
  dust.userData.speed = speed;
  scene.add(dust);
}

/* ---------- Pétalos de guayacán (puntos amarillos que caen despacio) ---------- */
let petals = null;
function buildPetals() {
  const n = 40, pos = new Float32Array(n * 3).fill(-9);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  petals = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTexture(), size: .03, transparent: true, depthWrite: false, color: palette().flower }));
  petals.userData = { v: new Float32Array(n), life: new Float32Array(n) };
  petals.visible = false; scene.add(petals);
}
const _pu = new THREE.Vector3();
function updatePetals(dt, t) {
  const gs = forest ? forest.children.filter(o => o.userData.crown && o.userData.dir > 0 && o.userData.grow > .9) : [];
  petals.visible = gs.length > 0 && !focus;
  if (!petals.visible || RM) return;
  const a = petals.geometry.attributes.position, { v, life } = petals.userData;
  for (let i = 0; i < a.count; i++) {
    let x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    life[i] -= dt;
    if (life[i] <= 0 || y < groundY(x, z)) {
      // nace en la copa de un guayacán, a una altura al azar para que no caigan todos juntos
      const o = gs[i % gs.length], k = o.scale.y, ang = Math.random() * 6.28, d = Math.random() * .32 * k;
      _pu.set(0, 1, 0).applyQuaternion(o.quaternion);
      x = o.position.x + _pu.x * .9 * k + Math.cos(ang) * d; y = o.position.y + _pu.y * (.75 + Math.random() * .25) * k; z = o.position.z + _pu.z * .9 * k + Math.sin(ang) * d;
      v[i] = .06 + Math.random() * .08; life[i] = 6 + Math.random() * 6;
    }
    a.setXYZ(i, x + Math.sin(t * 1.3 + i) * .05 * dt, y - v[i] * dt, z + Math.cos(t * 1.1 + i * 2) * .04 * dt);
  }
  a.needsUpdate = true;
}

/* ---------- Mariposas amarillas ----------
   Vuelan sin rumbo por el claro, se posan en flores y brotes (abren y cierran las alas despacio) y,
   si Uku está quieto, en su mano: él la mira y sonríe. */
let flies = [], fliesG = null, flyN = 2, wingM = null;
function wingGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, .006); s.bezierCurveTo(.012, .034, .044, .042, .046, .02); s.bezierCurveTo(.047, .006, .03, .001, .012, 0);
  s.bezierCurveTo(.032, -.008, .034, -.032, .017, -.034); s.bezierCurveTo(.006, -.033, .002, -.016, 0, -.008);
  return new THREE.ShapeGeometry(s, 6).rotateX(Math.PI / 2); // en el plano del suelo; el ala de adelante hacia +z
}
function buildFlies() {
  fliesG = new THREE.Group(); scene.add(fliesG);
  wingM = new THREE.MeshLambertMaterial({ color: palette().flower, side: THREE.DoubleSide });
  const wg = wingGeo(), bm = new THREE.MeshLambertMaterial({ color: '#3a3c43' }), bg = new THREE.CapsuleGeometry(.0035, .026, 2, 5).rotateX(Math.PI / 2), r = rng(7);
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(), wr = new THREE.Mesh(wg, wingM), wl = new THREE.Mesh(wg, wingM); wl.scale.x = -1;
    g.add(wr, wl, new THREE.Mesh(bg, bm)); g.scale.setScalar(.95 + (i % 3) * .15);
    const p = new THREE.Vector3((r() - .5) * 1.6, 0, -r() * 1.2); p.y = groundY(p.x, p.z) + .25 + r() * .4;
    flies.push({ g, wr, wl, p, v: new THREE.Vector3(), goal: p.clone(), st: 'fly', timer: r() * 3, ph: r() * 9, perch: null, yaw: r() * 6 });
    wr.rotation.z = .5; wl.rotation.z = -.5; g.position.copy(p); fliesG.add(g);
  }
}
const _fp = new THREE.Vector3(), _fv = new THREE.Vector3(), _fu = new THREE.Vector3();
// Uku ofrece la mano solo si está quieto, sin gesto y sin el paraguas
const handFree = () => !!(bear && bones.hand_R && !gesture && !moving && !focus && !umb);
function perchPoint(f, out) {
  const P = f.perch; if (!P) return null;
  // sobre la pata derecha, del lado de la cámara (en metros, con los ejes de Uku)
  if (P === 'hand') { if (!handFree()) return null; bones.hand_R.getWorldPosition(out); return out.add(_fu.set(-.006, -.014, .034).applyQuaternion(bear.quaternion)); }
  if (!P.parent || P.userData.dir < 0) return null;
  _fu.set(0, 1, 0).applyQuaternion(P.quaternion);
  return out.copy(P.position).addScaledVector(_fu, P.userData.top * P.scale.y + .004);
}
function wander(f) {
  f.goal.set(pos.x + (Math.random() - .5) * 2, 0, pos.z - 1 + Math.random() * 1.5);
  f.goal.y = groundY(f.goal.x, f.goal.z) + .15 + Math.random() * .55; f.timer = 2 + Math.random() * 3;
}
function choose(f) {
  const r = Math.random();
  if (r < .22 && handFree() && !flies.some(x => x.perch === 'hand')) { f.st = 'land'; f.perch = 'hand'; return; }
  if (r < .62) {
    const c = forest.children.filter(o => o.userData.top && o.userData.dir > 0 && o.userData.grow >= 1 && !flies.some(x => x.perch === o));
    if (c.length) { f.st = 'land'; f.perch = c[Math.floor(Math.random() * c.length)]; return; }
  }
  f.st = 'fly'; f.perch = null; wander(f);
}
function updateFlies(dt, t) {
  flies.forEach((f, i) => {
    f.g.visible = i < flyN && !focus;
    if (!f.g.visible) { if (f.perch) { f.perch = null; f.st = 'fly'; } return; }
    if (RM) return;
    let a;
    if (f.st === 'perch') {
      const pp = perchPoint(f, _fp);
      if (!pp || (f.timer -= dt) < 0) { f.st = 'fly'; f.perch = null; f.v.set((Math.random() - .5) * .2, .25, (Math.random() - .5) * .2); wander(f); }
      else { f.p.lerp(pp, Math.min(1, dt * 14)); if (f.perch === 'hand') f.yaw = lerp(f.yaw, Math.atan2(camera.position.x - f.p.x, camera.position.z - f.p.z) + Math.PI / 2, Math.min(1, dt * 4)); } // de perfil a la cámara: se le ven las alas
      const o = .5 + .5 * Math.sin(t * 1.7 + f.ph); a = 1.4 - 1.1 * o * o; // posada: abre y cierra las alas despacio
    } else {
      if (f.st === 'land') {
        const pp = perchPoint(f, _fp);
        if (!pp) choose(f);
        else { f.goal.copy(pp); if (f.p.distanceTo(pp) < .02) { f.st = 'perch'; f.timer = f.perch === 'hand' ? 3 + Math.random() * 2 : 3 + Math.random() * 5; if (f.perch === 'hand') happyFor = 1.3; } }
      } else if ((f.timer -= dt) < 0 || f.p.distanceTo(f.goal) < .06) choose(f);
      // vuela hacia su destino con un zigzag que se calma al llegar
      _fv.subVectors(f.goal, f.p); const d = _fv.length(), sp = f.st === 'land' ? Math.min(.22, .04 + d * 1.6) : .2, wob = f.st === 'land' ? Math.min(1, d / .15) : 1;
      _fv.multiplyScalar(sp / Math.max(d, 1e-3));
      _fv.x += Math.sin(t * 3.1 + f.ph) * .09 * wob; _fv.y += Math.sin(t * 5.3 + f.ph * 2) * .07 * wob; _fv.z += Math.cos(t * 2.7 + f.ph) * .07 * wob;
      f.v.lerp(_fv, Math.min(1, dt * 3)); f.p.addScaledVector(f.v, dt);
      if (f.st !== 'land') f.p.y = Math.max(f.p.y, groundY(f.p.x, f.p.z) + .06);
      a = .15 + 1.25 * (.5 + .5 * Math.sin(t * 24 + f.ph));
      if (f.v.x * f.v.x + f.v.z * f.v.z > 1e-4) f.yaw = Math.atan2(f.v.x, f.v.z);
    }
    f.wr.rotation.z = a; f.wl.rotation.z = -a;
    f.g.position.copy(f.p); f.g.rotation.set(f.st === 'perch' ? 0 : -.2, f.yaw, 0, 'YXZ');
  });
}
// Las mariposas que Uku mira: la que se le posó en la mano o la más cercana a su cara
function flyOnHand() { const f = flies.find((x, i) => i < flyN && x.perch === 'hand' && x.st === 'perch'); return f ? f.p : null; }
function flyNear(head, max) {
  let best = null, bd = max;
  flies.forEach((f, i) => { if (i >= flyN || !f.g.visible) return; const d = f.p.distanceTo(head); if (d < bd) { bd = d; best = f.p; } });
  return best;
}

/* ---------- Uku: gestos, paseo, mirada y ojos ---------- */
// Gesto → [clip, velocidad, calma, duración en s, huesos fuera de la calma]: cada oso trae los suyos (rig.gest)
const NAMES = ['wave', 'happy', 'talk', 'nod', 'worried', 'plant'], ALIAS = { water: 'plant', hold: 'plant' };
let GEST = {}, IDLE = null, WALK = null, PLANT_AT = { hold: [1.6, 3.4], at: 3.4 };
// Conversando solo hace los gestos de pie: los que lo agachan (asentir, plantar) quedan para su mundo
const STANDING = { wave: 1, happy: 1, talk: 1 };
const BEAR_S = .58, WALK_V = .15; // Uku grande; pasea despacio (m/s)
let pos = { x: 0, z: 0 }, heading = 0, goal = null, idleFor = 3, acts = 0, speed = 0, turnTo = 0, moving = false, swayB = 0;
function clipFor() {
  if (gesture && GEST[gesture] && (!focus || STANDING[gesture])) return GEST[gesture];
  if (moving) return [WALK[0], WALK[1] * clamp(speed / WALK_V, .5, 1.1), WALK[2]];
  return IDLE;
}
// Pasear: elige un punto del claro, gira hacia él, camina despacio y se queda un rato mirando
function brain(dt) {
  const free = ambient === 'walk' && !front && !focus && !RM;
  if (gesture || !free) goal = null;
  if (front || focus) turnTo = 0;
  let want = 0;
  if (goal) {
    const dx = goal.x - pos.x, dz = goal.z - pos.z, d = Math.hypot(dx, dz), err = angDiff(Math.atan2(dx, dz), heading);
    heading += clamp(err, -dt * 1.5, dt * 1.5);
    want = Math.abs(err) < .5 ? WALK_V * Math.min(1, d / .15 + .3) : 0;
    if (d < .04) { goal = null; idleFor = 3.5 + Math.random() * 5; turnTo = (Math.random() - .5) * .9; }
  } else {
    heading += clamp(angDiff(turnTo, heading), -dt * .8, dt * .8);
    if (free && !gesture && (idleFor -= dt) <= 0) next();
  }
  speed = lerp(speed, want, Math.min(1, dt * 3));
  moving = speed > .03 || want > 0;
  pos.x += Math.sin(heading) * speed * dt; pos.z += Math.cos(heading) * speed * dt;
}
function next() {
  acts++;
  if ((fin.nuevo || fin.ahorro > 0 || (bloom || 0) > 0) && acts % 3 === 0) { play('plant'); idleFor = 2.5; return; }
  for (let i = 0; i < 12; i++) {
    const x = (Math.random() - .5) * 1.1, z = -.45 + Math.random() * .55; // delante quedan los canteros
    if (Math.hypot(x - pos.x, z - pos.z) > .25) { goal = { x, z }; return; }
  }
  idleFor = 2;
}
// Plantar: toma un brote de su lado, se agacha y lo deja en la tierra frente a él; el brote crece despacio
let plantedNow = false;
function plantStep() {
  if (gestureT > PLANT_AT.hold[0] && gestureT < PLANT_AT.hold[1] && !held) holdObject('sprout');
  if (gestureT >= PLANT_AT.at && !plantedNow) {
    plantedNow = true; holdObject(null);
    planted.push({ key: 'X' + plantN++, x: pos.x + Math.sin(heading) * .17, z: pos.z + Math.cos(heading) * .17, rot: Math.random() * 6.28 });
    if (planted.length > 6) planted.shift();
    buildForest();
  }
}
// Mirada: la cabeza (y un poco el cuello) siguen a una mariposa cercana, a algo del paisaje un rato o a ti
let glance = null, glanceT = 3, glanceFor = 0, lookY = 0, lookP = 0;
const _hp = new THREE.Vector3(), _lp = new THREE.Vector3(), _gl = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _au = new THREE.Vector3(), _ar = new THREE.Vector3();
function lookAround(dt) {
  if (!bones.head || !bones.neck) return;
  bones.head.getWorldPosition(_hp);
  let w = RM || moving || (gesture && !STANDING[gesture]) ? 0 : gesture === 'wave' ? .4 : 1, tgt = null;
  if (w) {
    tgt = flyOnHand();
    if (!tgt) {
      if (glance && (glanceFor -= dt) < 0) glance = null;
      if (!glance && (glanceT -= dt) < 0) {
        // de vez en cuando mira algo: una mariposa que pasa (la sigue un rato) o un punto del paisaje
        glanceT = 3 + Math.random() * 4; const r = Math.random(), fly = r < .4 && flyNear(_hp, 1.3);
        if (fly) { glance = fly; glanceFor = 1.5 + Math.random(); }
        else if (r < .75) { const s = Math.random() < .5 ? -1 : 1; glance = _gl.set(pos.x + s * (.7 + Math.random() * .6), .35 + Math.random() * .4, pos.z - .4 + Math.random() * .9); glanceFor = 1.2 + Math.random() * 1.4; }
      }
      tgt = glance || camera.position; if (!glance) w *= .6; // a ti te mira a medias: la clip ya mira al frente
    }
  }
  let y = 0, p = 0;
  if (tgt) {
    _lp.copy(tgt); bear.worldToLocal(_lp); _hp.copy(bear.worldToLocal(_hp)); _lp.sub(_hp);
    y = clamp(Math.atan2(_lp.x, _lp.z), -.5, .5); p = clamp(Math.atan2(_lp.y, Math.hypot(_lp.x, _lp.z)), -.22, .2); // giros suaves: nunca baja ni tuerce mucho la cabeza
  }
  lookY = lerp(lookY, y * w, Math.min(1, dt * 2.2)); lookP = lerp(lookP, p * w, Math.min(1, dt * 2.2));
  if (Math.abs(lookY) + Math.abs(lookP) < 1e-3) return;
  _au.set(0, 1, 0).applyQuaternion(bear.quaternion); _ar.set(1, 0, 0).applyQuaternion(bear.quaternion);
  [[bones.neck, .35], [bones.head, .65]].forEach(([b, k]) => {
    // giro en el mundo (alrededor del eje vertical y del lateral de Uku) llevado al espacio del hueso
    b.parent.getWorldQuaternion(_qp);
    _qa.setFromAxisAngle(_au, lookY * k).multiply(_qb.setFromAxisAngle(_ar, -lookP * k));
    b.quaternion.premultiply(_qa.premultiply(_qp.clone().invert()).multiply(_qp));
    b.updateMatrixWorld(true);
  });
}
/* Ojos y boca: piezas de la cara (rig.face). Pestañea cada pocos segundos (a veces dos seguidas), pone ojos
   contentos ^ ^ al alegrarse o cuando una mariposa se le posa, y mueve la boca al hablar. */
let eyeKind = 'open', blinkT = 2.5, happyFor = 0, mouthCur = 0;
function eyes(dt, t) {
  if (!rig || !rig.face) return;
  let k = 'open';
  if (gesture === 'happy' && gestureT > .25 && gestureT < 1.9) happyFor = Math.max(happyFor, .05);
  if (happyFor > 0) { happyFor -= dt; k = 'happy'; blinkT = Math.max(blinkT, .8); }
  else if (!RM && (blinkT -= dt) < 0) {
    // un pestañeo: entrecerrado, cerrado, entrecerrado (~0,2 s)
    const s = -blinkT; k = s < .05 ? 'half' : s < .15 ? 'shut' : s < .21 ? 'half' : 'open';
    if (s >= .21) blinkT = Math.random() < .18 ? .2 : 2.2 + Math.random() * 3.8;
  }
  if (k !== eyeKind) { eyeKind = k; rig.face.eyes(k); }
  // Boca: al hablar se abre y cierra como sílabas; contento, sonríe con la boca abierta
  const talking = gesture === 'talk' && gestureT < 2, m = RM ? 0 : talking ? Math.max(0, Math.sin(t * 13) * .6 + Math.sin(t * 7.3) * .4) : gesture === 'happy' && gestureT < 2 ? .7 : 0;
  mouthCur = lerp(mouthCur, m, Math.min(1, dt * 14));
  rig.face.mouth(mouthCur);
}

function holdObject(kind) {
  if (held) { held.parent && held.parent.remove(held); held = null; }
  if (!kind || !bones.hand_R || umb) return; // con el paraguas en la mano no sostiene otra cosa
  if (kind === 'coin') {
    held = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .014, 28), new THREE.MeshLambertMaterial({ color: '#ffd200' }));
    // sobre la palma: en reposo la palma mira a (0, -0.89, 0.45) en el espacio del hueso
    held.rotation.x = -.46; held.position.set(-.03, -.052, .026);
  } else if (kind === 'leaf') {
    held = new THREE.Mesh(new THREE.ConeGeometry(.035, .1, 4), new THREE.MeshLambertMaterial({ color: palette().pine[0], flatShading: true }));
    held.position.set(-.03, -.06, .03); held.rotation.set(-.46 + Math.PI, 0, -.4); // el tallo sale de la palma
  } else if (kind === 'sprout') {
    // el esqueleto está en centímetros: se escala para que el brote mida lo mismo que en la tierra
    held = new THREE.Mesh(geo('brote1', () => PARTS.brote(palette(), 1)), LAMB);
    const f = bones.hand_R.children[0]; held.scale.setScalar(1.1 / bones.hand_R.getWorldScale(_fu).x);
    if (f) held.position.copy(f.position); // entre los dedos, listo para plantar
  }
  held && bones.hand_R.add(held);
}

/* ---------- Ropa según el clima ----------
   Los accesorios cuelgan del hueso de la cabeza (en reposo está en
   (0, 0.64, 0) sin rotación; la cabeza llega hasta y .97, las orejas a .99,
   los ojos están en y .795 y el hocico llega a z .23), así siguen cada gesto. */
let acc = null, ropaCols = null, rain = null;
function mat(color, extra) { return new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra || {})); }
// La cabeza medida en el espacio de su hueso (al cargar, en reposo): medio ancho W, la coronilla y la punta del
// hocico. Los accesorios se ubican y se escalan con eso, así le quedan bien a cualquiera de los dos osos.
let HEAD = { W: .228, top: .358, front: .233 };
function measureHead() {
  if (!bones.head || !rig) return;
  bear.updateMatrixWorld(true);
  const v = new THREE.Vector3(), hw = bones.head.getWorldPosition(new THREE.Vector3()), b = { x0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  rig.skinned.forEach(m => {
    const p = m.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 4000));
    for (let i = 0; i < p.count; i += step) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld); if (v.y < hw.y) continue;
      bones.head.worldToLocal(v); b.x0 = Math.min(b.x0, v.x); b.x1 = Math.max(b.x1, v.x); b.y1 = Math.max(b.y1, v.y); b.z1 = Math.max(b.z1, v.z);
    }
  });
  if (isFinite(b.x0)) HEAD = { W: (b.x1 - b.x0) / 2, top: b.y1, front: b.z1 };
}
function hatPaja() {
  const g = new THREE.Group(), straw = mat('#e9dcb2'), band = mat('#2f2f2f');
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.2, .21, .01, 32), straw);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(.092, .108, .095, 24), straw); crown.position.y = .05;
  const top = new THREE.Mesh(new THREE.SphereGeometry(.092, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), straw); top.position.y = .097; top.scale.y = .25;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(.109, .111, .024, 24), band); ribbon.position.y = .017;
  g.add(brim, crown, top, ribbon);
  const W = HEAD.W; g.scale.setScalar(6.4 * W); g.position.set(0, HEAD.top - .06 * W, -.07 * W); g.rotation.set(-.12, 0, .06);
  return g;
}
function hatLana() {
  const g = new THREE.Group(), wool = mat('#2c4f9e'), cuff = mat('#efe9df'); // colores de marca: azul con blanco (nunca rojo)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.125, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), wool); cap.scale.y = .95;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.128, .13, .04, 24), cuff); rim.position.y = .01;
  const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(.038, 1), cuff); pom.position.y = .125;
  g.add(cap, rim, pom);
  const { W, top } = HEAD; g.scale.setScalar(7.7 * W); g.position.set(0, top - .62 * W, -.09 * W); g.rotation.x = -.1;
  return g;
}
/* Paraguas en la mano derecha: vive en la escena y cada cuadro se apoya en
   la palma y apunta a un punto sobre la cabeza (así cubre a Uku aunque el
   brazo se mueva). El mango se estira lo que haga falta. */
let umb = null;
function umbrella() {
  const g = new THREE.Group(), canopy = new THREE.Group(), cloth = mat('#1b2a4e', { side: THREE.DoubleSide }), stripe = mat('#ffd200', { side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) canopy.add(new THREE.Mesh(new THREE.ConeGeometry(.29, .11, 2, 1, true, i / 8 * Math.PI * 2, Math.PI / 4), i % 2 ? stripe : cloth));
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .06, 5), mat('#2f2f2f')); tip.position.y = .08; canopy.add(tip);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, 1, 5), mat('#2f2f2f'));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.03, .008, 6, 12, Math.PI), mat('#2f2f2f')); handle.rotation.z = Math.PI; handle.position.set(.03, -.02, 0);
  g.add(canopy, pole, handle);
  g.userData = { canopy, pole };
  return g;
}
const _h = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function placeUmbrella() {
  if (!umb || !bones.hand_R || !bones.head) return;
  bones.hand_R.getWorldPosition(_h); if (bones.hand_R.children[0]) _h.lerp(bones.hand_R.children[0].getWorldPosition(_t), .6); // centro de la pata
  bones.head.getWorldPosition(_t); _t.x = _h.x * .45; _t.y += .3; _t.z += .03; // sobre la cabeza, un poco hacia la mano
  _d.subVectors(_t, _h); const L = _d.length(); _d.normalize();
  umb.position.copy(_h); umb.quaternion.setFromUnitVectors(_up, _d);
  const u = umb.userData; u.pole.scale.y = L; u.pole.position.y = L / 2; u.canopy.position.y = L;
  u.canopy.quaternion.setFromUnitVectors(_d, _up); // la tela queda horizontal aunque el mango vaya inclinado
}
function shades() {
  const g = new THREE.Group(), lens = mat('#1e2126', { flatShading: false }), frame = mat('#111111');
  [-1, 1].forEach(s => {
    const l = new THREE.Mesh(new THREE.CircleGeometry(.034, 20), lens); l.position.set(s * .047, 0, 0); l.rotation.y = s * .18; g.add(l);
  });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(.028, .006, .004), frame); g.add(bridge);
  const { W, top, front } = HEAD; g.scale.setScalar(6.8 * W); g.position.set(0, top - .89 * W, front - .12 * W);
  return g;
}
// Guayabera: el suéter amarillo se repinta en lino claro (en el oso de siempre, su textura; en el de respaldo, los
// colores de sus vértices) y la bufanda se guarda
const LINO = [231, 220, 194];
let guayaMap = null, ropaMaps = null;
function guayaTex(baseMap) {
  const img = baseMap.image, c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data, W = c.width, H = c.height;
  // Máscara del suéter cerrada (dilatar y erosionar 6 px): así entran también
  // las líneas grises del zigzag, que quedan rodeadas de amarillo.
  const yel = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < a.length; i += 4, j++) { const r = a[i], g = a[i + 1], b = a[i + 2]; yel[j] = r > 140 && g > 120 && r - b > 70 ? 1 : 0; }
  const pass = (src, R, op) => {
    const h = new Uint8Array(W * H), v = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x0 = 0; x0 < W; x0++) {
      let m = op; for (let k = -R; k <= R; k++) { const xx = x0 + k; const val = xx < 0 || xx >= W ? 0 : src[y * W + xx]; m = op ? Math.min(m, val) : Math.max(m, val); }
      h[y * W + x0] = m;
    }
    for (let y = 0; y < H; y++) for (let x0 = 0; x0 < W; x0++) {
      let m = op; for (let k = -R; k <= R; k++) { const yy = y + k; const val = yy < 0 || yy >= H ? 0 : h[yy * W + x0]; m = op ? Math.min(m, val) : Math.max(m, val); }
      v[y * W + x0] = m;
    }
    return v;
  };
  const shirt = pass(pass(yel, 6, 0), 6, 1);
  for (let i = 0, j = 0; i < a.length; i += 4, j++) {
    if (shirt[j] && !yel[j]) { a[i] = 255; a[i + 1] = 210; a[i + 2] = 40; } // se pinta como suéter y abajo pasa a lino
    const r = a[i], g = a[i + 1], b = a[i + 2], l = (r + g + b) / 765;
    // lino parejo (sin el zigzag del suéter): apenas se conserva el sombreado
    if (r > 140 && g > 120 && r - b > 70) { const k = .95 + (l - .62) * .12; a[i] = 247 * k; a[i + 1] = 244 * k; a[i + 2] = 234 * k; }
    // la bufanda pasa a ser el cuello de la guayabera, del mismo lino
    else if (b > r + 35 && b > g + 5) { const k = .9 + (l - .3) * .1; a[i] = 240 * k; a[i + 1] = 236 * k; a[i + 2] = 224 * k; }
  }
  x.putImageData(d, 0, 0);
  guayaMap = new THREE.CanvasTexture(c);
  ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'anisotropy'].forEach(k => { guayaMap[k] = baseMap[k]; });
  return guayaMap;
}
function guayabera(on) {
  if (!rig) return;
  const buf = rig.skinned.find(m => m.name === 'bufanda'); if (buf) buf.visible = !on; // con calor, sin bufanda
  // El oso de siempre: las piezas con la textura de la ropa
  if (!ropaMaps) { ropaMaps = []; rig.root.traverse(o => { if (o.isMesh && o.material.map && /ropa/.test(o.material.map.name || '')) ropaMaps.push([o, o.material.map]); }); }
  if (ropaMaps.length) {
    ropaMaps.forEach(([o, m]) => { const t = on ? (guayaMap || guayaTex(m)) : m; if (o.material.map !== t) { o.material.map = t; o.material.needsUpdate = true; } });
    return;
  }
  const ropa = rig.skinned.find(m => m.name === 'ropa');
  if (!ropa || !ropa.geometry.attributes.color) return;
  const a = ropa.geometry.attributes.color, v = a.array, n = a.itemSize;
  if (!ropaCols) ropaCols = v.slice();
  for (let i = 0; i < a.count; i++) {
    const o = i * n;
    if (!on) { v[o] = ropaCols[o]; v[o + 1] = ropaCols[o + 1]; v[o + 2] = ropaCols[o + 2]; continue; }
    const f = (ropaCols[o + 2] > 60 ? .9 : 1) * Math.min(1, .82 + .18 * ropaCols[o] / 250);
    v[o] = LINO[0] * f; v[o + 1] = LINO[1] * f; v[o + 2] = LINO[2] * f;
  }
  a.needsUpdate = true;
}
function dressBear() {
  if (!bear || !bones.head) return;
  if (acc) { bones.head.remove(acc); acc.traverse(c => { c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }); }
  acc = new THREE.Group();
  if (look.hat === 'paja') acc.add(hatPaja());
  if (look.hat === 'lana') acc.add(hatLana());
  if (look.shades) acc.add(shades());
  bones.head.add(acc);
  if (umb && look.hat !== 'paraguas') { scene.remove(umb); umb.traverse(c => { c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }); umb = null; }
  if (!umb && look.hat === 'paraguas') { umb = umbrella(); scene.add(umb); }
  guayabera(look.shirt === 'guayabera');
  const lentes = rig.N('lentes'); if (lentes) lentes.visible = !look.shades; // con gafas de sol se guarda los lentes
}
function buildRain() {
  const n = 220, pos = new Float32Array(n * 6), r = rng(71);
  for (let i = 0; i < n; i++) {
    const x = (r() - .5) * 5, y = r() * 2.6, z = -r() * 3 + .8;
    pos.set([x, y, z, x - .01, y - .07, z], i * 6);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#9fb3c8', transparent: true, opacity: .55 }));
  rain.visible = false; scene.add(rain);
}
export function setLook(l) {
  const region = look.region;
  look = Object.assign({}, look, l || {});
  if (!scene) return;
  dressBear();
  if (rain) rain.visible = !!look.rain;
  if (region !== look.region) repaint();
}

/* ---------- Bucle ---------- */
let last = 0;
const MOOD_TINT = { feliz: new THREE.Color('#ffffff'), pensativo: new THREE.Color('#e1e6ef'), tranquilo: new THREE.Color('#ffffff') }, WHITE = new THREE.Color('#ffffff');
const _qs = new THREE.Quaternion(), _es = new THREE.Euler(), _cam = new THREE.Vector3();
function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!visible || !host) return;
  if (now - last < 32) return; // ~30 fps: suficiente y cuida batería
  last = now;
  const dt = Math.min(clock.getDelta(), .1), t = clock.elapsedTime;
  if (gesture && GEST[gesture]) { gestureT += dt; if (gestureT > GEST[gesture][3]) { gesture = null; gestureT = 0; holdObject(null); } }
  if (gesture === 'plant' && !focus) plantStep();
  // Mientras Uku carga, el bosque aparece solo: el puntaje sube hasta el de la persona en 2.2 s
  if (!bear && target != null) {
    const s2 = Math.round(Math.min(1, (performance.now() - loadAt) / 2200) * target);
    if (s2 !== score) { score = s2; buildForest(); }
  }
  moodTint.lerp(MOOD_TINT[mood] || WHITE, Math.min(1, dt * 2));
  if (ambLight) ambLight.color.copy(moodTint);
  if (bear) {
    if (bear.userData.grow < 1) { bear.userData.grow = Math.min(1, bear.userData.grow + dt * 1.2); bear.scale.setScalar(Math.max(.001, BEAR_S * (1 - Math.pow(1 - bear.userData.grow, 3)))); }
    brain(dt);
    const c = clipFor();
    rig.playClip(c[0], .8, { speed: c[1], calm: c[2], keep: c[4] });
    rig.update(dt);
    // Los pies siempre en el suelo (el rig apoya el pie más bajo); quieto, se mece apenas.
    // Sobre la esfera su eje vertical es la normal del planeta
    const still = !moving && !gesture && !RM && !focus;
    swayB = lerp(swayB, still ? Math.sin(t * .35) * .035 : 0, Math.min(1, dt * 2));
    surf(pos.x, pos.z, _sp);
    bear.position.copy(PLANET_C).addScaledVector(_sp, PLANET_R);
    // Sombra de contacto: lo asienta en el suelo
    shadow.position.copy(bear.position).addScaledVector(_sp, .004); shadow.quaternion.setFromUnitVectors(_nrm, _sp);
    shadow.scale.setScalar(bear.scale.x / BEAR_S * (gesture === 'plant' ? 1.15 : 1)); shadow.visible = !focus;
    bear.quaternion.setFromUnitVectors(_nrm, _sp).multiply(_yaw.setFromAxisAngle(_nrm, heading + swayB));
    bear.updateMatrixWorld(true);
    lookAround(dt);
    eyes(dt, t);
    if (umb) placeUmbrella();
  }
  if (forest) forest.children.slice().forEach(o => {
    const u = o.userData;
    if (u.delay > 0) { u.delay -= dt; return; }
    if ((u.dir > 0 && u.grow < 1) || (u.dir < 0 && u.grow > 0)) {
      u.grow = clamp(u.grow + u.dir * dt * (RM ? 10 : u.gs), 0, 1);
      // crece con un pequeño rebote (se pasa un poco y se asienta); se va encogiéndose sin rebote
      const g = u.grow, e = u.dir > 0 ? 1 + 2.2 * Math.pow(g - 1, 3) + 1.2 * Math.pow(g - 1, 2) : 1 - Math.pow(1 - g, 3);
      o.scale.setScalar(Math.max(.001, u.base * e));
      if (u.dir < 0 && u.grow <= 0) { forest.remove(o); return; }
    }
    // El viento: flores y brotes se mecen más que los árboles, cada uno a su ritmo
    if (u.sway && !RM) o.quaternion.copy(u.q0).multiply(_qs.setFromEuler(_es.set(Math.sin(t * .9 + u.ph * 5) * u.sway * .6, 0, Math.sin(t * 1.3 + u.ph * 3) * u.sway)));
    if (u.tick && !RM) u.tick(o, t);
  });
  if (fliesG) updateFlies(dt, t);
  if (petals) updatePetals(dt, t);
  if (dust && !RM) {
    const a = dust.geometry.attributes.position, sp = dust.userData.speed;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) + sp[i] * dt;
      if (y > 2.2) y = -.05;
      a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * .6 + i) * .0009);
    }
    a.needsUpdate = true;
  }
  if (rain && rain.visible && !RM) {
    const a = rain.geometry.attributes.position;
    for (let i = 0; i < a.count; i += 2) {
      let y = a.getY(i) - dt * 2.4;
      if (y < 0) y += 2.6;
      a.setY(i, y); a.setY(i + 1, y - .07);
    }
    a.needsUpdate = true;
  }
  // Giro: el dedo manda (con un pequeño rebote en los topes); a los 3 s vuelve de frente.
  // Con un mensaje o conversando, siempre de frente; en libertad la cámara orbita despacio alrededor de él
  if (!drag) { if (focus || performance.now() - idleAt > 3000) yawTo = focus ? 0 : (1 - frontAmt) * Math.sin(t * .07) * .45; else yawTo = Math.max(-1.13, Math.min(1.13, yawTo)); }
  yaw = RM ? yawTo : lerp(yaw, yawTo, Math.min(1, dt * (drag ? 14 : 2.5)));
  frontAmt = RM ? (front ? 1 : 0) : lerp(frontAmt, front ? 1 : 0, Math.min(1, dt * 1.6));
  const sway = RM || drag || focus ? 0 : Math.sin(t * .15) * (.12 + .18 * (1 - frontAmt));
  // Conversando, la cámara se acerca y lo mira a la cara; su mundo queda apagado detrás
  focusAmt = RM ? (focus ? 1 : 0) : lerp(focusAmt, focus ? 1 : 0, Math.min(1, dt * 4));
  // En libertad la cámara se aleja y sube un poco (se ve el horizonte del planeta); con un mensaje, Uku pasa a primer plano
  const free = (1 - frontAmt) * (1 - focusAmt);
  planoAmt = RM ? (plano ? 1 : 0) : lerp(planoAmt, plano ? 1 : 0, Math.min(1, dt * 2.2));
  const cd = camDist * (.66 - .1 * focusAmt) * zoomCur * (1 + .4 * free + .5 * planoAmt), ch = CAM_H * (.6 - .04 * focusAmt + .14 * free + .3 * planoAmt);
  // El encuadre (corrimiento) también se mueve con suavidad
  const sdt = Math.min(dt, .05);
  if (Math.abs(shiftCur.x - shiftTo.x) > 1e-4 || Math.abs(shiftCur.y - shiftTo.y) > 1e-4 || Math.abs(camVel.x) > 1e-4 || Math.abs(camVel.y) > 1e-4) {
    if (RM) { shiftCur.x = shiftTo.x; shiftCur.y = shiftTo.y; camVel.x = camVel.y = 0; } else { shiftCur.x = spring(shiftCur.x, shiftTo.x, 'x', sdt); shiftCur.y = spring(shiftCur.y, shiftTo.y, 'y', sdt); }
    applyShift();
  }
  if (Math.abs(zoomCur - zoomTo) > 1e-3 || Math.abs(camVel.z) > 1e-4) { if (RM) { zoomCur = zoomTo; camVel.z = 0; } else zoomCur = spring(zoomCur, zoomTo, 'z', sdt); }
  // La cámara acompaña a Uku por el claro: en libertad un poco menos (se le ve pasear), con un mensaje o conversando del todo
  folCur = lerp(folCur, front || focus ? 1 : .7, Math.min(1, dt * 1.5));
  const fx = pos.x * folCur, fz = pos.z * folCur, fy = groundY(fx, fz);
  camera.position.set(Math.sin(yaw) * cd + Math.cos(yaw) * sway + fx, ch + fy, Math.cos(yaw) * cd - Math.sin(yaw) * sway + fz);
  camera.up.set(0, 1, 0);
  camera.lookAt(fx, .32 + .04 * focusAmt + .1 * planoAmt + fy, fz);
  draw();
}

// El mundo es una ilustración plana; Uku va encima con su propia luz suave (como un muñeco de verdad),
// sin borrar la profundidad: lo que está delante de él lo sigue tapando
function draw() {
  renderer.render(scene, camera);
  renderer.autoClear = false; renderer.render(bearScene, camera); renderer.autoClear = true;
}
function resize() {
  if (!host) return;
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Encuadre: el oso siempre entra completo, más cerca en pantallas altas.
  camera.fov = camera.aspect < .8 ? 38 : 30;
  camDist = camera.aspect < .8 ? 3.4 : 3.6; // planeta: desde más lejos y más alto se ve el horizonte curvo
  // Escenario: data-shift corre el encuadre (fracción del ancho) para que Uku
  // no quede detrás del globo de texto.
  applyShift();
}
function applyShift() {
  if (!host) return;
  const w = host.clientWidth, h = host.clientHeight, sh = shiftCur.x, sv = shiftCur.y;
  if (!w || !h) return;
  if (Math.abs(sh) > 1e-4 || Math.abs(sv) > 1e-4) camera.setViewOffset(w, h, -w * sh, h * sv, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'b3d-canvas';
  scene = new THREE.Scene();
  const pal = palette();
  scene.background = null; // transparente: la máscara del contenedor funde la escena con la página
  scene.fog = new THREE.Fog(pal.bg, FOG_NEAR, 9.5); // el fondo del claro se aclara con la distancia, como en una ilustración
  camera = new THREE.PerspectiveCamera(30, 1, .05, 20);
  camera.position.set(0, .75, 2.6);
  // Ilustración: solo luz ambiente, colores planos sin sombreado
  ambLight = new THREE.AmbientLight('#ffffff', Math.PI); scene.add(ambLight);
  LAMB = new THREE.MeshLambertMaterial({ vertexColors: true });
  smokeM = new THREE.MeshBasicMaterial({ color: pal.dust, transparent: true, opacity: .85 });
  ground = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R, 160, 48, 0, Math.PI * 2, 0, .9), new THREE.MeshLambertMaterial({ color: pal.ground }));
  ground.position.copy(PLANET_C); scene.add(ground);
  // Uku tiene su escena con su luz: un cielo claro, un rebote del suelo y un sol suave arriba a la izquierda
  bearScene = new THREE.Scene();
  bearScene.add(new THREE.HemisphereLight('#ffffff', '#c9ccd6', 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 1.4); sun.position.set(-1.5, 3, 3); bearScene.add(sun);
  stage = new THREE.Group(); bearScene.add(stage); // el claro de Uku: arriba del planeta, sin giro
  shadow = new THREE.Mesh(new THREE.CircleGeometry(.17, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: dotTexture(), color: '#4e5870', transparent: true, opacity: .28, depthWrite: false, fog: false }));
  shadow.scale.set(1, 1, .8); shadow.visible = false; scene.add(shadow);
  clock = new THREE.Clock();
  import(OSO === 'nuevo' ? './uku-rig-nuevo.js' : './uku-rig.js').then(R => R.loadUkuGltf().then(g => [R, g])).then(([R, g]) => {
    rig = R.ukuFrom(g);
    GEST = rig.gest; IDLE = rig.gest.idle; WALK = rig.gest.walk; PLANT_AT = rig.gest.plantAt;
    // El modelo va dentro de un pivote apoyado en sus pies: el pivote es lo que camina (y crece desde el suelo).
    // Se escala a 0.9 m (la altura del oso anterior) y se centra en x y z.
    const model = g.scene, box = rig.box, mid = box.getCenter(new THREE.Vector3());
    const k = .9 / box.getSize(new THREE.Vector3()).y;
    model.scale.setScalar(k);
    model.position.set(-mid.x * k, -box.min.y * k, -mid.z * k);
    bear = new THREE.Group(); bear.add(model); bear.userData.grow = 0; bear.scale.setScalar(.001);
    bear.traverse(o => {
      if (o.isMesh) {
        o.frustumCulled = false;
        // Sus colores están en los vértices; la luz suave de su escena le da volumen
        // El de siempre: su textura tal cual, plana (sin luz), como una ilustración. El nuevo: colores en los
        // vértices y la luz suave de su escena
        const src = o.material;
        o.material = src.map ? new THREE.MeshBasicMaterial({ map: src.map, transparent: !!src.transparent, opacity: src.opacity, fog: false })
          : new THREE.MeshLambertMaterial({ vertexColors: !!o.geometry.attributes.color, color: o.geometry.attributes.color ? 0xffffff : src.color });
        src.dispose && src.dispose();
      }
    });
    stage.add(bear);
    if (target != null) { score = target; target = null; buildForest(); }
    // Lo que se sostiene, se pone o se atacha usa estos huesos
    bones.hand_R = rig.B('mixamorig:RightHand'); bones.head = rig.B('mixamorig:Head'); bones.headTop = rig.B('mixamorig:HeadTop_End'); bones.neck = rig.B('mixamorig:Neck');
    measureHead();
    dressBear();
    play('wave');
    readyFns.splice(0).forEach(f => { try { f(); } catch (e) {} });
  });
  const cv = renderer.domElement;
  cv.style.touchAction = 'pan-y'; // el scroll vertical de la página sigue funcionando
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y0: yawTo, moved: false, id: e.pointerId }; });
  cv.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 8) { drag.moved = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} }
    // ±65°: lo alto del claro está detrás del oso, así nunca queda un árbol delante de la cámara
    if (drag.moved) { const v = drag.y0 - dx * .011, L = 1.13; yawTo = Math.max(-L - .15, Math.min(L + .15, v)); idleAt = performance.now(); }
  });
  const end = e => {
    if (!drag) return;
    const moved = drag.moved; drag = null; idleAt = performance.now();
    if (moved) {
      // el arrastre no cuenta como toque (el portal del hub es un botón)
      const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, true), 400);
      return;
    }
    if (e.type === 'pointerup') { const z = onPick && pick(e); if (z) { play('nod'); onPick(z); return; } play(['wave', 'nod', 'happy'][Math.floor(Math.random() * 3)]); onTap && onTap(); }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  new ResizeObserver(resize).observe(document.documentElement);
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; });
  new MutationObserver(() => repaint()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  buildGarden(pal);
  buildForest();
  buildDust();
  buildRain();
  buildFlies();
  buildPetals();
  rain.visible = !!look.rain;
  raf = requestAnimationFrame(frame);
}
// Tema o región nuevos: se repinta todo con la paleta que toca
function repaint() {
  const p = palette(); scene.fog.color.set(p.bg); ground.material.color.set(p.ground);
  if (wingM) wingM.color.set(p.flower); if (petals) petals.material.color.set(p.flower); if (smokeM) smokeM.color.set(p.dust);
  buildForest(true);
}

export function setAmbient(name) { ambient = name || null; if (ambient === 'walk') idleFor = Math.min(idleFor, 1.5); }
/* play(gesto, { hold }): wave, happy, talk, nod, worried o plant (water y hold son plant: antes regaba,
   ahora planta un brote). walk lo pone a pasear; null lo deja quieto. */
export function play(name, opts) {
  name = ALIAS[name] || name;
  if (name === 'walk') { setAmbient('walk'); return; }
  gesture = NAMES.includes(name) ? name : null; gestureT = 0; plantedNow = false;
  if (gesture) goal = null;
  holdObject(opts && opts.hold !== 'can' ? opts.hold : null);
}
export function attach(el, opts) {
  if (!renderer) init();
  host = el;
  el.appendChild(renderer.domElement);
  if (opts && typeof opts.score === 'number') {
    // Antes de que Uku cargue, el bosque crece en vez de aparecer de golpe
    if (!bear) { target = opts.score; loadAt = performance.now(); score = 0; buildForest(); }
    else if (opts.score !== score) { score = opts.score; buildForest(); }
  }
  if (opts && opts.onTap) onTap = opts.onTap;
  if (opts && opts.onPick) onPick = opts.onPick;
  if (opts && opts.onReady) { if (bear) opts.onReady(); else readyFns.push(opts.onReady); }
  resize();
  attach._ro && attach._ro.disconnect();
  attach._ro = new ResizeObserver(resize); attach._ro.observe(el); // el contenedor cambia de alto al conversar
  if ('IntersectionObserver' in window) {
    attach._io && attach._io.disconnect();
    attach._io = new IntersectionObserver(es => { visible = es[0].isIntersecting && document.visibilityState === 'visible'; });
    attach._io.observe(el);
  }
}
export function setScore(s) { if (!bear && target != null) { target = s; return; } if (s !== score) { score = s; if (renderer) buildForest(); } }
export function setBloom(b) { b = b == null ? null : Math.max(0, Math.min(100, b)); if (b !== bloom) { bloom = b; if (renderer) buildForest(); } }
/* Lo que la persona tiene (PFM.finanzas()): { nuevo, ahorro, inversion, deudas: [{ clase, producto, institucion, saldo }] }.
   nuevo llena el claro de brotes; ahorro, de flores; inversion planta guayacanes; cada crédito pone lo que tienes gracias a él. */
export function setFinanzas(f) {
  f = f || {};
  fin = { nuevo: !!f.nuevo, ahorro: +f.ahorro || 0, inversion: +f.inversion || 0, deudas: Array.isArray(f.deudas) ? f.deudas : [],
    historia: Array.isArray(f.historia) ? f.historia.slice(0, 12) : null, sugerencias: f.sugerencias == null ? null : Math.max(0, +f.sugerencias || 0) };
  if (renderer) buildForest();
}
// Qué hay hoy en el claro (para explicarlo): lo que tienes por tus créditos, guayacanes, flores, brotes y mariposas
// Qué cosa del paisaje se tocó: su zona (ahorro, inversion, bosque o credito:casa…), o null si fue el cielo o Uku
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
function pick(e) {
  if (!forest || !host) return null;
  const r = renderer.domElement.getBoundingClientRect();
  _ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  _ray.setFromCamera(_ndc, camera);
  if (bear) { const hb = _ray.intersectObject(bear, true)[0]; if (hb) return null; } // Uku delante: el toque es para él
  const hit = _ray.intersectObjects(forest.children.filter(o => o.userData.zona && o.userData.dir > 0), true)[0];
  if (!hit) return null;
  let o = hit.object; while (o.parent && o.parent !== forest) o = o.parent;
  return o.userData.zona || null;
}
/* Dónde está cada zona en pantalla (px del contenedor) para poner sus etiquetas: [{ id, x, y, tiene }].
   id: ahorro, inversion, bosque o credito:<lo que tienes> (casa, carro, tienda…). */
const _za = new THREE.Vector3(), _zu = new THREE.Vector3();
export function lugares() {
  if (!forest || !host || !camera) return [];
  const w = host.clientWidth, h = host.clientHeight, out = [], f = finScene();
  const at = (o, up, id, tiene) => {
    _zu.set(0, 1, 0).applyQuaternion(o.quaternion); _za.copy(o.position).addScaledVector(_zu, up * o.userData.base).project(camera);
    if (_za.z > 1) return;
    const x = (_za.x + 1) / 2 * w, y = (1 - _za.y) / 2 * h;
    if (x > 8 && x < w - 8 && y > 8 && y < h - 8) out.push({ id, x, y, tiene });
  };
  const live = forest.children.filter(o => o.userData.dir > 0 && o.userData.grow > .5);
  const first = (re) => live.find(o => re.test(o.userData.key || ''));
  const bed = first(/^K/); if (bed) at(bed, .12, 'ahorro', f.flores > 0 || f.brotes);
  const inv = first(/^G/) || first(/^A/); if (inv) at(inv, inv.userData.crown ? .75 : .3, 'inversion', f.guayas > 0);
  live.filter(o => /^C/.test(o.userData.key || '')).forEach(o => at(o, .3, o.userData.zona, true));
  const tr = live.filter(o => /^T/.test(o.userData.key || '')).sort((a, b) => Math.abs(a.position.x) - Math.abs(b.position.x))[0];
  if (tr) at(tr, .8, 'bosque', true);
  return out;
}
export function contenido() { const f = finScene(); return { arboles: forest ? forest.children.filter(o => /^T/.test(o.userData.key || '') && o.userData.dir > 0).length : 0, props: f.props, guayacanes: f.guayas, flores: Math.round(f.flores / 100 * FLOWERS.length), brotes: f.brotes ? SPROUTS.length : 0, plantados: planted.length, mariposas: flyN }; }
/* Uku sale de su mundo para conversar: el bosque, el suelo y el polvo se apagan y queda él solo,
   nítido, sobre una foto borrosa de su mundo (snapshot). Al volver, todo reaparece. */
export function setFocus(on) {
  if (!!on === focus) return;
  focus = !!on;
  // Conversando no pasea: se queda contigo. Al volver a su mundo retoma lo que hacía.
  if (focus) { ambFocus = ambient; ambient = null; } else ambient = ambFocus;
  [forest, garden, ground, dust, rain, umb, fliesG].forEach(o => { if (o) o.visible = focus ? false : (o === rain ? !!look.rain : true); });
  if (scene) scene.fog.near = focus ? 1e4 : FOG_NEAR;
}
export function snapshot() {
  if (!renderer || !scene) return null;
  // La foto es de su mundo, sin él: Uku queda delante, nítido, no repetido en el fondo
  try { const sv = shadow.visible; shadow.visible = false; renderer.render(scene, camera); const u = renderer.domElement.toDataURL('image/png'); shadow.visible = sv; return u; } catch (e) { return null; }
}
// El encuadre se mueve con suavidad hacia su destino; con `instant` salta de una (antes de mostrarse)
export function setShift(f, fy, instant) { shiftTo = { x: +f || 0, y: +fy || 0 }; if (instant) { shiftCur.x = shiftTo.x; shiftCur.y = shiftTo.y; camVel.x = camVel.y = 0; if (camera) applyShift(); } }
// La cámara se aleja (z > 1) o se acerca; sirve para que la cara de Uku quepa donde hay sitio
// Plano general: la cámara se aleja y sube para que se vea el mundo de Uku entero (Mis finanzas)
export function setPlano(on) { plano = !!on; }
export function setZoom(z, instant) { zoomTo = Math.max(.8, Math.min(1.8, +z || 1)); if (instant) { zoomCur = zoomTo; camVel.z = 0; } }
// Primer plano (true): Uku se detiene, te mira y no pasea; libre (false): pasea y la cámara orbita
export function setFront(on) { front = !!on; }
// Dónde está su cara en pantalla (px del contenedor): centro, radio aproximado y el encuadre actual.
// Con esto, la app calcula un corrimiento para que nada le tape la cara.
const _h1 = new THREE.Vector3(), _h2 = new THREE.Vector3(), _camUp = new THREE.Vector3();
export function head() {
  if (!bear || !bones.head || !host || !camera) return null;
  const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return null;
  bones.head.getWorldPosition(_h1);
  const top = bones.headTop; if (top) top.getWorldPosition(_h2); else _h2.copy(_h1).add(_camUp.set(0, 1, 0).multiplyScalar(.2 * BEAR_S));
  _h1.project(camera); _h2.project(camera);
  const x1 = (_h1.x + 1) / 2 * w, y1 = (1 - _h1.y) / 2 * h, x2 = (_h2.x + 1) / 2 * w, y2 = (1 - _h2.y) / 2 * h;
  const r = Math.hypot(x2 - x1, y2 - y1) * .62; // la mitad de cuello a coronilla, con margen para las orejas
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, r, shiftX: shiftCur.x, shiftY: shiftCur.y, zoom: zoomCur, shiftToX: shiftTo.x, shiftToY: shiftTo.y, zoomTo };
}
export function setMood(m) { mood = ['feliz', 'tranquilo', 'pensativo'].includes(m) ? m : null; }
export function isReady() { return !!bear; }
export function detach(el) { if (host === el) { host = null; } }
export function supported() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
