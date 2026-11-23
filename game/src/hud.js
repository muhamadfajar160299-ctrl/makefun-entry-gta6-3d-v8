// VELMARA HUD — speed, gear, wanted stars, cash, mission panel, damage
// bar and a live minimap. The minimap arrow is drawn pointing up, then
// rotated by (PI - heading): on a map where north (-Z) is up, that is
// exactly the hero's heading, never mirrored.
(function () {
  var G = (window.G = window.G || {});

  var Hud = {
    els: {},
    mapCtx: null,

    init: function () {
      var ids = [
        "hud-speed", "hud-gear", "hud-cash", "hud-wanted", "hud-clock",
        "hud-mission-title", "hud-mission-desc", "hud-mission-dist",
        "hud-damage-fill", "hud-bust", "hud-overlay", "hud-overlay-title",
        "hud-overlay-sub", "hud-overlay-reward", "hud-overlay-btn",
        "hud-start", "hud-pause", "hud-save-note", "hud-minimap",
        "hud-toast"
      ];
      for (var i = 0; i < ids.length; i++) {
        this.els[ids[i]] = document.getElementById(ids[i]);
      }
      var map = this.els["hud-minimap"];
      if (map) this.mapCtx = map.getContext("2d");
    },

    showStart: function (hasSave) {
      var s = this.els["hud-start"];
      if (s) s.style.display = "flex";
      var note = this.els["hud-save-note"];
      if (note) note.textContent = hasSave
        ? "Saved game found — press ENTER to continue your run."
        : "No saved game yet — your progress saves automatically.";
    },

    hideStart: function () {
      var s = this.els["hud-start"];
      if (s) s.style.display = "none";
    },

    showPause: function (on) {
      var p = this.els["hud-pause"];
      if (p) p.style.display = on ? "flex" : "none";
    },

    showComplete: function (job) {
      var o = this.els["hud-overlay"];
      if (!o) return;
      this.els["hud-overlay-title"].textContent = "MISSION COMPLETE";
      this.els["hud-overlay-sub"].textContent =
        "MISSION " + job.id + " — " + job.name;
      this.els["hud-overlay-reward"].textContent = "+$" + job.reward;
      o.style.display = "flex";
    },

    hideComplete: function () {
      var o = this.els["hud-overlay"];
      if (o) o.style.display = "none";
    },

    showBusted: function (on) {
      var b = this.els["hud-bust"];
      if (b) b.style.display = on ? "flex" : "none";
    },

    toast: function (msg) {
      var t = this.els["hud-toast"];
      if (!t) return;
      t.textContent = msg;
      t.style.opacity = "1";
      clearTimeout(this._toastTimer);
      var self = this;
      this._toastTimer = setTimeout(function () { t.style.opacity = "0"; }, 2600);
    },

    // Full HUD refresh, called every frame (cheap DOM writes only).
    update: function (state, hero, timeStr) {
      if (this.els["hud-speed"]) {
        this.els["hud-speed"].textContent = Math.round(hero.speedKmh());
      }
      if (this.els["hud-gear"]) this.els["hud-gear"].textContent = hero.gear();
      if (this.els["hud-cash"]) {
        this.els["hud-cash"].textContent = "$" + state.cash;
      }
      if (this.els["hud-wanted"]) {
        var stars = "";
        for (var i = 0; i < 5; i++) stars += i < state.wanted ? "★" : "☆";
        this.els["hud-wanted"].innerHTML =
          '<span class="stars">' + stars + "</span> WANTED";
      }
      if (this.els["hud-clock"]) this.els["hud-clock"].textContent = timeStr;
      var job = G.missions.current();
      if (this.els["hud-mission-title"]) {
        this.els["hud-mission-title"].textContent =
          "MISSION " + job.id + " — " + job.name;
      }
      if (this.els["hud-mission-desc"]) {
        this.els["hud-mission-desc"].textContent = job.desc;
      }
      if (this.els["hud-mission-dist"]) {
        this.els["hud-mission-dist"].textContent =
          G.missions.distanceToTarget(hero.pos) + " m to objective";
      }
      if (this.els["hud-damage-fill"]) {
        this.els["hud-damage-fill"].style.width = G.combat.damage + "%";
      }
      this.drawMinimap(state, hero);
    },

    drawMinimap: function (state, hero) {
      var ctx = this.mapCtx;
      if (!ctx) return;
      var S = 190; // canvas pixels
      var W = 260; // world span shown, centred on the bay
      function mx(x) { return ((x + 130) / W) * S; }
      function mz(z) { return ((z + 130) / W) * S; }
      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = "#141c2e";
      ctx.fillRect(0, 0, S, S);
      // Water on the east edge.
      ctx.fillStyle = "#1d4e6b";
      ctx.fillRect(mx(116), 0, S - mx(116), S);
      // Roads.
      ctx.strokeStyle = "#5f7089";
      ctx.lineWidth = 7;
      G.city.streets.forEach(function (c) {
        ctx.beginPath(); ctx.moveTo(mx(-110), mz(c)); ctx.lineTo(mx(112), mz(c)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mx(c), mz(-110)); ctx.lineTo(mx(c), mz(110)); ctx.stroke();
      });
      // Promenade.
      ctx.strokeStyle = "#9aa3b5";
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(mx(100), mz(-110)); ctx.lineTo(mx(100), mz(110)); ctx.stroke();
      // Traffic dots.
      ctx.fillStyle = "#cfd6de";
      G.vehicles.cars.forEach(function (t) {
        var p = t.group.position;
        ctx.fillRect(mx(p.x) - 1.5, mz(p.z) - 1.5, 3, 3);
      });
      // Police dots.
      G.police.units.forEach(function (u) {
        if (!u.active) return;
        var p = u.group.position;
        ctx.fillStyle = "#5a8cff";
        ctx.beginPath();
        ctx.arc(mx(p.x), mz(p.z), 3.4, 0, Math.PI * 2);
        ctx.fill();
      });
      // Mission diamond.
      var job = G.missions.current();
      ctx.fillStyle = "#ffd75e";
      ctx.save();
      ctx.translate(mx(job.x), mz(job.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
      // Hero arrow: drawn pointing up, rotated by (PI - heading) so it
      // matches the hero's true heading on a north-up map.
      ctx.save();
      ctx.translate(mx(hero.pos.x), mz(hero.pos.z));
      ctx.rotate(Math.PI - hero.heading);
      ctx.fillStyle = "#ffd75e";
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // North tick.
      ctx.fillStyle = "#8b98b0";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("N", S - 13, 14);
    }
  };

  G.hud = Hud;
})();
