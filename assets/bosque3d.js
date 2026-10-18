/* =====================================================================
   Bosque 3D del oso andino (módulo ES, se carga solo al abrir Mis
   finanzas o el chat).

   - Un único renderer WebGL que se "muda" al contenedor activo.
   - El oso (assets/oso/oso.glb) tiene un esqueleto de 20 huesos hecho
     a medida (ver respaldo/oso-fuente/rig.py): se anima por código,
     sin clips: respira, mira, saluda, asiente, piensa, habla, celebra
     y puede sostener objetos en la mano (hand_R).
   - El oso nunca cambia; el bosque crece con la salud financiera
     (0–100): de troncos y tierra seca a un bosque tupido.
   - Paleta sobria: grises, verdes apagados; el amarillo solo en flores.
   - setBloom() llena su campo de flores amarillas (ahorro) y setMood()
     le da un ánimo que se queda, como Duo: contento, tranquilo o pensativo.
   - Pausa el render cuando no se ve y respeta prefers-reduced-motion.
   - setLook() viste a Uku según el clima (assets/clima.js): en la costa
     palmeras y guayabera; sombrero de paja toquilla, gafas de sol, gorro
     de lana o paraguas (con lluvia).
   ===================================================================== */
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/jsm/loaders/GLTFLoader.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const D = THREE.MathUtils.degToRad;
const lerp = THREE.MathUtils.lerp;

let renderer, scene, camera, clock, host = null, raf = 0, visible = true;
let bear = null, bones = {}, forest, held = null, ground, planetSpeed = 0;
const _yAxis = new THREE.Vector3(0, 1, 0), _spinQ = new THREE.Quaternion();
let score = 50, shown = 0; // shown: puntaje con el que está dibujado el bosque
// bloom: flores amarillas del campo (0–100, ahorro); null = como antes (salen con el bosque)
// mood: ánimo que se queda (feliz, tranquilo, pensativo); null = solo los gestos
let bloom = null, mood = null;
let gesture = null, gestureT = 0, onTap = null;
let yaw = 0, yawTo = 0, camDist = 2.6, drag = null, idleAt = 0; // giro con el dedo

/* ---------- Colores (claro / oscuro) ---------- */
let look = { region: 'sierra', shirt: 'sueter', hat: null, shades: false, rain: false };
function palette() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (look.region === 'costa') return dark ? {
    bg: '#1f1f1f', ground: '#353329', dry: '#353329', trunk: '#4c5262', pine: ['#3c4659', '#434d61'], palm: ['#41506a', '#4a5872'],
    round: ['#465066', '#4e586e'], rock: '#3b3e46', grass: '#434b5c', flower: '#f2d64b', dust: '#ffffff'
  } : {
    bg: '#f6f6f5', ground: '#f6efd6', dry: '#f3ead0', trunk: '#b9c0cf', pine: ['#d2dae8', '#c5cfe2'], palm: ['#a9bad6', '#9aaed0', '#b6c5de'],
    round: ['#d8dfeb', '#cdd5e4'], rock: '#e3e5ea', grass: '#d0d8e6', flower: '#f2c94c', dust: '#ffffff'
  };
  // Paleta onírica: tonos lavados, casi blancos, para que el oso (que
  // conserva sus colores) sea lo único nítido de la escena.
  // Ilustración: solo azules, grises y amarillo (los colores de Uku)
  return dark ? {
    bg: '#1f1f1f', ground: '#2b2d33', dry: '#2f3036', trunk: '#4a4f5c', pine: ['#3c4659', '#434d61', '#4a5468'],
    round: ['#465066', '#4e586e'], rock: '#3a3c43', grass: '#434b5c', flower: '#f2d64b', dust: '#ffffff'
  } : {
    bg: '#f6f6f5', ground: '#eef0f4', dry: '#f0eff1', trunk: '#aeb6c7', pine: ['#c9d3e6', '#b9c6de', '#d6deec'],
    round: ['#c3cee3', '#d2dbea'], rock: '#d9dce4', grass: '#c4cee1', flower: '#f2c94c', dust: '#ffffff'
  };
}
/* ---------- Estilo ilustración 2D ----------
   Colores planos, sin sombreado (solo luz ambiente) y sin contornos: los
   elementos se separan por el tono, como en una ilustración vectorial. */

