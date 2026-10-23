// Thú nuôi (gà, cừu, lợn): thuần hoá bằng thức ăn, đi theo người cầm thức ăn, nhân giống, con non lớn dần, trứng và len. Chỉ host chạy.
// Thú đã thuần có e.persist (không bị dọn, không tính vào trần quái); xa mọi người hơn 64 block thì e.dormant (đóng băng hoàn toàn, giữ nguyên bộ đếm).
import { MOBS } from '../content/mobs.js';
import { ITEMS } from '../content/items.js';
import { removeItem } from './inventory.js';
import { spawnMob, walk, wander, AI } from './mobs.js';
import { yawTo } from './perception.js';
import { SIM_RANGE } from './farm.js';

export const FEED_REACH = 3, TAME_CAP = 24, LOVE_RANGE = 6, BIRTH_SECS = 6, GROW_BOOST = 30, FOLLOW_R = 8, FOLLOW_STOP = 2, HOME_R = 10, BABY_SCALE = 0.5, ANIMAL_PASS = 1;
const fail = reason => ({ ok: false, reason });
const defOf = e => (e && e.kind === 'mob' ? MOBS[e.type] : null);
export const isFarmAnimal = e => !!(defOf(e) && defOf(e).farm);
export const isBaby = e => e.age < MOBS[e.type].adultSecs;
export const tameCount = g => { let n = 0; for (const e of g.ents.values()) if (e.persist && isFarmAnimal(e)) n++; return n; };

// Con non nhỏ một nửa; trưởng thành thì về cỡ đầy đủ.
function applySize(e) { const d = MOBS[e.type], k = isBaby(e) ? BABY_SCALE : 1; e.w = d.w * k; e.h = d.h * k; }

// ---- hành động ----
function target(g, p, a, reach = FEED_REACH) {
  if (!a || !Number.isInteger(a.id)) return fail('bad-args');
  const e = g.ents.get(a.id);
  if (!isFarmAnimal(e)) return fail('no-target');
  if (Math.hypot(e.x - p.x, (e.y + e.h / 2) - (p.y + 1.62), e.z - p.z) - e.w / 2 > reach) return fail('reach');
  return { e };
}

// Cho ăn: hoang -> thuần (yêu 30 giây, đặt chuồng); non -> lớn nhanh 30 giây; trưởng thành -> yêu để sinh sản. Hai người cùng cho một con: người sau nhận 'busy' (không bị trừ).
export function actFeed(g, p, a) {
  const t = target(g, p, a); if (!t.e) return t;
  const e = t.e, d = MOBS[e.type], s = p.inv[p.sel];
  if (!s || s.id !== d.breed.food) return fail('not-food');
  if (!e.tamed) {
    if (tameCount(g) >= TAME_CAP) return fail('cap');
    Object.assign(e, { tamed: true, persist: true, dormant: false, love: d.breed.love, breedCd: 0, home: { x: e.x, y: e.y, z: e.z }, state: 'idle', alert: 0, target: null, investigate: null, vx: 0, vz: 0 });
  } else if (isBaby(e)) {
    e.age = Math.min(d.adultSecs, e.age + GROW_BOOST);
    if (!isBaby(e)) applySize(e);
  } else {
    if (e.love > 0 || e.breedCd > 0) return fail('busy');
    if (tameCount(g) >= TAME_CAP) return fail('cap');
    e.love = d.breed.love; e.home = { x: e.x, y: e.y, z: e.z };
  }
  if (d.product && d.product.fedSecs) e.fed = d.product.fedSecs;               // gà đã được cho ăn thì đẻ trứng
  removeItem(p.inv, s.id, 1); g.touch(p);
  if (e.love > 0) pairUp(g, e);
  g.emit(p.uid, { t: 'snd', n: 'feed' });
  return { ok: true };
}

