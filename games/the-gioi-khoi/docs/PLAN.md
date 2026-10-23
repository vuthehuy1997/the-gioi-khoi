# Kế hoạch nâng cấp: 3 gói (Sinh tồn, Chiến đấu, Hầm ngục)

Người lập: PM. Căn cứ: `docs/specs/survival.md`, `combat.md`, `dungeon.md` (BA), README, `docs/ACCEPTANCE.md`, mã hiện tại (5.7k dòng JS; 106 bài `test_game.py`, 21 bài `test_net.py`, đều xanh).
Quy tắc cứng: không push, không đụng token, chỉ commit cục bộ khi người dùng yêu cầu. Không build, không node. Hình/âm sinh bằng code, giao diện và văn bản tiếng Việt, comment tiếng Việt ngắn theo phong cách hiện có.

## 1. Thứ tự và lý do

**Thứ tự: Gói 1 Sinh tồn, rồi Gói 3 Chiến đấu, rồi Gói 2 Hầm ngục.** Các gói chạy tuần tự, không song song, vì cùng sửa các file lõi: `sim/game.js` (tick, `act`, người chơi), `sim/combat.js` (`hurtPlayer`, hồi chiêu), `sim/mobs.js` (spawn, dọn quái), `net/snapshot.js` + `net/host.js` (`youOf`, snapshot, `REPORT`), `world/blocks.js` + `render/atlas.js` + `render/mesher.js` (id block, atlas), `content/items|recipes|shops|quests|validate.js`, `ui/icons.js`, `save.js`.

Lý do:
1. **Sinh tồn trước**: nó đặt các nền móng mà hai gói sau dùng lại: nâng `SAVE_VERSION` lên 2, mở rộng atlas, tuỳ chọn `Game({hunger:false})`, cờ "quái/thú không bị xoá khi xa", cơ chế `fx` (hiệu ứng theo thời gian), hành động `act` mới có báo lý do. Phạm vi rõ, ít đụng vào các bài test cũ (chỉ ăn và hồi máu).
2. **Chiến đấu trước Hầm ngục**: (a) đổi `hurtPlayer` thành một đường ống duy nhất (bất khả xâm phạm, khiên, giáp, tối thiểu 1); bẫy, mũi tên bẫy và chủ hầm viết một lần trên đường ống mới, không phải vá lại; (b) báo hiệu đòn (windup) là thay đổi hành vi toàn bộ quái, làm sớm khi chưa có thêm 6 chủ hầm và quái hầm; nó sẽ làm vỡ một số bài cũ, cần xử lý khi lõi còn nhỏ; (c) trường `weapon` bắt buộc cho mọi vũ khí, nên `delver_blade` của hầm vào đúng khuôn ngay từ đầu; (d) cung của người chơi dùng lại `proj` kiểu `arrow` như mũi tên bẫy, thống nhất cách phân biệt đạn người chơi và đạn quái/bẫy.
3. **Hầm ngục cuối**: lớn và rủi ro nhất (sinh thế giới, delta, atlas, boss dưới lòng đất, 6 chủ đề). Làm khi lõi đã ổn định và đã có đủ công cụ (đói, hiệu ứng, thể lực, khiên, cung) để hầm có ý nghĩa; và nếu hết sức thì cắt phạm vi hầm (mục 7) mà không ảnh hưởng hai gói đã xong.
4. Mỗi gói kết thúc bằng một cổng nghiệm thu (DoD, mục 5); không bắt đầu gói sau khi gói trước chưa qua cổng.

## 2. Quy trình mỗi lát (slice)

Một lát là đơn vị nhỏ nhất có thể kiểm thử, vào/ra theo chuỗi sau:

