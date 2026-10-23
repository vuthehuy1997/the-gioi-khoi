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
| I1 | Trang công khai trên GitHub Pages tải được và chạy được bản mới | kiểm tra sau khi đẩy | ✅ |

Ngoài phạm vi v1 (đã chốt trong spec): PvP, mobile/cảm ứng, chống gian lận, tài khoản, server chạy liên tục, redstone, nhạc nền.

Giới hạn đã biết: kết nối thật giữa thiết bị khác mạng chưa được đo (cần người và thiết bị thật); test E2E dùng transport bộ nhớ.

## Vá lỗi sau review độc lập (đều có test hồi quy)

Hồi sinh bị gói vị trí cũ kéo ngược về chỗ chết (thêm số thứ tự dịch chuyển `seq`); nhiệm vụ boss/“đến vùng” không bị kẹt khi boss đã chết hoặc nhận ngay trong vùng; tab host chạy nền vẫn bắt kịp 2 giây mô phỏng và báo lý do thất bại cho người chơi; người đang gục được lưu ở điểm hồi sinh; nối lại sau khi rớt mạng thế chỗ kết nối cũ; chơi một mình dừng khi tạm dừng; host giữ chunk quanh người chơi khác; vật phẩm rơi không chặn đặt block; quái không bị dọn sạch khi mọi người đang gục; giới hạn tần suất gói vị trí; uid lạ (`constructor`) không làm hỏng việc vào phòng.

Các mục nhỏ còn hoãn: xoá delta khi block trở về nguyên bản (gói chào lớn dần), giới hạn 40 hành động/giây có thể làm rơi một lệnh đào khi lăn chuột rất nhanh, ô đang cầm trên máy khách trễ một nhịp so với host khi vừa đổi công cụ giữa lúc đào.

## Chất lượng và hiệu năng (vòng cải tiến sau phản hồi "lag và chất lượng kém")

| # | Tiêu chí | Test | Trạng thái |
|---|---|---|---|
| J1 | Sinh/dựng chunk ngoài luồng chính: di chuyển nhanh JS < 6 ms/khung, p95 < 16 ms, không quá 2 long task | `test_perf_streaming_frame_cost` | ✅ |
| J2 | AO + ánh sáng trời trong mesh | `test_visual_vertex_ao_*` | ✅ |
| J3 | Trời, mặt trời/trăng, sao, mây đổi theo giờ | `test_visual_sky_*` | ✅ |
| J4 | Khung chọn, vết nứt, hạt khi đào | `test_visual_selection_*` | ✅ |
| J5 | Địa hình có đồi và hồ; cỏ, hoa, bụi khô | `test_visual_plants_and_terrain_relief` | ✅ |
| J6 | Hoạt hoạ thực thể, nháy đỏ, bóng | `test_visual_entities_*` | ✅ |
| J7 | FOV/nhún/nghiêng camera, bộ điều chỉnh tầm nhìn | `test_visual_camera_fx_*` | ✅ |
| J8 | Âm thanh, icon, dưới nước | `test_audio_icons_and_underwater_tint` | ✅ |
| J9 | Mức chất lượng, F3, cập nhật lạc quan cho khách | `test_quality_presets_*` | ✅ |

## Mở rộng nội dung (vòng 5: vùng và quái mới)

| # | Tiêu chí | Test | Trạng thái |
|---|---|---|---|
| K1 | 3 vùng mới (Đầm Lầy Mục, Núi Lửa Tro, Vực Pha Lê) phủ ≥ 3% bản đồ ở nhiều seed, có block bề mặt, cây cỏ, độ cao riêng; vùng mới trong sa mạc/núi băng bị khóa theo boss | `test_new_regions_have_their_own_terrain_flora_and_gating` | ✅ |
| K2 | 10 quái mới sinh đúng vùng (mỗi quái vừa sinh nằm trong vùng khai báo của nó) | `test_new_regions_spawn_their_own_mobs_and_old_ones_still_work` | ✅ |
| K3 | Quái mới có giác quan, mô hình, bảng rơi hợp lệ; Linh Hỏa bắn đạn lửa | `test_new_mobs_have_senses_models_drops_and_a_fire_bolt` | ✅ |
| K4 | Đá nham thạch gây bỏng; công thức dùng đồ rơi mới | `test_standing_on_magma_burns_and_new_recipes_use_new_loot` | ✅ |
| K5 | 3 nhiệm vụ mới (đến vùng, hạ quái, nhặt đồ) hoàn thành được | `test_new_region_quests_need_visit_kills_and_loot_then_pay_out` | ✅ |
| K6 | 3 boss cho vùng mới: đấu trường nằm trong vùng của boss, đủ pha/chiêu, hạ được thì đặt cờ và rơi chiến lợi phẩm | `test_new_region_bosses_*`, `test_new_boss_defeat_*` | ✅ |

