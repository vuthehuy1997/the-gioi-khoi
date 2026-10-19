// Vật lý hộp (AABB) so với lưới block. Không phụ thuộc DOM hay mạng.
import { B, isSolid } from '../world/blocks.js';

export const GRAVITY = 25, JUMP_V = 7.8, WALK = 4.3, SPRINT = 5.6, SNEAK = 1.7;

export function makeBody(x, y, z, w = 0.6, h = 1.8) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, w, h, onGround: false, inWater: false };
}
export function makePlayer(x, y, z) { const p = makeBody(x, y, z); p.yaw = 0; p.pitch = 0; return p; }

const EPS = 1e-6;

export function collides(world, b) {
  const hw = b.w / 2;
  const x0 = Math.floor(b.x - hw), x1 = Math.floor(b.x + hw - EPS);
  const z0 = Math.floor(b.z - hw), z1 = Math.floor(b.z + hw - EPS);
  const y0 = Math.floor(b.y), y1 = Math.floor(b.y + b.h - EPS);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (isSolid(world.get(x, y, z))) return true;
  return false;
}

// Dời thân theo một trục, chia nhỏ để không xuyên tường, rồi chia đôi để sát mặt block. Trả true nếu bị chặn.
function moveAxis(world, b, axis, d) {
  if (d === 0) return false;
  const steps = Math.ceil(Math.abs(d) / 0.25), sd = d / steps;
  for (let i = 0; i < steps; i++) {
    const p0 = b[axis];
    b[axis] = p0 + sd;
    if (collides(world, b)) {
      let lo = 0, hi = 1;
      for (let k = 0; k < 10; k++) { const mid = (lo + hi) / 2; b[axis] = p0 + sd * mid; if (collides(world, b)) hi = mid; else lo = mid; }
      b[axis] = p0 + sd * lo;
      return true;
    }
  }
  return false;
}

export function moveBody(world, b, dt) {
  if (collides(world, b)) { for (let i = 0; i < 4 && collides(world, b); i++) b.y += 1; }   // đang kẹt trong block: đẩy lên
  if (moveAxis(world, b, 'x', b.vx * dt)) b.vx = 0;
  if (moveAxis(world, b, 'z', b.vz * dt)) b.vz = 0;
  b.onGround = false;
  if (moveAxis(world, b, 'y', b.vy * dt)) { if (b.vy < 0) b.onGround = true; b.vy = 0; }
}

// input: { fx: ngang (+1 sang phải), fz: dọc (+1 tiến), jump, sprint }; yaw = 0 là hướng -z.
export function stepPlayer(world, p, input, dt) {
  const water = world.get(p.x, p.y + 0.4, p.z) === B.WATER;
  p.inWater = water;
  let fx = input.fx || 0, fz = input.fz || 0;
  const len = Math.hypot(fx, fz);
  if (len > 1) { fx /= len; fz /= len; }
  const speed = (input.sneak ? SNEAK : input.sprint ? SPRINT : WALK) * (water ? 0.6 : 1);
  const s = Math.sin(p.yaw || 0), c = Math.cos(p.yaw || 0);
  const tvx = (c * fx - s * fz) * speed, tvz = (-s * fx - c * fz) * speed;
  const acc = (p.onGround ? 60 : 14) * dt;
  p.vx += Math.max(-acc, Math.min(acc, tvx - p.vx));
  p.vz += Math.max(-acc, Math.min(acc, tvz - p.vz));
  p.vy -= (water ? 6 : GRAVITY) * dt;
  p.vy = Math.max(water ? -3 : -50, p.vy);
  if (input.jump) {
    if (water) p.vy = 3.2;
    else if (p.onGround) p.vy = JUMP_V;
  }
  moveBody(world, p, dt);
  return p;
}
