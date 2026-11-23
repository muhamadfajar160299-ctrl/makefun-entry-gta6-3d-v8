// VELMARA screenshot scenarios — ?shot=1..4 drops the game straight
// into a staged moment so the capture script can shoot it. Each one
// sets the hero, the traffic, the police and the HUD to fixed values,
// freezes the police AI, and skips the start screen.
(function () {
  var G = (window.G = window.G || {});

  var Shots = {
    id: 0,
    cameraMode: "chase",

    read: function () {
      try {
        var q = new URLSearchParams(window.location.search);
        var n = parseInt(q.get("shot") || "0", 10);
        this.id = isNaN(n) ? 0 : n;
      } catch (err) {
        this.id = 0;
      }
      return this.id;
    },

    // Called after the world is built, before the first frame.
    apply: function (state) {
      var id = this.id;
      if (!id) return false;
      var hero = G.player;
      G.police.frozen = true;
      state.started = true;
      state.paused = false;
      G.hud.hideStart();

      if (id === 1) {
        // Police chase: hero on the 0-street at 72 km/h in 3rd, three
        // white interceptors around it, wanted 3, zebra dead ahead.
        this.cameraMode = "chase";
        hero.reset(0, 18, Math.PI);
        hero.speed = 20; // 72 km/h
        state.wanted = 3;
        state.cash = 0;
        G.police.setWanted(3);
        var spots = [
          { x: -5.5, z: 2, h: Math.PI },
          { x: 5.5, z: 4, h: Math.PI },
          { x: 0, z: -8, h: 0 }
        ];
        G.police.units.forEach(function (u, i) {
          u.group.position.set(spots[i].x, 0, spots[i].z);
          u.heading = spots[i].h;
          u.group.rotation.y = spots[i].h;
          u.speed = 20;
        });
        G.missions.setIndex(0);
      } else if (id === 2) {
        // Marina: hero parked by the promenade, gold diamond 9 m away,
        // yachts and water behind, palms and a red cafe umbrella close.
        this.cameraMode = "marina";
        hero.reset(105, -52, 2.82);
        hero.speed = 0;
        state.wanted = 0;
        state.cash = 0;
        G.police.setWanted(0);
        G.missions.setIndex(0);
      } else if (id === 3) {
        // Flat out: 130 km/h in 5th down a tower canyon, a white taxi
        // ahead in the same lane.
        this.cameraMode = "chase";
        hero.reset(0, 44, Math.PI);
        hero.speed = 36.1; // 130 km/h
        state.wanted = 1;
        state.cash = 0;
        G.police.setWanted(1);
        var taxi = null;
        for (var i = 0; i < G.vehicles.cars.length; i++) {
          var c = G.vehicles.cars[i];
          if (!c.group.userData.taxi) continue;
          taxi = c;
          break;
        }
        if (taxi) {
          taxi.alongX = false;
          taxi.street = 0;
          taxi.dir = -1;
          taxi.s = 8;
          taxi.speed = 11;
          taxi.heading = Math.PI;
          taxi.group.rotation.y = Math.PI;
          taxi.group.position.set(3, 0, 8);
        }
        G.missions.setIndex(0);
      } else if (id === 4) {
        // Mission complete: the overlay over a bright marina, +$400.
        this.cameraMode = "marina";
        hero.reset(105, -52, 2.82);
        hero.speed = 0;
        state.wanted = 0;
        state.cash = 400;
        G.police.setWanted(0);
        G.missions.setIndex(0);
        G.missions.done = true;
        if (G.missions.marker) G.missions.marker.visible = true;
        var job = G.missions.current();
        G.hud.showComplete(job);
      }
      return true;
    },

    // Camera for the staged shots. Chase follows the hero; marina uses
    // a high side angle so the diamond, yachts and cafes all read.
    updateCamera: function (camera, hero, dt) {
      if (this.cameraMode === "marina") {
        var f = hero.forward();
        var tx = hero.pos.x + f.x * 6;
        var tz = hero.pos.z + f.z * 6;
        camera.position.set(
          hero.pos.x - f.x * 10 + 13,
          8.5,
          hero.pos.z - f.z * 10 + 9
        );
        camera.lookAt(tx, 1.6, tz);
        return;
      }
      var b = hero.forward();
      var cx = hero.pos.x - b.x * 9.5;
      var cz = hero.pos.z - b.z * 9.5;
      camera.position.set(cx, 4.4, cz);
      camera.lookAt(hero.pos.x + b.x * 7, 1.4, hero.pos.z + b.z * 7);
    }
  };

  G.shots = Shots;
})();
