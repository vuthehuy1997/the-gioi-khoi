#!/usr/bin/env python3
"""Kiểm thử bảng Game Design Dashboard (design/dashboard.html) với kho dữ liệu giả lập trong bộ nhớ.
Chạy: python3 tools/build_dashboard.py && python3 tests/test_dashboard.py  (cần design/design-data.json, xem tools/export_design_data.py)"""
import os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = 'file://' + os.path.join(ROOT, 'design', 'dashboard.html')
MOCK = """
(() => {
  const store = new Map(), subs = [];
  const col = p => [...store].filter(([k]) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/')).map(([k, v]) => ({ id: k.slice(p.length + 1), exists: true, data: () => v }));
  const fire = () => subs.forEach(f => f());
  const docRef = p => ({ id: p.split('/').pop(), path: p, get: async () => ({ exists: store.has(p), data: () => store.get(p) }), set: async d => { store.set(p, JSON.parse(JSON.stringify(d))); fire(); }, update: async d => { store.set(p, { ...store.get(p), ...d }); fire(); }, delete: async () => { store.delete(p); fire(); },
    onSnapshot: next => { const f = () => next({ exists: store.has(p), data: () => store.get(p) }); subs.push(f); setTimeout(f, 0); return () => {}; } });
  const colRef = p => ({ path: p, doc: id => docRef(p + '/' + id), onSnapshot: next => { const f = () => { const docs = col(p); next({ docs, size: docs.length, empty: !docs.length }); }; subs.push(f); setTimeout(f, 0); return () => {}; }, get: async () => ({ docs: col(p) }) });
  window.__store = store;
  window.claude = { use: async n => n === 'db' ? { doc: docRef, collection: colRef } : n === 'user' ? { me: async () => ({ id: 'u_test', name: 'Dev', isOwner: true, canEdit: true }), can: async () => true, isOwner: async () => true, canEdit: async () => true } : null };
})();
"""
def main():
    errs = []; fails = 0
    def check(name, cond, info=''):
        nonlocal fails
        print(('PASS  ' if cond else 'FAIL  ') + name + (('  ' + str(info)) if not cond and info else '')); fails += 0 if cond else 1
    with sync_playwright() as p:
        br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1280, 'height': 900})
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
        pg.add_init_script(MOCK); pg.goto(PAGE); pg.wait_for_timeout(500)
        nav = lambda label: pg.click(f'.nav:has-text("{label}")')
        check('tổng quan có số liệu và các ô thống kê', pg.locator('.tile').count() >= 9)
        # viết giới thiệu: lưu vào kho dùng chung
        pg.fill('textarea >> nth=0', 'Game voxel nhiều người chơi.'); pg.click('h2'); pg.wait_for_timeout(300)
        check('giới thiệu được lưu vào docs/overview', pg.evaluate("() => (__store.get('docs/overview') || {}).intro") == 'Game voxel nhiều người chơi.')
        # thực thể: chọn quái, đánh dấu cần sửa và đề xuất
        nav('Thực thể'); pg.click('.tab:has-text("Quái")'); pg.click('.ent:has-text("Sói Xám")'); pg.wait_for_timeout(200)
        check('chi tiết quái hiện số liệu thật', 'Máu' in pg.inner_text('.detail') and '16' in pg.inner_text('.detail'))
        pg.click('.seg button:has-text("Cần sửa")'); pg.wait_for_timeout(150)
        pg.fill('.detail textarea >> nth=1', 'Tăng máu lên 24 và thêm tiếng tru.'); pg.click('.detail h3'); pg.wait_for_timeout(400)
        e = pg.evaluate("() => __store.get('entries/mob__soi-xam')")
        check('trạng thái và đề xuất của quái được lưu', e and e['status'] == 'change' and 'Tăng máu' in e['proposal'], e)
        check('thẻ quái có chấm trạng thái', pg.locator('.ent:has-text("Sói Xám") .dot.change').count() == 1)
        # boss, NPC, vùng, làng
        for tab, who in [('Boss', 'Chúa Đầm Lầy'), ('NPC', 'Ngư Dân'), ('Vùng', 'Núi Lửa Tro'), ('Làng', 'Ốc Đảo')]:
            pg.click(f'.tab:has-text("{tab}")'); pg.click(f'.ent:has-text("{who}")'); pg.wait_for_timeout(120)
            check(f'chi tiết {tab} mở được', who in pg.inner_text('.detail'))
        # lời thoại: đề xuất câu mới
        nav('Lời thoại'); pg.click('.tab:has-text("Thợ Rèn")'); pg.fill('.node >> nth=0 >> textarea', 'Lò rèn nóng rực! Cần gì nào?'); pg.click('h2'); pg.wait_for_timeout(400)
        d = pg.evaluate("() => Object.entries(Object.fromEntries(__store)).filter(([k]) => k.startsWith('entries/dlg__'))")
        check('đề xuất lời thoại được lưu và tự đánh dấu cần sửa', len(d) == 1 and d[0][1]['status'] == 'change' and 'Lò rèn' in d[0][1]['proposal'], d)
        # nhiệm vụ
        nav('Nhiệm vụ'); pg.click('.ent:has-text("Săn sói đêm")'); pg.wait_for_timeout(150)
        check('chi tiết nhiệm vụ có bước và thưởng', 'Hạ 3 con Sói Xám' in pg.inner_text('.detail') and 'phần thưởng' in pg.inner_text('.detail').lower())
        # vật phẩm và công thức
        nav('Vật phẩm'); pg.click('.seg button:has-text("Trang bị")'); pg.click('.ent:has-text("Giày than hồng")'); pg.wait_for_timeout(150)
        t = pg.inner_text('.detail')
        check('vật phẩm hiện loại trang bị, cách chế và nguồn', 'chống nóng' in t and 'đi trên nham thạch' in t and 'Đe rèn' in t, t[:300])
        pg.click('.tab:has-text("Công thức theo trạm")'); check('công thức nhóm theo 4 trạm', pg.locator('.card h3').count() >= 4)
        # kế hoạch: thêm thẻ, gắn thực thể, chuyển cột, gói gửi agent
        nav('Kế hoạch'); pg.fill('#bl-title', 'Thêm hoạt hoạ chết cho quái'); pg.fill('#bl-desc', 'Quái ngã rồi tan ra.'); pg.fill('#bl-ref', 'mob:soi-xam'); pg.press('#bl-ref', 'Enter')
        pg.click('button:has-text("Thêm vào Ý tưởng")'); pg.wait_for_timeout(300)
        check('thẻ kế hoạch được thêm vào cột Ý tưởng', pg.locator('.col:has-text("Ý tưởng") .bcard:has-text("hoạt hoạ chết")').count() == 1)
        pg.click('.bcard:has-text("hoạt hoạ chết") button[aria-label="Tiến cột"]'); pg.wait_for_timeout(300)
        check('chuyển thẻ sang Đã duyệt', pg.locator('.col:has-text("Đã duyệt") .bcard:has-text("hoạt hoạ chết")').count() == 1)
        b = pg.inner_text('#brief')
        check('gói gửi agent gồm đề xuất, lời thoại và thẻ kế hoạch', 'Tăng máu lên 24' in b and 'Lò rèn nóng rực' in b and 'hoạt hoạ chết' in b and 'content/mobs.js' in b and 'mob:soi-xam' in b, b[:400])
        pg.click('.bcard:has-text("hoạt hoạ chết") button:has-text("Xóa")'); pg.click('.bcard:has-text("hoạt hoạ chết") button:has-text("Xóa thật?")'); pg.wait_for_timeout(300)
        check('xóa thẻ cần bấm hai lần', pg.locator('.bcard:has-text("hoạt hoạ chết")').count() == 0)
        nav('Cốt truyện'); check('tuyến tiến trình hiện boss mở vùng', 'Thủ Lĩnh Sói' in pg.inner_text('.main') and 'Núi Lửa Tro' in pg.inner_text('.main'))
        # điện thoại: không cuộn ngang
        pg.set_viewport_size({'width': 400, 'height': 800})
        for lab in ['Tổng quan', 'Thực thể', 'Lời thoại', 'Nhiệm vụ', 'Vật phẩm', 'Kế hoạch', 'Cốt truyện']:
            nav(lab); pg.wait_for_timeout(100)
            w = pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
            check(f'không cuộn ngang ở 400px: {lab}', w <= 1, w)
        check('không lỗi console', not errs, errs[:3])
        br.close()
    print(f'\n{fails} hỏng'); sys.exit(1 if fails else 0)
main()
