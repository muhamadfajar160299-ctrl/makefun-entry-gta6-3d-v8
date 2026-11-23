// Marina Nights — entry point & game loop. Renderer (ACES, exposure 1.28,
// real moon shadows), scene, chase camera (speed FOV kick, corner roll,
// impact shake), keyboard input, and coordination of player, traffic,
// police, pedestrians, missions, combat and HUD. Exposes window.__game for
// the driver / tests and window.__gameReady once the first frame renders.
import { createCity } from './city.js';
import { createPlayer } from './player.js';
import { createTraffic } from './vehicles.js';
import { createPolice } from './police.js';
import { createPedestrians } from './pedestrians.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createLighting } from './lighting.js';
import { createAudio } from './audio.js';
import { parseShot, applyShot } from './shots.js';

const THREE = window.THREE;

const app = document.getElementById('app');
const loading = document.getElementById('loading');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 6, -132);

const G = {
  scene, camera, renderer,
  state: {
    started: false, paused: false, over: false, overKind: null,
    money: 0, wanted: 0, damage: 0,
    missionComplete: false, completedMissions: 0, allComplete: false,
    shotMode: 0, pendingNext: false,
  },
  keys: {},
  shotCamera: null,
  clock: new THREE.Clock(),
  time: 0,
};
window.__game = G;

G.lighting = createLighting(scene, renderer);
G.city = createCity(scene);
G.player = createPlayer(scene, G.city);
G.traffic = createTraffic(scene, 14);
G.police = createPolice(scene);
G.peds = createPedestrians(scene);
G.hud = createHud();
G.audio = createAudio();
G.missions = createMissions(scene, G);
G.combat = createCombat(G);

G.setWanted = function (n) {
  G.state.wanted = Math.max(0, Math.min(5, n));
  G.hud.setWanted(G.state.wanted);
  G.police.setCount(G.state.wanted, G.player.pos);
};

G.busted = function () {
  if (G.state.over) return;
  G.state.over = true;
  G.state.overKind = 'busted';
  G.audio.busted();
  G.hud.showScreen('busted');
};

G.restartMission = function () {
  G.state.over = false;
  G.state.overKind = null;
  G.state.damage = 0;
  G.hud.setDamage(0);
  G.state.missionComplete = false;
  G.state.pendingNext = false;
  G.setWanted(G.missions.current().wanted || 0);
  G.player.reset(0, -120, 0);
  G.hud.showScreen(null);
  G.hud.setHudVisible(true);
};

G.startGame = function () {
  G.audio.init();
  G.audio.resume();
  G.state.started = true;
  G.hud.setHudVisible(true);
  G.hud.showScreen(null);
  G.hud.setMoney(G.state.money);
  G.hud.setWanted(G.state.wanted);
  G.missions.start(G.missions.index);
};

G.togglePause = function () {
  if (!G.state.started || G.state.over || G.state.missionComplete) return;
  G.state.paused = !G.state.paused;
  if (G.state.paused) G.hud.showScreen('pause');
  else { G.hud.showScreen(null); G.hud.setHudVisible(true); }
};

function readInput() {
  const k = G.keys;
  return {
    forward: !!(k.KeyW || k.ArrowUp),
    back: !!(k.KeyS || k.ArrowDown),
    left: !!(k.KeyA || k.ArrowLeft),
    right: !!(k.KeyD || k.ArrowRight),
    brake: !!k.Space,
  };
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  G.keys[e.code] = true;
  if (e.code === 'KeyP') G.togglePause();
  if (e.code === 'KeyR' && G.state.started) G.restartMission();
  if (e.code === 'Enter') {
    if (!G.state.started && !document.getElementById('screen-start').classList.contains('hidden')) {
      document.getElementById('btn-start').click();
    } else if (!G.state.started && !document.getElementById('screen-story').classList.contains('hidden')) {
      document.getElementById('btn-begin').click();
    }
  }
});
window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
window.addEventListener('pointerdown', () => { G.audio.init(); G.audio.resume(); }, { once: false });

