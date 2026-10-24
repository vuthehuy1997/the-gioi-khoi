// Hiệu ứng camera kiểu Minecraft: nhún khi đi, FOV rộng ra khi chạy, nghiêng khi trúng đòn; và cánh tay + vật đang cầm vung khi đào/đánh.
import { ITEMS } from '../content/items.js';

const BASE_FOV = 72, SPRINT_FOV = 80;

// Hàm thuần để test: trạng thái -> trạng thái mới.
// rolling: 0 hoặc ±1 (bên lăn); camera hạ thấp và nghiêng nhẹ trong lúc lăn.
export function stepCameraFx(st, dt, { moving, sprint, onGround, speed, rolling = 0 }) {
  const target = sprint && moving ? SPRINT_FOV : BASE_FOV;
  st.fov += (target - st.fov) * Math.min(1, dt * 8);
  if (moving && onGround) st.bob += dt * (sprint ? 12 : 9) ; else st.bobAmp = st.bobAmp;
  const amp = moving && onGround ? Math.min(1, speed / 4) : 0;
  st.bobAmp += (amp - st.bobAmp) * Math.min(1, dt * 10);
  st.tilt *= Math.max(0, 1 - dt * 7); st.kick = (st.kick || 0) * Math.max(0, 1 - dt * 12);
  if (rolling) st.rollSide = rolling;
  st.roll += ((rolling ? 1 : 0) - st.roll) * Math.min(1, dt * 14);
  return st;
}
export const newCameraFx = () => ({ fov: BASE_FOV, bob: 0, bobAmp: 0, tilt: 0, kick: 0, roll: 0, rollSide: 1 });

export function createHand(sc) {
  const T = sc.THREE, g = new T.Group();
  const arm = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.42), new T.MeshBasicMaterial({ color: '#e8c39e' }));
  arm.position.set(0.2, -0.24, -0.1); arm.rotation.set(0.1, 0.1, 0);
  const item = new T.Mesh(new T.PlaneGeometry(0.5, 0.5), new T.MeshBasicMaterial({ transparent: true, side: T.DoubleSide, depthTest: false }));
  item.position.set(0.1, 0.02, -0.55); item.rotation.set(0, -0.35, 0.25); item.visible = false;
  const off = new T.Mesh(new T.PlaneGeometry(0.5, 0.5), new T.MeshBasicMaterial({ transparent: true, side: T.DoubleSide, depthTest: false }));      // khiên ở tay trái
  off.position.set(-0.55, -0.5, -0.85); off.rotation.set(0.1, 0.5, -0.1); off.visible = false;
  g.add(arm, item, off);
  g.position.set(0.42, -0.42, -0.7); g.rotation.set(-0.1, -0.2, 0);
  sc.camera.add(g); sc.scene.add(sc.camera);
  g.traverse(m => { if (m.isMesh) { m.renderOrder = 20; m.material.depthTest = false; } });
  let swing = 0, held = null, url = null, offId = null, offUrl = null, pose = { guard: false, draw: 0 }, gk = 0, dk = 0;
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
    // khiên ở tay trái (id: khiên đang đeo; iconUrl: ảnh icon)
    setOff(id, iconUrl) {
      if (id === offId && iconUrl === offUrl) return; offId = id; offUrl = iconUrl; off.visible = !!id;
      if (id && iconUrl) { const img = new Image(); img.onload = () => { const t = new T.Texture(img); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; off.material.map = t; off.material.needsUpdate = true; }; img.src = iconUrl; }
    },
    // tư thế: guard (giơ khiên), draw 0..1 (kéo cung: vật cầm kéo về phía người, rung nhẹ khi đầy)
    setPose(p) { pose = p; },
    get offVisible() { return off.visible; }, get guardK() { return gk; },
    update(dt, bobPhase, bobAmp) {
      gk += ((pose.guard ? 1 : 0) - gk) * Math.min(1, dt * 14); dk += (pose.draw - dk) * Math.min(1, dt * 20);
      off.position.set(-0.55 + gk * 0.42, -0.5 + gk * 0.38, -0.85 + gk * 0.1); off.rotation.set(0.1 - gk * 0.2, 0.5 - gk * 0.5, -0.1);
      item.position.set(0.1 - dk * 0.12, 0.02 + dk * 0.03 + (dk >= 1 ? Math.sin(performance.now() / 25) * 0.004 : 0), -0.55 + dk * 0.22);
      swing = Math.max(0, swing - dt);
      const s = swing / 0.28, sw = s > 0 ? Math.sin((1 - s) * Math.PI) : 0;
      g.rotation.x = -0.1 - sw * 0.9; g.rotation.z = sw * 0.3;
      g.position.set(0.42 + Math.sin(bobPhase) * 0.015 * bobAmp, -0.42 - Math.abs(Math.cos(bobPhase)) * 0.02 * bobAmp - sw * 0.04, -0.7 - sw * 0.12);
    },
  };
}
