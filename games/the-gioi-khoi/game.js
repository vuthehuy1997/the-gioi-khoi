// Trang game: menu (một mình / tạo phòng / vào phòng / nhập file), vòng lặp, điều khiển, hiển thị. Logic game nằm ở sim/ và net/.
import { $, clamp } from '../../platform/core/util.js';
import { debugOn, exposeGlobals } from '../../platform/core/debug.js';
import { mountHomeLink } from '../../platform/ui/bar.js';
import { cleanName } from '../../platform/net/protocol.js';
import { World } from './world/world.js';
import { Game } from './sim/game.js';
import { makePlayer, stepPlayer } from './sim/physics.js';
import { breakTimeFor, nearBench } from './sim/rules.js';
import { lightLevel } from './sim/daynight.js';
import { HostSession } from './net/host.js';
import { ClientSession } from './net/client.js';
import { createScene } from './render/scene.js';
import { ChunkView } from './render/chunkview.js';
import { createEntityView } from './render/entities.js';
import { createHud } from './ui/hud.js';
import { createPanels } from './ui/panels.js';
import { regionById } from './world/regions.js';
import { REGIONS } from './content/regions.js';
import { MOBS } from './content/mobs.js';
import { BOSSES } from './content/bosses.js';
import { ITEMS } from './content/items.js';
import { BLOCKS } from './world/blocks.js';
import { saveWorld, loadWorld, exportWorld, importWorld } from './save.js';

const params = new URLSearchParams(location.search);
const NET = params.get('net') || 'trystero';
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } } };
const uid = (debugOn() && params.get('uid')) || store.get('tgk-uid') || (() => { const u = 'u' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); store.set('tgk-uid', u); return u; })();
const ERR = {
  'bad-code': 'Mã phòng không đúng (5–6 ký tự, không có I, O, 0, 1).',
  'not-found': 'Không tìm thấy phòng này. Kiểm tra mã và chắc chắn chủ phòng đang mở trang.',
  'no-connect': 'Thấy phòng nhưng chưa nối được với chủ phòng. Có thể mạng chặn kết nối trực tiếp; thử lại hoặc đổi mạng.',
  'full': 'Phòng đã đủ 5 người.', 'version': 'Hai bên khác phiên bản. Hãy tải lại trang.', 'code-taken': 'Mã phòng bị trùng. Thử tạo lại.',
  'dup-uid': 'Tài khoản này đang ở trong phòng (mở trang ở hai tab?).', 'no-welcome': 'Chủ phòng không phản hồi. Thử lại.', 'newer-version': 'File thế giới này mới hơn phiên bản game.', 'bad-file': 'File không hợp lệ.',
};

const scene = createScene($('cv'));
const hud = createHud();
let S = null, game = null, local = null, view = null, ents = null, panels = null;
let pending = 1, paused = false, wasLocked = false, lastHit = 0, dig = null, digCooldown = 0, lastSel = -1;
const keys = new Set(), mouse = { left: false };
const buf = [];                                  // vài ảnh chụp gần nhất để nội suy
let interp = { ps: [], es: [] };

// ---------------------------------------------------------------- khởi động phiên
const randomSeed = () => (Number(params.get('seed')) || (crypto.getRandomValues(new Uint32Array(1))[0] | 0)) | 0;
const myName = () => cleanName($('name').value) ;
const makeTransport = async () => (NET === 'memory'
  ? (await import('../../platform/net/transport-memory.js')).createMemoryTransport()
  : (await import('../../platform/net/transport-trystero.js')).createTrysteroTransport());

async function newOrSavedGame(fresh) {
  let save = null;
  if (!fresh) { try { save = await loadWorld('main'); } catch (e) { save = null; } }
  if (save) return Game.fromSave(save);
  const g = new Game({ seed: randomSeed() }); g.buildStructures(); return g;
}

function setBusy(b) { for (const id of ['btn-solo', 'btn-new', 'btn-host', 'btn-join']) $(id).disabled = b; }

async function launch(fn) {
  $('err').textContent = ''; setBusy(true);
  store.set('tgk-name', $('name').value);
  try { await begin(await fn()); }
  catch (e) { $('err').textContent = e.message === 'cancelled' ? '' : ERR[e.message] || 'Không thực hiện được: ' + (e.message || e); setBusy(false); }
}

