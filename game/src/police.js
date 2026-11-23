// police.js — Velmara PD: role-based pursuit AI. Car #1 INTERCEPTs the
// player's predicted position, the others PURSUE from the flanks, and any
// unit that gets ahead of the player BLOCKs the road. Speed scales with
// distance; strobes flash red/blue and the livery reads PD.
const THREE = window.THREE;

function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function buildPoliceCar() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.38, metalness: 0.45 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.38, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a1220, roughness: 0.1, metalness: 0.9 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.95 });
  box(g, 1.85, 0.52, 4.4, body, 0, 0.62, 0);
  box(g, 1.8, 0.4, 2.4, white, 0, 0.6, 0.3);               // white doors band
  box(g, 1.62, 0.46, 2.0, glass, 0, 1.04, 0.1);
  box(g, 1.64, 0.08, 1.9, body, 0, 1.3, 0.1);
  // PD door decals: white door + dark letters are faked with a thin gold bar
  // and a black "PD" plate on each side.
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf6c945, emissiveIntensity: 0.9 });
  box(g, 0.04, 0.3, 0.9, plateMat, -0.94, 0.72, 0.2);
  box(g, 0.04, 0.3, 0.9, plateMat, 0.94, 0.72, 0.2);
  // Push bar + grille.
  box(g, 1.5, 0.3, 0.14, new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.4, metalness: 0.8 }), 0, 0.55, -2.24);
  box(g, 1.0, 0.18, 0.08, new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.4 }), 0, 0.62, -2.26);
  const head = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff2c0, emissiveIntensity: 2.2 });
  box(g, 0.38, 0.14, 0.08, head, -0.6, 0.72, -2.24);
  box(g, 0.38, 0.14, 0.08, head, 0.6, 0.72, -2.24);
  for (const [wx, wz] of [[-0.84, -1.45], [0.84, -1.45], [-0.84, 1.45], [0.84, 1.45]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 14), tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.35, wz);
    g.add(w);
  }
  // Light bar: red left, blue right.
  const redMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2020, emissiveIntensity: 0.4 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x000022, emissive: 0x2244ff, emissiveIntensity: 0.4 });
  const barBase = box(g, 1.1, 0.12, 0.4, new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.5 }), 0, 1.42, 0.1);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.36), redMat);
  red.position.set(-0.28, 1.54, 0.1);
  g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.36), blueMat);
  blue.position.set(0.28, 1.54, 0.1);
  g.add(blue);
  // One shared strobe light per car (alternates red/blue).
  const strobe = new THREE.PointLight(0xff2020, 0, 26, 1.6);
  strobe.position.set(0, 2.1, 0.1);
  g.add(strobe);
  return { group: g, redMat, blueMat, strobe, barBase };
}

const ROLES = ['INTERCEPT', 'PURSUE', 'PURSUE', 'BLOCK'];

