// capture-shots.mjs — VELMARA screenshot driver (dev tool, not part of the
// graded entry). Serves game/ over localhost, opens it in headless Chromium
// via playwright-core, stages each of the 4 shots through the game's own
// shot director, and writes screenshots/shot-N.png. Fails if any PNG is
// missing or under 10 KB, or if the page reports errors. PNGs are then
// optimized to fit the 256 KiB gate limit.
import { chromium } from '/home/hatch/workspace/node_modules/playwright-core/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.join(ROOT, 'game');
const SHOTS_DIR = path.join(ROOT, 'screenshots');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.css': 'text/css',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(GAME_DIR, urlPath === '/' ? 'index.html' : urlPath);
      if (!file.startsWith(GAME_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const OPTIMIZE_PY = `
import sys
from PIL import Image
for p in sys.argv[1:]:
    im = Image.open(p)
    im.save(p, optimize=True)
    import os
    size = os.path.getsize(p)
    print(p, size, 'bytes')
    if size > 256 * 1024:
        pal = im.convert('P', palette=Image.ADAPTIVE, colors=256)
        pal.save(p, optimize=True)
        size = os.path.getsize(p)
        print('  quantized ->', size, 'bytes')
    if size > 256 * 1024:
        for w, h in [(1152, 648), (1024, 576)]:
            im2 = im.resize((w, h), Image.LANCZOS)
            im2.convert('P', palette=Image.ADAPTIVE, colors=256).save(p, optimize=True)
            size = os.path.getsize(p)
            print('  resized', w, 'x', h, '->', size, 'bytes')
            if size <= 256 * 1024:
                break
`;

async function main() {
  const server = await serve();
  const port = server.address().port;
  console.log(`serving game/ on 127.0.0.1:${port}`);
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader', '--disable-gpu-sandbox', '--mute-audio'],
  });
  const failures = [];
  try {
    for (const n of [1, 2, 3, 4]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(`http://127.0.0.1:${port}/index.html?shot=${n}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.__VELMARA__ && window.__VELMARA__.ready, null, { timeout: 30000 });
      // Let the chase camera settle, traffic move, strobes flash.
      await page.waitForTimeout(n === 4 ? 2200 : 2400);
      const st = await page.evaluate(() => window.__VELMARA__.getState());
      console.log(`shot ${n}:`, JSON.stringify(st));
      if (st.errors.length > 0) failures.push(`shot ${n} page errors: ${st.errors.join(' | ')}`);
      const out = path.join(SHOTS_DIR, `shot-${n}.png`);
      await page.screenshot({ path: out });
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  // Optimize PNGs to fit the 256 KiB gate limit.
  const files = [1, 2, 3, 4].map((n) => path.join(SHOTS_DIR, `shot-${n}.png`));
  execFileSync('python3', ['-c', OPTIMIZE_PY, ...files], { stdio: 'inherit' });

  for (const f of files) {
    const size = fs.statSync(f).size;
    console.log(`${path.basename(f)}: ${size} bytes`);
    if (size < 10 * 1024) failures.push(`${f} under 10 KB (${size} bytes)`);
    if (size > 256 * 1024) failures.push(`${f} over 256 KiB (${size} bytes)`);
  }
  if (failures.length > 0) {
    console.error('CAPTURE FAILED:\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('capture-shots: all 4 shots OK');
}

main().catch((e) => { console.error(e); process.exit(1); });
