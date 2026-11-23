// VELMARA audio — every sound is synthesized live with WebAudio.
// No audio files are loaded. The engine hum, the city ambience and the
// police siren are all oscillators and filtered noise built in code.
(function () {
  var G = (window.G = window.G || {});

  function makeNoiseBuffer(ctx, seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  var AudioSys = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineSub: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    muted: false,
    ready: false,

    init: function () {
      var self = this;
      function unlock() {
        if (self.ready) return;
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          var ctx = new AC();
          self.ctx = ctx;
          self.master = ctx.createGain();
          self.master.gain.value = self.muted ? 0 : 0.5;
          self.master.connect(ctx.destination);

          // Engine: a sawtooth plus a low sine one octave down.
          self.engineOsc = ctx.createOscillator();
          self.engineOsc.type = "sawtooth";
          self.engineOsc.frequency.value = 55;
          self.engineSub = ctx.createOscillator();
          self.engineSub.type = "sine";
          self.engineSub.frequency.value = 28;
          self.engineGain = ctx.createGain();
          self.engineGain.gain.value = 0.0;
          var engineFilter = ctx.createBiquadFilter();
          engineFilter.type = "lowpass";
          engineFilter.frequency.value = 700;
          engineFilter.Q.value = 1.2;
          self.engineOsc.connect(engineFilter);
          self.engineSub.connect(engineFilter);
          engineFilter.connect(self.engineGain);
          self.engineGain.connect(self.master);
          self.engineOsc.start();
          self.engineSub.start();

          // City ambience: looped noise through a soft lowpass, very quiet.
          var noise = ctx.createBufferSource();
          noise.buffer = makeNoiseBuffer(ctx, 3);
          noise.loop = true;
          var ambFilter = ctx.createBiquadFilter();
          ambFilter.type = "lowpass";
          ambFilter.frequency.value = 320;
          var ambGain = ctx.createGain();
          ambGain.gain.value = 0.035;
          noise.connect(ambFilter);
          ambFilter.connect(ambGain);
          ambGain.connect(self.master);
          noise.start();

          // Police siren: one square wave that flips between two tones.
          self.sirenOsc = ctx.createOscillator();
          self.sirenOsc.type = "square";
          self.sirenOsc.frequency.value = 720;
          self.sirenGain = ctx.createGain();
          self.sirenGain.gain.value = 0.0;
          self.sirenOsc.connect(self.sirenGain);
          self.sirenGain.connect(self.master);
          self.sirenOsc.start();

          self.ready = true;
          if (ctx.state === "suspended") ctx.resume();
        } catch (err) {
          self.ready = false;
        }
      }
      window.addEventListener("keydown", unlock, { once: false });
      window.addEventListener("pointerdown", unlock, { once: false });
      this.unlock = unlock;
    },

    // Called every frame with the hero speed in km/h and throttle 0..1.
    update: function (speedKmh, throttle, wanted, dt) {
      if (!this.ready || !this.ctx) return;
      try {
        var t = this.ctx.currentTime;
        var rpm = 50 + Math.abs(speedKmh) * 1.55 + throttle * 22;
        this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.06);
        this.engineSub.frequency.setTargetAtTime(rpm * 0.5, t, 0.06);
        var loud = 0.02 + Math.min(0.11, Math.abs(speedKmh) / 1400) + throttle * 0.03;
        this.engineGain.gain.setTargetAtTime(loud, t, 0.08);
        if (wanted > 0) {
          this.sirenTimer += dt;
          var hi = Math.floor(this.sirenTimer * 1.6) % 2 === 0;
          this.sirenOsc.frequency.setTargetAtTime(hi ? 960 : 690, t, 0.05);
          this.sirenGain.gain.setTargetAtTime(0.028, t, 0.1);
        } else {
          this.sirenGain.gain.setTargetAtTime(0.0, t, 0.15);
        }
      } catch (err) {
        /* audio must never break the game */
      }
    },

    blip: function (freq, dur, vol) {
      if (!this.ready || !this.ctx) return;
      try {
        var ctx = this.ctx;
        var o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        var g = ctx.createGain();
        g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.15));
        o.connect(g);
        g.connect(this.master);
        o.start();
        o.stop(ctx.currentTime + (dur || 0.15) + 0.02);
      } catch (err) {
        /* ignore */
      }
    },

    // Little two-note chime for a finished job.
    fanfare: function () {
      var self = this;
      this.blip(523, 0.16, 0.14);
      setTimeout(function () { self.blip(784, 0.3, 0.14); }, 130);
    },

    toggleMute: function () {
      this.muted = !this.muted;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
      }
      return this.muted;
    }
  };

  G.audio = AudioSys;
})();
