// Boss: tạo, AI nhiều pha, co giãn độ khó theo số người, đấu trường kích hoạt khi có người bước vào.
import { BOSSES, SCALE_HP, SCALE_DMG } from '../content/bosses.js';
import { MOBS } from '../content/mobs.js';
import { shoot, stepBody, spawnMob } from './mobs.js';
import { DUNGEONS } from '../content/dungeons.js';
import { siteOk } from './dungeon.js';

const alive = g => [...g.players.values()].filter(p => !p.dead);
const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function spawnBoss(g, type, x, y, z) {
  const d = BOSSES[type];
  if (!d) throw new Error('boss không tồn tại: ' + type);
  const e = { id: g.nextId++, kind: 'boss', type, x, y, z, vx: 0, vy: 0, vz: 0, w: d.w, h: d.h, onGround: false, inWater: false,
    hp: d.hp, maxHp: d.hp, baseHp: d.hp, yaw: 0, phase: 0, speedMul: 1, dmgMul: 1, scaleDmg: 1, n: 1,
    home: { x, y, z }, cd: {}, act: null, idleT: 0, minions: [] };
  g.ents.set(e.id, e);
  g.emit(null, { t: 'boss-start', id: e.id, type, name: d.name });
  return e;
}

function pickMove(g, e, d, t, dist) {
  const ph = d.phases[e.phase], opts = [];
  for (const name of ph.moves) {
    const m = d.moves[name];
    if ((e.cd[name] || 0) > g.time) continue;
    let ok = false;
    if (m.type === 'melee') ok = dist <= m.range;
    else if (m.type === 'leap') ok = dist > 3.5 && dist <= m.range;
    else if (m.type === 'volley') ok = dist > 4;
    else if (m.type === 'slam') ok = dist <= m.radius + 2;
    else if (m.type === 'summon') ok = e.minions.filter(id => g.ents.has(id)).length < 4;
    if (ok) opts.push(name);
  }
  return opts.length ? opts[Math.floor(g.rng() * opts.length)] : null;
}

function damageNear(g, e, x, z, r, dmg) {
  for (const p of alive(g)) if (Math.hypot(p.x - x, p.z - z) <= r + p.w / 2 && Math.abs(p.y - e.y) < 3) {
    g.hurtPlayer(p, dmg, e);
    const k = 7 / Math.max(0.1, Math.hypot(p.x - e.x, p.z - e.z));
    g.emit(p.uid, { t: 'kb', vx: (p.x - e.x) * k, vz: (p.z - e.z) * k, vy: 5 });
  }
}

function startMove(g, e, d, name, t) {
  const m = d.moves[name], dm = m.dmg ? m.dmg * e.dmgMul * e.scaleDmg : 0;
  e.cd[name] = g.time + m.cd;
  if (m.type === 'melee') { damageNear(g, e, e.x, e.z, m.range, dm); g.emit(null, { t: 'swing', id: e.id }); }
  else if (m.type === 'volley') {
    const aim = Math.atan2(t.z - e.z, t.x - e.x), c = m.count;
    for (let i = 0; i < c; i++) {
      const a = aim + (c === 1 ? 0 : (i / (c - 1) - 0.5) * m.spread);
      shoot(g, e, { x: e.x + Math.cos(a) * 20, y: t.y, z: e.z + Math.sin(a) * 20 }, { dmg: dm, speed: m.speed, style: m.style }, 3);
    }
  } else if (m.type === 'summon') {
    for (let i = 0; i < m.count; i++) {
      const a = g.rng() * Math.PI * 2, x = e.x + Math.cos(a) * 3, z = e.z + Math.sin(a) * 3;
      const mob = spawnMob(g, m.mob, x, e.y + 0.5, z); e.minions.push(mob.id);
    }
    g.emit(null, { t: 'swing', id: e.id });
  } else if (m.type === 'slam') {
    e.act = { name, type: 'slam', until: g.time + m.windup, x: e.x, z: e.z, dmg: dm, r: m.radius };
    g.emit(null, { t: 'telegraph', id: e.id, x: e.x, z: e.z, r: m.radius, time: m.windup });
  } else if (m.type === 'leap') {
    e.act = { name, type: 'leap', until: g.time + 0.4, dmg: dm, r: m.radius, phase: 'wind', tx: t.x, tz: t.z };
    g.emit(null, { t: 'telegraph', id: e.id, x: t.x, z: t.z, r: m.radius, time: 0.4 });
  }
}

