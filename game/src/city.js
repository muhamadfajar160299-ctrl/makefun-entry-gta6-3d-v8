// city.js — builds Velmara: a dense luxury marina city at night.
// Grid of avenues, tall lit towers, a glowing waterfront promenade, yachts
// on bright water, palm rows and neon everywhere. Static parts are merged
// into a few meshes so the frame stays fast and sharp.

const CITY = {
  roads: [-148, -74, 0, 74, 148],   // avenue centre lines, both axes
  roadHalf: 7,
  bound: 205,                        // drivable city edge
  marinaZ: 168,                      // promenade starts here
  waterZ: 192,                       // water starts here
  buildings: [],                     // collision AABBs {minX,maxX,minZ,maxZ}
  lamps: [],
  yachts: [],
  neonSigns: [],
  neonGlows: [],                      // glow sprites behind the neon signs
  mastGlows: [],                      // glow sprites on the yacht mastheads
  searchlights: [],                   // rotating beam rigs over the marina
};

// True when (x, z) falls inside a driving lane on either axis:
// within the road half-width plus a margin of a centreline.
function onRoadLane(x, z, margin) {
  const m = CITY.roadHalf + margin;
  for (const c of CITY.roads) {
    if (Math.abs(x - c) < m || Math.abs(z - c) < m) return true;
  }
  return false;
}

// Merge many small geometries into one mesh (positions/normals/uvs/index + vertex colour).
function mergeGeoms(parts) {
  let vCount = 0, iCount = 0;
  for (const p of parts) {
    vCount += p.geo.attributes.position.count;
    iCount += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const p of parts) {
    const g = p.geo;
    m.copy(p.matrix);
    nm.getNormalMatrix(m);
    const pa = g.attributes.position, na = g.attributes.normal;
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(m);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
      col[(vo + i) * 3] = p.color.r; col[(vo + i) * 3 + 1] = p.color.g; col[(vo + i) * 3 + 2] = p.color.b;
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < pa.count; i++) idx[io + i] = vo + i;
      io += pa.count;
    }
    vo += pa.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
function xform(x, y, z, ry, s) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s || 1, s || 1, s || 1));
  return m;
}

// ---- textures ----
function facadeTexture(base, trim, litRatio, warm) {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = trim; ctx.fillRect(0, 0, w, 6); ctx.fillRect(0, h - 6, w, 6);
    const cols = 8, rows = 12, cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = cityRand() < litRatio;
        if (lit) {
          ctx.fillStyle = cityRand() < (warm ? 0.75 : 0.4)
            ? ['#ffd98a', '#ffbe5e', '#ffe9b8'][Math.floor(cityRand() * 3)]
            : ['#bfe0ff', '#d8ecff', '#9fd0ff'][Math.floor(cityRand() * 3)];
          ctx.globalAlpha = 0.75 + cityRand() * 0.25;
        } else {
          ctx.fillStyle = '#10141f'; ctx.globalAlpha = 1;
        }
        ctx.fillRect(c * cw + 5, r * ch + 5, cw - 10, ch - 10);
      }
    }
    ctx.globalAlpha = 1;
  });
}
function neonSignTexture(text, color, sub) {
  return makeCanvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '900 64px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 26;
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, sub ? h / 2 - 14 : h / 2);
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, sub ? h / 2 - 14 : h / 2);
    if (sub) {
      ctx.font = '700 26px Arial, sans-serif';
      ctx.shadowBlur = 12; ctx.fillStyle = color;
      ctx.fillText(sub, w / 2, h - 26);
    }
  });
}
function roadTexture() {
  return makeCanvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2b3049'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f7c948';
    ctx.fillRect(w / 2 - 3, 20, 6, 70); ctx.fillRect(w / 2 - 3, 150, 6, 70);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(4, 0, 3, h); ctx.fillRect(w - 7, 0, 3, h);
  }, 1, 6);
}

// ---- collision ----
function isBlocked(x, z, r) {
  if (Math.abs(x) > CITY.bound || z < -CITY.bound) return true;
  // the piers reach into the bay and are walkable
  for (const px of [-120, -40, 40, 120]) {
    if (Math.abs(x - px) < 3.4 - r * 0.4 && z > 191 && z < 253) return false;
  }
  if (z > CITY.waterZ - 3) return true;           // the bay
  for (const b of CITY.buildings) {
    if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
  }
  return false;
}
function clampToFree(x, z, r, ox, oz) {
  // try axis-separated movement so cars slide along walls instead of sticking
  let nx = x, nz = z;
  if (isBlocked(nx, oz, r)) nx = ox;
  if (isBlocked(nx, nz, r)) nz = oz;
  if (isBlocked(nx, nz, r)) { nx = ox; nz = oz; }
  return { x: nx, z: nz };
}

