// Bản đồ lớn (phím M): chỉ hiện vùng đã đi qua (sương đen cho phần chưa khám phá), thu phóng, điểm đánh dấu (bấm để đặt / bỏ), vị trí hầm ngục,
// NPC đã gặp, giường hồi sinh và người chơi. Điểm đánh dấu lưu theo hạt giống thế giới trong localStorage.
import { MOBS } from '../content/mobs.js';
import { REGIONS } from '../content/regions.js';

const TILE = 64;
const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };

export function createWorldMap(root, { seed = 0 } = {}) {
  const tiles = new Map(), seenNpcs = new Map(), KEY = 'tgk-waypoint-' + seed;
  let open = false, zoom = 2, waypoint = safe(() => JSON.parse(localStorage.getItem(KEY)), null), hover = null;
  root.textContent = ''; root.hidden = true;
  const cv = document.createElement('canvas'), bar = document.createElement('div'), hint = document.createElement('div');
  bar.className = 'wmbar'; hint.className = 'wmhint';
  hint.textContent = 'Bấm: đặt / bỏ điểm đánh dấu · lăn chuột hoặc +/−: thu phóng · M hoặc Esc: đóng';
  root.append(bar, cv, hint);
  const ctx = cv.getContext('2d');
  const saveWp = () => safe(() => { if (waypoint) localStorage.setItem(KEY, JSON.stringify(waypoint)); else localStorage.removeItem(KEY); });
  const size = () => Math.floor(Math.min(innerWidth * 0.92, innerHeight * 0.78, 760));

  let view = { x: 0, z: 0 };
  const toWorld = (sx, sy) => ({ x: view.x + (sx - cv.width / 2) / zoom, z: view.z + (sy - cv.height / 2) / zoom });
  const toScreen = (x, z) => [cv.width / 2 + (x - view.x) * zoom, cv.height / 2 + (z - view.z) * zoom];

  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect(), w = toWorld((e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height);
    if (waypoint && Math.hypot(w.x - waypoint.x, w.z - waypoint.z) < 8 / zoom) waypoint = null; else waypoint = { x: Math.round(w.x), z: Math.round(w.z) };
    saveWp();
  });
  cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); hover = toWorld((e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height); });
  cv.addEventListener('mouseleave', () => { hover = null; });
  root.addEventListener('wheel', e => { e.preventDefault(); api.zoomBy(e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });

  const api = {
    get open() { return open; },
    get waypoint() { return waypoint; },
    get zoom() { return zoom; },
    setWaypoint(w) { waypoint = w; saveWp(); },
    zoomBy(f) { zoom = Math.max(0.5, Math.min(8, zoom * f)); },
    toggle(on = !open) { open = on; root.hidden = !open; return open; },
    // Ghi vùng vừa quét của bản đồ nhỏ (canvas N×N, góc trên-trái ở block (x0, z0)) vào kho khám phá.
    record(canvas, x0, z0) {
      const n = canvas.width;
      for (let tz = Math.floor(z0 / TILE); tz <= Math.floor((z0 + n - 1) / TILE); tz++) for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + n - 1) / TILE); tx++) {
        const k = tx + ',' + tz; let t = tiles.get(k);
        if (!t) { t = document.createElement('canvas'); t.width = t.height = TILE; tiles.set(k, t); }
        t.getContext('2d').drawImage(canvas, x0 - tx * TILE, z0 - tz * TILE);
      }
    },
    exploredCount() { return tiles.size; },
    seeNpcs(list) { for (const e of list) if (e.kind === 'npc') seenNpcs.set(e.id, { x: e.x, z: e.z, name: e.name || 'NPC' }); },
    // v: { world, x, y, z, yaw, es, ps, uid, sites, home, region }
    draw(v) {
      if (!open) return;
      const S = size(); if (cv.width !== S) { cv.width = cv.height = S; cv.style.width = cv.style.height = S + 'px'; }
      view = { x: v.x, z: v.z };
      ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#05070b'; ctx.fillRect(0, 0, S, S);
      for (const [k, t] of tiles) { const [tx, tz] = k.split(',').map(Number), [sx, sy] = toScreen(tx * TILE, tz * TILE); if (sx > S || sy > S || sx + TILE * zoom < 0 || sy + TILE * zoom < 0) continue; ctx.drawImage(t, sx, sy, TILE * zoom + 0.5, TILE * zoom + 0.5); }
      ctx.strokeStyle = '#ffffff12'; ctx.lineWidth = 1;                                          // lưới 64 block
      for (let gx = Math.floor((view.x - S / 2 / zoom) / TILE) * TILE; gx < view.x + S / 2 / zoom; gx += TILE) { const [sx] = toScreen(gx, 0); ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, S); ctx.stroke(); }
      for (let gz = Math.floor((view.z - S / 2 / zoom) / TILE) * TILE; gz < view.z + S / 2 / zoom; gz += TILE) { const [, sy] = toScreen(0, gz); ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(S, sy); ctx.stroke(); }
      const pin = (x, z, draw, label, up = 9) => { const [sx, sy] = toScreen(x, z); if (sx < 4 || sy < 4 || sx > S - 4 || sy > S - 4) return; ctx.save(); ctx.translate(sx, sy); draw(); ctx.restore(); if (label && zoom >= 1.5) { ctx.font = '11px sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.textAlign = 'center'; ctx.strokeText(label, sx, sy - up); ctx.fillText(label, sx, sy - up); } };
      const sq = col => () => { ctx.rotate(Math.PI / 4); ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.fillRect(-5, -5, 10, 10); ctx.strokeRect(-5, -5, 10, 10); };
      const dot = (col, r = 4) => () => { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.stroke(); };
      for (const s of Object.values(v.sites || {})) pin(s.x, s.z, sq('#c58bf2'), 'Hầm ngục');
      for (const n of seenNpcs.values()) pin(n.x, n.z, dot('#52e0ff'), n.name);
      if (v.home) pin(v.home.x, v.home.z, () => { ctx.fillStyle = '#ff7ab8'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.fillRect(-6, -3, 12, 6); ctx.strokeRect(-6, -3, 12, 6); ctx.fillStyle = '#fff'; ctx.fillRect(-6, -3, 4, 6); }, 'Giường');
      for (const e of v.es) if (e.kind === 'boss') pin(e.x, e.z, dot('#ff2a2a', 6), 'Boss');
      for (const e of v.es) if (e.kind === 'mob') { const d = MOBS[e.type]; pin(e.x, e.z, dot(d && d.passive ? '#f1e27a' : '#ff4a3d', 3)); }
      for (const p of v.ps) if (p.uid !== v.uid && !p.dead) pin(p.x, p.z, dot('#ffffff', 4), p.name);
      if (waypoint) pin(waypoint.x, waypoint.z, () => { ctx.fillStyle = '#ff4fd8'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16); ctx.lineTo(10, -12); ctx.lineTo(0, -8); ctx.fill(); ctx.stroke(); }, 'Điểm đánh dấu', 22);
      const [px, py] = toScreen(v.x, v.z); ctx.save(); ctx.translate(px, py); ctx.rotate(-v.yaw);
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.restore();
      const reg = hover && v.world ? safe(() => { const id = v.world.regionAt(hover.x, hover.z), r = REGIONS.find(x => x.id === id); return r ? r.name : ''; }, '') : '';
      bar.textContent = 'Bản đồ' + (hover ? ` · ${Math.round(hover.x)}, ${Math.round(hover.z)}${reg ? ' · ' + reg : ''}` : '') + (waypoint ? ` · điểm đánh dấu cách ${Math.round(Math.hypot(waypoint.x - v.x, waypoint.z - v.z))} m` : '');
    },
  };
  return api;
}
