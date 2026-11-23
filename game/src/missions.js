// missions.js — five jobs across Velmara Bay.
//
// Each mission: a floating gold diamond over the target, a beam of light
// marking it from across the city, live distance in the HUD, and $400 on
// completion. Finishing a job raises the heat: later missions start with
// the PD already looking for you.
const THREE = window.THREE;

export const MISSIONS = [
  {
    id: 1, name: 'MARINA PICKUP',
    text: 'Drive to the marina promenade and pick up the package.',
    flavor: 'Package secured. Clean getaway. The next job is already lined up.',
    target: { x: 140, z: 20 }, wantedOnStart: 0,
  },
  {
    id: 2, name: 'DOWNTOWN DROP',
    text: 'Take the package downtown. Lose the tail on 5th Avenue first.',
    flavor: 'Drop made. The buyer paid in full — and the PD noticed.',
    target: { x: -50, z: -50 }, wantedOnStart: 1,
  },
  {
    id: 3, name: 'HARBOR RUN',
    text: 'A crate is waiting at the north harbor gate. Go get it, fast.',
    flavor: 'Crate loaded. That was the easy part — now run.',
    target: { x: 50, z: -100 }, wantedOnStart: 2,
  },
  {
    id: 4, name: 'NEON EXCHANGE',
    text: 'Meet the fixer under the neon row. Do not keep her waiting.',
    flavor: 'Exchange complete. The fixer says you drive like a ghost.',
    target: { x: -100, z: 50 }, wantedOnStart: 2,
  },
  {
    id: 5, name: 'BAY GETAWAY',
    text: 'Final job: cross the bayfront and vanish into the marina lights.',
    flavor: 'All five jobs done. Velmara Bay is yours tonight.',
    target: { x: 140, z: 90 }, wantedOnStart: 3,
  },
];

export function createMissions(scene) {
  const marker = new THREE.Group();
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.25),
    new THREE.MeshStandardMaterial({
      color: 0xffc93c, emissive: 0xffb020, emissiveIntensity: 1.4,
      roughness: 0.25, metalness: 0.6,
    }),
  );
  diamond.position.y = 3.4;
  marker.add(diamond);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.85, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd76a, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 17;
  marker.add(beam);
  const glow = new THREE.PointLight(0xffc93c, 18, 22, 1.2);
  glow.position.y = 3.4;
  marker.add(glow);
  scene.add(marker);

  const missions = {
    list: MISSIONS,
    index: 0,
    marker, diamond, beam,
    get current() { return MISSIONS[this.index]; },
    get done() { return this.index >= MISSIONS.length; },
    distanceTo(player) {
      const m = this.current;
      if (!m) return 0;
      return Math.hypot(m.target.x - player.x, m.target.z - player.z);
    },
    start(index, player) {
      this.index = Math.max(0, Math.min(index, MISSIONS.length - 1));
      const m = this.current;
      marker.position.set(m.target.x, 0, m.target.z);
      marker.visible = true;
      return m;
    },
    update(dt, t, player) {
      diamond.rotation.y += dt * 1.6;
      diamond.position.y = 3.4 + Math.sin(t * 2) * 0.35;
      beam.material.opacity = 0.16 + Math.sin(t * 2.2) * 0.05;
    },
    tryComplete(player, game) {
      if (this.done) return false;
      if (this.distanceTo(player) < 6.5) {
        game.cash += 400;
        game.state = 'complete';
        game.hud.showComplete(this.current);
        game.audio.cashRegister();
        marker.visible = false;
        return true;
      }
      return false;
    },
    next() {
      this.index += 1;
      if (this.done) {
        marker.visible = false;
        return null;
      }
      const m = this.current;
      marker.position.set(m.target.x, 0, m.target.z);
      marker.visible = true;
      return m;
    },
  };
  missions.start(0);
  return missions;
}
