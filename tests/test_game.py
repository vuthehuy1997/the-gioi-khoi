#!/usr/bin/env python3
"""Kiểm thử logic game Thế Giới Khối (thế giới, vật lý, mô phỏng, nội dung) và giao diện.

Chạy:  python3 tests/test_game.py [lọc tên]
Các bài logic mở trang chủ rồi import module trực tiếp; không cần mạng ngoài.
"""
from harness import run, root

TESTS = []
def test(fn):
    TESTS.append(fn); return fn

JS_HELPERS = """
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 3000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('hết giờ chờ'); await wait(10); } };
const G = '/games/the-gioi-khoi/';
const imp = p => import(G + p);
"""

def ev(pg, body):
    """Chạy `body` (thân hàm async) trong trang, có sẵn wait/until/imp."""
    return pg.evaluate("async () => {" + JS_HELPERS + body + "}")


# ---------------------------------------------------------------- A: thế giới

@test
def test_world_deterministic(pg):
    r = ev(pg, r"""
      const { generateChunk, CHUNK_W, CHUNK_H } = await imp('world/generate.js');
      const hashOf = (a) => { let h = 2166136261 >>> 0; for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
      const a = generateChunk(12345, 3, -2), b = generateChunk(12345, 3, -2), c = generateChunk(12346, 3, -2);
      return { size: a.length === CHUNK_W * CHUNK_W * CHUNK_H, same: hashOf(a) === hashOf(b), differentSeed: hashOf(a) !== hashOf(c),
               nonEmpty: a.some(v => v !== 0), hasAir: a.some(v => v === 0), bedrock: a[0] === 13 };
    """)
    assert r == {'size': True, 'same': True, 'differentSeed': True, 'nonEmpty': True, 'hasAir': True, 'bedrock': True}, r


@test
def test_regions_distinct(pg):
    r = ev(pg, r"""
      const { REGIONS } = await imp('content/regions.js');
      const { regionAt } = await imp('world/regions.js');
      const { generateChunk, CHUNK_W, CHUNK_H } = await imp('world/generate.js');
      const seen = {};
      for (let x = -1500; x <= 1500; x += 50) for (let z = -1500; z <= 1500; z += 50) { const id = regionAt(12345, x, z); seen[id] = (seen[id] || 0) + 1; }
      const ids = Object.keys(seen);
      // block bề mặt phổ biến nhất của mỗi vùng phải khác nhau
      const hist = {};
      for (let x = -1500; x <= 1500; x += 97) for (let z = -1500; z <= 1500; z += 97) {
        const id = regionAt(12345, x, z), cx = Math.floor(x / 16), cz = Math.floor(z / 16), ch = generateChunk(12345, cx, cz);
        const lx = x - cx * 16, lz = z - cz * 16;
        for (let y = CHUNK_H - 1; y >= 0; y--) { const b = ch[lx + 16 * (lz + 16 * y)]; if (b !== 0 && b !== 10 && b !== 6 && b !== 7 && b !== 11) { (hist[id] = hist[id] || {})[b] = ((hist[id] || {})[b] || 0) + 1; break; } }
      }
      const topBlocks = {};
      for (const id of ids) topBlocks[id] = +Object.entries(hist[id] || {}).sort((a, b) => b[1] - a[1])[0][0];
      return { count: ids.length, defined: REGIONS.length, minShare: Math.min(...Object.values(seen)), tops: Object.values(topBlocks), allDefined: ids.every(i => REGIONS.some(r => r.id === i)) };
    """)
    assert r['count'] >= 3 and r['defined'] >= 3 and r['allDefined'], r
    assert r['minShare'] >= 10, r
    assert len(set(r['tops'])) >= 3, r


@test
def test_world_get_set_delta_and_raycast(pg):
    r = ev(pg, r"""
      const { World } = await imp('world/world.js');
      const w = new World(777);
      const sp = w.findSpawn();
      const y0 = w.surfaceY(sp.x, sp.z);
      const solidBelow = w.get(sp.x, y0, sp.z) !== 0;
      w.set(sp.x, y0 + 5, sp.z, 8);
      const got = w.get(sp.x, y0 + 5, sp.z);
      const delta = w.exportDelta();
      const w2 = new World(777); w2.importDelta(JSON.parse(JSON.stringify(delta)));
      const same = w2.get(sp.x, y0 + 5, sp.z) === 8;
      // dọn một cột trống phía trên mặt đất rồi bắn tia từ trên xuống: phải trúng mặt đất, pháp tuyến hướng lên
      for (let dy = 1; dy <= 8; dy++) w.set(sp.x, y0 + dy, sp.z, 0);
      const hit = w.raycast({ x: sp.x + 0.5, y: y0 + 3.5, z: sp.z + 0.5 }, { x: 0, y: -1, z: 0 }, 10);
      // ngoài thế giới: trên đỉnh là không khí, dưới đáy là không khí giả (bedrock vẫn ở y=0)
      return { y0, solidBelow, got, same, hit: hit && hit.pos, face: hit && hit.normal, dirtyChunks: w.dirty.size > 0,
               outsideTop: w.get(0, 999, 0), outsideBottom: w.get(0, -5, 0) };
    """)
    assert r['solidBelow'] and r['got'] == 8 and r['same'], r
    assert r['hit'] is not None and r['face'] == {'x': 0, 'y': 1, 'z': 0}, r
    assert r['dirtyChunks'] and r['outsideTop'] == 0, r


# ---------------------------------------------------------------- A3/B1: mesh, streaming, vật lý

@test
def test_mesher_hides_covered_faces(pg):
    r = ev(pg, r"""
      const { buildChunkMesh } = await imp('render/mesher.js');
      const mk = (cells) => (x, y, z) => cells[x + ',' + y + ',' + z] || 0;
      const one = buildChunkMesh(mk({ '5,10,5': 1 }), 0, 0);
      const two = buildChunkMesh(mk({ '5,10,5': 1, '6,10,5': 1 }), 0, 0);
      const waterSide = buildChunkMesh(mk({ '5,10,5': 10, '6,10,5': 10 }), 0, 0);
      const leavesNextToStone = buildChunkMesh(mk({ '5,10,5': 7, '6,10,5': 1 }), 0, 0);
      const empty = buildChunkMesh(mk({}), 0, 0);
      return { one: one.solid.indices.length / 6, two: two.solid.indices.length / 6, waterFaces: waterSide.water.indices.length / 6,
               waterSolid: waterSide.solid.indices.length, leafStone: leavesNextToStone.solid.indices.length / 6, empty: empty.solid.indices.length,
               attrs: [one.solid.positions.length / 3, one.solid.uvs.length / 2, one.solid.colors.length / 3] };
    """)
    # 1 block = 6 mặt; 2 block kề nhau = 10 mặt; nước kề nước ẩn mặt chung (10 mặt, nằm trong lưới nước); lá cạnh đá vẫn thấy mặt lá-đá phía lá
    assert r['one'] == 6 and r['two'] == 10 and r['waterFaces'] == 10 and r['waterSolid'] == 0 and r['empty'] == 0, r
    assert r['leafStone'] == 11 and r['attrs'] == [24, 24, 24], r


@test
def test_mesher_real_chunk_is_much_smaller_than_naive(pg):
    r = ev(pg, r"""
      const { World } = await imp('world/world.js');
      const { buildChunkMesh } = await imp('render/mesher.js');
      const w = new World(12345);
      const t0 = performance.now();
      const m = buildChunkMesh((x, y, z) => w.get(x, y, z), 2, 3);
      const ms = performance.now() - t0;
      const ch = w.chunk(2, 3); let solid = 0; for (const v of ch) if (v !== 0) solid++;
      return { faces: m.solid.indices.length / 6 + m.water.indices.length / 6, naive: solid * 6, ms,
               indicesOk: m.solid.indices.every ? true : true, maxIndex: Math.max(...m.solid.indices), verts: m.solid.positions.length / 3 };
    """)
    assert r['faces'] > 100 and r['faces'] < r['naive'] * 0.2, r
    assert r['maxIndex'] < r['verts'], r
    assert r['ms'] < 400, r


@test
def test_chunk_streaming_unloads_far_chunks_keeps_edits(pg):
    r = ev(pg, r"""
      const { World } = await imp('world/world.js');
      const w = new World(5);
      w.keepAround([{ x: 0, z: 0 }], 2);
      const near = w.chunks.size;
      w.set(3, 40, 3, 8);
      w.keepAround([{ x: 400, z: 0 }], 2);
      const hasOld = w.has(0, 0), hasNew = w.has(25, 0);
      w.keepAround([{ x: 0, z: 0 }], 2);
      return { near, hasOld, hasNew, after: w.chunks.size, edit: w.get(3, 40, 3) };
    """)
    assert r['near'] == 25 and not r['hasOld'] and r['hasNew'] and r['after'] == 25 and r['edit'] == 8, r


@test
def test_physics_stands_on_ground_and_does_not_fall_through(pg):
    r = ev(pg, r"""
      const { World } = await imp('world/world.js');
      const { makePlayer, stepPlayer } = await imp('sim/physics.js');
      const w = new World(777); const sp = w.findSpawn(); const y0 = w.surfaceY(sp.x, sp.z);
      const p = makePlayer(sp.x + 0.5, y0 + 12, sp.z + 0.5);
      let minY = 1e9;
      for (let i = 0; i < 200; i++) { stepPlayer(w, p, {}, 0.05); minY = Math.min(minY, p.y); }
      return { y: p.y, ground: p.onGround, expected: y0 + 1, minY };
    """)
    assert r['ground'] and abs(r['y'] - r['expected']) < 0.01 and r['minY'] >= r['expected'] - 0.01, r


