// Marina Nights — the player's car. Arcade driving with a realistic feel:
// torque falls off near top speed, steering gets heavier as speed rises,
// the body rolls into corners and dives under braking, brake lights flare,
// and a damaged car wobbles and loses steering. Third-person chase camera.
// Headlights for the night. Collides with buildings (AABB) and the world bounds.
const THREE = window.THREE;

export const MAX_SPEED = 36; // m/s ≈ 130 km/h

function makeCarMesh(bodyColor) {
  const g = new THREE.Group();
  // Inner body group: roll/pitch are applied here so the wheels and the
  // light cone (children of the outer group) stay planted.
  const bodyG = new THREE.Group();
  g.add(bodyG);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor, roughness: 0.28, metalness: 0.7,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.3), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  bodyG.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.1),
    new THREE.MeshStandardMaterial({ color: 0x0d1522, roughness: 0.12, metalness: 0.85 }));
  cabin.position.set(0, 1.05, -0.25);
  cabin.castShadow = true;
  bodyG.add(cabin);
  // window trim: a slightly larger, darker glass band under the cabin roof
  const glassBand = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.22, 2.14),
    new THREE.MeshStandardMaterial({ color: 0x1c2f47, roughness: 0.05, metalness: 0.9 }));
  glassBand.position.set(0, 0.98, -0.25);
  bodyG.add(glassBand);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.12, 4.32),
    new THREE.MeshBasicMaterial({ color: 0xffd54a }));
  stripe.position.y = 0.72;
  bodyG.add(stripe);
  // front grille + bumper, rear spoiler, side mirrors, exhausts
  const darkTrim = new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 0.5, metalness: 0.4 });
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 0.08), darkTrim);
  grille.position.set(0, 0.5, 2.16);
  bodyG.add(grille);
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.22, 0.18), darkTrim);
  bumperF.position.set(0, 0.32, 2.14);
  bodyG.add(bumperF);
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.22, 0.18), darkTrim);
  bumperR.position.set(0, 0.32, -2.14);
  bodyG.add(bumperR);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.4), darkTrim);
  spoiler.position.set(0, 1.02, -2.05);
  bodyG.add(spoiler);
  for (const sx of [-1.02, 1.02]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.28), darkTrim);
    mirror.position.set(sx, 0.95, 0.75);
    bodyG.add(mirror);
  }
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x8a97a8, roughness: 0.3, metalness: 0.9 });
  for (const sx of [-0.5, 0.5]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 8), exhaustMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(sx, 0.3, -2.2);
    bodyG.add(pipe);
  }
  // headlights (front, +z is forward) and taillights. tailMat is a real
  // emissive material so braking can flare it (shared by police/traffic).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const sx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    h.position.set(sx, 0.62, 2.17);
    bodyG.add(h);
  }
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x550000, emissive: 0xff2244, emissiveIntensity: 1.1,
    roughness: 0.4, metalness: 0.2,
  });
  for (const sx of [-0.65, 0.65]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    t.position.set(sx, 0.62, -2.17);
    bodyG.add(t);
  }
  // reverse lights (white, only lit while reversing)
  const reverseMat = new THREE.MeshStandardMaterial({
    color: 0x222222, emissive: 0xffffff, emissiveIntensity: 0.05,
    roughness: 0.4, metalness: 0.2,
  });
  for (const sx of [-0.28, 0.28]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.06), reverseMat);
    r.position.set(sx, 0.62, -2.18);
    bodyG.add(r);
  }
  // wheels with hubcaps
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0d12 });
  const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.32, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, roughness: 0.25, metalness: 0.9 });
  const wheels = [];
  const frontWheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.castShadow = true;
    pivot.add(w);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    pivot.add(hub);
    g.add(pivot);
    wheels.push(w);
    if (wz > 0) frontWheels.push(pivot);
  }
  return { group: g, body: bodyG, wheels, frontWheels, tailMat, headMat, reverseMat };
}

