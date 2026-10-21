/* =====================================================================
   Uku: el modelo con esqueleto Mixamo (assets/oso/uku-rig.glb). Este módulo
   sólo carga y controla el personaje; la escena (bosque, flores, planeta) la
   arma bosque3d.js, que lo usa como su único oso.
   - ukuFrom(gltf): huesos, piezas y clips (crossfade). El modelo trae sus
     animaciones; no tiene morph targets.
   - Las clips traen el desplazamiento del torso al caminar; el planeta mueve
     al oso, así que x y z del torso se fijan en su pose de reposo.
   - loadUkuRig(container): visor independiente para verificar el modelo.
   Unidad = 1 m; el cuerpo mide ~1.64.
   ===================================================================== */
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/jsm/loaders/GLTFLoader.js';

export const UKU_URL = './oso/uku-rig.glb';
// three.js guarda los nombres sin puntos ni corchetes ni dos puntos ("mixamorig:Hips" -> "mixamorigHips")
const key = (n) => n.replace(/[\[\].:\/]/g, '');
const HIPS = key('mixamorig:Hips');
const NEEDED = ['mixamorig:Hips', 'mixamorig:Head', 'mixamorig:RightHand'].map(key);

export function loadUkuGltf() {
  return new Promise((ok, fail) => new GLTFLoader().load(new URL(UKU_URL, import.meta.url).href, ok, undefined, fail));
}

/* Sobre un GLTF ya cargado: huesos, piezas, clips y expresiones. No crea render ni escena. */
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

  // El cuerpo es la pieza más alta (la caja de la pose base, sin morph targets)
  // Caja de la pose base (la del archivo, no la de una pose)
  const boxOf = (m) => new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position);
  const hOf = (m) => { const b = boxOf(m); return b.max.y - b.min.y; };
  const body = skinned.reduce((a, m) => (hOf(m) > hOf(a) ? m : a), skinned[0]);
  // Altura del personaje: la caja que envuelve todas sus piezas (la ropa no siempre llega a los pies)
  const box = skinned.map(boxOf).reduce((u, b) => u.union(b));
  onLog('Piezas: ' + skinned.map(m => m.name + ' ' + hOf(m).toFixed(3) + ' m').join(', '));

  // Desplazamiento del torso: x y z vuelven a su pose de reposo; la altura (y) conserva el vaivén al caminar
  const hips = bones[HIPS];
  const rest = hips ? hips.position.clone() : null;
  const clips = gltf.animations.map(c => {
    c.tracks = c.tracks.map(t => {
      if (!rest || t.name !== HIPS + '.position') return t;
      const v = Float32Array.from(t.values);
      for (let i = 0; i < v.length; i += 3) { v[i] = rest.x; v[i + 2] = rest.z; }
      return new THREE.VectorKeyframeTrack(t.name, t.times, v);
    });
    return c;
  });

  // Mixer y clips con crossfade
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  clips.forEach(c => { actions[c.name] = mixer.clipAction(c); });
  // Pose de reposo (primer cuadro de Happy Idle): «calm» acerca cada hueso a ella después del mixer,
  // así cualquier clip se mueve con menos amplitud sin cambiar su ritmo (y sin mezclar pesos, que
  // con menos de 1 dejarían ver la pose T del archivo)
  const rest0 = [], REST = actions['Happy Idle'] ? 'Happy Idle' : clips[0] && clips[0].name;
  if (REST) { actions[REST].play(); mixer.update(0); Object.values(bones).forEach(b => rest0.push([b, b.quaternion.clone()])); actions[REST].stop(); }
  let current = null, calmTo = 0, calmCur = 0, keep = null;
  /* playClip(nombre, fundido, { speed, calm, keep }): speed es la velocidad de la clip y calm (0–1) cuánto
     se acerca a la pose de reposo (0.6 = se mueve al 40 %); keep (RegExp) deja fuera de la calma los huesos
     que deben moverse completos (p. ej. el brazo que saluda). La misma clip no se reinicia. */
  function playClip(name, fade = .7, { speed = 1, calm = 0, keep: k = null } = {}) {
    const next = actions[name];
    if (!next) { report.errors.push('clip inexistente: ' + name); return false; }
    calmTo = calm; keep = k;
    if (current === next) { next.setEffectiveTimeScale(speed); return true; }
    next.reset().setEffectiveTimeScale(speed).fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = next;
    return true;
  }

  // El mixer solo reescribe un hueso si su valor cambió: antes de cada cuadro se devuelve cada hueso a lo
  // que dejó el mixer, así los retoques de después (calma, mirada) no se acumulan cuadro a cuadro
  const mixed = Object.values(bones).map(b => [b, b.quaternion.clone()]);
  function update(dt) {
    mixed.forEach(([b, q]) => b.quaternion.copy(q));
    mixer.update(dt);
    mixed.forEach(([b, q]) => q.copy(b.quaternion));
    calmCur += (calmTo - calmCur) * Math.min(1, dt * 2.5);
    if (calmCur > .005) rest0.forEach(([b, q]) => { if (!keep || !keep.test(b.name)) b.quaternion.slerp(q, calmCur); });
  }

  return { root, body, box, skinned, bones, nodes, clips, playClip, update, report, B: n => bones[key(n)], N: n => nodes[key(n)] };
}

/* Visor independiente (uku-rig.html): cámara, luz, suelo y Uku con la clip que se pida. */
export async function loadUkuRig(container, { onLog = console.log, frame = { dist: 3.4, y: .85 } } = {}) {
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
  return { ...u, scene, camera, renderer, start() { if (!raf) loop(); }, stop() { cancelAnimationFrame(raf); raf = 0; } };
}
