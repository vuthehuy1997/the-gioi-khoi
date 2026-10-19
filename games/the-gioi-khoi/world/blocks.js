// Danh mục block. tiles = [mặt trên, mặt bên, mặt dưới] là chỉ số ô trong atlas (xem render/atlas.js, TILES).
// hardness: giây để đào bằng tay (-1 là không đào được). tool: loại công cụ đào nhanh; tier: bậc công cụ tối thiểu để có vật phẩm rơi.
export const B = {
  AIR: 0, STONE: 1, DIRT: 2, GRASS: 3, SAND: 4, SNOW: 5, LOG: 6, LEAVES: 7, PLANKS: 8, ORE: 9, WATER: 10,
  CACTUS: 11, ICE: 12, BEDROCK: 13, MAGMA: 14, WORKBENCH: 15, GEM_ORE: 16,
  TALL_GRASS: 17, FLOWER_RED: 18, FLOWER_YELLOW: 19, DEAD_BUSH: 20,
  GLOW_MUSHROOM: 21, REED: 22, EMBER_BLOOM: 23, CRYSTAL_BLOOM: 24,          // cây cỏ mới (id >= TALL_GRASS là cây cỏ)
  MOSS: 25, MUD: 26, ASH: 27, BASALT: 28, AMETHYST: 29,
};

export const TILES = ['stone', 'dirt', 'grass_top', 'grass_side', 'sand', 'snow', 'snow_side', 'log_side', 'log_top', 'leaves',
  'planks', 'ore', 'water', 'cactus_side', 'cactus_top', 'ice', 'bedrock', 'magma', 'bench_top', 'bench_side', 'gem_ore', 'tall_grass', 'flower_red', 'flower_yellow', 'dead_bush',
  'glow_mushroom', 'reed', 'ember_bloom', 'crystal_bloom', 'moss_top', 'moss_side', 'mud', 'ash', 'basalt', 'amethyst'];
export const ATLAS_COLS = 8, ATLAS_ROWS = 5;
const T = Object.fromEntries(TILES.map((n, i) => [n, i]));

const def = (id, name, o) => ({ id, name, solid: true, opaque: true, hardness: 1, tool: null, tier: 0, drop: name, ...o });

export const BLOCKS = [
  def(B.AIR, 'air', { solid: false, opaque: false, hardness: -1, drop: null, tiles: [0, 0, 0] }),
  def(B.STONE, 'stone', { hardness: 1.5, tool: 'pick', tier: 1, tiles: [T.stone, T.stone, T.stone] }),
  def(B.DIRT, 'dirt', { hardness: 0.5, tool: 'shovel', tiles: [T.dirt, T.dirt, T.dirt] }),
  def(B.GRASS, 'grass', { hardness: 0.6, tool: 'shovel', drop: 'dirt', tiles: [T.grass_top, T.grass_side, T.dirt] }),
  def(B.SAND, 'sand', { hardness: 0.5, tool: 'shovel', tiles: [T.sand, T.sand, T.sand] }),
  def(B.SNOW, 'snow', { hardness: 0.4, tool: 'shovel', tiles: [T.snow, T.snow_side, T.dirt] }),
  def(B.LOG, 'log', { hardness: 2, tool: 'axe', tiles: [T.log_top, T.log_side, T.log_top] }),
  def(B.LEAVES, 'leaves', { hardness: 0.3, opaque: false, tiles: [T.leaves, T.leaves, T.leaves] }),
  def(B.PLANKS, 'planks', { hardness: 1.5, tool: 'axe', tiles: [T.planks, T.planks, T.planks] }),
  def(B.ORE, 'ore', { hardness: 3, tool: 'pick', tier: 2, drop: 'crystal', tiles: [T.ore, T.ore, T.ore] }),
  def(B.WATER, 'water', { solid: false, opaque: false, hardness: -1, drop: null, liquid: true, tiles: [T.water, T.water, T.water] }),
  def(B.CACTUS, 'cactus', { hardness: 0.5, opaque: false, tiles: [T.cactus_top, T.cactus_side, T.cactus_top] }),
  def(B.ICE, 'ice', { hardness: 0.6, tool: 'pick', tiles: [T.ice, T.ice, T.ice] }),
  def(B.BEDROCK, 'bedrock', { hardness: -1, drop: null, tiles: [T.bedrock, T.bedrock, T.bedrock] }),
  def(B.MAGMA, 'magma', { hardness: 2.5, tool: 'pick', tier: 2, tiles: [T.magma, T.magma, T.magma] }),
  def(B.WORKBENCH, 'workbench', { hardness: 1.5, tool: 'axe', tiles: [T.bench_top, T.bench_side, T.planks] }),
  def(B.GEM_ORE, 'gem_ore', { hardness: 4, tool: 'pick', tier: 3, drop: 'gem', tiles: [T.gem_ore, T.gem_ore, T.gem_ore] }),
  def(B.TALL_GRASS, 'tall_grass', { solid: false, opaque: false, plant: true, hardness: 0.05, drop: null, tiles: [T.tall_grass, T.tall_grass, T.tall_grass] }),
  def(B.FLOWER_RED, 'flower_red', { solid: false, opaque: false, plant: true, hardness: 0.05, drop: null, tiles: [T.flower_red, T.flower_red, T.flower_red] }),
  def(B.FLOWER_YELLOW, 'flower_yellow', { solid: false, opaque: false, plant: true, hardness: 0.05, drop: null, tiles: [T.flower_yellow, T.flower_yellow, T.flower_yellow] }),
  def(B.DEAD_BUSH, 'dead_bush', { solid: false, opaque: false, plant: true, hardness: 0.05, drop: null, tiles: [T.dead_bush, T.dead_bush, T.dead_bush] }),
  ...[['glow_mushroom', 'glow_mushroom'], ['reed', 'reed'], ['ember_bloom', 'ember_bloom'], ['crystal_bloom', 'crystal_bloom']].map(([n, t]) =>
    def(B[n.toUpperCase()], n, { solid: false, opaque: false, plant: true, hardness: 0.05, drop: null, tiles: [T[t], T[t], T[t]] })),
  def(B.MOSS, 'moss', { hardness: 0.6, tool: 'shovel', drop: 'mud', tiles: [T.moss_top, T.moss_side, T.mud] }),
  def(B.MUD, 'mud', { hardness: 0.6, tool: 'shovel', tiles: [T.mud, T.mud, T.mud] }),
  def(B.ASH, 'ash', { hardness: 0.5, tool: 'shovel', tiles: [T.ash, T.ash, T.ash] }),
  def(B.BASALT, 'basalt', { hardness: 2, tool: 'pick', tier: 1, tiles: [T.basalt, T.basalt, T.basalt] }),
  def(B.AMETHYST, 'amethyst', { hardness: 2.5, tool: 'pick', tier: 2, drop: 'amethyst', tiles: [T.amethyst, T.amethyst, T.amethyst] }),
];

export const BLOCK_BY_NAME = Object.fromEntries(BLOCKS.map(b => [b.name, b]));
export const isPlant = id => !!BLOCKS[id] && !!BLOCKS[id].plant;
export const isSolid = id => !!BLOCKS[id] && BLOCKS[id].solid;
export const isOpaque = id => !!BLOCKS[id] && BLOCKS[id].opaque;
