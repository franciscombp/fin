/* =====================================================================
   Uku con el rig nuevo (assets/oso/uku-rig.glb): carga, animaciones con
   crossfade, parpadeo, expresiones y IK de dos huesos para manos y pies.
   Independiente de bosque3d.js: sirve para probar el modelo antes de
   integrarlo. Unidad = 1 m; el modelo mide 1.70.
   ===================================================================== */
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/jsm/loaders/GLTFLoader.js';

const MODEL = './oso/uku-rig.glb';
const TARGET_HEIGHT = 1.70; // metros, como pidió el brief
// three.js guarda los nombres sin puntos ni corchetes ("hand.L_014" -> "handL_014")
const key = (n) => n.replace(/[\[\].:\/]/g, '');
// Cadenas de dos huesos: el extremo (end) es la mano o el pie; el objetivo y el polo son controles
const CHAINS = [
  { name: 'brazo.L', upper: 'upper_arm.L', fore: 'forearm.L', end: 'hand.L', target: 'ik_hand.L', pole: 'pole_elbow.L' },
  { name: 'brazo.R', upper: 'upper_arm.R', fore: 'forearm.R', end: 'hand.R', target: 'ik_hand.R', pole: 'pole_elbow.R' },
  { name: 'pierna.L', upper: 'thigh.L', fore: 'shin.L', end: 'foot.L', target: 'ik_foot.L', pole: 'pole_knee.L' },
  { name: 'pierna.R', upper: 'thigh.R', fore: 'shin.R', end: 'foot.R', target: 'ik_foot.R', pole: 'pole_knee.R' },
];
const BLINK_BONES = ['eye.L', 'eye.R'];
const NEEDED = [...new Set(CHAINS.flatMap(c => [c.upper, c.fore, c.end, c.target, c.pole]).concat(BLINK_BONES, ['hips_01', 'head_06']))].map(key);

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3();
const _e = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _ap = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _w = new THREE.Quaternion(), _pw = new THREE.Quaternion();

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
  // Parte superior: su hueso hijo ahora debe quedar en el codo
  aim(up, _b.clone().sub(_a), elbow.clone().sub(_a));
  // Parte inferior: desde el codo nuevo hasta el objetivo
  fo.getWorldPosition(_e); en.getWorldPosition(_c);
  aim(fo, _c.clone().sub(_e), _t.clone().sub(_e));
}

