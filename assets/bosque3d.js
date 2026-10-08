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
   - Pausa el render cuando no se ve y respeta prefers-reduced-motion.
   ===================================================================== */
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/jsm/loaders/GLTFLoader.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const D = THREE.MathUtils.degToRad;
const lerp = THREE.MathUtils.lerp;

let renderer, scene, camera, clock, host = null, raf = 0, visible = true;
let bear = null, bones = {}, forest, held = null, ground;
let score = 50, shown = 0; // shown: puntaje con el que está dibujado el bosque
let gesture = null, gestureT = 0, onTap = null;

/* ---------- Colores (claro / oscuro) ---------- */
function palette() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return dark ? {
    bg: '#1f1f1f', ground: '#2a2d2b', dry: '#33302b', trunk: '#4a4643', pine: ['#3d4f49', '#46594f', '#52645a'],
    round: ['#4b5a52', '#56655c'], rock: '#3a3c3e', grass: '#3f5047', flower: '#e6c200'
  } : {
    bg: '#f5f5f5', ground: '#dfe3dc', dry: '#e6e0d4', trunk: '#8a837c', pine: ['#93a69b', '#7f958a', '#a3b3a8'],
    round: ['#a9b8ab', '#98aa9d'], rock: '#c4c7c9', grass: '#b4c2b5', flower: '#ffd200'
  };
}

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

function makeTree(p, pal) {
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

function buildForest() {
  if (forest) { scene.remove(forest); forest.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); }); }
  const pal = palette();
  forest = new THREE.Group();
  ground.material.color.set(new THREE.Color(pal.dry).lerp(new THREE.Color(pal.ground), Math.min(1, score / 70)));
  // Cuántos árboles según el puntaje: 0 → solo tocones; 100 → bosque tupido.
  const nTrees = Math.round((score / 100) ** 1.2 * SPOTS.length);
  SPOTS.forEach((p, i) => {
    const o = i < nTrees ? makeTree(p, pal) : (i < nTrees + 6 && score < 60 ? makeStump(p, pal) : null);
    if (!o) return;
    o.userData.grow = i >= Math.round((shown / 100) ** 1.2 * SPOTS.length) ? 0 : 1; // los nuevos crecen
    o.scale.setScalar(o.userData.base * (o.userData.grow ? 1 : .001));
    forest.add(o);
  });
  DECOR.forEach(p => {
    const need = p.kind === 'flower' ? 70 : p.kind === 'grass' ? 30 : 0;
    if (score < need || p.t > score + 10) return;
    const o = makeDecor(p, pal); o.userData.grow = 0; o.scale.setScalar(.001); forest.add(o);
  });
  scene.add(forest);
  shown = score;
}

/* ---------- Oso: pose base y gestos ---------- */
const REST = {
  upperarm_L: [0, 0, -72], upperarm_R: [0, 0, 72], forearm_L: [0, -12, -8], forearm_R: [0, 12, 8],
  shoulder_L: [0, 0, -4], shoulder_R: [0, 0, 4]
};
function target(name, t) {
  const r = REST[name] ? REST[name].slice() : [0, 0, 0];
  const breath = Math.sin(t * 1.6) * 1.2;
  if (name === 'chest') r[0] += breath;
  if (name === 'head') { r[1] += Math.sin(t * .35) * 9; r[0] += Math.sin(t * .5) * 2; }
  if (name === 'spine') r[2] += Math.sin(t * .8) * 1.2;
  if (!gesture) return r;
  const k = gestureT, s = Math.sin;
  switch (gesture) {
    case 'wave':
      // brazo derecho apunta a -X: z negativo lo sube, y positivo lo trae al frente
      if (name === 'upperarm_R') return [0, 15, -25];
      if (name === 'forearm_R') return [0, 0, -75 + s(k * 9) * 25];
      if (name === 'head') return [0, -6, 6];
      break;
    case 'nod':
      if (name === 'head') return [12 + s(k * 7) * 10, 0, 0];
      break;
    case 'talk':
      if (name === 'head') return [s(k * 5) * 4, s(k * 1.7) * 6, s(k * 2.3) * 3];
      if (name === 'upperarm_R') return [0, 45, 50];
      if (name === 'forearm_R') return [0, 25, -45 + s(k * 4) * 15];
      break;
    case 'think':
      if (name === 'upperarm_R') return [0, 55, 52];
      if (name === 'forearm_R') return [0, 35, -115];
      if (name === 'head') return [10, -8, -8];
      break;
    case 'hold':
      if (name === 'upperarm_R') return [0, 50, 45];
      if (name === 'forearm_R') return [0, 30, -50];
      if (name === 'head') return [16, -14, 0];
      break;
    case 'happy':
      if (name === 'upperarm_L') return [0, 0, -18 + s(k * 8) * 8];
      if (name === 'upperarm_R') return [0, 0, 18 - s(k * 8) * 8];
      if (name === 'head') return [-6, 0, s(k * 6) * 8];
      break;
  }
  return r;
}
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulder_L', 'shoulder_R', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'thigh_L', 'thigh_R'];

