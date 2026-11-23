// Marina Nights — police pursuit. One patrol car per wanted star. The fleet
// works as a team instead of a swarm: car #0 INTERCEPTS (aims at where the
// player will be, from the player's velocity), the others PURSUE from the
// flanks, and any car that gets ahead tries to BLOCK by slowing across the
// player's path. They pace the player up close instead of ramming forever,
// flash red-blue light bars with a real alternating strobe light, and bust
// the player after sustained contact. Evade them long enough and wanted drops.
import { STREETS } from './city.js';
import { makeCarMesh } from './player.js';
const THREE = window.THREE;

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function createPolice(scene) {
  const cars = [];
  let bustTimer = 0;
  let evadeTimer = 0;
  // One shared strobe: a single PointLight that hops between the lead car
  // and alternates red/blue, so the chase paints the street without paying
  // for a light per car.
  const strobe = new THREE.PointLight(0xff2244, 0, 26, 1.6);
  scene.add(strobe);
  let strobePhase = 0;

  function makePoliceCar() {
    const { group, tailMat } = makeCarMesh(0x101418);
    // white doors / roof stripe
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.3, 2.4),
      new THREE.MeshLambertMaterial({ color: 0xf2f6fa }));
    door.position.y = 0.62;
    group.add(door);
    // "VELMARA PD" door decal: a thin pale band with a dark stripe reads as
    // livery at chase distance.
    const decal = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.1, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x1c2733 }));
    decal.position.y = 0.78;
    group.add(decal);
    // flashing light bar
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    barBase.position.set(0, 1.36, -0.2);
    group.add(barBase);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x2266ff });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42), redMat);
    red.position.set(-0.28, 1.46, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42), blueMat);
    blue.position.set(0.28, 1.46, -0.2);
    group.add(blue);
    scene.add(group);
    return { group, tailMat, redMat, blueMat, heading: 0, speed: 0,
      pos: new THREE.Vector3(0, 0, 0), flash: Math.random() * 10,
      role: 'pursue', blockTimer: 0 };
  }

  function spawnNear(playerPos) {
    const car = makePoliceCar();
    // spawn on the road NEAREST the player, 30-45 m away on it
    const vertical = Math.random() < 0.5;
    const across = vertical ? playerPos.x : playerPos.z;
    let street = STREETS[0];
    for (const s of STREETS) if (Math.abs(s - across) < Math.abs(street - across)) street = s;
    const along = (vertical ? playerPos.z : playerPos.x)
      + (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 15);
    car.pos.set(
      vertical ? street + 3.2 : Math.max(-190, Math.min(190, along)),
      0,
      vertical ? Math.max(-190, Math.min(190, along)) : street + 3.2
    );
    car.group.position.copy(car.pos);
    cars.push(car);
    return car;
  }

  // Keep the live fleet exactly equal to the wanted level.
  function setCount(n, playerPos) {
    while (cars.length < n) spawnNear(playerPos);
    while (cars.length > n) {
      const c = cars.pop();
      scene.remove(c.group);
    }
    // assign roles: first car intercepts, the rest pursue from the flanks
    cars.forEach((c, i) => { c.role = i === 0 ? 'intercept' : 'pursue'; });
    if (cars.length === 0) strobe.intensity = 0;
  }

  function update(dt, playerPos, playerSpeed, wanted, G) {
    if (cars.length === 0) { bustTimer = 0; evadeTimer = 0; return; }
    let nearest = Infinity;
    // predicted player position ~1.1 s ahead, from current velocity
    const pf = G.player.forward();
    const px = playerPos.x + pf.x * playerSpeed * 1.1;
    const pz = playerPos.z + pf.z * playerSpeed * 1.1;
    for (const car of cars) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      // --- pick an aim point by role ---
      let aimX = playerPos.x, aimZ = playerPos.z;
      if (car.role === 'intercept') {
        aimX = px; aimZ = pz; // cut the player off at the predicted point
      } else {
        // flank: aim at a point offset to one side so cars don't stack up
        const side = (cars.indexOf(car) % 2 === 0 ? 1 : -1) * 6;
        aimX = playerPos.x + Math.cos(G.player.heading) * side;
        aimZ = playerPos.z - Math.sin(G.player.heading) * side;
      }
      // --- BLOCK: if this car is ahead of the player and close, slow down
      // across the player's path instead of chasing from behind ---
      const aheadDot = (car.pos.x - playerPos.x) * pf.x + (car.pos.z - playerPos.z) * pf.z;
      let blocking = false;
      if (car.role !== 'intercept' && aheadDot > 4 && aheadDot < 22 && dist < 26) {
        blocking = true;
        car.blockTimer += dt;
        aimX = playerPos.x + pf.x * 10;
        aimZ = playerPos.z + pf.z * 10;
      } else {
        car.blockTimer = 0;
      }
      // steer toward the aim point; heavy cars can't turn on a dime at speed
      const adx = aimX - car.pos.x;
      const adz = aimZ - car.pos.z;
      const desired = Math.atan2(adx, adz);
      let diff = desired - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = 2.6 * (1 - Math.min(0.5, car.speed / 80));
      const turn = Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
      car.heading += turn;
      // --- speed by situation: flat out when far, pace the player up close
      // so the chase stays a chase instead of a permanent pile-up ---
      let targetSpeed;
      if (blocking) {
        targetSpeed = Math.max(0, playerSpeed * 0.55);
      } else if (dist > 45) {
        targetSpeed = Math.min(40, 30 + wanted * 2.5);
      } else if (dist > 12) {
        targetSpeed = Math.min(40, Math.abs(playerSpeed) + 6);
      } else {
        targetSpeed = Math.max(0, Math.abs(playerSpeed) * 0.92);
      }
      const accelRate = blocking ? 4 : 1.6;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * accelRate);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.pos.x = Math.max(-197, Math.min(198, car.pos.x));
      car.pos.z = Math.max(-197, Math.min(197, car.pos.z));
      car.group.position.copy(car.pos);
      car.group.rotation.y = car.heading;
      // brake lights when slowing hard
      car.tailMat.emissiveIntensity = blocking ? 2.4 : 1.1;
      // flashing light bar
      car.flash += dt * 9;
      const on = Math.sin(car.flash) > 0;
      car.redMat.color.setHex(on ? 0xff2244 : 0x551111);
      car.blueMat.color.setHex(on ? 0x113366 : 0x2266ff);
      // contact => bust clock
      if (dist < 3.2) bustTimer += dt;
    }
    // shared strobe rides on the lead car, alternating red/blue
    if (cars.length > 0) {
      strobePhase += dt * 9;
      const redOn = Math.sin(strobePhase) > 0;
      const lead = cars[0];
      strobe.position.set(lead.pos.x, 2.2, lead.pos.z);
      strobe.color.setHex(redOn ? 0xff2244 : 0x2266ff);
      strobe.intensity = 34;
    }
    if (nearest < 3.2) {
      evadeTimer = 0;
    } else {
      bustTimer = Math.max(0, bustTimer - dt * 1.5);
      evadeTimer += dt;
      if (evadeTimer > 9 && wanted > 0) {
        evadeTimer = 0;
        G.setWanted(wanted - 1);
      }
    }
    if (bustTimer > 2.5) {
      bustTimer = 0;
      G.busted();
    }
  }

  return {
    cars, setCount, update,
    get count() { return cars.length; },
    // distance to the nearest patrol car (for siren volume)
    nearestDist(playerPos) {
      let best = Infinity;
      for (const car of cars) {
        const d = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
        if (d < best) best = d;
      }
      return best;
    },
  };
}