/* ---------- Bosque procedural ---------- */
// Posiciones fijas (semilla) para que el bosque no "salte" entre visitas.
function rng(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const SPOTS = (() => {
  const r = rng(11), out = [];
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = 1.1 + r() * 3.4;
    const x = Math.cos(a) * d, z = -Math.abs(Math.sin(a) * d) - .25 - r() * .8; // detrás del oso
    out.push({ x, z, s: .7 + r() * .7, t: r() * 100, kind: r() < .62 ? 'pine' : 'round', rot: r() * 6.28 });
  }
  return out.sort((a, b) => a.t - b.t);
})();
const DECOR = (() => {
  const r = rng(29), out = [];
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = .45 + r() * 2.2;
    out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d * .7 - .2, t: r() * 100, kind: r() < .45 ? 'grass' : r() < .7 ? 'rock' : 'flower', s: .6 + r() * .8 });
  }
  return out;
})();

const MEADOW = (() => {
  const r = rng(71), out = [];
  for (let i = 0; i < 44; i++) {
    const a = r() * Math.PI * 2, d = .38 + r() * 1.5;
    out.push({ x: Math.cos(a) * d * 1.2, z: Math.sin(a) * d * .55 + .1, t: r() * 100, s: .8 + r() * .5, rot: r() * 6.28 });
  }
  return out;
})();
function makeFlower(p, pal) {
  const g = new THREE.Group(), petal = new THREE.MeshLambertMaterial({ color: pal.flower }), stem = new THREE.MeshLambertMaterial({ color: pal.grass });
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.006, .007, .12, 4), stem); st.position.y = .06; g.add(st);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, m = new THREE.Mesh(new THREE.SphereGeometry(.018, 6, 4), petal); m.position.set(Math.cos(a) * .022, .125, Math.sin(a) * .022); m.scale.y = .5; g.add(m); }
  const c = new THREE.Mesh(new THREE.SphereGeometry(.012, 6, 4), new THREE.MeshLambertMaterial({ color: pal.trunk })); c.position.y = .13; g.add(c);
  g.position.set(p.x, 0, p.z); g.rotation.y = p.rot; g.userData.base = p.s; return g;
}

// Palmera: tronco curvo en segmentos y hojas largas que caen
function makePalm(p, pal) {
  const g = new THREE.Group(), trunkM = new THREE.MeshLambertMaterial({ color: pal.trunk, flatShading: true });
  const lean = .05 + (p.t % 7) / 70;
  let x = 0, y = 0;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(.03 - i * .002, .036 - i * .002, .16, 6), trunkM);
    x += lean * i * .12; y += .15;
    seg.position.set(x, y - .07, 0); seg.rotation.z = -lean * i * .7; g.add(seg);
  }
  const c = pal.palm[Math.floor(p.t) % pal.palm.length], leafM = new THREE.MeshLambertMaterial({ color: c, flatShading: true, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(.06, .5, 3), leafM);
    const holder = new THREE.Group(); holder.position.set(x, y + .02, 0); holder.rotation.y = i / 7 * Math.PI * 2;
    leaf.rotation.z = Math.PI / 2 + .55; leaf.position.x = .2; leaf.position.y = -.08; leaf.scale.z = .25;
    holder.add(leaf); g.add(holder);
  }
  const coco = new THREE.MeshLambertMaterial({ color: pal.trunk });
  [[.03, 0], [-.025, .02], [0, -.03]].forEach(([dx, dz]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.025, 6, 5), coco); m.position.set(x + dx, y - .03, dz); g.add(m); });
  g.position.set(p.x, 0, p.z); g.rotation.y = p.rot; g.userData.base = p.s;
  return g;
}
function makeTree(p, pal) {
  if (look.region === 'costa' && p.kind === 'pine') return makePalm(p, pal);
  const g = new THREE.Group();
  const trunkM = new THREE.MeshLambertMaterial({ color: pal.trunk });
  if (p.kind === 'pine') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, .35, 6), trunkM); trunk.position.y = .17; g.add(trunk);
    const c = pal.pine[Math.floor(p.t) % pal.pine.length];
    [[.32, .5, .45], [.25, .42, .72], [.17, .32, .95]].forEach(([r, h, y]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
      cone.position.y = y; g.add(cone);
    });
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.04, .055, .45, 6), trunkM); trunk.position.y = .22; g.add(trunk);
    const c = pal.round[Math.floor(p.t) % pal.round.length];
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 0), new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
    top.position.y = .62; top.scale.y = 1.1; g.add(top);
  }
  g.position.set(p.x, 0, p.z); g.rotation.y = p.rot; g.userData.base = p.s;
  return g;
}
function makeStump(p, pal) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .14, 6), new THREE.MeshLambertMaterial({ color: pal.trunk }));
  m.position.y = .07; g.add(m); g.position.set(p.x, 0, p.z); g.userData.base = p.s;
  return g;
}
function makeDecor(p, pal) {
  let m;
  if (p.kind === 'rock') { m = new THREE.Mesh(new THREE.DodecahedronGeometry(.07, 0), new THREE.MeshLambertMaterial({ color: pal.rock, flatShading: true })); m.position.y = .03; m.scale.y = .6; }
  else if (p.kind === 'grass') { m = new THREE.Mesh(new THREE.ConeGeometry(.04, .14, 4), new THREE.MeshLambertMaterial({ color: pal.grass, flatShading: true })); m.position.y = .07; }
  else {
    m = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .1, 4), new THREE.MeshLambertMaterial({ color: pal.grass })); st.position.y = .05; m.add(st);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(.025, 6, 4), new THREE.MeshLambertMaterial({ color: pal.flower })); fl.position.y = .1; m.add(fl);
  }
  const g = new THREE.Group(); g.add(m); g.position.set(p.x, 0, p.z); g.userData.base = p.s; return g;
}

