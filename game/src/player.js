// Marina Nights — the player's car. Arcade driving: accelerate, brake,
// steer; speed shown in km/h. Third-person chase camera. Headlights for
// the night. Collides with buildings (AABB) and the world bounds.
const THREE = window.THREE;

export const MAX_SPEED = 36; // m/s ≈ 130 km/h

function makeCarMesh(bodyColor) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor, roughness: 0.32, metalness: 0.65,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.3), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.1),
    new THREE.MeshStandardMaterial({ color: 0x0d1522, roughness: 0.15, metalness: 0.8 }));
  cabin.position.set(0, 1.05, -0.25);
  g.add(cabin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.12, 4.32),
    new THREE.MeshBasicMaterial({ color: 0xffd54a }));
  stripe.position.y = 0.72;
  g.add(stripe);
  // headlights (front, +z is forward) and taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const sx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), hl);
    h.position.set(sx, 0.62, 2.17);
    g.add(h);
  }
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2244 });
  for (const sx of [-0.65, 0.65]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tl);
    t.position.set(sx, 0.62, -2.17);
    g.add(t);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0d12 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  return { group: g, wheels };
}

export function createPlayer(scene, city) {
  const { group, wheels } = makeCarMesh(0xff2d55);
  scene.add(group);
  // headlight beam
  const beam = new THREE.SpotLight(0xfff2bf, 90, 55, 0.55, 0.45, 1.4);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(0, 0, 14);
  group.add(beamTarget);
  beam.target = beamTarget;
  beam.position.set(0, 1.1, 2.0);
  group.add(beam);

  const state = {
    pos: new THREE.Vector3(0, 0, -120),
    heading: 0, // 0 = facing +z ; forward = (sin h, 0, cos h)
    speed: 0,
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
    const accel = input.forward ? 18 : 0;
    const braking = input.brake ? 34 : 0;
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

    const steerAuthority = Math.min(1, Math.abs(state.speed) / 9);
    const steerRate = 2.0 * steerAuthority * (state.speed >= 0 ? 1 : -1);
    if (input.left) state.heading += steerRate * dt;
    if (input.right) state.heading -= steerRate * dt;

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
    const spin = state.speed * dt * 2.8;
    for (const w of wheels) w.rotation.x += spin;
    return impact;
  }

  function reset(x, z, heading) {
    state.pos.set(x, 0, z);
    state.heading = heading === undefined ? 0 : heading;
    state.speed = 0;
    group.position.copy(state.pos);
    group.rotation.y = state.heading;
  }

  return {
    state, update, reset, forward,
    get pos() { return state.pos; },
    get heading() { return state.heading; },
    get speed() { return state.speed; },
    set speed(v) { state.speed = v; },
  };
}

export { makeCarMesh };