export function createPlayer(scene, city) {
  const { group, body, wheels, frontWheels, tailMat, reverseMat } = makeCarMesh(0xff2d55);
  scene.add(group);
  // headlight beam
  const beam = new THREE.SpotLight(0xfff2bf, 120, 60, 0.55, 0.45, 1.4);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(0, 0, 14);
  group.add(beamTarget);
  beam.target = beamTarget;
  beam.position.set(0, 1.1, 2.0);
  group.add(beam);
  // faint volumetric shaft so the headlights read in the night haze
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2bf, transparent: true, opacity: 0.045,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 3.4, 15, 12, 1, true), coneMat);
  cone.rotation.x = Math.PI / 2;
  cone.position.set(0, 0.9, 9.5);
  group.add(cone);

  const state = {
    pos: new THREE.Vector3(0, 0, -120),
    heading: 0, // 0 = facing +z ; forward = (sin h, 0, cos h)
    speed: 0,
    steer: 0, // smoothed steering input -1..1
    braking: false,
    handicap: 0, // 0..1 set by combat: damage degrades handling
    time: 0,
    group,
    beam,
  };

  function forward() {
    return { x: Math.sin(state.heading), z: Math.cos(state.heading) };
  }

  function collides(x, z) {
    const r = 1.35;
    for (const b of city.buildings) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    }
    return false;
  }

  // Returns impact speed (0 when no collision) so combat can apply damage.
  function update(dt, input) {
    let impact = 0;
    state.time += dt;
    // Smooth the steering wheel: the car turns the wheel, not the input.
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    state.steer += (steerTarget - state.steer) * Math.min(1, dt * 7);
    state.braking = !!input.brake;

    // Torque curve: strong pull off the line, fading as speed rises — like
    // a real gearbox, instead of the old flat 18 m/s^2 everywhere.
    const speedRatio = Math.max(0, state.speed) / MAX_SPEED;
    const accel = input.forward ? 20 * (1 - speedRatio * 0.55) : 0;
    const braking = input.brake ? 38 : 0;
    const reversing = input.back ? 10 : 0;
    if (input.forward) state.speed += accel * dt;
    if (input.back) state.speed -= reversing * dt;
    if (input.brake) {
      state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), braking * dt);
    }
    // drag + rolling resistance (light enough that the car can reach its
    // 36 m/s top speed: terminal velocity 15/0.25 = 60 m/s, capped at 36)
    state.speed -= state.speed * 0.25 * dt;
    if (!input.forward && !input.back) state.speed -= state.speed * 0.35 * dt;
    state.speed = Math.max(-9, Math.min(MAX_SPEED, state.speed));

    // Steering: full lock only at low speed, heavier and calmer at 130 km/h;
    // damage makes the car wander and answer late.
    const steerAuthority = Math.min(1, Math.abs(state.speed) / 8)
      * (1 - Math.abs(state.speed) / MAX_SPEED * 0.45)
      * (1 - 0.35 * state.handicap);
    const steerRate = 2.3 * steerAuthority * (state.speed >= 0 ? 1 : -1);
    state.heading += steerRate * state.steer * dt;
    if (state.handicap > 0.05 && Math.abs(state.speed) > 5) {
      state.heading += Math.sin(state.time * 11) * 0.12 * state.handicap
        * (Math.abs(state.speed) / MAX_SPEED) * dt;
    }

    const f = forward();
    const nx = state.pos.x + f.x * state.speed * dt;
    const nz = state.pos.z + f.z * state.speed * dt;
    // axis-separated collision so the car slides along walls
    const cx = Math.max(-197, Math.min(198.5, nx));
    const cz = Math.max(-197, Math.min(197, nz));
    if (!collides(cx, state.pos.z)) state.pos.x = cx;
    else if (Math.abs(state.speed) > 10) { impact = Math.abs(state.speed); state.speed *= -0.25; }
    if (!collides(state.pos.x, cz)) state.pos.z = cz;
    else if (Math.abs(state.speed) > 10) { impact = Math.max(impact, Math.abs(state.speed)); state.speed *= -0.25; }

    group.position.copy(state.pos);
    group.rotation.y = state.heading;
    // Body language: lean into the corner, dive under braking, squat on
    // launch, and breathe a little on the suspension over bumps.
    const lean = -state.steer * Math.min(1, Math.abs(state.speed) / 20) * 0.055;
    const dive = (input.brake ? 0.03 : 0) - (input.forward && state.speed < 8 ? 0.02 : 0);
    body.rotation.z += (lean - body.rotation.z) * Math.min(1, dt * 8);
    body.rotation.x += (dive - body.rotation.x) * Math.min(1, dt * 8);
    body.position.y = Math.sin(state.time * 9) * 0.012 * Math.min(1, Math.abs(state.speed) / 20);
    // Front wheels steer with the wheel; all wheels spin with road speed.
    for (const fw of frontWheels) fw.rotation.y = state.steer * 0.42;
    const spin = state.speed * dt * 2.8;
    for (const w of wheels) w.rotation.x += spin;
    // Brake lights flare when braking; reverse lights when backing up.
    tailMat.emissiveIntensity = state.braking ? 2.4 : 1.1;
    reverseMat.emissiveIntensity = state.speed < -0.5 ? 1.6 : 0.05;
    return impact;
  }

  function reset(x, z, heading) {
    state.pos.set(x, 0, z);
    state.heading = heading === undefined ? 0 : heading;
    state.speed = 0;
    state.steer = 0;
    state.handicap = 0;
    group.position.copy(state.pos);
    group.rotation.y = state.heading;
    body.rotation.set(0, 0, 0);
  }

  return {
    state, update, reset, forward,
    get pos() { return state.pos; },
    get heading() { return state.heading; },
    get speed() { return state.speed; },
    set speed(v) { state.speed = v; },
    get steer() { return state.steer; },
    get braking() { return state.braking; },
    set handicap(v) { state.handicap = Math.max(0, Math.min(1, v)); },
  };
}

export { makeCarMesh };
