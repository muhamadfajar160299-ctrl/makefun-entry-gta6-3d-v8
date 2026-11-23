// VELMARA police — white interceptors with red/blue strobes. They chase
// the hero, cut across to intercept, and park across the road to block.
// Same +Z-forward convention as every other car: rotation.y = heading.
(function () {
  var G = (window.G = window.G || {});

  var Police = {
    units: [],
    strobeLight: null,
    strobeTimer: 0,
    frozen: false, // screenshot mode parks the units in place

    buildUnit: function (scene) {
      var g = G.vehicles.buildCar({
        body: 0xf2f4f6, length: 4.6, width: 1.95, height: 0.62
      });
      var black = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.5, metalness: 0.4 });
      var door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 1.5), black);
      door.position.set(-0.99, 0.66, -0.2);
      g.add(door);
      var door2 = door.clone();
      door2.position.x = 0.99;
      g.add(door2);
      // Light bar: red left, blue right, emissive so the strobe reads.
      var redMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0xff0000, emissiveIntensity: 2.5 });
      var blueMat = new THREE.MeshStandardMaterial({ color: 0x0033cc, emissive: 0x2244ff, emissiveIntensity: 2.5 });
      var barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.4), black);
      barBase.position.set(0, 1.52, -0.25);
      g.add(barBase);
      var rLens = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.36), redMat);
      rLens.position.set(-0.28, 1.62, -0.25);
      g.add(rLens);
      var bLens = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.36), blueMat);
      bLens.position.set(0.28, 1.62, -0.25);
      g.add(bLens);
      g.userData.redLens = rLens;
      g.userData.blueLens = bLens;
      g.userData.redMat = redMat;
      g.userData.blueMat = blueMat;
      scene.add(g);
      return g;
    },

    init: function (scene) {
      this.units = [];
      for (var i = 0; i < 3; i++) {
        var g = this.buildUnit(scene);
        g.position.set(-40 + i * 40, 0, -40 - i * 8);
        this.units.push({
          group: g, heading: 0, speed: 0,
          mode: "patrol", blockTimer: 0, active: false
        });
      }
      // One shared strobe light that rides the nearest active unit and
      // flips red/blue — cheaper than a light per car, same flashing read.
      this.strobeLight = new THREE.PointLight(0xff2222, 26, 26, 1.6);
      this.strobeLight.position.set(0, 3.4, 0);
      scene.add(this.strobeLight);
    },

    // How many units the wanted level fields: 0, 1, 2 or 3.
    setWanted: function (level) {
      for (var i = 0; i < this.units.length; i++) {
        var u = this.units[i];
        u.active = i < level;
        u.group.visible = u.active;
        if (!u.active) u.speed = 0;
      }
    },

    nearestActive: function (x, z) {
      var best = null, bd = 1e9;
      for (var i = 0; i < this.units.length; i++) {
        var u = this.units[i];
        if (!u.active) continue;
        var dx = u.group.position.x - x, dz = u.group.position.z - z;
        var d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = u; }
      }
      return best;
    },

    update: function (dt, hero) {
      this.strobeTimer += dt;
      var phase = Math.floor(this.strobeTimer * 4) % 2 === 0;
      var anyActive = false;
      for (var i = 0; i < this.units.length; i++) {
        var u = this.units[i];
        if (!u.active) continue;
        anyActive = true;
        // Strobe: alternate which lens burns bright.
        u.group.userData.redMat.emissiveIntensity = phase ? 3.2 : 0.25;
        u.group.userData.blueMat.emissiveIntensity = phase ? 0.25 : 3.2;
        if (this.frozen) continue;
        var hp = hero.pos;
        var dx = hp.x - u.group.position.x;
        var dz = hp.z - u.group.position.z;
        var dist = Math.sqrt(dx * dx + dz * dz) || 1;
        var hf = hero.forward();
        var hSpeed = hero.speed;

        // Pick a tactic by range: far = chase the hero's nose,
        // mid = intercept a point ahead of the hero,
        // close and ahead = block the road.
        var tx, tz, wantSpeed;
        if (dist > 55) {
          u.mode = "chase";
          tx = hp.x; tz = hp.z; wantSpeed = 30;
        } else if (dist > 16) {
          u.mode = "intercept";
          tx = hp.x + hf.x * hSpeed * 0.9;
          tz = hp.z + hf.z * hSpeed * 0.9;
          wantSpeed = 32;
        } else {
          // Block: park across the road just ahead of the hero.
          u.mode = "block";
          tx = hp.x + hf.x * 7;
          tz = hp.z + hf.z * 7;
          wantSpeed = dist > 9 ? 26 : 0;
        }
        var wantHeading = Math.atan2(tx - u.group.position.x, tz - u.group.position.z);
        var dh = wantHeading - u.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        u.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh * 3.2 * dt));
        u.speed += (wantSpeed - u.speed) * Math.min(1, dt * 1.4);
        var fx = Math.sin(u.heading), fz = Math.cos(u.heading);
        u.group.position.x += fx * u.speed * dt;
        u.group.position.z += fz * u.speed * dt;
        G.city.collide(u.group.position, 1.6);
        u.group.rotation.y = u.heading;
        var spin = (u.speed * dt) / 0.37;
        var wheels = u.group.userData.wheels;
        for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += spin;
      }
      // Strobe light follows the nearest active unit, flipping colour.
      if (anyActive) {
        var near = this.nearestActive(hero.pos.x, hero.pos.z);
        if (near) {
          this.strobeLight.position.set(
            near.group.position.x, 3.6, near.group.position.z
          );
          this.strobeLight.color.setHex(phase ? 0xff2222 : 0x2244ff);
          this.strobeLight.intensity = 26;
        }
      } else {
        this.strobeLight.intensity = 0;
      }
    }
  };

  G.police = Police;
})();
