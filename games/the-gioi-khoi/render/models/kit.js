// Bộ dựng mô hình kiểu Minecraft: nhiều khối hộp, mỗi khối có vùng riêng trên một texture (tự xếp), gắn vào xương.
// Một mô hình = MỘT geometry dùng chung + một vật liệu; mỗi thực thể là một SkinnedMesh (một lệnh vẽ) với bộ xương riêng.
// Đơn vị: pixel (1 block = 16 px) nhân với model.scale. Quy ước: -z là phía trước (yaw 0), +y lên, x sang phải.
import { hash } from '../../world/noise.js';

export const FACES = ['top', 'bottom', 'left', 'front', 'right', 'back'];

// Chiều rộng/cao vùng texture của một khối (bố cục như Minecraft): 2*(w+d) x (h+d)
const footprint = ([w, h, d]) => [2 * (w + d), h + d];

// Xếp các khối lên texture theo từng hàng (shelf). Khối có `uvFrom` dùng lại vùng của khối khác (chân tay đối xứng).
export function packUV(parts, TW) {
  const own = parts.filter(p => !p.uvFrom).sort((a, b) => footprint(b.size)[1] - footprint(a.size)[1] || footprint(b.size)[0] - footprint(a.size)[0]);
  let x = 0, y = 0, rowH = 0;
  for (const p of own) {
    const [fw, fh] = footprint(p.size);
    if (x + fw > TW) { x = 0; y += rowH; rowH = 0; }
    p.uv = [x, y]; x += fw; rowH = Math.max(rowH, fh);
  }
  const byId = Object.fromEntries(parts.map(p => [p.id, p]));
  for (const p of parts) if (p.uvFrom) p.uv = byId[p.uvFrom].uv;
  const need = y + rowH;
  let TH = 16; while (TH < need) TH *= 2;
  return TH;
}

// Hình chữ nhật của một mặt trên texture.
export function faceRect(p, face) {
  const [w, h, d] = p.size, [u, v] = p.uv;
  switch (face) {
    case 'top': return { x: u + d, y: v, w, h: d };
    case 'bottom': return { x: u + d + w, y: v, w, h: d };
    case 'left': return { x: u, y: v + d, w: d, h };               // mặt -x
    case 'front': return { x: u + d, y: v + d, w, h };             // mặt -z (phía trước)
    case 'right': return { x: u + d + w, y: v + d, w: d, h };      // mặt +x
    case 'back': return { x: u + 2 * d + w, y: v + d, w, h };      // mặt +z
  }
  throw new Error('mặt không hợp lệ: ' + face);
}

// Bốn đỉnh mỗi mặt theo thứ tự trái-dưới, phải-dưới, phải-trên, trái-trên khi nhìn từ ngoài vào; shade = độ sáng theo hướng.
const QUADS = {
  top: { c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], shade: 1.0 },
  bottom: { c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], shade: 0.5 },
  left: { c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], shade: 0.8 },
  front: { c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], shade: 0.92 },
  right: { c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], shade: 0.8 },
  back: { c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], shade: 0.66 },
};

// Dựng geometry chung (positions/uv/color/skinIndex/skinWeight/index) cho cả mô hình. Khối được xoay quanh tâm theo p.rot (nếu có).
export function buildGeometry(T, model) {
  const { parts, TW, TH } = model, s = model.scale / 16;
  const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
  const boneIndex = Object.fromEntries(model.bones.map((b, i) => [b.id, i]));
  for (const p of parts) {
    const [w, h, d] = p.size, hx = w / 2 + (p.inflate || 0), hy = h / 2 + (p.inflate || 0), hz = d / 2 + (p.inflate || 0);
    const rot = p.rot || [0, 0, 0], cx = Math.cos(rot[0]), sx = Math.sin(rot[0]), cy = Math.cos(rot[1]), sy = Math.sin(rot[1]), cz = Math.cos(rot[2]), sz = Math.sin(rot[2]);
    for (const f of FACES) {
      const q = QUADS[f], r = faceRect(p, f), base = pos.length / 3;
      const uvs = [[r.x, r.y + r.h], [r.x + r.w, r.y + r.h], [r.x + r.w, r.y], [r.x, r.y]];
      q.c.forEach((c, i) => {
        let x = c[0] * hx, y = c[1] * hy, z = c[2] * hz, t;
        t = y * cx - z * sx; z = y * sx + z * cx; y = t;           // xoay quanh x
        t = x * cy + z * sy; z = -x * sy + z * cy; x = t;           // quanh y
        t = x * cz - y * sz; y = x * sz + y * cz; x = t;            // quanh z
        pos.push((p.pos[0] + x) * s, (p.pos[1] + y) * s, (p.pos[2] + z) * s);
        uv.push(uvs[i][0] / TW, 1 - uvs[i][1] / TH);
        const sh = q.shade * (p.dark ? 0.8 : 1); col.push(sh, sh, sh);
        si.push(boneIndex[p.bone], 0, 0, 0); sw.push(1, 0, 0, 0);
      });
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeBoundingSphere(); g.boundingSphere.radius *= 1.6;           // dư chỗ cho tư thế/hoạt hoạ
  return g;
}

// ---- vẽ texture ----
const toRgb = hex => { let h = hex.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

export function makePainter(doc, TW, TH, seed = 1) {
  const c = doc.createElement('canvas'); c.width = TW; c.height = TH;
  const ctx = c.getContext('2d'), img = ctx.createImageData(TW, TH), D = img.data;
  const set = (x, y, rgb, a = 255) => { if (x < 0 || y < 0 || x >= TW || y >= TH) return; const o = (y * TW + x) * 4; D[o] = rgb[0]; D[o + 1] = rgb[1]; D[o + 2] = rgb[2]; D[o + 3] = a; };
  const P = {
    canvas: c,
    // tô cả hình chữ nhật với nhiễu nhẹ j (0..1)
    fill(r, hex, j = 0.08) {
      const b = toRgb(hex);
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        const n = (hash(seed, x, y) - 0.5) * 2 * j * 255; set(x, y, b.map(v => Math.max(0, Math.min(255, Math.round(v + n)))));
      }
    },
    // tô một ô nhỏ trong hình chữ nhật (toạ độ tương đối)
    box(r, dx, dy, w, h, hex) { const b = toRgb(hex); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dx + x < r.w && dy + y < r.h) set(r.x + dx + x, r.y + dy + y, b); },
    dot(r, dx, dy, hex) { if (dx >= 0 && dy >= 0 && dx < r.w && dy < r.h) set(r.x + dx, r.y + dy, toRgb(hex)); },
    // chuyển màu dọc từ hex a (trên) sang hex b (dưới)
    vgrad(r, a, b, j = 0.04) { const A = toRgb(a), B = toRgb(b); for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const n = (hash(seed, r.x + x, r.y + y) - 0.5) * 2 * j * 255; set(r.x + x, r.y + y, mix(A, B, y / Math.max(1, r.h - 1)).map(v => Math.max(0, Math.min(255, Math.round(v + n))))); } },
    // sọc ngang/dọc
    stripes(r, hex, every, thick = 1, vertical = false) { const b = toRgb(hex); for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const k = vertical ? x : y; if (k % every < thick) set(r.x + x, r.y + y, b); } },
    // đốm ngẫu nhiên xác định
    speckle(r, hex, p, s2 = 7) { const b = toRgb(hex); for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (hash(seed + s2, r.x + x, r.y + y) < p) set(r.x + x, r.y + y, b); },
    clear() { D.fill(0); },
    flush() { ctx.putImageData(img, 0, 0); return c; },
  };
  return P;
}

