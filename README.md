# VELMARA — Bayfront Getaway

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/muhamadfajar160299-ctrl/makefun-entry-gta6-3d-v8/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/muhamadfajar160299-ctrl/makefun-entry-gta6-3d-v8/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![license MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**VELMARA** is an open-world crime game set in **Velmara Bay**, a bright
marina city at night. You are the getaway driver: run five jobs along the
bayfront, thread through vans, taxis and sedans, and outrun the white
interceptors when the wanted stars come out.

## How to play

Open `game/index.html` in desktop Chrome (or serve the `game/` folder with
any static server). No build step, no network requests — everything the
game loads is a file under `game/`.

Press **START ENGINE** (or ENTER). Follow the gold diamond: drive into its
beam to finish the job and bank **+$400**. Each job opens the next one
along the promenade. Your cash, mission and wanted level save
automatically after every completed job; **CONTINUE SAVED GAME** (or
ENTER on the start screen) picks up where you left off.

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | Accelerate |
| S / ↓ | Brake / reverse |
| A / D / ← / → | Steer |
| SPACE | Handbrake |
| P / ESC | Pause |
| R | Restart mission |
| M | Mute sound |

## Features

- **Open city** — a street grid of mid-tone towers with glowing windows,
  lane markings and zebra crossings, plus a marina promenade with yachts,
  palms and red cafe umbrellas.
- **Bright night** — strong ambient, hemisphere and moon light, a warm
  fill light that rides with the hero car, ACES tone mapping, blue-grey
  asphalt, glossy puddles and 55 lamp posts, so every detail reads.
- **Traffic** — vans, taxis and sedans cruising the grid; pedestrians
  strolling the sidewalks and chatting by the cafes.
- **Police** — white interceptors with red/blue strobes that chase,
  intercept and block; wanted level shown as stars.
- **Combat** — ram police cars to shove them off, take damage, get busted
  if you sit still beside a cop, pay for repairs when wrecked.
- **Missions** — five bayfront jobs with a gold diamond target, distance
  readout and a MISSION COMPLETE payout overlay.
- **HUD** — speed and gear, cash, wanted stars, damage bar, mission
  objective and a live minimap with a true-heading hero arrow.
- **Sound** — engine, city ambience and sirens synthesized live with
  WebAudio; no audio files.
- **Save** — progress persists in the browser between sessions.

## Tech

Three.js (vendored under `game/vendor/`), plain static files, one clear
job per source file under `game/src/`. Screenshots are real renders of
the game captured headless with `capture-shots.mjs`.
