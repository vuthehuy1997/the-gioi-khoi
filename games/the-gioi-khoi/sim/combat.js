// Chiến đấu: sát thương, cái chết, rơi đồ, vật phẩm rơi, đạn, hồi máu. Hàm nhận đối tượng game g.
import * as ach from './achievements.js';
import { MOBS } from '../content/mobs.js';
import { ITEMS, HAND_DAMAGE } from '../content/items.js';
import { addItem, removeItem, canFit } from './inventory.js';
import { stepBody } from './mobs.js';
import { B, isSolid } from '../world/blocks.js';

export const REGEN_AFTER = 8, REGEN_EVERY = 4;
// Hồi máu theo đói: no (>= 18) hồi nhanh, vừa (7..17) như luật cũ, đói (<= 6) không tự hồi.
export const REGEN_FAST_AFTER = 4, REGEN_FAST_EVERY = 2, FOOD_FAST = 18, FOOD_NONE = 6;

import { aggro } from './perception.js';

import { reduceDamage } from './armor.js';
import { eat, exert, clearFx, powerMul, toughBonus, FOOD_ON_RESPAWN } from './hunger.js';
import * as R from './rules.js';
import { isInvuln, guardResult, applyGuard, spendStamina, resetFight, isRolling, isStunned, onGround } from './fight.js';

// Đường ống sát thương người chơi: lăn (bất khả xâm phạm) -> khiên (cung phía trước) -> giáp -> tối thiểu 1.
// src: kẻ gây sát thương (quái, đạn, bẫy); không có src hoặc opts.pure (khí độc, nóng lạnh, bỏng, đói, độc) thì bỏ qua cả ba bước.
// opts.blockable === false: đòn khiên không chặn được (đập vùng của boss, gai, ống phun), lăn vẫn né được.
// Trả { dealt, how } (how: null | 'roll' | 'shield' | 'perfect' | 'broke').
export function hurtPlayer(g, p, dmg, src, opts = {}) {
  if (p.dead || dmg <= 0) return { dealt: 0, how: null };
  let how = null;
  if (src && !opts.pure) {
    if (isInvuln(g, p)) return { dealt: 0, how: 'roll' };
    const gd = opts.blockable === false ? null : guardResult(g, p, src, dmg);
    if (gd) {
      applyGuard(g, p, src, gd, dmg);
      if (gd.perfect) return { dealt: 0, how: 'perfect' };
      how = gd.broke ? 'broke' : 'shield'; if (!gd.broke) dmg = gd.dmg;
    }
    dmg = reduceDamage(dmg, p.armor, toughBonus(g, p));
  }
  dmg = Math.max(1, dmg);
  g.makeNoise(p.x, p.y, p.z, 9);
  p.hp = Math.max(0, p.hp - dmg); p.lastHurt = g.time; g.touch(p);
  g.emit(p.uid, { t: 'hurt', hp: p.hp, by: src ? src.id : null });
  if (p.hp <= 0) {
    p.dead = true; p.respawnAt = g.time + 3; p.dig = null; p.guardSince = null; p.drawSince = null; clearFx(g, p);
    ach.bump(g, p, 'die');
    g.emit(null, { t: 'died', uid: p.uid, name: p.name });
    g.onPlayerDeath?.(p);
  }
  return { dealt: dmg, how };
}

