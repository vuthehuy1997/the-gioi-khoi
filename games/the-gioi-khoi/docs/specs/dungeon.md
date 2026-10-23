# Gói 2: Hầm ngục có chủ đề

Đặc tả của BA. Trạng thái: chờ Leader duyệt. Chưa có code. Số liệu ở đây là điểm khởi đầu để cân bằng, Dev có quyền đổi nếu AC vẫn đo được.

## 1. Hiện trạng (đã có, KHÔNG làm lại)

- `sim/structures.js` dựng một lần khi tạo thế giới bằng delta, vị trí lưu ở `g.flags.sites`. Thế giới cũ chỉ dựng phần còn thiếu. Hàm `findSite` (điểm phẳng trong vùng, cách điểm khác `minGap`) và `flatten` dùng lại được.
- Boss: `content/bosses.js` + `sim/boss.js` (nhiều pha, chiêu melee/leap/summon/volley/slam, co giãn `SCALE_HP` 0.6 và `SCALE_DMG` 0.15 mỗi người, `stepArenas` kích hoạt khi bước vào, reset sau 5 giây không còn ai, cờ `boss:<id>`). Quest loại "hạ boss" chạy theo cờ này.
- Rương người chơi đặt: `g.chests`, 27 ô, lưu theo save, phá thì đồ rơi (`CHEST_SLOTS`, `actChestOpen/Move`). Cửa gỗ (`DOOR`/`DOOR_OPEN`), đuốc chỉ đuổi quái.
- Quái 18 loại, `tuong-da` (Tượng Đá Canh Gác, AI `guard`, `regions: []`) đang chưa được dùng ở đâu. Quái bị xoá khi không có người trong 80 block (trừ `guard`). Thực thể không lưu.
- Mũi tên: `shoot` + `proj` style `arrow` (Xương Cung Thủ). `hurtPlayer` đã tính giáp. Thế giới cao 64, mực nước 20, atlas 8x7 = 56 ô, đã dùng 49.
- Hành động mạng đi qua `act()` của host, thế giới đồng bộ bằng delta block, `snapshot.js` chỉ cho người chơi và thực thể.

## 2. Mục tiêu người chơi

Sau khi hạ boss vùng, người chơi có lý do đi tìm một công trình bí ẩn trong vùng, vượt phòng quái, vượt bẫy, tìm chìa, mở cổng, hạ chủ hầm và mang về đồ không kiếm được ở nơi khác (Mảnh Cổ Vật, bình hồi máu, vũ khí/cuốc cổ vật). Chơi một mình được; chơi 2-5 người thì chia nhau gỡ bẫy, đánh quái và ai cũng nhận phần thưởng riêng, không tranh nhau rương.

## 3. User story

| Mã | Câu chuyện |
|---|---|
| US-1 | Là người chơi, tôi thấy miệng hầm lộ thiên trong vùng và có gợi ý hướng khi đến gần, để tìm được hầm mà không cần đoán. |
| US-2 | Là người chơi, tôi đi xuống hầm bằng cầu thang và thấy phòng, tường, màu sắc theo chủ đề vùng. |
| US-3 | Là người chơi, vào phòng canh gác thì quái xuất hiện theo đợt; dọn sạch thì mở được rương chiến thắng. |
| US-4 | Là người chơi, trong rương chiến thắng tôi nhận Chìa Hầm để mở cổng sắt sang phòng bẫy. |
| US-5 | Là người chơi, tôi qua phòng bẫy bằng cách quan sát nhịp bẫy, rón rén qua tấm áp lực hoặc phá bẫy bằng cuốc. |
| US-6 | Là người chơi, cuối phòng bẫy có rương chứa Chìa Chủ Hầm cộng đồ thưởng. |
| US-7 | Là người chơi, mở cổng chủ bằng Chìa Chủ Hầm để vào phòng chủ hầm và đánh boss nhiều pha. |
| US-8 | Là người chơi, hạ chủ hầm thì một rương kho báu xuất hiện giữa phòng, tôi mở lấy phần thưởng. |
| US-9 | Là thành viên nhóm, mỗi người nhận phần thưởng riêng của từng rương một lần, không bị người khác lấy mất. |
| US-10 | Là thành viên nhóm, cổng một người mở thì mọi người đi qua được; bẫy và quái hiện giống nhau với mọi người. |
| US-11 | Là người chơi, tiến độ hầm (cổng đã mở, phòng đã dọn, rương đã nhận, boss đã hạ) còn nguyên sau khi lưu và nạp. |
| US-12 | Là người chơi, tôi thấy tên hầm, phòng hiện tại, số quái còn, số chìa đang có trên màn hình. |
| US-13 | Là người chơi, tôi đổi Mảnh Cổ Vật lấy cuốc và kiếm cổ vật ở đe rèn, hoặc bán lấy xu. |
| US-14 | Là người chơi, tôi nhận nhiệm vụ "dọn hầm" từ NPC và hoàn thành khi chủ hầm chết. |
| US-15 | Là người chơi có thế giới cũ, hầm được thêm vào mà không đè lên công trình của tôi. |

