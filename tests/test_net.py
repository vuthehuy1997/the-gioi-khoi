#!/usr/bin/env python3
"""Kiểm thử lớp mạng platform/net và trang thử phòng của Thế Giới Khối.

Chạy:  python3 tests/test_net.py [lọc tên]
Các bài logic mở trang chủ rồi import module trực tiếp; không bài nào cần mạng ngoài.
"""
from harness import run, root

TESTS = []
def test(fn):
    TESTS.append(fn); return fn

JS_HELPERS = """
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 2000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('hết giờ chờ'); await wait(10); } };
"""

def ev(pg, body):
    """Chạy `body` (thân hàm async) trong trang, có sẵn wait/until; trả về giá trị return."""
    return pg.evaluate("async () => {" + JS_HELPERS + body + "}")


@test
def test_room_codes(pg):
    r = ev(pg, r"""
      const p = await import('/platform/net/protocol.js');
      const codes = Array.from({ length: 2000 }, () => p.makeRoomCode());
      return {
        allValid: codes.every(c => p.isValidCode(c) && c.length === 5),
        confusing: codes.some(c => /[IO01]/.test(c)),
        unique: new Set(codes).size,
        lower: p.normalizeCode('  abcde '),
        zero: p.isValidCode('AB0DE'), short: p.isValidCode('ABCD'), six: p.isValidCode('ABCDEF'),
        seven: p.isValidCode('ABCDEFG'), notString: p.isValidCode(12345),
      };
    """)
    assert r['allValid'] and not r['confusing'] and r['unique'] >= 1990, r
    assert r['lower'] == 'ABCDE' and not r['zero'] and not r['short'] and r['six'], r
    assert not r['seven'] and not r['notString'], r


@test
def test_clean_name(pg):
    r = ev(pg, r"""
      const { cleanName } = await import('/platform/net/protocol.js');
      return {
        plain: cleanName('  Lan  '), html: cleanName('<i>x</i>'), ctrl: cleanName('\u0000a\u0007b\n'),
        empty: cleanName('   '), onlyCtrl: cleanName('\u0000\u0007'), num: cleanName(123),
        long: [...cleanName('😀'.repeat(20))].length, viet: cleanName('Nguyễn Văn Ạ'),
      };
    """)
    assert r == {'plain': 'Lan', 'html': '<i>x</i>', 'ctrl': 'ab', 'empty': 'Khách', 'onlyCtrl': 'Khách',
                 'num': 'Khách', 'long': 16, 'viet': 'Nguyễn Văn Ạ'}, r


@test
def test_protocol_constants(pg):
    r = ev(pg, r"""
      const p = await import('/platform/net/protocol.js');
      return { v: p.PROTOCOL_VERSION, max: p.MAX_PLAYERS, types: p.WIRE_TYPES,
               longest: Math.max(...p.WIRE_TYPES.map(t => new TextEncoder().encode(t).length)) };
    """)
    assert r['v'] == 1 and r['max'] == 5 and r['longest'] <= 12, r
    assert sorted(r['types']) == ['app', 'hello', 'ping', 'pong', 'reject', 'roster'], r


ROOM_JS = """
const { Room } = await import('/platform/net/room.js');
const { createMemoryTransport: mt } = await import('/platform/net/transport-memory.js');
"""


@test
def test_create_and_join(pg):
    r = ev(pg, ROOM_JS + r"""
      const host = await Room.create({ transport: mt(), name: 'Chủ', code: 'ABCDE' });
      const guest = await Room.join({ transport: mt(), name: 'Khách', code: 'abcde' });
      await until(() => host.players.length === 2);
      return { code: guest.code, hostIsHost: host.isHost, guestIsHost: guest.isHost,
               hostPlayers: host.players.map(p => p.name), guestPlayers: guest.players.map(p => p.name),
               guestKnowsHost: guest.hostId === host.selfId };
    """)
    assert r == {'code': 'ABCDE', 'hostIsHost': True, 'guestIsHost': False, 'hostPlayers': ['Chủ', 'Khách'],
                 'guestPlayers': ['Chủ', 'Khách'], 'guestKnowsHost': True}, r


