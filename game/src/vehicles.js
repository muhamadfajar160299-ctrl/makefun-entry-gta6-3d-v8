// vehicles.js — city traffic: three distinct models (sedan, taxi, van), not
// clones. Each car follows a road loop, flashes its indicator before a
// turn, lights its brake lights when slowing, and brakes for the car ahead.
const THREE = window.THREE;

function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function paint(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.4 });
}
const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a1220, roughness: 0.1, metalness: 0.9 });
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.95 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd7dde8, roughness: 0.2, metalness: 1 });

function buildSedan(color) {
  const g = new THREE.Group();
  const p = paint(color);
  box(g, 1.8, 0.5, 4.2, p, 0, 0.6, 0);
  box(g, 1.6, 0.46, 2.0, glassMat, 0, 1.02, 0.1);
  box(g, 1.62, 0.08, 1.9, p, 0, 1.28, 0.1);
  box(g, 1.0, 0.18, 0x0a0a0c, 0, 0.6, -2.12);            // grille
  box(g, 1.84, 0.2, 0.2, paint(0x14161c), 0, 0.4, -2.1); // bumpers
  box(g, 1.84, 0.2, 0.2, paint(0x14161c), 0, 0.4, 2.1);
  const head = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff2c0, emissiveIntensity: 1.8 });
  box(g, 0.36, 0.14, 0.06, head, -0.58, 0.7, -2.13);
  box(g, 0.36, 0.14, 0.06, head, 0.58, 0.7, -2.13);
  for (const [wx, wz] of [[-0.82, -1.4], [0.82, -1.4], [-0.82, 1.4], [0.82, 1.4]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14), tyreMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.33, wz);
    g.add(w);
  }
  return g;
}

function buildTaxi() {
  const g = buildSedan(0xf2b705);
  // Checker band + roof sign.
  const check = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.16, 4.22), check);
  band.position.set(0, 0.78, 0);
  g.add(band);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc93c, emissiveIntensity: 1.8 }));
  sign.position.set(0, 1.44, 0.1);
  g.add(sign);
  return g;
}

function buildVan(color) {
  const g = new THREE.Group();
  const p = paint(color);
  box(g, 2.0, 1.5, 4.8, p, 0, 1.05, 0);                 // tall box body
  box(g, 1.9, 0.7, 0.9, glassMat, 0, 1.35, -1.95);       // windscreen
  box(g, 1.96, 0.14, 4.82, paint(0x14161c), 0, 0.42, 0);// side stripe skirt
  box(g, 1.1, 0.2, 0.08, 0x0a0a0c, 0, 0.7, -2.42);       // grille
  const head = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff2c0, emissiveIntensity: 1.8 });
  box(g, 0.4, 0.18, 0.08, head, -0.66, 0.85, -2.43);
  box(g, 0.4, 0.18, 0.08, head, 0.66, 0.85, -2.43);
  box(g, 2.02, 0.22, 0.24, paint(0x14161c), 0, 0.45, -2.42);
  box(g, 2.02, 0.22, 0.24, paint(0x14161c), 0, 0.45, 2.42);
  for (const [wx, wz] of [[-0.9, -1.6], [0.9, -1.6], [-0.9, 1.6], [0.9, 1.6]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14), tyreMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }
  return g;
}

const BUILDERS = [
  { make: () => buildSedan(0x2a4d8f), cruise: 11, name: 'sedan' },
  { make: () => buildSedan(0x3c3f46), cruise: 12, name: 'sedan' },
  { make: () => buildSedan(0x6e1f2a), cruise: 10.5, name: 'sedan' },
  { make: buildTaxi, cruise: 12.5, name: 'taxi' },
  { make: () => buildVan(0xd8dce4), cruise: 9.5, name: 'van' },
  { make: () => buildVan(0x27435c), cruise: 9, name: 'van' },
  { make: () => buildSedan(0x1f6b4a), cruise: 11.5, name: 'sedan' },
];

