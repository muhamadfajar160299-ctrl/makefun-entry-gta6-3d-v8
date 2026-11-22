// pedestrians.js — people on the sidewalks: they stroll, chat, and run
// when a car screams past or a crime happens in front of them.

const PED_JACKETS = [0xc0392b, 0x2e86c1, 0x27ae60, 0xd4af37, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1abc9c];
const PED_SKINS = [0xe8b88a, 0xc98d64, 0x8a5a3b, 0xf0c8a0];

function buildPedMesh(jacket, skin) {
  const g = new THREE.Group();
  const jacketMat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x232838, roughness: 0.85 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), jacketMat);
  torso.position.y = 1.05; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skinMat);
  head.position.y = 1.56; head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.9 }));
  hair.position.y = 1.6;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), pantsMat);
  legL.position.set(-0.14, 0.36, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), jacketMat);
  armL.position.set(-0.34, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.34; g.add(armR);
  g.userData.legL = legL; g.userData.legR = legR;
  g.userData.armL = armL; g.userData.armR = armR;
  return g;
}

function spawnPed(x, z, yaw) {
  const mesh = buildPedMesh(pick(cityRand, PED_JACKETS), pick(cityRand, PED_SKINS));
  mesh.position.set(x, 0, z);
  mesh.rotation.y = yaw;
  G.scene.add(mesh);
  const ped = {
    mesh,
    yaw,
    speed: randRange(cityRand, 1.1, 1.9),
    walkPhase: cityRand() * 6,
    state: 'walk',        // walk | flee | down
    stateTimer: 0,
    axis: cityRand() < 0.5 ? 'x' : 'z',
    dir: cityRand() < 0.5 ? 1 : -1,
    line: 0,
  };
  // snap onto a sidewalk line near the spawn
  if (ped.axis === 'x') ped.line = z; else ped.line = x;
  G.peds.push(ped);
  return ped;
}

function spawnInitialPeds() {
  // promenade crowd — the marina is alive at night
  for (let i = 0; i < 26; i++) {
    spawnPed(randRange(cityRand, -180, 180), randRange(cityRand, 170, 186), cityRand() * Math.PI * 2);
  }
  // a dense knot of strollers around the marina walk, where shot 2 is taken
  for (let i = 0; i < 12; i++) {
    spawnPed(randRange(cityRand, -8, 32), randRange(cityRand, 170, 188), cityRand() * Math.PI * 2);
  }
  for (let i = 0; i < 14; i++) {
    const road = pick(cityRand, CITY.roads);
    const along = randRange(cityRand, -180, 160);
    const side = cityRand() < 0.5 ? 9.4 : -9.4;
    if (cityRand() < 0.5) spawnPed(along, road + side, cityRand() * Math.PI * 2);
    else spawnPed(road + side, along, cityRand() * Math.PI * 2);
  }
}

function pedForward(ped) {
  return { x: Math.sin(ped.yaw), z: Math.cos(ped.yaw) };
}

function updatePeds(dt) {
  const px = G.player ? G.player.mesh.position.x : 0;
  const pz = G.player ? G.player.mesh.position.z : 0;
  const playerSpeed = G.playerCar ? Math.abs(G.playerCar.speed) : (G.player ? G.player.speed : 0);
  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ped.stateTimer -= dt;
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
      }
      continue;
    }
    // flee if the player (or a fast car) is close
    const dx = ped.mesh.position.x - px, dz = ped.mesh.position.z - pz;
    const dPlayer = Math.hypot(dx, dz);
    if (ped.state !== 'flee' && dPlayer < 7 && playerSpeed > 3) {
      ped.state = 'flee';
      ped.stateTimer = 2.5;
      ped.yaw = Math.atan2(dx, dz);
    }
    if (ped.state === 'flee') {
      ped.stateTimer -= dt;
      if (ped.stateTimer <= 0) ped.state = 'walk';
    }
    const speed = ped.state === 'flee' ? 5.2 : ped.speed;
    const f = pedForward(ped);
    let nx = ped.mesh.position.x + f.x * speed * dt;
    let nz = ped.mesh.position.z + f.z * speed * dt;
    // turn around at the city edge or when blocked; wander at intersections
    if (isBlocked(nx, nz, 0.5) || Math.abs(nx) > 200 || nz < -200 || nz > 190) {
      ped.yaw += Math.PI;
      ped.dir *= -1;
      nx = ped.mesh.position.x; nz = ped.mesh.position.z;
    } else if (cityRand() < dt * 0.05) {
      ped.yaw += (cityRand() - 0.5) * 1.2;
    }
    ped.mesh.position.x = nx;
    ped.mesh.position.z = nz;
    ped.mesh.rotation.y = ped.yaw;
    // walk cycle
    ped.walkPhase += dt * speed * 3.2;
    const swing = Math.sin(ped.walkPhase) * 0.45;
    const u = ped.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
  }
}

// Knock a pedestrian down (crime). Returns true if a ped was hit.
function hitPedAt(x, z, radius) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.mesh.position.x - x, ped.mesh.position.z - z);
    if (d < radius) {
      ped.state = 'down';
      ped.stateTimer = 5;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.25;
      return true;
    }
  }
  return false;
}

// Player car running over pedestrians while driving.
function checkCarPedHits() {
  if (!G.playerCar) return;
  const car = G.playerCar;
  if (Math.abs(car.speed) < 4) return;
  const cx = car.mesh.position.x, cz = car.mesh.position.z;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.mesh.position.x - cx, ped.mesh.position.z - cz);
    if (d < 2.1) {
      ped.state = 'down';
      ped.stateTimer = 6;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.25;
      if (typeof addCrime === 'function') addCrime(1, 'Pedestrian hit!');
      if (typeof playCrash === 'function') playCrash(0.5);
    }
  }
}
