// player.js — the hero car: Velmara's crimson coupe.
//
// Driving model: a 5-gear torque curve (strong low-end pull, tall 5th),
// steering that weights up with speed, body roll in corners, dive under
// braking and squat under acceleration. Damage from crashes degrades the
// top speed and adds a wobble. Two real spotlights + wide additive cones
// throw the headlight beam far down the road.
const THREE = window.THREE;
import { buildCarMesh } from './vehicles.js';

const GEARS = [
  { ratio: 3.4, top: 9 },    // 1st
  { ratio: 2.2, top: 17 },   // 2nd
  { ratio: 1.55, top: 27 },  // 3rd
  { ratio: 1.15, top: 34 },  // 4th — tops out at 122 km/h, so 130 km/h is 5th
  { ratio: 0.85, top: 62 },  // 5th
];
const REVERSE_TOP = 9;

export function createPlayer(scene) {
  const mesh = buildCarMesh('hero', 0xe53238);
  scene.add(mesh.group);

  // Two real headlight spotlights — bright, wide, long throw.
  const spots = [];
  for (const s of [-0.62, 0.62]) {
    const spot = new THREE.SpotLight(0xffeec2, 55, 55, 0.62, 0.55, 1.0);
    spot.position.set(2.3, 0.72, s);
    const target = new THREE.Object3D();
    target.position.set(24, 0, s * 1.6);
    mesh.group.add(target);
    spot.target = target;
    mesh.group.add(spot);
    spots.push(spot);
  }
  // Reverse light (small white strip, lit while reversing).
  const reverseMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const rev = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 1.0), reverseMat);
  rev.position.set(-2.33, 0.55, 0);
  mesh.group.add(rev);

  const player = {
    mesh, group: mesh.group, spots, reverseMat,
    x: 0, z: 30, heading: 0,
    speed: 0, gear: 0, rpm: 0, steer: 0,
    damage: 0, throttle: 0, braking: false, reversing: false,
    wheelSpin: 0, skid: 0,
    reset(x, z, heading) {
      this.x = x; this.z = z; this.heading = heading;
      this.speed = 0; this.gear = 0; this.rpm = 0; this.damage = 0;
      this.group.position.set(x, 0, z);
      // Car model faces local +X; world forward is (sin h, -cos h), so the
      // mesh yaw is PI/2 - heading, not heading.
      this.group.rotation.set(0, Math.PI / 2 - heading, 0);
    },
  };
  player.reset(0, 30, 0);
  return player;
}

export function gearForSpeed(speed) {
  const v = Math.abs(speed);
  for (let i = 0; i < GEARS.length; i++) if (v <= GEARS[i].top) return i + 1;
  return 5;
}

// Set gear + rpm from the current speed. Called every frame by
// updatePlayer and once by the shot stager, so the staged state reads
// correctly even before the next rendered frame (headless SwiftShader
// runs at a fraction of a frame per second).
export function syncGear(p) {
  if (p.speed < 0.3 && !p.reversing) {
    p.gear = 0;
    p.rpm = 0.22;
    return;
  }
  p.gear = gearForSpeed(p.speed);
  const band = GEARS[p.gear - 1];
  const prevTop = p.gear > 1 ? GEARS[p.gear - 2].top : 0;
  p.rpm = 0.25 + 0.75 * Math.max(0, Math.min(1, (Math.abs(p.speed) - prevTop) / (band.top - prevTop)));
}

