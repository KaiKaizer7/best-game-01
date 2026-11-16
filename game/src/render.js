// EMBERHOLD — the renderer: everything the player sees is drawn here on one canvas,
// procedurally, with no image assets. The map is a dark hollow at night; the road glows
// warm, the towers glow in their own colours, and the wisps drift in like cold fire.

import { CELL, COLS, ROWS, MAP_W, MAP_H, PATH_PX, CORE_CELL, cellCentre, TOWERS, ENEMIES, towerStats } from './config.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bg = null;
  }

  /** The static night background, painted once per size (the fireflies move on top). */
  paintBackground(world) {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, 0, 0, MAP_H);
    g.addColorStop(0, '#0d1026');
    g.addColorStop(0.55, '#141a38');
    g.addColorStop(1, '#0a0d20');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    // Faint stars.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 60; i += 1) {
      const x = ((i * 173) % MAP_W) + 7;
      const y = ((i * 97) % 260) + 6;
      ctx.globalAlpha = 0.15 + ((i * 37) % 40) / 130;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
    // Soft vignette.
    const v = ctx.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.35, MAP_W / 2, MAP_H / 2, MAP_H * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }

  draw(world) {
    const { ctx } = this;
    ctx.save();
    if (world.shake > 0) {
      const s = world.shake * 5;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    this.paintBackground(world);
    this.drawPath(world);
    this.drawDecor(world);
    this.drawPlots(world);
    this.drawCore(world);
    this.drawTowers(world);
    this.drawEnemies(world);
    this.drawProjectiles(world);
    this.drawParticles(world);
    this.drawFloaters(world);
    this.drawBanner(world);
    ctx.restore();
  }

  drawPath(world) {
    const { ctx } = this;
    // Warm cobble band along the waypoints.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,150,60,0.16)';
    ctx.lineWidth = CELL * 0.94;
    ctx.beginPath();
    ctx.moveTo(PATH_PX[0].x, PATH_PX[0].y);
    for (let i = 1; i < PATH_PX.length; i += 1) ctx.lineTo(PATH_PX[i].x, PATH_PX[i].y);
    ctx.stroke();
    ctx.strokeStyle = '#3a2a1c';
    ctx.lineWidth = CELL * 0.78;
    ctx.stroke();
    ctx.strokeStyle = '#4a3624';
    ctx.lineWidth = CELL * 0.62;
    ctx.stroke();
    // Cobble dots along the road.
    ctx.fillStyle = 'rgba(255,190,110,0.35)';
    for (let i = 0; i < PATH_PX.length - 1; i += 1) {
      const a = PATH_PX[i];
      const b = PATH_PX[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.floor(len / 34);
      for (let s = 0; s <= steps; s += 1) {
        const t = s / Math.max(1, steps);
        const x = a.x + (b.x - a.x) * t + Math.sin(s * 2.7 + i) * 8;
        const y = a.y + (b.y - a.y) * t + Math.cos(s * 2.1 + i) * 8;
        circle(ctx, x, y, 2.2);
        ctx.fill();
      }
    }
    // Direction chevrons.
    ctx.strokeStyle = 'rgba(255,200,120,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i < PATH_PX.length - 1; i += 1) {
      const a = PATH_PX[i];
      const b = PATH_PX[i + 1];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(6, 0);
      ctx.lineTo(-6, 8);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawDecor(world) {
    const { ctx } = this;
    for (const r of world.decor.rocks) {
      const c = cellCentre(r.cx, r.cy);
      ctx.fillStyle = '#2c3350';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 8, 20 * r.s, 12 * r.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a4266';
      ctx.beginPath();
      ctx.ellipse(c.x - 4, c.y + 4, 12 * r.s, 7 * r.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const t of world.decor.trees) {
      const c = cellCentre(t.cx, t.cy);
      ctx.fillStyle = '#1c2440';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 26 * t.s);
      ctx.lineTo(c.x - 16 * t.s, c.y + 14 * t.s);
      ctx.lineTo(c.x + 16 * t.s, c.y + 14 * t.s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#24304f';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 34 * t.s);
      ctx.lineTo(c.x - 11 * t.s, c.y - 2 * t.s);
      ctx.lineTo(c.x + 11 * t.s, c.y - 2 * t.s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4a3624';
      ctx.fillRect(c.x - 2.5, c.y + 12 * t.s, 5, 8);
    }
    // Drifting fireflies.
    for (const f of world.decor.flies) {
      const x = f.x + Math.sin(world.time * 0.5 + f.p) * 14;
      const y = f.y + Math.cos(world.time * 0.4 + f.p * 1.3) * 10;
      const a = 0.25 + 0.35 * Math.abs(Math.sin(world.time * 1.4 + f.p));
      ctx.fillStyle = `rgba(255,200,90,${a})`;
      circle(ctx, x, y, 1.8 * f.s);
      ctx.fill();
    }
  }

  drawPlots(world) {
    const { ctx } = this;
    for (let cy = 0; cy < ROWS; cy += 1) {
      for (let cx = 0; cx < COLS; cx += 1) {
        if (world.pathSet.has(`${cx},${cy}`)) continue;
        if (cx === CORE_CELL.x && cy === CORE_CELL.y) continue;
        if (world.towerAt(cx, cy)) continue;
        const x = cx * CELL;
        const y = cy * CELL;
        const hov = world.hover && world.hover.cx === cx && world.hover.cy === cy;
        const sel = world.selected?.kind === 'plot' && world.selected.cx === cx && world.selected.cy === cy;
        ctx.strokeStyle = hov || sel ? 'rgba(255,210,120,0.9)' : 'rgba(255,210,120,0.22)';
        ctx.lineWidth = hov || sel ? 2 : 1;
        ctx.setLineDash([6, 6]);
        rr(ctx, x + 10, y + 10, CELL - 20, CELL - 20, 10);
        ctx.stroke();
        ctx.setLineDash([]);
        if (hov || sel) {
          ctx.fillStyle = 'rgba(255,210,120,0.10)';
          rr(ctx, x + 10, y + 10, CELL - 20, CELL - 20, 10);
          ctx.fill();
        }
      }
    }
  }

  drawCore(world) {
    const { ctx } = this;
    const c = cellCentre(CORE_CELL.x, CORE_CELL.y);
    const pulse = 1 + 0.06 * Math.sin(world.time * 3);
    // Glow.
    const g = ctx.createRadialGradient(c.x, c.y, 6, c.x, c.y, 64 * pulse);
    g.addColorStop(0, 'rgba(255,170,60,0.55)');
    g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g;
    circle(ctx, c.x, c.y, 64 * pulse);
    ctx.fill();
    // Stone ring.
    ctx.fillStyle = '#3a3348';
    circle(ctx, c.x, c.y, 30);
    ctx.fill();
    ctx.fillStyle = '#4a4260';
    circle(ctx, c.x, c.y, 24);
    ctx.fill();
    // Flame.
    const fh = (20 + 6 * Math.sin(world.time * 5)) * (0.5 + (world.coreHp / 20) * 0.5);
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 8 - fh);
    ctx.quadraticCurveTo(c.x + 11, c.y - 2, c.x + 7, c.y + 10);
    ctx.quadraticCurveTo(c.x, c.y + 16, c.x - 7, c.y + 10);
    ctx.quadraticCurveTo(c.x - 11, c.y - 2, c.x, c.y - 8 - fh);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 2 - fh * 0.55);
    ctx.quadraticCurveTo(c.x + 6, c.y + 2, c.x + 3, c.y + 10);
    ctx.quadraticCurveTo(c.x, c.y + 13, c.x - 3, c.y + 10);
    ctx.quadraticCurveTo(c.x - 6, c.y + 2, c.x, c.y - 2 - fh * 0.55);
    ctx.fill();
    // Core HP bar.
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rr(ctx, c.x - 26, c.y + 34, 52, 7, 3);
    ctx.fill();
    ctx.fillStyle = world.coreHp <= 5 ? '#ff5d5d' : '#ffb347';
    const w = Math.max(0, (world.coreHp / 20) * 50);
    if (w > 0) {
      rr(ctx, c.x - 25, c.y + 35, w, 5, 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe9c4';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`CORE ${world.coreHp}`, c.x, c.y + 52);
  }

  drawTowers(world) {
    const { ctx } = this;
    for (const t of world.towers) {
      const def = TOWERS[t.key];
      const stats = towerStats(t.key, t.level);
      // Range ring for the selected or hovered tower.
      const sel = world.selected?.tower === t;
      const hov = world.hover && world.hover.cx === t.cx && world.hover.cy === t.cy;
      if (sel || hov) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        circle(ctx, t.x, t.y, stats.range);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        circle(ctx, t.x, t.y, stats.range);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Shadow + base.
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(t.x, t.y + 22, 24, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e3350';
      rr(ctx, t.x - 20, t.y + 2, 40, 20, 6);
      ctx.fill();
      ctx.fillStyle = '#3d4468';
      rr(ctx, t.x - 20, t.y + 2, 40, 8, 6);
      ctx.fill();
      // The tower itself, drawn per kind.
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.key === 'spark') {
        ctx.rotate(t.angle);
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-8, -7);
        ctx.lineTo(-8, 7);
        ctx.closePath();
        ctx.fill();
        ctx.rotate(-t.angle);
        ctx.fillStyle = '#5a4a8a';
        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(9, -2);
        ctx.lineTo(-9, -2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowColor = def.glow;
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffe9a8';
        circle(ctx, 0, -28, 7 + (t.flash > 0 ? 2 : 0));
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (t.key === 'frost') {
        ctx.fillStyle = '#3a5a7a';
        ctx.fillRect(-3, -26, 6, 30);
        ctx.strokeStyle = '#7fd4ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(-9, -24, 18, 18);
        ctx.fillStyle = '#16283a';
        ctx.fillRect(-9, -24, 18, 18);
        ctx.shadowColor = def.glow;
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#cfeeff';
        circle(ctx, 0, -15, 5.5 + (t.flash > 0 ? 2 : 0));
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#7fd4ff';
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(5, -22);
        ctx.lineTo(-5, -22);
        ctx.closePath();
        ctx.fill();
      } else {
        // Ember Cannon: a squat mortar with a barrel that aims.
        ctx.rotate(t.angle);
        ctx.fillStyle = '#4a3a30';
        rr(ctx, -4, -6, 26, 12, 5);
        ctx.fill();
        ctx.fillStyle = '#ff6b4a';
        circle(ctx, 22, 0, 5 + (t.flash > 0 ? 2 : 0));
        ctx.fill();
        ctx.rotate(-t.angle);
        ctx.fillStyle = '#2e2a3a';
        circle(ctx, 0, 4, 15);
        ctx.fill();
        ctx.fillStyle = '#4a4260';
        circle(ctx, 0, 4, 10);
        ctx.fill();
      }
      ctx.restore();
      // Level pips.
      for (let i = 0; i < t.level; i += 1) {
        ctx.fillStyle = '#ffe08a';
        circle(ctx, t.x - 10 + i * 10, t.y + 28, 3);
        ctx.fill();
      }
    }
  }

  drawEnemies(world) {
    const { ctx } = this;
    for (const e of world.enemies) {
      const def = ENEMIES[e.type];
      const wob = Math.sin(e.wobble) * 2;
      const slowed = world.time < e.slowUntil;
      // Glow.
      ctx.shadowColor = def.glow;
      ctx.shadowBlur = 12;
      ctx.fillStyle = def.color;
      if (e.type === 'wisp') {
        circle(ctx, e.x, e.y + wob * 0.4, e.radius);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        circle(ctx, e.x - 4, e.y - 3 + wob * 0.4, 2.4);
        ctx.fill();
        circle(ctx, e.x + 4, e.y - 3 + wob * 0.4, 2.4);
        ctx.fill();
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(e.x - 6, e.y + e.radius - 2);
        ctx.quadraticCurveTo(e.x, e.y + e.radius + 10, e.x + 6, e.y + e.radius - 2);
        ctx.stroke();
      } else if (e.type === 'skitter') {
        ctx.save();
        ctx.translate(e.x, e.y + wob * 0.4);
        ctx.rotate(Math.sin(e.wobble * 2) * 0.25);
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-8, -7);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 7);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0d1026';
        circle(ctx, 4, -2, 2);
        ctx.fill();
        circle(ctx, 4, 2, 2);
        ctx.fill();
        ctx.restore();
      } else if (e.type === 'bulwark') {
        ctx.fillStyle = '#6b4a3a';
        circle(ctx, e.x, e.y, e.radius);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#8a6248';
        circle(ctx, e.x - 5, e.y - 5, e.radius * 0.55);
        ctx.fill();
        ctx.strokeStyle = def.glow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x - 8, e.y - 2);
        ctx.lineTo(e.x - 2, e.y + 4);
        ctx.lineTo(e.x + 4, e.y - 4);
        ctx.stroke();
        ctx.fillStyle = '#1a0f08';
        circle(ctx, e.x - 5, e.y - 6, 2.2);
        ctx.fill();
        circle(ctx, e.x + 5, e.y - 6, 2.2);
        ctx.fill();
      } else {
        // Shade Lord: a crowned dark wisp.
        ctx.fillStyle = '#2a0a2e';
        circle(ctx, e.x, e.y + wob * 0.3, e.radius);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.moveTo(e.x - 14, e.y - e.radius + 4);
        ctx.lineTo(e.x - 7, e.y - e.radius - 10);
        ctx.lineTo(e.x, e.y - e.radius + 2);
        ctx.lineTo(e.x + 7, e.y - e.radius - 10);
        ctx.lineTo(e.x + 14, e.y - e.radius + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        circle(ctx, e.x - 6, e.y - 4, 3);
        ctx.fill();
        circle(ctx, e.x + 6, e.y - 4, 3);
        ctx.fill();
        ctx.fillStyle = '#1a0f08';
        circle(ctx, e.x - 6, e.y - 4, 1.5);
        ctx.fill();
        circle(ctx, e.x + 6, e.y - 4, 1.5);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      if (slowed) {
        ctx.strokeStyle = 'rgba(127,212,255,0.9)';
        ctx.lineWidth = 2;
        circle(ctx, e.x, e.y, e.radius + 4);
        ctx.stroke();
      }
      if (e.flash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        circle(ctx, e.x, e.y, e.radius);
        ctx.fill();
      }
      // Health bar.
      const w = e.radius * 2;
      const pct = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
      ctx.fillStyle = pct > 0.5 ? '#7dffb0' : pct > 0.25 ? '#ffd34d' : '#ff5d5d';
      ctx.fillRect(e.x - w / 2 + 1, e.y - e.radius - 11, (w - 2) * pct, 3);
    }
  }

  drawProjectiles(world) {
    const { ctx } = this;
    for (const p of world.projectiles) {
      ctx.shadowBlur = 8;
      if (p.kind === 'spark') {
        ctx.shadowColor = '#ffb347';
        ctx.fillStyle = '#ffe9a8';
        circle(ctx, p.x, p.y, 4);
        ctx.fill();
      } else if (p.kind === 'frost') {
        ctx.shadowColor = '#7fd4ff';
        ctx.fillStyle = '#d6f2ff';
        circle(ctx, p.x, p.y, 5);
        ctx.fill();
        ctx.strokeStyle = '#7fd4ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x - 7, p.y);
        ctx.lineTo(p.x + 7, p.y);
        ctx.moveTo(p.x, p.y - 7);
        ctx.lineTo(p.x, p.y + 7);
        ctx.stroke();
      } else {
        ctx.shadowColor = '#ff6b4a';
        ctx.fillStyle = '#ff8c4d';
        circle(ctx, p.x, p.y, 7);
        ctx.fill();
        ctx.fillStyle = '#ffd34d';
        circle(ctx, p.x, p.y, 3.5);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
  }

  drawParticles(world) {
    const { ctx } = this;
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      circle(ctx, pt.x, pt.y, pt.size);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFloaters(world) {
    const { ctx } = this;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const f of world.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  drawBanner(world) {
    const { ctx } = this;
    if (!world.banner) return;
    const cx = MAP_W / 2;
    const cy = 120;
    ctx.fillStyle = 'rgba(10,12,30,0.72)';
    rr(ctx, cx - 250, cy - 34, 500, 74, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,120,0.6)';
    ctx.lineWidth = 1.5;
    rr(ctx, cx - 250, cy - 34, 500, 74, 12);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.banner.text, cx, cy + 2);
    ctx.fillStyle = '#c9d2ff';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(world.banner.sub, cx, cy + 26);
  }
}
