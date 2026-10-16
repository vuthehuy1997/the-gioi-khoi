# Thế Giới Khối — Design Spec

> Thư mục game: `games/the-gioi-khoi/` (tên hiển thị tạm, slug có thể đổi trước khi đăng ký vào `platform/games.js`).
> Phần mạng dùng chung: `platform/net/`.

## Mục tiêu

Thêm một game thế giới khối (voxel) nhiều người chơi, kiểu Minecraft nhưng nhiều nội dung hơn: nhiều vùng, nhiều loại quái, boss, NPC và nhiệm vụ. Chơi 2–5 người cùng lúc qua mạng, chạy hoàn toàn trên GitHub Pages, không có server riêng và không có bước build.

## Giả định cần xác nhận

Các điểm dưới đây tôi tự chọn để viết spec; sửa nếu sai trước khi lập plan.

| # | Giả định | Ảnh hưởng nếu sai |
|---|---|---|
| A1 | 2–5 người mỗi phòng, bạn bè, không phải người lạ | Nếu cần đông hơn hoặc chạy 24/7, phải chuyển host sang server thật (xem "Lối thoát") |
| A2 | Có đào/đặt block | Nếu không, bỏ lưu delta chunk, đơn giản hơn nhiều |
| A3 | Hướng chơi: phiêu lưu co-op PvE (khám phá vùng, đánh quái, hạ boss, làm nhiệm vụ), không PvP | Thêm PvP cần luật sát thương và chống gian lận riêng |
| A4 | Chủ yếu desktop (bàn phím + chuột); mobile là phần sau | Mobile ảnh hưởng tầm nhìn, điều khiển, số mesh |
| A5 | Người chơi tin nhau (host là trình duyệt, có thể gian lận) | Nếu không, bắt buộc có server thật |

## Ngoài phạm vi (v1)

- Server chạy liên tục, tài khoản, đăng nhập.
- PvP, chống gian lận, kiểm duyệt chat.
- Hơn 5 người một phòng.
- Mobile / cảm ứng.
- Redstone, mạch, hệ vật lý chất lỏng đầy đủ.
- Công cụ cho người ngoài tạo vùng/quái (nội dung chỉ do team viết).
- Mod, plugin, âm nhạc nhiều lớp.

## Vòng lặp chính

Trang chủ hub → vào game → chọn **Tạo phòng** (mới hoặc nạp thế giới đã lưu) hoặc **Vào phòng** (nhập mã) → vào thế giới → khám phá, đào/xây → gặp NPC, nhận nhiệm vụ → vào vùng nguy hiểm, đánh quái → hạ boss lấy phần thưởng mở vùng/vật phẩm mới → chế tạo đồ tốt hơn → vùng tiếp theo.

Mục tiêu dài hạn của một thế giới: hạ boss của mọi vùng trong chuỗi vùng của thế giới đó.

## Kiến trúc tổng quan

Mô hình **host là nguồn sự thật**: một người chơi (host) chạy logic thế giới ngay trong trình duyệt, các người còn lại (client) gửi input và hiển thị.

```
Client A (host)                         Client B, C...
┌───────────────────────┐               ┌──────────────────────┐
│ sim/  (logic thế giới)│◄── input ─────│ input.js             │
│  tick 20/s            │               │                      │
│  world, entities, AI  │── snapshot ──►│ state tạm (nội suy)  │
│ render/ (vẽ)          │               │ render/ (vẽ)         │
│ storage (IndexedDB)   │               └──────────────────────┘
└───────────────────────┘
        ▲ WebRTC (dữ liệu) ▲
        └── signaling qua relay công cộng của thư viện ──┘
```

### Quy tắc phân lớp (bắt buộc, kiểm bằng test)

| Lớp | Được import | Không được import |
|---|---|---|
| `sim/` | `platform/core/util.js`, `content/` | Three.js, DOM, mạng, `render/`, `window` |
| `world/` | `sim/` kiểu dữ liệu, `platform/core/util.js` | DOM, mạng |
| `render/` | Three.js, `world/`, state dạng đọc | Mạng, logic `sim/` ghi trạng thái |
| `net` (trong `platform/net/`) | Thư viện WebRTC | Bất cứ thứ gì của game |
| `main.js` | tất cả, nối chúng lại | — |

