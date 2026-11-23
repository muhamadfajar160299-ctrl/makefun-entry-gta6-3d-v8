// main.ts — VELMARA: Marina Nights. Entry program (Node 22, stdlib only).
//
// Copies game/ and screenshots/ from this repository into the output
// directory (MAKEFUN_OUTPUT_DIR, or /output in the grader), validates the
// screenshots, and writes /output/dossier.json with buildDossier from the
// kit's vendor/makefun-game.ts. Runs twice in the grader; both runs write
// the same bytes: no timestamps, no random data, files copied in sorted
// order. Never opens a browser.
import { buildDossier } from './vendor/makefun-game.ts';
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync,
  statSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const SCREENSHOT_MIN_BYTES = 10 * 1024;
const SCREENSHOT_MAX_BYTES = 256 * 1024;

function fail(msg: string): never {
  throw new Error(`main.ts: ${msg}`);
}

function copyTree(src: string, dst: string): number {
  let files = 0;
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src).sort()) {
    const s = join(src, name);
    const d = join(dst, name);
    const st = statSync(s);
    if (st.isDirectory()) {
      files += copyTree(s, d);
    } else if (st.isFile()) {
      cpSync(s, d);
      files += 1;
    } else {
      fail(`refusing non-regular entry in game tree: ${s}`);
    }
  }
  return files;
}

function validateScreenshots(dir: string): string[] {
  const shots = readdirSync(dir)
    .filter((n) => !n.startsWith('.'))
    .sort();
  if (shots.length < 3 || shots.length > 4) {
    fail(`screenshots: want 3 or 4 images, found ${shots.length}`);
  }
  for (const name of shots) {
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith('-') || name.startsWith('.')) {
      fail(`screenshots: bad file name ${name}`);
    }
    const p = join(dir, name);
    const buf = readFileSync(p);
    const isPng = buf.length >= 8
      && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
      && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
    const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (!isPng && !isJpeg) fail(`screenshots: ${name} is neither PNG nor JPEG`);
    if (buf.length <= SCREENSHOT_MIN_BYTES) {
      fail(`screenshots: ${name} is ${buf.length} bytes, must be over 10 KiB`);
    }
    if (buf.length > SCREENSHOT_MAX_BYTES) {
      fail(`screenshots: ${name} is ${buf.length} bytes, must be at most 256 KiB`);
    }
  }
  return shots;
}

function main(): void {
  const gameDir = join(REPO, 'game');
  const shotsDir = join(REPO, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
  const indexBytes = statSync(join(gameDir, 'index.html')).size;
  if (indexBytes > 1024 * 1024) fail('game/index.html exceeds 1 MiB');
  if (!existsSync(shotsDir)) fail('screenshots/ is missing');

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'game'), { recursive: true });
  mkdirSync(join(OUT, 'screenshots'), { recursive: true });

  const gameFiles = copyTree(gameDir, join(OUT, 'game'));
  const shots = validateScreenshots(shotsDir);
  for (const name of shots) cpSync(join(shotsDir, name), join(OUT, 'screenshots', name));

  const dossier = buildDossier(OUT, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: SCREENSHOT_MAX_BYTES },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(OUT, 'dossier.json'), dossier);

  console.log(`VELMARA r18: ${gameFiles} game files, ${shots.length} screenshots (${shots.join(', ')})`);
  console.log(`dossier.json: ${dossier.length} bytes`);
  console.log(`output: ${OUT}`);
}

main();
