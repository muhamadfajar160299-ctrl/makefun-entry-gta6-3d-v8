// Marina Nights — pedestrians and a busy marina: colourful jackets, cafe
// tables with umbrellas, benches, kiosks, string lights, planters. Walkers
// stay on sidewalks and the promenade and never step onto the road. They
// walk with a real gait (swinging legs and arms), come in different heights,
// and a few jog the promenade or stand chatting in pairs at the cafes.
import { STREETS } from './city.js';
const THREE = window.THREE;

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const JACKETS = [0xff5d8f, 0xffc93d, 0x37e08b, 0x2ec5ff, 0xff7a3d, 0x9b6bff, 0xffffff, 0xff4d4d, 0x4dffc3];
const SKINS = [0xf2c89b, 0xc98d5f, 0x8a5a3b, 0xf7d7b0];

function makeWalker() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: pick(JACKETS) });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.95, 8), jacket);
  body.position.y = 1.0;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshLambertMaterial({ color: pick(SKINS) }));
  head.position.y = 1.78;
  g.add(head);
  // hair cap so heads aren't bare skin-coloured balls
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.225, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshLambertMaterial({ color: pick([0x1a1210, 0x3a2a18, 0x6b6b6b, 0x8a5a2b]) }));
  hair.position.y = 1.82;
  g.add(hair);
  // two legs + two arms, pivoted at hip/shoulder so they can swing
  const legMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const legs = [];
  for (const sx of [-0.09, 0.09]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.52, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 0.18), legMat);
    leg.position.y = -0.26;
    pivot.add(leg);
    g.add(pivot);
    legs.push(pivot);
  }
  const arms = [];
  for (const sx of [-0.3, 0.3]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 1.42, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.13), jacket);
    arm.position.y = -0.25;
    pivot.add(arm);
    g.add(pivot);
    arms.push(pivot);
  }
  return { group: g, legs, arms };
}

// Sidewalk lines: {axis:'x'|'z', fixed:<coord>, from, to}
function sidewalkLines() {
  const lines = [];
  for (const s of STREETS) {
    lines.push({ axis: 'x', fixed: s + 9.2, from: -185, to: 185 });
    lines.push({ axis: 'x', fixed: s - 9.2, from: -185, to: 185 });
    lines.push({ axis: 'z', fixed: s + 9.2, from: -185, to: 185 });
    lines.push({ axis: 'z', fixed: s - 9.2, from: -185, to: 185 });
  }
  // promenade (the busy one)
  lines.push({ axis: 'x', fixed: 193.5, from: -185, to: 185 });
  lines.push({ axis: 'x', fixed: 197.5, from: -185, to: 185 });
  return lines;
}

