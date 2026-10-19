// Mô hình quái của ba vùng mới (Đầm Lầy Mục, Núi Lửa Tro, Vực Pha Lê) và Cáo của Rừng Sương. Cùng quy ước với beasts.js.
import { SIDES, all, legs4 } from './beasts.js';

// Chuỗi đốt (rắn, đuôi): mỗi đốt là một xương con của đốt trước, xoay theo pha lệch nhau nên uốn lượn.
function chain(prefix, segs, { role = 'tail', ph = 0.8, atk = 0 } = {}) {
  const parts = [], bones = [];
  segs.forEach((s, i) => {
    const id = prefix + i;
    parts.push({ id, bone: id, size: s.size, pos: s.pos });
    bones.push({ id, pivot: s.pivot, parent: i ? prefix + (i - 1) : undefined, role, ph: i * ph, atk });
  });
  return { parts, bones };
}

// ---------------- Ếch Độc ----------------
export function frogModel() {
  const L = legs4([3, 5, 3], 4.5, -3, 3.5, 0.9);
  const parts = [
    { id: 'body', bone: 'body', size: [8, 5, 10], pos: [0, 7.5, 0] },
    { id: 'head', bone: 'head', size: [7, 4, 5], pos: [0, 9, -7] },
    { id: 'sac', bone: 'head', size: [5, 2, 4], pos: [0, 6.5, -7] },
    { id: 'eyeL', bone: 'head', size: [2, 2, 2], pos: [-2.5, 12, -7] }, { id: 'eyeR', bone: 'head', size: [2, 2, 2], pos: [2.5, 12, -7], uvFrom: 'eyeL' },
    ...L.parts,
  ];
  return {
    id: 'frog', scale: 0.95, TW: 64, parts, bones: [{ id: 'body', pivot: [0, 5, 0] }, { id: 'head', pivot: [0, 8, -5], role: 'head', atk: 0.4 }, ...L.bones],
    paint(P, R) {
      const skin = '#4f9a3c', spot = '#ff8a1c', belly = '#dbe8a2';
      all(P, R, 'body', skin, 0.09); all(P, R, 'head', skin, 0.08); all(P, R, 'sac', belly, 0.05); all(P, R, 'eyeL', '#f2e04a', 0.04); all(P, R, 'legFL', skin, 0.09);
      P.fill(R('body', 'bottom'), belly, 0.05); P.speckle(R('body', 'top'), spot, 0.2, 3); P.speckle(R('body', 'left'), spot, 0.14, 5); P.speckle(R('body', 'right'), spot, 0.14, 6);
      P.speckle(R('head', 'top'), '#2e6a24', 0.2, 2); P.box(R('head', 'front'), 0, 3, 7, 1, '#2a4a20');
      for (const f of SIDES) P.box(R('eyeL', f), 0, 0, 1, 2, '#0c0c0c');
      P.box(R('eyeL', 'front'), 0, 0, 2, 2, '#f2e04a'); P.box(R('eyeL', 'front'), 0, 0, 1, 2, '#0c0c0c');
      for (const f of ['left', 'front', 'right', 'back']) { const l = R('legFL', f); P.box(l, 0, 3, l.w, 2, belly); }
    },
  };
}

