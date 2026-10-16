// Kho đồ: mảng 36 ô, mỗi ô null hoặc { id, n }. 9 ô đầu là thanh nhanh. Hàm thuần trên mảng.
import { ITEMS } from '../content/items.js';

export const SLOTS = 36, HOTBAR = 9;
export const makeInventory = () => new Array(SLOTS).fill(null);

const stackOf = id => { const d = ITEMS[id]; if (!d) throw new Error('vật phẩm không tồn tại: ' + id); return d.stack; };

// Thêm n vật phẩm; trả số lượng không nhét vừa.
export function addItem(inv, id, n) {
  const max = stackOf(id);
  for (let i = 0; i < inv.length && n > 0; i++) {
    const s = inv[i];
    if (s && s.id === id && s.n < max) { const t = Math.min(n, max - s.n); s.n += t; n -= t; }
  }
  for (let i = 0; i < inv.length && n > 0; i++) {
    if (!inv[i]) { const t = Math.min(n, max); inv[i] = { id, n: t }; n -= t; }
  }
  return n;
}

export const countItem = (inv, id) => inv.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);

// Bớt n vật phẩm. Trả false (và không đổi gì) nếu không đủ.
export function removeItem(inv, id, n) {
  if (countItem(inv, id) < n) return false;
  for (let i = inv.length - 1; i >= 0 && n > 0; i--) {
    const s = inv[i];
    if (s && s.id === id) { const t = Math.min(n, s.n); s.n -= t; n -= t; if (!s.n) inv[i] = null; }
  }
  return true;
}

// Có thể nhét được n vật phẩm này (không đổi kho).
export function canFit(inv, id, n) { const c = inv.map(s => s && { ...s }); return addItem(c, id, n) === 0; }
