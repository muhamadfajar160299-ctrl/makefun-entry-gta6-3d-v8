# VELMARA — Marina Nights

[![Make GTA 6](https://img.shields.io/badge/make.fun-gta6--01-7c5cff?style=flat-square)](https://make.fun/bounty/gta6-01)
[![Reward $1,666](https://img.shields.io/badge/reward-%241%2C666-gold?style=flat-square)](https://make.fun/bounty/gta6-01)
[![Closes 24 Nov 2026](https://img.shields.io/badge/closes-24_Nov_2026_22%3A00_WIB-orange?style=flat-square)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, set in **Velmara Bay** — a neon
marina city after dark. Built with Three.js, served as plain static files, no
network requests, no build step. Open `game/index.html` in desktop Chrome and
drive.

## The city

A full night grid: six avenues crossed by six streets, wet asphalt that
catches the moonlight, sixteen glossy puddles, zebra crossings, towers with
lit windows and neon roof lines, rooftop AC units, antennas and blinking red
beacons, glowing shopfronts with awnings, palms and street lamps — and to the
east, the marina itself: a promenade with railings, benches and cafe tables,
wooden piers, yachts bobbing on dark water under a drifting band of
moon-glitter, their red and green navigation lights blinking.

## What you can do

- **Drive** — a detailed player car (grille, spoiler, mirrors, exhausts,
  headlight cones) with a torque curve, five gears, steering that weights up
  with speed, body roll, dive and squat, brake and reverse lights, and tyre
  slip on the handbrake.
- **Traffic** — sedans, taxis (checker band, roof sign) and vans, each a
  distinct model. They signal before turning, light their brake lights, and
  brake for the car ahead.
- **Police** — the Velmara PD runs role-based pursuit: one unit intercepts
  your predicted position, the others pursue from the flanks, and a unit that
  gets ahead of you turns to block the road. Wanted level 1–5, red/blue
  strobes, speed that scales with distance.
- **Pedestrians** — a real walk cycle (legs and arms swing in opposition),
  varied heights, joggers leaning forward, five pairs chatting at the cafe —
  and people who step aside early when your car bears down on them.
- **Missions** — five jobs, from the Marina Pickup ($400) to The Big Score
  ($1,500). A floating gold diamond and a beam of light mark each target,
  with live distance on the HUD and in the minimap.
- **Combat & feel** — collision sparks and smoke, damage that degrades
  handling, camera shake, FOV kick, roll and look-ahead on the chase camera,
  a cinematic vignette, and a damage flash.
- **Sound** — fully synthesized: an engine whose pitch follows gear and
  speed, tyre skid, and a two-tone siren that gets louder as the PD closes in.
- **Save** — cash and mission progress persist in localStorage.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Drive |
| Space | Brake |
| Shift | Handbrake |
| P | Pause |
| C | Camera |
| M | Mute |
| R | Restart mission |

## Screenshots

Four renders of the game itself, taken by the built-in shot director
(`game/src/shots.js`):

1. `shot-1.png` — wanted-3 chase down the avenue, strobes flashing.
2. `shot-2.png` — the marina promenade at the pickup point.
3. `shot-3.png` — 130 km/h in fifth, overtaking a taxi.
4. `shot-4.png` — mission complete, +$400.

## Structure

```
game/
  index.html          page + HUD
  vendor/three.min.js vendored Three.js (UMD build)
  src/
    main.js           boot, game loop, camera, collisions, save
    lighting.js       moon shadows, stars, halo, night grade
    city.js           roads, towers, marina, piers, yachts, sea
    player.js         player car model + arcade physics
    vehicles.js       traffic (sedan / taxi / van)
    police.js         PD pursuit AI + wanted system
    pedestrians.js    walkers, joggers, cafe chatter
    missions.js       five jobs + gold diamond marker
    hud.js            cash, stars, minimap, speed, overlays
    combat.js         sparks, smoke, camera shake
    audio.js          synthesized engine, skid, siren
    shots.js          screenshot staging director
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with `buildDossier` from
`vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
