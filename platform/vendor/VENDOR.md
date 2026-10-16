# Thư viện bên ngoài đã chép vào repo

| File | Nguồn | Phiên bản | sha256 | License |
|---|---|---|---|---|
| trystero.min.js | npm `@trystero-p2p/torrent` (gói `trystero` cũ chỉ còn là bản chuyển tiếp), bản gộp một file do esm.sh dựng: `https://esm.sh/@trystero-p2p/torrent@0.26.0/es2022/torrent.bundle.mjs` | 0.26.0 | 10106cc3fdd5ced84d0dcaea187761e0ad5861f34ee2df0902a2e342bfddcfad | MIT |

Xuất ra: `joinRoom`, `selfId`, `defaultRelayUrls`... Không import thêm gì (đã gộp `@trystero-p2p/core`).
Cập nhật: chép bản mới, sửa dòng trên, chạy lại `python3 tests/test_net.py` và phép đo ở Task 6.
