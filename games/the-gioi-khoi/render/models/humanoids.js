// Mô hình dạng người: người chơi, xác sống, xương cung thủ, 4 NPC, Băng Đế (boss). Đơn vị pixel (32 px ≈ 1,8 block với scale 0.9).
import { hash } from '../../world/noise.js';

// Khung người: chân, thân, tay, đầu. opts cho phép đổi kích thước và thêm khối phụ.
function humanoid({ id, scale = 0.9, legs = [4, 12, 4], body = [8, 12, 4], arms = [4, 12, 4], head = [8, 8, 8], legX = 2, armRest = [0, 0, 0], armAmp = 0.7, armRole = 'arm', extra = [], bones = [], paint }) {
  const ly = legs[1], by = ly + body[1], ax = body[0] / 2 + arms[0] / 2;
  const parts = [
    { id: 'legL', bone: 'legL', size: legs, pos: [-legX, ly / 2, 0] },
    { id: 'legR', bone: 'legR', size: legs, pos: [legX, ly / 2, 0], uvFrom: 'legL' },
    { id: 'body', bone: 'body', size: body, pos: [0, ly + body[1] / 2, 0] },
    { id: 'armL', bone: 'armL', size: arms, pos: [-ax, by - arms[1] / 2, 0] },
    { id: 'armR', bone: 'armR', size: arms, pos: [ax, by - arms[1] / 2, 0], uvFrom: 'armL' },
    { id: 'head', bone: 'head', size: head, pos: [0, by + head[1] / 2, 0] },
    ...extra,
  ];
  return {
    id, scale, parts, TW: 64, paint,
    bones: [
      { id: 'body', pivot: [0, ly, 0] },
      { id: 'legL', pivot: [-legX, ly, 0], role: 'leg', ph: 0, amp: 0.8 }, { id: 'legR', pivot: [legX, ly, 0], role: 'leg', ph: Math.PI, amp: 0.8 },
      { id: 'armL', pivot: [-ax, by, 0], role: armRole, ph: Math.PI, amp: armAmp, rest: armRest }, { id: 'armR', pivot: [ax, by, 0], role: armRole, ph: 0, amp: armAmp, rest: armRest },
      { id: 'head', pivot: [0, by, 0], role: 'head' },
      ...bones,
    ],
  };
}

const cap = (a) => a.map(v => Math.max(0, Math.min(255, v)));

// Vẽ khuôn mặt chung: mắt (màu eye), miệng, lông mày; hỗ trợ lệch cho đầu 8x8.
function face(P, R, { eye = '#2a2a3a', white = '#ffffff', mouth = '#7a3b3b', brow = null, nose = null }) {
  const f = R('head', 'front');
  P.box(f, 1, 3, 2, 2, white); P.box(f, 5, 3, 2, 2, white);
  P.box(f, 2, 3, 1, 2, eye); P.box(f, 5, 3, 1, 2, eye);
  if (brow) { P.box(f, 1, 2, 2, 1, brow); P.box(f, 5, 2, 2, 1, brow); }
  if (nose) P.box(f, 3, 4, 2, 2, nose);
  P.box(f, 2, 6, 4, 1, mouth);
}