// ---------------- Rắn Đầm Lầy ----------------
export function snakeModel() {
  const dims = [[4, 3, 5], [4, 3, 5], [3, 3, 5], [3, 2, 5], [2, 2, 5], [2, 1, 5]];
  let z = 1;
  const segs = dims.map((s, i) => { const c = z + s[2] / 2; z += s[2]; return { size: s, pos: [0, s[1] / 2, c], pivot: [0, s[1] / 2, c - s[2] / 2] }; });
  const C = chain('s', segs, { ph: 0.9 });
  const parts = [
    { id: 'head', bone: 'head', size: [5, 3, 5], pos: [0, 1.5, -3.5] },
    { id: 'tongue', bone: 'head', size: [1, 1, 3], pos: [0, 1, -7.5] },
    { id: 'eyeL', bone: 'head', size: [1, 1, 1], pos: [-2.5, 3, -4.5] }, { id: 'eyeR', bone: 'head', size: [1, 1, 1], pos: [2.5, 3, -4.5], uvFrom: 'eyeL' },
    ...C.parts,
  ];
  return {
    id: 'snake', scale: 1.1, TW: 64, parts, bones: [{ id: 'head', pivot: [0, 1, -1], role: 'head', atk: 0.6 }, ...C.bones],
    paint(P, R) {
      const a = '#4d7a30', b = '#c8b64a', dark = '#2c4a1c';
      all(P, R, 'head', a, 0.07); all(P, R, 'tongue', '#d6283a', 0.04); all(P, R, 'eyeL', '#ff3a1a', 0.03);
      P.box(R('head', 'front'), 0, 0, 5, 1, dark); P.speckle(R('head', 'top'), b, 0.18, 2);
      segs.forEach((_, i) => { const id = 's' + i; all(P, R, id, a, 0.08); P.stripes(R(id, 'top'), b, 3, 1); P.stripes(R(id, 'left'), dark, 2, 1); P.stripes(R(id, 'right'), dark, 2, 1); P.fill(R(id, 'bottom'), '#d9d49a', 0.05); });
    },
  };
}

// ---------------- Cá Sấu ----------------
export function crocModel({ boss = false } = {}) {
  const L = legs4([3, 4, 3], 5.5, -5, 8, 0.7);
  const T = chain('t', [
    { size: [7, 4, 8], pos: [0, 5.5, 14], pivot: [0, 6, 11] },
    { size: [5, 3, 8], pos: [0, 5, 21.5], pivot: [0, 5.5, 18] },
    { size: [3, 2, 8], pos: [0, 4.5, 29], pivot: [0, 5, 25.5] },
  ], { ph: 0.9 });
  const parts = [
    { id: 'body', bone: 'body', size: [9, 5, 18], pos: [0, 6, 2] },
    ...[-4, 0, 4, 8].map((zz, i) => ({ id: 'ridge' + i, bone: 'body', size: [2, 2, 2], pos: [0, 9.5, zz], ...(i ? { uvFrom: 'ridge0' } : {}) })),
    { id: 'head', bone: 'head', size: [8, 4, 6], pos: [0, 6.5, -10] },
    { id: 'snout', bone: 'head', size: [6, 2, 9], pos: [0, 5.5, -17.5] },
    { id: 'jaw', bone: 'head', size: [6, 1, 8], pos: [0, 3.5, -17] },
    { id: 'eyeL', bone: 'head', size: [2, 2, 2], pos: [-3, 9.5, -9] }, { id: 'eyeR', bone: 'head', size: [2, 2, 2], pos: [3, 9.5, -9], uvFrom: 'eyeL' },
    ...T.parts, ...L.parts,
  ];
  if (boss) parts.push(...[-8, -3, 2, 7].map((zz, i) => ({ id: 'spike' + i, bone: 'body', size: [2, 5, 2], pos: [0, 12.5, zz], ...(i ? { uvFrom: 'spike0' } : {}) })),
    { id: 'hornL', bone: 'head', size: [2, 5, 2], pos: [-3, 11, -9] }, { id: 'hornR', bone: 'head', size: [2, 5, 2], pos: [3, 11, -9], uvFrom: 'hornL' });
  return {
    id: boss ? 'swamp-king' : 'croc', scale: boss ? 2.6 : 0.95, TW: 128, parts, bones: [{ id: 'body', pivot: [0, 5, 0] }, { id: 'head', pivot: [0, 6, -8], role: 'head', atk: 0.5 }, ...T.bones, ...L.bones],
    paint(P, R) {
      const skin = boss ? '#3a5a2a' : '#4b6a3a', dark = boss ? '#1c2e14' : '#2f4a26', belly = boss ? '#b9b070' : '#cfc98e';
      all(P, R, 'body', skin, 0.09); all(P, R, 'head', skin, 0.08); all(P, R, 'snout', skin, 0.08); all(P, R, 'jaw', belly, 0.06); all(P, R, 'ridge0', dark, 0.06); all(P, R, 'legFL', skin, 0.09);
      T.parts.forEach(t => all(P, R, t.id, skin, 0.09));
      P.fill(R('body', 'bottom'), belly, 0.05); P.speckle(R('body', 'top'), dark, 0.22, 3); P.stripes(R('body', 'top'), dark, 4, 1, true);
      T.parts.forEach(t => { P.stripes(R(t.id, 'top'), dark, 3, 1, true); P.fill(R(t.id, 'bottom'), belly, 0.05); });
      for (const f of ['left', 'right', 'front']) P.box(R('snout', f), 0, R('snout', f).h - 1, R('snout', f).w, 1, '#f4f1e0');
      for (const f of ['left', 'right']) P.stripes(R('snout', f), '#f4f1e0', 2, 1, true);
      all(P, R, 'eyeL', boss ? '#ff4a2a' : '#d8b81c', 0.04); if (boss) { all(P, R, 'spike0', '#8fd04a', 0.08); all(P, R, 'hornL', '#e8e0b0', 0.05); } P.box(R('eyeL', 'front'), 0, 0, 1, 2, '#0c0c0c');
      P.box(R('snout', 'front'), 1, 0, 1, 1, '#0c0c0c'); P.box(R('snout', 'front'), 4, 0, 1, 1, '#0c0c0c');
      for (const f of ['left', 'front', 'right', 'back']) { const l = R('legFL', f); P.box(l, 0, 3, l.w, 1, dark); }
    },
  };
}

