# Đặc tả Gói 3: Chiến đấu có chiều sâu

Tác giả: BA. Phạm vi: thể lực, lăn né, đòn theo vũ khí, cung và mũi tên, khiên đỡ đòn. Tham chiếu: Minecraft (cung, khiên), Hytale (né, đòn đặc trưng).

## 1. Hiện trạng (không đề xuất lại)

- Cận chiến: `actHit` (sim/combat.js), tầm 4.5, hồi chiêu cố định 0.5 s cho mọi vũ khí, sát thương = `dmg` của vật phẩm cầm tay (tay không 1), đẩy lùi nhẹ 0.2 s.
- Quái đánh cận chiến gây sát thương tức thì khi vào tầm (không báo hiệu). Quái bắn xa (Xương Cung Thủ, Ma Băng, Linh Hỏa) dùng đạn `proj` bay thẳng, không trọng lực, chỉ trúng người chơi.
- Boss có chiêu báo hiệu (đập vùng, nhảy, bắn loạt). Giáp giảm 4%/điểm, tối đa 75%, tối thiểu còn 1 (`reduceDamage`). Có `opts.pure` bỏ qua giáp.
- Chạy nước rút (Shift) và lén (C) đã có, chạy gây tiếng động. Chuột phải = ăn/dùng (`actUse`). Người chơi do client báo vị trí, host kiểm tra tốc độ (`applyState`).
- 12 vũ khí (kiếm gỗ tới kiếm ngọc, 6 vũ khí di vật), 6 bộ giáp, `ITEMS[x].dmg`. Chưa có: cung, mũi tên, khiên, thể lực, lăn, phân biệt kiểu vũ khí, chống đòn.
- Không có PvP; vẫn không làm trong vòng này.

## 2. Mục tiêu người chơi

1. Đánh nhau là quyết định từng nhịp (đánh, lùi, né, đỡ), không phải bấm giữ chuột.
2. Mỗi loại vũ khí có cảm giác và vai trò khác nhau; có lý do mang nhiều vũ khí.
3. Đánh xa có giá trị thật (cung) nhưng tốn tài nguyên (mũi tên) và phải ngắm.
4. Chơi nhóm: người cầm khiên chịu đòn, người cầm cung bắn từ xa, phối hợp được.

## 3. User story

| Mã | Câu chuyện |
|---|---|
| US-1 | Là người chơi, tôi thấy thanh thể lực để biết còn bao nhiêu sức cho chạy, đánh, lăn, đỡ. |
| US-2 | Là người chơi, tôi lăn để né đòn cận chiến và đạn của quái, có khoảnh khắc bất khả xâm phạm ngắn. |
| US-3 | Là người chơi, tôi dùng kiếm đánh chuỗi 3 đòn, đòn cuối mạnh và hất lùi. |
| US-4 | Là người chơi, tôi dùng rìu quét trúng nhiều quái cùng lúc, đổi lại chậm hơn. |
| US-5 | Là người chơi, tôi dùng chùy choáng quái cận chiến để có thời gian xử lý. |
| US-6 | Là người chơi, tôi dùng giáo đánh từ xa hơn kiếm để giữ khoảng cách. |
| US-7 | Là người chơi, tôi nhảy xuống đánh để gây đòn chí mạng. |
| US-8 | Là người chơi, tôi giương cung, giữ càng lâu bắn càng mạnh và xa, tiêu hao mũi tên. |
| US-9 | Là người chơi, tôi chế cung, mũi tên, khiên bằng nguyên liệu đã có trong game. |
| US-10 | Là người chơi, tôi giơ khiên chặn đòn phía trước và đỡ đúng lúc để phản đòn (đỡ hoàn hảo). |
| US-11 | Là người chơi, khi khiên bị phá tôi bị choáng ngắn nên phải cân nhắc khi đỡ. |
| US-12 | Là người chơi nhiều người, tôi thấy bạn đang giương cung, giơ khiên, lăn; mọi thứ nhất quán giữa các máy. |
| US-13 | Là người chơi, thể lực, khiên đeo và đồ chiến đấu được giữ khi lưu và nạp lại thế giới. |
| US-14 | Là người chơi, quái cận chiến báo hiệu trước đòn để tôi có cơ hội né. |

