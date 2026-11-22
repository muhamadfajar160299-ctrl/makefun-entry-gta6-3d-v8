// police.js — wanted stars and the Velmara PD: interceptors that chase,
// ram, and bust you when they corner you. Sirens flash red and blue.

function addCrime(stars, label) {
  if (G.wanted >= 5) return;
  G.wanted = Math.min(5, G.wanted + stars);
  G.lastCrimeAt = G.elapsed;
  G.wantedGrace = 0;
  if (label && typeof showToast === 'function') showToast(label + '  ★'.repeat(G.wanted));
  if (typeof updateWantedHud === 'function') updateWantedHud();
}

function wantedPoliceCount() {
  if (G.wanted <= 0) return 0;
  return Math.min(4, 1 + G.wanted);   // 2 cars at 1 star, up to 4 at 3+
}

function spawnPoliceCar() {
  const p = G.player ? G.player.mesh.position : { x: 0, z: 150 };
  const pc = G.playerCar ? G.playerCar.mesh.position : p;
  // spawn on a road 55-80 units away, roughly behind the player's motion
  const angle = Math.random() * Math.PI * 2;
  const sx = pc.x + Math.sin(angle) * 68;
  const sz = pc.z + Math.cos(angle) * 68;
  const roadX = CITY.roads.reduce((a, b) => Math.abs(b - sx) < Math.abs(a - sx) ? b : a, CITY.roads[0]);
  const roadZ = CITY.roads.reduce((a, b) => Math.abs(b - sz) < Math.abs(a - sz) ? b : a, CITY.roads[0]);
  const onXRoad = Math.abs(roadX - sx) < Math.abs(roadZ - sz);
  const x = onXRoad ? roadX : sx;
  const z = onXRoad ? sz : roadZ;
  const yaw = Math.atan2(pc.x - x, pc.z - z);
  const car = spawnCar(x, z, yaw, {
    kind: 'police', color: 0x0d0d10, police: true, maxSpeed: 34 + G.wanted * 1.5,
  });
  car.route = null;
  G.policeCars.push(car);
  return car;
}

function updatePolice(dt) {
  // keep the right number of interceptors on the street
  // (staged shots place their own police; do not auto-spawn there)
  const want = G.shot ? G.policeCars.length : wantedPoliceCount();
  while (G.policeCars.length < want) spawnPoliceCar();
  while (G.policeCars.length > want) {
    const car = G.policeCars.pop();
    G.scene.remove(car.mesh);
    const idx = G.cars.indexOf(car);
    if (idx >= 0) G.cars.splice(idx, 1);
  }
  if (G.wanted <= 0) {
    if (G.sirenLight) G.sirenLight.intensity = 0;
    G.bustTimer = 0;
    return;
  }
  const target = G.playerCar ? G.playerCar.mesh.position : (G.player ? G.player.mesh.position : null);
  if (!target) return;
  const playerSpeed = G.playerCar ? Math.abs(G.playerCar.speed) : (G.player ? G.player.speed : 0);
  let nearest = null, nearestD = 1e9;
  for (const car of G.policeCars) {
    const dx = target.x - car.mesh.position.x;
    const dz = target.z - car.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d < nearestD) { nearestD = d; nearest = car; }
    // steer toward the player, faster than the player at high wanted levels
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.yaw += Math.max(-1.9 * dt, Math.min(1.9 * dt, dy));
    const cruise = Math.min(car.maxSpeed, 15 + G.wanted * 2.4 + (d > 60 ? 8 : 0));
    car.speed += (cruise - car.speed) * Math.min(1, dt * 1.2);
    const f = carForward(car);
    const ox = car.mesh.position.x, oz = car.mesh.position.z;
    const nx = ox + f.x * car.speed * dt;
    const nz = oz + f.z * car.speed * dt;
    const free = clampToFree(nx, nz, 1.7, ox, oz);
    car.mesh.position.x = free.x;
    car.mesh.position.z = free.z;
    car.mesh.rotation.y = car.yaw;
    spinWheels(car, dt);
    // ramming: shove the player's car and hurt the player
    if (d < 4.4) {
      if (G.playerCar) {
        const push = 5 * dt;
        G.playerCar.mesh.position.x += (dx / Math.max(d, 0.5)) * push;
        G.playerCar.mesh.position.z += (dz / Math.max(d, 0.5)) * push;
        G.playerCar.speed *= (1 - dt * 0.8);
        if (typeof damagePlayer === 'function') damagePlayer(24 * dt);
        if (typeof playCrash === 'function' && d < 3.2 && G.elapsed - (G.lastCrashAt || 0) > 0.8) {
          G.lastCrashAt = G.elapsed;
          playCrash(0.35);
        }
      } else if (typeof damagePlayer === 'function') {
        damagePlayer(9 * dt);
      }
    }
  }
  // bust: cornered and slow next to a cruiser
  if (nearest && nearestD < 5.5 && playerSpeed < 2.2) {
    G.bustTimer += dt;
    if (G.bustTimer > 2.6) {
      bustPlayer();
      return;
    }
  } else {
    G.bustTimer = Math.max(0, G.bustTimer - dt * 2);
  }
  // wanted decays once every cruiser is far away
  if (nearestD > 55) {
    G.wantedGrace += dt;
    if (G.wantedGrace > 12) {
      G.wanted = Math.max(0, G.wanted - 1);
      G.wantedGrace = 0;
      if (typeof updateWantedHud === 'function') updateWantedHud();
      if (G.wanted === 0 && typeof showToast === 'function') showToast('You lost them. Clean.');
    }
  } else {
    G.wantedGrace = 0;
  }
  // siren light bar flashes on the nearest cruiser
  if (G.sirenLight && nearest) {
    const phase = Math.floor(G.elapsed * 6) % 2 === 0;
    G.sirenLight.color.setHex(phase ? 0xff2233 : 0x2255ff);
    G.sirenLight.intensity = 260;
    G.sirenLight.position.set(
      nearest.mesh.position.x, 3.4, nearest.mesh.position.z);
    const bar = nearest.mesh.userData.lightBar;
    if (bar) {
      bar.red.color.setHex(phase ? 0xff2233 : 0x551122);
      bar.blue.color.setHex(phase ? 0x112255 : 0x2255ff);
    }
  }
}

function bustPlayer() {
  if (G.mode !== 'playing' || G.shot) return;   // staged shots never end busted
  G.wanted = 0;
  G.bustTimer = 0;
  if (G.playerCar) {
    G.playerCar.kind = 'parked';
    G.playerCar.isPlayer = false;
    G.playerCar.speed = 0;
    G.playerCar = null;
    if (G.player) G.player.mesh.visible = true;
  }
  // bail: lose 15% of cash, respawn at the marina precinct steps
  G.money = Math.max(0, Math.floor(G.money * 0.85));
  if (G.player) {
    G.player.mesh.position.set(12, 0, 150);
    G.player.yaw = Math.PI;
  }
  for (const car of G.policeCars.splice(0)) {
    G.scene.remove(car.mesh);
    const idx = G.cars.indexOf(car);
    if (idx >= 0) G.cars.splice(idx, 1);
  }
  if (typeof updateWantedHud === 'function') updateWantedHud();
  if (typeof showScreen === 'function') showScreen('busted');
  else G.mode = 'busted';
}
