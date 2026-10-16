// Các vùng của thế giới. climate = khoảng giá trị khí hậu [thấp, cao) mà vùng chiếm (xem world/regions.js).
// Dữ liệu thuần: thêm vùng mới không phải sửa code sinh địa hình ngoài việc bổ sung loại cây nếu cần.
export const REGIONS = [
  { id: 'sa-mac-lua', name: 'Sa Mạc Lửa', climate: [0, 0.36], surface: 'sand', sub: 'sand', trees: 'cactus', treeChance: 0.008,
    sky: '#f2c98a', fog: '#f5dcae', danger: 2, requires: 'boss:thu-linh-soi' },
  { id: 'rung-suong', name: 'Rừng Sương', climate: [0.36, 0.64], surface: 'grass', sub: 'dirt', trees: 'oak', treeChance: 0.014,
    sky: '#8fd3a8', fog: '#cfe8d5', danger: 1 },
  { id: 'nui-bang', name: 'Núi Băng', climate: [0.64, 1.01], surface: 'snow', sub: 'stone', trees: 'spruce', treeChance: 0.004,
    sky: '#b8d4f0', fog: '#e4eefa', danger: 3, requires: 'boss:bo-cap-chua' },
];
