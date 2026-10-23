// Hầm ngục theo vùng: dựng khuôn (cầu thang, 4 phòng, hành lang, cổng, rương, bẫy) bằng delta, rồi chạy phòng canh gác, bẫy, cổng, rương chia riêng và chủ hầm.
// Host quyết định mọi thứ; client chỉ vẽ lớp phủ bẫy theo g.time trong snapshot (hàm thuần trapPhase/spikeUp/ventState dùng chung).
// Toạ độ cục bộ (lx, lz) tính từ chân cầu thang O = (site.ox, site.oz): +X là hướng cầu thang đi xuống, +Z về phía nam; sàn phòng ở y = fy (ô đứng), khối sàn ở fy - 1.
import { B, BLOCKS, BLOCK_BY_NAME, isSolid } from '../world/blocks.js';
import { columnInfo, WATER_LEVEL } from '../world/generate.js';
import { DUNGEONS, THEMES, TRAP, GUARD, LAYOUT, LOOT, CHEST_TITLE } from '../content/dungeons.js';
import { BOSSES } from '../content/bosses.js';
import { ITEMS } from '../content/items.js';
import { MOBS } from '../content/mobs.js';
import { makeRng, hashStr } from './rng.js';
import { spawnMob } from './mobs.js';
import { startChase } from './perception.js';
import { countItem, removeItem } from './inventory.js';

const bid = n => BLOCK_BY_NAME[n].id;
const alive = g => [...g.players.values()].filter(p => !p.dead);

// ---------------------------------------------------------------- hàm thuần: nhịp bẫy theo thời gian
export const trapPhase = (t, period, offset = 0) => (((t + offset) % period) + period) % period;
export const spikeState = (t, off = 0) => { const ph = trapPhase(t, TRAP.spike.period, off); return ph < TRAP.spike.down ? 'down' : ph < TRAP.spike.down + TRAP.spike.warn ? 'warn' : 'up'; };
export const spikeUp = (t, off = 0) => spikeState(t, off) === 'up';
export const ventState = (t, off = 0) => { const ph = trapPhase(t, TRAP.vent.period, off); return ph < TRAP.vent.rest ? 'rest' : ph < TRAP.vent.rest + TRAP.vent.warn ? 'warn' : 'spray'; };
export const ventCycle = (t, off = 0) => Math.floor((t + off) / TRAP.vent.period);

// ---------------------------------------------------------------- khuôn bố cục
const STAGE_Z = [-13, -18, -24], STAGE_LEN = [5, 6, 4];          // z bắt đầu (gần cổng sắt) và chiều dài ba chặng bẫy của phòng P3
const P3X0 = 18, P3X1 = 28, DART_X = 29;                            // P3 rộng x 18..28; ống tên gắn vào tường đông x = 29
const P4C = { x: 2, z: -20 }, P4R2 = 90;                            // phòng chủ: tâm (2, -20), bán kính ~9,5
const K = (x, y, z) => ((x + 4096) * 8192 + (z + 4096)) * 128 + y;  // khoá số của một ô (tọa độ thế giới)

// Vị trí hầm hợp lệ? Save nhập từ file tuỳ ý có thể mang số bậy: bỏ qua thay vì lặp vô hạn hay đặt block lung tung.
export function siteOk(s) {
  return !!s && typeof s === 'object' && [s.ox, s.oz, s.fy, s.steps, s.gy, s.x, s.y, s.z].every(Number.isInteger) && s.steps >= 6 && s.steps <= 16 && s.fy >= 4 && s.fy <= 56 && s.gy > s.fy && s.gy < 64
    && !!s.c && Number.isFinite(s.c.x) && Number.isFinite(s.c.z) && !!s.p4 && Number.isFinite(s.p4.x) && Number.isFinite(s.p4.y) && Number.isFinite(s.p4.z);
}
// Hộp bao của hầm (tính bằng số học, không cần dựng khuôn): xv là mép phần phòng (x >= xv), yv chiều cao phần phòng.
export function boxOf(site) {
  const { ox, oz, fy, steps } = site;
  return { x0: ox - 2 * steps - 8, x1: ox + 31, z0: oz - 30, z1: oz + 6, y0: fy - 2, y1: Math.max(site.gy + 4, fy + 9), xv: ox + 1, yv: fy + 9 };
}

const layouts = new Map();
export function layoutOf(site, id) {
  const key = id + '|' + site.ox + ',' + site.oz + ',' + site.fy + ',' + site.steps;
  let L = layouts.get(key);
  if (!L) { L = computeLayout(site, id); layouts.set(key, L); if (layouts.size > 64) layouts.delete(layouts.keys().next().value); }
  return L;
}

