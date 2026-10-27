// Phiên host: chạy Game, nhận trạng thái và hành động từ khách, gửi ảnh chụp và sự kiện. Cũng dùng cho chơi một mình (không có phòng).
// Giao diện dùng chung với ClientSession (xem client.js): uid, world, flags, you, snap, sendState, act, on, leave.
import { Room } from '../../../platform/net/room.js';
import { createFixedLoop, startHostLoop } from '../../../platform/net/host-loop.js';
import { cleanName } from '../../../platform/net/protocol.js';
import { snapshotFor, youOf } from './snapshot.js';

const ACT_PER_SEC = 40;
const REPORT = new Set(['break', 'dig', 'place', 'buy', 'sell', 'craft', 'use', 'respawn', 'interact', 'equip', 'unequip', 'toggle', 'sleep', 'chest-open', 'chest-move', 'till', 'plant', 'harvest', 'feed', 'shear', 'gate', 'dchest', 'roll', 'shoot']);

export class HostSession {
  constructor(game, room, uid, name) {
    game.weatherOn = true;                                 // thời tiết chỉ chạy khi có phòng thật (bài thử mô phỏng thuần không bị mưa làm lệch thời gian)
    this.game = game; this.room = room; this.uid = uid; this.name = cleanName(name);
    this.world = game.world; this.flags = game.flags;
    this.you = null; this.snap = null; this.time = 0;
    this.handlers = new Map();
    this.peers = new Map();            // peerId -> uid
    this.revSent = new Map();          // uid -> rev
    this.acts = new Map();             // uid -> { t0, n }
    this.seq = 0; this.closed = false; this.paused = false; this.tickNo = 0; this.saveEvery = 30; this.saveAcc = 0;
    this.sts = new Map();               // uid -> { t0, n } giới hạn tần suất gói vị trí
    this.onSave = null;
  }

  static async create({ game, transport, name, uid, code }) {
    const room = await Room.create({ transport, name, code });
    const s = new HostSession(game, room, uid, name); s.start(); return s;
  }
  static solo({ game, name, uid }) { const s = new HostSession(game, null, uid, name); s.start(); return s; }

  get code() { return this.room ? this.room.code : null; }
  on(ev, fn) { if (!this.handlers.has(ev)) this.handlers.set(ev, new Set()); this.handlers.get(ev).add(fn); return () => this.handlers.get(ev).delete(fn); }
  emit(ev, ...a) { for (const f of [...(this.handlers.get(ev) || [])]) f(...a); }

  start() {
    const g = this.game;
    g.hostUid = this.uid;                                       // chủ phòng không cần bù độ trễ khi lăn (xem sim/fight.js)
    this.player = g.player(this.uid) || g.addPlayer(this.uid, this.name);
    this.you = youOf(this.player);
    if (this.room) {
      this.room.on('message', m => this.onMessage(m));
      this.room.on('roster', () => this.onRoster());
      this.room.on('closed', r => { this.stop(); this.emit('closed', r); });
    }
    this.loop = createFixedLoop({ hz: 20, maxCatchUp: 40, step: dt => this.step(dt) });
    this.stopLoop = startHostLoop(this.loop);
  }

  stop() { if (this.stopLoop) this.stopLoop(); this.stopLoop = null; this.closed = true; }

  onRoster() {
    const ids = new Set(this.room.players.map(p => p.id));
    for (const [peer, uid] of [...this.peers]) if (!ids.has(peer)) { this.peers.delete(peer); this.game.removePlayer(uid); this.revSent.delete(uid); this.emit('players'); }
  }

  welcome(peer, p) {
    const g = this.game;
    this.room.send('welcome', { v: 1, seed: g.seed, delta: g.world.exportDelta(), flags: g.flags, time: g.time, uid: p.uid, you: youOf(p),
      pos: { x: p.x, y: p.y, z: p.z }, spawn: g.spawn }, peer);
  }