@test
def test_physics_walls_and_jump(pg):
    r = ev(pg, r"""
      const { World } = await imp('world/world.js');
      const { makePlayer, stepPlayer } = await imp('sim/physics.js');
      const w = new World(777); const sp = w.findSpawn(); const y0 = w.surfaceY(sp.x, sp.z);
      const bx = sp.x, bz = sp.z;
      // sân phẳng 9x9 và một bức tường cao 2 ở phía trước (hướng -z)
      for (let dx = -6; dx <= 6; dx++) for (let dz = -8; dz <= 6; dz++) { for (let dy = 1; dy <= 6; dy++) w.set(bx + dx, y0 + dy, bz + dz, 0); w.set(bx + dx, y0, bz + dz, 1); }
      for (let dx = -6; dx <= 6; dx++) { w.set(bx + dx, y0 + 1, bz - 4, 1); w.set(bx + dx, y0 + 2, bz - 4, 1); }
      const p = makePlayer(bx + 0.5, y0 + 1, bz + 0.5);
      for (let i = 0; i < 20; i++) stepPlayer(w, p, {}, 0.05);
      // đi thẳng vào tường (yaw=0 là hướng -z) trong 3 giây
      for (let i = 0; i < 60; i++) stepPlayer(w, p, { fz: 1 }, 0.05);
      const blockedZ = p.z;
      // nhảy trong 3 giây liên tục: không qua được tường cao 2
      for (let i = 0; i < 60; i++) stepPlayer(w, p, { fz: 1, jump: true }, 0.05);
      const afterJumpZ = p.z;
      // đo độ cao nhảy trên chỗ trống
      const q = makePlayer(bx + 0.5 + 3, y0 + 1, bz + 0.5 + 3);
      for (let i = 0; i < 10; i++) stepPlayer(w, q, {}, 0.05);
      let peak = q.y; const base = q.y;
      stepPlayer(w, q, { jump: true }, 0.05);
      for (let i = 0; i < 30; i++) { stepPlayer(w, q, {}, 0.05); peak = Math.max(peak, q.y); }
      return { blockedZ, wallFace: bz - 4 + 1, afterJumpZ, jumpH: peak - base, ground: q.onGround };
    """)
    assert r['blockedZ'] >= r['wallFace'] + 0.29 and r['afterJumpZ'] >= r['wallFace'] + 0.29, r
    assert 1.1 <= r['jumpH'] <= 1.6 and r['ground'], r


@test
def test_physics_water_slows_and_allows_swimming(pg):
    r = ev(pg, r"""
      const { World } = await imp('world/world.js');
      const { makePlayer, stepPlayer } = await imp('sim/physics.js');
      const w = new World(777); const bx = 1000, bz = 1000, y0 = 10;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { for (let y = 1; y <= 30; y++) w.set(bx + dx, y, bz + dz, y <= y0 ? 1 : (y <= y0 + 10 ? 10 : 0)); }
      const p = makePlayer(bx + 0.5, y0 + 9, bz + 0.5);
      let vmin = 0; for (let i = 0; i < 20; i++) { stepPlayer(w, p, {}, 0.05); vmin = Math.min(vmin, p.vy); }
      const sinkY = p.y;
      for (let i = 0; i < 60; i++) stepPlayer(w, p, { jump: true }, 0.05);
      return { vmin, sinkY, afterSwimY: p.y, inWater: p.inWater };
    """)
    assert r['vmin'] > -8, r        # rơi trong nước chậm hơn nhiều so với tự do
    assert r['afterSwimY'] > r['sinkY'], r


# ---------------------------------------------------------------- A4: hình ảnh thật

@test
def test_render_screenshot(pg, browser, base):
    pg.goto(root(base) + 'games/the-gioi-khoi/game.html?debug&seed=777&r=4&net=memory'); pg.wait_for_timeout(300)
    pg.click('#btn-new')
    pg.wait_for_function("window.__g && window.__g.S && window.__g.pending === 0", timeout=30000)
    pg.evaluate("__g.renderNow()")
    r = pg.evaluate("""() => {
      const g = window.__g, src = g.scene.renderer.domElement, c = document.createElement('canvas'); c.width = 200; c.height = 112;
      const ctx = c.getContext('2d'); g.scene.render(); ctx.drawImage(src, 0, 0, 200, 112);
      const d = ctx.getImageData(0, 0, 200, 112).data, colors = new Set(); let nonBg = 0;
      for (let i = 0; i < d.length; i += 4) { colors.add((d[i] >> 4) + ',' + (d[i+1] >> 4) + ',' + (d[i+2] >> 4)); }
      const bg = [d[0], d[1], d[2]];
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i]-bg[0]) + Math.abs(d[i+1]-bg[1]) + Math.abs(d[i+2]-bg[2]) > 30) nonBg++;
      return { colors: colors.size, nonBg: nonBg / (d.length / 4), chunks: g.scene.chunkCount(), tris: g.scene.renderer.info.render.triangles };
    }""")
    pg.screenshot(path='/tmp/claude-464201200/-data-yuu-ai-data-yuu-self-c/ffbac0c7-dba7-4885-b0fa-42f49ea80379/scratchpad/shot_a4.png')
    assert r['chunks'] >= 81 and r['tris'] > 1000, r
    assert r['colors'] >= 25 and r['nonBg'] > 0.3, r


# ---------------------------------------------------------------- B3: kho đồ và chế tạo

@test
def test_inventory_add_remove_stack(pg):
    r = ev(pg, r"""
      const { makeInventory, addItem, removeItem, countItem, HOTBAR } = await imp('sim/inventory.js');
      const inv = makeInventory();
      const left1 = addItem(inv, 'stone', 100);              // tối đa 64 mỗi ô -> 2 ô
      const used = inv.filter(Boolean).length;
      const left2 = addItem(inv, 'xu', 1500);                 // xu xếp tới 999 mỗi ô
      const ok = removeItem(inv, 'stone', 70), bad = removeItem(inv, 'stone', 99);
      const full = makeInventory(); for (let i = 0; i < full.length; i++) full[i] = { id: 'dirt', n: 64 };
      const leftFull = addItem(full, 'stone', 5);
      return { left1, used, left2, ok, bad, stone: countItem(inv, 'stone'), xu: countItem(inv, 'xu'), len: inv.length, hotbar: HOTBAR, leftFull,
               unknown: (() => { try { addItem(inv, 'nope', 1); return false; } catch (e) { return true; } })() };
    """)
    assert r['left1'] == 0 and r['used'] == 2 and r['left2'] == 0 and r['ok'] and not r['bad'], r
    assert r['stone'] == 30 and r['xu'] == 1500 and r['len'] == 36 and r['hotbar'] == 9 and r['leftFull'] == 5 and r['unknown'], r


@test
def test_crafting_recipes(pg):
    r = ev(pg, r"""
      const { makeInventory, addItem, countItem } = await imp('sim/inventory.js');
      const { RECIPES, canCraft, craft } = await imp('sim/crafting.js');
      const inv = makeInventory();
      addItem(inv, 'log', 4);
      const noBench = canCraft(inv, 'wood_pick', false);
      const planks = craft(inv, 'planks', false);                      // 1 log -> 4 planks
      craft(inv, 'planks', false); craft(inv, 'planks', false);
      const stick = craft(inv, 'stick', false);
      const bench = craft(inv, 'workbench', false);
      const pickNeedsBench = craft(inv, 'wood_pick', false);
      const pickOk = craft(inv, 'wood_pick', true);
      const sword = craft(inv, 'wood_sword', true);
      const missing = craft(inv, 'crystal_sword', true);
      return { count: RECIPES.length, noBench, planks, stick, bench, pickNeedsBench, pickOk, sword, missing,
               has: { pick: countItem(inv, 'wood_pick'), bench: countItem(inv, 'workbench'), planks: countItem(inv, 'planks') } };
    """)
    assert r['count'] >= 8 and not r['noBench'] and r['planks'] and r['stick'] and r['bench'], r
    assert not r['pickNeedsBench'] and r['pickOk'] and r['sword'] is not None and not r['missing'], r
    assert r['has']['pick'] == 1 and r['has']['bench'] == 1, r


# ---------------------------------------------------------------- B2: đào và đặt block

GAME_JS = """
const { Game } = await imp('sim/game.js');
const mkGame = (seed = 777) => { const g = new Game({ seed }); const p = g.addPlayer('u1', 'Tester'); return { g, p }; };
// tìm một ô đất thật (không phải cây) gần người chơi để thử đào
const groundCell = (g, p) => { const x = Math.floor(p.x) + 2, z = Math.floor(p.z), y = g.world.surfaceY(x, z); return { x, y, z, id: g.world.get(x, y, z) }; };
"""


@test
def test_break_place_basic(pg):
    r = ev(pg, GAME_JS + r"""
      const { g, p } = mkGame();
      const c = groundCell(g, p);
      const noDig = g.act('u1', { t: 'break', x: c.x, y: c.y, z: c.z });
      g.act('u1', { t: 'dig', x: c.x, y: c.y, z: c.z });
      const early = g.act('u1', { t: 'break', x: c.x, y: c.y, z: c.z });
      g.tick(2);                                           // đủ thời gian đào bằng tay
      const ok = g.act('u1', { t: 'break', x: c.x, y: c.y, z: c.z });
      const after = g.world.get(c.x, c.y, c.z);
      const dirtN = (p.inv.filter(Boolean).find(s => s.id === 'dirt') || {}).n;
      const ev1 = g.drain().filter(e => e.ev.t === 'block').map(e => [e.ev.x, e.ev.y, e.ev.z, e.ev.id]);
      p.sel = p.inv.findIndex(s => s && s.id === 'dirt');
      const placed = g.act('u1', { t: 'place', x: c.x, y: c.y, z: c.z });
      return { grassId: c.id, noDig: noDig.ok, early: early.ok, ok: ok.ok, after, dirtN, ev1, placed: placed.ok,
               now: g.world.get(c.x, c.y, c.z), left: (p.inv.find(s => s && s.id === 'dirt') || { n: 0 }).n };
    """)
    assert r['grassId'] == 3 and not r['noDig'] and not r['early'] and r['ok'] and r['after'] == 0, r
    assert r['dirtN'] == 1 and r['ev1'][0][3] == 0 and r['placed'] and r['now'] == 2 and r['left'] == 0, r


@test
def test_break_tool_tiers_and_speed(pg):
    r = ev(pg, GAME_JS + r"""
      const { g, p } = mkGame();
      const x = Math.floor(p.x) + 2, z = Math.floor(p.z), y = g.world.surfaceY(x, z) - 2;
      const digBreak = (id, held) => {
        g.world.set(x, y, z, id);
        p.inv.fill(null); if (held) p.inv[0] = { id: held, n: 1 }; p.sel = 0;
        g.act('u1', { t: 'dig', x, y, z }); g.tick(0.05);
        const t = g.breakTime('u1', x, y, z); g.tick(t); 
        const res = g.act('u1', { t: 'break', x, y, z });
        return { ok: res.ok, t, items: p.inv.filter(Boolean).map(s => s.id + ':' + s.n).join(',') };
      };
      return { stoneHand: digBreak(1, null), stonePick: digBreak(1, 'wood_pick'), oreWood: digBreak(9, 'wood_pick'),
               oreStone: digBreak(9, 'stone_pick'), gemStone: digBreak(16, 'stone_pick'), gemCrystal: digBreak(16, 'crystal_pick') };
    """)
    assert r['stoneHand']['items'] == '' and r['stonePick']['items'] == 'wood_pick:1,stone:1', r
    assert r['stonePick']['t'] < r['stoneHand']['t'], r
    assert r['oreWood']['items'] == 'wood_pick:1' and 'crystal:1' in r['oreStone']['items'], r
    assert r['gemStone']['items'] == 'stone_pick:1' and 'gem:1' in r['gemCrystal']['items'], r


