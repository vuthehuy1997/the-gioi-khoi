// Trồng trọt: cuốc đất, gieo, thu hoạch, cây lớn theo thời gian, đất ướt/khô, lưu/nạp. Chỉ host chạy.
// Mỗi giai đoạn cây là một id block riêng (delta chỉ lưu id). Bộ đếm là "giây tích luỹ" nên đóng băng được khi không có ai ở gần (R-26).
import * as ach from './achievements.js';
import { B, BLOCKS, BLOCK_BY_NAME, CROP_BLOCKS, cropOf, isFarmland, isPlant, isSolid } from '../world/blocks.js';
import { CROPS, SOIL, COLD_REGIONS, CROP_STAGES } from '../content/farming.js';
import { ITEMS } from '../content/items.js';
import { removeItem } from './inventory.js';

export const SIM_RANGE = 64, FARM_PASS = 1, CROP_SETS_PER_PASS = 24, FARM_REVERT = 300, WET_R = 4, WET_EVERY_PASSES = 5, SEED_FROM_GRASS = 0.12;
const SOIL_IDS = new Set(SOIL.map(n => BLOCK_BY_NAME[n].id));
const ck = (x, y, z) => x + ',' + y + ',' + z;
const bad = a => !a || !Number.isInteger(a.x) || !Number.isInteger(a.y) || !Number.isInteger(a.z);
const fail = reason => ({ ok: false, reason });
const plantOf = id => { const it = ITEMS[id]; return it && it.plant && CROPS[it.plant] ? it.plant : null; };       // vật phẩm này gieo ra cây gì
const noDeco = id => id === B.AIR || (isPlant(id) && !BLOCKS[id].deco);          // ô trống hoặc cây cỏ thường (cỏ cao, hoa): cày/gieo được lên trên

// Có nước trong khối ngang ±4 và từ 1 block thấp hơn đến cùng độ cao với ô đất (x, y, z)?
export function wetAt(world, x, y, z) {
  for (let dy = -1; dy <= 0; dy++) for (let dz = -WET_R; dz <= WET_R; dz++) for (let dx = -WET_R; dx <= WET_R; dx++) if (world.get(x + dx, y + dy, z + dz) === B.WATER) return true;
  return false;
}
const farmlandFor = wet => (wet ? B.FARMLAND_WET : B.FARMLAND);

export function sampleYield(g, kind) {
  return CROPS[kind].yield.map(y => ({ item: y.item, n: y.min + Math.floor(g.rng() * (y.max - y.min + 1)) }));
}

// ---- hành động ----
export function actTill(g, p, a) {
  if (bad(a)) return fail('bad-args');
  if (!g.inReach(p, a.x, a.y, a.z)) return fail('reach');
  const h = g.held(p);
  if (!h || !h.tool || h.tool.type !== 'hoe') return fail('not-hoe');
  if (!SOIL_IDS.has(g.world.get(a.x, a.y, a.z))) return fail('not-soil');
  const above = g.world.get(a.x, a.y + 1, a.z);
  if (!noDeco(above)) return fail('blocked');
  if (above !== B.AIR) g.setBlock(a.x, a.y + 1, a.z, B.AIR);                     // cỏ phía trên bị xoá, không rơi đồ
  g.setBlock(a.x, a.y, a.z, farmlandFor(wetAt(g.world, a.x, a.y, a.z)));
  g.farm.set(ck(a.x, a.y, a.z), 0);
  g.makeNoise(a.x + 0.5, a.y + 0.5, a.z + 0.5, 6);
  g.emit(p.uid, { t: 'snd', n: 'till' });
  return { ok: true };
}

export function actPlant(g, p, a) {
  if (bad(a)) return fail('bad-args');
  if (!g.inReach(p, a.x, a.y, a.z)) return fail('reach');
  const s = p.inv[p.sel], it = s && plantOf(s.id);
  if (!it) return fail('not-seed');
  if (!isFarmland(g.world.get(a.x, a.y, a.z))) return fail('not-farmland');
  const above = g.world.get(a.x, a.y + 1, a.z);
  if (!noDeco(above) || g.crops.has(ck(a.x, a.y + 1, a.z))) return fail('blocked');
  if (!g.setBlock(a.x, a.y + 1, a.z, CROP_BLOCKS[it][0])) return fail('blocked');                      // ngoài biên thế giới
  g.crops.set(ck(a.x, a.y + 1, a.z), { k: it, s: 0, g: 0, x: a.x, y: a.y + 1, z: a.z });
  g.farm.delete(ck(a.x, a.y, a.z));
  removeItem(p.inv, s.id, 1); g.touch(p);
  g.makeNoise(a.x + 0.5, a.y + 0.5, a.z + 0.5, 4);
  g.emit(p.uid, { t: 'snd', n: 'sprout' });
  return { ok: true };
}