function computeLayout(site, id) {
  const { ox, oz, fy, steps } = site, def = DUNGEONS[id], theme = THEMES[def.theme];
  const cav = new Set(), cavList = [], floorSet = new Set(), floorList = [];
  const addCol = (x, z, base, h) => {
    for (let y = base; y < base + h; y++) { const k = K(x, y, z); if (!cav.has(k)) { cav.add(k); cavList.push([x, y, z]); } }
    const fk = K(x, base - 1, z); if (!floorSet.has(fk)) { floorSet.add(fk); floorList.push([x, base - 1, z]); }
  };
  const rect = (x0, x1, z0, z1, h) => { for (let lx = x0; lx <= x1; lx++) for (let lz = z0; lz <= z1; lz++) addCol(ox + lx, oz + lz, fy, h); };
  for (let lx = -2 * steps; lx <= 0; lx++) for (let lz = -1; lz <= 1; lz++) addCol(ox + lx, oz + lz, fy + Math.ceil(-lx / 2), 3);      // cầu thang: bậc cao 1, mỗi bậc 2 ô
  rect(1, 11, -5, 5, 5);                                        // P1 sảnh
  rect(12, 17, -1, 1, 3);                                       // C1
  rect(18, 28, -5, 5, 6);                                       // P2 phòng canh gác
  rect(22, 24, -11, -6, 3);                                     // C2 (cổng sắt ở z = -11)
  rect(P3X0, P3X1, -28, -12, 5);                                // P3 phòng bẫy
  rect(12, 17, -21, -19, 3);                                    // C3 (cổng chủ ở x = 12)
  for (let lx = -8; lx <= 12; lx++) for (let lz = -30; lz <= -10; lz++) if ((lx - P4C.x) ** 2 + (lz - P4C.z) ** 2 <= P4R2) addCol(ox + lx, oz + lz, fy, 8);   // P4 phòng chủ

  const fl = bid(theme.floor), pil = bid(theme.pillar), blocks = [];          // [x, y, z, id] đặt sau khi đào
  const at = (lx, lz, dy = 0) => ({ x: ox + lx, y: fy + dy, z: oz + lz });
  const out = { id, site, cav, cavList, floorList, blocks, torches: [], spawns: [], spikes: [], plates: [], darts: [], vents: [], gates: {}, chests: {} };

  // cổng 3x3 (cổng sắt: mặt phẳng z = -11; cổng chủ: mặt phẳng x = 12)
  const gate = (kind, cells) => { out.gates[kind] = { kind, key: LAYOUT.gates[kind].key, block: kind === 'iron' ? B.GATE_IRON : B.GATE_BOSS, cells }; for (const c of cells) blocks.push([c[0], c[1], c[2], out.gates[kind].block]); };
  const gi = [], gb = [];
  for (let lx = 22; lx <= 24; lx++) for (let dy = 0; dy < 3; dy++) gi.push([ox + lx, fy + dy, oz - 11]);
  for (let lz = -21; lz <= -19; lz++) for (let dy = 0; dy < 3; dy++) gb.push([ox + 12, fy + dy, oz + lz]);
  gate('iron', gi); gate('boss', gb);

  // rương: tiếp tế (P1), chiến thắng (giữa P2), cuối phòng bẫy, kho báu (giữa P4, chỉ xuất hiện khi chủ hầm chết)
  out.chests = { supply: at(10, -4), victory: at(23, 0), trap: at(23, -28), treasure: at(P4C.x, P4C.z) };
  for (const k of ['supply', 'victory', 'trap']) { const c = out.chests[k]; blocks.push([c.x, c.y, c.z, B.DCHEST]); }

  // đuốc ở 4 góc sảnh, 4 cột phòng chủ
  for (const [lx, lz] of [[1, -5], [11, -5], [1, 5], [11, 5]]) { const c = at(lx, lz); out.torches.push(c); blocks.push([c.x, c.y, c.z, B.TORCH]); }
  for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) for (let dy = 0; dy < 7; dy++) blocks.push([ox + P4C.x + dx, fy + dy, oz + P4C.z + dz, pil]);

  // điểm sinh quái phòng canh gác: 8 điểm cố định
  for (const [lx, lz] of [[19, -4], [23, -4], [27, -4], [19, 0], [27, 0], [19, 4], [23, 4], [27, 4]]) { const c = at(lx, lz); out.spawns.push({ x: c.x + 0.5, y: fy, z: c.z + 0.5 }); }

  // ba chặng bẫy của P3
  const extraWalls = [];
  def.traps.forEach((type, i) => {
    const s = STAGE_Z[i], len = STAGE_LEN[i], zEnd = s - len + 1;
    if (type === 'spike') {                                        // hai hàng 11 x 2 lệch pha 2 giây: hàng đầu chặng và hàng cuối chặng
      for (const [zs, off] of [[[s, s - 1], 0], [[zEnd + 1, zEnd], 2]]) for (const lz of zs) for (let lx = P3X0; lx <= P3X1; lx++) {
        const c = at(lx, lz, -1); out.spikes.push({ x: c.x, y: c.y, z: c.z, off, stage: i }); blocks.push([c.x, c.y, c.z, B.SPIKES]);
      }
    } else if (type === 'dart') {                                  // 3 tấm áp lực, 4 ống tên trên tường đông; mỗi tấm bắn một cặp (2 ống)
      [[20, s, 0], [25, s - 2, 1], [21, s - 3, 0]].forEach(([lx, lz, pair]) => { const c = at(lx, lz, -1); out.plates.push({ x: c.x, y: c.y, z: c.z, pair, stage: i }); blocks.push([c.x, c.y, c.z, B.PLATE]); });
      for (let k = 0; k < 4; k++) {
        const c = at(DART_X, s - k, 1); out.darts.push({ x: c.x, y: c.y, z: c.z, pair: k % 2, stage: i }); blocks.push([c.x, c.y, c.z, B.DART_TRAP]);
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) extraWalls.push([c.x + 1, c.y + dy, c.z + dz]);          // dày thêm một lớp sau ống tên: phá ống không thủng ra ngoài
      }
    } else if (type === 'vent') {                                  // 2 ống phun giữa phòng, lệch pha
      [[21, s - 1, 0], [25, s - 2, 2.5]].forEach(([lx, lz, off]) => { const c = at(lx, lz, -1); out.vents.push({ x: c.x, y: c.y, z: c.z, off, stage: i }); blocks.push([c.x, c.y, c.z, B.VENT]); });
    }
  });

  // tường: mọi ô kề (26 hướng) của khoang và sàn mà không thuộc chúng; phía tây cổng cầu thang (lx < -2*steps) để thoáng cho miệng hầm
  const wallSet = new Set(), walls = [], inside = k => cav.has(k) || floorSet.has(k), lxMin = ox - 2 * steps;
  const wallAround = ([x, y, z]) => {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx < lxMin) continue;
      const k = K(nx, ny, nz); if (inside(k) || wallSet.has(k)) continue;
      wallSet.add(k); walls.push([nx, ny, nz]);
    }
  };
  for (const c of cavList) wallAround(c);
  for (const c of floorList) wallAround(c);
  for (const w of extraWalls) { const k = K(w[0], w[1], w[2]); if (!inside(k) && !wallSet.has(k)) { wallSet.add(k); walls.push(w); } }
  out.walls = walls; out.wallSet = wallSet; out.floorBlock = fl;
  out.floorKeys = floorSet;
  out.p2c = at(23, 0); out.p4c = at(P4C.x, P4C.z); out.foot = at(0, 0);
  out.box = boxOf(site);
  return out;
}