$('btn-solo').onclick = () => launch(async () => { game = await newOrSavedGame(false); return HostSession.solo({ game, name: myName(), uid }); });
$('btn-new').onclick = () => launch(async () => {
  let has = null; try { has = await loadWorld('main'); } catch (e) { has = null; }
  if (has && !confirm('Thế giới đã lưu sẽ bị thay bằng thế giới mới. Tiếp tục?')) throw new Error('cancelled');
  game = await newOrSavedGame(true); return HostSession.solo({ game, name: myName(), uid }); });
$('btn-host').onclick = () => launch(async () => { game = await newOrSavedGame(false); return HostSession.create({ game, transport: await makeTransport(), name: myName(), uid }); });
$('btn-join').onclick = () => launch(async () => { game = null; return ClientSession.join({ transport: await makeTransport(), name: myName(), uid, code: $('code').value }); });
$('file-import').onchange = (e) => launch(async () => {
  const f = e.target.files[0]; const save = await importWorld(f);
  let has = null; try { has = await loadWorld('main'); } catch (e2) { has = null; }
  if (has && !confirm('Thế giới đã lưu sẽ bị thay bằng file này. Tiếp tục?')) throw new Error('cancelled');
  await saveWorld('main', save); game = Game.fromSave(save); return HostSession.solo({ game, name: myName(), uid });
});

async function begin(session) {
  S = session;
  const p0 = S.pos || (game && game.player(uid));
  local = makePlayer(p0.x, p0.y, p0.z); local.yaw = 0; local.pitch = -0.1;
  view = new ChunkView(S.world, scene, { radius: Number(params.get('r')) || 6 });
  ents = createEntityView(scene);
  panels = createPanels({ act: a => S.act(a), onClose: () => { if (S && !S.you.dead) lockPointer(); } });
  S.on('ev', handleEvent);
  S.on('snap', onSnap);
  S.on('closed', reason => { if (reason !== 'left') { try { sessionStorage.setItem('tgk-msg', reason === 'host-left' ? 'Chủ phòng đã thoát.' : reason === 'replaced' ? 'Bạn đã vào phòng này từ nơi khác.' : 'Mất kết nối.'); } catch (e) { /* bỏ qua */ } location.reload(); } });
  if (S.onSave !== undefined) S.onSave = save => { saveWorld('main', save).catch(() => {}); };
  $('menu').hidden = true; $('hud').hidden = false;
  hud.setRoom(S.code); refreshYou(); lockPointer();
  if (S instanceof HostSession && game) hud.setQuests(game.questSummary(uid));
}

// ---------------------------------------------------------------- sự kiện từ phiên
function onSnap(snap) { buf.push({ t: performance.now(), snap }); if (buf.length > 5) buf.shift(); }

const FAIL_TEXT = { poor: 'Không đủ xu.', 'inventory-full': 'Kho đồ đã đầy.', reach: 'Ở quá xa.', 'not-sold': 'Cửa hàng không bán món này.', 'not-bought': 'Cửa hàng không thu món này.',
  missing: 'Bạn không có đủ món này.', full: 'Máu đã đầy.', 'cannot-craft': 'Chưa đủ nguyên liệu hoặc cần đứng gần bàn chế tạo.', blocked: 'Có vật cản ở đó.', floating: 'Cần đặt cạnh một block khác.', 'too-soon': 'Chưa thể hồi sinh ngay.', far: 'Ở quá xa NPC.' };
function onFail(ev) {
  if (ev.a === 'break' || ev.a === 'dig') { dig = null; hud.setProgress(null); digCooldown = 0.2; if (ev.reason === 'reach') hud.toast('Ở quá xa.', 800); return; }
  if (FAIL_TEXT[ev.reason]) hud.toast(FAIL_TEXT[ev.reason], 1800);
}

let deathTimer = null;
function refreshYou() {
  const y = S.you; if (!y) return;
  hud.setHp(y.hp, y.maxHp); hud.setHotbar(y.inv, y.sel);
  if (y.dead) { if (!deathTimer) { document.exitPointerLock?.(); panels.close(); panels.showDeath(false); deathTimer = setTimeout(() => panels.showDeath(true), 3000); } }
  else if (deathTimer || !$('death').hidden) { clearTimeout(deathTimer); deathTimer = null; panels.hideDeath(); lockPointer(); }
  if (panels.isOpen) panels.refresh({ you: y, nearBench: nearBench(S.world, local.x, local.y, local.z) });
}

