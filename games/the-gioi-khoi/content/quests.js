// Nhiệm vụ. Bước: talk(npc) | collect(item, n) | kill(mob, n) | boss(id) | reach(region). Nhận ở giver, trả ở giver khi mọi bước xong.
// consume: trả nhiệm vụ thì thu lại vật phẩm của bước collect. requires: cờ thế giới hoặc nhiệm vụ đã xong để được nhận.
export const QUESTS = {
  'chao-lang': {
    name: 'Chào làng', giver: 'truong-lang',
    steps: [{ type: 'collect', item: 'log', n: 5, text: 'Chặt 5 thân gỗ' }, { type: 'collect', item: 'wood_pick', n: 1, text: 'Chế tạo một cuốc gỗ (cần đứng gần bàn chế tạo)' }],
    reward: { items: [{ item: 'wood_sword', n: 1 }, { item: 'xu', n: 10 }] },
  },
  'san-soi': {
    name: 'Săn sói đêm', giver: 'truong-lang', requires: { quest: 'chao-lang' },
    steps: [{ type: 'kill', mob: 'soi-xam', n: 3, text: 'Hạ 3 con Sói Xám' }],
    reward: { items: [{ item: 'xu', n: 30 }, { item: 'herb', n: 2 }] },
  },
  'quang-tinh-the': {
    name: 'Tinh thể cho lò rèn', giver: 'tho-ren', requires: { quest: 'chao-lang' },
    steps: [{ type: 'collect', item: 'crystal', n: 3, text: 'Đào 3 tinh thể (cần cuốc đá)' }], consume: true,
    reward: { items: [{ item: 'crystal_pick', n: 1 }, { item: 'xu', n: 20 }] },
  },
  'diet-thu-linh': {
    name: 'Hạ Thủ Lĩnh Sói', giver: 'truong-lang', requires: { quest: 'san-soi' },
    steps: [{ type: 'boss', boss: 'thu-linh-soi', text: 'Hạ Thủ Lĩnh Sói ở đấu trường' }],
    reward: { items: [{ item: 'xu', n: 80 }, { item: 'gem', n: 2 }] },
  },
  'nguoi-lanh-sa-mac': {
    name: 'Nọc độc sa mạc', giver: 'thuong-nhan',
    steps: [{ type: 'kill', mob: 'bo-cap', n: 4, text: 'Hạ 4 Bọ Cạp Lửa' }, { type: 'collect', item: 'venom', n: 2, text: 'Thu 2 nọc độc' }], consume: true,
    reward: { items: [{ item: 'xu', n: 60 }] },
  },
  'hoi-sinh-bang': {
    name: 'Lời nguyền của Băng Đế', giver: 'an-si',
    steps: [{ type: 'reach', region: 'nui-bang', text: 'Đến Núi Băng' }, { type: 'boss', boss: 'bang-de', text: 'Hạ Băng Đế' }],
    reward: { items: [{ item: 'xu', n: 200 }, { item: 'gem_sword', n: 1 }] },
  },
  'dam-lay-nam': {
    name: 'Nấm của đầm lầy', giver: 'truong-lang', requires: { quest: 'chao-lang' },
    steps: [{ type: 'reach', region: 'dam-lay', text: 'Đến Đầm Lầy Mục' }, { type: 'kill', mob: 'ech-doc', n: 3, text: 'Hạ 3 con Ếch Độc' }, { type: 'collect', item: 'mushroom', n: 2, text: 'Hái 2 nấm phát sáng (rơi từ Nấm Lang Thang)' }], consume: true,
    reward: { items: [{ item: 'stew', n: 2 }, { item: 'xu', n: 40 }] },
  },
  'than-lua': {
    name: 'Than hồng của núi lửa', giver: 'thuong-nhan',
    steps: [{ type: 'reach', region: 'hoa-son', text: 'Đến Núi Lửa Tro' }, { type: 'kill', mob: 'than-lan-nham', n: 3, text: 'Hạ 3 Thằn Lằn Nham Thạch' }, { type: 'collect', item: 'ember', n: 3, text: 'Thu 3 than hồng' }], consume: true,
    reward: { items: [{ item: 'xu', n: 90 }, { item: 'crystal', n: 2 }] },
  },
  'pha-le-tim': {
    name: 'Ánh tím của vực sâu', giver: 'an-si',
    steps: [{ type: 'reach', region: 'vuc-pha-le', text: 'Đến Vực Pha Lê' }, { type: 'kill', mob: 'nhen-pha-le', n: 2, text: 'Hạ 2 Nhện Pha Lê' }, { type: 'collect', item: 'amethyst', n: 3, text: 'Thu 3 thạch anh tím' }], consume: true,
    reward: { items: [{ item: 'amethyst_pick', n: 1 }, { item: 'xu', n: 110 }] },
  },
  'diet-chua-dam': {
    name: 'Chúa của đầm lầy', giver: 'truong-lang', requires: { quest: 'dam-lay-nam' },
    steps: [{ type: 'boss', boss: 'chua-dam-lay', text: 'Hạ Chúa Đầm Lầy ở đấu trường trong đầm' }],
    reward: { items: [{ item: 'stew', n: 4 }, { item: 'gem', n: 3 }, { item: 'xu', n: 150 }] },
  },
  'diet-vua-lua': {
    name: 'Vua của dung nham', giver: 'thuong-nhan', requires: { quest: 'than-lua' },
    steps: [{ type: 'boss', boss: 'vua-nham-thach', text: 'Hạ Vua Nham Thạch ở đấu trường trên núi lửa' }],
    reward: { items: [{ item: 'ember_sword', n: 1 }, { item: 'gem', n: 3 }, { item: 'xu', n: 250 }] },
  },
  'diet-ho-ve': {
    name: 'Kẻ canh giữ pha lê', giver: 'an-si', requires: { quest: 'pha-le-tim' },
    steps: [{ type: 'boss', boss: 'ho-ve-pha-le', text: 'Hạ Đại Hộ Vệ Pha Lê ở đấu trường trong vực' }],
    reward: { items: [{ item: 'gem', n: 6 }, { item: 'xu', n: 350 }] },
  },
};
