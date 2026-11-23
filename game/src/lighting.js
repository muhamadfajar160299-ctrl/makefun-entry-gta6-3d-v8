// lighting.js — every light in Velmara Bay.
//
// Round 18 is a lighting pass: the night stays a night, but nothing may hide
// in it. The recipe is four layers that are all version-proof in three.js:
//   1. strong version-stable lights (ambient + hemisphere + moon directional
//      + a warm directional "chase fill" that rides with the hero car),
//   2. bright base material colours (no near-black facades or asphalt),
//   3. unlit emissive/basic materials for anything that must glow
//      (windows, signs, lamp heads, headlight cones, moon),
//   4. high tone-mapping exposure (1.7) with ACES filmic.
// Point lights are kept moderate and decayed gently so they read on any
// three.js light-mode, and every lamp also drops a fake additive light pool
// on the road, which no light-mode can dim.
const THREE = window.THREE;

export const NIGHT = {
  sky: 0x0d1730,
  fog: 0x16233d,
  ambient: 0xaebfe0,
  hemiSky: 0x8ba3d4,
  hemiGround: 0x5a4f42,
  moon: 0xd6e6ff,
  lamp: 0xffb46b,
  exposure: 1.7,
};

export function applyNightGrade(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = NIGHT.exposure;
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace !== undefined) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  renderer.shadowMap.enabled = false;
}

// A soft radial glow texture, drawn once, reused by halos and light pools.
export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.45, inner.replace(',1)', ',0.45)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStars(scene, count = 900) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.random() * Math.PI * 0.42 + 0.08;
    const r = 380;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    pos[i * 3 + 1] = Math.sin(e) * r;
    pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    const b = 0.55 + Math.random() * 0.45;
    const warm = Math.random() < 0.25;
    col[i * 3] = b * (warm ? 1 : 0.85);
    col[i * 3 + 1] = b * 0.9;
    col[i * 3 + 2] = b * (warm ? 0.75 : 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.7, vertexColors: true, sizeAttenuation: false,
    transparent: true, opacity: 0.95, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(geo, mat);
  scene.add(stars);
  return stars;
}

function makeMoon(scene, glowTex) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(14, 40),
    new THREE.MeshBasicMaterial({ color: 0xf6f1ff, fog: false }),
  );
  disc.position.set(-150, 190, -260);
  disc.lookAt(0, 0, 0);
  group.add(disc);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xbfd4ff, transparent: true, opacity: 0.55,
    depthWrite: false, fog: false,
  }));
  halo.scale.set(120, 120, 1);
  halo.position.copy(disc.position);
  group.add(halo);
  // A second, tighter halo for a crisp core glow.
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffffff, transparent: true, opacity: 0.7,
    depthWrite: false, fog: false,
  }));
  core.scale.set(48, 48, 1);
  core.position.copy(disc.position);
  group.add(core);
  scene.add(group);
  return group;
}

// One street lamp: pole, arm, glowing head, an additive pool of warm light
// on the road beneath it — and, only for a few lamps, a real point light.
// (A forward renderer pays for every point light in every pixel shader,
// so most lamps are carried by their pool + glowing head alone.)
function makeLamp(scene, x, z, glowTex, flicker = false, lit = true) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a4556, roughness: 0.6, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 7.2, 8), poleMat);
  pole.position.y = 3.6;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.09), poleMat);
  arm.position.set(0.8, 7.1, 0);
  g.add(arm);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.16, 0.34),
    new THREE.MeshBasicMaterial({ color: 0xffe2ae }),
  );
  head.position.set(1.6, 7.05, 0);
  g.add(head);
  let bulb = null;
  if (lit) {
    bulb = new THREE.PointLight(NIGHT.lamp, 34, 30, 1.1);
    bulb.position.set(1.6, 6.8, 0);
    g.add(bulb);
  }
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(7.5, 24),
    new THREE.MeshBasicMaterial({
      map: glowTex, color: 0xffb46b, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(1.6, 0.06, 0);
  g.add(pool);
  scene.add(g);
  return { group: g, light: bulb, head, flicker, phase: Math.random() * 10 };
}

export function createLighting(scene, renderer) {
  applyNightGrade(renderer);
  scene.background = new THREE.Color(NIGHT.sky);
  scene.fog = new THREE.Fog(NIGHT.fog, 70, 260);

  // Layer 1a: ambient — lifted hard so no surface ever falls to black.
  const ambient = new THREE.AmbientLight(NIGHT.ambient, 1.55);
  scene.add(ambient);

  // Layer 1b: hemisphere — cool sky bounce over warm ground bounce.
  const hemi = new THREE.HemisphereLight(NIGHT.hemiSky, NIGHT.hemiGround, 1.15);
  scene.add(hemi);

  // Layer 1c: the moon — a cool directional key light from high north-west.
  const moon = new THREE.DirectionalLight(NIGHT.moon, 1.7);
  moon.position.set(-90, 130, -70);
  scene.add(moon);
  scene.add(moon.target);

  // Layer 1d: chase fill — a warm directional light that rides just above
  // and behind the hero car so the hero is never a silhouette, from any
  // camera angle, in any shot.
  const heroFill = new THREE.DirectionalLight(0xfff0d6, 0.95);
  heroFill.position.set(10, 16, -10);
  scene.add(heroFill);
  scene.add(heroFill.target);

  const glowTex = makeGlowTexture();
  const stars = makeStars(scene);
  const moonGroup = makeMoon(scene, glowTex);

  // Street lamps along every road of the grid, both sides of the marina.
  // Only every 7th grid lamp carries a real point light; the rest glow
  // through their head + light pool (see makeLamp).
  const lamps = [];
  const roadLines = [-100, -50, 0, 50, 100];
  for (const x of roadLines) {
    for (const z of [-118, -68, -18, 32, 82]) {
      const lit = lamps.length % 7 === 0;
      lamps.push(makeLamp(scene, x + 8.4, z, glowTex, lamps.length === 7, lit));
    }
  }
  for (const z of [-100, -50, 0, 50, 100]) {
    for (const x of [-118, -68, -18, 32, 82]) {
      const lit = lamps.length % 7 === 0;
      lamps.push(makeLamp(scene, x, z + 8.4, glowTex, false, lit));
    }
  }
  // Marina promenade lamps — extra warm, extra dense, all really lit.
  for (const z of [-40, -10, 20, 50, 80]) {
    lamps.push(makeLamp(scene, 132, z, glowTex, false, true));
  }

  return {
    ambient, hemi, moon, heroFill, lamps, stars, moonGroup, glowTex,
    update(_dt, t, playerPos) {
      // Chase fill follows the hero car.
      heroFill.position.set(playerPos.x + 12, 18, playerPos.z - 10);
      heroFill.target.position.set(playerPos.x, 0, playerPos.z);
      // One tired lamp on 5th Avenue flickers.
      for (const lamp of lamps) {
        if (!lamp.flicker || !lamp.light) continue;
        const f = Math.sin(t * 13) * Math.sin(t * 7.3) > 0.86 ? 0.25 : 1;
        lamp.light.intensity = 34 * f;
        lamp.head.material.color.setHex(f < 1 ? 0x8a7a5c : 0xffe2ae);
      }
      // Stars shimmer almost imperceptibly.
      stars.material.opacity = 0.88 + Math.sin(t * 0.7) * 0.07;
    },
  };
}