// ---------------- Nấm Lang Thang ----------------
export function shroomModel() {
  const parts = [
    { id: 'legL', bone: 'legL', size: [2, 4, 2], pos: [-1.8, 2, 0] }, { id: 'legR', bone: 'legR', size: [2, 4, 2], pos: [1.8, 2, 0], uvFrom: 'legL' },
    { id: 'stalk', bone: 'body', size: [6, 7, 6], pos: [0, 7.5, 0] },
    { id: 'armL', bone: 'armL', size: [2, 5, 2], pos: [-4, 9, 0] }, { id: 'armR', bone: 'armR', size: [2, 5, 2], pos: [4, 9, 0], uvFrom: 'armL' },
    { id: 'cap', bone: 'cap', size: [12, 4, 12], pos: [0, 13.5, 0] }, { id: 'dome', bone: 'cap', size: [8, 3, 8], pos: [0, 17, 0] },
    { id: 'frill', bone: 'cap', size: [10, 1, 10], pos: [0, 11.5, 0] },
  ];
  return {
    id: 'shroom', scale: 0.9, TW: 64, parts,
    bones: [{ id: 'body', pivot: [0, 4, 0] }, { id: 'legL', pivot: [-1.8, 4, 0], role: 'leg', ph: 0, amp: 0.8 }, { id: 'legR', pivot: [1.8, 4, 0], role: 'leg', ph: Math.PI, amp: 0.8 },
      { id: 'armL', pivot: [-4, 12, 0], role: 'arm', ph: Math.PI, amp: 0.6 }, { id: 'armR', pivot: [4, 12, 0], role: 'arm', ph: 0, amp: 0.6 },
      { id: 'cap', pivot: [0, 11, 0], role: 'sway', amp: 0.05, ph: 0 }],
    paint(P, R) {
      const cap = '#35b8a4', spot = '#f0ffd8', stalk = '#e4e8d0';
      all(P, R, 'stalk', stalk, 0.05); all(P, R, 'legL', '#c8cbb0', 0.05); all(P, R, 'armL', stalk, 0.05); all(P, R, 'cap', cap, 0.07); all(P, R, 'dome', '#4fd8c0', 0.06); all(P, R, 'frill', '#1f8a7a', 0.06);
      for (const id of ['cap', 'dome']) for (const f of SIDES) P.speckle(R(id, f), spot, 0.1, 4);
      const f = R('stalk', 'front'); P.box(f, 1, 2, 1, 2, '#10281c'); P.box(f, 4, 2, 1, 2, '#10281c'); P.box(f, 2, 5, 2, 1, '#10281c');
      P.box(R('cap', 'bottom'), 0, 0, 12, 12, '#d9c89a');
    },
  };
}

