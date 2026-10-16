// Hiển thị thực thể (người chơi, quái, boss, NPC, vật phẩm, đạn) bằng mô hình hộp có khớp chân tay, nội suy giữa hai ảnh chụp.
// Chân tay đung đưa theo quãng đường đi được; hụt máu thì nháy đỏ; có bóng tròn dưới chân; NPC quay mặt về người chơi gần nhất.
import { MOBS } from '../content/mobs.js';
import { BOSSES } from '../content/bosses.js';
import { NPCS } from '../content/npcs.js';

const hashColor = (s, l = 55) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h},60%,${l}%)`; };

export function createEntityView(scene) {
  const T = scene.THREE, group = new T.Group(); scene.scene.add(group);
  const objs = new Map(), tags = new Map(), rings = [], mats = new Map();
  const mat = c => { if (!mats.has(c)) mats.set(c, new T.MeshBasicMaterial({ color: c })); return mats.get(c); };
  const flashMat = new T.MeshBasicMaterial({ color: '#ff4040' });
  const shadowMat = new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.32, depthWrite: false });

  const box = (w, h, d, color, x = 0, y = 0, z = 0) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); return m; };
  // khớp: nhóm đặt tại điểm xoay (đỉnh chi), hộp treo xuống dưới
  const limb = (w, h, d, color, x, y, z) => { const g = new T.Group(); g.position.set(x, y, z); g.add(box(w, h, d, color, 0, -h / 2, 0)); return g; };

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
    const g = new T.Group(), rig = { legs: [], arms: [], head: null, body: null };
    let shadowR = 0.5;
    if (e.kind === 'player') {
      const c = hashColor(e.uid || e.name, 45);
      rig.body = box(0.6, 0.72, 0.34, c, 0, 1.06, 0); g.add(rig.body);
      rig.head = limb(0.5, 0.5, 0.5, '#e8c39e', 0, 1.78, 0); g.add(rig.head);
      for (const [x, ph] of [[-0.16, 0], [0.16, Math.PI]]) { const l = limb(0.26, 0.7, 0.3, '#33384a', x, 0.7, 0); g.add(l); rig.legs.push({ g: l, ph, amp: 0.8 }); }
      for (const [x, ph] of [[-0.43, Math.PI], [0.43, 0]]) { const a = limb(0.22, 0.68, 0.26, c, x, 1.4, 0); g.add(a); rig.arms.push({ g: a, ph, amp: 0.7 }); }
      const t = tag(e.name || '?'); t.position.y = 2.4; g.add(t);
    } else if (e.kind === 'mob' || e.kind === 'boss') {
      const d = e.kind === 'boss' ? BOSSES[e.type] : MOBS[e.type], w = d.w, h = d.h, col = d.color, biped = h > w * 1.6;
      shadowR = w * 0.75;
      if (biped) {                                                          // người/xương/tượng
        rig.body = box(w, h * 0.42, w * 0.55, col, 0, h * 0.58, 0); g.add(rig.body);
        rig.head = limb(w * 0.8, h * 0.24, w * 0.8, col, 0, h * 0.97, 0); rig.head.add(box(w * 0.5, h * 0.05, w * 0.1, '#111', 0, -h * 0.12, -w * 0.4)); g.add(rig.head);
        for (const [x, ph] of [[-w * 0.22, 0], [w * 0.22, Math.PI]]) { const l = limb(w * 0.36, h * 0.38, w * 0.4, col, x, h * 0.38, 0); g.add(l); rig.legs.push({ g: l, ph, amp: 0.8 }); }
        for (const [x, ph] of [[-w * 0.66, Math.PI], [w * 0.66, 0]]) { const a = limb(w * 0.3, h * 0.4, w * 0.34, col, x, h * 0.78, 0); g.add(a); rig.arms.push({ g: a, ph, amp: 0.7 }); }
      } else {                                                              // bốn chân
        rig.body = box(w * 0.85, h * 0.5, w * 1.5, col, 0, h * 0.6, 0); g.add(rig.body);
        rig.head = limb(w * 0.62, h * 0.46, w * 0.55, col, 0, h * 0.88, -w * 0.8); rig.head.add(box(w * 0.42, h * 0.07, w * 0.08, '#111', 0, -h * 0.17, -w * 0.28)); g.add(rig.head);
        for (const [x, z, ph] of [[-w * 0.3, -w * 0.55, 0], [w * 0.3, -w * 0.55, Math.PI], [-w * 0.3, w * 0.55, Math.PI], [w * 0.3, w * 0.55, 0]]) { const l = limb(w * 0.22, h * 0.36, w * 0.22, col, x, h * 0.36, z); g.add(l); rig.legs.push({ g: l, ph, amp: 0.85 }); }
      }
      const t = tag(d.name, e.kind === 'boss' ? '#ffd35a' : '#ffb0a8'); t.position.y = h + 0.7; if (e.kind === 'boss') t.scale.set(3.6, 0.68, 1); g.add(t);
    } else if (e.kind === 'npc') {
      const c = NPCS[e.npc] ? NPCS[e.npc].color : '#caa';
      rig.body = box(0.6, 0.8, 0.4, c, 0, 1.08, 0); g.add(rig.body);
      rig.head = limb(0.5, 0.5, 0.5, '#e8c39e', 0, 1.8, 0); rig.head.add(box(0.54, 0.14, 0.54, '#6a4a2a', 0, 0.02, 0)); g.add(rig.head);
      for (const [x, ph] of [[-0.16, 0], [0.16, Math.PI]]) { const l = limb(0.26, 0.7, 0.3, '#5a4a3a', x, 0.7, 0); g.add(l); rig.legs.push({ g: l, ph, amp: 0.4 }); }
      for (const x of [-0.43, 0.43]) { const a = limb(0.22, 0.7, 0.26, c, x, 1.46, 0); g.add(a); rig.arms.push({ g: a, ph: 0, amp: 0.05 }); }
      const t = tag('❗ ' + (e.name || 'NPC'), '#9fe3ff'); t.position.y = 2.6; g.add(t);
    } else if (e.kind === 'item') {
      g.add(box(0.28, 0.28, 0.28, hashColor(e.item, 60), 0, 0.2, 0)); shadowR = 0.2;
    } else { g.add(box(0.22, 0.22, 0.22, '#ffcf5a', 0, 0, 0)); shadowR = 0; }
    if (shadowR) { const s = new T.Mesh(new T.CircleGeometry(shadowR, 14), shadowMat); s.rotation.x = -Math.PI / 2; s.position.y = 0.03; s.renderOrder = 1; g.add(s); g.userData.shadow = s; }
    group.add(g);
    return { g, rig, px: e.x, pz: e.z, phase: 0, speed: 0 };
  }

  const setMaterials = (g, flash) => g.traverse(m => { if (m.isMesh && m !== g.userData.shadow) { if (!m.userData.orig) m.userData.orig = m.material; m.material = flash ? flashMat : m.userData.orig; } });

  return {
    group,
    // list: [{ key, kind, x, y, z, yaw, pitch?, hp? }]; t: giây; dt: giây; players: [{x, z}] cho NPC nhìn theo
    update(list, t, dt = 0.016, players = []) {
      const seen = new Set();
      for (const e of list) {
        seen.add(e.key);
        let o = objs.get(e.key);
        if (!o) { o = make(e); o.hp = e.hp; objs.set(e.key, o); }
        const g = o.g, moved = Math.hypot(e.x - o.px, e.z - o.pz), v = dt > 0 ? moved / dt : 0;
        o.speed += (Math.min(v, 8) - o.speed) * Math.min(1, dt * 10);
        o.phase += moved * 2.4; o.px = e.x; o.pz = e.z;
        g.position.set(e.x, e.y, e.z); g.rotation.y = e.yaw || 0;
        if (e.kind === 'item') { g.rotation.y = t * 2; g.position.y = e.y + 0.1 + Math.sin(t * 3) * 0.08; if (g.userData.shadow) g.userData.shadow.position.y = -0.07; }
        const k = Math.min(1, o.speed / 2.2);
        for (const l of o.rig.legs) l.g.rotation.x = Math.sin(o.phase + l.ph) * l.amp * k;
        for (const a of o.rig.arms) a.g.rotation.x = Math.sin(o.phase + a.ph) * a.amp * k + (o.swing > 0 ? -1.4 * (o.swing / 0.25) : 0);
        if (o.rig.body && k > 0.05) o.rig.body.position.y += Math.abs(Math.sin(o.phase)) * 0.015;
        if (o.rig.head && e.pitch !== undefined) o.rig.head.rotation.x = -e.pitch * 0.9;
        if (e.kind === 'npc') {                                              // quay mặt về người chơi gần nhất
          let best = null, bd = 36; for (const p of players) { const d2 = (p.x - e.x) ** 2 + (p.z - e.z) ** 2; if (d2 < bd) { bd = d2; best = p; } }
          if (best) g.rotation.y = Math.atan2(-(best.x - e.x), -(best.z - e.z));
        }
        if (e.hp !== undefined && o.hp !== undefined && e.hp < o.hp) o.flash = 0.16;
        o.hp = e.hp;
        if (o.swing > 0) { o.swing -= dt; if (o.rig.body && !o.rig.arms.length) g.rotation.x = -0.25 * (o.swing / 0.25); } else if (g.rotation.x) g.rotation.x = 0;
        if (o.flash > 0) { o.flash -= dt; if (!o.flashing) { setMaterials(g, true); o.flashing = true; } } else if (o.flashing) { setMaterials(g, false); o.flashing = false; }
      }
      for (const [k, o] of [...objs]) if (!seen.has(k)) { group.remove(o.g); objs.delete(k); }
      for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= dt; r.m.material.opacity = 0.25 + 0.4 * (1 - Math.max(0, r.life) / r.total); if (r.life <= 0) { group.remove(r.m); rings.splice(i, 1); } }
    },
    swing(key) { const o = objs.get(key); if (o) o.swing = 0.25; },
    // kiểm tra/test: trạng thái khớp của một thực thể
    rigOf(key) { const o = objs.get(key); return o && { legs: o.rig.legs.map(l => l.g.rotation.x), arms: o.rig.arms.map(a => a.g.rotation.x), flashing: !!o.flashing, hasShadow: !!o.g.userData.shadow }; },
    telegraph(x, y, z, r, time) {
      const m = new T.Mesh(new T.CircleGeometry(r, 40), new T.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.08, z); group.add(m); rings.push({ m, life: time, total: time });
    },
    count: () => objs.size,
    clear() { for (const o of objs.values()) group.remove(o.g); objs.clear(); },
  };
}