## 4. Luật chơi

### 4.1 Sáu hầm, mỗi vùng một hầm
Thêm `content/dungeons.js` (dữ liệu thuần, kiểm bằng `validate.js`). Mỗi hầm dùng chung một khuôn bố cục, khác nhau ở chủ đề.

| id | Tên | Vùng | Quái phòng canh | Bẫy chủ đạo | Vật liệu thưởng chủ đề |
|---|---|---|---|---|---|
| ham-re-muc | Hầm Rễ Mục | rung-suong | xac-song, soi-xam, xuong-cung | tên, gai | herb, bone |
| ham-cat-chon | Hầm Cát Chôn | sa-mac-lua | bo-cap, xuong-cung | gai, phun | chitin, venom |
| ham-bang-gia | Hầm Băng Giá | nui-bang | gau-bang, ma-bang | phun, tên | shard, pelt |
| ham-bun-lay | Hầm Bùn Lầy | dam-lay | ech-doc, ran-lay, ca-sau | gai, phun | scale, frog_leg |
| ham-tro-tan | Hầm Tro Tàn | hoa-son | than-lan-nham, linh-hoa | phun, tên | ember |
| ham-lang-kinh | Hầm Lăng Kính | vuc-pha-le | nhen-pha-le, ma-bang, khoi-pha-le | tên, phun | amethyst, silk |

Mỗi hầm xuất hiện đúng 1 lần trên bản đồ, nằm trong vùng của nó, cách mọi công trình khác (làng, đấu trường, hầm khác) tối thiểu 90 block, địa hình đủ phẳng như `findSite`. Không gate theo cờ boss; vùng nào vào được thì hầm vùng đó vào được.

### 4.2 Bố cục (chung cho 6 hầm)
Đi theo một chuỗi, hướng +X từ chân cầu thang:

1. **Miệng hầm** trên mặt đất: nền 7x7 và 2 cột đuốc, nhận biết từ xa.
2. **Cầu thang**: rộng 3, mỗi bậc cao 1 block, dài 2 block/bậc, xuống 12 bậc. Sàn hầm ở y = độ cao mặt đất tại miệng hầm - 12, tối thiểu y = 6.
3. **P1 Sảnh** (11x11, cao 5): 4 đuốc, 1 rương tiếp tế.
4. **P2 Phòng canh gác** (11x11, cao 6): quái theo đợt, rương chiến thắng ở giữa (khoá cho đến khi dọn xong).
5. **Cổng sắt** (3x3) cần Chìa Hầm.
6. **P3 Phòng bẫy** (11x17, cao 5): 3 chặng bẫy, rương chìa ở cuối.
7. **Cổng chủ** (3x3) cần Chìa Chủ Hầm.
8. **P4 Phòng chủ** (bán kính trong 9, cao 8): chủ hầm, 4 cột.

Hành lang nối 3x3, dài 6. Tổng kích thước tối đa 80 x 25 x 12 block. Mọi tường, sàn viền, trần là **Gạch Hầm**, không đào được và không có đường vòng: đào từ mặt đất xuống cũng không phá được trần. Sàn và cột dùng block có sẵn theo chủ đề (rêu/gạch, cát/đá, băng, bùn, bazan, thạch anh tím). Hầm là hầm tối; không làm hệ ánh sáng thật (xem mục 9).