1. **BA**: chốt AC của lát từ đặc tả (đã có), ghi điều chỉnh nếu mâu thuẫn (mục 3).
2. **Leader**: duyệt thiết kế kỹ thuật ngắn (file nào sửa, id block, trường snapshot/save), chia việc, giữ lõi nhất quán giữa các gói.
3. **Dev**: viết test trước (red), rồi code (green), kèm icon + UI + sfx của lát; giữ phong cách code.
4. **Tester**: chạy toàn bộ `tests/test_game.py` + `tests/test_net.py`, thử vai trò khách qua `?net=memory`, thử lưu/nạp, soi lỗi console; thử phá (gửi act giả, hai người cùng hành động).
5. **Leader review** diff (đúng kiến trúc host-authoritative, không rò state client).
6. **PM nghiệm thu**: đối chiếu AC của lát, cập nhật bảng tiến độ ở cuối file này. Lát chưa xanh thì không qua lát kế.

Quy tắc chung: sau mỗi lát cả 106 + 21 bài cũ vẫn xanh (trừ bài phải sửa có chủ đích, ghi lý do ngay trong bài); số bài chỉ tăng. Bài mới đặt tiền tố `test_survival_*`, `test_combat2_*`, `test_dungeon_*`; bài mạng vào `test_net.py`.

## 3. Điều chỉnh phạm vi và quyết định giải mâu thuẫn giữa các đặc tả