export function createPolice(scene) {
  const units = [];
  for (let i = 0; i < 4; i++) {
    const car = buildPoliceCar();
    car.group.visible = false;
    scene.add(car.group);
    units.push({
      ...car,
      pos: new THREE.Vector3(40 + i * 12, 0, 90),
      heading: 0,
      speed: 0,
      role: ROLES[i],
      active: false,
      phase: i * 0.9,
    });
  }

  let wanted = 0;
  let heat = 0; // 0..1, decays when the player stays clean

  function wantedCount() {
    if (wanted <= 0) return 0;
    if (wanted === 1) return 2;
    if (wanted === 2) return 3;
    return 4;
  }

  return {
    get wanted() { return wanted; },
    setWanted(n) {
      wanted = Math.max(0, Math.min(5, n));
      const count = wantedCount();
      units.forEach((u, i) => { u.active = i < count; u.group.visible = i < count; });
    },
    addHeat(amount) {
      heat = Math.min(1, heat + amount);
      if (heat > 0.55 && wanted < 3) this.setWanted(wanted + 1);
      else if (heat > 0.25 && wanted < 1) this.setWanted(1);
    },
    units,
    update(dt, player, t) {
      const count = wantedCount();
      // Heat decays when no unit is close.
      let nearest = Infinity;
      for (const u of units) {
        if (!u.active) continue;
        nearest = Math.min(nearest, Math.hypot(u.pos.x - player.pos.x, u.pos.z - player.pos.z));
      }
      if (nearest > 60) heat = Math.max(0, heat - dt * 0.02);
      if (heat <= 0.02 && wanted > 0 && nearest > 80) this.setWanted(wanted - 1);

      units.forEach((u, i) => {
        if (!u.active) return;
        const dx = player.pos.x - u.pos.x;
        const dz = player.pos.z - u.pos.z;
        const dist = Math.hypot(dx, dz) || 0.01;
        const playerSpeed = Math.abs(player.speed);
        // Predicted player position for the INTERCEPT unit.
        const lead = 1.1 + dist * 0.02;
        const px = player.pos.x + Math.sin(player.heading) * player.speed * lead;
        const pz = player.pos.z + Math.cos(player.heading) * player.speed * lead;

        let tx, tz, wantSpeed;
        if (u.role === 'INTERCEPT' && i === 0) {
          tx = px; tz = pz;
          wantSpeed = Math.min(40, 15 + dist * 0.55);
        } else if (u.role === 'BLOCK') {
          // Get ahead of the player, then turn to face them and slow.
          const aheadX = player.pos.x + Math.sin(player.heading) * 16;
          const aheadZ = player.pos.z + Math.cos(player.heading) * 16;
          const toAhead = Math.hypot(aheadX - u.pos.x, aheadZ - u.pos.z);
          if (toAhead > 6) { tx = aheadX; tz = aheadZ; wantSpeed = Math.min(38, 14 + toAhead * 0.5); }
          else { tx = player.pos.x; tz = player.pos.z; wantSpeed = 0; }
        } else {
          // PURSUE from a flank offset so units don't pile up.
          const flank = (i % 2 === 0 ? 1 : -1) * 7;
          const fx = -Math.cos(player.heading) * flank;
          const fz = Math.sin(player.heading) * flank;
          tx = player.pos.x + fx; tz = player.pos.z + fz;
          wantSpeed = Math.min(39, 13 + dist * 0.5);
        }
        // Never slower than the player when far behind, never absurd up close.
        if (dist > 45) wantSpeed = Math.max(wantSpeed, playerSpeed + 4);
        if (dist < 9) wantSpeed = Math.min(wantSpeed, playerSpeed + 1.5);

        const wantHeading = Math.atan2(tx - u.pos.x, tz - u.pos.z);
        let dh = wantHeading - u.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        const steerRate = 2.6;
        u.heading += Math.max(-steerRate * dt, Math.min(steerRate * dt, dh));
        u.speed += (wantSpeed - u.speed) * Math.min(1, dt * 1.8);
        u.pos.x += Math.sin(u.heading) * u.speed * dt;
        u.pos.z += Math.cos(u.heading) * u.speed * dt;
        // Stay in the city.
        u.pos.x = Math.max(-195, Math.min(160, u.pos.x));
        u.pos.z = Math.max(-195, Math.min(195, u.pos.z));

        u.group.position.copy(u.pos);
        u.group.position.y = 0;
        u.group.rotation.y = u.heading + Math.PI; // model front is -z
        u.group.rotation.z = -Math.max(-0.1, Math.min(0.1, dh * 0.4));

        // Strobes: alternate red / blue, ~7 Hz.
        const on = Math.sin(t * 11 + u.phase * 6) > 0;
        u.redMat.emissiveIntensity = on ? 4.5 : 0.25;
        u.blueMat.emissiveIntensity = on ? 0.25 : 4.5;
        u.strobe.color.setHex(on ? 0xff2020 : 0x2244ff);
        u.strobe.intensity = 14 + Math.sin(t * 11 + u.phase * 6) * 6;
      });
    },
    // Teleport units around the player (used by the shot director).
    deployAround(playerPos, radius) {
      const count = wantedCount();
      units.forEach((u, i) => {
        if (i >= count) return;
        const a = (i / Math.max(1, count)) * Math.PI * 2 + 0.6;
        u.pos.set(playerPos.x + Math.cos(a) * radius, 0, playerPos.z + Math.sin(a) * radius);
        u.heading = Math.atan2(playerPos.x - u.pos.x, playerPos.z - u.pos.z);
        u.speed = 14;
      });
    },
  };
}
