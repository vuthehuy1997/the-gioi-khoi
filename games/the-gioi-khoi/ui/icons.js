// Icon vật phẩm vẽ bằng canvas: block là khối 3D nhìn nghiêng lấy từ atlas; công cụ, vũ khí và nguyên liệu vẽ tay theo bậc/màu.
import { ITEMS } from '../content/items.js';
import { BLOCK_BY_NAME, ATLAS_COLS } from '../world/blocks.js';

const TIER_COLOR = { 1: '#a97c45', 2: '#9aa0a8', 3: '#a77bff', 4: '#4fe3e3' };
const S = 32;

function cube(ctx, atlas, block) {
  const t = block.tiles, tile = i => ({ sx: (i % ATLAS_COLS) * 16, sy: Math.floor(i / ATLAS_COLS) * 16 });
  ctx.imageSmoothingEnabled = false;
  const face = (i, m, shade) => {
    const { sx, sy } = tile(i); ctx.save(); ctx.setTransform(...m); ctx.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
    if (shade) { ctx.fillStyle = `rgba(0,0,0,${shade})`; ctx.fillRect(0, 0, 16, 16); } ctx.restore();
  };
  face(t[0], [12 / 16, 6 / 16, -12 / 16, 6 / 16, 16, 3], 0);
  face(t[1], [12 / 16, 6 / 16, 0, 13 / 16, 4, 9], 0.22);
  face(t[1], [12 / 16, -6 / 16, 0, 13 / 16, 16, 15], 0.42);
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

const MATERIAL = {
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

export function createIcons(atlas) {
  const cache = new Map();
  return {
    get(id) {
      if (cache.has(id)) return cache.get(id);
      const it = ITEMS[id], c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d');
      if (it && it.block) cube(ctx, atlas, BLOCK_BY_NAME[it.block]);
      else if (it && it.tool) tool(ctx, it.tool.type, TIER_COLOR[it.tool.tier]);
      else if (MATERIAL[id]) MATERIAL[id](ctx);
      else { ctx.fillStyle = '#888'; ctx.fillRect(8, 8, 16, 16); }
      const url = c.toDataURL(); cache.set(id, url); return url;
    },
  };
}
