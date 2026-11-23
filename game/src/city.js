// city.js — Velmara Bay: a wet, bright, readable night city.
//
// Brightness rules for round 18: no facade darker than mid-grey-blue, the
// asphalt is blue-grey (never black), windows are unlit bright planes baked
// into canvas textures (they glow with emissive, independent of lights),
// and the marina water carries a moving moon-glint streak.
const THREE = window.THREE;

// Facade palettes — mid-tone, clearly coloured, never near-black.
const FACADE_COLORS = ['#5d6f88', '#6e5f74', '#54687c', '#7a6a58', '#5f7480', '#6b7280', '#71608a'];
const WINDOW_LIT = ['#ffd28a', '#ffe9b8', '#9fd4ff', '#ffb37a', '#fff3c4'];
const WINDOW_DARK = '#232c3d';

function makeFacadeTexture(base, seed) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  // Subtle vertical panel shading so the wall reads as architecture, not flat.
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(x, 0, 2, 256);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(x + 16, 0, 8, 256);
  }
  // Window grid: most lit, a few dark, so the building reads "alive".
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const cols = 6;
  const rows = 10;
  const ww = 256 / cols;
  const wh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rnd() < 0.68;
      g.fillStyle = lit ? WINDOW_LIT[Math.floor(rnd() * WINDOW_LIT.length)] : WINDOW_DARK;
      g.fillRect(col * ww + 7, r * wh + 8, ww - 14, wh - 15);
      if (lit) {
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(col * ww + 7, r * wh + 8, ww - 14, 4);
      }
    }
  }
  // Ground-floor storefront band: a glowing shopfront strip.
  g.fillStyle = '#1c2434';
  g.fillRect(0, 232, 256, 24);
  g.fillStyle = ['#ffd76a', '#8fd8ff', '#ff9d7a', '#b8ff9d'][seed % 4];
  g.fillRect(10, 236, 90, 16);
  g.fillStyle = '#ffe9b8';
  g.fillRect(120, 236, 126, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeRoofKit(scene, x, z, w, d, h, seed) {
  const g = new THREE.Group();
  g.position.set(x, h, z);
  const grey = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.9 });
  const rnd = ((s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; })(seed + 7);
  // AC units.
  for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), grey);
    ac.position.set((rnd() - 0.5) * (w - 3), 0.45, (rnd() - 0.5) * (d - 3));
    g.add(ac);
  }
  // Antenna mast.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.5, 6), grey);
  mast.position.set((rnd() - 0.5) * (w - 2), 2.2, (rnd() - 0.5) * (d - 2));
  g.add(mast);
  // Red aircraft-warning beacon — small, bright, blinking (updated by city).
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  );
  beacon.position.set(mast.position.x, 4.6, mast.position.z);
  g.add(beacon);
  scene.add(g);
  return beacon;
}

function makePalm(scene, x, z, h = 6) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.26, h, 7),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 }),
  );
  trunk.position.y = h / 2;
  trunk.rotation.z = 0.06;
  g.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7d46, roughness: 0.85 });
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), frondMat);
    const a = (i / 7) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.1, h + 0.4, Math.sin(a) * 1.1);
    frond.rotation.z = Math.cos(a) * 1.1;
    frond.rotation.x = -Math.sin(a) * 1.1;
    g.add(frond);
  }
  scene.add(g);
  return g;
}

function makeYacht(scene, x, z, rot, scale, phase) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  g.scale.setScalar(scale);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.35, metalness: 0.25 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 9), hullMat);
  hull.position.y = 0.55;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.6, 2.2, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 1.45);
  bow.position.set(0, 0.55, 5.4);
  g.add(bow);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.1, 4.4),
    new THREE.MeshStandardMaterial({ color: 0x2e4a6b, roughness: 0.4, metalness: 0.3 }),
  );
  cabin.position.set(0, 1.6, -0.4);
  g.add(cabin);
  // Warm cabin windows.
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.45, 4.0),
    new THREE.MeshBasicMaterial({ color: 0xffd28a }),
  );
  win.position.set(0, 1.7, -0.4);
  g.add(win);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 7, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a94a6, roughness: 0.5, metalness: 0.6 }));
  mast.position.set(0, 4.6, 0.6);
  g.add(mast);
  // Navigation lights: red port, green starboard, white masthead.
  const nav = (color, px, py, pz) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color }));
    s.position.set(px, py, pz);
    g.add(s);
    return s;
  };
  nav(0xff2222, -1.65, 1.2, 3.5);
  nav(0x22ff66, 1.65, 1.2, 3.5);
  nav(0xffffff, 0, 8.1, 0.6);
  scene.add(g);
  return { group: g, phase, baseY: 0 };
}