| K7 | 3 nhiệm vụ hạ boss vùng mới nối tiếp nhiệm vụ vùng, nhận/trả qua NPC, xong khi boss chết | `test_new_boss_quests_*`, `test_content_valid` | ✅ |
| K8 | 3 làng + 3 NPC (cửa hàng, hội thoại) ở vùng mới; thế giới đã lưu tự có thêm đấu trường/làng mới mà không dời cái cũ | `test_new_villages_*`, `test_old_save_*` | ✅ |
| K9 | 6 nhiệm vụ của 3 NPC làng mới: nhận và trả qua hội thoại, đếm quái/đồ, nối tiếp nhau, trả thưởng | `test_new_npc_quests_*`, `test_content_valid` | ✅ |
| L1 | Nhạc nền: chủ đề riêng cho mỗi vùng + boss, tất định, đổi đúng nhịp, đêm thưa hơn | `test_score_*` | ✅ |
| L2 | Tiếng kêu theo loài (báo động, đau, gục, rảnh), âm môi trường, giới hạn tần suất | `test_director_*` | ✅ |
| L3 | Game chạy nhạc theo vùng, thanh âm lượng và phím M lưu vào cài đặt | `test_game_runs_music_*` | ✅ |

Chưa kiểm chứng bằng tai: độ hay, độ to cân bằng giữa nhạc và hiệu ứng.

## Chế tạo sâu, trang bị, môi trường, xây dựng (vòng 7)

| # | Tiêu chí | Test | Trạng thái |
|---|---|---|---|
| M1 | Công thức gắn với trạm (bàn, lò nung, đe rèn); chuỗi luyện: gỗ → than củi, quặng sắt + than → thỏi sắt, cát → kính; true cũ = bàn | `test_stations_gate_recipes_and_smelting_chain`, `test_stations_are_detected_*` | ✅ |
| M2 | Quặng sắt sinh dưới lòng đất ở nhiều vùng, cần cuốc đá | `test_stations_are_detected_near_player_and_iron_ore_exists_underground` | ✅ |
| M3 | 6 bộ trang bị × 4 món, mỗi bộ một loại chống chịu và điểm giáp tăng dần; vũ khí di vật cần chiến lợi phẩm boss | `test_armor_sets_*`, `test_new_weapons_*` | ✅ |
| M4 | Mặc/cởi/đổi trang bị, giáp giảm sát thương quái (tối thiểu 1), lưu và nạp | `test_equip_armor_*` | ✅ |
| M5 | Nóng/lạnh/độc theo vùng: không đồ thì mất máu, đủ món chống đúng loại thì miễn nhiễm; giày than hồng đi được trên nham thạch; sát thương môi trường không bị giáp thường làm nhẹ | `test_region_environment_*`, `test_ember_boots_*` | ✅ |
| M6 | Đuốc, cửa, rương, giường, kính, gạch đá; đuốc đuổi quái; rương lưu/nạp và rơi đồ khi phá; giường đặt điểm hồi sinh | `test_torch_door_chest_bed_*`, `test_torches_keep_monsters_*` | ✅ |
| M7 | Giao diện: ô trang bị và thông số giáp, công thức chia nhóm theo trạm (cập nhật khi đặt/đi gần trạm), bấm phải để mặc, bảng rương | `test_ui_*` | ✅ |

Chưa làm: bậc thang và nửa khối, ánh sáng động từ đuốc, trang bị hiện trên người chơi khác, hiệu ứng riêng cho vũ khí di vật.

## Sinh tồn và kinh tế (Gói 1: trồng trọt, nuôi thú, đói, nấu ăn)

Đặc tả: `games/the-gioi-khoi/docs/specs/survival.md`; thiết kế kỹ thuật: `docs/specs/TECH.md` mục 3 và các Ruling (R-5, R-20, R-26, R-31, R-34). Bài mô phỏng chạy trực tiếp `Game` với bước thời gian thô (0,25 đến 1 giây) và bài ghi chú kết quả không phụ thuộc kích thước bước.

