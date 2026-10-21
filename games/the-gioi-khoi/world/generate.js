// Sinh một chunk 16x16x64 từ seed. Hàm thuần: cùng (seed, cx, cz) luôn cho cùng kết quả.
// Chỉ số ô: x + 16 * (z + 16 * y).
import { hash, fbm2, noise3, smoothstep } from './noise.js';
import { climate, zone, regionOf, baseRegion } from './regions.js';
import { B, BLOCK_BY_NAME, isPlant } from './blocks.js';

export const CHUNK_W = 16, CHUNK_H = 64, WATER_LEVEL = 20;
export const idx = (x, y, z) => x + 16 * (z + 16 * y);

// Thông tin một cột: vùng và độ cao mặt đất.
export function columnInfo(seed, wx, wz) {
  const c = climate(seed, wx, wz);
  const w = zone(seed, wx, wz), region = regionOf(c, w);
  const mt = smoothstep(0.5, 0.78, c), ds = 1 - smoothstep(0.2, 0.42, c);
  const base = 25 + mt * 12 - ds * 3, amp = 6 + mt * 16 - ds * 3;
  const n = fbm2(seed, wx * 0.022, wz * 0.022, 4);
  const hills = fbm2(seed + 500, wx * 0.0075, wz * 0.0075, 3);                 // đồi và thung lũng lớn (tạo hồ)
  const rg = 1 - Math.abs(2 * fbm2(seed + 700, wx * 0.013, wz * 0.013, 3) - 1);  // dãy núi gồ ghề
  let h = Math.floor(base + (n - 0.5) * 2 * amp + (hills - 0.5) * 16 * (1 - ds * 0.7) + mt * rg * 15);
  if (region.relief) {                                                         // vùng phủ: pha dần sang địa hình riêng từ mép vào trong
    const rl = region.relief, t = smoothstep(region.zone, region.zone + 0.07, w);
    h = Math.floor(h + (rl.base + (n - 0.5) * 2 * rl.amp + rg * rl.ridge - h) * t);
  }
  h = h < 3 ? 3 : h > CHUNK_H - 14 ? CHUNK_H - 14 : h;
  return { region, h };
}

// Cây hoặc xương rồng bắt đầu từ cột này (nếu có): { kind, height }.
function plantAt(seed, wx, wz, info) {
  if (info.h <= WATER_LEVEL + 1) return null;
  const r = info.region;
  if (hash(seed + 3, wx, wz) >= r.treeChance) return null;
  const hh = hash(seed + 4, wx, wz);
  if (!r.trees) return null;
  if (r.trees === 'spire') return { kind: 'spire', height: 3 + Math.floor(hh * 5) };
  if (r.trees === 'cactus') return { kind: 'cactus', height: 1 + Math.floor(hh * 3) };
  return { kind: r.trees, height: 4 + Math.floor(hh * 3) };
}

