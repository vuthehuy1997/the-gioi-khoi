// Kho khoá-giá trị tối giản trên IndexedDB cho dữ liệu lớn (localStorage không đủ cho thế giới đã lưu).
const DB = 'game-hub-kv', STORE = 'kv';

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), store = t.objectStore(STORE), req = fn(store);
    t.oncomplete = () => { db.close(); resolve(req.result); };
    t.onerror = t.onabort = () => { db.close(); reject(t.error); };
  });
}

export const idbGet = key => tx('readonly', s => s.get(key)).then(v => (v === undefined ? null : v));
export const idbSet = (key, value) => tx('readwrite', s => s.put(value, key));
export const idbDel = key => tx('readwrite', s => s.delete(key));
export const idbKeys = () => tx('readonly', s => s.getAllKeys());
