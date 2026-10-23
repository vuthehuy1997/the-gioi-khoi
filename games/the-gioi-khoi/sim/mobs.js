// Quái vật: tạo, AI, spawn theo vùng và ngày/đêm. Hàm nhận đối tượng game g (sim/game.js).
import { MOBS } from '../content/mobs.js';
import { moveBody } from './physics.js';
import { isNight } from './daynight.js';
import { B, isPlant } from '../world/blocks.js';
import { perceive, turnToward, angDiff, yawTo } from './perception.js';
import { WATER_LEVEL } from '../world/generate.js';
import { farmAI } from './animals.js';
import { noNaturalSpawn } from './dungeon.js';
import { WINDUP_FAST, WINDUP_SLOW, WINDUP_SLOW_CD, WINDUP_SLACK } from './rules.js';

export const MOB_CAP = 40, PER_PLAYER_CAP = 12;

// opts: { persist, tamed, dg } gán thẳng vào thực thể. persist (thú đã thuần, quái hầm): không bị xoá khi xa người chơi và không tính vào MOB_CAP/PER_PLAYER_CAP.
export function spawnMob(g, type, x, y, z, opts = {}) {
  const d = MOBS[type];
  if (!d) throw new Error('quái không tồn tại: ' + type);
  const e = { id: g.nextId++, kind: 'mob', type, x, y, z, vx: 0, vy: 0, vz: 0, w: d.w, h: d.h, onGround: false, inWater: false,
    hp: d.hp, maxHp: d.hp, yaw: 0, atkAt: 0, home: { x, y, z }, wanderT: 0, wdx: 0, wdz: 0 };
  if (d.farm) e.age = d.adultSecs;                                  // thú nuôi sinh hoang dã là trưởng thành; con non do sinh sản đặt age = 0
  Object.assign(e, opts);
  g.ents.set(e.id, e);
  return e;
}

const alive = g => [...g.players.values()].filter(p => !p.dead);

function nearestPlayer(g, e, range) {
  let best = null, bd = range;
  for (const p of alive(g)) {
    const d = Math.hypot(p.x - e.x, p.z - e.z);
    if (d < bd && Math.abs(p.y - e.y) < 12) { bd = d; best = p; }
  }
  return best && { p: best, d: bd };
}

// Hướng muốn quay (quái quay dần, không quay tức thì): chính hướng này quyết định nón nhìn.
function face(e, dx, dz) { e.yawT = yawTo(dx, dz); }

// Đi theo hướng (dx, dz) với tốc độ speed; nhảy nếu vướng bậc 1 block.
export function walk(g, e, dx, dz, speed) {
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) { e.vx = 0; e.vz = 0; return; }
  dx /= len; dz /= len;
  e.vx = dx * speed; e.vz = dz * speed; face(e, dx, dz);
  if (e.onGround) {
    const ax = e.x + dx * (e.w / 2 + 0.3), az = e.z + dz * (e.w / 2 + 0.3);
    if (g.world.isSolidAt(ax, e.y + 0.2, az) && !g.world.isSolidAt(ax, e.y + 1.2, az) && !g.world.isSolidAt(e.x, e.y + e.h + 0.3, e.z)) e.vy = 7.8;
  }
}

// Đứng yên và đảo mắt quanh (lục soát hoặc canh gác): quét qua lại để mở rộng vùng nhìn.
function lookAround(g, e, amp = 1.3) { e.vx = 0; e.vz = 0; if (e.baseYaw === undefined) e.baseYaw = e.yaw; e.yawT = e.baseYaw + Math.sin(g.time * 1.6 + e.id) * amp; }