| # | Vấn đề | Quyết định |
|---|---|---|
| 1 | Atlas: Sinh tồn đề xuất `ATLAS_ROWS` 9 (cần 14 tile), Hầm ngục đề xuất 8 (cần 10 tile); hiện 49/56 ô dùng, tổng cần 73 | Nâng **một lần** lên **10 hàng (80 ô)** ngay lát S0, kiểm toàn bộ UV mesher và test render. Hai gói sau không đổi atlas nữa |
| 2 | Id block | Sinh tồn 40 tới 53 (đúng đặc tả), Hầm ngục 54 tới 61; không đổi id cũ (save cũ đúng). Còn dư nhiều dưới trần 255 |
| 3 | `SAVE_VERSION`: Sinh tồn lên 2, Hầm ngục giữ `v:1`, Chiến đấu "nếu gói khác đã nâng thì giữ tương thích" | Nâng 2 **một lần** ở S0 (nâng cấp v1 ở `checkVersion`). Gói 3 và 2 chỉ thêm trường tuỳ chọn (`offhand`, `flags.dungeons`, `flags.sites.dungeon`), thiếu thì coi là rỗng; không nâng nữa |
| 4 | Gai nhô theo `g.time` nhưng mesh chunk tĩnh, tile 2 trạng thái trong block không đổi theo thời gian | Block `SPIKES` là **một** tile tĩnh (sàn có lỗ gai); gai chuyển động vẽ bằng lớp phủ động (hộp nhỏ trong `render/effects.js`) tính từ `g.time`, chỉ trong 40 block quanh người chơi. Ống phun sáng cũng là lớp phủ. AC-19 hầm: tile block mới >= 9 và khác nhau (thay vì đúng 10 với 2 tile gai) |
| 5 | Thể lực (Chiến đấu) và đói (Sinh tồn): Sinh tồn có nhắc có thể dùng chung `food` | **Độc lập**. Thể lực không phụ thuộc đói trong vòng này; đói chỉ ảnh hưởng hồi máu. Ghi vào cả hai tài liệu |
| 6 | Thứ tự nhân sát thương: Chiến đấu "floor(dmg x hệ số) tối thiểu 1", Sinh tồn "Sức mạnh x1,25 làm tròn lên" | Công thức duy nhất trong `sim/combat.js`: `floor(dmg x hệ số vũ khí/đòn)`, rồi x1,5 nếu đòn rơi, rồi **Sức mạnh x1,25 làm tròn lên ở bước cuối**, tối thiểu 1. Kiếm sắt đòn 1: 6 sang 8 (khớp AC-6 Sinh tồn) |
| 7 | Đường ống sát thương người chơi | `hurtPlayer`: bất khả xâm phạm (chỉ đòn có `src`) -> khiên (chỉ đòn `src` và `blockable`, cung trước 120 độ) -> giáp (gồm Da dày) -> tối thiểu 1. Đói/độc/nóng lạnh/khí độc không có `src`, không bị né/chặn. Gai và phun của hầm có `src:'trap'`, `blockable:false` (lăn né được, khiên không chặn); mũi tên bẫy có `src:'trap'`, `blockable:true`. Chiêu đập vùng của boss `blockable:false` (cờ trong `content/bosses.js`, thêm ở Gói 3, dùng ở chủ hầm Gói 2) |
| 8 | Chuột phải bị tranh: ăn, cày, gieo, cho thú ăn, cắt len, mở cổng/rương (Sinh tồn + Hầm) và giơ khiên (Chiến đấu) | Giữ thứ tự ưu tiên của Sinh tồn (NPC, thú, block dùng được, cây chín, cuốc, hạt, đặt block, ăn). **Giơ khiên bằng chuột phải chỉ khi** chuột phải không có việc nào ở trên (tay cầm không phải đồ ăn/hạt/block/cuốc/kéo và mục tiêu không tương tác được); phím **F luôn giơ khiên**. Ghi vào màn hướng dẫn điều khiển |
| 9 | Thể lực đổi mỗi tick nhưng `youOf` chỉ đẩy khi `rev` đổi (sẽ bắn gói liên tục) | `stamina` (làm tròn nguyên), `exhaust`, `combo` đi cùng mục người chơi chủ trong snapshot (tần suất snapshot sẵn có), không `touch(p)`. `offhand`, `food`, `fx` đi qua `youOf` như đặc tả |
| 10 | Bài cũ phụ thuộc hồi chiêu 0.5 s cố định, đòn quái tức thì, hồi máu cũ | Đói: `Game({hunger:false})` cho bài cũ (AC-26 Sinh tồn). Chiến đấu: sửa tối thiểu bài cũ theo AC-8 và AC-14 của Gói 3, ghi lý do trong bài; không thêm cờ tắt windup |
| 11 | Dụng cụ có `dmg` (cuốc đất 1 tới 3, cuốc cổ vật) vs luật "mọi vũ khí có `weapon`" | `validate.js` chỉ bắt `weapon` với vật phẩm loại vũ khí (kiếm, rìu, chùy, giáo, vật phẩm di vật); cuốc/kéo/cuốc cổ vật không bắt buộc. Cuốc cầm đánh dùng giá trị mặc định tay không |
| 12 | Cờ "không xoá khi xa người chơi" cần cho thú nuôi (Sinh tồn), quái hầm (Hầm, 30 block), `guard` | Một thuộc tính duy nhất trên thực thể (`persist`) kiểm ở chỗ dọn quái trong `sim/mobs.js`; làm ở S0, hai gói sau dùng lại. Quái tự nhiên không sinh trong khối bao hầm cũng đi qua một hàm vị trí cấm sinh |
| 13 | Đạn người chơi và đạn quái/bẫy khác nhau | `proj.owner` = uid (đạn người chơi: chỉ trúng quái/boss, tính kill cho uid); `owner` rỗng/quái (trúng người chơi). Thiết kế ở C5, hầm D4 dùng mũi tên bẫy với `owner` rỗng |
| 14 | Câu hỏi mở BA/Leader | Sinh tồn: giữ `heal` cũ (cooked_meat 11, stew 14), dùng NPC hiện có ở làng Rừng Sương, không thêm phím gọi thú, trần 24 thú và tầm 64 chốt sau khi đo AC-25. Hầm ngục: **chìa không rơi khi chết** (cờ `bound` trên `dungeon_key`/`boss_key`), nên không kẹt khi solo; `heal_potion` có `food:0`; cầu thang 12 bậc phải đi lên bằng nhảy thường (test D1) |
| 15 | `heal_potion` (Hầm) và luật "no ăn khi đầy cả đói và máu" (Sinh tồn) | Áp dụng chung: bình chỉ dùng được khi `hp` chưa đầy; từ chối `full` như đồ ăn |

