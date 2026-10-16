// Đường về trang chủ nền tảng, gắn vào màn hình chính của mỗi game.
// Trang game cần nạp platform/css/kit.css.
export const HUB_NAME = 'Game Hub';
export const HUB_URL = new URL('../../', import.meta.url).href;

// Thêm liên kết "← Game Hub" vào góc trên trái của container (container cần position khác static)
export function mountHomeLink(container) {
  const a = document.createElement('a');
  a.className = 'hub-home'; a.href = HUB_URL; a.textContent = '← ' + HUB_NAME;
  a.setAttribute('aria-label', 'Về trang chủ ' + HUB_NAME);
  container.appendChild(a);
  return a;
}
