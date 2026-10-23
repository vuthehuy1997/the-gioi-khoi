"""Gom toàn bộ nội dung game thành một file JSON (ảnh chụp thiết kế) cho bảng Game Design Dashboard: python3 tools/export_design_data.py [file_ra]
Gồm: lớp vũ khí + hằng số chiến đấu, vùng, quái (cả thú nuôi), boss, NPC + hội thoại, làng, nhiệm vụ, vật phẩm + công thức, cửa hàng, cây trồng + hiệu ứng thức ăn, block, thống kê; kèm ảnh nhỏ (data URI) của mô hình và icon."""
import base64, functools, http.server, io, json, os, sys, threading
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'design', 'design-data.json')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{srv.server_address[1]}/games/the-gioi-khoi/models.html'
os.makedirs(os.path.dirname(OUT), exist_ok=True)

def thumb(png_bytes, size=144):
    im = Image.open(io.BytesIO(png_bytes)).convert('RGB').resize((size, size), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=72, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    pg = br.new_page(viewport={'width': 420, 'height': 420})
    pg.goto(base + '?id=wolf'); pg.wait_for_timeout(300)
    data = pg.evaluate("""async () => {
      const I = p => import(p);
      const [items, recipes, mobs, bosses, npcs, quests, shops, regions, blocks, models, icons, atlas, armor, farming, dungeons, rules] = await Promise.all([
        I('./content/items.js'), I('./content/recipes.js'), I('./content/mobs.js'), I('./content/bosses.js'), I('./content/npcs.js'), I('./content/quests.js'),
        I('./content/shops.js'), I('./content/regions.js'), I('./world/blocks.js'), I('./render/models/index.js'), I('./ui/icons.js'), I('./render/atlas.js'), I('./sim/armor.js'), I('./content/farming.js'), I('./content/dungeons.js'), I('./sim/rules.js')]);
      const ic = icons.createIcons(atlas.makeAtlas());
      return {
        items: items.ITEMS, recipes: recipes.RECIPES, mobs: mobs.MOBS, bosses: bosses.BOSSES, npcs: npcs.NPCS, villages: npcs.VILLAGES, quests: quests.QUESTS, shops: shops.SHOPS,
        weaponClasses: rules.WEAPON_CLS, combat: { staminaMax: rules.STAMINA_MAX, rollCost: rules.ROLL_COST, rollCd: rules.ROLL_CD, sprintCost: rules.SPRINT_COST, bowCost: rules.BOW_COST, parryWindow: rules.PARRY_WINDOW, windupFast: rules.WINDUP_FAST, windupSlow: rules.WINDUP_SLOW },
        crops: farming.CROPS, effects: farming.EFFECTS, dungeons: dungeons.DUNGEONS, dungeonLoot: dungeons.LOOT, traps: dungeons.TRAP, dungeonLayout: dungeons.LAYOUT,
        regions: regions.REGIONS, blocks: blocks.BLOCKS.map(b => ({ id: b.id, name: b.name, hardness: b.hardness, tool: b.tool, tier: b.tier, drop: b.drop, solid: b.solid, plant: !!b.plant, liquid: !!b.liquid })),
        mobModels: models.MOB_MODELS, bossModels: models.BOSS_MODEL, npcModels: models.NPC_MODELS ? Object.keys(models.NPC_MODELS) : [], modelIds: models.ALL_MODEL_IDS,
        icons: Object.fromEntries(Object.keys(items.ITEMS).map(id => [id, ic.get(id)])),
      };
    }""")
    ids = [i for i in data['modelIds'] if not i.startswith('player')]
    imgs = {}
    for i in ids:
        pg.goto(f'{base}?id={i}&walk=0&fit=1&yaw=1.9'); pg.wait_for_timeout(300)
        imgs[i] = thumb(pg.screenshot())
    data['models'] = imgs
    br.close()
srv.shutdown()
json.dump(data, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print('đã ghi', OUT, round(os.path.getsize(OUT) / 1024), 'KB;', {k: (len(v) if hasattr(v, '__len__') else v) for k, v in data.items()})