Phần phải **cắt ngay từ đầu** (không nằm trong vòng này, theo đặc tả mục 9 của cả ba gói): PvP, độ bền, phù phép, mũi tên đặc biệt, nỏ, bố cục hầm ngẫu nhiên, khát nước, câu cá, máy móc tự động, bản đồ/la bàn, mô hình boss mới, tùy biến phím.

## 4. Các gói và lát

Kích cỡ: S nhỏ, M vừa, L lớn (so tương đối). Mỗi lát phải kết thúc với: test mới xanh, hồi quy xanh, icon + UI (nếu có), lưu/mạng đã xử lý (nếu có).

### Gói 1: Sinh tồn & kinh tế (tiền tố `test_survival_*`)

| Lát | Nội dung | AC đặc tả | Cỡ |
|---|---|---|---|
| S0 Nền chung | Atlas 10 hàng + kiểm mesher/UV; đặt trước id 40 tới 61; `SAVE_VERSION` 2 + nâng cấp v1; `Game({hunger:false})`; cờ `persist` cho thực thể; `REPORT` thêm lý do; ghi điều chỉnh vào tài liệu | 26 | M |
| S1 Đói, ăn, hiệu ứng | `food`, mệt, hồi máu/chết đói theo đói, bảng ăn (`food`, `fx`, `risk`), ngộ độc, 3 hiệu ứng (Hồi phục, Sức mạnh, Da dày), hồi chiêu ăn; `youOf` thêm `food`/`fx`; HUD đói + hàng hiệu ứng, tooltip kho, toast; lưu `food/fatigue/fx/poison`; đặt công thức Sức mạnh theo mục 3.6 | 1 tới 6 | L |
| S2 Cuốc, ruộng, cây | Block 40 tới 53 + tile vẽ bằng code; 3 cuốc + kéo; `till`, `plant`, `harvest`; ướt/khô, quay về dirt, lớn theo mốc, hệ số vùng lạnh, chỉ mô phỏng trong 64 block; hạt từ cỏ cao/Xác Sống; đồng bộ qua `block`/delta; tooltip cây; lưu `crops`/`farm`; icon vật phẩm | 7 tới 14 | L |
| S3 Thú nuôi | `ga`, `cuu`, `lon` (AI `farm`, `AI_KINDS`), mô hình + bản non (có trong `models.html`), tiếng kêu; thuần hoá, theo người, sinh sản, lớn, trứng/len/thịt, trần 24, miễn dọn quái; cờ snapshot `tm/lv/ba/sh`; `feed`/`shear`; tooltip thú; lưu `animals` | 15 tới 19 | L |
| S4 Nấu ăn, kinh tế, nhiệm vụ | 7 món + `bed_wool`, công thức lò; mua/bán ở `thuong-nhan`/`ngu-dan`; nhiệm vụ "Vụ mùa đầu tiên"; `validate.js` (nguồn vật phẩm, AI mới); `tools/export_design_data.py` | 20, 21 | M |
| S5 Chốt gói | E2E hai người, lưu/nạp trọn gói, giao diện/ảnh chụp, hiệu năng (24 thú + 40 quái + 500 cây), README + ACCEPTANCE, dashboard | 22 tới 26 | M |

### Gói 3: Chiến đấu có chiều sâu (tiền tố `test_combat2_*`)

