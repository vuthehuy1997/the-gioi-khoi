import { RECIPES } from '../content/recipes.js';
import { addItem, removeItem, countItem, canFit } from './inventory.js';

export { RECIPES };
export const recipeById = id => RECIPES.find(r => r.id === id);

// Trạm cần để chế: 'workbench' | 'furnace' | 'anvil' | null.
export const stationOf = r => r.bench === true ? 'workbench' : r.bench || null;

// near: { workbench, furnace, anvil } (xem rules.nearStations); true cũ nghĩa là đang gần bàn chế tạo.
export function canCraft(inv, id, near) {
  const r = recipeById(id), st = near === true ? { workbench: true } : near || {};
  if (!r || (stationOf(r) && !st[stationOf(r)])) return false;
  return Object.entries(r.in).every(([item, n]) => countItem(inv, item) >= n) && canFit(inv, r.out.item, r.out.n);
}

export function craft(inv, id, near) {
  if (!canCraft(inv, id, near)) return false;
  const r = recipeById(id);
  for (const [item, n] of Object.entries(r.in)) removeItem(inv, item, n);
  addItem(inv, r.out.item, r.out.n);
  return true;
}
