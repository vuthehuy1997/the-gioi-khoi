// Công trình sinh một lần khi tạo thế giới: đấu trường boss và làng có NPC. Ghi vào world bằng delta, vị trí lưu trong g.flags.sites.
import { B, BLOCK_BY_NAME } from '../world/blocks.js';
import { columnInfo, WATER_LEVEL } from '../world/generate.js';
import { BOSSES } from '../content/bosses.js';
import { NPCS, VILLAGES } from '../content/npcs.js';
import { DUNGEONS } from '../content/dungeons.js';
import { planSite, buildDungeon, boxEdited } from './dungeon.js';

const id = n => BLOCK_BY_NAME[n].id;
const ARENA = { 'rung-suong': ['stone', 'stone'], 'sa-mac-lua': ['sand', 'stone'], 'nui-bang': ['ice', 'ice'], 'dam-lay': ['moss', 'mud'], 'hoa-son': ['basalt', 'basalt'], 'vuc-pha-le': ['amethyst', 'amethyst'] };
const FLOOR = { 'sa-mac-lua': 'sand', 'rung-suong': 'grass', 'nui-bang': 'snow', 'dam-lay': 'moss', 'hoa-son': 'basalt', 'vuc-pha-le': 'snow' };

// Tìm điểm gần gốc (cx, cz) trong vùng `region`, địa hình đủ phẳng, cách các điểm đã dùng ít nhất minGap.
function findSite(g, region, used, opts = {}) {
  const flat = opts.flat ?? 5;
  for (const f of [flat, flat * 2, flat * 4]) { const r = findSiteWith(g, region, used, { ...opts, flat: f }); if (r) return r; }
  return null;
}

function findSiteWith(g, region, used, { fromX = 0, fromZ = 0, minGap = 70, flat = 5, accept = null } = {}) {
  const seed = g.world.seed, step = 16;
  for (let r = 0; r <= 1600; r += step) {
    const pts = r === 0 ? [[0, 0]] : [];
    if (r > 0) for (let i = 0; i < 8 * (r / step); i++) { const a = i / (8 * (r / step)) * Math.PI * 2; pts.push([Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)]); }
    for (const [dx, dz] of pts) {
      const x = fromX + dx, z = fromZ + dz, c = columnInfo(seed, x, z);
      if (c.region.id !== region || c.h <= WATER_LEVEL + 2) continue;
      if (used.some(u => Math.hypot(u.x - x, u.z - z) < minGap)) continue;
      if (accept) { const extra = accept(x, z); if (extra) return { x, z, y: c.h, ...extra }; continue; }        // hầm ngục tự kiểm địa hình trên cả hộp bao
      let lo = 999, hi = -1, ok = true;
      for (const [ox, oz] of [[-12, -12], [12, -12], [-12, 12], [12, 12], [0, 12], [0, -12], [12, 0], [-12, 0]]) {
        const ci = columnInfo(seed, x + ox, z + oz);
        if (ci.region.id !== region || ci.h <= WATER_LEVEL + 1) { ok = false; break; }
        lo = Math.min(lo, ci.h); hi = Math.max(hi, ci.h);
      }
      if (ok && hi - lo <= flat * 2) return { x, z, y: c.h };
    }
  }
  return null;
}

// Làm phẳng đĩa bán kính R quanh (cx, cz) ở độ cao y0: san đất, dọn cây, lát sàn.
function flatten(g, cx, cz, y0, R, floorId, fillId) {
  const w = g.world;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dz * dz > R * R) continue;
    const x = cx + dx, z = cz + dz;
    for (let y = y0 - 1; y >= 1; y--) { if (w.get(x, y, z) !== B.AIR && w.get(x, y, z) !== B.WATER) break; w.set(x, y, z, fillId); }
    w.set(x, y0, z, floorId);
    for (let y = y0 + 1; y <= y0 + 16; y++) if (w.get(x, y, z) !== B.AIR) w.set(x, y, z, B.AIR);
  }
}

function buildArena(g, bossId, site) {
  const d = BOSSES[bossId], R = d.radius, w = g.world;
  const [floorName, pillarName] = ARENA[d.region];
  flatten(g, site.x, site.z, site.y, R, id(floorName), id('stone'));
  for (let i = 0; i < 8; i++) {                                              // cột đá quanh sân
    const a = i / 8 * Math.PI * 2, px = site.x + Math.round(Math.cos(a) * (R - 1)), pz = site.z + Math.round(Math.sin(a) * (R - 1));
    for (let y = 1; y <= 6; y++) w.set(px, site.y + y, pz, id(pillarName));
    w.set(px, site.y + 7, pz, B.MAGMA);
  }
}