// ---------------- Thằn Lằn Nham Thạch ----------------
export function lizardModel({ boss = false } = {}) {
  const L = legs4([3, 5, 3], 5.5, -5, 6, 0.8);
  const T = chain('t', [
    { size: [5, 4, 7], pos: [0, 7, 11], pivot: [0, 8, 8] },
    { size: [4, 3, 7], pos: [0, 6.5, 17.5], pivot: [0, 7.5, 14] },
    { size: [2, 2, 7], pos: [0, 6, 24], pivot: [0, 7, 21] },
  ], { ph: 0.8 });
  const parts = [
    { id: 'body', bone: 'body', size: [8, 5, 15], pos: [0, 7.5, 0.5] },
    ...[-4, 0, 4, 8].map((zz, i) => ({ id: 'plate' + i, bone: 'body', size: [1, 3, 2], pos: [0, 11.5, zz], ...(i ? { uvFrom: 'plate0' } : {}) })),
    { id: 'head', bone: 'head', size: [6, 4, 7], pos: [0, 8.5, -10.5] },
    { id: 'eyeL', bone: 'head', size: [1, 1, 1], pos: [-3.2, 10.5, -10], uvFrom: undefined }, { id: 'eyeR', bone: 'head', size: [1, 1, 1], pos: [3.2, 10.5, -10], uvFrom: 'eyeL' },
    ...T.parts, ...L.parts,
  ];
  if (boss) parts.push({ id: 'hornL', bone: 'head', size: [2, 6, 2], pos: [-2.5, 12.5, -9] }, { id: 'hornR', bone: 'head', size: [2, 6, 2], pos: [2.5, 12.5, -9], uvFrom: 'hornL' },
    { id: 'maw', bone: 'head', size: [4, 2, 5], pos: [0, 6.5, -14.5] },
    ...[-6, -2, 2, 6].map((zz, i) => ({ id: 'vent' + i, bone: 'body', size: [3, 3, 2], pos: [0, 14, zz], ...(i ? { uvFrom: 'vent0' } : {}) })));
  return {
    id: boss ? 'magma-king' : 'lizard', scale: boss ? 2.8 : 1.0, TW: 64, parts, bones: [{ id: 'body', pivot: [0, 6, 0] }, { id: 'head', pivot: [0, 8, -7], role: 'head', atk: 0.5 }, ...T.bones, ...L.bones],
    paint(P, R) {
      const rock = boss ? '#241818' : '#3a2a28', crack = boss ? '#ffb02a' : '#ff6a1a', belly = '#7a3a22';
      if (boss) { all(P, R, 'hornL', '#e8d0a0', 0.05); all(P, R, 'maw', crack, 0.06); all(P, R, 'vent0', crack, 0.08); }
      all(P, R, 'body', rock, 0.09); all(P, R, 'head', rock, 0.08); all(P, R, 'plate0', '#ff9a2a', 0.08); all(P, R, 'legFL', rock, 0.09); all(P, R, 'eyeL', '#fff2a0', 0.03);
      T.parts.forEach(t => { all(P, R, t.id, rock, 0.09); P.speckle(R(t.id, 'top'), crack, 0.2, 5); P.fill(R(t.id, 'bottom'), belly, 0.05); });
      P.fill(R('body', 'bottom'), belly, 0.05);
      for (const f of ['top', 'left', 'right']) { P.speckle(R('body', f), crack, 0.16, 3); P.stripes(R('body', f), crack, 5, 1, f !== 'top'); }
      P.speckle(R('head', 'top'), crack, 0.15, 7); P.box(R('head', 'front'), 0, 2, 6, 1, '#14100f'); P.box(R('head', 'front'), 1, 0, 1, 1, crack); P.box(R('head', 'front'), 4, 0, 1, 1, crack);
      for (const f of ['left', 'front', 'right', 'back']) { const l = R('legFL', f); P.box(l, 0, 3, l.w, 2, '#1c1412'); P.dot(l, 1, 1, crack); }
    },
  };
}

