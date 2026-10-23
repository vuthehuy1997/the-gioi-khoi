// Mô hình thú nuôi: Gà, Cừu (có len và đã cắt len), Lợn. Cùng quy ước với beasts.js; con non là cùng mô hình thu nhỏ một nửa (xem render/entities.js).
import { SIDES, all, legs4 } from './beasts.js';

// ---------------- Gà ----------------
export function chickenModel() {
  const parts = [
    { id: 'body', bone: 'body', size: [6, 6, 8], pos: [0, 8, 0] },
    { id: 'head', bone: 'head', size: [4, 5, 4], pos: [0, 13.5, -5] },
    { id: 'beak', bone: 'head', size: [2, 1, 2], pos: [0, 13, -8] },
    { id: 'wattle', bone: 'head', size: [1, 2, 1], pos: [0, 11, -7.5] },
    { id: 'comb', bone: 'head', size: [1, 2, 3], pos: [0, 17, -5] },
    { id: 'tail', bone: 'tail', size: [3, 5, 2], pos: [0, 12, 5] },
    { id: 'wingL', bone: 'wingL', size: [1, 4, 5], pos: [-3.5, 9, 0] }, { id: 'wingR', bone: 'wingR', size: [1, 4, 5], pos: [3.5, 9, 0], uvFrom: 'wingL' },
    { id: 'legL', bone: 'legL', size: [1, 5, 1], pos: [-1.5, 2.5, 0.5] }, { id: 'legR', bone: 'legR', size: [1, 5, 1], pos: [1.5, 2.5, 0.5], uvFrom: 'legL' },
    { id: 'footL', bone: 'legL', size: [3, 1, 3], pos: [-1.5, 0.5, -0.5] }, { id: 'footR', bone: 'legR', size: [3, 1, 3], pos: [1.5, 0.5, -0.5], uvFrom: 'footL' },
  ];
  return {
    id: 'chicken', scale: 1.0, TW: 64, parts,
    bones: [{ id: 'body', pivot: [0, 6, 0] }, { id: 'head', pivot: [0, 11, -4], role: 'head', atk: 0.5 }, { id: 'tail', pivot: [0, 10, 4], role: 'tail', rest: [-0.5, 0, 0] },
      { id: 'wingL', pivot: [-3, 11, 0], role: 'sway', ph: 0, amp: 0.12 }, { id: 'wingR', pivot: [3, 11, 0], role: 'sway', ph: 2, amp: 0.12 },
      { id: 'legL', pivot: [-1.5, 5, 0.5], role: 'leg', ph: 0, amp: 1.0 }, { id: 'legR', pivot: [1.5, 5, 0.5], role: 'leg', ph: Math.PI, amp: 1.0 }],
    paint(P, R) {
      const white = '#f4f0e6', cream = '#e0d8c4', orange = '#e8a020', red = '#d82a2a';
      all(P, R, 'body', white, 0.07); all(P, R, 'head', white, 0.06); all(P, R, 'beak', orange, 0.04); all(P, R, 'wattle', red, 0.04); all(P, R, 'comb', red, 0.05);
      all(P, R, 'tail', cream, 0.06); all(P, R, 'wingL', cream, 0.06); all(P, R, 'legL', orange, 0.04); all(P, R, 'footL', orange, 0.04);
      P.speckle(R('body', 'top'), cream, 0.25, 3); P.speckle(R('body', 'left'), cream, 0.2, 4); P.speckle(R('body', 'right'), cream, 0.2, 5);
      const hf = R('head', 'front'); P.dot(hf, 0, 1, '#111'); P.dot(hf, 3, 1, '#111'); P.box(R('wingL', 'left'), 0, 0, 5, 1, '#c8bca0'); P.box(R('tail', 'back'), 0, 0, 3, 2, '#fff');
    },
  };
}

