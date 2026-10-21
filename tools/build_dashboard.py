"""Dựng trang Game Design Dashboard từ mẫu + ảnh chụp mã nguồn: python3 tools/build_dashboard.py
Cần chạy trước: python3 tools/export_design_data.py (ghi design/design-data.json). Kết quả: design/dashboard.html (đem đi publish làm Artifact)."""
import datetime, json, os, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(ROOT, 'design', 'design-data.json')))
try: commit = subprocess.check_output(['git', '-C', ROOT, 'rev-parse', '--short', 'HEAD'], text=True).strip()
except Exception: commit = ''
data['meta'] = {'commit': commit, 'generated': datetime.date.today().strftime('%d/%m/%Y')}
blob = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
html = open(os.path.join(ROOT, 'tools', 'dashboard', 'template.html'), encoding='utf-8').read().replace('__SNAP__', blob)
out = os.path.join(ROOT, 'design', 'dashboard.html'); open(out, 'w', encoding='utf-8').write(html)
print('đã ghi', out, round(len(html) / 1024), 'KB, commit', commit)
