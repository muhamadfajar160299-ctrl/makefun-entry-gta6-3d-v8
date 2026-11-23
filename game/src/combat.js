// combat.js — sparks, smoke, and the cost of driving badly.
//
// One shared particle pool (no allocation in the hot loop): sparks are
// additive orange points with gravity, smoke is soft grey sprites that
// rise and fade. Collisions between the hero and traffic / police push
// both cars apart, add damage, and shake the camera.
const THREE = window.THREE;

const MAX_PARTICLES = 420;

export function createCombat(scene) {
  const pos = new Float32Array(MAX_PARTICLES * 3);
  const col = new Float32Array(MAX_PARTICLES * 3);
  const vel = new Float32Array(MAX_PARTICLES * 3);
  const life = new Float32Array(MAX_PARTICLES);
  const maxLife = new Float32Array(MAX_PARTICLES);
  const size = new Float32Array(MAX_PARTICLES);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.55, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  // Park dead particles far underground.
  for (let i = 0; i < MAX_PARTICLES; i++) pos[i * 3 + 1] = -100;

  let cursor = 0;
  const combat = {
    spawn(x, y, z, vx, vy, vz, r, g, b, ttl) {
      const i = cursor;
      cursor = (cursor + 1) % MAX_PARTICLES;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
      life[i] = ttl;
      maxLife[i] = ttl;
    },
    sparks(x, y, z, n = 16) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 3 + Math.random() * 7;
        this.spawn(
          x, y, z,
          Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp,
          1, 0.55 + Math.random() * 0.3, 0.1, 0.5 + Math.random() * 0.4,
        );
      }
    },
    smoke(x, y, z, n = 6) {
      for (let i = 0; i < n; i++) {
        this.spawn(
          x + (Math.random() - 0.5), y + Math.random() * 0.4, z + (Math.random() - 0.5),
          (Math.random() - 0.5) * 0.8, 1.2 + Math.random(), (Math.random() - 0.5) * 0.8,
          0.45, 0.45, 0.5, 1.4 + Math.random() * 0.8,
        );
      }
    },
    update(dt) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) { pos[i * 3 + 1] = -100; continue; }
        vel[i * 3 + 1] -= 6 * dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const f = life[i] / maxLife[i];
        col[i * 3] *= 0.985;
        col[i * 3 + 1] *= 0.985;
        col[i * 3 + 2] *= 0.985;
        void f;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    // Hero vs traffic / police: circle test, push apart, damage, sparks.
    checkCarCollisions(game) {
      const p = game.player;
      const hit = (ox, oz, other) => {
        const dx = p.x - ox;
        const dz = p.z - oz;
        const d = Math.hypot(dx, dz);
        const min = 3.4;
        if (d < min && d > 0.001) {
          const push = (min - d) / 2;
          p.x += (dx / d) * push;
          p.z += (dz / d) * push;
          if (other) {
            other.x -= (dx / d) * push;
            other.z -= (dz / d) * push;
          }
          const impact = Math.abs(p.speed);
          if (impact > 3) {
            p.damage = Math.min(100, p.damage + impact * 0.4);
            this.sparks((p.x + ox) / 2, 0.9, (p.z + oz) / 2, 12);
            game.shake = Math.min(1, game.shake + 0.35);
            game.audio.thud(Math.min(1, impact / 28));
          }
          p.speed *= 0.55;
          return true;
        }
        return false;
      };
      for (const c of game.traffic) hit(c.x, c.z, c);
      for (const c of game.police) if (c.active) hit(c.x, c.z, c);
    },
    // Damage smoke: a battered engine smokes.
    damageSmoke(game, dt) {
      const p = game.player;
      if (p.damage > 50 && Math.random() < dt * 6) {
        const fx = Math.sin(p.heading);
        const fz = -Math.cos(p.heading);
        this.smoke(p.x + fx * 2, 1.1, p.z + fz * 2, 1);
      }
    },
  };
  return combat;
}
