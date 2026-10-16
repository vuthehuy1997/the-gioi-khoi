// Bàn phím và nút cảm ứng. held = đang giữ, pressed = vừa bấm trong khung hình này
// (vòng lặp ở loop.js tự xoá pressed sau mỗi khung hình).
import { SETTINGS } from './settings.js';
import { ac } from './audio.js';

export const held = new Set(), pressed = new Set();
const SCROLL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// keymap: { KeyA: 'left', Space: 'jump', ... } đổi mã phím thành tên hành động của game.
// onPress(action, event): gọi một lần khi vừa bấm (không gọi khi giữ phím).
// keepDefault(event): trả về true thì để trình duyệt xử lý phím cuộn như thường (ví dụ đang đứng trên nút trong menu).
export function bindKeys(keymap, { onPress, keepDefault } = {}) {
  addEventListener('keydown', e => {
    const k = keymap[e.code]; if (!k) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return; // đang gõ trong ô nhập
    if (SCROLL_KEYS.includes(e.code) && !(keepDefault && keepDefault(e))) e.preventDefault();
    if (!e.repeat) pressed.add(k);
    held.add(k);
    if (!e.repeat && onPress) onPress(k, e);
  });
  addEventListener('keyup', e => { const k = keymap[e.code]; if (k) held.delete(k); });
  addEventListener('blur', () => held.clear());
}

let touchSeen = matchMedia('(pointer:coarse)').matches;
// Có nên hiện nút cảm ứng không, theo cài đặt chung (tự động / luôn bật / tắt)
export const touchWanted = () => SETTINGS.touch === 'on' || (SETTINGS.touch === 'auto' && touchSeen);

// el chứa các <button data-k="tên hành động">. Thêm lớp 'on' cho el khi cần hiện, lớp 'act' cho nút đang giữ.
// Trả về hàm áp dụng lại cài đặt hiển thị (gọi sau khi người chơi đổi cài đặt).
export function bindTouch(el, { onPress } = {}) {
  el.querySelectorAll('button').forEach(b => {
    const k = b.dataset.k;
    const down = e => {
      e.preventDefault(); if (b.setPointerCapture) b.setPointerCapture(e.pointerId);
      held.add(k); pressed.add(k); b.classList.add('act'); ac();
      if (onPress) onPress(k, e);
    };
    const up = () => { held.delete(k); b.classList.remove('act'); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  });
  const apply = () => el.classList.toggle('on', touchWanted());
  addEventListener('touchstart', () => { touchSeen = true; apply(); }, { once: true, passive: true });
  apply();
  return apply;
}
