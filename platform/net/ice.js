// Máy chủ STUN/TURN cho WebRTC. STUN giúp hai máy tìm đường tới nhau; TURN chuyển tiếp khi mạng chặn kết nối thẳng.
// Chỉ có STUN công cộng. Thêm TURN ở đây nếu phép đo ở Task 6 cho thấy có cặp người chơi không nối được.
// Lưu ý: repo này công khai, nên mọi tên đăng nhập/mật khẩu TURN để ở đây đều ai cũng đọc được; chỉ dùng loại
// miễn phí có hạn mức, đừng dùng tài khoản có trả tiền.
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
