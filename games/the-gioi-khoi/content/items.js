// Vật phẩm. block: tên block đặt được. tool: { type, tier, speed } (tốc độ đào nhân lên). dmg: sát thương vũ khí. heal: hồi máu khi ăn.
// Dữ liệu thuần; tên hiển thị tiếng Việt nằm ở name.
const blk = (name, vi) => [name, { name: vi, block: name }];
const TIER = { 1: 'gỗ', 2: 'đá', 3: 'tinh thể', 4: 'ngọc' }, KIND = { pick: 'Cuốc', axe: 'Rìu', shovel: 'Xẻng', sword: 'Kiếm' };
// Trang bị: 4 món mỗi bộ (mũ, áo, quần, giày). def = điểm giáp; resist = loại môi trường chống được (heat | cold | toxic); color dùng cho icon.
const ARMOR_SETS = {
  fur: { name: 'lông thú', color: '#b98b5a', resist: 'cold', def: [1, 3, 2, 1] },
  chitin: { name: 'vỏ bọ cạp', color: '#c8742a', resist: 'heat', def: [2, 4, 3, 2] },
  iron: { name: 'sắt', color: '#b7bcc4', def: [2, 5, 4, 2] },
  scale: { name: 'vảy cá sấu', color: '#4b8a4a', resist: 'toxic', def: [3, 5, 4, 2] },
  ember: { name: 'than hồng', color: '#e0561c', resist: 'heat', def: [3, 6, 5, 3] },
  crystal: { name: 'pha lê', color: '#a77bff', resist: 'cold', def: [4, 7, 6, 4] },
};
const PIECES = [['helm', 'head', 'Mũ'], ['chest', 'chest', 'Áo giáp'], ['legs', 'legs', 'Quần giáp'], ['boots', 'feet', 'Giày']];
const armor = Object.entries(ARMOR_SETS).flatMap(([set, o]) => PIECES.map(([key, slot, vi], i) =>
  [`${set}_${key}`, { name: `${vi} ${o.name}`, stack: 1, color: o.color, armor: { set, slot, def: o.def[i], resist: o.resist, fireproof: set === 'ember' && key === 'boots' || undefined } }]));
const named = (id, name, type, tier, speed, dmg, extra = {}) => [id, { name, tool: { type, tier, speed }, dmg, stack: 1, ...extra }];
const tool = (name, type, tier, speed, dmg) => [name, { name: `${KIND[type]} ${TIER[tier]}`, tool: { type, tier, speed }, dmg, stack: 1 }];

