// Bộ điều chỉnh chất lượng tự động: máy yếu thì giảm tầm nhìn, máy khoẻ thì tăng lại. Hàm thuần để test.
export const MIN_RADIUS = 3;

// st: { slow: giây liên tục chậm, fast: giây liên tục nhanh }; avgMs: thời gian khung trung bình gần đây.
export function governRadius(st, radius, max, avgMs, dt) {
  if (avgMs > 26) { st.slow += dt; st.fast = 0; } else if (avgMs < 15) { st.fast += dt; st.slow = 0; } else { st.slow = 0; st.fast = 0; }
  if (st.slow >= 3 && radius > MIN_RADIUS) { st.slow = 0; return radius - 1; }
  if (st.fast >= 10 && radius < max) { st.fast = 0; return radius + 1; }
  return radius;
}
