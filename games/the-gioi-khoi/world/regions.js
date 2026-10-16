// Khí hậu liên tục (0..1) quyết định vùng; chiều cao địa hình pha trộn mượt theo khí hậu nên không có vách đột ngột giữa các vùng.
import { fbm2 } from './noise.js';
import { REGIONS } from '../content/regions.js';

export const climate = (seed, x, z) => {
  const c = 0.5 + (fbm2(seed + 9001, x * 0.0045, z * 0.0045, 2) - 0.5) * 2.6;
  return c < 0 ? 0 : c > 1 ? 1 : c;
};

export const regionOf = (c) => REGIONS.find(r => c >= r.climate[0] && c < r.climate[1]) || REGIONS[1];
export const regionAt = (seed, x, z) => regionOf(climate(seed, x, z)).id;
export const regionById = (id) => REGIONS.find(r => r.id === id);
