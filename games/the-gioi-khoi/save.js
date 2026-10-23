// Lưu thế giới vào IndexedDB, xuất/nhập file nén (.gz), kiểm tra phiên bản dữ liệu.
import { idbGet, idbSet, idbDel, idbKeys } from '../../platform/core/idb.js';

import { SAVE_VERSION } from './sim/version.js';
export { SAVE_VERSION };
const KEY = n => 'tgk-world:' + n;

export function checkVersion(save) {
  if (!save || typeof save !== 'object' || typeof save.v !== 'number' || typeof save.seed !== 'number') throw new Error('bad-file');
  if (save.v > SAVE_VERSION) throw new Error('newer-version');
  if (save.v < 2) upgradeV1(save);
  return save;
}

// v1 -> v2: thêm cây trồng, ruộng, thú nuôi và trạng thái đói của người chơi (đầy bụng, không hiệu ứng). Trường thiếu luôn có mặc định khi nạp (Game.fromSave) nên hàm này chỉ điền cho gọn.
function upgradeV1(save) {
  save.crops = save.crops || {}; save.farm = save.farm || {}; save.animals = save.animals || [];
  for (const p of Object.values(save.players || {})) if (p && typeof p === 'object') { p.food = p.food ?? 20; p.fatigue = p.fatigue ?? 0; p.fx = p.fx || {}; p.poison = p.poison ?? 0; }
  save.v = 2;
}

export async function saveWorld(name, save) { await idbSet(KEY(name), { name, savedAt: Date.now(), save }); }
export async function loadWorld(name) { const r = await idbGet(KEY(name)); return r ? checkVersion(r.save) : null; }
export async function deleteWorld(name) { await idbDel(KEY(name)); }
export async function listWorlds() {
  const keys = (await idbKeys()).filter(k => String(k).startsWith('tgk-world:'));
  const out = [];
  for (const k of keys) { const r = await idbGet(k); if (r) out.push({ name: r.name, savedAt: r.savedAt, seed: r.save.seed }); }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export async function exportWorld(save) {
  const json = new Blob([JSON.stringify(save)]);
  return new Response(json.stream().pipeThrough(new CompressionStream('gzip'))).blob();
}

export async function importWorld(blob) {
  let text;
  try { text = await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text(); } catch (e) { throw new Error('bad-file'); }
  let save;
  try { save = JSON.parse(text); } catch (e) { throw new Error('bad-file'); }
  return checkVersion(save);
}
