// combat.js — impact feedback: spark bursts and smoke puffs from a pooled
// particle system, plus the camera shake that sells every hit.
const THREE = window.THREE;

const SPARKS = 240;
const SMOKE = 60;

export function createCombat(scene) {
  // Sparks: additive points with per-particle velocity + life.
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkCol = new Float32Array(SPARKS * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparkMat = new THREE.PointsMaterial({
    size: 0.55, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const sparkPts = new THREE.Points(sparkGeo, sparkMat);
  sparkPts.frustumCulled = false;
  scene.add(sparkPts);
  const sparks = [];
  for (let i = 0; i < SPARKS; i++) {
    sparks.push({ life: 0, vx: 0, vy: 0, vz: 0 });
    sparkPos[i * 3 + 1] = -100;
  }

  // Smoke: soft grey sprites that rise, expand and fade.
  const smokeTexC = document.createElement('canvas');
  smokeTexC.width = 64; smokeTexC.height = 64;
  const sg = smokeTexC.getContext('2d');
  const grad = sg.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(200,200,205,0.55)');
  grad.addColorStop(1, 'rgba(200,200,205,0)');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 64, 64);
  const smokeTex = new THREE.CanvasTexture(smokeTexC);
  const smokePool = [];
  for (let i = 0; i < SMOKE; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, transparent: true, opacity: 0, depthWrite: false,
    }));
    spr.position.y = -100;
    scene.add(spr);
    smokePool.push({ spr, life: 0, max: 1, vy: 0, grow: 0 });
  }

  let shakeAmp = 0;
  let shakeT = 0;

  return {
    get shake() { return shakeAmp; },
    burst(pos, strength) {
      // Sparks.
      let spawned = 0;
      for (let i = 0; i < SPARKS && spawned < 26; i++) {
        if (sparks[i].life > 0) continue;
        spawned++;
        sparks[i].life = 0.35 + Math.random() * 0.35;
        const a = Math.random() * Math.PI * 2;
        const up = 2 + Math.random() * 6;
        const out = 2 + Math.random() * 7 * strength;
        sparks[i].vx = Math.cos(a) * out;
        sparks[i].vy = up;
        sparks[i].vz = Math.sin(a) * out;
        sparkPos[i * 3] = pos.x;
        sparkPos[i * 3 + 1] = pos.y + 0.5;
        sparkPos[i * 3 + 2] = pos.z;
        sparkCol[i * 3] = 1;
        sparkCol[i * 3 + 1] = 0.72 + Math.random() * 0.2;
        sparkCol[i * 3 + 2] = 0.25;
      }
      // Smoke.
      for (let i = 0; i < SMOKE; i++) {
        if (smokePool[i].life > 0) continue;
        smokePool[i].life = smokePool[i].max = 1.1 + Math.random() * 0.9;
        smokePool[i].vy = 1.2 + Math.random() * 1.4;
        smokePool[i].grow = 2.2 + Math.random() * 1.6;
        smokePool[i].spr.position.set(pos.x + (Math.random() - 0.5) * 1.5, pos.y + 0.8, pos.z + (Math.random() - 0.5) * 1.5);
        smokePool[i].spr.scale.set(1.4, 1.4, 1);
        break;
      }
      shakeAmp = Math.min(1, shakeAmp + 0.55 * strength);
      shakeT = 0;
    },
    update(dt) {
      for (let i = 0; i < SPARKS; i++) {
        const s = sparks[i];
        if (s.life <= 0) continue;
        s.life -= dt;
        s.vy -= 14 * dt;
        sparkPos[i * 3] += s.vx * dt;
        sparkPos[i * 3 + 1] += s.vy * dt;
        sparkPos[i * 3 + 2] += s.vz * dt;
        if (sparkPos[i * 3 + 1] < 0.05) { sparkPos[i * 3 + 1] = 0.05; s.vy *= -0.4; }
        if (s.life <= 0) sparkPos[i * 3 + 1] = -100;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
      for (const p of smokePool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.spr.position.y += p.vy * dt;
        const k = 1 + (1 - p.life / p.max) * p.grow;
        p.spr.scale.set(1.4 * k, 1.4 * k, 1);
        p.spr.material.opacity = Math.max(0, (p.life / p.max) * 0.5);
        if (p.life <= 0) p.spr.position.y = -100;
      }
      shakeT += dt;
      shakeAmp = Math.max(0, shakeAmp - dt * 2.2);
    },
    shakeOffset() {
      if (shakeAmp <= 0.01) return { x: 0, y: 0 };
      const a = shakeAmp * 0.35;
      return {
        x: (Math.random() - 0.5) * a,
        y: (Math.random() - 0.5) * a,
      };
    },
  };
}
