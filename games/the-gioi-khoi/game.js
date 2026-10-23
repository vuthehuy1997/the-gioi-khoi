// Trang game: menu (một mình / tạo phòng / vào phòng / nhập file), vòng lặp, điều khiển, hiển thị. Logic game nằm ở sim/ và net/.
import { $, clamp } from '../../platform/core/util.js';
import { debugOn, exposeGlobals } from '../../platform/core/debug.js';
import { mountHomeLink } from '../../platform/ui/bar.js';
import { cleanName } from '../../platform/net/protocol.js';
import { World } from './world/world.js';
import { Game } from './sim/game.js';
import { makePlayer, stepPlayer } from './sim/physics.js';
import { breakTimeFor, nearStations, weaponOf, reachOf, cdOf, costOf, drawForce, ROLL_TIME, ROLL_DIST, ROLL_COST, ROLL_CD, SLOW_MUL, BOW_CD } from './sim/rules.js';
import { lightLevel } from './sim/daynight.js';
import { HostSession } from './net/host.js';
import { ClientSession } from './net/client.js';
import { createScene } from './render/scene.js';
import { ChunkView } from './render/chunkview.js';
import { createEntityView } from './render/entities.js';
import { createSky } from './render/sky.js';
import { createEffects } from './render/effects.js';
import { stepCameraFx, newCameraFx, createHand } from './render/camerafx.js';
import { createIcons } from './ui/icons.js';
import { LEVELS, PRESETS, presetOf, defaultPreset, governLevel, isSoftwareRenderer } from './render/quality.js';
import { sfx } from './sfx.js';
import { createDirector } from './audio/director.js';
import { SETTINGS, saveSettings } from '../../platform/core/settings.js';
import { createHud, setIconProvider } from './ui/hud.js';
import { createPanels } from './ui/panels.js';
import { regionById } from './world/regions.js';
import { REGIONS } from './content/regions.js';
import { MOBS } from './content/mobs.js';
import { BOSSES } from './content/bosses.js';
import { ITEMS } from './content/items.js';
import { BLOCKS, B, BLOCK_BY_NAME, cropOf, isCrop, isFarmland, isPlant } from './world/blocks.js';
import { CROPS, SOIL } from './content/farming.js';
import { DUNGEONS } from './content/dungeons.js';
import { dungeonAt, trapView, compass, ROOM_NO } from './sim/dungeon.js';
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

const scene = createScene($('cv'), { aa: params.get('aa') !== '0' && (devicePixelRatio || 1) < 1.75 });   // hi-dpi đã đủ nét, tắt MSAA cho nhẹ
const hud = createHud();
const sky = createSky(scene), fx = createEffects(scene), hand = createHand(scene), camFx = newCameraFx();
const icons = createIcons(scene.atlasCanvas); setIconProvider(id => icons.get(id));
const glInfo = (() => { try { const gl = scene.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''; } catch (e) { return ''; } })();
const software = isSoftwareRenderer(glInfo) && params.get('hw') !== '1';
let quality = (software && !store.get('tgk-quality-user') ? 'low' : store.get('tgk-quality')) || defaultPreset({ cores: navigator.hardwareConcurrency || 4, memory: navigator.deviceMemory || 4, software });
let level = presetOf(quality).level, maxLevel = level;
const gov = { slow: 0, fast: 0 }, rawDts = []; let maxRadius = 6, wasOnGround = true, stepDist = 0, digSoundT = 0, loadingPhase = true;
let S = null, game = null, local = null, view = null, ents = null, panels = null;
const dgLeft = {}; let dgLast = null, dgPoll = 0, dgSound = new Map();                       // hầm ngục: số quái còn (từ sự kiện host), hầm đang ở, nhịp bẫy lần trước
let pending = 1, paused = false, wasLocked = false, lastHit = 0, dig = null, digCooldown = 0, lastSel = -1;
const keys = new Set(), mouse = { left: false, right: false };
// Chiến đấu (phía người chơi): chỉ DỰ ĐOÁN để mượt (lăn, giơ khiên, kéo cung); host mới là nguồn sự thật và gửi lại trong snapshot (ps[].act, me).
let guardOn = false, draw = null, rollCdUntil = 0, lastShot = -9, guardRetry = 0, rollK = 0;
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

