// Quy tắc dùng chung giữa host (xác nhận) và giao diện (dự đoán thời gian đào, kiểm tra chế tạo).
import { BLOCKS, B } from '../world/blocks.js';
import { ITEMS } from '../content/items.js';

// Giây đào block `blockId` bằng vật phẩm `heldId` (hoặc tay không).
export function breakTimeFor(blockId, heldId) {
  const def = BLOCKS[blockId];
  if (!def || def.hardness < 0) return Infinity;
  const h = heldId ? ITEMS[heldId] : null;
  const speed = h && h.tool && h.tool.type === def.tool ? h.tool.speed : 1;
  return def.hardness / speed;
}

export function canHarvest(blockId, heldId) {
  const def = BLOCKS[blockId], h = heldId ? ITEMS[heldId] : null;
  return def.tier === 0 || !!(h && h.tool && h.tool.type === def.tool && h.tool.tier >= def.tier);
}

// Có bàn chế tạo trong vòng 4 block ngang, ±2 dọc quanh vị trí (x, y, z).
export function nearBench(world, x, y, z) {
  for (let dy = -2; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    if (world.get(Math.floor(x) + dx, Math.floor(y) + dy, Math.floor(z) + dz) === B.WORKBENCH) return true;
  }
  return false;
}