// ---- Người chơi: da, tóc, áo, quần theo màu; mỗi người một vẻ ----
export function playerModel(opts = {}) {
  const { skin = '#e8b890', hair = '#3a2a1e', shirt = '#3b6fd6', pants = '#33384a' } = opts;
  return humanoid({
    id: 'player', paint(P, R) {
      for (const f of ['top', 'bottom', 'left', 'front', 'right', 'back']) P.fill(R('head', f), skin, 0.04);
      P.fill(R('head', 'top'), hair, 0.06); P.fill(R('head', 'back'), hair, 0.06); P.fill(R('head', 'left'), hair, 0.06); P.fill(R('head', 'right'), hair, 0.06);
      P.box(R('head', 'front'), 0, 0, 8, 2, hair); P.box(R('head', 'front'), 0, 2, 1, 2, hair); P.box(R('head', 'front'), 7, 2, 1, 2, hair);
      face(P, R, { eye: '#27415a', white: '#f4f4f4', mouth: '#a45a4a', brow: hair, nose: '#d9a37f' });
      for (const f of ['top', 'bottom', 'left', 'front', 'right', 'back']) { P.fill(R('body', f), shirt, 0.05); P.fill(R('legL', f), pants, 0.05); P.fill(R('armL', f), shirt, 0.05); }
      P.box(R('body', 'front'), 3, 0, 2, 1, skin);                              // cổ áo
      for (const f of ['left', 'front', 'right', 'back']) { const a = R('armL', f); P.box(a, 0, 8, a.w, 4, skin); const l = R('legL', f); P.box(l, 0, 10, l.w, 2, '#22252f'); }
      P.stripes(R('body', 'front'), '#2f5cb5', 4, 1);
    },
  });
}

// ---- Xác sống ----
export const ZOMBIE = humanoid({
  id: 'zombie', armRest: [-1.45, 0, 0], armAmp: 0.12, bones: [],
  paint(P, R) {
    const skin = '#62904d', dark = '#4b7340';
    for (const f of ['top', 'bottom', 'left', 'front', 'right', 'back']) P.fill(R('head', f), skin, 0.07);
    P.speckle(R('head', 'front'), dark, 0.18, 3); P.speckle(R('head', 'top'), '#2e4a28', 0.12, 4);
    const f = R('head', 'front');
    P.box(f, 1, 3, 2, 2, '#1d1d1d'); P.box(f, 5, 3, 2, 2, '#1d1d1d'); P.dot(f, 1, 3, '#d33'); P.dot(f, 6, 4, '#d33');     // hốc mắt đỏ
    P.box(f, 2, 6, 4, 1, '#3a1f1f'); P.dot(f, 3, 6, '#e8e0c0'); P.dot(f, 5, 6, '#e8e0c0'); P.box(f, 3, 1, 1, 1, '#3e5c35');  // răng, vết thương
    for (const fc of ['top', 'bottom', 'left', 'front', 'right', 'back']) {
      P.fill(R('body', fc), '#3d5a7a', 0.07); P.fill(R('legL', fc), '#2b2f4a', 0.07); P.fill(R('armL', fc), skin, 0.07);
    }
    const bf = R('body', 'front'); P.speckle(bf, skin, 0.16, 5); P.box(bf, 0, 9, 8, 1, '#2b3a52');                    // áo rách để lộ da
    P.box(bf, 5, 2, 3, 3, skin); P.stripes(bf, '#2c4560', 3, 1, true);
    for (const fc of ['left', 'front', 'right', 'back']) { const a = R('armL', fc); P.box(a, 0, 0, a.w, 3, '#3d5a7a'); P.speckle(a, dark, 0.2, 6); const l = R('legL', fc); P.box(l, 0, 10, l.w, 2, '#1b1b22'); P.speckle(l, '#3a3f5e', 0.15, 8); }
  },
});