export function wander(g, e, d, dt, P) {
  if (P && P.suspect && e.watch) { e.vx = 0; e.vz = 0; face(e, e.watch.x - e.x, e.watch.z - e.z); return; }   // nghi ngờ: dừng lại nhìn về phía đó
  e.wanderT -= dt;
  if (e.wanderT <= 0) {
    e.wanderT = 2 + g.rng() * 4;
    if (g.rng() < 0.4) { e.wdx = 0; e.wdz = 0; e.baseYaw = e.yaw; } else { const a = g.rng() * Math.PI * 2; e.wdx = Math.cos(a); e.wdz = Math.sin(a); }
  }
  if (e.wdx || e.wdz) walk(g, e, e.wdx, e.wdz, d.speed * 0.3); else lookAround(g, e, 0.7);
}

// Quái cận chiến vào tầm thì vung đòn có báo hiệu (windup) rồi mới trừ máu; người chơi lùi ra khỏi tầm + dung sai trong lúc đó thì trượt.
// Hồi chiêu tính từ lúc bắt đầu vung nên nhịp đánh tổng giữ nguyên số liệu cũ. Đòn chốt ở windupStep().
function meleeAttack(g, e, d, t) {
  const a = d.attack;
  if (e.windup || g.time < e.atkAt) return;
  const dist = Math.hypot(t.p.x - e.x, (t.p.y + 0.9) - (e.y + e.h / 2), t.p.z - e.z);
  if (dist <= a.range + t.p.w / 2) {
    const ww = a.cd >= WINDUP_SLOW_CD ? WINDUP_SLOW : WINDUP_FAST;
    e.windup = { until: g.time + ww, uid: t.p.uid }; e.atkAt = g.time + a.cd; e.vx = 0; e.vz = 0;
    g.emit(null, { t: 'windup', id: e.id, time: ww });
  }
}

// Đang vung: đứng yên, quay về mục tiêu; hết thời gian vung thì đòn trúng nếu mục tiêu còn trong tầm (+ dung sai).
function windupStep(g, e, d) {
  const w = e.windup, t = g.player(w.uid), a = d.attack;
  e.vx = 0; e.vz = 0;
  if (!t || t.dead) { e.windup = null; return; }
  face(e, t.x - e.x, t.z - e.z);
  if (g.time < w.until) return;
  e.windup = null;
  const dist = Math.hypot(t.x - e.x, (t.y + 0.9) - (e.y + e.h / 2), t.z - e.z);
  if (dist <= a.range + WINDUP_SLACK + t.w / 2) {
    const r = g.hurtPlayer(t, a.dmg, e);
    if (r.how === null || r.how === 'broke' || r.how === 'shield') {                       // khiên chỉ đẩy lùi nửa lực
      const k = 5 / Math.max(0.1, Math.hypot(t.x - e.x, t.z - e.z)) * (r.how === 'shield' ? 0.5 : 1);
      g.emit(t.uid, { t: 'kb', vx: (t.x - e.x) * k, vz: (t.z - e.z) * k, vy: 4 });
    }
  }
  g.emit(null, { t: 'swing', id: e.id });
}

