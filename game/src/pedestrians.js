// pedestrians.js — people of Velmara Bay: a real walk cycle (legs and arms
// swing in opposition), varied heights, joggers leaning forward, five pairs
// chatting at the cafe, and early avoidance when a car bears down on them.
const THREE = window.THREE;

const SHIRTS = [0xe2574c, 0x2e86ff, 0xf2b705, 0x3ddc84, 0xb46bff, 0xff8fb0, 0x7fd4e8, 0xe8ecf2];
const PANTS = [0x1c2233, 0x2a2f3a, 0x3a2a22, 0x22303a];
const SKINS = [0xc98e6b, 0x8d5a3b, 0xe8b98d, 0x6e4429, 0xd9a075];

function buildPerson(rng, heightScale) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)], roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: PANTS[Math.floor(rng() * PANTS.length)], roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: SKINS[Math.floor(rng() * SKINS.length)], roughness: 0.7 });
  const s = heightScale;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.55 * s, 0.24 * s), shirt);
  torso.position.y = 1.05 * s;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 12, 10), skin);
  head.position.y = 1.5 * s;
  head.castShadow = true;
  g.add(head);
  // Hair cap.
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.165 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: [0x1a1210, 0x2c1e12, 0x0c0c0c, 0x4a3220][Math.floor(rng() * 4)], roughness: 0.95 }));
  hair.position.y = 1.53 * s;
  g.add(hair);

  function limb(w, h, mat, x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    m.position.y = -h / 2;
    m.castShadow = true;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  }
  const legL = limb(0.13 * s, 0.78 * s, pants, -0.11 * s, 0.78 * s);
  const legR = limb(0.13 * s, 0.78 * s, pants, 0.11 * s, 0.78 * s);
  const armL = limb(0.09 * s, 0.6 * s, skin, -0.27 * s, 1.28 * s);
  const armR = limb(0.09 * s, 0.6 * s, skin, 0.27 * s, 1.28 * s);
  return { group: g, legL, legR, armL, armR, height: 1.66 * s };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPedestrians(scene) {
  const rng = mulberry32(4242);
  const walkers = [];
  const chatters = [];

  // Sidewalk strollers: wander along the roads and the promenade.
  const spots = [];
  for (const x of [-165, -110, -55, 0, 55, 110]) {
    for (let z = -160; z <= 160; z += 40) {
      spots.push({ x: x + 11.5, z, axis: 'z' });
      spots.push({ x: x - 11.5, z: z + 20, axis: 'z' });
    }
  }
  for (let z = -160; z <= 160; z += 40) spots.push({ x: 150, z, axis: 'z' });

  for (let i = 0; i < 24; i++) {
    const spot = spots[i % spots.length];
    const jogger = rng() < 0.22;
    const p = buildPerson(rng, 0.88 + rng() * 0.24);
    const start = new THREE.Vector3(spot.x + (rng() - 0.5) * 2, 0, spot.z + (rng() - 0.5) * 8);
    p.group.position.copy(start);
    scene.add(p.group);
    walkers.push({
      ...p,
      pos: start,
      dir: rng() < 0.5 ? 1 : -1,
      speed: jogger ? 2.6 + rng() * 0.8 : 0.9 + rng() * 0.6,
      jogger,
      phase: rng() * Math.PI * 2,
      axis: spot.axis,
      range: 26 + rng() * 30,
      home: start.clone(),
      flee: new THREE.Vector3(),
      fleeing: 0,
    });
  }

  // Five pairs chatting at the cafe tables on the promenade.
  const cafeTables = [[146, -18], [146, -6], [147, 6], [146, 26], [147, -32]];
  for (const [tx, tz] of cafeTables) {
    for (const side of [-1, 1]) {
      const p = buildPerson(rng, 0.9 + rng() * 0.2);
      const px = tx + side * 1.9;
      const pz = tz + (rng() - 0.5) * 1.2;
      p.group.position.set(px, 0, pz);
      // Face the partner across the table.
      p.group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(p.group);
      chatters.push({ ...p, phase: rng() * Math.PI * 2, baseY: 0, baseRotY: p.group.rotation.y });
    }
  }

  return {
    walkers,
    chatters,
    update(dt, player, t) {
      for (const w of walkers) {
        // Early avoidance: a car closing in makes them step aside.
        const toCar = new THREE.Vector3(w.pos.x - player.pos.x, 0, w.pos.z - player.pos.z);
        const dCar = toCar.length();
        const carSpeed = Math.abs(player.speed);
        if (dCar < 14 && carSpeed > 3) {
          const closing = (Math.sin(player.heading) * -toCar.x + Math.cos(player.heading) * -toCar.z) / (dCar || 1);
          if (closing > 0.2) {
            w.flee.copy(toCar).normalize().multiplyScalar(3.2);
            w.fleeing = 1;
          }
        }
        if (w.fleeing > 0) {
          w.fleeing = Math.max(0, w.fleeing - dt * 0.5);
          w.pos.addScaledVector(w.flee, dt * w.fleeing);
        }
        // Stroll along the sidewalk, turn at the end of the range.
        const step = w.dir * w.speed * dt;
        w.pos.z += step;
        if (Math.abs(w.pos.z - w.home.z) > w.range) w.dir *= -1;
        w.phase += dt * w.speed * (w.jogger ? 3.4 : 2.6);
        const swing = Math.sin(w.phase) * (w.jogger ? 0.75 : 0.5);
        w.legL.rotation.x = swing;
        w.legR.rotation.x = -swing;
        w.armL.rotation.x = -swing * 0.85;
        w.armR.rotation.x = swing * 0.85;
        // Joggers lean forward and bounce.
        w.group.position.set(w.pos.x, w.jogger ? Math.abs(Math.sin(w.phase)) * 0.07 : 0, w.pos.z);
        w.group.rotation.x = w.jogger ? 0.16 : 0;
        w.group.rotation.y = w.dir > 0 ? 0 : Math.PI;
      }
      for (const c of chatters) {
        // Idle chat: slight bob, small hand gestures, head turns.
        const bob = Math.sin(t * 1.4 + c.phase) * 0.012;
        c.group.position.y = bob;
        c.group.rotation.y = c.baseRotY + Math.sin(t * 0.5 + c.phase) * 0.22;
        c.armR.rotation.x = -0.5 + Math.sin(t * 2.1 + c.phase) * 0.35;
        c.armL.rotation.x = -0.2 + Math.cos(t * 1.7 + c.phase) * 0.18;
        c.legL.rotation.x = 0;
        c.legR.rotation.x = 0;
      }
    },
  };
}
