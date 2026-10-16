# Thế Giới Khối (smoke-world)

Game thế giới khối nhiều người chơi chạy trên trình duyệt, không cần máy chủ: người tạo phòng làm host, những người khác nối vào bằng WebRTC (thư viện Trystero). Bản hiện tại (mốc M1) là trang thử kết nối phòng: mã phòng, tối đa 5 người, thấy nhau di chuyển, xem ping và băng thông.

- Trang thử: `games/the-gioi-khoi/` (mở `?net=memory` để thử hai tab cùng máy không cần mạng).
- Lớp mạng dùng chung: `platform/net/`. Thư viện ngoài: `platform/vendor/` (xem `VENDOR.md`).
- Đặc tả: `docs/superpowers/specs/2026-10-16-the-gioi-khoi-design.md`; kế hoạch M1: `docs/superpowers/plans/2026-10-16-the-gioi-khoi-m1-net.md`.

## Chạy

```
python3 -m http.server 8003      # rồi mở http://localhost:8003/games/the-gioi-khoi/
python3 tests/test_net.py        # cần Python Playwright (chromium)
```

Không có bước build. Kết nối giữa thiết bị khác mạng cần HTTPS (GitHub Pages) vì WebRTC của Trystero dùng `crypto.subtle`.

Mã nguồn tách ra từ repo Game Hub; liên kết "← Game Hub" trên trang thử trỏ về trang giới thiệu ở gốc.