// ---- buildings ----
const FACADE_MATS = [];
function buildBuildings() {
  const scene = G.scene;
  const variants = [
    facadeTexture('#1b2236', '#2c3a5e', 0.55, true),
    facadeTexture('#241d2e', '#4a2c4a', 0.5, true),
    facadeTexture('#12283a', '#1e4a66', 0.62, false),
    facadeTexture('#2e2118', '#6a4a22', 0.58, true),
  ];
  for (const t of variants) {
    FACADE_MATS.push(new THREE.MeshStandardMaterial({
      map: t, roughness: 0.55, metalness: 0.35, emissive: 0xffffff,
      emissiveMap: t, emissiveIntensity: 1.05,
    }));
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x141824, roughness: 0.9 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const intervals = [[-185, -155], [-141, -81], [-67, -7], [7, 67], [81, 141], [155, 185]];
  const zIntervals = [[-185, -155], [-141, -81], [-67, -7], [7, 67], [81, 141], [155, 161]];
  const neonTexts = [
    ['HOTEL MARINA', '#ff9d3c'], ['CASINO ROYALE', '#ff4d6d'], ['YACHT CLUB', '#37e0c8'],
    ['NEON BAY', '#c86bff'], ['SKYLINE', '#5ea8ff'], ['PALM COURT', '#ffd76a'],
    ['AZURE', '#37b6ff'], ['THE GOLDEN PALM', '#ffcf5e'],
    ['VELMARA', '#37e0c8'], ['MARINA BAY', '#ff5e8a'], ['THE PALMS', '#ffd76a'],
    ['NEON NIGHTS', '#c86bff'], ['GOLDEN HOUR', '#ffb03c'], ['LUNA BAR', '#5ea8ff'],
  ];
  let neonIdx = 0;
  for (const [x0, x1] of intervals) {
    for (const [z0, z1] of zIntervals) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const w = x1 - x0, d = z1 - z0;
      const distC = Math.hypot(cx, cz);
      const marinaRow = z0 >= 155;
      const count = marinaRow ? 1 : (cityRand() < 0.45 ? 1 : 2);
      for (let k = 0; k < count; k++) {
        const bw = count === 1 ? w * randRange(cityRand, 0.72, 0.92) : w * 0.44;
        const bd = count === 1 ? d * randRange(cityRand, 0.72, 0.92) : d * 0.44;
        const bx = count === 1 ? cx : cx + (k === 0 ? -w * 0.26 : w * 0.26);
        const bz = count === 1 ? cz : cz + (k === 0 ? -d * 0.26 : d * 0.26);
        const h = marinaRow
          ? randRange(cityRand, 42, 68)
          : Math.max(12, randRange(cityRand, 16, 58) * (1.25 - distC / 420));
        const mat = FACADE_MATS[Math.floor(cityRand() * FACADE_MATS.length)];
        const mesh = new THREE.Mesh(boxGeo, mat);
        mesh.scale.set(bw, h, bd);
        mesh.position.set(bx, h / 2, bz);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        CITY.buildings.push({ minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2 });
        // rooftop plant + beacon
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(bw * 0.22, 2.4, bd * 0.22);
        roof.position.set(bx + bw * 0.2, h + 1.2, bz - bd * 0.15);
        scene.add(roof);
        if (h > 40) {
          const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff3344 }));
          beacon.position.set(bx - bw * 0.25, h + 2.2, bz + bd * 0.2);
          scene.add(beacon);
          const bg = makeGlowSprite('rgba(255,60,80,0.9)', 7, 0.8);
          bg.position.copy(beacon.position);
          scene.add(bg);
        }
        // neon sign on the marina-facing hotels and the taller towers
        if ((marinaRow || h > 38) && neonIdx < neonTexts.length) {
          const [txt, col] = neonTexts[neonIdx++];
          const tex = neonSignTexture(txt, col);
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(bw * 0.85, 34), Math.min(bw * 0.85, 34) / 4),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
          );
          sign.position.set(bx, h * 0.82, bz + bd / 2 + 0.4);
          scene.add(sign);
          const sg = makeGlowSprite(col, 26, 0.5);
          sg.position.copy(sign.position); sg.position.z += 1.5;
          scene.add(sg);
          CITY.neonSigns.push(sign.material);
          CITY.neonGlows.push(sg);
        }
      }
    }
  }
}

