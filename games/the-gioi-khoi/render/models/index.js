// Sổ mô hình: ánh xạ loại thực thể -> mô hình, dựng texture + geometry + vật liệu một lần rồi dùng chung.
import { hash } from '../../world/noise.js';
import { packUV, faceRect, makePainter, buildGeometry, instantiate, animate } from './kit.js';
import { playerModel, ZOMBIE, SKELETON, NPC_MODELS, ICE_EMPEROR } from './humanoids.js';
import { wolfModel, deerModel, scorpionModel, bearModel, wraithModel, golemModel } from './beasts.js';
import { chickenModel, sheepModel, pigModel } from './farm.js';
import { frogModel, snakeModel, crocModel, shroomModel, lizardModel, fireSpiritModel, spiderModel, crystalRabbitModel, sentinelModel, foxModel } from './creatures.js';

export { animate };

export const MOB_MODELS = { 'soi-xam': 'wolf', 'nai': 'deer', 'xac-song': 'zombie', 'bo-cap': 'scorpion', 'xuong-cung': 'skeleton', 'gau-bang': 'bear', 'ma-bang': 'wraith', 'tuong-da': 'golem',
  'ech-doc': 'frog', 'ran-lay': 'snake', 'ca-sau': 'croc', 'nam-di': 'shroom', 'than-lan-nham': 'lizard', 'linh-hoa': 'fire-spirit',
  'nhen-pha-le': 'spider', 'tho-pha-le': 'crystal-rabbit', 'khoi-pha-le': 'sentinel', 'cao-lua': 'fox', 'ga': 'chicken', 'cuu': 'sheep', 'lon': 'pig' };
const BOSS_MODEL = { 'thu-linh-soi': 'wolf-lord', 'bo-cap-chua': 'scorpion-queen', 'bang-de': 'ice-emperor', 'chua-dam-lay': 'swamp-king', 'vua-nham-thach': 'magma-king', 'ho-ve-pha-le': 'crystal-guardian' };

// Bảng màu người chơi: 12 kiểu để mỗi người nhìn khác nhau (chọn theo uid).
const SKINS = ['#f1c8a0', '#e0ac7e', '#c68a5c', '#8d5a3a', '#f4d3b8'];
const HAIR = ['#2a1c14', '#5a3a22', '#c9a23a', '#a03a1c', '#d8d8d8', '#14141a'];
const SHIRT = ['#3b6fd6', '#d63b4a', '#3bb06f', '#e0a22c', '#8a4bd6', '#2fb5c4', '#d6683b', '#5a6270'];
export function playerStyle(uid) {
  const h = (k) => Math.floor(hash(131, [...String(uid)].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, k), k) * 997);
  return { skin: SKINS[h(1) % SKINS.length], hair: HAIR[h(2) % HAIR.length], shirt: SHIRT[h(3) % SHIRT.length], pants: ['#33384a', '#3a2f26', '#2a3b2f'][h(4) % 3] };
}

export function modelIdFor(e) {
  if (e.kind === 'mob') return e.type === 'cuu' && e.sh ? 'sheep-shorn' : MOB_MODELS[e.type];          // cừu đã cắt len đổi sang mô hình trọc
  if (e.kind === 'boss') return BOSS_MODEL[e.type];
  if (e.kind === 'npc') return 'npc:' + e.npc;
  if (e.kind === 'player') { const s = playerStyle(e.uid || e.name || ''); return 'player:' + s.skin + s.hair + s.shirt + s.pants; }
  return null;
}

