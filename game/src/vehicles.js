// vehicles.js — luxury cars: detailed models, arcade driving, traffic AI.
// Cars are built from shaped parts (never plain boxes): glass cabin, chrome
// trim, glowing headlights and taillights, spinning wheels, spoilers.

const LUXURY_PAINTS = [0xd4af37, 0xc0392b, 0xe8e8ec, 0x0d1b3e, 0x1a1a1e, 0x2e8b8b, 0x7a1f2b, 0x3a5f8a];
const TRAFFIC_PAINTS = [0x8a97a8, 0x5a6a7a, 0xb8b0a0, 0x3a4a5a, 0x6a5a6a, 0x2a3a2a, 0xc8c8c8, 0x4a3a2a];

function buildCarMesh(colorHex, opts) {
  opts = opts || {};
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: colorHex, roughness: 0.22, metalness: 0.9,
    emissive: colorHex, emissiveIntensity: 0.14,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x0a1420, roughness: 0.08, metalness: 0.9,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xdfe6ee, roughness: 0.12, metalness: 1.0,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.7, metalness: 0.3 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95 });

  // lower body — long, low, wide
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.62, 4.5), paint);
  body.position.y = 0.62; body.castShadow = true;
  group.add(body);
  // sculpted hood + trunk deck
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.15), paint);
  hood.position.set(0, 0.98, 1.55); hood.castShadow = true;
  group.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.28, 0.9), paint);
  trunk.position.set(0, 0.96, -1.7);
  group.add(trunk);
  // glass cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.2, -0.25); cabin.castShadow = true;
  group.add(cabin);
  // chrome window trim + side skirts
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.07, 4.52), chrome);
  trim.position.y = 0.86;
  group.add(trim);
  const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 3.6), chrome);
  skirtL.position.set(-0.99, 0.42, 0); group.add(skirtL);
  const skirtR = skirtL.clone(); skirtR.position.x = 0.99; group.add(skirtR);
  // grille + front bumper
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.08), dark);
  grille.position.set(0, 0.62, 2.27);
  group.add(grille);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xf2f5fa, roughness: 0.4 }));
  plate.position.set(0, 0.42, 2.28);
  group.add(plate);
  // headlights — bright white, with glow
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), headMat);
    hl.position.set(s * 0.62, 0.82, 2.26);
    group.add(hl);
    const glow = makeGlowSprite('rgba(255,244,200,0.95)', 1.8, 0.85);
    glow.position.set(s * 0.62, 0.82, 2.4);
    group.add(glow);
  }
  // taillights — full-width red bar
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff2233 }));
  tail.position.set(0, 0.86, -2.27);
  group.add(tail);
  const tailGlow = makeGlowSprite('rgba(255,40,60,0.8)', 3.2, 0.6);
  tailGlow.position.set(0, 0.86, -2.4);
  group.add(tailGlow);
  // mirrors
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.28), paint);
    m.position.set(s * 1.04, 1.08, 0.55);
    group.add(m);
  }
  // wheels with chrome rims
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 18);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd8dee8, roughness: 0.2, metalness: 1 });
  for (const [wx, wz] of [[-0.92, 1.45], [0.92, 1.45], [-0.92, -1.45], [0.92, -1.45]]) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(wheelGeo, tyre);
    t.rotation.z = Math.PI / 2; t.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    w.add(t); w.add(rim);
    w.position.set(wx, 0.36, wz);
    group.add(w);
    wheels.push(w);
  }
  if (opts.sport) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.4), dark);
    spoiler.position.set(0, 1.18, -2.05);
    group.add(spoiler);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), dark);
      leg.position.set(s * 0.6, 1.06, -2.05);
      group.add(leg);
    }
  }
  let lightBar = null;
  if (opts.police) {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.4), dark);
    barBase.position.set(0, 1.56, -0.25);
    group.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    red.position.set(-0.28, 1.6, -0.25);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.set(0.28, 1.6, -0.25);
    group.add(blue);
    lightBar = { red: red.material, blue: blue.material };
  }
  group.userData.wheels = wheels;
  group.userData.lightBar = lightBar;
  if (opts.glow) {
    // warm rim light so the hero car never reads black from behind
    const rim = new THREE.PointLight(0xffd9a0, 55, 14, 1.6);
    rim.position.set(0, 3.2, -1.5);
    group.add(rim);
  }
  return group;
}

