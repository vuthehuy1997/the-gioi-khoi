// Chiến đấu có chiều sâu: thể lực, lăn né, giơ khiên (chặn, đỡ hoàn hảo, vỡ khiên), kéo cung và bắn. Chỉ host chạy; khách chỉ gửi ý định qua act.
// Mọi thời điểm/lực lấy từ đồng hồ host (g.time), không đọc trường thời gian hay lực nào do khách gửi.
import { ITEMS } from '../content/items.js';
import { B, isSolid } from '../world/blocks.js';
import { removeItem, canFit, addItem } from './inventory.js';
import { powerMul } from './hunger.js';
import * as R from './rules.js';

// Trạng thái chiến đấu của người chơi (không lưu, trừ offhand): về mặc định khi vào game, hồi sinh, nạp save.
export function resetFight(p) {
  p.stamina = R.STAMINA_MAX; p.maxStamina = R.STAMINA_MAX; p.staAt = 0; p.exh = false; p.exhUntil = 0;
  p.rollAt = -99; p.rollCdAt = 0; p.guardSince = null; p.guardLast = -99; p.drawSince = null; p.shotAt = -99; p.stunUntil = 0;
  p.combo = { n: 0, at: -99 }; p.fallVy = 0;
}

const heldDef = (g, p) => g.held(p);
const isFood = it => !!(it && (it.food > 0 || it.heal > 0));
export const hasShield = p => !!(p.offhand && ITEMS[p.offhand] && ITEMS[p.offhand].shield);
// Ô dưới chân có đỡ được không (host không có onGround của client).
export const onGround = (g, p) => { const b = g.world.get(p.x, p.y - 0.15, p.z); return isSolid(b) || b === B.WATER; };
export const isRolling = (g, p) => g.time - p.rollAt < R.ROLL_TIME;
export const isStunned = (g, p) => g.time < p.stunUntil;
export const isInvuln = (g, p) => { const t = g.time - p.rollAt; return t >= R.IFRAME_FROM && t <= R.IFRAME_TO; };

// 0 rảnh, 1 giơ khiên, 2 kéo cung, 3 lăn, 4 choáng/kiệt sức (ưu tiên: lăn > choáng > kéo > giơ).
export function actCodeOf(g, p) {
  if (isRolling(g, p)) return 3;
  if (isStunned(g, p) || p.exh) return 4;
  if (p.drawSince !== null) return 2;
  if (p.guardSince !== null) return 1;
  return 0;
}

export function enterExhaust(g, p) {
  p.stamina = 0; p.exh = true; p.exhUntil = g.time + R.EXHAUST_SECS; p.drawSince = null;
  g.emit(p.uid, { t: 'exhausted' });
}

// Trừ thể lực cho một hành động; false (không đổi gì) nếu đang kiệt sức hoặc không đủ.
export function spendStamina(g, p, n) {
  if (p.exh || p.stamina < n - 1e-9) return false;
  p.stamina = Math.max(0, p.stamina - n); p.staAt = g.time + R.STAMINA_REGEN_DELAY;
  if (p.stamina <= 0) enterExhaust(g, p);
  return true;
}

export function stunPlayer(g, p, secs) {
  p.stunUntil = Math.max(p.stunUntil, g.time + secs); p.guardSince = null; p.drawSince = null; p.dig = null;
}

// Mỗi tick: tiêu thể lực khi chạy nước rút thật, hồi sau khoảng nghỉ, kết thúc kiệt sức; dọn trạng thái không còn hợp lệ.
export function fightTick(g, dt) {
  for (const p of g.players.values()) {
    if (p.dead) continue;
    if (p.sprint && Math.hypot(p.vx || 0, p.vz || 0) > 1) {
      p.stamina = Math.max(0, p.stamina - R.SPRINT_COST * dt); p.staAt = g.time + R.STAMINA_REGEN_DELAY;
      if (p.stamina <= 0 && !p.exh) enterExhaust(g, p);
    } else if (g.time >= p.staAt && p.stamina < p.maxStamina) {
      const slow = p.guardSince !== null || !onGround(g, p);
      p.stamina = Math.min(p.maxStamina, p.stamina + R.STAMINA_REGEN * dt * (slow ? R.STAMINA_AIR_MUL : 1));
    }
    if (p.exh && g.time >= p.exhUntil && p.stamina >= R.EXHAUST_EXIT) p.exh = false;
    const h = heldDef(g, p);
    if (p.guardSince !== null && (!hasShield(p) || isFood(h) || isStunned(g, p))) p.guardSince = null;      // mất khiên, cầm đồ ăn hoặc choáng: hạ khiên
    if (p.drawSince !== null && !(h && h.bow)) p.drawSince = null;
  }
}

