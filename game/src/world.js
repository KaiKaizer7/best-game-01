// EMBERHOLD — the world: towers, enemies, projectiles, economy, waves and win/lose.
// The simulation is a fixed step (1/60 s) over plain data, so the same seed and the same
// inputs always play the same game, and the screenshot stager can fast-forward it.

import {
  CELL, COLS, ROWS, PATH_PX, CORE_CELL, pathCells, cellCentre,
  START_GOLD, CORE_HP, TOTAL_WAVES, SELL_RATE,
  TOWERS, towerStats, upgradeCost, ENEMIES, hpMul, rewardMul, waveBonus, waveComp,
} from './config.js';
import { mulberry32, range, int } from './rng.js';

export const STEP = 1 / 60;

let nextId = 1;

/** Distance from a point to the road, for tower placement checks (unused by the sim). */
export function distToPath(x, y) {
  let best = Infinity;
  for (let i = 0; i < PATH_PX.length - 1; i += 1) {
    const a = PATH_PX[i];
    const b = PATH_PX[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

export class World {
  constructor() {
    this.reset(1);
  }

  reset(seed) {
    this.seed = seed;
    this.rnd = mulberry32(seed);
    this.time = 0;
    this.gold = START_GOLD;
    this.coreHp = CORE_HP;
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.leaks = 0;
    this.earned = 0;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floaters = [];
    this.events = [];
    this.phase = 'build'; // 'build' between waves, 'wave' while one runs
    this.speed = 1;
    this.paused = false;
    this.result = null; // null | 'win' | 'lose'
    this.resultAt = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.shake = 0;
    this.banner = null; // {text, sub, until}
    this.selected = null; // {kind:'plot'|'tower', cx, cy, tower}
    this.hover = null; // {cx, cy}
    this.pathSet = pathCells();
    this.decor = this.makeDecor();
  }

  /** Trees, rocks and fireflies, placed once per seed so the map always looks the same. */
  makeDecor() {
    const rnd = mulberry32(this.seed * 7919 + 13);
    const trees = [];
    const rocks = [];
    const flies = [];
    let guard = 0;
    while (trees.length < 9 && guard < 400) {
      guard += 1;
      const cx = int(rnd, 0, COLS - 1);
      const cy = int(rnd, 0, ROWS - 1);
      if (this.pathSet.has(`${cx},${cy}`)) continue;
      if (cx === CORE_CELL.x && cy === CORE_CELL.y) continue;
      if (trees.some((t) => t.cx === cx && t.cy === cy)) continue;
      trees.push({ cx, cy, s: range(rnd, 0.8, 1.25), hue: range(rnd, -8, 8) });
    }
    guard = 0;
    while (rocks.length < 6 && guard < 400) {
      guard += 1;
      const cx = int(rnd, 0, COLS - 1);
      const cy = int(rnd, 0, ROWS - 1);
      if (this.pathSet.has(`${cx},${cy}`)) continue;
      if (cx === CORE_CELL.x && cy === CORE_CELL.y) continue;
      if (trees.some((t) => t.cx === cx && t.cy === cy)) continue;
      if (rocks.some((t) => t.cx === cx && t.cy === cy)) continue;
      rocks.push({ cx, cy, s: range(rnd, 0.7, 1.2) });
    }
    for (let i = 0; i < 26; i += 1) {
      flies.push({ x: range(rnd, 0, COLS * CELL), y: range(rnd, 0, ROWS * CELL), p: range(rnd, 0, Math.PI * 2), s: range(rnd, 0.5, 1.4) });
    }
    return { trees, rocks, flies };
  }

  // ------------------------------------------------------------ building

  isBuildable(cx, cy) {
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return false;
    if (this.pathSet.has(`${cx},${cy}`)) return false;
    if (cx === CORE_CELL.x && cy === CORE_CELL.y) return false;
    return this.towers.every((t) => !(t.cx === cx && t.cy === cy));
  }

  towerAt(cx, cy) {
    return this.towers.find((t) => t.cx === cx && t.cy === cy) ?? null;
  }

  placeTower(key, cx, cy) {
    if (this.result) return false;
    if (!this.isBuildable(cx, cy)) return false;
    const def = TOWERS[key];
    if (!def || this.gold < def.cost) return false;
    const c = cellCentre(cx, cy);
    this.gold -= def.cost;
    const tower = {
      id: nextId, key, cx, cy, x: c.x, y: c.y,
      level: 1, invested: def.cost, cooldown: 0, angle: -Math.PI / 2, flash: 0,
    };
    nextId += 1;
    this.towers.push(tower);
    this.events.push('place');
    this.burst(c.x, c.y, 10, def.color, 90);
    return true;
  }

  upgradeTower(tower) {
    if (!tower || tower.level >= 3) return false;
    const cost = upgradeCost(tower.key, tower.level + 1);
    if (this.gold < cost) return false;
    this.gold -= cost;
    tower.invested += cost;
    tower.level += 1;
    this.events.push('upgrade');
    this.burst(tower.x, tower.y, 14, '#ffe08a', 110);
    this.addFloater(tower.x, tower.y - 26, `LEVEL ${tower.level}`, '#ffe08a');
    return true;
  }

  sellTower(tower) {
    if (!tower) return false;
    const refund = Math.round(tower.invested * SELL_RATE);
    this.gold += refund;
    this.towers = this.towers.filter((t) => t !== tower);
    if (this.selected?.tower === tower) this.selected = null;
    this.events.push('sell');
    this.addFloater(tower.x, tower.y - 20, `+${refund}g`, '#ffd34d');
    return true;
  }

  // ------------------------------------------------------------ waves

  startWave() {
    if (this.result || this.phase !== 'build' || this.wave >= TOTAL_WAVES) return false;
    this.wave += 1;
    const comp = waveComp(this.wave);
    this.spawnQueue = [];
    for (const group of comp) {
      for (let i = 0; i < group.count; i += 1) this.spawnQueue.push({ type: group.type, gap: group.gap });
    }
    this.spawnTimer = 0.6;
    this.phase = 'wave';
    this.events.push('horn');
    this.setBanner(`WAVE ${this.wave}`, this.wave === TOTAL_WAVES ? 'The last wave — hold the light!' : `${this.spawnQueue.length} shadows approach`, 2.2);
    return true;
  }

  spawnEnemy(type) {
    const def = ENEMIES[type];
    const hp = Math.round(def.hp * hpMul(this.wave));
    const start = PATH_PX[0];
    const enemy = {
      id: nextId, type, hp, maxHp: hp,
      speed: def.speed * range(this.rnd, 0.94, 1.06),
      x: start.x, y: start.y, wp: 1, dist: 0,
      radius: def.radius, reward: Math.round(def.reward * rewardMul(this.wave)),
      leak: def.leak, slowUntil: 0, slowMul: 1, flash: 0, wobble: this.rnd() * Math.PI * 2,
    };
    nextId += 1;
    this.enemies.push(enemy);
  }

  setBanner(text, sub, seconds) {
    this.banner = { text, sub, until: this.time + seconds };
  }

  // ------------------------------------------------------------ effects

  burst(x, y, n, color, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = this.rnd() * Math.PI * 2;
      const v = range(this.rnd, speed * 0.3, speed);
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
        life: range(this.rnd, 0.35, 0.8), maxLife: 0.8,
        size: range(this.rnd, 1.5, 3.5), color,
      });
    }
  }

  addFloater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
  }

  damageEnemy(enemy, amount, slow, slowTime) {
    enemy.hp -= amount;
    enemy.flash = 0.12;
    if (slow !== undefined) {
      enemy.slowMul = Math.min(enemy.slowMul, 1 - slow);
      enemy.slowUntil = Math.max(enemy.slowUntil, this.time + slowTime);
    }
    if (enemy.hp <= 0 && !enemy.dead) {
      enemy.dead = true;
      this.kills += 1;
      this.score += 10;
      this.gold += enemy.reward;
      this.earned += enemy.reward;
      const def = ENEMIES[enemy.type];
      this.burst(enemy.x, enemy.y, enemy.type === 'boss' ? 30 : 12, def.glow, 130);
      this.addFloater(enemy.x, enemy.y - 18, `+${enemy.reward}g`, '#ffd34d');
      this.events.push('kill');
      if (enemy.type === 'boss') this.events.push('coin');
    }
  }

  // ------------------------------------------------------------ step

  step(dt) {
    if (this.paused || this.result) return;
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
    if (this.banner && this.time > this.banner.until) this.banner = null;

    // Spawn the wave.
    if (this.phase === 'wave' && this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const next = this.spawnQueue.shift();
        this.spawnEnemy(next.type);
        this.spawnTimer = next.gap * range(this.rnd, 0.85, 1.15);
      }
    }

    // Move enemies along the road.
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      const slowed = this.time < e.slowUntil ? e.slowMul : 1;
      let move = e.speed * slowed * dt;
      e.wobble += dt * 6;
      while (move > 0 && e.wp < PATH_PX.length) {
        const target = PATH_PX[e.wp];
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d <= move) {
          e.x = target.x;
          e.y = target.y;
          e.dist += d;
          move -= d;
          e.wp += 1;
        } else {
          e.x += (dx / d) * move;
          e.y += (dy / d) * move;
          e.dist += move;
          move = 0;
        }
      }
      if (e.wp >= PATH_PX.length) {
        // Reached the Ember Core.
        e.dead = true;
        e.leaked = true;
        this.leaks += 1;
        this.coreHp -= e.leak;
        this.shake = 1;
        this.events.push('leak');
        this.burst(e.x, e.y, 16, '#ff4d4d', 150);
        this.addFloater(e.x - 20, e.y - 30, `-${e.leak} HP`, '#ff6b6b');
        if (this.coreHp <= 0) {
          this.coreHp = 0;
          this.result = 'lose';
          this.resultAt = this.time;
          this.events.push('defeat');
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    // Towers acquire and fire.
    for (const t of this.towers) {
      if (t.flash > 0) t.flash -= dt;
      t.cooldown -= dt;
      const stats = towerStats(t.key, t.level);
      let best = null;
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d <= stats.range && (best === null || e.dist > best.dist)) best = e;
      }
      if (!best) continue;
      t.angle = Math.atan2(best.y - t.y, best.x - t.x);
      if (t.cooldown > 0) continue;
      t.cooldown = 1 / stats.rate;
      t.flash = 0.09;
      const def = TOWERS[t.key];
      this.projectiles.push({
        x: t.x, y: t.y - 14, target: best, kind: t.key,
        damage: stats.damage, speed: def.projSpeed,
        splash: def.splash ?? 0, slow: def.slow, slowTime: def.slowTime ?? 0,
      });
      this.events.push(`shoot:${t.key}`);
    }

    // Projectiles fly to their target (or its last spot) and burst.
    for (const p of this.projectiles) {
      const target = p.target;
      const tx = target && !target.dead ? target.x : p.x;
      const ty = target && !target.dead ? target.y : p.y;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      const stepLen = p.speed * dt;
      if (d <= Math.max(stepLen, 10)) {
        p.hit = true;
        if (target && !target.dead) {
          if (p.splash > 0) {
            for (const e of this.enemies) {
              if (Math.hypot(e.x - tx, e.y - ty) <= p.splash) this.damageEnemy(e, p.damage, p.slow, p.slowTime);
            }
            this.burst(tx, ty, 12, '#ff8c4d', 120);
          } else {
            this.damageEnemy(target, p.damage, p.slow, p.slowTime);
            this.burst(tx, ty, 4, '#ffd34d', 70);
          }
        }
      } else {
        p.x += (dx / d) * stepLen;
        p.y += (dy / d) * stepLen;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.hit);
    this.enemies = this.enemies.filter((e) => !e.dead);

    // Particles and floaters.
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 60 * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= 26 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    // Wave cleared?
    if (this.phase === 'wave' && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      const bonus = waveBonus(this.wave);
      this.gold += bonus;
      this.score += 100 * this.wave;
      this.phase = 'build';
      this.events.push('waveClear');
      if (this.wave >= TOTAL_WAVES) {
        this.result = 'win';
        this.resultAt = this.time;
        this.score += this.coreHp * 25 + Math.round(this.gold / 2);
        this.events.push('victory');
        this.setBanner('THE LIGHT HOLDS', `All ${TOTAL_WAVES} waves broken — the Hollow is safe`, 4);
      } else {
        this.setBanner(`WAVE ${this.wave} CLEARED`, `+${bonus} gold — build, then sound the horn`, 2.4);
      }
    }
  }
}
