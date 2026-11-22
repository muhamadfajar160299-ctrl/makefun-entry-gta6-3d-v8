// main.js — boot and the main loop: binds every system together and
// steps the world (player, traffic, pedestrians, police, missions, HUD).

window.addEventListener('error', (e) => {
  const el = document.getElementById('js-errors');
  if (el) el.textContent += 'ERROR: ' + e.message + ' @ ' + (e.filename || '') + ':' + (e.lineno || '') + '\n';
});

function bindInput() {
  window.addEventListener('keydown', (e) => {
    G.keys[e.code] = true;
    initAudio();
    if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume().catch(() => {});
    if (e.code === 'Enter') {
      if (G.mode === 'start') startPlaying();
      else if (G.mode === 'win') document.getElementById('win-btn').click();
      else if (G.mode === 'story') document.getElementById('story-btn').click();
      else if (G.mode === 'busted') document.getElementById('busted-btn').click();
      else if (G.mode === 'wasted') document.getElementById('wasted-btn').click();
    }
    if (e.code === 'KeyE' && G.mode === 'playing') {
      if (G.playerCar) exitCar();
      else tryEnterCar();
    }
    if (e.code === 'KeyF' && G.mode === 'playing') tryPunch();
    if (e.code === 'KeyP') {
      if (G.mode === 'playing') showScreen('pause');
      else if (G.mode === 'paused') showScreen('none');
    }
    if (e.code === 'KeyM') toggleMute();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  // mouse drag orbits the camera; wheel zooms
  let dragging = false, lastX = 0, lastY = 0;
  const cv = G.renderer.domElement;
  cv.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    G.camYaw -= (e.clientX - lastX) * 0.005;
    G.camPitch = Math.max(0.08, Math.min(1.1, G.camPitch + (e.clientY - lastY) * 0.004));
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    G.camDist = Math.max(5, Math.min(18, G.camDist + e.deltaY * 0.01));
  }, { passive: false });
  // click also punches on foot
  cv.addEventListener('click', () => { if (G.mode === 'playing' && !G.playerCar) tryPunch(); });
}

function boot() {
  initLighting();
  buildCity();
  createPlayer();
  spawnInitialVehicles();
  spawnInitialPeds();
  loadSave();
  initHud();
  updateMoneyHud();
  bindInput();
  startMission(G.missionIndex);
  applyShot();
  if (!G.shot) showScreen('start');
  G.clock.start();
  requestAnimationFrame(loop);
}

let hudTimer = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, G.clock.getDelta());
  G.elapsed += dt;
  if (G.mode === 'playing') {
    G.time += dt * 0.02;   // a full night passes slowly
    if (G.time >= 24) G.time -= 24;
    if (G.playerCar) updatePlayerDriving(dt);
    else updatePlayerOnFoot(dt);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateMissions(dt);
    checkCarPedHits();
    healPlayer(dt);
    updateAudio(dt);
    // HUD refresh (cheap parts every frame, minimap ~10x/sec)
    hudTimer += dt;
    if (hudTimer > 0.1) {
      hudTimer = 0;
      updateClockHud();
      updateSpeedHud();
      updateMissionDistHud();
      drawMinimap();
    }
  }
  animateCity(dt, G.elapsed);
  updateCamera(dt);
  G.renderer.render(G.scene, G.camera);
  // debug state for headless verification (camera, player, mode)
  const dbg = document.getElementById('debug-state');
  if (dbg && G.player) {
    dbg.textContent = 'mode=' + G.mode + ' wanted=' + G.wanted +
      ' cam=' + G.camera.position.x.toFixed(1) + ',' + G.camera.position.y.toFixed(1) + ',' + G.camera.position.z.toFixed(1) +
      ' player=' + G.player.mesh.position.x.toFixed(1) + ',' + G.player.mesh.position.z.toFixed(1) +
      ' car=' + (G.playerCar ? G.playerCar.mesh.position.x.toFixed(1) + ',' + G.playerCar.mesh.position.z.toFixed(1) + ',' + G.playerCar.speed.toFixed(1) : 'none') +
      ' police=' + G.policeCars.length + ' health=' + Math.round(G.health) + ' money=' + Math.round(G.money);
  }
}

document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
