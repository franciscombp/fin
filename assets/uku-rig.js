/* =====================================================================
   Uku: el modelo con rig (assets/oso/uku-rig.glb). Este módulo sólo carga
   y controla el personaje; la escena (bosque, flores, planeta) la arma
   bosque3d.js, que lo usa como su único oso.
   - ukuFrom(gltf): huesos, piezas, clips (crossfade), parpadeo, expresiones
     (target_0…19) e IK de dos huesos para manos y pies (ik_* y pole_*).
   - loadUkuRig(container): visor independiente para verificar el modelo.
   Unidad = 1 m; el cuerpo mide 1.70.
   ===================================================================== */
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/jsm/loaders/GLTFLoader.js';

export const UKU_URL = './oso/uku-rig.glb';
// Cadenas de dos huesos: el extremo (end) es la mano o el pie; el objetivo y el polo son controles
const CHAINS = [
  { name: 'brazo.L', upper: 'upper_arm.L', fore: 'forearm.L', end: 'hand.L', target: 'ik_hand.L', pole: 'pole_elbow.L' },
  { name: 'brazo.R', upper: 'upper_arm.R', fore: 'forearm.R', end: 'hand.R', target: 'ik_hand.R', pole: 'pole_elbow.R' },
  { name: 'pierna.L', upper: 'thigh.L', fore: 'shin.L', end: 'foot.L', target: 'ik_foot.L', pole: 'pole_knee.L' },
  { name: 'pierna.R', upper: 'thigh.R', fore: 'shin.R', end: 'foot.R', target: 'ik_foot.R', pole: 'pole_knee.R' },
];
const BLINK_BONES = ['eye.L', 'eye.R'];
// three.js guarda los nombres sin puntos ni corchetes ("hand.L" -> "handL")
const key = (n) => n.replace(/[\[\].:\/]/g, '');
const NEEDED = [...new Set(CHAINS.flatMap(c => [c.upper, c.fore, c.end, c.target, c.pole]).concat(BLINK_BONES, ['hips_01', 'head_06', 'hand.R']))].map(key);

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3();
const _d1 = new THREE.Vector3(), _ap = new THREE.Vector3(), _e = new THREE.Vector3();
const _q = new THREE.Quaternion(), _w = new THREE.Quaternion(), _pw = new THREE.Quaternion();

export function loadUkuGltf() {
  return new Promise((ok, fail) => new GLTFLoader().load(new URL(UKU_URL, import.meta.url).href, ok, undefined, fail));
}

// Gira un hueso (en el mundo) para que su dirección vaya de `from` a `to`, pivotando en su origen
function aim(bone, from, to) {
  _q.setFromUnitVectors(from.normalize(), to.normalize());
  bone.getWorldQuaternion(_w);
  bone.parent.getWorldQuaternion(_pw);
  bone.quaternion.copy(_pw.invert().multiply(_q).multiply(_w));
  bone.updateMatrixWorld(true);
}

// IK analítico de dos huesos: el extremo llega al objetivo y el codo/rodilla mira al polo
function solveChain(ch, bones, nodes) {
  const up = bones[key(ch.upper)], fo = bones[key(ch.fore)], en = bones[key(ch.end)], tg = nodes[key(ch.target)], pl = nodes[key(ch.pole)];
  if (!up || !fo || !en || !tg || !pl) return;
  up.getWorldPosition(_a); fo.getWorldPosition(_b); en.getWorldPosition(_c); tg.getWorldPosition(_t); pl.getWorldPosition(_p);
  // El control se mide desde su posición de reposo: en reposo la mano queda donde está, y se mueve con el control
  _t.sub(ch.off);
  const L1 = _a.distanceTo(_b), L2 = _b.distanceTo(_c);
  _d1.subVectors(_t, _a);
  const d = THREE.MathUtils.clamp(_d1.length(), 1e-4, (L1 + L2) * .9999);
  const dir = _d1.clone().normalize();
  const proj = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - proj * proj));
  _ap.subVectors(_p, _a);
  const perp = _ap.clone().addScaledVector(dir, -_ap.dot(dir)).normalize();
  const elbow = _a.clone().addScaledVector(dir, proj).addScaledVector(perp, h);
  aim(up, _b.clone().sub(_a), elbow.clone().sub(_a));
  fo.getWorldPosition(_e); en.getWorldPosition(_c);
  aim(fo, _c.clone().sub(_e), _t.clone().sub(_e));
}

