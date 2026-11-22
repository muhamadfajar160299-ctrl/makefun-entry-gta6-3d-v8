// main.ts — VELMARA entry program for make.fun (competition gta6-01).
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json there using buildDossier from the
// kit's vendored library. Standard library only; running it twice
// writes the same bytes both times.

import { buildDossier } from "./vendor/makefun-game.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const DOSSIER_TEXT_MAX_BYTES = 163840;

function copyTree(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(src, dst);
    } else if (entry.isFile()) {
      fs.copyFileSync(src, dst);
    }
  }
}

function removeIfPresent(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function main() {
  const gameSrc = path.join(REPO_ROOT, "game");
  const shotsSrc = path.join(REPO_ROOT, "screenshots");
  if (!fs.existsSync(path.join(gameSrc, "index.html"))) {
    throw new Error("game/index.html is missing from the repository");
  }
  if (!fs.existsSync(shotsSrc)) {
    throw new Error("screenshots/ is missing from the repository");
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  removeIfPresent(path.join(OUTPUT_DIR, "game"));
  removeIfPresent(path.join(OUTPUT_DIR, "screenshots"));
  removeIfPresent(path.join(OUTPUT_DIR, "dossier.json"));
  copyTree(gameSrc, path.join(OUTPUT_DIR, "game"));
  copyTree(shotsSrc, path.join(OUTPUT_DIR, "screenshots"));
  const dossier = buildDossier(REPO_ROOT, { text_max_bytes: DOSSIER_TEXT_MAX_BYTES });
  fs.writeFileSync(path.join(OUTPUT_DIR, "dossier.json"), dossier);
}

main();
