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

## Hầm ngục có chủ đề (Gói 2)

Đặc tả: `games/the-gioi-khoi/docs/specs/dungeon.md`; thiết kế kỹ thuật: `docs/specs/TECH.md` mục 5 và các Ruling (R-3, R-4, R-8, R-9, R-10, R-19). Mã: `sim/dungeon.js` (khuôn bố cục, phòng canh gác, bẫy, cổng, rương, hàm thuần `trapPhase/spikeState/ventState` dùng chung host và client), `content/dungeons.js` (hầm, bẫy, bảng thưởng), 6 chủ hầm trong `content/bosses.js` (thuộc tính `dungeon`), 8 block mới (id 54 đến 61) với 9 tile vẽ bằng code. Bài mô phỏng dựng hầm ở chỗ cố định (`forceSite`) để đo từng cơ chế; bài sinh thế giới chạy đủ 5 seed.

| # | Tiêu chí | Test | Trạng thái |
|---|---|---|---|
| D-AC1 | Mỗi thế giới (5 seed) có đúng 6 hầm, mỗi hầm nằm trong vùng của nó, cách mọi công trình khác và hầm khác >= 90 block (thực tế tìm với khoảng cách 100) | `test_dungeon_six_sites_per_world_in_region_and_far_from_everything` | ✅ |
| D-AC2 | Bố cục dựng đúng ở cả 6 hầm: từ miệng hầm tới chân thang, tới P2 đi bộ được; cổng sắt đóng chặn P3, mở rồi tới được rương cuối; cổng chủ đóng chặn P4, mở rồi tới được tâm P4; hộp bao <= 72 x 40 (Ruling R-3 thay cho "tổng chiều dài <= 80"), sàn >= y 6, 6..16 bậc | `test_dungeon_layout_is_walkable_door_by_door_and_compact` | ✅ |
| D-AC3 | Tường, trần, cổng, rương không đào được bằng cuốc tốt nhất; mở hết cổng rồi lan từ chân thang qua mọi ô trống hoặc đào được (kể cả sàn và ống tên): không lọt ra ngoài khoang và sàn (không có đường vào ngoài cầu thang) | `test_dungeon_walls_cannot_be_dug_and_the_vault_is_sealed` | ✅ |
| D-AC4 | P2: một người vào thì sinh 4 quái đợt 1 (từ danh sách của hầm, `persist`); chết hết, 2 giây sau 3 quái + 1 Tượng Đá; 3 người thì 6 và 5+1; trần +4 | `test_dungeon_guard_room_waves_scale_with_players` | ✅ |
| D-AC5 | P2: rời xa > 30 block giữa đợt thì quái bị xoá và phòng chưa dọn, quay lại bắt đầu từ đợt 1; dọn xong hai đợt thì đặt cờ đã dọn, không sinh lại, rương chiến thắng mở được | `test_dungeon_guard_room_gives_up_when_left_clears_and_stays_cleared` | ✅ |
| D-AC6 | Gai: không đau lúc hạ và báo hiệu (1,9 giây đầu), 4 giây trên gai nhô đúng 12 (3 lần cách >= 0,8 giây), nhảy qua không đau, hàng lệch pha 2 giây nhô trước, qua giáp | `test_dungeon_spike_floor_hurts_by_rhythm_only` | ✅ |
| D-AC7 | Tên bắn: giẫm tấm thì 0,3 giây sau đúng 2 mũi tên (5 sát thương), tấm hồi 5 giây, rón rén không kích hoạt | `test_dungeon_dart_plate_fires_two_arrows_after_a_delay_and_sneak_is_safe` | ✅ |
| D-AC8 | Phun: 6 sát thương trong bán kính 1,6, một lần mỗi người mỗi đợt phun (0,8 giây), không đau lúc nghỉ và báo hiệu, hất lên (vy = 5), đợt sau lại đau | `test_dungeon_vent_sprays_once_per_burst_in_radius` | ✅ |
| D-AC9 | Phá tấm áp lực, ống tên, ống phun bằng cuốc bậc 1 (<= 2 giây) thì bẫy ngừng hoạt động vĩnh viễn (sàn không thủng); đặt block lên gai: từ chối khi gai nhô, được khi gai hạ và gai hết hiệu lực | `test_dungeon_traps_can_be_disarmed_with_a_pick_and_spikes_can_be_covered` | ✅ |
| D-AC10 | Cổng sắt: không chìa thì không mở, kho không đổi, có toast; chìa sai loại không mở; đúng chìa thì trừ 1 và cụm 3x3 thành AIR (9 sự kiện block); người khác đi qua không cần chìa; cổng chủ tương tự, ở xa thì `reach`; tham số bậy không ném lỗi | `test_dungeon_gates_need_the_right_key_and_stay_open_for_everyone` | ✅ |
| D-AC11 | Rương chia riêng: mỗi người một lần (mở lần hai: "đã nhận", kho không đổi), người kia vẫn nhận; tất định theo (seed, hầm, rương, uid); khoảng số lượng và xác suất đúng bảng (400 uid); kho đầy thì phần dư rơi ra đất | `test_dungeon_chests_pay_each_player_once_deterministically` | ✅ |
| D-AC12 | Rương tiếp tế và rương cuối phòng bẫy mở ngay; rương chiến thắng `locked` đến khi P2 dọn; rương kho báu chỉ xuất hiện (và mở được) sau khi chủ hầm chết | `test_dungeon_chest_unlock_conditions` | ✅ |
| D-AC13 | 6 chủ hầm: sinh khi có người vào P4, đủ 3 pha đổi ở 1,0/0,55/0,25 với hệ số 1/1, 1,1/1, 1,3/1,3, máu +60% mỗi người, reset sau 5 giây, hạ thì đặt cờ, rơi xu (80 + 20 mỗi hầm) và 2..4 Mảnh Cổ Vật, không sinh lại | `test_dungeon_six_bosses_phases_scaling_reset_and_drops` | ✅ |
| D-AC14 | 6 nhiệm vụ "Dọn hầm": nhận được qua NPC, hoàn thành khi chủ hầm chết, trả đủ xu (100 đến 200) | `test_dungeon_quests_item_recipes_and_potion` | ✅ |
| D-AC15 | Cuốc Cổ Vật (bậc 3, tốc độ 6,5, sát thương 5) và Kiếm Người Khai Hầm (sát thương 12) chế đúng nguyên liệu, chỉ ở đe rèn; Bình Hồi Máu hồi 12 không vượt máu tối đa (xếp 16); thương nhân mua Mảnh Cổ Vật 25 xu và bình 10 xu | `test_dungeon_quests_item_recipes_and_potion` | ✅ |
| D-AC16 | Lưu/nạp: cổng đã mở, cờ phòng/hầm, `claimed`, bẫy đã phá, rương kho báu, chủ đã hạ giữ nguyên; save cũ (không có hầm) nạp được và dựng đủ 6 hầm mà không dịch chỗ công trình cũ; điểm có chunk đã chỉnh sửa trong hộp bao bị bỏ, khối đã đặt còn nguyên | `test_dungeon_save_load_keeps_progress_and_old_worlds_get_dungeons` | ✅ |
| D-AC17 | Hai khách qua transport bộ nhớ: host mở cổng thì khách thấy cổng biến mất; khách mở rương thì chỉ khách nhận; nhịp gai tính từ `time` của snapshot (lệch <= 0,25 giây); khách vào P2 thì quái sinh ở host, sự kiện `dungeon` về khách và cờ đã dọn đồng bộ | `test_dungeon_multiplayer_gate_chest_trap_rhythm_and_guard_room` | ✅ |
| D-AC18 | Quái tự nhiên không sinh trong hộp bao hầm hay quanh miệng hầm (bán kính 6,5) qua 1500 giây giả lập; quái hầm (`persist`) không bị luật xoá 80 block | `test_dungeon_no_natural_spawns_inside_and_dungeon_mobs_are_exempt_from_the_80_rule` | ✅ |
| D-AC19 | Giao diện: biểu ngữ tên hầm, dòng "Phòng x/4 · Quái còn n · Chìa Hầm a · Chìa Chủ b", gợi ý hướng khi <= 80 block (ẩn khi xa hơn hoặc đã hạ chủ), toast cổng thiếu chìa, bảng Chiến lợi phẩm (và "đã nhận"), 6 icon vật phẩm và 9 tile block mới đều có hình và khác nhau | `test_dungeon_ui` | ✅ |
| D-AC20 | `validate.js` bắt hầm tham chiếu vùng/quái/vật liệu/boss không tồn tại, hầm không đủ 3 chặng bẫy, thiếu chìa trong bảng thưởng, thiếu cổng, vật phẩm thưởng không tồn tại; dữ liệu thật sạch | `test_dungeon_content_valid_and_validator_catches_breaks` | ✅ |
| D-AC21 | Hiệu năng: dựng 6 hầm thêm vào thế giới < 1,5 giây, gói chào (delta + flags) < 400 KB, tick host với 5 người trong P3 thêm < 2 ms so với đối chứng không có hầm | `test_dungeon_perf_build_and_trap_tick` | ✅ |
| D-T1 | Chìa gắn với người chơi (`bound`): không cất vào rương đặt; hành động `gate`/`dchest` với tham số bậy hoặc người chơi đã gục không ném lỗi | `test_dungeon_keys_cannot_be_stored_in_placed_chests_and_garbage_acts_never_throw` | ✅ |
| D-T2 | Save hỏng hoặc độc hại (vị trí hầm số bậy, `steps` rất lớn, cờ `dungeons` sai kiểu, `claimed` không phải mảng) nạp và chạy được, không ném lỗi, không treo; hành động `gate`/`dchest` trên cờ hỏng vẫn đúng | `test_dungeon_hostile_save_is_sanitized` | ✅ |

