// Marina Nights — screenshot staging. The shot number is ALWAYS parsed fresh
// from the URL query string (?shot=N) when a shot is applied — never
// hard-coded — so ?shot=1..4 each stage a different scene.
export function parseShot() {
  try {
    const n = parseInt(new URLSearchParams(window.location.search).get('shot') || '0', 10);
    return n >= 1 && n <= 4 ? n : 0;
  } catch (e) { return 0; }
}

export function applyShot(n, G) {
  // Re-read the URL so the applied shot always matches the live parameter.
  const live = parseShot();
  if (live) n = live;
  if (!n) return;
  G.state.shotMode = n;
  G.state.started = true;
  G.hud.setHudVisible(true);
  G.hud.showScreen(null);

  if (n === 1) {
    // 1 — CHASE: police pursuit, wanted 3, patrol cars right on the player.
    // NOTE: start the mission FIRST (it resets wanted to 0), then set wanted 3.
    G.missions.start(0);
    G.player.reset(0, -40, 0);
    G.player.speed = 20;
    G.setWanted(3);
    // Stage the patrol cars where the chase camera can SEE them: two
    // oncoming ahead (left/right) and one pulling alongside.
    {
      const f = G.player.forward();
      const h = G.player.heading;
      const right = { x: Math.cos(h), z: -Math.sin(h) };
      const spots = [
        { lat: -14, ahead: 26, heading: h + Math.PI },
        { lat: 14, ahead: 30, heading: h + Math.PI },
        { lat: 22, ahead: 6, heading: h },
      ];
      G.police.cars.forEach((car, i) => {
        const s = spots[i % spots.length];
        const px = G.player.pos.x + f.x * s.ahead + right.x * s.lat;
        const pz = G.player.pos.z + f.z * s.ahead + right.z * s.lat;
        car.pos.set(px, 0, pz);
        car.group.position.copy(car.pos);
        car.heading = s.heading;
        car.group.rotation.y = s.heading;
        car.speed = 16;
      });
    }
    G.hud.showMessage('LOSE THE COPS', 3000);
  } else if (n === 2) {
    // 2 — MARINA: the busy promenade, yachts, string lights, crowds.
    // Camera sits over the water looking back at the promenade + skyline,
    // so the bay, yachts and cafes are all in frame.
    G.setWanted(0);
    G.player.reset(192, 60, Math.PI); // on the promenade, facing down the bay
    G.player.speed = 0;
    G.missions.start(0);
    G.shotCamera = {
      pos: [250, 24, 95],
      lookAt: [192, 2, 10],
    };
  } else if (n === 3) {
    // 3 — DRIVE: flat-out down a neon street at ~130 km/h.
    G.setWanted(0);
    G.player.reset(-120, 0, Math.PI / 2); // facing +x along the z=0 street
    G.player.speed = 36;
    G.missions.start(0);
  } else if (n === 4) {
    // 4 — WIN: mission 1 complete, reward paid, win screen up.
    G.player.reset(194, 0, Math.PI);
    G.player.speed = 0;
    G.setWanted(0);
    G.missions.start(0);
    G.missions.complete();
  }
  // Chase shots (1 and 3) need the camera snapped behind the car BEFORE the
  // first frame: lerping from the spawn point would swing the camera through
  // buildings at low fps and ruin the screenshot.
  if (n === 1 || n === 3) {
    const f = G.player.forward();
    G.camera.position.set(G.player.pos.x - f.x * 11, 4.6, G.player.pos.z - f.z * 11);
    G.camera.lookAt(G.player.pos.x + f.x * 9, 1.4, G.player.pos.z + f.z * 9);
  }
  G.lighting.applyShot();
}