### 4.3 Phòng canh gác (P2)
- Kích hoạt khi có người sống bước vào cách tâm phòng <= 5 block.
- Đợt 1: 4 quái thường. Đợt 2 (khi đợt 1 chết hết, chờ 2 giây): 3 quái thường + 1 `tuong-da` (50 máu, 7 sát thương). Quái lấy từ danh sách của hầm, chọn ngẫu nhiên có seed.
- Mỗi người thêm trong phòng (tối đa 5) cộng thêm 1 quái thường mỗi đợt (tối đa +4).
- Quái sinh tại 8 điểm cố định, không được tự biến mất. Nếu không còn người sống trong phạm vi 30 block thì đợt hiện tại bị xoá và phòng quay về chưa dọn (rồi kích hoạt lại từ đợt 1).
- Dọn xong đợt 2: đặt cờ phòng "đã dọn", rương chiến thắng mở. Cờ lưu vĩnh viễn; phòng đã dọn không sinh quái lại.
- Quái hầm không rơi gì ngoài bảng rơi vốn có của quái đó (đã tính xu); chìa chỉ ra từ rương.
- Quái tự nhiên không được sinh trong khối bao của hầm (kể cả miệng hầm bán kính 6).

### 4.4 Bẫy (P3)
Phòng bẫy có 3 chặng nối tiếp, mỗi chặng một loại. Nhịp bẫy tính từ `g.time` của host (không cần đồng bộ trạng thái, client vẽ theo cùng thời gian snapshot).

| Bẫy | Block | Nhịp / kích hoạt | Sát thương |
|---|---|---|---|
| Gai sàn | `SPIKES` | Chu kỳ 4,0 giây: 1,5 s hạ (an toàn), 0,5 s báo hiệu (gai rung), 2,0 s nhô lên. Chặng 1: 2 hàng, mỗi hàng 3 rộng x 2 dài, hai hàng lệch pha 2 s. | 4 mỗi lần chạm, tối thiểu 0,8 s giữa hai lần với cùng một người; qua giáp. Đứng yên 2 s trên gai nhô = 3 lần = 12. |
| Tên bắn | `PLATE` + `DART_TRAP` | Giẫm tấm áp lực thì 2 ống bắn tên trên tường chạm cùng lúc sau 0,3 s. Tấm hồi sau 5 s. **Rón rén (giữ C) thì không kích hoạt.** Chặng 2: 3 tấm, 4 ống. | 5 mỗi mũi tên (tốc độ 14, style `arrow`), qua giáp. |
| Phun theo chủ đề | `VENT` | Chu kỳ 5,0 giây: 3,2 s nghỉ, 1,0 s báo hiệu (ống sáng), 0,8 s phun. Vùng cầu bán kính 1,6 block. Chặng 3: 2 ống. | 6 mỗi lần phun (một lần mỗi người mỗi đợt phun), hất lên vy = 5. |

- Mỗi hầm xếp chặng theo cột "Bẫy chủ đạo" (chủ đạo chiếm 2 chặng; hầm còn lại 1 chặng). Số bẫy tổng giữ như trên.
- **Gỡ bẫy**: `PLATE`, `DART_TRAP`, `VENT` phá được bằng cuốc bậc >= 1, độ cứng 2 giây; phá xong bẫy hết hiệu lực vĩnh viễn (delta lưu). Gai đặt block đè lên được (chỉ khi gai đang hạ); đè xong gai biến mất vĩnh viễn.
- Hầm không làm chết người ngoài ý muốn: tổng sát thương một lượt chạy vội, không nhìn nhịp (3 hàng gai 2 lần + 4 tên + 2 phun) có thể tới 24, lớn hơn máu tối đa 20; chạy cẩn thận hoặc rón rén thì 0.
- Bẫy không gây sát thương cho quái; bẫy chỉ ảnh hưởng người chơi sống.

