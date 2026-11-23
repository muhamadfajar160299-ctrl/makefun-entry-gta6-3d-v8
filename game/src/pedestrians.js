// VELMARA pedestrians — people strolling the sidewalks and chatting
// by the marina cafes. Everyone is built facing +Z and walks forward
// along their heading, so nobody ever moonwalks down the street.
(function () {
  var G = (window.G = window.G || {});

  var SHIRTS = [0xe8e4da, 0xd96a5a, 0x5a8ad9, 0x7ac98a, 0xe8c95a, 0xc95a9a, 0x9a7ad9];
  var PANTS = [0x2e3440, 0x4a3a30, 0x3a4a5a, 0x5a5a5a];

  var Pedestrians = {
    walkers: [],
    chatters: [],

    buildPerson: function (shirt, pants) {
      var g = new THREE.Group();
      var skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.8 });
      var shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
      var pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
      var hairMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.95 });
      var body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), shirtMat);
      body.position.y = 1.12;
      g.add(body);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skinMat);
      head.position.y = 1.66;
      g.add(head);
      var hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), hairMat);
      hair.position.y = 1.72;
      hair.scale.set(1, 0.7, 1);
      g.add(hair);
      // Legs swing while walking; arms hang at the sides.
      var legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pantsMat);
      legL.position.set(-0.14, 0.38, 0);
      g.add(legL);
      var legR = legL.clone();
      legR.position.x = 0.14;
      g.add(legR);
      var armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.16), shirtMat);
      armL.position.set(-0.34, 1.1, 0);
      g.add(armL);
      var armR = armL.clone();
      armR.position.x = 0.34;
      g.add(armR);
      g.userData.legL = legL;
      g.userData.legR = legR;
      g.userData.armL = armL;
      g.userData.armR = armR;
      return g;
    },

    init: function (scene) {
      this.walkers = [];
      this.chatters = [];
      var seed = 777;
      function rnd() {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      }
      var streets = G.city.streets;
      // Walkers: each patrols a sidewalk stretch, turns around at the
      // ends, and always faces the way it walks.
      for (var i = 0; i < 18; i++) {
        var shirt = SHIRTS[Math.floor(rnd() * SHIRTS.length)];
        var pants = PANTS[Math.floor(rnd() * PANTS.length)];
        var p = this.buildPerson(shirt, pants);
        var street = streets[Math.floor(rnd() * streets.length)];
        var alongX = rnd() < 0.5;
        var w = {
          group: p,
          alongX: alongX,
          street: street,
          fixed: street + 7.8,
          s: -95 + rnd() * 190,
          dir: rnd() < 0.5 ? 1 : -1,
          speed: 1.1 + rnd() * 0.8,
          phase: rnd() * Math.PI * 2
        };
        p.rotation.y = alongX
          ? (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (w.dir > 0 ? 0 : Math.PI);
        scene.add(p);
        this.walkers.push(w);
      }
      // Chatters: small groups standing by the cafe umbrellas, facing
      // each other, gently bobbing while they talk.
      var cafeZ = [-72, -8, 44];
      for (var c = 0; c < cafeZ.length; c++) {
        for (var k = 0; k < 3; k++) {
          var cp = this.buildPerson(
            SHIRTS[Math.floor(rnd() * SHIRTS.length)],
            PANTS[Math.floor(rnd() * PANTS.length)]
          );
          var a = (k / 3) * Math.PI * 2 + c;
          var cx = 109 + Math.cos(a) * 2.6;
          var cz = cafeZ[c] + Math.sin(a) * 2.6;
          cp.position.set(cx, 0, cz);
          cp.rotation.y = Math.atan2(109 - cx, cafeZ[c] - cz);
          scene.add(cp);
          this.chatters.push({ group: cp, phase: rnd() * Math.PI * 2, baseY: 0 });
        }
      }
    },

    update: function (dt, time) {
      for (var i = 0; i < this.walkers.length; i++) {
        var w = this.walkers[i];
        w.s += w.dir * w.speed * dt;
        if (w.s > 100) { w.s = 100; w.dir = -1; }
        if (w.s < -100) { w.s = -100; w.dir = 1; }
        // Face the direction of travel: heading from (sin, cos).
        var heading = w.alongX
          ? (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (w.dir > 0 ? 0 : Math.PI);
        w.group.rotation.y = heading;
        var x = w.alongX ? w.s : w.fixed;
        var z = w.alongX ? w.fixed : w.s;
        w.group.position.set(x, 0, z);
        // Walk cycle: legs swing opposite, arms counter-swing.
        var sw = Math.sin(time * 6 + w.phase) * 0.55;
        w.group.userData.legL.rotation.x = sw;
        w.group.userData.legR.rotation.x = -sw;
        w.group.userData.armL.rotation.x = -sw * 0.6;
        w.group.userData.armR.rotation.x = sw * 0.6;
      }
      for (var j = 0; j < this.chatters.length; j++) {
        var ch = this.chatters[j];
        ch.group.position.y = Math.sin(time * 1.4 + ch.phase) * 0.03;
        ch.group.rotation.y += Math.sin(time * 0.5 + ch.phase) * 0.0012;
      }
    }
  };

  G.pedestrians = Pedestrians;
})();
