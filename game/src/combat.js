// VELMARA combat — rams, busts and damage. The hero can shove police
// cars by ramming them; ramming traffic or police raises the wanted
// level. Sit still next to a cop for too long and you get busted.
(function () {
  var G = (window.G = window.G || {});

  var Combat = {
    damage: 0, // 0..100, 100 = wrecked
    bustTimer: 0,
    busted: false,
    hitCooldown: 0,

    reset: function () {
      this.damage = 0;
      this.bustTimer = 0;
      this.busted = false;
      this.hitCooldown = 0;
    },

    // Returns an event string ("ram", "bump", "wrecked") or "".
    update: function (dt, state) {
      if (this.hitCooldown > 0) this.hitCooldown -= dt;
      var hero = G.player;
      var event = "";

      // Ram a police unit: push it, dent the hero, raise heat.
      var near = G.police.nearestActive(hero.pos.x, hero.pos.z);
      if (near && this.hitCooldown <= 0) {
        var dx = near.group.position.x - hero.pos.x;
        var dz = near.group.position.z - hero.pos.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < 3.4 && Math.abs(hero.speed) > 4) {
          near.group.position.x += (dx / d) * 2.2;
          near.group.position.z += (dz / d) * 2.2;
          near.speed = Math.max(0, near.speed - 6);
          this.damage = Math.min(100, this.damage + 9);
          this.hitCooldown = 0.7;
          if (state.wanted < 3) state.wanted = 3;
          G.police.setWanted(state.wanted);
          event = "ram";
        }
      }

      // Bump traffic: dent + heat, but only a nudge to the wanted level.
      var tn = G.vehicles.nearest(hero.pos.x, hero.pos.z);
      if (tn.car && this.hitCooldown <= 0) {
        if (tn.dist < 3.2 && Math.abs(hero.speed) > 6) {
          this.damage = Math.min(100, this.damage + 5);
          this.hitCooldown = 0.8;
          if (state.wanted < 1) {
            state.wanted = 1;
            G.police.setWanted(1);
          }
          event = "bump";
        }
      }

      // Busted: slow to a crawl beside a cop for three seconds.
      if (near && Math.abs(hero.speed) < 1.5) {
        var ndx = near.group.position.x - hero.pos.x;
        var ndz = near.group.position.z - hero.pos.z;
        var nd = Math.sqrt(ndx * ndx + ndz * ndz);
        if (nd < 7 && state.wanted > 0) {
          this.bustTimer += dt;
          if (this.bustTimer > 3) {
            this.busted = true;
            event = "busted";
          }
        } else {
          this.bustTimer = 0;
        }
      } else {
        this.bustTimer = 0;
      }

      // Wrecked: pay the repair, respawn on the bayfront, lose the heat.
      if (this.damage >= 100) {
        this.damage = 0;
        state.cash = Math.max(0, state.cash - 150);
        state.wanted = 0;
        G.police.setWanted(0);
        hero.reset(0, 34, Math.PI);
        event = "wrecked";
      }
      return event;
    },

    repair: function () {
      this.damage = 0;
    }
  };

  G.combat = Combat;
})();
