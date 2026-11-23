// main.js — VELMARA: Marina Nights. Boots the renderer, wires every system,
// runs the game loop, the chase camera, collisions, wanted heat, saving,
// and the debug / screenshot API on window.__VELMARA__.
import { createLighting } from './lighting.js';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';
import { createTraffic } from './vehicles.js';
import { createPolice } from './police.js';
import { createPedestrians } from './pedestrians.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createCombat } from './combat.js';
import { createAudio } from './audio.js';
import { createShotDirector } from './shots.js';

const THREE = window.THREE;
const SAVE_KEY = 'velmara-save-v1';

const pageErrors = [];
window.addEventListener('error', (e) => pageErrors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => pageErrors.push(String(e.reason)));

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.cash !== 'number' || typeof s.mission !== 'number') return null;
    return { cash: Math.max(0, s.cash | 0), mission: Math.max(0, Math.min(4, s.mission | 0)) };
  } catch (e) { return null; }
}

function boot() {
  const app = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.className = 'webgl';
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 5, 78);

  const lighting = createLighting(scene, renderer);
  const city = buildCity(scene);
  const player = createPlayer(scene);
  const traffic = createTraffic(scene, city.roadLoops);
  const police = createPolice(scene);
  const pedestrians = createPedestrians(scene);
  const missions = createMissions(scene);
  const hud = createHud();
  const combat = createCombat(scene);
  const audio = createAudio();

  const save = loadSave();
  const state = {
    running: false,
    paused: false,
    completeOpen: false,
    cash: save ? save.cash : 0,
    clockH: 21, clockM: 36,
    clockAcc: 0,
    camMode: 0, // 0 chase, 1 far, 2 high
    shot: 0,
    timeSec: 0,
  };
  if (save) missions.setIndex(save.mission);

  const world = {
    player, police, missions, traffic, hud, city, state,
    shotCam: null,
    holdKmh: 0, // screenshot director: hold a target speed (0 = no hold)
    snapCamera() {
      const p = player.state;
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      const dist = [10.5, 14, 9][state.camMode];
      const height = [4.4, 6.2, 11][state.camMode];
      camPos.set(p.pos.x - fx * dist, height, p.pos.z - fz * dist);
    },
    setClock(h, m) { state.clockH = h; state.clockM = m; },
    completeMission() {
      const m = missions.current;
      state.cash += m.reward;
      state.completeOpen = true;
      hud.showComplete(m);
      saveGame();
    },
  };
  const shots = createShotDirector(world);

  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: state.cash, mission: missions.index }));
    } catch (e) { /* private mode: progress just lives for the session */ }
  }

  // ---- input ----
  const input = { up: false, down: false, left: false, right: false, brake: false, handbrake: false };
  const keyMap = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Space: 'brake', ShiftLeft: 'handbrake', ShiftRight: 'handbrake',
  };
  window.addEventListener('keydown', (e) => {
    if (keyMap[e.code] !== undefined) { input[keyMap[e.code]] = true; e.preventDefault(); }
    if (e.code === 'KeyP') togglePause();
    if (e.code === 'KeyC') state.camMode = (state.camMode + 1) % 3;
    if (e.code === 'KeyM') audio.toggleMute();
    if (e.code === 'KeyR') restartMission();
    if (e.code === 'Enter' && !state.running) startGame();
  });
  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code] !== undefined) input[keyMap[e.code]] = false;
  });

  function restartMission() {
    missions.setIndex(missions.index);
    player.reset(0, 90, Math.PI);
    player.state.damage = 0;
    police.setWanted(0);
    hud.toast('MISSION RESTARTED');
  }

  function togglePause() {
    if (!state.running || state.completeOpen) return;
    state.paused = !state.paused;
    hud.showPause(state.paused);
  }

  function startGame() {
    audio.start();
    state.running = true;
    world.snapCamera();
    hud.showGame();
    hud.toast('MISSION 1 — MARINA PICKUP', 3000);
  }
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('resumeBtn').addEventListener('click', togglePause);
  document.getElementById('nextBtn').addEventListener('click', () => {
    const next = missions.advance();
    hud.hideComplete();
    state.completeOpen = false;
    saveGame();
    hud.toast(`MISSION ${next.id} — ${next.name}`, 3000);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- collisions: player vs traffic / police ----
  function vehicleCollisions() {
    const p = player.state;
    const all = [];
    for (const c of traffic.cars) all.push({ pos: c.pos, kind: 'traffic', ref: c });
    for (const u of police.units) if (u.active) all.push({ pos: u.pos, kind: 'police', ref: u });
    for (const o of all) {
      const dx = p.pos.x - o.pos.x, dz = p.pos.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.6 && d > 0.01) {
        const push = (3.6 - d);
        p.pos.x += (dx / d) * push;
        p.pos.z += (dz / d) * push;
        // Shove the other car aside a little so a tap doesn't glue you to it.
        o.pos.x -= (dx / d) * push * 0.4;
        o.pos.z -= (dz / d) * push * 0.4;
        const impact = Math.abs(p.speed);
        if (impact > 3) {
          const mid = new THREE.Vector3((p.pos.x + o.pos.x) / 2, 0.6, (p.pos.z + o.pos.z) / 2);
          combat.burst(mid, Math.min(1, impact / 22));
          p.damage = Math.min(0.95, p.damage + Math.min(0.12, impact * 0.004));
          hud.flashDamage(impact / 22);
          if (o.kind === 'police') police.addHeat(0.4);
          else if (impact > 8) police.addHeat(0.15);
          if (o.kind === 'traffic') o.ref.speed *= 0.7;
          else o.ref.speed *= 0.55;
        }
        p.speed *= 0.55;
      }
    }
  }

  // ---- camera ----
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const camUp = new THREE.Vector3(0, 1, 0);
  function updateCamera(dt) {
    const p = player.state;
    const speedNorm = Math.min(1, Math.abs(p.speed) / 44);
    if (world.shotCam) {
      camPos.copy(world.shotCam.eye);
      camLook.copy(world.shotCam.look);
    } else {
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      const dist = [10.5, 14, 9][state.camMode];
      const height = [4.4, 6.2, 11][state.camMode];
      const tx = p.pos.x - fx * dist;
      const tz = p.pos.z - fz * dist;
      const k = 1 - Math.pow(0.0001, dt); // smooth follow
      camPos.x += (tx - camPos.x) * k;
      camPos.y += (height - camPos.y) * k;
      camPos.z += (tz - camPos.z) * k;
      camLook.set(
        p.pos.x + fx * (7 + speedNorm * 7),
        1.3,
        p.pos.z + fz * (7 + speedNorm * 7),
      );
    }
    const shake = combat.shakeOffset();
    camera.position.set(camPos.x + shake.x, camPos.y + shake.y, camPos.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(camLook);
    // Roll into turns + FOV kick with speed.
    camera.rotateZ(-player.state.steer * 0.035);
    const targetFov = 62 + speedNorm * 13;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }
  }

  // ---- main loop ----
  const clock = new THREE.Clock();
  let saveTimer = 0;
  let firstFrame = true;

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    state.timeSec += dt;

    if (state.running && !state.paused) {
      if (!state.completeOpen) {
        // Screenshot hold: keep the staged speed (driver only).
        if (world.holdKmh) input.up = Math.abs(player.state.speed) * 3.6 < world.holdKmh;
        player.update(dt, input, city.colliders, (pos, speed) => {
          combat.burst(pos, Math.min(1, speed / 22));
          player.state.damage = Math.min(0.95, player.state.damage + Math.min(0.1, speed * 0.0035));
          hud.flashDamage(speed / 22);
          if (speed > 8) police.addHeat(0.12);
        });
        vehicleCollisions();
      }
      traffic.update(dt, player.state, [
        ...traffic.cars,
        ...police.units.filter((u) => u.active),
      ]);
      police.update(dt, player.state, state.timeSec);
      pedestrians.update(dt, player.state, state.timeSec);
      const done = missions.update(dt, player.state.pos, state.timeSec);
      if (done) world.completeMission();
      city.update(dt, state.timeSec);
      combat.update(dt);
      lighting.update(dt, player.state.pos, state.timeSec);

      // Game clock: 1 game minute per 5 real seconds.
      state.clockAcc += dt;
      if (state.clockAcc >= 5) {
        state.clockAcc -= 5;
        state.clockM += 1;
        if (state.clockM >= 60) { state.clockM = 0; state.clockH = (state.clockH + 1) % 24; }
      }
      // Audio: siren distance = nearest active police unit.
      let sirenDist = Infinity;
      for (const u of police.units) {
        if (!u.active) continue;
        sirenDist = Math.min(sirenDist, Math.hypot(u.pos.x - player.state.pos.x, u.pos.z - player.state.pos.z));
      }
      audio.update(dt, {
        rpm: player.state.rpm,
        speedKmh: Math.abs(player.state.speed) * 3.6,
        slipping: player.state.slipping,
        sirenDist,
      });
      saveTimer += dt;
      if (saveTimer > 10) { saveTimer = 0; saveGame(); }
    } else {
      // Attract mode behind the start screen: slow orbit, city alive.
      city.update(dt, state.timeSec);
      lighting.update(dt, player.state.pos, state.timeSec);
      traffic.update(dt, player.state, [...traffic.cars]);
      pedestrians.update(dt, player.state, state.timeSec);
      const a = state.timeSec * 0.05;
      camera.position.set(
        player.state.pos.x + Math.sin(a) * 26,
        12 + Math.sin(state.timeSec * 0.2) * 1.5,
        player.state.pos.z + Math.cos(a) * 26,
      );
      camera.lookAt(player.state.pos.x, 1.5, player.state.pos.z);
    }

    if (state.running) updateCamera(dt);
    hud.update({
      cash: state.cash,
      mission: missions.current,
      distance: missions.distanceTo(player.state.pos),
      wanted: police.wanted,
      damage: player.state.damage,
      clockH: state.clockH,
      clockM: state.clockM,
      speedKmh: Math.abs(player.state.speed) * 3.6,
      gearLabel: player.state.speed === 0 ? 'N' : String(player.state.gear),
      player: { x: player.state.pos.x, z: player.state.pos.z, heading: player.state.heading },
      traffic: traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      police: police.units.filter((u) => u.active).map((u) => ({ x: u.pos.x, z: u.pos.z })),
      objective: missions.targetPos(),
    });

    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      window.__VELMARA__ = window.__VELMARA__ || {};
      window.__VELMARA__.ready = true;
    }
  }

  // Public API for the screenshot driver and smoke tests.
  window.__VELMARA__ = {
    ready: false,
    version: 'velmara-v10',
    _scene: scene,
    stageShot: (n) => shots.stageShot(n),
    start: startGame,
    getState: () => ({
      running: state.running,
      cash: state.cash,
      mission: missions.index + 1,
      wanted: police.wanted,
      traffic: traffic.cars.length,
      pedestrians: pedestrians.walkers.length + pedestrians.chatters.length,
      policeActive: police.units.filter((u) => u.active).length,
      playerSpeedKmh: Math.abs(player.state.speed) * 3.6,
      playerGear: player.state.gear,
      errors: pageErrors.slice(),
    }),
    errors: pageErrors,
  };

  hud.showStart(save);
  // Auto-start for the screenshot driver (?shot=N / ?autostart=1).
  const params = new URLSearchParams(window.location.search);
  if (params.has('shot') || params.has('autostart')) {
    startGame();
    const shot = parseInt(params.get('shot') || '0', 10);
    if (shot >= 1 && shot <= 4) shots.stageShot(shot);
  }
  frame();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
