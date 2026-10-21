"""Xuất thiết kế mọi sinh vật/NPC/người chơi và block ra file ảnh để duyệt: python3 tools/export_designs.py [thư_mục_ra]
Mỗi thực thể một ảnh ghép 3 góc (trước, nghiêng, sau) + ảnh tổng; thêm atlas block và texture mô hình.
"""
import functools, http.server, os, re, sys, threading
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'design')
PAGE = 'games/the-gioi-khoi/models.html'
YAWS = [('truoc', 3.14159), ('nghieng', 1.9), ('sau', 0)]

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{srv.server_address[1]}/{PAGE}'
os.makedirs(os.path.join(OUT, 'thuc-the'), exist_ok=True)

def slug(i): return re.sub(r'[^a-z0-9]+', '-', i.split('#')[0].replace(':', '-')).strip('-')

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    pg = br.new_page(viewport={'width': 420, 'height': 420})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(base + '?id=wolf'); pg.wait_for_timeout(300)
    ids = pg.evaluate("import('./render/models/index.js').then(m => m.ALL_MODEL_IDS)")
    cards = []
    for i in ids:
        s = slug(i); tmp = []
        for name, yaw in YAWS:
            pg.goto(f'{base}?id={i.replace("#", "%23")}&walk=0&fit=1&yaw={yaw}'); pg.wait_for_timeout(350)
            f = os.path.join(OUT, 'thuc-the', f'_{s}-{name}.png'); pg.screenshot(path=f); tmp.append(f)
        imgs = [Image.open(f).convert('RGB') for f in tmp]
        sheet = Image.new('RGB', (420 * 3, 450), '#1c2230')
        for k, im in enumerate(imgs): sheet.paste(im, (k * 420, 30))
        ImageDraw.Draw(sheet).text((10, 8), i.split('#')[0] + '   (truoc / nghieng / sau)', fill='white')
        sheet.save(os.path.join(OUT, 'thuc-the', f'{s}.png'))
        for f in tmp: os.remove(f)
        cards.append((i, imgs[1]))
    # ảnh tổng
    cols = 6; cw = 210
    rows = (len(cards) + cols - 1) // cols
    ov = Image.new('RGB', (cols * cw, rows * (cw + 20)), '#1c2230'); d = ImageDraw.Draw(ov)
    for k, (i, im) in enumerate(cards):
        x, y = (k % cols) * cw, (k // cols) * (cw + 20)
        ov.paste(im.resize((cw, cw)), (x, y + 20)); d.text((x + 6, y + 5), i.split('#')[0], fill='white')
    ov.save(os.path.join(OUT, 'tong-quan.png'))
    # texture mô hình và atlas block
    pg2 = br.new_page(viewport={'width': 1600, 'height': 900})
    pg2.goto(base + '?sheet=1'); pg2.wait_for_timeout(500)
    pg2.screenshot(path=os.path.join(OUT, 'texture-mo-hinh.png'), full_page=True)
    data = pg.evaluate("""import('./render/atlas.js').then(m => { const r = m.makeAtlas(); const c = r.canvas || r.image || r; return c.toDataURL ? c.toDataURL() : null })""")
    if data:
        import base64
        raw = base64.b64decode(data.split(',')[1]); a = Image.open(__import__('io').BytesIO(raw)).convert('RGBA')
        a = a.resize((a.width * 6, a.height * 6), Image.NEAREST); a.save(os.path.join(OUT, 'atlas-block.png'))
    br.close()
srv.shutdown()
print('lỗi:', errs or 'không'); print('đã ghi', OUT)
