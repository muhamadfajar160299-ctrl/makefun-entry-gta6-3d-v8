// hud.js — DOM HUD: wanted stars, health, cash, clock, speed, mission text,
// and a real road-map minimap (avenues, bay, player, objective, police).
// Also owns every menu screen: start, pause, mission complete, story, busted, wasted.

const $ = (id) => document.getElementById(id);

function updateWantedHud() {
  const el = $('stars');
  if (!el) return;
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += i < G.wanted ? '<span>★</span>' : '<span class="off">★</span>';
  }
  el.innerHTML = html;
}
function updateHealthHud() {
  const bar = $('health-bar');
  if (bar) {
    bar.style.width = Math.max(0, G.health) + '%';
    bar.style.background = G.health > 50
      ? 'linear-gradient(90deg,#37e08a,#a8ff6a)'
      : G.health > 25 ? 'linear-gradient(90deg,#ffb93c,#ffd76a)' : 'linear-gradient(90deg,#ff5d5d,#ff8a5d)';
  }
}
function updateMoneyHud() {
  const el = $('money-line');
  if (el) el.textContent = '$' + Math.floor(G.money).toLocaleString('en-US');
}
function updateClockHud() {
  const el = $('clock-line');
  if (!el) return;
  const h = Math.floor(G.time) % 24;
  const m = Math.floor((G.time % 1) * 60);
  el.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' · NIGHT';
}
function updateMissionHud() {
  if (missionFinished()) {
    $('mission-title').textContent = 'VELMARA IS YOURS';
    $('mission-text').textContent = 'Every job done. Free roam the bay.';
    $('mission-dist').textContent = '';
    return;
  }
  const m = currentMission();
  const step = currentStep();
  $('mission-title').textContent = m.title;
  $('mission-text').textContent = step.text;
  $('mission-dist').textContent = step.kind === 'timed'
    ? 'TIME LEFT: ' + Math.max(0, Math.ceil(G.stepTimer)) + 's'
    : '';
}
function updateSpeedHud() {
  const box = $('speed-box');
  if (!box) return;
  if (G.playerCar) {
    box.style.display = 'block';
    $('speed-num').textContent = String(Math.round(Math.abs(G.playerCar.speed) * 3.6));
  } else {
    box.style.display = 'none';
  }
}
function updateMissionDistHud() {
  const el = $('mission-dist');
  if (!el || missionFinished()) return;
  const step = currentStep();
  if (step.kind === 'timed') {
    el.textContent = 'TIME LEFT: ' + Math.max(0, Math.ceil(G.stepTimer)) + 's';
    return;
  }
  const d = objectiveDistance();
  if (d >= 0) el.textContent = '◈ ' + Math.round(d) + ' m to objective';
}

