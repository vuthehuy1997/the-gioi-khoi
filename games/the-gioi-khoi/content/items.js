// Vật phẩm. block: tên block đặt được. tool: { type, tier, speed } (tốc độ đào nhân lên). dmg: sát thương vũ khí. heal: hồi máu khi ăn.
// Thức ăn: food (điểm đói, 0..20), fx: { id, secs } (hiệu ứng), risk: { poison: p } (đồ sống có xác suất ngộ độc). plant: loại cây gieo được (hạt, củ).
// Dữ liệu thuần; tên hiển thị tiếng Việt nằm ở name.
const blk = (name, vi) => [name, { name: vi, block: name }];
const TIER = { 1: 'gỗ', 2: 'đá', 3: 'tinh thể', 4: 'ngọc' }, KIND = { pick: 'Cuốc', axe: 'Rìu', shovel: 'Xẻng', sword: 'Kiếm', hoe: 'Cuốc đất' };
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
  ['meat', { name: 'Thịt', heal: 5, food: 3, risk: { poison: 0.25 } }], ['herb', { name: 'Thảo dược', heal: 8, food: 2 }],
  ['fang', { name: 'Nanh sói' }], ['bone', { name: 'Xương' }], ['venom', { name: 'Nọc độc' }], ['shard', { name: 'Mảnh băng' }],
  ['mushroom', { name: 'Nấm phát sáng', heal: 3, food: 2 }], ['frog_leg', { name: 'Đùi ếch', heal: 4, food: 2 }], ['stew', { name: 'Súp nấm', heal: 14, food: 10 }],
  ['scale', { name: 'Vảy cá sấu' }], ['ember', { name: 'Than hồng' }], ['silk', { name: 'Tơ pha lê' }], ['pelt', { name: 'Da cáo' }],
  ['wolf_heart', { name: 'Tim Thủ Lĩnh Sói' }], ['scorpion_crown', { name: 'Vương miện Bọ Cạp' }], ['frost_core', { name: 'Lõi Băng Đế' }],
  ['swamp_heart', { name: 'Tim Chúa Đầm Lầy' }], ['magma_core', { name: 'Lõi Nham Thạch' }], ['guardian_prism', { name: 'Lăng kính Hộ Vệ' }],
  blk('iron_ore', 'Quặng sắt'), blk('furnace', 'Lò nung'), blk('anvil', 'Đe rèn'), blk('chest', 'Rương'), blk('bed', 'Giường'), blk('door', 'Cửa gỗ'), blk('torch', 'Đuốc'), blk('glass', 'Kính'), blk('stone_brick', 'Gạch đá'),
  ['iron_ingot', { name: 'Thỏi sắt' }], ['charcoal', { name: 'Than củi' }], ['chitin', { name: 'Vỏ bọ cạp' }], ['cooked_meat', { name: 'Thịt nướng', heal: 11, food: 8 }],
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
  tool('wood_hoe', 'hoe', 1, 1, 1), tool('stone_hoe', 'hoe', 2, 1, 2), ['iron_hoe', { name: 'Cuốc đất sắt', tool: { type: 'hoe', tier: 3, speed: 1 }, dmg: 3, stack: 1, color: '#b7bcc4' }],
  ['shears', { name: 'Kéo', dmg: 1, stack: 1, color: '#b7bcc4' }],
  // trồng trọt và nuôi thú: hạt/củ gieo được (plant), nông sản, sản phẩm của thú
  ['wheat_seed', { name: 'Hạt lúa mì', plant: 'wheat' }], ['wheat', { name: 'Lúa mì' }],
  ['carrot', { name: 'Cà rốt', heal: 1, food: 3, plant: 'carrot' }], ['potato', { name: 'Khoai tây', heal: 0, food: 1, plant: 'potato' }],
  ['egg', { name: 'Trứng', heal: 1, food: 2 }], ['wool', { name: 'Len' }],
  ['pork', { name: 'Thịt lợn', heal: 4, food: 3, risk: { poison: 0.25 } }], ['chicken', { name: 'Thịt gà', heal: 3, food: 2, risk: { poison: 0.4 } }],
  // nấu ở lò nung
  ['bread', { name: 'Bánh mì', heal: 2, food: 6 }], ['baked_potato', { name: 'Khoai nướng', heal: 2, food: 5 }],
  ['cooked_pork', { name: 'Thịt lợn nướng', heal: 8, food: 8 }], ['cooked_chicken', { name: 'Gà nướng', heal: 6, food: 6 }],
  ['veg_soup', { name: 'Súp rau', heal: 3, food: 9, fx: { id: 'regen', secs: 45 } }],
  ['hearty_stew', { name: 'Thịt hầm', heal: 4, food: 12, fx: { id: 'power', secs: 120 } }],
  ['egg_cake', { name: 'Bánh trứng', heal: 2, food: 8, fx: { id: 'tough', secs: 120 } }],
  tool('wood_sword', 'sword', 1, 1, 4), tool('stone_sword', 'sword', 2, 1, 5), tool('crystal_sword', 'sword', 3, 1, 7), tool('gem_sword', 'sword', 4, 1, 10),
].map(([id, d]) => [id, { id, stack: 64, ...d }]));

export const HAND_DAMAGE = 1;
