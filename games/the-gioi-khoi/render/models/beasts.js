// Mô hình thú và quái đặc biệt. Quy ước: -z là phía trước; chân đặt ở y=0; đơn vị pixel.
const SIDES = ['top', 'bottom', 'left', 'front', 'right', 'back'];
const all = (P, R, id, hex, j = 0.06) => { for (const f of SIDES) P.fill(R(id, f), hex, j); };

// Bốn chân: trả về parts + bones. size [w,h,d], x/zf/zb vị trí, h chiều cao chân.
function legs4(size, x, zf, zb, amp = 0.85) {
  const h = size[1];
  return {
    parts: [
      { id: 'legFL', bone: 'legFL', size, pos: [-x, h / 2, zf] }, { id: 'legFR', bone: 'legFR', size, pos: [x, h / 2, zf], uvFrom: 'legFL' },
      { id: 'legBL', bone: 'legBL', size, pos: [-x, h / 2, zb], uvFrom: 'legFL' }, { id: 'legBR', bone: 'legBR', size, pos: [x, h / 2, zb], uvFrom: 'legFL' },
    ],
    bones: [
      { id: 'legFL', pivot: [-x, h, zf], role: 'leg', ph: 0, amp }, { id: 'legFR', pivot: [x, h, zf], role: 'leg', ph: Math.PI, amp },
      { id: 'legBL', pivot: [-x, h, zb], role: 'leg', ph: Math.PI, amp }, { id: 'legBR', pivot: [x, h, zb], role: 'leg', ph: 0, amp },
    ],
  };
}

