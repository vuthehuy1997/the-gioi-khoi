// NPC và hội thoại dạng đồ thị. Mỗi nút: text và choices [{ text, goto?, if?, do? }]; choices rỗng hoặc goto null là kết thúc.
// if: { flag } | { noflag } | { quest: id, state: none|active|ready|done } | { has: { item, n } }
// do: [{ accept: id } | { turnin: id } | { give: { item, n } } | { setflag: tên } | { shop: id }]
export const NPCS = {
  'truong-lang': {
    name: 'Trưởng Làng Mộc', village: 'khoi-dau', color: '#c9a35a',
    start: 'hi',
    nodes: {
      hi: { text: 'Chào lữ khách! Vùng Rừng Sương này không yên ổn khi đêm xuống. Bạn cần gì ở làng?', choices: [
        { text: 'Cho tôi một việc để làm.', goto: 'jobs' },
        { text: 'Tôi muốn trả nhiệm vụ.', goto: 'turnin', if: { anyReady: true } },
        { text: 'Kể tôi nghe về vùng đất này.', goto: 'lore' },
        { text: 'Tạm biệt.', goto: null },
      ] },
      jobs: { text: 'Chúng tôi đang cần người giúp đỡ.', choices: [
        { text: 'Nhận: Chào làng (chặt gỗ, chế tạo cuốc gỗ).', do: [{ accept: 'chao-lang' }], goto: 'ok', if: { quest: 'chao-lang', state: 'none' } },
        { text: 'Nhận: Săn sói đêm.', do: [{ accept: 'san-soi' }], goto: 'ok', if: { quest: 'san-soi', state: 'none', requires: true } },
        { text: 'Nhận: Hạ Thủ Lĩnh Sói.', do: [{ accept: 'diet-thu-linh' }], goto: 'ok', if: { quest: 'diet-thu-linh', state: 'none', requires: true } },
        { text: 'Nhận: Nấm của đầm lầy.', do: [{ accept: 'dam-lay-nam' }], goto: 'ok', if: { quest: 'dam-lay-nam', state: 'none', requires: true } },
        { text: 'Nhận: Chúa của đầm lầy.', do: [{ accept: 'diet-chua-dam' }], goto: 'ok', if: { quest: 'diet-chua-dam', state: 'none', requires: true } },
        { text: 'Quay lại.', goto: 'hi' },
      ] },
      turnin: { text: 'Bạn đã làm xong? Để tôi xem.', choices: [
        { text: 'Trả: Nấm của đầm lầy.', do: [{ turnin: 'dam-lay-nam' }], goto: 'thanks', if: { quest: 'dam-lay-nam', state: 'ready' } },
        { text: 'Trả: Chúa của đầm lầy.', do: [{ turnin: 'diet-chua-dam' }], goto: 'thanks', if: { quest: 'diet-chua-dam', state: 'ready' } },
        { text: 'Trả: Chào làng.', do: [{ turnin: 'chao-lang' }], goto: 'thanks', if: { quest: 'chao-lang', state: 'ready' } },
        { text: 'Trả: Săn sói đêm.', do: [{ turnin: 'san-soi' }], goto: 'thanks', if: { quest: 'san-soi', state: 'ready' } },
        { text: 'Trả: Hạ Thủ Lĩnh Sói.', do: [{ turnin: 'diet-thu-linh' }], goto: 'thanks', if: { quest: 'diet-thu-linh', state: 'ready' } },
        { text: 'Quay lại.', goto: 'hi' },
      ] },
      ok: { text: 'Cảm ơn bạn. Cứ làm xong rồi quay lại báo tôi nhé.', choices: [{ text: 'Được.', goto: null }] },
      thanks: { text: 'Quá tốt! Đây là phần thưởng của bạn.', choices: [{ text: 'Cảm ơn.', goto: null }] },
      lore: { text: 'Phía đông là Sa Mạc Lửa, xa hơn nữa là Núi Băng. Nhưng Thủ Lĩnh Sói giữ ngã đường; chưa hạ hắn thì khí độc sa mạc sẽ gặm mòn bạn.', choices: [{ text: 'Tôi hiểu.', goto: 'hi' }] },
    },
  },
  'tho-ren': {
    name: 'Thợ Rèn Đá', village: 'khoi-dau', color: '#8a6b5a',
    start: 'hi',
    nodes: {
      hi: { text: 'Lửa lò đang nóng. Cần mua dụng cụ hay có quặng bán không?', choices: [
        { text: 'Cho tôi xem hàng.', do: [{ shop: 'tho-ren' }], goto: null },
        { text: 'Có việc nào cho tôi không?', goto: 'job' },
        { text: 'Trả nhiệm vụ.', do: [{ turnin: 'quang-tinh-the' }], goto: 'thanks', if: { quest: 'quang-tinh-the', state: 'ready' } },
        { text: 'Tạm biệt.', goto: null },
      ] },
      job: { text: 'Tôi cần ba tinh thể từ mỏ sâu. Phải có cuốc đá mới đào được.', choices: [
        { text: 'Tôi sẽ lo.', do: [{ accept: 'quang-tinh-the' }], goto: null, if: { quest: 'quang-tinh-the', state: 'none', requires: true } },
        { text: 'Để sau.', goto: 'hi' },
      ] },
      thanks: { text: 'Tinh thể đẹp lắm! Cuốc này là của bạn.', choices: [{ text: 'Cảm ơn.', goto: null }] },
    },
  },
  'thuong-nhan': {
    name: 'Thương Nhân Ốc Đảo', village: 'oc-dao', color: '#d9a441',
    start: 'hi',
    nodes: {
      hi: { text: 'Nắng gắt hôm nay! Mua gì cho đỡ khát nào?', choices: [
        { text: 'Xem hàng.', do: [{ shop: 'thuong-nhan' }], goto: null },
        { text: 'Có việc gì không?', goto: 'job' },
        { text: 'Trả nhiệm vụ.', do: [{ turnin: 'nguoi-lanh-sa-mac' }], goto: 'thanks', if: { quest: 'nguoi-lanh-sa-mac', state: 'ready' } },
        { text: 'Trả: Than hồng của núi lửa.', do: [{ turnin: 'than-lua' }], goto: 'thanks', if: { quest: 'than-lua', state: 'ready' } },
        { text: 'Trả: Vua của dung nham.', do: [{ turnin: 'diet-vua-lua' }], goto: 'thanks', if: { quest: 'diet-vua-lua', state: 'ready' } },
        { text: 'Tạm biệt.', goto: null },
      ] },
      job: { text: 'Bọ cạp làm tôi mất khách. Hạ vài con và mang nọc độc về, tôi trả công hậu hĩnh.', choices: [
        { text: 'Nhận việc.', do: [{ accept: 'nguoi-lanh-sa-mac' }], goto: null, if: { quest: 'nguoi-lanh-sa-mac', state: 'none' } },
        { text: 'Nhận: lấy than hồng từ núi lửa (thù lao cao, nhiều nguy hiểm).', do: [{ accept: 'than-lua' }], goto: null, if: { quest: 'than-lua', state: 'none' } },
        { text: 'Nhận: hạ Vua Nham Thạch (nguy hiểm nhất núi lửa).', do: [{ accept: 'diet-vua-lua' }], goto: null, if: { quest: 'diet-vua-lua', state: 'none', requires: true } },
        { text: 'Để sau.', goto: 'hi' },
      ] },
      thanks: { text: 'Gọn gàng! Xu của bạn đây.', choices: [{ text: 'Cảm ơn.', goto: null }] },
    },
  },
  'an-si': {
    name: 'Ẩn Sĩ Tuyết', village: 'tram-bang', color: '#cfe3f5',
    start: 'hi',
    nodes: {
      hi: { text: 'Gió núi lạnh, nhưng lời nguyền của Băng Đế còn lạnh hơn.', choices: [
        { text: 'Lời nguyền là gì?', goto: 'curse' },
        { text: 'Tôi muốn giúp.', do: [{ accept: 'hoi-sinh-bang' }], goto: null, if: { quest: 'hoi-sinh-bang', state: 'none' } },
        { text: 'Trả nhiệm vụ.', do: [{ turnin: 'hoi-sinh-bang' }], goto: 'thanks', if: { quest: 'hoi-sinh-bang', state: 'ready' } },
        { text: 'Tôi thấy ánh tím ở phía xa...', do: [{ accept: 'pha-le-tim' }], goto: null, if: { quest: 'pha-le-tim', state: 'none' } },
        { text: 'Trả: Ánh tím của vực sâu.', do: [{ turnin: 'pha-le-tim' }], goto: 'thanks', if: { quest: 'pha-le-tim', state: 'ready' } },
        { text: 'Kẻ canh giữ vực pha lê là ai?', do: [{ accept: 'diet-ho-ve' }], goto: null, if: { quest: 'diet-ho-ve', state: 'none', requires: true } },
        { text: 'Trả: Kẻ canh giữ pha lê.', do: [{ turnin: 'diet-ho-ve' }], goto: 'thanks', if: { quest: 'diet-ho-ve', state: 'ready' } },
        { text: 'Tạm biệt.', goto: null },
      ] },
      curse: { text: 'Băng Đế đóng băng cả đỉnh núi. Chỉ ai đủ mạnh mới hạ được hắn. Hãy đem theo bạn bè.', choices: [{ text: 'Tôi hiểu.', goto: 'hi' }] },
      thanks: { text: 'Đỉnh núi đã tan băng. Thanh kiếm này xứng với bạn.', choices: [{ text: 'Cảm ơn.', goto: null }] },
    },
  },
  'ngu-dan': {
    name: 'Ngư Dân Đầm Lầy', village: 'xom-lau', color: '#6b8a3a',
    start: 'hi',
    nodes: {
      hi: { text: 'Suỵt, nói khẽ thôi. Cá sấu nghe thấy là phiền lắm. Bạn cần gì?', choices: [
        { text: 'Xem hàng.', do: [{ shop: 'ngu-dan' }], goto: null },
        { text: 'Đầm lầy này có gì đáng sợ?', goto: 'lore' },
        { text: 'Tạm biệt.', goto: null },
      ] },
      lore: { text: 'Ếch độc và rắn thì tránh được. Còn Chúa Đầm Lầy ở sân đá giữa đầm thì không: nó nhảy rất xa và gọi cả bầy ếch. Đem súp nấm theo mà ăn.', choices: [{ text: 'Cảm ơn.', goto: 'hi' }] },
    },
  },
  'tho-lua': {
    name: 'Thợ Lò Nham Thạch', village: 'trai-lua', color: '#c4501e',
    start: 'hi',
    nodes: {
      hi: { text: 'Nóng chứ? Quen đi. Đừng đứng trên đá nham thạch quá lâu là được.', choices: [
        { text: 'Xem hàng.', do: [{ shop: 'tho-lua' }], goto: null },
        { text: 'Nói tôi nghe về ngọn núi.', goto: 'lore' },
        { text: 'Tạm biệt.', goto: null },
      ] },
      lore: { text: 'Than hồng ở đây nhiều vô kể, nhưng Vua Nham Thạch trấn giữ đỉnh núi. Khi hắn đập xuống thì sân rung cả lên, nhìn vòng báo hiệu mà chạy ra ngoài.', choices: [{ text: 'Cảm ơn.', goto: 'hi' }] },
    },
  },
  'hoc-gia': {
    name: 'Học Giả Pha Lê', village: 'to-pha-le', color: '#8a6ac0',
    start: 'hi',
    nodes: {
      hi: { text: 'Ồ, một vị khách hiếm hoi! Ánh tím này không phải ma thuật, chỉ là thạch anh thôi.', choices: [
        { text: 'Xem hàng.', do: [{ shop: 'hoc-gia' }], goto: null },
        { text: 'Hộ Vệ Pha Lê là gì?', goto: 'lore' },
        { text: 'Tạm biệt.', goto: null },
      ] },
      lore: { text: 'Một khối đá được thổi hồn từ thuở xa xưa, chậm nhưng cực đau. Nhện của nó giăng tơ quanh sân. Đừng để bị vây, và nhớ đem bạn bè đi cùng.', choices: [{ text: 'Cảm ơn.', goto: 'hi' }] },
    },
  },
};

// Làng: vùng đặt và NPC sinh ra ở đó. buildHuts: số nhà.
export const VILLAGES = {
  'khoi-dau': { name: 'Làng Mộc', region: 'rung-suong', huts: 2, nearSpawn: true },
  'oc-dao': { name: 'Ốc Đảo', region: 'sa-mac-lua', huts: 1 },
  'tram-bang': { name: 'Trạm Băng', region: 'nui-bang', huts: 1 },
  'xom-lau': { name: 'Xóm Lau Sậy', region: 'dam-lay', huts: 1 },
  'trai-lua': { name: 'Trại Lửa', region: 'hoa-son', huts: 1 },
  'to-pha-le': { name: 'Tổ Pha Lê', region: 'vuc-pha-le', huts: 1 },
};
