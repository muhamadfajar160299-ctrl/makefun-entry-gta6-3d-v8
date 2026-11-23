// main.ts — VELMARA: Marina Nights (make.fun gta6-01 entry program).
// Copies game/ and screenshots/ from this repository to the output directory
// (MAKEFUN_OUTPUT_DIR, or /output) and writes /output/dossier.json with
// buildDossier from vendor/makefun-game.ts. Standard library only, fully
// deterministic: two runs write byte-identical output.
import { buildDossier } from "./vendor/makefun-game.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const MIN_SCREENSHOT_BYTES = 10 * 1024;
const MAX_SCREENSHOT_BYTES = 256 * 1024;
const MAX_INDEX_HTML_BYTES = 1024 * 1024;

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function copyTree(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) fail(`refusing to copy symlink: ${path.join(srcDir, entry.name)}`);
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

function checkScreenshots(dir) {
  if (!fs.existsSync(dir)) fail("screenshots/ directory is missing");
  const files = fs.readdirSync(dir)
    .filter((f) => !f.startsWith("."))
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort();
  if (files.length < 3 || files.length > 4) {
    fail(`screenshots/ must hold 3 or 4 images, found ${files.length}`);
  }
  for (const f of files) {
    if (!/^[A-Za-z0-9._-]+$/.test(f) || f.startsWith("-")) fail(`bad screenshot name: ${f}`);
    const st = fs.statSync(path.join(dir, f));
    if (!st.isFile()) fail(`screenshot is not a regular file: ${f}`);
    if (st.size < MIN_SCREENSHOT_BYTES) fail(`screenshot too small (<10 KB): ${f} (${st.size} bytes)`);
    if (st.size > MAX_SCREENSHOT_BYTES) fail(`screenshot too large (>256 KiB): ${f} (${st.size} bytes)`);
  }
  return files;
}

function main() {
  const gameDir = path.join(REPO_ROOT, "game");
  const shotsDir = path.join(REPO_ROOT, "screenshots");
  const indexHtml = path.join(gameDir, "index.html");
  if (!fs.existsSync(indexHtml)) fail("game/index.html is missing");
  const indexSize = fs.statSync(indexHtml).size;
  if (indexSize > MAX_INDEX_HTML_BYTES) fail(`game/index.html exceeds 1 MiB (${indexSize} bytes)`);

  const shots = checkScreenshots(shotsDir);

  // Fresh output directory, then copy the entry in.
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  copyTree(gameDir, path.join(OUT_DIR, "game"));
  copyTree(shotsDir, path.join(OUT_DIR, "screenshots"));

  const dossier = buildDossier(OUT_DIR, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: MAX_SCREENSHOT_BYTES },
  });
  fs.writeFileSync(path.join(OUT_DIR, "dossier.json"), dossier);

  const gameFiles = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) gameFiles.push(p);
    }
  })(path.join(OUT_DIR, "game"));
  console.log(`VELMARA v10: ${gameFiles.length} game files, ${shots.length} screenshots (${shots.join(", ")})`);
  console.log(`dossier.json: ${dossier.length} bytes -> ${path.join(OUT_DIR, "dossier.json")}`);
  console.log("main.ts: OK");
}

main();
