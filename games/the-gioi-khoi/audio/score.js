// Nhạc nền và âm thanh môi trường: phần "sáng tác" thuần (không dùng Web Audio, không DOM) nên test được.
// Mỗi vùng có một chủ đề riêng (giọng, nhịp, âm sắc); ban đêm chậm và thưa hơn; boss có chủ đề trống dồn.
// stepNotes(theme, step, night) trả các nốt của một bước (nốt móc đơn, 8 bước một ô nhịp), kết quả luôn như nhau với cùng tham số.

const PENT_MAJ = [0, 2, 4, 7, 9], PENT_MIN = [0, 3, 5, 7, 10];
export const THEMES = {
  'rung-suong': { root: 220, scale: PENT_MAJ, bpm: 84, prog: [0, 3, 4, 2], pad: 'sine', lead: 'triangle', bass: 'sine', density: 0.5, leadOct: 2, padVol: 0.03, leadVol: 0.045 },
  'sa-mac-lua': { root: 146.8, scale: [0, 1, 4, 5, 7, 8, 10], bpm: 76, prog: [0, 0, 3, 4], pad: 'sawtooth', lead: 'triangle', bass: 'triangle', density: 0.45, leadOct: 2, padVol: 0.016, leadVol: 0.05 },
  'nui-bang': { root: 329.6, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 66, prog: [0, 2, 4, 1], pad: 'sine', lead: 'sine', bass: 'sine', density: 0.35, leadOct: 1, padVol: 0.032, leadVol: 0.05 },
  'dam-lay': { root: 196, scale: PENT_MIN, bpm: 62, prog: [0, 2, 3, 1], pad: 'triangle', lead: 'sine', bass: 'square', density: 0.3, leadOct: 1, padVol: 0.028, leadVol: 0.04 },
  'hoa-son': { root: 130.8, scale: [0, 2, 3, 5, 7, 8, 11], bpm: 92, prog: [0, 5, 3, 4], pad: 'sawtooth', lead: 'sawtooth', bass: 'square', density: 0.32, leadOct: 2, padVol: 0.014, leadVol: 0.03, pulse: true },
  'vuc-pha-le': { root: 370, scale: [0, 2, 4, 6, 8, 10], bpm: 58, prog: [0, 3, 1, 4], pad: 'sine', lead: 'sine', bass: 'sine', density: 0.5, leadOct: 1, padVol: 0.03, leadVol: 0.05 },
  boss: { root: 110, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 148, prog: [0, 0, 5, 4], pad: 'sawtooth', lead: 'sawtooth', bass: 'square', density: 0.28, leadOct: 2, padVol: 0.02, leadVol: 0.04, pulse: true, drums: true },
};
export const THEME_IDS = Object.keys(THEMES);

export function themeFor({ region, boss } = {}) { return boss ? 'boss' : THEMES[region] ? region : 'rung-suong'; }
export const stepSeconds = (theme, night) => 60 / (THEMES[theme].bpm * (night && theme !== 'boss' ? 0.85 : 1)) / 2;

function h(a, b) { let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }
const semis = (scale, d) => { const n = scale.length; return scale[((d % n) + n) % n] + 12 * Math.floor(d / n); };
const hz = (root, st) => root * Math.pow(2, st / 12);

