// Đói, ăn, hiệu ứng thức ăn, ngộ độc. Chỉ host chạy (Game.tick); khách chỉ nhận food/fx qua `you`.
// Mọi bộ đếm là bộ tích luỹ nên chịu được dt lớn (R-34); hiệu ứng lưu dạng thời điểm hết hạn tuyệt đối trong RAM (p.fx[id] = g.time + giây còn lại).
import * as ach from './achievements.js';
import { ITEMS } from '../content/items.js';
import { EFFECTS } from '../content/farming.js';
import { removeItem } from './inventory.js';

export const FOOD_MAX = 20, FATIGUE_STEP = 45, EAT_CD = 1.0, FOOD_ON_RESPAWN = 14;
export const STARVE_EVERY = 5, STARVE_MIN_HP = 2, HUNGRY_AT = 6, WARN_EVERY = 60;
export const REGEN_FX_EVERY = 2, POISON_SECS = 6, POISON_EVERY = 2, POWER_MUL = 1.25, TOUGH_ARMOR = 3, FX_MAX_SECS = 300;

// Thêm n điểm "mệt" (đòn trúng quái: 2).
export function exert(p, n) { p.fat = (p.fat || 0) + n; }

export const toughBonus = (g, p) => (p.fx && p.fx.tough > g.time ? TOUGH_ARMOR : 0);
export const powerMul = (g, p) => (p.fx && p.fx.power > g.time ? POWER_MUL : 1);

// Danh sách hiệu ứng gửi cho khách: [{ id, left }] (giây làm tròn lên). Gồm cả ngộ độc.
export function refreshView(g, p) {
  const out = [];
  for (const [id, until] of Object.entries(p.fx || {})) if (until > g.time) out.push({ id, left: Math.ceil(until - g.time - 1e-6) });
  if (p.psn && p.psn.until > g.time) out.push({ id: 'poison', left: Math.ceil(p.psn.until - g.time - 1e-6) });
  p.fxView = out;
}

// Áp hiệu ứng: ăn lại cùng loại thì lấy max(còn lại, thời lượng mới), không cộng dồn. Chỉ touch khi thêm mới hoặc kéo dài.
export function addFx(g, p, id, secs) {
  if (!EFFECTS[id] || id === 'poison') return false;
  p.fx = p.fx || {};
  const until = g.time + secs, had = (p.fx[id] || 0) > g.time;
  if (had && p.fx[id] >= until) return false;
  p.fx[id] = until; if (!had) p.fxAcc = { ...(p.fxAcc || {}), [id]: 0 };
  refreshView(g, p); g.touch(p);
  return true;
}

export function clearFx(g, p) { p.fx = {}; p.psn = null; p.fxAcc = {}; refreshView(g, p); }

export function poison(g, p, secs = POISON_SECS) {
  const until = g.time + secs;
  if (p.psn && p.psn.until > g.time) { p.psn.until = Math.max(p.psn.until, until); }
  else p.psn = { until, next: g.time + POISON_EVERY };
  refreshView(g, p); g.touch(p);
  g.emit(p.uid, { t: 'toast', text: 'Bạn bị ngộ độc!' });
}

// Ăn món đang cầm. Trả { ok } hoặc { ok: false, reason: empty | not-food | cooldown | full }.
export function eat(g, p) {
  const s = p.inv[p.sel];
  if (!s) return { ok: false, reason: 'empty' };
  const it = ITEMS[s.id];
  if (!it || !(it.food > 0 || it.heal > 0)) return { ok: false, reason: 'not-food' };
  if (g.time - (p.eatAt ?? -99) < EAT_CD - 1e-9) return { ok: false, reason: 'cooldown' };
  if (p.hp >= p.maxHp && ((p.food ?? FOOD_MAX) >= FOOD_MAX || !(it.food > 0))) return { ok: false, reason: 'full' };
  p.eatAt = g.time;
  p.hp = Math.min(p.maxHp, p.hp + (it.heal || 0));
  if (it.food) p.food = Math.min(FOOD_MAX, (p.food ?? FOOD_MAX) + it.food);
  removeItem(p.inv, s.id, 1);
  if (it.fx) addFx(g, p, it.fx.id, it.fx.secs);
  if (g.hunger && it.risk && it.risk.poison && g.rng() < it.risk.poison) poison(g, p);       // đồ sống: có thể ngộ độc (chỉ khi bật cơ chế đói)
  g.touch(p);
  g.emit(p.uid, { t: 'hurt', hp: p.hp, by: null });
  g.emit(p.uid, { t: 'snd', n: 'eat' });
  ach.bump(g, p, 'eat');
  return { ok: true };
}

