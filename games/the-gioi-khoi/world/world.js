// Thế giới: kho chunk nạp lười từ seed, cộng "delta" (các ô người chơi đã sửa) để lưu và đồng bộ.
import { generateChunk, CHUNK_W, CHUNK_H, WATER_LEVEL, idx } from './generate.js';
import { regionAt } from './regions.js';
import { B, BLOCKS, isSolid, isPlant } from './blocks.js';

const key = (cx, cz) => cx + ',' + cz;                 // khoá chuỗi: dùng cho delta/dirty (ít gọi)
const nkey = (cx, cz) => ((cx & 0xffff) << 16) | (cz & 0xffff);   // khoá số cho kho chunk (gọi rất nhiều lần)

export class World {
  constructor(seed) {
    this.seed = seed;
    this.chunks = new Map();     // khoá số (nkey) -> Uint8Array
    this.onSet = null; this.onChange = null;   // onChange(x, y, z, cũ, mới): hiệu ứng hình ảnh           // gọi (x, y, z, id) mỗi khi một ô đổi (để đồng bộ cho worker dựng mesh)
    this._lk = NaN; this._la = null;   // chunk truy cập gần nhất
    this.delta = new Map();      // "cx,cz" -> Map(idx -> id)
    this.dirty = new Set();      // chunk cần dựng lại mesh
  }

  chunk(cx, cz) {
    const k = nkey(cx, cz);
    if (k === this._lk) return this._la;
    let c = this.chunks.get(k);
    if (!c) {
      c = generateChunk(this.seed, cx, cz);
      const d = this.delta.get(key(cx, cz));
      if (d) for (const [i, id] of d) c[i] = id;
      this.chunks.set(k, c);
    }
    this._lk = k; this._la = c;
    return c;
  }

  // Nhận mảng chunk đã sinh ở nơi khác (worker). Bỏ qua nếu đã có; áp delta hiện tại lên trên.
  adopt(cx, cz, arr) {
    const k = nkey(cx, cz);
    if (this.chunks.has(k)) return false;
    const d = this.delta.get(key(cx, cz));
    if (d) for (const [i, id] of d) arr[i] = id;
    this.chunks.set(k, arr);
    return true;
  }

  // Lấy ra và xoá danh sách chunk bị sửa: [[cx, cz], ...].
  takeDirty() {
    const out = [...this.dirty].map(k => k.split(',').map(Number));
    this.dirty.clear();
    return out;
  }

