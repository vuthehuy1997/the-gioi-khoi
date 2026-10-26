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
const mkGame = (seed = 777) => { const g = new Game({ seed, hunger: false }); const p = g.addPlayer('u1', 'Tester'); return { g, p }; };
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
  const g = new Game({ seed: 777, spawning: false, env: false, hunger: false, ...opts }); const p = g.addPlayer('u1', 'T');
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
    assert {'nai', 'cao-lua', 'ga', 'cuu', 'lon'} & set(t['rung-suong-day']) and 'xac-song' not in t['rung-suong-day'], r          # thú hiền ban ngày (nai, cáo, và thú nuôi gà/cừu/lợn chia nhau trọng số)
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
      for (const id of ['chitin_helm', 'chitin_chest']) { g.giveItem('u1', id, 1); g.act('u1', { t: 'equip', i: p.inv.findIndex(s => s && s.id === id) }); }   // hết khí độc, còn cái nóng của sa mạc: có đồ chống nóng thì không sao
      for (let t = 0; t < 10; t += 0.05) { g.tick(0.05); p.y = g.world.surfaceY(spot.x, spot.z) + 1; }
      return { hurt, toasts, after: p.hp };
    """)
    assert r['hurt'] < 20 and r['toasts'] >= 1 and r['after'] == 20, r


# ---------------------------------------------------------------- F: NPC, hội thoại, cửa hàng, nhiệm vụ

NPC_JS = GAME_JS + """
const { NPCS } = await imp('content/npcs.js');
const mkTown = () => {
  const g = new Game({ seed: 777, spawning: false, hunger: false }); const p = g.addPlayer('u1', 'T'); g.buildStructures();
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
    assert r['count'] >= 3 and set(r['ids']) == {'truong-lang', 'tho-ren', 'thuong-nhan', 'an-si', 'ngu-dan', 'tho-lua', 'hoc-gia'} and r['ok'], r
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
      clone.mobs['ga'].breed.food = 'khong-co-hat';
      clone.crops.wheat.yield.push({ item: 'khong-co-nong-san', min: 1, max: 1 });
      delete clone.mobs['lon'].breed;
      clone.items['carrot'].fx = { id: 'khong-hieu-ung', secs: 5 };
      const errors = validateContent(clone);
      return { errors };
    """)
    joined = ' | '.join(r['errors'])
    for needle in ['khong-co', 'nut-ma', 'quai-ma', 'vat-pham-mo-coi', 'khong_co', 'khong-co-chieu', 'lore-khong-co', 'khong-co-hat', 'khong-co-nong-san', 'thiếu breed', 'khong-hieu-ung']:
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
    assert r['quest'] == 'active' and r['prog'] == 3 and r['npcs'] == 7 and r['v'] == 2 and r['pos'] and r['terrain'] and r['spawn'] and r['fresh'] == 20, r


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
  const game = new Game({ seed: 777, spawning: false, hunger: false, ...opts });
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
  ...Object.keys(NPCS).map(n => ({ kind: 'npc', npc: n })), { kind: 'player', uid: 'abc', name: 'A' }, { kind: 'player', uid: 'xyz', name: 'B' },
  { kind: 'mob', type: 'cuu', sh: 1 }];                                         // cừu đã cắt len: mô hình riêng
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
      const poses = []; let puffs = 0; v.onDeathCount = 0;
      for (let i = 0; i < 50; i++) { v.update(gone, 3 + i * 0.016, 0.016, [], g.scene.camera.position); const pz = v.deathPose('e:500'); if (pz) poses.push(pz); }
      for (let i = 0; i < 60; i++) v.update(gone, 3 + i * 0.016, 0.016, [], g.scene.camera.position);
      const after = v.rigOf('e:500');
      return { base0, withAll, perFrame, dying, poses, after, shadows: v.shadowCount(), n: v.count() };
    }""")
    assert r['withAll'] - r['base0'] <= 48 * 1.15 + 6, r                  # tối đa ~1 lệnh vẽ mỗi thực thể (+ bóng và thẻ tên)
    assert r['perFrame'] < 2.5, r                                         # cập nhật 48 thực thể có xương dưới 2,5 ms
    assert r['dying'] and r['after'] is None and r['n'] == 47, r
    ps = r['poses']; assert len(ps) > 20, r                              # hoạt hoạ chết: ngã nghiêng gần 90 độ rồi co lại
    assert max(abs(p['rz']) for p in ps) > 1.4 and min(p['scale'] for p in ps) < 0.5, ps[-1]
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
      const g = new Game({ seed: 777, spawning: false, env: false }), p = g.addPlayer('u1', 'Tester');
      g.flags['boss:thu-linh-soi'] = g.flags['boss:bo-cap-chua'] = true;       // tắt khí độc và nóng lạnh của vùng để chỉ đo bỏng
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


@test
def test_new_villages_sit_in_their_region_with_npc_lore_and_shop(pg):
    r = ev(pg, NPC_JS + r"""
      const { VILLAGES } = await imp('content/npcs.js');
      const T = mkTown(); const { g, p } = T; const out = {};
      for (const [vid, nid, region, sell, buy] of [['xom-lau', 'ngu-dan', 'dam-lay', 'stew', 'swamp_heart'], ['trai-lua', 'tho-lua', 'hoa-son', 'ember', 'magma_core'], ['to-pha-le', 'hoc-gia', 'vuc-pha-le', 'amethyst', 'guardian_prism']]) {
        const s = g.flags.sites.village[vid], n = T.npc(nid);
        const t = T.talk(nid); const hi = t.v.find(e => e.t === 'dialog');
        const sh = T.say(0).v.find(e => e.t === 'shop');
        g.giveItem('u1', 'xu', 500); g.giveItem('u1', buy, 1);
        const bought = g.act('u1', { t: 'buy', item: sell, n: 1 }).ok, sold = g.act('u1', { t: 'sell', item: buy, n: 1 }).ok;
        out[vid] = { region: g.world.regionAt(s.x, s.z), want: region, npcNear: !!n && Math.hypot(n.x - s.x, n.z - s.z) < 8, talk: t.r.ok && !!hi, shop: !!sh, bought, sold };
      }
      return out;
    """)
    for vid, o in r.items():
        assert o['region'] == o['want'] and o['npcNear'] and o['talk'] and o['shop'] and o['bought'] and o['sold'], (vid, o)


@test
def test_old_save_gets_new_arenas_and_villages_without_moving_old_ones(pg):
    r = ev(pg, GAME_JS + r"""
      const g = new Game({ seed: 777, spawning: false }); g.addPlayer('u1', 'T'); g.buildStructures();
      const old = JSON.parse(JSON.stringify(g.flags.sites));
      for (const k of ['chua-dam-lay', 'vua-nham-thach', 'ho-ve-pha-le']) delete g.flags.sites.arena[k];
      for (const k of ['xom-lau', 'trai-lua', 'to-pha-le']) delete g.flags.sites.village[k];
      const save = g.toSave ? g.toSave() : g.save();
      const g2 = Game.fromSave(JSON.parse(JSON.stringify(save)), { spawning: false });
      const s2 = g2.flags.sites;
      const same = ['thu-linh-soi', 'bo-cap-chua', 'bang-de'].every(k => JSON.stringify(s2.arena[k]) === JSON.stringify(old.arena[k])) && ['khoi-dau', 'oc-dao', 'tram-bang'].every(k => JSON.stringify(s2.village[k]) === JSON.stringify(old.village[k]));
      const npcs = [...g2.ents.values()].filter(e => e.kind === 'npc').map(e => e.npc).sort();
      return { same, arenas: Object.keys(s2.arena).length, villages: Object.keys(s2.village).length, npcs };
    """)
    assert r['same'] and r['arenas'] == 6 and r['villages'] == 6 and len(r['npcs']) == 7, r


@test
def test_new_npc_quests_chain_through_dialogue_and_pay_out(pg):
    r = ev(pg, NPC_JS + r"""
      const { spawnMob } = await imp('sim/mobs.js');
      const { QUESTS } = await imp('content/quests.js');
      const T = mkTown(); const { g, p } = T;
      p.inv.fill(null); p.inv[0] = { id: 'gem_sword', n: 1 }; p.sel = 0; p.hp = p.maxHp = 9999;
      const xu = () => p.inv.filter(Boolean).filter(s => s.id === 'xu').reduce((a, s) => a + s.n, 0);
      const pick = (v, prefix, name) => { const d = v.filter(e => e.t === 'dialog').pop(); const c = d && d.choices.find(c => c.text === prefix + ': ' + name + '.'); return c ? c.i : -2; };
      const plan = [['ngu-dan', 'ech-cho-ngu-dan', [['ran-lay', 2]], [['frog_leg', 5]]], ['ngu-dan', 'ca-sau-tham-lam', [['ca-sau', 2]], [['scale', 3]]],
                    ['tho-lua', 'than-cho-lo', [], [['ember', 6]]], ['tho-lua', 'linh-hoa-quay-nhieu', [['linh-hoa', 3], ['than-lan-nham', 2]], []],
                    ['hoc-gia', 'to-nhen', [['nhen-pha-le', 3]], [['silk', 4]]], ['hoc-gia', 'nghien-cuu-pha-le', [['tho-pha-le', 2]], [['amethyst', 5]]]];
      const out = {};
      for (const [npc, qid, kills, loot] of plan) {
        const name = QUESTS[qid].name, o = out[qid] = {};
        let t = T.talk(npc); o.canAccept = pick(t.v, 'Nhận', name) >= 0;
        g.act('u1', { t: 'dlg', i: pick(t.v, 'Nhận', name) }); o.active = g.questState('u1', qid) === 'active';
        for (const [mob, n] of kills) for (let i = 0; i < n; i++) { const m = spawnMob(g, mob, p.x + 2, p.y, p.z); g.damageEntity(m, 9999, p); }
        for (const [it, n] of loot) g.giveItem('u1', it, n);
        g.tick(0.6); o.ready = g.questState('u1', qid) === 'ready';
        const before = xu(); t = T.talk(npc); const ti = pick(t.v, 'Trả', name); o.canTurnIn = ti >= 0;
        g.act('u1', { t: 'dlg', i: ti }); o.done = g.questState('u1', qid) === 'done'; o.paid = xu() > before;
      }
      return out;
    """)
    for qid, o in r.items():
        assert all(o.values()), (qid, o)


# ---------------------------------------------------------------- L: nhạc và âm thanh

@test
def test_score_has_a_theme_per_region_and_is_deterministic(pg):
    r = ev(pg, r"""
      const sc = await imp('audio/score.js'); const { REGIONS } = await imp('content/regions.js');
      const seqs = {}, bad = [];
      for (const id of sc.THEME_IDS) {
        const all = []; for (let i = 0; i < 128; i++) all.push(sc.stepNotes(id, i, false));
        const again = []; for (let i = 0; i < 128; i++) again.push(sc.stepNotes(id, i, false));
        if (JSON.stringify(all) !== JSON.stringify(again)) bad.push('nondeterministic ' + id);
        for (const st of all) for (const n of st) if (n.kind === 'tone' && !(n.f > 25 && n.f < 5000 && n.len > 0 && n.vol > 0 && n.vol < 0.2)) bad.push('range ' + id + ' ' + JSON.stringify(n));
        seqs[id] = JSON.stringify(all.map(st => st.filter(n => n.kind === 'tone').map(n => Math.round(n.f))));
      }
      const night = sc.THEME_IDS.filter(id => id !== 'boss').map(id => { let a = 0, b = 0; for (let i = 0; i < 512; i++) { a += sc.stepNotes(id, i, false).length; b += sc.stepNotes(id, i, true).length; } return [id, a, b]; });
      const boss = []; for (let i = 0; i < 16; i++) boss.push(...sc.stepNotes('boss', i, false).map(n => n.kind));
      return { bad, distinct: new Set(Object.values(seqs)).size, themes: sc.THEME_IDS.length, regionsCovered: REGIONS.every(rg => sc.THEME_IDS.includes(rg.id)),
               nightQuieter: night.every(([id, a, b]) => b <= a), nightDiff: night.some(([id, a, b]) => b < a), bossDrums: ['kick', 'snare', 'hat'].every(k => boss.includes(k)),
               bossFast: sc.stepSeconds('boss', false) < sc.stepSeconds('rung-suong', false), nightSlower: sc.stepSeconds('rung-suong', true) > sc.stepSeconds('rung-suong', false),
               themeFor: [sc.themeFor({ region: 'hoa-son' }), sc.themeFor({ region: 'hoa-son', boss: true }), sc.themeFor({ region: 'khong-co' })] };
    """)
    assert not r['bad'] and r['distinct'] == r['themes'] and r['themes'] >= 7 and r['regionsCovered'], r
    assert r['nightQuieter'] and r['nightDiff'] and r['bossDrums'] and r['bossFast'] and r['nightSlower'], r
    assert r['themeFor'] == ['hoa-son', 'boss', 'rung-suong'], r


@test
def test_score_player_switches_theme_on_bar_lines_and_boss_at_once(pg):
    r = ev(pg, r"""
      const sc = await imp('audio/score.js'); const got = [];
      const s = sc.createScore((n, t) => got.push(n));
      s.setContext({ region: 'rung-suong' }); s.playStep(0, 0); const a = s.theme;
      s.setContext({ region: 'sa-mac-lua' }); s.playStep(3, 0); const mid = s.theme; s.playStep(8, 0); const bar = s.theme;
      s.setContext({ region: 'sa-mac-lua', boss: true }); s.playStep(9, 0); const boss = s.theme;
      s.setContext({ region: 'sa-mac-lua', boss: false }); s.playStep(10, 0); const still = s.theme; s.playStep(16, 0); const back = s.theme;
      const dur = s.playStep(17, 0);
      return { a, mid, bar, boss, still, back, dur, notes: got.length };
    """)
    assert (r['a'], r['mid'], r['bar'], r['boss'], r['still'], r['back']) == ('rung-suong', 'rung-suong', 'sa-mac-lua', 'boss', 'boss', 'sa-mac-lua'), r
    assert r['dur'] > 0.2 and r['notes'] > 10, r


@test
def test_director_voices_mobs_plays_ambience_and_throttles_hurt(pg):
    r = ev(pg, r"""
      const { createDirector } = await imp('audio/director.js'); const { MOB_VOICE, voiceOf } = await imp('sfx.js'); const { MOBS } = await imp('content/mobs.js'); const { BOSSES } = await imp('content/bosses.js');
      const calls = []; const sfx = { play: (n, o) => calls.push([n, o && o.intent, o && o.type]) };
      let rr = 0.5; const d = createDirector({ sfx, emit: () => {}, rnd: () => rr, start: false });
      const mob = (st, dist, hp = 10) => ({ id: 1, type: 'soi-xam', st, hp, dist });
      d.update(0.1, { region: 'rung-suong', night: false, boss: false, mobs: [mob(0, 10)] });
      d.update(0.1, { region: 'rung-suong', night: false, boss: false, mobs: [mob(2, 9)] });
      d.update(0.1, { region: 'rung-suong', night: false, boss: false, mobs: [mob(2, 9)] });
      const alerts = calls.filter(c => c[0] === 'voice' && c[1] === 'alert').length;
      for (let i = 0; i < 400; i++) d.update(0.1, { region: 'dam-lay', night: true, boss: false, mobs: [mob(0, 10)] });
      const idle = calls.filter(c => c[1] === 'idle').length, amb = calls.filter(c => c[0].startsWith('amb:')).length;
      const far = calls.length; for (let i = 0; i < 400; i++) d.update(0.1, { region: 'dam-lay', night: false, boss: false, mobs: [{ id: 2, type: 'ran-lay', st: 0, hp: 5, dist: 60 }] });
      const farIdle = calls.slice(far).filter(c => c[1] === 'idle').length;
      d.update(0.1, { region: 'dam-lay', night: false, boss: false, mobs: [] });
      const dies = calls.filter(c => c[1] === 'die').length;
      const h0 = calls.length; d.hurt({ type: 'soi-xam', kind: 'mob', dist: 3 }); d.hurt({ type: 'soi-xam', kind: 'mob', dist: 3 });
      const hurts = calls.slice(h0).filter(c => c[1] === 'hurt').length;
      return { alerts, idle, amb, farIdle, dies, hurts, allVoiced: [...Object.keys(MOBS), ...Object.keys(BOSSES)].every(t => !!voiceOf(t)), explicit: Object.keys(MOBS).filter(t => !MOB_VOICE[t]) };
    """)
    assert r['alerts'] == 1 and r['idle'] >= 2 and r['amb'] >= 5 and r['farIdle'] == 0 and r['dies'] == 1 and r['hurts'] == 1, r
    assert r['allVoiced'] and r['explicit'] == [], r


@test
def test_game_runs_music_for_region_and_volume_controls(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""async () => {
      const g = __g, out = {};
      await new Promise(r => setTimeout(r, 600));
      out.theme = g.director.score.theme; out.region = g.S.world.regionAt(g.local.x, g.local.z);
      const before = JSON.parse(localStorage.getItem('game-hub-settings-v1') || '{}');
      const el = document.getElementById('vol-music'); el.value = 20; el.dispatchEvent(new Event('input'));
      out.saved = JSON.parse(localStorage.getItem('game-hub-settings-v1') || '{}').music;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyU' })); out.muted = JSON.parse(localStorage.getItem('game-hub-settings-v1')).music;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyU' })); out.unmuted = JSON.parse(localStorage.getItem('game-hub-settings-v1')).music;
      g.sfx.play('voice', { type: 'soi-xam', intent: 'alert', dist: 3 }); out.voiceStat = g.sfx.stats['voice:alert'];
      return out;
    }""")
    assert r['theme'] == r['region'], r
    assert r['saved'] == 20 and r['muted'] == 0 and r['unmuted'] == 20 and r['voiceStat'] == 1, r


# ---------------------------------------------------------------- M: chế tạo sâu, trang bị, môi trường, xây dựng

CRAFT_JS = GAME_JS + """
const { RECIPES, recipeById, canCraft, craft } = await imp('sim/crafting.js');
const { ITEMS } = await imp('content/items.js');
const { B, BLOCKS } = await imp('world/blocks.js');
const { REGIONS } = await imp('content/regions.js');
const { regionAt } = await imp('world/regions.js');
const mkSolo = (seed = 777) => { const g = new Game({ seed, spawning: false }); const p = g.addPlayer('u1', 'T'); p.hp = p.maxHp = 20; return { g, p }; };
const goTo = (g, p, regionId) => {
  for (let x = -3000; x <= 3000; x += 40) for (let z = -3000; z <= 3000; z += 40) if (regionAt(g.seed, x, z) === regionId && g.world.surfaceY(x, z) > 21) {
    g.teleportPlayer(p, x + 0.5, g.world.surfaceY(x, z) + 1, z + 0.5); p.region = regionId; return true; }
  return false;
};
const tickFor = (g, secs, dt = 0.25) => { for (let t = 0; t < secs; t += dt) g.tick(dt); };
"""


@test
def test_stations_gate_recipes_and_smelting_chain(pg):
    r = ev(pg, CRAFT_JS + r"""
      const { makeInventory, addItem, countItem } = await imp('sim/inventory.js');
      const inv = makeInventory();
      addItem(inv, 'log', 2); addItem(inv, 'iron_ore', 3); addItem(inv, 'sand', 2); addItem(inv, 'stick', 2);
      const wb = { workbench: true }, fu = { furnace: true }, an = { anvil: true };
      const out = {};
      out.charcoalNoStation = canCraft(inv, 'charcoal', false);
      out.charcoalWorkbench = canCraft(inv, 'charcoal', wb);
      out.charcoal = craft(inv, 'charcoal', fu) && craft(inv, 'charcoal', fu);
      out.ingot = craft(inv, 'iron_ingot', fu); out.ingot2 = craft(inv, 'iron_ingot', fu);
      out.glass = craft(inv, 'glass', fu);
      out.have = { charcoal: countItem(inv, 'charcoal'), ingot: countItem(inv, 'iron_ingot'), glass: countItem(inv, 'glass') };
      addItem(inv, 'iron_ingot', 4); addItem(inv, 'planks', 3);
      out.swordAtWorkbench = canCraft(inv, 'iron_sword', wb); out.swordAtAnvil = canCraft(inv, 'iron_sword', an);
      out.legacyTrue = canCraft(inv, 'wood_pick', true);     // true cũ = bàn chế tạo
      out.anvilRecipesNeedAnvil = RECIPES.filter(r => r.bench === 'anvil').length;
      out.furnaceRecipes = RECIPES.filter(r => r.bench === 'furnace').length;
      return out;
    """)
    assert not r['charcoalNoStation'] and not r['charcoalWorkbench'] and r['charcoal'] and r['ingot'] and r['ingot2'] and r['glass'], r
    assert r['have']['ingot'] == 2 and r['have']['glass'] == 2, r
    assert not r['swordAtWorkbench'] and r['swordAtAnvil'] and r['legacyTrue'], r
    assert r['anvilRecipesNeedAnvil'] >= 20 and r['furnaceRecipes'] >= 4, r


@test
def test_stations_are_detected_near_player_and_iron_ore_exists_underground(pg):
    r = ev(pg, CRAFT_JS + r"""
      const { nearStations } = await imp('sim/rules.js');
      const { g, p } = mkSolo();
      const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z);
      const none = nearStations(g.world, p.x, p.y, p.z);
      g.world.set(x + 2, y, z, B.FURNACE); g.world.set(x, y, z + 3, B.ANVIL);
      const near = nearStations(g.world, p.x, p.y, p.z);
      const far = nearStations(g.world, p.x + 30, p.y, p.z);
      // quặng sắt nằm dưới lòng đất ở mọi vùng, và cần cuốc đá
      const { generateChunk } = await imp('world/generate.js');
      let iron = 0, regions = new Set();
      for (let cx = -20; cx <= 20; cx += 2) for (let cz = -20; cz <= 20; cz += 2) {
        const ch = generateChunk(777, cx, cz); for (let i = 0; i < ch.length; i++) if (ch[i] === B.IRON_ORE) { iron++; regions.add(regionAt(777, cx * 16 + 8, cz * 16 + 8)); break; }
      }
      const def = BLOCKS[B.IRON_ORE];
      return { none, near, far, iron, regions: regions.size, drop: def.drop, tier: def.tier, tool: def.tool };
    """)
    assert r['none'] == {'workbench': False, 'furnace': False, 'anvil': False}, r
    assert r['near']['furnace'] and r['near']['anvil'] and not r['near']['workbench'] and not r['far']['furnace'], r
    assert r['iron'] > 40 and r['regions'] >= 2 and r['drop'] == 'iron_ore' and r['tier'] == 2 and r['tool'] == 'pick', r


@test
def test_armor_sets_have_four_pieces_resists_and_relics_need_boss_trophies(pg):
    r = ev(pg, CRAFT_JS + r"""
      const { BOSSES } = await imp('content/bosses.js'); const { MOBS } = await imp('content/mobs.js');
      const sets = {};
      for (const it of Object.values(ITEMS)) if (it.armor) (sets[it.armor.set] = sets[it.armor.set] || []).push(it);
      const slots = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.map(i => i.armor.slot).sort().join(',')]));
      const defs = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.reduce((a, i) => a + i.armor.def, 0)]));
      const resist = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, [...new Set(v.map(i => i.armor.resist).filter(Boolean))].join(',')]));
      const mobDrops = new Set(Object.values(MOBS).flatMap(m => (m.drops || []).map(d => d.item)));
      const trophies = Object.values(BOSSES).flatMap(b => (b.drops || []).map(d => d.item)).filter(i => i !== 'xu' && !mobDrops.has(i));
      const relics = RECIPES.filter(r => ITEMS[r.out.item] && ITEMS[r.out.item].relic);
      const relicNeed = relics.map(r => Object.keys(r.in).filter(k => trophies.includes(k)).length);
      const used = new Set(relics.flatMap(r => Object.keys(r.in)));
      const missingTrophies = ['wolf_heart', 'scorpion_crown', 'frost_core', 'swamp_heart', 'magma_core', 'guardian_prism'].filter(t => !used.has(t) || !trophies.includes(t));
      const regionsEnv = Object.fromEntries(REGIONS.filter(r => r.env).map(r => [r.id, r.env.kind + ':' + r.env.power]));
      const fireproof = Object.values(ITEMS).filter(i => i.armor && i.armor.fireproof).map(i => i.id);
      return { missingTrophies, names: Object.keys(sets).sort(), slots, defs, resist, relicNeed, regionsEnv, fireproof };
    """)
    assert r['names'] == ['chitin', 'ember', 'crystal', 'fur', 'iron', 'scale'] or sorted(r['names']) == sorted(['chitin', 'ember', 'crystal', 'fur', 'iron', 'scale']), r
    assert all(v == 'chest,feet,head,legs' for v in r['slots'].values()), r
    assert r['resist']['fur'] == 'cold' and r['resist']['chitin'] == 'heat' and r['resist']['scale'] == 'toxic' and r['resist']['ember'] == 'heat' and r['resist']['crystal'] == 'cold' and r['resist']['iron'] == '', r
    assert r['defs']['crystal'] > r['defs']['ember'] > r['defs']['scale'] > r['defs']['iron'] > r['defs']['fur'], r
    assert len(r['relicNeed']) >= 6 and all(n >= 1 for n in r['relicNeed']) and r['missingTrophies'] == [], r
    assert r['regionsEnv'] == {'sa-mac-lua': 'heat:2', 'nui-bang': 'cold:2', 'dam-lay': 'toxic:2', 'hoa-son': 'heat:3', 'vuc-pha-le': 'cold:3'}, r
    assert r['fireproof'] == ['ember_boots'], r


@test
def test_equip_armor_reduces_damage_swaps_and_persists(pg):
    r = ev(pg, CRAFT_JS + r"""
      const { g, p } = mkSolo();
      g.giveItem('u1', 'iron_helm', 1); g.giveItem('u1', 'iron_chest', 1); g.giveItem('u1', 'stone', 3);
      const slotOf = id => p.inv.findIndex(s => s && s.id === id);
      const out = {};
      out.notArmor = g.act('u1', { t: 'equip', i: slotOf('stone') }).ok;
      out.eq1 = g.act('u1', { t: 'equip', i: slotOf('iron_helm') }).ok; out.eq2 = g.act('u1', { t: 'equip', i: slotOf('iron_chest') }).ok;
      out.armor = { head: p.armor.head, chest: p.armor.chest };
      out.left = p.inv.filter(s => s && s.id.startsWith('iron_')).length;
      p.hp = 20; g.hurtPlayer(p, 10, { id: 99 }); out.afterMelee = p.hp;               // 10 sát thương, giáp 2+5 = 7 điểm
      p.hp = 20; g.hurtPlayer(p, 1, { id: 99 }); out.minOne = p.hp;
      // đổi sang mũ khác: mũ cũ quay lại kho ở đúng ô
      g.giveItem('u1', 'fur_helm', 1); const i = slotOf('fur_helm'); g.act('u1', { t: 'equip', i });
      out.swapped = { head: p.armor.head, back: p.inv[i] && p.inv[i].id };
      // lưu và nạp
      const save = JSON.parse(JSON.stringify(g.toSave())); const g2 = Game.fromSave(save, { spawning: false }); const q = g2.addPlayer('u1', 'T');
      out.saved = q.armor;
      out.unequip = g.act('u1', { t: 'unequip', slot: 'chest' }).ok; out.chestBack = p.inv.some(s => s && s.id === 'iron_chest'); out.chestNow = p.armor.chest;
      const full = mkSolo(); full.p.inv.fill({ id: 'dirt', n: 64 }); full.p.armor.head = 'iron_helm';
      out.unequipFull = full.g.act('u1', { t: 'unequip', slot: 'head' }).ok;
      return out;
    """)
    assert not r['notArmor'] and r['eq1'] and r['eq2'] and r['armor'] == {'head': 'iron_helm', 'chest': 'iron_chest'} and r['left'] == 0, r
    assert r['afterMelee'] in (13, 14) and r['afterMelee'] > 10 and r['minOne'] == 19, r
    assert r['swapped'] == {'head': 'fur_helm', 'back': 'iron_helm'}, r
    assert r['saved']['head'] == 'fur_helm' and r['saved']['chest'] == 'iron_chest', r
    assert r['unequip'] and r['chestBack'] and r['chestNow'] is None and not r['unequipFull'], r


@test
def test_region_environment_hurts_without_matching_gear(pg):
    r = ev(pg, CRAFT_JS + r"""
      const out = {};
      const run = (region, pieces, { kind } = {}) => {
        const { g, p } = mkSolo(); g.flags['boss:thu-linh-soi'] = true; g.flags['boss:bo-cap-chua'] = true;
        goTo(g, p, region);
        for (const id of pieces) { g.giveItem('u1', id, 1); g.act('u1', { t: 'equip', i: p.inv.findIndex(s => s && s.id === id) }); }
        tickFor(g, 0.5); const hp0 = p.hp; tickFor(g, 24); return { lost: hp0 - p.hp };
      };
      out.forest = run('rung-suong', []);
      out.coldBare = run('nui-bang', []);
      out.coldFur2 = run('nui-bang', ['fur_helm', 'fur_chest']);
      out.coldFur1 = run('nui-bang', ['fur_helm']);
      out.heatBare = run('sa-mac-lua', []);
      out.heatChitin2 = run('sa-mac-lua', ['chitin_helm', 'chitin_chest']);
      out.lavaChitin2 = run('hoa-son', ['chitin_helm', 'chitin_chest']);
      out.lavaChitin3 = run('hoa-son', ['chitin_helm', 'chitin_chest', 'chitin_legs']);
      out.swampBare = run('dam-lay', []);
      out.swampScale2 = run('dam-lay', ['scale_helm', 'scale_chest']);
      out.crystalFur2 = run('vuc-pha-le', ['fur_helm', 'fur_chest']); out.crystalFur3 = run('vuc-pha-le', ['fur_helm', 'fur_chest', 'fur_legs']);
      out.crystalFurWrongKind = run('vuc-pha-le', ['chitin_helm', 'chitin_chest', 'chitin_legs', 'chitin_boots']);
      out.crystalFur4 = run('vuc-pha-le', ['fur_helm', 'fur_chest', 'fur_legs', 'fur_boots']);
      return out;
    """)
    assert r['forest']['lost'] == 0, r
    assert r['coldBare']['lost'] >= 6 and r['coldFur2']['lost'] == 0 and 0 < r['coldFur1']['lost'] < r['coldBare']['lost'], r
    assert r['heatBare']['lost'] >= 6 and r['heatChitin2']['lost'] == 0, r
    assert r['lavaChitin2']['lost'] > 0 and r['lavaChitin3']['lost'] == 0, r
    assert r['swampBare']['lost'] >= 6 and r['swampScale2']['lost'] == 0, r
    assert r['crystalFur2']['lost'] > 0 and r['crystalFur3']['lost'] == 0 and r['crystalFur4']['lost'] == 0 and r['crystalFurWrongKind']['lost'] > 0, r


@test
def test_ember_boots_make_magma_safe_and_armor_does_not_soften_environment(pg):
    r = ev(pg, CRAFT_JS + r"""
      const stand = (boots) => {
        const { g, p } = mkSolo(); g.flags['boss:thu-linh-soi'] = true; goTo(g, p, 'rung-suong');
        const x = Math.floor(p.x), z = Math.floor(p.z), y = g.world.surfaceY(x, z);
        g.world.set(x, y, z, B.MAGMA); g.world.set(x, y + 1, z, 0); g.world.set(x, y + 2, z, 0); g.teleportPlayer(p, x + 0.5, y + 1, z + 0.5);
        if (boots) { g.giveItem('u1', boots, 1); g.act('u1', { t: 'equip', i: p.inv.findIndex(s => s && s.id === boots) }); }
        const hp0 = p.hp; for (let t = 0; t < 6; t += 0.25) { g.teleportPlayer(p, x + 0.5, y + 1, z + 0.5); g.tick(0.25); } return hp0 - p.hp;
      };
      // sát thương môi trường là "thuần": giáp thường không làm nhẹ đi
      const { g, p } = mkSolo(); g.giveItem('u1', 'iron_chest', 1); g.act('u1', { t: 'equip', i: p.inv.findIndex(s => s && s.id === 'iron_chest') });
      p.hp = 20; g.hurtPlayer(p, 2, null, { pure: true });
      return { bare: stand(null), ironBoots: stand('iron_boots'), emberBoots: stand('ember_boots'), pure: p.hp };
    """)
    assert r['bare'] >= 4 and r['ironBoots'] >= 4 and r['emberBoots'] == 0 and r['pure'] == 18, r


@test
def test_torch_door_chest_bed_glass_and_brick(pg):
    r = ev(pg, CRAFT_JS + r"""
      const { spawnTick } = await imp('sim/mobs.js');
      const { g, p } = mkSolo();
      const x = Math.floor(p.x) + 2, z = Math.floor(p.z), y = g.world.surfaceY(x, z);
      const put = (id, item, dx = 0, dz = 0) => { g.world.set(x + dx, y + 1, z + dz, 0); g.giveItem('u1', item, 1); p.sel = p.inv.findIndex(s => s && s.id === item); return g.act('u1', { t: 'place', x: x + dx, y: y + 1, z: z + dz }); };
      const out = {};
      out.torch = put(B.TORCH, 'torch').ok; out.torchBlock = g.world.get(x, y + 1, z) === B.TORCH;
      // phá đuốc: nhận lại đuốc
      g.act('u1', { t: 'dig', x, y: y + 1, z }); g.tick(0.5); g.act('u1', { t: 'break', x, y: y + 1, z });
      out.torchBack = p.inv.some(s => s && s.id === 'torch'); out.torchGone = g.world.get(x, y + 1, z) === 0;
      // cửa: bấm để mở/đóng, mở thì đi xuyên được
      out.door = put(B.DOOR, 'door').ok; const solid = () => BLOCKS[g.world.get(x, y + 1, z)].solid;
      out.closedSolid = solid(); out.toggle1 = g.act('u1', { t: 'toggle', x, y: y + 1, z }).ok; out.openSolid = solid(); out.openBlock = g.world.get(x, y + 1, z) === B.DOOR_OPEN;
      g.act('u1', { t: 'toggle', x, y: y + 1, z }); out.closedAgain = g.world.get(x, y + 1, z) === B.DOOR;
      out.toggleStone = g.act('u1', { t: 'toggle', x, y, z }).ok;
      // rương
      out.chest = put(B.CHEST, 'chest', 1).ok; const cx = x + 1;
      g.giveItem('u1', 'xu', 120); const xuSlot = p.inv.findIndex(s => s && s.id === 'xu');
      g.drain(); out.open = g.act('u1', { t: 'chest-open', x: cx, y: y + 1, z }).ok;
      const openEv = g.drain().find(e => e.ev.t === 'chest'); out.openEv = !!openEv && openEv.ev.inv.length === 27;
      out.put = g.act('u1', { t: 'chest-move', x: cx, y: y + 1, z, from: 'inv', slot: xuSlot }).ok;
      out.xuInInv = p.inv.filter(s => s && s.id === 'xu').reduce((a, s) => a + s.n, 0);
      const save = JSON.parse(JSON.stringify(g.toSave())); const g2 = Game.fromSave(save, { spawning: false }); g2.addPlayer('u1', 'T');
      out.saved = JSON.stringify(g2.chests).includes('xu');
      out.take = g.act('u1', { t: 'chest-move', x: cx, y: y + 1, z, from: 'chest', slot: 0 }).ok; out.xuBack = p.inv.filter(s => s && s.id === 'xu').reduce((a, s) => a + s.n, 0);
      g.act('u1', { t: 'chest-move', x: cx, y: y + 1, z, from: 'inv', slot: p.inv.findIndex(s => s && s.id === 'xu') });
      g.act('u1', { t: 'dig', x: cx, y: y + 1, z }); g.tick(2); g.act('u1', { t: 'break', x: cx, y: y + 1, z });
      out.dropsContents = [...g.ents.values()].some(e => e.kind === 'item' && e.item === 'xu');
      out.farChest = g.act('u1', { t: 'chest-open', x: cx + 40, y: y + 1, z }).ok;
      // giường đặt điểm hồi sinh
      out.bed = put(B.BED, 'bed', 0, 3).ok; out.sleep = g.act('u1', { t: 'sleep', x, y: y + 1, z: z + 3 }).ok;
      p.dead = true; p.respawnAt = 0; g.tick(0.1); g.act('u1', { t: 'respawn' });
      out.atBed = Math.hypot(p.x - (x + 0.5), p.z - (z + 3 + 0.5)) < 1.5;
      g.world.set(x, y + 1, z + 3, 0); p.dead = true; p.respawnAt = 0; g.act('u1', { t: 'respawn' });
      out.bedGoneUsesSpawn = Math.hypot(p.x - (g.spawn.x + 0.5), p.z - (g.spawn.z + 0.5)) < 1.5;
      // kính và gạch
      out.glassTransparent = !BLOCKS[B.GLASS].opaque && BLOCKS[B.GLASS].solid; out.brick = BLOCKS[B.STONE_BRICK].solid && BLOCKS[B.STONE_BRICK].drop === 'stone_brick';
      return out;
    """)
    assert r['torch'] and r['torchBlock'] and r['torchBack'] and r['torchGone'], r
    assert r['door'] and r['closedSolid'] and r['toggle1'] and not r['openSolid'] and r['openBlock'] and r['closedAgain'] and not r['toggleStone'], r
    assert r['chest'] and r['open'] and r['openEv'] and r['put'] and r['xuInInv'] == 0 and r['saved'] and r['take'] and r['xuBack'] == 120, r
    assert r['dropsContents'] and not r['farChest'], r
    assert r['bed'] and r['sleep'] and r['atBed'] and r['bedGoneUsesSpawn'], r
    assert r['glassTransparent'] and r['brick'], r


@test
def test_torches_keep_monsters_from_spawning_nearby(pg):
    r = ev(pg, CRAFT_JS + r"""
      const { spawnTick } = await imp('sim/mobs.js');
      const count = (withTorch) => {
        const g = new Game({ seed: 777, spawning: false }); const p = g.addPlayer('u1', 'T'); g.time = 60 * 12;     // đêm
        if (withTorch) for (let dx = -32; dx <= 32; dx += 6) for (let dz = -32; dz <= 32; dz += 6) { const x = Math.floor(p.x) + dx, z = Math.floor(p.z) + dz, y = g.world.surfaceY(x, z); g.world.set(x, y + 1, z, B.TORCH); }
        for (let i = 0; i < 400; i++) { g.tickNo++; spawnTick(g, 1); if (i % 40 === 39) for (const e of [...g.ents.values()]) if (e.kind === 'mob') g.ents.delete(e.id) && (g._n = (g._n || 0) + 1); }
        return (g._n || 0) + [...g.ents.values()].filter(e => e.kind === 'mob').length;
      };
      return { open: count(false), lit: count(true) };
    """)
    assert r['open'] > 5 and r['lit'] < r['open'] * 0.3, r


@test
def test_new_weapons_and_tools_scale_by_material(pg):
    r = ev(pg, CRAFT_JS + r"""
      const d = id => ITEMS[id].dmg;
      return { wood: d('wood_sword'), stone: d('stone_sword'), iron: d('iron_sword'), crystal: d('crystal_sword'), gem: d('gem_sword'),
               relics: ['wolf_blade', 'scorpion_blade', 'frost_axe', 'swamp_club', 'magma_blade', 'prism_blade'].map(id => d(id)),
               ironPick: ITEMS.iron_pick.tool, stonePick: ITEMS.stone_pick.tool };
    """)
    assert r['stone'] < r['iron'] < r['crystal'] and r['gem'] > r['iron'], r
    assert r['relics'] == sorted(r['relics']) and r['relics'][0] >= 9 and r['relics'][-1] >= 13, r
    assert r['ironPick']['tier'] == r['stonePick']['tier'] and r['ironPick']['speed'] > r['stonePick']['speed'], r


UI_SETUP = """
      const g = __g, uid = g.S.uid, game = g.game, me = game.player(uid);
      const key = code => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const slotOf = id => me.inv.findIndex(s => s && s.id === id);
"""


@test
def test_ui_inventory_shows_equipment_stations_and_equips_by_right_click(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""async () => {""" + UI_SETUP + """
      const out = {};
      game.giveItem(uid, 'iron_helm', 1); game.giveItem(uid, 'iron_ingot', 9); game.giveItem(uid, 'stick', 4);
      await wait(200); key('KeyE'); await wait(250);
      const root = document.getElementById('panel');
      out.open = !root.hidden; out.equipSlots = root.querySelectorAll('.slot.eq').length; out.info0 = root.querySelector('.eqinfo').textContent;
      out.groups = [...root.querySelectorAll('.recipes summary')].map(h => h.textContent);
      // bấm phải vào mũ sắt trong kho: mặc vào
      const slots = [...root.querySelectorAll('.grid .slot')]; const i = slotOf('iron_helm');
      slots[i].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await wait(300);
      out.head = me.armor.head; out.info1 = document.querySelector('#panel .eqinfo').textContent;
      // không có đe: không chế được kiếm sắt; đặt đe gần bên thì chế được
      const sword = () => [...document.querySelectorAll('#panel .rec')].find(r => r.textContent.includes('Kiếm sắt'));
      out.swordBtnBefore = !sword().querySelector('button').disabled;
      const x = Math.floor(me.x) + 2, z = Math.floor(me.z), y = game.world.surfaceY(x, z) + 1;
      game.setBlock(x, y, z, 32); await wait(500);
      out.near = [...document.querySelectorAll('#panel .recipes h3')].map(h => h.textContent).join('|');
      out.swordBtnAfter = !sword().querySelector('button').disabled;
      sword().querySelector('button').click(); await wait(300);
      out.sword = me.inv.some(s => s && s.id === 'iron_sword');
      // vẽ lại (đổi kho) không làm nhóm đang mở bị đóng; nhóm người chơi tự đóng thì giữ đóng
      const grp = () => [...document.querySelectorAll('#panel .recgroup')];
      out.openBefore = grp().map(d => d.open).join(',');
      game.giveItem(uid, 'dirt', 1); await wait(300);
      out.openAfterRefresh = grp().map(d => d.open).join(',');
      grp()[0].open = false; await wait(100); game.giveItem(uid, 'dirt', 1); await wait(300);
      out.closedStays = grp()[0].open;
      // bấm vào ô trang bị để cởi
      document.querySelector('#panel .slot.eq').click(); await wait(300); out.headAfter = me.armor.head;
      return out;
    }""")
    assert r['open'] and r['equipSlots'] == 5 and 'Giáp 0' in r['info0'], r          # 4 ô giáp + ô Tay phụ (Gói Chiến đấu)
    assert len(r['groups']) == 4 and r['groups'][0].startswith('Thủ công') and all('chưa ở gần' in g for g in r['groups'][1:]), r
    assert r['head'] == 'iron_helm' and 'Giáp 2' in r['info1'] and '8%' in r['info1'], r
    assert not r['swordBtnBefore'] and r['swordBtnAfter'] and 'Đe rèn' in r['near'] and r['sword'], r
    assert r['headAfter'] is None, r
    assert r['openBefore'] == r['openAfterRefresh'] and r['openBefore'].split(',')[0] == 'true' and r['closedStays'] is False, r


@test
def test_ui_right_click_opens_chest_door_and_bed_and_moves_items(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""async () => {""" + UI_SETUP + """
      const out = {};
      const x = Math.floor(me.x), z = Math.floor(me.z), y = game.world.surfaceY(x, z + 3);
      game.setBlock(x, y + 1, z + 3, 33);                                 // rương trước mặt
      game.giveItem(uid, 'xu', 50); await wait(200);
      g.S.act({ t: 'chest-open', x, y: y + 1, z: z + 3 }); await wait(300);
      const root = document.getElementById('panel'); out.kind = !root.hidden && root.querySelectorAll('.grid').length;
      out.chestSlots = root.querySelectorAll('.grid')[0].children.length;
      const mine = [...root.querySelectorAll('.grid')[1].children]; mine[slotOf('xu')].click(); await wait(350);
      out.inChest = JSON.stringify(game.chests).includes('xu'); out.stillChestPanel = root.querySelectorAll('.grid').length === 2;
      out.firstSlotShows = root.querySelectorAll('.grid')[0].children[0].querySelector('img') !== null;
      root.querySelectorAll('.grid')[0].children[0].click(); await wait(350);
      out.back = me.inv.some(s => s && s.id === 'xu' && s.n === 50);
      return out;
    }""")
    assert r['kind'] == 2 and r['chestSlots'] == 27 and r['inChest'] and r['stillChestPanel'] and r['firstSlotShows'] and r['back'], r


# ---------------------------------------------------------------- Gói 1: Sinh tồn & Kinh tế (trồng trọt, nuôi thú, đói, nấu ăn)
# Mỗi bài ứng với một tiêu chí AC-n trong docs/specs/survival.md mục 8. Bài mô phỏng dùng bước thời gian thô (R-34: kết quả không phụ thuộc kích thước bước).

FARM_JS = ARENA_JS + """
const { B, BLOCK_BY_NAME, CROP_BLOCKS, cropOf } = await imp('world/blocks.js');
const { CROPS } = await imp('content/farming.js');
const { makeRng } = await imp('sim/rng.js');
const combat = await imp('sim/combat.js');
const farmMod = await imp('sim/farm.js');
const animals = await imp('sim/animals.js');
const hungerMod = await imp('sim/hunger.js');
const { craft, canCraft } = await imp('sim/crafting.js');
const inv = await imp('sim/inventory.js');
const giveHeld = (g, p, id, n = 1) => { p.inv.fill(null); p.inv[0] = { id, n }; p.sel = 0; g.touch(p); };
const fixRng = (g, seed = 1) => { g.rng = makeRng(seed); };
const runBig = (g, secs, dt = 0.5) => { for (let t = 0; t < secs - 1e-9; t += dt) g.tick(dt); };
const nearly = (a, b, tol) => Math.abs(a - b) <= tol;
const count = (p, id) => inv.countItem(p.inv, id);
// Sân cỏ phẳng 41x41 (mặt sân y0), nước ở (cx+3..4, cz). Bài truyền hunger:true để bật đói; các hàm cày/gieo nhận độ lệch (dx, dz) so với tâm.
const mkFarm = (opts = {}) => {
  const A = mkArena({ hunger: true, ...opts }); const { g, p, cx, cz, y0 } = A;
  for (let dx = -20; dx <= 20; dx++) for (let dz = -20; dz <= 20; dz++) g.world.set(cx + dx, y0, cz + dz, B.GRASS);
  g.world.set(cx + 3, y0, cz, B.WATER); g.world.set(cx + 4, y0, cz, B.WATER);
  const F = { ...A };
  F.stand = (dx, dz) => { p.x = cx + dx + 0.5; p.z = cz + dz + 2.5; p.y = y0 + 1; };
  F.at = (dx, dz, dy = 0) => ({ x: cx + dx, y: y0 + dy, z: cz + dz });
  F.id = (dx, dz, dy = 0) => g.world.get(cx + dx, y0 + dy, cz + dz);
  F.key = (dx, dz, dy = 1) => (cx + dx) + ',' + (y0 + dy) + ',' + (cz + dz);
  F.till = (dx, dz) => { F.stand(dx, dz); giveHeld(g, p, 'wood_hoe'); return g.act('u1', { t: 'till', ...F.at(dx, dz) }); };
  F.plant = (dx, dz, seed = 'wheat_seed') => { F.stand(dx, dz); giveHeld(g, p, seed, 5); return g.act('u1', { t: 'plant', ...F.at(dx, dz) }); };
  F.ripe = (dx, dz, kind = 'wheat') => {                       // ép cây ở ô này chín (giai đoạn 3)
    const c = g.crops.get(F.key(dx, dz)); c.s = 3; c.g = CROPS[kind].secs; g.setBlock(cx + dx, y0 + 1, cz + dz, CROP_BLOCKS[kind][3]);
  };
  F.dig = (x, y, z) => { p.dig = { x, y, z, t0: g.time - 5 }; return g.act('u1', { t: 'break', x, y, z }); };      // đào xong ngay (đã quá thời gian)
  F.animal = (type, dx, dz, o = {}) => { const e = spawnMob(g, type, cx + 0.5 + dx, y0 + 1, cz + 0.5 + dz, o); return e; };
  return F;
};
const adult = e => { e.age = 300; return e; };
"""


@test
def test_survival_hunger_drain(pg):
    r = ev(pg, FARM_JS + r"""
      const { HostSession } = await imp('net/host.js');
      const A = mkArena({ hunger: true });
      const fresh = A.p.food; runBig(A.g, 900, 0.25);
      const B2 = mkArena({ hunger: true }); B2.p.sprint = true; B2.p.vx = 5; runBig(B2.g, 450, 0.25);
      const noSprint = mkArena({ hunger: true }); noSprint.p.sprint = true; noSprint.p.vx = 0; runBig(noSprint.g, 450, 0.25);          // báo chạy mà không di chuyển: không tính
      const off = mkArena({ hunger: false }); runBig(off.g, 900, 0.5);
      const dead = mkArena({ hunger: true }); dead.g.hurtPlayer(dead.p, 999, null); runBig(dead.g, 100, 0.5);
      // chơi một mình tạm dừng (Esc) thì không đói
      const g = new Game({ seed: 777, spawning: false, hunger: true }); g.addPlayer('uh', 'H');
      const host = HostSession.solo({ game: g, name: 'H', uid: 'uh' });
      host.pause(true); const t0 = g.time, f0 = g.player('uh').fat; for (let i = 0; i < 400; i++) host.step(0.05);
      const frozen = g.time === t0 && g.player('uh').fat === f0;
      host.pause(false); for (let i = 0; i < 40; i++) host.step(0.05); const moved = g.player('uh').fat > f0 + 1.5; host.leave();
      return { fresh, idle: A.p.food, run: B2.p.food, noSprint: noSprint.p.food, off: off.p.food, dead: dead.p.food, deadFat: dead.p.fat, frozen, moved, alive: !A.p.dead, hp: A.p.hp };
    """)
    assert r['fresh'] == 20 and abs(r['idle'] - 0) <= 1 and abs(r['run'] - 0) <= 1, r
    assert r['noSprint'] == 10 and r['off'] == 20 and r['dead'] == 20 and r['deadFat'] == 0, r
    assert r['frozen'] and r['moved'] and r['alive'] and r['hp'] >= 2, r


@test
def test_survival_hunger_exertion(pg):
    r = ev(pg, FARM_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena({ hunger: true });
      const q = g.addPlayer('u2', 'Q'); q.x = cx + 12.5; q.z = cz + 12.5; q.y = y0 + 1;            // đối chứng: cùng thời gian, không đánh
      const m = spawnMob(g, 'xac-song', cx + 0.5 + 1.5, y0 + 1, cz + 0.5); m.frozen = true; m.hp = m.maxHp = 1e6;
      giveHeld(g, p, 'iron_sword'); let hits = 0;      // cách 0.9 s mỗi đòn: kiếm có hồi chiêu 0.8 s sau đòn 3 của chuỗi (Gói Chiến đấu), nhịp 0.5 s cũ sẽ trượt vài đòn; thể lực đổ đầy mỗi lượt vì đánh liên tục tốn thể lực
      for (let i = 0; i < 23; i++) { g.tick(0.9); p.stamina = 100; m.x = cx + 2; m.z = cz + 0.5; m.kbT = 0; if (g.act('u1', { t: 'hit', id: m.id }).ok) hits++; }
      return { hits, fatHit: p.fat, fatCtl: q.fat, foodHit: p.food, foodCtl: q.food, t: g.time };
    """)
    assert r['hits'] == 23 and abs(r['fatHit'] - r['fatCtl'] - 46 + 45) < 0.01, r          # 46 mệt thêm, 45 đã đổi thành 1 điểm đói
    assert r['foodCtl'] - r['foodHit'] == 1, r


@test
def test_survival_hunger_regen_starve(pg):
    r = ev(pg, FARM_JS + r"""
      const out = {};
      const setup = (food) => { const A = mkArena({ hunger: true }); A.p.hp = 10; A.p.food = food; A.p.lastHurt = A.g.time; return A; };
      let A = setup(20); runBig(A.g, 10, 0.5); out.full = A.p.hp - 10;                          // no: hồi sau 4 giây, 1 máu/2 giây
      A = setup(10); runBig(A.g, 10, 0.5); out.mid = A.p.hp - 10;                                // vừa: luật cũ, 8 giây rồi 4 giây/máu
      A = setup(6); runBig(A.g, 60, 0.5); out.low = A.p.hp - 10;                                 // đói: không tự hồi
      A = setup(0); A.p.hp = 20; A.p.armor = { head: 'crystal_helm', chest: 'crystal_chest', legs: 'crystal_legs', feet: 'crystal_boots' };
      runBig(A.g, 5.5, 0.5); out.starve1 = A.p.hp; runBig(A.g, 300, 0.5); out.starveEnd = A.p.hp; out.dead = A.p.dead;
      A = setup(5); A.p.food = 0; A.p.hp = 2; runBig(A.g, 60, 0.5); out.floor = A.p.hp;
      A = setup(20); out.warns = 0; A.p.food = 5; runBig(A.g, 130, 0.5); out.warns = A.g.drain().filter(x => x.ev.t === 'toast' && x.ev.text.includes('đói')).length;
      return out;
    """)
    assert r['full'] >= 3 and r['mid'] in (0, 1) and r['low'] == 0, r
    assert r['starve1'] == 19 and r['starveEnd'] == 2 and not r['dead'] and r['floor'] == 2, r
    assert 2 <= r['warns'] <= 3, r                                                              # cảnh báo "đang đói": tối đa 1 lần/60 giây


@test
def test_survival_eat_table(pg):
    r = ev(pg, FARM_JS + r"""
      const TABLE = { meat: [3, 5], pork: [3, 4], chicken: [2, 3], egg: [2, 1], carrot: [3, 1], potato: [1, 0], mushroom: [2, 3], frog_leg: [2, 4], herb: [2, 8],
        cooked_meat: [8, 11], cooked_pork: [8, 8], cooked_chicken: [6, 6], baked_potato: [5, 2], bread: [6, 2], stew: [10, 14], veg_soup: [9, 3], hearty_stew: [12, 4], egg_cake: [8, 2] };
      const { g, p } = mkArena({ hunger: true }); const bad = [];
      for (const [id, [food, heal]] of Object.entries(TABLE)) {
        p.hp = 3; p.food = 4; p.psn = null; p.eatAt = -99; giveHeld(g, p, id, 2);
        const a = g.act('u1', { t: 'use' });
        if (!a.ok || p.food !== 4 + food || p.hp !== Math.min(20, 3 + heal) || count(p, id) !== 1) bad.push([id, a, p.food, p.hp, count(p, id)]);
        const again = g.act('u1', { t: 'use' });                                               // ngay sau đó: hồi chiêu
        if (again.ok || again.reason !== 'cooldown' || count(p, id) !== 1) bad.push([id, 'cooldown', again]);
        p.psn = null; g.tick(1.1); p.hp = 3; p.food = 19; p.eatAt = -99; g.act('u1', { t: 'use' });            // kẹp tại 20
        if (food > 1 && p.food !== 20) bad.push([id, 'clamp', p.food]);
      }
      p.hp = p.maxHp; p.food = 20; p.eatAt = -99; giveHeld(g, p, 'bread', 2); const full = g.act('u1', { t: 'use' });
      p.hp = 5; p.eatAt = -99; giveHeld(g, p, 'wheat', 2); const nf = g.act('u1', { t: 'use' });
      p.hp = 5; p.food = 20; p.eatAt = -99; giveHeld(g, p, 'bread', 2); const hurtOnly = g.act('u1', { t: 'use' });            // đầy bụng nhưng thiếu máu: vẫn ăn được
      p.inv.fill(null); const empty = g.act('u1', { t: 'use' });
      return { bad, full: full.reason, left: 2, nf: nf.reason, hurtOnly: hurtOnly.ok, empty: empty.reason, n: Object.keys(TABLE).length };
    """)
    assert r['bad'] == [] and r['n'] == 18 and r['full'] == 'full' and r['nf'] == 'not-food' and r['hurtOnly'] and r['empty'] == 'empty', r


@test
def test_survival_eat_poison(pg):
    r = ev(pg, FARM_JS + r"""
      const { g, p } = mkArena({ hunger: true }); fixRng(g, 12345); let n = 0;
      for (let i = 0; i < 1000; i++) { p.hp = 5; p.food = 0; p.eatAt = -99; p.psn = null; giveHeld(g, p, 'meat'); g.act('u1', { t: 'use' }); if (p.psn) n++; }
      let safe = 0; for (let i = 0; i < 200; i++) { p.hp = 5; p.food = 0; p.eatAt = -99; p.psn = null; giveHeld(g, p, 'carrot'); g.act('u1', { t: 'use' }); if (p.psn) safe++; }
      // đúng 3 sát thương thuần trong 6 giây, giáp không làm nhẹ; ngộ độc không giết người
      const A = mkArena({ hunger: true }); A.g.rng = () => 0; A.p.armor = { head: 'crystal_helm', chest: 'crystal_chest', legs: 'crystal_legs', feet: 'crystal_boots' };
      A.p.hp = 20; A.p.food = 0; giveHeld(A.g, A.p, 'chicken'); A.g.act('u1', { t: 'use' }); A.p.food = 10; const hp0 = A.p.hp, has = A.p.fxView.map(f => f.id);
      runBig(A.g, 7, 0.5); const hp1 = A.p.hp, gone = !A.p.psn;
      const B2 = mkArena({ hunger: true }); B2.g.rng = () => 0; B2.p.food = 0; B2.p.hp = 2; giveHeld(B2.g, B2.p, 'pork'); B2.g.act('u1', { t: 'use' }); B2.p.hp = 2; B2.p.food = 10; runBig(B2.g, 10, 0.5);
      return { rate: n / 1000, safe, hp0, hp1, has, gone, low: B2.p.hp, dead: B2.p.dead };
    """)
    assert 0.21 <= r['rate'] <= 0.29 and r['safe'] == 0, r
    assert r['hp0'] == 20 and r['hp1'] == 17, r
    assert 'poison' in r['has'] and r['gone'] and r['low'] >= 1 and not r['dead'], r


@test
def test_survival_food_effects(pg):
    r = ev(pg, FARM_JS + r"""
      const out = {};
      const mk = () => { const A = mkArena({ hunger: true }); A.p.maxHp = 9999; A.p.hp = 5000; return A; };
      const view = (p, id) => (p.fxView.find(f => f.id === id) || {}).left, leftNow = (g, p, id) => Math.ceil((p.fx[id] || 0) - g.time - 1e-6);       // fxView chỉ làm mới khi thêm/mất: số giây còn lại tính từ thời điểm hết hạn
      // Hồi phục: +1 máu mỗi 2 giây trong 45 giây (22 máu)
      let A = mk(); A.p.hp = 1; A.p.food = 6; giveHeld(A.g, A.p, 'veg_soup'); A.g.act('u1', { t: 'use' }); const hpAfterEat = A.p.hp; A.p.food = 6;
      runBig(A.g, 46, 0.5); out.regen = A.p.hp - hpAfterEat; out.regenLeft = view(A.p, 'regen');
      // Sức mạnh: kiếm sắt (6) gây 8
      A = mk(); const { g, p, cx, cz, y0 } = A;
      const m = spawnMob(g, 'xac-song', cx + 0.5 + 1.5, y0 + 1, cz + 0.5); m.frozen = true; m.hp = m.maxHp = 100;
      p.inv.fill(null); p.inv[1] = { id: 'iron_sword', n: 1 }; p.inv[0] = { id: 'hearty_stew', n: 3 }; p.sel = 1; g.tick(0.6);
      g.act('u1', { t: 'hit', id: m.id }); out.plain = 100 - m.hp; g.tick(0.6);
      p.sel = 0; g.act('u1', { t: 'use' }); p.sel = 1; g.tick(1.1);
      const h1 = m.hp; g.act('u1', { t: 'hit', id: m.id }); out.power = h1 - m.hp;
      // không cộng dồn: ăn lại thì lấy max(còn lại, mới)
      runBig(g, 60, 0.5); const left60 = leftNow(g, p, 'power'); p.sel = 0; g.act('u1', { t: 'use' }); out.left60 = left60; out.leftAgain = view(p, 'power');
      // Da dày: giảm thêm 12% (R-5: đo bằng đòn 10 và 20)
      A = mk(); const src = { id: 1, x: A.p.x + 2, y: A.p.y, z: A.p.z };
      const h0 = A.p.hp; A.g.hurtPlayer(A.p, 10, src); out.noTough10 = h0 - A.p.hp;
      giveHeld(A.g, A.p, 'egg_cake'); A.g.act('u1', { t: 'use' });
      const h2 = A.p.hp; A.g.hurtPlayer(A.p, 10, src); out.tough10 = h2 - A.p.hp; const h3 = A.p.hp; A.g.hurtPlayer(A.p, 20, src); out.tough20 = h3 - A.p.hp;
      out.toughView = view(A.p, 'tough');
      // chết thì xoá hết hiệu ứng
      A.g.hurtPlayer(A.p, 1e9, null); out.afterDeath = A.p.fxView.length; out.fxObj = Object.keys(A.p.fx).length;
      return out;
    """)
    assert 21 <= r['regen'] <= 23, r
    assert r['plain'] == 6 and r['power'] == 8, r
    assert 58 <= r['left60'] <= 61 and r['leftAgain'] == 120, r
    assert r['noTough10'] == 10 and r['tough10'] == 9 and r['tough20'] == 18 and r['toughView'] >= 119 and r['afterDeath'] == 0 and r['fxObj'] == 0, r


@test
def test_survival_till(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p, cx, cz, y0 } = F; const out = {};
      F.stand(-2, 0); giveHeld(g, p, 'stick'); out.noHoe = g.act('u1', { t: 'till', ...F.at(-2, 0) }).reason;
      out.tillGrass = F.till(-2, 0).ok; out.dryId = F.id(-2, 0); out.farmEntry = g.farm.has(F.key(-2, 0, 0));
      out.tillWet = F.till(2, 0).ok; out.wetId = F.id(2, 0);                                      // cạnh nước (cách 1-2 block)
      out.again = F.till(-2, 0).reason;                                                              // đã là ruộng
      for (const [nm, id, dx] of [['dirt', 2, -4], ['mud', 26, -5], ['moss', 25, -6]]) { g.world.set(cx + dx, y0, cz + 2, id); out[nm] = F.till(dx, 2).ok && F.id(dx, 2) >= 40; }
      g.world.set(cx - 7, y0, cz + 4, 1); out.stone = F.till(-7, 4).reason;
      g.world.set(cx - 8, y0 + 1, cz + 6, 8); out.roof = F.till(-8, 6).reason;                       // phía trên có block đặc
      g.world.set(cx - 9, y0 + 1, cz - 4, B.TALL_GRASS); out.grassOk = F.till(-9, -4).ok; out.grassGone = F.id(-9, -4, 1);
      F.stand(0, 0); giveHeld(g, p, 'wood_hoe'); out.far = g.act('u1', { t: 'till', x: cx + 30, y: y0, z: cz }).reason;
      out.bad = g.act('u1', { t: 'till', x: 'a' }).reason;
      // ba bậc cuốc chế được đúng công thức
      const mkInv = (items) => { const v = inv.makeInventory(); for (const [k, n] of Object.entries(items)) inv.addItem(v, k, n); return v; };
      const w = mkInv({ planks: 2, stick: 2 }); out.woodAtBench = canCraft(w, 'wood_hoe', { workbench: true }); out.woodNoBench = canCraft(w, 'wood_hoe', {});
      craft(w, 'wood_hoe', { workbench: true }); out.hasWood = inv.countItem(w, 'wood_hoe'); out.leftPlanks = inv.countItem(w, 'planks');
      const s = mkInv({ stone: 2, stick: 2 }); out.stoneOk = craft(s, 'stone_hoe', { workbench: true }) && inv.countItem(s, 'stone_hoe') === 1;
      const i = mkInv({ iron_ingot: 2, stick: 2 }); out.ironNoAnvil = canCraft(i, 'iron_hoe', { workbench: true }); out.ironOk = craft(i, 'iron_hoe', { anvil: true }) && inv.countItem(i, 'iron_hoe') === 1;
      const { ITEMS } = await imp('content/items.js'); out.dmg = ['wood_hoe', 'stone_hoe', 'iron_hoe'].map(k => ITEMS[k].dmg);
      return out;
    """)
    assert r['noHoe'] == 'not-hoe' and r['tillGrass'] and r['dryId'] == 40 and r['farmEntry'] and r['tillWet'] and r['wetId'] == 41, r
    assert r['again'] == 'not-soil' and r['dirt'] and r['mud'] and r['moss'] and r['stone'] == 'not-soil' and r['roof'] == 'blocked', r
    assert r['grassOk'] and r['grassGone'] == 0, r
    assert r['far'] == 'reach' and r['bad'] == 'bad-args', r
    assert r['woodAtBench'] and not r['woodNoBench'] and r['hasWood'] == 1 and r['leftPlanks'] == 0 and r['stoneOk'] and not r['ironNoAnvil'] and r['ironOk'] and r['dmg'] == [1, 2, 3], r


@test
def test_survival_farmland_wetness(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p, cx, cz, y0 } = F; const out = {};
      F.till(-1, 0); F.till(-2, 0); F.till(10, 5);
      out.near = F.id(-1, 0); out.dry = F.id(-2, 0); out.far = F.id(10, 5);                          // nước ở +3: ±4 ngang -> dx = -1 ướt, -2 khô
      F.stand(0, 0); g.setBlock(cx - 4, y0, cz, B.WATER);                                              // đặt nước cạnh ruộng khô
      runBig(g, 5, 0.5); out.afterPlace = F.id(-2, 0);
      g.setBlock(cx - 4, y0, cz, B.AIR); runBig(g, 5, 0.5); out.afterRemove = F.id(-2, 0);             // bỏ nước: khô lại
      g.setBlock(cx + 10 + 2, y0 - 1, cz + 5, B.WATER);                                               // nước thấp hơn mặt ruộng 1 block vẫn tính
      runBig(g, 5, 0.5); out.lower = F.id(10, 5);
      g.setBlock(cx + 10 + 2, y0 + 1, cz + 5, B.WATER); g.setBlock(cx + 10 + 2, y0 - 1, cz + 5, B.AIR); runBig(g, 5, 0.5); out.higher = F.id(10, 5);   // nước cao hơn ruộng không tính
      return out;
    """)
    assert (r['near'], r['dry'], r['far']) == (41, 40, 40), r
    assert r['afterPlace'] == 41 and r['afterRemove'] == 40 and r['lower'] == 41 and r['higher'] == 40, r


@test
def test_survival_farmland_revert(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p } = F; const out = {};
      F.till(-8, 3); F.till(-9, 3); F.plant(-9, 3);
      runBig(g, 295, 0.5); out.at295 = F.id(-8, 3);
      runBig(g, 10, 0.5); out.at305 = F.id(-8, 3); out.entry = g.farm.has(F.key(-8, 3, 0));
      runBig(g, 400, 0.5); out.planted = F.id(-9, 3);                                                // có cây thì ruộng không về dirt
      F.till(-10, 3); g.tick(1); out.free = F.id(-10, 3);
      return out;
    """)
    assert r['at295'] == 40 and r['at305'] == 2 and not r['entry'] and r['planted'] == 40 and r['free'] == 40, r


@test
def test_survival_crop_growth(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p, cx } = F; g.world.regionAt = (x, z) => (x >= cx + 15 ? 'nui-bang' : 'rung-suong');
      const spots = { wheatDry: [-8, 0, 'wheat'], wheatWet: [-1, 0, 'wheat'], carrotDry: [-8, 2, 'carrot'], potatoDry: [-8, 4, 'potato'], carrotWet: [-1, 2, 'carrot'], potatoWet: [-1, 4, 'potato'], wheatCold: [16, 0, 'wheat'] };
      for (const [dx, dz, kind] of Object.values(spots)) { F.till(dx, dz); F.plant(dx, dz, CROPS[kind].seed); }
      const at = {}; for (const k of Object.keys(spots)) at[k] = [null, null, null, null];
      const wetBefore = Object.fromEntries(Object.entries(spots).map(([k, [dx, dz]]) => [k, F.id(dx, dz)]));
      for (let t = 0.5; t <= 721; t += 0.5) {
        g.tick(0.5);
        for (const [k, [dx, dz, kind]] of Object.entries(spots)) { const c = cropOf(F.id(dx, dz, 1)); if (c) for (let s = 1; s <= 3; s++) if (c.stage >= s && at[k][s] === null) at[k][s] = t; }
      }
      return { at, wetBefore };
    """)
    exp = {'wheatDry': 120, 'wheatWet': 60, 'carrotDry': 100, 'potatoDry': 140, 'carrotWet': 50, 'potatoWet': 70, 'wheatCold': 240}
    for k, base in exp.items():
        for s in (1, 2, 3):
            got = r['at'][k][s]
            assert got is not None and abs(got - base * s) <= 5, (k, s, got, base * s, r['at'])
    assert r['wetBefore']['wheatWet'] == 41 and r['wetBefore']['wheatDry'] == 40, r


@test
def test_survival_crop_chunk_sim(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p, cx } = F; p.hp = p.maxHp = 1e9; const out = {};
      F.till(-8, 0); F.plant(-8, 0); const e = g.crops.get(F.key(-8, 0));
      p.x += 200; runBig(g, 1000, 1);                                                                    // người chơi đi xa: cây đóng băng
      out.farId = F.id(-8, 0, 1); out.farG = e.g;
      p.x -= 200; runBig(g, 125, 0.5); out.backId = F.id(-8, 0, 1); out.backG = e.g;                     // quay lại: tiếp tục từ tiến trình cũ
      runBig(g, 120, 0.5); out.id2 = F.id(-8, 0, 1);
      // người chơi chết: cây cũng không lớn
      g.hurtPlayer(p, 1e9, null); const g0 = e.g; runBig(g, 50, 0.5); out.deadDelta = e.g - g0;
      return out;
    """)
    assert r['farId'] == 42 and r['farG'] == 0 and r['backId'] == 43 and 124 <= r['backG'] <= 126 and r['id2'] == 44 and r['deadDelta'] == 0, r


@test
def test_survival_plant_rules(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p, cx, cz, y0 } = F; const out = {};
      F.till(-2, 0); F.till(-2, 2); F.till(-2, 4); F.till(-2, -2);
      out.ok = F.plant(-2, 0).ok; out.block = F.id(-2, 0, 1); out.left = count(p, 'wheat_seed'); out.entry = (g.crops.get(F.key(-2, 0)) || {}).k;
      const again = F.plant(-2, 0); out.occupied = again.reason; out.leftAgain = count(p, 'wheat_seed');
      g.world.set(cx + 4, y0, cz + 2, 2); out.dirt = F.plant(4, 2).reason; out.dirtLeft = count(p, 'wheat_seed');
      F.stand(6, 6); out.grass = g.act('u1', { t: 'plant', ...F.at(6, 6) }).reason;
      F.stand(-2, 2); giveHeld(g, p, 'stick'); out.notSeed = g.act('u1', { t: 'plant', ...F.at(-2, 2) }).reason;
      F.stand(-2, 2); giveHeld(g, p, 'wheat_seed', 2); p.x += 15; out.reach = g.act('u1', { t: 'plant', ...F.at(-2, 2) }).reason; out.reachLeft = count(p, 'wheat_seed');
      out.carrot = F.plant(-2, 2, 'carrot').ok && F.id(-2, 2, 1) === 46; out.potato = F.plant(-2, 4, 'potato').ok && F.id(-2, 4, 1) === 50;
      // phá block dưới cây: cây biến mất, rơi 1 hạt
      for (const e of [...g.ents.values()]) if (e.kind === 'item') g.ents.delete(e.id);
      F.stand(-2, 0); p.inv.fill(null); const r1 = F.dig(cx - 2, y0, cz);
      const seeds = [...g.ents.values()].filter(e => e.kind === 'item' && e.item === 'wheat_seed').map(e => e.n);
      out.brokeBelow = { ok: r1.ok, crop: g.world.get(cx - 2, y0 + 1, cz), entry: g.crops.has(F.key(-2, 0)), seeds };
      // đặt block lên mặt ruộng trống: ruộng thành dirt rồi đặt
      F.till(-2, -2 + 0); g.farm.size; F.stand(-2, -2); giveHeld(g, p, 'planks', 3);
      out.placeOnField = g.act('u1', { t: 'place', ...F.at(-2, -2, 1) }).ok; out.under = F.id(-2, -2, 0); out.placed = F.id(-2, -2, 1);
      F.stand(-2, 2); giveHeld(g, p, 'planks', 3); out.placeOnCrop = g.act('u1', { t: 'place', ...F.at(-2, 2, 1) }).reason;
      return out;
    """)
    assert r['ok'] and r['block'] == 42 and r['left'] == 4 and r['entry'] == 'wheat', r
    assert r['occupied'] == 'blocked' and r['leftAgain'] == 5 and r['dirt'] == 'not-farmland' and r['dirtLeft'] == 5 and r['grass'] == 'not-farmland' and r['notSeed'] == 'not-seed', r
    assert r['reach'] == 'reach' and r['reachLeft'] == 2 and r['carrot'] and r['potato'], r
    assert r['brokeBelow']['ok'] and r['brokeBelow']['crop'] == 0 and not r['brokeBelow']['entry'] and r['brokeBelow']['seeds'] == [1], r
    assert r['placeOnField'] and r['under'] == 2 and r['placed'] == 8 and r['placeOnCrop'] == 'occupied', r


@test
def test_survival_harvest(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p, cx, cz, y0 } = F; const out = {};
      F.till(-2, 0); F.till(-2, 2); F.till(-2, 4);
      // đào cây chín bằng tay: 200 mẫu, sản lượng nằm trong khoảng ở bảng 4.5 (min và max đều xuất hiện)
      const stat = (kind, dz, ripe, how) => {
        const seed = CROPS[kind].seed, rows = [];
        for (let i = 0; i < 200; i++) {
          F.plant(-2, dz, seed); if (ripe) F.ripe(-2, dz, kind);
          p.inv.fill(null); p.sel = 0;
          if (how === 'break') F.dig(cx - 2, y0 + 1, cz + dz); else g.act('u1', { t: 'harvest', ...F.at(-2, dz, 1) });
          rows.push({ main: count(p, kind === 'wheat' ? 'wheat' : kind), seed: count(p, seed), id: F.id(-2, dz, 1) });
          if (how === 'harvest') { const c = g.crops.get(F.key(-2, dz)); if (!c || c.s !== 0 || c.g !== 0) rows.push('bad'); g.setBlock(cx - 2, y0 + 1, cz + dz, B.AIR); }
        }
        const r = (f) => [Math.min(...rows.filter(x => x !== 'bad').map(f)), Math.max(...rows.filter(x => x !== 'bad').map(f))];
        return { main: r(x => x.main), seed: r(x => x.seed), bad: rows.includes('bad'), idAfter: rows[0].id };
      };
      out.wheatBreak = stat('wheat', 0, true, 'break'); out.carrotBreak = stat('carrot', 2, true, 'break'); out.potatoBreak = stat('potato', 4, true, 'break');
      out.wheatRight = stat('wheat', 0, true, 'harvest'); out.carrotRight = stat('carrot', 2, true, 'harvest'); out.potatoRight = stat('potato', 4, true, 'harvest');
      // chưa chín: phá chỉ nhận lại 1 hạt, bấm phải bị từ chối
      F.plant(-2, 0); const un = g.act('u1', { t: 'harvest', ...F.at(-2, 0, 1) }); p.inv.fill(null); F.dig(cx - 2, y0 + 1, cz); out.unripe = { reason: un.reason, seed: count(p, 'wheat_seed'), wheat: count(p, 'wheat') };
      out.notCrop = g.act('u1', { t: 'harvest', ...F.at(-2, 2, 0) }).reason;
      // bấm phải: cây về giai đoạn 0 ngay (id 42), tự gieo lại
      F.plant(-2, 0); F.ripe(-2, 0); p.inv.fill(null); const h1 = g.act('u1', { t: 'harvest', ...F.at(-2, 0, 1) }); out.afterRight = F.id(-2, 0, 1); out.entryAfter = g.crops.get(F.key(-2, 0)).s;
      // hai người cùng bấm một cây chín trong cùng tick: chỉ một người nhận
      const q = g.addPlayer('u2', 'Q'); q.x = p.x + 1; q.z = p.z; q.y = p.y; q.inv.fill(null);
      F.ripe(-2, 0); p.inv.fill(null);
      const a = g.act('u1', { t: 'harvest', ...F.at(-2, 0, 1) }), b = g.act('u2', { t: 'harvest', ...F.at(-2, 0, 1) });
      out.race = [a.ok, b.ok, b.reason, count(q, 'wheat') + count(q, 'wheat_seed')];
      // xa tầm; kho đầy thì phần dư rơi xuống đất
      F.ripe(-2, 0); p.x += 20; out.reach = g.act('u1', { t: 'harvest', ...F.at(-2, 0, 1) }).reason; p.x -= 20;
      for (let i = 0; i < p.inv.length; i++) p.inv[i] = { id: 'stone', n: 64 }; const full = g.act('u1', { t: 'harvest', ...F.at(-2, 0, 1) });
      out.full = full.ok && [...g.ents.values()].some(e => e.kind === 'item' && e.item === 'wheat');
      return out;
    """)
    assert r['wheatBreak']['main'] == [1, 2] and r['wheatBreak']['seed'] == [1, 3] and r['carrotBreak']['main'] == [2, 4] and r['potatoBreak']['main'] == [2, 3], r
    assert r['wheatRight']['main'] == [1, 2] and r['wheatRight']['seed'] == [0, 2] and r['carrotRight']['main'] == [1, 3] and r['potatoRight']['main'] == [1, 2], r
    assert not r['wheatRight']['bad'] and not r['carrotRight']['bad'], r
    assert r['unripe'] == {'reason': 'unripe', 'seed': 1, 'wheat': 0} and r['notCrop'] == 'not-crop', r
    assert r['afterRight'] == 42 and r['entryAfter'] == 0 and r['race'][:3] == [True, False, 'unripe'] and r['race'][3] == 0 and r['reach'] == 'reach' and r['full'], r


@test
def test_survival_seed_sources(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p, cx, cz, y0 } = F; fixRng(g, 4242); F.stand(0, 0);
      let seeds = 0; const real = g.collect.bind(g); g.collect = (pl, id, n, ...rest) => { if (id === 'wheat_seed') seeds += n; };
      for (let i = 0; i < 2000; i++) { g.world.set(cx + 1, y0 + 1, cz, B.TALL_GRASS); p.dig = { x: cx + 1, y: y0 + 1, z: cz, t0: g.time - 5 }; g.act('u1', { t: 'break', x: cx + 1, y: y0 + 1, z: cz }); }
      g.collect = real;
      const drops = {}; g.dropItem = (id, n) => { drops[id] = (drops[id] || 0) + 1; };
      for (let i = 0; i < 2000; i++) combat.dropLoot(g, { kind: 'mob', type: 'xac-song', x: cx, y: y0 + 1, z: cz });
      return { seeds: seeds / 2000, carrot: (drops.carrot || 0) / 2000, potato: (drops.potato || 0) / 2000 };
    """)
    assert 0.10 <= r['seeds'] <= 0.14 and 0.06 <= r['carrot'] <= 0.10 and 0.06 <= r['potato'] <= 0.10, r


@test
def test_survival_animal_tame_ai(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm({ hunger: false }); const { g, p, cx, cz, y0 } = F; const out = {};
      F.stand(0, 0); const e = F.animal('lon', 0, 0); e.x = p.x; e.z = p.z - 2;                  // heo hoang cách người chơi 2 block
      giveHeld(g, p, 'carrot', 3); const ok = g.act('u1', { t: 'feed', id: e.id });
      out.feed = { ok: ok.ok, tamed: !!e.tamed, love: e.love, persist: !!e.persist, left: count(p, 'carrot'), home: !!e.home };
      // thức ăn sai: không đổi gì, không trừ
      const sheep = F.animal('cuu', 0, 0); sheep.x = p.x + 1.5; sheep.z = p.z; const wrong = g.act('u1', { t: 'feed', id: sheep.id });
      out.wrong = { reason: wrong.reason, tamed: !!sheep.tamed, left: count(p, 'carrot') };
      // ngoài 3 block
      const far = F.animal('lon', 0, 0); far.x = p.x + 6; far.z = p.z; const rr = g.act('u1', { t: 'feed', id: far.id });
      out.reach = { reason: rr.reason, tamed: !!far.tamed, left: count(p, 'carrot') };
      out.noTarget = g.act('u1', { t: 'feed', id: 99999 }).reason;
      // thú hoang bỏ chạy khi người chơi đến sát; thú đã thuần thì không, và quanh quẩn gần chuồng
      const wild = F.animal('lon', 0, 0); wild.x = p.x + 2.5; wild.z = p.z + 2.5; const wx = wild.x, wz = wild.z;
      const tame = F.animal('lon', 0, 0, { persist: true, tamed: true }); tame.x = p.x - 2.5; tame.z = p.z + 2.5; const hx = tame.x, hz = tame.z; tame.home = { x: hx, y: tame.y, z: hz };
      giveHeld(g, p, 'stick'); let maxHome = 0;                                                    // không cầm thức ăn: thú thuần quanh quẩn gần chuồng
      for (let t = 0; t < 20; t += 0.05) { g.tick(0.05); maxHome = Math.max(maxHome, Math.hypot(tame.x - tame.home.x, tame.z - tame.home.z)); if (Math.abs(t - 6) < 0.03) out.wildAt6 = Math.hypot(wild.x - p.x, wild.z - p.z); if (Math.abs(t - 6) < 0.03) out.tameAt6 = Math.hypot(tame.x - p.x, tame.z - p.z); }
      out.maxHome = maxHome; out.states = [wild.state, tame.state]; out.tameMoved = Math.hypot(tame.x - hx, tame.z - hz);
      // quái thù địch không nhắm vào thú: đánh thú đã thuần gây sát thương bình thường, không làm nó bỏ chạy
      const hp0 = tame.hp; giveHeld(g, p, 'iron_sword'); tame.x = p.x + 1.5; tame.z = p.z; g.tick(0.6); g.act('u1', { t: 'hit', id: tame.id }); out.hit = [hp0 - tame.hp, tame.state !== 'chase'];
      return out;
    """)
    assert r['feed'] == {'ok': True, 'tamed': True, 'love': 30, 'persist': True, 'left': 2, 'home': True}, r
    assert r['wrong'] == {'reason': 'not-food', 'tamed': False, 'left': 2} and r['reach'] == {'reason': 'reach', 'tamed': False, 'left': 2} and r['noTarget'] == 'no-target', r
    assert r['wildAt6'] > 8, r                                       # thú hoang đã chạy xa
    assert r['maxHome'] <= 11.5 and r['tameAt6'] < 8 and r['tameMoved'] <= 11.5, r
    assert r['hit'] == [6, True], r


@test
def test_survival_animal_follow(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm({ hunger: false }); const { g, p } = F; F.stand(0, 0); const out = {};
      const e = F.animal('lon', 0, 0, { persist: true, tamed: true }); e.x = p.x; e.z = p.z - 6; e.home = { x: e.x, y: e.y, z: e.z };
      giveHeld(g, p, 'carrot'); for (let t = 0; t < 10; t += 0.05) g.tick(0.05);
      out.dist = Math.hypot(e.x - p.x, e.z - p.z); out.following = e.following;
      giveHeld(g, p, 'stick'); g.tick(0.1); out.after = e.following;
      // hai người: đi theo người cầm thức ăn (kể cả người xa hơn), không theo người cầm vật khác
      const q = g.addPlayer('u2', 'Q'); q.x = p.x + 30; q.z = p.z; q.y = p.y; g.touch(q);
      const e2 = F.animal('cuu', 0, 0, { persist: true, tamed: true }); e2.x = q.x; e2.z = q.z - 6; e2.home = { x: e2.x, y: e2.y, z: e2.z };
      q.inv.fill(null); q.inv[0] = { id: 'wheat', n: 1 }; q.sel = 0; for (let t = 0; t < 10; t += 0.05) g.tick(0.05);
      out.dist2 = Math.hypot(e2.x - q.x, e2.z - q.z);
      return out;
    """)
    assert r['dist'] <= 3 and r['following'] is True and r['after'] is False and r['dist2'] <= 3, r


@test
def test_survival_animal_breed_grow(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm({ hunger: false }); const { g, p } = F; F.stand(0, 0); const out = {};
      const mk = (dx) => { const e = F.animal('lon', 0, 0, { persist: true, tamed: true }); e.x = p.x + dx; e.z = p.z - 2; e.home = { x: e.x, y: e.y, z: e.z }; return e; };
      const a = mk(-1.5), b = mk(1.5); giveHeld(g, p, 'carrot', 4);
      const f1 = g.act('u1', { t: 'feed', id: a.id }), f2 = g.act('u1', { t: 'feed', id: b.id });
      out.fed = [f1.ok, f2.ok, a.love, b.love, count(p, 'carrot')];
      const babies = () => [...g.ents.values()].filter(e => e.type === 'lon' && e.age < 300);
      let tBirth = null; const t0 = g.time;
      for (let t = 0; t < 12 && tBirth === null; t += 0.25) { g.tick(0.25); if (babies().length) tBirth = g.time - t0; }
      out.birth = tBirth; out.babies = babies().length; out.love = [a.love, b.love]; out.cd = [a.breedCd, b.breedCd];
      const baby = babies()[0]; out.size = baby ? [baby.w, baby.h] : null; out.adultSize = [a.w, a.h]; out.persist = baby && baby.persist && baby.tamed;
      const refeed = g.act('u1', { t: 'feed', id: a.id }); out.refeed = [refeed.ok, refeed.reason, count(p, 'carrot')];      // đang hồi chiêu: từ chối, không trừ
      g.tick(7); out.stillOne = babies().length;                                                         // không đẻ thêm
      baby.x = p.x; baby.z = p.z - 2; const ageA = baby.age;
      runBig(g, 100, 0.5); out.grew = baby.age - ageA;
      baby.x = p.x; baby.z = p.z - 2; const age1 = baby.age; const fb = g.act('u1', { t: 'feed', id: baby.id }); out.babyFeed = [fb.ok, baby.age - age1, count(p, 'carrot')];       // con non: rút ngắn 30 giây
      const need = 300 - baby.age; runBig(g, need - 4, 0.5); out.babyBefore = [baby.age < 300, baby.w === out.size[0]]; runBig(g, 8, 0.5); out.babyAfter = [baby.age >= 300, baby.w === out.adultSize[0]];
      runBig(g, 70, 0.5); a.x = p.x - 1.5; a.z = p.z - 2; const again = g.act('u1', { t: 'feed', id: a.id }); out.again = [again.ok, a.love, a.breedCd];     // hết hồi chiêu 240 giây
    return out;
    """)
    assert r['fed'] == [True, True, 30, 30, 2], r
    assert r['birth'] is not None and 5 <= r['birth'] <= 7.6 and r['babies'] == 1 and r['love'] == [0, 0] and all(230 <= c <= 240 for c in r['cd']), r
    assert r['size'] == [r['adultSize'][0] * 0.5, r['adultSize'][1] * 0.5] and r['persist'], r
    assert r['refeed'][:2] == [False, 'busy'] and r['refeed'][2] == 2 and r['stillOne'] == 1, r
    assert 99 <= r['grew'] <= 101 and r['babyFeed'] == [True, 30, 1], r
    assert r['babyBefore'] == [True, True] and r['babyAfter'] == [True, True], r                  # lớn đúng mốc (300 - 30 giây boost), cỡ về đầy đủ
    assert r['again'][0] is True and r['again'][1] == 30, r


@test
def test_survival_animal_products(pg):
    r = ev(pg, FARM_JS + r"""
      const out = {};
      // trứng: 20 gà đã thuần được cho ăn, đẻ đúng một quả trong 150-210 giây; gà không được cho ăn thì không đẻ
      { const F = mkFarm({ hunger: false }); const { g, p, cx, cz, y0 } = F; p.hp = p.maxHp = 1e9; p.x = cx - 30;                 // người chơi đứng xa để không nhặt trứng
        const eggs = [], real = g.dropItem.bind(g); g.dropItem = (id, n, x, y, z) => { if (id === 'egg') eggs.push({ t: g.time, x, z }); return real(id, n, x, y, z); };
        const fed = [], hungry = [];
        for (let i = 0; i < 20; i++) { const e = F.animal('ga', -15 + (i % 10) * 3, -12 + Math.floor(i / 10) * 3, { persist: true, tamed: true }); e.fed = 300; e.frozen = true; fed.push(e); }
        for (let i = 0; i < 5; i++) { const e = F.animal('ga', -15 + i * 3, 12, { persist: true, tamed: true }); e.fed = 0; e.frozen = true; hungry.push(e); }
        for (let t = 0; t < 400; t += 0.5) g.tick(0.5);
        const first = eggs.filter(e => e.t < 250).map(e => e.t);
        out.eggs = { n: first.length, min: Math.min(...first), max: Math.max(...first), late: eggs.filter(e => e.t > 302).length, hungry: eggs.filter(e => e.z > cz + 8).length, total: eggs.length };
        out.hungryDrops = hungry.map(e => e.prodCd);
        const baby = F.animal('ga', 0, 0, { persist: true, tamed: true }); baby.age = 10; baby.fed = 300; baby.frozen = true; const n0 = eggs.length; runBig(g, 300, 0.5); out.babyLaid = eggs.length - n0; }
      // len: kéo cắt 1-3 len, cừu trọc không cắt được, mọc lại sau 240 giây; tay không / cừu non bị từ chối
      { const F = mkFarm({ hunger: false }); const { g, p } = F; F.stand(0, 0); const e = F.animal('cuu', 0, 0, { persist: true, tamed: true }); e.x = p.x + 1; e.z = p.z - 1.5; e.frozen = true;
        giveHeld(g, p, 'stick'); out.hand = g.act('u1', { t: 'shear', id: e.id }).reason;
        const wool = new Set();
        for (let i = 0; i < 60; i++) { e.shearCd = 0; p.inv.fill(null); p.inv[0] = { id: 'shears', n: 1 }; p.sel = 0; const r1 = g.act('u1', { t: 'shear', id: e.id }); if (!r1.ok) wool.add('x'); wool.add(count(p, 'wool')); }
        out.wool = [...wool].sort(); out.cd = e.shearCd;
        const again = g.act('u1', { t: 'shear', id: e.id }); out.sheared = again.reason;
        runBig(g, 235, 0.5); out.at235 = g.act('u1', { t: 'shear', id: e.id }).reason; runBig(g, 10, 0.5); out.at245 = g.act('u1', { t: 'shear', id: e.id }).ok;
        const young = F.animal('cuu', 0, 0, { persist: true, tamed: true }); young.age = 20; young.x = p.x - 1; young.z = p.z - 1.5; young.frozen = true; out.young = g.act('u1', { t: 'shear', id: young.id }).reason;
        const pig = F.animal('lon', 0, 0); out.pigShear = g.act('u1', { t: 'shear', id: pig.id }).reason;
        // cừu trọc chết không rơi len; cừu còn len rơi len; lợn rơi 1-3 thịt lợn
        const drops = []; const real = g.dropItem.bind(g); g.dropItem = (id, n) => { drops.push(id); return real(id, n, 0, 0, 0); };
        const s1 = F.animal('cuu', 0, 0); s1.shearCd = 100; combat.dropLoot(g, s1); out.shornWool = drops.filter(d => d === 'wool').length;
        const s2 = F.animal('cuu', 0, 0); drops.length = 0; combat.dropLoot(g, s2); out.woolyWool = drops.filter(d => d === 'wool').length;
        const porks = new Set(); for (let i = 0; i < 100; i++) { const q = F.animal('lon', 0, 0); const before = [...g.ents.values()].filter(x => x.kind === 'item').length; drops.length = 0; g.ents.get(q.id).hp = 1; g.damageEntity(q, 99, p); }
        const ents = [...g.ents.values()].filter(x => x.kind === 'item' && x.item === 'pork').map(x => x.n); out.pork = [Math.min(...ents), Math.max(...ents)]; }
      return out;
    """)
    e = r['eggs']
    assert e['n'] == 20 and 149 <= e['min'] and e['max'] <= 212 and e['late'] == 0, r
    assert e['hungry'] == 0 and all(v is None for v in r['hungryDrops']) and r['babyLaid'] == 0, r
    assert r['hand'] == 'not-shears' and r['wool'] == [1, 2, 3], r
    assert r['cd'] == 240 and r['sheared'] == 'sheared' and r['at235'] == 'sheared' and r['at245'] is True and r['young'] == 'young' and r['pigShear'] == 'no-target', r
    assert r['shornWool'] == 0 and r['woolyWool'] == 1 and r['pork'] == [1, 3], r


@test
def test_survival_animal_caps(pg):
    r = ev(pg, FARM_JS + r"""
      const out = {};
      { const F = mkFarm({ hunger: false }); const { g, p, cx, cz, y0 } = F; F.stand(0, 0);
        for (let i = 0; i < 24; i++) { const e = F.animal('lon', -15 + (i % 8) * 4, -12 + Math.floor(i / 8) * 4, { persist: true, tamed: true }); e.frozen = true; }
        out.count = animals.tameCount(g);
        const wild = F.animal('ga', 0, 0); wild.x = p.x + 1; wild.z = p.z - 1; giveHeld(g, p, 'wheat_seed', 3); const r1 = g.act('u1', { t: 'feed', id: wild.id });
        out.wild = [r1.ok, r1.reason, !!wild.tamed, count(p, 'wheat_seed')];
        const old = [...g.ents.values()].find(e => e.persist); old.x = p.x - 1; old.z = p.z - 1; giveHeld(g, p, 'carrot', 3); const r2 = g.act('u1', { t: 'feed', id: old.id });
        out.breed = [r2.ok, r2.reason, old.love || 0, count(p, 'carrot')]; }
      // thú nuôi không tính vào trần quái, không bị xoá khi đi xa, đóng băng khi ngoài tầm mô phỏng
      { const F = mkFarm({ hunger: false, spawning: true }); const { g, p, cx, cz, y0 } = F; p.hp = p.maxHp = 1e9; g.world.regionAt = () => 'rung-suong'; g.time = 60;
        const pigs = []; for (let i = 0; i < 30; i++) { const e = F.animal('lon', -15 + (i % 10) * 3, -12 + Math.floor(i / 10) * 3, { persist: true, tamed: true }); pigs.push(e); }
        const pos0 = pigs.map(e => [e.x, e.z]);
        for (let t = 0; t < 120; t += 0.5) { g.tick(0.5); p.hp = 1e9; }
        const mobs = [...g.ents.values()].filter(e => e.kind === 'mob'); out.wildN = mobs.filter(e => !e.persist).length; out.persist = mobs.filter(e => e.persist).length;
        out.total = mobs.length;
        p.x += 200; for (let t = 0; t < 3; t += 0.5) { g.tick(0.5); p.hp = 1e9; }
        const before = pigs.map(e => [e.x, e.z]);
        for (let t = 0; t < 30; t += 0.5) { g.tick(0.5); p.hp = 1e9; }
        out.afterFar = { persist: [...g.ents.values()].filter(e => e.persist).length, dormant: pigs.filter(e => e.dormant).length, frozen: pigs.every((e, i) => e.x === before[i][0] && e.z === before[i][1]),
          oldWild: [...g.ents.values()].filter(e => e.kind === 'mob' && !e.persist && Math.hypot(e.x - (cx + 0.5), e.z - (cz + 0.5)) < 100).length };
        p.x -= 200; g.tick(2); out.back = { persist: [...g.ents.values()].filter(e => e.persist).length, awake: pigs.filter(e => !e.dormant).length }; }
      return out;
    """)
    assert r['count'] == 24 and r['wild'][:3] == [False, 'cap', False] and r['wild'][3] == 3, r
    assert r['breed'] == [False, 'cap', 0, 3], r
    assert r['wildN'] >= 1 and r['persist'] == 30 and r['total'] > 30, r
    assert r['afterFar']['persist'] == 30 and r['afterFar']['dormant'] == 30 and r['afterFar']['frozen'] and r['afterFar']['oldWild'] == 0, r
    assert r['back']['persist'] == 30 and r['back']['awake'] == 30, r


@test
def test_survival_cooking_recipes(pg):
    r = ev(pg, FARM_JS + r"""
      const T = [['bread', { wheat: 3, charcoal: 1 }, 'furnace'], ['baked_potato', { potato: 1, charcoal: 1 }, 'furnace'], ['cooked_pork', { pork: 1, charcoal: 1 }, 'furnace'],
        ['cooked_chicken', { chicken: 1, charcoal: 1 }, 'furnace'], ['veg_soup', { carrot: 2, potato: 1, herb: 1 }, 'furnace'], ['hearty_stew', { pork: 1, potato: 1, carrot: 1, charcoal: 1 }, 'furnace'],
        ['egg_cake', { egg: 2, wheat: 2, charcoal: 1 }, 'furnace'], ['wood_hoe', { planks: 2, stick: 2 }, 'workbench'], ['stone_hoe', { stone: 2, stick: 2 }, 'workbench'],
        ['iron_hoe', { iron_ingot: 2, stick: 2 }, 'anvil'], ['shears', { iron_ingot: 2 }, 'anvil'], ['bed_wool', { planks: 3, wool: 3 }, 'workbench']];
      const { recipeById } = await imp('sim/crafting.js'); const bad = [];
      for (const [id, need, st] of T) {
        const rc = recipeById(id); if (!rc) { bad.push([id, 'thiếu công thức']); continue; }
        const mk = () => { const v = inv.makeInventory(); for (const [k, n] of Object.entries(need)) inv.addItem(v, k, n); return v; };
        const none = canCraft(mk(), id, {}), other = ['workbench', 'furnace', 'anvil'].filter(s => s !== st).some(s => canCraft(mk(), id, { [s]: true }));
        const v = mk(); const ok = craft(v, id, { [st]: true });
        const out = rc.out.item, used = Object.entries(need).every(([k]) => inv.countItem(v, k) === 0);
        const short = mk(); const first = Object.keys(need)[0]; inv.removeItem(short, first, 1); const lacks = canCraft(short, id, { [st]: true });
        if (none || other || !ok || inv.countItem(v, out) !== rc.out.n || !used || lacks) bad.push([id, { none, other, ok, got: inv.countItem(v, out), used, lacks }]);
      }
      const { ITEMS } = await imp('content/items.js');
      return { bad, bedOut: recipeById('bed_wool').out.item, soupFx: ITEMS.veg_soup.fx, stewFx: ITEMS.hearty_stew.fx, cakeFx: ITEMS.egg_cake.fx, count: T.length };
    """)
    assert r['bad'] == [] and r['bedOut'] == 'bed' and r['count'] == 12, r
    assert r['soupFx'] == {'id': 'regen', 'secs': 45} and r['stewFx'] == {'id': 'power', 'secs': 120} and r['cakeFx'] == {'id': 'tough', 'secs': 120}, r


@test
def test_survival_farm_shop_quest(pg):
    r = ev(pg, NPC_JS + r"""
      const { SHOPS } = await imp('content/shops.js');
      const { B, CROP_BLOCKS } = await imp('world/blocks.js');
      const inv = await imp('sim/inventory.js'); const { makeRng } = await imp('sim/rng.js');
      const out = {};
      const SELL = { wheat_seed: 4, carrot: 5, potato: 5, shears: 25, stone_hoe: 20 }, BUY = { wheat: 3, carrot: 2, potato: 2, egg: 3, wool: 6, bread: 8, cooked_pork: 9 };
      out.tables = Object.fromEntries(['truong-lang', 'thuong-nhan', 'ngu-dan'].map(id => [id, Object.entries(SELL).every(([k, v]) => (SHOPS[id].sells.find(x => x.item === k) || {}).price === v) && Object.entries(BUY).every(([k, v]) => (SHOPS[id].buys.find(x => x.item === k) || {}).price === v)]));
      const T = mkTown(); const { g, p } = T; g.rng = makeRng(99);
      const xu = () => inv.countItem(p.inv, 'xu');
      p.quests.done['chao-lang'] = true;
      // nhận nhiệm vụ qua hội thoại
      T.talk('truong-lang'); const jobs = T.say(0).v.find(e => e.t === 'dialog'); const jc = jobs.choices.find(c => c.text.includes('Vụ mùa'));
      T.say(jc.i); out.accepted = g.questState('u1', 'harvest-1');
      // bước 1: cuốc đất (chế ở bàn chế tạo đặt cạnh)
      const px = Math.floor(p.x), pz = Math.floor(p.z), fy = Math.floor(p.y) - 1;                       // mặt đất dưới chân
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) { g.world.set(px + dx, fy, pz + dz, B.GRASS); for (let dy = 1; dy <= 3; dy++) g.world.set(px + dx, fy + dy, pz + dz, 0); }
      const hold = (id) => { const i = p.inv.findIndex(s => s && s.id === id); [p.inv[0], p.inv[i]] = [p.inv[i], p.inv[0]]; p.sel = 0; };
      g.world.set(px + 2, fy + 1, pz + 1, B.WORKBENCH); g.world.set(px - 2, fy + 1, pz + 1, B.FURNACE);
      g.giveItem('u1', 'planks', 2); g.giveItem('u1', 'stick', 2); out.craftHoe = g.act('u1', { t: 'craft', id: 'wood_hoe' }).ok;
      out.step1 = g.questProgress('u1', 'harvest-1')[0].n;
      // mua hạt ở Kho làng
      T.talk('truong-lang'); const shopEv = T.say(3).v.find(e => e.t === 'shop'); out.shopSells = shopEv ? shopEv.sells.map(x => x.item) : [];
      g.giveItem('u1', 'xu', 40); const xu0 = xu(); out.buy = g.act('u1', { t: 'buy', item: 'wheat_seed', n: 8 }).ok; out.xuSpent = xu0 - xu();
      // cày, gieo 8 hạt, chờ chín, thu hoạch bằng bấm phải cho tới khi đủ 9 lúa mì
      const cells = []; for (let i = 0; i < 8; i++) cells.push({ x: px - 2 + (i % 4), y: fy, z: pz + 2 + Math.floor(i / 4) });
      hold('wood_hoe'); out.till = cells.every(c => g.act('u1', { t: 'till', ...c }).ok);
      hold('wheat_seed'); out.planted = cells.filter(c => g.act('u1', { t: 'plant', x: c.x, y: c.y, z: c.z }).ok).length;
      let rounds = 0;
      while (inv.countItem(p.inv, 'wheat') < 9 && rounds < 4) { for (let t = 0; t < 365; t++) g.tick(1); for (const c of cells) g.act('u1', { t: 'harvest', x: c.x, y: c.y + 1, z: c.z }); rounds++; p.x = px + 0.5; p.z = pz + 0.5; }
      out.wheat = inv.countItem(p.inv, 'wheat'); out.rounds = rounds; out.step2 = g.questProgress('u1', 'harvest-1')[1].n;
      // nấu bánh mì ở lò nung
      g.giveItem('u1', 'log', 1); out.charcoal = g.act('u1', { t: 'craft', id: 'charcoal' }).ok; out.bread = g.act('u1', { t: 'craft', id: 'bread' }).ok;
      out.state = g.questState('u1', 'harvest-1');
      // trả nhiệm vụ: 30 xu + 2 súp rau
      const xuBefore = xu(); T.talk('truong-lang'); const t = T.say(1); const tc = t.v.find(e => e.t === 'dialog').choices.find(c => c.text.includes('Vụ mùa')); T.say(tc.i);
      out.done = g.questState('u1', 'harvest-1'); out.reward = [xu() - xuBefore, inv.countItem(p.inv, 'veg_soup')];
      // bán nông sản (còn dư) cho thương nhân làng
      T.talk('truong-lang'); T.say(3); const wheat = inv.countItem(p.inv, 'wheat'), x1 = xu(); out.sold = g.act('u1', { t: 'sell', item: 'wheat', n: wheat }).ok; out.gain = xu() - x1 === wheat * 3;
      return out;
    """)
    assert all(r['tables'].values()), r
    assert r['accepted'] == 'active' and r['craftHoe'] and r['step1'] == 1 and 'wheat_seed' in r['shopSells'] and r['buy'] and r['xuSpent'] == 32, r
    assert r['till'] and r['planted'] == 8 and r['wheat'] >= 9 and r['step2'] == 6 and r['charcoal'] and r['bread'], r
    assert r['state'] == 'ready' and r['done'] == 'done' and r['reward'] == [30, 2] and r['sold'] and r['gain'], r


@test
def test_survival_save_load(pg):
    r = ev(pg, FARM_JS + r"""
      const S = await imp('save.js'); const GG = Game; const out = {};
      const F = mkFarm({ hunger: true }); const { g, p, cx, cz, y0 } = F; fixRng(g, 77);
      F.till(-8, 0); F.plant(-8, 0); F.till(-8, 2); F.plant(-8, 2, 'carrot'); F.till(-1, 4); F.plant(-1, 4, 'potato'); F.till(-6, 6);                  // ruộng trống -> bộ đếm về dirt
      runBig(g, 130, 0.5);
      F.stand(0, 0); const pig = F.animal('lon', 0, 0, { persist: true, tamed: true }); pig.x = p.x - 1; pig.z = p.z - 2; giveHeld(g, p, 'carrot', 2); g.act('u1', { t: 'feed', id: pig.id });
      const sheep = F.animal('cuu', 0, 0, { persist: true, tamed: true }); sheep.x = p.x + 1; sheep.z = p.z - 2; p.inv[1] = { id: 'shears', n: 1 }; p.sel = 1; g.act('u1', { t: 'shear', id: sheep.id });
      const hen = F.animal('ga', 0, 0, { persist: true, tamed: true }); hen.fed = 123; hen.prodCd = 77.5; hen.frozen = true; hen.x = p.x; hen.z = p.z - 3;
      runBig(g, 10, 0.5);
      p.food = 13; p.fat = 22.5; p.inv[2] = { id: 'hearty_stew', n: 2 }; p.sel = 2; p.eatAt = -99; g.act('u1', { t: 'use' }); p.food = 13; p.fat = 22.5; hungerMod.poison(g, p, 6);
      const lone = F.animal('lon', 0, 0); lone.x = p.x + 5; lone.z = p.z - 5;                                                                              // thú hoang không được lưu
      const save = JSON.parse(JSON.stringify(g.toSave()));
      out.v = save.v; out.saved = { crops: Object.keys(save.crops).length, farm: Object.keys(save.farm).length, animals: save.animals.length };
      const g2 = GG.fromSave(save, { spawning: false, env: false, hunger: true }); const q = g2.addPlayer('u1', 'T'); g2.tick(0.05);
      const close = (a, b, t = 0.2) => Math.abs(a - b) <= t;
      out.crops = [...g.crops].every(([k, c]) => { const d = g2.crops.get(k); return d && d.k === c.k && d.s === c.s && close(d.g, c.g, 0.05); }) && g2.crops.size === g.crops.size;
      out.farm = [...g.farm].every(([k, t]) => close(g2.farm.get(k), t, 0.05)) && g2.farm.size === g.farm.size;
      out.blocks = [[-8, 0], [-8, 2], [-1, 4]].every(([dx, dz]) => g2.world.get(cx + dx, y0 + 1, cz + dz) === g.world.get(cx + dx, y0 + 1, cz + dz) && g2.world.get(cx + dx, y0, cz + dz) >= 40);
      const A = (x) => [...x.ents.values()].filter(e => e.persist && e.kind === 'mob');
      const a1 = A(g), a2 = A(g2); out.animals = a2.length === a1.length && a1.every(e => { const d = a2.find(f => f.type === e.type); return d && d.tamed && close(d.age, e.age) && close(d.love || 0, e.love || 0) && close(d.breedCd || 0, e.breedCd || 0) && close(d.fed || 0, e.fed || 0) && close(d.shearCd || 0, e.shearCd || 0) && close(d.home.x, e.home.x, 0.02) && d.hp === e.hp; });
      out.sheepShorn = A(g2).find(e => e.type === 'cuu').shearCd > 0; out.henProd = [(A(g2).find(e => e.type === 'ga') || {}).prodCd, hen.prodCd];
      out.player = { food: q.food, fat: q.fat, power: (q.fxView.find(f => f.id === 'power') || {}).left, poison: (q.fxView.find(f => f.id === 'poison') || {}).left };
      out.orig = { power: (p.fxView.find(f => f.id === 'power') || {}).left };
      // tiếp tục lớn đúng mốc: lúa mì đã có 140 giây -> giai đoạn 2 ở 240, 3 ở 360
      const wk = F.key(-8, 0); out.progress = g2.crops.get(wk).g;
      const wb = () => g2.world.get(cx - 8, y0 + 1, cz);
      runBig(g2, 98, 0.5); out.s1 = wb(); runBig(g2, 4, 0.5); out.s2 = wb(); runBig(g2, 116, 0.5); out.s2b = wb(); runBig(g2, 4, 0.5); out.s3 = wb();
      // save v1 cũ nạp được: food 20, không lỗi, cây vẫn được nhận lại từ block
      const old = JSON.parse(JSON.stringify(save)); old.v = 1; delete old.crops; delete old.farm; delete old.animals; for (const pl of Object.values(old.players)) { delete pl.food; delete pl.fatigue; delete pl.fx; delete pl.poison; }
      const chk = S.checkVersion(old); const g3 = GG.fromSave(chk, { spawning: false, hunger: true }); const q3 = g3.addPlayer('u1', 'T');
      out.v1 = { v: chk.v, food: q3.food, fx: JSON.stringify(q3.fx), crops: g3.crops.size, animals: [...g3.ents.values()].filter(e => e.persist).length };
      const raw = JSON.parse(JSON.stringify(save)); raw.v = 1; delete raw.crops; delete raw.players; out.rawV1 = GG.fromSave(raw, { spawning: false }).addPlayer('u2', 'N').food;       // dựng tay, không qua checkVersion
      // xuất rồi nhập file .gz giữ nguyên
      const blob = await S.exportWorld(save); const imp2 = await S.importWorld(blob); out.gz = JSON.stringify(imp2) === JSON.stringify(save);
      // file hỏng: food NaN / quá lớn / hiệu ứng lạ bị làm sạch
      const bad = JSON.parse(JSON.stringify(save)); Object.assign(bad.players.u1, { food: 'x', fatigue: -5, fx: { power: 1e9, hack: 50, regen: 'a' }, poison: 'zzz' });
      const q4 = GG.fromSave(bad, { spawning: false }).addPlayer('u1', 'T'); out.bad = { food: q4.food, fat: q4.fat, fx: q4.fxView.map(f => f.id + ':' + f.left) };
      bad.players.u1.food = 999; out.big = GG.fromSave(bad, { spawning: false }).addPlayer('u1', 'T').food;
      // cây bị phá lúc tắt máy: bỏ mục; cây có block mà thiếu mục: tạo lại
      const gone = JSON.parse(JSON.stringify(save)); gone.delta = JSON.parse(JSON.stringify(save.delta));
      const g5 = GG.fromSave(gone, { spawning: false }); g5.world.set(cx - 8, y0 + 1, cz, 0); const again = JSON.parse(JSON.stringify(g5.toSave())); const g6 = GG.fromSave(again, { spawning: false });
      out.removed = !g6.crops.has(F.key(-8, 0));
      // kích thước: 1000 cây < 100 KB
      const big = new GG({ seed: 1, spawning: false }); for (let i = 0; i < 1000; i++) { const k = (i % 40) + ',' + 30 + ',' + Math.floor(i / 40); big.crops.set(k, { k: 'wheat', s: 1, g: 150.55, x: 0, y: 0, z: 0 }); }
      out.kb = JSON.stringify(big.toSave().crops).length / 1024;
      // người chơi thoát rồi vào lại: đói và hiệu ứng ở lại
      g.removePlayer('u1'); const back = g.addPlayer('u1', 'T'); out.rejoin = { food: back.food, power: (back.fxView.find(f => f.id === 'power') || {}).left };
      return out;
    """)
    assert r['v'] == 2 and r['saved'] == {'crops': 3, 'farm': 1, 'animals': 3}, r
    assert r['crops'] and r['farm'] and r['blocks'] and r['animals'] and r['sheepShorn'] and abs(r['henProd'][0] - r['henProd'][1]) < 0.1, r
    assert r['player']['food'] == 13 and abs(r['player']['fat'] - 22.5) < 0.1 and abs(r['player']['power'] - r['orig']['power']) <= 1 and r['player']['poison'] >= 1, r
    assert 139 <= r['progress'] <= 141 and r['s1'] == 43 and r['s2'] == 44 and r['s2b'] == 44 and r['s3'] == 45, r
    assert r['v1'] == {'v': 2, 'food': 20, 'fx': '{}', 'crops': 3, 'animals': 0} and r['rawV1'] == 20 and r['gz'], r
    assert r['bad']['food'] == 20 and r['bad']['fat'] == 0 and r['bad']['fx'] == ['power:300'] and r['big'] == 20 and r['removed'] and r['kb'] < 100, r
    assert r['rejoin']['food'] == 13 and r['rejoin']['power'] >= 100, r


@test
def test_survival_e2e_two_players(pg):
    r = ev(pg, NET_JS + r"""
      const { B, CROP_BLOCKS } = await imp('world/blocks.js');
      const { game, host } = await mkHost('FARMA', { hunger: true, env: false });
      game.flags['boss:thu-linh-soi'] = true; game.flags['boss:bo-cap-chua'] = true;                 // mở vùng, không bị khí độc gặm máu
      const cx = 2000, cz = 2000, y0 = 30;
      for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) { game.world.set(cx + dx, y0, cz + dz, B.GRASS); for (let dy = 1; dy <= 6; dy++) game.world.set(cx + dx, y0 + dy, cz + dz, 0); }
      game.world.set(cx + 3, y0, cz, B.WATER);
      const a = await join('FARMA', 'ua', 'An'), b = await join('FARMA', 'ub', 'Bình');
      await until(() => game.players.size === 3 && a.snap && b.snap && a.you && b.you);
      const pa = game.player('ua'), pb = game.player('ub'), at = (p, dx, dz) => game.teleportPlayer(p, cx + dx + 0.5, y0 + 1, cz + dz + 0.5);
      at(pa, -1, 2); at(pb, 1, 3);
      const slot = (s, id) => s.you.inv.findIndex(x => x && x.id === id), has = (s, id) => slot(s, id) >= 0;
      const out = {}, cell = { x: cx - 2, y: y0, z: cz }, crop = { x: cx - 2, y: y0 + 1, z: cz }, stage = s => s.world.get(crop.x, crop.y, crop.z);
      // A cuốc đất, gieo; B thấy ruộng và cây
      game.giveItem('ua', 'wood_hoe', 1); game.giveItem('ua', 'wheat_seed', 4); await until(() => has(a, 'wood_hoe') && has(a, 'wheat_seed'));
      a.act({ t: 'sel', i: slot(a, 'wood_hoe') }); await until(() => pa.sel === slot(a, 'wood_hoe'));
      a.act({ t: 'till', ...cell }); await until(() => b.world.get(cell.x, cell.y, cell.z) === 40);
      a.act({ t: 'sel', i: slot(a, 'wheat_seed') }); await until(() => pa.sel === slot(a, 'wheat_seed'));
      a.act({ t: 'plant', ...cell }); await until(() => stage(b) === 42);
      // cây lớn qua từng giai đoạn: cả hai thấy; người vào muộn nhận đúng giai đoạn cuối
      for (let i = 0; i < 125; i++) game.tick(1); await until(() => stage(a) === 43 && stage(b) === 43); out.s1 = true;
      for (let i = 0; i < 120; i++) game.tick(1); await until(() => stage(a) === 44 && stage(b) === 44); out.s2 = true;
      for (let i = 0; i < 120; i++) game.tick(1); await until(() => stage(a) === 45 && stage(b) === 45); out.s3 = true;
      const c = await join('FARMA', 'uc', 'Cường'); await until(() => c.snap && c.you); at(game.player('uc'), 2, 3); out.lateStage = c.world.get(crop.x, crop.y, crop.z);
      out.lateFarm = c.world.get(cell.x, cell.y, cell.z);
      // A thu hoạch bằng bấm phải: cây về giai đoạn 0 ở cả ba máy, A nhận lúa mì
      a.act({ t: 'harvest', ...crop }); await until(() => stage(b) === 42 && stage(c) === 42 && has(a, 'wheat')); out.harvest = true;
      // chơi chung: B và A cùng cho một con gà hoang ăn; chỉ một lần có hiệu lực, người kia bị từ chối và không bị trừ
      const hen = spawnMob(game, 'ga', cx + 0.5, y0 + 1, cz + 4.5); hen.frozen = true;
      at(pa, 0, 3); at(pb, 1, 3);
      game.giveItem('ub', 'wheat_seed', 2); await until(() => has(b, 'wheat_seed')); b.act({ t: 'sel', i: slot(b, 'wheat_seed') }); await until(() => pb.sel === slot(b, 'wheat_seed'));
      const cnt = (s) => s.you.inv.reduce((n, x) => n + (x && x.id === 'wheat_seed' ? x.n : 0), 0);
      await until(() => cnt(a) > 0 && cnt(b) === 2); const before = game.player('ua').inv.reduce((n, x) => n + (x && x.id === 'wheat_seed' ? x.n : 0), 0) + 2;
      const fails = []; a.on('ev', e => { if (e.t === 'fail') fails.push(e); }); b.on('ev', e => { if (e.t === 'fail') fails.push(e); });
      a.act({ t: 'feed', id: hen.id }); b.act({ t: 'feed', id: hen.id });
      await until(() => hen.tamed && fails.length >= 1); await wait(250);
      const after = game.player('ua').inv.reduce((n, x) => n + (x && x.id === 'wheat_seed' ? x.n : 0), 0) + game.player('ub').inv.reduce((n, x) => n + (x && x.id === 'wheat_seed' ? x.n : 0), 0);
      out.feed = { used: before - after, fails: fails.map(f => [f.a, f.reason]) };
      await until(() => [a, b, c].every(s => s.snap.es.some(e => e.id === hen.id && e.tm === 1 && e.lv === 1))); out.flags = true;
      // thanh đói của mỗi người độc lập
      game.giveItem('ua', 'cooked_meat', 1); await until(() => has(a, 'cooked_meat')); const f0 = a.you.food; a.act({ t: 'sel', i: slot(a, 'cooked_meat') }); await until(() => pa.sel === slot(a, 'cooked_meat'));
      pa.food = 5; game.touch(pa); await until(() => a.you.food === 5 && b.you.food > 5);
      a.act({ t: 'use' }); await until(() => a.you.food === 13); out.food = [a.you.food, b.you.food, c.you.food];
      game.giveItem('ua', 'veg_soup', 1); await until(() => has(a, 'veg_soup')); a.act({ t: 'sel', i: slot(a, 'veg_soup') }); await until(() => pa.sel === slot(a, 'veg_soup')); pa.eatAt = -99; pa.hp = 5; game.touch(pa); await until(() => a.you.hp === 5);
      a.act({ t: 'use' }); await until(() => a.you.fx && a.you.fx.some(f => f.id === 'regen')); out.fxA = a.you.fx.map(f => f.id); out.fxB = b.you.fx.length;
      for (const s of [a, b, c]) s.leave(); host.leave();
      return out;
    """)
    assert r['s1'] and r['s2'] and r['s3'] and r['lateStage'] == 45 and r['lateFarm'] == 40 and r['harvest'] and r['flags'], r
    assert r['feed']['used'] == 1 and len(r['feed']['fails']) == 1 and r['feed']['fails'][0][0] == 'feed' and r['feed']['fails'][0][1] == 'busy', r
    assert r['food'][0] == 13 and r['food'][1] > 5 and r['fxA'] == ['regen'] and r['fxB'] == 0, r


@test
def test_survival_content_valid(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""async () => {
      const imp = p => import('/games/the-gioi-khoi/' + p);
      const { validateContent, loadContent } = await imp('content/validate.js');
      const { ITEMS } = await imp('content/items.js'); const { MOBS } = await imp('content/mobs.js'); const { QUESTS } = await imp('content/quests.js');
      const { BLOCKS, CROP_BLOCKS, cropOf, B } = await imp('world/blocks.js'); const { CROPS } = await imp('content/farming.js'); const { makeAtlas } = await imp('render/atlas.js');
      const { createIcons } = await imp('ui/icons.js'); const { TILES, ATLAS_COLS, BLOCK_BY_NAME } = await imp('world/blocks.js');
      const c = await loadContent(); const errors = validateContent(c);
      const ids = ['wood_hoe', 'stone_hoe', 'iron_hoe', 'shears', 'wheat_seed', 'wheat', 'carrot', 'potato', 'egg', 'wool', 'pork', 'chicken', 'bread', 'baked_potato', 'cooked_pork', 'cooked_chicken', 'veg_soup', 'hearty_stew', 'egg_cake'];
      const icons = createIcons(makeAtlas()), urls = {}, blank = [];
      for (const id of ids) {
        urls[id] = icons.get(id);
        const cv = icons.canvas(id), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
        if (n < 60) blank.push(id);
      }
      const atlas = makeAtlas(), actx = atlas.getContext('2d'), tiles = {};
      for (const k of Object.keys(CROP_BLOCKS)) for (let s = 0; s < 4; s++) {
        const t = TILES.indexOf(`crop_${k}_${s}`), d = actx.getImageData((t % ATLAS_COLS) * 16, Math.floor(t / ATLAS_COLS) * 16, 16, 16).data; let n = 0, key = '';
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 128) n++; key += d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ';'; }
        tiles[k + s] = { n, key };
      }
      const farmTop = ['farmland_top', 'farmland_wet_top'].map(nm => { const t = TILES.indexOf(nm); return Array.from(actx.getImageData((t % ATLAS_COLS) * 16, Math.floor(t / ATLAS_COLS) * 16, 4, 4).data).join(); });
      return { errors, distinct: new Set(Object.values(urls)).size, n: ids.length, blank, tileCounts: Object.values(tiles).map(t => t.n), tileDistinct: new Set(Object.values(tiles).map(t => t.key)).size,
               farmDiff: farmTop[0] !== farmTop[1], blocks: BLOCKS.length, ids: [B.FARMLAND, B.FARMLAND_WET, CROP_BLOCKS.wheat[0], CROP_BLOCKS.potato[3]], farmland: [BLOCKS[40].name, BLOCKS[41].name, BLOCKS[42].name, BLOCKS[53].name],
               plantFlags: [42, 45, 46, 53].map(i => [BLOCKS[i].plant, BLOCKS[i].deco, BLOCKS[i].solid]), farmSolid: [BLOCKS[40].solid, BLOCKS[40].drop, BLOCKS[41].drop],
               mobs: ['ga', 'cuu', 'lon'].map(k => [MOBS[k].ai, !!MOBS[k].breed, MOBS[k].passive]), quest: QUESTS['harvest-1'] && QUESTS['harvest-1'].steps.map(s => s.type + ':' + s.item + ':' + s.n) };
    }""")
    assert r['errors'] == [], r
    assert r['distinct'] == r['n'] and r['blank'] == [], r                                # mọi vật phẩm mới có icon vẽ riêng, không trống
    assert all(n > 6 for n in r['tileCounts']) and r['tileDistinct'] == 12 and r['farmDiff'], r
    assert r['blocks'] == 62 and r['ids'] == [40, 41, 42, 53] and r['farmland'] == ['farmland', 'farmland_wet', 'crop_wheat_0', 'crop_potato_3'], r
    assert all(f == [True, True, False] for f in r['plantFlags']) and r['farmSolid'] == [True, 'dirt', 'dirt'], r
    assert r['mobs'] == [['farm', True, True]] * 3 and r['quest'] == ['collect:wood_hoe:1', 'collect:wheat:6', 'collect:bread:1'], r


@test
def test_survival_ui(pg, browser, base):
    _open_game(pg, base)
    r = ev(pg, r"""
      const g = __g, game = g.game, uid = g.S.uid, p = game.player(uid), out = {};
      const H = await imp('sim/hunger.js'); const hudMod = await imp('ui/hud.js'); const { B } = await imp('world/blocks.js'); const { spawnMob } = await imp('sim/mobs.js');
      const bar = () => { const e = document.getElementById('food'); return { n: e.querySelectorAll('i.ic').length, full: e.querySelectorAll('i.ic.full').length, half: e.querySelectorAll('i.ic.half').length, empty: e.querySelectorAll('i.ic.empty').length, pulse: e.classList.contains('pulse') }; };
      const setFood = async (v) => { p.food = v; p.fat = 0; game.touch(p); await until(() => g.S.you.food === v); await wait(80); return bar(); };
      out.f20 = await setFood(20); out.f7 = await setFood(7); out.f1 = await setFood(1); out.f0 = await setFood(0); await setFood(20);
      // hiệu ứng: biểu tượng, tên, số giây đếm lùi; ngộ độc có biểu tượng riêng
      H.addFx(game, p, 'power', 100); await until(() => document.querySelector('#fxbar .fx[data-id="power"]'));
      const fx = document.querySelector('#fxbar .fx[data-id="power"]'); out.fx = { text: fx.innerText.replace(/\s+/g, ' ').trim(), title: fx.title, img: !!fx.querySelector('img') };
      H.poison(game, p, 6); await until(() => document.querySelector('#fxbar .fx[data-id="poison"]')); out.poison = document.querySelector('#fxbar .fx[data-id="poison"]').title;
      await wait(1300); out.fxLeft = Number(document.querySelector('#fxbar .fx[data-id="power"] .left').textContent);
      p.psn = null; H.clearFx(game, p); game.touch(p); await until(() => document.querySelectorAll('#fxbar .fx').length === 0);
      // tooltip vật phẩm ăn được
      out.tipBread = hudMod.itemTip('bread'); out.tipSoup = hudMod.itemTip('veg_soup'); out.tipRaw = hudMod.itemTip('meat'); out.tipSword = hudMod.itemTip('iron_sword');
      game.giveItem(uid, 'bread', 2); await until(() => [...document.querySelectorAll('#hotbar .slot')].some(s => (s.title || '').includes('Bánh mì')));
      out.slotTitle = [...document.querySelectorAll('#hotbar .slot')].map(s => s.title).find(t => t && t.includes('Bánh mì'));
      return out;
    """)
    assert r['f20'] == {'n': 10, 'full': 10, 'half': 0, 'empty': 0, 'pulse': False}, r
    assert r['f7'] == {'n': 10, 'full': 3, 'half': 1, 'empty': 6, 'pulse': False} and r['f1'] == {'n': 10, 'full': 0, 'half': 1, 'empty': 9, 'pulse': False}, r
    assert r['f0'] == {'n': 10, 'full': 0, 'half': 0, 'empty': 10, 'pulse': True}, r
    assert 'Sức mạnh' in r['fx']['text'] and r['fx']['title'] == 'Sức mạnh' and r['fx']['img'] and 9 <= len(r['fx']['text']) <= 20 and r['poison'] == 'Ngộ độc', r
    assert 96 <= r['fxLeft'] <= 99, r
    assert 'Đói +6' in r['tipBread'] and 'Máu +2' in r['tipBread'] and 'Hồi phục' in r['tipSoup'] and '45' in r['tipSoup'] and 'ngộ độc' in r['tipRaw'].lower(), r
    assert 'Bánh mì' in r['slotTitle'] and 'Đói +6' in r['slotTitle'] and 'Đói' not in r['tipSword'], r

    # --- ngắm và bấm phải thật: cuốc, gieo, thu hoạch, ăn, cho ăn, cắt len; tooltip cây/ruộng/thú
    pg.evaluate("""async () => {
      const g = __g, game = g.game, uid = g.S.uid, p = game.player(uid), w = game.world, l = g.local;
      const wait = ms => new Promise(r => setTimeout(r, ms)), until = async (f, ms = 4000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('hết giờ chờ: ' + String(f).slice(0, 100)); await wait(20); } };
      const { B, CROP_BLOCKS } = await import('/games/the-gioi-khoi/world/blocks.js'); const { spawnMob } = await import('/games/the-gioi-khoi/sim/mobs.js');
      const bx = Math.floor(l.x) + 4, bz = Math.floor(l.z) - 6, by = w.surfaceY(bx, bz);
      for (let dx = -3; dx <= 8; dx++) for (let dz = -3; dz <= 3; dz++) { w.set(bx + dx, by, bz + dz, B.GRASS); for (let dy = 1; dy <= 4; dy++) w.set(bx + dx, by + dy, bz + dz, 0); }
      p.x = bx + 1.5; p.z = bz + 4.5; p.y = by + 1; l.x = p.x; l.z = p.z; l.y = p.y; await wait(400);
      const slotOf = id => g.S.you.inv.findIndex(s => s && s.id === id);
      window.T = { bx, by, bz, B, CROP_BLOCKS, spawnMob, wait, until,
        tip: () => document.getElementById('tip').innerText.trim(), toast: () => document.getElementById('toast').innerText.trim(),
        count: id => g.S.you.inv.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0),
        hold: async (id, n = 6) => { if (slotOf(id) < 0) game.giveItem(uid, id, n); await until(() => slotOf(id) >= 0); g.S.act({ t: 'sel', i: slotOf(id) }); await until(() => g.S.you.sel === slotOf(id) && p.sel === slotOf(id)); },
        look: (x, y, z) => g.lookAt(x, y, z), hostCrop: (x, y, z, kind, s) => { game.setBlock(x, y, z, CROP_BLOCKS[kind][s]); game.crops.set(x + ',' + y + ',' + z, { k: kind, s, g: s * 100, x, y, z }); } };
    }""")
    pg.mouse.move(550, 300)
    rclick = lambda: (pg.mouse.down(button='right'), pg.mouse.up(button='right'))
    T = lambda js, arg=None: pg.evaluate("async (a) => { const T = window.T; " + js + " }", arg)

    # tooltip cây (giai đoạn, độ ẩm) và gợi ý khi cầm hạt/cuốc
    T("T.hostCrop(T.bx, T.by + 1, T.bz, 'wheat', 2); __g.game.setBlock(T.bx, T.by, T.bz, T.B.FARMLAND); T.look(T.bx + 0.5, T.by + 1.3, T.bz + 0.5); await T.until(() => T.tip().includes('Lúa mì'));")
    tip1 = T("return T.tip();")
    T("__g.game.setBlock(T.bx + 1, T.by, T.bz, T.B.FARMLAND_WET); T.hostCrop(T.bx + 1, T.by + 1, T.bz, 'carrot', 3); T.look(T.bx + 1.5, T.by + 1.3, T.bz + 0.5); await T.until(() => T.tip().includes('Cà rốt'));")
    tip2 = T("return T.tip();")
    T("__g.game.setBlock(T.bx + 2, T.by, T.bz, T.B.FARMLAND); await T.hold('wheat_seed'); T.look(T.bx + 2.5, T.by + 0.95, T.bz + 0.5); await T.until(() => T.tip().includes('gieo'));")
    T("await T.hold('wood_hoe', 1); T.look(T.bx + 3.5, T.by + 0.95, T.bz + 0.5); await T.until(() => T.tip().includes('cày'));")
    assert 'Lúa mì' in tip1 and '3/4' in tip1 and 'khô' in tip1, tip1
    assert 'Cà rốt' in tip2 and '4/4' in tip2 and 'ướt' in tip2 and 'chín' in tip2, tip2

    # cuốc đất: chuột phải lên cỏ bằng cuốc
    rclick(); pg.wait_for_function("__g.game.world.get(window.T.bx + 3, window.T.by, window.T.bz) >= 40", timeout=8000)
    # gieo: hạt lên ruộng; hạt lên cỏ thì báo "Hạt cần đặt lên đất cày"
    T("await T.hold('wheat_seed'); T.look(T.bx + 4.5, T.by + 0.95, T.bz + 0.5);")
    rclick(); pg.wait_for_timeout(300)
    assert 'Hạt cần đặt lên đất cày' in T("return T.toast();")
    seeds0 = T("return T.count('wheat_seed');")
    T("T.look(T.bx + 3.5, T.by + 0.95, T.bz + 0.5);"); rclick()
    pg.wait_for_function("__g.game.world.get(window.T.bx + 3, window.T.by + 1, window.T.bz) === 42", timeout=8000)
    pg.wait_for_function("(n) => window.T.count('wheat_seed') === n - 1", arg=seeds0, timeout=8000)
    # cây chưa chín: bấm phải tay không báo "Cây chưa chín"; cây chín: thu hoạch, về giai đoạn 0, nhận lúa mì
    T("await T.hold('stick'); T.look(T.bx + 3.5, T.by + 1.3, T.bz + 0.5);"); rclick(); pg.wait_for_timeout(300)
    assert 'Cây chưa chín' in T("return T.toast();")
    T("T.hostCrop(T.bx + 3, T.by + 1, T.bz, 'wheat', 3); await T.wait(300);"); w0 = T("return T.count('wheat');")
    rclick(); pg.wait_for_function("(n) => window.T.count('wheat') > n", arg=w0, timeout=8000)
    pg.wait_for_function("__g.game.world.get(window.T.bx + 3, window.T.by + 1, window.T.bz) === 42", timeout=8000)
    # ăn: chuột phải lên trời khi cầm thịt nướng
    T("await T.hold('cooked_meat'); const p = __g.game.player(__g.S.uid); p.food = 10; p.fat = 0; __g.game.touch(p); await T.wait(200); __g.lookAt(__g.local.x, __g.local.y + 50, __g.local.z);")
    rclick(); pg.wait_for_function("__g.game.player(__g.S.uid).food >= 17", timeout=8000)
    # cho ăn: heo hoang đứng yên; thú đã thuần hiện tooltip (đã thuần, đang yêu, non, đã cắt len)
    T("const e = T.spawnMob(__g.game, 'lon', __g.local.x + 1.5, T.by + 1, __g.local.z - 1.5); e.frozen = true; window.PIG = e.id; await T.hold('carrot'); await T.until(() => __g.interp.es.some(x => x.id === window.PIG)); const q = __g.interp.es.find(x => x.id === window.PIG); T.look(q.x, q.y + 0.5, q.z);")
    rclick(); pg.wait_for_function("__g.game.ents.get(window.PIG).tamed === true", timeout=8000)
    pg.wait_for_function("window.T.tip().includes('Lợn') && window.T.tip().includes('đã thuần') && window.T.tip().includes('yêu')", timeout=8000)
    T("const e = __g.game.ents.get(window.PIG); e.age = 10; await T.wait(400); const q = __g.interp.es.find(x => x.id === window.PIG); T.look(q.x, q.y + 0.2, q.z); await T.until(() => T.tip().includes('non'));")
    T("const e = T.spawnMob(__g.game, 'cuu', __g.local.x - 1.5, T.by + 1, __g.local.z - 1.5, { persist: true, tamed: true }); e.frozen = true; window.SHEEP = e.id; await T.hold('shears', 1); await T.until(() => __g.interp.es.some(x => x.id === window.SHEEP)); const q = __g.interp.es.find(x => x.id === window.SHEEP); T.look(q.x, q.y + 0.6, q.z);")
    rclick(); pg.wait_for_function("window.T.count('wool') >= 1", timeout=8000)
    pg.wait_for_function("window.T.tip().includes('cắt len')", timeout=8000)

    # ảnh chụp: ruộng đủ 4 giai đoạn, không trống, nhiều màu ở vùng cây
    shot = pg.evaluate("""async () => {
      const T = window.T, g = __g, game = g.game, l = g.local, w = game.world;
      for (let i = 0; i < 4; i++) { game.setBlock(T.bx - 2 + i, T.by, T.bz - 2, T.B.FARMLAND_WET); T.hostCrop(T.bx - 2 + i, T.by + 1, T.bz - 2, 'wheat', i); game.setBlock(T.bx - 2 + i, T.by, T.bz - 3, T.B.FARMLAND); T.hostCrop(T.bx - 2 + i, T.by + 1, T.bz - 3, i % 2 ? 'carrot' : 'potato', i); }
      l.x = T.bx - 0.5; l.z = T.bz + 1.0; l.y = T.by + 1; T.look(T.bx - 0.5, T.by + 1.0, T.bz - 2.5); await T.wait(900); g.renderNow();
      const src = g.scene.renderer.domElement, c = document.createElement('canvas'); c.width = 300; c.height = 170; const ctx = c.getContext('2d'); g.scene.render(); ctx.drawImage(src, 0, 0, 300, 170);
      const d = ctx.getImageData(0, 30, 300, 110).data, colors = new Set(); let green = 0, yellow = 0;
      for (let i = 0; i < d.length; i += 4) { colors.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); if (d[i + 1] > d[i] + 25 && d[i + 1] > d[i + 2] + 25) green++; if (d[i] > 110 && d[i + 1] > 90 && d[i + 2] < 85 && Math.abs(d[i] - d[i + 1]) < 60) yellow++; }
      return { colors: colors.size, green, yellow, tris: g.scene.renderer.info.render.triangles };
    }""")
    pg.screenshot(path='/tmp/claude-464201200/-data-yuu-ai-data-yuu-self-c/ffbac0c7-dba7-4885-b0fa-42f49ea80379/scratchpad/shot_farm.png')
    assert shot['colors'] >= 3 and shot['green'] > 20 and shot['yellow'] > 5 and shot['tris'] > 1000, shot


@test
def test_survival_perf(pg):
    r = ev(pg, FARM_JS + r"""
      const { buildChunkMesh } = await imp('render/mesher.js');
      const g = new Game({ seed: 31337, spawning: false, env: false, hunger: true });
      const ps = []; for (let i = 1; i <= 2; i++) { const p = g.addPlayer('u' + i, 'P' + i); p.hp = p.maxHp = 9999; p.x = 2000.5 + i * 6; p.z = 2000.5; p.y = 31; ps.push(p); }
      const cx = 2000, cz = 2000, y0 = 30;
      for (let dx = -14; dx <= 24; dx++) for (let dz = -14; dz <= 20; dz++) { g.world.set(cx + dx, y0, cz + dz, B.GRASS); for (let dy = 1; dy <= 6; dy++) g.world.set(cx + dx, y0 + dy, cz + dz, 0); }
      const kinds = ['wheat', 'carrot', 'potato']; let n = 0;
      for (let dx = -12; dx < 13; dx++) for (let dz = -10; dz < 10; dz++) {                                       // 500 cây (25 x 20) đủ giai đoạn
        const kind = kinds[(dx + dz + 100) % 3], s = ((dx * 7 + dz * 3 + 100) % 4 + 4) % 4, x = cx + dx, z = cz + dz;
        g.world.set(x, y0, z, dx % 5 === 0 ? B.FARMLAND_WET : B.FARMLAND); g.world.set(x, y0 + 1, z, CROP_BLOCKS[kind][s]);
        g.crops.set(x + ',' + (y0 + 1) + ',' + z, { k: kind, s, g: CROPS[kind].secs * s / 3, x, y: y0 + 1, z }); n++;
      }
      const types = ['ga', 'cuu', 'lon'];
      for (let i = 0; i < 24; i++) spawnMob(g, types[i % 3], cx + 0.5 + (i % 8) * 2 - 8, y0 + 1, cz + 12.5 + Math.floor(i / 8) * 2, { persist: true, tamed: true });
      const hostile = ['soi-xam', 'xac-song', 'bo-cap', 'xuong-cung', 'gau-bang'];
      for (let i = 0; i < 40; i++) { const p = ps[i % 2], x = p.x + Math.cos(i) * 10, z = p.z + Math.sin(i) * 10; spawnMob(g, hostile[i % 5], x, y0 + 1, z); }
      for (let i = 0; i < 60; i++) { g.tick(0.05); for (const p of ps) p.hp = 9999; }                              // 3 lượt xử lý cây (cả chi phí đặt block khi đổi giai đoạn)
      let worst = 0, sum = 0; const N = 100;
      for (let i = 0; i < N; i++) { const t = performance.now(); g.tick(0.05); const d = performance.now() - t; sum += d; worst = Math.max(worst, d); for (const p of ps) p.hp = 9999; }
      let pass = 0; for (let i = 0; i < 20; i++) { g.farmDirty = i % 2 === 0; const t = performance.now(); farmMod.farmTick(g, 1); pass += performance.now() - t; }
      const t0 = performance.now(); const m = buildChunkMesh((x, y, z) => g.world.get(x, y, z), 125, 125); const mesh = performance.now() - t0;
      const tame = [...g.ents.values()].filter(e => e.persist).length, mobs = [...g.ents.values()].filter(e => e.kind === 'mob').length;
      const flips = (() => { const dirty0 = g.world.dirty.size; return dirty0; })();
      return { n, avg: sum / N, worst, pass: pass / 20, mesh, plantVerts: m.plants.positions.length / 3, tame, mobs, crops: g.crops.size };
    """)
    assert r['n'] == 500 and r['tame'] == 24 and r['mobs'] == 64 and r['crops'] == 500, r
    assert r['avg'] < 5 and r['worst'] < 25, r                      # ngưỡng giữ nguyên như test_perf_tick_with_40_mobs_and_5_players
    assert r['pass'] < 3, r                                         # một lượt xử lý 500 cây (mục tiêu <= 1 ms trên máy thường)
    assert r['mesh'] < 400 and r['plantVerts'] > 400, r             # dựng mesh chunk có cây không vượt ngưỡng chunk hiện tại


@test
def test_survival_world_delta_is_run_length_encoded_and_reads_old_format(pg):
    r = ev(pg, GAME_JS + r"""
      const { World } = await imp('world/world.js');
      const w = new World(4242);
      for (let x = 0; x < 12; x++) for (let z = 0; z < 5; z++) w.set(x, 40, z, 8);                    // một mảng phẳng cùng id: gộp thành vài đoạn
      w.set(3, 41, 3, 42); w.set(4, 41, 3, 43);
      const d = w.exportDelta(), json = JSON.stringify(d), old = {};
      for (const [k, m] of w.delta) old[k] = Object.fromEntries(m);
      const a = new World(4242); a.importDelta(JSON.parse(json));                                      // dạng mới
      const b = new World(4242); b.importDelta(JSON.parse(JSON.stringify(old)));                       // dạng cũ { chỉ số: id } vẫn nạp được
      let same = true; for (let x = -1; x < 14; x++) for (let z = -1; z < 7; z++) for (const y of [40, 41]) if (a.get(x, y, z) !== w.get(x, y, z) || b.get(x, y, z) !== w.get(x, y, z)) same = false;
      return { same, rle: Object.values(d).every(Array.isArray), smaller: json.length < JSON.stringify(old).length / 3, again: JSON.stringify(a.exportDelta()) === json };
    """)
    assert r == {'same': True, 'rle': True, 'smaller': True, 'again': True}, r

# ---------------------------------------------------------------- Gói 1: bài của Tester độc lập (phá hoại / biên)

@test
def test_survival_tester_garbage_args_never_throw(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p } = F; const bads = [null, undefined, {}, { x: NaN, y: 1, z: 1 }, { x: 1.5, y: 30, z: 2000 }, { x: '2000', y: 30, z: 2000 }, { x: 1e12, y: 1e12, z: 1e12 }, { x: -1, y: -5, z: 2000 }, { id: 'a' }, { id: -1 }, { id: 1e99 }, { id: NaN }, { id: null }, [], 'x', 7];
      const errs = [], res = [];
      giveHeld(g, p, 'wood_hoe');
      for (const t of ['till', 'plant', 'harvest', 'feed', 'shear', 'use', 'sel']) for (const a of bads) {
        try { const r = g.act('u1', a && typeof a === 'object' && !Array.isArray(a) ? { t, ...a } : { t, x: a, id: a }); res.push(r && r.ok); } catch (e) { errs.push(t + ':' + JSON.stringify(a) + ':' + e.message); }
      }
      return { errs, anyOk: res.filter(Boolean).length };
    """)
    assert r['errs'] == [], r


@test
def test_survival_tester_dead_player_cannot_farm_or_eat(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p } = F; F.till(0, 0); F.plant(0, 0); F.ripe(0, 0);
      const hen = F.animal('ga', 1, 1); giveHeld(g, p, 'wheat_seed', 3); p.food = 3; g.touch(p);
      p.dead = true; p.hp = 0;
      const rs = [g.act('u1', { t: 'harvest', ...F.at(0, 0, 1) }), g.act('u1', { t: 'feed', id: hen.id }), g.act('u1', { t: 'use' }), g.act('u1', { t: 'till', ...F.at(2, 2) })].map(x => x.reason);
      g.tick(1); g.tick(1);
      return { rs, count: count(p, 'wheat_seed'), wheat: count(p, 'wheat'), tamed: !!hen.tamed, food: p.food };
    """)
    assert r['rs'] == ['dead'] * 4 and r['count'] == 3 and r['wheat'] == 0 and not r['tamed'], r


@test
def test_survival_tester_spam_conserves_items(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p } = F; F.stand(0, 0);
      p.inv.fill(null); g.giveItem('u1', 'wheat_seed', 10); g.giveItem('u1', 'wood_hoe', 1); g.giveItem('u1', 'wheat', 5);
      const si = p.inv.findIndex(s => s && s.id === 'wheat_seed'), hi = p.inv.findIndex(s => s && s.id === 'wood_hoe'), wi = p.inv.findIndex(s => s && s.id === 'wheat');
      let okTill = 0, okPlant = 0;
      p.sel = hi; for (let i = 0; i < 200; i++) if (g.act('u1', { t: 'till', ...F.at(0, 0) }).ok) okTill++;
      p.sel = si; for (let i = 0; i < 200; i++) if (g.act('u1', { t: 'plant', ...F.at(0, 0) }).ok) okPlant++;
      F.ripe(0, 0); let okH = 0; for (let i = 0; i < 200; i++) { if (g.act('u1', { t: 'harvest', ...F.at(0, 0, 1) }).ok) okH++; }
      const hen = F.animal('ga', 1, 1); p.sel = si; let okF = 0; for (let i = 0; i < 100; i++) if (g.act('u1', { t: 'feed', id: hen.id }).ok) okF++;
      p.sel = wi; let ate = 0; p.hp = 5; p.food = 1; for (let i = 0; i < 100; i++) { if (g.act('u1', { t: 'use' }).ok) ate++; }
      return { okTill, okPlant, okH, okF, ate, seeds: count(p, 'wheat_seed'), crops: g.crops.size, farm: g.farm.size };
    """)
    assert r['okTill'] >= 1 and r['okPlant'] == 1 and r['okH'] == 1, r
    assert r['okF'] <= 2, r


@test
def test_survival_tester_water_and_break_edge_cases(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm(); const { g, p, cx, y0, cz } = F;
      F.till(0, 0); F.plant(0, 0); const k = F.key(0, 0);
      g.setBlock(cx, y0 + 1, cz, B.WATER);                       // nước chảy đè lên cây
      const afterWater = { crop: g.crops.has(k), id: g.world.get(cx, y0 + 1, cz) };
      g.setBlock(cx, y0 + 1, cz, 0);
      const farmBack = g.farm.has(F.key(0, 0, 0));
      // đất cày bị thay bằng nước, rồi tick lâu: không rác sổ
      F.till(5, 5); F.plant(5, 5); g.setBlock(cx + 5, y0, cz + 5, B.WATER); runBig(g, 5);
      const leftover = [...g.crops.keys()].filter(kk => kk === F.key(5, 5)).length;
      // đặt cây lên rìa thế giới (y cao nhất)
      F.stand(0, 0); const top = F.till(0, 3); 
      return { afterWater, farmBack, leftover, cropsSize: g.crops.size, farmSize: g.farm.size, top: top.ok };
    """)
    assert r['leftover'] == 0 and not r['afterWater']['crop'], r


@test
def test_survival_tester_hostile_save_is_sanitized(pg):
    r = ev(pg, FARM_JS + r"""
      const F = mkFarm({ hunger: true }); const { g, p, cx, cz, y0 } = F;
      F.till(0, 0); F.plant(0, 0); F.animal('cuu', 2, 2, { persist: true, tamed: true });
      const save = JSON.parse(JSON.stringify(g.toSave()));
      save.crops = { 'x,y,z': { k: 'wheat', g: 1 }, '1,2': null, [F.key(0, 0)]: { k: 'carrot', g: -5 }, __proto__x: 1 };
      save.farm = { 'a,b,c': 5, [F.key(1, 1, 0)]: 'NaN' };
      save.animals = [null, 5, { type: 'ga', x: NaN, y: 1, z: 1 }, { type: 'zombie', x: 1, y: 40, z: 1 }, ...Array.from({ length: 60 }, (_, i) => ({ type: 'lon', x: cx + i * 0.1, y: y0 + 1, z: cz, age: -9, hp: 1e9 }))];
      for (const pl of Object.values(save.players || {})) { pl.food = NaN; pl.fx = { regen: 1e9, bogus: 5 }; pl.poison = -3; pl.fatigue = 'x'; }
      let g2, err = null;
      try { g2 = Game.fromSave(save, { spawning: false, env: false, hunger: true }); const q = g2.addPlayer('u1', 'T'); for (let i = 0; i < 40; i++) g2.tick(0.5); } catch (e) { err = e.message; }
      if (err) return { err };
      const tame = [...g2.ents.values()].filter(e => e.persist && e.kind === 'mob').length;
      const q = g2.player('u1');
      return { err, tame, food: q.food, fx: Object.keys(q.fx || {}), maxHp: [...g2.ents.values()].some(e => e.hp > 100), crops: g2.crops.size, nan: [...g2.crops.values()].some(c => !Number.isFinite(c.g)) };
    """)
    assert r['err'] is None and r['tame'] <= 24 and not r['maxHp'] and not r['nan'], r



# ---------------------------------------------------------------- Gói 2: hầm ngục có chủ đề (test_dungeon_*)

DUNGEON_JS = ARENA_JS + r"""
const D = await imp('sim/dungeon.js'); const DC = await imp('content/dungeons.js'); const { B, BLOCKS } = await imp('world/blocks.js');
const { BOSSES } = await imp('content/bosses.js'); const { ITEMS } = await imp('content/items.js');
// Dựng một hầm ở chỗ cố định (2000, 2000): trả game, người chơi u1 (máu 1000), khuôn L và vài hàm tiện ích.
const mkDg = (id = 'ham-re-muc', o = {}) => {
  const g = new Game({ seed: 777, spawning: false, env: false, hunger: false, ...o });
  g.flags['boss:thu-linh-soi'] = true; g.flags['boss:bo-cap-chua'] = true;            // mở các vùng: không có khí độc gặm máu
  const site = D.forceSite(g, id, 2000, 2000), L = D.layoutOf(site, id), p = g.addPlayer('u1', 'T');
  p.maxHp = p.hp = 1000;
  const stand = (x, z, y = site.fy, q = p) => { q.x = x + 0.5; q.y = y; q.z = z + 0.5; q.vx = q.vy = q.vz = 0; q.lastState = g.time; };
  const secs = (t, dt = 0.05) => { for (let i = 0; i < Math.round(t / dt); i++) g.tick(dt); };
  const give = (id2, n = 1, q = p) => { g.giveItem(q.uid, id2, n); };
  const hold = (id2, q = p) => { if (!q.inv.some(s => s && s.id === id2)) g.giveItem(q.uid, id2, 1); q.sel = q.inv.findIndex(s => s && s.id === id2); g.touch(q); };
  return { g, p, site, L, id, stand, secs, give, hold };
};
const cnt = (p, id) => p.inv.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0);
const dgMobs = (g, id) => [...g.ents.values()].filter(e => e.kind === 'mob' && e.dg === id);
const typesOf = list => list.map(e => e.type).sort();
const isSol = (g, x, y, z) => BLOCKS[g.world.get(x, y, z)].solid;
// đi bộ được từ a tới b? (bước lên <= 1 block, rơi <= 3, cổng đóng là tường)
const pathExists = (g, a, b, maxN = 90000) => {
  const ok = (x, y, z) => !isSol(g, x, y, z) && !isSol(g, x, y + 1, z) && isSol(g, x, y - 1, z);
  const q = [[a.x, a.y, a.z]], seen = new Set([a.x + ',' + a.y + ',' + a.z]);
  for (let i = 0; i < q.length && i < maxN; i++) {
    const [x, y, z] = q[i];
    if (x === b.x && z === b.z && Math.abs(y - b.y) <= 1) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const dy of [0, 1, -1, -2, -3]) {
      const nx = x + dx, ny = y + dy, nz = z + dz, k = nx + ',' + ny + ',' + nz;
      if (seen.has(k) || !ok(nx, ny, nz)) continue;
      if (dy === 1 && isSol(g, x, y + 2, z)) continue;
      if (dy < 0 && (isSol(g, nx, y, nz) || isSol(g, nx, y + 1, nz))) continue;
      seen.add(k); q.push([nx, ny, nz]);
    }
  }
  return false;
};
const openGate = (g, L, kind) => { for (const [x, y, z] of L.gates[kind].cells) g.world.set(x, y, z, 0); };
// phá một block bằng cuốc đang cầm (dig + thời gian + break)
const smash = (g, p, x, y, z) => { const r1 = g.act(p.uid, { t: 'dig', x, y, z }); if (!r1.ok) return r1; g.time += 3; return g.act(p.uid, { t: 'break', x, y, z }); };
"""


@test
def test_dungeon_content_valid_and_validator_catches_breaks(pg):
    r = ev(pg, r"""
      const { validateContent, loadContent } = await imp('content/validate.js');
      const c = await loadContent(), base = validateContent(c);
      const mk = f => { const x = JSON.parse(JSON.stringify(c)); f(x); return validateContent(x).join(' | '); };
      const { DUNGEONS } = await imp('content/dungeons.js'); const { BOSSES } = await imp('content/bosses.js');
      return { base, n: Object.keys(DUNGEONS).length, bosses: Object.values(BOSSES).filter(b => b.dungeon).length,
        e1: mk(x => { x.dungeons['ham-re-muc'].region = 'vung-ma'; }),
        e2: mk(x => { x.dungeons['ham-cat-chon'].mobs.push('quai-ma-2'); }),
        e3: mk(x => { x.dungeons['ham-bang-gia'].mats = ['vat-pham-ma-3']; }),
        e4: mk(x => { x.dungeons['ham-bun-lay'].boss = 'boss-ma-4'; }),
        e5: mk(x => { x.dungeons['ham-tro-tan'].traps = ['spike']; }),
        e6: mk(x => { x.loot.victory = x.loot.victory.filter(r => r.item !== 'dungeon_key'); }),
        e7: mk(x => { delete x.layout.gates.boss; }),
        e8: mk(x => { x.loot.treasure.push({ item: 'vat-pham-ma-8', min: 1, max: 1, p: 1 }); }) };
    """)
    assert r['base'] == [] and r['n'] == 6 and r['bosses'] == 6, r
    for k, needle in {'e1': 'vung-ma', 'e2': 'quai-ma-2', 'e3': 'vat-pham-ma-3', 'e4': 'boss-ma-4', 'e5': '3 chặng', 'e6': 'dungeon_key', 'e7': 'cổng', 'e8': 'vat-pham-ma-8'}.items():
        assert needle in r[k], (k, needle, r[k])


@test
def test_dungeon_six_sites_per_world_in_region_and_far_from_everything(pg):
    r = ev(pg, GAME_JS + r"""
      const { DUNGEONS } = await imp('content/dungeons.js'); const { columnInfo } = await imp('world/generate.js');
      const out = [];
      for (const seed of [777, 31337, 7, 2024, 99]) {
        const g = new Game({ seed, spawning: false }); const t = performance.now(); g.buildStructures(); const ms = performance.now() - t;
        const sd = g.flags.sites.dungeon || {}, others = [...Object.values(g.flags.sites.arena), ...Object.values(g.flags.sites.village)], bad = [];
        for (const [id, s] of Object.entries(sd)) {
          if (columnInfo(seed, s.c.x, s.c.z).region.id !== DUNGEONS[id].region) bad.push(id + ':vung');
          for (const o of others) if (Math.hypot(o.x - s.c.x, o.z - s.c.z) < 90) bad.push(id + ':cach-cong-trinh');
          for (const [id2, s2] of Object.entries(sd)) if (id2 < id && Math.hypot(s2.c.x - s.c.x, s2.c.z - s.c.z) < 90) bad.push(id + ':cach-' + id2);
        }
        out.push({ seed, n: Object.keys(sd).length, bad, ms: Math.round(ms) });
      }
      return out;
    """)
    for o in r:
        assert o['n'] == 6 and not o['bad'], o


@test
def test_dungeon_layout_is_walkable_door_by_door_and_compact(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const out = {};
      for (const id of Object.keys(DC.DUNGEONS)) {
        const T = mkDg(id), { g, L, site } = T, W = L.box.x1 - L.box.x0 + 1, Hh = L.box.z1 - L.box.z0 + 1;
        const foot = { x: L.foot.x, y: site.fy, z: L.foot.z }, mouth = { x: site.x, y: site.gy, z: site.z };
        const near = (c, dz) => ({ x: c.x, y: site.fy, z: c.z + dz });
        const o = { w: W, h: Hh, fy: site.fy, steps: site.steps };
        o.mouthToFoot = pathExists(g, mouth, foot);
        o.toP2 = pathExists(g, foot, { x: L.p2c.x, y: site.fy, z: L.p2c.z });
        o.p3Closed = pathExists(g, foot, near(L.chests.trap, 1));
        openGate(g, L, 'iron');
        o.p3Open = pathExists(g, foot, near(L.chests.trap, 1));
        o.p4Closed = pathExists(g, foot, { x: L.p4c.x, y: site.fy, z: L.p4c.z });
        openGate(g, L, 'boss');
        o.p4Open = pathExists(g, foot, { x: L.p4c.x, y: site.fy, z: L.p4c.z });
        out[id] = o;
      }
      return out;
    """)
    for id, o in r.items():
        assert o['w'] <= 72 and o['h'] <= 40 and o['fy'] >= 6 and 6 <= o['steps'] <= 16, (id, o)
        assert o['mouthToFoot'] and o['toP2'] and not o['p3Closed'] and o['p3Open'] and not o['p4Closed'] and o['p4Open'], (id, o)


@test
def test_dungeon_walls_cannot_be_dug_and_the_vault_is_sealed(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const out = {};
      for (const id of ['ham-re-muc', 'ham-bang-gia', 'ham-tro-tan']) {
        const T = mkDg(id), { g, p, L, site } = T;
        // 1. mọi tường/cổng/rương không đào được bằng cuốc tốt nhất
        T.hold('ancient_pick'); const pick = p.inv[p.sel].id;
        let diggable = 0, sample = 0;
        for (let i = 0; i < L.walls.length; i += 7) {
          const [x, y, z] = L.walls[i]; if (BLOCKS[g.world.get(x, y, z)].name === 'dart_trap') continue;
          sample++; if (g.breakTime(p.uid, x, y, z) !== Infinity) diggable++;
        }
        const gateOk = [...L.gates.iron.cells, ...L.gates.boss.cells].every(([x, y, z]) => g.breakTime(p.uid, x, y, z) === Infinity);
        const chestOk = ['supply', 'victory', 'trap'].every(k => g.breakTime(p.uid, L.chests[k].x, L.chests[k].y, L.chests[k].z) === Infinity);
        // 2. mở hết cổng rồi lan từ chân thang qua mọi ô trống hoặc đào được (sàn, ống tên): không được lọt ra ngoài khoang và sàn
        openGate(g, L, 'iron'); openGate(g, L, 'boss');
        const key = (x, y, z) => x + ',' + y + ',' + z, allowed = new Set();
        for (const [x, y, z] of L.cavList) allowed.add(key(x, y, z));
        for (const [x, y, z] of L.floorList) allowed.add(key(x, y, z));
        for (const d of L.darts) allowed.add(key(d.x, d.y, d.z));
        const lxMin = site.ox - 2 * site.steps, seen = new Set([key(L.foot.x, site.fy, L.foot.z)]), q = [[L.foot.x, site.fy, L.foot.z]];
        let leaks = 0;
        for (let i = 0; i < q.length; i++) {
          const [x, y, z] = q[i];
          for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const nx = x + dx, ny = y + dy, nz = z + dz, k = key(nx, ny, nz);
            if (seen.has(k) || nx < lxMin) continue;
            const b = g.world.get(nx, ny, nz), def = BLOCKS[b];
            if (def.solid && def.hardness < 0) continue;                  // tường bất khả xâm phạm
            seen.add(k); if (!allowed.has(k)) leaks++; else q.push([nx, ny, nz]);
          }
        }
        out[id] = { sample, diggable, gateOk, chestOk, leaks, reached: seen.size, cav: L.cavList.length };
      }
      return out;
    """)
    for id, o in r.items():
        assert o['sample'] > 100 and o['diggable'] == 0 and o['gateOk'] and o['chestOk'], (id, o)
        assert o['leaks'] == 0 and o['reached'] > 3000, (id, o)


@test
def test_dungeon_guard_room_waves_scale_with_players(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const out = {};
      // một người: 4 quái thường, rồi 2 giây sau 3 quái thường + 1 tượng đá
      let T = mkDg(); let { g, p, L, id } = T; const allowed = DC.DUNGEONS[id].mobs;
      T.stand(L.p2c.x, L.p2c.z); T.secs(0.2);
      const w1 = dgMobs(g, id); out.w1 = { n: w1.length, ok: w1.every(e => allowed.includes(e.type) && e.persist), statue: w1.filter(e => e.type === 'tuong-da').length };
      for (const e of w1) g.ents.delete(e.id);
      T.secs(1.6); out.early = dgMobs(g, id).length; T.secs(0.5);
      const w2 = dgMobs(g, id); out.w2 = { n: w2.length, statue: w2.filter(e => e.type === 'tuong-da').length, others: w2.filter(e => e.type !== 'tuong-da').every(e => allowed.includes(e.type)) };
      // ba người trong phòng: +1 và +2 quái thường mỗi đợt (người thứ hai, ba vào phòng)
      T = mkDg(); ({ g, p, L, id } = T);
      const q2 = g.addPlayer('u2', 'B'), q3 = g.addPlayer('u3', 'C'); q2.maxHp = q2.hp = 1000; q3.maxHp = q3.hp = 1000;
      T.stand(L.p2c.x, L.p2c.z); T.stand(L.p2c.x + 2, L.p2c.z + 1, undefined, q2); T.stand(L.p2c.x - 2, L.p2c.z - 1, undefined, q3);
      T.secs(0.2); const a1 = dgMobs(g, id); out.three1 = a1.length;
      for (const e of a1) g.ents.delete(e.id);
      T.secs(2.2); const a2 = dgMobs(g, id); out.three2 = { n: a2.length, statue: a2.filter(e => e.type === 'tuong-da').length };
      // tám người ảo (5 là tối đa) không vượt trần +4
      T = mkDg(); ({ g, p, L, id } = T);
      for (let i = 2; i <= 6; i++) { const q = g.addPlayer('x' + i, 'X' + i); q.maxHp = q.hp = 1000; T.stand(L.p2c.x + (i % 3) - 1, L.p2c.z + (i % 2), undefined, q); }
      T.stand(L.p2c.x, L.p2c.z); T.secs(0.2); out.six = dgMobs(g, id).length;
      return out;
    """)
    assert r['w1'] == {'n': 4, 'ok': True, 'statue': 0}, r
    assert r['early'] == 0 and r['w2'] == {'n': 4, 'statue': 1, 'others': True}, r
    assert r['three1'] == 6 and r['three2'] == {'n': 6, 'statue': 1}, r
    assert r['six'] == 8, r


@test
def test_dungeon_guard_room_gives_up_when_left_clears_and_stays_cleared(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const T = mkDg(); const { g, p, L, id, site } = T; const out = {};
      T.stand(L.p2c.x, L.p2c.z); T.secs(0.2); out.spawned = dgMobs(g, id).length;
      // rời xa (> 30 block): quái bị xoá, phòng chưa dọn, quay lại thì bắt đầu lại từ đợt 1
      T.stand(site.x, site.z, site.gy); T.secs(0.3);
      out.afterLeave = dgMobs(g, id).length; out.cleared1 = !!(g.flags.dungeons && g.flags.dungeons[id] && g.flags.dungeons[id].rooms.p2);
      T.stand(L.p2c.x, L.p2c.z); T.secs(0.2); out.again = dgMobs(g, id).length;
      // dọn hai đợt: cờ đã dọn, quái không sinh lại
      for (const e of dgMobs(g, id)) g.ents.delete(e.id); T.secs(2.2);
      for (const e of dgMobs(g, id)) g.ents.delete(e.id); T.secs(0.3);
      out.cleared = g.flags.dungeons[id].rooms.p2 === true; out.left = dgMobs(g, id).length;
      T.stand(site.x, site.z, site.gy); T.secs(0.3); T.stand(L.p2c.x, L.p2c.z); T.secs(1);
      out.noRespawn = dgMobs(g, id).length;
      // rương chiến thắng mở được sau khi dọn
      T.stand(L.chests.victory.x, L.chests.victory.z + 1); out.chest = g.act('u1', { t: 'dchest', ...L.chests.victory }).ok;
      return out;
    """)
    assert r['spawned'] == 4 and r['afterLeave'] == 0 and not r['cleared1'] and r['again'] == 4, r
    assert r['cleared'] and r['left'] == 0 and r['noRespawn'] == 0 and r['chest'], r


@test
def test_dungeon_spike_floor_hurts_by_rhythm_only(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const T = mkDg('ham-re-muc'), { g, p, L, site } = T, s = L.spikes.find(x => x.off === 0), out = {};
      T.stand(s.x, s.z); g.time = 0;
      T.secs(1.9); out.hp0 = p.hp;                       // hạ 1,5 s + báo hiệu 0,5 s: không đau
      T.secs(2.1); out.hit = 1000 - p.hp;                // nhô 2 s: 3 lần chạm cách nhau >= 0,8 s
      // nhảy qua (chân cao hơn 0,6): không đau
      p.hp = 1000; g.time = 0; T.secs(2.05); T.stand(s.x, s.z, site.fy + 0.8); T.secs(1.5); out.jump = 1000 - p.hp;
      // hàng lệch pha 2 s: lúc hàng này hạ thì hàng kia nhô
      const s2 = L.spikes.find(x => x.off === 2); p.hp = 1000; p.spikeAt = 0; g.time = 0; T.stand(s2.x, s2.z); T.secs(1.9); out.offRow = 1000 - p.hp;
      // giáp làm nhẹ đòn gai (qua giáp)
      const q = g.addPlayer('u2', 'B'); q.maxHp = q.hp = 1000; q.armor.chest = 'iron_chest'; q.armor.head = 'iron_helm'; q.armor.legs = 'iron_legs'; q.armor.boots = 'iron_boots';
      T.stand(s.x, s.z, undefined, q); p.hp = 1000; T.stand(L.p2c.x, L.p2c.z); g.time = 2.0; T.secs(0.1); out.armor = 1000 - q.hp;
      return out;
    """)
    assert r['hp0'] == 1000 and r['hit'] == 12 and r['jump'] == 0, r
    assert r['offRow'] == 12, r                                     # hàng lệch 2 s: nhô ngay từ đầu (3 lần chạm trong 1,9 s)
    assert 1 <= r['armor'] <= 3, r


@test
def test_dungeon_dart_plate_fires_two_arrows_after_a_delay_and_sneak_is_safe(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const T = mkDg('ham-re-muc'), { g, p, L, site } = T, out = {};
      const pl = L.plates[0], rows = L.darts.filter(d => d.pair === pl.pair).map(d => d.z), arrows = () => [...g.ents.values()].filter(e => e.kind === 'proj');
      T.stand(pl.x, pl.z); T.secs(0.25); out.at02 = arrows().length;       // chưa tới 0,3 s
      T.secs(0.2); out.at03 = arrows().length; out.dmg = arrows().map(a => a.dmg);
      // người đứng ở hàng bắn của một ống: trúng đúng 1 mũi (5), mũi kia bay qua hàng khác
      T.stand(pl.x - 1, rows[0]); p.hp = 1000; T.secs(1.2); out.hurt = 1000 - p.hp;
      // tấm hồi 5 giây: bước lại tấm trong thời gian chờ không bắn nữa, hết thời gian chờ thì bắn lại
      for (const a of arrows()) g.ents.delete(a.id);
      T.stand(pl.x, pl.z); T.secs(1); out.cd = arrows().length; T.secs(2); out.cd2 = arrows().length;
      T.stand(L.p2c.x, L.p2c.z); T.secs(2); T.stand(pl.x, pl.z); T.secs(0.5); out.again = arrows().length;
      // rón rén: giẫm tấm không kích hoạt
      for (const a of arrows()) g.ents.delete(a.id);
      const T2 = mkDg('ham-re-muc'); const q = T2.p; q.sneak = true; T2.stand(T2.L.plates[0].x, T2.L.plates[0].z); T2.secs(1);
      out.sneak = [...T2.g.ents.values()].filter(e => e.kind === 'proj').length;
      return out;
    """)
    assert r['at02'] == 0 and r['at03'] == 2 and r['dmg'] == [5, 5], r
    assert r['hurt'] == 5, r
    assert r['cd'] == 0 and r['cd2'] == 0 and r['again'] == 2, r
    assert r['sneak'] == 0, r


@test
def test_dungeon_vent_sprays_once_per_burst_in_radius(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const T = mkDg('ham-cat-chon'), { g, p, L, site } = T, v = L.vents.find(x => x.off === 0), out = {};
      const kicks = []; const stand = () => T.stand(v.x, v.z);
      stand(); g.time = 0; g.drain();
      T.secs(3.2); out.rest = 1000 - p.hp;                  // nghỉ 3,2 s
      T.secs(0.95); out.warn = 1000 - p.hp;                 // báo hiệu 1,0 s: chưa đau (còn 0,05 s tới lúc phun)
      T.secs(0.8); out.spray = 1000 - p.hp;                 // phun 0,8 s: đúng 1 lần
      out.kick = g.drain().filter(o => o.ev.t === 'kb' && o.ev.vy === 5).length;
      T.secs(4.9); out.next = 1000 - p.hp;                  // đợt phun kế (9,2 - 10,0 s)
      // ngoài bán kính 1,6: không đau; trong bán kính: đau
      p.hp = 1000; g.time = 4.1; p.ventAt = {}; T.stand(v.x + 2, v.z); T.secs(1); out.outside = 1000 - p.hp;
      g.time = 4.1; p.ventAt = {}; T.stand(v.x + 1, v.z); T.secs(1); out.inside = 1000 - p.hp;
      return out;
    """)
    assert r['rest'] == 0 and r['warn'] == 0 and r['spray'] == 6 and r['kick'] == 1 and r['next'] == 12, r
    assert r['outside'] == 0 and r['inside'] == 6, r


@test
def test_dungeon_traps_can_be_disarmed_with_a_pick_and_spikes_can_be_covered(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const out = {};
      // hầm 1: tấm áp lực và ống tên
      let T = mkDg('ham-re-muc'); let { g, p, L, site } = T;
      T.hold('wood_pick'); const pl = L.plates[0], dts = L.darts.filter(d => d.pair === pl.pair);
      out.breakTime = g.breakTime(p.uid, pl.x, pl.y, pl.z);
      T.stand(pl.x, pl.z - 1); out.plateBreak = smash(g, p, pl.x, pl.y, pl.z).ok; out.plateAfter = g.world.get(pl.x, pl.y, pl.z) !== 0 && g.world.get(pl.x, pl.y, pl.z) !== B.PLATE;
      T.stand(pl.x, pl.z); T.secs(0.6); out.afterPlate = [...g.ents.values()].filter(e => e.kind === 'proj').length;
      const plB = L.plates[2];                                             // cùng cặp ống với tấm đã phá; ống đầu của cặp bị phá thì chỉ còn 1 mũi tên
      T.stand(dts[0].x - 2, dts[0].z - 1); out.dartBreak = smash(g, p, dts[0].x, dts[0].y, dts[0].z).ok;
      T.stand(plB.x, plB.z); T.secs(0.5); out.pair1 = [...g.ents.values()].filter(e => e.kind === 'proj').length;
      // hầm 2: ống phun
      T = mkDg('ham-cat-chon'); ({ g, p, L, site } = T); T.hold('wood_pick');
      const v = L.vents.find(x => x.off === 0); T.stand(v.x, v.z - 2); out.ventBreak = smash(g, p, v.x, v.y, v.z).ok;
      T.stand(v.x, v.z); g.time = 4.1; p.hp = 1000; T.secs(1); out.ventHurt = 1000 - p.hp;
      // đặt block lên gai: không được khi gai nhô, được khi gai hạ, và gai hết hiệu lực
      const s = L.spikes[0]; p.hp = 1000; T.give('planks', 4); T.hold('planks'); T.stand(s.x, s.z - 3);
      g.time = 3; const up = g.act('u1', { t: 'place', x: s.x, y: site.fy, z: s.z });
      g.time = 0.5; const down = g.act('u1', { t: 'place', x: s.x, y: site.fy, z: s.z });
      out.coverUp = up.reason; out.coverDown = down.ok; out.spikeGone = g.world.get(s.x, site.fy - 1, s.z) !== B.SPIKES;
      return out;
    """)
    assert r['breakTime'] <= 2 and r['plateBreak'] and r['plateAfter'] and r['afterPlate'] == 0, r
    assert r['dartBreak'] and r['pair1'] == 1, r
    assert r['ventBreak'] and r['ventHurt'] == 0, r
    assert r['coverUp'] == 'spike-up' and r['coverDown'] and r['spikeGone'], r


@test
def test_dungeon_gates_need_the_right_key_and_stay_open_for_everyone(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const T = mkDg(), { g, p, L, id, site } = T, out = {}, gi = L.gates.iron.cells[4], gb = L.gates.boss.cells[4];
      const q = g.addPlayer('u2', 'B'); q.maxHp = q.hp = 1000;
      T.stand(gi[0], gi[2] + 2); T.stand(gi[0], gi[2] + 3, undefined, q);
      const before = p.inv.map(s => s && { ...s });
      g.drain(); const r0 = g.act('u1', { t: 'gate', x: gi[0], y: gi[1], z: gi[2] });
      out.noKey = { ok: r0.ok, reason: r0.reason, same: JSON.stringify(before) === JSON.stringify(p.inv), closed: g.world.get(gi[0], gi[1], gi[2]) === B.GATE_IRON, toast: g.drain().some(o => o.ev.t === 'toast' && /Chìa Hầm/.test(o.ev.text)) };
      T.give('boss_key', 1); const r1 = g.act('u1', { t: 'gate', x: gi[0], y: gi[1], z: gi[2] });
      out.wrongKey = { ok: r1.ok, boss: cnt(p, 'boss_key'), closed: g.world.get(gi[0], gi[1], gi[2]) === B.GATE_IRON };
      T.give('dungeon_key', 2); const evs = (g.drain(), 0);
      const r2 = g.act('u1', { t: 'gate', x: gi[0], y: gi[1], z: gi[2] });
      const blocks = g.drain().filter(o => o.ev.t === 'block').length;
      out.open = { ok: r2.ok, keys: cnt(p, 'dungeon_key'), allAir: L.gates.iron.cells.every(([x, y, z]) => g.world.get(x, y, z) === 0), blocks, flag: g.flags.dungeons[id].gates.g };
      // người thứ hai (không có chìa) đi qua được
      out.pass = pathExists(g, { x: L.foot.x, y: site.fy, z: L.foot.z }, { x: L.chests.trap.x, y: site.fy, z: L.chests.trap.z + 1 });
      // cổng chủ: chìa sai loại không mở, đúng loại mở; ở xa thì không với tới
      T.give('boss_key', 1); T.stand(gb[0] + 9, gb[2]); const far0 = g.act('u1', { t: 'gate', x: gb[0], y: gb[1], z: gb[2] });
      for (let i = 0; i < p.inv.length; i++) if (p.inv[i] && p.inv[i].id === 'boss_key') p.inv[i] = null;
      T.give('dungeon_key', 1); T.stand(gb[0] + 2, gb[2]); const r3 = g.act('u1', { t: 'gate', x: gb[0], y: gb[1], z: gb[2] });
      T.give('boss_key', 1); const r4 = g.act('u1', { t: 'gate', x: gb[0], y: gb[1], z: gb[2] });
      out.boss = { far: far0.ok, farReason: far0.reason, wrong: r3.ok, wrongReason: r3.reason, ok: r4.ok, allAir: L.gates.boss.cells.every(([x, y, z]) => g.world.get(x, y, z) === 0), keys: cnt(p, 'boss_key') };
      const rfar = (T.stand(L.foot.x, L.foot.z + 0), g.act('u1', { t: 'gate', x: gb[0], y: gb[1], z: gb[2] }));
      // tham số bậy không ném lỗi
      out.garbage = [null, {}, { x: 'a' }, { x: 1.5, y: 2, z: 3 }].map(a => { try { return g.act('u1', { t: 'gate', ...(a || {}) }).ok; } catch (e) { return 'throw'; } });
      out.garbage2 = [{}, { x: NaN, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }].map(a => { try { return g.act('u1', { t: 'dchest', ...a }).ok; } catch (e) { return 'throw'; } });
      return out;
    """)
    assert r['noKey']['ok'] is False and r['noKey']['reason'] == 'need-key' and r['noKey']['same'] and r['noKey']['closed'] and r['noKey']['toast'], r
    assert r['wrongKey']['ok'] is False and r['wrongKey']['boss'] == 1 and r['wrongKey']['closed'], r
    assert r['open']['ok'] and r['open']['keys'] == 1 and r['open']['allAir'] and r['open']['blocks'] == 9 and r['open']['flag'] is True and r['pass'], r
    assert r['boss']['far'] is False and r['boss']['farReason'] == 'reach' and r['boss']['wrong'] is False and r['boss']['wrongReason'] == 'need-boss-key' and r['boss']['ok'] and r['boss']['allAir'] and r['boss']['keys'] == 0, r
    assert 'throw' not in r['garbage'] and 'throw' not in r['garbage2'], r


@test
def test_dungeon_chests_pay_each_player_once_deterministically(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const T = mkDg(), { g, p, L, id, site } = T, out = {};
      const q = g.addPlayer('u2', 'B'); q.maxHp = q.hp = 1000;
      const c = L.chests.supply, ch = (k) => L.chests[k];
      T.stand(c.x, c.z + 1); T.stand(c.x + 1, c.z + 1, undefined, q);
      const expect = D.rewardFor(g, id, 'supply', 'u1'); out.again = JSON.stringify(expect) === JSON.stringify(D.rewardFor(g, id, 'supply', 'u1'));
      const xu0 = cnt(p, 'xu'); g.drain(); const r1 = g.act('u1', { t: 'dchest', ...c });
      const ev1 = g.drain().filter(o => o.to === 'u1' && o.ev.t === 'loot');
      out.first = { ok: r1.ok, xu: cnt(p, 'xu') - xu0, want: expect.find(i => i.item === 'xu').n, loot: ev1.length, items: ev1[0] && ev1[0].ev.items.length, claimedFlag: [...g.flags.dungeons[id].claimed.supply] };
      const inv1 = JSON.stringify(p.inv); const r2 = g.act('u1', { t: 'dchest', ...c }); const ev2 = g.drain().filter(o => o.ev.t === 'loot');
      out.second = { same: inv1 === JSON.stringify(p.inv), claimed: ev2.length && ev2[0].ev.claimed === true, ok: r2.ok };
      const r3 = g.act('u2', { t: 'dchest', ...c }); out.other = { ok: r3.ok, xu: cnt(q, 'xu'), want: D.rewardFor(g, id, 'supply', 'u2').find(i => i.item === 'xu').n, claimed: g.flags.dungeons[id].claimed.supply };
      // khoảng giá trị và xác suất theo bảng (nhiều uid ảo)
      const tally = {}; for (let i = 0; i < 400; i++) for (const k of ['supply', 'victory', 'trap', 'treasure']) for (const it of D.rewardFor(g, id, k, 'z' + i)) { const t = tally[k + '.' + it.item] = tally[k + '.' + it.item] || { n: 0, lo: 1e9, hi: 0 }; t.n++; t.lo = Math.min(t.lo, it.n); t.hi = Math.max(t.hi, it.n); }
      out.tally = tally;
      let armorN = 0; for (let i = 0; i < 400; i++) if (D.rewardFor(g, id, 'treasure', 'z' + i).some(it => /_(helm|chest|legs|boots)$/.test(it.item))) armorN++; out.armorN = armorN;
      // kho đầy: phần dư rơi xuống đất, không mất
      const T2 = mkDg(); const { g: g2, p: p2, L: L2 } = T2; for (let i = 0; i < p2.inv.length; i++) p2.inv[i] = { id: 'wood_sword', n: 1 };
      T2.stand(L2.chests.supply.x, L2.chests.supply.z + 1); const dropped0 = [...g2.ents.values()].filter(e => e.kind === 'item').length; g2.act('u1', { t: 'dchest', ...L2.chests.supply });
      out.full = { dropped: [...g2.ents.values()].filter(e => e.kind === 'item').length - dropped0 };
      return out;
    """)
    assert r['again'] and r['first']['ok'] and r['first']['xu'] == r['first']['want'] and r['first']['loot'] == 1 and r['first']['claimedFlag'] == ['u1'], r
    assert r['second']['same'] and r['second']['claimed'] and r['second']['ok'], r
    assert r['other']['ok'] and r['other']['xu'] == r['other']['want'] and r['other']['claimed'] == ['u1', 'u2'], r
    t = r['tally']
    assert t['victory.dungeon_key']['n'] == 400 and t['victory.dungeon_key']['lo'] == 1 == t['victory.dungeon_key']['hi'], t
    assert t['trap.boss_key']['n'] == 400 and t['treasure.xu']['n'] == 400 and 120 <= t['treasure.xu']['lo'] and t['treasure.xu']['hi'] <= 200, t
    assert 10 <= t['supply.xu']['lo'] and t['supply.xu']['hi'] <= 25 and 20 <= t['victory.xu']['lo'] and t['victory.xu']['hi'] <= 40 and 30 <= t['trap.xu']['lo'] and t['trap.xu']['hi'] <= 60, t
    assert 0.45 * 400 <= t['supply.heal_potion']['n'] <= 0.75 * 400 and 0.15 * 400 <= r['armorN'] <= 0.35 * 400, (t, r['armorN'])
    assert r['full']['dropped'] >= 1, r


@test
def test_dungeon_chest_unlock_conditions(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const T = mkDg(), { g, p, L, id, site } = T, out = {};
      const open = k => { const c = L.chests[k]; T.stand(c.x, c.z + 1); return g.act('u1', { t: 'dchest', ...c }); };
      out.supply = open('supply').ok; out.trap = open('trap').ok;
      const v = open('victory'); out.victory0 = { ok: v.ok, reason: v.reason };
      out.treasureBlock0 = g.world.get(L.chests.treasure.x, L.chests.treasure.y, L.chests.treasure.z);
      const t0 = open('treasure'); out.treasure0 = { ok: t0.ok };
      g.flags.dungeons[id].rooms.p2 = true; out.victory1 = open('victory').ok;
      // hạ chủ hầm: rương kho báu xuất hiện
      T.stand(L.p4c.x + 3, L.p4c.z); T.secs(0.3);
      const boss = [...g.ents.values()].find(e => e.kind === 'boss'); out.boss = !!boss;
      boss.hp = 1; g.damageEntity(boss, 5, p);
      out.treasureBlock1 = g.world.get(L.chests.treasure.x, L.chests.treasure.y, L.chests.treasure.z) === B.DCHEST; out.bossFlag = g.flags.dungeons[id].boss;
      const t1 = open('treasure'); out.treasure1 = { ok: t1.ok, shard: cnt(p, 'ancient_shard') >= 3, gem: cnt(p, 'gem') >= 2 };
      return out;
    """)
    assert r['supply'] and r['trap'] and r['victory0'] == {'ok': False, 'reason': 'locked'} and r['victory1'], r
    assert r['treasureBlock0'] == 0 and not r['treasure0']['ok'] and r['boss'] and r['treasureBlock1'] and r['bossFlag'] is True, r
    assert r['treasure1']['ok'] and r['treasure1']['shard'] and r['treasure1']['gem'], r


@test
def test_dungeon_six_bosses_phases_scaling_reset_and_drops(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const g = new Game({ seed: 777, spawning: false, env: false, hunger: false }); const ids = Object.keys(DC.DUNGEONS), out = {};
      const p = g.addPlayer('u1', 'T'); p.maxHp = p.hp = 100000;
      ids.forEach((id, i) => D.forceSite(g, id, 2000 + (i % 3) * 170, 2000 + Math.floor(i / 3) * 170));
      const step = (t, dt = 0.05) => { for (let i = 0; i < Math.round(t / dt); i++) { g.tick(dt); p.hp = p.maxHp; } };
      ids.forEach((id, i) => {
        const site = g.flags.sites.dungeon[id], L = D.layoutOf(site, id), bid = DC.DUNGEONS[id].boss, d = BOSSES[bid];
        p.x = L.p4c.x + 3.5; p.y = site.fy; p.z = L.p4c.z + 0.5; p.vx = p.vy = p.vz = 0;
        step(0.3); const b = [...g.ents.values()].find(e => e.kind === 'boss' && e.type === bid);
        const o = { spawned: !!b, hp: b && b.maxHp, want: d.hp, phases: d.phases.map(x => x.from), mul: d.phases.map(x => [x.speedMul, x.dmgMul]), dungeon: d.dungeon === id, flag: d.flag === 'boss:' + bid };
        const ph = f => { b.hp = b.maxHp * f; step(0.1); return b.phase; };
        o.ph = [ph(0.6), ph(0.5), ph(0.2)]; o.cur = [b.speedMul, b.dmgMul];
        // thêm một người trong phòng: máu x 1,6
        const q = g.addPlayer('v' + i, 'V'); q.maxHp = q.hp = 100000; q.x = L.p4c.x - 2.5; q.y = site.fy; q.z = L.p4c.z + 0.5; step(0.2); o.scaled = Math.round(b.maxHp); o.scaleWant = Math.round(d.hp * 1.6); g.removePlayer('v' + i);
        // rời hết 5 giây: boss reset
        p.x = site.x + 0.5; p.y = site.gy; p.z = site.z + 0.5; step(5.4); o.reset = ![...g.ents.values()].some(e => e.kind === 'boss' && e.type === bid);
        // vào lại, hạ boss: cờ, xu và Mảnh Cổ Vật
        p.x = L.p4c.x + 3.5; p.y = site.fy; p.z = L.p4c.z + 0.5; step(0.3);
        const b2 = [...g.ents.values()].find(e => e.kind === 'boss' && e.type === bid); const before = new Set([...g.ents.values()].filter(e => e.kind === 'item').map(e => e.id));
        b2.hp = 1; g.damageEntity(b2, 5, p);
        const drops = [...g.ents.values()].filter(e => e.kind === 'item' && !before.has(e.id));
        o.flagSet = g.flags['boss:' + bid] === true; o.xu = drops.filter(e => e.item === 'xu').reduce((a, e) => a + e.n, 0); o.shard = drops.filter(e => e.item === 'ancient_shard').reduce((a, e) => a + e.n, 0);
        o.xuRange = [d.drops[0].min, d.drops[0].max];
        // đã hạ: vào lại không sinh nữa
        p.x = site.x + 0.5; p.y = site.gy; step(0.3); p.x = L.p4c.x + 3.5; p.y = site.fy; step(0.4); o.again = [...g.ents.values()].some(e => e.kind === 'boss' && e.type === bid);
        // chuỗi lưu: nạp lại không sinh boss
        out[id] = o;
      });
      return out;
    """)
    for i, (id, o) in enumerate(r.items()):
        assert o['spawned'] and o['hp'] == o['want'] and o['phases'] == [1.0, 0.55, 0.25] and o['mul'] == [[1, 1], [1.1, 1], [1.3, 1.3]] and o['dungeon'] and o['flag'], (id, o)
        assert o['ph'] == [0, 1, 2] and o['cur'] == [1.3, 1.3], (id, o)
        assert o['scaled'] == o['scaleWant'] and o['reset'], (id, o)
        assert o['flagSet'] and o['xuRange'][0] == 80 + 20 * i and o['xuRange'][0] <= o['xu'] <= o['xuRange'][1] and 2 <= o['shard'] <= 4 and not o['again'], (id, o)


@test
def test_dungeon_quests_item_recipes_and_potion(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const { QUESTS } = await imp('content/quests.js'); const { NPCS } = await imp('content/npcs.js'); const { RECIPES } = await imp('content/recipes.js'); const { SHOPS } = await imp('content/shops.js');
      const out = { quests: [] }, Q = await imp('sim/quests.js');
      const g = new Game({ seed: 777, spawning: false, env: false, hunger: false }); const p = g.addPlayer('u1', 'T');
      Object.values(BOSSES).forEach(b => { if (!b.dungeon) g.flags[b.flag] = true; });
      Object.keys(DC.DUNGEONS).forEach((id, i) => {
        const qid = 'don-' + id, q = QUESTS[qid], bossId = DC.DUNGEONS[id].boss;
        const accept = g.acceptQuest('u1', qid), st0 = g.questState('u1', qid);
        const npcNodes = JSON.stringify(NPCS[q.giver].nodes);
        g.onBossDefeated(bossId, [p]); g.flags[BOSSES[bossId].flag] = true;
        const st1 = g.questState('u1', qid), xu0 = cnt(p, 'xu'), tin = Q.turnIn(g, p, qid);
        out.quests.push({ qid, giver: q.giver, accept: accept.ok, st0, st1, tin: tin.ok, xu: cnt(p, 'xu') - xu0, want: q.reward.items.find(x => x.item === 'xu').n, hasNodes: npcNodes.includes(`accept":"${qid}`) && npcNodes.includes(`turnin":"${qid}`) });
      });
      return out;
    """)
    for i, q in enumerate(r['quests']):
        assert q['accept'] and q['st0'] == 'active' and q['st1'] == 'ready' and q['tin'] and q['xu'] == q['want'] == 100 + 20 * i and q['hasNodes'], q
    r2 = ev(pg, DUNGEON_JS + r"""
      const { RECIPES } = await imp('content/recipes.js'); const { SHOPS } = await imp('content/shops.js'); const { stationOf } = await imp('sim/crafting.js');
      const T = mkDg(), { g, p } = T; const out = {};
      out.recipes = ['ancient_pick', 'delver_blade'].map(id => { const r = RECIPES.find(x => x.id === id); return [JSON.stringify(r.in), stationOf(r)]; });
      T.stand(2000, 2010, 40); T.give('ancient_shard', 13); T.give('stick', 2); T.give('iron_ingot', 2); T.give('crystal', 1);
      const wb = g.act('u1', { t: 'craft', id: 'ancient_pick' }).ok;                                 // chưa có đe rèn
      g.world.set(2001, 40, 2010, B.ANVIL); g.world.set(2002, 40, 2010, B.WORKBENCH);
      out.noAnvil = wb; out.pick = g.act('u1', { t: 'craft', id: 'ancient_pick' }).ok; out.blade = g.act('u1', { t: 'craft', id: 'delver_blade' }).ok;
      out.left = cnt(p, 'ancient_shard'); out.stats = { pick: ITEMS.ancient_pick.tool, pickDmg: ITEMS.ancient_pick.dmg, blade: ITEMS.delver_blade.dmg, bladeTier: ITEMS.delver_blade.tool.tier, relic: ITEMS.delver_blade.relic };
      // bình hồi máu hồi 12, không vượt máu tối đa
      p.maxHp = 20; p.hp = 5; T.give('heal_potion', 2); T.hold('heal_potion'); const e1 = g.act('u1', { t: 'use' }); const h1 = p.hp; p.eatAt = -99; p.hp = 15; const e2 = g.act('u1', { t: 'use' });
      out.potion = [e1.ok, h1, e2.ok, p.hp, cnt(p, 'heal_potion'), ITEMS.heal_potion.stack];
      out.shop = SHOPS['thuong-nhan'].buys.filter(x => ['ancient_shard', 'heal_potion'].includes(x.item)).map(x => [x.item, x.price]);
      return out;
    """)
    assert r2['recipes'][0] == ['{"ancient_shard":5,"stick":2}', 'anvil'] and r2['recipes'][1] == ['{"ancient_shard":8,"iron_ingot":2,"crystal":1}', 'anvil'], r2
    assert not r2['noAnvil'] and r2['pick'] and r2['blade'] and r2['left'] == 0, r2
    assert r2['stats'] == {'pick': {'type': 'pick', 'tier': 3, 'speed': 6.5}, 'pickDmg': 5, 'blade': 12, 'bladeTier': 3, 'relic': True}, r2
    assert r2['potion'] == [True, 17, True, 20, 0, 16] and sorted(r2['shop']) == [['ancient_shard', 25], ['heal_potion', 10]], r2


@test
def test_dungeon_save_load_keeps_progress_and_old_worlds_get_dungeons(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const { Game: GM } = await imp('sim/game.js'); const out = {};
      let T = mkDg(), { g, p, L, id, site } = T;
      T.stand(L.foot.x, L.foot.z); T.give('dungeon_key', 1); const gi = L.gates.iron.cells[4]; T.stand(gi[0], gi[2] + 2); g.act('u1', { t: 'gate', x: gi[0], y: gi[1], z: gi[2] });
      g.flags.dungeons[id].rooms.p2 = true;
      const c = L.chests.supply; T.stand(c.x, c.z + 1); g.act('u1', { t: 'dchest', ...c });
      T.hold('wood_pick'); const pl = L.plates[0]; T.stand(pl.x, pl.z - 1); smash(g, p, pl.x, pl.y, pl.z);
      T.stand(L.p4c.x + 3, L.p4c.z); T.secs(0.3); const boss = [...g.ents.values()].find(e => e.kind === 'boss'); boss.hp = 1; g.damageEntity(boss, 5, p);
      const save = JSON.parse(JSON.stringify(g.toSave())), g2 = GM.fromSave(save, { spawning: false, env: false, hunger: false });
      const p2 = g2.addPlayer('u1', 'T');
      out.gates = { iron: L.gates.iron.cells.every(([x, y, z]) => g2.world.get(x, y, z) === 0), boss: L.gates.boss.cells.every(([x, y, z]) => g2.world.get(x, y, z) === B.GATE_BOSS) };
      out.flags = JSON.stringify(g2.flags.dungeons[id]) === JSON.stringify(g.flags.dungeons[id]); out.claimed = g2.flags.dungeons[id].claimed.supply;
      out.plate = g2.world.get(pl.x, pl.y, pl.z) !== B.PLATE; out.treasure = g2.world.get(L.chests.treasure.x, L.chests.treasure.y, L.chests.treasure.z) === B.DCHEST;
      p2.x = c.x + 0.5; p2.y = site.fy; p2.z = c.z + 1.5; const xu0 = cnt(p2, 'xu'); const rr = g2.act('u1', { t: 'dchest', ...c }); out.reopen = { ok: rr.ok, claimed: rr.claimed, xu: cnt(p2, 'xu') - xu0 };
      p2.x = L.p4c.x + 3.5; p2.y = site.fy; p2.z = L.p4c.z + 0.5; for (let i = 0; i < 10; i++) g2.tick(0.05); out.noBoss = ![...g2.ents.values()].some(e => e.kind === 'boss');
      out.sites = Object.keys(g2.flags.sites.dungeon).length;
      return out;
    """)
    assert r['gates'] == {'iron': True, 'boss': True} and r['flags'] and r['claimed'] == ['u1'] and r['plate'] and r['treasure'], r
    assert r['reopen'] == {'ok': True, 'claimed': True, 'xu': 0} and r['noBoss'], r

    r = ev(pg, GAME_JS + r"""
      const D = await imp('sim/dungeon.js'); const S = await imp('sim/structures.js'); const { Game: GM } = await imp('sim/game.js'); const { DUNGEONS } = await imp('content/dungeons.js'); const { B } = await imp('world/blocks.js');
      const old = new Game({ seed: 777, spawning: false }); S.buildStructures(old, { dungeons: false });
      const arenas = JSON.stringify(old.flags.sites.arena), villages = JSON.stringify(old.flags.sites.village), hadDungeons = !!(old.flags.sites.dungeon && Object.keys(old.flags.sites.dungeon).length) || !!old.flags.dungeons;
      const save = JSON.parse(JSON.stringify(old.toSave()));
      // 1) nạp save cũ (không có dungeons): đủ 6 hầm, công trình cũ không dịch chỗ
      const t = performance.now(); const g1 = GM.fromSave(JSON.parse(JSON.stringify(save)), { spawning: false }); const ms = performance.now() - t;
      const s1 = g1.flags.sites.dungeon, out = { had: hadDungeons, n: Object.keys(s1).length, same: JSON.stringify(g1.flags.sites.arena) === arenas && JSON.stringify(g1.flags.sites.village) === villages, ms };
      // 2) một chunk trong hộp bao của hầm Rễ Mục đã bị người chơi chỉnh sửa: hầm đó chuyển chỗ khác, khối đã đặt còn nguyên
      const target = s1['ham-re-muc']; const save2 = JSON.parse(JSON.stringify(save));
      const edit = new GM({ seed: 777, spawning: false }); edit.world.importDelta(save2.delta);
      const ex = target.c.x + 3, ez = target.c.z + 2, ey = edit.world.surfaceY(ex, ez) + 1; edit.world.set(ex, ey, ez, B.PLANKS); save2.delta = edit.world.exportDelta();
      const g2 = GM.fromSave(save2, { spawning: false }); const s2 = g2.flags.sites.dungeon['ham-re-muc'];
      const b2 = s2 && D.layoutOf(s2, 'ham-re-muc').box; out.moved = !s2 || !(ex >= b2.x0 && ex <= b2.x1 + 1 && ez >= b2.z0 && ez <= b2.z1 + 1); out.kept = g2.world.get(ex, ey, ez) === B.PLANKS; out.others = Object.keys(g2.flags.sites.dungeon).length >= 5;
      return out;
    """)
    assert not r['had'] and r['n'] == 6 and r['same'], r
    assert r['moved'] and r['kept'] and r['others'], r


@test
def test_dungeon_multiplayer_gate_chest_trap_rhythm_and_guard_room(pg):
    r = ev(pg, NET_JS + r"""
      const D = await imp('sim/dungeon.js'); const { B } = await imp('world/blocks.js');
      const { game, host } = await mkHost('DUNGX', { env: false });
      const id = 'ham-re-muc', site = D.forceSite(game, id, 2000, 2000), L = D.layoutOf(site, id);
      const a = await join('DUNGX', 'ua', 'An'), b = await join('DUNGX', 'ub', 'Bình');
      await until(() => game.players.size === 3 && a.snap && b.snap && a.you && b.you);
      const ph = game.player('uh'), pa = game.player('ua'), pb = game.player('ub'); for (const q of [ph, pa, pb]) q.maxHp = q.hp = 1000;
      const out = {}, at = (q, c, dz = 0, dx = 0) => game.teleportPlayer(q, c.x + 0.5 + dx, site.fy, c.z + 0.5 + dz);
      const gi = L.gates.iron.cells[4];
      // host mở cổng sắt bằng chìa của mình: khách thấy cổng biến mất
      at(ph, { x: gi[0], z: gi[2] }, 2); game.giveItem('uh', 'dungeon_key', 1);
      const seenBefore = b.world.get(gi[0], gi[1], gi[2]); host.act({ t: 'gate', x: gi[0], y: gi[1], z: gi[2] });
      await until(() => b.world.get(gi[0], gi[1], gi[2]) === 0 && a.world.get(gi[0], gi[1], gi[2]) === 0); out.gate = [seenBefore, 0];
      // khách B mở rương tiếp tế: chỉ B nhận, A và host không
      const c = L.chests.supply; at(pb, c, 1); await until(() => b.you.dead === false);
      const bx0 = b.you.inv.filter(Boolean).filter(s => s.id === 'xu').reduce((n, s) => n + s.n, 0); let loot = null; b.on('ev', e => { if (e.t === 'loot') loot = e; });
      b.act({ t: 'dchest', ...c }); await until(() => loot);
      out.chest = { items: loot.items.length > 0, bXu: game.player('ub').inv.filter(Boolean).filter(s => s.id === 'xu').reduce((n, s) => n + s.n, 0) > bx0, aXu: game.player('ua').inv.filter(Boolean).filter(s => s.id === 'xu').length, hostXu: ph.inv.filter(Boolean).filter(s => s.id === 'xu').length };
      // nhịp gai: cả hai máy tính cùng pha từ thời gian snapshot (lệch <= 0,25 s)
      await wait(400); const dts = [a.time, b.time].map(t => Math.abs(t - game.time));
      out.sync = { dts, same: D.spikeState(a.time, 0) === D.spikeState(game.time, 0) || Math.max(...dts) <= 0.25 };
      // khách vào P2: quái sinh ở host, sự kiện dungeon về khách, dọn xong thì cờ về khách
      const evs = []; a.on('ev', e => { if (e.t === 'dungeon') evs.push(e); });
      at(pa, L.p2c); await until(() => [...game.ents.values()].filter(e => e.dg === id).length >= 4, 4000); out.spawned = [...game.ents.values()].filter(e => e.dg === id).length;
      await until(() => evs.some(e => e.left >= 4)); 
      for (let k = 0; k < 2; k++) { for (const e of [...game.ents.values()]) if (e.dg === id) game.ents.delete(e.id); await wait(k ? 400 : 2600); }
      await until(() => a.flags.dungeons && a.flags.dungeons[id] && a.flags.dungeons[id].rooms.p2 === true, 4000); out.cleared = true;
      a.leave(); b.leave(); host.leave();
      return out;
    """)
    assert r['gate'][0] == 55 and r['gate'][1] == 0, r
    assert r['chest']['items'] and r['chest']['bXu'] and r['chest']['aXu'] == 0 and r['chest']['hostXu'] == 0, r
    assert r['sync']['same'] and r['spawned'] >= 4 and r['cleared'], r


@test
def test_dungeon_no_natural_spawns_inside_and_dungeon_mobs_are_exempt_from_the_80_rule(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const T = mkDg('ham-re-muc', { spawning: true }), { g, p, L, site, id } = T, out = {};
      out.mouth = [D.nearDungeonMouth(g, site.x + 5, site.z), D.nearDungeonMouth(g, site.x + 9, site.z), !!D.dungeonAt(g.flags, L.p2c.x, site.fy, L.p2c.z)];
      // người đứng cạnh miệng hầm 5 phút giả lập: quái tự nhiên không bao giờ nằm trong khối bao hay quanh miệng hầm
      T.stand(site.x + 8, site.z + 8, site.gy); let bad = 0, spawned = 0, edge = 0;
      for (let i = 0; i < 1500; i++) {                                                  // 1500 giây giả lập (25 phút), xoá quái vừa sinh để trần số lượng không chặn việc sinh
        g.tick(1); p.hp = p.maxHp;
        for (const e of [...g.ents.values()]) if (e.kind === 'mob' && !e.persist) {   // vị trí lúc vừa sinh
          spawned++; g.ents.delete(e.id);
          if (D.dungeonAt(g.flags, e.x, e.y + 0.5, e.z) || Math.hypot(e.x - site.x, e.z - site.z) <= 6.5) bad++;
          if (Math.hypot(e.x - site.x, e.z - site.z) <= 14) edge++;
        }
      }
      out.bad = bad; out.spawned = spawned; out.edge = edge;
      // quái hầm (persist) sống sót khi người chơi ở xa > 80 block; quái thường thì bị xoá
      const m1 = spawnMob(g, 'xac-song', L.spawns[0].x, L.spawns[0].y, L.spawns[0].z, { persist: true, dg: id }), m2 = spawnMob(g, 'xac-song', L.spawns[1].x, L.spawns[1].y, L.spawns[1].z);
      m1.frozen = m2.frozen = true; T.stand(site.x + 200, site.z + 200, 40); g.spawnAcc = 1; g.tick(0.5); g.tick(1.1);
      out.persist = [g.ents.has(m1.id), g.ents.has(m2.id)];
      return out;
    """)
    assert r['mouth'] == [True, False, True] and r['bad'] == 0, r
    assert r['spawned'] >= 150 and r['edge'] >= 3, r                         # có đủ lượt sinh quanh miệng hầm để phép thử có ý nghĩa


@test
def test_dungeon_perf_build_and_trap_tick(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const S = await imp('sim/structures.js'); const out = {};
      const g0 = new Game({ seed: 31337, spawning: false }); S.buildStructures(g0, { dungeons: false });
      const t0 = performance.now(); S.buildStructures(g0); out.buildMs = performance.now() - t0; out.n = Object.keys(g0.flags.sites.dungeon).length;
      out.welcomeKB = JSON.stringify({ delta: g0.world.exportDelta(), flags: g0.flags }).length / 1024;
      // tick của host với 5 người trong P3 (3 chặng bẫy) so với cùng kịch bản ở thế giới không có hầm
      const runCase = (withDg) => {
        const T = withDg ? mkDg('ham-re-muc') : null; const g = withDg ? T.g : new Game({ seed: 777, spawning: false, env: false, hunger: false });
        const ps = []; for (let i = 0; i < 5; i++) { const q = g.addPlayer('p' + i, 'P' + i); q.maxHp = q.hp = 1e6; ps.push(q); }
        const fy = withDg ? T.site.fy : 30, cx = withDg ? T.L.p2c.x - 5 : 2000, cz = withDg ? T.L.p2c.z - 20 : 2000;
        ps.forEach((q, i) => { q.x = cx + 1 + i * 2; q.y = fy; q.z = cz + 0.5 + (i % 3); });
        for (let i = 0; i < 40; i++) g.tick(0.05);
        let sum = 0; const N = 300; for (let i = 0; i < N; i++) { const t = performance.now(); g.tick(0.05); sum += performance.now() - t; for (const q of ps) q.hp = 1e6; }
        return sum / N;
      };
      out.withMs = runCase(true); out.baseMs = runCase(false);
      return out;
    """)
    assert r['n'] == 6 and r['buildMs'] < 1500 and r['welcomeKB'] < 400, r
    assert r['withMs'] - r['baseMs'] < 2, r


@test
def test_dungeon_ui(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate(r"""async () => {
      const G = '/games/the-gioi-khoi/', imp = p => import(G + p), wait = ms => new Promise(r => setTimeout(r, ms));
      const until = async (f, ms = 6000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('hết giờ chờ: ' + String(f).slice(0, 110)); await wait(30); } };
      const g = __g, game = g.game, uid = g.S.uid, p = game.player(uid), D = await imp('sim/dungeon.js'); const { B, TILES, ATLAS_COLS } = await imp('world/blocks.js');
      const { makeAtlas } = await imp('render/atlas.js'); const { createIcons } = await imp('ui/icons.js');
      const out = {}; p.maxHp = p.hp = 1000; game.touch(p);
      // icon vật phẩm mới và tile block mới: có hình, khác nhau
      const ids = ['dungeon_key', 'boss_key', 'heal_potion', 'ancient_shard', 'ancient_pick', 'delver_blade'], icons = createIcons(makeAtlas()), urls = {}, blank = [];
      for (const id of ids) { urls[id] = icons.get(id); const cv = icons.canvas(id), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; if (n < 60) blank.push(id); }
      out.icons = { distinct: new Set(Object.values(urls)).size, blank };
      const atlas = makeAtlas(), actx = atlas.getContext('2d'), names = ['dungeon_wall', 'gate_iron', 'gate_boss', 'spikes', 'plate', 'dart_trap', 'vent', 'dchest_top', 'dchest_side'], keys = [];
      for (const nm of names) { const t = TILES.indexOf(nm); keys.push(t < 0 ? 'x' : Array.from(actx.getImageData((t % ATLAS_COLS) * 16, Math.floor(t / ATLAS_COLS) * 16, 16, 16).data).join()); }
      out.tiles = { n: names.length, distinct: new Set(keys).size, missing: names.filter(nm => TILES.indexOf(nm) < 0) };
      // vào hầm: dựng ở chỗ cố định, đưa người chơi xuống sảnh
      const site = D.forceSite(game, 'ham-re-muc', 2000, 2000), L = D.layoutOf(site, 'ham-re-muc');
      const tp = (x, y, z) => { game.teleportPlayer(p, x, y, z); }; const hint = () => document.getElementById('dghint');
      tp(site.x + 40.5, site.gy, site.z + 0.5); await until(() => Math.abs(g.local.x - (site.x + 40.5)) < 0.5); await wait(900);
      out.hintNear = { shown: !hint().hidden, text: hint().textContent };
      tp(site.x + 130.5, site.gy, site.z + 0.5); await until(() => Math.abs(g.local.x - (site.x + 130.5)) < 0.5); await wait(900);
      out.hintFar = !hint().hidden;
      game.flags['boss:ham-chu-re-muc'] = true; tp(site.x + 40.5, site.gy, site.z + 0.5); await until(() => Math.abs(g.local.x - (site.x + 40.5)) < 0.5); await wait(900);
      out.hintDefeated = !hint().hidden; delete game.flags['boss:ham-chu-re-muc'];
      tp(L.foot.x + 3.5, site.fy, L.foot.z + 0.5); await until(() => Math.abs(g.local.x - (L.foot.x + 3.5)) < 0.5); await wait(900);
      out.banner = document.getElementById('dgbanner').textContent; out.bannerShown = !document.getElementById('dgbanner').hidden;
      out.hud = document.getElementById('dungeon').textContent.replace(/\s+/g, ' '); out.hudShown = !document.getElementById('dungeon').hidden;
      game.giveItem(uid, 'dungeon_key', 2); await until(() => /Chìa Hầm\D*2/.test(document.getElementById('dungeon').textContent));
      out.hudKeys = document.getElementById('dungeon').textContent.replace(/\s+/g, ' ');
      tp(L.p2c.x + 0.5, site.fy, L.p2c.z + 0.5); await until(() => /Phòng 2/.test(document.getElementById('dungeon').textContent)); await until(() => /Quái còn [1-9]/.test(document.getElementById('dungeon').textContent), 4000);
      out.hudP2 = document.getElementById('dungeon').textContent.replace(/\s+/g, ' ');
      // cổng thiếu chìa: toast đỏ; rương: bảng Chiến lợi phẩm
      for (let i = 0; i < p.inv.length; i++) if (p.inv[i] && p.inv[i].id === 'dungeon_key') p.inv[i] = null; game.touch(p);
      const gi = L.gates.iron.cells[4]; tp(gi[0] + 0.5, site.fy, gi[2] + 2.5); await wait(300);
      g.S.act({ t: 'gate', x: gi[0], y: gi[1], z: gi[2] }); await until(() => /Chìa Hầm/.test(document.getElementById('toast').textContent)); out.toast = document.getElementById('toast').textContent;
      const c = L.chests.supply; tp(c.x + 0.5, site.fy, c.z + 1.5); await wait(300);
      g.S.act({ t: 'dchest', ...c }); await until(() => document.getElementById('panel').textContent.includes('Chiến lợi phẩm'));
      out.loot = { text: document.getElementById('panel').textContent, imgs: document.querySelectorAll('#panel img').length, close: !![...document.querySelectorAll('#panel button')].find(b => b.textContent.includes('Đóng')) };
      [...document.querySelectorAll('#panel button')].find(b => b.textContent.includes('Đóng')).click(); out.closed = document.getElementById('panel').hidden;
      g.S.act({ t: 'dchest', ...c }); await until(() => document.getElementById('panel').textContent.includes('đã nhận')); out.claimed = document.getElementById('panel').textContent;
      return out;
    }""")
    assert r['icons']['distinct'] == 6 and r['icons']['blank'] == [], r
    assert r['tiles']['n'] == 9 and r['tiles']['distinct'] == 9 and r['tiles']['missing'] == [], r
    assert r['hintNear']['shown'] and 'Miệng hầm' in r['hintNear']['text'] and ' m' in r['hintNear']['text'] and not r['hintFar'] and not r['hintDefeated'], r
    assert 'Hầm Rễ Mục' in r['banner'] and r['hudShown'] and 'Phòng 1/4' in r['hud'], r
    assert 'Chìa Hầm' in r['hudKeys'] and 'Phòng 2/4' in r['hudP2'] and 'Quái còn' in r['hudP2'], r
    assert 'Cần Chìa Hầm' in r['toast'] and 'Chiến lợi phẩm' in r['loot']['text'] and r['loot']['imgs'] >= 1 and r['loot']['close'] and r['closed'] and 'đã nhận' in r['claimed'], r


@test
def test_dungeon_keys_cannot_be_stored_in_placed_chests_and_garbage_acts_never_throw(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const T = mkDg(), { g, p, L, site } = T, out = {};
      const x = Math.floor(p.x) + 2; T.stand(2005, 2010, 45); g.world.set(2006, 44, 2010, 1); g.world.set(2006, 45, 2010, B.CHEST);
      T.give('dungeon_key', 1); const slot = p.inv.findIndex(s => s && s.id === 'dungeon_key');
      g.act('u1', { t: 'chest-open', x: 2006, y: 45, z: 2010 });
      const r1 = g.act('u1', { t: 'chest-move', x: 2006, y: 45, z: 2010, from: 'inv', slot }); out.bound = [r1.ok, r1.reason, cnt(p, 'dungeon_key')];
      const bad = [undefined, null, 5, 'x', {}, { x: 0, y: 0, z: 0 }, { x: 1e9, y: 1e9, z: 1e9 }, { x: -1, y: 99, z: 3 }];
      let threw = 0; for (const a of bad) for (const t of ['gate', 'dchest']) { try { g.act('u1', { t, ...(typeof a === 'object' && a ? a : {}) }); } catch (e) { threw++; } }
      p.dead = true; out.dead = [g.act('u1', { t: 'gate', ...L.gates.iron.cells[0].reduce((o, v, i) => ({ ...o, [['x', 'y', 'z'][i]]: v }), {}) }).ok];
      out.threw = threw;
      return out;
    """)
    assert r['bound'] == [False, 'bound', 1] and r['threw'] == 0 and r['dead'] == [False], r


@test
def test_dungeon_hostile_save_is_sanitized(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const { Game: GM } = await imp('sim/game.js'); const out = {};
      const T = mkDg(), { g } = T; const save = JSON.parse(JSON.stringify(g.toSave()));
      const s0 = save.flags.sites.dungeon['ham-re-muc'];
      save.flags.sites.dungeon = { 'ham-re-muc': { ...s0, steps: 1e9, ox: 1e12 }, 'ham-cat-chon': 'x', 'ham-bang-gia': null, 'ham-bun-lay': { ox: NaN }, 'ham-tro-tan': 5, 'ham-lang-kinh': { ...s0, c: null }, 'khong-co': { ...s0 } };
      save.flags.dungeons = { 'ham-re-muc': { claimed: 'abc', rooms: 5, gates: [], boss: 'yes' }, 'ham-cat-chon': null, __proto__x: 1 };
      let err = null, g2 = null, ms = 0;
      try { const t = performance.now(); g2 = GM.fromSave(save, { spawning: false, env: false, hunger: false }); const p = g2.addPlayer('u1', 'T'); p.maxHp = p.hp = 1000; p.x = 2000; p.z = 2000; p.y = 20;
        for (let i = 0; i < 40; i++) g2.tick(0.5);
        for (const a of [{ x: 2000, y: 20, z: 2000 }, { x: 1, y: 2, z: 3 }]) { g2.act('u1', { t: 'gate', ...a }); g2.act('u1', { t: 'dchest', ...a }); }
        ms = performance.now() - t; } catch (e) { err = e.message; }
      // đối tượng cờ hỏng ngay trên game đang chạy: act vẫn không ném lỗi
      const { g: g3, p: p3, L } = mkDg(); g3.flags.dungeons = { 'ham-re-muc': { claimed: { supply: 'x' }, rooms: 'no' } }; const c = L.chests.supply;
      p3.x = c.x + 0.5; p3.y = L.p2c.y; p3.z = c.z + 1.5; let err3 = null; try { g3.act('u1', { t: 'dchest', ...c }); g3.act('u1', { t: 'dchest', ...c }); } catch (e) { err3 = e.message; }
      return { err, ms, err3, claimed: g3.flags.dungeons['ham-re-muc'].claimed.supply, kept: !!g2 && Object.keys(g2.flags.sites.dungeon).length };
    """)
    assert r['err'] is None and r['err3'] is None and r['ms'] < 8000 and r['claimed'] == ['u1'], r


@test
def test_dungeon_tester_abuse_dead_players_spam_reach_full_inventory_and_key_loss(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const out = {};
      // 1) spam mở rương 200 lần + người thứ hai: mỗi người đúng một lần
      let T = mkDg(), { g, p, L, id, site } = T;
      const q = g.addPlayer('u2', 'B'); q.maxHp = q.hp = 1000;
      const c = L.chests.supply; T.stand(c.x, c.z + 1); T.stand(c.x + 1, c.z + 1, undefined, q);
      const xu = pl => cnt(pl, 'xu'); let a0 = xu(p), okN = 0;
      for (let i = 0; i < 200; i++) { const r = g.act('u1', { t: 'dchest', ...c }); if (r.ok && !r.claimed) okN++; }
      out.spamOk = okN; out.claimedOnce = g.flags.dungeons[id].claimed.supply.filter(u => u === 'u1').length;
      const b0 = xu(q); g.act('u2', { t: 'dchest', ...c }); out.bGot = xu(q) > b0; out.claimedBoth = g.flags.dungeons[id].claimed.supply.length;
      // 2) ngoài tầm REACH
      T = mkDg(); ({ g, p, L, id, site } = T); T.give('dungeon_key', 3);
      const gi = L.gates.iron.cells[4]; T.stand(gi[0], gi[2] + 12); const far = g.act('u1', { t: 'gate', x: gi[0], y: gi[1], z: gi[2] });
      out.farGate = [far.ok, cnt(p, 'dungeon_key')];
      T.stand(c.x, c.z + 12); const farC = g.act('u1', { t: 'dchest', ...c }); out.farChest = farC.ok;
      // 3) spam cổng: chỉ trừ 1 chìa
      T.stand(gi[0], gi[2] + 2); for (let i = 0; i < 30; i++) g.act('u1', { t: 'gate', x: gi[0], y: gi[1], z: gi[2] });
      out.keysAfterSpam = cnt(p, 'dungeon_key');
      // 4) kho đầy: phần dư rơi ra đất, không mất, không ném lỗi
      T = mkDg(); ({ g, p, L, id, site } = T);
      for (let i = 0; i < p.inv.length; i++) p.inv[i] = { id: 'dirt', n: 64 }; g.touch(p);
      const c2 = L.chests.victory; g.flags.dungeons = g.flags.dungeons || {}; g.flags.dungeons[id] = g.flags.dungeons[id] || { rooms: {}, claimed: {} }; g.flags.dungeons[id].rooms.p2 = true;
      T.stand(c2.x, c2.z + 1); const before = [...g.ents.values()].filter(e => e.kind === 'item').length; const rr = g.act('u1', { t: 'dchest', ...c2 });
      const drops = [...g.ents.values()].filter(e => e.kind === 'item'); out.full = { ok: rr.ok, dropped: drops.length - before, hasKey: drops.some(e => e.item === 'dungeon_key') };
      // 5) người chơi chết giữa đợt: không ai sống => đợt bị xoá, phòng chưa dọn; chết rồi không mở được rương
      T = mkDg(); ({ g, p, L, id, site } = T);
      T.stand(L.p2c.x, L.p2c.z); T.secs(0.3); out.waveBefore = dgMobs(g, id).length;
      g.damagePlayer ? g.damagePlayer(p, 99999, null) : (p.hp = 0);
      T.secs(0.5); out.deadAlive = p.dead; out.waveAfterDeath = dgMobs(g, id).length; out.clearedAfterDeath = !!(g.flags.dungeons && g.flags.dungeons[id] && g.flags.dungeons[id].rooms.p2);
      // 6) chìa khi chết
      T = mkDg(); ({ g, p, L, id, site } = T); T.give('dungeon_key', 2); T.give('boss_key', 1);
      T.stand(L.p2c.x, L.p2c.z); g.damagePlayer ? g.damagePlayer(p, 99999, null) : (p.hp = 0); T.secs(0.2);
      out.keyDeath = { dead: p.dead, inInv: cnt(p, 'dungeon_key') + cnt(p, 'boss_key'), onGround: [...g.ents.values()].filter(e => e.kind === 'item' && (e.item === 'dungeon_key' || e.item === 'boss_key')).length };
      // 7) rương kho báu: chưa có boss chết thì là không khí / không mở được
      T = mkDg(); ({ g, p, L, id, site } = T); const tc = L.chests.treasure; T.stand(tc.x, tc.z + 1);
      out.treasureBlock = g.world.get(tc.x, tc.y, tc.z); out.treasureOpen = g.act('u1', { t: 'dchest', ...tc }).ok;
      // 8) boss: người duy nhất chết giữa trận => boss reset, không đặt cờ
      const bp = L.p4c; T.stand(bp.x + 3, bp.z); T.secs(0.3); const boss = [...g.ents.values()].find(e => e.kind === 'boss');
      out.bossSpawned = !!boss; g.damagePlayer ? g.damagePlayer(p, 99999, null) : (p.hp = 0); T.secs(6.5);
      out.bossAfter = [...g.ents.values()].some(e => e.kind === 'boss'); out.bossFlag = !!g.flags['boss:' + (boss && boss.type)];
      // 9) ném chìa cho người khác mở cổng hộ rồi nhặt lại: tổng chìa không tăng
      return out;
    """)
    assert r['spamOk'] == 1 and r['claimedOnce'] == 1 and r['bGot'] and r['claimedBoth'] == 2, r
    assert not r['farGate'][0] and r['farGate'][1] == 3 and not r['farChest'] and r['keysAfterSpam'] == 2, r
    assert r['full']['ok'] and r['full']['dropped'] >= 1 and r['full']['hasKey'], r
    assert r['waveBefore'] == 4 and r['deadAlive'] and r['waveAfterDeath'] == 0 and not r['clearedAfterDeath'], r
    assert r['treasureBlock'] != 61 and not r['treasureOpen'], r
    assert r['bossSpawned'] and not r['bossAfter'] and not r['bossFlag'], r
    # chìa không được biến mất khi chết (đặc tả mục 10.1): ở kho giữ lại hoặc rơi ra đất
    assert r['keyDeath']['inInv'] + r['keyDeath']['onGround'] >= 1, r


# ---------------------------------------------------------------- Gói Chiến đấu có chiều sâu (test_combat2_*)

FIGHT_JS = ARENA_JS + """
const fight = await imp('sim/fight.js');
const rules = await imp('sim/rules.js');
const combatM = await imp('sim/combat.js');
const invM = await imp('sim/inventory.js');
const { makeRng } = await imp('sim/rng.js');
const { spawnBoss } = await imp('sim/boss.js');
const { snapshotFor } = await imp('net/snapshot.js');
const { makePlayer, stepPlayer } = await imp('sim/physics.js');
const give = (g, p, ids, sel = 0) => { p.inv.fill(null); ids.forEach((it, i) => { const [id, n = 1] = Array.isArray(it) ? it : [it]; p.inv[i] = { id, n }; }); p.sel = sel; g.touch(p); };
// Sân phẳng; người chơi quay về -z (yaw 0), quái đứng yên 2.5 block phía trước, nhiều máu.
const mkFight = (held = 'iron_sword', opts = {}) => {
  const A = mkArena(opts); const { g, p, cx, cz, y0 } = A; give(g, p, [held]);
  A.mob = (dx, dz, type = 'xac-song') => { const m = spawnMob(g, type, cx + 0.5 + dx, y0 + 1, cz + 0.5 + dz); m.frozen = true; m.hp = m.maxHp = 1000; return m; };
  A.m = A.mob(0, -2.5); return A;
};
const hurtAt = (g, p, dmg, dx, dz, opts, extra = {}) => g.hurtPlayer(p, dmg, { id: 777, kind: 'mob', x: p.x + dx, y: p.y, z: p.z + dz, ...extra }, opts);
const FRONT = [0, -3], BACK = [0, 3];
const lost = (g, p, f) => { p.hp = p.maxHp = 100; f(); const l = 100 - p.hp; p.hp = 100; return l; };
const hitAt = (g, m, t) => { g.time = t; const h0 = m.hp, r = g.act('u1', { t: 'hit', id: m.id }); return { ok: r.ok, reason: r.reason, dmg: h0 - m.hp }; };
"""


@test
def test_combat2_stamina_drain_regen_and_exhaust(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m } = mkFight(); const out = {};
      out.start = [p.stamina, p.maxStamina, snapshotFor(g, 'u1').me.sta];
      p.sprint = true; p.vx = 4; run(g, 2.0); out.sprint = p.stamina;                              // AC-2: chạy thật 2 giây
      p.stamina = 100; p.vx = 0; p.vz = 0; p.staAt = 0; run(g, 2.0); out.idleSprint = p.stamina;     // đứng yên mà cờ sprint bật: không tiêu
      p.sprint = false; p.stamina = 50; p.staAt = 0;
      fight.spendStamina(g, p, 10); const base = p.stamina;                                          // AC-3
      run(g, 0.9); out.noRegen = p.stamina - base; run(g, 1.1); out.regen = p.stamina - base;
      p.stamina = 5; p.staAt = 0; g.drain();
      const okSpend = fight.spendStamina(g, p, 5);                                                   // AC-4: về 0 thì kiệt sức 2 giây
      out.exh = { okSpend, sta: p.stamina, left: p.exhUntil - g.time, me: snapshotFor(g, 'u1').me.exh, ev: g.drain().filter(e => e.ev.t === 'exhausted').length };
      const roll = g.act('u1', { t: 'roll', dx: 0, dz: 1 }), hit = g.act('u1', { t: 'hit', id: m.id });
      out.blocked = [roll.reason, hit.reason, g.act('u1', { t: 'draw', on: true }).ok];
      run(g, 2.1); out.after = { exh: !!p.exh, sta: p.stamina, me: snapshotFor(g, 'u1').me.exh };
      p.stamina = 100; fight.spendStamina(g, p, 100); out.rollExh = g.act('u1', { t: 'roll', dx: 0, dz: 1 }).reason;
      return out;
    """)
    assert r['start'] == [100, 100, 100], r
    assert abs(r['sprint'] - 84) <= 2 and r['idleSprint'] == 100, r
    assert abs(r['noRegen']) < 0.5 and abs(r['regen'] - 25) <= 2, r
    assert r['exh']['okSpend'] and r['exh']['sta'] == 0 and abs(r['exh']['left'] - 2.0) < 0.01 and r['exh']['me'] > 1.5 and r['exh']['ev'] == 1, r
    assert r['blocked'] == ['tired', 'tired', False], r
    assert not r['after']['exh'] and r['after']['sta'] >= 20 and r['after']['me'] == 0, r
    assert r['rollExh'] == 'tired', r


@test
def test_combat2_roll_cost_cooldown_iframes_and_cancels(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m } = mkFight(); const out = {}; g.time = 10;
      const r1 = g.act('u1', { t: 'roll', dx: 0, dz: 1 }); out.r1 = [r1.ok, p.stamina];
      const r2 = g.act('u1', { t: 'roll', dx: 0, dz: 1 }); out.r2 = [r2.ok, r2.reason];
      out.act = snapshotFor(g, 'u1').ps[0].act;
      const dm = (dt, opts, extra) => lost(g, p, () => { g.time = 10 + dt; hurtAt(g, p, 3, ...FRONT, opts, extra); });
      out.window = { t04: dm(0.04), t10: dm(0.10), t30: dm(0.30), t36: dm(0.36) };                    // AC-6
      out.proj = lost(g, p, () => { g.time = 10.2; g.hurtPlayer(p, 3, { id: 9, kind: 'proj', x: p.x, y: p.y + 1, z: p.z - 2 }); });
      out.gas = lost(g, p, () => { g.time = 10.2; g.hurtPlayer(p, 3, null); });                       // không src: không được miễn
      out.pure = lost(g, p, () => { g.time = 10.2; hurtAt(g, p, 3, ...FRONT, { pure: true }); });
      g.time = 10.5; out.r3 = g.act('u1', { t: 'roll', dx: 0, dz: 1 }).reason;                          // < 0.8 s kể từ lúc lăn đầu
      g.time = 10.81; out.r4 = g.act('u1', { t: 'roll', dx: 1, dz: 0 }); out.sta = p.stamina;
      out.rolling = [snapshotFor(g, 'u1').ps[0].act, (g.time = 11.4, snapshotFor(g, 'u1').ps[0].act || 0)];
      // AC-24: lăn huỷ giơ khiên và kéo cung; kéo cung quá 0.3 s thì không lăn được; choáng thì không lăn
      p.offhand = 'wood_shield'; p.stamina = 100; g.time = 20; g.act('u1', { t: 'guard', on: true }); out.guardOn = p.guardSince !== null;
      g.act('u1', { t: 'roll', dx: 0, dz: 1 }); out.guardAfterRoll = p.guardSince;
      give(g, p, ['bow', ['arrow', 5]]); g.time = 30; g.act('u1', { t: 'draw', on: true }); g.time = 30.2; g.act('u1', { t: 'roll', dx: 0, dz: 1 }); out.drawAfterRoll = p.drawSince;
      g.time = 40; g.act('u1', { t: 'draw', on: true }); g.time = 40.5; out.busy = g.act('u1', { t: 'roll', dx: 0, dz: 1 }).reason; p.drawSince = null;
      g.time = 50; p.stunUntil = 51; out.stun = g.act('u1', { t: 'roll', dx: 0, dz: 1 }).reason; p.stunUntil = 0;
      out.bad = [g.act('u1', { t: 'roll', dx: 'x', dz: NaN }).reason, g.act('u1', { t: 'roll', dx: 5, dz: 0 }).ok];
      g.time = 99; out.dead = (p.dead = true, g.act('u1', { t: 'roll', dx: 0, dz: 1 }).reason);
      return out;
    """)
    assert r['r1'] == [True, 75] and r['r2'] == [False, 'cooldown'] and r['act'] == 3, r
    assert r['window']['t04'] == 3 and r['window']['t10'] == 0 and r['window']['t30'] == 0 and r['window']['t36'] == 3, r
    assert r['proj'] == 0 and r['gas'] == 3 and r['pure'] == 3, r
    assert r['r3'] == 'cooldown' and r['r4']['ok'] and r['sta'] == 50, r
    assert r['rolling'] == [3, 0], r
    assert r['guardOn'] and r['guardAfterRoll'] is None and r['drawAfterRoll'] is None and r['busy'] == 'busy' and r['stun'] == 'stun', r
    assert r['bad'][0] == 'bad-args' and r['bad'][1], r
    assert r['dead'] == 'dead', r


@test
def test_combat2_respawn_resets_fight_state(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p } = mkFight(); const out = {}; p.offhand = 'wood_shield'; g.time = 5;
      g.act('u1', { t: 'guard', on: true }); p.stamina = 12; p.stunUntil = 99; p.combo = { n: 2, at: 5 }; p.rollAt = 5; p.exh = true; p.exhUntil = 99;
      g.hurtPlayer(p, 999, null); out.dead = p.dead; g.time = 9; g.tick(0.05);
      const r = g.act('u1', { t: 'respawn' });
      out.res = { ok: r.ok, sta: p.stamina, exh: !!p.exh, guard: p.guardSince, draw: p.drawSince, stun: p.stunUntil <= g.time, combo: p.combo.n, roll: g.time - p.rollAt > 1, off: p.offhand };
      return out;
    """)
    assert r['dead'] and r['res'] == {'ok': True, 'sta': 100, 'exh': False, 'guard': None, 'draw': None, 'stun': True, 'combo': 0, 'roll': True, 'off': 'wood_shield'}, r


@test
def test_combat2_sword_combo_cooldown_and_reset(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m } = mkFight('iron_sword'); const out = {}; give(g, p, ['iron_sword', 'iron_sword']);
      const h = [], kb = [];
      for (const t of [10, 10.5, 11.0]) { h.push(hitAt(g, m, t).dmg); kb.push(Math.hypot(m.kbx, m.kbz)); }                // AC-8: 6, 6, 9
      out.dmg = h; out.kbRatio = kb[2] / kb[0]; out.cmbAfter3 = snapshotFor(g, 'u1').me.cmb;
      out.cd = [hitAt(g, m, 11.5).reason, hitAt(g, m, 11.81).ok];                                       // sau đòn 3: hồi chiêu 0.8 s
      hitAt(g, m, 20); hitAt(g, m, 20.5); out.cmb2 = snapshotFor(g, 'u1').me.cmb;
      out.gap = hitAt(g, m, 21.6).dmg;                                                                  // cách > 0.8 s: về đòn 1
      hitAt(g, m, 30); hitAt(g, m, 30.5); g.act('u1', { t: 'sel', i: 1 }); g.act('u1', { t: 'sel', i: 0 });
      out.swap = hitAt(g, m, 31.2).dmg;                                                                 // đổi vật cầm: về đòn 1
      // đòn không trúng (quá tầm) không tăng chuỗi
      const far = mkFight('iron_sword'); const f = far.mob(0, -9); far.p.combo = { n: 0, at: -99 };
      out.miss = [hitAt(far.g, f, 10).reason, far.p.combo.n];
      out.wood = (() => { const w = mkFight('wood_sword'); return [hitAt(w.g, w.m, 10).dmg, hitAt(w.g, w.m, 10.5).dmg, hitAt(w.g, w.m, 11).dmg]; })();       // 4, 4, floor(6)
      return out;
    """)
    assert r['dmg'] == [6, 6, 9] and 1.9 < r['kbRatio'] < 2.1 and r['cmbAfter3'] == 0, r
    assert r['cd'] == ['cooldown', True] and r['cmb2'] == 2 and r['gap'] == 6 and r['swap'] == 6, r
    assert r['miss'] == ['reach', 0] and r['wood'] == [4, 4, 6], r


@test
def test_combat2_axe_sweep_club_stun_spear_reach_and_fall_crit(pg):
    r = ev(pg, FIGHT_JS + r"""
      const out = {};
      // rìu: mục tiêu chính + 2 mục tiêu gần nhất trong 2.5 block (70%); quái thứ 4 và quái xa không bị
      let T = mkFight('iron_axe'); let { g, p, m } = T;
      const b = T.mob(1, -2.5), c = T.mob(-1.5, -2.5), d = T.mob(0, -4.5), e = T.mob(0, -6.5);
      const r1 = hitAt(g, m, 10); out.axe = { main: r1.dmg, b: 1000 - b.hp, c: 1000 - c.hp, d: 1000 - d.hp, e: 1000 - e.hp };
      out.axeCd = [hitAt(g, m, 10.5).reason, hitAt(g, m, 10.81).ok];
      // chùy: x1.3, choáng quái thường 1 s, miễn choáng 3 s sau đó, boss không choáng
      T = mkFight('swamp_club'); ({ g, p, m } = T);
      const bs = spawnBoss(g, 'thu-linh-soi', T.cx + 0.5 + 3, T.y0 + 1, T.cz + 0.5); bs.frozen = true;
      out.club = { dmg: hitAt(g, m, 10).dmg, stun: m.stunUntil - 10, immune: m.stunImmuneUntil - 10 };
      hitAt(g, m, 11.01); out.clubAgain = m.stunUntil - 10;
      const mm = T.mob(3, -4); mm.hp = 1000; mm.frozen = false; mm.state = 'chase'; mm.target = 'u1'; mm.lastSeen = { x: p.x, y: p.y, z: p.z }; mm.alert = 1;
      const w = spawnMob(g, 'soi-xam', T.cx + 0.5 + 10, T.y0 + 1, T.cz + 0.5 - 10); const w2 = spawnMob(g, 'soi-xam', T.cx + 0.5 - 10, T.y0 + 1, T.cz + 0.5 - 10);
      for (const x of [w, w2]) { x.state = 'chase'; x.target = 'u1'; x.lastSeen = { x: p.x, y: p.y, z: p.z }; x.alert = 1; x.e = { x: x.x, z: x.z }; }
      w.stunUntil = g.time + 5; g.hp = 0; p.x = T.cx + 0.5; p.z = T.cz + 0.5; run(g, 0.6);
      out.stunnedMoved = Math.hypot(w.x - w.e.x, w.z - w.e.z); out.freeMoved = Math.hypot(w2.x - w2.e.x, w2.z - w2.e.z);
      p.hp = 100; p.maxHp = 100;
      g.act('u1', { t: 'hit', id: bs.id }); out.boss = bs.stunUntil || 0;
      // giáo: tầm 6, không đẩy lùi; kiếm không tới
      T = mkFight('wood_spear'); ({ g, p, m } = T); const sp = T.mob(0, -5.6); const q = T.mob(0, -7.5);
      out.spear = [hitAt(g, sp, 10).dmg, sp.kbT || 0, hitAt(g, q, 11).reason];
      give(g, p, ['wood_sword']); out.sword = hitAt(g, sp, 12).reason;
      // đòn rơi x1.5
      T = mkFight('iron_sword'); ({ g, p, m } = T);
      p.y = T.y0 + 3; p.fallVy = -5; const air = hitAt(g, m, 10).dmg;
      p.y = T.y0 + 3; p.fallVy = -1; const slow = hitAt(g, m, 11).dmg;
      p.y = T.y0 + 1; p.fallVy = -5; const ground = hitAt(g, m, 12).dmg;
      out.fall = [air, slow, ground];
      return out;
    """)
    assert r['axe'] == {'main': 5, 'b': 3, 'c': 3, 'd': 0, 'e': 0}, r
    assert r['axeCd'] == ['cooldown', True], r
    assert r['club']['dmg'] == 14 and abs(r['club']['stun'] - 1.0) < 0.01 and abs(r['club']['immune'] - 4.0) < 0.01 and abs(r['clubAgain'] - 1.0) < 0.01, r
    assert r['stunnedMoved'] < 0.05 and r['freeMoved'] > 0.5 and r['boss'] == 0, r
    assert r['spear'] == [4, 0, 'reach'] and r['sword'] == 'reach', r
    assert r['fall'] == [9, 6, 6], r


@test
def test_combat2_each_weapon_costs_stamina_and_tired_changes_nothing(pg):
    r = ev(pg, FIGHT_JS + r"""
      const out = {};
      for (const [id, key] of [['iron_sword', 'sword'], ['iron_axe', 'axe'], ['swamp_club', 'club'], ['wood_spear', 'spear'], ['wood_pick', 'hand'], [null, 'bare']]) {
        const { g, p, m } = mkFight(id || 'stick'); if (!id) give(g, p, []);
        out[key] = [hitAt(g, m, 10).ok, 100 - p.stamina];
      }
      const { g, p, m } = mkFight('iron_sword'); p.stamina = 3; const before = { at: p.attackAt, cmb: p.combo.n, hp: m.hp };
      const r = hitAt(g, m, 10); out.tired = { reason: r.reason, same: p.attackAt === before.at && p.combo.n === before.cmb && m.hp === before.hp, sta: p.stamina };
      out.table = Object.fromEntries(Object.entries(rules.WEAPON_CLS).map(([k, v]) => [k, [v.cd, v.cost, v.reach]]));
      return out;
    """)
    assert r['sword'] == [True, 6] and r['axe'] == [True, 12] and r['club'] == [True, 15] and r['spear'] == [True, 8] and r['hand'] == [True, 4] and r['bare'] == [True, 4], r
    assert r['tired'] == {'reason': 'tired', 'same': True, 'sta': 3}, r
    assert r['table'] == {'hand': [0.5, 4, 4.5], 'sword': [0.5, 6, 4.5], 'axe': [0.8, 12, 4.5], 'club': [1.0, 15, 4.5], 'spear': [0.7, 8, 6.0]}, r


@test
def test_combat2_melee_mobs_telegraph_before_they_hit(pg):
    r = ev(pg, FIGHT_JS + r"""
      const out = {};
      const watch = (type, away) => {
        const { g, p, cx, cz, y0 } = mkArena(); const m = faceTo(spawnMob(g, type, p.x, y0 + 1, p.z - 1.0), p);
        const d = MOBS[type].attack; let tw = null, hpAt = null, evs = 0, hit = null;
        for (let t = 0; t < 4 && hit === null; t += 0.05) {
          g.tick(0.05); evs += g.drain().filter(e => e.ev.t === 'windup' && e.ev.id === m.id).length;
          if (m.windup && tw === null) { tw = g.time; out[type + 'Len'] = m.windup.until - g.time; if (away) p.x += 6; }
          if (tw !== null && p.hp < 20 && hit === null) hit = g.time - tw;
          if (away && tw !== null && g.time - tw > 0.7) break;                                       // lùi ra khỏi tầm trong lúc vung: không mất máu
        }
        return { hit, dmg: 20 - p.hp, evs, want: d.dmg, windup: tw !== null };
      };
      out.fast = watch('xac-song', false); out.slow = watch('gau-bang', false); out.dodged = watch('xac-song', true);
      return out;
    """)
    f, s, d = r['fast'], r['slow'], r['dodged']
    assert f['windup'] and f['evs'] >= 1 and f['dmg'] == f['want'] == 4 and 0.30 <= f['hit'] <= 0.5, r
    assert abs(r['xac-songLen'] - 0.35) < 0.06, r
    assert s['dmg'] == s['want'] == 6 and 0.55 <= s['hit'] <= 0.75 and abs(r['gau-bangLen'] - 0.6) < 0.06, r
    assert d['windup'] and d['dmg'] == 0 and d['hit'] is None, r


@test
def test_combat2_bow_draw_force_damage_ammo_and_cooldown(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m } = mkFight('bow'); const out = {}; give(g, p, ['bow', ['arrow', 20]]); m.frozen = true;
      const arrows = () => invM.countItem(p.inv, 'arrow'), proj = () => [...g.ents.values()].filter(e => e.kind === 'proj');
      const shot = (t0, hold) => { p.stamina = 100; g.time = t0; const d = g.act('u1', { t: 'draw', on: true }); g.time = t0 + hold; const s = g.act('u1', { t: 'shoot', yaw: 0, pitch: 0 }); return { d: d.ok, s }; };
      out.noBow = (give(g, p, ['stick']), g.act('u1', { t: 'draw', on: true }).reason); give(g, p, ['bow', ['arrow', 20]]);
      let s = shot(10, 0.1); out.weak = [s.s.reason, arrows(), proj().length, p.drawSince];                        // AC-15: < 0.2 s: không bắn
      s = shot(20, 1.0); const a1 = proj()[0]; out.full = [s.s.ok, a1 && a1.dmg, a1 && Math.hypot(a1.vx, a1.vy, a1.vz), arrows(), p.stamina, a1 && a1.owner, a1 && a1.style];
      g.ents.delete(a1.id);
      s = shot(30, 0.6); const a2 = proj()[0]; out.part = [a2.dmg, Math.hypot(a2.vx, a2.vy, a2.vz)]; g.ents.delete(a2.id);
      s = shot(40, 1.0); const s2 = shot(40 + 1.0 + 0.1, 0.25); out.cd = [s.s.ok, s2.s.reason]; proj().forEach(e => g.ents.delete(e.id));   // AC-16: cách < 0.4 s
      give(g, p, ['bow']); s = shot(60, 1.0); out.noAmmo = [s.s.reason, proj().length];
      give(g, p, ['bow', ['arrow', 3]]); p.stamina = 100; g.time = 70; g.act('u1', { t: 'draw', on: true }); g.time = 71; p.stamina = 4; out.tiredShot = [g.act('u1', { t: 'shoot', yaw: 0, pitch: 0 }).reason, arrows()]; p.stamina = 100;
      out.noDraw = (g.time = 80, g.act('u1', { t: 'shoot', yaw: 0, pitch: 0 }).ok);
      out.badArgs = (g.act('u1', { t: 'draw', on: true }), g.time = 82, g.act('u1', { t: 'shoot', yaw: 'x', pitch: {} }).ok);
      return out;
    """)
    assert r['noBow'] == 'no-bow', r
    assert r['weak'] == ['weak', 20, 0, None], r
    assert r['full'][0] and abs(r['full'][1] - 10) < 0.01 and abs(r['full'][2] - 28) < 1 and r['full'][3:] == [19, 90, 'u1', 'arrow'], r
    assert abs(r['part'][0] - 6.6) <= 0.5 and abs(r['part'][1] - 21) <= 1.0001, r
    assert r['cd'] == [True, 'cooldown'], r
    assert r['noAmmo'] == ['no-ammo', 0], r
    assert r['tiredShot'] == ['tired', 3] and r['noDraw'] is False and r['badArgs'] is True, r


@test
def test_combat2_arrows_fall_stop_at_blocks_skip_players_and_credit_kills(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m, cx, cz, y0 } = mkFight('bow'); const out = {}; give(g, p, ['bow', ['arrow', 40]]);
      m.x = cx + 0.5 + 12; m.z = cz + 0.5 + 12;                                                           // dời quái ra ngoài đường bay
      const proj = () => [...g.ents.values()].filter(e => e.kind === 'proj');
      const fire = (t0, pitch = 0, yaw = 0) => { p.stamina = 100; g.time = t0; g.act('u1', { t: 'draw', on: true }); g.time = t0 + 1; return g.act('u1', { t: 'shoot', yaw, pitch }); };
      fire(10); const a = proj()[0]; const y1 = a.y, z1 = a.z; run(g, 0.5);
      out.drop = y1 - a.y; out.flew = z1 - a.z;                                                           // AC-17: rơi 1.1 ± 0.3 sau 0.5 s
      run(g, 5); out.gone = proj().length;                                                                // xoá sau 4 s / vượt tầm / chạm đất
      fire(20, -1.4); run(g, 0.3); out.ground = proj().length;                                            // chạm block thì biến mất
      const q = g.addPlayer('u2', 'B'); q.x = cx + 0.5; q.z = cz + 0.5 - 8; q.y = y0 + 1; const hp = q.hp;
      fire(30); run(g, 0.6); out.otherPlayer = [q.hp === hp, p.hp === 20];                                // không trúng người chơi
      // trúng quái: trừ máu, aggro, kill tính cho người bắn
      const t = spawnMob(g, 'xac-song', cx + 0.5 + 0.0, y0 + 1, cz + 0.5 - 6.0); t.frozen = true; t.hp = t.maxHp = 50; q.x = cx + 20; g.drain();
      fire(40); run(g, 0.5); out.hitMob = [50 - t.hp, t.state, proj().length];
      t.hp = 1; let kills = []; g.onKill = (e, src) => kills.push([e.type, src && src.uid]);
      fire(50); run(g, 0.5); out.kill = kills; out.killedEv = g.drain().filter(e => e.ev.t === 'killed').map(e => e.ev.by);
      // sát thương Sức mạnh x1.25 (làm tròn lên) cũng áp cho mũi tên
      return out;
    """)
    assert abs(r['drop'] - 1.1) <= 0.3 and r['flew'] > 8, r
    assert r['gone'] == 0 and r['ground'] == 0 and r['otherPlayer'] == [True, True], r
    assert r['hitMob'][0] == 10 and r['hitMob'][1] == 'chase' and r['hitMob'][2] == 0, r
    assert r['kill'] == [['xac-song', 'u1']] and r['killedEv'] == ['u1'], r


@test
def test_combat2_arrows_sometimes_drop_back_and_skeletons_drop_arrows(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m, cx, cz, y0 } = mkFight('bow'); const out = {}; g.rng = makeRng(4242);
      give(g, p, ['bow', ['arrow', 64], ['arrow', 64]]); m.z = cz + 0.5 - 3; let back = 0; const dropOrig = g.dropItem.bind(g); g.dropItem = (id, n, x, y, z) => { if (id === 'arrow') back += n; return dropOrig(id, n, x, y, z); };
      for (let i = 0; i < 100; i++) { p.stamina = 100; m.z = cz + 0.5 - 3; m.kbT = 0; m.hp = 1000; g.time = 10 + i * 2; g.act('u1', { t: 'draw', on: true }); g.time += 1.0; g.act('u1', { t: 'shoot', yaw: 0, pitch: 0 }); for (let k = 0; k < 4; k++) g.tick(0.05); }
      out.recovered = back; out.arrowsLeft = invM.countItem(p.inv, 'arrow');
      // Xương Cung Thủ rơi 2 tới 5 mũi tên với xác suất 0.6
      g.dropItem = dropOrig; g.rng = makeRng(99); let drops = 0, mn = 99, mx = 0;
      for (let i = 0; i < 100; i++) {
        g.ents.clear(); combatM.dropLoot(g, { kind: 'mob', type: 'xuong-cung', x: cx, y: y0 + 1, z: cz, shearCd: 0 });
        const n = [...g.ents.values()].filter(e => e.kind === 'item' && e.item === 'arrow').reduce((a, e) => a + e.n, 0);
        if (n) { drops++; mn = Math.min(mn, n); mx = Math.max(mx, n); }
      }
      out.skel = { drops, mn, mx };
      return out;
    """)
    assert 20 <= r['recovered'] <= 40 and r['arrowsLeft'] == 28, r
    assert 45 <= r['skel']['drops'] <= 75 and r['skel']['mn'] >= 2 and r['skel']['mx'] <= 5, r


@test
def test_combat2_shield_blocks_front_arc_costs_stamina_and_armor_applies_after(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m } = mkFight('iron_sword'); const out = {}; g.time = 10;
      const raise = (id = 'wood_shield') => { p.offhand = id; p.guardSince = null; p.guardLast = -99; p.stamina = 100; p.exh = false; p.stunUntil = 0; return g.act('u1', { t: 'guard', on: true }); };
      const side = (deg, r = 3) => [Math.sin(deg * Math.PI / 180) * r, -Math.cos(deg * Math.PI / 180) * r];
      raise(); g.time = 10.5;                                                                              // quá cửa sổ đỡ hoàn hảo
      out.wood = [lost(g, p, () => hurtAt(g, p, 10, ...FRONT)), 100 - p.stamina];                           // AC-20: 10 -> 4, thể lực -20
      p.stamina = 100; out.back = lost(g, p, () => hurtAt(g, p, 10, ...BACK));
      out.deg65 = lost(g, p, () => hurtAt(g, p, 10, ...side(65))); out.deg55 = lost(g, p, () => hurtAt(g, p, 10, ...side(55)));
      out.noSrc = lost(g, p, () => g.hurtPlayer(p, 10, null)); out.pure = lost(g, p, () => hurtAt(g, p, 10, ...FRONT, { pure: true }));
      p.stamina = 100; out.slam = [lost(g, p, () => hurtAt(g, p, 10, ...FRONT, { blockable: false })), 100 - p.stamina];     // AC-21: đập vùng bỏ qua khiên
      g.time = 20; raise('iron_shield'); g.time = 20.5; p.stamina = 100;
      out.iron = [lost(g, p, () => hurtAt(g, p, 10, ...FRONT)), 100 - p.stamina];                           // 10 -> 2, thể lực -15
      p.armor = { head: 'iron_helm', chest: 'iron_chest', legs: 'iron_legs', feet: 'iron_boots' }; raise(); g.time += 0.5; p.stamina = 100;
      out.armor = lost(g, p, () => hurtAt(g, p, 10, ...FRONT)); p.armor = { head: null, chest: null, legs: null, feet: null };
      // đạn chặn được, mất đạn
      raise(); g.time += 0.5; p.stamina = 100; const pr = { id: 5, kind: 'proj', x: p.x, y: p.y + 1, z: p.z - 2, owner: null };
      out.proj = lost(g, p, () => g.hurtPlayer(p, 10, pr));
      // tốc độ x0.6 và không sprint
      const W = g.world, mk = () => { const b = makePlayer(m.x + 5, m.y, m.z + 5); b.yaw = 0; return b; };
      const speedOf = input => { const b = mk(); for (let i = 0; i < 20; i++) stepPlayer(W, b, input, 0.05); return Math.abs(b.vz); };
      const base = speedOf({ fz: 1 }), slow = speedOf({ fz: 1, slow: 0.6 }), slowSprint = speedOf({ fz: 1, sprint: true, slow: 0.6 });
      out.speed = [slow / base, slowSprint / base];
      return out;
    """)
    assert r['wood'] == [4, 20] and r['back'] == 10 and r['deg65'] == 10 and r['deg55'] == 4, r
    assert r['noSrc'] == 10 and r['pure'] == 10 and r['slam'] == [10, 0], r
    assert r['iron'] == [2, 15] and r['armor'] == 2 and r['proj'] == 4, r
    assert abs(r['speed'][0] - 0.6) < 0.02 and abs(r['speed'][1] - 0.6) < 0.02, r


@test
def test_combat2_shield_perfect_parry_window_and_cooldown(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m, cx, cz, y0 } = mkFight('iron_sword'); const out = {}; p.offhand = 'wood_shield';
      const fresh = (t) => { p.stamina = 100; g.time = t; p.guardSince = null; p.guardLast = -99; p.exh = false; p.stunUntil = 0; m.stunUntil = 0; g.drain(); };
      fresh(10); g.act('u1', { t: 'guard', on: true }); g.time = 10.1; m.windup = { until: 11, uid: 'u1' };
      const hp0 = p.hp; const res = g.hurtPlayer(p, 10, m);
      out.perfect = { how: res.how, dealt: res.dealt, hp: hp0 - p.hp, sta: p.stamina, stun: m.stunUntil - g.time, windup: m.windup || null,
        ev: g.drain().map(e => e.ev).filter(e => e.t === 'shield' || e.t === 'parry').map(e => e.t + (e.perfect ? ':p' : '')) };
      fresh(20); g.act('u1', { t: 'guard', on: true }); g.time = 20.3;                                      // giơ ở 0.30 s: không còn đỡ hoàn hảo
      out.late = [g.hurtPlayer(p, 10, m).how, m.stunUntil];
      fresh(30); g.act('u1', { t: 'guard', on: true }); g.time = 30.1; g.act('u1', { t: 'guard', on: false });
      g.time = 30.3; g.act('u1', { t: 'guard', on: true }); out.regrab = g.hurtPlayer(p, 10, m).how;          // giơ lại < 0.5 s: không có cửa sổ mới
      g.act('u1', { t: 'guard', on: false }); g.time = 31.0; p.stamina = 100; g.act('u1', { t: 'guard', on: true }); out.again = g.hurtPlayer(p, 10, m).how;
      fresh(40); const bs = spawnBoss(g, 'thu-linh-soi', cx + 0.5, y0 + 1, cz + 0.5 - 3); bs.frozen = true;
      g.act('u1', { t: 'guard', on: true }); g.time = 40.1; out.boss = [g.hurtPlayer(p, 10, bs).how, bs.stunUntil || 0];
      // vỡ khiên
      fresh(50); p.stamina = 5; g.act('u1', { t: 'guard', on: true }); g.time = 50.5; g.drain(); const hp1 = p.hp;
      const br = g.hurtPlayer(p, 10, m);
      out.broke = { dealt: br.dealt, hp: hp1 - p.hp, sta: p.stamina, stun: p.stunUntil - g.time, guard: p.guardSince, exh: !!p.exh, ev: g.drain().map(e => e.ev).filter(e => e.t === 'shield' || e.t === 'exhausted').map(e => e.t + (e.broke ? ':b' : '')) };
      out.stunnedRoll = g.act('u1', { t: 'roll', dx: 0, dz: 1 }).reason;
      out.minDmg = (() => { fresh(60); p.armor = { head: 'iron_helm', chest: 'iron_chest', legs: 'iron_legs', feet: 'iron_boots' }; p.stamina = 0; p.exh = false; p.guardSince = 55; const h = p.hp; g.hurtPlayer(p, 1, m); return h - p.hp; })();
      return out;
    """)
    p = r['perfect']
    assert p['how'] == 'perfect' and p['dealt'] == 0 and p['hp'] == 0 and p['sta'] == 100 and abs(p['stun'] - 0.8) < 0.01 and p['windup'] is None, r
    assert 'shield:p' in p['ev'] and 'parry' in p['ev'], r
    assert r['late'] == ['shield', 0] and r['regrab'] == 'shield' and r['again'] == 'perfect', r
    assert r['boss'] == ['perfect', 0], r
    b = r['broke']
    assert b['dealt'] == 10 and b['hp'] == 10 and b['sta'] == 0 and abs(b['stun'] - 1.0) < 0.01 and b['guard'] is None and b['exh'], r
    assert 'shield:b' in b['ev'] and r['stunnedRoll'] == 'stun' and r['minDmg'] == 1, r


@test
def test_combat2_guard_rules_no_hit_or_draw_while_guarding(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m } = mkFight('iron_sword'); const out = {}; g.time = 10;
      give(g, p, ['iron_sword', 'bow', 'meat', ['arrow', 4]]);
      out.noShield = g.act('u1', { t: 'guard', on: true }).reason;
      p.offhand = 'wood_shield'; p.sel = 2; out.food = g.act('u1', { t: 'guard', on: true }).reason; p.sel = 0;
      out.ok = g.act('u1', { t: 'guard', on: true }).ok; out.act = snapshotFor(g, 'u1').ps[0].act; out.off = snapshotFor(g, 'u1').ps[0].off;
      g.time = 11; out.hit = g.act('u1', { t: 'hit', id: m.id }).reason;
      g.act('u1', { t: 'sel', i: 1 }); out.draw = g.act('u1', { t: 'draw', on: true }).reason;
      g.act('u1', { t: 'guard', on: false }); out.afterAct = snapshotFor(g, 'u1').ps[0].act; out.drawOk = g.act('u1', { t: 'draw', on: true }).ok; out.act2 = snapshotFor(g, 'u1').ps[0].act;
      out.guardCancelsDraw = (g.act('u1', { t: 'guard', on: true }), p.drawSince);
      g.act('u1', { t: 'guard', on: false }); p.stunUntil = g.time + 1; out.stunAct = snapshotFor(g, 'u1').ps[0].act; out.stunGuard = g.act('u1', { t: 'guard', on: true }).reason;
      p.stunUntil = 0; g.act('u1', { t: 'guard', on: true }); p.offhand = null; g.tick(0.05); out.lostShield = p.guardSince;
      return out;
    """)
    assert r['noShield'] == 'no-shield' and r['food'] == 'food' and r['ok'] and r['act'] == 1 and r['off'] == 'wood_shield', r
    assert r['hit'] == 'guard' and r['draw'] == 'busy' and r['afterAct'] is None and r['drawOk'] and r['act2'] == 2, r
    assert r['guardCancelsDraw'] is None and r['stunAct'] == 4 and r['stunGuard'] == 'stun' and r['lostShield'] is None, r


@test
def test_combat2_offhand_equip_unequip_and_save_roundtrip(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p } = mkFight('iron_sword'); const out = {};
      give(g, p, ['wood_shield', 'iron_shield', 'bow', 'wood_spear', 'iron_sword']);
      out.eq1 = [g.act('u1', { t: 'equip', i: 0 }).ok, p.offhand, p.inv[0]];
      out.eq2 = [g.act('u1', { t: 'equip', i: 1 }).ok, p.offhand, p.inv[1] && p.inv[1].id];                  // đổi chỗ: khiên cũ về đúng ô
      out.notArmor = [2, 3, 4].map(i => g.act('u1', { t: 'equip', i }).reason);
      p.stamina = 10; p.combo = { n: 2, at: 5 }; p.stunUntil = 99; p.guardSince = 4;
      const save = JSON.parse(JSON.stringify(g.toSave()));
      out.saved = [save.players.u1.offhand, 'stamina' in save.players.u1, 'combo' in save.players.u1, save.v];
      const g2 = Game.fromSave(save, { spawning: false, env: false, hunger: false }); const q = g2.addPlayer('u1', 'T');
      out.loaded = { off: q.offhand, sta: q.stamina, exh: !!q.exh, combo: q.combo.n, guard: q.guardSince, stun: q.stunUntil <= g2.time };
      // save cũ không có offhand; save hỏng có offhand lạ
      const old = JSON.parse(JSON.stringify(save)); delete old.players.u1.offhand;
      out.old = Game.fromSave(old, { spawning: false, env: false, hunger: false }).addPlayer('u1', 'T').offhand;
      for (const bad of ['iron_sword', 'khong-co', 5, {}, 'bow']) { const h = JSON.parse(JSON.stringify(save)); h.players.u1.offhand = bad; out['bad' + JSON.stringify(bad)] = Game.fromSave(h, { spawning: false, env: false, hunger: false }).addPlayer('u1', 'T').offhand; }
      // cởi: về kho; kho đầy thì từ chối
      p.inv.fill(null); const un = g.act('u1', { t: 'unequip', slot: 'offhand' }); out.un = [un.ok, p.offhand, p.inv[0] && p.inv[0].id];
      out.unEmpty = g.act('u1', { t: 'unequip', slot: 'offhand' }).reason;
      p.offhand = 'wood_shield'; for (let i = 0; i < p.inv.length; i++) p.inv[i] = { id: 'dirt', n: 64 }; out.unFull = [g.act('u1', { t: 'unequip', slot: 'offhand' }).reason, p.offhand];
      const { checkVersion } = await imp('save.js'); out.v1 = (() => { const s = JSON.parse(JSON.stringify(save)); s.v = 1; return checkVersion(s).v; })();
      return out;
    """)
    assert r['eq1'] == [True, 'wood_shield', None] and r['eq2'] == [True, 'iron_shield', 'wood_shield'], r
    assert r['notArmor'] == ['not-armor'] * 3, r
    assert r['saved'] == ['iron_shield', False, False, 2], r
    assert r['loaded'] == {'off': 'iron_shield', 'sta': 100, 'exh': False, 'combo': 0, 'guard': None, 'stun': True}, r
    assert r['old'] is None and r['bad"iron_sword"'] is None and r['bad"khong-co"'] is None and r['bad5'] is None and r['bad{}'] is None and r['bad"bow"'] is None, r
    assert r['un'] == [True, None, 'iron_shield'] and r['unEmpty'] == 'empty' and r['unFull'] == ['full', 'wood_shield'] and r['v1'] == 2, r


@test
def test_combat2_boss_slams_ignore_shield_but_can_be_rolled(pg):
    r = ev(pg, FIGHT_JS + r"""
      const out = {}; const { BOSSES } = await imp('content/bosses.js');
      // đập vùng và nhảy đập: không chặn được; đánh thường và đạn: chặn được
      out.flags = Object.entries(BOSSES).filter(([, d]) => !d.dungeon).map(([id, d]) => [id, Object.values(d.moves).filter(m => m.type === 'slam' || m.type === 'leap').length]);
      const { g, p, cx, cz, y0 } = mkFight('iron_sword'); p.offhand = 'wood_shield'; g.time = 10;
      const bs = spawnBoss(g, 'bo-cap-chua', cx + 0.5, y0 + 1, cz + 0.5 - 3); bs.phase = 0;
      g.act('u1', { t: 'guard', on: true }); g.time = 11; p.hp = p.maxHp = 100;
      const bossMod = await imp('sim/boss.js');
      // chiêu đập vùng gọi qua startMove: kiểm bằng cách bắt tham số opts của hurtPlayer
      const calls = []; const orig = g.hurtPlayer.bind(g); g.hurtPlayer = (pl, d, s, o) => { calls.push(o && o.blockable); return orig(pl, d, s, o); };
      bs.act = { name: 'quake', type: 'slam', until: g.time, x: bs.x, z: bs.z, dmg: 10, r: 6 }; g.tick(0.05);
      bs.cd = { claw: 0, sting: 0 }; bs.act = { name: 'leap', type: 'leap', phase: 'air', t0: g.time - 1, until: g.time, dmg: 8, r: 6 }; bs.onGround = true; g.tick(0.05);
      out.calls = calls;
      return out;
    """)
    assert any(n > 0 for _, n in r['flags']), r
    assert r['calls'][0] is False and r['calls'][1] is False, r


@test
def test_combat2_snapshot_fields_and_cheating_clients_cannot_fake_force_or_time(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m } = mkFight('bow'); const out = {}; give(g, p, ['bow', ['arrow', 9]]); p.offhand = 'wood_shield';
      g.time = 10; g.act('u1', { t: 'draw', on: true, force: 1, since: -999, time: -999 });
      const s0 = snapshotFor(g, 'u1'); out.draw = [s0.ps[0].act, s0.me.sta, s0.me.exh, s0.me.cmb];
      const r1 = g.act('u1', { t: 'shoot', yaw: 0, pitch: 0, force: 1, power: 1, draw: 99, t0: -1e9 });          // vừa kéo xong: lực do đồng hồ host
      out.fake = [r1.ok, r1.reason, invM.countItem(p.inv, 'arrow')];
      g.time = 20; g.act('u1', { t: 'draw', on: true }); g.time = 20.05; out.fake2 = g.act('u1', { t: 'shoot', force: 5 }).reason;
      p.sel = 0; g.time = 30; give(g, p, ['iron_sword']); g.act('u1', { t: 'guard', on: true, since: g.time + 999 }); g.time = 30.4;
      out.guardWindow = g.hurtPlayer(p, 4, m).how;                                                                // gửi since giả: vẫn là đỡ thường
      // mob choáng hiện trong snapshot; đạn có trọng lực -> pit
      m.stunUntil = g.time + 1; const sm = snapshotFor(g, 'u1').es.find(e => e.id === m.id); out.stn = sm.stn;
      return out;
    """)
    assert r['draw'] == [2, 100, 0, 0], r
    assert r['fake'] == [False, 'weak', 9] and r['fake2'] == 'weak', r
    assert r['guardWindow'] == 'shield' and r['stn'] == 1, r


@test
def test_combat2_new_items_recipes_content_valid_and_distinct_icons(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""async () => {
      const imp = p => import('/games/the-gioi-khoi/' + p);
      const { validateContent, loadContent } = await imp('content/validate.js'); const { ITEMS } = await imp('content/items.js'); const { RECIPES } = await imp('content/recipes.js');
      const { craft } = await imp('sim/crafting.js'); const { makeInventory, countItem, addItem } = await imp('sim/inventory.js'); const { weaponOf } = await imp('sim/rules.js');
      const { makeAtlas } = await imp('render/atlas.js'); const { createIcons } = await imp('ui/icons.js');
      const c = await loadContent(); const errors = validateContent(c); const out = { errors };
      const ids = ['bow', 'iron_bow', 'arrow', 'wood_shield', 'iron_shield', 'wood_spear', 'stone_spear', 'iron_spear', 'iron_club'];
      const R = { bow: [{ stick: 3, pelt: 1 }, 'workbench', 1], iron_bow: [{ iron_ingot: 2, stick: 3, pelt: 1 }, 'anvil', 1], arrow: [{ stick: 1, bone: 1 }, 'workbench', 4], wood_shield: [{ planks: 5, stick: 1 }, 'workbench', 1],
        iron_shield: [{ iron_ingot: 4, planks: 2 }, 'anvil', 1], wood_spear: [{ planks: 1, stick: 2 }, 'workbench', 1], stone_spear: [{ stone: 2, stick: 2 }, 'workbench', 1], iron_spear: [{ iron_ingot: 2, stick: 2 }, 'anvil', 1], iron_club: [{ iron_ingot: 3, stick: 1 }, 'anvil', 1] };
      out.recipes = {};
      for (const [id, [inn, st, n]] of Object.entries(R)) {
        const inv = makeInventory(); for (const [k, v] of Object.entries(inn)) addItem(inv, k, v);
        const noStation = craft(makeInventory().map(() => null), id, { workbench: true, anvil: true });
        const wrong = (() => { const i2 = inv.map(s => s && { ...s }); return craft(i2, id, { workbench: st !== 'workbench', anvil: st !== 'anvil', furnace: true }); })();
        const ok = craft(inv, id, { [st]: true });
        out.recipes[id] = [ok, countItem(inv, id), n, wrong, noStation, inv.filter(Boolean).length];
      }
      out.weapons = Object.fromEntries(['iron_sword', 'iron_axe', 'frost_axe', 'swamp_club', 'iron_club', 'wood_spear', 'stone_spear', 'iron_spear', 'wood_pick', 'shears', 'wolf_blade'].map(k => [k, weaponOf(ITEMS[k]).cls]));
      out.spearDmg = ['wood_spear', 'stone_spear', 'iron_spear', 'iron_club'].map(k => ITEMS[k].dmg); out.bow = [ITEMS.bow.bow, ITEMS.iron_bow.bow]; out.shield = [ITEMS.wood_shield.shield, ITEMS.iron_shield.shield]; out.stack = ITEMS.arrow.stack;
      const icons = createIcons(makeAtlas()), urls = {}, blank = [];
      for (const id of ids) { urls[id] = icons.get(id); const cv = icons.canvas(id), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; if (n < 60) blank.push(id); }
      out.icons = { distinct: new Set(Object.values(urls)).size, n: ids.length, blank };
      // dữ liệu hỏng bị bắt
      const bad = JSON.parse(JSON.stringify(c)); bad.items.bow.bow = undefined; bad.items.iron_shield.shield = undefined; bad.items.wood_spear.weapon = { cls: 'phi-tieu' }; bad.recipes.find(r => r.id === 'arrow').in = { khong_co_gi: 1 };
      out.broken = validateContent(bad).join(' | ');
      out.shop = c.shops['tho-ren'].sells.filter(s => s.item === 'arrow').length;
      return out;
    }""")
    assert r['errors'] == [], r
    for k, v in r['recipes'].items():
        assert v[0] and v[1] == v[2] and not v[3] and not v[4] and v[5] == 1, (k, r)
    assert r['weapons'] == {'iron_sword': 'sword', 'iron_axe': 'axe', 'frost_axe': 'axe', 'swamp_club': 'club', 'iron_club': 'club', 'wood_spear': 'spear', 'stone_spear': 'spear', 'iron_spear': 'spear', 'wood_pick': 'hand', 'shears': 'hand', 'wolf_blade': 'sword'}, r
    assert r['spearDmg'] == [4, 5, 7, 8] and r['stack'] == 64, r
    assert r['bow'][0]['draw'] == 1.0 and r['bow'][0]['dmgMin'] == 3 and r['bow'][0]['dmgMax'] == 10 and r['bow'][0]['speedMin'] == 12 and r['bow'][0]['speedMax'] == 28, r
    assert r['bow'][1]['draw'] == 0.8 and r['bow'][1]['dmgMax'] == 14 and r['bow'][1]['speedMax'] == 32, r
    assert r['shield'][0] == {'reduce': 0.6, 'costMul': 2} and r['shield'][1] == {'reduce': 0.8, 'costMul': 1.5}, r
    assert r['icons']['distinct'] == r['icons']['n'] and r['icons']['blank'] == [], r
    for needle in ['bow', 'iron_shield', 'phi-tieu', 'khong_co_gi']:
        assert needle in r['broken'], (needle, r['broken'])
    assert r['shop'] == 1, r


@test
def test_combat2_perf_tick_with_fights(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, cx, cz, y0 } = mkFight('bow'); give(g, p, ['bow', ['arrow', 64]]); p.offhand = 'wood_shield';
      for (let i = 0; i < 40; i++) { const m = spawnMob(g, i % 2 ? 'xac-song' : 'soi-xam', cx + 0.5 + (i % 8) * 2 - 8, y0 + 1, cz + 0.5 - 6 - Math.floor(i / 8) * 2); m.state = 'chase'; m.target = 'u1'; m.alert = 1; m.lastSeen = { x: p.x, y: p.y, z: p.z }; }
      for (let i = 0; i < 4; i++) { const q = g.addPlayer('q' + i, 'Q' + i); q.x = cx + 0.5 + i; q.z = cz + 0.5; q.y = y0 + 1; q.maxHp = q.hp = 9999; q.offhand = 'iron_shield'; g.act('q' + i, { t: 'guard', on: true }); }
      p.maxHp = p.hp = 9999; const ts = [];
      for (let i = 0; i < 200; i++) { if (i % 20 === 0) { p.stamina = 100; g.act('u1', { t: 'draw', on: true }); } if (i % 20 === 12) g.act('u1', { t: 'shoot', yaw: 0, pitch: 0 }); const t0 = performance.now(); g.tick(0.05); ts.push(performance.now() - t0); }
      return { avg: ts.reduce((a, b) => a + b, 0) / ts.length, max: Math.max(...ts) };
    """)
    assert r['avg'] < 5 and r['max'] < 25, r



@test
def test_combat2_hud_and_equipment_ui(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate(r"""async () => {
      const G = '/games/the-gioi-khoi/', imp = p => import(G + p), wait = ms => new Promise(r => setTimeout(r, ms));
      const until = async (f, ms = 5000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('hết giờ chờ: ' + String(f).slice(0, 120)); await wait(30); } };
      const g = __g, game = g.game, uid = g.S.uid, p = game.player(uid), $ = id => document.getElementById(id), out = {};
      const { itemTip } = await imp('ui/hud.js'); const { countItem } = await imp('sim/inventory.js');
      p.maxHp = p.hp = 1000; game.touch(p); p.inv.fill(null);
      const give = (id, n = 1) => { game.giveItem(uid, id, n); };
      const sel = id => { const i = p.inv.findIndex(s => s && s.id === id); game.act(uid, { t: 'sel', i }); return i; };
      // thanh thể lực: tỷ lệ, vàng dưới 40, đỏ khi kiệt sức
      p.staAt = game.time + 1000; p.stamina = 50; await until(() => $('stamina').firstElementChild.style.width === '50%'); out.w50 = [$('stamina').className, $('stamina').getBoundingClientRect().width > 50];
      p.stamina = 30; await until(() => $('stamina').classList.contains('low')); out.low = $('stamina').firstElementChild.style.width;
      p.stamina = 0; p.exh = true; p.exhUntil = game.time + 2; await until(() => $('stamina').classList.contains('exh')); out.exh = $('stamina').className;
      p.exh = false; p.staAt = 0; p.stamina = 100; await until(() => !$('stamina').classList.contains('exh'));
      // 3 chấm chuỗi kiếm
      give('iron_sword'); sel('iron_sword'); await wait(200);
      const dots = () => [...$('combo').children].filter(i => i.classList.contains('on')).length;
      p.combo = { n: 2, at: game.time + 100 }; await until(() => dots() === 2); out.dots = [dots(), $('combo').children.length, $('combo').hidden];
      p.combo = { n: 0, at: -99 }; await until(() => dots() === 0);
      // cung: vòng kéo đầy ở 1.0 s, số mũi tên đúng
      give('bow'); give('arrow', 12); sel('bow'); await wait(200); out.arrowsShown = $('arrows').textContent; out.ringHidden = $('drawring').hidden;
      g.mouse.left = true; await until(() => !$('drawring').hidden && +$('drawring').dataset.p > 10, 4000);
      out.ringMid = +$('drawring').dataset.p; await until(() => +$('drawring').dataset.p === 100, 4000); out.ringFull = [$('drawring').dataset.p, $('drawring').classList.contains('full')];
      g.mouse.left = false; await until(() => countItem(p.inv, 'arrow') === 11); await until(() => $('drawring').hidden); out.afterShot = [$('arrows').textContent, p.stamina < 100];
      // khiên: ô Tay phụ, mặc bằng chuột phải, giơ bằng F, biểu tượng sáng
      give('wood_shield'); out.shieldHidden = $('shieldico').hidden;
      sel('iron_sword'); await wait(150);
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); await until(() => !$('panel').hidden);
      out.slots = document.querySelectorAll('#panel .equiprow .slot').length; out.offEmpty = document.querySelector('#panel .slot.offhand').textContent;
      const sh = [...document.querySelectorAll('#panel .grid .slot')].find(d => d.querySelector('img') && d.querySelector('img').alt === 'Khiên gỗ');
      out.tipShield = sh.title; out.tipSword = itemTip('iron_sword'); out.tipBow = itemTip('bow'); out.tipSpear = itemTip('wood_spear'); out.tipClub = itemTip('swamp_club'); out.tipAxe = itemTip('iron_axe');
      sh.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await until(() => p.offhand === 'wood_shield');
      await until(() => document.querySelector('#panel .slot.offhand img'));
      out.eqText = document.querySelector('#panel .eqinfo').textContent; out.offImg = document.querySelector('#panel .slot.offhand img').alt;
      document.querySelector('#panel .slot.offhand').click(); await until(() => p.offhand === null); out.back = countItem(p.inv, 'wood_shield');
      document.querySelector('#panel .slot.offhand') && 0;
      game.act(uid, { t: 'equip', i: p.inv.findIndex(s => s && s.id === 'wood_shield') }); await until(() => !$('shieldico').hidden);
      document.querySelector('#panel button.x').click(); await wait(100);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); await until(() => $('shieldico').classList.contains('up')); await until(() => p.guardSince !== null);
      out.act = game.player(uid) && (await imp('net/snapshot.js')).snapshotFor(game, uid).ps[0].act;
      g.hud.shieldFlash('perfect'); out.flash = [$('shieldico').classList.contains('perfect'), $('fightflash').classList.contains('perfect')];
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' })); await until(() => !$('shieldico').classList.contains('up')); await until(() => p.guardSince === null);
      return out;
    }""")
    assert r['w50'][0] == '' and r['w50'][1] and r['low'] == '30%' and 'exh' in r['exh'], r
    assert r['dots'] == [2, 3, False], r
    assert r['arrowsShown'] == '➶ 12' and r['ringHidden'] and r['ringMid'] > 10 and r['ringFull'] == ['100', True], r
    assert r['afterShot'][0] == '➶ 11' and r['afterShot'][1], r
    assert r['shieldHidden'] and r['slots'] == 5 and 'Tay phụ' in r['offEmpty'], r
    assert 'giảm 60%' in r['tipShield'] and 'thể lực gấp 2' in r['tipShield'] and 'đỡ trong 0.25 giây' in r['tipShield'], r
    assert 'Kiếm' in r['tipSword'] and 'Hồi chiêu 0.5 giây' in r['tipSword'] and 'thể lực 6/đòn' in r['tipSword'] and 'tầm 4.5' in r['tipSword'] and 'x1.5' in r['tipSword'], r
    assert 'sát thương 3 tới 10' in r['tipBow'] and 'Giữ chuột trái' in r['tipBow'], r
    assert 'Giáo' in r['tipSpear'] and 'tầm 6' in r['tipSpear'] and 'Chùy' in r['tipClub'] and 'choáng' in r['tipClub'] and 'Rìu' in r['tipAxe'] and 'Quét' in r['tipAxe'], r
    assert 'khiên giảm 60%' in r['eqText'] and r['offImg'] == 'Khiên gỗ' and r['back'] == 1 and r['act'] == 1 and r['flash'] == [True, True], r


@test
def test_combat2_e2e_roll_key_moves_about_3_5_blocks_without_being_pulled_back(pg, browser, base):
    _open_game(pg, base)
    pg.evaluate(r"""() => {
      const g = __g, game = g.game, p = game.player(g.S.uid), w = game.world, cx = 2000, cz = 2000, y0 = 30;
      for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) { w.set(cx + dx, y0, cz + dz, 1); for (let dy = 1; dy <= 6; dy++) w.set(cx + dx, y0 + dy, cz + dz, 0); }
      game.flags['boss:thu-linh-soi'] = true; game.flags['boss:bo-cap-chua'] = true; game.env = false;
      game.teleportPlayer(p, cx + 0.5, y0 + 1, cz + 4.5);
      window.__evs = []; g.S.on('ev', e => { if (e.t === 'teleport' || e.t === 'fail') window.__evs.push(e.t + ':' + (e.a || '') + (e.reason || '')); });
    }""")
    pg.wait_for_function("Math.abs(__g.local.z - 2004.5) < 0.3", timeout=8000); pg.wait_for_timeout(500); pg.evaluate("window.__evs.length = 0")
    start = pg.evaluate("() => { const l = __g.local; l.yaw = 0; return { x: l.x, z: l.z, sta: __g.game.player(__g.S.uid).stamina }; }")
    pg.keyboard.press('KeyQ')
    pg.wait_for_function("window.__g.local.roll === null || window.__g.local.roll === undefined", timeout=4000)
    pg.wait_for_timeout(900)
    r = pg.evaluate("""() => { const l = __g.local, p = __g.game.player(__g.S.uid); return { x: l.x, z: l.z, evs: window.__evs, sta: p.stamina, cd: p.rollCdAt > 0, rolled: p.rollAt > 0 }; }""")
    dist = ((r['x'] - start['x']) ** 2 + (r['z'] - start['z']) ** 2) ** 0.5
    assert 3.1 <= dist <= 3.9, (dist, r, start)
    assert r['z'] < start['z'] and abs(r['x'] - start['x']) < 0.3, (r, start)             # không bấm hướng: lăn về phía trước (-z khi yaw 0)
    assert r['evs'] == [] and r['rolled'] and r['cd'] and r['sta'] < start['sta'] - 10, r


@test
def test_combat2_multiplayer_guard_roll_bow_and_cheating_clients(pg):
    r = ev(pg, NET_JS + r"""
      const { game, host } = await mkHost('CMBTA', { env: false }); const out = {};
      game.flags['boss:thu-linh-soi'] = true; game.flags['boss:bo-cap-chua'] = true;
      const a = await join('CMBTA', 'ua', 'An'), b = await join('CMBTA', 'ub', 'Bình');
      await until(() => game.players.size === 3 && a.snap && b.snap && a.snap.ps.length === 3);
      const cx = 2000, cz = 2000, y0 = 30;
      for (let dx = -25; dx <= 25; dx++) for (let dz = -25; dz <= 25; dz++) { game.world.set(cx + dx, y0, cz + dz, 1); for (let dy = 1; dy <= 8; dy++) game.world.set(cx + dx, y0 + dy, cz + dz, 0); }
      const pa = game.player('ua'), pb = game.player('ub'), ph = game.player('uh');
      game.teleportPlayer(pa, cx + 0.5, y0 + 1, cz + 0.5); game.teleportPlayer(pb, cx + 5.5, y0 + 1, cz + 0.5); game.teleportPlayer(ph, cx - 5.5, y0 + 1, cz + 0.5);
      for (const p of [pa, pb, ph]) { p.maxHp = p.hp = 500; }
      const actOf = (s, uid) => { const q = s.ps.find(x => x.uid === uid); return q ? (q.act || 0) : -1; };
      // --- khiên: khách đeo rồi giơ; host và khách thứ hai cùng thấy act = 1 và khiên
      game.giveItem('ua', 'wood_shield', 1); await until(() => a.you && a.you.inv.some(s => s && s.id === 'wood_shield'));
      a.act({ t: 'equip', i: a.you.inv.findIndex(s => s && s.id === 'wood_shield') }); await until(() => a.you.offhand === 'wood_shield');
      const pa0 = pa.stamina; a.act({ t: 'guard', on: true });
      await until(() => actOf(b.snap, 'ua') === 1 && actOf(a.snap, 'ua') === 1 && actOf(host.snap, 'ua') === 1);
      out.guard = [actOf(host.snap, 'ua'), actOf(a.snap, 'ua'), actOf(b.snap, 'ua'), b.snap.ps.find(x => x.uid === 'ua').off];
      // gửi thời điểm giả để kéo dài cửa sổ đỡ hoàn hảo: bị bỏ qua
      a.act({ t: 'guard', on: false }); await until(() => actOf(host.snap, 'ua') === 0);
      a.act({ t: 'guard', on: true, since: 1e9, time: 1e9 }); await until(() => pa.guardSince !== null); await wait(450);
      const src = { id: 1, kind: 'mob', x: pa.x, y: pa.y, z: pa.z - 3 };
      out.spoofGuard = game.hurtPlayer(pa, 4, src).how; a.act({ t: 'guard', on: false });
      // --- lăn: act = 3 trong 0.45 s rồi hết; khách nhận bù độ trễ
      await until(() => pa.stamina >= 99, 6000); a.act({ t: 'roll', dx: 0, dz: 1 });
      await until(() => actOf(b.snap, 'ua') === 3); out.roll = [actOf(b.snap, 'ua'), 0, game.time - pa.rollAt >= 0.08 - 1e-9];                // khách chịu bù trễ 0.08 s (chủ phòng thì không)
      await until(() => actOf(b.snap, 'ua') !== 3, 3000); out.rollEnds = actOf(b.snap, 'ua');
      out.rollSta = a.snap.me && a.snap.me.sta <= 80;
      // --- cung: khách kéo, bắn; mũi tên hiện ở cả hai và trúng quái; kill tính cho khách
      game.giveItem('ua', 'bow', 1); game.giveItem('ua', 'arrow', 10); await until(() => a.you.inv.some(s => s && s.id === 'arrow'));
      a.act({ t: 'sel', i: a.you.inv.findIndex(s => s && s.id === 'bow') }); await until(() => pa.sel === a.you.inv.findIndex(s => s && s.id === 'bow'));
      const mob = spawnMob(game, 'xac-song', cx + 0.5, y0 + 1, cz + 0.5 - 7); mob.frozen = true; mob.hp = mob.maxHp = 4;
      pa.yaw = 0; pa.pitch = 0; const evs = []; b.on('ev', e => evs.push(e));
      await until(() => pa.stamina >= 99, 6000);
      a.act({ t: 'shoot', yaw: 0, pitch: 0, force: 1 }); await wait(150); out.noDrawShot = [pa.drawSince, pa.shotAt < 0, a.you.inv.filter(s => s && s.id === 'arrow').reduce((n, s) => n + s.n, 0)];
      a.act({ t: 'draw', on: true }); await wait(120); const fails = []; a.on('ev', e => { if (e.t === 'fail') fails.push(e.a + ':' + e.reason); });
      a.act({ t: 'shoot', yaw: 0, pitch: 0, force: 1, power: 1 }); await until(() => fails.length > 0, 2000); out.fakeShot = fails[0];
      a.act({ t: 'draw', on: true }); await wait(500);
      let seenA = false, seenB = false; a.act({ t: 'shoot', yaw: 0, pitch: 0 });
      for (let i = 0; i < 80 && !(seenA && seenB); i++) { await wait(20); seenA = seenA || a.snap.es.some(e => e.kind === 'proj' && e.style === 'arrow'); seenB = seenB || b.snap.es.some(e => e.kind === 'proj' && e.style === 'arrow'); }
      out.arrowSeen = [seenA, seenB];
      await until(() => !game.ents.has(mob.id), 4000); out.killed = evs.filter(e => e.t === 'killed').map(e => e.by);
      out.arrows = a.you.inv.filter(s => s && s.id === 'arrow').reduce((n, s) => n + s.n, 0);
      return out;
    """)
    assert r['guard'] == [1, 1, 1, 'wood_shield'], r
    assert r['spoofGuard'] == 'shield', r
    assert r['roll'][0] == 3 and r['roll'][2] and r['rollEnds'] in (0, -1) and r['rollSta'], r
    assert r['noDrawShot'][0] is None and r['noDrawShot'][1] and r['noDrawShot'][2] == 10, r
    assert r['fakeShot'] == 'shoot:weak', r
    assert r['arrowSeen'] == [True, True] and r['killed'] == ['ua'] and r['arrows'] == 9, r



@test
def test_combat2_poses_effects_sounds_and_toasts(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate(r"""async () => {
      const G = '/games/the-gioi-khoi/', imp = p => import(G + p), wait = ms => new Promise(r => setTimeout(r, ms));
      const g = __g, out = {}; const { stepCameraFx, newCameraFx } = await imp('render/camerafx.js');
      // camera: lăn thì hạ thấp, hết lăn thì trở lại
      const cf = newCameraFx(); for (let i = 0; i < 12; i++) stepCameraFx(cf, 0.05, { moving: false, sprint: false, onGround: true, speed: 0, rolling: -1 }); const mid = cf.roll, side = cf.rollSide;
      for (let i = 0; i < 30; i++) stepCameraFx(cf, 0.05, { moving: false, sprint: false, onGround: true, speed: 0 }); out.cam = [mid > 0.8, side, cf.roll < 0.05];
      // người chơi khác theo ps[].act: tư thế khác nhau, khiên đeo hiện ra, nhấc lên khi giơ
      const L = g.local, mk = (act, off) => ({ key: 'p:zz', kind: 'player', uid: 'zz', name: 'Z', x: L.x + 3, y: L.y, z: L.z + 3, yaw: 0, hp: 20, maxHp: 20, act, off });
      const pose = act => { g.ents.update([mk(act, act === 1 ? 'wood_shield' : null)], 1, 0.016, [], g.scene.camera.position); const r = g.ents.rigOf('p:zz'); return { arms: r.arms.map(v => Math.round(v * 100) / 100), p: g.ents.poseOf('p:zz') }; };
      out.poses = [0, 1, 2, 3, 4].map(pose); out.armSets = new Set(out.poses.map(p => JSON.stringify(p.arms))).size;
      g.ents.update([mk(0, 'iron_shield')], 1, 0.016, [], g.scene.camera.position); out.shieldDown = g.ents.poseOf('p:zz');
      g.ents.update([mk(1, 'iron_shield')], 1, 0.016, [], g.scene.camera.position); out.shieldUp = g.ents.poseOf('p:zz');
      g.ents.update([mk(0, null)], 1, 0.016, [], g.scene.camera.position); out.shieldGone = g.ents.poseOf('p:zz').shield;
      // quái ngả người khi báo hiệu đòn
      const { spawnMob } = await imp('sim/mobs.js'); const game = g.game; const m = spawnMob(game, 'xac-song', L.x + 3, L.y, L.z - 3); m.frozen = true;
      await wait(500); g.handleEvent({ t: 'windup', id: m.id, time: 0.35 }); await wait(250); out.wind = g.ents.poseOf('e:' + m.id);
      // âm thanh và thông báo
      const st = () => ({ ...g.sfx.stats });
      for (const ev of [{ t: 'exhausted' }, { t: 'shield', perfect: true }, { t: 'shield', broke: true }, { t: 'shield', dmg: 2 }, { t: 'roll', uid: 'zz' }, { t: 'crit', id: m.id }, { t: 'parry', id: m.id }, { t: 'windup', id: m.id, time: 0.3 }, { t: 'snd', n: 'bowshot', x: L.x, z: L.z }, { t: 'snd', n: 'bowshot', x: L.x + 500, z: L.z }]) g.handleEvent(ev);
      const s = st(); out.sfx = ['exhausted', 'parry', 'shieldbreak', 'shieldhit', 'crit', 'windup', 'bowshot'].map(k => s[k] || 0);
      g.handleEvent({ t: 'exhausted' }); out.toast1 = document.getElementById('toast').textContent; g.handleEvent({ t: 'shield', broke: true }); out.toast2 = document.getElementById('toast').textContent;
      g.handleEvent({ t: 'fail', a: 'shoot', reason: 'no-ammo' }); out.toast3 = document.getElementById('toast').textContent; g.handleEvent({ t: 'fail', a: 'roll', reason: 'tired' }); out.toast4 = document.getElementById('toast').textContent;
      for (const name of ['roll', 'bowdraw', 'bowshot', 'shieldhit', 'parry', 'shieldbreak', 'exhausted', 'crit', 'windup']) g.sfx.play(name);
      return out;
    }""")
    assert r['cam'] == [True, -1, True], r
    assert r['armSets'] == 5, r
    assert not r['poses'][0]['p']['shield'] and r['poses'][1]['p']['shield'] and r['poses'][1]['p']['shieldUp'], r
    assert r['shieldDown']['shield'] and not r['shieldDown']['shieldUp'] and r['shieldUp']['shieldUp'] and not r['shieldGone'], r
    assert r['wind']['wind'] and r['wind']['rx'] < -0.05, r
    assert all(n >= 1 for n in r['sfx'][:6]) and r['sfx'][6] == 1, r                        # tiếng bắn ở xa 500 block bị bỏ
    assert r['toast1'] == 'Hết sức!' and r['toast2'] == 'Khiên vỡ!' and r['toast3'] == 'Hết mũi tên!' and r['toast4'] == 'Hết sức!', r



@test
def test_combat2_fall_speed_is_measured_by_the_host_from_height_changes(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m, cx, cz, y0 } = mkFight('iron_sword'); const out = {};
      const st = (y, extra = {}) => ({ x: cx + 0.5, y, z: cz + 0.5, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0, seq: p.tpSeq, ...extra });
      g.teleportPlayer(p, cx + 0.5, y0 + 6, cz + 0.5); let y = y0 + 6;
      for (let i = 0; i < 6; i++) { g.time += 0.05; y -= 0.5; g.applyState('u1', st(y, { vy: +99 })); }               // rơi 10 block/giây; khách khai vy = +99 cũng không ăn thua
      out.fall = [p.fallVy < -5, g.time > 0]; out.crit = hitAt(g, m, g.time + 1).dmg;
      // đứng yên trên không nhưng khai vy = -50: host đo được ~0 nên không được x1.5
      g.teleportPlayer(p, cx + 0.5, y0 + 6, cz + 0.5);
      for (let i = 0; i < 6; i++) { g.time += 0.05; g.applyState('u1', st(y0 + 6, { vy: -50 })); }
      m.y = y0 + 6; out.fake = [p.fallVy > -0.5, hitAt(g, m, g.time + 1).dmg]; m.y = y0 + 1;
      // chạm đất thì không còn đòn rơi dù vận tốc cũ còn âm
      g.teleportPlayer(p, cx + 0.5, y0 + 1, cz + 0.5); p.fallVy = -9; out.ground = hitAt(g, m, g.time + 1).dmg;
      return out;
    """)
    assert r['fall'][0] and r['crit'] == 9 and r['fake'] == [True, 6] and r['ground'] == 6, r


@test
def test_combat2_tester_abuse_dead_spam_nan_and_bad_save(pg):
    r = ev(pg, FIGHT_JS + r"""
      const { g, p, m } = mkFight('wooden_bow'); const out = {};
      give(g, p, ['wooden_bow', ['arrow', 20]]);
      // spam: 200 lệnh bắn/lăn/giơ khiên/kéo cung liên tiếp không được lỗi, mũi tên không âm, thể lực trong [0,100]
      let err = null;
      try { for (let i = 0; i < 200; i++) { g.time += 0.01; for (const t of ['draw', 'shoot', 'roll', 'guard', 'hit']) g.act('u1', { t, id: m.id, on: true, dx: 0, dy: 0, dz: -1 }); g.tick(0.01); } } catch (e) { err = String(e); }
      out.err = err; out.sta = p.stamina >= 0 && p.stamina <= 100; out.arr = p.inv.reduce((n, s) => n + (s && s.id === 'arrow' ? s.n : 0), 0) >= 0;
      // giá trị NaN/Infinity từ khách không làm hỏng toạ độ
      try { g.act('u1', { t: 'shoot', dx: NaN, dy: Infinity, dz: NaN }); g.act('u1', { t: 'roll', dx: NaN, dz: NaN }); g.tick(0.05); } catch (e) { out.err2 = String(e); }
      out.finite = [p.x, p.y, p.z].every(Number.isFinite);
      // chết giữa lúc kéo cung/giơ khiên: mọi lệnh bị từ chối và hồi sinh xoá trạng thái
      p.hp = 0; p.dead = true;
      out.dead = ['roll', 'guard', 'draw', 'shoot', 'hit'].map(t => g.act('u1', { t, id: m.id }).ok);
      g.act('u1', { t: 'respawn' });
      out.resp = [p.stamina, !!p.guardSince, !!p.drawSince, p.exhaust || 0];
      // save hỏng ở offhand
      for (const bad of [{ id: 'khong-co', n: 1 }, 5, 'x', { id: 'wooden_bow', n: 1 }]) {
        const sv = JSON.parse(JSON.stringify(g.toSave())); (sv.players ||= {}); for (const k in sv.players) sv.players[k].offhand = bad;
        try { const g2 = Game.fromSave(sv, { spawning: false }); g2.addPlayer('u1', 'T'); g2.tick(0.05); } catch (e) { out.save = String(e); }
      }
      return out;
    """)
    assert not r.get('err') and not r.get('err2') and r['sta'] and r['arr'] and r['finite'], r
    assert r['dead'] == [False] * 5 and r['resp'][0] == 100 and not r['resp'][1] and not r['resp'][2], r
    assert not r.get('save'), r


KEYS_SETUP = r"""
      const game = __g.game, uid = __g.S.uid, p = game.player(uid), wait = ms => new Promise(r => setTimeout(r, ms));
      const { B } = await import('/games/the-gioi-khoi/world/blocks.js');
      const cx = Math.floor(p.x) + 10, cz = Math.floor(p.z), y0 = Math.floor(p.y) - 1;
      for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) { game.world.set(cx + dx, y0, cz + dz, B.GRASS); for (let dy = 1; dy <= 5; dy++) game.world.set(cx + dx, y0 + dy, cz + dz, 0); }
      p.maxHp = p.hp = 1000; p.dead = false; p.stamina = 100; p.offhand = 'wood_shield';
      p.inv.fill(null); p.inv[0] = { id: 'iron_sword', n: 1 }; p.sel = 0; game.touch(p);
      game.teleportPlayer(p, cx + 0.5, y0 + 1, cz + 0.5); await wait(900);
      const st = () => ({ sta: Math.round(p.stamina), guard: p.guardSince !== null && p.guardSince !== undefined, x: __g.local.x, z: __g.local.z, roll: !!__g.local.roll });
"""


@test
def test_keys_q_rolls_and_f_guards_with_real_keyboard(pg, browser, base):
    _open_game(pg, base)
    a = pg.evaluate("async () => {" + KEYS_SETUP + "return { s0: st() }; }")
    s0 = a['s0']; assert s0['sta'] == 100 and not s0['guard'], a
    # Q + W: lăn về phía trước, trừ thể lực, người chơi dịch chuyển rõ rệt
    pg.keyboard.down('KeyW'); pg.wait_for_timeout(150); pg.keyboard.press('KeyQ'); pg.wait_for_timeout(120)
    mid = pg.evaluate("() => ({ roll: !!__g.local.roll })")
    pg.wait_for_timeout(700); pg.keyboard.up('KeyW')
    r = pg.evaluate("() => { const p = __g.game.player(__g.S.uid); return { sta: Math.round(p.stamina), x: __g.local.x, z: __g.local.z }; }")
    assert mid['roll'], mid                                                       # client bắt đầu lăn ngay khi nhấn Q
    assert r['sta'] <= 80, r                                                      # host trừ thể lực (ROLL_COST 25, đã hồi một ít)
    moved = ((r['x'] - s0['x']) ** 2 + (r['z'] - s0['z']) ** 2) ** 0.5
    assert moved > 2.5, (moved, r, s0)                                            # lăn + đi bộ: dịch > 2,5 block
    # nhấn giữ Q (lặp phím) chỉ lăn một lần; lăn tiếp trong thời gian hồi chiêu bị bỏ qua
    pg.wait_for_timeout(1500)
    pg.evaluate("() => { __g.game.player(__g.S.uid).stamina = 100; }"); pg.wait_for_timeout(200)
    sta1 = pg.evaluate("() => Math.round(__g.game.player(__g.S.uid).stamina)")
    pg.keyboard.down('KeyQ'); pg.keyboard.down('KeyQ'); pg.keyboard.down('KeyQ'); pg.keyboard.up('KeyQ'); pg.wait_for_timeout(400)
    sta2 = pg.evaluate("() => Math.round(__g.game.player(__g.S.uid).stamina)")
    assert 100 - sta2 < 40, (sta1, sta2)                                          # chỉ một lần trừ (25), không phải ba lần
    pg.wait_for_timeout(1500)
    # F: giơ khiên khi giữ, hạ khi thả
    pg.evaluate("() => { __g.game.player(__g.S.uid).stamina = 100; }")
    pg.keyboard.down('KeyF'); pg.wait_for_timeout(300)
    g1 = pg.evaluate("() => __g.game.player(__g.S.uid).guardSince !== null && __g.game.player(__g.S.uid).guardSince !== undefined")
    pg.keyboard.up('KeyF'); pg.wait_for_timeout(300)
    g2 = pg.evaluate("() => __g.game.player(__g.S.uid).guardSince !== null && __g.game.player(__g.S.uid).guardSince !== undefined")
    assert g1 and not g2, (g1, g2)
    # mở kho (E): Q và F bị bỏ qua; đóng kho thì dùng lại được
    pg.evaluate("() => { __g.game.player(__g.S.uid).stamina = 100; }")
    pg.keyboard.press('KeyE'); pg.wait_for_timeout(300)
    pg.keyboard.press('KeyQ'); pg.keyboard.down('KeyF'); pg.wait_for_timeout(300); pg.keyboard.up('KeyF')
    ui = pg.evaluate("() => ({ sta: Math.round(__g.game.player(__g.S.uid).stamina), guard: __g.game.player(__g.S.uid).guardSince !== null && __g.game.player(__g.S.uid).guardSince !== undefined })")
    assert ui['sta'] == 100 and not ui['guard'], ui
    pg.keyboard.press('KeyE'); pg.wait_for_timeout(300)
    pg.keyboard.down('KeyF'); pg.wait_for_timeout(300)
    again = pg.evaluate("() => __g.game.player(__g.S.uid).guardSince !== null && __g.game.player(__g.S.uid).guardSince !== undefined")
    pg.keyboard.up('KeyF'); assert again, again


@test
def test_keys_q_ignored_when_exhausted_and_f_needs_a_shield(pg, browser, base):
    _open_game(pg, base)
    pg.evaluate("async () => {" + KEYS_SETUP + "}")
    # hết thể lực: Q không làm gì
    pg.evaluate("() => { const p = __g.game.player(__g.S.uid); p.stamina = 5; }"); pg.wait_for_timeout(250)
    pg.keyboard.press('KeyQ'); pg.wait_for_timeout(300)
    r = pg.evaluate("() => ({ roll: !!__g.local.roll })"); assert not r['roll'], r
    # không có khiên: F không giơ
    pg.evaluate("() => { const p = __g.game.player(__g.S.uid); p.stamina = 100; p.offhand = null; __g.game.touch(p); }"); pg.wait_for_timeout(300)
    pg.keyboard.down('KeyF'); pg.wait_for_timeout(300)
    g = pg.evaluate("() => __g.game.player(__g.S.uid).guardSince !== null && __g.game.player(__g.S.uid).guardSince !== undefined")
    pg.keyboard.up('KeyF'); assert not g, g



@test
def test_qa_mobs_do_not_overlap_player_and_stop_at_melee_range(pg):
    r = ev(pg, ARENA_JS + r"""
      const { g, p, cx, cz, y0 } = mkArena(); const out = {};
      const z = spawnMob(g, 'xac-song', cx + 0.5, y0 + 1, cz + 0.5);              // chồng đúng lên người chơi
      z.alert = 1; z.state = 'chase'; z.target = 'u1';
      for (let i = 0; i < 40; i++) g.tick(0.05);
      out.d1 = dist(z, p);
      const w = spawnMob(g, 'soi-xam', cx + 0.5, y0 + 1, cz + 8.5);
      for (let i = 0; i < 200; i++) { g.tick(0.05); p.hp = p.maxHp; }
      out.d2 = dist(w, p);
      return out;
    """)
    assert r['d1'] >= 0.55, r                         # bị đẩy ra, không còn ở trong thân người chơi
    assert r['d2'] >= 0.55, r


@test
def test_qa_guide_hint_without_quests_and_shield_toast_and_ready_filter(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""() => { __g.hud.setQuests([]); const q = document.getElementById('quests'); return q.textContent; }""")
    assert 'Gợi ý' in r and '❗' in r, r
    pg.evaluate("() => { const p = __g.game.player(__g.S.uid); p.offhand = null; __g.S.you.offhand = null; }")
    pg.wait_for_timeout(300)
    pg.keyboard.down('KeyF'); pg.wait_for_timeout(200); pg.keyboard.up('KeyF')
    t = pg.evaluate("() => document.getElementById('toast').textContent")
    assert 'khiên' in t, t
    pg.keyboard.press('KeyE'); pg.wait_for_timeout(300)
    n0 = pg.evaluate("() => document.querySelectorAll('#panel .rec').length")
    pg.click('#panel button.filter'); pg.wait_for_timeout(200)
    n1 = pg.evaluate("() => document.querySelectorAll('#panel .rec').length")
    assert n0 > n1, (n0, n1)                           # lọc "chế được" làm danh sách ngắn lại



@test
def test_qa_dungeon_mouth_has_arch_with_lintel_and_inner_torches(pg):
    r = ev(pg, DUNGEON_JS + r"""
      const { g, site } = mkDg(); const { steps, gy, ox, oz } = site, ax = ox - 2 * steps - 3, w = g.world;
      return { lintel: [-3, 0, 3].map(lz => w.get(ax, gy + 4, oz + lz)), pillar: w.get(ax, gy + 3, oz + 3), open: w.get(ax, gy + 1, oz), torch: w.get(ax, gy + 2, oz + 2), torch2: w.get(ax, gy + 2, oz - 2), TORCH: B.TORCH };
    """)
    assert all(b != 0 for b in r['lintel']) and r['pillar'] != 0, r        # xà ngang và cột
    assert r['open'] == 0, r                                               # lối đi bên dưới vẫn thông
    assert r['torch'] == r['TORCH'] and r['torch2'] == r['TORCH'], r


@test
def test_qa_damage_direction_arrow_and_hit_kick(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("""() => { __g.hud.dmgDir(1.2); const el = document.getElementById('dmgdir'); return { on: el.classList.contains('on'), t: el.style.transform }; }""")
    assert r['on'] and 'rotate(-1.2rad)' in r['t'], r
    pg.wait_for_timeout(1200)
    assert not pg.evaluate("() => document.getElementById('dmgdir').classList.contains('on')")   # tự tắt sau ~1 giây



@test
def test_qa_player_is_pushed_out_of_npc_body(pg):
    r = ev(pg, GAME_JS + r"""
      const { pushOutOf } = await imp('sim/physics.js');
      const { g, p } = mkGame(); const body = { x: p.x, y: p.y, z: p.z, w: 0.6 };
      const npc = { x: p.x + 0.1, y: p.y, z: p.z, r: 0.35 };
      pushOutOf(g.world, body, [npc]);
      const far = { x: p.x + 5, y: p.y, z: p.z, w: 0.6 }; pushOutOf(g.world, far, [npc]);
      return { d: Math.hypot(body.x - npc.x, body.z - npc.z), moved: far.x - (p.x + 5) };
    """)
    assert r['d'] >= 0.6, r
    assert r['moved'] == 0, r



@test
def test_hud_minimap_health_bars_and_damage_numbers(pg, browser, base):
    _open_game(pg, base)
    pg.evaluate("""async () => { const M = await import('./sim/mobs.js'), g = __g.game, p = g.player(__g.S.uid); g.env = false; p.maxHp = p.hp = 50;
      const m = M.spawnMob(g, 'xac-song', p.x + 0.5, p.y, p.z - 3.5); m.frozen = true; window.__m = m; window.__full = M.spawnMob(g, 'xac-song', p.x + 3.5, p.y, p.z - 3.5); window.__full.frozen = true; }""")
    pg.wait_for_timeout(1200)
    r = pg.evaluate("""() => { const c = document.querySelector('#minimap canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return { w: c.width, painted: n, info: document.querySelector('#minimap .mminfo').textContent, hpw: document.querySelector('#hp i').style.width }; }""")
    assert r['w'] >= 100 and r['painted'] > 3000, r                         # bản đồ có vẽ địa hình
    assert ',' in r['info'] and ('ngày' in r['info'] or 'đêm' in r['info']), r   # tọa độ và giờ
    assert r['hpw'] == '100%', r                                            # thanh máu bản thân
    # quái nguyên máu: chưa hiện thanh; bị đánh: hiện thanh + số sát thương
    pg.evaluate("() => { window.__m.hp -= 7; }"); pg.wait_for_timeout(500)
    q = pg.evaluate("""() => ({ a: __g.ents.barOf('e:' + window.__m.id), b: __g.ents.barOf('e:' + window.__full.id), pop: __g.ents.popupCount() })""")
    assert q['a'] and q['a']['visible'] and q['a']['kind'] == 'mob', q
    assert q['b'] and not q['b']['visible'], q
    assert q['pop'] >= 1, q
    pg.keyboard.press('KeyN'); pg.wait_for_timeout(300)
    assert pg.evaluate("() => document.getElementById('minimap').classList.contains('big')")
    pg.keyboard.press('KeyN'); pg.wait_for_timeout(200)
    assert not pg.evaluate("() => document.getElementById('minimap').classList.contains('big')")
    pg.evaluate("() => { const p = __g.game.player(__g.S.uid); p.hp = 5; __g.game.touch(p); }"); pg.wait_for_timeout(600)
    assert pg.evaluate("() => document.getElementById('hp').classList.contains('low')")



@test
def test_survival_fall_damage_and_drowning(pg):
    r = ev(pg, ARENA_JS + r"""
      const { B } = await imp('world/blocks.js'); const out = {};
      const { g, p, cx, cz, y0 } = mkArena(); p.maxHp = p.hp = 20;
      const st = (y, i) => g.applyState('u1', { x: cx + 0.5, y, z: cz + 0.5, yaw: 0, pitch: 0, seq: p.tpSeq });
      const fall = (from, to) => { g.time += 1; g.teleportPlayer(p, cx + 0.5, from, cz + 0.5); p.lastState = g.time; for (let y = from; y > to; y -= 0.4) { g.time += 0.05; p.lastState = g.time - 0.05; st(Math.max(to, y)); } g.time += 0.05; p.lastState = g.time - 0.05; st(to); };
      st(y0 + 1);
      fall(y0 + 3, y0 + 1); out.small = p.hp;                         // 2 block: không sao
      fall(y0 + 9, y0 + 1); out.big = p.hp;                           // 8 block: mất máu
      // rơi vào nước thì an toàn
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 1; dy <= 4; dy++) g.world.set(cx + dx, y0 + dy, cz + dz, B.WATER);
      p.hp = 20; fall(y0 + 14, y0 + 1); out.water = p.hp;
      // ngạt: đầu chìm dưới nước 12 giây hết khí rồi mất máu
      p.x = cx + 0.5; p.y = y0 + 1; p.z = cz + 0.5; p.hp = 20; p.air = undefined;
      for (let i = 0; i < 20 * 5; i++) g.regionTick(0.05); out.air5 = p.air; out.hpEarly = p.hp;
      for (let i = 0; i < 20 * 12; i++) g.regionTick(0.05); out.hpLate = p.hp; out.airLate = p.air;
      for (let dy = 1; dy <= 4; dy++) g.world.set(cx, y0 + dy, cz, 0);
      for (let i = 0; i < 20 * 5; i++) g.regionTick(0.05); out.airBack = p.air;
      return out;
    """)
    assert r['small'] == 20, r
    assert r['big'] < 20, r                                     # 8 block ~ 4 máu
    assert r['water'] == 20, r
    assert 6.5 < r['air5'] < 7.5 and r['hpEarly'] == 20, r      # còn khí, chưa mất máu
    assert r['hpLate'] < 20 and r['airLate'] == 0, r
    assert r['airBack'] > 11, r                                 # lên khỏi nước thì hồi khí


@test
def test_hud_kill_feed_tab_list_armor_and_air(pg, browser, base):
    _open_game(pg, base)
    r = pg.evaluate("() => { __g.hud.feed('⚔ Bạn hạ Xác Sống'); __g.hud.setAir(4); __g.hud.setArmor(7); return { feed: document.getElementById('killfeed').textContent, air: !document.getElementById('air').hidden, armor: document.querySelector('#hp .armor').textContent }; }")
    assert 'hạ Xác Sống' in r['feed'] and r['air'] and '7' in r['armor'], r
    pg.keyboard.down('Tab'); pg.wait_for_timeout(400)
    t = pg.evaluate("() => ({ shown: !document.getElementById('players').hidden, txt: document.getElementById('players').textContent })")
    pg.keyboard.up('Tab'); pg.wait_for_timeout(300)
    assert t['shown'] and '(bạn)' in t['txt'], t
    assert pg.evaluate("() => document.getElementById('players').hidden")
    assert 'ngày' in pg.evaluate("() => document.querySelector('#minimap .mminfo').textContent")



@test
def test_chat_real_keyboard_commands_and_rate_limit(pg, browser, base):
    _open_game(pg, base)
    pg.keyboard.press('KeyT'); pg.wait_for_timeout(200)
    assert pg.evaluate("() => !document.getElementById('chatin').hidden && document.activeElement.id === 'chatin'")
    x0 = pg.evaluate("() => __g.local.x")
    pg.keyboard.type('xin chào mọi người'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    log = pg.evaluate("() => document.getElementById('chatlog').textContent")
    assert 'xin chào mọi người' in log, log                                  # tin gửi qua host rồi phát lại
    assert pg.evaluate("() => document.getElementById('chatin').hidden")
    assert not pg.evaluate("() => document.getElementById('minimap').classList.contains('big')")   # gõ chữ n/m không kích hoạt phím tắt
    pg.keyboard.press('Slash'); pg.wait_for_timeout(200)
    pg.keyboard.type('pos'); pg.wait_for_timeout(100); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    assert 'Bạn ở' in pg.evaluate("() => document.getElementById('chatlog').textContent")
    r = ev(pg, GAME_JS + r"""
      const { g, p } = mkGame(); const out = [];
      g.on && 0; const ev1 = []; const orig = g.emit.bind(g); g.emit = (to, e) => { ev1.push(e); return orig(to, e); };
      out.push(g.act('u1', { t: 'chat', text: '  hi  ' }).ok);
      out.push(g.act('u1', { t: 'chat', text: 'spam' }).reason);           // quá nhanh
      g.time += 1; out.push(g.act('u1', { t: 'chat', text: '   ' }).reason);   // rỗng
      g.time += 1; out.push(g.act('u1', { t: 'chat', text: 'x'.repeat(500) }).ok);
      g.time += 1; g.act('u1', { t: 'chat', text: '/help' });
      g.time += 1; g.act('u1', { t: 'chat', text: '/bogus' });
      return { out, chats: ev1.filter(e => e.t === 'chat').map(e => ({ sys: !!e.sys, len: e.text.length, name: e.name })) };
    """)
    assert r['out'] == [True, 'too-soon', 'empty', True], r
    assert r['chats'][0]['name'] == 'Tester' and r['chats'][1]['len'] == 120, r   # cắt 120 ký tự
    assert r['chats'][2]['sys'] and r['chats'][3]['sys'], r



@test
def test_worldmap_key_m_explored_waypoint_and_close(pg, browser, base):
    _open_game(pg, base)
    pg.wait_for_timeout(1500)
    pg.keyboard.press('KeyM'); pg.wait_for_timeout(500)
    assert pg.evaluate("() => !document.getElementById('worldmap').hidden")
    assert pg.evaluate("() => __g.local && document.querySelector('#worldmap canvas').width > 300")
    r = pg.evaluate("""() => { const c = document.querySelector('#worldmap canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++; return { lit, total: d.length / 16 }; }""")
    assert 0.02 < r['lit'] / r['total'] < 0.9, r                      # có vùng đã khám phá, phần còn lại là sương đen
    x0 = pg.evaluate("() => __g.local.x")
    pg.keyboard.down('KeyW'); pg.wait_for_timeout(300); pg.keyboard.up('KeyW')
    assert abs(pg.evaluate("() => __g.local.x") - x0) < 0.5                # mở bản đồ thì không đi được
    box = pg.evaluate("() => { const r = document.querySelector('#worldmap canvas').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")
    pg.mouse.click(box[0] + box[2] * 0.7, box[1] + box[3] * 0.3); pg.wait_for_timeout(300)
    pg.keyboard.press('Equal'); pg.keyboard.press('Minus'); pg.wait_for_timeout(100)      # thu phóng rồi trả về cũ
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    assert pg.evaluate("() => document.getElementById('worldmap').hidden")
    assert not pg.evaluate("() => document.getElementById('pause').hidden === false")   # Esc chỉ đóng bản đồ, không mở menu tạm dừng
    info = pg.evaluate("() => document.querySelector('#minimap .mminfo').textContent")
    assert '◆' in info, info                                         # điểm đánh dấu hiện khoảng cách trên bản đồ nhỏ
    assert pg.evaluate("() => localStorage.getItem('tgk-waypoint-777') !== null")
    pg.keyboard.press('KeyM'); pg.wait_for_timeout(300)
    pg.mouse.click(box[0] + box[2] * 0.7, box[1] + box[3] * 0.3); pg.wait_for_timeout(200)  # bấm lại đúng chỗ: bỏ điểm
    pg.keyboard.press('KeyM'); pg.wait_for_timeout(200)
    assert '◆' not in pg.evaluate("() => document.querySelector('#minimap .mminfo').textContent")


@test
def test_settings_sensitivity_fov_toggles_persist(pg, browser, base):
    _open_game(pg, base)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    assert pg.evaluate("() => !document.getElementById('pause').hidden")
    pg.evaluate("""() => { const s = document.getElementById('set-fov'); s.value = 90; s.dispatchEvent(new Event('input')); const m = document.getElementById('set-map'); m.checked = false; m.dispatchEvent(new Event('change')); const f = document.getElementById('set-fps'); f.checked = true; f.dispatchEvent(new Event('change')); const v = document.getElementById('set-sens'); v.value = 200; v.dispatchEvent(new Event('input')); }""")
    pg.wait_for_timeout(400)
    st = pg.evaluate("() => ({ gs: JSON.parse(localStorage.getItem('tgk-settings-v1')), mm: document.getElementById('minimap').style.display, fps: !document.getElementById('fps').hidden, fovTxt: document.getElementById('fov-val').textContent })")
    assert st['gs']['fov'] == 90 and st['gs']['sens'] == 200 and st['gs']['map'] is False and st['gs']['fps'] is True, st
    assert st['mm'] == 'none' and st['fps'] and st['fovTxt'] == '90°', st
    pg.keyboard.press('Escape'); pg.wait_for_timeout(1200)
    pg.evaluate("() => Object.defineProperty(document, 'pointerLockElement', { get: () => document.getElementById('cv'), configurable: true })")
    y0 = pg.evaluate("() => __g.local.yaw")
    pg.evaluate("() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: -100, movementY: 0 }))"); pg.wait_for_timeout(100)
    y1 = pg.evaluate("() => __g.local.yaw")
    assert 0.35 < abs(y1 - y0) < 0.65, (y0, y1)                       # 100 px * 0.0025 * 2.0 = 0.5 rad (độ nhạy x2)
    fov = pg.evaluate("() => __g.scene ? __g.scene.camera.fov : null")
    pg.evaluate("() => { document.getElementById('set-reset').click(); }")
    st2 = pg.evaluate("() => JSON.parse(localStorage.getItem('tgk-settings-v1'))")
    assert st2['fov'] == 72 and st2['sens'] == 100 and st2['map'] is True, st2


if __name__ == '__main__':
    run(TESTS)
