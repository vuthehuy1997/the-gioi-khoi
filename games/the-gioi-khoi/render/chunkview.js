// Giữ lưới 3D khớp với thế giới quanh người chơi: nạp chunk mới, dựng lại chunk bị sửa, bỏ chunk xa.
// Mỗi lần update chỉ dựng tối đa `budget` chunk để không giật khung hình.
import { buildChunkMesh } from './mesher.js';
import { World } from '../world/world.js';

export class ChunkView {
  constructor(world, scene, { radius = 6, budget = 3 } = {}) {
    this.world = world; this.scene = scene; this.radius = radius; this.budget = budget;
    this.built = new Set();
  }

  // Trả số chunk còn chờ dựng (0 nghĩa là đã đủ).
  update(points, budget = this.budget, keep = []) {
    const w = this.world, get = (x, y, z) => w.get(x, y, z);
    w.keepAround(points, this.radius, keep);                 // giữ cả chunk quanh người chơi khác (mô phỏng cần)
    const need = World.keysAround(points, this.radius);      // chỉ phần quanh người xem mới dựng mesh
    for (const k of [...this.built]) if (!need.has(k)) { const [cx, cz] = k.split(',').map(Number); this.scene.removeChunk(cx, cz); this.built.delete(k); }
    const p = points[0];
    const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16);
    const todo = [...need].filter(k => !this.built.has(k) || w.dirty.has(k))
      .map(k => { const [cx, cz] = k.split(',').map(Number); return { k, cx, cz, d: Math.abs(cx - pcx) + Math.abs(cz - pcz) }; })
      .sort((a, b) => (w.dirty.has(a.k) ? -1 : 0) - (w.dirty.has(b.k) ? -1 : 0) || a.d - b.d);
    let n = 0;
    for (const t of todo) {
      if (n >= budget) break;
      this.scene.setChunkMesh(t.cx, t.cz, buildChunkMesh(get, t.cx, t.cz));
      this.built.add(t.k); w.dirty.delete(t.k); n++;
    }
    return todo.length - n;
  }
}
