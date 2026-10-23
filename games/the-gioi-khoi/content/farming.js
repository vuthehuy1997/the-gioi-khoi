// Dữ liệu trồng trọt và hiệu ứng thức ăn (dữ liệu thuần). secs: giây lớn đủ trên đất khô; đất ướt gấp đôi tốc độ, vùng lạnh nửa tốc độ.
// yield: sản lượng khi thu hoạch cây chín; hạt gieo (seed) nằm trong yield để thu hoạch bấm phải trừ lại 1 hạt (tự gieo lại).
export const CROPS = {
  wheat: { name: 'Lúa mì', seed: 'wheat_seed', secs: 360, yield: [{ item: 'wheat', min: 1, max: 2 }, { item: 'wheat_seed', min: 1, max: 3 }] },
  carrot: { name: 'Cà rốt', seed: 'carrot', secs: 300, yield: [{ item: 'carrot', min: 2, max: 4 }] },
  potato: { name: 'Khoai tây', seed: 'potato', secs: 420, yield: [{ item: 'potato', min: 2, max: 3 }] },
};
export const CROP_STAGES = 4;
export const COLD_REGIONS = ['nui-bang', 'vuc-pha-le'];          // lớn chậm một nửa
export const SOIL = ['dirt', 'grass', 'mud', 'moss'];            // block cày được (theo tên)
// Hiệu ứng thức ăn: regen (+1 máu/2 s), power (sát thương x1,25), tough (+3 giáp ảo), poison (ngộ độc).
export const EFFECTS = {
  regen: { name: 'Hồi phục', color: '#e86a8a' }, power: { name: 'Sức mạnh', color: '#e0a22c' },
  tough: { name: 'Da dày', color: '#9aa0a8' }, poison: { name: 'Ngộ độc', color: '#5ab04a' },
};
