// missions.js — the Marina Nights story: five jobs for fixer Marco Vane.
// Each mission is a chain of steps (drive somewhere, lose the cops, deliver
// on time). Cash and progress save to localStorage.

const SAVE_KEY = 'velmara-save-v1';

const MISSIONS = [
  {
    id: 'pickup',
    title: '1 · MARINA PICKUP',
    brief: 'Marco Vane needs a package lifted from the promenade. Walk to the gold marker.',
    reward: 400,
    steps: [
      { kind: 'goto', x: 0, z: 176, r: 5, text: 'Pick up the package on the promenade' },
    ],
    done: 'Package secured. Marco says you drive like you were born in the bay.',
  },
  {
    id: 'getaway',
    title: '2 · THE GETAWAY',
    brief: 'The package is hot. Take the gold Vantara GT on the boulevard — then lose the VPD.',
    reward: 650,
    steps: [
      { kind: 'goto', x: -6, z: 150, r: 5, text: 'Get in the gold Vantara GT (press E)' },
      { kind: 'lose', text: 'Lose the cops — stay out of sight until the stars clear' },
    ],
    done: 'Clean. The VPD is still circling an empty boulevard.',
  },
  {
    id: 'delivery',
    title: '3 · NIGHT DELIVERY',
    brief: 'A buyer waits at the north-west corner of town. Ninety seconds. No excuses.',
    reward: 800,
    steps: [
      { kind: 'timed', x: -74, z: -148, r: 7, time: 90, text: 'Deliver the package to the north-west corner' },
    ],
    done: 'Delivered with time to spare. Word travels fast on this bay.',
  },
  {
    id: 'exchange',
    title: '4 · THE EXCHANGE',
    brief: 'Collect the briefcase at the casino front, then walk it down the pier to the yacht.',
    reward: 1200,
    steps: [
      { kind: 'goto', x: 74, z: 0, r: 6, text: 'Collect the briefcase at the casino front' },
      { kind: 'goto', x: 40, z: 222, r: 5, text: 'Deliver the briefcase to the yacht on pier 3' },
    ],
    done: 'The yacht sails at dawn with your name on the manifest — as crew, not cargo.',
  },
  {
    id: 'velvet',
    title: '5 · THE VELVET RUN',
    brief: 'The final job: three drops across the city, then home to the marina. Make it count.',
    reward: 2500,
    steps: [
      { kind: 'goto', x: -148, z: 0, r: 7, text: 'Drop 1 of 3 — west avenue' },
      { kind: 'goto', x: 0, z: -148, r: 7, text: 'Drop 2 of 3 — north avenue' },
      { kind: 'goto', x: 148, z: 74, r: 7, text: 'Drop 3 of 3 — east avenue' },
      { kind: 'goto', x: 0, z: 176, r: 6, text: 'Come home to the marina' },
    ],
    done: 'Every drop made. Velmara is yours.',
  },
];

function currentMission() {
  return MISSIONS[Math.min(G.missionIndex, MISSIONS.length - 1)];
}
function currentStep() {
  const m = currentMission();
  return m.steps[Math.min(G.missionStep, m.steps.length - 1)];
}
function missionFinished() {
  return G.missionIndex >= MISSIONS.length;
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: G.money, missionIndex: G.missionIndex,
    }));
  } catch (e) { /* private mode: progress just lives for the session */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.money === 'number') G.money = s.money;
    if (typeof s.missionIndex === 'number') {
      G.missionIndex = Math.max(0, Math.min(s.missionIndex, MISSIONS.length - 1));
    }
  } catch (e) { /* corrupted save: start fresh */ }
}

function startMission(index) {
  G.missionIndex = index;
  G.missionStep = 0;
  G.stepTimer = 0;
  const m = currentMission();
  const step = currentStep();
  if (step.kind === 'lose') {
    // the heat is already on when this step begins
    addCrime(2, 'The VPD is on you!');
  }
  if (step.kind === 'timed') G.stepTimer = step.time;
  placeBeacon(step);
  if (typeof updateMissionHud === 'function') updateMissionHud();
  saveGame();
}

function placeBeacon(step) {
  if (!G.objectiveBeacon) return;
  if (step.kind === 'lose') {
    G.objectiveBeacon.visible = false;
    return;
  }
  G.objectiveBeacon.visible = true;
  G.objectiveBeacon.position.set(step.x, 30, step.z);
  G.objectiveBeacon.userData.ring.position.set(step.x, 0.25, step.z);
  G.objectiveBeacon.userData.glow.position.set(step.x, 2, step.z);
}

function advanceStep() {
  const m = currentMission();
  G.missionStep++;
  if (G.missionStep >= m.steps.length) {
    completeMission(m);
    return;
  }
  const step = currentStep();
  if (step.kind === 'lose') addCrime(2, 'The VPD is on you!');
  if (step.kind === 'timed') G.stepTimer = step.time;
  placeBeacon(step);
  if (typeof updateMissionHud === 'function') updateMissionHud();
  if (typeof playChime === 'function') playChime();
}

function completeMission(m) {
  G.money += m.reward;
  saveGame();
  if (typeof updateMoneyHud === 'function') updateMoneyHud();
  if (typeof playChime === 'function') playChime();
  if (G.missionIndex >= MISSIONS.length - 1) {
    G.missionIndex = MISSIONS.length;   // story complete
    saveGame();
    if (typeof showScreen === 'function') showScreen('story');
    else G.mode = 'story';
    return;
  }
  if (typeof showScreen === 'function') showScreen('win', m);
  else G.mode = 'win';
}

function restartMission() {
  startMission(G.missionIndex);
}

function updateMissions(dt) {
  if (G.mode !== 'playing' || missionFinished()) return;
  const step = currentStep();
  const px = G.playerCar ? G.playerCar.mesh.position.x : G.player.mesh.position.x;
  const pz = G.playerCar ? G.playerCar.mesh.position.z : G.player.mesh.position.z;
  if (step.kind === 'goto' || step.kind === 'timed') {
    if (step.kind === 'timed') {
      G.stepTimer -= dt;
      if (G.stepTimer <= 0) {
        if (typeof showToast === 'function') showToast('Too slow — the buyer walked. Try again.');
        restartMission();
        return;
      }
    }
    const d = Math.hypot(px - step.x, pz - step.z);
    if (d < step.r) {
      if (typeof showToast === 'function') showToast('Objective reached');
      advanceStep();
    }
  } else if (step.kind === 'lose') {
    if (G.wanted <= 0) {
      if (typeof showToast === 'function') showToast('You lost them. Clean.');
      advanceStep();
    }
  }
}

function objectiveDistance() {
  if (missionFinished()) return 0;
  const step = currentStep();
  if (step.kind === 'lose' || step.x == null) return -1;
  const px = G.playerCar ? G.playerCar.mesh.position.x : G.player.mesh.position.x;
  const pz = G.playerCar ? G.playerCar.mesh.position.z : G.player.mesh.position.z;
  return Math.hypot(px - step.x, pz - step.z);
}
