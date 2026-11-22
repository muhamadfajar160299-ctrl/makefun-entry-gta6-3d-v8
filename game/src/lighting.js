// lighting.js — renderer, night lighting, sky, shared game state and helpers.
// Velmara is a bright, high-contrast marina night: warm lamps, rich neon,
// cool moonlight and a glowing bay, so every detail reads clearly.

// ---- shared game state (created first, used by every other module) ----
const G = {
  mode: 'start',            // start | playing | paused | win | busted | wasted | story
  time: 21.6,               // in-game clock, hours (21:36)
  money: 250,
  wanted: 0,
  health: 100,
  missionIndex: 0,
  missionStep: 0,
  stepTimer: 0,
  keys: {},
  camYaw: Math.PI,          // camera orbit yaw (behind player, facing south to the marina)
  camPitch: 0.34,
  camDist: 10,
  cars: [],                 // every car in the world
  peds: [],
  policeCars: [],
  playerCar: null,          // car the player is driving, or null
  trafficCount: 0,
  muted: false,
  shot: 0,                  // screenshot staging mode (0 = normal play)
  bustTimer: 0,
  wantedGrace: 0,
  lastCrimeAt: -999,
  elapsed: 0,
  scene: null,
  camera: null,
  renderer: null,
  player: null,
  headlight: null,
  sirenLight: null,
  waterMat: null,
  waterTex: null,
  yachts: [],
  neonMats: [],
  objectiveBeacon: null,
  clock: null,
};

// ---- deterministic random (stable city layout for every run) ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const cityRand = mulberry32(20261123);
function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// ---- canvas texture helper (all textures are generated locally, no network) ----
function makeCanvasTexture(w, h, drawFn, repeatX, repeatY) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  drawFn(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX) { tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = repeatX; }
  if (repeatY) { tex.wrapT = THREE.RepeatWrapping; tex.repeat.y = repeatY; }
  tex.anisotropy = 4;
  return tex;
}

// ---- soft radial glow sprite (cheap bloom for lamps, neon, headlights) ----
function makeGlowSprite(color, scale, opacity) {
  const tex = makeCanvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: opacity == null ? 0.85 : opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(scale, scale, 1);
  return spr;
}

// ---- renderer / scene / sky ----
function initLighting() {
  const container = document.getElementById('game-container');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.75;   // bright night: nothing lost in the dark
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  G.renderer = renderer;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1230);
  scene.fog = new THREE.FogExp2(0x0d1533, 0.0011);   // thin haze, city stays readable
  G.scene = scene;

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 14, 130);
  G.camera = camera;

  // Stars above the bay.
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 420; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.25 + Math.random() * 1.1;
    const r = 620;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xdfeaff, size: 1.6, sizeAttenuation: false, fog: false,
  })));

  // Big low moon over the water.
  const moon = makeGlowSprite('rgba(235,242,255,0.95)', 46, 0.95);
  moon.position.set(-150, 150, 420);
  scene.add(moon);
  const moonCore = new THREE.Mesh(
    new THREE.CircleGeometry(9, 32),
    new THREE.MeshBasicMaterial({ color: 0xf4f8ff, fog: false })
  );
  moonCore.position.set(-150, 150, 419);
  moonCore.lookAt(camera.position);
  scene.add(moonCore);

  // Hemisphere: cool blue sky, warm ground bounce from the marina lights.
  scene.add(new THREE.HemisphereLight(0x8fb0ff, 0x4a3220, 1.25));

  // Moonlight key light (casts the soft shadows).
  const moonLight = new THREE.DirectionalLight(0xcfe0ff, 0.85);
  moonLight.position.set(-120, 180, 120);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -230; moonLight.shadow.camera.right = 230;
  moonLight.shadow.camera.top = 230; moonLight.shadow.camera.bottom = -230;
  moonLight.shadow.camera.far = 600;
  moonLight.shadow.bias = -0.0004;
  scene.add(moonLight);

  // Warm wash over the marina so the cover shot glows.
  const marinaGlow = new THREE.PointLight(0xffb85e, 900, 260, 1.6);
  marinaGlow.position.set(0, 26, 185);
  scene.add(marinaGlow);
  const marinaGlow2 = new THREE.PointLight(0xff9d5c, 500, 200, 1.6);
  marinaGlow2.position.set(-90, 20, 178);
  scene.add(marinaGlow2);
  const marinaGlow3 = new THREE.PointLight(0x7fb8ff, 500, 200, 1.6);
  marinaGlow3.position.set(90, 20, 178);
  scene.add(marinaGlow3);

  // One shared siren light, moved to the nearest police car each frame.
  const siren = new THREE.PointLight(0xff2233, 0, 55, 1.4);
  siren.position.set(0, 6, 0);
  scene.add(siren);
  G.sirenLight = siren;

  G.clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
}

function onResize() {
  if (!G.renderer) return;
  G.camera.aspect = window.innerWidth / window.innerHeight;
  G.camera.updateProjectionMatrix();
  G.renderer.setSize(window.innerWidth, window.innerHeight);
}