export const AI = {
  'farm': (g, e, d, dt) => farmAI(g, e, d, dt),                                          // thú nuôi: hoang thì chạy trốn, thuần thì ở gần người/chuồng (sim/animals.js)
  'chase-melee'(g, e, d, dt) {
    const P = perceive(g, e, d, dt), t = P.target;
    if (P.mode === 'chase' && t) {
      if (P.seen) { walk(g, e, t.x - e.x, t.z - e.z, d.speed); meleeAttack(g, e, d, { p: t }); }
      else if (P.goal) walk(g, e, P.goal.x - e.x, P.goal.z - e.z, d.speed * 0.9);        // mất dấu: tới chỗ thấy cuối
    } else if (P.mode === 'curious' && P.goal) walk(g, e, P.goal.x - e.x, P.goal.z - e.z, d.speed * 0.55);
    else if (P.mode === 'search') lookAround(g, e, 1.4);
    else wander(g, e, d, dt, P);
  },
  'flee'(g, e, d, dt) {
    const P = perceive(g, e, d, dt), t = P.target;
    if (P.mode === 'chase' && t) {
      if (!P.seen && e.lostT > 2.5) { e.state = 'idle'; e.target = null; e.alert = 0; return wander(g, e, d, dt); }
      const from = P.seen ? t : (P.goal || t); walk(g, e, e.x - from.x, e.z - from.z, d.speed);            // bỏ chạy khỏi kẻ đã thấy
    } else if (P.mode === 'curious' && P.goal) walk(g, e, e.x - P.goal.x, e.z - P.goal.z, d.speed * 0.8);     // giật mình vì tiếng động: chạy ngược lại
    else if (P.mode === 'search') lookAround(g, e, 1.6);
    else wander(g, e, d, dt, P);
  },
  'ranged-kite'(g, e, d, dt) {
    const P = perceive(g, e, d, dt), t = P.target;
    if (P.mode === 'chase' && t) {
      if (P.seen) {
        const dx = t.x - e.x, dz = t.z - e.z, dd = Math.hypot(dx, dz);
        if (dd < 6) walk(g, e, -dx, -dz, d.speed); else if (dd > 12) walk(g, e, dx, dz, d.speed); else walk(g, e, -dz, dx, d.speed * 0.5);
        face(e, dx, dz);                                                                  // vừa lùi/đi vòng vừa nhìn mục tiêu
        const aligned = Math.abs(angDiff(yawTo(dx, dz), e.yaw)) < 0.5;
        if (dd <= d.shot.range && aligned && g.time >= e.atkAt && g.world.lineClear(e.x, e.y + e.h * 0.8, e.z, t.x, t.y + 1.2, t.z)) { e.atkAt = g.time + d.shot.cd; shoot(g, e, t, d.shot); }
      } else if (P.goal) walk(g, e, P.goal.x - e.x, P.goal.z - e.z, d.speed);              // không có đường ngắm: tiến lên tìm góc bắn
    } else if (P.mode === 'curious' && P.goal) walk(g, e, P.goal.x - e.x, P.goal.z - e.z, d.speed * 0.55);
    else if (P.mode === 'search') lookAround(g, e, 1.3);
    else wander(g, e, d, dt, P);
  },
  'guard'(g, e, d, dt) {
    const P = perceive(g, e, d, dt), t = P.target, fromHome = Math.hypot(e.x - e.home.x, e.z - e.home.z);
    if (P.mode === 'chase' && t && fromHome < d.leash) {
      if (P.seen) { walk(g, e, t.x - e.x, t.z - e.z, d.speed); meleeAttack(g, e, d, { p: t }); }
      else if (P.goal) walk(g, e, P.goal.x - e.x, P.goal.z - e.z, d.speed * 0.9);
    } else if (fromHome > 1) { if (P.mode === 'chase') { e.state = 'idle'; e.target = null; e.alert = 0; } walk(g, e, e.home.x - e.x, e.home.z - e.z, d.speed); }
    else lookAround(g, e, 1.0);                                                           // canh gác: đảo mắt quanh chỗ đứng
  },
};

export function shoot(g, from, target, s, ttl = 4) {
  const ox = from.x, oy = from.y + from.h * 0.7, oz = from.z;
  const dx = target.x - ox, dy = (target.y + 1.0) - oy, dz = target.z - oz, len = Math.hypot(dx, dy, dz) || 1;
  const e = { id: g.nextId++, kind: 'proj', x: ox, y: oy, z: oz, vx: dx / len * s.speed, vy: dy / len * s.speed, vz: dz / len * s.speed, dmg: s.dmg, owner: from.id, ttl, w: 0, h: 0, style: s.style || 'arrow' };
  g.ents.set(e.id, e);
  g.emit(null, { t: 'swing', id: from.id });
  return e;
}

export function stepBody(g, e, dt) {
  e.vy -= 25 * dt; if (e.vy < -50) e.vy = -50;
  moveBody(g.world, e, dt);
}

