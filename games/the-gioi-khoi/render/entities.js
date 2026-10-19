// Hiển thị thực thể: người chơi, quái, boss, NPC bằng mô hình có skin + xương (một lệnh vẽ mỗi thực thể, geometry/vật liệu dùng chung);
// vật phẩm rơi là tấm icon xoay; đạn có kiểu riêng. Bóng dưới chân vẽ bằng MỘT InstancedMesh. Thẻ tên chỉ hiện khi ở gần.
import { createModelLib, modelIdFor, animate } from './models/index.js';
import { MOBS } from '../content/mobs.js';
import { BOSSES } from '../content/bosses.js';

const MAX_SHADOWS = 128;

export function createEntityView(scene, { iconCanvas = null } = {}) {
  const T = scene.THREE, group = new T.Group(); scene.scene.add(group);
  const lib = createModelLib(T);
  const objs = new Map(), tagMats = new Map(), rings = [], itemMats = new Map(), dead = new Set(), indMats = {};
  let tagsShown = 0;

  // bóng: một InstancedMesh cho tất cả
  const shadowGeo = new T.CircleGeometry(1, 16); shadowGeo.rotateX(-Math.PI / 2);
  const shadows = new T.InstancedMesh(shadowGeo, new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }), MAX_SHADOWS);
  shadows.frustumCulled = false; shadows.renderOrder = 1; shadows.count = 0; group.add(shadows);
  const mtx = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3();

  function tagMat(text, color) {
    const k = text + color;
    if (!tagMats.has(k)) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 48;
      const x = c.getContext('2d'); x.font = 'bold 28px sans-serif'; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = '#000c'; x.fillStyle = color;
      x.strokeText(text, 128, 34); x.fillText(text, 128, 34);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
      tagMats.set(k, new T.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    }
    return tagMats.get(k);
  }
  function makeTag(e, h) {
    const boss = e.kind === 'boss', text = e.kind === 'npc' ? '❗ ' + (e.name || 'NPC') : e.kind === 'player' ? (e.name || '?') : boss ? BOSSES[e.type].name : MOBS[e.type] ? MOBS[e.type].name : '';
    if (!text) return null;
    const s = new T.Sprite(tagMat(text, boss ? '#ffd35a' : e.kind === 'npc' ? '#9fe3ff' : e.kind === 'player' ? '#ffffff' : '#ffb0a8'));
    s.scale.set(boss ? 3.6 : 2.4, boss ? 0.68 : 0.45, 1); s.position.y = h + 0.5; s.renderOrder = 10; s.visible = false; return s;
  }

  // Dấu cảnh giác trên đầu quái: ? vàng (nghi ngờ, đậm dần theo thanh cảnh giác), ! đỏ (đã thấy, đang đuổi), ? cam (đang lục soát).
  function indicator(kind) {
    if (!indMats[kind]) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); x.font = 'bold 56px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 7; x.strokeStyle = '#000d';
      const ch = kind === 'chase' ? '!' : '?'; x.strokeText(ch, 32, 34); x.fillStyle = kind === 'chase' ? '#ff3b30' : kind === 'search' ? '#ff9f0a' : '#ffd60a'; x.fillText(ch, 32, 34);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
      indMats[kind] = new T.SpriteMaterial({ map: t, depthTest: false, transparent: true });
    }
    const s = new T.Sprite(indMats[kind].clone()); s.renderOrder = 11; s.scale.set(0.6, 0.6, 1); return s;
  }

  function itemObject(e) {
    const g = new T.Group();
    if (!itemMats.has(e.item)) {
      const cv = iconCanvas && iconCanvas(e.item);
      if (cv) { const t = new T.CanvasTexture(cv); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.colorSpace = T.SRGBColorSpace; itemMats.set(e.item, new T.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, side: T.DoubleSide })); }
      else itemMats.set(e.item, new T.MeshBasicMaterial({ color: '#ffd35a' }));
    }
    const m = new T.Mesh(new T.PlaneGeometry(0.5, 0.5), itemMats.get(e.item)); m.position.y = 0.35; g.add(m); g.userData.spin = m;
    return g;
  }

  const PROJ = {
    arrow: () => { const g = new T.Group(); const sh = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.7), new T.MeshBasicMaterial({ color: '#8a6a3c' })), tip = new T.Mesh(new T.BoxGeometry(0.09, 0.09, 0.14), new T.MeshBasicMaterial({ color: '#cfd3da' })); tip.position.z = -0.4; g.add(sh, tip); return g; },
    ice: () => new T.Mesh(new T.OctahedronGeometry(0.2), new T.MeshBasicMaterial({ color: '#9ff0ff' })),
    fire: () => { const g = new T.Group(); g.add(new T.Mesh(new T.IcosahedronGeometry(0.2), new T.MeshBasicMaterial({ color: '#ff7a1c' })), new T.Mesh(new T.IcosahedronGeometry(0.11), new T.MeshBasicMaterial({ color: '#fff2a0' }))); return g; },
    venom: () => new T.Mesh(new T.IcosahedronGeometry(0.2), new T.MeshBasicMaterial({ color: '#7ad35a' })),
  };

  function create(e) {
    const o = { px: e.x, pz: e.z, phase: Math.random() * 6, speed: 0, hp: e.hp, flash: 0, swing: 0, dying: 0, kind: e.kind, radius: 0.4 };
    const g = new T.Group(); o.g = g;
    const mid = modelIdFor(e);
    if (mid) {
      o.rig = lib.spawn(mid); o.lib = o.rig.lib; g.add(o.rig.mesh);
      const h = o.lib.model.scale * 2.1; o.h = e.kind === 'boss' ? o.lib.model.scale * 2.4 : h;
      const d = e.kind === 'boss' ? BOSSES[e.type] : e.kind === 'mob' ? MOBS[e.type] : null;
      o.radius = d ? d.w * 0.75 : 0.45; o.tag = makeTag(e, o.h); if (o.tag) g.add(o.tag);
    } else if (e.kind === 'item') { g.add(itemObject(e)); o.radius = 0.2; o.item = true; }
    else { const mk = PROJ[e.style] || PROJ.arrow; o.proj = true; g.add(mk()); o.radius = 0; }
    group.add(g);
    return o;
  }

  const setFlash = (o, on) => { if (o.rig && o.flashing !== on) { o.rig.mesh.material = on ? o.lib.flash : o.lib.material; o.flashing = on; } };

  return {
    group, lib,
    setLight(l) { lib.setLight(l); },
    // list: [{ key, kind, type, x, y, z, yaw, pitch?, hp?, ... }]; cam: vị trí camera để quyết định hiện thẻ tên / ẩn xa.
    update(list, t, dt = 0.016, players = [], cam = null) {
      const seen = new Set(); let sh = 0; tagsShown = 0;
      for (const e of list) {
        seen.add(e.key);
        let o = objs.get(e.key);
        if (!o) { o = create(e); objs.set(e.key, o); }
        const g = o.g, dist = cam ? Math.hypot(e.x - cam.x, e.z - cam.z) : 0;
        g.visible = dist < 110;
        const moved = Math.hypot(e.x - o.px, e.z - o.pz), v = dt > 0 ? moved / dt : 0;
        o.speed += (Math.min(v, 8) - o.speed) * Math.min(1, dt * 10);
        o.phase += moved * (o.lib ? 2.4 / Math.max(0.6, o.lib.model.scale) : 2.4); o.px = e.x; o.pz = e.z;
        g.position.set(e.x, e.y, e.z);
        if (o.proj) { g.rotation.set(-(e.pit || 0), e.yaw || 0, 0, 'YXZ'); continue; }
        if (o.item) { g.rotation.y = t * 2; g.position.y = e.y + 0.05 + Math.sin(t * 3 + e.key.length) * 0.06; }
        else g.rotation.y = e.yaw || 0;
        if (e.kind === 'npc' && players.length) {                               // quay mặt về người chơi gần nhất
          let best = null, bd = 49; for (const p of players) { const d2 = (p.x - e.x) ** 2 + (p.z - e.z) ** 2; if (d2 < bd) { bd = d2; best = p; } }
          if (best) g.rotation.y = Math.atan2(-(best.x - e.x), -(best.z - e.z));
        }
        if (o.rig && g.visible) {
          const far = dist > 56;
          if (!far || ((t * 60) | 0) % 3 === 0) animate(o.rig, { phase: o.phase, k: Math.min(1, o.speed / 2.2), t, pitch: e.pitch || 0, swing: o.swing > 0 ? o.swing / 0.25 : 0 });
          if (e.hp !== undefined && o.hp !== undefined && e.hp < o.hp) o.flash = 0.16;
          o.hp = e.hp;
          if (o.flash > 0) { o.flash -= dt; setFlash(o, true); } else setFlash(o, false);
          if (o.swing > 0) o.swing -= dt;
          if (e.kind === 'mob') {                                                       // dấu cảnh giác
            const st = e.st | 0, want = st === 2 ? 'chase' : st === 3 ? 'search' : st === 1 ? 'curious' : null;
            if (want && dist < 30) {
              if (!o.ind || o.indKind !== want) { if (o.ind) g.remove(o.ind); o.ind = indicator(want); o.indKind = want; g.add(o.ind); }
              o.ind.position.y = o.h + 1.15 + Math.sin(t * 7) * (st === 2 ? 0.08 : 0.03);
              o.ind.material.opacity = st === 1 ? 0.3 + 0.7 * Math.min(1, (e.al || 0)) : 1; o.ind.visible = true;
              const pulse = st === 2 ? 0.62 + Math.sin(t * 12) * 0.06 : 0.55; o.ind.scale.set(pulse, pulse, 1);
            } else if (o.ind) o.ind.visible = false;
          }
          if (o.tag) { const near = e.kind === 'boss' ? dist < 70 : e.kind === 'mob' ? dist < 16 : dist < 30; o.tag.visible = near && tagsShown < 12; if (o.tag.visible) tagsShown++; }
        }
        if (o.radius && g.visible && sh < MAX_SHADOWS) { ps.set(e.x, e.y + 0.03, e.z); sc.set(o.radius, 1, o.radius); mtx.compose(ps, q, sc); shadows.setMatrixAt(sh++, mtx); }
      }
      // thực thể biến mất: quái/boss ngã ra rồi mới xoá
      for (const [k, o] of [...objs]) if (!seen.has(k)) {
        if ((o.kind === 'mob' || o.kind === 'boss') && o.rig && o.dying < 1 && !dead.has(k)) { dead.add(k); o.dying = 0.6; o.swing = 0; setFlash(o, true); seen.add(k); objs.set(k, o); }
        else if (dead.has(k) && o.dying > 0) {
          o.dying -= dt; const f = 1 - Math.max(0, o.dying) / 0.6;
          o.g.rotation.z = -Math.PI / 2 * Math.min(1, f * 1.6); o.g.position.y -= f * 0.1; if (o.tag) o.tag.visible = false;
          if (sh < MAX_SHADOWS) { ps.set(o.g.position.x, o.g.position.y + 0.03, o.g.position.z); sc.set(o.radius, 1, o.radius); mtx.compose(ps, q, sc); shadows.setMatrixAt(sh++, mtx); }
          if (o.dying <= 0) { group.remove(o.g); objs.delete(k); dead.delete(k); }
        } else { group.remove(o.g); objs.delete(k); dead.delete(k); }
      }
      shadows.count = sh; shadows.instanceMatrix.needsUpdate = true;
      for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= dt; r.m.material.opacity = 0.25 + 0.4 * (1 - Math.max(0, r.life) / r.total); if (r.life <= 0) { group.remove(r.m); rings.splice(i, 1); } }
    },
    swing(key) { const o = objs.get(key); if (o) o.swing = 0.25; },
    // dùng cho test: khớp xương, nháy đỏ, số lệnh vẽ của thực thể
    rigOf(key) {
      const o = objs.get(key); if (!o || !o.rig) return null;
      const by = role => o.lib.model.bones.filter(b => b.role === role).map(b => o.rig.bones[b.id].rotation.x);
      return { legs: by('leg'), arms: [...by('arm'), ...by('armstill')], flashing: !!o.flashing, hasShadow: shadows.count > 0, drawCalls: 1, bones: o.lib.model.bones.length, dying: dead.has(key) };
    },
    telegraph(x, y, z, r, time) {
      const m = new T.Mesh(new T.CircleGeometry(r, 40), new T.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.08, z); group.add(m); rings.push({ m, life: time, total: time });
    },
    count: () => objs.size,
    shadowCount: () => shadows.count,
    clear() { for (const o of objs.values()) group.remove(o.g); objs.clear(); dead.clear(); },
  };
}
