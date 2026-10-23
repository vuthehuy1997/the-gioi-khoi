// HUD: máu, thanh nhanh, vùng, thông báo, thanh máu boss, nhiệm vụ đang làm, mã phòng. Chỉ chạm DOM, không có logic game.
import { ITEMS } from '../content/items.js';
import { EFFECTS } from '../content/farming.js';
import { foodIcon, fxIcon } from './icons.js';

const $ = id => document.getElementById(id);
export const itemName = id => (ITEMS[id] ? ITEMS[id].name : id);
// Chú giải vật phẩm nhiều dòng (tên, thức ăn, hiệu ứng, rủi ro, công dụng); dùng làm title của ô kho và thanh nhanh.
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
  if (it.dmg > 1 && it.tool) lines.push(`Sát thương ${it.dmg}`);
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
    setHp(hp, max) { $('hp').textContent = `❤ ${Math.ceil(hp)}/${max}`; $('hp').style.color = hp <= max * 0.3 ? '#ff4d4d' : '#ff8a8a'; },
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
      for (const q of list) {
        const d = document.createElement('div'); d.className = 'q ' + q.state;
        const t = document.createElement('b'); t.textContent = q.name + (q.state === 'ready' ? ' ✔ (về báo)' : ''); d.appendChild(t);
        for (const s of q.steps) { const l = document.createElement('div'); l.textContent = `${s.n >= s.need ? '✔' : '•'} ${s.text}${s.need > 1 ? ` (${s.n}/${s.need})` : ''}`; d.appendChild(l); }
        el.appendChild(d);
      }
    },
    setRoom(code) { $('roomcode').textContent = code ? 'Phòng ' + code : ''; },
    setProgress(p) { const el = $('dig'); el.hidden = p == null; if (p != null) el.firstElementChild.style.width = Math.min(100, p * 100) + '%'; },
    flash() { const f = $('flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 150); },
  };
}
