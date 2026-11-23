// police.js — Velmara PD: three roles, one siren.
//
// INTERCEPT drives to where the player WILL be (position + velocity lead).
// PURSUE slides alongside to box the player in. BLOCK races to a point
// ahead of the player and parks across the road. The light bar strobes
// red/blue and a real point light on each car throws the colour onto the
// asphalt, so a chase reads from across the block.
const THREE = window.THREE;
import { buildCarMesh } from './vehicles.js';

const ROLES = ['INTERCEPT', 'PURSUE', 'BLOCK', 'PURSUE'];

function spawnPoint(i, player) {
  const a = (i / 4) * Math.PI * 2 + 0.6;
  return { x: player.x + Math.sin(a) * 26, z: player.z + Math.cos(a) * 26 };
}

export function createPolice(scene, count = 4) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildCarMesh('police', 0xe8ecf2);
    scene.add(mesh.group);
    const strobe = new THREE.PointLight(0xff2222, 0, 20, 1.0);
    strobe.position.set(0, 2.4, 0);
    mesh.group.add(strobe);
    cars.push({
      mesh, strobe, role: ROLES[i % ROLES.length],
      x: 40 + i * 8, z: -60 - i * 6, heading: 0,
      speed: 0, active: false, phase: i * 1.7, sirenPhase: i * 0.5,
    });
    mesh.group.position.set(cars[i].x, 0, cars[i].z);
    mesh.group.visible = false;
  }
  return cars;
}

export function setWanted(police, wanted, player) {
  police.forEach((c, i) => {
    const on = i < wanted;
    if (on && !c.active) {
      const s = spawnPoint(i, player);
      c.x = s.x;
      c.z = s.z;
      c.speed = 6;
      c.heading = Math.atan2(player.x - s.x, -(player.z - s.z));
    }
    c.active = on;
    c.mesh.group.visible = on;
  });
}

export function activePoliceCount(police) {
  return police.filter((c) => c.active).length;
}

function steerToward(c, tx, tz, dt, maxTurn = 2.4) {
  const want = Math.atan2(tx - c.x, -(tz - c.z));
  let diff = want - c.heading;
  diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  const turn = Math.max(-maxTurn * dt, Math.min(maxTurn * dt, diff));
  c.heading += turn;
}

export function updatePolice(police, player, dt, t) {
  for (const c of police) {
    if (!c.active) continue;
    const pvx = Math.sin(player.heading) * player.speed;
    const pvz = -Math.cos(player.heading) * player.speed;
    let tx;
    let tz;
    let targetSpeed = Math.min(34, Math.abs(player.speed) + 3.5);
    if (c.role === 'INTERCEPT') {
      // Lead the player by 1.4 seconds of travel.
      tx = player.x + pvx * 1.4;
      tz = player.z + pvz * 1.4;
    } else if (c.role === 'BLOCK') {
      // Get ahead on the player's line and stop across it.
      tx = player.x + pvx * 2.4;
      tz = player.z + pvz * 2.4;
      const d = Math.hypot(tx - c.x, tz - c.z);
      targetSpeed = d < 12 ? 0 : targetSpeed;
      if (d < 12) c.heading += (Math.atan2(tx - c.x, -(tz - c.z)) - c.heading) * 0.05;
    } else {
      // PURSUE: flank offset, alternating side by index.
      const side = c.phase % 2 === 0 ? 1 : -1;
      tx = player.x + Math.cos(player.heading) * 5 * side + pvx * 0.5;
      tz = player.z + Math.sin(player.heading) * 5 * side + pvz * 0.5;
    }
    steerToward(c, tx, tz, dt);
    c.speed += Math.max(-16 * dt, Math.min(9 * dt, targetSpeed - c.speed));
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += -Math.cos(c.heading) * c.speed * dt;
    c.mesh.group.position.set(c.x, 0, c.z);
    c.mesh.group.rotation.y = Math.PI / 2 - c.heading;
    const spin = c.speed * dt * 2.8;
    for (const w of c.mesh.wheels) w.rotation.z += spin;
    // Strobe: red and blue alternate twice a second, light bar + point light.
    const on = Math.sin(t * 12 + c.sirenPhase * 6) > 0;
    if (c.mesh.lightBar) {
      c.mesh.lightBar.red.color.setHex(on ? 0xff2222 : 0x550000);
      c.mesh.lightBar.blue.color.setHex(on ? 0x111155 : 0x2244ff);
    }
    c.strobe.color.setHex(on ? 0xff2222 : 0x2244ff);
    c.strobe.intensity = 26;
    // Brake lights when closing in.
    c.mesh.brakeMat.color.setHex(c.speed < targetSpeed - 2 ? 0xff2a2a : 0x881111);
  }
}

// Nearest active police distance, for the siren volume.
export function nearestPoliceDistance(police, player) {
  let best = Infinity;
  for (const c of police) {
    if (!c.active) continue;
    best = Math.min(best, Math.hypot(c.x - player.x, c.z - player.z));
  }
  return best;
}