function handleEvent(ev) {
  switch (ev.t) {
    case 'you': refreshYou(); break;
    case 'hurt': hud.setHp(ev.hp, S.you.maxHp); if (ev.by !== undefined && ev.by !== null) hud.flash(); break;
    case 'teleport': local.x = ev.x; local.y = ev.y; local.z = ev.z; local.vx = local.vy = local.vz = 0; break;
    case 'kb': local.vx += ev.vx; local.vz += ev.vz; local.vy = Math.max(local.vy, ev.vy); break;
    case 'toast': hud.toast(ev.text); break;
    case 'dialog': document.exitPointerLock?.(); panels.showDialog(ev); break;
    case 'dialog-end': panels.endDialog(); break;
    case 'shop': document.exitPointerLock?.(); panels.showShop(ev, S.you); break;
    case 'quests': hud.setQuests(ev.list); break;
    case 'region': hud.setRegion(ev.name); break;
    case 'died': hud.toast(ev.uid === uid ? 'Bạn đã gục ngã.' : `${ev.name} đã gục ngã.`); break;
    case 'boss-start': hud.toast(`${ev.name} xuất hiện!`); break;
    case 'boss-defeated': hud.toast(`${ev.name} đã bị hạ!`, 5000); break;
    case 'pickup': hud.toast(`+${ev.n} ${ITEMS[ev.item].name}`, 1200); break;
    case 'fail': onFail(ev); break;
    case 'telegraph': { const b = interp.es.find(e => e.id === ev.id); ents.telegraph(ev.x, b ? b.y : local.y, ev.z, ev.r, ev.time); break; }
  }
}

// ---------------------------------------------------------------- điều khiển
const inUi = () => !S || panels.isOpen || paused || S.you.dead || !$('menu').hidden;
function lockPointer() { if (!debugOn() || NET !== 'memory') { try { const r = $('cv').requestPointerLock?.(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* không khoá được: bỏ qua */ } } }
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (!S) return;
  if (e.code === 'Escape') { if (panels.isOpen) panels.close(); else if (!paused && !S.you.dead) setPause(true); else if (paused) setPause(false); return; }
  if (inUi() && e.code !== 'KeyE') return;
  if (e.code === 'KeyE') { if (panels.kind === 'inventory') panels.close(); else if (!inUi()) { document.exitPointerLock?.(); panels.openInventory({ you: S.you, nearBench: nearBench(S.world, local.x, local.y, local.z) }); } return; }
  const m = /^Digit([1-9])$/.exec(e.code);
  if (m) S.act({ t: 'sel', i: Number(m[1]) - 1 });
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse.left = false; dig = null; hud.setProgress(null); });
addEventListener('wheel', e => { if (!S || inUi()) return; S.act({ t: 'sel', i: (S.you.sel + (e.deltaY > 0 ? 1 : 8)) % 9 }); }, { passive: true });
addEventListener('mousemove', e => {
  if (!S || document.pointerLockElement !== $('cv') || inUi()) return;
  local.yaw -= e.movementX * 0.0025; local.pitch = clamp(local.pitch - e.movementY * 0.0025, -1.55, 1.55);
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === $('cv');
  if (wasLocked && !locked && S && !panels.isOpen && !S.you.dead && !paused) setPause(true);
  wasLocked = locked;
});
const onCanvas = e => !e.target.closest('#panel,#pause,#death,#menu,button,input,label');
addEventListener('mousedown', e => {
  if (!S || !onCanvas(e)) return;
  if (!paused && !panels.isOpen && !S.you.dead && document.pointerLockElement !== $('cv') && !(debugOn() && NET === 'memory')) { lockPointer(); return; }
  if (inUi()) return;
  if (e.button === 0) { mouse.left = true; } else if (e.button === 2) useItem();
});
addEventListener('mouseup', e => { if (e.button === 0) { mouse.left = false; dig = null; hud.setProgress(null); } });
addEventListener('contextmenu', e => e.preventDefault());

