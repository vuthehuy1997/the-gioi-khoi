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
  constructor(transport, { code, name, isHost, version = PROTOCOL_VERSION, settleMs = 5000 }) {
    this.t = transport; this.code = code; this.name = cleanName(name);
    this.isHost = isHost; this.version = version;
    this.selfId = transport.selfId; this.hostId = isHost ? transport.selfId : null;
    this.players = isHost ? [{ id: this.selfId, name: this.name }] : [];
    this.closed = false; this._ev = emitter();
    this.peerSeen = false;                          // đã thấy peer nào trên kênh chưa (để phân biệt not-found / no-connect)
    this.settleUntil = Date.now() + settleMs;       // host mới tạo mà còn một mình trong khoảng này thì nhường mã khi bị trùng
    this._wire();
  }

  // Tạo phòng mới và làm host. Ném Error('bad-code') nếu mã tự chọn sai định dạng.
  static async create({ transport, name, code = makeRoomCode(), settleMs }) {
    if (!isValidCode(code)) throw new Error('bad-code');
    const room = new Room(transport, { code, name, isHost: true, settleMs });
    await transport.join(code);
    return room;
  }

  // Vào phòng có sẵn. Ném Error(message) với message: bad-code | not-found (không thấy ai trên kênh) |
  // no-connect (thấy người nhưng không bắt tay được với host) | full | version | code-taken.
  static async join({ transport, name, code, timeoutMs = 15000, version }) {
    code = normalizeCode(code);
    if (!isValidCode(code)) throw new Error('bad-code');
    const room = new Room(transport, { code, name, isHost: false, version });
    await transport.join(code);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { room.leave('timeout'); reject(new Error(room.peerSeen ? 'no-connect' : 'not-found')); }, timeoutMs);
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
    t.onPeerJoin(id => { this.peerSeen = true; t.send('hello', { v: this.version, name: this.name, host: this.isHost }, id); });
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
      if (this.isHost) {                            // trùng mã: chỉ host còn mới và còn một mình mới phải nhường
        if (this.players.length === 1 && Date.now() < this.settleUntil) this._reject('code-taken');
        return;
      }
      if (this.hostId && this.hostId !== from) return;   // đã có host: bỏ qua host khác
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
