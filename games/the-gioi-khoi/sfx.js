// Âm thanh tổng hợp bằng Web Audio (không cần file). sfx.play(tên) và sfx.stats để test đếm số lần phát.
import { tone, noise } from '../../platform/core/audio.js';
import { BLOCKS } from './world/blocks.js';

const stats = {};
const mat = id => { const b = BLOCKS[id]; if (!b) return 'stone'; if (b.tool === 'axe') return 'wood'; if (b.tool === 'shovel') return 'soft'; if (id === 7) return 'leaf'; if (b.plant) return 'leaf'; return 'stone'; };
const FREQ = { stone: 800, wood: 1000, soft: 450, leaf: 2400 };

// Tiếng kêu theo loài: họ âm (wave, tần số gốc, tiếng ồn kèm). intent: alert (phát hiện bạn) | hurt | idle | die.
const FAMILY = {
  growl: { f: 95, wave: 'sawtooth', n: 500 }, moan: { f: 80, wave: 'sawtooth', n: 300, wob: true }, hiss: { f: 0, n: 5200 }, croak: { f: 130, wave: 'square', n: 0, pulse: 2 },
  squeak: { f: 1100, wave: 'sine', n: 0 }, rattle: { f: 0, n: 2600, ticks: 4 }, chitter: { f: 0, n: 4200, ticks: 6 }, crackle: { f: 0, n: 3000, ticks: 5, f2: 420 },
  chime: { f: 880, wave: 'sine', n: 0, bell: true }, boing: { f: 200, wave: 'triangle', n: 0 }, bleat: { f: 340, wave: 'triangle', n: 0 }, stone: { f: 60, wave: 'square', n: 250 },
};
export const MOB_VOICE = { 'soi-xam': 'growl', 'gau-bang': 'growl', 'ca-sau': 'growl', 'than-lan-nham': 'growl', 'xac-song': 'moan', 'ran-lay': 'hiss', 'ech-doc': 'croak', 'tho-pha-le': 'squeak', 'cao-lua': 'squeak',
  'xuong-cung': 'rattle', 'nhen-pha-le': 'chitter', 'bo-cap': 'chitter', 'linh-hoa': 'crackle', 'ma-bang': 'moan', 'khoi-pha-le': 'stone', 'tuong-da': 'stone', 'nam-di': 'boing', 'nai': 'bleat' };
const BOSS_VOICE = { 'thu-linh-soi': 'growl', 'bo-cap-chua': 'chitter', 'bang-de': 'stone', 'chua-dam-lay': 'growl', 'vua-nham-thach': 'crackle', 'ho-ve-pha-le': 'chime' };
export const voiceOf = type => MOB_VOICE[type] || BOSS_VOICE[type] || 'growl';
const near = d => { const k = Math.max(0, 1 - (d || 0) / 30); return k * k; };

function voice(o) {
  const fam = FAMILY[voiceOf(o.type)], k = near(o.dist) * (o.boss ? 1.6 : 1), pitch = o.boss ? 0.55 : 1, I = o.intent;
  if (k <= 0.01) return;
  const f = fam.f * pitch, v = 0.07 * k;
  const ticks = (n, vol) => { for (let i = 0; i < n; i++) setTimeout(() => noise(0.03, vol, fam.n * (0.8 + Math.random() * 0.4)), i * 45); };
  if (fam.ticks) { ticks(I === 'idle' ? Math.ceil(fam.ticks / 2) : fam.ticks, v * 0.9); if (fam.f2 && I !== 'idle') tone(fam.f2 * pitch, 0.18, 'sawtooth', v * 0.4, -200); return; }
  if (!fam.wave) { noise(I === 'die' ? 0.5 : 0.3, v * 0.9, fam.n); return; }                 // rít (rắn)
  if (fam.bell) { tone(f * (I === 'hurt' ? 1.5 : 1), 0.5, 'sine', v * 0.7); tone(f * 1.5, 0.4, 'sine', v * 0.4, 0, 0.0); return; }
  if (fam.pulse) { for (let i = 0; i < (I === 'idle' ? 1 : 2); i++) setTimeout(() => tone(f * (I === 'hurt' ? 1.4 : 1), 0.09, fam.wave, v * 0.8, -25), i * 130); return; }
  if (I === 'alert') { tone(f * 1.1, 0.38, fam.wave, v, -f * 0.35); if (fam.n) noise(0.25, v * 0.5, fam.n); if (fam.wob) tone(f * 1.04, 0.38, fam.wave, v * 0.6, -f * 0.3); }
  else if (I === 'hurt') { tone(f * 1.7, 0.16, fam.wave, v, -f * 0.7); if (fam.n) noise(0.1, v * 0.5, fam.n * 1.5); }
  else if (I === 'die') { tone(f * 1.3, 0.6, fam.wave, v, -f * 0.9); if (fam.n) noise(0.35, v * 0.5, fam.n * 0.7); }
  else tone(f * 0.95, 0.28, fam.wave, v * 0.55, f * 0.12);                                   // idle
}

