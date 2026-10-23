# Đặc tả Gói 1 — Sinh tồn & Kinh tế (trồng trọt, nuôi thú, đói, nấu ăn)

Người viết: BA. Trạng thái: bản nháp chờ PM/Leader duyệt. Phạm vi: chỉ Gói 1; Gói 2 (hầm ngục) và Gói 3 (chiến đấu) có đặc tả riêng.

## 1. Hiện trạng (không đề xuất lại)

Đã có, giữ nguyên: máu 20, tự hồi 1 máu/4 giây sau 8 giây không bị đau (`combat.updatePlayers`); ăn bằng chuột phải qua `act {t:'use'}` với vật phẩm có `heal` (thịt 5, thảo dược 8, nấm 3, đùi ếch 4, súp nấm 14, thịt nướng 11); công thức `stew`, `herb_meal`; lò nung nấu `cooked_meat` (thịt + than củi); chế tạo theo trạm (bàn/lò/đe, trong 4 block); xu, cửa hàng 5 quầy, 18 nhiệm vụ; thú hoang hiền (`nai`, `cao-lua`, `tho-pha-le`, `nam-di`, AI `flee`, `passive`); ngày 600 giây (`DAY_LEN`); rương; save v1 (IndexedDB, xuất `.gz`); snapshot theo vùng quan tâm 96 block; `youOf()` gửi trạng thái cá nhân khi `rev` đổi.

Chưa có (gói này làm): đói, đất cày/hạt/cây trồng, thú nuôi/sinh sản/sản phẩm, hiệu ứng thức ăn, cuốc đất, kéo cắt len.

Ràng buộc kỹ thuật cần nhớ: chunk lưu `Uint8Array` nên id block < 256 (hiện dùng 0..39, còn dư chỗ); `world.exportDelta` chỉ lưu id block, không lưu metadata nên mỗi giai đoạn cây là một id block riêng; thực thể (`g.ents`) không nằm trong save nên thú nuôi cần mục lưu riêng; `MOB_CAP` 40 và quái xa mọi người chơi hơn 80 block bị xoá, thú nuôi phải được miễn.

## 2. Mục tiêu người chơi

1. Có lý do để ăn: bỏ đói quá lâu thì yếu đi; ăn no thì hồi máu nhanh. Thức ăn trở thành tài nguyên chứ không chỉ là "bình máu".
2. Dựng được một trang trại nhỏ: cày đất, gieo hạt, tưới bằng nước gần đó, chờ vài phút, thu hoạch, trồng lại.
3. Nuôi được bầy gà, cừu, lợn: dắt về chuồng bằng thức ăn, cho sinh sản, lấy trứng, len, thịt.
4. Nấu ăn ra món tốt hơn nguyên liệu và có hiệu ứng ngắn hạn, đáng mang theo khi đi hầm ngục/đánh boss.
5. Có đường kiếm xu bền vững ngoài đánh quái: bán nông sản và len.
6. Chơi chung: một người trồng, người khác thu hoạch/cho thú ăn; mọi người thấy cùng một trang trại.

## 3. User story

| Mã | Câu chuyện |
|---|---|
| US-1 | Là người chơi, tôi thấy thanh đói và biết khi nào cần ăn để không bị phạt. |
| US-2 | Tôi chạy và đánh nhau thì đói nhanh hơn đứng yên, để việc chuẩn bị đồ ăn có ý nghĩa. |
| US-3 | Tôi ăn đồ khác nhau và thấy chúng no ít/nhiều khác nhau; ăn đồ sống có rủi ro. |
| US-4 | Tôi chế được cuốc đất và cày đất cỏ/đất thành ruộng. |
| US-5 | Tôi lấy được hạt giống (cắt cỏ cao, mua của thương nhân) và gieo lên ruộng. |
| US-6 | Tôi thấy cây lớn qua 4 giai đoạn bằng mắt, biết khi nào chín. |
| US-7 | Tôi đặt ruộng cạnh nước để cây lớn nhanh gấp đôi. |
| US-8 | Tôi thu hoạch cây chín và được hạt để trồng lại; bấm phải thu hoạch xong tự gieo lại. |
| US-9 | Tôi cho thú hoang ăn để thuần hoá; thú đã thuần đi theo khi tôi cầm thức ăn. |
| US-10 | Tôi cho hai con cùng loài ăn để chúng sinh con; con non lớn dần. |
| US-11 | Tôi lấy trứng từ gà, cắt len cừu bằng kéo, giết lợn lấy thịt. |
| US-12 | Tôi nấu món ăn ở lò nung và nhận hiệu ứng (hồi phục, sức mạnh, da dày) hiện trên HUD. |
| US-13 | Tôi bán nông sản/len cho thương nhân lấy xu và mua hạt giống, kéo. |
| US-14 | Là người chơi nhiều người, tôi và bạn thấy cùng cây, cùng thú; khi hai người cùng thu hoạch/cho ăn một đối tượng thì chỉ một lần có hiệu lực. |
| US-15 | Tôi thoát rồi vào lại, nạp lại thế giới: ruộng, cây (đúng giai đoạn), thú nuôi, thanh đói, hiệu ứng vẫn còn. |
| US-16 | Tôi hoàn thành nhiệm vụ "Vụ mùa đầu tiên" để được dẫn dắt qua chuỗi trồng–nấu–bán. |

