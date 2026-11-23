// capture-shots.mjs — dev tool: stages and captures the 4 dossier shots.
//
// Serves game/ over a local static server, opens it in headless Chromium
// (SwiftShader WebGL), stages each shot through window.__VELMARA__, and
// writes screenshots/shot-N.png. Exits non-zero on any page error or on a
// staged state that does not match the shot's claim.
//
// Playwright is resolved through NODE_PATH (the shared install at
// ~/workspace/scratch/playwright/node_modules):
//   NODE_PATH=/home/hatch/workspace/scratch/playwright/node_modules node capture-shots.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(ROOT, 'game');
const SHOTS_DIR = join(ROOT, 'screenshots');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = join(GAME_DIR, path === '/' ? 'index.html' : path);
        if (!file.startsWith(GAME_DIR)) { res.writeHead(403); res.end(); return; }
        const data = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(data);
      } catch (e) {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const EXPECTED = {
  1: { wanted: 3, speedKmh: 72, gear: 3, policeActive: 3, cash: 0 },
  2: { wanted: 0, speedKmh: 0, gear: 'N', policeActive: 0, distanceToObjective: 9 },
  3: { wanted: 1, speedKmh: 130, gear: 5, policeActive: 1, cash: 0 },
  4: { wanted: 0, speedKmh: 0, cash: 400, state: 'complete' },
};

function checkState(n, state) {
  const exp = EXPECTED[n];
  const bad = [];
  for (const [k, v] of Object.entries(exp)) {
    if (state[k] !== v) bad.push(`${k}: got ${state[k]}, want ${v}`);
  }
  return bad;
}

async function main() {
  await mkdir(SHOTS_DIR, { recursive: true });
  const server = await serve();
  const port = server.address().port;
  const errors = [];
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__VELMARA__ && window.__VELMARA__.ready, null, { timeout: 30000 });
    // Let the first frames settle.
    await page.waitForTimeout(1500);
    const smoke = await page.evaluate(() => {
      const g = window.__VELMARA__.game;
      return {
        state: g.state, cash: g.cash, wanted: g.wanted,
        traffic: g.traffic.length, police: g.police.length,
        missions: g.missions.list.length, version: g.version,
      };
    });
    console.log('smoke:', JSON.stringify(smoke));

    for (let n = 1; n <= 4; n++) {
      await page.evaluate((num) => window.__VELMARA__.applyShot(num), n);
      await page.waitForTimeout(1400);
      const state = await page.evaluate(() => window.__VELMARA__.getShotState());
      console.log(`shot-${n}:`, JSON.stringify(state));
      const bad = checkState(n, state);
      if (bad.length) errors.push(`shot-${n} state mismatch: ${bad.join('; ')}`);
      const out = join(SHOTS_DIR, `shot-${n}.jpg`);
      // JPEG: the bright, detailed frames are 320–450 KiB as PNG, over the
      // 256 KiB gate cap. JPEG at quality 88 is the raw capture, just
      // encoded smaller — the gate accepts PNG or JPEG.
      await page.screenshot({ path: out, type: 'jpeg', quality: 88, timeout: 120000 });
      const s = await stat(out);
      console.log(`shot-${n}.jpg: ${s.size} bytes`);
      if (s.size <= 10 * 1024) errors.push(`shot-${n}.jpg too small: ${s.size} bytes`);
      if (s.size > 256 * 1024) errors.push(`shot-${n}.jpg too big: ${s.size} bytes`);
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (errors.length) {
    console.error('FAILED:');
    for (const e of errors) console.error(' -', e);
    process.exit(1);
  }
  console.log('OK: 4 shots, 0 page errors');
}

main().catch((e) => { console.error(e); process.exit(1); });
