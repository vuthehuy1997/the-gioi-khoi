// Cửa hàng: giá tính bằng xu. sells: người chơi mua; buys: người chơi bán.
export const SHOPS = {
  'tho-ren': {
    name: 'Lò rèn',
    sells: [{ item: 'wood_pick', price: 8 }, { item: 'stone_pick', price: 20 }, { item: 'stone_sword', price: 25 }, { item: 'stone_axe', price: 18 }, { item: 'planks', price: 1 }, { item: 'stick', price: 1 }],
    buys: [{ item: 'stone', price: 1 }, { item: 'crystal', price: 12 }, { item: 'gem', price: 40 }, { item: 'fang', price: 4 }, { item: 'bone', price: 2 }],
  },
  'thuong-nhan': {
    name: 'Quầy thương nhân',
    sells: [{ item: 'meat', price: 4 }, { item: 'herb', price: 10 }, { item: 'sand', price: 1 }, { item: 'crystal_pick', price: 60 }],
    buys: [{ item: 'venom', price: 8 }, { item: 'cactus', price: 2 }, { item: 'shard', price: 8 }, { item: 'meat', price: 2 }, { item: 'wolf_heart', price: 60 }],
  },
};