// ---------------- Linh Hỏa ----------------
export function fireSpiritModel() {
  const parts = [
    { id: 'head', bone: 'head', size: [6, 6, 6], pos: [0, 19, 0] },
    { id: 'f1', bone: 'head', size: [2, 5, 2], pos: [-2, 24, 0] }, { id: 'f2', bone: 'head', size: [2, 7, 2], pos: [0, 25, 0], uvFrom: 'f1' }, { id: 'f3', bone: 'head', size: [2, 5, 2], pos: [2, 24, 0], uvFrom: 'f1' },
    { id: 'core', bone: 'body', size: [8, 7, 6], pos: [0, 12, 0] },
    { id: 'wisp1', bone: 'wisp1', size: [6, 5, 5], pos: [0, 5.5, 0] }, { id: 'wisp2', bone: 'wisp2', size: [3, 4, 3], pos: [0, 0, 0] },
    { id: 'armL', bone: 'armL', size: [2, 7, 2], pos: [-6, 13, 0] }, { id: 'armR', bone: 'armR', size: [2, 7, 2], pos: [6, 13, 0], uvFrom: 'armL' },
  ];
  return {
    id: 'fire-spirit', scale: 0.95, TW: 64, parts, hover: 6,
    bones: [{ id: 'body', pivot: [0, 9, 0] }, { id: 'head', pivot: [0, 16, 0], role: 'head' },
      { id: 'wisp1', pivot: [0, 8, 0], role: 'sway', amp: 0.2, ph: 0 }, { id: 'wisp2', pivot: [0, 3, 0], parent: 'wisp1', role: 'sway', amp: 0.35, ph: 1 },
      { id: 'armL', pivot: [-6, 17, 0], role: 'flap', amp: 0.4, ph: 0 }, { id: 'armR', pivot: [6, 17, 0], role: 'flap', amp: -0.4, ph: 0 }],
    paint(P, R) {
      for (const f of SIDES) { P.fill(R('head', f), '#ffb02e', 0.08); P.fill(R('core', f), '#ff7a1c', 0.1); P.fill(R('wisp1', f), '#f0521c', 0.1); P.fill(R('wisp2', f), '#c92e16', 0.1); P.fill(R('armL', f), '#ff9a2a', 0.1); P.fill(R('f1', f), '#ffe066', 0.08); }
      for (const [id, a, b] of [['core', '#ffd04a', '#ff6a1a'], ['wisp1', '#ff8a2a', '#d4361a']]) for (const f of ['front', 'back', 'left', 'right']) P.vgrad(R(id, f), a, b, 0.06);
      const hf = R('head', 'front'); P.box(hf, 1, 2, 1, 2, '#ffffff'); P.box(hf, 4, 2, 1, 2, '#ffffff'); P.box(hf, 1, 3, 1, 1, '#a01a0a'); P.box(hf, 4, 3, 1, 1, '#a01a0a'); P.box(hf, 2, 4, 2, 1, '#7a1408');
      P.speckle(R('core', 'front'), '#fff2a0', 0.14, 3);
    },
  };
}

