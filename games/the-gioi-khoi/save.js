// Lưu thế giới vào IndexedDB, xuất/nhập file nén (.gz), kiểm tra phiên bản dữ liệu.
import { idbGet, idbSet, idbDel, idbKeys } from '../../platform/core/idb.js';

export const SAVE_VERSION = 1;
const KEY = n => 'tgk-world:' + n;

export function checkVersion(save) {
  if (!save || typeof save !== 'object' || typeof save.v !== 'number' || typeof save.seed !== 'number') throw new Error('bad-file');
  if (save.v > SAVE_VERSION) throw new Error('newer-version');
  return save;          // các phiên bản cũ hơn được nâng cấp ở đây khi có
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