@test
def test_sixth_player_is_rejected_as_full(pg):
    r = ev(pg, ROOM_JS + r"""
      const host = await Room.create({ transport: mt(), name: 'H', code: 'FULL2' });
      const guests = [];
      for (let i = 0; i < 4; i++) guests.push(await Room.join({ transport: mt(), name: 'G' + i, code: 'FULL2' }));
      await until(() => host.players.length === 5);
      let reason = null;
      try { await Room.join({ transport: mt(), name: 'G5', code: 'FULL2', timeoutMs: 2000 }); } catch (e) { reason = e.message; }
      await wait(200);
      return { reason, hostCount: host.players.length, guestCount: guests[0].players.length };
    """)
    assert r == {'reason': 'full', 'hostCount': 5, 'guestCount': 5}, r


@test
def test_join_errors(pg):
    r = ev(pg, ROOM_JS + r"""
      const out = {};
      try { await Room.join({ transport: mt(), name: 'A', code: 'AB0DE' }); } catch (e) { out.bad = e.message; }
      const t0 = Date.now();
      try { await Room.join({ transport: mt(), name: 'A', code: 'ZZZZZ', timeoutMs: 300 }); } catch (e) { out.missing = e.message; }
      out.ms = Date.now() - t0;
      await Room.create({ transport: mt(), name: 'H', code: 'VERS3' });
      try { await Room.join({ transport: mt(), name: 'A', code: 'VERS3', version: 99, timeoutMs: 1500 }); } catch (e) { out.version = e.message; }
      try { await Room.create({ transport: mt(), name: 'A', code: 'nope' }); } catch (e) { out.create = e.message; }
      return out;
    """)
    assert r['bad'] == 'bad-code' and r['missing'] == 'not-found' and r['version'] == 'version' and r['create'] == 'bad-code', r
    assert 250 <= r['ms'] < 1500, r


@test
def test_host_leaving_closes_guests(pg):
    r = ev(pg, ROOM_JS + r"""
      const host = await Room.create({ transport: mt(), name: 'H', code: 'HLEFT' });
      const guest = await Room.join({ transport: mt(), name: 'G', code: 'HLEFT' });
      let reason = null; guest.on('closed', x => { reason = x; });
      host.leave();
      await until(() => reason);
      return { reason, closed: guest.closed };
    """)
    assert r == {'reason': 'host-left', 'closed': True}, r


@test
def test_guest_leaving_updates_roster(pg):
    r = ev(pg, ROOM_JS + r"""
      const host = await Room.create({ transport: mt(), name: 'H', code: 'LEAVE' });
      const g1 = await Room.join({ transport: mt(), name: 'G1', code: 'LEAVE' });
      const g2 = await Room.join({ transport: mt(), name: 'G2', code: 'LEAVE' });
      await until(() => g1.players.length === 3);
      g2.leave();
      await until(() => host.players.length === 2 && g1.players.length === 2);
      return { host: host.players.map(p => p.name), g1: g1.players.map(p => p.name) };
    """)
    assert r == {'host': ['H', 'G1'], 'g1': ['H', 'G1']}, r


@test
def test_messages_broadcast_and_direct(pg):
    r = ev(pg, ROOM_JS + r"""
      const host = await Room.create({ transport: mt(), name: 'H', code: 'MSGAB' });
      const g1 = await Room.join({ transport: mt(), name: 'G1', code: 'MSGAB' });
      const g2 = await Room.join({ transport: mt(), name: 'G2', code: 'MSGAB' });
      await until(() => host.players.length === 3 && g1.players.length === 3);
      const got = { h: [], g1: [], g2: [] };
      host.on('message', m => got.h.push(m)); g1.on('message', m => got.g1.push(m)); g2.on('message', m => got.g2.push(m));
      host.send('chat', { m: 'hi' });
      g1.send('whisper', { n: 1 }, host.selfId);
      await until(() => got.g1.length === 1 && got.g2.length === 1 && got.h.length === 1);
      await wait(150);
      return { g1: got.g1, g2Count: got.g2.length, h: got.h, hostId: host.selfId, g1Id: g1.selfId };
    """)
    assert r['g1'] == [{'type': 'chat', 'data': {'m': 'hi'}, 'from': r['hostId']}], r
    assert r['h'] == [{'type': 'whisper', 'data': {'n': 1}, 'from': r['g1Id']}] and r['g2Count'] == 1, r