export function updatePlayer(p, input, dt, game) {
  const damageFactor = 1 - Math.min(0.45, p.damage / 220);
  const topSpeed = GEARS[4].top * damageFactor;
  const fwd = input.up ? 1 : 0;
  const back = input.down ? 1 : 0;
  p.throttle = fwd;
  p.braking = !!input.brake || (back && p.speed > 0.5);
  p.reversing = back && p.speed <= 0.5;

  // Torque curve: strong in 1st, tapering as the gear climbs.
  // stagingHold (screenshot staging) freezes the speed exactly as staged.
  const gear = gearForSpeed(p.speed);
  p.gear = p.speed < 0.3 && !p.reversing ? 0 : gear;
  const ratio = GEARS[Math.max(0, gear - 1)].ratio;
  const speedNorm = Math.abs(p.speed) / topSpeed;
  const torque = (1.25 - speedNorm * 0.85) * ratio;
  let accel = 0;
  if (!game.stagingHold) {
    if (fwd && p.speed < topSpeed) accel += 9.5 * torque;
    if (p.reversing && p.speed > -REVERSE_TOP) accel -= 6;
    if (p.braking) accel -= Math.sign(p.speed) * 26;
    if (!fwd && !back && !p.braking) accel -= Math.sign(p.speed) * 3.2; // drag
    p.speed += accel * dt;
  }
  if (Math.abs(p.speed) < 0.15 && !fwd && !back && !game.stagingHold) p.speed = 0;

  // Steering weights up with speed; slight damage wobble at high damage.
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  p.steer += (steerTarget - p.steer) * Math.min(1, dt * 9);
  const steerAuthority = 0.62 / (1 + Math.abs(p.speed) * 0.055);
  const wobble = p.damage > 45 ? Math.sin(game.time * 9) * 0.02 * (p.damage / 100) : 0;
  p.heading += p.steer * steerAuthority * (p.speed / 8) * dt * 3.4 + wobble * dt * Math.abs(p.speed);
  p.heading = ((p.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

  // Integrate position.
  const fx = Math.sin(p.heading);
  const fz = -Math.cos(p.heading);
  p.x += fx * p.speed * dt;
  p.z += fz * p.speed * dt;

  // Stay in the world: soft clamp at the bounds, hard clamp at the sea wall.
  if (p.x > 152) { p.x = 152; p.speed *= 0.6; }
  if (p.x < -140) { p.x = -140; p.speed *= 0.6; }
  if (p.z > 140) { p.z = 140; p.speed *= 0.6; }
  if (p.z < -140) { p.z = -140; p.speed *= 0.6; }

  // Body: roll into corners, dive on braking, squat on launch.
  const roll = -p.steer * Math.min(1, Math.abs(p.speed) / 20) * 0.055;
  const pitch = (p.braking ? 0.03 : 0) - (fwd && p.speed < 12 ? -0.025 : 0);
  p.group.position.set(p.x, 0, p.z);
  p.group.rotation.set(pitch, Math.PI / 2 - p.heading, roll);

  // Wheels: spin around the axle (local Z) + front steer.
  p.wheelSpin += p.speed * dt * 2.8;
  p.mesh.wheels.forEach((w, i) => {
    w.rotation.z = p.wheelSpin;
    if (i < 2) w.rotation.y = p.steer * 0.38;
  });

  // RPM from position inside the current gear band.
  syncGear(p);
  if (p.gear === 0) p.rpm = 0.22;

  // Lights: brake strip flares, reverse strip glows white in reverse.
  p.mesh.brakeMat.color.setHex(p.braking ? 0xff2e2e : 0x881111);
  p.mesh.tailMat.color.setHex(p.braking ? 0xcc2222 : 0x881111);
  p.reverseMat.color.setHex(p.reversing ? 0xffffff : 0x333333);
  // Headlight cones brighten slightly with speed.
  if (p.mesh.headCones) {
    p.mesh.headCones.children.forEach((c) => {
      c.material.opacity = 0.10 + speedNorm * 0.06;
    });
  }
  // Tyre slip when launching hard or braking at speed.
  p.skid = (fwd && p.speed < 8 && p.rpm > 0.8) || (p.braking && Math.abs(p.speed) > 14) ? 1 : 0;

  return { speedKmh: Math.abs(p.speed) * 3.6, gear: p.gear, rpm: p.rpm };
}

// Circle-vs-AABB push-out against the city's building colliders.
export function collideBuildings(p, colliders, game) {
  for (const c of colliders) {
    const dx = p.x - Math.max(c.x - c.hw, Math.min(p.x, c.x + c.hw));
    const dz = p.z - Math.max(c.z - c.hd, Math.min(p.z, c.z + c.hd));
    const d2 = dx * dx + dz * dz;
    const r = 2.4;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      p.x += dx * push;
      p.z += dz * push;
      if (Math.abs(p.speed) > 4) {
        p.damage = Math.min(100, p.damage + Math.abs(p.speed) * 0.55);
        game.combat.sparks(p.x, 0.8, p.z, 14);
        game.shake = Math.min(1, game.shake + 0.45);
        game.audio.thud(Math.min(1, Math.abs(p.speed) / 30));
      }
      p.speed *= 0.45;
    }
  }
}
