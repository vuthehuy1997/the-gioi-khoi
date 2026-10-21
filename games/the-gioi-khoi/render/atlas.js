// Atlas texture tự vẽ (pixel art 16x16, 8 cột x 5 hàng) từ nhiễu có seed, nên không phụ thuộc gói art ngoài.
import { hash } from '../world/noise.js';
import { TILES, ATLAS_COLS, ATLAS_ROWS } from '../world/blocks.js';

export const TILE = 16;

const clamp = v => Math.max(0, Math.min(255, v | 0));
const rgb = (r, g, b, a = 255) => [clamp(r), clamp(g), clamp(b), a];
const jitter = (c, amt, s, x, y) => { const j = (hash(s, x, y) - 0.5) * 2 * amt; return rgb(c[0] + j, c[1] + j, c[2] + j, c[3] ?? 255); };

const PAINT = {
  stone: (x, y, s) => jitter(rgb(125, 125, 128), 14, s, x, y),
  dirt: (x, y, s) => jitter(rgb(122, 82, 48), 14, s, x, y),
  grass_top: (x, y, s) => jitter(rgb(88, 160, 56), 16, s, x, y),
  grass_side: (x, y, s) => y < 3 + Math.floor(hash(s, x, 99) * 3) ? jitter(rgb(88, 160, 56), 16, s, x, y) : jitter(rgb(122, 82, 48), 14, s, x, y),
  sand: (x, y, s) => jitter(rgb(220, 201, 138), 10, s, x, y),
  snow: (x, y, s) => jitter(rgb(240, 246, 250), 6, s, x, y),
  snow_side: (x, y, s) => y < 4 + Math.floor(hash(s, x, 99) * 3) ? jitter(rgb(240, 246, 250), 6, s, x, y) : jitter(rgb(122, 82, 48), 14, s, x, y),
  log_side: (x, y, s) => jitter(rgb(x % 4 === 1 ? 84 : 108, x % 4 === 1 ? 58 : 76, x % 4 === 1 ? 34 : 44), 8, s, x, y),
  log_top: (x, y, s) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return jitter(Math.floor(d) % 2 ? rgb(150, 112, 66) : rgb(112, 80, 46), 8, s, x, y); },
  leaves: (x, y, s) => hash(s, x >> 1, y >> 1) < 0.07 && hash(s, x, y) < 0.5 ? rgb(0, 0, 0, 0) : jitter(rgb(52 + (hash(s, x >> 2, y >> 2) < 0.35 ? 14 : 0), 128, 42), 12, s, x, y),
  planks: (x, y, s) => (y % 4 === 3) ? jitter(rgb(120, 86, 46), 6, s, x, y) : jitter(rgb(184, 138, 80), 10, s, x, y),
  ore: (x, y, s) => (hash(s + 1, x >> 1, y >> 1) < 0.22) ? jitter(rgb(150, 100, 255), 30, s, x, y) : jitter(rgb(125, 125, 128), 14, s, x, y),
  gem_ore: (x, y, s) => (hash(s + 1, x >> 1, y >> 1) < 0.2) ? jitter(rgb(70, 230, 230), 30, s, x, y) : jitter(rgb(110, 110, 118), 14, s, x, y),
  water: (x, y, s) => jitter(rgb(47, 111, 208, 200), 10, s, x, y),
  cactus_side: (x, y, s) => (x % 5 === 2 && y % 3 === 1) ? rgb(210, 230, 160) : jitter(rgb(x % 4 === 0 ? 40 : 58, x % 4 === 0 ? 110 : 140, 50), 8, s, x, y),
  cactus_top: (x, y, s) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return d < 4 ? jitter(rgb(40, 100, 50), 8, s, x, y) : jitter(rgb(66, 150, 60), 8, s, x, y); },
  ice: (x, y, s) => ((x + y) % 7 === 0) ? rgb(235, 248, 255) : jitter(rgb(160, 210, 240), 10, s, x, y),
  bedrock: (x, y, s) => jitter(rgb(48, 48, 52), 26, s, x, y),
  magma: (x, y, s) => hash(s, x >> 1, y >> 1) < 0.45 ? jitter(rgb(255, 130, 30), 40, s, x, y) : jitter(rgb(60, 24, 16), 14, s, x, y),
  tall_grass: (x, y, s) => { const blade = (x * 5 + 3) % 7 < 2 || (x * 3 + 1) % 5 === 0; const hgt = 5 + Math.floor(hash(s, x, 7) * 9); return blade && y >= 16 - hgt ? jitter(rgb(86, 160, 52), 24, s, x, y) : rgb(0, 0, 0, 0); },
  flower_red: (x, y, s) => { if (x === 7 && y > 7) return rgb(60, 130, 40); const d = Math.hypot(x - 7.5, y - 5.5); return d < 2.6 ? (d < 1 ? rgb(255, 214, 80) : rgb(222, 52, 56)) : rgb(0, 0, 0, 0); },
  flower_yellow: (x, y, s) => { if (x === 7 && y > 7) return rgb(60, 130, 40); const d = Math.hypot(x - 7.5, y - 5.5); return d < 2.6 ? (d < 1 ? rgb(190, 110, 30) : rgb(250, 220, 60)) : rgb(0, 0, 0, 0); },
  dead_bush: (x, y, s) => { const t = (x + y) % 5 === 0 || (x - y + 16) % 6 === 0; return t && y > 4 && y < 15 && x > 2 && x < 13 ? jitter(rgb(122, 86, 44), 18, s, x, y) : rgb(0, 0, 0, 0); },
  glow_mushroom: (x, y, s) => { const cap = Math.hypot(x - 7.5, (y - 6) * 1.5) < 5 && y < 8; if (cap) return hash(s, x >> 1, y >> 1) < 0.25 ? rgb(255, 255, 210) : jitter(rgb(70, 230, 200), 20, s, x, y); return (x === 7 || x === 8) && y >= 8 && y < 15 ? jitter(rgb(215, 235, 225), 10, s, x, y) : rgb(0, 0, 0, 0); },
  reed: (x, y, s) => { const stem = x === 4 || x === 8 || x === 11; const top = x === 8 ? 1 : x === 4 ? 4 : 3; if (stem && y >= top) return jitter(rgb(110, 140, 62), 18, s, x, y); return (x === 8 || x === 4) && y < top + 3 && y >= top - 1 && y < 5 ? rgb(112, 70, 36) : rgb(0, 0, 0, 0); },
  ember_bloom: (x, y, s) => { if (x === 7 && y > 8) return rgb(70, 50, 40); const d = Math.hypot(x - 7.5, y - 6); return d < 4 ? (d < 1.6 ? rgb(255, 240, 150) : hash(s, x, y) < 0.5 ? rgb(255, 120, 30) : rgb(230, 60, 20)) : rgb(0, 0, 0, 0); },
  crystal_bloom: (x, y, s) => { const spike = (cx, h) => Math.abs(x - cx) < (y - (15 - h)) * 0.35 + 0.6 && y >= 15 - h; if (spike(7.5, 11) || spike(3.5, 6) || spike(11.5, 8)) return jitter(y < 9 ? rgb(236, 200, 255) : rgb(170, 110, 230), 20, s, x, y); return rgb(0, 0, 0, 0); },
  moss_top: (x, y, s) => jitter(rgb(70 + (hash(s, x >> 2, y >> 2) < 0.4 ? 14 : 0), 118, 62), 14, s, x, y),
  moss_side: (x, y, s) => y < 4 + Math.floor(hash(s, x, 99) * 4) ? jitter(rgb(70, 118, 62), 14, s, x, y) : jitter(rgb(72, 56, 40), 12, s, x, y),
  mud: (x, y, s) => jitter(rgb(72, 56, 40), 12, s, x, y),
  ash: (x, y, s) => hash(s + 3, x >> 1, y >> 1) < 0.1 ? jitter(rgb(150, 70, 40), 20, s, x, y) : jitter(rgb(66, 64, 68), 12, s, x, y),
  basalt: (x, y, s) => (x % 5 === 0) ? jitter(rgb(28, 28, 34), 8, s, x, y) : jitter(rgb(48, 48, 56), 10, s, x, y),
  amethyst: (x, y, s) => { const f = hash(s, x >> 2, y >> 2); const base = f < 0.3 ? rgb(190, 130, 240) : f < 0.65 ? rgb(150, 90, 215) : rgb(112, 64, 178); return (x + y) % 6 === 0 ? rgb(240, 215, 255) : jitter(base, 14, s, x, y); },
  bench_top: (x, y, s) => (x % 5 === 0 || y % 5 === 0) ? rgb(96, 66, 36) : jitter(rgb(184, 138, 80), 10, s, x, y),
  iron_ore: (x, y, s) => (hash(s + 1, x >> 1, y >> 1) < 0.2) ? jitter(rgb(214, 160, 120), 22, s, x, y) : jitter(rgb(125, 125, 128), 14, s, x, y),
  furnace_side: (x, y, s) => { const mouth = x > 3 && x < 12 && y > 6 && y < 13; if (mouth) return y > 10 ? jitter(rgb(255, 150, 40), 30, s, x, y) : rgb(24, 20, 20); return (x % 5 === 0 || y % 5 === 0) ? jitter(rgb(86, 86, 90), 8, s, x, y) : jitter(rgb(122, 122, 126), 12, s, x, y); },
  furnace_top: (x, y, s) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return d < 3.5 ? rgb(30, 26, 26) : jitter(rgb(110, 110, 114), 12, s, x, y); },
  anvil_top: (x, y, s) => (y > 3 && y < 12) ? jitter(rgb(88, 92, 100), 10, s, x, y) : jitter(rgb(52, 54, 60), 8, s, x, y),
  anvil_side: (x, y, s) => { const waist = x > 5 && x < 10 && y > 4 && y < 12, top = y < 5, base = y > 11 && x > 1 && x < 14; return (waist || top || base) ? jitter(y < 5 ? rgb(120, 124, 132) : rgb(70, 72, 80), 10, s, x, y) : jitter(rgb(150, 150, 160), 0, s, x, y).map((v, i) => i === 3 ? 0 : v); },
  chest_top: (x, y, s) => (x === 0 || y === 0 || x === 15 || y === 15) ? rgb(70, 46, 24) : jitter(rgb(160, 112, 58), 10, s, x, y),
  chest_side: (x, y, s) => { if (y === 6 || x === 0 || x === 15 || y === 0 || y === 15) return rgb(70, 46, 24); if (x > 6 && x < 10 && y > 4 && y < 9) return rgb(230, 190, 70); return jitter(rgb(160, 112, 58), 10, s, x, y); },
  bed_top: (x, y, s) => y < 5 ? jitter(rgb(236, 232, 224), 6, s, x, y) : jitter(rgb(190, 50, 56), 10, s, x, y),
  bed_side: (x, y, s) => y < 7 ? (y < 4 ? jitter(rgb(190, 50, 56), 10, s, x, y) : jitter(rgb(150, 36, 44), 8, s, x, y)) : jitter(rgb(150, 108, 60), 10, s, x, y),
  door: (x, y, s) => (x < 2 || x > 13 || y < 2 || y > 13 || (y === 7 && x > 2 && x < 13)) ? jitter(rgb(96, 64, 32), 8, s, x, y) : (x > 10 && x < 13 && y > 6 && y < 9) ? rgb(230, 200, 90) : jitter(rgb(150, 104, 54), 10, s, x, y),
  door_open: (x, y, s) => (x < 3) ? jitter(rgb(120, 82, 42), 10, s, x, y) : (x === 3 && y > 1 && y < 14) ? rgb(70, 46, 24) : rgb(0, 0, 0, 0),
  torch: (x, y, s) => { if ((x === 7 || x === 8) && y >= 6) return jitter(rgb(120, 82, 42), 10, s, x, y); const d = Math.hypot(x - 7.5, y - 3.5); return d < 3.2 ? (d < 1.6 ? rgb(255, 240, 150) : hash(s, x, y) < 0.5 ? rgb(255, 150, 40) : rgb(240, 90, 24)) : rgb(0, 0, 0, 0); },
  glass: (x, y, s) => (x === 0 || y === 0 || x === 15 || y === 15) ? rgb(196, 226, 240) : ((x + y === 5 || x + y === 6 || x + y === 11) && x > 1 && y > 1) ? rgb(236, 248, 255) : rgb(0, 0, 0, 0),
  stone_brick: (x, y, s) => { const row = y >> 2, off = (row % 2) * 4; return (y % 4 === 3 || (x + off) % 8 === 7) ? jitter(rgb(84, 84, 90), 8, s, x, y) : jitter(rgb(136, 136, 140), 10, s, x, y); },
  bench_side: (x, y, s) => (y > 3 && y < 12 && x > 2 && x < 13 && ((x + y) % 4 === 0)) ? rgb(70, 70, 76) : jitter(rgb(150, 108, 60), 10, s, x, y),
};

