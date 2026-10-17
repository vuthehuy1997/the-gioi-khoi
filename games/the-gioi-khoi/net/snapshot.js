// Dựng ảnh chụp trạng thái gửi cho từng người chơi: mọi người chơi + thực thể trong tầm quan tâm. Làm tròn để gói tin nhỏ.
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
    if (e.kind === 'mob' || e.kind === 'boss') { o.hp = Math.round(e.hp); o.maxHp = e.maxHp; if (e.kind === 'boss') o.phase = e.phase; }
    else if (e.kind === 'npc') { o.npc = e.npc; o.name = e.name; }
    else if (e.kind === 'item') { o.item = e.item; o.n = e.n; }
    else if (e.kind === 'proj') { o.style = e.style || 'arrow'; o.yaw = r2(Math.atan2(-e.vx, -e.vz)); o.pit = r2(Math.atan2(e.vy, Math.hypot(e.vx, e.vz))); }
    es.push(o);
  }
  return { time: r2(g.time), ps, es };
}

export const youOf = p => ({ hp: p.hp, maxHp: p.maxHp, dead: p.dead, inv: p.inv, sel: p.sel });