function spawnCar(x, z, yaw, opts) {
  opts = opts || {};
  const color = opts.color != null ? opts.color : pick(cityRand, TRAFFIC_PAINTS);
  const mesh = buildCarMesh(color, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = yaw;
  G.scene.add(mesh);
  const car = {
    kind: opts.kind || 'traffic',
    mesh, color,
    yaw,
    speed: 0,
    steer: 0,
    maxSpeed: opts.maxSpeed || 30,
    isPlayer: false,
    driver: null,
    route: opts.route || null,
    stuck: 0,
    brakeLight: false,
    crashed: 0,
  };
  mesh.userData.car = car;
  G.cars.push(car);
  return car;
}

function carForward(car) {
  return { x: Math.sin(car.yaw), z: Math.cos(car.yaw) };
}

function updatePlayerDriving(dt) {
  const car = G.playerCar;
  if (!car) return;
  const k = G.keys;
  const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
  const steerInput = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
  const targetSteer = steerInput * 0.55;
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  if (fwd > 0) car.speed += 16 * dt;
  else if (fwd < 0) car.speed -= (car.speed > 0.5 ? 26 : 9) * dt;   // brake, then reverse
  else car.speed -= car.speed * 0.9 * dt;                            // coast drag
  car.speed = Math.max(-9, Math.min(car.maxSpeed, car.speed));
  if (Math.abs(car.speed) < 0.05 && fwd === 0) car.speed = 0;
  const spdFactor = Math.min(1, Math.abs(car.speed) / 12);
  car.yaw += car.steer * spdFactor * (car.speed >= 0 ? 1 : -1) * dt * 1.9;
  const f = carForward(car);
  const ox = car.mesh.position.x, oz = car.mesh.position.z;
  const nx = ox + f.x * car.speed * dt;
  const nz = oz + f.z * car.speed * dt;
  const free = clampToFree(nx, nz, 1.7, ox, oz);
  if ((free.x !== nx || free.z !== nz) && Math.abs(car.speed) > 6) {
    crashFeedback(Math.abs(car.speed));
  }
  if (free.x !== nx || free.z !== nz) car.speed *= 0.4;
  car.mesh.position.x = free.x;
  car.mesh.position.z = free.z;
  car.mesh.rotation.y = car.yaw;
  // body roll + pitch for feel
  car.mesh.rotation.z = -car.steer * spdFactor * 0.06;
  car.mesh.rotation.x = Math.max(-0.03, Math.min(0.03, -fwd * 0.02 * Math.min(1, Math.abs(car.speed) / 20)));
  spinWheels(car, dt);
  // headlight follows the car
  if (G.headlight) {
    const hp = car.mesh.position;
    G.headlight.position.set(hp.x + f.x * 2, 1.1, hp.z + f.z * 2);
    G.headlight.target.position.set(hp.x + f.x * 22, 0.4, hp.z + f.z * 22);
    G.headlight.target.updateMatrixWorld();
  }
}

function spinWheels(car, dt) {
  const wheels = car.mesh.userData.wheels || [];
  const spin = car.speed * dt / 0.36;
  for (const w of wheels) {
    w.children[0].rotation.x += spin;
    w.children[1].rotation.x += spin;
  }
  // front wheels steer visually
  if (wheels.length >= 2) {
    wheels[0].rotation.y = car.steer * 0.7;
    wheels[1].rotation.y = car.steer * 0.7;
  }
}

function crashFeedback(speed) {
  if (typeof playCrash === 'function') playCrash(Math.min(1, speed / 30));
  if (typeof damagePlayer === 'function' && G.playerCar) damagePlayer(Math.min(14, speed * 0.45));
  if (typeof showToast === 'function') showToast('CRASH!');
}

function carAheadDistance(car, maxDist) {
  const f = carForward(car);
  let best = maxDist;
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.mesh.position.x - car.mesh.position.x;
    const dz = other.mesh.position.z - car.mesh.position.z;
    const along = dx * f.x + dz * f.z;
    const side = Math.abs(dx * f.z - dz * f.x);
    if (along > 0 && along < best && side < 3.4) best = along;
  }
  return best;
}

