// Hội thoại với NPC (đồ thị nút + điều kiện + hành động) và cửa hàng.
import { NPCS } from '../content/npcs.js';
import { SHOPS } from '../content/shops.js';
import { QUESTS } from '../content/quests.js';
import { ITEMS } from '../content/items.js';
import * as quests from './quests.js';
import { addItem, removeItem, countItem, canFit } from './inventory.js';

const TALK_REACH = 5, SHOP_REACH = 8;

function cond(g, p, npcId, c) {
  if (!c) return true;
  if (c.flag && !g.flags[c.flag]) return false;
  if (c.noflag && g.flags[c.noflag]) return false;
  if (c.quest) {
    if (quests.questState(g, p, c.quest) !== c.state) return false;
    if (c.requires && !quests.requirementsMet(g, p, QUESTS[c.quest])) return false;
  }
  if (c.has && countItem(p.inv, c.has.item) < c.has.n) return false;
  if (c.anyReady && !Object.keys(QUESTS).some(id => QUESTS[id].giver === npcId && quests.questState(g, p, id) === 'ready')) return false;
  return true;
}

function view(g, p) {
  const d = p.dlg, npc = NPCS[d.npc], node = npc.nodes[d.node];
  const choices = node.choices.map((c, i) => ({ i, text: c.text, ok: cond(g, p, d.npc, c.if) })).filter(c => c.ok).map(({ i, text }) => ({ i, text }));
  g.emit(p.uid, { t: 'dialog', npc: { id: d.npc, name: npc.name }, text: node.text, choices });
}

function end(g, p) { p.dlg = null; g.emit(p.uid, { t: 'dialog-end' }); }

export function interact(g, p, a) {
  const e = g.ents.get(a.id);
  if (!e || e.kind !== 'npc') return { ok: false, reason: 'no-npc' };
  if (Math.hypot(e.x - p.x, e.z - p.z) > TALK_REACH || Math.abs(e.y - p.y) > 4) return { ok: false, reason: 'far' };
  p.dlg = { npc: e.npc, node: NPCS[e.npc].start, entId: e.id };
  view(g, p);
  return { ok: true };
}

export function choose(g, p, a) {
  if (!p.dlg) return { ok: false, reason: 'no-dialog' };
  if (a.i === -1) { end(g, p); return { ok: true }; }
  const npc = NPCS[p.dlg.npc], node = npc.nodes[p.dlg.node], c = node.choices[a.i];
  if (!c || !cond(g, p, p.dlg.npc, c.if)) return { ok: false, reason: 'bad-choice' };
  const e = g.ents.get(p.dlg.entId);
  if (!e || Math.hypot(e.x - p.x, e.z - p.z) > TALK_REACH + 3) { end(g, p); return { ok: false, reason: 'far' }; }
  for (const act of c.do || []) {
    let r = { ok: true };
    if (act.accept) r = quests.accept(g, p, act.accept);
    else if (act.turnin) r = quests.turnIn(g, p, act.turnin);
    else if (act.give) { const left = addItem(p.inv, act.give.item, act.give.n); g.touch(p); r = { ok: left === 0 }; }
    else if (act.setflag) g.flags[act.setflag] = true;
    else if (act.shop) { openShop(g, p, act.shop); end(g, p); return { ok: true }; }
    if (!r.ok) { g.emit(p.uid, { t: 'toast', text: r.reason === 'inventory-full' ? 'Kho đồ đã đầy.' : 'Chưa làm được việc này.' }); end(g, p); return r; }
  }
  if (c.goto == null) { end(g, p); return { ok: true }; }
  p.dlg.node = c.goto; view(g, p);
  return { ok: true };
}

function openShop(g, p, shopId) {
  const s = SHOPS[shopId];
  p.shop = { id: shopId, entId: p.dlg ? p.dlg.entId : null };
  const nm = id => ITEMS[id].name;
  g.emit(p.uid, { t: 'shop', shop: shopId, name: s.name,
    sells: s.sells.map(x => ({ ...x, name: nm(x.item) })), buys: s.buys.map(x => ({ ...x, name: nm(x.item) })) });
}

function shopFor(g, p) {
  if (!p.shop) return null;
  const e = g.ents.get(p.shop.entId);
  if (!e || Math.hypot(e.x - p.x, e.z - p.z) > SHOP_REACH) return null;
  return SHOPS[p.shop.id];
}

export function buy(g, p, a) {
  const s = shopFor(g, p), n = Math.max(1, a.n | 0);
  if (!s) return { ok: false, reason: 'no-shop' };
  const row = s.sells.find(x => x.item === a.item);
  if (!row) return { ok: false, reason: 'not-sold' };
  const cost = row.price * n;
  if (countItem(p.inv, 'xu') < cost) return { ok: false, reason: 'poor' };
  const trial = p.inv.map(x => x && { ...x });
  removeItem(trial, 'xu', cost);
  if (!canFit(trial, a.item, n)) return { ok: false, reason: 'inventory-full' };
  removeItem(p.inv, 'xu', cost); addItem(p.inv, a.item, n); g.touch(p);
  return { ok: true };
}

export function sell(g, p, a) {
  const s = shopFor(g, p), n = Math.max(1, a.n | 0);
  if (!s) return { ok: false, reason: 'no-shop' };
  const row = s.buys.find(x => x.item === a.item);
  if (!row) return { ok: false, reason: 'not-bought' };
  if (countItem(p.inv, a.item) < n) return { ok: false, reason: 'missing' };
  const trial = p.inv.map(x => x && { ...x });
  removeItem(trial, a.item, n);
  if (!canFit(trial, 'xu', row.price * n)) return { ok: false, reason: 'inventory-full' };
  removeItem(p.inv, a.item, n); addItem(p.inv, 'xu', row.price * n); g.touch(p);
  return { ok: true };
}
