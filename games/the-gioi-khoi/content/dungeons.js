// Hầm ngục theo vùng: dữ liệu thuần (bố cục hình học nằm ở sim/dungeon.js). Mỗi vùng một hầm, chung một khuôn: sảnh, phòng canh gác, phòng bẫy, phòng chủ.
// traps: loại bẫy của ba chặng phòng bẫy theo thứ tự đi vào (spike gai sàn | dart tấm áp lực + ống tên | vent ống phun). mats: vật liệu thưởng chủ đề.
export const DUNGEONS = {
  'ham-re-muc': { name: 'Hầm Rễ Mục', region: 'rung-suong', theme: 're-muc', boss: 'ham-chu-re-muc', mobs: ['xac-song', 'soi-xam', 'xuong-cung'], traps: ['dart', 'spike', 'dart'], mats: ['herb', 'bone'], armor: 'fur' },
  'ham-cat-chon': { name: 'Hầm Cát Chôn', region: 'sa-mac-lua', theme: 'cat-chon', boss: 'ham-chu-cat-chon', mobs: ['bo-cap', 'xuong-cung'], traps: ['spike', 'vent', 'spike'], mats: ['chitin', 'venom'], armor: 'chitin' },
  'ham-bang-gia': { name: 'Hầm Băng Giá', region: 'nui-bang', theme: 'bang-gia', boss: 'ham-chu-bang-gia', mobs: ['gau-bang', 'ma-bang'], traps: ['vent', 'dart', 'vent'], mats: ['shard', 'pelt'], armor: 'fur' },
  'ham-bun-lay': { name: 'Hầm Bùn Lầy', region: 'dam-lay', theme: 'bun-lay', boss: 'ham-chu-bun-lay', mobs: ['ech-doc', 'ran-lay', 'ca-sau'], traps: ['spike', 'spike', 'vent'], mats: ['scale', 'frog_leg'], armor: 'scale' },
  'ham-tro-tan': { name: 'Hầm Tro Tàn', region: 'hoa-son', theme: 'tro-tan', boss: 'ham-chu-tro-tan', mobs: ['than-lan-nham', 'linh-hoa'], traps: ['vent', 'vent', 'dart'], mats: ['ember'], armor: 'ember' },
  'ham-lang-kinh': { name: 'Hầm Lăng Kính', region: 'vuc-pha-le', theme: 'lang-kinh', boss: 'ham-chu-lang-kinh', mobs: ['nhen-pha-le', 'ma-bang', 'khoi-pha-le'], traps: ['dart', 'vent', 'dart'], mats: ['amethyst', 'silk'], armor: 'crystal' },
};

// Chủ đề dựng: floor/pillar là tên block có sẵn (sàn, cột); accent lát miệng hầm.
export const THEMES = {
  're-muc': { floor: 'moss', pillar: 'log', accent: 'stone_brick' }, 'cat-chon': { floor: 'sand', pillar: 'stone', accent: 'stone_brick' },
  'bang-gia': { floor: 'ice', pillar: 'ice', accent: 'stone_brick' }, 'bun-lay': { floor: 'mud', pillar: 'log', accent: 'stone_brick' },
  'tro-tan': { floor: 'basalt', pillar: 'basalt', accent: 'stone_brick' }, 'lang-kinh': { floor: 'amethyst', pillar: 'amethyst', accent: 'stone_brick' },
};

// Bẫy: spike (chu kỳ 4,0 s: hạ 1,5 + báo 0,5 + nhô 2,0), dart (tấm áp lực -> ống tên sau delay, hồi cd), vent (chu kỳ 5,0 s: nghỉ 3,2 + báo 1,0 + phun 0,8).
export const TRAP = {
  spike: { period: 4, down: 1.5, warn: 0.5, up: 2.0, dmg: 4, gap: 0.8 },
  dart: { delay: 0.3, cd: 5, dmg: 5, speed: 14 },
  vent: { period: 5, rest: 3.2, warn: 1.0, spray: 0.8, radius: 1.6, dmg: 6, kick: 5 },
};

// Phòng canh gác (P2): đợt 1 = wave1 quái thường; đợt 2 = wave2 quái thường + 1 tượng đá; mỗi người thêm (tối đa +extraMax) cộng 1 quái thường mỗi đợt.
export const GUARD = { wave1: 4, wave2: 3, gap: 2, extraMax: 4, trigger: 5, giveUp: 30, statue: 'tuong-da' };

// Khuôn chung: cổng cần chìa nào, rương nằm ở phòng nào và khi nào mở (cần: p2 đã dọn | boss đã hạ).
export const LAYOUT = {
  rooms: ['p1', 'p2', 'p3', 'p4'],
  gates: { iron: { key: 'dungeon_key', room: 'p2' }, boss: { key: 'boss_key', room: 'p3' } },
  chests: { supply: { room: 'p1' }, victory: { room: 'p2', needs: 'p2' }, trap: { room: 'p3' }, treasure: { room: 'p4', needs: 'boss' } },
};

// Bảng thưởng từng rương (mỗi người nhận riêng một lần). fixed: luôn có. '$mat': vật liệu chủ đề của hầm; '$armor': một món giáp của bộ hầm.
export const LOOT = {
  supply: [{ item: 'xu', min: 10, max: 25, p: 1 }, { item: 'heal_potion', min: 1, max: 2, p: 0.6 }, { item: 'torch', min: 4, max: 8, p: 0.8 }, { item: 'charcoal', min: 2, max: 4, p: 0.5 }],
  victory: [{ item: 'dungeon_key', min: 1, max: 1, p: 1, fixed: true }, { item: 'xu', min: 20, max: 40, p: 1 }, { item: '$mat', min: 2, max: 4, p: 0.7 }, { item: 'heal_potion', min: 1, max: 1, p: 0.5 }],
  trap: [{ item: 'boss_key', min: 1, max: 1, p: 1, fixed: true }, { item: 'xu', min: 30, max: 60, p: 1 }, { item: 'iron_ingot', min: 2, max: 4, p: 0.8 }, { item: 'crystal', min: 1, max: 3, p: 0.6 },
    { item: 'ancient_shard', min: 1, max: 2, p: 0.7 }, { item: '$mat', min: 2, max: 4, p: 0.7 }],
  treasure: [{ item: 'xu', min: 120, max: 200, p: 1 }, { item: 'gem', min: 2, max: 4, p: 1 }, { item: 'ancient_shard', min: 3, max: 5, p: 1 }, { item: 'heal_potion', min: 2, max: 3, p: 1 },
    { item: 'iron_ingot', min: 3, max: 5, p: 0.7 }, { item: '$armor', min: 1, max: 1, p: 0.25 }],
};
export const CHEST_TITLE = { supply: 'Rương tiếp tế', victory: 'Rương chiến thắng', trap: 'Rương cuối phòng bẫy', treasure: 'Rương kho báu' };
