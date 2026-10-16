# Thế Giới Khối — M1: Lớp mạng và trang thử phòng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây `platform/net/` (mã phòng, phòng tối đa 5 người, truyền tin, đo ping/băng thông, vòng lặp tick cố định) và một trang thử phòng `games/the-gioi-khoi/` để đo độ ổn định kết nối P2P thật trước khi làm tiếp game.

**Architecture:** `Room` (logic phòng, host/client, roster) chạy trên một giao diện `transport` thay thế được. Có hai transport: `memory` (BroadcastChannel, dùng cho test và `?net=memory`) và `trystero` (WebRTC thật, tải lười từ `platform/vendor/`). Host là người tạo phòng; client chỉ tin roster do host gửi.

**Tech Stack:** HTML + ES modules, không build. Trystero (WebRTC, bản chép vào `platform/vendor/`). Test: Python Playwright qua `tests/harness.py`.

**Spec:** `docs/superpowers/specs/2026-10-16-the-gioi-khoi-design.md` (mục "Mạng", mốc M1).

## Global Constraints

- Không có bước build, không Node: chỉ HTML/CSS/ES modules; chạy bằng `python3 -m http.server`.
- Mã mạng dùng chung nằm trong `platform/net/`; mã game nằm trong `games/the-gioi-khoi/`. Game chỉ import từ `platform/` và từ thư mục của chính nó.
- `PROTOCOL_VERSION = 1`, `MAX_PLAYERS = 5`.
- Mã phòng 5–6 ký tự từ bảng `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (bỏ I, O, 0, 1).
- Tên kênh trên dây tối đa 12 byte và phải khai báo trước (`WIRE_TYPES`): `hello`, `reject`, `roster`, `app`, `ping`, `pong`.
- Tên người chơi: bỏ ký tự điều khiển, tối đa 16 ký tự (theo code point), mặc định `Khách`; hiển thị chỉ bằng `textContent`, không bao giờ `innerHTML`.
- Chữ giao diện bằng tiếng Việt.
- `meta.js` giữ nhẹ (không import code chạy game). `STORE_KEY = 'the-gioi-khoi-v1'`.
- **Chưa đăng ký game vào `platform/games.js`** (việc của M7); trang chỉ mở được bằng địa chỉ trực tiếp.
- Mọi transport là object dùng closure (không dùng `this`), để `instrument()` sao chép bằng spread được.
- Commit trên nhánh `the-gioi-khoi`, không commit lên `main`. Mỗi commit kết thúc bằng dòng `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Nếu git báo "dubious ownership", chạy lại lệnh với `git -c safe.directory='*' ...`.

## Review Focus

Các tình huống spec ngụ ý nhưng không task nào kiểm thử rõ nhất, xếp theo khả năng gặp. Mỗi dòng đã có test ở task nêu trong ngoặc.

1. Tên người chơi chứa HTML (`<img src=x>`) phải hiện nguyên văn, không tạo phần tử (Task 5).
2. Người thứ 6 vào phòng đầy phải nhận lời từ chối `full` rõ ràng và danh sách 5 người không đổi (Task 2).
3. Gõ nhầm/vào mã không tồn tại phải báo `not-found` đúng hạn, không treo mãi (Task 2).
4. Chủ phòng thoát thì mọi người nhận `host-left`, không kẹt ở màn hình phòng (Task 2).
5. Tab host bị trình duyệt làm chậm rồi chạy bù một lúc rất lâu không được chạy hàng nghìn tick liền (Task 3).
6. Người lạ trong cùng kênh gửi `roster` giả hoặc `hello` lặp lại không được làm đổi danh sách hay đăng ký trùng (Task 2).

---

## File Structure

```
platform/net/
  protocol.js           hằng số, mã phòng, làm sạch tên
  transport-memory.js   transport BroadcastChannel (test, ?net=memory)
  transport-trystero.js transport WebRTC thật (bọc Trystero)
  ice.js                danh sách STUN/TURN
  room.js               Room: tạo/vào phòng, host, roster, gửi tin
  stats.js              đếm byte, đo ping, bọc transport
  host-loop.js          vòng lặp tick cố định
platform/vendor/
  trystero.min.js       bản chép của Trystero
  VENDOR.md             phiên bản, nguồn, sha256
games/the-gioi-khoi/
  index.html  style.css  meta.js  main.js
tests/
  test_net.py
docs/superpowers/specs/2026-10-16-the-gioi-khoi-design.md   (ghi kết quả M1 ở Task 6)
```

Giao diện `transport` (mọi transport phải đúng như vậy):

```
transport.selfId : string
transport.join(code) : Promise<void>          vào kênh theo mã phòng
transport.send(type, data, to?) : void        to bỏ trống = gửi cho mọi peer; data phải là JSON
transport.on(type, fn(data, fromId))          đăng ký xử lý theo kênh
transport.onPeerJoin(fn(id)) / onPeerLeave(fn(id))
transport.leave() : void                      rời kênh, gọi nhiều lần vẫn an toàn
```

---

### Task 1: Nhánh làm việc, `protocol.js`, bộ khung test

**Files:**
- Create: `platform/net/protocol.js`
- Create: `tests/test_net.py`
- Commit kèm: `docs/superpowers/specs/2026-10-16-the-gioi-khoi-design.md` (đang chưa được theo dõi)

**Interfaces:**
- Produces: `PROTOCOL_VERSION`, `MAX_PLAYERS`, `WIRE_TYPES`, `makeRoomCode(len=5, rnd=Math.random)`, `normalizeCode(s)`, `isValidCode(s)`, `cleanName(s)` — tất cả export từ `platform/net/protocol.js`.
- Produces (test): `ev(pg, body)` trong `tests/test_net.py`: chạy thân hàm async trong trang, có sẵn `wait(ms)` và `until(fn, ms=2000)`.

- [ ] **Step 1: Tạo nhánh và đưa spec vào lịch sử**

