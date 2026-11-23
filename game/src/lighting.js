// VELMARA lighting — the bright-night rig. The brief for this round is
// "night but BRIGHT and VERY CLEAR": nothing may fall into silhouette, so
// the base lights are strong, the moon is strong, and a warm fill light
// rides with the hero car wherever it goes.
(function () {
  var G = (window.G = window.G || {});

  var Lighting = {
    chaseFill: null,
    moon: null,

    // Renderer tone mapping lives here so the whole look is in one place.
    setupRenderer: function (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.7;
      if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = false;
    },

    build: function (scene) {
      // Base wash: strong so facades, roads and cars all stay readable.
      var ambient = new THREE.AmbientLight(0xbfd0ff, 1.55);
      scene.add(ambient);

      // Cool sky bounce from above, warm bounce from the streets below.
      var hemi = new THREE.HemisphereLight(0x8fb0ff, 0x4a3a30, 1.15);
      scene.add(hemi);

      // The moon: a hard directional key light, slightly cool.
      var moon = new THREE.DirectionalLight(0xdfe8ff, 1.7);
      moon.position.set(70, 110, 45);
      scene.add(moon);
      this.moon = moon;

      // Chase fill: a warm point light that follows the hero car so the
      // hero, the road under it and nearby props are never a silhouette.
      var fill = new THREE.PointLight(0xffe2b0, 34, 30, 1.5);
      fill.position.set(0, 7, 0);
      scene.add(fill);
      this.chaseFill = fill;

      // Deep blue night sky with a faint haze at the horizon.
      scene.background = new THREE.Color(0x0b1026);
      scene.fog = new THREE.Fog(0x101736, 130, 420);
    },

    // The fill light hovers a little above and behind the hero.
    update: function (heroPos, heroForward) {
      if (!this.chaseFill || !heroPos) return;
      this.chaseFill.position.set(
        heroPos.x - heroForward.x * 2.0,
        heroPos.y + 6.5,
        heroPos.z - heroForward.z * 2.0
      );
    }
  };

  G.lighting = Lighting;
})();
