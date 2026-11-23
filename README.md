# Marina Nights — GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/muhamadfajar160299-ctrl/makefun-entry-gta6-3d-v8/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/muhamadfajar160299-ctrl/makefun-entry-gta6-3d-v8/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Marina Nights** is a 3D open-world driving game set in **VELMARA BAY**, a neon
marina city at night. Drive the waterfront streets, run five jobs for the crew,
dodge the Velmara Bay PD, and don't get busted — or wasted.

Built with Three.js. A realistic night drive: real moonlight with soft
shadows that track the car, wet asphalt with puddle shine, a living marina
promenade (cafes, string lights, bobbing yachts with navigation lights,
crowds that walk, jog and chat), traffic that brakes for the car ahead and
signals before turning, and a five-star wanted system where police hunt as
a pack — one car cuts you off at your predicted position while the others
flank and block. Cars lean into corners, dive under braking, throw sparks
on hard hits and smoke when they're falling apart.

## How to play

| Key | Action |
| --- | --- |
| `W A S D` / Arrow keys | Drive / steer |
| `Space` | Brake |
| `P` | Pause / resume |
| `R` | Restart mission |
| `Enter` | Advance menus |

Open `game/index.html` in a browser (or serve the `game/` folder) and press
**START ENGINE**.

## The 5 missions

1. **Marina Pickup** — Drive to the marina promenade, grab the package. **+$400**
2. **Downtown Drop** — Deliver it to the west-side tower. **+$600**
3. **Harbor Escape** — Lose a 2-star heat and reach the north docks. **+$800**
4. **Night Courier** — Cross town to the south-east corner. **+$1,000**
5. **Velmaras Grand Finale** — One last run with 3 stars on your tail. **+$1,500**

Progress (mission + cash) is saved in `localStorage`. The gold beacon and the
minimap mark every objective (with a live distance readout); wanted stars rise
with the heat, and police cars match the wanted level one-for-one. The HUD
shows cash, wanted stars, vehicle damage, speed with gear, the in-game clock,
and a live minimap with roads, traffic and police dots.

## Screenshots

The driver (`main.ts`) captures four staged shots:

1. `shot-1.png` — police chase, wanted 3, strobes painting the street
2. `shot-2.png` — the busy marina promenade at water level, car in the crowd
3. `shot-3.png` — flat-out drive at ~130 km/h, overtaking traffic
4. `shot-4.png` — mission complete

Run it with: `node main.ts` (needs Chromium; screenshots land in
`$MAKEFUN_OUTPUT_DIR`, default `/output`).

## License

MIT — see [LICENSE](LICENSE).