// Cắt len: cần kéo, cừu trưởng thành còn len. Len mọc lại sau product.regrow giây.
export function actShear(g, p, a) {
  const t = target(g, p, a); if (!t.e) return t;
  const e = t.e, d = MOBS[e.type];
  if (!d.product || !d.product.regrow) return fail('no-target');
  const s = p.inv[p.sel];
  if (!s || s.id !== 'shears') return fail('not-shears');
  if (isBaby(e)) return fail('young');
  if (e.shearCd > 0) return fail('sheared');
  const n = d.product.min + Math.floor(g.rng() * (d.product.max - d.product.min + 1));
  g.collect(p, d.product.item, n, e.x, e.y + 0.6, e.z);
  e.shearCd = d.product.regrow;
  g.emit(p.uid, { t: 'snd', n: 'shear' });
  return { ok: true };
}

// ---- sinh sản ----
function pairUp(g, e) {
  if (e.pair || !(e.love > 0) || isBaby(e)) return;
  for (const o of g.ents.values()) {
    if (o === e || o.type !== e.type || !o.tamed || o.pair || !(o.love > 0) || isBaby(o)) continue;
    if (Math.hypot(o.x - e.x, o.z - e.z) > LOVE_RANGE) continue;
    e.pair = o.id; o.pair = e.id; e.bt = 0; o.bt = 0; return;
  }
}

function birth(g, a, b) {
  const d = MOBS[a.type];
  a.love = b.love = 0; a.breedCd = b.breedCd = d.breed.cd; a.pair = b.pair = null;
  if (tameCount(g) >= TAME_CAP) return;
  const c = spawnMob(g, a.type, (a.x + b.x) / 2, Math.max(a.y, b.y), (a.z + b.z) / 2, { persist: true, tamed: true });
  c.age = 0; c.home = { ...a.home }; c.love = 0; c.breedCd = 0; applySize(c);
  g.emit(null, { t: 'born', id: c.id, type: c.type });
}

// Mỗi 1 giây (gộp nếu dt lớn): dormant theo khoảng cách, trừ các bộ đếm của thú đang được mô phỏng, nhân giống, đẻ trứng.
export function animalTick(g, dt) {
  g.animalAcc = (g.animalAcc || 0) + dt;
  if (g.animalAcc < ANIMAL_PASS) return;
  const step = g.animalAcc; g.animalAcc = 0;
  const ps = [...g.players.values()].filter(p => !p.dead);
  for (const e of [...g.ents.values()]) {
    if (!isFarmAnimal(e)) continue;
    const d = MOBS[e.type];
    if (e.persist) { e.dormant = !ps.some(p => Math.hypot(p.x - e.x, p.z - e.z) <= SIM_RANGE); if (e.dormant) continue; }
    // sản phẩm: gà đã thuần được cho ăn đẻ trứng mỗi 150-210 giây (đồng hồ chỉ chạy khi còn "đã cho ăn")
    if (d.product && d.product.every && e.tamed && !isBaby(e)) {
      if (e.fed > 0) {
        if (e.prodCd == null) e.prodCd = d.product.every[0] + g.rng() * (d.product.every[1] - d.product.every[0]);
        e.prodCd -= step;
        if (e.prodCd <= 0) { g.dropItem(d.product.item, 1, e.x, e.y + 0.3, e.z); e.prodCd = null; }
      } else e.prodCd = null;
    }
    for (const k of ['love', 'breedCd', 'fed', 'shearCd']) if (e[k] > 0) e[k] = Math.max(0, e[k] - step);
    if (isBaby(e)) { e.age += step; if (!isBaby(e)) applySize(e); }
    if (e.love > 0 && !e.pair) pairUp(g, e);
    if (e.pair) {                                                              // cặp đang yêu: sau 6 giây sinh một con non
      const o = g.ents.get(e.pair);
      if (!o || o.pair !== e.id || !(e.love > 0) || !(o.love > 0) || Math.hypot(o.x - e.x, o.z - e.z) > LOVE_RANGE * 2) { if (o && o.pair === e.id) o.pair = null; e.pair = null; }
      else if (e.id < o.id) { e.bt = (e.bt || 0) + step; if (e.bt >= BIRTH_SECS) birth(g, e, o); }
    }
  }
}

