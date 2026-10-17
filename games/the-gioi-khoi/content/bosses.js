// Boss nhiều pha. phases: theo tỉ lệ máu còn lại (từ cao xuống thấp), mỗi pha có bộ chiêu và hệ số.
// moves: melee (đánh cận), leap (nhảy đập), summon (gọi quái), volley (bắn loạt), slam (đập vùng sau khi báo hiệu).
export const BOSSES = {
  'thu-linh-soi': {
    name: 'Thủ Lĩnh Sói', region: 'rung-suong', hp: 300, w: 1.6, h: 1.6, speed: 3.8, sight: 24, radius: 16, color: '#555a66',
    flag: 'boss:thu-linh-soi', unlocks: 'sa-mac-lua',
    moves: {
      claw: { type: 'melee', dmg: 6, range: 2.6, cd: 1.1 },
      leap: { type: 'leap', dmg: 8, range: 10, cd: 5, radius: 2.8 },
      howl: { type: 'summon', mob: 'soi-xam', count: 2, cd: 12 },
    },
    phases: [
      { from: 1.0, moves: ['claw', 'leap'], speedMul: 1, dmgMul: 1 },
      { from: 0.5, moves: ['claw', 'leap', 'howl'], speedMul: 1.2, dmgMul: 1 },
      { from: 0.2, moves: ['claw', 'leap', 'howl'], speedMul: 1.5, dmgMul: 1.4 },
    ],
    drops: [{ item: 'wolf_heart', min: 1, max: 1, p: 1 }, { item: 'xu', min: 40, max: 60, p: 1 }, { item: 'stone_pick', min: 1, max: 1, p: 0.5 }],
  },
  'bo-cap-chua': {
    name: 'Bọ Cạp Chúa', region: 'sa-mac-lua', hp: 450, w: 2.2, h: 1.4, speed: 3.4, sight: 24, radius: 16, color: '#b8561e',
    flag: 'boss:bo-cap-chua', unlocks: 'nui-bang',
    moves: {
      sting: { type: 'melee', dmg: 8, range: 3.0, cd: 1.3 },
      spit: { type: 'volley', style: 'venom', dmg: 4, count: 5, spread: 0.5, speed: 12, cd: 4 },
      quake: { type: 'slam', dmg: 10, radius: 5.5, windup: 1.0, cd: 7 },
      brood: { type: 'summon', mob: 'bo-cap', count: 3, cd: 14 },
    },
    phases: [
      { from: 1.0, moves: ['sting', 'spit'], speedMul: 1, dmgMul: 1 },
      { from: 0.6, moves: ['sting', 'spit', 'quake'], speedMul: 1.1, dmgMul: 1 },
      { from: 0.25, moves: ['sting', 'spit', 'quake', 'brood'], speedMul: 1.3, dmgMul: 1.3 },
    ],
    drops: [{ item: 'scorpion_crown', min: 1, max: 1, p: 1 }, { item: 'xu', min: 70, max: 100, p: 1 }, { item: 'crystal', min: 2, max: 4, p: 1 }],
  },
  'bang-de': {
    name: 'Băng Đế', region: 'nui-bang', hp: 650, w: 1.8, h: 2.8, speed: 2.8, sight: 26, radius: 18, color: '#8fd0ff',
    flag: 'boss:bang-de', unlocks: null,
    moves: {
      frost: { type: 'melee', dmg: 9, range: 3.2, cd: 1.5 },
      shards: { type: 'volley', style: 'ice', dmg: 5, count: 7, spread: 0.7, speed: 10, cd: 4.5 },
      crash: { type: 'slam', dmg: 12, radius: 6.5, windup: 1.2, cd: 8 },
      court: { type: 'summon', mob: 'ma-bang', count: 2, cd: 15 },
    },
    phases: [
      { from: 1.0, moves: ['frost', 'shards'], speedMul: 1, dmgMul: 1 },
      { from: 0.65, moves: ['frost', 'shards', 'crash'], speedMul: 1.1, dmgMul: 1 },
      { from: 0.3, moves: ['frost', 'shards', 'crash', 'court'], speedMul: 1.25, dmgMul: 1.35 },
    ],
    drops: [{ item: 'frost_core', min: 1, max: 1, p: 1 }, { item: 'xu', min: 120, max: 160, p: 1 }, { item: 'gem', min: 2, max: 3, p: 1 }],
  },
};
export const SCALE_HP = 0.6, SCALE_DMG = 0.15;   // mỗi người thêm trong đấu trường: +60% máu, +15% sát thương