@test
def test_stranger_cannot_spoof_roster_or_duplicate(pg):
    r = ev(pg, ROOM_JS + r"""
      const host = await Room.create({ transport: mt(), name: 'H', code: 'ZSPQR' });
      const guest = await Room.join({ transport: mt(), name: 'G', code: 'ZSPQR' });
      const rogue = mt(); await rogue.join('ZSPQR');
      await wait(150);
      rogue.send('roster', { hostId: rogue.selfId, players: [{ id: 'evil', name: 'evil' }] });
      rogue.send('hello', { v: 1, name: '\u0000<i>x</i>', host: false }, host.selfId);
      rogue.send('hello', { v: 1, name: '\u0000<i>x</i>', host: false }, host.selfId);
      await wait(300);
      return { guest: guest.players.map(p => p.name), host: host.players.map(p => p.name) };
    """)
    assert r['host'] == ['H', 'G', '<i>x</i>'], r
    assert 'evil' not in r['guest'] and r['guest'] == ['H', 'G', '<i>x</i>'], r


@test
def test_stats_and_ping(pg):
    r = ev(pg, r"""
      const { createMemoryTransport: mt } = await import('/platform/net/transport-memory.js');
      const { createStats, instrument } = await import('/platform/net/stats.js');
      const sa = createStats(), sb = createStats();
      const a = instrument(mt(), sa, { pingTimeoutMs: 300 }), b = instrument(mt(), sb);
      let peer = null; a.onPeerJoin(id => { peer = id; });
      await a.join('PINGS'); await b.join('PINGS');
      await until(() => peer);
      const got = []; b.on('x', d => got.push(d));
      a.send('x', { hello: 'world' }, peer);
      await until(() => got.length === 1);
      const ms = await a.ping(peer);
      const lost = await a.ping('nobody');
      const snap = sa.snapshot();
      return { ms, lost, outMsgs: snap.msgsOut, inMsgs: sb.snapshot().msgsIn, out: snap.kbpsOut > 0, pingKept: typeof snap.pings[peer] };
    """)
    assert r['ms'] is not None and 0 <= r['ms'] < 500 and r['lost'] is None, r
    assert r['outMsgs'] == 1 and r['inMsgs'] == 1 and r['out'] and r['pingKept'] == 'number', r


@test
def test_fixed_loop_steps(pg):
    r = ev(pg, r"""
      const { createFixedLoop } = await import('/platform/net/host-loop.js');
      const calls = [];
      const loop = createFixedLoop({ hz: 20, step: (dt, i) => calls.push([dt, i]) });
      const a = loop.advance(10), b = loop.advance(40), c = loop.advance(100);
      let d = 0; for (let i = 0; i < 20; i++) d += loop.advance(16.667);
      return { a, b, c, d, tick: loop.tick, first: calls[0], third: calls[2] };
    """)
    assert (r['a'], r['b'], r['c']) == (0, 1, 2), r
    assert r['d'] == 6 and r['tick'] == 9, r
    assert r['first'] == [0.05, 0] and r['third'] == [0.05, 2], r


@test
def test_fixed_loop_does_not_spiral_after_long_pause(pg):
    r = ev(pg, r"""
      const { createFixedLoop } = await import('/platform/net/host-loop.js');
      let n = 0;
      const loop = createFixedLoop({ hz: 20, step: () => { n++; }, maxCatchUp: 10 });
      const burst = loop.advance(10 * 60 * 1000);
      const after = loop.advance(0);
      const next = loop.advance(50);
      return { burst, after, next, n };
    """)
    assert r == {'burst': 10, 'after': 0, 'next': 1, 'n': 11}, r


