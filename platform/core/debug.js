// Hỗ trợ kiểm thử và gỡ lỗi: đưa các export của module ra window để gọi từ console hoặc Playwright.
// Chỉ bật khi địa chỉ trang có ?debug.
export const debugOn = () => new URLSearchParams(location.search).has('debug');

// modules: danh sách đối tượng `import * as m`. setters: { tên: hàm gán } cho những tên được phép gán từ ngoài.
export function exposeGlobals(modules, setters = {}) {
  for (const m of modules) for (const k of Object.keys(m)) {
    try {
      Object.defineProperty(window, k, {
        configurable: true, get: () => m[k],
        set: setters[k] || (() => { throw new Error(`${k} là export của module, không gán từ ngoài được`); }),
      });
    } catch (e) { /* trùng thuộc tính không đổi được của window: bỏ qua */ }
  }
}
