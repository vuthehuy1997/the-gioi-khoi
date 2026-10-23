// Quy tắc dùng chung giữa host (xác nhận) và giao diện (dự đoán thời gian đào, kiểm tra chế tạo).
import { BLOCKS, B } from '../world/blocks.js';
import { ITEMS } from '../content/items.js';

// Giây đào block `blockId` bằng vật phẩm `heldId` (hoặc tay không).
export function breakTimeFor(blockId, heldId) {
  const def = BLOCKS[blockId];
  if (!def || def.hardness < 0) return Infinity;
  const h = heldId ? ITEMS[heldId] : null;
  const speed = h && h.tool && h.tool.type === def.tool ? h.tool.speed : 1;
  return def.hardness / speed;
}

export function canHarvest(blockId, heldId) {
  const def = BLOCKS[blockId], h = heldId ? ITEMS[heldId] : null;
  return def.tier === 0 || !!(h && h.tool && h.tool.type === def.tool && h.tool.tier >= def.tier);
}

// Có bàn chế tạo trong vòng 4 block ngang, ±2 dọc quanh vị trí (x, y, z).
export function nearBench(world, x, y, z) {
  for (let dy = -2; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    if (world.get(Math.floor(x) + dx, Math.floor(y) + dy, Math.floor(z) + dz) === B.WORKBENCH) return true;
  }
  return false;
}

// Các trạm chế tạo trong vòng 4 block ngang, ±2 dọc: { workbench, furnace, anvil }.
export function nearStations(world, x, y, z) {
  const out = { workbench: false, furnace: false, anvil: false };
  for (let dy = -2; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const id = world.get(Math.floor(x) + dx, Math.floor(y) + dy, Math.floor(z) + dz);
    if (id === B.WORKBENCH) out.workbench = true; else if (id === B.FURNACE) out.furnace = true; else if (id === B.ANVIL) out.anvil = true;
  }
  return out;
}

// ---- Chiến đấu có chiều sâu (dùng chung host, giao diện và dữ liệu) ----
// Thể lực: tối đa, hồi mỗi giây, trễ trước khi hồi, hệ số hồi khi trên không hoặc đang giơ khiên.
export const STAMINA_MAX = 100, STAMINA_REGEN = 25, STAMINA_REGEN_DELAY = 1.0, STAMINA_AIR_MUL = 0.4;
export const SPRINT_COST = 8, ROLL_COST = 25, BOW_COST = 10, EXHAUST_SECS = 2.0, EXHAUST_EXIT = 20;
// Lăn: thời gian, quãng đường, hồi chiêu, cửa sổ bất khả xâm phạm; LAG_COMP: bù độ trễ mạng cho khách (R-16).
export const ROLL_TIME = 0.45, ROLL_DIST = 3.5, ROLL_CD = 0.8, IFRAME_FROM = 0.05, IFRAME_TO = 0.35, LAG_COMP = 0.08, ROLL_DRAW_MAX = 0.3;
export const COMBO_WINDOW = 0.8, COMBO_END_CD = 0.8, FALL_VY = -2, FALL_MUL = 1.5, SWEEP_RADIUS = 2.5, SWEEP_MAX = 2, SWEEP_MUL = 0.7, CLUB_MUL = 1.3;
export const CLUB_STUN = 1.0, STUN_IMMUNE = 3.0, COMBO_MULS = [1, 1, 1.5];
// Khiên: cửa sổ đỡ hoàn hảo, khoảng cách tối thiểu giữa hai lần giơ, choáng quái/người chơi, cung chặn (±60 độ), hệ số tốc độ.
export const PARRY_WINDOW = 0.25, PARRY_GAP = 0.5, PARRY_STUN = 0.8, SHIELD_BREAK_STUN = 1.0, GUARD_ARC = Math.PI / 3, SLOW_MUL = 0.6;
// Cung: kéo tối thiểu, hồi chiêu, trọng lực, tầm, thời sống, xác suất nhặt lại, bán kính tiếng động.
export const BOW_MIN_DRAW = 0.2, BOW_CD = 0.4, ARROW_G = 9, ARROW_RANGE = 40, ARROW_TTL = 4, ARROW_RECOVER = 0.3, ARROW_NOISE = 10, ARROW_EYE = 1.62, ARROW_AHEAD = 0.5;
// Báo hiệu đòn quái: thời gian vung (nhanh / chậm), ngưỡng hồi chiêu để tính là chậm, dung sai tầm khi đòn chốt.
export const WINDUP_FAST = 0.35, WINDUP_SLOW = 0.6, WINDUP_SLOW_CD = 1.4, WINDUP_SLACK = 0.4;
// Lớp vũ khí: hồi chiêu (s), thể lực mỗi đòn, tầm.
export const WEAPON_CLS = {
  hand: { cd: 0.5, cost: 4, reach: 4.5 }, sword: { cd: 0.5, cost: 6, reach: 4.5 }, axe: { cd: 0.8, cost: 12, reach: 4.5 },
  club: { cd: 1.0, cost: 15, reach: 4.5 }, spear: { cd: 0.7, cost: 8, reach: 6.0 },
};
// Lớp vũ khí của vật phẩm: khai báo it.weapon (trộn lên mặc định lớp) hoặc suy từ tool.type (kiếm -> sword, rìu -> axe, còn lại tay không).
export function weaponOf(it) {
  const cls = it && it.weapon && it.weapon.cls || (it && it.tool && it.tool.type === 'sword' ? 'sword' : it && it.tool && it.tool.type === 'axe' ? 'axe' : 'hand');
  return { cls, ...(WEAPON_CLS[cls] || WEAPON_CLS.hand), ...(it && it.weapon || {}) };
}
export const reachOf = it => weaponOf(it).reach, cdOf = it => weaponOf(it).cd, costOf = it => weaponOf(it).cost;
// Lực kéo (0..1) -> mức nội suy 0..1 giữa sát thương/tốc độ nhỏ nhất (lực BOW_MIN_DRAW/draw) và lớn nhất (lực 1).
export const drawForce = (bow, secs) => Math.min(1, Math.max(0, secs) / bow.draw);
export function bowLerp(bow, force) {
  const lo = BOW_MIN_DRAW, t = Math.round(Math.min(1, Math.max(0, (force - lo) / (1 - lo))) * 1e6) / 1e6;
  return { dmg: bow.dmgMin + (bow.dmgMax - bow.dmgMin) * t, speed: bow.speedMin + (bow.speedMax - bow.speedMin) * t };
}