  onMessage({ type, data, from }) {
    const g = this.game;
    if (type === 'join') {
      if (this.peers.has(from) || !data || typeof data.uid !== 'string' || !/^[\w-]{1,64}$/.test(data.uid)) return;
      if (!this.room.players.some(p => p.id === from)) return;
      if (data.uid === this.uid) { this.room.send('deny', { reason: 'dup-uid' }, from); return; }
      const oldPeer = [...this.peers].find(([, u]) => u === data.uid);          // nối lại sau khi rớt mạng: thế chỗ kết nối cũ
      if (oldPeer) { this.peers.delete(oldPeer[0]); g.removePlayer(data.uid); this.room.send('kicked', {}, oldPeer[0]); }
      const p = g.addPlayer(data.uid, cleanName(data.name));
      this.peers.set(from, data.uid); this.revSent.set(data.uid, -1);
      this.welcome(from, p); this.emit('players');
      return;
    }
    const uid = this.peers.get(from);
    if (!uid) return;
    if (type === 'st') { if (data && typeof data === 'object' && this.allowSt(uid)) g.applyState(uid, data); }
    else if (type === 'act') { if (data && typeof data === 'object' && this.allow(uid)) this.safeAct(uid, data); }
  }

  allow(uid) {
    const now = this.game.time, a = this.acts.get(uid) || { t0: now, n: 0 };
    if (now - a.t0 >= 1) { a.t0 = now; a.n = 0; }
    a.n++; this.acts.set(uid, a);
    return a.n <= ACT_PER_SEC;
  }
  allowSt(uid) {
    const now = this.game.time, a = this.sts.get(uid) || { t0: now, n: 0 };
    if (now - a.t0 >= 1) { a.t0 = now; a.n = 0; }
    a.n++; this.sts.set(uid, a);
    return a.n <= 30;
  }

  safeAct(uid, a) {
    let r;
    try { r = this.game.act(uid, a); } catch (e) { r = { ok: false, reason: 'error' }; }
    if (!r.ok && REPORT.has(a && a.t)) this.game.emit(uid, { t: 'fail', a: a.t, reason: r.reason });     // báo lý do thất bại cho người chơi
    return r;
  }

  pause(on) { if (!this.room) this.paused = !!on; }          // chỉ chơi một mình mới dừng được

  step(dt) {
    if (this.paused) return;
    const g = this.game;
    g.tick(dt); this.tickNo++;
    const per = new Map(), bcast = [];
    for (const { to, ev } of g.drain()) { if (to === null) bcast.push(ev); else { if (!per.has(to)) per.set(to, []); per.get(to).push(ev); } }
    // trạng thái cá nhân khi đổi
    for (const p of g.players.values()) {
      if (this.revSent.get(p.uid) !== p.rev) { this.revSent.set(p.uid, p.rev); if (!per.has(p.uid)) per.set(p.uid, []); per.get(p.uid).push({ t: 'you', ...youOf(p) }); }
    }
    for (const ev of bcast) this.deliver(this.uid, ev);
    for (const [uid, list] of per) for (const ev of list) if (uid === this.uid) this.deliver(uid, ev);
    if (this.room) {
      for (const [peer, uid] of this.peers) {
        const list = [...bcast, ...(per.get(uid) || [])];
        if (list.length) this.room.send('ev', { list }, peer);
        if (this.tickNo % 2 === 0) this.room.send('snap', snapshotFor(g, uid), peer);
      }
    }
    if (this.tickNo % 2 === 0) { this.snap = snapshotFor(g, this.uid); this.time = g.time; this.emit('snap', this.snap); }
    this.saveAcc += dt;
    if (this.onSave && this.saveAcc >= this.saveEvery) { this.saveAcc = 0; this.onSave(g.toSave()); }
  }

  deliver(uid, ev) {
    if (uid !== this.uid) return;
    if (ev.t === 'you') this.you = ev;
    if (ev.t === 'teleport') this.seq = ev.seq | 0;
    this.emit('ev', ev);
  }

  // ---- giao diện cho giao diện người dùng ----
  sendState(st) { return this.game.applyState(this.uid, { ...st, seq: this.seq }); }
  act(a) { return this.safeAct(this.uid, a); }
  leave() {
    if (this.closed) return;
    this.stop();
    if (this.room) this.room.leave('left');
    this.emit('closed', 'left');
  }
}
