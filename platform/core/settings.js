// Cài đặt chung của nền tảng: đặt một lần ở trang chủ hoặc trong bất kỳ game nào, mọi game dùng theo.
import { readJSON, writeJSON } from './storage.js';

const KEY = 'game-hub-settings-v1';
export const DEFAULT_SETTINGS = { music: 60, sfx: 80, shake: true, touch: 'auto' };   // touch: 'auto' | 'on' | 'off'
const saved = readJSON(KEY);
export const SETTINGS = { ...DEFAULT_SETTINGS, ...(saved || {}) };

export function saveSettings() { return writeJSON(KEY, SETTINGS); }
export function resetSettings() { Object.assign(SETTINGS, DEFAULT_SETTINGS); return saveSettings(); }

// Game có sẵn đối tượng cài đặt riêng (cfg) gọi hàm này để các mục chung trỏ về SETTINGS:
// cfg.music, cfg.sfx... đọc và ghi thẳng vào cài đặt nền tảng, không bị lưu trùng trong bản lưu của game.
// Lần đầu chạy trên nền tảng (chưa có cài đặt chung) thì lấy giá trị người chơi đã đặt trong game làm khởi điểm.
export function adoptSettings(cfg) {
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (!saved && k in cfg && typeof cfg[k] === typeof DEFAULT_SETTINGS[k]) SETTINGS[k] = cfg[k];
    delete cfg[k];
    Object.defineProperty(cfg, k, { get: () => SETTINGS[k], set: v => { SETTINGS[k] = v; }, enumerable: false, configurable: true });
  }
  if (!saved) saveSettings();
  return cfg;
}