## 4. Luật chơi

### 4.1 Thanh đói
- `food` từ 0 đến 20, hiển thị 10 biểu tượng (mỗi biểu tượng 2 điểm). Người mới và người nạp từ save v1: 20. Hồi sinh sau khi chết: 14.
- Tích luỹ "mệt": +1 mỗi giây sống; +2 mỗi giây khi chạy nước rút (`p.sprint`); +2 mỗi đòn đánh trúng quái/boss. Đủ 45 thì `food` giảm 1 (đứng yên ≈ 45 giây/điểm, 900 giây từ đầy đến cạn; chạy liên tục ≈ 450 giây).
- Đang gục không giảm đói. Tab host bị tạm dừng (chơi một mình, Esc) không giảm đói.
- Hồi máu theo đói: `food` >= 18 thì hồi 1 máu mỗi 2 giây sau 4 giây không bị đau; 7 đến 17 giữ luật hiện tại (8 giây / 4 giây); <= 6 không tự hồi; = 0 mất 1 máu mỗi 5 giây (sát thương thuần, giáp không giảm) nhưng không xuống dưới 2 máu (không chết vì đói).
- Ngưỡng cảnh báo: toast "Bạn đang đói" khi `food` <= 6 (tối đa 1 lần/60 giây); biểu tượng đói nhấp nháy khi = 0.

### 4.2 Ăn
- Vật phẩm ăn được có thêm trường `food` (điểm đói) song song `heal` (máu tức thì, giữ nguyên giá trị cũ để không phá test hiện có) và tuỳ chọn `fx` (hiệu ứng), `risk` (rủi ro).
- Ăn được khi `food` < 20 hoặc `hp` < maxHp (không còn ăn được khi cả hai đầy). Hồi chiêu ăn 1,0 giây giữa hai lần (host kiểm tra, chống spam).
- Rủi ro "ngộ độc": đồ sống có xác suất `risk.p` gây độc 6 giây, mất 1 máu mỗi 2 giây (tổng 3 máu, sát thương thuần). Host quyết định bằng `g.rng`.
- Bảng giá trị (cột Đói = `food`; Máu = `heal` hiện có hoặc mới):

| Vật phẩm | Đói | Máu | Rủi ro / hiệu ứng |
|---|---|---|---|
| Thịt (`meat`, có sẵn) | 3 | 5 | ngộ độc 25% |
| Thịt lợn (`pork`) | 3 | 4 | ngộ độc 25% |
| Thịt gà (`chicken`) | 2 | 3 | ngộ độc 40% |
| Trứng (`egg`) | 2 | 1 | không |
| Cà rốt (`carrot`) | 3 | 1 | không |
| Khoai tây (`potato`) | 1 | 0 | không |
| Nấm phát sáng, đùi ếch, thảo dược (có sẵn) | 2, 2, 2 | giữ 3, 4, 8 | không |
| Thịt nướng (`cooked_meat`, có sẵn) | 8 | 11 | không |
| Thịt lợn nướng (`cooked_pork`) | 8 | 8 | không |
| Gà nướng (`cooked_chicken`) | 6 | 6 | không |
| Khoai nướng (`baked_potato`) | 5 | 2 | không |
| Bánh mì (`bread`) | 6 | 2 | không |
| Súp nấm (`stew`, có sẵn) | 10 | 14 | không |
| Súp rau (`veg_soup`) | 9 | 3 | Hồi phục 45 giây |
| Thịt hầm (`hearty_stew`) | 12 | 4 | Sức mạnh 120 giây |
| Bánh trứng (`egg_cake`) | 8 | 2 | Da dày 120 giây |

Lúa mì (`wheat`), len (`wool`), hạt giống không ăn được.

### 4.3 Hiệu ứng thức ăn
- Hồi phục: +1 máu mỗi 2 giây trong 45 giây (tối đa 22 máu), không vượt maxHp.
- Sức mạnh: sát thương người chơi gây lên quái/boss x1,25 (làm tròn lên) trong 120 giây.
- Da dày: cộng 3 điểm giáp ảo (tương đương giảm thêm 12% sát thương, vẫn trần 75%) trong 120 giây.
- Mỗi loại hiệu ứng tối đa một cái; ăn lại món cùng hiệu ứng thì đặt thời gian còn lại = max(còn lại, thời lượng mới), không cộng dồn. Hiệu ứng khác loại chạy song song. Chết thì xoá hết hiệu ứng.
- Hiệu ứng đếm theo thời gian game của host, lưu thời gian còn lại trong save người chơi.