## 4. Luật chơi

Mọi giá trị là hằng số có tên trong `sim/rules.js` (dùng chung host và UI), dữ liệu theo vũ khí nằm ở `content/items.js`.

### 4.1 Thể lực (US-1)

- Tối đa 100. Hồi 25 điểm/s sau khi 1.0 s không tiêu thể lực; trên không hoặc đang giơ khiên thì hồi 40%.
- Tiêu: chạy nước rút 8/s (chỉ khi thực sự di chuyển, tốc độ ngang > 1); vung vũ khí theo bảng 4.3; lăn 25; bắn cung 10; chặn đòn theo 4.5.
- Về 0: trạng thái kiệt sức 2.0 s, không chạy, không lăn, không vung (vẫn đi bộ, vẫn giơ khiên nhưng khiên vỡ ngay khi dính đòn). Hồi lại, kiệt sức kết thúc khi đủ 20.
- Thể lực không phụ thuộc giáp. Người chết hồi sinh đầy thể lực; nạp save cũng đầy.
- Host là nguồn sự thật. Client chỉ dùng `stamina` host gửi để vẽ và tự chặn chạy (cùng hằng số) khi dưới 1 hoặc kiệt sức.

### 4.2 Lăn né (US-2)

- Phím Q (đi kèm hướng WASD; không bấm hướng thì lăn về phía trước theo hướng nhìn). Không lăn khi chết, đang kiệt sức, đang kéo cung quá 0.3 s, đang choáng.
- Kéo dài 0.45 s, quãng đường 3.5 block (tốc độ trung bình khoảng 7.8 block/s, vẫn trong ngưỡng chống gian lận `14·dt+3`).
- Bất khả xâm phạm từ 0.05 s tới 0.35 s (0.30 s): `hurtPlayer` bỏ qua mọi sát thương (kể cả đạn, boss, khí độc không bị miễn, chỉ miễn đòn có `src`). Đạn không bị huỷ khi lăn xuyên.
- Hồi chiêu 0.8 s tính từ lúc bắt đầu lăn. Tiêu 25 thể lực.
- Lăn huỷ giơ khiên và kéo cung. Khi lăn không vung vũ khí được.
- Hiệu ứng: camera hạ thấp và nghiêng nhẹ, âm "xoẹt".

### 4.3 Đòn theo vũ khí (US-3 tới US-7)

Thêm trường `weapon` cho vật phẩm: `{ cls, cd, cost, reach }` (giá trị mặc định = hằng số hiện tại cho vật phẩm cũ). Sát thương cơ bản vẫn là `dmg` hiện có.

| Lớp | Vũ khí | Hồi chiêu | Thể lực/đòn | Tầm | Đặc trưng |
|---|---|---|---|---|---|
| Kiếm (`sword`) | mọi kiếm hiện có (trừ chùy) | 0.50 s | 6 | 4.5 | Chuỗi 3 đòn, xem dưới |
| Rìu (`axe`) | rìu sắt, Rìu Băng Đế | 0.80 s | 12 | 4.5 | Quét: đánh tới 3 mục tiêu trong 2.5 block quanh mục tiêu chính, mục tiêu phụ nhận 70% |
| Chùy (`club`) | Chùy Chúa Đầm Lầy (đổi lớp), chùy sắt mới | 1.00 s | 15 | 4.5 | Sát thương x1.3; choáng quái thường 1.0 s |
| Giáo (`spear`) | giáo gỗ, đá, sắt mới | 0.70 s | 8 | 6.0 | Chọc thẳng, không đẩy lùi (giữ khoảng cách) |
| Tay không | không cầm gì | 0.50 s | 4 | 4.5 | Như hiện tại |

