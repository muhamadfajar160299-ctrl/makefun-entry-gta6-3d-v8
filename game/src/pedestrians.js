// pedestrians.js — people of Velmara Bay.
//
// Walkers with a real limb-swing cycle, joggers leaning into their run,
// and cafe groups standing in conversation circles, bobbing and turning
// to each other. Everyone stays on sidewalks and the promenade.
const THREE = window.THREE;

const SHIRT_COLORS = [0xe8b04b, 0x4b8fe8, 0xd94b6a, 0x6abf7a, 0xe8e4da, 0x9a6bd0, 0x3fb3a9];
const PANTS_COLORS = [0x2c3550, 0x3a3a3a, 0x4a3a2c, 0x24344a];

function makePerson(shirtColor, pantsColor, scale = 1) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.26, 0.62, 8), shirt);
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
  head.position.y = 1.52;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.72, 0.15), pants);
  legL.position.set(-0.11, 0.36, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.11;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.58, 0.12), shirt);
  armL.position.set(-0.3, 1.08, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.3;
  g.add(armR);
  g.scale.setScalar(scale);
  return { group: g, legL, legR, armL, armR };
}

// Sidewalk waypoint loops: rectangles around city blocks.
function blockLoop(bx, bz) {
  const hw = 15.5;
  const hd = 15.5;
  return [
    [bx - hw, bz - hd], [bx + hw, bz - hd], [bx + hw, bz + hd], [bx - hw, bz + hd],
  ];
}

export function createPedestrians(scene, count = 14) {
  const peds = [];
  const loops = [
    blockLoop(-75, -75), blockLoop(25, -75), blockLoop(-75, 25), blockLoop(75, 75),
    [[128, -90], [148, -90], [148, 110], [128, 110]], // promenade
  ];
  for (let i = 0; i < count; i++) {
    const jogger = i % 4 === 3;
    const p = makePerson(
      SHIRT_COLORS[i % SHIRT_COLORS.length],
      PANTS_COLORS[i % PANTS_COLORS.length],
      jogger ? 1.02 : 0.96 + (i % 3) * 0.04,
    );
    scene.add(p.group);
    const loop = loops[i % loops.length];
    peds.push({
      ...p, kind: jogger ? 'jogger' : 'walker',
      loop, seg: i % loop.length, segT: Math.random(),
      speed: jogger ? 3.4 : 1.3 + (i % 3) * 0.25,
      phase: Math.random() * 10, x: loop[0][0], z: loop[0][1],
    });
  }
  // Cafe chatter groups: two or three people facing each other by a table.
  const chatters = [];
  for (const [cx, cz] of [[137.5, -32], [134.5, 8], [137.5, 44]]) {
    const group = [];
    for (let k = 0; k < 3; k++) {
      const p = makePerson(SHIRT_COLORS[(k + 2) % SHIRT_COLORS.length], PANTS_COLORS[k % 4]);
      const a = (k / 3) * Math.PI * 2;
      p.group.position.set(cx + Math.cos(a) * 1.4, 0, cz + Math.sin(a) * 1.4);
      p.group.rotation.y = -a + Math.PI / 2;
      scene.add(p.group);
      group.push({ ...p, phase: k * 2.1, baseY: 0 });
    }
    chatters.push(group);
  }
  return { walkers: peds, chatters };
}

export function updatePedestrians(peds, dt, t) {
  for (const p of peds.walkers) {
    const a = p.loop[p.seg];
    const b = p.loop[(p.seg + 1) % p.loop.length];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    p.segT += (p.speed * dt) / segLen;
    if (p.segT >= 1) {
      p.segT = 0;
      p.seg = (p.seg + 1) % p.loop.length;
    }
    const na = p.loop[p.seg];
    const nb = p.loop[(p.seg + 1) % p.loop.length];
    p.x = na[0] + (nb[0] - na[0]) * p.segT;
    p.z = na[1] + (nb[1] - na[1]) * p.segT;
    p.group.position.set(p.x, 0, p.z);
    // Face along the walk direction (local +Z is the person's front).
    p.group.rotation.y = Math.atan2(nb[0] - na[0], nb[1] - na[1]);
    // Walk cycle: legs and arms swing in opposition, body bobs.
    const swing = Math.sin(t * (p.kind === 'jogger' ? 11 : 6.5) + p.phase) * (p.kind === 'jogger' ? 0.75 : 0.5);
    p.legL.rotation.x = swing;
    p.legR.rotation.x = -swing;
    p.armL.rotation.x = -swing * 0.8;
    p.armR.rotation.x = swing * 0.8;
    p.group.position.y = Math.abs(Math.sin(t * (p.kind === 'jogger' ? 11 : 6.5) + p.phase)) * 0.05;
    if (p.kind === 'jogger') p.group.rotation.x = 0.12;
  }
  for (const group of peds.chatters) {
    for (const p of group) {
      // Conversation bob + occasional turn of the head (whole-body sway).
      p.group.position.y = Math.sin(t * 1.4 + p.phase) * 0.03;
      p.group.rotation.y += Math.sin(t * 0.5 + p.phase) * 0.0012;
      p.armL.rotation.x = -0.25 + Math.sin(t * 1.1 + p.phase) * 0.2;
      p.armR.rotation.x = -0.25 + Math.cos(t * 0.9 + p.phase) * 0.2;
    }
  }
}
