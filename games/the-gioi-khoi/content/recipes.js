// Công thức không theo hình dạng. bench: false (chế ở đâu cũng được), true hoặc 'workbench' (cần đứng gần bàn chế tạo),
// 'furnace' (lò nung: luyện, nấu) hoặc 'anvil' (đe rèn: trang bị và vũ khí). "Gần" = trong 4 block (xem sim/rules.js).
const r = (id, out, inn, bench = false) => ({ id, out: { item: out[0], n: out[1] }, in: inn, bench });
const P = ['helm', 'chest', 'legs', 'boots'];
const set = (name, bench, ...mats) => P.map((k, i) => r(`${name}_${k}`, [`${name}_${k}`, 1], Object.fromEntries(mats.map(([item, n]) => [item, n[i]])), bench));
export const RECIPES = [
  r('planks', ['planks', 4], { log: 1 }),
  r('stick', ['stick', 4], { planks: 2 }),
  r('workbench', ['workbench', 1], { planks: 4 }),
  r('wood_pick', ['wood_pick', 1], { planks: 3, stick: 2 }, true),
  r('wood_axe', ['wood_axe', 1], { planks: 3, stick: 2 }, true),
  r('wood_shovel', ['wood_shovel', 1], { planks: 1, stick: 2 }, true),
  r('wood_sword', ['wood_sword', 1], { planks: 2, stick: 1 }, true),
  r('stone_pick', ['stone_pick', 1], { stone: 3, stick: 2 }, true),
  r('stone_axe', ['stone_axe', 1], { stone: 3, stick: 2 }, true),
  r('stone_shovel', ['stone_shovel', 1], { stone: 1, stick: 2 }, true),
  r('stone_sword', ['stone_sword', 1], { stone: 2, stick: 1 }, true),
  r('crystal_pick', ['crystal_pick', 1], { crystal: 3, stick: 2 }, true),
  r('crystal_sword', ['crystal_sword', 1], { crystal: 2, stick: 1 }, true),
  r('gem_sword', ['gem_sword', 1], { gem: 2, crystal: 1, stick: 1 }, true),
  r('amethyst_pick', ['amethyst_pick', 1], { amethyst: 3, stick: 2 }, true),
  r('ember_sword', ['ember_sword', 1], { ember: 3, crystal: 1, stick: 1 }, true),
  r('stew', ['stew', 1], { mushroom: 2, meat: 1 }),
  r('herb_meal', ['herb', 1], { meat: 1, leaves: 2 }),
  // ---- trạm chế tạo và xây dựng ----
  r('furnace', ['furnace', 1], { stone: 8 }, true),
  r('anvil', ['anvil', 1], { iron_ingot: 6 }, true),
  r('chest', ['chest', 1], { planks: 8 }, true),
  r('door', ['door', 1], { planks: 6 }, true),
  r('bed', ['bed', 1], { planks: 3, pelt: 3 }, true),
  r('bed_wool', ['bed', 1], { planks: 3, wool: 3 }, true),
  r('wood_hoe', ['wood_hoe', 1], { planks: 2, stick: 2 }, true),
  r('stone_hoe', ['stone_hoe', 1], { stone: 2, stick: 2 }, true),
  r('stone_brick', ['stone_brick', 4], { stone: 4 }, true),
  r('torch', ['torch', 4], { stick: 1, charcoal: 1 }),
  // ---- lò nung: luyện quặng, nấu ----
  r('charcoal', ['charcoal', 2], { log: 1 }, 'furnace'),
  r('iron_ingot', ['iron_ingot', 1], { iron_ore: 1, charcoal: 1 }, 'furnace'),
  r('glass', ['glass', 2], { sand: 2, charcoal: 1 }, 'furnace'),
  r('cooked_meat', ['cooked_meat', 1], { meat: 1, charcoal: 1 }, 'furnace'),
  r('bread', ['bread', 1], { wheat: 3, charcoal: 1 }, 'furnace'),
  r('baked_potato', ['baked_potato', 1], { potato: 1, charcoal: 1 }, 'furnace'),
  r('cooked_pork', ['cooked_pork', 1], { pork: 1, charcoal: 1 }, 'furnace'),
  r('cooked_chicken', ['cooked_chicken', 1], { chicken: 1, charcoal: 1 }, 'furnace'),
  r('veg_soup', ['veg_soup', 1], { carrot: 2, potato: 1, herb: 1 }, 'furnace'),
  r('hearty_stew', ['hearty_stew', 1], { pork: 1, potato: 1, carrot: 1, charcoal: 1 }, 'furnace'),
  r('egg_cake', ['egg_cake', 1], { egg: 2, wheat: 2, charcoal: 1 }, 'furnace'),
  // ---- đe rèn: công cụ sắt ----
  r('iron_pick', ['iron_pick', 1], { iron_ingot: 3, stick: 2 }, 'anvil'),
  r('iron_axe', ['iron_axe', 1], { iron_ingot: 3, stick: 2 }, 'anvil'),
  r('iron_shovel', ['iron_shovel', 1], { iron_ingot: 1, stick: 2 }, 'anvil'),
  r('iron_sword', ['iron_sword', 1], { iron_ingot: 2, stick: 1 }, 'anvil'),
  r('iron_hoe', ['iron_hoe', 1], { iron_ingot: 2, stick: 2 }, 'anvil'),
  r('shears', ['shears', 1], { iron_ingot: 2 }, 'anvil'),
  // ---- chiến đấu: cung, mũi tên, khiên, giáo, chùy ----
  r('bow', ['bow', 1], { stick: 3, pelt: 1 }, true),
  r('iron_bow', ['iron_bow', 1], { iron_ingot: 2, stick: 3, pelt: 1 }, 'anvil'),
  r('arrow', ['arrow', 4], { stick: 1, bone: 1 }, true),
  r('wood_shield', ['wood_shield', 1], { planks: 5, stick: 1 }, true),
  r('iron_shield', ['iron_shield', 1], { iron_ingot: 4, planks: 2 }, 'anvil'),
  r('wood_spear', ['wood_spear', 1], { planks: 1, stick: 2 }, true),
  r('stone_spear', ['stone_spear', 1], { stone: 2, stick: 2 }, true),
  r('iron_spear', ['iron_spear', 1], { iron_ingot: 2, stick: 2 }, 'anvil'),
  r('iron_club', ['iron_club', 1], { iron_ingot: 3, stick: 1 }, 'anvil'),
  // ---- trang bị theo vùng: mỗi bộ dùng tài nguyên của một vùng và chống một loại môi trường ----
  ...set('fur', true, ['pelt', [3, 5, 4, 2]]),                                        // Rừng/Núi Băng: chống lạnh
  ...set('chitin', true, ['chitin', [3, 5, 4, 2]]),                                   // Sa Mạc/Núi Lửa: chống nóng
  ...set('iron', 'anvil', ['iron_ingot', [4, 6, 5, 3]]),
  ...set('scale', 'anvil', ['scale', [3, 5, 4, 2]], ['iron_ingot', [1, 2, 2, 1]]),    // Đầm Lầy: chống độc
  ...set('ember', 'anvil', ['ember', [3, 5, 4, 3]], ['iron_ingot', [2, 3, 3, 2]]),    // Núi Lửa: chống nóng, giày đi được trên nham thạch
  ...set('crystal', 'anvil', ['amethyst', [3, 5, 4, 3]], ['silk', [2, 3, 2, 2]]),     // Vực Pha Lê: chống lạnh
  // ---- vũ khí di vật: cần chiến lợi phẩm của boss ----
  r('wolf_blade', ['wolf_blade', 1], { iron_ingot: 2, fang: 4, wolf_heart: 1 }, 'anvil'),
  r('scorpion_blade', ['scorpion_blade', 1], { iron_ingot: 2, chitin: 4, venom: 2, scorpion_crown: 1 }, 'anvil'),
  r('frost_axe', ['frost_axe', 1], { iron_ingot: 3, shard: 4, frost_core: 1, stick: 1 }, 'anvil'),
  r('swamp_club', ['swamp_club', 1], { iron_ingot: 3, scale: 6, swamp_heart: 1, stick: 1 }, 'anvil'),
  r('magma_blade', ['magma_blade', 1], { iron_ingot: 3, ember: 6, magma_core: 1 }, 'anvil'),
  r('prism_blade', ['prism_blade', 1], { gem: 2, amethyst: 6, silk: 4, guardian_prism: 1 }, 'anvil'),
  // ---- đồ cổ vật: Mảnh Cổ Vật lấy từ rương và chủ hầm ngục ----
  r('ancient_pick', ['ancient_pick', 1], { ancient_shard: 5, stick: 2 }, 'anvil'),
  r('delver_blade', ['delver_blade', 1], { ancient_shard: 8, iron_ingot: 2, crystal: 1 }, 'anvil'),
];
