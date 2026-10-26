// HUD: máu, thanh nhanh, vùng, thông báo, thanh máu boss, nhiệm vụ đang làm, mã phòng. Chỉ chạm DOM, không có logic game.
import { ITEMS } from '../content/items.js';
import { EFFECTS } from '../content/farming.js';
import { foodIcon, fxIcon } from './icons.js';
import { weaponOf, BOW_COST, PARRY_WINDOW } from '../sim/rules.js';

const $ = id => document.getElementById(id);
export const itemName = id => (ITEMS[id] ? ITEMS[id].name : id);
// Chú giải vật phẩm nhiều dòng (tên, thức ăn, hiệu ứng, rủi ro, công dụng); dùng làm title của ô kho và thanh nhanh.
const CLS_NAME = { hand: 'Tay không', sword: 'Kiếm', axe: 'Rìu', club: 'Chùy', spear: 'Giáo' };
const CLS_TRAIT = { hand: 'Đánh nhẹ, nhanh.', sword: 'Chuỗi 3 đòn trúng liên tiếp: đòn cuối mạnh x1.5 và hất lùi.', axe: 'Quét: đánh thêm tối đa 2 quái đứng gần mục tiêu (70% sát thương).',
  club: 'Nặng x1.3, choáng quái thường 1 giây (boss miễn choáng).', spear: 'Tầm xa hơn, chọc thẳng không đẩy lùi.' };
const USE_TEXT = { hoe: 'Bấm phải lên đất, cỏ, bùn, rêu để cày ruộng.' };
export function itemTip(id) {
  const it = ITEMS[id], lines = [itemName(id)];
  if (!it) return lines[0];
  if (it.food > 0 || it.heal > 0) {
    lines.push(`Đói +${it.food || 0} · Máu +${it.heal || 0}`);
    if (it.fx) lines.push(`Hiệu ứng: ${EFFECTS[it.fx.id] ? EFFECTS[it.fx.id].name : it.fx.id} (${it.fx.secs} giây)`);
    if (it.risk && it.risk.poison) lines.push(`Ăn sống: ${Math.round(it.risk.poison * 100)}% bị ngộ độc (nấu ở lò nung cho an toàn)`);
  }
  if (it.plant) lines.push('Gieo lên đất đã cày (bấm phải).');
  if (it.bound) lines.push('Chìa của hầm ngục: bấm phải lên cổng để mở. Gắn với bạn, không cất vào rương được.');
  if (id === 'ancient_shard') lines.push('Đổi lấy cuốc và kiếm cổ vật ở đe rèn, hoặc bán cho thương nhân.');
  if (it.tool && USE_TEXT[it.tool.type]) lines.push(USE_TEXT[it.tool.type]);
  if (id === 'shears') lines.push('Bấm phải lên cừu trưởng thành để cắt len.');
  const weaponish = it.dmg > 1 && (it.tool && ['sword', 'axe'].includes(it.tool.type) || it.weapon || it.relic);
  if (weaponish) {
    const w = weaponOf(it);
    lines.push(`${CLS_NAME[w.cls]} · sát thương ${it.dmg}`, `Hồi chiêu ${w.cd} giây · thể lực ${w.cost}/đòn · tầm ${w.reach}`, CLS_TRAIT[w.cls]);
  } else if (it.dmg > 1 && it.tool) lines.push(`Sát thương ${it.dmg}`);
  if (it.bow) lines.push(`Giữ chuột trái để kéo, thả để bắn (cần Mũi tên, tốn ${BOW_COST} thể lực).`, `Kéo đầy ${it.bow.draw} giây · sát thương ${it.bow.dmgMin} tới ${it.bow.dmgMax}`);
  if (it.shield) lines.push(`Khiên: giảm ${Math.round(it.shield.reduce * 100)}% sát thương chặn được ở phía trước. Bấm chuột phải trong kho để đeo; giữ chuột phải hoặc F để giơ.`,
    `Mỗi cú chặn tốn thể lực gấp ${it.shield.costMul} lần sát thương; đỡ trong ${PARRY_WINDOW} giây đầu là đỡ hoàn hảo.`);
  if (id === 'arrow') lines.push('Đạn của cung. Có thể nhặt lại một phần sau khi bắn trúng quái.');
  return lines.join('\n');
}
export const itemColor = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h},55%,45%)`; };

let iconOf = null;
export const setIconProvider = fn => { iconOf = fn; };

export function slotEl(s, { sel = false, small = false } = {}) {
  const d = document.createElement('div');
  d.className = 'slot' + (sel ? ' sel' : '');
  if (s) {
    d.title = itemTip(s.id);
    d.style.background = `linear-gradient(${itemColor(s.id)}55, #0009)`;
    if (iconOf) { const im = document.createElement('img'); im.src = iconOf(s.id); im.alt = itemName(s.id); im.draggable = false; d.appendChild(im); }
    else { const n = document.createElement('span'); n.textContent = itemName(s.id); d.appendChild(n); }
    if (s.n > 1) { const b = document.createElement('b'); b.textContent = s.n; d.appendChild(b); }
  }
  return d;
}

