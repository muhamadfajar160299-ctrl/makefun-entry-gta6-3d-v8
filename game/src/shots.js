// shots.js — deterministic staging for the four screenshots.
//
// The capture tool calls applyShot(n) and then reads getShotState() to
// verify the frame shows what the dossier claims. Positions are fixed so
// every capture run stages the same scene.
import { setWanted } from './police.js';
import { syncGear } from './player.js';

// Traffic is repositioned onto far lanes for every shot, so a staged
// hero never rear-ends a random car (which would kill the staged speed).
function placeTraffic(game, lanes) {
  game.traffic.forEach((c, i) => {
    const lane = lanes[i % lanes.length];
    c.x = lane + 3.5;
    c.z = -110 + i * 22;
    c.heading = 0;
    c.speed = c.targetSpeed;
    c.turnAt = null;
    c.signal = 0;
    c.braking = false;
  });
}

export function applyShot(game, n) {
  const p = game.player;
  const cam = game.cameraRig;
  game.state = 'playing';
  game.stagingHold = true; // freeze staged speeds so the shot reads exactly
  game.hud.hideStart();
  game.hud.hidePause();
  game.hud.hideComplete();
  game.paused = false;

  if (n === 1) {
    // Chase: wanted 3, 72 km/h in 3rd gear, 4 police cars active.
    p.reset(0, 60, 0);
    p.speed = 20; // 72 km/h
    game.wanted = 3;
    setWanted(game.police, 3, p);
    // Flankers close in, converging on the player; the blocker waits ahead.
    game.police[0].x = 12; game.police[0].z = 42;
    game.police[0].heading = 0.35; game.police[0].speed = 21;
    game.police[1].x = -12; game.police[1].z = 44;
    game.police[1].heading = -0.35; game.police[1].speed = 21;
    game.police[2].x = 3; game.police[2].z = 18;
    game.police[2].heading = 0; game.police[2].speed = 22;
    game.police[3].x = -5; game.police[3].z = 88;
    game.police[3].heading = 0; game.police[3].speed = 19;
    placeTraffic(game, [50, -50]);
    game.missions.start(0, p);
    game.cash = 0;
    cam.snapBehind(p);
  } else if (n === 2) {
    // Marina: parked at the promenade, objective diamond 9 m ahead (east).
    p.reset(131, 20, Math.PI / 2);
    p.speed = 0;
    game.wanted = 0;
    setWanted(game.police, 0, p);
    game.missions.start(0, p);
    game.missions.current.target = { x: 140, z: 20 };
    game.missions.marker.position.set(140, 0, 20);
    placeTraffic(game, [100, -100]);
    game.cash = 0;
    cam.snapOrbit(p, 14, 5.5);
  } else if (n === 3) {
    // Top speed: 130 km/h in 5th gear down the long 5th Avenue straight.
    p.reset(50, 110, 0);
    p.speed = 36.1; // 130 km/h
    game.wanted = 1;
    setWanted(game.police, 1, p);
    game.police[0].x = 58; game.police[0].z = 78;
    game.police[0].heading = 0; game.police[0].speed = 30;
    placeTraffic(game, [0, -100]);
    game.missions.start(0, p);
    game.cash = 0;
    cam.snapBehind(p);
  } else if (n === 4) {
    // Mission complete: $400 banked, overlay up, marina behind it.
    p.reset(131, 20, Math.PI / 2);
    p.speed = 0;
    game.wanted = 0;
    setWanted(game.police, 0, p);
    game.missions.start(0, p);
    game.cash = 400;
    game.state = 'complete';
    placeTraffic(game, [100, -100]);
    game.hud.showComplete(game.missions.current);
    cam.snapOrbit(p, 14, 5.5);
  }
  // Gear + rpm from the staged speed, right now — not on the next frame.
  syncGear(p);
  game.hud.update(game, 0);
}

export function getShotState(game) {
  const p = game.player;
  return {
    wanted: game.wanted,
    speedKmh: Math.round(Math.abs(p.speed) * 3.6),
    gear: p.reversing ? 'R' : p.gear === 0 ? 'N' : p.gear,
    policeActive: game.police.filter((c) => c.active).length,
    cash: game.cash,
    distanceToObjective: Math.round(game.missions.distanceTo(p)),
    mission: game.missions.current ? game.missions.current.name : null,
    state: game.state,
  };
}
