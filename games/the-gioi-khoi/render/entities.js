// Hiển thị thực thể (người chơi, quái, boss, NPC, vật phẩm, đạn) bằng mô hình hộp màu, nội suy giữa hai ảnh chụp.
import { MOBS } from '../content/mobs.js';
import { BOSSES } from '../content/bosses.js';
import { NPCS } from '../content/npcs.js';

const hashColor = (s, l = 55) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h},60%,${l}%)`; };

export function createEntityView(scene) {
  const T = scene.THREE, group = new T.Group(); scene.scene.add(group);
  const objs = new Map(), tags = new Map(), rings = [];
  const mats = new Map();
  const mat = c => { if (!mats.has(c)) mats.set(c, new T.MeshBasicMaterial({ color: c })); return mats.get(c); };
  const box = (w, h, d, color, x = 0, y = 0, z = 0) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); return m; };

  function tag(text, color = '#fff') {
    const k = text + color;
    if (!tags.has(k)) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 48;
      const x = c.getContext('2d'); x.font = 'bold 28px sans-serif'; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = '#000c'; x.fillStyle = color;
      x.strokeText(text, 128, 34); x.fillText(text, 128, 34);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
      tags.set(k, new T.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    }
    const s = new T.Sprite(tags.get(k)); s.scale.set(2.4, 0.45, 1); s.renderOrder = 10; return s;
  }

  function make(e) {
    const g = new T.Group(); g.userData = { parts: [], base: {} };
    if (e.kind === 'player') {
      const c = hashColor(e.uid || e.name, 45);
      g.add(box(0.6, 0.7, 0.35, c, 0, 1.0, 0), box(0.5, 0.5, 0.5, '#e8c39e', 0, 1.6, 0), box(0.25, 0.7, 0.3, '#33384a', -0.15, 0.35, 0), box(0.25, 0.7, 0.3, '#33384a', 0.15, 0.35, 0));
      const t = tag(e.name || '?'); t.position.y = 2.2; g.add(t);
    } else if (e.kind === 'mob' || e.kind === 'boss') {
      const d = e.kind === 'boss' ? BOSSES[e.type] : MOBS[e.type]; const w = d.w, h = d.h, col = d.color;
      g.add(box(w, h * 0.6, w * 0.9, col, 0, h * 0.5, 0), box(w * 0.7, h * 0.35, w * 0.7, col, 0, h * 0.85, -w * 0.25), box(w * 0.5, h * 0.2, w * 0.2, '#111', 0, h * 0.88, -w * 0.62));
      g.add(box(w * 0.25, h * 0.3, w * 0.25, col, -w * 0.3, h * 0.15, 0), box(w * 0.25, h * 0.3, w * 0.25, col, w * 0.3, h * 0.15, 0));
      const t = tag(d.name, e.kind === 'boss' ? '#ffd35a' : '#ffb0a8'); t.position.y = h + 0.6; t.scale.set(e.kind === 'boss' ? 3.6 : 2.4, e.kind === 'boss' ? 0.68 : 0.45, 1); g.add(t);
    } else if (e.kind === 'npc') {
      const c = NPCS[e.npc] ? NPCS[e.npc].color : '#caa';
      g.add(box(0.6, 0.8, 0.4, c, 0, 1.0, 0), box(0.5, 0.5, 0.5, '#e8c39e', 0, 1.65, 0), box(0.5, 0.15, 0.5, '#6a4a2a', 0, 1.95, 0), box(0.25, 0.6, 0.3, '#5a4a3a', -0.15, 0.3, 0), box(0.25, 0.6, 0.3, '#5a4a3a', 0.15, 0.3, 0));
      const t = tag('❗ ' + (e.name || 'NPC'), '#9fe3ff'); t.position.y = 2.5; g.add(t);
    } else if (e.kind === 'item') {
      g.add(box(0.28, 0.28, 0.28, hashColor(e.item, 60), 0, 0.2, 0));
    } else { g.add(box(0.22, 0.22, 0.22, '#ffcf5a', 0, 0, 0)); }
    group.add(g);
    return g;
  }

  return {
    group,
    // list: [{ key, kind, x, y, z, yaw, ... }]; t: giây
    update(list, t) {
      const seen = new Set();
      for (const e of list) {
        seen.add(e.key);
        let o = objs.get(e.key);
        if (!o) { o = { g: make(e), px: e.x, pz: e.z, hp: e.hp }; objs.set(e.key, o); }
        const g = o.g, moving = Math.hypot(e.x - o.px, e.z - o.pz) > 0.01;
        g.position.set(e.x, e.y, e.z); g.rotation.y = e.yaw || 0;
        if (e.kind === 'item') { g.rotation.y = t * 2; g.position.y = e.y + 0.1 + Math.sin(t * 3) * 0.08; }
        else if (moving) g.position.y += Math.abs(Math.sin(t * 10)) * 0.06;
        if (e.hp !== undefined && o.hp !== undefined && e.hp < o.hp) o.flash = 0.18;
        o.hp = e.hp; o.px = e.x; o.pz = e.z;
        if (o.flash > 0) { o.flash -= 0.016; g.scale.setScalar(1.12); } else g.scale.setScalar(1);
      }
      for (const [k, o] of [...objs]) if (!seen.has(k)) { group.remove(o.g); objs.delete(k); }
      for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= 0.016; r.m.material.opacity = 0.25 + 0.4 * (1 - Math.max(0, r.life) / r.total); if (r.life <= 0) { group.remove(r.m); rings.splice(i, 1); } }
    },
    telegraph(x, y, z, r, time) {
      const m = new T.Mesh(new T.CircleGeometry(r, 40), new T.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.08, z); group.add(m); rings.push({ m, life: time, total: time });
    },
    count: () => objs.size,
    clear() { for (const o of objs.values()) group.remove(o.g); objs.clear(); },
  };
}
