// Ngủ qua đêm: bấm chuột phải vào giường lúc trời tối. Khi mọi người chơi còn sống đều đang ngủ thì trời sáng.
import { B } from '../world/blocks.js';
import { MOBS } from '../content/mobs.js';
import { isNight, DAY_LEN } from './daynight.js';
import { setWeather } from './weather.js';
import * as farm from './farm.js';

export const SLEEP_FADE = 2.5;                 // giây nằm xuống trước khi trời sáng
export const BED_DANGER = 12;                  // quái thù địch trong bán kính này thì không ngủ được
const MAX_BED_DIST = 4.5;

export function trySleep(g, p, a) {
  const say = text => g.emit(p.uid, { t: 'toast', text });
  if (p.sleep) { wake(g, p, false); return { ok: true, woke: true }; }
  if (!isNight(g.time)) { say('Chỉ ngủ được vào ban đêm. Đã đặt điểm hồi sinh ở giường này.'); return { ok: true, reason: 'day' }; }
  if (g.time - (p.lastHurt === undefined ? -99 : p.lastHurt) < 8) { say('Bạn vừa bị tấn công, chưa ngủ được.'); return { ok: false, reason: 'hurt' }; }
  for (const e of g.ents.values()) {
    if ((e.kind === 'mob' && MOBS[e.type] && !MOBS[e.type].passive) || e.kind === 'boss') {
      if (Math.hypot(e.x - (a.x + 0.5), e.z - (a.z + 0.5)) < BED_DANGER + (e.kind === 'boss' ? 10 : 0)) { say('Có quái vật ở gần, không ngủ được!'); return { ok: false, reason: 'monsters' }; }
    }
  }
  p.sleep = { x: a.x, y: a.y, z: a.z, since: g.time };
  g.emit(p.uid, { t: 'sleep', on: true, x: a.x, y: a.y, z: a.z });
  report(g);
  return { ok: true, sleeping: true };
}

export function wake(g, p, skipped) {
  if (!p.sleep) return;
  p.sleep = null;
  g.emit(p.uid, { t: 'sleep', on: false, skipped: !!skipped });
  if (!skipped) report(g);
}

function report(g) {
  const alive = [...g.players.values()].filter(p => !p.dead), n = alive.filter(p => p.sleep).length;
  if (alive.length > 1 && n) g.emit(null, { t: 'chat', sys: true, text: `${n}/${alive.length} người chơi đang ngủ` });
}

export function sleepTick(g) {
  const all = [...g.players.values()];
  for (const p of all) {
    if (!p.sleep) continue;
    const s = p.sleep;
    if (p.dead || g.world.get(s.x, s.y, s.z) !== B.BED || Math.hypot(p.x - (s.x + 0.5), p.z - (s.z + 0.5)) > MAX_BED_DIST || (p.lastHurt || -99) >= s.since || !isNight(g.time)) wake(g, p, false);
  }
  const alive = all.filter(p => !p.dead);
  if (!alive.length || !alive.every(p => p.sleep && g.time - p.sleep.since >= SLEEP_FADE)) return;
  const dawn = (Math.floor(g.time / DAY_LEN) + 1) * DAY_LEN, skip = dawn - g.time;
  g.time = dawn;
  for (const p of all) p.lastState += skip;                     // đồng hồ nhận trạng thái của máy khách không bị nhảy theo
  farm.farmTick(g, Math.min(skip, 240));                        // cây trồng lớn thêm trong lúc ngủ
  setWeather(g, 'clear', 240 + g.rng() * 240);
  for (const p of alive) {
    p.hp = p.maxHp;
    if (g.hunger) p.food = Math.max(Math.min(p.food, 4), p.food - 4);
    g.touch(p);
    wake(g, p, true);
    g.emit(p.uid, { t: 'toast', text: 'Bạn ngủ dậy, trời đã sáng. Máu hồi đầy.' });
  }
  g.emit(null, { t: 'dawn' });
}
