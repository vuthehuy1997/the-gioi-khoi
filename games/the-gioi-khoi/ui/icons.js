// Icon vật phẩm vẽ bằng canvas: block là khối 3D nhìn nghiêng lấy từ atlas; công cụ, vũ khí và nguyên liệu vẽ tay theo bậc/màu.
import { ITEMS } from '../content/items.js';
import { BLOCK_BY_NAME, ATLAS_COLS } from '../world/blocks.js';

const TIER_COLOR = { 1: '#a97c45', 2: '#9aa0a8', 3: '#a77bff', 4: '#4fe3e3' };
const K = 2, S = 32 * K;                                      // vẽ theo hệ 32x32 nhưng canvas 64x64 cho nét mịn

// Trang bị: hình mũ, áo, quần, giày tô theo màu bộ.
const ARMOR = {
  head: (ctx, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(6, 22); ctx.lineTo(6, 14); ctx.quadraticCurveTo(16, 2, 26, 14); ctx.lineTo(26, 22); ctx.lineTo(21, 22); ctx.lineTo(21, 17); ctx.lineTo(11, 17); ctx.lineTo(11, 22); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#0003'; ctx.fillRect(6, 20, 20, 2); },
  chest: (ctx, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(11, 5); ctx.lineTo(14, 8); ctx.lineTo(18, 8); ctx.lineTo(21, 5); ctx.lineTo(28, 8); ctx.lineTo(25, 15); ctx.lineTo(23, 14); ctx.lineTo(23, 28); ctx.lineTo(9, 28); ctx.lineTo(9, 14); ctx.lineTo(7, 15); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#0003'; ctx.fillRect(15, 10, 2, 18); },
  legs: (ctx, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(8, 5); ctx.lineTo(24, 5); ctx.lineTo(25, 28); ctx.lineTo(17, 28); ctx.lineTo(16, 14); ctx.lineTo(15, 28); ctx.lineTo(7, 28); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#0003'; ctx.fillRect(8, 8, 16, 2); },
  feet: (ctx, c) => { ctx.fillStyle = c; ctx.fillRect(5, 8, 8, 13); ctx.fillRect(19, 8, 8, 13); ctx.fillRect(3, 21, 11, 6); ctx.fillRect(17, 21, 11, 6); ctx.fillStyle = '#0003'; ctx.fillRect(3, 25, 11, 2); ctx.fillRect(17, 25, 11, 2); },
};

function cube(ctx, atlas, block) {
  const t = block.tiles, tile = i => ({ sx: (i % ATLAS_COLS) * 16, sy: Math.floor(i / ATLAS_COLS) * 16 });
  ctx.imageSmoothingEnabled = false;
  const face = (i, m, shade) => {
    const { sx, sy } = tile(i); ctx.save(); ctx.setTransform(...m.map(v => v * K)); ctx.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
    if (shade) { ctx.fillStyle = `rgba(0,0,0,${shade})`; ctx.fillRect(0, 0, 16, 16); } ctx.restore();
  };
  face(t[0], [12 / 16, 6 / 16, -12 / 16, 6 / 16, 16, 3], 0);
  face(t[1], [12 / 16, 6 / 16, 0, 13 / 16, 4, 9], 0.22);
  face(t[1], [12 / 16, -6 / 16, 0, 13 / 16, 16, 15], 0.42);
}

// Viền sáng phía trên-trái của trang bị (dùng globalCompositeOperation để chỉ tô lên phần đã vẽ).
function shine(ctx) {
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, 0, 32, 32); g.addColorStop(0, '#ffffff66'); g.addColorStop(0.5, '#ffffff00'); g.addColorStop(1, '#00000044');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32); ctx.restore();
}
// Di vật: vài tia sáng quanh vũ khí.
function sparkle(ctx, color) {
  ctx.fillStyle = '#fff'; for (const [x, y, r] of [[5, 6, 2], [27, 5, 1.5], [26, 27, 1.5]]) { ctx.fillRect(x - r, y - 0.5, r * 2, 1); ctx.fillRect(x - 0.5, y - r, 1, r * 2); }
  ctx.fillStyle = color || '#fff'; ctx.globalAlpha = 0.35; ctx.fillRect(3, 3, 3, 3); ctx.globalAlpha = 1;
}

function plantTile(ctx, atlas, block) {                      // đuốc, cửa mở: vẽ ô texture phẳng, phóng to
  const i = block.tiles[0]; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, (i % ATLAS_COLS) * 16, Math.floor(i / ATLAS_COLS) * 16, 16, 16, 2 * K, 2 * K, 28 * K, 28 * K);
}

