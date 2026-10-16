# Chất lượng và hiệu năng — nhật ký cải tiến

Phản hồi người chơi: "game cực lag, chất lượng quá kém so với Minecraft". Mỗi vòng: đo → chọn việc ảnh hưởng nhất → sửa → test → ghi lại.

## Vòng 1 — hiệu năng (đo bằng `tests/test_game.py::test_perf_streaming_frame_cost`)

Nguyên nhân: sinh chunk và dựng mesh chạy trên luồng chính (23 ms/khung khi di chuyển, 72 "long task" trong 6 giây), khoá chunk dạng chuỗi nên `world.get` chậm.

| Số đo (di chuyển nhanh 6–7 giây) | Trước | Sau |
|---|---|---|
| Khung hình trung vị | 50 ms | 16,7 ms (đủ 60 FPS) |
| `view.update` trung bình | 23 ms | < 1 ms |
| Long task (> 50 ms) | 72 | 0 |
| Tam giác | 149k | 107k (AO + ánh sáng trời làm cả hình ảnh đẹp hơn) |

Việc đã làm: khoá chunk dạng số + bộ nhớ đệm chunk gần nhất; mesher đọc thẳng mảng chunk có viền (không gọi `get` từng ô); sinh + dựng mesh chuyển sang Web Worker (nhận kết quả vài chunk mỗi khung); chunk bị sửa dựng lại ngay trên luồng chính để thấy tức thì.
