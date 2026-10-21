"""Xuất mọi icon vật phẩm (và atlas block) thành ảnh để duyệt: python3 tools/export_icons.py [thư_mục_ra]
Mỗi ô: icon phóng 3 lần + id. Nhóm theo loại."""
import base64, functools, http.server, io, os, sys, threading
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'design')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{srv.server_address[1]}/games/the-gioi-khoi/models.html?id=wolf'
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    pg = br.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(base); pg.wait_for_timeout(300)
    data = pg.evaluate("""async () => {
      const { createIcons } = await import('./ui/icons.js'); const { makeAtlas } = await import('./render/atlas.js'); const { ITEMS } = await import('./content/items.js');
      const icons = createIcons(makeAtlas()); return Object.keys(ITEMS).map(id => [id, ITEMS[id].name, icons.get(id)]);
    }""")
    br.close()
srv.shutdown()
S, cols = 96, 10
rows = (len(data) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (S + 10), rows * (S + 34)), '#2a3040'); d = ImageDraw.Draw(sheet)
for i, (iid, name, url) in enumerate(data):
    im = Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGBA').resize((S, S), Image.NEAREST)
    x, y = (i % cols) * (S + 10) + 5, (i // cols) * (S + 34) + 4
    d.rectangle([x, y, x + S, y + S], fill='#444b5e'); sheet.paste(im, (x, y), im); d.text((x, y + S + 2), iid[:16], fill='white')
sheet.save(os.path.join(OUT, 'icon-vat-pham.png')); print('lỗi:', errs or 'không', len(data), 'icon')