export const ITEMS = Object.fromEntries([
  blk('stone', 'Đá'), blk('dirt', 'Đất'), blk('sand', 'Cát'), blk('snow', 'Tuyết'), blk('log', 'Thân gỗ'), blk('leaves', 'Lá'),
  blk('planks', 'Ván gỗ'), blk('cactus', 'Xương rồng'), blk('ice', 'Băng'), blk('magma', 'Đá nham thạch'), blk('workbench', 'Bàn chế tạo'), blk('mud', 'Bùn'), blk('ash', 'Tro núi lửa'), blk('basalt', 'Đá bazan'),
  ['crystal', { name: 'Tinh thể' }], ['amethyst', { name: 'Thạch anh tím' }], ['gem', { name: 'Ngọc' }], ['stick', { name: 'Gậy' }],
  ['xu', { name: 'Xu', stack: 999 }],
  ['meat', { name: 'Thịt', heal: 5 }], ['herb', { name: 'Thảo dược', heal: 8 }],
  ['fang', { name: 'Nanh sói' }], ['bone', { name: 'Xương' }], ['venom', { name: 'Nọc độc' }], ['shard', { name: 'Mảnh băng' }],
  ['mushroom', { name: 'Nấm phát sáng', heal: 3 }], ['frog_leg', { name: 'Đùi ếch', heal: 4 }], ['stew', { name: 'Súp nấm', heal: 14 }],
  ['scale', { name: 'Vảy cá sấu' }], ['ember', { name: 'Than hồng' }], ['silk', { name: 'Tơ pha lê' }], ['pelt', { name: 'Da cáo' }],
  ['wolf_heart', { name: 'Tim Thủ Lĩnh Sói' }], ['scorpion_crown', { name: 'Vương miện Bọ Cạp' }], ['frost_core', { name: 'Lõi Băng Đế' }],
  ['swamp_heart', { name: 'Tim Chúa Đầm Lầy' }], ['magma_core', { name: 'Lõi Nham Thạch' }], ['guardian_prism', { name: 'Lăng kính Hộ Vệ' }],
  blk('iron_ore', 'Quặng sắt'), blk('furnace', 'Lò nung'), blk('anvil', 'Đe rèn'), blk('chest', 'Rương'), blk('bed', 'Giường'), blk('door', 'Cửa gỗ'), blk('torch', 'Đuốc'), blk('glass', 'Kính'), blk('stone_brick', 'Gạch đá'),
  ['iron_ingot', { name: 'Thỏi sắt' }], ['charcoal', { name: 'Than củi' }], ['chitin', { name: 'Vỏ bọ cạp' }], ['cooked_meat', { name: 'Thịt nướng', heal: 11 }],
  named('iron_pick', 'Cuốc sắt', 'pick', 2, 4.5, 4, { color: '#b7bcc4' }), named('iron_axe', 'Rìu sắt', 'axe', 2, 4.5, 5, { color: '#b7bcc4' }),
  named('iron_shovel', 'Xẻng sắt', 'shovel', 2, 4.5, 3, { color: '#b7bcc4' }), named('iron_sword', 'Kiếm sắt', 'sword', 2, 1, 6, { color: '#b7bcc4' }),
  // vũ khí di vật: rèn từ chiến lợi phẩm của boss
  named('wolf_blade', 'Kiếm Nanh Sói', 'sword', 3, 1, 9, { relic: true, color: '#c9ced6' }), named('scorpion_blade', 'Dao Bọ Cạp Chúa', 'sword', 3, 1, 10, { relic: true, color: '#e0912e' }),
  named('frost_axe', 'Rìu Băng Đế', 'axe', 3, 5, 11, { relic: true, color: '#7fd4ff' }), named('swamp_club', 'Chùy Chúa Đầm Lầy', 'sword', 3, 1, 11, { relic: true, color: '#5a9a3a' }),
  named('magma_blade', 'Kiếm Nham Thạch', 'sword', 4, 1, 13, { relic: true, color: '#ff6a1a' }), named('prism_blade', 'Kiếm Lăng Kính', 'sword', 4, 1, 14, { relic: true, color: '#d8a8ff' }),
  ...armor,
  tool('wood_pick', 'pick', 1, 2, 2), tool('stone_pick', 'pick', 2, 3.5, 3), tool('crystal_pick', 'pick', 3, 5, 4),
  tool('wood_axe', 'axe', 1, 2, 3), tool('stone_axe', 'axe', 2, 3.5, 4),
  tool('wood_shovel', 'shovel', 1, 2, 2), tool('stone_shovel', 'shovel', 2, 3.5, 3),
  ['ember_sword', { name: 'Kiếm than hồng', tool: { type: 'sword', tier: 3, speed: 1 }, dmg: 9, stack: 1 }],
  ['amethyst_pick', { name: 'Cuốc thạch anh', tool: { type: 'pick', tier: 3, speed: 5.5 }, dmg: 4, stack: 1 }],
  tool('wood_sword', 'sword', 1, 1, 4), tool('stone_sword', 'sword', 2, 1, 5), tool('crystal_sword', 'sword', 3, 1, 7), tool('gem_sword', 'sword', 4, 1, 10),
].map(([id, d]) => [id, { id, stack: 64, ...d }]));

export const HAND_DAMAGE = 1;
