// Danh mục block. tiles = [mặt trên, mặt bên, mặt dưới] là chỉ số ô trong atlas (xem render/atlas.js, TILES).
// hardness: giây để đào bằng tay (-1 là không đào được). tool: loại công cụ đào nhanh; tier: bậc công cụ tối thiểu để có vật phẩm rơi.
export const B = {
  AIR: 0, STONE: 1, DIRT: 2, GRASS: 3, SAND: 4, SNOW: 5, LOG: 6, LEAVES: 7, PLANKS: 8, ORE: 9, WATER: 10,
  CACTUS: 11, ICE: 12, BEDROCK: 13, MAGMA: 14, WORKBENCH: 15, GEM_ORE: 16,
  TALL_GRASS: 17, FLOWER_RED: 18, FLOWER_YELLOW: 19, DEAD_BUSH: 20,
  GLOW_MUSHROOM: 21, REED: 22, EMBER_BLOOM: 23, CRYSTAL_BLOOM: 24,          // cây cỏ mới (id >= TALL_GRASS là cây cỏ)
  MOSS: 25, MUD: 26, ASH: 27, BASALT: 28, AMETHYST: 29,
  IRON_ORE: 30, FURNACE: 31, ANVIL: 32, CHEST: 33, BED: 34, DOOR: 35, DOOR_OPEN: 36, TORCH: 37, GLASS: 38, STONE_BRICK: 39,
  FARMLAND: 40, FARMLAND_WET: 41,            // đất cày khô / ướt; 42..53 là cây trồng (xem CROP_BLOCKS)
  DUNGEON_WALL: 54, GATE_IRON: 55, GATE_BOSS: 56, SPIKES: 57, PLATE: 58, DART_TRAP: 59, VENT: 60, DCHEST: 61,   // hầm ngục (sim/dungeon.js)
};
// Cây trồng: mỗi giai đoạn (0 mầm .. 3 chín) là một id block riêng, vì delta chỉ lưu id block.
export const CROP_BLOCKS = { wheat: [42, 43, 44, 45], carrot: [46, 47, 48, 49], potato: [50, 51, 52, 53] };
const CROP_OF = new Map(Object.entries(CROP_BLOCKS).flatMap(([kind, ids]) => ids.map((id, stage) => [id, { kind, stage }])));
export const cropOf = id => CROP_OF.get(id) || null;                // { kind, stage } nếu id là block cây trồng
export const isCrop = id => CROP_OF.has(id);
export const isFarmland = id => id === 40 || id === 41;

export const TILES = ['stone', 'dirt', 'grass_top', 'grass_side', 'sand', 'snow', 'snow_side', 'log_side', 'log_top', 'leaves',
  'planks', 'ore', 'water', 'cactus_side', 'cactus_top', 'ice', 'bedrock', 'magma', 'bench_top', 'bench_side', 'gem_ore', 'tall_grass', 'flower_red', 'flower_yellow', 'dead_bush',
  'glow_mushroom', 'reed', 'ember_bloom', 'crystal_bloom', 'moss_top', 'moss_side', 'mud', 'ash', 'basalt', 'amethyst',
  'iron_ore', 'furnace_side', 'furnace_top', 'anvil_top', 'anvil_side', 'chest_top', 'chest_side', 'bed_top', 'bed_side', 'door', 'door_open', 'torch', 'glass', 'stone_brick',
  'farmland_top', 'farmland_wet_top', 'crop_wheat_0', 'crop_wheat_1', 'crop_wheat_2', 'crop_wheat_3', 'crop_carrot_0', 'crop_carrot_1', 'crop_carrot_2', 'crop_carrot_3', 'crop_potato_0', 'crop_potato_1', 'crop_potato_2', 'crop_potato_3',
  'dungeon_wall', 'gate_iron', 'gate_boss', 'spikes', 'plate', 'dart_trap', 'vent', 'dchest_top', 'dchest_side'];
