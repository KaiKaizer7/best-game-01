// EMBERHOLD — boot, the fixed-step loop, and the side panel. The world simulates, the
// renderer paints, the panel reports, and this file keeps the three in step. A ?shot=
// query stages a deterministic scene instead of starting a live game (see shots.js).

import { World, STEP } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { stageShot } from './shots.js';
import { CELL, COLS, ROWS, TOTAL_WAVES, CORE_HP, TOWERS, TOWER_KEYS, towerStats, upgradeCost } from './config.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const world = new World();
const renderer = new Renderer(canvas);
const sound = new Sound();

let screen = 'title'; // 'title' | 'play' | 'victory' | 'defeat'
let pendingBuild = null; // a tower key the next plot click builds, or null
let shotMode = false;

const fmt = (n) => n.toLocaleString('en-US');

// ---------------------------------------------------------------- panel

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildPalette() {
  const host = $('palette');
  host.innerHTML = '';
  for (const key of TOWER_KEYS) {
    const def = TOWERS[key];
    const card = el('button', 'tower-card');
    card.dataset.key = key;
    card.innerHTML = `<span class="tower-dot" style="background:${def.color}"></span>
      <span class="tower-name">${def.name}</span>
      <span class="tower-cost">${def.cost}g</span>
      <span class="tower-blurb">${def.blurb}</span>
      <span class="tower-key">${key === 'spark' ? '1' : key === 'frost' ? '2' : '3'}</span>`;
    card.addEventListener('click', () => {
      sound.ensure();
      sound.click();
      pendingBuild = pendingBuild === key ? null : key;
      world.selected = null;
      refreshPanel();
    });
    host.appendChild(card);
  }
}

function refreshPanel() {
  $('stat-wave').textContent = world.wave === 0 ? '—' : `${world.wave} / ${TOTAL_WAVES}`;
  $('stat-gold').textContent = `${fmt(world.gold)}g`;
  $('stat-core').textContent = `${world.coreHp} / ${CORE_HP}`;
  $('stat-score').textContent = fmt(world.score);
  $('stat-kills').textContent = fmt(world.kills);
  const coreBar = $('core-bar');
  coreBar.style.width = `${Math.max(0, (world.coreHp / CORE_HP) * 100)}%`;
  coreBar.classList.toggle('low', world.coreHp <= 5);

  for (const card of document.querySelectorAll('.tower-card')) {
    const key = card.dataset.key;
    card.classList.toggle('active', pendingBuild === key);
    card.classList.toggle('poor', world.gold < TOWERS[key].cost);
  }

  const startBtn = $('btn-wave');
  startBtn.disabled = !(screen === 'play' && world.phase === 'build' && world.wave < TOTAL_WAVES && !world.result);
  startBtn.textContent = world.wave === 0 ? 'Sound the horn — Wave 1' : world.wave >= TOTAL_WAVES ? 'All waves done' : `Start Wave ${world.wave + 1}`;
  $('btn-speed').textContent = world.speed === 2 ? 'Speed 2×' : 'Speed 1×';
  $('btn-pause').textContent = world.paused ? 'Resume (P)' : 'Pause (P)';
  $('btn-mute').textContent = sound.muted ? 'Unmute (M)' : 'Mute (M)';

  const info = $('selected');
  const sel = world.selected;
  info.innerHTML = '';
  if (sel?.kind === 'tower' && sel.tower) {
    const t = sel.tower;
    const def = TOWERS[t.key];
    const stats = towerStats(t.key, t.level);
    const upCost = t.level < 3 ? upgradeCost(t.key, t.level + 1) : null;
    const sell = Math.round(t.invested * 0.7);
    info.appendChild(el('h3', '', `${def.name} · Lv ${t.level}`));
    info.appendChild(el('p', 'muted', `Damage ${Math.round(stats.damage)} · Range ${Math.round(stats.range / CELL * 10) / 10} cells · ${stats.rate.toFixed(1)} shots/s`));
    info.appendChild(el('p', 'muted', `Invested ${t.invested}g · Sell for ${sell}g`));
    const row = el('div', 'row');
    if (upCost !== null) {
      const up = el('button', 'btn small', `Upgrade — ${upCost}g`);
      up.disabled = world.gold < upCost;
      up.addEventListener('click', () => {
        sound.ensure();
        if (!world.upgradeTower(t)) sound.deny();
        refreshPanel();
      });
      row.appendChild(up);
    }
    const sellBtn = el('button', 'btn small ghost', `Sell — ${sell}g`);
    sellBtn.addEventListener('click', () => {
      sound.ensure();
      world.sellTower(t);
      refreshPanel();
    });
    row.appendChild(sellBtn);
    info.appendChild(row);
  } else if (sel?.kind === 'plot') {
    info.appendChild(el('h3', '', 'Empty plot'));
    info.appendChild(el('p', 'muted', 'Pick a tower from the palette (or press 1, 2, 3), then click here to build it. Towers fire on their own once a wave starts.'));
  } else if (pendingBuild) {
    info.appendChild(el('h3', '', `Placing: ${TOWERS[pendingBuild].name}`));
    info.appendChild(el('p', 'muted', 'Click an empty glowing plot to build. Right-click or Esc to cancel.'));
  } else {
    info.appendChild(el('h3', '', 'The Hollow'));
    info.appendChild(el('p', 'muted', 'Click a glowing plot to build. Click a tower to upgrade or sell it. Survive all 12 waves and the light holds.'));
  }
}