/* El bosque se actualiza por diferencia: al cambiar el puntaje sólo crecen
   los árboles que faltan y se encogen los que sobran; nada se recrea de
   golpe, así cambiar de mes no parpadea. (full = rehacer, p. ej. al cambiar
   de tema claro/oscuro.) */
const groundTo = new THREE.Color();
function buildForest(full) {
  const pal = palette();
  if (!forest) { forest = new THREE.Group(); scene.add(forest); }
  if (full) {
    forest.children.slice().forEach(o => { forest.remove(o); o.traverse(c => { c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }); });
  }
  groundTo.set(pal.dry).lerp(new THREE.Color(pal.ground), Math.min(1, score / 70));
  if (full || !shown) ground.material.color.copy(groundTo);
  const want = {};
  // Cuántos árboles según el puntaje: 0 → solo tocones; 100 → bosque tupido.
  const nTrees = Math.round((score / 100) ** 1.2 * SPOTS.length);
  SPOTS.forEach((p, i) => {
    if (i < nTrees) want['T' + i] = () => makeTree(p, pal);
    else if (i < nTrees + 6 && score < 60) want['S' + i] = () => makeStump(p, pal);
  });
  // En la costa, dos palmeras cerca de Uku para que se lean a primera vista
  if (look.region === 'costa') [{ x: -.58, z: -.5, s: 1.05, t: 3, rot: .4 }, { x: .64, z: -.62, s: .95, t: 8, rot: 2.6 }]
    .forEach((p, i) => { want['P' + i] = () => makePalm(p, pal); });
  DECOR.forEach((p, i) => {
    if (p.kind === 'flower' && bloom != null) { if (p.t <= bloom) want['D' + i] = () => makeDecor(p, pal); return; }
    const need = p.kind === 'flower' ? 70 : p.kind === 'grass' ? 30 : 0;
    if (score >= need && p.t <= score + 10) want['D' + i] = () => makeDecor(p, pal);
  });
  // Con ahorro, el campo de Uku se llena de flores amarillas
  if (bloom != null) MEADOW.forEach((p, i) => { if (p.t < bloom - 8) want['F' + i] = () => makeFlower(p, pal); });
  const have = {};
  forest.children.forEach(o => { have[o.userData.key] = o; });
  Object.keys(have).forEach(k => { have[k].userData.dir = want[k] ? 1 : -1; });
  Object.keys(want).forEach(k => {
    if (have[k]) return;
    const o = want[k](); o.userData.key = k; o.userData.dir = 1;
    o.userData.grow = full ? 1 : 0; o.scale.setScalar(o.userData.base * (full ? 1 : .001));
    forest.add(o);
  });
  shown = score;
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

/* ---------- Oso: pose base y gestos ---------- */
/* Ejes: el brazo derecho apunta a -X (z+ lo baja, y+ lo lleva al frente);
   el izquierdo es su espejo. x es el giro sobre el propio eje del hueso
   (pronación/supinación): los huesos del brazo usan orden 'YZX', así el
   giro se aplica primero y no cambia hacia dónde dobla el codo.
   En la pose T la palma de la pata mira hacia abajo y un poco al frente
   (las garras quedan en la punta, del lado de abajo). Por eso:
   · reposo  → giro + (≈ +26°): la palma mira al muslo
   · saludar → giro − (≈ −63°): la palma mira al frente
   · sostener→ giro − grande: la palma mira arriba
   El giro se reparte entre antebrazo y muñeca (como el radio y el cúbito),
   así la piel de la muñeca no se retuerce. Ninguna articulación pasa de ~70°. */
function mirror(v) { return [v[0], -v[1], -v[2]]; }
// Sin desplazamiento de reposo: el brazo cuelga por aim() al cargar el modelo.
const REST_R = { upperarm: [0, 0, 0], forearm: [0, 0, 0], hand: [0, 0, 0], shoulder: [0, 0, 0] };
const REST = {};
Object.keys(REST_R).forEach(k => { REST[k + '_R'] = REST_R[k]; REST[k + '_L'] = mirror(REST_R[k]); });
const POSES = {
  // brazo derecho (el izquierdo se refleja si el gesto lo pide)
  wave:  t => ({ upperarm_R: [0, 22, -42], forearm_R: [-34, 12, -52 + Math.sin(t * 7) * 8], hand_R: [-29, 0, -6 + Math.sin(t * 9) * 14], head: [0, -6, 6] }),
  nod:   t => ({ head: [12 + Math.sin(t * 7) * 9, 0, 0] }),
  talk:  t => ({ upperarm_R: [0, 38, 38], forearm_R: [-48, 34, -18 + Math.sin(t * 4) * 10], hand_R: [-36, 6, -10 + Math.sin(t * 5) * 6],
                 upperarm_L: mirror([0, 20, 48]), forearm_L: mirror([10, 28, 8]), hand_L: mirror([10, 6, 4]),
                 head: [Math.sin(t * 5) * 3, Math.sin(t * 1.7) * 6, Math.sin(t * 2.3) * 3] }),
  think: t => ({ upperarm_R: [0, 52, 34], forearm_R: [-30, 42, -64], hand_R: [-24, 10, -18], head: [8, -7, -8] }),
  hold:  t => ({ upperarm_R: [0, 46, 38], forearm_R: [-62, 34, -36], hand_R: [-48, 4, -14], head: [14, -12, 0] }),
  // preocupado: manos juntas delante de la panza, cabeza gacha y ladeada
  worried: t => ({ upperarm_R: [0, 34, 36], forearm_R: [-46, 44, -26], hand_R: [-22, 8, -6],
                   upperarm_L: mirror([0, 34, 36]), forearm_L: mirror([-46, 44, -26]), hand_L: mirror([-22, 8, -6]),
                   head: [16, 0, 9 + Math.sin(t * 1.6) * 3] }),
  // caminar: piernas y brazos alternan; el paso lo da el movimiento de la escena
  // caminar: las piernas y los brazos se balancean en X (el eje de lado tras aim())
  walk:  t => ({ thigh_R: [Math.sin(t * 6) * 24, 0, 0], thigh_L: [-Math.sin(t * 6) * 24, 0, 0],
                 upperarm_R: [-Math.sin(t * 6) * 14, 0, 0], upperarm_L: [Math.sin(t * 6) * 14, 0, 0],
                 forearm_R: [-14 - Math.max(0, -Math.sin(t * 6)) * 8, 0, 0], forearm_L: [-14 - Math.max(0, Math.sin(t * 6)) * 8, 0, 0],
                 head: [0, 0, Math.sin(t * 6) * 2] }),
  happy: t => ({ upperarm_R: [0, 14, 6 - Math.sin(t * 8) * 6], forearm_R: [-30, 10, -28], hand_R: [-24, 0, -10],
                 upperarm_L: mirror([0, 14, 6 - Math.sin(t * 8) * 6]), forearm_L: mirror([-30, 10, -28]), hand_L: mirror([-24, 0, -10]),
                 head: [-6, 0, Math.sin(t * 6) * 7] })
};
const UMB_POSE = { upperarm_R: [0, 36, 12], forearm_R: [-100, 26, -30], hand_R: [-40, 4, -10] };
// Ánimos que se quedan (los gestos pasan por encima y vuelven a esto)
const MOODS = {
  feliz: t => ({ upperarm_R: [0, 12, 34], forearm_R: [-24, 12, -14], hand_R: [-20, 0, -6],
                 upperarm_L: mirror([0, 12, 34]), forearm_L: mirror([-24, 12, -14]), hand_L: mirror([-20, 0, -6]),
                 head: [-8, Math.sin(t * .6) * 10, Math.sin(t * 2.2) * 5] }),
  // pensativo: una mano en el mentón, la cabeza ladeada; te espera sin reproches
  pensativo: t => ({ upperarm_R: [-10, 50, 22], forearm_R: [-40, 140, -10], hand_R: [-30, 10, -6],
                     upperarm_L: mirror([0, 6, 70]), forearm_L: mirror([14, 8, 4]),
                     head: [-6, -10 + Math.sin(t * .4) * 6, 10] })
};
function target(name, t) {
  let r = REST[name] ? REST[name].slice() : [0, 0, 0];
  // vida en reposo: respiración, mirada y un balanceo leve de brazos
  if (name === 'chest') r[0] += Math.sin(t * 1.6) * 1.2;
  if (name === 'head') { r[1] += Math.sin(t * .35) * 9; r[0] += Math.sin(t * .5) * 2; }
  if (name === 'spine') r[2] += Math.sin(t * .8) * 1.2;
  if (name === 'upperarm_R' || name === 'upperarm_L') r[1] += Math.sin(t * .9 + (name === 'upperarm_L' ? 1.5 : 0)) * 3;
  // Con paraguas, el brazo derecho lo sostiene siempre (los gestos usan la cabeza y el otro brazo)
  if (look.hat === 'paraguas' && UMB_POSE[name]) { const u = UMB_POSE[name].slice(); u[2] += Math.sin(t * .9) * 2; return u; }
  if (!gesture || !POSES[gesture]) { const m = mood && MOODS[mood] && MOODS[mood](t)[name]; return m || r; }
  const g = POSES[gesture](gestureT)[name];
  return g || r;
}
const BEAR_S = .62, WALK_SPIN = .35; // Uku más pequeño para dejar lugar a las tarjetas; al caminar, el bosque gira (rad/s) como un planeta pequeño
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulder_L', 'shoulder_R', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R', 'thigh_L', 'thigh_R'];
// Nombres de la pose (arriba) → huesos del modelo nuevo, con el nombre que three.js
// les guarda (sin puntos). spine001 y spine002 son el torso medio y alto; "chest" es
// el alto, el que lleva cuello y hombros.
const BONE_NAME = { hips: 'hips', spine: 'spine001', chest: 'spine002', neck: 'neck', head: 'head',
  shoulder_L: 'shoulderL', shoulder_R: 'shoulderR', upperarm_L: 'upper_armL', upperarm_R: 'upper_armR',
  forearm_L: 'forearmL', forearm_R: 'forearmR', hand_L: 'handL', hand_R: 'handR', thigh_L: 'thighL', thigh_R: 'thighR' };