function definition(id) {
  if (id.startsWith('player:')) { const rest = id.slice(7); return playerModel({ skin: rest.slice(0, 7), hair: rest.slice(7, 14), shirt: rest.slice(14, 21), pants: rest.slice(21, 28) }); }
  if (id.startsWith('npc:')) return NPC_MODELS[id.slice(4)];
  switch (id) {
    case 'wolf': return wolfModel(); case 'wolf-lord': return wolfModel({ boss: true }); case 'deer': return deerModel();
    case 'zombie': return ZOMBIE; case 'skeleton': return SKELETON; case 'scorpion': return scorpionModel(); case 'scorpion-queen': return scorpionModel({ boss: true });
    case 'frog': return frogModel(); case 'snake': return snakeModel(); case 'croc': return crocModel(); case 'swamp-king': return crocModel({ boss: true }); case 'magma-king': return lizardModel({ boss: true }); case 'crystal-guardian': return sentinelModel({ boss: true }); case 'shroom': return shroomModel(); case 'lizard': return lizardModel();
    case 'fire-spirit': return fireSpiritModel(); case 'spider': return spiderModel(); case 'crystal-rabbit': return crystalRabbitModel(); case 'sentinel': return sentinelModel(); case 'fox': return foxModel();
    case 'chicken': return chickenModel(); case 'sheep': return sheepModel(); case 'sheep-shorn': return sheepModel({ shorn: true }); case 'pig': return pigModel();
    case 'bear': return bearModel(); case 'wraith': return wraithModel(); case 'golem': return golemModel(); case 'ice-emperor': return ICE_EMPEROR;
  }
  throw new Error('không có mô hình: ' + id);
}

export const ALL_MODEL_IDS = ['wolf', 'deer', 'zombie', 'scorpion', 'skeleton', 'bear', 'wraith', 'golem', 'wolf-lord', 'scorpion-queen', 'ice-emperor', 'swamp-king', 'magma-king', 'crystal-guardian',
  'frog', 'snake', 'croc', 'shroom', 'lizard', 'fire-spirit', 'spider', 'crystal-rabbit', 'sentinel', 'fox', 'chicken', 'sheep', 'sheep-shorn', 'pig',
  'npc:truong-lang', 'npc:tho-ren', 'npc:thuong-nhan', 'npc:an-si', 'npc:ngu-dan', 'npc:tho-lua', 'npc:hoc-gia', 'player:' + '#f1c8a0#2a1c14#3b6fd6#33384a'];

// Thư viện mô hình gắn với một THREE và document.
export function createModelLib(T, doc = document) {
  const built = new Map();
  const mats = new Set();
  let light = 1;

  function build(id) {
    const model = definition(id);
    const parts = model.parts.map(p => ({ ...p }));
    const m = { ...model, parts, TH: 0 };
    m.TH = packUV(parts, m.TW);
    const byId = Object.fromEntries(parts.map(p => [p.id, p]));
    const R = (pid, face) => { if (!byId[pid]) throw new Error(`${id}: khối không tồn tại "${pid}"`); return faceRect(byId[pid], face); };
    const P = makePainter(doc, m.TW, m.TH, [...id].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7));
    m.paint(P, R);
    const canvas = P.flush();
    const tex = new T.CanvasTexture(canvas); tex.magFilter = T.NearestFilter; tex.minFilter = T.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = T.SRGBColorSpace;
    const geometry = buildGeometry(T, m);
    const material = new T.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.35, transparent: !!m.transparent, opacity: m.transparent ? 0.82 : 1, depthWrite: !m.transparent });
    const flash = material.clone(); flash.userData.red = true; flash.color.setRGB(1, 0.3, 0.3);
    mats.add(material); mats.add(flash);
    return { id, model: m, geometry, material, flash, canvas, parts, byId };
  }

  return {
    get(id) { if (!built.has(id)) built.set(id, build(id)); return built.get(id); },
    spawn(id) { const b = this.get(id); const rig = instantiate(T, b.model, b.geometry, b.material); rig.lib = b; return rig; },
    setLight(l) { light = Math.max(0.35, l); for (const m of mats) { if (m.userData.red) m.color.setRGB(light, light * 0.3, light * 0.3); else m.color.setScalar(light); } },
    all: () => [...built.values()],
    materials: mats,
  };
}