// ---- roads, sidewalks, ground ----
function buildGround() {
  const scene = G.scene;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 760),
    new THREE.MeshStandardMaterial({ color: 0x141824, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 90);
  ground.receiveShadow = true;
  scene.add(ground);

  const roadTex = roadTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x4a5068, roughness: 0.9 });
  for (const c of CITY.roads) {
    // north-south avenue
    const r1 = new THREE.Mesh(new THREE.PlaneGeometry(14, 430), roadMat);
    r1.rotation.x = -Math.PI / 2; r1.position.set(c, 0, 0); r1.receiveShadow = true;
    scene.add(r1);
    const r2 = new THREE.Mesh(new THREE.PlaneGeometry(14, 430), roadMat);
    r2.rotation.x = -Math.PI / 2; r2.rotation.z = Math.PI / 2; r2.position.set(0, 0, c);
    r2.receiveShadow = true;
    scene.add(r2);
    // sidewalks
    for (const s of [-1, 1]) {
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 430), walkMat);
      w1.rotation.x = -Math.PI / 2; w1.position.set(c + s * 9.4, 0.08, 0);
      w1.receiveShadow = true; scene.add(w1);
      const w2 = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 430), walkMat);
      w2.rotation.x = -Math.PI / 2; w2.rotation.z = Math.PI / 2;
      w2.position.set(0, 0.08, c + s * 9.4); w2.receiveShadow = true; scene.add(w2);
    }
  }
  // crosswalk stripes at the main intersections
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xdde6f5 });
  for (const cx of CITY.roads) {
    for (const cz of CITY.roads) {
      for (let i = -2; i <= 2; i++) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 5.5), stripeMat);
        s.rotation.x = -Math.PI / 2;
        s.position.set(cx + i * 2.4, 0.06, cz + 9);
        scene.add(s);
      }
    }
  }
}