// ---------------- Cừu (shorn: đã cắt len, lộ da hồng) ----------------
export function sheepModel({ shorn = false } = {}) {
  const L = legs4([3, 8, 3], 3.2, -5.5, 5.5, 0.8);
  const body = shorn ? [8, 8, 14] : [10, 9, 15];
  const parts = [
    { id: 'body', bone: 'body', size: body, pos: [0, 12.5, 0] },
    { id: 'head', bone: 'head', size: [6, 6, 7], pos: [0, 18, -10.5] },
    { id: 'earL', bone: 'head', size: [3, 2, 1], pos: [-4, 19.5, -9.5] }, { id: 'earR', bone: 'head', size: [3, 2, 1], pos: [4, 19.5, -9.5], uvFrom: 'earL' },
    { id: 'tail', bone: 'tail', size: [2, 3, 2], pos: [0, 14, body[2] / 2 + 1.5] },
    ...(shorn ? [] : [{ id: 'tuft', bone: 'head', size: [6, 3, 6], pos: [0, 22, -9.5] }]),
    ...L.parts,
  ];
  return {
    id: shorn ? 'sheep-shorn' : 'sheep', scale: 0.95, TW: 64, parts,
    bones: [{ id: 'body', pivot: [0, 10, 0] }, { id: 'head', pivot: [0, 16, -8], role: 'head', atk: 0.3 }, { id: 'tail', pivot: [0, 15, 7], role: 'tail', rest: [-0.3, 0, 0] }, ...L.bones],
    paint(P, R) {
      const wool = '#eeeae0', woolDark = '#cfcabc', skin = '#e8b4a8', face = '#3a342e', leg = '#4a443c';
      if (shorn) { all(P, R, 'body', skin, 0.06); P.speckle(R('body', 'top'), '#d89c90', 0.15, 3); P.fill(R('body', 'bottom'), '#f2c8bc', 0.04); }
      else { all(P, R, 'body', wool, 0.08); P.speckle(R('body', 'top'), woolDark, 0.3, 3); P.speckle(R('body', 'left'), woolDark, 0.25, 4); P.speckle(R('body', 'right'), woolDark, 0.25, 5); P.speckle(R('body', 'back'), woolDark, 0.25, 6); all(P, R, 'tuft', wool, 0.08); P.speckle(R('tuft', 'top'), woolDark, 0.3, 2); }
      all(P, R, 'head', face, 0.06); all(P, R, 'earL', shorn ? skin : face, 0.05); all(P, R, 'tail', shorn ? skin : wool, 0.05);
      const hf = R('head', 'front'); P.box(hf, 1, 2, 1, 1, '#f4f4f4'); P.box(hf, 4, 2, 1, 1, '#f4f4f4'); P.dot(hf, 1, 2, '#111'); P.dot(hf, 5, 2, '#111'); P.box(hf, 2, 4, 2, 1, '#6a5a50');
      for (const f of ['left', 'front', 'right', 'back']) { const l = R('legFL', f); P.fill(l, leg, 0.06); }
      P.fill(R('legFL', 'top'), leg, 0.06); P.fill(R('legFL', 'bottom'), '#2a241e', 0.04);
    },
  };
}

// ---------------- Lợn ----------------
export function pigModel() {
  const L = legs4([3, 7, 3], 3.4, -4.5, 4.5, 0.8);
  const parts = [
    { id: 'body', bone: 'body', size: [10, 8, 14], pos: [0, 11, 0] },
    { id: 'head', bone: 'head', size: [7, 7, 7], pos: [0, 13, -10.5] },
    { id: 'snout', bone: 'head', size: [4, 3, 2], pos: [0, 11.5, -15] },
    { id: 'earL', bone: 'head', size: [3, 3, 1], pos: [-3, 17.5, -9] }, { id: 'earR', bone: 'head', size: [3, 3, 1], pos: [3, 17.5, -9], uvFrom: 'earL' },
    { id: 'tail', bone: 'tail', size: [1, 1, 3], pos: [0, 13.5, 8.5] },
    ...L.parts,
  ];
  return {
    id: 'pig', scale: 0.95, TW: 64, parts,
    bones: [{ id: 'body', pivot: [0, 10, 0] }, { id: 'head', pivot: [0, 12, -7.5], role: 'head', atk: 0.3 }, { id: 'tail', pivot: [0, 13, 7.5], role: 'tail', rest: [0.6, 0, 0] }, ...L.bones],
    paint(P, R) {
      const skin = '#eaa0a4', dark = '#d4838a', snout = '#f2b8b8';
      all(P, R, 'body', skin, 0.07); all(P, R, 'head', skin, 0.06); all(P, R, 'snout', snout, 0.05); all(P, R, 'earL', dark, 0.05); all(P, R, 'tail', dark, 0.04);
      P.speckle(R('body', 'top'), dark, 0.12, 3); P.fill(R('body', 'bottom'), snout, 0.04);
      const hf = R('head', 'front'); P.box(hf, 1, 2, 1, 1, '#111'); P.box(hf, 5, 2, 1, 1, '#111'); P.dot(hf, 1, 2, '#fff');
      const sf = R('snout', 'front'); P.box(sf, 0, 1, 1, 1, '#8a4a52'); P.box(sf, 3, 1, 1, 1, '#8a4a52');
      for (const f of ['left', 'front', 'right', 'back']) { const l = R('legFL', f); P.fill(l, skin, 0.06); P.box(l, 0, l.h - 2, l.w, 2, '#6a4a4e'); }
      P.fill(R('legFL', 'top'), skin, 0.06); P.fill(R('legFL', 'bottom'), '#6a4a4e', 0.04);
    },
  };
}
