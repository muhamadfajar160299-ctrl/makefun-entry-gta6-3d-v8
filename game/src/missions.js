// missions.js — five jobs across Velmara Bay. Each mission plants a floating
// gold diamond and a beam of light on its target, tracks live distance, and
// pays out on arrival. Completing one rolls straight into the next.
const THREE = window.THREE;

export const MISSION_LIST = [
  {
    id: 1, name: 'MARINA PICKUP', reward: 400,
    desc: 'Drive to the marina promenade and pick up the package.',
    target: { x: 150, z: -12 },
    done: 'Package secured. Clean getaway. The next job is already lined up.',
  },
  {
    id: 2, name: 'NORTH DOCK DROP', reward: 550,
    desc: 'Take the package to the north docks. No stops, no witnesses.',
    target: { x: 110, z: -165 },
    done: 'Drop made at the north docks. The fixer is pleased — for now.',
  },
  {
    id: 3, name: 'ROOFTOP MEET', reward: 700,
    desc: 'Meet the contact at the west plaza. The PD is watching that block.',
    target: { x: -165, z: 55 },
    done: 'The contact paid in full. Word travels fast on the bay.',
  },
  {
    id: 4, name: 'SOUTH PIER RUN', reward: 850,
    desc: 'Race the south pier before the tide turns. The buyer hates waiting.',
    target: { x: 110, z: 165 },
    done: 'Delivered with seconds to spare. The buyer paid a bonus for speed.',
  },
  {
    id: 5, name: 'THE BIG SCORE', reward: 1500,
    desc: 'One last run: the casino vault drop on the east strip. Bring it home.',
    target: { x: 0, z: 0 },
    done: 'The big score is yours. Velmara Bay is your city now.',
  },
];

export function createMissions(scene) {
  // Floating gold diamond.
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.5),
    new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xf6c945, emissiveIntensity: 2.6, roughness: 0.2, metalness: 0.8 }),
  );
  diamond.castShadow = false;
  scene.add(diamond);
  // Vertical beam of light marking the target from the sky.
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xf6c945, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 60, 16, 1, true), beamMat);
  beam.position.y = 30;
  scene.add(beam);
  // Ground ring at the target.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.0, 32),
    new THREE.MeshBasicMaterial({ color: 0xf6c945, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  scene.add(ring);

  let index = 0;
  let completed = false;
  let completeTimer = 0;

  function placeMarker(m) {
    diamond.position.set(m.target.x, 4.5, m.target.z);
    beam.position.set(m.target.x, 30, m.target.z);
    ring.position.set(m.target.x, 0.08, m.target.z);
    diamond.visible = true;
    beam.visible = true;
    ring.visible = true;
  }
  placeMarker(MISSION_LIST[0]);

  return {
    get current() { return MISSION_LIST[index]; },
    get index() { return index; },
    get isComplete() { return completed; },
    setIndex(i) {
      index = Math.max(0, Math.min(MISSION_LIST.length - 1, i));
      completed = false;
      completeTimer = 0;
      placeMarker(MISSION_LIST[index]);
    },
    distanceTo(playerPos) {
      const m = MISSION_LIST[index];
      return Math.hypot(m.target.x - playerPos.x, m.target.z - playerPos.z);
    },
    targetPos() {
      const m = MISSION_LIST[index];
      return { x: m.target.x, z: m.target.z };
    },
    update(dt, playerPos, t) {
      // Spin + bob the diamond; pulse the beam and ring.
      diamond.rotation.y = t * 1.6;
      diamond.position.y = 4.5 + Math.sin(t * 2.2) * 0.5;
      beamMat.opacity = 0.12 + Math.sin(t * 2.2) * 0.05;
      const pulse = 1 + Math.sin(t * 3) * 0.08;
      ring.scale.set(pulse, pulse, 1);
      if (completed) {
        completeTimer += dt;
        return null;
      }
      const d = this.distanceTo(playerPos);
      if (d < 7) {
        completed = true;
        completeTimer = 0;
        diamond.visible = false;
        beam.visible = false;
        ring.visible = false;
        return MISSION_LIST[index];
      }
      return null;
    },
    advance() {
      if (index < MISSION_LIST.length - 1) {
        index += 1;
        completed = false;
        completeTimer = 0;
        placeMarker(MISSION_LIST[index]);
        return MISSION_LIST[index];
      }
      // All five done: loop back to the first job, the city never sleeps.
      index = 0;
      completed = false;
      completeTimer = 0;
      placeMarker(MISSION_LIST[0]);
      return MISSION_LIST[0];
    },
    hideMarker() {
      diamond.visible = false;
      beam.visible = false;
      ring.visible = false;
    },
    showMarker() { placeMarker(MISSION_LIST[index]); },
  };
}
