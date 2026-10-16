// Vòng lặp tick cố định cho host. Dùng bộ tích luỹ thời gian, nên chạy đúng tốc độ dù khung hình thất thường.
// Nếu tab bị trình duyệt làm chậm rồi chạy bù (khoảng nghỉ rất dài), chỉ chạy tối đa maxCatchUp tick và bỏ phần dư,
// để không bị "xoắn ốc" chạy hàng nghìn tick liền.
export function createFixedLoop({ hz = 20, step, maxCatchUp = 10 }) {
  const dt = 1000 / hz;
  let acc = 0, tick = 0;
  return {
    get tick() { return tick; },
    advance(ms) {
      acc += ms;
      let n = 0;
      while (acc >= dt && n < maxCatchUp) { step(dt / 1000, tick++); acc -= dt; n++; }
      if (acc >= dt) acc = 0;
      return n;
    },
  };
}

// Chạy loop bằng setInterval (vẫn chạy khi tab ẩn, dù bị làm chậm khoảng 1 giây một lần). Trả hàm dừng.
export function startHostLoop(loop, { intervalMs = 50, now = () => performance.now() } = {}) {
  let last = now();
  const id = setInterval(() => { const t = now(); loop.advance(t - last); last = t; }, intervalMs);
  return () => clearInterval(id);
}