  // Tập khoá số của các chunk trong bán kính (đơn vị chunk) quanh các điểm; p.r (nếu có) ghi đè bán kính.
  static keysAround(points, radius) {
    const set = new Set();
    for (const p of points) {
      const pcx = Math.floor(p.x / CHUNK_W), pcz = Math.floor(p.z / CHUNK_W), r = p.r ?? radius;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) set.add(nkey(pcx + dx, pcz + dz));
    }
    return set;
  }

  // Giữ các chunk quanh các điểm (bán kính radius) và quanh vùng giữ thêm `extra` ({x, z, r}); bỏ chunk ngoài cả hai.
  // generate=false: chỉ bỏ chunk thừa, không sinh chunk còn thiếu (người gọi tự nhận chunk từ worker hoặc sinh khi cần).
  keepAround(points, radius, extra = [], generate = true) {
    const need = World.keysAround(points, radius);
    for (const k of World.keysAround(extra, 0)) need.add(k);
    if (generate) for (const k of need) this.chunk(k >> 16, (k << 16) >> 16);
    for (const k of [...this.chunks.keys()]) if (!need.has(k)) { this.chunks.delete(k); this.dirty.delete(key(k >> 16, (k << 16) >> 16)); if (k === this._lk) { this._lk = NaN; this._la = null; } }
    return need;
  }

  has(cx, cz) { return this.chunks.has(nkey(cx, cz)); }
  unload(cx, cz) { const k = nkey(cx, cz); this.chunks.delete(k); this.dirty.delete(key(cx, cz)); if (k === this._lk) { this._lk = NaN; this._la = null; } }

  get(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0 || y >= CHUNK_H) return B.AIR;
    const cx = x >> 4, cz = z >> 4;
    return this.chunk(cx, cz)[(x & 15) + 16 * ((z & 15) + 16 * y)];
  }

  // Trả true nếu ô thật sự đổi. Ghi vào delta và đánh dấu chunk (và chunk kề nếu ở biên) cần dựng lại.
  set(x, y, z, id) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0 || y >= CHUNK_H) return false;
    const cx = x >> 4, cz = z >> 4, lx = x - cx * 16, lz = z - cz * 16, c = this.chunk(cx, cz), i = idx(lx, y, lz);
    if (c[i] === id) return false;
    const prev = c[i];
    c[i] = id;
    const k = key(cx, cz);
    if (!this.delta.has(k)) this.delta.set(k, new Map());
    this.delta.get(k).set(i, id);
    this.dirty.add(k);
    if (this.onSet) this.onSet(x, y, z, id);
    if (this.onChange) this.onChange(x, y, z, prev, id);
    if (lx === 0) this.dirty.add(key(cx - 1, cz));
    if (lx === 15) this.dirty.add(key(cx + 1, cz));
    if (lz === 0) this.dirty.add(key(cx, cz - 1));
    if (lz === 15) this.dirty.add(key(cx, cz + 1));
    return true;
  }

  // Mỗi chunk là mảng phẳng [chỉ số, độ dài, id, ...] (mã hoá chạy: ô liền kề cùng id gộp lại) nên gói chào và file lưu nhỏ.
  exportDelta() {
    const out = {};
    for (const [k, m] of this.delta) {
      const idx = [...m.keys()].sort((a, b) => a - b), arr = [];
      for (let i = 0; i < idx.length;) {
        const id = m.get(idx[i]); let j = i + 1;
        while (j < idx.length && idx[j] === idx[j - 1] + 1 && m.get(idx[j]) === id) j++;
        arr.push(idx[i], j - i, id); i = j;
      }
      out[k] = arr;
    }
    return out;
  }

  // Nhận cả hai dạng: mảng RLE mới và đối tượng { chỉ số: id } của file cũ.
  importDelta(obj) {
    for (const k of Object.keys(obj)) {
      const m = this.delta.get(k) || new Map(), v = obj[k];
      if (Array.isArray(v)) { for (let i = 0; i + 2 < v.length; i += 3) for (let n = 0; n < v[i + 1]; n++) m.set(v[i] + n, v[i + 2]); }
      else for (const i of Object.keys(v)) m.set(+i, v[i]);
      this.delta.set(k, m);
      const [cx, cz] = k.split(',').map(Number), c = this.chunks.get(nkey(cx, cz));
      if (c) { for (const [i, id] of m) c[i] = id; this.dirty.add(k); }
    }
  }

  // Y của ô đất cao nhất (bỏ qua nước, lá, thân cây, xương rồng).
  surfaceY(x, z) {
    for (let y = CHUNK_H - 1; y >= 0; y--) {
      const b = this.get(x, y, z);
      if (b !== B.AIR && b !== B.WATER && b !== B.LEAVES && b !== B.LOG && b !== B.CACTUS && !isPlant(b)) return y;
    }
    return 0;
  }

  regionAt(x, z) { return regionAt(this.seed, Math.floor(x), Math.floor(z)); }

  // Phía trên (y+1..y+5) của cột không có block nào (không bị cây che đầu).
  clearAbove(x, z) {
    const y = this.surfaceY(x, z);
    for (let dy = 1; dy <= 5; dy++) { const b = this.get(x, y + dy, z); if (b !== B.AIR && !isPlant(b)) return false; }
    return true;
  }

  // Tìm điểm xuất hiện gần gốc toạ độ: đất trên mực nước, thuộc vùng rừng, không bị cây che đầu.
  findSpawn() {
    for (let r = 0; r < 400; r += 4) {
      for (let a = 0; a < 8; a++) {
        const x = Math.round(r * [1, 1, 0, -1, -1, -1, 0, 1][a] * (a % 2 ? 0.7 : 1)), z = Math.round(r * [0, 1, 1, 1, 0, -1, -1, -1][a] * (a % 2 ? 0.7 : 1));
        if (this.surfaceY(x, z) > WATER_LEVEL + 1 && this.regionAt(x, z) === 'rung-suong' && this.clearAbove(x, z)) return { x, z };
      }
    }
    return { x: 0, z: 0 };
  }

  // Tia qua lưới (DDA). Trả { pos, normal, id, dist } của block đặc đầu tiên trúng, hoặc null.
  raycast(o, d, maxDist = 6) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = d.x > 0 ? 1 : -1, sy = d.y > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
    const inv = v => (v === 0 ? Infinity : Math.abs(1 / v));
    const dx = inv(d.x), dy = inv(d.y), dz = inv(d.z);
    let tx = d.x === 0 ? Infinity : ((d.x > 0 ? x + 1 - o.x : o.x - x) * dx);
    let ty = d.y === 0 ? Infinity : ((d.y > 0 ? y + 1 - o.y : o.y - y) * dy);
    let tz = d.z === 0 ? Infinity : ((d.z > 0 ? z + 1 - o.z : o.z - z) * dz);
    let n = { x: 0, y: 0, z: 0 }, t = 0;
    for (let i = 0; i < 512 && t <= maxDist; i++) {
      const id = this.get(x, y, z);
      if (id !== B.AIR && id !== B.WATER) return { pos: { x, y, z }, normal: n, id, dist: t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += dx; n = { x: -sx, y: 0, z: 0 }; }
      else if (ty < tz) { y += sy; t = ty; ty += dy; n = { x: 0, y: -sy, z: 0 }; }
      else { z += sz; t = tz; tz += dz; n = { x: 0, y: 0, z: -sz }; }
    }
    return null;
  }

  // Đường thẳng từ A tới B có thông không (không bị block đặc hoặc lá che)? Dùng cho tầm nhìn của quái.
  lineClear(ax, ay, az, bx, by, bz) {
    let x = Math.floor(ax), y = Math.floor(ay), z = Math.floor(az);
    const ex = Math.floor(bx), ey = Math.floor(by), ez = Math.floor(bz);
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx === 0 ? Infinity : Math.abs(1 / dx), tdy = dy === 0 ? Infinity : Math.abs(1 / dy), tdz = dz === 0 ? Infinity : Math.abs(1 / dz);
    let tx = dx === 0 ? Infinity : (dx > 0 ? x + 1 - ax : ax - x) * tdx, ty = dy === 0 ? Infinity : (dy > 0 ? y + 1 - ay : ay - y) * tdy, tz = dz === 0 ? Infinity : (dz > 0 ? z + 1 - az : az - z) * tdz;
    for (let i = 0; i < 256; i++) {
      if (x === ex && y === ey && z === ez) return true;
      if (tx < ty && tx < tz) { x += sx; tx += tdx; } else if (ty < tz) { y += sy; ty += tdy; } else { z += sz; tz += tdz; }
      if (x === ex && y === ey && z === ez) return true;
      const id = this.get(x, y, z);
      if (id !== B.AIR && id !== B.WATER && (BLOCKS[id].opaque || id === B.LEAVES)) return false;
    }
    return true;
  }

  isSolidAt(x, y, z) { return isSolid(this.get(x, y, z)); }
}
