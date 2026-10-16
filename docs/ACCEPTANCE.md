# Tiêu chí hoàn thành — Thế Giới Khối v1

Yêu cầu gốc: game thế giới khối nhiều người chơi trên web, "như Minecraft nhưng mở rộng hơn về quái, boss, khu vực, vùng, NPC". Mỗi dòng dưới đây phải có test tự động xanh (cột Test) trước khi coi là xong. Trạng thái cập nhật sau mỗi vòng lặp.

| # | Tiêu chí | Test | Trạng thái |
|---|---|---|---|
| A1 | Địa hình voxel sinh từ seed, giống hệt nhau giữa các lần chạy | `test_world_deterministic` | ✅ |
| A2 | ≥ 3 vùng (biome) khác nhau về block, cây, quái | `test_regions_distinct` | ✅ |
| A3 | Chunk nạp/bỏ theo vị trí người chơi, mesh dựng đúng (không vẽ mặt bị che) | `test_mesher_*`, `test_chunk_streaming` | ✅ |
| A4 | Có hình ảnh render 3D thật (chụp màn hình không trống, có nhiều màu) | `test_render_screenshot` | ✅ |
| B1 | Đi, nhảy, va chạm với block; không rơi xuyên đất | `test_physics_*` | ✅ |
| B2 | Đào và đặt block, có độ cứng/công cụ, rơi vật phẩm vào kho | `test_break_place_*` | ✅ |
| B3 | Kho đồ, thanh nhanh, ≥ 8 công thức chế tạo | `test_inventory_*`, `test_crafting_*` | ✅ |
| C1 | Phòng 2–5 người; đặt/đào block, vị trí, quái, boss đồng bộ qua host | `test_multiplayer_*` | ✅ |
| C2 | Người vào muộn nhận đúng thế giới đã bị sửa | `test_late_join_gets_world` | ✅ |
| D1 | ≥ 6 loại quái với AI khác nhau (đuổi cận chiến, bắn xa, bỏ chạy, canh giữ...) | `test_mob_ai_*` | ✅ |
| D2 | Quái spawn theo vùng và ngày/đêm, có bảng rơi đồ, có giới hạn tổng số | `test_spawn_*`, `test_loot_*` | ✅ |
| D3 | Chiến đấu: sát thương, hồi chiêu, chết, hồi sinh | `test_combat_*` | ✅ |
| E1 | ≥ 2 boss nhiều pha, có đấu trường, phần thưởng mở vùng/đồ | `test_boss_*` | ✅ |
| E2 | Boss tăng độ khó theo số người trong đấu trường | `test_boss_scaling` | ✅ |
| F1 | ≥ 3 NPC, hội thoại dạng đồ thị, có cửa hàng | `test_npc_*`, `test_shop_*` | ✅ |
| F2 | ≥ 4 nhiệm vụ (giết, thu thập, nói chuyện, hạ boss), cờ tiến trình | `test_quest_*` | ✅ |
| G1 | Lưu/nạp thế giới và người chơi (IndexedDB), xuất/nhập file | `test_save_load_*` | ✅ |
| H1 | Trình kiểm tra nội dung: không tham chiếu hỏng, vật phẩm không nguồn, hội thoại cụt | `test_content_valid` | ✅ |
| H2 | Ngân sách hiệu năng: sinh + dựng 6×6 chunk, một tick với 40 quái | `test_perf_*` | ✅ |
| H3 | Kịch bản trọn vẹn 2 trình duyệt: vào phòng, đào, đánh quái, nhận nhiệm vụ, hạ boss | `test_e2e_two_players` | ✅ |
| H4 | Không lỗi console; bộ test mạng M1 vẫn đạt | toàn bộ `tests/` | ✅ |
| I1 | Trang công khai trên GitHub Pages tải được và chạy được bản mới | kiểm tra sau khi đẩy | ☐ |

Ngoài phạm vi v1 (đã chốt trong spec): PvP, mobile/cảm ứng, chống gian lận, tài khoản, server chạy liên tục, redstone, nhạc nền.

Giới hạn đã biết: kết nối thật giữa thiết bị khác mạng chưa được đo (cần người và thiết bị thật); test E2E dùng transport bộ nhớ.

## Vá lỗi sau review độc lập (đều có test hồi quy)

Hồi sinh bị gói vị trí cũ kéo ngược về chỗ chết (thêm số thứ tự dịch chuyển `seq`); nhiệm vụ boss/“đến vùng” không bị kẹt khi boss đã chết hoặc nhận ngay trong vùng; tab host chạy nền vẫn bắt kịp 2 giây mô phỏng và báo lý do thất bại cho người chơi; người đang gục được lưu ở điểm hồi sinh; nối lại sau khi rớt mạng thế chỗ kết nối cũ; chơi một mình dừng khi tạm dừng; host giữ chunk quanh người chơi khác; vật phẩm rơi không chặn đặt block; quái không bị dọn sạch khi mọi người đang gục; giới hạn tần suất gói vị trí; uid lạ (`constructor`) không làm hỏng việc vào phòng.

Các mục nhỏ còn hoãn: xoá delta khi block trở về nguyên bản (gói chào lớn dần), giới hạn 40 hành động/giây có thể làm rơi một lệnh đào khi lăn chuột rất nhanh, ô đang cầm trên máy khách trễ một nhịp so với host khi vừa đổi công cụ giữa lúc đào.
