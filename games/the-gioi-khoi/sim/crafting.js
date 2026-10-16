import { RECIPES } from '../content/recipes.js';
import { addItem, removeItem, countItem, canFit } from './inventory.js';

export { RECIPES };
export const recipeById = id => RECIPES.find(r => r.id === id);

export function canCraft(inv, id, nearBench) {
  const r = recipeById(id);
  if (!r || (r.bench && !nearBench)) return false;
  return Object.entries(r.in).every(([item, n]) => countItem(inv, item) >= n) && canFit(inv, r.out.item, r.out.n);
}

export function craft(inv, id, nearBench) {
  if (!canCraft(inv, id, nearBench)) return false;
  const r = recipeById(id);
  for (const [item, n] of Object.entries(r.in)) removeItem(inv, item, n);
  addItem(inv, r.out.item, r.out.n);
  return true;
}