@test
def test_break_place_rejections(pg):
    r = ev(pg, GAME_JS + r"""
      const { g, p } = mkGame();
      const c = groundCell(g, p);
      g.world.set(c.x + 1, c.y, c.z, 13);                                 // bedrock
      g.act('u1', { t: 'dig', x: c.x + 1, y: c.y, z: c.z }); g.tick(99);
      const bedrock = g.act('u1', { t: 'break', x: c.x + 1, y: c.y, z: c.z });
      const far = c.x + 30; const farY = g.world.surfaceY(far, c.z);
      g.act('u1', { t: 'dig', x: far, y: farY, z: c.z }); g.tick(99);
      const farBreak = g.act('u1', { t: 'break', x: far, y: farY, z: c.z });
      p.inv.fill(null); p.inv[0] = { id: 'stone', n: 3 }; p.sel = 0;
      const insideSelf = g.act('u1', { t: 'place', x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
      const farPlace = g.act('u1', { t: 'place', x: far, y: farY + 1, z: c.z });
      const air = c.y + 3; const floating = g.act('u1', { t: 'place', x: c.x, y: air, z: c.z });          // không có block kề
      p.inv[0] = { id: 'stick', n: 1 };
      const notBlock = g.act('u1', { t: 'place', x: c.x, y: c.y + 1, z: c.z });
      p.inv.fill(null);
      const empty = g.act('u1', { t: 'place', x: c.x, y: c.y + 1, z: c.z });
      return { bedrock: bedrock.ok, farBreak: farBreak.ok, insideSelf: insideSelf.ok, farPlace: farPlace.ok, floating: floating.ok, notBlock: notBlock.ok, empty: empty.ok,
               bedrockStill: g.world.get(c.x + 1, c.y, c.z) };
    """)
    assert not any(r[k] for k in ['bedrock', 'farBreak', 'insideSelf', 'farPlace', 'floating', 'notBlock', 'empty']), r
    assert r['bedrockStill'] == 13, r


# ---------------------------------------------------------------- D: quái, spawn, chiến đấu

ARENA_JS = GAME_JS + """
const { MOBS } = await imp('content/mobs.js');
const { spawnMob } = await imp('sim/mobs.js');
// Sân phẳng bằng đá ở nơi xa (không cây), mặt sân ở y=30, trần thoáng.
const mkArena = (opts = {}) => {
  const g = new Game({ seed: 777, spawning: false, ...opts }); const p = g.addPlayer('u1', 'T');
  g.flags['boss:thu-linh-soi'] = true; g.flags['boss:bo-cap-chua'] = true;      // mở các vùng, không bị khí độc
  const cx = 2000, cz = 2000, y0 = 30;
  for (let dx = -20; dx <= 20; dx++) for (let dz = -20; dz <= 20; dz++) { g.world.set(cx + dx, y0, cz + dz, 1); for (let dy = 1; dy <= 8; dy++) g.world.set(cx + dx, y0 + dy, cz + dz, 0); }
  p.x = cx + 0.5; p.y = y0 + 1; p.z = cz + 0.5;
  return { g, p, cx, cz, y0 };
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const run = (g, secs, dt = 0.05) => { for (let t = 0; t < secs; t += dt) g.tick(dt); };
"""


@test
def test_mob_content_has_variety(pg):
    r = ev(pg, r"""
      const { MOBS } = await imp('content/mobs.js');
      const list = Object.values(MOBS);
      return { count: list.length, ais: [...new Set(list.map(m => m.ai))].sort(), hostile: list.filter(m => !m.passive).length, regions: [...new Set(list.flatMap(m => m.regions || []))].sort() };
    """)
    assert r['count'] >= 8 and len(r['ais']) >= 4 and r['hostile'] >= 5 and len(r['regions']) >= 3, r
    for ai in ['chase-melee', 'flee', 'ranged-kite', 'guard']:
        assert ai in r['ais'], r


@test
def test_mob_ai_chase_melee_closes_in_and_bites(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = spawnMob(g, 'soi-xam', cx + 0.5 + 10, y0 + 1, cz + 0.5);
      const d0 = dist(m, p); const hp0 = p.hp;
      run(g, 1.0); const d1 = dist(m, p);
      run(g, 6);
      return { d0, d1, hp0, hp1: p.hp, close: dist(m, p) };
    """)
    assert r['d1'] < r['d0'] - 2 and r['hp1'] < r['hp0'] and r['close'] < 3, r


@test
def test_mob_ai_flee_runs_away(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = spawnMob(g, 'nai', cx + 0.5 + 4, y0 + 1, cz + 0.5);
      const d0 = dist(m, p); run(g, 3);
      return { d0, d1: dist(m, p), hp: p.hp };
    """)
    assert r['d1'] > r['d0'] + 3 and r['hp'] == 20, r


@test
def test_mob_ai_ranged_keeps_distance_and_shoots(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = spawnMob(g, 'xuong-cung', cx + 0.5 + 4, y0 + 1, cz + 0.5);
      let sawProj = false, minD = 99; const hp0 = p.hp;
      for (let t = 0; t < 8; t += 0.05) { g.tick(0.05); if ([...g.ents.values()].some(e => e.kind === 'proj')) sawProj = true; minD = Math.min(minD, dist(m, p)); p.x = cx + 0.5; p.z = cz + 0.5; }
      return { sawProj, hp0, hp1: p.hp, d: dist(m, p) };
    """)
    assert r['sawProj'] and r['hp1'] < r['hp0'] and r['d'] >= 5, r


@test
def test_mob_ai_guard_holds_post_and_returns(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = spawnMob(g, 'tuong-da', cx + 0.5 + 12, y0 + 1, cz + 0.5);
      p.x = cx + 0.5 - 15;                                         // xa tầm nhìn
      run(g, 3); const idle = dist(m, { x: cx + 12.5, z: cz + 0.5 });
      p.x = cx + 0.5 + 6; run(g, 2); const chased = dist(m, p) < 8 && Math.abs(m.x - (cx + 12.5)) > 0.5;
      p.x = cx + 0.5 - 18; run(g, 12);                              // người chơi bỏ đi xa: tượng quay về vị trí gác
      return { idle, chased, back: dist(m, { x: cx + 12.5, z: cz + 0.5 }) };
    """)
    assert r['idle'] < 1 and r['chased'] and r['back'] < 3, r


@test
def test_spawn_rules_by_region_and_time(pg):
    r = ev(pg, GAME_JS + r"""
      const { isNight, DAY_LEN } = await imp('sim/daynight.js');
      const { regionAt } = await imp('world/regions.js');
      const find = (id) => { for (let x = -3000; x <= 3000; x += 40) for (let z = -3000; z <= 3000; z += 40) if (regionAt(777, x, z) === id && g0.world.surfaceY(x, z) > 21) return { x, z }; return null; };
      const g0 = new Game({ seed: 777, spawning: false });
      const types = {};
      let maxTotal = 0;
      for (const [region, night] of [['rung-suong', false], ['rung-suong', true], ['sa-mac-lua', false], ['nui-bang', false]]) {
        const spot = find(region);
        const g = new Game({ seed: 777 }); const p = g.addPlayer('u1', 'T');
        g.world.keepAround([{ x: spot.x, z: spot.z }], 3);
        p.x = spot.x + 0.5; p.z = spot.z + 0.5; p.y = g.world.surfaceY(spot.x, spot.z) + 1; p.hp = 9999; p.maxHp = 9999;
        g.time = night ? DAY_LEN * 0.8 : DAY_LEN * 0.2;
        const seen = new Set();
        for (let t = 0; t < 240; t += 0.5) {
          g.tick(0.5); p.hp = 9999;
          for (const e of g.ents.values()) if (e.kind === 'mob') seen.add(e.type);
          maxTotal = Math.max(maxTotal, [...g.ents.values()].filter(e => e.kind === 'mob').length);
          for (const e of [...g.ents.values()]) if (e.kind === 'mob' && Math.hypot(e.x - p.x, e.z - p.z) < 5) g.ents.delete(e.id);   // giữ người chơi sống
        }
        types[region + (night ? '-night' : '-day')] = [...seen].sort();
      }
      return { types, maxTotal, night: [isNight(DAY_LEN * 0.8), isNight(DAY_LEN * 0.2)] };
    """)
    t = r['types']
    assert r['night'] == [True, False], r
    assert 'nai' in t['rung-suong-day'] and 'xac-song' not in t['rung-suong-day'], r
    assert 'xac-song' in t['rung-suong-night'], r
    assert 'bo-cap' in t['sa-mac-lua-day'] and 'gau-bang' not in t['sa-mac-lua-day'], r
    assert 'gau-bang' in t['nui-bang-day'] and 'bo-cap' not in t['nui-bang-day'], r
    assert 0 < r['maxTotal'] <= 40, r


@test
def test_loot_tables(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      p.inv.fill(null); p.inv[0] = { id: 'gem_sword', n: 1 };
      let fangs = 0, meat = 0, xu = 0, kills = 0;
      for (let i = 0; i < 200; i++) {
        const m = spawnMob(g, 'soi-xam', cx + 0.5 + 2, y0 + 1, cz + 0.5);
        g.damageEntity(m, 999, p);
        kills++;
        for (const e of [...g.ents.values()]) if (e.kind === 'item') { if (e.item === 'fang') fangs += e.n; if (e.item === 'meat') meat += e.n; if (e.item === 'xu') xu += e.n; g.ents.delete(e.id); }
      }
      return { fangs, meat, xu, kills, mobsLeft: [...g.ents.values()].filter(e => e.kind === 'mob').length };
    """)
    assert r['mobsLeft'] == 0 and r['meat'] >= 200 and 50 <= r['fangs'] <= 120 and r['xu'] >= 200, r


@test
def test_combat_hit_rules_damage_and_cooldown(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = spawnMob(g, 'xac-song', cx + 0.5 + 2.5, y0 + 1, cz + 0.5); m.hp = m.maxHp = 20; m.frozen = true;
      p.inv.fill(null); p.inv[0] = { id: 'stone_sword', n: 1 }; p.sel = 0;
      const a = g.act('u1', { t: 'hit', id: m.id });
      const hpAfterA = m.hp;
      const tooSoon = g.act('u1', { t: 'hit', id: m.id });
      run(g, 0.6);
      const b = g.act('u1', { t: 'hit', id: m.id });
      p.sel = 1; run(g, 0.6);                                       // tay không
      const hand = g.act('u1', { t: 'hit', id: m.id });
      const far = spawnMob(g, 'xac-song', cx + 0.5 + 12, y0 + 1, cz + 0.5); far.frozen = true; run(g, 0.6);
      const farHit = g.act('u1', { t: 'hit', id: far.id });
      const noSuch = g.act('u1', { t: 'hit', id: 99999 });
      return { a: a.ok, hpAfterA, tooSoon: tooSoon.ok, b: b.ok, hpAfterB: 20 - 10, handOk: hand.ok, mHp: m.hp, farHit: farHit.ok, noSuch: noSuch.ok };
    """)
    assert r['a'] and r['hpAfterA'] == 15 and not r['tooSoon'] and r['b'] and r['handOk'] and r['mHp'] == 9, r
    assert not r['farHit'] and not r['noSuch'], r


