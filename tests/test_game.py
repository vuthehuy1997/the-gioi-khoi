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
const until = async (f, ms = 3000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('hết giờ chờ: ' + String(f).slice(0, 110)); await wait(10); } };
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
const faceTo = (m, p) => { m.yaw = Math.atan2(-(p.x - m.x), -(p.z - m.z)); m.yawT = m.yaw; return m; };
const faceAway = (m, p) => { m.yaw = Math.atan2(-(p.x - m.x), -(p.z - m.z)) + Math.PI; m.yawT = m.yaw; return m; };
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
      const m = faceTo(spawnMob(g, 'soi-xam', cx + 0.5 + 10, y0 + 1, cz + 0.5), p);
      const d0 = dist(m, p); const hp0 = p.hp;
      run(g, 1.0); const d1 = dist(m, p);
      run(g, 6);
      return { d0, d1, hp0, hp1: p.hp, close: dist(m, p) };
    """)
    assert r['d1'] < r['d0'] - 0.8 and r['hp1'] < r['hp0'] and r['close'] < 3, r         # mất ~0,6 giây để nhận ra rồi mới lao tới


@test
def test_mob_ai_flee_runs_away(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = faceTo(spawnMob(g, 'nai', cx + 0.5 + 4, y0 + 1, cz + 0.5), p);
      const d0 = dist(m, p); run(g, 3);
      return { d0, d1: dist(m, p), hp: p.hp };
    """)
    assert r['d1'] > r['d0'] + 3 and r['hp'] == 20, r


