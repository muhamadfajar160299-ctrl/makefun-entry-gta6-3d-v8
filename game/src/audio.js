// audio.js — all sound is synthesized live with WebAudio: engine hum,
// two-tone sirens, bay ambience, impacts and chimes. No audio files.

const AudioSys = {
  ctx: null,
  master: null,
  engineOsc: null,
  engineOsc2: null,
  engineFilter: null,
  engineGain: null,
  sirenOsc: null,
  sirenGain: null,
  started: false,
};

function initAudio() {
  if (AudioSys.started) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    AudioSys.ctx = ctx;
    AudioSys.master = ctx.createGain();
    AudioSys.master.gain.value = 0.5;
    AudioSys.master.connect(ctx.destination);
    // engine: two detuned saws through a lowpass
    AudioSys.engineOsc = ctx.createOscillator();
    AudioSys.engineOsc.type = 'sawtooth';
    AudioSys.engineOsc.frequency.value = 55;
    AudioSys.engineOsc2 = ctx.createOscillator();
    AudioSys.engineOsc2.type = 'square';
    AudioSys.engineOsc2.frequency.value = 28;
    AudioSys.engineFilter = ctx.createBiquadFilter();
    AudioSys.engineFilter.type = 'lowpass';
    AudioSys.engineFilter.frequency.value = 320;
    AudioSys.engineGain = ctx.createGain();
    AudioSys.engineGain.gain.value = 0;
    AudioSys.engineOsc.connect(AudioSys.engineFilter);
    AudioSys.engineOsc2.connect(AudioSys.engineFilter);
    AudioSys.engineFilter.connect(AudioSys.engineGain);
    AudioSys.engineGain.connect(AudioSys.master);
    AudioSys.engineOsc.start();
    AudioSys.engineOsc2.start();
    // siren: triangle wave whose pitch alternates
    AudioSys.sirenOsc = ctx.createOscillator();
    AudioSys.sirenOsc.type = 'triangle';
    AudioSys.sirenOsc.frequency.value = 720;
    AudioSys.sirenGain = ctx.createGain();
    AudioSys.sirenGain.gain.value = 0;
    AudioSys.sirenOsc.connect(AudioSys.sirenGain);
    AudioSys.sirenGain.connect(AudioSys.master);
    AudioSys.sirenOsc.start();
    // bay ambience: looped filtered noise, slow swell like waves
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'lowpass'; nFilter.frequency.value = 420;
    const nGain = ctx.createGain(); nGain.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain); lfoGain.connect(nGain.gain);
    noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(AudioSys.master);
    noise.start(); lfo.start();
    AudioSys.started = true;
  } catch (e) { /* audio unavailable: the game stays silent */ }
}

function updateAudio(dt) {
  if (!AudioSys.started || !AudioSys.ctx) return;
  if (G.muted) {
    AudioSys.master.gain.value = 0;
    return;
  }
  AudioSys.master.gain.value = 0.5;
  // engine follows the player's car
  const driving = !!G.playerCar;
  const speed01 = driving ? Math.min(1, Math.abs(G.playerCar.speed) / 36) : 0;
  const t = AudioSys.ctx.currentTime;
  AudioSys.engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.11 : 0, t, 0.1);
  AudioSys.engineOsc.frequency.setTargetAtTime(52 + speed01 * 165, t, 0.08);
  AudioSys.engineOsc2.frequency.setTargetAtTime(26 + speed01 * 82, t, 0.08);
  AudioSys.engineFilter.frequency.setTargetAtTime(300 + speed01 * 1400, t, 0.1);
  // siren while wanted and a cruiser is near
  const sirenOn = G.wanted > 0 && G.policeCars.length > 0;
  AudioSys.sirenGain.gain.setTargetAtTime(sirenOn ? 0.045 : 0, t, 0.2);
  if (sirenOn) {
    const phase = Math.floor(G.elapsed * 2.4) % 2 === 0;
    AudioSys.sirenOsc.frequency.setTargetAtTime(phase ? 720 : 960, t, 0.05);
  }
}

function blip(freq, dur, type, vol, when) {
  if (!AudioSys.started || !AudioSys.ctx) return;
  const ctx = AudioSys.ctx;
  const o = ctx.createOscillator();
  o.type = type || 'sine';
  o.frequency.value = freq;
  const g = ctx.createGain();
  const t0 = ctx.currentTime + (when || 0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol || 0.2, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(AudioSys.master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function playChime() {
  blip(660, 0.25, 'sine', 0.22, 0);
  blip(880, 0.3, 'sine', 0.22, 0.09);
  blip(1320, 0.4, 'sine', 0.18, 0.18);
}
function playPunch() {
  if (!AudioSys.started || !AudioSys.ctx) return;
  const ctx = AudioSys.ctx;
  const len = ctx.sampleRate * 0.12;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = ctx.createGain(); g.gain.value = 0.5;
  src.connect(f); f.connect(g); g.connect(AudioSys.master);
  src.start();
}
function playCrash(vol) {
  if (!AudioSys.started || !AudioSys.ctx) return;
  const ctx = AudioSys.ctx;
  const len = ctx.sampleRate * 0.25;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300;
  const g = ctx.createGain(); g.gain.value = 0.4 * (vol == null ? 0.6 : vol);
  src.connect(f); f.connect(g); g.connect(AudioSys.master);
  src.start();
}
function toggleMute() {
  G.muted = !G.muted;
  if (typeof showToast === 'function') showToast(G.muted ? 'Sound off' : 'Sound on');
}
