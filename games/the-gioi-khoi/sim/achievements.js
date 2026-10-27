// Thành tựu + thống kê người chơi: p.stats = { kill, mine, ... , reg: [vùng đã đến] }, p.ach = { id: true }.
import { ACHIEVEMENTS } from '../content/achievements.js';
import { QUESTS } from '../content/quests.js';
import { countItem } from './inventory.js';
import { ARMOR_SLOTS } from './armor.js';

const COUNTERS = ['kill', 'mine', 'place', 'craft', 'harvest', 'eat', 'boss', 'dungeon', 'die'];

// Làm sạch dữ liệu nạp từ save: chỉ nhận số nguyên không âm, id thành tựu có thật, danh sách vùng là chuỗi.
export function sanitize(p) {
  const s = p.stats && typeof p.stats === 'object' ? p.stats : {}, st = {};
  for (const k of COUNTERS) st[k] = Number.isFinite(s[k]) ? Math.max(0, Math.min(1e9, Math.floor(s[k]))) : 0;
  st.reg = Array.isArray(s.reg) ? [...new Set(s.reg.filter(x => typeof x === 'string').slice(0, 32))] : [];
  const ach = {};
  if (p.ach && typeof p.ach === 'object') for (const a of ACHIEVEMENTS) if (p.ach[a.id]) ach[a.id] = true;
  p.stats = st; p.ach = ach;
}

export function bump(g, p, key, n = 1) { if (!p.stats) sanitize(p); p.stats[key] = (p.stats[key] || 0) + n; }
export function visit(g, p, region) { if (!p.stats) sanitize(p); if (!p.stats.reg.includes(region)) p.stats.reg.push(region); }

function value(a, g, p) {
  if (a.stat === 'quests') return Object.keys(p.quests.done).filter(id => QUESTS[id]).length;
  if (a.stat === 'regions') return p.stats.reg.length;
  if (a.stat) return p.stats[a.stat] || 0;
  if (a.has) return countItem(p.inv, a.has) > 0 ? 1 : 0;
  if (a.armor4) return ARMOR_SLOTS.every(s => p.armor && p.armor[s]) ? 1 : 0;
  return 0;
}
export const need = a => a.need || 1;

// Mở khóa những thành tựu đã đạt. Trả danh sách vừa mở.
export function check(g, p) {
  if (!p.stats || !p.ach) sanitize(p);
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (p.ach[a.id] || value(a, g, p) < need(a)) continue;
    p.ach[a.id] = true; got.push(a); g.touch(p);
    g.emit(p.uid, { t: 'ach', id: a.id, name: a.name, icon: a.icon });
  }
  return got;
}

export function list(g, p) {
  if (!p.stats || !p.ach) sanitize(p);
  return ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name, desc: a.desc, icon: a.icon, done: !!p.ach[a.id], n: Math.min(need(a), value(a, g, p)), need: need(a) }));
}
