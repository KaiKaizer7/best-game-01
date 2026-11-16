// A small seeded random generator (mulberry32) so the same seed always plays the same game.
// The world uses it for spawn jitter and decoration; the shots use it to stage a fixed scene.

/** A seeded generator: call it for a float in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export const range = (rnd, min, max) => min + rnd() * (max - min);

/** An integer in [min, max]. */
export const int = (rnd, min, max) => Math.floor(range(rnd, min, max + 1));

/** One element of an array. */
export const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