// ---------------- Sói (và Thủ Lĩnh Sói) ----------------
export function wolfModel({ boss = false } = {}) {
  const L = legs4([3, 8, 3], 3, -4, 7);
  const parts = [
    { id: 'body', bone: 'body', size: [8, 7, 13], pos: [0, 11.5, 1.5] },
    { id: 'mane', bone: 'body', size: [10, 9, 6], pos: [0, 12.5, -3.5] },
    { id: 'head', bone: 'head', size: [7, 6, 6], pos: [0, 14, -8] },
    { id: 'snout', bone: 'head', size: [4, 3, 5], pos: [0, 12.5, -13] },
    { id: 'nose', bone: 'head', size: [2, 2, 1], pos: [0, 13, -16] },
    { id: 'earL', bone: 'head', size: [2, 3, 1], pos: [-2.5, 18.5, -8] }, { id: 'earR', bone: 'head', size: [2, 3, 1], pos: [2.5, 18.5, -8], uvFrom: 'earL' },
    { id: 'tail', bone: 'tail', size: [3, 3, 9], pos: [0, 12, 11] },
    ...L.parts,
  ];
  const bones = [
    { id: 'body', pivot: [0, 10, 0] }, { id: 'head', pivot: [0, 13, -6], role: 'head', atk: 0.55 },
    { id: 'tail', pivot: [0, 12, 7], role: 'tail', rest: [-0.55, 0, 0] }, ...L.bones,
  ];
  if (boss) {
    parts.push(
      ...[-6, -2, 2, 6].map((z, i) => ({ id: 'spike' + i, bone: 'body', size: [2, 5, 2], pos: [0, 18.5, z], ...(i ? { uvFrom: 'spike0' } : {}) })),
      { id: 'armorA', bone: 'body', size: [10, 2, 5], pos: [0, 15.5, -1] }, { id: 'armorB', bone: 'body', size: [10, 2, 5], pos: [0, 15.5, 5], uvFrom: 'armorA' },
      { id: 'fangL', bone: 'head', size: [1, 2, 1], pos: [-1.5, 10.5, -15] }, { id: 'fangR', bone: 'head', size: [1, 2, 1], pos: [1.5, 10.5, -15], uvFrom: 'fangL' },
      { id: 'horn', bone: 'head', size: [2, 4, 2], pos: [0, 19, -10] },
    );
  }
  return {
    id: boss ? 'wolf-lord' : 'wolf', scale: boss ? 2.6 : 1.0, TW: 64, parts, bones,
    paint(P, R) {
      const fur = boss ? '#4a4d58' : '#8d939c', dark = boss ? '#2c2e36' : '#5e636c', light = boss ? '#7a7f8c' : '#c4c8cf', eye = boss ? '#ff3a1a' : '#f3b21a';
      all(P, R, 'body', fur, 0.09); all(P, R, 'mane', light, 0.09); all(P, R, 'head', fur, 0.08); all(P, R, 'snout', light, 0.07); all(P, R, 'tail', fur, 0.09);
      all(P, R, 'earL', dark, 0.05); all(P, R, 'nose', '#14141a', 0.02);
      P.fill(R('body', 'top'), dark, 0.1); P.fill(R('body', 'bottom'), light, 0.06); P.stripes(R('body', 'top'), boss ? '#3a3d48' : '#7a808a', 3, 1, true);
      P.speckle(R('mane', 'front'), '#ffffff', 0.1, 2); P.speckle(R('mane', 'top'), dark, 0.2, 5);
      const hf = R('head', 'front'); P.box(hf, 0, 1, 2, 1, dark); P.box(hf, 5, 1, 2, 1, dark);
      P.box(hf, 1, 2, 2, 2, eye); P.box(hf, 4, 2, 2, 2, eye); P.dot(hf, 1, 2, '#111'); P.dot(hf, 5, 2, '#111');
      P.box(R('head', 'top'), 0, 0, 7, 2, dark); P.box(R('snout', 'front'), 0, 2, 4, 1, '#d98a8a'); P.box(R('snout', 'bottom'), 0, 0, 4, 5, '#d98a8a');
      P.box(R('earL', 'front'), 0, 1, 2, 2, '#e3a5a5');
      for (const f of ['left', 'front', 'right', 'back']) { const l = R('legFL', f); P.fill(l, fur, 0.09); P.box(l, 0, 6, l.w, 2, dark); }
      P.fill(R('legFL', 'top'), fur, 0.08); P.fill(R('legFL', 'bottom'), '#2a2c32', 0.05);
      P.box(R('tail', 'back'), 0, 0, 3, 3, light); P.fill(R('tail', 'bottom'), light, 0.06);
      if (boss) {
        for (const f of SIDES) { P.fill(R('spike0', f), '#b9bcc8', 0.08); P.fill(R('armorA', f), '#6c7280', 0.08); P.fill(R('fangL', f), '#f4f1e6', 0.03); P.fill(R('horn', f), '#d4d0c0', 0.05); }
        P.stripes(R('armorA', 'top'), '#3b3f4a', 2, 1); P.stripes(R('armorA', 'front'), '#3b3f4a', 2, 1);
        P.box(hf, 0, 4, 1, 2, '#8a1f1f'); P.box(hf, 5, 3, 1, 3, '#8a1f1f');                         // vết sẹo
      }
    },
  };
}