// Reposo de cada hueso: la pose se suma sobre él (el modelo no trae reposo en identidad)
const REST_Q = {}, REST_PARENT_Q = {};
const _rx = new THREE.Vector3(1, 0, 0);
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _tq = new THREE.Quaternion(), _v = new THREE.Vector3();
// Los huesos del modelo nuevo van a lo largo de su eje Y y en T. aim() deja el brazo
// colgando (Y hacia abajo) con X de lado, para que doblar en X sea el codo y abrir en Z
// sea el brazo hacia afuera. El lado izquierdo queda reflejado. (Las piernas se dejan
// en su reposo original: calibrarlas así desplomaba el cuerpo.)
function aim(key) {
  const b = bones[key]; if (!b || !b.parent) return;
  const qw = b.getWorldQuaternion(new THREE.Quaternion()), qp = b.parent.getWorldQuaternion(new THREE.Quaternion());
  // 1) el eje largo (Y) apunta hacia abajo
  const drop = new THREE.Quaternion().setFromUnitVectors(_v.set(0, 1, 0).applyQuaternion(qw), new THREE.Vector3(0, -1, 0));
  // 2) el eje X queda de lado (+X en el derecho, −X en el izquierdo) girando sobre Y
  const x = new THREE.Vector3(1, 0, 0).applyQuaternion(qw).applyQuaternion(drop);
  const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(x.z, x.x) + (key.endsWith('_L') ? Math.PI : 0));
  // 3) de mundo al espacio del hueso padre
  const local = qp.invert().multiply(spin).multiply(drop).multiply(qw);
  b.quaternion.copy(local); REST_Q[key] = local.clone();
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
  }
  held && bones.hand_R.add(held);
}