// Trong hầm? Phần cầu thang và miệng hầm (x < xv) cao tới y1; phần phòng chỉ tới yv (mặt đất phía trên các phòng không tính là trong hầm).
const inBox = (b, x, y, z) => x >= b.x0 && x <= b.x1 + 1 && z >= b.z0 && z <= b.z1 + 1 && y >= b.y0 && y <= (x >= b.xv ? b.yv : b.y1) + 1;

// Hầm chứa điểm (x, y, z)? -> { id, site, room } | null. Dùng cho HUD, cổng, cấm sinh quái.
export function dungeonAt(flags, x, y, z) {
  const ds = flags && flags.sites && flags.sites.dungeon;
  if (!ds) return null;
  for (const id of Object.keys(ds)) {
    const site = ds[id];
    if (!DUNGEONS[id] || !siteOk(site)) continue;
    if (inBox(boxOf(site), x, y, z)) return { id, site, room: roomOf(site, Math.floor(x) - site.ox, Math.floor(z) - site.oz) };
  }
  return null;
}

// Khoang chứa ô (lx, lz): mouth | stairs | p1 | c1 | p2 | c2 | p3 | c3 | p4
export function roomOf(site, lx, lz) {
  if ((lx - P4C.x) ** 2 + (lz - P4C.z) ** 2 <= P4R2 + 12) return 'p4';
  if (lx < 0) return lx <= -2 * site.steps - 1 ? 'mouth' : 'stairs';
  if (lx >= P3X0 - 1 && lx <= P3X1 + 1 && lz >= -29 && lz <= -12) return 'p3';
  if (lx >= 11 && lx <= 17 && lz >= -22 && lz <= -18) return 'c3';
  if (lx >= 21 && lx <= 25 && lz >= -12 && lz <= -6) return 'c2';
  if (lx >= 17 && lx <= 29 && lz >= -6 && lz <= 6) return 'p2';
  if (lx >= 11 && lx <= 17 && lz >= -2 && lz <= 2) return 'c1';
  return 'p1';
}
export const ROOM_NO = { mouth: 1, stairs: 1, p1: 1, c1: 1, p2: 2, c2: 2, p3: 3, c3: 3, p4: 4 };

