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
  // Paleta onírica: tonos lavados, casi blancos, para que el oso (que
  // conserva sus colores) sea lo único nítido de la escena.
  return dark ? {
    bg: '#1f1f1f', ground: '#2b2c2c', dry: '#2f2e2c', trunk: '#4a4a4a', pine: ['#3f4744', '#454d4a', '#4c5451'],
    round: ['#474f4c', '#4f5754'], rock: '#3a3b3c', grass: '#434b47', flower: '#d9c25a', dust: '#ffffff'
  } : {
    bg: '#f6f6f5', ground: '#eceeeb', dry: '#efece6', trunk: '#cfcac4', pine: ['#d3dbd6', '#c8d2cc', '#dde3df'],
    round: ['#d9dfda', '#cfd7d1'], rock: '#e1e2e2', grass: '#d4dcd6', flower: '#f2d64b', dust: '#ffffff'
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
const REST_R = { upperarm: [0, 6, 70], forearm: [14, 16, 6], hand: [12, 8, 4], shoulder: [0, 0, 4] };
const REST = {};
Object.keys(REST_R).forEach(k => { REST[k + '_R'] = REST_R[k]; REST[k + '_L'] = mirror(REST_R[k]); });
const POSES = {
  // brazo derecho (el izquierdo se refleja si el gesto lo pide)
  wave:  t => ({ upperarm_R: [0, 22, -30], forearm_R: [-34, 12, -52 + Math.sin(t * 7) * 8], hand_R: [-29, 0, -6 + Math.sin(t * 9) * 14], head: [0, -6, 6] }),
  nod:   t => ({ head: [12 + Math.sin(t * 7) * 9, 0, 0] }),
  talk:  t => ({ upperarm_R: [0, 38, 50], forearm_R: [-48, 34, -18 + Math.sin(t * 4) * 10], hand_R: [-36, 6, -10 + Math.sin(t * 5) * 6],
                 upperarm_L: mirror([0, 20, 60]), forearm_L: mirror([10, 28, 8]), hand_L: mirror([10, 6, 4]),
                 head: [Math.sin(t * 5) * 3, Math.sin(t * 1.7) * 6, Math.sin(t * 2.3) * 3] }),
  think: t => ({ upperarm_R: [0, 52, 46], forearm_R: [-30, 42, -64], hand_R: [-24, 10, -18], head: [8, -7, -8] }),
  hold:  t => ({ upperarm_R: [0, 46, 50], forearm_R: [-62, 34, -36], hand_R: [-48, 4, -14], head: [14, -12, 0] }),
  happy: t => ({ upperarm_R: [0, 14, 18 - Math.sin(t * 8) * 6], forearm_R: [-30, 10, -28], hand_R: [-24, 0, -10],
                 upperarm_L: mirror([0, 14, 18 - Math.sin(t * 8) * 6]), forearm_L: mirror([-30, 10, -28]), hand_L: mirror([-24, 0, -10]),
                 head: [-6, 0, Math.sin(t * 6) * 7] })
};
function target(name, t) {
  let r = REST[name] ? REST[name].slice() : [0, 0, 0];
  // vida en reposo: respiración, mirada y un balanceo leve de brazos
  if (name === 'chest') r[0] += Math.sin(t * 1.6) * 1.2;
  if (name === 'head') { r[1] += Math.sin(t * .35) * 9; r[0] += Math.sin(t * .5) * 2; }
  if (name === 'spine') r[2] += Math.sin(t * .8) * 1.2;
  if (name === 'upperarm_R' || name === 'upperarm_L') r[1] += Math.sin(t * .9 + (name === 'upperarm_L' ? 1.5 : 0)) * 3;
  if (!gesture || !POSES[gesture]) return r;
  const g = POSES[gesture](gestureT)[name];
  return g || r;
}
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulder_L', 'shoulder_R', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R', 'thigh_L', 'thigh_R'];

function holdObject(kind) {
  if (held) { held.parent && held.parent.remove(held); held = null; }
  if (!kind || !bones.hand_R) return;
  if (kind === 'coin') {
    held = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .014, 28), new THREE.MeshStandardMaterial({ color: '#ffd200', metalness: .35, roughness: .45 }));
    // sobre la palma: en reposo la palma mira a (0, -0.89, 0.45) en el espacio del hueso
    held.rotation.x = -.46; held.position.set(-.03, -.052, .026);
  } else if (kind === 'leaf') {
    held = new THREE.Mesh(new THREE.ConeGeometry(.035, .1, 4), new THREE.MeshLambertMaterial({ color: palette().pine[0], flatShading: true }));
    held.position.set(-.03, -.06, .03); held.rotation.set(-.46 + Math.PI, 0, -.4); // el tallo sale de la palma
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
    const a = RM ? 1 : Math.min(1, dt * 4.5); // suavizado: entra y sale de cada gesto sin golpes
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
  if (dust && !RM) {
    const a = dust.geometry.attributes.position, sp = dust.userData.speed;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) + sp[i] * dt;
      if (y > 2.2) y = -.05;
      a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * .6 + i) * .0009);
    }
    a.needsUpdate = true;
  }
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
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'b3d-canvas';
  scene = new THREE.Scene();
  const pal = palette();
  scene.background = null; // transparente: la máscara del contenedor funde la escena con la página
  scene.fog = new THREE.Fog(pal.bg, 2.0, 5.2);
  camera = new THREE.PerspectiveCamera(30, 1, .05, 20);
  camera.position.set(0, .75, 2.6);
  scene.add(new THREE.HemisphereLight('#ffffff', '#9aa29c', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 1.4); sun.position.set(1.5, 3, 2); scene.add(sun);
  ground = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshLambertMaterial({ color: pal.ground }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  clock = new THREE.Clock();
  new GLTFLoader().load(new URL('./oso/oso.glb', import.meta.url).href, g => {
    bear = g.scene;
    bear.traverse(o => { if (o.isBone) { bones[o.name] = o; if (/^(upperarm|forearm|hand)_/.test(o.name)) o.rotation.order = 'YZX'; } if (o.isMesh) { o.frustumCulled = false; } });
    bear.position.y = .45; // pies sobre el suelo (el modelo va de -0.45 a 0.45)
    bear.scale.setScalar(1);
    scene.add(bear);
    play('wave');
  });
  renderer.domElement.addEventListener('pointerup', () => { play(['wave', 'nod', 'happy'][Math.floor(Math.random() * 3)]); onTap && onTap(); });
  new ResizeObserver(resize).observe(document.documentElement);
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; });
  new MutationObserver(() => { const p = palette(); scene.fog.color.set(p.bg); buildForest(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  buildForest();
  buildDust();
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
