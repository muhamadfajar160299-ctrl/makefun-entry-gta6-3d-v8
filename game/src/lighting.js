// Marina Nights — lighting & mood. ACES filmic tone mapping, exposure ~1.28,
// real moon shadows (PCF soft, frustum follows the player), a moon halo,
// and a cooler, higher-contrast night grade so the city reads like a real
// place after rain: deep shadows, warm pools of lamp light, wet shine.
// Also re-reads the ?shot= parameter from the URL whenever a shot is applied
// (never a hard-coded shot number).
const THREE = window.THREE;

export function createLighting(scene, renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Real-time shadows: the moon is the only shadow caster, so the pass stays
  // cheap even on SwiftShader. Palms/lamps skip shadows; buildings and cars
  // cast, roads and ground receive.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.background = new THREE.Color(0x081426);
  scene.fog = new THREE.Fog(0x081426, 200, 600);

  // Lower, cooler ambient than v9: night should have real dark, with the
  // warmth coming from lamps and windows instead of a flat wash.
  const ambient = new THREE.AmbientLight(0x6d84ad, 0.62);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x8fb4e8, 0x1c2836, 0.8);
  scene.add(hemi);

  // Moon: strong cool directional light so streets and cars stay readable.
  // Casts the scene's shadows; the shadow frustum rides along with the
  // player (see update()).
  const moon = new THREE.DirectionalLight(0xdfeaff, 1.6);
  moon.position.set(120, 190, 70);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -95;
  moon.shadow.camera.right = 95;
  moon.shadow.camera.top = 95;
  moon.shadow.camera.bottom = -95;
  moon.shadow.camera.near = 10;
  moon.shadow.camera.far = 520;
  moon.shadow.bias = -0.0006;
  scene.add(moon);
  scene.add(moon.target);

  // Warm marina glow from the east (bay side).
  const bayGlow = new THREE.DirectionalLight(0xffc98a, 0.35);
  bayGlow.position.set(220, 60, -40);
  scene.add(bayGlow);

  // The moon disc itself, high in the sky, plus a soft halo so it blooms
  // against the night sky instead of looking like a flat sticker.
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: 0xf4f8ff, fog: false })
  );
  moonDisc.position.set(-260, 240, -320);
  moonDisc.lookAt(0, 0, 0);
  scene.add(moonDisc);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({
      color: 0x9db8e8, fog: false, transparent: true, opacity: 0.16,
    })
  );
  halo.position.copy(moonDisc.position).multiplyScalar(1.001);
  halo.lookAt(0, 0, 0);
  scene.add(halo);

  // Stars: tiny bright points scattered overhead, two sizes so the sky
  // has depth instead of uniform grain.
  function makeStars(count, size, y0, y1) {
    const geo = new THREE.BufferGeometry();
    const pos = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 380 + Math.random() * 180;
      pos.push(Math.cos(a) * r, y0 + Math.random() * (y1 - y0), Math.sin(a) * r);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xcfe4ff, size, sizeAttenuation: false, fog: false,
    }));
    scene.add(pts);
    return pts;
  }
  const stars = makeStars(300, 1.6, 150, 370);
  const starsBright = makeStars(90, 2.6, 180, 360);

  return {
    // Keep the moon's shadow frustum centred on the player so shadows stay
    // crisp wherever the car drives (a fixed 190 m frustum would smear).
    update(playerPos) {
      if (!playerPos) return;
      moon.position.set(playerPos.x + 120, 190, playerPos.z + 70);
      moon.target.position.set(playerPos.x, 0, playerPos.z);
      moon.target.updateMatrixWorld();
    },
    // Re-reads ?shot= from the live URL every time it is called.
    applyShot() {
      let n = 0;
      try {
        n = parseInt(new URLSearchParams(window.location.search).get('shot') || '0', 10) || 0;
      } catch (e) { n = 0; }
      if (n === 2) {
        // Marina shot: slightly warmer, brighter promenade.
        renderer.toneMappingExposure = 1.38;
        bayGlow.intensity = 0.55;
      } else if (n === 1) {
        // Chase shot: punchier contrast.
        renderer.toneMappingExposure = 1.32;
      } else if (n === 4) {
        renderer.toneMappingExposure = 1.34;
      } else {
        renderer.toneMappingExposure = 1.28;
        bayGlow.intensity = 0.35;
      }
      return n;
    },
  };
}