export function stepMobs(g, dt) {
  for (const e of [...g.ents.values()]) {
    if (e.kind !== 'mob' || e.dormant) continue;                          // dormant: thú nuôi xa mọi người, đóng băng hoàn toàn
    const d = MOBS[e.type];
    if (e.stunUntil > g.time) { e.windup = null; e.vx = 0; e.vz = 0; }                  // choáng (chùy, đỡ hoàn hảo): đứng yên, không đánh
    else if (e.windup) windupStep(g, e, d);
    else if (!e.frozen) AI[d.ai](g, e, d, dt); else { e.vx = 0; e.vz = 0; }
    if (e.yawT !== undefined) e.yaw = turnToward(e.yaw, e.yawT, (d.turn || 5) * dt);
    if (e.kbT > 0) { e.kbT -= dt; e.vx = e.kbx; e.vz = e.kbz; }
    stepBody(g, e, dt);
    if (e.y < -10) g.ents.delete(e.id);
  }
}

// Mỗi giây thử sinh quái quanh từng người chơi theo vùng, ngày/đêm và giới hạn số lượng.
const TORCH_R = 8;
function torchNear(world, x, y, z) {
  for (let dy = -2; dy <= 4; dy++) for (let dz = -TORCH_R; dz <= TORCH_R; dz++) for (let dx = -TORCH_R; dx <= TORCH_R; dx++) if (world.get(x + dx, y + dy, z + dz) === B.TORCH) return true;
  return false;
}

export function spawnTick(g, dt) {
  g.spawnAcc = (g.spawnAcc || 0) + dt;
  if (g.spawnAcc < 1) return;
  g.spawnAcc -= 1;
  const mobs = [...g.ents.values()].filter(e => e.kind === 'mob' && !e.persist);      // thú đã thuần/quái hầm không tính vào trần và không bị xoá
  const night = isNight(g.time);
  // bỏ quái ở quá xa mọi người chơi (trừ lính gác)
  const ps = alive(g), all = [...g.players.values()];
  for (const e of mobs) if (MOBS[e.type].ai !== 'guard' && all.length && !all.some(p => Math.hypot(p.x - e.x, p.z - e.z) < 80)) g.ents.delete(e.id);
  if (mobs.length >= MOB_CAP) return;
  for (const p of ps) {
    const near = mobs.filter(e => Math.hypot(p.x - e.x, p.z - e.z) < 48);
    if (near.length >= PER_PLAYER_CAP || g.rng() > 0.6) continue;
    const a = g.rng() * Math.PI * 2, r = 14 + g.rng() * 16;
    const x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
    const sy = g.world.surfaceY(x, z);
    const free = id => id === B.AIR || isPlant(id);
    if (sy <= WATER_LEVEL || !free(g.world.get(x, sy + 1, z)) || !free(g.world.get(x, sy + 2, z))) continue;
    if (torchNear(g.world, x, sy, z)) continue;                // đuốc đuổi quái: không sinh quái trong 8 block quanh đuốc
    if (noNaturalSpawn(g, x, sy + 1, z)) continue;             // miệng hầm ngục và khối bao của hầm: không sinh quái tự nhiên
    const region = g.world.regionAt(x, z);
    const options = Object.entries(MOBS).filter(([, d]) => d.weight > 0 && d.regions.includes(region) && (d.when === 'any' || (d.when === 'night') === night));
    if (!options.length) continue;
    if (options.every(([, d]) => d.passive) && near.filter(e => MOBS[e.type].passive).length >= 6) continue;
    let tot = options.reduce((s, [, d]) => s + d.weight, 0), pick = g.rng() * tot, type = options[0][0];
    for (const [id, d] of options) { pick -= d.weight; if (pick <= 0) { type = id; break; } }
    spawnMob(g, type, x + 0.5, sy + 1, z + 0.5);
  }
}
