# Marina Nights — GTA 6

[![Make.fun Competition](https://img.shields.io/badge/make.fun-gta6--01-7c4dff)](https://make.fun/competitions/gta6-01)
[![Make.fun Rank](https://img.shields.io/badge/make.fun-rank-live-00e5ff)](https://make.fun/competitions/gta6-01)
[![Make.fun Reward](https://img.shields.io/badge/make.fun-reward-%24500-ffd54a)](https://make.fun/competitions/gta6-01)

**Marina Nights** is a 3D open-world driving game set in **VELMARA BAY**, a neon
marina city at night. Drive the waterfront streets, run five jobs for the crew,
dodge the Velmara Bay PD, and don't get busted — or wasted.

Built with Three.js. Vivid ACES night lighting, a living marina promenade
(cafes, string lights, yachts, crowds), real traffic, pedestrians, and a
five-star wanted system.

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
minimap mark every objective; wanted stars rise with the heat, and police cars
match the wanted level one-for-one.

## Screenshots

The driver (`main.ts`) captures four staged shots:

1. `shot-1.png` — police chase, wanted 3
2. `shot-2.png` — the busy marina promenade
3. `shot-3.png` — flat-out drive at ~130 km/h
4. `shot-4.png` — mission complete

Run it with: `node main.ts` (needs Chromium; screenshots land in
`$MAKEFUN_OUTPUT_DIR`, default `/output`).

## License

MIT — see [LICENSE](LICENSE).