// ---------------- Nai ----------------
export function deerModel() {
  const L = legs4([2, 14, 2], 2.6, -5, 7, 0.75);
  const parts = [
    { id: 'body', bone: 'body', size: [8, 9, 15], pos: [0, 18.5, 1.5] },
    { id: 'neck', bone: 'head', size: [4, 9, 4], pos: [0, 26, -7] },
    { id: 'head', bone: 'head', size: [5, 5, 6], pos: [0, 31.5, -9.5] },
    { id: 'snout', bone: 'head', size: [3, 3, 3], pos: [0, 30, -14] }, { id: 'nose', bone: 'head', size: [2, 2, 1], pos: [0, 30.5, -16] },
    { id: 'earL', bone: 'head', size: [1, 3, 2], pos: [-3.3, 33.5, -8] }, { id: 'earR', bone: 'head', size: [1, 3, 2], pos: [3.3, 33.5, -8], uvFrom: 'earL' },
    { id: 'antlerL', bone: 'head', size: [1, 7, 1], pos: [-1.6, 37.5, -9] }, { id: 'antlerR', bone: 'head', size: [1, 7, 1], pos: [1.6, 37.5, -9], uvFrom: 'antlerL' },
    { id: 'tineL', bone: 'head', size: [3, 1, 1], pos: [-3.2, 39, -9] }, { id: 'tineR', bone: 'head', size: [3, 1, 1], pos: [3.2, 39, -9], uvFrom: 'tineL' },
    { id: 'tine2L', bone: 'head', size: [3, 1, 1], pos: [-3.2, 36.5, -9] }, { id: 'tine2R', bone: 'head', size: [3, 1, 1], pos: [3.2, 36.5, -9], uvFrom: 'tine2L' },
    { id: 'tail', bone: 'tail', size: [3, 3, 2], pos: [0, 21, 10.5] },
    ...L.parts,
  ];
  return {
    id: 'deer', scale: 0.78, TW: 64, parts,
    bones: [{ id: 'body', pivot: [0, 14, 0] }, { id: 'head', pivot: [0, 22, -6], role: 'head', atk: 0.2 }, { id: 'tail', pivot: [0, 21, 9], role: 'tail', rest: [-0.4, 0, 0] }, ...L.bones],
    paint(P, R) {
      const coat = '#a9743c', light = '#d9b886', dark = '#6e4824';
      all(P, R, 'body', coat, 0.08); all(P, R, 'neck', coat, 0.08); all(P, R, 'head', coat, 0.07); all(P, R, 'snout', light, 0.05); all(P, R, 'nose', '#241a14', 0.02);
      all(P, R, 'earL', coat, 0.06); all(P, R, 'tail', '#f2ece0', 0.04);
      for (const id of ['antlerL', 'tineL', 'tine2L']) all(P, R, id, '#d8c8a0', 0.06);
      P.fill(R('body', 'bottom'), light, 0.05); P.speckle(R('body', 'top'), '#f2e6c8', 0.14, 3); P.speckle(R('body', 'left'), '#f2e6c8', 0.1, 4); P.speckle(R('body', 'right'), '#f2e6c8', 0.1, 6);
      P.fill(R('body', 'back'), '#f2ece0', 0.04); P.box(R('neck', 'front'), 0, 3, 4, 6, light);
      const hf = R('head', 'front'); P.box(hf, 0, 1, 1, 1, '#111'); P.box(hf, 4, 1, 1, 1, '#111'); P.dot(hf, 0, 0, '#fff'); P.dot(hf, 4, 0, '#fff'); P.box(R('earL', 'front'), 0, 0, 1, 2, '#e8b8a0');
      for (const f of ['left', 'front', 'right', 'back']) { const l = R('legFL', f); P.fill(l, coat, 0.08); P.box(l, 0, 10, l.w, 4, dark); P.box(l, 0, 12, l.w, 2, '#241a14'); }
      P.fill(R('legFL', 'top'), coat, 0.07); P.fill(R('legFL', 'bottom'), '#241a14', 0.04);
    },
  };
}