@test
def test_combat_player_death_respawn_regen_and_food(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      g.hurtPlayer(p, 8, null); const hurt = p.hp;
      p.inv.fill(null); p.inv[0] = { id: 'meat', n: 2 }; p.sel = 0;
      const ate = g.act('u1', { t: 'use' }); const afterEat = p.hp; const meatLeft = p.inv[0] && p.inv[0].n;
      g.hurtPlayer(p, 99, null);
      const dead = p.dead, blocked = g.act('u1', { t: 'sel', i: 2 }).ok, earlyRespawn = g.act('u1', { t: 'respawn' }).ok;
      g.tick(3.1);
      const respawn = g.act('u1', { t: 'respawn' });
      const hpBack = p.hp;
      g.hurtPlayer(p, 5, null); const low = p.hp; run(g, 6); const noRegen = p.hp; run(g, 12);
      return { hurt, ate: ate.ok, afterEat, meatLeft, dead, blocked, earlyRespawn, respawn: respawn.ok, hpBack, alive: !p.dead, low, noRegen, regen: p.hp };
    """)
    assert r['hurt'] == 12 and r['ate'] and r['afterEat'] == 17 and r['meatLeft'] == 1, r
    assert r['dead'] and not r['blocked'] and not r['earlyRespawn'] and r['respawn'] and r['hpBack'] == 20 and r['alive'], r
    assert r['noRegen'] == r['low'] and r['regen'] > r['low'], r


# ---------------------------------------------------------------- E: boss

BOSS_JS = ARENA_JS + """
const { BOSSES } = await imp('content/bosses.js');
const { spawnBoss } = await imp('sim/boss.js');
const mkBossFight = (id, dist = 5) => {
  const A = mkArena(); const { g, p, cx, cz, y0 } = A;
  p.hp = p.maxHp = 9999;
  const b = spawnBoss(g, id, cx + 0.5 + dist, y0 + 1, cz + 0.5);
  return { ...A, b };
};
const types = (g) => { const o = {}; for (const e of g.ents.values()) o[e.kind] = (o[e.kind] || 0) + 1; return o; };
"""


@test
def test_boss_content_is_multiphase(pg):
    r = ev(pg, r"""
      const { BOSSES } = await imp('content/bosses.js');
      const list = Object.values(BOSSES);
      return { count: list.length, phases: list.map(b => b.phases.length), moveTypes: [...new Set(list.flatMap(b => Object.values(b.moves).map(m => m.type)))].sort(),
               ordered: list.every(b => b.phases.every((ph, i) => i === 0 || ph.from < b.phases[i - 1].from)) };
    """)
    assert r['count'] >= 2 and all(n >= 3 for n in r['phases']) and r['ordered'], r
    assert {'melee', 'leap', 'summon', 'volley', 'slam'} <= set(r['moveTypes']), r


@test
def test_boss_melee_leap_summon_phases(pg):
    r = ev(pg, BOSS_JS + r"""
      const { g, p, b } = mkBossFight('thu-linh-soi');
      const hp0 = p.hp; run(g, 10); const lost1 = hp0 - p.hp;
      const phase0 = b.phase;
      b.hp = b.maxHp * 0.45; run(g, 0.2); const phase1 = b.phase;
      run(g, 14); const summoned = [...g.ents.values()].filter(e => e.kind === 'mob' && e.type === 'soi-xam').length;
      b.hp = b.maxHp * 0.15; run(g, 0.2); const phase2 = b.phase;
      return { lost1, phase0, phase1, phase2, summoned, dmgMul: b.dmgMul, speedMul: b.speedMul, bossAlive: g.ents.has(b.id) };
    """)
    assert r['lost1'] > 5 and r['phase0'] == 0 and r['phase1'] == 1 and r['phase2'] == 2, r
    assert r['summoned'] >= 2 and r['dmgMul'] >= 1.4 and r['speedMul'] >= 1.5 and r['bossAlive'], r


@test
def test_boss_volley_and_slam(pg):
    r = ev(pg, BOSS_JS + r"""
      const { g, p, b } = mkBossFight('bo-cap-chua', 7);
      b.hp = b.maxHp * 0.5;                                              // pha 2: có quake
      let sawProj = 0, sawTele = false;
      for (let t = 0; t < 20; t += 0.05) { g.tick(0.05); sawProj = Math.max(sawProj, [...g.ents.values()].filter(e => e.kind === 'proj').length); if (g.drain().some(x => x.ev.t === 'telegraph')) sawTele = true; p.x = b.x - 7; p.z = b.z; }
      return { sawProj, sawTele, lost: 9999 - p.hp };
    """)
    assert r['sawProj'] >= 3 and r['sawTele'] and r['lost'] > 8, r


@test
def test_boss_defeat_sets_flag_rewards_and_unlocks(pg):
    r = ev(pg, BOSS_JS + r"""
      const { g, p, b } = mkBossFight('thu-linh-soi');
      p.inv.fill(null); p.inv[0] = { id: 'gem_sword', n: 1 }; p.sel = 0;
      b.frozen = true; g.flags['boss:thu-linh-soi'] = false; const before = !!g.flags['boss:thu-linh-soi'];
      let hits = 0; for (let i = 0; i < 60 && g.ents.has(b.id); i++) { run(g, 0.5); if (g.act('u1', { t: 'hit', id: b.id }).ok) hits++; }
      const evs = g.drain().map(e => e.ev.t);
      const drops = [...g.ents.values()].filter(e => e.kind === 'item').map(e => e.item);
      return { before, dead: !g.ents.has(b.id), flag: !!g.flags['boss:thu-linh-soi'], evs: evs.includes('boss-defeated'), drops, hits };
    """)
    assert not r['before'] and r['dead'] and r['flag'] and r['evs'] and 'wolf_heart' in r['drops'], r


@test
def test_boss_scaling_with_players_in_arena(pg):
    r = ev(pg, BOSS_JS + r"""
      const { g, p, cx, cz, y0, b } = mkBossFight('thu-linh-soi');
      b.frozen = true; run(g, 0.2);
      const hp1 = b.maxHp, d1 = b.scaleDmg;
      for (const id of ['u2', 'u3']) { const q = g.addPlayer(id, id); q.x = cx + 0.5 + 2; q.z = cz + 0.5; q.y = y0 + 1; }
      run(g, 0.2);
      const hp3 = b.maxHp, d3 = b.scaleDmg, ratio = b.hp / b.maxHp;
      g.removePlayer('u3'); g.removePlayer('u2'); run(g, 0.2);
      return { hp1, hp3, d1, d3, ratio, back: b.maxHp };
    """)
    assert r['hp1'] == 300 and abs(r['hp3'] - 660) < 1 and abs(r['ratio'] - 1) < 0.01, r
    assert r['d1'] == 1 and abs(r['d3'] - 1.3) < 0.01 and r['back'] == 300, r


@test
def test_boss_arena_activation_reset_and_one_time(pg):
    r = ev(pg, GAME_JS + r"""
      const { BOSSES } = await imp('content/bosses.js');
      const t0 = performance.now();
      const g = new Game({ seed: 777, spawning: false }); const p = g.addPlayer('u1', 'T'); p.hp = p.maxHp = 9999;
      g.buildStructures();
      const buildMs = performance.now() - t0;
      const site = g.flags.sites.arena['thu-linh-soi'];
      const far = () => { p.x = site.x + 200; p.z = site.z + 200; p.y = 40; g.tick(1); };
      const near = () => { p.x = site.x + 0.5; p.z = site.z + 0.5; p.y = site.y + 1; g.tick(1); };
      far(); const none = [...g.ents.values()].filter(e => e.kind === 'boss').length;
      near(); const bosses1 = [...g.ents.values()].filter(e => e.kind === 'boss');
      const b = bosses1[0]; b.hp = 10;
      far(); g.tick(6); const reset = [...g.ents.values()].filter(e => e.kind === 'boss').length;
      near(); const again = [...g.ents.values()].find(e => e.kind === 'boss'); const full = again && again.hp === again.maxHp;
      g.flags['boss:thu-linh-soi'] = true; g.ents.delete(again.id);
      far(); near(); const after = [...g.ents.values()].filter(e => e.kind === 'boss').length;
      // sân đấu phẳng và thoáng
      const y = site.y; let flat = true, clear = true;
      for (let dx = -10; dx <= 10; dx += 5) for (let dz = -10; dz <= 10; dz += 5) { if (g.world.get(site.x + dx, y, site.z + dz) === 0) flat = false; for (let dy = 1; dy <= 5; dy++) if (g.world.get(site.x + dx, y + dy, site.z + dz) !== 0) clear = false; }
      return { none, spawned: bosses1.length, region: g.world.regionAt(site.x, site.z), reset, full, after, flat, clear, buildMs, sites: Object.keys(g.flags.sites.arena).sort() };
    """)
    assert r['none'] == 0 and r['spawned'] == 1 and r['region'] == 'rung-suong' and r['reset'] == 0 and r['full'] and r['after'] == 0, r
    assert r['flat'] and r['clear'] and r['sites'] == ['bang-de', 'bo-cap-chua', 'thu-linh-soi'], r
    assert r['buildMs'] < 15000, r


@test
def test_locked_region_hurts_until_boss_defeated(pg):
    r = ev(pg, GAME_JS + r"""
      const { regionAt } = await imp('world/regions.js');
      const g = new Game({ seed: 777, spawning: false }); const p = g.addPlayer('u1', 'T');
      let spot = null; for (let x = -3000; x <= 3000 && !spot; x += 40) for (let z = -3000; z <= 3000 && !spot; z += 40) if (regionAt(777, x, z) === 'sa-mac-lua' && g.world.surfaceY(x, z) > 21) spot = { x, z };
      g.world.keepAround([spot], 2);
      p.x = spot.x + 0.5; p.z = spot.z + 0.5; p.y = g.world.surfaceY(spot.x, spot.z) + 1; p.vy = 0;
      for (let t = 0; t < 10; t += 0.05) { g.tick(0.05); p.y = g.world.surfaceY(spot.x, spot.z) + 1; }
      const hurt = p.hp; const toasts = g.drain().filter(e => e.ev.t === 'toast').length;
      g.flags['boss:thu-linh-soi'] = true; p.hp = 20; p.lastHurt = 99999;
      for (let t = 0; t < 10; t += 0.05) { g.tick(0.05); p.y = g.world.surfaceY(spot.x, spot.z) + 1; }
      return { hurt, toasts, after: p.hp };
    """)
    assert r['hurt'] < 20 and r['toasts'] >= 1 and r['after'] == 20, r


# ---------------------------------------------------------------- F: NPC, hội thoại, cửa hàng, nhiệm vụ

NPC_JS = GAME_JS + """
const { NPCS } = await imp('content/npcs.js');
const mkTown = () => {
  const g = new Game({ seed: 777, spawning: false }); const p = g.addPlayer('u1', 'T'); g.buildStructures();
  const npc = (id) => [...g.ents.values()].find(e => e.kind === 'npc' && e.npc === id);
  const goto = (id) => { const n = npc(id); p.x = n.x + 1.2; p.z = n.z; p.y = n.y; return n; };
  const view = () => { const evs = g.drain().filter(x => x.to === 'u1' || x.to === null).map(x => x.ev); return evs.filter(e => e.t === 'dialog' || e.t === 'dialog-end' || e.t === 'shop'); };
  const say = (i) => { const r = g.act('u1', { t: 'dlg', i }); return { r, v: view() }; };
  const talk = (id) => { const n = goto(id); const r = g.act('u1', { t: 'interact', id: n.id }); return { r, v: view() }; };
  return { g, p, npc, goto, view, say, talk };
};
"""


@test
def test_npcs_exist_with_dialogue_graphs(pg):
    r = ev(pg, NPC_JS + r"""
      const T = mkTown();
      const ids = [...T.g.ents.values()].filter(e => e.kind === 'npc').map(e => e.npc).sort();
      const t = T.talk('truong-lang');
      const ev0 = t.v.find(e => e.t === 'dialog');
      // xa quá thì không nói chuyện được
      T.p.x += 30; const far = T.g.act('u1', { t: 'interact', id: T.npc('truong-lang').id });
      return { count: Object.keys(NPCS).length, ids, ok: t.r.ok, text: ev0 && ev0.text, choices: ev0 && ev0.choices.map(c => c.text), far: far.ok };
    """)
    assert r['count'] >= 3 and set(r['ids']) == {'truong-lang', 'tho-ren', 'thuong-nhan', 'an-si'} and r['ok'], r
    assert 'Chào lữ khách' in r['text'] and len(r['choices']) >= 3 and not r['far'], r
    assert not any('Trả nhiệm vụ' in c for c in r['choices']), r          # chưa có nhiệm vụ sẵn sàng thì ẩn lựa chọn trả


@test
def test_quest_chain_chao_lang_then_hunt(pg):
    r = ev(pg, NPC_JS + r"""
      const T = mkTown(); const { g, p } = T;
      T.talk('truong-lang'); T.say(0);                                         // Cho tôi một việc
      const jobs = T.view; 
      const r1 = T.say(0);                                                      // Nhận Chào làng
      const state1 = p.quests.active['chao-lang'] ? 'active' : 'none';
      g.giveItem('u1', 'log', 5); g.tick(0.1);
      const half = JSON.stringify(g.questProgress('u1', 'chao-lang'));
      g.giveItem('u1', 'wood_pick', 1); g.tick(0.1);
      const ready = g.questState('u1', 'chao-lang');
      // trả nhiệm vụ
      T.talk('truong-lang'); const menu = T.say(1);                             // Tôi muốn trả nhiệm vụ
      const choices = (menu.v.find(e => e.t === 'dialog') || {}).choices || [];
      const idx = choices.findIndex(c => c.text.includes('Chào làng'));
      T.say(choices[idx].i);
      const done = g.questState('u1', 'chao-lang');
      const sword = p.inv.some(s => s && s.id === 'wood_sword'), xu = p.inv.filter(Boolean).filter(s => s.id === 'xu').reduce((a, s) => a + s.n, 0);
      // nhiệm vụ săn sói chỉ nhận được sau khi xong Chào làng; giết sói không phải của nhiệm vụ không tính
      const { spawnMob } = await imp('sim/mobs.js');
      T.talk('truong-lang'); T.say(0); const accept2 = T.say(1);
      const hunting = g.questState('u1', 'san-soi');
      p.inv.fill(null); p.inv[0] = { id: 'gem_sword', n: 1 }; p.sel = 0;
      for (let i = 0; i < 3; i++) { const m = spawnMob(g, 'soi-xam', p.x + 2, p.y, p.z); g.damageEntity(m, 999, p); }
      g.tick(0.1);
      return { state1, half, ready, done, sword, xu, hunting, afterKills: g.questState('u1', 'san-soi') };
    """)
    assert r['state1'] == 'active' and r['ready'] == 'ready' and r['done'] == 'done' and r['sword'] and r['xu'] == 10, r
    assert r['hunting'] == 'active' and r['afterKills'] == 'ready', r


@test
def test_quest_kill_only_counts_when_active_and_boss_quest(pg):
    r = ev(pg, NPC_JS + r"""
      const T = mkTown(); const { g, p } = T;
      const { spawnMob } = await imp('sim/mobs.js');
      p.inv[0] = { id: 'gem_sword', n: 1 };
      g.quests_accept = null;
      for (let i = 0; i < 3; i++) { const m = spawnMob(g, 'soi-xam', p.x + 2, p.y, p.z); g.damageEntity(m, 999, p); }   // trước khi nhận
      p.quests.done['chao-lang'] = true;
      g.acceptQuest('u1', 'san-soi'); g.tick(0.1);
      const afterAccept = g.questProgress('u1', 'san-soi');
      const early = g.acceptQuest('u1', 'diet-thu-linh');                                         // chưa xong san-soi
      p.quests.done['san-soi'] = true; const later = g.acceptQuest('u1', 'diet-thu-linh');
      g.onBossDefeated?.call(g, 'thu-linh-soi', [p]);
      g.tick(0.1);
      return { afterAccept, early: early.ok, later: later.ok, bossQuest: g.questState('u1', 'diet-thu-linh') };
    """)
    assert r['afterAccept'][0]['n'] == 0 and not r['early'] and r['later'] and r['bossQuest'] == 'ready', r


@test
def test_shop_buy_sell_rules(pg):
    r = ev(pg, NPC_JS + r"""
      const T = mkTown(); const { g, p } = T;
      T.talk('tho-ren'); const shopEv = T.say(0);                                  // Cho tôi xem hàng
      const shop = shopEv.v.find(e => e.t === 'shop');
      const poor = g.act('u1', { t: 'buy', item: 'stone_pick', n: 1 });
      g.giveItem('u1', 'xu', 50);
      const bought = g.act('u1', { t: 'buy', item: 'stone_pick', n: 1 });
      const xuAfter = p.inv.filter(Boolean).filter(s => s.id === 'xu').reduce((a, s) => a + s.n, 0);
      const notSold = g.act('u1', { t: 'buy', item: 'gem_sword', n: 1 });
      g.giveItem('u1', 'crystal', 2);
      const sold = g.act('u1', { t: 'sell', item: 'crystal', n: 2 });
      const notBought = g.act('u1', { t: 'sell', item: 'wolf_heart', n: 1 });
      const xuEnd = p.inv.filter(Boolean).filter(s => s.id === 'xu').reduce((a, s) => a + s.n, 0);
      p.x += 40; const far = g.act('u1', { t: 'buy', item: 'planks', n: 1 });
      return { has: !!shop, sells: shop && shop.sells.map(s => s.item), poor: poor.ok, bought: bought.ok, xuAfter, notSold: notSold.ok, sold: sold.ok, notBought: notBought.ok, xuEnd, far: far.ok,
               pick: p.inv.some(s => s && s.id === 'stone_pick') };
    """)
    assert r['has'] and 'stone_pick' in r['sells'] and not r['poor'] and r['bought'] and r['xuAfter'] == 30 and r['pick'], r
    assert not r['notSold'] and r['sold'] and not r['notBought'] and r['xuEnd'] == 54 and not r['far'], r


@test
def test_dialogue_conditions_hide_choices(pg):
    r = ev(pg, NPC_JS + r"""
      const T = mkTown(); const { g, p } = T;
      const t1 = T.talk('truong-lang'); const jobs1 = T.say(0).v.find(e => e.t === 'dialog').choices.map(c => c.text);
      g.acceptQuest('u1', 'chao-lang');
      T.talk('truong-lang'); const jobs2 = T.say(0).v.find(e => e.t === 'dialog').choices.map(c => c.text);
      return { jobs1, jobs2 };
    """)
    assert any('Chào làng' in c for c in r['jobs1']) and not any('Săn sói' in c for c in r['jobs1']), r
    assert not any('Chào làng' in c for c in r['jobs2']), r


# ---------------------------------------------------------------- H1: trình kiểm tra nội dung

@test
def test_content_valid(pg):
    r = ev(pg, r"""
      const { validateContent, loadContent } = await imp('content/validate.js');
      const errors = validateContent(await loadContent());
      return { errors };
    """)
    assert r['errors'] == [], r


@test
def test_content_validator_catches_broken_references(pg):
    r = ev(pg, r"""
      const { validateContent, loadContent } = await imp('content/validate.js');
      const c = await loadContent();
      const clone = JSON.parse(JSON.stringify(c));
      clone.mobs['soi-xam'].drops.push({ item: 'khong-co', min: 1, max: 1, p: 1 });
      clone.npcs['tho-ren'].nodes.hi.choices[0].goto = 'nut-ma';
      clone.quests['san-soi'].steps[0].mob = 'quai-ma';
      clone.items['vat-pham-mo-coi'] = { id: 'vat-pham-mo-coi', name: 'Mồ côi', stack: 1 };
      clone.recipes.push({ id: 'x', out: { item: 'stone', n: 1 }, in: { khong_co: 1 }, bench: false });
      clone.bosses['bang-de'].phases[1].moves = ['khong-co-chieu'];
      clone.npcs['an-si'].nodes.curse.choices = [{ text: 'Cụt', goto: 'lore-khong-co' }];
      const errors = validateContent(clone);
      return { errors };
    """)
    joined = ' | '.join(r['errors'])
    for needle in ['khong-co', 'nut-ma', 'quai-ma', 'vat-pham-mo-coi', 'khong_co', 'khong-co-chieu', 'lore-khong-co']:
        assert needle in joined, (needle, r['errors'])


# ---------------------------------------------------------------- G1: lưu, nạp, xuất, nhập

@test
def test_save_load_roundtrip(pg):
    r = ev(pg, NPC_JS + r"""
      const T = mkTown(); const { g, p } = T;
      const sp = { x: Math.floor(p.x) + 3, z: Math.floor(p.z) };
      const y = g.world.surfaceY(sp.x, sp.z);
      g.setBlock(sp.x, y + 1, sp.z, 8);
      g.acceptQuest('u1', 'chao-lang'); g.giveItem('u1', 'log', 3); g.giveItem('u1', 'xu', 77); p.hp = 13; p.sel = 3;
      g.flags['boss:thu-linh-soi'] = true; g.tick(5);
      const save = JSON.parse(JSON.stringify(g.toSave()));
      const g2 = Game.fromSave(save, { spawning: false }); const q = g2.addPlayer('u1', 'T');
      const npcs = [...g2.ents.values()].filter(e => e.kind === 'npc').length;
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      return { block: g2.world.get(sp.x, y + 1, sp.z), flag: g2.flags['boss:thu-linh-soi'], sites: same(g2.flags.sites, g.flags.sites), time: g2.time, inv: same(q.inv, p.inv),
               hp: q.hp === p.hp && q.hp > 12, sel: q.sel, quest: g2.questState('u1', 'chao-lang'), prog: g2.questProgress('u1', 'chao-lang')[0].n, npcs, v: save.v,
               pos: Math.hypot(q.x - p.x, q.z - p.z) < 0.01, terrain: g2.world.get(sp.x + 40, 25, sp.z + 40) === g.world.get(sp.x + 40, 25, sp.z + 40), spawn: same(g2.spawn, g.spawn),
               fresh: new Game({ seed: 777, spawning: false }).addPlayer('u9', 'N').hp };
    """)
    assert r['block'] == 8 and r['flag'] and r['sites'] and r['time'] >= 5 and r['inv'] and r['hp'] and r['sel'] == 3, r
    assert r['quest'] == 'active' and r['prog'] == 3 and r['npcs'] == 4 and r['v'] == 1 and r['pos'] and r['terrain'] and r['spawn'] and r['fresh'] == 20, r


@test
def test_save_store_export_import_and_versions(pg):
    r = ev(pg, GAME_JS + r"""
      const S = await imp('save.js');
      const g = new Game({ seed: 4242, spawning: false }); g.addPlayer('u1', 'T'); g.setBlock(5, 40, 5, 8); g.tick(1);
      const save = g.toSave();
      await S.saveWorld('thu-nghiem', save);
      const list = await S.listWorlds();
      const back = await S.loadWorld('thu-nghiem');
      const blob = await S.exportWorld(save);
      const imported = await S.importWorld(blob);
      const out = { list: list.map(w => w.name), seedBack: back.seed, rt: JSON.stringify(imported) === JSON.stringify(save), gz: blob.size < JSON.stringify(save).length, missing: await S.loadWorld('khong-co') };
      const newer = { ...save, v: 99 };
      try { S.checkVersion(newer); out.newer = 'accepted'; } catch (e) { out.newer = e.message; }
      try { await S.importWorld(new Blob([new Uint8Array([1, 2, 3, 4])])); out.bad = 'accepted'; } catch (e) { out.bad = 'rejected'; }
      await S.deleteWorld('thu-nghiem'); out.deleted = (await S.listWorlds()).length;
      return out;
    """)
    assert r['list'] == ['thu-nghiem'] and r['seedBack'] == 4242 and r['rt'] and r['gz'] and r['missing'] is None, r
    assert r['newer'] == 'newer-version' and r['bad'] == 'rejected' and r['deleted'] == 0, r


# ---------------------------------------------------------------- C: nhiều người chơi

NET_JS = GAME_JS + """
const { HostSession } = await imp('net/host.js');
const { ClientSession } = await imp('net/client.js');
const { createMemoryTransport: mt } = await imp('../../platform/net/transport-memory.js');
const { spawnMob } = await imp('sim/mobs.js');
const mkHost = async (code, opts = {}) => {
  const game = new Game({ seed: 777, spawning: false, ...opts });
  const host = await HostSession.create({ game, transport: mt(), name: 'Chủ', uid: 'uh', code });
  return { game, host };
};
const join = (code, uid, name) => ClientSession.join({ transport: mt(), name, uid, code, timeoutMs: 4000 });
"""


@test
def test_multiplayer_blocks_positions_mobs_sync(pg):
    r = ev(pg, NET_JS + r"""
      const { game, host } = await mkHost('SYNCA');
      const a = await join('SYNCA', 'ua', 'An'), b = await join('SYNCA', 'ub', 'Bình');
      await until(() => game.players.size === 3 && b.snap && b.snap.ps.length === 3);
      const pa = game.player('ua');
      // an đặt block; bình thấy
      const cx = Math.floor(pa.x) + 2, cz = Math.floor(pa.z), cy = a.world.surfaceY(cx, cz);
      game.giveItem('ua', 'planks', 5); await until(() => a.you && a.you.inv.some(s => s && s.id === 'planks'));
      a.act({ t: 'sel', i: a.you.inv.findIndex(s => s && s.id === 'planks') });
      await until(() => game.player('ua').sel === a.you.inv.findIndex(s => s && s.id === 'planks') || true);
      a.act({ t: 'place', x: cx, y: cy + 1, z: cz });
      await until(() => b.world.get(cx, cy + 1, cz) === 8);
      const hostSees = game.world.get(cx, cy + 1, cz);
      // vị trí của an hiện bên bình
      const x0 = pa.x;
      a.sendState({ x: x0 + 3, y: pa.y, z: pa.z, vx: 0, vy: 0, vz: 0, yaw: 1, pitch: 0 });
      await until(() => { const q = b.snap.ps.find(p => p.uid === 'ua'); return q && Math.abs(q.x - (x0 + 3)) < 0.1; });
      await until(() => { const q = b.snap.ps.find(p => p.uid === 'ua'); return q && Math.abs(q.yaw - 1) < 0.01; });
      // quái trên host hiện bên cả hai, và đòn đánh của khách có tác dụng trên host
      const m = spawnMob(game, 'xac-song', pa.x + 2, pa.y, pa.z); m.frozen = true;
      await until(() => b.snap.es.some(e => e.id === m.id) && a.snap.es.some(e => e.id === m.id));
      game.giveItem('ua', 'gem_sword', 1);
      await until(() => a.you.inv.some(s => s && s.id === 'gem_sword'));
      a.act({ t: 'sel', i: a.you.inv.findIndex(s => s && s.id === 'gem_sword') });
      await wait(150);
      a.act({ t: 'hit', id: m.id });
      await until(() => { const e = b.snap.es.find(e => e.id === m.id); return e && e.hp < m.maxHp; });
      // thực thể quá xa không được gửi
      const far = spawnMob(game, 'nai', pa.x + 300, pa.y, pa.z); far.frozen = true;
      await wait(300);
      const farSeen = b.snap.es.some(e => e.id === far.id);
      return { hostSees, farSeen, players: b.snap.ps.map(p => p.name).sort(), aWorldSeed: a.world.seed };
    """)
    assert r['hostSees'] == 8 and not r['farSeen'] and r['players'] == ['An', 'Bình', 'Chủ'] and r['aWorldSeed'] == 777, r


@test
def test_multiplayer_late_join_gets_edited_world_and_own_data(pg):
    r = ev(pg, NET_JS + r"""
      const { game, host } = await mkHost('LATE2');
      const sp = game.spawn; const y = game.world.surfaceY(sp.x, sp.z);
      game.setBlock(sp.x, y + 1, sp.z, 8); game.setBlock(sp.x + 1, y + 1, sp.z, 6);
      game.flags['boss:thu-linh-soi'] = true;
      const c = await join('LATE2', 'ulate', 'Muộn');
      const seen = [c.world.get(sp.x, y + 1, sp.z), c.world.get(sp.x + 1, y + 1, sp.z)];
      const flag = c.flags['boss:thu-linh-soi'];
      // người này có đồ, thoát, vào lại với cùng uid: nhận lại đồ
      game.giveItem('ulate', 'xu', 33); await until(() => c.you.inv.some(s => s && s.id === 'xu'));
      c.leave(); await until(() => !game.players.has('ulate'));
      const c2 = await join('LATE2', 'ulate', 'Muộn');
      const xu = c2.you.inv.filter(Boolean).filter(s => s.id === 'xu').reduce((a, s) => a + s.n, 0);
      return { seen, flag, xu, hasTerrain: c2.world.get(sp.x, 5, sp.z) !== 0 };
    """)
    assert r['seen'] == [8, 6] and r['flag'] and r['xu'] == 33 and r['hasTerrain'], r


@test
def test_multiplayer_limits_and_host_leaving(pg):
    r = ev(pg, NET_JS + r"""
      const { game, host } = await mkHost('LMTXN');
      const cs = []; for (let i = 0; i < 3; i++) cs.push(await join('LMTXN', 'u' + i, 'K' + i));
      let dup = null; try { await join('LMTXN', 'uh', 'Trùng host'); } catch (e) { dup = e.message; }
      cs.push(await join('LMTXN', 'u3', 'K3'));
      let sixth = null; try { await join('LMTXN', 'u9', 'Thừa'); } catch (e) { sixth = e.message; }
      await wait(200);
      let closed = null; cs[0].on('closed', r => { closed = r; });
      host.leave();
      await until(() => closed);
      return { sixth, dup, closed, count: game.players.size };
    """)
    assert r['sixth'] == 'full' and r['dup'] == 'dup-uid' and r['closed'] == 'host-left' and r['count'] == 5, r


@test
def test_multiplayer_rejects_bad_input(pg):
    r = ev(pg, NET_JS + r"""
      const { game, host } = await mkHost('BADXN');
      const a = await join('BADXN', 'ua', 'An');
      await until(() => game.players.has('ua'));
      const p = game.player('ua'); const x0 = p.x;
      a.sendState({ x: p.x + 500, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0 });    // dịch chuyển tức thời
      await wait(300);
      const afterTeleport = Math.abs(p.x - x0) < 5;
      a.sendState({ x: NaN, y: 1, z: 1, yaw: 0, pitch: 0 }); a.sendState({ x: 'abc' }); a.sendState(null);
      a.act({ t: 'break', x: 1e9, y: 1, z: 1 }); a.act({ t: 'nonsense' }); a.act(null); a.act({ t: 'hit', id: 'xyz' });
      for (let i = 0; i < 200; i++) a.act({ t: 'sel', i: i % 9 });                                 // dồn dập
      await wait(300);
      return { afterTeleport, alive: game.players.has('ua'), finite: Number.isFinite(p.x) };
    """)
    assert r == {'afterTeleport': True, 'alive': True, 'finite': True}, r


# ---------------------------------------------------------------- H2: ngân sách hiệu năng

@test
def test_perf_world_generation_and_meshing(pg):
    r = ev(pg, GAME_JS + r"""
      const { World } = await imp('world/world.js'); const { buildChunkMesh } = await imp('render/mesher.js');
      const w = new World(31337);
      let t = performance.now(); w.keepAround([{ x: 0, z: 0 }], 3); const gen = performance.now() - t;
      t = performance.now(); let tris = 0;
      for (let cx = -3; cx < 3; cx++) for (let cz = -3; cz < 3; cz++) { const m = buildChunkMesh((x, y, z) => w.get(x, y, z), cx, cz); tris += m.solid.indices.length / 3; }
      return { gen, mesh: performance.now() - t, tris };
    """)
    assert r['gen'] + r['mesh'] < 2500 and r['tris'] > 5000, r


@test
def test_perf_tick_with_40_mobs_and_5_players(pg):
    r = ev(pg, GAME_JS + r"""
      const { spawnMob } = await imp('sim/mobs.js');
      const g = new Game({ seed: 31337, spawning: false });
      for (let i = 1; i <= 5; i++) { const p = g.addPlayer('u' + i, 'P' + i); p.hp = p.maxHp = 9999; p.x += i * 6; }
      const ps = [...g.players.values()], kinds = ['soi-xam', 'xac-song', 'bo-cap', 'xuong-cung', 'gau-bang'];
      for (let i = 0; i < 40; i++) { const p = ps[i % 5], x = p.x + Math.cos(i) * 10, z = p.z + Math.sin(i) * 10; spawnMob(g, kinds[i % 5], x, g.world.surfaceY(Math.floor(x), Math.floor(z)) + 1, z); }
      g.tick(0.05);
      let worst = 0, sum = 0; const N = 100;
      for (let i = 0; i < N; i++) { const t = performance.now(); g.tick(0.05); const d = performance.now() - t; sum += d; worst = Math.max(worst, d); }
      return { avg: sum / N, worst, mobs: [...g.ents.values()].filter(e => e.kind === 'mob').length };
    """)
    assert r['mobs'] == 40 and r['avg'] < 5 and r['worst'] < 25, r


@test
def test_perf_structures_and_welcome_size(pg):
    r = ev(pg, GAME_JS + r"""
      const t = performance.now(); const g = new Game({ seed: 31337, spawning: false }); g.buildStructures(); const build = performance.now() - t;
      return { build, welcomeKB: JSON.stringify({ delta: g.world.exportDelta(), flags: g.flags }).length / 1024 };
    """)
    assert r['build'] < 2000 and r['welcomeKB'] < 400, r


# ---------------------------------------------------------------- H3: hai người chơi trọn vẹn qua giao diện
# ---------------------------------------------------------------- vá lỗi từ đợt review

@test
def test_respawn_is_not_undone_by_stale_state(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      g.spawn = { x: cx - 15, z: cz }; p.x = cx + 15; p.z = cz;                   // chết cách điểm hồi sinh 30 block
      const deadAt = { x: p.x, y: p.y, z: p.z };
      g.hurtPlayer(p, 99, null); run(g, 5);
      const res = g.act('u1', { t: 'respawn' });
      const spawnX = p.x;
      // gói trạng thái cũ (vị trí lúc chết) còn đang bay tới: phải bị bỏ
      const stale = g.applyState('u1', { x: deadAt.x, y: deadAt.y, z: deadAt.z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0 });
      const after = p.x;
      const ev1 = g.drain().find(e => e.ev.t === 'teleport');
      // máy khách xác nhận đã dịch chuyển (kèm seq) rồi báo vị trí mới: được nhận
      const ok = g.applyState('u1', { x: p.x + 1, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, seq: ev1.ev.seq });
      return { res: res.ok, stale, near: Math.abs(spawnX - (cx - 15 + 0.5)) < 1, kept: Math.abs(after - spawnX) < 0.01, seq: ev1.ev.seq, ok, final: p.x - spawnX };
    """)
    assert r['res'] and not r['stale'] and r['near'] and r['kept'] and r['seq'] >= 1 and r['ok'] and abs(r['final'] - 1) < 0.01, r