```bash
cd /data/yuu/ai-data/yuu/self/game-hub
git switch -c the-gioi-khoi
git add docs/superpowers/specs/2026-10-16-the-gioi-khoi-design.md docs/superpowers/plans/2026-10-16-the-gioi-khoi-m1-net.md
git commit -m "docs(the-gioi-khoi): spec và plan M1" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Viết test thất bại**

Tạo `tests/test_net.py`:

```python
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


if __name__ == '__main__':
    run(TESTS)
```

- [ ] **Step 3: Chạy để thấy thất bại**

Run: `python3 tests/test_net.py`
Expected: cả 3 bài FAIL/ERROR (không tải được `/platform/net/protocol.js`, 404).

- [ ] **Step 4: Viết `platform/net/protocol.js`**

```js
// Giao thức mạng dùng chung cho các game nhiều người chơi trên nền tảng.
export const PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 5;

// Tên kênh trên dây. Mỗi tên tối đa 12 byte (giới hạn của Trystero) và phải khai báo trước ở cả hai đầu.
export const WIRE_TYPES = ['hello', 'reject', 'roster', 'app', 'ping', 'pong'];

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bỏ I, O, 0, 1 vì dễ nhầm

export function makeRoomCode(len = 5, rnd = Math.random) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rnd() * ALPHABET.length)];
  return s;
}

export function normalizeCode(s) { return String(s ?? '').replace(/\s+/g, '').toUpperCase(); }

export function isValidCode(s) {
  return typeof s === 'string' && s.length >= 5 && s.length <= 6 && [...s].every(c => ALPHABET.includes(c));
}

// Tên hiển thị: bỏ ký tự điều khiển, tối đa 16 ký tự (đếm theo code point để không cắt đôi emoji).
export function cleanName(s) {
  if (typeof s !== 'string') return 'Khách';
  const t = [...s.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, 16).join('').trim();
  return t || 'Khách';
}
```

- [ ] **Step 5: Chạy để thấy đạt**

Run: `python3 tests/test_net.py`
Expected: 3 bài PASS, `0 hỏng`.

- [ ] **Step 6: Commit**

```bash
git add platform/net/protocol.js tests/test_net.py
git commit -m "feat(net): protocol.js — mã phòng, làm sạch tên, hằng số giao thức" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Transport bộ nhớ và `Room`

**Files:**
- Create: `platform/net/transport-memory.js`
- Create: `platform/net/room.js`
- Modify: `tests/test_net.py` (thêm bài trước dòng `if __name__ == '__main__':`)

**Interfaces:**
- Consumes: `protocol.js` (Task 1).
- Produces: `createMemoryTransport(): transport` (giao diện ở phần File Structure).
- Produces: `class Room` với
  - `static async create({ transport, name, code? }) : Room` — host; `code` mặc định `makeRoomCode()`, sai định dạng thì ném `Error('bad-code')`.
  - `static async join({ transport, name, code, timeoutMs = 8000, version? }) : Room` — ném `Error` với `message` là một trong `bad-code`, `not-found`, `full`, `version`, `code-taken`.
  - Thuộc tính: `code`, `name`, `isHost`, `selfId`, `hostId`, `players: {id,name}[]`, `closed`.
  - `on(event, fn) → hàm huỷ`; sự kiện: `roster(players)`, `message({type,data,from})`, `rejected(reason)`, `closed(reason)` với reason là `left`, `host-left`, `timeout` hoặc lý do bị từ chối.
  - `send(type, data, to?)`, `leave(reason='left')`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `tests/test_net.py` (trước khối `if __name__`):

```python
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
```

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `python3 tests/test_net.py room join leav messages stranger sixth`
Expected: các bài mới FAIL/ERROR (không tải được `room.js`).

- [ ] **Step 3: Viết `platform/net/transport-memory.js`**

```js
// Transport trong bộ nhớ cho test và ?net=memory: các tab cùng nguồn gốc nói chuyện qua BroadcastChannel.
// Dữ liệu đi qua JSON để bắt sớm lỗi gửi thứ không tuần tự hoá được, giống như mạng thật.
export function createMemoryTransport() {
  const selfId = 'm' + Math.random().toString(36).slice(2, 10);
  const handlers = new Map(), joinFns = [], leaveFns = [], peers = new Set();
  let ch = null;

  const post = (m) => { if (ch) ch.postMessage({ ...m, from: selfId }); };
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

  function onMessage(ev) {
    const m = ev.data;
    if (!m || m.from === selfId || (m.to && m.to !== selfId)) return;
    if (m.kind === 'here') {
      if (peers.has(m.from)) return;
      peers.add(m.from);
      post({ kind: 'here', to: m.from });          // trả lời trước, để bên kia biết ta rồi mới nhận tin
      joinFns.forEach(f => f(m.from));
    } else if (m.kind === 'bye') {
      if (peers.delete(m.from)) leaveFns.forEach(f => f(m.from));
    } else if (m.kind === 'data' && peers.has(m.from)) {
      (handlers.get(m.type) || []).forEach(f => f(clone(m.data), m.from));
    }
  }

  function leave() {
    if (!ch) return;
    post({ kind: 'bye' });
    ch.close(); ch = null; peers.clear();
    removeEventListener('pagehide', leave);
  }

  return {
    selfId,
    async join(code) {
      ch = new BroadcastChannel('gh-net-' + code);
      ch.onmessage = onMessage;
      addEventListener('pagehide', leave);
      post({ kind: 'here' });
    },
    send(type, data, to) { post({ kind: 'data', type, data: clone(data), to }); },
    on(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
    onPeerJoin(fn) { joinFns.push(fn); },
    onPeerLeave(fn) { leaveFns.push(fn); },
    leave,
  };
}
```

- [ ] **Step 4: Viết `platform/net/room.js`**