// ---- marina: promenade, water, piers, yachts ----
function buildMarina() {
  const scene = G.scene;
  // promenade deck — warm stone tiles
  const promTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6a5f4d'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,220,160,0.08)';
    for (let i = 0; i < 40; i++) ctx.fillRect(cityRand() * w, cityRand() * h, 20, 12);
  }, 24, 2);
  const prom = new THREE.Mesh(
    new THREE.PlaneGeometry(430, 26),
    new THREE.MeshStandardMaterial({ map: promTex, roughness: 0.85 })
  );
  prom.rotation.x = -Math.PI / 2;
  prom.position.set(0, 0.12, 178);
  prom.receiveShadow = true;
  scene.add(prom);
  // railing posts along the water edge
  const postParts = [];
  const railMat = new THREE.Color(0x8a93a8);
  for (let x = -205; x <= 205; x += 6) {
    postParts.push({ geo: new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), matrix: xform(x, 0.7, 190.5, 0), color: railMat });
  }
  scene.add(new THREE.Mesh(mergeGeoms(postParts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.7 })));
  const rail = new THREE.Mesh(new THREE.BoxGeometry(412, 0.12, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x8a93a8, roughness: 0.4, metalness: 0.8 }));
  rail.position.set(0, 1.25, 190.5);
  scene.add(rail);

  // water — deep blue, very shiny so lamps and neon reflect in the specular
  G.waterTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0a2a4a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(${120 + Math.floor(cityRand() * 80)},${170 + Math.floor(cityRand() * 50)},255,${0.10 + cityRand() * 0.22})`;
      ctx.lineWidth = 1 + cityRand() * 2;
      const y = cityRand() * h, x = cityRand() * w, len = 14 + cityRand() * 42;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y + (cityRand() - 0.5) * 4); ctx.stroke();
    }
  }, 10, 10);
  G.waterMat = new THREE.MeshPhongMaterial({
    color: 0x1a5c94, map: G.waterTex, shininess: 160, specular: 0xbfe0ff,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(560, 260), G.waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.4, 320);
  scene.add(water);
  // warm light over the bay so the yachts and water glow
  const bayLight1 = new THREE.PointLight(0xffd9a0, 700, 230, 1.5);
  bayLight1.position.set(-60, 18, 232);
  scene.add(bayLight1);
  const bayLight2 = new THREE.PointLight(0x9fd0ff, 500, 230, 1.5);
  bayLight2.position.set(70, 18, 240);
  scene.add(bayLight2);
  // glowing marker buoys across the bay
  for (const [bx, bz] of [[-140, 215], [-70, 240], [0, 218], [80, 244], [150, 218], [-180, 250], [190, 248], [30, 262]]) {
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffb03c }));
    buoy.position.set(bx, 0.4, bz);
    scene.add(buoy);
    const bg = makeGlowSprite('rgba(255,176,60,0.9)', 6, 0.8);
    bg.position.set(bx, 0.6, bz);
    scene.add(bg);
  }

  // piers
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
  for (const px of [-120, -40, 40, 120]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(7, 0.7, 62), pierMat);
    pier.position.set(px, 0.1, 222);
    pier.receiveShadow = true;
    scene.add(pier);
    for (let z = 200; z <= 248; z += 12) {
      const lamp = makeGlowSprite('rgba(255,200,110,0.9)', 5, 0.75);
      lamp.position.set(px + 3, 2.2, z);
      scene.add(lamp);
    }
  }

  // yachts — white hulls, glass cabins, masts, navigation lights
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf2f5fa, roughness: 0.25, metalness: 0.35 });
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x1a2436, roughness: 0.15, metalness: 0.6, emissive: 0xffd98a, emissiveIntensity: 0.55,
  });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xd8dee8, roughness: 0.4, metalness: 0.7 });
  const yachtSpots = [
    [-150, 232, 0.3], [-95, 246, -0.2], [-8, 228, 0.15], [72, 244, -0.35],
    [150, 230, 0.2], [185, 252, -0.15], [-185, 250, 0.1], [18, 258, 0.05],
  ];
  for (const [x, z, yaw] of yachtSpots) {
    const yacht = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 17), hullMat);
    hull.position.y = 0.6; hull.castShadow = true;
    yacht.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(2.5, 5, 4), hullMat);
    bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
    bow.scale.set(1, 1, 0.55); bow.position.set(0, 0.6, 10.6);
    yacht.add(bow);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 8), cabinMat);
    cabin.position.set(0, 2.4, -1); cabin.castShadow = true;
    yacht.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 9, 6), mastMat);
    mast.position.set(0, 7, 1);
    yacht.add(mast);
    const topLight = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    topLight.position.set(0, 11.6, 1);
    yacht.add(topLight);
    const glow = makeGlowSprite('rgba(255,240,200,0.9)', 6, 0.8);
    glow.position.set(0, 11.6, 1);
    yacht.add(glow);
    CITY.mastGlows.push(glow);
    const port = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3344 }));
    port.position.set(-2.6, 1.6, 8);
    yacht.add(port);
    const starb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x33ff66 }));
    starb.position.set(2.6, 1.6, 8);
    yacht.add(starb);
    yacht.position.set(x, -0.2, z);
    yacht.rotation.y = yaw;
    scene.add(yacht);
    G.yachts.push(yacht);
    CITY.yachts.push(yacht);
  }

  // "VELMARA MARINA" arch over the promenade entrance
  const archMat = new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: 0.4, metalness: 0.6 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 1.2), archMat);
    post.position.set(s * 13, 4.5, 168);
    scene.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(27.5, 1.4, 1.4), archMat);
  beam.position.set(0, 9.4, 168);
  scene.add(beam);
  const archTex = neonSignTexture('VELMARA MARINA', '#37e0c8', 'YACHTS · HOTELS · NIGHTLIFE');
  const archSign = new THREE.Mesh(new THREE.PlaneGeometry(24, 6),
    new THREE.MeshBasicMaterial({ map: archTex, transparent: true }));
  archSign.position.set(0, 7.2, 168);
  archSign.rotation.y = Math.PI;   // readable from the city side (north)
  scene.add(archSign);
  // second face so the sign reads correctly from the marina side too
  const archSignSouth = new THREE.Mesh(new THREE.PlaneGeometry(24, 6),
    new THREE.MeshBasicMaterial({ map: archTex, transparent: true }));
  archSignSouth.position.set(0, 7.2, 167.85);
  scene.add(archSignSouth);
  scene.add(archSign);
  const ag = makeGlowSprite('rgba(55,224,200,0.8)', 30, 0.5);
  ag.position.set(0, 7.2, 169.5);
  scene.add(ag);
}

// ---- palms, lamps, benches, traffic lights ----
function buildStreetProps() {
  const scene = G.scene;
  const trunkParts = [], crownParts = [];
  const trunkCol = new THREE.Color(0x6a4a2c), crownCol = new THREE.Color(0x1d5c33);
  const crownCol2 = new THREE.Color(0x2a7a44);
  function addPalm(x, z, s) {
    trunkParts.push({ geo: new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 7 * s, 7), matrix: xform(x, 3.5 * s, z, 0), color: trunkCol });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const frond = new THREE.ConeGeometry(0.85 * s, 4.6 * s, 4);
      const m = new THREE.Matrix4().makeTranslation(x, 7 * s, z)
        .multiply(new THREE.Matrix4().makeRotationY(a))
        .multiply(new THREE.Matrix4().makeRotationX(1.15))
        .multiply(new THREE.Matrix4().makeTranslation(0, 1.9 * s, 0));
      crownParts.push({ geo: frond, matrix: m, color: i % 2 ? crownCol : crownCol2 });
    }
    const nut = new THREE.SphereGeometry(0.3 * s, 6, 6);
    crownParts.push({ geo: nut, matrix: xform(x + 0.3 * s, 6.7 * s, z, 0), color: new THREE.Color(0x8a6a3a) });
  }
  // Palm rows. Every palm stands on a sidewalk, 10 units off its avenue's
  // centreline (clear of the 7-wide driving lane), and none is planted
  // inside the lane of any crossing avenue — no palm in any road, ever.
  for (let x = -200; x <= 200; x += 16) {
    if (!onRoadLane(x, 172, 1.5)) addPalm(x, 172, randRange(cityRand, 0.9, 1.15));
  }
  for (let z = -180; z <= 150; z += 26) {
    if (!onRoadLane(-10, z, 1.5)) addPalm(-10, z, 1);
    if (!onRoadLane(10, z + 13, 1.5)) addPalm(10, z + 13, 1);
  }
  for (let x = -180; x <= 180; x += 40) {
    if (!onRoadLane(x, -10, 1.5)) addPalm(x, -10, 0.95);
    if (!onRoadLane(x + 20, 10, 1.5)) addPalm(x + 20, 10, 0.95);
  }
  const trunkMesh = new THREE.Mesh(mergeGeoms(trunkParts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  trunkMesh.userData.propCheck = 'trunk';   // lane check reads these bases
  scene.add(trunkMesh);
  const crowns = new THREE.Mesh(mergeGeoms(crownParts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  crowns.castShadow = true;
  scene.add(crowns);

  // street lamps: merged poles + bright heads + glow sprites
  const poleParts = [];
  const poleCol = new THREE.Color(0x22283a);
  const lampSpots = [];
  for (const c of CITY.roads) {
    for (let d = -185; d <= 185; d += 37) {
      lampSpots.push([c + 8.6, d, 0]);
      lampSpots.push([c - 8.6, d + 18, Math.PI]);
    }
  }
  for (const [x, z, ry] of lampSpots) {
    if (onRoadLane(x, z, 1)) continue;   // never plant a pole in a driving lane
    poleParts.push({ geo: new THREE.CylinderGeometry(0.09, 0.13, 6.4, 6), matrix: xform(x, 3.2, z, 0), color: poleCol });
    const arm = new THREE.BoxGeometry(1.6, 0.1, 0.1);
    const am = new THREE.Matrix4().makeTranslation(x, 6.3, z)
      .multiply(new THREE.Matrix4().makeRotationY(ry))
      .multiply(new THREE.Matrix4().makeTranslation(ry === 0 ? -0.8 : 0.8, 0, 0));
    poleParts.push({ geo: arm, matrix: am, color: poleCol });
    const hx = x + (ry === 0 ? -1.6 : 1.6);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
    head.position.set(hx, 6.25, z);
    scene.add(head);
    const glow = makeGlowSprite('rgba(255,205,120,0.9)', 9, 0.75);
    glow.position.set(hx, 6.25, z);
    scene.add(glow);
    CITY.lamps.push({ x: hx, z });
  }
  const poleMesh = new THREE.Mesh(mergeGeoms(poleParts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 }));
  poleMesh.userData.propCheck = 'pole';   // lane check reads these bases
  scene.add(poleMesh);

  // benches + planters on the promenade
  const benchParts = [];
  const benchCol = new THREE.Color(0x7a5c38);
  for (let x = -190; x <= 190; x += 24) {
    benchParts.push({ geo: new THREE.BoxGeometry(3.2, 0.18, 1), matrix: xform(x, 0.75, 181, 0), color: benchCol });
    benchParts.push({ geo: new THREE.BoxGeometry(3.2, 0.9, 0.14), matrix: xform(x, 1.1, 181.45, 0), color: benchCol });
  }
  scene.add(new THREE.Mesh(mergeGeoms(benchParts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));

  // traffic lights at the four central intersections
  const tlPole = new THREE.MeshStandardMaterial({ color: 0x1c2233, roughness: 0.5, metalness: 0.6 });
  for (const [cx, cz] of [[0, 0], [0, 74], [74, 0], [-74, 0]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.5, 6), tlPole);
    pole.position.set(cx + 8.4, 3.25, cz + 8.4);
    scene.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.1, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x11141c, roughness: 0.6 }));
    box.position.set(cx + 8.4, 6.6, cz + 8.4);
    scene.add(box);
    const green = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x2dff7a }));
    green.position.set(cx + 8.4, 5.9, cz + 8.75);
    scene.add(green);
    const gg = makeGlowSprite('rgba(45,255,122,0.9)', 4, 0.7);
    gg.position.copy(green.position);
    scene.add(gg);
  }
  buildPromenadeLife();
}

// ---- promenade life: cafe tables, kiosks, planters, string lights ----
function buildPromenadeLife() {
  const scene = G.scene;
  const parts = [];
  const wood = new THREE.Color(0x7a5c38);
  const white = new THREE.Color(0xe8e4da);
  const green = new THREE.Color(0x2a7a44);
  const terracotta = new THREE.Color(0xa85a34);
  // cafe tables with umbrellas along the water edge, clear of the
  // waterfront chase line (z 177) and slotted between the benches
  const cafeSpots = [[-70, 184], [-46, 184], [-22, 184], [2, 184], [26, 184], [74, 184]];
  for (const [x, z] of cafeSpots) {
    parts.push({ geo: new THREE.CylinderGeometry(0.09, 0.09, 1.0, 6), matrix: xform(x, 0.5, z, 0), color: wood });
    parts.push({ geo: new THREE.CylinderGeometry(1.15, 1.15, 0.08, 12), matrix: xform(x, 1.02, z, 0), color: white });
    parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), matrix: xform(x, 2.2, z, 0), color: wood });
    parts.push({ geo: new THREE.ConeGeometry(1.7, 0.9, 8), matrix: xform(x, 3.9, z, 0), color: terracotta });
    for (const [dx, dz] of [[-1.3, 0.6], [1.3, -0.6]]) {
      parts.push({ geo: new THREE.BoxGeometry(0.55, 0.08, 0.55), matrix: xform(x + dx, 0.55, z + dz, 0), color: wood });
    }
  }
  // planters with shrubs along the water edge (never in a driving lane)
  for (let x = -180; x <= 180; x += 30) {
    if (onRoadLane(x, 188, 1.5)) continue;
    parts.push({ geo: new THREE.BoxGeometry(1.6, 0.7, 1.6), matrix: xform(x, 0.35, 188, 0), color: terracotta });
    parts.push({ geo: new THREE.SphereGeometry(0.85, 8, 6), matrix: xform(x, 1.1, 188, 0), color: green });
  }
  scene.add(new THREE.Mesh(mergeGeoms(parts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
  // food kiosks with glowing awnings, slotted between the benches
  for (const [x, z, col] of [[50, 186, 0xff5e8a], [-58, 184, 0xffb03c]]) {
    const kiosk = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 2.2),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col, emissiveIntensity: 0.25 }));
    body.position.y = 1.1;
    kiosk.add(body);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xf2f5fa, roughness: 0.6 }));
    awn.position.y = 2.35;
    kiosk.add(awn);
    const glow = makeGlowSprite('rgba(255,220,150,0.9)', 7, 0.7);
    glow.position.y = 2.6;
    kiosk.add(glow);
    kiosk.position.set(x, 0, z);
    scene.add(kiosk);
  }
  // second bench row facing the water
  const benchParts2 = [];
  for (let x = -178; x <= 178; x += 24) {
    benchParts2.push({ geo: new THREE.BoxGeometry(3.2, 0.18, 1), matrix: xform(x, 0.75, 186.5, 0), color: wood });
    benchParts2.push({ geo: new THREE.BoxGeometry(3.2, 0.9, 0.14), matrix: xform(x, 1.1, 186.95, 0), color: wood });
  }
  scene.add(new THREE.Mesh(mergeGeoms(benchParts2),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
  // string lights sagging between the promenade palms near the walk
  for (let x = -64; x < 80; x += 16) {
    for (let i = 1; i <= 4; i++) {
      const bx = x + (i / 5) * 16;
      const by = 6.4 - Math.sin((i / 5) * Math.PI) * 1.1;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      bulb.position.set(bx, by, 172);
      scene.add(bulb);
      const glow = makeGlowSprite('rgba(255,205,130,0.95)', 1.6, 0.8);
      glow.position.set(bx, by, 172);
      scene.add(glow);
    }
  }
}

// ---- searchlights sweeping the sky over the marina ----
function buildSearchlights() {
  const scene = G.scene;
  for (const [bx, bz] of [[-60, 176], [70, 176]]) {
    const rig = new THREE.Group();
    rig.position.set(bx, 0, bz);
    const geo = new THREE.CylinderGeometry(7, 0.7, 95, 12, 1, true);
    geo.translate(0, 47.5, 0);
    const beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xfff2c8, transparent: true, opacity: 0.07,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false,
    }));
    beam.rotation.z = 0.42;
    rig.add(beam);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.6, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: 0.4, metalness: 0.7 }));
    base.position.y = 0.8;
    rig.add(base);
    const glow = makeGlowSprite('rgba(255,242,200,0.95)', 9, 0.85);
    glow.position.y = 2.2;
    rig.add(glow);
    scene.add(rig);
    CITY.searchlights.push(rig);
  }
}

// ---- objective beacon (tall gold pillar of light at the mission target) ----
function buildObjectiveBeacon() {
  const geo = new THREE.CylinderGeometry(1.2, 2.0, 60, 16, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffc94d, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(geo, mat);
  beacon.position.set(0, 30, 176);
  G.scene.add(beacon);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.22, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xffc94d }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.25, 176);
  G.scene.add(ring);
  const glow = makeGlowSprite('rgba(255,201,77,0.9)', 6, 0.35);
  glow.position.set(0, 2, 176);
  G.scene.add(glow);
  beacon.userData.ring = ring;
  beacon.userData.glow = glow;
  G.objectiveBeacon = beacon;
}

function buildCity() {
  buildGround();
  buildBuildings();
  buildMarina();
  buildStreetProps();
  buildSearchlights();
  buildObjectiveBeacon();
}

function animateCity(dt, t) {
  if (G.waterTex) { G.waterTex.offset.y += dt * 0.03; G.waterTex.offset.x += dt * 0.008; }
  for (let i = 0; i < G.yachts.length; i++) {
    const y = G.yachts[i];
    y.position.y = -0.2 + Math.sin(t * 0.7 + i * 1.3) * 0.14;
    y.rotation.z = Math.sin(t * 0.5 + i) * 0.012;
  }
  if (G.objectiveBeacon) {
    G.objectiveBeacon.rotation.y += dt * 0.8;
    const s = 1 + Math.sin(t * 3) * 0.08;
    G.objectiveBeacon.userData.ring.scale.set(s, s, 1);
  }
  // neon shimmer: strong brightness breathing so signs feel alive
  for (let i = 0; i < CITY.neonSigns.length; i++) {
    CITY.neonSigns[i].opacity = 0.82 + Math.sin(t * 2.2 + i * 1.7) * 0.18;
  }
  for (let i = 0; i < CITY.neonGlows.length; i++) {
    const s = 24 + Math.sin(t * 2.2 + i * 1.7) * 5;
    CITY.neonGlows[i].scale.set(s, s, 1);
  }
  // yacht mast lights blink in turn
  for (let i = 0; i < CITY.mastGlows.length; i++) {
    CITY.mastGlows[i].material.opacity = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.8 + i * 2.1));
  }
  // searchlights sweep the sky over the marina
  for (let i = 0; i < CITY.searchlights.length; i++) {
    CITY.searchlights[i].rotation.y += dt * (i === 0 ? 0.22 : -0.17);
  }
}
