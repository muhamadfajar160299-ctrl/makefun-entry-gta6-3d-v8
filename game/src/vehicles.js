// VELMARA traffic — vans, taxis and sedans cruising the street grid.
// Every car is built facing +Z in local space and steered with
// rotation.y = heading, where forward = (sin(heading), cos(heading)),
// so no car ever drives 90 degrees sideways. Wheels spin on their
// proper axle (local X).
(function () {
  var G = (window.G = window.G || {});

  var STREETS = [-80, -40, 0, 40, 80];
  var COLORS = [0x3a6fd8, 0xcfd6de, 0x2f3338, 0x8a2f3c, 0x4a7a5a, 0xc8a03a, 0x6a5a8a];

  function makeWheelGeo() {
    // Cylinder axis is Y by default; rotate it onto X (the axle).
    var g = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
    g.rotateZ(Math.PI / 2);
    return g;
  }

  var Vehicles = {
    cars: [],
    wheelGeo: null,

    buildCar: function (opts) {
      // opts: { body, cabin, length, width, height, taxi, van }
      var g = new THREE.Group();
      var bodyMat = new THREE.MeshStandardMaterial({
        color: opts.body, roughness: 0.35, metalness: 0.55
      });
      var glassMat = new THREE.MeshStandardMaterial({
        color: 0x1c2733, roughness: 0.12, metalness: 0.7
      });
      var L = opts.length || 4.4, W = opts.width || 1.9, H = opts.height || 0.62;
      var body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), bodyMat);
      body.position.y = 0.62;
      g.add(body);
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.55, L * 0.48), glassMat);
      cabin.position.set(0, 1.18, -L * 0.06);
      g.add(cabin);
      if (opts.van) {
        var boxTop = new THREE.Mesh(new THREE.BoxGeometry(W, 0.85, L * 0.86), bodyMat);
        boxTop.position.set(0, 1.35, -L * 0.04);
        g.add(boxTop);
      }
      // Headlights (front = +Z) and taillights (rear = -Z).
      var lightMat = new THREE.MeshStandardMaterial({
        color: 0xfff6c8, emissive: 0xffedb0, emissiveIntensity: 1.6
      });
      var tailMat = new THREE.MeshStandardMaterial({
        color: 0xaa1111, emissive: 0xdd1111, emissiveIntensity: 1.2
      });
      [-1, 1].forEach(function (s) {
        var hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), lightMat);
        hl.position.set(s * (W / 2 - 0.3), 0.68, L / 2 + 0.02);
        g.add(hl);
        var tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
        tl.position.set(s * (W / 2 - 0.3), 0.68, -L / 2 - 0.02);
        g.add(tl);
      });
      if (opts.taxi) {
        var sign = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.22, 0.3),
          new THREE.MeshStandardMaterial({ color: 0xffc400, emissive: 0xffb400, emissiveIntensity: 0.9 })
        );
        sign.position.set(0, 1.55, -L * 0.06);
        g.add(sign);
        var stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.2, L + 0.02),
          new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.5 }));
        stripe.position.y = 0.62;
        g.add(stripe);
      }
      // Wheels: axle along X, so spin is rotation.x.
      var wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
      var wheels = [];
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (p) {
        var w = new THREE.Mesh(Vehicles.wheelGeo, wheelMat);
        w.position.set(p[0] * (W / 2 - 0.05), 0.36, p[1] * (L / 2 - 0.75));
        g.add(w);
        wheels.push(w);
      });
      g.userData.wheels = wheels;
      g.userData.taxi = !!opts.taxi;
      g.userData.van = !!opts.van;
      return g;
    },

    init: function (scene) {
      this.wheelGeo = makeWheelGeo();
      this.cars = [];
      var seed = 4242;
      function rnd() {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      }
      for (var i = 0; i < 14; i++) {
        var kind = rnd();
        var car;
        if (kind < 0.25) {
          car = this.buildCar({ body: 0xdfe3e8, length: 5.2, width: 2.0, height: 0.7, van: true });
        } else if (kind < 0.5) {
          car = this.buildCar({ body: 0xf5f2e8, length: 4.5, width: 1.9, height: 0.6, taxi: true });
        } else {
          car = this.buildCar({ body: COLORS[Math.floor(rnd() * COLORS.length)] });
        }
        var alongX = rnd() < 0.5;
        var street = STREETS[Math.floor(rnd() * STREETS.length)];
        var dir = rnd() < 0.5 ? 1 : -1;
        var t = {
          group: car,
          alongX: alongX,
          street: street,
          dir: dir,
          speed: 8 + rnd() * 6,
          s: -100 + rnd() * 200 // distance along the street
        };
        // Heading from the drive direction; front (+Z local) follows it.
        t.heading = alongX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
        car.rotation.y = t.heading;
        scene.add(car);
        this.cars.push(t);
      }
    },

    update: function (dt) {
      for (var i = 0; i < this.cars.length; i++) {
        var t = this.cars[i];
        t.s += t.dir * t.speed * dt;
        if (t.s > 106) t.s = -106;
        if (t.s < -106) t.s = 106;
        var x, z;
        if (t.alongX) {
          x = t.s;
          z = t.street + (t.dir > 0 ? -3 : 3); // keep right
        } else {
          x = t.street + (t.dir > 0 ? 3 : -3);
          z = t.s;
        }
        t.group.position.set(x, 0, z);
        // Wheels spin around the X axle, proportional to road speed.
        var spin = (t.speed * dt) / 0.36;
        var wheels = t.group.userData.wheels;
        for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += spin;
      }
    },

    // Nearest traffic car to a point, for collision checks.
    nearest: function (x, z) {
      var best = null, bd = 1e9;
      for (var i = 0; i < this.cars.length; i++) {
        var p = this.cars[i].group.position;
        var dx = p.x - x, dz = p.z - z;
        var d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = this.cars[i]; }
      }
      return { car: best, dist: Math.sqrt(bd) };
    }
  };

  G.vehicles = Vehicles;
})();
