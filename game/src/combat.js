// Marina Nights — collisions & damage. Hard hits damage the car (shown on
// the HUD damage bar) and throw a burst of sparks; at 100 damage the car is
// "wasted". Heavy damage makes the car smoke and handle worse (the handicap
// is fed back into the player). Pedestrians are never harmed: they dodge
// and the car just passes.
const THREE = window.THREE;

export function createCombat(G) {
  const REPAIR_RATE = 0.6; // damage slowly recovers while driving clean
  const scene = G.scene;
  const bursts = []; // {points, vel, life}
  let smokeTimer = 0;

  function spawnBurst(pos, count, color, speed, up, life, size) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      p[i * 3] = pos.x;
      p[i * 3 + 1] = pos.y + 0.6;
      p[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const r = (0.4 + Math.random() * 0.6) * speed;
      vel.push(new THREE.Vector3(Math.cos(a) * r, up * (0.5 + Math.random()), Math.sin(a) * r));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 1, depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    bursts.push({ points, vel, life, maxLife: life });
  }

  function updateBursts(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      const attr = b.points.geometry.getAttribute('position');
      for (let j = 0; j < b.vel.length; j++) {
        b.vel[j].y -= 9 * dt; // gravity
        attr.array[j * 3] += b.vel[j].x * dt;
        attr.array[j * 3 + 1] = Math.max(0.05, attr.array[j * 3 + 1] + b.vel[j].y * dt);
        attr.array[j * 3 + 2] += b.vel[j].z * dt;
      }
      attr.needsUpdate = true;
      b.points.material.opacity = Math.max(0, b.life / b.maxLife);
      if (b.life <= 0) {
        scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        bursts.splice(i, 1);
      }
    }
  }

  function addDamage(amount) {
    if (G.state.over || !G.state.started) return;
    G.state.damage = Math.min(100, G.state.damage + amount);
    G.hud.setDamage(G.state.damage);
    if (amount > 4) G.audio.crash();
    if (G.state.damage >= 100) {
      G.state.over = true;
      G.state.overKind = 'wasted';
      G.audio.busted();
      G.hud.showScreen('wasted');
    }
  }

  function update(dt) {
    updateBursts(dt);
    if (G.state.over || !G.state.started || G.state.paused) return;
    // slow self-repair
    if (G.state.damage > 0) {
      G.state.damage = Math.max(0, G.state.damage - REPAIR_RATE * dt);
      G.hud.setDamage(G.state.damage);
    }
    // damage feeds back into handling: over 50 the car wanders and steers
    // late; over 65 it smokes from the hood.
    G.player.handicap = G.state.damage > 50 ? (G.state.damage - 50) / 50 : 0;
    if (G.state.damage > 65) {
      smokeTimer -= dt;
      if (smokeTimer <= 0) {
        smokeTimer = 0.12;
        const f = G.player.forward();
        spawnBurst(
          { x: G.player.pos.x + f.x * 1.6, y: 0.9, z: G.player.pos.z + f.z * 1.6 },
          3, 0x8a97a8, 0.5, 1.6, 0.9, 1.4
        );
      }
    }
    const p = G.player.pos;
    // traffic collisions: bump apart + damage by impact speed
    for (const car of G.traffic.cars) {
      const dx = p.x - car.group.position.x;
      const dz = p.z - car.group.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 10.2 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (3.2 - d) / 2;
        const nx = dx / d, nz = dz / d;
        p.x += nx * push;
        p.z += nz * push;
        const impact = Math.abs(G.player.speed) + car.speed;
        if (impact > 14) {
          addDamage((impact - 14) * 0.55);
          if (impact > 20) {
            spawnBurst(p, 22, 0xffc93d, 6, 3, 0.5, 0.5);
            if (G.shake) G.shake(0.35);
          }
        }
      }
    }
    // police contact: shove, small damage, bust handled in police.js
    for (const car of G.police.cars) {
      const dx = p.x - car.pos.x;
      const dz = p.z - car.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 10.2 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (3.2 - d) / 2;
        p.x += (dx / d) * push;
        p.z += (dz / d) * push;
        if (Math.abs(G.player.speed) > 12) {
          addDamage(2);
          if (Math.abs(G.player.speed) > 22 && G.shake) G.shake(0.25);
        }
      }
    }
    // pedestrians dodge — never harmed
    G.peds.dodge(p);
  }

  return { update, addDamage, spawnBurst };
}
