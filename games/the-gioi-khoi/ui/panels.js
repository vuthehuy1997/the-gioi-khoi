// Bảng giao diện: kho đồ + chế tạo, hội thoại NPC, cửa hàng, màn hình gục ngã, menu tạm dừng. Chỉ chạm DOM; hành động gửi qua act().
import { RECIPES } from '../content/recipes.js';
import { ITEMS } from '../content/items.js';
import { SHOPS } from '../content/shops.js';
import { countItem } from '../sim/inventory.js';
import { canCraft } from '../sim/crafting.js';
import { slotEl, itemName } from './hud.js';

const $ = id => document.getElementById(id);
const btn = (text, fn, cls = '') => { const b = document.createElement('button'); b.textContent = text; b.className = cls; b.onclick = fn; return b; };

export function createPanels({ act, onClose }) {
  const root = $('panel');
  let kind = null, invCtx = null, shop = null;

  const close = () => { kind = null; shop = null; root.hidden = true; root.textContent = ''; onClose && onClose(); };
  const open = (k) => { kind = k; root.hidden = false; root.textContent = ''; };
  const head = (title) => { const h = document.createElement('h2'); h.textContent = title; const x = btn('✕', () => { if (kind === 'dialog') act({ t: 'dlg', i: -1 }); close(); }, 'x'); x.style.float = 'right'; root.append(x, h); };

  function renderInventory() {
    const { you, nearBench } = invCtx;
    root.textContent = ''; head('Kho đồ & chế tạo');
    const grid = document.createElement('div'); grid.className = 'grid';
    you.inv.forEach((s, i) => {
      const d = slotEl(s, { sel: i === you.sel });
      d.onclick = () => { if (i < 9) act({ t: 'sel', i }); else act({ t: 'swap', a: i, b: you.sel }); };
      grid.appendChild(d);
    });
    const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'Bấm ô trên cùng (1–9) để chọn; bấm ô bên dưới để đổi chỗ với ô đang chọn.';
    const rec = document.createElement('div'); rec.className = 'recipes';
    const rh = document.createElement('h3'); rh.textContent = nearBench ? 'Công thức (đang gần bàn chế tạo)' : 'Công thức (cần bàn chế tạo cho đồ nâng cao)'; rec.appendChild(rh);
    for (const r of RECIPES) {
      const ok = canCraft(you.inv, r.id, nearBench);
      const row = document.createElement('div'); row.className = 'rec' + (ok ? ' ok' : '');
      const need = Object.entries(r.in).map(([k, n]) => `${n}× ${itemName(k)}${countItem(you.inv, k) >= n ? '' : ' ✗'}`).join(', ');
      const label = document.createElement('span'); label.textContent = `${r.out.n}× ${itemName(r.out.item)}${r.bench ? ' 🔨' : ''} ← ${need}`;
      const b = btn('Chế', () => act({ t: 'craft', id: r.id })); b.disabled = !ok;
      row.append(label, b); rec.appendChild(row);
    }
    root.append(grid, hint, rec);
  }

  return {
    get kind() { return kind; },
    get isOpen() { return kind !== null; },
    close,
    openInventory(ctx) { invCtx = ctx; open('inventory'); renderInventory(); },
    refresh(ctx) { if (kind === 'inventory') { invCtx = ctx; renderInventory(); } else if (kind === 'shop' && shop) this.showShop(shop, ctx.you); },
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
