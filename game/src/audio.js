// audio.js — fully synthesized sound, no audio files: a two-oscillator
// engine whose pitch follows gear and speed, filtered-noise tyre skid,
// and a two-tone police siren whose volume follows the nearest unit.
export function createAudio() {
  let ctx = null;
  let engineOsc1 = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  let skidSrc = null, skidGain = null, skidFilter = null;
  let sirenOsc = null, sirenGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine: saw + square detuned, through a lowpass.
      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 900;
      engineFilter.Q.value = 2;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc1.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc1.start();
      engineOsc2.start();
      // Skid: looped noise through a bandpass.
      const len = ctx.sampleRate * 1.2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      skidSrc = ctx.createBufferSource();
      skidSrc.buffer = buf;
      skidSrc.loop = true;
      skidFilter = ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 950;
      skidFilter.Q.value = 1.4;
      skidGain = ctx.createGain();
      skidGain.gain.value = 0;
      skidSrc.connect(skidFilter);
      skidFilter.connect(skidGain);
      skidGain.connect(ctx.destination);
      skidSrc.start();
      // Siren: triangle alternating two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  let sirenPhase = 0;
  return {
    get muted() { return muted; },
    toggleMute() { muted = !muted; return muted; },
    start() {
      if (started) return;
      if (ensure()) {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        started = true;
      }
    },
    update(dt, { rpm, speedKmh, slipping, sirenDist }) {
      if (!ctx || !started || muted) {
        if (engineGain) engineGain.gain.value = 0;
        if (skidGain) skidGain.gain.value = 0;
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      // Engine pitch: base 55 Hz, up to ~210 Hz at redline; load by speed.
      const rpmSafe = Number.isFinite(rpm) ? Math.max(0, Math.min(1, rpm)) : 0.25;
      const freq = 52 + rpmSafe * 165 + Math.min(40, speedKmh * 0.25);
      const t = ctx.currentTime;
      engineOsc1.frequency.setTargetAtTime(freq, t, 0.06);
      engineOsc2.frequency.setTargetAtTime(freq * 0.5 + 3, t, 0.06);
      engineFilter.frequency.setTargetAtTime(500 + rpmSafe * 2400, t, 0.08);
      engineGain.gain.setTargetAtTime(0.05 + rpmSafe * 0.075, t, 0.1);
      // Skid while slipping at speed.
      const skid = slipping > 0.15 && speedKmh > 25 ? Math.min(0.16, slipping * 0.2) : 0;
      skidGain.gain.setTargetAtTime(skid, t, 0.08);
      // Siren: alternate 720 / 960 Hz every 0.45 s, gain by distance.
      sirenPhase += dt;
      const hi = Math.floor(sirenPhase / 0.45) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(hi ? 960 : 720, t, 0.05);
      const sirenVol = sirenDist === Infinity ? 0 : Math.max(0, 0.11 - sirenDist * 0.0016);
      sirenGain.gain.setTargetAtTime(sirenVol, t, 0.15);
    },
  };
}
