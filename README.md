# EMBERHOLD — Last Light of the Hollow

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/KaiKaizer7/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/KaiKaizer7/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A complete, original 2D tower-defense game for make.fun's `best-game-01` bounty.
Night falls on the Hollow, and waves of shadow wisps march along a winding road toward
your Ember Core. Raise Spark Spires, Frost Lanterns and Ember Cannons on the glowing
plots, spend your gold between waves, and hold the light through all twelve waves.

## How it plays

- **The road**: wisps enter from the left and snake across the hollow to the Core in
  the bottom-right corner. Anything that reaches the Core burns its HP.
- **Towers**: three kinds, each with three levels. **Spark Spire** (50g) fires fast
  ember bolts. **Frost Lantern** (90g) chills the wisps, slowing their march.
  **Ember Cannon** (150g) lobs heavy shells that burst into burning shrapnel.
  Upgrade a tower to raise its damage, range and fire rate; sell it back for 70%.
- **Waves**: twelve of them, from lone wisps to swarms of skitters, armoured bulwarks
  and the Shade Lords that lead waves 4, 8 and 12. Kills pay gold; clearing a wave
  pays a bonus. Survive wave 12 and the light holds.
- **Controls**: click a glowing plot to build (keys 1–3 pick the tower), click a tower
  to upgrade or sell it, Space sounds the horn for the next wave, F toggles 2× speed,
  P pauses, M mutes, R restarts.

## Run it

No build step and no network. Serve `game/` with any static server and open
`game/index.html` in desktop Chrome:

```sh
python3 -m http.server 8080 --directory game
# open http://localhost:8080
```

Screenshots are staged deterministically with `?shot=start|play|buy|end&seed=7`
(the game plays its own rules forward from a fresh world with a simple autopilot
that builds and spends gold, so every frame is a real game frame).

## Layout

- `game/index.html` — page, canvas, side panel, title / victory / defeat overlays.
- `game/src/config.js` — board, road, tower and enemy definitions, wave lists.
- `game/src/world.js` — the simulation: towers, enemies, projectiles, economy, win/lose.
- `game/src/render.js` — everything drawn, procedurally, on one canvas.
- `game/src/input.js` — mouse and keyboard, translated into board cells and commands.
- `game/src/audio.js` — synthesized Web Audio effects (no audio files).
- `game/src/rng.js` — a seeded generator so the same seed plays the same game.
- `game/src/shots.js` — the deterministic screenshot scenes and their autopilot.
- `game/src/main.js` — boot, fixed-step loop, side panel, screen state.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `main.ts` — hands the entry in: copies `game/`, decodes the screenshots
  from base64 text into JPEGs, and writes `dossier.json`.
- `screenshots/` — the four screenshots as base64 text (`*.jpg.b64`), because
  the upload path accepts text files only; `main.ts` decodes them.

## License

MIT. See `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=wdnjyfww&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
