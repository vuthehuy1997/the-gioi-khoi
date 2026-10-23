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
  'chua-dam-lay': {
    name: 'Chúa Đầm Lầy', region: 'dam-lay', hp: 520, w: 2.4, h: 2.0, speed: 3.2, sight: 24, radius: 16, color: '#3a5a2a',
    flag: 'boss:chua-dam-lay', unlocks: null,
    moves: {
      chomp: { type: 'melee', dmg: 8, range: 3.6, cd: 1.3 },
      pounce: { type: 'leap', dmg: 10, range: 11, cd: 5, radius: 3.2 },
      spit: { type: 'volley', style: 'venom', dmg: 4, count: 5, spread: 0.6, speed: 11, cd: 4.5 },
      brood: { type: 'summon', mob: 'ech-doc', count: 3, cd: 14 },
    },
    phases: [
      { from: 1.0, moves: ['chomp', 'pounce'], speedMul: 1, dmgMul: 1 },
      { from: 0.6, moves: ['chomp', 'pounce', 'spit'], speedMul: 1.1, dmgMul: 1 },
      { from: 0.3, moves: ['chomp', 'pounce', 'spit', 'brood'], speedMul: 1.3, dmgMul: 1.3 },
    ],
    drops: [{ item: 'swamp_heart', min: 1, max: 1, p: 1 }, { item: 'xu', min: 90, max: 130, p: 1 }, { item: 'scale', min: 3, max: 5, p: 1 }],
  },
  'vua-nham-thach': {
    name: 'Vua Nham Thạch', region: 'hoa-son', hp: 700, w: 2.4, h: 2.4, speed: 3.0, sight: 26, radius: 17, color: '#ff8a2a',
    flag: 'boss:vua-nham-thach', unlocks: null,
    moves: {
      maul: { type: 'melee', dmg: 10, range: 3.6, cd: 1.4 },
      fireball: { type: 'volley', style: 'fire', dmg: 6, count: 5, spread: 0.7, speed: 11, cd: 4.5 },
      eruption: { type: 'slam', dmg: 13, radius: 6.5, windup: 1.2, cd: 8 },
      sparks: { type: 'summon', mob: 'linh-hoa', count: 2, cd: 15 },
    },
    phases: [
      { from: 1.0, moves: ['maul', 'fireball'], speedMul: 1, dmgMul: 1 },
      { from: 0.65, moves: ['maul', 'fireball', 'eruption'], speedMul: 1.1, dmgMul: 1 },
      { from: 0.3, moves: ['maul', 'fireball', 'eruption', 'sparks'], speedMul: 1.25, dmgMul: 1.35 },
    ],
    drops: [{ item: 'magma_core', min: 1, max: 1, p: 1 }, { item: 'xu', min: 140, max: 180, p: 1 }, { item: 'ember', min: 4, max: 6, p: 1 }],
  },
  'ho-ve-pha-le': {
    name: 'Đại Hộ Vệ Pha Lê', region: 'vuc-pha-le', hp: 900, w: 2.0, h: 3.4, speed: 2.6, sight: 28, radius: 18, color: '#c08aff',
    flag: 'boss:ho-ve-pha-le', unlocks: null,
    moves: {
      smash: { type: 'melee', dmg: 12, range: 3.6, cd: 1.6 },
      prism: { type: 'volley', style: 'ice', dmg: 6, count: 9, spread: 0.9, speed: 10, cd: 4.5 },
      shatter: { type: 'slam', dmg: 15, radius: 7, windup: 1.3, cd: 8 },
      weavers: { type: 'summon', mob: 'nhen-pha-le', count: 3, cd: 15 },
    },
    phases: [
      { from: 1.0, moves: ['smash', 'prism'], speedMul: 1, dmgMul: 1 },
      { from: 0.65, moves: ['smash', 'prism', 'shatter'], speedMul: 1.1, dmgMul: 1 },
      { from: 0.3, moves: ['smash', 'prism', 'shatter', 'weavers'], speedMul: 1.25, dmgMul: 1.4 },
    ],
    drops: [{ item: 'guardian_prism', min: 1, max: 1, p: 1 }, { item: 'xu', min: 180, max: 240, p: 1 }, { item: 'amethyst', min: 4, max: 6, p: 1 }, { item: 'gem', min: 2, max: 4, p: 1 }],
  },
};