Lý do: `sim/` chạy được trong test Node/Playwright không cần trình duyệt đồ hoạ, và sau này đưa nguyên `sim/` lên server thật mà không viết lại game.

## Hệ thống

### 1. Mạng (`platform/net/`) — dùng chung cho mọi game nhiều người chơi

- `room.js`: tạo phòng sinh **mã phòng 5–6 ký tự** (bỏ ký tự dễ nhầm O/0, I/1). Vào phòng bằng mã. Phát sự kiện `join`, `leave`, `host-changed`. Tối đa 5 người; người thứ 6 nhận từ chối rõ ràng.
- `transport.js`: bọc thư viện WebRTC (mặc định **Trystero**; thay được mà game không phải sửa). Hai kênh: **tin cậy theo thứ tự** (sự kiện: đặt/đào block, nhận đồ, hội thoại, chat) và **không tin cậy** (vị trí, snapshot thường xuyên).
- `host-loop.js`: vòng lặp host cố định **20 tick/giây**: nhận input, chạy `sim.step`, gom thay đổi, phát snapshot. Tick chạy bằng bộ tích luỹ thời gian (không phụ thuộc `requestAnimationFrame` của tab ẩn); host bị ẩn tab sẽ bị throttle, cần cảnh báo "giữ tab host ở phía trước".
- **TURN**: cấu hình danh sách ICE server trong `platform/net/ice.js` (STUN công cộng + một TURN miễn phí). Hiển thị trạng thái kết nối của mỗi người.
- **Giao thức**: mỗi tin có `t` (kiểu) và `v` (phiên bản giao thức). Client và host khác phiên bản thì từ chối vào kèm thông báo "tải lại trang".
- **Đo**: `platform/net/stats.js` đếm byte/giây, ping từng người, hiện trong bảng debug (dùng `platform/core/debug.js`).

### 2. Thế giới (`games/the-gioi-khoi/world/`)

- **Chunk**: 16×16 ngang × 64 cao (v1; 256 cao cân nhắc sau khi đo). Mỗi ô là một số nguyên id block (`Uint8Array`/`Uint16Array`).
- **Sinh địa hình**: hàm thuần `generateChunk(seed, cx, cz, regionDef)`; cùng seed cho cùng kết quả trên mọi máy (client không cần nhận chunk gốc, chỉ cần seed + delta). Noise tự viết (simplex/value) để không phụ thuộc thư viện, **phải xác định (deterministic)** giữa các trình duyệt.
- **Delta**: mọi thay đổi so với địa hình sinh ra được lưu thành bản đồ `chunkKey → {offset: blockId}`. Chỉ delta được lưu và phát.
- **Block**: danh mục trong `content/blocks.json` (id, tên, texture, độ cứng, công cụ đào, vật phẩm rơi, có đặc/trong suốt/phát sáng).
- **Mesh**: dựng trong **Web Worker** (`world/mesher.worker.js`, ES module). Bỏ mặt bị che, gộp mặt (greedy meshing) là mục tiêu sau; v1 chỉ bỏ mặt bị che. Gửi lại buffer bằng transferable. Chunk đổi chỉ dựng lại chunk đó (và láng giềng ở biên).
- **Tầm nhìn**: mặc định 6 chunk bán kính, chỉnh trong Cài đặt (4/6/8). Tự giảm nếu FPS < 40 trong 5 giây.
- **Ánh sáng**: v1 ánh sáng cố định theo mặt (như Minecraft cũ) + sương mù theo khoảng cách. Chu kỳ ngày đêm bằng đổi màu trời và đèn môi trường; ánh sáng theo từng ô để sau.

### 3. Mô phỏng (`games/the-gioi-khoi/sim/`)

