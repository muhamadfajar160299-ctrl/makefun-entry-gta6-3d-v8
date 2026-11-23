// Marina Nights — lighting & mood. ACES filmic tone mapping, exposure ~1.28,
// bright ambient / hemisphere / moon so the night city reads vivid and crisp,
// never murky. Also re-reads the ?shot= parameter from the URL whenever a
// shot is applied (never a hard-coded shot number).
const THREE = window.THREE;

export function createLighting(scene, renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.background = new THREE.Color(0x0a1a33);
  scene.fog = new THREE.Fog(0x0a1a33, 220, 620);

  const ambient = new THREE.AmbientLight(0x8fa8cc, 0.85);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x9fc4ff, 0x2c3a4d, 0.95);
  scene.add(hemi);

  // Moon: strong cool directional light so streets and cars stay readable.
  const moon = new THREE.DirectionalLight(0xdfeaff, 1.35);
  moon.position.set(120, 190, 70);
  scene.add(moon);

  // Warm marina glow from the east (bay side).
  const bayGlow = new THREE.DirectionalLight(0xffc98a, 0.35);
  bayGlow.position.set(220, 60, -40);
  scene.add(bayGlow);

  // The moon disc itself, high in the sky.
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: 0xf4f8ff, fog: false })
  );
  moonDisc.position.set(-260, 240, -320);
  moonDisc.lookAt(0, 0, 0);
  scene.add(moonDisc);

  // Stars: tiny bright points scattered overhead.
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 420; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 380 + Math.random() * 180;
    starPos.push(Math.cos(a) * r, 150 + Math.random() * 220, Math.sin(a) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcfe4ff, size: 1.6, sizeAttenuation: false, fog: false,
  }));
  scene.add(stars);

  return {
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