// Tên hướng la bàn (8 hướng tiếng Việt) từ (x0, z0) tới (x1, z1); +X là Đông, +Z là Nam.
export function compass(x0, z0, x1, z1) {
  const a = Math.atan2(x1 - x0, -(z1 - z0)), i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'][i];
}

// ---------------------------------------------------------------- dựng
export function dstate(g, id) {
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(g.flags.dungeons)) g.flags.dungeons = {};
  const all = g.flags.dungeons;
  const st = isObj(all[id]) ? all[id] : (all[id] = {});                // trường thiếu hoặc sai kiểu (save hỏng) coi như rỗng
  if (!isObj(st.rooms)) st.rooms = {};
  if (!isObj(st.gates)) st.gates = {};
  if (!isObj(st.claimed)) st.claimed = {};
  for (const k of Object.keys(st.claimed)) if (!Array.isArray(st.claimed[k])) st.claimed[k] = [];
  return st;
}

export function buildDungeon(g, id, site) {
  const L = layoutOf(site, id), w = g.world, { ox, oz, fy, steps } = site, gy = site.gy;
  // miệng hầm: nền 7x7 lát gạch, dọn không khí phía trên, hai cột đuốc; lấp đất bên dưới
  const acc = bid(THEMES[DUNGEONS[id].theme].accent);
  for (let lx = -2 * steps - 7; lx <= -2 * steps - 1; lx++) for (let lz = -3; lz <= 3; lz++) {
    const x = ox + lx, z = oz + lz;
    for (let y = site.y - 1; y >= 1; y--) { const b = w.get(x, y, z); if (b !== B.AIR && b !== B.WATER) break; w.set(x, y, z, B.STONE); }
    w.set(x, site.y, z, acc);
    for (let y = gy; y <= gy + 5; y++) if (w.get(x, y, z) !== B.AIR) w.set(x, y, z, B.AIR);
  }
  for (const lz of [-3, 3]) { const x = ox - 2 * steps - 3, z = oz + lz; w.set(x, gy, z, acc); w.set(x, gy + 1, z, acc); w.set(x, gy + 2, z, B.TORCH); }
  for (const [x, y, z] of L.cavList) w.set(x, y, z, B.AIR);
  for (const [x, y, z] of L.floorList) w.set(x, y, z, L.floorBlock);
  for (const [x, y, z] of L.walls) w.set(x, y, z, B.DUNGEON_WALL);
  for (const [x, y, z, b] of L.blocks) w.set(x, y, z, b);
}

// Chọn tâm hầm (x, z) đủ điều kiện địa hình trong vùng `region`: trả vị trí hầm hoặc null. Miệng hầm và phòng chủ phải ở trên cạn; các mẫu phủ cả hộp bao quyết định độ sâu sàn (trần P4 còn cách mặt đất >= 2).
export function planSite(g, cx, cz, region) {
  const seed = g.world.seed, ox = cx, oz = cz + 12;
  for (const [x, z] of [[ox, oz], [ox + 2, oz - 20]]) { const c = columnInfo(seed, x, z); if (c.region.id !== region || c.h <= WATER_LEVEL + 1) return null; }
  let steps = 12;
  for (let iter = 0; iter < 4; iter++) {
    const mx = ox - 2 * steps - 4, mc = columnInfo(seed, mx, oz);
    if (mc.region.id !== region || mc.h <= WATER_LEVEL + 1) return null;
    let minH = mc.h;
    for (let lx = -2 * steps - 8; lx <= 31; lx += 6) for (let lz = -30; lz <= 6; lz += 6) {
      const h = columnInfo(seed, ox + lx, oz + lz).h;                     // đáy hồ cũng được (nước không chảy vào khoang), miễn trần P4 còn cách mặt đất >= 2
      if (h < minH) minH = h;
    }
    const gy = mc.h + 1, fy = Math.max(6, Math.min(gy - 6, minH - 11)), st = gy - fy;
    if (st > 16 || minH - (fy + 9) < 2) return null;
    if (st === steps) return makeSite(ox, oz, fy, steps, gy, mx);
    steps = st;
  }
  return null;
}

function makeSite(ox, oz, fy, steps, gy, mx) {
  return { ox, oz, fy, steps, gy, x: mx, y: gy - 1, z: oz, c: { x: ox, z: oz - 12 }, p4: { x: ox + P4C.x, y: fy - 1, z: oz + P4C.z } };
}

