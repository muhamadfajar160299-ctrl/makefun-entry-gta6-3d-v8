// VELMARA city — Velmara Bay at night: a street grid, mid-tone towers
// with glowing windows, and a marina promenade with yachts, palms and
// red cafe umbrellas. The asphalt is blue-grey, never black, so the
// streets read clearly under the bright-night rig.
(function () {
  var G = (window.G = window.G || {});

  var STREETS = [-80, -40, 0, 40, 80];
  var ROAD_W = 12;
  var BLOCKS = [-60, -20, 20, 60];
  var MARINA_X = 100; // promenade starts here; water past x = 116
  var WATER_X = 116;

  function rand(seed) {
    var s = seed;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // Facade texture: mid-tone wall with a grid of windows, some lit warm,
  // some lit cool, some dark. A second canvas holds only the lit windows
  // so it can drive the emissive map.
  function facadeTextures(base, seed) {
    var r = rand(seed);
    var c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    var g = c.getContext("2d");
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    var e = document.createElement("canvas");
    e.width = 256;
    e.height = 256;
    var eg = e.getContext("2d");
    eg.fillStyle = "#000000";
    eg.fillRect(0, 0, 256, 256);
    var cols = 6, rows = 10;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var wx = 14 + x * 40, wy = 12 + y * 24;
        var roll = r();
        var lit = roll < 0.42 ? "#ffd9a0" : roll < 0.62 ? "#cfe6ff" : "#232c3d";
        g.fillStyle = lit;
        g.fillRect(wx, wy, 24, 14);
        if (lit !== "#232c3d") {
          eg.fillStyle = lit;
          eg.fillRect(wx, wy, 24, 14);
        }
      }
    }
    var map = new THREE.CanvasTexture(c);
    var emissive = new THREE.CanvasTexture(e);
    return { map: map, emissive: emissive };
  }

  function box(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  // Merge many small same-material pieces into one draw call. Each part
  // carries its own (already rotated) geometry plus a translation; the
  // helper concatenates positions, normals, uvs and indices.
  function mergeParts(parts) {
    var pos = [], norm = [], uv = [], idx = [];
    var base = 0;
    parts.forEach(function (part) {
      var g = part.geo;
      var p = g.attributes.position.array;
      var n = g.attributes.normal.array;
      var u = g.attributes.uv ? g.attributes.uv.array : null;
      var verts = p.length / 3;
      for (var v = 0; v < verts; v++) {
        pos.push(p[v * 3] + part.x, p[v * 3 + 1] + part.y, p[v * 3 + 2] + part.z);
        norm.push(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]);
        if (u) uv.push(u[v * 2], u[v * 2 + 1]);
      }
      var index = g.index.array;
      for (var j = 0; j < index.length; j++) idx.push(index[j] + base);
      base += verts;
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
    if (uv.length) out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    out.setIndex(idx);
    return out;
  }

  function flatGeo(geo) {
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  var City = {
    streets: STREETS,
    marinaX: MARINA_X,
    waterX: WATER_X,
    colliders: [],
    lampLights: [],

    build: function (scene) {
      var self = this;
      this.colliders = [];
      var r = rand(1234567);

      // Ground base: blue-grey so gaps between roads stay readable.
      var ground = new THREE.Mesh(
        new THREE.PlaneGeometry(560, 380),
        new THREE.MeshStandardMaterial({ color: 0x46536b, roughness: 0.95 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(60, 0, 0);
      scene.add(ground);

      var asphalt = new THREE.MeshStandardMaterial({ color: 0x5f7089, roughness: 0.85, metalness: 0.08 });
      var sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x8b98b0, roughness: 0.9 });
      var lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f2df });
      var yellowMat = new THREE.MeshBasicMaterial({ color: 0xffd75e });
      // Road paint is merged into two draw calls (white / yellow) so the
      // hundreds of dashes and zebra bars cost almost nothing.
      var whiteParts = [];
      var yellowParts = [];

      // Roads: one strip per street, both directions, plus sidewalks.
      STREETS.forEach(function (c) {
        var rx = new THREE.Mesh(new THREE.PlaneGeometry(220, ROAD_W), asphalt);
        rx.rotation.x = -Math.PI / 2;
        rx.position.set(0, 0.02, c);
        scene.add(rx);
        var rz = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 220), asphalt);
        rz.rotation.x = -Math.PI / 2;
        rz.position.set(c, 0.02, 0);
        scene.add(rz);
        var sx = new THREE.Mesh(new THREE.PlaneGeometry(220, 3.4), sidewalkMat);
        sx.rotation.x = -Math.PI / 2;
        sx.position.set(0, 0.03, c + ROAD_W / 2 + 1.7);
        scene.add(sx);
        var sz = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 220), sidewalkMat);
        sz.rotation.x = -Math.PI / 2;
        sz.position.set(c + ROAD_W / 2 + 1.7, 0.03, 0);
        scene.add(sz);
        // Dashed centre lines, skipping the intersections.
        for (var d = -104; d <= 104; d += 8) {
          if (STREETS.some(function (s) { return Math.abs(d - s) < 9; })) continue;
          whiteParts.push({ geo: flatGeo(new THREE.PlaneGeometry(3.2, 0.28)), x: d, y: 0.05, z: c });
          whiteParts.push({ geo: flatGeo(new THREE.PlaneGeometry(0.28, 3.2)), x: c, y: 0.05, z: d });
        }
        // Yellow edge lines along each road.
        [-1, 1].forEach(function (side) {
          yellowParts.push({ geo: flatGeo(new THREE.PlaneGeometry(220, 0.3)), x: 0, y: 0.05, z: c + side * (ROAD_W / 2 - 0.8) });
        });
      });
      scene.add(new THREE.Mesh(mergeParts(whiteParts), lineMat));
      scene.add(new THREE.Mesh(mergeParts(yellowParts), yellowMat));

      // Zebra crossings at every intersection: six bars across the road.
      var zebraParts = [];
      STREETS.forEach(function (cx) {
        STREETS.forEach(function (cz) {
          for (var i = -2.5; i <= 2.5; i++) {
            zebraParts.push({ geo: flatGeo(new THREE.PlaneGeometry(3.4, 1.1)), x: cx + i * 1.9, y: 0.05, z: cz + ROAD_W / 2 + 1.5 });
            zebraParts.push({ geo: flatGeo(new THREE.PlaneGeometry(1.1, 3.4)), x: cx + ROAD_W / 2 + 1.5, y: 0.05, z: cz + i * 1.9 });
          }
        });
      });
      scene.add(new THREE.Mesh(mergeParts(zebraParts), lineMat));

      // Towers: one or two per block, mid-tone facades, glowing windows.
      var bases = ["#8a7f72", "#7d8aa0", "#9a8a7a", "#6f7f95", "#93817a", "#7a8a80"];
      var seed = 11;
      BLOCKS.forEach(function (bx) {
        BLOCKS.forEach(function (bz) {
          var count = r() < 0.5 ? 1 : 2;
          for (var k = 0; k < count; k++) {
            var w = 15 + r() * 7, d = 15 + r() * 7;
            var h = 13 + r() * 26;
            var ox = count === 1 ? 0 : (k === 0 ? -7 : 7);
            var oz = count === 1 ? 0 : (k === 0 ? 6 : -6);
            var tex = facadeTextures(bases[Math.floor(r() * bases.length)], seed++);
            var mat = new THREE.MeshStandardMaterial({
              map: tex.map, emissiveMap: tex.emissive,
              emissive: 0xffffff, emissiveIntensity: 0.85,
              roughness: 0.85, metalness: 0.05
            });
            var b = box(w, h, d, mat, bx + ox, h / 2, bz + oz);
            scene.add(b);
            var roof = box(w + 0.6, 0.7, d + 0.6,
              new THREE.MeshStandardMaterial({ color: 0x3c4658, roughness: 0.9 }),
              bx + ox, h + 0.35, bz + oz);
            scene.add(roof);
            self.colliders.push({
              minX: bx + ox - w / 2 - 0.4, maxX: bx + ox + w / 2 + 0.4,
              minZ: bz + oz - d / 2 - 0.4, maxZ: bz + oz + d / 2 + 0.4
            });
          }
        });
      });

      // Distant skyline for depth, far west and north.
      var farMat = new THREE.MeshStandardMaterial({ color: 0x2c3550, roughness: 1 });
      for (var f = 0; f < 10; f++) {
        var fh = 30 + r() * 40;
        var fb = box(18, fh, 18, farMat, -150 - r() * 60, fh / 2, -140 + f * 32);
        scene.add(fb);
      }

      this.buildMarina(scene, r);
      this.buildLamps(scene, r);
      this.buildPuddles(scene, r);
      this.buildStars(scene, r);
    },

    buildMarina: function (scene, r) {
      // Promenade: pale pavement between the last street and the water.
      var prom = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 240),
        new THREE.MeshStandardMaterial({ color: 0x9aa3b5, roughness: 0.85 })
      );
      prom.rotation.x = -Math.PI / 2;
      prom.position.set(MARINA_X + 8, 0.04, 0);
      scene.add(prom);

      // Water: dark teal, low roughness so the moon and lamps glint on it.
      var water = new THREE.Mesh(
        new THREE.PlaneGeometry(170, 340),
        new THREE.MeshStandardMaterial({ color: 0x1d4e6b, roughness: 0.12, metalness: 0.55 })
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(WATER_X + 84, 0.01, 0);
      scene.add(water);

      // Railing along the water edge.
      var railMat = new THREE.MeshStandardMaterial({ color: 0xd8dee8, roughness: 0.4, metalness: 0.7 });
      var rail = box(0.18, 0.18, 240, railMat, WATER_X - 0.6, 1.05, 0);
      scene.add(rail);
      for (var z = -118; z <= 118; z += 8) {
        scene.add(box(0.14, 1.05, 0.14, railMat, WATER_X - 0.6, 0.52, z));
      }

      // Yachts moored off the promenade.
      var hullMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.35, metalness: 0.2 });
      var hullBlue = new THREE.MeshStandardMaterial({ color: 0x274b7a, roughness: 0.4, metalness: 0.2 });
      var yachtSpots = [
        { x: 132, z: -84, s: 1.1 }, { x: 150, z: -38, s: 0.9 }, { x: 136, z: 8, s: 1.2 },
        { x: 158, z: 52, s: 1.0 }, { x: 138, z: 92, s: 0.85 }
      ];
      yachtSpots.forEach(function (ys) {
        var g = new THREE.Group();
        g.add(box(9 * ys.s, 1.1, 2.8 * ys.s, hullMat, 0, 0.55, 0));
        g.add(box(4.5 * ys.s, 1.3, 2.0 * ys.s, hullBlue, -0.6, 1.7, 0));
        var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7.5, 6),
          new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.6 }));
        mast.position.set(0.6, 5.2, 0);
        g.add(mast);
        g.position.set(ys.x, 0, ys.z);
        g.rotation.y = (r() - 0.5) * 0.5;
        scene.add(g);
      });

      // Palms down the promenade.
      var trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.95 });
      var frondMat = new THREE.MeshStandardMaterial({ color: 0x3fae5a, roughness: 0.8 });
      for (var pz = -96; pz <= 96; pz += 24) {
        var px = MARINA_X + 3.5;
        var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6.5, 7), trunkMat);
        trunk.position.set(px, 3.25, pz);
        scene.add(trunk);
        for (var fi = 0; fi < 6; fi++) {
          var frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.6, 4), frondMat);
          var a = (fi / 6) * Math.PI * 2;
          frond.position.set(px + Math.cos(a) * 1.3, 6.9, pz + Math.sin(a) * 1.3);
          frond.rotation.z = Math.cos(a) * 1.1;
          frond.rotation.x = -Math.sin(a) * 1.1;
          frond.scale.set(1, 1, 0.35);
          scene.add(frond);
        }
      }

      // Cafes: round table, red umbrella, chairs.
      var tableMat = new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.6 });
      var umbMat = new THREE.MeshStandardMaterial({ color: 0xd43a2f, roughness: 0.7 });
      var poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.5 });
      [-72, -8, 44].forEach(function (cz) {
        var cx = MARINA_X + 9;
        var table = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 12), tableMat);
        table.position.set(cx, 0.85, cz);
        scene.add(table);
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.85, 6), poleMat);
        leg.position.set(cx, 0.42, cz);
        scene.add(leg);
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), poleMat);
        pole.position.set(cx, 1.3, cz);
        scene.add(pole);
        var umb = new THREE.Mesh(new THREE.ConeGeometry(2.3, 0.9, 10), umbMat);
        umb.position.set(cx, 2.75, cz);
        scene.add(umb);
        scene.add(box(0.9, 0.9, 0.9, tableMat, cx + 1.8, 0.45, cz + 0.6));
        scene.add(box(0.9, 0.9, 0.9, tableMat, cx - 1.8, 0.45, cz - 0.6));
      });
    },

    buildLamps: function (scene, r) {
      // 55 lamp posts along the streets; 12 carry a real point light,
      // every post gets an additive light pool on the ground so the
      // streets glow even where there is no real light.
      var poleMat = new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.5, metalness: 0.6 });
      var headMat = new THREE.MeshStandardMaterial({
        color: 0xfff2cf, emissive: 0xffd9a0, emissiveIntensity: 2.2, roughness: 0.4
      });
      var poolMat = new THREE.MeshBasicMaterial({
        color: 0xffc98a, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      var spots = [];
      STREETS.forEach(function (c) {
        for (var d = -88; d <= 88; d += 44) {
          spots.push({ x: c + ROAD_W / 2 + 2.2, z: d });
        }
      });
      // Trim/pad to exactly 55 posts.
      spots = spots.slice(0, 55);
      var realEvery = Math.max(1, Math.floor(spots.length / 12));
      var poleParts = [];
      var headParts = [];
      var poolParts = [];
      spots.forEach(function (s, i) {
        poleParts.push({ geo: new THREE.CylinderGeometry(0.12, 0.16, 6.4, 6), x: s.x, y: 3.2, z: s.z });
        poleParts.push({ geo: new THREE.BoxGeometry(1.6, 0.14, 0.14), x: s.x - 0.8, y: 6.3, z: s.z });
        headParts.push({ geo: new THREE.SphereGeometry(0.34, 10, 8), x: s.x - 1.6, y: 6.2, z: s.z });
        poolParts.push({ geo: flatGeo(new THREE.CircleGeometry(5.2, 20)), x: s.x - 1.6, y: 0.06, z: s.z });
        if (i % realEvery === 0 && City.lampLights.length < 12) {
          var pl = new THREE.PointLight(0xffc98a, 34, 34, 1.8);
          pl.position.set(s.x - 1.6, 6.0, s.z);
          scene.add(pl);
          City.lampLights.push(pl);
        }
      });
      scene.add(new THREE.Mesh(mergeParts(poleParts), poleMat));
      scene.add(new THREE.Mesh(mergeParts(headParts), headMat));
      scene.add(new THREE.Mesh(mergeParts(poolParts), poolMat));
    },

    buildPuddles: function (scene, r) {
      // Glossy puddles that catch the moon and the lamps.
      var pudMat = new THREE.MeshStandardMaterial({
        color: 0x2a3f5f, roughness: 0.06, metalness: 0.9
      });
      var pudParts = [];
      for (var i = 0; i < 10; i++) {
        var sx = STREETS[Math.floor(r() * STREETS.length)];
        var sz = (r() - 0.5) * 170;
        var pg = flatGeo(new THREE.CircleGeometry(1.6 + r() * 1.8, 18));
        pg.scale(1.6, 1, 1);
        pudParts.push({ geo: pg, x: sx + (r() - 0.5) * 8, y: 0.055, z: sz });
      }
      scene.add(new THREE.Mesh(mergeParts(pudParts), pudMat));
    },

    buildStars: function (scene, r) {
      var pts = [];
      for (var i = 0; i < 220; i++) {
        pts.push((r() - 0.5) * 500, 90 + r() * 120, (r() - 0.5) * 500);
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      var stars = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xdde8ff, size: 1.6, sizeAttenuation: false
      }));
      scene.add(stars);
    },

    // Circle-vs-building push-out. Mutates pos {x, z} in place.
    collide: function (pos, radius) {
      for (var i = 0; i < this.colliders.length; i++) {
        var b = this.colliders[i];
        var cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        var cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        var dx = pos.x - cx, dz = pos.z - cz;
        var d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 < 0.0001) {
            pos.x = b.maxX + radius;
          } else {
            var d = Math.sqrt(d2);
            pos.x = cx + (dx / d) * radius;
            pos.z = cz + (dz / d) * radius;
          }
        }
      }
      // Stay out of the water and inside the map.
      if (pos.x > 112) pos.x = 112;
      if (pos.x < -108) pos.x = -108;
      if (pos.z > 108) pos.z = 108;
      if (pos.z < -108) pos.z = -108;
    }
  };

  G.city = City;
})();
