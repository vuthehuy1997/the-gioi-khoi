// Bản đồ nhỏ góc phải: địa hình quanh người chơi nhìn từ trên xuống (tô theo block mặt trên, đổ bóng theo độ cao), chấm quái / NPC / người chơi,
// miệng hầm ngục, la bàn và tọa độ. Vẽ lại ~3 lần/giây; mũi tên bản thân xoay theo hướng nhìn. Bấm N để phóng to/thu nhỏ.
import { BLOCKS } from '../world/blocks.js';
import { MOBS } from '../content/mobs.js';
import { isNight } from '../sim/daynight.js';

const COLOR = {
  grass: '#5fa84a', leaves: '#2f6b2c', log: '#6b4a2a', sand: '#d9c88a', snow: '#f1f5fa', ice: '#a9d8f2', water: '#3b6fd0', stone: '#8a8d93', dirt: '#8a5e3b',
  moss: '#4f7a3a', mud: '#5a4430', ash: '#6a6563', basalt: '#3d3b42', magma: '#e5531a', amethyst: '#9b59d0', cactus: '#3f8f3f', bedrock: '#333', planks: '#b58a54',
  stone_brick: '#767a82', dungeon_wall: '#55505a', farmland: '#5b3d24', farmland_wet: '#3f2a18', tall_grass: '#6bb852', flower_red: '#d94a4a', flower_yellow: '#e0c53a',
  dead_bush: '#8a6c3c', glow_mushroom: '#38d8d0', reed: '#7aa54a', ember_bloom: '#ff7a1c', crystal_bloom: '#c58bf2', ore: '#8a8d93', iron_ore: '#8a8d93', gem_ore: '#8a8d93',
};
const colorOf = new Map();
const rgb = hex => { const n = parseInt(hex.slice(1).length === 3 ? hex.slice(1).replace(/./g, c => c + c) : hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function blockRgb(id) {
  if (!colorOf.has(id)) { const b = BLOCKS[id]; colorOf.set(id, rgb(COLOR[b && b.name] || '#777777')); }
  return colorOf.get(id);
}

export function createMinimap(root) {
  const R = 24, PX = 3;                                   // bán kính (block) và số điểm ảnh mỗi block khi thu nhỏ
  let big = false, acc = 99, last = { x: 1e9, z: 1e9 };
  root.textContent = '';
  const cv = document.createElement('canvas'), info = document.createElement('div'), north = document.createElement('i');
  info.className = 'mminfo'; north.className = 'mmn'; north.textContent = 'B';
  root.append(cv, north, info);
  const ctx = cv.getContext('2d'), terrain = document.createElement('canvas'); terrain.width = terrain.height = R * 2 + 1;
  const tctx = terrain.getContext('2d'), img = tctx.createImageData(R * 2 + 1, R * 2 + 1);
  const heights = new Int16Array((R * 2 + 1) ** 2);
  const size = () => (big ? 5 : PX) * (R * 2 + 1);

  function sampleTerrain(world, px, py, pz) {
    const N = R * 2 + 1;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = Math.floor(px) + i - R, z = Math.floor(pz) + j - R;
      let y = Math.floor(py) + 14, id = 0;
      const lim = y - 48;
      for (; y > lim; y--) { id = world.get(x, y, z); if (id !== 0 && !(BLOCKS[id] && BLOCKS[id].name === 'torch')) break; }
      heights[j * N + i] = y;
      const [r, g, b] = id ? blockRgb(id) : [20, 22, 30], k = (j * N + i) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    for (let j = 1; j < N; j++) for (let i = 1; i < N; i++) {                               // đổ bóng: thấp hơn ô phía tây-bắc thì tối, cao hơn thì sáng
      const d = Math.max(-3, Math.min(3, heights[j * N + i] - heights[(j - 1) * N + i - 1])), k = (j * N + i) * 4, f = 1 + d * 0.07;
      for (let c = 0; c < 3; c++) img.data[k + c] = Math.max(0, Math.min(255, img.data[k + c] * f));
    }
    tctx.putImageData(img, 0, 0);
  }

  return {
    toggle() { big = !big; root.classList.toggle('big', big); acc = 99; },
    get big() { return big; },
    // view: { world, x, y, z, yaw, es, ps, uid, sites, time, region }
    update(dt, v) {
      acc += dt;
      const S = size(), N = R * 2 + 1, cell = S / N;
      if (cv.width !== S) { cv.width = cv.height = S; cv.style.width = cv.style.height = S + 'px'; }
      if (acc >= 0.35 || Math.hypot(v.x - last.x, v.z - last.z) > 2) { acc = 0; last = { x: v.x, z: v.z }; sampleTerrain(v.world, v.x, v.y, v.z); }
      ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, S, S);
      ctx.save(); ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.clip();
      const off = (v.x - Math.floor(v.x)) * cell, offz = (v.z - Math.floor(v.z)) * cell;     // cuộn mượt theo phần lẻ của vị trí
      ctx.drawImage(terrain, cell * 0.5 - off, cell * 0.5 - offz, S, S);
      const at = (x, z) => [S / 2 + (x - v.x) * cell, S / 2 + (z - v.z) * cell];
      const dot = (x, z, col, r, ring) => { const [sx, sy] = at(x, z); if (Math.hypot(sx - S / 2, sy - S / 2) > S / 2 - 2) return; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fillStyle = col; ctx.fill(); if (ring) { ctx.lineWidth = 1.5; ctx.strokeStyle = '#000b'; ctx.stroke(); } };
      for (const s of Object.values(v.sites || {})) { const [sx, sy] = at(s.x, s.z); if (Math.hypot(sx - S / 2, sy - S / 2) < S / 2 - 6) { ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#c58bf2'; ctx.strokeStyle = '#000c'; ctx.lineWidth = 1.5; ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8); ctx.restore(); } }
      for (const e of v.es) {
        if (e.kind === 'mob') { const d = MOBS[e.type]; dot(e.x, e.z, d && d.passive ? '#f1e27a' : '#ff4a3d', 3, true); }
        else if (e.kind === 'boss') dot(e.x, e.z, '#ff2a2a', 6, true);
        else if (e.kind === 'npc') dot(e.x, e.z, '#52e0ff', 3.5, true);
      }
      for (const p of v.ps) if (p.uid !== v.uid && !p.dead) dot(p.x, p.z, '#ffffff', 3.5, true);
      ctx.restore();
      ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(-v.yaw);                              // mũi tên bản thân: hướng nhìn
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.restore();
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = '#e9b949'; ctx.stroke();
      info.textContent = `${Math.floor(v.x)}, ${Math.floor(v.y)}, ${Math.floor(v.z)} · ${isNight(v.time) ? '☾ đêm' : '☀ ngày'}${v.region ? ' · ' + v.region : ''}`;
    },
  };
}