```js
// Phòng nhiều người chơi: người tạo phòng là host, giữ danh sách người chơi (roster) và phát cho mọi người.
// Room chỉ nói chuyện qua giao diện transport (xem platform/net/transport-*.js), nên đổi mạng không đổi logic.
import { PROTOCOL_VERSION, MAX_PLAYERS, makeRoomCode, normalizeCode, isValidCode, cleanName } from './protocol.js';

function emitter() {
  const map = new Map();
  return {
    on(ev, fn) {
      if (!map.has(ev)) map.set(ev, new Set());
      map.get(ev).add(fn);
      return () => map.get(ev).delete(fn);
    },
    emit(ev, ...args) { for (const fn of [...(map.get(ev) || [])]) fn(...args); },
  };
}

function validRoster(list) {
  return Array.isArray(list) && list.length >= 1 && list.length <= MAX_PLAYERS &&
    list.every(p => p && typeof p.id === 'string' && typeof p.name === 'string');
}

export class Room {
  constructor(transport, { code, name, isHost, version = PROTOCOL_VERSION }) {
    this.t = transport; this.code = code; this.name = cleanName(name);
    this.isHost = isHost; this.version = version;
    this.selfId = transport.selfId; this.hostId = isHost ? transport.selfId : null;
    this.players = isHost ? [{ id: this.selfId, name: this.name }] : [];
    this.closed = false; this._ev = emitter();
    this._wire();
  }

  // Tạo phòng mới và làm host. Ném Error('bad-code') nếu mã tự chọn sai định dạng.
  static async create({ transport, name, code = makeRoomCode() }) {
    if (!isValidCode(code)) throw new Error('bad-code');
    const room = new Room(transport, { code, name, isHost: true });
    await transport.join(code);
    return room;
  }

  // Vào phòng có sẵn. Ném Error(message) với message: bad-code | not-found | full | version | code-taken.
  static async join({ transport, name, code, timeoutMs = 8000, version }) {
    code = normalizeCode(code);
    if (!isValidCode(code)) throw new Error('bad-code');
    const room = new Room(transport, { code, name, isHost: false, version });
    await transport.join(code);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { room.leave('timeout'); reject(new Error('not-found')); }, timeoutMs);
      room.on('roster', list => { if (list.some(p => p.id === room.selfId)) { clearTimeout(timer); resolve(room); } });
      room.on('rejected', reason => { clearTimeout(timer); reject(new Error(reason)); });
    });
  }

  on(ev, fn) { return this._ev.on(ev, fn); }

  send(type, data, to) { if (!this.closed) this.t.send('app', { t: type, d: data }, to); }

  leave(reason = 'left') {
    if (this.closed) return;
    this.closed = true;
    this.t.leave();
    this._ev.emit('closed', reason);
  }

  _wire() {
    const t = this.t;
    t.onPeerJoin(id => t.send('hello', { v: this.version, name: this.name, host: this.isHost }, id));
    t.onPeerLeave(id => this._peerLeft(id));
    t.on('hello', (d, from) => this._hello(d || {}, from));
    t.on('reject', (d, from) => {
      if (!this.isHost && (this.hostId === null || from === this.hostId)) this._reject(d && d.reason);
    });
    t.on('roster', (d, from) => this._roster(d || {}, from));
    t.on('app', (d, from) => {
      if (d && typeof d.t === 'string') this._ev.emit('message', { type: d.t, data: d.d, from });
    });
  }

  _reject(reason) { this._ev.emit('rejected', reason); this.leave(reason); }

  _hello(d, from) {
    if (this.closed) return;
    if (d.host) {                                   // tin chào từ một host
      if (this.isHost) return this._reject('code-taken');
      if (d.v !== this.version) return this._reject('version');
      if (!this.hostId) this.hostId = from;
      return;
    }
    if (!this.isHost) return;                       // client chào client: bỏ qua
    if (d.v !== this.version) return this.t.send('reject', { reason: 'version' }, from);
    const known = this.players.find(p => p.id === from);
    if (!known && this.players.length >= MAX_PLAYERS) return this.t.send('reject', { reason: 'full' }, from);
    if (known) known.name = cleanName(d.name);
    else this.players.push({ id: from, name: cleanName(d.name) });
    this._broadcastRoster();
  }

  // Client chỉ tin roster do chính host gửi và tự nhận mình là host (d.hostId === from).
  _roster(d, from) {
    if (this.isHost || this.closed) return;
    if (d.hostId !== from) return;
    if (this.hostId && this.hostId !== from) return;
    if (!validRoster(d.players)) return;
    this.hostId = from;
    this.players = d.players.map(p => ({ id: p.id, name: cleanName(p.name) }));
    this._ev.emit('roster', this.players);
  }

  _broadcastRoster() {
    this.t.send('roster', { hostId: this.selfId, players: this.players });
    this._ev.emit('roster', this.players);
  }

  _peerLeft(id) {
    if (this.closed) return;
    if (this.isHost) {
      const i = this.players.findIndex(p => p.id === id);
      if (i >= 0) { this.players.splice(i, 1); this._broadcastRoster(); }
    } else if (id === this.hostId) {
      this.leave('host-left');
    }
  }
}
```

- [ ] **Step 5: Chạy để thấy đạt**

Run: `python3 tests/test_net.py`
Expected: toàn bộ PASS (3 bài Task 1 + 7 bài mới), `0 hỏng`. Nếu một bài chập chờn, tăng `until` timeout trong bài đó, không giảm các số chờ của `Room`.

- [ ] **Step 6: Commit**

