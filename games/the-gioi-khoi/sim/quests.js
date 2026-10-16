// Nhiệm vụ: nhận, tiến độ, trả. Trạng thái mỗi người chơi: p.quests = { active: { id: { prog: [..] } }, done: { id: true } }.
import { QUESTS } from '../content/quests.js';
import { addItem, removeItem, countItem, canFit } from './inventory.js';

export const questDef = id => QUESTS[id];

export function requirementsMet(g, p, q) {
  const r = q.requires;
  if (!r) return true;
  if (r.quest && !p.quests.done[r.quest]) return false;
  if (r.flag && !g.flags[r.flag]) return false;
  return true;
}

export function questState(g, p, id) {
  const q = QUESTS[id];
  if (!q) return 'none';
  if (p.quests.done[id]) return 'done';
  const a = p.quests.active[id];
  if (!a) return 'none';
  return progress(g, p, id).every(s => s.n >= s.need) ? 'ready' : 'active';
}

export function progress(g, p, id) {
  const q = QUESTS[id], a = p.quests.active[id];
  return q.steps.map((s, i) => {
    const text = s.text;
    if (s.type === 'collect') return { text, n: Math.min(s.n, countItem(p.inv, s.item)), need: s.n };
    if (s.type === 'kill') return { text, n: Math.min(s.n, a ? a.prog[i] || 0 : 0), need: s.n };
    return { text, n: a && a.prog[i] ? 1 : 0, need: 1 };            // boss, reach, talk
  });
}

export function accept(g, p, id) {
  const q = QUESTS[id];
  if (!q) return { ok: false, reason: 'no-quest' };
  if (questState(g, p, id) !== 'none') return { ok: false, reason: 'already' };
  if (!requirementsMet(g, p, q)) return { ok: false, reason: 'requires' };
  p.quests.active[id] = { prog: q.steps.map(() => 0) };
  g.touch(p); g.emit(p.uid, { t: 'toast', text: 'Nhận nhiệm vụ: ' + q.name });
  return { ok: true };
}

export function turnIn(g, p, id) {
  if (questState(g, p, id) !== 'ready') return { ok: false, reason: 'not-ready' };
  const q = QUESTS[id];
  const trial = p.inv.map(s => s && { ...s });
  if (q.consume) for (const s of q.steps) if (s.type === 'collect') removeItem(trial, s.item, s.n);
  for (const r of q.reward.items) if (addItem(trial, r.item, r.n) > 0) return { ok: false, reason: 'inventory-full' };
  if (q.consume) for (const s of q.steps) if (s.type === 'collect') removeItem(p.inv, s.item, s.n);
  for (const r of q.reward.items) addItem(p.inv, r.item, r.n);
  delete p.quests.active[id]; p.quests.done[id] = true;
  g.touch(p); g.emit(p.uid, { t: 'toast', text: 'Hoàn thành: ' + q.name });
  return { ok: true };
}

// Người chơi `p` vừa góp phần hạ quái loại `type`.
export function creditKill(g, p, type) {
  for (const [id, a] of Object.entries(p.quests.active)) QUESTS[id].steps.forEach((s, i) => { if (s.type === 'kill' && s.mob === type) a.prog[i] = (a.prog[i] || 0) + 1; });
}
export function creditBoss(g, p, bossId) {
  for (const [id, a] of Object.entries(p.quests.active)) QUESTS[id].steps.forEach((s, i) => { if (s.type === 'boss' && s.boss === bossId) a.prog[i] = 1; });
}
export function creditRegion(g, p, region) {
  for (const [id, a] of Object.entries(p.quests.active)) QUESTS[id].steps.forEach((s, i) => { if (s.type === 'reach' && s.region === region) a.prog[i] = 1; });
}

export function summary(g, p) {
  return Object.keys(p.quests.active).map(id => ({ id, name: QUESTS[id].name, state: questState(g, p, id), steps: progress(g, p, id) }));
}