// Thu hoạch bằng bấm phải: chỉ cây chín; nhận sản lượng trừ 1 hạt/củ, cây quay về giai đoạn 0 (tự gieo lại).
export function actHarvest(g, p, a) {
  if (bad(a)) return fail('bad-args');
  if (!g.inReach(p, a.x, a.y, a.z)) return fail('reach');
  const c = cropOf(g.world.get(a.x, a.y, a.z));
  if (!c) return fail('not-crop');
  if (c.stage < CROP_STAGES - 1) return fail('unripe');                           // người đến sau thấy cây đã về giai đoạn 0
  const seed = CROPS[c.kind].seed;
  for (const y of sampleYield(g, c.kind)) { const n = y.item === seed ? y.n - 1 : y.n; if (n > 0) g.collect(p, y.item, n, a.x + 0.5, a.y + 0.5, a.z + 0.5); }
  g.setBlock(a.x, a.y, a.z, CROP_BLOCKS[c.kind][0]);
  const e = g.crops.get(ck(a.x, a.y, a.z));
  if (e) { e.s = 0; e.g = 0; } else g.crops.set(ck(a.x, a.y, a.z), { k: c.kind, s: 0, g: 0, x: a.x, y: a.y, z: a.z });
  g.makeNoise(a.x + 0.5, a.y + 0.5, a.z + 0.5, 5);
  g.emit(p.uid, { t: 'snd', n: 'harvest' });
  ach.bump(g, p, 'harvest');
  return { ok: true };
}

// Người chơi vừa phá block `id` ở (x, y, z) (block đã thành không khí): cây chín cho đủ sản lượng, chưa chín chỉ trả 1 hạt; cỏ cao có thể rơi hạt lúa mì.
export function onBreak(g, p, x, y, z, id) {
  const c = cropOf(id);
  if (c) {
    if (c.stage >= CROP_STAGES - 1) for (const y2 of sampleYield(g, c.kind)) g.collect(p, y2.item, y2.n, x + 0.5, y + 0.5, z + 0.5);
    else g.collect(p, CROPS[c.kind].seed, 1, x + 0.5, y + 0.5, z + 0.5);
    g.emit(p.uid, { t: 'snd', n: 'harvest' });
    return;
  }
  if (id === B.TALL_GRASS && g.rng() < SEED_FROM_GRASS) g.collect(p, 'wheat_seed', 1, x + 0.5, y + 0.5, z + 0.5);
}

// Mỗi lần block đổi qua Game.setBlock (prev -> id): dọn sổ cây/ruộng, cây gãy khi mất đất, đất cày thành dirt khi bị đè block đặc, nước đổi thì quét lại độ ẩm.
export function onBlockSet(g, x, y, z, prev, id) {
  if (prev === B.WATER || id === B.WATER) g.farmDirty = true;
  const pc = cropOf(prev), nc = cropOf(id);
  if (pc && !(nc && nc.kind === pc.kind)) {                                       // cây biến mất (bị phá hoặc gãy)
    g.crops.delete(ck(x, y, z));
    if (isFarmland(g.world.get(x, y - 1, z))) g.farm.set(ck(x, y - 1, z), 0);
  }
  if (isFarmland(prev) && !isFarmland(id)) {                                      // đất cày không còn
    g.farm.delete(ck(x, y, z));
    const up = cropOf(g.world.get(x, y + 1, z));
    if (up) { g.setBlock(x, y + 1, z, B.AIR); g.dropItem(CROPS[up.kind].seed, 1, x + 0.5, y + 1.2, z + 0.5); }
  }
  if (id !== B.AIR && isSolid(id) && !isFarmland(id) && isFarmland(g.world.get(x, y - 1, z))) g.setBlock(x, y - 1, z, B.DIRT);       // đặt block đặc lên đất cày
}

// ---- mô phỏng theo thời gian ----
const inRange = (ps, x, z) => { for (const p of ps) if (Math.hypot(p.x - x, p.z - z) <= SIM_RANGE) return true; return false; };

