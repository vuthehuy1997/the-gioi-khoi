// Bảng giao diện: kho đồ + chế tạo, hội thoại NPC, cửa hàng, màn hình gục ngã, menu tạm dừng. Chỉ chạm DOM; hành động gửi qua act().
import { RECIPES } from '../content/recipes.js';
import { ITEMS } from '../content/items.js';
import { SHOPS } from '../content/shops.js';
import { countItem } from '../sim/inventory.js';
import { canCraft, stationOf } from '../sim/crafting.js';
import { ARMOR_SLOTS, armorStats } from '../sim/armor.js';
import { slotEl, itemName } from './hud.js';

const $ = id => document.getElementById(id);
const btn = (text, fn, cls = '') => { const b = document.createElement('button'); b.textContent = text; b.className = cls; b.onclick = fn; return b; };

export function createPanels({ act, onClose }) {
  const root = $('panel');
  let kind = null, invCtx = null, shop = null, chest = null;
  const groupOpen = new Map();                                    // nhóm công thức người chơi đã mở/đóng: nhớ giữa các lần vẽ lại
  const SLOT_NAME = { head: 'Mũ', chest: 'Áo', legs: 'Quần', feet: 'Giày' }, KIND_NAME = { heat: 'nóng', cold: 'lạnh', toxic: 'độc' };
  const STATION_NAME = { workbench: 'Bàn chế tạo', furnace: 'Lò nung', anvil: 'Đe rèn' };

  const close = () => { if (kind === 'dialog') act({ t: 'dlg', i: -1 }); kind = null; shop = null; chest = null; root.hidden = true; root.textContent = ''; onClose && onClose(); };
  const open = (k) => { kind = k; root.hidden = false; root.textContent = ''; };
  const head = (title) => { const h = document.createElement('h2'); h.textContent = title; const x = btn('✕', () => close(), 'x'); x.style.float = 'right'; root.append(x, h); };

  // Ô kho: bấm chọn/đổi chỗ; bấm phải = mặc nếu là trang bị.
  function invGrid(you, { onClick, onRight }) {
    const grid = document.createElement('div'); grid.className = 'grid';
    you.inv.forEach((s, i) => {
      const d = slotEl(s, { sel: i === you.sel });
      d.onclick = () => onClick(i, s);
      d.oncontextmenu = e => { e.preventDefault(); onRight && onRight(i, s); };
      grid.appendChild(d);
    });
    return grid;
  }

  function equipmentRow(you) {
    const box = document.createElement('div'); box.className = 'equip';
    const row = document.createElement('div'); row.className = 'equiprow';
    for (const slot of ARMOR_SLOTS) {
      const id = you.armor && you.armor[slot], d = slotEl(id ? { id, n: 1 } : null);
      d.title = id ? `${itemName(id)} (bấm để cởi)` : SLOT_NAME[slot]; d.classList.add('eq');
      if (!id) { const l = document.createElement('em'); l.textContent = SLOT_NAME[slot]; d.appendChild(l); }
      else d.onclick = () => act({ t: 'unequip', slot });
      row.appendChild(d);
    }
    const st = armorStats(you.armor), info = document.createElement('div'); info.className = 'eqinfo';
    const res = Object.entries(st.resist).filter(([, n]) => n > 0).map(([k, n]) => `chống ${KIND_NAME[k]} ${n}/4`).join(' · ');
    info.textContent = `Giáp ${st.def} (giảm ${Math.round(st.reduce * 100)}% sát thương)` + (res ? ' · ' + res : '') + (st.fireproof ? ' · đi được trên nham thạch' : '');
    box.append(row, info);
    return box;
  }

  function renderInventory() {
    const { you, near } = invCtx;
    root.textContent = ''; head('Kho đồ & chế tạo');
    const grid = invGrid(you, {
      onClick: (i) => { if (i < 9) act({ t: 'sel', i }); else act({ t: 'swap', a: i, b: you.sel }); },
      onRight: (i, s) => { if (s && ITEMS[s.id].armor) act({ t: 'equip', i }); },
    });
    const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'Bấm ô trên cùng (1–9) để chọn; bấm ô bên dưới để đổi chỗ với ô đang chọn. Bấm chuột phải vào trang bị để mặc; bấm vào ô trang bị để cởi.';
    const rec = document.createElement('div'); rec.className = 'recipes';
    const stations = Object.entries(near).filter(([, v]) => v).map(([k]) => STATION_NAME[k]);
    const rh = document.createElement('h3'); rh.textContent = 'Công thức' + (stations.length ? ` (gần: ${stations.join(', ')})` : ' (cần đứng gần bàn, lò hay đe cho đồ nâng cao)'); rec.appendChild(rh);
    const groups = [['', 'Thủ công'], ['workbench', 'Bàn chế tạo'], ['furnace', 'Lò nung'], ['anvil', 'Đe rèn']];
    for (const [key, title] of groups) {
      const list = RECIPES.filter(r => (stationOf(r) || '') === key);
      if (!list.length) continue;
      const ready = list.filter(r => canCraft(you.inv, r.id, near)).length;
      const det = document.createElement('details'); det.className = 'recgroup';
      det.open = groupOpen.has(key) ? groupOpen.get(key) : (!key || !!near[key]);          // mặc định: mở nhóm thủ công và nhóm của trạm đang ở gần
      det.ontoggle = () => groupOpen.set(key, det.open);
      const h = document.createElement('summary'); h.textContent = `${title}${key && !near[key] ? ' — chưa ở gần' : ''} · ${ready ? ready + ' chế được' : list.length + ' công thức'}`; if (ready) h.className = 'ready';
      det.appendChild(h); rec.appendChild(det);
      for (const r of list) {
        const ok = canCraft(you.inv, r.id, near);
        const row = document.createElement('div'); row.className = 'rec' + (ok ? ' ok' : '');
        const need = Object.entries(r.in).map(([k, n]) => `${n}× ${itemName(k)}${countItem(you.inv, k) >= n ? '' : ' ✗'}`).join(', ');
        const label = document.createElement('span'); label.textContent = `${r.out.n}× ${itemName(r.out.item)} ← ${need}`;
        const b = btn('Chế', () => act({ t: 'craft', id: r.id })); b.disabled = !ok;
        row.append(label, b); det.appendChild(row);
      }
    }
    root.append(equipmentRow(you), grid, hint, rec);
  }

  function renderChest() {
    const { you } = invCtx, c = chest;
    root.textContent = ''; head('Rương');
    const mv = (from, slot) => act({ t: 'chest-move', x: c.x, y: c.y, z: c.z, from, slot });
    const top = document.createElement('div'); top.className = 'grid';
    c.inv.forEach((s, i) => { const d = slotEl(s); d.onclick = () => s && mv('chest', i); top.appendChild(d); });
    const h2 = document.createElement('h3'); h2.textContent = 'Kho của bạn';
    const grid = invGrid(you, { onClick: (i, s) => s && mv('inv', i) });
    const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'Bấm một ô để chuyển cả chồng sang bên kia.';
    root.append(top, h2, grid, hint);
  }

  return {
    get kind() { return kind; },
    get isOpen() { return kind !== null; },
    close,
    openInventory(ctx) { invCtx = ctx; open('inventory'); renderInventory(); },
    refresh(ctx) { invCtx = ctx; if (kind === 'inventory') renderInventory(); else if (kind === 'chest' && chest) renderChest(); else if (kind === 'shop' && shop) this.showShop(shop, ctx.you); },
    showChest(ev, ctx) { invCtx = ctx; chest = ev; if (kind !== 'chest') open('chest'); renderChest(); },
    showDialog(v) {
      open('dialog'); head(v.npc.name);
      const p = document.createElement('p'); p.textContent = v.text; root.appendChild(p);
      for (const c of v.choices) root.appendChild(btn(c.text, () => act({ t: 'dlg', i: c.i }), 'choice'));
    },
    endDialog() { if (kind === 'dialog') close(); },
    showShop(ev, you) {
      shop = ev; open('shop'); head(ev.name);
      const xu = you ? countItem(you.inv, 'xu') : 0;
      const w = document.createElement('p'); w.textContent = `Bạn có ${xu} xu.`; root.appendChild(w);
      const mk = (title, rows, label, type) => {
        const h = document.createElement('h3'); h.textContent = title; root.appendChild(h);
        for (const r of rows) {
          const row = document.createElement('div'); row.className = 'rec';
          const sp = document.createElement('span'); sp.textContent = `${itemName(r.item)} — ${r.price} xu`;
          row.append(sp, btn(label, () => act({ t: type, item: r.item, n: 1 })), btn(label + ' ×5', () => act({ t: type, item: r.item, n: 5 })));
          root.appendChild(row);
        }
      };
      mk('Mua', ev.sells, 'Mua', 'buy'); mk('Bán', ev.buys, 'Bán', 'sell');
    },
    showDeath(canRespawn) {
      const d = $('death'); d.hidden = false; const b = $('btn-respawn'); b.disabled = !canRespawn;
    },
    hideDeath() { $('death').hidden = true; },
  };
}