@test
def test_start_host_loop_runs_and_stops(pg):
    r = ev(pg, r"""
      const { createFixedLoop, startHostLoop } = await import('/platform/net/host-loop.js');
      let n = 0;
      const loop = createFixedLoop({ hz: 20, step: () => { n++; } });
      const stop = startHostLoop(loop, { intervalMs: 20 });
      await wait(600); stop();
      const atStop = n; await wait(200);
      return { ran: atStop >= 5 && atStop <= 15, stopped: n === atStop };
    """)
    assert r == {'ran': True, 'stopped': True}, r


@test
def test_trystero_adapter_with_fake_lib(pg):
    r = ev(pg, r"""
      const { createTrysteroTransport, APP_ID } = await import('/platform/net/transport-trystero.js');
      const { ICE_SERVERS } = await import('/platform/net/ice.js');
      const sent = [], actions = {}; const lib = { selfId: 'me' };
      // Giả API của @trystero-p2p/torrent 0.26: makeAction trả object { send(data, {target}), onMessage = (data, {peerId}) },
      // onPeerJoin/onPeerLeave là thuộc tính gán được.
      lib.joinRoom = (cfg, code) => {
        lib.cfg = cfg; lib.code = code;
        const room = {
          makeAction(label) {
            const action = { send: (d, opts) => sent.push([label, d, opts && opts.target]), onMessage: null };
            actions[label] = (d) => action.onMessage && action.onMessage(d, { peerId: 'peerX' });
            return action;
          },
          onPeerJoin: null, onPeerLeave: null, leave() { lib.left = (lib.left || 0) + 1; },
        };
        lib.pj = (id) => room.onPeerJoin(id); lib.pl = (id) => room.onPeerLeave(id);
        return room;
      };
      const t = await createTrysteroTransport({ lib });
      const events = []; const heard = [];
      t.onPeerJoin(id => events.push('join:' + id)); t.onPeerLeave(id => events.push('leave:' + id));
      t.on('hello', (d, from) => heard.push([d, from]));
      await t.join('ABCDE');
      actions.hello({ v: 1 }); lib.pj('p1'); lib.pl('p1');
      t.send('app', { x: 1 }, 'p9');
      let unknown = null; try { t.on('nope', () => {}); } catch (e) { unknown = e.message; }
      let unknownSend = null; try { t.send('nope', {}); } catch (e) { unknownSend = e.message; }
      t.leave(); t.leave();
      return { selfId: t.selfId, code: lib.code, appId: lib.cfg.appId === APP_ID, ice: lib.cfg.rtcConfig.iceServers === ICE_SERVERS,
               heard, events, sent, unknown: !!unknown, unknownSend: !!unknownSend, left: lib.left,
               stun: ICE_SERVERS.some(s => String(s.urls).startsWith('stun:')) };
    """)
    assert r['selfId'] == 'me' and r['code'] == 'ABCDE' and r['appId'] and r['ice'] and r['stun'], r
    assert r['heard'] == [[{'v': 1}, 'peerX']] and r['events'] == ['join:p1', 'leave:p1'], r
    assert r['sent'] == [['app', {'x': 1}, 'p9']] and r['unknown'] and r['unknownSend'] and r['left'] == 1, r


@test
def test_join_reports_no_connect_when_peer_seen_but_no_host(pg):
    r = ev(pg, ROOM_JS + r"""
      const silent = mt(); await silent.join('NHKST');          // có người trên kênh nhưng không phải host
      const out = {};
      try { await Room.join({ transport: mt(), name: 'A', code: 'NHKST', timeoutMs: 400 }); } catch (e) { out.reason = e.message; }
      return out;
    """)
    assert r == {'reason': 'no-connect'}, r


@test
def test_join_default_timeout_is_generous_for_slow_networks(pg):
    src = pg.evaluate("fetch('/platform/net/room.js').then(r => r.text())")
    import re
    m = re.search(r'timeoutMs = (\d+)', src)
    assert m and int(m.group(1)) >= 15000, m and m.group(0)


