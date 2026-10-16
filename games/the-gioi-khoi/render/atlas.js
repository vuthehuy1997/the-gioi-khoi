// Atlas texture tự vẽ (pixel art 16x16, 8 cột x 3 hàng) từ nhiễu có seed, nên không phụ thuộc gói art ngoài.
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
  leaves: (x, y, s) => hash(s, x, y) < 0.16 ? rgb(0, 0, 0, 0) : jitter(rgb(56, 132, 44), 22, s, x, y),
  planks: (x, y, s) => (y % 4 === 3) ? jitter(rgb(120, 86, 46), 6, s, x, y) : jitter(rgb(184, 138, 80), 10, s, x, y),
  ore: (x, y, s) => (hash(s + 1, x >> 1, y >> 1) < 0.22) ? jitter(rgb(150, 100, 255), 30, s, x, y) : jitter(rgb(125, 125, 128), 14, s, x, y),
  gem_ore: (x, y, s) => (hash(s + 1, x >> 1, y >> 1) < 0.2) ? jitter(rgb(70, 230, 230), 30, s, x, y) : jitter(rgb(110, 110, 118), 14, s, x, y),
  water: (x, y, s) => jitter(rgb(47, 111, 208, 200), 10, s, x, y),
  cactus_side: (x, y, s) => (x % 5 === 2 && y % 3 === 1) ? rgb(210, 230, 160) : jitter(rgb(x % 4 === 0 ? 40 : 58, x % 4 === 0 ? 110 : 140, 50), 8, s, x, y),
  cactus_top: (x, y, s) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return d < 4 ? jitter(rgb(40, 100, 50), 8, s, x, y) : jitter(rgb(66, 150, 60), 8, s, x, y); },
  ice: (x, y, s) => ((x + y) % 7 === 0) ? rgb(235, 248, 255) : jitter(rgb(160, 210, 240), 10, s, x, y),
  bedrock: (x, y, s) => jitter(rgb(48, 48, 52), 26, s, x, y),
  magma: (x, y, s) => hash(s, x >> 1, y >> 1) < 0.45 ? jitter(rgb(255, 130, 30), 40, s, x, y) : jitter(rgb(60, 24, 16), 14, s, x, y),
  bench_top: (x, y, s) => (x % 5 === 0 || y % 5 === 0) ? rgb(96, 66, 36) : jitter(rgb(184, 138, 80), 10, s, x, y),
  bench_side: (x, y, s) => (y > 3 && y < 12 && x > 2 && x < 13 && ((x + y) % 4 === 0)) ? rgb(70, 70, 76) : jitter(rgb(150, 108, 60), 10, s, x, y),
};

// Trả canvas 2D chứa toàn bộ atlas. Có thể dùng làm map cho CanvasTexture.
export function makeAtlas(doc = document) {
  const c = doc.createElement('canvas');
  c.width = TILE * ATLAS_COLS; c.height = TILE * ATLAS_ROWS;
  const ctx = c.getContext('2d'), img = ctx.createImageData(c.width, c.height);
  TILES.forEach((name, i) => {
    const ox = (i % ATLAS_COLS) * TILE, oy = Math.floor(i / ATLAS_COLS) * TILE, paint = PAINT[name], s = 1000 + i * 17;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const px = paint(x, y, s), o = ((oy + y) * c.width + ox + x) * 4;
      img.data[o] = px[0]; img.data[o + 1] = px[1]; img.data[o + 2] = px[2]; img.data[o + 3] = px[3] ?? 255;
    }
  });
  ctx.putImageData(img, 0, 0);
  return c;
}
