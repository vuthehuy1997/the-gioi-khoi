// Worker: giữ một bản World riêng (seed + delta + các lần sửa), sinh chunk và dựng mesh ngoài luồng chính.
// Tin nhắn vào: init {seed, delta} | set {x,y,z,id} | mesh {cx,cz,rid,needData,center}. Tin ra: mesh {cx,cz,rid,mesh,chunk?}.
import { World } from '../world/world.js';
import { meshChunk, transferables } from './mesher.js';

let world = null;

onmessage = (e) => {
  const m = e.data;
  if (m.t === 'init') { world = new World(m.seed); world.importDelta(m.delta || {}); }
  else if (m.t === 'set') world.set(m.x, m.y, m.z, m.id);
  else if (m.t === 'mesh') {
    const mesh = meshChunk(world, m.cx, m.cz);
    const out = { t: 'mesh', cx: m.cx, cz: m.cz, rid: m.rid, mesh };
    const tr = transferables(mesh);
    if (m.needData) { const copy = world.chunk(m.cx, m.cz).slice(); out.chunk = copy; tr.push(copy.buffer); }
    postMessage(out, tr);
    world.dirty.clear();
    if (world.chunks.size > 700) world.keepAround([{ x: m.cx * 16, z: m.cz * 16 }], 12, [], false);   // giữ bộ nhớ worker gọn
  }
};
