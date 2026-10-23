# Thiết kế kỹ thuật cho 3 gói nâng cấp (Sinh tồn, Chiến đấu, Hầm ngục)

Người viết: Tech Leader. Căn cứ: `docs/PLAN.md`, `docs/specs/survival.md`, `combat.md`, `dungeon.md`, và mã hiện tại (đã đọc: `sim/game.js`, `combat.js`, `mobs.js`, `boss.js`, `structures.js`, `physics.js`, `perception.js`, `rules.js`, `net/*`, `save.js`, `world/*`, `content/*`, `ui/*`, `game.js`, `render/atlas|mesher|entities|effects|camerafx`, `tests/*`). Thứ tự làm đúng PLAN: Sinh tồn (S0-S5), Chiến đấu (C0-C7), Hầm ngục (D0-D6).

Ký hiệu: "Ruling R-n" là quyết định của Leader khi đặc tả mâu thuẫn, không khả thi hoặc thiếu; Dev theo Ruling, không theo đặc tả gốc ở chỗ hai bên khác nhau. Mục 1 là danh sách đầy đủ các Ruling. Mục 2 là nền chung. Mục 3, 4, 5 là từng gói. Mục 6 là test harness, mục 7 là ngân sách hiệu năng, mục 8 là bẫy chung cần tránh.

Số liệu đo trên mã hiện tại (Playwright, seed 31337): dựng công trình 294 ms; delta sau `buildStructures` có 14 151 ô trong 69 chunk, 136 KB JSON; snapshot 1 người 371 byte. Các con số này là cơ sở cho ngân sách.

---

## 1. Phản biện đặc tả và các Ruling

### 1.1 Lỗi hoặc điểm không khả thi (phải sửa trước khi code)

