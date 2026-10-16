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
