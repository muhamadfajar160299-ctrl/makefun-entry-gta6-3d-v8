// combat.js — melee punches on foot and the player's health.

function tryPunch() {
  const p = G.player;
  if (!p || G.playerCar || p.punchTimer > 0 || G.mode !== 'playing') return;
  p.punchTimer = 0.55;
  p.punchAnim = 0.28;
  if (typeof playPunch === 'function') playPunch();
  // hit whatever is right in front of Rae
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const hx = p.mesh.position.x + fx * 1.6;
  const hz = p.mesh.position.z + fz * 1.6;
  if (typeof hitPedAt === 'function' && hitPedAt(hx, hz, 1.5)) {
    addCrime(1, 'Assault!');
    if (typeof showToast === 'function') showToast('You knocked them flat!');
  }
}

function damagePlayer(amount) {
  if (G.mode !== 'playing') return;
  G.health = Math.max(G.shot ? 25 : 0, G.health - amount);   // staged shots stay alive
  if (typeof updateHealthHud === 'function') updateHealthHud();
  if (G.health <= 0) {
    if (typeof showScreen === 'function') showScreen('wasted');
    else G.mode = 'wasted';
  }
}

function healPlayer(dt) {
  if (G.mode !== 'playing' || G.wanted > 0) return;
  if (G.health < 100) {
    G.health = Math.min(100, G.health + 2.2 * dt);
    if (typeof updateHealthHud === 'function') updateHealthHud();
  }
}
