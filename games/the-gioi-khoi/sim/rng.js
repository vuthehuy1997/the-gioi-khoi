// Bộ sinh số ngẫu nhiên có seed (mulberry32): cùng seed và cùng chuỗi gọi cho cùng kết quả, nên mô phỏng lặp lại được.
export function makeRng(seed) {
  let a = seed | 0;
  const rand = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rand.state = () => a;
  return rand;
}

// Băm chuỗi 32 bit (FNV-1a) làm seed: phần thưởng tất định không dùng g.rng (thứ tự gọi đổi theo hành động khác).
export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