export function dropLoot(g, e) {
  const d = (e.kind === 'boss' ? g.bossDef?.(e) : MOBS[e.type]);
  if (!d) return;
  for (const l of d.drops || []) {
    if (l.unsheared && e.shearCd > 0) continue;                         // cừu đã cắt len thì không rơi len
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

// Đánh cận chiến theo lớp vũ khí (xem sim/rules.js WEAPON_CLS): hồi chiêu, tầm, thể lực, chuỗi kiếm, quét rìu, choáng chùy, đòn rơi.
// Sát thương = floor(dmg x hệ số lớp/đòn), x1,5 nếu đang rơi (floor), rồi Sức mạnh x1,25 làm tròn lên ở bước cuối, tối thiểu 1.
export function actHit(g, p, a) {
  const e = g.ents.get(a.id);
  if (!e || (e.kind !== 'mob' && e.kind !== 'boss')) return { ok: false, reason: 'no-target' };
  if (isStunned(g, p)) return { ok: false, reason: 'stun' };
  if (p.guardSince !== null) return { ok: false, reason: 'guard' };
  if (isRolling(g, p) || p.drawSince !== null) return { ok: false, reason: 'busy' };
  if (p.exh) return { ok: false, reason: 'tired' };
  if (g.time < p.attackAt) return { ok: false, reason: 'cooldown' };
  const h = g.held(p), w = R.weaponOf(h);
  const d = Math.hypot(e.x - p.x, (e.y + e.h / 2) - (p.y + 1.62), e.z - p.z) - e.w / 2;
  if (d > w.reach) return { ok: false, reason: 'reach' };
  if (!spendStamina(g, p, w.cost)) return { ok: false, reason: 'tired' };
  let mul = 1, third = false;
  if (w.cls === 'sword') {
    if (g.time - p.combo.at > R.COMBO_WINDOW) p.combo.n = 0;
    mul = R.COMBO_MULS[p.combo.n]; third = p.combo.n === 2;
  } else if (w.cls === 'club') mul = R.CLUB_MUL;
  const crit = !onGround(g, p) && p.fallVy < R.FALL_VY;
  let dmg = Math.max(1, Math.floor((h && h.dmg ? h.dmg : HAND_DAMAGE) * mul + 1e-9));
  if (crit) dmg = Math.floor(dmg * R.FALL_MUL + 1e-9);
  dmg = Math.max(1, Math.ceil(dmg * powerMul(g, p) - 1e-9));
  p.attackAt = g.time + w.cd;
  if (w.cls === 'sword') {
    if (third) { p.combo.n = 0; p.attackAt = g.time + R.COMBO_END_CD; } else { p.combo.n++; p.combo.at = g.time; }
  }
  if (g.hunger) exert(p, 2);                                             // đánh nhau tốn sức: nhanh đói hơn
  g.makeNoise(p.x, p.y, p.z, 12);                                        // đánh nhau gây tiếng động
  g.damageEntity(e, dmg, p);
  if (g.ents.has(e.id) && e.kind === 'mob') {
    if (third && e.kbT > 0) { e.kbx *= 2; e.kbz *= 2; }                  // đòn 3 của kiếm hất lùi gấp đôi
    if (w.cls === 'spear') e.kbT = 0;                                    // giáo chọc thẳng, không đẩy lùi
    if (w.cls === 'club' && g.time >= (e.stunImmuneUntil || 0)) { e.stunUntil = g.time + R.CLUB_STUN; e.stunImmuneUntil = e.stunUntil + R.STUN_IMMUNE; e.windup = null; }
  }
  if (w.cls === 'axe') {                                                 // quét: tối đa 2 mục tiêu phụ quanh mục tiêu chính, mỗi mục tiêu nhận 70%
    const near = [...g.ents.values()].filter(o => o !== e && (o.kind === 'mob' || o.kind === 'boss') && !o.tamed && o.hp > 0 && Math.abs(o.y - e.y) < 3 && Math.hypot(o.x - e.x, o.z - e.z) <= R.SWEEP_RADIUS)
      .sort((x, y) => Math.hypot(x.x - e.x, x.z - e.z) - Math.hypot(y.x - e.x, y.z - e.z)).slice(0, R.SWEEP_MAX);
    for (const o of near) g.damageEntity(o, Math.max(1, Math.floor(dmg * R.SWEEP_MUL + 1e-9)), p);
  }
  if (crit) g.emit(null, { t: 'crit', id: e.id });
  return { ok: true, dmg, crit };
}

export function actUse(g, p) {
  return eat(g, p);
}

export function actRespawn(g, p) {
  if (!p.dead) return { ok: false, reason: 'alive' };
  if (g.time < p.respawnAt) return { ok: false, reason: 'too-soon' };
  p.dead = false; p.hp = p.maxHp; p.lastHurt = -99; p.food = FOOD_ON_RESPAWN; p.fat = 0; resetFight(p); g.touch(p);
  const at = g.respawnPoint(p); g.teleportPlayer(p, at.x, at.y, at.z);
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

// Đạn bay theo bước con (tối đa 0,4 block mỗi bước) để không xuyên tường mỏng hay thân quái. Đạn có trọng lực e.g (mũi tên).
// Đạn người chơi (e.pl, owner là uid) chỉ trúng quái/boss và tính kill cho người bắn; đạn quái/bẫy chỉ trúng người chơi.
export function updateProjectiles(g, dt) {
  for (const e of [...g.ents.values()]) {
    if (e.kind !== 'proj') continue;
    const speed = Math.hypot(e.vx, e.vy, e.vz), n = Math.max(1, Math.ceil(speed * dt / 0.4)), h = dt / n;
    for (let i = 0; i < n; i++) {
      if (e.g) e.vy -= e.g * h;
      const sx = e.vx * h, sy = e.vy * h, sz = e.vz * h;
      e.x += sx; e.y += sy; e.z += sz; e.ttl -= h; e.run = (e.run || 0) + Math.hypot(sx, sy, sz);
      if (e.ttl <= 0 || e.run > (e.range || Infinity) || isSolid(g.world.get(e.x, e.y, e.z))) { g.ents.delete(e.id); break; }
      if (e.pl) {
        const m = [...g.ents.values()].find(o => (o.kind === 'mob' || o.kind === 'boss') && !o.tamed && o.hp > 0 && Math.hypot(o.x - e.x, o.z - e.z) <= o.w / 2 + 0.15 && e.y >= o.y - 0.1 && e.y <= o.y + o.h + 0.1);
        if (!m) continue;
        const shooter = g.player(e.owner) || null;
        g.ents.delete(e.id);
        g.damageEntity(m, Math.max(1, Math.floor(e.dmg + 1e-9)), shooter);
        if (g.rng() < R.ARROW_RECOVER) g.dropItem('arrow', 1, e.x, e.y, e.z);          // một phần mũi tên rơi lại tại chỗ
        break;
      }
      let gone = false;
      for (const p of g.players.values()) {
        if (p.dead) continue;
        if (Math.hypot(p.x - e.x, p.z - e.z) < 0.55 && e.y > p.y - 0.1 && e.y < p.y + p.h + 0.1) {
          const r = hurtPlayer(g, p, e.dmg, e, { blockable: e.blockable !== false });
          if (r.how !== 'roll') { g.ents.delete(e.id); gone = true; }                   // lăn xuyên qua thì đạn bay tiếp
          break;
        }
      }
      if (gone) break;
    }
  }
}

export function updatePlayers(g, dt) {
  for (const p of g.players.values()) {
    if (p.dead) continue;
    const rule = !g.hunger ? 'old' : p.food >= FOOD_FAST ? 'fast' : p.food > FOOD_NONE ? 'old' : 'none';
    const after = rule === 'fast' ? REGEN_FAST_AFTER : REGEN_AFTER, every = rule === 'fast' ? REGEN_FAST_EVERY : REGEN_EVERY;
    if (rule !== 'none' && p.hp < p.maxHp && g.time - p.lastHurt > after) {
      p.regenAcc = (p.regenAcc || 0) + dt;
      if (p.regenAcc >= every) { p.regenAcc -= every; p.hp = Math.min(p.maxHp, p.hp + 1); g.touch(p); g.emit(p.uid, { t: 'hurt', hp: p.hp, by: null }); }
    } else p.regenAcc = 0;
  }
}
