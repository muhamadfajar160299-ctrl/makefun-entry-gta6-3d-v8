// Marina Nights — ambient traffic. AI cars drive the street grid in lanes,
// turn at intersections, and respawn near the player when they drift away.
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
    const { group } = makeCarMesh(pick(COLORS));
    scene.add(group);
    return {
      group, vertical, street, lane, dir,
      along, speed: rand(8, 12.5),
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

  function update(dt, playerPos) {
    for (const car of cars) {
      car.along += car.dir * car.speed * dt;
      // maybe turn at an intersection
      for (const s of STREETS) {
        if (Math.abs(car.along - s) < 1.6 && Math.random() < 0.35) {
          const prevStreet = car.street;
          const prevLane = car.lane;
          car.vertical = !car.vertical;
          car.street = s;
          car.along = prevStreet + prevLane; // position on the new axis
          car.lane = (Math.random() < 0.5 ? -1 : 1) * 3.2;
          car.dir = Math.random() < 0.5 ? 1 : -1;
          break;
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
        car.dir = c2.dir; car.along = c2.along; car.speed = c2.speed;
        scene.remove(car.group);
        car.group = c2.group;
      }
      place(car);
    }
  }

  return { cars, update };
}
