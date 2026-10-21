// Cửa hàng: giá tính bằng xu. sells: người chơi mua; buys: người chơi bán.
export const SHOPS = {
  'tho-ren': {
    name: 'Lò rèn',
    sells: [{ item: 'wood_pick', price: 8 }, { item: 'stone_pick', price: 20 }, { item: 'stone_sword', price: 25 }, { item: 'stone_axe', price: 18 }, { item: 'planks', price: 1 }, { item: 'stick', price: 1 }, { item: 'charcoal', price: 3 }, { item: 'iron_ingot', price: 20 }, { item: 'torch', price: 2 }],
    buys: [{ item: 'stone', price: 1 }, { item: 'crystal', price: 12 }, { item: 'gem', price: 40 }, { item: 'fang', price: 4 }, { item: 'bone', price: 2 }, { item: 'iron_ore', price: 5 }, { item: 'iron_ingot', price: 12 }, { item: 'chitin', price: 5 }],
  },
  'thuong-nhan': {
    name: 'Quầy thương nhân',
    sells: [{ item: 'meat', price: 4 }, { item: 'herb', price: 10 }, { item: 'sand', price: 1 }, { item: 'crystal_pick', price: 60 }],
    buys: [{ item: 'venom', price: 8 }, { item: 'cactus', price: 2 }, { item: 'shard', price: 8 }, { item: 'meat', price: 2 }, { item: 'wolf_heart', price: 60 }, { item: 'swamp_heart', price: 90 }, { item: 'magma_core', price: 110 }, { item: 'guardian_prism', price: 130 }, { item: 'scale', price: 6 }, { item: 'ember', price: 9 }, { item: 'silk', price: 7 }, { item: 'amethyst', price: 6 }, { item: 'pelt', price: 4 }, { item: 'frog_leg', price: 2 }],
  },
  'ngu-dan': {
    name: 'Quầy ngư dân',
    sells: [{ item: 'stew', price: 12 }, { item: 'herb', price: 10 }, { item: 'mushroom', price: 3 }, { item: 'frog_leg', price: 5 }],
    buys: [{ item: 'frog_leg', price: 3 }, { item: 'mushroom', price: 2 }, { item: 'scale', price: 8 }, { item: 'swamp_heart', price: 100 }],
  },
  'tho-lua': {
    name: 'Lò nham thạch',
    sells: [{ item: 'ember', price: 12 }, { item: 'stone_sword', price: 25 }, { item: 'meat', price: 4 }, { item: 'stone_pick', price: 20 }],
    buys: [{ item: 'ember', price: 8 }, { item: 'scale', price: 7 }, { item: 'magma_core', price: 130 }, { item: 'shard', price: 8 }],
  },
  'hoc-gia': {
    name: 'Phòng học giả',
    sells: [{ item: 'amethyst', price: 10 }, { item: 'silk', price: 9 }, { item: 'herb', price: 10 }],
    buys: [{ item: 'amethyst', price: 6 }, { item: 'silk', price: 7 }, { item: 'pelt', price: 5 }, { item: 'guardian_prism', price: 150 }],
  },
};
