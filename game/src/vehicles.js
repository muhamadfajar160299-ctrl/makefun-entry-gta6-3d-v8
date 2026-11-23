// vehicles.js — car factory and traffic AI.
//
// Every car is built from boxes and cylinders with bright, readable paint:
// the hero in vivid crimson, taxis in signal yellow, police in bright white
// with a black hood and a glowing light bar. Brake lights and indicators are
// unlit basic materials so they read at a glance, day or night.
const THREE = window.THREE;

const TRAFFIC_COLORS = [0x3f7fd0, 0x7ab648, 0xc7cdd6, 0xd08a3f, 0x8a5fd0, 0x4fb3a9];

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function makeWheel(x, z, r = 0.36) {
  const g = new THREE.Group();
  g.position.set(x, r, z);
  // Axle along local Z (car width): cylinder axis Y rotated about X.
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.26, 14),
    new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.9 }),
  );
  tyre.rotation.x = Math.PI / 2;
  g.add(tyre);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.28, 10),
    new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: 0.35, metalness: 0.7 }),
  );
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

// kind: 'hero' | 'sedan' | 'taxi' | 'van' | 'police'
export function buildCarMesh(kind, color = 0xd0342c) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color, roughness: kind === 'hero' ? 0.28 : 0.45, metalness: kind === 'hero' ? 0.55 : 0.35,
    emissive: kind === 'hero' ? 0x2a0505 : 0x000000, emissiveIntensity: 1,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.7, metalness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd6dde8, roughness: 0.25, metalness: 0.85 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fc8e8, roughness: 0.12, metalness: 0.6 });

  const isVan = kind === 'van';
  const L = isVan ? 5.4 : 4.6;
  const W = isVan ? 2.1 : 1.95;
  const bodyH = isVan ? 1.5 : 0.62;

  const body = box(L, bodyH, W, paint, 0, 0.62, 0);
  g.add(body);
  if (isVan) {
    g.add(box(L * 0.82, 0.95, W * 0.94, paint, -0.2, 1.8, 0));
    g.add(box(0.1, 0.8, W * 0.9, glass, L * 0.24, 1.75, 0));
  } else {
    // Cabin with glasshouse.
    const cabin = box(L * 0.48, 0.55, W * 0.86, paint, -0.25, 1.18, 0);
    g.add(cabin);
    g.add(box(L * 0.42, 0.42, W * 0.88, glass, -0.25, 1.2, 0));
    // Hood + trunk deck lines.
    g.add(box(0.06, 0.03, W * 0.9, dark, 1.35, 0.94, 0));
    g.add(box(0.06, 0.03, W * 0.9, dark, -1.55, 0.94, 0));
  }

  // Grille + chrome strip (hero detail).
  g.add(box(0.08, 0.2, W * 0.62, dark, L / 2 + 0.01, 0.62, 0));
  g.add(box(0.04, 0.06, W * 0.66, chrome, L / 2 + 0.05, 0.74, 0));
  // Bumpers.
  g.add(box(0.22, 0.22, W + 0.06, dark, L / 2 - 0.02, 0.36, 0));
  g.add(box(0.22, 0.22, W + 0.06, dark, -L / 2 + 0.02, 0.36, 0));
  if (kind === 'hero') {
    // Spoiler on struts.
    g.add(box(0.06, 0.3, 0.08, dark, -L / 2 + 0.35, 1.05, 0.6));
    g.add(box(0.06, 0.3, 0.08, dark, -L / 2 + 0.35, 1.05, -0.6));
    g.add(box(0.5, 0.07, 1.9, paint, -L / 2 + 0.35, 1.22, 0));
    // Twin exhausts.
    for (const s of [-0.45, 0.45]) {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), chrome);
      ex.rotation.x = Math.PI / 2;
      ex.position.set(-L / 2 - 0.08, 0.3, s);
      g.add(ex);
    }
  }
  // Side mirrors.
  g.add(box(0.16, 0.1, 0.12, paint, 0.75, 1.05, W / 2 + 0.06));
  g.add(box(0.16, 0.1, 0.12, paint, 0.75, 1.05, -W / 2 - 0.06));

  // Headlights (bright, unlit) + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  for (const s of [-0.62, 0.62]) {
    g.add(box(0.06, 0.16, 0.42, headMat, L / 2 + 0.02, 0.72, s));
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x881111 });
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
  const tailL = box(0.06, 0.14, 0.5, tailMat, -L / 2 - 0.02, 0.72, -0.55);
  const tailR = box(0.06, 0.14, 0.5, tailMat, -L / 2 - 0.02, 0.72, 0.55);
  g.add(tailL);
  g.add(tailR);
  // Separate brake strip across the trunk, lit hard on braking.
  const brakeStrip = box(0.05, 0.1, 1.3, brakeMat, -L / 2 - 0.03, 0.9, 0);
  g.add(brakeStrip);

  // Indicators (amber, blinked by the AI / player).
  const signalMatL = new THREE.MeshBasicMaterial({ color: 0x8a5a10 });
  const signalMatR = new THREE.MeshBasicMaterial({ color: 0x8a5a10 });
  g.add(box(0.05, 0.1, 0.3, signalMatL, L / 2 + 0.02, 0.72, -0.85));
  g.add(box(0.05, 0.1, 0.3, signalMatR, L / 2 + 0.02, 0.72, 0.85));

  // Wheels.
  const wheels = [];
  for (const [wx, wz] of [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]]) {
    const w = makeWheel(wx, wz);
    g.add(w);
    wheels.push(w);
  }

  let lightBar = null;
  let headCones = null;
  if (kind === 'police') {
    // White body with black hood/trunk and a blue door stripe.
    body.material = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.35, metalness: 0.3 });
    g.add(box(0.9, 0.05, W * 0.9, dark, 1.6, 0.95, 0));
    g.add(box(0.7, 0.05, W * 0.9, dark, -1.7, 0.95, 0));
    const stripe = box(1.6, 0.22, 0.04, new THREE.MeshBasicMaterial({ color: 0x1d4fd7 }), -0.1, 0.72, W / 2 + 0.01);
    g.add(stripe);
    const stripe2 = stripe.clone();
    stripe2.position.z = -W / 2 - 0.01;
    g.add(stripe2);
    const barBase = box(0.5, 0.12, 1.1, dark, -0.25, 1.52, 0);
    g.add(barBase);
    const redLens = box(0.44, 0.14, 0.5, new THREE.MeshBasicMaterial({ color: 0xff2222 }), -0.25, 1.56, 0.28);
    const blueLens = box(0.44, 0.14, 0.5, new THREE.MeshBasicMaterial({ color: 0x2244ff }), -0.25, 1.56, -0.28);
    g.add(redLens);
    g.add(blueLens);
    lightBar = { red: redLens.material, blue: blueLens.material };
  }
  if (kind === 'taxi') {
    const sign = box(0.7, 0.22, 0.4, new THREE.MeshBasicMaterial({ color: 0xffe27a }), -0.25, 1.58, 0);
    g.add(sign);
  }

  // Volumetric-look headlight cones (additive, unlit) — apex at the
  // headlight, widening forward along local +X. One rotation only:
  // rotation.z = PI/2 maps the cone apex (+Y) to -X, base to +X.
  if (kind === 'hero' || kind === 'police') {
    headCones = new THREE.Group();
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffeec2, transparent: true, opacity: 0.13,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    // Smaller, dimmer, tilted slightly down so the beam reads on the road
    // ahead instead of as a bright bubble above the roof.
    for (const s of [-0.62, 0.62]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0, 8, 12, 1, true), coneMat);
      cone.rotation.z = Math.PI / 2 - 0.07;
      cone.position.set(L / 2 + 4, 0.58, s);
      headCones.add(cone);
    }
    g.add(headCones);
  }

  return {
    group: g, wheels, brakeMat, tailMat, signalMatL, signalMatR,
    headMat, lightBar, headCones, length: L, width: W, paint,
  };
}