Bài cũ phải sửa có chủ đích: `test_survival_content_valid` (số block 54 thành 62 vì thêm 8 block hầm ngục).

Giới hạn đã biết của Gói 2: chủ hầm dùng lại mô hình của 6 boss vùng (chưa đổi màu riêng); tấm áp lực chưa vẽ trạng thái lún (chỉ có âm báo khi giẫm); tầng ngầm quanh hầm có thể có hang tự nhiên sát tường nhưng tường dày 1 ô bao kín nên không thông vào hầm (kiểm bằng D-AC3); mũi tên bẫy là đạn thường của quái (R-12, bước con của đạn thuộc Gói 3); sát thương gai/phun/tên ra giáp theo luật `reduceDamage` hiện có (lăn và khiên của Gói 3 sẽ dùng cờ `blockable`).


## Chiến đấu có chiều sâu (Gói 3: thể lực, lăn né, đòn theo vũ khí, cung tên, khiên)

Đặc tả: `games/the-gioi-khoi/docs/specs/combat.md`; thiết kế kỹ thuật: `docs/specs/TECH.md` mục 4 và các Ruling (R-1, R-2, R-12 tới R-18, R-22 tới R-24). Mã: `sim/fight.js` (thể lực, lăn, khiên, cung), `sim/rules.js` (hằng số có tên, `weaponOf`), `sim/combat.js` (đường ống `hurtPlayer`: lăn, khiên, giáp, tối thiểu 1; `actHit` theo lớp vũ khí; đạn bước con), `sim/mobs.js` (báo hiệu đòn, choáng), `net/snapshot.js` (`ps[].act`, `off`, `me`, `stn`), UI ở `ui/hud.js`, `ui/panels.js`, `game.js`. Mọi trạng thái và đồng hồ nằm ở host; khách chỉ gửi ý định (`roll`, `guard`, `draw`, `shoot` với `yaw/pitch`) và dự đoán cục bộ để mượt. Sự kiện khiên đổi tên thành `shield` (không trùng `block`, R-1).

