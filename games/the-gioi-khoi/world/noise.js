// Nhiễu giá trị có seed. Chỉ dùng phép cộng, trừ, nhân, floor và Math.imul để kết quả giống hệt nhau trên mọi trình duyệt
// (không dùng sin/cos/pow vì các engine có thể làm tròn khác nhau).
export function hash(seed, x, y, z = 0) {
  let h = (seed ^ 0x9e3779b9) | 0;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b); h ^= h >>> 13;
  h = Math.imul(h ^ (y | 0), 0xc2b2ae35); h ^= h >>> 16;
  h = Math.imul(h ^ (z | 0), 0x27d4eb2f); h ^= h >>> 15;
  h = Math.imul(h, 0x165667b1); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export function noise2(seed, x, z) {
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = smooth(x - x0), fz = smooth(z - z0);
  return lerp(lerp(hash(seed, x0, z0), hash(seed, x0 + 1, z0), fx), lerp(hash(seed, x0, z0 + 1), hash(seed, x0 + 1, z0 + 1), fx), fz);
}

export function noise3(seed, x, y, z) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), fx = smooth(x - x0), fy = smooth(y - y0), fz = smooth(z - z0);
  const l = (dy) => lerp(
    lerp(hash(seed, x0, y0 + dy, z0), hash(seed, x0 + 1, y0 + dy, z0), fx),
    lerp(hash(seed, x0, y0 + dy, z0 + 1), hash(seed, x0 + 1, y0 + dy, z0 + 1), fx), fz);
  return lerp(l(0), l(1), fy);
}

// Tổng nhiều tầng nhiễu, chuẩn hoá về khoảng [0, 1).
export function fbm2(seed, x, z, octaves = 4) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(seed + i * 101, x * freq, z * freq);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

export const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