export async function loadUkuRig(container, { onLog = console.log } = {}) {
  const gltf = await new Promise((ok, fail) => new GLTFLoader().load(new URL(MODEL, import.meta.url).href, ok, undefined, fail));
  const root = gltf.scene;
  const report = { errors: [], warnings: [] };
  const log = (msg) => onLog(msg);

  // Localizar mallas, esqueleto y clips
  const skinned = []; const bones = {}; const nodes = {};
  root.traverse(o => {
    if (o.isSkinnedMesh) skinned.push(o);
    if (o.isBone) bones[o.name] = o;
    nodes[o.name] = nodes[o.name] || o;
  });
  // Las búsquedas usan el nombre ya saneado; el brief nombra los huesos con puntos
  const B = (n) => bones[key(n)], N = (n) => nodes[key(n)];
  log('SkinnedMesh: ' + skinned.map(m => m.name || '(sin nombre)').join(', '));
  const skel = skinned[0] && skinned[0].skeleton;
  log('Huesos del esqueleto: ' + (skel ? skel.bones.length : 0));
  const clips = gltf.animations || [];
  log('Clips: ' + (clips.length ? clips.map(c => '"' + c.name + '" (' + c.tracks.length + ' pistas)').join(', ') : 'ninguno'));

  // Desfase de reposo entre cada control y el extremo de su cadena (en el archivo, el control no siempre está en la muñeca)
  root.updateMatrixWorld(true);
  CHAINS.forEach(ch => {
    const tg = nodes[key(ch.target)], en = bones[key(ch.end)];
    ch.off = new THREE.Vector3();
    if (tg && en) { const t = new THREE.Vector3(), e = new THREE.Vector3(); tg.getWorldPosition(t); en.getWorldPosition(e); ch.off.subVectors(t, e); }
  });

  // Verificación de huesos y morph targets: todo lo que el código usa debe existir
  NEEDED.forEach(n => { if (!bones[n]) report.errors.push('hueso inexistente: ' + n); });
  const morphs = {};
  skinned.forEach(m => { if (m.morphTargetDictionary) Object.assign(morphs, m.morphTargetDictionary); });
  const morphMesh = skinned.find(m => m.morphTargetDictionary && Object.keys(m.morphTargetDictionary).length);
  if (!morphMesh) report.warnings.push('ningún morph target en el archivo: expresiones no tienen dónde actuar');
  else log('Morph targets en "' + (morphMesh.parent && morphMesh.parent.name || morphMesh.name) + '": ' + Object.keys(morphMesh.morphTargetDictionary).join(', '));

  // Escena mínima: cámara, luz, suelo y Uku de pie en el origen
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6f6f5');
  const camera = new THREE.PerspectiveCamera(30, 1, .05, 50);
  camera.position.set(0, 1.1, 4.2); camera.lookAt(0, .85, 0);
  scene.add(new THREE.AmbientLight('#ffffff', 1.4));
  const sun = new THREE.DirectionalLight('#ffffff', 1.2); sun.position.set(2, 4, 3); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshLambertMaterial({ color: '#e7ebf2' }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // Altura: la geometría en reposo mide ~1.50; se escala uniforme a 1.70 (pies en el suelo)
  // El cuerpo es la malla con morph targets; la boca y la ropa son sólo piezas que siguen al esqueleto
  // El cuerpo es la pieza más alta (la boca y la ropa son piezas pequeñas que siguen al esqueleto)
  const hOf = (m) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox.max.y - m.geometry.boundingBox.min.y; };
  const body = skinned.reduce((a, m) => (hOf(m) > hOf(a) ? m : a), skinned[0]);
  log('Alturas de piezas: ' + skinned.map(m => (m.name || '?') + ' ' + hOf(m).toFixed(3)).join(', '));
  const geo = body.geometry;
  const h0 = geo.boundingBox.max.y - geo.boundingBox.min.y, k = TARGET_HEIGHT / h0;
  root.scale.setScalar(k); root.position.y = -geo.boundingBox.min.y * k;
  scene.add(root);
  root.updateMatrixWorld(true);
  log('Altura: geometría ' + h0.toFixed(3) + ' m → escala ' + k.toFixed(3) + ' = ' + TARGET_HEIGHT + ' m');

  // Mixer y clips con crossfade
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  clips.forEach(c => { actions[c.name] = mixer.clipAction(c); });
  if (clips.some(c => !c.tracks.length)) report.warnings.push('clips sin pistas (sólo animan morph targets que no existen): ' + clips.filter(c => !c.tracks.length).map(c => c.name).join(', '));
  let current = null;
  function playClip(name, fade = .4) {
    const next = actions[name];
    if (!next) { report.errors.push('clip inexistente: ' + name); log('ERROR: no hay clip "' + name + '"'); return false; }
    if (current === next) return true;
    next.reset().fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = next;
    return true;
  }

  // Parpadeo: el morph "blink" no existe en este archivo; se cierran los ojos escalando sus huesos
  const eyeRest = BLINK_BONES.map(n => B(n) ? B(n).scale.clone() : null);
  let blink = 0;
  function setBlink(v) { blink = THREE.MathUtils.clamp(v, 0, 1); }
  // Expresiones: influencia de un morph target del cuerpo (target_0 … target_19)
  function setExpression(name, v) {
    const idx = morphMesh && morphMesh.morphTargetDictionary[name];
    if (idx === undefined) { report.warnings.push('expresión inexistente: ' + name); log('AVISO: no hay morph target "' + name + '"'); return false; }
    morphMesh.morphTargetInfluences[idx] = THREE.MathUtils.clamp(v, 0, 1);
    return true;
  }
  function applyBlink() {
    BLINK_BONES.forEach((n, i) => {
      const b = B(n), r = eyeRest[i]; if (!b || !r) return;
      b.scale.set(r.x, r.y * (1 - blink * .9), r.z);
    });
  }

  // Frame: animación, parpadeo, IK después de las clips
  function update(dt) {
    mixer.update(dt);
    applyBlink();
    root.updateMatrixWorld(true);
    // Dos pasadas: la segunda corrige lo que la primera deja por el giro de la parte superior
    for (let i = 0; i < 2; i++) { CHAINS.forEach(ch => solveChain(ch, bones, nodes)); root.updateMatrixWorld(true); }
  }

  // Render en el contenedor, con su propio bucle (el tiempo sale del reloj de Three)
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
  function loop() { raf = requestAnimationFrame(loop); update(clock.getDelta()); renderer.render(scene, camera); }
  function start() { if (!raf) loop(); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  // Prueba del IK: mueve el objetivo y mide qué tanto llega la mano
  function reach(chainName, offset) {
    const ch = CHAINS.find(c => c.name === chainName); if (!ch) return null;
    const tg = nodes[key(ch.target)], en = bones[key(ch.end)];
    const before = new THREE.Vector3(); tg.getWorldPosition(before);
    tg.position.add(offset); tg.updateMatrixWorld(true);
    update(0);
    const want = new THREE.Vector3(), got = new THREE.Vector3();
    tg.getWorldPosition(want); want.sub(ch.off); en.getWorldPosition(got);
    tg.position.sub(offset); tg.updateMatrixWorld(true);
    return { error: +want.distanceTo(got).toFixed(4), target: want.toArray().map(v => +v.toFixed(3)), hand: got.toArray().map(v => +v.toFixed(3)) };
  }

  return { root, scene, camera, bones, nodes, clips, skinned, morphs, report, playClip, setBlink, setExpression, update, mixer, container, renderer, start, stop, reach };
}

/* Adaptador para la app: la misma API que bosque3d (attach, play, setAmbient…) sobre el rig nuevo.
   Los gestos se traducen a clips; al terminar, Uku vuelve a su estado de reposo (caminar). */
const CLIP_OF = { wave: 'saludar', happy: 'celebrar', worried: 'preocupado', walk: 'caminar', idle: 'idle' };
export function ukuAdapter() {
  let rig = null, el = null, onTap = null, ambient = 'idle', timer = 0, want = 'idle';
  const apply = (g) => { if (rig) rig.playClip(CLIP_OF[g] || CLIP_OF.idle); };
  return {
    supported: () => !!window.WebGLRenderingContext,
    attach(host, opts = {}) {
      if (el === host) return;
      el = host; onTap = opts.onTap || null;
      loadUkuRig(host, { onLog: () => {} }).then(r => {
        rig = r; r.start(); apply(want);
        host.addEventListener('pointerup', () => { if (onTap) onTap(); });
      });
    },
    play(name) {
      clearTimeout(timer);
      want = CLIP_OF[name] ? name : 'idle';
      apply(want);
      if (name !== ambient) timer = setTimeout(() => { want = ambient; apply(ambient); }, 2600);
    },
    setAmbient(name) { ambient = name === 'walk' ? 'walk' : 'idle'; if (!timer) { want = ambient; apply(ambient); } },
    setLook() {}, setBloom() {}, setMood() {}, setScore() {},
  };
}
