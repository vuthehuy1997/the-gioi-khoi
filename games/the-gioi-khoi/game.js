// Trang game: chọn chế độ (một mình / tạo phòng / vào phòng), vòng lặp, điều khiển, hiển thị.
import { $, clamp } from '../../platform/core/util.js';
import { debugOn, exposeGlobals } from '../../platform/core/debug.js';
import { mountHomeLink } from '../../platform/ui/bar.js';
import { World } from './world/world.js';
import { makePlayer, stepPlayer } from './sim/physics.js';
import { createScene } from './render/scene.js';
import { ChunkView } from './render/chunkview.js';
import { regionById } from './world/regions.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || 20261016;
const scene = createScene($('cv'));
const world = new World(seed);
const view = new ChunkView(world, scene, { radius: Number(params.get('r')) || 6 });
const sp = world.findSpawn();
const player = makePlayer(sp.x + 0.5, world.surfaceY(sp.x, sp.z) + 1, sp.z + 0.5);
player.yaw = 0; player.pitch = -0.15;
const keys = new Set();
let pending = 1;

addEventListener('keydown', e => { if (e.target.tagName !== 'INPUT') keys.add(e.code); });
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== $('cv')) return;
  player.yaw -= e.movementX * 0.0025; player.pitch = clamp(player.pitch - e.movementY * 0.0025, -1.55, 1.55);
});

function inputNow() {
  return {
    fx: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), fz: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    jump: keys.has('Space'), sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}

function frame(dt) {
  stepPlayer(world, player, inputNow(), dt);
  scene.camera.position.set(player.x, player.y + 1.62, player.z);
  scene.camera.rotation.set(player.pitch, player.yaw, 0);
  pending = view.update([player]);
  const r = regionById(world.regionAt(player.x, player.z));
  scene.setEnvironment({ sky: r.sky, fog: r.fog, light: 1 });
  scene.render();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  frame(dt);
  requestAnimationFrame(loop);
}

function resize() { $('cv').width = innerWidth; $('cv').height = innerHeight; scene.resize(); }
addEventListener('resize', resize); resize();
$('btn-solo').onclick = () => { $('menu').hidden = true; $('hud').hidden = false; $('cv').requestPointerLock?.(); };
$('cv').addEventListener('click', () => { if ($('menu').hidden) $('cv').requestPointerLock?.(); });
mountHomeLink($('stage'));
requestAnimationFrame(loop);

if (debugOn()) exposeGlobals([{ world, player, view, scene, get pending() { return pending; }, renderNow: () => { frame(0.0001); } }]);
