// Chu kỳ ngày đêm theo thời gian game (giây). 600 giây một ngày: sáng, hoàng hôn, đêm, bình minh.
export const DAY_LEN = 600;
const phase = t => ((t % DAY_LEN) + DAY_LEN) % DAY_LEN / DAY_LEN;

// Độ sáng 0.25 (đêm) .. 1 (ngày).
export function lightLevel(t) {
  const p = phase(t);
  if (p < 0.6) return 1;
  if (p < 0.68) return 1 - 0.75 * (p - 0.6) / 0.08;
  if (p < 0.92) return 0.25;
  return 0.25 + 0.75 * (p - 0.92) / 0.08;
}
export const isNight = t => lightLevel(t) < 0.6;
