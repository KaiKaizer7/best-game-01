// EMBERHOLD — the screenshot scenes behind ?shot=start|play|buy|end. Each one plays the
// real rules forward from a fresh world, steered by a simple autopilot that builds a sensible
// defence and spends its gold between waves, so the frame is what a real game looks like and
// the same seed always gives the same frame. The autopilot is deliberately straightforward:
// it buys from a priority list of plots, then upgrades the cheapest tower it can afford.

import { STEP, World } from './world.js';
import { TOTAL_WAVES } from './config.js';

const SHOT_SEED = 7;
const MAX_STEPS = 240000;

/** Plots the autopilot builds, in priority order: beside the road's bends first. */
const PLAN = [
  ['cannon', 8, 2],
  ['frost', 8, 3],
  ['spark', 7, 2],
  ['cannon', 3, 5],
  ['frost', 3, 3],
  ['spark', 8, 5],
  ['spark', 3, 6],
  ['spark', 10, 5],
  ['spark', 10, 6],
  ['spark', 5, 5],
  ['spark', 5, 3],
  ['spark', 1, 5],
  ['spark', 1, 3],
  ['spark', 10, 2],
  ['frost', 10, 3],
  ['cannon', 10, 6],
  ['spark', 6, 6],
  ['spark', 6, 2],
];

/** Spend the gold on the plan's next tower, then on upgrades, cheapest first. */
function spendGold(world) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, cx, cy] of PLAN) {
      if (world.towerAt(cx, cy)) continue;
      if (world.placeTower(key, cx, cy)) {
        changed = true;
        break;
      }
    }
    if (changed) continue;
    const upgradable = world.towers.filter((t) => t.level < 3).sort((a, b) => a.invested - b.invested);
    for (const t of upgradable) {
      if (world.upgradeTower(t)) {
        changed = true;
        break;
      }
    }
  }
}

/** Run the world forward until the current wave clears (or the game ends), capped. */
function runWave(world, cap) {
  let steps = 0;
  while (world.phase === 'wave' && !world.result && steps < cap) {
    world.step(STEP);
    steps += 1;
  }
  return steps;
}

/** Play whole waves with the autopilot until `untilWave` is cleared (or the game ends). */
function playToWave(world, untilWave) {
  let steps = 0;
  while (!world.result && world.wave < untilWave && steps < MAX_STEPS) {
    spendGold(world);
    if (!world.startWave()) break;
    steps += runWave(world, MAX_STEPS - steps);
    if (world.result) break;
  }
  return steps;
}

/**
 * Set `world` to the named scene (start, play, buy or end) and return what the UI should
 * show: the screen to draw over it and a tower to select (the buy scene's).
 */
export function stageShot(name, world) {
  world.reset(SHOT_SEED);
  if (name !== 'play' && name !== 'buy' && name !== 'end') {
    // Title over an idle map: let the fireflies drift a few seconds.
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP);
    return { screen: 'title', selectTower: null };
  }
  if (name === 'buy') {
    // Clear three waves, then stop in the build phase with a cannon selected.
    playToWave(world, 3);
    spendGold(world);
    const tower = world.towers.find((t) => t.key === 'cannon') ?? world.towers[0] ?? null;
    return { screen: 'play', selectTower: tower };
  }
  if (name === 'end') {
    // Play the whole campaign to its end.
    playToWave(world, TOTAL_WAVES);
    const screen = world.result === 'win' ? 'victory' : 'defeat';
    return { screen, selectTower: null };
  }
  // Play: reach wave 5 and fight it for a while, towers firing and wisps on the road.
  playToWave(world, 4);
  spendGold(world);
  world.startWave();
  let steps = 0;
  while (world.phase === 'wave' && !world.result && steps < 16 / STEP) {
    world.step(STEP);
    steps += 1;
  }
  return { screen: 'play', selectTower: null };
}
