// Thời tiết toàn thế giới (máy chủ quyết định): trời quang → mưa → có thể thành bão có sét → quang. Vùng lạnh hiện mưa thành tuyết, sa mạc không mưa (chỉ vẽ ở máy khách).
// g.wx = { k: 'clear' | 'rain' | 'storm', left: giây còn lại }. Mưa làm cây trồng lớn nhanh hơn (xem farm.js).
import { B } from '../world/blocks.js';

export const WEATHER = ['clear', 'rain', 'storm'];
export const WX_NAME = { clear: 'Trời quang', rain: 'Mưa', storm: 'Bão' };
export const BOLT_DAMAGE = 5;

export const weatherOf = g => (g.wx ? g.wx.k : 'clear');
export const rainGrowth = g => (weatherOf(g) === 'clear' ? 1 : 1.5);

// Đỉnh đầu có block che trong 24 ô thì không bị mưa/sét.
export function exposed(world, x, y, z) {
  const cx = Math.floor(x), cz = Math.floor(z), top = Math.min(62, Math.floor(y) + 24);
  for (let yy = Math.floor(y + 1.8); yy <= top; yy++) { const id = world.get(cx, yy, cz); if (id !== B.AIR && id !== B.LEAVES) return false; }
  return true;
}

export function setWeather(g, k, secs) {
  if (!WEATHER.includes(k)) return false;
  g.wx = { k, left: Math.max(1, secs || 120) };
  g.boltAt = g.time + 4;
  g.emit(null, { t: 'weather', k });
  return true;
}

function nextWeather(g) {
  const r = g.rng(), cur = weatherOf(g);
  if (cur === 'clear') return r < 0.45 ? ['rain', 90 + g.rng() * 150] : ['clear', 120 + g.rng() * 200];
  if (cur === 'rain' && r < 0.3) return ['storm', 60 + g.rng() * 60];
  return ['clear', 240 + g.rng() * 360];
}

export function weatherTick(g, dt) {
  if (!g.weatherOn) return;
  if (!g.wx) g.wx = { k: 'clear', left: 200 + g.rng() * 200 };
  g.wx.left -= dt;
  if (g.wx.left <= 0) { const [k, s] = nextWeather(g); setWeather(g, k, s); }
  if (g.wx.k !== 'storm' || g.time < (g.boltAt || 0)) return;
  g.boltAt = g.time + 6 + g.rng() * 14;
  const ps = [...g.players.values()].filter(p => !p.dead);
  if (!ps.length) return;
  const p = ps[Math.floor(g.rng() * ps.length)], a = g.rng() * Math.PI * 2, d = 6 + g.rng() * 30;
  const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, y = g.world.surfaceY(Math.floor(x), Math.floor(z));
  g.emit(null, { t: 'bolt', x, y, z });
  for (const q of ps) if (Math.hypot(q.x - x, q.z - z) < 2.5 && exposed(g.world, q.x, q.y, q.z)) { g.hurtPlayer(q, BOLT_DAMAGE, null, { pure: true }); g.emit(q.uid, { t: 'toast', text: 'Sét đánh trúng bạn!' }); }
  g.makeNoise(x, y, z, 30);
}