export function createHud() {
  let toastTimer = null;
  const fxLeft = new Map();                                              // id -> thời điểm (performance.now) hết hạn, khách tự đếm lùi giữa các lần host đẩy
  const fxTick = () => {
    const bar = $('fxbar'); if (!bar) return;
    for (const el of bar.querySelectorAll('.fx')) { const u = fxLeft.get(el.dataset.id); if (u !== undefined) el.querySelector('.left').textContent = Math.max(0, Math.ceil((u - performance.now()) / 1000)); }
  };
  setInterval(fxTick, 250);
  return {
    setHp(hp, max) {
      const el = $('hp'); if (!el.firstChild) el.innerHTML = '<span class="hpbar"><i></i></span><b></b><em class="armor" title="Giáp"></em>';
      const r = Math.max(0, Math.min(1, hp / max)); el.querySelector('i').style.width = r * 100 + '%'; el.classList.toggle('low', r <= 0.3);
      el.querySelector('b').textContent = `❤ ${Math.ceil(hp)}/${max}`;
    },
    setArmor(def) { const a = document.querySelector('#hp .armor'); if (a) a.textContent = def > 0 ? `🛡 ${def}` : ''; },
    // Thanh khí khi đầu chìm dưới nước: 10 bong bóng, ẩn khi đầy.
    setAir(air, max = 12) {
      const el = $('air'); if (!el) return;
      if (air >= max - 0.05) { el.hidden = true; return; }
      el.hidden = false; const n = Math.ceil(air / max * 10); if (el.dataset.n !== String(n)) { el.dataset.n = n; el.textContent = '●'.repeat(n) + '○'.repeat(10 - n); }
      el.classList.toggle('low', air < 3);
    },
    // Dòng tin ở góc trái: ai hạ ai, ai gục ngã, boss bị hạ.
    feed(text) {
      const box = $('killfeed'); if (!box) return;
      const d = document.createElement('div'); d.textContent = text; box.appendChild(d);
      while (box.children.length > 5) box.removeChild(box.firstChild);
      setTimeout(() => d.remove(), 7000);
    },
    // Giữ Tab: bảng người chơi trong phòng (null để ẩn). list: [{ name, hp, maxHp, me }]
    setPlayers(list) {
      const el = $('players'); if (!el) return;
      if (!list) { el.hidden = true; return; }
      el.hidden = false; el.textContent = ''; const t = document.createElement('h3'); t.textContent = `Người chơi (${list.length})`; el.appendChild(t);
      for (const p of list) { const r = document.createElement('div'); r.className = 'prow' + (p.me ? ' me' : ''); const n = document.createElement('span'); n.textContent = p.name + (p.me ? ' (bạn)' : ''); const b = document.createElement('b'); b.textContent = `❤ ${Math.ceil(p.hp)}/${p.maxHp}`; r.append(n, b); el.appendChild(r); }
    },
    chat(name, text, sys) {
      const box = $('chatlog'); if (!box) return;
      const d = document.createElement('div'); if (sys) d.className = 'sys';
      if (name) { const n = document.createElement('b'); n.textContent = name + ': '; d.appendChild(n); }
      d.appendChild(document.createTextNode(text)); box.appendChild(d);
      while (box.children.length > 8) box.removeChild(box.firstChild);
      setTimeout(() => d.classList.add('old'), 12000);
    },
    setHotbar(inv, sel) {
      const h = $('hotbar'); h.textContent = '';
      for (let i = 0; i < 9; i++) { const d = slotEl(inv[i], { sel: i === sel }); const k = document.createElement('i'); k.textContent = i + 1; d.appendChild(k); h.appendChild(d); }
    },
    // Thanh đói: 10 biểu tượng, mỗi cái 2 điểm (đầy / nửa / rỗng); nhấp nháy đỏ khi đói cạn (lớp pulse).
    setFood(food) {
      const el = $('food'); if (!el) return;
      const v = Math.max(0, Math.min(20, Math.round(food ?? 20)));
      if (el.children.length !== 10) { el.textContent = ''; for (let i = 0; i < 10; i++) el.appendChild(document.createElement('i')); }
      for (let i = 0; i < 10; i++) {
        const left = v - i * 2, st = left >= 2 ? 'full' : left === 1 ? 'half' : 'empty', c = el.children[i];
        if (c.dataset.st !== st) { c.dataset.st = st; c.className = 'ic ' + st; c.style.backgroundImage = `url(${foodIcon(st)})`; }
      }
      el.classList.toggle('pulse', v === 0); el.title = `Đói ${v}/20`;
    },
    // Hiệu ứng thức ăn: list = [{ id, left }] (giây còn lại lúc host đẩy).
    setFx(list) {
      const bar = $('fxbar'); if (!bar) return;
      fxLeft.clear(); bar.textContent = '';
      for (const f of list || []) {
        const name = EFFECTS[f.id] ? EFFECTS[f.id].name : f.id, d = document.createElement('div');
        d.className = 'fx' + (f.id === 'poison' ? ' bad' : ''); d.dataset.id = f.id; d.title = name;
        const im = document.createElement('img'); im.src = fxIcon(f.id); im.alt = name; im.draggable = false;
        const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = name + ' ';
        const t = document.createElement('span'); t.className = 'left'; t.textContent = f.left;
        d.append(im, nm, t); bar.appendChild(d); fxLeft.set(f.id, performance.now() + f.left * 1000);
      }
    },
    // Thể lực: sta 0..100 (làm tròn), exh > 0 là kiệt sức. Thanh xanh lá, vàng dưới 40, đỏ nhấp nháy khi kiệt sức.
    setStamina({ sta, exh }) {
      const el = $('stamina'); if (!el) return;
      const v = Math.max(0, Math.min(100, sta ?? 100)), i = el.firstElementChild, key = v + ':' + (exh > 0);
      if (el.dataset.k === key) return; el.dataset.k = key;
      i.style.width = v + '%'; el.classList.toggle('low', v < 40); el.classList.toggle('exh', exh > 0); el.title = `Thể lực ${Math.round(v)}/100`;
    },
    // Chuỗi kiếm: 3 chấm dưới tâm ngắm, n chấm sáng. show=false khi không cầm kiếm.
    setCombo(n, show = true) {
      const el = $('combo'); if (!el) return;
      const key = show + ':' + n; if (el.dataset.k === key) return; el.dataset.k = key;
      el.hidden = !show; [...el.children].forEach((c, k) => c.classList.toggle('on', k < n));
    },
    // Vòng kéo cung: p 0..1 hoặc null (ẩn); arrows: số mũi tên (hoặc null khi không cầm cung).
    setDraw(p, arrows) {
      const ring = $('drawring'), cnt = $('arrows'); if (!ring || !cnt) return;
      ring.hidden = p == null; if (p != null) { const v = Math.round(Math.max(0, Math.min(1, p)) * 100); ring.dataset.p = v; ring.style.setProperty('--p', v + '%'); ring.classList.toggle('full', v >= 100); }
      cnt.hidden = arrows == null; if (arrows != null) cnt.textContent = '➶ ' + arrows;
    },
    // Biểu tượng khiên: hiện khi đang đeo khiên; sáng khi giơ.
    setShield(on, has) {
      const el = $('shieldico'); if (!el) return;
      el.hidden = !has; el.classList.toggle('up', !!on);
    },
    shieldFlash(kind) {
      const el = $('shieldico'), f = $('fightflash'); if (!el || !f) return;
      for (const n of ['perfect', 'broke']) { el.classList.remove(n); f.classList.remove(n); }
      void el.offsetWidth; el.classList.add(kind); f.classList.add(kind);
      clearTimeout(el._t); el._t = setTimeout(() => { el.classList.remove(kind); f.classList.remove(kind); }, 400);
    },
    // Dòng trạng thái hầm ngục: st = { name, room (1..4), left, keys: { dungeon_key, boss_key } } hoặc null (ngoài hầm).
    setDungeon(st) {
      const el = $('dungeon'); if (!el) return;
      if (!st) { if (!el.hidden) { el.hidden = true; el.dataset.sig = ''; } return; }
      const sig = JSON.stringify(st); if (el.dataset.sig === sig && !el.hidden) return;
      el.dataset.sig = sig; el.hidden = false; el.textContent = '';
      const t = (txt, tag = 'span') => { const n = document.createElement(tag); n.textContent = txt; el.appendChild(n); return n; };
      t(st.name, 'b'); t(`· Phòng ${st.room}/4`); t(`· Quái còn ${st.left || 0}`);
      for (const [id, label] of [['dungeon_key', 'Chìa Hầm'], ['boss_key', 'Chìa Chủ']]) {
        if (iconOf) { const im = document.createElement('img'); im.src = iconOf(id); im.alt = ''; im.draggable = false; el.appendChild(im); }
        t(`${label} ${(st.keys && st.keys[id]) || 0}`);
      }
    },
    // Biểu ngữ tên hầm (3 giây) và gợi ý hướng tới miệng hầm.
    showBanner(text) { const el = $('dgbanner'); if (!el) return; el.hidden = true; void el.offsetWidth; el.textContent = text; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, 3000); },
    setHint(text) { const el = $('dghint'); if (!el) return; const v = text || ''; if (el.textContent !== v) el.textContent = v; el.hidden = !v; },
    // Chú giải khi ngắm cây / ruộng / thú.
    setTip(text) { const el = $('tip'); if (!el) return; const t = text || ''; if (el.textContent !== t) el.textContent = t; el.hidden = !t; },
    setRegion(name) { $('region').textContent = name || ''; },
    toast(text, ms = 3500) { const t = $('toast'); t.textContent = text; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms); },
    setBoss(b) {
      const el = $('bossbar');
      if (!b) { el.hidden = true; return; }
      el.hidden = false; $('boss-name').textContent = b.name + (b.phase ? ` · Pha ${b.phase + 1}` : '');
      $('boss-fill').style.width = Math.max(0, Math.min(100, b.hp / b.maxHp * 100)) + '%';
    },
    setQuests(list) {
      const el = $('quests'); el.textContent = '';
      if (!list.length) { const d = document.createElement('div'); d.className = 'q guide'; d.textContent = 'Gợi ý: tìm người có dấu ❗ trong làng và bấm chuột phải để nhận nhiệm vụ. E mở kho đồ & chế tạo · Q lăn né.'; el.appendChild(d); return; }
      for (const q of list) {
        const d = document.createElement('div'); d.className = 'q ' + q.state;
        const t = document.createElement('b'); t.textContent = q.name + (q.state === 'ready' ? ' ✔ (về báo)' : ''); d.appendChild(t);
        for (const s of q.steps) { const l = document.createElement('div'); l.textContent = `${s.n >= s.need ? '✔' : '•'} ${s.text}${s.need > 1 ? ` (${s.n}/${s.need})` : ''}`; d.appendChild(l); }
        el.appendChild(d);
      }
    },
    setRoom(code) { $('roomcode').textContent = code ? 'Phòng ' + code : ''; },
    setProgress(p) { const el = $('dig'); el.hidden = p == null; if (p != null) el.firstElementChild.style.width = Math.min(100, p * 100) + '%'; },
    // Mũi tên đỏ quanh tâm chỉ hướng kẻ vừa đánh mình (a = góc so với hướng nhìn, 0 = phía trước, dương = bên trái).
    dmgDir(a) { const el = $('dmgdir'); if (!el) return; el.style.transform = `translate(-50%,-50%) rotate(${-a}rad)`; el.classList.add('on'); clearTimeout(this._dd); this._dd = setTimeout(() => el.classList.remove('on'), 900); },
    flash() { const f = $('flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 150); },
  };
}