export function createTraffic(scene, roadLoops) {
  const cars = [];
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a2a, emissiveIntensity: 0.6 });
  const signalMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xffa02e, emissiveIntensity: 0 });

  for (let i = 0; i < 10; i++) {
    const spec = BUILDERS[i % BUILDERS.length];
    const model = spec.make();
    const loop = roadLoops[i % roadLoops.length];
    const seg = Math.floor(i / roadLoops.length) % loop.length;
    const side = i % 2 === 0 ? 1 : -1;
    // Tail lights + indicators (front is -z in model space).
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.06), tailMat.clone());
    tl.position.set(-0.55, 0.72, 2.12);
    model.add(tl);
    const tr = tl.clone();
    tr.position.x = 0.55;
    model.add(tr);
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.06), signalMat.clone());
    sl.position.set(-0.72, 0.72, -2.13);
    model.add(sl);
    const sr = sl.clone();
    sr.position.x = 0.72;
    model.add(sr);
    scene.add(model);
    const start = loop[seg];
    cars.push({
      model, loop, wp: (seg + 1) % loop.length, side,
      pos: new THREE.Vector3(start.x, 0, start.z),
      heading: 0, speed: spec.cruise * (0.8 + Math.random() * 0.3),
      cruise: spec.cruise, braking: false, signalling: 0, signalT: 0,
      tailL: tl, tailR: tr, sigL: sl, sigR: sr, kind: spec.name,
    });
  }

  function turnDir(from, to, next) {
    const a1 = Math.atan2(to.x - from.x, to.z - from.z);
    const a2 = Math.atan2(next.x - to.x, next.z - to.z);
    let d = a2 - a1;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  return {
    cars,
    update(dt, player, others) {
      for (const c of cars) {
        const target = c.loop[c.wp];
        const next = c.loop[(c.wp + 1) % c.loop.length];
        // Lane offset: keep right, perpendicular to travel direction.
        const dx = target.x - c.pos.x, dz = target.z - c.pos.z;
        const dist = Math.hypot(dx, dz);
        const dirX = dx / (dist || 1), dirZ = dz / (dist || 1);
        const ox = -dirZ * 2.6 * c.side, oz = dirX * 2.6 * c.side;
        const tx = target.x + ox, tz = target.z + oz;
        const tdx = tx - c.pos.x, tdz = tz - c.pos.z;
        const tdist = Math.hypot(tdx, tdz);
        const wantHeading = Math.atan2(tdx, tdz);

        // Signal before turning at the waypoint.
        const upcoming = turnDir(c.loop[(c.wp + c.loop.length - 1) % c.loop.length], target, next);
        if (tdist < 26 && Math.abs(upcoming) > 0.25) {
          c.signalling = upcoming > 0 ? 1 : -1;
        } else if (tdist < 4) {
          c.signalling = 0;
        }

        // Brake for the vehicle ahead (traffic, police, player).
        let wantSpeed = c.cruise;
        const ahead = [];
        for (const o of others) if (o !== c) ahead.push(o);
        if (player) ahead.push({ pos: player.pos, speed: Math.abs(player.speed), heading: player.heading });
        for (const o of ahead) {
          const ox2 = o.pos.x - c.pos.x, oz2 = o.pos.z - c.pos.z;
          const od = Math.hypot(ox2, oz2);
          if (od < 16 && od > 0.01) {
            const dot = (ox2 * Math.sin(c.heading) + oz2 * Math.cos(c.heading)) / od;
            if (dot > 0.86) { // roughly ahead
              wantSpeed = Math.min(wantSpeed, Math.max(0, (od - 5.5) * 0.9));
            }
          }
        }
        c.braking = wantSpeed < c.speed - 0.4;
        c.speed += (wantSpeed - c.speed) * Math.min(1, dt * (c.braking ? 4.5 : 1.4));
        if (c.speed < 0.05 && wantSpeed === 0) c.speed = 0;

        // Steer toward the waypoint.
        let dh = wantHeading - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
        c.pos.x += Math.sin(c.heading) * c.speed * dt;
        c.pos.z += Math.cos(c.heading) * c.speed * dt;

        if (tdist < 3.5) c.wp = (c.wp + 1) % c.loop.length;

        // Pose + lights.
        c.model.position.copy(c.pos);
        c.model.rotation.y = c.heading + Math.PI; // model front is -z
        c.tailL.material.emissiveIntensity = c.braking ? 2.8 : 0.6;
        c.tailR.material.emissiveIntensity = c.braking ? 2.8 : 0.6;
        c.signalT += dt;
        const blink = Math.sin(c.signalT * 9) > 0;
        c.sigL.material.emissiveIntensity = c.signalling === 1 && blink ? 3 : 0;
        c.sigR.material.emissiveIntensity = c.signalling === -1 && blink ? 3 : 0;
      }
    },
  };
}