### 4.5 Chìa và cổng
- `dungeon_key` (Chìa Hầm) mở cổng sắt. `boss_key` (Chìa Chủ Hầm) mở cổng chủ. Mỗi chìa dùng 1 lần, xếp chồng tối đa 8, thả/ném được.
- Giao tiếp: bấm phải vào block cổng trong tầm `REACH` 6,5. Có chìa đúng loại ở bất kỳ ô nào: trừ 1 chìa, cả cụm cổng 3x3 biến mất (chuyển thành AIR qua delta), có âm thanh. Không có chìa: thông báo "Cần Chìa Hầm" / "Cần Chìa Chủ Hầm", không đổi gì.
- Cổng không đào được, không phá được. Cổng đã mở vĩnh viễn mở cho mọi người.
- Chìa chỉ lấy từ rương hầm (xem 4.6), mỗi người một chìa mỗi loại mỗi hầm. Nếu một người làm mất chìa, người khác trong nhóm đã có chìa mở cổng hộ là đủ.

### 4.6 Rương thưởng (chia riêng từng người)
Block `DCHEST` (Rương Hầm), không phá được, không đặt được. Bấm phải để mở:
- Lần đầu mỗi người: sinh phần thưởng riêng theo bảng bên dưới, bỏ thẳng vào kho; phần không vừa rơi dưới chân. Ghi `claimed` (uid) vào `g.flags.dungeons[id].claimed[rương]`. Lần sau mở: thông báo "Đã nhận".
- Phần thưởng tất định theo hash (seed thế giới, id hầm, rương, uid), để kiểm thử được.
- Điều kiện mở: rương tiếp tế và rương chìa mở ngay; rương chiến thắng mở khi P2 đã dọn; rương kho báu xuất hiện khi chủ hầm chết.

| Rương | Vị trí | Phần thưởng (mỗi dòng: vật phẩm, số lượng, xác suất) |
|---|---|---|
| Tiếp tế | P1 | `xu` 10-25 (1,0); `heal_potion` 1-2 (0,6); `torch` 4-8 (0,8); `charcoal` 2-4 (0,5) |
| Chiến thắng | P2 | `dungeon_key` 1 (1,0, cố định); `xu` 20-40 (1,0); vật liệu chủ đề 2-4 (0,7); `heal_potion` 1 (0,5) |
| Bẫy | cuối P3 | `boss_key` 1 (1,0, cố định); `xu` 30-60 (1,0); `iron_ingot` 2-4 (0,8); `crystal` 1-3 (0,6); `ancient_shard` 1-2 (0,7); vật liệu chủ đề 2-4 (0,7) |
| Kho báu | giữa P4 sau boss | `xu` 120-200 (1,0); `gem` 2-4 (1,0); `ancient_shard` 3-5 (1,0); `heal_potion` 2-3 (1,0); `iron_ingot` 3-5 (0,7); một món giáp ngẫu nhiên của bộ vùng (0,25) |

### 4.7 Chủ hầm
Dùng nguyên engine boss hiện có; thêm 6 mục vào `content/bosses.js` với `region` đúng vùng và cờ `boss:<id>` (cờ này làm quest "hạ boss" chạy được). Đấu trường là P4, vào là kích hoạt, rời hết 5 giây thì reset, co giãn theo số người như boss thường. Cổng chủ đã mở thì không khoá lại. Chủ hầm chỉ xuất hiện 1 lần (cờ boss đặt rồi thì không sinh nữa); `unlocks: null`.

Khuôn pha chung: pha 0 từ 1,0; pha 1 từ 0,55; pha 2 từ 0,25. Hệ số `speedMul` / `dmgMul`: 1/1, 1,1/1, 1,3/1,3. Chiêu pha 0: cận chiến + chiêu riêng; pha 1 thêm slam; pha 2 thêm gọi quái (mỗi chiêu theo kiểu có sẵn: melee, leap, volley, slam, summon).

| id (bosses) | Tên | Máu | Cận chiến | Chiêu riêng | Slam | Gọi quái |
|---|---|---|---|---|---|---|
| ham-chu-re-muc | Lão Mộ Vương | 260 | 5 | leap 7 | 8, r4 | xac-song x2 |
| ham-chu-cat-chon | Xác Ướp Chúa | 340 | 6 | volley venom 3 x5 | 8, r4,5 | bo-cap x2 |
| ham-chu-bang-gia | Tù Trưởng Băng Cổ | 420 | 7 | volley ice 4 x5 | 10, r5 | ma-bang x2 |
| ham-chu-bun-lay | Thủy Quái Cổ | 380 | 7 | leap 8 | 9, r5 | ech-doc x3 |
| ham-chu-tro-tan | Pháp Sư Tro | 480 | 8 | volley fire 5 x5 | 11, r5,5 | linh-hoa x2 |
| ham-chu-lang-kinh | Linh Hồn Lăng Kính | 560 | 9 | volley ice 5 x7 | 12, r6 | nhen-pha-le x2 |

