// Trang bị: 4 ô (đầu, thân, chân, giày). Mỗi món có điểm giáp (giảm 4% sát thương mỗi điểm, tối đa 75%) và có thể chống một loại
// môi trường (heat | cold | toxic). Hàm thuần, dùng cả ở host lẫn giao diện.
import { ITEMS } from '../content/items.js';

export const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet'];
export const emptyArmor = () => ({ head: null, chest: null, legs: null, feet: null });
export const REDUCE_PER_DEF = 0.04, MAX_REDUCE = 0.75;

export function armorStats(armor) {
  const out = { def: 0, resist: { heat: 0, cold: 0, toxic: 0 }, fireproof: false, reduce: 0 };
  for (const slot of ARMOR_SLOTS) {
    const it = armor && armor[slot] && ITEMS[armor[slot]];
    if (!it || !it.armor) continue;
    out.def += it.armor.def;
    if (it.armor.resist) out.resist[it.armor.resist]++;
    if (it.armor.fireproof) out.fireproof = true;
  }
  out.reduce = Math.min(MAX_REDUCE, out.def * REDUCE_PER_DEF);
  return out;
}

// Sát thương sau khi giáp giảm; luôn còn ít nhất 1.
export const reduceDamage = (dmg, armor) => Math.max(1, Math.round(dmg * (1 - armorStats(armor).reduce)));

// Mặc món ở ô kho i; món đang mặc (nếu có) về chính ô đó.
export function equip(p, i) {
  const s = Number.isInteger(i) ? p.inv[i] : null, it = s && ITEMS[s.id];
  if (!it || !it.armor) return { ok: false, reason: 'not-armor' };
  const old = p.armor[it.armor.slot];
  p.armor[it.armor.slot] = s.id;
  p.inv[i] = old ? { id: old, n: 1 } : null;
  return { ok: true };
}
