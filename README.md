# VELMARA — Marina Nights

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-gold)](https://make.fun/c/gta6-01)
[![entry](https://img.shields.io/badge/entry-VELMARA%20r18-brightgreen)](https://make.fun/c/gta6-01)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

An open-world night-drive crime game in the spirit of GTA 6, built with
Three.js and plain static files — no build step, no network requests.

You are a getaway driver in **Velmara Bay**, a wet marina city that never
sleeps. Take five jobs across the bayfront, outrun the Velmara PD, and bank
$400 a mission — while the city glows around you: lit windows, neon
storefronts, yachts bobbing at the marina, and your headlights cutting
through the night.

## Play

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome:

```sh
npx serve game
# or
python3 -m http.server --directory game 8080
```

| Key | Action |
| --- | --- |
| W / A / S / D or arrows | Drive / steer |
| Space | Brake |
| P | Pause |
| R | Restart mission |
| M | Mute |
| Enter | Start / next mission |

## What is in the game

- **Open world** — a 5×5 block downtown grid plus a marina promenade:
  wet blue-grey asphalt with mirror puddles, zebra crossings, glowing
  storefronts, detailed rooftops (AC units, antennas, blinking beacons),
  palms, cafes, and yachts with navigation lights on dark water with a
  moving moon-glint streak.
- **Lighting (round 18)** — the night is bright and readable: strong
  ambient + hemisphere + moonlight, a warm fill light that rides with the
  hero car, street lamps with real point lights and additive light pools,
  ACES tone mapping at 1.7 exposure. The hero car, the road, the buildings
  and the police are all clearly visible — no silhouettes.
- **Hero car** — a crimson coupe with grille, chrome strip, spoiler,
  mirrors, twin exhausts, volumetric-look headlight cones and two real
  spotlights. 5-gear torque curve, steering that weights up with speed,
  body roll, brake dive and launch squat, brake + reverse lights.
- **Police** — Velmara PD with three AI roles: INTERCEPT (drives to your
  predicted position), PURSUE (flanks you), BLOCK (parks across the road
  ahead). Red/blue strobes throw colour onto the asphalt; wanted level
  stars in the HUD.
- **Traffic** — vans, taxis and sedans that brake for the car ahead and
  signal before turning.
- **Pedestrians** — walkers with a real limb-swing cycle, joggers, and
  cafe groups chatting by the umbrellas.
- **Missions** — five jobs with a floating gold diamond marker, a light
  beam visible across the city, live distance, and $400 per completion.
- **Combat & effects** — sparks and smoke on impact, damage that degrades
  handling, camera shake, FOV kick, roll and look-ahead, cinematic
  vignette, procedural engine / siren / skid audio (WebAudio, no files).
- **HUD & save** — cash, wanted stars, damage bar, mission box, live
  minimap (player arrow, objective diamond, police dots), speed + gear,
  game clock. Cash and mission progress autosave to localStorage.

## Screenshots

Four staged shots in `screenshots/` (cover first):

1. **Chase** — wanted 3, 72 km/h in 3rd gear, 4 police cars active.
2. **Marina** — parked at the promenade, objective diamond 9 m ahead.
3. **Top speed** — 130 km/h in 5th gear down 5th Avenue.
4. **Mission complete** — $400 banked.

Capture them again with the dev tool (needs Playwright + Chromium):

```sh
NODE_PATH=/home/hatch/workspace/scratch/playwright/node_modules node capture-shots.mjs
```

## Hand in

`main.ts` (Node 22, stdlib only) copies `game/` + `screenshots/` to the
output directory and writes `dossier.json` with the kit's `buildDossier`.
It validates every screenshot (PNG/JPEG, over 10 KiB, at most 256 KiB) and
is deterministic — two runs write identical bytes:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

```
game/
  index.html          HUD + import map (three.js vendored)
  vendor/three.min.js
  src/
    main.js           bootstrap, camera, loop, save
    lighting.js       night lighting (ambient/hemi/moon/fill/lamps)
    city.js           roads, buildings, marina, yachts, water
    vehicles.js       car factory + traffic AI
    player.js         hero physics (5 gears, body roll, damage)
    police.js         PD roles: INTERCEPT / PURSUE / BLOCK
    pedestrians.js    walkers, joggers, cafe chatter
    missions.js       5 jobs, gold diamond marker, $400 each
    combat.js         sparks, smoke, collisions
    hud.js            cash, stars, minimap, overlays
    audio.js          procedural engine / siren / skid
    shots.js          deterministic staging for the 4 screenshots
main.ts               entry program (copies game + screenshots, dossier)
capture-shots.mjs     dev tool: stages + captures the 4 screenshots
```

## License

MIT — see [LICENSE](LICENSE). Original work: Velmara Bay, its people and
its cars are invented for this entry and copy nothing from any commercial
game.