| # | Vấn đề tìm thấy trong mã | Ruling |
|---|---|---|
| R-1 | **Tên sự kiện trùng**: đặc tả Chiến đấu đặt sự kiện `block {perfect}` cho khiên, nhưng `block {x,y,z,id}` đã là sự kiện đổi block (`Game.setBlock`, `ClientSession.handleEvent`, `confirmEdit` của `game.js`). Dùng lại sẽ làm client ghi `world.set(undefined…)`. | Đổi tên thành **`shield {perfect, broke}`**. Mọi sự kiện mới trong mục 2.5 đã kiểm không trùng tên với `you, hurt, kb, toast, block, swing, hit, killed, died, telegraph, pickup, fail, chest, shop, dialog, quests, region, teleport, boss-*`. |
| R-2 | **Khách không nhận được kết quả `act`**: `HostSession.act` trả `{ok}` ngay, nhưng `ClientSession.act` chỉ `room.send` (không trả gì); chỉ các hành động trong `REPORT` mới có sự kiện `fail` khi lỗi, không có sự kiện khi thành công. Đặc tả lăn nói "client tự lăn khi nhận `ok`" là không làm được. | Lăn, giơ khiên, kéo cung **dự đoán ở client** theo cùng hằng số `sim/rules.js`; host xác nhận bằng trạng thái trong snapshot (`ps[].act`, `me`). Host từ chối thì phát `fail {a, reason}` (thêm `roll`, `shoot`, `till`, `plant`, `harvest`, `feed`, `shear`, `gate`, `dchest` vào `REPORT`) và client huỷ phần dự đoán (dừng lăn, hạ tay). Không thêm kênh trả lời mới. |
| R-3 | **Bố cục hầm không nằm trong 80 x 25 x 12**: cộng dọc theo +X: cầu thang 24 + P1 11 + hành lang 6 + P2 11 + hành lang 6 + P3 17 + hành lang 6 + P4 19 = 100 block, chưa kể tường; chiều cao: 12 bậc xuống rồi phòng cao 5-8 nên khối bao thấp hơn mặt đất ít nhất 16. AC-2 ("tổng chiều dài <= 80") không thể đạt. | **Gấp chữ U** (bố cục ở 5.2): P1, P2 hàng ngang; P3 rẽ về phía -Z; P4 rẽ về -X. Hộp bao thực tế **62 x 37** theo (x, z) với 12 bậc, tối đa **70 x 38** với 16 bậc; sửa AC-2 thành "hộp bao <= 72 x 40, đường đi liên tục từ chân thang tới tâm P4, sàn >= y 6". Số bậc thay đổi theo địa hình (xem R-19). |
| R-4 | **Delta quá lớn**: 6 hầm sau khi đào rỗng + bọc tường ≈ 8-10 nghìn ô mỗi hầm, tức +60 nghìn ô (≈ +580 KB JSON theo 9,6 byte/ô) so với 14 nghìn ô hiện có. `test_perf_structures_and_welcome_size` đòi gói chào < 400 KB và PLAN cấm nới ngưỡng. Delta còn đi vào save, vào `welcome`, và vào `postMessage` khởi tạo worker mesh. | `World.exportDelta()` đổi sang **mã hoá chạy (RLE) theo chỉ số ô**: mỗi chunk là mảng phẳng `[idx, len, id, idx, len, id, …]` (idx tăng dần). `importDelta` nhận **cả hai dạng** (đối tượng cũ `{idx: id}` và mảng RLE) để save/file cũ vẫn nạp. Dự kiến welcome sau khi có 6 hầm ≈ 200 KB. Test cũ không đụng cấu trúc delta (đã grep), chỉ round-trip JSON. |
| R-5 | **Da dày vô nghĩa với đòn nhỏ**: `reduceDamage` dùng `Math.round(dmg * (1 - reduce))`; Da dày +3 giáp = giảm 12%: đòn 4 vẫn ra `round(3.52)=4`, AC-6 ("quái gây 4 chỉ còn đúng giá trị theo giáp +3") đo được nhưng người chơi không thấy khác. | Giữ công thức làm tròn hiện có (không đụng bài cũ). Sửa AC-6 để đo bằng đòn 10 (còn 9) và đòn 20 (còn 18). Ghi vào ACCEPTANCE là giới hạn đã biết; cân bằng lại sau khi chơi thử (đề xuất +4 giáp nếu cần). |
| R-6 | **Hạt giống và nhiệm vụ không có ở làng khởi đầu**: spec bán hạt ở `thuong-nhan` (Sa Mạc) và `ngu-dan` (Đầm Lầy) và nói nhiệm vụ ở "làng Rừng Sương", nhưng làng Rừng Sương (`khoi-dau`) chỉ có `truong-lang` và `tho-ren`; người mới không mua được hạt trước khi qua boss. | Thêm cửa hàng **`truong-lang`** ("Kho làng": hạt, cuốc đá, kéo; thu mua nông sản, trứng, len, bánh mì) và đặt nhiệm vụ "Vụ mùa đầu tiên" cho `truong-lang`. Vẫn thêm hạt vào `thuong-nhan`, `ngu-dan` theo spec. `validate.js` đã bắt buộc NPC cùng tên cửa hàng nên không cần NPC mới. |
| R-7 | **Mất chìa khi chết** (câu hỏi mở dungeon #1): game hiện **không có rơi đồ khi chết** (`hurtPlayer` chỉ gọi hook `onPlayerDeath`, kho không đổi) và **không có hành động thả/ném**. Spec nói chìa "thả/ném được" là không đúng với mã. | Không cần xử lý chết. Chìa có cờ `bound: true` chỉ để `actChestMove` từ chối cất vào rương đặt (`reason: 'bound'`), tránh người này lấy chìa người kia. Không thêm hành động thả. |
| R-8 | **Boss hầm bị dựng thêm đấu trường mặt đất**: `buildStructures` lặp `Object.entries(BOSSES)` để `findSite` + `buildArena` cho mọi boss; `stepArenas` đọc `flags.sites.arena[id]`. Thêm 6 boss hầm vào `BOSSES` sẽ sinh thêm 6 đấu trường trên mặt đất. | Giữ boss hầm **trong chính `BOSSES`** (để `flags`, `creditBoss`, HUD, mô hình, `test_armor_sets…trophies` hoạt động mà không sửa), thêm thuộc tính `dungeon: '<id hầm>'`. `buildStructures` bỏ qua boss có `dungeon`; `stepArenas` lấy toạ độ từ `flags.sites.dungeon[id].p4` (xem 5.6). Đặt `relic: true` cho `delver_blade` (test hiện kiểm mọi vũ khí di vật cần ít nhất 1 chiến lợi phẩm boss; `ancient_shard` nằm trong `drops` của boss hầm nên thoả). |
| R-9 | **Gai "không rắn, 2 tile"** (spec) mâu thuẫn với mesher: block không rắn không đục (cactus, kính) vẫn được vẽ thành khối lập phương đầy đủ, người chơi sẽ rơi xuyên; plant mới là chéo. Ruling 4 của PLAN đã bỏ tile 2 trạng thái. | `SPIKES`, `PLATE`, `VENT` đều là **block rắn nằm ở lớp sàn** (y = fy - 1), người chơi đứng trên mặt trên. Gai chuyển động là lớp phủ động (hộp nhỏ trong `render/effects.js`). Bẫy chỉ gây sát thương khi ô ngay phía trên không đặc (đặt block lên gai là vô hiệu, khớp spec). |
| R-10 | **Khoảng cách tối thiểu 90 block** giữa các công trình tính theo tâm, nhưng hầm rộng tới 70 block (lệch tâm), nên có thể đè lên làng/đấu trường. | `flags.sites.dungeon[id]` lưu **tâm hộp bao** (cx, cz) làm điểm gốc cho `findSite`, `minGap` 100 giữa tâm hầm và mọi tâm khác (đấu trường bán kính 18, làng 10). Thêm vị từ `accept(x, z)` vào `findSite` để kiểm tra địa hình trên toàn hộp bao (xem R-19). |
| R-11 | **Quái hầm bị xoá và thú nuôi bị xoá**: `spawnTick` xoá mọi quái xa người chơi > 80 block trừ AI `guard` và tính `MOB_CAP`/`PER_PLAYER_CAP` trên mọi quái. | Một thuộc tính duy nhất **`e.persist = true`** (thú đã thuần, quái hầm): `spawnTick` không xoá và không tính vào hai trần. Thêm **`e.dormant = true`** cho thú nuôi ngoài tầm 64 block: `stepMobs` bỏ qua hoàn toàn (kể cả trọng lực) để khỏi sinh lại chunk đã bị `keepAround` bỏ. `frozen` (hiện dùng ở test) giữ nguyên nghĩa "đứng yên nhưng vẫn rơi". |
| R-12 | **Tia mũi tên xuyên tường mỏng và xuyên quái**: `updateProjectiles` chỉ kiểm tra ô cuối của mỗi tick; mũi tên người chơi 28-32 block/s đi 1,4-1,6 block mỗi tick 0,05 s, vượt cả tường dày 1 và thân quái rộng 0,5-1,0. | Chia bước con: `n = ceil(speed*dt / 0.4)` bước, mỗi bước kiểm block rắn và va chạm thực thể (hộp trụ w x h). Áp cho **mọi** đạn (cũng sửa lỗi tiềm ẩn cho đạn quái 10-14 block/s). |
| R-13 | **`aggro()` và `killed.by` đọc `src.uid`**: đạn người chơi là thực thể `proj` không có `uid`; nếu truyền `proj` làm nguồn thì quái không biết kẻ đánh và `quests` mất kill. Ngoài ra `shoot()` hiện đặt `owner = from.id` (số). | Đạn người chơi: `owner = uid` (chuỗi), `pl: true`. `damageEntity(g, mob, dmg, player)` truyền **chính người chơi** làm `src` (có `uid`, `x`, `z`). Phân biệt đạn người chơi bằng `typeof e.owner === 'string'`; đạn quái/bẫy giữ `owner` số hoặc `null`. |
| R-14 | **`Game.hurtPlayer` không trả giá trị** (wrapper `hurtPlayer(p, dmg, src, opts) { combat.hurtPlayer(...) }`) nên `meleeAttack`/`damageNear` không biết đòn bị chặn hay trúng để quyết định đẩy lùi. | `combat.hurtPlayer` trả `{ dealt, how }` (`how`: `null | 'roll' | 'shield' | 'perfect'`); wrapper `return`. Đẩy lùi (`kb`) chỉ phát khi `how === null` (khiên: nửa lực). |
| R-15 | **Hồi chiêu và báo hiệu quái**: spec nói "giữ nguyên hồi chiêu" nhưng không nêu mốc tính. Nếu tính từ lúc đòn trúng, nhịp đánh thực chậm đi 0,35-0,6 s mỗi đòn. | `e.atkAt = thời điểm bắt đầu vung + attack.cd` (hồi chiêu tính từ lúc **bắt đầu** vung): nhịp tổng giữ nguyên số hiện có; cd nhỏ nhất của quái là 0,8 s > 0,35 s nên không chồng. |
| R-16 | **Độ trễ làm cửa sổ bất khả xâm phạm 0,30 s dễ hụt**: khách gửi `roll`, host nhận trễ nửa RTT, trong khi đòn quái chốt theo giờ host. | Host lưu `p.rollAt = g.time - lag`, `lag = LAG_COMP (0,08 s)` nếu người chơi không phải chủ phòng (`g.hostUid`), 0 nếu là chủ phòng. Hằng số có tên trong `rules.js`; test AC-6 chạy bằng chủ phòng nên số đo giữ nguyên. |
| R-17 | **Đặc tả lăn đòi "host cho phép trượt tốc độ"**: không cần; lăn 3,5 block / 0,45 s = 7,8 b/s, thấp hơn ngưỡng chống gian lận hiện tại `14*dt + 3` (với dt >= 0,05 s ít nhất 3,7 block mỗi gói). | Không đổi `applyState`. Lăn chỉ là ghi đè vận tốc ngang ở `stepPlayer` phía client. Thêm test `teleport` không phát sinh khi lăn (AC-7). |
| R-18 | **Hướng bắn do host suy ra từ gói vị trí cũ** (tới 45 ms + trễ mạng, mũi tên lệch). | `act {t:'shoot', yaw, pitch}`: host dùng nếu hữu hạn (`pitch` kẹp ±1,55); lực kéo và thời điểm vẫn do đồng hồ host (`p.drawSince`). Hướng không phải vector gian lận (đạn thật, có trọng lực, không tự dẫn). AC-32 chỉ cấm tin `lực` và `thời gian` từ client. |
| R-19 | **Địa hình trên 62 x 37 block khó phẳng**: `findSite` chỉ kiểm 8 điểm ở r=12; hầm đặt dưới đồi có thể lộ trần, đặt dưới hồ thì đáy hồ nằm dưới trần. | `accept(x,z)` lấy mẫu `columnInfo` mỗi 6 block trên hộp bao: `minH` và `maxH`. Sàn `fy = clamp(minH - 11, 6, gy - 6)` với `gy` là cao độ miệng hầm; số bậc `steps = gy - fy` phải <= 16, `minH - (fy + 9) >= 2` (trần P4 cao 8 + tường 1 còn cách mặt đất >= 2) và không có mẫu `h <= WATER_LEVEL + 1`. Không thoả thì bỏ điểm, thử vòng tìm tiếp theo; hết vòng thì bỏ hầm và ghi `console.warn` (không crash). |
| R-20 | **Cây lớn làm dựng lại mesh trên luồng chính**: mỗi `world.set` đánh dấu chunk bẩn; `ChunkView.update` dựng lại **đồng bộ** từng chunk bẩn đã dựng (vài ms). Nhiều cây đổi giai đoạn cùng giây sẽ gây khựng. | Host xử lý cây **mỗi 1 giây** (không mỗi tick) và đổi tối đa **`CROP_SETS_PER_PASS = 24`** block mỗi lượt (phần còn lại để lượt sau); sự kiện chuyển giai đoạn không gộp theo chunk, nhưng nhịp tối đa 1 lần dựng lại/giây/chunk. |
| R-21 | **`world.onChange` phát tiếng và hạt cho mọi block đổi, kể cả ở xa** (`game.js` dòng `S.world.onChange`): cây lớn, đất ướt/khô, cổng mở ở xa 100 block sẽ phát tiếng "đặt block" khắp nơi. | Sửa ở S0: `onChange` bỏ qua nếu cách người chơi > 24 block, và bỏ qua mọi chuyển giữa các block hệ thống (cây, đất cày) trừ `AIR → cây` (tiếng gieo riêng, nhỏ). |
| R-22 | **Chuột phải bị tranh** (ăn, cày, gieo, cho ăn, cắt len, cổng, rương, giơ khiên). `useItem()` hiện không trả giá trị. | `useItem()` trả `true` nếu đã làm gì đó; `mousedown` nút phải gọi `if (!useItem()) startGuard()`. Thứ tự ưu tiên cố định ở 4.6. Phím F giơ khiên không cần điều kiện. |
| R-23 | **`HIT_REACH`/`pickEntity` 4,5 cố định** (host `combat.HIT_REACH`, client `pickEntity(o, d, 4.5)`, throttle `0.5` giây): giáo tầm 6 và hồi chiêu theo vũ khí sẽ bị client chặn trước khi tới host. | Client dùng `reachOf(held)` và `cdOf(held)` từ `rules.js` (cùng hàm host dùng). Host vẫn là nguồn xác nhận. |
| R-24 | **Rìu 3 mục tiêu**: spec ghi "đánh tới 3 mục tiêu trong 2,5 block quanh mục tiêu chính" và AC-9 ghi "3 quái cùng bị đánh, quái thứ 4 không". | Hiểu là **tổng 3 mục tiêu gồm cả mục tiêu chính** (tối đa 2 mục tiêu phụ, 70%). Ruling cho cả test. Mọi rìu (`tool.type === 'axe'`, kể cả rìu gỗ/đá) thuộc lớp `axe`; cuốc/xẻng/cuốc đất/kéo thuộc lớp `hand`. |
| R-25 | **Ngộ độc có thể giết người**: spec nói "sát thương thuần" nhưng không giới hạn. | Ngộ độc không bao giờ đưa máu xuống dưới 1 (như Minecraft). Chết đói giữ luật spec: dừng ở 2 máu. |
| R-26 | **Đóng băng đồng hồ**: spec dùng giây còn lại cho hiệu ứng, thú, cây, vừa có khái niệm "ngoài tầm: đóng băng". Giờ tuyệt đối `g.time` không dừng khi thú ngoài tầm. | Mọi bộ đếm của thú, cây, hiệu ứng là **"giây còn lại / giây tích luỹ"** giảm bằng `dt` mô phỏng chỉ khi đối tượng được mô phỏng. Bộ đếm chiến đấu ngắn (lăn, khiên, kéo cung, hồi chiêu) dùng **giờ tuyệt đối `g.time`** vì không bao giờ lưu. Save luôn lưu dạng "giây còn lại". |
| R-27 | **Chiều cao nhảy và bậc thang**: `JUMP_V 7.8`, `GRAVITY 25` cho độ cao nhảy 1,22 block; không có sát thương rơi. | Cầu thang bậc cao 1 đi lên được bằng nhảy thường (khớp câu hỏi mở dungeon #4); quái tự nhảy bậc 1 (đã có trong `walk`). Test D1 dò đường bằng BFS cho phép bước lên <= 1 block. |
| R-28 | **Nội dung bài mạng**: PLAN ghi "bài mạng vào `test_net.py`", nhưng `test_net.py` chỉ test lớp `platform/net` và trang thử phòng; mọi test mạng của game (`test_multiplayer_*`, `test_e2e_two_players`) nằm ở `test_game.py` (dùng `NET_JS`, `mkHost`, `join`). | Test mạng của game vào `test_game.py` mục "N: mạng"; `test_net.py` chỉ thêm bài kích thước tin (`welcome` và `snap` trong ngân sách) nếu cần dùng `Room`. Số bài 21 của `test_net.py` không đổi trừ bài đó. |

### 1.2 Quyết định nhỏ (ghi để khỏi hỏi lại)

- **R-29** Thể lực không phụ thuộc đói (đúng PLAN #5). Đói chỉ đổi luật hồi máu và nguồn "mệt".
- **R-30** `SAVE_VERSION = 2` một lần ở S0; trường mới của Chiến đấu và Hầm ngục là tuỳ chọn, thiếu thì rỗng.
- **R-31** Trần 24 thú nuôi tính **mỗi thế giới** (đếm `e.persist && MOBS[e.type].farm`); bị từ chối với `reason: 'cap'` và toast "Chuồng đã đầy (24/24)".
- **R-32** Quái hầm và thú nuôi dùng cùng cờ `persist`; hầm thêm `e.dg = '<id hầm>'` để xoá khi người rời.
- **R-33** Không thêm phím gọi thú; không thêm NPC nông dân (xem R-6).
- **R-34** Mọi mã mô phỏng mới phải **chịu được `dt` tới 0,5 s** (test dùng bước thô để chạy 900 giây game trong vài giây): không dùng "mỗi tick làm X", chỉ dùng bộ tích luỹ.
- **R-35** Icon vật phẩm mới phải cho data URL **khác nhau** từng id (test AC-26 Chiến đấu / AC-20 Sinh tồn). Cuốc gỗ/đá/sắt khác nhau bằng màu bậc (`TIER_COLOR`), giáo gỗ/đá/sắt tương tự.
- **R-36** Atlas: 10 hàng (80 ô). Dùng 73-74 ô (xem 2.1), còn dư 6.
- **R-37** Thanh thể lực/đói là DOM thuần trong `ui/hud.js`; không đưa logic game vào UI (đúng quy ước file hiện có).

---

## 2. Nền chung (làm ở S0, ba gói dùng lại)

### 2.1 Block, atlas, id

`world/blocks.js`:
- `ATLAS_ROWS = 10` (80 ô). `TILES` chỉ **thêm cuối**, không đổi thứ tự cũ (mesher và `tileColors` đánh chỉ số theo thứ tự).
- Id mới (không đổi id cũ):

| Id | Tên | Ghi chú |
|---|---|---|
| 40 | `farmland` | rắn, `tiles: [farmland_top, dirt, dirt]`, hardness 0,5, tool `shovel`, `drop: 'dirt'` |
| 41 | `farmland_wet` | như trên, tile mặt trên sẫm hơn |
| 42-45 | `crop_wheat_0..3` | `plant: true, deco: true, solid: false, opaque: false, drop: null, hardness 0.05` |
| 46-49 | `crop_carrot_0..3` | như trên |
| 50-53 | `crop_potato_0..3` | như trên |
| 54 | `dungeon_wall` | rắn, `hardness: -1` |
| 55 | `gate_iron` | rắn, `hardness: -1`, bấm phải kiểm chìa |
| 56 | `gate_boss` | như trên |
| 57 | `spikes` | rắn (R-9), `hardness: -1` (không đào, chỉ che bằng block) |
| 58 | `plate` | rắn, hardness 2, `tool: 'pick', tier: 1`, `drop: null` |
| 59 | `dart_trap` | rắn, hardness 2, `tool: 'pick', tier: 1`, `drop: null` |
| 60 | `vent` | rắn, hardness 2, `tool: 'pick', tier: 1`, `drop: null` |
| 61 | `dchest` | rắn, `hardness: -1` |

- Hằng số: `export const CROP_BLOCKS = { wheat: [42..45], carrot: [46..49], potato: [50..53] }` và `export function cropOf(id) -> { kind, stage } | null` (hàm thuần, dùng chung host, tooltip, mesher test).
- Tile mới (74 ô tổng): `farmland_top`, `farmland_wet_top` + 12 tile cây (`crop_<k>_<s>`) + `dungeon_wall`, `gate_iron`, `gate_boss`, `spikes`, `plate`, `dart_trap`, `vent`, `dchest_top`, `dchest_side` (9; `dart_trap` dùng một tile cho 6 mặt). Tile vẽ bằng `PAINT[...]` trong `render/atlas.js`, cùng phong cách (`jitter`, `hash`).
- `render/mesher.js` không phải sửa logic (dùng `ATLAS_ROWS`), nhưng **bài đầu tiên của S0** là chạy `test_mesher_*`, `test_render_screenshot`, `test_visual_*` khi mới đổi 7 → 10 hàng chưa thêm tile (cổng chặn rủi ro UV).
- `ui/icons.js` chỉ dùng `ATLAS_COLS` nên không đổi; vật phẩm `block:` tự có icon. `crop_*` không có vật phẩm đặt được; hạt/củ là vật phẩm riêng (`plant: 'wheat'`).

### 2.2 Save v2, delta RLE, tương thích save cũ

`save.js`:
```js
export const SAVE_VERSION = 2;
export function checkVersion(save) {
  ...kiểm như cũ; save.v > 2 -> throw 'newer-version'
  if (save.v < 2) upgradeV1(save);                 // đặt save.v = 2 sau khi điền mặc định
  return save;
}
// upgradeV1: save.crops ||= {}; save.farm ||= {}; save.animals ||= [];
// mỗi save.players[uid]: food ??= 20; fatigue ??= 0; fx ??= {}; poison ??= 0; offhand ??= null
```
`checkVersion` phải **không ném lỗi** với trường thiếu; mọi nơi đọc dùng `?? mặc định` (đừng tin `upgradeV1` là đủ vì `Game.fromSave` còn nhận save dựng tay trong test).

Lược đồ save v2 (trường mới in đậm):
```
{ v: 2, seed, time,
  flags: { ..., sites: { arena, village, dungeon?: {[id]: SiteD} }, dungeons?: {[id]: DState}, 'boss:<id>': true },
  delta: { 'cx,cz': [idx, len, id, ...] | { idx: id } },       // RLE mới; nạp được dạng cũ
  players: { [uid]: { ...cũ, food, fatigue, fx: {regen: giây còn lại, ...}, poison: giây còn lại, offhand } },
  chests,
  crops:  { 'x,y,z': { k: 'wheat', g: giây tích luỹ, s: giai đoạn } },
  farm:   { 'x,y,z': giây ruộng trống },
  animals:[ { type, x, y, z, hp, age, love, breedCd, prodCd, fed, sheared, home:{x,y,z} } ] }
DState = { rooms: { p2: true }, gates: { g: true, b: true }, claimed: { supply: [uid], victory: [uid], trap: [uid], treasure: [uid] }, boss: bool }
SiteD  = { x, z, y /*gy, mặt đất tại miệng*/, fy, steps, c: {x, z} /*tâm hộp bao*/, p4: {x, y, z} }
```
Quy tắc:
- **`playerSave(p)` có danh sách trường tường minh** (hiện: name, x, y, z, hp, maxHp, inv, sel, quests, armor, home, region). Thêm `food, fatigue, fx (chuyển until -> left), poison (left), offhand` ở đây; quên một trường là mất dữ liệu im lặng.
- `addPlayer` làm `Object.assign(p, JSON.parse(JSON.stringify(saved)))`: **nhập file `.gz` tuỳ ý** nên cần `sanitizePlayer(saved)` (kẹp `food` 0..20, `fx` chỉ nhận id biết và giây 0..300, `offhand` phải là khiên, `inv` ô hợp lệ). Thiếu hàm này thì file hỏng làm `food = NaN` và đói không bao giờ hết.
- `Game.fromSave` thêm: nạp `crops`/`farm` (xem 3.4), `animals` sau `ensureNpcs` (xem 3.5), rồi `buildStructures()` (dựng hầm còn thiếu, 5.1).
- `exportDelta` RLE:
```js
exportDelta() {            // mỗi chunk: chỉ số tăng dần, gộp ô liên tiếp cùng id
  const out = {};
  for (const [k, m] of this.delta) {
    const idx = [...m.keys()].sort((a, b) => a - b), arr = [];
    for (let i = 0; i < idx.length; ) {
      const id = m.get(idx[i]); let j = i + 1;
      while (j < idx.length && idx[j] === idx[j - 1] + 1 && m.get(idx[j]) === id) j++;
      arr.push(idx[i], j - i, id); i = j;
    }
    out[k] = arr;
  }
  return out;
}
importDelta(obj) { ... Array.isArray(v) ? duyệt bộ ba : duyệt Object.keys(v) (dạng cũ) ... }
```
  Giữ chữ ký; `render/meshservice.js`, `net/host.js`, `net/client.js`, `chunk.worker.js` không đổi.
- Kích thước save: cây 1000 mục ≈ 45 KB + delta cây; thú 24 mục < 3 KB; mục tiêu "1000 cây < 100 KB" đo bằng `JSON.stringify(toSave().crops).length`.

### 2.3 Cờ thực thể, tick, tuỳ chọn Game

`sim/game.js`:
```js
constructor({ seed, world, spawning = true, env = true, hunger = true } = {})
  this.hunger = hunger; this.crops = new Map(); this.farm = new Map(); this.dg = {}; this.hostUid = null;
```
Thứ tự `tick(dt)` (mới in đậm, giữ phần cũ):
```
time += dt
stepMobs      // + giải quyết windup, choáng, bỏ qua dormant
stepBosses; stepArenas   // + vòng lặp boss hầm
regionTick; questTick
spawnTick     // + persist, cấm sinh gần miệng hầm
updateItems
updateProjectiles   // viết lại: bước con, đạn người chơi, trọng lực
updatePlayers       // hồi máu theo đói
hungerTick(dt)  fightTick(dt)  farmTick(dt)  animalTick(dt)  dungeonTick(dt)
tickExtra?.(dt)
```
Không dùng `tickExtra`/`actExtra` (dành cho test/mod); đăng ký hành động mới ngay trong `switch (a.t)` của `act()` để có chỗ kiểm tra tập trung. Mọi tham số của hành động mới kiểm `Number.isInteger` / `Number.isFinite` / `typeof === 'boolean'` trước khi dùng (mẫu `chestOf`); hành động sai kiểu trả `{ok:false, reason:'bad-args'}`, không ném lỗi.

`sim/mobs.js` thay đổi dùng chung:
- `spawnMob(g, type, x, y, z, opts)` nhận `opts = { persist, dg, tamed }` gán thẳng vào thực thể.
- `spawnTick`: `const wild = mobs.filter(e => !e.persist)` dùng cho `MOB_CAP`, `PER_PLAYER_CAP`, xoá khi xa; không sinh trong 6 block quanh miệng hầm (`nearDungeonMouth(g, x, z)`).
- `stepMobs`: `if (e.dormant) continue;` đứng trước mọi thứ khác.

### 2.4 Đường ống sát thương người chơi (`sim/combat.js`, làm ở C0 nhưng Sinh tồn dùng ngay)

```js
// opts: { pure, blockable = true, trap }  -> { dealt, how }
export function hurtPlayer(g, p, dmg, src, opts = {}) {
  if (p.dead || dmg <= 0) return { dealt: 0, how: null };
  let how = null;
  if (src && !opts.pure) {
    if (isInvuln(g, p)) return { dealt: 0, how: 'roll' };                       // bước 1: lăn
    const gd = opts.blockable === false ? null : guardResult(g, p, src, dmg);   // bước 2: khiên (cung 120 độ phía trước)
    if (gd) { if (gd.perfect) { ... return { dealt: 0, how: 'perfect' }; } dmg = gd.dmg; how = 'shield'; if (gd.broke) ...; }
    dmg = reduceDamage(dmg, p.armor, toughBonus(g, p));                         // bước 3: giáp (+3 giáp ảo khi Da dày)
  }
  dmg = Math.max(1, dmg);                                                       // bước 4
  ...trừ máu, lastHurt, touch, 'hurt', chết như cũ...
  return { dealt: dmg, how };
}
```
- Đòn không có `src` (đói, độc, nóng, lạnh, khí độc, bỏng) hoặc `opts.pure` **bỏ qua lăn, khiên, giáp** (như hiện nay đối với giáp).
- `src` bẫy: `{ id: 'trap', x, y, z }` (đối tượng tạm, không vào `g.ents`), `opts.blockable` theo bảng: gai/phun `false`, tên bẫy `true` (tên bẫy là `proj` thật nên `src` là chính `proj`).
- `reduceDamage(dmg, armor, extra = 0)` trong `sim/armor.js` thêm tham số `extra` (điểm giáp ảo), vẫn trần 75%.
- Sự kiện `hurt` chỉ phát khi `dealt > 0`; khi đòn bị chặn phát `shield` (xem 2.5) cho người chơi bị đánh.
- `Game.hurtPlayer(p, dmg, src, opts)` **return** kết quả (R-14).

### 2.5 Giao thức: hành động, sự kiện, snapshot

**Hành động mới** (qua `S.act`, host xử lý trong `Game.act`):

| `t` | Tham số | Gói | Phản hồi lỗi (`fail.reason`) |
|---|---|---|---|
| `till` | `x,y,z` | 1 | `reach`, `not-hoe`, `not-soil`, `blocked` |
| `plant` | `x,y,z` (ô đất cày) | 1 | `reach`, `not-seed`, `not-farmland`, `blocked` |
| `harvest` | `x,y,z` (ô cây) | 1 | `reach`, `unripe`, `not-crop`, `inventory-full` |
| `feed` | `id` | 1 | `reach`, `not-food`, `cooldown`, `cap`, `busy`, `no-target` |
| `shear` | `id` | 1 | `reach`, `not-shears`, `young`, `sheared` |
| `roll` | `dx, dz` (-1..1) | 3 | `tired`, `cooldown`, `stun`, `busy` |
| `guard` | `on` | 3 | `no-shield`, `food` (đang cầm đồ ăn) |
| `draw` | `on` | 3 | `no-bow`, `tired` |
| `shoot` | `yaw, pitch` | 3 | `no-bow`, `no-ammo`, `cooldown`, `weak`, `tired` |
| `gate` | `x,y,z` | 2 | `reach`, `need-key` |
| `dchest` | `x,y,z` | 2 | `reach`, `locked`, `claimed` (không phải lỗi, phát `loot`) |

`net/host.js`: `REPORT` thêm `till, plant, harvest, feed, shear, roll, shoot, gate, dchest`. `guard`/`draw` **không** vào `REPORT` (client chỉ gửi khi đã có khiên/cung, lỗi còn lại là đua thời gian, không cần toast). Giới hạn 40 hành động/giây/người giữ nguyên; kéo cung và giơ khiên gửi tối đa 2 gói mỗi lần (bật, tắt). `HostSession.start` đặt `game.hostUid = this.uid`.

**Sự kiện mới** (host -> client; `to` là uid hoặc null = mọi người):

| Sự kiện | Đến | Nội dung | Dùng cho |
|---|---|---|---|
| `block` (có sẵn) | tất cả | thêm `q: 1` khi thay đổi do hệ thống (cây lớn, đất ướt) | `onChange` bỏ tiếng (R-21) |
| `shield` | người bị đánh | `{perfect, broke, dmg}` | HUD viền, tiếng |
| `exhausted` | người đó | `{}` | toast "Hết sức!" |
| `windup` | tất cả | `{id, t}` | quái nghiêng người, tiếng báo (khoảng cách < 20) |
| `parry` | tất cả | `{id}` | hiệu ứng đỡ hoàn hảo |
| `roll` | tất cả | `{uid}` | tiếng "xoẹt", hạt bụi |
| `loot` | người mở | `{title, items:[{item,n}], claimed?}` | bảng Chiến lợi phẩm |
| `dungeon` | người trong hầm | `{id, name, room, left, cleared, rooms:{p2}}` | HUD hầm, biểu ngữ |
| `toast` (có sẵn) | người đó | text tiếng Việt | đói, ngộ độc, chuồng đầy, chìa |

`youOf(p)` thêm: `food`, `fx` (mảng `{id, left}` tính sẵn khi đổi), `offhand`. Chỉ đẩy qua `rev` (thay đổi hiếm). **Không `touch(p)` mỗi tick**: `touch` làm `HostSession` gửi cả kho 36 ô qua `you`.

`snapshotFor(g, uid)` thêm:
```js
// mỗi người chơi trong ps: chỉ thêm khi khác 0 để gói nhỏ
{ uid, name, x, y, z, yaw, pitch, hp, maxHp, dead, held, act?: 1|2|3|4, off?: 'wood_shield' }
// phần của người nhận (host cũng nhận, vì HUD chủ phòng đọc S.snap chứ không đọc S.you cho trường nhanh):
snap.me = { sta: 0..100 (số nguyên), exh: số giây còn lại (1 chữ số) hoặc 0, cmb: 0..2 }
// thực thể mob:
o.tm = 1 (đã thuần), o.lv = 1 (đang yêu), o.ba = 1 (non), o.sh = 1 (đã cắt len), o.stn = 1 (đang choáng)
```
`act` ưu tiên 3 (lăn) > 4 (choáng hoặc kiệt sức) > 2 (kéo cung) > 1 (giơ khiên). Client nội suy giữ nguyên trường lạ (hàm `lerpList` đã `...e`).

Ngân sách: +~12 byte/người, +~25 byte/thú nuôi có cờ, `me` ~30 byte. Snapshot của 5 người + 24 thú + 10 mũi tên ≈ 3,4 KB, 10 lần/giây/khách.

### 2.6 Giao diện UI chung (khoán trước để test dùng)

DOM `id`/lớp cố định (test sẽ đọc; thêm vào `game.html`, `game.css`):

| Phần tử | Nội dung |
|---|---|
| `#food` | 10 con `i.ic` có lớp `full`/`half`/`empty`; lớp `pulse` khi food = 0 |
| `#fxbar` | mỗi hiệu ứng `.fx[data-id]` chứa icon + `.left` (giây) |
| `#stamina > i` | `style.width` = % thể lực; lớp `low` (< 40), `exh` (kiệt sức) |
| `#drawring` | vòng kéo cung, thuộc tính `data-p` 0..100 |
| `#combo > i` | 3 chấm, lớp `on` cho số đòn chuỗi |
| `#arrows` | số mũi tên khi cầm cung |
| `#shieldico` | lớp `up` khi đang giơ khiên, `perfect`/`broke` 400 ms |
| `#tip` | tooltip ngắm cây/thú/ruộng (ẩn khi rỗng) |
| `#dungeon` | dòng "Hầm … · Phòng x/4 · Quái còn n · Chìa …" |
| `#dgbanner` | biểu ngữ tên hầm 3 giây |
| `#dghint` | "Miệng hầm: Đông Bắc 52 m" |
| panel `loot` | `panels.showLoot(ev)`, nút Đóng |

`ui/hud.js` thêm hàm (chữ ký): `setFood(food)`, `setFx(list)` (tự đếm lùi mỗi 250 ms), `setStamina({sta, exh})`, `setCombo(n)`, `setDraw(p /*0..1|null*/, arrows)`, `setShield(on)`, `shieldFlash('perfect'|'broke')`, `setTip(text|null)`, `setDungeon(state|null)`, `showBanner(text)`, `setHint(text|null)`; `itemTip(id)` trả chuỗi nhiều dòng (đói/máu/hiệu ứng, lớp vũ khí/hồi chiêu/thể lực, % giảm của khiên, tầm) và `slotEl` dùng làm `title`. Một `itemTip` duy nhất cho cả ba gói.

`sfx.js` thêm tên: `eat, till, sprout, harvest, feed, cluck, oink, baa, roll, bowdraw, bowshot, shieldhit, parry, shieldbreak, exhausted, plate, dart, spikes, vent, gate, chestopen` (tổng hợp bằng `tone`/`noise`, mỗi âm < 0,5 s).

### 2.7 Bẫy chung khi sửa lõi (xem thêm mục 8)

`REPORT` và `FAIL_TEXT` (trong `game.js`) phải thêm đủ lý do mới; `onFail` hiện chỉ hoàn tác `pendingEdits` cho `break`/`place` nên các act mới không động tới. Thông báo `full` đổi nghĩa: "Bạn đang no và đầy máu."

---

## 3. Gói 1: Sinh tồn & Kinh tế

### 3.1 Dữ liệu và trạng thái

`content/items.js` (dữ liệu, comment tiếng Việt ngắn):
```js
// thêm trường: food (điểm đói), fx: { id, secs }, risk: { poison: p }, plant: 'wheat'|'carrot'|'potato'
['meat', { name: 'Thịt', heal: 5, food: 3, risk: { poison: 0.25 } }], ...
named hoe: ['wood_hoe', { name: 'Cuốc đất gỗ', tool: { type: 'hoe', tier: 1, speed: 1 }, dmg: 1, stack: 1 }]  // 1, 2, 3
['shears', { name: 'Kéo', dmg: 1, stack: 1 }]
['wheat_seed', { name: 'Hạt lúa mì', plant: 'wheat' }], ['carrot', { name: 'Cà rốt', food: 3, heal: 1, plant: 'carrot' }], ['potato', ...]
```
`tool.type: 'hoe'` không trùng `def.tool` nào nên `breakTimeFor` và `canHarvest` không đổi hành vi. `icons.js` có nhánh `tool(ctx, kind, color)`: thêm `hoe`.

`content/farming.js` (mới, dữ liệu thuần):
```js
export const CROPS = {
  wheat:  { name: 'Lúa mì',   seed: 'wheat_seed', secs: 360, yield: [{ item: 'wheat', min: 1, max: 2 }, { item: 'wheat_seed', min: 1, max: 3 }] },
  carrot: { name: 'Cà rốt',   seed: 'carrot',     secs: 300, yield: [{ item: 'carrot', min: 2, max: 4 }] },
  potato: { name: 'Khoai tây', seed: 'potato',    secs: 420, yield: [{ item: 'potato', min: 2, max: 3 }] },
};
export const EFFECTS = { regen: { name: 'Hồi phục', color: '#e86a8a' }, power: { name: 'Sức mạnh', color: '#e0a22c' },
  tough: { name: 'Da dày', color: '#9aa0a8' }, poison: { name: 'Ngộ độc', color: '#5ab04a' } };
export const SOIL = ['dirt', 'grass', 'mud', 'moss'];          // cày được (tên block)
```
`content/mobs.js`: thêm `ga`, `cuu`, `lon` (đủ trường cảm giác `sight, fov, close, hearing, turn` vì AI hoang dại dùng `flee`), `ai: 'farm'`, `passive: true`, `when: 'day'`, `breed: { food, cd: 240, love: 30 }`, `product: { item, ... }`, `adultSecs: 300`, `farm: true`. `xac-song.drops` thêm `carrot` và `potato` mỗi loại p 0,08. `content/validate.js`: `AI_KINDS` thêm `farm`; nguồn vật phẩm cộng thêm mọi `CROPS[*].yield` và `MOBS[*].product`; kiểm `breed.food` tồn tại.

Trạng thái ở host (`Game`):
- `g.crops: Map<'x,y,z', { k, s, g }>`: `k` loại, `s` giai đoạn (đồng bộ với id block), `g` giây tích luỹ (đã nhân hệ số). Khoá theo **ô cây**.
- `g.farm: Map<'x,y,z', giây ruộng trống>`: khoá theo **ô đất cày**; xoá khi có cây, đặt lại 0 khi cây bị phá.
- Người chơi: `p.food` (0..20, số nguyên), `p.fat` (mệt, thập phân), `p.fx` (`{ id: until /* g.time */ }`, nội bộ), `p.fxView` (mảng `{id,left}` gửi cho client, tính lại khi thêm/mất), `p.psn` (`{ until, next }` hoặc null), `p.eatAt`.
- Thú: `e.tamed, e.persist, e.love (giây còn lại), e.breedCd, e.age (giây), e.prodCd, e.fed (giây còn lại tính "đã được cho ăn trong 300 s"), e.shearCd, e.home`.

### 3.2 File tạo / sửa

| File | Việc |
|---|---|
| `sim/hunger.js` (mới) | `hungerTick`, `eat`, `addFx`, `clearFx`, `refreshView`, `exert`, ngộ độc |
| `sim/farm.js` (mới) | `actTill/Plant/Harvest`, `onBreak`, `onBlockSet`, `farmTick`, `serializeFarm/restoreFarm` |
| `sim/animals.js` (mới) | `AI_FARM` (xuất cho `mobs.js`), `actFeed/Shear`, `animalTick`, `serializeAnimals/restoreAnimals`, `tameCount` |
| `content/farming.js` (mới) | `CROPS`, `EFFECTS`, `SOIL` |
| `sim/game.js` | tuỳ chọn `hunger`, Map cây, `act` mới, `setBlock` gọi `farm.onBlockSet`, `playerSave`, `fromSave`, `addPlayer` (food/fx/offhand mặc định) |
| `sim/combat.js` | `actUse` gọi `hunger.eat`; `updatePlayers` hồi máu theo đói; `actRespawn` đặt food 14; `actHit` cộng `exert(p, 2)` và Sức mạnh |
| `sim/mobs.js` | `AI['farm']`, `persist`, `dormant`, `spawnMob(..., opts)` |
| `sim/armor.js` | `reduceDamage(..., extra)` |
| `world/blocks.js`, `render/atlas.js` | block 40-53 và tile |
| `world/world.js` | `exportDelta` RLE, `importDelta` hai dạng |
| `content/items.js`, `recipes.js`, `shops.js`, `quests.js`, `npcs.js`, `mobs.js`, `validate.js` | dữ liệu, kiểm tra |
| `net/snapshot.js`, `net/host.js` | `youOf` (`food, fx`), cờ thú, `REPORT` |
| `save.js` | v2 |
| `ui/hud.js`, `ui/icons.js`, `game.js`, `game.html`, `game.css`, `sfx.js` | thanh đói, hiệu ứng, tooltip, bấm phải, âm, icon (hoe, kéo, hạt, nông sản, món ăn, trứng, len…) |
| `render/models/creatures.js`, `render/models/index.js`, `render/entities.js` | 3 mô hình thú (+ bản non, cừu cắt len), tỉ lệ, biểu tượng tim |
| `tools/export_design_data.py` | xuất `CROPS`, thú nuôi |

### 3.3 Chữ ký giữa các lớp

```js
// sim/hunger.js
export const FOOD_MAX = 20, FATIGUE_STEP = 45, EAT_CD = 1.0, FOOD_ON_RESPAWN = 14;
export function hungerTick(g, dt)                 // mỗi người sống: fat += (1 | 2 nếu sprint & chạy thật) * dt; fat >= 45 -> food--; chết đói; ngộ độc; hồi phục
export function exert(p, n)                       // +n mệt (đòn trúng quái: 2)
export function eat(g, p)                         // dùng cho combat.actUse: trả {ok, reason?}; reason: empty, not-food, full, cooldown
export function addFx(g, p, id, secs)             // max(còn lại, secs); touch(p) chỉ khi thêm mới hoặc kéo dài; refreshView
export function clearFx(p)                        // khi chết
export const toughBonus = (g, p) => (p.fx && p.fx.tough > g.time ? 3 : 0);
export const powerMul = (g, p) => (p.fx && p.fx.power > g.time ? 1.25 : 1);
// sim/farm.js
export function actTill(g, p, a)  export function actPlant(g, p, a)  export function actHarvest(g, p, a)
export function onBreak(g, p, x, y, z, id)        // gọi từ actBreak: rơi theo giai đoạn, hạt cỏ cao 12%
export function onBlockSet(g, x, y, z, prev, id)  // gọi từ Game.setBlock: cây gãy khi mất đất; dọn Map; đất ướt khi nước đổi
export function farmTick(g, dt)
export const cropInfo = cropOf                    // dùng cho tooltip: { kind, stage }
// sim/animals.js
export function actFeed(g, p, a)  export function actShear(g, p, a)  export function animalTick(g, dt)
export function farmAI(g, e, d, dt)               // gọi từ mobs.js AI.farm; thú hoang uỷ quyền cho AI.flee
// net/snapshot.js
export const youOf = p => ({ hp, maxHp, dead, inv, sel, armor, home, food: p.food, fx: p.fxView || [], offhand: p.offhand || null });
```

Giao diện sim -> UI chỉ qua `you` (`food`, `fx`), `snap.es[].tm|lv|ba|sh`, block id (giai đoạn và độ ẩm mã hoá ngay trong id: `cropOf(id)`, `farmland_wet`), nên tooltip cây không cần dữ liệu máy chủ thêm.

### 3.4 Cơ chế chính

**Đói** (`hungerTick`, mọi `dt`): `p.fat += dt * (p.sprint && hspeed > 1 ? 2 : 1)`; `while (p.fat >= 45) { p.fat -= 45; p.food = max(0, p.food - 1); touch }`; người chết và `g.hunger === false` bỏ qua. Chạy nước rút tính theo `p.sprint` mà client báo kèm vận tốc ngang `vx, vz` (host không biết cách khác; hiện host đã tin `p.sprint` cho tiếng động). Hồi máu (sửa `updatePlayers`): `rule = !g.hunger ? 'old' : food >= 18 ? 'fast' : food >= 7 ? 'old' : 'none'`; `fast`: sau 4 s không đau, 1 máu/2 s; `old`: 8 s / 4 s; `none`: không hồi. `food === 0`: mỗi 5 s `if (p.hp > 2) hurtPlayer(g, p, 1, null)` (không `src`, nên giáp không giảm). Toast "Bạn đang đói" khi `food <= 6`, nhiều nhất 1 lần/60 s/người.

**Ăn** (`eat`): vật phẩm ăn được nếu có `food` hoặc `heal`. Điều kiện `full`: `hp >= maxHp && (food >= FOOD_MAX || !(it.food > 0))` (khớp ruling 15 của PLAN: bình thuốc chỉ uống khi thiếu máu). `p.eatAt` chặn 1,0 s (`cooldown`). Ăn: `hp += heal` (kẹp), `food += it.food` (kẹp 20), áp `it.fx`, ngộ độc nếu `g.rng() < it.risk.poison` (**dùng `g.rng`** để test gieo hạt cố định). Trừ 1 vật phẩm, `touch(p)`, phát `hurt {hp, by: null}` như hiện nay. Hồi phục: `+1 máu / 2 s` trong thời lượng; Sức mạnh và Da dày là thời hạn `until`, đọc ở `actHit` và `hurtPlayer`. Ngộ độc: 6 s, 1 sát thương / 2 s qua `hurtPlayer(g, p, 1, null)` nhưng chỉ khi `hp > 1` (R-25). `until` tuyệt đối trong RAM, lưu/nạp dưới dạng giây còn lại (R-26).

Công thức sát thương cuối của người chơi (một chỗ duy nhất, `combat.js`): `floor(dmg * hệ số vũ khí/đòn)`, rồi x1,5 nếu đòn rơi, rồi `ceil(x * powerMul)`, tối thiểu 1. Kiếm sắt đòn 1: 6 → 8 (khớp AC-6).

**Cuốc đất** `actTill`: kiểm `reach`, cầm vật `tool.type === 'hoe'`, ô là `dirt|grass|mud|moss`, ô phía trên là `AIR` hoặc cây cỏ thường không `deco` (xoá, không rơi). Đặt `farmland` hoặc `farmland_wet` theo `wetAt(x, y, z)`; `g.farm.set(key, 0)`. **Độ ẩm** `wetAt`: có `WATER` trong `|dx|<=4, |dz|<=4, dy ∈ {-1,0}` (81 x 2 ô). Không quét mỗi lượt: lưu kết quả trong lần xử lý đầu tiên và quét lại chỉ khi (a) `onBlockSet` thấy `WATER` ↔ khác trong bán kính 5, đánh dấu `g.farmDirty = true`; (b) mỗi 20 s cho từng ô (xoay vòng). Đặt/phá nước đổi trạng thái ≤ 5 s (AC-8) vì lượt dọn dẹp chạy 1 s/lần.

**Cây** `farmTick(dt)`: `g.farmAcc += dt`; mỗi 1 s (hoặc dt > 1) xử lý một lượt với `step = acc`. Với mỗi cây trong 64 block (ngang) quanh người chơi sống: `rate = (wet ? 2 : 1) * (cold ? 0.5 : 1)` (`cold` = vùng `nui-bang` hoặc `vuc-pha-le`, tra `world.regionAt` một lần mỗi cây rồi nhớ trong `crop.r`), `c.g += step * rate`, `s = min(3, floor(c.g / secs * 3))`; nếu `s` đổi: `setBlock(x, y, z, CROP_BLOCKS[k][s])` kèm `q: 1`, tối đa `CROP_SETS_PER_PASS` (R-20). Ruộng trống: `farm[key] += step`, quá 300 s thì `dirt`. Đất bị phá hoặc đặt block đặc lên ô cây: `onBlockSet` xoá cây và rơi 1 hạt (không hạt cho `carrot|potato` thì rơi chính củ).

**Thu hoạch**: (a) đào/phá cây qua `actBreak` -> `farm.onBreak`: chín (stage 3) cho sản lượng đủ, chưa chín chỉ trả 1 hạt/củ (không sản lượng); (b) `actHarvest`: chỉ khi stage 3, nhận sản lượng trừ 1 hạt (lấy hạt trừ khỏi bảng: lúa mì bỏ 1 `wheat_seed`, cà rốt/khoai bỏ 1 củ), block về `crop_k_0`, `c.g = 0`. Hai người cùng bấm: lần hai thấy `stage 0` nên trả `unripe`, không đổi gì (AC-13). Kho đầy: phần dư rơi xuống đất bằng `collect` hiện có, nên không có lỗi `inventory-full` ở nhánh này (bỏ khỏi bảng 2.5 nếu dùng `collect`).

**Hạt từ cỏ cao**: trong `actBreak` hiện `def.drop` của `tall_grass` là `null`; `farm.onBreak` thêm `if (id === B.TALL_GRASS && g.rng() < 0.12) collect(wheat_seed)`.

**Thú nuôi**:
- Hoang dã: `AI['farm']` uỷ quyền `flee` khi `!e.tamed`. Sinh nhờ `spawnTick` thường (`weight` thấp hơn nai).
- `actFeed {id}`: thú trong `FEED_REACH = 3` (tính đến mép thân), người cầm đúng `breed.food`. Hoang -> thuần (`tamed, persist`, `love = 30`, `home` tại chỗ), trừ 1. Đã thuần: nếu non thì `age += 30`; nếu trưởng thành, `breedCd <= 0` và `love <= 0` thì `love = 30`; còn lại trả `busy` (hai người cùng cho một thú ăn: chỉ người đầu bị trừ, khớp AC-23). Trần: `tameCount(g) >= 24` -> `cap` (R-31). Gà đã thuần được cho ăn: `fed = 300`.
- Sinh sản trong `animalTick`: mỗi giây tìm cặp cùng loài, cả hai `love > 0`, trưởng thành, cách <= 6; đặt `e.pair`; 6 s sau (bộ đếm trong `e.bt`) sinh `spawnMob(..., { persist, tamed })` con non (`age = 0`), hai bố mẹ `love = 0`, `breedCd = 240`.
- Theo người: trong 8 block có người cầm đúng thức ăn, đi tới còn cách 2 block, tốc độ 0,8 x. Không thì lang thang quanh `home` bán kính 10 (nếu quá xa, quay về).
- Sản phẩm: gà đã thuần có `fed > 0`: `prodCd` ngẫu nhiên 150-210 s -> `dropItem('egg')`. Cừu: `shearCd` đếm xuống tới 0 thì mọc lại. `actShear` cần `shears`, cừu trưởng thành, `shearCd <= 0`: `len 1-3`, `shearCd = 240`, `sh = 1`.
- `animalTick` mỗi 1 s: cập nhật `dormant` (xa mọi người sống > 64 block), trừ các bộ đếm của thú không `dormant` bằng `dt`.
- Con non: `ba` trong snapshot; kích thước vẽ x0,5 (`render/entities.js` đang đặt `g.scale.setScalar(shrink)` khi chết nên cần hệ số `o.baseScale` để không ghi đè); `adultSecs` 300.

**Cửa hàng/nhiệm vụ/công thức**: đúng bảng 5.3 và 5.5 của spec, cộng R-6. Nhiệm vụ "Vụ mùa đầu tiên" (`harvest-1`): 3 bước `collect` (`wood_hoe`, `wheat` x6, `bread`), thưởng `xu 30`, `veg_soup x2`; không `consume`. Sau khi ăn bước đầu có thể chế `stone_hoe` thay `wood_hoe`: ghi vào văn bản bước "Sở hữu một cuốc đất (cuốc gỗ)" cho rõ.

### 3.5 Lưu / nạp

- `toSave()` thêm `crops`, `farm` (từ Map: `Object.fromEntries`), `animals` (`serializeAnimals`: mọi `e.persist && MOBS[e.type].farm`, chỉ những trường trong lược đồ ở 2.2; `age/love/breedCd/prodCd/fed/sheared` là giây còn lại).
- `fromSave`: `restoreFarm(g, save)` duyệt `crops`: nếu block tại vị trí **không còn là block cây đúng loại** (phá khi tắt máy) thì bỏ mục; nếu block cây tồn tại mà không có mục thì tạo mục với `g = secs * s / 3`. `restoreAnimals(g, save.animals)` sau `ensureNpcs`, tạo thực thể bằng `spawnMob(..., { persist: true, tamed: true })` rồi gán trường; cắt ở trần 24.
- `sanitizePlayer` cho `food, fatigue, fx, poison` (2.2). Thời gian: đổi `left` thành `until = g.time + left` trong `addPlayer` sau khi gán.
- Người thoát giữa chừng: `removePlayer` -> `playerSave` giữ `food`, `fx` (giây còn lại); khi người offline hiệu ứng không chạy (đúng spec, vì chỉ `g.players` được lặp).

### 3.6 Hiệu năng

- `farmTick`: 1 lượt/giây, ≤ 0,6 ms cho 500 cây (không quét nước trừ khi `farmDirty` hoặc xoay vòng 20 s: tối đa 25 ô/giây x 162 `world.get`).
- `animalTick`: 24 thú, ≤ 0,1 ms/giây (cặp sinh sản dùng lọc theo loài trước, O(n^2) với n <= 24).
- `hungerTick`: O(người chơi).
- Mesh: ruộng 500 cây cộng ≈ 8 000 đỉnh (2 mặt chéo x 4 đỉnh) vào các chunk, nhỏ hơn mức hiện có của cỏ cao.
- Ngưỡng test: `test_perf_survival`: 24 thú + 40 quái + 500 cây trong 64 block quanh 2 người, `avg < 5 ms`, `worst < 25 ms` (giữ ngưỡng `test_perf_tick_with_40_mobs_and_5_players`); `tick` đo sau khi chạy 3 lượt cây để tính cả chi phí đặt block.

### 3.7 Test

Bài mới (tiền tố `test_survival_*`, tên theo AC trong spec): `hunger_drain`, `hunger_exertion`, `hunger_regen_starve`, `eat_table`, `eat_poison`, `food_effects`, `till`, `farmland_wetness`, `farmland_revert`, `crop_growth`, `crop_chunk_sim`, `plant_rules`, `harvest`, `seed_sources`, `animal_tame_ai`, `animal_follow`, `animal_breed_grow`, `animal_products`, `animal_caps`, `cooking_recipes`, `farm_shop_quest`, `save_load`, `ui`, `perf`, `e2e_two_players`; cộng `test_content_valid` mở rộng.

Hàm hỗ trợ cần có (xem 6.2): `mkFarm`, `giveHeld`, `runBig(g, secs, dt)`, `sample(n, fn)`, `fixRng(g, seed)`, `blockAt`.

Cách đo tránh bài chậm: 900 s game / 0,25 s mỗi bước = 3 600 tick. R-34 đảm bảo kết quả không phụ thuộc kích thước bước (sai số <= 1 giây). Trộn: bài chạy lâu (`hunger_drain`, `crop_growth`) có thể đạt 360 s ở bước 0,5.

### 3.8 Bẫy cần tránh

1. Quên thêm trường vào `playerSave` hoặc `sanitizePlayer`.
2. Dùng `g.time` tuyệt đối cho bộ đếm cây/thú rồi bị lệch khi ngoài tầm (R-26).
3. `touch(p)` mỗi tick vì hiệu ứng đếm lùi (gửi cả kho 10 lần/giây): chỉ `touch` khi thêm/mất hoặc `food` đổi.
4. `world.set` trực tiếp thay `g.setBlock` -> không có sự kiện, khách không thấy cây lớn.
5. Block cây là `plant` nên `isReplaceable` coi là thay được; **phải** có `deco: true` (đã nêu), và `actPlace` kiểm `nb` bằng `!isPlant` nên cây không làm điểm tựa (đúng).
6. `surfaceY` bỏ qua cây nên sinh quái hoang trên ruộng: chấp nhận, đuốc vẫn đuổi quái (hướng dẫn trong nhiệm vụ).
7. `entities.create(e)` chỉ chạy một lần khi thực thể xuất hiện; cừu cắt len đổi mô hình cần so `modelIdFor(e)` mỗi khung (khoá `o.mid`) và dựng lại rig khi khác; nếu hết thời gian thì chỉ đổi tooltip (cắt được).
8. `FAIL_TEXT.full` đổi nghĩa; `ui` phải hiển thị lý do mới.
9. Tooltip: đọc `S.world.raycast` mỗi khung đã có ở `mining()`; dùng lại kết quả, không raycast thêm.
10. Ngưỡng `welcomeKB`: cây là block nên tăng delta; đã có RLE (R-4).
11. Hồi chiêu ăn dùng `g.time`, không `Date.now()`.

---

## 4. Gói 3: Chiến đấu có chiều sâu

### 4.1 Dữ liệu

`sim/rules.js` (hằng số có tên, dùng chung host và UI; PLAN yêu cầu không số ma):
```js
export const STAMINA_MAX = 100, STAMINA_REGEN = 25, STAMINA_REGEN_DELAY = 1.0, STAMINA_AIR_MUL = 0.4;
export const SPRINT_COST = 8, ROLL_COST = 25, BOW_COST = 10, EXHAUST_SECS = 2.0, EXHAUST_EXIT = 20;
export const ROLL_TIME = 0.45, ROLL_DIST = 3.5, ROLL_CD = 0.8, IFRAME_FROM = 0.05, IFRAME_TO = 0.35, LAG_COMP = 0.08;
export const COMBO_WINDOW = 0.8, COMBO_END_CD = 0.8, FALL_VY = -2, FALL_MUL = 1.5;
export const PARRY_WINDOW = 0.25, PARRY_GAP = 0.5, PARRY_STUN = 0.8, SHIELD_BREAK_STUN = 1.0, GUARD_ARC = Math.PI / 3 /* ±60° */, SLOW_MUL = 0.6;
export const BOW_MIN_DRAW = 0.2, BOW_CD = 0.4, ARROW_G = 9, ARROW_RANGE = 40, ARROW_TTL = 4, ARROW_RECOVER = 0.3, ARROW_NOISE = 10;
export const WINDUP_FAST = 0.35, WINDUP_SLOW = 0.6, WINDUP_SLOW_CD = 1.4, WINDUP_SLACK = 0.4, STUN_IMMUNE = 3.0;
export const WEAPON_CLS = {
  hand:  { cd: 0.5, cost: 4,  reach: 4.5 },  sword: { cd: 0.5, cost: 6,  reach: 4.5 },
  axe:   { cd: 0.8, cost: 12, reach: 4.5 },  club:  { cd: 1.0, cost: 15, reach: 4.5 },  spear: { cd: 0.7, cost: 8, reach: 6.0 },
};
export function weaponOf(it)            // it.weapon (nếu có, trộn lên mặc định lớp) hoặc suy từ it.tool.type: sword -> sword, axe -> axe, còn lại -> hand
export const reachOf = it => weaponOf(it).reach,  cdOf = it => weaponOf(it).cd,  costOf = it => weaponOf(it).cost;
```
Dữ liệu `weapon` trên vật phẩm chỉ khai khi khác mặc định (đỡ lặp, tránh quên): `swamp_club: { weapon: { cls: 'club' } }`, giáo `{ cls: 'spear' }`, `iron_club` `{ cls: 'club' }`. `validate.js`: mọi vật phẩm có `dmg` đều qua `weaponOf` ra lớp hợp lệ; `bow` có `bow: { draw, dmgMin, dmgMax, speedMin, speedMax }`; khiên có `shield: { reduce, costMul }`. Vì suy theo `tool.type`, 12 vũ khí hiện có không phải sửa mục nào ngoài `swamp_club`.

Vật phẩm mới theo bảng spec 5 (9 món): thêm `dmg` cho giáo/chùy (`wood_spear` 4, `stone_spear` 5, `iron_spear` 7, `iron_club` 8), `bow`, `iron_bow`, `arrow` (stack 64), `wood_shield`, `iron_shield` (có `shield`, `stack: 1`). Không có `tool` nên không ảnh hưởng đào. Công thức theo spec; Xương Cung Thủ rớt `arrow` 2-5 p 0,6; `tho-ren` bán `arrow x8` 12 xu.

Trạng thái người chơi ở host (không lưu, trừ `offhand`):
```
p.sta (float), p.staAt (không tiêu thể lực tới lúc này), p.exhUntil, p.rollAt (-99), p.rollCdAt, p.guardSince (null | g.time), p.guardLast,
p.drawSince (null | g.time), p.shotAt, p.stunUntil, p.combo { n, at }, p.attackAt (đã có), p.offhand (id | null), p.fallVy
```
`p.fallVy`: host tự tính trong `applyState` từ chênh `y` giữa hai gói (không tin `st.vy`) để đòn rơi không bị khách giả mạo.

Thực thể quái: `e.stunUntil, e.stunImmuneUntil, e.windup { until, uid }`.

### 4.2 File tạo / sửa

| File | Việc |
|---|---|
| `sim/rules.js` | hằng số, `weaponOf`, `reachOf/cdOf/costOf` |
| `sim/fight.js` (mới) | `fightTick`, `actRoll/Guard/Draw/Shoot`, `spendStamina`, `isInvuln`, `guardResult`, `actCodeOf`, `resetFight`, `stunPlayer`, `spawnArrow` |
| `sim/combat.js` | `hurtPlayer` đường ống (2.4), `actHit` viết lại (4.4), `updateProjectiles` (4.5), bỏ `HIT_CD` |
| `sim/mobs.js` | `meleeAttack` có windup, quái choáng, `shoot()` trả đạn có `owner` số |
| `sim/boss.js` | `damageNear`: tham số `blockable` (`slam`, `leap` truyền `false`) |
| `sim/game.js` | `act` mới, `applyState` tính `fallVy`, `equip/unequip` offhand, `playerSave`, `addPlayer` |
| `sim/armor.js` | `equip` nhận khiên vào `offhand`; `reduceDamage(extra)` |
| `sim/physics.js` | `stepPlayer(world, p, input, dt)` hiểu `input.roll = {vx, vz}` (ghi đè vận tốc ngang) và `input.slow` |
| `net/snapshot.js`, `net/host.js` | `ps[].act`, `off`, `me`, `stn`, `REPORT`, `hostUid` |
| `content/items.js`, `recipes.js`, `mobs.js`, `shops.js`, `validate.js` | dữ liệu |
| `ui/hud.js`, `ui/panels.js`, `ui/icons.js`, `game.js`, `game.html`, `game.css`, `sfx.js` | thanh thể lực, vòng cung, chấm chuỗi, khiên, ô Tay phụ, phím Q/F, tooltip, icon |
| `render/entities.js`, `render/models/kit.js`, `render/camerafx.js` | quái nghiêng khi `windup`, tư thế người chơi khác theo `act`, tay cầm cung/khiên, camera lăn |

### 4.3 Thể lực, lăn, khiên: chi tiết host

`fightTick(g, dt)` cho từng người sống:
1. Tiêu: chạy nước rút thật (`p.sprint && hypot(p.vx, p.vz) > 1`) tiêu `SPRINT_COST * dt`. Sprint khi `exhUntil` còn hạn: bỏ qua cờ (host không chặn được tốc độ thật, xem bẫy 8.3; client tự chặn).
2. Hồi: nếu `g.time >= p.staAt`, `+STAMINA_REGEN * dt * (trên không hoặc đang giơ khiên ? 0.4 : 1)`. "Trên không" = ô dưới chân `p.y - 0.15` không rắn.
3. Về 0: `p.sta = 0; p.exhUntil = g.time + EXHAUST_SECS; emit exhausted`. Kết thúc kiệt sức khi `g.time >= exhUntil && sta >= EXHAUST_EXIT` (làm rõ spec: cả hai điều kiện).
4. Mọi hành động tiêu thể lực gọi `spendStamina(g, p, n)`: trừ, đặt `staAt = g.time + STAMINA_REGEN_DELAY`, trả `false` (không đổi trạng thái) nếu `sta < n` hoặc đang kiệt sức -> `reason: 'tired'`.

`actRoll`: từ chối khi chết, kiệt sức, choáng, đang kéo cung quá 0,3 s, hồi chiêu `rollCdAt`; ngược lại tiêu 25, `p.rollAt = g.time - (uid === g.hostUid ? 0 : LAG_COMP)`, `rollCdAt = g.time + ROLL_CD`, hủy `guardSince`, `drawSince`; phát `roll {uid}`. `isInvuln = t ∈ [rollAt + 0.05, rollAt + 0.35]` (so với `g.time`).

`guardResult(g, p, src, dmg)` (gọi bước 2 của đường ống): chỉ khi `p.guardSince != null`, `offhand` có `shield`, và `src` nằm trong cung ±60° trước mặt (`dot(dir(yaw), norm(src - p)) >= cos 60°`, tính ngang; `src` không có vị trí ngang -> không chặn). Đỡ hoàn hảo nếu `g.time - guardSince <= 0.25`: 0 sát thương, 0 thể lực, và nếu `src.kind === 'mob'` thì `src.stunUntil = g.time + 0.8`, huỷ `windup`, phát `parry {id}`. Chặn thường: `dmg' = ceil(dmg * (1 - shield.reduce))` rồi tiếp tục giáp; tốn `ceil(dmg * shield.costMul)` thể lực (`costMul` 2 cho khiên gỗ, 1,5 cho khiên sắt, tính trên sát thương gốc trước khi chặn); không đủ -> vỡ khiên: nhận toàn bộ `dmg` qua giáp, `sta = 0`, `stunUntil = g.time + 1`, `guardSince = null`, phát `shield {broke}` và `exhausted`.

Chống lách: `actGuard {on: true}` bắt đầu cửa sổ đỡ hoàn hảo khi `g.time - guardLast >= PARRY_GAP` (nếu chưa đủ 0,5 s thì vẫn giơ khiên nhưng `guardSince = g.time - PARRY_WINDOW` tức không còn cửa sổ). Giơ khiên bị từ chối nếu tay đang cầm đồ có `food|heal` (`reason: 'food'`).

Choáng người chơi (`stunUntil`): client đọc `me`/`ps[].act === 4` và bỏ input di chuyển; host từ chối `roll/hit/draw`. Hồi sinh (`actRespawn`): `resetFight(p)` đặt `sta = 100`, xoá `exh/guard/draw/stun/roll`, `combo = {n:0}`.

### 4.4 Đòn cận chiến (`actHit`)

Thứ tự kiểm (một chỗ):
```
mục tiêu hợp lệ (mob|boss)  -> p.stunUntil -> kiệt sức (tired) -> g.time >= p.attackAt (cooldown)
-> tầm = reachOf(held) (độ cao + hộp thân, như hiện) -> spendStamina(cost) (tired)
-> tính sát thương: base = h.dmg | HAND_DAMAGE
     sword: n = combo.n (0,1,2): mul = [1,1,1.5][n]; chuỗi tiếp nếu g.time - combo.at <= 0.8, sau đòn 3: attackAt += 0.8 thay 0.5, combo -> 0
     club: x1.3 ; axe/spear/hand: 1
     rơi: !onGround(p) && p.fallVy < -2 -> x1.5 (nhân sau các hệ số khác, floor)
     dmg = max(1, ceil(floor(base * mul * fall) * powerMul))      // R-5 mục 3.4
-> damageEntity(e, dmg, p); đẩy lùi: kiếm đòn 3 gấp đôi, giáo = 0 (đặt e.kbT = 0 sau damageEntity), còn lại 1x
-> axe: các mob/boss khác trong 2.5 block quanh e (tối đa 2 mục tiêu phụ), dmg phụ = max(1, floor(dmg * 0.7))
-> club: e.kind === 'mob' && g.time >= e.stunImmuneUntil -> e.stunUntil = g.time + 1; e.stunImmuneUntil = e.stunUntil + 3; huỷ windup
-> p.attackAt = g.time + cd; exert(p, 2) (đói); makeNoise(12) như cũ
```
Đổi vật cầm: `Game.act('sel')` và hoán đổi ô đặt `combo.n = 0`. Chuỗi chỉ tăng khi đòn **trúng**.

Quái choáng: `stepMobs` thấy `e.stunUntil > g.time` thì `vx = vz = 0`, huỷ `windup`, `continue` (không chạy AI, vẫn `stepBody`). Boss không bao giờ có `stunUntil` (kiểm `kind === 'mob'`).

### 4.5 Báo hiệu đòn quái (windup) và đạn

`meleeAttack(g, e, d, t)` mới:
```
if (e.windup) return;                                              // đang vung (AI vẫn gọi mỗi tick)
if (g.time < e.atkAt) return;
if (dist > a.range + t.p.w / 2) return;
const ww = a.cd >= WINDUP_SLOW_CD ? WINDUP_SLOW : WINDUP_FAST;
e.windup = { until: g.time + ww, uid: t.p.uid }; e.atkAt = g.time + a.cd; e.vx = e.vz = 0;
g.emit(null, { t: 'windup', id: e.id, t: ww });
```
`stepMobs` đầu mỗi mob: nếu `e.windup`: đứng yên, quay về mục tiêu; `g.time >= windup.until` -> giải quyết: người chơi còn sống và `dist <= a.range + 0.4 + w/2` -> `r = hurtPlayer(...)`; `kb` theo R-14; phát `swing`; xoá `windup`. Mục tiêu chết/bị choáng giữa chừng thì huỷ không đánh. Boss giữ nguyên chiêu (đã có báo hiệu `telegraph` cho `slam`/`leap`); `damageNear(..., blockable)`: `melee` true, `slam`/`leap` false.

`updateProjectiles` viết lại:
```js
for each proj e:
  const speed = hypot(e.vx, e.vy, e.vz), n = max(1, ceil(speed * dt / 0.4)), h = dt / n;
  for (i < n):
    e.vy -= (e.g || 0) * h; move by h; e.ttl -= h; e.run += speed*h
    if (solid(world.get(e.x, e.y, e.z)) || e.ttl <= 0 || e.run > (e.range || Infinity)) { delete; break }
    if (e.pl) { hit = first mob|boss whose cylinder (w, h, y) contains point -> damageEntity(g, hit, e.dmg, g.player(e.owner)); 30% rơi lại; delete; break }
    else for each player: như cũ -> hurtPlayer(g, p, e.dmg, e, { blockable: e.blockable !== false })
```
`spawnArrow(g, p, force, yaw, pitch, def)` (trong `fight.js`): `speed = lerp(speedMin, speedMax, force)`, `dmg = round(lerp(dmgMin, dmgMax, force))` (AC-15: lực 0,6 -> 21 và 6,6 làm tròn thành 7; sửa AC thành "6,6 ± 0,5 trước làm tròn; sát thương lưu `dmg` thập phân và `damageEntity` làm tròn xuống"), `vx = -sin(yaw) * cos(pitch) * speed`, `vy = sin(pitch) * speed`, `vz = -cos(yaw) * cos(pitch) * speed` (khớp `dirOf()` ở `game.js`), `g: ARROW_G`, `range: 40`, `ttl: 4`, `owner: uid`, `pl: true`, `style: 'arrow'`. Điểm bắn: mắt `(p.x, p.y + 1.62, p.z)` + 0,5 theo hướng bắn (tránh trúng ngay block đang đứng).

`snapshot` đạn: `o.pit` đã tính từ `vy` (có trọng lực nên mũi tên chúc xuống tự nhiên, không cần thêm).

`actDraw {on}`: bật khi cầm `bow` và chưa kéo: `drawSince = g.time` (thể lực không tiêu lúc kéo; tiêu 10 khi bắn). Tắt thì `drawSince = null`. `actShoot`: cần `drawSince != null`; `held = bow`; `force = min(1, (g.time - drawSince) / bow.draw)`; `< 0.2` -> trả `{ok:false, reason:'weak'}` và không trừ mũi tên; hồi chiêu `BOW_CD`; `removeItem(inv, 'arrow', 1)` nếu thiếu `no-ammo` + toast `Hết mũi tên!`; `spendStamina(BOW_COST)`; `makeNoise(ARROW_NOISE)`. Không bao giờ đọc `force` hay thời điểm từ gói của khách (AC-32).

### 4.6 Giao diện và điều khiển (`game.js`)

- `Q`: lăn. Hướng = tổ hợp WASD đang giữ (không bấm: về phía trước) theo `yaw`; `S.act({t:'roll', dx, dz})`; **dự đoán cục bộ**: `local.roll = { t0, vx, vz }` (7,8 b/s) trong `ROLL_TIME`, `stepPlayer` nhận `input.roll`; camera hạ thấp và nghiêng (thêm vào `camFx`). Khi nhận `fail` `a === 'roll'` thì `local.roll = null`.
- `F` giơ khiên (giữ). Chuột phải: `mousedown` -> `if (!useItem()) startGuard()`; `mouseup` -> `stopGuard()`. `startGuard` chỉ gửi nếu `you.offhand`.
- Chuột trái giữ khi cầm `bow`: `mining()` không đào/đánh; sang nhánh `bowTick`: `mousedown` -> `draw on`; thả -> `shoot` với `yaw/pitch` hiện tại. Vòng kéo HUD tính bằng đồng hồ cục bộ (chỉ để vẽ).
- Tốc độ x0,6 khi giơ khiên hoặc kéo cung và huỷ chạy nước rút: `inputNow()` đặt `sprint = false`, thêm `slow: 0.6`; chạy nước rút cũng bị chặn khi `me.sta < 1` hoặc `me.exh > 0`.
- `pickEntity(o, d, reachOf(held))`; `lastHit` so với `cdOf(held)`.
- Chuỗi kiếm: `hud.setCombo(snap.me.cmb)`; thể lực: `hud.setStamina(snap.me)` mỗi khung (rẻ); cung: `hud.setDraw`.
- Ô Tay phụ trong `panels.equipmentRow(you)`: thêm ô thứ 5 hiển thị `you.offhand`; bấm để cởi (`act {t:'unequip', slot:'offhand'}`); chuột phải vào khiên trong kho gửi `equip`; `armor.equip` trả `not-armor` cho cung/giáo (AC-29).
- Người chơi khác: `render/models/kit.js` `animate(rig, { ..., act })` thêm tư thế đơn giản (tay phải lùi khi kéo cung, tay trái giơ khiên, thân thấp khi lăn, nghiêng khi choáng); khiên vẽ là hộp nhỏ gắn xương tay trái khi có `off`.

### 4.7 Lưu / nạp

`playerSave` thêm `offhand`. Không lưu thể lực, trạng thái giơ/kéo/lăn/choáng, chuỗi kiếm (về mặc định khi nạp). `sanitizePlayer`: `offhand` hợp lệ khi `ITEMS[id]?.shield`, nếu không thì `null`. Khiên đang đeo **không** nằm trong `inv`; kiểm `equip`/`unequip` không nhân bản (mẫu `armor.equip`: đổi chỗ trả món cũ về ô).

### 4.8 Hiệu năng

- `fightTick`: O(người). `updateProjectiles` bước con tối đa 4/đạn/tick; 10 đạn x 4 bước x 40 quái = 1 600 phép thử/tick, ~0,05 ms.
- `windup`: thêm một nhánh `if` mỗi mob mỗi tick, không đo được.
- Sự kiện `windup`: ≤ 1 gói/quái/vung; quái cận chiến ≤ 40 nhưng chỉ quái ở sát người chơi vung: dưới 10 gói/giây.
- Giữ ngưỡng `test_perf_tick_with_40_mobs_and_5_players`.

### 4.9 Test

Tiền tố `test_combat2_*` theo 35 AC. Bài cũ phải sửa (ghi lý do trong bài): `test_mob_ai_chase_melee_closes_in_and_bites`, `test_hit_from_behind_makes_mob_turn_and_chase_and_pack_joins` và mọi bài đo "cắn trong 0,x giây" cần cộng 0,4-0,6 s windup; `test_combat_hit_rules_damage_and_cooldown` vẫn đúng (hai đòn kiếm + đổi sang tay không, đã kiểm tay: 15, 10, rồi tay không 1 -> 9). `test_boss_*` không phụ thuộc windup vì boss không đổi.

Hàm hỗ trợ: `mkFight` (arena + mob đứng yên + kiếm), `setHeld`, `advance`, `stamina(p)`, `hurtAt(g, p, dmg, srcPos, opts)` (tạo `src` giả ở góc cho trước), `clock(g, secs)`.

### 4.10 Bẫy cần tránh

1. Tên sự kiện `block` (R-1).
2. Khách không biết kết quả `act` (R-2): đừng viết UI chờ `ok`.
3. `Game.hurtPlayer` phải `return` (R-14); mọi chỗ gọi `hurtPlayer` có `src` (mob, boss, đạn, bẫy) đều qua đường ống; đừng thêm đường tắt trừ môi trường.
4. `reduceDamage` dùng `Math.round`, khiên dùng `ceil` cho phần còn lại: chọn một kiểu (ở đây khiên `ceil`, giáp `round`) và kiểm trần: chặn ra 0 thì vẫn `max(1)`.
5. Bước con đạn (R-12) và `aggro` cần `src.uid` (R-13): truyền người chơi, không truyền `proj`.
6. Chuỗi kiếm gắn với `p.combo`, **không** gắn với vật phẩm: đổi ô nhanh hoặc `swap` làm chuỗi về 0.
7. `onGround` của người chơi không có trên host; dùng `fallVy` + ô dưới chân.
8. Sprint host không chặn được tốc độ thật (R-17 và ngưỡng `14*dt+3`): thể lực chỉ là ràng buộc mềm cho khách gian lận, ghi vào ACCEPTANCE.
9. Cửa sổ lăn chịu trễ (R-16); test mạng dùng độ trễ giả lập để chứng minh không hụt.
10. `makeNoise` trong `hurtPlayer` phát tiếng mỗi lần dính đòn; đòn bị chặn/lăn không phát (tránh quái biết vị trí khi người chơi né tốt).
11. Chuột phải: `useItem()` trả boolean (R-22); chạy `mouseup` ở `blur` để khỏi kẹt khiên giơ.
12. Bắn: gửi `shoot` lúc thả chuột mà chuột đã rời cửa sổ -> dùng `addEventListener('mouseup')` toàn cục như hiện có.

---

## 5. Gói 2: Hầm ngục có chủ đề

### 5.1 Dữ liệu và dựng

`content/dungeons.js` (mới, dữ liệu thuần):
```js
export const THEMES = { 're-muc': { floor: 'moss', pillar: 'log', accent: 'stone_brick', torch: true }, ... };   // palette block có sẵn
export const DUNGEONS = {
  'ham-re-muc': { name: 'Hầm Rễ Mục', region: 'rung-suong', theme: 're-muc', boss: 'ham-chu-re-muc', mobs: ['xac-song', 'soi-xam', 'xuong-cung'],
    traps: ['dart', 'spike', 'dart'], mats: ['herb', 'bone'] },   // ba chặng theo thứ tự P3
  ... 6 hầm theo bảng 4.1 của spec ...
};
export const LAYOUT = { /* xem 5.2: phòng, hành lang, cổng, rương, điểm sinh, chặng bẫy, đuốc */ };
export const LOOT = { supply: [...], victory: [...], trap: [...], treasure: [...] };   // đúng bảng 4.6 của spec
export const TRAP = { spike: { period: 4, down: 1.5, warn: 0.5, up: 2.0, dmg: 4, gap: 0.8 }, dart: { delay: 0.3, cd: 5, dmg: 5, speed: 14 },
  vent: { period: 5, rest: 3.2, warn: 1.0, spray: 0.8, radius: 1.6, dmg: 6, kick: 5 } };
```
`validate.js`: hầm tham chiếu vùng/quái/boss/vật phẩm tồn tại; `traps.length === 3`; `LAYOUT` có `chests.{supply,victory,trap,treasure}`, `gates.{iron,boss}`; mỗi hầm có `boss` với `dungeon === id`.

Sáu chủ hầm trong `content/bosses.js`: đúng bảng 4.7 (máu, cận chiến, chiêu riêng, slam, gọi quái), `region`, `flag: 'boss:<id>'`, `unlocks: null`, `dungeon: '<id hầm>'`, `radius: 9`, mô hình: thêm `BOSS_MODEL['ham-chu-*']` trỏ vào mô hình có sẵn kèm tuỳ chọn tint (`definition('dg:<id>')` gọi `wolfModel({boss:true, tint})`...). Cắt nếu hết thời gian: dùng đúng mô hình sẵn, chỉ khác tên.

### 5.2 Bố cục (Ruling R-3, R-19)

Toạ độ cục bộ: gốc `O` = chân cầu thang ở mức sàn `fy`; +X hướng cầu thang đi xuống tới `O`; +Z về phía nam. Phòng là khoang rỗng (ô khí), tường dày 1 ô `dungeon_wall` bao quanh mọi khoang, lớp sàn y = `fy - 1`, khoang từ y = `fy`. Khoảng đặc còn lại giữ nguyên địa hình tự nhiên.

| Khoang | x | z | cao | Ghi chú |
|---|---|---|---|---|
| Cầu thang | từ `-(2*steps)` tới `0` | -1..1 | 3 trên bậc | `steps = gy - fy` (6..16), mỗi bậc 2 ô, cao 1 |
| Miệng hầm (mặt đất) | tâm tại `-(2*steps+3)` | -3..3 (7x7) | | sàn gạch, 2 cột đuốc, `flatten()` dùng lại |
| P1 Sảnh | 1..11 | -5..5 | 5 | 4 đuốc, rương tiếp tế |
| Hành lang C1 | 12..17 | -1..1 | 3 | |
| P2 Phòng canh gác | 18..28 | -5..5 | 6 | tâm (23, 0), 8 điểm sinh, rương chiến thắng ở tâm |
| Hành lang C2 | 22..24 | -11..-6 | 3 | cổng sắt ở mặt phẳng z = -11 (3x3) |
| P3 Phòng bẫy | 18..28 | -28..-12 | 5 | ba chặng theo `z`: -13..-17, -18..-23, -24..-27; rương chìa ở (23, -28) |
| Hành lang C3 | 12..17 | -21..-19 | 3 | từ tường tây P3; cổng chủ ở mặt phẳng x = 12 |
| P4 Phòng chủ | tâm (2, -20), bán kính 9 | | 8 | 4 cột, rương kho báu sinh ở tâm khi boss chết |

Hộp bao: x ∈ [-(2*steps+7), 30], z ∈ [-30, 6] -> với 12 bậc: **62 x 37**; 16 bậc: **70 x 37**. Chiều dọc: từ `fy - 1` tới `max(gy + 3, fy + 9)`. Đường đi tổng ≈ 90-100 block (bao gồm cả khúc gấp). Độ thấp hầm: trần cao nhất (P4) = `fy + 9` thấp hơn `minH` ít nhất 2 (R-19), nên toàn khối nằm dưới mặt đất trừ miệng hầm.

Chặng bẫy sinh bởi `placeStage(type, z0, z1)`: `spike`: hai hàng 11 x 2 (lệch pha 2 s) tại hai đầu chặng; `dart`: 3 `plate` so le, 2 `dart_trap` trên tường x = 17 và x = 29 mỗi tấm cùng hàng z (R-9: tất cả rắn); `vent`: 2 `vent` giữa phòng. Người chơi có thể nhảy qua gai (cao 0,6 so với nhảy 1,2): chấp nhận (spec cho phép "quan sát nhịp, rón rén, hoặc phá").

`sim/dungeon.js`:
```js
export function layoutCells(site, dungeonId)     // -> { cavities: [...], walls: Set, floor: [...], blocks: [{x,y,z,id}] , chests, gates, spawns, plates, darts, vents, spikes, p4 }
export function buildDungeon(g, dungeonId, site) // đặt bằng world.set (không phát sự kiện: dựng trước khi có người chơi), theo thứ tự: tường -> khoang rỗng -> sàn/cột/đuốc -> bẫy -> cổng -> rương
export function dungeonAt(flags, x, y, z)        // -> { id, site, room } | null  (hộp bao, dùng cho HUD và cấm sinh quái)
export function trapPhase(t, period, offset)     // hàm thuần, host và client vẽ cùng công thức
export function spikeUp(t, row), ventState(t, id) // 'rest'|'warn'|'spray'
```
`structures.js`: `findSite(g, region, used, { minGap, accept })`; mọi gọi cũ giữ nguyên chữ ký. `buildStructures` mới: `sites.dungeon ||= {}`; thế giới cũ chỉ dựng hầm còn thiếu (giống `fresh2`); `used` cộng thêm tâm hầm đã có; điều kiện thoát `if (!fresh && !fresh2...)` phải tính cả `fresh2.dungeon`; **bỏ qua điểm có chunk đã bị chỉnh sửa trong hộp bao** (`Object.keys(world.delta)` giao với dải chunk của hộp; delta chỉ có block đã đổi nên người chơi chưa đụng thì không lọt). Hầm là hầm tối: không thêm ánh sáng thật; `mesher.sky()` đã làm khoang kín tối nhờ mức che trời (đúng "hơi tối do nền màu").

### 5.3 Cổng, chìa, rương

```js
// sim/dungeon.js
export function actGate(g, p, a)      // gate: block ∈ {GATE_IRON, GATE_BOSS}, reach 6.5; có chìa đúng loại -> removeItem 1, 9 ô 3x3 thành AIR bằng g.setBlock(.., q:1), flags.dungeons[id].gates[g|b] = true; không -> fail 'need-key' + toast "Cần Chìa Hầm"/"Cần Chìa Chủ Hầm"
export function actDChest(g, p, a)    // dchest: tra chestAt(g, x, y, z) -> { id, kind }; kiểm điều kiện; sinh thưởng tất định; ghi claimed; emit 'loot'
export function chestAt(g, x, y, z)   // duyệt 6 hầm x 4 rương (24 so sánh)
export function rewardFor(g, dungeonId, kind, uid)  // rng = makeRng(hashStr(`${seed}|${id}|${kind}|${uid}`)); trả [{item,n}]
```
Điều kiện: `supply`, `trap` mở ngay; `victory` cần `flags.dungeons[id].rooms.p2`; `treasure` chỉ tồn tại sau khi boss chết (sinh block ở `onKill`). Đã nhận -> phát `loot {claimed: true}` (UI "Bạn đã nhận phần thưởng rương này"). Phần không vừa kho rơi xuống chân (`collect`). `hashStr`: băm FNV-1a 32 bit của chuỗi, đặt trong `sim/rng.js` (hàm thuần, thêm 6 dòng); dùng `makeRng` có sẵn.

`dungeon_key`, `boss_key`: `bound: true` (R-7), `stack: 8`. `heal_potion` theo R-15 PLAN. `actChestMove` từ chối `bound` (`reason: 'bound'`).

Chìa không vào `shops.js`; nhưng `validate.js` cần nguồn: thêm mọi `LOOT[*]` vào tập nguồn (cùng cách với `CROPS`).

### 5.4 Phòng canh gác (P2)

Trạng thái chạy lúc chơi, **không lưu**: `g.dg[id] = { wave: 0, mobs: [], nextAt: 0, idle: 0 }`. `dungeonTick`:
1. Chỉ xét hầm có người sống trong hộp bao + 40 block (`nearDungeon`), còn lại bỏ qua O(1).
2. P2 chưa dọn và có người sống cách tâm P2 ≤ 5: `wave = 1`, sinh `4 + min(4, inRoom - 1)` quái ngẫu nhiên từ `DUNGEONS[id].mobs` (rng theo hash của `(seed, id, wave)`, khác gọi `g.rng`) tại điểm sinh cố định (`LAYOUT.p2.spawns`), `persist: true, dg: id`, ép `startChase` vào người gần nhất.
3. Hết quái đợt 1, chờ 2 s, đợt 2: 3 thường + 1 `tuong-da` (+ người), cộng thêm theo số người như trên.
4. Dọn xong đợt 2: `flags.dungeons[id].rooms.p2 = true`, phát `dungeon {room: 'p2', cleared: true}`; mở khoá rương chiến thắng; mọi lần sau `wave = 0` và không sinh.
5. Không còn người sống trong 30 block quanh P2 -> xoá quái của đợt, `wave = 0`.
Phát `dungeon {left: n}` khi `n` đổi (cho những người trong phòng), không phát mỗi tick.

### 5.5 Bẫy

`dungeonTick` (chỉ khi có người trong 40 block): với mỗi người sống trong hộp bao P3:
- **Gai**: với mỗi ô `SPIKES` của chặng (≤ 22 ô, từ `layoutCells` đã cache theo hầm): nếu `world.get` vẫn là `SPIKES` và ô trên đầu không đặc, `trapPhase(t, 4.0, rowOffset) ∈ [2.0, 4.0)` (nhô lên) và hộp người chơi giao hộp gai `[x, x+1] x [fy, fy+0.6] x [z, z+1]`, `g.time >= p.spikeAt` -> `hurtPlayer(g, p, 4, trapSrc, { blockable: false })`, `p.spikeAt = g.time + 0.8` (AC-6: đứng 4 s ≈ 3 lần vì nhô 2 s / nhịp 0,8; spec nói "= 12": làm đúng bằng test đo số lần).
- **Tên**: ô `PLATE` còn nguyên và người chơi đứng trên (`floor(y - 0.05) === plateY`, cùng ô x,z), `!p.sneak`, `g.time >= plateCd[key]` -> `plateCd[key] = g.time + 5`, `pending.push({ at: g.time + 0.3, darts })`. Khi đến hạn: với mỗi `DART_TRAP` còn nguyên, tạo `proj` `{ vx: ±14, owner: null, dmg: 5, style: 'arrow', blockable: true }` ở cao độ ngực. Phá `PLATE` hoặc `DART_TRAP` bằng cuốc là vô hiệu hoá vĩnh viễn (chỉ cần `world.get(...) === block`; không cần lưu cờ).
- **Phun**: `ventState(t, id)`: `rest 3.2 / warn 1.0 / spray 0.8`; lúc `spray`, mỗi người trong bán kính 1,6 quanh `(x + 0.5, fy + 0.5, z + 0.5)` bị 6 sát thương **một lần mỗi đợt phun** (`p.ventAt[key] = floor((t + offset) / 5)`), `kb {vy: 5}`.
`trapSrc = { id: 'trap', x, y, z }`.

Pha bẫy (`trapPhase`) tính từ `g.time`; client có `S.time` (từ snapshot) nên vẽ cùng pha (lệch ≤ 0,2 s theo AC-17 vì snapshot 10 Hz). Client không cần trạng thái bẫy nào khác.

Client vẽ: `render/effects.js` thêm `setTraps(list)` (một `InstancedMesh` hộp gai, một mesh tấm lún, sprite phát sáng cho ống phun), nhận danh sách từ `trapView(S.flags, S.time, local, 40)` (hàm thuần trong `sim/dungeon.js`, chỉ trả bẫy còn `world.get` đúng loại trong 40 block).

### 5.6 Chủ hầm

`stepArenas(g, dt)`: gom thành danh sách `{ bossId, site, radius }` từ `sites.arena` (như cũ) **và** từ `sites.dungeon` (`p4`, `radius: 9`, chỉ khi `P2` đã dọn là không bắt buộc; cổng chủ đã mở là điều kiện tự nhiên vì không ai vào được P4). Phần còn lại giữ nguyên (spawn khi có người, đặt lại sau 5 s). Bỏ `buildArena` cho boss có `dungeon` (R-8).

`onKill` (boss): nếu `d.dungeon` thì `flags.dungeons[id].boss = true`, đặt `DCHEST` rương kho báu tại tâm P4 (`setBlock`), phát toast, rơi `xu` 80-150 (tăng 20 mỗi hầm) và `ancient_shard` 2-4 bằng `drops` của boss (không cần mã đặc biệt: dùng bảng `drops`). `creditBoss` đã chạy nhờ `onBossDefeated`.

Nhiệm vụ "dọn hầm": 6 mục trong `content/quests.js` loại `boss` (`boss: 'ham-chu-...'`), `requires: { flag: <cờ mở vùng> }` (cờ boss vùng đã đặt), giao bởi NPC làng gần vùng nhất (`truong-lang`, `thuong-nhan`, `an-si`, `ngu-dan`, `tho-lua`, `hoc-gia` theo bảng 4.1) cộng nút `accept`/`turnin` trong `npcs.js` (validator bắt thiếu).

### 5.7 Giao diện

- Biểu ngữ tên hầm: client tự phát hiện bước vào hộp bao (`dungeonAt(S.flags, local.x, local.y, local.z)` mỗi 0,5 s); không cần sự kiện cho việc đó.
- HUD hầm (`#dungeon`): "Phòng x/4 · Quái còn n · Chìa Hầm a · Chìa Chủ b". `x` suy từ vị trí (khoang chứa `local`); `n` từ sự kiện `dungeon.left`; số chìa đếm từ `S.you.inv`.
- Gợi ý hướng (`#dghint`): ≤ 80 block tới `site.c`, chưa có `S.flags['boss:' + boss]`, chưa vào hộp bao; 8 hướng la bàn tiếng Việt (Bắc, Đông Bắc…).
- Bảng "Chiến lợi phẩm": `panels.showLoot(ev)`.
- `FAIL_TEXT`: `'need-key'` (toast đỏ), `'locked'`: "Rương chưa mở được."
- Icon: 6 vật phẩm (`dungeon_key`, `boss_key`, `heal_potion`, `ancient_shard`, `ancient_pick`, `delver_blade`).

### 5.8 Lưu / nạp / đồng bộ

- Block (cổng đã mở, bẫy đã phá, rương kho báu, toàn bộ khuôn hầm) nằm trong delta. Cờ trong `flags.dungeons[id]` và `flags.sites.dungeon[id]` đã đi theo `flags` trong `welcome` và save.
- Khách: cờ `rooms.p2`, `boss` cập nhật qua `dungeon` và `boss-defeated` (`flags['boss:' + type]` đã có trong `ClientSession.handleEvent`). Thêm vào `handleEvent`: `else if (ev.t === 'dungeon') { merge vào this.flags.dungeons }`.
- Không lưu thực thể: quái đợt đang đánh dở mất khi thoát, phòng quay về chưa dọn (đúng spec).
- Người vào muộn: block đúng nhờ delta; trạng thái phòng/cổng đúng nhờ `flags`.

### 5.9 Hiệu năng

- Dựng 6 hầm: ≈ 10 000 `world.set` mỗi hầm (khoang rỗng + tường). Mỗi `set` mở chunk (cache), `exportDelta` ở bước sau. Mục tiêu dựng ≤ 1,5 s tổng thêm (AC-21) và gói chào ≤ 400 KB nhờ RLE (R-4). Đo bằng `test_dungeon_perf_build`.
- Tick: chỉ khi có người trong 40 block; 5 người trong P3: 22 ô gai + 3 tấm + 2 ống = ~30 phép thử x 5 người = 150 phép thử/tick, ≪ 0,2 ms. Ngưỡng test: ≤ 2 ms thêm so với cùng kịch bản ở thế giới không có hầm.
- Mesh: hộp bao 62 x 37 trải trên ~12 chunk; tường đặc nên số mặt vẽ nhỏ.

### 5.10 Test

Tiền tố `test_dungeon_*` theo 21 AC (đã sửa AC-2 theo R-3 và AC-19 theo PLAN #4: số tile mới >= 9 và khác nhau). Hàm hỗ trợ: `mkDungeon(seed, id)` (tạo `Game`, `buildStructures`, đặt người chơi ở chân thang), `pathExists(g, from, to)` (BFS 3D trên ô trống, cho phép bước lên <= 1 và rơi <= 3, coi cổng đóng là tường), `digTest(g, x, y, z)` (đào bằng `ancient_pick`/`crystal_pick` ở mọi mặt, khẳng định không phá được `dungeon_wall`), `manySeeds([..5 seed..])`, `freezeMobs`, `stepSeconds`. Seed >= 5 (AC-1); save cũ không có `dungeons` (AC-16); điểm có chunk bị chỉnh sửa bị bỏ (AC-16).

### 5.11 Bẫy cần tránh

1. Boss hầm trong `BOSSES` -> đừng dựng đấu trường mặt đất (R-8); các bài hiện đếm mô hình của mọi boss (`entityList`) nên `BOSS_MODEL` phải đủ 6 mục mới.
2. `findSite` dùng `columnInfo` (hàm thuần theo seed): dựng hầm trước khi người chơi đào bất kỳ thứ gì là an toàn; với save cũ phải kiểm delta (5.2).
3. Khoang rỗng cắt vào hang tự nhiên: tường bọc dày 1 ô phải được đặt **sau** khi đào khoang và bao cả cầu thang, hành lang; cầu thang cắt mặt đất tại miệng hầm là lối vào duy nhất (test AC-3 đào từ mặt đất xuống).
4. `world.set` dựng khung ở xa người chơi kích hoạt `chunk()` sinh chunk đồng bộ, và các chunk này nằm trong `world.chunks` tới lần `keepAround` đầu tiên; dựng trước `ChunkView`/worker (như `buildStructures` hiện nay) để `init` của worker nhận đúng delta, không phát `set` từng ô.
5. Rương: `chestAt` phải so toạ độ **tuyệt đối** đã dựng (cache theo hầm), không suy từ `flags` của client.
6. Thưởng tất định phải không dùng `g.rng` (thứ tự gọi thay đổi theo hành động khác).
7. `hurtPlayer` cho bẫy: `src = { id: 'trap', … }` không có `uid`/`kind`; đỡ hoàn hảo không choáng được bẫy (đã kiểm `src.kind === 'mob'`).
8. Mũi tên bẫy là `proj` với `owner = null`: `typeof null !== 'string'` nên không bị coi là đạn người chơi.
9. Cổng 3x3 mở bằng 9 `setBlock`; test tính 9 sự kiện `block` nhưng UI chỉ cần `q: 1`.
10. `tuong-da` có `regions: []` và `weight: 0`; không bao giờ vào `spawnTick`. Chỉ sinh bằng `spawnMob` trực tiếp (có `persist`).
11. Mọi `dg` mob phải được xoá khi `flags.dungeons[id].rooms.p2` đã đặt mà vẫn còn sót (tránh quái đuổi người ra khỏi hầm mãi): xoá khi cách hộp bao > 40.

---

## 6. Test harness (`tests/harness.py`)

### 6.1 Di chuyển và chia sẻ

`tests/test_game.py` định nghĩa riêng `JS_HELPERS`, `GAME_JS`, `ARENA_JS`, `NET_JS`, `ev`; `test_net.py` định nghĩa `JS_HELPERS` khác. Việc làm ở S0: **chuyển** `JS_HELPERS`, `ev`, `GAME_JS`, `ARENA_JS`, `NET_JS` sang `tests/harness.py` (giữ nguyên tên; `test_game.py` `from harness import run, root, ev, GAME_JS, ARENA_JS, NET_JS`). `GAME_JS` và `ARENA_JS` dựng `new Game({ seed, spawning: false, env: false, hunger: false, ...opts })` để 106 bài cũ không bị đói/thể lực chen vào (AC-26 Sinh tồn). Bài mới tự đặt `hunger: true`.

### 6.2 Hàm JS mới (chuỗi nối vào `ARENA_JS`)

```js
// FARM_JS
const mkFarm = (opts) => ({ g, p, cx, cz, y0, ... })   // sân cỏ phẳng 41x41, nước ở (cx+3..cx+4, y0, cz); trả thêm till(dx,dz), plant(dx,dz,seed), cellId(dx,dz,dy)
const giveHeld = (g, p, id, n = 1) => { p.inv.fill(null); p.inv[0] = { id, n }; p.sel = 0; g.touch(p); }
const runBig = (g, secs, dt = 0.5) => { for (let t = 0; t < secs; t += dt) g.tick(dt); }
const fixRng = (g, seed = 1) => { g.rng = (await imp('sim/rng.js')).makeRng(seed); }      // gọi trong ev async
const sample = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const nearly = (a, b, tol) => Math.abs(a - b) <= tol;
// FIGHT_JS
const mkFight = (opts) => ({ g, p, m /*quái đứng yên cách 2.5*/, cx, cz, y0 })    // p cầm kiếm sắt, thể lực đầy
const setHeld = giveHeld, hurtAt = (g, p, dmg, dx, dz, opts) => g.hurtPlayer(p, dmg, { id: 777, kind: 'mob', x: p.x + dx, z: p.z + dz, y: p.y }, opts)
const faceDir = (p, deg) => { p.yaw = deg * Math.PI / 180; }
// DUNGEON_JS
const mkDungeon = async (seed, id) => { ...Game({seed, spawning:false}) + buildStructures; teleport người chơi tới chân thang... }
const pathExists = (g, a, b, opts) => bool                   // BFS 3D
const trySmash = (g, p, x, y, z, toolId) => bool            // dig+break bằng g.act sau g.tick(99)
```
Python:
```python
def two_players(pg, browser, base, seed=777, extra=''):    # tách từ _e2e_two_players: mở A (host), B (khách) ?net=memory, chờ pending 0, trả (A, B, a_uid, b_uid)
def tp(A, uid, x, y, z)                                       # dịch chuyển do host (đã có dạng lambda trong e2e)
def colors_in_screenshot(pg)                                  # số màu khác nhau của ảnh chụp (kiểm ruộng/hầm không trống)
def icons_distinct(pg, ids)                                   # sinh icon theo id, trả {distinct, blank}
```
`NET_JS` (đã có `mkHost`, `join`) dùng cho test không cần trình duyệt thật: thêm `mkPair(code)` trả `{ game, host, a, b }` để viết nhanh bài đồng bộ.

### 6.3 Quy ước

- Mọi bài mới dùng `g.rng = makeRng(n)` khi đếm xác suất; số mẫu 1000-2000, dung sai theo AC.
- Bài thống kê (AC-14, AC-18 Chiến đấu…) không nên chạy 2000 lần `g.tick`; gọi trực tiếp hàm đơn vị (`actBreak` đã có, `damageEntity` + `dropLoot`) để mỗi bài < 5 s.
- Bài có ảnh chụp dùng `test_render_screenshot` làm mẫu (`browser`, `base`).
- Số bài kỳ vọng sau mỗi gói: ghi vào bảng PLAN mục 8; tên bài mới không đổi tên bài cũ.

---

## 7. Ngân sách hiệu năng (tổng hợp, không nới ngưỡng cũ)

| Hạng mục | Ngưỡng | Cách đo |
|---|---|---|
| `Game.tick` 40 quái + 5 người (đã có) | avg < 5 ms, worst < 25 ms | `test_perf_tick_with_40_mobs_and_5_players` (giữ nguyên) |
| `Game.tick` + 24 thú + 40 quái + 500 cây (64 block) | avg < 5 ms, worst < 25 ms | `test_survival_perf` |
| `farmTick` một lượt, 500 cây | ≤ 1 ms | cùng bài |
| Dựng 6 hầm (thế giới mới) | thêm ≤ 1,5 s; tổng `buildStructures` < 2 000 ms (đã có) | `test_perf_structures_and_welcome_size` (giữ) + `test_dungeon_perf_build` |
| Gói chào (`delta` + `flags`) sau 6 hầm | < 400 KB (ngưỡng cũ) | cùng bài, nhờ RLE |
| Snapshot 5 người + 24 thú + 10 đạn | < 4 KB | `test_game_snapshot_budget` |
| `toSave()` thế giới có 1000 cây, 24 thú | `crops` + `animals` < 100 KB | `test_survival_save_load` |
| Tick host 5 người trong P3 | ≤ 2 ms thêm so với đối chứng | `test_dungeon_perf_tick` |
| Mesh chunk có 500 cây | không vượt ngưỡng mesh hiện có | `test_perf_survival` (dùng `buildChunkMesh`) |
| Hitch khi cây đổi giai đoạn | ≤ 1 lần dựng lại chunk/giây | R-20, đo số lần `takeDirty` trong 5 s |
| Khung hình (client) | giữ `test_perf_streaming_frame_cost` | không đổi |

---

## 8. Bẫy chung (checklist cho Leader review diff)

1. **Chỉ host mô phỏng**: client không được ghi `food`, `sta`, cây, bẫy; client chỉ dự đoán lăn/giơ khiên/kéo cung (hiển thị).
2. **`touch(p)`** gửi cả kho; chỉ dùng khi dữ liệu trong `you` đổi. Trường nhanh (thể lực, chuỗi) đi qua `snap.me`.
3. **Sprint host không kiểm được** (`applyState` chỉ giới hạn khoảng cách); thể lực kiểm mềm. Không hứa chống gian lận trong ACCEPTANCE.
4. **Kích thước gói**: `welcome` mang `flags` nguyên; `flags.dungeons[*].claimed` chứa uid, tối đa 5 người x 4 rương x 6 hầm; chấp nhận được. Đừng thêm mảng lớn vào `flags`.
5. **Thứ tự tick**: `fightTick` sau `updatePlayers`; `dungeonTick` sau `farmTick`. Đảo thứ tự có thể làm bài đo chính xác lệch một tick.
6. **Đồng hồ**: `g.time` cho thời hạn ngắn không lưu; "giây còn lại" cho mọi thứ lưu (R-26). Không trộn `Date.now()`/`performance.now()` vào sim.
7. **`act` tuỳ ý từ khách**: kiểm kiểu và biên mọi trường; đạn `yaw/pitch` hữu hạn; không bao giờ đọc `force`, `t`, `time`, `uid` từ gói khách (trừ `uid` đã gắn theo peer).
8. **Sự kiện `block` hàng loạt** (cổng 9 ô, cây): client nhận hết; `confirmEdit` và `pendingEdits` chỉ liên quan `break/place` của chính mình nên không hỏng.
9. **`delta` không bao giờ co lại** (đã ghi hoãn ở ACCEPTANCE): cây phá đi để lại `AIR` trong delta; chấp nhận.
10. **Mô hình/hoạt ảnh**: mọi mô hình mới phải qua `test_models_exist_for_every_creature_and_every_face_is_painted` (mọi mặt có pixel) và `test_models_share_geometry...` (một lệnh vẽ); xương <= 32, tam giác <= 1400.
11. **Phím**: `Q`, `F` chưa dùng (hiện `E`, `M`, `F3`, `C`, `Shift`, `Space`, `1-9`); không bắt `Tab`.
12. **`pointerlockchange`** mở menu tạm dừng khi mất khoá chuột: giơ khiên/kéo cung phải bị huỷ ở `blur`/`setPause` (thêm `stopGuard()`, `cancelDraw()`).
13. **`models.html`/`tools/export_design_data.py`** đọc `ALL_MODEL_IDS`, `ITEMS`, `BLOCKS`: thêm khoá mới (`crops`, `animals`, `dungeons`, `weapons`) vào script xuất và chạy lại cuối mỗi gói.
14. **Không số ma**: mọi hằng số có tên trong `sim/rules.js` hoặc `content/*`; `validate.js` phải bắt được dữ liệu hỏng mới (thêm bài `test_content_validator_catches_broken_references` cho ca mới: hầm thiếu boss, thú thiếu thức ăn, vũ khí lớp lạ).
15. **Không commit/push, không đụng token** (nhắc lại quy tắc cứng): chỉ commit cục bộ khi người dùng yêu cầu.

---

## 9. Bản đồ lát cắt -> thay đổi chính (để Dev nhận việc)

| Lát | Việc kỹ thuật cốt lõi |
|---|---|
| S0 | atlas 10 hàng (chạy bộ test mesher/visual trước), `SAVE_VERSION 2` + `upgradeV1` + `sanitizePlayer`, `exportDelta` RLE, `Game({hunger})`, `persist`/`dormant`, `REPORT`/`FAIL_TEXT` mở rộng, `onChange` lọc khoảng cách (R-21), chuyển helper sang `harness.py` |
| S1 | `hunger.js`, `youOf` (+`food`, `fx`), `actUse` mới, hồi máu theo đói, HUD đói/hiệu ứng, `itemTip`, `playerSave` |
| S2 | block 40-53, `farm.js`, `till/plant/harvest`, `onBlockSet`, `farmTick`, icon cây, tooltip, `content/farming.js` |
| S3 | `animals.js`, `AI.farm`, 3 mô hình, `feed/shear`, cờ snapshot, tooltip thú, lưu `animals` |
| S4 | công thức lò, cửa hàng `truong-lang`, nhiệm vụ, `validate.js`, xuất dữ liệu thiết kế |
| S5 | E2E 2 người, lưu/nạp trọn gói, hiệu năng, README, ACCEPTANCE |
| C0 | `rules.js`, đường ống `hurtPlayer` + trả kết quả, khung `act` mới, `snap.me` |
| C1 | thể lực: `fightTick`, `spendStamina`, `exhausted`, thanh thể lực, chặn sprint client |
| C2 | lăn: `stepPlayer` ghi đè, `actRoll`, bất khả xâm phạm, `LAG_COMP`, camera |
| C3 | windup, `meleeAttack`, `windup` event, sửa bài cũ |
| C4 | `weaponOf`, `actHit` mới, chuỗi kiếm, rìu, chùy (+ choáng), giáo, đòn rơi, 4 vũ khí mới |
| C5 | cung/mũi tên: `actDraw/Shoot`, `spawnArrow`, `updateProjectiles` (R-12, R-13), rơi lại, HUD |
| C6 | khiên: `offhand`, `guardResult`, đỡ hoàn hảo, vỡ khiên, `shield` event, UI ô Tay phụ |
| C7 | tư thế người chơi khác, âm, E2E mạng, README |
| D0 | block 54-61, tile, vật phẩm, `dungeons.js`, `validate.js` |
| D1 | `layoutCells`, `buildDungeon`, `findSite(accept)`, dựng cho thế giới cũ, cấm sinh quái quanh miệng |
| D2 | `actGate`, `actDChest`, `rewardFor`, chìa `bound`, bảng `loot` |
| D3 | P2: đợt, `persist`, `dg`, cờ đã dọn |
| D4 | gai/tên/phun, `trapPhase`, lớp phủ `effects.setTraps`, gỡ bẫy |
| D5 | 6 chủ hầm, `stepArenas` hầm, rương kho báu, công thức, nhiệm vụ, giá |
| D6 | HUD hầm, hướng, E2E 2 người, hiệu năng, README, ACCEPTANCE |
