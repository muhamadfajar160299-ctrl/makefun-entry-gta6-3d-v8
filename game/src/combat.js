// Marina Nights — collisions & damage. Hard hits damage the car (shown on
// the HUD damage bar); at 100 damage the car is "wasted". Pedestrians are
// never harmed: they dodge and the car just passes.
export function createCombat(G) {
  const REPAIR_RATE = 0.6; // damage slowly recovers while driving clean

  function addDamage(amount) {
    if (G.state.over || !G.state.started) return;
    G.state.damage = Math.min(100, G.state.damage + amount);
    G.hud.setDamage(G.state.damage);
    if (amount > 4) G.audio.crash();
    if (G.state.damage >= 100) {
      G.state.over = true;
      G.state.overKind = 'wasted';
      G.audio.busted();
      G.hud.showScreen('wasted');
    }
  }

  function update(dt) {
    if (G.state.over || !G.state.started || G.state.paused) return;
    // slow self-repair
    if (G.state.damage > 0) {
      G.state.damage = Math.max(0, G.state.damage - REPAIR_RATE * dt);
      G.hud.setDamage(G.state.damage);
    }
    const p = G.player.pos;
    // traffic collisions: bump apart + damage by impact speed
    for (const car of G.traffic.cars) {
      const dx = p.x - car.group.position.x;
      const dz = p.z - car.group.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 10.2 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (3.2 - d) / 2;
        const nx = dx / d, nz = dz / d;
        p.x += nx * push;
        p.z += nz * push;
        const impact = Math.abs(G.player.speed) + car.speed;
        if (impact > 14) addDamage((impact - 14) * 0.55);
      }
    }
    // police contact: shove, small damage, bust handled in police.js
    for (const car of G.police.cars) {
      const dx = p.x - car.pos.x;
      const dz = p.z - car.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 10.2 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (3.2 - d) / 2;
        p.x += (dx / d) * push;
        p.z += (dz / d) * push;
        if (Math.abs(G.player.speed) > 12) addDamage(2);
      }
    }
    // pedestrians dodge — never harmed
    G.peds.dodge(p);
  }

  return { update, addDamage };
}