function buildHut(g, x, z, y0, floor) {
  const w = g.world, P = id('planks');
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    w.set(x + dx, y0, z + dz, P);
    const wall = Math.abs(dx) === 2 || Math.abs(dz) === 2;
    for (let y = 1; y <= 3; y++) w.set(x + dx, y0 + y, z + dz, wall ? P : B.AIR);
    w.set(x + dx, y0 + 4, z + dz, P);
  }
  w.set(x, y0 + 1, z + 2, B.AIR); w.set(x, y0 + 2, z + 2, B.AIR);            // cửa
  w.set(x - 1, y0 + 1, z - 1, B.WORKBENCH);
}

function buildVillage(g, vid, site) {
  const v = VILLAGES[vid], y0 = site.y;
  const floor = id(FLOOR[v.region] || 'grass');
  flatten(g, site.x, site.z, y0, 10, floor, id('dirt'));
  if (v.huts >= 1) buildHut(g, site.x - 5, site.z - 4, y0, floor);
  if (v.huts >= 2) buildHut(g, site.x + 5, site.z - 4, y0, floor);
}

export function buildStructures(g, { dungeons = true } = {}) {
  const fresh = !g.flags.sites;
  const sites = g.flags.sites || { arena: {}, village: {} };
  const used = [...Object.values(sites.arena), ...Object.values(sites.village), ...Object.values(sites.dungeon || {}).map(s => s && s.c)].filter(Boolean);
  if (fresh) {
    // làng khởi đầu ngay cạnh điểm xuất hiện, để người chơi mới gặp NPC ngay
    const sp = g.spawn;
    const v0 = findSite(g, 'rung-suong', used, { fromX: sp.x, fromZ: sp.z, minGap: 0, flat: 4 });
    sites.village['khoi-dau'] = v0; used.push(v0);
  }
  // thế giới cũ (đã lưu) chưa có boss/làng thêm sau này: chỉ dựng phần còn thiếu
  const fresh2 = { arena: [], village: [], dungeon: [] };
  for (const [bid, d] of Object.entries(BOSSES)) if (!d.dungeon && !sites.arena[bid]) { const s = findSite(g, d.region, used, { minGap: 90 }); if (s) { sites.arena[bid] = s; used.push(s); fresh2.arena.push(bid); } }
  for (const [vid, v] of Object.entries(VILLAGES)) if (!sites.village[vid]) { const s = findSite(g, v.region, used, { minGap: 90 }); if (s) { sites.village[vid] = s; used.push(s); fresh2.village.push(vid); } }
  // hầm ngục (mỗi vùng một hầm, cách mọi công trình >= 100 block): dựng sau cùng nên không đổi vị trí các công trình cũ. Thế giới cũ bỏ điểm có chunk đã bị chỉnh sửa trong hộp bao.
  if (dungeons) {
    sites.dungeon = sites.dungeon || {}; const skip = sites.dungeonSkip = sites.dungeonSkip || {};
    for (const [did, d] of Object.entries(DUNGEONS)) {
      if (sites.dungeon[did] || skip[did]) continue;
      const s = findSite(g, d.region, used, { minGap: 100, accept: (x, z) => { const p = planSite(g, x, z, d.region); return p && (fresh || !boxEdited(g, p, did)) ? p : null; } });
      if (s) { sites.dungeon[did] = s; used.push(s.c); fresh2.dungeon.push(did); } else { skip[did] = true; console.warn('không tìm được chỗ đặt hầm ' + did); }
    }
  }
  for (const bid of fresh2.arena) buildArena(g, bid, sites.arena[bid]);
  for (const vid of fresh2.village) buildVillage(g, vid, sites.village[vid]);
  for (const did of fresh2.dungeon) buildDungeon(g, did, sites.dungeon[did]);
  if (!fresh && !fresh2.arena.length && !fresh2.village.length && !fresh2.dungeon.length) return;
  g.flags.sites = sites;
  if (fresh) {
    const v0 = sites.village['khoi-dau'];
    g.spawn = { x: v0.x + 4, z: v0.z + 7 };                                 // xuất hiện ở sân làng
    g.flags.spawn = g.spawn;
  }
  ensureNpcs(g);
}

// NPC là thực thể không lưu; tạo lại từ vị trí làng mỗi lần khởi động.
export function ensureNpcs(g) {
  const sites = g.flags.sites;
  if (!sites) return;
  if (g.flags.spawn) g.spawn = g.flags.spawn;
  const slots = {};
  for (const [nid, n] of Object.entries(NPCS)) {
    const s = sites.village[n.village]; if (!s) continue;
    const k = (slots[n.village] = (slots[n.village] || 0) + 1) - 1;
    const x = s.x + [2, -2, 0, 3][k] + 0.5, z = s.z + [2, 2, 5, -2][k] + 0.5;
    if ([...g.ents.values()].some(e => e.kind === 'npc' && e.npc === nid)) continue;
    g.ents.set(g.nextId, { id: g.nextId++, kind: 'npc', npc: nid, type: nid, name: n.name, x, y: s.y + 1, z, vx: 0, vy: 0, vz: 0, w: 0.6, h: 1.8, hp: 1, maxHp: 1, yaw: 0, onGround: true, color: n.color });
  }
}