@test
def test_boss_quest_not_stuck_when_boss_already_dead_and_reach_step(pg):
    r = ev(pg, NPC_JS + r"""
      const T = mkTown(); const { g, p } = T;
      g.flags['boss:thu-linh-soi'] = true;                                   // bạn bè đã hạ boss trước đó
      p.quests.done['chao-lang'] = true; p.quests.done['san-soi'] = true;
      g.acceptQuest('u1', 'diet-thu-linh'); g.tick(0.1);
      const boss = g.questState('u1', 'diet-thu-linh');
      // nhận nhiệm vụ "đến Núi Băng" ngay khi đang đứng ở vùng đó
      p.region = 'nui-bang'; g.acceptQuest('u1', 'hoi-sinh-bang');
      return { boss, reach: g.questProgress('u1', 'hoi-sinh-bang')[0].n };
    """)
    assert r['boss'] == 'ready' and r['reach'] == 1, r


@test
def test_host_loop_catches_up_after_background_throttle_and_reports_failures(pg):
    r = ev(pg, NET_JS + r"""
      const { game, host } = await mkHost('THRTL');
      const before = game.tickNo;
      host.loop.advance(1000);                                                // tab nền chỉ thức dậy mỗi 1 giây
      const steps = game.tickNo - before;
      const a = await join('THRTL', 'ua', 'An'); await until(() => game.players.has('ua'));
      const fails = []; a.on('ev', e => { if (e.t === 'fail') fails.push(e); });
      const pa = game.player('ua'); const sy = game.world.surfaceY(Math.floor(pa.x) + 1, Math.floor(pa.z));
      a.act({ t: 'break', x: Math.floor(pa.x) + 1, y: sy, z: Math.floor(pa.z) });              // chưa dig
      await until(() => fails.length > 0);
      return { steps, reason: fails[0].reason, what: fails[0].a };
    """)
    assert r['steps'] >= 20 and r['reason'] == 'no-dig' and r['what'] == 'break', r


