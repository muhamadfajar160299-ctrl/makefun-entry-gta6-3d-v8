// VELMARA missions — five jobs across the bayfront. Each job puts a
// spinning gold diamond with a vertical light beam on the map; drive
// into it to finish the job, bank $400, and open the next one.
(function () {
  var G = (window.G = window.G || {});

  var JOBS = [
    {
      id: 1, name: "MARINA PICKUP", reward: 400,
      desc: "Drive to the marina promenade and pick up the package.",
      x: 108, z: -60
    },
    {
      id: 2, name: "HARBOR DROP", reward: 400,
      desc: "Take the package to the south pier drop point.",
      x: 108, z: 30
    },
    {
      id: 3, name: "YACHT HANDOFF", reward: 400,
      desc: "Meet the yacht contact at the north end of the bay.",
      x: 108, z: 60
    },
    {
      id: 4, name: "PIER RUN", reward: 400,
      desc: "A buyer waits by the cafe row. Do not keep him waiting.",
      x: 108, z: -30
    },
    {
      id: 5, name: "BAYFRONT ESCAPE", reward: 400,
      desc: "One last pickup at the middle of the promenade, then vanish.",
      x: 108, z: 0
    }
  ];

  var Missions = {
    jobs: JOBS,
    index: 0,
    marker: null,
    beam: null,
    done: false,
    justCompleted: null,

    current: function () {
      return this.jobs[this.index % this.jobs.length];
    },

    build: function (scene) {
      var g = new THREE.Group();
      var gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.15, 0),
        new THREE.MeshStandardMaterial({
          color: 0xffc400, emissive: 0xffaa00, emissiveIntensity: 1.8,
          roughness: 0.2, metalness: 0.7
        })
      );
      gem.position.y = 2.2;
      g.add(gem);
      var beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.85, 26, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffd75e, transparent: true, opacity: 0.32,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        })
      );
      beam.position.y = 13;
      g.add(beam);
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(1.5, 2.1, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffd75e, transparent: true, opacity: 0.55, side: THREE.DoubleSide
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      g.add(ring);
      g.userData.gem = gem;
      g.userData.ring = ring;
      this.marker = g;
      this.beam = beam;
      scene.add(g);
      this.placeMarker();
    },

    placeMarker: function () {
      var j = this.current();
      this.marker.position.set(j.x, 0, j.z);
      this.marker.visible = true;
      this.done = false;
    },

    distanceToTarget: function (heroPos) {
      var j = this.current();
      var dx = j.x - heroPos.x, dz = j.z - heroPos.z;
      return Math.round(Math.sqrt(dx * dx + dz * dz));
    },

    // Returns the completed job, or null.
    update: function (dt, time, heroPos, state) {
      if (!this.marker || this.done) return null;
      this.marker.userData.gem.rotation.y += dt * 1.6;
      this.marker.userData.gem.position.y = 2.2 + Math.sin(time * 2) * 0.35;
      var pulse = 0.45 + Math.sin(time * 3) * 0.15;
      this.marker.userData.ring.material.opacity = pulse;
      if (this.distanceToTarget(heroPos) <= 6) {
        var job = this.current();
        state.cash += job.reward;
        this.done = true;
        this.justCompleted = job;
        this.marker.visible = false;
        G.combat.repair();
        G.audio.fanfare();
        return job;
      }
      return null;
    },

    next: function () {
      this.index = (this.index + 1) % this.jobs.length;
      this.justCompleted = null;
      this.placeMarker();
    },

    // Jump straight to a job (used by the screenshot scenarios).
    setIndex: function (i) {
      this.index = i % this.jobs.length;
      this.justCompleted = null;
      this.placeMarker();
    }
  };

  G.missions = Missions;
})();