// ---------------------------------------------------------------- screens

function showScreen(next) {
  screen = next;
  for (const id of ['overlay-title', 'overlay-victory', 'overlay-defeat', 'overlay-pause']) {
    $(id).classList.add('hidden');
  }
  if (next === 'title') $('overlay-title').classList.remove('hidden');
  else if (next === 'victory') {
    $('final-score').textContent = fmt(world.score);
    $('final-detail').textContent = `${world.kills} shadows banished · ${world.leaks} leaked through · core at ${world.coreHp}/${CORE_HP} · ${fmt(world.earned)}g earned`;
    $('overlay-victory').classList.remove('hidden');
  } else if (next === 'defeat') {
    $('defeat-wave').textContent = `The light fell on wave ${world.wave} of ${TOTAL_WAVES}.`;
    $('defeat-detail').textContent = `${world.kills} shadows banished · score ${fmt(world.score)} · ${fmt(world.earned)}g earned`;
    $('overlay-defeat').classList.remove('hidden');
  } else if (world.paused) {
    $('overlay-pause').classList.remove('hidden');
  }
  refreshPanel();
}

function startGame() {
  sound.ensure();
  world.reset(1);
  pendingBuild = null;
  showScreen('play');
}

function endGame(result) {
  if (result === 'win') showScreen('victory');
  else showScreen('defeat');
}

// ---------------------------------------------------------------- input

function selectCell(cx, cy) {
  if (screen !== 'play' || world.result) return;
  sound.ensure();
  const tower = world.towerAt(cx, cy);
  if (pendingBuild) {
    if (tower) {
      world.selected = { kind: 'tower', tower };
      pendingBuild = null;
    } else if (world.placeTower(pendingBuild, cx, cy)) {
      pendingBuild = null;
      world.selected = { kind: 'tower', tower: world.towerAt(cx, cy) };
    } else {
      sound.deny();
    }
    refreshPanel();
    return;
  }
  if (tower) world.selected = { kind: 'tower', tower };
  else if (world.isBuildable(cx, cy)) world.selected = { kind: 'plot', cx, cy };
  else world.selected = null;
  refreshPanel();
}

