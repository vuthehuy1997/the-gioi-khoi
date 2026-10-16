// Giao thức mạng dùng chung cho các game nhiều người chơi trên nền tảng.
export const PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 5;

// Tên kênh trên dây. Mỗi tên tối đa 12 byte (giới hạn của Trystero) và phải khai báo trước ở cả hai đầu.
export const WIRE_TYPES = ['hello', 'reject', 'roster', 'app', 'ping', 'pong'];

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bỏ I, O, 0, 1 vì dễ nhầm

export function makeRoomCode(len = 5, rnd = Math.random) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rnd() * ALPHABET.length)];
  return s;
}

export function normalizeCode(s) { return String(s ?? '').replace(/\s+/g, '').toUpperCase(); }

export function isValidCode(s) {
  return typeof s === 'string' && s.length >= 5 && s.length <= 6 && [...s].every(c => ALPHABET.includes(c));
}

// Tên hiển thị: bỏ ký tự điều khiển, tối đa 16 ký tự (đếm theo code point để không cắt đôi emoji).
export function cleanName(s) {
  if (typeof s !== 'string') return 'Khách';
  const t = [...s.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, 16).join('').trim();
  return t || 'Khách';
}
