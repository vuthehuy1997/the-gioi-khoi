// Giữ lưới 3D khớp với thế giới quanh người chơi. Chunk mới được sinh + dựng mesh ở worker (nhận kết quả mỗi khung một ít);
// chunk bị người chơi sửa được dựng lại ngay trên luồng chính (một chunk vài ms) để thấy tức thì.
import { meshChunk } from './mesher.js';
import { MeshService } from './meshservice.js';
import { World } from '../world/world.js';

export class ChunkView {
  constructor(world, scene, { radius = 6, apply = 4, inflight = 6, useWorker = true } = {}) {
    this.world = world; this.scene = scene; this.radius = radius; this.apply = apply; this.maxInflight = inflight;
    this.built = new Set();            // khoá số các chunk đã có mesh
    this.want = [];                    // hàng đợi (gần trước) các chunk cần dựng
    this.pcx = NaN; this.pcz = NaN; this.lastRadius = radius;
    this.svc = new MeshService(world, { useWorker });
  }

  setRadius(r) { this.radius = r; }

  // Trả số việc còn lại (chunk chờ dựng + đang dựng + cần dựng lại).
  update(points, budget = this.apply, keep = []) {
    const w = this.world, p = points[0], pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16);
    const moved = pcx !== this.pcx || pcz !== this.pcz || this.radius !== this.lastRadius;
    if (moved) {
      this.pcx = pcx; this.pcz = pcz; this.lastRadius = this.radius;
      w.keepAround(points, this.radius, keep, false);                          // bỏ chunk xa; không sinh đồng bộ
      const need = World.keysAround(points, this.radius);
      for (const k of [...this.built]) if (!need.has(k)) { this.scene.removeChunk(k >> 16, (k << 16) >> 16); this.built.delete(k); }
      this.want = [...need].filter(k => !this.built.has(k)).map(k => { const cx = k >> 16, cz = (k << 16) >> 16; return { k, cx, cz, d: Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) * 100 + Math.abs(cx - pcx) + Math.abs(cz - pcz) }; })
        .sort((a, b) => a.d - b.d);
    }
    // gửi yêu cầu cho worker (gần trước)
    while (this.want.length && this.svc.busy < this.maxInflight) { const t = this.want.shift(); if (!this.built.has(t.k)) this.svc.request(t.cx, t.cz); }
    // nhận kết quả
    let n = 0;
    for (const m of this.svc.take(budget)) {
      if (m.chunk) w.adopt(m.cx, m.cz, m.chunk);
      const k = ((m.cx & 0xffff) << 16) | (m.cz & 0xffff);
      if (World.keysAround([p], this.radius).has(k)) { this.scene.setChunkMesh(m.cx, m.cz, m.mesh); this.built.add(k); }
      n++;
    }
    // chunk bị sửa: dựng lại ngay (đồng bộ), chunk đã dựng mới cần
    let redo = 0;
    for (const [cx, cz] of w.takeDirty()) {
      const k = ((cx & 0xffff) << 16) | (cz & 0xffff);
      if (!this.built.has(k)) continue;
      this.scene.setChunkMesh(cx, cz, meshChunk(w, cx, cz)); redo++;
    }
    return this.want.length + this.svc.busy + this.svc.ready.length;
  }

  // Dựng đồng bộ toàn bộ quanh một điểm (dùng khi cần ngay, ví dụ lúc bắt đầu hoặc trong test).
  buildNow(points) {
    const w = this.world, need = World.keysAround(points, this.radius);
    w.keepAround(points, this.radius, [], true);
    for (const k of need) { const cx = k >> 16, cz = (k << 16) >> 16; this.scene.setChunkMesh(cx, cz, meshChunk(w, cx, cz)); this.built.add(k); }
    w.takeDirty();
  }
}