function updateTraffic(dt) {
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    const route = car.route;
    if (!route) continue;
    // slow down for the car ahead
    const ahead = carAheadDistance(car, 14);
    const cruise = route.cruise || 11;
    const want = ahead < 12 ? Math.min(cruise, Math.max(0, (ahead - 7) * 1.4)) : cruise;
    car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
    const f = carForward(car);
    let nx = car.mesh.position.x + f.x * car.speed * dt;
    let nz = car.mesh.position.z + f.z * car.speed * dt;
    // at an intersection, sometimes turn onto the crossing avenue
    const nearX = CITY.roads.find((r) => Math.abs(nx - r) < 1.2);
    const nearZ = CITY.roads.find((r) => Math.abs(nz - r) < 1.2);
    if (route.axis === 'x' && nearX != null && Math.abs(nx - nearX) < 1.2) {
      if (cityRand() < 0.012) {
        // turn from the z-road onto the crossing x-road: new line is nearX
        route.axis = 'z'; route.line = nearX; route.dir = cityRand() < 0.5 ? 1 : -1;
        nx = nearX; nz = car.mesh.position.z;
        car.yaw = route.dir > 0 ? 0 : Math.PI;
      }
    } else if (route.axis === 'z' && nearZ != null && Math.abs(nz - nearZ) < 1.2) {
      if (cityRand() < 0.012) {
        // turn from the x-road onto the crossing z-road: new line is nearZ
        route.axis = 'x'; route.line = nearZ; route.dir = cityRand() < 0.5 ? 1 : -1;
        nz = nearZ; nx = car.mesh.position.x;
        car.yaw = route.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    // stay on the route line
    if (route.axis === 'x') nz = route.line; else nx = route.line;
    const free = clampToFree(nx, nz, 1.7, car.mesh.position.x, car.mesh.position.z);
    car.mesh.position.x = free.x;
    car.mesh.position.z = free.z;
    car.mesh.rotation.y = car.yaw;
    spinWheels(car, dt);
  }
  // gentle separation so traffic never overlaps
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i], b = G.cars[j];
      const dx = b.mesh.position.x - a.mesh.position.x;
      const dz = b.mesh.position.z - a.mesh.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 10.5 && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (3.24 - d) * 0.5;
        const px = (dx / d) * push, pz = (dz / d) * push;
        if (a.kind === 'traffic') { a.mesh.position.x -= px; a.mesh.position.z -= pz; }
        if (b.kind === 'traffic') { b.mesh.position.x += px; b.mesh.position.z += pz; }
      }
    }
  }
}

function nearestCarTo(x, z, maxDist, kinds) {
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    if (kinds && kinds.indexOf(car.kind) === -1) continue;
    const dx = car.mesh.position.x - x, dz = car.mesh.position.z - z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function spawnInitialVehicles() {
  // player car: gold Vantara GT parked on the marina boulevard
  const playerCar = spawnCar(-6, 150, Math.PI, {
    kind: 'parked', color: 0xd4af37, sport: true, maxSpeed: 36, glow: true,
  });
  playerCar.isPlayer = true;
  // parked luxury cars along the boulevard and avenues
  const parkedSpots = [
    [14, 150, 0], [24, 150, 0], [-24, 150, Math.PI], [34, 150, 0],
    [6, 66, Math.PI / 2], [-6, -66, -Math.PI / 2], [80, 6, 0], [-80, -6, Math.PI],
    [6, -140, Math.PI / 2], [140, 80, Math.PI], [-140, -80, 0], [80, -140, Math.PI / 2],
  ];
  for (const [x, z, yaw] of parkedSpots) {
    spawnCar(x, z, yaw, { kind: 'parked', sport: cityRand() < 0.4 });
  }
  // moving traffic on the avenues
  for (let i = 0; i < 9; i++) {
    const axis = cityRand() < 0.5 ? 'x' : 'z';
    const line = pick(cityRand, CITY.roads);
    const dir = cityRand() < 0.5 ? 1 : -1;
    const along = randRange(cityRand, -180, 160);
    const x = axis === 'x' ? along : line;
    const z = axis === 'x' ? line : along;
    if (Math.hypot(x - 0, z - 150) < 30) continue;
    const yaw = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = spawnCar(x, z, yaw, { kind: 'traffic' });
    car.route = { axis, line, dir, cruise: randRange(cityRand, 8, 13) };
    car.speed = car.route.cruise;
  }
  // headlight spotlight for the player's car
  const spot = new THREE.SpotLight(0xfff2c8, 320, 48, 0.44, 0.6, 1.4);
  spot.position.set(-6, 1.1, 152);
  G.scene.add(spot);
  G.scene.add(spot.target);
  G.headlight = spot;
}