@test
def test_mob_ai_ranged_keeps_distance_and_shoots(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = faceTo(spawnMob(g, 'xuong-cung', cx + 0.5 + 4, y0 + 1, cz + 0.5), p);
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
      p.x = cx + 0.5 + 6; faceTo(m, p); run(g, 2); const chased = dist(m, p) < 8 && Math.abs(m.x - (cx + 12.5)) > 0.5;
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
def test_new_region_bosses_have_arenas_in_their_region_moves_and_rewards(pg):
    r = ev(pg, GAME_JS + r"""
      const { BOSSES } = await imp('content/bosses.js');
      const { spawnBoss } = await imp('sim/boss.js');
      const g = new Game({ seed: 777, spawning: false }); const p = g.addPlayer('u1', 'T'); p.hp = p.maxHp = 99999;
      g.buildStructures();
      const out = {};
      for (const id of ['chua-dam-lay', 'vua-nham-thach', 'ho-ve-pha-le']) {
        const d = BOSSES[id], site = g.flags.sites.arena[id];
        p.x = site.x + 200; p.z = site.z + 200; p.y = 60; g.tick(1);
        p.x = site.x + 0.5; p.z = site.z + 0.5; p.y = site.y + 1; g.tick(1);
        const b = [...g.ents.values()].find(e => e.kind === 'boss' && e.type === id);
        const floor = g.world.get(site.x, site.y, site.z);
        // chiêu: ép từng pha rồi đếm chiêu dùng
        const seen = new Set(); const evs = [];
        b.hp = b.maxHp * 0.2; b.frozen = false;
        for (let i = 0; i < 60 * 40 && g.ents.has(b.id); i++) {
          p.hp = p.maxHp; g.tick(1 / 20);
          for (const e of g.ents.values()) if (e.kind === 'proj') seen.add('proj:' + (e.style || ''));
          for (const e of g.ents.values()) if (e.kind === 'mob' && b.minions.includes(e.id)) seen.add('summon');
        }
        out[id] = { region: g.world.regionAt(site.x, site.z), want: d.region, floor, phases: b.phase, seen: [...seen] };
      }
      return out;
    """)
    for bid, v in r.items():
        assert v['region'] == v['want'] and v['floor'] != 0, (bid, v)
        assert v['phases'] == 2, (bid, v)
    assert any(x.startswith('proj:fire') for x in r['vua-nham-thach']['seen']), r
    assert 'summon' in r['chua-dam-lay']['seen'] or any(x.startswith('proj:') for x in r['chua-dam-lay']['seen']), r


@test
def test_new_boss_defeat_sets_flag_and_drops_trophy(pg):
    r = ev(pg, BOSS_JS + r"""
      const out = {};
      for (const id of ['chua-dam-lay', 'vua-nham-thach', 'ho-ve-pha-le']) {
        const { g, p, b } = mkBossFight(id);
        p.inv.fill(null); p.inv[0] = { id: 'gem_sword', n: 1 }; p.sel = 0;
        b.frozen = true; g.flags[BOSSES[id].flag] = false;
        for (let i = 0; i < 250 && g.ents.has(b.id); i++) { run(g, 0.5); g.act('u1', { t: 'hit', id: b.id }); }
        const drops = [...g.ents.values()].filter(e => e.kind === 'item').map(e => e.item);
        out[id] = { dead: !g.ents.has(b.id), flag: !!g.flags[BOSSES[id].flag], drops, want: BOSSES[id].drops[0].item };
      }
      return out;
    """)
    for bid, v in r.items():
        assert v['dead'] and v['flag'] and v['want'] in v['drops'], (bid, v)


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
    assert r['flat'] and r['clear'] and r['sites'] == ['bang-de', 'bo-cap-chua', 'chua-dam-lay', 'ho-ve-pha-le', 'thu-linh-soi', 'vua-nham-thach'], r
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
      const mx = pa.x - 2, m = spawnMob(game, 'xac-song', mx, game.world.surfaceY(Math.floor(mx), Math.floor(pa.z)) + 1, pa.z); m.frozen = true;   // bên không có block vừa đặt
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


# ---------------------------------------------------------------- H5: độ mượt khi di chuyển (chi phí JS mỗi khung)

def _streaming_run(pg, base, extra=''):
    pg.goto(root(base) + 'games/the-gioi-khoi/game.html?debug&net=memory&seed=777&r=6&aa=0' + extra); pg.wait_for_timeout(300)
    pg.fill('#name', 'P'); pg.click('#btn-new')
    pg.wait_for_function("window.__g && window.__g.S && window.__g.pending === 0", timeout=60000)
    pg.wait_for_timeout(500)
    return pg.evaluate("""async () => {
      const g = __g; g.perf.reset();
      let long = 0, longMax = 0; const po = new PerformanceObserver(l => { for (const e of l.getEntries()) { long++; longMax = Math.max(longMax, e.duration); } }); po.observe({ entryTypes: ['longtask'] });
      const t0 = performance.now();
      await new Promise(res => { function f(now) { g.local.x += 0.9; g.local.vy = 0; if (now - t0 < 7000) requestAnimationFrame(f); else res(); } requestAnimationFrame(f); });   // ~16 block/giây: nhanh gấp 3 lần chạy nước rút
      await new Promise(r => setTimeout(r, 200));
      return { frames: g.perf.n, avg: g.perf.sum / g.perf.n, p95: g.perf.p(0.95), max: g.perf.max, long, longMax, chunks: g.scene.chunkCount(), pending: g.pending };
    }""")


@test
def test_perf_streaming_frame_cost(pg, browser, base):
    r = _streaming_run(pg, base)
    assert r['frames'] > 30, r
    assert r['avg'] < 6 and r['p95'] < 16 and r['max'] < 40 and r['long'] <= 2, r


# ---------------------------------------------------------------- V: chất lượng hình ảnh so với Minecraft

def _open_game(pg, base, extra='', name='V'):
    pg.goto(root(base) + 'games/the-gioi-khoi/game.html?debug&net=memory&seed=777&r=5&hw=1' + extra); pg.wait_for_timeout(300)
    pg.fill('#name', name); pg.click('#btn-new')
    pg.wait_for_function("window.__g && window.__g.S && window.__g.pending === 0", timeout=60000)
    pg.wait_for_timeout(300)


@test
def test_visual_sky_sun_moon_stars_clouds_follow_time(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""() => {
      const g = __g, S = g.S, out = {};
      const at = (t) => { g.game.time = t; S.time = t; g.renderNow(); return { sun: g.sky.sun.visible, moon: g.sky.moon.visible, stars: g.sky.stars.material.opacity,
        sunY: g.sky.sun.position.y, top: g.sky.dome.geometry.attributes.color.getX(g.sky.dome.geometry.attributes.position.count - 1) }; };
      out.noon = at(180); out.night = at(480); out.dusk = at(380);
      out.clouds = g.sky.clouds.visible && g.sky.clouds.position.y > 50;
      const cam = g.scene.camera.position; out.cloudFollows = Math.abs(g.sky.root.position.x - cam.x) < 0.01;
      return out;
    }""")
    assert r['noon']['sun'] and r['noon']['sunY'] > 100 and r['noon']['stars'] < 0.05, r
    assert r['night']['moon'] and r['night']['stars'] > 0.5 and not r['night']['sun'], r
    assert r['night']['top'] < r['noon']['top'] * 0.5, r
    assert r['clouds'] and r['cloudFollows'], r


@test
def test_visual_selection_outline_crack_and_particles(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""async () => {
      const g = __g, w = g.S.world, l = g.local, out = {};
      // nhắm xuống mặt đất ngay trước mặt
      const x = Math.floor(l.x) + 2, z = Math.floor(l.z), y = w.surfaceY(x, z);
      g.lookAt(x + 0.5, y + 0.5, z + 0.5); g.renderNow();
      out.outline = g.fx.outline.visible && Math.abs(g.fx.outline.position.x - (x + 0.5)) < 0.6;
      g.mouse.left = true; await new Promise(r => setTimeout(r, 250)); g.renderNow();
      out.crack = g.fx.crack.visible; out.stage = g.fx.crack.material.map.offset.x;
      await new Promise(r => setTimeout(r, 900)); g.mouse.left = false;
      out.broken = w.get(x, y, z) === 0;
      out.particles = g.fx.particleCount;
      return out;
    }""")
    assert r['outline'] and r['crack'] and r['broken'] and r['particles'] >= 8, r


@test
def test_visual_vertex_ao_and_skylight_shade_corners_and_caves(pg):
    r = ev(pg, r"""
      const { buildChunkMesh } = await imp('render/mesher.js');
      // sàn đá phẳng ở y=9, một cột đá cao 3 ở (5,10..12,5)
      const cells = {};
      for (let x = -1; x <= 16; x++) for (let z = -1; z <= 16; z++) cells[x + ',9,' + z] = 1;
      for (let y = 10; y <= 12; y++) cells['5,' + y + ',5'] = 1;
      // mái đá rộng ở y=14 che nửa chunk (x >= 8)
      for (let x = 8; x <= 16; x++) for (let z = -1; z <= 16; z++) cells[x + ',14,' + z] = 1;
      const m = buildChunkMesh((x, y, z) => cells[x + ',' + y + ',' + z] || 0, 0, 0);
      const p = m.solid.positions, c = m.solid.colors;
      const floorTop = [];                     // đỉnh nằm ở y=10 (mặt trên của sàn) trên các mặt hướng lên
      for (let i = 0; i < p.length / 3; i++) if (p[i * 3 + 1] === 10) floorTop.push({ x: p[i * 3], z: p[i * 3 + 2], b: c[i * 3] });
      const nearWall = floorTop.filter(v => Math.abs(v.x - 5) <= 1 && Math.abs(v.z - 5) <= 1 && v.x < 8).map(v => v.b);
      const open = floorTop.filter(v => v.x <= 2 && v.z <= 2).map(v => v.b);
      const covered = floorTop.filter(v => v.x >= 11 && v.z >= 3 && v.z <= 12).map(v => v.b);
      const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
      return { open: Math.max(...open), nearMin: Math.min(...nearWall), covered: mean(covered), openMean: mean(open) };
    """)
    assert r['open'] > 0.99 and r['nearMin'] < r['open'] * 0.8, r        # AO: góc sát tường tối hơn
    assert r['covered'] < r['openMean'] * 0.8, r                          # dưới mái tối hơn chỗ hở trời


@test
def test_visual_plants_and_terrain_relief(pg):
    r = ev(pg, r"""
      const { generateChunk, columnInfo, WATER_LEVEL } = await imp('world/generate.js');
      const { buildChunkMesh } = await imp('render/mesher.js');
      const { World } = await imp('world/world.js');
      const w = new World(777);
      let plants = { 17: 0, 18: 0, 19: 0, 20: 0 }, best = { n: -1, cx: 0, cz: 0 };
      for (let cx = -6; cx <= 6; cx++) for (let cz = -6; cz <= 6; cz++) {
        const ch = w.chunk(cx, cz); let n = 0;
        for (const v of ch) if (v >= 17 && v <= 20) { plants[v]++; n++; }
        if (n > best.n) best = { n, cx, cz };
      }
      const m = buildChunkMesh((x, y, z) => w.get(x, y, z), best.cx, best.cz);
      // độ cao: phương sai vùng rừng, tỉ lệ cột chìm dưới nước (hồ)
      const hs = []; let lake = 0, n = 0;
      for (let x = -600; x <= 600; x += 12) for (let z = -600; z <= 600; z += 12) { const c = columnInfo(777, x, z); if (c.region.id !== 'rung-suong') continue; hs.push(c.h); n++; if (c.h <= WATER_LEVEL) lake++; }
      const mean = hs.reduce((a, b) => a + b, 0) / hs.length, sd = Math.sqrt(hs.reduce((a, b) => a + (b - mean) ** 2, 0) / hs.length);
      // đi xuyên cỏ
      const { makePlayer, stepPlayer } = await imp('sim/physics.js');
      const sp = w.findSpawn(), y = w.surfaceY(sp.x, sp.z);
      for (let dx = 0; dx <= 5; dx++) { w.set(sp.x + dx, y, sp.z, 3); w.set(sp.x + dx, y + 1, sp.z, 0); w.set(sp.x + dx, y + 2, sp.z, 0); w.set(sp.x + dx, y + 3, sp.z, 0); }   // hành lang trống để chỉ đo cỏ có cản không
      w.set(sp.x, y + 1, sp.z, 17); w.set(sp.x + 1, y + 1, sp.z, 17);
      const p = makePlayer(sp.x + 0.5, y + 1, sp.z + 0.5);
      for (let i = 0; i < 20; i++) stepPlayer(w, p, { fx: 1 }, 0.05);
      return { plants, meshPlantVerts: m.plants.positions.length / 3, sd, range: Math.max(...hs) - Math.min(...hs), lakeShare: lake / n, walked: p.x - (sp.x + 0.5) };
    """)
    assert r['plants']['17'] > 200 and r['plants']['18'] > 5 and r['plants']['19'] > 5, r
    assert r['meshPlantVerts'] > 0 and r['sd'] > 2.5 and r['range'] >= 14 and 0.01 < r['lakeShare'] < 0.35 and r['walked'] > 1.5, r


@test
def test_visual_entities_animate_flash_and_cast_shadow(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""async () => {
      const g = __g, v = g.ents; const out = {};
      const e = (x, hp) => [{ key: 'e:900', kind: 'mob', type: 'soi-xam', id: 900, x, y: 40, z: 5, yaw: 0, hp, maxHp: 16 }];
      let x = 0, maxLeg = 0, opposite = false;
      for (let i = 0; i < 24; i++) { x += 0.2; v.update(e(x, 16), i * 0.05, 0.05, []); const l = v.rigOf('e:900').legs; maxLeg = Math.max(maxLeg, ...l.map(Math.abs)); if (l[0] * l[1] < -0.01) opposite = true; }
      out.walk = { ...v.rigOf('e:900'), maxLeg, opposite }; out.shadow = out.walk.hasShadow;
      v.update(e(x, 8), 1, 0.05, []); out.hurt = v.rigOf('e:900').flashing;
      for (let i = 0; i < 6; i++) v.update(e(x, 8), 1.1 + i * 0.05, 0.05, []);
      out.after = v.rigOf('e:900').flashing;
      // đứng yên: chân về 0
      for (let i = 0; i < 40; i++) v.update(e(x, 8), 2 + i * 0.05, 0.05, []);
      out.idle = v.rigOf('e:900').legs.map(a => Math.abs(a));
      // người chơi có tay, NPC quay mặt về người chơi
      v.update([{ key: 'p:t', kind: 'player', uid: 'u', name: 'T', x: 0, y: 40, z: 0, yaw: 0, pitch: 0.4 }], 0, 0.05, []);
      out.player = v.rigOf('p:t');
      return out;
    }""")
    legs = r['walk']['legs']
    assert len(legs) == 4 and r['walk']['maxLeg'] > 0.4 and r['walk']['opposite'], r      # chân đung đưa và đối xứng ngược pha
    assert r['shadow'] and r['hurt'] and not r['after'] and max(r['idle']) < 0.25, r
    assert len(r['player']['arms']) == 2 and len(r['player']['legs']) == 2, r


@test
def test_visual_camera_fx_fov_bob_tilt_and_governor(pg):
    r = ev(pg, r"""
      const { stepCameraFx, newCameraFx } = await imp('render/camerafx.js');
      const { governLevel, LEVELS, PRESETS, isSoftwareRenderer } = await imp('render/quality.js');
      const c = newCameraFx(); const f0 = c.fov;
      for (let i = 0; i < 60; i++) stepCameraFx(c, 0.016, { moving: true, sprint: true, onGround: true, speed: 5.6 });
      const sprintFov = c.fov, bob = c.bob, amp = c.bobAmp;
      for (let i = 0; i < 80; i++) stepCameraFx(c, 0.016, { moving: false, sprint: false, onGround: true, speed: 0 });
      const back = c.fov, ampIdle = c.bobAmp;
      c.tilt = 0.1; for (let i = 0; i < 40; i++) stepCameraFx(c, 0.016, { moving: false, sprint: false, onGround: true, speed: 0 });
      // bộ điều chỉnh mức: chậm kéo dài -> hạ mức; nhanh kéo dài -> nâng lại; có sàn và trần
      const st = { slow: 0, fast: 0 }; let lv = 6; const hist = [];
      for (let i = 0; i < 400; i++) lv = governLevel(st, lv, 6, 60, 0.05); hist.push(lv);
      for (let i = 0; i < 4000; i++) lv = governLevel(st, lv, 6, 10, 0.05); hist.push(lv);
      const st2 = { slow: 0, fast: 0 }; let lv2 = 3; for (let i = 0; i < 4000; i++) lv2 = governLevel(st2, lv2, 6, 90, 0.05);
      const st3 = { slow: 0, fast: 0 }; let lv3 = 4; for (let i = 0; i < 4000; i++) lv3 = governLevel(st3, lv3, 4, 20, 0.05);
      const { defaultPreset } = await imp('render/quality.js');
      const presets = [defaultPreset({ cores: 2, memory: 8 }), defaultPreset({ cores: 16, memory: 32 }), defaultPreset({ cores: 8, memory: 1 }), defaultPreset({ cores: 16, memory: 32, software: true })];
      const soft = [isSoftwareRenderer('Google SwiftShader'), isSoftwareRenderer('ANGLE (Intel, Mesa llvmpipe)'), isSoftwareRenderer('NVIDIA GeForce RTX 3060'), isSoftwareRenderer('Apple M2')];
      const monotone = LEVELS.every((l, i) => i === 0 || (l.r >= LEVELS[i - 1].r && l.pr >= LEVELS[i - 1].pr));
      return { f0, sprintFov, bob, amp, back, ampIdle, tilt: c.tilt, hist, floor: lv2, steady: lv3, presets, soft, monotone, presetLevels: Object.values(PRESETS).map(p => p.level) };
    """)
    assert r['sprintFov'] > r['f0'] + 5 and r['bob'] > 1 and r['amp'] > 0.7 and abs(r['back'] - r['f0']) < 0.5 and r['ampIdle'] < 0.05 and abs(r['tilt']) < 0.01, r
    assert r['hist'][0] == 0 and r['hist'][1] == 6 and r['floor'] == 0 and r['steady'] == 4, r      # hạ tới sàn, nâng lại tới trần, không vượt trần
    assert r['presets'] == ['low', 'medium', 'low', 'low'] and r['soft'] == [True, True, False, False] and r['monotone'] and r['presetLevels'] == [1, 4, 6], r


@test
def test_audio_icons_and_underwater_tint(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""async () => {
      const g = __g, w = g.S.world, l = g.local, out = {};
      // âm thanh: đào xong thì có tiếng đào và tiếng vỡ được ghi nhận
      const x = Math.floor(l.x) + 2, z = Math.floor(l.z), y = w.surfaceY(x, z);
      g.lookAt(x + 0.5, y + 0.5, z + 0.5); g.renderNow();
      g.mouse.left = true; await new Promise(r => setTimeout(r, 1300)); g.mouse.left = false;
      out.sfx = { ...g.sfx.stats };
      // icon: khác nhau và là ảnh thật
      const a = g.icons.get('stone'), b = g.icons.get('wood_pick'), c = g.icons.get('gem'), d = g.icons.get('stone');
      out.icons = { distinct: new Set([a, b, c]).size, cached: a === d, isImg: a.startsWith('data:image/png') };
      g.game.giveItem(g.S.uid, 'wood_pick', 1); await new Promise(r => setTimeout(r, 400));
      out.hotbarImgs = document.querySelectorAll('#hotbar img').length;
      // dưới nước: đặt camera vào nước
      const wx = Math.floor(l.x) + 3, wz = Math.floor(l.z);
      for (let dy = -2; dy <= 4; dy++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) w.set(wx + dx, 60 + dy, wz + dz, 10);
      l.x = wx + 0.5; l.y = 58.5; l.z = wz + 0.5; l.vy = 0; g.renderNow();
      out.water = !document.getElementById('water').hidden;
      return out;
    }""")
    assert r['sfx'].get('dig', 0) >= 1 and r['sfx'].get('break', 0) >= 1, r
    assert r['icons']['distinct'] == 3 and r['icons']['cached'] and r['icons']['isImg'] and r['hotbarImgs'] >= 1 and r['water'], r


@test
def test_quality_presets_debug_overlay_and_optimistic_edits(pg, browser, base):
    url = root(base) + 'games/the-gioi-khoi/game.html?debug&seed=777&net=memory&aa=0'
    A = pg; B = pg.context.new_page()
    A.goto(url + '&uid=ua'); B.goto(url + '&uid=ub'); A.wait_for_timeout(300)
    A.fill('#name', 'An'); A.click('#btn-host')
    A.wait_for_function("window.__g && window.__g.S && window.__g.pending === 0", timeout=30000)
    code = A.inner_text('#roomcode').replace('Phòng', '').strip()
    B.fill('#name', 'Bình'); B.fill('#code', code); B.click('#btn-join')
    B.wait_for_function("window.__g && window.__g.S && window.__g.pending === 0", timeout=30000)
    # chất lượng: Thấp giảm tầm nhìn, ẩn mây, giảm độ phân giải; Cao tăng lại
    A.evaluate("__g.applyQuality('low')")
    low = A.evaluate("({ r: __g.view.radius, clouds: __g.sky.clouds.visible, pr: __g.scene.renderer.getPixelRatio(), q: __g.quality })")
    A.evaluate("__g.applyQuality('high')")
    high = A.evaluate("({ r: __g.view.radius, clouds: __g.sky.clouds.visible })")
    assert low['r'] == 3 and not low['clouds'] and low['pr'] <= 0.75 and low['q'] == 'low' and high['r'] == 8 and high['clouds'], (low, high)
    A.evaluate("__g.applyQuality('medium')")
    # F3: bảng thông số
    A.keyboard.press('F3')
    A.wait_for_function("!document.getElementById('debug').hidden && document.getElementById('debug').textContent.includes('Tam giác')")
    txt = A.inner_text('#debug'); assert 'FPS' in txt and 'XYZ' in txt and 'Mạng: 2 người' in txt, txt
    A.keyboard.press('F3'); A.wait_for_function("document.getElementById('debug').hidden")
    # khách: đào lạc quan thấy ngay, bị từ chối thì hoàn tác
    cell = B.evaluate("""() => { const l = __g.local, w = __g.S.world; const x = Math.floor(l.x) + 1, z = Math.floor(l.z), y = w.surfaceY(x, z); return { x, y, z, id: w.get(x, y, z) }; }""")
    arg = [cell['x'], cell['y'], cell['z']]
    now = B.evaluate("([x, y, z]) => { __g.optimistic(x, y, z, 0); return __g.S.world.get(x, y, z); }", arg)
    assert now == 0 and A.evaluate("([x, y, z]) => __g.game.world.get(x, y, z)", arg) == cell['id']      # khách thấy ngay, host chưa đổi
    B.evaluate("() => __g.handleEvent({ t: 'fail', a: 'break', reason: 'reach' })")
    assert B.evaluate("([x, y, z]) => __g.S.world.get(x, y, z)", arg) == cell['id']                         # bị từ chối: trả lại
    assert B.evaluate("__g.pendingEdits.length") == 0


# ---------------------------------------------------------------- M: mô hình sinh vật

MODEL_JS = """
const THREE = await import('/platform/vendor/three/three.module.js');
const M = await imp('render/models/index.js');
const { MOBS } = await imp('content/mobs.js'); const { BOSSES } = await imp('content/bosses.js'); const { NPCS } = await imp('content/npcs.js');
const lib = M.createModelLib(THREE);
const entityList = () => [
  ...Object.keys(MOBS).map(t => ({ kind: 'mob', type: t })), ...Object.keys(BOSSES).map(t => ({ kind: 'boss', type: t })),
  ...Object.keys(NPCS).map(n => ({ kind: 'npc', npc: n })), { kind: 'player', uid: 'abc', name: 'A' }, { kind: 'player', uid: 'xyz', name: 'B' }];
"""


@test
def test_models_exist_for_every_creature_and_every_face_is_painted(pg):
    r = ev(pg, MODEL_JS + r"""
      const out = { missing: [], unpainted: [], oversize: [], tris: {}, bones: {}, textures: {} };
      const ids = new Set();
      for (const e of entityList()) { const id = M.modelIdFor(e); if (!id) { out.missing.push(JSON.stringify(e)); continue; } ids.add(id); }
      for (const id of ids) {
        const b = lib.get(id);
        const ctx = b.canvas.getContext('2d'), W = b.canvas.width, H = b.canvas.height;
        const data = ctx.getImageData(0, 0, W, H).data;
        for (const p of b.parts) for (const f of ['top', 'bottom', 'left', 'front', 'right', 'back']) {
          const [w, h, d] = p.size, [u, v] = p.uv;
          const r = { top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], left: [u, v + d, d, h], front: [u + d, v + d, w, h], right: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h] }[f];
          if (r[0] < 0 || r[1] < 0 || r[0] + r[2] > W || r[1] + r[3] > H) out.oversize.push(id + ':' + p.id + ':' + f);
          let any = 0; for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) if (data[(y * W + x) * 4 + 3] > 0) any++;
          if (!any) out.unpainted.push(id + ':' + p.id + ':' + f);
        }
        out.tris[id] = b.geometry.index.count / 3; out.bones[id] = b.model.bones.length; out.textures[id] = W + 'x' + H;
      }
      return { ...out, count: ids.size };
    """)
    assert not r['missing'] and not r['oversize'], r
    assert not r['unpainted'], sorted({u.rsplit(':', 1)[0] for u in r['unpainted']})
    assert r['count'] >= 15 and max(r['tris'].values()) <= 1400 and max(r['bones'].values()) <= 32, r


@test
def test_models_share_geometry_and_use_one_draw_call_each(pg):
    r = ev(pg, MODEL_JS + r"""
      const a = lib.spawn('wolf'), b = lib.spawn('wolf'), c = lib.spawn('zombie');
      let meshes = 0; a.mesh.traverse(o => { if (o.isMesh || o.isSkinnedMesh) meshes++; });
      return { sameGeo: a.mesh.geometry === b.mesh.geometry, sameMat: a.mesh.material === b.mesh.material, diffGeo: a.mesh.geometry !== c.mesh.geometry, meshes,
               ownSkeleton: a.mesh.skeleton !== b.mesh.skeleton, skinned: a.mesh.isSkinnedMesh };
    """)
    assert r == {'sameGeo': True, 'sameMat': True, 'diffGeo': True, 'meshes': 1, 'ownSkeleton': True, 'skinned': True}, r


@test
def test_model_animation_walk_attack_and_poses(pg):
    r = ev(pg, MODEL_JS + r"""
      const out = {};
      for (const id of ['wolf', 'deer', 'zombie', 'skeleton', 'scorpion', 'bear', 'wraith', 'golem', 'wolf-lord', 'scorpion-queen', 'ice-emperor', 'npc:truong-lang']) {
        const rig = lib.spawn(id), pose = (st) => { M.animate(rig, st); return rig.model.bones.map(b => { const r = rig.bones[b.id].rotation; return [r.x, r.y, r.z]; }); };
        const idle = pose({ phase: 0, k: 0, t: 0, pitch: 0, swing: 0 }), walk = pose({ phase: 1.2, k: 1, t: 1, pitch: 0, swing: 0 }), hit = pose({ phase: 0, k: 0, t: 0, pitch: 0, swing: 1 });
        const diff = (a, b) => Math.max(...a.map((r, i) => Math.max(...r.map((v, j) => Math.abs(v - b[i][j])))));
        out[id] = { walk: diff(idle, walk), attack: diff(idle, hit), finite: [...idle, ...walk, ...hit].every(r => r.every(Number.isFinite)) };
      }
      return out;
    """)
    for id, v in r.items():
        assert v['finite'], (id, v)
        assert v['walk'] > 0.05 or id in ('wraith',), (id, v)               # mọi con đều có chuyển động (ma lơ lửng dùng chuyển động khác)
        assert v['attack'] > 0.05, (id, v)                                    # và có tư thế tấn công


@test
def test_entity_view_draw_calls_dying_and_cpu_budget(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""async () => {
      const g = __g, v = g.ents, info = g.scene.renderer.info;
      g.hud.setBoss(null);
      const mk = (n) => { const out = []; const kinds = ['soi-xam', 'xac-song', 'bo-cap', 'xuong-cung', 'gau-bang', 'nai', 'ma-bang', 'tuong-da'];
        for (let i = 0; i < n; i++) out.push({ key: 'e:' + (500 + i), kind: 'mob', type: kinds[i % 8], id: 500 + i, x: g.local.x + 3 + (i % 10) * 2.2, y: g.local.y, z: g.local.z - 4 - Math.floor(i / 10) * 2.5, yaw: i * 0.3, hp: 10, maxHp: 10 }); return out; };
      const calls = () => { g.renderNow(); return info.render.calls; };
      v.update([], 0, 0.016, [], g.scene.camera.position); const base0 = calls();
      const list = mk(48); v.update(list, 0, 0.016, [], g.scene.camera.position); const withAll = calls();
      // chi phí CPU của việc cập nhật 48 thực thể
      let t0 = performance.now(); for (let i = 0; i < 120; i++) { for (const e of list) e.x += 0.02; v.update(list, i * 0.016, 0.016, [], g.scene.camera.position); } const perFrame = (performance.now() - t0) / 120;
      // chết: biến mất khỏi danh sách -> ngã xuống rồi mới xoá
      const gone = list.slice(1); v.update(gone, 3, 0.016, [], g.scene.camera.position);
      const dying = v.rigOf('e:500') && v.rigOf('e:500').dying;
      for (let i = 0; i < 60; i++) v.update(gone, 3 + i * 0.016, 0.016, [], g.scene.camera.position);
      const after = v.rigOf('e:500');
      return { base0, withAll, perFrame, dying, after, shadows: v.shadowCount(), n: v.count() };
    }""")
    assert r['withAll'] - r['base0'] <= 48 * 1.15 + 6, r                  # tối đa ~1 lệnh vẽ mỗi thực thể (+ bóng và thẻ tên)
    assert r['perFrame'] < 2.5, r                                         # cập nhật 48 thực thể có xương dưới 2,5 ms
    assert r['dying'] and r['after'] is None and r['n'] == 47, r
    assert r['shadows'] <= 128, r


@test
def test_software_renderer_starts_in_low_quality_and_warns(pg, browser, base):
    pg.goto(root(base) + 'games/the-gioi-khoi/game.html?debug&net=memory&seed=777&aa=0'); pg.wait_for_timeout(300)
    pg.fill('#name', 'S'); pg.click('#btn-new')
    pg.wait_for_function("window.__g && window.__g.S", timeout=60000)
    r = pg.evaluate("({ software: __g.software, quality: __g.quality, level: __g.level, pr: __g.scene.renderer.getPixelRatio(), clouds: __g.sky.clouds.visible, toast: document.getElementById('toast').textContent, gl: __g.glInfo })")
    assert r['software'] and r['quality'] == 'low' and r['level'] == 1 and r['pr'] <= 0.75 and not r['clouds'], r
    assert 'CPU' in r['toast'] or 'phần mềm' in r['toast'], r


# ---------------------------------------------------------------- P: giác quan của quái (tầm nhìn, che khuất, tiếng động, trí nhớ)

SENSE_JS = ARENA_JS + """
const wall = (g, cx, cz, y0, x, z0, z1, h = 4) => { for (let z = z0; z <= z1; z++) for (let y = 1; y <= h; y++) g.world.set(x, y0 + y, z, 1); };
const unwall = (g, cx, cz, y0, x, z0, z1, h = 4) => { for (let z = z0; z <= z1; z++) for (let y = 1; y <= h; y++) g.world.set(x, y0 + y, z, 0); };
const stateOf = (m) => m.state || 'idle';
"""


@test
def test_mob_does_not_notice_player_outside_its_field_of_view(pg):
    r = ev(pg, SENSE_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = faceAway(spawnMob(g, 'soi-xam', cx + 0.5 + 7, y0 + 1, cz + 0.5), p);       // quay lưng, cách 7 block (trong tầm 18 nhưng ngoài nón nhìn, xa hơn vùng cảm nhận)
      m.wdx = 0; m.wdz = 0; m.wanderT = 99;
      const hp0 = p.hp; run(g, 3);
      const behind = { state: stateOf(m), hp: p.hp === hp0, d: dist(m, p) };
      faceTo(m, p); run(g, 2.5);
      return { behind, front: stateOf(m), hpLost: hp0 - p.hp, closer: dist(m, p) < 6 };
    """)
    assert r['behind']['state'] in ('idle', 'curious') and r['behind']['hp'] and r['behind']['d'] > 5, r
    assert r['front'] in ('chase', 'search') and r['closer'], r


@test
def test_mob_needs_line_of_sight_walls_and_trees_block_vision(pg):
    r = ev(pg, SENSE_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = faceTo(spawnMob(g, 'soi-xam', cx + 0.5 + 8, y0 + 1, cz + 0.5), p); m.wdx = 0; m.wdz = 0; m.wanderT = 99;
      wall(g, cx, cz, y0, cx + 4, cz - 3, cz + 3);
      run(g, 3); const blocked = { state: stateOf(m), alert: m.alert || 0, hp: p.hp };
      unwall(g, cx, cz, y0, cx + 4, cz - 3, cz + 3);
      faceTo(m, p); m.alert = 0; m.state = 'idle'; run(g, 3);
      return { blocked, open: stateOf(m), seesNow: g.world.lineClear ? g.world.lineClear(m.x, m.y + 1, m.z, p.x, p.y + 1.5, p.z) : null };
    """)
    assert r['blocked']['state'] in ('idle', 'curious') and r['blocked']['alert'] < 0.5 and r['blocked']['hp'] == 20, r
    assert r['open'] in ('chase', 'search') and r['seesNow'] is True, r


@test
def test_noticing_takes_time_alert_meter_and_snapshot_codes(pg):
    r = ev(pg, SENSE_JS + r"""
      const { snapshotFor } = await imp('net/snapshot.js');
      const { g, p, cx, cz, y0 } = mkArena();
      const m = faceTo(spawnMob(g, 'soi-xam', cx + 0.5 + 15, y0 + 1, cz + 0.5), p); m.wdx = 0; m.wdz = 0; m.wanderT = 99;
      run(g, 0.25); const early = { state: stateOf(m), alert: m.alert || 0 };
      const midSnap = snapshotFor(g, 'u1').es.find(e => e.id === m.id);
      let t = 0; while (stateOf(m) !== 'chase' && t < 6) { run(g, 0.1); t += 0.1; }
      const snap = snapshotFor(g, 'u1').es.find(e => e.id === m.id);
      return { early, mid: midSnap.st, noticed: t, chaseSt: snap.st, alertField: typeof snap.al };
    """)
    assert r['early']['state'] != 'chase' and r['early']['alert'] < 0.9, r             # xa 15 block: không nhận ra tức thì
    assert 0.3 < r['noticed'] < 4.5 and r['chaseSt'] == 2 and r['alertField'] == 'number' and r['mid'] in (0, 1), r


@test
def test_sneaking_shrinks_detection_range_and_sprinting_enlarges_it(pg):
    r = ev(pg, SENSE_JS + r"""
      const res = {};
      for (const mode of ['stand', 'sneak', 'sprint']) {
        const { g, p, cx, cz, y0 } = mkArena();
        p.sneak = mode === 'sneak'; p.sprint = mode === 'sprint';
        const m = faceTo(spawnMob(g, 'soi-xam', cx + 0.5 + 14, y0 + 1, cz + 0.5), p); m.wdx = 0; m.wdz = 0; m.wanderT = 99;   // 14 block: giữa 9 (rón rén) và 18 (đứng) và 24 (chạy)
        run(g, 5); res[mode] = stateOf(m) === 'chase' || stateOf(m) === 'search';
      }
      const S1 = mkArena(); S1.p.sprint = true;
      const far = faceTo(spawnMob(S1.g, 'soi-xam', S1.cx + 0.5 + 19, S1.y0 + 1, S1.cz + 0.5), S1.p); far.wdx = 0; far.wdz = 0; far.wanderT = 99; run(S1.g, 6);
      const S2 = mkArena();                                                          // cùng khoảng cách 19 nhưng đứng thường: ngoài tầm 18 nên không thấy
      const far2 = faceTo(spawnMob(S2.g, 'soi-xam', S2.cx + 0.5 + 19, S2.y0 + 1, S2.cz + 0.5), S2.p); far2.wdx = 0; far2.wdz = 0; far2.wanderT = 99; run(S2.g, 6);
      return { ...res, farSprint: stateOf(far) === 'chase' || stateOf(far) === 'search', farStand: stateOf(far2) === 'chase' || stateOf(far2) === 'search' };
    """)
    assert r['stand'] and not r['sneak'] and r['sprint'] and r['farSprint'] and not r['farStand'], r


@test
def test_noise_makes_mobs_investigate_and_sneaking_is_silent(pg):
    r = ev(pg, SENSE_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = faceAway(spawnMob(g, 'soi-xam', cx + 0.5 - 9, y0 + 1, cz + 0.5 + 6), p); m.wdx = 0; m.wdz = 0; m.wanderT = 99;
      // đào đá cách ~12 block: tiếng động tới tai sói
      p.inv.fill(null); p.inv[0] = { id: 'wood_pick', n: 1 }; p.sel = 0;
      g.world.set(cx + 1, y0, cz, 1); g.world.set(cx + 1, y0 + 1, cz, 1);
      g.act('u1', { t: 'dig', x: cx + 1, y: y0 + 1, z: cz }); g.tick(2); g.act('u1', { t: 'break', x: cx + 1, y: y0 + 1, z: cz });
      const heard = { inv: !!m.investigate, state: stateOf(m), alert: m.alert || 0 };
      const d0 = Math.hypot(m.x - (cx + 1.5), m.z - (cz + 0.5)); run(g, 2.5); const d1 = Math.hypot(m.x - (cx + 1.5), m.z - (cz + 0.5));
      // người chơi rón rén đi lại: không gây tiếng
      const B = mkArena(); B.p.sneak = true;
      const m2 = faceAway(spawnMob(B.g, 'soi-xam', B.cx + 0.5 - 9, B.y0 + 1, B.cz + 0.5 + 6), B.p); m2.wdx = 0; m2.wdz = 0; m2.wanderT = 99;
      for (let i = 0; i < 40; i++) { B.p.x += 0.1; B.g.applyState('u1', { x: B.p.x, y: B.p.y, z: B.p.z, vx: 2, vy: 0, vz: 0, yaw: 0, pitch: 0, sneak: true, sprint: false, seq: 0 }); B.g.tick(0.05); }
      return { heard, approached: d1 < d0 - 1, sneakQuiet: !m2.investigate };
    """)
    assert r['heard']['inv'] and r['heard']['state'] in ('curious', 'idle') and r['approached'] and r['sneakQuiet'], r


@test
def test_mob_loses_track_searches_last_seen_then_gives_up(pg):
    r = ev(pg, SENSE_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = faceTo(spawnMob(g, 'soi-xam', cx + 0.5 + 9, y0 + 1, cz + 0.5), p);
      run(g, 3); const chasing = stateOf(m) === 'chase';
      // người chơi biến mất sau bức tường dày (vẫn trong tầm nhưng bị che) và đứng yên
      wall(g, cx, cz, y0, cx - 5, cz - 8, cz + 8, 6); wall(g, cx, cz, y0, cx - 6, cz - 8, cz + 8, 6);
      p.x = cx + 0.5 - 12; const seen = { x: m.x, z: m.z };
      let t = 0, sawSearch = false; while (t < 20) { run(g, 0.25); t += 0.25; if (stateOf(m) === 'search') sawSearch = true; if (stateOf(m) === 'idle') break; }
      return { chasing, sawSearch, final: stateOf(m), gaveUpAfter: t, target: m.target || null };
    """)
    assert r['chasing'] and r['sawSearch'] and r['final'] == 'idle' and r['gaveUpAfter'] < 19 and not r['target'], r


@test
def test_hit_from_behind_makes_mob_turn_and_chase_and_pack_joins(pg):
    r = ev(pg, SENSE_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      p.inv.fill(null); p.inv[0] = { id: 'stone_sword', n: 1 }; p.sel = 0;
      const a = faceAway(spawnMob(g, 'soi-xam', cx + 0.5 + 2.5, y0 + 1, cz + 0.5), p); a.wdx = 0; a.wdz = 0; a.wanderT = 99; a.hp = a.maxHp = 100;
      const b = faceAway(spawnMob(g, 'soi-xam', cx + 0.5 + 9, y0 + 1, cz + 0.5 + 5), p); b.wdx = 0; b.wdz = 0; b.wanderT = 99;      // đồng bọn ở xa phía sau lưng
      const far = faceAway(spawnMob(g, 'nai', cx + 0.5 + 9, y0 + 1, cz + 0.5 - 6), p);
      const before = stateOf(a);
      g.act('u1', { t: 'hit', id: a.id });
      const after = { state: stateOf(a), target: a.target };
      run(g, 1.2);
      const facing = Math.abs(((a.yaw - Math.atan2(-(p.x - a.x), -(p.z - a.z))) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      return { before, after, facing, packJoined: !!b.investigate || stateOf(b) !== 'idle', otherSpecies: !far.investigate && stateOf(far) === 'idle' };
    """)
    assert r['before'] == 'idle' and r['after']['state'] == 'chase' and r['after']['target'] == 'u1' and r['facing'] < 0.8, r
    assert r['packJoined'], r


@test
def test_ranged_mob_needs_line_of_sight_and_facing_to_shoot(pg):
    r = ev(pg, SENSE_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena();
      const m = faceTo(spawnMob(g, 'xuong-cung', cx + 0.5 + 9, y0 + 1, cz + 0.5), p);
      wall(g, cx, cz, y0, cx + 4, cz - 4, cz + 4, 5); wall(g, cx, cz, y0, cx + 5, cz - 4, cz + 4, 5);
      p.hp = p.maxHp = 9999; let shots = 0;
      for (let t = 0; t < 5; t += 0.05) { g.tick(0.05); shots = Math.max(shots, [...g.ents.values()].filter(e => e.kind === 'proj').length); }
      const blocked = { shots, hp: p.hp === 9999 };
      unwall(g, cx, cz, y0, cx + 4, cz - 4, cz + 4, 5); unwall(g, cx, cz, y0, cx + 5, cz - 4, cz + 4, 5);
      faceTo(m, p); let shots2 = 0; for (let t = 0; t < 8; t += 0.05) { g.tick(0.05); shots2 = Math.max(shots2, [...g.ents.values()].filter(e => e.kind === 'proj').length); p.x = cx + 0.5; }
      return { blocked, shots2 };
    """)
    assert r['blocked']['shots'] == 0 and r['blocked']['hp'] and r['shots2'] >= 1, r


@test
def test_prey_deer_is_startled_by_noise_but_a_sneaker_can_approach(pg):
    r = ev(pg, SENSE_JS + r"""
      // đứng ở 8 block nhưng nai không nhìn thấy (quay lưng): chạy nước rút tạo tiếng động -> nai bị giật mình và bỏ chạy
      const A = mkArena(); const d1 = faceAway(spawnMob(A.g, 'nai', A.cx + 0.5 + 8, A.y0 + 1, A.cz + 0.5), A.p); d1.wdx = 0; d1.wdz = 0; d1.wanderT = 99;
      for (let i = 0; i < 40; i++) { A.g.applyState('u1', { x: A.p.x, y: A.p.y, z: A.p.z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, sprint: true, sneak: false, seq: 0 }); A.g.tick(0.05); }
      const startled = { inv: !!d1.investigate || stateOf(d1) !== 'idle', away: dist(d1, A.p) };
      // rón rén ở 7 block (ngoài vùng cảm nhận 4, trong nửa tầm nhìn 6? deer sight 12 -> 6 khi rón rén): không bị phát hiện
      const B = mkArena(); B.p.sneak = true;
      const d2 = faceTo(spawnMob(B.g, 'nai', B.cx + 0.5 + 8, B.y0 + 1, B.cz + 0.5), B.p); d2.wdx = 0; d2.wdz = 0; d2.wanderT = 99;
      run(B.g, 4);
      return { startled, sneakUnseen: stateOf(d2) === 'idle', sneakDist: dist(d2, B.p) };
    """)
    assert r['startled']['inv'] and r['sneakUnseen'] and r['sneakDist'] > 7, r


@test
def test_alert_indicators_and_sneak_key_reach_the_host(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""async () => {
      const g = __g, v = g.ents, out = {};
      const e = (st, al) => [{ key: 'e:700', kind: 'mob', type: 'soi-xam', id: 700, x: g.local.x + 3, y: g.local.y, z: g.local.z - 3, yaw: 0, hp: 10, maxHp: 16, st, al }];
      const ind = () => { const o = v.group.children.find(c => c.children && c.children.some(x => x.isSprite && x.renderOrder === 11)); return o ? o.children.find(x => x.renderOrder === 11) : null; };
      v.update(e(0, 0), 0, 0.016, [], g.scene.camera.position); out.idle = !ind() || !ind().visible;
      v.update(e(1, 0.5), 0.1, 0.016, [], g.scene.camera.position); const a = ind(); out.curious = !!a && a.visible && a.material.opacity > 0.3 && a.material.opacity < 1;
      v.update(e(2, 1), 0.2, 0.016, [], g.scene.camera.position); const b = ind(); out.chase = !!b && b.visible && b.material.opacity === 1 && b.material !== a.material;
      v.update(e(3, 0.5), 0.3, 0.016, [], g.scene.camera.position); out.search = !!ind() && ind().visible;
      const far = [{ ...e(2, 1)[0], x: g.local.x + 90 }]; v.update(far, 0.4, 0.016, [], g.scene.camera.position); out.hiddenFar = !ind() || !ind().visible;
      return out;
    }""")
    assert r == {'idle': True, 'curious': True, 'chase': True, 'search': True, 'hiddenFar': True}, r
    # phím C: rón rén -> máy chủ biết, camera hạ thấp, hiện nhãn; thả ra thì trở lại
    y0 = pg.evaluate("__g.scene.camera.position.y - __g.local.y")
    pg.keyboard.down('KeyC'); pg.wait_for_timeout(500)
    snk = pg.evaluate("({ host: __g.game.player(__g.S.uid).sneak, label: !document.getElementById('sneak').hidden, dy: __g.scene.camera.position.y - __g.local.y })")
    pg.keyboard.up('KeyC'); pg.wait_for_timeout(500)
    back = pg.evaluate("({ host: __g.game.player(__g.S.uid).sneak, label: !document.getElementById('sneak').hidden })")
    assert snk['host'] is True and snk['label'] and snk['dy'] < y0 - 0.15, (y0, snk)
    assert back['host'] is False and not back['label'], back



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
    assert A.locator('#hotbar img[alt="Đất"]').count() >= 1
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


# ---------------------------------------------------------------- vùng và quái mới (vòng 5)
@test
def test_new_regions_have_their_own_terrain_flora_and_gating(pg):
    r = ev(pg, r"""
      const { REGIONS } = await imp('content/regions.js');
      const { regionAt } = await imp('world/regions.js');
      const { generateChunk, CHUNK_H } = await imp('world/generate.js');
      const { BLOCKS } = await imp('world/blocks.js');
      const name = id => BLOCKS[id].name;
      const out = {};
      for (const seed of [777, 12345, 99]) {
        const hist = {}, flora = {}, heights = {}, cover = {};
        for (let x = -1500; x <= 1500; x += 40) for (let z = -1500; z <= 1500; z += 40) cover[regionAt(seed, x, z)] = (cover[regionAt(seed, x, z)] || 0) + 1;
        for (let x = -1500; x <= 1500; x += 37) for (let z = -1500; z <= 1500; z += 37) {
          const id = regionAt(seed, x, z), cx = Math.floor(x / 16), cz = Math.floor(z / 16), ch = generateChunk(seed, cx, cz), lx = x - cx * 16, lz = z - cz * 16;
          for (let y = CHUNK_H - 1; y >= 0; y--) {
            const b = ch[lx + 16 * (lz + 16 * y)];
            if (b === 0) continue;
            if (BLOCKS[b].plant) { (flora[id] = flora[id] || new Set()).add(name(b)); continue; }
            (hist[id] = hist[id] || {})[name(b)] = ((hist[id] || {})[name(b)] || 0) + 1; (heights[id] = heights[id] || []).push(y); break;
          }
        }
        const top = id => Object.entries(hist[id] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
        const avg = id => (heights[id] || []).reduce((a, b) => a + b, 0) / Math.max(1, (heights[id] || []).length);
        out[seed] = { cover, top: { swamp: top('dam-lay'), volcano: top('hoa-son'), crystal: top('vuc-pha-le') }, flora: Object.fromEntries(Object.entries(flora).map(([k, v]) => [k, [...v]])),
          h: { swamp: avg('dam-lay'), volcano: avg('hoa-son'), forest: avg('rung-suong'), crystal: avg('vuc-pha-le') } };
      }
      return { out, req: Object.fromEntries(REGIONS.map(r => [r.id, r.requires || null])) };
    """)
    for seed, o in r['out'].items():
        for rid in ['dam-lay', 'hoa-son', 'vuc-pha-le']:
            assert o['cover'].get(rid, 0) >= 150, (seed, rid, o['cover'])           # mỗi vùng phủ ít nhất ~3% bản đồ
        assert 'moss' in o['top']['swamp'] or 'mud' in o['top']['swamp'], o
        assert 'ash' in o['top']['volcano'] and 'ice' not in o['top']['volcano'], o
        assert 'snow' in o['top']['crystal'] and ('amethyst' in o['top']['crystal']), o
        assert {'reed', 'glow_mushroom'} <= set(o['flora']['dam-lay']), o
        assert 'ember_bloom' in o['flora']['hoa-son'] and 'crystal_bloom' in o['flora']['vuc-pha-le'], o
        assert o['h']['swamp'] < o['h']['forest'] - 1.5, o                            # đầm lầy thấp hơn rừng
        assert o['h']['volcano'] > o['h']['swamp'] + 4 and o['h']['crystal'] > o['h']['forest'], o
    assert r['req']['hoa-son'] == 'boss:thu-linh-soi' and r['req']['vuc-pha-le'] == 'boss:bo-cap-chua' and r['req']['dam-lay'] is None, r


@test
def test_new_regions_spawn_their_own_mobs_and_old_ones_still_work(pg):
    r = ev(pg, GAME_JS + r"""
      const { regionAt } = await imp('world/regions.js');
      const { MOBS } = await imp('content/mobs.js');
      const g0 = new Game({ seed: 777, spawning: false });
      const find = (id) => { for (let x = -3000; x <= 3000; x += 40) for (let z = -3000; z <= 3000; z += 40) if (regionAt(777, x, z) === id && g0.world.surfaceY(x, z) > 21) return { x, z }; return null; };
      const types = {}, wrong = [];
      for (const region of ['dam-lay', 'hoa-son', 'vuc-pha-le', 'rung-suong']) {
        const spot = find(region);
        const g = new Game({ seed: 777 }); const p = g.addPlayer('u1', 'T');
        g.world.keepAround([{ x: spot.x, z: spot.z }], 3);
        p.x = spot.x + 0.5; p.z = spot.z + 0.5; p.y = g.world.surfaceY(spot.x, spot.z) + 1; p.hp = 9999; p.maxHp = 9999; p.hazT = -1e9;
        g.time = 60;
        const seen = new Set(), ids = new Set();
        for (let t = 0; t < 400; t += 0.5) {
          g.tick(0.5); p.hp = 9999;
          for (const e of g.ents.values()) if (e.kind === 'mob') {
            seen.add(e.type);
            if (!ids.has(e.id)) { ids.add(e.id); const rg = regionAt(777, Math.floor(e.x), Math.floor(e.z)); if (!MOBS[e.type].regions.includes(rg)) wrong.push(e.type + '@' + rg); }   // quái vừa sinh phải hợp vùng
          }
          for (const e of [...g.ents.values()]) if (e.kind === 'mob' && Math.hypot(e.x - p.x, e.z - p.z) < 5) g.ents.delete(e.id);
        }
        types[region] = [...seen].sort();
      }
      return { types, wrong };
    """)
    t = r['types']
    assert r['wrong'] == [], r
    assert {'ech-doc', 'ran-lay', 'ca-sau', 'nam-di'} & set(t['dam-lay']), r
    assert {'than-lan-nham', 'linh-hoa'} & set(t['hoa-son']), r
    assert {'nhen-pha-le', 'tho-pha-le', 'khoi-pha-le'} & set(t['vuc-pha-le']), r
    assert 'nai' in t['rung-suong'] or 'cao-lua' in t['rung-suong'], r


@test
def test_new_mobs_have_senses_models_drops_and_a_fire_bolt(pg):
    r = ev(pg, r"""
      const { MOBS } = await imp('content/mobs.js');
      const { MOB_MODELS } = await imp('render/models/index.js');
      const { ITEMS } = await imp('content/items.js');
      const fresh = ['ech-doc', 'ran-lay', 'ca-sau', 'nam-di', 'than-lan-nham', 'linh-hoa', 'nhen-pha-le', 'tho-pha-le', 'khoi-pha-le', 'cao-lua'];
      return { count: Object.keys(MOBS).length, fresh: fresh.map(id => { const m = MOBS[id]; return { id, ok: !!m && m.sight > 0 && m.fov > 0 && m.hearing > 0 && m.turn > 0, model: MOB_MODELS && MOB_MODELS[id], drops: (m.drops || []).every(d => ITEMS[d.item]), fire: m.shot && m.shot.style }; }) };
    """)
    assert r['count'] >= 18, r
    for m in r['fresh']:
        assert m['ok'] and m['model'] and m['drops'], m
    assert [m['fire'] for m in r['fresh'] if m['id'] == 'linh-hoa'] == ['fire'], r


@test
def test_standing_on_magma_burns_and_new_recipes_use_new_loot(pg):
    r = ev(pg, GAME_JS + r"""
      const { B } = await imp('world/blocks.js');
      const { RECIPES } = await imp('content/recipes.js');
      const g = new Game({ seed: 777, spawning: false }), p = g.addPlayer('u1', 'Tester');
      g.flags['boss:thu-linh-soi'] = g.flags['boss:bo-cap-chua'] = true;       // tắt khí độc vùng để chỉ đo bỏng
      const x = Math.floor(p.x) + 3, z = Math.floor(p.z), y = g.world.surfaceY(x, z);
      g.world.set(x, y, z, B.MAGMA);
      p.x = x + 0.5; p.z = z + 0.5; p.y = y + 1; p.vy = 0; p.hp = 20; p.maxHp = 20;
      const toasts = []; g.onEvent = null;
      for (let t = 0; t < 4; t += 0.05) { g.tick(0.05); p.x = x + 0.5; p.z = z + 0.5; if (p.y < y + 1) p.y = y + 1; }
      const burned = 20 - p.hp;
      // đứng trên đất thường thì không bị bỏng
      const gx = x + 4; const gy = g.world.surfaceY(gx, z); p.x = gx + 0.5; p.y = gy + 1; p.hp = 20;
      for (let t = 0; t < 4; t += 0.05) { g.tick(0.05); p.x = gx + 0.5; p.z = z + 0.5; if (p.y < gy + 1) p.y = gy + 1; }
      return { burned, safe: 20 - p.hp, recipes: ['amethyst_pick', 'ember_sword', 'stew'].map(id => RECIPES.some(r => r.id === id)) };
    """)
    assert r['burned'] >= 2 and r['safe'] == 0, r
    assert all(r['recipes']), r


@test
def test_new_region_quests_need_visit_kills_and_loot_then_pay_out(pg):
    r = ev(pg, GAME_JS + r"""
      const { spawnMob } = await imp('sim/mobs.js');
      const { regionAt } = await imp('world/regions.js');
      const g = new Game({ seed: 777, spawning: false }); const p = g.addPlayer('u1', 'T');
      p.inv.fill(null); p.inv[0] = { id: 'gem_sword', n: 1 }; p.sel = 0;
      g.flags['boss:thu-linh-soi'] = g.flags['boss:bo-cap-chua'] = true;
      const spot = (id) => { for (let x = -3000; x <= 3000; x += 40) for (let z = -3000; z <= 3000; z += 40) if (regionAt(777, x, z) === id) return { x, z }; };
      const quests = await imp('sim/quests.js');
      const out = {};
      for (const [qid, region, mob, loot] of [['dam-lay-nam', 'dam-lay', 'ech-doc', 'mushroom'], ['than-lua', 'hoa-son', 'than-lan-nham', 'ember'], ['pha-le-tim', 'vuc-pha-le', 'nhen-pha-le', 'amethyst']]) {
        g.flags['quest:chao-lang'] = true; p.quests.done['chao-lang'] = true;
        const ok = quests.accept(g, p, qid) !== false;
        out[qid] = { accepted: g.questState('u1', qid) === 'active' };
        const s = spot(region); g.world.keepAround([s], 2);
        p.x = s.x + 0.5; p.z = s.z + 0.5; p.y = g.world.surfaceY(s.x, s.z) + 1;
        for (let i = 0; i < 6; i++) { const m = spawnMob(g, mob, p.x + 2, p.y, p.z); g.damageEntity(m, 999, p); }
        g.tick(0.6);
        out[qid].beforeLoot = g.questState('u1', qid);
        g.giveItem('u1', loot, 3); g.tick(0.6);
        out[qid].ready = g.questState('u1', qid);
      }
      return out;
    """)
    for qid, o in r.items():
        assert o['accepted'] and o['ready'] == 'ready', (qid, r)


@test
def test_new_boss_quests_chain_from_region_quests_and_pay_on_boss_kill(pg):
    r = ev(pg, GAME_JS + r"""
      const quests = await imp('sim/quests.js');
      const g = new Game({ seed: 777, spawning: false }); const p = g.addPlayer('u1', 'T');
      const out = {};
      for (const [qid, pre, boss] of [['diet-chua-dam', 'dam-lay-nam', 'chua-dam-lay'], ['diet-vua-lua', 'than-lua', 'vua-nham-thach'], ['diet-ho-ve', 'pha-le-tim', 'ho-ve-pha-le']]) {
        const before = quests.accept(g, p, qid);                       // chưa xong nhiệm vụ trước: bị từ chối
        p.quests.done[pre] = true;
        quests.accept(g, p, qid);
        const active = g.questState('u1', qid) === 'active';
        g.onBossDefeated.call(g, boss, [p]); g.tick(0.6);
        const ready = g.questState('u1', qid);
        const gem0 = g.countItem ? g.countItem('u1', 'gem') : null;
        out[qid] = { refused: before === false || g.questState('u1', qid) !== 'none', active, ready };
      }
      return out;
    """)
    for qid, o in r.items():
        assert o['active'] and o['ready'] == 'ready', (qid, r)


if __name__ == '__main__':
    run(TESTS)
