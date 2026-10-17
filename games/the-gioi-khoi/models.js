// Trang xem mô hình để thiết kế và kiểm tra: xếp mọi sinh vật cạnh nhau, đứng yên hoặc đi bộ; ?sheet=1 hiện texture.
import * as THREE from '../../platform/vendor/three/three.module.js';
import { createModelLib, ALL_MODEL_IDS, animate } from './render/models/index.js';

const params = new URLSearchParams(location.search);
const cv = document.getElementById('cv'), renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false });
renderer.setSize(innerWidth, innerHeight, false); renderer.setClearColor('#8fb4d9');
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);
const lib = createModelLib(THREE);
const ids = params.get('id') ? params.get('id').split(',') : ALL_MODEL_IDS;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: '#5a8c46' })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const rigs = [];
const gap = Number(params.get('gap')) || 3.2, cols = ids.length <= 6 ? ids.length : Math.ceil(Math.sqrt(ids.length * 1.6));
ids.forEach((id, i) => {
  const rig = lib.spawn(id), g = new THREE.Group(); g.add(rig.mesh);
  g.position.set((i % cols - (cols - 1) / 2) * gap, 0, Math.floor(i / cols) * -gap * 1.2);
  scene.add(g); rigs.push({ id, rig, g, phase: 0 });
});
// khối tham chiếu 1 block để so cỡ
const ref = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true })); ref.position.set(-(cols / 2) * gap - 2, 0.5, 0); scene.add(ref);
const rows = Math.ceil(ids.length / cols), W = cols * gap;
const dist = Number(params.get('dist')) || Math.max(4.5, cols * gap * 0.62 + 2.2 + rows), look = Number(params.get('look')) || 1.3;
camera.position.set(0, look + 1.2 + rows * 0.5, dist);
camera.lookAt(0, look, -(rows - 1) * gap * 0.55);
const walking = params.get('walk') !== '0', attack = params.get('attack') === '1';
let t = 0;
function frame() {
  t += 0.016;
  for (const r of rigs) { r.phase += walking ? 0.09 : 0; animate(r.rig, { phase: r.phase, k: walking ? 1 : 0, t, pitch: 0, swing: attack ? (Math.sin(t * 3) > 0.6 ? 1 : 0) : 0 }); r.g.rotation.y = params.get('spin') ? t * 0.6 : (params.get('yaw') ? Number(params.get('yaw')) : Math.PI + 0.55); }
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
lib.setLight(1);
if (params.get('sheet')) {
  document.body.innerHTML = ''; document.body.style.background = '#222';
  for (const b of lib.all()) { const d = document.createElement('div'); d.style.cssText = 'display:inline-block;margin:6px;color:#fff;font:11px sans-serif'; d.append(b.id + ' ' + b.canvas.width + 'x' + b.canvas.height, document.createElement('br')); b.canvas.style.cssText = 'width:' + b.canvas.width * 4 + 'px;image-rendering:pixelated;background:#444'; d.appendChild(b.canvas); document.body.appendChild(d); }
} else { window.__models = { rigs, lib, scene, camera, renderer }; frame(); }