// Mỗi tick: tích luỹ mệt -> giảm đói; chết đói (dừng ở 2 máu); hiệu ứng hồi phục, ngộ độc, hết hạn.
export function hungerTick(g, dt) {
  if (!g.hunger) return;
  for (const p of g.players.values()) {
    if (p.dead) continue;
    // mệt: +1/giây, +2/giây khi chạy nước rút thật sự (vận tốc ngang > 1); đòn trúng quái cộng thêm qua exert()
    const sprint = p.sprint && Math.hypot(p.vx || 0, p.vz || 0) > 1;
    p.fat = (p.fat || 0) + dt * (sprint ? 2 : 1);
    while (p.fat >= FATIGUE_STEP) { p.fat -= FATIGUE_STEP; if (p.food > 0) { p.food--; g.touch(p); } }
    // chết đói: mỗi 5 giây mất 1 máu thuần (không giảm bởi giáp), không xuống dưới 2 máu
    if (p.food <= 0) {
      p.starveAcc = (p.starveAcc || 0) + dt;
      while (p.starveAcc >= STARVE_EVERY) { p.starveAcc -= STARVE_EVERY; if (p.hp > STARVE_MIN_HP) g.hurtPlayer(p, 1, null); }
    } else p.starveAcc = 0;
    if (p.food <= HUNGRY_AT && g.time - (p.hungerWarn ?? -99) >= WARN_EVERY) { p.hungerWarn = g.time; g.emit(p.uid, { t: 'toast', text: 'Bạn đang đói. Hãy ăn gì đó!' }); }
    // hiệu ứng: hồi phục +1 máu/2 giây; hết hạn thì gỡ và báo bằng you
    let changed = false;
    for (const [id, until] of Object.entries(p.fx || {})) {
      if (id === 'regen' && until > g.time - dt) {
        p.fxAcc = p.fxAcc || {}; p.fxAcc.regen = (p.fxAcc.regen || 0) + Math.min(dt, until - (g.time - dt));
        while (p.fxAcc.regen >= REGEN_FX_EVERY - 1e-9) { p.fxAcc.regen -= REGEN_FX_EVERY; if (p.hp < p.maxHp) { p.hp = Math.min(p.maxHp, p.hp + 1); g.touch(p); g.emit(p.uid, { t: 'hurt', hp: p.hp, by: null }); } }
      }
      if (until <= g.time) { delete p.fx[id]; changed = true; }
    }
    // ngộ độc: mỗi 2 giây mất 1 máu thuần, không bao giờ xuống dưới 1 máu (R-25)
    if (p.psn) {
      while (p.psn.next <= Math.min(g.time, p.psn.until) + 1e-9) { p.psn.next += POISON_EVERY; if (p.hp > 1) g.hurtPlayer(p, 1, null); }
      if (p.psn.until <= g.time) { p.psn = null; changed = true; }
    }
    if (changed) { refreshView(g, p); g.touch(p); }
  }
}

// ---- lưu / nạp (R-26: lưu "giây còn lại") ----
export function serializePlayerState(g, p) {
  const fx = {};
  for (const [id, until] of Object.entries(p.fx || {})) if (until > g.time) fx[id] = Math.round((until - g.time) * 10) / 10;
  return { food: p.food, fatigue: Math.round((p.fat || 0) * 100) / 100, fx, poison: p.psn && p.psn.until > g.time ? Math.round((p.psn.until - g.time) * 10) / 10 : 0 };
}

// Làm sạch dữ liệu người chơi từ save/file nhập: kẹp food 0..20, chỉ nhận hiệu ứng biết trước, thời gian 0..300 giây (file hỏng không làm food = NaN).
export function sanitizeSaved(s) {
  const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  const fx = {};
  if (s && s.fx && typeof s.fx === 'object') for (const id of Object.keys(EFFECTS)) if (id !== 'poison' && Object.hasOwn(s.fx, id)) { const v = num(s.fx[id], 0, FX_MAX_SECS, 0); if (v > 0) fx[id] = v; }
  return { food: Math.round(num(s && s.food, 0, FOOD_MAX, FOOD_MAX)), fatigue: num(s && s.fatigue, 0, FATIGUE_STEP, 0), fx, poison: num(s && s.poison, 0, POISON_SECS, 0) };
}

// Nạp trạng thái đói đã làm sạch vào người chơi p (đồng hồ: đổi "giây còn lại" sang thời điểm tuyệt đối).
export function restorePlayerState(g, p, saved) {
  const c = sanitizeSaved(saved);
  p.food = c.food; p.fat = c.fatigue; p.fx = {}; p.fxAcc = {};
  for (const [id, left] of Object.entries(c.fx)) p.fx[id] = g.time + left;
  p.psn = c.poison > 0 ? { until: g.time + c.poison, next: g.time + Math.min(POISON_EVERY, c.poison) } : null;
  refreshView(g, p);
}
