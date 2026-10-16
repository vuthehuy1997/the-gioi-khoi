// Dựng lưới (mesh) cho một chunk từ hàm get(x, y, z) theo toạ độ thế giới. Chỉ vẽ mặt không bị che.
// Trả { solid, water }, mỗi phần có positions/uvs/colors/indices dạng typed array; vị trí tính theo gốc chunk.
import { BLOCKS, B, ATLAS_COLS, ATLAS_ROWS } from '../world/blocks.js';

const FACES = [
  { n: [0, 1, 0], k: 0, shade: 1.0, c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], k: 2, shade: 0.55, c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [1, 0, 0], k: 1, shade: 0.82, c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], k: 1, shade: 0.82, c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 0, 1], k: 1, shade: 0.68, c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], k: 1, shade: 0.68, c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const INSET = 0.002;

function newPart() { return { p: [], u: [], c: [], i: [] }; }
function finish(m) {
  return { positions: new Float32Array(m.p), uvs: new Float32Array(m.u), colors: new Float32Array(m.c), indices: new Uint32Array(m.i) };
}

export function buildChunkMesh(get, cx, cz) {
  const solid = newPart(), water = newPart();
  const x0 = cx * 16, z0 = cz * 16;
  for (let y = 0; y < 64; y++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
    const wx = x0 + lx, wz = z0 + lz, id = get(wx, y, wz);
    if (id === B.AIR) continue;
    const def = BLOCKS[id], part = def.liquid ? water : solid;
    for (const f of FACES) {
      const nid = get(wx + f.n[0], y + f.n[1], wz + f.n[2]);
      const nd = BLOCKS[nid];
      if (nd.opaque || nid === id) continue;
      const tile = def.tiles[f.k], col = tile % ATLAS_COLS, row = Math.floor(tile / ATLAS_COLS);
      const base = part.p.length / 3;
      for (let v = 0; v < 4; v++) {
        part.p.push(lx + f.c[v][0], y + f.c[v][1], lz + f.c[v][2]);
        const du = UV[v][0] ? 1 - INSET : INSET, dv = UV[v][1] ? 1 - INSET : INSET;
        part.u.push((col + du) / ATLAS_COLS, 1 - (row + 1) / ATLAS_ROWS + dv / ATLAS_ROWS);
        part.c.push(f.shade, f.shade, f.shade);
      }
      part.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return { solid: finish(solid), water: finish(water) };
}
