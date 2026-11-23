// VELMARA main — boot, game loop, camera, input and saving.
// The modules are wired here: lighting, city, vehicles, pedestrians,
// player, police, combat, missions, HUD, audio and the shot scenarios.
(function () {
  var G = (window.G = window.G || {});

  var SAVE_KEY = "velmara-save-v1";

  var state = {
    cash: 0,
    wanted: 0,
    missionIndex: 0,
    started: false,
    paused: false,
    time: 0,
    shotMode: false
  };
  G.state = state;

  var keys = { up: false, down: false, left: false, right: false, brake: false };
  var renderer, scene, camera, clock;
  var completedOverlayAt = 0;

  function $(id) { return document.getElementById(id); }

  function loadSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (typeof s.cash !== "number" || typeof s.missionIndex !== "number") return null;
      return s;
    } catch (err) {
      return null;
    }
  }

  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash,
        missionIndex: G.missions.index,
        wanted: state.wanted,
        savedAt: new Date().toISOString()
      }));
    } catch (err) {
      /* storage may be unavailable; the game still plays */
    }
  }

  function startGame(fromSave) {
    var save = fromSave ? loadSave() : null;
    if (save) {
      state.cash = save.cash;
      G.missions.setIndex(save.missionIndex);
      state.wanted = save.wanted || 0;
      G.police.setWanted(state.wanted);
    }
    state.started = true;
    state.paused = false;
    G.hud.hideStart();
    G.hud.showPause(false);
    G.audio.unlock();
    G.hud.toast(fromSave ? "Welcome back to Velmara Bay." : "Welcome to Velmara Bay. Follow the gold diamond.");
  }

  function togglePause() {
    if (!state.started) return;
    state.paused = !state.paused;
    G.hud.showPause(state.paused);
  }

  function bindInput() {
    var map = {
      KeyW: "up", ArrowUp: "up",
      KeyS: "down", ArrowDown: "down",
      KeyA: "left", ArrowLeft: "left",
      KeyD: "right", ArrowRight: "right",
      Space: "brake"
    };
    window.addEventListener("keydown", function (e) {
      if (e.code === "Enter" && !state.started) {
        startGame(!!loadSave());
        return;
      }
      if (e.code === "KeyP" || e.code === "Escape") {
        if (state.started) togglePause();
        return;
      }
      if (e.code === "KeyM") {
        var muted = G.audio.toggleMute();
        G.hud.toast(muted ? "Sound muted." : "Sound on.");
        return;
      }
      if (e.code === "KeyR" && state.started) {
        G.missions.setIndex(G.missions.index);
        G.hud.toast("Mission restarted.");
        return;
      }
      if (e.code === "Space") e.preventDefault();
      if (map[e.code] !== undefined) keys[map[e.code]] = true;
    });
    window.addEventListener("keyup", function (e) {
      if (map[e.code] !== undefined) keys[map[e.code]] = false;
    });
    var startBtn = $("hud-start-btn");
    if (startBtn) startBtn.addEventListener("click", function () { startGame(false); });
    var contBtn = $("hud-continue-btn");
    if (contBtn) contBtn.addEventListener("click", function () { startGame(true); });
    var nextBtn = $("hud-overlay-btn");
    if (nextBtn) nextBtn.addEventListener("click", function () {
      G.hud.hideComplete();
      G.missions.next();
      saveGame();
    });
    var resumeBtn = $("hud-resume-btn");
    if (resumeBtn) resumeBtn.addEventListener("click", togglePause);
    var restartBtn = $("hud-restart-btn");
    if (restartBtn) restartBtn.addEventListener("click", function () {
      G.missions.setIndex(G.missions.index);
      togglePause();
    });
    window.addEventListener("resize", function () {
      if (!renderer || !camera) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function clockString() {
    // Fixed 21:36 night clock: the whole game is one long marina night.
    return "21:36 · NIGHT";
  }

  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    state.time += dt;

    if (state.started && !state.paused) {
      if (state.shotMode) {
        // Staged shots hold their pose: wheels keep spinning at the
        // staged speed, but nothing drives away from its mark.
        var hero = G.player;
        var spin = (hero.speed * dt) / 0.37;
        for (var wi = 0; wi < hero.wheels.length; wi++) {
          hero.wheels[wi].rotation.x += spin;
        }
      } else {
        G.player.update(dt, keys);
        var ev = G.combat.update(dt, state);
        if (ev === "busted") {
          G.hud.showBusted(true);
          setTimeout(function () {
            G.hud.showBusted(false);
            state.cash = Math.max(0, state.cash - 200);
            state.wanted = 0;
            G.police.setWanted(0);
            G.combat.busted = false;
            G.combat.bustTimer = 0;
            G.player.reset(0, 34, Math.PI);
          }, 2200);
        } else if (ev === "ram" || ev === "bump") {
          G.audio.blip(110, 0.12, 0.1);
        } else if (ev === "wrecked") {
          G.hud.toast("Car wrecked — $150 repair, back on the bayfront.");
        }
        var done = G.missions.update(dt, state.time, G.player.pos, state);
        if (done) {
          G.hud.showComplete(done);
          completedOverlayAt = state.time;
          saveGame();
        }
      }
      G.vehicles.update(dt);
      G.pedestrians.update(dt, state.time);
      G.police.update(dt, G.player);
      G.lighting.update(G.player.pos, G.player.forward());
      G.audio.update(G.player.speedKmh(), G.player.throttle || 0, state.wanted, dt);
    }

    // Camera: staged shots use their own framing, play uses chase cam.
    if (state.shotMode) {
      G.shots.updateCamera(camera, G.player, dt);
    } else {
      var hero2 = G.player;
      var fb = hero2.forward();
      var cx = hero2.pos.x - fb.x * 9.5;
      var cz = hero2.pos.z - fb.z * 9.5;
      var k = 1 - Math.pow(0.001, dt); // smooth follow
      camera.position.x += (cx - camera.position.x) * k;
      camera.position.y += (4.4 - camera.position.y) * k;
      camera.position.z += (cz - camera.position.z) * k;
      camera.lookAt(hero2.pos.x + fb.x * 7, 1.4, hero2.pos.z + fb.z * 7);
    }

    if (state.started) {
      G.hud.update(state, G.player, clockString());
    }
    renderer.render(scene, camera);
  }

  function boot() {
    if (typeof THREE === "undefined") {
      document.body.setAttribute("data-pageerror", "THREE failed to load");
      return;
    }
    renderer = new THREE.WebGLRenderer({ antialias: true });
    G.lighting.setupRenderer(renderer);
    $("game-root").appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    camera.position.set(0, 4.4, 44);
    G.lighting.build(scene);
    G.city.build(scene);
    G.vehicles.init(scene);
    G.pedestrians.init(scene);
    G.player.build(scene);
    G.player.reset(0, 34, Math.PI);
    G.police.init(scene);
    G.police.setWanted(0);
    G.missions.build(scene);
    G.hud.init();
    G.audio.init();
    bindInput();

    clock = new THREE.Clock();
    var shotId = G.shots.read();
    if (shotId) {
      state.shotMode = true;
      G.shots.apply(state);
      G.hud.update(state, G.player, clockString());
    } else {
      G.hud.showStart(!!loadSave());
    }
    frame();
  }

  window.addEventListener("error", function (e) {
    try {
      document.body.setAttribute("data-pageerror", String(e.message || e.error || "page error"));
    } catch (err) { /* ignore */ }
  });
  window.addEventListener("unhandledrejection", function (e) {
    try {
      document.body.setAttribute("data-pageerror", String((e.reason && e.reason.message) || "unhandled rejection"));
    } catch (err) { /* ignore */ }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