// ---------------- Bọ cạp (và Bọ Cạp Chúa) ----------------
export function scorpionModel({ boss = false } = {}) {
  const tailSeg = [
    { id: 't1', size: [4, 4, 4], pos: [0, 6.5, 9.5], pivot: [0, 5, 7.5], parent: null },
    { id: 't2', size: [4, 4, 3], pos: [0, 10, 12.5], pivot: [0, 8.5, 10], parent: 't1' },
    { id: 't3', size: [3, 4, 3], pos: [0, 14, 11.5], pivot: [0, 12, 12], parent: 't2' },
    { id: 't4', size: [3, 4, 3], pos: [0, 17.5, 8], pivot: [0, 15.5, 11], parent: 't3' },
    { id: 'sting', size: [2, 2, 5], pos: [0, 17.5, 3.5], pivot: [0, 17, 7.5], parent: 't4' },
  ];
  const parts = [
    { id: 'body', bone: 'body', size: [10, 4, 13], pos: [0, 5, 2] }, { id: 'plate', bone: 'body', size: [8, 2, 10], pos: [0, 8, 2] },
    { id: 'head', bone: 'body', size: [6, 3, 4], pos: [0, 5, -7.5] },
    { id: 'eyeL', bone: 'body', size: [1, 1, 1], pos: [-1.5, 8.5, -5] }, { id: 'eyeR', bone: 'body', size: [1, 1, 1], pos: [1.5, 8.5, -5], uvFrom: 'eyeL' },
    ...tailSeg.map(t => ({ id: t.id, bone: t.id, size: t.size, pos: t.pos })),
    { id: 'armL', bone: 'clawL', size: [2, 2, 6], pos: [-4, 4, -10] }, { id: 'armR', bone: 'clawR', size: [2, 2, 6], pos: [4, 4, -10], uvFrom: 'armL' },
    { id: 'palmL', bone: 'clawL', size: [5, 3, 4], pos: [-4.5, 4, -15] }, { id: 'palmR', bone: 'clawR', size: [5, 3, 4], pos: [4.5, 4, -15], uvFrom: 'palmL' },
    { id: 'pinA_L', bone: 'clawL', size: [2, 2, 5], pos: [-3.4, 4, -19] }, { id: 'pinA_R', bone: 'clawR', size: [2, 2, 5], pos: [3.4, 4, -19], uvFrom: 'pinA_L' },
    { id: 'pinB_L', bone: 'clawL', size: [2, 2, 5], pos: [-5.8, 4, -18], uvFrom: 'pinA_L' }, { id: 'pinB_R', bone: 'clawR', size: [2, 2, 5], pos: [5.8, 4, -18], uvFrom: 'pinA_L' },
  ];
  const bones = [
    { id: 'body', pivot: [0, 4, 0] },
    ...tailSeg.map((t, i) => ({ id: t.id, pivot: t.pivot, parent: t.parent || undefined, role: 'tailseg', ph: i * 0.7, atk: 0.35 })),
    { id: 'clawL', pivot: [-4, 4, -7], role: 'claw', ph: 0 }, { id: 'clawR', pivot: [4, 4, -7], role: 'claw', ph: 2 },
  ];
  // tám chân: x ngoài, z từng cặp
  [-3, 0, 3, 6].forEach((z, i) => {
    for (const sx of [-1, 1]) {
      const id = (sx < 0 ? 'lgL' : 'lgR') + i;
      parts.push({ id, bone: id, size: [7, 1, 1], pos: [sx * 8.5, 2, z], ...(id !== 'lgL0' ? { uvFrom: 'lgL0' } : {}) });
      bones.push({ id, pivot: [sx * 5, 3, z], role: 'leg', ph: (i + (sx < 0 ? 0 : 1)) % 2 ? Math.PI : 0, amp: 0.5 });
    }
  });
  if (boss) parts.push(...[-2, -0.0, 2].map((x, i) => ({ id: 'crown' + i, bone: 'body', size: [1, 4, 1], pos: [x * 1.3, 11, -6], ...(i ? { uvFrom: 'crown0' } : {}) })), { id: 'crownBase', bone: 'body', size: [6, 1, 3], pos: [0, 9.5, -6] });
  return {
    id: boss ? 'scorpion-queen' : 'scorpion', scale: boss ? 2.6 : 1.1, TW: 64, parts, bones,
    paint(P, R) {
      const shell = boss ? '#4d2a5e' : '#c0722a', plate = boss ? '#6a3a82' : '#e08a38', dark = boss ? '#2a1636' : '#7a4414', glow = boss ? '#d96bff' : '#ff5a2a';
      all(P, R, 'body', shell, 0.08); all(P, R, 'plate', plate, 0.07); all(P, R, 'head', shell, 0.06); for (const f of SIDES) { P.fill(R('eyeL', f), '#0a0a0a', 0.02); }
      P.stripes(R('plate', 'top'), dark, 3, 1); P.stripes(R('body', 'top'), dark, 4, 1); P.speckle(R('plate', 'top'), '#ffd29a', 0.07, 2);
      for (const t of tailSeg) { all(P, R, t.id, t.id === 'sting' ? glow : shell, 0.07); if (t.id !== 'sting') P.stripes(R(t.id, 'front'), dark, 2, 1); }
      for (const id of ['armL', 'palmL', 'pinA_L']) all(P, R, id, plate, 0.07); P.stripes(R('palmL', 'top'), dark, 2, 1, true);
      all(P, R, 'lgL0', dark, 0.06); P.stripes(R('lgL0', 'top'), '#b8742a', 3, 1, true);
      P.box(R('sting', 'front'), 0, 0, 2, 2, '#fff2c0'); P.box(R('sting', 'back'), 0, 0, 2, 2, glow); P.box(R('sting', 'top'), 0, 0, 2, 5, glow);
      const hf = R('head', 'front'); P.box(hf, 1, 1, 1, 1, '#111'); P.box(hf, 4, 1, 1, 1, '#111'); P.box(hf, 2, 2, 2, 1, dark);
      if (boss) { for (const f of SIDES) { P.fill(R('crown0', f), '#e9b949', 0.06); P.fill(R('crownBase', f), '#c9942a', 0.06); } P.speckle(R('plate', 'top'), '#e9b949', 0.12, 8); }
    },
  };
}

