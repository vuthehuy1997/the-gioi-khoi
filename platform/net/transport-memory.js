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
