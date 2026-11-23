// shots.js — stages the four screenshots: a wanted chase, the marina, a
// high-speed overtake, and the mission-complete screen. Each stage places
// the player, the police and the traffic, then lets the live game render.
const THREE = window.THREE;

export function createShotDirector(world) {
  function findTaxi() {
    return world.traffic.cars.find((c) => c.kind === 'taxi')
      || world.traffic.cars[0];
  }

  function clearShotCam() { world.shotCam = null; }

  return {
    stageShot(n) {
      const P = world.player;
      const M = world.missions;
      world.setClock(21, 36);
      world.hud.hideComplete();
      world.state.completeOpen = false;
      clearShotCam();

      if (n === 1) {
        // Wanted-3 chase down the avenue, strobes in the mirror.
        M.setIndex(0);
        P.reset(0, 115, Math.PI);
        P.setSpeedKmh(72, 3);
        world.holdKmh = 72;
        world.snapCamera();
        world.police.setWanted(3);
        world.police.deployAround(P.state.pos, 17);
        world.state.cash = 0;
        world.hud.toast('WANTED — LOSE THE PD', 2000);
      } else if (n === 2) {
        // Marina promenade: the car at the pickup point, diamond overhead,
        // yachts and the cafe crowd in frame.
        M.setIndex(0);
        P.reset(143, -18, 0.85);
        P.setSpeedKmh(0, 1);
        world.holdKmh = 0;
        world.police.setWanted(0);
        world.state.cash = 0;
        // Side-on camera so the sea, piers and yachts read in frame.
        world.shotCam = {
          eye: new THREE.Vector3(118, 7.5, 8),
          look: new THREE.Vector3(150, 1.5, -14),
        };
      } else if (n === 3) {
        // 130 km/h in fifth, overtaking a taxi on the west avenue.
        M.setIndex(0);
        P.reset(-110, 150, Math.PI);
        P.setSpeedKmh(130, 5);
        world.holdKmh = 130;
        world.snapCamera();
        world.police.setWanted(0);
        const taxi = findTaxi();
        taxi.pos.set(-107.4, 0, 116);
        taxi.heading = Math.PI;
        taxi.speed = 11;
        taxi.wp = 0;
        world.state.cash = 0;
      } else if (n === 4) {
        // Mission complete: the package run ends at the promenade.
        M.setIndex(0);
        P.reset(146, -22, 0.6);
        P.setSpeedKmh(0, 1);
        world.holdKmh = 0;
        world.police.setWanted(0);
        world.state.cash = 0;
        world.shotCam = {
          eye: new THREE.Vector3(132, 6.5, 2),
          look: new THREE.Vector3(148, 1.2, -14),
        };
        world.completeMission();
      }
      world.state.shot = n;
      return true;
    },
  };
}
