// Trình kiểm tra nội dung: bắt tham chiếu hỏng, vật phẩm không có nguồn, hội thoại cụt hoặc không tới được.
// validateContent(bundle) trả mảng lỗi (chuỗi); rỗng là hợp lệ. loadContent() gom nội dung thật thành bundle.
import { ITEMS } from './items.js';
import { RECIPES } from './recipes.js';
import { MOBS } from './mobs.js';
import { BOSSES } from './bosses.js';
import { NPCS, VILLAGES } from './npcs.js';
import { QUESTS } from './quests.js';
import { SHOPS } from './shops.js';
import { REGIONS } from './regions.js';
import { CROPS, EFFECTS } from './farming.js';
import { DUNGEONS, LOOT, LAYOUT, TRAP, GUARD } from './dungeons.js';
import { BLOCKS, BLOCK_BY_NAME } from '../world/blocks.js';
import { WEAPON_CLS, weaponOf } from '../sim/rules.js';

export async function loadContent() {
  return { items: ITEMS, recipes: RECIPES, mobs: MOBS, bosses: BOSSES, npcs: NPCS, villages: VILLAGES, quests: QUESTS, shops: SHOPS, regions: REGIONS, blocks: BLOCKS, crops: CROPS, effects: EFFECTS, dungeons: DUNGEONS, loot: LOOT, layout: LAYOUT, trap: TRAP, guard: GUARD };
}

const AI_KINDS = ['chase-melee', 'flee', 'ranged-kite', 'guard', 'farm'];
const MOVE_TYPES = ['melee', 'leap', 'summon', 'volley', 'slam'];
const STEP_TYPES = ['collect', 'kill', 'boss', 'reach', 'talk'];

