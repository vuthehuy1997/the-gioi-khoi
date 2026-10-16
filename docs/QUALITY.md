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

## Vòng 2 — chất lượng hình ảnh và cảm giác chơi so với Minecraft

Khoảng cách tìm được khi chụp màn hình và so với Minecraft: trời một màu, địa hình phẳng, không cỏ hoa, không khung chọn/vết nứt/hạt khi đào, thực thể đứng yên, không tay cầm vật, không âm thanh, hotbar chỉ có chữ, không chỉnh được chất lượng.

| Hạng mục | Cách làm | Test |
|---|---|---|
| Ánh sáng | AO theo đỉnh + ánh sáng trời (hang động và dưới tán cây tối dần), quad lật đường chéo theo AO | `test_visual_vertex_ao_and_skylight_*` |
| Bầu trời | vòm gradient theo vùng và giờ (ấm lúc bình minh/hoàng hôn, xanh đậm ban đêm), mặt trời, mặt trăng, 400 ngôi sao, mây khối trôi theo camera | `test_visual_sky_sun_moon_stars_clouds_follow_time` |
| Đào/đặt | khung chọn block, 10 mức vết nứt, hạt vỡ lấy màu thật từ texture, hạt máu khi đánh quái | `test_visual_selection_outline_crack_and_particles` |
| Thế giới | đồi, thung lũng và hồ, dãy núi gồ ghề; cỏ cao, hoa đỏ/vàng, bụi khô (vẽ chéo hai mặt, đi xuyên qua được, đào tức thì) | `test_visual_plants_and_terrain_relief` |
| Thực thể | chân tay đung đưa theo quãng đường, đầu nhìn theo, nháy đỏ khi trúng đòn, bóng tròn dưới chân, NPC quay mặt về người chơi | `test_visual_entities_animate_flash_and_cast_shadow` |
| Camera | FOV rộng ra khi chạy, nhún khi đi, nghiêng khi bị đánh, tay + vật đang cầm vung khi đào/đánh | `test_visual_camera_fx_fov_bob_tilt_and_governor` |
| Âm thanh | tiếng đào/vỡ theo chất liệu, đặt, bước chân, hạ cánh, trúng đòn, đau, nhặt, boss, chiến thắng | `test_audio_icons_and_underwater_tint` |
| HUD | icon vật phẩm vẽ bằng canvas (khối 3D nhìn nghiêng, công cụ theo bậc, nguyên liệu), màn hình xanh khi ở dưới nước, thông báo "đang tạo thế giới" | cùng bài trên |
| Chất lượng | ba mức Thấp/Vừa/Cao (tầm nhìn, mây, độ phân giải, hạt), mặc định theo máy; **tự giảm tầm nhìn** khi khung chậm kéo dài và tăng lại khi máy khoẻ; F3 hiện FPS, toạ độ, chunk, tam giác, lệnh vẽ | `test_quality_presets_debug_overlay_*`, bộ điều chỉnh trong bài camera |
| Mạng | khách đào/đặt thấy ngay (cập nhật lạc quan), host từ chối thì hoàn tác | cùng bài chất lượng |

### Số đo cuối vòng 2 (headless, kết xuất bằng phần mềm nên GPU thật sẽ tốt hơn)

| Chỉ số | Giá trị |
|---|---|
| Vào game: thế giới sẵn sàng / 9 chunk đầu / đủ 169 chunk | 0,27 s / 0,5 s / 1,2 s |
| JS mỗi khung khi chạy nhanh qua chunk mới (trung bình / p95 / tối đa) | 1,3 ms / ~2 ms / 7 ms |
| Long task khi streaming | 0–1 (trước: 72) |
| Tam giác tầm nhìn 6 chunk | ~120k, ~120 lệnh vẽ |
| Gói chào thế giới | ~71 KB |

Giới hạn của phép đo: headless dùng SwiftShader (GPU phần mềm) nên khung hình đo được (33 ms) bị chặn bởi rasteriser, không đại diện cho GPU thật; những gì chắc chắn là chi phí JS trên luồng chính, thời gian nạp và số tam giác/lệnh vẽ.