### 4.4 Cuốc đất và ruộng
- Dụng cụ mới loại `hoe`: cuốc gỗ, cuốc đá, cuốc sắt (cùng chức năng; khác độ bền không có vì game chưa có độ bền; khác sát thương khi cầm đánh: 1, 2, 3).
- Bấm phải bằng cuốc lên mặt trên của `dirt`, `grass`, `mud` hoặc `moss` có ô phía trên là không khí/cây cỏ thường: đổi thành `farmland` (đất cày). Cây cỏ phía trên bị xoá không rơi đồ. Trong tầm `REACH` 6,5 như đào/đặt.
- `farmland_wet` (đất ướt) khi có block nước trong khối 9x9 ngang (±4) và từ 1 block thấp hơn đến cùng độ cao với đất; ngược lại là `farmland` khô. Host kiểm tra lại mỗi 5 giây (lúc xử lý cây) và khi block nước/ruộng đổi.
- Đất cày không có cây trên đó quá 300 giây (tính khi gần người chơi) tự trở lại `dirt`.
- Block đặt lên đất cày hoặc phá block bên dưới cây làm cây gãy và rơi 1 hạt. Đất cày đào bằng tay/xẻng 0,5 giây, rơi `dirt`. Đặt block (không phải hạt) lên mặt đất cày thì đất cày thành dirt rồi đặt (giữ luật đặt hiện có).
- Tầm mô phỏng: chỉ ruộng và thú trong 64 block quanh ít nhất một người chơi còn sống mới được cập nhật (ngoài tầm: đóng băng, không mất tiến trình).

### 4.5 Cây trồng
- Ba loại, mỗi loại 4 giai đoạn (0 mầm, 1 non, 2 lớn, 3 chín):

| Cây | Hạt gieo | Thời gian đầy đủ (đất khô) | Đất ướt | Thu hoạch khi chín |
|---|---|---|---|---|
| Lúa mì | `wheat_seed` | 360 giây | 180 giây | 1–2 `wheat` + 1–3 `wheat_seed` |
| Cà rốt | `carrot` (củ là hạt) | 300 giây | 150 giây | 2–4 `carrot` |
| Khoai tây | `potato` (củ là hạt) | 420 giây | 210 giây | 2–3 `potato` |

- Chuyển giai đoạn tại 1/3, 2/3 và 100% thời gian đầy đủ (giai đoạn 1 ở 120 giây với lúa mì khô).
- Hệ số vùng: Núi Băng và Vực Pha Lê (lạnh) x0,5 tốc độ; vùng khác x1. Ướt x2. Hai hệ số nhân với nhau (ướt ở vùng lạnh = x1).
- Gieo: bấm phải bằng hạt/củ lên mặt trên đất cày (khô hoặc ướt) có ô phía trên là không khí/cây cỏ thường; trừ 1 vật phẩm. Một ô một cây.
- Thu hoạch: (a) đào/phá cây chín bằng tay → nhận sản lượng bảng trên, ruộng để trống; (b) bấm phải lên cây chín → nhận sản lượng trừ 1 hạt/củ, cây quay về giai đoạn 0 (tự gieo lại). Phá cây chưa chín → chỉ nhận lại 1 hạt/củ, không có sản lượng.
- Lấy hạt: phá `tall_grass` rơi 1 `wheat_seed` với xác suất 12% (hiện cỏ cao không rơi gì); Xác Sống rơi `carrot` hoặc `potato` mỗi loại 8%. Thương nhân bán hạt (mục 6.4).
- Block cây là cây cỏ trang trí (không cản đi, không bị đè như cỏ thường, cần `deco`-tương tự để không bị đặt chồng).
- Không có đột biến, sâu bệnh, giẫm nát ruộng, ánh sáng, mưa trong vòng này.

### 4.6 Thú nuôi
Ba loài thuần được, đều là quái hiền (`passive`), sinh hoang dã ban ngày theo trọng số spawn thấp hơn Nai:

| Loài | Vùng hoang dã | Máu | Tốc độ | Thức ăn nhân giống | Sản phẩm | Rơi khi chết |
|---|---|---|---|---|---|---|
| Gà (`ga`) | Rừng Sương | 4 | 3,0 | `wheat_seed` | 1 `egg` mỗi 150–210 giây (ngẫu nhiên) | `chicken` 1, xu 0–1 |
| Cừu (`cuu`) | Rừng Sương, Núi Băng | 8 | 2,6 | `wheat` | 1–3 `wool`, mọc lại sau 240 giây | `meat` 1–2, `wool` 1 nếu chưa cắt |
| Lợn (`lon`) | Rừng Sương, Đầm Lầy | 10 | 2,8 | `carrot` | không | `pork` 1–3 |

