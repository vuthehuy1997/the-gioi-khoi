# Thế Giới Khối

Game thế giới khối chạy ngay trên trình duyệt, không cần máy chủ: đào và xây, đánh quái, hạ boss, làm nhiệm vụ. Chơi một mình, hoặc cùng tối đa 5 người: một người tạo phòng (làm host), những người khác vào bằng mã phòng qua WebRTC (thư viện Trystero).

**Chơi:** https://vuthehuy1997.github.io/the-gioi-khoi/ → "Chơi ngay".

## Có gì trong game

- **Thế giới voxel** sinh từ seed, sáu vùng: Rừng Sương, Sa Mạc Lửa, Núi Băng và ba vùng mọc thành mảng bên trong chúng: **Đầm Lầy Mục** (trong rừng: thấp, nhiều ao, rêu, bùn, lau sậy, nấm phát sáng), **Núi Lửa Tro** (trong sa mạc: núi tro và bazan, đá nham thạch nóng bỏng chân, hoa lửa), **Vực Pha Lê** (trong núi băng: đỉnh cao, trụ thạch anh tím, hoa pha lê); địa hình, cây, quái, màu trời đều khác nhau; hang động, quặng, nước; chu kỳ ngày đêm.
- **Đào / đặt block** có độ cứng và bậc công cụ (tay, gỗ, đá, sắt, tinh thể, ngọc); kho đồ 36 ô, thanh nhanh 1–9.
- **Chế tạo theo trạm** (~70 công thức): thủ công; **bàn chế tạo** (công cụ, đồ xây dựng); **lò nung** (than củi, luyện thỏi sắt từ quặng sắt dưới lòng đất, kính, thịt nướng); **đe rèn** (đồ sắt, trang bị, vũ khí). Đứng trong 4 block quanh trạm là chế được.
- **Trang bị 4 ô** (mũ, áo, quần, giày) với 6 bộ theo tài nguyên vùng: lông thú (chống lạnh), vỏ bọ cạp (chống nóng), sắt, vảy cá sấu (chống độc), than hồng (chống nóng, giày đi được trên nham thạch), pha lê (chống lạnh, giáp cao nhất). Mỗi điểm giáp giảm 4% sát thương (tối đa 75%). Bấm chuột phải vào trang bị trong kho để mặc.
- **Môi trường theo vùng**: Sa Mạc nóng, Núi Băng lạnh, Đầm Lầy độc, Núi Lửa nóng hơn, Vực Pha Lê lạnh hơn; mỗi món chống đúng loại giảm sát thương môi trường một điểm mỗi nhịp 4 giây (vùng cấp 2 cần 2 món, vùng cấp 3 cần 3 món để miễn nhiễm).
- **6 vũ khí di vật** rèn từ chiến lợi phẩm boss (Kiếm Nanh Sói, Dao Bọ Cạp Chúa, Rìu Băng Đế, Chùy Chúa Đầm Lầy, Kiếm Nham Thạch, Kiếm Lăng Kính).
- **Xây dựng**: đuốc (không sinh quái trong 8 block), cửa (bấm phải để đóng/mở), rương 27 ô (lưu cùng thế giới, phá thì đồ rơi ra), giường (đặt điểm hồi sinh), kính, gạch đá.
- **18 loại quái** (mỗi vùng có quái riêng: ếch độc, rắn, cá sấu, nấm lang thang ở đầm lầy; thằn lằn nham thạch, linh hỏa ở núi lửa; nhện, thỏ, hộ vệ pha lê ở vực pha lê; cáo ở rừng) với 4 kiểu AI (đuổi cận chiến, bỏ chạy, bắn xa giữ khoảng cách, canh giữ), sinh theo vùng và ngày/đêm, có bảng rơi đồ. Quái **phải nhìn hoặc nghe thấy bạn** mới đuổi: có nón nhìn theo hướng quay mặt (vòng ra sau lưng thì không bị thấy), tường và cây che tầm nhìn, thanh cảnh giác tăng dần (`?` vàng rồi `!` đỏ trên đầu), tiếng động (đào, đặt, đánh, chạy nước rút) làm quái chạy tới kiểm tra, mất dấu thì lục soát chỗ thấy cuối rồi bỏ cuộc, sói tru gọi cả đàn, bị đánh từ sau thì quay lại truy đuổi. Rón rén (giữ C) giảm một nửa tầm nhìn và không gây tiếng.
- **6 boss nhiều pha** ở đấu trường riêng (ba boss vùng chính + **Chúa Đầm Lầy**, **Vua Nham Thạch**, **Đại Hộ Vệ Pha Lê** ở ba vùng mới), mỗi boss có chiêu khác nhau (đánh cận, nhảy đập, gọi quái, bắn loạt, đập vùng có báo hiệu). Máu và sát thương tăng theo số người trong đấu trường. Hạ boss mở an toàn cho vùng kế tiếp (vùng chưa mở có khí độc gặm máu).
- **7 NPC** ở sáu làng (ba làng mới ở đầm lầy, núi lửa, vực pha lê, mỗi làng có thương nhân riêng), hội thoại dạng đồ thị, hai cửa hàng (mua bán bằng xu), **18 nhiệm vụ** (nhặt, hạ quái, hạ boss, đến vùng; ba nhiệm vụ dẫn tới ba vùng mới, ba nhiệm vụ tiếp theo là hạ boss của chúng, sáu nhiệm vụ của ba NPC làng mới).
- **Âm thanh và nhạc nền** tạo bằng code: mỗi vùng một chủ đề nhạc riêng (đêm chậm và thưa hơn), boss có nhạc trống dồn; tiếng kêu theo loài quái (báo động, đau, gục, thỉnh thoảng kêu khi rảnh), tiếng môi trường theo vùng (chim, dế, gió, ếch, nham thạch, chuông pha lê). M bật/tắt nhạc, thanh âm lượng trong menu tạm dừng.
- **Lưu / nạp** thế giới trong IndexedDB, xuất và nhập file `.gz`.

