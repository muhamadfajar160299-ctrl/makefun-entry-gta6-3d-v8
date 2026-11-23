// main.js — VELMARA: Marina Nights. Bootstrap, camera, game loop, save.
//
// The camera chases the hero with FOV kick at speed, a touch of roll in
// corners, look-ahead down the road, and shake on impacts. The menu opens
// on a slow orbit of the marina; starting the engine drops you behind
// the wheel. Progress (cash + mission) autosaves to localStorage.
const THREE = window.THREE;
import { createLighting } from './lighting.js';
import { createCity } from './city.js';
import { createPlayer, updatePlayer, collideBuildings } from './player.js';
import { createTraffic, updateTraffic } from './vehicles.js';
import { createPolice, updatePolice, setWanted, activePoliceCount, nearestPoliceDistance } from './police.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { applyShot, getShotState } from './shots.js';

const SAVE_KEY = 'velmara-marina-nights-save-v1';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.cash !== 'number' || typeof s.mission !== 'number') return null;
    return s;
  } catch (e) {
    return null;
  }
}

function makeCameraRig(camera) {
  const rig = {
    mode: 'orbit',
    orbitAngle: 0,
    snapBehind(p) {
      this.mode = 'chase';
      const fx = Math.sin(p.heading);
      const fz = -Math.cos(p.heading);
      camera.position.set(p.x - fx * 10, 3.6, p.z - fz * 10);
      camera.lookAt(p.x + fx * 8, 1.4, p.z + fz * 8);
    },
    snapOrbit(p, dist = 14, height = 5.5) {
      this.mode = 'orbit-shot';
      camera.position.set(p.x - 11, height, p.z + 9);
      camera.lookAt(p.x + 9, 1.4, p.z);
      void dist;
    },
    update(dt, p, input, shake) {
      const speedNorm = Math.min(1, Math.abs(p.speed) / 45);
      if (this.mode === 'orbit' || this.mode === 'menu') {
        this.orbitAngle += dt * 0.07;
        const cx = 140 + Math.cos(this.orbitAngle) * 46;
        const cz = 20 + Math.sin(this.orbitAngle) * 46;
        camera.position.set(cx, 13 + Math.sin(this.orbitAngle * 0.7) * 3, cz);
        camera.lookAt(140, 2, 20);
        camera.fov = 58;
        camera.updateProjectionMatrix();
        return;
      }
      if (this.mode === 'orbit-shot') {
        camera.position.set(p.x - 11, 5.5, p.z + 9);
        camera.lookAt(p.x + 9, 1.4, p.z);
        return;
      }
      // Chase camera.
      const fx = Math.sin(p.heading);
      const fz = -Math.cos(p.heading);
      const back = 9.5 + speedNorm * 3.5;
      const up = 3.4 + speedNorm * 0.9;
      const tx = p.x - fx * back;
      const tz = p.z - fz * back;
      const lerp = 1 - Math.pow(0.0001, dt);
      camera.position.x += (tx - camera.position.x) * lerp;
      camera.position.y += (up - camera.position.y) * lerp;
      camera.position.z += (tz - camera.position.z) * lerp;
      // Look-ahead: aim further down the road the faster you go.
      const look = 7 + speedNorm * 9;
      const lx = p.x + fx * look;
      const lz = p.z + fz * look;
      camera.lookAt(lx, 1.3, lz);
      // Roll into corners + shake on impacts.
      camera.rotation.z += -p.steer * 0.02;
      if (shake > 0.01) {
        camera.position.x += (Math.random() - 0.5) * shake * 0.5;
        camera.position.y += (Math.random() - 0.5) * shake * 0.35;
        camera.rotation.z += (Math.random() - 0.5) * shake * 0.03;
      }
      // FOV kick with speed.
      const targetFov = 62 + speedNorm * 13;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
        camera.updateProjectionMatrix();
      }
      void input;
    },
  };
  return rig;
}

