// Bầu trời: vòm gradient, mặt trời, mặt trăng, sao, mây khối. Chỉ vẽ; không logic game. update() gọi mỗi khung.
import { hash, fbm2 } from '../world/noise.js';
import { DAY_LEN } from '../sim/daynight.js';

const R = 300;
const lerp = (a, b, t) => a + (b - a) * t;

function pixelTex(T, size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), img = x.createImageData(size, size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { const p = paint(i, j), o = (j * size + i) * 4; img.data.set(p, o); }
  x.putImageData(img, 0, 0);
  const t = new T.CanvasTexture(c); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.colorSpace = T.SRGBColorSpace; return t;
}

export function createSky(sc) {
  const T = sc.THREE, root = new T.Group(); sc.scene.add(root);

  // vòm trời
  const dg = new T.SphereGeometry(R, 24, 14), n = dg.attributes.position.count;
  dg.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3));
  const dome = new T.Mesh(dg, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10; dome.frustumCulled = false; root.add(dome);

  // mặt trời và mặt trăng: ô vuông pixel như Minecraft
  const sunTex = pixelTex(T, 16, (i, j) => { const d = Math.max(Math.abs(i - 7.5), Math.abs(j - 7.5)); return d < 5 ? [255, 244, 170, 255] : d < 7 ? [255, 214, 96, 220] : [0, 0, 0, 0]; });
  const moonTex = pixelTex(T, 16, (i, j) => { const d = Math.max(Math.abs(i - 7.5), Math.abs(j - 7.5)); const crater = (i * 7 + j * 3) % 11 === 0; return d < 5 ? (crater ? [170, 176, 190, 255] : [225, 230, 242, 255]) : [0, 0, 0, 0]; });
  const mk = (tex, size) => { const m = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false, side: T.DoubleSide })); m.renderOrder = -9; m.frustumCulled = false; root.add(m); return m; };
  const sun = mk(sunTex, 60), moon = mk(moonTex, 44);

  // sao
  const sp = new Float32Array(400 * 3);
  for (let i = 0; i < 400; i++) { const u = hash(7, i, 1) * 2 - 1, a = hash(7, i, 2) * Math.PI * 2, r = Math.sqrt(1 - u * u); sp[i * 3] = Math.cos(a) * r * R * 0.97; sp[i * 3 + 1] = Math.abs(u) * R * 0.97; sp[i * 3 + 2] = Math.sin(a) * r * R * 0.97; }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
  const stars = new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.renderOrder = -9; stars.frustumCulled = false; root.add(stars);

  // mây: một mặt phẳng lớn đi theo camera, hoạ tiết khối cuộn theo vị trí và thời gian
  const CT = 64, CELL = 12;
  const cloudTex = pixelTex(T, CT, (i, j) => (fbm2(99, i * 0.11, j * 0.11, 3) > 0.56 ? [255, 255, 255, 235] : [255, 255, 255, 0]));
  cloudTex.wrapS = cloudTex.wrapT = T.RepeatWrapping;
  const cloudMat = new T.MeshBasicMaterial({ map: cloudTex, transparent: true, fog: false, depthWrite: false, side: T.DoubleSide });
  const clouds = new T.Mesh(new T.PlaneGeometry(CT * CELL * 2, CT * CELL * 2), cloudMat);
  clouds.rotation.x = -Math.PI / 2; clouds.renderOrder = -8; clouds.frustumCulled = false; root.add(clouds);
  cloudTex.repeat.set(2, 2);

  let key = '';
  const tmpA = new T.Color(), tmpB = new T.Color(), top = new T.Color(), hor = new T.Color();

  return {
    root, dome, sun, moon, stars, clouds,
    // cam: vị trí camera; time: giây game; light: 0.25..1; skyHex/fogHex: màu vùng
    update(cam, time, light, skyHex, fogHex) {
      root.position.copy(cam);
      const p = ((time % DAY_LEN) + DAY_LEN) % DAY_LEN / DAY_LEN, th = (p - 0.05) * Math.PI * 2;
      const sd = new T.Vector3(Math.cos(th), Math.sin(th), 0.25).normalize(), md = sd.clone().multiplyScalar(-1);
      sun.position.copy(sd).multiplyScalar(R * 0.9); sun.lookAt(root.position); moon.position.copy(md).multiplyScalar(R * 0.9); moon.lookAt(root.position);
      sun.visible = sd.y > -0.12; moon.visible = md.y > -0.12;
      const night = 1 - (light - 0.25) / 0.75;
      stars.material.opacity = Math.max(0, night * 1.2 - 0.2);
      // màu vòm: đỉnh = màu trời sẫm hơn, chân trời = màu sương; ấm hơn khi bình minh/hoàng hôn
      const warm = Math.max(0, 1 - Math.abs(sd.y) * 5) * (light > 0.3 ? 1 : 0);
      const k = [skyHex, fogHex, light.toFixed(2), warm.toFixed(2)].join('|');
      if (k !== key) {
        key = k;
        top.set(skyHex).multiplyScalar(0.8).lerp(tmpA.set('#2a5fb8'), 0.35).multiplyScalar(Math.max(0.06, light)).lerp(tmpB.set('#050a24'), Math.min(1, (1 - light) * 1.1));
        hor.set(fogHex).lerp(tmpB.set('#ff9a5a'), warm * 0.55).multiplyScalar(Math.max(0.1, light));
        const pos = dg.attributes.position, col = dg.attributes.color;
        for (let i = 0; i < pos.count; i++) { const t = Math.max(0, Math.min(1, pos.getY(i) / R)), f = Math.pow(t, 0.55); col.setXYZ(i, lerp(hor.r, top.r, f), lerp(hor.g, top.g, f), lerp(hor.b, top.b, f)); }
        col.needsUpdate = true;
        cloudMat.color.setScalar(Math.max(0.28, light));
      }
      // mây ở độ cao 108, bám theo camera theo ô lưới để không bị trượt
      clouds.position.set(Math.round(cam.x / CELL) * CELL - cam.x, 108 - cam.y, Math.round(cam.z / CELL) * CELL - cam.z);
      const w = CT * CELL * 2;
      cloudTex.offset.set((Math.round(cam.x / CELL) * CELL) / (w / 2) * 0.5 + time * 0.0006, -((Math.round(cam.z / CELL) * CELL) / (w / 2)) * 0.5);
    },
  };
}