// ---- thể hiện (instance) ----
// Tạo SkinnedMesh với bộ xương riêng; geometry và material dùng chung giữa các thực thể cùng loại.
export function instantiate(T, model, geometry, material) {
  const s = model.scale / 16, bones = {}, list = [];
  const root = new T.Bone(); root.name = 'root';
  for (const b of model.bones) {
    const bone = new T.Bone(); bone.name = b.id; bones[b.id] = bone; list.push(bone);
    const parent = b.parent ? model.bones.find(x => x.id === b.parent) : null;
    bone.position.set((b.pivot[0] - (parent ? parent.pivot[0] : 0)) * s, (b.pivot[1] - (parent ? parent.pivot[1] : 0)) * s, (b.pivot[2] - (parent ? parent.pivot[2] : 0)) * s);
    (b.parent ? bones[b.parent] : root).add(bone);
    if (b.rest) bone.rotation.set(...b.rest);
  }
  const mesh = new T.SkinnedMesh(geometry, material);
  mesh.add(root);
  // bind ở tư thế nghỉ (không xoay) rồi mới áp tư thế `rest`
  const rests = model.bones.map(b => b.rest), saved = list.map(b => b.rotation.clone());
  for (const b of list) b.rotation.set(0, 0, 0);
  mesh.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton(list));
  list.forEach((b, i) => { if (rests[i]) b.rotation.copy(saved[i]); });
  mesh.frustumCulled = true;
  return { mesh, bones, root, model };
}

// ---- hoạt hoạ chung theo vai trò xương ----
// st: { phase, k (0..1 tốc độ), t, pitch, swing (0..1 đang tấn công), hover }
export function animate(rig, st) {
  for (const b of rig.model.bones) {
    const bone = rig.bones[b.id], rest = b.rest || [0, 0, 0];
    let rx = rest[0], ry = rest[1], rz = rest[2];
    switch (b.role) {
      case 'leg': rx += Math.sin(st.phase + (b.ph || 0)) * (b.amp ?? 0.8) * st.k; break;
      case 'arm': rx += Math.sin(st.phase + (b.ph || 0)) * (b.amp ?? 0.7) * st.k - st.swing * (b.atk ?? 1.2); break;
      case 'armstill': rx += Math.sin(st.t * 1.7 + (b.ph || 0)) * 0.04 - st.swing * (b.atk ?? 0.8); break;
      case 'head': rx += -st.pitch * 0.8 + Math.sin(st.t * 1.3) * 0.03 + st.swing * (b.atk ?? 0.35); break;
      case 'tail': ry += Math.sin(st.t * 4 + (b.ph || 0)) * (0.25 + 0.4 * st.k); rx += Math.sin(st.t * 2) * 0.05; break;
      case 'tailseg': rx += Math.sin(st.t * 2.2 + (b.ph || 0)) * 0.09 - st.swing * (b.atk ?? 0.5); break;
      case 'sway': rz += Math.sin(st.t * 1.5 + (b.ph || 0)) * (b.amp ?? 0.1); break;
      case 'flap': rz += Math.sin(st.t * 6 + (b.ph || 0)) * (b.amp ?? 0.5); break;
      case 'claw': rx += Math.sin(st.t * 2 + (b.ph || 0)) * 0.08 - st.swing * 0.7; break;
      default: break;
    }
    bone.rotation.set(rx, ry, rz);
  }
  if (rig.model.hover) rig.root.position.y = Math.sin(st.t * 2) * 0.12 * rig.model.scale + rig.model.hover * rig.model.scale / 16;
  else if (st.k > 0.05) rig.root.position.y = Math.abs(Math.sin(st.phase)) * 0.02 * rig.model.scale; else rig.root.position.y = 0;
}