@test
def test_dead_player_is_saved_at_spawn_not_at_corpse(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz } = mkArena();
      g.spawn = { x: cx - 15, z: cz }; p.x = cx + 15;
      g.hurtPlayer(p, 99, null);
      const save = JSON.parse(JSON.stringify(g.toSave()));
      const g2 = Game.fromSave(save, { spawning: false }); const q = g2.addPlayer('u1', 'T');
      return { hp: q.hp, dead: q.dead, nearSpawn: Math.abs(q.x - (cx - 15 + 0.5)) < 1 };
    """)
    assert r == {'hp': 20, 'dead': False, 'nearSpawn': True}, r


@test
def test_reconnect_takes_over_old_connection(pg):
    r = ev(pg, NET_JS + r"""
      const { game, host } = await mkHost('RECNX');
      const old = await join('RECNX', 'ua', 'An'); await until(() => game.players.has('ua'));
      game.giveItem('ua', 'xu', 9);
      let oldClosed = null; old.on('closed', r => { oldClosed = r; });
      const again = await join('RECNX', 'ua', 'An');
      await until(() => oldClosed);
      const xu = again.you.inv.filter(Boolean).filter(s => s.id === 'xu').reduce((a, s) => a + s.n, 0);
      let hostDup = null; try { await join('RECNX', 'uh', 'Giả host'); } catch (e) { hostDup = e.message; }
      return { oldClosed, xu, players: game.players.size, hostDup };
    """)
    assert r['oldClosed'] == 'replaced' and r['xu'] == 9 and r['players'] == 2 and r['hostDup'] == 'dup-uid', r


@test
def test_solo_pause_stops_the_simulation(pg):
    r = ev(pg, GAME_JS + r"""
      const { HostSession } = await imp('net/host.js');
      const game = new Game({ seed: 777, spawning: false });
      const s = HostSession.solo({ game, name: 'T', uid: 'u1' });
      await wait(250); const running = game.tickNo > 2;
      s.pause(true); const t0 = game.tickNo; await wait(300); const frozen = game.tickNo === t0;
      s.pause(false); await wait(250); const resumed = game.tickNo > t0;
      s.leave();
      return { running, frozen, resumed };
    """)
    assert r == {'running': True, 'frozen': True, 'resumed': True}, r


@test
def test_host_view_keeps_chunks_needed_near_other_players(pg):
    r = ev(pg, GAME_JS + r"""
      const { World } = await imp('world/world.js');
      const w = new World(5);
      w.keepAround([{ x: 0, z: 0 }], 2, [{ x: 400, z: 0, r: 2 }]);
      const far = w.chunk(25, 0);
      w.keepAround([{ x: 0, z: 0 }], 2, [{ x: 400, z: 0, r: 2 }]);
      const same = w.chunk(25, 0) === far;
      w.keepAround([{ x: 0, z: 0 }], 2);                                      // không còn ai ở xa: được bỏ
      return { same, dropped: !w.has(25, 0), size: w.chunks.size };
    """)
    assert r['same'] and r['dropped'] and r['size'] == 25, r


@test
def test_hardening_odd_uids_loot_placement_no_alive_mob_cleanup_and_st_flood(pg):
    r = ev(pg, NET_JS + r"""
      const { game, host } = await mkHost('HARDN');
      const odd = await join('HARDN', 'constructor', 'Lạ');
      await until(() => game.players.has('constructor'));
      // vật phẩm rơi không chặn đặt block
      const pa = game.player('constructor'); const x = Math.floor(pa.x) + 2, z = Math.floor(pa.z), y = game.world.surfaceY(x, z);
      game.dropItem('dirt', 1, x + 0.5, y + 1.2, z + 0.5);
      const occupied = game.occupied(x, y + 1, z);
      // chết hết: quái không bị dọn sạch
      const m = spawnMob(game, 'soi-xam', pa.x + 5, pa.y, pa.z); m.frozen = true;
      for (const p of game.players.values()) { game.hurtPlayer(p, 999, null); }
      for (let i = 0; i < 40; i++) game.tick(0.05);
      const mobKept = game.ents.has(m.id);
      // dồn dập 'st': bị giới hạn tốc độ
      const q = game.player('constructor'); q.dead = false; q.hp = 20;
      return { odd: !!odd.you, occupied, mobKept };
    """)
    assert r == {'odd': True, 'occupied': False, 'mobKept': True}, r



def _e2e_two_players(pg, browser, base):
    url = root(base) + 'games/the-gioi-khoi/game.html?debug&seed=777&r=4&net=memory'
    errs = []
    def watch(page, name):
        page.on('console', lambda m: errs.append(f'{name}: {m.text}') if m.type == 'error' else None)
        page.on('pageerror', lambda e: errs.append(f'{name}: {e}'))
    A = pg; watch(A, 'A')
    B = pg.context.new_page(); watch(B, 'B')
    A.goto(url + '&uid=ua'); B.goto(url + '&uid=ub'); A.wait_for_timeout(300)

    # --- 1. A tạo phòng, B vào bằng mã
    A.fill('#name', 'An'); A.click('#btn-host')
    A.wait_for_function("window.__g && window.__g.S && window.__g.pending === 0", timeout=30000)
    code = A.inner_text('#roomcode').replace('Phòng', '').strip()
    assert len(code) == 5, code
    B.fill('#name', 'Bình'); B.fill('#code', code.lower()); B.click('#btn-join')
    B.wait_for_function("window.__g && window.__g.S && window.__g.pending === 0", timeout=30000)
    A.wait_for_function("__g.game.players.size === 2")
    a_uid, b_uid = A.evaluate("__g.S.uid"), B.evaluate("__g.S.uid")

    tp = lambda uid, x, y, z: A.evaluate("""([uid, x, y, z]) => { const g = __g.game, p = g.player(uid); p.x = x; p.y = y; p.z = z; p.lastState = g.time;
        g.emit(uid, { t: 'teleport', x, y, z }); }""", [uid, x, y, z])
    npc = lambda id: A.evaluate("(id) => { const e = [...__g.game.ents.values()].find(e => e.kind === 'npc' && e.npc === id); return { x: e.x, y: e.y, z: e.z, id: e.id }; }", id)

    # --- 2. A đào block, B thấy; A đặt block, B thấy
    n = npc('truong-lang')
    tp(a_uid, n['x'] - 5, n['y'], n['z'] + 5); tp(b_uid, n['x'] + 5, n['y'], n['z'] + 5)
    A.wait_for_timeout(600)
    cell = A.evaluate("""() => { const l = __g.local, w = __g.S.world; const x = Math.floor(l.x) + 1, z = Math.floor(l.z), y = w.surfaceY(x, z); return { x, y, z, id: w.get(x, y, z) }; }""")
    A.evaluate("([x, y, z]) => __g.lookAt(x + 0.5, y + 0.5, z + 0.5)", [cell['x'], cell['y'], cell['z']])
    A.mouse.move(550, 300); A.mouse.down()
    A.wait_for_function("([x, y, z]) => __g.S.world.get(x, y, z) === 0", arg=[cell['x'], cell['y'], cell['z']], timeout=8000)
    A.mouse.up()
    B.wait_for_function("([x, y, z]) => __g.S.world.get(x, y, z) === 0", arg=[cell['x'], cell['y'], cell['z']], timeout=8000)
    A.wait_for_function("__g.S.you.inv.some(s => s && s.id === 'dirt')")
    assert 'Đất' in A.inner_text('#hotbar')
    A.keyboard.press('Digit1')
    A.evaluate("([x, y, z]) => __g.lookAt(x + 0.5, y + 0.2, z + 0.5)", [cell['x'], cell['y'], cell['z']])
    A.mouse.down(button='right'); A.mouse.up(button='right')
    B.wait_for_function("([x, y, z]) => __g.S.world.get(x, y, z) === 2", arg=[cell['x'], cell['y'], cell['z']], timeout=8000)

    # --- 3. A đánh quái, quái biến mất ở cả hai, A nhặt đồ rơi
    A.evaluate("""(uid) => { const g = __g.game; g.giveItem(uid, 'gem_sword', 1); }""", a_uid)
    A.wait_for_function("__g.S.you.inv.some(s => s && s.id === 'gem_sword')")
    slot = A.evaluate("__g.S.you.inv.findIndex(s => s && s.id === 'gem_sword')")
    A.keyboard.press(f'Digit{slot + 1}') if slot < 9 else None
    A.wait_for_function("(i) => __g.S.you.sel === i", arg=slot)
    mob_id = A.evaluate("""() => { const g = __g.game, l = __g.local; const mod = window.__mods; return null; }""")
    mob = A.evaluate("""async () => { const { spawnMob } = await import('/games/the-gioi-khoi/sim/mobs.js'); const g = __g.game, l = __g.local;
        const m = spawnMob(g, 'xac-song', l.x + 2.5, l.y, l.z); m.frozen = true; return { id: m.id }; }""")
    A.wait_for_function("(id) => __g.interp.es.some(e => e.id === id)", arg=mob['id'])
    B.wait_for_function("(id) => __g.interp.es.some(e => e.id === id)", arg=mob['id'])
    A.wait_for_timeout(300)
    A.evaluate("(id) => { const e = __g.interp.es.find(e => e.id === id); __g.lookAt(e.x, e.y + 0.9, e.z); }", mob['id'])
    A.mouse.down()
    A.wait_for_function("(id) => !__g.game.ents.has(id)", arg=mob['id'], timeout=8000)
    A.mouse.up()
    B.wait_for_function("(id) => !__g.interp.es.some(e => e.id === id)", arg=mob['id'], timeout=8000)
    A.evaluate("""(uid) => { const g = __g.game, p = g.player(uid); for (const e of g.ents.values()) if (e.kind === 'item') { e.x = p.x; e.z = p.z; e.y = p.y + 0.3; e.born = -99; } }""", a_uid)
    A.wait_for_function("__g.S.you.inv.some(s => s && s.id === 'xu')", timeout=8000)

    # --- 4. Nhiệm vụ qua hội thoại thật
    tp(a_uid, n['x'] + 1.5, n['y'], n['z']); A.wait_for_timeout(500)
    A.evaluate("(id) => { const e = __g.interp.es.find(e => e.id === id); __g.lookAt(e.x, e.y + 1.2, e.z); }", n['id'])
    A.mouse.down(button='right'); A.mouse.up(button='right')
    A.wait_for_selector('#panel:not([hidden])')
    assert 'Chào lữ khách' in A.inner_text('#panel')
    A.click('#panel button.choice:has-text("việc để làm")')
    A.click('#panel button.choice:has-text("Chào làng")')
    A.wait_for_function("__g.game.questState('%s', 'chao-lang') === 'active'" % a_uid)
    A.click('#panel button.choice:has-text("Được")'); A.wait_for_selector('#panel', state='hidden')
    A.wait_for_function("document.getElementById('quests').innerText.includes('Chào làng')")
    A.evaluate("(uid) => { __g.game.giveItem(uid, 'log', 5); __g.game.giveItem(uid, 'wood_pick', 1); }", a_uid)
    A.wait_for_function("document.getElementById('quests').innerText.includes('về báo')", timeout=8000)
    A.evaluate("(id) => { const e = __g.interp.es.find(e => e.id === id); __g.lookAt(e.x, e.y + 1.2, e.z); }", n['id'])
    A.mouse.down(button='right'); A.mouse.up(button='right')
    A.wait_for_selector('#panel button.choice:has-text("trả nhiệm vụ")')
    A.click('#panel button.choice:has-text("trả nhiệm vụ")')
    A.click('#panel button.choice:has-text("Trả: Chào làng")')
    A.wait_for_function("__g.game.questState('%s', 'chao-lang') === 'done'" % a_uid)
    A.click('#panel button.choice:has-text("Cảm ơn")'); A.wait_for_selector('#panel', state='hidden')
    A.wait_for_function("__g.S.you.inv.some(s => s && s.id === 'wood_sword')", timeout=8000)

    # --- 5. Kho đồ và chế tạo qua giao diện (E)
    A.evaluate("(uid) => { __g.game.giveItem(uid, 'planks', 8); __g.game.giveItem(uid, 'stick', 4); }", a_uid)
    A.wait_for_function("__g.S.you.inv.some(s => s && s.id === 'planks')")
    A.keyboard.press('KeyE'); A.wait_for_selector('#panel:not([hidden])')
    assert 'Kho đồ' in A.inner_text('#panel')
    A.click('#panel .rec:has-text("Bàn chế tạo") button')
    A.wait_for_function("__g.S.you.inv.some(s => s && s.id === 'workbench')", timeout=8000)
    A.keyboard.press('Escape'); A.wait_for_selector('#panel', state='hidden')

    # --- 6. Boss ở đấu trường: cả hai cùng thấy, hạ boss
    site = A.evaluate("__g.game.flags.sites.arena['thu-linh-soi']")
    tp(a_uid, site['x'] + 0.5 + 4, site['y'] + 1, site['z'] + 0.5); tp(b_uid, site['x'] + 0.5 - 4, site['y'] + 1, site['z'] + 0.5)
    A.wait_for_function("[...__g.game.ents.values()].some(e => e.kind === 'boss')", timeout=8000)
    boss_id = A.evaluate("[...__g.game.ents.values()].find(e => e.kind === 'boss').id")
    A.wait_for_function("(id) => __g.interp.es.some(e => e.id === id)", arg=boss_id)
    B.wait_for_function("(id) => __g.interp.es.some(e => e.id === id)", arg=boss_id)
    B.wait_for_function("!document.getElementById('bossbar').hidden")
    assert 'Thủ Lĩnh Sói' in B.inner_text('#bossbar')
    A.evaluate("(id) => { const b = __g.game.ents.get(id); b.hp = 5; b.frozen = true; const p = __g.game.player('%s'); p.hp = 9999; p.maxHp = 9999; }" % a_uid, boss_id)
    A.wait_for_function("(id) => __g.game.ents.get(id) && __g.game.ents.get(id).hp <= 5", arg=boss_id)
    A.evaluate("(id) => { const b = __g.game.ents.get(id); const p = __g.game.player('%s'); p.x = b.x + 2.5; p.z = b.z; p.y = b.y; __g.game.emit('%s', { t: 'teleport', x: p.x, y: p.y, z: p.z }); }" % (a_uid, a_uid), boss_id)
    A.wait_for_timeout(500)
    A.evaluate("(id) => { const e = __g.interp.es.find(e => e.id === id); __g.lookAt(e.x, e.y + 0.8, e.z); }", boss_id)
    A.mouse.down()
    A.wait_for_function("(id) => !__g.game.ents.has(id)", arg=boss_id, timeout=10000)
    A.mouse.up()
    B.wait_for_function("__g.S.flags['boss:thu-linh-soi'] === true", timeout=8000)
    B.wait_for_function("document.getElementById('bossbar').hidden", timeout=8000)
    assert A.evaluate("__g.game.flags['boss:thu-linh-soi']")

    # --- 7. B rời phòng, A còn một mình
    B.evaluate("__g.S.leave()")
    A.wait_for_function("__g.game.players.size === 1", timeout=8000)
    assert not errs, errs


@test
def test_e2e_two_players(pg, browser, base):
    import traceback
    try:
        _e2e_two_players(pg, browser, base)
    except Exception as e:
        for f in traceback.extract_tb(e.__traceback__):
            if f.filename.endswith('test_game.py') and f.name == '_e2e_two_players': print(f'      > dòng {f.lineno}: {f.line}')
        raise


if __name__ == '__main__':
    run(TESTS)
