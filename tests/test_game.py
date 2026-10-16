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
    pg.goto(root(base) + 'games/the-gioi-khoi/game.html?debug&seed=777&r=4'); pg.wait_for_timeout(300)
    pg.wait_for_function("window.pending === 0", timeout=20000)
    pg.click('#btn-solo'); pg.evaluate("renderNow()")
    r = pg.evaluate("""() => {
      const src = scene.renderer.domElement, c = document.createElement('canvas'); c.width = 200; c.height = 112;
      const ctx = c.getContext('2d'); scene.render(); ctx.drawImage(src, 0, 0, 200, 112);
      const d = ctx.getImageData(0, 0, 200, 112).data, colors = new Set(); let nonBg = 0;
      for (let i = 0; i < d.length; i += 4) { colors.add((d[i] >> 4) + ',' + (d[i+1] >> 4) + ',' + (d[i+2] >> 4)); }
      const bg = [d[0], d[1], d[2]];
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i]-bg[0]) + Math.abs(d[i+1]-bg[1]) + Math.abs(d[i+2]-bg[2]) > 30) nonBg++;
      return { colors: colors.size, nonBg: nonBg / (d.length / 4), chunks: scene.chunkCount(), calls: scene.renderer.info.render.calls, tris: scene.renderer.info.render.triangles };
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


if __name__ == '__main__':
    run(TESTS)