// --- Traffic AI -----------------------------------------------------------
const LANES = [-100, -50, 0, 50, 100];

function pickLaneStart(rng) {
  const vertical = rng() < 0.5;
  const lane = LANES[Math.floor(rng() * LANES.length)];
  const along = -120 + rng() * 240;
  return vertical
    ? { x: lane + 3.5, z: along, heading: rng() < 0.5 ? 0 : Math.PI }
    : { x: along, z: lane + 3.5, heading: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
}

export function createTraffic(scene, count = 10) {
  const cars = [];
  let seed = 1234567;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const kinds = ['sedan', 'sedan', 'taxi', 'van', 'sedan', 'taxi', 'sedan', 'van', 'sedan', 'taxi'];
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length];
    const color = kind === 'taxi' ? 0xf5c518 : TRAFFIC_COLORS[i % TRAFFIC_COLORS.length];
    const mesh = buildCarMesh(kind, color);
    const s = pickLaneStart(rng);
    mesh.group.position.set(s.x, 0, s.z);
    mesh.group.rotation.y = s.heading;
    scene.add(mesh.group);
    cars.push({
      mesh, kind, x: s.x, z: s.z, heading: s.heading,
      speed: 6 + rng() * 5, targetSpeed: 8 + rng() * 5,
      vertical: Math.abs(Math.sin(s.heading)) < 0.5,
      lane: s.vertical ? s.x : s.z,
      braking: false, signal: 0, signalTimer: 0, turnAt: null,
      stopped: 0,
    });
  }
  return cars;
}

