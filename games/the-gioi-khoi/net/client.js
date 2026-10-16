// Phiên khách: nối vào phòng của host, nhận thế giới (seed + delta), ảnh chụp và sự kiện; gửi trạng thái và hành động.
import { Room } from '../../../platform/net/room.js';
import { World } from '../world/world.js';

const STATE_MIN_MS = 45;

export class ClientSession {
  constructor(room, uid, name) {
    this.room = room; this.uid = uid; this.name = name;
    this.world = null; this.flags = {}; this.you = null; this.snap = null; this.time = 0; this.pos = null; this.spawn = null;
    this.handlers = new Map(); this.closed = false; this.lastSend = 0; this.seq = 0;
  }

  static async join({ transport, name, uid, code, timeoutMs = 15000 }) {
    const room = await Room.join({ transport, name, code, timeoutMs });
    const s = new ClientSession(room, uid, name);
    try { await s.handshake(); } catch (e) { room.leave('error'); throw e; }
    return s;
  }

  on(ev, fn) { if (!this.handlers.has(ev)) this.handlers.set(ev, new Set()); this.handlers.get(ev).add(fn); return () => this.handlers.get(ev).delete(fn); }
  emit(ev, ...a) { for (const f of [...(this.handlers.get(ev) || [])]) f(...a); }
  get code() { return this.room.code; }

  handshake() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no-welcome')), 10000);
      const off = this.room.on('message', ({ type, data, from }) => {
        if (from !== this.room.hostId) return;
        if (type === 'deny') { clearTimeout(timer); reject(new Error(data && data.reason || 'denied')); }
        else if (type === 'welcome') { clearTimeout(timer); this.applyWelcome(data); off(); this.attach(); resolve(); }
      });
      this.room.on('closed', r => { clearTimeout(timer); reject(new Error(r)); });
      this.room.send('join', { uid: this.uid, name: this.name }, this.room.hostId);
    });
  }

  applyWelcome(d) {
    this.world = new World(d.seed); this.world.importDelta(d.delta || {});
    this.flags = d.flags || {}; this.you = d.you; this.pos = d.pos; this.spawn = d.spawn; this.time = d.time;
  }

  attach() {
    this.room.on('message', ({ type, data, from }) => {
      if (from !== this.room.hostId || !data) return;
      if (type === 'snap') { this.snap = data; this.time = data.time; this.emit('snap', data); }
      else if (type === 'ev') for (const ev of data.list || []) this.handleEvent(ev);
      else if (type === 'kicked') { this.closed = true; this.room.leave('replaced'); this.emit('closed', 'replaced'); }
    });
    this.room.on('closed', r => { this.closed = true; this.emit('closed', r); });
  }

  handleEvent(ev) {
    if (ev.t === 'block') this.world.set(ev.x, ev.y, ev.z, ev.id);
    else if (ev.t === 'you') this.you = ev;
    else if (ev.t === 'boss-defeated') this.flags['boss:' + ev.type] = true;
    else if (ev.t === 'teleport') this.seq = ev.seq | 0;
    this.emit('ev', ev);
  }

  sendState(st) {
    const now = performance.now();
    if (now - this.lastSend < STATE_MIN_MS) return false;
    this.lastSend = now; this.room.send('st', { ...st, seq: this.seq }, this.room.hostId); return true;
  }
  act(a) { this.room.send('act', a, this.room.hostId); }
  leave() { if (!this.closed) { this.closed = true; this.room.leave('left'); } }
}