/* ---------- Ropa según el clima ----------
   Los accesorios cuelgan del hueso de la cabeza (en reposo está en
   (0, 0.67, 0) sin rotación; la cabeza llega de y .71 a .90 y el hocico a
   z .17), así siguen cada gesto. */
let acc = null, baseMap = null, guayaMap = null, bearMat = null, rain = null;
function mat(color, extra) { return new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra || {})); }
function hatPaja() {
  const g = new THREE.Group(), straw = mat('#e9dcb2'), band = mat('#2f2f2f');
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.2, .21, .01, 32), straw);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(.092, .108, .095, 24), straw); crown.position.y = .05;
  const top = new THREE.Mesh(new THREE.SphereGeometry(.092, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), straw); top.position.y = .097; top.scale.y = .25;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(.109, .111, .024, 24), band); ribbon.position.y = .017;
  g.add(brim, crown, top, ribbon);
  g.position.set(0, .225, -.01); g.rotation.set(-.12, 0, .06);
  return g;
}
function hatLana() {
  const g = new THREE.Group(), wool = mat('#2c4f9e'), cuff = mat('#efe9df'); // colores de marca: azul con blanco (nunca rojo)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.125, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), wool); cap.scale.y = .95;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.128, .13, .04, 24), cuff); rim.position.y = .01;
  const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(.038, 1), cuff); pom.position.y = .125;
  g.add(cap, rim, pom);
  g.position.set(0, .185, -.01); g.rotation.x = -.1;
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
  bones.hand_R.localToWorld(_h.set(-.03, -.05, .03)); // centro de la palma
  bones.head.getWorldPosition(_t); _t.x = _h.x * .45; _t.y += .37; _t.z += .03; // sobre la cabeza, un poco hacia la mano
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
  g.position.set(0, .132, .142);
  return g;
}
// Guayabera: el suéter amarillo (y la bufanda azul) se repintan en lino claro
function guayabera() {
  if (guayaMap || !baseMap || !baseMap.image) return guayaMap;
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
  guayaMap.flipY = baseMap.flipY; guayaMap.colorSpace = baseMap.colorSpace;
  guayaMap.wrapS = baseMap.wrapS; guayaMap.wrapT = baseMap.wrapT; guayaMap.anisotropy = baseMap.anisotropy;
  return guayaMap;
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
  if (bearMat) {
    const m = look.shirt === 'guayabera' ? guayabera() : baseMap;
    if (m && bearMat.map !== m) { bearMat.map = m; bearMat.needsUpdate = true; }
  }
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
  if (region !== look.region) { const p = palette(); scene.fog.color.set(p.bg); buildForest(true); }
}

