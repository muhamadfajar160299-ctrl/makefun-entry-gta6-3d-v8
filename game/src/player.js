// player.js — the player's car: a detailed build (grille, bumper, spoiler,
// mirrors, exhausts) over arcade physics — torque curve, 5 gears, steering
// that weights up with speed, body roll / dive / squat, brake + reverse
// lights and volumetric headlight cones.
const THREE = window.THREE;

// Gear ratios and the top speed each gear can reach (m/s).
const GEARS = [
  { ratio: 3.1, top: 11 },
  { ratio: 2.2, top: 19 },
  { ratio: 1.6, top: 27 },
  { ratio: 1.2, top: 35 },
  { ratio: 0.9, top: 44 },
];
const TOP_SPEED = 44; // ~158 km/h

function paintMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.45 });
}
function darkMat(color, rough = 0.6) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.3 });
}

export function createPlayer(scene) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paint = paintMat(0x8f1626);       // deep marina red
  const paintDark = paintMat(0x5d0d18);
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a1220, roughness: 0.12, metalness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd7dde8, roughness: 0.15, metalness: 1 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.95 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xcfd6e2, roughness: 0.25, metalness: 0.95 });

  function box(w, h, d, mat, x, y, z, parent = body) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  // Main hull: lower body, cabin, hood and trunk shaping.
  box(1.9, 0.52, 4.6, paint, 0, 0.62, 0);
  box(1.86, 0.34, 2.6, paint, 0, 0.55, 0.55);            // lower skirt
  box(1.7, 0.5, 2.1, glass, 0, 1.08, 0.15);              // cabin glass
  box(1.72, 0.1, 2.0, paintDark, 0, 1.36, 0.15);         // roof
  box(1.84, 0.16, 1.05, paint, 0, 0.86, -1.85);          // hood slope
  box(1.84, 0.14, 0.8, paint, 0, 0.84, 1.95);            // trunk slope

  // Grille + headlights (front is -z).
  box(1.1, 0.2, 0.08, darkMat(0x0a0a0c, 0.4), 0, 0.62, -2.32);
  box(1.14, 0.05, 0.06, chrome, 0, 0.74, -2.33);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff2c0, emissiveIntensity: 2.4 });
  box(0.42, 0.16, 0.08, headMat, -0.62, 0.72, -2.32);
  box(0.42, 0.16, 0.08, headMat, 0.62, 0.72, -2.32);
  // Front bumper + fog lights.
  box(1.94, 0.22, 0.22, darkMat(0x14161c, 0.5), 0, 0.42, -2.3);
  box(0.24, 0.1, 0.06, headMat, -0.7, 0.44, -2.4);
  box(0.24, 0.1, 0.06, headMat, 0.7, 0.44, -2.4);

  // Rear bumper, tail lights, spoiler, exhausts.
  box(1.94, 0.22, 0.22, darkMat(0x14161c, 0.5), 0, 0.42, 2.3);
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a2a, emissiveIntensity: 0.7 });
  const tailL = box(0.5, 0.14, 0.08, tailMat, -0.6, 0.74, 2.32);
  const tailR = box(0.5, 0.14, 0.08, tailMat, 0.6, 0.74, 2.32);
  box(1.7, 0.07, 0.42, paintDark, 0, 1.02, 2.05);        // spoiler blade
  box(0.08, 0.18, 0.08, paintDark, -0.7, 0.92, 2.05);
  box(0.08, 0.18, 0.08, paintDark, 0.7, 0.92, 2.05);
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x8f96a2, roughness: 0.3, metalness: 1 });
  for (const ex of [-0.55, 0.55]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10), exhaustMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(ex, 0.36, 2.42);
    body.add(pipe);
  }
  // Mirrors.
  box(0.16, 0.1, 0.26, paint, -1.02, 1.0, -0.55);
  box(0.16, 0.1, 0.26, paint, 1.02, 1.0, -0.55);
  // Side skirts + door seams.
  box(0.04, 0.3, 3.4, paintDark, -0.96, 0.5, 0.1);
  box(0.04, 0.3, 3.4, paintDark, 0.96, 0.5, 0.1);

  // Wheels.
  const wheels = [];
  for (const [wx, wz] of [[-0.85, -1.5], [0.85, -1.5], [-0.85, 1.5], [0.85, 1.5]]) {
    const wheel = new THREE.Group();
    const tyreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18), tyre);
    tyreMesh.rotation.z = Math.PI / 2;
    tyreMesh.castShadow = true;
    wheel.add(tyreMesh);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 12), rim);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push({ group: wheel, front: wz < 0 });
  }

  // Headlight cones (volumetric look) + real spotlights.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0.07,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cones = [];
  for (const cx of [-0.62, 0.62]) {
    // Apex at the headlight, widening forward and slightly down.
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.35, 9.5, 16, 1, true), coneMat);
    cone.rotation.x = Math.PI / 2 - 0.08;
    cone.position.set(cx, 0.55, -7.0);
    body.add(cone);
    cones.push(cone);
    const spot = new THREE.SpotLight(0xffe6a0, 55, 30, 0.42, 0.55, 1.6);
    spot.position.set(cx, 0.7, -2.3);
    const tgt = new THREE.Object3D();
    tgt.position.set(cx * 1.4, 0, -14);
    body.add(tgt);
    spot.target = tgt;
    body.add(spot);
  }
  // Brake glow light.
  const brakeLight = new THREE.PointLight(0xff2020, 0, 9, 1.8);
  brakeLight.position.set(0, 0.9, 2.6);
  body.add(brakeLight);
  // Reverse light (white).
  const reverseMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 0 });
  box(0.34, 0.1, 0.06, reverseMat, 0, 0.74, 2.33);

  scene.add(group);

  const state = {
    pos: new THREE.Vector3(0, 0, 90),
    heading: Math.PI,           // facing -z (north)
    speed: 0,                   // m/s, signed
    steer: 0,
    gear: 1,
    damage: 0,
    rpm: 0,
    slipping: 0,
    reversing: false,
    braking: false,
    wheelSpin: 0,
  };

  function gearFor(speedAbs) {
    for (let i = 0; i < GEARS.length; i++) if (speedAbs <= GEARS[i].top) return i + 1;
    return 5;
  }

  return {
    group,
    state,
    reset(x, z, heading) {
      state.pos.set(x, 0, z);
      state.heading = heading;
      state.speed = 0;
      state.steer = 0;
      state.gear = 1;
      state.rpm = 0;
      state.slipping = 0;
      state.damage = 0;
    },
    setSpeedKmh(kmh, gear) {
      state.speed = kmh / 3.6;
      state.gear = gear || gearFor(Math.abs(state.speed));
    },
    update(dt, input, colliders, onCollide) {
      const s = state;
      const speedAbs = Math.abs(s.speed);
      const health = 1 - s.damage * 0.55;   // damage hurts handling
      s.gear = gearFor(speedAbs);
      const gear = GEARS[s.gear - 1];
      // Torque curve: strong low in the gear, fading near its top.
      const inGear = Math.min(1, speedAbs / gear.top);
      const torque = (1 - inGear * 0.72) * gear.ratio;
      const accel = 9.5 * torque * health;

      s.braking = false;
      s.reversing = false;
      if (input.up) s.speed += accel * dt;
      if (input.down) {
        if (s.speed > 0.5) { s.speed -= 16 * dt; s.braking = true; }
        else { s.speed -= 6 * dt; s.reversing = true; }
      }
      if (input.brake) { s.speed -= Math.sign(s.speed) * 22 * dt; s.braking = true; if (Math.abs(s.speed) < 0.4) s.speed = 0; }
      if (!input.up && !input.down) {
        s.speed -= Math.sign(s.speed) * Math.min(Math.abs(s.speed), 4.5 * dt);
      }
      if (input.handbrake) {
        s.speed -= Math.sign(s.speed) * Math.min(Math.abs(s.speed), 14 * dt);
        s.slipping = Math.min(1, s.slipping + dt * 3);
      } else {
        s.slipping = Math.max(0, s.slipping - dt * 2);
      }
      s.speed = Math.max(-12, Math.min(TOP_SPEED * health, s.speed));

      // Steering weights up with speed; handbrake lets the tail step out.
      const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      const steerAuthority = 0.62 / (1 + speedAbs * 0.055) * (input.handbrake ? 1.5 : 1);
      s.steer += (steerTarget * steerAuthority - s.steer) * Math.min(1, dt * 9);
      const yawRate = s.steer * 1.9 * Math.min(1, speedAbs / 6) * (s.speed >= 0 ? 1 : -1);
      s.heading += yawRate * dt * (1 + s.slipping * 0.7);

      const nx = s.pos.x + Math.sin(s.heading) * s.speed * dt;
      const nz = s.pos.z + Math.cos(s.heading) * s.speed * dt;
      // NOTE: heading 0 faces +z; forward vector is (sin h, cos h).
      // Collisions against building AABBs (circle vs box).
      let hit = null;
      const r = 1.7;
      for (const c of colliders) {
        const cx = Math.max(c.minX, Math.min(nx, c.maxX));
        const cz = Math.max(c.minZ, Math.min(nz, c.maxZ));
        const dx = nx - cx, dz = nz - cz;
        if (dx * dx + dz * dz < r * r) { hit = { x: cx, z: cz }; break; }
      }
      if (hit) {
        const dx = nx - hit.x, dz = nz - hit.z;
        const d = Math.hypot(dx, dz) || 0.001;
        const push = (r - d);
        s.pos.x = nx + (dx / d) * push;
        s.pos.z = nz + (dz / d) * push;
        if (speedAbs > 4 && onCollide) onCollide(s.pos.clone(), speedAbs);
        s.speed *= 0.45;
      } else {
        s.pos.x = nx;
        s.pos.z = nz;
      }
      // Keep the car out of the sea and inside the city.
      if (s.pos.x > 161) { s.pos.x = 161; s.speed *= 0.5; }
      if (s.pos.x < -196) { s.pos.x = -196; s.speed *= 0.5; }
      if (s.pos.z > 196) { s.pos.z = 196; s.speed *= 0.5; }
      if (s.pos.z < -196) { s.pos.z = -196; s.speed *= 0.5; }

      // RPM from position inside the gear band.
      const prevTop = s.gear > 1 ? GEARS[s.gear - 2].top : 0;
      const band = (speedAbs - prevTop) / Math.max(1, gear.top - prevTop);
      s.rpm = 0.25 + Math.max(0, Math.min(1, band)) * 0.75;

      // Pose: body roll from steering, dive under braking, squat on throttle.
      const latG = yawRate * speedAbs * 0.02;
      const longG = (input.up ? -1 : 0) + (s.braking ? 1 : 0);
      body.rotation.z = -s.steer * 0.05 - latG * 0.35 - s.slipping * s.steer * 0.12;
      body.rotation.x = -longG * 0.028 + (s.speed > 0 && input.up ? 0.02 : 0);
      body.position.y = Math.sin(performance.now() * 0.02) * 0.004 * Math.min(1, speedAbs / 20);

      // Wheels: spin + front steer.
      s.wheelSpin += s.speed * dt * 2.4;
      for (const w of wheels) {
        w.group.rotation.y = w.front ? s.steer * 0.55 : 0;
        w.group.children[0].rotation.x = s.wheelSpin;
        w.group.children[1].rotation.x = s.wheelSpin;
      }

      // Lights: brake bright, reverse white, cones fade with speed.
      const brakeI = s.braking ? 2.6 : 0.7;
      tailMat.emissiveIntensity = brakeI;
      tailL.material = tailMat; tailR.material = tailMat;
      brakeLight.intensity = s.braking ? 7 : 0;
      reverseMat.emissiveIntensity = s.reversing ? 2.2 : 0;
      coneMat.opacity = 0.06 + Math.min(0.03, speedAbs * 0.0008);

      group.position.copy(s.pos);
      group.rotation.y = s.heading + Math.PI; // model front is -z
      return s;
    },
  };
}