// ---------------- Gấu băng ----------------
export function bearModel() {
  const L = legs4([5, 10, 5], 4.5, -6, 9, 0.7);
  const parts = [
    { id: 'body', bone: 'body', size: [13, 12, 20], pos: [0, 16, 2] },
    { id: 'head', bone: 'head', size: [9, 8, 8], pos: [0, 20, -11] }, { id: 'snout', bone: 'head', size: [5, 4, 4], pos: [0, 18, -17] }, { id: 'nose', bone: 'head', size: [2, 2, 1], pos: [0, 19, -19.5] },
    { id: 'earL', bone: 'head', size: [3, 3, 1], pos: [-3.8, 25.5, -10] }, { id: 'earR', bone: 'head', size: [3, 3, 1], pos: [3.8, 25.5, -10], uvFrom: 'earL' },
    { id: 'tail', bone: 'tail', size: [4, 4, 2], pos: [0, 17, 13] },
    ...L.parts,
  ];
  return {
    id: 'bear', scale: 0.95, TW: 128, parts,
    bones: [{ id: 'body', pivot: [0, 10, 0] }, { id: 'head', pivot: [0, 19, -8], role: 'head', atk: 0.5 }, { id: 'tail', pivot: [0, 17, 12], role: 'tail' }, ...L.bones],
    paint(P, R) {
      const fur = '#eef3f8', shade = '#c5d3e2', blue = '#a9c2dd';
      all(P, R, 'body', fur, 0.07); all(P, R, 'head', fur, 0.06); all(P, R, 'snout', '#dfe8f2', 0.05); all(P, R, 'nose', '#101820', 0.02); all(P, R, 'earL', shade, 0.06); all(P, R, 'tail', fur, 0.06);
      P.fill(R('body', 'bottom'), blue, 0.05); P.speckle(R('body', 'top'), blue, 0.18, 3); P.speckle(R('body', 'left'), shade, 0.2, 5); P.speckle(R('body', 'right'), shade, 0.2, 7);
      const hf = R('head', 'front'); P.box(hf, 1, 2, 2, 2, '#101820'); P.box(hf, 6, 2, 2, 2, '#101820'); P.dot(hf, 1, 2, '#fff'); P.dot(hf, 6, 2, '#fff'); P.box(hf, 0, 0, 9, 1, shade);
      P.box(R('snout', 'front'), 0, 3, 5, 1, '#3a2a30'); P.box(R('earL', 'front'), 0, 0, 3, 3, blue);
      for (const f of ['left', 'front', 'right', 'back']) { const l = R('legFL', f); P.fill(l, fur, 0.07); P.box(l, 0, 8, l.w, 2, shade); P.speckle(l, blue, 0.15, 2); }
      P.fill(R('legFL', 'bottom'), '#3a3a44', 0.05); P.fill(R('legFL', 'top'), fur, 0.07);
      P.box(R('legFL', 'front'), 0, 9, 5, 1, '#2c2c34'); P.dot(R('legFL', 'front'), 1, 9, '#fff'); P.dot(R('legFL', 'front'), 3, 9, '#fff');
    },
  };
}

