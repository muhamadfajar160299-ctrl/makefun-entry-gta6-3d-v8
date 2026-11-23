// Marina Nights — 5 sequential missions. Each has a name, briefing,
// world target (gold beacon + minimap dot) and a cash reward. Progress is
// saved to localStorage. Completing a mission pays out, clears wanted and
// opens the win screen via showScreen('win') — by KEY, never by DOM id.
const THREE = window.THREE;
const SAVE_KEY = 'marina-nights-save-v1';

export const MISSIONS = [
  {
    name: 'Marina Pickup',
    desc: 'Drive to the marina promenade and pick up the package.',
    target: { x: 194, z: 0 }, reward: 400, wanted: 0,
  },
  {
    name: 'Downtown Drop',
    desc: 'Deliver the package to the downtown tower on the west side.',
    target: { x: -160, z: 80 }, reward: 600, wanted: 0,
  },
  {
    name: 'Harbor Escape',
    desc: 'The cops are onto you. Lose the heat and reach the north docks.',
    target: { x: 80, z: -160 }, reward: 800, wanted: 2,
  },
  {
    name: 'Night Courier',
    desc: 'Cross town to the south-east corner. Fast, quiet, no mistakes.',
    target: { x: 160, z: 160 }, reward: 1000, wanted: 1,
  },
  {
    name: 'Velmaras Grand Finale',
    desc: 'One last run: the whole department is after you. Reach the marina.',
    target: { x: 194, z: -120 }, reward: 1500, wanted: 3,
  },
];

export function createMissions(scene, G) {
  let saved = { mission: 0, money: 0 };
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.mission === 'number') saved.mission = Math.max(0, Math.min(4, p.mission));
      if (typeof p.money === 'number') saved.money = Math.max(0, p.money);
    }
  } catch (e) { /* storage unavailable: start fresh */ }

  let index = saved.mission;
  G.state.money = saved.money;

  // gold beacon at the active target
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd54a, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 46, 20, 1, true), beaconMat);
  beacon.position.y = 23;
  scene.add(beacon);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 5.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  scene.add(ring);
  const beaconLight = new THREE.PointLight(0xffd54a, 30, 42, 1.8);
  beaconLight.position.y = 6;
  scene.add(beaconLight);

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({ mission: index, money: G.state.money }));
    } catch (e) {}
  }

  function current() { return MISSIONS[index]; }

  function placeBeacon() {
    const t = current().target;
    beacon.position.x = t.x;
    beacon.position.z = t.z;
    ring.position.x = t.x;
    ring.position.z = t.z;
    beaconLight.position.x = t.x;
    beaconLight.position.z = t.z;
  }

  function start(i) {
    index = Math.max(0, Math.min(MISSIONS.length - 1, i));
    const m = current();
    G.hud.setObjective('MISSION ' + (index + 1) + ' — ' + m.name.toUpperCase(), m.desc);
    G.setWanted(m.wanted || 0);
    placeBeacon();
    save();
  }

  function complete() {
    const m = current();
    G.state.money += m.reward;
    G.setWanted(0);
    G.audio.pickup();
    G.audio.win();
    G.hud.setMoney(G.state.money);
    const last = index >= MISSIONS.length - 1;
    if (!last) index += 1;
    G.state.completedMissions = (G.state.completedMissions || 0) + 1;
    save();
    // Win screen by KEY 'win' (hud maps keys to elements).
    G.hud.setWinText(m.name, m.reward, last);
    G.state.missionComplete = true;
    G.hud.showScreen('win');
    if (!last) {
      // prime the next mission so CONTINUE drops the player straight in
      G.pendingNext = true;
    } else {
      G.state.allComplete = true;
    }
  }

  function next() {
    G.state.missionComplete = false;
    start(index);
    G.player.reset(0, -120, 0);
  }

  function update(dt, t) {
    beaconMat.opacity = 0.35 + Math.sin(t * 3) * 0.15;
    const s = 1 + Math.sin(t * 3) * 0.12;
    ring.scale.set(s, s, 1);
    if (!G.state.started || G.state.paused || G.state.over || G.state.missionComplete) return;
    const m = current();
    const dx = G.player.pos.x - m.target.x;
    const dz = G.player.pos.z - m.target.z;
    if (dx * dx + dz * dz < 64) complete();
  }

  placeBeacon();
  return { current, start, complete, next, update, get index() { return index; } };
}