- **Trạng thái**: một object thuần `{ tick, players, entities, world(delta), quests, flags }`, có thể tuần tự hoá.
- **`step(state, inputs, dt)`**: hàm trả trạng thái mới/biến đổi tại chỗ có kiểm soát; mọi ngẫu nhiên dùng **PRNG có seed** nằm trong state để test lặp lại được.
- **Vật lý**: AABB so với lưới block; trọng lực, nhảy, bước lên 1 block, bơi nước đơn giản. Một bộ hằng số vật lý dùng chung cho người chơi và quái.
- **Thực thể (entity)**: bảng `id → {kind, pos, vel, hp, ai, ...}`; kind: `player`, `mob`, `boss`, `npc`, `item`, `projectile`.
- **Ngân sách tick**: mỗi tick có trần số quái hoạt động quanh người chơi (mặc định 40 tổng, 24 trong tầm 32 block). Quái ngoài tầm đóng băng/ngủ; spawn bị chặn khi chạm trần. Số đo thời gian mỗi tick hiện trong debug; vượt 25 ms thì giảm trần tự động.
- **Chiến đấu**: sát thương tính ở host. Client chỉ gửi ý định ("tấn công hướng này"); host kiểm tra tầm với, hồi chiêu.
- **Chết/hồi sinh**: rơi một phần đồ tại chỗ chết, hồi sinh ở giường/điểm hồi sinh của thế giới sau 5 giây. Không mất thế giới.

### 4. Nội dung hướng dữ liệu (`games/the-gioi-khoi/content/`)

Mọi thứ là file JSON (hoặc module `.js` xuất object) với schema cố định. Thêm nội dung không sửa code `sim/`.

```
content/
  blocks.json         id block
  items.json          vật phẩm, công cụ, vũ khí, thức ăn
  recipes.json        công thức chế tạo
  regions/            một file mỗi vùng
  mobs/               một file mỗi loại quái
  bosses/             một file mỗi boss
  npcs/               một file mỗi NPC (kèm hội thoại)
  quests/             một file mỗi nhiệm vụ
  loot.json           bảng rơi đồ dùng chung
```

**Vùng (`regions/<id>.json`)**

```json
{
  "id": "rung-ngu",
  "name": "Rừng Ngũ Hành",
  "terrain": { "base": "co", "noise": { "scale": 0.02, "amp": 18 }, "trees": 0.04 },
  "palette": { "sky": "#8fd3a8", "fog": "#cfe8d5" },
  "spawn": { "day": ["soi-xam", "nai"], "night": ["ma-rung"], "density": 0.6 },
  "danger": 2,
  "unlock": { "requires": "boss:thu-lanh-soi" },
  "poi": [{ "type": "lang", "npc": ["tho-ren", "ba-lang"] }, { "type": "dungeon", "boss": "thu-lanh-soi" }]
}
```

**Quái (`mobs/<id>.json`)**

```json
{
  "id": "soi-xam", "hp": 20, "speed": 3.2, "size": [0.8, 1.0, 1.4],
  "ai": "chase-melee",
  "attack": { "dmg": 4, "range": 1.6, "cooldown": 1.2 },
  "sight": 14, "drops": "loot:soi-xam", "model": "soi-xam"
}
```

**Boss (`bosses/<id>.json`)**

```json
{
  "id": "thu-lanh-soi", "hp": 400, "scaleByPlayers": true,
  "arena": { "region": "rung-ngu", "radius": 20 },
  "phases": [
    { "from": 1.0, "ai": "chase-melee", "moves": ["vuot", "tru-ve"] },
    { "from": 0.5, "ai": "chase-melee", "moves": ["vuot", "tru-ve", "goi-dan"], "summon": { "mob": "soi-xam", "count": 3 } },
    { "from": 0.2, "enrage": 1.4 }
  ],
  "reward": ["item:nanh-bac", "unlock:rung-ngu-sau"]
}
```

`scaleByPlayers` nhân HP/sát thương theo số người chơi trong đấu trường (2–5).

**NPC / hội thoại**: đồ thị nút (`id → {text, choices:[{text, goto, if, set}]}`), điều kiện dựa trên cờ `flags`/nhiệm vụ; có cửa hàng (bảng mua/bán) và lịch (đứng ở đâu theo giờ trong ngày).

**Nhiệm vụ**: bước tuần tự hoặc song song; loại bước: `kill`, `collect`, `talk`, `reach`, `defeat-boss`; phần thưởng: vật phẩm, mở vùng, cờ.

