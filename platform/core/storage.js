// Lưu trữ trong trình duyệt (localStorage) và mã lưu để chuyển sang máy khác.
// Mỗi game tự chọn một khoá riêng, ví dụ 'ten-game-v1'.

export function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}
export function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
// Mã lưu dạng 'TAG:base64'. TAG giúp nhận ra mã của game nào, đời nào.
export function encodeSave(tag, data) { return tag + ':' + btoa(unescape(encodeURIComponent(JSON.stringify(data)))); }
export function decodeSave(tag, code) {
  const s = String(code).trim();
  if (!s.startsWith(tag + ':') || !/^[A-Za-z0-9+/=]+$/.test(s.slice(tag.length + 1))) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(s.slice(tag.length + 1))))); } catch (e) { return null; }
}
