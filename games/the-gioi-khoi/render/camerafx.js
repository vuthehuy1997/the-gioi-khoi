// Hiệu ứng camera kiểu Minecraft: nhún khi đi, FOV rộng ra khi chạy, nghiêng khi trúng đòn; và cánh tay + vật đang cầm vung khi đào/đánh.
import { ITEMS } from '../content/items.js';

const BASE_FOV = 72, SPRINT_FOV = 80;

// Hàm thuần để test: trạng thái -> trạng thái mới.
export function stepCameraFx(st, dt, { moving, sprint, onGround, speed }) {
  const target = sprint && moving ? SPRINT_FOV : BASE_FOV;
  st.fov += (target - st.fov) * Math.min(1, dt * 8);
  if (moving && onGround) st.bob += dt * (sprint ? 12 : 9) ; else st.bobAmp = st.bobAmp;
  const amp = moving && onGround ? Math.min(1, speed / 4) : 0;
  st.bobAmp += (amp - st.bobAmp) * Math.min(1, dt * 10);
  st.tilt *= Math.max(0, 1 - dt * 7);
  return st;
}
export const newCameraFx = () => ({ fov: BASE_FOV, bob: 0, bobAmp: 0, tilt: 0 });

export function createHand(sc) {
  const T = sc.THREE, g = new T.Group();
  const arm = new T.Mesh(new T.BoxGeometry(0.13, 0.13, 0.5), new T.MeshBasicMaterial({ color: '#e8c39e' }));
  arm.position.set(0.18, -0.18, -0.15); arm.rotation.set(0.1, 0.1, 0);
  const item = new T.Mesh(new T.PlaneGeometry(0.5, 0.5), new T.MeshBasicMaterial({ transparent: true, side: T.DoubleSide, depthTest: false }));
  item.position.set(0.1, 0.02, -0.55); item.rotation.set(0, -0.35, 0.25); item.visible = false;
  g.add(arm, item);
  g.position.set(0.42, -0.42, -0.7); g.rotation.set(-0.1, -0.2, 0);
  sc.camera.add(g); sc.scene.add(sc.camera);
  g.traverse(m => { if (m.isMesh) { m.renderOrder = 20; m.material.depthTest = false; } });
  let swing = 0, held = null, url = null;
  return {
    group: g, item, get swinging() { return swing > 0; },
    swing() { swing = 0.28; },
    // id: vật phẩm đang cầm; iconUrl: ảnh icon (data URL) để vẽ lên tấm phẳng
    setHeld(id, iconUrl) {
      if (id === held && iconUrl === url) return; held = id; url = iconUrl;
      const it = id && ITEMS[id]; item.visible = !!it;
      if (it && iconUrl) {
        const img = new Image(); img.onload = () => { const t = new T.Texture(img); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; item.material.map = t; item.material.needsUpdate = true; };
        img.src = iconUrl;
      }
    },
    update(dt, bobPhase, bobAmp) {
      swing = Math.max(0, swing - dt);
      const s = swing / 0.28, sw = s > 0 ? Math.sin((1 - s) * Math.PI) : 0;
      g.rotation.x = -0.1 - sw * 0.9; g.rotation.z = sw * 0.3;
      g.position.set(0.42 + Math.sin(bobPhase) * 0.015 * bobAmp, -0.42 - Math.abs(Math.cos(bobPhase)) * 0.02 * bobAmp - sw * 0.04, -0.7 - sw * 0.12);
    },
  };
}
