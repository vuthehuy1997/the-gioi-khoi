// Dựng lưới (mesh) cho một chunk. Chỉ vẽ mặt không bị che; mỗi đỉnh có độ sáng = hướng mặt × AO (che khuất góc) × ánh sáng trời
// (hang động và dưới tán cây tối hơn), giống cách Minecraft làm "smooth lighting".
// Chạy được trong Web Worker (không dùng DOM). Trả { solid, water }, mỗi phần có positions/uvs/colors/indices (typed array).
import { BLOCKS, B, ATLAS_COLS, ATLAS_ROWS } from '../world/blocks.js';

const PW = 18, PH = 66, PLAYER = PW * PW;                  // mảng đệm: x,z có viền 1 ô; y có viền dưới (đặc) và trên (khí)
const pidx = (x, y, z) => ((y + 1) * PW + (z + 1)) * PW + (x + 1);

const PLANT = new Uint8Array(256);
const OPAQUE = new Uint8Array(256), OCC = new Uint8Array(256), LIQ = new Uint8Array(256), TILE = new Int16Array(256 * 3);
for (const b of BLOCKS) {
  OPAQUE[b.id] = b.opaque ? 1 : 0; LIQ[b.id] = b.liquid ? 1 : 0; PLANT[b.id] = b.plant ? 1 : 0;
  OCC[b.id] = (b.opaque || b.id === B.LEAVES) ? 1 : 0;      // lá cũng che sáng/AO
  for (let k = 0; k < 3; k++) TILE[b.id * 3 + k] = b.tiles[k];
}

// Hướng mặt: n pháp tuyến, axis trục pháp tuyến, k chỉ số ô (trên/bên/dưới), shade độ sáng theo hướng, c bốn đỉnh (CCW nhìn từ ngoài).
const FACES = [
  { n: [0, 1, 0], axis: 1, k: 0, shade: 1.0, c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], axis: 1, k: 2, shade: 0.5, c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [1, 0, 0], axis: 0, k: 1, shade: 0.8, c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], axis: 0, k: 1, shade: 0.8, c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 0, 1], axis: 2, k: 1, shade: 0.68, c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], axis: 2, k: 1, shade: 0.68, c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const INSET = 0.002;
const AO_LEVEL = [0.52, 0.7, 0.86, 1.0];

// Với mỗi mặt và đỉnh: độ lệch (dx, dy, dz) của ô giữa-cạnh 1, ô giữa-cạnh 2 và ô góc, trong lớp ngay trước mặt (n).
for (const f of FACES) {
  const ax = [0, 1, 2].filter(a => a !== f.axis);
  f.v = f.c.map(vc => {
    const su = vc[ax[0]] * 2 - 1, sv = vc[ax[1]] * 2 - 1;
    const o = (a, b) => { const d = [f.n[0], f.n[1], f.n[2]]; d[ax[0]] += a * su; d[ax[1]] += b * sv; return d; };
    return { s1: o(1, 0), s2: o(0, 1), co: o(1, 1) };
  });
}

// Độ sáng trời tại ô (x, y, z): 1 nếu hở trời; càng sâu dưới mái/mặt đất càng tối.
function sky(top, x, y, z) {
  const t = top[(z + 1) * PW + (x + 1)];
  if (y > t) return 1;
  const v = 0.78 - (t - y) * 0.09;
  return v < 0.3 ? 0.3 : v;
}

// Cây cỏ/hoa: hai mặt phẳng chéo, vẽ hai phía.
const CROSS = [[[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]], [[1, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 0]]];
function crossPlant(part, id, lx, y, lz, s) {            // vật liệu hai mặt nên mỗi mặt phẳng chỉ cần một lớp tam giác
  const tile = TILE[id * 3], col = tile % ATLAS_COLS, row = (tile / ATLAS_COLS) | 0, br = 0.92 * s;
  for (const quad of CROSS) for (const flip of [0]) {
    const k0 = part.p.length / 3;
    for (let v = 0; v < 4; v++) {
      const c = quad[v];
      part.p.push(lx + c[0], y + c[1], lz + c[2]);
      part.u.push((col + (UV[v][0] ? 1 - INSET : INSET)) / ATLAS_COLS, 1 - (row + 1) / ATLAS_ROWS + (UV[v][1] ? 1 - INSET : INSET) / ATLAS_ROWS);
      part.c.push(br, br, br);
    }
    if (flip) part.i.push(k0, k0 + 2, k0 + 1, k0, k0 + 3, k0 + 2); else part.i.push(k0, k0 + 1, k0 + 2, k0, k0 + 2, k0 + 3);
  }
}