**AI (`sim/ai/`)**: thư viện hành vi nhỏ, đăng ký theo tên (`chase-melee`, `ranged-kite`, `wander`, `flee`, `guard`, `boss-script`). Quái và boss chỉ tham chiếu tên + tham số trong JSON.

### 5. Đồng bộ

- **Block**: host phát sự kiện tin cậy `{x,y,z,blockId}`; người vào sau nhận seed + toàn bộ delta (nén), rồi nhận sự kiện tiếp.
- **Người chơi**: client gửi input 20 lần/giây (hướng, nhảy, hành động); client **dự đoán** chuyển động của mình bằng cùng `sim` vật lý, host gửi vị trí chuẩn, client hoà giải nhẹ nếu lệch > ngưỡng.
- **Thực thể khác**: host gửi snapshot 10 lần/giây chỉ cho thực thể trong tầm của từng người; client **nội suy** giữa hai snapshot (đệm ~100 ms).
- **Chia theo tầm**: mỗi client chỉ nhận trạng thái trong bán kính quan tâm (mặc định = tầm nhìn).
- **Băng thông mục tiêu**: < 20 KB/giây/người chơi lúc bình thường (ghi trong stats; vượt thì cảnh báo trong test).

### 6. Lưu và nạp

- Thế giới lưu ở **IndexedDB** của host: `meta` (seed, tên, phiên bản schema, ngày), `delta` (theo chunk), `players` (theo id người chơi), `quests/flags`.
- Mỗi người chơi có **id cục bộ** (ngẫu nhiên, lưu ở localStorage) để host nhận ra họ khi họ vào lại và trả đúng kho đồ.
- Lưu tự động mỗi 30 giây và khi thoát; nút **Xuất thế giới** (file `.json.gz`, dùng `CompressionStream`) và **Nhập thế giới**. Nếu đổi host: host mới nhập file và mở phòng với mã mới.
- **Schema có phiên bản**: nâng cấp từng bước (v1 → v2 ...). Thế giới có phiên bản mới hơn game thì từ chối mở.
- Dùng `platform/core/storage.js` (localStorage) cho cài đặt nhỏ và `STORE_KEY = 'the-gioi-khoi-v1'`; mở rộng nền tảng với một module `platform/core/idb.js` mỏng (get/set/delete theo khoá, giao dịch) vì localStorage không đủ cho chunk.

### 7. Giao diện và điều khiển

- Điều khiển: WASD di chuyển, chuột nhìn (Pointer Lock), chuột trái đào/đánh, chuột phải đặt/dùng, 1–9 chọn ô nhanh, E kho đồ, T chat, Esc menu, Tab danh sách người chơi, M bản đồ nhỏ. Dùng `bindKeys` của `platform/core/input.js`.
- HUD: máu, đói (tuỳ chọn, v1 có thể bỏ), thanh nhanh, la bàn/toạ độ, nhiệm vụ đang theo dõi, tên và máu người chơi khác.
- Màn hình: menu phòng, kho đồ + chế tạo, hội thoại NPC, cửa hàng, nhật ký nhiệm vụ, bản đồ vùng, bảng kết nối/ping.
- Đường về trang chủ và cài đặt chung dùng `platform/ui/bar.js` và `platform/core/settings.js` như các game khác.
- Văn bản hiển thị bằng tiếng Việt; chuỗi nằm trong `content/` và `ui/strings.js`, không rải trong code.

### 8. Đồ hoạ và âm thanh

- Texture 16×16 gói trong một **atlas** duy nhất, dựng bằng công cụ (`tools/build-atlas.py` hoặc tương đương) từ ô riêng lẻ, để thay từng ô mà không vẽ lại cả atlas.
- **Nguồn art: gói miễn phí là nền, tự thiết kế bổ sung.** Chọn **một** gói làm chuẩn phong cách (ưu tiên CC0, ví dụ Kenney) rồi chỉnh/vẽ thêm ô cho khớp, thay vì trộn nhiều gói khác phong cách. Tự thiết kế dùng cho những thứ gói không có: block đặc trưng từng vùng, boss, biểu tượng nhiệm vụ.
- Mỗi ô/model ghi nguồn trong `art-sources.json` (`file`, `origin: "pack:<tên>" | "custom"`, `license`, `author`); `CREDITS.md` sinh từ file này. Test thất bại nếu có ô thiếu nguồn hoặc license không cho dùng lại (ví dụ NC, hoặc CC-BY-SA mà chưa ghi credit).
- Gói tải về giữ ở thư mục ngoài repo hoặc `art-src/`, không đưa nguyên gói vào `games/`; chỉ đưa ô đã dùng vào atlas.
- Quái/NPC/boss ở v1 là mô hình khối ghép từ hộp (box model) tô theo texture, không xương; hoạt ảnh đơn giản bằng xoay chi theo hàm sin/trạng thái.
- Âm thanh dùng `platform/core/audio.js` (tone/noise): bước chân, đào, đánh, nhận sát thương, boss. Nhạc nền để sau.