// ---- Xương cung thủ: tay cầm cung ----
export const SKELETON = humanoid({
  id: 'skeleton', legs: [2, 12, 2], body: [6, 12, 3], arms: [2, 12, 2], legX: 1.6, armRest: [-1.25, 0, 0], armAmp: 0.1, armRole: 'armstill',
  extra: [
    { id: 'bow', bone: 'armR', size: [1, 2, 14], pos: [4.2, 11, -2], rot: [0, 0, 0], dark: true },
    { id: 'string', bone: 'armR', size: [1, 1, 14], pos: [5.4, 11, -2], rot: [0, 0, 0] },
  ],
  paint(P, R) {
    const bone = '#e6e1cf', shadow = '#b9b39b';
    for (const f of ['top', 'bottom', 'left', 'front', 'right', 'back']) { P.fill(R('head', f), bone, 0.05); P.fill(R('body', f), bone, 0.05); P.fill(R('legL', f), bone, 0.05); P.fill(R('armL', f), bone, 0.05); }
    const hf = R('head', 'front'); P.box(hf, 1, 3, 2, 3, '#151515'); P.box(hf, 5, 3, 2, 3, '#151515'); P.dot(hf, 2, 4, '#e55'); P.dot(hf, 5, 4, '#e55');
    P.box(hf, 3, 5, 2, 2, shadow); P.box(hf, 1, 7, 6, 1, '#151515'); P.stripes(R('head', 'front'), '#151515', 2, 1, true); P.box(hf, 0, 0, 8, 3, bone); P.box(hf, 1, 3, 2, 3, '#151515'); P.box(hf, 5, 3, 2, 3, '#151515'); P.dot(hf, 2, 4, '#e55'); P.dot(hf, 5, 4, '#e55');
    const bf = R('body', 'front'); P.box(bf, 0, 0, 6, 12, '#16161a'); P.box(bf, 2, 0, 2, 12, bone);                      // xương sống
    for (let y = 1; y < 10; y += 2) P.box(bf, 0, y, 6, 1, bone);                                                         // xương sườn
    for (const fc of ['left', 'right', 'back']) { P.fill(R('body', fc), bone, 0.05); P.stripes(R('body', fc), shadow, 2, 1); }
    for (const fc of ['left', 'front', 'right', 'back']) { P.stripes(R('legL', fc), shadow, 5, 1); P.stripes(R('armL', fc), shadow, 5, 1); }
    P.fill(R('bow', 'top'), '#7a4e24', 0.1); for (const f of ['bottom', 'left', 'front', 'right', 'back']) P.fill(R('bow', f), '#6b4320', 0.1); P.fill(R('string', 'top'), '#d9d9d9', 0.05);
    for (const f of ['bottom', 'left', 'front', 'right', 'back']) P.fill(R('string', f), '#d9d9d9', 0.05);
  },
});

