// Marina Nights — the city of VELMARA BAY.
// Grid streets, buildings with lit windows, a marina district on the bay.
// HARD RULE: palms and street lamps live ONLY on sidewalks (offset >= 9 from
// a street centreline). The driving corridor (|offset| < 7.5) is always clear.
const THREE = window.THREE;

export const STREETS = [-160, -80, 0, 80, 160];
export const ROAD_HALF = 7;
export const CITY_MIN = -200;
export const CITY_MAX = 200;
export const BAY_X = 200; // water starts here

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeWindowTexture(base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 118; y += 14) {
    for (let x = 6; x < 56; x += 12) {
      const lit = Math.random() < litRatio;
      g.fillStyle = lit ? (Math.random() < 0.55 ? '#ffd76a' : '#7fe3ff') : '#0a1220';
      g.fillRect(x, y, 8, 9);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makePalm() {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 5.6, 6), trunkMat);
  trunk.position.y = 2.8;
  trunk.rotation.z = 0.07;
  g.add(trunk);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.4, 4), frondMat);
    frond.position.set(Math.cos(a) * 1.15, 5.9, Math.sin(a) * 1.15);
    frond.rotation.z = Math.cos(a) * 1.15;
    frond.rotation.x = -Math.sin(a) * 1.15;
    frond.scale.set(1, 1, 0.28);
    g.add(frond);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x37c46a }));
  crown.position.y = 5.7;
  g.add(crown);
  return g;
}

function makeLamp() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222a36 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6), poleMat);
  pole.position.y = 3.2;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMat);
  arm.position.set(0.7, 6.3, 0);
  g.add(arm);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  bulb.position.set(1.45, 6.2, 0);
  g.add(bulb);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.22 }));
  halo.position.copy(bulb.position);
  g.add(halo);
  return g;
}

