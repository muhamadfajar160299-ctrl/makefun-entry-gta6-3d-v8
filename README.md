# VELMARA — a GTA 6-style open-world game for gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/muhamadfajar160299-ctrl/makefun-entry-gta6-3d-v8/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/muhamadfajar160299-ctrl/makefun-entry-gta6-3d-v8/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

This is our entry for the [GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

## What it is

VELMARA is a 3D open-world crime game set in a luxurious coastal marina city at night ("Marina Nights"). Explore the city on foot and by car, steal and drive luxury vehicles, evade the police as your wanted level rises, and run a 5-mission story for fixer Marco Vane. The night is bright and high-contrast — marina lamps, neon signs, and headlights keep every detail readable.

## How to play

Open `game/index.html` in a desktop browser. WASD to walk, mouse to look, E to enter/exit a car, F to punch, P to pause, M to mute. Complete missions, earn money, and don't get busted.

## How it is built

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json`. The game is plain JavaScript + three.js (vendored locally), with no network access at runtime.