document.getElementById('btn-start').addEventListener('click', () => {
  G.audio.init();
  G.hud.showScreen('story');
});
document.getElementById('btn-begin').addEventListener('click', () => G.startGame());
document.getElementById('btn-continue').addEventListener('click', () => {
  if (G.state.allComplete) {
    G.state.missionComplete = false;
    G.hud.showScreen(null);
    G.hud.setHudVisible(true);
    G.hud.showMessage('ALL MISSIONS COMPLETE — FREE ROAM', 3500);
    return;
  }
  G.missions.next();
  G.hud.showScreen(null);
  G.hud.setHudVisible(true);
});
document.getElementById('btn-resume').addEventListener('click', () => G.togglePause());
document.getElementById('btn-busted-retry').addEventListener('click', () => G.restartMission());
document.getElementById('btn-wasted-retry').addEventListener('click', () => G.restartMission());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- chase camera ----
// Speed-sensitive FOV, a touch of roll in corners, and impact shake.
const camTarget = new THREE.Vector3();
let shakeAmt = 0;
G.shake = function (a) { shakeAmt = Math.min(1, shakeAmt + (a || 0.3)); };
function updateCamera(dt) {
  if (G.shotCamera) {
    camera.position.set(G.shotCamera.pos[0], G.shotCamera.pos[1], G.shotCamera.pos[2]);
    camera.lookAt(G.shotCamera.lookAt[0], G.shotCamera.lookAt[1], G.shotCamera.lookAt[2]);
    return;
  }
  const p = G.player.pos;
  const f = G.player.forward();
  const speedRatio = Math.min(1, Math.abs(G.player.speed) / 36);
  // FOV widens with speed: 68 cruising, ~78 flat out — the rush is felt.
  const targetFov = 68 + speedRatio * 10;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
  const desired = new THREE.Vector3(p.x - f.x * 11, 4.6, p.z - f.z * 11);
  const k = 1 - Math.exp(-5 * dt);
  camera.position.lerp(desired, k);
  camTarget.set(p.x + f.x * (9 + speedRatio * 6), 1.4, p.z + f.z * (9 + speedRatio * 6));
  camera.lookAt(camTarget);
  // lean the horizon slightly into corners, like a chase cam mounted on the car
  camera.rotateZ(-G.player.steer * speedRatio * 0.03);
  if (shakeAmt > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.7;
    camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.5;
    camera.position.z += (Math.random() - 0.5) * shakeAmt * 0.7;
    shakeAmt *= Math.exp(-6 * dt);
  } else {
    shakeAmt = 0;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(G.clock.getDelta(), 0.05);
  G.time += dt;
  const running = G.state.started && !G.state.paused && !G.state.over && !G.state.missionComplete;
  if (running) {
    const input = readInput();
    const impact = G.player.update(dt, input);
    // shot 1 is staged at a 72 km/h chase and shot 3 at a flat-out 130 km/h:
    // pin the cruise speed so the screenshots always show the staged speed.
    if (G.state.shotMode === 3) G.player.speed = 36;
    if (G.state.shotMode === 1) G.player.speed = 20;
    if (impact > 10) G.combat.addDamage((impact - 10) * 1.4);
    G.traffic.update(dt, G.player.pos);
    G.police.update(dt, G.player.pos, G.player.speed, G.state.wanted, G);
    G.peds.update(dt);
    G.combat.update(dt);
    G.missions.update(dt, G.time);
    G.audio.update(
      G.player.speed, G.state.wanted, G.player.steer, G.player.braking,
      G.police.nearestDist ? G.police.nearestDist(G.player.pos) : Infinity
    );
    G.hud.setSpeed(Math.abs(G.player.speed) * 3.6);
    G.hud.setGear(G.player.speed);
    G.hud.setMoney(G.state.money);
  } else if (G.state.started) {
    // keep the world alive behind pause/win screens (traffic drifts on)
    G.peds.update(dt);
  }
  // living world, every frame: moon shadows track the player, yachts bob,
  // water shimmers, and the in-game clock ticks (21:36 + 1 min / 2 s).
  G.lighting.update(G.player.pos);
  G.city.update(G.time);
  const mins = 21 * 60 + 36 + Math.floor(G.time / 2);
  const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  G.hud.setClock(hh + ':' + mm + ' · NIGHT');
  if (G.state.started || G.state.shotMode) {
    G.hud.drawMinimap(G, G.time);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
  if (!window.__gameReady) {
    window.__gameReady = true;
    if (loading) loading.classList.add('hidden');
  }
}

// ---- boot ----
G.hud.setMoney(G.state.money);
const shot = parseShot();
if (shot) {
  // screenshot / driver mode: skip the menus, stage the shot immediately
  G.state.started = true;
  G.missions.start(0);
  applyShot(shot, G);
  G.hud.setHudVisible(true);
} else {
  G.hud.showScreen('start');
}
animate();