// Đặt một hầm ở vị trí cố định (dùng cho thử nghiệm): mặt đất tại miệng hầm lấy theo địa hình, sàn = mặt đất - steps.
export function forceSite(g, id, ox, oz, steps = 12) {
  const mx = ox - 2 * steps - 4, gy = columnInfo(g.world.seed, mx, oz).h + 1;
  const site = makeSite(ox, oz, gy - steps, steps, gy, mx);
  const sites = g.flags.sites || (g.flags.sites = { arena: {}, village: {} });
  (sites.dungeon || (sites.dungeon = {}))[id] = site;
  buildDungeon(g, id, site);
  return site;
}

// Có chunk nào trong hộp bao đã bị chỉnh sửa (delta) không? Thế giới cũ: bỏ điểm đó, không đè lên công trình người chơi.
export function boxEdited(g, site, id) {
  const b = layoutOf(site, id).box;
  for (let cx = b.x0 >> 4; cx <= (b.x1 + 1) >> 4; cx++) for (let cz = b.z0 >> 4; cz <= (b.z1 + 1) >> 4; cz++) if (g.world.delta.has(cx + ',' + cz)) return true;
  return false;
}

// Gần miệng hầm (bán kính 6,5)? Quái tự nhiên không được sinh ở đó hay trong khối bao của hầm.
export function nearDungeonMouth(g, x, z) {
  const ds = g.flags.sites && g.flags.sites.dungeon;
  if (!ds) return false;
  for (const s of Object.values(ds)) if (siteOk(s) && Math.hypot(x - s.x, z - s.z) <= 6.5) return true;
  return false;
}
export const noNaturalSpawn = (g, x, y, z) => nearDungeonMouth(g, x, z) || !!dungeonAt(g.flags, x, y, z);

// ---------------------------------------------------------------- chìa, cổng, rương
function toastTo(g, p, text) { g.emit(p.uid, { t: 'toast', text }); }
const intArgs = a => a && [a.x, a.y, a.z].every(Number.isInteger);

export function actGate(g, p, a) {
  if (!intArgs(a)) return { ok: false, reason: 'bad-args' };
  const blk = g.world.get(a.x, a.y, a.z);
  if (blk !== B.GATE_IRON && blk !== B.GATE_BOSS) return { ok: false, reason: 'not-gate' };
  if (!g.inReach(p, a.x, a.y, a.z)) return { ok: false, reason: 'reach' };
  const hit = dungeonAt(g.flags, a.x, a.y, a.z);
  if (!hit) return { ok: false, reason: 'not-gate' };
  const kind = blk === B.GATE_IRON ? 'iron' : 'boss', gate = layoutOf(hit.site, hit.id).gates[kind], key = LAYOUT.gates[kind].key;
  if (countItem(p.inv, key) < 1) { toastTo(g, p, kind === 'iron' ? 'Cần Chìa Hầm để mở cổng này.' : 'Cần Chìa Chủ Hầm để mở cổng này.'); return { ok: false, reason: kind === 'iron' ? 'need-key' : 'need-boss-key' }; }
  removeItem(p.inv, key, 1); g.touch(p);
  for (const [x, y, z] of gate.cells) g.setBlock(x, y, z, B.AIR, true);
  dstate(g, hit.id).gates[kind === 'iron' ? 'g' : 'b'] = true;
  emitState(g, hit.id, { gates: { [kind === 'iron' ? 'g' : 'b']: true } });
  return { ok: true };
}

// Rương tại ô (x, y, z) -> { id, kind } | null (so với toạ độ đã dựng của từng hầm).
export function chestAt(g, x, y, z) {
  const ds = g.flags.sites && g.flags.sites.dungeon;
  if (!ds) return null;
  for (const id of Object.keys(ds)) {
    if (!DUNGEONS[id] || !siteOk(ds[id])) continue;
    const ch = layoutOf(ds[id], id).chests;
    for (const kind of Object.keys(ch)) if (ch[kind].x === x && ch[kind].y === y && ch[kind].z === z) return { id, kind };
  }
  return null;
}

// Phần thưởng tất định theo (seed, hầm, rương, uid): không dùng g.rng. Mỗi dòng luôn rút đủ số ngẫu nhiên để chuỗi ổn định.
export function rewardFor(g, id, kind, uid) {
  const def = DUNGEONS[id], rng = makeRng(hashStr(`${g.seed}|${id}|${kind}|${uid}`)), out = [];
  for (const r of LOOT[kind]) {
    const roll = rng(), n = r.min + Math.floor(rng() * (r.max - r.min + 1)), pick = rng();
    let item = r.item;
    if (item === '$mat') item = def.mats[Math.floor(pick * def.mats.length)];
    else if (item === '$armor') item = `${def.armor}_${['helm', 'chest', 'legs', 'boots'][Math.floor(pick * 4)]}`;
    if (!r.fixed && r.p < 1 && roll >= r.p) continue;
    const have = out.find(o => o.item === item);
    if (have) have.n += n; else out.push({ item, n });
  }
  return out;
}