// Áp một mức cụ thể (tầm nhìn, độ phân giải, mây, hạt).
function applyLevel(i, setRadius = true) {
  level = Math.max(0, Math.min(LEVELS.length - 1, i));
  const L = LEVELS[level];
  if (setRadius && view) { view.setRadius(L.r); maxRadius = LEVELS[maxLevel].r; }
  scene.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, L.pr)); scene.resize();
  sky.clouds.visible = L.clouds; fx.density = L.particles;
}
function applyQuality(key, setRadius = true, user = true) {
  quality = key; store.set('tgk-quality', key); if (user) store.set('tgk-quality-user', '1');
  maxLevel = presetOf(key).level;
  applyLevel(maxLevel, setRadius);
  for (const k of Object.keys(PRESETS)) { const b = $('q-' + k); if (b) b.classList.toggle('on', k === key); }
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
  applyQuality(quality, !params.get('r'), false);
  if (software) hud.toast('Trình duyệt đang vẽ bằng CPU (WebGL phần mềm). Bật tăng tốc phần cứng trong cài đặt trình duyệt để mượt hơn.', 8000);
  ents = createEntityView(scene, { iconCanvas: id => icons.canvas(id), onDeath: (x, y, z, h, boss) => fx.burst(x, y, z, [0.78, 0.78, 0.82], boss ? 40 : 14, boss ? 3.4 : 2) });
  panels = createPanels({ act: a => S.act(a), onClose: () => { if (S && !S.you.dead) lockPointer(); } });
  S.on('ev', handleEvent);
  director.start();
  S.world.onChange = (x, y, z, prev, id) => {            // hạt khi block vỡ hoặc được đặt
    if (Math.hypot(x + 0.5 - local.x, z + 0.5 - local.z) > 24) return;                       // ở xa: không tiếng, không hạt (R-21)
    const sys = b => isCrop(b) || isFarmland(b);
    if (sys(id) && sys(prev)) return;                                                         // cây lớn, đất ướt/khô: thay đổi hệ thống, im lặng
    if (isFarmland(prev) && id === B.DIRT) return;                                            // ruộng bỏ hoang về đất
    if (isCrop(id) && !prev) { sfx.play('sprout'); return; }                                  // gieo
    if ((prev === B.GATE_IRON || prev === B.GATE_BOSS) && id === 0) { sfx.play('gate'); return; }   // cổng hầm mở
    if (prev && BLOCKS[prev] && id === 0) sfx.play('break', { block: prev }); else if (id) sfx.play('place', { block: id });
    if (prev && BLOCKS[prev] && id === 0) fx.burst(x + 0.5, y + 0.5, z + 0.5, BLOCKS[prev].tiles[1], 16);
    else if (id && BLOCKS[id]) fx.burst(x + 0.5, y + 0.5, z + 0.5, BLOCKS[id].tiles[0], 5, 1.2);
  };
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
  'need-key': 'Cần Chìa Hầm để mở cổng này.', 'need-boss-key': 'Cần Chìa Chủ Hầm để mở cổng này.', locked: 'Rương chưa mở được: hãy dọn sạch phòng canh gác trước.',
  bound: 'Chìa gắn với bạn, không cất vào rương được.', 'spike-up': 'Gai đang nhô lên: chờ gai hạ xuống rồi hãy đặt block.',
  missing: 'Bạn không có đủ món này.', full: 'Bạn đang no và đầy máu.', cooldown: 'Ăn chậm thôi.', unripe: 'Cây chưa chín.', 'not-hoe': 'Cần cầm cuốc đất.', 'not-soil': 'Cuốc chỉ cày được đất, cỏ, bùn, rêu.', 'not-seed': 'Cần cầm hạt giống.', 'not-farmland': 'Hạt cần đặt lên đất cày.',
  'not-crop': 'Ở đó không có cây trồng.', 'not-food': 'Con vật không ăn món này.', busy: 'Con vật đang bận.', cap: 'Chuồng đã đầy (24/24).', young: 'Cừu non chưa cắt len được.', sheared: 'Cừu chưa mọc lại len.', 'not-shears': 'Cần cầm kéo.', 'no-target': 'Không có con vật nào ở đó.', 'cannot-craft': 'Chưa đủ nguyên liệu hoặc cần đứng gần bàn chế tạo.', blocked: 'Có vật cản ở đó.', floating: 'Cần đặt cạnh một block khác.', 'too-soon': 'Chưa thể hồi sinh ngay.', far: 'Ở quá xa NPC.' };
// Cập nhật lạc quan cho khách: thấy kết quả ngay, hoàn tác nếu host từ chối (không phải chờ một vòng mạng).
let pendingEdits = [];
function optimistic(x, y, z, id) {
  if (game || !S) return;                                   // host/chơi một mình đã là nguồn sự thật
  const prev = S.world.get(x, y, z);
  if (prev === id) return;
  const now = performance.now();
  pendingEdits = pendingEdits.filter(p => now - p.t < 4000);
  pendingEdits.push({ x, y, z, prev, t: now });
  S.world.set(x, y, z, id);
}
function confirmEdit(x, y, z) { pendingEdits = pendingEdits.filter(p => !(p.x === x && p.y === y && p.z === z)); }
function revertEdit() { const p = pendingEdits.shift(); if (p) S.world.set(p.x, p.y, p.z, p.prev); }

const COMBAT_FAIL = { roll: { tired: 'Hết sức!' }, shoot: { tired: 'Hết sức!', 'no-ammo': 'Hết mũi tên!' } };
function onFail(ev) {
  if (ev.a === 'roll') local.roll = null;                                                  // host từ chối lăn: huỷ phần dự đoán
  if (COMBAT_FAIL[ev.a]) { if (COMBAT_FAIL[ev.a][ev.reason]) hud.toast(COMBAT_FAIL[ev.a][ev.reason], 1400); return; }
  if (ev.a === 'break' || ev.a === 'place') revertEdit();
  if (ev.a === 'break' || ev.a === 'dig') { dig = null; hud.setProgress(null); digCooldown = 0.2; if (ev.reason === 'reach') hud.toast('Ở quá xa.', 800); return; }
  if (FAIL_TEXT[ev.reason]) hud.toast(FAIL_TEXT[ev.reason], 1800);
}

let stationPoll = 0, stationSig = '';
const director = createDirector({ sfx });
let deathTimer = null;
function refreshYou() {
  const y = S.you; if (!y) return;
  hud.setHp(y.hp, y.maxHp); hud.setHotbar(y.inv, y.sel); hud.setFood(y.food); hud.setFx(y.fx);
  if (!y.offhand || y.dead) guardOn = false; if (y.dead) cancelDraw();
  if (y.dead) { if (!deathTimer) { document.exitPointerLock?.(); panels.close(); panels.showDeath(false); deathTimer = setTimeout(() => panels.showDeath(true), 3000); } }
  else if (deathTimer || !$('death').hidden) { clearTimeout(deathTimer); deathTimer = null; panels.hideDeath(); lockPointer(); }
  if (panels.isOpen) panels.refresh({ you: y, near: nearStations(S.world, local.x, local.y, local.z) });
}

