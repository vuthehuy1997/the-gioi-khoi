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
  'no-connect': 'Thấy phòng nhưng chưa nối được với chủ phòng. Có thể mạng chặn kết nối trực tiếp; thử lại hoặc đổi mạng.',
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

let stopTick = () => {};

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