function setPause(on) {
  paused = on; if (S && S.pause) S.pause(on); $('pause').hidden = !on; $('btn-save').hidden = $('btn-export').hidden = !game;
  if (on) { document.exitPointerLock?.(); mouse.left = false; dig = null; hud.setProgress(null); } else lockPointer();
}
$('btn-resume').onclick = () => setPause(false);
$('btn-save').onclick = async () => { await saveWorld('main', game.toSave()); $('pause-msg').textContent = 'Đã lưu.'; };
$('btn-export').onclick = async () => {
  const blob = await exportWorld(game.toSave()), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'the-gioi-khoi.gz'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('btn-leave').onclick = async () => { if (game) await saveWorld('main', game.toSave()).catch(() => {}); S.leave(); location.reload(); };
$('btn-respawn').onclick = () => S.act({ t: 'respawn' });

function inputNow() {
  return { fx: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), fz: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    jump: keys.has('Space'), sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') };
}

// ---------------------------------------------------------------- nhắm và tương tác
const eyeOf = () => ({ x: local.x, y: local.y + 1.62, z: local.z });
const dirOf = () => ({ x: -Math.sin(local.yaw) * Math.cos(local.pitch), y: Math.sin(local.pitch), z: -Math.cos(local.yaw) * Math.cos(local.pitch) });
const sizeOf = e => (e.kind === 'mob' ? MOBS[e.type] : e.kind === 'boss' ? BOSSES[e.type] : e.kind === 'npc' ? { w: 0.7, h: 1.9 } : null);

function rayBox(o, d, min, max) {
  let t0 = 0, t1 = 99;
  for (const a of ['x', 'y', 'z']) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < min[a] || o[a] > max[a]) return null; continue; }
    let a0 = (min[a] - o[a]) / d[a], a1 = (max[a] - o[a]) / d[a]; if (a0 > a1) [a0, a1] = [a1, a0];
    t0 = Math.max(t0, a0); t1 = Math.min(t1, a1); if (t0 > t1) return null;
  }
  return t0;
}
function pickEntity(o, d, maxD) {
  let best = null;
  for (const e of interp.es) {
    const s = sizeOf(e); if (!s) continue;
    const t = rayBox(o, d, { x: e.x - s.w / 2, y: e.y, z: e.z - s.w / 2 }, { x: e.x + s.w / 2, y: e.y + s.h, z: e.z + s.w / 2 });
    if (t !== null && t <= maxD && (!best || t < best.t)) best = { e, t };
  }
  return best;
}

function heldId() { const s = S.you.inv[S.you.sel]; return s ? s.id : null; }

function useItem() {
  const o = eyeOf(), d = dirOf(), blk = S.world.raycast(o, d, 6), en = pickEntity(o, d, 5);
  if (en && en.e.kind === 'npc' && (!blk || en.t < blk.dist)) { S.act({ t: 'interact', id: en.e.id }); return; }
  const h = heldId() && ITEMS[heldId()];
  if (h && h.block && blk) { S.act({ t: 'place', x: blk.pos.x + blk.normal.x, y: blk.pos.y + blk.normal.y, z: blk.pos.z + blk.normal.z }); return; }
  if (h && h.heal) S.act({ t: 'use' });
}

function mining(dt, now) {
  if (!mouse.left) return;
  const o = eyeOf(), d = dirOf(), blk = S.world.raycast(o, d, 6), en = pickEntity(o, d, 4.5);
  if (en && (en.e.kind === 'mob' || en.e.kind === 'boss') && (!blk || en.t < blk.dist)) {
    dig = null; hud.setProgress(null);
    if (now - lastHit > 0.5) { lastHit = now; S.act({ t: 'hit', id: en.e.id }); }
    return;
  }
  if (!blk) { dig = null; hud.setProgress(null); return; }
  digCooldown -= dt;
  if (digCooldown > 0) return;
  const need = breakTimeFor(blk.id, heldId());
  if (need === Infinity) { dig = null; hud.setProgress(null); return; }
  if (!dig || dig.x !== blk.pos.x || dig.y !== blk.pos.y || dig.z !== blk.pos.z) { dig = { ...blk.pos, t0: now }; S.act({ t: 'dig', ...blk.pos }); }
  const prog = (now - dig.t0) / need;
  hud.setProgress(prog);
  if (prog >= 1) { S.act({ t: 'break', x: dig.x, y: dig.y, z: dig.z }); dig = null; digCooldown = 0.12; hud.setProgress(null); }
}

