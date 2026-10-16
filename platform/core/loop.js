// Vòng lặp game: mỗi khung hình gọi update(dt) rồi render(). dt tính bằng giây, bị chặn trên để game
// không nhảy cóc khi tab bị treo.
import { pressed } from './input.js';

export function startLoop(update, render, { maxDt = .033 } = {}) {
  let last = performance.now();
  const frame = now => {
    const dt = Math.min(maxDt, (now - last) / 1000); last = now;
    try { update(dt); render(); } catch (err) { console.error(err); }
    pressed.clear();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