function handleEvent(ev) {
  switch (ev.t) {
    case 'you': refreshYou(); break;
    case 'hurt': hud.setHp(ev.hp, S.you.maxHp); if (ev.by !== undefined && ev.by !== null) { hud.flash(); sfx.play('hurt'); camFx.tilt = (Math.random() < 0.5 ? -1 : 1) * 0.1; } break;
    case 'teleport': local.x = ev.x; local.y = ev.y; local.z = ev.z; local.vx = local.vy = local.vz = 0; break;
    case 'kb': local.vx += ev.vx; local.vz += ev.vz; local.vy = Math.max(local.vy, ev.vy); break;
    case 'toast': hud.toast(ev.text); break;
    case 'dialog': document.exitPointerLock?.(); sfx.play('talk'); panels.showDialog(ev); break;
    case 'dialog-end': panels.endDialog(); break;
    case 'shop': document.exitPointerLock?.(); panels.showShop(ev, S.you); break;
    case 'chest': document.exitPointerLock?.(); panels.showChest(ev, { you: S.you, near: nearStations(S.world, local.x, local.y, local.z) }); break;
    case 'quests': hud.setQuests(ev.list); break;
    case 'dungeon': dgLeft[ev.id] = ev.left || 0; break;
    case 'loot': document.exitPointerLock?.(); panels.showLoot(ev); break;
    case 'region': hud.setRegion(ev.name); break;
    case 'swing': { ents.swing('e:' + ev.id); const b = interp.es.find(e => e.id === ev.id); if (b && b.kind === 'boss' && Math.hypot(b.x - local.x, b.z - local.z) < 40) sfx.play('bossSwing'); break; }
    case 'died': if (ev.uid === uid) sfx.play('die'); hud.toast(ev.uid === uid ? 'Bạn đã gục ngã.' : `${ev.name} đã gục ngã.`); break;
    case 'boss-start': sfx.play('boss'); hud.toast(`${ev.name} xuất hiện!`); break;
    case 'boss-defeated': sfx.play('victory'); hud.toast(`${ev.name} đã bị hạ!`, 5000); break;
    case 'snd': if (ev.x !== undefined && Math.hypot(ev.x - local.x, ev.z - local.z) > 40) break; sfx.play(ev.n); break;
    case 'exhausted': hud.toast('Hết sức!', 1400); sfx.play('exhausted'); cancelDraw(); break;
    case 'shield': if (ev.perfect) { hud.shieldFlash('perfect'); sfx.play('parry'); } else if (ev.broke) { hud.shieldFlash('broke'); sfx.play('shieldbreak'); hud.toast('Khiên vỡ!', 1600); guardOn = false; } else sfx.play('shieldhit'); break;
    case 'parry': { const e = interp.es.find(x => x.id === ev.id); if (e) { fx.burst(e.x, e.y + 1, e.z, [1, 0.9, 0.35], 14, 2.6); if (Math.hypot(e.x - local.x, e.z - local.z) < 20) sfx.play('parry'); } break; }
    case 'roll': if (ev.uid !== uid) { const q = interp.ps.find(x => x.uid === ev.uid); if (q && Math.hypot(q.x - local.x, q.z - local.z) < 24) { sfx.play('roll'); fx.burst(q.x, q.y + 0.1, q.z, [0.72, 0.66, 0.52], 8, 1.2); } } break;
    case 'windup': { ents.windup('e:' + ev.id, ev.time); const e = interp.es.find(x => x.id === ev.id); if (e && Math.hypot(e.x - local.x, e.z - local.z) < 14) sfx.play('windup'); break; }
    case 'crit': { const e = interp.es.find(x => x.id === ev.id); if (e) { fx.burst(e.x, e.y + 1, e.z, [1, 0.85, 0.3], 16, 3); if (Math.hypot(e.x - local.x, e.z - local.z) < 20) sfx.play('crit'); } break; }
    case 'born': { const e = interp.es.find(x => x.id === ev.id) || { x: local.x, z: local.z }; if (Math.hypot(e.x - local.x, e.z - local.z) < 24) sfx.play('voice', { type: ev.type, intent: 'idle', dist: Math.hypot(e.x - local.x, e.z - local.z) }); break; }
    case 'pickup': sfx.play('pickup'); hud.toast(`+${ev.n} ${ITEMS[ev.item].name}`, 1200); break;
    case 'fail': onFail(ev); break;
    case 'block': confirmEdit(ev.x, ev.y, ev.z); break;
    case 'hit': { const e = interp.es.find(x => x.id === ev.id); if (e) { fx.burst(e.x, e.y + 0.8, e.z, [0.9, 0.12, 0.1], 8, 2.2); const d = Math.hypot(e.x - local.x, e.z - local.z); if (d < 20) sfx.play('hit'); if (e.kind === 'mob' || e.kind === 'boss') director.hurt({ type: e.type, kind: e.kind, dist: d }); } break; }
    case 'telegraph': { const b = interp.es.find(e => e.id === ev.id); ents.telegraph(ev.x, b ? b.y : local.y, ev.z, ev.r, ev.time); if (Math.hypot(ev.x - local.x, ev.z - local.z) < 40) sfx.play('warn'); break; }
  }
}