/* ---------- Bucle ---------- */
let last = 0;
function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!visible || !host) return;
  if (now - last < 32) return; // ~30 fps: suficiente y cuida batería
  last = now;
  const dt = clock.getDelta(), t = clock.elapsedTime;
  if (gesture) { gestureT += dt; if (gesture !== 'walk' && gestureT > (gesture === 'hold' ? 3.2 : 2)) { gesture = null; holdObject(null); } }
  if (bear) {
    const a = RM ? 1 : Math.min(1, dt * 4.5); // suavizado: entra y sale de cada gesto sin golpes
    BONES.forEach(n => {
      const b = bones[n]; if (!b) return;
      const g = target(n, RM ? 0 : t);
      if (REST_PARENT_Q[n]) {
        // pierna: el giro en X del mundo, llevado al espacio del hueso padre
        _q.setFromAxisAngle(_rx, D(g[0]));
        _tq.copy(REST_PARENT_Q[n]).invert().multiply(_q).multiply(REST_PARENT_Q[n]).multiply(REST_Q[n]);
      } else {
        _e.set(D(g[0]), D(g[1]), D(g[2]), b.rotation.order);
        _tq.copy(REST_Q[n]).multiply(_q.setFromEuler(_e));
      }
      b.quaternion.slerp(_tq, a);
    });
    if (umb) { bear.updateMatrixWorld(true); placeUmbrella(); }
    const hop = gesture === 'happy' ? Math.abs(Math.sin(gestureT * 6)) * .05 : mood === 'feliz' && !gesture && !RM ? Math.abs(Math.sin(t * 2.4)) * .018 : 0;
    bear.position.y = lerp(bear.position.y, .45 * BEAR_S + hop, Math.min(1, dt * 10));
    bear.position.x = lerp(bear.position.x, 0, Math.min(1, dt * 3));
  }
  // Caminando: el oso se queda en su sitio y el bosque y el suelo giran bajo él,
  // como un planeta pequeño; sin fin mientras camine, y se frena al parar
  planetSpeed = lerp(planetSpeed, gesture === 'walk' && !RM ? WALK_SPIN : 0, Math.min(1, dt * 2));
  if (Math.abs(planetSpeed) > 1e-4) {
    _spinQ.setFromAxisAngle(_yAxis, planetSpeed * dt);
    if (forest) forest.quaternion.premultiply(_spinQ);
    if (ground) ground.quaternion.premultiply(_spinQ);
  }
  if (forest) forest.children.slice().forEach(o => {
    const u = o.userData;
    if ((u.dir > 0 && u.grow < 1) || (u.dir < 0 && u.grow > 0)) {
      u.grow = Math.max(0, Math.min(1, u.grow + u.dir * dt * (RM ? 10 : 1.4)));
      const e = 1 - Math.pow(1 - u.grow, 3);
      o.scale.setScalar(Math.max(.001, u.base * e));
      // solo se quita lo que se está yendo (lo nuevo también parte en 0)
      if (u.dir < 0 && u.grow <= 0) { forest.remove(o); o.traverse(c => { c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }); }
    }
  });
  if (ground) ground.material.color.lerp(groundTo, Math.min(1, dt * 2));
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
  if (!drag) { if (performance.now() - idleAt > 3000) yawTo = 0; else yawTo = Math.max(-1.13, Math.min(1.13, yawTo)); }
  yaw = RM ? yawTo : lerp(yaw, yawTo, Math.min(1, dt * (drag ? 14 : 2.5)));
  const sway = RM || drag ? 0 : Math.sin(t * .15) * .12;
  camera.position.set(Math.sin(yaw) * camDist + Math.cos(yaw) * sway, .75, Math.cos(yaw) * camDist - Math.sin(yaw) * sway);
  camera.lookAt(0, .55, 0);
  renderer.render(scene, camera);
}

