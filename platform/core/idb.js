// Kho khoá-giá trị tối giản trên IndexedDB cho dữ liệu lớn (localStorage không đủ cho thế giới đã lưu).
const DB = 'game-hub-kv', STORE = 'kv';

// Giữ kết nối mở sẵn: ghi lúc đóng tab (pagehide) không phải chờ mở DB nên kịp hoàn tất hơn.
let conn = null;
function open() {
  if (conn) return conn;
  conn = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => { const db = r.result; db.onclose = () => { conn = null; }; db.onversionchange = () => { db.close(); conn = null; }; resolve(db); };
    r.onerror = () => { conn = null; reject(r.error); };
  });
  return conn;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), store = t.objectStore(STORE), req = fn(store);
    t.oncomplete = () => resolve(req.result);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

export const idbGet = key => tx('readonly', s => s.get(key)).then(v => (v === undefined ? null : v));
export const idbSet = (key, value) => tx('readwrite', s => s.put(value, key));
export const idbDel = key => tx('readwrite', s => s.delete(key));
export const idbKeys = () => tx('readonly', s => s.getAllKeys());
