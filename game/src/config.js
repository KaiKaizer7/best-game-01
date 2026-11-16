// EMBERHOLD — configuration: the board, the path, the towers, the enemies and the waves.
// Everything the world and the renderer agree on lives here, so a balance change is one edit.

export const CELL = 80;
export const COLS = 12;
export const ROWS = 9;
export const MAP_W = COLS * CELL; // 960
export const MAP_H = ROWS * CELL; // 720

// The winding road the wisps walk, as cell centres (x, y in cells). It enters from the
// left edge, snakes across the hollow and ends at the Ember Core in the bottom-right cell.
export const WAYPOINTS = [
  [-1, 1],
  [9, 1],
  [9, 4],
  [2, 4],
  [2, 7],
  [11, 7],
];

/** Pixel centre of a cell. */
export const cellCentre = (cx, cy) => ({ x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 });

/** The waypoints in pixels (cell centres). */
export const PATH_PX = WAYPOINTS.map(([cx, cy]) => cellCentre(cx, cy));

/** Every cell the road runs through, as "x,y" keys. */
export function pathCells() {
  const out = new Set();
  for (let i = 0; i < WAYPOINTS.length - 1; i += 1) {
    const [x0, y0] = WAYPOINTS[i];
    const [x1, y1] = WAYPOINTS[i + 1];
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    let x = x0;
    let y = y0;
    for (;;) {
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) out.add(`${x},${y}`);
      if (x === x1 && y === y1) break;
      x += dx;
      y += dy;
    }
  }
  return out;
}

/** The cell holding the Ember Core (the road's last cell). */
export const CORE_CELL = { x: 11, y: 7 };

export const START_GOLD = 220;
export const CORE_HP = 20;
export const TOTAL_WAVES = 12;
export const SELL_RATE = 0.7;

// ---------------------------------------------------------------- towers

export const TOWERS = {
  spark: {
    key: 'spark',
    name: 'Spark Spire',
    blurb: 'Fast bolts of living ember. Cheap, quick, and honest.',
    cost: 50,
    range: 2.2 * CELL,
    damage: 12,
    rate: 2.0, // shots per second
    projSpeed: 520,
    color: '#ffb347',
    glow: '#ff8c1a',
  },
  frost: {
    key: 'frost',
    name: 'Frost Lantern',
    blurb: 'Cold blue light that chills the wisps, slowing their march.',
    cost: 90,
    range: 2.0 * CELL,
    damage: 4,
    rate: 1.0,
    projSpeed: 420,
    slow: 0.45, // enemy speed multiplier while chilled
    slowTime: 1.4,
    color: '#7fd4ff',
    glow: '#2fa8ff',
  },
  cannon: {
    key: 'cannon',
    name: 'Ember Cannon',
    blurb: 'A heavy mortar shell that bursts into burning shrapnel.',
    cost: 150,
    range: 3.0 * CELL,
    damage: 46,
    rate: 0.5,
    projSpeed: 340,
    splash: 1.05 * CELL,
    color: '#ff6b4a',
    glow: '#ff2d1a',
  },
};
export const TOWER_KEYS = ['spark', 'frost', 'cannon'];

/** Upgrade cost to reach `level` (2 or 3) for a tower of this kind. */
export const upgradeCost = (key, level) => Math.round(TOWERS[key].cost * (level === 2 ? 0.75 : 1.25));

/** A tower's stats at a level: damage x1.6, range x1.12 and rate x1.15 per level above 1. */
export function towerStats(key, level) {
  const base = TOWERS[key];
  const mul = level - 1;
  return {
    range: base.range * Math.pow(1.12, mul),
    damage: base.damage * Math.pow(1.6, mul),
    rate: base.rate * Math.pow(1.15, mul),
  };
}

// ---------------------------------------------------------------- enemies

export const ENEMIES = {
  wisp: {
    key: 'wisp',
    name: 'Wisp',
    hp: 30,
    speed: 55,
    reward: 8,
    leak: 1,
    radius: 13,
    color: '#b7a6ff',
    glow: '#7b5cff',
  },
  skitter: {
    key: 'skitter',
    name: 'Skitter',
    hp: 18,
    speed: 96,
    reward: 10,
    leak: 1,
    radius: 10,
    color: '#7dffb0',
    glow: '#1fd66b',
  },
  bulwark: {
    key: 'bulwark',
    name: 'Bulwark',
    hp: 150,
    speed: 32,
    reward: 22,
    leak: 2,
    radius: 19,
    color: '#ffb37d',
    glow: '#ff7a2f',
  },
  boss: {
    key: 'boss',
    name: 'Shade Lord',
    hp: 950,
    speed: 26,
    reward: 130,
    leak: 5,
    radius: 26,
    color: '#ff5d8f',
    glow: '#c4005a',
  },
};

/** Enemy health multiplier for a wave. */
export const hpMul = (wave) => 1 + 0.25 * (wave - 1);
/** Kill-gold multiplier for a wave. */
export const rewardMul = (wave) => 1 + 0.05 * (wave - 1);
/** Gold for clearing a wave. */
export const waveBonus = (wave) => 25 + 5 * wave;

/** The spawn list of a wave: entries {type, count, gap} in spawn order. */
export function waveComp(wave) {
  const wisp = (n, gap = 0.85) => ({ type: 'wisp', count: n, gap });
  const skit = (n, gap = 0.6) => ({ type: 'skitter', count: n, gap });
  const bulk = (n, gap = 1.4) => ({ type: 'bulwark', count: n, gap });
  const boss = (n, gap = 2.0) => ({ type: 'boss', count: n, gap });
  switch (wave) {
    case 1: return [wisp(8)];
    case 2: return [wisp(10), skit(4)];
    case 3: return [wisp(8), skit(8)];
    case 4: return [boss(1), wisp(6), skit(6)];
    case 5: return [wisp(6), skit(8), bulk(4)];
    case 6: return [skit(10), bulk(6)];
    case 7: return [wisp(8), skit(10), bulk(6)];
    case 8: return [boss(1), skit(8), bulk(6)];
    case 9: return [skit(12), bulk(8)];
    case 10: return [wisp(10), skit(12), bulk(8)];
    case 11: return [skit(14), bulk(10)];
    case 12: return [boss(2), skit(10), bulk(10)];
    default: return [wisp(6 + wave)];
  }
}