function resize() {
  if (!host) return;
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Encuadre: el oso siempre entra completo, más cerca en pantallas altas.
  camera.fov = camera.aspect < .8 ? 38 : 30;
  camDist = camera.aspect < .8 ? 3.1 : 2.6;
  // Escenario: data-shift corre el encuadre (fracción del ancho) para que Uku
  // no quede detrás del globo de texto.
  const sh = parseFloat(host.dataset.shift || 0);
  if (sh) camera.setViewOffset(w, h, -w * sh, 0, w, h); else camera.clearViewOffset();
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
  scene.fog = new THREE.Fog(pal.bg, 2.4, 7.5); // el bosque se aclara con la distancia, como en una ilustración
  camera = new THREE.PerspectiveCamera(30, 1, .05, 20);
  camera.position.set(0, .75, 2.6);
  // Ilustración: solo luz ambiente, colores planos sin sombreado
  scene.add(new THREE.AmbientLight('#ffffff', Math.PI));
  ground = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshLambertMaterial({ color: pal.ground }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  clock = new THREE.Clock();
  new GLTFLoader().load(new URL('./oso/oso.glb', import.meta.url).href, g => {
    // El modelo va dentro de un pivote: el pivote es lo que camina, respira y salta.
    // Se escala a la altura del oso anterior (−0.45 a 0.45) y se centra en x y z.
    // La caja sale de la geometría en reposo (no de la piel, que aún no tiene pose)
    const model = g.scene, mesh = model.getObjectByProperty('isSkinnedMesh', true);
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox, mid = box.getCenter(new THREE.Vector3());
    const k = .9 / box.getSize(new THREE.Vector3()).y;
    model.scale.setScalar(k);
    model.position.set(-mid.x * k, -.45 - box.min.y * k, -mid.z * k);
    bear = new THREE.Group(); bear.add(model);
    const byName = {};
    bear.traverse(o => { if (o.isBone) byName[o.name] = o; });
    Object.keys(BONE_NAME).forEach(key => {
      const b = byName[BONE_NAME[key]]; if (!b) return;
      bones[key] = b; REST_Q[key] = b.quaternion.clone();
      if (/^(upperarm|forearm|hand)_/.test(key)) b.rotation.order = 'YZX';
    });
    bear.updateMatrixWorld(true);
    ['upperarm_R', 'upperarm_L'].forEach(aim);
    // Piernas: sin calibrar (su reposo es el del archivo); el giro de caminar se hace sobre el eje de lado del mundo
    ['thigh_R', 'thigh_L'].forEach(key => { const b = bones[key]; if (b && b.parent) { REST_PARENT_Q[key] = b.parent.getWorldQuaternion(new THREE.Quaternion()); } });
    bear.traverse(o => {
      if (o.isMesh) {
        o.frustumCulled = false;
        // Color plano: la textura tal cual, sin luz ni sombras
        const src = o.material, flat = new THREE.MeshBasicMaterial({ map: src.map || null, color: src.map ? 0xffffff : (src.color || 0xffffff), transparent: !!src.transparent, opacity: src.opacity, fog: false });
        o.material = flat; src.dispose && src.dispose();
        if (flat.map) { bearMat = flat; baseMap = flat.map; }
      }
    });
    bear.position.y = .45 * BEAR_S; // pies sobre el suelo (el modelo va de -0.45 a 0.45)
    bear.scale.setScalar(BEAR_S);
    scene.add(bear);
    dressBear();
    play('wave');
  });
  const cv = renderer.domElement;
  cv.style.touchAction = 'pan-y'; // el scroll vertical de la página sigue funcionando
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y0: yawTo, moved: false, id: e.pointerId }; });
  cv.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 8) { drag.moved = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} }
    // ±65°: el bosque está detrás del oso, así nunca queda un árbol delante de la cámara
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
    if (e.type === 'pointerup') { play(['wave', 'nod', 'happy'][Math.floor(Math.random() * 3)]); onTap && onTap(); }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  new ResizeObserver(resize).observe(document.documentElement);
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; });
  new MutationObserver(() => { const p = palette(); scene.fog.color.set(p.bg); buildForest(true); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  buildForest();
  buildDust();
  buildRain();
  
  rain.visible = !!look.rain;
  raf = requestAnimationFrame(frame);
}

export function play(name, opts) {
  gesture = name; gestureT = 0;
  holdObject(opts && opts.hold);
}
export function attach(el, opts) {
  if (!renderer) init();
  host = el;
  el.appendChild(renderer.domElement);
  if (opts && typeof opts.score === 'number' && opts.score !== score) { score = opts.score; buildForest(); }
  if (opts && opts.onTap) onTap = opts.onTap;
  resize();
  if ('IntersectionObserver' in window) {
    attach._io && attach._io.disconnect();
    attach._io = new IntersectionObserver(es => { visible = es[0].isIntersecting && document.visibilityState === 'visible'; });
    attach._io.observe(el);
  }
}
export function setScore(s) { if (s !== score) { score = s; if (renderer) buildForest(); } }
export function setBloom(b) { b = b == null ? null : Math.max(0, Math.min(100, b)); if (b !== bloom) { bloom = b; if (renderer) buildForest(); } }
export function setMood(m) { mood = MOODS[m] || m === 'tranquilo' ? m : null; }
export function detach(el) { if (host === el) { host = null; } }
export function supported() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
