// Marina Nights — police pursuit. One patrol car per wanted star. They chase
// the player, try to ram/block, flash red-blue light bars, and bust the
// player after sustained contact. Evade them long enough and wanted drops.
import { STREETS } from './city.js';
import { makeCarMesh } from './player.js';
const THREE = window.THREE;

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function createPolice(scene) {
  const cars = [];
  let bustTimer = 0;
  let evadeTimer = 0;

  function makePoliceCar() {
    const { group } = makeCarMesh(0x101418);
    // white doors / roof stripe
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.3, 2.4),
      new THREE.MeshLambertMaterial({ color: 0xf2f6fa }));
    door.position.y = 0.62;
    group.add(door);
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
    return { group, redMat, blueMat, heading: 0, speed: 0,
      pos: new THREE.Vector3(0, 0, 0), flash: Math.random() * 10 };
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
  }

  function update(dt, playerPos, playerSpeed, wanted, G) {
    if (cars.length === 0) { bustTimer = 0; evadeTimer = 0; return; }
    let nearest = Infinity;
    for (const car of cars) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      // steer toward the player
      const desired = Math.atan2(dx, dz);
      let diff = desired - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      car.heading += turn;
      const targetSpeed = Math.min(40, 28 + wanted * 2.5);
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.6);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.pos.x = Math.max(-197, Math.min(198, car.pos.x));
      car.pos.z = Math.max(-197, Math.min(197, car.pos.z));
      car.group.position.copy(car.pos);
      car.group.rotation.y = car.heading;
      // flashing light bar
      car.flash += dt * 9;
      const on = Math.sin(car.flash) > 0;
      car.redMat.color.setHex(on ? 0xff2244 : 0x551111);
      car.blueMat.color.setHex(on ? 0x113366 : 0x2266ff);
      // contact => bust clock
      if (dist < 3.2) bustTimer += dt;
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
  };
}