- Kiếm, chuỗi: đòn 1 và 2 sát thương x1.0, đòn 3 x1.5 và đẩy lùi gấp đôi. Mỗi đòn phải trúng và trong 0.8 s sau đòn trước, nếu không chuỗi về 0. Sau đòn 3 hồi chiêu 0.8 s thay vì 0.5 s. Đổi vật phẩm cầm tay làm chuỗi về 0.
- Chí mạng khi rơi (US-7): đánh khi đang rơi (vy < -2 và không chạm đất) thì x1.5, nhân sau các hệ số khác, làm tròn xuống, cộng dồn được với đòn 3 kiếm. Hiệu ứng tia sáng và âm khác.
- Choáng (chùy): quái bị choáng không di chuyển, không đánh, `atkAt` đẩy tới hết choáng; boss miễn choáng (chỉ nhận sát thương). Mỗi quái miễn choáng thêm 3 s sau khi hết choáng.
- Không đủ thể lực cho đòn: từ chối với lý do `tired`, không tiêu gì. Kiệt sức: từ chối.
- Sát thương = `floor(dmg x hệ số)`, tối thiểu 1.
- Hồi chiêu host-xác nhận: `actHit` đọc `cd` theo vũ khí, thay `HIT_CD` cố định.

### 4.4 Báo hiệu đòn quái (US-14, điều kiện để lăn/đỡ có nghĩa)

- Quái cận chiến vào tầm thì có thời gian vung: 0.35 s (quái có `attack.cd` < 1.4), 0.6 s (>= 1.4: Gấu Băng, Cá Sấu, Tượng Đá, Hộ Vệ Pha Lê). Gửi sự kiện `windup` rồi `swing` như hiện nay.
- Hết thời gian vung, đòn trúng nếu người chơi còn trong `range + 0.4` và không bất khả xâm phạm; nếu không thì trượt, quái vẫn chịu hồi chiêu.
- Sát thương, tầm, hồi chiêu của quái giữ nguyên số hiện tại. Boss giữ nguyên chiêu, chỉ đánh dấu chiêu đập vùng là không chặn được bằng khiên (nhưng lăn né được).

### 4.5 Cung và mũi tên (US-8, US-9)

- Cung: giữ chuột trái khi cầm cung để kéo; thả để bắn. Chuột trái không đào/đánh khi cầm cung.
- Thời gian kéo đầy: cung gỗ 1.0 s, cung sắt 0.8 s. Lực = min(1, thời gian giữ / thời gian kéo đầy). Dưới 0.2 s thả ra thì không bắn, không mất mũi tên.
- Sát thương mũi tên = tuyến tính từ `min` (lực 0.2) tới `max` (lực 1.0): cung gỗ 3 → 10, cung sắt 4 → 14. Tốc độ 12 → 28 block/s (gỗ), 14 → 32 (sắt). Vượt tầm 40 block hoặc sau 4 s thì biến mất.
- Mũi tên có trọng lực 9 block/s², bay theo hướng nhìn người bắn. Trúng quái hoặc boss gây sát thương, kích hoạt `aggro` và xuyên không được; trúng block thì biến mất. Không trúng người chơi khác.
- Tiêu 1 mũi tên mỗi lần bắn (host trừ khi bắn), 10 thể lực. Hết mũi tên: từ chối `no-ammo`. Kéo cung thì chạy nước rút bị huỷ và tốc độ đi x0.6.
- Hồi chiêu giữa hai lần bắn: 0.4 s.
- Mũi tên trúng quái có 30% rớt lại thành vật phẩm tại chỗ.
- Tiếng động khi bắn: bán kính 10 (kẻ địch nghe được qua hệ thống `makeNoise`).

### 4.6 Khiên (US-10, US-11)

- Khiên là món thứ 5 (ô tay phụ `offhand`), mặc bằng chuột phải trong kho như giáp, cởi bằng nút giống giáp.
- Giơ khiên: giữ chuột phải (hoặc phím F) khi có khiên và vật cầm tay không phải đồ ăn. Khi giơ: tốc độ x0.6, không chạy nước rút, không đánh, không kéo cung.
- Chặn được: đòn cận chiến quái, đạn, chiêu boss có `src` và không đánh dấu không chặn được; trong cung phía trước 120° (±60° so với hướng nhìn, tính ngang). Không chặn: khí độc, nóng lạnh, bỏng, đòn từ sau lưng, đập vùng boss.
- Khiên gỗ: giảm 60% sát thương, mỗi lần chặn tốn thể lực = sát thương gốc x 2. Khiên sắt: giảm 80%, tốn x 1.5. Sát thương còn lại đi tiếp qua giáp như thường (giáp áp sau khiên, vẫn tối thiểu 1).
- Đỡ hoàn hảo: nếu chặn trong 0.25 s đầu sau khi bắt đầu giơ thì miễn 100% sát thương, không tốn thể lực, quái cận chiến (không phải boss) choáng 0.8 s, kèm hiệu ứng và âm riêng. Giơ rồi hạ rồi giơ lại: mỗi lần bắt đầu giơ có cửa sổ riêng, nhưng cách lần trước tối thiểu 0.5 s.
- Vỡ khiên: không đủ thể lực để trả cho cú chặn thì nhận toàn bộ sát thương (qua giáp), thể lực về 0, choáng người chơi 1.0 s (không di chuyển, không lăn, không vung), khiên ngừng giơ.
- Khiên không có độ bền trong vòng này.