export function actDChest(g, p, a) {
  if (!intArgs(a)) return { ok: false, reason: 'bad-args' };
  if (g.world.get(a.x, a.y, a.z) !== B.DCHEST) return { ok: false, reason: 'not-chest' };
  if (!g.inReach(p, a.x, a.y, a.z)) return { ok: false, reason: 'reach' };
  const c = chestAt(g, a.x, a.y, a.z);
  if (!c) return { ok: false, reason: 'not-chest' };
  const st = dstate(g, c.id), need = LAYOUT.chests[c.kind].needs;
  if (need === 'p2' && !st.rooms.p2) { toastTo(g, p, 'Rương chưa mở được: hãy dọn sạch phòng canh gác trước.'); return { ok: false, reason: 'locked' }; }
  if (need === 'boss' && !st.boss) return { ok: false, reason: 'locked' };
  const title = CHEST_TITLE[c.kind], claimed = st.claimed[c.kind] || (st.claimed[c.kind] = []);
  if (claimed.includes(p.uid)) { g.emit(p.uid, { t: 'loot', title, items: [], claimed: true }); return { ok: true, claimed: true }; }
  claimed.push(p.uid);
  const items = rewardFor(g, c.id, c.kind, p.uid);
  for (const it of items) g.collect(p, it.item, it.n, p.x, p.y + 0.5, p.z);
  g.emit(p.uid, { t: 'loot', title, items });
  g.emit(p.uid, { t: 'snd', n: 'chestopen' });
  return { ok: true, items };
}

// ---------------------------------------------------------------- chủ hầm, phá bẫy, đặt block
export function onBossKilled(g, e, d) {
  const id = d.dungeon, site = g.flags.sites && g.flags.sites.dungeon && g.flags.sites.dungeon[id];
  if (!siteOk(site)) return;
  const st = dstate(g, id), c = layoutOf(site, id).chests.treasure;
  st.boss = true;
  g.setBlock(c.x, c.y, c.z, B.DCHEST, true);
  for (const p of g.nearbyPlayers(e, 30)) toastTo(g, p, `${d.name} đã gục! Rương kho báu hiện ra giữa phòng.`);
  emitState(g, id, { boss: true });
}

const floorOf = (g, x, y, z) => { const h = dungeonAt(g.flags, x, y, z); return h ? layoutOf(h.site, h.id).floorBlock : B.STONE_BRICK; };

// Phá tấm áp lực / ống phun: lớp sàn không thủng (thay bằng sàn chủ đề). Ống tên để lại ô trống (sau lưng có tường dày). Bẫy hết hiệu lực vĩnh viễn vì block đã mất.
export function onBreak(g, p, x, y, z, id) {
  if (id === B.PLATE || id === B.VENT) g.setBlock(x, y, z, floorOf(g, x, y, z), true);
}

// Đặt block lên gai: chỉ khi gai đang hạ; gai bị đè thì thay bằng sàn (hết hiệu lực vĩnh viễn). Trả { ok:false, reason } để từ chối, hoặc null.
export function beforePlace(g, p, a) {
  if (g.world.get(a.x, a.y - 1, a.z) !== B.SPIKES) return null;
  const hit = dungeonAt(g.flags, a.x, a.y, a.z);
  if (hit) {
    const row = layoutOf(hit.site, hit.id).spikes.find(s => s.x === a.x && s.z === a.z);
    if (row && spikeState(g.time, row.off) !== 'down') return { ok: false, reason: 'spike-up' };
  }
  g.setBlock(a.x, a.y - 1, a.z, floorOf(g, a.x, a.y, a.z), true);
  return null;
}

// ---------------------------------------------------------------- tick của host
function playersIn(g, b, pad = 0) {
  return alive(g).filter(p => p.x >= b.x0 - pad && p.x <= b.x1 + 1 + pad && p.z >= b.z0 - pad && p.z <= b.z1 + 1 + pad);
}

function emitState(g, id, extra = {}) {
  const site = g.flags.sites.dungeon[id], L = layoutOf(site, id), d = g.dg[id], st = dstate(g, id);
  const left = d && d.wave ? d.mobs.filter(m => g.ents.has(m)).length : 0;
  for (const p of playersIn(g, L.box, 0)) if (inBox(L.box, p.x, p.y, p.z)) g.emit(p.uid, { t: 'dungeon', id, left, rooms: { ...st.rooms }, boss: !!st.boss, ...extra });
}

