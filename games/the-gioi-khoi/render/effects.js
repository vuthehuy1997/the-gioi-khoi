// Hiệu ứng khi chơi: khung chọn block, vết nứt khi đào, hạt vỡ block/trúng đòn. Chỉ vẽ.
import { tileColors } from './atlas.js';

export function createEffects(sc) {
  const T = sc.THREE, root = new T.Group(); sc.scene.add(root);

  // khung chọn block: 12 cạnh, hơi lớn hơn block một chút
  const outline = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.004, 1.004, 1.004)), new T.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.75 }));
  outline.visible = false; outline.renderOrder = 5; root.add(outline);

  // vết nứt: 10 mức vẽ sẵn trên một dải ảnh
  const STAGES = 10, S = 16;
  const cc = document.createElement('canvas'); cc.width = S * STAGES; cc.height = S;
  const cx = cc.getContext('2d'); cx.strokeStyle = 'rgba(0,0,0,0.9)'; cx.lineWidth = 1;
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const segs = [];
  for (let i = 0; i < 60; i++) { const x = rnd() * S, y = rnd() * S; segs.push([x, y, x + (rnd() - 0.5) * 9, y + (rnd() - 0.5) * 9]); }
  for (let st = 0; st < STAGES; st++) {
    const n = Math.floor((st + 1) * 6);
    cx.beginPath();
    for (let i = 0; i < n; i++) { const [a, b, c, d] = segs[i]; cx.moveTo(st * S + a, b); cx.lineTo(st * S + Math.max(0, Math.min(S, c)), Math.max(0, Math.min(S, d))); }
    cx.stroke();
  }
  const crackTex = new T.CanvasTexture(cc); crackTex.magFilter = T.NearestFilter; crackTex.minFilter = T.NearestFilter; crackTex.generateMipmaps = false;
  crackTex.repeat.set(1 / STAGES, 1);
  const crack = new T.Mesh(new T.BoxGeometry(1.01, 1.01, 1.01), new T.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  crack.visible = false; crack.renderOrder = 4; root.add(crack);

  // hạt: một Points dùng chung, vòng đệm 300 hạt
  const N = 300, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3)); pg.setAttribute('color', new T.BufferAttribute(col, 3));
  const points = new T.Points(pg, new T.PointsMaterial({ size: 0.11, vertexColors: true, sizeAttenuation: true, depthWrite: false, transparent: true }));
  points.frustumCulled = false; points.renderOrder = 6; root.add(points);
  let head = 0, alive = 0;
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999;

  return {
    root, outline, crack, points,
    get particleCount() { return alive; },
    // pos: ô block đang nhắm hoặc null; progress 0..1 hoặc null
    setTarget(p, progress) {
      if (!p) { outline.visible = false; crack.visible = false; return; }
      outline.visible = true; outline.position.set(p.x + 0.5, p.y + 0.5, p.z + 0.5);
      if (progress != null && progress > 0.02) {
        crack.visible = true; crack.position.copy(outline.position);
        crackTex.offset.x = Math.min(STAGES - 1, Math.floor(progress * STAGES)) / STAGES;
      } else crack.visible = false;
    },
    // tile: chỉ số ô atlas để lấy màu; n hạt
    burst(x, y, z, tile, n = 14, speed = 2.6) {
      const c = Array.isArray(tile) ? tile : (tileColors[tile] || [0.6, 0.6, 0.6]);
      for (let i = 0; i < n; i++) {
        const k = head++ % N, j = k * 3, v = 0.75 + Math.random() * 0.5;
        pos[j] = x + (Math.random() - 0.5) * 0.7; pos[j + 1] = y + (Math.random() - 0.5) * 0.7; pos[j + 2] = z + (Math.random() - 0.5) * 0.7;
        vel[j] = (Math.random() - 0.5) * speed; vel[j + 1] = Math.random() * speed * 0.9; vel[j + 2] = (Math.random() - 0.5) * speed;
        col[j] = c[0] * v; col[j + 1] = c[1] * v; col[j + 2] = c[2] * v; life[k] = 0.5 + Math.random() * 0.6;
      }
    },
    update(dt) {
      alive = 0;
      for (let k = 0; k < N; k++) {
        if (life[k] <= 0) { pos[k * 3 + 1] = -999; continue; }
        life[k] -= dt; alive++; const j = k * 3;
        vel[j + 1] -= 14 * dt; pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      }
      pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
    },
  };
}