export function validateContent(c) {
  const errs = [], err = (m) => errs.push(m);
  const regionIds = new Set(c.regions.map(r => r.id));
  const crops = c.crops || {}, effects = c.effects || {}, dungeons = c.dungeons || {}, loot = c.loot || {}, layout = c.layout || {};
  const hasItem = (id, where) => { if (!c.items[id]) err(`${where}: vật phẩm không tồn tại "${id}"`); };

  for (const [id, it] of Object.entries(c.items)) if (it.block && !BLOCK_BY_NAME[it.block]) err(`vật phẩm ${id}: block không tồn tại "${it.block}"`);
  for (const b of c.blocks) if (b.drop && !c.items[b.drop]) err(`block ${b.name}: vật phẩm rơi không tồn tại "${b.drop}"`);

  for (const [id, it] of Object.entries(c.items)) {                                  // thức ăn và hạt giống
    if (it.food !== undefined && !(it.food >= 0 && it.food <= 20)) err(`vật phẩm ${id}: food ngoài 0..20`);
    if (it.fx && !effects[it.fx.id]) err(`vật phẩm ${id}: hiệu ứng không tồn tại "${it.fx.id}"`);
    if (it.fx && !(it.fx.secs > 0)) err(`vật phẩm ${id}: hiệu ứng thiếu thời lượng`);
    if (it.risk && !(it.risk.poison >= 0 && it.risk.poison <= 1)) err(`vật phẩm ${id}: xác suất ngộ độc không hợp lệ`);
    if (it.plant && !crops[it.plant]) err(`vật phẩm ${id}: gieo ra cây không tồn tại "${it.plant}"`);
  }
  // vũ khí, cung, khiên: lớp hợp lệ, thông số đủ; cung cần mũi tên
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  for (const [id, it] of Object.entries(c.items)) {
    const weaponish = it.dmg > 1 && (it.tool && ['sword', 'axe'].includes(it.tool.type) || it.weapon || it.relic) || it.weapon;
    if (weaponish) { const w = weaponOf(it); if (!WEAPON_CLS[w.cls]) err(`vật phẩm ${id}: lớp vũ khí lạ "${w.cls}"`); else if (!(w.cd > 0 && w.cost >= 0 && w.reach > 0)) err(`vật phẩm ${id}: thông số vũ khí không hợp lệ`); }
    if (it.bow) { const b = it.bow; if (!(num(b.draw, 0.2, 5) && num(b.dmgMin, 1, 99) && num(b.dmgMax, b.dmgMin || 1, 99) && num(b.speedMin, 1, 99) && num(b.speedMax, b.speedMin || 1, 99))) err(`vật phẩm ${id}: thông số cung (bow) không hợp lệ`); if (!c.items.arrow) err(`vật phẩm ${id}: cung cần vật phẩm "arrow"`); }
    if (/(^|_)bow$/.test(id) && !it.bow) err(`vật phẩm ${id}: cung thiếu bow`);
    if (it.shield) { const s2 = it.shield; if (!(num(s2.reduce, 0.05, 0.95) && num(s2.costMul, 0.1, 10))) err(`vật phẩm ${id}: thông số khiên (shield) không hợp lệ`); }
    if (/(^|_)shield$/.test(id) && !it.shield) err(`vật phẩm ${id}: khiên thiếu shield`);
  }
  for (const [id, cr] of Object.entries(crops)) {
    hasItem(cr.seed, `cây ${id} (hạt)`);
    if (c.items[cr.seed] && c.items[cr.seed].plant !== id) err(`cây ${id}: hạt ${cr.seed} không gieo ra đúng cây này`);
    if (!(cr.secs > 0)) err(`cây ${id}: thời gian lớn không hợp lệ`);
    for (const y of cr.yield) { hasItem(y.item, `cây ${id} (sản lượng)`); if (!(y.min >= 1 && y.max >= y.min)) err(`cây ${id}: sản lượng ${y.item} không hợp lệ`); }
    if (!cr.yield.some(y => y.item === cr.seed)) err(`cây ${id}: sản lượng không có hạt để trồng lại`);
  }

  for (const r of c.recipes) {
    hasItem(r.out.item, `công thức ${r.id}`);
    for (const k of Object.keys(r.in)) hasItem(k, `công thức ${r.id} (nguyên liệu)`);
  }

  for (const [id, m] of Object.entries(c.mobs)) {
    if (!AI_KINDS.includes(m.ai)) err(`quái ${id}: kiểu AI lạ "${m.ai}"`);
    if (m.ai === 'ranged-kite' && !m.shot) err(`quái ${id}: ranged-kite thiếu shot`);
    if (['chase-melee', 'guard'].includes(m.ai) && !m.attack) err(`quái ${id}: ${m.ai} thiếu attack`);
    if (m.ai === 'farm') {
      if (!m.breed) err(`thú ${id}: ai farm thiếu breed`);
      else { hasItem(m.breed.food, `thú ${id} (thức ăn)`); if (!(m.breed.cd > 0 && m.breed.love > 0)) err(`thú ${id}: breed.cd/love không hợp lệ`); }
      if (!(m.adultSecs > 0)) err(`thú ${id}: thiếu adultSecs`);
      if (m.product) hasItem(m.product.item, `thú ${id} (sản phẩm)`);
    }
    for (const rg of m.regions || []) if (!regionIds.has(rg)) err(`quái ${id}: vùng không tồn tại "${rg}"`);
    for (const d of m.drops || []) hasItem(d.item, `quái ${id} (rơi)`);
  }

  const flags = new Set();
  for (const [id, b] of Object.entries(c.bosses)) {
    flags.add(b.flag);
    if (!regionIds.has(b.region)) err(`boss ${id}: vùng không tồn tại "${b.region}"`);
    if (b.unlocks && !regionIds.has(b.unlocks)) err(`boss ${id}: mở vùng không tồn tại "${b.unlocks}"`);
    for (const [mn, m] of Object.entries(b.moves)) {
      if (!MOVE_TYPES.includes(m.type)) err(`boss ${id}: chiêu ${mn} có kiểu lạ "${m.type}"`);
      if (m.type === 'summon' && !c.mobs[m.mob]) err(`boss ${id}: chiêu ${mn} gọi quái không tồn tại "${m.mob}"`);
    }
    b.phases.forEach((ph, i) => {
      if (i > 0 && !(ph.from < b.phases[i - 1].from)) err(`boss ${id}: pha ${i} không giảm dần theo máu`);
      for (const mv of ph.moves) if (!b.moves[mv]) err(`boss ${id}: pha ${i} dùng chiêu không tồn tại "${mv}"`);
    });
    for (const d of b.drops || []) hasItem(d.item, `boss ${id} (rơi)`);
  }
  for (const r of c.regions) if (r.requires && !flags.has(r.requires)) err(`vùng ${r.id}: yêu cầu cờ không có boss nào đặt "${r.requires}"`);

  for (const [id, v] of Object.entries(c.villages)) if (!regionIds.has(v.region)) err(`làng ${id}: vùng không tồn tại "${v.region}"`);

  for (const [id, s] of Object.entries(c.shops)) {
    if (!c.npcs[id]) err(`cửa hàng ${id}: không có NPC cùng tên`);
    for (const x of [...s.sells, ...s.buys]) { hasItem(x.item, `cửa hàng ${id}`); if (!(x.price > 0)) err(`cửa hàng ${id}: giá không hợp lệ cho ${x.item}`); }
  }

  const accepts = new Set(), turnins = {};
  for (const [nid, n] of Object.entries(c.npcs)) {
    if (!c.villages[n.village]) err(`NPC ${nid}: làng không tồn tại "${n.village}"`);
    if (!n.nodes[n.start]) err(`NPC ${nid}: nút bắt đầu không tồn tại "${n.start}"`);
    const seen = new Set(), stack = [n.start];
    while (stack.length) {
      const k = stack.pop(); if (seen.has(k) || !n.nodes[k]) continue; seen.add(k);
      for (const ch of n.nodes[k].choices || []) if (ch.goto) stack.push(ch.goto);
    }
    for (const [k, node] of Object.entries(n.nodes)) {
      if (!seen.has(k)) err(`NPC ${nid}: nút "${k}" không tới được từ nút bắt đầu`);
      if (!node.choices || !node.choices.length) err(`NPC ${nid}: nút "${k}" cụt (không có lựa chọn)`);
      for (const ch of node.choices || []) {
        if (ch.goto && !n.nodes[ch.goto]) err(`NPC ${nid}: nút "${k}" đi tới nút không tồn tại "${ch.goto}"`);
        if (ch.if && ch.if.quest && !c.quests[ch.if.quest]) err(`NPC ${nid}: điều kiện nhắc nhiệm vụ không tồn tại "${ch.if.quest}"`);
        for (const a of ch.do || []) {
          if (a.accept) { if (!c.quests[a.accept]) err(`NPC ${nid}: nhận nhiệm vụ không tồn tại "${a.accept}"`); else { accepts.add(a.accept); if (c.quests[a.accept].giver !== nid) err(`NPC ${nid}: nhận nhiệm vụ ${a.accept} của NPC khác`); } }
          if (a.turnin) { if (!c.quests[a.turnin]) err(`NPC ${nid}: trả nhiệm vụ không tồn tại "${a.turnin}"`); else (turnins[a.turnin] = turnins[a.turnin] || []).push(nid); }
          if (a.shop && !c.shops[a.shop]) err(`NPC ${nid}: cửa hàng không tồn tại "${a.shop}"`);
          if (a.give) hasItem(a.give.item, `NPC ${nid} (tặng)`);
        }
      }
    }
  }

  for (const [qid, q] of Object.entries(c.quests)) {
    if (!c.npcs[q.giver]) err(`nhiệm vụ ${qid}: người giao không tồn tại "${q.giver}"`);
    if (!accepts.has(qid)) err(`nhiệm vụ ${qid}: không có hội thoại nào cho nhận`);
    if (!(turnins[qid] || []).includes(q.giver)) err(`nhiệm vụ ${qid}: người giao không có lựa chọn trả nhiệm vụ`);
    if (q.requires && q.requires.quest && !c.quests[q.requires.quest]) err(`nhiệm vụ ${qid}: tiền đề không tồn tại "${q.requires.quest}"`);
    for (const s of q.steps) {
      if (!STEP_TYPES.includes(s.type)) err(`nhiệm vụ ${qid}: kiểu bước lạ "${s.type}"`);
      if (s.type === 'collect') hasItem(s.item, `nhiệm vụ ${qid}`);
      if (s.type === 'kill' && !c.mobs[s.mob]) err(`nhiệm vụ ${qid}: quái không tồn tại "${s.mob}"`);
      if (s.type === 'boss' && !c.bosses[s.boss]) err(`nhiệm vụ ${qid}: boss không tồn tại "${s.boss}"`);
      if (s.type === 'reach' && !regionIds.has(s.region)) err(`nhiệm vụ ${qid}: vùng không tồn tại "${s.region}"`);
    }
    for (const r of q.reward.items) hasItem(r.item, `nhiệm vụ ${qid} (thưởng)`);
  }

  // hầm ngục: vùng, quái, vật liệu, boss, ba chặng bẫy; khuôn có đủ cổng, chìa và bốn rương; bảng thưởng chỉ dùng vật phẩm có thật
  const TRAP_KINDS = Object.keys(c.trap || { spike: 1, dart: 1, vent: 1 });
  for (const [id, d] of Object.entries(dungeons)) {
    if (!regionIds.has(d.region)) err(`hầm ${id}: vùng không tồn tại "${d.region}"`);
    for (const m of d.mobs || []) if (!c.mobs[m]) err(`hầm ${id}: quái không tồn tại "${m}"`);
    for (const m of d.mats || []) hasItem(m, `hầm ${id} (vật liệu)`);
    if (!c.bosses[d.boss]) err(`hầm ${id}: boss không tồn tại "${d.boss}"`);
    else if (c.bosses[d.boss].dungeon !== id) err(`hầm ${id}: boss ${d.boss} không thuộc hầm này`);
    if (!Array.isArray(d.traps) || d.traps.length !== 3) err(`hầm ${id}: cần đúng 3 chặng bẫy`);
    for (const t of d.traps || []) if (!TRAP_KINDS.includes(t)) err(`hầm ${id}: loại bẫy lạ "${t}"`);
    if (d.armor && !Object.values(c.items).some(it => it.armor && it.armor.set === d.armor)) err(`hầm ${id}: bộ giáp thưởng không tồn tại "${d.armor}"`);
  }
  for (const [id, b] of Object.entries(c.bosses)) if (b.dungeon && !dungeons[b.dungeon]) err(`boss ${id}: hầm không tồn tại "${b.dungeon}"`);
  if (Object.keys(dungeons).length) {
    for (const k of ['iron', 'boss']) {
      const gt = (layout.gates || {})[k];
      if (!gt) err(`hầm ngục: khuôn thiếu cổng "${k}"`); else hasItem(gt.key, `cổng ${k} (chìa)`);
    }
    for (const k of ['supply', 'victory', 'trap', 'treasure']) {
      if (!(layout.chests || {})[k]) err(`hầm ngục: khuôn thiếu rương "${k}"`);
      if (!Array.isArray(loot[k]) || !loot[k].length) err(`hầm ngục: thiếu bảng thưởng rương "${k}"`);
    }
    const fixed = (k, item) => (loot[k] || []).some(r => r.item === item && r.fixed && r.p >= 1);
    if (layout.gates && layout.gates.iron && !fixed('victory', layout.gates.iron.key)) err(`hầm ngục: rương chiến thắng không luôn có chìa ${layout.gates.iron.key} (hầm thiếu chìa)`);
    if (layout.gates && layout.gates.boss && !fixed('trap', layout.gates.boss.key)) err(`hầm ngục: rương cuối phòng bẫy không luôn có chìa ${layout.gates.boss.key} (hầm thiếu chìa)`);
  }
  for (const [k, rows] of Object.entries(loot)) for (const r of rows) {
    if (!r.item.startsWith('$')) hasItem(r.item, `rương hầm ${k}`);
    if (!(r.min >= 1 && r.max >= r.min) || !(r.p > 0 && r.p <= 1)) err(`rương hầm ${k}: dòng ${r.item} không hợp lệ`);
  }

  // mọi vật phẩm phải kiếm được bằng cách nào đó
  const sources = new Set();
  for (const b of c.blocks) if (b.drop) sources.add(b.drop);
  for (const m of Object.values(c.mobs)) for (const d of m.drops || []) sources.add(d.item);
  for (const b of Object.values(c.bosses)) for (const d of b.drops || []) sources.add(d.item);
  for (const r of c.recipes) sources.add(r.out.item);
  for (const s of Object.values(c.shops)) for (const x of s.sells) sources.add(x.item);
  for (const cr of Object.values(crops)) for (const y of cr.yield) sources.add(y.item);
  for (const m of Object.values(c.mobs)) if (m.product) sources.add(m.product.item);
  for (const rows of Object.values(loot)) for (const r of rows) sources.add(r.item);
  for (const q of Object.values(c.quests)) for (const r of q.reward.items) sources.add(r.item);
  for (const id of Object.keys(c.items)) if (!sources.has(id)) err(`vật phẩm ${id}: không có nguồn nào (không rơi, không chế tạo, không bán, không thưởng)`);

  return errs;
}