function spawnWave(g, id, L, d, wave, inRoom) {
  const def = DUNGEONS[id], rng = makeRng(hashStr(`${g.seed}|${id}|wave${wave}`)), extra = Math.min(GUARD.extraMax, Math.max(0, inRoom - 1));
  const n = (wave === 1 ? GUARD.wave1 : GUARD.wave2) + extra, order = L.spawns.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const types = []; for (let i = 0; i < n; i++) types.push(def.mobs[Math.floor(rng() * def.mobs.length)]);
  if (wave === 2) types.push(GUARD.statue);
  const targets = alive(g);
  types.forEach((type, i) => {
    const pt = L.spawns[order[i % order.length]], e = spawnMob(g, type, pt.x, pt.y, pt.z, { persist: true, dg: id });
    d.mobs.push(e.id);
    let best = null, bd = Infinity;
    for (const p of targets) { const dd = Math.hypot(p.x - e.x, p.z - e.z); if (dd < bd) { bd = dd; best = p; } }
    if (best) startChase(g, e, MOBS[type], best);                     // quái phòng canh gác biết ngay có người
  });
}

function resetWave(g, id, d) {
  for (const m of d.mobs) g.ents.delete(m);
  for (const e of [...g.ents.values()]) if (e.dg === id) g.ents.delete(e.id);
  d.mobs = []; d.wave = 0; d.nextAt = null; d.sig = null;
}

function guardRoom(g, id, site, L, d, near) {
  const st = dstate(g, id), c = L.p2c, fy = site.fy;
  const inRoom = near.filter(p => Math.abs(p.y - fy) < 3 && p.x >= c.x - 5 && p.x < c.x + 6 && p.z >= c.z - 5 && p.z < c.z + 6);
  const close = near.filter(p => Math.abs(p.y - fy) < 3 && Math.hypot(p.x - (c.x + 0.5), p.z - (c.z + 0.5)) <= GUARD.trigger);
  const far = !near.some(p => Math.abs(p.y - fy) < 10 && Math.hypot(p.x - (c.x + 0.5), p.z - (c.z + 0.5)) <= GUARD.giveUp);
  if (st.rooms.p2) { if (d.wave) resetWave(g, id, d); return; }
  if (d.wave && far) { resetWave(g, id, d); emitState(g, id); return; }                // không còn ai gần: xoá đợt, phòng về chưa dọn
  d.mobs = d.mobs.filter(m => g.ents.has(m));
  if (d.wave === 0) {
    if (close.length) { d.wave = 1; spawnWave(g, id, L, d, 1, inRoom.length || 1); emitState(g, id); }
  } else if (d.wave === 1 && !d.mobs.length) {
    if (d.nextAt == null) d.nextAt = g.time + GUARD.gap;
    else if (g.time >= d.nextAt) { d.wave = 2; d.nextAt = null; spawnWave(g, id, L, d, 2, inRoom.length || 1); emitState(g, id); }
  } else if (d.wave === 2 && !d.mobs.length) {
    st.rooms.p2 = true; d.wave = 0; d.sig = null;
    for (const p of near) toastTo(g, p, 'Phòng canh gác đã dọn sạch! Rương chiến thắng đã mở.');
    emitState(g, id, { cleared: true });
    return;
  }
  const sig = d.wave + ':' + d.mobs.length;
  if (sig !== d.sig) { d.sig = sig; emitState(g, id); }                                // số quái còn đổi: báo cho người trong hầm
}

const proj = (g, x, y, z, vx, dmg, speed) => {
  const e = { id: g.nextId++, kind: 'proj', x, y, z, vx: Math.sign(vx) * speed, vy: 0, vz: 0, dmg, owner: null, ttl: 4, w: 0, h: 0, style: 'arrow', trap: true };
  g.ents.set(e.id, e); return e;
};

