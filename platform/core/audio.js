// Âm thanh tổng hợp bằng Web Audio: không cần file âm thanh. Âm lượng lấy từ cài đặt chung.
import { SETTINGS } from './settings.js';

let AC = null;
// Trình duyệt chỉ cho phát tiếng sau khi người chơi bấm: gọi ac() trong sự kiện bấm đầu tiên.
export function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
// Một nốt: f = tần số, dur = giây, slide = trượt tần số, at = thời điểm phát, ch = 'sfx' hoặc 'music'
export function tone(f, dur, type = 'square', vol = .06, slide = 0, at = 0, ch = 'sfx') {
  vol *= (ch === 'music' ? SETTINGS.music : SETTINGS.sfx) / 100;
  if (vol <= 0) return; const a = ac(); if (!a) return;
  const t = (at || a.currentTime), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, f + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
}
// Tiếng ồn lọc dải: va chạm, gió, nổ
export function noise(dur, vol = .08, freq = 1200) {
  vol *= SETTINGS.sfx / 100;
  if (vol <= 0) return; const a = ac(); if (!a) return;
  const len = (a.sampleRate * dur) | 0, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
  s.buffer = buf; s.connect(f).connect(g).connect(a.destination); s.start();
}
// Nhạc nền theo bước: playStep(step, t) phát các nốt của bước thứ `step` tại thời điểm t (dùng tone(..., t, 'music'))
// và trả về độ dài bước tính bằng giây.
export function createMusic(playStep) {
  let timer = null, step = 0, next = 0;
  const tick = () => {
    const a = AC; if (!a) return;
    if (SETTINGS.music <= 0) { next = a.currentTime; return; }
    while (next < a.currentTime + .3) { const t = Math.max(next, a.currentTime); next = t + playStep(step, t); step++; }
  };
  return {
    start() { if (!ac()) return; if (!timer) { next = AC.currentTime + .1; timer = setInterval(tick, 100); } },
    stop() { clearInterval(timer); timer = null; },
  };
}