| # | Tiêu chí | Test | Trạng thái |
|---|---|---|---|
| S-AC1 | Người mới `food` 20; đứng yên 900 giây hoặc chạy nước rút 450 giây thì về 0 (±1); không giảm khi gục, khi tắt `hunger`, khi host tạm dừng | `test_survival_hunger_drain` | ✅ |
| S-AC2 | Mỗi đòn trúng quái cộng 2 mệt (23 đòn làm đói thêm đúng 1 điểm so với đối chứng) | `test_survival_hunger_exertion` | ✅ |
| S-AC3 | Hồi máu theo đói (no 1 máu/2 giây sau 4 giây; vừa theo luật cũ; đói không hồi; cạn mất 1 máu/5 giây, giáp không giảm, dừng ở 2 máu); cảnh báo "đang đói" tối đa 1 lần/60 giây | `test_survival_hunger_regen_starve` | ✅ |
| S-AC4 | 18 món ăn cộng đúng đói và máu (kẹp 20); hồi chiêu ăn 1 giây; từ chối `full` / `not-food` / `empty` không trừ vật phẩm | `test_survival_eat_table` | ✅ |
| S-AC5 | Đồ sống ngộ độc đúng tỉ lệ (25% ±4% với 1000 mẫu); đúng 3 sát thương thuần trong 6 giây; ngộ độc không bao giờ xuống dưới 1 máu | `test_survival_eat_poison` | ✅ |
| S-AC6 | Hồi phục (22 máu/45 giây), Sức mạnh (kiếm sắt 6 gây 8), Da dày (đòn 10 còn 9, đòn 20 còn 18: đo theo R-5), không cộng dồn (lấy max), chết xoá hết | `test_survival_food_effects` | ✅ |
| S-AC7 | Cuốc đất cày cỏ/đất/bùn/rêu; từ chối đá, ô phía trên đặc, ngoài tầm, không cầm cuốc; ba bậc cuốc chế đúng công thức (gỗ/đá ở bàn, sắt ở đe) | `test_survival_till` | ✅ |
| S-AC8 | Đất ướt khi có nước trong ±4 ngang và 0..-1 dọc; đặt/phá nước đổi trạng thái trong 5 giây | `test_survival_farmland_wetness` | ✅ |
| S-AC9 | Ruộng trống 300 giây (người chơi ở gần) về dirt; có cây thì không | `test_survival_farmland_revert` | ✅ |
| S-AC10 | Cây qua giai đoạn 1, 2, 3 đúng mốc (lúa mì khô 120/240/360 giây, ướt một nửa, cà rốt 300, khoai 420, vùng lạnh gấp đôi thời gian) ±5 giây | `test_survival_crop_growth` | ✅ |
| S-AC11 | Cây ngoài 64 block (hoặc khi người chơi gục) đóng băng, quay lại thì tiếp tục từ tiến trình cũ | `test_survival_crop_chunk_sim` | ✅ |
| S-AC12 | Gieo lên ruộng trừ 1 hạt; từ chối lên đất thường, ô có cây, ngoài tầm mà không trừ; phá đất dưới cây làm cây gãy và rơi 1 hạt; đặt block lên ruộng trống thì ruộng thành dirt | `test_survival_plant_rules` | ✅ |
| S-AC13 | Thu hoạch (đào và bấm phải) cho sản lượng trong khoảng ở bảng (200 mẫu, đủ min và max); cây chưa chín chỉ trả 1 hạt; bấm phải đưa cây về giai đoạn 0; hai người cùng bấm thì chỉ một người nhận; kho đầy thì phần dư rơi xuống đất | `test_survival_harvest` | ✅ |
| S-AC14 | Cỏ cao rơi hạt lúa mì 12% ±2%; Xác Sống rơi cà rốt và khoai tây mỗi loại 8% ±2% | `test_survival_seed_sources` | ✅ |
| S-AC15 | Thuần hoá bằng đúng thức ăn trong 3 block (yêu 30 giây); sai thức ăn hoặc xa thì từ chối không trừ; thú hoang bỏ chạy, thú đã thuần không bỏ chạy và quanh quẩn gần chuồng; quái không nhắm vào thú | `test_survival_animal_tame_ai` | ✅ |
| S-AC16 | Thú đã thuần đi theo người cầm đúng thức ăn (còn <= 3 block sau 10 giây), thôi theo khi đổi vật | `test_survival_animal_follow` | ✅ |
| S-AC17 | Hai thú cùng loài đang yêu sinh đúng 1 con non sau ~6 giây, hết yêu, hồi chiêu 240 giây (cho ăn lại bị từ chối `busy`); con non nhỏ một nửa, cho ăn rút 30 giây, thành trưởng thành đúng mốc | `test_survival_animal_breed_grow` | ✅ |
| S-AC18 | Gà thuần được cho ăn đẻ 1 trứng trong 150 đến 210 giây (20 mẫu), không đẻ khi đói hoặc còn non; kéo cắt cừu 1 đến 3 len, mọc lại sau 240 giây, tay không / cừu non bị từ chối; lợn chết rơi 1 đến 3 thịt lợn; cừu trọc không rơi len | `test_survival_animal_products` | ✅ |
| S-AC19 | Trần 24 thú đã thuần (thuần hoá và nhân giống bị từ chối `cap`); thú nuôi không tính vào trần quái, không bị xoá khi đi xa, đóng băng khi ngoài tầm | `test_survival_animal_caps` | ✅ |
| S-AC20 | 12 công thức mới chế đúng trạm, đúng nguyên liệu; mọi vật phẩm mới có nguồn (validator) và icon riêng, không trống; 12 tile cây khác nhau | `test_survival_cooking_recipes`, `test_survival_content_valid`, `test_content_valid`, `test_content_validator_catches_broken_references` | ✅ |
| S-AC21 | Bảng giá mua/bán ở Kho làng, Thương nhân, Ngư dân; nhiệm vụ "Vụ mùa đầu tiên" làm từ đầu đến cuối bằng hành động thật (cày, gieo, chờ chín, thu hoạch, nấu bánh mì, trả nhiệm vụ) và trả thưởng | `test_survival_farm_shop_quest` | ✅ |
| S-AC22 | Lưu/nạp (`toSave`/`fromSave`): cây, ruộng, thú (tuổi, yêu, hồi chiêu, len), đói, mệt, hiệu ứng, ngộ độc; cây tiếp tục lớn đúng mốc; save v1 nạp được; xuất/nhập `.gz` giữ nguyên; file hỏng bị làm sạch; 1000 cây < 100 KB | `test_survival_save_load` | ✅ |
| S-AC23 | Host cùng hai khách qua transport bộ nhớ: khách thấy ruộng và cây ở mọi giai đoạn, người vào muộn nhận đúng giai đoạn, thu hoạch đồng bộ, hai người cùng cho gà ăn thì một lần có hiệu lực (người kia nhận `fail busy`), cờ `tm`/`lv` có trên snapshot, `you.food`/`you.fx` độc lập từng người | `test_survival_e2e_two_players` | ✅ |
| S-AC24 | Giao diện: thanh đói đúng số biểu tượng (20, 7, 1, 0 và nhấp nháy khi 0), hàng hiệu ứng có tên và số giây đếm lùi, tooltip vật phẩm/cây/ruộng/thú, bấm phải thật (cày, gieo, thu hoạch, ăn, cho ăn, cắt len), toast tiếng Việt, ảnh chụp có ruộng nhiều giai đoạn; không lỗi console | `test_survival_ui` | ✅ |
| S-AC25 | Hiệu năng: tick với 24 thú + 40 quái + 500 cây (2 người) avg < 5 ms, worst < 25 ms; một lượt xử lý 500 cây < 3 ms; dựng mesh chunk có cây < 400 ms | `test_survival_perf` | ✅ |
| S-AC26 | Hồi quy: 106 bài cũ vẫn xanh (với `hunger: false` trong các bộ dựng thử), `test_net.py` 21 bài xanh | toàn bộ `tests/` | ✅ |
| S-N1 | Hạ tầng dùng chung: `exportDelta` mã hoá chạy (RLE), nạp được cả dạng cũ | `test_survival_world_delta_is_run_length_encoded_and_reads_old_format` | ✅ |

Bài cũ phải sửa có chủ đích: `test_save_load_roundtrip` (`v` = 2); `test_spawn_rules_by_region_and_time` (thú hiền ban ngày giờ gồm cả gà, cừu, lợn chia trọng số với nai và cáo); các bộ dựng thử `GAME_JS`, `ARENA_JS`, `NET_JS`, `mkTown` thêm `hunger: false` để đói không chen vào bài cũ.

Giới hạn đã biết của Gói 1: Da dày chỉ giảm 12% nên đòn nhỏ (<= 4) không thấy khác sau khi làm tròn (R-5; cân bằng lại sau khi chơi thử, đề xuất +4 giáp nếu cần); host không kiểm được nước rút nên mệt tính theo `p.sprint` và vận tốc khách báo (không hứa chống gian lận); bài S-AC23 mở host và hai phiên khách trong cùng một trang (transport bộ nhớ), không mở nhiều tab; âm thanh mới (ăn, cày, gieo, thu hoạch, gà/cừu/lợn kêu) tổng hợp bằng code và chưa nghe thử bằng tai; `design/design-data.json` (bảng thiết kế) chưa dựng lại, script `tools/export_design_data.py` đã được kiểm chạy với dữ liệu mới (có thêm `crops`, `effects`).
