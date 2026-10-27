// Mưa, tuyết và sét ở máy khách. Chỉ vẽ: trạng thái thời tiết do máy chủ quyết định (snap.wx).
export function createWeather(sc) {
  const T = sc.THREE, root = new T.Group(); root.frustumCulled = false; sc.scene.add(root);
  const BOX = 22, TOP = 16, RAIN_N = 700, SNOW_N = 500;
  let density = 1, cover = 0, level = 0;
  const rnd = () => Math.random();
  // mưa: các vạch rơi nghiêng
  const rp = new Float32Array(RAIN_N * 3), rg = new T.BufferGeometry(), rv = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) { rp[i * 3] = (rnd() - 0.5) * 2 * BOX; rp[i * 3 + 1] = rnd() * TOP * 2 - TOP; rp[i * 3 + 2] = (rnd() - 0.5) * 2 * BOX; }
  rg.setAttribute('position', new T.BufferAttribute(rv, 3)); rg.setDrawRange(0, RAIN_N * 2);
  const rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: '#dbe8ff', transparent: true, opacity: 0, fog: false, depthWrite: false })); rain.frustumCulled = false; rain.renderOrder = 6; rain.visible = false; root.add(rain);
  // tuyết: điểm trắng rơi chậm, lắc ngang
  const sp = new Float32Array(SNOW_N * 3), sg = new T.BufferGeometry(), sv = new Float32Array(SNOW_N * 3);
  for (let i = 0; i < SNOW_N; i++) { sp[i * 3] = (rnd() - 0.5) * 2 * BOX; sp[i * 3 + 1] = rnd() * TOP * 2 - TOP; sp[i * 3 + 2] = (rnd() - 0.5) * 2 * BOX; }
  sg.setAttribute('position', new T.BufferAttribute(sv, 3));
  const snow = new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); snow.frustumCulled = false; snow.renderOrder = 6; snow.visible = false; root.add(snow);
  // tia sét
  const boltMat = new T.LineBasicMaterial({ color: '#f4f0ff', transparent: true, opacity: 1, fog: false }); let bolt = null, boltLife = 0;
  let t = 0;

  return {
    get level() { return level; }, set density(v) { density = v; },
    // kind: 'rain' | 'snow' | null; target: 0..1 độ nặng hạt; covered: có mái che trên đầu
    update(dt, cam, kind, target, covered) {
      t += dt;
      level += (target - level) * Math.min(1, dt * 0.6);
      cover += ((covered ? 1 : 0) - cover) * Math.min(1, dt * 4);
      const vis = kind ? level * (1 - cover) : 0;
      rain.visible = kind === 'rain' && vis > 0.02; snow.visible = kind === 'snow' && vis > 0.02;
      root.position.set(cam.x, cam.y, cam.z);
      if (rain.visible) {
        const n = Math.max(40, Math.floor(RAIN_N * density * Math.min(1, 0.35 + level)));
        rain.material.opacity = 0.85 * vis; rg.setDrawRange(0, n * 2);
        for (let i = 0; i < n; i++) {
          let y = rp[i * 3 + 1] - (22 + (i % 7)) * dt; if (y < -TOP) { y += TOP * 2; rp[i * 3] = (rnd() - 0.5) * 2 * BOX; rp[i * 3 + 2] = (rnd() - 0.5) * 2 * BOX; }
          rp[i * 3 + 1] = y; const x = rp[i * 3], z = rp[i * 3 + 2];
          rv[i * 6] = x; rv[i * 6 + 1] = y; rv[i * 6 + 2] = z; rv[i * 6 + 3] = x + 0.12; rv[i * 6 + 4] = y - 1.1; rv[i * 6 + 5] = z + 0.04;
        }
        rg.attributes.position.needsUpdate = true;
      }
      if (snow.visible) {
        const n = Math.max(40, Math.floor(SNOW_N * density * Math.min(1, 0.4 + level)));
        snow.material.opacity = 0.9 * vis; sg.setDrawRange(0, n);
        for (let i = 0; i < n; i++) {
          let y = sp[i * 3 + 1] - (2.2 + (i % 5) * 0.3) * dt; if (y < -TOP) { y += TOP * 2; sp[i * 3] = (rnd() - 0.5) * 2 * BOX; sp[i * 3 + 2] = (rnd() - 0.5) * 2 * BOX; }
          sp[i * 3 + 1] = y; sv[i * 3] = sp[i * 3] + Math.sin(t * 0.9 + i) * 0.6; sv[i * 3 + 1] = y; sv[i * 3 + 2] = sp[i * 3 + 2] + Math.cos(t * 0.7 + i * 1.3) * 0.6;
        }
        sg.attributes.position.needsUpdate = true;
      }
      if (bolt) { boltLife -= dt; boltMat.opacity = Math.max(0, boltLife / 0.35); if (boltLife <= 0) { sc.scene.remove(bolt); bolt.geometry.dispose(); bolt = null; } }
    },
    // tia sét đánh xuống (x, y, z) là chân tia
    strike(x, y, z) {
      if (bolt) { sc.scene.remove(bolt); bolt.geometry.dispose(); }
      const pts = []; let cx = x, cz = z;
      for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new T.Vector3(cx, y + 70 * (1 - k), cz)); cx += (rnd() - 0.5) * 5 * (1 - k * 0.4); cz += (rnd() - 0.5) * 5 * (1 - k * 0.4); }
      pts[12].set(x, y, z);
      bolt = new T.Line(new T.BufferGeometry().setFromPoints(pts), boltMat); bolt.frustumCulled = false; bolt.renderOrder = 7; sc.scene.add(bolt); boltLife = 0.35; boltMat.opacity = 1;
    },
    get boltVisible() { return !!bolt; },
  };
}