| # | Tiêu chí | Test | Trạng thái |
|---|---|---|---|
| C-AC1 | Người mới `stamina` 100 / `maxStamina` 100, có trong snapshot (`me.sta`) | `test_combat2_stamina_drain_regen_and_exhaust` | ✅ |
| C-AC2 | Chạy nước rút 2 giây ở tốc độ ngang > 1 làm thể lực giảm 16 ± 2; đứng yên mà cờ sprint bật thì không giảm | `test_combat2_stamina_drain_regen_and_exhaust` | ✅ |
| C-AC3 | Sau 1 giây không tiêu, hồi 25 ± 2 điểm/giây; 0,9 giây đầu không hồi | `test_combat2_stamina_drain_regen_and_exhaust` | ✅ |
| C-AC4 | Về 0 thì kiệt sức 2 giây (sự kiện `exhausted`, `me.exh`): `roll` và `hit` trả `tired`, không kéo cung; hết khi đủ 20; sprint bị client chặn khi `sta < 1` hoặc `exh > 0` | `test_combat2_stamina_drain_regen_and_exhaust` | ✅ |
| C-AC5 | Lăn: `ok`, thể lực -25, hồi chiêu 0,8 giây (lần hai bị `cooldown`), `act` = 3 trong snapshot | `test_combat2_roll_cost_cooldown_iframes_and_cancels` | ✅ |
| C-AC6 | Bất khả xâm phạm 0,05 tới 0,35 giây sau lăn với quái/đạn/boss; 0,04 và 0,36 giây thì trừ máu; khí độc và đòn `pure` vẫn trừ | `test_combat2_roll_cost_cooldown_iframes_and_cancels` | ✅ |
| C-AC7 | Phím Q lăn 3,5 ± 0,4 block trên đất phẳng, không bị host kéo về (không `teleport`, không `fail`) | `test_combat2_e2e_roll_key_moves_about_3_5_blocks_without_being_pulled_back` | ✅ |
| C-AC8 | Kiếm: 3 đòn trong 0,8 giây gây x1, x1, x1,5 (kiếm sắt 6, 6, 9), đòn 3 đẩy lùi gấp đôi, sau đòn 3 hồi chiêu 0,8 giây; cách > 0,8 giây hoặc đổi vật cầm thì về đòn 1; đòn trượt không tăng chuỗi; `me.cmb` | `test_combat2_sword_combo_cooldown_and_reset` | ✅ |
| C-AC9 | Rìu: mục tiêu chính + tối đa 2 mục tiêu phụ trong 2,5 block (70%, làm tròn xuống), mục tiêu thứ 4 và quái xa không bị; hồi chiêu 0,8 giây (R-24: tổng 3 mục tiêu) | `test_combat2_axe_sweep_club_stun_spear_reach_and_fall_crit` | ✅ |
| C-AC10 | Chùy: x1,3, choáng quái thường 1 giây (đứng yên, không đánh), miễn choáng 3 giây sau đó, boss không bị choáng | `test_combat2_axe_sweep_club_stun_spear_reach_and_fall_crit` | ✅ |
| C-AC11 | Giáo: trúng ở 5,6 block, kiếm thì `reach`; không đẩy lùi | `test_combat2_axe_sweep_club_stun_spear_reach_and_fall_crit` | ✅ |
| C-AC12 | Đòn rơi x1,5 khi đang rơi (vận tốc rơi do host tự đo từ chênh độ cao, không tin `vy` của khách) và không chạm đất; trên đất không | `test_combat2_axe_sweep_club_stun_spear_reach_and_fall_crit`, `test_combat2_fall_speed_is_measured_by_the_host_from_height_changes` | ✅ |
| C-AC13 | Thể lực mỗi đòn: kiếm 6, rìu 12, chùy 15, giáo 8, cuốc 4, tay không 4; không đủ thì `tired`, không đổi hồi chiêu, chuỗi, máu quái | `test_combat2_each_weapon_costs_stamina_and_tired_changes_nothing` | ✅ |
| C-AC14 | Quái cận chiến báo hiệu 0,35 giây (0,6 giây khi hồi chiêu >= 1,4), sự kiện `windup`; sát thương giữ nguyên số cũ; lùi ra khỏi tầm + 0,4 trong lúc vung thì không mất máu | `test_combat2_melee_mobs_telegraph_before_they_hit` | ✅ |
| C-AC15 | Cung: kéo < 0,2 giây thả ra không bắn, không mất mũi tên; kéo 1,0 giây (cung gỗ) sát thương 10, tốc độ 28; kéo 0,6 giây nội suy tuyến tính từ lực 0,2 (6,5 và 20, nằm trong dung sai đặc tả) | `test_combat2_bow_draw_force_damage_ammo_and_cooldown` | ✅ |
| C-AC16 | Bắn trừ đúng 1 mũi tên và 10 thể lực; hết mũi tên `no-ammo`; không đủ thể lực `tired`; hai lần bắn cách < 0,4 giây thì lần sau `cooldown` | `test_combat2_bow_draw_force_damage_ammo_and_cooldown` | ✅ |
| C-AC17 | Mũi tên có trọng lực (rơi 1,1 ± 0,3 block sau 0,5 giây), xoá khi chạm block hoặc vượt tầm/4 giây, không trúng người chơi, trúng quái trừ máu + `aggro` + kill tính cho người bắn | `test_combat2_arrows_fall_stop_at_blocks_skip_players_and_credit_kills` | ✅ |
| C-AC18 | Trúng quái, 30% mũi tên rơi lại (100 lần, RNG cố định: 20 tới 40) | `test_combat2_arrows_sometimes_drop_back_and_skeletons_drop_arrows` | ✅ |
| C-AC19 | Giơ khiên: tốc độ x0,6, cấm sprint (vật lý `input.slow`), từ chối `hit` (`guard`) và `draw` (`busy`); không giơ khi không có khiên, cầm đồ ăn, bị choáng | `test_combat2_shield_blocks_front_arc_costs_stamina_and_armor_applies_after`, `test_combat2_guard_rules_no_hit_or_draw_while_guarding` | ✅ |
| C-AC20 | Khiên gỗ chặn trong cung ±60 độ phía trước: 10 còn 4, thể lực -20; khiên sắt 10 còn 2, thể lực -15; sau lưng hoặc lệch 65 độ nhận đủ; giáp áp sau khiên; đạn chặn được | `test_combat2_shield_blocks_front_arc_costs_stamina_and_armor_applies_after` | ✅ |
| C-AC21 | Đòn không có `src`, `pure`, `blockable: false` (đập vùng và nhảy đập của boss) bỏ qua khiên; kiểm cờ ở `sim/boss.js` | `test_combat2_shield_blocks_front_arc_costs_stamina_and_armor_applies_after`, `test_combat2_boss_slams_ignore_shield_but_can_be_rolled` | ✅ |
| C-AC22 | Đỡ hoàn hảo trong 0,25 giây đầu: 0 sát thương, 0 thể lực, quái choáng 0,8 giây và mất báo hiệu, boss không bị choáng; giơ ở 0,30 giây thì chặn thường; giơ lại < 0,5 giây không có cửa sổ mới | `test_combat2_shield_perfect_parry_window_and_cooldown` | ✅ |
| C-AC23 | Vỡ khiên (thiếu thể lực): nhận toàn bộ sát thương qua giáp (tối thiểu 1), thể lực 0, choáng 1 giây, hạ khiên, sự kiện `shield {broke}` | `test_combat2_shield_perfect_parry_window_and_cooldown` | ✅ |
| C-AC24 | Lăn huỷ giơ khiên và kéo cung; kéo cung quá 0,3 giây thì không lăn được (`busy`); choáng thì `stun` | `test_combat2_roll_cost_cooldown_iframes_and_cancels` | ✅ |
| C-AC25 | 9 công thức mới (cung, cung sắt, mũi tên x4, khiên gỗ, khiên sắt, 3 giáo, chùy sắt) đúng nguyên liệu và trạm; `validate.js` sạch và bắt cung thiếu `bow`, khiên thiếu `shield`, lớp vũ khí lạ, công thức hỏng | `test_combat2_new_items_recipes_content_valid_and_distinct_icons` | ✅ |
| C-AC26 | 9 vật phẩm mới có icon riêng (data URL khác nhau, không trống) | `test_combat2_new_items_recipes_content_valid_and_distinct_icons` | ✅ |
| C-AC27 | Xương Cung Thủ rơi 2 tới 5 mũi tên với xác suất 0,6 ± 0,15 (100 lần); Lò rèn bán mũi tên (2 xu một mũi) | `test_combat2_arrows_sometimes_drop_back_and_skeletons_drop_arrows`, `test_combat2_new_items_recipes_content_valid_and_distinct_icons` | ✅ |
| C-AC28 | HUD: thanh thể lực đúng tỷ lệ (vàng dưới 40, đỏ khi kiệt sức), vòng kéo cung đầy ở 1,0 giây, số mũi tên, 3 chấm chuỗi sáng đúng số đòn, biểu tượng khiên sáng khi giơ, viền sáng đỡ hoàn hảo/vỡ khiên | `test_combat2_hud_and_equipment_ui`, `test_combat2_poses_effects_sounds_and_toasts` | ✅ |
| C-AC29 | Màn trang bị có ô Tay phụ: bấm phải khiên trong kho để đeo, bấm ô để cởi; cung/giáo không đeo được; mô tả hiện lớp vũ khí, hồi chiêu, thể lực/đòn, tầm, đặc trưng; cung hiện sát thương nhỏ nhất/lớn nhất; khiên hiện % giảm | `test_combat2_hud_and_equipment_ui`, `test_combat2_offhand_equip_unequip_and_save_roundtrip` | ✅ |
| C-AC30 | Đa người chơi: khách giơ khiên thì host và khách thứ hai thấy `act` = 1 và khiên đeo; lăn thì `act` = 3 trong 0,45 giây rồi hết, host bù trễ 0,08 giây cho khách | `test_combat2_multiplayer_guard_roll_bow_and_cheating_clients` | ✅ |
| C-AC31 | Khách bắn cung: mũi tên hiện ở snapshot của cả hai, trúng quái, kill tính cho khách | `test_combat2_multiplayer_guard_roll_bow_and_cheating_clients` | ✅ |
| C-AC32 | Khách gửi `force`, `power`, `since`, `time` giả: host bỏ qua (bắn không kéo thì không bắn; bắn ngay sau khi kéo là `weak`; cửa sổ đỡ hoàn hảo không kéo dài được) | `test_combat2_multiplayer_guard_roll_bow_and_cheating_clients`, `test_combat2_snapshot_fields_and_cheating_clients_cannot_fake_force_or_time` | ✅ |
| C-AC33 | Lưu/nạp: `offhand` lưu và nạp; save cũ không có `offhand` nạp được; `offhand` lạ/không phải khiên bị loại; thể lực, kiệt sức, chuỗi, kéo/giơ về mặc định; `SAVE_VERSION` vẫn 2 và save v1 nạp được | `test_combat2_offhand_equip_unequip_and_save_roundtrip` | ✅ |
| C-AC34 | Hồi sinh: thể lực đầy, mọi trạng thái giơ khiên/kéo cung/lăn/choáng/chuỗi xoá sạch, khiên đeo giữ nguyên | `test_combat2_respawn_resets_fight_state` | ✅ |
| C-AC35 | Hồi quy: 106 bài gốc + bài các gói trước và `test_net.py` 21 bài vẫn xanh (xem bài cũ phải sửa bên dưới) | toàn bộ `tests/` | ✅ |
| C-X1 | Tư thế người chơi khác theo `act` (giơ khiên, kéo cung, lăn, choáng), khiên hiện trên tay trái, quái ngả người khi báo hiệu, camera hạ thấp khi lăn, âm thanh/toast tiếng Việt ("Hết sức!", "Hết mũi tên!", "Khiên vỡ!") | `test_combat2_poses_effects_sounds_and_toasts` | ✅ |
| C-X2 | Hiệu năng: tick với 40 quái chạy hết + 5 người giơ khiên + mũi tên avg < 5 ms, worst < 25 ms | `test_combat2_perf_tick_with_fights` | ✅ |