- Thuần hoá: bấm phải bằng đúng thức ăn lên thú hoang trưởng thành trong tầm 3 block: trừ 1 vật phẩm, thú thành "đã thuần" (`tamed`), vào trạng thái "yêu" (`love`) 30 giây, đặt `home` tại vị trí hiện tại. Thức ăn sai: không có tác dụng, không trừ.
- Thú đã thuần: không bỏ chạy, đi theo người chơi gần nhất (trong 8 block) đang cầm đúng thức ăn của loài (tốc độ 0,8 x tốc độ loài, giữ cách 2 block); khi không ai cầm thì lang thang quanh `home` bán kính 10 block (quay về nếu xa hơn). Cho ăn lần nữa khi đã thuần chỉ để nhân giống/đổi `home` sang vị trí hiện tại.
- Quái thù địch (kể cả boss) không nhắm vào thú.
- Sinh sản: hai thú cùng loài, cả hai trưởng thành, cả hai đang "yêu", cách nhau <= 6 block: sau 6 giây sinh 1 con non cạnh chúng, cả hai hết "yêu" và chịu hồi chiêu 240 giây (không nhân giống, vẫn cho sản phẩm). Con non đã thuần sẵn.
- Con non: kích thước 0,5, không cho sản phẩm, lớn thành trưởng thành sau 300 giây; cho ăn đúng thức ăn làm rút ngắn 30 giây (tối thiểu còn 0).
- Gà đẻ trứng chỉ khi đã thuần và đã được cho ăn trong 300 giây gần nhất; trứng rơi dưới đất như vật phẩm rơi (nhặt tự động, tồn tại 180 giây).
- Cắt len: bấm phải bằng `shears` lên cừu trưởng thành có len; cừu "trọc" (`sheared`) 240 giây rồi mọc lại. Cừu non không cắt được.
- Giới hạn: tối đa 24 thú đã thuần mỗi thế giới; đạt trần thì cho ăn nhân giống bị từ chối kèm toast "Chuồng đã đầy (24/24)". Thú đã thuần không tính vào `MOB_CAP` 40, `PER_PLAYER_CAP` 12, và không bị xoá khi xa người chơi (đóng băng nếu ngoài tầm 64 block).
- Đánh thú đã thuần gây sát thương bình thường (không có phạt riêng).

### 4.7 Nấu ăn
- Tất cả ở lò nung (gần lò trong 4 block, luật hiện có); không có thời gian nấu, chế tức thì như công thức lò hiện nay. Nhiên liệu là `charcoal`.
- Công thức (xem bảng dữ liệu 5.3).

## 5. Dữ liệu mới

### 5.1 Block mới (id 40–53, `world/blocks.js`, atlas thêm tile)
`farmland`, `farmland_wet`, `crop_wheat_0..3`, `crop_carrot_0..3`, `crop_potato_0..3`. Đất cày: khối đặc, mặt trên khác (luống), hardness 0,5, công cụ xẻng, rơi `dirt`. Cây: cây cỏ cắt chéo, không đặc, hardness 0,05, rơi theo luật 4.5 (không dùng `drop` tĩnh). Atlas hiện 8x7 ô (49 dùng): thêm tối thiểu 14 tile nên cần tăng `ATLAS_ROWS` lên 9. Tile tự vẽ bằng code theo phong cách `render/atlas.js`.

### 5.2 Vật phẩm mới (`content/items.js`)
- Dụng cụ: `wood_hoe`, `stone_hoe`, `iron_hoe` (loại `hoe`), `shears` (kéo).
- Hạt/nông sản: `wheat_seed`, `wheat`, `carrot`, `potato`.
- Sản phẩm thú: `egg`, `wool`, `pork`, `chicken`.
- Nấu: `bread`, `baked_potato`, `cooked_pork`, `cooked_chicken`, `veg_soup`, `hearty_stew`, `egg_cake`.
- Trường mới: `food`, `fx: { id, secs }`, `risk: { poison: p }`, `plant: 'wheat'|'carrot'|'potato'` (hạt đặt được), `feed: ['ga',...]` suy ra từ bảng loài.
- Mỗi vật phẩm cần icon vẽ bằng code trong `ui/icons.js`.