## 5. Dữ liệu mới

Vật phẩm (icon sinh bằng code trong `ui/icons.js`, model tay trong `render/models`):

| id | Tên | Ghi chú |
|---|---|---|
| `bow` | Cung gỗ | kéo 1.0 s, 3→10 |
| `iron_bow` | Cung sắt | kéo 0.8 s, 4→14 |
| `arrow` | Mũi tên | stack 64 |
| `wood_shield` | Khiên gỗ | giảm 60% |
| `iron_shield` | Khiên sắt | giảm 80% |
| `wood_spear` | Giáo gỗ | dmg 4, tier 1 |
| `stone_spear` | Giáo đá | dmg 5, tier 2 |
| `iron_spear` | Giáo sắt | dmg 7, tier 2 |
| `iron_club` | Chùy sắt | dmg 8, tier 2 |

Công thức (khớp style `RECIPES`):

| Ra | Nguyên liệu | Trạm |
|---|---|---|
| `bow` | gậy 3, da cáo 1 | bàn chế tạo |
| `iron_bow` | thỏi sắt 2, gậy 3, da cáo 1 | đe rèn |
| `arrow` x4 | gậy 1, xương 1 | bàn chế tạo |
| `wood_shield` | ván gỗ 5, gậy 1 | bàn chế tạo |
| `iron_shield` | thỏi sắt 4, ván gỗ 2 | đe rèn |
| `wood_spear` | ván gỗ 1, gậy 2 | bàn chế tạo |
| `stone_spear` | đá 2, gậy 2 | bàn chế tạo |
| `iron_spear` | thỏi sắt 2, gậy 2 | đe rèn |
| `iron_club` | thỏi sắt 3, gậy 1 | đe rèn |

Thay đổi dữ liệu có sẵn:
- Xương Cung Thủ rớt thêm `arrow` 2 tới 5, xác suất 0.6. Trong cửa hàng NPC bán `arrow` x8 giá 12 xu (nếu `content/shops.js` có hàng vũ khí, thêm vào; nếu không, bỏ qua).
- Thêm `weapon: { cls, cd, cost, reach }` cho mọi vũ khí hiện có theo bảng 4.3. Chùy Chúa Đầm Lầy đổi sang lớp `club` (dmg giữ nguyên 11).
- `content/validate.js` kiểm tra: mọi vũ khí có `weapon` hợp lệ, cung có `bow`, khiên có `shield`, công thức tham chiếu id tồn tại.
- Mục `bow` trong item: `{ draw, dmgMin, dmgMax, speedMin, speedMax }`; mục `shield`: `{ reduce, costMul }`.

## 6. Đa người chơi và lưu trữ