export const tileColors = [];   // màu trung bình mỗi ô, điền khi makeAtlas() chạy (dùng cho hạt vỡ block)

// Trả canvas 2D chứa toàn bộ atlas. Có thể dùng làm map cho CanvasTexture.
export function makeAtlas(doc = document) {
  const c = doc.createElement('canvas');
  c.width = TILE * ATLAS_COLS; c.height = TILE * ATLAS_ROWS;
  const ctx = c.getContext('2d'), img = ctx.createImageData(c.width, c.height);
  TILES.forEach((name, i) => {
    const ox = (i % ATLAS_COLS) * TILE, oy = Math.floor(i / ATLAS_COLS) * TILE, paint = PAINT[name], s = 1000 + i * 17;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const px = paint(x, y, s), o = ((oy + y) * c.width + ox + x) * 4;
      img.data[o] = px[0]; img.data[o + 1] = px[1]; img.data[o + 2] = px[2]; img.data[o + 3] = px[3] ?? 255;
      if ((px[3] ?? 255) > 128) { r += px[0]; g += px[1]; b += px[2]; n++; }
    }
    tileColors[i] = n ? [r / n / 255, g / n / 255, b / n / 255] : [0.5, 0.5, 0.5];
  });
  ctx.putImageData(img, 0, 0);
  return c;
}