```bash
git add platform/net/transport-memory.js platform/net/room.js tests/test_net.py
git commit -m "feat(net): Room (host/roster/từ chối đầy/phiên bản) và transport bộ nhớ" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Thống kê/ping và vòng lặp tick cố định

**Files:**
- Create: `platform/net/stats.js`
- Create: `platform/net/host-loop.js`
- Modify: `tests/test_net.py`

**Interfaces:**
- Consumes: transport (Task 2).
- Produces: `createStats(now?) → { countIn(n), countOut(n), setPing(id, ms), dropPeer(id), snapshot() → { seconds, kbpsIn, kbpsOut, msgsIn, msgsOut, pings }, reset() }`.
- Produces: `instrument(transport, stats, { now?, pingTimeoutMs = 3000 }?) → transport` có thêm `ping(id): Promise<number|null>`. Tin `ping`/`pong` không tính vào thống kê.
- Produces: `createFixedLoop({ hz = 20, step(dtSeconds, tickIndex), maxCatchUp = 10 }) → { tick, advance(ms) → số bước đã chạy }`.
- Produces: `startHostLoop(loop, { intervalMs = 50, now? }?) → hàm dừng`.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `tests/test_net.py`:

```python
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
```

Kiểm tra số học `test_fixed_loop_steps`: 10 ms → 0 bước; cộng 40 ms (tích luỹ 50) → 1; cộng 100 ms → 2 (tổng 3 bước); rồi 20 lần 16,667 ms ≈ 333,3 ms → thêm 6 bước; tổng `tick = 9`.

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `python3 tests/test_net.py stats loop`
Expected: FAIL/ERROR (không tải được `stats.js`, `host-loop.js`).

- [ ] **Step 3: Viết `platform/net/stats.js`**

```js
// Đếm byte và tin, đo ping. instrument() bọc một transport mà không đổi cách Room dùng nó.
const size = (x) => { try { return JSON.stringify(x === undefined ? null : x).length; } catch (e) { return 0; } };

export function createStats(now = () => performance.now()) {
  let t0 = now(), bytesIn = 0, bytesOut = 0, msgsIn = 0, msgsOut = 0;
  const pings = new Map();
  return {
    countIn(n) { bytesIn += n; msgsIn++; },
    countOut(n) { bytesOut += n; msgsOut++; },
    setPing(id, ms) { pings.set(id, ms); },
    dropPeer(id) { pings.delete(id); },
    snapshot() {
      const sec = Math.max(0.001, (now() - t0) / 1000);
      return { seconds: sec, kbpsIn: bytesIn / 1024 / sec, kbpsOut: bytesOut / 1024 / sec, msgsIn, msgsOut, pings: Object.fromEntries(pings) };
    },
    reset() { t0 = now(); bytesIn = bytesOut = msgsIn = msgsOut = 0; },
  };
}

// Trả transport mới: đếm tin đi/đến, tự trả lời ping và có thêm ping(id) → ms (hoặc null nếu quá hạn).
export function instrument(transport, stats, { now = () => performance.now(), pingTimeoutMs = 3000 } = {}) {
  let seq = 0;
  const pending = new Map();

  transport.on('ping', (d, from) => transport.send('pong', d, from));
  transport.on('pong', (d, from) => {
    const p = d && pending.get(d.n);
    if (!p || p.id !== from) return;
    pending.delete(d.n); clearTimeout(p.timer);
    const ms = now() - p.t0;
    stats.setPing(from, ms); p.resolve(ms);
  });

  return {
    ...transport,
    send(type, data, to) { stats.countOut(size(data)); transport.send(type, data, to); },
    on(type, fn) { transport.on(type, (d, from) => { stats.countIn(size(d)); fn(d, from); }); },
    onPeerLeave(fn) { transport.onPeerLeave(id => { stats.dropPeer(id); fn(id); }); },
    ping(id) {
      return new Promise(resolve => {
        const n = ++seq, t0 = now();
        const timer = setTimeout(() => { pending.delete(n); resolve(null); }, pingTimeoutMs);
        pending.set(n, { id, t0, resolve, timer });
        transport.send('ping', { n }, id);
      });
    },
  };
}
```

- [ ] **Step 4: Viết `platform/net/host-loop.js`**

```js
// Vòng lặp tick cố định cho host. Dùng bộ tích luỹ thời gian, nên chạy đúng tốc độ dù khung hình thất thường.
// Nếu tab bị trình duyệt làm chậm rồi chạy bù (khoảng nghỉ rất dài), chỉ chạy tối đa maxCatchUp tick và bỏ phần dư,
// để không bị "xoắn ốc" chạy hàng nghìn tick liền.
export function createFixedLoop({ hz = 20, step, maxCatchUp = 10 }) {
  const dt = 1000 / hz;
  let acc = 0, tick = 0;
  return {
    get tick() { return tick; },
    advance(ms) {
      acc += ms;
      let n = 0;
      while (acc >= dt && n < maxCatchUp) { step(dt / 1000, tick++); acc -= dt; n++; }
      if (acc >= dt) acc = 0;
      return n;
    },
  };
}

// Chạy loop bằng setInterval (vẫn chạy khi tab ẩn, dù bị làm chậm khoảng 1 giây một lần). Trả hàm dừng.
export function startHostLoop(loop, { intervalMs = 50, now = () => performance.now() } = {}) {
  let last = now();
  const id = setInterval(() => { const t = now(); loop.advance(t - last); last = t; }, intervalMs);
  return () => clearInterval(id);
}
```

- [ ] **Step 5: Chạy để thấy đạt**

Run: `python3 tests/test_net.py`
Expected: toàn bộ PASS, `0 hỏng`.

- [ ] **Step 6: Commit**

```bash
git add platform/net/stats.js platform/net/host-loop.js tests/test_net.py
git commit -m "feat(net): thống kê/ping và vòng lặp tick cố định chống xoắn ốc" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Transport Trystero, `ice.js`, bản chép thư viện

**Files:**
- Create: `platform/net/ice.js`
- Create: `platform/net/transport-trystero.js`
- Create: `platform/vendor/trystero.min.js`, `platform/vendor/VENDOR.md`
- Modify: `tests/test_net.py`

**Interfaces:**
- Consumes: `WIRE_TYPES` (Task 1).
- Produces: `ICE_SERVERS` (mảng RTCIceServer) từ `ice.js`.
- Produces: `createTrysteroTransport({ lib? }?) : Promise<transport>` và `APP_ID` từ `transport-trystero.js`. `lib` chỉ để test (đối tượng giả có `selfId` và `joinRoom`).