### 5.3 Công thức mới (`content/recipes.js`)
| Công thức | Nguyên liệu | Trạm |
|---|---|---|
| `wood_hoe` | 2 ván, 2 gậy | bàn |
| `stone_hoe` | 2 đá, 2 gậy | bàn |
| `iron_hoe` | 2 thỏi sắt, 2 gậy | đe |
| `shears` | 2 thỏi sắt | đe |
| `bread` | 3 lúa mì, 1 than củi | lò |
| `baked_potato` | 1 khoai tây, 1 than củi | lò |
| `cooked_pork` | 1 thịt lợn, 1 than củi | lò |
| `cooked_chicken` | 1 thịt gà, 1 than củi | lò |
| `veg_soup` | 2 cà rốt, 1 khoai tây, 1 thảo dược | lò |
| `hearty_stew` | 1 thịt lợn, 1 khoai tây, 1 cà rốt, 1 than củi | lò |
| `egg_cake` | 2 trứng, 2 lúa mì, 1 than củi | lò |
| `bed_wool` (thêm đường chế giường) | 3 ván, 3 len | bàn |

### 5.4 Quái/thú mới (`content/mobs.js`)
`ga`, `cuu`, `lon` (số liệu 4.6). Thêm kiểu AI `farm` (lang thang quanh `home`, theo người cầm thức ăn, không bỏ chạy) vào `AI_KINDS` của trình kiểm tra nội dung. Thú hoang dùng AI `flee` như Nai cho tới khi thuần. Trường mới trên định nghĩa: `breed`, `product`, `adultSecs: 300`. Mô hình hộp có xương (`render/models`), mỗi loài một mô hình + bản non (thu nhỏ 0,5), xem được ở `models.html`. Cần âm thanh kêu riêng (tổng hợp bằng code) và tiếng ăn, tiếng gieo, tiếng thu hoạch.

### 5.5 Cửa hàng và nhiệm vụ
- Mua: hạt lúa mì 4 xu, cà rốt 5 xu, khoai tây 5 xu, kéo 25 xu, cuốc đá 20 xu. Thêm vào `thuong-nhan` và `ngu-dan`.
- Bán (giá thương nhân mua): lúa mì 3, cà rốt 2, khoai tây 2, trứng 3, len 6, bánh mì 8, thịt lợn nướng 9.
- Nhiệm vụ "Vụ mùa đầu tiên" (NPC ở làng Rừng Sương, dùng NPC hiện có hoặc thêm 1): bước 1 sở hữu 1 cuốc đất (`collect`), bước 2 thu 6 `wheat` (`collect`), bước 3 chế 1 `bread` (`collect`); thưởng 30 xu + 2 `veg_soup` (vật phẩm này có công thức nên qua được trình kiểm tra nguồn).

## 6. Đa người chơi và lưu trữ

### 6.1 Đa người chơi (host quyết định tất cả)
- Mọi tiến trình (đói, mệt, hiệu ứng, lớn cây, đẻ trứng, nhân giống, tuổi thú) tính ở host trong `Game.tick`; máy khách chỉ gửi hành động và hiển thị.
- Hành động mới (thêm vào danh sách `REPORT` của `net/host.js` để báo lý do thất bại qua sự kiện `fail`): `till` {x,y,z} cuốc đất, `plant` {x,y,z} gieo, `harvest` {x,y,z} thu hoạch bấm phải, `feed` {id} cho thú ăn, `shear` {id} cắt len. Đường đào cây dùng lại `dig`/`break`. Ăn dùng lại `use`. Host kiểm tra tầm với, vật cầm, trạng thái hiện tại; hành động đến sau khi trạng thái đã đổi (cây đã bị người khác thu hoạch, thú đã được cho ăn) trả `ok:false` mà không trừ vật phẩm.
- Giai đoạn cây truyền qua sự kiện `block` hiện có và `delta` trong gói chào của người vào muộn (vì mỗi giai đoạn là một id block). Hẹn giờ lớn nằm ở host, không gửi cho khách.
- `youOf()` thêm `food` và `fx` (danh sách `{id, left}` làm tròn giây) để HUD; chỉ đẩy khi `food` đổi nguyên điểm hoặc hiệu ứng thêm/mất (không `touch` mỗi tick). Cột thời gian còn lại của hiệu ứng được khách tự đếm lùi giữa các lần đẩy.
- Snapshot thú: thêm cờ nhỏ trên thực thể `mob`: `tm` đã thuần, `lv` đang yêu, `ba` non, `sh` đã cắt len. Dung lượng thêm <= 4 trường/thú; thú nuôi nằm trong vùng quan tâm 96 block như thực thể thường.
- Giới hạn tần suất hành động hiện có (40 hành động/giây/người) giữ nguyên, không thêm kênh mạng mới.
- Người chơi thoát giữa lúc hiệu ứng/đói: trạng thái giữ trong `savedPlayers`; đói và hiệu ứng không chạy khi người đó offline.