// Mỗi 1 giây (gộp nếu dt lớn): cây trong 64 block quanh người chơi sống lớn lên; ruộng trống lâu thì về dirt; đất cày cập nhật ẩm/khô.
export function farmTick(g, dt) {
  g.farmAcc = (g.farmAcc || 0) + dt;
  if (g.farmAcc < FARM_PASS) return;
  const step = g.farmAcc; g.farmAcc = 0; g.farmPass = (g.farmPass || 0) + 1;
  const ps = [...g.players.values()].filter(p => !p.dead);
  if (!ps.length) return;
  const dirty = !!g.farmDirty; g.farmDirty = false;
  const w = g.world, pass = g.farmPass;
  let sets = 0;
  const refreshWet = (x, y, z, id) => {                                            // đất ướt khi có nước gần; kiểm lại khi nước đổi hoặc xoay vòng 5 giây
    if (!dirty && ((x * 31 + y * 7 + z * 17) % WET_EVERY_PASSES + WET_EVERY_PASSES) % WET_EVERY_PASSES !== pass % WET_EVERY_PASSES) return;
    const want = farmlandFor(wetAt(w, x, y, z));
    if (want !== id) g.setBlock(x, y, z, want, true);
  };
  for (const [k, c] of g.crops) {
    if (!inRange(ps, c.x, c.z)) continue;                                          // ngoài tầm: đóng băng, giữ nguyên tiến trình
    const cc = cropOf(w.get(c.x, c.y, c.z));
    if (!cc || cc.kind !== c.k) { g.crops.delete(k); continue; }                    // block đã bị thay ngoài đường chuẩn
    const below = w.get(c.x, c.y - 1, c.z);
    if (!isFarmland(below)) { g.setBlock(c.x, c.y, c.z, B.AIR); g.dropItem(CROPS[c.k].seed, 1, c.x + 0.5, c.y + 0.2, c.z + 0.5); continue; }
    refreshWet(c.x, c.y - 1, c.z, below);
    if (c.cold === undefined) c.cold = COLD_REGIONS.includes(w.regionAt(c.x, c.z));
    const wet = w.get(c.x, c.y - 1, c.z) === B.FARMLAND_WET;
    c.g += step * (wet ? 2 : 1) * (c.cold ? 0.5 : 1);
    const s = Math.min(CROP_STAGES - 1, Math.floor(c.g * (CROP_STAGES - 1) / CROPS[c.k].secs + 1e-9));
    if (s > c.s && sets < CROP_SETS_PER_PASS) { c.s = s; sets++; g.setBlock(c.x, c.y, c.z, CROP_BLOCKS[c.k][s], true); }
  }
  for (const [k, t] of [...g.farm]) {
    const [x, y, z] = k.split(',').map(Number);
    if (!inRange(ps, x, z)) continue;
    const id = w.get(x, y, z);
    if (!isFarmland(id) || cropOf(w.get(x, y + 1, z))) { g.farm.delete(k); continue; }
    refreshWet(x, y, z, id);
    if (t + step >= FARM_REVERT) { g.farm.delete(k); g.setBlock(x, y, z, B.DIRT, true); } else g.farm.set(k, t + step);
  }
}

// ---- lưu / nạp ----
export function serializeFarm(g) {
  const crops = {}, farm = {};
  for (const [k, c] of g.crops) crops[k] = { k: c.k, g: Math.round(c.g * 100) / 100, s: c.s };
  for (const [k, t] of g.farm) farm[k] = Math.round(t * 100) / 100;
  return { crops, farm };
}

const parseKey = k => { const m = /^(-?\d+),(-?\d+),(-?\d+)$/.exec(k); return m ? [+m[1], +m[2], +m[3]] : null; };

// Nạp sổ cây/ruộng từ save: bỏ mục mà block không còn đúng (phá lúc tắt máy); block cây/đất cày có trong delta mà thiếu mục thì tạo lại (save hỏng/dựng tay).
export function restoreFarm(g, save) {
  const w = g.world;
  g.crops.clear(); g.farm.clear();
  for (const [k, v] of Object.entries((save && save.crops) || {})) {
    const xyz = parseKey(k), cc = xyz && cropOf(w.get(...xyz));
    if (!cc || !v || cc.kind !== v.k || !CROPS[cc.kind]) continue;
    const secs = CROPS[cc.kind].secs, lo = secs * cc.stage / (CROP_STAGES - 1);
    const gg = Number.isFinite(v.g) ? Math.max(lo, Math.min(secs, v.g)) : lo;
    g.crops.set(k, { k: cc.kind, s: cc.stage, g: gg, x: xyz[0], y: xyz[1], z: xyz[2] });
  }
  for (const [k, t] of Object.entries((save && save.farm) || {})) {
    const xyz = parseKey(k);
    if (xyz && isFarmland(w.get(...xyz)) && !cropOf(w.get(xyz[0], xyz[1] + 1, xyz[2])) && Number.isFinite(t)) g.farm.set(k, Math.max(0, Math.min(FARM_REVERT, t)));
  }
  for (const [ck2, m] of w.delta) {                                                // block có trong delta nhưng thiếu mục sổ
    const [cx, cz] = ck2.split(',').map(Number);
    for (const [i, id] of m) {
      const c = cropOf(id), fl = isFarmland(id);
      if (!c && !fl) continue;
      const x = cx * 16 + (i & 15), z = cz * 16 + ((i >> 4) & 15), y = i >> 8, k = ck(x, y, z);
      if (c && !g.crops.has(k)) g.crops.set(k, { k: c.kind, s: c.stage, g: CROPS[c.kind].secs * c.stage / (CROP_STAGES - 1), x, y, z });
      else if (fl && !g.farm.has(k) && !cropOf(w.get(x, y + 1, z))) g.farm.set(k, 0);
    }
  }
}