const sounds = {
  voice,
  bossSwing: () => { noise(0.18, 0.1, 500); tone(70, 0.25, 'sawtooth', 0.07, -30); },
  warn: () => { tone(330, 0.12, 'square', 0.04); tone(250, 0.18, 'square', 0.04, 0, 0.0); },
  // âm thanh môi trường (thỉnh thoảng, nhỏ)
  'amb:bird': () => { const f = 2400 + Math.random() * 1200; tone(f, 0.07, 'sine', 0.022, 500); setTimeout(() => tone(f * 1.2, 0.08, 'sine', 0.02, 400), 110); },
  'amb:cricket': () => { for (let i = 0; i < 3; i++) setTimeout(() => tone(4300, 0.04, 'square', 0.008), i * 70); },
  'amb:leaves': () => noise(0.5, 0.012, 3000),
  'amb:wind': () => noise(1.6, 0.02, 400 + Math.random() * 300),
  'amb:chime': () => { const f = [1320, 1568, 1760, 2093][Math.floor(Math.random() * 4)]; tone(f, 0.9, 'sine', 0.025); },
  'amb:frog': () => { tone(150, 0.08, 'square', 0.02, -30); setTimeout(() => tone(140, 0.1, 'square', 0.02, -30), 140); },
  'amb:bubble': () => tone(300, 0.08, 'sine', 0.02, 500),
  'amb:rumble': () => { tone(48, 1.2, 'sawtooth', 0.05, -10); noise(1, 0.03, 160); },
  'amb:crackle': () => { for (let i = 0; i < 4; i++) setTimeout(() => noise(0.02, 0.03, 2500 + Math.random() * 1500), i * 60 + Math.random() * 40); },
  dig: (o) => { const m = mat(o.block); noise(0.07, 0.05, FREQ[m]); if (m === 'wood') tone(150, 0.06, 'square', 0.025); },
  break: (o) => { const m = mat(o.block); noise(0.16, 0.09, FREQ[m] * 0.8); tone(m === 'stone' ? 110 : 160, 0.1, 'triangle', 0.05); },
  place: (o) => { noise(0.05, 0.05, FREQ[mat(o.block)]); tone(210, 0.07, 'triangle', 0.06, -60); },
  step: (o) => { noise(0.045, 0.018, FREQ[mat(o.block)] * 0.5); },
  land: (o) => { noise(0.1, 0.05, 350); },
  hit: () => { noise(0.1, 0.09, 1300); tone(180, 0.08, 'sawtooth', 0.05, -80); },
  hurt: () => { tone(220, 0.22, 'sawtooth', 0.07, -130); noise(0.12, 0.05, 700); },
  pickup: () => { tone(880, 0.07, 'sine', 0.06, 440); },
  craft: () => { tone(520, 0.08, 'triangle', 0.06); tone(780, 0.1, 'triangle', 0.06, 0, 0.0); },
  click: () => { tone(660, 0.04, 'square', 0.03); },
  talk: () => { tone(300, 0.05, 'triangle', 0.04); tone(360, 0.05, 'triangle', 0.04); },
  boss: () => { tone(70, 0.9, 'sawtooth', 0.09, -25); noise(0.5, 0.06, 200); },
  victory: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.07, 0, 0)); },
  swing: () => { noise(0.06, 0.03, 2000); },
  die: () => { tone(260, 0.6, 'sawtooth', 0.08, -200); },
};

export const sfx = {
  stats,
  play(name, o = {}) {
    stats[name] = (stats[name] || 0) + 1;
    if (name === 'voice') { const k = 'voice:' + o.intent; stats[k] = (stats[k] || 0) + 1; }
    try { sounds[name] && sounds[name](o); } catch (e) { /* âm thanh không được làm hỏng game */ }
  },
};