// ---------------------------------------------------------------- vòng lặp
function interpolate(now) {
  if (!buf.length) return;
  const rt = now - 110;
  let a = buf[0], b = buf[buf.length - 1];
  for (let i = 0; i < buf.length - 1; i++) if (buf[i].t <= rt && buf[i + 1].t >= rt) { a = buf[i]; b = buf[i + 1]; break; }
  const f = a === b ? 1 : clamp((rt - a.t) / Math.max(1, b.t - a.t), 0, 1);
  const lerpList = (la, lb, key) => lb.map(e => { const o = la.find(x => x[key] === e[key]); return o ? { ...e, x: o.x + (e.x - o.x) * f, y: o.y + (e.y - o.y) * f, z: o.z + (e.z - o.z) * f } : e; });
  interp = { ps: lerpList(a.snap.ps, b.snap.ps, 'uid'), es: lerpList(a.snap.es, b.snap.es, 'id') };
}

let last = performance.now(), nowS = 0;
// Số đo chi phí JS mỗi khung (cho test hiệu năng và bộ điều chỉnh chất lượng).
const perf = { n: 0, sum: 0, max: 0, ring: new Float32Array(240), i: 0, reset() { this.n = 0; this.sum = 0; this.max = 0; this.ring.fill(0); this.i = 0; },
  add(ms) { this.n++; this.sum += ms; if (ms > this.max) this.max = ms; this.ring[this.i++ % 240] = ms; },
  p(q) { const a = [...this.ring.slice(0, Math.min(this.n, 240))].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * q))] : 0; } };
function frame(dt) {
  const tf = performance.now();
  frameBody(dt);
  perf.add(performance.now() - tf);
}
function frameBody(dt) {
  nowS += dt;
  if (!S) { scene.render(); return; }
  const y = S.you, ui = inUi();
  if (!y.dead) stepPlayer(S.world, local, ui ? {} : inputNow(), dt);
  S.sendState({ x: local.x, y: local.y, z: local.z, vx: local.vx, vy: local.vy, vz: local.vz, yaw: local.yaw, pitch: local.pitch });
  scene.camera.position.set(local.x, local.y + 1.62, local.z);
  scene.camera.rotation.set(local.pitch, local.yaw, 0);
  if (!ui) mining(dt, nowS);
  const keep = game ? [...game.players.values()].filter(p => p.uid !== uid && !p.dead).map(p => ({ x: p.x, z: p.z, r: 4 })) : [];
  pending = view.update([local], undefined, keep);
  interpolate(performance.now());
  const list = [];
  for (const p of interp.ps) if (p.uid !== uid && !p.dead) list.push({ key: 'p:' + p.uid, kind: 'player', ...p });
  for (const e of interp.es) list.push({ key: 'e:' + e.id, ...e });
  ents.update(list, nowS);
  const boss = interp.es.filter(e => e.kind === 'boss').sort((a, b) => Math.hypot(a.x - local.x, a.z - local.z) - Math.hypot(b.x - local.x, b.z - local.z))[0];
  hud.setBoss(boss && Math.hypot(boss.x - local.x, boss.z - local.z) < 70 ? { name: BOSSES[boss.type].name, hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase } : null);
  const r = regionById(S.world.regionAt(local.x, local.z));
  scene.setEnvironment({ sky: r.sky, fog: r.fog, light: lightLevel(S.time) });
  scene.render();
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { frame(dt); } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
function resize() { $('cv').width = innerWidth; $('cv').height = innerHeight; scene.resize(); }
addEventListener('resize', resize); resize();
mountHomeLink($('stage'));

$('name').value = store.get('tgk-name') || '';
try { const m = sessionStorage.getItem('tgk-msg'); if (m) { $('err').textContent = m; sessionStorage.removeItem('tgk-msg'); } } catch (e) { /* bỏ qua */ }
addEventListener('pagehide', () => { if (game && S && !S.closed) saveWorld('main', game.toSave()).catch(() => {}); });
requestAnimationFrame(loop);

if (debugOn()) {
  window.__g = {
    get S() { return S; }, get game() { return game; }, get local() { return local; }, get view() { return view; }, scene, hud, get panels() { return panels; }, get ents() { return ents; },
    get pending() { return pending; }, perf, get interp() { return interp; }, mouse, keys,
    renderNow: () => frame(0.0001),
    lookAt(x, y, z) { const dx = x - local.x, dy = y - (local.y + 1.62), dz = z - local.z; local.yaw = Math.atan2(-dx, -dz); local.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
  };
}
