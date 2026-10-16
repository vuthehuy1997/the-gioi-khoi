"""Bộ chạy kiểm thử dùng chung: mở trang trong Chromium ẩn (Playwright).

Tự bật một máy chủ tĩnh tạm trên cổng trống phục vụ thư mục gốc của repo.
Mỗi bài dùng một trang mới với localStorage sạch, mở sẵn ở `start` (đường dẫn tính từ gốc repo).
Bài kiểm thử nhận (pg) hoặc (pg, browser, base); base = địa chỉ trang `start`, root(base) = địa chỉ gốc.
Console có lỗi hoặc có file không tải được thì bài đó hỏng.
"""
import functools, http.server, os, sys, threading, time, traceback
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def root(base):
    """Địa chỉ gốc của máy chủ tạm, ví dụ http://127.0.0.1:1234/"""
    return '/'.join(base.split('/')[:3]) + '/'

def run(tests, start=''):
    only = sys.argv[1:]
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{srv.server_address[1]}/'
    base = origin + start
    failed = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for fn in tests:
            if only and not any(o in fn.__name__ for o in only): continue
            ctx = browser.new_context(viewport={'width': 1100, 'height': 720})
            pg = ctx.new_page(); errs = []
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('requestfailed', lambda r: errs.append('không tải được ' + r.url) if r.url.startswith(origin) else None)
            pg.on('response', lambda r: errs.append(f'{r.status} {r.url}') if r.status >= 400 and r.url.startswith(origin) and not r.url.endswith('favicon.ico') else None)
            t0 = time.time(); note = None
            try:
                pg.goto(base, wait_until='load'); pg.wait_for_timeout(300)
                args = (pg, browser, base) if fn.__code__.co_argcount == 3 else (pg,)
                note = fn(*args)
                assert not errs, 'lỗi console: ' + ' | '.join(dict.fromkeys(errs))[:600]
                print(f'PASS  {fn.__name__:42s} {time.time() - t0:5.1f}s' + (f'  ({note})' if note else ''))
            except Exception as e:
                failed += 1
                kind = 'FAIL' if isinstance(e, AssertionError) else 'ERROR'
                tb = traceback.extract_tb(e.__traceback__)[-1]
                msg = f'dòng {tb.lineno}: {tb.line}' + (f'\n      {e}' if str(e) else '')
                print(f'{kind:5s} {fn.__name__:42s} {time.time() - t0:5.1f}s\n      {msg[:700]}')
                if errs: print('      console:', ' | '.join(dict.fromkeys(errs))[:400])
            finally:
                ctx.close()
        browser.close()
    srv.shutdown()
    print(f'\n{len(tests) if not only else "đã chọn"} bài, {failed} hỏng')
    sys.exit(1 if failed else 0)
