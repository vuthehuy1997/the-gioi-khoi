// Thông tin Thế Giới Khối cho trang chủ. Chưa đăng ký vào platform/games.js (việc của mốc M7).
import { readJSON } from '../../platform/core/storage.js';

export const STORE_KEY = 'the-gioi-khoi-v1';

export default {
  id: 'the-gioi-khoi',
  title: 'Thế Giới Khối',
  tagline: 'Cùng bạn bè dựng và khám phá thế giới khối',
  desc: 'Game thế giới khối nhiều người chơi chạy ngay trên trình duyệt. Bản hiện tại chỉ là trang thử kết nối phòng.',
  tags: ['Nhiều người chơi', 'Đang phát triển'],
  url: new URL('./', import.meta.url).href,
  progress() {
    const s = readJSON(STORE_KEY);
    return s && s.regions ? { pct: Math.min(1, s.regions / 5), text: `Đã mở ${s.regions} vùng`, updated: 0 } : null;
  },
};