// ---------------------------------------------------------------- điều khiển
const inUi = () => !S || panels.isOpen || paused || S.you.dead || !$('menu').hidden;
function lockPointer() { if (!debugOn() || NET !== 'memory') { try { const r = $('cv').requestPointerLock?.(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* không khoá được: bỏ qua */ } } }
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (!S) return;
  if (e.code === 'KeyM') { toggleMusic(); return; }
  if (e.code === 'F3') { e.preventDefault(); const d = $('debug'); d.hidden = !d.hidden; return; }
  if (e.code === 'Escape') { if (panels.isOpen) panels.close(); else if (!paused && !S.you.dead) setPause(true); else if (paused) setPause(false); return; }
  if (inUi() && e.code !== 'KeyE') return;
  if (e.code === 'KeyE') { if (panels.kind === 'inventory') panels.close(); else if (!inUi()) { document.exitPointerLock?.(); panels.openInventory({ you: S.you, near: nearStations(S.world, local.x, local.y, local.z) }); } return; }
  if (e.code === 'KeyQ') { if (!e.repeat) startRoll(); return; }
  if (e.code === 'KeyF') { if (!e.repeat) startGuard(); return; }
  const m = /^Digit([1-9])$/.exec(e.code);
  if (m) S.act({ t: 'sel', i: Number(m[1]) - 1 });
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'KeyF' && !mouse.right) stopGuard(); });
addEventListener('blur', () => { cancelDraw(); stopGuard(); keys.clear(); mouse.left = false; mouse.right = false; dig = null; hud.setProgress(null); });
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
  if (e.button === 0) { mouse.left = true; } else if (e.button === 2) { if (!useItem()) { mouse.right = true; startGuard(); } }      // chuột phải: việc khác trước, không có việc thì giơ khiên
});
addEventListener('mouseup', e => { if (e.button === 0) { mouse.left = false; dig = null; hud.setProgress(null); } else if (e.button === 2) { mouse.right = false; if (!keys.has('KeyF')) stopGuard(); } });
addEventListener('contextmenu', e => e.preventDefault());

