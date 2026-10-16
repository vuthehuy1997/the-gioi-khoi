// Âm thanh tổng hợp bằng Web Audio (không cần file). sfx.play(tên) và sfx.stats để test đếm số lần phát.
import { tone, noise } from '../../platform/core/audio.js';
import { BLOCKS } from './world/blocks.js';

const stats = {};
const mat = id => { const b = BLOCKS[id]; if (!b) return 'stone'; if (b.tool === 'axe') return 'wood'; if (b.tool === 'shovel') return 'soft'; if (id === 7) return 'leaf'; if (b.plant) return 'leaf'; return 'stone'; };
const FREQ = { stone: 800, wood: 1000, soft: 450, leaf: 2400 };

const sounds = {
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
    try { sounds[name] && sounds[name](o); } catch (e) { /* âm thanh không được làm hỏng game */ }
  },
};