## Cấu trúc tệp

```
platform/
  net/
    room.js  transport.js  host-loop.js  ice.js  stats.js
  core/
    idb.js                                  MỚI: lưu dữ liệu lớn
  vendor/
    three.module.js   trystero.min.js        MỚI: chép vào để chạy offline và cố định phiên bản
games/the-gioi-khoi/
  index.html  style.css  meta.js  main.js  CREDITS.md
  world/    blocks.js  noise.js  generate.js  chunk.js  mesher.worker.js  storage.js
  sim/      state.js  step.js  physics.js  combat.js  spawn.js  quests.js  dialogue.js  ai/
  render/   scene.js  atlas.js  models.js  hud.js  screens/
  content/  (xem Mục 4)
  net/      protocol.js  host.js  client.js  prediction.js
tests/
  test_the_gioi_khoi.py                      kiểm thử Playwright
  the_gioi_khoi/                             kiểm thử logic chạy trong trình duyệt
```

`meta.js` giữ nhẹ theo quy ước hiện có: `id`, `title`, `tagline`, `desc`, `tags`, `url`, `progress()` (đọc `STORE_KEY`, ví dụ số vùng đã mở).

## Kiểm thử

Theo kiểu hiện có (Playwright, `tests/`), thêm:

1. **Quy tắc phân lớp**: test duyệt các import của `sim/` và `world/`, thất bại nếu có import Three.js, DOM hay mạng.
2. **Xác định**: cùng seed + cùng chuỗi input cho cùng trạng thái ở hai lần chạy (băm trạng thái sau N tick).
3. **Nội dung**: trình kiểm tra schema + tham chiếu chéo cho toàn bộ `content/`. Thất bại khi: id trùng, tham chiếu không tồn tại (quái trong vùng, vật phẩm rơi, boss trong vùng, bước nhiệm vụ), vật phẩm không có nguồn (không rơi, không chế tạo, không bán), hội thoại cụt, vùng không thể mở.
4. **Mạng**: mở 2–3 tab Playwright, tạo phòng ở tab 1, vào ở tab 2/3, đặt block ở tab 2 và kiểm tra tab 1, 3 thấy; ngắt host và kiểm tra thông báo. Vì WebRTC trong CI đôi khi chập chờn, thêm **transport giả trong bộ nhớ** để test logic đồng bộ không phụ thuộc mạng thật.
5. **Hiệu năng**: kịch bản thử nghiệm đo (a) FPS khi dựng 6×6 chunk, (b) thời gian một tick với 40 quái và 5 người chơi giả, (c) byte/giây mỗi người. Có ngưỡng; vượt thì test báo (cảnh báo ở v1, lỗi sau khi ổn định).
6. **Lưu/nạp**: lưu, tải lại, nạp và so sánh; nâng cấp schema từ file mẫu cũ; xuất rồi nhập.
7. **Đường về trang chủ và lỗi console**: dùng bài `test_every_game_meta_is_complete_and_loads` sẵn có.

## Rủi ro

