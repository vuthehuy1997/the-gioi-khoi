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
};