export function generateChunk(seed, cx, cz) {
  const out = new Uint8Array(CHUNK_W * CHUNK_W * CHUNK_H);
  const x0 = cx * CHUNK_W, z0 = cz * CHUNK_W;
  const infos = new Map();
  const info = (wx, wz) => { const k = wx + ',' + wz; let i = infos.get(k); if (!i) { i = columnInfo(seed, wx, wz); infos.set(k, i); } return i; };

  for (let lz = 0; lz < CHUNK_W; lz++) for (let lx = 0; lx < CHUNK_W; lx++) {
    const wx = x0 + lx, wz = z0 + lz, { region, h } = info(wx, wz);
    const surface = BLOCK_BY_NAME[region.surface].id, sub = BLOCK_BY_NAME[region.sub].id;
    for (let y = 0; y <= h; y++) {
      let b;
      if (y === 0) b = B.BEDROCK;
      else if (y === h) {
        b = (region.surface === 'snow' && h < 30) ? B.GRASS : surface;
        if (region.shore && h <= WATER_LEVEL + 1) b = BLOCK_BY_NAME[region.shore].id;
        else if (region.patch && fbm2(seed + 31, wx * 0.09, wz * 0.09, 2) > region.patch.above) b = BLOCK_BY_NAME[region.patch.block].id;
      }
      else if (y >= h - 3) b = sub;
      else {
        b = B.STONE;
        if (y > 2 && y < h - 4 && noise3(seed + 55, wx * 0.07, y * 0.09, wz * 0.07) > 0.8) b = B.AIR;     // hang động
        else if (y < 14 && hash(seed + 8, wx, y, wz) < 0.004) b = B.GEM_ORE;
        else if (hash(seed + 7, wx, y, wz) < 0.014) b = B.ORE;
        else if (y < 46 && hash(seed + 9, wx, y, wz) < 0.011) b = B.IRON_ORE;
        else if (y < 7 && noise3(seed + 77, wx * 0.1, y * 0.1, wz * 0.1) > 0.82) b = B.MAGMA;
      }
      out[idx(lx, y, lz)] = b;
    }
    for (let y = h + 1; y <= WATER_LEVEL; y++) out[idx(lx, y, lz)] = B.WATER;
    if (region.surface === 'snow' && h > 34 && hash(seed + 12, wx, wz) < 0.12) out[idx(lx, h, lz)] = B.ICE;
  }

  // Cỏ cao, hoa, bụi khô rải trên mặt đất
  for (let lz = 0; lz < CHUNK_W; lz++) for (let lx = 0; lx < CHUNK_W; lx++) {
    const { region, h } = info(x0 + lx, z0 + lz);
    if (h <= WATER_LEVEL || h >= CHUNK_H - 3) continue;
    const top = out[idx(lx, h, lz)], above = idx(lx, h + 1, lz);
    if (out[above] !== B.AIR) continue;
    const r = hash(seed + 21, x0 + lx, z0 + lz);
    if (region.flora) {
      if (top === B.MAGMA) continue;
      let acc = 0;
      for (const [name, p] of region.flora) { acc += p; if (r < acc) { out[above] = B[name]; break; } }
    } else if (top === B.GRASS) out[above] = r < 0.16 ? B.TALL_GRASS : r < 0.175 ? B.FLOWER_RED : r < 0.19 ? B.FLOWER_YELLOW : B.AIR;
    else if (top === B.SAND && region.surface === 'sand') out[above] = r < 0.012 ? B.DEAD_BUSH : B.AIR;
  }

  // Cây có thể tràn qua biên chunk, nên xét cả các cột lân cận trong bán kính 2.
  const put = (wx, y, wz, b, onlyAir = true) => {
    const lx = wx - x0, lz = wz - z0;
    if (lx < 0 || lz < 0 || lx >= CHUNK_W || lz >= CHUNK_W || y < 0 || y >= CHUNK_H) return;
    const i = idx(lx, y, lz);
    if (!onlyAir || out[i] === B.AIR || isPlant(out[i])) out[i] = b;
  };
  for (let dz = -2; dz < CHUNK_W + 2; dz++) for (let dx = -2; dx < CHUNK_W + 2; dx++) {
    const wx = x0 + dx, wz = z0 + dz, inf = info(wx, wz), p = plantAt(seed, wx, wz, inf);
    if (!p) continue;
    const top = inf.h + p.height;
    if (p.kind === 'spire') { for (let y = inf.h + 1; y <= top; y++) put(wx, y, wz, B.AMETHYST); continue; }
    if (p.kind === 'cactus') { for (let y = inf.h + 1; y <= top; y++) put(wx, y, wz, B.CACTUS); continue; }
    for (let y = inf.h + 1; y <= top; y++) put(wx, y, wz, B.LOG);
    const rad = p.kind === 'spruce' ? 1 : 2;
    for (let ly = top - 2; ly <= top + 1; ly++) for (let lzz = -rad; lzz <= rad; lzz++) for (let lxx = -rad; lxx <= rad; lxx++) {
      const d = Math.abs(lxx) + Math.abs(lzz) + (ly > top - 1 ? 1 : 0);
      if (d <= rad + 1 && !(lxx === 0 && lzz === 0 && ly <= top)) put(wx + lxx, ly, wz + lzz, B.LEAVES);
    }
  }
  return out;
}
