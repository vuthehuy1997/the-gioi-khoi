// Vật phẩm. block: tên block đặt được. tool: { type, tier, speed } (tốc độ đào nhân lên). dmg: sát thương vũ khí. heal: hồi máu khi ăn.
// Dữ liệu thuần; tên hiển thị tiếng Việt nằm ở name.
const blk = (name, vi) => [name, { name: vi, block: name }];
const TIER = { 1: 'gỗ', 2: 'đá', 3: 'tinh thể', 4: 'ngọc' }, KIND = { pick: 'Cuốc', axe: 'Rìu', shovel: 'Xẻng', sword: 'Kiếm' };
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
  tool('wood_pick', 'pick', 1, 2, 2), tool('stone_pick', 'pick', 2, 3.5, 3), tool('crystal_pick', 'pick', 3, 5, 4),
  tool('wood_axe', 'axe', 1, 2, 3), tool('stone_axe', 'axe', 2, 3.5, 4),
  tool('wood_shovel', 'shovel', 1, 2, 2), tool('stone_shovel', 'shovel', 2, 3.5, 3),
  ['ember_sword', { name: 'Kiếm than hồng', tool: { type: 'sword', tier: 3, speed: 1 }, dmg: 9, stack: 1 }],
  ['amethyst_pick', { name: 'Cuốc thạch anh', tool: { type: 'pick', tier: 3, speed: 5.5 }, dmg: 4, stack: 1 }],
  tool('wood_sword', 'sword', 1, 1, 4), tool('stone_sword', 'sword', 2, 1, 5), tool('crystal_sword', 'sword', 3, 1, 7), tool('gem_sword', 'sword', 4, 1, 10),
].map(([id, d]) => [id, { id, stack: 64, ...d }]));

export const HAND_DAMAGE = 1;