// ---------------- Nhện Pha Lê ----------------
export function spiderModel() {
  const parts = [
    { id: 'body', bone: 'body', size: [8, 5, 9], pos: [0, 6, 0] },
    { id: 'abd', bone: 'body', size: [10, 7, 11], pos: [0, 7.5, 10] },
    { id: 'head', bone: 'head', size: [6, 5, 5], pos: [0, 6, -7] },
    { id: 'fangL', bone: 'head', size: [1, 3, 1], pos: [-1.5, 3, -9.5] }, { id: 'fangR', bone: 'head', size: [1, 3, 1], pos: [1.5, 3, -9.5], uvFrom: 'fangL' },
    { id: 'gemA', bone: 'body', size: [3, 6, 3], pos: [0, 14.5, 9] }, { id: 'gemB', bone: 'body', size: [2, 4, 2], pos: [-3, 12.5, 12.5] }, { id: 'gemC', bone: 'body', size: [2, 4, 2], pos: [3, 12.5, 6], uvFrom: 'gemB' },
  ];
  const bones = [{ id: 'body', pivot: [0, 4, 0] }, { id: 'head', pivot: [0, 6, -5], role: 'head', atk: 0.5 }];
  [-3, 0, 3, 6].forEach((z, i) => {
    for (const sx of [-1, 1]) {
      const id = (sx < 0 ? 'lgL' : 'lgR') + i, first = id === 'lgL0';
      parts.push({ id, bone: id, size: [7, 1, 1], pos: [sx * 7.5, 6, z], ...(first ? {} : { uvFrom: 'lgL0' }) },
        { id: 'k' + id, bone: id, size: [1, 6, 1], pos: [sx * 11, 3, z], ...(first ? {} : { uvFrom: 'klgL0' }) });
      bones.push({ id, pivot: [sx * 4, 6, z], role: 'leg', ph: (i + (sx < 0 ? 0 : 1)) % 2 ? Math.PI : 0, amp: 0.45 });
    }
  });
  return {
    id: 'spider', scale: 1.0, TW: 64, parts, bones,
    paint(P, R) {
      const body = '#3b2b5c', glow = '#b784ff', lil = '#e1c8ff';
      all(P, R, 'body', body, 0.08); all(P, R, 'abd', '#2e2250', 0.08); all(P, R, 'head', body, 0.07); all(P, R, 'fangL', lil, 0.03); all(P, R, 'lgL0', '#2a1f48', 0.06); all(P, R, 'klgL0', '#2a1f48', 0.06);
      for (const f of SIDES) { P.fill(R('gemA', f), glow, 0.1); P.fill(R('gemB', f), '#9a68e8', 0.1); }
      P.stripes(R('abd', 'top'), glow, 3, 1); P.stripes(R('abd', 'left'), glow, 4, 1, true); P.stripes(R('abd', 'right'), glow, 4, 1, true); P.speckle(R('abd', 'back'), lil, 0.12, 3);
      const hf = R('head', 'front'); [[0, 1], [2, 1], [4, 1], [1, 2], [3, 2]].forEach(([x, y]) => P.box(hf, x, y, 1, 1, '#ff4adf')); P.box(hf, 0, 4, 6, 1, '#140c24');
      P.speckle(R('body', 'top'), glow, 0.1, 5); P.stripes(R('lgL0', 'top'), glow, 3, 1, true);
    },
  };
}

// ---------------- Thỏ Pha Lê ----------------
export function crystalRabbitModel() {
  const L = legs4([2, 4, 2], 2.5, -2.5, 3, 0.9);
  const parts = [
    { id: 'body', bone: 'body', size: [5, 5, 8], pos: [0, 6.5, 0] },
    { id: 'head', bone: 'head', size: [5, 5, 5], pos: [0, 10, -5.5] },
    { id: 'nose', bone: 'head', size: [1, 1, 1], pos: [0, 9.5, -8.5] },
    { id: 'earL', bone: 'head', size: [1, 6, 1], pos: [-1.5, 15.5, -5] }, { id: 'earR', bone: 'head', size: [1, 6, 1], pos: [1.5, 15.5, -5], uvFrom: 'earL' },
    { id: 'tail', bone: 'body', size: [3, 3, 2], pos: [0, 7, 5] },
    { id: 'gem', bone: 'body', size: [2, 4, 2], pos: [0, 11, 1] },
    ...L.parts,
  ];
  return {
    id: 'crystal-rabbit', scale: 0.85, TW: 64, parts, bones: [{ id: 'body', pivot: [0, 4, 0] }, { id: 'head', pivot: [0, 8, -4], role: 'head', atk: 0.3 }, ...L.bones],
    paint(P, R) {
      const fur = '#f1ecf7', tint = '#d9cdee';
      all(P, R, 'body', fur, 0.06); all(P, R, 'head', fur, 0.05); all(P, R, 'nose', '#e58aa6', 0.02); all(P, R, 'tail', '#ffffff', 0.04); all(P, R, 'legFL', tint, 0.06);
      for (const f of SIDES) { P.fill(R('earL', f), '#d6b8ff', 0.06); P.fill(R('gem', f), '#b784ff', 0.08); }
      P.speckle(R('body', 'top'), tint, 0.2, 3); P.fill(R('body', 'bottom'), tint, 0.04);
      const hf = R('head', 'front'); P.box(hf, 0, 1, 1, 1, '#7a2a9a'); P.box(hf, 4, 1, 1, 1, '#7a2a9a'); P.box(hf, 2, 3, 1, 1, '#e58aa6');
    },
  };
}