- Hành động mới qua `S.act`: `roll {dx,dz}`, `guard {on}`, `draw {on}`, `shoot`. Host kiểm tra điều kiện, thể lực, hồi chiêu, tồn kho; host tự đo thời gian giữ cung và giữ khiên theo đồng hồ host (client không báo lực kéo hay thời điểm đỡ).
- Trạng thái chiến đấu (thể lực, kiệt sức đến lúc nào, bất khả xâm phạm đến lúc nào, giơ khiên từ lúc nào, chuỗi kiếm, choáng) nằm trên người chơi ở host. Không dựa vào client.
- Snapshot: mỗi người chơi trong `ps` thêm `act` (0 rảnh, 1 giơ khiên, 2 kéo cung, 3 lăn, 4 choáng/kiệt sức) để vẽ hoạt ảnh cho người khác. `you` thêm `stamina`, `maxStamina`, `exhaust` (giây còn lại), `combo` (0 tới 2), `offhand`. Đạn mũi tên dùng `proj` hiện có với `style: 'arrow'` và có thêm `vy` thật (đã có `pit`); quái bị choáng thêm cờ `stun` trong snapshot mob.
- Sự kiện mới tới đúng người: `block {perfect}`, `guardbreak`, `exhausted`; tới mọi người: `windup {id}`, `parry {id}`, `roll {uid}`.
- Đạn người chơi bắn có `owner` là uid, không đụng người chơi nào, tính điểm tiêu diệt cho `by: uid` (nhiệm vụ săn quái vẫn hoạt động).
- Độ trễ: lăn là chuyển động client dự đoán (client tự lăn khi nhận `ok`), host chỉ cho phép trượt quá ngưỡng tốc độ trong 0.45 s của lăn. Không cho phép lăn lặp bằng cách gửi sớm: host dùng hồi chiêu 0.8 s.
- Lưu: `playerSave` thêm `offhand` (id hoặc null). Không lưu thể lực, trạng thái đang giơ/kéo, chuỗi kiếm (tất cả về mặc định khi nạp). Mũi tên, cung, khiên là vật phẩm nên lưu theo kho hiện có. Save cũ không có `offhand` vẫn nạp được (mặc định null); chỉ thêm trường tuỳ chọn nên không bắt buộc nâng `SAVE_VERSION`; nếu gói khác đã nâng thì giữ tương thích đi lên.
- Người chơi vào giữa trận: nhận `you` đầy đủ như hiện nay, không cần đồng bộ lịch sử.

## 7. Giao diện

- HUD: thanh thể lực dưới thanh máu (xanh lá, chuyển vàng dưới 40, đỏ nhấp nháy khi kiệt sức). Tâm ngắm có vòng kéo cung chạy tới đầy khi cầm cung. Hiển thị số mũi tên cạnh thanh nhanh khi cầm cung. 3 chấm chuỗi kiếm bên dưới tâm ngắm. Biểu tượng khiên mờ khi hạ, sáng khi giơ, hiệu ứng viền khi đỡ hoàn hảo hoặc vỡ khiên.
- Màn hình trang bị (`ui/panels.js`): thêm ô "Tay phụ" cạnh 4 ô giáp; mặc/cởi như giáp. Mô tả vật phẩm hiển thị lớp vũ khí, hồi chiêu, thể lực/đòn, đặc trưng; cung hiển thị sát thương tối thiểu/tối đa; khiên hiển thị % giảm.
- Phím: Q lăn, chuột phải hoặc F giơ khiên, chuột trái giữ để kéo cung. Ghi vào màn hướng dẫn điều khiển hiện có (tiếng Việt).
- Icon: cung, cung sắt, mũi tên, khiên gỗ, khiên sắt, 3 giáo, chùy sắt đều có icon vẽ bằng code, phân biệt được bằng mắt theo hình và màu (`ui/icons.js`).
- Render: tay người chơi cầm cung (dây căng theo lực kéo), khiên trên tay trái, hoạt ảnh lăn, rìu quét, chùy giáng; người chơi khác thấy theo `act`. Âm thanh sinh bằng code: kéo cung, bắn, trúng khiên, đỡ hoàn hảo, vỡ khiên, lăn, kiệt sức.
- Toast tiếng Việt: "Hết sức!", "Hết mũi tên!", "Khiên vỡ!".

## 8. Tiêu chí nghiệm thu (mỗi mục kiểm thử tự động được)

Quy ước: kiểm thử ở `tests/test_game.py`, tên `test_combat2_*`; bài mạng ở `tests/test_net.py`. 106 + 21 bài hiện có phải vẫn xanh.