export const ATLAS_COLS = 8, ATLAS_ROWS = 10;
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
  def(B.IRON_ORE, 'iron_ore', { hardness: 3, tool: 'pick', tier: 2, tiles: [T.iron_ore, T.iron_ore, T.iron_ore] }),
  def(B.FURNACE, 'furnace', { hardness: 3, tool: 'pick', tier: 1, tiles: [T.furnace_top, T.furnace_side, T.furnace_top] }),
  def(B.ANVIL, 'anvil', { hardness: 4, tool: 'pick', tier: 1, tiles: [T.anvil_top, T.anvil_side, T.anvil_side] }),
  def(B.CHEST, 'chest', { hardness: 1.5, tool: 'axe', tiles: [T.chest_top, T.chest_side, T.chest_top] }),
  def(B.BED, 'bed', { hardness: 0.8, tiles: [T.bed_top, T.bed_side, T.planks] }),
  def(B.DOOR, 'door', { hardness: 1.2, tool: 'axe', tiles: [T.door, T.door, T.door] }),
  def(B.DOOR_OPEN, 'door_open', { solid: false, opaque: false, plant: true, deco: true, hardness: 1.2, tool: 'axe', drop: 'door', tiles: [T.door_open, T.door_open, T.door_open] }),
  def(B.TORCH, 'torch', { solid: false, opaque: false, plant: true, deco: true, hardness: 0.05, tiles: [T.torch, T.torch, T.torch] }),
  def(B.GLASS, 'glass', { hardness: 0.4, opaque: false, tiles: [T.glass, T.glass, T.glass] }),
  def(B.STONE_BRICK, 'stone_brick', { hardness: 1.8, tool: 'pick', tier: 1, tiles: [T.stone_brick, T.stone_brick, T.stone_brick] }),
  def(B.FARMLAND, 'farmland', { hardness: 0.5, tool: 'shovel', drop: 'dirt', tiles: [T.farmland_top, T.dirt, T.dirt] }),
  def(B.FARMLAND_WET, 'farmland_wet', { hardness: 0.5, tool: 'shovel', drop: 'dirt', tiles: [T.farmland_wet_top, T.dirt, T.dirt] }),
  ...Object.entries(CROP_BLOCKS).flatMap(([kind, ids]) => ids.map((id, stage) => {
    const t = T[`crop_${kind}_${stage}`];
    return def(id, `crop_${kind}_${stage}`, { solid: false, opaque: false, plant: true, deco: true, hardness: 0.05, drop: null, tiles: [t, t, t] });
  })),
  // hầm ngục: tường/cổng/rương không đào được; bẫy (tấm áp lực, ống tên, ống phun) gỡ được bằng cuốc bậc 1. Gai, tấm, ống phun là block rắn ở lớp sàn (người chơi đứng trên mặt trên).
  def(B.DUNGEON_WALL, 'dungeon_wall', { hardness: -1, drop: null, tiles: [T.dungeon_wall, T.dungeon_wall, T.dungeon_wall] }),
  def(B.GATE_IRON, 'gate_iron', { hardness: -1, drop: null, tiles: [T.gate_iron, T.gate_iron, T.gate_iron] }),
  def(B.GATE_BOSS, 'gate_boss', { hardness: -1, drop: null, tiles: [T.gate_boss, T.gate_boss, T.gate_boss] }),
  def(B.SPIKES, 'spikes', { hardness: -1, drop: null, tiles: [T.spikes, T.dungeon_wall, T.dungeon_wall] }),
  def(B.PLATE, 'plate', { hardness: 2, tool: 'pick', tier: 1, drop: null, tiles: [T.plate, T.dungeon_wall, T.dungeon_wall] }),
  def(B.DART_TRAP, 'dart_trap', { hardness: 2, tool: 'pick', tier: 1, drop: null, tiles: [T.dart_trap, T.dart_trap, T.dart_trap] }),
  def(B.VENT, 'vent', { hardness: 2, tool: 'pick', tier: 1, drop: null, tiles: [T.vent, T.dungeon_wall, T.dungeon_wall] }),
  def(B.DCHEST, 'dchest', { hardness: -1, drop: null, tiles: [T.dchest_top, T.dchest_side, T.dchest_top] }),
];

export const BLOCK_BY_NAME = Object.fromEntries(BLOCKS.map(b => [b.name, b]));
export const isPlant = id => !!BLOCKS[id] && !!BLOCKS[id].plant;
// Đặt block được lên ô này (không phá): không khí, nước, cây cỏ thường. Đuốc và cửa mở là cây cỏ "trang trí" nên không bị đè.
export const isReplaceable = id => id === B.AIR || id === B.WATER || (isPlant(id) && !BLOCKS[id].deco);
export const isSolid = id => !!BLOCKS[id] && BLOCKS[id].solid;
export const isOpaque = id => !!BLOCKS[id] && BLOCKS[id].opaque;