- [ ] **Step 1: Viết test thất bại (dùng thư viện giả, không cần mạng)**

Thêm vào `tests/test_net.py`:

```python
@test
def test_trystero_adapter_with_fake_lib(pg):
    r = ev(pg, r"""
      const { createTrysteroTransport, APP_ID } = await import('/platform/net/transport-trystero.js');
      const { ICE_SERVERS } = await import('/platform/net/ice.js');
      const sent = [], actions = {}; const lib = { selfId: 'me' };
      lib.joinRoom = (cfg, code) => {
        lib.cfg = cfg; lib.code = code;
        return {
          makeAction(label) {
            let recv; actions[label] = (d) => recv && recv(d, 'peerX');
            return [(d, to) => sent.push([label, d, to]), fn => { recv = fn; }];
          },
          onPeerJoin(fn) { lib.pj = fn; }, onPeerLeave(fn) { lib.pl = fn; }, leave() { lib.left = (lib.left || 0) + 1; },
        };
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
```

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `python3 tests/test_net.py trystero`
Expected: FAIL/ERROR (không tải được `transport-trystero.js`).

- [ ] **Step 3: Viết `platform/net/ice.js`**

```js
// Máy chủ STUN/TURN cho WebRTC. STUN giúp hai máy tìm đường tới nhau; TURN chuyển tiếp khi mạng chặn kết nối thẳng.
// Chỉ có STUN công cộng. Thêm TURN ở đây nếu phép đo ở Task 6 cho thấy có cặp người chơi không nối được.
// Lưu ý: repo này công khai, nên mọi tên đăng nhập/mật khẩu TURN để ở đây đều ai cũng đọc được; chỉ dùng loại
// miễn phí có hạn mức, đừng dùng tài khoản có trả tiền.
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
```

- [ ] **Step 4: Viết `platform/net/transport-trystero.js`**

```js
// Transport WebRTC thật, bọc thư viện Trystero (bản chép ở platform/vendor/). Thư viện chỉ được tải khi bấm tạo/vào phòng.
// Mỗi kênh trong WIRE_TYPES được khai báo sẵn khi vào phòng, vì Trystero bỏ tin của kênh mà đầu kia chưa khai báo.
import { WIRE_TYPES } from './protocol.js';
import { ICE_SERVERS } from './ice.js';

export const APP_ID = 'game-hub-the-gioi-khoi-v1';
const VENDOR_URL = new URL('../vendor/trystero.min.js', import.meta.url).href;

export async function createTrysteroTransport({ lib } = {}) {
  const T = lib || await import(VENDOR_URL);
  const handlers = new Map(), joinFns = [], leaveFns = [], sendFns = {};
  let room = null;

  const known = (type) => {
    if (!WIRE_TYPES.includes(type)) throw new Error('kênh chưa khai báo: ' + type);
  };

  return {
    selfId: T.selfId,
    async join(code) {
      room = T.joinRoom({ appId: APP_ID, rtcConfig: { iceServers: ICE_SERVERS } }, code);
      for (const type of WIRE_TYPES) {
        const [send, get] = room.makeAction(type);
        sendFns[type] = send;
        get((data, peerId) => (handlers.get(type) || []).forEach(f => f(data, peerId)));
      }
      room.onPeerJoin(id => joinFns.forEach(f => f(id)));
      room.onPeerLeave(id => leaveFns.forEach(f => f(id)));
    },
    send(type, data, to) { known(type); return sendFns[type](data, to); },
    on(type, fn) { known(type); if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
    onPeerJoin(fn) { joinFns.push(fn); },
    onPeerLeave(fn) { leaveFns.push(fn); },
    leave() { if (room) { const r = room; room = null; r.leave(); } },
  };
}
```

- [ ] **Step 5: Chép thư viện Trystero vào `platform/vendor/`**

Thư viện không thể kiểm thử bằng test tự động ở bước này (cần mạng), nên chốt phiên bản và dấu vết nguồn bằng lệnh:

```bash
cd /data/yuu/ai-data/yuu/self/game-hub
mkdir -p platform/vendor /tmp/trystero-pack && cd /tmp/trystero-pack
VER=$(curl -s https://registry.npmjs.org/trystero/latest | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
echo "version: $VER"
curl -sL "$(curl -s https://registry.npmjs.org/trystero/$VER | python3 -c "import sys,json; print(json.load(sys.stdin)['dist']['tarball'])")" -o trystero.tgz
tar tzf trystero.tgz | grep -i 'dist/'
```

Expected: danh sách file trong `package/dist/`. Chọn file ES module của chiến lược **torrent** (không cần khoá/API), thường tên `trystero-torrent.min.js`. Kiểm tra nó xuất `joinRoom` và `selfId`:

```bash
tar xzf trystero.tgz package/dist/trystero-torrent.min.js
grep -o 'export *{[^}]*}' package/dist/trystero-torrent.min.js | head -3
```

Expected: dòng `export{...}` chứa `joinRoom` và `selfId`. Nếu tên file khác hoặc không có hai tên đó, đọc `package/README.md` trong tarball để tìm đúng file/tên export rồi chỉnh `transport-trystero.js` cho khớp (giữ nguyên giao diện transport). Rồi chép và ghi dấu vết:

```bash
cp package/dist/trystero-torrent.min.js /data/yuu/ai-data/yuu/self/game-hub/platform/vendor/trystero.min.js
cd /data/yuu/ai-data/yuu/self/game-hub
cat > platform/vendor/VENDOR.md <<EOF
# Thư viện bên ngoài đã chép vào repo

| File | Nguồn | Phiên bản | sha256 | License |
|---|---|---|---|---|
| trystero.min.js | npm: trystero, dist/trystero-torrent.min.js | $VER | $(sha256sum platform/vendor/trystero.min.js | cut -d' ' -f1) | MIT |

Cập nhật: chép bản mới, sửa dòng trên, chạy lại \`python3 tests/test_net.py\` và phép đo ở Task 6.
EOF
cat platform/vendor/VENDOR.md
```