/* Sobre un GLTF ya cargado: huesos, piezas, clips y controles. No crea render ni escena. */
export function ukuFrom(gltf, { onLog = () => {} } = {}) {
  const root = gltf.scene;
  const report = { errors: [], warnings: [] };
  const skinned = []; const bones = {}; const nodes = {};
  root.traverse(o => {
    if (o.isSkinnedMesh) skinned.push(o);
    if (o.isBone) bones[o.name] = o;
    nodes[o.name] = nodes[o.name] || o;
  });
  NEEDED.forEach(n => { if (!bones[n] && !nodes[n]) report.errors.push('hueso inexistente: ' + n); });

  // El cuerpo es la pieza más alta (la boca y la ropa siguen al esqueleto)
  const hOf = (m) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox.max.y - m.geometry.boundingBox.min.y; };
  const body = skinned.reduce((a, m) => (hOf(m) > hOf(a) ? m : a), skinned[0]);
  const morphMesh = skinned.find(m => m.morphTargetDictionary && Object.keys(m.morphTargetDictionary).length) || null;
  const morphs = morphMesh ? Object.keys(morphMesh.morphTargetDictionary) : [];
  if (!morphs.length) report.warnings.push('ningún morph target en el archivo');
  onLog('Piezas: ' + skinned.map(m => m.name + ' ' + hOf(m).toFixed(3) + ' m').join(', '));

  // Mixer y clips con crossfade
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  gltf.animations.forEach(c => { actions[c.name] = mixer.clipAction(c); });
  let current = null;
  function playClip(name, fade = .4) {
    const next = actions[name];
    if (!next) { report.errors.push('clip inexistente: ' + name); return false; }
    if (current === next) return true;
    next.reset().fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = next;
    return true;
  }

  // Parpadeo: el morph "blink" no existe; se cierran los ojos escalando sus huesos
  const eyeRest = BLINK_BONES.map(n => bones[key(n)] ? bones[key(n)].scale.clone() : null);
  let blink = 0;
  function setBlink(v) { blink = THREE.MathUtils.clamp(v, 0, 1); }
  function applyBlink() {
    BLINK_BONES.forEach((n, i) => {
      const b = bones[key(n)], r = eyeRest[i]; if (!b || !r) return;
      b.scale.set(r.x, r.y * (1 - blink * .9), r.z);
    });
  }

  // Expresiones: influencia de un morph target del cuerpo (target_0 … target_19)
  function setExpression(name, v) {
    const idx = morphMesh && morphMesh.morphTargetDictionary[name];
    if (idx === undefined) { report.warnings.push('expresión inexistente: ' + name); return false; }
    morphMesh.morphTargetInfluences[idx] = THREE.MathUtils.clamp(v, 0, 1);
    return true;
  }

  // Desfase de reposo entre cada control y el extremo de su cadena
  root.updateMatrixWorld(true);
  CHAINS.forEach(ch => {
    const tg = nodes[key(ch.target)], en = bones[key(ch.end)];
    ch.off = new THREE.Vector3();
    if (tg && en) { const t = new THREE.Vector3(), e = new THREE.Vector3(); tg.getWorldPosition(t); en.getWorldPosition(e); ch.off.subVectors(t, e); }
  });

  // Cada frame: animación, parpadeo y IK después de las clips
  function update(dt) {
    mixer.update(dt);
    applyBlink();
    root.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) { CHAINS.forEach(ch => solveChain(ch, bones, nodes)); root.updateMatrixWorld(true); }
  }

  return { root, body, skinned, bones, nodes, clips: gltf.animations, morphs, playClip, setBlink, setExpression, update, report, B: n => bones[key(n)], N: n => nodes[key(n)] };
}

/* Visor independiente (uku-rig.html): cámara, luz, suelo y Uku de pie. */
export async function loadUkuRig(container, { onLog = console.log, frame = { dist: 4.2, y: .85 } } = {}) {
  const u = ukuFrom(await loadUkuGltf(), { onLog });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6f6f5');
  const camera = new THREE.PerspectiveCamera(30, 1, .05, 50);
  camera.position.set(0, frame.y + .25, frame.dist); camera.lookAt(0, frame.y, 0);
  scene.add(new THREE.AmbientLight('#ffffff', 1.4));
  const sun = new THREE.DirectionalLight('#ffffff', 1.2); sun.position.set(2, 4, 3); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshLambertMaterial({ color: '#e7ebf2' }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  scene.add(u.root);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(renderer.domElement);
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container); resize();
  const clock = new THREE.Clock();
  let raf = 0;
  function loop() { raf = requestAnimationFrame(loop); u.update(clock.getDelta()); renderer.render(scene, camera); }
  // Prueba del IK: mueve el control y mide qué tanto llega el extremo
  function reach(chainName, offset) {
    const ch = CHAINS.find(c => c.name === chainName); if (!ch) return null;
    const tg = u.N(ch.target), en = u.B(ch.end);
    tg.position.add(offset); tg.updateMatrixWorld(true); u.update(0);
    const want = new THREE.Vector3(), got = new THREE.Vector3();
    tg.getWorldPosition(want); want.sub(ch.off); en.getWorldPosition(got);
    tg.position.sub(offset); tg.updateMatrixWorld(true);
    return { error: +want.distanceTo(got).toFixed(4), target: want.toArray().map(v => +v.toFixed(3)), hand: got.toArray().map(v => +v.toFixed(3)) };
  }
  return { ...u, scene, camera, renderer, start() { if (!raf) loop(); }, stop() { cancelAnimationFrame(raf); raf = 0; }, reach };
}