let toastTimer = null;
function showToast(text) {
  const el = $('toast');
  if (!el) return;
  el.textContent = text;
  el.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

// ---- minimap: real avenues + bay, not a plain grid ----
function drawMinimap() {
  const cv = $('minimap');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const worldMin = -215, worldMax = 215;
  const scale = W / (worldMax - worldMin);
  const px = (x) => (x - worldMin) * scale;
  const pz = (z) => (z - worldMin) * scale;
  ctx.clearRect(0, 0, W, H);
  // land
  ctx.fillStyle = '#0e1530';
  ctx.fillRect(0, 0, W, H);
  // bay (south)
  ctx.fillStyle = '#0d3a63';
  ctx.fillRect(0, pz(CITY.waterZ), W, H - pz(CITY.waterZ));
  ctx.fillStyle = 'rgba(120,190,255,0.25)';
  for (let i = 0; i < 12; i++) {
    const y = pz(CITY.waterZ) + 8 + i * 9;
    ctx.fillRect(10 + ((i * 37) % 120), y, 46, 2);
  }
  // promenade
  ctx.fillStyle = '#5a5142';
  ctx.fillRect(0, pz(CITY.marinaZ), W, pz(CITY.waterZ) - pz(CITY.marinaZ));
  // blocks
  ctx.fillStyle = '#1c2440';
  const intervals = [[-185, -155], [-141, -81], [-67, -7], [7, 67], [81, 141], [155, 185]];
  for (const [x0, x1] of intervals) {
    for (const [z0, z1] of intervals) {
      if (z0 >= 155) continue;
      ctx.fillRect(px(x0), pz(z0), px(x1) - px(x0), pz(z1) - pz(z0));
    }
  }
  // avenues
  ctx.strokeStyle = '#8a93b8';
  ctx.lineWidth = 5;
  for (const c of CITY.roads) {
    ctx.beginPath(); ctx.moveTo(px(c), 0); ctx.lineTo(px(c), pz(185)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, pz(c)); ctx.lineTo(W, pz(c)); ctx.stroke();
  }
  ctx.strokeStyle = '#f7c948';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 6]);
  for (const c of CITY.roads) {
    ctx.beginPath(); ctx.moveTo(px(c), 0); ctx.lineTo(px(c), pz(185)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, pz(c)); ctx.lineTo(W, pz(c)); ctx.stroke();
  }
  ctx.setLineDash([]);
  // traffic dots
  ctx.fillStyle = 'rgba(200,210,235,0.85)';
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    ctx.fillRect(px(car.mesh.position.x) - 1.5, pz(car.mesh.position.z) - 1.5, 3, 3);
  }
  // objective marker (pulsing gold)
  if (!missionFinished()) {
    const step = currentStep();
    if (step.kind !== 'lose' && step.x != null) {
      const pulse = 5 + Math.sin(G.elapsed * 5) * 2;
      ctx.fillStyle = '#ffc94d';
      ctx.beginPath();
      ctx.arc(px(step.x), pz(step.z), pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  // police dots (red/blue)
  for (let i = 0; i < G.policeCars.length; i++) {
    const car = G.policeCars[i];
    ctx.fillStyle = i % 2 ? '#ff3344' : '#3388ff';
    ctx.beginPath();
    ctx.arc(px(car.mesh.position.x), pz(car.mesh.position.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // player arrow (white, points along heading)
  const pp = G.playerCar ? G.playerCar.mesh.position : (G.player ? G.player.mesh.position : { x: 0, z: 150 });
  const yaw = G.playerCar ? G.playerCar.yaw : (G.player ? G.player.yaw : Math.PI);
  const cx = px(pp.x), cy = pz(pp.z);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(Math.sin(yaw), -Math.cos(yaw)));
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // north tick
  ctx.fillStyle = '#cfe3ff';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('N', 6, 14);
}

// ---- screens ----
function hideAllScreens() {
  for (const id of ['start-screen', 'pause-screen', 'win-screen', 'story-screen', 'busted-screen', 'wasted-screen']) {
    $(id).classList.add('hidden');
  }
}
function showScreen(name, mission) {
  hideAllScreens();
  if (name === 'start') { $('start-screen').classList.remove('hidden'); G.mode = 'start'; return; }
  if (name === 'pause') { $('pause-screen').classList.remove('hidden'); G.mode = 'paused'; return; }
  if (name === 'win') {
    $('win-text').textContent = mission ? mission.done : 'Job done.';
    $('win-reward').textContent = mission ? '+$' + mission.reward.toLocaleString('en-US') : '';
    $('win-screen').classList.remove('hidden');
    G.mode = 'win';
    return;
  }
  if (name === 'story') {
    $('story-money').textContent = 'Total cash: $' + Math.floor(G.money).toLocaleString('en-US');
    $('story-screen').classList.remove('hidden');
    G.mode = 'story';
    return;
  }
  if (name === 'busted') { $('busted-screen').classList.remove('hidden'); G.mode = 'busted'; return; }
  if (name === 'wasted') {
    G.health = 100;
    updateHealthHud();
    $('wasted-screen').classList.remove('hidden');
    G.mode = 'wasted';
    return;
  }
  if (name === 'none') { G.mode = 'playing'; return; }
}
function startPlaying() {
  hideAllScreens();
  $('hud').classList.remove('hidden');
  G.mode = 'playing';
  initAudio();
  if (G.mode === 'playing' && missionFinished()) updateMissionHud();
}

function initHud() {
  updateWantedHud();
  updateHealthHud();
  updateMoneyHud();
  updateClockHud();
  updateMissionHud();
  $('resume-btn').addEventListener('click', () => { showScreen('none'); });
  $('win-btn').addEventListener('click', () => {
    hideAllScreens();
    G.mode = 'playing';
    startMission(G.missionIndex + 1);
  });
  $('story-btn').addEventListener('click', () => {
    hideAllScreens();
    G.mode = 'playing';
    updateMissionHud();
  });
  $('busted-btn').addEventListener('click', () => {
    hideAllScreens();
    G.mode = 'playing';
    updateWantedHud();
    updateMoneyHud();
  });
  $('wasted-btn').addEventListener('click', () => {
    hideAllScreens();
    if (G.player) {
      G.player.mesh.position.set(12, 0, 150);
      G.player.yaw = Math.PI;
    }
    G.health = 100;
    updateHealthHud();
    G.mode = 'playing';
  });
}
