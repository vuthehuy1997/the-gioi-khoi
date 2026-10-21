// Lõi mô phỏng của một thế giới: người chơi, kho đồ, đào/đặt block. Chạy ở host (hoặc một mình); không biết gì về DOM hay mạng.
// Mọi thay đổi cần báo cho người chơi được đẩy vào hàng đợi sự kiện, lấy ra bằng drain().
import { World } from '../world/world.js';
import { BLOCKS, BLOCK_BY_NAME, B, isPlant, isReplaceable } from '../world/blocks.js';
import { ITEMS, HAND_DAMAGE } from '../content/items.js';
import { makeInventory, addItem, removeItem, countItem, canFit, HOTBAR, SLOTS } from './inventory.js';
import { emptyArmor, armorStats, ARMOR_SLOTS, equip } from './armor.js';
import { craft, canCraft } from './crafting.js';
import { makePlayer, stepPlayer } from './physics.js';
import { makeRng } from './rng.js';
import { stepMobs, spawnTick } from './mobs.js';
import * as combat from './combat.js';
import * as quests from './quests.js';
import * as dialogue from './dialogue.js';
import { stepBosses, stepArenas, bossDef } from './boss.js';
import { buildStructures, ensureNpcs } from './structures.js';
import { BOSSES } from '../content/bosses.js';
import { REGIONS } from '../content/regions.js';
import { breakTimeFor, canHarvest, nearBench, nearStations } from './rules.js';
import { makeNoise } from './perception.js';

const ENV_TEXT = {
  heat: n => `Cái nóng ở ${n} thiêu đốt bạn. Mặc đồ chống nóng (vỏ bọ cạp, than hồng) để chịu được.`,
  cold: n => `Giá lạnh ở ${n} cắt da bạn. Mặc đồ chống lạnh (lông thú, pha lê) để chịu được.`,
  toxic: n => `Hơi độc ở ${n} làm bạn yếu đi. Mặc đồ chống độc (vảy cá sấu) để chịu được.`,
};
export const REACH = 6.5, EYE = 1.62, MAX_HP = 20, RESPAWN_S = 3, CHEST_SLOTS = 27, ENV_TICK = 4;

export class Game {
  constructor({ seed, world, spawning = true, env = true } = {}) {
    this.seed = seed; this.spawning = spawning; this.env = env;       // env: false tắt nóng/lạnh/độc của vùng (dùng khi thử nghiệm)
    this.world = world || new World(seed);
    this.rng = makeRng(seed ^ 0x5eed);
    this.time = 0; this.tickNo = 0;
    this.flags = {};
    this.players = new Map();
    this.ents = new Map(); this.nextId = 1;
    this.out = [];
    this.spawn = this.world.findSpawn();
    this.savedPlayers = {};
    this.chests = {};                                    // 'x,y,z' -> mảng CHEST_SLOTS ô của rương đặt trong thế giới
  }

  // ---- lưu / nạp ----
  toSave() {
    const players = { ...this.savedPlayers };
    for (const p of this.players.values()) players[p.uid] = this.playerSave(p);
    return { v: 1, seed: this.seed, time: this.time, flags: this.flags, delta: this.world.exportDelta(), players, chests: this.chests };
  }

  // Người đang gục lưu ở điểm hồi sinh (không để họ hiện lại ngay tại xác).
  playerSave(p) { const at = p.dead ? { x: this.spawn.x + 0.5, y: this.world.surfaceY(this.spawn.x, this.spawn.z) + 1, z: this.spawn.z + 0.5 } : p; return { name: p.name, x: at.x, y: at.y, z: at.z, hp: p.dead ? p.maxHp : p.hp, maxHp: p.maxHp, inv: p.inv, sel: p.sel, quests: p.quests, armor: p.armor, home: p.home || null, region: null }; }