### 6.2 Lưu trữ
- `SAVE_VERSION` lên 2. `checkVersion` nâng cấp save v1: người chơi thiếu `food` → 20, `fx` → rỗng; thiếu `crops`, `animals` → rỗng. Save v2 không mở được bởi bản v1 (theo luật `newer-version` hiện có).
- Thêm vào `toSave()`: `crops`: map `'x,y,z'` → `{ k: loại, g: giây tích luỹ, s: stage }`; `farm`: map `'x,y,z'` → giây không có cây (để tự về dirt); `animals`: mảng `{ type, x, y, z, hp, tamed, age (giây tuổi), love, breedCd, prodCd, sheared, home }` (chỉ thú đã thuần; thú hoang không lưu như hiện nay). Người chơi: `food`, `fatigue`, `fx`, `poison`.
- Kích thước: trần 24 thú + số cây (không giới hạn cứng, ước tính vài trăm) không làm save tăng đáng kể (< 100 KB cho 1000 cây).
- Nạp save: cây có trong `crops` mà block tương ứng đã không còn (phá lúc offline) thì bỏ mục; block cây không có mục `crops` (save hỏng) thì tạo mục với tiến trình đúng giai đoạn đó.

## 7. Giao diện

- HUD: thanh đói dưới thanh máu (biểu tượng đùi gà vẽ bằng code, 10 biểu tượng, nửa điểm hiển thị nửa biểu tượng; đỏ nhấp nháy khi 0). Hàng biểu tượng hiệu ứng (icon + số giây còn lại) cạnh thanh đói; hiệu ứng ngộ độc có biểu tượng riêng (xanh lá).
- Con trỏ/tooltip: ngắm vào cây hiện "Lúa mì · giai đoạn 2/4 · đất ướt"; ngắm vào thú hiện tên, "đã thuần", biểu tượng trái tim khi đang yêu, "non" nếu non, "đã cắt len". Ngắm vào ruộng với cuốc/hạt cầm trên tay hiện gợi ý "Bấm phải để cày/gieo".
- Kho đồ: tooltip vật phẩm ăn được ghi "Đói +N · Máu +M · Hiệu ứng ...". Nhóm công thức "Lò nung" đã có sẵn nên món mới tự vào đó; công thức hiện đã có cơ chế báo đủ nguyên liệu.
- Bấm phải: giữ cơ chế hiện có (`useItem`): thứ tự ưu tiên NPC → thú (cho ăn/cắt len) → block dùng được (cửa/rương/giường) → cây chín (thu hoạch) → cuốc lên đất → hạt lên đất cày → đặt block → ăn.
- Toast tiếng Việt cho: đói, ngộ độc, chuồng đầy, "Hạt cần đặt lên đất cày", "Cây chưa chín".
- Icon vẽ bằng code cho toàn bộ vật phẩm mới (mục 5.2), block mới (qua atlas), biểu tượng đói/hiệu ứng. Mô hình quái mới xem được ở `models.html`.
- Bảng Game Design Dashboard (`tools/export_design_data.py`) phải xuất được vật phẩm/quái mới không lỗi.

## 8. Tiêu chí nghiệm thu (mỗi mục kiểm thử tự động được)

Kiểm thử logic chạy trực tiếp `Game` trong trình duyệt headless như `tests/test_game.py` hiện nay (tắt spawn, giả lập thời gian bằng `g.tick(dt)`).