Expected: file `VENDOR.md` có phiên bản và sha256 thật. Nếu máy không có mạng, dừng ở đây và nhờ chủ repo chép tay file vào `platform/vendor/trystero.min.js`, đừng tạo file giả.

- [ ] **Step 6: Chạy để thấy đạt**

Run: `python3 tests/test_net.py`
Expected: toàn bộ PASS, `0 hỏng`.

- [ ] **Step 7: Commit**

```bash
git add platform/net/ice.js platform/net/transport-trystero.js platform/vendor tests/test_net.py
git commit -m "feat(net): transport Trystero, danh sách ICE và bản chép thư viện" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Trang thử phòng `games/the-gioi-khoi/`

**Files:**
- Create: `games/the-gioi-khoi/index.html`, `style.css`, `meta.js`, `main.js`
- Modify: `tests/test_net.py`

**Interfaces:**
- Consumes: `Room`, `createMemoryTransport`, `createTrysteroTransport` (tải lười), `createStats`, `instrument`, `createFixedLoop`, `startHostLoop`, và từ nền tảng: `$`, `clamp` (`platform/core/util.js`), `startLoop` (`platform/core/loop.js`), `debugOn`, `exposeGlobals`, `mountHomeLink`.
- Produces: trang `games/the-gioi-khoi/` nhận `?net=memory` (transport bộ nhớ) và `?debug` (đưa `room`, `stats`, `others`, `me` ra `window`).

- [ ] **Step 1: Viết test thất bại**

Thêm vào `tests/test_net.py`:

```python
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
```

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `python3 tests/test_net.py page pages wrong`
Expected: FAIL/ERROR (trang chưa có, 404).

- [ ] **Step 3: Viết `games/the-gioi-khoi/index.html`**

```html
<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Thế Giới Khối · Game Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Itim&family=Pattaya&display=swap">
<link rel="stylesheet" href="../../platform/css/kit.css">
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="stage" id="stage">
  <canvas id="cv" width="960" height="540" aria-label="Sân thử mạng"></canvas>
</div>
<section id="panel">
  <div id="lobby">
    <label>Tên <input id="name" maxlength="16" autocomplete="off" placeholder="Khách"></label>
    <div class="row">
      <button id="btn-create">Tạo phòng</button>
      <span>hoặc</span>
      <input id="code" maxlength="6" autocomplete="off" placeholder="Mã phòng" aria-label="Mã phòng">
      <button id="btn-join">Vào phòng</button>
    </div>
    <p id="err" role="alert"></p>
  </div>
  <div id="inroom" hidden>
    <p>Mã phòng: <b id="room-code"></b> <span id="role"></span></p>
    <ul id="players"></ul>
    <p id="stats"></p>
    <button id="btn-leave">Rời phòng</button>
  </div>
</section>
<p class="keys">Bản thử mạng: dùng mũi tên hoặc WASD để di chuyển chấm của bạn; mọi người trong phòng thấy nhau.</p>
<script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Viết `games/the-gioi-khoi/style.css`**

```css
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
  padding:12px 16px;background:#12141a;color:#eeede8;font-family:'Itim','Segoe UI',system-ui,sans-serif}
.stage{position:relative;width:min(100%,calc((100dvh - 220px)*16/9));aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:#000}
canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#panel{width:min(100%,640px);background:#1b1d24;border-radius:8px;padding:12px 14px}
#panel .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
#panel input{font:inherit;padding:6px 8px;border-radius:6px;border:1px solid #444a5a;background:#12141a;color:inherit}
#code{width:8em;text-transform:uppercase}
#panel button{font:inherit;padding:6px 14px;border-radius:6px;border:0;background:#e9b949;color:#1b1d24;cursor:pointer}
#panel button:disabled{opacity:.5;cursor:default}
#players{margin:6px 0;padding-left:1.2em}
#err{color:#ff9d8a;min-height:1.2em;margin:6px 0 0}
#stats{color:#a3a8b8;font-size:14px}
.keys{margin:0;color:#a3a8b8;font-size:14px;text-align:center}
```

- [ ] **Step 5: Viết `games/the-gioi-khoi/meta.js`**

```js
// Thông tin Thế Giới Khối cho trang chủ. Chưa đăng ký vào platform/games.js (việc của mốc M7).
import { readJSON } from '../../platform/core/storage.js';

export const STORE_KEY = 'the-gioi-khoi-v1';

export default {
  id: 'the-gioi-khoi',
  title: 'Thế Giới Khối',
  tagline: 'Cùng bạn bè dựng và khám phá thế giới khối',
  desc: 'Game thế giới khối nhiều người chơi chạy ngay trên trình duyệt. Bản hiện tại chỉ là trang thử kết nối phòng.',
  tags: ['Nhiều người chơi', 'Đang phát triển'],
  url: new URL('./', import.meta.url).href,
  progress() {
    const s = readJSON(STORE_KEY);
    return s && s.regions ? { pct: Math.min(1, s.regions / 5), text: `Đã mở ${s.regions} vùng`, updated: 0 } : null;
  },
};
```

- [ ] **Step 6: Viết `games/the-gioi-khoi/main.js`**