// ---- NPC: dân làng có áo choàng, râu, mũ riêng ----
function npcModel(id, o) {
  const robe = o.robe, extra = [
    { id: 'skirt', bone: 'body', size: [10, 12, 6], pos: [0, 8, 0] },
    ...(o.beard ? [{ id: 'beard', bone: 'head', size: [6, 7, 2], pos: [0, 22.5, -4.6] }] : []),
    ...(o.hat ? [{ id: 'hat', bone: 'head', size: [10, o.hatH || 4, 10], pos: [0, 32 + (o.hatH || 4) / 2 - 0.5, 0] }] : []),
    ...(o.nose ? [{ id: 'nose', bone: 'head', size: [2, 3, 2], pos: [0, 27.2, -5] }] : []),
    ...(o.pack ? [{ id: 'pack', bone: 'body', size: [8, 10, 3], pos: [0, 20, 4] }] : []),
    ...(o.staff ? [{ id: 'staff', bone: 'armR', size: [2, 30, 2], pos: [4.2, 8, -3.5] }, { id: 'gem', bone: 'armR', size: [4, 4, 4], pos: [4.2, 25, -3.5] }] : []),
    ...(o.apron ? [{ id: 'apron', bone: 'body', size: [7, 11, 1], pos: [0, 18, -2.6] }] : []),
  ];
  return humanoid({
    id, extra, legX: 2, armRest: o.staff ? [-0.5, 0, 0] : [0, 0, 0], armAmp: 0.1, armRole: 'armstill', arms: o.thick ? [5, 12, 5] : [4, 12, 4],
    paint(P, R) {
      const skin = o.skin || '#e0b088';
      for (const f of ['top', 'bottom', 'left', 'front', 'right', 'back']) { P.fill(R('head', f), skin, 0.04); P.fill(R('body', f), robe, 0.05); P.fill(R('legL', f), o.pants || '#4a3b2e', 0.05); P.fill(R('armL', f), robe, 0.05); P.fill(R('skirt', f), robe, 0.05); }
      for (const f of ['left', 'front', 'right', 'back']) { const a = R('armL', f); P.box(a, 0, 9, a.w, 3, skin); }
      if (o.hair) { for (const f of ['top', 'back', 'left', 'right']) P.fill(R('head', f), o.hair, 0.05); P.box(R('head', 'front'), 0, 0, 8, 2, o.hair); }
      const f = R('head', 'front');
      P.box(f, 1, 3, 2, 2, '#f4f4f4'); P.box(f, 5, 3, 2, 2, '#f4f4f4'); P.dot(f, 2, 3, o.eye || '#2b3a55'); P.dot(f, 2, 4, o.eye || '#2b3a55'); P.dot(f, 5, 3, o.eye || '#2b3a55'); P.dot(f, 5, 4, o.eye || '#2b3a55');
      P.box(f, 1, 2, 2, 1, o.brow || '#4a3b2e'); P.box(f, 5, 2, 2, 1, o.brow || '#4a3b2e'); P.box(f, 2, 6, 4, 1, '#9a5a4a');
      const bf = R('body', 'front'); P.box(bf, 3, 0, 2, 2, skin); P.stripes(bf, o.trim || '#7a5a2a', 4, 1);
      P.stripes(R('skirt', 'front'), o.trim || '#7a5a2a', 5, 1); for (const fc of ['left', 'right', 'back']) P.stripes(R('skirt', fc), o.trim || '#7a5a2a', 5, 1);
      if (o.beard) { for (const fc of ['top', 'bottom', 'left', 'front', 'right', 'back']) P.fill(R('beard', fc), o.beard, 0.06); P.speckle(R('beard', 'front'), '#8a7a6a', 0.06, 3); }
      if (o.hat) for (const fc of ['top', 'bottom', 'left', 'front', 'right', 'back']) { P.fill(R('hat', fc), o.hat, 0.06); if (o.hatBand) P.box(R('hat', fc), 0, 0, R('hat', fc).w, 1, o.hatBand); }
      if (o.nose) for (const fc of ['top', 'bottom', 'left', 'front', 'right', 'back']) P.fill(R('nose', fc), '#d29a76', 0.04);
      if (o.pack) for (const fc of ['top', 'bottom', 'left', 'front', 'right', 'back']) { P.fill(R('pack', fc), '#8a5a2e', 0.08); P.stripes(R('pack', fc), '#5a3a1c', 4, 1); }
      if (o.apron) for (const fc of ['top', 'bottom', 'left', 'front', 'right', 'back']) { P.fill(R('apron', fc), '#3a2a22', 0.07); P.speckle(R('apron', fc), '#9a4a1a', 0.06); }
      if (o.staff) { for (const fc of ['top', 'bottom', 'left', 'front', 'right', 'back']) { P.fill(R('staff', fc), '#6b4a26', 0.08); P.fill(R('gem', fc), o.gem || '#6fe0ff', 0.1); } }
    },
  });
}
export const NPC_MODELS = {
  'truong-lang': npcModel('npc-elder', { robe: '#b88a45', trim: '#7a4e1e', hair: '#e8e8e8', beard: '#efefef', staff: true, gem: '#ffd35a', brow: '#cfcfcf' }),
  'tho-ren': npcModel('npc-smith', { robe: '#5a4a46', pants: '#2c2622', trim: '#3a2a22', apron: true, hat: '#6b6f78', hatH: 3, beard: '#2a1c14', thick: true, brow: '#2a1c14', hair: '#2a1c14' }),
  'thuong-nhan': npcModel('npc-merchant', { robe: '#b8312f', trim: '#e9b949', hat: '#efe6d0', hatH: 6, hatBand: '#c9a23a', nose: true, pack: true, hair: '#3a2a1c', brow: '#3a2a1c' }),
  'an-si': npcModel('npc-hermit', { robe: '#8fb7d9', trim: '#e8f4ff', hair: '#f2f6fa', beard: '#f2f6fa', hat: '#6f98bd', hatH: 7, staff: true, gem: '#9fe8ff', skin: '#d9c0a8', brow: '#e0e8f0' }),
};

