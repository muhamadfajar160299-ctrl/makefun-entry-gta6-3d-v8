// player.js — Rae on foot: third-person movement, camera orbit, and
// getting in and out of cars (stealing one if it has a driver).

function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x8a1f2d, roughness: 0.75 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1c2233, roughness: 0.85 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.32), jacket);
  torso.position.y = 1.08; torso.castShadow = true;
  g.add(torso);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.34), gold);
  stripe.position.y = 1.28;
  g.add(stripe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), skin);
  head.position.y = 1.62; head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.9 }));
  hair.position.y = 1.66;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.66, 0.24), pants);
  legL.position.set(-0.15, 0.38, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.18), jacket);
  armL.position.set(-0.37, 1.08, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.37; g.add(armR);
  g.userData.legL = legL; g.userData.legR = legR;
  g.userData.armL = armL; g.userData.armR = armR;
  return g;
}

function createPlayer() {
  const mesh = buildPlayerMesh();
  mesh.position.set(0, 0, 150);
  G.scene.add(mesh);
  const player = {
    mesh,
    yaw: Math.PI,           // facing the marina (south)
    speed: 0,
    walkPhase: 0,
    moving: false,
    punchTimer: 0,
    punchAnim: 0,
  };
  G.player = player;
  return player;
}

function updatePlayerOnFoot(dt) {
  const p = G.player;
  if (!p) return;
  const k = G.keys;
  const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
  const strafe = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
  const sprint = k['ShiftLeft'] || k['ShiftRight'];
  const maxSpeed = sprint ? 7.5 : 4.2;
  // movement is relative to the camera orbit yaw
  const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
  let mx = 0, mz = 0;
  if (fwd !== 0 || strafe !== 0) {
    mx = -sin * fwd + cos * strafe;
    mz = -cos * fwd - sin * strafe;
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    p.yaw = Math.atan2(mx, mz);
  }
  p.speed += ((fwd !== 0 || strafe !== 0 ? maxSpeed : 0) - p.speed) * Math.min(1, dt * 10);
  p.moving = p.speed > 0.4;
  const ox = p.mesh.position.x, oz = p.mesh.position.z;
  const nx = ox + mx * p.speed * dt;
  const nz = oz + mz * p.speed * dt;
  const free = clampToFree(nx, nz, 0.6, ox, oz);
  p.mesh.position.x = free.x;
  p.mesh.position.z = free.z;
  p.mesh.rotation.y = p.yaw;
  // walk cycle
  p.walkPhase += dt * p.speed * 2.4;
  const swing = p.moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  const u = p.mesh.userData;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.75;
  u.armR.rotation.x = swing * 0.75;
  // punch animation: right arm swings forward
  if (p.punchAnim > 0) {
    p.punchAnim -= dt;
    u.armR.rotation.x = -1.9 * Math.sin(Math.max(0, p.punchAnim) / 0.28 * Math.PI);
  }
  if (p.punchTimer > 0) p.punchTimer -= dt;
}

// Try to get into the nearest car (E). Stealing a driven car throws its driver out.
function tryEnterCar() {
  const p = G.player;
  if (!p || G.playerCar) return false;
  const car = nearestCarTo(p.mesh.position.x, p.mesh.position.z, 4.2);
  if (!car) { showToast('No car nearby'); return false; }
  if (car.kind === 'traffic' && car.driver !== 'player') {
    // carjack: the driver bails out onto the sidewalk
    const f = carForward(car);
    const ped = spawnPed(car.mesh.position.x - f.x * 2.5, car.mesh.position.z - f.z * 2.5, car.yaw);
    ped.state = 'flee'; ped.stateTimer = 3;
    car.driver = 'player';
    addCrime(1, 'Car stolen!');
    showToast('CARJACKED!');
  } else if (car.kind === 'parked') {
    addCrime(1, 'Car stolen!');
    showToast('Car stolen!');
  }
  car.kind = 'player';
  car.isPlayer = true;
  car.speed = 0;
  G.playerCar = car;
  p.mesh.visible = false;
  if (typeof playChime === 'function') playChime();
  return true;
}

function exitCar() {
  const p = G.player;
  const car = G.playerCar;
  if (!p || !car) return false;
  const f = carForward(car);
  const sideX = car.mesh.position.x - f.z * 2.2;
  const sideZ = car.mesh.position.z + f.x * 2.2;
  const free = clampToFree(sideX, sideZ, 0.6, sideX, sideZ);
  p.mesh.position.set(free.x, 0, free.z);
  p.mesh.visible = true;
  p.yaw = car.yaw;
  car.kind = 'parked';
  car.isPlayer = false;
  car.speed = 0;
  G.playerCar = null;
  return true;
}

function updateCamera(dt) {
  const cam = G.camera;
  if (!cam) return;
  let target, desired;
  if (G.playerCar) {
    const car = G.playerCar;
    target = new THREE.Vector3(car.mesh.position.x, car.mesh.position.y + 1.6, car.mesh.position.z);
    // chase cam: ease the orbit yaw toward behind the car (car yaw + PI),
    // using the same offset convention as the on-foot camera
    let dy = (car.yaw + Math.PI) - G.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    G.camYaw += dy * Math.min(1, dt * 1.6);
    const dist = 11;
    desired = new THREE.Vector3(
      target.x + Math.sin(G.camYaw) * dist,
      target.y + 3.0,
      target.z + Math.cos(G.camYaw) * dist
    );
  } else if (G.player) {
    const p = G.player.mesh.position;
    target = new THREE.Vector3(p.x, p.y + 1.7, p.z);
    const dist = G.camDist;
    desired = new THREE.Vector3(
      p.x + Math.sin(G.camYaw) * Math.cos(G.camPitch) * dist,
      p.y + 1.7 + Math.sin(G.camPitch) * dist,
      p.z + Math.cos(G.camYaw) * Math.cos(G.camPitch) * dist
    );
  } else {
    return;
  }
  // keep the camera out of buildings: lift it if blocked
  if (isBlocked(desired.x, desired.z, 0.5) && desired.y < 26) desired.y = 26;
  if (G.shotCamera) {
    cam.position.copy(G.shotCamera.pos);
    cam.lookAt(G.shotCamera.look);
    return;
  }
  cam.position.lerp(desired, Math.min(1, dt * 7));
  cam.lookAt(target);
}