| Lát | Nội dung | AC | Cỡ |
|---|---|---|---|
| C0 Nền chiến đấu | `sim/rules.js` (hằng số), trạng thái chiến đấu trên người chơi ở host, `hurtPlayer` thành đường ống (mục 3.7), khung `act` (`roll/guard/draw/shoot`) + từ chối có lý do, `stamina` trong snapshot (mục 3.9), validate `weapon` | 1, 35 | M |
| C1 Thể lực | Tiêu/hồi/kiệt sức, chặn chạy ở host và client, thanh thể lực HUD, toast "Hết sức!", hồi sinh/nạp đầy | 2 tới 4, 13 (phần chạy), 34 | M |
| C2 Lăn né | Q + WASD, 0.45 s / 3.5 block, bất khả xâm phạm 0.05 tới 0.35 s, hồi chiêu 0.8 s, host cho phép trượt tốc độ, camera + âm | 5 tới 7, 24 (phần lăn) | M |
| C3 Báo hiệu đòn quái | `windup` 0.35/0.6 s, trúng nếu còn trong `range + 0.4`, sự kiện `windup`, hoạt ảnh nghiêng/báo; **sửa bài cũ phụ thuộc đòn tức thì** | 14 | M |
| C4 Vũ khí theo lớp | `weapon` cho 12 vũ khí hiện có; kiếm chuỗi 3 đòn, rìu quét, chùy choáng (+ cờ `stun`), giáo tầm 6, đòn rơi x1.5; 4 vũ khí mới (3 giáo, chùy sắt) + công thức + icon; mô tả vật phẩm; chấm chuỗi HUD; sửa `HIT_CD` cố định | 8 tới 13, 25 (phần giáo/chùy), 26 | L |
| C5 Cung, mũi tên | Kéo bằng giữ chuột trái (host đo đồng hồ), bắn, trọng lực, xuyên không, rơi lại 30%, `owner` uid, kill tính cho người bắn; `bow`, `iron_bow`, `arrow` + công thức + icon; Xương Cung Thủ rớt mũi tên; bán mũi tên (nếu có hàng vũ khí); vòng kéo HUD; tay cầm cung (dây căng) | 15 tới 18, 25, 27, 28 | L |
| C6 Khiên, tay phụ | `offhand` (ô trang bị, mặc/cởi), giơ khiên, chặn cung trước 120 độ, đỡ hoàn hảo, vỡ khiên, choáng người chơi, `blockable` cho boss đập vùng; lưu `offhand`; icon khiên; UI | 19 tới 23, 29, 33 | L |
| C7 Chốt gói | Hoạt ảnh `act` cho người khác (khiên, cung, lăn, choáng), âm thanh còn thiếu, E2E mạng (khiên/lăn, cung, giả mạo act), màn hướng dẫn phím, README + ACCEPTANCE | 30 tới 32, 35 | M |

### Gói 2: Hầm ngục có chủ đề (tiền tố `test_dungeon_*`)

| Lát | Nội dung | AC | Cỡ |
|---|---|---|---|
| D0 Dữ liệu và block | 8 block (54 tới 61) + tile, `DUNGEON_WALL` không phá được; 6 vật phẩm mới (đã có `weapon` cho `delver_blade`) + icon; `content/dungeons.js`; mở rộng `validate.js` | 20 | M |
| D1 Dựng hầm | `buildDungeon` bằng delta (khuôn chung 80x25x12, 4 phòng, cầu thang, cổng 3x3), `findSite` với `minGap` 90, 6 chủ đề dạng dữ liệu (palette); dựng cho thế giới mới và save cũ (bỏ điểm đã chỉnh sửa), delta thắng generate, cấm sinh quái trong khối bao; đi bộ được từ cầu thang tới P4 | 1 tới 3, 16 (save cũ), 18 (sinh) | L |
| D2 Cổng, chìa, rương | `act` `gate` và `dchest`, `dungeon_key`/`boss_key` (cờ `bound`), rương `DCHEST` chia theo uid, thưởng tất định theo hash, `claimed` lưu, bảng "Chiến lợi phẩm", toast thiếu chìa | 10 tới 12 | M |
| D3 Phòng canh gác | Kích hoạt P2, 2 đợt, scaling theo số người, điểm sinh cố định, dọn khi xa 30 block, cờ đã dọn lưu, quái hầm miễn xoá 80 block | 4, 5, 18 | M |
| D4 Bẫy | Gai/tên/phun theo `g.time` (host tính sát thương, client vẽ lớp phủ), rón rén không kích tấm, gỡ bẫy bằng cuốc, đè gai, sfx; qua đường ống mục 3.7 | 6 tới 9, 21 (phần bẫy) | L |
| D5 Chủ hầm, thưởng, nhiệm vụ | 6 boss trong `content/bosses.js` (dùng engine sẵn, mô hình hiện có đổi màu), P4, rương kho báu xuất hiện sau khi hạ chủ, rơi xu + `ancient_shard`, công thức `ancient_pick`/`delver_blade`, giá mua `shop`, 6 nhiệm vụ "dọn hầm" | 13 tới 15 | L |
| D6 Chốt gói | HUD hầm (banner, "Phòng x/4 · Quái còn n", số chìa, gợi ý hướng), lưu/nạp trọn gói, E2E hai người, hiệu năng (<= 2 ms thêm, dựng <= 1,5 s), `tools/export_design_data.py` xuất hầm/chìa/bẫy, README + ACCEPTANCE | 16, 17, 19, 21 | M |