const input = new Input(canvas, {
  mouseMoved(cx, cy) {
    world.hover = cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS ? { cx, cy } : null;
  },
  mouseLeft() {
    world.hover = null;
  },
  cellClicked(cx, cy) {
    selectCell(cx, cy);
  },
  deselect() {
    pendingBuild = null;
    world.selected = null;
    refreshPanel();
  },
  startWave() {
    if (screen !== 'play') return;
    sound.ensure();
    if (world.phase === 'build') {
      if (!world.startWave()) sound.deny();
      refreshPanel();
    }
  },
  keyPressed(key) {
    if (screen !== 'play') {
      if ((key === 'enter' || key === ' ') && screen !== 'title') startGame();
      return;
    }
    sound.ensure();
    if (key === '1' || key === '2' || key === '3') {
      const k = TOWER_KEYS[Number(key) - 1];
      pendingBuild = pendingBuild === k ? null : k;
      world.selected = null;
      sound.click();
    } else if (key === 'escape') {
      pendingBuild = null;
      world.selected = null;
    } else if (key === 'p') {
      world.paused = !world.paused;
      showScreen('play');
    } else if (key === 'm') {
      sound.setMuted(!sound.muted);
    } else if (key === 'f') {
      world.speed = world.speed === 1 ? 2 : 1;
    } else if (key === 'r') {
      startGame();
      return;
    }
    refreshPanel();
  },
});

// ---------------------------------------------------------------- buttons

$('btn-start').addEventListener('click', startGame);
$('btn-again').addEventListener('click', startGame);
$('btn-retry').addEventListener('click', startGame);
$('btn-wave').addEventListener('click', () => {
  sound.ensure();
  if (!world.startWave()) sound.deny();
  refreshPanel();
});
$('btn-speed').addEventListener('click', () => {
  world.speed = world.speed === 1 ? 2 : 1;
  refreshPanel();
});
$('btn-pause').addEventListener('click', () => {
  world.paused = !world.paused;
  showScreen('play');
});
$('btn-resume').addEventListener('click', () => {
  world.paused = false;
  showScreen('play');
});
$('btn-mute').addEventListener('click', () => {
  sound.ensure();
  sound.setMuted(!sound.muted);
  refreshPanel();
});
$('btn-restart').addEventListener('click', startGame);

// ---------------------------------------------------------------- events -> sound

function drainEvents() {
  for (const ev of world.events) {
    if (ev.startsWith('shoot:')) sound.shoot(ev.slice(6));
    else if (ev === 'kill') sound.kill();
    else if (ev === 'coin') sound.coin();
    else if (ev === 'place') sound.place();
    else if (ev === 'upgrade') sound.upgrade();
    else if (ev === 'sell') sound.sell();
    else if (ev === 'horn') sound.horn();
    else if (ev === 'waveClear') sound.waveClear();
    else if (ev === 'leak') sound.leak();
    else if (ev === 'victory') sound.victory();
    else if (ev === 'defeat') sound.defeat();
  }
  world.events.length = 0;
}

// ---------------------------------------------------------------- loop

let last = performance.now();
let acc = 0;
let lastResult = null;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!shotMode && screen === 'play' && !world.paused && !world.result) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 8) {
      world.step(STEP);
      acc -= STEP;
      n += 1;
      if (world.speed === 2 && !world.result) {
        world.step(STEP);
      }
    }
    if (n === 8) acc = 0;
    drainEvents();
    if (world.result && lastResult !== world.result) {
      lastResult = world.result;
      endGame(world.result);
    }
  }
  renderer.draw(world);
  if (!shotMode) refreshPanel();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot

buildPalette();
refreshPanel();

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  shotMode = true;
  const staged = stageShot(shot, world);
  if (staged.selectTower) world.selected = { kind: 'tower', tower: staged.selectTower };
  if (staged.screen === 'title') showScreen('title');
  else if (staged.screen === 'victory') showScreen('victory');
  else if (staged.screen === 'defeat') showScreen('defeat');
  else showScreen('play');
  world.paused = true;
  renderer.draw(world);
  refreshPanel();
  window.__shotReady = true;
} else {
  showScreen('title');
  requestAnimationFrame(frame);
}