export function createPedestrians(scene) {
  const lines = sidewalkLines();
  const walkers = [];

  function randomPointOn(line) {
    const t = rand(line.from, line.to);
    return line.axis === 'x' ? { x: line.fixed, z: t } : { x: t, z: line.fixed };
  }

  function addWalker(marina, kind) {
    const line = marina
      ? lines[lines.length - 1 - Math.floor(Math.random() * 2)]
      : pick(lines);
    const p = randomPointOn(line);
    const { group: mesh, legs, arms } = makeWalker();
    const height = rand(0.92, 1.1);
    mesh.scale.setScalar(height);
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    const jogger = kind === 'jogger';
    const baseSpeed = jogger ? rand(2.4, 3.0) : rand(0.9, 1.7);
    const w = {
      mesh, legs, arms, line,
      target: randomPointOn(line),
      speed: baseSpeed, baseSpeed,
      bob: rand(0, 6), jogger,
      // chatters stand still at a cafe table, facing each other
      standing: kind === 'chat',
      sway: rand(0, 6), hurry: 0,
    };
    if (w.standing) w.target = { x: p.x, z: p.z };
    walkers.push(w);
    return w;
  }

  // 26 on the marina promenade, 16 elsewhere — the marina feels alive.
  for (let i = 0; i < 24; i++) addWalker(true, 'walk');
  for (let i = 0; i < 4; i++) addWalker(true, 'jogger');
  for (let i = 0; i < 14; i++) addWalker(false, 'walk');
  for (let i = 0; i < 2; i++) addWalker(false, 'jogger');
  // chatting pairs at the promenade cafes (x ~192, near the tables)
  for (let i = 0; i < 5; i++) {
    const z = rand(-170, 170);
    const a = addWalker(true, 'chat');
    a.mesh.position.set(192.4, 0, z);
    a.mesh.rotation.y = rand(0, Math.PI * 2);
    const b = addWalker(true, 'chat');
    b.mesh.position.set(192.4 + rand(-1.2, 1.2), 0, z + rand(-1.5, 1.5));
    b.mesh.rotation.y = Math.atan2(
      a.mesh.position.x - b.mesh.position.x, a.mesh.position.z - b.mesh.position.z);
    a.mesh.rotation.y = Math.atan2(
      b.mesh.position.x - a.mesh.position.x, b.mesh.position.z - a.mesh.position.z);
  }

  // ---- marina life: cafes, benches, kiosks, string lights, planters ----
  const promZ = [-170, -130, -90, -50, -10, 10, 50, 90, 130, 170];
  for (const z of promZ) {
    // cafe table + umbrella
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 12),
      new THREE.MeshLambertMaterial({ color: 0xe8ecf2 }));
    table.position.set(192.2, 0.85, z);
    scene.add(table);
    const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.85, 6),
      new THREE.MeshLambertMaterial({ color: 0x333d4d }));
    tLeg.position.set(192.2, 0.45, z);
    scene.add(tLeg);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.7, 8),
      new THREE.MeshLambertMaterial({ color: pick([0xff5d8f, 0xffc93d, 0x2ec5ff, 0x37e08b]) }));
    umb.position.set(192.2, 2.5, z);
    scene.add(umb);
    const uPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6),
      new THREE.MeshLambertMaterial({ color: 0x333d4d }));
    uPole.position.set(192.2, 1.6, z);
    scene.add(uPole);
    // bench
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x8a6b45 }));
    bench.position.set(196.8, 0.45, z + 6);
    scene.add(bench);
    // planter with green shrub
    const planter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x4a4f55 }));
    planter.position.set(195.6, 0.3, z - 6);
    scene.add(planter);
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x2fae5f }));
    shrub.position.set(195.6, 0.95, z - 6);
    scene.add(shrub);
  }
  // kiosks
  for (const z of [-110, 30, 120]) {
    const kiosk = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 2.6),
      new THREE.MeshLambertMaterial({ color: pick([0xff5d8f, 0x2ec5ff, 0xffc93d]) }));
    box.position.y = 1.3;
    kiosk.add(box);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 3.0),
      new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
    roof.position.y = 2.7;
    kiosk.add(roof);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.3, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    glow.position.set(0, 2.2, 1.35);
    kiosk.add(glow);
    kiosk.position.set(191.5, 0, z);
    scene.add(kiosk);
  }
  // string lights: poles + a sagging line of small glowing bulbs along the promenade
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333d4d });
  for (let z = -180; z < 180; z += 24) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), poleMat);
    pole.position.set(198.2, 1.7, z);
    scene.add(pole);
    // catenary-ish bulbs to the next pole
    const nz = z + 24;
    for (let i = 1; i <= 6; i++) {
      const t = i / 7;
      const sag = Math.sin(t * Math.PI) * 0.55;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), bulbMat);
      bulb.position.set(198.2, 3.3 - sag, z + (nz - z) * t);
      scene.add(bulb);
    }
  }

  function update(dt) {
    for (const w of walkers) {
      if (w.standing) {
        // chatting: gentle sway and a slow turn, arms mostly still
        w.sway += dt;
        w.mesh.rotation.y += Math.sin(w.sway * 0.7) * dt * 0.25;
        w.arms[0].rotation.x = Math.sin(w.sway * 1.4) * 0.12;
        w.arms[1].rotation.x = -Math.sin(w.sway * 1.4) * 0.12;
        continue;
      }
      const dx = w.target.x - w.mesh.position.x;
      const dz = w.target.z - w.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.6) {
        w.target = randomPointOn(w.line);
        continue;
      }
      const step = (w.hurry > 0 ? w.baseSpeed * 1.8 : w.baseSpeed) * dt;
      w.mesh.position.x += (dx / dist) * step;
      w.mesh.position.z += (dz / dist) * step;
      w.mesh.rotation.y = Math.atan2(dx, dz);
      // walk cycle: legs swing opposite, arms counter-swing; joggers lean
      // forward and pump faster.
      w.bob += dt * (w.jogger ? 13 : 8) * (0.7 + w.baseSpeed * 0.25);
      const swing = Math.sin(w.bob) * (w.jogger ? 0.75 : 0.5);
      w.legs[0].rotation.x = swing;
      w.legs[1].rotation.x = -swing;
      w.arms[0].rotation.x = -swing * 0.7;
      w.arms[1].rotation.x = swing * 0.7;
      w.mesh.position.y = Math.abs(Math.sin(w.bob)) * 0.05;
      if (w.jogger) w.mesh.rotation.x = 0.12;
      if (w.hurry > 0) w.hurry -= dt;
    }
  }

  // Pedestrians dodge: when the player gets close, retarget away — and
  // hurry for a moment, like real people startled by a car.
  function dodge(playerPos) {
    for (const w of walkers) {
      if (w.standing) continue;
      const dx = w.mesh.position.x - playerPos.x;
      const dz = w.mesh.position.z - playerPos.z;
      if (dx * dx + dz * dz < 64) {
        const away = randomPointOn(w.line);
        w.target = away;
        w.hurry = 1.2;
      }
    }
  }

  return { walkers, update, dodge };
}
