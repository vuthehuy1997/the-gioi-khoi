// Dựng ảnh chụp trạng thái gửi cho từng người chơi: mọi người chơi + thực thể trong tầm quan tâm. Làm tròn để gói tin nhỏ.
import { MOBS } from '../content/mobs.js';
export const INTEREST = 96;
const r2 = v => Math.round(v * 100) / 100;

export function snapshotFor(g, uid) {
  const me = g.player(uid);
  const ps = [...g.players.values()].map(p => ({ uid: p.uid, name: p.name, x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(p.yaw), pitch: r2(p.pitch),
    hp: p.hp, maxHp: p.maxHp, dead: p.dead, held: (p.inv[p.sel] || {}).id || null }));
  const es = [];
  for (const e of g.ents.values()) {
    if (me && Math.hypot(e.x - me.x, e.z - me.z) > INTEREST) continue;
    const o = { id: e.id, kind: e.kind, type: e.type || null, x: r2(e.x), y: r2(e.y), z: r2(e.z), yaw: r2(e.yaw || 0) };
    if (e.kind === 'mob' || e.kind === 'boss') {
      o.hp = Math.round(e.hp); o.maxHp = e.maxHp;
      if (e.kind === 'boss') o.phase = e.phase;
      else if (e.tamed) { o.tm = 1; if (e.love > 0) o.lv = 1; }                    // thú đã thuần: cờ nhỏ thay cho trạng thái cảnh giác
      else { o.st = e.state === 'chase' ? 2 : e.state === 'search' ? 3 : e.state === 'curious' || (e.alert || 0) > 0.15 ? 1 : 0; o.al = Math.round((e.alert || 0) * 10) / 10; }
      if (e.kind === 'mob' && MOBS[e.type] && MOBS[e.type].farm) { if (e.age < MOBS[e.type].adultSecs) o.ba = 1; if (e.shearCd > 0) o.sh = 1; }
    }
    else if (e.kind === 'npc') { o.npc = e.npc; o.name = e.name; }
    else if (e.kind === 'item') { o.item = e.item; o.n = e.n; }
    else if (e.kind === 'proj') { o.style = e.style || 'arrow'; o.yaw = r2(Math.atan2(-e.vx, -e.vz)); o.pit = r2(Math.atan2(e.vy, Math.hypot(e.vx, e.vz))); }
    es.push(o);
  }
  return { time: r2(g.time), ps, es };
}

// food: điểm đói 0..20; fx: hiệu ứng thức ăn/ngộ độc [{ id, left }] (giây còn lại, khách tự đếm lùi giữa các lần đẩy).
export const youOf = p => ({ hp: p.hp, maxHp: p.maxHp, dead: p.dead, inv: p.inv, sel: p.sel, armor: p.armor, home: p.home || null, food: p.food, fx: p.fxView || [] });
