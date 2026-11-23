// Marina Nights — synthesized WebAudio (no audio files). All guarded so a
// failure can never break the game. Audio only starts after a user gesture.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let sirenOn = false;
  let skidSrc = null;
  let skidGain = null;
  let skidFilter = null;
  let started = false;

  function init() {
    if (started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      started = true;
      // Engine hum: sawtooth through a low-pass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      // Police siren: triangle wave wobbling between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 750;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      sirenLfo.start();
      // Tyre skid: looped white noise through a band-pass, gain driven by
      // hard cornering at speed (see update()).
      try {
        const len = ctx.sampleRate * 1;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        skidSrc = ctx.createBufferSource();
        skidSrc.buffer = buf;
        skidSrc.loop = true;
        skidFilter = ctx.createBiquadFilter();
        skidFilter.type = 'bandpass';
        skidFilter.frequency.value = 900;
        skidFilter.Q.value = 1.2;
        skidGain = ctx.createGain();
        skidGain.gain.value = 0.0;
        skidSrc.connect(skidFilter);
        skidFilter.connect(skidGain);
        skidGain.connect(ctx.destination);
        skidSrc.start();
      } catch (e) { /* skid unavailable: engine/siren still work */ }
    } catch (e) { /* audio unavailable: game continues silently */ }
  }

  function resume() {
    try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  }

  function blip(freq, dur, type, vol, when) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime + (when || 0);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) {}
  }

  return {
    init,
    resume,
    // Called every frame with speed (m/s), wanted level, smoothed steering
    // (-1..1), braking flag and the nearest police distance (m, Infinity
    // when no pursuit). All optional after wanted — old callers still work.
    update(speed, wanted, steer, braking, policeDist) {
      if (!ctx) return;
      try {
        resume();
        const kmh = Math.abs(speed) * 3.6;
        if (engineOsc && engineGain) {
          // 5 gears: pitch climbs inside each gear and steps down at the
          // shift, instead of one endless rising drone.
          const gear = kmh < 25 ? 0 : kmh < 50 ? 1 : kmh < 80 ? 2 : kmh < 105 ? 3 : 4;
          const band = [25, 25, 30, 25, 25][gear];
          const low = [0, 25, 50, 80, 105][gear];
          const inGear = Math.min(1, Math.max(0, (kmh - low) / band));
          engineOsc.frequency.value = 58 + gear * 6 + inGear * 95;
          engineFilter.frequency.value = 380 + inGear * 500;
          engineGain.gain.value = 0.015 + Math.min(0.05, kmh * 0.00035);
        }
        // Tyre skid on hard steering at speed, plus a faint brake squeal.
        if (skidGain) {
          const cornering = Math.abs(steer || 0) * Math.min(1, kmh / 70);
          const skidTarget = cornering > 0.55 ? (cornering - 0.55) * 0.12 : 0;
          const squeal = braking && kmh > 25 ? 0.02 : 0;
          skidGain.gain.setTargetAtTime(Math.max(skidTarget, squeal), ctx.currentTime, 0.08);
        }
        // Siren fades with distance so a far pursuit sounds far away.
        const want = wanted > 0;
        if (want !== sirenOn && sirenGain) {
          sirenOn = want;
          const d = (policeDist === undefined || policeDist === Infinity) ? 40 : policeDist;
          const vol = 0.035 * Math.max(0.15, 1 - d / 160);
          sirenGain.gain.setTargetAtTime(want ? vol : 0.0, ctx.currentTime, 0.2);
        } else if (want && sirenGain) {
          const d = (policeDist === undefined || policeDist === Infinity) ? 40 : policeDist;
          const vol = 0.035 * Math.max(0.15, 1 - d / 160);
          sirenGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.5);
        }
      } catch (e) {}
    },
    pickup() { blip(880, 0.12, 'sine', 0.22); blip(1318, 0.2, 'sine', 0.2, 0.1); },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.28, 'triangle', 0.2, i * 0.13));
    },
    crash() { blip(90, 0.25, 'sawtooth', 0.25); blip(55, 0.3, 'square', 0.18, 0.05); },
    busted() { [392, 311, 233].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.15, i * 0.18)); },
  };
}