## Điều khiển

WASD đi · Space nhảy · Shift chạy (ồn, dễ bị thấy) · giữ C rón rén (êm, khó bị thấy) · chuột trái đào/đánh (giữ) · chuột phải đặt block / nói chuyện NPC / ăn / mở cửa, rương / đặt điểm hồi sinh ở giường (giữ C để đặt block cạnh chúng) · 1–9 hoặc lăn chuột chọn ô · E kho đồ và chế tạo · Esc tạm dừng. Chỉ hỗ trợ máy tính (bàn phím + chuột).

## Chạy trên máy

```
python3 -m http.server 8003      # rồi mở http://localhost:8003/games/the-gioi-khoi/game.html
python3 tests/test_game.py       # logic, mô phỏng, nội dung, hiệu năng, e2e hai trình duyệt
python3 tests/test_net.py        # lớp mạng platform/net và trang thử kết nối
```

Test cần Python Playwright (Chromium). Không có bước build. Muốn thử hai người trên một máy: thêm `?net=memory` (hai tab cùng trình duyệt, không cần mạng); chế độ mặc định dùng WebRTC thật và cần HTTPS hoặc `localhost`.

## Cấu trúc

```
games/the-gioi-khoi/
  world/    noise, block, vùng, sinh chunk, World (delta, raycast)
  sim/      Game (người chơi, đào/đặt, chiến đấu), mobs, boss, quests, dialogue, structures, physics, inventory, crafting, daynight
  content/  dữ liệu thuần: items, recipes, mobs, bosses, npcs, quests, shops, regions + validate.js (kiểm tra tham chiếu)
  net/      HostSession, ClientSession, snapshot
  render/   atlas texture tự vẽ, mesher, scene Three.js, chunkview, entities
  ui/       HUD, bảng kho đồ/hội thoại/cửa hàng
  audio/    score (soạn nhạc thuần), director (nối nhạc, môi trường, tiếng quái với trạng thái game)
  save.js   IndexedDB, xuất/nhập
platform/
  net/      mã phòng, Room, transport (bộ nhớ, Trystero), ping/băng thông, vòng lặp tick cố định
  vendor/   Three.js, Trystero (xem VENDOR.md)
docs/ACCEPTANCE.md   tiêu chí hoàn thành và trạng thái
```

`sim/` và `world/` không phụ thuộc DOM hay mạng, nên chạy được trong test và có thể đưa lên máy chủ thật về sau.

## Giới hạn đã biết

- Host là một trình duyệt: người tạo phòng phải giữ tab ở phía trước và thế giới chỉ chạy khi họ còn mở. Vị trí người chơi do máy khách báo (host chỉ kiểm tra tốc độ), nên không chống gian lận; phù hợp chơi với bạn bè.
- Kết nối WebRTC qua relay công cộng đôi khi cần thử lại; chưa đo trên nhiều thiết bị khác mạng (xem `docs/superpowers/specs`).
- Chưa có PvP, cảm ứng/điện thoại. Chưa có bậc thang và nửa khối, đuốc chưa tạo ánh sáng thật (chỉ đuổi quái), trang bị chưa hiện trên người chơi khác, chưa có đói/khát hay nâng cấp phù phép. Âm thanh và nhạc đều tổng hợp bằng Web Audio (không có file âm thanh), tôi chưa nghe thử bằng tai nên cần người chơi thật đánh giá độ hay và độ to.
- Art là texture tự vẽ bằng mã (không dùng gói ngoài); mô hình quái là các khối hộp có xương và texture tự vẽ (xem `games/the-gioi-khoi/models.html?id=wolf,frog` để ngắm từng con).

## Bảng thiết kế (Game Design Dashboard)

Bảng quản lý thiết kế dạng trang Artifact (giới thiệu, cốt truyện, thực thể, lời thoại, nhiệm vụ, vật phẩm, kế hoạch nâng cấp): dev chỉnh ghi chú, đề xuất và thẻ kế hoạch; agent đọc kho dữ liệu của trang để lập kế hoạch. Dữ liệu game trên bảng được lấy tự động từ mã nguồn:

```
python3 tools/export_design_data.py   # gom nội dung + ảnh mô hình/icon vào design/design-data.json
python3 tools/build_dashboard.py      # dựng design/dashboard.html từ tools/dashboard/template.html
python3 tests/test_dashboard.py       # kiểm thử bảng với kho dữ liệu giả lập
```