function stepBossAI(g, e, d, dt) {
  const arena = e.arena || { x: e.home.x, z: e.home.z, r: d.radius };
  const ps = alive(g).filter(p => hdist(p, arena) <= arena.r * 1.5 + 4);
  let t = null, td = Infinity;
  for (const p of ps) { const dd = hdist(p, e); if (dd < td) { td = dd; t = p; } }
  const sp = d.speed * e.speedMul;

  if (e.act) {
    const a = e.act;
    if (a.type === 'slam') { e.vx = e.vz = 0; if (g.time >= a.until) { damageNear(g, e, a.x, a.z, a.r, a.dmg); g.emit(null, { t: 'swing', id: e.id }); e.act = null; } }
    else if (a.type === 'leap') {
      if (a.phase === 'wind') { e.vx = e.vz = 0; if (g.time >= a.until) { const dx = a.tx - e.x, dz = a.tz - e.z, T = 0.7; e.vx = dx / T; e.vz = dz / T; e.vy = 9; a.phase = 'air'; a.t0 = g.time; } }
      else if (e.onGround && g.time - a.t0 > 0.25) { e.vx = e.vz = 0; damageNear(g, e, e.x, e.z, a.r, a.dmg); e.act = null; }
      else if (g.time - a.t0 > 2) e.act = null;
    }
    return;
  }
  if (!t) {                                                                        // không có ai: về chỗ cũ
    const hd = hdist(e, e.home);
    if (hd > 1) { const dx = e.home.x - e.x, dz = e.home.z - e.z, l = Math.hypot(dx, dz); e.vx = dx / l * sp; e.vz = dz / l * sp; } else { e.vx = e.vz = 0; }
    return;
  }
  const move = pickMove(g, e, d, t, td);
  if (move) startMove(g, e, d, move, t);
  if (!e.act) {
    const m = Object.values(d.moves).find(x => x.type === 'melee');
    const want = m ? m.range * 0.8 : 3;
    const dx = t.x - e.x, dz = t.z - e.z, l = Math.hypot(dx, dz) || 1;
    if (td > want) { e.vx = dx / l * sp; e.vz = dz / l * sp; } else { e.vx = e.vz = 0; }
    e.yaw = Math.atan2(-dx, -dz);
  }
}

export function stepBosses(g, dt) {
  for (const e of [...g.ents.values()]) {
    if (e.kind !== 'boss') continue;
    const d = BOSSES[e.type], arena = e.arena || { x: e.home.x, z: e.home.z, r: d.radius };
    // co giãn theo số người trong đấu trường (giữ nguyên tỉ lệ máu)
    const n = Math.max(1, alive(g).filter(p => hdist(p, arena) <= arena.r + 6).length);
    if (n !== e.n) {
      const ratio = e.hp / e.maxHp;
      e.n = n; e.maxHp = Math.round(e.baseHp * (1 + SCALE_HP * (n - 1))); e.hp = ratio * e.maxHp; e.scaleDmg = 1 + SCALE_DMG * (n - 1);
      g.emit(null, { t: 'hit', id: e.id, hp: e.hp, maxHp: e.maxHp });
    }
    const frac = e.hp / e.maxHp;
    let ph = 0; d.phases.forEach((p, i) => { if (frac <= p.from) ph = i; });
    if (ph !== e.phase) { e.phase = ph; g.emit(null, { t: 'boss-phase', id: e.id, phase: ph }); }
    e.speedMul = d.phases[e.phase].speedMul; e.dmgMul = d.phases[e.phase].dmgMul;
    e.minions = e.minions.filter(id => g.ents.has(id));
    if (!e.frozen) stepBossAI(g, e, d, dt); else { e.vx = e.vz = 0; }
    stepBody(g, e, dt);
  }
}

// Đấu trường: có người bước vào thì boss xuất hiện; không còn ai trong ~5 giây thì boss về trạng thái đầy máu (xoá để lần sau tạo lại).
export function stepArenas(g, dt) {
  const sites = g.flags.sites;
  if (!sites) return;
  // đấu trường mặt đất [boss, điểm, dọc] và phòng chủ P4 của hầm ngục (dọc hẹp để người đứng trên mặt đất không kích hoạt)
  const arenas = Object.entries(sites.arena || {}).map(([id, s]) => [id, s, 12]);
  for (const [did, s] of Object.entries(sites.dungeon || {})) if (DUNGEONS[did] && siteOk(s)) arenas.push([DUNGEONS[did].boss, s.p4, 5]);
  for (const [id, site, vy] of arenas) {
    const d = BOSSES[id];
    if (g.flags[d.flag]) continue;
    const near = alive(g).some(p => hdist(p, site) <= d.radius && Math.abs(p.y - site.y) < vy + (vy < 12 ? 2 : 0));
    const wide = alive(g).some(p => hdist(p, site) <= d.radius * 1.6 + 4 && (vy >= 12 || Math.abs(p.y - site.y) < vy + 3));
    let boss = [...g.ents.values()].find(e => e.kind === 'boss' && e.type === id);
    if (!boss && near) { boss = spawnBoss(g, id, site.x + 0.5, site.y + 1, site.z + 0.5); boss.arena = { x: site.x + 0.5, z: site.z + 0.5, r: d.radius }; }
    if (boss) {
      boss.idleT = wide ? 0 : boss.idleT + dt;
      if (boss.idleT >= 5) { for (const m of boss.minions) g.ents.delete(m); g.ents.delete(boss.id); g.emit(null, { t: 'boss-reset', id: boss.id }); }
    }
  }
}

export const bossDef = e => BOSSES[e.type];