Tổng: 6 + 8 + 7 = 21 lát. Dự kiến thêm khoảng 120 bài test (Sinh tồn ~35, Chiến đấu ~45, Hầm ngục ~40) trên 106 + 21 hiện có.

## 5. Định nghĩa "xong" (Definition of Done)

Một **lát** xong khi:
- Test mới của lát xanh, và **toàn bộ** `python3 tests/test_game.py` + `python3 tests/test_net.py` xanh (không còn console error, không file 404); bài cũ sửa có ghi lý do.
- Mọi hằng số có tên (`sim/rules.js` hoặc content), không số ma; `validate.js` sạch và bắt được dữ liệu hỏng mới.
- Chạy được ở chế độ khách (host quyết định; client không tin trường thời gian/lực/đối tượng tự gửi), không thêm kênh mạng mới ngoài `act`/snapshot/sự kiện đã nêu.
- Dữ liệu mới có trong save (hoặc ghi rõ "không lưu" như đặc tả), save cũ vẫn nạp.
- Vật phẩm/block mới có icon/tile vẽ bằng code, khác nhau bằng mắt; thao tác mới có UI (HUD/tooltip/toast/panel) tiếng Việt.
- Leader đã review diff; Tester đã ký.

Một **gói** xong khi:
- Tất cả AC trong đặc tả gói có test tự động tương ứng và xanh (bảng AC -> tên test ghi trong ACCEPTANCE).
- `README.md` (mục "Có gì trong game", điều khiển, kiến trúc nếu thêm thư mục/file) và `docs/ACCEPTANCE.md` (hàng mới cho gói, cập nhật số bài) đã cập nhật.
- Trạng thái đa người chơi (hai trình duyệt) và lưu/nạp qua chu trình `toSave -> fromSave` và xuất/nhập `.gz` có bài riêng.
- Hiệu năng đạt các ngưỡng `test_perf_*` cũ (không nới ngưỡng) và ngưỡng riêng của gói.
- `tools/export_design_data.py` chạy không lỗi với dữ liệu mới.
- Không có file thừa, không commit/push trừ khi người dùng yêu cầu; PM ghi tiến độ vào mục 8.