// ---- Băng Đế: vua băng cao 3 block ----
export const ICE_EMPEROR = humanoid({
  id: 'ice-emperor', scale: 1.5, legs: [5, 13, 5], body: [10, 14, 6], arms: [4, 14, 4], head: [8, 8, 8], legX: 3, armAmp: 0.4,
  extra: [
    { id: 'shoulderL', bone: 'armL', size: [7, 4, 8], pos: [-8.5, 30, 0] }, { id: 'shoulderR', bone: 'armR', size: [7, 4, 8], pos: [8.5, 30, 0], uvFrom: 'shoulderL' },
    { id: 'spikeL', bone: 'armL', size: [2, 6, 2], pos: [-9.5, 34, 0] }, { id: 'spikeR', bone: 'armR', size: [2, 6, 2], pos: [9.5, 34, 0], uvFrom: 'spikeL' },
    { id: 'crown1', bone: 'head', size: [2, 6, 2], pos: [-3, 38, 0] }, { id: 'crown2', bone: 'head', size: [2, 8, 2], pos: [0, 39, 0] }, { id: 'crown3', bone: 'head', size: [2, 6, 2], pos: [3, 38, 0] },
    { id: 'cape', bone: 'body', size: [12, 20, 1], pos: [0, 24, 4.5] },
    { id: 'beard', bone: 'head', size: [6, 5, 2], pos: [0, 28.5, -4.8] },
    { id: 'staff', bone: 'armR', size: [2, 30, 2], pos: [8.5, 16, -5] }, { id: 'orb', bone: 'armR', size: [6, 6, 6], pos: [8.5, 34, -5] },
  ],
  bones: [{ id: 'cape', pivot: [0, 36, 4.5], role: 'sway', amp: 0.08 }],
  paint(P, R) {
    const ice = '#bfe6ff', deep = '#6aa8d8', skin = '#cfe8f7';
    for (const f of ['top', 'bottom', 'left', 'front', 'right', 'back']) {
      P.fill(R('head', f), skin, 0.05); P.fill(R('body', f), deep, 0.06); P.fill(R('legL', f), '#4a7fb0', 0.06); P.fill(R('armL', f), deep, 0.06);
      for (const id of ['shoulderL', 'spikeL', 'crown1', 'crown2', 'crown3']) P.fill(R(id, f), ice, 0.07);
      P.fill(R('cape', f), '#2d4f86', 0.05); P.fill(R('beard', f), '#eef9ff', 0.05); P.fill(R('staff', f), '#8a6a3c', 0.08); P.fill(R('orb', f), '#7ff0ff', 0.12);
    }
    const hf = R('head', 'front'); P.box(hf, 1, 3, 2, 2, '#0b1a33'); P.box(hf, 5, 3, 2, 2, '#0b1a33'); P.box(hf, 1, 3, 2, 1, '#7ff0ff'); P.box(hf, 5, 3, 2, 1, '#7ff0ff'); P.box(hf, 1, 2, 2, 1, '#e8fbff'); P.box(hf, 5, 2, 2, 1, '#e8fbff');
    P.box(hf, 2, 6, 4, 1, '#355e8a');
    const bf = R('body', 'front'); P.box(bf, 2, 2, 6, 3, ice); P.box(bf, 4, 5, 2, 6, ice); P.stripes(bf, '#8fcfee', 4, 1); P.speckle(bf, '#ffffff', 0.12, 3);
    for (const fc of ['left', 'front', 'right', 'back']) { const a = R('armL', fc); P.box(a, 0, 0, a.w, 4, ice); P.box(a, 0, 11, a.w, 3, ice); P.stripes(R('legL', fc), '#a8dcf5', 4, 1); }
    P.speckle(R('cape', 'front'), '#9ec4ff', 0.1, 9); P.stripes(R('cape', 'back'), '#7aa3e8', 4, 1);
  },
});