export function stepNotes(theme, step, night = false) {
  const T = THEMES[theme]; if (!T) return [];
  const out = [], sd = stepSeconds(theme, night), bar = step >> 3, pos = step & 7, chord = T.prog[bar % T.prog.length], sc = T.scale;
  const night_ = night && theme !== 'boss';
  if (pos === 0) {                                                       // đầu ô nhịp: hợp âm nền kéo dài cả ô
    for (const k of [0, 2, 4]) out.push({ kind: 'tone', f: hz(T.root, semis(sc, chord + k)), len: sd * 8.5, wave: T.pad, vol: T.padVol * (night_ ? 1.25 : 1) });
  }
  if (pos === 0 || pos === 4) out.push({ kind: 'tone', f: hz(T.root / 2, semis(sc, chord)), len: sd * (T.pulse ? 1.6 : 3.5), wave: T.bass, vol: T.padVol * 1.6 });
  if (T.pulse && pos % 2 === 1) out.push({ kind: 'tone', f: hz(T.root / 2, semis(sc, chord)), len: sd * 0.8, wave: T.bass, vol: T.padVol * 1.1 });
  if (T.drums) {
    if (pos === 0 || pos === 3 || pos === 4 && bar % 2) out.push({ kind: 'kick', vol: 0.09 });
    if (pos === 2 || pos === 6) out.push({ kind: 'snare', vol: 0.05 });
    out.push({ kind: 'hat', vol: pos % 2 ? 0.018 : 0.03 });
  }
  const rest = (bar % 4) === 3 && !T.drums;                              // ô cuối mỗi 4 ô để lặng cho dễ thở
  const dens = T.density * (night_ ? 0.6 : 1);
  if (!rest && h(step, 1) < dens) {
    const d = chord + [0, 1, 2, 4, 5, -2][Math.floor(h(step, 2) * 6)] + sc.length * (T.leadOct - 1);
    const long = h(step, 3);
    out.push({ kind: 'tone', f: hz(T.root, semis(sc, d)), len: sd * (long < 0.5 ? 1.5 : long < 0.85 ? 3 : 6), wave: night_ ? 'sine' : T.lead, vol: T.leadVol });
  }
  if (night_ && pos === 5 && h(step, 4) < 0.3) out.push({ kind: 'tone', f: hz(T.root, semis(sc, chord + sc.length * T.leadOct + 2)), len: sd * 4, wave: 'sine', vol: T.leadVol * 0.6 });   // "sao" lấp lánh
  return out;
}

// Bộ phát: giữ chủ đề hiện tại, đổi chủ đề ở đầu ô nhịp (boss thì đổi ngay). emit(note, t) do bên ngoài cung cấp.
export function createScore(emit) {
  let cur = 'rung-suong', want = cur, night = false, boss = false, nightNow = false;
  return {
    get theme() { return cur; },
    setContext(c) { want = themeFor(c); night = !!c.night; boss = !!c.boss; },
    playStep(step, t) {
      if (want !== cur && ((step & 7) === 0 || boss || want === 'boss')) { cur = want; }
      if ((step & 7) === 0) nightNow = night;
      for (const n of stepNotes(cur, step, nightNow)) emit(n, t);
      return stepSeconds(cur, nightNow);
    },
  };
}

// Âm thanh môi trường: thỉnh thoảng một tiếng nhỏ theo vùng và ban ngày/đêm. Trả tên âm hoặc null.
export const AMBIENT = {
  'rung-suong': [{ s: 'bird', day: 1 }, { s: 'cricket', night: 1 }, { s: 'leaves', day: 0.5, night: 0.5 }],
  'sa-mac-lua': [{ s: 'wind', day: 1, night: 1 }, { s: 'cricket', night: 0.4 }],
  'nui-bang': [{ s: 'wind', day: 1, night: 1 }, { s: 'chime', day: 0.3, night: 0.6 }],
  'dam-lay': [{ s: 'frog', day: 1, night: 1.5 }, { s: 'cricket', night: 1 }, { s: 'bubble', day: 0.5, night: 0.5 }],
  'hoa-son': [{ s: 'rumble', day: 1, night: 1 }, { s: 'crackle', day: 1, night: 1 }],
  'vuc-pha-le': [{ s: 'chime', day: 1, night: 1 }, { s: 'wind', day: 0.4, night: 0.4 }],
};
export function pickAmbient(region, night, r) {
  const list = (AMBIENT[region] || AMBIENT['rung-suong']).map(a => ({ s: a.s, w: (night ? a.night : a.day) || 0 })).filter(a => a.w > 0);
  const tot = list.reduce((a, b) => a + b.w, 0); if (!tot) return null;
  let x = r * tot; for (const a of list) { x -= a.w; if (x < 0) return a.s; }
  return list[list.length - 1].s;
}
