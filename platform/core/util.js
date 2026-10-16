// Tiện ích dùng chung cho mọi game: DOM, số ngẫu nhiên, hình chữ nhật va chạm, định dạng.

export const $ = id => document.getElementById(id);
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pick = arr => arr[(Math.random() * arr.length) | 0];
// số giả ngẫu nhiên cố định theo n (dùng để rải cảnh nền không đổi giữa các khung hình)
export const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// hai hình chữ nhật { x, y, w, h } có chạm nhau không
export const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
// Lọc mảng tại chỗ: module khác đang import mảng này vẫn thấy cùng một mảng
export function prune(arr, keep) {
  let n = 0;
  for (const v of arr) if (keep(v)) arr[n++] = v;
  arr.length = n;
  return arr;
}
// Thay toàn bộ nội dung mảng tại chỗ
export function refill(arr, items = []) { arr.length = 0; arr.push(...items); return arr; }