// ---------------- Hộ Vệ Pha Lê ----------------
export function sentinelModel({ boss = false } = {}) {
  const parts = [
    { id: 'legL', bone: 'legL', size: [5, 9, 5], pos: [-3.5, 4.5, 0] }, { id: 'legR', bone: 'legR', size: [5, 9, 5], pos: [3.5, 4.5, 0], uvFrom: 'legL' },
    { id: 'body', bone: 'body', size: [11, 11, 6], pos: [0, 14.5, 0] },
    { id: 'core', bone: 'body', size: [4, 4, 1], pos: [0, 15, -3.5] },
    { id: 'armL', bone: 'armL', size: [4, 13, 4], pos: [-7.5, 14.5, 0] }, { id: 'armR', bone: 'armR', size: [4, 13, 4], pos: [7.5, 14.5, 0], uvFrom: 'armL' },
    { id: 'spL', bone: 'armL', size: [3, 6, 3], pos: [-8, 24, 0] }, { id: 'spR', bone: 'armR', size: [3, 6, 3], pos: [8, 24, 0], uvFrom: 'spL' },
    { id: 'head', bone: 'head', size: [6, 6, 6], pos: [0, 23, 0] },
    { id: 'crownA', bone: 'head', size: [2, 6, 2], pos: [0, 29, 0] }, { id: 'crownB', bone: 'head', size: [2, 4, 2], pos: [-2.5, 28, 0], uvFrom: 'crownA' }, { id: 'crownC', bone: 'head', size: [2, 4, 2], pos: [2.5, 28, 0], uvFrom: 'crownA' },
    { id: 'back', bone: 'body', size: [3, 8, 3], pos: [0, 19, 4] },
  ];
  if (boss) parts.push({ id: 'shL', bone: 'armL', size: [6, 3, 6], pos: [-9, 21.5, 0] }, { id: 'shR', bone: 'armR', size: [6, 3, 6], pos: [9, 21.5, 0], uvFrom: 'shL' },
    { id: 'halo', bone: 'head', size: [10, 1, 10], pos: [0, 33, 0] },
    ...[-3, 0, 3].map((x, i) => ({ id: 'wing' + i, bone: 'body', size: [2, 10 - Math.abs(x) * 1.5, 2], pos: [x * 2.2, 20, 7], ...(i ? { uvFrom: 'wing0' } : {}) })));
  return {
    id: boss ? 'crystal-guardian' : 'sentinel', scale: boss ? 2.2 : 1.2, TW: 64, parts,
    bones: [{ id: 'body', pivot: [0, 9, 0] }, { id: 'legL', pivot: [-3.5, 9, 0], role: 'leg', ph: 0, amp: 0.5 }, { id: 'legR', pivot: [3.5, 9, 0], role: 'leg', ph: Math.PI, amp: 0.5 },
      { id: 'armL', pivot: [-7.5, 20, 0], role: 'arm', ph: Math.PI, amp: 0.45, atk: 1.5 }, { id: 'armR', pivot: [7.5, 20, 0], role: 'arm', ph: 0, amp: 0.45, atk: 1.5 },
      { id: 'head', pivot: [0, 20, 0], role: 'head', atk: 0.2 }],
    paint(P, R) {
      const stone = boss ? '#3a2c5c' : '#5a4a78', light = boss ? '#c08aff' : '#8a6ac0', glow = boss ? '#ffe0ff' : '#e1c8ff';
      if (boss) { all(P, R, 'shL', light, 0.08); all(P, R, 'halo', glow, 0.04); all(P, R, 'wing0', light, 0.08); }
      for (const f of SIDES) for (const id of ['legL', 'body', 'armL', 'head']) P.fill(R(id, f), stone, 0.1);
      for (const f of SIDES) { P.fill(R('core', f), glow, 0.05); P.fill(R('spL', f), light, 0.08); P.fill(R('crownA', f), light, 0.08); P.fill(R('back', f), light, 0.08); }
      for (const id of ['legL', 'body', 'armL']) { P.speckle(R(id, 'front'), light, 0.14, 3); P.speckle(R(id, 'left'), '#2e2444', 0.14, 6); }
      P.stripes(R('body', 'front'), '#2e2444', 5, 1); P.box(R('core', 'front'), 1, 1, 2, 2, '#ffffff');
      const hf = R('head', 'front'); P.box(hf, 1, 2, 1, 2, glow); P.box(hf, 4, 2, 1, 2, glow); P.box(hf, 1, 5, 4, 1, '#2e2444');
      for (const f of ['left', 'front', 'right', 'back']) P.box(R('legL', f), 0, 6, 5, 3, '#2e2444');
    },
  };
}