function tool(ctx, kind, color) {
  ctx.lineCap = 'square';
  ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, 26); ctx.lineTo(22, 10); ctx.stroke();      // cán
  ctx.fillStyle = color; ctx.strokeStyle = color;
  if (kind === 'pick') { ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(10, 8); ctx.quadraticCurveTo(22, 4, 27, 16); ctx.stroke(); }
  else if (kind === 'axe') { ctx.beginPath(); ctx.moveTo(17, 7); ctx.lineTo(27, 5); ctx.lineTo(27, 17); ctx.lineTo(21, 13); ctx.closePath(); ctx.fill(); }
  else if (kind === 'shovel') { ctx.beginPath(); ctx.ellipse(24, 8, 5, 6, 0.7, 0, 7); ctx.fill(); }
  else if (kind === 'sword') { ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(7, 25); ctx.lineTo(24, 8); ctx.stroke(); ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, 17); ctx.lineTo(15, 26); ctx.stroke(); }
}

const poly = (ctx, fill, pts) => { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); };
const MATERIAL = {
  amethyst: ctx => { poly(ctx, '#7c4bc4', [[5, 26], [8, 12], [12, 8], [14, 26]]); poly(ctx, '#b88af0', [[13, 26], [16, 4], [21, 10], [22, 26]]); poly(ctx, '#e6ccff', [[16, 4], [18, 6], [17, 26], [13, 26]]); poly(ctx, '#9a68de', [[21, 26], [24, 14], [28, 18], [27, 26]]); },
  mushroom: ctx => { ctx.fillStyle = '#d8ece0'; ctx.fillRect(14, 15, 4, 11); ctx.fillStyle = '#35b8a4'; ctx.beginPath(); ctx.ellipse(16, 14, 11, 8, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#e8fff4'; for (const [x, y] of [[11, 10], [17, 8], [21, 12]]) ctx.fillRect(x, y, 3, 3); },
  frog_leg: ctx => { ctx.fillStyle = '#7fb85a'; ctx.beginPath(); ctx.ellipse(13, 12, 8, 5, -0.6, 0, 7); ctx.fill(); ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(17, 17); ctx.lineTo(25, 25); ctx.stroke(); ctx.fillStyle = '#e8e0c8'; ctx.fillRect(23, 24, 5, 3); },
  stew: ctx => { ctx.fillStyle = '#6b4a22'; ctx.beginPath(); ctx.moveTo(4, 14); ctx.lineTo(28, 14); ctx.quadraticCurveTo(26, 28, 16, 28); ctx.quadraticCurveTo(6, 28, 4, 14); ctx.fill(); ctx.fillStyle = '#c9803a'; ctx.beginPath(); ctx.ellipse(16, 14, 12, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#e8d0a0'; ctx.fillRect(10, 12, 3, 2); ctx.fillRect(18, 13, 3, 2); ctx.strokeStyle = '#fff6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, 9); ctx.quadraticCurveTo(10, 5, 13, 2); ctx.moveTo(19, 9); ctx.quadraticCurveTo(17, 5, 20, 2); ctx.stroke(); },
  scale: ctx => { ctx.fillStyle = '#4b8a4a'; ctx.beginPath(); ctx.moveTo(16, 4); ctx.quadraticCurveTo(28, 10, 25, 20); ctx.quadraticCurveTo(22, 28, 16, 29); ctx.quadraticCurveTo(10, 28, 7, 20); ctx.quadraticCurveTo(4, 10, 16, 4); ctx.fill(); ctx.strokeStyle = '#2c5a2c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16, 6); ctx.lineTo(16, 27); ctx.moveTo(16, 12); ctx.lineTo(10, 18); ctx.moveTo(16, 12); ctx.lineTo(22, 18); ctx.stroke(); },
  ember: ctx => { poly(ctx, '#3a2a28', [[5, 22], [9, 10], [18, 6], [27, 13], [25, 25], [12, 27]]); ctx.fillStyle = '#ff7a1c'; ctx.fillRect(11, 13, 5, 4); ctx.fillRect(18, 17, 5, 4); ctx.fillStyle = '#ffd35a'; ctx.fillRect(12, 14, 2, 2); ctx.fillRect(19, 18, 2, 2); },
  silk: ctx => { ctx.strokeStyle = '#f2ecff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; for (let r = 4; r <= 11; r += 3.5) { ctx.beginPath(); ctx.ellipse(16, 16, r, r * 0.8, r * 0.3, 0, 7); ctx.stroke(); } ctx.strokeStyle = '#b9a6e8'; ctx.beginPath(); ctx.moveTo(24, 22); ctx.quadraticCurveTo(28, 26, 26, 29); ctx.stroke(); },
  swamp_heart: ctx => { ctx.fillStyle = '#3f8a3a'; ctx.beginPath(); ctx.moveTo(16, 27); ctx.bezierCurveTo(2, 16, 6, 5, 16, 11); ctx.bezierCurveTo(26, 5, 30, 16, 16, 27); ctx.fill(); ctx.fillStyle = '#9be070'; ctx.fillRect(10, 11, 4, 3); ctx.strokeStyle = '#2a5a28'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16, 11); ctx.quadraticCurveTo(15, 6, 20, 3); ctx.stroke(); },
  magma_core: ctx => { ctx.fillStyle = '#2a1a18'; ctx.beginPath(); ctx.arc(16, 16, 11, 0, 7); ctx.fill(); ctx.strokeStyle = '#ff8a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, 12); ctx.lineTo(14, 16); ctx.lineTo(12, 24); ctx.moveTo(14, 16); ctx.lineTo(23, 14); ctx.moveTo(18, 22); ctx.lineTo(24, 22); ctx.stroke(); ctx.fillStyle = '#ffd35a'; ctx.beginPath(); ctx.arc(14, 16, 3, 0, 7); ctx.fill(); },
  guardian_prism: ctx => { poly(ctx, '#d8c4ff', [[16, 3], [28, 25], [4, 25]]); poly(ctx, '#f6eeff', [[16, 3], [16, 25], [4, 25]]); ctx.fillStyle = '#ff6a6a'; ctx.fillRect(18, 17, 8, 2); ctx.fillStyle = '#ffd35a'; ctx.fillRect(19, 19, 7, 2); ctx.fillStyle = '#6ae0ff'; ctx.fillRect(20, 21, 6, 2); },
  iron_ingot: ctx => { ctx.fillStyle = '#7d828c'; ctx.beginPath(); ctx.moveTo(4, 20); ctx.lineTo(10, 11); ctx.lineTo(28, 11); ctx.lineTo(24, 21); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#d9dde4'; ctx.beginPath(); ctx.moveTo(10, 11); ctx.lineTo(28, 11); ctx.lineTo(26, 15); ctx.lineTo(7, 15); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#a0a5ae'; ctx.fillRect(4, 20, 20, 4); },
  charcoal: ctx => { ctx.fillStyle = '#26262a'; ctx.beginPath(); ctx.moveTo(6, 22); ctx.lineTo(9, 10); ctx.lineTo(18, 7); ctx.lineTo(26, 14); ctx.lineTo(24, 25); ctx.lineTo(12, 26); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4a4a52'; ctx.fillRect(12, 11, 4, 3); ctx.fillRect(19, 17, 3, 3); },
  chitin: ctx => { ctx.fillStyle = '#c8742a'; ctx.beginPath(); ctx.ellipse(16, 16, 11, 8, 0.3, 0, 7); ctx.fill(); ctx.strokeStyle = '#7a3e14'; ctx.lineWidth = 2; for (const x of [10, 16, 22]) { ctx.beginPath(); ctx.moveTo(x - 2, 9); ctx.lineTo(x + 1, 23); ctx.stroke(); } },
  cooked_meat: ctx => { ctx.fillStyle = '#8a4a1e'; ctx.beginPath(); ctx.ellipse(13, 13, 8, 6, -0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#b8742e'; ctx.beginPath(); ctx.ellipse(12, 12, 5, 3, -0.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#eee'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(18, 18); ctx.lineTo(25, 25); ctx.stroke(); },
  pelt: ctx => { ctx.fillStyle = '#d98a3a'; ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(26, 6); ctx.lineTo(28, 22); ctx.lineTo(18, 27); ctx.lineTo(8, 24); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#f2d2a0'; ctx.fillRect(12, 12, 8, 6); },

  crystal: ctx => { ctx.fillStyle = '#a77bff'; ctx.beginPath(); ctx.moveTo(16, 4); ctx.lineTo(25, 16); ctx.lineTo(16, 28); ctx.lineTo(7, 16); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#d8c4ff'; ctx.beginPath(); ctx.moveTo(16, 4); ctx.lineTo(16, 28); ctx.lineTo(7, 16); ctx.closePath(); ctx.fill(); },
  gem: ctx => { ctx.fillStyle = '#4fe3e3'; ctx.beginPath(); ctx.moveTo(8, 12); ctx.lineTo(13, 6); ctx.lineTo(19, 6); ctx.lineTo(24, 12); ctx.lineTo(16, 27); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#c4fbff'; ctx.beginPath(); ctx.moveTo(13, 6); ctx.lineTo(19, 6); ctx.lineTo(16, 12); ctx.closePath(); ctx.fill(); },
  stick: ctx => { ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(9, 25); ctx.lineTo(23, 7); ctx.stroke(); },
  xu: ctx => { ctx.fillStyle = '#e9b949'; ctx.beginPath(); ctx.arc(16, 16, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#b8862a'; ctx.beginPath(); ctx.arc(16, 16, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe39a'; ctx.fillRect(14, 11, 4, 10); },
  meat: ctx => { ctx.fillStyle = '#c0453a'; ctx.beginPath(); ctx.ellipse(13, 13, 8, 6, -0.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#eee'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(18, 18); ctx.lineTo(25, 25); ctx.stroke(); },
  herb: ctx => { ctx.fillStyle = '#4cae4c'; for (const [x, y, r] of [[12, 12, -0.6], [20, 12, 0.6], [16, 18, 0]]) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.beginPath(); ctx.ellipse(0, 0, 4, 8, 0, 0, 7); ctx.fill(); ctx.restore(); } },
  fang: ctx => { ctx.fillStyle = '#f2f0e4'; ctx.beginPath(); ctx.moveTo(10, 6); ctx.lineTo(22, 6); ctx.lineTo(16, 27); ctx.closePath(); ctx.fill(); },
  bone: ctx => { ctx.strokeStyle = '#e8e4d0'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(9, 23); ctx.lineTo(23, 9); ctx.stroke(); ctx.fillStyle = '#e8e4d0'; for (const [x, y] of [[8, 25], [11, 22], [21, 8], [24, 11]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); } },
  venom: ctx => { ctx.fillStyle = '#7ad35a'; ctx.beginPath(); ctx.moveTo(16, 4); ctx.bezierCurveTo(26, 16, 24, 28, 16, 28); ctx.bezierCurveTo(8, 28, 6, 16, 16, 4); ctx.fill(); },
  shard: ctx => { ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.moveTo(18, 3); ctx.lineTo(25, 20); ctx.lineTo(14, 28); ctx.lineTo(8, 14); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.moveTo(18, 3); ctx.lineTo(14, 28); ctx.lineTo(8, 14); ctx.closePath(); ctx.fill(); },
  wolf_heart: ctx => { ctx.fillStyle = '#b0252c'; ctx.beginPath(); ctx.moveTo(16, 27); ctx.bezierCurveTo(2, 16, 6, 5, 16, 11); ctx.bezierCurveTo(26, 5, 30, 16, 16, 27); ctx.fill(); },
  scorpion_crown: ctx => { ctx.fillStyle = '#d98a2e'; ctx.beginPath(); ctx.moveTo(5, 24); ctx.lineTo(5, 10); ctx.lineTo(11, 17); ctx.lineTo(16, 7); ctx.lineTo(21, 17); ctx.lineTo(27, 10); ctx.lineTo(27, 24); ctx.closePath(); ctx.fill(); },
  frost_core: ctx => { ctx.fillStyle = '#7fd4ff'; ctx.beginPath(); ctx.arc(16, 16, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#eaf9ff'; ctx.beginPath(); ctx.arc(13, 13, 4, 0, 7); ctx.fill(); },
};

// Viền đậm quanh hình + ánh sáng trên-trái / bóng dưới-phải: làm icon vẽ tay nổi khỏi nền, đỡ phẳng.
function finish(c, strength = 1) {
  const ctx = c.getContext('2d');
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, 0, S, S); g.addColorStop(0, `rgba(255,255,255,${0.30 * strength})`); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(0,0,0,${0.34 * strength})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.restore();
  const sil = document.createElement('canvas'); sil.width = sil.height = S; const sx = sil.getContext('2d');
  sx.drawImage(c, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#17110c'; sx.fillRect(0, 0, S, S);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'destination-over';
  const o = K * 1.2; for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o], [0, o * 2.2]]) ctx.drawImage(sil, dx, dy);
  ctx.restore();
}

export function createIcons(atlas) {
  const cache = new Map(), canvases = new Map();
  return {
    canvas(id) { this.get(id); return canvases.get(id); },
    get(id) {
      if (cache.has(id)) return cache.get(id);
      const it = ITEMS[id], c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d'); canvases.set(id, c);
      if (it && it.block && BLOCK_BY_NAME[it.block].plant) plantTile(ctx, atlas, BLOCK_BY_NAME[it.block]);
      else if (it && it.block) cube(ctx, atlas, BLOCK_BY_NAME[it.block]);
      else if (it && it.armor) { ctx.scale(K, K); ARMOR[it.armor.slot](ctx, it.color); shine(ctx); finish(c, 0.8); }
      else if (it && it.tool) { ctx.scale(K, K); tool(ctx, it.tool.type, it.color || TIER_COLOR[it.tool.tier]); finish(c, 0.7); if (it.relic) sparkle(ctx, it.color); }
      else if (MATERIAL[id]) { ctx.scale(K, K); MATERIAL[id](ctx); finish(c); }
      else { ctx.scale(K, K); ctx.fillStyle = '#888'; ctx.fillRect(8, 8, 16, 16); finish(c); }
      const url = c.toDataURL(); cache.set(id, url); return url;
    },
  };
}
