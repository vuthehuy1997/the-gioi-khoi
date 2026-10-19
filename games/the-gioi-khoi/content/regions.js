// Các vùng của thế giới. climate = khoảng giá trị khí hậu [thấp, cao) mà vùng chiếm (xem world/regions.js).
// Vùng "phủ" (có within) nằm trong một vùng khí hậu khác, xuất hiện ở nơi nhiễu `zone` vượt ngưỡng (xem world/regions.js):
//   relief = địa hình riêng {base, amp, ridge}; patch = mảng block phụ trên mặt; flora = [[block cây cỏ, xác suất]]; shore = block ở bờ nước.
// Dữ liệu thuần: thêm vùng mới không phải sửa code sinh địa hình ngoài việc bổ sung loại cây nếu cần.
export const REGIONS = [
  { id: 'sa-mac-lua', name: 'Sa Mạc Lửa', climate: [0, 0.36], surface: 'sand', sub: 'sand', trees: 'cactus', treeChance: 0.008,
    sky: '#f2c98a', fog: '#f5dcae', danger: 2, requires: 'boss:thu-linh-soi' },
  { id: 'rung-suong', name: 'Rừng Sương', climate: [0.36, 0.64], surface: 'grass', sub: 'dirt', trees: 'oak', treeChance: 0.014,
    sky: '#8fd3a8', fog: '#cfe8d5', danger: 1 },
  { id: 'nui-bang', name: 'Núi Băng', climate: [0.64, 1.01], surface: 'snow', sub: 'stone', trees: 'spruce', treeChance: 0.004,
    sky: '#b8d4f0', fog: '#e4eefa', danger: 3, requires: 'boss:bo-cap-chua' },
  { id: 'dam-lay', name: 'Đầm Lầy Mục', within: 'rung-suong', zone: 0.565, surface: 'moss', sub: 'mud', shore: 'mud', trees: 'oak', treeChance: 0.009,
    relief: { base: 21, amp: 3.2, ridge: 0 }, flora: [['REED', 0.07], ['GLOW_MUSHROOM', 0.03], ['TALL_GRASS', 0.08]],
    sky: '#86a67a', fog: '#a8bf98', danger: 2 },
  { id: 'hoa-son', name: 'Núi Lửa Tro', within: 'sa-mac-lua', zone: 0.585, surface: 'ash', sub: 'basalt', trees: null, treeChance: 0,
    relief: { base: 30, amp: 5, ridge: 20 }, patch: { block: 'magma', above: 0.74 }, flora: [['EMBER_BLOOM', 0.035], ['DEAD_BUSH', 0.01]],
    sky: '#c46a42', fog: '#dd9c78', danger: 3, requires: 'boss:thu-linh-soi' },
  { id: 'vuc-pha-le', name: 'Vực Pha Lê', within: 'nui-bang', zone: 0.585, surface: 'snow', sub: 'stone', trees: 'spire', treeChance: 0.007,
    relief: { base: 34, amp: 5, ridge: 12 }, patch: { block: 'amethyst', above: 0.7 }, flora: [['CRYSTAL_BLOOM', 0.045]],
    sky: '#b9a6e8', fog: '#ddd2f5', danger: 4, requires: 'boss:bo-cap-chua' },
];
