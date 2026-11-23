// VELMARA hero car — the red getaway coupe. WASD / arrows drive it,
// Space brakes, gears and km/h show in the HUD. The model is built
// facing +Z and steered with rotation.y = heading, so the nose always
// points where the car is going.
(function () {
  var G = (window.G = window.G || {});

  function makeWheelGeo() {
    var g = new THREE.CylinderGeometry(0.37, 0.37, 0.3, 14);
    g.rotateZ(Math.PI / 2); // axle onto X
    return g;
  }

  var Player = {
    group: null,
    wheels: [],
    frontWheels: [],
    pos: null,
    heading: Math.PI, // start heading south down 0-street... set in reset()
    speed: 0, // m/s, signed
    steer: 0,
    throttle: 0,
    headlightCones: [],

    build: function (scene) {
      var g = new THREE.Group();
      var red = new THREE.MeshStandardMaterial({ color: 0xd21f26, roughness: 0.32, metalness: 0.6 });
      var darkRed = new THREE.MeshStandardMaterial({ color: 0x8a1218, roughness: 0.4, metalness: 0.5 });
      var glass = new THREE.MeshStandardMaterial({ color: 0x182430, roughness: 0.1, metalness: 0.75 });
      var chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.2, metalness: 0.9 });

      var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.6), red);
      body.position.y = 0.62;
      g.add(body);
      var nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 0.5), darkRed);
      nose.position.set(0, 0.5, 2.35);
      g.add(nose);
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.2), glass);
      cabin.position.set(0, 1.12, -0.3);
      g.add(cabin);
      var roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 2.0), red);
      roof.position.set(0, 1.4, -0.3);
      g.add(roof);
      // Spoiler on the rear deck.
      var wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.5), darkRed);
      wing.position.set(0, 1.12, -2.2);
      g.add(wing);
      [-0.7, 0.7].forEach(function (x) {
        var strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.3), darkRed);
        strut.position.set(x, 0.94, -2.2);
        g.add(strut);
      });
      // Twin exhausts at the rear.
      [-0.5, 0.5].forEach(function (x) {
        var ex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), chrome);
        ex.rotation.x = Math.PI / 2;
        ex.position.set(x, 0.42, -2.35);
        g.add(ex);
      });
      // Headlights and taillights.
      var hlMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffedb0, emissiveIntensity: 2.0 });
      var tlMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xff2222, emissiveIntensity: 1.6 });
      [-0.62, 0.62].forEach(function (x) {
        var hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), hlMat);
        hl.position.set(x, 0.66, 2.32);
        g.add(hl);
        var tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.08), tlMat);
        tl.position.set(x, 0.66, -2.32);
        g.add(tl);
      });
      // Wheels on the X axle; front pair also yaws with steering.
      var wg = makeWheelGeo();
      var wm = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
      var hubMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 0.3, metalness: 0.8 });
      this.wheels = [];
      this.frontWheels = [];
      var self = this;
      [[-0.95, 1.45, true], [0.95, 1.45, true], [-0.95, -1.45, false], [0.95, -1.45, false]].forEach(function (p) {
        var pivot = new THREE.Group();
        pivot.position.set(p[0], 0.37, p[1]);
        var wheel = new THREE.Mesh(wg, wm);
        var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10), hubMat);
        hub.rotation.z = Math.PI / 2;
        pivot.add(wheel);
        pivot.add(hub);
        g.add(pivot);
        self.wheels.push(wheel);
        if (p[2]) self.frontWheels.push(pivot);
      });

      // Headlight beams: slim additive cones, tilted down, faint.
      var coneGeo = new THREE.ConeGeometry(1.5, 11, 12, 1, true);
      // rotateX(-90deg) puts the cone apex at -Z and the base at +Z;
      // translating +5.5 moves the apex to the lamp and the beam runs +Z.
      coneGeo.rotateX(-Math.PI / 2);
      coneGeo.translate(0, 0, 5.5);
      var coneMat = new THREE.MeshBasicMaterial({
        color: 0xfff2c0, transparent: true, opacity: 0.13,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      });
      [-0.62, 0.62].forEach(function (x) {
        var cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(x, 0.62, 2.3);
        cone.rotation.x = 0.14; // tilt the beam down toward the road
        g.add(cone);
        self.headlightCones.push(cone);
      });

      this.group = g;
      this.pos = new THREE.Vector3(0, 0, 34);
      scene.add(g);
    },

    reset: function (x, z, heading) {
      this.pos.set(x, 0, z);
      this.heading = heading === undefined ? Math.PI : heading;
      this.speed = 0;
      this.steer = 0;
      this.group.position.copy(this.pos);
      this.group.rotation.y = this.heading;
    },

    forward: function () {
      return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    },

    speedKmh: function () {
      return Math.abs(this.speed) * 3.6;
    },

    gear: function () {
      var k = this.speedKmh();
      if (k < 1) return "N";
      if (k < 32) return "1";
      if (k < 62) return "2";
      if (k < 92) return "3";
      if (k < 122) return "4";
      return "5";
    },

    // keys: {up, down, left, right, brake} — dt seconds.
    update: function (dt, keys) {
      var maxFwd = 47; // ~169 km/h
      var maxRev = 12;
      var accel = keys.up ? 15 : 0;
      var braking = keys.brake || keys.down;
      if (keys.up) this.speed += accel * dt;
      if (keys.down) {
        if (this.speed > 0.5) this.speed -= 26 * dt; // brake while rolling forward
        else this.speed -= 9 * dt; // reverse
      }
      if (braking && keys.up) this.speed -= 0; // no-op guard
      // Drag and rolling resistance.
      this.speed -= this.speed * 0.35 * dt;
      if (!keys.up && !keys.down) this.speed -= this.speed * 0.9 * dt;
      if (this.speed > maxFwd) this.speed = maxFwd;
      if (this.speed < -maxRev) this.speed = -maxRev;
      if (Math.abs(this.speed) < 0.08 && !keys.up && !keys.down) this.speed = 0;

      // Steering: stronger at low speed, eases off as speed rises.
      var steerTarget = 0;
      if (keys.left) steerTarget = 1;
      if (keys.right) steerTarget = -1;
      this.steer += (steerTarget - this.steer) * Math.min(1, dt * 9);
      var spd = this.speed;
      var turn = this.steer * 1.9 * Math.min(1, Math.abs(spd) / 8) * (spd >= 0 ? 1 : -1);
      this.heading += turn * dt * Math.min(1, Math.abs(spd) / 6 + 0.25);

      var f = this.forward();
      this.pos.x += f.x * spd * dt;
      this.pos.z += f.z * spd * dt;
      G.city.collide(this.pos, 1.6);

      this.group.position.copy(this.pos);
      this.group.rotation.y = this.heading;
      // Wheel spin on the X axle; front pivots yaw with the steering.
      var spin = (spd * dt) / 0.37;
      for (var i = 0; i < this.wheels.length; i++) this.wheels[i].rotation.x += spin;
      for (var j = 0; j < this.frontWheels.length; j++) {
        this.frontWheels[j].rotation.y = this.steer * 0.38;
      }
      this.throttle = keys.up ? 1 : 0;
    }
  };

  G.player = Player;
})();
