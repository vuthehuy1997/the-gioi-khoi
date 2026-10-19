// Giác quan của quái: nhìn (nón nhìn theo hướng quay mặt, đường ngắm bị tường/cây che), nghe (tiếng động), nhớ (chỗ thấy cuối).
// Quái không đuổi chỉ vì đứng gần: phải NHÌN THẤY (hoặc nghe thấy) người chơi, và việc phát hiện mất thời gian (thanh cảnh giác).
// Trạng thái: idle -> curious (nghe thấy, đi kiểm tra) -> chase (đã thấy, đuổi) -> search (mất dấu, lục soát) -> idle.
import { MOBS } from '../content/mobs.js';
import { B } from '../world/blocks.js';
import { isNight } from './daynight.js';

const TAU = Math.PI * 2;
export const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const yawTo = (dx, dz) => Math.atan2(-dx, -dz);                         // yaw 0 là hướng -z
export const turnToward = (cur, want, step) => cur + Math.max(-step, Math.min(step, angDiff(want, cur)));

export const PACK_RADIUS = 20, MEMORY_S = 5, SEARCH_S = 5, NOISE_MEMORY_S = 12;

// Người chơi nhìn thấy được bởi quái e (loại d)? Trả { p, dist, range, close } của người gần nhất nhìn thấy, hoặc null.
export function scan(g, e, d) {
  let best = null, bd = Infinity;
  const night = isNight(g.time);
  for (const p of g.players.values()) {
    if (p.dead) continue;
    const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz);
    if (Math.abs(p.y - e.y) > 14) continue;
    const locked = e.state === 'chase' && e.target === p.uid;                              // đang theo dõi mục tiêu này: để mắt kỹ hơn
    let range = d.sight * (p.sneak ? 0.5 : 1) * (p.sprint ? 1.35 : 1) * (locked ? 1.2 : 1);
    if (g.world.get(p.x, p.y + 1.5, p.z) === B.WATER) range *= 0.4;                    // ngụp dưới nước: khó thấy
    if (night && d.when === 'day') range *= 0.6;                                         // thú ban ngày kém nhìn ban đêm
    if (dist > range) continue;
    const close = dist <= (d.close ?? 2) * (p.sneak ? 0.6 : 1);                          // vùng cảm nhận sát người: không cần quay mặt
    if (!close && Math.abs(angDiff(yawTo(dx, dz), e.yaw)) > Math.min(300, (d.fov ?? 110) * (locked ? 1.8 : 1)) * Math.PI / 360) continue;
    if (!g.world.lineClear(e.x, e.y + e.h * 0.85, e.z, p.x, p.y + (p.sneak ? 1.25 : 1.55), p.z)) continue;
    if (dist < bd) { bd = dist; best = { p, dist, range, close }; }
  }
  return best;
}

export function startChase(g, e, d, p) {
  e.state = 'chase'; e.target = p.uid; e.lastSeen = { x: p.x, y: p.y, z: p.z }; e.lostT = 0; e.alert = 1; e.investigate = null;
  if (d.pack) for (const o of g.ents.values()) {                                         // sói tru gọi đồng bọn
    if (o === e || o.kind !== 'mob' || o.type !== e.type || o.state === 'chase') continue;
    if (Math.hypot(o.x - e.x, o.z - e.z) <= PACK_RADIUS) { o.investigate = { x: p.x, z: p.z, t: g.time }; o.alert = Math.max(o.alert || 0, 0.6); }
  }
}

// Bị người chơi đánh: biết ngay kẻ tấn công ở đâu, kể cả khi bị đánh từ sau lưng.
export function aggro(g, e, src) {
  if (!src || !src.uid) return;
  const d = MOBS[e.type]; if (!d) return;
  startChase(g, e, d, src);
}

// Tiếng động tại (x, y, z) lan trong bán kính radius (nhân hệ số thính giác của từng loài).
export function makeNoise(g, x, y, z, radius) {
  for (const e of g.ents.values()) {
    if (e.kind !== 'mob' || e.state === 'chase') continue;
    const d = MOBS[e.type]; if (!d) continue;
    if (Math.abs(e.y - y) > 14) continue;
    if (Math.hypot(e.x - x, e.z - z) <= radius * (d.hearing ?? 1)) { e.investigate = { x, z, t: g.time }; e.alert = Math.max(e.alert || 0, 0.45); }
  }
}

const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Cập nhật nhận thức của một quái; trả { mode, target, seen, goal, suspect }.
export function perceive(g, e, d, dt) {
  if (e.state === undefined) { e.state = 'idle'; e.alert = 0; e.lostT = 0; e.searchT = 0; e.pT = 0; }
  e.pT -= dt;
  if (!(e.pT > 0)) { e.pT = 0.15 + (e.id % 5) * 0.01; e.vis = scan(g, e, d); }
  const vis = e.vis && !e.vis.p.dead ? e.vis : null;
  let suspect = false;

  if (vis) {
    const rate = vis.close ? 6 : 0.6 + 2.2 * Math.max(0, 1 - vis.dist / vis.range);      // gần thì nhận ra nhanh, xa thì chậm
    e.alert = Math.min(1, e.alert + rate * dt);
    if (e.state === 'chase') { if (vis.p.uid === e.target) { e.lastSeen = { x: vis.p.x, y: vis.p.y, z: vis.p.z }; e.lostT = 0; } }
    else if (e.alert >= 1) startChase(g, e, d, vis.p);
    else { suspect = true; e.watch = { x: vis.p.x, z: vis.p.z }; }                        // đang nghi ngờ: đứng lại, quay về phía đó
  } else if (e.state !== 'chase') e.alert = Math.max(0, e.alert - dt * 0.3);

  if (e.state === 'chase') {
    const tp = g.player(e.target);
    if (!tp || tp.dead || dist2(e, tp) > d.sight * 2.4) { e.state = 'idle'; e.target = null; e.alert = 0; }
    else if (!(vis && vis.p.uid === e.target)) {
      e.lostT += dt;
      if (e.lastSeen && (dist2(e, e.lastSeen) < 1.8 || e.lostT > MEMORY_S + 3)) { e.state = 'search'; e.searchT = SEARCH_S; e.alert = 0.5; }
    }
  } else if (e.state === 'search') {
    e.searchT -= dt;
    if (e.searchT <= 0) { e.state = 'idle'; e.target = null; e.alert = 0; }
  } else if (e.investigate) {
    if (g.time - e.investigate.t > NOISE_MEMORY_S) e.investigate = null;
    else if (dist2(e, e.investigate) < 1.8) { e.investigate = null; e.state = 'search'; e.searchT = 3; }
    else e.state = 'curious';
  } else if (e.state === 'curious') e.state = 'idle';

  const target = e.state === 'chase' ? g.player(e.target) : null;
  const goal = e.state === 'chase' ? e.lastSeen : e.state === 'curious' && e.investigate ? e.investigate : null;
  return { mode: e.state, target, seen: !!(vis && target && vis.p.uid === e.target), goal, suspect };
}
