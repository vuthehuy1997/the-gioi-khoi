// HUD: máu, thanh nhanh, vùng, thông báo, thanh máu boss, nhiệm vụ đang làm, mã phòng. Chỉ chạm DOM, không có logic game.
import { ITEMS } from '../content/items.js';

const $ = id => document.getElementById(id);
export const itemName = id => (ITEMS[id] ? ITEMS[id].name : id);
export const itemColor = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h},55%,45%)`; };

let iconOf = null;
export const setIconProvider = fn => { iconOf = fn; };

export function slotEl(s, { sel = false, small = false } = {}) {
  const d = document.createElement('div');
  d.className = 'slot' + (sel ? ' sel' : '');
  if (s) {
    d.title = itemName(s.id);
    d.style.background = `linear-gradient(${itemColor(s.id)}55, #0009)`;
    if (iconOf) { const im = document.createElement('img'); im.src = iconOf(s.id); im.alt = itemName(s.id); im.draggable = false; d.appendChild(im); }
    else { const n = document.createElement('span'); n.textContent = itemName(s.id); d.appendChild(n); }
    if (s.n > 1) { const b = document.createElement('b'); b.textContent = s.n; d.appendChild(b); }
  }
  return d;
}

export function createHud() {
  let toastTimer = null;
  return {
    setHp(hp, max) { $('hp').textContent = `❤ ${Math.ceil(hp)}/${max}`; $('hp').style.color = hp <= max * 0.3 ? '#ff4d4d' : '#ff8a8a'; },
    setHotbar(inv, sel) {
      const h = $('hotbar'); h.textContent = '';
      for (let i = 0; i < 9; i++) { const d = slotEl(inv[i], { sel: i === sel }); const k = document.createElement('i'); k.textContent = i + 1; d.appendChild(k); h.appendChild(d); }
    },
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
