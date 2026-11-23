// VELMARA entry driver — copies game/ and screenshots/ into the output
// directory and writes dossier.json with buildDossier from the kit's
// vendored library. Standard library only, deterministic: two runs
// write byte-identical output.
import { buildDossier } from "./vendor/makefun-game.ts";
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const GAME_SRC = join(HERE, "game");
const SHOTS_SRC = join(HERE, "screenshots");

function checkScreenshots(dir: string): void {
  const names = ["shot-1.jpg", "shot-2.jpg", "shot-3.jpg", "shot-4.jpg"];
  for (const name of names) {
    const p = join(dir, name);
    if (!existsSync(p)) throw new Error("missing screenshot: " + name);
    const size = statSync(p).size;
    if (size <= 10 * 1024) throw new Error(name + " is only " + size + " bytes");
    if (size > 256 * 1024) throw new Error(name + " is " + size + " bytes, over 256 KiB");
  }
}

function main(): void {
  checkScreenshots(SHOTS_SRC);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const gameOut = join(OUT, "game");
  const shotsOut = join(OUT, "screenshots");
  cpSync(GAME_SRC, gameOut, { recursive: true });
  cpSync(SHOTS_SRC, shotsOut, { recursive: true });
  const dossier: Uint8Array = buildDossier(OUT, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 }
  });
  writeFileSync(join(OUT, "dossier.json"), dossier);
  const dossierBytes = statSync(join(OUT, "dossier.json")).size;
  console.log("VELMARA r19 -> " + OUT + " (dossier " + dossierBytes + " bytes)");
}

main();