export function createCity(scene) {
  const buildings = []; // AABBs {minX,maxX,minZ,maxZ} for collision
  const palms = [];     // {x,z} positions (sidewalk only)
  const lamps = [];     // {x,z} positions (sidewalk only)

  // ---- ground ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 760),
    new THREE.MeshLambertMaterial({ color: 0x0d1420 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  // ---- roads + sidewalks (one strip per street) ----
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x1b2434 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x2c3a50 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd54a });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x8fa8cc });
  // Horizontal roads run x -202..188 only: the marina promenade (x 188..200)
  // is pedestrian-only and is NOT crossed by any road.
  for (const s of STREETS) {
    // vertical street (runs along z, full length)
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(14, 404), roadMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.set(s, 0.01, 0);
    scene.add(roadV);
    // horizontal street (runs along x, stops at the promenade)
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(390, 14), roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(-7, 0.01, s);
    scene.add(roadH);
    // sidewalks: two strips hugging each road, OUTSIDE the driving corridor
    for (const side of [-1, 1]) {
      const walkV = new THREE.Mesh(new THREE.BoxGeometry(4, 0.14, 404), walkMat);
      walkV.position.set(s + side * 9, 0.07, 0);
      scene.add(walkV);
      const walkH = new THREE.Mesh(new THREE.BoxGeometry(390, 0.14, 4), walkMat);
      walkH.position.set(-7, 0.07, s + side * 9);
      scene.add(walkH);
    }
    // yellow dashed centre lines
    for (let d = -196; d <= 196; d += 12) {
      const dashV = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 5), dashMat);
      dashV.position.set(s, 0.05, d);
      scene.add(dashV);
    }
    for (let d = -196; d <= 184; d += 12) {
      const dashH = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 0.35), dashMat);
      dashH.position.set(d, 0.05, s);
      scene.add(dashH);
    }
    // pale edge lines
    for (const side of [-1, 1]) {
      const edgeV = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 404), edgeMat);
      edgeV.position.set(s + side * 6.6, 0.04, 0);
      scene.add(edgeV);
      const edgeH = new THREE.Mesh(new THREE.BoxGeometry(390, 0.05, 0.22), edgeMat);
      edgeH.position.set(-7, 0.04, s + side * 6.6);
      scene.add(edgeH);
    }
  }

  // ---- buildings (block interiors only, never on roads) ----
  const textures = [
    makeWindowTexture('#1b2836', 0.5),
    makeWindowTexture('#232d3d', 0.62),
    makeWindowTexture('#16202e', 0.42),
    makeWindowTexture('#2a2438', 0.55),
  ];
  const neonColors = [0xff2d78, 0x00e5ff, 0xffd54a, 0x7c4dff, 0x37e08b];
  const blockEdges = [-200, -171, -149, -91, -69, -11, 11, 69, 91, 149, 171, 189];
  // block intervals between neighbouring edges (skip the road/sidewalk bands)
  const blocks = [];
  for (let i = 0; i < blockEdges.length; i += 2) {
    blocks.push([blockEdges[i], blockEdges[i + 1]]);
  }
  for (const [bx0, bx1] of blocks) {
    for (const [bz0, bz1] of blocks) {
      // skip the far-east waterfront strip: low hotels there instead
      const waterfront = bx0 >= 171;
      const bw = bx1 - bx0;
      const bd = bz1 - bz0;
      const lots = waterfront ? 1 : (bw > 40 && bd > 40 ? 2 : 1);
      for (let l = 0; l < lots; l++) {
        const w = lots === 2 ? bw / 2 - 6 : bw - 6;
        const d = lots === 2 ? bd - 6 : bd - 6;
        const cx = bx0 + (lots === 2 ? (l === 0 ? bw / 4 : (3 * bw) / 4) : bw / 2);
        const cz = bz0 + bd / 2;
        const h = waterfront ? rand(7, 15) : rand(12, 58);
        const tex = pick(textures);
        const mat = new THREE.MeshStandardMaterial({
          map: tex, emissive: 0xffffff, emissiveMap: tex,
          emissiveIntensity: 0.5, roughness: 0.85, metalness: 0.1,
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(cx, h / 2, cz);
        scene.add(b);
        // roof rim light so the skyline reads at night
        const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3),
          new THREE.MeshBasicMaterial({ color: pick(neonColors) }));
        rim.position.set(cx, h + 0.15, cz);
        scene.add(rim);
        // neon sign on some tall buildings
        if (!waterfront && h > 30 && Math.random() < 0.5) {
          const sign = new THREE.Mesh(new THREE.BoxGeometry(0.4, rand(2, 5), rand(4, 9)),
            new THREE.MeshBasicMaterial({ color: pick(neonColors) }));
          sign.position.set(cx + w / 2 + 0.25, h * rand(0.55, 0.8), cz);
          scene.add(sign);
        }
        buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      }
    }
  }

  // ---- bay water (east of x = 200) ----
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 560),
    new THREE.MeshPhongMaterial({ color: 0x1a6fc0, emissive: 0x0f4066, shininess: 90, specular: 0x99ccff })
  );
  water.rotation.x = -Math.PI / 2;
  // NOTE: y must sit ABOVE the ground plane (y=-0.05), or the ground hides it.
  water.position.set(285, 0.02, 0);
  scene.add(water);

  // ---- promenade (wide sidewalk along the bay, x 188..200) ----
  const prom = new THREE.Mesh(new THREE.BoxGeometry(12, 0.22, 404),
    new THREE.MeshLambertMaterial({ color: 0x3a4a63 }));
  prom.position.set(194, 0.11, 0);
  scene.add(prom);
  // glowing bay edge
  const edgeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 404),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  edgeGlow.position.set(199.6, 0.25, 0);
  scene.add(edgeGlow);

  // ---- docks + yachts ----
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  for (const dz of [-90, 0, 90]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(32, 0.5, 6), dockMat);
    dock.position.set(216, 0.15, dz);
    scene.add(dock);
    for (const px of [204, 216, 228]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 6),
        new THREE.MeshLambertMaterial({ color: 0x4a3220 }));
      post.position.set(px, 0.6, dz + 2.6);
      scene.add(post);
    }
  }
  const yachtDefs = [
    { x: 226, z: -46, s: 1.1 }, { x: 238, z: 28, s: 0.9 }, { x: 222, z: 118, s: 1.2 },
    { x: 250, z: -128, s: 1.0 }, { x: 232, z: 152, s: 0.85 },
  ];
  for (const y of yachtDefs) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9 * y.s, 1.1, 2.8 * y.s),
      new THREE.MeshLambertMaterial({ color: 0xf2f6fa }));
    hull.position.y = 0.4;
    g.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4 * y.s, 1.1, 2 * y.s),
      new THREE.MeshLambertMaterial({ color: 0xdfe9f5 }));
    cabin.position.set(-0.5, 1.4, 0);
    g.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7 * y.s, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a97a8 }));
    mast.position.set(0.5, 4.5, 0);
    g.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(3.4 * y.s, 5 * y.s),
      new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    sail.position.set(2.2, 4.4, 0);
    g.add(sail);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(9.1 * y.s, 0.28, 2.9 * y.s),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
    stripe.position.y = 0.95;
    g.add(stripe);
    g.position.set(y.x, 0, y.z);
    g.rotation.y = rand(-0.3, 0.3);
    scene.add(g);
  }

  // ---- palms: SIDEWALK ONLY (offset 9.2 from street centreline) ----
  const palmSpots = [];
  for (const s of STREETS) {
    for (let d = -180; d <= 180; d += 40) {
      palmSpots.push({ x: s + 9.2, z: d });
      palmSpots.push({ x: d, z: s + 9.2 });
    }
  }
  // promenade palms
  for (let z = -180; z <= 180; z += 30) palmSpots.push({ x: 196.5, z });
  for (const p of palmSpots) {
    const palm = makePalm();
    palm.position.set(p.x, 0, p.z);
    palm.rotation.y = rand(0, Math.PI * 2);
    scene.add(palm);
    palms.push({ x: p.x, z: p.z });
  }

  // ---- street lamps: SIDEWALK ONLY (offset 9.6, opposite side from palms) ----
  const lampSpots = [];
  for (const s of STREETS) {
    for (let d = -180; d <= 180; d += 40) {
      lampSpots.push({ x: s - 9.6, z: d });
      lampSpots.push({ x: d, z: s - 9.6 });
    }
  }
  for (const p of lampSpots) {
    const lamp = makeLamp();
    lamp.position.set(p.x, 0, p.z);
    lamp.rotation.y = p.x < 0 || Math.abs(p.z) > Math.abs(p.x) ? 0 : Math.PI;
    scene.add(lamp);
    lamps.push({ x: p.x, z: p.z });
  }
  // a few real warm point lights on the promenade (cheap, only 4)
  for (const z of [-120, -40, 40, 120]) {
    const pl = new THREE.PointLight(0xffd9a0, 26, 48, 1.8);
    pl.position.set(193, 7, z);
    scene.add(pl);
  }

  return { buildings, palms, lamps, update() {} };
}
