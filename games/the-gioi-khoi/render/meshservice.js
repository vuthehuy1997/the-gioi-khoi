// Dịch vụ dựng mesh: gửi yêu cầu cho worker và nhận kết quả. Nếu không tạo được Worker thì dựng đồng bộ (chậm hơn nhưng vẫn chạy).
import { meshChunk } from './mesher.js';

export class MeshService {
  constructor(world, { useWorker = true } = {}) {
    this.world = world; this.worker = null; this.ready = []; this.inflight = new Map(); this.rid = 1; this.sync = !useWorker;
    if (useWorker) {
      try {
        this.worker = new Worker(new URL('./chunk.worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = e => { const m = e.data; if (m.t === 'mesh') { this.inflight.delete(m.cx + ',' + m.cz); this.ready.push(m); } };
        this.worker.onerror = () => { this.worker = null; this.sync = true; this.fail(); };
        this.worker.postMessage({ t: 'init', seed: world.seed, delta: world.exportDelta() });
      } catch (e) { this.worker = null; this.sync = true; }
    }
    // mọi chỉnh sửa trên thế giới chính được báo cho worker để mesh luôn khớp
    world.onSet = (x, y, z, id) => { if (this.worker) this.worker.postMessage({ t: 'set', x, y, z, id }); };
  }

  get busy() { return this.inflight.size; }
  fail() { this.inflight.clear(); }

  // Yêu cầu dựng mesh chunk (cx, cz). needData: gửi kèm mảng chunk để thế giới chính dùng (khỏi sinh lại).
  request(cx, cz) {
    const k = cx + ',' + cz;
    if (this.inflight.has(k)) return;
    const needData = !this.world.has(cx, cz);
    if (this.worker) { this.inflight.set(k, true); this.worker.postMessage({ t: 'mesh', cx, cz, rid: this.rid++, needData }); }
    else this.ready.push({ cx, cz, mesh: meshChunk(this.world, cx, cz), chunk: null });
  }

  // Lấy tối đa n kết quả đã xong.
  take(n) { return this.ready.splice(0, n); }
  dispose() { if (this.worker) this.worker.terminate(); this.worker = null; }
}
