// Công thức không theo hình dạng. bench: cần đứng gần bàn chế tạo (trong 5 block).
const r = (id, out, inn, bench = false) => ({ id, out: { item: out[0], n: out[1] }, in: inn, bench });
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
  r('herb_meal', ['herb', 1], { meat: 1, leaves: 2 }),
];