Bài cũ phải sửa có chủ đích: `test_survival_hunger_exertion` (kiếm có hồi chiêu 0,8 giây sau đòn 3 và mỗi đòn tốn thể lực: nhịp đánh đổi thành 0,9 giây và đổ đầy thể lực mỗi lượt, kết quả mệt/đói giữ nguyên); `test_ui_inventory_shows_equipment_stations_and_equips_by_right_click` (4 ô giáp + ô Tay phụ = 5 ô). Các bài đo quái cắn (`test_mob_ai_chase_melee_closes_in_and_bites`, `test_hit_from_behind_...`) vẫn xanh nhờ cửa sổ thời gian dài; chỉ thêm 0,35 tới 0,6 giây báo hiệu.

Giới hạn đã biết của Gói 3: thể lực chạy nước rút chỉ là ràng buộc mềm (host không chặn được tốc độ thật, `applyState` chỉ giới hạn quãng đường, khách gian lận báo `vx = 0` thì không bị trừ thể lực); khách giơ khiên/kéo cung dự đoán cục bộ nên nếu host từ chối (đồ ăn trên tay, choáng) khách đi chậm đến khi nhả phím; sai lệch khi lực kéo 0,6 giây: sát thương 6,5 và tốc độ 20 (đặc tả ghi 6,6 và 21 ± 1, lấy nội suy tuyến tính từ lực 0,2 như mục 4.5); mũi tên không trúng thú đã thuần (tránh bắn nhầm); hoạt ảnh tay cung/khiên ở góc nhìn thứ nhất chỉ là dịch chuyển tấm icon, chưa có mô hình tay riêng; chưa nghe thử bằng tai các âm mới; PvP, độ bền, phù phép, mũi tên đặc biệt vẫn ngoài phạm vi.