// P: mảng đệm (PW x PH x PW) đã điền; top: chiều cao ô che sáng cao nhất mỗi cột (PW x PW).
function meshPadded(P, top) {
  const solid = { p: [], u: [], c: [], i: [] }, water = { p: [], u: [], c: [], i: [] }, plants = { p: [], u: [], c: [], i: [] };
  const ao = [0, 0, 0, 0], br = [0, 0, 0, 0];
  for (let y = 0; y < 64; y++) for (let lz = 0; lz < 16; lz++) {
    let base = pidx(0, y, lz);
    for (let lx = 0; lx < 16; lx++, base++) {
      const id = P[base];
      if (id === 0) continue;
      if (PLANT[id]) { crossPlant(plants, id, lx, y, lz, sky(top, lx, y, lz)); continue; }
      const liquid = LIQ[id] === 1, part = liquid ? water : solid;
      for (let fi = 0; fi < 6; fi++) {
        const f = FACES[fi], nx = f.n[0], ny = f.n[1], nz = f.n[2];
        const nid = P[base + nx + nz * PW + ny * PLAYER];
        if (OPAQUE[nid] || nid === id) continue;
        const tile = TILE[id * 3 + f.k], col = tile % ATLAS_COLS, row = (tile / ATLAS_COLS) | 0;
        const bx = lx + nx, by = y + ny, bz = lz + nz;
        const sBase = sky(top, bx, by, bz);
        for (let v = 0; v < 4; v++) {
          let a, s = sBase;
          if (liquid) a = 3;
          else {
            const q = f.v[v];
            const o1 = OCC[P[base + q.s1[0] + q.s1[2] * PW + q.s1[1] * PLAYER]], o2 = OCC[P[base + q.s2[0] + q.s2[2] * PW + q.s2[1] * PLAYER]];
            const oc = OCC[P[base + q.co[0] + q.co[2] * PW + q.co[1] * PLAYER]];
            a = o1 && o2 ? 0 : 3 - (o1 + o2 + oc);
            // ánh sáng trời của đỉnh = trung bình ô trước mặt và các ô kề không che
            let sum = sBase, cnt = 1;
            if (!o1) { sum += sky(top, lx + q.s1[0], y + q.s1[1], lz + q.s1[2]); cnt++; }
            if (!o2) { sum += sky(top, lx + q.s2[0], y + q.s2[1], lz + q.s2[2]); cnt++; }
            if (!oc && !(o1 && o2)) { sum += sky(top, lx + q.co[0], y + q.co[1], lz + q.co[2]); cnt++; }
            s = sum / cnt;
          }
          ao[v] = a; br[v] = f.shade * AO_LEVEL[a] * s;
        }
        const k0 = part.p.length / 3;
        for (let v = 0; v < 4; v++) {
          const c = f.c[v];
          part.p.push(lx + c[0], y + c[1], lz + c[2]);
          part.u.push((col + (UV[v][0] ? 1 - INSET : INSET)) / ATLAS_COLS, 1 - (row + 1) / ATLAS_ROWS + (UV[v][1] ? 1 - INSET : INSET) / ATLAS_ROWS);
          part.c.push(br[v], br[v], br[v]);
        }
        if (ao[0] + ao[2] > ao[1] + ao[3]) part.i.push(k0, k0 + 1, k0 + 2, k0, k0 + 2, k0 + 3);
        else part.i.push(k0 + 1, k0 + 2, k0 + 3, k0 + 1, k0 + 3, k0);
      }
    }
  }
  const fin = m => ({ positions: new Float32Array(m.p), uvs: new Float32Array(m.u), colors: new Float32Array(m.c), indices: new Uint32Array(m.i) });
  return { solid: fin(solid), water: fin(water), plants: fin(plants) };
}

function computeTop(P) {
  const top = new Int16Array(PW * PW).fill(-1);
  for (let z = 0; z < PW; z++) for (let x = 0; x < PW; x++) {
    for (let y = 63; y >= 0; y--) if (OCC[P[((y + 1) * PW + z) * PW + x]]) { top[z * PW + x] = y; break; }
  }
  return top;
}

// Đường chậm, dùng cho test và nơi chỉ có hàm get(x, y, z) theo toạ độ thế giới.
export function buildChunkMesh(get, cx, cz) {
  const P = new Uint8Array(PW * PH * PW);
  for (let y = -1; y <= 64; y++) for (let z = -1; z <= 16; z++) for (let x = -1; x <= 16; x++) {
    P[pidx(x, y, z)] = y < 0 ? 1 : y > 63 ? 0 : get(cx * 16 + x, y, cz * 16 + z);
  }
  return meshPadded(P, computeTop(P));
}

// Đường nhanh: đọc thẳng mảng chunk của World (cần các chunk lân cận, World tự sinh nếu thiếu).
export function meshChunk(world, cx, cz) {
  const P = new Uint8Array(PW * PH * PW);
  P.fill(1, 0, PLAYER);                                   // lớp dưới cùng (y = -1): đặc
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const arr = world.chunk(cx + dx, cz + dz);
    const x0 = dx < 0 ? 15 : 0, x1 = dx > 0 ? 0 : dx < 0 ? 15 : 15, z0 = dz < 0 ? 15 : 0, z1 = dz > 0 ? 0 : dz < 0 ? 15 : 15;
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const px = x + dx * 16, pz = z + dz * 16;
      for (let y = 0; y < 64; y++) P[((y + 1) * PW + (pz + 1)) * PW + (px + 1)] = arr[x + 16 * (z + 16 * y)];
    }
  }
  return meshPadded(P, computeTop(P));
}

export const transferables = m => [m.solid, m.water, m.plants].flatMap(p => [p.positions.buffer, p.uvs.buffer, p.colors.buffer, p.indices.buffer]);
