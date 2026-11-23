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
    // Called every frame with speed (m/s) and wanted level.
    update(speed, wanted) {
      if (!ctx) return;
      try {
        resume();
        const kmh = Math.abs(speed) * 3.6;
        if (engineOsc && engineGain) {
          engineOsc.frequency.value = 55 + kmh * 1.6;
          engineGain.gain.value = 0.015 + Math.min(0.05, kmh * 0.00035);
        }
        const want = wanted > 0;
        if (want !== sirenOn && sirenGain) {
          sirenOn = want;
          sirenGain.gain.setTargetAtTime(want ? 0.035 : 0.0, ctx.currentTime, 0.2);
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