| Rủi ro | Biện pháp |
|---|---|
| Hiệu năng dựng chunk trên máy yếu | Worker, tầm nhìn tự giảm, đo từ bước đầu; ngưỡng FPS trong test |
| Host rớt mạng/thoát giữa chừng | Lưu tự động; client giữ bản sao delta gần nhất để nhập sang host mới (v1.1) |
| Kết nối WebRTC thất bại sau NAT | TURN, hiển thị nguyên nhân, thử lại |
| Relay signaling công cộng ngừng/chậm | Thư viện cho phép nhiều relay; `transport.js` cho phép thay |
| Tab host bị trình duyệt throttle | Cảnh báo, dùng Web Worker chạy tick nếu cần (xem Câu hỏi mở) |
| Phạm vi phình to | Chỉ 1 vùng + 1 boss ở v1; mở thêm khi bản chơi được đã ổn |
| Gian lận từ host | Chấp nhận ở A5; ghi rõ trong README |
| Giấy phép art | `art-sources.json` + `CREDITS.md` sinh tự động; test chặn license không phù hợp |
| Art lệch phong cách khi kết hợp gói + tự vẽ | Một gói chuẩn, bảng màu giới hạn, tự vẽ theo cùng bảng màu và độ phân giải |

## Lối thoát lên server thật

Vì `sim/` thuần và không biết gì về mạng, có thể chạy nguyên `sim/` + `host-loop.js` trong Node (một process nhỏ) và để mọi người chơi là client. Giao thức `net/protocol.js` giữ nguyên. Việc này **không làm trong v1**, nhưng kiến trúc không được chặn nó.

## Mốc bàn giao (đề xuất, để lập plan)

| Mốc | Nội dung | Kiểm chứng |
|---|---|---|
| M1 | `platform/net/` + trang thử phòng (mã phòng, danh sách người, gửi tin) | Test mạng 2–3 tab; đo ping, tỉ lệ kết nối |
| M2 | Thế giới đơn: sinh chunk, mesh worker, đi lại, đào/đặt | Test xác định; FPS đạt ngưỡng |
| M3 | Ghép mạng: host/client, đồng bộ block và người chơi | Test 3 tab; băng thông trong ngưỡng |
| M4 | Thực thể + AI + chiến đấu + chết/hồi sinh | Test tick budget; test xác định |
| M5 | Khung nội dung + trình kiểm tra + NPC/hội thoại/nhiệm vụ | Test nội dung |
| M6 | Vùng 1 + boss 1 chơi được từ đầu đến cuối | Playtest 3–5 người |
| M7 | Lưu/nạp/xuất/nhập, cài đặt, đăng ký vào hub | Test lưu/nạp; test hub |

M1 là điểm quyết định: nếu kết nối P2P không đủ ổn định với nhóm thật, quay lại cân nhắc server.

## Câu hỏi mở

1. ~~Chủ đề~~ **Đã chốt (2026-10-16): giả tưởng chung**, không dùng bối cảnh Việt Nam. Tên game, vùng, quái, NPC đặt theo hướng giả tưởng; tên "Thế Giới Khối" vẫn là tên tạm.
2. Chạy tick host bằng Web Worker hay trên luồng chính? (Worker tránh bị throttle nhưng khó dùng chung state với render; quyết định sau M3.)
3. ~~Texture~~ **Đã chốt (2026-10-16): dùng gói miễn phí, có thể kết hợp tự thiết kế.** Xem mục "Đồ hoạ và âm thanh".
4. Thế giới có "đói", độ bền công cụ, nhiều tầng hầm mỏ không? Mặc định v1: không đói, có độ bền, một tầng hang động.
5. Số người tối đa mỗi phòng là 5 hay có thể thấp hơn (4) để dễ đảm bảo hiệu năng host?

## Kết quả M1 (đo một phần, 2026-10-16)

| Lượt | Thiết bị/mạng | Nối được | Ping | Ghi chú |
|---|---|---|---|---|
| Tự động | 2 trình duyệt Chromium headless cùng một máy, tracker công cộng của Trystero (`@trystero-p2p/torrent` 0.26.0) | 2/2 sau 3,4 giây | 0–1 ms | Chấm di chuyển đồng bộ; nhận 0,3 KB/s, gửi 0,7 KB/s với 2 người |

**Chưa đo:** nhiều thiết bị khác mạng (ví dụ điện thoại 4G), 3–5 người, tỉ lệ thành công qua nhiều lượt, nhu cầu TURN. Cần HTTPS (đẩy nhánh lên GitHub Pages) và người thật; chưa có quyết định "tiếp tục P2P" cho tới khi đo xong.