Phần thưởng boss rơi (ngoài rương kho báu): `xu` 80-150 (tăng 20 mỗi hầm theo thứ tự bảng), `ancient_shard` 2-4 (1,0). Mô hình 3D: dùng lại bộ xương mô hình có sẵn đổi màu/kích thước, không vẽ mô hình mới (Dev chọn).

### 4.8 Vật phẩm thưởng và công thức
- `ancient_shard` (Mảnh Cổ Vật), `heal_potion` (Bình Hồi Máu: ăn/uống được như `heal`, hồi 12, xếp tối đa 16).
- Công thức ở đe rèn: `ancient_pick` Cuốc Cổ Vật (bậc 3, tốc độ 6,5, sát thương 5) = 5 `ancient_shard` + 2 `stick`; `delver_blade` Kiếm Người Khai Hầm (bậc 3, sát thương 12, vũ khí di vật) = 8 `ancient_shard` + 2 `iron_ingot` + 1 `crystal`. Sát thương 12 nằm giữa Kiếm Nanh Sói (9) và Kiếm Nham Thạch (13).
- Thương nhân mua `ancient_shard` giá 25 xu, `heal_potion` giá 10 xu (mua bán thêm vào `content/shops.js`, không bán chìa).

### 4.9 Nhiệm vụ
Thêm 6 nhiệm vụ "dọn hầm" (loại hạ boss) vào `content/quests.js`, mỗi nhiệm vụ một hầm, giao bởi NPC của làng gần vùng nhất (Dev chọn NPC theo dữ liệu có sẵn). Thưởng xu 100/120/140/160/180/200 theo thứ tự bảng 4.1. Điều kiện nhận: đã mở vùng của hầm (cờ `requires` của vùng).

## 5. Dữ liệu mới

**Block** (thêm vào `world/blocks.js`, atlas tăng thêm 1 hàng, `ATLAS_ROWS` 8, tile vẽ bằng code ở `render/atlas.js`):

| Block | Ghi chú |
|---|---|
| `DUNGEON_WALL` (Gạch Hầm) | độ cứng -1 |
| `GATE_IRON` (Cổng Sắt), `GATE_BOSS` (Cổng Chủ Hầm) | độ cứng -1, bấm phải kiểm chìa |
| `SPIKES` | không rắn, tile 2 trạng thái (hạ/nhô) theo `g.time` |
| `PLATE` | không rắn, độ cứng 2, cuốc bậc 1 |
| `DART_TRAP` | rắn, độ cứng 2, cuốc bậc 1 |
| `VENT` | rắn, độ cứng 2, cuốc bậc 1, tile sáng khi báo hiệu |
| `DCHEST` | độ cứng -1, không có vật phẩm đặt |

**Vật phẩm** (`content/items.js`): `dungeon_key`, `boss_key`, `heal_potion`, `ancient_shard`, `ancient_pick`, `delver_blade`. Mỗi cái cần icon vẽ bằng code ở `ui/icons.js`.

**Dữ liệu khác:**
- `content/dungeons.js` mới: id, tên, vùng, danh sách quái, thứ tự bẫy, bảng rương, boss id.
- `content/bosses.js`: 6 chủ hầm. `content/mobs.js`: không thêm quái mới. `tuong-da` được dùng lại.
- `content/recipes.js`: 2 công thức. `content/shops.js`: giá mua 2 vật phẩm. `content/quests.js`: 6 nhiệm vụ.
- Âm thanh mới (sinh bằng code, `sfx.js`): tick tấm áp lực, tên bắn, gai nhô, phun, cổng mở, mở rương, boss hầm giữ nhạc boss có sẵn.
- `content/validate.js` kiểm: vùng, quái, vật phẩm, boss, bố cục hầm có chìa và cổng khớp.
- Bảng thiết kế (`tools/export_design_data.py`) xuất thêm hầm, chìa, bẫy.

