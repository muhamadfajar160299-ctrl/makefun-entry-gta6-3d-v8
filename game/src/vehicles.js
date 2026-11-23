// Marina Nights — ambient traffic. AI cars drive the street grid in lanes,
// turn at intersections, brake for the car ahead, flash indicators before
// turning, and respawn near the player when they drift away. Vans and taxis
// mix in with the sedans so the traffic doesn't look cloned.
import { STREETS } from './city.js';
import { makeCarMesh } from './player.js';
const THREE = window.THREE;

const COLORS = [0x2ec5ff, 0xffc93d, 0x37e08b, 0xe8ecf2, 0xff7a3d, 0x9b6bff, 0xffe9f2, 0x3ddc97];

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function createTraffic(scene, count) {
  const cars = [];
  const N = count || 14;

  function spawnCar(near) {
    const vertical = Math.random() < 0.5;
    const street = pick(STREETS);
    const lane = (Math.random() < 0.5 ? -1 : 1) * 3.2;
    const dir = Math.random() < 0.5 ? 1 : -1;
    let along;
    if (near) {
      along = near + rand(-70, 70);
      along = Math.max(-190, Math.min(190, along));
    } else {
      along = rand(-190, 190);
    }
    const kindRoll = Math.random();
    const kind = kindRoll < 0.18 ? 'van' : kindRoll < 0.34 ? 'taxi' : 'sedan';
    const color = kind === 'taxi' ? 0xffc93d : pick(COLORS);
    const { group, tailMat } = makeCarMesh(color);
    // Variant bodies so the street isn't a parade of identical sedans.
    if (kind === 'van') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.85, 3.6),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 }));
      box.position.set(0, 1.15, -0.2);
      box.castShadow = true;
      group.add(box);
    } else if (kind === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      sign.position.set(0, 1.62, -0.25);
      group.add(sign);
    }
    // Turn indicators: small amber lamps on both front corners, blinked
    // while the car is about to turn at an intersection.
    const indMat = new THREE.MeshStandardMaterial({
      color: 0x332200, emissive: 0xffaa00, emissiveIntensity: 0.1,
    });
    const indicators = [];
    for (const sx of [-0.95, 0.95]) {
      const ind = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.1), indMat);
      ind.position.set(sx, 0.62, 2.17);
      group.add(ind);
      indicators.push(ind);
    }
    scene.add(group);
    return {
      group, tailMat, indMat, indicators, kind,
      vertical, street, lane, dir,
      along, speed: rand(7, 13), cruise: rand(8, 13.5),
      braking: false, signaling: 0, signalSide: 0, blink: 0, pendingTurn: null,
    };
  }

  function place(car) {
    const x = car.vertical ? car.street + car.lane : car.along;
    const z = car.vertical ? car.along : car.street + car.lane;
    car.group.position.set(x, 0, z);
    // heading: forward = (sin h, cos h). Vertical street, dir +1 => +z => h=0.
    car.group.rotation.y = car.vertical
      ? (car.dir > 0 ? 0 : Math.PI)
      : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  for (let i = 0; i < N; i++) {
    const car = spawnCar(null);
    place(car);
    cars.push(car);
  }

  // Is anything stopped in front of this car, in the same lane, close ahead?
  function blockedAhead(car, playerPos) {
    const ahead = 13;
    for (const other of cars) {
      if (other === car || other.vertical !== car.vertical) continue;
      if (Math.abs(other.street + other.lane - (car.street + car.lane)) > 1) continue;
      const gap = (other.along - car.along) * car.dir;
      if (gap > 0 && gap < ahead) return true;
    }
    // the player counts as traffic too
    const px = car.vertical ? playerPos.x : playerPos.z;
    const along = car.vertical ? playerPos.z : playerPos.x;
    if (Math.abs(px - (car.street + car.lane)) < 2.2) {
      const gap = (along - car.along) * car.dir;
      if (gap > 0 && gap < ahead) return true;
    }
    return false;
  }

  function update(dt, playerPos) {
    for (const car of cars) {
      // Brake for the car ahead; ease back up to cruise speed after.
      const blocked = blockedAhead(car, playerPos);
      const target = blocked ? 0 : car.cruise;
      const rate = blocked ? 3.2 : 1.1;
      car.speed += (target - car.speed) * Math.min(1, dt * rate);
      car.braking = blocked || car.speed < car.cruise - 1.5;
      car.tailMat.emissiveIntensity = car.braking ? 2.2 : 1.1;
      car.along += car.dir * car.speed * dt;
      // Decide on a turn at the next intersection while still approaching
      // it, signal the whole way in, and execute the turn ON the crossing.
      if (car.signaling <= 0 && car.pendingTurn === null) {
        for (const s of STREETS) {
          const ahead = (s - car.along) * car.dir;
          if (ahead > 4 && ahead < 16 && Math.random() < 0.5) {
            car.pendingTurn = s;
            car.signaling = 1;
            car.signalSide = Math.random() < 0.5 ? -1 : 1;
            car.blink = 0;
            break;
          }
        }
      }
      if (car.signaling > 0) {
        car.blink += dt * 7;
        car.indMat.emissiveIntensity = Math.sin(car.blink) > 0 ? 2.4 : 0.1;
        if (car.pendingTurn !== null && Math.abs(car.along - car.pendingTurn) < 1.6) {
          const s = car.pendingTurn;
          car.pendingTurn = null;
          car.signaling = 0;
          car.indMat.emissiveIntensity = 0.1;
          const prevStreet = car.street;
          const prevLane = car.lane;
          car.vertical = !car.vertical;
          car.street = s;
          car.along = prevStreet + prevLane; // position on the new axis
          car.lane = (Math.random() < 0.5 ? -1 : 1) * 3.2;
          car.dir = Math.random() < 0.5 ? 1 : -1;
        }
      }
      if (car.along > 196) { car.along = 196; car.dir = -1; }
      if (car.along < -196) { car.along = -196; car.dir = 1; }
      // respawn near the player when too far away
      const dx = car.group.position.x - playerPos.x;
      const dz = car.group.position.z - playerPos.z;
      if (dx * dx + dz * dz > 260 * 260) {
        const axisCoord = car.vertical ? playerPos.z : playerPos.x;
        const c2 = spawnCar(axisCoord);
        car.vertical = c2.vertical; car.street = c2.street; car.lane = c2.lane;
        car.dir = c2.dir; car.along = c2.along; car.speed = c2.speed; car.cruise = c2.cruise;
        scene.remove(car.group);
        car.group = c2.group; car.tailMat = c2.tailMat; car.indMat = c2.indMat;
        car.signaling = 0; car.braking = false; car.pendingTurn = null;
      }
      place(car);
    }
  }

  return { cars, update };
}
