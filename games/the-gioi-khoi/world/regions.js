// Khí hậu liên tục (0..1) quyết định vùng nền; chiều cao địa hình pha trộn mượt theo khí hậu nên không có vách đột ngột giữa các vùng.
// Thêm nhiễu `zone` (độc lập) để các vùng phủ (đầm lầy, núi lửa, vực pha lê) mọc thành mảng bên trong vùng nền của chúng.
import { fbm2 } from './noise.js';
import { REGIONS } from '../content/regions.js';

export const climate = (seed, x, z) => {
  const c = 0.5 + (fbm2(seed + 9001, x * 0.0045, z * 0.0045, 2) - 0.5) * 2.6;
  return c < 0 ? 0 : c > 1 ? 1 : c;
};
export const zone = (seed, x, z) => fbm2(seed + 4242, x * 0.0062, z * 0.0062, 3);

const BASE = REGIONS.filter(r => r.climate), OVERLAYS = REGIONS.filter(r => r.within);
export const baseRegion = (c) => BASE.find(r => c >= r.climate[0] && c < r.climate[1]) || REGIONS[1];
// w (nhiễu zone) tuỳ chọn: bỏ qua thì chỉ trả vùng nền.
export const regionOf = (c, w = 0) => { const b = baseRegion(c); return OVERLAYS.find(r => r.within === b.id && w > r.zone) || b; };
export const regionAt = (seed, x, z) => regionOf(climate(seed, x, z), zone(seed, x, z)).id;
export const regionById = (id) => REGIONS.find(r => r.id === id);