| Mã | Tiêu chí | Cách đo |
|---|---|---|
| AC-1 | Người chơi mới có `stamina` = 100, `maxStamina` = 100; có trong `you` snapshot | đọc state |
| AC-2 | Chạy nước rút 2.0 s ở tốc độ ngang > 1 làm thể lực giảm 16 ± 2; đứng yên sprint thì không giảm | mô phỏng `tick` |
| AC-3 | Sau 1.0 s không tiêu, thể lực hồi 25 ± 2 điểm/s; trong 0.9 s đầu không hồi | tick theo bước |
| AC-4 | Thể lực về 0 → `exhaust` = 2.0 s; trong thời gian này `roll`, `hit` trả `ok:false` (`tired`); sprint bị client chặn; hết kiệt sức khi thể lực ≥ 20 | gọi act |
| AC-5 | `roll` hợp lệ: `ok:true`, thể lực giảm 25, hồi chiêu 0.8 s (lần 2 trong 0.8 s bị từ chối `cooldown`) | gọi act |
| AC-6 | Trong cửa sổ bất khả xâm phạm (0.05 tới 0.35 s sau lăn), `hurtPlayer` từ quái/đạn/boss không trừ máu; ngoài cửa sổ (0.36 s) thì trừ; khí độc (không `src`) vẫn trừ | gọi `hurtPlayer` theo thời điểm |
| AC-7 | Lăn di chuyển người chơi 3.5 ± 0.4 block trong 0.45 ± 0.05 s trên đất phẳng và không bị host kéo về (không `teleport`) | e2e |
| AC-8 | Kiếm: 3 đòn trúng liên tiếp trong 0.8 s gây sát thương x1.0, x1.0, x1.5 (làm tròn xuống, tối thiểu 1) và đòn 3 đẩy lùi gấp đôi; cách quãng > 0.8 s hoặc đổi vật cầm thì quay về đòn 1; sau đòn 3 hồi chiêu 0.8 s | đo `hp` quái |
| AC-9 | Rìu: 3 quái cùng trong 2.5 block quanh mục tiêu cùng bị đánh (mục tiêu phụ 70%); quái thứ 4 không bị; hồi chiêu 0.8 s | đo `hp` |
| AC-10 | Chùy: quái thường bị choáng 1.0 s (không di chuyển, không gây sát thương); đánh tiếp trong 3 s sau khi hết choáng không choáng lại; boss không bị choáng | đo trạng thái |
| AC-11 | Giáo trúng mục tiêu cách 5.5 block (kiếm thì `reach`), không đẩy lùi | gọi act |
| AC-12 | Đánh khi đang rơi (vy < -2) gây x1.5; đánh trên đất không x1.5 | đo `hp` |
| AC-13 | Mỗi vũ khí tiêu thể lực đúng bảng 4.3; không đủ thể lực → `tired` và không đổi trạng thái | đọc state |
| AC-14 | Quái cận chiến: có `windup` 0.35 s (0.6 s cho quái `cd` >= 1.4) trước khi trừ máu; lùi ra khỏi `range + 0.4` trong thời gian đó thì không mất máu; sát thương/tầm/hồi chiêu quái không đổi so với dữ liệu hiện có | tick |
| AC-15 | Cung: kéo < 0.2 s rồi thả → không bắn, không mất mũi tên; kéo 1.0 s (cung gỗ) → sát thương 10 và tốc độ 28 ± 1; kéo 0.6 s → nội suy tuyến tính (6.6 ± 0.5; 21 ± 1) | gọi act với đồng hồ host |
| AC-16 | Bắn trừ đúng 1 mũi tên và 10 thể lực; không có mũi tên → `no-ammo`; hai lần bắn cách < 0.4 s → lần sau bị từ chối | gọi act |
| AC-17 | Mũi tên có trọng lực: bắn ngang tốc độ 28, sau 0.5 s độ rơi 1.1 ± 0.3 block; xóa khi chạm block hoặc sau 4 s; không trúng người chơi; trúng quái trừ máu, kích hoạt `aggro` và tính kill cho uid người bắn (nhiệm vụ săn quái tăng) | tick |
| AC-18 | Trúng quái, 30% ± 10% (100 lần với RNG cố định) mũi tên rơi lại thành vật phẩm | thống kê |
| AC-19 | Khiên: giơ khiên giảm tốc đi còn 60% và cấm sprint, `hit`, kéo cung | đo vận tốc |
| AC-20 | Khiên gỗ chặn đòn trong cung ±60° phía trước: sát thương gốc 10 còn 4 (trước giáp), thể lực giảm 20; khiên sắt còn 2, thể lực giảm 15; đòn từ sau lưng hoặc 65° lệch → nhận đủ | gọi `hurtPlayer` |
| AC-21 | Đòn không chặn được (không `src`, `pure`, đập vùng boss) bỏ qua khiên | gọi `hurtPlayer` |
| AC-22 | Đỡ hoàn hảo: chặn trong 0.25 s đầu → 0 sát thương, 0 thể lực, quái cận chiến choáng 0.8 s; giơ ở 0.30 s thì không phải đỡ hoàn hảo; giơ lại trong 0.5 s không được cửa sổ mới; boss không bị choáng | gọi act + đo |
| AC-23 | Vỡ khiên: thể lực không đủ → nhận toàn bộ sát thương qua giáp (tối thiểu 1), thể lực = 0, choáng 1.0 s, tự hạ khiên, sự kiện `guardbreak` | gọi `hurtPlayer` |
| AC-24 | Lăn huỷ giơ khiên và kéo cung | gọi act |
| AC-25 | Công thức: 9 công thức mới chế được đúng nguyên liệu/trạm; `arrow` ra 4; `validate.js` không báo lỗi | crafting + validate |
| AC-26 | Vật phẩm mới có icon khác nhau (data URL khác nhau, không rỗng) | so sánh icon |
| AC-27 | Xương Cung Thủ rớt `arrow` trong khoảng 2 tới 5 với xác suất 0.6 ± 0.15 (100 lần) | thống kê |
| AC-28 | HUD: thanh thể lực hiện đúng tỷ lệ; đỏ khi kiệt sức; vòng kéo cung đầy ở 1.0 s; số mũi tên đúng; 3 chấm chuỗi sáng đúng số đòn | đọc DOM |
| AC-29 | Màn trang bị có ô Tay phụ; mặc/cởi khiên đổi kho đúng, cung/giáo không mặc vào ô tay phụ; mô tả hiện lớp vũ khí, hồi chiêu, thể lực | e2e |
| AC-30 | Đa người chơi (`test_net`): khách giương khiên → host thấy `act`=1 trong snapshot của khách và khách thứ hai nhận cùng giá trị; khách lăn → `act`=3 trong 0.45 s | 2 trang |
| AC-31 | Đa người chơi: khách bắn cung, mũi tên xuất hiện ở snapshot của cả hai và trúng quái; kill tính cho khách | 2 trang |
| AC-32 | Khách không thể bắn không tốn mũi tên hay giữ khiên bằng cách gửi lực/thời điểm giả (host bỏ qua mọi trường thời gian do client gửi) | gửi act giả |
| AC-33 | Lưu/nạp: `offhand` được lưu và nạp; save cũ không có `offhand` nạp được; thể lực, kiệt sức, chuỗi kiếm về mặc định sau nạp; `SAVE_VERSION` nạp được cả save cũ | toSave/fromSave |
| AC-34 | Hồi sinh: thể lực đầy, trạng thái khiên/kéo cung/lăn/choáng xoá sạch | gọi act |
| AC-35 | Tương thích: hồi quy 106 bài `test_game.py` và 21 bài `test_net.py` vẫn xanh (nếu bài cũ phụ thuộc hồi chiêu cố định 0.5 s hoặc đòn quái tức thì thì cập nhật bài theo AC-8 và AC-14, ghi lý do trong commit) | chạy toàn bộ |

## 9. Không làm trong vòng này

- PvP (người đánh người), bắn nhầm đồng đội.
- Độ bền vũ khí và khiên; phù phép; mũi tên đặc biệt (lửa, độc, nổ); nỏ; ném lao.
- Đòn mạnh giữ chuột (charge) cho cận chiến, chiêu đặc biệt kích hoạt bằng phím, đòn chạy nước rút.
- Hoạt ảnh xương/IK phức tạp, ragdoll; chỉ hoạt ảnh theo tư thế đơn giản.
- Cân bằng lại máu và sát thương quái, boss hiện có (chỉ thêm báo hiệu đòn cận chiến).
- Tay phụ cho đồ khác (đuốc, sách); `offhand` chỉ nhận khiên.
- Khiên chặn môi trường, khiên phản đạn.
- Hiệu ứng vũ khí di vật riêng, nâng cấp vũ khí.
- Tùy biến phím trong menu (dùng phím cố định đã nêu).