| Mã | Tiêu chí đo được | Test đề xuất |
|---|---|---|
| AC-1 | Người mới có `food` = 20. Đứng yên 900 giây game (tick 0,05 s) thì `food` = 0 ±1; chạy nước rút liên tục 450 giây cũng về 0 ±1. | `test_hunger_drain` |
| AC-2 | Mỗi đòn trúng quái cộng 2 vào mệt: 23 đòn (46) làm `food` giảm đúng thêm 1 so với nhóm đối chứng không đánh. Host tạm dừng không giảm `food`. | `test_hunger_exertion` |
| AC-3 | Với `hp` = 10: `food` 20 hồi 1 máu mỗi 2 giây sau 4 giây yên (đo 10 giây ≥ 3 máu); `food` 10 theo luật cũ (10 giây sau 8 giây yên: đúng 0–1 máu); `food` 6 không hồi trong 60 giây; `food` 0 mất 1 máu/5 giây, giáp không giảm, dừng ở hp = 2. | `test_hunger_regen_starve` |
| AC-4 | Ăn mỗi món trong bảng 4.2 cộng đúng `food` (kẹp tại 20) và `heal`; ăn lần 2 trong 1,0 giây bị từ chối `cooldown`; `food` 20 và `hp` đầy thì từ chối `full` mà không trừ vật phẩm. | `test_eat_table` |
| AC-5 | Với rng cố định: 1000 lần ăn `meat` sống cho tỉ lệ ngộ độc 25% ±4%; ngộ độc gây đúng 3 sát thương thuần trong 6 giây, không xuyên giáp giảm. | `test_eat_poison` |
| AC-6 | Ba hiệu ứng: Hồi phục hồi tổng 22 ±1 máu/45 giây; Sức mạnh làm kiếm sắt (6) gây 8 sát thương; Da dày làm quái gây 4 sát thương chỉ còn đúng giá trị theo giáp +3; ăn lại cùng hiệu ứng không cộng dồn; chết xoá hết. | `test_food_effects` |
| AC-7 | Cuốc đất: bấm phải bằng `wood_hoe` lên `grass`/`dirt`/`mud`/`moss` có không khí phía trên tạo `farmland`; lên `stone`, hoặc ô phía trên đặc, hoặc ngoài tầm, hoặc không cầm cuốc thì bị từ chối. Cuốc ba bậc đều chế được đúng công thức. | `test_till` |
| AC-8 | `farmland_wet` khi có nước trong ±4 ngang và 0..−1 dọc, `farmland` khi không; đặt/phá nước đổi trạng thái trong ≤ 5 giây game. | `test_farmland_wetness` |
| AC-9 | Đất cày trống 300 giây (người chơi ở gần) trở về `dirt`; có cây thì không. | `test_farmland_revert` |
| AC-10 | Lúa mì đất khô: block đổi sang stage 1, 2, 3 tại 120 ±5, 240 ±5, 360 ±5 giây; đất ướt tại một nửa mốc đó; cà rốt/khoai theo bảng 4.5; Núi Băng khô x0,5 (720 giây cho lúa mì). | `test_crop_growth` |
| AC-11 | Cây ngoài 64 block quanh mọi người chơi không lớn (giữ nguyên stage sau 1000 giây); khi người chơi đến gần thì tiếp tục từ tiến trình cũ. | `test_crop_chunk_sim` |
| AC-12 | Gieo: hạt lên đất cày hợp lệ tạo `crop_*_0`, trừ 1 vật phẩm; lên đất thường/ô có cây/ngoài tầm bị từ chối không trừ. Phá block dưới cây làm cây biến mất, rơi 1 hạt. | `test_plant_rules` |
| AC-13 | Thu hoạch bằng đào: cây chín cho sản lượng nằm trong khoảng ở bảng 4.5 (kiểm 200 mẫu, min và max đúng); cây chưa chín chỉ trả 1 hạt/củ. Bấm phải: nhận sản lượng trừ 1 và block về stage 0. Hai người cùng bấm một cây trong cùng tick: chỉ một người nhận. | `test_harvest` |
| AC-14 | Phá `tall_grass` 2000 lần rơi `wheat_seed` 12% ±2%; Xác Sống chết 2000 lần rơi `carrot` 8% ±2% và `potato` 8% ±2%. | `test_seed_sources` |
| AC-15 | Thuần hoá: thức ăn đúng làm thú hoang thành `tamed`, `love` = 30 giây, trừ 1 vật phẩm; thức ăn sai không đổi gì; ngoài 3 block bị từ chối. Thú đã thuần không bỏ chạy khi người chơi đến sát, và sau 20 giây không đứng xa `home` quá 10 block. | `test_animal_tame_ai` |
| AC-16 | Theo người: người cầm đúng thức ăn đứng cách 6 block, thú đã thuần tiến lại còn ≤ 3 block sau 10 giây; đổi sang vật khác thì thôi theo. | `test_animal_follow` |
| AC-17 | Nhân giống: hai thú cùng loài, cùng yêu, ≤ 6 block sinh đúng 1 con non sau 6 ±1 giây, cả hai hết yêu, hồi chiêu 240 giây (cho ăn lại trong thời gian đó bị từ chối); con non 0,5 kích thước, thành trưởng thành sau 300 ±5 giây, cho ăn giảm 30 giây. | `test_animal_breed_grow` |
| AC-18 | Sản phẩm: gà thuần được cho ăn đẻ 1 trứng trong khoảng 150–210 giây (kiểm 20 mẫu); gà không được cho ăn 300 giây thì ngừng đẻ; kéo cắt cừu cho 1–3 len, cừu trọc không cắt được, mọc lại sau 240 ±5 giây; cắt tay không / cừu non bị từ chối; lợn chết rơi 1–3 thịt lợn. | `test_animal_products` |
| AC-19 | Trần: sau khi có 24 thú đã thuần, cho ăn nhân giống bị từ chối và không trừ vật phẩm; 24 thú không bị tính vào `MOB_CAP`/`PER_PLAYER_CAP` (spawn quái hoang vẫn tới 40) và không bị xoá khi người chơi đi xa 200 block rồi quay lại. | `test_animal_caps` |
| AC-20 | Công thức mới (5.3) chế được ở đúng trạm với đúng nguyên liệu, bị từ chối ngoài trạm; mọi vật phẩm mới đều có nguồn (qua trình kiểm tra nội dung) và có icon (kiểm bằng cách vẽ icon, ảnh không trống). | `test_cooking_recipes`, cập nhật `test_content_valid` |
| AC-21 | Cửa hàng: mua và bán đúng giá bảng 5.5 (số dư xu đúng); nhiệm vụ "Vụ mùa đầu tiên" hoàn thành được từ đầu đến cuối bằng hành động thật và trả thưởng. | `test_farm_shop_quest` |
| AC-22 | Lưu/nạp: sau `toSave` rồi `fromSave` — mọi cây đúng loại, giai đoạn và tiến trình (tiếp tục lớn đúng mốc), ruộng, thú đã thuần với tuổi, `love`, hồi chiêu, cờ cắt len, `food`, `fatigue`, hiệu ứng, ngộ độc còn nguyên. Save v1 cũ nạp được (food 20, không lỗi). Xuất rồi nhập file `.gz` giữ nguyên. | `test_survival_save_load` |
| AC-23 | Hai trình duyệt (transport bộ nhớ): người A cuốc, gieo, người B thấy cây ở mọi giai đoạn khi đến gần; người B vào muộn nhận đúng giai đoạn; B cho gà ăn, A thấy `tm`/`lv` trên snapshot; hai người cùng cho một thú ăn một lần chỉ một người bị trừ vật phẩm; `you.food` của từng người độc lập. | `test_e2e_survival_two_players` |
| AC-24 | HUD: thanh đói đúng số biểu tượng theo `food` (kiểm DOM tại 20, 7, 1, 0); biểu tượng hiệu ứng hiện đúng tên và số giây; tooltip cây/thú đúng nội dung; ảnh chụp màn hình có ruộng đủ 4 giai đoạn không trống và có ≥ 3 màu khác nhau ở vùng cây. Không lỗi console. | `test_survival_ui` |
| AC-25 | Hiệu năng: tick với 24 thú nuôi + 40 quái + 500 cây trong tầm mô phỏng vẫn trong ngân sách bài `test_perf_*` hiện có (giữ nguyên ngưỡng); dựng mesh chunk có 500 cây không vượt ngưỡng chunk hiện tại. | `test_perf_survival` |
| AC-26 | Hồi quy: `tests/test_game.py` (106 bài hiện có, cập nhật tối thiểu bài ăn `test_combat_player_death_respawn_regen_and_food` nếu cần) và `tests/test_net.py` (21 bài) vẫn xanh; thêm tuỳ chọn `hunger:false` cho `Game` để các bài cũ không bị đói chen vào. | toàn bộ `tests/` |