## 6. Đa người chơi và lưu trữ

- **Host quyết định mọi thứ**: kích hoạt phòng, sinh quái, bẫy, kiểm chìa, phát phần thưởng. Hành động mới đi qua `act()`: `gate` (mở cổng), `dchest` (mở rương hầm), trả `{ok, reason}` như hành động hiện có; kiểm tầm `REACH`, người sống.
- **Đồng bộ**: cổng, bẫy phá được, rương xuất hiện đều là block, đi theo delta sẵn có. Nhịp bẫy dùng `g.time` đã có trong snapshot nên client vẽ khớp. Mũi tên bẫy dùng `proj` đã có. Cờ phòng/hầm truyền qua sự kiện `dungeon` khi vào hầm, đổi phòng, dọn xong; không thêm trường vào mỗi snapshot.
- **Nhiều người**: phòng canh gác tính số người trong phòng để tăng quái (4.3); chủ hầm co giãn theo số người như boss có sẵn; rương chia riêng theo uid (4.6). Người vào muộn thấy cổng và bẫy đúng trạng thái nhờ delta.
- **Lưu**: thêm `g.flags.sites.dungeon[id]` = `{x, y, z}` miệng hầm và gốc bố cục; `g.flags.dungeons[id]` = `{ rooms: {p2: true}, gates: {...}, claimed: {rương: [uid]}, boss: bool }`. Block (cổng đã mở, bẫy đã phá, rương kho báu) nằm trong `exportDelta`. Không lưu thực thể (quái đợt đang đánh dở bị mất khi thoát, phòng quay về chưa dọn). Phiên bản save giữ `v: 1`; trường mới thiếu thì coi là rỗng.
- **Thế giới cũ**: nạp save cũ thì dựng các hầm còn thiếu theo cách `buildStructures` đã làm, nhưng bỏ qua điểm có chunk đã bị chỉnh sửa trong khối bao (kiểm tra delta); không tìm được điểm thì bỏ hầm đó và ghi log, không crash.
- **Hiệu năng**: chỉ xử lý bẫy và phòng khi có người trong 40 block; bẫy tính theo công thức, không tạo thực thể.

## 7. Giao diện

- **Thông báo vào hầm**: biểu ngữ tên hầm 3 giây khi bước vào miệng hầm hoặc xuống tới P1.
- **HUD hầm** (hiện khi đang trong khối bao): "Phòng 2/4 · Quái còn 3", số Chìa Hầm / Chìa Chủ đang giữ kèm icon.
- **Gợi ý hướng**: khi cách miệng hầm <= 80 block và hầm chưa hạ chủ, HUD hiện một dòng "Miệng hầm: Đông Bắc 52 m". Có thể tắt tự nhiên khi đã vào hầm.
- **Cảnh báo bẫy**: gai rung 0,5 s trước khi nhô, ống phun sáng 1,0 s trước khi phun, tấm áp lực lún khi bị giẫm; có âm báo.
- **Rương hầm**: bấm phải mở bảng "Chiến lợi phẩm" liệt kê vật phẩm vừa nhận (icon + số), nút Đóng; nếu đã nhận thì hiện "Bạn đã nhận phần thưởng rương này".
- **Cổng khoá**: bấm phải khi thiếu chìa thì toast đỏ "Cần Chìa Hầm" / "Cần Chìa Chủ Hầm".
- **Icon**: 6 vật phẩm mới và 10 tile block (gai có 2 tile, rương hầm có mặt trên và mặt bên).
- **Chủ hầm**: thanh máu boss và tên có sẵn, không cần làm lại.

## 8. Tiêu chí nghiệm thu

Mọi AC kiểm bằng `tests/test_game.py` (nhập module sim trong trình duyệt, một số ca e2e hai trình duyệt). Tên test gợi ý đặt tiền tố `test_dungeon_*`. Test cũ phải xanh (hiện 106 bài + 21 bài mạng).

