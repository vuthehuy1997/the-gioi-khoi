// Cấu hình chất lượng: tầm nhìn, mây, độ phân giải. Hàm thuần để test; game.js áp dụng.
export const PRESETS = {
  low: { name: 'Thấp', radius: 3, clouds: false, pixelRatio: 0.75, particles: 0.4 },
  medium: { name: 'Vừa', radius: 5, clouds: true, pixelRatio: 1, particles: 0.7 },
  high: { name: 'Cao', radius: 8, clouds: true, pixelRatio: 1.5, particles: 1 },
};
export const presetOf = key => PRESETS[key] || PRESETS.medium;

// Mặc định theo máy: máy yếu -> Thấp, còn lại -> Vừa. "Cao" luôn do người chơi chọn (không đoán được GPU từ số nhân CPU).
export function defaultPreset({ cores = 4, memory = 4 } = {}) {
  return cores <= 2 || memory <= 2 ? 'low' : 'medium';
}