// ---- AI ----
// Chưa thuần: chạy trốn như thú hoang. Đã thuần: đi theo người cầm đúng thức ăn (trong 8 block, giữ cách 2 block), tới bạn tình, không thì quanh quẩn gần chuồng (bán kính 10).
export function farmAI(g, e, d, dt) {
  if (!e.tamed) return AI.flee(g, e, d, dt);
  let who = null, best = FOLLOW_R;
  for (const p of g.players.values()) {
    if (p.dead) continue;
    const s = p.inv[p.sel];
    if (!s || s.id !== d.breed.food) continue;
    const dist = Math.hypot(p.x - e.x, p.z - e.z);
    if (dist < best) { best = dist; who = p; }
  }
  e.following = !!who;
  if (who) {
    if (best > FOLLOW_STOP) walk(g, e, who.x - e.x, who.z - e.z, d.speed * 0.8);
    else { e.vx = 0; e.vz = 0; e.yawT = yawTo(who.x - e.x, who.z - e.z); }
    return;
  }
  const mate = e.pair ? g.ents.get(e.pair) : null;
  if (mate && Math.hypot(mate.x - e.x, mate.z - e.z) > 1.8) return walk(g, e, mate.x - e.x, mate.z - e.z, d.speed * 0.5);
  if (Math.hypot(e.x - e.home.x, e.z - e.home.z) > HOME_R - 1) return walk(g, e, e.home.x - e.x, e.home.z - e.z, d.speed * 0.5);
  wander(g, e, d, dt, null);
}

// ---- lưu / nạp ----
export function serializeAnimals(g) {
  const r2 = v => Math.round(v * 100) / 100, out = [];
  for (const e of g.ents.values()) {
    if (!e.persist || !isFarmAnimal(e)) continue;
    out.push({ type: e.type, x: r2(e.x), y: r2(e.y), z: r2(e.z), hp: e.hp, tamed: true, age: r2(e.age), love: r2(e.love || 0), breedCd: r2(e.breedCd || 0), prodCd: e.prodCd == null ? null : r2(e.prodCd),
      fed: r2(e.fed || 0), sheared: r2(e.shearCd || 0), home: { x: r2(e.home.x), y: r2(e.home.y), z: r2(e.home.z) } });
  }
  return out;
}

// Nạp thú đã thuần (sau ensureNpcs); bỏ mục hỏng, cắt ở trần 24. Thú nạp xong ở trạng thái dormant tới khi animalTick thấy người chơi ở gần.
export function restoreAnimals(g, list) {
  const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  let n = tameCount(g);
  for (const a of Array.isArray(list) ? list : []) {
    const d = a && MOBS[a.type];
    if (!d || !d.farm || ![a.x, a.y, a.z].every(Number.isFinite) || n >= TAME_CAP) continue;
    const e = spawnMob(g, a.type, a.x, a.y, a.z, { persist: true, tamed: true, dormant: true });
    e.hp = Math.max(1, Math.min(d.hp, num(a.hp, d.hp)));
    e.age = Math.max(0, Math.min(d.adultSecs, num(a.age, d.adultSecs)));
    e.love = Math.max(0, num(a.love)); e.breedCd = Math.max(0, num(a.breedCd)); e.fed = Math.max(0, num(a.fed));
    e.prodCd = a.prodCd == null ? null : Math.max(0, num(a.prodCd)); e.shearCd = Math.max(0, num(a.sheared));
    if (a.home && [a.home.x, a.home.y, a.home.z].every(Number.isFinite)) e.home = { x: a.home.x, y: a.home.y, z: a.home.z };
    applySize(e); n++;
  }
}