  static fromSave(save, opts = {}) {
    const g = new Game({ seed: save.seed, ...opts });
    g.world.importDelta(save.delta || {});
    g.flags = save.flags || {};
    g.time = save.time || 0;
    g.rng = makeRng(save.seed ^ 0x5eed ^ Math.floor(g.time * 1000));
    g.savedPlayers = save.players || {};
    g.chests = save.chests || {};
    if (g.flags.sites) g.buildStructures();                  // thế giới cũ: dựng thêm đấu trường/làng được bổ sung sau này
    g.ensureNpcs();
    return g;
  }

  // ---- sự kiện ----
  emit(to, ev) { this.out.push({ to, ev }); }             // to: uid người nhận, hoặc null = mọi người
  drain() { const o = this.out; this.out = []; return o; }

  // ---- người chơi ----
  addPlayer(uid, name, saved) {
    const sx = this.spawn.x, sz = this.spawn.z;
    const p = makePlayer(sx + 0.5, this.world.surfaceY(sx, sz) + 1, sz + 0.5);
    Object.assign(p, { uid, name: String(name || 'Khách').slice(0, 16), hp: MAX_HP, maxHp: MAX_HP, inv: makeInventory(), sel: 0, rev: 1,
      armor: emptyArmor(), home: null, dead: false, respawnAt: 0, tpSeq: 0, lastHurt: -99, attackAt: 0, dig: null, lastState: this.time, quests: { active: {}, done: {} }, region: null });
    saved = saved || (Object.hasOwn(this.savedPlayers, uid) ? this.savedPlayers[uid] : null);
    if (saved) Object.assign(p, JSON.parse(JSON.stringify(saved)), { uid, dead: false, name: p.name });
    this.players.set(uid, p);
    return p;
  }
  removePlayer(uid) { const p = this.players.get(uid); if (p) this.savedPlayers[uid] = JSON.parse(JSON.stringify(this.playerSave(p))); this.players.delete(uid); }
  player(uid) { return this.players.get(uid); }

  touch(p) { p.rev++; }

  giveItem(uid, id, n = 1) {
    const p = this.player(uid), left = addItem(p.inv, id, n);
    this.touch(p);
    return n - left;
  }

  held(p) { const s = p.inv[p.sel]; return s ? ITEMS[s.id] : null; }

  // Thời gian (giây) đào một block bằng vật đang cầm.
  breakTime(uid, x, y, z) {
    const p = this.player(uid), s = p.inv[p.sel];
    return breakTimeFor(this.world.get(x, y, z), s ? s.id : null);
  }

  inReach(p, x, y, z) {
    const dx = x + 0.5 - p.x, dy = y + 0.5 - (p.y + EYE), dz = z + 0.5 - p.z;
    return dx * dx + dy * dy + dz * dz <= REACH * REACH;
  }

  setBlock(x, y, z, id) {
    if (!this.world.set(x, y, z, id)) return false;
    this.emit(null, { t: 'block', x, y, z, id });
    return true;
  }

  // Có thực thể (người chơi hoặc quái) nào chồng lên ô block này không.
  occupied(x, y, z) {
    const hit = (e) => Math.abs(e.x - (x + 0.5)) < e.w / 2 + 0.5 && Math.abs(e.z - (z + 0.5)) < e.w / 2 + 0.5 && e.y < y + 1 && e.y + e.h > y;
    for (const p of this.players.values()) if (!p.dead && hit(p)) return true;
    for (const e of this.ents.values()) if (e.w && e.kind !== 'item' && e.kind !== 'proj' && hit(e)) return true;
    return false;
  }