// Đổi vật cầm: chuỗi kiếm về 0, huỷ kéo cung nếu không còn cầm cung.
export function afterHeldChange(g, p) {
  p.combo.n = 0; const h = heldDef(g, p);
  if (!(h && h.bow)) p.drawSince = null;
  if (isFood(h)) p.guardSince = null;
}

const finite = v => typeof v === 'number' && Number.isFinite(v);

export function actRoll(g, p, a) {
  if ((a.dx !== undefined && !finite(a.dx)) || (a.dz !== undefined && !finite(a.dz))) return { ok: false, reason: 'bad-args' };
  if (isStunned(g, p)) return { ok: false, reason: 'stun' };
  if (p.exh) return { ok: false, reason: 'tired' };
  if (p.drawSince !== null && g.time - p.drawSince > R.ROLL_DRAW_MAX) return { ok: false, reason: 'busy' };
  if (g.time < p.rollCdAt) return { ok: false, reason: 'cooldown' };
  if (!spendStamina(g, p, R.ROLL_COST)) return { ok: false, reason: 'tired' };
  const lag = g.hostUid != null && p.uid !== g.hostUid ? R.LAG_COMP : 0;                    // khách chịu nửa vòng mạng: bù để cửa sổ né không hụt
  p.rollAt = g.time - lag; p.rollCdAt = g.time + R.ROLL_CD; p.guardSince = null; p.drawSince = null; p.dig = null;
  g.emit(null, { t: 'roll', uid: p.uid });
  return { ok: true };
}

export function actGuard(g, p, a) {
  if (typeof a.on !== 'boolean') return { ok: false, reason: 'bad-args' };
  if (!a.on) { p.guardSince = null; return { ok: true }; }
  if (!hasShield(p)) return { ok: false, reason: 'no-shield' };
  if (isFood(heldDef(g, p))) return { ok: false, reason: 'food' };
  if (isStunned(g, p)) return { ok: false, reason: 'stun' };
  if (isRolling(g, p)) return { ok: false, reason: 'busy' };
  if (p.guardSince !== null) return { ok: true };
  // cửa sổ đỡ hoàn hảo chỉ cấp khi cách lần giơ trước đủ PARRY_GAP; chưa đủ thì vẫn giơ nhưng cửa sổ coi như đã hết
  p.guardSince = g.time - p.guardLast >= R.PARRY_GAP ? g.time : g.time - R.PARRY_WINDOW - 0.001;
  p.guardLast = g.time; p.drawSince = null;
  return { ok: true };
}

// Chặn đòn: null nếu không chặn; { perfect } khi đỡ hoàn hảo; { dmg, cost, broke } khi chặn thường hoặc vỡ khiên.
export function guardResult(g, p, src, dmg) {
  if (p.guardSince === null || !hasShield(p) || !finite(src.x) || !finite(src.z)) return null;
  const dx = src.x - p.x, dz = src.z - p.z, d = Math.hypot(dx, dz);
  if (d > 0.05) {                                                                            // gần như trùng vị trí thì coi là phía trước
    const fx = -Math.sin(p.yaw || 0), fz = -Math.cos(p.yaw || 0);
    if ((dx * fx + dz * fz) / d < Math.cos(R.GUARD_ARC) - 1e-9) return null;
  }
  if (g.time - p.guardSince <= R.PARRY_WINDOW) return { perfect: true };
  const sh = ITEMS[p.offhand].shield, cost = Math.ceil(dmg * sh.costMul - 1e-9);
  if (p.exh || p.stamina < cost) return { dmg, cost, broke: true };
  return { dmg: Math.ceil(dmg * (1 - sh.reduce) - 1e-9), cost, broke: false };
}

// Áp hậu quả của một cú đỡ lên người chơi (đã quyết định ở guardResult).
export function applyGuard(g, p, src, gd, dmg) {
  if (gd.perfect) {
    if (src.kind === 'mob') { src.stunUntil = g.time + R.PARRY_STUN; src.windup = null; }          // boss miễn choáng
    g.emit(null, { t: 'parry', id: src.id ?? null });
    g.emit(p.uid, { t: 'shield', perfect: true, broke: false, dmg: 0 });
    return;
  }
  if (gd.broke) {
    p.guardSince = null; stunPlayer(g, p, R.SHIELD_BREAK_STUN); enterExhaust(g, p);
    g.emit(p.uid, { t: 'shield', perfect: false, broke: true, dmg });
    return;
  }
  p.stamina = Math.max(0, p.stamina - gd.cost); p.staAt = g.time + R.STAMINA_REGEN_DELAY;
  if (p.stamina <= 0) enterExhaust(g, p);
  g.emit(p.uid, { t: 'shield', perfect: false, broke: false, dmg: gd.dmg });
}

