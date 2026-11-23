// city.js — Velmara Bay: a night marina city built from scratch.
// Grid roads, wet asphalt, lit towers with neon roof lines, shopfronts,
// palms, lamps, a promenade with railing and cafes, piers, yachts and sea.
const THREE = window.THREE;

export const CITY = {
  roads: [-165, -110, -55, 0, 55, 110],
  roadWidth: 14,
  half: 192,            // city extent in z and west x
  landMaxX: 137,        // east edge of buildable land
  promMinX: 137,        // promenade starts
  seaX: 165,            // water starts
  spacing: 55,
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRoadTexture(zebraU) {
  // Canvas is 2048 (length) x 256 (width); dashes run along the length.
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 256;
  const g = c.getContext('2d');
  // Wet asphalt base.
  g.fillStyle = '#161d31';
  g.fillRect(0, 0, 2048, 256);
  // Speckle noise + faint tyre-wear bands.
  for (let i = 0; i < 5200; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.16)';
    g.fillRect(Math.random() * 2048, Math.random() * 256, 2, 2);
  }
  g.fillStyle = 'rgba(0,0,0,0.20)';
  g.fillRect(0, 52, 2048, 34);
  g.fillRect(0, 170, 2048, 34);
  // Damp sheen blotches.
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 2048, y = 20 + Math.random() * 216, r = 14 + Math.random() * 42;
    const grad = g.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(90,130,200,0.10)');
    grad.addColorStop(1, 'rgba(90,130,200,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Edge lines.
  g.fillStyle = 'rgba(225,232,245,0.85)';
  g.fillRect(0, 10, 2048, 4);
  g.fillRect(0, 242, 2048, 4);
  // Centre dashed yellow line.
  g.fillStyle = '#e8c33a';
  for (let x = 0; x < 2048; x += 96) g.fillRect(x, 124, 52, 8);
  // Zebra crossings at the given length fractions.
  g.fillStyle = 'rgba(235,240,250,0.9)';
  for (const u of zebraU) {
    const x0 = u * 2048;
    for (let s = 0; s < 6; s++) g.fillRect(x0 - 110 + s * 38, 20, 22, 216);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeFacadeTexture(rng, variant) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const base = ['#0d1020', '#100e1c', '#0b1220'][variant % 3];
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Floor slabs.
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 128, 1);
  // Windows: warm, cool or dark.
  const cols = 8, rows = 15, ww = 11, hh = 9;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = 6 + col * 15, y = 8 + r * 16;
      const p = rng();
      if (p < 0.30) g.fillStyle = '#ffd27a';
      else if (p < 0.44) g.fillStyle = '#9fd8ff';
      else if (p < 0.50) g.fillStyle = '#ff9d6b';
      else g.fillStyle = '#141824';
      g.globalAlpha = p < 0.5 ? 0.75 + rng() * 0.25 : 1;
      g.fillRect(x, y, ww, hh);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const NEON = [0xff2ea6, 0x2ee6ff, 0xb46bff, 0xffc93c, 0x3cff9e];

export function buildCity(scene) {
  const rng = mulberry32(1337);
  const colliders = [];
  const yachts = [];
  const animated = { glitter: [], beacons: [] };
  const group = new THREE.Group();
  scene.add(group);

  // Two road textures: zebra bands sit exactly on the intersections, which
  // fall at different length fractions on the two orientations.
  const zebraH = CITY.roads.map((r) => (r + 219.5) / 384); // horizontal roads span x -219.5..164.5
  const zebraV = CITY.roads.map((r) => (192 - r) / 384);   // vertical roads span z +192..-192
  const roadMatH = new THREE.MeshStandardMaterial({
    map: makeRoadTexture(zebraH), roughness: 0.38, metalness: 0.18, color: 0xffffff,
  });
  const roadMatV = new THREE.MeshStandardMaterial({
    map: makeRoadTexture(zebraV), roughness: 0.38, metalness: 0.18, color: 0xffffff,
  });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x252c42, roughness: 0.92 });
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0e1c, roughness: 0.95 });

  // Base ground + sea.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(120, -0.06, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const seaMat = new THREE.MeshPhongMaterial({
    color: 0x0a1e42, shininess: 130, specular: 0x4a6ea8,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(460, 700), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(165 + 230, -0.12, 0);
  sea.receiveShadow = true;
  group.add(sea);

  // Moon glitter: two additive streaks drifting on the water.
  const glitterTexC = document.createElement('canvas');
  glitterTexC.width = 64; glitterTexC.height = 512;
  const gg = glitterTexC.getContext('2d');
  const grad = gg.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(190,215,255,0)');
  grad.addColorStop(0.5, 'rgba(190,215,255,0.55)');
  grad.addColorStop(1, 'rgba(190,215,255,0)');
  gg.fillStyle = grad; gg.fillRect(0, 0, 64, 512);
  const glitterTex = new THREE.CanvasTexture(glitterTexC);
  for (let i = 0; i < 2; i++) {
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(26 - i * 8, 420),
      new THREE.MeshBasicMaterial({
        map: glitterTex, transparent: true, opacity: 0.5 - i * 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    streak.rotation.x = -Math.PI / 2;
    streak.position.set(300 + i * 55, 0.05, -40 + i * 90);
    group.add(streak);
    animated.glitter.push(streak);
  }

  // Roads: vertical (along z) and horizontal (along x). Both meshes are
  // PlaneGeometry(384, 14); the vertical one is rotated so its length axis
  // (the texture's u) runs along world -z.
  const roadLen = CITY.half * 2;
  for (const x of CITY.roads) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, CITY.roadWidth), roadMatV);
    r.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    r.position.set(x, 0, 0);
    r.receiveShadow = true;
    group.add(r);
    // Sidewalks.
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(4.5, roadLen), walkMat);
      w.rotation.x = -Math.PI / 2;
      w.position.set(x + s * (CITY.roadWidth / 2 + 2.4), 0.08, 0);
      w.receiveShadow = true;
      group.add(w);
    }
  }
  for (const z of CITY.roads) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, CITY.roadWidth), roadMatH);
    r.rotation.x = -Math.PI / 2;
    r.position.set(-27.5, 0.01, z);
    r.receiveShadow = true;
    group.add(r);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 4.5), walkMat);
      w.rotation.x = -Math.PI / 2;
      w.position.set(-27.5, 0.09, z + s * (CITY.roadWidth / 2 + 2.4));
      w.receiveShadow = true;
      group.add(w);
    }
  }

  // 16 glossy puddles on the wet asphalt.
  const puddleMat = new THREE.MeshPhongMaterial({
    color: 0x16294f, shininess: 150, specular: 0x9db8ff,
    transparent: true, opacity: 0.88,
  });
  for (let i = 0; i < 16; i++) {
    const onVertical = rng() < 0.5;
    const road = CITY.roads[Math.floor(rng() * CITY.roads.length)];
    const along = -170 + rng() * 340;
    const p = new THREE.Mesh(new THREE.CircleGeometry(2.2 + rng() * 2.6, 20), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.scale.set(1.4 + rng() * 0.7, 0.8 + rng() * 0.5, 1);
    p.position.set(
      onVertical ? road + (rng() - 0.5) * 8 : -27.5 + along * 0.9,
      0.03,
      onVertical ? along : road + (rng() - 0.5) * 8,
    );
    group.add(p);
  }

  // Buildings: one tower per block, with lit windows, neon roof line,
  // rooftop AC units + antenna + red beacon, and shopfronts at street level.
  const facadeMats = [0, 1, 2].map((v) => {
    const tex = makeFacadeTexture(mulberry32(900 + v * 77), v);
    return new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.85,
      roughness: 0.85, metalness: 0.05,
    });
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x141828, roughness: 0.9 });
  const acMat = new THREE.MeshStandardMaterial({ color: 0x3a4152, roughness: 0.8 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 2.2 });
  const signColors = [0xff2ea6, 0x2ee6ff, 0xffc93c, 0x3cff9e, 0xff7a3c];

  const blocks = [];
  for (let i = 0; i < CITY.roads.length - 1; i++) {
    for (let j = 0; j < CITY.roads.length - 1; j++) {
      const cx = (CITY.roads[i] + CITY.roads[i + 1]) / 2;
      const cz = (CITY.roads[j] + CITY.roads[j + 1]) / 2;
      blocks.push({ cx, cz });
    }
  }
  // Low shop row between the last road and the promenade.
  for (let j = 0; j < CITY.roads.length - 1; j++) {
    blocks.push({ cx: 123.5, cz: (CITY.roads[j] + CITY.roads[j + 1]) / 2, low: true });
  }

  for (const b of blocks) {
    const tall = !b.low && rng() < 0.72;
    const w = b.low ? 20 : 24 + rng() * 8;
    const d = b.low ? 26 : 24 + rng() * 8;
    const h = b.low ? 9 + rng() * 5 : tall ? 34 + rng() * 30 : 16 + rng() * 12;
    const mat = facadeMats[Math.floor(rng() * facadeMats.length)];
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    tower.position.set(b.cx, h / 2, b.cz);
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);
    colliders.push({ minX: b.cx - w / 2, maxX: b.cx + w / 2, minZ: b.cz - d / 2, maxZ: b.cz + d / 2 });

    // Roof slab + neon edge line.
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.5, d + 0.8), roofMat);
    slab.position.set(b.cx, h + 0.25, b.cz);
    group.add(slab);
    const neon = NEON[Math.floor(rng() * NEON.length)];
    const neonMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: neon, emissiveIntensity: 2.4 });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 1.0, 0.32, d + 1.0), neonMat);
    edge.position.set(b.cx, h + 0.62, b.cz);
    group.add(edge);

    // Rooftop detail: AC units, antenna, red beacon.
    const acCount = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < acCount; k++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.6), acMat);
      ac.position.set(b.cx + (rng() - 0.5) * (w - 5), h + 1.05, b.cz + (rng() - 0.5) * (d - 5));
      ac.castShadow = true;
      group.add(ac);
    }
    if (rng() < 0.6) {
      const ant = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.14, 7 + rng() * 5, 6),
        new THREE.MeshStandardMaterial({ color: 0x555c6e, roughness: 0.6, metalness: 0.6 }),
      );
      ant.position.set(b.cx + (rng() - 0.5) * (w - 6), h + 4, b.cz + (rng() - 0.5) * (d - 6));
      group.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), beaconMat);
      tip.position.set(ant.position.x, ant.position.y + 4, ant.position.z);
      group.add(tip);
      animated.beacons.push(tip);
    }

    // Shopfront: glowing sign + awning + lit window band on the street face.
    if (rng() < 0.55) {
      const face = rng() < 0.5 ? 1 : -1;
      const signMat = new THREE.MeshStandardMaterial({
        color: 0x111111, emissive: signColors[Math.floor(rng() * signColors.length)], emissiveIntensity: 2.0,
      });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 1.1, 0.5), signMat);
      sign.position.set(b.cx, 4.6, b.cz + face * (d / 2 + 0.28));
      group.add(sign);
      const awn = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.6, 0.18, 2.2),
        new THREE.MeshStandardMaterial({ color: signColors[Math.floor(rng() * signColors.length)], roughness: 0.7 }),
      );
      awn.position.set(b.cx, 3.4, b.cz + face * (d / 2 + 1.1));
      group.add(awn);
      const bandMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd27a, emissiveIntensity: 1.1 });
      const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.8, 0.3), bandMat);
      band.position.set(b.cx, 1.6, b.cz + face * (d / 2 + 0.16));
      group.add(band);
    }
  }

  // Palms along the roads and the promenade.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d26, roughness: 0.95 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x1f7a3a, roughness: 0.8, side: THREE.DoubleSide });
  function makePalm(x, z, s) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 6.5 * s, 7), trunkMat);
    trunk.position.y = 3.25 * s;
    trunk.rotation.z = (rng() - 0.5) * 0.12;
    trunk.castShadow = true;
    palm.add(trunk);
    for (let f = 0; f < 7; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.85 * s, 3.4 * s, 4), frondMat);
      frond.scale.set(1, 1, 0.16);
      const a = (f / 7) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.1 * s, 6.6 * s, Math.sin(a) * 1.1 * s);
      frond.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
      frond.castShadow = true;
      palm.add(frond);
    }
    palm.position.set(x, 0, z);
    group.add(palm);
  }
  for (const x of CITY.roads) {
    for (let z = -150; z <= 150; z += 55) {
      if (rng() < 0.75) makePalm(x + 10.5, z + 12, 0.9 + rng() * 0.35);
      if (rng() < 0.6) makePalm(x - 10.5, z - 14, 0.9 + rng() * 0.35);
    }
  }
  for (let z = -170; z <= 170; z += 34) makePalm(141 + rng() * 2, z, 1.05 + rng() * 0.3);

  // Street lamps: pole + warm head, emissive only (a few real lights below).
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c3242, roughness: 0.6, metalness: 0.7 });
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd9a0, emissiveIntensity: 2.6 });
  function makeLamp(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 7, 6), poleMat);
    pole.position.set(x, 3.5, z);
    pole.castShadow = true;
    group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 1.4), lampHeadMat);
    head.position.set(x, 7.05, z);
    group.add(head);
  }
  for (const x of CITY.roads) {
    for (let z = -137; z <= 137; z += 55) makeLamp(x + 10.2, z);
  }
  // Four real warm lights along the promenade.
  for (const z of [-120, -40, 40, 120]) {
    makeLamp(160, z);
    const pl = new THREE.PointLight(0xffc37a, 26, 42, 1.8);
    pl.position.set(160, 7, z);
    group.add(pl);
  }

  // Promenade: walkway, railing, benches, cafe tables with umbrellas.
  const promMat = new THREE.MeshStandardMaterial({ color: 0x2b3249, roughness: 0.85 });
  const prom = new THREE.Mesh(new THREE.PlaneGeometry(28, 384), promMat);
  prom.rotation.x = -Math.PI / 2;
  prom.position.set(151, 0.06, 0);
  prom.receiveShadow = true;
  group.add(prom);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8a93a8, roughness: 0.35, metalness: 0.85 });
  for (let z = -190; z <= 190; z += 6) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), railMat);
    post.position.set(163.5, 0.55, z);
    group.add(post);
  }
  for (const y of [0.6, 1.05]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 382), railMat);
    rail.position.set(163.5, y, 0);
    group.add(rail);
  }
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.9 });
  for (let z = -160; z <= 160; z += 40) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), benchMat);
    bench.position.set(158, 0.55, z);
    bench.castShadow = true;
    group.add(bench);
  }
  // Cafe: round tables + striped umbrellas near the marina pickup point.
  const tableMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.6 });
  const umbMat = new THREE.MeshStandardMaterial({ color: 0xe2574c, roughness: 0.75, side: THREE.DoubleSide });
  for (const [tx, tz] of [[146, -18], [146, -6], [147, 6], [146, 26], [147, -32]]) {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.14, 12), tableMat);
    table.position.set(tx, 0.85, tz);
    table.castShadow = true;
    group.add(table);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.85, 6), poleMat);
    leg.position.set(tx, 0.42, tz);
    group.add(leg);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 8), umbMat);
    umb.position.set(tx, 2.5, tz);
    umb.castShadow = true;
    group.add(umb);
  }

  // Piers + moored yachts.
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.95 });
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.35, metalness: 0.25 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.4 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x9aa2b0, roughness: 0.4, metalness: 0.8 });
  const navRed = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a2a, emissiveIntensity: 3 });
  const navGreen = new THREE.MeshStandardMaterial({ color: 0x002200, emissive: 0x2aff66, emissiveIntensity: 3 });
  const cabinLightMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd27a, emissiveIntensity: 1.6 });
  const pierZ = [-120, -40, 40, 120];
  pierZ.forEach((pz, pi) => {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(42, 0.5, 6), woodMat);
    pier.position.set(186, 0.15, pz);
    pier.castShadow = true;
    pier.receiveShadow = true;
    group.add(pier);
    for (let x = 168; x <= 204; x += 9) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 6), woodMat);
      post.position.set(x, 0.2, pz + 2.8);
      group.add(post);
    }
    // One yacht per pier, gently bobbing.
    const yacht = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(11, 1.6, 3.2), hullMat);
    hull.position.y = 0.4;
    hull.castShadow = true;
    yacht.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.4, 4), hullMat);
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(7.1, 0.4, 0);
    yacht.add(bow);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.5, 2.4), cabinMat);
    cabin.position.set(-0.6, 1.9, 0);
    cabin.castShadow = true;
    yacht.add(cabin);
    const win = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.5, 2.45), cabinLightMat);
    win.position.set(-0.6, 1.9, 0);
    yacht.add(win);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 9, 6), mastMat);
    mast.position.set(0.4, 6.4, 0);
    yacht.add(mast);
    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.4, 1.7),
      new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.8 }));
    sail.position.set(0.4, 5.4, 0);
    yacht.add(sail);
    const rl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), navRed);
    rl.position.set(10.4, 1.4, 1.7);
    yacht.add(rl);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), navGreen);
    gl.position.set(10.4, 1.4, -1.7);
    yacht.add(gl);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 2.5 }));
    top.position.set(0.4, 11.1, 0);
    yacht.add(top);
    yacht.position.set(214 + (pi % 2) * 14, 0, pz + 9);
    yacht.rotation.y = (pi % 2 === 0 ? 0 : Math.PI);
    group.add(yacht);
    yachts.push({ group: yacht, phase: pi * 1.7, baseY: 0 });
  });

  // Traffic loops: rectangles on the road grid (waypoints the cars follow).
  const roadLoops = [
    [{ x: -55, z: -110 }, { x: 55, z: -110 }, { x: 55, z: 110 }, { x: -55, z: 110 }],
    [{ x: -165, z: -55 }, { x: 0, z: -55 }, { x: 0, z: 55 }, { x: -165, z: 55 }],
    [{ x: 0, z: -165 }, { x: 110, z: -165 }, { x: 110, z: 165 }, { x: 0, z: 165 }],
    [{ x: 110, z: -110 }, { x: 110, z: 110 }, { x: 55, z: 110 }, { x: 55, z: -110 }],
  ];

  return {
    colliders,
    roadLoops,
    update(dt, t) {
      for (const y of yachts) {
        y.group.position.y = Math.sin(t * 0.7 + y.phase) * 0.16;
        y.group.rotation.z = Math.sin(t * 0.55 + y.phase) * 0.018;
        y.group.rotation.x = Math.cos(t * 0.45 + y.phase) * 0.012;
      }
      for (let i = 0; i < animated.glitter.length; i++) {
        const s = animated.glitter[i];
        s.position.z = -40 + i * 90 + Math.sin(t * 0.12 + i * 2.1) * 26;
        s.material.opacity = (0.5 - i * 0.16) * (0.85 + Math.sin(t * 0.5 + i) * 0.15);
      }
      for (let i = 0; i < animated.beacons.length; i++) {
        animated.beacons[i].material = beaconMat;
        beaconMat.emissiveIntensity = 1.2 + Math.max(0, Math.sin(t * 2.2 + i * 1.3)) * 2.4;
      }
    },
  };
}