## 6. Rủi ro và cách giảm

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Atlas 10 hàng làm lệch UV, vỡ test render/mesher | Cao | S0 làm riêng, chạy ngay `test_mesher_*`, `test_render_screenshot`, `test_visual_*` trước khi thêm tile nào |
| Windup (C3) và thể lực làm vỡ nhiều bài cũ (đòn tức thì, cd 0.5 s) | Cao | Làm C3 sớm, sửa bài tối thiểu theo AC-8/AC-14, tách commit/ghi chú lý do; không đổi sát thương/tầm/hồi chiêu quái |
| Đồng hồ host cho kéo cung/khiên, lăn dự đoán ở client gây giật hoặc bị host kéo về | Cao | Host chỉ mở ngưỡng tốc độ trong 0.45 s lăn; test `teleport` không xảy ra (AC-7); thử với độ trễ giả lập trong `test_net` |
| Chuột phải bị tranh giữa ăn/cày/gieo/khiên/cổng | Trung bình | Bảng ưu tiên cố định ở mục 3.8, có test cho từng nhánh; F luôn giơ khiên |
| Sinh hầm đè công trình/địa hình, chunk worker sinh đè delta | Cao | D1 test nhiều seed (>= 5), save có chỉnh sửa; xác nhận delta thắng generate trước khi dựng 6 chủ đề |
| Chi phí mô phỏng cây + thú + bẫy (host yếu) | Trung bình | Chỉ mô phỏng trong 64 block (cây/thú) và 40 block (bẫy/phòng); tick gộp cây mỗi 5 s; đo AC-25 Sinh tồn và AC-21 Hầm, chỉnh trần 24 thú/tầm 64 nếu cần |
| Kích thước save, snapshot tăng (cây theo block, cờ thú) | Thấp | Mỗi giai đoạn cây là id block (đã có delta); cờ thú <= 4 trường; đo kích thước save 1000 cây < 100 KB |
| Nhiều gói cùng sửa `content/shops.js`, `items.js`, `recipes.js` gây xung đột ý nghĩa (giá, id trùng) | Thấp | Tuần tự; `validate.js` bắt id trùng/tham chiếu hỏng; mỗi lát tự test công thức và cửa hàng của mình |
| Bất đồng bộ nhịp bẫy giữa máy | Thấp | Dùng `g.time` trong snapshot, không đồng bộ trạng thái; test lệch <= 0.2 s (AC-17 hầm) |
| Phạm vi quá lớn so với phiên làm việc | Cao | Làm theo lát, mỗi lát độc lập kiểm thử được; có thứ tự cắt ở mục 7 |

## 7. Phần cắt nếu quá lớn (theo thứ tự cắt trước)

Nguyên tắc: cắt **từ cuối** (Gói 2 trước), giữ lõi mỗi gói chạy được và đã qua DoD; không để lát dang dở.

1. **Hầm ngục**: từ 6 hầm xuống 3 hầm trước (Rừng Sương, Sa Mạc Lửa, Núi Băng); 3 hầm còn lại chỉ là dữ liệu chủ đề trên cùng khuôn, thêm sau. Cắt thêm: chỉ 2 loại bẫy (gai + tên), bỏ phun (vent); bỏ gợi ý hướng; bỏ công thức di vật; bỏ lớp phủ gai động (gai tĩnh gây sát thương theo nhịp, báo bằng âm).
2. **Chiến đấu**: bỏ rìu quét và chùy choáng (giữ kiếm chuỗi, giáo, đòn rơi); bỏ hoạt ảnh tay cung/khiên chi tiết (chỉ đổi mô hình tĩnh); bỏ "tay không đòn thể lực".
3. **Sinh tồn**: bỏ 1 trong 3 loài thú (lợn hoặc cừu + kéo); bỏ khoai tây (giữ lúa mì + cà rốt); bỏ `bed_wool`; hiệu ứng thức ăn còn Hồi phục và Sức mạnh.
4. **Không bao giờ cắt**: lưu/nạp, đồng bộ host, icon + UI cơ bản, test, hồi quy xanh, README + ACCEPTANCE.

## 8. Bảng tiến độ (PM cập nhật sau mỗi lát)

| Lát | Trạng thái | Test mới | Ghi chú |
|---|---|---|---|
| S0 tới S5 | chưa bắt đầu | | |
| C0 tới C7 | chưa bắt đầu | | |
| D0 tới D6 | chưa bắt đầu | | |

Cơ sở hiện tại: `test_game.py` 106 bài xanh, `test_net.py` 21 bài xanh.