function boot() {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
  camera.position.set(186, 14, 66);

  const lighting = createLighting(scene, renderer);
  const city = createCity(scene);
  const player = createPlayer(scene);
  const traffic = createTraffic(scene, 10);
  const police = createPolice(scene, 4);
  const peds = createPedestrians(scene, 14);
  const missions = createMissions(scene);
  const hud = createHud();
  const audio = createAudio();

  const game = {
    scene, camera, renderer, city, lighting,
    player, traffic, police, peds, missions, hud, audio,
    combat: null,
    state: 'menu',
    paused: false,
    stagingHold: false,
    cash: 0, wanted: 0,
    time: 0, shake: 0,
    cameraRig: null,
    version: 'r18-bright',
  };
  game.combat = createCombat(scene);
  game.cameraRig = makeCameraRig(camera);

  // Restore save.
  const save = loadSave();
  if (save) {
    game.cash = save.cash;
    missions.start(Math.min(save.mission, 4), player);
    if (save.cash > 0) hud.toast(`Welcome back — $${save.cash} banked, mission ${missions.current.id} active.`);
  }

  const input = { up: false, down: false, left: false, right: false, brake: false };
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    Space: 'brake',
  };

  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: game.cash, mission: missions.index }));
    } catch (e) { /* storage is best-effort */ }
  }

  function startGame() {
    audio.start();
    game.state = 'playing';
    game.cameraRig.mode = 'chase';
    game.cameraRig.snapBehind(player);
    hud.hideStart();
    hud.hideComplete();
    const m = missions.current;
    if (m) {
      game.wanted = m.wantedOnStart;
      setWanted(police, game.wanted, player);
      hud.toast(`Mission ${m.id} — ${m.name}`);
    }
  }

  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code] !== undefined) {
      input[KEYMAP[e.code]] = true;
      game.stagingHold = false;
      if (game.state === 'menu') startGame();
      e.preventDefault();
    }
    if (e.code === 'KeyP' && game.state === 'playing') {
      game.paused = !game.paused;
      game.state = game.paused ? 'paused' : 'playing';
      if (game.paused) hud.showPause(); else hud.hidePause();
    } else if (e.code === 'KeyP' && game.state === 'paused') {
      game.paused = false;
      game.state = 'playing';
      hud.hidePause();
    }
    if (e.code === 'KeyR' && (game.state === 'playing' || game.state === 'complete')) {
      missions.start(missions.index, player);
      player.reset(0, 30, 0);
      game.state = 'playing';
      hud.hideComplete();
      game.cameraRig.mode = 'chase';
      game.cameraRig.snapBehind(player);
      hud.toast('Mission restarted.');
    }
    if (e.code === 'KeyM') {
      const muted = audio.toggleMute();
      hud.toast(muted ? 'Sound off.' : 'Sound on.');
    }
    if (e.code === 'Enter' && game.state === 'menu') startGame();
    if (e.code === 'Enter' && game.state === 'complete') nextMission();
  });
  window.addEventListener('keyup', (e) => {
    if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
  });
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('resume-btn').addEventListener('click', () => {
    game.paused = false;
    game.state = 'playing';
    hud.hidePause();
  });
  function nextMission() {
    const m = missions.next();
    hud.hideComplete();
    if (!m) {
      game.state = 'playing';
      hud.toast('All missions complete — free roam!');
      saveGame();
      return;
    }
    game.state = 'playing';
    game.wanted = m.wantedOnStart;
    setWanted(police, game.wanted, player);
    game.cameraRig.mode = 'chase';
    game.cameraRig.snapBehind(player);
    hud.toast(`Mission ${m.id} — ${m.name}`);
    saveGame();
  }
  document.getElementById('next-btn').addEventListener('click', nextMission);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  let hudAccum = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    game.time += dt;
    game.shake = Math.max(0, game.shake - dt * 1.6);

    if (game.state === 'playing' && !game.paused) {
      const drive = updatePlayer(player, input, dt, game);
      if (!game.stagingHold) {
        collideBuildings(player, city.colliders, game);
        game.combat.checkCarCollisions(game);
      }
      game.combat.damageSmoke(game, dt);
      updateTraffic(traffic, dt, game.time, { x: player.x, z: player.z }, police);
      updatePolice(police, player, dt, game.time);
      updatePedestrians(peds, dt, game.time);
      missions.update(dt, game.time, player);
      if (missions.tryComplete(player, game)) {
        game.wanted = Math.min(5, game.wanted + 1);
        setWanted(police, game.wanted, player);
        saveGame();
      }
      // Wanted creeps up if you keep ramming police cars.
      audio.setEngine(drive.rpm, input.up ? 1 : 0, Math.min(1, Math.abs(player.speed) / 45));
      audio.setSkid(player.skid === 1);
      const nd = nearestPoliceDistance(police, player);
      audio.setSiren(nd, game.time);
    } else if (game.state === 'menu') {
      updateTraffic(traffic, dt, game.time, null, police);
      updatePedestrians(peds, dt, game.time);
      missions.update(dt, game.time, player);
    }

    city.update(dt, game.time);
    lighting.update(dt, game.time, player.group.position);
    game.combat.update(dt);
    game.cameraRig.update(dt, player, input, game.shake);

    hudAccum += dt;
    if (hudAccum > 0.12) {
      hudAccum = 0;
      hud.update(game, dt);
    }
    renderer.render(scene, camera);
  }
  animate();

  // Staging + inspection hooks for the screenshot tool.
  window.__VELMARA__ = {
    game,
    version: game.version,
    ready: true,
    applyShot: (n) => applyShot(game, n),
    getShotState: () => getShotState(game),
    start: startGame,
  };
  document.title = 'VELMARA — Marina Nights';
  return game;
}

try {
  boot();
} catch (err) {
  console.error('VELMARA boot failed:', err);
  document.getElementById('start-screen').insertAdjacentHTML(
    'beforeend',
    `<p style="color:#ff8080">Could not start WebGL: ${String(err && err.message || err)}</p>`,
  );
}
