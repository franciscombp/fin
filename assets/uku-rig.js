/* =====================================================================
   Uku: el modelo con esqueleto Mixamo (assets/oso/uku-rig.glb). Este módulo
   sólo carga y controla el personaje; la escena (bosque, flores, planeta) la
   arma bosque3d.js, que lo usa como su único oso.
   - ukuFrom(gltf): huesos, piezas, clips (crossfade), parpadeo (morph "blink")
     y expresiones (target_0…19).
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
  const skinned = []; const meshes = []; const bones = {}; const nodes = {};
  root.traverse(o => {
    if (o.isSkinnedMesh) skinned.push(o);
    if (o.isMesh) meshes.push(o);
    if (o.isBone) bones[o.name] = o;
    nodes[o.name] = nodes[o.name] || o;
  });
  NEEDED.forEach(n => { if (!bones[n] && !nodes[n]) report.errors.push('hueso inexistente: ' + n); });

  // El cuerpo es la pieza más alta; la cara (morph targets) puede ser otra malla del mismo esqueleto
  // Caja de la pose base: computeBoundingBox incluiría los morph targets (la cara abierta, etc.)
  const boxOf = (m) => new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position);
  const hOf = (m) => { const b = boxOf(m); return b.max.y - b.min.y; };
  const body = skinned.reduce((a, m) => (hOf(m) > hOf(a) ? m : a), skinned[0]);
  const box = boxOf(body);
  const morphMesh = meshes.find(m => m.morphTargetDictionary && Object.keys(m.morphTargetDictionary).length) || null;
  const morphs = morphMesh ? Object.keys(morphMesh.morphTargetDictionary) : [];
  if (!morphs.length) report.warnings.push('ningún morph target en el archivo');
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

  // Parpadeo: morph "blink" de la cara
  const blinkIdx = morphMesh ? morphMesh.morphTargetDictionary.blink : undefined;
  if (blinkIdx === undefined) report.warnings.push('sin morph "blink": no hay parpadeo');
  function setBlink(v) { if (blinkIdx !== undefined) morphMesh.morphTargetInfluences[blinkIdx] = THREE.MathUtils.clamp(v, 0, 1); }

  // Expresiones: influencia de un morph target de la cara (target_0 … target_19)
  function setExpression(name, v) {
    const idx = morphMesh && morphMesh.morphTargetDictionary[name];
    if (idx === undefined) { report.warnings.push('expresión inexistente: ' + name); return false; }
    morphMesh.morphTargetInfluences[idx] = THREE.MathUtils.clamp(v, 0, 1);
    return true;
  }

  function update(dt) { mixer.update(dt); }

  return { root, body, box, skinned, bones, nodes, clips, morphs, playClip, setBlink, setExpression, update, report, B: n => bones[key(n)], N: n => nodes[key(n)] };
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
