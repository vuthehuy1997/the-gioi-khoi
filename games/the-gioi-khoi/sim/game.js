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
import { SAVE_VERSION } from './version.js';
import { hungerTick, restorePlayerState, serializePlayerState, FOOD_MAX } from './hunger.js';
import * as farm from './farm.js';
import * as animals from './animals.js';
import * as dungeon from './dungeon.js';
import * as fight from './fight.js';
import * as ach from './achievements.js';

const ENV_TEXT = {
  heat: n => `Cái nóng ở ${n} thiêu đốt bạn. Mặc đồ chống nóng (vỏ bọ cạp, than hồng) để chịu được.`,
  cold: n => `Giá lạnh ở ${n} cắt da bạn. Mặc đồ chống lạnh (lông thú, pha lê) để chịu được.`,
  toxic: n => `Hơi độc ở ${n} làm bạn yếu đi. Mặc đồ chống độc (vảy cá sấu) để chịu được.`,
};
export const REACH = 6.5, EYE = 1.62, MAX_HP = 20, RESPAWN_S = 3, CHEST_SLOTS = 27, ENV_TICK = 4;

export const FALL_SAFE = 3.5, AIR_MAX = 12;           // rơi quá 3,5 block bắt đầu mất máu; 12 giây khí dưới nước

export class Game {
  constructor({ seed, world, spawning = true, env = true, hunger = true } = {}) {
    this.seed = seed; this.spawning = spawning; this.env = env;       // env: false tắt nóng/lạnh/độc của vùng (dùng khi thử nghiệm)
    this.hunger = hunger;                                              // hunger: false tắt đói, rủi ro ngộ độc và hồi máu theo đói (các bài thử cũ)
    this.hostUid = null;                                               // uid chủ phòng (HostSession đặt): chỉ để bù độ trễ lăn cho khách
    this.dg = {};                                                      // trạng thái chạy của hầm ngục (đợt quái, bẫy hẹn giờ): không lưu, xem sim/dungeon.js
    this.crops = new Map(); this.farm = new Map();                     // sổ cây trồng ('x,y,z' ô cây) và ruộng trống ('x,y,z' ô đất cày): xem sim/farm.js
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
    return { v: SAVE_VERSION, seed: this.seed, time: this.time, flags: this.flags, delta: this.world.exportDelta(), players, chests: this.chests, ...farm.serializeFarm(this), animals: animals.serializeAnimals(this) };
  }

  // Người đang gục lưu ở điểm hồi sinh (không để họ hiện lại ngay tại xác).
  playerSave(p) { const at = p.dead ? { x: this.spawn.x + 0.5, y: this.world.surfaceY(this.spawn.x, this.spawn.z) + 1, z: this.spawn.z + 0.5 } : p; return { name: p.name, x: at.x, y: at.y, z: at.z, hp: p.dead ? p.maxHp : p.hp, maxHp: p.maxHp, inv: p.inv, sel: p.sel, quests: p.quests, stats: p.stats, ach: p.ach, armor: p.armor, home: p.home || null, region: null, offhand: p.offhand || null, ...serializePlayerState(this, p) }; }

