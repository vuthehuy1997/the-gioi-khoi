// Quái vật: tạo, AI, spawn theo vùng và ngày/đêm. Hàm nhận đối tượng game g (sim/game.js).
import { MOBS } from '../content/mobs.js';
import { moveBody } from './physics.js';
import { isNight } from './daynight.js';
import { B } from '../world/blocks.js';
import { WATER_LEVEL } from '../world/generate.js';

export const MOB_CAP = 40, PER_PLAYER_CAP = 12;

export function spawnMob(g, type, x, y, z) {
  const d = MOBS[type];
  if (!d) throw new Error('quái không tồn tại: ' + type);
  const e = { id: g.nextId++, kind: 'mob', type, x, y, z, vx: 0, vy: 0, vz: 0, w: d.w, h: d.h, onGround: false, inWater: false,
    hp: d.hp, maxHp: d.hp, yaw: 0, atkAt: 0, home: { x, y, z }, wanderT: 0, wdx: 0, wdz: 0 };
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

function face(e, dx, dz) { e.yaw = Math.atan2(-dx, -dz); }

// Đi theo hướng (dx, dz) với tốc độ speed; nhảy nếu vướng bậc 1 block.
function walk(g, e, dx, dz, speed) {
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) { e.vx = 0; e.vz = 0; return; }
  dx /= len; dz /= len;
  e.vx = dx * speed; e.vz = dz * speed; face(e, dx, dz);
  if (e.onGround) {
    const ax = e.x + dx * (e.w / 2 + 0.3), az = e.z + dz * (e.w / 2 + 0.3);
    if (g.world.isSolidAt(ax, e.y + 0.2, az) && !g.world.isSolidAt(ax, e.y + 1.2, az) && !g.world.isSolidAt(e.x, e.y + e.h + 0.3, e.z)) e.vy = 7.8;
  }
}

function wander(g, e, d, dt) {
  e.wanderT -= dt;
  if (e.wanderT <= 0) {
    e.wanderT = 2 + g.rng() * 4;
    if (g.rng() < 0.4) { e.wdx = 0; e.wdz = 0; } else { const a = g.rng() * Math.PI * 2; e.wdx = Math.cos(a); e.wdz = Math.sin(a); }
  }
  walk(g, e, e.wdx, e.wdz, d.speed * 0.3);
}

function meleeAttack(g, e, d, t) {
  const a = d.attack;
  if (g.time < e.atkAt) return;
  const dist = Math.hypot(t.p.x - e.x, (t.p.y + 0.9) - (e.y + e.h / 2), t.p.z - e.z);
  if (dist <= a.range + t.p.w / 2) {
    e.atkAt = g.time + a.cd;
    g.hurtPlayer(t.p, a.dmg, e);
    const k = 5 / Math.max(0.1, Math.hypot(t.p.x - e.x, t.p.z - e.z));
    g.emit(t.p.uid, { t: 'kb', vx: (t.p.x - e.x) * k, vz: (t.p.z - e.z) * k, vy: 4 });
    g.emit(null, { t: 'swing', id: e.id });
  }
}

const AI = {
  'chase-melee'(g, e, d, dt) {
    const t = nearestPlayer(g, e, d.sight);
    if (!t) return wander(g, e, d, dt);
    walk(g, e, t.p.x - e.x, t.p.z - e.z, d.speed);
    meleeAttack(g, e, d, t);
  },
  'flee'(g, e, d, dt) {
    const t = nearestPlayer(g, e, d.sight);
    if (!t) return wander(g, e, d, dt);
    walk(g, e, e.x - t.p.x, e.z - t.p.z, d.speed);
  },
  'ranged-kite'(g, e, d, dt) {
    const t = nearestPlayer(g, e, d.sight);
    if (!t) return wander(g, e, d, dt);
    const dx = t.p.x - e.x, dz = t.p.z - e.z;
    if (t.d < 6) walk(g, e, -dx, -dz, d.speed);
    else if (t.d > 12) walk(g, e, dx, dz, d.speed);
    else { walk(g, e, -dz, dx, d.speed * 0.5); face(e, dx, dz); }             // đi vòng quanh
    if (t.d <= d.shot.range && g.time >= e.atkAt) {
      e.atkAt = g.time + d.shot.cd;
      shoot(g, e, t.p, d.shot);
    }
  },
  'guard'(g, e, d, dt) {
    const t = nearestPlayer(g, e, d.sight);
    const fromHome = Math.hypot(e.x - e.home.x, e.z - e.home.z);
    if (t && fromHome < d.leash) { walk(g, e, t.p.x - e.x, t.p.z - e.z, d.speed); meleeAttack(g, e, d, t); }
    else if (fromHome > 1) walk(g, e, e.home.x - e.x, e.home.z - e.z, d.speed);
    else { e.vx = 0; e.vz = 0; }
  },
};

export function shoot(g, from, target, s, ttl = 4) {
  const ox = from.x, oy = from.y + from.h * 0.7, oz = from.z;
  const dx = target.x - ox, dy = (target.y + 1.0) - oy, dz = target.z - oz, len = Math.hypot(dx, dy, dz) || 1;
  const e = { id: g.nextId++, kind: 'proj', x: ox, y: oy, z: oz, vx: dx / len * s.speed, vy: dy / len * s.speed, vz: dz / len * s.speed, dmg: s.dmg, owner: from.id, ttl, w: 0, h: 0 };
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
    if (e.kind !== 'mob') continue;
    const d = MOBS[e.type];
    if (!e.frozen) AI[d.ai](g, e, d, dt); else { e.vx = 0; e.vz = 0; }
    if (e.kbT > 0) { e.kbT -= dt; e.vx = e.kbx; e.vz = e.kbz; }
    stepBody(g, e, dt);
    if (e.y < -10) g.ents.delete(e.id);
  }
}

// Mỗi giây thử sinh quái quanh từng người chơi theo vùng, ngày/đêm và giới hạn số lượng.
export function spawnTick(g, dt) {
  g.spawnAcc = (g.spawnAcc || 0) + dt;
  if (g.spawnAcc < 1) return;
  g.spawnAcc -= 1;
  const mobs = [...g.ents.values()].filter(e => e.kind === 'mob');
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
    if (sy <= WATER_LEVEL || g.world.get(x, sy + 1, z) !== B.AIR || g.world.get(x, sy + 2, z) !== B.AIR) continue;
    const region = g.world.regionAt(x, z);
    const options = Object.entries(MOBS).filter(([, d]) => d.weight > 0 && d.regions.includes(region) && (d.when === 'any' || (d.when === 'night') === night));
    if (!options.length) continue;
    if (options.every(([, d]) => d.passive) && near.filter(e => MOBS[e.type].passive).length >= 6) continue;
    let tot = options.reduce((s, [, d]) => s + d.weight, 0), pick = g.rng() * tot, type = options[0][0];
    for (const [id, d] of options) { pick -= d.weight; if (pick <= 0) { type = id; break; } }
    spawnMob(g, type, x + 0.5, sy + 1, z + 0.5);
  }
}