  // ---- hành động của người chơi. Trả { ok, reason? } ----
  act(uid, a) {
    const p = this.player(uid);
    if (!p) return { ok: false, reason: 'no-player' };
    if (p.dead && a.t !== 'respawn') return { ok: false, reason: 'dead' };
    switch (a.t) {
      case 'sel': if (a.i >= 0 && a.i < HOTBAR) { p.sel = a.i | 0; this.touch(p); return { ok: true }; } return { ok: false, reason: 'bad-slot' };
      case 'dig': return this.actDig(p, a);
      case 'break': return this.actBreak(p, a);
      case 'place': return this.actPlace(p, a);
      case 'craft': return this.actCraft(p, a);
      case 'swap': return this.actSwap(p, a);
      case 'equip': { const r = equip(p, a.i); if (r.ok) this.touch(p); return r; }
      case 'unequip': return this.actUnequip(p, a);
      case 'toggle': return this.actToggle(p, a);
      case 'sleep': return this.actSleep(p, a);
      case 'chest-open': return this.actChestOpen(p, a);
      case 'chest-move': return this.actChestMove(p, a);
      case 'hit': return combat.actHit(this, p, a);
      case 'use': return combat.actUse(this, p);
      case 'respawn': return combat.actRespawn(this, p);
      case 'interact': return dialogue.interact(this, p, a);
      case 'dlg': return dialogue.choose(this, p, a);
      case 'buy': return dialogue.buy(this, p, a);
      case 'sell': return dialogue.sell(this, p, a);
      default: return this.actExtra ? this.actExtra(p, a) : { ok: false, reason: 'unknown' };
    }
  }

  actDig(p, a) {
    if (!this.inReach(p, a.x, a.y, a.z)) return { ok: false, reason: 'reach' };
    if (this.breakTime(p.uid, a.x, a.y, a.z) === Infinity) return { ok: false, reason: 'unbreakable' };
    p.dig = { x: a.x, y: a.y, z: a.z, t0: this.time };
    return { ok: true };
  }

  actBreak(p, a) {
    const d = p.dig;
    if (!this.inReach(p, a.x, a.y, a.z)) return { ok: false, reason: 'reach' };
    if (!d || d.x !== a.x || d.y !== a.y || d.z !== a.z) return { ok: false, reason: 'no-dig' };
    const id = this.world.get(a.x, a.y, a.z), def = BLOCKS[id], need = this.breakTime(p.uid, a.x, a.y, a.z);
    if (!def || need === Infinity) return { ok: false, reason: 'unbreakable' };
    if (this.time - d.t0 < need * 0.8) return { ok: false, reason: 'too-fast' };
    const hs = p.inv[p.sel];
    this.setBlock(a.x, a.y, a.z, B.AIR);
    p.dig = null;
    this.makeNoise(a.x + 0.5, a.y + 0.5, a.z + 0.5, def.tool === 'pick' ? 14 : def.tool === 'axe' ? 12 : id === B.LEAVES || isPlant(id) ? 4 : 7);
    if (canHarvest(id, hs ? hs.id : null) && def.drop) this.collect(p, def.drop, 1, a.x + 0.5, a.y + 0.5, a.z + 0.5);
    if (id === B.CHEST) this.spillChest(a.x, a.y, a.z);
    this.onBlockBroken?.(p, id);
    return { ok: true };
  }

  // Cho vật phẩm vào kho; phần không vừa rơi xuống đất.
  collect(p, id, n, x, y, z) {
    const left = addItem(p.inv, id, n);
    this.touch(p);
    if (left > 0) this.dropItem(id, left, x, y, z);
  }

  dropItem(id, n, x, y, z) {
    const e = { id: this.nextId++, kind: 'item', item: id, n, x, y, z, vx: 0, vy: 2, vz: 0, w: 0.25, h: 0.25, born: this.time };
    this.ents.set(e.id, e);
    return e;
  }