function aheadClear(cars, self, playerPos, policePos) {
  const fx = Math.sin(self.heading);
  const fz = -Math.cos(self.heading);
  const check = (ox, oz, minD) => {
    const dx = ox - self.x;
    const dz = oz - self.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    return along > 0 && along < minD && side < 2.6;
  };
  for (const c of cars) {
    if (c === self) continue;
    if (check(c.x, c.z, 11)) return false;
  }
  if (playerPos && check(playerPos.x, playerPos.z, 11)) return false;
  for (const p of policePos || []) if (check(p.x, p.z, 11)) return false;
  return true;
}

export function updateTraffic(cars, dt, t, playerPos, policeCars) {
  const policePos = (policeCars || []).filter((p) => p.active).map((p) => ({ x: p.x, z: p.z }));
  for (const c of cars) {
    // At an intersection, sometimes turn — signal first, then turn.
    const nearX = Math.abs(c.x - Math.round(c.x / 50) * 50) < 1.2;
    const nearZ = Math.abs(c.z - Math.round(c.z / 50) * 50) < 1.2;
    if (c.turnAt === null && nearX && nearZ && Math.random() < 0.012) {
      c.turnAt = { x: Math.round(c.x / 50) * 50, z: Math.round(c.z / 50) * 50 };
      c.signal = Math.random() < 0.5 ? -1 : 1;
      c.signalTimer = 0.9;
    }
    if (c.turnAt) {
      c.signalTimer -= dt;
      const d = Math.hypot(c.x - c.turnAt.x, c.z - c.turnAt.z);
      if (d < 1.5 && c.signalTimer <= 0) {
        c.heading += c.signal * Math.PI / 2;
        c.turnAt = null;
        c.signal = 0;
      }
    }
    // Brake for the car ahead.
    c.braking = !aheadClear(cars, c, playerPos, policePos);
    const want = c.braking ? 0 : c.targetSpeed;
    c.speed += Math.max(-14 * dt, Math.min(6 * dt, want - c.speed));
    const fx = Math.sin(c.heading);
    const fz = -Math.cos(c.heading);
    c.x += fx * c.speed * dt;
    c.z += fz * c.speed * dt;
    // Wrap around the city edge.
    if (c.x > 130) c.x = -130;
    if (c.x < -130) c.x = 130;
    if (c.z > 130) c.z = -130;
    if (c.z < -130) c.z = 130;
    // Pose (mesh yaw is PI/2 - heading: the model faces local +X).
    c.mesh.group.position.set(c.x, 0, c.z);
    c.mesh.group.rotation.y = Math.PI / 2 - c.heading;
    const spin = c.speed * dt * 2.8;
    for (const w of c.mesh.wheels) w.rotation.z += spin;
    // Brake lights + indicators.
    c.mesh.brakeMat.color.setHex(c.braking ? 0xff2a2a : 0x881111);
    const blink = c.signal !== 0 && Math.sin(t * 9) > 0;
    c.mesh.signalMatL.color.setHex(blink && c.signal < 0 ? 0xffb020 : 0x8a5a10);
    c.mesh.signalMatR.color.setHex(blink && c.signal > 0 ? 0xffb020 : 0x8a5a10);
  }
}