```js
// Trang thử phòng: tạo/vào phòng bằng mã, thấy nhau di chuyển, xem ping và băng thông.
// ?net=memory dùng transport bộ nhớ (hai tab cùng máy); mặc định là WebRTC thật. ?debug đưa trạng thái ra window.
import { $, clamp } from '../../platform/core/util.js';
import { startLoop } from '../../platform/core/loop.js';
import { debugOn, exposeGlobals } from '../../platform/core/debug.js';
import { mountHomeLink } from '../../platform/ui/bar.js';
import { Room } from '../../platform/net/room.js';
import { createStats, instrument } from '../../platform/net/stats.js';
import { createFixedLoop, startHostLoop } from '../../platform/net/host-loop.js';

const W = 960, H = 540, SPEED = 220;
const cv = $('cv'), ctx = cv.getContext('2d');
const NET = new URLSearchParams(location.search).get('net') || 'trystero';
const ERR = {
  'bad-code': 'Mã phòng không đúng (5–6 ký tự, không có I, O, 0, 1).',
  'not-found': 'Không tìm thấy phòng này. Kiểm tra lại mã và chắc chắn chủ phòng đang mở trang.',
  'full': 'Phòng đã đủ 5 người.',
  'version': 'Hai bên khác phiên bản. Hãy tải lại trang.',
  'code-taken': 'Mã phòng bị trùng. Thử tạo lại.',
};

const me = { x: W / 2, y: H / 2 };
const others = new Map();            // id -> { x, y }
const keys = new Set();
let room = null, wire = null, stats = null, pingTimer = null;

addEventListener('keydown', e => { if (e.target.tagName !== 'INPUT') keys.add(e.key.toLowerCase()); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

async function makeTransport() {
  if (NET === 'memory') return (await import('../../platform/net/transport-memory.js')).createMemoryTransport();
  return (await import('../../platform/net/transport-trystero.js')).createTrysteroTransport();
}

function show(inRoom) { $('lobby').hidden = inRoom; $('inroom').hidden = !inRoom; }

function renderPlayers(pings = {}) {
  const ul = $('players'); ul.textContent = '';
  for (const p of room.players) {
    const li = document.createElement('li'), ms = pings[p.id];
    li.textContent = p.name + (p.id === room.hostId ? ' ★' : '') + (p.id === room.selfId ? ' (bạn)' : '') +
      (ms != null ? ` · ${Math.round(ms)} ms` : '');
    ul.appendChild(li);
  }
}

function leaveUi(message) {
  clearInterval(pingTimer); stopTick();
  room = null; wire = null; others.clear(); show(false);
  $('err').textContent = message || '';
}

// Mỗi 50 ms: tự di chuyển và gửi vị trí cho mọi người.
const tickLoop = createFixedLoop({ hz: 20, step(dt) {
  const dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const dy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  me.x = clamp(me.x + dx * SPEED * dt, 20, W - 20); me.y = clamp(me.y + dy * SPEED * dt, 20, H - 20);
  if (room) room.send('pos', { x: me.x, y: me.y });
} });
let stopTick = () => {};

function attach(r) {
  room = r; others.clear(); show(true);
  $('room-code').textContent = r.code;
  $('role').textContent = r.isHost ? '(chủ phòng — giữ tab này ở phía trước)' : '';
  r.on('roster', players => {
    for (const id of [...others.keys()]) if (!players.some(p => p.id === id)) others.delete(id);
    if (room === r) renderPlayers();
  });
  r.on('message', ({ type, data, from }) => {
    if (type !== 'pos' || !r.players.some(p => p.id === from)) return;
    if (!data || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
    others.set(from, { x: clamp(data.x, 0, W), y: clamp(data.y, 0, H) });
  });
  r.on('closed', reason => { if (room === r) leaveUi(reason === 'host-left' ? 'Chủ phòng đã thoát.' : ''); });
  renderPlayers();
  stopTick = startHostLoop(tickLoop);
  pingTimer = setInterval(async () => {
    const pings = {};
    await Promise.all(r.players.filter(p => p.id !== r.selfId).map(async p => { pings[p.id] = await wire.ping(p.id); }));
    if (room !== r) return;
    renderPlayers(pings);
    const s = stats.snapshot();
    $('stats').textContent = `Nhận ${s.kbpsIn.toFixed(1)} KB/s · Gửi ${s.kbpsOut.toFixed(1)} KB/s`;
  }, 1000);
}

async function enter(make) {
  $('err').textContent = '';
  for (const id of ['btn-create', 'btn-join']) $(id).disabled = true;
  try {
    stats = createStats();
    wire = instrument(await makeTransport(), stats);
    attach(await make(wire));
  } catch (e) {
    if (wire) wire.leave();
    wire = null;
    $('err').textContent = ERR[e.message] || 'Không kết nối được. Thử lại.';
  } finally {
    for (const id of ['btn-create', 'btn-join']) $(id).disabled = false;
  }
}

$('btn-create').onclick = () => enter(t => Room.create({ transport: t, name: $('name').value }));
$('btn-join').onclick = () => enter(t => Room.join({ transport: t, name: $('name').value, code: $('code').value }));
$('btn-leave').onclick = () => { if (room) room.leave(); };

const nameOf = id => (room && room.players.find(p => p.id === id)?.name) || '?';

function render() {
  ctx.fillStyle = '#1b2a22'; ctx.fillRect(0, 0, W, H);
  ctx.font = '20px Itim, sans-serif'; ctx.textAlign = 'center';
  const dots = [[me, '#e9b949', room ? room.name : 'Bạn'], ...[...others].map(([id, o]) => [o, '#7ec8e3', nameOf(id)])];
  for (const [p, color, name] of dots) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(name, p.x, p.y - 22);
  }
}

mountHomeLink($('stage'));
if (debugOn()) exposeGlobals([{ get room() { return room; }, get stats() { return stats; }, others, me }]);
startLoop(() => {}, render);
```

- [ ] **Step 7: Chạy để thấy đạt**

Run: `python3 tests/test_net.py`
Expected: toàn bộ PASS, `0 hỏng`. Nếu `startLoop` có chữ ký khác `startLoop(update, render)`, đối chiếu `platform/core/loop.js` và `games/_template/main.js` dòng cuối rồi sửa cách gọi; giữ `render` vẽ mỗi khung hình.

- [ ] **Step 8: Chạy bộ test cũ để chắc không vỡ gì**

Run: `python3 tests/test_platform.py`
Expected: giữ nguyên kết quả như trước khi làm (game mới chưa nằm trong `GAMES` nên không ảnh hưởng). Nếu có bài hỏng, kiểm tra bằng `git stash` xem có hỏng từ trước không; chỉ sửa nếu do thay đổi của plan này.

- [ ] **Step 9: Commit**