export function createCity(scene) {
  const colliders = [];
  const beacons = [];
  const yachts = [];
  const palms = [];

  // --- Ground: blue-grey base, lighter than the roads' surroundings.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ color: 0x39445a, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  // --- Roads: blue-grey asphalt, readable, never black. Wet sheen via low roughness.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x49566c, roughness: 0.5, metalness: 0.12 });
  const roads = [];
  for (const c of [-100, -50, 0, 50, 100]) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(14, 250), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(c, 0, 0);
    scene.add(v);
    roads.push(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(250, 14), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.01, c);
    scene.add(h);
    roads.push(h);
  }

  // --- Wet puddles: glossy mirror strips that catch the moon and lamps.
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x8fa8cc, roughness: 0.08, metalness: 0.9,
  });
  const puddleSpots = [
    [-50, -32, 9, 5], [0, 18, 7, 4], [50, -78, 10, 5], [-100, 62, 8, 4],
    [100, 8, 7, 4], [-50, 88, 9, 5], [0, -62, 8, 4], [138, 30, 12, 6],
  ];
  for (const [x, z, w, d] of puddleSpots) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.04, z);
    scene.add(p);
  }

  // --- Lane dashes + edge lines (bright, high contrast on the blue-grey road).
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xdfe6f2 });
  const dashGeo = new THREE.BoxGeometry(0.35, 0.02, 3.2);
  const centerMat = new THREE.MeshBasicMaterial({ color: 0xffd76a });
  const centerGeo = new THREE.BoxGeometry(0.3, 0.02, 3.2);
  for (const c of [-100, -50, 0, 50, 100]) {
    for (let z = -120; z <= 120; z += 10) {
      const d = new THREE.Mesh(dashGeo, z % 20 === 0 ? centerMat : dashMat);
      d.position.set(c, 0.05, z);
      scene.add(d);
      const d2 = new THREE.Mesh(dashGeo, dashMat);
      d2.rotation.y = Math.PI / 2;
      d2.position.set(z, 0.05, c);
      scene.add(d2);
    }
  }

  // --- Crosswalks at every intersection: wide bright stripes.
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xe8edf5 });
  for (const cx of [-100, -50, 0, 50, 100]) {
    for (const cz of [-100, -50, 0, 50, 100]) {
      for (let i = -3; i <= 3; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 5.4), crossMat);
        s.position.set(cx + i * 1.9, 0.05, cz + 8.6);
        scene.add(s);
        const s2 = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.02, 1.1), crossMat);
        s2.position.set(cx + 8.6, 0.05, cz + i * 1.9);
        scene.add(s2);
      }
    }
  }

  // --- Buildings: canvas facades with lit windows, mid-tone walls.
  const facadeTexs = FACADE_COLORS.map((c, i) => makeFacadeTexture(c, 11 + i * 13));
  const blocks = [];
  for (const bx of [-125, -75, -25, 25, 75]) {
    for (const bz of [-125, -75, -25, 25, 75]) {
      blocks.push([bx, bz]);
    }
  }
  let bi = 0;
  for (const [bx, bz] of blocks) {
    // Skip the block the marina promenade replaces and keep the centre plaza open.
    if (bx === 125 || (bx === -25 && bz === -25)) continue;
    const w = 26 + (bi % 3) * 4;
    const d = 24 + ((bi + 1) % 3) * 4;
    const h = 14 + ((bi * 37) % 5) * 7;
    const tex = facadeTexs[bi % facadeTexs.length];
    const mat = new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55,
      roughness: 0.85, metalness: 0.05,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(bx, h / 2, bz);
    scene.add(b);
    // Roof parapet so the silhouette reads at night.
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.9, d + 0.6),
      new THREE.MeshStandardMaterial({ color: 0x54627a, roughness: 0.9 }),
    );
    parapet.position.set(bx, h + 0.45, bz);
    scene.add(parapet);
    beacons.push(makeRoofKit(scene, bx, bz, w, d, h, bi * 7 + 3));
    colliders.push({ x: bx, z: bz, hw: w / 2 + 1, hd: d / 2 + 1 });
    bi++;
  }

  // --- Marina: water, promenade, railing, palms, cafes, yachts.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 320),
    new THREE.MeshStandardMaterial({ color: 0x1d3a58, roughness: 0.18, metalness: 0.75 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(250, -0.35, 0);
  scene.add(water);
  // Moon glint: a long additive streak on the water that drifts with time.
  const glint = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 300),
    new THREE.MeshBasicMaterial({
      color: 0x9db8e8, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  glint.rotation.x = -Math.PI / 2;
  glint.position.set(215, -0.28, 0);
  glint.rotation.z = 0.35;
  scene.add(glint);

  const prom = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 260),
    new THREE.MeshStandardMaterial({ color: 0x5a6374, roughness: 0.6, metalness: 0.08 }),
  );
  prom.rotation.x = -Math.PI / 2;
  prom.position.set(138, 0.02, 0);
  scene.add(prom);
  // Promenade railing.
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa6b8, roughness: 0.4, metalness: 0.7 });
  for (let z = -120; z <= 120; z += 6) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), railMat);
    post.position.set(150.5, 0.55, z);
    scene.add(post);
  }
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 244), railMat);
  railTop.position.set(150.5, 1.1, 0);
  scene.add(railTop);

  // Palms along the promenade and the plaza.
  for (const [x, z] of [[134, -60], [134, -20], [134, 20], [134, 60], [134, 100], [-25, -8], [-40, -25], [-10, -40]]) {
    palms.push(makePalm(scene, x, z, 5.5 + (Math.abs(x + z) % 3)));
  }

  // Cafes: round tables, chairs, red umbrellas.
  const cafeSpots = [[136, -32], [136, 8], [136, 44], [140, 78]];
  const tableMat = new THREE.MeshStandardMaterial({ color: 0xd8dee8, roughness: 0.5 });
  const umbMat = new THREE.MeshStandardMaterial({ color: 0xc23b3b, roughness: 0.8 });
  for (const [x, z] of cafeSpots) {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.08, 12), tableMat);
    table.position.set(x, 0.75, z);
    scene.add(table);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.75, 6), tableMat);
    leg.position.set(x, 0.38, z);
    scene.add(leg);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 8), umbMat);
    umb.position.set(x, 2.6, z);
    scene.add(umb);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), tableMat);
    pole.position.set(x, 1.6, z);
    scene.add(pole);
  }

  // Yachts bobbing at the marina.
  const yachtDefs = [
    [168, -52, 0.15, 1.0, 0], [172, -6, -0.1, 1.15, 1.3], [166, 38, 0.2, 0.9, 2.6],
    [178, 84, -0.2, 1.25, 4.1], [162, 110, 0.1, 0.85, 5.4],
  ];
  for (const [x, z, rot, s, ph] of yachtDefs) yachts.push(makeYacht(scene, x, z, rot, s, ph));

  // Glowing storefront signs on the promenade edge.
  const signColors = [0xffd76a, 0x8fd8ff, 0xff9d7a, 0xb8ff9d, 0xff7ad9];
  for (let i = 0; i < 5; i++) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(6, 1.1, 0.5),
      new THREE.MeshBasicMaterial({ color: signColors[i] }),
    );
    sign.position.set(126, 4.4, -88 + i * 44);
    scene.add(sign);
  }

  // Distant skyline silhouette — lighter than the night sky so the horizon reads.
  const skyMat = new THREE.MeshStandardMaterial({ color: 0x3d5170, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const h = 24 + ((i * 53) % 40);
    const t = new THREE.Mesh(new THREE.BoxGeometry(16, h, 16), skyMat);
    const a = (i / 14) * Math.PI * 2;
    t.position.set(Math.cos(a) * 235, h / 2 - 0.5, Math.sin(a) * 235);
    scene.add(t);
  }

  return {
    colliders, beacons, yachts, palms, glint, water,
    marinaCenter: new THREE.Vector3(140, 0, 20),
    bounds: 150,
    update(dt, t) {
      for (const y of yachts) {
        y.group.position.y = Math.sin(t * 0.8 + y.phase) * 0.16;
        y.group.rotation.z = Math.sin(t * 0.6 + y.phase) * 0.02;
        y.group.rotation.x = Math.sin(t * 0.5 + y.phase * 1.7) * 0.015;
      }
      glint.position.x = 215 + Math.sin(t * 0.12) * 9;
      glint.material.opacity = 0.13 + Math.sin(t * 0.4) * 0.045;
      const blink = Math.sin(t * 2.4) > 0 ? 1 : 0.15;
      for (const b of beacons) b.material.color.setHex(blink ? 0xff2a2a : 0x551111);
    },
  };
}