@test
def test_late_second_host_cannot_tear_down_running_room(pg):
    r = ev(pg, ROOM_JS + r"""
      const h1 = await Room.create({ transport: mt(), name: 'H1', code: 'SAMEA', settleMs: 100 });
      const guest = await Room.join({ transport: mt(), name: 'G', code: 'SAMEA' });
      await wait(200);
      const closed = [];
      h1.on('closed', x => closed.push('h1:' + x)); guest.on('closed', x => closed.push('g:' + x));
      const h2 = await Room.create({ transport: mt(), name: 'H2', code: 'SAMEA' });
      let h2reason = null; h2.on('rejected', x => { h2reason = x; });
      await until(() => h2reason);
      // một host giả mạo khác phiên bản gửi hello cho khách đã có host
      const rogue = mt(); await rogue.join('SAMEA'); await wait(150);
      rogue.send('hello', { v: 99, name: 'R', host: true }, guest.selfId);
      await wait(200);
      return { h2reason, closed, h1Players: h1.players.map(p => p.name), guestClosed: guest.closed, h1Closed: h1.closed };
    """)
    assert r['h2reason'] == 'code-taken' and r['closed'] == [] and not r['guestClosed'] and not r['h1Closed'], r
    assert r['h1Players'] == ['H1', 'G'], r


GAME = 'games/the-gioi-khoi/'


@test
def test_page_loads_without_touching_network_libs(pg, browser, base):
    urls = []
    pg.on('request', lambda r: urls.append(r.url))
    pg.goto(root(base) + GAME); pg.wait_for_timeout(500)
    assert pg.locator('canvas').count() >= 1 and pg.locator('a.hub-home').count() == 1
    assert pg.is_visible('#lobby') and not pg.is_visible('#inroom')
    assert not [u for u in urls if 'vendor/trystero' in u], 'thư viện mạng chỉ được tải khi bấm tạo/vào phòng'


@test
def test_two_pages_play_together(pg, browser, base):
    url = root(base) + GAME + '?net=memory&debug'
    pg.goto(url); pg.wait_for_timeout(300)
    b = pg.context.new_page(); errs = []
    b.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    b.on('pageerror', lambda e: errs.append(str(e)))
    b.on('requestfailed', lambda r: errs.append('không tải được ' + r.url) if r.url.startswith(root(base)) else None)
    b.goto(url); b.wait_for_timeout(300)

    pg.fill('#name', '<img src=x>')
    pg.click('#btn-create'); pg.wait_for_selector('#inroom:not([hidden])')
    code = pg.inner_text('#room-code')
    assert len(code) == 5, code

    b.fill('#name', 'Bạn'); b.fill('#code', code.lower()); b.click('#btn-join')
    b.wait_for_selector('#inroom:not([hidden])')
    pg.wait_for_function("document.querySelectorAll('#players li').length === 2")
    texts = pg.locator('#players li').all_inner_texts()
    assert any('<img src=x>' in t for t in texts), texts
    assert pg.locator('#players img').count() == 0 and b.locator('#players img').count() == 0, 'tên không được thành HTML'

    b.keyboard.down('d'); b.wait_for_timeout(500); b.keyboard.up('d')
    pg.wait_for_function("others.size === 1")
    assert pg.evaluate("[...others.values()][0].x") > pg.evaluate("me.x") + 20, 'chấm của bạn kia phải sang phải'

    b.click('#btn-leave')
    b.wait_for_selector('#lobby:not([hidden])')
    pg.wait_for_function("document.querySelectorAll('#players li').length === 1")
    assert pg.evaluate("others.size") == 0
    assert not errs, errs


@test
def test_join_wrong_code_shows_message_and_stays_in_lobby(pg, browser, base):
    pg.goto(root(base) + GAME + '?net=memory'); pg.wait_for_timeout(300)
    pg.fill('#code', 'AB0DE'); pg.click('#btn-join')
    pg.wait_for_function("document.getElementById('err').textContent.length > 0")
    assert pg.is_visible('#lobby') and not pg.is_visible('#inroom')


if __name__ == '__main__':
    run(TESTS)