```bash
git add games/the-gioi-khoi tests/test_net.py
git commit -m "feat(the-gioi-khoi): trang thử phòng — tạo/vào phòng, thấy nhau, ping và băng thông" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Cổng M1 — đo kết nối thật (thủ công, cần chủ repo)

Mục đích: quyết định tiếp tục P2P hay chuyển sang server. Test tự động không thay được bước này vì cần mạng và thiết bị thật. Trystero cần ngữ cảnh an toàn (HTTPS hoặc `localhost`), nên đo qua mạng thật phải qua HTTPS.

**Files:**
- Modify: `docs/superpowers/specs/2026-10-16-the-gioi-khoi-design.md` (thêm mục "Kết quả M1")

- [ ] **Step 1: Thử cùng máy (không cần đẩy lên đâu)**

```bash
cd /data/yuu/ai-data/yuu/self/game-hub && python3 -m http.server 8003
```

Mở `http://localhost:8003/games/the-gioi-khoi/` ở hai cửa sổ Chrome khác nhau (một cửa sổ ẩn danh). Tạo phòng ở cửa sổ 1, vào bằng mã ở cửa sổ 2.
Expected: cả hai thấy nhau trong danh sách, chấm di chuyển cho nhau thấy, có ping. Nếu không nối được: mở Console, ghi lỗi, kiểm tra tên export của thư viện (Task 4 Step 5) và việc mạng có chặn WebSocket tới tracker công cộng không.

- [ ] **Step 2: Hỏi chủ repo trước khi đẩy nhánh lên GitHub**

Đẩy nhánh `the-gioi-khoi` lên remote là hành động công khai (repo `vuthehuy1997/Game` là công khai). Chỉ làm khi chủ repo đồng ý. Nếu đồng ý và Pages đang bật cho nhánh này (hoặc chủ repo bật tạm), mở địa chỉ HTTPS của trang từ các thiết bị bên dưới.

- [ ] **Step 3: Đo với thiết bị và mạng thật**

Dùng ít nhất 3 thiết bị/trình duyệt, trong đó có một thiết bị ở mạng khác (ví dụ điện thoại dùng 4G). Lặp 5 lượt: một người tạo phòng, những người còn lại vào bằng mã. Ghi từng lượt: số người nối được trong 15 giây, ping từng người, KB/s hiển thị.

- [ ] **Step 4: Ghi kết quả vào spec**

Thêm vào cuối `docs/superpowers/specs/2026-10-16-the-gioi-khoi-design.md` mục sau, điền số đo thật:

```markdown
## Kết quả M1 (điền ngày đo)

| Lượt | Thiết bị/mạng | Nối được trong 15 giây | Ping (ms) | Ghi chú |
|---|---|---|---|---|
| 1 | ... | x/y | ... | ... |

Tỉ lệ nối thành công: __ / __. Ping trung vị: __ ms.
Quyết định: tiếp tục P2P (đạt ≥ 4/5 lượt nối đủ người trong 15 giây) / thêm TURN / chuyển sang server.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-10-16-the-gioi-khoi-design.md platform/net/ice.js
git commit -m "docs(the-gioi-khoi): kết quả đo M1" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (mục Mạng và mốc M1):**
- Mã phòng 5–6 ký tự, bỏ ký tự dễ nhầm, tối đa 5 người, từ chối người thứ 6 → Task 1, 2.
- Sự kiện join/leave/host-changed: có `roster`, `closed('host-left')`; chuyển host (`host-changed`) không làm ở M1 (spec đặt "client giữ delta để nhập sang host mới" ở v1.1), ghi nhận là chủ ý.
- `transport.js` hai kênh tin cậy/không tin cậy: M1 chỉ dùng một kênh (Trystero/WebRTC đã có thứ tự và tin cậy theo mặc định). Kênh không tin cậy chưa cần cho M1 vì chỉ gửi vị trí 20 lần/giây; để lại cho M3, khi đo thấy cần.
- `host-loop.js` 20 tick/giây, bộ tích luỹ, chạy bù hữu hạn → Task 3. Cảnh báo "giữ tab host ở phía trước" → hiện trong `#role` ở Task 5.
- ICE/TURN cấu hình → Task 4 (chỉ STUN; TURN quyết định ở Task 6).
- Phiên bản giao thức, từ chối khác phiên bản → Task 2.
- Đo ping/băng thông, bảng debug → Task 3, hiển thị ở Task 5.
- Kiểm thử mạng 2–3 tab và transport giả trong bộ nhớ → Task 2, 5 (BroadcastChannel là transport giả).
- Thư viện chép vào `platform/vendor/` → Task 4.

**Quét placeholder:** không còn "TBD/TODO"; mọi bước code có mã đầy đủ. Hai chỗ phụ thuộc môi trường được nêu rõ cách kiểm: tên file/export của Trystero (Task 4 Step 5) và chữ ký `startLoop` (Task 5 Step 7).

**Nhất quán kiểu/tên:** `Room.create/join`, `players {id,name}`, `hostId`, sự kiện `roster/message/rejected/closed`, `createStats/instrument/ping`, `createFixedLoop/startHostLoop`, `createMemoryTransport/createTrysteroTransport`, `WIRE_TYPES` — tên và chữ ký dùng thống nhất ở các task. Test và `main.js` dùng đúng các tên đó (`others`, `me` qua `?debug`).

**Review Focus:** 6 dòng, mỗi dòng có test ở task đã ghi (HTML trong tên → Task 5; đầy phòng, mã sai, host thoát, roster giả/hello lặp → Task 2; tick xoắn ốc → Task 3).

**Chưa kiểm chứng:** mã trong plan này chưa được chạy. Rủi ro lớn nhất là độ chập chờn của các bài dùng `BroadcastChannel` và việc tên export của bản Trystero thật có đúng như giả định (`joinRoom`, `selfId`, `makeAction`, `onPeerJoin`, `onPeerLeave`, `leave`, tuỳ chọn `rtcConfig`).
