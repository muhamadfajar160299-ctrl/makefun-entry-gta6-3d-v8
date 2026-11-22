// shots.js — screenshot staging: ?shot=1..4 prepares a real, running
// scene for each of the four screenshots (chase, marina walk, drive, win).
// The game is genuinely playing in every shot — no composited images.

function applyShot() {
  const params = new URLSearchParams(window.location.search);
  const shot = parseInt(params.get('shot') || '0', 10);
  G.shot = shot;
  if (!shot) return;
  // every shot starts playing immediately (no start screen)
  hideAllScreens();
  $('hud').classList.remove('hidden');
  G.mode = 'playing';
  G.time = 21.6;
  initAudio();
  if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume().catch(() => {});
  G.muted = true;   // silent headless capture

  const p = G.player;
  if (shot === 1) {
    // COVER — night chase along the promenade: gold Vantara GT racing east
    // past the marina, two VPD interceptors cutting in from the flanks,
    // 3 wanted stars, mission live, beacon ahead.
    G.missionIndex = 0; G.missionStep = 0;
    startMission(0);
    p.mesh.position.set(0, 0, 118);
    p.mesh.visible = false;
    const car = G.cars.find((c) => c.isPlayer) || nearestCarTo(0, 118, 80);
    if (car) {
      car.kind = 'player'; car.isPlayer = true;
      car.mesh.position.set(-30, 0, 177);
      car.yaw = Math.PI / 2; car.speed = 12;   // heading east along the waterfront
      G.playerCar = car;
    }
    G.wanted = 3;
    updateWantedHud();
    // two interceptors cutting in from the player's front flanks
    const flankSpots = [[-22, 173.5], [-24, 180.5]];
    for (let i = 0; i < 2; i++) {
      const pc = spawnPoliceCar();
      pc.mesh.position.set(flankSpots[i][0], 0, flankSpots[i][1]);
      pc.yaw = Math.PI / 2;
      pc.speed = 16;
    }
    G.camYaw = Math.PI;
    G.camPitch = 0.3;
  } else if (shot === 2) {
    // MARINA WALK — on foot on the promenade: yachts, neon, palms, crowd.
    G.missionIndex = 0; G.missionStep = 0;
    startMission(0);
    p.mesh.position.set(10, 0, 180);
    p.yaw = 0.5;   // facing the bay, three-quarter view
    G.camYaw = Math.PI + 0.55;   // camera north-west, diagonal over the bay
    G.camPitch = 0.3;
    G.camDist = 8.5;
    G.wanted = 0;
    updateWantedHud();
  } else if (shot === 3) {
    // CITY DRIVE — driving up the main avenue with traffic and towers.
    G.missionIndex = 2; G.missionStep = 0;
    startMission(2);
    p.mesh.visible = false;
    const car = G.cars.find((c) => c.isPlayer) || nearestCarTo(0, 40, 100);
    if (car) {
      car.kind = 'player'; car.isPlayer = true;
      car.mesh.position.set(0, 0, 40);
      car.yaw = Math.PI; car.speed = 20;   // heading north up the avenue
      G.playerCar = car;
    }
    // three traffic cars ahead on the same avenue (north of the player)
    const aheadSpots = [[-3, 12], [3, -8], [-3, -30]];
    const traffic = G.cars.filter((c) => c.kind === 'traffic');
    for (let i = 0; i < Math.min(3, traffic.length); i++) {
      const c = traffic[i];
      c.mesh.position.x = aheadSpots[i][0];
      c.mesh.position.z = aheadSpots[i][1];
      c.yaw = Math.PI;
      if (c.route) { c.route.axis = 'z'; c.route.line = aheadSpots[i][0]; c.route.dir = -1; }
    }
    G.wanted = 0;
    updateWantedHud();
    G.camYaw = Math.PI;
    G.camPitch = 0.3;
  } else if (shot === 4) {
    // WIN — mission complete screen over the glowing marina.
    startMission(0);
    G.money += 400;
    updateMoneyHud();
    p.mesh.position.set(-4, 0, 172);
    p.yaw = Math.PI;   // facing north, toward the camera
    G.camYaw = 0;      // camera south of Rae, city skyline behind
    G.camPitch = 0.25;
    G.camDist = 8;
    const m = MISSIONS[0];
    showScreen('win', m);
  }
  // snap the camera to the staged framing on the very first frame
  updateCamera(10);
}