function setPause(on) {
  paused = on; if (S && S.pause) S.pause(on); $('pause').hidden = !on; $('btn-save').hidden = $('btn-export').hidden = !game;
  if (on) { cancelDraw(); stopGuard(); document.exitPointerLock?.(); mouse.left = false; mouse.right = false; dig = null; hud.setProgress(null); } else lockPointer();
}
$('btn-resume').onclick = () => setPause(false);
let musicBeforeMute = 60;
function toggleMusic() {
  if (SETTINGS.music > 0) { musicBeforeMute = SETTINGS.music; SETTINGS.music = 0; } else SETTINGS.music = musicBeforeMute || 60;
  saveSettings(); $('vol-music').value = SETTINGS.music; hud.toast(SETTINGS.music ? 'Bật nhạc nền.' : 'Tắt nhạc nền (M để bật lại).', 1500);
}
for (const k of ['music', 'sfx']) { const el = $('vol-' + k); el.value = SETTINGS[k]; el.oninput = () => { SETTINGS[k] = Number(el.value); saveSettings(); if (k === 'sfx') sfx.play('click'); }; }
for (const k of Object.keys(PRESETS)) $('q-' + k).onclick = () => { applyQuality(k); rawDts.length = 0; };
$('btn-save').onclick = async () => { await saveWorld('main', game.toSave()); $('pause-msg').textContent = 'Đã lưu.'; };
$('btn-export').onclick = async () => {
  const blob = await exportWorld(game.toSave()), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'the-gioi-khoi.gz'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('btn-leave').onclick = async () => { if (game) await saveWorld('main', game.toSave()).catch(() => {}); S.leave(); location.reload(); };
$('btn-respawn').onclick = () => S.act({ t: 'respawn' });

function inputNow() {
  const i = { fx: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), fz: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    jump: keys.has('Space'), sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'), sneak: keys.has('KeyC') };
  const m = meState();
  if (guardOn || draw) { i.sprint = false; i.slow = SLOW_MUL; }                              // giơ khiên / kéo cung: đi chậm, không chạy nước rút
  if (m.sta < 1 || m.exh > 0 || local.roll) i.sprint = false;                                // hết sức: không chạy (host tiêu thể lực cùng hằng số)
  return i;
}

// ---------------------------------------------------------------- chiến đấu
const meState = () => { const m = S && S.snap && S.snap.me; return { sta: m ? m.sta : 100, exh: m ? m.exh : 0, cmb: m ? m.cmb : 0, stn: m ? m.stn || 0 : 0 }; };
const heldItem = () => { const id = S && S.you ? heldId() : null; return id ? ITEMS[id] : null; };
const arrowCount = () => S.you.inv.reduce((n, s) => n + (s && s.id === 'arrow' ? s.n : 0), 0);
function startRoll() {
  if (!S || inUi() || local.roll) return;
  const m = meState();
  if (nowS < rollCdUntil || m.exh > 0 || m.sta < ROLL_COST || m.stn > 0) return;
  const i = inputNow(); let fx = i.fx, fz = i.fz; if (!fx && !fz) fz = 1;                       // không bấm hướng: lăn về phía trước
  const len = Math.hypot(fx, fz); fx /= len; fz /= len;
  const sp = ROLL_DIST / ROLL_TIME, c = Math.cos(local.yaw), s = Math.sin(local.yaw);
  local.roll = { t: 0, vx: (c * fx - s * fz) * sp, vz: (-s * fx - c * fz) * sp, side: fx >= 0 ? 1 : -1 };
  rollCdUntil = nowS + ROLL_CD; guardOn = false; cancelDraw(); dig = null; hud.setProgress(null);
  S.act({ t: 'roll', dx: fx, dz: fz }); sfx.play('roll');
}
function startGuard() {
  if (!S || inUi() || guardOn || !S.you.offhand || local.roll) return;
  const h = heldItem(); if (h && (h.food > 0 || h.heal > 0)) return;
  guardOn = true; cancelDraw(); dig = null; hud.setProgress(null); S.act({ t: 'guard', on: true });
}
function stopGuard() { if (guardOn) { guardOn = false; if (S) S.act({ t: 'guard', on: false }); } }
function cancelDraw() { if (draw) { draw = null; if (S) S.act({ t: 'draw', on: false }); hud.setDraw(null, null); } }
// Cung: giữ chuột trái để kéo, thả để bắn (host đo lực kéo bằng đồng hồ của nó). Vòng kéo HUD chỉ để hiển thị.
function bowTick(h, now) {
  const m = meState();
  if (mouse.left && !draw && !guardOn && !local.roll && m.exh <= 0 && m.stn <= 0 && now - lastShot > BOW_CD) { draw = { t0: now, id: heldId() }; S.act({ t: 'draw', on: true }); sfx.play('bowdraw'); }
  else if (draw && !mouse.left) { S.act({ t: 'shoot', yaw: local.yaw, pitch: local.pitch }); lastShot = now; hand.swing(); draw = null; }
  hud.setDraw(draw ? drawForce(h.bow, now - draw.t0) : null, arrowCount());
}

// ---------------------------------------------------------------- nhắm và tương tác
const eyeOf = () => ({ x: local.x, y: local.y + 1.62, z: local.z });
const dirOf = () => ({ x: -Math.sin(local.yaw) * Math.cos(local.pitch), y: Math.sin(local.pitch), z: -Math.cos(local.yaw) * Math.cos(local.pitch) });
const sizeOf = e => (e.kind === 'mob' ? (e.ba ? { w: MOBS[e.type].w * 0.5, h: MOBS[e.type].h * 0.5 } : MOBS[e.type]) : e.kind === 'boss' ? BOSSES[e.type] : e.kind === 'npc' ? { w: 0.7, h: 1.9 } : null);

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

const USABLE = {
  [B.DOOR]: p => ({ t: 'toggle', ...p }), [B.DOOR_OPEN]: p => ({ t: 'toggle', ...p }),
  [B.CHEST]: p => ({ t: 'chest-open', ...p }), [B.BED]: p => ({ t: 'sleep', ...p }),
  [B.GATE_IRON]: p => ({ t: 'gate', ...p }), [B.GATE_BOSS]: p => ({ t: 'gate', ...p }), [B.DCHEST]: p => ({ t: 'dchest', ...p }),      // hầm ngục: cổng cần chìa, rương thưởng
};

const SOIL_IDS = new Set(SOIL.map(n => BLOCK_BY_NAME[n].id));
const isHoe = h => !!(h && h.tool && h.tool.type === 'hoe');
// Ô đất có thể cày mà con trỏ đang chỉ vào (mặt trên của đất/cỏ/bùn/rêu; hoặc cỏ cao phía trên chúng), hoặc null.
function soilTarget(blk) {
  if (!blk || blk.normal.y !== 1 && !(isPlant(blk.id) && !BLOCKS[blk.id].deco)) return null;
  if (SOIL_IDS.has(blk.id)) return blk.pos;
  if (isPlant(blk.id) && !BLOCKS[blk.id].deco && SOIL_IDS.has(S.world.get(blk.pos.x, blk.pos.y - 1, blk.pos.z))) return { x: blk.pos.x, y: blk.pos.y - 1, z: blk.pos.z };
  return null;
}

// Chuột phải. Thứ tự ưu tiên: NPC -> thú (cho ăn / cắt len) -> block dùng được (cửa, rương, giường) -> cây (thu hoạch) -> cuốc lên đất -> hạt lên ruộng -> đặt block -> ăn.
// Trả true nếu đã làm gì đó.
function useItem() {
  const o = eyeOf(), d = dirOf(), blk = S.world.raycast(o, d, 6), en = pickEntity(o, d, 5), near = en && (!blk || en.t < blk.dist);
  if (near && en.e.kind === 'npc') { S.act({ t: 'interact', id: en.e.id }); return true; }
  const hid = heldId(), h = hid && ITEMS[hid];
  if (near && en.e.kind === 'mob' && MOBS[en.e.type].farm && h) {
    const md = MOBS[en.e.type];
    if (hid === 'shears' && md.product && md.product.regrow) { S.act({ t: 'shear', id: en.e.id }); hand.swing(); return true; }
    if (hid === md.breed.food) { S.act({ t: 'feed', id: en.e.id }); hand.swing(); return true; }
  }
  if (blk && !keys.has('KeyC') && USABLE[blk.id]) { S.act(USABLE[blk.id](blk.pos)); hand.swing(); return true; }      // cửa, rương, giường (giữ C để đặt block cạnh chúng)
  if (blk && isCrop(blk.id)) {
    if (cropOf(blk.id).stage === 3) { S.act({ t: 'harvest', ...blk.pos }); hand.swing(); return true; }
    if (!(h && h.block)) { hud.toast('Cây chưa chín.', 1200); return true; }
  }
  if (isHoe(h) && blk) { const t = soilTarget(blk); if (t) { S.act({ t: 'till', ...t }); hand.swing(); return true; } hud.toast(FAIL_TEXT['not-soil'], 1400); return true; }
  if (h && h.plant) {
    if (blk && isFarmland(blk.id) && blk.normal.y === 1) { S.act({ t: 'plant', ...blk.pos }); hand.swing(); return true; }
    if (!(h.food || h.heal)) { hud.toast(FAIL_TEXT['not-farmland'], 1400); return true; }          // hạt lúa mì không ăn được: nhắc gieo lên đất cày
  }
  if (h && h.block && blk) {
    const px = blk.pos.x + blk.normal.x, py = blk.pos.y + blk.normal.y, pz = blk.pos.z + blk.normal.z;
    S.act({ t: 'place', x: px, y: py, z: pz }); hand.swing();
    optimistic(px, py, pz, BLOCK_BY_NAME[h.block].id); return true;
  }
  if (h && (h.heal || h.food)) { S.act({ t: 'use' }); return true; }
  return false;
}

// Chú giải khi ngắm: cây (loại, giai đoạn, độ ẩm), ruộng/đất khi cầm hạt/cuốc, thú nuôi (đã thuần, đang yêu, non, đã cắt len).
function tipFor(blk, en) {
  const hid = S.you.inv[S.you.sel] ? S.you.inv[S.you.sel].id : null, h = hid && ITEMS[hid];
  if (en && (!blk || en.t < blk.dist) && en.e.kind === 'mob' && MOBS[en.e.type].farm) {
    const e = en.e, d = MOBS[e.type], parts = [d.name];
    if (e.tm) parts.push('đã thuần'); else if (h && hid === d.breed.food) parts.push('bấm phải để thuần hoá');
    if (e.lv) parts.push('♥ đang yêu'); if (e.ba) parts.push('non'); if (e.sh) parts.push('đã cắt len');
    return parts.join(' · ');
  }
  if (!blk) return null;
  const c = cropOf(blk.id);
  if (c) {
    const wet = S.world.get(blk.pos.x, blk.pos.y - 1, blk.pos.z) === B.FARMLAND_WET;
    return `${CROPS[c.kind].name} · giai đoạn ${c.stage + 1}/4 · đất ${wet ? 'ướt' : 'khô'}${c.stage === 3 ? ' · chín (bấm phải để thu hoạch)' : ''}`;
  }
  if (isFarmland(blk.id) && blk.normal.y === 1 && h && h.plant) return 'Bấm phải để gieo';
  if (isHoe(h) && soilTarget(blk)) return 'Bấm phải để cày';
  return null;
}

function mining(dt, now) {
  const hd = heldItem(), w = weaponOf(hd);
  const o = eyeOf(), d = dirOf(), blk = S.world.raycast(o, d, 6), en = pickEntity(o, d, w.reach);
  const progNow = dig && blk && dig.x === blk.pos.x && dig.y === blk.pos.y && dig.z === blk.pos.z ? Math.min(1, (now - dig.t0) / Math.max(0.05, breakTimeFor(blk.id, heldId()))) : null;
  fx.setTarget(blk && !(en && (!blk || en.t < blk.dist)) ? blk.pos : null, mouse.left ? progNow : null);
  hud.setTip(tipFor(blk, en));
  if (hd && hd.bow) { dig = null; hud.setProgress(null); bowTick(hd, now); return; }          // cầm cung: chuột trái kéo cung, không đào hay đánh
  if (draw) cancelDraw();
  if (!mouse.left) return;
  if (guardOn) return;                                                                         // đang giơ khiên: không đánh, không đào
  if (en && (en.e.kind === 'mob' || en.e.kind === 'boss') && (!blk || en.t < blk.dist)) {
    dig = null; hud.setProgress(null);
    const m = meState();
    if (now - lastHit > w.cd && m.exh <= 0 && m.stn <= 0 && !local.roll) { lastHit = now; S.act({ t: 'hit', id: en.e.id }); hand.swing(); sfx.play('swing'); }
    return;
  }
  if (!blk) { dig = null; hud.setProgress(null); return; }
  digCooldown -= dt; digSoundT -= dt;
  if (digCooldown > 0) return;
  const need = breakTimeFor(blk.id, heldId());
  if (need === Infinity) { dig = null; hud.setProgress(null); return; }
  if (digSoundT <= 0) { digSoundT = 0.24; sfx.play('dig', { block: blk.id }); hand.swing(); }
  if (!dig || dig.x !== blk.pos.x || dig.y !== blk.pos.y || dig.z !== blk.pos.z) { dig = { ...blk.pos, t0: now }; S.act({ t: 'dig', ...blk.pos }); }
  const prog = (now - dig.t0) / need;
  hud.setProgress(prog);
  if (prog >= 1) { S.act({ t: 'break', x: dig.x, y: dig.y, z: dig.z }); optimistic(dig.x, dig.y, dig.z, 0); dig = null; digCooldown = 0.12; hud.setProgress(null); }
}

// ---------------------------------------------------------------- hầm ngục (HUD, biểu ngữ, gợi ý hướng, âm báo bẫy)
function dungeonHud() {
  const hit = dungeonAt(S.flags, local.x, local.y + 0.5, local.z);
  if (hit) {
    if (hit.id !== dgLast) { dgLast = hit.id; hud.showBanner(DUNGEONS[hit.id].name); }
    const keys = {}; for (const id of ['dungeon_key', 'boss_key']) keys[id] = S.you.inv.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0);
    hud.setDungeon({ name: DUNGEONS[hit.id].name, room: ROOM_NO[hit.room] || 1, left: dgLeft[hit.id] || 0, keys }); hud.setHint(null);
    return;
  }
  dgLast = null; hud.setDungeon(null);
  const ds = S.flags.sites && S.flags.sites.dungeon; let best = null, bd = 80.0001;           // gợi ý hướng: miệng hầm gần nhất trong 80 block mà chủ hầm chưa bị hạ
  for (const [id, s] of Object.entries(ds || {})) { if (!DUNGEONS[id] || S.flags['boss:' + DUNGEONS[id].boss]) continue; const d = Math.hypot(s.x - local.x, s.z - local.z); if (d < bd) { bd = d; best = s; } }
  hud.setHint(best ? `Miệng hầm: ${compass(local.x, local.z, best.x, best.z)} ${Math.round(bd)} m` : null);
}
// Âm báo bẫy gần người chơi: gai báo hiệu / nhô lên, ống phun báo hiệu / phun (phát khi trạng thái đổi).
function trapSounds(list) {
  const seen = new Set();
  for (const o of list) {
    if (Math.abs(o.x - local.x) > 12 || Math.abs(o.z - local.z) > 12) continue;
    const key = o.k + ':' + o.off; if (seen.has(key)) continue; seen.add(key);
    const last = dgSound.get(key); dgSound.set(key, o.s);
    if (last === undefined || last === o.s) continue;
    if (o.s === 'warn') sfx.play('warn'); else if (o.s === 'up') sfx.play('spikes'); else if (o.s === 'spray') sfx.play('vent');
  }
  if (!seen.size && dgSound.size) dgSound.clear();
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

let last = performance.now(), nowS = 0, lastVy = 0, dbgT = 0, sneakK = 0;
function debugText() {
  const i = scene.renderer.info, avg = rawDts.length ? rawDts.reduce((a, b) => a + b, 0) / rawDts.length * 1000 : 0;
  return [`FPS ${avg ? (1000 / avg).toFixed(0) : '-'}  (khung ${avg.toFixed(1)} ms, JS ${perf.n ? (perf.sum / perf.n).toFixed(1) : '-'} ms)`,
    `XYZ ${local.x.toFixed(1)} ${local.y.toFixed(1)} ${local.z.toFixed(1)}  vùng ${S.world.regionAt(local.x, local.z)}`,
    `Chunk mesh ${scene.chunkCount()}  tầm nhìn ${view.radius}  mức ${level}/${maxLevel} (${quality})  độ phân giải ${scene.renderer.getPixelRatio()}  chờ ${pending}`,
    `Renderer ${glInfo || '?'}${software ? '  [PHẦN MỀM]' : ''}`,
    `Tam giác ${i.render.triangles}  lệnh vẽ ${i.render.calls}  hạt ${fx.particleCount}  thực thể ${ents.count()}`,
    S.room ? `Mạng: ${S.room.players.length} người` : 'Chơi một mình'].join('\n');
}
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
  const y = S.you, ui = inUi(), me = meState(), stunned = me.stn > 0;
  if (ui && (guardOn || draw)) { stopGuard(); cancelDraw(); }
  if (y.dead || stunned) local.roll = null;
  if (local.roll) { local.roll.t += dt; if (local.roll.t >= ROLL_TIME) local.roll = null; }
  if (!ui && !guardOn && !stunned && !local.roll && y.offhand && (mouse.right || keys.has('KeyF')) && nowS > guardRetry) { guardRetry = nowS + 0.3; startGuard(); }      // giữ nút mà khiên bị hạ (choáng, lăn): giơ lại khi được
  const inp = ui || stunned ? {} : inputNow();                                                // choáng: bỏ input di chuyển
  if (!y.dead) stepPlayer(S.world, local, local.roll ? { ...inp, jump: false, roll: local.roll } : inp, dt);
  const hs = Math.hypot(local.vx, local.vz), moving = !y.dead && hs > 0.8 && (inp.fx || inp.fz);
  S.sendState({ x: local.x, y: local.y, z: local.z, vx: local.vx, vy: local.vy, vz: local.vz, yaw: local.yaw, pitch: local.pitch, sneak: !!inp.sneak, sprint: !!(inp.sprint && moving && !inp.sneak) });
  sneakK += ((inp.sneak ? 1 : 0) - sneakK) * Math.min(1, dt * 12); $('sneak').hidden = !inp.sneak;
  stepCameraFx(camFx, dt, { moving, sprint: !!inp.sprint, onGround: local.onGround, speed: hs, rolling: local.roll ? local.roll.side : 0 });
  const bobY = Math.abs(Math.sin(camFx.bob)) * 0.05 * camFx.bobAmp;
  if (Math.abs(scene.camera.fov - camFx.fov) > 0.05) { scene.camera.fov = camFx.fov; scene.camera.updateProjectionMatrix(); }
  scene.camera.position.set(local.x, local.y + 1.62 - bobY - sneakK * 0.3 - camFx.roll * 0.55, local.z);       // lăn: hạ thấp camera
  scene.camera.rotation.set(local.pitch + camFx.roll * 0.25, local.yaw, camFx.tilt + Math.sin(camFx.bob) * 0.006 * camFx.bobAmp + camFx.roll * 0.3 * camFx.rollSide);
  if (moving && local.onGround) { stepDist += hs * dt; if (stepDist > 2.1) { stepDist = 0; sfx.play('step', { block: S.world.get(local.x, local.y - 0.5, local.z) }); } }
  if (local.onGround && !wasOnGround && local.vy > -1 && lastVy < -9) sfx.play('land');
  wasOnGround = local.onGround; lastVy = local.vy;
  const hd = heldItem(), w = weaponOf(hd);
  hand.setHeld(heldId(), heldId() ? icons.get(heldId()) : null); hand.setOff(y.offhand, y.offhand ? icons.get(y.offhand) : null);
  hand.setPose({ guard: guardOn, draw: draw && hd && hd.bow ? drawForce(hd.bow, nowS - draw.t0) : 0 }); hand.update(dt, camFx.bob, camFx.bobAmp);
  hud.setStamina(me); hud.setCombo(me.cmb, !!hd && w.cls === 'sword'); hud.setShield(guardOn, !!y.offhand);
  if (!(hd && hd.bow) || ui) hud.setDraw(null, hd && hd.bow ? arrowCount() : null);
  if (!ui) mining(dt, nowS); else { fx.setTarget(null); hud.setTip(null); }
  const keep = game ? [...game.players.values()].filter(p => p.uid !== uid && !p.dead).map(p => ({ x: p.x, z: p.z, r: 4 })) : [];
  pending = view.update([local], undefined, keep);
  interpolate(performance.now());
  const list = [];
  for (const p of interp.ps) if (p.uid !== uid && !p.dead) list.push({ key: 'p:' + p.uid, kind: 'player', ...p });
  for (const e of interp.es) list.push({ key: 'e:' + e.id, ...e });
  ents.update(list, nowS, dt, [...interp.ps.filter(p => p.uid !== uid), { x: local.x, z: local.z }], scene.camera.position);
  const boss = interp.es.filter(e => e.kind === 'boss').sort((a, b) => Math.hypot(a.x - local.x, a.z - local.z) - Math.hypot(b.x - local.x, b.z - local.z))[0];
  hud.setBoss(boss && Math.hypot(boss.x - local.x, boss.z - local.z) < 70 ? { name: BOSSES[boss.type].name, hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase } : null);
  dgPoll -= dt; if (dgPoll <= 0) { dgPoll = 0.25; dungeonHud(); }
  { const tv = trapView(S.flags, S.world, S.time, local, 40); fx.setTraps(tv, nowS); trapSounds(tv); }
  const r = regionById(S.world.regionAt(local.x, local.z));
  const light = lightLevel(S.time);
  scene.setEnvironment({ sky: r.sky, fog: r.fog, light }); ents.setLight(light);
  const mobs = []; for (const e of interp.es) if (e.kind === 'mob') mobs.push({ id: e.id, type: e.type, st: e.st || 0, hp: e.hp, dist: Math.hypot(e.x - local.x, e.z - local.z) });
  stationPoll -= dt;                                                // đang mở kho đồ: cập nhật bàn/lò/đe ở gần khi người chơi đi hoặc đặt block
  if (stationPoll <= 0 && panels.isOpen && (panels.kind === 'inventory' || panels.kind === 'chest')) {
    stationPoll = 0.4; const near = nearStations(S.world, local.x, local.y, local.z), sig = JSON.stringify(near);
    if (sig !== stationSig) { stationSig = sig; panels.refresh({ you: S.you, near }); }
  }
  director.update(dt, { region: r.id, night: light < 0.6, boss: !!(boss && boss.hp > 0 && Math.hypot(boss.x - local.x, boss.z - local.z) < 45), mobs });
  const far = view.radius * 16 - 6; scene.setFog(far * 0.5, far);
  const eyeWater = S.world.get(local.x, local.y + 1.62, local.z) === B.WATER;
  $('water').hidden = !eyeWater; if (eyeWater) scene.setFog(0.5, 22);
  if (loadingPhase) { if (pending <= 8) { loadingPhase = false; $('loading').hidden = true; } else $('loading').hidden = false; }
  sky.update(scene.camera.position, S.time, light, r.sky, r.fog);
  fx.update(dt);
  scene.render();
  if (!$('debug').hidden) { dbgT -= dt; if (dbgT <= 0) { dbgT = 0.25; $('debug').textContent = debugText(); } }
}

function loop(now) {
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
  if (S && (!debugOn() || params.get('gov') === '1')) {              // tự hạ/nâng mức chất lượng theo độ mượt thực tế
    rawDts.push(raw); if (rawDts.length > 40) rawDts.shift();
    const avg = rawDts.reduce((a, b) => a + b, 0) / rawDts.length * 1000, nl = rawDts.length >= 20 ? governLevel(gov, level, maxLevel, avg, raw) : level;
    if (nl !== level) { applyLevel(nl); rawDts.length = 0; }
  }
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
    optimistic, handleEvent, get pendingEdits() { return pendingEdits; }, applyQuality, get quality() { return quality; }, get level() { return level; }, get software() { return software; }, applyLevel, glInfo,
    get pending() { return pending; }, perf, sky, fx, hand, camFx, sfx, icons, gov, get interp() { return interp; }, mouse, keys, director,
    renderNow: () => frame(0.0001),
    lookAt(x, y, z) { const dx = x - local.x, dy = y - (local.y + 1.62), dz = z - local.z; local.yaw = Math.atan2(-dx, -dz); local.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
  };
}