function holdObject(kind) {
  if (held) { held.parent && held.parent.remove(held); held = null; }
  if (!kind || !bones.hand_R) return;
  if (kind === 'coin') {
    held = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .014, 28), new THREE.MeshStandardMaterial({ color: '#ffd200', metalness: .35, roughness: .45 }));
    held.rotation.x = Math.PI / 2; held.position.set(-.06, .03, .06); // delante de la pata (la mano derecha apunta a -X)
  } else if (kind === 'leaf') {
    held = new THREE.Mesh(new THREE.ConeGeometry(.035, .1, 4), new THREE.MeshLambertMaterial({ color: palette().pine[0], flatShading: true }));
    held.position.set(-.06, .05, .05); held.rotation.z = .6;
  }
  held && bones.hand_R.add(held);
}

/* ---------- Bucle ---------- */
let last = 0;
function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!visible || !host) return;
  if (now - last < 32) return; // ~30 fps: suficiente y cuida batería
  last = now;
  const dt = clock.getDelta(), t = clock.elapsedTime;
  if (gesture) { gestureT += dt; if (gestureT > (gesture === 'hold' ? 3.2 : 2)) { gesture = null; holdObject(null); } }
  if (bear) {
    const a = RM ? 1 : Math.min(1, dt * 7);
    BONES.forEach(n => {
      const b = bones[n]; if (!b) return;
      const g = target(n, RM ? 0 : t);
      b.rotation.x = lerp(b.rotation.x, D(g[0]), a);
      b.rotation.y = lerp(b.rotation.y, D(g[1]), a);
      b.rotation.z = lerp(b.rotation.z, D(g[2]), a);
    });
    const hop = gesture === 'happy' ? Math.abs(Math.sin(gestureT * 6)) * .05 : 0;
    bear.position.y = lerp(bear.position.y, .45 + hop, Math.min(1, dt * 10));
  }
  if (forest) forest.children.forEach(o => {
    if (o.userData.grow < 1) {
      o.userData.grow = Math.min(1, o.userData.grow + dt * (RM ? 10 : 1.4));
      const e = 1 - Math.pow(1 - o.userData.grow, 3);
      o.scale.setScalar(Math.max(.001, o.userData.base * e));
    }
  });
  if (!RM) { camera.position.x = Math.sin(t * .15) * .12; camera.lookAt(0, .55, 0); }
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
  camera.position.z = camera.aspect < .8 ? 3.1 : 2.6;
  camera.updateProjectionMatrix();
}

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'b3d-canvas';
  scene = new THREE.Scene();
  const pal = palette();
  scene.background = new THREE.Color(pal.bg);
  scene.fog = new THREE.Fog(pal.bg, 3.2, 6.5);
  camera = new THREE.PerspectiveCamera(30, 1, .05, 20);
  camera.position.set(0, .75, 2.6);
  scene.add(new THREE.HemisphereLight('#ffffff', '#9aa29c', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 1.4); sun.position.set(1.5, 3, 2); scene.add(sun);
  ground = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshLambertMaterial({ color: pal.ground }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  clock = new THREE.Clock();
  new GLTFLoader().load(new URL('./oso/oso.glb', import.meta.url).href, g => {
    bear = g.scene;
    bear.traverse(o => { if (o.isBone) bones[o.name] = o; if (o.isMesh) { o.frustumCulled = false; } });
    bear.position.y = .45; // pies sobre el suelo (el modelo va de -0.45 a 0.45)
    bear.scale.setScalar(1);
    scene.add(bear);
    play('wave');
  });
  renderer.domElement.addEventListener('pointerup', () => { play(['wave', 'nod', 'happy'][Math.floor(Math.random() * 3)]); onTap && onTap(); });
  new ResizeObserver(resize).observe(document.documentElement);
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; });
  new MutationObserver(() => { const p = palette(); scene.background.set(p.bg); scene.fog.color.set(p.bg); buildForest(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  buildForest();
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
export function detach(el) { if (host === el) { host = null; } }
export function supported() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
