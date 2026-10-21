"""Chụp màn hình giao diện (kho đồ, trang bị, rương) và cảnh có block mới để duyệt: python3 tools/export_ui.py [thư_mục_ra]"""
import functools, http.server, os, sys, threading
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'design')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{srv.server_address[1]}/games/the-gioi-khoi/game.html?debug&net=memory&seed=777&r=5&hw=1'
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    pg = br.new_page(viewport={'width': 1280, 'height': 800}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(base); pg.wait_for_timeout(300); pg.fill('#name', 'V'); pg.click('#btn-new')
    pg.wait_for_function("window.__g && window.__g.S && window.__g.pending === 0", timeout=60000); pg.wait_for_timeout(500)
    setup = """async () => {
      const g = __g, uid = g.S.uid, game = g.game, me = game.player(uid); const wait = ms => new Promise(r => setTimeout(r, ms));
      for (const [id, n] of [['iron_helm', 1], ['ember_boots', 1], ['crystal_chest', 1], ['fur_legs', 1], ['iron_ingot', 12], ['stick', 6], ['pelt', 5], ['charcoal', 4], ['iron_ore', 3], ['planks', 20], ['stone', 30], ['xu', 80], ['prism_blade', 1], ['torch', 8], ['bed', 1], ['chest', 1], ['door', 2], ['glass', 6]]) game.giveItem(uid, id, n);
      const x = Math.floor(me.x), z = Math.floor(me.z);
      const put = (dx, dz, id) => { const y = game.world.surfaceY(x + dx, z + dz) + 1; game.setBlock(x + dx, y, z + dz, id); return y; };
      put(2, 0, 31); put(0, 2, 32); put(-2, 0, 15);                                  // lò, đe, bàn chế tạo quanh người chơi
      for (const [dx, dz, id] of [[3, 3, 33], [4, 3, 34], [5, 3, 35], [6, 3, 36], [7, 3, 37], [8, 3, 38], [9, 3, 39]]) put(dx, dz, id);
      await wait(300); return { x, z };
    }"""
    pg.evaluate(setup)
    pg.keyboard.press('KeyE'); pg.wait_for_timeout(500)
    pg.evaluate("""() => { const sl = [...document.querySelectorAll('#panel .grid .slot')]; const me = __g.game.player(__g.S.uid); const i = me.inv.findIndex(s => s && s.id === 'iron_helm'); sl[i].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); }""")
    pg.wait_for_timeout(400); pg.screenshot(path=os.path.join(OUT, 'ui-kho-do.png'))
    pg.evaluate("""() => { document.getElementById('panel').scrollTop = 9999; }"""); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(OUT, 'ui-cong-thuc.png'))
    pg.evaluate("""async () => { const g = __g, me = g.game.player(g.S.uid), x = Math.floor(me.x) + 3, z = Math.floor(me.z) + 3, y = g.game.world.surfaceY(x, z) + 1; g.panels.close(); g.S.act({ t: 'chest-open', x, y, z }); await new Promise(r => setTimeout(r, 400)); }""")
    pg.wait_for_timeout(300); pg.screenshot(path=os.path.join(OUT, 'ui-ruong.png'))
    pg.evaluate("""() => { __g.panels.close(); const g = __g, me = g.game.player(g.S.uid); me.armor.chest = 'crystal_chest'; me.armor.feet = 'ember_boots'; g.game.touch(me); g.lookAt(me.x + 5, me.y + 1, me.z + 3); }"""); pg.wait_for_timeout(600)
    pg.screenshot(path=os.path.join(OUT, 'canh-khoi-moi.png'))
    br.close()
srv.shutdown(); print('lỗi:', errs or 'không')
