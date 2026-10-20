// Đạo diễn âm thanh: nối nhạc nền, âm thanh môi trường và tiếng kêu của quái với trạng thái game.
// Không giữ DOM; nhận sfx và hàm phát nốt từ ngoài để test được bằng đồ giả.
import { createScore, pickAmbient } from './score.js';
import { tone, noise, createMusic } from '../../../platform/core/audio.js';

export function playNote(n, t) {
  if (n.kind === 'tone') tone(n.f, n.len, n.wave, n.vol, 0, t, 'music');
  else if (n.kind === 'kick') tone(110, 0.2, 'sine', n.vol, -80, t, 'music');
  else if (n.kind === 'snare') noise(0.12, n.vol, 1800, 'music', t);
  else if (n.kind === 'hat') noise(0.035, n.vol, 7000, 'music', t);
}

export function createDirector({ sfx, emit = playNote, rnd = Math.random, start = true } = {}) {
  const score = createScore(emit), music = start ? createMusic((step, t) => score.playStep(step, t)) : null;
  const seen = new Map();                     // id -> { st, next, hp, type, dist }
  let ambT = 4, hitVoiceT = 0;
  const api = {
    score, seen,
    start() { music && music.start(); },
    stop() { music && music.stop(); },
    // ctx: { region, night, boss (có boss trong tầm), mobs: [{ id, type, st, hp, dist }] }
    update(dt, ctx) {
      score.setContext({ region: ctx.region, night: ctx.night, boss: ctx.boss });
      ambT -= dt;
      if (ambT <= 0) { ambT = 3 + rnd() * 6; const a = pickAmbient(ctx.region, ctx.night, rnd()); if (a) sfx.play('amb:' + a); }
      hitVoiceT -= dt;
      const live = new Set();
      for (const m of ctx.mobs) {
        live.add(m.id);
        let s = seen.get(m.id);
        if (!s) { s = { st: m.st, next: 4 + rnd() * 10, hp: m.hp, type: m.type, dist: m.dist }; seen.set(m.id, s); }
        if (m.st === 2 && s.st !== 2) sfx.play('voice', { type: m.type, intent: 'alert', dist: m.dist });
        else if (m.st === 0 && m.dist < 20 && (s.next -= dt) <= 0) { s.next = 7 + rnd() * 12; sfx.play('voice', { type: m.type, intent: 'idle', dist: m.dist }); }
        s.st = m.st; s.hp = m.hp; s.dist = m.dist;
      }
      for (const [id, s] of seen) if (!live.has(id)) { if (s.hp > 0 && s.dist < 30) sfx.play('voice', { type: s.type, intent: 'die', dist: s.dist }); seen.delete(id); }
    },
    hurt(m) { if (hitVoiceT <= 0) { hitVoiceT = 0.25; sfx.play('voice', { type: m.type, intent: 'hurt', dist: m.dist, boss: m.kind === 'boss' }); } },
  };
  return api;
}
