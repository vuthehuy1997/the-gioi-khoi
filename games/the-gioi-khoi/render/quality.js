// Cấu hình chất lượng: các mức (tầm nhìn, độ phân giải, mây, hạt) và bộ điều chỉnh tự động. Hàm thuần để test.
// Mức 0 là nhẹ nhất. Người chơi chọn một mức TỐI ĐA (Thấp/Vừa/Cao); bộ điều chỉnh có thể hạ xuống dưới đó khi máy chậm.
export const LEVELS = [
  { r: 3, pr: 0.5, clouds: false, particles: 0.3 },
  { r: 3, pr: 0.75, clouds: false, particles: 0.4 },
  { r: 4, pr: 0.75, clouds: true, particles: 0.5 },
  { r: 4, pr: 1, clouds: true, particles: 0.7 },
  { r: 5, pr: 1, clouds: true, particles: 0.7 },
  { r: 6, pr: 1, clouds: true, particles: 1 },
  { r: 8, pr: 1.25, clouds: true, particles: 1 },
];
export const PRESETS = {
  low: { name: 'Thấp', level: 1 },
  medium: { name: 'Vừa', level: 4 },
  high: { name: 'Cao', level: 6 },
};
export const presetOf = key => PRESETS[key] || PRESETS.medium;

// Mặc định theo máy: máy yếu -> Thấp, còn lại -> Vừa. "Cao" luôn do người chơi chọn.
export function defaultPreset({ cores = 4, memory = 4, software = false } = {}) {
  return software || cores <= 2 || memory <= 2 ? 'low' : 'medium';
}

// Trình duyệt đang vẽ bằng CPU (không có tăng tốc phần cứng)?
export const isSoftwareRenderer = (name = '') => /swiftshader|llvmpipe|softpipe|software|microsoft basic render|mesa offscreen/i.test(name);

// st: { slow, fast } giây liên tục chậm/nhanh. avgMs: thời gian khung trung bình gần đây. Trả mức mới trong [0, max].
export function governLevel(st, level, max, avgMs, dt) {
  if (avgMs > 28) { st.slow += dt; st.fast = 0; } else if (avgMs < 15) { st.fast += dt; st.slow = 0; } else { st.slow = 0; st.fast = 0; }
  if (st.slow >= 2 && level > 0) { st.slow = 0; return level - 1; }
  if (st.fast >= 10 && level < max) { st.fast = 0; return level + 1; }
  return level;
}