  actPlace(p, a) {
    const s = p.inv[p.sel];
    if (!s) return { ok: false, reason: 'empty' };
    const it = ITEMS[s.id];
    if (!it.block) return { ok: false, reason: 'not-block' };
    if (!this.inReach(p, a.x, a.y, a.z)) return { ok: false, reason: 'reach' };
    const cur = this.world.get(a.x, a.y, a.z);
    if (!isReplaceable(cur)) return { ok: false, reason: 'occupied' };
    if (a.y < 1 || a.y >= 63) return { ok: false, reason: 'bounds' };
    const nb = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => {
      const id = this.world.get(a.x + dx, a.y + dy, a.z + dz); return id !== B.AIR && id !== B.WATER && !isPlant(id);
    });
    if (!nb) return { ok: false, reason: 'floating' };
    if (this.occupied(a.x, a.y, a.z)) return { ok: false, reason: 'blocked' };
    this.setBlock(a.x, a.y, a.z, BLOCK_BY_NAME[it.block].id);
    this.makeNoise(a.x + 0.5, a.y + 0.5, a.z + 0.5, 7);
    removeItem(p.inv, s.id, 1); this.touch(p);
    return { ok: true };
  }

  nearBench(p) { return nearBench(this.world, p.x, p.y, p.z); }
  nearStations(p) { return nearStations(this.world, p.x, p.y, p.z); }

  actSwap(p, a) {
    const ok = i => Number.isInteger(i) && i >= 0 && i < p.inv.length;
    if (!ok(a.a) || !ok(a.b)) return { ok: false, reason: 'bad-slot' };
    [p.inv[a.a], p.inv[a.b]] = [p.inv[a.b], p.inv[a.a]]; this.touch(p);
    return { ok: true };
  }

  actCraft(p, a) {
    if (!craft(p.inv, a.id, this.nearStations(p))) return { ok: false, reason: 'cannot-craft' };
    this.touch(p);
    return { ok: true };
  }

  actUnequip(p, a) {
    const id = ARMOR_SLOTS.includes(a.slot) ? p.armor[a.slot] : null;
    if (!id) return { ok: false, reason: 'empty' };
    if (!canFit(p.inv, id, 1)) return { ok: false, reason: 'full' };
    addItem(p.inv, id, 1); p.armor[a.slot] = null; this.touch(p);
    return { ok: true };
  }

  // Cửa: bấm để đóng/mở (mở thì đi xuyên được). Bấm khi có người đứng trong ô thì không đóng được.
  actToggle(p, a) {
    if (!this.inReach(p, a.x, a.y, a.z)) return { ok: false, reason: 'reach' };
    const id = this.world.get(a.x, a.y, a.z);
    if (id !== B.DOOR && id !== B.DOOR_OPEN) return { ok: false, reason: 'not-door' };
    if (id === B.DOOR_OPEN && this.occupied(a.x, a.y, a.z)) return { ok: false, reason: 'blocked' };
    this.setBlock(a.x, a.y, a.z, id === B.DOOR ? B.DOOR_OPEN : B.DOOR);
    return { ok: true };
  }

  // Giường: đặt điểm hồi sinh. Giường bị phá thì lần sau hồi sinh ở điểm gốc.
  actSleep(p, a) {
    if (!this.inReach(p, a.x, a.y, a.z)) return { ok: false, reason: 'reach' };
    if (this.world.get(a.x, a.y, a.z) !== B.BED) return { ok: false, reason: 'not-bed' };
    p.home = { x: a.x, y: a.y, z: a.z }; this.touch(p);
    this.emit(p.uid, { t: 'toast', text: 'Đã đặt điểm hồi sinh ở giường này.' });
    return { ok: true };
  }

  // Điểm hồi sinh: giường còn nguyên thì lên trên giường, không thì điểm gốc của thế giới.
  respawnPoint(p) {
    const h = p.home;
    if (h && this.world.get(h.x, h.y, h.z) === B.BED) return { x: h.x + 0.5, y: h.y + 1, z: h.z + 0.5 };
    return { x: this.spawn.x + 0.5, y: this.world.surfaceY(this.spawn.x, this.spawn.z) + 1, z: this.spawn.z + 0.5 };
  }

  // ---- rương ----
  chestKey(a) { return a.x + ',' + a.y + ',' + a.z; }
  chestOf(p, a) {
    if (![a.x, a.y, a.z].every(Number.isInteger)) return null;
    if (!this.inReach(p, a.x, a.y, a.z) || this.world.get(a.x, a.y, a.z) !== B.CHEST) return null;
    const k = this.chestKey(a); return this.chests[k] || (this.chests[k] = new Array(CHEST_SLOTS).fill(null));
  }
  sendChest(p, a, inv) { this.emit(p.uid, { t: 'chest', x: a.x, y: a.y, z: a.z, inv }); }
  actChestOpen(p, a) { const c = this.chestOf(p, a); if (!c) return { ok: false, reason: 'reach' }; this.sendChest(p, a, c); return { ok: true }; }
  // Chuyển cả chồng ở ô `slot` giữa kho người chơi (from: 'inv') và rương (from: 'chest'); phần không vừa ở lại chỗ cũ.
  actChestMove(p, a) {
    const c = this.chestOf(p, a); if (!c) return { ok: false, reason: 'reach' };
    const src = a.from === 'chest' ? c : a.from === 'inv' ? p.inv : null, dst = src === c ? p.inv : c;
    if (!src || !Number.isInteger(a.slot) || a.slot < 0 || a.slot >= src.length || !src[a.slot]) return { ok: false, reason: 'bad-slot' };
    const s = src[a.slot], left = addItem(dst, s.id, s.n);
    if (left === s.n) return { ok: false, reason: 'full' };
    if (left) s.n = left; else src[a.slot] = null;
    this.touch(p); this.sendChest(p, a, c);
    return { ok: true };
  }
  spillChest(x, y, z) {
    const k = x + ',' + y + ',' + z, c = this.chests[k]; if (!c) return;
    for (const s of c) if (s) this.dropItem(s.id, s.n, x + 0.5, y + 0.5, z + 0.5);
    delete this.chests[k];
  }

  // ---- trạng thái người chơi do client báo (vị trí do client mô phỏng, host chỉ kiểm tra tốc độ) ----
  // Dịch chuyển người chơi do máy chủ quyết định. seq tăng để loại các gói vị trí cũ còn đang bay.
  teleportPlayer(p, x, y, z) {
    p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; p.lastState = this.time; p.tpSeq++;
    this.emit(p.uid, { t: 'teleport', x, y, z, seq: p.tpSeq });
  }

  applyState(uid, st) {
    const p = this.player(uid);
    if (!p || p.dead) return false;
    const dt = Math.max(0.05, this.time - p.lastState);
    const dist = Math.hypot(st.x - p.x, st.y - p.y, st.z - p.z);
    if (![st.x, st.y, st.z, st.yaw, st.pitch].every(Number.isFinite)) return false;
    if ((st.seq | 0) < p.tpSeq) return false;                                                 // gói cũ gửi trước lần dịch chuyển gần nhất
    if (dist > 14 * dt + 3) { this.teleportPlayer(p, p.x, p.y, p.z); return false; }          // di chuyển quá nhanh: kéo về
    p.x = st.x; p.y = st.y; p.z = st.z; p.yaw = st.yaw; p.pitch = st.pitch;
    p.sneak = st.sneak === true; p.sprint = st.sprint === true && !p.sneak;
    if (p.sprint && this.time >= (p.nextStepNoise || 0)) { p.nextStepNoise = this.time + 0.6; this.makeNoise(p.x, p.y, p.z, 8); }          // chạy nước rút ồn
    p.vx = st.vx || 0; p.vy = st.vy || 0; p.vz = st.vz || 0;
    p.lastState = this.time;
    return true;
  }

  makeNoise(x, y, z, radius) { makeNoise(this, x, y, z, radius); }
  hurtPlayer(p, dmg, src, opts) { combat.hurtPlayer(this, typeof p === 'string' ? this.player(p) : p, dmg, src, opts); }
  damageEntity(e, dmg, src) { return combat.damageEntity(this, e, dmg, src); }

  // ---- công trình, nhiệm vụ, boss ----
  buildStructures() { buildStructures(this); }
  ensureNpcs() { ensureNpcs(this); }
  bossDef(e) { return bossDef(e); }
  acceptQuest(uid, id) { return quests.accept(this, this.player(uid), id); }
  questState(uid, id) { return quests.questState(this, this.player(uid), id); }
  questProgress(uid, id) { return quests.progress(this, this.player(uid), id); }
  questSummary(uid) { return quests.summary(this, this.player(uid)); }

  nearbyPlayers(e, r) { return [...this.players.values()].filter(p => !p.dead && Math.hypot(p.x - e.x, p.z - e.z) <= r); }

  onKill(e, src) {
    if (e.kind === 'mob') for (const p of this.nearbyPlayers(e, 24)) quests.creditKill(this, p, e.type);
    if (e.kind === 'boss') {
      const d = BOSSES[e.type];
      this.flags[d.flag] = true;
      for (const m of e.minions || []) this.ents.delete(m);
      this.emit(null, { t: 'boss-defeated', id: e.id, type: e.type, name: d.name });
      const near = this.nearbyPlayers(e, (e.arena ? e.arena.r : d.radius) + 10);
      this.onBossDefeated(e.type, near);
      if (d.unlocks) { const r = REGIONS.find(x => x.id === d.unlocks); this.emit(null, { t: 'toast', text: `${d.name} đã bị hạ. ${r ? r.name : d.unlocks} giờ an toàn.` }); }
    }
  }

  onBossDefeated(bossId, players) { for (const p of players) { quests.creditBoss(this, p, bossId); this.touch(p); } }

  regionTick(dt) {
    for (const p of this.players.values()) {
      if (p.dead) continue;
      const r = REGIONS.find(x => x.id === this.world.regionAt(p.x, p.z));
      if (p.region !== r.id) { p.region = r.id; this.emit(p.uid, { t: 'region', id: r.id, name: r.name }); quests.creditRegion(this, p, r.id); this.touch(p); }
      if (r.requires && !this.flags[r.requires]) {
        p.hazT = (p.hazT || 0) + dt;
        if (p.hazT >= 2) {
          p.hazT -= 2; this.hurtPlayer(p, 1, null);
          if (this.time - (p.warnAt || -99) > 20) { p.warnAt = this.time; const b = Object.values(BOSSES).find(x => x.flag === r.requires); this.emit(p.uid, { t: 'toast', text: `Khí độc ở ${r.name} đang gặm mòn bạn. Hãy hạ ${b ? b.name : 'boss'} để vào vùng này an toàn.` }); }
        }
      } else p.hazT = 0;
      // nóng/lạnh/độc của vùng: mỗi món trang bị chống đúng loại giảm 1 điểm sát thương mỗi nhịp
      const st = armorStats(p.armor), hit = r.env && this.env ? r.env.power - st.resist[r.env.kind] : 0;
      if (hit > 0) {
        p.envT = (p.envT || 0) + dt;
        if (p.envT >= ENV_TICK) {
          p.envT -= ENV_TICK; this.hurtPlayer(p, hit, null, { pure: true });
          if (this.time - (p.envWarn || -99) > 20) { p.envWarn = this.time; this.emit(p.uid, { t: 'toast', text: ENV_TEXT[r.env.kind](r.name) }); }
        }
      } else p.envT = 0;
      // đứng trên đá nham thạch thì bị bỏng (giày than hồng thì không)
      if (!st.fireproof && p.y - Math.floor(p.y) < 0.15 && this.world.get(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z)) === B.MAGMA) {
        p.burnT = (p.burnT || 0) + dt;
        if (p.burnT >= 0.8) {
          p.burnT -= 0.8; this.hurtPlayer(p, 2, null);
          if (this.time - (p.burnWarn || -99) > 15) { p.burnWarn = this.time; this.emit(p.uid, { t: 'toast', text: 'Đá nham thạch nóng bỏng chân! Đừng đứng trên nó.' }); }
        }
      } else p.burnT = 0;
    }
  }

  questTick(dt) {
    this.qAcc = (this.qAcc || 0) + dt;
    if (this.qAcc < 0.5) return;
    this.qAcc = 0;
    for (const p of this.players.values()) {
      const sig = JSON.stringify(quests.summary(this, p));
      if (sig !== p.qsig) { p.qsig = sig; this.emit(p.uid, { t: 'quests', list: quests.summary(this, p) }); }
    }
  }

  tick(dt) {
    this.time += dt; this.tickNo++;
    stepMobs(this, dt);
    stepBosses(this, dt);
    stepArenas(this, dt);
    this.regionTick(dt);
    this.questTick(dt);
    if (this.spawning) spawnTick(this, dt);
    combat.updateItems(this, dt);
    combat.updateProjectiles(this, dt);
    combat.updatePlayers(this, dt);
    this.tickExtra?.(dt);
  }
}
