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
      // API của @trystero-p2p/torrent 0.26: makeAction trả object { send(data, {target}), onMessage = (data, {peerId}) }.
      for (const type of WIRE_TYPES) {
        const action = room.makeAction(type);
        sendFns[type] = action;
        action.onMessage = (data, { peerId }) => (handlers.get(type) || []).forEach(f => f(data, peerId));
      }
      room.onPeerJoin = id => joinFns.forEach(f => f(id));
      room.onPeerLeave = id => leaveFns.forEach(f => f(id));
    },
    send(type, data, to) { known(type); return sendFns[type].send(data, to ? { target: to } : undefined); },
    on(type, fn) { known(type); if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
    onPeerJoin(fn) { joinFns.push(fn); },
    onPeerLeave(fn) { leaveFns.push(fn); },
    leave() { if (room) { const r = room; room = null; r.leave(); } },
  };
}