// ---------------- Cáo ----------------
export function foxModel() {
  const L = legs4([2, 6, 2], 2.5, -3, 5, 0.9);
  const parts = [
    { id: 'body', bone: 'body', size: [6, 5, 10], pos: [0, 8.5, 1] },
    { id: 'head', bone: 'head', size: [5, 5, 5], pos: [0, 10.5, -6.5] },
    { id: 'snout', bone: 'head', size: [3, 2, 4], pos: [0, 9.5, -10.5] }, { id: 'nose', bone: 'head', size: [1, 1, 1], pos: [0, 10, -12.5] },
    { id: 'earL', bone: 'head', size: [2, 3, 1], pos: [-1.8, 14.5, -6.5] }, { id: 'earR', bone: 'head', size: [2, 3, 1], pos: [1.8, 14.5, -6.5], uvFrom: 'earL' },
    { id: 'tail', bone: 'tail', size: [4, 4, 10], pos: [0, 9, 11.5] },
    ...L.parts,
  ];
  return {
    id: 'fox', scale: 0.9, TW: 64, parts,
    bones: [{ id: 'body', pivot: [0, 6, 0] }, { id: 'head', pivot: [0, 9, -5], role: 'head', atk: 0.4 }, { id: 'tail', pivot: [0, 9, 7], role: 'tail', rest: [-0.4, 0, 0] }, ...L.bones],
    paint(P, R) {
      const fur = '#dc7a2a', white = '#f6f0e4', dark = '#2a1e1a';
      all(P, R, 'body', fur, 0.08); all(P, R, 'head', fur, 0.07); all(P, R, 'snout', white, 0.05); all(P, R, 'nose', '#101010', 0.02); all(P, R, 'earL', fur, 0.06); all(P, R, 'tail', fur, 0.08);
      P.fill(R('body', 'bottom'), white, 0.05); P.box(R('body', 'front'), 1, 2, 4, 3, white);
      P.box(R('earL', 'front'), 0, 0, 2, 1, dark); P.box(R('earL', 'back'), 0, 0, 2, 1, dark);
      const hf = R('head', 'front'); P.box(hf, 0, 4, 5, 1, white); P.box(hf, 0, 2, 1, 1, '#1a1208'); P.box(hf, 4, 2, 1, 1, '#1a1208'); P.dot(hf, 0, 1, '#ffffff');
      P.box(R('tail', 'back'), 0, 0, 4, 4, white); P.box(R('tail', 'top'), 0, 6, 4, 4, white); P.box(R('tail', 'bottom'), 0, 6, 4, 4, white);
      for (const f of ['left', 'front', 'right', 'back']) { const l = R('legFL', f); P.fill(l, fur, 0.08); P.box(l, 0, 3, l.w, 3, dark); }
      P.fill(R('legFL', 'bottom'), dark, 0.04); P.fill(R('legFL', 'top'), fur, 0.08);
    },
  };
}
