// Cấu hình chất lượng: tầm nhìn, mây, độ phân giải. Hàm thuần để test; game.js áp dụng.
export const PRESETS = {
  low: { name: 'Thấp', radius: 3, clouds: false, pixelRatio: 0.75, particles: 0.4 },
  medium: { name: 'Vừa', radius: 5, clouds: true, pixelRatio: 1, particles: 0.7 },
  high: { name: 'Cao', radius: 8, clouds: true, pixelRatio: 1.5, particles: 1 },
};
export const presetOf = key => PRESETS[key] || PRESETS.medium;

// Chọn mức mặc định theo máy: nhiều nhân + màn hình thường -> Vừa/Cao, máy yếu -> Thấp.
export function defaultPreset({ cores = 4, dpr = 1, memory = 4 } = {}) {
  if (cores <= 2 || memory <= 2) return 'low';
  if (cores >= 8 && memory >= 8) return 'high';
  return 'medium';
}