// ---------------- Ma băng: bay lơ lửng, hơi trong suốt ----------------
export function wraithModel() {
  const parts = [
    { id: 'head', bone: 'head', size: [8, 8, 8], pos: [0, 26, 0] },
    { id: 'spike1', bone: 'head', size: [2, 5, 2], pos: [-3, 32, 0] }, { id: 'spike2', bone: 'head', size: [2, 7, 2], pos: [0, 33, 0], uvFrom: 'spike1' }, { id: 'spike3', bone: 'head', size: [2, 5, 2], pos: [3, 32, 0], uvFrom: 'spike1' },
    { id: 'chest', bone: 'body', size: [9, 8, 5], pos: [0, 18, 0] }, { id: 'waist', bone: 'body', size: [7, 7, 4], pos: [0, 11, 0] },
    { id: 'wisp1', bone: 'wisp1', size: [5, 6, 3], pos: [0, 5.5, 0] }, { id: 'wisp2', bone: 'wisp2', size: [3, 5, 2], pos: [0, 0, 0] },
    { id: 'armL', bone: 'armL', size: [3, 11, 3], pos: [-7, 17, 0] }, { id: 'armR', bone: 'armR', size: [3, 11, 3], pos: [7, 17, 0], uvFrom: 'armL' },
    { id: 'clawL', bone: 'armL', size: [4, 3, 2], pos: [-7, 10, -1] }, { id: 'clawR', bone: 'armR', size: [4, 3, 2], pos: [7, 10, -1], uvFrom: 'clawL' },
  ];
  return {
    id: 'wraith', scale: 0.95, TW: 64, parts, hover: 8, transparent: true,
    bones: [
      { id: 'body', pivot: [0, 12, 0] }, { id: 'head', pivot: [0, 22, 0], role: 'head' },
      { id: 'wisp1', pivot: [0, 8, 0], role: 'sway', amp: 0.18, ph: 0 }, { id: 'wisp2', pivot: [0, 3, 0], parent: 'wisp1', role: 'sway', amp: 0.3, ph: 1 },
      { id: 'armL', pivot: [-7, 22, 0], role: 'flap', amp: 0.35, ph: 0 }, { id: 'armR', pivot: [7, 22, 0], role: 'flap', amp: -0.35, ph: 0 },
    ],
    paint(P, R) {
      const body = '#9fd8ff', deep = '#5aa8e0', glow = '#e8fbff';
      for (const f of SIDES) { P.fill(R('head', f), body, 0.07); P.fill(R('chest', f), deep, 0.07); P.fill(R('waist', f), deep, 0.07); P.fill(R('wisp1', f), '#7cc0ee', 0.07); P.fill(R('wisp2', f), '#9fd8ff', 0.07); P.fill(R('armL', f), body, 0.07); P.fill(R('clawL', f), glow, 0.05); P.fill(R('spike1', f), glow, 0.05); }
      const hf = R('head', 'front'); P.box(hf, 1, 3, 2, 3, '#0b2a4a'); P.box(hf, 5, 3, 2, 3, '#0b2a4a'); P.box(hf, 1, 4, 2, 1, '#ffffff'); P.box(hf, 5, 4, 2, 1, '#ffffff'); P.box(hf, 2, 6, 4, 2, '#0b2a4a'); P.dot(hf, 1, 6, '#0b2a4a'); P.dot(hf, 6, 6, '#0b2a4a'); P.box(hf, 3, 6, 2, 1, '#e8fbff');
      P.stripes(R('chest', 'front'), glow, 3, 1); P.speckle(R('chest', 'front'), '#ffffff', 0.16, 4); P.speckle(R('waist', 'front'), glow, 0.12, 6);
      for (const f of ['front', 'back', 'left', 'right']) P.speckle(R('wisp1', f), glow, 0.12, 9);
    },
  };
}