| Mã | Tiêu chí |
|---|---|
| AC-1 | Với ít nhất 5 seed khác nhau, thế giới mới có đúng 6 hầm, mỗi hầm nằm trong vùng của nó, cách mọi công trình khác >= 90 block. |
| AC-2 | Bố cục mỗi hầm dựng đúng: từ chân cầu thang tới P4 đi bộ được (tìm đường qua các ô rỗng, cổng coi như qua được khi mở), tổng chiều dài <= 80 block, sàn >= y 6. |
| AC-3 | Tường, trần, sàn viền (`DUNGEON_WALL`) và cổng: đào bằng cuốc bậc cao nhất không phá được; không có đường vào P1-P4 nào từ ngoài trừ qua cầu thang. |
| AC-4 | P2: đi vào phòng thì sinh đúng 4 quái đợt 1 (1 người); đợt 1 chết hết thì sau 2 giây sinh 3 quái thường + 1 `tuong-da`; thêm người thứ 2, 3 vào phòng thì mỗi đợt +1, +2 quái. |
| AC-5 | P2: rời xa > 30 block giữa đợt thì quái bị xoá và phòng chưa dọn; dọn xong đợt 2 thì cờ "đã dọn", vào lại không sinh quái, rương chiến thắng mở được. |
| AC-6 | Gai: ghi nhận đứng 4,0 s trên gai thì sát thương đúng bằng 4 x số lần tính theo nhịp (1,5 hạ / 0,5 báo / 2,0 nhô, tối thiểu 0,8 s giữa hai lần). Không sát thương khi gai hạ hoặc đang báo hiệu. |
| AC-7 | Tên bắn: giẫm tấm thì sau 0,3 s đúng 2 mũi tên sinh ra, mỗi mũi gây 5 (trừ giáp); tấm không kích hoạt lại trong 5 s; người đang rón rén giẫm không kích hoạt. |
| AC-8 | Phun: sát thương 6 trong bán kính 1,6, một lần mỗi người mỗi đợt phun, chỉ ở đoạn 0,8 s phun, không gây sát thương ở đoạn báo hiệu. |
| AC-9 | Phá `PLATE`, `DART_TRAP`, `VENT` bằng cuốc bậc 1 trong <= 2 s thì bẫy tương ứng ngừng hoạt động vĩnh viễn; đặt block lên gai đang hạ thì gai hết hiệu lực. |
| AC-10 | Cổng sắt: không có `dungeon_key` thì không mở và kho không đổi; có chìa thì trừ đúng 1 chìa và cụm 3x3 thành AIR; người chơi thứ hai đi qua được không cần chìa. Cổng chủ tương tự với `boss_key`; chìa sai loại không mở. |
| AC-11 | Rương chia riêng: người A mở nhận đúng bảng (số lượng nằm trong khoảng, mục cố định luôn có); người A mở lần hai không nhận thêm; người B vẫn nhận phần của mình. Với cùng seed, hầm, rương, uid thì kết quả giống nhau mỗi lần chạy. Kho đầy thì phần dư rơi ra đất. |
| AC-12 | Rương chiến thắng không mở trước khi P2 dọn (trả `ok:false`); rương kho báu chỉ xuất hiện sau khi chủ hầm chết; rương chìa mở ngay. |
| AC-13 | 6 chủ hầm: sinh khi có người vào P4, đủ 3 pha đổi đúng ngưỡng 1,0/0,55/0,25, hệ số đúng bảng 4.7, máu tăng +60% mỗi người thêm; rời 5 s thì reset; hạ thì đặt cờ `boss:<id>`, rơi xu và `ancient_shard` đúng khoảng, và không sinh lại sau khi nạp save. |
| AC-14 | Nhiệm vụ "dọn hầm" nhận được từ NPC khi vùng đã mở, và hoàn thành khi chủ hầm chết, nhận đủ xu (6 nhiệm vụ). |
| AC-15 | Công thức: `ancient_pick` và `delver_blade` chế được ở đe rèn với đúng nguyên liệu, không chế được ở bàn chế tạo thường; sát thương/bậc đúng số liệu 4.8; `heal_potion` hồi 12 máu (không vượt máu tối đa). |
| AC-16 | Lưu/nạp: sau khi mở cổng, dọn P2, nhận rương, phá một bẫy, hạ chủ hầm, lưu rồi nạp thì tất cả giữ nguyên; `claimed` còn đủ; nạp save cũ (không có `dungeons`) không lỗi và dựng đủ 6 hầm; điểm có chunk bị chỉnh sửa trong khối bao thì bị bỏ qua. |
| AC-17 | Đa người chơi (hai trình duyệt `?net=memory`): host mở cổng thì client thấy cổng biến mất; client mở rương thì chỉ client nhận; cả hai thấy cùng nhịp gai (lệch <= 0,2 s); client vào P2 kích hoạt quái ở host. |
| AC-18 | Quái tự nhiên không sinh trong khối bao của hầm trong 5 phút giả lập; quái hầm không bị xoá bởi luật 80 block khi còn người trong 30 block. |
| AC-19 | UI: có biểu ngữ tên hầm, dòng "Phòng x/4 · Quái còn n", số chìa, dòng gợi ý hướng khi <= 80 block (không hiện khi > 80 hoặc đã hạ chủ), bảng Chiến lợi phẩm, toast cổng thiếu chìa; 6 icon vật phẩm và các tile block mới (10 tile) tồn tại, không trùng ảnh nhau. |
| AC-20 | `validate.js` bắt được: hầm tham chiếu vùng/quái/vật phẩm/boss không tồn tại, hầm thiếu chìa hoặc cổng; dữ liệu hiện tại qua kiểm tra sạch. |
| AC-21 | Hiệu năng: tick của host với 5 người trong P3 (3 chặng bẫy) <= 2 ms thêm so với đo cùng kịch bản ở thế giới không có hầm; dựng 6 hầm khi tạo thế giới thêm <= 1,5 s. |