## 9. Không làm trong vòng này

- Bình nước/xô, sữa, phô mai, mật ong, ong, cá câu, câu cá.
- Độ bền dụng cụ, phân bón/bột xương, cây ăn quả, cây leo, giẫm nát ruộng, sâu bệnh, héo úa, mưa/tưới, ánh sáng ảnh hưởng cây.
- Ngựa/cưỡi, thú cưng chiến đấu, thú bị quái tấn công, thú ngủ đêm, chuồng tự động/hàng rào đặc biệt (chuồng do người chơi tự xây bằng block hiện có).
- Khát nước, nhiệt độ cơ thể, bệnh tật, ngủ để qua đêm (giường chỉ đặt điểm hồi sinh như hiện nay).
- Đổi tên/đánh dấu thú, nhãn thú, bán thú cho NPC.
- Máy móc tự động (máy gặt, phễu), nấu ăn có thời gian chờ hay bếp lửa ngoài trời, công thức hình dạng.
- Cân bằng lại toàn bộ kinh tế xu của các quầy ngoài các dòng nêu ở 5.5.
- Gói 2 (hầm ngục) và Gói 3 (thể lực, né, cung, khiên); chỉ chừa chỗ: thể lực của Gói 3 sẽ dùng chung `food` (ví dụ ngưỡng chạy), nhưng vòng này không đụng.

## 10. Câu hỏi mở cho PM/Leader

1. `heal` cũ của `cooked_meat` 11 và `stew` 14 vẫn mạnh sau khi có đói; giữ nguyên (đề xuất, để không phá test) hay giảm sau khi chơi thử?
2. NPC ra nhiệm vụ "Vụ mùa đầu tiên": dùng NPC hiện có ở làng Rừng Sương hay thêm NPC nông dân mới?
3. Có cần nút/phím riêng để "gọi" thú theo (hiện chỉ theo khi cầm thức ăn)?
4. Trần 24 thú nuôi và 64 block tầm mô phỏng có hợp với máy host yếu không? Cần đo ở AC-25 trước khi chốt.
5. Id block mới 40–53 phải xếp sau 39 để không đổi id block cũ (save cũ vẫn đúng); cần Leader xác nhận cách đánh số và việc mở rộng atlas.
