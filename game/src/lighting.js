// lighting.js — night lighting for Velmara Bay: real moon shadows that follow
// the player, a haloed moon, two sizes of stars, fog and a contrast night grade.
const THREE = window.THREE;

function makeMoonTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const halo = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  halo.addColorStop(0, 'rgba(235,242,255,1)');
  halo.addColorStop(0.22, 'rgba(210,224,255,0.95)');
  halo.addColorStop(0.35, 'rgba(160,185,240,0.28)');
  halo.addColorStop(0.65, 'rgba(120,150,220,0.10)');
  halo.addColorStop(1, 'rgba(120,150,220,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, 256, 256);
  // craters on the disc
  g.fillStyle = 'rgba(170,185,215,0.5)';
  const craters = [[112, 108, 9], [140, 132, 6], [122, 142, 5], [146, 108, 4], [108, 130, 4]];
  for (const [x, y, r] of craters) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStarField(count, size, spread, yMin, yMax) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = spread * (0.35 + Math.random() * 0.65);
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = yMin + Math.random() * (yMax - yMin);
    positions[i * 3 + 2] = Math.sin(a) * r;
    const warm = Math.random() < 0.25;
    const b = 0.55 + Math.random() * 0.45;
    colors[i * 3] = warm ? b : b * 0.85;
    colors[i * 3 + 1] = warm ? b * 0.85 : b * 0.92;
    colors[i * 3 + 2] = warm ? b * 0.7 : b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.9, depthWrite: false, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

export function createLighting(scene, renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.background = new THREE.Color(0x070b1a);
  scene.fog = new THREE.FogExp2(0x0a1024, 0.0016);

  // Moon: the key light. Shadow camera frustum is re-centred on the player
  // every frame so shadows stay crisp wherever you drive.
  const moon = new THREE.DirectionalLight(0xbfd0ff, 2.1);
  moon.position.set(-140, 220, -90);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.near = 20;
  moon.shadow.camera.far = 520;
  moon.shadow.camera.left = -95;
  moon.shadow.camera.right = 95;
  moon.shadow.camera.top = 95;
  moon.shadow.camera.bottom = -95;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.02;
  scene.add(moon);
  scene.add(moon.target);

  // Cool sky fill so shadowed faces never go pitch black.
  const hemi = new THREE.HemisphereLight(0x2a3a66, 0x0b0d18, 0.95);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x1a2340, 0.75);
  scene.add(ambient);

  // Moon disc + halo, hung low in the east over the sea.
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeMoonTexture(), transparent: true, depthWrite: false, fog: false,
  }));
  moonSprite.position.set(420, 190, -260);
  moonSprite.scale.set(150, 150, 1);
  scene.add(moonSprite);

  // Two star layers: many small pinpricks, fewer larger bright stars.
  const starsSmall = makeStarField(700, 1.4, 700, 120, 520);
  const starsBig = makeStarField(130, 2.6, 650, 140, 480);
  scene.add(starsSmall);
  scene.add(starsBig);

  let twinkle = 0;
  return {
    moon,
    update(dt, playerPos, timeSec) {
      twinkle += dt;
      // Shadow frustum tracks the player.
      moon.position.set(playerPos.x - 140, 220, playerPos.z - 90);
      moon.target.position.set(playerPos.x, 0, playerPos.z);
      moon.target.updateMatrixWorld();
      // Gentle star twinkle.
      starsBig.material.opacity = 0.72 + Math.sin(twinkle * 1.7) * 0.18;
      starsSmall.material.opacity = 0.8 + Math.sin(twinkle * 2.3 + 1.4) * 0.12;
      // Moon halo breathes almost imperceptibly.
      const s = 150 + Math.sin(timeSec * 0.11) * 2.5;
      moonSprite.scale.set(s, s, 1);
    },
  };
}
