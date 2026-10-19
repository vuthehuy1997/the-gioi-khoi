// Chiến đấu: sát thương, cái chết, rơi đồ, vật phẩm rơi, đạn, hồi máu. Hàm nhận đối tượng game g.
import { MOBS } from '../content/mobs.js';
import { ITEMS, HAND_DAMAGE } from '../content/items.js';
import { addItem, removeItem, canFit } from './inventory.js';
import { stepBody } from './mobs.js';
import { B, isSolid } from '../world/blocks.js';

export const HIT_REACH = 4.5, HIT_CD = 0.5, REGEN_AFTER = 8, REGEN_EVERY = 4;

import { aggro } from './perception.js';

export function hurtPlayer(g, p, dmg, src) {
  if (p.dead || dmg <= 0) return;
  g.makeNoise(p.x, p.y, p.z, 9);
  p.hp = Math.max(0, p.hp - dmg); p.lastHurt = g.time; g.touch(p);
  g.emit(p.uid, { t: 'hurt', hp: p.hp, by: src ? src.id : null });
  if (p.hp <= 0) {
    p.dead = true; p.respawnAt = g.time + 3; p.dig = null;
    g.emit(null, { t: 'died', uid: p.uid, name: p.name });
    g.onPlayerDeath?.(p);
  }
}

export function dropLoot(g, e) {
  const d = (e.kind === 'boss' ? g.bossDef?.(e) : MOBS[e.type]);
  if (!d) return;
  for (const l of d.drops || []) {
    if (g.rng() > l.p) continue;
    const n = l.min + Math.floor(g.rng() * (l.max - l.min + 1));
    if (n > 0) g.dropItem(l.item, n, e.x, e.y + 0.5, e.z);
  }
}

export function damageEntity(g, e, dmg, src) {
  if (!g.ents.has(e.id) || e.hp <= 0) return false;
  e.hp -= dmg;
  if (e.kind === 'mob') aggro(g, e, src);                              // bị đánh: biết ngay kẻ tấn công ở đâu, kể cả đánh lén từ sau
  g.emit(null, { t: 'hit', id: e.id, hp: Math.max(0, e.hp) });
  if (src && e.kind === 'mob') {                                      // đẩy lùi nhẹ
    const k = 4 / Math.max(0.1, Math.hypot(e.x - src.x, e.z - src.z));
    e.kbx = (e.x - src.x) * k; e.kbz = (e.z - src.z) * k; e.kbT = 0.2; e.vy = 4;
  }
  if (e.hp <= 0) {
    g.ents.delete(e.id);
    dropLoot(g, e);
    g.emit(null, { t: 'killed', id: e.id, type: e.type, by: src ? src.uid : null });
    g.onKill?.(e, src);
  }
  return true;
}

export function actHit(g, p, a) {
  const e = g.ents.get(a.id);
  if (!e || (e.kind !== 'mob' && e.kind !== 'boss')) return { ok: false, reason: 'no-target' };
  if (g.time < p.attackAt) return { ok: false, reason: 'cooldown' };
  const d = Math.hypot(e.x - p.x, (e.y + e.h / 2) - (p.y + 1.62), e.z - p.z) - e.w / 2;
  if (d > HIT_REACH) return { ok: false, reason: 'reach' };
  const h = g.held(p);
  const dmg = h && h.dmg ? h.dmg : HAND_DAMAGE;
  p.attackAt = g.time + HIT_CD;
  g.makeNoise(p.x, p.y, p.z, 12);                                        // đánh nhau gây tiếng động
  g.damageEntity(e, dmg, p);
  return { ok: true };
}

export function actUse(g, p) {
  const s = p.inv[p.sel];
  if (!s) return { ok: false, reason: 'empty' };
  const it = ITEMS[s.id];
  if (!it.heal) return { ok: false, reason: 'not-food' };
  if (p.hp >= p.maxHp) return { ok: false, reason: 'full' };
  p.hp = Math.min(p.maxHp, p.hp + it.heal);
  removeItem(p.inv, s.id, 1); g.touch(p);
  g.emit(p.uid, { t: 'hurt', hp: p.hp, by: null });
  return { ok: true };
}

export function actRespawn(g, p) {
  if (!p.dead) return { ok: false, reason: 'alive' };
  if (g.time < p.respawnAt) return { ok: false, reason: 'too-soon' };
  p.dead = false; p.hp = p.maxHp; p.lastHurt = -99; g.touch(p);
  g.teleportPlayer(p, g.spawn.x + 0.5, g.world.surfaceY(g.spawn.x, g.spawn.z) + 1, g.spawn.z + 0.5);
  g.emit(p.uid, { t: 'hurt', hp: p.hp, by: null });
  return { ok: true };
}

export function updateItems(g, dt) {
  for (const e of [...g.ents.values()]) {
    if (e.kind !== 'item') continue;
    stepBody(g, e, dt);
    e.vx *= 0.9; e.vz *= 0.9;
    if (g.time - e.born > 180) { g.ents.delete(e.id); continue; }
    if (g.time - e.born < 0.4) continue;
    for (const p of g.players.values()) {
      if (p.dead || Math.hypot(p.x - e.x, p.z - e.z) > 1.8 || Math.abs((p.y + 0.9) - e.y) > 2) continue;
      if (!canFit(p.inv, e.item, e.n)) continue;
      addItem(p.inv, e.item, e.n); g.touch(p);
      g.emit(p.uid, { t: 'pickup', item: e.item, n: e.n });
      g.onPickup?.(p, e.item, e.n);
      g.ents.delete(e.id);
      break;
    }
  }
}

export function updateProjectiles(g, dt) {
  for (const e of [...g.ents.values()]) {
    if (e.kind !== 'proj') continue;
    e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; e.ttl -= dt;
    if (e.ttl <= 0 || isSolid(g.world.get(e.x, e.y, e.z))) { g.ents.delete(e.id); continue; }
    for (const p of g.players.values()) {
      if (p.dead) continue;
      if (Math.hypot(p.x - e.x, p.z - e.z) < 0.55 && e.y > p.y - 0.1 && e.y < p.y + p.h + 0.1) { hurtPlayer(g, p, e.dmg, e); g.ents.delete(e.id); break; }
    }
  }
}

export function updatePlayers(g, dt) {
  for (const p of g.players.values()) {
    if (p.dead) continue;
    if (p.hp < p.maxHp && g.time - p.lastHurt > REGEN_AFTER) {
      p.regenAcc = (p.regenAcc || 0) + dt;
      if (p.regenAcc >= REGEN_EVERY) { p.regenAcc -= REGEN_EVERY; p.hp = Math.min(p.maxHp, p.hp + 1); g.touch(p); g.emit(p.uid, { t: 'hurt', hp: p.hp, by: null }); }
    } else p.regenAcc = 0;
  }
}