function trapTick(g, id, site, L, d, ps) {
  const t = g.time, fy = site.fy, w = g.world, src = { id: 'trap', x: site.ox + 23, y: fy, z: site.oz - 20 };
  // mũi tên hẹn giờ của tấm áp lực
  if (d.pending.length) {
    const rest = []; let fired = false;
    for (const q of d.pending) {
      if (t < q.at) { rest.push(q); continue; }
      for (const dt of L.darts) if (dt.pair === q.pair && dt.stage === q.stage && w.get(dt.x, dt.y, dt.z) === B.DART_TRAP) { proj(g, dt.x - 0.5, fy + 1.2, dt.z + 0.5, -1, TRAP.dart.dmg, TRAP.dart.speed); fired = true; }
      if (fired) for (const q2 of ps) g.emit(q2.uid, { t: 'snd', n: 'dart' });
    }
    d.pending = rest;
  }
  const trapRoom = ps.filter(p => Math.abs(p.y - fy) < 3 && p.x >= site.ox + P3X0 - 1 && p.x <= site.ox + DART_X && p.z >= site.oz - 29 && p.z <= site.oz - 11);
  for (const p of trapRoom) {
    for (const s of L.spikes) {                                                         // gai sàn
      if (Math.abs(p.x - (s.x + 0.5)) >= 0.8 || Math.abs(p.z - (s.z + 0.5)) >= 0.8) continue;
      if (!spikeUp(t, s.off) || p.y >= fy + 0.6 || t < (p.spikeAt || 0)) continue;
      if (w.get(s.x, s.y, s.z) !== B.SPIKES || isSolid(w.get(s.x, fy, s.z))) continue;
      p.spikeAt = t + TRAP.spike.gap;
      g.hurtPlayer(p, TRAP.spike.dmg, src, { blockable: false });
      break;
    }
    if (!p.sneak) for (const pl of L.plates) {                                          // tấm áp lực (rón rén thì không kích hoạt)
      if (Math.floor(p.x) !== pl.x || Math.floor(p.z) !== pl.z || Math.floor(p.y - 0.05) !== pl.y) continue;
      const k = pl.x + ',' + pl.z;
      if (w.get(pl.x, pl.y, pl.z) !== B.PLATE || t < (d.plateCd[k] || 0)) continue;
      d.plateCd[k] = t + TRAP.dart.cd; d.pending.push({ at: t + TRAP.dart.delay, pair: pl.pair, stage: pl.stage });
      for (const q of ps) g.emit(q.uid, { t: 'snd', n: 'plate' });
    }
    for (const v of L.vents) {                                                          // ống phun: một lần mỗi người mỗi đợt phun
      if (ventState(t, v.off) !== 'spray') continue;
      const dx = p.x - (v.x + 0.5), dz = p.z - (v.z + 0.5);
      if (dx * dx + dz * dz > TRAP.vent.radius ** 2 || p.y < fy - 0.5 || p.y > fy + 2.5 || w.get(v.x, v.y, v.z) !== B.VENT) continue;
      const cyc = ventCycle(t, v.off), key = v.x + ',' + v.z;
      p.ventAt = p.ventAt || {};
      if (p.ventAt[key] === cyc) continue;
      p.ventAt[key] = cyc;
      g.hurtPlayer(p, TRAP.vent.dmg, src, { blockable: false });
      g.emit(p.uid, { t: 'kb', vx: 0, vz: 0, vy: TRAP.vent.kick });
    }
  }
}

export function dungeonTick(g, dt) {
  const ds = g.flags.sites && g.flags.sites.dungeon;
  if (!ds) return;
  for (const id of Object.keys(ds)) {
    const site = ds[id];
    if (!DUNGEONS[id] || !siteOk(site)) continue;
    const d = g.dg[id] || (g.dg[id] = { wave: 0, mobs: [], nextAt: null, sig: null, pending: [], plateCd: {} });
    const near = playersIn(g, boxOf(site), 40);
    if (!near.length) {                                                                  // không ai trong 40 block: xoá quái hầm và mũi tên hẹn giờ (O(1) khi vắng)
      if (d.wave || d.mobs.length) resetWave(g, id, d);
      d.pending.length = 0;
      for (const p of g.players.values()) if (p.dgIn === id) p.dgIn = null;
      continue;
    }
    const L = layoutOf(site, id);
    const inside = near.filter(p => inBox(L.box, p.x, p.y, p.z));
    for (const p of inside) if (p.dgIn !== id) { p.dgIn = id; emitState(g, id, { enter: true }); }
    for (const p of g.players.values()) if (p.dgIn === id && !inside.includes(p)) p.dgIn = null;
    guardRoom(g, id, site, L, d, near);
    if (inside.length || d.pending.length) trapTick(g, id, site, L, d, inside);
  }
}

// ---------------------------------------------------------------- phần vẽ của client: bẫy gần người chơi (hàm thuần, chỉ đọc)
export function trapView(flags, world, t, pos, r = 40) {
  const ds = flags && flags.sites && flags.sites.dungeon, out = [];
  if (!ds) return out;
  for (const id of Object.keys(ds)) {
    const site = ds[id];
    if (!DUNGEONS[id] || !siteOk(site)) continue;
    const b = boxOf(site);
    if (pos.x < b.x0 - r || pos.x > b.x1 + r || pos.z < b.z0 - r || pos.z > b.z1 + r || pos.y < b.y0 - r || pos.y > b.y1 + r) continue;
    const L = layoutOf(site, id);
    for (const s of L.spikes) { if (Math.abs(s.x - pos.x) > r || Math.abs(s.z - pos.z) > r) continue; if (world.get(s.x, s.y, s.z) === B.SPIKES && !isSolid(world.get(s.x, site.fy, s.z))) out.push({ k: 'spike', x: s.x, y: site.fy, z: s.z, s: spikeState(t, s.off), off: s.off }); }
    for (const v of L.vents) { if (Math.abs(v.x - pos.x) > r || Math.abs(v.z - pos.z) > r) continue; if (world.get(v.x, v.y, v.z) === B.VENT) out.push({ k: 'vent', x: v.x, y: site.fy, z: v.z, s: ventState(t, v.off), off: v.off }); }
  }
  return out;
}
