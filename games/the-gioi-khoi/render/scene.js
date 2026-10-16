// Cảnh Three.js: bộ dựng hình, camera góc nhìn thứ nhất, lưới chunk (đặc và nước). Không chứa logic game.
import * as THREE from '../../../platform/vendor/three/three.module.js';
import { makeAtlas } from './atlas.js';

export function createScene(canvas, { aa = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: aa, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 400);
  camera.rotation.order = 'YXZ';

  const atlasCanvas = makeAtlas();
  const tex = new THREE.CanvasTexture(atlasCanvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const solidMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5 });
  const plantMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const waterMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false });

  const meshes = new Map();   // "cx,cz" -> { solid, water }
  const root = new THREE.Group(); scene.add(root);
  scene.background = new THREE.Color('#8fd3a8');
  scene.fog = new THREE.Fog('#cfe8d5', 40, 120);
  const setFog = (near, far) => { scene.fog.near = near; scene.fog.far = far; };

  function geometry(part) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(part.uvs, 2));
    g.setAttribute('color', new THREE.BufferAttribute(part.colors, 3));
    g.setIndex(new THREE.BufferAttribute(part.indices, 1));
    g.computeBoundingSphere();
    return g;
  }

  function removeChunk(cx, cz) {
    const k = cx + ',' + cz, m = meshes.get(k);
    if (!m) return;
    for (const mesh of [m.solid, m.plants, m.water]) if (mesh) { root.remove(mesh); mesh.geometry.dispose(); }
    meshes.delete(k);
  }

  function setChunkMesh(cx, cz, mesh) {
    removeChunk(cx, cz);
    const entry = {};
    for (const [name, mat, order] of [['solid', solidMat, 0], ['plants', plantMat, 0], ['water', waterMat, 1]]) {
      const part = mesh[name];
      if (!part.indices.length) continue;
      const m = new THREE.Mesh(geometry(part), mat);
      m.position.set(cx * 16, 0, cz * 16); m.renderOrder = order; m.frustumCulled = true;
      root.add(m); entry[name] = m;
    }
    meshes.set(cx + ',' + cz, entry);
  }

  function resize() {
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // light: 0..1 (đêm → ngày) nhân vào màu vật liệu; sky/fog: màu hex.
  function setEnvironment({ sky, fog, light = 1 }) {
    scene.background.set(fog); scene.fog.color.set(fog);
    scene.background.multiplyScalar(Math.max(0.1, light)); scene.fog.color.multiplyScalar(Math.max(0.1, light));
    solidMat.color.setScalar(Math.max(0.22, light)); plantMat.color.setScalar(Math.max(0.22, light)); waterMat.color.setScalar(Math.max(0.22, light));
  }

  return {
    THREE, atlasCanvas, renderer, scene, camera, root, setChunkMesh, removeChunk, resize, setEnvironment, setFog,
    hasChunk: (cx, cz) => meshes.has(cx + ',' + cz), chunkCount: () => meshes.size,
    render: () => renderer.render(scene, camera),
  };
}
