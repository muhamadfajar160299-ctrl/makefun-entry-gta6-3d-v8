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

function makeAsphaltTexture() {
  // Wet asphalt after evening rain: near-black base, fine noise speckle,
  // faint darker patches. Tiled along each road so the grain stays small.
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#28303e';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.16)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 1.4, 1.4);
  }
  for (let i = 0; i < 7; i++) {
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.beginPath();
    g.ellipse(Math.random() * 128, Math.random() * 128, 12 + Math.random() * 22, 8 + Math.random() * 14, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

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
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- roads + sidewalks (one strip per street) ----
  // Wet-look asphalt: Phong specular picks up lamp and headlight highlights
  // so the road reads damp, not flat matte. The canvas grain kills the
  // plastic-smooth look at close range.
  const asphaltTex = makeAsphaltTexture();
  asphaltTex.repeat.set(1, 28);
  const roadMat = new THREE.MeshPhongMaterial({
    color: 0xffffff, map: asphaltTex, shininess: 70, specular: 0x5a7aa8,
  });
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
    roadV.receiveShadow = true;
    scene.add(roadV);
    // horizontal street (runs along x, stops at the promenade)
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(390, 14), roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(-7, 0.01, s);
    roadH.receiveShadow = true;
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
    // zebra crossings where this street meets the cross streets: white bars
    // across the driving lane, so intersections read as real junctions.
    for (const cs of STREETS) {
      for (let i = -2; i <= 2; i++) {
        const zbV = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 2.2),
          new THREE.MeshBasicMaterial({ color: 0xdfe7f2 }));
        zbV.position.set(cs + i * 2.6, 0.05, s - 8.4);
        scene.add(zbV);
        const zbH = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 2.2),
          new THREE.MeshBasicMaterial({ color: 0xdfe7f2 }));
        zbH.position.set(cs + i * 2.6, 0.05, s + 8.4);
        scene.add(zbH);
      }
    }
  }

  // ---- puddles: glossy rain pools that catch lamp light ----
  // High-shininess Phong discs on the road surface (offset 9.2 rule does not
  // apply — puddles are flat, cars drive over them).
  const puddleMat = new THREE.MeshPhongMaterial({
    color: 0x0d2438, shininess: 140, specular: 0xaaccff,
    transparent: true, opacity: 0.85,
  });
  for (let i = 0; i < 16; i++) {
    const s = pick(STREETS);
    const vertical = Math.random() < 0.5;
    const along = rand(-180, 180);
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(rand(1.6, 3.4), 14), puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.x = rand(1, 1.8);
    puddle.position.set(vertical ? s + rand(-4, 4) : along, 0.03, vertical ? along : s + rand(-4, 4));
    scene.add(puddle);
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
          emissiveIntensity: rand(0.35, 0.7), roughness: 0.8, metalness: 0.15,
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(cx, h / 2, cz);
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
        // rooftop clutter: AC units + an antenna, so roofs aren't flat slabs
        const roofMat = new THREE.MeshLambertMaterial({ color: 0x39434f });
        const ac = new THREE.Mesh(new THREE.BoxGeometry(rand(2, 4), 1.1, rand(2, 3.5)), roofMat);
        ac.position.set(cx + rand(-w / 4, w / 4), h + 0.55, cz + rand(-d / 4, d / 4));
        ac.castShadow = true;
        scene.add(ac);
        if (h > 28 && Math.random() < 0.6) {
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, rand(4, 8), 5), roofMat);
          ant.position.set(cx - w / 3, h + 3, cz - d / 3);
          scene.add(ant);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5),
            new THREE.MeshBasicMaterial({ color: 0xff3344 }));
          tip.position.set(cx - w / 3, h + 3 + ant.geometry.parameters.height / 2, cz - d / 3);
          scene.add(tip);
        }
        // lit shopfront at street level on some blocks: a warm glowing band
        // facing the nearest street, so ground floors feel occupied.
        if (!waterfront && Math.random() < 0.45) {
          const shopColors = [0xffc98a, 0x7fe3ff, 0xff8fb0, 0xb8ff9e];
          const shop = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.6, 0.3),
            new THREE.MeshBasicMaterial({ color: pick(shopColors) }));
          shop.position.set(cx, 1.4, cz + d / 2 + 0.18);
          scene.add(shop);
        }
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
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x0a3a6b, emissive: 0x061e33, shininess: 90, specular: 0x77aadd,
  });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 560),
    waterMat
  );
  water.rotation.x = -Math.PI / 2;
  // NOTE: y must sit ABOVE the ground plane (y=-0.05), or the ground hides it.
  water.position.set(285, 0.02, 0);
  scene.add(water);
  // Moon glitter: thin bright streaks on the water that drift slowly, so the
  // bay reads as moving water instead of a flat blue slab.
  const streakMat = new THREE.MeshBasicMaterial({
    color: 0x9fd4ff, transparent: true, opacity: 0.25,
  });
  const streaks = [];
  for (let i = 0; i < 10; i++) {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(rand(6, 18), 0.5), streakMat);
    st.rotation.x = -Math.PI / 2;
    st.position.set(rand(210, 340), 0.05, rand(-260, 260));
    scene.add(st);
    streaks.push({ mesh: st, speed: rand(0.6, 1.8) });
  }

  // ---- promenade (wide sidewalk along the bay, x 188..200) ----
  const prom = new THREE.Mesh(new THREE.BoxGeometry(12, 0.22, 404),
    new THREE.MeshLambertMaterial({ color: 0x3a4a63 }));
  prom.position.set(194, 0.11, 0);
  prom.receiveShadow = true;
  scene.add(prom);
  // glowing bay edge
  const edgeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 404),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  edgeGlow.position.set(199.6, 0.25, 0);
  scene.add(edgeGlow);
  // safety railing along the water: posts + two rails, so the promenade edge
  // reads as a real waterfront walk instead of an open slab.
  const railMat = new THREE.MeshLambertMaterial({ color: 0x5a6b80 });
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 404), railMat);
  railTop.position.set(199.4, 1.15, 0);
  scene.add(railTop);
  const railMid = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 404), railMat);
  railMid.position.set(199.4, 0.65, 0);
  scene.add(railMid);
  for (let z = -200; z <= 200; z += 8) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 5), railMat);
    post.position.set(199.4, 0.58, z);
    scene.add(post);
  }

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
  const yachts = [];
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
    // navigation lights: red port, green starboard, warm masthead — the
    // yachts read as occupied boats at anchor, not white boxes.
    const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff3344 }));
    navRed.position.set(4.4 * y.s, 1.1, -1.4 * y.s);
    g.add(navRed);
    const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0x37e08b }));
    navGreen.position.set(4.4 * y.s, 1.1, 1.4 * y.s);
    g.add(navGreen);
    const mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    mastLight.position.set(0.5, 8.1 * y.s, 0);
    g.add(mastLight);
    // warm cabin windows
    const cabGlow = new THREE.Mesh(new THREE.BoxGeometry(3.4 * y.s, 0.5, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xffd76a }));
    cabGlow.position.set(-0.5, 1.4, 1.05 * y.s);
    g.add(cabGlow);
    g.position.set(y.x, 0, y.z);
    g.rotation.y = rand(-0.3, 0.3);
    scene.add(g);
    yachts.push({ group: g, baseY: 0, phase: rand(0, Math.PI * 2), rotY: g.rotation.y });
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

  return {
    buildings, palms, lamps,
    // Living bay: yachts bob and roll gently on the swell, moon glitter
    // drifts across the water, and the water's sheen breathes.
    update(t) {
      for (const y of yachts) {
        y.group.position.y = Math.sin(t * 0.7 + y.phase) * 0.12;
        y.group.rotation.z = Math.sin(t * 0.55 + y.phase) * 0.02;
        y.group.rotation.y = y.rotY + Math.sin(t * 0.22 + y.phase) * 0.03;
      }
      for (const st of streaks) {
        st.mesh.position.z += st.speed * 0.016;
        if (st.mesh.position.z > 270) st.mesh.position.z = -270;
      }
      waterMat.emissive.setHex(0x061e33);
      waterMat.emissiveIntensity = 0.85 + Math.sin(t * 0.8) * 0.15;
    },
  };
}