  static fromSave(save, opts = {}) {
    const g = new Game({ seed: save.seed, ...opts });
    g.world.importDelta(save.delta || {});
    g.flags = save.flags || {};
    g.time = save.time || 0;
    g.rng = makeRng(save.seed ^ 0x5eed ^ Math.floor(g.time * 1000));
    g.savedPlayers = save.players || {};
    g.chests = save.chests || {};
    farm.restoreFarm(g, save);
    if (g.flags.sites) g.buildStructures();                  // thế giới cũ: dựng thêm đấu trường/làng được bổ sung sau này
    g.ensureNpcs();
    animals.restoreAnimals(g, save.animals);
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
      armor: emptyArmor(), home: null, dead: false, respawnAt: 0, tpSeq: 0, lastHurt: -99, attackAt: 0, dig: null, lastState: this.time, quests: { active: {}, done: {} }, region: null,
      food: FOOD_MAX, fat: 0, fx: {}, fxView: [], psn: null, eatAt: -99, hungerWarn: -99, offhand: null });
    fight.resetFight(p);
    saved = saved || (Object.hasOwn(this.savedPlayers, uid) ? this.savedPlayers[uid] : null);
    if (saved) { const { food, fatigue, fx, poison, offhand, ...rest } = JSON.parse(JSON.stringify(saved)); Object.assign(p, rest, { uid, dead: false, name: p.name, offhand: typeof offhand === 'string' && ITEMS[offhand] && ITEMS[offhand].shield ? offhand : null }); }
    ach.sanitize(p);
    restorePlayerState(this, p, saved || {});                // đói, mệt, hiệu ứng, ngộ độc: kẹp giá trị, đổi "giây còn lại" thành thời điểm hết hạn
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

  // q: đổi do hệ thống (cây lớn, đất ướt/khô): khách bỏ tiếng và hạt (xem game.js, onChange).
  setBlock(x, y, z, id, q = false) {
    const prev = this.world.get(x, y, z);
    if (!this.world.set(x, y, z, id)) return false;
    this.emit(null, q ? { t: 'block', x, y, z, id, q: 1 } : { t: 'block', x, y, z, id });
    farm.onBlockSet(this, x, y, z, prev, id);
    return true;
  }

  // Có thực thể (người chơi hoặc quái) nào chồng lên ô block này không.
  occupied(x, y, z) {
    const hit = (e) => Math.abs(e.x - (x + 0.5)) < e.w / 2 + 0.5 && Math.abs(e.z - (z + 0.5)) < e.w / 2 + 0.5 && e.y < y + 1 && e.y + e.h > y;
    for (const p of this.players.values()) if (!p.dead && hit(p)) return true;
    for (const e of this.ents.values()) if (e.w && e.kind !== 'item' && e.kind !== 'proj' && hit(e)) return true;
    return false;
  }

  // Chat: tin thường phát cho cả phòng; lệnh bắt đầu bằng / chỉ trả lời riêng người gõ. Giới hạn 120 ký tự, 1 tin / 0,7 giây.
  actChat(p, a) {
    const text = [...String(a.text == null ? '' : a.text).replace(/[\u0000-\u001f\u007f]/g, ' ').trim()].slice(0, 120).join('');
    if (!text) return { ok: false, reason: 'empty' };
    if (this.time - (p.chatAt === undefined ? -99 : p.chatAt) < 0.7) return { ok: false, reason: 'too-soon' };
    p.chatAt = this.time;
    const sys = t => { this.emit(p.uid, { t: 'chat', sys: true, text: t }); return { ok: true }; };
    if (text[0] === '/') {
      const cmd = text.slice(1).split(/\s+/)[0].toLowerCase();
      if (cmd === 'help') return sys('Lệnh: /help · /home (về giường hoặc điểm hồi sinh) · /time (giờ trong game) · /pos (tọa độ) · /players (ai đang trong phòng)');
      if (cmd === 'time') { const ph = ((this.time % 600) + 600) % 600 / 600, hr = (6 + ph * 24) % 24; return sys(`Ngày ${Math.floor(this.time / 600) + 1}, ${String(Math.floor(hr)).padStart(2, '0')}:${String(Math.floor((hr % 1) * 60)).padStart(2, '0')}`); }
      if (cmd === 'pos') return sys(`Bạn ở ${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)}`);
      if (cmd === 'players') return sys('Trong phòng: ' + [...this.players.values()].map(q => q.name).join(', '));
      if (cmd === 'home') {
        if (this.time - (p.lastHurt === undefined ? -99 : p.lastHurt) < 10) return sys('Vừa bị thương, chờ 10 giây rồi thử lại.');
        const r = this.respawnPoint(p); this.teleportPlayer(p, r.x, r.y, r.z); return sys('Đã về điểm hồi sinh.');
      }
      return sys('Không có lệnh đó. Gõ /help để xem danh sách.');
    }
    this.emit(null, { t: 'chat', uid: p.uid, name: p.name, text });
    return { ok: true };
  }

  // ---- hành động của người chơi. Trả { ok, reason? } ----
  act(uid, a) {
    const p = this.player(uid);
    if (!p) return { ok: false, reason: 'no-player' };
    if (p.dead && a.t !== 'respawn' && a.t !== 'chat') return { ok: false, reason: 'dead' };
    switch (a.t) {
      case 'sel': if (a.i >= 0 && a.i < HOTBAR) { p.sel = a.i | 0; fight.afterHeldChange(this, p); this.touch(p); return { ok: true }; } return { ok: false, reason: 'bad-slot' };
      case 'dig': return this.actDig(p, a);
      case 'break': return this.actBreak(p, a);
      case 'place': return this.actPlace(p, a);
      case 'craft': return this.actCraft(p, a);
      case 'swap': return this.actSwap(p, a);
      case 'equip': { const r = equip(p, a.i); if (r.ok) { if (!p.offhand) p.guardSince = null; this.touch(p); } return r; }
      case 'unequip': return this.actUnequip(p, a);
      case 'toggle': return this.actToggle(p, a);
      case 'sleep': return this.actSleep(p, a);
      case 'chest-open': return this.actChestOpen(p, a);
      case 'chest-move': return this.actChestMove(p, a);
      case 'hit': return combat.actHit(this, p, a);
      case 'roll': return fight.actRoll(this, p, a);
      case 'guard': return fight.actGuard(this, p, a);
      case 'draw': return fight.actDraw(this, p, a);
      case 'shoot': return fight.actShoot(this, p, a);
      case 'use': return combat.actUse(this, p);
      case 'till': return farm.actTill(this, p, a);
      case 'plant': return farm.actPlant(this, p, a);
      case 'harvest': return farm.actHarvest(this, p, a);
      case 'feed': return animals.actFeed(this, p, a);
      case 'shear': return animals.actShear(this, p, a);
      case 'gate': return dungeon.actGate(this, p, a);
      case 'dchest': return dungeon.actDChest(this, p, a);
      case 'respawn': return combat.actRespawn(this, p);
      case 'chat': return this.actChat(p, a);
      case 'journal': this.emit(uid, { t: 'journal', quests: quests.journal(this, p), ach: ach.list(this, p) }); return { ok: true };
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
    farm.onBreak(this, p, a.x, a.y, a.z, id);              // cây trồng (sản lượng theo giai đoạn), hạt từ cỏ cao
    dungeon.onBreak(this, p, a.x, a.y, a.z, id);           // tấm áp lực / ống phun: sàn không thủng
    ach.bump(this, p, 'mine');
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
    const dr = dungeon.beforePlace(this, p, a);            // đặt lên gai: chỉ khi gai đang hạ, gai bị đè hết hiệu lực
    if (dr) return dr;
    this.setBlock(a.x, a.y, a.z, BLOCK_BY_NAME[it.block].id);
    this.makeNoise(a.x + 0.5, a.y + 0.5, a.z + 0.5, 7);
    removeItem(p.inv, s.id, 1); this.touch(p); ach.bump(this, p, 'place');
    return { ok: true };
  }

  nearBench(p) { return nearBench(this.world, p.x, p.y, p.z); }
  nearStations(p) { return nearStations(this.world, p.x, p.y, p.z); }

  actSwap(p, a) {
    const ok = i => Number.isInteger(i) && i >= 0 && i < p.inv.length;
    if (!ok(a.a) || !ok(a.b)) return { ok: false, reason: 'bad-slot' };
    [p.inv[a.a], p.inv[a.b]] = [p.inv[a.b], p.inv[a.a]]; fight.afterHeldChange(this, p); this.touch(p);
    return { ok: true };
  }

  actCraft(p, a) {
    if (!craft(p.inv, a.id, this.nearStations(p))) return { ok: false, reason: 'cannot-craft' };
    this.touch(p); ach.bump(this, p, 'craft');
    return { ok: true };
  }

  actUnequip(p, a) {
    if (a.slot === 'offhand') { const r = fight.unequipOffhand(p); if (r.ok) this.touch(p); return r; }
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
    const s = src[a.slot];
    if (dst === c && ITEMS[s.id] && ITEMS[s.id].bound) return { ok: false, reason: 'bound' };       // chìa hầm gắn với người chơi: không cất vào rương đặt
    const left = addItem(dst, s.id, s.n);
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
    p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; p.lastState = this.time; p.tpSeq++; p.fallVy = 0; p.fallTop = undefined; p.yRef = y; p.yRefT = this.time;
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
    if (p.yRefT === undefined || this.time - p.yRefT >= 0.05) {                                // vận tốc rơi do host tự đo từ chênh độ cao (không tin st.vy): dùng cho đòn rơi
      p.fallVy = p.yRefT === undefined ? 0 : (st.y - p.yRef) / (this.time - p.yRefT); p.yRef = st.y; p.yRefT = this.time;
    }
    const inWater = this.world.get(Math.floor(st.x), Math.floor(st.y + 0.4), Math.floor(st.z)) === B.WATER;       // rơi: host tự đo từ chênh độ cao, rơi vào nước thì an toàn
    if (inWater) p.fallTop = undefined;
    else if (st.y < p.y - 0.01) p.fallTop = Math.max(p.fallTop === undefined ? p.y : p.fallTop, p.y);
    else if (p.fallTop !== undefined) {
      const drop = p.fallTop - st.y; p.fallTop = undefined;
      if (drop > FALL_SAFE) { this.hurtPlayer(p, Math.min(20, Math.floor(drop - FALL_SAFE)), null, { pure: true }); this.emit(p.uid, { t: 'fall', drop }); }
    }
    p.x = st.x; p.y = st.y; p.z = st.z; p.yaw = st.yaw; p.pitch = st.pitch;
    p.sneak = st.sneak === true; p.sprint = st.sprint === true && !p.sneak;
    if (p.sprint && this.time >= (p.nextStepNoise || 0)) { p.nextStepNoise = this.time + 0.6; this.makeNoise(p.x, p.y, p.z, 8); }          // chạy nước rút ồn
    p.vx = st.vx || 0; p.vy = st.vy || 0; p.vz = st.vz || 0;
    p.lastState = this.time;
    return true;
  }

  makeNoise(x, y, z, radius) { makeNoise(this, x, y, z, radius); }
  hurtPlayer(p, dmg, src, opts) { return combat.hurtPlayer(this, typeof p === 'string' ? this.player(p) : p, dmg, src, opts); }
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
    if (e.kind === 'mob') for (const p of this.nearbyPlayers(e, 24)) { quests.creditKill(this, p, e.type); ach.bump(this, p, 'kill'); }
    if (e.kind === 'boss') {
      const d = BOSSES[e.type];
      this.flags[d.flag] = true;
      if (d.dungeon) dungeon.onBossKilled(this, e, d);                 // chủ hầm: rương kho báu hiện ra
      for (const m of e.minions || []) this.ents.delete(m);
      this.emit(null, { t: 'boss-defeated', id: e.id, type: e.type, name: d.name });
      const near = this.nearbyPlayers(e, (e.arena ? e.arena.r : d.radius) + 10);
      this.onBossDefeated(e.type, near);
      if (d.unlocks) { const r = REGIONS.find(x => x.id === d.unlocks); this.emit(null, { t: 'toast', text: `${d.name} đã bị hạ. ${r ? r.name : d.unlocks} giờ an toàn.` }); }
    }
  }

  onBossDefeated(bossId, players) { for (const p of players) { quests.creditBoss(this, p, bossId); ach.bump(this, p, 'boss'); if (BOSSES[bossId] && BOSSES[bossId].dungeon) ach.bump(this, p, 'dungeon'); this.touch(p); } }

  regionTick(dt) {
    for (const p of this.players.values()) {
      if (p.dead) continue;
      const r = REGIONS.find(x => x.id === this.world.regionAt(p.x, p.z));
      const head = this.world.get(Math.floor(p.x), Math.floor(p.y + 1.6), Math.floor(p.z)) === B.WATER;        // ngạt thở: đầu chìm trong nước hết khí thì mất máu
      if (p.air === undefined) p.air = AIR_MAX;
      if (head) { p.air = Math.max(0, p.air - dt); if (p.air <= 0) { p.drownT = (p.drownT || 0) + dt; if (p.drownT >= 1) { p.drownT -= 1; this.hurtPlayer(p, 2, null, { pure: true }); } } }
      else { p.air = Math.min(AIR_MAX, p.air + dt * 4); p.drownT = 0; }
      if (p.region !== r.id) { p.region = r.id; this.emit(p.uid, { t: 'region', id: r.id, name: r.name }); quests.creditRegion(this, p, r.id); ach.visit(this, p, r.id); this.touch(p); }
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
      ach.check(this, p);
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
    hungerTick(this, dt);
    fight.fightTick(this, dt);
    farm.farmTick(this, dt);
    animals.animalTick(this, dt);
    dungeon.dungeonTick(this, dt);
    this.tickExtra?.(dt);
  }
}
