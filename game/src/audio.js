// audio.js — fully procedural WebAudio: no sound files, no network.
//
// Engine: two detuned sawtooth oscillators through a low-pass filter, pitch
// following RPM. Siren: a triangle wave alternating two tones, gain by
// distance to the nearest police car. Skid: filtered noise. Everything is
// created lazily on the first user gesture and guarded so the game never
// fails when audio is unavailable (headless screenshots included).
export function createAudio() {
  let ctx = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineFilter = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let noiseBuf = null;
  let skidSrc = null;
  let skidGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // Engine chain.
      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 900;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc1.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc1.start();
      engineOsc2.start();
      // Siren chain.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 750;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      // Skid chain.
      skidSrc = ctx.createBufferSource();
      skidSrc.buffer = noiseBuf;
      skidSrc.loop = true;
      const skidFilter = ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 900;
      skidGain = ctx.createGain();
      skidGain.gain.value = 0;
      skidSrc.connect(skidFilter);
      skidFilter.connect(skidGain);
      skidGain.connect(ctx.destination);
      skidSrc.start();
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  return {
    get muted() { return muted; },
    start() {
      if (started) return;
      started = true;
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (ctx && ctx.destination) {
        try { ctx.destination.gain ? null : null; } catch (e) { /* noop */ }
      }
      if (engineGain) engineGain.gain.value = muted ? 0 : engineGain.gain.value;
      return muted;
    },
    setEngine(rpm, throttle, speedNorm) {
      if (!ctx || muted) return;
      try {
        const t = ctx.currentTime;
        const freq = 55 + rpm * 165 + throttle * 22;
        engineOsc1.frequency.setTargetAtTime(freq, t, 0.05);
        engineOsc2.frequency.setTargetAtTime(freq * 0.5 + 3, t, 0.05);
        engineFilter.frequency.setTargetAtTime(500 + rpm * 1600, t, 0.08);
        const vol = 0.028 + rpm * 0.05 + throttle * 0.02 + speedNorm * 0.015;
        engineGain.gain.setTargetAtTime(vol, t, 0.08);
      } catch (e) { /* audio is best-effort */ }
    },
    setSiren(distance, t) {
      if (!ctx || muted) return;
      try {
        const near = Math.max(0, 1 - distance / 90);
        sirenGain.gain.setTargetAtTime(near * 0.05, ctx.currentTime, 0.1);
        const tone = Math.sin(t * 4.4) > 0 ? 920 : 680;
        sirenOsc.frequency.setTargetAtTime(tone, ctx.currentTime, 0.03);
      } catch (e) { /* noop */ }
    },
    setSkid(on) {
      if (!ctx || muted || !skidGain) return;
      try {
        skidGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.06);
      } catch (e) { /* noop */ }
    },
    thud(strength) {
      if (!ctx || muted) return;
      try {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(90, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.22 * strength, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } catch (e) { /* noop */ }
    },
    cashRegister() {
      if (!ctx || muted) return;
      try {
        [880, 1174, 1568].forEach((f, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f;
          const g = ctx.createGain();
          const at = ctx.currentTime + i * 0.09;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, at + 0.35);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(at);
          osc.stop(at + 0.4);
        });
      } catch (e) { /* noop */ }
    },
  };
}