## 9. KHÔNG làm trong vòng này

- Cung/mũi tên của người chơi, né/lăn, khiên, thể lực (Gói 3); thanh đói, trồng trọt, nuôi thú (Gói 1). Mũi tên bẫy chỉ dùng cơ chế bắn của quái.
- Bố cục sinh ngẫu nhiên/khác nhau từng hầm, hầm nhiều tầng, hầm dưới nước, phòng bí mật, đố cơ quan phức tạp (công tắc nối nhiều cửa).
- Làm mới/hầm reset sau khi hạ chủ, độ khó theo cấp (hầm cấp 2, 3), hầm cho phần "sau game".
- Ánh sáng thật hoặc tối đen hầm (đuốc vẫn chỉ đuổi quái); hầm hơi tối do nền màu, không thêm shader.
- Bản đồ/la bàn, đánh dấu trên bản đồ; chỉ có dòng gợi ý hướng.
- Mô hình 3D mới cho chủ hầm; quái mới; nhạc riêng cho hầm.
- Giao dịch/thả chìa giữa người chơi qua UI riêng; chìa chỉ nhặt/ném như vật phẩm thường.
- Trạng thái hiệu ứng (bỏng, độc, làm chậm) từ bẫy; bẫy chỉ gây sát thương trực tiếp và hất lên.
- Người chơi đặt/chế bẫy; phá hầm, mang rương đi.
- PvP, cảm ứng/điện thoại, xếp hạng thời gian hoàn thành.

## 10. Rủi ro / câu hỏi mở cho Leader

1. Vật phẩm rơi khi chết trong hầm: giữ nguyên hành vi hiện tại; cần xác nhận chìa có thể mất khi chết (đã giảm nhẹ bằng việc người khác mở cổng hộ, nhưng chơi solo mất chìa là kẹt hầm). Đề xuất: chìa không rơi khi chết, hoặc rương chìa cho nhận lại nếu kho không có.
2. Atlas hiện 56 ô, cần 10 tile mới (spikes 2 trạng thái): tăng `ATLAS_ROWS` lên 8 ảnh hưởng toạ độ UV của mesher, Dev cần kiểm tra toàn bộ test render.
3. Tầng ngầm hiện có hang động và quặng: cần chắc `buildDungeon` xoá sạch khối bao 80x25x12 và chunk worker không sinh lại đè (delta phải thắng generate).
4. Cầu thang 12 bậc: dùng bậc cao 1 block, nên cần xác nhận người chơi nhảy lên được bậc (độ cao nhảy hiện tại) và không rơi sát thương.