// Chủ hầm ngục: cùng một khuôn pha (1,0 / 0,55 / 0,25), chiều sâu theo chủ đề. Chiến đấu ở phòng P4 của hầm (sim/dungeon.js), không có đấu trường mặt đất.
// special: chiêu riêng ở pha đầu; slam thêm ở pha 1; summon thêm ở pha 2. Phần thưởng: xu tăng 20 mỗi hầm theo thứ tự, 2-4 Mảnh Cổ Vật (cộng rương kho báu).
function dungeonBoss(order, dungeon, name, region, o) {
  const id = o.id, moves = { claw: { type: 'melee', dmg: o.melee, range: 3.0, cd: 1.3 }, special: o.special, quake: { type: 'slam', dmg: o.slam[0], radius: o.slam[1], windup: 1.1, cd: 8 },
    brood: { type: 'summon', mob: o.summon[0], count: o.summon[1], cd: 14 } };
  BOSSES[id] = {
    name, region, hp: o.hp, w: o.w, h: o.h, speed: o.speed, sight: 24, radius: 9, color: o.color, flag: 'boss:' + id, unlocks: null, dungeon, moves,
    phases: [{ from: 1.0, moves: ['claw', 'special'], speedMul: 1, dmgMul: 1 }, { from: 0.55, moves: ['claw', 'special', 'quake'], speedMul: 1.1, dmgMul: 1 }, { from: 0.25, moves: ['claw', 'special', 'quake', 'brood'], speedMul: 1.3, dmgMul: 1.3 }],
    drops: [{ item: 'xu', min: 80 + 20 * order, max: 150 + 20 * order, p: 1 }, { item: 'ancient_shard', min: 2, max: 4, p: 1 }],
  };
}
const vol = (style, dmg, count, speed = 11) => ({ type: 'volley', style, dmg, count, spread: 0.6, speed, cd: 4.5 });
const leap = (dmg, range) => ({ type: 'leap', dmg, range, cd: 5, radius: 3 });
dungeonBoss(0, 'ham-re-muc', 'Lão Mộ Vương', 'rung-suong', { id: 'ham-chu-re-muc', hp: 260, w: 1.6, h: 1.6, speed: 3.6, color: '#4a5a44', melee: 5, special: leap(7, 10), slam: [8, 4], summon: ['xac-song', 2] });
dungeonBoss(1, 'ham-cat-chon', 'Xác Ướp Chúa', 'sa-mac-lua', { id: 'ham-chu-cat-chon', hp: 340, w: 2.2, h: 1.4, speed: 3.3, color: '#b89a5a', melee: 6, special: vol('venom', 3, 5, 12), slam: [8, 4.5], summon: ['bo-cap', 2] });
dungeonBoss(2, 'ham-bang-gia', 'Tù Trưởng Băng Cổ', 'nui-bang', { id: 'ham-chu-bang-gia', hp: 420, w: 1.8, h: 2.8, speed: 2.8, color: '#9fd8ff', melee: 7, special: vol('ice', 4, 5, 10), slam: [10, 5], summon: ['ma-bang', 2] });
dungeonBoss(3, 'ham-bun-lay', 'Thủy Quái Cổ', 'dam-lay', { id: 'ham-chu-bun-lay', hp: 380, w: 2.4, h: 2.0, speed: 3.2, color: '#4a6a3a', melee: 7, special: leap(8, 11), slam: [9, 5], summon: ['ech-doc', 3] });
dungeonBoss(4, 'ham-tro-tan', 'Pháp Sư Tro', 'hoa-son', { id: 'ham-chu-tro-tan', hp: 480, w: 2.4, h: 2.4, speed: 3.0, color: '#d86a2a', melee: 8, special: vol('fire', 5, 5), slam: [11, 5.5], summon: ['linh-hoa', 2] });
dungeonBoss(5, 'ham-lang-kinh', 'Linh Hồn Lăng Kính', 'vuc-pha-le', { id: 'ham-chu-lang-kinh', hp: 560, w: 2.0, h: 3.4, speed: 2.6, color: '#c8a0ff', melee: 9, special: vol('ice', 5, 7, 10), slam: [12, 6], summon: ['nhen-pha-le', 2] });

export const SCALE_HP = 0.6, SCALE_DMG = 0.15;   // mỗi người thêm trong đấu trường: +60% máu, +15% sát thương