// ---------------- Tượng đá canh gác ----------------
export function golemModel() {
  const parts = [
    { id: 'legL', bone: 'legL', size: [7, 14, 7], pos: [-4.5, 7, 0] }, { id: 'legR', bone: 'legR', size: [7, 14, 7], pos: [4.5, 7, 0], uvFrom: 'legL' },
    { id: 'body', bone: 'body', size: [16, 16, 9], pos: [0, 22, 0] },
    { id: 'crystal', bone: 'body', size: [6, 6, 2], pos: [0, 25, -5] },
    { id: 'armL', bone: 'armL', size: [6, 24, 6], pos: [-11, 24, 0] }, { id: 'armR', bone: 'armR', size: [6, 24, 6], pos: [11, 24, 0], uvFrom: 'armL' },
    { id: 'fistL', bone: 'armL', size: [8, 7, 8], pos: [-11, 8, 0] }, { id: 'fistR', bone: 'armR', size: [8, 7, 8], pos: [11, 8, 0], uvFrom: 'fistL' },
    { id: 'shL', bone: 'armL', size: [9, 5, 9], pos: [-11, 35, 0] }, { id: 'shR', bone: 'armR', size: [9, 5, 9], pos: [11, 35, 0], uvFrom: 'shL' },
    { id: 'head', bone: 'head', size: [8, 8, 8], pos: [0, 34, -1] },
  ];
  return {
    id: 'golem', scale: 0.8, TW: 128, parts,
    bones: [
      { id: 'body', pivot: [0, 14, 0] },
      { id: 'legL', pivot: [-4.5, 14, 0], role: 'leg', ph: 0, amp: 0.5 }, { id: 'legR', pivot: [4.5, 14, 0], role: 'leg', ph: Math.PI, amp: 0.5 },
      { id: 'armL', pivot: [-11, 36, 0], role: 'arm', ph: Math.PI, amp: 0.4, atk: 1.6 }, { id: 'armR', pivot: [11, 36, 0], role: 'arm', ph: 0, amp: 0.4, atk: 1.6 },
      { id: 'head', pivot: [0, 30, -1], role: 'head', atk: 0.2 },
    ],
    paint(P, R) {
      const stone = '#8b8d94', light = '#a9abb3', dark = '#63656c', moss = '#5d8a4a';
      for (const f of SIDES) { for (const id of ['legL', 'body', 'armL', 'fistL', 'shL', 'head']) P.fill(R(id, f), id === 'shL' || id === 'fistL' ? light : stone, 0.1); P.fill(R('crystal', f), '#ffb02e', 0.1); }
      for (const id of ['body', 'legL', 'armL', 'head']) P.speckle(R(id, 'front'), dark, 0.16, 3), P.speckle(R(id, 'top'), moss, 0.14, 5), P.speckle(R(id, 'left'), moss, 0.1, 6);
      const bf = R('body', 'front'); P.box(bf, 6, 4, 4, 8, dark); P.box(bf, 7, 5, 2, 6, '#2a2a2f'); for (let y = 0; y < 16; y += 5) P.box(bf, 0, y, 16, 1, dark);
      const hf = R('head', 'front'); P.box(hf, 1, 3, 2, 2, '#2a2a2f'); P.box(hf, 5, 3, 2, 2, '#2a2a2f'); P.box(hf, 1, 3, 2, 2, '#ffb02e'); P.box(hf, 5, 3, 2, 2, '#ffb02e'); P.box(hf, 2, 6, 4, 1, '#2a2a2f'); P.box(hf, 0, 2, 8, 1, dark);
      P.box(R('crystal', 'front'), 0, 0, 6, 6, '#ffb02e'); P.box(R('crystal', 'front'), 1, 1, 4, 4, '#ffd36a'); P.box(R('crystal', 'front'), 2, 2, 2, 2, '#fff3b8');
      for (const f of ['left', 'front', 'right', 'back']) { P.box(R('legL', f), 0, 10, 7, 4, dark); P.box(R('fistL', f), 0, 4, 8, 3, dark); P.stripes(R('armL', f), dark, 6, 1); }
    },
  };
}