export function actDraw(g, p, a) {
  if (typeof a.on !== 'boolean') return { ok: false, reason: 'bad-args' };
  if (!a.on) { p.drawSince = null; return { ok: true }; }
  const h = heldDef(g, p);
  if (!(h && h.bow)) return { ok: false, reason: 'no-bow' };
  if (isStunned(g, p)) return { ok: false, reason: 'stun' };
  if (p.exh) return { ok: false, reason: 'tired' };
  if (p.guardSince !== null || isRolling(g, p)) return { ok: false, reason: 'busy' };
  if (p.drawSince === null) p.drawSince = g.time;                                           // lực kéo do đồng hồ host đo, không nhận từ khách
  return { ok: true };
}

export function spawnArrow(g, p, bow, force, yaw, pitch) {
  const L = R.bowLerp(bow, force), cp = Math.cos(pitch);
  const dir = { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
  const dmg = Math.round(L.dmg * powerMul(g, p) * 100) / 100;
  const e = { id: g.nextId++, kind: 'proj', x: p.x + dir.x * R.ARROW_AHEAD, y: p.y + R.ARROW_EYE + dir.y * R.ARROW_AHEAD, z: p.z + dir.z * R.ARROW_AHEAD,
    vx: dir.x * L.speed, vy: dir.y * L.speed, vz: dir.z * L.speed, dmg, owner: p.uid, pl: true, g: R.ARROW_G, ttl: R.ARROW_TTL, range: R.ARROW_RANGE, run: 0, w: 0, h: 0, style: 'arrow' };
  g.ents.set(e.id, e);
  return e;
}

export function actShoot(g, p, a) {
  const h = heldDef(g, p);
  if (!(h && h.bow)) return { ok: false, reason: 'no-bow' };
  if (p.drawSince === null) return { ok: false, reason: 'not-drawn' };
  const held = g.time - p.drawSince;
  if (g.time - p.shotAt < R.BOW_CD) return { ok: false, reason: 'cooldown' };
  p.drawSince = null;
  if (held < R.BOW_MIN_DRAW) return { ok: false, reason: 'weak' };
  if (isStunned(g, p)) return { ok: false, reason: 'stun' };
  if (!removeItemCheck(p, 'arrow')) { g.emit(p.uid, { t: 'toast', text: 'Hết mũi tên!' }); return { ok: false, reason: 'no-ammo' }; }
  if (!spendStamina(g, p, R.BOW_COST)) return { ok: false, reason: 'tired' };
  removeItem(p.inv, 'arrow', 1); g.touch(p);
  p.shotAt = g.time;
  const yaw = finite(a.yaw) ? a.yaw : p.yaw || 0, pitch = finite(a.pitch) ? Math.max(-1.55, Math.min(1.55, a.pitch)) : p.pitch || 0;
  spawnArrow(g, p, h.bow, R.drawForce(h.bow, held), yaw, pitch);
  g.makeNoise(p.x, p.y, p.z, R.ARROW_NOISE);
  g.emit(null, { t: 'snd', n: 'bowshot', x: p.x, z: p.z });
  return { ok: true };
}
const removeItemCheck = (p, id) => p.inv.some(s => s && s.id === id);

// Mặc/cởi khiên ở ô tay phụ (xem Game.act 'equip' / 'unequip'): đổi chỗ với món cũ, không nhân bản.
export function equipOffhand(p, i) {
  const s = Number.isInteger(i) ? p.inv[i] : null, it = s && ITEMS[s.id];
  if (!it || !it.shield) return { ok: false, reason: 'not-armor' };
  const old = p.offhand;
  p.offhand = s.id; p.inv[i] = old ? { id: old, n: 1 } : null;
  return { ok: true };
}
export function unequipOffhand(p) {
  if (!p.offhand) return { ok: false, reason: 'empty' };
  if (!canFit(p.inv, p.offhand, 1)) return { ok: false, reason: 'full' };
  addItem(p.inv, p.offhand, 1); p.offhand = null; p.guardSince = null;
  return { ok: true };
}
